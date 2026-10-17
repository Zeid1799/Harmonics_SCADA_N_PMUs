import React, { useRef, useEffect, useState } from 'react';
import { WaveformState } from '../../types/waveform';
import { AppTheme } from '../../types/settings';
import { ScadaTelemetryData, ScadaHistoryPoint } from '../../types/scada';
import { generateWaveformData } from '../../model/waveformGenerator';
import { Clock, Radio, Activity } from 'lucide-react';
import { WaveformWindowControl } from '../WaveformWindowControl';

interface ScadaWaveformPlotProps {
  state: WaveformState;
  telemetry: ScadaTelemetryData;
  history: ScadaHistoryPoint[];
  theme?: AppTheme;
  visibleCycles?: number;
  onCyclesChange?: (cycles: number) => void;
}

export const ScadaWaveformPlot: React.FC<ScadaWaveformPlotProps> = ({
  state,
  telemetry,
  history,
  theme = 'dark',
  visibleCycles: externalVisibleCycles,
  onCyclesChange: externalOnCyclesChange,
}) => {
  const oscCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const trendCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [viewMode, setViewMode] = useState<'split' | 'oscilloscope' | 'trend'>('split');

  const [internalCycles, setInternalCycles] = useState<number>(state.visibleCycles ?? 3);
  const cycles = externalVisibleCycles ?? state.visibleCycles ?? internalCycles;

  const handleCyclesChange = (newCycles: number) => {
    setInternalCycles(newCycles);
    externalOnCyclesChange?.(newCycles);
  };

  const isDark = theme === 'dark';

  // Mouse-wheel zoom on oscilloscope canvas to adjust visible cycle window
  useEffect(() => {
    const handleOscWheel = (e: WheelEvent) => {
      e.preventDefault();
      const step = Math.abs(e.deltaY) > 50 ? 2 : 1;
      const delta = e.deltaY < 0 ? -step : step;
      handleCyclesChange(Math.min(100, Math.max(1, cycles + delta)));
    };

    const handleTrendWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };

    const c1 = oscCanvasRef.current;
    const c2 = trendCanvasRef.current;
    c1?.addEventListener('wheel', handleOscWheel, { passive: false });
    c2?.addEventListener('wheel', handleTrendWheel, { passive: false });
    return () => {
      c1?.removeEventListener('wheel', handleOscWheel);
      c2?.removeEventListener('wheel', handleTrendWheel);
    };
  }, [cycles, viewMode]);

  // 1. Oscilloscope Canvas (3-cycle continuous waveform + True RMS & SCADA RMS level lines)
  useEffect(() => {
    if (viewMode === 'trend') return;
    const canvas = oscCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (width === 0 || height === 0) return;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    ctx.save();
    ctx.scale(dpr, dpr);

    const padding = { top: 22, right: 30, bottom: 32, left: 54 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    // Background
    ctx.fillStyle = isDark ? '#080c14' : '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // Waveform data for user-selected number of cycles
    const { points, windowDurationMs, yMin, yMax } = generateWaveformData(
      state,
      state.playback?.currentTime ?? 0,
      cycles
    );

    const xToCanvas = (tMs: number) => padding.left + (tMs / windowDurationMs) * plotWidth;
    const yToCanvas = (yVal: number) => {
      const normalized = (yVal - yMin) / (yMax - yMin);
      return padding.top + (1 - normalized) * plotHeight;
    };

    // Time Grid (Vertical)
    const numTimeDivs = 6;
    for (let i = 0; i <= numTimeDivs; i++) {
      const tMs = (i / numTimeDivs) * windowDurationMs;
      const x = xToCanvas(tMs);

      ctx.beginPath();
      ctx.strokeStyle = isDark
        ? i === 0 || i === numTimeDivs ? '#1e293b' : '#121a28'
        : i === 0 || i === numTimeDivs ? '#cbd5e1' : '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + plotHeight);
      ctx.stroke();

      ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const labelStr =
        windowDurationMs >= 1000
          ? `${(tMs / 1000).toFixed(2)}s`
          : windowDurationMs >= 100
          ? `${tMs.toFixed(0)} ms`
          : `${tMs.toFixed(1)} ms`;
      ctx.fillText(labelStr, x, padding.top + plotHeight + 6);
    }

    // Amplitude Grid (Horizontal: -2.0 to +2.0 pu)
    const vSteps = [-2.0, -1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5, 2.0];
    for (const v of vSteps) {
      const y = yToCanvas(v);

      ctx.beginPath();
      if (v === 0) {
        ctx.strokeStyle = isDark ? '#334155' : '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
      } else {
        ctx.strokeStyle = isDark ? '#121a28' : '#f1f5f9';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
      }
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + plotWidth, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = v === 0
        ? isDark ? '#94a3b8' : '#475569'
        : isDark ? '#475569' : '#94a3b8';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText((v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)) + ' pu', padding.left - 8, y);
    }

    // Outer plot border
    ctx.strokeStyle = isDark ? '#1e293b' : '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(padding.left, padding.top, plotWidth, plotHeight);

    // Continuous Primary Waveform Trace
    const waveColor = isDark ? '#00f0ff' : '#0284c7';
    ctx.save();
    if (isDark) {
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 6;
    }
    ctx.beginPath();
    ctx.strokeStyle = waveColor;
    ctx.lineWidth = 2.0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const x = xToCanvas(p.tRelativeMs);
      const y = yToCanvas(p.y);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // TRUE RMS Horizontal Reference Line (Continuous, Cyan/Emerald)
    const trueRmsY = yToCanvas(telemetry.trueRms);
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = isDark ? '#10b981' : '#059669';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([5, 3]);
    ctx.moveTo(padding.left, trueRmsY);
    ctx.lineTo(padding.left + plotWidth, trueRmsY);
    ctx.stroke();

    // Badge label on True RMS Line
    ctx.setLineDash([]);
    ctx.fillStyle = isDark ? '#10b981' : '#059669';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(
      `--- True RMS: ${telemetry.trueRms.toFixed(2)} pu (Continuous)`,
      padding.left + 8,
      Math.max(padding.top + 12, trueRmsY - 6)
    );
    ctx.restore();

    // SCADA RMS Horizontal Reference Line (Discrete Sample & Hold, Amber/Orange)
    const scadaRmsY = yToCanvas(telemetry.scadaRms);
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = isDark ? '#f59e0b' : '#d97706';
    ctx.lineWidth = 2.2;
    ctx.setLineDash([8, 4]);
    ctx.moveTo(padding.left, scadaRmsY);
    ctx.lineTo(padding.left + plotWidth, scadaRmsY);
    ctx.stroke();

    // Flash animation on SCADA update
    if (telemetry.isJustUpdated) {
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3.5;
      ctx.stroke();
    }

    // Badge label on SCADA RMS Line
    ctx.setLineDash([]);
    ctx.fillStyle = isDark ? '#fbbf24' : '#b45309';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(
      `--- SCADA RMS: ${telemetry.scadaRms.toFixed(2)} pu [Held: ${telemetry.intervalSec}s]`,
      padding.left + plotWidth - 8,
      Math.max(padding.top + 12, scadaRmsY + 12)
    );
    ctx.restore();

    // Axis Labels
    ctx.fillStyle = '#64748b';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('AMPLITUDE (pu)', padding.left, 14);

    ctx.textAlign = 'right';
    ctx.fillText('TIME (ms)', padding.left + plotWidth, padding.top + plotHeight + 25);

    ctx.restore();
  }, [state, telemetry, isDark, viewMode, cycles]);

  // 2. SCADA Telemetry Trend Timeline Canvas (True RMS continuous curve vs SCADA RMS stair-step)
  useEffect(() => {
    if (viewMode === 'oscilloscope') return;
    const canvas = trendCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (width === 0 || height === 0) return;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    ctx.save();
    ctx.scale(dpr, dpr);

    const padding = { top: 20, right: 30, bottom: 26, left: 54 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    ctx.fillStyle = isDark ? '#080c14' : '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // Determine time window (last 20 to 30 seconds of sim time)
    const currentTime = state.playback?.currentTime ?? 0;
    const windowSpanSec = Math.max(15, telemetry.intervalSec * 4);
    const windowStartSec = Math.max(0, currentTime - windowSpanSec);
    const windowEndSec = windowStartSec + windowSpanSec;

    const xToTrend = (tSec: number) => {
      const frac = (tSec - windowStartSec) / (windowEndSec - windowStartSec);
      return padding.left + frac * plotWidth;
    };

    const yMin = 0.0;
    const yMax = 2.0;
    const yToTrend = (v: number) => {
      const normalized = (v - yMin) / (yMax - yMin);
      return padding.top + (1 - normalized) * plotHeight;
    };

    // Grid - Horizontal RMS steps (0.0 to 2.0 pu)
    const vSteps = [0.0, 0.5, 1.0, 1.5, 2.0];
    for (const v of vSteps) {
      const y = yToTrend(v);
      ctx.beginPath();
      ctx.strokeStyle = isDark ? '#141d2e' : '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + plotWidth, y);
      ctx.stroke();

      ctx.fillStyle = isDark ? '#475569' : '#94a3b8';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${v.toFixed(1)} pu`, padding.left - 6, y);
    }

    // Grid - Vertical Time (seconds)
    const numDivs = 5;
    for (let i = 0; i <= numDivs; i++) {
      const t = windowStartSec + (i / numDivs) * (windowEndSec - windowStartSec);
      const x = xToTrend(t);

      ctx.beginPath();
      ctx.strokeStyle = isDark ? '#141d2e' : '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + plotHeight);
      ctx.stroke();

      ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${t.toFixed(1)}s`, x, padding.top + plotHeight + 4);
    }

    // Border
    ctx.strokeStyle = isDark ? '#1e293b' : '#cbd5e1';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(padding.left, padding.top, plotWidth, plotHeight);

    // Filter visible history points
    const visiblePoints = history.filter(
      (h) => h.simTimeSec >= windowStartSec - 1 && h.simTimeSec <= windowEndSec + 1
    );

    // 1. Draw CONTINUOUS True RMS Line (Cyan/Emerald)
    if (visiblePoints.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = isDark ? '#10b981' : '#059669';
      ctx.lineWidth = 2.0;
      let started = false;
      for (const pt of visiblePoints) {
        const x = xToTrend(pt.simTimeSec);
        const y = yToTrend(pt.trueRms);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    // 2. Draw DISCRETE SCADA RMS Staircase (Zero-Order Hold, Amber)
    if (visiblePoints.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = isDark ? '#f59e0b' : '#d97706';
      ctx.lineWidth = 2.2;
      let prevX = xToTrend(visiblePoints[0].simTimeSec);
      let prevY = yToTrend(visiblePoints[0].scadaRms);
      ctx.moveTo(prevX, prevY);

      for (let i = 1; i < visiblePoints.length; i++) {
        const pt = visiblePoints[i];
        const nextX = xToTrend(pt.simTimeSec);
        const nextY = yToTrend(pt.scadaRms);
        // Step line (horizontal then vertical jump)
        ctx.lineTo(nextX, prevY);
        ctx.lineTo(nextX, nextY);
        prevX = nextX;
        prevY = nextY;
      }
      ctx.stroke();

      // Draw Sample Markers (dots where SCADA poll occurred)
      for (const pt of visiblePoints) {
        if (pt.isSamplePoint) {
          const x = xToTrend(pt.simTimeSec);
          const y = yToTrend(pt.scadaRms);

          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#f59e0b';
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = isDark ? '#080c14' : '#ffffff';
          ctx.stroke();
        }
      }
    }

    // Title / Legend inside canvas
    ctx.fillStyle = '#64748b';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('RMS TELEMETRY TREND OVER TIME', padding.left, 12);

    ctx.restore();
  }, [history, state.playback?.currentTime, telemetry.intervalSec, isDark, viewMode]);

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-white dark:bg-[#080c14]">
      {/* Telemetry Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800/80 px-3 py-1.5 bg-slate-50 dark:bg-[#0b101b]/95 text-[11px] font-mono text-slate-700 dark:text-slate-300 shrink-0 gap-2">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {/* Signal Indicator */}
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-500 animate-pulse" />
            <span className="text-slate-400">f₀:</span>
            <span className="font-bold text-cyan-600 dark:text-cyan-300">{state.fundamentalFrequency} Hz</span>
          </div>

          {/* True RMS (Continuous) */}
          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded text-emerald-700 dark:text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-bold">True RMS:</span>
            <span className="font-bold">{telemetry.trueRms.toFixed(3)} pu</span>
            <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 hidden md:inline">(Continuous)</span>
          </div>

          {/* SCADA RMS (Discrete Held) */}
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition-all ${
              telemetry.isJustUpdated
                ? 'bg-amber-400/30 border-amber-400 text-amber-900 dark:text-amber-200 scale-105 shadow-md shadow-amber-500/30'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
            }`}
          >
            <Radio className="w-3 h-3 text-amber-500" />
            <span className="font-bold">SCADA RMS:</span>
            <span className="font-bold">{telemetry.scadaRms.toFixed(3)} pu</span>
            <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 hidden md:inline">[Held]</span>
          </div>

          {/* Telemetry Discrepancy */}
          {telemetry.deltaError > 0.005 && (
            <div className="flex items-center gap-1 text-[10px] text-rose-600 dark:text-rose-400 font-semibold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
              <span>Δ Lag:</span>
              <span>{(telemetry.deltaError >= 0 ? '+' : '') + telemetry.deltaError.toFixed(3)} pu</span>
            </div>
          )}
        </div>

        {/* Right Info & View Mode Toggle */}
        <div className="flex items-center gap-2 text-[10px] flex-wrap">
          {/* User-Controlled Waveform Window Size */}
          {(viewMode === 'split' || viewMode === 'oscilloscope') && (
            <WaveformWindowControl
              cycles={cycles}
              onCyclesChange={handleCyclesChange}
              fundamentalFrequency={state.fundamentalFrequency}
              theme={theme}
            />
          )}

          {/* Next Poll Countdown */}
          <div className="flex items-center gap-1 bg-slate-200/60 dark:bg-slate-800/80 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700/60">
            <Clock className="w-3 h-3 text-slate-400" />
            <span className="text-slate-400">Next Poll:</span>
            <span className="font-bold text-amber-600 dark:text-amber-400">
              {state.playback?.isPlaying ? `${telemetry.countdownSec.toFixed(1)}s` : 'Paused'}
            </span>
          </div>

          {/* View Mode Switcher */}
          <div className="hidden sm:flex items-center bg-slate-200/60 dark:bg-slate-800/80 rounded p-0.5 border border-slate-300 dark:border-slate-700/60 text-[10px]">
            <button
              onClick={() => setViewMode('split')}
              className={`px-1.5 py-0.5 rounded ${
                viewMode === 'split' ? 'bg-white dark:bg-slate-700 font-bold text-cyan-600 dark:text-cyan-300' : 'text-slate-400'
              }`}
            >
              Split
            </button>
            <button
              onClick={() => setViewMode('oscilloscope')}
              className={`px-1.5 py-0.5 rounded ${
                viewMode === 'oscilloscope' ? 'bg-white dark:bg-slate-700 font-bold text-cyan-600 dark:text-cyan-300' : 'text-slate-400'
              }`}
            >
              Waveform
            </button>
            <button
              onClick={() => setViewMode('trend')}
              className={`px-1.5 py-0.5 rounded ${
                viewMode === 'trend' ? 'bg-white dark:bg-slate-700 font-bold text-cyan-600 dark:text-cyan-300' : 'text-slate-400'
              }`}
            >
              Trend
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas Plot Container */}
      <div className="relative flex-1 w-full min-h-0 flex flex-col">
        {/* Oscilloscope View */}
        {(viewMode === 'split' || viewMode === 'oscilloscope') && (
          <div className={`relative w-full ${viewMode === 'split' ? 'flex-[1.3] border-b border-slate-200 dark:border-slate-800/80' : 'h-full'} min-h-[140px]`}>
            <canvas
              ref={oscCanvasRef}
              className="w-full h-full block"
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        )}

        {/* Telemetry Trend History View */}
        {(viewMode === 'split' || viewMode === 'trend') && (
          <div className={`relative w-full ${viewMode === 'split' ? 'flex-1' : 'h-full'} min-h-[100px]`}>
            <canvas
              ref={trendCanvasRef}
              className="w-full h-full block"
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        )}
      </div>

      {/* Visual Flow Legend: Actual waveform -> Continuously calculated True RMS -> Discrete SCADA RMS updates */}
      <div className="border-t border-slate-200 dark:border-slate-800/80 px-3 py-1 bg-slate-50/80 dark:bg-[#070b12] text-[10px] font-mono flex items-center justify-between text-slate-500 dark:text-slate-400 shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Signal Chain:</span>
          <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400">
            <span className="w-2 h-0.5 bg-cyan-400 inline-block"></span> Actual Waveform x(t)
          </span>
          <span>→</span>
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
            <span className="w-2 h-0.5 bg-emerald-400 inline-block"></span> Continuous True RMS
          </span>
          <span>→</span>
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span> Discrete SCADA RMS ({telemetry.intervalSec}s Hold)
          </span>
        </div>

        <div className="hidden lg:flex items-center gap-1.5 text-slate-400 text-[10px]">
          <span>Rate: {telemetry.rateHz >= 1 ? `${telemetry.rateHz} Hz` : `${telemetry.rateHz.toFixed(2)} Hz`}</span>
          <span>•</span>
          <span>Samples: {telemetry.sampleCount}</span>
        </div>
      </div>
    </div>
  );
};
