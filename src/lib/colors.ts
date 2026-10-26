// Färger på namnlappar. Textfärgen väljs så att namnet alltid går att läsa.

/** 20 tydligt skilda färger som föreslås för coacher. */
export const SUGGESTED_COLORS = [
  '#22C55E', '#EF4444', '#FACC15', '#14B8A6', '#1E3A8A',
  '#F97316', '#A855F7', '#EC4899', '#38BDF8', '#84CC16',
  '#B45309', '#6B7280', '#F9A8D4', '#2563EB', '#000000',
  '#7F1D1D', '#C4B5FD', '#166534', '#FED7AA', '#155E75',
];

export function isHexColor(s: unknown): s is string {
  return typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s);
}

/** Normaliserar "#abc" / "abc" / "#AABBCC" till "#AABBCC", annars null. */
export function normalizeHex(input: string): string | null {
  let s = input.trim();
  if (!s.startsWith('#')) s = '#' + s;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) s = '#' + s.slice(1).split('').map((c) => c + c).join('');
  return isHexColor(s) ? s.toUpperCase() : null;
}

function channel(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Svart eller vit, den som ger bäst kontrast mot bakgrunden. */
export function autoTextColor(bg: string): string {
  if (!isHexColor(bg)) return '#000000';
  return contrastRatio(bg, '#000000') >= contrastRatio(bg, '#FFFFFF') ? '#000000' : '#FFFFFF';
}

/** En något mörkare kant för namnlappen. */
export function borderColor(bg: string): string {
  if (!isHexColor(bg)) return '#00000033';
  const n = parseInt(bg.slice(1), 16);
  const f = luminance(bg) < 0.05 ? 1 : 0.72;
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function coachTextColor(coach: { color: string; textColor?: string }): string {
  return coach.textColor && isHexColor(coach.textColor) ? coach.textColor : autoTextColor(coach.color);
}
