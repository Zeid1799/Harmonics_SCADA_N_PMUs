import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WaveformState, PlaybackState } from '../../types/waveform';
import { InjectedDisturbance, PmuMeasurementSnapshot } from '../../types/pmu';
import { AppTheme } from '../../types/settings';
import {
  Compass,
  X,
  GripHorizontal,
  Radio,
  Sparkles,
  Layers,
  Clock,
} from 'lucide-react';

interface WhatIsAPhasorModalProps {
  isOpen: boolean;
  onClose: () => void;
  waveformState: WaveformState;
  playback?: PlaybackState;
  disturbances?: InjectedDisturbance[];
  snapshot?: PmuMeasurementSnapshot;
  theme?: AppTheme;
}

/**
 * Normalizes an electrical angle in degrees to [-180, 180].
 */
function normalizeAngleDeg(deg: number): number {
  let a = deg % 360;
  if (a > 180) a -= 360;
  if (a < -180) a += 360;
  return Math.round(a * 10) / 10;
}

export const WhatIsAPhasorModal: React.FC<WhatIsAPhasorModalProps> = ({
  isOpen,
  onClose,
  waveformState,
  theme = 'dark',
}) => {
  const isDark = theme !== 'light';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Position state for draggable modal window
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isWindowDraggingRef = useRef<boolean>(false);
  const windowDragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });

  // Base nominal frequency (nominal 60 Hz reference)
  const nominalF0 = 60;
  const nominalPeriodSec = 1 / nominalF0;
  const windowSec = 2 * nominalPeriodSec; // Exactly 2 nominal cycles (33.33 ms)

  // Interactive educational controls inside popup
  const [phiDeg, setPhiDeg] = useState<number>(() => normalizeAngleDeg(waveformState.phase ?? 30));
  const [ampPu, setAmpPu] = useState<number>(() => Math.max(0.2, Math.min(1.5, waveformState.fundamentalAmplitude ?? 1.0)));
  const [demoFreq, setDemoFreq] = useState<number>(60); // 60 Hz nominal or 61 Hz off-nominal demo

  // Reset interactive controls to waveformState when modal opens
  useEffect(() => {
    if (isOpen) {
      setPosition({ x: 0, y: 0 });
      setPhiDeg(normalizeAngleDeg(waveformState.phase ?? 30));
      setAmpPu(Math.max(0.2, Math.min(1.5, waveformState.fundamentalAmplitude ?? 1.0)));
      setDemoFreq(60);
    }
  }, [isOpen, waveformState.phase, waveformState.fundamentalAmplitude]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Window drag handlers
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, textarea, a')) {
      return;
    }
    isWindowDraggingRef.current = true;
    windowDragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
    };
    e.preventDefault();
  };

  const handleHeaderTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, textarea, a')) {
      return;
    }
    const touch = e.touches[0];
    isWindowDraggingRef.current = true;
    windowDragStartRef.current = {
      mouseX: touch.clientX,
      mouseY: touch.clientY,
      startX: position.x,
      startY: position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isWindowDraggingRef.current) return;
      const dx = e.clientX - windowDragStartRef.current.mouseX;
      const dy = e.clientY - windowDragStartRef.current.mouseY;
      const nextX = windowDragStartRef.current.startX + dx;
      const nextY = windowDragStartRef.current.startY + dy;

      const maxOffsetX = Math.max(100, window.innerWidth / 2 - 140);
      const maxOffsetY = Math.max(100, window.innerHeight / 2 - 80);
      setPosition({
        x: Math.max(-maxOffsetX, Math.min(maxOffsetX, nextX)),
        y: Math.max(-maxOffsetY, Math.min(maxOffsetY, nextY)),
      });
    };

    const handleMouseUp = () => {
      isWindowDraggingRef.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isWindowDraggingRef.current) return;
      const touch = e.touches[0];
      const dx = touch.clientX - windowDragStartRef.current.mouseX;
      const dy = touch.clientY - windowDragStartRef.current.mouseY;
      const nextX = windowDragStartRef.current.startX + dx;
      const nextY = windowDragStartRef.current.startY + dy;

      const maxOffsetX = Math.max(100, window.innerWidth / 2 - 140);
      const maxOffsetY = Math.max(100, window.innerHeight / 2 - 80);
      setPosition({
        x: Math.max(-maxOffsetX, Math.min(maxOffsetX, nextX)),
        y: Math.max(-maxOffsetY, Math.min(maxOffsetY, nextY)),
      });
    };

    const handleTouchEnd = () => {
      isWindowDraggingRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  // Mathematical variables for educational visualization
  const phiRad = (phiDeg * Math.PI) / 180;
  const rmsVal = (ampPu / Math.SQRT2).toFixed(2);
  // Time displacement for 60 Hz nominal cycle: deltaT = -phi / (360 * 60)
  const deltaTMs = -(phiDeg / (360 * nominalF0)) * 1000;

  // Synchronized static canvas render
  const renderCanvas = useCallback(() => {
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

    // Background color
    ctx.fillStyle = isDark ? '#080d1a' : '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // Color Palette
    const colors = {
      gridLine: isDark ? '#1e293b' : '#e2e8f0',
      axisLine: isDark ? '#334155' : '#cbd5e1',
      textPrimary: isDark ? '#f1f5f9' : '#0f172a',
      textMuted: isDark ? '#94a3b8' : '#64748b',
      textDim: isDark ? '#64748b' : '#94a3b8',
      refWave: isDark ? 'rgba(148, 163, 184, 0.75)' : 'rgba(100, 116, 139, 0.85)',
      userWave: isDark ? '#00f0ff' : '#0284c7', // Vibrant Cyan
      phasorUser: isDark ? '#00f0ff' : '#0284c7',
      phasorRef: isDark ? '#94a3b8' : '#64748b',
      arcAngle: '#f59e0b', // Warm Amber
    };

    // Responsive split: Left 38% = Polar Phasor Diagram, Right 62% = Stationary Waveforms
    const polarWidth = Math.min(width * 0.38, 270);
    const polarCenterX = polarWidth / 2;
    const polarCenterY = height / 2;
    const polarRadius = Math.min(polarWidth / 2 - 25, height / 2 - 28);

    // Dynamic scale: 1.5 pu maps to polarRadius
    const maxPolarAmp = 1.6;
    const scalePuToPx = polarRadius / maxPolarAmp;

    // --- 1. Polar / Complex Plane (Left) ---
    // Concentric magnitude rings: 0.5, 1.0, 1.5 pu
    ctx.strokeStyle = colors.gridLine;
    ctx.lineWidth = 1;
    [0.5, 1.0, 1.5].forEach((rPu) => {
      const rPx = rPu * scalePuToPx;
      ctx.beginPath();
      ctx.arc(polarCenterX, polarCenterY, rPx, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = colors.textDim;
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${rPu.toFixed(1)}pu`, polarCenterX + 3, polarCenterY - rPx + 11);
    });

    // Crosshair axes (Real and Imaginary)
    ctx.beginPath();
    ctx.strokeStyle = colors.axisLine;
    ctx.lineWidth = 1.2;
    // Horizontal Real axis (0° phase reference line)
    ctx.moveTo(polarCenterX - polarRadius - 8, polarCenterY);
    ctx.lineTo(polarCenterX + polarRadius + 14, polarCenterY);
    // Vertical Imaginary axis (+j)
    ctx.moveTo(polarCenterX, polarCenterY - polarRadius - 10);
    ctx.lineTo(polarCenterX, polarCenterY + polarRadius + 10);
    ctx.stroke();

    ctx.fillStyle = colors.textMuted;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('Re', polarCenterX + polarRadius + 16, polarCenterY - 4);
    ctx.textAlign = 'center';
    ctx.fillText('+j Im', polarCenterX, polarCenterY - polarRadius - 12);

    // Reference Phasor Vector: 1.00 pu at 0° (along +Re axis)
    const refLenPx = 1.0 * scalePuToPx;
    ctx.save();
    ctx.strokeStyle = colors.phasorRef;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(polarCenterX, polarCenterY);
    ctx.lineTo(polarCenterX + refLenPx, polarCenterY);
    ctx.stroke();

    // Arrowhead for Reference Phasor
    ctx.fillStyle = colors.phasorRef;
    ctx.beginPath();
    ctx.moveTo(polarCenterX + refLenPx, polarCenterY);
    ctx.lineTo(polarCenterX + refLenPx - 7, polarCenterY - 3.5);
    ctx.lineTo(polarCenterX + refLenPx - 7, polarCenterY + 3.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = colors.phasorRef;
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('V_ref (0°)', polarCenterX + refLenPx, polarCenterY + 12);

    // User Phasor Vector: Amplitude A at angle phi
    const userLenPx = ampPu * scalePuToPx;
    const tipUserX = polarCenterX + userLenPx * Math.cos(phiRad);
    const tipUserY = polarCenterY - userLenPx * Math.sin(phiRad); // Canvas Y inverted

    // Trajectory circle at radius A
    ctx.beginPath();
    ctx.strokeStyle = isDark ? 'rgba(0, 240, 255, 0.25)' : 'rgba(2, 132, 199, 0.25)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 3]);
    ctx.arc(polarCenterX, polarCenterY, userLenPx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw User Phasor Arrow
    ctx.save();
    if (isDark) {
      ctx.shadowColor = colors.phasorUser;
      ctx.shadowBlur = 6;
    }
    ctx.beginPath();
    ctx.strokeStyle = colors.phasorUser;
    ctx.lineWidth = 2.5;
    ctx.moveTo(polarCenterX, polarCenterY);
    ctx.lineTo(tipUserX, tipUserY);
    ctx.stroke();

    // Arrowhead at User Phasor tip
    const arrowLen = 9;
    const angleUser = Math.atan2(polarCenterY - tipUserY, tipUserX - polarCenterX);
    ctx.fillStyle = colors.phasorUser;
    ctx.beginPath();
    ctx.moveTo(tipUserX, tipUserY);
    ctx.lineTo(
      tipUserX - arrowLen * Math.cos(angleUser - Math.PI / 7),
      tipUserY + arrowLen * Math.sin(angleUser - Math.PI / 7)
    );
    ctx.lineTo(
      tipUserX - arrowLen * Math.cos(angleUser + Math.PI / 7),
      tipUserY + arrowLen * Math.sin(angleUser + Math.PI / 7)
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Phase Angle Arc from 0° Reference to User Phasor
    if (Math.abs(phiDeg) > 0.5) {
      const arcR = Math.min(34, userLenPx * 0.5);
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = colors.arcAngle;
      ctx.lineWidth = 2.0;
      // In canvas: 0 rad is at +Re. Counter-clockwise is negative canvas angle
      const startAngle = 0;
      const endAngle = -phiRad;
      ctx.arc(polarCenterX, polarCenterY, arcR, startAngle, endAngle, phiDeg < 0);
      ctx.stroke();

      const midAngle = endAngle / 2;
      const labelDist = arcR + 13;
      ctx.fillStyle = colors.arcAngle;
      ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `φ: ${phiDeg >= 0 ? '+' : ''}${phiDeg.toFixed(0)}°`,
        polarCenterX + labelDist * Math.cos(midAngle),
        polarCenterY + labelDist * Math.sin(midAngle)
      );
      ctx.restore();
    }

    // Divider Line between Polar and Waveform sections
    ctx.beginPath();
    ctx.strokeStyle = colors.gridLine;
    ctx.lineWidth = 1;
    ctx.moveTo(polarWidth, 10);
    ctx.lineTo(polarWidth, height - 10);
    ctx.stroke();

    // --- 2. Stationary Time-Domain Waveforms (Right) ---
    const wavePadding = { left: polarWidth + 18, right: 20, top: 32, bottom: 28 };
    const wavePlotWidth = width - wavePadding.left - wavePadding.right;
    const wavePlotHeight = height - wavePadding.top - wavePadding.bottom;

    // Y-axis scaling [-1.7, +1.7] pu
    const yMin = -1.7;
    const yMax = 1.7;
    const ySpan = yMax - yMin;
    const timeToCanvasX = (t: number) => wavePadding.left + (t / windowSec) * wavePlotWidth;
    const valueToCanvasY = (val: number) => {
      const norm = (val - yMin) / ySpan;
      return wavePadding.top + (1 - norm) * wavePlotHeight;
    };

    const waveCenterY = valueToCanvasY(0);

    // Bounding Box
    ctx.strokeStyle = colors.gridLine;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(wavePadding.left, wavePadding.top, wavePlotWidth, wavePlotHeight);

    // Horizontal Baseline (0.0 pu)
    ctx.beginPath();
    ctx.strokeStyle = colors.axisLine;
    ctx.lineWidth = 1.2;
    ctx.moveTo(wavePadding.left, waveCenterY);
    ctx.lineTo(wavePadding.left + wavePlotWidth, waveCenterY);
    ctx.stroke();

    // Horizontal Grid Lines at ±1.0 pu
    [-1.0, 1.0].forEach((v) => {
      const y = valueToCanvasY(v);
      ctx.beginPath();
      ctx.strokeStyle = colors.gridLine;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.moveTo(wavePadding.left, y);
      ctx.lineTo(wavePadding.left + wavePlotWidth, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = colors.textDim;
      ctx.font = '8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${v > 0 ? '+1.0' : '-1.0'}pu`, wavePadding.left - 4, y + 3);
    });

    // Vertical Cycle Dividers at T0 and 2*T0
    const xT1 = timeToCanvasX(nominalPeriodSec);
    ctx.beginPath();
    ctx.strokeStyle = colors.gridLine;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.moveTo(xT1, wavePadding.top);
    ctx.lineTo(xT1, wavePadding.top + wavePlotHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    // Grid labels along time axis
    ctx.fillStyle = colors.textDim;
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('0', wavePadding.left + 2, waveCenterY + 11);
    ctx.textAlign = 'center';
    ctx.fillText(`1 Cycle (${(nominalPeriodSec * 1000).toFixed(1)}ms)`, xT1, waveCenterY + 11);
    ctx.textAlign = 'right';
    ctx.fillText(`2 Cycles (${(windowSec * 1000).toFixed(1)}ms)`, wavePadding.left + wavePlotWidth - 2, waveCenterY + 11);

    // --- Draw Waveform 1: Reference 60 Hz Wave (v_ref) ---
    // v_ref(t) = 1.00 * sin(2*pi*60*t)
    const numPoints = 240;
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = colors.refWave;
    ctx.lineWidth = 1.8;
    ctx.setLineDash([4, 3]);
    for (let i = 0; i <= numPoints; i++) {
      const tau = (i / numPoints) * windowSec;
      const yVal = 1.00 * Math.sin(2 * Math.PI * nominalF0 * tau);
      const px = timeToCanvasX(tau);
      const py = valueToCanvasY(yVal);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // --- Draw Waveform 2: User-Defined Wave (v_user) ---
    // v_user(t) = A * sin(2*pi*f*t + phi)
    ctx.save();
    if (isDark) {
      ctx.shadowColor = colors.userWave;
      ctx.shadowBlur = 4;
    }
    ctx.beginPath();
    ctx.strokeStyle = colors.userWave;
    ctx.lineWidth = 2.2;
    for (let i = 0; i <= numPoints; i++) {
      const tau = (i / numPoints) * windowSec;
      const yVal = ampPu * Math.sin(2 * Math.PI * demoFreq * tau + phiRad);
      const px = timeToCanvasX(tau);
      const py = valueToCanvasY(yVal);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();

    // --- Visual Phase Shift Annotation (Horizontal Gap between Positive Peaks) ---
    // Reference 1st positive peak: t_ref_peak = 1 / (4 * 60) = 4.167 ms
    const tRefPeak = 1 / (4 * nominalF0);
    // User 1st positive peak: 2*pi*f*t + phiRad = pi/2 -> t = (pi/2 - phiRad) / (2*pi*f)
    let tUserPeak = (Math.PI / 2 - phiRad) / (2 * Math.PI * demoFreq);
    while (tUserPeak < 0.0005) tUserPeak += 1 / demoFreq;
    while (tUserPeak > nominalPeriodSec + 0.001) tUserPeak -= 1 / demoFreq;

    const xRefPeak = timeToCanvasX(tRefPeak);
    const yRefPeak = valueToCanvasY(1.00);

    const xUserPeak = timeToCanvasX(tUserPeak);
    const yUserPeak = valueToCanvasY(ampPu);

    // Draw peak highlight dots
    ctx.fillStyle = colors.phasorRef;
    ctx.beginPath();
    ctx.arc(xRefPeak, yRefPeak, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = colors.userWave;
    ctx.beginPath();
    ctx.arc(xUserPeak, yUserPeak, 4, 0, Math.PI * 2);
    ctx.fill();

    // Horizontal Phase Shift Arrow/Annotation
    if (Math.abs(xUserPeak - xRefPeak) > 4) {
      const yAnnotation = Math.min(yRefPeak, yUserPeak) - 10;
      ctx.save();
      ctx.strokeStyle = colors.arcAngle;
      ctx.lineWidth = 1.4;

      // Guideline up from peaks
      ctx.beginPath();
      ctx.setLineDash([2, 2]);
      ctx.moveTo(xRefPeak, yRefPeak);
      ctx.lineTo(xRefPeak, yAnnotation);
      ctx.moveTo(xUserPeak, yUserPeak);
      ctx.lineTo(xUserPeak, yAnnotation);
      ctx.stroke();
      ctx.setLineDash([]);

      // Horizontal dimension line
      ctx.beginPath();
      ctx.moveTo(xRefPeak, yAnnotation);
      ctx.lineTo(xUserPeak, yAnnotation);
      ctx.stroke();

      // Dimension arrow heads
      const arrowDir = xUserPeak > xRefPeak ? 1 : -1;
      ctx.fillStyle = colors.arcAngle;
      ctx.beginPath();
      ctx.moveTo(xUserPeak, yAnnotation);
      ctx.lineTo(xUserPeak - arrowDir * 5, yAnnotation - 3);
      ctx.lineTo(xUserPeak - arrowDir * 5, yAnnotation + 3);
      ctx.closePath();
      ctx.fill();

      // Phase Shift text badge
      const midX = (xRefPeak + xUserPeak) / 2;
      ctx.fillStyle = colors.arcAngle;
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`Δφ: ${phiDeg >= 0 ? '+' : ''}${phiDeg.toFixed(0)}° (Δt: ${deltaTMs.toFixed(2)}ms)`, midX, yAnnotation - 1);
      ctx.restore();
    }

    // --- Canvas Top Legend ---
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';

    ctx.fillStyle = colors.phasorRef;
    ctx.fillText('┄ Reference: v_ref(t) = 1.00·sin(2π·60t)', wavePadding.left + 8, wavePadding.top + 14);

    ctx.fillStyle = colors.userWave;
    ctx.fillText(`━ User Signal: v_user(t) = ${ampPu.toFixed(2)}·sin(2π·${demoFreq}t ${phiDeg >= 0 ? '+' : '-'} ${Math.abs(phiDeg).toFixed(0)}°)`, wavePadding.left + 235, wavePadding.top + 14);

    ctx.restore();
  }, [
    isDark,
    phiDeg,
    phiRad,
    ampPu,
    demoFreq,
    nominalF0,
    nominalPeriodSec,
    windowSec,
    deltaTMs,
  ]);

  // Re-render canvas whenever parameters change
  useEffect(() => {
    if (!isOpen) return;
    renderCanvas();
  }, [isOpen, renderCanvas]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="What is a Phasor"
      className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        }}
        className={`pointer-events-auto w-full max-w-4xl backdrop-blur-md rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border ${
          isDark
            ? 'bg-[#0a0e1c]/95 border-cyan-500/30 text-slate-100'
            : 'bg-white/95 border-slate-300 text-slate-900'
        }`}
      >
        {/* Draggable Header */}
        <div
          onMouseDown={handleHeaderMouseDown}
          onTouchStart={handleHeaderTouchStart}
          className={`flex items-center justify-between px-5 py-3 border-b shrink-0 cursor-move select-none active:cursor-grabbing ${
            isDark ? 'border-slate-800 bg-[#060a14]/90' : 'border-slate-200 bg-slate-50/90'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold font-mono">What Is a Phasor? Understanding Power-System Measurements</h2>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                    isDark
                      ? 'text-slate-400 bg-slate-800/80 border-slate-700/50'
                      : 'text-slate-500 bg-slate-100 border-slate-200'
                  }`}
                >
                  <GripHorizontal className="w-3 h-3 text-slate-400" />
                  drag window to move
                </span>
              </div>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                A guide to waveform amplitude, frequency, phase angle, and synchronized phasor measurements
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close dialog"
            className={`p-1.5 rounded-lg transition-colors ${
              isDark
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section 5: Small Educational Illustration Inside Popup */}
        <div
          className={`w-full h-56 sm:h-64 relative border-b select-none shrink-0 ${
            isDark ? 'bg-[#080d1a] border-slate-800' : 'bg-[#f8fafc] border-slate-200'
          }`}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full block"
            title="Interactive illustration comparing reference and shifted sine waves with corresponding polar phasor"
          />
        </div>

        {/* Section 5: Interactive Phase & Amplitude Controls */}
        <div
          className={`px-4 sm:px-5 py-2.5 border-b space-y-2 shrink-0 font-mono text-xs ${
            isDark ? 'bg-[#070b16] border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          {/* Phase Angle Control Slider */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-[280px]">
              <span className="text-[11px] font-bold text-amber-500 dark:text-amber-400 shrink-0 w-32">
                Phase Angle (φ):
              </span>
              <input
                type="range"
                min={-180}
                max={180}
                step={1}
                value={phiDeg}
                onChange={(e) => setPhiDeg(parseFloat(e.target.value))}
                className="flex-1 h-2 rounded-lg appearance-none cursor-ew-resize accent-amber-500 bg-slate-200 dark:bg-slate-700"
                aria-label="Phase Angle Slider"
              />
              <span className="font-bold text-amber-500 dark:text-amber-400 text-xs w-20 text-right shrink-0">
                {phiDeg >= 0 ? '+' : ''}{phiDeg.toFixed(0)}° ({phiRad.toFixed(2)} rad)
              </span>
            </div>

            {/* Quick Phase Presets */}
            <div className="flex items-center gap-1 shrink-0 text-[10px]">
              <span className={`text-[10px] mr-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Presets:</span>
              <button
                onClick={() => setPhiDeg(0)}
                className={`px-1.5 py-0.5 rounded border transition-colors ${
                  phiDeg === 0
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 font-bold'
                    : 'border-slate-300 dark:border-slate-700 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
                title="In Phase (0°)"
              >
                0° (In Phase)
              </button>
              <button
                onClick={() => setPhiDeg(30)}
                className={`px-1.5 py-0.5 rounded border transition-colors ${
                  phiDeg === 30
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 font-bold'
                    : 'border-slate-300 dark:border-slate-700 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
                title="Leading by +30°"
              >
                +30° (Lead)
              </button>
              <button
                onClick={() => setPhiDeg(90)}
                className={`px-1.5 py-0.5 rounded border transition-colors ${
                  phiDeg === 90
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 font-bold'
                    : 'border-slate-300 dark:border-slate-700 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
                title="Quarter-cycle shift (+90°)"
              >
                +90° (¼ Cycle)
              </button>
              <button
                onClick={() => setPhiDeg(-45)}
                className={`px-1.5 py-0.5 rounded border transition-colors ${
                  phiDeg === -45
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 font-bold'
                    : 'border-slate-300 dark:border-slate-700 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
                title="Lagging by -45°"
              >
                -45° (Lag)
              </button>
              <button
                onClick={() => setPhiDeg(180)}
                className={`px-1.5 py-0.5 rounded border transition-colors ${
                  Math.abs(phiDeg) === 180
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 font-bold'
                    : 'border-slate-300 dark:border-slate-700 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
                title="Inverted / Opposite Phase (180°)"
              >
                180° (Opposite)
              </button>
            </div>
          </div>

          {/* Amplitude Slider & Frequency Comparison Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-800/60">
            {/* Amplitude Slider */}
            <div className="flex items-center gap-2 flex-1 min-w-[280px]">
              <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 shrink-0 w-32">
                Amplitude (A):
              </span>
              <input
                type="range"
                min={0.2}
                max={1.5}
                step={0.05}
                value={ampPu}
                onChange={(e) => setAmpPu(parseFloat(e.target.value))}
                className="flex-1 h-2 rounded-lg appearance-none cursor-ew-resize accent-cyan-500 bg-slate-200 dark:bg-slate-700"
                aria-label="Amplitude Slider"
              />
              <span className="font-bold text-cyan-600 dark:text-cyan-400 text-xs w-28 text-right shrink-0">
                {ampPu.toFixed(2)} pu ({rmsVal} RMS)
              </span>
            </div>

            {/* Frequency Comparison Mode */}
            <div className="flex items-center gap-1 shrink-0 text-[10px]">
              <span className={`text-[10px] mr-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Frequency Demo:</span>
              <button
                onClick={() => setDemoFreq(60)}
                className={`px-2 py-0.5 rounded border transition-colors ${
                  demoFreq === 60
                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 font-bold'
                    : 'border-slate-300 dark:border-slate-700 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
                title="Same frequency (60 Hz vs 60 Hz): Phase difference remains constant"
              >
                f = 60 Hz (Same Freq)
              </button>
              <button
                onClick={() => setDemoFreq(61)}
                className={`px-2 py-0.5 rounded border transition-colors ${
                  demoFreq === 61
                    ? 'bg-purple-500/20 text-purple-400 border-purple-500/40 font-bold'
                    : 'border-slate-300 dark:border-slate-700 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
                title="Frequency difference (61 Hz vs 60 Hz): Observe how phase shifts continuously across cycles"
              >
                f = 61 Hz (Δf = +1 Hz)
              </button>
            </div>
          </div>
        </div>

        {/* Educational Content: Structured Explanations */}
        <div className="p-4 sm:p-5 space-y-3.5 font-sans text-xs overflow-y-auto">
          {/* Section 2: Explain What a Phasor Is */}
          <div
            className={`p-3.5 rounded-xl border space-y-2 ${
              isDark
                ? 'bg-cyan-950/20 border-cyan-800/40 text-cyan-200'
                : 'bg-cyan-50/70 border-cyan-200 text-cyan-950'
            }`}
          >
            <div className="font-bold flex items-center gap-1.5 text-cyan-700 dark:text-cyan-300 font-mono text-xs">
              <Sparkles className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
              <span>1. What Is a Phasor?</span>
            </div>
            <p className="leading-relaxed">
              In electrical power engineering, alternating current (AC) voltages and currents oscillate as sinusoids.
              A <strong>phasor</strong> (short for <em>phase vector</em>) is a compact mathematical representation that describes a sinusoidal signal at a specified frequency using just two numbers: its <strong>magnitude</strong> and its <strong>phase angle</strong>.
            </p>

            <div className="p-2.5 rounded-lg bg-white/70 dark:bg-slate-900/80 border border-cyan-200 dark:border-cyan-900/60 font-mono text-xs text-cyan-800 dark:text-cyan-300">
              <code>v(t) = A · sin(2πft + φ)</code>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
              <div className="p-2 rounded bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                <strong>Amplitude (A):</strong> The peak height of the waveform measured from zero to the positive crest. In power systems, phasors often use <em>RMS (Root-Mean-Square)</em> magnitude: <code>V_RMS = A / √2 ≈ 0.707 · A</code>.
              </div>
              <div className="p-2 rounded bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                <strong>Frequency (f):</strong> How many complete cycles the waveform completes each second, measured in Hertz (Hz). For a 60 Hz grid, one full cycle lasts <code>T = 1/60 ≈ 16.67 ms</code>.
              </div>
              <div className="p-2 rounded bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                <strong>Phase Angle (φ):</strong> The waveform&apos;s position within its cycle relative to a specified reference point in time, measured in degrees or radians.
              </div>
              <div className="p-2 rounded bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                <strong>Phasor Representation:</strong> Written as <code>V = A ∠ φ</code> (or <code>V_RMS ∠ φ</code>). Instead of tracking every instantaneous point of the wave over time, the phasor captures the steady-state sinusoid as a single vector on the complex plane.
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-300 font-semibold pt-0.5">
              Key takeaway: Amplitude is the wave&apos;s height; phase is its horizontal position within a cycle. Phase angle is NOT the frequency difference between two signals.
            </p>
          </div>

          {/* Section 3: Difference Between Phase and Frequency Difference */}
          <div
            className={`p-3.5 rounded-xl border space-y-2 ${
              isDark
                ? 'bg-purple-950/20 border-purple-800/40 text-purple-200'
                : 'bg-purple-50/70 border-purple-200 text-purple-950'
            }`}
          >
            <div className="font-bold flex items-center gap-1.5 text-purple-700 dark:text-purple-300 font-mono text-xs">
              <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
              <span>2. Phase Angle vs. Frequency Difference</span>
            </div>
            <p className="leading-relaxed">
              Consider a 60 Hz reference signal <code>v_ref(t) = 1.00 · sin(2π · 60t)</code> compared with a signal <code>v_user(t) = A · sin(2πft + φ)</code>:
            </p>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-start gap-2 p-2 rounded bg-white/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-cyan-600 dark:text-cyan-400 shrink-0">Case 1:</span>
                <div>
                  <strong>Different amplitudes, same frequency:</strong> The waveforms have different vertical heights, but they complete cycles at the exact same speed. Their relative phase remains constant.
                </div>
              </div>

              <div className="flex items-start gap-2 p-2 rounded bg-white/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-amber-600 dark:text-amber-400 shrink-0">Case 2:</span>
                <div>
                  <strong>Same frequency, different phase angles:</strong> Both waveforms oscillate at exactly 60 Hz, but one is horizontally shifted relative to the other. Their phase difference <code>Δφ</code> is constant over time.
                </div>
              </div>

              <div className="flex items-start gap-2 p-2 rounded bg-white/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-purple-600 dark:text-purple-400 shrink-0">Case 3:</span>
                <div>
                  <strong>Different frequencies:</strong> When frequencies differ (e.g. 60.1 Hz vs. 60.0 Hz), the waves advance through their cycles at different rates. The relative phase angle <strong>changes continuously over time</strong>!
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-white/70 dark:bg-slate-900/80 border border-purple-200 dark:border-purple-900/60 font-mono text-xs text-purple-800 dark:text-purple-300">
              <code>d(Δφ) / dt = 2π · Δf   (in degrees: d(Δφ°) / dt = 360° · Δf)</code>
            </div>

            <p className="text-[11px] leading-relaxed">
              This fundamental relationship shows that the <strong>rate of change of phase difference is determined by the frequency difference</strong>. For instance, a frequency mismatch of <code>Δf = 0.1 Hz</code> causes the phase angle to drift by <code>36° every second</code>, causing the phasor arrow on the complex plane to rotate.
            </p>
          </div>

          {/* Section 4: Explain the Sliding-Window Connection & PMU */}
          <div
            className={`p-3.5 rounded-xl border space-y-2 ${
              isDark
                ? 'bg-slate-900/80 border-slate-800 text-slate-300'
                : 'bg-slate-100/80 border-slate-200 text-slate-800'
            }`}
          >
            <div className="font-bold flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-mono text-xs">
              <Radio className="w-4 h-4 text-amber-500 shrink-0" />
              <span>3. The Sliding Window & How PMUs Measure Synchrophasors</span>
            </div>
            <p className="leading-relaxed">
              A <strong>sliding window</strong> is a finite collection of continuous waveform samples gathered over a short time interval (typically 1 to 2 cycles, e.g. 16.7 ms at 60 Hz) used to estimate signal properties.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[10.5px]">
              <div className="p-2 rounded bg-white/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-amber-500 block mb-0.5">1. Sample</span>
                Collect discrete voltage or current samples over the time window.
              </div>
              <div className="p-2 rounded bg-white/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-amber-500 block mb-0.5">2. Estimate</span>
                Calculate the magnitude and phase at the nominal frequency (e.g. via DFT).
              </div>
              <div className="p-2 rounded bg-white/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-amber-500 block mb-0.5">3. Timestamp</span>
                Tag the estimated phasor with an exact GPS sub-microsecond timestamp (UTC).
              </div>
              <div className="p-2 rounded bg-white/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <span className="font-bold text-amber-500 block mb-0.5">4. Slide</span>
                Advance the window forward by the reporting interval and repeat.
              </div>
            </div>

            <p className="text-[11px] leading-relaxed">
              <strong>Crucial distinction:</strong> The sliding window is the <em>data interval used for calculation</em>, not the phase itself. A Phasor Measurement Unit (PMU) repeats this process 10 to 60 times per second. Because every PMU synchronizes its timestamps to universal GPS time, grid operators can compare phase angles from distant substations thousands of miles apart in real time to monitor grid stability, power flow, and electromechanical oscillations.
            </p>
          </div>

          {/* Section 6: Accuracy, Harmonics, and Peak vs RMS */}
          <div
            className={`p-3 rounded-xl border space-y-1.5 ${
              isDark
                ? 'bg-slate-900/60 border-slate-800/80 text-slate-400'
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
          >
            <div className="font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-mono text-xs">
              <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>4. Technical Notes: Peak vs. RMS & Multi-Frequency Signals</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] leading-relaxed">
              <li>
                <strong>Peak vs. RMS:</strong> In pure mathematics, a sinusoid has peak amplitude <code>A</code>. In power-system standards (IEEE Std C37.118.1), synchrophasor magnitude is expressed as <strong>RMS magnitude</strong> (<code>V_RMS = A / √2 ≈ 0.707 · A</code>).
              </li>
              <li>
                <strong>Single-Frequency Representation:</strong> A conventional phasor represents a single sinusoidal component at a specified frequency (the fundamental, e.g. 60 Hz). A single phasor cannot represent harmonics or DC offset; standard PMUs use anti-aliasing filters and Fourier transforms to isolate the fundamental component.
              </li>
              <li>
                <strong>Educational Illustration:</strong> The interactive animation above provides an intuitive visual foundation of phasor principles, illustrating how magnitude and phase correspond directly to waveform height and cycle position.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`flex items-center justify-between px-5 py-3 border-t shrink-0 font-mono text-xs ${
            isDark ? 'border-slate-800 bg-[#060a14]' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
            Adjust the phase and amplitude sliders above to explore how waveform position maps to the phasor vector
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white dark:bg-cyan-500 dark:hover:bg-cyan-400 dark:text-slate-950 font-bold transition-all shadow-md shadow-cyan-600/20 active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
