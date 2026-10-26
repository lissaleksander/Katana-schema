import type { ActivityType, AppData, Category, Coach } from '../types';

// Startdata enligt designdokumentet: 15 platshållarcoacher och 25 aktivitetstyper.

const COACH_COLORS = [
  '#22C55E', '#EF4444', '#FACC15', '#14B8A6', '#1E3A8A',
  '#F97316', '#A855F7', '#EC4899', '#38BDF8', '#84CC16',
  '#B45309', '#6B7280', '#F9A8D4', '#2563EB', '#000000',
];

const TYPES: [string, string, Category, string, string][] = [
  ['Familjeklass', 'Family Class', 'class', '15:45', '16:45'],
  ['Familjeparkour', 'Family Parkour Class', 'class', '11:00', '12:00'],
  ['Familjeklass helg', 'Family class', 'class', '12:15', '13:15'],
  ['Babyparkour', 'Baby Parkour', 'class', '13:00', '14:00'],
  ['Lunchparkour', 'Lunch parkour', 'class', '11:00', '12:00'],
  ['7–9 år klass', '7–9 YO Class', 'class', '17:00', '18:00'],
  ['7–9 år parkour', '7–9 YO Parkour', 'class', '15:45', '16:45'],
  ['7–9 år autism parkour', '7–9 YO Autism Parkour', 'class', '15:45', '16:45'],
  ['7–9 år tjejklass', '7–9 YO Girls Class', 'class', '17:00', '18:00'],
  ['10 år klass', '10 YO class', 'class', '17:00', '18:00'],
  ['10–12 år', '10–12 YO', 'class', '15:45', '16:45'],
  ['10–12 år klass', '10–12 YO Class', 'class', '18:15', '19:15'],
  ['10–12 år tjejklass', '10–12 YO Girls Class', 'class', '18:15', '19:15'],
  ['10–14 år tricking', '10–14 YO Tricking Class', 'class', '12:15', '13:15'],
  ['13+ år tjejer', '13+ YO Girls', 'class', '19:30', '20:30'],
  ['Tonår till 14', 'Teen to 14', 'class', '19:15', '20:15'],
  ['Tonår 15+', 'Teen 15+', 'class', '20:15', '21:15'],
  ['Vuxentricking', 'Adult tricking', 'class', '19:15', '20:30'],
  ['Blue band', 'Blue band', 'class', '19:30', '20:30'],
  ['Red band', 'Redband class', 'class', '19:30', '20:30'],
  ['Öppet gym kväll', 'Open gym', 'openGym', '19:15', '22:00'],
  ['Öppet gym dag', 'Open Gym', 'openGym', '14:30', '17:00'],
  ['Öppet gym helg', 'Open gym', 'openGym', '13:00', '20:00'],
  ['Kalas', 'Party', 'party', '08:30', '12:00'],
  ['Läger 7–9 år / 10–12 år', 'Camp 7–9 YO / 10–12 YO', 'camp', '08:00', '15:30'],
];

export function seedCoaches(): Coach[] {
  return COACH_COLORS.map((color, i) => ({ id: `c${i + 1}`, name: `Coach ${i + 1}`, color, active: true }));
}

export function seedActivityTypes(): ActivityType[] {
  return TYPES.map(([nameSv, nameEn, category, start, end], i) => ({
    id: `t${i + 1}`,
    nameSv,
    nameEn,
    category,
    start,
    end,
    active: true,
  }));
}

export function createSeedData(): AppData {
  return {
    version: 1,
    settings: { gymName: 'Katana Parkour', exportLang: 'sv' },
    coaches: seedCoaches(),
    activityTypes: seedActivityTypes(),
    months: [],
    activities: [],
  };
}
