// Datumhjälp. Alla datum hanteras som "YYYY-MM-DD"-strängar i lokal svensk tid utan tidszon.
// Beräkningar görs i UTC så att sommartid aldrig kan flytta ett datum.

export interface YearMonth {
  year: number;
  /** 1–12 */
  month: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseISODate(s: string): { year: number; month: number; day: number } {
  const [y, m, d] = s.split('-').map(Number);
  return { year: y, month: m, day: d };
}

export function isValidISODate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const { year, month, day } = parseISODate(s);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function isValidTime(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{2}:\d{2}$/.test(s)) return false;
  const [h, m] = s.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 0 = söndag … 6 = lördag */
export function weekday(date: string): number {
  const { year, month, day } = parseISODate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function addDays(date: string, n: number): string {
  const { year, month, day } = parseISODate(date);
  const d = new Date(Date.UTC(year, month - 1, day + n));
  return toISODate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Antal dagar från a till b (b − a) */
export function diffDays(a: string, b: string): number {
  const pa = parseISODate(a);
  const pb = parseISODate(b);
  return Math.round(
    (Date.UTC(pb.year, pb.month - 1, pb.day) - Date.UTC(pa.year, pa.month - 1, pa.day)) / 86_400_000,
  );
}

export function monthKey(ym: YearMonth): string {
  return `${ym.year}-${pad(ym.month)}`;
}

export function parseMonthKey(key: string): YearMonth {
  const [y, m] = key.split('-').map(Number);
  return { year: y, month: m };
}

export function monthOfDate(date: string): YearMonth {
  const { year, month } = parseISODate(date);
  return { year, month };
}

export function isDateInMonth(date: string, ym: YearMonth): boolean {
  const p = parseISODate(date);
  return p.year === ym.year && p.month === ym.month;
}

export function addMonths(ym: YearMonth, n: number): YearMonth {
  const idx = ym.year * 12 + (ym.month - 1) + n;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

export function monthDates(ym: YearMonth): string[] {
  const n = daysInMonth(ym.year, ym.month);
  return Array.from({ length: n }, (_, i) => toISODate(ym.year, ym.month, i + 1));
}

/**
 * Veckorna i månadsvyn, söndag–lördag. Dagar utanför månaden är null.
 */
export function monthWeeks(ym: YearMonth): (string | null)[][] {
  const dates = monthDates(ym);
  const lead = weekday(dates[0]);
  const cells: (string | null)[] = [...Array(lead).fill(null), ...dates];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Vilken förekomst av veckodagen datumet är i sin månad (1–5). */
export function weekdayOrdinal(date: string): number {
  return Math.ceil(parseISODate(date).day / 7);
}

/** Den n:te förekomsten av en veckodag i en månad, eller null om den inte finns. */
export function nthWeekdayOfMonth(ym: YearMonth, wd: number, n: number): string | null {
  const first = weekday(toISODate(ym.year, ym.month, 1));
  const day = 1 + ((wd - first + 7) % 7) + (n - 1) * 7;
  return day <= daysInMonth(ym.year, ym.month) ? toISODate(ym.year, ym.month, day) : null;
}

export function countWeekdayInMonth(ym: YearMonth, wd: number): number {
  return nthWeekdayOfMonth(ym, wd, 5) ? 5 : 4;
}

/** Dagens datum i lokal tid */
export function todayISO(now = new Date()): string {
  return toISODate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/**
 * Tolkar en inskriven tid: "17:00", "17.00", "1700", "17", "9:15" → "HH:MM". Ogiltig → null.
 */
export function parseTimeInput(input: string): string | null {
  const m = /^(\d{1,2})(?:[:.,]?(\d{2}))?$/.exec(input.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}
