import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeedData } from '../lib/seed';
import { parseSaveFile, serializeData } from '../lib/saveFile';
import {
  COALESCE_MS,
  HISTORY_LIMIT,
  addActivity,
  addActivityType,
  addCoach,
  addCoachToActivity,
  changeActivityType,
  copyActivityToDates,
  createMonth,
  deleteActivity,
  deleteActivityType,
  deleteCoach,
  deleteMonth,
  initialMeta,
  markExported,
  replaceAllData,
  showUndoToast,
  moveActivity,
  moveCoachInActivity,
  redo,
  removeCoachFromActivity,
  replaceCoachInPeriod,
  select,
  toggleCoachOnActivity,
  undo,
  updateActivity,
  updateActivityType,
  updateCoach,
  updateParty,
  useStore,
} from './store';
import { monthContentHash } from '../lib/schedule';

const S = () => useStore.getState();
const OCT = { year: 2026, month: 10 };
const NOV = { year: 2026, month: 11 };

/** Datan ska alltid gå att spara och läsa in igen. */
function expectValid() {
  expect(parseSaveFile(serializeData(S().data))).toEqual(S().data);
}

beforeEach(() => {
  useStore.setState({
    data: createSeedData(),
    past: [],
    future: [],
    lastCommit: null,
    meta: initialMeta,
    selectedId: null,
    assignCoachId: null,
    currentMonth: null,
    dialog: null,
    toast: null,
  });
  vi.useRealTimers();
});

describe('ångra / gör om (F14)', () => {
  it('minst 50 steg bakåt och fram igen', () => {
    createMonth(OCT, { kind: 'empty' });
    const ids: string[] = [];
    for (let i = 0; i < 60; i++) ids.push(addActivity('2026-10-13', 't6')!);
    expect(S().data.activities).toHaveLength(60);
    for (let i = 0; i < 60; i++) expect(undo()).toBe(true);
    expect(S().data.activities).toHaveLength(0);
    for (let i = 0; i < 60; i++) expect(redo()).toBe(true);
    expect(S().data.activities.map((a) => a.id)).toEqual(ids);
    expect(redo()).toBe(false);
  });

  it(`historiken begränsas till ${HISTORY_LIMIT} steg`, () => {
    createMonth(OCT, { kind: 'empty' });
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) addActivity('2026-10-13', 't6');
    expect(S().past).toHaveLength(HISTORY_LIMIT);
  });

  it('en ny ändring efter ångra rensar gör om', () => {
    createMonth(OCT, { kind: 'empty' });
    addActivity('2026-10-13', 't6');
    undo();
    expect(S().future).toHaveLength(1);
    addActivity('2026-10-14', 't6');
    expect(S().future).toHaveLength(0);
  });

  it('skrivande i samma fält blir ett steg, men inte om det går tid emellan', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T10:00:00Z'));
    createMonth(OCT, { kind: 'empty' });
    const id = addActivity('2026-10-13', 't6')!;
    const before = S().past.length;
    for (const text of ['H', 'He', 'Hej']) {
      updateActivity(id, { note: text }, `note:${id}`);
      vi.advanceTimersByTime(200);
    }
    expect(S().past.length).toBe(before + 1);
    vi.advanceTimersByTime(COALESCE_MS + 10);
    updateActivity(id, { note: 'Hej då' }, `note:${id}`);
    expect(S().past.length).toBe(before + 2);
    undo();
    expect(S().data.activities[0].note).toBe('Hej');
    undo();
    expect(S().data.activities[0].note).toBeUndefined();
  });

  it('ändringar som inte ändrar något blir inget steg', () => {
    createMonth(OCT, { kind: 'empty' });
    const id = addActivity('2026-10-13', 't6')!;
    const n = S().past.length;
    moveActivity(id, '2026-10-13');
    removeCoachFromActivity(id, 'c1');
    expect(S().past.length).toBe(n);
  });

  it('valt pass avmarkeras om det försvinner vid ångra', () => {
    createMonth(OCT, { kind: 'empty' });
    const id = addActivity('2026-10-13', 't6')!;
    expect(S().selectedId).toBe(id);
    undo();
    expect(S().selectedId).toBeNull();
  });

  it('gör om efter att månaden ångrats bort väljer månaden igen', () => {
    createMonth(OCT, { kind: 'empty' });
    undo();
    expect(S().currentMonth).toBeNull();
    redo();
    expect(S().currentMonth).toBe('2026-10');
  });

  it('ändringar markerar att filen behöver sparas', () => {
    expect(S().meta.changedSinceFileSave).toBe(false);
    createMonth(OCT, { kind: 'empty' });
    expect(S().meta.changedSinceFileSave).toBe(true);
    expect(S().meta.firstUnsavedChangeAt).toBeTruthy();
  });
});

describe('månader', () => {
  it('skapar tom månad och väljer den', () => {
    expect(createMonth(OCT, { kind: 'empty' })).toBeNull();
    expect(S().currentMonth).toBe('2026-10');
    expect(S().data.months).toEqual([{ year: 2026, month: 10, status: 'draft' }]);
  });

  it('skapar inte samma månad två gånger', () => {
    createMonth(OCT, { kind: 'empty' });
    const n = S().past.length;
    createMonth(OCT, { kind: 'empty' });
    expect(S().data.months).toHaveLength(1);
    expect(S().past.length).toBe(n);
  });

  it('kopierar föregående månad i ett ångra-steg', () => {
    createMonth(OCT, { kind: 'empty' });
    const a = addActivity('2026-10-06', 't6')!;
    addCoachToActivity(a, 'c1');
    const p = addActivity('2026-10-10', 't24')!;
    updateParty(p, { age: 8 });
    const summary = createMonth(NOV, { kind: 'copy', from: OCT, withoutCoaches: false });
    expect(summary).toMatchObject({ copied: 1, skippedParties: 1 });
    expect(S().currentMonth).toBe('2026-11');
    const nov = S().data.activities.filter((x) => x.date.startsWith('2026-11'));
    expect(nov).toHaveLength(1);
    expect(nov[0]).toMatchObject({ date: '2026-11-03', coachIds: ['c1'] });
    undo();
    expect(S().data.months).toHaveLength(1);
    expect(S().data.activities.filter((x) => x.date.startsWith('2026-11'))).toHaveLength(0);
    expect(S().currentMonth).toBe('2026-10');
    expectValid();
  });

  it('månader hålls sorterade', () => {
    createMonth(NOV, { kind: 'empty' });
    createMonth(OCT, { kind: 'empty' });
    createMonth({ year: 2027, month: 1 }, { kind: 'empty' });
    expect(S().data.months.map((m) => m.month)).toEqual([10, 11, 1]);
  });

  it('tar bort månad med dess pass, och det går att ångra', () => {
    createMonth(OCT, { kind: 'empty' });
    createMonth(NOV, { kind: 'empty' });
    addActivity('2026-10-06', 't6');
    addActivity('2026-11-03', 't6');
    deleteMonth(OCT);
    expect(S().data.months).toHaveLength(1);
    expect(S().data.activities.map((a) => a.date)).toEqual(['2026-11-03']);
    expect(S().currentMonth).toBe('2026-11');
    undo();
    expect(S().data.activities).toHaveLength(2);
  });

  it('markExported sätter status och fingeravtryck', () => {
    createMonth(OCT, { kind: 'empty' });
    addActivity('2026-10-06', 't6');
    markExported(OCT, new Date('2026-10-26T12:00:00Z'));
    const m = S().data.months[0];
    expect(m.status).toBe('published');
    expect(m.lastExportedAt).toBe('2026-10-26T12:00:00.000Z');
    expect(m.exportedHash).toBe(monthContentHash(S().data, OCT));
    expectValid();
  });
});

describe('aktiviteter', () => {
  beforeEach(() => {
    createMonth(OCT, { kind: 'empty' });
  });

  it('lägger till med typens standardtid (F5)', () => {
    const id = addActivity('2026-10-13', 't12')!;
    expect(S().data.activities[0]).toEqual({ id, date: '2026-10-13', start: '18:15', end: '19:15', typeId: 't12', coachIds: [] });
  });

  it('kalas får kalasuppgifter', () => {
    addActivity('2026-10-10', 't24');
    expect(S().data.activities[0].party).toEqual({ contact: '' });
    expectValid();
  });

  it('byter typ: slutdatum bara för läger, kalasuppgifter bara för kalas', () => {
    const id = addActivity('2026-10-26', 't25')!;
    updateActivity(id, { endDate: '2026-10-30' });
    expect(S().data.activities[0].endDate).toBe('2026-10-30');
    changeActivityType(id, 't24');
    expect(S().data.activities[0].endDate).toBeUndefined();
    expect(S().data.activities[0].party).toEqual({ contact: '' });
    changeActivityType(id, 't6');
    expect(S().data.activities[0].party).toBeUndefined();
    expectValid();
  });

  it('tomma fält tas bort och slutdatum före start ignoreras', () => {
    const id = addActivity('2026-10-26', 't25')!;
    updateActivity(id, { customTitle: 'X', note: 'Y' });
    updateActivity(id, { customTitle: '', note: '' });
    updateActivity(id, { endDate: '2026-10-20' });
    const a = S().data.activities[0];
    expect(a.customTitle).toBeUndefined();
    expect(a.note).toBeUndefined();
    expect(a.endDate).toBeUndefined();
    expectValid();
  });

  it('kalasfält', () => {
    const id = addActivity('2026-10-10', 't24')!;
    updateParty(id, { contact: 'a@b.se', age: 8, childCount: 14, note: 'Vegansk' });
    expect(S().data.activities[0].party).toEqual({ contact: 'a@b.se', age: 8, childCount: 14, note: 'Vegansk' });
    updateParty(id, { age: null, childCount: null, note: '' });
    expect(S().data.activities[0].party).toEqual({ contact: 'a@b.se' });
    expectValid();
  });

  it('flyttar läger med bibehållen längd', () => {
    const id = addActivity('2026-10-26', 't25')!;
    updateActivity(id, { endDate: '2026-10-30' });
    moveActivity(id, '2026-10-19');
    expect(S().data.activities[0]).toMatchObject({ date: '2026-10-19', endDate: '2026-10-23' });
  });

  it('coacher: lägg till, ordning, ta bort, växla (F7)', () => {
    const id = addActivity('2026-10-13', 't6')!;
    addCoachToActivity(id, 'c1');
    addCoachToActivity(id, 'c2');
    addCoachToActivity(id, 'c2');
    addCoachToActivity(id, 'c3');
    expect(S().data.activities[0].coachIds).toEqual(['c1', 'c2', 'c3']);
    moveCoachInActivity(id, 'c3', -1);
    expect(S().data.activities[0].coachIds).toEqual(['c1', 'c3', 'c2']);
    moveCoachInActivity(id, 'c1', -1); // redan först
    expect(S().data.activities[0].coachIds).toEqual(['c1', 'c3', 'c2']);
    removeCoachFromActivity(id, 'c3');
    toggleCoachOnActivity(id, 'c1');
    toggleCoachOnActivity(id, 'c4');
    expect(S().data.activities[0].coachIds).toEqual(['c2', 'c4']);
  });

  it('kopierar till fler dagar och hoppar över dagar som redan har passet (F8)', () => {
    const id = addActivity('2026-10-06', 't6')!;
    addCoachToActivity(id, 'c1');
    const r1 = copyActivityToDates(id, ['2026-10-13', '2026-10-20', '2026-10-06']);
    expect(r1).toEqual({ copied: 2, skipped: 0 });
    const r2 = copyActivityToDates(id, ['2026-10-13', '2026-10-27']);
    expect(r2).toEqual({ copied: 1, skipped: 1 });
    const dates = S().data.activities.map((a) => a.date).sort();
    expect(dates).toEqual(['2026-10-06', '2026-10-13', '2026-10-20', '2026-10-27']);
    expect(new Set(S().data.activities.map((a) => a.id)).size).toBe(4);
    expect(S().data.activities.every((a) => a.coachIds[0] === 'c1')).toBe(true);
    undo();
    expect(S().data.activities).toHaveLength(3);
  });

  it('kopierar inte kalasets uppgifter av misstag till fel typ', () => {
    const id = addActivity('2026-10-10', 't24')!;
    updateParty(id, { age: 7 });
    copyActivityToDates(id, ['2026-10-11']);
    expect(S().data.activities[1].party).toEqual({ contact: '', age: 7 });
    expectValid();
  });

  it('tar bort och ångrar (F6)', () => {
    const id = addActivity('2026-10-13', 't6')!;
    select(id);
    deleteActivity(id);
    expect(S().data.activities).toHaveLength(0);
    expect(S().selectedId).toBeNull();
    undo();
    expect(S().data.activities).toHaveLength(1);
  });

  it('byt coach i period (F16)', () => {
    const a1 = addActivity('2026-10-20', 't6')!;
    const a2 = addActivity('2026-10-27', 't6')!;
    const a3 = addActivity('2026-10-28', 't6')!;
    const camp = addActivity('2026-10-24', 't25')!;
    updateActivity(camp, { endDate: '2026-10-26' });
    for (const id of [a1, a2, a3, camp]) addCoachToActivity(id, 'c1');
    addCoachToActivity(a3, 'c2');
    const n = replaceCoachInPeriod('c1', 'c2', '2026-10-26', '2026-10-30');
    expect(n).toBe(3);
    const byId = (id: string) => S().data.activities.find((a) => a.id === id)!.coachIds;
    expect(byId(a1)).toEqual(['c1']);
    expect(byId(a2)).toEqual(['c2']);
    expect(byId(a3)).toEqual(['c2']); // fanns redan → bara den gamla tas bort
    expect(byId(camp)).toEqual(['c2']); // lägret syns 26/10
    undo();
    expect(byId(a2)).toEqual(['c1']);
  });
});

describe('coacher och typer', () => {
  it('coach som används inaktiveras i stället för att tas bort (F9)', () => {
    createMonth(OCT, { kind: 'empty' });
    const id = addActivity('2026-10-13', 't6')!;
    addCoachToActivity(id, 'c1');
    expect(deleteCoach('c1')).toBe('deactivated');
    expect(S().data.coaches.find((c) => c.id === 'c1')?.active).toBe(false);
    expect(deleteCoach('c2')).toBe('deleted');
    expect(S().data.coaches.some((c) => c.id === 'c2')).toBe(false);
    expectValid();
  });

  it('ny coach och ändrad färg', () => {
    const id = addCoach({ name: 'Elton', color: '#F97316', active: true });
    updateCoach(id, { name: 'Elton J', textColor: '#FFFFFF' });
    updateCoach(id, { textColor: undefined });
    const c = S().data.coaches.find((x) => x.id === id)!;
    expect(c).toEqual({ id, name: 'Elton J', color: '#F97316', active: true });
    expectValid();
  });

  it('inaktiverad coach avslutar snabbtilldelning', () => {
    useStore.setState({ assignCoachId: 'c1' });
    updateCoach('c1', { active: false });
    expect(S().assignCoachId).toBeNull();
  });

  it('aktivitetstyper (F10)', () => {
    createMonth(OCT, { kind: 'empty' });
    const id = addActivityType({ nameSv: 'Testklass', nameEn: '', category: 'class', start: '10:00', end: '11:00', active: true });
    const used = addActivity('2026-10-13', id)!;
    updateActivityType(id, { category: 'party' });
    expect(S().data.activities.find((a) => a.id === used)?.party).toEqual({ contact: '' });
    expect(deleteActivityType(id)).toBe('deactivated');
    const unused = addActivityType({ nameSv: 'Oanvänd', nameEn: '', category: 'other', start: '10:00', end: '11:00', active: true });
    expect(deleteActivityType(unused)).toBe('deleted');
    expectValid();
  });
});

describe('fynd från kodgranskningen', () => {
  it('"Ångra" i en toast gör inget om något annat ändrats efteråt', () => {
    createMonth(OCT, { kind: 'empty' });
    const id = addActivity('2026-10-13', 't6')!;
    deleteActivity(id);
    showUndoToast('Passet togs bort', 'Ångra');
    const action = S().toast!.action!;
    addActivity('2026-10-14', 't6');
    // Toasten försvinner när datan ändras…
    expect(S().toast).toBeNull();
    // …och skulle den ändå klickas ångras inget
    action.run();
    expect(S().data.activities.map((a) => a.date)).toEqual(['2026-10-14']);
  });

  it('"Ångra" i en toast efter Cmd+Z ångrar inte ett steg till', () => {
    createMonth(OCT, { kind: 'empty' });
    addActivity('2026-10-06', 't6');
    const id = addActivity('2026-10-13', 't6')!;
    deleteActivity(id);
    showUndoToast('Passet togs bort', 'Ångra');
    const action = S().toast!.action!;
    undo();
    action.run();
    expect(S().data.activities).toHaveLength(2);
  });

  it('export blir inget ångra-steg och publiceringen finns kvar vid ångra/gör om', () => {
    createMonth(OCT, { kind: 'empty' });
    addActivity('2026-10-13', 't6');
    addActivity('2026-10-14', 't6');
    undo();
    const past = S().past.length;
    expect(S().future).toHaveLength(1);
    markExported(OCT, new Date('2026-10-26T12:00:00Z'));
    expect(S().past.length).toBe(past);
    expect(S().future).toHaveLength(1);
    redo();
    expect(S().data.months[0].status).toBe('published');
    undo();
    undo();
    expect(S().data.months[0].status).toBe('published');
    expect(S().data.months[0].lastExportedAt).toBe('2026-10-26T12:00:00.000Z');
    expectValid();
  });

  it('ta bort månad behåller den del av ett läger som ligger i nästa månad', () => {
    createMonth(OCT, { kind: 'empty' });
    createMonth(NOV, { kind: 'empty' });
    const camp = addActivity('2026-10-29', 't25')!;
    updateActivity(camp, { endDate: '2026-11-02' });
    const single = addActivity('2026-10-31', 't25')!;
    deleteMonth(OCT);
    const left = S().data.activities;
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ id: camp, date: '2026-11-01', endDate: '2026-11-02' });
    expect(left.some((a) => a.id === single)).toBe(false);
    expectValid();
  });

  it('ångrad filöppning meddelas (så att rätt fil sparas till)', () => {
    createMonth(OCT, { kind: 'empty' });
    let undone = 0;
    const other = createSeedData();
    replaceAllData(other, () => undone++);
    expect(S().data).toBe(other);
    undo();
    expect(undone).toBe(1);
    expect(S().data.months).toHaveLength(1);
    redo();
    undo();
    expect(undone).toBe(1); // bara första gången
  });

  it('datumfältet: flera ändringar i rad blir ett ångra-steg', () => {
    createMonth(OCT, { kind: 'empty' });
    const id = addActivity('2026-10-13', 't6')!;
    moveActivity(id, '2026-10-01', `date:${id}`);
    moveActivity(id, '2026-10-15', `date:${id}`);
    undo();
    expect(S().data.activities[0].date).toBe('2026-10-13');
  });
});
