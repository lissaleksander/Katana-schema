import type { YearMonth } from '../lib/dates';
import { useStore } from '../store/store';
import { monthName } from '../i18n';
import { MonthCalendar } from './MonthCalendar';

/** Det som visas i visningsläget och exporteras som bild. */
export function ScheduleSheet({ ym, id }: { ym: YearMonth; id?: string }) {
  const settings = useStore((s) => s.data.settings);
  const lang = settings.exportLang;
  const heading = `${monthName(ym, lang).toUpperCase()} ${ym.year}`;
  const gym = settings.gymName.trim();
  return (
    <div className="sheet" id={id} data-testid={id ?? 'sheet'}>
      <header className="sheet-head">
        {settings.logoDataUrl && <img className="sheet-logo" src={settings.logoDataUrl} alt="" />}
        <h1 className="sheet-title">{gym ? `${gym} – ${heading}` : heading}</h1>
      </header>
      <MonthCalendar ym={ym} lang={lang} variant="sheet" />
    </div>
  );
}
