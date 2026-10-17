import React, { useRef, useEffect, useMemo } from 'react';
import { WaveformState } from '../../types/waveform';
import { AppTheme } from '../../types/settings';
import { extractSpectrumData } from '../../model/spectrumModel';
import { Info } from 'lucide-react';

interface ScadaFrequencyPlotProps {
  state: WaveformState;
  theme?: AppTheme;
}

export const ScadaFrequencyPlot: React.FC<ScadaFrequencyPlotProps> = ({
  state,
  theme = 'dark',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
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

    const padding = { top: 20, right: 28, bottom: 32, left: 54 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    // Background
    ctx.fillStyle = isDark ? '#080c14' : '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    const maxFreq = spectrum.maxFrequency;
    const maxAmp = spectrum.maxAmplitude;

    const freqToCanvas = (fHz: number) => padding.left + (fHz / maxFreq) * plotWidth;
    const ampToCanvas = (ampVal: number) => {
      const normalized = Math.min(1, Math.max(0, ampVal / maxAmp));
      return padding.top + (1 - normalized) * plotHeight;
    };

    // 1. Grid Lines (Vertical Frequency)
    const numFreqDivs = 6;
    for (let i = 0; i <= numFreqDivs; i++) {
      const fHz = Math.round((i / numFreqDivs) * maxFreq);
      const x = freqToCanvas(fHz);

      ctx.beginPath();
      ctx.strokeStyle = isDark
        ? i === 0 || i === numFreqDivs ? '#1e293b' : '#141d2e'
        : i === 0 || i === numFreqDivs ? '#cbd5e1' : '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + plotHeight);
      ctx.stroke();

      ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${fHz} Hz`, x, padding.top + plotHeight + 6);
    }

    // Horizontal Amplitude Grid
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
      const barWidth = Math.max(8, Math.min(22, plotWidth / 35));

      // Bar fill with subtle gradient
      ctx.save();
      const grad = ctx.createLinearGradient(x, topY, x, baselineY);
      grad.addColorStop(0, comp.color);
      grad.addColorStop(1, `${comp.color}22`);

      ctx.fillStyle = grad;
      ctx.fillRect(x - barWidth / 2, topY, barWidth, baselineY - topY);

      if (isDark) {
        ctx.shadowColor = comp.color;
        ctx.shadowBlur = 8;
      }

      // Stem line
      ctx.beginPath();
      ctx.strokeStyle = comp.color;
      ctx.lineWidth = 2;
      ctx.moveTo(x, baselineY);
      ctx.lineTo(x, topY);
      ctx.stroke();

      // Top marker circle
      ctx.beginPath();
      ctx.arc(x, topY, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = comp.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Value label on top
      ctx.fillStyle = isDark ? '#f1f5f9' : '#0f172a';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${comp.amplitude.toFixed(2)} pu`, x, topY - 5);

      // Component label below
      ctx.fillStyle = comp.color;
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillText(comp.label, x, topY - 17);
    }

    // 3. Labels
    ctx.fillStyle = '#64748b';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('AMPLITUDE (pu)', padding.left, 12);

    ctx.textAlign = 'right';
    ctx.fillText('FREQUENCY (Hz)', padding.left + plotWidth, padding.top + plotHeight + 25);

    ctx.restore();
  }, [spectrum, isDark]);

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-white dark:bg-[#080c14]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800/80 px-3.5 py-1.5 bg-slate-50 dark:bg-[#0b101b]/95 text-[11px] font-mono text-slate-700 dark:text-slate-300 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
            Underlying Signal Spectrum
          </span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-500">f₀: {spectrum.fundamentalFrequency} Hz</span>
          {spectrum.thdPercent > 0.05 && (
            <span className="text-amber-600 dark:text-amber-400 font-semibold">
              THD: {spectrum.thdPercent.toFixed(1)}%
            </span>
          )}
        </div>

        {/* Top-Right Info Icon with Hover Tooltip */}
        <div className="relative group">
          <button
            type="button"
            aria-label="SCADA vs Spectrum Information"
            className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-help"
          >
            <Info className="w-3.5 h-3.5" />
          </button>

          {/* Hover Pop-up Tooltip */}
          <div className="absolute right-0 top-7 w-72 sm:w-80 p-3 rounded-xl bg-white dark:bg-[#0f172a] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none group-hover:pointer-events-auto">
            <div className="flex items-center gap-1.5 font-bold text-xs text-amber-600 dark:text-amber-400 pb-1.5 border-b border-slate-200 dark:border-slate-800">
              <Info className="w-3.5 h-3.5" />
              <span>Signal Spectrum vs. SCADA Reporting</span>
            </div>
            <p className="text-[11px] font-sans leading-relaxed text-slate-600 dark:text-slate-300 pt-2">
              This frequency-domain plot represents the <strong>underlying physical waveform</strong> (fundamental and harmonics). SCADA systems do <em>not</em> capture or transmit frequency-domain spectra; SCADA supervisory telemetry delivers low-rate scalar values (such as RMS voltage or active power sampled every 1 to 6+ seconds). Observing harmonic spectral content requires dedicated <strong>Power Quality (PQ) meters</strong> or <strong>Digital Fault Recorders (DFRs)</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="relative flex-1 w-full min-h-0">
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
};
