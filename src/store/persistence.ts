import type { AppData, Lang } from '../types';
import { createSeedData } from '../lib/seed';
import { parseSaveFile, SaveFileError } from '../lib/saveFile';
import {
  backupCorruptData,
  loadData,
  loadMeta,
  requestPersistentStorage,
  saveData,
  saveMeta,
  type Meta,
} from '../lib/storage';
import { initialMeta, pickDefaultMonth, useStore, type Mode, type StoreState } from './store';

const PREFS_KEY = 'katana-schema-prefs';

interface Prefs {
  uiLang?: Lang;
  currentMonth?: string | null;
  mode?: Mode;
}

function readPrefs(): Prefs {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Prefs;
  } catch {
    return {};
  }
}

function writePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // Bara en bekvämlighet
  }
}

function defaultLang(): Lang {
  return 'sv';
}

let pending: { data?: AppData; meta?: Meta } = {};
let timer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = 2_000;

async function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  // Datan i webbläsaren kunde inte läsas: skriv inte över den
  if (useStore.getState().storageProblem) return;
  const job = pending;
  pending = {};
  if (!job.data && !job.meta) return;
  try {
    if (job.data) await saveData(job.data);
    if (job.meta) await saveMeta(job.meta);
    retryDelay = 2_000;
    if (useStore.getState().storageError) useStore.setState({ storageError: false });
  } catch (err) {
    console.error('Kunde inte spara i webbläsaren', err);
    useStore.setState({ storageError: true });
    // Lägg tillbaka det som inte sparades (om inget nyare kommit) och försök igen
    pending = { data: pending.data ?? job.data, meta: pending.meta ?? job.meta };
    timer = setTimeout(() => void flush(), retryDelay);
    retryDelay = Math.min(retryDelay * 2, 60_000);
  }
}

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), 250);
}

/** Sparar direkt (används t.ex. innan sidan laddas om). */
export function flushNow(): Promise<void> {
  return flush();
}

/** Användaren väljer att börja om trots att sparad data inte kunde läsas. */
export async function startOver(): Promise<void> {
  const s = useStore.getState();
  useStore.setState({ storageProblem: null });
  pending = { data: s.data, meta: s.meta };
  await flush();
}

/** Läser in data från webbläsaren och startar automatisk sparning. */
export async function initApp(): Promise<void> {
  const prefs = readPrefs();
  const uiLang: Lang = prefs.uiLang === 'en' || prefs.uiLang === 'sv' ? prefs.uiLang : defaultLang();
  let data: AppData = createSeedData();
  let meta: Meta = initialMeta;
  let storageProblem: StoreState['storageProblem'] = null;

  try {
    const raw = await loadData();
    if (raw == null) {
      await saveData(data);
    } else {
      try {
        data = parseSaveFile(JSON.stringify(raw));
      } catch (err) {
        if (err instanceof SaveFileError && err.key === 'file.errorNewerVersion') {
          storageProblem = 'newer';
        } else {
          console.error('Sparad data kunde inte läsas', err);
          storageProblem = 'corrupt';
          await backupCorruptData(raw);
        }
      }
    }
    meta = { ...initialMeta, ...((await loadMeta()) ?? {}) };
  } catch (err) {
    console.error('IndexedDB fungerar inte', err);
    storageProblem = 'unreadable';
  }

  const monthExists = (key: string | null | undefined) =>
    !!key && data.months.some((m) => `${m.year}-${String(m.month).padStart(2, '0')}` === key);

  useStore.setState({
    loaded: true,
    data,
    meta,
    storageProblem,
    uiLang,
    mode: prefs.mode === 'view' ? 'view' : 'edit',
    currentMonth: monthExists(prefs.currentMonth) ? prefs.currentMonth! : pickDefaultMonth(data),
  });

  useStore.subscribe((state, prev) => {
    if (state.data !== prev.data) pending.data = state.data;
    if (state.meta !== prev.meta) pending.meta = state.meta;
    if (state.data !== prev.data || state.meta !== prev.meta) schedule();
    if (state.uiLang !== prev.uiLang || state.currentMonth !== prev.currentMonth || state.mode !== prev.mode) {
      writePrefs({ uiLang: state.uiLang, currentMonth: state.currentMonth, mode: state.mode });
    }
  });

  const flushOnHide = () => {
    if (pending.data || pending.meta) void flush();
  };
  window.addEventListener('pagehide', flushOnHide);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushOnHide();
  });
  window.addEventListener('beforeunload', flushOnHide);

  void requestPersistentStorage();
  detectOtherTabs();
}

/** Varnar om appen är öppen i flera flikar samtidigt, eftersom de då skriver över varandras data. */
function detectOtherTabs() {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel('katana-schema');
  channel.onmessage = (e) => {
    if (e.data === 'hello') channel.postMessage('here');
    if (e.data === 'hello' || e.data === 'here') useStore.setState({ otherTabOpen: true });
  };
  channel.postMessage('hello');
}
