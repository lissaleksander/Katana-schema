import { create } from 'zustand';
import { produce, type Draft } from 'immer';
import type { Activity, ActivityType, AppData, Coach, Lang, Settings } from '../types';
import { createSeedData } from '../lib/seed';
import {
  addDays,
  addMonths as addMonthsYM,
  compareYearMonth,
  diffDays,
  isDateInMonth,
  monthDates,
  monthKey,
  parseMonthKey,
  type YearMonth,
} from '../lib/dates';
import { newId } from '../lib/id';
import { copyMonth, type CopySummary } from '../lib/copyMonth';
import { belongsToMonth, lastDate, monthContentHash } from '../lib/schedule';
import type { Meta } from '../lib/storage';

export const HISTORY_LIMIT = 100;
/** Ändringar i samma fält inom denna tid blir ett enda ångra-steg. */
export const COALESCE_MS = 1500;

export type Mode = 'edit' | 'view';

export type DialogState =
  | { kind: 'newMonth' }
  | { kind: 'addActivity'; date: string }
  | { kind: 'copyToDays'; activityId: string }
  | { kind: 'coach'; coachId: string | null }
  | { kind: 'types' }
  | { kind: 'settings' }
  | { kind: 'replaceCoach' }
  | { kind: 'confirm'; message: string; confirmLabel: string; danger?: boolean; resolve: (ok: boolean) => void };

export interface Toast {
  id: number;
  message: string;
  kind: 'info' | 'error';
  action?: { label: string; run: () => void };
  /** ms, 0 = tills den stängs */
  duration: number;
}

export interface CommitOptions {
  /** Ändringar med samma nyckel tätt efter varandra slås ihop till ett ångra-steg. */
  coalesceKey?: string;
}

export interface StoreState {
  loaded: boolean;
  data: AppData;
  past: AppData[];
  future: AppData[];
  lastCommit: { key: string; at: number } | null;
  meta: Meta;
  storageError: boolean;
  /**
   * Sparad data kunde inte läsas. Då sparas inget automatiskt (för att inte skriva över den)
   * förrän en fil öppnas eller användaren väljer att börja om.
   */
  storageProblem: 'corrupt' | 'newer' | 'unreadable' | null;
  otherTabOpen: boolean;
  updateAvailable: boolean;

  uiLang: Lang;
  currentMonth: string | null;
  mode: Mode;
  selectedId: string | null;
  assignCoachId: string | null;
  showInactiveCoaches: boolean;
  dialog: DialogState | null;
  toast: Toast | null;
  exporting: boolean;
}

export const initialMeta: Meta = { changedSinceFileSave: false };

export const useStore = create<StoreState>()(() => ({
  loaded: false,
  data: createSeedData(),
  past: [],
  future: [],
  lastCommit: null,
  meta: initialMeta,
  storageError: false,
  storageProblem: null,
  otherTabOpen: false,
  updateAvailable: false,
  uiLang: 'sv',
  currentMonth: null,
  mode: 'edit',
  selectedId: null,
  assignCoachId: null,
  showInactiveCoaches: false,
  dialog: null,
  toast: null,
  exporting: false,
}));

const S = () => useStore.getState();
const setS = useStore.setState;

// ---------------------------------------------------------------------------
// Historik (ångra/gör om)

function markChanged(meta: Meta, now = new Date()): Meta {
  if (meta.changedSinceFileSave) return meta;
  return { ...meta, changedSinceFileSave: true, firstUnsavedChangeAt: now.toISOString() };
}

/** Gör en ändring i datan. Varje anrop blir ett ångra-steg (om inte coalesceKey slår ihop det). */
export function commit(recipe: (draft: Draft<AppData>) => void, opts: CommitOptions = {}): boolean {
  const state = S();
  const next = produce(state.data, recipe);
  if (next === state.data) return false;
  const now = Date.now();
  const coalesce =
    opts.coalesceKey != null &&
    state.lastCommit?.key === opts.coalesceKey &&
    now - state.lastCommit.at < COALESCE_MS &&
    state.past.length > 0;
  setS({
    data: next,
    past: coalesce ? state.past : [...state.past, state.data].slice(-HISTORY_LIMIT),
    future: [],
    lastCommit: opts.coalesceKey != null ? { key: opts.coalesceKey, at: now } : null,
    meta: markChanged(state.meta),
    ...staleToastPatch(),
  });
  return true;
}

/** En toast med "Ångra" gäller bara tills datan ändras igen. */
function staleToastPatch(): Partial<StoreState> {
  return S().toast?.action ? { toast: null } : {};
}

/**
 * Exportstatus (publicerad, senast exporterad) är ett faktum om vad som skickats ut,
 * inte en redigering – den ska inte försvinna när man ångrar eller gör om.
 */
function keepExportStatus(target: AppData, current: AppData): AppData {
  return produce(target, (d) => {
    for (const m of d.months) {
      const cur = current.months.find((x) => x.year === m.year && x.month === m.month);
      if (!cur || (cur.status === m.status && cur.lastExportedAt === m.lastExportedAt)) continue;
      m.status = cur.status;
      if (cur.lastExportedAt) m.lastExportedAt = cur.lastExportedAt;
      else delete m.lastExportedAt;
      if (cur.exportedHash) m.exportedHash = cur.exportedHash;
      else delete m.exportedHash;
    }
  });
}

/** Satt när en fil öppnats, så att man vet när öppningen ångras. */
let fileOpenMarker: { before: AppData; after: AppData; onUndone: () => void } | null = null;

function afterHistoryJump(data: AppData) {
  const s = S();
  const patch: Partial<StoreState> = {};
  if (s.selectedId && !data.activities.some((a) => a.id === s.selectedId)) patch.selectedId = null;
  if (!s.currentMonth || !data.months.some((m) => monthKey(m) === s.currentMonth)) {
    patch.currentMonth = pickDefaultMonth(data);
  }
  if (s.assignCoachId && !data.coaches.some((c) => c.id === s.assignCoachId && c.active)) patch.assignCoachId = null;
  return patch;
}

export function undo(): boolean {
  const s = S();
  if (s.past.length === 0) return false;
  const stored = s.past[s.past.length - 1];
  const prev = keepExportStatus(stored, s.data);
  const undoneOpen =
    fileOpenMarker && fileOpenMarker.after === s.data && fileOpenMarker.before === stored ? fileOpenMarker : null;
  setS({
    ...staleToastPatch(),
    data: prev,
    past: s.past.slice(0, -1),
    future: [s.data, ...s.future].slice(0, HISTORY_LIMIT),
    lastCommit: null,
    meta: markChanged(s.meta),
    ...afterHistoryJump(prev),
  });
  if (undoneOpen) {
    fileOpenMarker = null;
    undoneOpen.onUndone();
  }
  return true;
}

export function redo(): boolean {
  const s = S();
  if (s.future.length === 0) return false;
  const next = keepExportStatus(s.future[0], s.data);
  setS({
    ...staleToastPatch(),
    data: next,
    past: [...s.past, s.data].slice(-HISTORY_LIMIT),
    future: s.future.slice(1),
    lastCommit: null,
    meta: markChanged(s.meta),
    ...afterHistoryJump(next),
  });
  return true;
}

/**
 * Ersätter all data (vid inläsning av fil). Kan ångras; då anropas onUndone.
 */
export function replaceAllData(data: AppData, onUndone: () => void = () => {}) {
  const s = S();
  fileOpenMarker = { before: s.data, after: data, onUndone };
  setS({
    ...staleToastPatch(),
    data,
    past: [...s.past, s.data].slice(-HISTORY_LIMIT),
    future: [],
    lastCommit: null,
    selectedId: null,
    assignCoachId: null,
    currentMonth: pickDefaultMonth(data),
  });
}

// ---------------------------------------------------------------------------
// Gränssnittets tillstånd

export function sortedMonths(data: Pick<AppData, 'months'>): YearMonth[] {
  return [...data.months].sort(compareYearMonth).map((m) => ({ year: m.year, month: m.month }));
}

/** Väljer månaden som innehåller idag, annars den senaste. */
export function pickDefaultMonth(data: AppData, today = new Date()): string | null {
  const months = sortedMonths(data);
  if (months.length === 0) return null;
  const cur = months.find((m) => m.year === today.getFullYear() && m.month === today.getMonth() + 1);
  return monthKey(cur ?? months[months.length - 1]);
}

export function setCurrentMonth(key: string) {
  setS({ currentMonth: key, selectedId: null });
}

export function setMode(mode: Mode) {
  setS({ mode, selectedId: null, assignCoachId: null });
}

export function setUiLang(lang: Lang) {
  setS({ uiLang: lang });
}

export function select(id: string | null) {
  setS({ selectedId: id });
}

export function setAssignCoach(id: string | null) {
  setS({ assignCoachId: id });
}

export function openDialog(dialog: DialogState) {
  setS({ dialog });
}

export function closeDialog() {
  setS({ dialog: null });
}

export function confirmDialog(message: string, confirmLabel: string, danger = false): Promise<boolean> {
  return new Promise((resolve) => {
    setS({
      dialog: {
        kind: 'confirm',
        message,
        confirmLabel,
        danger,
        resolve: (ok) => {
          setS({ dialog: null });
          resolve(ok);
        },
      },
    });
  });
}

/** Visar en toast med "Ångra" som bara ångrar om inget annat hunnit ändras. */
export function showUndoToast(message: string, label: string, duration = 8_000) {
  const ref = S().data;
  showToast(message, {
    duration,
    action: { label, run: () => void (S().data === ref && undo()) },
  });
}

let toastSeq = 0;
export function showToast(message: string, opts: Partial<Omit<Toast, 'id' | 'message'>> = {}) {
  setS({
    toast: {
      id: ++toastSeq,
      message,
      kind: opts.kind ?? 'info',
      action: opts.action,
      duration: opts.duration ?? (opts.kind === 'error' ? 10_000 : 6_000),
    },
  });
}

export function dismissToast(id?: number) {
  const t = S().toast;
  if (t && (id == null || t.id === id)) setS({ toast: null });
}

// ---------------------------------------------------------------------------
// Månader

export function createMonth(
  target: YearMonth,
  source: { kind: 'empty' } | { kind: 'copy'; from: YearMonth; withoutCoaches: boolean },
): CopySummary | null {
  const data = S().data;
  if (data.months.some((m) => m.year === target.year && m.month === target.month)) return null;
  let summary: CopySummary | null = null;
  let copied: Activity[] = [];
  if (source.kind === 'copy') {
    const r = copyMonth(data, source.from, target, { withoutCoaches: source.withoutCoaches });
    copied = r.activities;
    summary = r.summary;
  }
  commit((d) => {
    d.months.push({ year: target.year, month: target.month, status: 'draft' });
    d.months.sort(compareYearMonth);
    d.activities.push(...copied);
  });
  setS({ currentMonth: monthKey(target), selectedId: null, mode: 'edit' });
  return summary;
}

/** Tar bort månaden och de aktiviteter som börjar i den (läger som fortsätter in i nästa månad kortas av). */
export function deleteMonth(ym: YearMonth) {
  const key = monthKey(ym);
  const nextMonthStart = monthDates(addMonthsYM(ym, 1))[0];
  commit((d) => {
    d.months = d.months.filter((m) => monthKey(m) !== key);
    d.activities = d.activities.filter((a) => !belongsToMonth(a, ym) || lastDate(a) >= nextMonthStart);
    // Läger som fortsätter in i nästa månad finns kvar där, från den 1:a
    for (const a of d.activities) {
      if (belongsToMonth(a, ym)) {
        a.date = nextMonthStart;
        if (a.endDate && a.endDate <= a.date) delete a.endDate;
      }
    }
  });
  const data = S().data;
  setS({ currentMonth: pickDefaultMonth(data), selectedId: null, assignCoachId: null });
}

/** Markerar månaden som publicerad. Blir inget ångra-steg (se keepExportStatus). */
export function markExported(ym: YearMonth, at = new Date()) {
  const s = S();
  const hash = monthContentHash(s.data, ym);
  const data = produce(s.data, (d) => {
    const m = d.months.find((x) => x.year === ym.year && x.month === ym.month);
    if (!m) return;
    m.status = 'published';
    m.lastExportedAt = at.toISOString();
    m.exportedHash = hash;
  });
  if (data !== s.data) setS({ data, meta: markChanged(s.meta) });
}

// ---------------------------------------------------------------------------
// Aktiviteter

function findActivity(d: Draft<AppData>, id: string) {
  return d.activities.find((a) => a.id === id);
}

export function addActivity(date: string, typeId: string): string | null {
  const type = S().data.activityTypes.find((t) => t.id === typeId);
  if (!type) return null;
  const id = newId('a');
  commit((d) => {
    const a: Activity = { id, date, start: type.start, end: type.end, typeId, coachIds: [] };
    if (type.category === 'party') a.party = { contact: '' };
    d.activities.push(a);
  });
  setS({ selectedId: id });
  return id;
}

export type ActivityPatch = Partial<Pick<Activity, 'date' | 'endDate' | 'start' | 'end' | 'customTitle' | 'note'>>;

export function updateActivity(id: string, patch: ActivityPatch, coalesceKey?: string) {
  commit(
    (d) => {
      const a = findActivity(d, id);
      if (!a) return;
      for (const [k, v] of Object.entries(patch) as [keyof ActivityPatch, string | undefined][]) {
        if (v === undefined || v === '') delete a[k];
        else a[k] = v;
      }
      if (a.endDate && a.endDate <= a.date) delete a.endDate;
    },
    { coalesceKey },
  );
}

/** Byter typ. Slutdatum finns bara för läger och kalasuppgifter bara för kalas. */
export function changeActivityType(id: string, typeId: string) {
  const type = S().data.activityTypes.find((t) => t.id === typeId);
  if (!type) return;
  commit((d) => {
    const a = findActivity(d, id);
    if (!a) return;
    a.typeId = typeId;
    if (type.category !== 'camp') delete a.endDate;
    if (type.category !== 'party') delete a.party;
    else if (!a.party) a.party = { contact: '' };
  });
}

export function updateParty(
  id: string,
  patch: { contact?: string; age?: number | null; childCount?: number | null; note?: string },
  coalesceKey?: string,
) {
  commit(
    (d) => {
      const a = findActivity(d, id);
      if (!a) return;
      const p = (a.party ??= { contact: '' });
      if (patch.contact !== undefined) p.contact = patch.contact;
      if (patch.note !== undefined) {
        if (patch.note) p.note = patch.note;
        else delete p.note;
      }
      if (patch.age !== undefined) {
        if (patch.age == null) delete p.age;
        else p.age = patch.age;
      }
      if (patch.childCount !== undefined) {
        if (patch.childCount == null) delete p.childCount;
        else p.childCount = patch.childCount;
      }
    },
    { coalesceKey },
  );
}

export function deleteActivity(id: string) {
  commit((d) => {
    d.activities = d.activities.filter((a) => a.id !== id);
  });
  if (S().selectedId === id) setS({ selectedId: null });
}

/** Flyttar till ett annat datum; ett läger behåller sin längd. */
export function moveActivity(id: string, date: string, coalesceKey?: string) {
  commit(
    (d) => {
      const a = findActivity(d, id);
      if (!a || a.date === date) return;
      const span = diffDays(a.date, lastDate(a));
      a.date = date;
      if (span > 0) a.endDate = addDays(date, span);
    },
    { coalesceKey },
  );
}

export function toggleCoachOnActivity(id: string, coachId: string) {
  commit((d) => {
    const a = findActivity(d, id);
    if (!a) return;
    const i = a.coachIds.indexOf(coachId);
    if (i >= 0) a.coachIds.splice(i, 1);
    else a.coachIds.push(coachId);
  });
}

export function addCoachToActivity(id: string, coachId: string) {
  commit((d) => {
    const a = findActivity(d, id);
    if (a && !a.coachIds.includes(coachId)) a.coachIds.push(coachId);
  });
}

export function removeCoachFromActivity(id: string, coachId: string) {
  commit((d) => {
    const a = findActivity(d, id);
    const i = a ? a.coachIds.indexOf(coachId) : -1;
    if (i >= 0) a!.coachIds.splice(i, 1);
  });
}

/** Flyttar en coach ett steg åt vänster (-1) eller höger (+1) i ordningen. */
export function moveCoachInActivity(id: string, coachId: string, dir: -1 | 1) {
  commit((d) => {
    const a = findActivity(d, id);
    if (!a) return;
    const i = a.coachIds.indexOf(coachId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= a.coachIds.length) return;
    [a.coachIds[i], a.coachIds[j]] = [a.coachIds[j], a.coachIds[i]];
  });
}

/**
 * Kopierar en aktivitet till flera datum. Datum där samma pass (typ och tid) redan finns hoppas över.
 */
export function copyActivityToDates(id: string, dates: string[]): { copied: number; skipped: number } {
  const data = S().data;
  const src = data.activities.find((a) => a.id === id);
  if (!src) return { copied: 0, skipped: 0 };
  const span = diffDays(src.date, lastDate(src));
  const result = { copied: 0, skipped: 0 };
  const copies: Activity[] = [];
  for (const date of [...new Set(dates)].sort()) {
    if (date === src.date) continue;
    const exists = data.activities.some(
      (a) => a.date === date && a.typeId === src.typeId && a.start === src.start && a.end === src.end,
    );
    if (exists) {
      result.skipped++;
      continue;
    }
    const copy: Activity = structuredClone(src);
    copy.id = newId('a');
    copy.date = date;
    if (span > 0) copy.endDate = addDays(date, span);
    copies.push(copy);
    result.copied++;
  }
  if (copies.length) commit((d) => void d.activities.push(...copies));
  return result;
}

/** Ersätter en coach med en annan på alla pass som syns mellan två datum (F16). */
export function replaceCoachInPeriod(fromId: string, toId: string, start: string, end: string): number {
  if (fromId === toId) return 0;
  let count = 0;
  commit((d) => {
    for (const a of d.activities) {
      if (a.date > end || lastDate(a) < start) continue;
      const i = a.coachIds.indexOf(fromId);
      if (i < 0) continue;
      if (a.coachIds.includes(toId)) a.coachIds.splice(i, 1);
      else a.coachIds[i] = toId;
      count++;
    }
  });
  return count;
}

// ---------------------------------------------------------------------------
// Coacher

export function isCoachUsed(data: AppData, id: string): boolean {
  return data.activities.some((a) => a.coachIds.includes(id));
}

export function addCoach(coach: Omit<Coach, 'id'>): string {
  const id = newId('c');
  commit((d) => void d.coaches.push({ ...coach, id }));
  return id;
}

export function updateCoach(id: string, patch: Partial<Omit<Coach, 'id'>>) {
  commit((d) => {
    const c = d.coaches.find((x) => x.id === id);
    if (!c) return;
    Object.assign(c, patch);
    if (!c.textColor) delete c.textColor;
  });
  if (patch.active === false && S().assignCoachId === id) setS({ assignCoachId: null });
}

/** Tar bort coachen helt om den aldrig använts, annars inaktiveras den. */
export function deleteCoach(id: string): 'deleted' | 'deactivated' {
  if (isCoachUsed(S().data, id)) {
    updateCoach(id, { active: false });
    return 'deactivated';
  }
  commit((d) => {
    d.coaches = d.coaches.filter((c) => c.id !== id);
  });
  if (S().assignCoachId === id) setS({ assignCoachId: null });
  return 'deleted';
}

// ---------------------------------------------------------------------------
// Aktivitetstyper

export function isTypeUsed(data: AppData, id: string): boolean {
  return data.activities.some((a) => a.typeId === id);
}

export function addActivityType(type: Omit<ActivityType, 'id'>): string {
  const id = newId('t');
  commit((d) => void d.activityTypes.push({ ...type, id }));
  return id;
}

export function updateActivityType(id: string, patch: Partial<Omit<ActivityType, 'id'>>, coalesceKey?: string) {
  commit(
    (d) => {
      const t = d.activityTypes.find((x) => x.id === id);
      if (!t) return;
      const categoryChanged = patch.category != null && patch.category !== t.category;
      Object.assign(t, patch);
      if (categoryChanged) {
        for (const a of d.activities) {
          if (a.typeId !== id) continue;
          if (t.category !== 'camp') delete a.endDate;
          if (t.category === 'party' && !a.party) a.party = { contact: '' };
        }
      }
    },
    { coalesceKey },
  );
}

export function deleteActivityType(id: string): 'deleted' | 'deactivated' {
  if (isTypeUsed(S().data, id)) {
    updateActivityType(id, { active: false });
    return 'deactivated';
  }
  commit((d) => {
    d.activityTypes = d.activityTypes.filter((t) => t.id !== id);
  });
  return 'deleted';
}

// ---------------------------------------------------------------------------
// Inställningar

export function updateSettings(patch: Partial<Settings>, coalesceKey?: string) {
  commit(
    (d) => {
      Object.assign(d.settings, patch);
      if (!d.settings.logoDataUrl) delete d.settings.logoDataUrl;
    },
    { coalesceKey },
  );
}

export function setMeta(patch: Partial<Meta>) {
  setS({ meta: { ...S().meta, ...patch } });
}

// ---------------------------------------------------------------------------
// Hjälp för vyer

export function currentYearMonth(state: StoreState): YearMonth | null {
  return state.currentMonth ? parseMonthKey(state.currentMonth) : null;
}

export function isDateInCurrentMonth(state: StoreState, date: string): boolean {
  const ym = currentYearMonth(state);
  return !!ym && isDateInMonth(date, ym);
}
