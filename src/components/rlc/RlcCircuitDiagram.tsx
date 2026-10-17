import React from 'react';
import {
  RlcCircuitConfig,
  RlcCircuitMetrics,
  RlcActiveComponent,
  RlcTopologyConfig,
  RlcSimulationMode,
  DEFAULT_RLC_TOPOLOGY,
} from '../../types/rlcCircuit';
import { AppTheme } from '../../types/settings';

interface RlcCircuitDiagramProps {
  config: RlcCircuitConfig;
  topology?: RlcTopologyConfig;
  metrics: RlcCircuitMetrics;
  activeComponent: RlcActiveComponent;
  onSelectComponent: (component: RlcActiveComponent) => void;
  theme?: AppTheme;
  currentTimeSec?: number;
  isPlaying?: boolean;
  instantaneousCurrent?: number;
  simulationMode?: RlcSimulationMode;
}

export const RlcCircuitDiagram: React.FC<RlcCircuitDiagramProps> = ({
  config,
  topology = DEFAULT_RLC_TOPOLOGY,
  metrics,
  activeComponent,
  onSelectComponent,
  theme = 'dark',
  currentTimeSec = 0,
  isPlaying = false,
  instantaneousCurrent,
  simulationMode = 'steady',
}) => {
  const isDark = theme === 'dark';

  // Component states
  const isResistorBypassed = topology.resistor === 'bypassed';
  const isInductorBypassed = topology.inductor === 'bypassed';
  const isCapacitorRemoved = topology.capacitor === 'removed';
  const isCapacitorBypassed = topology.capacitor === 'bypassed';

  // Instantaneous current calculation for animated direction & flow
  const omega = 2 * Math.PI * config.frequency;
  const isUnbounded = metrics.isUnboundedCurrent;
  const isOpen = metrics.isOpenCircuit;

  const instCurrent =
    instantaneousCurrent !== undefined
      ? instantaneousCurrent
      : isUnbounded || isOpen
      ? 0
      : metrics.iPeak * Math.sin(omega * currentTimeSec + metrics.phiIRad);
  const currentMagnitude = Math.abs(instCurrent);

  // Animated stroke dash offset to show current circulating
  const speedFactor = (config.frequency / 60) * (isPlaying ? 1 : 0);
  const dashOffset = (currentTimeSec * 120 * speedFactor * (instCurrent >= 0 ? -1 : 1)) % 24;

  const strokeWire = isDark ? '#475569' : '#94a3b8';
  const textPrimary = isDark ? '#f8fafc' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const textMuted = isDark ? '#64748b' : '#94a3b8';

  const isSourceActive = activeComponent === 'source';
  const isResistorActive = activeComponent === 'resistor';
  const isInductorActive = activeComponent === 'inductor';
  const isCapacitorActive = activeComponent === 'capacitor';

  return (
    <div className="w-full h-full flex flex-col justify-between p-2.5 select-none overflow-hidden">
      {/* Header bar with component status */}
      <div className="shrink-0 flex items-center justify-between text-xs font-mono pb-1 border-b border-slate-200 dark:border-slate-800">
        <span className="font-semibold text-slate-700 dark:text-slate-300">
          Series RLC Schematic{simulationMode === 'transient' ? ' (Transient)' : ''}
        </span>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-slate-500">i(t):</span>
          <span
            className={`font-mono font-bold ${
              isUnbounded
                ? 'text-rose-500'
                : isOpen
                ? 'text-purple-500'
                : instCurrent > 0.001
                ? 'text-emerald-500'
                : instCurrent < -0.001
                ? 'text-amber-500'
                : 'text-slate-400'
            }`}
          >
            {isUnbounded ? 'Unbounded' : isOpen ? '0.000 A (Open Circuit)' : `${instCurrent.toFixed(3)} A`}
          </span>
        </div>
      </div>

      {/* SVG Circuit Schematic */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center">
        <svg
          viewBox="0 0 520 250"
          className="w-full h-full max-h-[220px] overflow-visible"
        >
          <defs>
            <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-emerald" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-amber" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-purple" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* 1. Closed Circuit Loop Wires */}
          <path d="M 70 50 L 190 50" stroke={strokeWire} strokeWidth="2.5" fill="none" />
          <path d="M 290 50 L 420 50" stroke={strokeWire} strokeWidth="2.5" fill="none" />
          <path d="M 420 100 L 420 200" stroke={strokeWire} strokeWidth="2.5" fill="none" />
          <path d="M 420 200 L 275 200" stroke={strokeWire} strokeWidth="2.5" fill="none" />
          <path d="M 245 200 L 70 200" stroke={strokeWire} strokeWidth="2.5" fill="none" />
          <path d="M 70 200 L 70 150" stroke={strokeWire} strokeWidth="2.5" fill="none" />
          <path d="M 70 90 L 70 50" stroke={strokeWire} strokeWidth="2.5" fill="none" />

          {/* Animated Current Flow Overlay on Loop (only when not open and not unbounded) */}
          {isPlaying && !isOpen && !isUnbounded && currentMagnitude > 0.005 && (
            <path
              d="M 70 50 L 420 50 L 420 200 L 70 200 Z"
              stroke="#06b6d4"
              strokeWidth="2.5"
              strokeDasharray="6 12"
              strokeDashoffset={dashOffset}
              strokeOpacity={Math.min(1, currentMagnitude * 2 + 0.3)}
              fill="none"
              className="pointer-events-none"
            />
          )}

          {/* Current Flow Arrow Marker */}
          <g transform="translate(130, 44)">
            <polygon
              points={instCurrent >= 0 ? '0,-4 8,0 0,4' : '8,-4 0,0 8,4'}
              fill={isOpen ? '#94a3b8' : '#06b6d4'}
              className="transition-transform duration-200"
            />
            <text
              x="12"
              y="2"
              fill={isOpen ? '#94a3b8' : '#06b6d4'}
              fontSize="10"
              fontFamily="monospace"
              fontWeight="bold"
            >
              {isOpen ? 'i=0' : 'i(t)'}
            </text>
          </g>

          {/* 2. AC Voltage Source Component */}
          <g
            className="cursor-pointer group"
            onClick={() => onSelectComponent(isSourceActive ? null : 'source')}
            filter={isSourceActive ? 'url(#glow-cyan)' : undefined}
          >
            <circle cx="70" cy="120" r="38" fill="transparent" />
            <circle
              cx="70"
              cy="120"
              r="28"
              fill={isDark ? '#0b1329' : '#e0f2fe'}
              stroke={isSourceActive ? '#06b6d4' : isDark ? '#38bdf8' : '#0284c7'}
              strokeWidth={isSourceActive ? '3' : '2'}
              className="transition-all"
            />
            <path
              d="M 54 120 Q 62 106 70 120 T 86 120"
              stroke={isSourceActive ? '#06b6d4' : isDark ? '#38bdf8' : '#0284c7'}
              strokeWidth="2.5"
              fill="none"
            />
            <text
              x="70"
              y="164"
              textAnchor="middle"
              fill={textPrimary}
              fontSize="11"
              fontFamily="monospace"
              fontWeight="bold"
            >
              V_s (AC)
            </text>
            <text
              x="70"
              y="178"
              textAnchor="middle"
              fill={textSecondary}
              fontSize="9.5"
              fontFamily="monospace"
            >
              {config.vSourceRms} V RMS
            </text>
            <text
              x="70"
              y="190"
              textAnchor="middle"
              fill={textMuted}
              fontSize="9"
              fontFamily="monospace"
            >
              {config.frequency} Hz
            </text>
          </g>

          {/* 3. Resistor Component (R) */}
          <g
            className="cursor-pointer group"
            onClick={() => onSelectComponent(isResistorActive ? null : 'resistor')}
            filter={isResistorActive ? 'url(#glow-emerald)' : undefined}
          >
            <rect x="180" y="20" width="120" height="60" fill="transparent" />
            {isResistorBypassed ? (
              // Bypassed: dashed ideal wire
              <line
                x1="190"
                y1="50"
                x2="290"
                y2="50"
                stroke={isResistorActive ? '#10b981' : isDark ? '#64748b' : '#94a3b8'}
                strokeWidth="2.5"
                strokeDasharray="5 3"
              />
            ) : config.resistance === 0 ? (
              // Straight ideal short-circuit wire
              <line
                x1="190"
                y1="50"
                x2="290"
                y2="50"
                stroke={isResistorActive ? '#10b981' : isDark ? '#34d399' : '#059669'}
                strokeWidth="3.5"
              />
            ) : (
              // Standard Zig-Zag Resistor Geometry
              <path
                d="M 190 50 L 200 50 L 207 36 L 221 64 L 235 36 L 249 64 L 263 36 L 277 64 L 283 50 L 290 50"
                stroke={isResistorActive ? '#10b981' : isDark ? '#34d399' : '#059669'}
                strokeWidth={isResistorActive ? '3.5' : '2.5'}
                strokeLinejoin="round"
                fill="none"
                className="transition-all"
              />
            )}
            <text
              x="240"
              y="26"
              textAnchor="middle"
              fill={textPrimary}
              fontSize="11"
              fontFamily="monospace"
              fontWeight="bold"
            >
              {isResistorBypassed
                ? 'Resistor: Bypassed (Wire)'
                : config.resistance === 0
                ? 'R = 0 Ω (Ideal Short)'
                : `R = ${config.resistance} Ω`}
            </text>
            <text
              x="240"
              y="78"
              textAnchor="middle"
              fill={textSecondary}
              fontSize="9.5"
              fontFamily="monospace"
            >
              V_R = {isResistorBypassed ? '0.0 V' : `${metrics.vResistorRms.toFixed(1)} V RMS`}
            </text>
          </g>

          {/* 4. Inductor Component (L) */}
          <g
            className="cursor-pointer group"
            onClick={() => onSelectComponent(isInductorActive ? null : 'inductor')}
            filter={isInductorActive ? 'url(#glow-amber)' : undefined}
          >
            <rect x="380" y="30" width="80" height="90" fill="transparent" />
            {isInductorBypassed ? (
              // Bypassed: dashed ideal wire
              <line
                x1="420"
                y1="40"
                x2="420"
                y2="120"
                stroke={isInductorActive ? '#f59e0b' : isDark ? '#64748b' : '#94a3b8'}
                strokeWidth="2.5"
                strokeDasharray="5 3"
              />
            ) : config.inductanceMh === 0 ? (
              // Straight ideal short-circuit wire
              <line
                x1="420"
                y1="40"
                x2="420"
                y2="120"
                stroke={isInductorActive ? '#f59e0b' : isDark ? '#fbbf24' : '#d97706'}
                strokeWidth="3.5"
              />
            ) : (
              // Coils Geometry
              <path
                d="M 420 40 
                   A 10 10 0 0 1 420 60 
                   A 10 10 0 0 1 420 80 
                   A 10 10 0 0 1 420 100 
                   A 10 10 0 0 1 420 120"
                stroke={isInductorActive ? '#f59e0b' : isDark ? '#fbbf24' : '#d97706'}
                strokeWidth={isInductorActive ? '3.5' : '2.5'}
                fill="none"
                className="transition-all"
              />
            )}
            <text
              x="448"
              y="74"
              textAnchor="start"
              fill={textPrimary}
              fontSize="11"
              fontFamily="monospace"
              fontWeight="bold"
            >
              {isInductorBypassed
                ? 'Inductor: Bypassed'
                : config.inductanceMh === 0
                ? 'L = 0 mH (Short)'
                : `L = ${config.inductanceMh} mH`}
            </text>
            <text
              x="448"
              y="88"
              textAnchor="start"
              fill={textSecondary}
              fontSize="9.5"
              fontFamily="monospace"
            >
              {isInductorBypassed ? 'X_L = 0.0 Ω' : `X_L = ${metrics.xL.toFixed(1)} Ω`}
            </text>
            <text
              x="448"
              y="102"
              textAnchor="start"
              fill={textMuted}
              fontSize="9"
              fontFamily="monospace"
            >
              V_L = {isInductorBypassed ? '0.0 V' : isUnbounded ? 'Unbounded' : `${metrics.vInductorRms.toFixed(1)} V`}
            </text>
          </g>

          {/* 5. Capacitor Component (C) */}
          <g
            className="cursor-pointer group"
            onClick={() => onSelectComponent(isCapacitorActive ? null : 'capacitor')}
            filter={isCapacitorActive ? 'url(#glow-purple)' : undefined}
          >
            <rect x="200" y="170" width="120" height="70" fill="transparent" />
            {isCapacitorRemoved ? (
              // Removed: open circuit gap with terminal contacts
              <g>
                <circle cx="245" cy="200" r="3.5" fill={isDark ? '#080c14' : '#ffffff'} stroke="#f43f5e" strokeWidth="2" />
                <circle cx="275" cy="200" r="3.5" fill={isDark ? '#080c14' : '#ffffff'} stroke="#f43f5e" strokeWidth="2" />
              </g>
            ) : isCapacitorBypassed ? (
              // Bypassed: straight dashed wire
              <line
                x1="245"
                y1="200"
                x2="275"
                y2="200"
                stroke={isCapacitorActive ? '#a855f7' : isDark ? '#64748b' : '#94a3b8'}
                strokeWidth="2.5"
                strokeDasharray="5 3"
              />
            ) : (
              // Standard parallel capacitor plates
              <g>
                <line
                  x1="245"
                  y1="182"
                  x2="245"
                  y2="218"
                  stroke={isCapacitorActive ? '#a855f7' : isDark ? '#c084fc' : '#7e22ce'}
                  strokeWidth={isCapacitorActive ? '4' : '3'}
                  strokeLinecap="round"
                />
                <line
                  x1="275"
                  y1="182"
                  x2="275"
                  y2="218"
                  stroke={isCapacitorActive ? '#a855f7' : isDark ? '#c084fc' : '#7e22ce'}
                  strokeWidth={isCapacitorActive ? '4' : '3'}
                  strokeLinecap="round"
                />
              </g>
            )}
            <text
              x="260"
              y="235"
              textAnchor="middle"
              fill={textPrimary}
              fontSize="11"
              fontFamily="monospace"
              fontWeight="bold"
            >
              {isCapacitorRemoved
                ? 'Capacitor: Removed (Open Circuit)'
                : isCapacitorBypassed
                ? 'Capacitor: Bypassed (Wire)'
                : config.capacitanceUf === 0
                ? 'C = 0 µF (Open Circuit)'
                : `C = ${config.capacitanceUf} µF`}
            </text>
            <text
              x="260"
              y="248"
              textAnchor="middle"
              fill={textSecondary}
              fontSize="9.5"
              fontFamily="monospace"
            >
              {isCapacitorRemoved || config.capacitanceUf === 0
                ? `V_C = ${metrics.vCapacitorRms.toFixed(1)} V (Source)`
                : isCapacitorBypassed
                ? 'V_C = 0.0 V | X_C = 0.0 Ω'
                : isUnbounded
                ? 'X_C = ' + metrics.xC.toFixed(1) + ' Ω | V_C: Unbounded'
                : `X_C = ${metrics.xC.toFixed(1)} Ω | V_C = ${metrics.vCapacitorRms.toFixed(1)} V`}
            </text>
          </g>
        </svg>
      </div>

      {/* Helpful Hint */}
      <div className="shrink-0 text-[10px] text-center text-slate-500 font-mono pt-1 border-t border-slate-200 dark:border-slate-800/80">
        Click any component in the schematic to highlight and focus its parameter slider
      </div>
    </div>
  );
};
