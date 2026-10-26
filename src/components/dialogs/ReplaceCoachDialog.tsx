import { useState } from 'react';
import { monthDates, todayISO, type YearMonth } from '../../lib/dates';
import { useT } from '../../i18n';
import { closeDialog, replaceCoachInPeriod, showToast, showUndoToast, useStore } from '../../store/store';
import { Modal } from '../common';

export function ReplaceCoachDialog({ ym }: { ym: YearMonth }) {
  const t = useT();
  const coaches = useStore((s) => s.data.coaches);
  const dates = monthDates(ym);
  const today = todayISO();
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'sv', { numeric: true });
  const all = [...coaches].sort(byName);
  const active = coaches.filter((c) => c.active).sort(byName);

  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [start, setStart] = useState(today >= dates[0] && today <= dates[dates.length - 1] ? today : dates[0]);
  const [end, setEnd] = useState(dates[dates.length - 1]);

  const valid = fromId && toId && fromId !== toId && start && end && start <= end;

  const run = () => {
    if (!valid) return;
    const from = coaches.find((c) => c.id === fromId)!.name;
    const to = coaches.find((c) => c.id === toId)!.name;
    const count = replaceCoachInPeriod(fromId, toId, start, end);
    closeDialog();
    if (count === 0) showToast(t('replace.none', { from }));
    else
      showUndoToast(t('replace.done', { from, to, count }), t('common.undo'));
  };

  return (
    <Modal
      title={t('replace.title')}
      onClose={closeDialog}
      testId="replace-dialog"
      footer={
        <>
          <button type="button" className="btn" onClick={closeDialog}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" disabled={!valid} onClick={run}>
            {t('replace.confirm')}
          </button>
        </>
      }
    >
      <div className="field-row">
        <div className="field">
          <label htmlFor="r-from">{t('replace.from')}</label>
          <select id="r-from" value={fromId} onChange={(e) => setFromId(e.target.value)}>
            <option value="">{t('replace.choose')}</option>
            {all.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.active ? '' : ` (${t('common.inactive')})`}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="r-to">{t('replace.to')}</label>
          <select id="r-to" value={toId} onChange={(e) => setToId(e.target.value)}>
            <option value="">{t('replace.choose')}</option>
            {active
              .filter((c) => c.id !== fromId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="r-start">{t('replace.start')}</label>
          <input id="r-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="r-end">{t('replace.end')}</label>
          <input id="r-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      {start && end && start > end && <p className="error small">{t('replace.badRange')}</p>}
      <p className="muted small">{t('replace.hint')}</p>
    </Modal>
  );
}
