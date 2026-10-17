import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { WaveformState, HarmonicPercentages } from '../../types/waveform';
import { formatWaveformEquation, DEFAULT_WAVEFORM_STATE } from '../../model/waveformModel';
import {
  parseWaveformEquation,
  replacePiWithSymbol,
  insertSymbolAtCursor,
} from '../../model/equationParser';
import {
  X,
  Sliders,
  Edit3,
  Check,
  AlertCircle,
  RefreshCw,
  Layers,
  Activity,
  Gauge,
  Sparkles,
  GripHorizontal,
} from 'lucide-react';

interface ScadaWaveformControlsModalProps {
  isOpen: boolean;
  onClose: () => void;
  waveformState: WaveformState;
  onUpdateWaveform: (updater: (prev: WaveformState) => WaveformState) => void;
}

export const ScadaWaveformControlsModal: React.FC<ScadaWaveformControlsModalProps> = ({
  isOpen,
  onClose,
  waveformState,
  onUpdateWaveform,
}) => {
  const [eqInputValue, setEqInputValue] = useState<string>(waveformState.equation);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const cursorPosToRestoreRef = useRef<number | null>(null);

  // Restore cursor position smoothly before paint when text is programmatically transformed
  useLayoutEffect(() => {
    if (cursorPosToRestoreRef.current !== null && inputRef.current) {
      const pos = cursorPosToRestoreRef.current;
      inputRef.current.setSelectionRange(pos, pos);
      cursorPosToRestoreRef.current = null;
    }
  });

  // Position state for movable/draggable pop-up window
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });

  // Reset position when opened
  useEffect(() => {
    if (isOpen) {
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen]);

  // Sync input value with equation when state changes from sliders
  useEffect(() => {
    if (!isFocused) {
      setEqInputValue(waveformState.equation);
      setValidationError(null);
    }
  }, [waveformState.equation, isFocused]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Mouse & Touch Dragging Handlers
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    // Avoid dragging if clicking buttons, inputs, links, or controls
    if ((e.target as HTMLElement).closest('button, input, select, textarea, a')) {
      return;
    }
    isDraggingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
    };
    e.preventDefault();
  };

  const handleHeaderTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, textarea, a')) {
      return;
    }
    const touch = e.touches[0];
    isDraggingRef.current = true;
    dragStartRef.current = {
      mouseX: touch.clientX,
      mouseY: touch.clientY,
      startX: position.x,
      startY: position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      const nextX = dragStartRef.current.startX + dx;
      const nextY = dragStartRef.current.startY + dy;

      // Clamp to viewport bounds so window header remains accessible
      const maxOffsetX = Math.max(100, window.innerWidth / 2 - 140);
      const maxOffsetY = Math.max(100, window.innerHeight / 2 - 80);
      setPosition({
        x: Math.max(-maxOffsetX, Math.min(maxOffsetX, nextX)),
        y: Math.max(-maxOffsetY, Math.min(maxOffsetY, nextY)),
      });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current) return;
      const touch = e.touches[0];
      const dx = touch.clientX - dragStartRef.current.mouseX;
      const dy = touch.clientY - dragStartRef.current.mouseY;
      const nextX = dragStartRef.current.startX + dx;
      const nextY = dragStartRef.current.startY + dy;

      const maxOffsetX = Math.max(100, window.innerWidth / 2 - 140);
      const maxOffsetY = Math.max(100, window.innerHeight / 2 - 80);
      setPosition({
        x: Math.max(-maxOffsetX, Math.min(maxOffsetX, nextX)),
        y: Math.max(-maxOffsetY, Math.min(maxOffsetY, nextY)),
      });
    };

    const handleTouchEnd = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  if (!isOpen) return null;

  // --- Parameter Handlers ---
  const handleFrequencyChange = (freq: number) => {
    onUpdateWaveform((prev) => {
      const eq = formatWaveformEquation(
        freq,
        prev.fundamentalAmplitude,
        prev.harmonics,
        prev.customTerms,
        prev.dcOffset,
        prev.phase
      );
      return {
        ...prev,
        fundamentalFrequency: freq,
        equation: eq,
      };
    });
  };

  const handleAmplitudeChange = (amp: number) => {
    onUpdateWaveform((prev) => {
      const eq = formatWaveformEquation(
        prev.fundamentalFrequency,
        amp,
        prev.harmonics,
        prev.customTerms,
        prev.dcOffset,
        prev.phase
      );
      return {
        ...prev,
        fundamentalAmplitude: amp,
        equation: eq,
      };
    });
  };

  const handleHarmonicChange = (key: keyof HarmonicPercentages, val: number) => {
    onUpdateWaveform((prev) => {
      const baseHarmonics = prev.harmonics || { second: 0, third: 0, fourth: 0 };
      const nextHarmonics = {
        ...baseHarmonics,
        [key]: val,
      };
      const eq = formatWaveformEquation(
        prev.fundamentalFrequency,
        prev.fundamentalAmplitude,
        nextHarmonics,
        prev.customTerms,
        prev.dcOffset,
        prev.phase
      );
      return {
        ...prev,
        harmonics: nextHarmonics,
        equation: eq,
      };
    });
  };

  const applyParsedEquation = (rawEq: string) => {
    if (!rawEq.trim()) {
      setValidationError('Equation cannot be empty');
      return;
    }

    const parseResult = parseWaveformEquation(rawEq, {
      currentFundamentalFrequency: waveformState.fundamentalFrequency,
      currentFundamentalAmplitude: waveformState.fundamentalAmplitude,
      currentHarmonics: waveformState.harmonics,
      currentCustomTerms: waveformState.customTerms,
    });

    if (parseResult.success) {
      setValidationError(null);
      onUpdateWaveform((prev) => ({
        ...prev,
        fundamentalFrequency: parseResult.fundamentalFrequency ?? prev.fundamentalFrequency,
        fundamentalAmplitude: parseResult.fundamentalAmplitude ?? prev.fundamentalAmplitude,
        harmonics: parseResult.harmonics ?? prev.harmonics,
        phase: parseResult.phase ?? prev.phase,
        dcOffset: parseResult.dcOffset ?? prev.dcOffset,
        customTerms: parseResult.customTerms ?? [],
        equation: rawEq,
      }));
    } else {
      setValidationError(parseResult.error || 'Invalid equation syntax');
    }
  };

  const handleEqInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const rawVal = input.value;
    const cursorPos = input.selectionStart ?? rawVal.length;

    // Auto-replace "pi" with "π" while maintaining precise cursor position
    const { text: newVal, cursorPosition: newCursorPos, replaced } = replacePiWithSymbol(
      rawVal,
      cursorPos
    );

    if (replaced) {
      cursorPosToRestoreRef.current = newCursorPos;
    }

    setEqInputValue(newVal);
    applyParsedEquation(newVal);
  };

  const handleInsertPi = (e: React.MouseEvent) => {
    e.preventDefault();
    const input = inputRef.current;
    if (!input) return;

    const currentVal = eqInputValue;
    const start = input.selectionStart ?? currentVal.length;
    const end = input.selectionEnd ?? start;

    const { text: newVal, cursorPosition: newPos } = insertSymbolAtCursor(
      currentVal,
      'π',
      start,
      end
    );

    cursorPosToRestoreRef.current = newPos;
    setEqInputValue(newVal);

    input.focus();
    input.setSelectionRange(newPos, newPos);

    applyParsedEquation(newVal);
  };

  const handleResetToDefaults = () => {
    onUpdateWaveform(() => ({
      ...DEFAULT_WAVEFORM_STATE,
    }));
  };

  const f0 = waveformState.fundamentalFrequency;
  const a1 = waveformState.fundamentalAmplitude;
  const harmonics = waveformState.harmonics || { second: 0, third: 0, fourth: 0 };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit Waveform"
      className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        }}
        className="pointer-events-auto w-full max-w-2xl bg-white/95 dark:bg-[#0c101d]/95 backdrop-blur-md border border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden transition-shadow"
      >
        {/* Draggable Header */}
        <div
          onMouseDown={handleHeaderMouseDown}
          onTouchStart={handleHeaderTouchStart}
          className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-[#080d1a]/90 shrink-0 cursor-move select-none active:cursor-grabbing"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
                  Edit Waveform
                </h2>
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-200/50 dark:bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-300/50 dark:border-slate-700/50 flex items-center gap-1">
                  <GripHorizontal className="w-3 h-3 text-slate-400" />
                  drag to move
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Shared canonical model: live real-time updates across all views
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 font-mono text-xs">
          {/* 1. Manual Equation Editor */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#080c16] p-3.5 space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                <Edit3 className="w-3.5 h-3.5 text-cyan-500" />
                Waveform Equation
              </label>

              <div className="flex items-center gap-2">
                {validationError ? (
                  <span className="flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800/50">
                    <AlertCircle className="w-3 h-3 text-amber-500" />
                    {validationError}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800/40 font-semibold">
                    <Check className="w-3 h-3 text-emerald-500" />
                    Synchronized
                  </span>
                )}

                <button
                  onClick={handleResetToDefaults}
                  title="Reset to 60Hz 1.0pu Default"
                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  Reset
                </button>
              </div>
            </div>

            <div className="relative flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={eqInputValue}
                onChange={handleEqInputChange}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="e.g. x(t) = 1.00 sin(2π·60t) + 0.20 sin(2π·120t)"
                className={`w-full font-mono text-xs px-3 pr-10 py-2 rounded-lg bg-white dark:bg-[#060911] border outline-none transition-all ${
                  validationError
                    ? 'border-amber-500 focus:ring-1 focus:ring-amber-500 text-amber-900 dark:text-amber-200'
                    : 'border-slate-300 dark:border-slate-700 focus:border-cyan-500 text-slate-900 dark:text-slate-100'
                }`}
              />
              {/* Dedicated π button */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleInsertPi}
                title="Insert π (pi)"
                aria-label="Insert π symbol"
                className="absolute right-2 px-2 py-0.5 text-xs font-serif font-bold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-200 bg-cyan-500/10 hover:bg-cyan-500/20 active:bg-cyan-500/30 rounded border border-cyan-500/30 transition-all active:scale-95 select-none"
              >
                π
              </button>
            </div>

            {/* Quick Equation Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px]">
              <span className="text-slate-400 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-cyan-500" />
                Presets:
              </span>
              <button
                onClick={() => {
                  onUpdateWaveform((prev) => ({
                    ...prev,
                    fundamentalFrequency: 60,
                    fundamentalAmplitude: 1.0,
                    harmonics: { second: 0, third: 0, fourth: 0 },
                    customTerms: [],
                    equation: 'x(t) = 1.00 sin(2π·60t)',
                  }));
                }}
                className="px-2 py-0.5 rounded bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:border-cyan-400 text-slate-700 dark:text-slate-300 transition-colors"
              >
                Nominal 60Hz Sine
              </button>
              <button
                onClick={() => {
                  onUpdateWaveform((prev) => ({
                    ...prev,
                    fundamentalFrequency: 50,
                    fundamentalAmplitude: 1.0,
                    harmonics: { second: 0, third: 0, fourth: 0 },
                    customTerms: [],
                    equation: 'x(t) = 1.00 sin(2π·50t)',
                  }));
                }}
                className="px-2 py-0.5 rounded bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:border-cyan-400 text-slate-700 dark:text-slate-300 transition-colors"
              >
                50Hz Grid
              </button>
              <button
                onClick={() => {
                  handleHarmonicChange('second', 0);
                  handleHarmonicChange('third', 30);
                  handleHarmonicChange('fourth', 0);
                }}
                className="px-2 py-0.5 rounded bg-pink-500/10 border border-pink-500/30 text-pink-700 dark:text-pink-300 hover:bg-pink-500/20 transition-colors"
              >
                30% 3rd Harmonic
              </button>
              <button
                onClick={() => {
                  handleAmplitudeChange(1.5);
                }}
                className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors"
              >
                1.50 pu (+50% Step)
              </button>
            </div>
          </div>

          {/* 2. Fundamental Controls */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#080c16] p-3.5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-500" />
                Fundamental Frequency & Amplitude
              </h3>
              <span className="text-[10px] text-slate-400">f₀ & A₁</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Frequency */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-cyan-500" />
                    Frequency:
                  </label>
                  <div className="flex items-center gap-1 bg-white dark:bg-[#060911] border border-slate-300 dark:border-slate-700 rounded px-2 py-0.5 font-bold text-cyan-600 dark:text-cyan-300">
                    <span>{f0}</span>
                    <span className="text-slate-400 font-normal">Hz</span>
                  </div>
                </div>

                <input
                  type="range"
                  min={1}
                  max={120}
                  step={1}
                  value={f0}
                  onChange={(e) => handleFrequencyChange(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />

                <div className="flex justify-between items-center text-[10px] text-slate-400">
                  <span>1 Hz</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleFrequencyChange(50)}
                      className={`px-1.5 py-0.5 rounded border transition-colors ${
                        f0 === 50 ? 'bg-cyan-500/20 text-cyan-500 border-cyan-500/50 font-bold' : 'hover:text-slate-700 dark:hover:text-slate-200 border-transparent'
                      }`}
                    >
                      50 Hz
                    </button>
                    <button
                      onClick={() => handleFrequencyChange(60)}
                      className={`px-1.5 py-0.5 rounded border transition-colors ${
                        f0 === 60 ? 'bg-cyan-500/20 text-cyan-500 border-cyan-500/50 font-bold' : 'hover:text-slate-700 dark:hover:text-slate-200 border-transparent'
                      }`}
                    >
                      60 Hz
                    </button>
                  </div>
                  <span>120 Hz</span>
                </div>
              </div>

              {/* Amplitude */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-600 dark:text-slate-400">Amplitude:</label>
                  <div className="flex items-center gap-1 bg-white dark:bg-[#060911] border border-slate-300 dark:border-slate-700 rounded px-2 py-0.5 font-bold text-cyan-600 dark:text-cyan-300">
                    <span>{a1.toFixed(2)}</span>
                    <span className="text-slate-400 font-normal">pu</span>
                  </div>
                </div>

                <input
                  type="range"
                  min={0}
                  max={2.0}
                  step={0.01}
                  value={a1}
                  onChange={(e) => handleAmplitudeChange(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />

                <div className="flex justify-between items-center text-[10px] text-slate-400">
                  <span>0.00 pu</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleAmplitudeChange(0.5)}
                      className={`px-1.5 py-0.5 rounded border transition-colors ${
                        a1 === 0.5 ? 'bg-cyan-500/20 text-cyan-500 border-cyan-500/50 font-bold' : 'hover:text-slate-700 dark:hover:text-slate-200 border-transparent'
                      }`}
                    >
                      0.50
                    </button>
                    <button
                      onClick={() => handleAmplitudeChange(1.0)}
                      className={`px-1.5 py-0.5 rounded border transition-colors ${
                        a1 === 1.0 ? 'bg-cyan-500/20 text-cyan-500 border-cyan-500/50 font-bold' : 'hover:text-slate-700 dark:hover:text-slate-200 border-transparent'
                      }`}
                    >
                      1.00
                    </button>
                    <button
                      onClick={() => handleAmplitudeChange(1.5)}
                      className={`px-1.5 py-0.5 rounded border transition-colors ${
                        a1 === 1.5 ? 'bg-cyan-500/20 text-cyan-500 border-cyan-500/50 font-bold' : 'hover:text-slate-700 dark:hover:text-slate-200 border-transparent'
                      }`}
                    >
                      1.50
                    </button>
                  </div>
                  <span>2.00 pu</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Harmonic Distortion Controls (2nd, 3rd, 4th) */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#080c16] p-3.5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-500" />
                Harmonics Customization (2nd, 3rd, 4th)
              </h3>
              {(harmonics.second > 0 || harmonics.third > 0 || harmonics.fourth > 0) && (
                <button
                  onClick={() => {
                    handleHarmonicChange('second', 0);
                    handleHarmonicChange('third', 0);
                    handleHarmonicChange('fourth', 0);
                  }}
                  className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline"
                >
                  Clear Harmonics
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 2nd Harmonic */}
              <div className="space-y-1.5 p-2.5 rounded-lg bg-white dark:bg-[#060911] border border-purple-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-purple-600 dark:text-purple-400 font-bold">2nd (2f₀):</span>
                  <span className="bg-purple-500/10 px-1.5 py-0.5 rounded text-purple-700 dark:text-purple-300 font-bold">
                    {harmonics.second}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={1}
                  value={harmonics.second}
                  onChange={(e) => handleHarmonicChange('second', parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-[9px] text-slate-400">
                  <span>0%</span>
                  <span>{2 * f0} Hz</span>
                  <span>50%</span>
                </div>
              </div>

              {/* 3rd Harmonic */}
              <div className="space-y-1.5 p-2.5 rounded-lg bg-white dark:bg-[#060911] border border-pink-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-pink-600 dark:text-pink-400 font-bold">3rd (3f₀):</span>
                  <span className="bg-pink-500/10 px-1.5 py-0.5 rounded text-pink-700 dark:text-pink-300 font-bold">
                    {harmonics.third}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={1}
                  value={harmonics.third}
                  onChange={(e) => handleHarmonicChange('third', parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                />
                <div className="flex justify-between text-[9px] text-slate-400">
                  <span>0%</span>
                  <span>{3 * f0} Hz</span>
                  <span>50%</span>
                </div>
              </div>

              {/* 4th Harmonic */}
              <div className="space-y-1.5 p-2.5 rounded-lg bg-white dark:bg-[#060911] border border-amber-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-amber-600 dark:text-amber-400 font-bold">4th (4f₀):</span>
                  <span className="bg-amber-500/10 px-1.5 py-0.5 rounded text-amber-700 dark:text-amber-300 font-bold">
                    {harmonics.fourth}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={1}
                  value={harmonics.fourth}
                  onChange={(e) => handleHarmonicChange('fourth', parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-[9px] text-slate-400">
                  <span>0%</span>
                  <span>{4 * f0} Hz</span>
                  <span>50%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#080d1a] shrink-0 font-mono text-xs">
          <span className="text-slate-500 text-[11px]">
            True RMS updates continuously • SCADA RMS updates on next poll
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-all shadow-md shadow-cyan-500/20"
          >
            Apply & Done
          </button>
        </div>
      </div>
    </div>
  );
};
