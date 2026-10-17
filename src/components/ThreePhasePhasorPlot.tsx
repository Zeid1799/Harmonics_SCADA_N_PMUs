import React, { useRef, useEffect } from 'react';
import { ThreePhaseState } from '../types/threePhase';
import { AppTheme } from '../types/settings';

interface ThreePhasePhasorPlotProps {
  state: ThreePhaseState;
  theme?: AppTheme;
}

export const ThreePhasePhasorPlot: React.FC<ThreePhasePhasorPlotProps> = ({
  state,
  theme = 'dark',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isDark = theme === 'dark';

  const areFrequenciesEqual =
    Math.abs(state.phaseA.frequency - state.phaseB.frequency) < 0.05 &&
    Math.abs(state.phaseA.frequency - state.phaseC.frequency) < 0.05;

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

    // Background
    ctx.fillStyle = isDark ? '#080c14' : '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2 + 8;
    const radius = Math.min(centerX - 28, centerY - 36);

    // 1. Draw Polar Grid Circles & Axes
    ctx.strokeStyle = isDark ? '#1e293b' : '#e2e8f0';
    ctx.lineWidth = 1;

    // Rings at 0.5, 1.0, 1.5, 2.0 pu
    const rings = [0.25, 0.5, 0.75, 1.0];
    rings.forEach((rFraction) => {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * rFraction, 0, 2 * Math.PI);
      ctx.stroke();
    });

    // Cross axes
    ctx.beginPath();
    ctx.moveTo(centerX - radius - 10, centerY);
    ctx.lineTo(centerX + radius + 10, centerY);
    ctx.moveTo(centerX, centerY - radius - 10);
    ctx.lineTo(centerX, centerY + radius + 10);
    ctx.stroke();

    // Polar Angle Markings (0°, 90°, 180°, 270°)
    ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('0° (Re+)', centerX + radius + 4, centerY - 2);
    ctx.textAlign = 'right';
    ctx.fillText('180°', centerX - radius - 4, centerY - 2);
    ctx.textAlign = 'center';
    ctx.fillText('+90° (Im+)', centerX, centerY - radius - 4);
    ctx.fillText('-90°', centerX, centerY + radius + 14);

    // 2. Compute Phasors
    // Voltage Vectors: amplitude (pu) and phase (deg)
    const scaleFactor = radius / 1.5; // 1.0 pu is ~66% of radius

    const pA = state.phaseA;
    const pB = state.phaseB;
    const pC = state.phaseC;

    // Phase A Voltage Vector
    if (pA.enabled) {
      drawVector(
        ctx,
        centerX,
        centerY,
        pA.amplitude * scaleFactor,
        pA.phaseDeg,
        '#ef4444',
        2.5,
        'V_A'
      );
    }

    // Phase B Voltage Vector
    if (pB.enabled) {
      drawVector(
        ctx,
        centerX,
        centerY,
        pB.amplitude * scaleFactor,
        pB.phaseDeg,
        '#eab308',
        2.5,
        'V_B'
      );
    }

    // Phase C Voltage Vector
    if (pC.enabled) {
      drawVector(
        ctx,
        centerX,
        centerY,
        pC.amplitude * scaleFactor,
        pC.phaseDeg,
        '#3b82f6',
        2.5,
        'V_C'
      );
    }

    // Current Phasor Sum: I_sum = I_A + I_B + I_C
    // Under resistive load: I_phi = V_phi / R_phi with angle theta_phi
    const iAmpA = pA.enabled ? pA.amplitude / Math.max(0.1, pA.resistance) : 0;
    const iAmpB = pB.enabled ? pB.amplitude / Math.max(0.1, pB.resistance) : 0;
    const iAmpC = pC.enabled ? pC.amplitude / Math.max(0.1, pC.resistance) : 0;

    const radA = (pA.phaseDeg * Math.PI) / 180;
    const radB = (pB.phaseDeg * Math.PI) / 180;
    const radC = (pC.phaseDeg * Math.PI) / 180;

    const iReal = iAmpA * Math.cos(radA) + iAmpB * Math.cos(radB) + iAmpC * Math.cos(radC);
    const iImag = iAmpA * Math.sin(radA) + iAmpB * Math.sin(radB) + iAmpC * Math.sin(radC);
    const iSumMag = Math.sqrt(iReal * iReal + iImag * iImag);
    const iSumDeg = (Math.atan2(iImag, iReal) * 180) / Math.PI;

    // Draw Current Vector Sum if non-zero
    if (iSumMag > 0.005) {
      const iScale = radius * 4.0; // scaled for current visibility
      drawVector(
        ctx,
        centerX,
        centerY,
        Math.min(radius, iSumMag * iScale),
        iSumDeg,
        '#c084fc',
        2.0,
        'Σ I_phase (-I_N)'
      );
    }

    ctx.restore();
  }, [state, isDark, areFrequenciesEqual]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex flex-col overflow-hidden bg-white dark:bg-[#080c14]"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 px-3 py-1.5 bg-slate-50 dark:bg-[#0b101b]/90 text-[11px] font-mono text-slate-700 dark:text-slate-300 shrink-0">
        <span className="font-bold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
          Three-Phase Phasor Diagram
        </span>
        <span className="text-[10px] text-slate-500">
          Voltages & Current Sum
        </span>
      </div>

      {/* Warning if frequencies are unequal */}
      {!areFrequenciesEqual && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-3 py-1 text-[10px] font-mono text-amber-600 dark:text-amber-400">
          ⚠️ Asynchronous frequencies: Relative phase angles continuously rotate over time.
        </div>
      )}

      {/* Canvas Area */}
      <div className="relative flex-1 w-full min-h-[180px]">
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
};

function drawVector(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  length: number,
  angleDeg: number,
  color: string,
  width: number,
  label: string
) {
  const rad = (angleDeg * Math.PI) / 180;
  // Canvas coordinate system has y pointing down, so angle theta has y = cy - len * sin(theta)
  const tipX = cx + length * Math.cos(rad);
  const tipY = cy - length * Math.sin(rad);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;

  // Main shaft
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  // Arrowhead
  const arrowSize = 7;
  const arrowAngle = Math.PI / 7;
  const lineAngle = Math.atan2(cy - tipY, tipX - cx);

  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(
    tipX - arrowSize * Math.cos(lineAngle - arrowAngle),
    tipY + arrowSize * Math.sin(lineAngle - arrowAngle)
  );
  ctx.lineTo(
    tipX - arrowSize * Math.cos(lineAngle + arrowAngle),
    tipY + arrowSize * Math.sin(lineAngle + arrowAngle)
  );
  ctx.closePath();
  ctx.fill();

  // Text label
  ctx.font = 'bold 10px "JetBrains Mono", monospace';
  const labelOffsetX = 8 * Math.cos(rad);
  const labelOffsetY = -8 * Math.sin(rad);
  ctx.textAlign = Math.cos(rad) >= 0 ? 'left' : 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, tipX + labelOffsetX, tipY + labelOffsetY);

  ctx.restore();
}
