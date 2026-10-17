import React, { useState } from 'react';
import {
  NetworkBus,
  NetworkTransmissionLine,
  PowerFlowSolutionResult,
} from '../../../types/network';
import { AlertCircle, Check, Lock, AlertTriangle, Activity } from 'lucide-react';

interface LineEditDialogProps {
  line: NetworkTransmissionLine;
  buses: NetworkBus[];
  solution?: PowerFlowSolutionResult | null;
  isEditMode: boolean;
  onApply: (updates: Partial<NetworkTransmissionLine>) => void;
  onCancel: () => void;
}

export const LineEditDialog: React.FC<LineEditDialogProps> = ({
  line,
  buses,
  solution,
  isEditMode,
  onApply,
  onCancel,
}) => {
  const [name, setName] = useState(line.name);
  const [rPu, setRPu] = useState(line.resistancePu.toString());
  const [xPu, setXPu] = useState(line.reactancePu.toString());
  const [bPu, setBPu] = useState(line.chargingSusceptancePu.toString());
  const [ratingMva, setRatingMva] = useState(line.ratingMva.toString());
  const [status, setStatus] = useState<NetworkTransmissionLine['status']>(line.status);
  const [error, setError] = useState<string | null>(null);

  const fBus = buses.find((bus) => bus.number === line.fromBusNumber);
  const tBus = buses.find((bus) => bus.number === line.toBusNumber);

  // Approximate geographic distance between substations
  const approxDistanceMiles = (() => {
    if (!fBus?.geoLocation || !tBus?.geoLocation) return null;
    const R = 3958.8; // Earth radius in miles
    const dLat = ((tBus.geoLocation.lat - fBus.geoLocation.lat) * Math.PI) / 180;
    const dLon = ((tBus.geoLocation.lon - fBus.geoLocation.lon) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((fBus.geoLocation.lat * Math.PI) / 180) *
        Math.cos((tBus.geoLocation.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
  })();

  // Current power-flow telemetry
  const flow = solution?.lineFlows[line.id];
  const apparentMva = flow
    ? Math.hypot(flow.pFromMw, flow.qFromMvar)
    : 0;

  // Real-time loading percentage against currently entered rating
  const currentEnteredRating = parseFloat(ratingMva) || line.ratingMva || 1;
  const loadingPct =
    flow && currentEnteredRating > 0
      ? (apparentMva / currentEnteredRating) * 100
      : flow?.loadingPercent ?? 0;
  const isOverloaded = loadingPct > 100;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditMode) {
      onCancel();
      return;
    }

    const r = parseFloat(rPu);
    const x = parseFloat(xPu);
    const b = parseFloat(bPu);
    const mva = parseFloat(ratingMva);

    if (!name.trim()) {
      setError('Transmission line name cannot be empty.');
      return;
    }
    if (isNaN(r) || isNaN(x) || isNaN(b)) {
      setError('Electrical impedance parameters (R, X, B) must be valid numbers.');
      return;
    }
    if (r < 0) {
      setError('Series resistance R cannot be negative.');
      return;
    }
    if (x <= 0) {
      setError('Series reactance X must be strictly positive (X > 0 p.u.) for inductive transmission lines.');
      return;
    }
    if (b < 0) {
      setError('Line charging susceptance B cannot be negative.');
      return;
    }
    if (isNaN(mva) || mva <= 0) {
      setError('Continuous thermal rating Rate A must be positive (MVA).');
      return;
    }

    setError(null);
    onApply({
      name: name.trim(),
      resistancePu: r,
      reactancePu: x,
      chargingSusceptancePu: b,
      ratingMva: mva,
      status,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-xs">
      {error && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Mode Status Banner */}
      {isEditMode ? (
        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-center justify-between">
          <span className="font-semibold">
            Edit Mode is active. Changes to impedance or status will update power flow; changes to rating will update loading assessment.
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950">
            Editing
          </span>
        </div>
      ) : (
        <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Lock size={13} className="text-slate-400" />
            <span>Read-Only Inspection Mode. Toggle Edit Mode in the toolbar to modify parameters.</span>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
            Read-Only
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Line Identifier (Always Read-Only) */}
        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Line Identifier (Fixed)
          </label>
          <input
            type="text"
            disabled
            value={line.id}
            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 font-mono text-slate-500 select-none cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Circuit Designation Name
          </label>
          <input
            type="text"
            disabled={!isEditMode}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500"
          />
        </div>

        {/* Terminal Bus 1 (Fixed Endpoint - No Dropdown) */}
        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            From Terminal (Bus 1)
          </label>
          <div className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono flex items-center justify-between">
            <span>Bus #{line.fromBusNumber}: {fBus?.name ?? 'Unknown'}</span>
            <span className="text-[10px] text-slate-400 font-sans">{fBus?.baseKv ?? 132} kV</span>
          </div>
        </div>

        {/* Terminal Bus 2 (Fixed Endpoint - No Dropdown) */}
        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            To Terminal (Bus 2)
          </label>
          <div className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono flex items-center justify-between">
            <span>Bus #{line.toBusNumber}: {tBus?.name ?? 'Unknown'}</span>
            <span className="text-[10px] text-slate-400 font-sans">{tBus?.baseKv ?? 132} kV</span>
          </div>
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Series Resistance R (p.u. on 100 MVA base)
          </label>
          <input
            type="number"
            step="0.0001"
            disabled={!isEditMode}
            value={rPu}
            onChange={(e) => setRPu(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Series Reactance X (p.u. on 100 MVA base)
          </label>
          <input
            type="number"
            step="0.0001"
            disabled={!isEditMode}
            value={xPu}
            onChange={(e) => setXPu(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Total Charging Susceptance B (p.u. on 100 MVA base)
          </label>
          <input
            type="number"
            step="0.0001"
            disabled={!isEditMode}
            value={bPu}
            onChange={(e) => setBPu(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Thermal Rating Rate A (MVA)
          </label>
          <input
            type="number"
            step="1"
            disabled={!isEditMode}
            value={ratingMva}
            onChange={(e) => setRatingMva(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500"
          />
        </div>

        {/* Operating Status */}
        <div className="sm:col-span-2">
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Operating Status
          </label>
          <div className="flex gap-4">
            <label className={`inline-flex items-center gap-1.5 ${isEditMode ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'}`}>
              <input
                type="radio"
                name="status"
                disabled={!isEditMode}
                checked={status === 'online'}
                onChange={() => setStatus('online')}
                className="text-emerald-600"
              />
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                In-Service (Online / Connected)
              </span>
            </label>
            <label className={`inline-flex items-center gap-1.5 ${isEditMode ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'}`}>
              <input
                type="radio"
                name="status"
                disabled={!isEditMode}
                checked={status === 'offline'}
                onChange={() => setStatus('offline')}
                className="text-red-600"
              />
              <span className="font-semibold text-red-600 dark:text-red-400">
                Out-of-Service (Offline / Switched Open)
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Line Length & Modeling Explanation Card */}
      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-bold text-slate-700 dark:text-slate-300">
            Physical Model Representation &amp; Line Length:
          </span>
          {approxDistanceMiles && (
            <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">
              ~{approxDistanceMiles} miles (Geographic estimate)
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          The IEEE 30-bus benchmark models lines as total lumped π-equivalent parameters ($R + jX, B$ on 100 MVA base).
          No per-unit-length values are specified in the standard benchmark; total impedance parameters are edited directly.
        </p>
      </div>

      {/* Calculated Loading & Flow Section */}
      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
            <Activity size={14} className="text-blue-500" />
            <span>Calculated Loading Assessment</span>
          </div>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
              isOverloaded
                ? 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/40 animate-pulse'
                : loadingPct > 90
                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40'
                : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40'
            }`}
          >
            {isOverloaded ? 'Thermal Overload' : loadingPct > 90 ? 'High Loading' : 'Normal'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
          <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] text-slate-400">P Flow (MW)</div>
            <div className="font-bold text-slate-800 dark:text-slate-200">
              {flow ? `${flow.pFromMw.toFixed(1)} MW` : 'N/A'}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] text-slate-400">Q Flow (MVAr)</div>
            <div className="font-bold text-slate-800 dark:text-slate-200">
              {flow ? `${flow.qFromMvar.toFixed(1)} MVAr` : 'N/A'}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] text-slate-400">Apparent S (MVA)</div>
            <div className="font-bold text-slate-800 dark:text-slate-200">
              {flow ? `${apparentMva.toFixed(1)} MVA` : 'N/A'}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] text-slate-400">Loading %</div>
            <div className={`font-bold ${isOverloaded ? 'text-red-500 font-black' : 'text-slate-800 dark:text-slate-200'}`}>
              {loadingPct.toFixed(1)}%
            </div>
          </div>
        </div>

        {isOverloaded && (
          <div className="flex items-center gap-1.5 p-2 rounded bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-[11px]">
            <AlertTriangle size={13} className="shrink-0" />
            <span>Thermal Overload: Apparent flow ({apparentMva.toFixed(1)} MVA) exceeds continuous rating ({currentEnteredRating} MVA).</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
        {isEditMode ? (
          <>
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 rounded-lg font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors cursor-pointer"
            >
              <Check size={14} />
              Apply Changes
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-1.5 rounded-lg font-bold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        )}
      </div>
    </form>
  );
};
