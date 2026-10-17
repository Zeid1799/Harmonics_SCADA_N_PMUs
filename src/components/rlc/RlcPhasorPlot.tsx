import React, { useRef, useEffect, useState, useCallback } from 'react';
import { RlcCircuitConfig, RlcCircuitMetrics } from '../../types/rlcCircuit';
import { AppTheme } from '../../types/settings';

interface RlcPhasorPlotProps {
  config: RlcCircuitConfig;
  metrics: RlcCircuitMetrics;
  theme?: AppTheme;
}

export const RlcPhasorPlot: React.FC<RlcPhasorPlotProps> = ({
  metrics,
  theme = 'dark',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [, setDimensions] = useState({ width: 0, height: 0 });
  const isDark = theme === 'dark';

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

  const drawPhasorPlot = useCallback(() => {
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
    const centerY = height / 2 + 10;
    const radius = Math.min(centerX - 30, centerY - 38);

    // Grid circles & axes
    const gridColor = isDark ? '#1e293b' : '#e2e8f0';
    const axisColor = isDark ? '#334155' : '#cbd5e1';
    const textDim = isDark ? '#64748b' : '#94a3b8';

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;

    // Rings at 25%, 50%, 75%, 100%
    [0.25, 0.5, 0.75, 1.0].forEach((frac) => {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * frac, 0, 2 * Math.PI);
      ctx.stroke();
    });

    // Cross axes
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - radius - 10, centerY);
    ctx.lineTo(centerX + radius + 10, centerY);
    ctx.moveTo(centerX, centerY - radius - 10);
    ctx.lineTo(centerX, centerY + radius + 10);
    ctx.stroke();

    // Axis Degree Labels
    ctx.fillStyle = textDim;
    ctx.font = '8.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('0° (+Re)', centerX + radius + 2, centerY - 4);
    ctx.textAlign = 'center';
    ctx.fillText('+90° (+Im)', centerX, centerY - radius - 4);
    ctx.textAlign = 'right';
    ctx.fillText('180°', centerX - radius - 4, centerY - 4);
    ctx.textAlign = 'center';
    ctx.fillText('-90° (-Im)', centerX, centerY + radius + 14);

    if (metrics.isUnboundedCurrent) {
      // Unbounded current: render notification
      ctx.save();
      ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)';
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1.5;
      const bw = 240;
      const bh = 50;
      ctx.fillRect(centerX - bw / 2, centerY - bh / 2, bw, bh);
      ctx.strokeRect(centerX - bw / 2, centerY - bh / 2, bw, bh);

      ctx.fillStyle = isDark ? '#fda4af' : '#e11d48';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Ideal zero-impedance resonance:', centerX, centerY - 8);
      ctx.font = '9.5px "JetBrains Mono", monospace';
      ctx.fillText('phasors are unbounded.', centerX, centerY + 8);
      ctx.restore();
      ctx.restore();
      return;
    }

    // Determine scale: max of all voltages
    const maxVoltage = Math.max(
      metrics.vSourceRms,
      metrics.vResistorRms,
      metrics.vInductorRms,
      metrics.vCapacitorRms,
      1
    );

    // Function to draw arrow vector
    const drawPhasor = (
      mag: number,
      angleRad: number,
      color: string,
      label: string,
      lineWidth: number = 2,
      isDashed: boolean = false
    ) => {
      const length = (mag / maxVoltage) * radius;
      if (length < 2) return;

      const endX = centerX + length * Math.cos(angleRad);
      const endY = centerY - length * Math.sin(angleRad);

      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = lineWidth;
      if (isDashed) ctx.setLineDash([4, 3]);

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrowhead
      const headLen = Math.min(8, Math.max(5, length * 0.15));
      const angle = -angleRad;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - headLen * Math.cos(angle - Math.PI / 6),
        endY - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        endX - headLen * Math.cos(angle + Math.PI / 6),
        endY - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();

      // Text label
      const textDist = length + 12;
      const textX = centerX + textDist * Math.cos(angleRad);
      const textY = centerY - textDist * Math.sin(angleRad);
      ctx.font = '9.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, textX, textY);

      ctx.restore();
    };

    if (metrics.isOpenCircuit) {
      // In open circuit: V_s = V_C, V_R = 0, V_L = 0, I = 0
      drawPhasor(
        metrics.vSourceRms,
        metrics.vSourcePhaseRad,
        '#38bdf8',
        `V_s = V_C (${metrics.vSourceRms}V)`,
        2.8
      );
      ctx.fillStyle = textDim;
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('(Open Circuit: I = 0 A)', centerX, centerY + radius * 0.5);
      ctx.restore();
      return;
    }

    // 1. Resistor Voltage Phasor V_R
    if (metrics.vResistorRms > 0.05) {
      drawPhasor(
        metrics.vResistorRms,
        metrics.vResistorPhaseRad,
        '#10b981',
        `V_R (${metrics.vResistorRms.toFixed(metrics.vResistorRms < 10 ? 2 : 1)}V)`
      );
    }

    // 2. Inductor Voltage Phasor V_L
    if (metrics.vInductorRms > 0.05) {
      drawPhasor(
        metrics.vInductorRms,
        metrics.vInductorPhaseRad,
        '#f59e0b',
        `V_L (${metrics.vInductorRms.toFixed(metrics.vInductorRms < 10 ? 2 : 1)}V)`
      );
    }

    // 3. Capacitor Voltage Phasor V_C
    if (metrics.vCapacitorRms > 0.05) {
      drawPhasor(
        metrics.vCapacitorRms,
        metrics.vCapacitorPhaseRad,
        '#a855f7',
        `V_C (${metrics.vCapacitorRms.toFixed(metrics.vCapacitorRms < 10 ? 2 : 1)}V)`
      );
    }

    // 4. Source Voltage Phasor V_s
    drawPhasor(
      metrics.vSourceRms,
      metrics.vSourcePhaseRad,
      '#38bdf8',
      `V_s (${metrics.vSourceRms.toFixed(metrics.vSourceRms < 10 ? 2 : 1)}V)`,
      2.8
    );

    // 5. Current Phasor I
    if (metrics.iRms > 0.001) {
      const currentAngleRad = metrics.phiIRad;
      const currentLength = radius * 0.75;
      const iEndX = centerX + currentLength * Math.cos(currentAngleRad);
      const iEndY = centerY - currentLength * Math.sin(currentAngleRad);

      ctx.save();
      ctx.strokeStyle = '#06b6d4';
      ctx.fillStyle = '#06b6d4';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([4, 2]);

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(iEndX, iEndY);
      ctx.stroke();
      ctx.setLineDash([]);

      const iHead = 7;
      const iAngle = -currentAngleRad;
      ctx.beginPath();
      ctx.moveTo(iEndX, iEndY);
      ctx.lineTo(
        iEndX - iHead * Math.cos(iAngle - Math.PI / 6),
        iEndY - iHead * Math.sin(iAngle - Math.PI / 6)
      );
      ctx.lineTo(
        iEndX - iHead * Math.cos(iAngle + Math.PI / 6),
        iEndY - iHead * Math.sin(iAngle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();

      const iTextX = centerX + (currentLength + 14) * Math.cos(currentAngleRad);
      const iTextY = centerY - (currentLength + 14) * Math.sin(currentAngleRad);
      ctx.font = '9.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`I (${metrics.iRms.toFixed(2)}A)`, iTextX, iTextY);

      // Draw angle arc
      if (Math.abs(metrics.phiIDeg) > 2) {
        const arcRadius = 32;
        ctx.beginPath();
        ctx.strokeStyle = metrics.phiIDeg < 0 ? '#f59e0b' : '#a855f7';
        ctx.lineWidth = 1.2;
        const startAngle = 0;
        const endAngle = -metrics.phiIRad;
        ctx.arc(centerX, centerY, arcRadius, startAngle, endAngle, metrics.phiIDeg > 0);
        ctx.stroke();

        ctx.fillStyle = metrics.phiIDeg < 0 ? '#f59e0b' : '#a855f7';
        ctx.font = '8px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        const midAngle = currentAngleRad / 2;
        ctx.fillText(
          `θ_Z=${Math.abs(metrics.zThetaDeg).toFixed(0)}°`,
          centerX + (arcRadius + 14) * Math.cos(midAngle),
          centerY - (arcRadius + 14) * Math.sin(midAngle)
        );
      }
      ctx.restore();
    }

    ctx.restore();
  }, [metrics, isDark]);

  useEffect(() => {
    drawPhasorPlot();
  }, [drawPhasorPlot]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex flex-col justify-between overflow-hidden select-none"
    >
      <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#080c14]/80 backdrop-blur-sm z-10 text-[11px] font-mono">
        <span className="font-bold text-slate-700 dark:text-slate-300">
          Phasor View
        </span>
        <span className="text-[10px] text-slate-500">
          {metrics.isUnboundedCurrent
            ? 'Current: Unbounded'
            : metrics.isOpenCircuit
            ? 'Open Circuit (I = 0)'
            : `Error: ${metrics.phasorSumError.toFixed(3)} V`}
        </span>
      </div>

      <div className="flex-1 w-full h-full min-h-0">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
    </div>
  );
};
