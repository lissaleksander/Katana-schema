import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import sv from './sv.json';
import en from './en.json';
import { formatDateShort, monthTabLabel, monthTitle, translate, weekdayShort } from './index';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });
}

describe('översättningar', () => {
  it('svenska och engelska har samma nycklar', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(sv).sort());
  });

  it('inga tomma texter och samma platshållare på båda språken', () => {
    for (const key of Object.keys(sv) as (keyof typeof sv)[]) {
      expect(sv[key].trim(), key).not.toBe('');
      expect(en[key].trim(), key).not.toBe('');
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
      expect(ph(en[key]), key).toBe(ph(sv[key]));
    }
  });

  it('alla nycklar som används i koden finns', () => {
    const prefixes = new Set(Object.keys(sv).map((k) => k.split('.')[0]));
    const missing: string[] = [];
    for (const file of sourceFiles(join(__dirname, '..'))) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/['"`]([a-zA-Z]+)\.([a-zA-Z_.]+)['"`]/g)) {
        if (!prefixes.has(m[1])) continue;
        const key = `${m[1]}.${m[2]}`;
        if (!(key in sv)) missing.push(`${file}: ${key}`);
      }
      // Dynamiska nycklar: `prefix.${...}` – kontrollera att prefixet finns
      for (const m of text.matchAll(/`([a-zA-Z]+(?:\.[a-zA-Z]+)*)\.\$\{/g)) {
        if (!Object.keys(sv).some((k) => k.startsWith(m[1] + '.'))) missing.push(`${file}: ${m[1]}.*`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('alla kategorier, veckodagar och filfel har texter', () => {
    for (const c of ['class', 'openGym', 'party', 'camp', 'other']) expect(sv).toHaveProperty([`category.${c}`]);
    for (let i = 0; i < 7; i++) expect(sv).toHaveProperty([`weekdayPlural.${i}`]);
    for (const w of ['coach', 'activityType', 'month', 'activity']) expect(sv).toHaveProperty([`file.what.${w}`]);
    for (const m of ['black', 'white', 'custom']) expect(sv).toHaveProperty([`coach.${m}`]);
  });

  it('singular och platshållare', () => {
    expect(translate('sv', 'newMonth.summaryCopied', { count: 1 })).toBe('1 aktivitet kopierad');
    expect(translate('sv', 'newMonth.summaryCopied', { count: 124 })).toBe('124 aktiviteter kopierade');
    expect(translate('en', 'newMonth.summaryParties', { count: 3 })).toBe('3 parties skipped');
    expect(translate('sv', 'finns.inte')).toBe('finns.inte');
  });

  it('datum och månader formateras med Intl', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => weekdayShort(d, 'sv'))).toEqual(['sön', 'mån', 'tis', 'ons', 'tors', 'fre', 'lör']);
    expect(weekdayShort(0, 'en')).toBe('Sun');
    expect(monthTabLabel({ year: 2026, month: 10 }, 'sv')).toBe('Okt 2026');
    expect(monthTabLabel({ year: 2026, month: 10 }, 'en')).toBe('Oct 2026');
    expect(monthTitle({ year: 2026, month: 10 }, 'sv')).toBe('Oktober 2026');
    expect(formatDateShort('2026-10-13', 'sv')).toBe('tis 13 okt');
    expect(formatDateShort('2026-10-13', 'en')).toBe('Tue 13 Oct');
  });
});
