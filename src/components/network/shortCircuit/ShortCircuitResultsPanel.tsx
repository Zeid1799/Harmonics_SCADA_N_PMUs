import React, { useState } from 'react';
import {
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { ShortCircuitSolution } from '../../../types/shortCircuit';
import { PowerNetworkModel } from '../../../types/network';

interface ShortCircuitResultsPanelProps {
  solution: ShortCircuitSolution | null;
  isStale: boolean;
  network: PowerNetworkModel;
  onSelectBus?: (busNumber: number) => void;
  onRerunCalculation?: () => void;
}

type ResultsTab = 'summary' | 'contributions' | 'voltages' | 'methodology';

export const ShortCircuitResultsPanel: React.FC<ShortCircuitResultsPanelProps> = ({
  solution,
  isStale,
  network,
  onSelectBus,
  onRerunCalculation,
}) => {
  const [activeTab, setActiveTab] = useState<ResultsTab>('summary');

  if (!solution) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 text-center text-xs text-slate-500">
        <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-2 border border-amber-500/20">
          <Zap size={20} />
        </div>
        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-1">
          No Short-Circuit Solution
        </h4>
        <p className="max-w-xs mx-auto text-slate-500 dark:text-slate-400">
          Select a faulted bus and fault type in the SC Analysis panel, then click &quot;Calculate Fault&quot; to compute fault currents and sequence quantities.
        </p>
      </div>
    );
  }

  if (!solution.converged) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-rose-300 dark:border-rose-900/60 p-5 shadow-sm text-xs">
        <div className="flex items-start gap-2.5">
          <div className="p-1.5 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 shrink-0">
            <AlertTriangle size={16} />
          </div>
          <div>
            <h4 className="font-bold text-rose-700 dark:text-rose-300 text-sm mb-1">
              Short-Circuit Calculation Error
            </h4>
            <p className="text-rose-600 dark:text-rose-400 font-mono text-[11px] leading-relaxed">
              {solution.errorMessage || 'Unknown short-circuit calculation failure.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const faultedBus = network.buses.find((b) => b.number === solution.scenario.faultedBusNumber);

  const formatComplex = (re: number, im: number, decimals: number = 4) => {
    const sign = im >= 0 ? '+' : '-';
    return `${re.toFixed(decimals)} ${sign} j${Math.abs(im).toFixed(decimals)}`;
  };

  const getFaultTypeLabel = () => {
    switch (solution.scenario.faultType) {
      case '3phase':
        return 'Three-Phase Balanced Fault (LLL-G)';
      case 'single-line-to-ground':
        return 'Single-Line-to-Ground Fault (SLG / 1LG Phase A)';
      case 'line-to-line':
        return 'Line-to-Line Fault (LL Phases B-C)';
      case 'double-line-to-ground':
        return 'Double-Line-to-Ground Fault (DLG / 2LG Phases B-C)';
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col text-xs">
      {/* Stale Warning Banner */}
      {isStale && (
        <div className="px-3.5 py-1.5 bg-amber-500/15 border-b border-amber-500/30 text-amber-800 dark:text-amber-200 flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle size={13} className="text-amber-500 shrink-0" />
            Network parameters modified since last calculation.
          </span>
          {onRerunCalculation && (
            <button
              type="button"
              onClick={onRerunCalculation}
              className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold hover:bg-amber-600 transition-colors cursor-pointer text-[10.5px]"
            >
              Recalculate
            </button>
          )}
        </div>
      )}

      {/* Executive Results Hero Banner */}
      <div className="p-4 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 text-white border-b border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
              {getFaultTypeLabel()}
            </span>
            <span className="text-slate-400 font-mono text-[11px]">
              Bus {solution.scenario.faultedBusNumber}: {faultedBus?.name} ({faultedBus?.baseKv} kV)
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            Zf = {solution.scenario.faultResistanceOhms.toFixed(1)} + j{solution.scenario.faultReactanceOhms.toFixed(1)} Ω
          </span>
        </div>

        {/* Big Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {/* Total Fault Current in kA */}
          <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/80">
            <span className="text-[10px] text-slate-400 block font-mono">Fault Current (If):</span>
            <div className="text-lg sm:text-xl font-bold font-mono text-amber-400 leading-tight mt-0.5">
              {solution.totalFaultCurrentKa.toFixed(3)}{' '}
              <span className="text-xs font-semibold text-slate-300">kA</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
              {solution.totalFaultCurrentA.toFixed(0)} A • {solution.totalFaultCurrentPu.toFixed(3)} pu
            </span>
          </div>

          {/* Fault Duty MVA */}
          <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/80">
            <span className="text-[10px] text-slate-400 block font-mono">Short-Circuit Duty:</span>
            <div className="text-lg sm:text-xl font-bold font-mono text-cyan-300 leading-tight mt-0.5">
              {solution.shortCircuitMva.toFixed(1)}{' '}
              <span className="text-xs font-semibold text-slate-300">MVA</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
              S_sc = √3 · V · I_f
            </span>
          </div>

          {/* Driving-Point Thevenin Impedance */}
          <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/80">
            <span className="text-[10px] text-slate-400 block font-mono">Thevenin Zth(1):</span>
            <div className="text-sm font-bold font-mono text-emerald-300 leading-tight mt-0.5">
              {solution.theveninImpedance.positive.mag.toFixed(4)} pu
            </div>
            <span className="text-[9.5px] text-slate-400 font-mono block mt-0.5 truncate" title={formatComplex(solution.theveninImpedance.positive.re, solution.theveninImpedance.positive.im)}>
              ∠{solution.theveninImpedance.positive.angleDeg.toFixed(1)}° (X/R={solution.xOverRRatio.toFixed(1)})
            </span>
          </div>

          {/* Voltage Sag Summary */}
          <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/80">
            <span className="text-[10px] text-slate-400 block font-mono">Severe Voltage Sags:</span>
            <div className="text-lg sm:text-xl font-bold font-mono text-rose-400 leading-tight mt-0.5">
              {solution.severeSagBusCount}{' '}
              <span className="text-xs font-semibold text-slate-300">buses</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
              V &lt; 0.70 pu during fault
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-[11px] font-mono">
        <button
          type="button"
          onClick={() => setActiveTab('summary')}
          className={`flex-1 py-2 px-3 text-center font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'summary'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          Phase & Sequence
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('contributions')}
          className={`flex-1 py-2 px-3 text-center font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'contributions'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          Contributions ({solution.branchContributions.length + solution.generatorContributions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('voltages')}
          className={`flex-1 py-2 px-3 text-center font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'voltages'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          Bus Voltages ({solution.busVoltages.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('methodology')}
          className={`py-2 px-3 text-center font-bold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'methodology'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          Method
        </button>
      </div>

      {/* Tab Contents */}
      <div className="p-3.5 overflow-y-auto max-h-[360px]">
        {/* TAB 1: Phase and Sequence Details */}
        {activeTab === 'summary' && (
          <div className="space-y-3 font-mono">
            {/* Phase Currents Table */}
            <div>
              <h5 className="font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider mb-1.5">
                Fault Currents by Phase
              </h5>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500">
                    <tr>
                      <th className="py-1 px-2.5">Phase</th>
                      <th className="py-1 px-2.5">Magnitude (kA)</th>
                      <th className="py-1 px-2.5">Magnitude (A)</th>
                      <th className="py-1 px-2.5">Per-Unit (pu)</th>
                      <th className="py-1 px-2.5">Angle (deg)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr>
                      <td className="py-1.5 px-2.5 font-bold text-amber-600 dark:text-amber-400">Phase A</td>
                      <td className="py-1.5 px-2.5 font-bold">{solution.phaseCurrentsKa.a.toFixed(3)} kA</td>
                      <td className="py-1.5 px-2.5">{solution.phaseCurrentsA.a.toFixed(1)} A</td>
                      <td className="py-1.5 px-2.5">{solution.phaseCurrentsPu.a.mag.toFixed(4)}</td>
                      <td className="py-1.5 px-2.5">{solution.phaseCurrentsPu.a.angleDeg.toFixed(1)}°</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2.5 font-bold text-cyan-600 dark:text-cyan-400">Phase B</td>
                      <td className="py-1.5 px-2.5 font-bold">{solution.phaseCurrentsKa.b.toFixed(3)} kA</td>
                      <td className="py-1.5 px-2.5">{solution.phaseCurrentsA.b.toFixed(1)} A</td>
                      <td className="py-1.5 px-2.5">{solution.phaseCurrentsPu.b.mag.toFixed(4)}</td>
                      <td className="py-1.5 px-2.5">{solution.phaseCurrentsPu.b.angleDeg.toFixed(1)}°</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2.5 font-bold text-purple-600 dark:text-purple-400">Phase C</td>
                      <td className="py-1.5 px-2.5 font-bold">{solution.phaseCurrentsKa.c.toFixed(3)} kA</td>
                      <td className="py-1.5 px-2.5">{solution.phaseCurrentsA.c.toFixed(1)} A</td>
                      <td className="py-1.5 px-2.5">{solution.phaseCurrentsPu.c.mag.toFixed(4)}</td>
                      <td className="py-1.5 px-2.5">{solution.phaseCurrentsPu.c.angleDeg.toFixed(1)}°</td>
                    </tr>
                    {solution.groundCurrentKa !== undefined && (
                      <tr className="bg-amber-500/10 font-bold">
                        <td className="py-1.5 px-2.5 text-amber-700 dark:text-amber-300">Ground (Ig)</td>
                        <td className="py-1.5 px-2.5 text-amber-700 dark:text-amber-300">{solution.groundCurrentKa.toFixed(3)} kA</td>
                        <td className="py-1.5 px-2.5 text-amber-700 dark:text-amber-300">{solution.groundCurrentA?.toFixed(1)} A</td>
                        <td className="py-1.5 px-2.5 text-amber-700 dark:text-amber-300">{solution.groundCurrentPu?.toFixed(4)}</td>
                        <td className="py-1.5 px-2.5 text-amber-700 dark:text-amber-300">3 · I0</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Symmetrical Sequence Components Table */}
            <div>
              <h5 className="font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider mb-1.5">
                Symmetrical Sequence Components
              </h5>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500">
                    <tr>
                      <th className="py-1 px-2.5">Sequence</th>
                      <th className="py-1 px-2.5">Current I_seq (pu)</th>
                      <th className="py-1 px-2.5">Angle</th>
                      <th className="py-1 px-2.5">Thevenin Z_th (pu)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr>
                      <td className="py-1.5 px-2.5 font-bold text-blue-600 dark:text-blue-400">Positive (1)</td>
                      <td className="py-1.5 px-2.5 font-bold">{solution.sequenceCurrentsPu.positive.mag.toFixed(4)} pu</td>
                      <td className="py-1.5 px-2.5">{solution.sequenceCurrentsPu.positive.angleDeg.toFixed(1)}°</td>
                      <td className="py-1.5 px-2.5 text-[10.5px]">
                        {formatComplex(solution.theveninImpedance.positive.re, solution.theveninImpedance.positive.im)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2.5 font-bold text-rose-600 dark:text-rose-400">Negative (2)</td>
                      <td className="py-1.5 px-2.5 font-bold">{solution.sequenceCurrentsPu.negative.mag.toFixed(4)} pu</td>
                      <td className="py-1.5 px-2.5">{solution.sequenceCurrentsPu.negative.angleDeg.toFixed(1)}°</td>
                      <td className="py-1.5 px-2.5 text-[10.5px]">
                        {formatComplex(solution.theveninImpedance.negative.re, solution.theveninImpedance.negative.im)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2.5 font-bold text-emerald-600 dark:text-emerald-400">Zero (0)</td>
                      <td className="py-1.5 px-2.5 font-bold">{solution.sequenceCurrentsPu.zero.mag.toFixed(4)} pu</td>
                      <td className="py-1.5 px-2.5">{solution.sequenceCurrentsPu.zero.angleDeg.toFixed(1)}°</td>
                      <td className="py-1.5 px-2.5 text-[10.5px]">
                        {formatComplex(solution.theveninImpedance.zero.re, solution.theveninImpedance.zero.im)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Source and Branch Contributions */}
        {activeTab === 'contributions' && (
          <div className="space-y-3 font-mono">
            <div>
              <h5 className="font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider mb-1.5">
                Connected Branch Inflows into Faulted Bus #{solution.scenario.faultedBusNumber}
              </h5>
              {solution.branchContributions.length === 0 ? (
                <p className="text-slate-500 text-[11px] italic">No online transmission branches connected to this bus.</p>
              ) : (
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500">
                      <tr>
                        <th className="py-1 px-2.5">Branch</th>
                        <th className="py-1 px-2.5">Type</th>
                        <th className="py-1 px-2.5">From Bus</th>
                        <th className="py-1 px-2.5">Current (kA)</th>
                        <th className="py-1 px-2.5">Share (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {solution.branchContributions.map((br) => {
                        const fromBusNum = br.connectedFromBus === solution.scenario.faultedBusNumber ? br.connectedToBus : br.connectedFromBus;
                        return (
                          <tr key={br.branchId} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                            <td className="py-1.5 px-2.5 font-bold text-slate-800 dark:text-slate-200">
                              {br.branchId}
                            </td>
                            <td className="py-1.5 px-2.5 uppercase text-[10px] text-slate-500">{br.branchType}</td>
                            <td className="py-1.5 px-2.5">Bus {fromBusNum}</td>
                            <td className="py-1.5 px-2.5 font-bold text-amber-600 dark:text-amber-400">
                              {br.currentKa.toFixed(3)} kA
                            </td>
                            <td className="py-1.5 px-2.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold">{br.percentOfTotalFaultCurrent.toFixed(1)}%</span>
                                <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-amber-500 rounded-full"
                                    style={{ width: `${Math.min(100, br.percentOfTotalFaultCurrent)}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Generator Contributions */}
            <div>
              <h5 className="font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider mb-1.5">
                Active Generator Contributions
              </h5>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500">
                    <tr>
                      <th className="py-1 px-2.5">Generator</th>
                      <th className="py-1 px-2.5">Location</th>
                      <th className="py-1 px-2.5">Fault Current</th>
                      <th className="py-1 px-2.5">Share (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {solution.generatorContributions.map((g) => (
                      <tr key={g.generatorId} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="py-1.5 px-2.5 font-bold text-slate-800 dark:text-slate-200">
                          {g.generatorName}
                        </td>
                        <td className="py-1.5 px-2.5">
                          Bus {g.busNumber} {g.busNumber === solution.scenario.faultedBusNumber ? '(LOCAL)' : ''}
                        </td>
                        <td className="py-1.5 px-2.5 font-bold text-cyan-600 dark:text-cyan-400">
                          {g.currentKa.toFixed(3)} kA ({g.currentPu.mag.toFixed(3)} pu)
                        </td>
                        <td className="py-1.5 px-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold">{g.percentOfTotalFaultCurrent.toFixed(1)}%</span>
                            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-cyan-500 rounded-full"
                                style={{ width: `${Math.min(100, g.percentOfTotalFaultCurrent)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Bus Post-Fault Voltages */}
        {activeTab === 'voltages' && (
          <div className="space-y-2 font-mono">
            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
              <span>Post-fault voltage magnitudes across all 30 buses:</span>
              <span className="text-rose-500 font-bold">{solution.severeSagBusCount} severe sags (&lt; 0.70 pu)</span>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500">
                  <tr>
                    <th className="py-1 px-2.5">Bus</th>
                    <th className="py-1 px-2.5">Base</th>
                    <th className="py-1 px-2.5">Min Voltage</th>
                    <th className="py-1 px-2.5">Phase A (pu)</th>
                    <th className="py-1 px-2.5">Phase B (pu)</th>
                    <th className="py-1 px-2.5">Phase C (pu)</th>
                    <th className="py-1 px-2.5">Sag Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {solution.busVoltages.map((bv) => (
                    <tr
                      key={bv.busNumber}
                      onClick={() => onSelectBus?.(bv.busNumber)}
                      className={`hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer ${
                        bv.isFaultedBus
                          ? 'bg-amber-500/15 font-bold text-amber-900 dark:text-amber-200'
                          : bv.isSevereSag
                          ? 'bg-rose-500/10 text-rose-800 dark:text-rose-300'
                          : ''
                      }`}
                    >
                      <td className="py-1.5 px-2.5 font-bold">
                        Bus {bv.busNumber} {bv.isFaultedBus ? '(FAULT)' : ''}
                      </td>
                      <td className="py-1.5 px-2.5 text-slate-500">{bv.baseKv} kV</td>
                      <td className="py-1.5 px-2.5 font-bold">{bv.minPhaseVoltagePu.toFixed(3)} pu</td>
                      <td className="py-1.5 px-2.5">{bv.phaseVoltagesPu.a.mag.toFixed(3)}</td>
                      <td className="py-1.5 px-2.5">{bv.phaseVoltagesPu.b.mag.toFixed(3)}</td>
                      <td className="py-1.5 px-2.5">{bv.phaseVoltagesPu.c.mag.toFixed(3)}</td>
                      <td className="py-1.5 px-2.5">
                        {bv.isFaultedBus ? (
                          <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-amber-500 text-slate-950">
                            FAULT POINT
                          </span>
                        ) : bv.isSevereSag ? (
                          <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/30">
                            SEVERE SAG ({bv.voltageSagPercent.toFixed(0)}%)
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Normal</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: Methodology Notes */}
        {activeTab === 'methodology' && (
          <div className="space-y-2.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="font-bold text-slate-900 dark:text-white block mb-1">
                Standard & Calculation Method:
              </span>
              <p>{solution.methodologyNotes.methodName} ({solution.methodologyNotes.standardReference})</p>
            </div>

            <div>
              <span className="font-bold text-slate-900 dark:text-white block mb-1">
                Sequence Network Modeling:
              </span>
              <p className="leading-relaxed text-[10.5px]">
                {solution.methodologyNotes.sequenceNetworkSummary}
              </p>
            </div>

            <div>
              <span className="font-bold text-slate-900 dark:text-white block mb-1">
                Engineering Assumptions:
              </span>
              <ul className="list-disc list-inside space-y-1 text-[10.5px]">
                {solution.methodologyNotes.assumptions.map((a, idx) => (
                  <li key={idx}>{a}</li>
                ))}
              </ul>
            </div>

            <div>
              <span className="font-bold text-slate-900 dark:text-white block mb-1">
                Technical Boundaries & Limitations:
              </span>
              <ul className="list-disc list-inside space-y-1 text-[10.5px] text-slate-500">
                {solution.methodologyNotes.technicalLimitations.map((l, idx) => (
                  <li key={idx}>{l}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
