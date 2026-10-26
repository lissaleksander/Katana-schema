import { useEffect, useRef, useState } from 'react';
import { CATEGORIES, type Category } from '../../types';
import { useT } from '../../i18n';
import {
  addActivityType,
  closeDialog,
  deleteActivityType,
  isTypeUsed,
  updateActivityType,
  useStore,
} from '../../store/store';
import { Modal, RequiredTextField, TimeField } from '../common';

export function TypesDialog() {
  const t = useT();
  const data = useStore((s) => s.data);
  const [showInactive, setShowInactive] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  // Typer som inaktiveras i dialogen ligger kvar tills den stängs, så att raden inte försvinner under musen.
  const [keepVisible, setKeepVisible] = useState<Set<string>>(() => new Set());
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focusId) return;
    const el = tableRef.current?.querySelector<HTMLInputElement>(`[data-type-id="${focusId}"] input`);
    el?.focus();
    el?.select();
    el?.scrollIntoView({ block: 'nearest' });
    setFocusId(null);
  }, [focusId]);

  const inactiveCount = data.activityTypes.filter((x) => !x.active).length;
  const list = data.activityTypes.filter((x) => x.active || showInactive || keepVisible.has(x.id));

  const add = () => {
    const id = addActivityType({
      nameSv: t('types.newName'),
      nameEn: '',
      category: 'class',
      start: '17:00',
      end: '18:00',
      active: true,
    });
    setFocusId(id);
  };

  return (
    <Modal
      title={t('types.title')}
      onClose={closeDialog}
      className="modal-wide"
      testId="types-dialog"
      footer={
        <>
          {inactiveCount > 0 && (
            <label className="check push-left">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              {t('types.showInactive', { count: inactiveCount })}
            </label>
          )}
          <button type="button" className="btn" onClick={add}>
            {t('types.new')}
          </button>
          <button type="button" className="btn btn-primary" onClick={closeDialog}>
            {t('common.done')}
          </button>
        </>
      }
    >
      <div className="types-table" ref={tableRef} role="table" aria-label={t('types.title')}>
        <div className="types-row types-header" role="row">
          <span role="columnheader">{t('types.nameSv')}</span>
          <span role="columnheader">{t('types.nameEn')}</span>
          <span role="columnheader">{t('types.category')}</span>
          <span role="columnheader">{t('types.defaultTime')}</span>
          <span role="columnheader">{t('types.active')}</span>
          <span role="columnheader" />
        </div>
        {list.map((x) => {
          const used = isTypeUsed(data, x.id);
          return (
            <div key={x.id} className={`types-row ${x.active ? '' : 'inactive'}`} role="row" data-type-id={x.id}>
              <RequiredTextField
                label={t('types.nameSv')}
                value={x.nameSv}
                onCommit={(v) => updateActivityType(x.id, { nameSv: v })}
              />
              <input
                type="text"
                aria-label={t('types.nameEn')}
                value={x.nameEn}
                placeholder={x.nameSv}
                onChange={(e) => updateActivityType(x.id, { nameEn: e.target.value }, `typeEn:${x.id}`)}
              />
              <select
                aria-label={t('types.category')}
                value={x.category}
                onChange={(e) => updateActivityType(x.id, { category: e.target.value as Category })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`category.${c}`)}
                  </option>
                ))}
              </select>
              <span className="time-row">
                <TimeField
                  label={t('panel.start')}
                  value={x.start}
                  onCommit={(v) => updateActivityType(x.id, { start: v })}
                />
                –
                <TimeField label={t('panel.end')} value={x.end} onCommit={(v) => updateActivityType(x.id, { end: v })} />
              </span>
              <input
                type="checkbox"
                aria-label={t('types.active')}
                checked={x.active}
                onChange={(e) => {
                  setKeepVisible((prev) => new Set(prev).add(x.id));
                  updateActivityType(x.id, { active: e.target.checked });
                }}
              />
              {used ? (
                <span />
              ) : (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t('types.delete', { name: x.nameSv })}
                  title={t('types.deleteHint')}
                  onClick={() => deleteActivityType(x.id)}
                >
                  🗑
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="muted small">{t('types.hint')}</p>
    </Modal>
  );
}
