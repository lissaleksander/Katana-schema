import { describe, expect, it } from 'vitest';
import type { Activity, AppData } from '../types';
import { createSeedData } from './seed';
import {
  activityTitle,
  buildDayIndex,
  coachPassCounts,
  computeWarnings,
  monthContentHash,
  typeMap,
} from './schedule';

const OCT = { year: 2026, month: 10 };

function data(activities: Activity[]): AppData {
  const d = createSeedData();
  d.months = [{ year: 2026, month: 10, status: 'draft' }];
  d.activities = activities;
  return d;
}

const a = (id: string, date: string, typeId: string, start: string, end: string, coachIds: string[] = ['c1'], extra: Partial<Activity> = {}): Activity => ({
  id,
  date,
  typeId,
  start,
  end,
  coachIds,
  ...extra,
});

describe('dagrutans ordning', () => {
  it('kalas överst, sedan starttid, öppet gym sist', () => {
    const d = data([
      a('open', '2026-10-13', 't21', '14:00', '22:00'), // öppet gym, tidigt men ska ligga sist
      a('late', '2026-10-13', 't12', '18:15', '19:15'),
      a('early', '2026-10-13', 't5', '11:00', '12:00'),
      a('party', '2026-10-13', 't24', '16:00', '18:00', ['c2'], { party: { contact: '', age: 8 } }),
    ]);
    const list = buildDayIndex(d, OCT).get('2026-10-13')!;
    expect(list.map((x) => x.id)).toEqual(['party', 'early', 'late', 'open']);
  });

  it('läger syns varje dag från start till slut, även in i nästa månad', () => {
    const d = data([a('camp', '2026-10-29', 't25', '08:00', '15:30', ['c1'], { endDate: '2026-11-02' })]);
    const oct = buildDayIndex(d, OCT);
    expect(oct.get('2026-10-28')).toHaveLength(0);
    expect(oct.get('2026-10-29')).toHaveLength(1);
    expect(oct.get('2026-10-31')).toHaveLength(1);
    const nov = buildDayIndex(d, { year: 2026, month: 11 });
    expect(nov.get('2026-11-02')).toHaveLength(1);
    expect(nov.get('2026-11-03')).toHaveLength(0);
    expect(coachPassCounts(d, OCT).get('c1')).toBe(3);
  });
});

describe('titlar', () => {
  const types = typeMap(createSeedData());
  it('använder typens namn på valt språk, med svenska som reserv', () => {
    const x = a('1', '2026-10-13', 't6', '17:00', '18:00');
    expect(activityTitle(x, types.get('t6'), 'sv')).toBe('7–9 år klass');
    expect(activityTitle(x, types.get('t6'), 'en')).toBe('7–9 YO Class');
    expect(activityTitle(x, { ...types.get('t6')!, nameEn: '' }, 'en')).toBe('7–9 år klass');
  });
  it('egen titel skriver över och översätts inte', () => {
    const x = a('1', '2026-10-13', 't6', '17:00', '18:00', [], { customTitle: 'Halloweenpass' });
    expect(activityTitle(x, types.get('t6'), 'en')).toBe('Halloweenpass');
  });
  it('kalas visar ålder men aldrig kontaktuppgifter', () => {
    const x = a('1', '2026-10-13', 't24', '08:30', '12:00', [], { party: { contact: 'hemlig@example.com', age: 8 } });
    expect(activityTitle(x, types.get('t24'), 'sv')).toBe('Kalas 8 år');
    expect(activityTitle(x, types.get('t24'), 'en')).toBe('Party 8 YO');
  });
});

describe('varningar (F18)', () => {
  it('pass utan coach', () => {
    const w = computeWarnings(data([a('1', '2026-10-13', 't6', '17:00', '18:00', [])]), OCT);
    expect(w.get('1')?.kinds).toEqual(['noCoach']);
  });

  it('samma coach på överlappande pass, men inte på pass som bara möts', () => {
    const w = computeWarnings(
      data([
        a('1', '2026-10-13', 't6', '17:00', '18:00', ['c1', 'c2']),
        a('2', '2026-10-13', 't12', '17:30', '18:30', ['c1']),
        a('3', '2026-10-13', 't16', '18:30', '19:30', ['c1']), // börjar när 2 slutar – ingen krock
        a('4', '2026-10-14', 't16', '17:00', '18:00', ['c1']), // annan dag
      ]),
      OCT,
    );
    expect(w.get('1')).toEqual({ kinds: ['overlap'], overlapCoachIds: ['c1'] });
    expect(w.get('2')?.kinds).toEqual(['overlap']);
    expect(w.has('3')).toBe(false);
    expect(w.has('4')).toBe(false);
  });

  it('läger krockar med pass samma dag', () => {
    const w = computeWarnings(
      data([
        a('camp', '2026-10-26', 't25', '08:00', '15:30', ['c1'], { endDate: '2026-10-30' }),
        a('lunch', '2026-10-27', 't5', '11:00', '12:00', ['c1']),
      ]),
      OCT,
    );
    expect(w.get('lunch')?.kinds).toContain('overlap');
    expect(w.get('camp')?.kinds).toContain('overlap');
  });

  it('sluttid före starttid', () => {
    const w = computeWarnings(data([a('1', '2026-10-13', 't6', '18:00', '17:00')]), OCT);
    expect(w.get('1')?.kinds).toContain('endBeforeStart');
  });
});

describe('monthContentHash', () => {
  it('ändras när något som syns i bilden ändras, men inte av kalasets e-post', () => {
    const d = data([a('1', '2026-10-10', 't24', '08:30', '12:00', ['c1'], { party: { contact: 'a@b.se', age: 8 } })]);
    const h = monthContentHash(d, OCT);
    const withEmail = structuredClone(d);
    withEmail.activities[0].party!.contact = 'other@b.se';
    expect(monthContentHash(withEmail, OCT)).toBe(h);
    const renamed = structuredClone(d);
    renamed.coaches[0].name = 'Elton';
    expect(monthContentHash(renamed, OCT)).not.toBe(h);
    const lang = structuredClone(d);
    lang.settings.exportLang = 'en';
    expect(monthContentHash(lang, OCT)).not.toBe(h);
  });
});
