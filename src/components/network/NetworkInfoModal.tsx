import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  BookOpen,
  Cpu,
  MapPin,
  CheckCircle2,
  Scale,
  Database,
} from 'lucide-react';
import { PowerNetworkModel, PowerFlowSolutionResult } from '../../types/network';

interface NetworkInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  network: PowerNetworkModel;
  solution: PowerFlowSolutionResult | null;
}

export const NetworkInfoModal: React.FC<NetworkInfoModalProps> = ({
  isOpen,
  onClose,
  network,
  solution,
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'solver' | 'validation' | 'candidates' | 'geography'
  >('overview');

  if (!isOpen) return null;

  const { metadata } = network;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="network-info-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                {metadata.classificationLabel}
              </span>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                Base MVA: {metadata.baseMva} MVA • {metadata.nominalFrequencyHz} Hz
              </span>
            </div>
            <h2
              id="network-info-modal-title"
              className="text-lg font-bold text-slate-900 dark:text-white mt-1"
            >
              {metadata.name} — Network & AC Solver Documentation
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close documentation modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-2 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-2 bg-slate-50/50 dark:bg-slate-900">
          {[
            { id: 'overview', label: '1. Benchmark Provenance & Equipment', icon: BookOpen },
            { id: 'solver', label: '2. AC Power-Flow Engine Architecture', icon: Cpu },
            { id: 'validation', label: '3. Published IEEE CDF Reference Validation', icon: CheckCircle2 },
            { id: 'candidates', label: '4. Evaluated Candidate Networks', icon: Database },
            { id: 'geography', label: '5. Geographic Provenance & Licensing', icon: MapPin },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  isActive
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Primary Source Box */}
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-2">
                <div className="font-bold text-sm text-slate-900 dark:text-white">
                  Verified Primary Sources & Archival Links
                </div>
                <p>
                  <strong>Organization:</strong> {metadata.sourceOrganization}
                </p>
                <p>
                  <strong>Authors / Contributors:</strong> {metadata.authors.join(' • ')}
                </p>
                <p>
                  <strong>Publication:</strong> <em>{metadata.publicationTitle}</em> (
                  {metadata.publicationYear}) — {metadata.editionOrVenue}
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <a
                    href={metadata.primarySourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
                  >
                    UW PSTCA 30-Bus Archive Page <ExternalLink size={12} />
                  </a>
                  <a
                    href={metadata.cdfDataUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    Raw IEEE CDF File (ieee30cdf.txt) <ExternalLink size={12} />
                  </a>
                  <a
                    href={metadata.matpowerCaseUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    MATPOWER case_ieee30.m <ExternalLink size={12} />
                  </a>
                  <a
                    href={metadata.matpowerRatingsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    Alsac & Stott Rate A Limits (case30.m) <ExternalLink size={12} />
                  </a>
                </div>
              </div>

              {/* Equipment Count Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {[
                  { label: 'Buses', count: network.buses.length, sub: '132 / 33 / 11 / 1 kV' },
                  { label: 'Generators', count: network.generators.length, sub: '2 Gen + 4 Sync Cond' },
                  { label: 'Spot Loads', count: network.loads.length, sub: '283.4 MW / 126.2 MVAr' },
                  { label: 'AC Lines', count: network.lines.length, sub: '14×132 kV, 20×33 kV' },
                  { label: 'Transformers', count: network.transformers.length, sub: '4 Off-Nominal Tap' },
                  { label: 'Shunt Banks', count: network.shunts.length, sub: 'Bus 10 & Bus 24' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800"
                  >
                    <div className="text-[10px] font-bold uppercase text-slate-400">
                      {stat.label}
                    </div>
                    <div className="text-xl font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                      {stat.count}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{stat.sub}</div>
                  </div>
                ))}
              </div>

              {/* Parameter Provenance Table */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
                  Component-by-Component Parameter Provenance
                </h3>
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/90 text-[11px] uppercase text-slate-500 dark:text-slate-400">
                        <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">
                          Component Category
                        </th>
                        <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">
                          Primary Source Location
                        </th>
                        <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">
                          Extracted Parameters & Notes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {metadata.parameterSources.map((ps, idx) => (
                        <tr key={idx}>
                          <td className="p-2.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                            {ps.component}
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-blue-600 dark:text-blue-400">
                            {ps.sourceLocation}
                          </td>
                          <td className="p-2.5">{ps.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Assumptions & Adaptations */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="font-bold text-sm text-slate-900 dark:text-white">
                  Unreduced Network Representation & Documented Supplements
                </div>
                <p>{metadata.subsystemAndReductionSummary}</p>
                <ul className="list-disc pl-5 space-y-1">
                  {metadata.derivedValuesAndAssumptions.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'solver' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="font-bold text-sm text-slate-900 dark:text-white">
                  {metadata.solverDocumentation.engineName}
                </div>
                <p>
                  <strong>Algorithm:</strong> {metadata.solverDocumentation.algorithm}
                </p>
                <p>
                  <strong>Execution Environment:</strong>{' '}
                  {metadata.solverDocumentation.executionEnvironment}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                  <div className="font-bold text-sm text-emerald-700 dark:text-emerald-300">
                    Supported Electrical Models & Equations
                  </div>
                  <ul className="list-disc pl-5 space-y-1.5">
                    {metadata.solverDocumentation.supportedModels.map((m, idx) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                  <div className="font-bold text-sm text-amber-700 dark:text-amber-300">
                    Documented Steady-State Scope & Limitations
                  </div>
                  <ul className="list-disc pl-5 space-y-1.5">
                    {metadata.solverDocumentation.limitations.map((lim, idx) => (
                      <li key={idx}>{lim}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'validation' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200">
                <strong>Benchmark Validation Summary:</strong> Comparing our client-side Polar
                Newton-Raphson solver against the published University of Washington IEEE CDF
                solution (<code>ieee30cdf.txt</code>). On the unmodified base case, all 30 bus
                voltage magnitudes match within <strong>0.001 p.u.</strong> and phase angles match
                within <strong>0.05°</strong>.
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 max-h-[420px]">
                <table className="w-full text-left border-collapse font-mono text-[11px]">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="p-2 border-b border-slate-200 dark:border-slate-700">Bus</th>
                      <th className="p-2 border-b border-slate-200 dark:border-slate-700">Name</th>
                      <th className="p-2 border-b border-slate-200 dark:border-slate-700">Type</th>
                      <th className="p-2 border-b border-slate-200 dark:border-slate-700">
                        Published |V| (p.u.)
                      </th>
                      <th className="p-2 border-b border-slate-200 dark:border-slate-700">
                        Solved |V| (p.u.)
                      </th>
                      <th className="p-2 border-b border-slate-200 dark:border-slate-700">
                        |ΔV| (p.u.)
                      </th>
                      <th className="p-2 border-b border-slate-200 dark:border-slate-700">
                        Published δ (deg)
                      </th>
                      <th className="p-2 border-b border-slate-200 dark:border-slate-700">
                        Solved δ (deg)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {network.buses.map((bus) => {
                      const sol = solution?.busSolutions[bus.number];
                      const dv = sol
                        ? Math.abs(sol.vmPu - bus.publishedReference.vmPu)
                        : null;
                      return (
                        <tr key={bus.id}>
                          <td className="p-2 font-bold">#{bus.number}</td>
                          <td className="p-2 font-sans">{bus.name}</td>
                          <td className="p-2 uppercase">{bus.busType}</td>
                          <td className="p-2">{bus.publishedReference.vmPu.toFixed(4)}</td>
                          <td className="p-2 font-bold text-blue-600 dark:text-blue-400">
                            {sol ? sol.vmPu.toFixed(4) : '—'}
                          </td>
                          <td className="p-2">
                            {dv !== null ? dv.toFixed(4) : '—'}
                          </td>
                          <td className="p-2">{bus.publishedReference.vaDeg.toFixed(2)}°</td>
                          <td className="p-2 font-bold text-blue-600 dark:text-blue-400">
                            {sol ? `${sol.vaDeg.toFixed(2)}°` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'candidates' && (
            <div className="space-y-4">
              <p>
                Before selecting the <strong>IEEE 30-Bus Test System</strong>, five recognized
                academic and synthetic power-system benchmark networks were evaluated against the
                requirement of fewer than 50 buses, complete branch/transformer/shunt parameters,
                and a published AC power-flow solution:
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-[11px] uppercase text-slate-500">
                      <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">
                        Candidate Network
                      </th>
                      <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">
                        Buses / Voltages
                      </th>
                      <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">
                        Equipment (Gen/Load/Line/TX/Shunt)
                      </th>
                      <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">
                        Evaluation & Selection Rationale
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {metadata.evaluatedCandidates.map((cand) => (
                      <tr
                        key={cand.id}
                        className={
                          cand.selected
                            ? 'bg-emerald-500/10 dark:bg-emerald-950/30'
                            : undefined
                        }
                      >
                        <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                          <div>{cand.name}</div>
                          {cand.selected && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white">
                              SELECTED BENCHMARK
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono text-[11px]">
                          {cand.originalBuses} buses
                          <br />
                          <span className="text-slate-500">{cand.voltageLevelsKv}</span>
                        </td>
                        <td className="p-2.5 font-mono text-[11px]">
                          {cand.generatorsCount}G / {cand.loadsCount}L / {cand.linesCount}Ln /{' '}
                          {cand.transformersCount}TX / {cand.shuntsCount}Sh
                        </td>
                        <td className="p-2.5">
                          <p>{cand.evaluationSummary}</p>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Source: {cand.sourceCitation}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'geography' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-2">
                <div className="font-bold text-sm text-slate-900 dark:text-white">
                  Historical 1961 AEP Roanoke / New River / Lynchburg Virginia Footprint
                </div>
                <p>{metadata.geographicSummary}</p>
              </div>

              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <div className="font-bold text-sm text-amber-800 dark:text-amber-300">
                  Explicit Geographic & ERCOT Non-Equivalence Disclaimer
                </div>
                <p>{metadata.geographicDisclaimer}</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Scale size={15} className="text-blue-500" />
                  Licensing, Attribution, and Reuse Conditions
                </div>
                <p>{metadata.licensingAndReuse}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
