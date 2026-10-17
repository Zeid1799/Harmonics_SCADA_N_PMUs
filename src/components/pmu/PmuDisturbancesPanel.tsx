import React, { useState } from 'react';
import {
  PmuClass,
  PmuReportingRate,
  PmuSettings,
  PmuMeasurementSnapshot,
  InjectedDisturbance,
  Zone3Probabilities,
  getDisturbanceColor,
} from '../../types/pmu';
import { AppTheme } from '../../types/settings';
import { getZone1Limit, getZone2Nyquist, determineDisturbanceZone } from '../../model/pmuModel';
import {
  Zap,
  Trash2,
  Sliders,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface PmuDisturbancesPanelProps {
  settings: PmuSettings;
  onUpdateSettings: (updater: (prev: PmuSettings) => PmuSettings) => void;
  snapshot: PmuMeasurementSnapshot;
  disturbances: InjectedDisturbance[];
  onUpdateDisturbances: (updater: (prev: InjectedDisturbance[]) => InjectedDisturbance[]) => void;
  onTakeNewMeasurement: () => void;
  theme?: AppTheme;
}

const REPORTING_RATE_OPTIONS: PmuReportingRate[] = [10, 12, 15, 20, 30, 60];

export const PmuDisturbancesPanel: React.FC<PmuDisturbancesPanelProps> = ({
  settings,
  onUpdateSettings,
  snapshot,
  disturbances,
  onUpdateDisturbances,
  onTakeNewMeasurement,
  theme = 'dark',
}) => {
  const isDark = theme !== 'light';
  // Reporting rate hover popup state
  const [hoveredRate, setHoveredRate] = useState<PmuReportingRate | null>(null);
  const [showAdvancedProbs, setShowAdvancedProbs] = useState<boolean>(false);

  const handleReportingRateChange = (rate: PmuReportingRate) => {
    onUpdateSettings((prev) => ({
      ...prev,
      reportingRate: rate,
    }));
  };

  const handleClassChange = (pmuClass: PmuClass) => {
    onUpdateSettings((prev) => ({
      ...prev,
      pmuClass,
    }));
  };

  const handleToggleDisturbance = (id: string) => {
    onUpdateDisturbances((prev) =>
      prev.map((d) => (d.id === id ? { ...d, enabled: !d.enabled } : d))
    );
  };

  const handleDeleteDisturbance = (id: string) => {
    onUpdateDisturbances((prev) => prev.filter((d) => d.id !== id));
  };

  const handleProbChange = (field: keyof Zone3Probabilities, val: number) => {
    const clamped = Math.max(0, Math.min(1, Math.round(val * 100) / 100));
    onUpdateSettings((prev) => ({
      ...prev,
      probabilities: {
        ...prev.probabilities,
        [field]: clamped,
      },
    }));
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d121f] p-2.5 sm:p-3 shadow-md flex flex-col justify-start gap-2 h-full select-none font-mono text-xs overflow-hidden min-w-0">
      {/* 1. Header: Settings & Dynamic Zone Readouts */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-200 dark:border-slate-800/80 pb-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="p-1 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 shrink-0">
            <Zap className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 truncate">
            PMU Settings & Injected Disturbances
          </h3>
        </div>

        {/* Zones Telemetry Chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] shrink-0">
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-bold shrink-0">
            <span>Z1: ±{snapshot.zone1Limit}Hz</span>
          </div>
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-700 dark:text-sky-400 font-bold shrink-0">
            <span>Z2: ±{snapshot.zone2Limit}Hz</span>
          </div>
          <button
            onClick={onTakeNewMeasurement}
            title="Take new PMU measurement (fresh Zone 3 Bernoulli trials)"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-400 font-bold transition-all shrink-0"
          >
            <RefreshCw className="w-2.5 h-2.5" />
            <span>Re-Sample</span>
          </button>
        </div>
      </div>

      {/* 2. Settings Row: Reporting Rate & PMU Class */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {/* Reporting Rate with Dynamic FYI Hover Tooltip */}
        <div className="space-y-1 relative">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-600 dark:text-slate-400 font-bold">Reporting Rate:</span>
            <span className="text-cyan-600 dark:text-cyan-400 text-[10px]">Nyquist: {snapshot.zone2Limit} Hz</span>
          </div>
          <div className="grid grid-cols-6 gap-1 relative">
            {REPORTING_RATE_OPTIONS.map((rate) => {
              const isSelected = settings.reportingRate === rate;
              return (
                <button
                  key={rate}
                  onClick={() => handleReportingRateChange(rate)}
                  onMouseEnter={() => setHoveredRate(rate)}
                  onMouseLeave={() => setHoveredRate(null)}
                  className={`py-1 rounded text-center text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-cyan-500 text-slate-950 shadow-sm border border-cyan-400'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {rate}
                </button>
              );
            })}

            {/* Dynamic FYI Hover Tooltip for Reporting Rate */}
            {hoveredRate !== null && (
              <div
                role="tooltip"
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-[#0c1220]/95 backdrop-blur-md shadow-2xl text-left z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-100 text-[11px] font-mono"
              >
                <div className="font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-1 mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-cyan-600 dark:text-cyan-400">Reporting Rate: {hoveredRate} reports/s</span>
                  <span className="text-[10px] text-slate-400 font-normal">({hoveredRate} fps)</span>
                </div>
                <div className="space-y-1 text-[10.5px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nyquist limit:</span>
                    <span className="font-bold text-sky-600 dark:text-sky-400">{getZone2Nyquist(hoveredRate)} Hz</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">P-Class Zone 1 limit:</span>
                    <span className="font-bold text-purple-600 dark:text-purple-400">±{getZone1Limit(hoveredRate, 'P-Class')} Hz</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">M-Class Zone 1 limit:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">±{getZone1Limit(hoveredRate, 'M-Class')} Hz</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 leading-snug font-sans">
                    Increasing the reporting rate increases the Nyquist limit and may expand the standardized dynamic-performance range, depending on the selected class.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PMU Class with Dynamic Limits */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-600 dark:text-slate-400 font-bold">PMU Class:</span>
            <span className="text-emerald-600 dark:text-emerald-400 text-[10px]">Zone 1 Limit: ±{snapshot.zone1Limit} Hz</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => handleClassChange('P-Class')}
              className={`py-1 px-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                settings.pmuClass === 'P-Class'
                  ? 'bg-purple-500 text-slate-950 border-purple-400 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
              }`}
            >
              <span>P-Class</span>
              <span className="text-[10px] font-normal opacity-80">(±{getZone1Limit(settings.reportingRate, 'P-Class')}Hz)</span>
            </button>

            <button
              onClick={() => handleClassChange('M-Class')}
              className={`py-1 px-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                settings.pmuClass === 'M-Class'
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
              }`}
            >
              <span>M-Class</span>
              <span className="text-[10px] font-normal opacity-80">(±{getZone1Limit(settings.reportingRate, 'M-Class')}Hz)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Configured Injected Disturbances List & Capture Outcomes */}
      <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800/80 space-y-1.5 flex flex-col min-w-0">
        <div className="flex items-center justify-between text-[11px] min-w-0">
          <div className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300">
            <Sliders className="w-3 h-3 text-emerald-500 shrink-0" />
            <span>Injected Disturbances ({disturbances.length}):</span>
          </div>

          <button
            onClick={() => setShowAdvancedProbs(!showAdvancedProbs)}
            className="flex items-center gap-0.5 text-[9.5px] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors shrink-0"
          >
            <SlidersHorizontal className="w-2.5 h-2.5" />
            <span>Zone 3 Probabilities</span>
            {showAdvancedProbs ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
          </button>
        </div>

        {/* Collapsible Zone 3 Bernoulli Probabilities config */}
        {showAdvancedProbs && (
          <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-2 text-[10px] min-w-0 shrink-0">
            <div>
              <span className="text-slate-600 dark:text-slate-400">P(Miss):</span>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={settings.probabilities.pMiss}
                onChange={(e) => handleProbChange('pMiss', parseFloat(e.target.value) || 0)}
                className="w-full mt-0.5 px-1 py-0.5 text-xs text-center rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
              />
            </div>
            <div>
              <span className="text-slate-600 dark:text-slate-400">P(Alias):</span>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={settings.probabilities.pAlias}
                onChange={(e) => handleProbChange('pAlias', parseFloat(e.target.value) || 0)}
                className="w-full mt-0.5 px-1 py-0.5 text-xs text-center rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
              />
            </div>
            <div>
              <span className="text-slate-600 dark:text-slate-400">P(Atten):</span>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={settings.probabilities.pAtten}
                onChange={(e) => handleProbChange('pAtten', parseFloat(e.target.value) || 0)}
                className="w-full mt-0.5 px-1 py-0.5 text-xs text-center rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>
        )}

        {/* Active Disturbances Items with Dedicated Stable Height & Vertical-Only Scroll */}
        <div className="space-y-1.5 h-[175px] overflow-y-auto overflow-x-hidden pr-1 min-w-0">
          {disturbances.length === 0 ? (
            <div className="h-full flex items-center justify-center p-3 text-center bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 italic">
              No disturbances injected. Use the "Add Injection" panel on the right to configure and inject disturbances.
            </div>
          ) : (
            disturbances.map((d) => {
              const outcome = snapshot.outcomes.find((o) => o.disturbanceId === d.id);
              const f0 = snapshot.nominalFundamental;
              const isAdditive = d.type === 'additive';
              const targetToneFreq = d.additiveTarget === 'upper'
                ? f0 + d.modulationFrequency
                : Math.max(0.1, f0 - d.modulationFrequency);
              const inputZone = determineDisturbanceZone(d.modulationFrequency, snapshot.zone1Limit, snapshot.zone2Limit);
              const distColor = getDisturbanceColor(d.color || d.id);

              return (
                <div
                  key={d.id}
                  className={`p-2 rounded-lg border text-[10px] space-y-1 transition-all overflow-hidden min-w-0 ${
                    !d.enabled ? 'opacity-55' : ''
                  }`}
                  style={{
                    borderLeftWidth: '3.5px',
                    borderLeftColor: isDark ? distColor.dark : distColor.light,
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.65)' : '#ffffff',
                    borderColor: isDark ? 'rgba(51, 65, 85, 0.5)' : '#e2e8f0',
                  }}
                >
                  {/* Card Header: Color Swatch, Name, Mode badge, Zone badge, and Actions */}
                  <div className="flex items-center justify-between gap-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: isDark ? distColor.dark : distColor.light }}
                        title={`Assigned Color: ${distColor.name}`}
                      />
                      <span className="font-bold text-slate-800 dark:text-slate-100 truncate max-w-[120px] sm:max-w-[160px]">
                        {d.name}
                      </span>
                      <span className="px-1 py-0.2 rounded text-[8.5px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 shrink-0">
                        {isAdditive ? 'Additive Tone' : 'AM Sidebands'}
                      </span>
                      <span
                        className={`px-1 py-0.2 rounded text-[8.5px] font-bold border shrink-0 ${
                          inputZone === 1
                            ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                            : inputZone === 2
                            ? 'bg-sky-50 dark:bg-sky-500/15 border-sky-300 dark:border-sky-500/40 text-sky-800 dark:text-sky-300'
                            : 'bg-amber-50 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        Zone {inputZone}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleToggleDisturbance(d.id)}
                        className={`px-1.5 py-0.5 rounded text-[9px] border font-bold transition-all ${
                          d.enabled
                            ? 'bg-cyan-50 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-500/40 hover:bg-cyan-100 dark:hover:bg-cyan-500/30'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {d.enabled ? 'ON' : 'OFF'}
                      </button>
                      <button
                        onClick={() => handleDeleteDisturbance(d.id)}
                        title="Delete disturbance"
                        className="p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Section 1: User's True Injected Input Settings */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[9.5px] text-slate-600 dark:text-slate-400 pl-4 border-b border-slate-200 dark:border-slate-800/80 pb-1 min-w-0">
                    <span className="break-words">
                      <strong className="text-slate-700 dark:text-slate-300 font-semibold">True:</strong> Δf = {d.modulationFrequency} Hz
                      {isAdditive
                        ? ` (${targetToneFreq} Hz tone)`
                        : ` (±${d.modulationFrequency} Hz sidebands: ${Math.round((f0 - d.modulationFrequency) * 10) / 10} & ${Math.round((f0 + d.modulationFrequency) * 10) / 10} Hz)`}
                    </span>
                    <span className="shrink-0">
                      <strong className="text-slate-700 dark:text-slate-300 font-semibold">A =</strong> {d.amplitude.toFixed(2)} pu
                    </span>
                  </div>

                  {/* Section 2: Actual PMU Capture Outcomes (Clearly separated from true settings) */}
                  <div className="text-[9.5px] pl-4 space-y-0.5 pt-0.5 min-w-0">
                    {!d.enabled ? (
                      <span className="italic text-slate-400 dark:text-slate-500">Disabled (Not injected into measurement)</span>
                    ) : !outcome || outcome.capturedComponents.length === 0 ? (
                      <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block shrink-0" />
                        <span className="break-words">{outcome?.missed ? 'Original component missed (No captured component)' : 'No captured component (Filtered out-of-band)'}</span>
                      </div>
                    ) : (
                      <div className="space-y-0.5 min-w-0">
                        {/* If original component missed in Zone 3 but aliased component was produced */}
                        {outcome.missed && (
                          <div className="text-amber-600 dark:text-amber-400 italic break-words">
                            • Original component missed (suppressed)
                          </div>
                        )}

                        {/* List every captured component with exact frequency, amplitude, and apparent zone */}
                        {outcome.capturedComponents.map((comp, idx) => (
                          <div
                            key={comp.id || idx}
                            className="flex flex-wrap items-center justify-between gap-1 text-slate-700 dark:text-slate-300 min-w-0"
                          >
                            <span className="flex items-start gap-1 min-w-0 flex-1">
                              <span
                                className="w-1.5 h-1.5 rounded-full inline-block shrink-0 mt-1"
                                style={{ backgroundColor: isDark ? distColor.dark : distColor.light }}
                              />
                              {comp.isAliased ? (
                                <span className="font-semibold text-amber-700 dark:text-amber-400 break-words leading-tight">
                                  Aliased component: {comp.frequency} Hz (apparent Δf = {comp.modulationFrequency} Hz, Zone {comp.zone})
                                </span>
                              ) : comp.isAttenuated ? (
                                <span className="text-purple-700 dark:text-purple-400 break-words leading-tight">
                                  Captured (Attenuated): {comp.frequency} Hz (Δf = {comp.modulationFrequency} Hz, Zone {comp.zone})
                                </span>
                              ) : (
                                <span className="text-emerald-700 dark:text-emerald-400 break-words leading-tight">
                                  Captured accurately: {comp.frequency} Hz (Δf = {comp.modulationFrequency} Hz, Zone {comp.zone})
                                </span>
                              )}
                            </span>
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100 shrink-0">
                              A = {comp.amplitude.toFixed(2)} pu
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
