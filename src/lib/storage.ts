import { createStore, del, get, set } from 'idb-keyval';
import type { AppData } from '../types';

// Allt sparas i webbläsarens IndexedDB. Sparfilen (.json) är backupen.

export interface Meta {
  /** Senaste gången data sparades till fil (ISO) */
  lastFileSaveAt?: string;
  /** Namnet på filen som senast sparades/öppnades */
  fileName?: string;
  /** Det finns ändringar som inte sparats till fil */
  changedSinceFileSave: boolean;
  /** När den första osparade ändringen gjordes (ISO) */
  firstUnsavedChangeAt?: string;
}

const store = typeof indexedDB !== 'undefined' ? createStore('katana-schema', 'kv') : undefined;

const DATA_KEY = 'data';
const META_KEY = 'meta';
const HANDLE_KEY = 'fileHandle';

function requireStore() {
  if (!store) throw new Error('IndexedDB saknas');
  return store;
}

export async function loadData(): Promise<unknown> {
  return get(DATA_KEY, requireStore());
}

export async function saveData(data: AppData): Promise<void> {
  await set(DATA_KEY, data, requireStore());
}

export async function backupCorruptData(raw: unknown): Promise<void> {
  await set(`corrupt-${new Date().toISOString()}`, raw, requireStore());
}

export async function loadMeta(): Promise<Meta | undefined> {
  return get(META_KEY, requireStore());
}

export async function saveMeta(meta: Meta): Promise<void> {
  await set(META_KEY, meta, requireStore());
}

export async function loadFileHandle(): Promise<FileSystemFileHandle | undefined> {
  try {
    return await get(HANDLE_KEY, requireStore());
  } catch {
    return undefined;
  }
}

export async function saveFileHandle(handle: FileSystemFileHandle | undefined): Promise<void> {
  try {
    if (handle) await set(HANDLE_KEY, handle, requireStore());
    else await del(HANDLE_KEY, requireStore());
  } catch {
    // Vissa webbläsare kan inte spara filreferenser; då frågar vi efter fil nästa gång.
  }
}

/** Ber webbläsaren att inte rensa vår data automatiskt. */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    // Inte kritiskt
  }
}
