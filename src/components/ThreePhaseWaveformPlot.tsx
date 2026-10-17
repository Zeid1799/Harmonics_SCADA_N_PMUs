import React, { useRef, useEffect, useMemo } from 'react';
import { ThreePhaseState } from '../types/threePhase';
import { AppTheme } from '../types/settings';
import { generateThreePhasePoints, computeThreePhaseMetrics } from '../model/threePhaseModel';

interface ThreePhaseWaveformPlotProps {
  state: ThreePhaseState;
  theme?: AppTheme;
  currentTimeSec?: number;
}

export const ThreePhaseWaveformPlot: React.FC<ThreePhaseWaveformPlotProps> = ({
  state,
  theme = 'dark',
  currentTimeSec = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isDark = theme === 'dark';

  const metrics = useMemo(() => computeThreePhaseMetrics(state), [
    state.phaseA,
    state.phaseB,
    state.phaseC,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
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

    const padding = { top: 28, right: 32, bottom: 38, left: 54 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    // Background
    ctx.fillStyle = isDark ? '#080c14' : '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // Generate sample points
    const { points, windowDurationMs } = generateThreePhasePoints(
      state,
      currentTimeSec,
      3,
      800
    );

    // Compute dynamic y-range depending on what's plotted
    let maxVal = 2.2;
    if (state.signalDisplay === 'current') {
      const maxCurrent = points.reduce(
        (acc, p) => Math.max(acc, Math.abs(p.iA), Math.abs(p.iB), Math.abs(p.iC), Math.abs(p.iN)),
        0.2
      );
      maxVal = Math.max(0.2, maxCurrent * 1.25);
    } else if (state.signalDisplay === 'both') {
      const maxCurrent = points.reduce(
        (acc, p) => Math.max(acc, Math.abs(p.iA), Math.abs(p.iB), Math.abs(p.iC), Math.abs(p.iN)),
        0.2
      );
      maxVal = Math.max(2.2, maxCurrent * 1.2);
    }

    const yMin = -maxVal;
    const yMax = maxVal;

    const xToCanvas = (tMs: number) => padding.left + (tMs / windowDurationMs) * plotWidth;
    const yToCanvas = (val: number) => {
      const normalized = (val - yMin) / (yMax - yMin);
      return padding.top + (1 - normalized) * plotHeight;
    };

    // 1. Grid Lines
    // Time divisions
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

      // Time axis label
      ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${tMs.toFixed(1)} ms`, x, padding.top + plotHeight + 6);
    }

    // Horizontal grid
    const vSteps = [-2.0, -1.0, 0.0, 1.0, 2.0];
    const stepsToUse = state.signalDisplay === 'current'
      ? [-maxVal * 0.8, -maxVal * 0.4, 0, maxVal * 0.4, maxVal * 0.8]
      : vSteps;

    for (const v of stepsToUse) {
      const y = yToCanvas(v);

      ctx.beginPath();
      if (Math.abs(v) < 0.001) {
        ctx.strokeStyle = isDark ? '#475569' : '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
      } else {
        ctx.strokeStyle = isDark ? '#141d2e' : '#f1f5f9';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
      }
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + plotWidth, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const label = state.signalDisplay === 'current'
        ? `${v.toFixed(2)} A`
        : `${v.toFixed(1)} pu`;
      ctx.fillText(label, padding.left - 8, y);
    }

    // Outer border
    ctx.strokeStyle = isDark ? '#1e293b' : '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(padding.left, padding.top, plotWidth, plotHeight);

    // 2. Draw Voltage Waveforms
    if (state.signalDisplay === 'voltage' || state.signalDisplay === 'both') {
      const lineW = state.signalDisplay === 'both' ? 1.8 : 2.2;

      // Phase A (Red: #ef4444)
      if (state.phaseA.enabled) {
        drawTrace(ctx, points, (p) => p.vA, xToCanvas, yToCanvas, '#ef4444', lineW, []);
      }
      // Phase B (Yellow: #eab308)
      if (state.phaseB.enabled) {
        drawTrace(ctx, points, (p) => p.vB, xToCanvas, yToCanvas, '#eab308', lineW, []);
      }
      // Phase C (Blue: #3b82f6)
      if (state.phaseC.enabled) {
        drawTrace(ctx, points, (p) => p.vC, xToCanvas, yToCanvas, '#3b82f6', lineW, []);
      }

      // Voltage Sum trace (dashed cyan-gray): vA + vB + vC
      drawTrace(ctx, points, (p) => p.vSum, xToCanvas, yToCanvas, isDark ? '#38bdf888' : '#0284c788', 1.5, [4, 3]);
    }

    // 3. Draw Current Waveforms & Neutral Current
    if (state.signalDisplay === 'current' || state.signalDisplay === 'both') {
      const isBoth = state.signalDisplay === 'both';
      const currentDash = isBoth ? [3, 2] : [];

      if (state.phaseA.enabled) {
        drawTrace(ctx, points, (p) => p.iA, xToCanvas, yToCanvas, '#f87171', isBoth ? 1.4 : 2.0, currentDash);
      }
      if (state.phaseB.enabled) {
        drawTrace(ctx, points, (p) => p.iB, xToCanvas, yToCanvas, '#facc15', isBoth ? 1.4 : 2.0, currentDash);
      }
      if (state.phaseC.enabled) {
        drawTrace(ctx, points, (p) => p.iC, xToCanvas, yToCanvas, '#60a5fa', isBoth ? 1.4 : 2.0, currentDash);
      }

      // Neutral Current iN(t) - Highlighted in Purple (#c084fc / #9333ea) with prominent glow
      ctx.save();
      if (isDark) {
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 6;
      }
      drawTrace(ctx, points, (p) => p.iN, xToCanvas, yToCanvas, '#c084fc', 2.5, []);
      ctx.restore();
    }

    // 4. Axis Labels
    ctx.fillStyle = isDark ? '#64748b' : '#64748b';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    const axisTitle = state.signalDisplay === 'current'
      ? 'CURRENT (A)'
      : state.signalDisplay === 'voltage'
      ? 'VOLTAGE (pu)'
      : 'MAGNITUDE (pu / A)';
    ctx.fillText(axisTitle, padding.left, 16);

    ctx.textAlign = 'right';
    ctx.fillText('TIME (ms)', padding.left + plotWidth, padding.top + plotHeight + 30);

    ctx.restore();
  }, [state, theme, isDark, currentTimeSec, metrics]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex flex-col overflow-hidden bg-white dark:bg-[#080c14]"
    >
      {/* Top Legend & Telemetry Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800/80 px-3 py-1.5 bg-slate-50 dark:bg-[#0b101b]/90 text-[11px] font-mono text-slate-700 dark:text-slate-300 shrink-0 gap-2">
        {/* Phase Color Badges */}
        <div className="flex items-center gap-3">
          {/* Phase A */}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0"></span>
            <span className="font-bold text-red-600 dark:text-red-400">Phase A</span>
            <span className="text-[10px] text-slate-500">
              ({state.phaseA.amplitude.toFixed(2)} pu, {state.phaseA.phaseDeg}°)
            </span>
          </div>

          {/* Phase B */}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 shrink-0"></span>
            <span className="font-bold text-yellow-600 dark:text-yellow-400">Phase B</span>
            <span className="text-[10px] text-slate-500">
              ({state.phaseB.amplitude.toFixed(2)} pu, {state.phaseB.phaseDeg}°)
            </span>
          </div>

          {/* Phase C */}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"></span>
            <span className="font-bold text-blue-600 dark:text-blue-400">Phase C</span>
            <span className="text-[10px] text-slate-500">
              ({state.phaseC.amplitude.toFixed(2)} pu, {state.phaseC.phaseDeg}°)
            </span>
          </div>

          {/* Neutral Current */}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0"></span>
            <span className="font-bold text-purple-600 dark:text-purple-400">Neutral i_N</span>
            <span className="text-[10px] text-slate-500">
              ({metrics.iN_Rms.toFixed(2)} A RMS)
            </span>
          </div>
        </div>

        {/* System Balance Status Pill */}
        <div className="flex items-center gap-2 text-[10px]">
          <span
            className={`px-2 py-0.5 rounded border font-semibold uppercase tracking-wider ${
              metrics.isSystemBalanced
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
            }`}
          >
            {metrics.isSystemBalanced ? '● Balanced System' : '▲ Unbalanced'}
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
  points: any[],
  getY: (p: any) => number,
  xToCanvas: (tMs: number) => number,
  yToCanvas: (val: number) => number,
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
