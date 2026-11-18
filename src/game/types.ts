export type GamePhase = 'menu' | 'playing' | 'paused' | 'gameover';

export type TrackThemeId = 'sunset' | 'night' | 'alpine';

export type CameraMode = 'chase' | 'hood' | 'aerial';

export interface PaintPreset {
  id: string;
  name: string;
  hex: string;
  accentHex: string;
}

export interface TrackThemePreset {
  id: TrackThemeId;
  name: string;
  skyTop: string;
  skyHorizon: string;
  fogColor: string;
  groundColor: string;
  sunColor: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  roadTint: string;
}

export interface HudTelemetry {
  phase: GamePhase;
  speedKmh: number;
  maxSpeedKmh: number;
  nitro: number; // 0..100
  isBoosting: boolean;
  isBraking: boolean;
  score: number;
  bestScore: number;
  distanceKm: number;
  coins: number;
  nearMisses: number;
  combo: number;
  comboTimer: number; // 0..1
  hull: number;
  maxHull: number;
  eventBanner: {
    text: string;
    tone: 'gold' | 'cyan' | 'emerald' | 'red';
    id: number;
  } | null;
}

export interface TouchInputState {
  left: boolean;
  right: boolean;
  accelerate: boolean;
  brake: boolean;
  nitro: boolean;
}

export const PAINT_PRESETS: PaintPreset[] = [
  { id: 'crimson', name: 'Crimson GT', hex: '#dc2626', accentHex: '#f59e0b' },
  { id: 'amber', name: 'Solar Amber', hex: '#ea580c', accentHex: '#fde047' },
  { id: 'cobalt', name: 'Cobalt Apex', hex: '#2563eb', accentHex: '#38bdf8' },
  { id: 'emerald', name: 'British Emerald', hex: '#059669', accentHex: '#a7f3d0' },
  { id: 'obsidian', name: 'Stealth Carbon', hex: '#27272a', accentHex: '#ef4444' },
  { id: 'pearl', name: 'Arctic Pearl', hex: '#e4e4e7', accentHex: '#06b6d4' },
];

export const TRACK_THEMES: Record<TrackThemeId, TrackThemePreset> = {
  sunset: {
    id: 'sunset',
    name: 'Sunset Canyon',
    skyTop: '#1e1b4b',
    skyHorizon: '#f97316',
    fogColor: '#c2593f',
    groundColor: '#8c4b2d',
    sunColor: '#ffedd5',
    sunIntensity: 2.3,
    hemiSky: '#fdba74',
    hemiGround: '#431407',
    hemiIntensity: 0.9,
    roadTint: '#ffffff',
  },
  night: {
    id: 'night',
    name: 'Midnight City',
    skyTop: '#020617',
    skyHorizon: '#0f172a',
    fogColor: '#090d16',
    groundColor: '#111827',
    sunColor: '#93c5fd',
    sunIntensity: 1.15,
    hemiSky: '#38bdf8',
    hemiGround: '#09090b',
    hemiIntensity: 0.7,
    roadTint: '#cbd5e1',
  },
  alpine: {
    id: 'alpine',
    name: 'Alpine Coast',
    skyTop: '#0369a1',
    skyHorizon: '#bae6fd',
    fogColor: '#93c5fd',
    groundColor: '#3f6212',
    sunColor: '#fffbeb',
    sunIntensity: 2.4,
    hemiSky: '#e0f2fe',
    hemiGround: '#1a2e05',
    hemiIntensity: 1.0,
    roadTint: '#f8fafc',
  },
};
