import { useMemo, useState } from 'react';
import { addMonths, compareYearMonth, monthKey, parseMonthKey, type YearMonth } from '../../lib/dates';
import type { CopySummary } from '../../lib/copyMonth';
import { monthName, monthTitle, useT, type TFunc } from '../../i18n';
import { closeDialog, createMonth, sortedMonths, useStore } from '../../store/store';
import { Modal } from '../common';

export function summaryText(s: CopySummary, t: TFunc): string {
  const parts = [t('newMonth.summaryCopied', { count: s.copied })];
  if (s.skippedParties) parts.push(t('newMonth.summaryParties', { count: s.skippedParties }));
  if (s.skippedCamps) parts.push(t('newMonth.summaryCamps', { count: s.skippedCamps }));
  if (s.skippedFifth) parts.push(t('newMonth.summaryFifth', { count: s.skippedFifth }));
  if (s.skippedInactiveType) parts.push(t('newMonth.summaryInactiveType', { count: s.skippedInactiveType }));
  if (s.removedInactiveCoaches) parts.push(t('newMonth.summaryInactiveCoaches', { count: s.removedInactiveCoaches }));
  return parts.join(', ');
}

export function NewMonthDialog() {
  const t = useT();
  const uiLang = useStore((s) => s.uiLang);
  const months = useStore((s) => s.data.months);
  const existing = useMemo(() => sortedMonths({ months }), [months]);
  const now = new Date();
  const thisMonth: YearMonth = { year: now.getFullYear(), month: now.getMonth() + 1 };

  const [target, setTarget] = useState<YearMonth>(() =>
    existing.length ? addMonths(existing[existing.length - 1], 1) : thisMonth,
  );
  const defaultSource = (tg: YearMonth) => {
    const before = existing.filter((m) => compareYearMonth(m, tg) < 0);
    const pick = before.length ? before[before.length - 1] : existing[existing.length - 1];
    return pick ? monthKey(pick) : '';
  };
  const [sourceKey, setSourceKey] = useState(() => defaultSource(target));
  const [mode, setMode] = useState<'copy' | 'empty'>(existing.length ? 'copy' : 'empty');
  const [withoutCoaches, setWithoutCoaches] = useState(false);
  const [summary, setSummary] = useState<CopySummary | null>(null);

  const exists = existing.some((m) => compareYearMonth(m, target) === 0);
  const years: number[] = [];
  for (let y = Math.min(thisMonth.year - 1, target.year); y <= Math.max(thisMonth.year + 3, target.year); y++) years.push(y);

  const updateTarget = (tg: YearMonth) => {
    setTarget(tg);
    setSourceKey(defaultSource(tg));
  };

  const create = () => {
    if (exists) return;
    const result = createMonth(
      target,
      mode === 'copy' && sourceKey
        ? { kind: 'copy', from: parseMonthKey(sourceKey), withoutCoaches }
        : { kind: 'empty' },
    );
    if (result) setSummary(result);
    else closeDialog();
  };

  if (summary) {
    return (
      <Modal
        title={t('newMonth.createdTitle', { month: monthTitle(target, uiLang) })}
        onClose={closeDialog}
        testId="new-month-summary"
        footer={
          <button type="button" className="btn btn-primary" onClick={closeDialog} autoFocus>
            {t('common.ok')}
          </button>
        }
      >
        <p className="summary">{summaryText(summary, t)}.</p>
      </Modal>
    );
  }

  return (
    <Modal
      title={t('newMonth.title')}
      onClose={closeDialog}
      testId="new-month-dialog"
      footer={
        <>
          <button type="button" className="btn" onClick={closeDialog}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" disabled={exists} onClick={create}>
            {t('newMonth.create')}
          </button>
        </>
      }
    >
      <div className="field-row">
        <div className="field">
          <label htmlFor="nm-month">{t('newMonth.month')}</label>
          <select
            id="nm-month"
            value={target.month}
            onChange={(e) => updateTarget({ ...target, month: Number(e.target.value) })}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {monthName({ year: target.year, month: m }, uiLang)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="nm-year">{t('newMonth.year')}</label>
          <select id="nm-year" value={target.year} onChange={(e) => updateTarget({ ...target, year: Number(e.target.value) })}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>
      {exists && (
        <p className="error" role="alert">
          {t('newMonth.exists', { month: monthTitle(target, uiLang) })}
        </p>
      )}

      <fieldset className="radio-group">
        <legend className="label">{t('newMonth.content')}</legend>
        <label className={existing.length === 0 ? 'disabled' : ''}>
          <input
            type="radio"
            name="nm-mode"
            checked={mode === 'copy'}
            disabled={existing.length === 0}
            onChange={() => setMode('copy')}
          />
          {t('newMonth.copyFrom')}
          <select
            aria-label={t('newMonth.sourceMonth')}
            value={sourceKey}
            disabled={mode !== 'copy' || existing.length === 0}
            onChange={(e) => setSourceKey(e.target.value)}
          >
            {existing.map((m) => (
              <option key={monthKey(m)} value={monthKey(m)}>
                {monthTitle(m, uiLang)}
              </option>
            ))}
          </select>
        </label>
        {mode === 'copy' && (
          <label className="indent">
            <input type="checkbox" checked={withoutCoaches} onChange={(e) => setWithoutCoaches(e.target.checked)} />
            {t('newMonth.withoutCoaches')}
          </label>
        )}
        <label>
          <input type="radio" name="nm-mode" checked={mode === 'empty'} onChange={() => setMode('empty')} />
          {t('newMonth.empty')}
        </label>
      </fieldset>
      {mode === 'copy' && <p className="muted small">{t('newMonth.copyRules')}</p>}
    </Modal>
  );
}
