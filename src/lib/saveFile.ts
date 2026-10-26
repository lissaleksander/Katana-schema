import {
  CATEGORIES,
  DATA_VERSION,
  type Activity,
  type ActivityType,
  type AppData,
  type Coach,
  type Month,
  type PartyDetails,
  type Settings,
} from '../types';
import { normalizeHex } from './colors';
import { isValidISODate, isValidTime } from './dates';

/** Fel vid inläsning av sparfil. `key` är en översättningsnyckel. */
export class SaveFileError extends Error {
  constructor(
    public key: string,
    public params: Record<string, string | number> = {},
  ) {
    super(`${key} ${JSON.stringify(params)}`);
    this.name = 'SaveFileError';
  }
}

export function serializeData(data: AppData, now = new Date()): string {
  return JSON.stringify({ ...data, savedAt: now.toISOString() }, null, 2);
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function fail(what: string, index?: number): never {
  throw new SaveFileError('file.errorInvalid', index == null ? { what } : { what, index: index + 1 });
}

function str(v: unknown, what: string, i?: number, opts: { optional?: boolean; nonEmpty?: boolean } = {}): string {
  if (v == null && opts.optional) return '';
  if (typeof v !== 'string') fail(what, i);
  if (opts.nonEmpty && !v.trim()) fail(what, i);
  return v;
}

function optNonNegInt(v: unknown, what: string, i: number): number | undefined {
  if (v == null || v === '') return undefined;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 999) fail(what, i);
  return v;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function uniqueIds<T extends { id: string }>(list: T[], what: string) {
  const seen = new Set<string>();
  list.forEach((x, i) => {
    if (!x.id || seen.has(x.id)) fail(what, i);
    seen.add(x.id);
  });
}

function parseSettings(v: unknown): Settings {
  const s = isObj(v) ? v : {};
  const settings: Settings = {
    gymName: typeof s.gymName === 'string' ? s.gymName : 'Katana Parkour',
    exportLang: s.exportLang === 'en' ? 'en' : 'sv',
  };
  if (typeof s.logoDataUrl === 'string' && s.logoDataUrl.startsWith('data:image/')) {
    settings.logoDataUrl = s.logoDataUrl;
  }
  return settings;
}

function parseCoach(v: unknown, i: number): Coach {
  if (!isObj(v)) fail('coach', i);
  const color = normalizeHex(str(v.color, 'coach', i));
  if (!color) fail('coach', i);
  const coach: Coach = {
    id: str(v.id, 'coach', i, { nonEmpty: true }),
    name: str(v.name, 'coach', i),
    color,
    active: bool(v.active, true),
  };
  if (v.textColor != null && v.textColor !== '') {
    const tc = normalizeHex(str(v.textColor, 'coach', i));
    if (!tc) fail('coach', i);
    coach.textColor = tc;
  }
  return coach;
}

function parseType(v: unknown, i: number): ActivityType {
  if (!isObj(v)) fail('activityType', i);
  if (!CATEGORIES.includes(v.category as never)) fail('activityType', i);
  if (!isValidTime(v.start) || !isValidTime(v.end)) fail('activityType', i);
  return {
    id: str(v.id, 'activityType', i, { nonEmpty: true }),
    nameSv: str(v.nameSv, 'activityType', i, { nonEmpty: true }),
    nameEn: str(v.nameEn, 'activityType', i, { optional: true }),
    category: v.category as ActivityType['category'],
    start: v.start,
    end: v.end,
    active: bool(v.active, true),
  };
}

function parseMonth(v: unknown, i: number): Month {
  if (!isObj(v)) fail('month', i);
  const { year, month } = v;
  if (typeof year !== 'number' || !Number.isInteger(year) || year < 2000 || year > 2200) fail('month', i);
  if (typeof month !== 'number' || !Number.isInteger(month) || month < 1 || month > 12) fail('month', i);
  const m: Month = { year, month, status: v.status === 'published' ? 'published' : 'draft' };
  if (typeof v.lastExportedAt === 'string' && !Number.isNaN(Date.parse(v.lastExportedAt))) {
    m.lastExportedAt = v.lastExportedAt;
  }
  if (typeof v.exportedHash === 'string') m.exportedHash = v.exportedHash;
  return m;
}

function parseParty(v: unknown, i: number): PartyDetails | undefined {
  if (v == null) return undefined;
  if (!isObj(v)) fail('activity', i);
  const p: PartyDetails = { contact: str(v.contact, 'activity', i, { optional: true }) };
  const age = optNonNegInt(v.age, 'activity', i);
  if (age != null) p.age = age;
  const childCount = optNonNegInt(v.childCount, 'activity', i);
  if (childCount != null) p.childCount = childCount;
  if (typeof v.note === 'string' && v.note) p.note = v.note;
  return p;
}

function parseActivity(v: unknown, i: number, typeIds: Set<string>, coachIds: Set<string>): Activity {
  if (!isObj(v)) fail('activity', i);
  if (!isValidISODate(v.date)) fail('activity', i);
  if (!isValidTime(v.start) || !isValidTime(v.end)) fail('activity', i);
  const typeId = str(v.typeId, 'activity', i);
  if (!typeIds.has(typeId)) fail('activity', i);
  if (!Array.isArray(v.coachIds)) fail('activity', i);
  const ids: string[] = [];
  for (const c of v.coachIds) {
    if (typeof c !== 'string' || !coachIds.has(c)) fail('activity', i);
    if (!ids.includes(c)) ids.push(c);
  }
  const a: Activity = {
    id: str(v.id, 'activity', i, { nonEmpty: true }),
    date: v.date,
    start: v.start,
    end: v.end,
    typeId,
    coachIds: ids,
  };
  if (v.endDate != null && v.endDate !== '') {
    if (!isValidISODate(v.endDate) || v.endDate < v.date) fail('activity', i);
    if (v.endDate > v.date) a.endDate = v.endDate;
  }
  if (typeof v.customTitle === 'string' && v.customTitle.trim()) a.customTitle = v.customTitle;
  if (typeof v.note === 'string' && v.note.trim()) a.note = v.note;
  const party = parseParty(v.party, i);
  if (party) a.party = party;
  return a;
}

/** Läser och kontrollerar en sparfil. Kastar SaveFileError med en begriplig orsak. */
export function parseSaveFile(text: string): AppData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SaveFileError('file.errorNotJson');
  }
  if (!isObj(raw) || !Array.isArray(raw.coaches) || !Array.isArray(raw.activityTypes)) {
    throw new SaveFileError('file.errorNotSaveFile');
  }
  const version = raw.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new SaveFileError('file.errorNotSaveFile');
  }
  if (version > DATA_VERSION) throw new SaveFileError('file.errorNewerVersion', { version });

  const migrated = migrate(raw, version);

  const coaches = (migrated.coaches as unknown[]).map(parseCoach);
  uniqueIds(coaches, 'coach');
  const activityTypes = (migrated.activityTypes as unknown[]).map(parseType);
  uniqueIds(activityTypes, 'activityType');
  const monthsRaw = Array.isArray(migrated.months) ? migrated.months : [];
  const months = monthsRaw.map(parseMonth);
  const monthKeys = new Set<string>();
  months.forEach((m, i) => {
    const k = `${m.year}-${m.month}`;
    if (monthKeys.has(k)) fail('month', i);
    monthKeys.add(k);
  });
  const typeIds = new Set(activityTypes.map((t) => t.id));
  const coachIdSet = new Set(coaches.map((c) => c.id));
  const activitiesRaw = Array.isArray(migrated.activities) ? migrated.activities : [];
  const activities = activitiesRaw.map((a, i) => parseActivity(a, i, typeIds, coachIdSet));
  uniqueIds(activities, 'activity');

  return {
    version: DATA_VERSION,
    settings: parseSettings(migrated.settings),
    coaches,
    activityTypes,
    months,
    activities,
  };
}

/** Uppgraderar äldre filformat. Version 1 är den första, så än finns inget att göra. */
function migrate(raw: Obj, _version: number): Obj {
  return raw;
}
