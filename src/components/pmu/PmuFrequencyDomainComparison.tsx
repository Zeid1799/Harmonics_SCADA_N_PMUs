import React, { useRef, useEffect } from 'react';
import { AppTheme } from '../../types/settings';
import { PmuMeasurementSnapshot, getDisturbanceColor } from '../../types/pmu';
import { InfoTooltip } from './InfoTooltip';
import { Radio, RefreshCw } from 'lucide-react';

interface PmuFrequencyDomainComparisonProps {
  snapshot: PmuMeasurementSnapshot;
  theme?: AppTheme;
  onTakeNewMeasurement: () => void;
}

export const PmuFrequencyDomainComparison: React.FC<PmuFrequencyDomainComparisonProps> = ({
  snapshot,
  theme = 'dark',
  onTakeNewMeasurement,
}) => {
  const pmuCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDark = theme === 'dark';

  const {
    nominalFundamental,
    zone1Limit,
    zone2Limit,
    zone1Band,
    zone2Band,
    minPlotFreq,
    maxPlotFreq,
    maxAmplitude,
    trueComponents,
    pmuComponents,
    pmuClass,
    reportingRate,
    disturbances,
  } = snapshot;

  // Render PMU-Captured Signal Canvas with Grey Ground-Truth Reference Overlay
  useEffect(() => {
    const canvas = pmuCanvasRef.current;
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

    const padding = { top: 28, right: 24, bottom: 34, left: 46 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    // Canvas Background
    ctx.fillStyle = isDark ? '#080c14' : '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    const freqSpan = Math.max(10, maxPlotFreq - minPlotFreq);

    const freqToCanvas = (fHz: number) =>
      padding.left + ((fHz - minPlotFreq) / freqSpan) * plotWidth;

    const ampToCanvas = (ampVal: number) => {
      const normalized = Math.min(1, Math.max(0, ampVal / maxAmplitude));
      return padding.top + (1 - normalized) * plotHeight;
    };

    const xF0 = freqToCanvas(nominalFundamental);
    const xZ1Min = freqToCanvas(zone1Band.min);
    const xZ1Max = freqToCanvas(zone1Band.max);
    const xZ2Min = freqToCanvas(zone2Band.min);
    const xZ2Max = freqToCanvas(zone2Band.max);

    // 1. Ultra-transparent Zone Background Shading
    // Zone 1: Standardized Dynamic Performance Range
    ctx.fillStyle = isDark ? 'rgba(16, 185, 129, 0.05)' : 'rgba(16, 185, 129, 0.06)';
    ctx.fillRect(xZ1Min, padding.top, Math.max(0, xZ1Max - xZ1Min), plotHeight);

    // Zone 2: Reporting-Stream Nyquist Range
    ctx.fillStyle = isDark ? 'rgba(56, 189, 248, 0.035)' : 'rgba(14, 165, 233, 0.045)';
    ctx.fillRect(xZ2Min, padding.top, Math.max(0, xZ1Min - xZ2Min), plotHeight);
    ctx.fillRect(xZ1Max, padding.top, Math.max(0, xZ2Max - xZ1Max), plotHeight);

    // Zone 3: Above Nyquist (strictly unshaded)

    // Zone Top Headers
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';

    if (xZ1Max - xZ1Min > 32) {
      ctx.fillStyle = isDark ? '#34d399' : '#059669';
      ctx.fillText(`ZONE 1 (±${zone1Limit}Hz)`, xF0, padding.top + 3);
    }
    if (xZ1Min - xZ2Min > 30) {
      ctx.fillStyle = isDark ? '#38bdf8' : '#0284c7';
      ctx.fillText('ZONE 2', (xZ2Min + xZ1Min) / 2, padding.top + 3);
    }
    if (xZ2Max - xZ1Max > 30) {
      ctx.fillStyle = isDark ? '#38bdf8' : '#0284c7';
      ctx.fillText('ZONE 2', (xZ1Max + xZ2Max) / 2, padding.top + 3);
    }

    // 2. Frequency Grid Lines & Dual Frequency Labels
    const numDivs = 8;
    for (let i = 0; i <= numDivs; i++) {
      const fHz = Math.round(minPlotFreq + (i / numDivs) * freqSpan);
      const x = freqToCanvas(fHz);

      ctx.beginPath();
      ctx.strokeStyle = isDark ? '#141d2e' : '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + plotHeight);
      ctx.stroke();

      // Top label: Electrical Frequency (Hz)
      ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
      ctx.font = '8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${fHz}Hz`, x, padding.top + plotHeight + 3);

      // Bottom label: Relative Dynamic Modulation (Δf)
      const diff = Math.round(fHz - nominalFundamental);
      const diffStr = diff === 0 ? 'f₀' : diff > 0 ? `+${diff}` : `${diff}`;
      ctx.fillStyle = isDark ? '#475569' : '#94a3b8';
      ctx.font = '7.5px "JetBrains Mono", monospace';
      ctx.fillText(diffStr, x, padding.top + plotHeight + 15);
    }

    // Horizontal Amplitude Grid Lines
    const ampDivs = [0.0, 0.5, 1.0, 1.5, 2.0];
    for (const v of ampDivs) {
      if (v > maxAmplitude + 0.1) continue;
      const y = ampToCanvas(v);

      ctx.beginPath();
      ctx.strokeStyle = v === 0 ? (isDark ? '#334155' : '#cbd5e1') : (isDark ? '#121a28' : '#f1f5f9');
      ctx.lineWidth = v === 0 ? 1.5 : 1;
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + plotWidth, y);
      ctx.stroke();

      ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
      ctx.font = '8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${v.toFixed(1)} pu`, padding.left - 5, y);
    }

    // Zone Boundary Vertical Markers
    ctx.save();
    // Carrier marker
    ctx.strokeStyle = isDark ? 'rgba(0, 240, 255, 0.4)' : 'rgba(2, 132, 199, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(xF0, padding.top);
    ctx.lineTo(xF0, padding.top + plotHeight);
    ctx.stroke();

    // Zone 1 boundary lines
    ctx.strokeStyle = isDark ? 'rgba(16, 185, 129, 0.5)' : 'rgba(5, 150, 105, 0.5)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(xZ1Min, padding.top);
    ctx.lineTo(xZ1Min, padding.top + plotHeight);
    ctx.moveTo(xZ1Max, padding.top);
    ctx.lineTo(xZ1Max, padding.top + plotHeight);
    ctx.stroke();

    // Zone 2 boundary lines (Reporting Nyquist)
    ctx.strokeStyle = isDark ? 'rgba(56, 189, 248, 0.5)' : 'rgba(2, 132, 199, 0.5)';
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(xZ2Min, padding.top);
    ctx.lineTo(xZ2Min, padding.top + plotHeight);
    ctx.moveTo(xZ2Max, padding.top);
    ctx.lineTo(xZ2Max, padding.top + plotHeight);
    ctx.stroke();
    ctx.restore();

    const baselineY = ampToCanvas(0);

    // 3. Ground-Truth Reference Spectrum (Translucent Grey Reference Lines)
    // Never modified by attenuation, missed detection, or aliasing.
    ctx.save();
    const greyColor = isDark ? 'rgba(148, 163, 184, 0.38)' : 'rgba(100, 116, 139, 0.42)';
    for (const trueComp of trueComponents) {
      if (trueComp.amplitude <= 0.001) continue;
      if (trueComp.frequency < minPlotFreq || trueComp.frequency > maxPlotFreq) continue;

      const x = freqToCanvas(trueComp.frequency);
      const topY = ampToCanvas(trueComp.amplitude);

      ctx.save();
      ctx.strokeStyle = trueComp.isCarrier
        ? isDark ? 'rgba(0, 240, 255, 0.35)' : 'rgba(2, 132, 199, 0.35)'
        : greyColor;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([3, 3]); // Subtle dashed grey ghost stem
      ctx.beginPath();
      ctx.moveTo(x, baselineY);
      ctx.lineTo(x, topY);
      ctx.stroke();

      // Ghost circle marker
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.arc(x, topY, trueComp.isCarrier ? 3.5 : 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Ghost label
      ctx.fillStyle = isDark ? 'rgba(148, 163, 184, 0.6)' : 'rgba(100, 116, 139, 0.7)';
      ctx.font = '7px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      const ghostLabel = trueComp.isCarrier ? `True f₀` : `True ${trueComp.amplitude.toFixed(2)}`;
      ctx.fillText(ghostLabel, x, topY - 3);
      ctx.restore();
    }
    ctx.restore();

    // 4. Stems: PMU-Captured Spectral Components
    // Rendered in foreground with each disturbance's distinct assigned color!
    for (const comp of pmuComponents) {
      if (comp.amplitude <= 0.001) continue;
      if (comp.frequency < minPlotFreq || comp.frequency > maxPlotFreq) continue;

      const x = freqToCanvas(comp.frequency);
      const topY = ampToCanvas(comp.amplitude);

      // Determine stem color from assigned disturbance color or carrier cyan
      let stemColor: string;
      if (comp.isCarrier) {
        stemColor = isDark ? '#00f0ff' : '#0284c7';
      } else {
        const distColor = getDisturbanceColor(comp.color || comp.disturbanceId);
        stemColor = isDark ? distColor.dark : distColor.light;
      }

      ctx.save();

      if (comp.isAliased) {
        // Aliased component: Dashed stem in disturbance color + Diamond marker
        ctx.strokeStyle = stemColor;
        ctx.lineWidth = 2.4;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(x, baselineY);
        ctx.lineTo(x, topY);
        ctx.stroke();

        // Diamond marker at top
        ctx.setLineDash([]);
        ctx.fillStyle = stemColor;
        ctx.beginPath();
        ctx.moveTo(x, topY - 4.5);
        ctx.lineTo(x + 4.5, topY);
        ctx.lineTo(x, topY + 4.5);
        ctx.lineTo(x - 4.5, topY);
        ctx.closePath();
        ctx.fill();

        // If also attenuated, add an inner circular cutout to show both effects
        if (comp.isAttenuated) {
          ctx.beginPath();
          ctx.fillStyle = isDark ? '#080c14' : '#ffffff';
          ctx.arc(x, topY, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }

        // Label above
        ctx.fillStyle = stemColor;
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        const labelText = comp.isAttenuated
          ? `Alias & Atten (${comp.amplitude.toFixed(2)})`
          : `Alias (${comp.amplitude.toFixed(2)})`;
        ctx.fillText(labelText, x, topY - 6);
      } else if (comp.isAttenuated) {
        // Attenuated component: Solid stem in disturbance color + Ring marker
        ctx.strokeStyle = stemColor;
        ctx.lineWidth = 2.0;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x, baselineY);
        ctx.lineTo(x, topY);
        ctx.stroke();

        // Ring marker at top (open circle)
        ctx.beginPath();
        ctx.fillStyle = isDark ? '#080c14' : '#ffffff';
        ctx.arc(x, topY, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.strokeStyle = stemColor;
        ctx.lineWidth = 2.0;
        ctx.arc(x, topY, 3.5, 0, Math.PI * 2);
        ctx.stroke();

        // Label above
        ctx.fillStyle = stemColor;
        ctx.font = '7.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(comp.amplitude.toFixed(2), x, topY - 5);
      } else {
        // Standard accurate capture: Solid stem + Solid circle marker
        ctx.strokeStyle = stemColor;
        ctx.lineWidth = comp.isCarrier ? 2.8 : 2.2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x, baselineY);
        ctx.lineTo(x, topY);
        ctx.stroke();

        // Top dot
        ctx.beginPath();
        ctx.fillStyle = stemColor;
        ctx.arc(x, topY, comp.isCarrier ? 4.2 : 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Label above
        ctx.fillStyle = comp.isCarrier ? (isDark ? '#00f0ff' : '#0284c7') : stemColor;
        ctx.font = comp.isCarrier ? 'bold 8px "JetBrains Mono", monospace' : '7.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        const labelText = comp.isCarrier ? `f₀ (${comp.amplitude.toFixed(2)})` : comp.amplitude.toFixed(2);
        ctx.fillText(labelText, x, topY - 5);
      }

      ctx.restore();
    }

    // Outer plot border
    ctx.strokeStyle = isDark ? '#1e293b' : '#cbd5e1';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(padding.left, padding.top, plotWidth, plotHeight);

    ctx.restore();
  }, [snapshot, isDark, maxAmplitude, maxPlotFreq, minPlotFreq, nominalFundamental, pmuComponents, reportingRate, trueComponents, zone1Band, zone1Limit, zone2Band, zone2Limit]);

  const activeDisturbances = disturbances.filter((d) => d.enabled && d.amplitude > 0);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#080c14] select-none">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0a0f1d]/70 font-mono text-xs">
        <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
          <Radio className="w-3.5 h-3.5 text-cyan-500" />
          <span>PMU-Captured Frequency Spectrum</span>
          <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
            ({pmuClass}, {reportingRate} fps)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Measurement Lifecycle Badge & Re-sample Trigger */}
          <button
            onClick={onTakeNewMeasurement}
            title="Take a new PMU measurement (evaluates a fresh draw of Zone 3 stochastic Bernoulli trials)"
            className="flex items-center gap-1 text-[10px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 font-mono transition-all shadow-xs active:scale-95"
          >
            <RefreshCw className="w-2.5 h-2.5 text-cyan-500" />
            <span>Sample #{snapshot.id}</span>
          </button>

          <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
            <span>Zones & Aliasing Info</span>
            <InfoTooltip
              title="PMU Frequency Zones & Measurement Mechanics"
              content="• Zone 1 (Standardized Dynamic Compliance): Frequencies up to min(Fs/10, 2Hz) for P-Class or min(Fs/5, 5Hz) for M-Class around the fundamental.\n\n• Zone 2 (Reporting Nyquist): Extends up to Fs/2. Attenuated according to standardized filter formula.\n\n• Zone 3 (Above Nyquist): Frequencies above Fs/2 are subject to independent stochastic trials (missed detection, aliasing, and random attenuation).\n\n• Aliasing Convention: Conventional single-rate sampling folds frequencies into [0, Fs/2] via |((f + Fs/2) mod Fs) - Fs/2|. Aliased components appear in Zone 1 or Zone 2, distinguished by dashed stems and diamond markers. Out-of-band leakage components appear in Zone 3 if not fully suppressed."
            />
          </div>
        </div>
      </div>

      {/* Main Single Spectrum Viewport */}
      <div className="flex-1 w-full min-h-0 relative">
        <canvas ref={pmuCanvasRef} className="w-full h-full block" />
      </div>

      {/* Minimalist Bottom Legend Bar with Disturbance Color Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#080c16]/50 font-mono text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
        {/* Left: Zone Indicators */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2 rounded bg-emerald-500/10 border border-emerald-500/40 inline-block" />
            <span>Zone 1: Standardized (±{zone1Limit}Hz)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2 rounded bg-sky-500/10 border border-sky-500/40 inline-block" />
            <span>Zone 2: Nyquist (±{zone2Limit}Hz)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2 rounded bg-transparent border border-dashed border-slate-400 inline-block" />
            <span>Zone 3: Above Nyquist</span>
          </div>
        </div>

        {/* Right: Traces Legend & Disturbance Color Badges */}
        <div className="flex items-center gap-3">
          {/* True vs PMU Styles */}
          <div className="flex items-center gap-2 pr-2 border-r border-slate-200 dark:border-slate-800">
            <span className="flex items-center gap-1 text-slate-400">
              <span className="w-2 h-0.5 border-b border-dashed border-slate-400 inline-block" />
              <span>True Spectrum (Grey Ghost)</span>
            </span>
            <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 inline-block" />
              <span>Carrier ({nominalFundamental}Hz)</span>
            </span>
          </div>

          {/* Active Disturbance Color Swatches */}
          {activeDisturbances.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-slate-400">Disturbances:</span>
              {activeDisturbances.map((d) => {
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
      </div>
    </div>
  );
};
