import React, { useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Clock } from 'lucide-react';
import { AppTheme } from '../types/settings';

export interface WaveformWindowControlProps {
  /**
   * Number of visible fundamental cycles.
   * Also accepts `visibleCycles` as an alias for backward compatibility.
   */
  cycles?: number;
  visibleCycles?: number;

  /**
   * Callback fired when cycle window size changes.
   * Also accepts `onChange` as an alias.
   */
  onCyclesChange?: (cycles: number) => void;
  onChange?: (cycles: number) => void;

  /**
   * Fundamental frequency (Hz) used to compute the visible time window in milliseconds.
   * Defaults to 60 Hz if omitted or invalid.
   */
  fundamentalFrequency?: number;

  /** Minimum selectable cycles (default 1) */
  minCycles?: number;

  /** Maximum selectable cycles (default 100) */
  maxCycles?: number;

  /** Default cycle count for reset action (default 3) */
  defaultCycles?: number;

  theme?: AppTheme;
  compact?: boolean;
}

export const WaveformWindowControl: React.FC<WaveformWindowControlProps> = ({
  cycles,
  visibleCycles,
  onCyclesChange,
  onChange,
  fundamentalFrequency = 60,
  minCycles = 1,
  maxCycles = 100,
  defaultCycles = 3,
  theme: _theme = 'dark',
  compact = false,
}) => {
  // Safe resolution of bounds
  const safeMin = typeof minCycles === 'number' && Number.isFinite(minCycles) && minCycles >= 1 ? Math.floor(minCycles) : 1;
  const safeMax = typeof maxCycles === 'number' && Number.isFinite(maxCycles) && maxCycles >= safeMin ? Math.floor(maxCycles) : 100;
  const safeDefault = typeof defaultCycles === 'number' && Number.isFinite(defaultCycles) && defaultCycles >= safeMin && defaultCycles <= safeMax
    ? Math.floor(defaultCycles)
    : 3;

  // Resolve input cycle count from either cycles or visibleCycles
  const rawCycles = cycles !== undefined ? cycles : visibleCycles;
  const effectiveCycles =
    typeof rawCycles === 'number' && Number.isFinite(rawCycles) && rawCycles > 0
      ? Math.min(safeMax, Math.max(safeMin, Math.round(rawCycles)))
      : safeDefault;

  const [localInputValue, setLocalInputValue] = useState<string>(() => effectiveCycles.toString());
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Keep local input value in sync with external cycle updates when user is not actively typing
  useEffect(() => {
    if (!isEditing) {
      setLocalInputValue(effectiveCycles.toString());
    }
  }, [effectiveCycles, isEditing]);

  const f0 =
    typeof fundamentalFrequency === 'number' && Number.isFinite(fundamentalFrequency) && fundamentalFrequency > 0
      ? fundamentalFrequency
      : 60;

  const windowDurationMs = (effectiveCycles / f0) * 1000;
  const formattedDuration =
    windowDurationMs >= 1000
      ? `${(windowDurationMs / 1000).toFixed(2)} s`
      : `${windowDurationMs.toFixed(1)} ms`;

  const commitValue = (val: number) => {
    if (typeof val !== 'number' || !Number.isFinite(val) || isNaN(val)) {
      setLocalInputValue(effectiveCycles.toString());
      return;
    }
    const clamped = Math.min(safeMax, Math.max(safeMin, Math.round(val)));
    if (onCyclesChange) {
      onCyclesChange(clamped);
    } else if (onChange) {
      onChange(clamped);
    }
    setLocalInputValue(clamped.toString());
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    const parsed = parseInt(localInputValue, 10);
    if (!isNaN(parsed) && Number.isFinite(parsed)) {
      commitValue(parsed);
    } else {
      setLocalInputValue(effectiveCycles.toString());
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setLocalInputValue(effectiveCycles.toString());
    }
  };

  const handleStep = (delta: number) => {
    commitValue(effectiveCycles + delta);
  };

  const handleReset = () => {
    commitValue(safeDefault);
  };

  const PRESETS = [1, 3, 5, 10, 20, 50, 100];

  return (
    <div
      role="region"
      aria-label="Waveform Window Size Control"
      className="flex items-center gap-1.5 font-mono select-none"
    >
      {/* Label & Computed Duration Pill */}
      <div
        className="flex items-center gap-1 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700/70 bg-slate-100 dark:bg-slate-800/80 text-[10px] text-slate-700 dark:text-slate-300"
        title={`Window duration = ${effectiveCycles} cycles / ${f0} Hz = ${formattedDuration}`}
      >
        <Clock className="w-3 h-3 text-cyan-500" />
        <span className="text-slate-400 dark:text-slate-500 hidden sm:inline">Window:</span>
        <span className="font-bold text-cyan-600 dark:text-cyan-400">
          {effectiveCycles} {effectiveCycles === 1 ? 'cycle' : 'cycles'}
        </span>
        <span className="text-slate-400 dark:text-slate-500 text-[9.5px]">({formattedDuration})</span>
      </div>

      {/* Stepper & Numeric Input */}
      <div className="flex items-center rounded border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-[#070b14] overflow-hidden text-[10px]">
        {/* Decrement Button */}
        <button
          type="button"
          onClick={() => handleStep(-1)}
          disabled={effectiveCycles <= safeMin}
          title={`Zoom In: Decrease visible cycles (min ${safeMin})`}
          aria-label="Decrease cycles (zoom in)"
          className="px-1.5 py-0.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ZoomIn className="w-2.5 h-2.5" />
        </button>

        {/* Direct Numeric Input */}
        <div className="relative flex items-center">
          <input
            type="number"
            min={safeMin}
            max={safeMax}
            value={localInputValue}
            onChange={handleInputChange}
            onFocus={() => setIsEditing(true)}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            title={`Enter number of cycles (${safeMin}-${safeMax})`}
            aria-label="Number of visible cycles"
            className="w-8 sm:w-10 text-center font-bold font-mono text-[10px] bg-transparent text-slate-900 dark:text-cyan-200 outline-none border-x border-slate-200 dark:border-slate-800 py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        {/* Increment Button */}
        <button
          type="button"
          onClick={() => handleStep(1)}
          disabled={effectiveCycles >= safeMax}
          title={`Zoom Out: Increase visible cycles (max ${safeMax})`}
          aria-label="Increase cycles (zoom out)"
          className="px-1.5 py-0.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ZoomOut className="w-2.5 h-2.5" />
        </button>
      </div>

      {/* Fast Presets Dropdown / Quick Buttons */}
      {!compact && (
        <div className="hidden xl:flex items-center gap-1 text-[9px]">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => commitValue(p)}
              className={`px-1.5 py-0.5 rounded border transition-colors ${
                effectiveCycles === p
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-600 dark:text-cyan-300 font-bold'
                  : 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-400 dark:hover:border-slate-600'
              }`}
              title={`View ${p} cycles (${((p / f0) * 1000).toFixed(1)} ms)`}
            >
              {p}c
            </button>
          ))}
        </div>
      )}

      {/* Reset Button (visible when not default) */}
      {effectiveCycles !== safeDefault && (
        <button
          type="button"
          onClick={handleReset}
          title={`Reset to default (${safeDefault} cycles)`}
          aria-label="Reset visible cycles to default"
          className="flex items-center gap-1 px-1.5 py-0.5 text-[9.5px] rounded bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors border border-slate-300 dark:border-slate-700/60"
        >
          <RotateCcw className="w-2.5 h-2.5" />
          <span className="hidden sm:inline">Reset</span>
        </button>
      )}
    </div>
  );
};
