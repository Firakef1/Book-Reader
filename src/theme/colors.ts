import { ThemeId } from '../types';

export interface ThemeColors {
  id: ThemeId;
  name: string;
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  /** Text / icons sitting on accent fills (e.g. white CTA → black label). */
  onAccent: string;
  accentSoft: string;
  border: string;
  progressTrack: string;
  progressFill: string;
  danger: string;
  tabInactive: string;
  glow: string;
  /** Warm content accent from cover photography (amber / paper). */
  warm: string;
  highlightOverlay: Record<string, string>;
}

/**
 * Visual direction inspired by
 * https://dribbble.com/shots/27438081-Digital-Reading-Mobile-App-Concept
 * Dark monochrome chrome; warm color only from covers / photography.
 */
export const themes: Record<ThemeId, ThemeColors> = {
  dark: {
    id: 'dark',
    name: 'Ink',
    background: '#0A0A0A',
    backgroundAlt: '#121212',
    surface: '#1A1A1A',
    surfaceElevated: '#242424',
    text: '#F8F8F8',
    textSecondary: '#A0A0A0',
    textMuted: '#6E6E73',
    accent: '#FFFFFF',
    onAccent: '#0A0A0A',
    accentSoft: '#2A2A2A',
    border: '#2E2E2E',
    progressTrack: '#2E2E2E',
    progressFill: '#FFFFFF',
    danger: '#FF6B6B',
    tabInactive: '#6E6E73',
    glow: 'rgba(255,255,255,0.06)',
    warm: '#C4A574',
    highlightOverlay: {
      yellow: 'rgba(250, 204, 21, 0.35)',
      green: 'rgba(74, 222, 128, 0.3)',
      blue: 'rgba(96, 165, 250, 0.3)',
      pink: 'rgba(244, 114, 182, 0.3)',
      orange: 'rgba(251, 146, 60, 0.3)',
    },
  },
  light: {
    id: 'light',
    name: 'Paper',
    background: '#F4F4F5',
    backgroundAlt: '#EBEBED',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    text: '#0A0A0A',
    textSecondary: '#3A3A3C',
    textMuted: '#8E8E93',
    accent: '#0A0A0A',
    onAccent: '#FFFFFF',
    accentSoft: '#E8E8ED',
    border: '#E0E0E5',
    progressTrack: '#E0E0E5',
    progressFill: '#0A0A0A',
    danger: '#C81E1E',
    tabInactive: '#8E8E93',
    glow: 'rgba(10,10,10,0.06)',
    warm: '#8B6914',
    highlightOverlay: {
      yellow: 'rgba(250, 204, 21, 0.45)',
      green: 'rgba(74, 222, 128, 0.4)',
      blue: 'rgba(96, 165, 250, 0.4)',
      pink: 'rgba(244, 114, 182, 0.4)',
      orange: 'rgba(251, 146, 60, 0.4)',
    },
  },
  sepia: {
    id: 'sepia',
    name: 'Parchment',
    background: '#E8DFD0',
    backgroundAlt: '#F0E8DA',
    surface: '#F5EEE3',
    surfaceElevated: '#FAF6EF',
    text: '#1C1610',
    textSecondary: '#4A3F32',
    textMuted: '#8A7A66',
    accent: '#1C1610',
    onAccent: '#F5EEE3',
    accentSoft: '#DDD2C0',
    border: '#D0C4B0',
    progressTrack: '#D0C4B0',
    progressFill: '#1C1610',
    danger: '#9B2C2C',
    tabInactive: '#9A876E',
    glow: 'rgba(28,22,16,0.08)',
    warm: '#A87800',
    highlightOverlay: {
      yellow: 'rgba(234, 179, 8, 0.4)',
      green: 'rgba(34, 197, 94, 0.35)',
      blue: 'rgba(59, 130, 246, 0.35)',
      pink: 'rgba(236, 72, 153, 0.35)',
      orange: 'rgba(249, 115, 22, 0.35)',
    },
  },
  darkSepia: {
    id: 'darkSepia',
    name: 'Lamp',
    background: '#14110E',
    backgroundAlt: '#1C1814',
    surface: '#221C16',
    surfaceElevated: '#2C241C',
    text: '#EDE4D4',
    textSecondary: '#B8A890',
    textMuted: '#8A7A64',
    accent: '#EDE4D4',
    onAccent: '#14110E',
    accentSoft: '#332B22',
    border: '#3A3026',
    progressTrack: '#3A3026',
    progressFill: '#EDE4D4',
    danger: '#E87A6E',
    tabInactive: '#8A7660',
    glow: 'rgba(237,228,212,0.08)',
    warm: '#C4A574',
    highlightOverlay: {
      yellow: 'rgba(250, 204, 21, 0.3)',
      green: 'rgba(74, 222, 128, 0.25)',
      blue: 'rgba(96, 165, 250, 0.25)',
      pink: 'rgba(244, 114, 182, 0.25)',
      orange: 'rgba(251, 146, 60, 0.25)',
    },
  },
};

export const highlightColors = [
  { id: 'yellow' as const, label: 'Yellow', swatch: '#FACC15' },
  { id: 'green' as const, label: 'Green', swatch: '#4ADE80' },
  { id: 'blue' as const, label: 'Blue', swatch: '#60A5FA' },
  { id: 'pink' as const, label: 'Pink', swatch: '#F472B6' },
  { id: 'orange' as const, label: 'Orange', swatch: '#FB923C' },
];

/** Cover colors lean warm/editorial like the shot’s book stacks. */
export const coverPalette = [
  '#8B4513',
  '#A87800',
  '#902808',
  '#2F4A3A',
  '#3D2F6B',
  '#1B3A4B',
  '#5C3D2E',
  '#1E3A5F',
  '#6B2D3C',
  '#3A4A2F',
];
