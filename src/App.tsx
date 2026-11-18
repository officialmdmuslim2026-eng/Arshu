/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { CarGameEngine } from './game/CarGameEngine';
import {
  CameraMode,
  HudTelemetry,
  PAINT_PRESETS,
  TouchInputState,
  TrackThemeId,
} from './game/types';

const INITIAL_TELEMETRY: HudTelemetry = {
  phase: 'menu',
  speedKmh: 84,
  maxSpeedKmh: 290,
  nitro: 100,
  isBoosting: false,
  isBraking: false,
  score: 0,
  bestScore: 0,
  distanceKm: 0,
  coins: 0,
  nearMisses: 0,
  combo: 1,
  comboTimer: 0,
  hull: 3,
  maxHull: 3,
  eventBanner: null,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<CarGameEngine | null>(null);

  const [telemetry, setTelemetry] = useState<HudTelemetry>(INITIAL_TELEMETRY);
  const [selectedPaint, setSelectedPaint] = useState<string>(PAINT_PRESETS[0].hex);
  const [selectedTheme, setSelectedTheme] = useState<TrackThemeId>('sunset');
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [muted, setMuted] = useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [contextLost, setContextLost] = useState<boolean>(false);
  const [showTouchControls, setShowTouchControls] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
    }
    return false;
  });

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const engine = new CarGameEngine(
      container,
      (nextTelemetry) => setTelemetry(nextTelemetry),
      (lost) => setContextLost(lost),
      (nextCam) => setCameraMode(nextCam)
    );
    engineRef.current = engine;

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyH' && !e.repeat) {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleStartRace = useCallback(() => {
    engineRef.current?.startRace();
  }, []);

  const handleTogglePause = useCallback(() => {
    const current = telemetry.phase;
    if (current === 'playing') engineRef.current?.setPaused(true);
    else if (current === 'paused') engineRef.current?.setPaused(false);
  }, [telemetry.phase]);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      engineRef.current?.sound.setMuted(next);
      return next;
    });
  }, []);

  const handleSelectPaint = useCallback((hex: string) => {
    setSelectedPaint(hex);
    engineRef.current?.setPaintColor(hex);
  }, []);

  const handleSelectTheme = useCallback((theme: TrackThemeId) => {
    setSelectedTheme(theme);
    engineRef.current?.setTheme(theme);
  }, []);

  const handleSelectCamera = useCallback((mode: CameraMode) => {
    setCameraMode(mode);
    engineRef.current?.setCameraMode(mode);
  }, []);

  const handleTouchInput = useCallback((patch: Partial<TouchInputState>) => {
    engineRef.current?.setTouchInput(patch);
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-zinc-950">
      {/* Isolated WebGL canvas container (never re-rendered on HUD state updates) */}
      <div ref={canvasMountRef} className="absolute inset-0 h-full w-full" />

      {contextLost ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-zinc-950 p-6">
          <div className="max-w-sm rounded-2xl border border-white/15 bg-zinc-900 p-6 text-center">
            <h2 className="font-display text-xl font-bold text-white">Graphics Context Interrupted</h2>
            <p className="mt-2 text-sm text-zinc-400">
              WebGL rendering paused due to browser resource limits. Reload to resume racing.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-zinc-950 hover:bg-amber-400 cursor-pointer"
            >
              Reload Game
            </button>
          </div>
        </div>
      ) : (
        <GameHud
          telemetry={telemetry}
          selectedPaint={selectedPaint}
          selectedTheme={selectedTheme}
          cameraMode={cameraMode}
          muted={muted}
          dockCollapsed={dockCollapsed}
          showTouchControls={showTouchControls}
          onStartRace={handleStartRace}
          onTogglePause={handleTogglePause}
          onToggleMute={handleToggleMute}
          onSelectPaint={handleSelectPaint}
          onSelectTheme={handleSelectTheme}
          onSelectCamera={handleSelectCamera}
          onToggleDock={() => setDockCollapsed((prev) => !prev)}
          onToggleTouchControls={() => setShowTouchControls((prev) => !prev)}
          onTouchInput={handleTouchInput}
        />
      )}
    </main>
  );
}
