import { useState } from 'react';
import { SUGGESTED_COLORS, autoTextColor, normalizeHex } from '../../lib/colors';
import { useT } from '../../i18n';
import {
  addCoach,
  closeDialog,
  deleteCoach,
  isCoachUsed,
  showUndoToast,
  updateCoach,
  useStore,
} from '../../store/store';
import { CoachChip, Modal } from '../common';

type TextMode = 'auto' | 'black' | 'white' | 'custom';

export function CoachDialog({ coachId }: { coachId: string | null }) {
  const t = useT();
  const data = useStore((s) => s.data);
  const existing = coachId ? data.coaches.find((c) => c.id === coachId) : undefined;
  const usedColors = new Set(data.coaches.filter((c) => c.id !== coachId).map((c) => c.color.toUpperCase()));
  const firstFree = SUGGESTED_COLORS.find((c) => !usedColors.has(c)) ?? SUGGESTED_COLORS[0];

  const [name, setName] = useState(existing?.name ?? '');
  const [color, setColor] = useState(existing?.color ?? firstFree);
  const [hexText, setHexText] = useState(existing?.color ?? firstFree);
  const initialMode: TextMode = !existing?.textColor
    ? 'auto'
    : existing.textColor === '#000000'
      ? 'black'
      : existing.textColor === '#FFFFFF'
        ? 'white'
        : 'custom';
  const [textMode, setTextMode] = useState<TextMode>(initialMode);
  const [customText, setCustomText] = useState(existing?.textColor ?? '#000000');
  const [active, setActive] = useState(existing?.active ?? true);
  const [touched, setTouched] = useState(false);

  if (coachId && !existing) return null;

  const textColor =
    textMode === 'auto' ? undefined : textMode === 'black' ? '#000000' : textMode === 'white' ? '#FFFFFF' : customText;
  const nameError = !name.trim();
  const duplicate = data.coaches.some(
    (c) => c.id !== coachId && c.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );
  const used = coachId ? isCoachUsed(data, coachId) : false;

  const setColorValue = (v: string) => {
    const n = normalizeHex(v);
    setHexText(v);
    if (n) setColor(n);
  };

  const save = () => {
    setTouched(true);
    if (nameError) return;
    const values = { name: name.trim(), color, textColor, active };
    if (coachId) updateCoach(coachId, values);
    else addCoach(values);
    closeDialog();
  };

  const remove = () => {
    if (!coachId) return;
    const r = deleteCoach(coachId);
    closeDialog();
    showUndoToast(t(r === 'deleted' ? 'coach.deleted' : 'coach.deactivated', { name: existing!.name }), t('common.undo'));
  };

  return (
    <Modal
      title={coachId ? t('coach.editTitle') : t('coach.newTitle')}
      onClose={closeDialog}
      testId="coach-dialog"
      footer={
        <>
          {coachId && !used && (
            <button type="button" className="btn btn-danger push-left" onClick={remove}>
              {t('coach.delete')}
            </button>
          )}
          <button type="button" className="btn" onClick={closeDialog}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="field">
          <label htmlFor="coach-name">{t('coach.name')}</label>
          <input
            id="coach-name"
            type="text"
            autoFocus
            value={name}
            aria-invalid={touched && nameError}
            className={touched && nameError ? 'invalid' : ''}
            onChange={(e) => setName(e.target.value)}
          />
          {touched && nameError && <span className="error small">{t('coach.nameRequired')}</span>}
          {duplicate && !nameError && <span className="warn-text small">{t('coach.duplicate')}</span>}
        </div>

        <div className="field">
          <span className="label">{t('coach.color')}</span>
          <div className="swatches" role="radiogroup" aria-label={t('coach.color')}>
            {SUGGESTED_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={c}
                title={usedColors.has(c) ? t('coach.colorUsed') : c}
                className={`swatch ${color === c ? 'on' : ''} ${usedColors.has(c) ? 'used' : ''}`}
                style={{ background: c }}
                onClick={() => setColorValue(c)}
              />
            ))}
          </div>
          <div className="color-row">
            <input
              type="color"
              aria-label={t('coach.customColor')}
              value={color.toLowerCase()}
              onChange={(e) => setColorValue(e.target.value.toUpperCase())}
            />
            <input
              type="text"
              className={`hex-input ${normalizeHex(hexText) ? '' : 'invalid'}`}
              aria-label={t('coach.hex')}
              value={hexText}
              maxLength={7}
              onChange={(e) => setColorValue(e.target.value)}
              onBlur={() => setHexText(color)}
            />
          </div>
        </div>

        <div className="field">
          <span className="label">{t('coach.textColor')}</span>
          <div className="radio-inline">
            {(['auto', 'black', 'white', 'custom'] as TextMode[]).map((m) => (
              <label key={m}>
                <input type="radio" name="tc" checked={textMode === m} onChange={() => setTextMode(m)} />
                {m === 'auto'
                  ? t('coach.textAuto', { color: autoTextColor(color) === '#000000' ? t('coach.black') : t('coach.white') })
                  : t(`coach.${m}`)}
              </label>
            ))}
            {textMode === 'custom' && (
              <input
                type="color"
                aria-label={t('coach.custom')}
                value={customText.toLowerCase()}
                onChange={(e) => setCustomText(e.target.value.toUpperCase())}
              />
            )}
          </div>
        </div>

        <div className="field">
          <span className="label">{t('coach.preview')}</span>
          <div>
            <CoachChip coach={{ name: name.trim() || t('coach.name'), color, textColor, active }} />
          </div>
        </div>

        <label className="check">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          {t('coach.active')}
        </label>
        <p className="muted small">{used ? t('coach.usedHint') : t('coach.activeHint')}</p>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
