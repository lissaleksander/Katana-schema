import { useState } from 'react';
import type { Lang } from '../../types';
import { supportsFileSystemAccess } from '../../lib/fileAccess';
import { formatDateTime, useT } from '../../i18n';
import { closeDialog, setUiLang, showToast, updateSettings, useStore } from '../../store/store';
import { openFromFile, saveToFile } from '../../actions';
import { Modal } from '../common';

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const LOGO_MAX_HEIGHT = 240;

/** Läser in en bild och skalar ned den så att sparfilen inte blir onödigt stor. */
export async function readLogo(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  if (file.type === 'image/svg+xml') return dataUrl;
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  if (img.naturalHeight <= LOGO_MAX_HEIGHT) return dataUrl;
  const scale = LOGO_MAX_HEIGHT / img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = LOGO_MAX_HEIGHT;
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

export function SettingsDialog() {
  const t = useT();
  const settings = useStore((s) => s.data.settings);
  const uiLang = useStore((s) => s.uiLang);
  const meta = useStore((s) => s.meta);
  const [busy, setBusy] = useState(false);

  const onLogo = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > MAX_LOGO_BYTES) {
      showToast(t('settings.logoInvalid'), { kind: 'error' });
      return;
    }
    setBusy(true);
    try {
      updateSettings({ logoDataUrl: await readLogo(file) });
    } catch {
      showToast(t('settings.logoInvalid'), { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t('settings.title')}
      onClose={closeDialog}
      testId="settings-dialog"
      footer={
        <button type="button" className="btn btn-primary" onClick={closeDialog}>
          {t('common.done')}
        </button>
      }
    >
      <section className="settings-section">
        <h3>{t('settings.exportHeading')}</h3>
        <div className="field">
          <label htmlFor="s-gym">{t('settings.gymName')}</label>
          <input
            id="s-gym"
            type="text"
            value={settings.gymName}
            onChange={(e) => updateSettings({ gymName: e.target.value }, 'gymName')}
          />
        </div>
        <div className="field">
          <span className="label">{t('settings.logo')}</span>
          <div className="logo-row">
            {settings.logoDataUrl ? (
              <img className="logo-preview" src={settings.logoDataUrl} alt={t('settings.logo')} />
            ) : (
              <span className="muted small">{t('settings.noLogo')}</span>
            )}
            <label className="btn small file-btn">
              {settings.logoDataUrl ? t('settings.changeLogo') : t('settings.uploadLogo')}
              <input
                type="file"
                accept="image/*"
                disabled={busy}
                onChange={(e) => {
                  void onLogo(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
            {settings.logoDataUrl && (
              <button type="button" className="btn small" onClick={() => updateSettings({ logoDataUrl: undefined })}>
                {t('settings.removeLogo')}
              </button>
            )}
          </div>
        </div>
        <div className="field">
          <label htmlFor="s-exportlang">{t('settings.exportLang')}</label>
          <select
            id="s-exportlang"
            value={settings.exportLang}
            onChange={(e) => updateSettings({ exportLang: e.target.value as Lang })}
          >
            <option value="sv">Svenska</option>
            <option value="en">English</option>
          </select>
        </div>
      </section>

      <section className="settings-section">
        <h3>{t('settings.appHeading')}</h3>
        <div className="field">
          <label htmlFor="s-uilang">{t('settings.uiLang')}</label>
          <select id="s-uilang" value={uiLang} onChange={(e) => setUiLang(e.target.value as Lang)}>
            <option value="sv">Svenska</option>
            <option value="en">English</option>
          </select>
        </div>
      </section>

      <section className="settings-section">
        <h3>{t('settings.fileHeading')}</h3>
        <p className="small">
          {meta.lastFileSaveAt
            ? t('status.lastSaved', { when: formatDateTime(meta.lastFileSaveAt, uiLang) }) +
              (meta.fileName ? ` (${meta.fileName})` : '')
            : t('status.neverSaved')}
        </p>
        <div className="quick-row">
          <button type="button" className="btn small" onClick={() => void saveToFile(false)}>
            {t('toolbar.saveFile')}
          </button>
          {supportsFileSystemAccess() && (
            <button type="button" className="btn small" onClick={() => void saveToFile(true)}>
              {t('settings.saveAs')}
            </button>
          )}
          <button type="button" className="btn small" onClick={() => void openFromFile()}>
            {t('toolbar.openFile')}
          </button>
        </div>
        <p className="muted small">
          {supportsFileSystemAccess() ? t('settings.fileHintFsa') : t('settings.fileHintDownload')}
        </p>
      </section>
    </Modal>
  );
}
