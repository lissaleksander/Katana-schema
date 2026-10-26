import { useMemo, useState } from 'react';
import { CATEGORIES, type Activity, type ActivityType } from '../types';
import { addDays, monthDates, type YearMonth } from '../lib/dates';
import { coachMap, computeWarnings, typeName } from '../lib/schedule';
import { formatDateShort, useT } from '../i18n';
import {
  addCoachToActivity,
  changeActivityType,
  deleteActivity,
  moveActivity,
  moveCoachInActivity,
  openDialog,
  removeCoachFromActivity,
  showUndoToast,
  updateActivity,
  updateParty,
  useStore,
} from '../store/store';
import { CoachChip, TimeField } from './common';
import { warningText } from './MonthCalendar';

export function SidePanel({ ym }: { ym: YearMonth }) {
  const t = useT();
  const selectedId = useStore((s) => s.selectedId);
  const activity = useStore((s) => s.data.activities.find((a) => a.id === s.selectedId));

  return (
    <aside className="side-panel panel" aria-label={t('panel.title')} data-testid="side-panel">
      <h2>{t('panel.title')}</h2>
      {selectedId && activity ? (
        <ActivityEditor key={activity.id} activity={activity} ym={ym} />
      ) : (
        <p className="muted hint">{t('panel.empty')}</p>
      )}
    </aside>
  );
}

function ActivityEditor({ activity: a, ym }: { activity: Activity; ym: YearMonth }) {
  const t = useT();
  const uiLang = useStore((s) => s.uiLang);
  const data = useStore((s) => s.data);
  const coaches = useMemo(() => coachMap(data), [data]);
  const type = data.activityTypes.find((x) => x.id === a.typeId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const warnings = useMemo(() => computeWarnings(data, ym).get(a.id), [data, ym, a.id]);

  const dates = monthDates(ym);
  const isCamp = type?.category === 'camp';
  const isParty = type?.category === 'party';
  const available = data.coaches
    .filter((c) => c.active && !a.coachIds.includes(c.id))
    .sort((x, y) => x.name.localeCompare(y.name, 'sv', { numeric: true }));

  const typesByCategory = CATEGORIES.map((cat) => ({
    cat,
    types: data.activityTypes.filter((x) => x.category === cat && (x.active || x.id === a.typeId)),
  })).filter((g) => g.types.length > 0);

  const remove = () => {
    deleteActivity(a.id);
    showUndoToast(t('panel.deleted'), t('common.undo'));
  };

  const defaultTimeDiffers = type && (type.start !== a.start || type.end !== a.end);

  return (
    <div className="editor">
      <div className="field">
        <label htmlFor="f-type">{t('panel.type')}</label>
        <select id="f-type" value={a.typeId} onChange={(e) => changeActivityType(a.id, e.target.value)}>
          {typesByCategory.map((g) => (
            <optgroup key={g.cat} label={t(`category.${g.cat}`)}>
              {g.types.map((x: ActivityType) => (
                <option key={x.id} value={x.id}>
                  {typeName(x, uiLang)}
                  {!x.active ? ` (${t('common.inactive')})` : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="f-title">{t('panel.customTitle')}</label>
        <input
          id="f-title"
          type="text"
          value={a.customTitle ?? ''}
          placeholder={typeName(type, uiLang)}
          onChange={(e) => updateActivity(a.id, { customTitle: e.target.value }, `title:${a.id}`)}
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="f-date">{isCamp ? t('panel.startDate') : t('panel.date')}</label>
          <input
            id="f-date"
            type="date"
            value={a.date}
            min={dates[0]}
            max={dates[dates.length - 1]}
            onChange={(e) => {
              const v = e.target.value;
              if (v && v >= dates[0] && v <= dates[dates.length - 1]) moveActivity(a.id, v, `date:${a.id}`);
            }}
          />
          <span className="field-hint">{formatDateShort(a.date, uiLang)}</span>
        </div>
        {isCamp && (
          <div className="field">
            <label htmlFor="f-enddate">{t('panel.endDate')}</label>
            <input
              id="f-enddate"
              type="date"
              value={a.endDate ?? a.date}
              min={a.date}
              max={addDays(a.date, 60)}
              onChange={(e) => {
                const v = e.target.value;
                if (v && v >= a.date && v <= addDays(a.date, 60)) updateActivity(a.id, { endDate: v }, `enddate:${a.id}`);
              }}
            />
          </div>
        )}
      </div>

      <div className="field">
        <span className="label">{t('panel.time')}</span>
        <div className="time-row">
          <TimeField label={t('panel.start')} value={a.start} onCommit={(v) => updateActivity(a.id, { start: v })} />
          <span>–</span>
          <TimeField label={t('panel.end')} value={a.end} onCommit={(v) => updateActivity(a.id, { end: v })} />
        </div>
        {defaultTimeDiffers && (
          <button
            type="button"
            className="link-btn small"
            onClick={() => updateActivity(a.id, { start: type!.start, end: type!.end })}
          >
            {t('panel.useDefaultTime', { time: `${type!.start}–${type!.end}` })}
          </button>
        )}
      </div>

      <div className="field">
        <span className="label">{t('panel.coaches')}</span>
        <ul className="panel-coaches" aria-label={t('panel.coaches')}>
          {a.coachIds.length === 0 && <li className="muted small">{t('panel.noCoaches')}</li>}
          {a.coachIds.map((id, i) => {
            const c = coaches.get(id);
            if (!c) return null;
            return (
              <li key={id}>
                <CoachChip coach={c} className={c.active ? '' : 'chip-inactive'}>
                  <button
                    type="button"
                    className="chip-x"
                    aria-label={t('panel.removeCoach', { name: c.name })}
                    onClick={() => removeCoachFromActivity(a.id, id)}
                  >
                    ×
                  </button>
                </CoachChip>
                <span className="order-btns">
                  <button
                    type="button"
                    className="icon-btn small"
                    disabled={i === 0}
                    aria-label={t('panel.moveUp', { name: c.name })}
                    onClick={() => moveCoachInActivity(a.id, id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="icon-btn small"
                    disabled={i === a.coachIds.length - 1}
                    aria-label={t('panel.moveDown', { name: c.name })}
                    onClick={() => moveCoachInActivity(a.id, id, 1)}
                  >
                    ↓
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className="link-btn"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen(!pickerOpen)}
        >
          {t('panel.addCoach')}
        </button>
        {pickerOpen && (
          <div className="coach-picker" role="group" aria-label={t('panel.addCoach')}>
            {available.length === 0 && <span className="muted small">{t('panel.allCoachesAdded')}</span>}
            {available.map((c) => (
              <button key={c.id} type="button" className="coach-btn" onClick={() => addCoachToActivity(a.id, c.id)}>
                <CoachChip coach={c} />
              </button>
            ))}
          </div>
        )}
      </div>

      {isParty && (
        <fieldset className="party-fields">
          <legend>{t('party.title')}</legend>
          <div className="field">
            <label htmlFor="f-contact">{t('party.contact')}</label>
            <input
              id="f-contact"
              type="email"
              value={a.party?.contact ?? ''}
              onChange={(e) => updateParty(a.id, { contact: e.target.value }, `contact:${a.id}`)}
            />
            <span className="field-hint">{t('party.contactHint')}</span>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="f-age">{t('party.age')}</label>
              <NumberInput id="f-age" value={a.party?.age} onChange={(v) => updateParty(a.id, { age: v }, `age:${a.id}`)} />
            </div>
            <div className="field">
              <label htmlFor="f-children">{t('party.childCount')}</label>
              <NumberInput
                id="f-children"
                value={a.party?.childCount}
                onChange={(v) => updateParty(a.id, { childCount: v }, `children:${a.id}`)}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="f-partynote">{t('party.note')}</label>
            <textarea
              id="f-partynote"
              rows={2}
              value={a.party?.note ?? ''}
              onChange={(e) => updateParty(a.id, { note: e.target.value }, `partynote:${a.id}`)}
            />
          </div>
        </fieldset>
      )}

      <div className="field">
        <label htmlFor="f-note">{t('panel.note')}</label>
        <textarea
          id="f-note"
          rows={2}
          value={a.note ?? ''}
          placeholder={t('panel.notePlaceholder')}
          onChange={(e) => updateActivity(a.id, { note: e.target.value }, `note:${a.id}`)}
        />
      </div>

      <button type="button" className="link-btn" onClick={() => openDialog({ kind: 'copyToDays', activityId: a.id })}>
        {t('panel.copyToDays')}
      </button>

      {warnings && (
        <div className="panel-warning" role="note">
          {warningText(warnings, coaches, uiLang)
            .split('\n')
            .map((line) => (
              <div key={line}>⚠ {line}</div>
            ))}
        </div>
      )}

      <div className="panel-foot">
        <button type="button" className="btn btn-danger" onClick={remove}>
          {t('panel.delete')}
        </button>
      </div>
    </div>
  );
}

function NumberInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: number | undefined;
  onChange: (v: number | null) => void;
}) {
  return (
    <input
      id={id}
      type="number"
      min={0}
      max={999}
      step={1}
      inputMode="numeric"
      value={value ?? ''}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') return onChange(null);
        const n = Math.floor(Number(raw));
        if (Number.isFinite(n) && n >= 0 && n <= 999) onChange(n);
      }}
    />
  );
}
