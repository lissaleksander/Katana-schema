// Handlingar som rör filer och export, delade mellan verktygsrad och inställningar.

import { flushSync } from 'react-dom';
import { serializeData, parseSaveFile, SaveFileError } from './lib/saveFile';
import {
  NeedsNewClickError,
  getCurrentFileHandle,
  pickFileToOpen,
  rememberOpenedFile,
  restoreFileHandle,
  saveTextToFile,
} from './lib/fileAccess';
import { exportNodeToPng, pngFileName } from './lib/exportPng';
import { parseMonthKey } from './lib/dates';
import {
  confirmDialog,
  markExported,
  replaceAllData,
  setMeta,
  showToast,
  showUndoToast,
  useStore,
} from './store/store';
import { translate } from './i18n';

const t = (key: string, params?: Record<string, string | number>) =>
  translate(useStore.getState().uiLang, key, params);

export async function saveToFile(saveAs = false) {
  const data = useStore.getState().data;
  try {
    const name = await saveTextToFile(serializeData(data), { saveAs });
    if (!name) return;
    const stillSame = useStore.getState().data === data;
    setMeta({
      lastFileSaveAt: new Date().toISOString(),
      fileName: name,
      changedSinceFileSave: !stillSame,
      firstUnsavedChangeAt: stillSame ? undefined : new Date().toISOString(),
    });
    showToast(t('file.saved', { name }));
  } catch (err) {
    if (err instanceof NeedsNewClickError) {
      showToast(t('file.clickAgain'));
      return;
    }
    console.error(err);
    showToast(t('file.saveFailed'), { kind: 'error' });
  }
}

export async function openFromFile() {
  let picked;
  try {
    picked = await pickFileToOpen();
  } catch (err) {
    console.error(err);
    showToast(t('file.openFailed'), { kind: 'error' });
    return;
  }
  if (!picked) return;
  let data;
  try {
    data = parseSaveFile(picked.text);
  } catch (err) {
    showToast(saveFileErrorMessage(err), { kind: 'error', duration: 0 });
    return;
  }
  const ok = await confirmDialog(t('file.confirmReplace', { name: picked.name }), t('file.replaceConfirm'), true);
  if (!ok) return;
  const prevMeta = useStore.getState().meta;
  const prevHandle = await getCurrentFileHandle();
  // Ångras öppningen ska "Spara fil" åter skriva till den tidigare filen, inte till den öppnade.
  replaceAllData(data, () => {
    void restoreFileHandle(prevHandle);
    setMeta({
      fileName: prevMeta.fileName,
      lastFileSaveAt: prevMeta.lastFileSaveAt,
      changedSinceFileSave: true,
      firstUnsavedChangeAt: new Date().toISOString(),
    });
  });
  await rememberOpenedFile(picked.handle);
  // En inläst fil ersätter även data som inte gick att läsa; nu får autosparningen skriva igen
  useStore.setState({ storageProblem: null });
  setMeta({
    fileName: picked.name,
    lastFileSaveAt: new Date().toISOString(),
    changedSinceFileSave: false,
    firstUnsavedChangeAt: undefined,
  });
  showUndoToast(t('file.opened', { name: picked.name }), t('common.undo'), 10_000);
}

export function saveFileErrorMessage(err: unknown): string {
  if (!(err instanceof SaveFileError)) return t('file.openFailed');
  const { what, index } = err.params;
  if (what == null) return t(err.key, err.params);
  const label = t(`file.what.${what}`) + (index != null ? ` #${index}` : '');
  return t(err.key, { ...err.params, what: label });
}

let exportRunning = false;

export async function exportCurrentMonth() {
  const key = useStore.getState().currentMonth;
  if (!key || exportRunning) return;
  exportRunning = true;
  const ym = parseMonthKey(key);
  try {
    flushSync(() => useStore.setState({ exporting: true }));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const node = document.getElementById('export-sheet');
    if (!node) throw new Error('export-sheet saknas');
    await exportNodeToPng(node, pngFileName(ym.year, ym.month));
    markExported(ym);
    showToast(t('export.done', { name: pngFileName(ym.year, ym.month) }));
  } catch (err) {
    console.error(err);
    showToast(t('export.failed'), { kind: 'error' });
  } finally {
    useStore.setState({ exporting: false });
    exportRunning = false;
  }
}
