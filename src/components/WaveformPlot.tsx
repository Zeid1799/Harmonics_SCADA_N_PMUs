import React, { useRef, useEffect, useMemo, useState } from 'react';
import { WaveformState } from '../types/waveform';
import { AppTheme } from '../types/settings';
import { generateWaveformData } from '../model/waveformGenerator';
import { computeTelemetry } from '../model/waveformModel';
import { WaveformWindowControl } from './WaveformWindowControl';

interface WaveformPlotProps {
  state: WaveformState;
  theme?: AppTheme;
  showHarmonicsBreakdown?: boolean;
  visibleCycles?: number;
  onCyclesChange?: (cycles: number) => void;
}

export const WaveformPlot: React.FC<WaveformPlotProps> = ({
  state,
  theme = 'dark',
  showHarmonicsBreakdown = false,
  visibleCycles: externalVisibleCycles,
  onCyclesChange: externalOnCyclesChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [internalCycles, setInternalCycles] = useState<number>(state.visibleCycles ?? 3);
  const cycles = externalVisibleCycles ?? state.visibleCycles ?? internalCycles;

  const handleCyclesChange = (newCycles: number) => {
    setInternalCycles(newCycles);
    externalOnCyclesChange?.(newCycles);
  };

  const isDark = theme === 'dark';

  // Compute telemetry metrics (Vpeak, Vrms, THD, Period)
  const telemetry = useMemo(() => computeTelemetry(state), [
    state.fundamentalFrequency,
    state.fundamentalAmplitude,
    state.harmonics?.second,
    state.harmonics?.third,
    state.harmonics?.fourth,
    state.customTerms,
    state.dcOffset,
  ]);

  // Mouse-wheel / trackpad zoom on canvas to adjust visible cycle window
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      // DeltaY < 0 is scroll up (zoom in: fewer cycles)
      // DeltaY > 0 is scroll down (zoom out: more cycles)
      const step = Math.abs(e.deltaY) > 50 ? 2 : 1;
      const delta = e.deltaY < 0 ? -step : step;
      handleCyclesChange(Math.min(100, Math.max(1, cycles + delta)));
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [cycles]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (width === 0 || height === 0) return;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Padding for axes and labels
    const padding = { top: 24, right: 28, bottom: 36, left: 54 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    // Canvas background
    ctx.fillStyle = isDark ? '#080c14' : '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // Generate sample points for user-selected number of cycles
    const { points, windowDurationMs, yMin, yMax } = generateWaveformData(
      state,
      state.playback?.currentTime ?? 0,
      cycles
    );

    const xToCanvas = (tMs: number) => {
      return padding.left + (tMs / windowDurationMs) * plotWidth;
    };

    const yToCanvas = (yVal: number) => {
      const normalized = (yVal - yMin) / (yMax - yMin);
      return padding.top + (1 - normalized) * plotHeight;
    };

    // 1. Grid Lines
    // Vertical Time Grid
    const numTimeDivs = 6;
    for (let i = 0; i <= numTimeDivs; i++) {
      const tMs = (i / numTimeDivs) * windowDurationMs;
      const x = xToCanvas(tMs);

      ctx.beginPath();
      ctx.strokeStyle = isDark
        ? (i === 0 || i === numTimeDivs ? '#1e293b' : '#141d2e')
        : (i === 0 || i === numTimeDivs ? '#cbd5e1' : '#f1f5f9');
      ctx.lineWidth = 1;
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + plotHeight);
      ctx.stroke();

      // Time axis label (formatted nicely based on span)
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

    // Horizontal Amplitude Grid (-2.0 to +2.0 pu at 0.5 intervals)
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

      // Amplitude label
      ctx.fillStyle = v === 0
        ? (isDark ? '#94a3b8' : '#475569')
        : (isDark ? '#475569' : '#94a3b8');
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const labelStr = (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)) + ' pu';
      ctx.fillText(labelStr, padding.left - 8, y);
    }

    // Outer plot border
    ctx.strokeStyle = isDark ? '#1e293b' : '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(padding.left, padding.top, plotWidth, plotHeight);

    // 2. Harmonic Ghost Breakdown
    if (showHarmonicsBreakdown && state.fundamentalAmplitude > 0) {
      drawTrace(ctx, points, (p) => p.yFundamental ?? 0, xToCanvas, yToCanvas, isDark ? '#38bdf844' : '#0284c733', 1.5, [2, 2]);

      const harmonics = state.harmonics || { second: 0, third: 0, fourth: 0 };
      if (harmonics.second > 0) {
        drawTrace(ctx, points, (p) => p.yHarmonic2 ?? 0, xToCanvas, yToCanvas, isDark ? '#a855f766' : '#7c3aed44', 1.5, [3, 3]);
      }
      if (harmonics.third > 0) {
        drawTrace(ctx, points, (p) => p.yHarmonic3 ?? 0, xToCanvas, yToCanvas, isDark ? '#ec489966' : '#db277744', 1.5, [3, 3]);
      }
      if (harmonics.fourth > 0) {
        drawTrace(ctx, points, (p) => p.yHarmonic4 ?? 0, xToCanvas, yToCanvas, isDark ? '#f59e0b66' : '#d9770644', 1.5, [3, 3]);
      }
    }

    // 3. Composite Waveform Primary Trace
    const traceColor = isDark ? '#00f0ff' : '#0284c7';
    if (isDark) {
      ctx.save();
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 8;
      drawTrace(ctx, points, (p) => p.y, xToCanvas, yToCanvas, traceColor, 2.2, []);
      ctx.restore();
      drawTrace(ctx, points, (p) => p.y, xToCanvas, yToCanvas, '#ffffff', 0.9, []);
    } else {
      ctx.save();
      ctx.shadowColor = 'rgba(2, 132, 199, 0.3)';
      ctx.shadowBlur = 4;
      drawTrace(ctx, points, (p) => p.y, xToCanvas, yToCanvas, traceColor, 2.5, []);
      ctx.restore();
    }

    // 4. Axis Title Labels
    ctx.fillStyle = isDark ? '#64748b' : '#64748b';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('AMPLITUDE (pu)', padding.left, 14);

    ctx.textAlign = 'right';
    ctx.fillText('TIME (ms)', padding.left + plotWidth, padding.top + plotHeight + 28);

    ctx.restore();
  }, [state, theme, isDark, showHarmonicsBreakdown, telemetry, cycles]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex flex-col overflow-hidden bg-white dark:bg-[#080c14]"
    >
      {/* Telemetry Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800/80 px-3.5 py-1.5 bg-slate-50 dark:bg-[#0b101b]/90 text-[11px] font-mono text-slate-700 dark:text-slate-300 shrink-0 gap-2">
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-cyan-500 dark:bg-cyan-400 animate-pulse"></span>
            <span className="text-slate-500">f₀:</span>
            <span className="font-bold text-cyan-600 dark:text-cyan-300">{state.fundamentalFrequency} Hz</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-slate-500">T₀:</span>
            <span className="font-semibold">{telemetry.periodMs.toFixed(2)} ms</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-slate-500">V_pk:</span>
            <span className="font-semibold">{telemetry.peakVoltage.toFixed(2)} pu</span>
          </div>

          <div className="flex items-center gap-1 hidden sm:flex">
            <span className="text-slate-500">V_rms:</span>
            <span className="font-semibold">{telemetry.rmsVoltage.toFixed(2)} pu</span>
          </div>

          {telemetry.thdPercent > 0.05 && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500">THD:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">{telemetry.thdPercent.toFixed(1)}%</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 text-[10px]">
          {/* User-Controlled Waveform Window Size */}
          <WaveformWindowControl
            cycles={cycles}
            onCyclesChange={handleCyclesChange}
            fundamentalFrequency={state.fundamentalFrequency}
            theme={theme}
          />

          <span className="flex items-center gap-1 pl-1">
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${
                state.playback?.isPlaying ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-500'
              }`}
            />
            {state.playback?.isPlaying ? (
              <span className="text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-semibold">Running</span>
            ) : (
              <span className="text-slate-400 dark:text-slate-500 uppercase tracking-wider">Stationary</span>
            )}
          </span>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="relative flex-1 w-full min-h-[220px]">
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
};

function drawTrace(
  ctx: CanvasRenderingContext2D,
  points: { tRelativeMs: number; y: number }[],
  getY: (p: any) => number,
  xToCanvas: (tMs: number) => number,
  yToCanvas: (yVal: number) => number,
  strokeColor: string,
  lineWidth: number,
  dash: number[]
) {
  if (points.length === 0) return;

  ctx.beginPath();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash(dash);

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const x = xToCanvas(p.tRelativeMs);
    const y = yToCanvas(getY(p));

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();
  ctx.setLineDash([]);
}
