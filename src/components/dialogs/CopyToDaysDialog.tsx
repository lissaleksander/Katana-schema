import { useState } from 'react';
import { monthWeeks, parseISODate, weekday, type YearMonth } from '../../lib/dates';
import { activityTitle, formatTimeRange } from '../../lib/schedule';
import { formatDateShort, useT, weekdayShort } from '../../i18n';
import { closeDialog, copyActivityToDates, showToast, useStore } from '../../store/store';
import { Modal } from '../common';

export function CopyToDaysDialog({ activityId, ym }: { activityId: string; ym: YearMonth }) {
  const t = useT();
  const uiLang = useStore((s) => s.uiLang);
  const activity = useStore((s) => s.data.activities.find((a) => a.id === activityId));
  const type = useStore((s) => s.data.activityTypes.find((x) => x.id === activity?.typeId));
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (!activity) return null;
  const weeks = monthWeeks(ym);
  const allDates = weeks.flat().filter((d): d is string => d !== null);
  const wd = weekday(activity.date);
  const sameWeekday = allDates.filter((d) => weekday(d) === wd && d !== activity.date);
  const plural = t(`weekdayPlural.${wd}`);

  const toggle = (d: string) => {
    const next = new Set(selected);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    setSelected(next);
  };

  const run = () => {
    const r = copyActivityToDates(activityId, [...selected]);
    closeDialog();
    showToast(
      r.skipped
        ? t('copyToDays.doneSkipped', { count: r.copied, skipped: r.skipped })
        : t('copyToDays.done', { count: r.copied }),
    );
  };

  return (
    <Modal
      title={t('copyToDays.title')}
      onClose={closeDialog}
      testId="copy-days-dialog"
      footer={
        <>
          <button type="button" className="btn" onClick={closeDialog}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" disabled={selected.size === 0} onClick={run}>
            {t('copyToDays.confirm', { count: selected.size })}
          </button>
        </>
      }
    >
      <p>
        <strong>
          {formatTimeRange(activity)} {activityTitle(activity, type, uiLang)}
        </strong>{' '}
        <span className="muted">({formatDateShort(activity.date, uiLang)})</span>
      </p>
      <div className="quick-row">
        <button
          type="button"
          className="btn small"
          onClick={() => setSelected(new Set(sameWeekday.filter((d) => d > activity.date)))}
        >
          {t('copyToDays.restOfMonth', { weekdays: plural })}
        </button>
        <button type="button" className="btn small" onClick={() => setSelected(new Set(sameWeekday))}>
          {t('copyToDays.allInMonth', { weekdays: plural })}
        </button>
        <button type="button" className="btn small" onClick={() => setSelected(new Set())}>
          {t('copyToDays.clear')}
        </button>
      </div>
      <div className="mini-cal" role="group" aria-label={t('copyToDays.pickDates')}>
        {[0, 1, 2, 3, 4, 5, 6].map((d) => (
          <div key={d} className="mini-wd">
            {weekdayShort(d, uiLang)}
          </div>
        ))}
        {weeks.flat().map((d, i) =>
          d === null ? (
            <div key={`x${i}`} />
          ) : (
            <button
              key={d}
              type="button"
              className={`mini-day ${selected.has(d) ? 'on' : ''} ${d === activity.date ? 'source' : ''}`}
              disabled={d === activity.date}
              aria-pressed={selected.has(d)}
              aria-label={formatDateShort(d, uiLang)}
              onClick={() => toggle(d)}
            >
              {parseISODate(d).day}
            </button>
          ),
        )}
      </div>
    </Modal>
  );
}
