import React, { useRef, useEffect, useMemo } from 'react';
import { WaveformState } from '../types/waveform';
import { AppTheme } from '../types/settings';
import { extractSpectrumData } from '../model/spectrumModel';

interface FrequencyDomainPlotProps {
  state: WaveformState;
  theme?: AppTheme;
}

export const FrequencyDomainPlot: React.FC<FrequencyDomainPlotProps> = ({
  state,
  theme = 'dark',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isDark = theme === 'dark';

  // Compute exact discrete spectrum from canonical waveform state
  const spectrum = useMemo(() => extractSpectrumData(state), [
    state.fundamentalFrequency,
    state.fundamentalAmplitude,
    state.harmonics?.second,
    state.harmonics?.third,
    state.harmonics?.fourth,
    state.customTerms,
    state.dcOffset,
  ]);

  // Prevent mouse-wheel / trackpad pinch zoom from scaling the application or waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, []);

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

    // Background
    ctx.fillStyle = isDark ? '#080c14' : '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    const maxFreq = spectrum.maxFrequency;
    const maxAmp = spectrum.maxAmplitude;

    // Mapping functions
    const freqToCanvas = (fHz: number) => {
      return padding.left + (fHz / maxFreq) * plotWidth;
    };

    const ampToCanvas = (ampVal: number) => {
      const normalized = Math.min(1, Math.max(0, ampVal / maxAmp));
      return padding.top + (1 - normalized) * plotHeight;
    };

    // 1. Grid Lines
    // Vertical Frequency Grid (5 or 6 divisions)
    const numFreqDivs = 6;
    for (let i = 0; i <= numFreqDivs; i++) {
      const fHz = Math.round((i / numFreqDivs) * maxFreq);
      const x = freqToCanvas(fHz);

      ctx.beginPath();
      ctx.strokeStyle = isDark
        ? (i === 0 || i === numFreqDivs ? '#1e293b' : '#141d2e')
        : (i === 0 || i === numFreqDivs ? '#cbd5e1' : '#f1f5f9');
      ctx.lineWidth = 1;
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + plotHeight);
      ctx.stroke();

      // Frequency label
      ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${fHz} Hz`, x, padding.top + plotHeight + 6);
    }

    // Horizontal Amplitude Grid (0.0 to 2.0 pu at 0.5 intervals)
    const vSteps = [0.0, 0.5, 1.0, 1.5, 2.0];
    for (const v of vSteps) {
      const y = ampToCanvas(v);

      ctx.beginPath();
      if (v === 0) {
        ctx.strokeStyle = isDark ? '#334155' : '#94a3b8';
        ctx.lineWidth = 1.5;
      } else {
        ctx.strokeStyle = isDark ? '#121a28' : '#f1f5f9';
        ctx.lineWidth = 1;
      }
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + plotWidth, y);
      ctx.stroke();

      // Amplitude label
      ctx.fillStyle = isDark ? (v === 0 ? '#94a3b8' : '#475569') : '#94a3b8';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${v.toFixed(1)} pu`, padding.left - 8, y);
    }

    // Outer plot border
    ctx.strokeStyle = isDark ? '#1e293b' : '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(padding.left, padding.top, plotWidth, plotHeight);

    // 2. Draw Spectral Stems and Bars
    const baselineY = ampToCanvas(0);

    for (const comp of spectrum.components) {
      if (comp.amplitude <= 0.001) continue;

      const x = freqToCanvas(comp.frequency);
      const topY = ampToCanvas(comp.amplitude);
      const barWidth = Math.max(8, Math.min(24, plotWidth / 35));

      // Bar fill with subtle gradient
      ctx.save();
      const grad = ctx.createLinearGradient(x, topY, x, baselineY);
      grad.addColorStop(0, comp.color);
      grad.addColorStop(1, `${comp.color}22`);

      ctx.fillStyle = grad;
      ctx.fillRect(x - barWidth / 2, topY, barWidth, baselineY - topY);

      // Glow effect for stem peak
      if (isDark) {
        ctx.shadowColor = comp.color;
        ctx.shadowBlur = 10;
      }

      // Top peak line / cap
      ctx.strokeStyle = comp.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x - barWidth / 2, topY);
      ctx.lineTo(x + barWidth / 2, topY);
      ctx.stroke();

      // Peak circle
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, topY, 3, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();

      // Component label above peak: e.g. "1.00 pu"
      ctx.fillStyle = isDark ? '#f1f5f9' : '#0f172a';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${comp.amplitude.toFixed(2)}`, x, topY - 14);

      // Harmonic label: e.g. "f₀", "2f₀", etc.
      ctx.fillStyle = comp.color;
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText(`${comp.label.split(' ')[0]}`, x, topY - 3);
    }

    // 3. Axis Titles
    ctx.fillStyle = '#64748b';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('MAGNITUDE (pu)', padding.left, 14);

    ctx.textAlign = 'right';
    ctx.fillText('FREQUENCY (Hz)', padding.left + plotWidth, padding.top + plotHeight + 28);

    ctx.restore();
  }, [spectrum, isDark]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex flex-col overflow-hidden bg-white dark:bg-[#080c14]"
    >
      {/* Telemetry Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800/80 px-3.5 py-1.5 bg-slate-50 dark:bg-[#0b101b]/90 text-[11px] font-mono text-slate-700 dark:text-slate-300 shrink-0">
        <div className="flex items-center gap-3 sm:gap-5">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
            <span className="text-slate-500">Domain:</span>
            <span className="font-bold text-purple-600 dark:text-purple-300">Frequency (Fourier)</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-slate-500">Peaks:</span>
            <span className="font-semibold">{spectrum.components.length}</span>
          </div>

          <div className="flex items-center gap-1 hidden sm:flex">
            <span className="text-slate-500">Span:</span>
            <span className="font-semibold">0 - {spectrum.maxFrequency} Hz</span>
          </div>

          {spectrum.thdPercent > 0.05 && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500">THD:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">{spectrum.thdPercent.toFixed(1)}%</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-[10px]">
          <span className="bg-slate-200/60 dark:bg-slate-800/80 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700/60 text-slate-600 dark:text-slate-400">
            Discrete Fourier Stems
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
