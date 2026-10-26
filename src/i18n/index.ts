import { useCallback } from 'react';
import type { Lang } from '../types';
import { useStore } from '../store/store';
import { parseISODate, weekday, type YearMonth } from '../lib/dates';
import sv from './sv.json';
import en from './en.json';

export type Dict = Record<string, string>;
export const dictionaries: Record<Lang, Dict> = { sv, en };

export type Params = Record<string, string | number>;
export type TFunc = (key: string, params?: Params) => string;

export function translate(lang: Lang, key: string, params?: Params): string {
  const lookup = (k: string) => dictionaries[lang][k] ?? dictionaries.sv[k];
  // Singular: "nyckel_one" används när count är 1
  const template = (params?.count === 1 ? lookup(`${key}_one`) : undefined) ?? lookup(key) ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

export function makeT(lang: Lang): TFunc {
  return (key, params) => translate(lang, key, params);
}

/** Översättning för gränssnittets språk. */
export function useT(): TFunc {
  const lang = useStore((s) => s.uiLang);
  return useCallback((key: string, params?: Params) => translate(lang, key, params), [lang]);
}

const locale = (lang: Lang) => (lang === 'sv' ? 'sv-SE' : 'en-GB');
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12));

function stripDot(s: string): string {
  return s.replace(/\.$/, '');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function monthName(ym: YearMonth, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), { month: 'long', timeZone: 'UTC' }).format(utc(ym.year, ym.month, 1));
}

/** "Okt 2026" / "Oct 2026" */
export function monthTabLabel(ym: YearMonth, lang: Lang): string {
  const short = new Intl.DateTimeFormat(locale(lang), { month: 'short', timeZone: 'UTC' }).format(
    utc(ym.year, ym.month, 1),
  );
  return `${capitalize(stripDot(short))} ${ym.year}`;
}

/** "Oktober 2026" */
export function monthTitle(ym: YearMonth, lang: Lang): string {
  return `${capitalize(monthName(ym, lang))} ${ym.year}`;
}

/** Kort veckodagsnamn, 0 = söndag. "sön", "mån" … / "Sun", "Mon" … */
export function weekdayShort(wd: number, lang: Lang): string {
  // 2026-02-01 är en söndag
  return stripDot(new Intl.DateTimeFormat(locale(lang), { weekday: 'short', timeZone: 'UTC' }).format(utc(2026, 2, 1 + wd)));
}

/** "tis 13 okt" / "Tue 13 Oct" */
export function formatDateShort(date: string, lang: Lang): string {
  const { year, month, day } = parseISODate(date);
  const mon = stripDot(
    new Intl.DateTimeFormat(locale(lang), { month: 'short', timeZone: 'UTC' }).format(utc(year, month, day)),
  );
  return `${weekdayShort(weekday(date), lang)} ${day} ${mon}`;
}

/** "26 okt 2026 14:05" */
export function formatDateTime(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale(lang), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
