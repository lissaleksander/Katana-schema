import { useEffect, useMemo, useState } from 'react';
import { parseMonthKey, type YearMonth } from './lib/dates';
import { coachMap, coachPassCounts, computeWarnings, monthContentHash } from './lib/schedule';
import { formatDateTime, monthTitle, useT } from './i18n';
import {
  confirmDialog,
  deleteActivity,
  deleteMonth,
  dismissToast,
  openDialog,
  redo,
  select,
  setAssignCoach,
  showUndoToast,
  undo,
  updateSettings,
  useStore,
} from './store/store';
import { Toolbar } from './components/Toolbar';
import { CoachList } from './components/CoachList';
import { MonthCalendar } from './components/MonthCalendar';
import { SidePanel } from './components/SidePanel';
import { ScheduleSheet } from './components/ScheduleSheet';
import { DialogHost } from './components/dialogs/DialogHost';
import { CoachChip, Segmented } from './components/common';
import { openFromFile, saveToFile } from './actions';
import { startOver } from './store/persistence';
import { applyUpdate } from './pwa';

const REMINDER_DAYS = 7;

export function App() {
  const loaded = useStore((s) => s.loaded);
  const currentMonth = useStore((s) => s.currentMonth);
  const mode = useStore((s) => s.mode);
  const exporting = useStore((s) => s.exporting);
  const uiLang = useStore((s) => s.uiLang);
  const ym = useMemo(() => (currentMonth ? parseMonthKey(currentMonth) : null), [currentMonth]);

  useGlobalKeys();
  useEffect(() => {
    document.documentElement.lang = uiLang;
  }, [uiLang]);

  if (!loaded) return <div className="loading">…</div>;

  return (
    <div className={`app mode-${mode}`}>
      <Toolbar />
      <Banners />
      {!ym ? (
        <EmptyState />
      ) : mode === 'edit' ? (
        <div className="edit-layout">
          <CoachList ym={ym} />
          <main className="month-main">
            <MonthHeader ym={ym} />
            <AssignBanner ym={ym} />
            <MonthCalendar ym={ym} lang={uiLang} variant="edit" />
          </main>
          <SidePanel ym={ym} />
        </div>
      ) : (
        <ViewMode ym={ym} />
      )}
      <StatusFooter />
      <DialogHost />
      <ToastView />
      {exporting && ym && (
        <div className="export-stage" aria-hidden="true">
          <ScheduleSheet ym={ym} id="export-sheet" />
        </div>
      )}
    </div>
  );
}

/** Fält där tangenterna (inklusive Cmd+Z) ska gå till texten och inte till schemat. */
function isTextField(el: Element | null): boolean {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') {
    return ['text', 'search', 'email', 'number', 'tel', 'url', 'password'].includes((el as HTMLInputElement).type);
  }
  return (el as HTMLElement).isContentEditable;
}

/** Delete/Backspace tar bara bort valt pass när fokus inte ligger på någon annan kontroll. */
function deleteKeyTargetsCalendar(el: Element | null): boolean {
  return !el || el === document.body || !!el.closest('.calendar-edit');
}

function useGlobalKeys() {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      if (s.dialog || document.querySelector('dialog[open]')) return;
      const typing = isTextField(document.activeElement);
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && !e.altKey && (key === 'z' || key === 'y')) {
        if (typing) return; // låt textfältet ångra sin egen text
        e.preventDefault();
        if (key === 'y' || e.shiftKey) redo();
        else undo();
        return;
      }
      if (typing || s.mode !== 'edit') return;
      if (e.key === 'Escape') {
        if (s.assignCoachId) setAssignCoach(null);
        else if (s.selectedId) select(null);
        return;
      }
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        s.selectedId &&
        !mod &&
        deleteKeyTargetsCalendar(document.activeElement)
      ) {
        e.preventDefault();
        deleteActivity(s.selectedId);
        showUndoToast(t('panel.deleted'), t('common.undo'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [t]);
}

function EmptyState() {
  const t = useT();
  return (
    <div className="empty-state">
      <h1>{t('empty.title')}</h1>
      <p>{t('empty.text')}</p>
      <div className="empty-actions">
        <button type="button" className="btn btn-primary" onClick={() => openDialog({ kind: 'newMonth' })}>
          {t('toolbar.newMonth')}
        </button>
        <button type="button" className="btn" onClick={() => void openFromFile()}>
          {t('empty.openFile')}
        </button>
      </div>
      <p className="muted small">{t('empty.restoreHint')}</p>
    </div>
  );
}

function useMonthStatus(ym: YearMonth) {
  const data = useStore((s) => s.data);
  const month = data.months.find((m) => m.year === ym.year && m.month === ym.month);
  const changedSinceExport = useMemo(
    () => !!month?.exportedHash && monthContentHash(data, ym) !== month.exportedHash,
    [data, ym, month?.exportedHash],
  );
  return { month, changedSinceExport };
}

function StatusBadge({ ym }: { ym: YearMonth }) {
  const t = useT();
  const uiLang = useStore((s) => s.uiLang);
  const { month, changedSinceExport } = useMonthStatus(ym);
  if (!month) return null;
  if (month.status !== 'published' || !month.lastExportedAt) {
    return <span className="badge">{t('status.draft')}</span>;
  }
  return (
    <>
      <span className="badge badge-published" title={formatDateTime(month.lastExportedAt, uiLang)}>
        {t('status.published', { when: formatDateTime(month.lastExportedAt, uiLang) })}
      </span>
      {changedSinceExport && <span className="badge badge-warn">{t('status.changedSinceExport')}</span>}
    </>
  );
}

function MonthHeader({ ym }: { ym: YearMonth }) {
  const t = useT();
  const uiLang = useStore((s) => s.uiLang);
  const data = useStore((s) => s.data);
  const warnings = useMemo(() => computeWarnings(data, ym), [data, ym]);
  const noCoach = [...warnings.values()].filter((w) => w.kinds.includes('noCoach')).length;
  const overlap = [...warnings.values()].filter((w) => w.kinds.includes('overlap')).length;

  const remove = async () => {
    const ok = await confirmDialog(
      t('month.confirmDelete', { month: monthTitle(ym, uiLang) }),
      t('month.delete'),
      true,
    );
    if (!ok) return;
    deleteMonth(ym);
    showUndoToast(t('month.deleted', { month: monthTitle(ym, uiLang) }), t('common.undo'));
  };

  return (
    <div className="month-header">
      <h1>{monthTitle(ym, uiLang)}</h1>
      <StatusBadge ym={ym} />
      {(noCoach > 0 || overlap > 0) && (
        <span className="badge badge-warn" data-testid="warning-summary">
          {[
            noCoach ? t('warning.summaryNoCoach', { count: noCoach }) : '',
            overlap ? t('warning.summaryOverlap', { count: overlap }) : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      )}
      <span className="spacer" />
      <button type="button" className="btn small" onClick={() => openDialog({ kind: 'replaceCoach' })}>
        {t('replace.open')}
      </button>
      <button type="button" className="btn small btn-danger-outline" onClick={() => void remove()}>
        {t('month.delete')}
      </button>
    </div>
  );
}

function AssignBanner({ ym }: { ym: YearMonth }) {
  const t = useT();
  const uiLang = useStore((s) => s.uiLang);
  const data = useStore((s) => s.data);
  const coachId = useStore((s) => s.assignCoachId);
  const coach = coachId ? coachMap(data).get(coachId) : undefined;
  if (!coach) return null;
  const count = coachPassCounts(data, ym).get(coach.id) ?? 0;
  return (
    <div className="assign-banner" role="status">
      <CoachChip coach={coach} />
      <span>{t('assign.text', { count, month: monthTitle(ym, uiLang).toLowerCase() })}</span>
      <span className="spacer" />
      <button type="button" className="btn small" onClick={() => setAssignCoach(null)}>
        {t('assign.done')}
      </button>
    </div>
  );
}

function ViewMode({ ym }: { ym: YearMonth }) {
  const t = useT();
  const exportLang = useStore((s) => s.data.settings.exportLang);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const fit = () => setZoom(Math.min(1, (window.innerWidth - 48) / 1200));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return (
    <main className="view-main">
      <div className="view-bar">
        <StatusBadge ym={ym} />
        <span className="spacer" />
        <Segmented
          label={t('view.exportLang')}
          value={exportLang}
          onChange={(v) => updateSettings({ exportLang: v })}
          options={[
            { value: 'sv', label: t('view.langSv') },
            { value: 'en', label: t('view.langEn') },
          ]}
        />
      </div>
      <div className="view-sheet-wrap" style={{ zoom }}>
        <ScheduleSheet ym={ym} />
      </div>
    </main>
  );
}

function Banners() {
  const t = useT();
  const meta = useStore((s) => s.meta);
  const storageError = useStore((s) => s.storageError);
  const otherTab = useStore((s) => s.otherTabOpen);
  const problem = useStore((s) => s.storageProblem);
  const updateAvailable = useStore((s) => s.updateAvailable);
  // Räknas om då och då, så att påminnelsen dyker upp även om appen står öppen i flera dagar
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 10 * 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  const since = meta.lastFileSaveAt ?? meta.firstUnsavedChangeAt;
  const remind =
    meta.changedSinceFileSave && !!since && now - Date.parse(since) > REMINDER_DAYS * 86_400_000;
  return (
    <>
      {updateAvailable && (
        <div className="banner banner-info" role="status">
          {t('update.available')}
          <button type="button" className="btn small" onClick={() => void applyUpdate()}>
            {t('update.reload')}
          </button>
        </div>
      )}
      {problem && (
        <div className="banner banner-error" role="alert" data-testid="storage-problem">
          {t(`storage.problem.${problem}`)}
          {problem === 'newer' || problem === 'unreadable' ? (
            <button type="button" className="btn small" onClick={() => window.location.reload()}>
              {t('update.reload')}
            </button>
          ) : (
            <>
              <button type="button" className="btn small" onClick={() => void openFromFile()}>
                {t('toolbar.openFile')}
              </button>
              <button type="button" className="btn small" onClick={() => void startOver()}>
                {t('storage.startOver')}
              </button>
            </>
          )}
        </div>
      )}
      {storageError && (
        <div className="banner banner-error" role="alert">
          {t('storage.error')}
        </div>
      )}
      {otherTab && (
        <div className="banner banner-warn" role="alert">
          {t('storage.otherTab')}
        </div>
      )}
      {remind && (
        <div className="banner banner-warn" role="status" data-testid="save-reminder">
          {meta.lastFileSaveAt ? t('status.reminder', { days: REMINDER_DAYS }) : t('status.reminderNever')}
          <button type="button" className="btn small" onClick={() => void saveToFile()}>
            {t('toolbar.saveFile')}
          </button>
        </div>
      )}
    </>
  );
}

function StatusFooter() {
  const t = useT();
  const meta = useStore((s) => s.meta);
  const uiLang = useStore((s) => s.uiLang);
  return (
    <footer className="status-footer" data-testid="status-footer">
      {meta.lastFileSaveAt
        ? t('status.lastSaved', { when: formatDateTime(meta.lastFileSaveAt, uiLang) }) +
          (meta.fileName ? ` · ${meta.fileName}` : '')
        : t('status.neverSaved')}
      {meta.changedSinceFileSave && <span className="unsaved"> · {t('status.unsaved')}</span>}
    </footer>
  );
}

function ToastView() {
  const t = useT();
  const toast = useStore((s) => s.toast);
  useEffect(() => {
    if (!toast || toast.duration === 0) return;
    const id = toast.id;
    const timer = setTimeout(() => dismissToast(id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast]);
  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'} data-testid="toast">
      <span>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          className="btn small"
          onClick={() => {
            toast.action!.run();
            dismissToast(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" className="icon-btn" aria-label={t('common.close')} onClick={() => dismissToast(toast.id)}>
        ×
      </button>
    </div>
  );
}
