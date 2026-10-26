import { useState } from 'react';
import { CATEGORIES } from '../../types';
import { typeName } from '../../lib/schedule';
import { formatDateShort, useT } from '../../i18n';
import { addActivity, closeDialog, useStore } from '../../store/store';
import { Modal } from '../common';

export function AddActivityDialog({ date }: { date: string }) {
  const t = useT();
  const uiLang = useStore((s) => s.uiLang);
  const types = useStore((s) => s.data.activityTypes);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const matches = types.filter(
    (x) => x.active && (!q || x.nameSv.toLowerCase().includes(q) || x.nameEn.toLowerCase().includes(q)),
  );
  const groups = CATEGORIES.map((cat) => ({ cat, list: matches.filter((x) => x.category === cat) })).filter(
    (g) => g.list.length,
  );
  const ordered = groups.flatMap((g) => g.list);

  const pick = (typeId: string) => {
    addActivity(date, typeId);
    closeDialog();
  };

  return (
    <Modal
      title={t('addActivity.title', { date: formatDateShort(date, uiLang) })}
      onClose={closeDialog}
      className="modal-narrow"
      testId="add-activity-dialog"
    >
      <input
        type="search"
        className="search"
        autoFocus
        placeholder={t('addActivity.search')}
        aria-label={t('addActivity.search')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && ordered.length) {
            e.preventDefault();
            pick(ordered[0].id);
          }
        }}
      />
      <div className="type-picker">
        {groups.length === 0 && <p className="muted">{t('addActivity.noMatch')}</p>}
        {groups.map((g) => (
          <div key={g.cat} className="type-group">
            <h3>{t(`category.${g.cat}`)}</h3>
            {g.list.map((x) => (
              <button key={x.id} type="button" className="type-option" onClick={() => pick(x.id)}>
                <span>{typeName(x, uiLang)}</span>
                <span className="muted">
                  {x.start}–{x.end}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}
