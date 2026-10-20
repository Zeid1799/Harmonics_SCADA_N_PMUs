import React, { useRef, useEffect, useState } from 'react';
import { WaveformState } from '../../types/waveform';
import { AppTheme } from '../../types/settings';
import { PmuMeasurementSnapshot, InjectedDisturbance, getDisturbanceColor } from '../../types/pmu';
import { generatePmuTimeDomainData } from '../../model/pmuModel';
import { InfoTooltip } from './InfoTooltip';
import { Activity } from 'lucide-react';
import { WaveformWindowControl } from '../WaveformWindowControl';

interface PmuTimeDomainPlotProps {
  state: WaveformState;
  snapshot: PmuMeasurementSnapshot;
  disturbances: InjectedDisturbance[];
  theme?: AppTheme;
  visibleCycles?: number;
  onCyclesChange?: (cycles: number) => void;
}

export const PmuTimeDomainPlot: React.FC<PmuTimeDomainPlotProps> = ({
  state,
  snapshot,
  disturbances,
  theme = 'dark',
  visibleCycles: externalVisibleCycles,
  onCyclesChange: externalOnCyclesChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDark = theme === 'dark';

  const [internalCycles, setInternalCycles] = useState<number>(state.visibleCycles ?? 3);
  const cycles = externalVisibleCycles ?? state.visibleCycles ?? internalCycles;

  const handleCyclesChange = (newCycles: number) => {
    setInternalCycles(newCycles);
    externalOnCyclesChange?.(newCycles);
  };

  // Mouse-wheel zoom on canvas to adjust visible cycle window
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
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

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (width === 0 || height === 0) return;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    ctx.save();
    ctx.scale(dpr, dpr);

    const padding = { top: 22, right: 28, bottom: 32, left: 50 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    // Background
    ctx.fillStyle = isDark ? '#080c14' : '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // Generate waveform data for selected fundamental cycles
    const { points, reportedFrames, windowDurationMs, yMin, yMax } = generatePmuTimeDomainData(
      state,
      snapshot,
      disturbances,
      state.playback?.currentTime ?? 0,
      cycles
    );

    const xToCanvas = (tMs: number) => padding.left + (tMs / windowDurationMs) * plotWidth;
    const yToCanvas = (yVal: number) => {
      const normalized = (yVal - yMin) / (yMax - yMin);
      return padding.top + (1 - normalized) * plotHeight;
    };

    // 1. Time Grid (Vertical)
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
      ctx.font = '9.5px "JetBrains Mono", monospace';
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

    // 2. Amplitude Grid (Horizontal: dynamically generated based on yMin & yMax)
    const span = yMax - yMin;
    const stepSize = span > 6 ? 1.0 : 0.5;
    const vSteps: number[] = [];
    const minStep = Math.ceil(yMin / stepSize) * stepSize;
    const maxStep = Math.floor(yMax / stepSize) * stepSize;
    for (let v = minStep; v <= maxStep + 1e-5; v += stepSize) {
      vSteps.push(Math.round(v * 10) / 10);
    }

    for (const v of vSteps) {
      const y = yToCanvas(v);
      const isZero = Math.abs(v) < 1e-5;

      ctx.beginPath();
      if (isZero) {
        ctx.strokeStyle = isDark ? '#334155' : '#94a3b8';
        ctx.lineWidth = 1.4;
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

      ctx.fillStyle = isZero
        ? isDark ? '#94a3b8' : '#475569'
        : isDark ? '#475569' : '#94a3b8';
      ctx.font = '9.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const labelText = isZero ? '0.0 pu' : (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)) + ' pu';
      ctx.fillText(labelText, padding.left - 6, y);
    }

    // Outer plot border
    ctx.strokeStyle = isDark ? '#1e293b' : '#cbd5e1';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(padding.left, padding.top, plotWidth, plotHeight);

    // 2.5 PMU 2 ms Sliding Measurement Window Overlays (Visible ONLY when paused)
    const isPaused = !state.playback?.isPlaying;
    if (isPaused && snapshot.reportingRate > 0) {
      const frameIntervalSec = 1 / snapshot.reportingRate;
      const curTime = state.playback?.currentTime ?? 0;
      const winDurSec = windowDurationMs / 1000;
      const kMin = Math.floor((curTime - 0.001) / frameIntervalSec);
      const kMax = Math.ceil((curTime + winDurSec + 0.001) / frameIntervalSec);

      ctx.save();
      for (let k = kMin; k <= kMax; k++) {
        const frameSec = k * frameIntervalSec;
        const tRelMs = (frameSec - curTime) * 1000;
        const tStartMs = tRelMs - 1.0; // -1 ms
        const tEndMs = tRelMs + 1.0;   // +1 ms

        if (tEndMs >= 0 && tStartMs <= windowDurationMs) {
          const xStart = Math.max(padding.left, xToCanvas(tStartMs));
          const xEnd = Math.min(padding.left + plotWidth, xToCanvas(tEndMs));
          const w = Math.max(0, xEnd - xStart);

          if (w > 0) {
            // Lightly shaded semi-transparent measurement window
            ctx.fillStyle = isDark ? 'rgba(245, 158, 11, 0.16)' : 'rgba(217, 119, 6, 0.14)';
            ctx.fillRect(xStart, padding.top, w, plotHeight);

            // Subtle vertical window boundary edges
            ctx.strokeStyle = isDark ? 'rgba(245, 158, 11, 0.40)' : 'rgba(217, 119, 6, 0.35)';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);

            if (tStartMs >= 0) {
              ctx.beginPath();
              ctx.moveTo(xStart, padding.top);
              ctx.lineTo(xStart, padding.top + plotHeight);
              ctx.stroke();
            }
            if (tEndMs <= windowDurationMs) {
              ctx.beginPath();
              ctx.moveTo(xEnd, padding.top);
              ctx.lineTo(xEnd, padding.top + plotHeight);
              ctx.stroke();
            }
            ctx.setLineDash([]);
          }
        }
      }
      ctx.restore();
    }

    // 3. True Input Waveform Trace (Solid Cyan Line)
    const trueColor = isDark ? '#00f0ff' : '#0284c7';
    ctx.save();
    if (isDark) {
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 4;
    }
    ctx.beginPath();
    ctx.strokeStyle = trueColor;
    ctx.lineWidth = 2.0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const x = xToCanvas(p.tRelativeMs);
      const y = yToCanvas(p.trueY);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // 4. PMU-Captured Waveform Trace (Dotted Amber Line)
    const pmuColor = isDark ? '#f59e0b' : '#d97706';
    ctx.save();
    if (isDark) {
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 4;
    }
    ctx.beginPath();
    ctx.strokeStyle = pmuColor;
    ctx.lineWidth = 2.2;
    ctx.setLineDash([3, 3]); // Exact Dotted Style
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const x = xToCanvas(p.tRelativeMs);
      const y = yToCanvas(p.pmuY);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 5. Discrete Reported PMU Synchrophasor Frames
    for (const frame of reportedFrames) {
      const x = xToCanvas(frame.tRelativeMs);
      const y = yToCanvas(frame.y);

      // Vertical stem drop down to baseline
      ctx.beginPath();
      ctx.strokeStyle = isDark ? 'rgba(245, 158, 11, 0.35)' : 'rgba(217, 119, 6, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.moveTo(x, yToCanvas(0));
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Outer ring
      ctx.beginPath();
      ctx.fillStyle = isDark ? '#f59e0b' : '#d97706';
      ctx.arc(x, y, 4.0, 0, Math.PI * 2);
      ctx.fill();

      // Inner white center
      ctx.beginPath();
      ctx.fillStyle = '#ffffff';
      ctx.arc(x, y, 2.0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }, [state, snapshot, disturbances, isDark, cycles]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#080c14] select-none">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0a0f1d]/70 font-mono text-xs">
        {/* Left: Title & Status */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
            <Activity className="w-3.5 h-3.5 text-cyan-500" />
            <span>Time-Domain Comparison</span>
          </div>

          <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-300/40 dark:border-slate-700/50">
            <span>Overlay View</span>
            <InfoTooltip
              title="Time-Domain Waveform Overlay"
              content="The solid cyan trace is the exact ground-truth waveform generated by user waveform and disturbance settings. The dotted amber trace is reconstructed directly from the captured frequency components in the PMU measurement snapshot. Synchrophasor frames are reported at the selected reporting rate (Fs)."
            />
          </div>

          {/* Active Disturbance Color Badges */}
          {disturbances.filter((d) => d.enabled && d.amplitude > 0).length > 0 && (
            <div className="hidden lg:flex items-center gap-1 pl-1">
              {disturbances.filter((d) => d.enabled && d.amplitude > 0).map((d) => {
                const color = getDisturbanceColor(d.color || d.id);
                return (
                  <span
                    key={d.id}
                    className="flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold border"
                    style={{
                      backgroundColor: isDark ? color.badgeBgDark : color.badgeBgLight,
                      borderColor: isDark ? color.badgeBorderDark : color.badgeBorderLight,
                      color: isDark ? color.dark : color.light,
                    }}
                    title={`${d.name}: ${d.amplitude.toFixed(2)} pu`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full inline-block"
                      style={{ backgroundColor: isDark ? color.dark : color.light }}
                    />
                    <span>{d.name.split(' ')[0] || d.id}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Waveform Window Size Control */}
        <WaveformWindowControl
          cycles={cycles}
          onCyclesChange={handleCyclesChange}
          fundamentalFrequency={state.fundamentalFrequency}
          theme={theme}
        />

        {/* Right: Legend & Telemetry Chips */}
        <div className="flex items-center gap-2 font-mono text-[10px]">
          {/* True vs PMU RMS */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-1.5 py-0.5 rounded">
            <span className="text-slate-500">RMS:</span>
            <span className="text-cyan-600 dark:text-cyan-400 font-bold">{snapshot.trueRms.toFixed(2)}</span>
            <span className="text-slate-400">/</span>
            <span className="text-amber-600 dark:text-amber-400 font-bold">{snapshot.pmuRms.toFixed(2)} pu</span>
          </div>

          {/* TVE Chip */}
          <div
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${
              snapshot.tvePercent > 3.0
                ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 font-bold'
                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
            }`}
          >
            <span>TVE:</span>
            <span className="font-bold">{snapshot.tvePercent.toFixed(1)}%</span>
            <InfoTooltip
              title="Total Vector Error (TVE %)"
              content="IEEE C37.118 error metric measuring vector disparity between true fundamental phasor and PMU estimate."
            />
          </div>

          {/* Legend Items */}
          <div className="flex items-center gap-2 text-[10px] text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-cyan-400 rounded-full inline-block" />
              <span>True (Solid)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 border-b border-dotted border-amber-500 inline-block" />
              <span>PMU (Dotted)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 border border-white inline-block" />
              <span>{snapshot.reportingRate}fps</span>
            </div>
            <div className="flex items-center gap-1" title="Sliding 2 ms calculation window (±1 ms around reporting instant, visible when paused)">
              <span className="w-2.5 h-2 rounded bg-amber-400/25 border border-dashed border-amber-500/60 inline-block" />
              <span>PMU measurement window (2 ms)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div className="flex-1 w-full min-h-0 relative">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
    </div>
  );
};
