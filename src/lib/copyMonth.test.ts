import { describe, expect, it } from 'vitest';
import type { Activity, AppData } from '../types';
import { createSeedData } from './seed';
import { copyMonth } from './copyMonth';

const OCT = { year: 2026, month: 10 };
const NOV = { year: 2026, month: 11 };

let seq = 0;
function act(date: string, typeId: string, coachIds: string[] = ['c1'], extra: Partial<Activity> = {}): Activity {
  return { id: `x${++seq}`, date, start: '17:00', end: '18:00', typeId, coachIds, ...extra };
}

function dataWith(activities: Activity[]): AppData {
  const d = createSeedData();
  d.months = [{ year: 2026, month: 10, status: 'draft' }];
  d.activities = activities;
  return d;
}

let idn = 0;
const ids = () => `new${++idn}`;

describe('copyMonth (F3)', () => {
  it('flyttar till samma veckodag och ordningsvecka', () => {
    // Första tisdagen i oktober (6/10) → första tisdagen i november (3/11)
    const r = copyMonth(dataWith([act('2026-10-06', 't6'), act('2026-10-27', 't6')]), OCT, NOV, { withoutCoaches: false }, ids);
    expect(r.activities.map((a) => a.date)).toEqual(['2026-11-03', '2026-11-24']);
    expect(r.summary.copied).toBe(2);
  });

  it('hoppar över femte veckodagen som saknas i målmånaden', () => {
    // 29/10 är femte torsdagen; november har bara fyra torsdagar
    const r = copyMonth(dataWith([act('2026-10-29', 't10')]), OCT, NOV, { withoutCoaches: false }, ids);
    expect(r.activities).toHaveLength(0);
    expect(r.summary.skippedFifth).toBe(1);
  });

  it('kopierar fjärde veckans pass till en femte veckodag som bara finns i målmånaden', () => {
    // Oktober har fyra söndagar (25/10 är fjärde); november har fem (22/11 och 29/11)
    const r = copyMonth(dataWith([act('2026-10-25', 't2')]), OCT, NOV, { withoutCoaches: false }, ids);
    expect(r.activities.map((a) => a.date)).toEqual(['2026-11-22', '2026-11-29']);
    expect(r.summary.copied).toBe(2);
  });

  it('kopierar inte kalas och läger', () => {
    const r = copyMonth(
      dataWith([
        act('2026-10-10', 't24', ['c1'], { party: { contact: 'a@b.se', age: 8 } }),
        act('2026-10-11', 't24'),
        act('2026-10-26', 't25', ['c2'], { endDate: '2026-10-30' }),
        act('2026-10-06', 't6'),
      ]),
      OCT,
      NOV,
      { withoutCoaches: false },
      ids,
    );
    expect(r.summary).toMatchObject({ copied: 1, skippedParties: 2, skippedCamps: 1 });
    expect(r.activities[0].party).toBeUndefined();
  });

  it('coacher följer med i samma ordning, eller inte alls med "utan coacher"', () => {
    const src = dataWith([act('2026-10-06', 't6', ['c3', 'c1', 'c2'])]);
    expect(copyMonth(src, OCT, NOV, { withoutCoaches: false }, ids).activities[0].coachIds).toEqual(['c3', 'c1', 'c2']);
    expect(copyMonth(src, OCT, NOV, { withoutCoaches: true }, ids).activities[0].coachIds).toEqual([]);
  });

  it('behåller tid, egen titel och anteckning men får nytt id', () => {
    const a = act('2026-10-06', 't6', ['c1'], { start: '18:15', end: '19:15', customTitle: 'Halloweenpass', note: 'Utklädnad' });
    const r = copyMonth(dataWith([a]), OCT, NOV, { withoutCoaches: false }, ids);
    expect(r.activities[0]).toMatchObject({ start: '18:15', end: '19:15', customTitle: 'Halloweenpass', note: 'Utklädnad', typeId: 't6' });
    expect(r.activities[0].id).not.toBe(a.id);
  });

  it('inaktiva coacher och typer följer inte med', () => {
    const d = dataWith([act('2026-10-06', 't6', ['c1', 'c2']), act('2026-10-07', 't7')]);
    d.coaches.find((c) => c.id === 'c2')!.active = false;
    d.activityTypes.find((t) => t.id === 't7')!.active = false;
    const r = copyMonth(d, OCT, NOV, { withoutCoaches: false }, ids);
    expect(r.activities).toHaveLength(1);
    expect(r.activities[0].coachIds).toEqual(['c1']);
    expect(r.summary).toMatchObject({ copied: 1, skippedInactiveType: 1, removedInactiveCoaches: 1 });
  });

  it('kopierar bara pass som börjar i källmånaden', () => {
    const r = copyMonth(dataWith([act('2026-09-29', 't6'), act('2026-11-03', 't6'), act('2026-10-06', 't6')]), OCT, NOV, { withoutCoaches: false }, ids);
    expect(r.activities).toHaveLength(1);
  });

  it('en hel månad: varje veckodag och vecka hamnar rätt', () => {
    // Ett pass varje dag i oktober
    const all: Activity[] = [];
    for (let d = 1; d <= 31; d++) all.push(act(`2026-10-${String(d).padStart(2, '0')}`, 't6'));
    const r = copyMonth(dataWith(all), OCT, NOV, { withoutCoaches: false }, ids);
    // Oktober har femte tors/fre/lör (3 dagar som saknas i november);
    // november har femte sön/mån som fylls från fjärde veckan (2 extra).
    expect(r.summary.skippedFifth).toBe(3);
    expect(r.summary.copied).toBe(31 - 3 + 2);
    const dates = r.activities.map((a) => a.date).sort();
    expect(new Set(dates).size).toBe(30); // varje dag i november exakt en gång
    expect(dates[0]).toBe('2026-11-01');
    expect(dates[29]).toBe('2026-11-30');
  });
});
