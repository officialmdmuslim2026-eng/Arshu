import React from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Flame,
  Gamepad2,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  CameraMode,
  HudTelemetry,
  PAINT_PRESETS,
  TouchInputState,
  TRACK_THEMES,
  TrackThemeId,
} from '../game/types';

interface GameHudProps {
  telemetry: HudTelemetry;
  selectedPaint: string;
  selectedTheme: TrackThemeId;
  cameraMode: CameraMode;
  muted: boolean;
  dockCollapsed: boolean;
  showTouchControls: boolean;
  onStartRace: () => void;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onSelectPaint: (hex: string) => void;
  onSelectTheme: (theme: TrackThemeId) => void;
  onSelectCamera: (mode: CameraMode) => void;
  onToggleDock: () => void;
  onToggleTouchControls: () => void;
  onTouchInput: (patch: Partial<TouchInputState>) => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  telemetry,
  selectedPaint,
  selectedTheme,
  cameraMode,
  muted,
  dockCollapsed,
  showTouchControls,
  onStartRace,
  onTogglePause,
  onToggleMute,
  onSelectPaint,
  onSelectTheme,
  onSelectCamera,
  onToggleDock,
  onToggleTouchControls,
  onTouchInput,
}) => {
  const isPlaying = telemetry.phase === 'playing';
  const speedPct = Math.min(100, Math.round((telemetry.speedKmh / telemetry.maxSpeedKmh) * 100));

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-4 sm:p-6">
      {/* Top Bar: Minimalist Telemetry (Left) & Functional Controls (Right) */}
      <div className="flex items-start justify-between gap-4">
        <div className="pointer-events-auto rounded-xl border border-white/12 bg-zinc-950/85 px-4 py-3 shadow-lg">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap">
              Apex Rush 3D
            </h1>
            <span className="text-zinc-600" aria-hidden="true">/</span>
            <div className="flex items-center gap-1.5" aria-label={`Hull Integrity ${telemetry.hull} of ${telemetry.maxHull}`}>
              <Shield className="h-3.5 w-3.5 text-zinc-400" />
              {Array.from({ length: telemetry.maxHull }).map((_, i) => (
                <span
                  key={i}
                  className={`h-2 w-5 rounded-xs transition-colors ${
                    i < telemetry.hull
                      ? telemetry.hull === 1
                        ? 'bg-red-500'
                        : 'bg-emerald-400'
                      : 'bg-zinc-800'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-zinc-400 font-mono tabular-nums">
            <span>
              Score <strong className="text-white">{telemetry.score.toLocaleString()}</strong>
            </span>
            <span className="text-zinc-600" aria-hidden="true">·</span>
            <span>
              Best <strong className="text-amber-400">{telemetry.bestScore.toLocaleString()}</strong>
            </span>
            <span className="text-zinc-600" aria-hidden="true">·</span>
            <span>{telemetry.distanceKm.toFixed(2)} km</span>
            <span className="text-zinc-600" aria-hidden="true">·</span>
            <span>{telemetry.coins} coins</span>
            {telemetry.combo > 1 && (
              <>
                <span className="text-zinc-600" aria-hidden="true">·</span>
                <span className="font-semibold text-cyan-400">{telemetry.combo}x Combo</span>
              </>
            )}
          </div>
        </div>

        {/* Top-Right Quick Action Controls */}
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-white/12 bg-zinc-950/85 p-1.5 shadow-lg">
          {(telemetry.phase === 'playing' || telemetry.phase === 'paused') && (
            <button
              type="button"
              onClick={onTogglePause}
              className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-zinc-200 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0 cursor-pointer"
              aria-label={telemetry.phase === 'paused' ? 'Resume race' : 'Pause race'}
            >
              {telemetry.phase === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              <span className="hidden sm:inline">{telemetry.phase === 'paused' ? 'Resume' : 'Pause'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              const order: CameraMode[] = ['chase', 'hood', 'aerial'];
              onSelectCamera(order[(order.indexOf(cameraMode) + 1) % order.length]);
            }}
            className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-zinc-200 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0 cursor-pointer"
            title="Cycle camera (C)"
          >
            <Camera className="h-4 w-4" />
            <span className="hidden sm:inline capitalize">{cameraMode}</span>
          </button>

          <button
            type="button"
            onClick={onToggleTouchControls}
            className={`flex h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0 cursor-pointer ${
              showTouchControls ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-200 hover:bg-white/10'
            }`}
            title="Toggle on-screen touch pedals"
          >
            <Gamepad2 className="h-4 w-4" />
            <span className="hidden md:inline">Touch</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-200 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-amber-400 shrink-0 cursor-pointer"
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            title={muted ? 'Unmute audio' : 'Mute audio'}
          >
            {muted ? <VolumeX className="h-4 w-4 text-zinc-400" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Fleeting Center-Top Event Notification (Near Miss / Pickup / Damage) */}
      {telemetry.eventBanner && isPlaying && (
        <div
          key={telemetry.eventBanner.id}
          className="pointer-events-none fixed left-1/2 top-24 z-20 -translate-x-1/2 rounded-lg border border-white/15 bg-zinc-950/90 px-4 py-1.5 text-sm font-semibold tracking-wide shadow-md"
        >
          <span
            className={
              telemetry.eventBanner.tone === 'cyan'
                ? 'text-cyan-400'
                : telemetry.eventBanner.tone === 'gold'
                ? 'text-amber-400'
                : telemetry.eventBanner.tone === 'emerald'
                ? 'text-emerald-400'
                : 'text-red-400'
            }
          >
            {telemetry.eventBanner.text}
          </span>
        </div>
      )}

      {/* Center Overlays for Menu / Pause / Game Over */}
      {telemetry.phase === 'menu' && (
        <div className="pointer-events-none flex flex-1 items-center justify-center">
          <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/15 bg-zinc-950/88 p-6 text-center shadow-2xl">
            <p className="text-xs font-medium tracking-wide text-amber-400">
              Highway GT · Endless Traffic Sprint
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-white text-balance sm:text-4xl">
              Own the Expressway
            </h2>
            <p className="mt-2 text-sm text-zinc-300">
              Weave through highway lanes, chain near-misses for score multipliers, and ignite Nitro on open straights.
            </p>

            <div className="mt-5 flex items-center justify-center gap-4 text-xs text-zinc-400">
              <span>Steer: A / D or Arrows</span>
              <span className="text-zinc-600" aria-hidden="true">·</span>
              <span>Nitro: Space</span>
              <span className="text-zinc-600" aria-hidden="true">·</span>
              <span>Camera: C</span>
            </div>

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={onStartRace}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-amber-500 px-8 font-display text-base font-bold text-zinc-950 transition-transform hover:bg-amber-400 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-white whitespace-nowrap cursor-pointer"
              >
                <Play className="h-4 w-4 fill-current" />
                Start Race
              </button>
            </div>
          </div>
        </div>
      )}

      {telemetry.phase === 'paused' && (
        <div className="pointer-events-none flex flex-1 items-center justify-center">
          <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-white/15 bg-zinc-950/92 p-6 text-center shadow-2xl">
            <h2 className="font-display text-2xl font-bold text-white">Race Paused</h2>
            <p className="mt-1.5 text-sm text-zinc-400">
              Customize your car paint or track atmosphere below, or jump right back in.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={onTogglePause}
                className="flex h-11 items-center gap-2 rounded-xl bg-amber-500 px-6 font-display text-sm font-bold text-zinc-950 transition-colors hover:bg-amber-400 whitespace-nowrap cursor-pointer"
              >
                <Play className="h-4 w-4 fill-current" />
                Resume
              </button>
              <button
                type="button"
                onClick={onStartRace}
                className="flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-zinc-900 px-5 text-sm font-semibold text-zinc-200 transition-colors hover:bg-zinc-800 whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                Restart
              </button>
            </div>
          </div>
        </div>
      )}

      {telemetry.phase === 'gameover' && (
        <div className="pointer-events-none flex flex-1 items-center justify-center">
          <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/15 bg-zinc-950/92 p-6 text-center shadow-2xl">
            <p className="text-xs font-semibold text-red-400">Run Finished</p>
            <h2 className="mt-1 font-display text-3xl font-bold text-white font-mono tabular-nums">
              {telemetry.score.toLocaleString()} pts
            </h2>
            {telemetry.score >= telemetry.bestScore && telemetry.score > 0 && (
              <p className="mt-1 text-xs font-semibold text-amber-400">New Personal Record</p>
            )}

            <div className="mt-5 grid grid-cols-3 gap-3 border-y border-white/10 py-4 text-left">
              <div>
                <div className="text-xs text-zinc-400">Distance</div>
                <div className="mt-0.5 font-mono text-sm font-bold text-white tabular-nums">
                  {telemetry.distanceKm.toFixed(2)} km
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-400">Near Misses</div>
                <div className="mt-0.5 font-mono text-sm font-bold text-cyan-400 tabular-nums">
                  {telemetry.nearMisses}
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-400">Coins</div>
                <div className="mt-0.5 font-mono text-sm font-bold text-amber-400 tabular-nums">
                  {telemetry.coins}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={onStartRace}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-amber-500 px-8 font-display text-base font-bold text-zinc-950 transition-transform hover:bg-amber-400 active:scale-[0.98] whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                Play Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Area: Speedometer + Nitro + Collapsible Customization Dock + Optional Touch Pedals */}
      <div className="flex flex-col gap-3">
        {/* Touch Controls Row (shown on mobile or when toggled on) */}
        {showTouchControls && isPlaying && (
          <div className="pointer-events-none flex items-end justify-between gap-4 pb-1">
            <div className="pointer-events-auto flex items-center gap-2.5">
              <button
                type="button"
                onPointerDown={() => onTouchInput({ left: true })}
                onPointerUp={() => onTouchInput({ left: false })}
                onPointerLeave={() => onTouchInput({ left: false })}
                onPointerCancel={() => onTouchInput({ left: false })}
                className="flex h-14 w-16 items-center justify-center rounded-xl border border-white/15 bg-zinc-950/85 font-display text-lg font-bold text-white active:bg-amber-500 active:text-zinc-950"
                aria-label="Steer left"
              >
                ←
              </button>
              <button
                type="button"
                onPointerDown={() => onTouchInput({ right: true })}
                onPointerUp={() => onTouchInput({ right: false })}
                onPointerLeave={() => onTouchInput({ right: false })}
                onPointerCancel={() => onTouchInput({ right: false })}
                className="flex h-14 w-16 items-center justify-center rounded-xl border border-white/15 bg-zinc-950/85 font-display text-lg font-bold text-white active:bg-amber-500 active:text-zinc-950"
                aria-label="Steer right"
              >
                →
              </button>
            </div>

            <div className="pointer-events-auto flex items-center gap-2.5">
              <button
                type="button"
                onPointerDown={() => onTouchInput({ brake: true })}
                onPointerUp={() => onTouchInput({ brake: false })}
                onPointerLeave={() => onTouchInput({ brake: false })}
                onPointerCancel={() => onTouchInput({ brake: false })}
                className="flex h-14 px-4 items-center justify-center rounded-xl border border-white/15 bg-zinc-950/85 text-xs font-bold text-red-400 active:bg-red-500 active:text-white"
              >
                Brake
              </button>
              <button
                type="button"
                onPointerDown={() => onTouchInput({ accelerate: true })}
                onPointerUp={() => onTouchInput({ accelerate: false })}
                onPointerLeave={() => onTouchInput({ accelerate: false })}
                onPointerCancel={() => onTouchInput({ accelerate: false })}
                className="flex h-14 px-4 items-center justify-center rounded-xl border border-white/15 bg-zinc-950/85 text-xs font-bold text-emerald-400 active:bg-emerald-500 active:text-zinc-950"
              >
                Gas
              </button>
              <button
                type="button"
                onPointerDown={() => onTouchInput({ nitro: true })}
                onPointerUp={() => onTouchInput({ nitro: false })}
                onPointerLeave={() => onTouchInput({ nitro: false })}
                onPointerCancel={() => onTouchInput({ nitro: false })}
                className="flex h-14 px-4 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-950/85 text-xs font-bold text-cyan-300 active:bg-cyan-400 active:text-zinc-950"
              >
                Nitro
              </button>
            </div>
          </div>
        )}

        {/* Active Racing Telemetry Strip (Speed + Nitro) */}
        <div className="flex items-end justify-between gap-4">
          {/* Speedometer Bottom-Left */}
          <div className="pointer-events-auto rounded-xl border border-white/12 bg-zinc-950/85 px-4 py-2.5 shadow-lg">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-bold leading-none text-white font-mono tabular-nums">
                {telemetry.speedKmh}
              </span>
              <span className="text-xs font-medium text-zinc-400">KM/H</span>
            </div>
            <div className="mt-2 h-1.5 w-32 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full transition-all duration-100 ${
                  telemetry.isBoosting ? 'bg-cyan-400' : 'bg-amber-500'
                }`}
                style={{ width: `${speedPct}%` }}
              />
            </div>
          </div>

          {/* Nitro Meter Bottom-Right */}
          <div className="pointer-events-auto rounded-xl border border-white/12 bg-zinc-950/85 px-4 py-2.5 shadow-lg text-right">
            <div className="flex items-center justify-end gap-1.5 text-xs font-medium text-zinc-300">
              <Flame className={`h-3.5 w-3.5 ${telemetry.isBoosting ? 'text-cyan-400' : 'text-amber-400'}`} />
              <span>Nitro</span>
              <span className="font-mono tabular-nums text-white">{telemetry.nitro}%</span>
            </div>
            <div className="mt-2 h-1.5 w-32 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-cyan-400 transition-all duration-100"
                style={{ width: `${telemetry.nitro}%` }}
              />
            </div>
          </div>
        </div>

        {/* Collapsible Bottom Control Dock (Garage Paint, Track Scenery, Camera) */}
        <div className="pointer-events-none flex flex-col items-center">
          <button
            type="button"
            onClick={onToggleDock}
            className="pointer-events-auto mb-1.5 flex h-7 items-center gap-1.5 rounded-lg border border-white/12 bg-zinc-950/85 px-3 text-xs font-medium text-zinc-300 transition-colors hover:text-white cursor-pointer"
            title="Toggle Garage & Track Controls (H)"
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                <span>Show Garage & Track</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                <span>Hide Controls</span>
              </>
            )}
          </button>

          <div
            className={`pointer-events-auto w-full max-w-[900px] overflow-hidden rounded-xl border border-white/12 bg-zinc-950/90 px-4 py-2.5 shadow-xl transition-transform duration-200 ${
              dockCollapsed ? 'translate-y-[140%] pointer-events-none hidden' : 'translate-y-0'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Paint Swatches */}
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-medium text-zinc-400 whitespace-nowrap">Paint</span>
                <div className="flex items-center gap-1.5">
                  {PAINT_PRESETS.map((p) => {
                    const active = selectedPaint === p.hex;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onSelectPaint(p.hex)}
                        title={p.name}
                        aria-label={`Select ${p.name} paint`}
                        className={`h-6 w-6 rounded-full border-2 transition-transform cursor-pointer ${
                          active ? 'scale-110 border-white' : 'border-white/20 hover:scale-105'
                        }`}
                        style={{ backgroundColor: p.hex }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Scenery Selector */}
              <div className="flex items-center gap-1 rounded-lg bg-zinc-900 p-1">
                {(Object.keys(TRACK_THEMES) as TrackThemeId[]).map((id) => {
                  const preset = TRACK_THEMES[id];
                  const active = selectedTheme === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onSelectTheme(id)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active ? 'bg-amber-500 text-zinc-950 font-semibold' : 'text-zinc-300 hover:text-white'
                      }`}
                    >
                      {preset.name}
                    </button>
                  );
                })}
              </div>

              {/* Camera Mode Selector */}
              <div className="flex items-center gap-1 rounded-lg bg-zinc-900 p-1">
                {(['chase', 'hood', 'aerial'] as CameraMode[]).map((mode) => {
                  const active = cameraMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onSelectCamera(mode)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active ? 'bg-zinc-700 text-white font-semibold' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {mode}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
