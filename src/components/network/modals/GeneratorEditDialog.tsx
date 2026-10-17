import React, { useState } from 'react';
import {
  NetworkBus,
  NetworkGenerator,
  PowerFlowSolutionResult,
} from '../../../types/network';
import { AlertCircle, Check, Lock, Activity } from 'lucide-react';

interface GeneratorEditDialogProps {
  generator: NetworkGenerator;
  buses: NetworkBus[];
  solution?: PowerFlowSolutionResult | null;
  isEditMode: boolean;
  onApply: (updates: Partial<NetworkGenerator>) => void;
  onCancel: () => void;
}

export const GeneratorEditDialog: React.FC<GeneratorEditDialogProps> = ({
  generator,
  buses,
  solution,
  isEditMode,
  onApply,
  onCancel,
}) => {
  const [name, setName] = useState(generator.name);
  const [scheduledP, setScheduledP] = useState(generator.scheduledActivePowerMw.toString());
  const [pMin, setPMin] = useState(generator.activePowerMinMw.toString());
  const [pMax, setPMax] = useState(generator.activePowerMaxMw.toString());
  const [vSet, setVSet] = useState(generator.voltageSetpointPu.toString());
  const [qMin, setQMin] = useState(generator.reactivePowerMinMvar.toString());
  const [qMax, setQMax] = useState(generator.reactivePowerMaxMvar.toString());
  const [ratedMva, setRatedMva] = useState(generator.ratedMva.toString());
  const [status, setStatus] = useState<NetworkGenerator['status']>(generator.status);
  const [error, setError] = useState<string | null>(null);

  const bus = buses.find((b) => b.number === generator.busNumber);
  const genOutput = solution?.generatorOutputs[generator.id];
  const isSlackGen = generator.controlMode === 'Slack / Reference';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditMode) {
      onCancel();
      return;
    }

    const p = parseFloat(scheduledP);
    const pmin = parseFloat(pMin);
    const pmax = parseFloat(pMax);
    const v = parseFloat(vSet);
    const qmin = parseFloat(qMin);
    const qmax = parseFloat(qMax);
    const mva = parseFloat(ratedMva);

    if (!name.trim()) {
      setError('Generator name cannot be empty.');
      return;
    }
    if (isNaN(p) || isNaN(pmin) || isNaN(pmax) || pmin > pmax) {
      setError('Active power limits must satisfy Pmin <= Pmax.');
      return;
    }
    if (isNaN(qmin) || isNaN(qmax) || qmin > qmax) {
      setError('Reactive power limits must satisfy Qmin <= Qmax.');
      return;
    }
    if (isNaN(v) || v <= 0.5 || v >= 1.5) {
      setError('Voltage setpoint must be within realistic bounds [0.50, 1.50] p.u.');
      return;
    }
    if (isNaN(mva) || mva <= 0) {
      setError('Machine MVA rating must be positive.');
      return;
    }

    // Protection: Cannot take the Slack generator offline
    if (isSlackGen && status === 'offline') {
      setError(
        'Cannot deactivate the Slack / Reference generator. An active reference machine is required to balance system demand and transmission losses.'
      );
      return;
    }

    setError(null);
    onApply({
      name: name.trim(),
      scheduledActivePowerMw: p,
      activePowerMinMw: pmin,
      activePowerMaxMw: pmax,
      voltageSetpointPu: v,
      reactivePowerMinMvar: qmin,
      reactivePowerMaxMvar: qmax,
      ratedMva: mva,
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
            Edit Mode is active. Changes to generation setpoints or status will update the working model and re-solve power flow.
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
        {/* Machine Identifier (Always Read-Only) */}
        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Machine Identifier (Fixed)
          </label>
          <input
            type="text"
            disabled
            value={generator.id}
            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 font-mono text-slate-500 select-none cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Station Machine Name
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
        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Connected Substation Bus (Fixed)
          </label>
          <div className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono flex items-center justify-between">
            <span>Bus #{generator.busNumber}: {bus?.name ?? 'Unknown'}</span>
            <span className="text-[10px] text-slate-400 font-sans">{bus?.baseKv ?? 132} kV</span>
          </div>
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Control Mode / Type (Fixed)
          </label>
          <div className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
            {generator.controlMode} ({generator.unitType})
          </div>
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Scheduled Active Power P (MW)
          </label>
          <input
            type="number"
            step="0.1"
            disabled={!isEditMode || isSlackGen}
            value={scheduledP}
            onChange={(e) => setScheduledP(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500"
          />
          {isSlackGen && (
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
              Slack generator output is calculated by power flow to balance system losses.
            </span>
          )}
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Voltage Setpoint |Vset| (p.u.)
          </label>
          <input
            type="number"
            step="0.001"
            disabled={!isEditMode}
            value={vSet}
            onChange={(e) => setVSet(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Active Power Limit Pmin (MW)
          </label>
          <input
            type="number"
            step="0.1"
            disabled={!isEditMode}
            value={pMin}
            onChange={(e) => setPMin(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Active Power Limit Pmax (MW)
          </label>
          <input
            type="number"
            step="0.1"
            disabled={!isEditMode}
            value={pMax}
            onChange={(e) => setPMax(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Reactive Limit Qmin (MVAr)
          </label>
          <input
            type="number"
            step="0.1"
            disabled={!isEditMode}
            value={qMin}
            onChange={(e) => setQMin(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Reactive Limit Qmax (MVAr)
          </label>
          <input
            type="number"
            step="0.1"
            disabled={!isEditMode}
            value={qMax}
            onChange={(e) => setQMax(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Machine Nameplate Rating (MVA)
          </label>
          <input
            type="number"
            step="1"
            disabled={!isEditMode}
            value={ratedMva}
            onChange={(e) => setRatedMva(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Benchmark Published Output
          </label>
          <div className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-mono">
            {generator.publishedReferenceOutput.pMw.toFixed(1)} MW / {generator.publishedReferenceOutput.qMvar.toFixed(1)} MVAr
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
                In-Service (Online / Dispatched)
              </span>
            </label>
            <label className={`inline-flex items-center gap-1.5 ${isEditMode ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'}`}>
              <input
                type="radio"
                name="status"
                disabled={!isEditMode || isSlackGen}
                checked={status === 'offline'}
                onChange={() => setStatus('offline')}
                className="text-red-600"
              />
              <span className="font-semibold text-red-600 dark:text-red-400">
                Out-of-Service (Offline / Descheduled)
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Solved Generator Electrical Output Section */}
      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
            <Activity size={14} className="text-emerald-500" />
            <span>Solved Generator Dispatch</span>
          </div>
          {genOutput?.clampedAtQLimit && genOutput.clampedAtQLimit !== 'none' && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40">
              Q Clamped at {genOutput.clampedAtQLimit.toUpperCase()}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
          <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] text-slate-400">Active P (MW)</div>
            <div className="font-bold text-emerald-600 dark:text-emerald-400">
              {genOutput ? `${genOutput.pMw.toFixed(2)} MW` : 'N/A'}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] text-slate-400">Reactive Q (MVAr)</div>
            <div className="font-bold text-blue-600 dark:text-blue-400">
              {genOutput ? `${genOutput.qMvar.toFixed(2)} MVAr` : 'N/A'}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] text-slate-400">Terminal |V| (p.u.)</div>
            <div className="font-bold text-slate-800 dark:text-slate-200">
              {solution?.busSolutions[generator.busNumber]
                ? `${solution.busSolutions[generator.busNumber].vmPu.toFixed(4)}`
                : 'N/A'}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] text-slate-400">Apparent S (MVA)</div>
            <div className="font-bold text-slate-800 dark:text-slate-200">
              {genOutput ? `${Math.hypot(genOutput.pMw, genOutput.qMvar).toFixed(1)} MVA` : 'N/A'}
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
