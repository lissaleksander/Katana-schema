// Spara/öppna fil. Chrome och Edge kan skriva till samma fil igen (File System Access API);
// Safari och Firefox laddar ned en ny fil i stället.

import { loadFileHandle, saveFileHandle } from './storage';

export const DEFAULT_FILE_NAME = 'katana-schema.json';

interface PickerWindow {
  showSaveFilePicker?: (opts: unknown) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (opts: unknown) => Promise<FileSystemFileHandle[]>;
}

type PermissionHandle = FileSystemFileHandle & {
  queryPermission?: (d: { mode: 'readwrite' | 'read' }) => Promise<PermissionState>;
  requestPermission?: (d: { mode: 'readwrite' | 'read' }) => Promise<PermissionState>;
};

const pickerTypes = [{ description: 'Schema (JSON)', accept: { 'application/json': ['.json'] } }];

function w(): PickerWindow {
  return window as unknown as PickerWindow;
}

export function supportsFileSystemAccess(): boolean {
  try {
    return typeof w().showSaveFilePicker === 'function' && window.self === window.top;
  } catch {
    return false;
  }
}

let currentHandle: FileSystemFileHandle | undefined;
let handleLoaded = false;

async function getHandle(): Promise<FileSystemFileHandle | undefined> {
  if (!handleLoaded) {
    handleLoaded = true;
    currentHandle = await loadFileHandle();
  }
  return currentHandle;
}

async function setHandle(h: FileSystemFileHandle | undefined) {
  currentHandle = h;
  handleLoaded = true;
  await saveFileHandle(h);
}

/** Filen som "Spara fil" skriver till (bara Chrome/Edge). */
export async function getCurrentFileHandle(): Promise<FileSystemFileHandle | undefined> {
  return getHandle();
}

export async function restoreFileHandle(h: FileSystemFileHandle | undefined) {
  await setHandle(h);
}

/** Webbläsaren krävde ett nytt klick innan filväljaren fick öppnas. */
export class NeedsNewClickError extends Error {}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

async function hasWritePermission(h: PermissionHandle): Promise<boolean> {
  if (!h.queryPermission) return true;
  if ((await h.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
  if (!h.requestPermission) return false;
  return (await h.requestPermission({ mode: 'readwrite' })) === 'granted';
}

async function writeHandle(h: FileSystemFileHandle, text: string) {
  const writable = await h.createWritable();
  await writable.write(new Blob([text], { type: 'application/json' }));
  await writable.close();
}

/** "katana-schema-2026-10-26-1430.json" – unikt namn så att nedladdade backuper inte förväxlas. */
export function downloadFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `katana-schema-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.json`;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Sparar texten till fil. Returnerar filnamnet, eller null om användaren avbröt.
 * @param saveAs välj en ny fil även om en tidigare finns
 */
export async function saveTextToFile(text: string, opts: { saveAs?: boolean } = {}): Promise<string | null> {
  if (!supportsFileSystemAccess()) {
    const name = downloadFileName();
    downloadBlob(new Blob([text], { type: 'application/json' }), name);
    return name;
  }
  if (!opts.saveAs) {
    const existing = (await getHandle()) as PermissionHandle | undefined;
    if (existing) {
      try {
        if (await hasWritePermission(existing)) {
          await writeHandle(existing, text);
          return existing.name;
        }
        // Behörighet nekades: glöm filen så att nästa försök får välja en ny
        await setHandle(undefined);
      } catch (err) {
        if (isAbortError(err)) return null;
        // Filen kan ha flyttats eller tagits bort – fråga efter en ny.
        console.warn('Kunde inte skriva till tidigare fil', err);
      }
    }
  }
  let handle: FileSystemFileHandle;
  try {
    handle = await w().showSaveFilePicker!({
      suggestedName: currentHandle?.name ?? DEFAULT_FILE_NAME,
      types: pickerTypes,
    });
  } catch (err) {
    if (isAbortError(err)) return null;
    if (err instanceof DOMException && err.name === 'SecurityError') throw new NeedsNewClickError();
    throw err;
  }
  await writeHandle(handle, text);
  await setHandle(handle);
  return handle.name;
}

/** Låter användaren välja en sparfil. Returnerar null om användaren avbröt. */
export async function pickFileToOpen(): Promise<{ name: string; text: string; handle?: FileSystemFileHandle } | null> {
  if (supportsFileSystemAccess() && typeof w().showOpenFilePicker === 'function') {
    try {
      const [handle] = await w().showOpenFilePicker!({ types: pickerTypes, multiple: false });
      const file = await handle.getFile();
      return { name: file.name, text: await file.text(), handle };
    } catch (err) {
      if (isAbortError(err)) return null;
      throw err;
    }
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return resolve(null);
      try {
        resolve({ name: file.name, text: await file.text() });
      } catch (err) {
        reject(err);
      }
    });
    // "cancel" kan i vissa lägen komma före "change", så den avslutar inget direkt.
    // Avbryter användaren förblir löftet bara obesvarat, vilket är ofarligt.
    input.addEventListener('cancel', () => {
      setTimeout(() => input.remove(), 60_000);
    });
    input.click();
  });
}

/** Kommer ihåg en öppnad fil så att nästa "Spara fil" skriver till den. */
export async function rememberOpenedFile(handle: FileSystemFileHandle | undefined) {
  if (handle) await setHandle(handle);
}
