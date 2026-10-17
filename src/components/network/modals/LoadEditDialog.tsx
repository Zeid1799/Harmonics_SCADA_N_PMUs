import React, { useState } from 'react';
import { NetworkBus, NetworkLoad } from '../../../types/network';
import { AlertCircle, Check, Lock, Activity } from 'lucide-react';

interface LoadEditDialogProps {
  load: NetworkLoad;
  buses: NetworkBus[];
  loadScaleFactor?: number;
  isEditMode: boolean;
  onApply: (updates: Partial<NetworkLoad>) => void;
  onCancel: () => void;
}

export const LoadEditDialog: React.FC<LoadEditDialogProps> = ({
  load,
  buses,
  loadScaleFactor = 1.0,
  isEditMode,
  onApply,
  onCancel,
}) => {
  const [name, setName] = useState(load.name);
  const [pMw, setPMw] = useState(load.configuredActivePowerMw.toString());
  const [qMvar, setQMvar] = useState(load.configuredReactivePowerMvar.toString());
  const [status, setStatus] = useState<NetworkLoad['status']>(load.status);
  const [error, setError] = useState<string | null>(null);

  const bus = buses.find((b) => b.number === load.busNumber);
  const parsedP = parseFloat(pMw) || 0;
  const parsedQ = parseFloat(qMvar) || 0;
  const effP = parsedP * loadScaleFactor;
  const effQ = parsedQ * loadScaleFactor;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditMode) {
      onCancel();
      return;
    }

    const p = parseFloat(pMw);
    const q = parseFloat(qMvar);

    if (!name.trim()) {
      setError('Load name cannot be empty.');
      return;
    }
    if (isNaN(p) || isNaN(q)) {
      setError('Active and reactive power demand must be valid numbers.');
      return;
    }
    if (p < 0) {
      setError('Active power demand P cannot be negative.');
      return;
    }

    setError(null);
    onApply({
      name: name.trim(),
      configuredActivePowerMw: p,
      configuredReactivePowerMvar: q,
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
            Edit Mode is active. Changes to active/reactive power or connection status will update the working model and re-solve power flow.
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
        {/* Load Identifier (Always Read-Only) */}
        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Load Identifier (Fixed)
          </label>
          <input
            type="text"
            disabled
            value={load.id}
            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 font-mono text-slate-500 select-none cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Consumer Feeder Designation
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
            <span>Bus #{load.busNumber}: {bus?.name ?? 'Unknown'}</span>
            <span className="text-[10px] text-slate-400 font-sans">{bus?.baseKv ?? 132} kV</span>
          </div>
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Configured Active Demand P (MW)
          </label>
          <input
            type="number"
            step="0.1"
            disabled={!isEditMode}
            value={pMw}
            onChange={(e) => setPMw(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Configured Reactive Demand Q (MVAr)
          </label>
          <input
            type="number"
            step="0.1"
            disabled={!isEditMode}
            value={qMvar}
            onChange={(e) => setQMvar(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Documented Baseline Nominal P / Q
          </label>
          <div className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-mono">
            {load.nominalActivePowerMw.toFixed(1)} MW / {load.nominalReactivePowerMvar.toFixed(1)} MVAr
          </div>
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            System Load Scaling Factor
          </label>
          <div className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-mono">
            {(loadScaleFactor * 100).toFixed(0)}% ({loadScaleFactor.toFixed(2)}x)
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
                checked={status === 'connected'}
                onChange={() => setStatus('connected')}
                className="text-emerald-600"
              />
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                Connected (Supplying Load)
              </span>
            </label>
            <label className={`inline-flex items-center gap-1.5 ${isEditMode ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'}`}>
              <input
                type="radio"
                name="status"
                disabled={!isEditMode}
                checked={status === 'disconnected'}
                onChange={() => setStatus('disconnected')}
                className="text-red-600"
              />
              <span className="font-semibold text-red-600 dark:text-red-400">
                Disconnected (Breaker Open / Shed)
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Effective Power Demand Card */}
      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
            <Activity size={14} className="text-amber-500" />
            <span>Effective Demand under Global Scaling</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            P_eff = P × {loadScaleFactor.toFixed(2)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
          <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] text-slate-400">Effective Active Demand</div>
            <div className="font-bold text-amber-600 dark:text-amber-400">
              {status === 'connected' ? `${effP.toFixed(2)} MW` : '0.00 MW (Disconnected)'}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] text-slate-400">Effective Reactive Demand</div>
            <div className="font-bold text-blue-600 dark:text-blue-400">
              {status === 'connected' ? `${effQ.toFixed(2)} MVAr` : '0.00 MVAr (Disconnected)'}
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
