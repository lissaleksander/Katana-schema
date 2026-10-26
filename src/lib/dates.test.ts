import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  countWeekdayInMonth,
  daysInMonth,
  diffDays,
  isValidISODate,
  isValidTime,
  monthWeeks,
  nthWeekdayOfMonth,
  parseTimeInput,
  weekday,
  weekdayOrdinal,
} from './dates';

describe('dates', () => {
  it('weekday: 0 = söndag', () => {
    expect(weekday('2026-10-01')).toBe(4); // torsdag
    expect(weekday('2026-11-01')).toBe(0); // söndag
    expect(weekday('2024-02-29')).toBe(4);
  });

  it('daysInMonth hanterar skottår', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2026, 10)).toBe(31);
    expect(daysInMonth(2026, 11)).toBe(30);
  });

  it('addDays och diffDays över månads-, års- och sommartidsgränser', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30'); // sommartid börjar 29 mars
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26'); // vintertid börjar 25 okt
    expect(diffDays('2026-10-24', '2026-10-26')).toBe(2);
    expect(diffDays('2026-12-30', '2027-01-02')).toBe(3);
  });

  it('addMonths över årsskifte', () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it('monthWeeks börjar på söndag och har hela veckor', () => {
    const weeks = monthWeeks({ year: 2026, month: 10 });
    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03']);
    expect(weeks[4][6]).toBe('2026-10-31');
    for (const w of weeks) expect(w).toHaveLength(7);
    // Februari 2026 börjar på söndag och har exakt 4 veckor
    expect(monthWeeks({ year: 2026, month: 2 })).toHaveLength(4);
    // Augusti 2026 börjar på lördag och behöver 6 veckor
    expect(monthWeeks({ year: 2026, month: 8 })).toHaveLength(6);
  });

  it('weekdayOrdinal och nthWeekdayOfMonth', () => {
    expect(weekdayOrdinal('2026-10-06')).toBe(1);
    expect(weekdayOrdinal('2026-10-29')).toBe(5);
    expect(nthWeekdayOfMonth({ year: 2026, month: 11 }, 2, 1)).toBe('2026-11-03');
    expect(nthWeekdayOfMonth({ year: 2026, month: 11 }, 4, 5)).toBeNull();
    expect(nthWeekdayOfMonth({ year: 2026, month: 11 }, 0, 5)).toBe('2026-11-29');
    expect(countWeekdayInMonth({ year: 2026, month: 10 }, 4)).toBe(5);
    expect(countWeekdayInMonth({ year: 2026, month: 10 }, 0)).toBe(4);
  });

  it('validering', () => {
    expect(isValidISODate('2026-02-29')).toBe(false);
    expect(isValidISODate('2024-02-29')).toBe(true);
    expect(isValidISODate('2026-1-01')).toBe(false);
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('7:00')).toBe(false);
  });

  it('parseTimeInput tolkar vanliga skrivsätt', () => {
    expect(parseTimeInput('17:00')).toBe('17:00');
    expect(parseTimeInput('17.15')).toBe('17:15');
    expect(parseTimeInput('1715')).toBe('17:15');
    expect(parseTimeInput('930')).toBe('09:30');
    expect(parseTimeInput('9')).toBe('09:00');
    expect(parseTimeInput(' 08:05 ')).toBe('08:05');
    expect(parseTimeInput('24:00')).toBeNull();
    expect(parseTimeInput('12:60')).toBeNull();
    expect(parseTimeInput('abc')).toBeNull();
    expect(parseTimeInput('')).toBeNull();
  });
});
