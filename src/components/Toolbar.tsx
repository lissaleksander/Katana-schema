import { useMemo } from 'react';
import { monthKey } from '../lib/dates';
import { monthTabLabel, useT } from '../i18n';
import { openDialog, setCurrentMonth, setMode, setUiLang, sortedMonths, useStore } from '../store/store';
import { exportCurrentMonth, openFromFile, saveToFile } from '../actions';
import { Segmented } from './common';

export function Toolbar() {
  const t = useT();
  const months = useStore((s) => s.data.months);
  const current = useStore((s) => s.currentMonth);
  const mode = useStore((s) => s.mode);
  const uiLang = useStore((s) => s.uiLang);
  const exporting = useStore((s) => s.exporting);
  const sorted = useMemo(() => sortedMonths({ months }), [months]);

  return (
    <nav className="toolbar" aria-label={t('toolbar.label')}>
      <div className="tabs" role="tablist" aria-label={t('toolbar.months')}>
        {sorted.map((ym) => {
          const key = monthKey(ym);
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={key === current}
              className={`btn tab ${key === current ? 'active' : ''}`}
              onClick={() => setCurrentMonth(key)}
            >
              {monthTabLabel(ym, uiLang)}
            </button>
          );
        })}
        <button type="button" className="btn" onClick={() => openDialog({ kind: 'newMonth' })}>
          {t('toolbar.newMonth')}
        </button>
      </div>
      <div className="toolbar-right">
        <Segmented
          label={t('toolbar.mode')}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'edit', label: t('toolbar.edit') },
            { value: 'view', label: t('toolbar.view') },
          ]}
        />
        <Segmented
          label={t('toolbar.uiLang')}
          value={uiLang}
          onChange={setUiLang}
          options={[
            { value: 'sv', label: 'SV' },
            { value: 'en', label: 'EN' },
          ]}
        />
        <button type="button" className="btn" onClick={() => void saveToFile()}>
          {t('toolbar.saveFile')}
        </button>
        <button type="button" className="btn" onClick={() => void openFromFile()}>
          {t('toolbar.openFile')}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!current || exporting}
          onClick={() => void exportCurrentMonth()}
        >
          {exporting ? t('toolbar.exporting') : t('toolbar.exportPng')}
        </button>
      </div>
    </nav>
  );
}
