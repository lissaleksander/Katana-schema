import { describe, expect, it } from 'vitest';
import { SUGGESTED_COLORS, autoTextColor, coachTextColor, contrastRatio, normalizeHex } from './colors';

describe('colors', () => {
  it('väljer läsbar textfärg', () => {
    expect(autoTextColor('#000000')).toBe('#FFFFFF');
    expect(autoTextColor('#FFFFFF')).toBe('#000000');
    expect(autoTextColor('#FACC15')).toBe('#000000'); // gul
    expect(autoTextColor('#1E3A8A')).toBe('#FFFFFF'); // mörkblå
  });

  it('alla föreslagna färger ger minst 4.5:1 kontrast med automatisk text', () => {
    expect(new Set(SUGGESTED_COLORS).size).toBe(20);
    for (const c of SUGGESTED_COLORS) {
      expect(contrastRatio(c, autoTextColor(c))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('normalizeHex', () => {
    expect(normalizeHex('#abc')).toBe('#AABBCC');
    expect(normalizeHex('22c55e')).toBe('#22C55E');
    expect(normalizeHex('#12345')).toBeNull();
    expect(normalizeHex('red')).toBeNull();
  });

  it('egen textfärg går före automatisk', () => {
    expect(coachTextColor({ color: '#000000', textColor: '#FF0000' })).toBe('#FF0000');
    expect(coachTextColor({ color: '#000000' })).toBe('#FFFFFF');
  });
});
