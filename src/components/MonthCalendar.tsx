import { memo, useMemo, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import type { Activity, Lang } from '../types';
import { monthWeeks, parseISODate, todayISO, type YearMonth } from '../lib/dates';
import {
  activityTitle,
  buildDayIndex,
  coachMap,
  computeWarnings,
  formatTimeRange,
  typeMap,
  type ActivityWarnings,
} from '../lib/schedule';
import {
  moveActivity,
  openDialog,
  select,
  showToast,
  toggleCoachOnActivity,
  useStore,
} from '../store/store';
import { formatDateShort, translate, weekdayShort } from '../i18n';
import { CoachChip } from './common';

const DRAG_TYPE = 'application/x-katana-activity';

interface Props {
  ym: YearMonth;
  /** Språk för veckodagar och aktivitetsnamn */
  lang: Lang;
  /** edit = redigeringsläget, sheet = visningsläget och exporten */
  variant: 'edit' | 'sheet';
}

/** Kalender sön–lör. Samma komponent används för redigering, visning och export. */
export const MonthCalendar = memo(function MonthCalendar({ ym, lang, variant }: Props) {
  const data = useStore((s) => s.data);
  const selectedId = useStore((s) => (variant === 'edit' ? s.selectedId : null));
  const assignCoachId = useStore((s) => (variant === 'edit' ? s.assignCoachId : null));
  const uiLang = useStore((s) => s.uiLang);
  const edit = variant === 'edit';

  const weeks = useMemo(() => monthWeeks(ym), [ym]);
  const index = useMemo(() => buildDayIndex(data, ym), [data, ym]);
  const types = useMemo(() => typeMap(data), [data]);
  const coaches = useMemo(() => coachMap(data), [data]);
  const warnings = useMemo(() => (edit ? computeWarnings(data, ym) : new Map()), [data, ym, edit]);
  const today = edit ? todayISO() : '';

  const t = (key: string, params?: Record<string, string | number>) => translate(uiLang, key, params);

  const onActivityActivate = (a: Activity) => {
    if (assignCoachId) toggleCoachOnActivity(a.id, assignCoachId);
    select(a.id);
  };

  const onDrop = (e: DragEvent, date: string) => {
    const id = e.dataTransfer.getData(DRAG_TYPE);
    if (!id) return;
    e.preventDefault();
    moveActivity(id, date);
    select(id);
  };

  return (
    <div className={`calendar calendar-${variant}`} data-testid={edit ? 'calendar-edit' : 'calendar-sheet'}>
      <div className="cal-head">
        {[0, 1, 2, 3, 4, 5, 6].map((wd) => (
          <div key={wd} className="cal-weekday">
            {weekdayShort(wd, lang)}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="cal-week">
          {week.map((date, di) =>
            date === null ? (
              <div key={di} className="day day-out" aria-hidden="true" />
            ) : (
              <div
                key={date}
                className={`day ${date === today ? 'day-today' : ''}`}
                data-date={date}
                onClick={edit ? (e) => e.target === e.currentTarget && select(null) : undefined}
                onDragOver={
                  edit
                    ? (e) => {
                        if (e.dataTransfer.types.includes(DRAG_TYPE)) {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                        }
                      }
                    : undefined
                }
                onDrop={edit ? (e) => onDrop(e, date) : undefined}
              >
                <div className="day-head" onClick={edit ? () => select(null) : undefined}>
                  <span className="day-num">{parseISODate(date).day}</span>
                  {edit && (
                    <button
                      type="button"
                      className="day-add"
                      aria-label={t('calendar.addOn', { date: formatDateShort(date, uiLang) })}
                      title={t('calendar.add')}
                      onClick={(e) => {
                        e.stopPropagation();
                        openDialog({ kind: 'addActivity', date });
                      }}
                    >
                      +
                    </button>
                  )}
                </div>
                <div className="day-acts" onClick={edit ? (e) => e.target === e.currentTarget && select(null) : undefined}>
                  {index.get(date)!.map((a) => {
                    const type = types.get(a.typeId);
                    const w: ActivityWarnings | undefined = warnings.get(a.id);
                    const hasAssign = assignCoachId ? a.coachIds.includes(assignCoachId) : false;
                    const cls = [
                      'act',
                      `cat-${type?.category ?? 'other'}`,
                      edit && a.id === selectedId ? 'selected' : '',
                      edit && w ? 'warn' : '',
                      assignCoachId ? (hasAssign ? 'highlight' : 'dim') : '',
                    ].join(' ');
                    const title = activityTitle(a, type, lang);
                    return (
                      <div
                        key={a.id}
                        className={cls}
                        data-activity-id={a.id}
                        {...(edit
                          ? {
                              role: 'button',
                              tabIndex: 0,
                              'aria-pressed': a.id === selectedId,
                              'aria-label': `${formatTimeRange(a)} ${title}`,
                              title: w ? warningText(w, coaches, uiLang) : undefined,
                              draggable: true,
                              onDragStart: (e: DragEvent) => {
                                e.dataTransfer.setData(DRAG_TYPE, a.id);
                                e.dataTransfer.effectAllowed = 'move';
                              },
                              onClick: (e: MouseEvent) => {
                                e.stopPropagation();
                                onActivityActivate(a);
                              },
                              onKeyDown: (e: KeyboardEvent) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  onActivityActivate(a);
                                }
                              },
                            }
                          : {})}
                      >
                        {a.coachIds.length > 0 && (
                          <div className="act-coaches">
                            {a.coachIds.map((cid) => {
                              const c = coaches.get(cid);
                              return c ? (
                                <CoachChip
                                  key={cid}
                                  coach={c}
                                  className={edit && w?.overlapCoachIds.includes(cid) ? 'chip-conflict' : ''}
                                />
                              ) : null;
                            })}
                          </div>
                        )}
                        <div className="act-text">
                          <div className="act-time">{formatTimeRange(a)}</div>
                          <div className="act-title">{title}</div>
                          {a.note?.trim() && <div className="act-note">{a.note}</div>}
                          {edit && a.party?.contact && (
                            <button
                              type="button"
                              className="email-tag"
                              title={a.party.contact}
                              onClick={(e) => {
                                e.stopPropagation();
                                void copyText(a.party!.contact, uiLang);
                              }}
                            >
                              {t('party.emailTag')}
                            </button>
                          )}
                        </div>
                        {edit && w && (
                          <span className="warn-badge" aria-hidden="true">
                            !
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ),
          )}
        </div>
      ))}
    </div>
  );
});

export function warningText(w: ActivityWarnings, coaches: ReturnType<typeof coachMap>, lang: Lang): string {
  const parts: string[] = [];
  if (w.kinds.includes('noCoach')) parts.push(translate(lang, 'warning.noCoach'));
  if (w.kinds.includes('endBeforeStart')) parts.push(translate(lang, 'warning.endBeforeStart'));
  if (w.kinds.includes('overlap')) {
    const names = w.overlapCoachIds.map((id) => coaches.get(id)?.name ?? '?').join(', ');
    parts.push(translate(lang, 'warning.overlap', { names }));
  }
  return parts.join('\n');
}

async function copyText(text: string, lang: Lang) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(translate(lang, 'party.emailCopied', { email: text }));
  } catch {
    showToast(translate(lang, 'party.emailCopyFailed', { email: text }), { kind: 'error' });
  }
}
