import React, { useState } from 'react';
import {
  NetworkBus,
  NetworkShunt,
  PowerFlowSolutionResult,
} from '../../../types/network';
import { AlertCircle, Check, Lock, Activity } from 'lucide-react';

interface ShuntEditDialogProps {
  shunt: NetworkShunt;
  buses: NetworkBus[];
  solution?: PowerFlowSolutionResult | null;
  isEditMode: boolean;
  onApply: (updates: Partial<NetworkShunt>) => void;
  onCancel: () => void;
}

export const ShuntEditDialog: React.FC<ShuntEditDialogProps> = ({
  shunt,
  buses,
  solution,
  isEditMode,
  onApply,
  onCancel,
}) => {
  const [name, setName] = useState(shunt.name);
  const [bMvar, setBMvar] = useState(shunt.configuredSusceptanceMvarAtUnitV.toString());
  const [gMw, setGMw] = useState(shunt.conductanceMwAtUnitV.toString());
  const [status, setStatus] = useState<NetworkShunt['status']>(shunt.status);
  const [error, setError] = useState<string | null>(null);

  const bus = buses.find((b) => b.number === shunt.busNumber);
  const shuntOutput = solution?.shuntOutputs[shunt.id];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditMode) {
      onCancel();
      return;
    }

    const b = parseFloat(bMvar);
    const g = parseFloat(gMw);

    if (!name.trim()) {
      setError('Shunt bank name cannot be empty.');
      return;
    }
    if (isNaN(b) || isNaN(g)) {
      setError('Susceptance and conductance must be valid numbers.');
      return;
    }

    setError(null);
    onApply({
      name: name.trim(),
      configuredSusceptanceMvarAtUnitV: b,
      conductanceMwAtUnitV: g,
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
            Edit Mode is active. Changes to susceptance or status will update reactive injection and re-solve power flow.
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
        {/* Shunt Identifier (Always Read-Only) */}
        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Bank Identifier (Fixed)
          </label>
          <input
            type="text"
            disabled
            value={shunt.id}
            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 font-mono text-slate-500 select-none cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Bank Designation Name
          </label>
          <input
            type="text"
            disabled={!isEditMode}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500"
          />
        </div>

        {/* Connected Bus (Fixed Endpoint - No Dropdown) */}
        <div className="sm:col-span-2">
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Connected Substation Bus (Fixed)
          </label>
          <div className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono flex items-center justify-between">
            <span>Bus #{shunt.busNumber}: {bus?.name ?? 'Unknown'}</span>
            <span className="text-[10px] text-slate-400 font-sans">{bus?.baseKv ?? 132} kV</span>
          </div>
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Rated Reactive Susceptance Bs (MVAr at 1.0 p.u.)
          </label>
          <input
            type="number"
            step="0.1"
            disabled={!isEditMode}
            value={bMvar}
            onChange={(e) => setBMvar(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Active Conductance Gs (MW at 1.0 p.u.)
          </label>
          <input
            type="number"
            step="0.1"
            disabled={!isEditMode}
            value={gMw}
            onChange={(e) => setGMw(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Benchmark Nominal Susceptance
          </label>
          <div className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-mono">
            +{shunt.nominalSusceptanceMvarAtUnitV.toFixed(1)} MVAr at 1.0 p.u.
          </div>
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Bank Classification
          </label>
          <div className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
            {shunt.shuntType}
          </div>
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
                In-Service (Online / Capacitor Switched In)
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
                Out-of-Service (Offline / Switched Out)
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Solved Shunt Injection Card */}
      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
            <Activity size={14} className="text-purple-500" />
            <span>Solved Reactive Power Injection</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            Q = Bs × V²
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
          <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] text-slate-400">Bus Voltage Magnitude</div>
            <div className="font-bold text-slate-800 dark:text-slate-200">
              {solution?.busSolutions[shunt.busNumber]
                ? `${solution.busSolutions[shunt.busNumber].vmPu.toFixed(4)} p.u.`
                : 'N/A'}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] text-slate-400">Actual Injected Reactive Power</div>
            <div className="font-bold text-purple-600 dark:text-purple-400">
              {status === 'online' && shuntOutput
                ? `+${shuntOutput.qInjectedMvar.toFixed(2)} MVAr`
                : '0.00 MVAr (Offline)'}
            </div>
          </div>
        </div>
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
