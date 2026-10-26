import { useMemo } from 'react';
import type { YearMonth } from '../lib/dates';
import { coachPassCounts } from '../lib/schedule';
import { useT } from '../i18n';
import {
  addCoachToActivity,
  openDialog,
  setAssignCoach,
  useStore,
} from '../store/store';
import { CoachChip } from './common';

export function CoachList({ ym }: { ym: YearMonth }) {
  const t = useT();
  const data = useStore((s) => s.data);
  const assignCoachId = useStore((s) => s.assignCoachId);
  const hasSelection = useStore((s) => s.selectedId !== null);
  const showInactive = useStore((s) => s.showInactiveCoaches);
  const counts = useMemo(() => coachPassCounts(data, ym), [data, ym]);

  const byName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, 'sv', { numeric: true, sensitivity: 'base' });
  const active = data.coaches.filter((c) => c.active).sort(byName);
  const inactive = data.coaches.filter((c) => !c.active).sort(byName);

  // Klick på en coach: i snabbtilldelning byts coachen; med ett valt pass läggs coachen till på det
  // (arbetsflöde 2); annars startar snabbtilldelning (arbetsflöde 3).
  const onCoachClick = (id: string) => {
    const s = useStore.getState();
    if (s.assignCoachId) setAssignCoach(s.assignCoachId === id ? null : id);
    else if (s.selectedId) addCoachToActivity(s.selectedId, id);
    else setAssignCoach(id);
  };
  const clickHint = assignCoachId
    ? t('coaches.hintAssigning')
    : hasSelection
      ? t('coaches.hintSelected')
      : t('coaches.hintNone');

  return (
    <aside className="coach-list panel" aria-label={t('coaches.title')}>
      <h2>{t('coaches.title')}</h2>
      <p className="coach-hint muted small" data-testid="coach-hint">
        {clickHint}
      </p>
      <ul>
        {active.map((c) => (
          <li key={c.id} className={assignCoachId === c.id ? 'assigning' : ''}>
            <button
              type="button"
              className="coach-btn"
              aria-pressed={assignCoachId === c.id}
              onClick={() => onCoachClick(c.id)}
            >
              <CoachChip coach={c} />
            </button>
            <span className="coach-count" title={t('coaches.countTitle')}>
              {counts.get(c.id) ?? 0}
            </span>
            <button
              type="button"
              className="icon-btn edit-btn"
              aria-label={t('coaches.editNamed', { name: c.name })}
              onClick={() => openDialog({ kind: 'coach', coachId: c.id })}
            >
              ✎
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="link-btn" onClick={() => openDialog({ kind: 'coach', coachId: null })}>
        {t('coaches.new')}
      </button>
      {inactive.length > 0 && (
        <>
          <button
            type="button"
            className="link-btn muted"
            aria-expanded={showInactive}
            onClick={() => useStore.setState({ showInactiveCoaches: !showInactive })}
          >
            {showInactive ? t('coaches.hideInactive') : t('coaches.showInactive', { count: inactive.length })}
          </button>
          {showInactive && (
            <ul className="inactive-list">
              {inactive.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="coach-btn"
                    aria-label={t('coaches.editNamed', { name: c.name })}
                    onClick={() => openDialog({ kind: 'coach', coachId: c.id })}
                  >
                    <CoachChip coach={c} className="chip-inactive" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <div className="coach-list-foot">
        <button type="button" className="link-btn" onClick={() => openDialog({ kind: 'types' })}>
          {t('types.title')}
        </button>
        <button type="button" className="link-btn" onClick={() => openDialog({ kind: 'settings' })}>
          {t('settings.title')}
        </button>
      </div>
    </aside>
  );
}
