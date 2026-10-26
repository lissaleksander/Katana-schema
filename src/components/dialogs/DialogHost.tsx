import { parseMonthKey } from '../../lib/dates';
import { useT } from '../../i18n';
import { useStore } from '../../store/store';
import { Modal } from '../common';
import { AddActivityDialog } from './AddActivityDialog';
import { CoachDialog } from './CoachDialog';
import { CopyToDaysDialog } from './CopyToDaysDialog';
import { NewMonthDialog } from './NewMonthDialog';
import { ReplaceCoachDialog } from './ReplaceCoachDialog';
import { SettingsDialog } from './SettingsDialog';
import { TypesDialog } from './TypesDialog';

export function DialogHost() {
  const t = useT();
  const dialog = useStore((s) => s.dialog);
  const currentMonth = useStore((s) => s.currentMonth);
  if (!dialog) return null;
  const ym = currentMonth ? parseMonthKey(currentMonth) : null;

  switch (dialog.kind) {
    case 'newMonth':
      return <NewMonthDialog />;
    case 'addActivity':
      return <AddActivityDialog date={dialog.date} />;
    case 'copyToDays':
      return ym && <CopyToDaysDialog activityId={dialog.activityId} ym={ym} />;
    case 'coach':
      return <CoachDialog coachId={dialog.coachId} />;
    case 'types':
      return <TypesDialog />;
    case 'settings':
      return <SettingsDialog />;
    case 'replaceCoach':
      return ym && <ReplaceCoachDialog ym={ym} />;
    case 'confirm':
      return (
        <Modal
          title={t('common.confirmTitle')}
          onClose={() => dialog.resolve(false)}
          className="modal-narrow"
          testId="confirm-dialog"
          footer={
            <>
              <button type="button" className="btn" onClick={() => dialog.resolve(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                autoFocus
                className={`btn ${dialog.danger ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => dialog.resolve(true)}
              >
                {dialog.confirmLabel}
              </button>
            </>
          }
        >
          <p>{dialog.message}</p>
        </Modal>
      );
  }
}
