import type { Activity, AppData } from '../types';
import { countWeekdayInMonth, nthWeekdayOfMonth, weekday, weekdayOrdinal, type YearMonth } from './dates';
import { newId } from './id';
import { belongsToMonth, coachMap, typeMap } from './schedule';

export interface CopySummary {
  copied: number;
  skippedParties: number;
  skippedCamps: number;
  /** Femte veckodagen finns inte i målmånaden */
  skippedFifth: number;
  /** Aktivitetstypen är inaktiv */
  skippedInactiveType: number;
  /** Tilldelningar av inaktiva coacher som inte följde med */
  removedInactiveCoaches: number;
}

export interface CopyResult {
  activities: Activity[];
  summary: CopySummary;
}

/**
 * Kopierar en månads aktiviteter till en annan enligt reglerna i designdokumentet (F3):
 * 1. Samma veckodag och samma ordningsvecka (första tisdagen → första tisdagen).
 * 2. Femte veckodagen som saknas i målet hoppas över; finns en femte i målet men inte i källan
 *    kopieras fjärde veckans aktiviteter dit.
 * 3. Kalas och läger kopieras inte.
 * 4. Coacher följer med om inte withoutCoaches anges.
 */
export function copyMonth(
  data: AppData,
  source: YearMonth,
  target: YearMonth,
  opts: { withoutCoaches: boolean },
  makeId: () => string = () => newId('a'),
): CopyResult {
  const types = typeMap(data);
  const coaches = coachMap(data);
  const summary: CopySummary = {
    copied: 0,
    skippedParties: 0,
    skippedCamps: 0,
    skippedFifth: 0,
    skippedInactiveType: 0,
    removedInactiveCoaches: 0,
  };
  const out: Activity[] = [];

  const sourceActivities = data.activities
    .filter((a) => belongsToMonth(a, source))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.start.localeCompare(b.start)));

  for (const a of sourceActivities) {
    const type = types.get(a.typeId);
    if (type?.category === 'party') {
      summary.skippedParties++;
      continue;
    }
    if (type?.category === 'camp') {
      summary.skippedCamps++;
      continue;
    }
    if (!type || !type.active) {
      summary.skippedInactiveType++;
      continue;
    }

    const wd = weekday(a.date);
    const n = weekdayOrdinal(a.date);
    const targets: string[] = [];
    const main = nthWeekdayOfMonth(target, wd, n);
    if (main) targets.push(main);
    else summary.skippedFifth++;
    if (n === 4 && countWeekdayInMonth(target, wd) === 5 && countWeekdayInMonth(source, wd) === 4) {
      targets.push(nthWeekdayOfMonth(target, wd, 5)!);
    }

    const coachIds = opts.withoutCoaches ? [] : a.coachIds.filter((id) => coaches.get(id)?.active);
    const removed = opts.withoutCoaches ? 0 : a.coachIds.length - coachIds.length;

    for (const date of targets) {
      summary.removedInactiveCoaches += removed;
      const copy: Activity = { id: makeId(), date, start: a.start, end: a.end, typeId: a.typeId, coachIds: [...coachIds] };
      if (a.customTitle) copy.customTitle = a.customTitle;
      if (a.note) copy.note = a.note;
      out.push(copy);
      summary.copied++;
    }
  }
  return { activities: out, summary };
}
