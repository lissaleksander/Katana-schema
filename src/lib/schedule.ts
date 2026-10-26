import type { Activity, ActivityType, AppData, Category, Coach, Lang } from '../types';
import { isDateInMonth, monthDates, timeToMinutes, type YearMonth } from './dates';

export type TypeMap = Map<string, ActivityType>;
export type CoachMap = Map<string, Coach>;

export function typeMap(data: AppData): TypeMap {
  return new Map(data.activityTypes.map((t) => [t.id, t]));
}

export function coachMap(data: AppData): CoachMap {
  return new Map(data.coaches.map((c) => [c.id, c]));
}

/** Sista dagen aktiviteten syns (samma som startdagen om inget slutdatum finns). */
export function lastDate(a: Activity): string {
  return a.endDate && a.endDate > a.date ? a.endDate : a.date;
}

export function occursOn(a: Activity, date: string): boolean {
  return a.date <= date && date <= lastDate(a);
}

/** Aktiviteten syns någon dag i månaden. */
export function occursInMonth(a: Activity, ym: YearMonth): boolean {
  const dates = monthDates(ym);
  return a.date <= dates[dates.length - 1] && lastDate(a) >= dates[0];
}

/** Aktiviteten "hör till" månaden där den börjar. */
export function belongsToMonth(a: Activity, ym: YearMonth): boolean {
  return isDateInMonth(a.date, ym);
}

function categoryRank(c: Category | undefined): number {
  if (c === 'party') return 0;
  if (c === 'openGym') return 2;
  return 1;
}

export function typeName(t: ActivityType | undefined, lang: Lang): string {
  if (!t) return '?';
  return lang === 'en' && t.nameEn.trim() ? t.nameEn : t.nameSv;
}

/** Titeln som visas i schemat. Kalas får ålder efter namnet, t.ex. "Kalas 8 år". */
export function activityTitle(a: Activity, t: ActivityType | undefined, lang: Lang): string {
  const base = a.customTitle?.trim() || typeName(t, lang);
  if (t?.category === 'party' && a.party?.age != null) {
    return lang === 'en' ? `${base} ${a.party.age} YO` : `${base} ${a.party.age} år`;
  }
  return base;
}

export function formatTimeRange(a: { start: string; end: string }): string {
  return `${a.start}–${a.end}`;
}

/** Sortering i en dagruta: kalas överst, sedan på starttid, öppet gym sist. */
export function sortForDay(list: Activity[], types: TypeMap): Activity[] {
  return [...list].sort((a, b) => {
    const ra = categoryRank(types.get(a.typeId)?.category);
    const rb = categoryRank(types.get(b.typeId)?.category);
    if (ra !== rb) return ra - rb;
    const s = timeToMinutes(a.start) - timeToMinutes(b.start);
    if (s !== 0) return s;
    const e = timeToMinutes(a.end) - timeToMinutes(b.end);
    if (e !== 0) return e;
    const ta = typeName(types.get(a.typeId), 'sv');
    const tb = typeName(types.get(b.typeId), 'sv');
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Aktiviteter per datum i månaden, sorterade. */
export function buildDayIndex(data: AppData, ym: YearMonth): Map<string, Activity[]> {
  const types = typeMap(data);
  const dates = monthDates(ym);
  const first = dates[0];
  const last = dates[dates.length - 1];
  const index = new Map<string, Activity[]>(dates.map((d) => [d, []]));
  for (const a of data.activities) {
    if (a.date > last || lastDate(a) < first) continue;
    for (const d of dates) if (occursOn(a, d)) index.get(d)!.push(a);
  }
  for (const [d, list] of index) index.set(d, sortForDay(list, types));
  return index;
}

export type WarningKind = 'noCoach' | 'overlap' | 'endBeforeStart';

export interface ActivityWarnings {
  kinds: WarningKind[];
  /** Coacher som har ett annat pass samtidigt */
  overlapCoachIds: string[];
}

/** Varningar (bara i redigeringsläget): pass utan coach, coach på två överlappande pass, fel tider. */
export function computeWarnings(data: AppData, ym: YearMonth): Map<string, ActivityWarnings> {
  const result = new Map<string, ActivityWarnings>();
  const get = (id: string) => {
    let w = result.get(id);
    if (!w) {
      w = { kinds: [], overlapCoachIds: [] };
      result.set(id, w);
    }
    return w;
  };
  const index = buildDayIndex(data, ym);
  const seen = new Set<string>();
  for (const list of index.values()) {
    for (const a of list) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      if (a.coachIds.length === 0) get(a.id).kinds.push('noCoach');
      if (timeToMinutes(a.end) <= timeToMinutes(a.start)) get(a.id).kinds.push('endBeforeStart');
    }
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const overlaps =
          timeToMinutes(a.start) < timeToMinutes(b.end) && timeToMinutes(b.start) < timeToMinutes(a.end);
        if (!overlaps) continue;
        for (const c of a.coachIds) {
          if (!b.coachIds.includes(c)) continue;
          for (const x of [a, b]) {
            const w = get(x.id);
            if (!w.kinds.includes('overlap')) w.kinds.push('overlap');
            if (!w.overlapCoachIds.includes(c)) w.overlapCoachIds.push(c);
          }
        }
      }
    }
  }
  return result;
}

/** Antal pass per coach i månaden (ett läger räknas en gång per dag). */
export function coachPassCounts(data: AppData, ym: YearMonth): Map<string, number> {
  const counts = new Map<string, number>();
  for (const list of buildDayIndex(data, ym).values()) {
    for (const a of list) for (const c of a.coachIds) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return counts;
}

function hashString(s: string): string {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Fingeravtryck av allt som syns i exportbilden för månaden. Används för att se om
 * månaden ändrats efter senaste export.
 */
export function monthContentHash(data: AppData, ym: YearMonth): string {
  const types = typeMap(data);
  const coaches = coachMap(data);
  const lang = data.settings.exportLang;
  const days: unknown[] = [];
  for (const [date, list] of buildDayIndex(data, ym)) {
    days.push([
      date,
      list.map((a) => [
        a.start,
        a.end,
        activityTitle(a, types.get(a.typeId), lang),
        a.note ?? '',
        a.coachIds.map((id) => {
          const c = coaches.get(id);
          return c ? [c.name, c.color, c.textColor ?? ''] : id;
        }),
      ]),
    ]);
  }
  return hashString(
    JSON.stringify([data.settings.gymName, data.settings.logoDataUrl ?? '', lang, days]),
  );
}
