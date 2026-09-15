import { LineHeight, TextPreferences } from '../types';

export const defaultTextPreferences: TextPreferences = {
  fontSize: 18,
  fontFamily: 'serif',
  lineHeight: 'normal',
  textAlign: 'left',
  letterSpacing: 0,
};

export function getLineHeightMultiplier(lineHeight: LineHeight): number {
  switch (lineHeight) {
    case 'compact':
      return 1.35;
    case 'spacious':
      return 1.9;
    default:
      return 1.6;
  }
}

export function getFontFamilyName(
  family: TextPreferences['fontFamily'],
  serifLoaded: boolean,
  sansLoaded: boolean,
): string {
  switch (family) {
    case 'sans':
      return sansLoaded ? 'SourceSans3_400Regular' : 'System';
    case 'mono':
      return 'monospace';
    default:
      return serifLoaded ? 'Literata_400Regular' : 'serif';
  }
}

/** Approximate characters per page for pagination */
export function charsPerPage(fontSize: number): number {
  return Math.round(2200 * (18 / fontSize));
}
