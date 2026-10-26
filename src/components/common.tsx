import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Coach } from '../types';
import { borderColor, coachTextColor } from '../lib/colors';
import { parseTimeInput } from '../lib/dates';
import { useT } from '../i18n';

export function CoachChip({
  coach,
  className = '',
  children,
}: {
  coach: Pick<Coach, 'name' | 'color' | 'textColor' | 'active'>;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span
      className={`chip ${className}`}
      style={{ background: coach.color, color: coachTextColor(coach), borderColor: borderColor(coach.color) }}
    >
      <span className="chip-name">{coach.name || '—'}</span>
      {children}
    </span>
  );
}

/** Modal ovanpå appen, byggd på <dialog> så att Esc och fokus fungerar som väntat. */
export function Modal({
  title,
  onClose,
  children,
  footer,
  className = '',
  testId,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  testId?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = useT();
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => {
      if (d?.open) d.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      data-testid={testId}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button type="button" className="icon-btn" aria-label={t('common.close')} onClick={onClose}>
          ×
        </button>
      </div>
      <div className="modal-body">{children}</div>
      {footer && <div className="modal-foot">{footer}</div>}
    </dialog>
  );
}

/** Sparar ett fält som fortfarande har fokus när det försvinner (t.ex. när en dialog stängs med Esc). */
function useCommitOnUnmount(focused: { current: boolean }, commit: () => void) {
  const latest = useRef(commit);
  latest.current = commit;
  useEffect(
    () => () => {
      if (focused.current) latest.current();
    },
    [focused],
  );
}

/**
 * Tidsfält som tar emot "17:00", "17.00", "1700" osv. Ändringen sparas när fältet lämnas eller vid Enter.
 */
export function TimeField({
  value,
  onCommit,
  label,
  className = '',
}: {
  value: string;
  onCommit: (v: string) => void;
  label: string;
  className?: string;
}) {
  const [text, setText] = useState(value);
  const [invalid, setInvalid] = useState(false);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value);
  }, [value]);
  useCommitOnUnmount(focused, () => {
    const parsed = parseTimeInput(text);
    if (parsed && parsed !== value) onCommit(parsed);
  });

  const commit = () => {
    const parsed = parseTimeInput(text);
    if (!parsed) {
      setInvalid(true);
      setText(value);
      setTimeout(() => setInvalid(false), 1500);
      return;
    }
    setInvalid(false);
    setText(parsed);
    if (parsed !== value) onCommit(parsed);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      className={`time-input ${invalid ? 'invalid' : ''} ${className}`}
      aria-label={label}
      aria-invalid={invalid}
      value={text}
      maxLength={5}
      placeholder="hh:mm"
      onFocus={(e) => {
        focused.current = true;
        e.currentTarget.select();
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        focused.current = false;
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          setText(value);
        }
      }}
    />
  );
}

/**
 * Textfält som sparar först när fältet lämnas, och som inte accepterar tom text (används för namn).
 */
export function RequiredTextField({
  value,
  onCommit,
  label,
  className = '',
}: {
  value: string;
  onCommit: (v: string) => void;
  label: string;
  className?: string;
}) {
  const [text, setText] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value);
  }, [value]);
  useCommitOnUnmount(focused, () => {
    const v = text.trim();
    if (v && v !== value) onCommit(v);
  });
  const empty = !text.trim();
  return (
    <input
      type="text"
      className={`${empty ? 'invalid' : ''} ${className}`}
      aria-label={label}
      aria-invalid={empty}
      value={text}
      onFocus={() => (focused.current = true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        focused.current = false;
        const v = text.trim();
        if (!v) setText(value);
        else if (v !== value) onCommit(v);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={o.value === value ? 'active' : ''}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
