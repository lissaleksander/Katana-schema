import { describe, expect, it } from 'vitest';
import { createSeedData } from './seed';
import { parseSaveFile, SaveFileError, serializeData } from './saveFile';
import type { AppData } from '../types';

function sample(): AppData {
  const d = createSeedData();
  d.settings.logoDataUrl = 'data:image/png;base64,AAAA';
  d.coaches[0].textColor = '#FFFFFF';
  d.coaches[1].active = false;
  d.months = [
    { year: 2026, month: 10, status: 'published', lastExportedAt: '2026-10-26T10:00:00.000Z', exportedHash: 'abc' },
    { year: 2026, month: 11, status: 'draft' },
  ];
  d.activities = [
    { id: 'a1', date: '2026-11-03', start: '17:00', end: '18:00', typeId: 't6', coachIds: ['c1', 'c2'], note: 'Ta med vatten' },
    { id: 'a2', date: '2026-10-26', endDate: '2026-10-30', start: '08:00', end: '15:30', typeId: 't25', coachIds: [] },
    { id: 'a3', date: '2026-10-10', start: '08:30', end: '12:00', typeId: 't24', coachIds: ['c3'], customTitle: 'Kalas Lisa', party: { contact: 'a@b.se', age: 8, childCount: 14, note: 'Vegansk mat' } },
  ];
  return d;
}

function expectError(text: string, key: string) {
  try {
    parseSaveFile(text);
  } catch (e) {
    expect(e).toBeInstanceOf(SaveFileError);
    expect((e as SaveFileError).key).toBe(key);
    return;
  }
  throw new Error('Inget fel kastades');
}

describe('sparfil', () => {
  it('sparar och läser in exakt samma data', () => {
    const d = sample();
    expect(parseSaveFile(serializeData(d))).toEqual(d);
  });

  it('läser exemplet ur designdokumentet', () => {
    const doc = {
      version: 1,
      coaches: [{ id: 'c1', name: 'Coach 1', color: '#22C55E', active: true }],
      activityTypes: [{ id: 't1', nameSv: '7–9 år klass', nameEn: '7–9 YO Class', category: 'class', start: '17:00', end: '18:00', active: true }],
      months: [{ year: 2026, month: 11, status: 'draft' }],
      activities: [{ id: 'a1', date: '2026-11-03', start: '17:00', end: '18:00', typeId: 't1', coachIds: ['c1'] }],
    };
    const d = parseSaveFile(JSON.stringify(doc));
    expect(d.settings).toEqual({ gymName: 'Katana Parkour', exportLang: 'sv' });
    expect(d.activities).toHaveLength(1);
  });

  it('avvisar sådant som inte är en sparfil', () => {
    expectError('inte json', 'file.errorNotJson');
    expectError('[]', 'file.errorNotSaveFile');
    expectError('{"hello":1}', 'file.errorNotSaveFile');
    expectError(JSON.stringify({ ...sample(), version: 2 }), 'file.errorNewerVersion');
  });

  it('avvisar trasiga referenser och värden', () => {
    const bad = (mut: (d: AppData) => void) => {
      const d = sample();
      mut(d);
      expectError(JSON.stringify(d), 'file.errorInvalid');
    };
    bad((d) => (d.activities[0].typeId = 'saknas'));
    bad((d) => (d.activities[0].coachIds = ['saknas']));
    bad((d) => (d.activities[0].date = '2026-02-30'));
    bad((d) => (d.activities[0].start = '25:00'));
    bad((d) => (d.activities[1].endDate = '2026-10-01'));
    bad((d) => (d.coaches[0].color = 'grön'));
    bad((d) => (d.coaches[1].id = d.coaches[0].id));
    bad((d) => (d.activityTypes[0].nameSv = ''));
    bad((d) => ((d.activityTypes[0] as { category: string }).category = 'okänd'));
    bad((d) => d.months.push({ year: 2026, month: 10, status: 'draft' }));
    bad((d) => (d.months[0].month = 13));
    bad((d) => (d.activities[2].party!.age = -1));
  });

  it('felet pekar ut vilken post som är fel', () => {
    const d = sample();
    d.activities[1].start = 'x';
    try {
      parseSaveFile(JSON.stringify(d));
    } catch (e) {
      expect((e as SaveFileError).params).toEqual({ what: 'activity', index: 2 });
    }
  });

  it('städar ofarliga avvikelser', () => {
    const d = sample() as unknown as { activities: Record<string, unknown>[]; coaches: Record<string, unknown>[] };
    d.activities[0].coachIds = ['c1', 'c1'];
    d.activities[0].endDate = '2026-11-03'; // samma dag som start → tas bort
    d.coaches[2].color = '#abc';
    delete d.coaches[3].active;
    const r = parseSaveFile(JSON.stringify(d));
    expect(r.activities[0].coachIds).toEqual(['c1']);
    expect(r.activities[0].endDate).toBeUndefined();
    expect(r.coaches[2].color).toBe('#AABBCC');
    expect(r.coaches[3].active).toBe(true);
  });
});
