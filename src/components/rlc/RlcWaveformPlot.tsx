import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  RlcCircuitConfig,
  RlcCircuitMetrics,
  RlcTraceVisibility,
  RlcTopologyConfig,
  RlcSimulationMode,
  RlcTransientState,
  DEFAULT_RLC_TOPOLOGY,
} from '../../types/rlcCircuit';
import { AppTheme } from '../../types/settings';
import { generateRlcWaveformPoints } from '../../model/rlcCircuitModel';
import { solveRlcTransient } from '../../model/rlcTransientModel';

interface RlcWaveformPlotProps {
  config: RlcCircuitConfig;
  topology?: RlcTopologyConfig;
  metrics: RlcCircuitMetrics;
  traces: RlcTraceVisibility;
  onToggleTrace: (key: keyof RlcTraceVisibility) => void;
  theme?: AppTheme;
  currentTimeSec?: number;
  visibleCycles?: number;
  simulationMode?: RlcSimulationMode;
  transientState?: RlcTransientState;
}

export const RlcWaveformPlot: React.FC<RlcWaveformPlotProps> = ({
  config,
  topology = DEFAULT_RLC_TOPOLOGY,
  metrics,
  traces,
  onToggleTrace,
  theme = 'dark',
  currentTimeSec = 0,
  visibleCycles = 3,
  simulationMode = 'steady',
  transientState,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [, setDimensions] = useState({ width: 0, height: 0 });

  const isDark = theme === 'dark';

  // Responsive container observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const drawPlot = useCallback(() => {
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

    const padding = { top: 22, right: 54, bottom: 28, left: 54 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    // Background
    ctx.fillStyle = isDark ? '#080c14' : '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // Compute sample points according to mode
    let points: ReturnType<typeof solveRlcTransient>['points'] = [];
    let windowDurationMs = 50;
    let steadyStateReferencePoints: ReturnType<typeof solveRlcTransient>['steadyStateReferencePoints'];

    if (simulationMode === 'transient') {
      const trajectory = solveRlcTransient(
        config,
        topology,
        transientState?.initialConditions,
        transientState?.timeSec ?? 0,
        transientState?.visibleTimeWindowMs ?? 50,
        700,
        transientState?.overlaySteadyState ?? false
      );
      points = trajectory.points;
      windowDurationMs = trajectory.windowDurationMs;
      steadyStateReferencePoints = trajectory.steadyStateReferencePoints;
    } else {
      const res = generateRlcWaveformPoints(
        config,
        currentTimeSec,
        visibleCycles,
        700,
        topology
      );
      points = res.points;
      windowDurationMs = res.windowDurationMs;
    }

    // Dynamic Range scaling
    const isUnbounded = metrics.isUnboundedCurrent;
    const isOpen = metrics.isOpenCircuit;

    let maxVPt = metrics.vSourcePeak;
    let maxIPt = isUnbounded || isOpen ? 1 : metrics.iPeak;

    points.forEach((p) => {
      if (Math.abs(p.vSource) > maxVPt) maxVPt = Math.abs(p.vSource);
      if (Math.abs(p.vResistor) > maxVPt) maxVPt = Math.abs(p.vResistor);
      if (Math.abs(p.vInductor) > maxVPt) maxVPt = Math.abs(p.vInductor);
      if (Math.abs(p.vCapacitor) > maxVPt) maxVPt = Math.abs(p.vCapacitor);
      if (!isUnbounded && !isOpen && Math.abs(p.current) > maxIPt) maxIPt = Math.abs(p.current);
    });

    const maxVoltagePeak = Math.max(maxVPt, 0.1);
    const vYLimit =
      maxVoltagePeak < 10 ? maxVoltagePeak * 1.25 : Math.ceil(maxVoltagePeak * 1.15);

    const maxCurrentPeak = isUnbounded || isOpen ? 1 : Math.max(maxIPt, 0.05);
    const iYLimit = maxCurrentPeak * 1.25;

    // Coordinate mapping functions
    const timeToX = (tRelMs: number) =>
      padding.left + (tRelMs / windowDurationMs) * plotWidth;

    const vToY = (v: number) =>
      padding.top + plotHeight / 2 - (v / vYLimit) * (plotHeight / 2);

    const iToY = (i: number) =>
      padding.top + plotHeight / 2 - (i / iYLimit) * (plotHeight / 2);

    // 1. Grid Lines & Ticks
    const gridColor = isDark ? '#1e293b' : '#e2e8f0';
    const axisColor = isDark ? '#334155' : '#cbd5e1';
    const textDim = isDark ? '#64748b' : '#94a3b8';

    // Outer Bounding Box
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(padding.left, padding.top, plotWidth, plotHeight);

    // Horizontal Zero Baseline
    const yZero = padding.top + plotHeight / 2;
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(padding.left, yZero);
    ctx.lineTo(padding.left + plotWidth, yZero);
    ctx.stroke();

    // Horizontal Voltage Division Lines (±0.5)
    [-0.5, 0.5].forEach((frac) => {
      const y = padding.top + plotHeight / 2 - frac * (plotHeight / 2);
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + plotWidth, y);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // Vertical Time Grid Division Lines
    const numDivs = 4;
    for (let d = 1; d < numDivs; d++) {
      const x = padding.left + (d / numDivs) * plotWidth;
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 0.8;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + plotHeight);
      ctx.stroke();
      ctx.setLineDash([]);

      const divMs = (d / numDivs) * windowDurationMs;
      ctx.fillStyle = textDim;
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${divMs.toFixed(1)}ms`, x, padding.top + plotHeight + 11);
    }

    // Left Y-Axis Labels: Voltage (V)
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = isDark ? '#38bdf8' : '#0284c7';
    const vLabelStr = vYLimit < 10 ? vYLimit.toFixed(2) : vYLimit.toFixed(0);
    ctx.fillText(`+${vLabelStr}V`, padding.left - 6, padding.top + 4);
    ctx.fillText(`0V`, padding.left - 6, yZero + 3);
    ctx.fillText(`-${vLabelStr}V`, padding.left - 6, padding.top + plotHeight);

    ctx.save();
    ctx.translate(14, padding.top + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = isDark ? '#38bdf8' : '#0284c7';
    ctx.fillText('Voltage (V)', 0, 0);
    ctx.restore();

    // Right Y-Axis Labels: Current (A)
    ctx.textAlign = 'left';
    ctx.fillStyle = isDark ? '#34d399' : '#059669';
    if (isUnbounded) {
      ctx.fillText('∞', padding.left + plotWidth + 6, padding.top + 4);
      ctx.fillText('0A', padding.left + plotWidth + 6, yZero + 3);
      ctx.fillText('-∞', padding.left + plotWidth + 6, padding.top + plotHeight);
    } else if (isOpen) {
      ctx.fillText('+0.0A', padding.left + plotWidth + 6, padding.top + 4);
      ctx.fillText('0A', padding.left + plotWidth + 6, yZero + 3);
      ctx.fillText('-0.0A', padding.left + plotWidth + 6, padding.top + plotHeight);
    } else {
      ctx.fillText(`+${iYLimit.toFixed(2)}A`, padding.left + plotWidth + 6, padding.top + 4);
      ctx.fillText('0A', padding.left + plotWidth + 6, yZero + 3);
      ctx.fillText(`-${iYLimit.toFixed(2)}A`, padding.left + plotWidth + 6, padding.top + plotHeight);
    }

    ctx.save();
    ctx.translate(width - 12, padding.top + plotHeight / 2);
    ctx.rotate(Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = isDark ? '#34d399' : '#059669';
    ctx.fillText(isUnbounded ? 'Current (Unbounded)' : isOpen ? 'Current (0 A)' : 'Current (A)', 0, 0);
    ctx.restore();

    // Horizontal Time Axis Boundaries
    ctx.fillStyle = textDim;
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('0 ms', padding.left, padding.top + plotHeight + 11);
    ctx.textAlign = 'right';
    ctx.fillText(
      `${windowDurationMs.toFixed(1)} ms`,
      padding.left + plotWidth,
      padding.top + plotHeight + 11
    );

    // 2. Draw Waveform Traces
    const drawTrace = (
      getY: (pt: (typeof points)[0]) => number,
      color: string,
      lineWidth: number = 2,
      isDashed: boolean = false
    ) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      if (isDashed) {
        ctx.setLineDash([5, 4]);
      } else {
        ctx.setLineDash([]);
      }

      points.forEach((pt, idx) => {
        const x = timeToX(pt.tRelativeMs);
        const y = getY(pt);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    };

    // Optional: Draw dashed steady-state reference overlays
    if (steadyStateReferencePoints && simulationMode === 'transient') {
      ctx.save();
      ctx.setLineDash([4, 4]);

      if (traces.current) {
        ctx.strokeStyle = isDark ? '#06b6d480' : '#0891b280';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        steadyStateReferencePoints.forEach((p, idx) => {
          const x = timeToX(p.tRelativeMs);
          const y = iToY(p.currentSs);
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }

      if (traces.vCapacitor) {
        ctx.strokeStyle = isDark ? '#a855f780' : '#9333ea80';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        steadyStateReferencePoints.forEach((p, idx) => {
          const x = timeToX(p.tRelativeMs);
          const y = vToY(p.vCapacitorSs);
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }

      ctx.restore();
    }

    // Resistor Voltage v_R(t)
    if (traces.vResistor && !isUnbounded) {
      drawTrace((pt) => vToY(pt.vResistor), '#10b981', 1.8);
    }

    // Inductor Voltage v_L(t)
    if (traces.vInductor && !isUnbounded) {
      drawTrace((pt) => vToY(pt.vInductor), '#f59e0b', 1.8);
    }

    // Capacitor Voltage v_C(t)
    if (traces.vCapacitor && !isUnbounded) {
      drawTrace((pt) => vToY(pt.vCapacitor), '#a855f7', 2.0);
    }

    // Source Voltage v_s(t)
    if (traces.vSource) {
      drawTrace((pt) => vToY(pt.vSource), '#38bdf8', 2.2);
    }

    // Current i(t)
    if (traces.current && !isUnbounded) {
      drawTrace((pt) => iToY(pt.current), '#06b6d4', 2.2);
    }

    // 3. Unbounded Current Warning Overlay (Canvas-safe)
    if (isUnbounded) {
      ctx.save();
      ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(
        padding.left + plotWidth * 0.15,
        padding.top + plotHeight * 0.25,
        plotWidth * 0.7,
        plotHeight * 0.5
      );

      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(
        padding.left + plotWidth * 0.15,
        padding.top + plotHeight * 0.25,
        plotWidth * 0.7,
        plotHeight * 0.5
      );

      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        'THEORETICAL CURRENT UNBOUNDED (|Z| = 0 Ω)',
        padding.left + plotWidth * 0.5,
        padding.top + plotHeight * 0.45
      );

      ctx.fillStyle = textDim;
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(
        'Ideal zero impedance allows infinite theoretical current.',
        padding.left + plotWidth * 0.5,
        padding.top + plotHeight * 0.55
      );
      ctx.fillText(
        'Source voltage trace v_s(t) remains visible.',
        padding.left + plotWidth * 0.5,
        padding.top + plotHeight * 0.65
      );
      ctx.restore();
    }

    ctx.restore();
  }, [
    config,
    topology,
    metrics,
    traces,
    isDark,
    currentTimeSec,
    visibleCycles,
    simulationMode,
    transientState,
  ]);

  useEffect(() => {
    drawPlot();
  }, [drawPlot]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex flex-col justify-between overflow-hidden select-none"
    >
      {/* Top Controls / Legend Bar */}
      <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#080c14]/80 backdrop-blur-sm z-10 text-[11px] font-mono">
        <span className="font-bold text-slate-700 dark:text-slate-300">
          {simulationMode === 'transient' ? 'Transient Waveforms' : 'Steady-State Waveforms'}
        </span>

        {/* Trace Visibility Toggles */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => onToggleTrace('vSource')}
            className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
              traces.vSource
                ? 'bg-sky-500/20 text-sky-600 dark:text-sky-300 border-sky-500/40 font-semibold'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800 opacity-60'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-sky-500" />
            <span>v_s (Source)</span>
          </button>

          <button
            onClick={() => onToggleTrace('current')}
            className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
              traces.current
                ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border-cyan-500/40 font-semibold'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800 opacity-60'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-500" />
            <span>i(t) (Current)</span>
          </button>

          <button
            onClick={() => onToggleTrace('vResistor')}
            className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
              traces.vResistor
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/40 font-semibold'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800 opacity-60'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>v_R</span>
          </button>

          <button
            onClick={() => onToggleTrace('vInductor')}
            className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
              traces.vInductor
                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/40 font-semibold'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800 opacity-60'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>v_L</span>
          </button>

          <button
            onClick={() => onToggleTrace('vCapacitor')}
            className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
              traces.vCapacitor
                ? 'bg-purple-500/20 text-purple-600 dark:text-purple-300 border-purple-500/40 font-semibold'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800 opacity-60'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span>v_C</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 w-full h-full min-h-0">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
    </div>
  );
};
