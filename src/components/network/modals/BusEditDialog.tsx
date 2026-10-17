import React, { useState } from 'react';
import { NetworkBus } from '../../../types/network';
import { AlertCircle, Check, Lock } from 'lucide-react';

interface BusEditDialogProps {
  bus: NetworkBus;
  existingBuses: NetworkBus[];
  isEditMode: boolean;
  onApply: (updates: Partial<NetworkBus>) => void;
  onCancel: () => void;
}

export const BusEditDialog: React.FC<BusEditDialogProps> = ({
  bus,
  existingBuses,
  isEditMode,
  onApply,
  onCancel,
}) => {
  const [name, setName] = useState(bus.name);
  const [substationName, setSubstationName] = useState(bus.substationName);
  const [baseKv, setBaseKv] = useState(bus.baseKv.toString());
  const [busType, setBusType] = useState<NetworkBus['busType']>(bus.busType);
  const [initialVmPu, setInitialVmPu] = useState(bus.initialVmPu.toString());
  const [initialVaDeg, setInitialVaDeg] = useState(bus.initialVaDeg.toString());
  const [vMinPu, setVMinPu] = useState(bus.vMinPu.toString());
  const [vMaxPu, setVMaxPu] = useState(bus.vMaxPu.toString());
  const [status, setStatus] = useState<NetworkBus['status']>(bus.status);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditMode) {
      onCancel();
      return;
    }

    const kv = parseFloat(baseKv);
    const vm = parseFloat(initialVmPu);
    const va = parseFloat(initialVaDeg);
    const vmin = parseFloat(vMinPu);
    const vmax = parseFloat(vMaxPu);

    if (!name.trim()) {
      setError('Bus name cannot be empty.');
      return;
    }
    if (isNaN(kv) || kv <= 0) {
      setError('Base voltage must be a positive number (kV).');
      return;
    }
    if (isNaN(vm) || vm <= 0.5 || vm >= 1.5) {
      setError('Voltage setpoint must be within realistic bounds [0.50, 1.50] p.u.');
      return;
    }
    if (isNaN(vmin) || isNaN(vmax) || vmin >= vmax) {
      setError('Minimum voltage limit must be strictly less than maximum voltage limit.');
      return;
    }

    // Protection: Cannot take the sole Slack bus offline or change it away from slack if no other slack bus exists
    const onlineSlackBuses = existingBuses.filter(
      (b) => b.id !== bus.id && b.status === 'online' && b.busType === 'slack'
    );

    if (bus.busType === 'slack' && (status === 'offline' || busType !== 'slack')) {
      if (onlineSlackBuses.length === 0) {
        setError(
          'Cannot deactivate or change the Slack bus without another active Slack bus in the network. A reference angle and loss balance node is required.'
        );
        return;
      }
    }

    // Protection: Cannot have multiple online slack buses
    if (busType === 'slack' && bus.busType !== 'slack') {
      if (onlineSlackBuses.length > 0) {
        setError(
          `Another Slack bus (${onlineSlackBuses[0].id}: ${onlineSlackBuses[0].name}) is already online. Designate only one Slack bus.`
        );
        return;
      }
    }

    setError(null);
    onApply({
      name: name.trim(),
      substationName: substationName.trim(),
      baseKv: kv,
      busType,
      initialVmPu: vm,
      initialVaDeg: isNaN(va) ? 0 : va,
      vMinPu: vmin,
      vMaxPu: vmax,
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
            Edit Mode is active. Modifications will update the in-memory working model and recalculate AC power flow.
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
        {/* Bus Identifier (Always Read-Only) */}
        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Bus Identifier (Fixed)
          </label>
          <input
            type="text"
            disabled
            value={bus.id}
            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 font-mono text-slate-500 select-none cursor-not-allowed"
          />
        </div>

        {/* Bus Number (Always Read-Only) */}
        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Bus Number (#) (Fixed)
          </label>
          <input
            type="text"
            disabled
            value={bus.number}
            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 font-mono text-slate-500 select-none cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Bus Station Name
          </label>
          <input
            type="text"
            disabled={!isEditMode}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Substation Facility
          </label>
          <input
            type="text"
            disabled={!isEditMode}
            value={substationName}
            onChange={(e) => setSubstationName(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Nominal Base Voltage (kV)
          </label>
          <input
            type="number"
            step="0.1"
            disabled={!isEditMode}
            value={baseKv}
            onChange={(e) => setBaseKv(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Bus Electrical Type
          </label>
          <select
            disabled={!isEditMode}
            value={busType}
            onChange={(e) => setBusType(e.target.value as NetworkBus['busType'])}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-semibold disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500"
          >
            <option value="slack">Slack / Swing Reference</option>
            <option value="pv">PV (Voltage-Controlled Generator)</option>
            <option value="pq">PQ (Load / Transmission Node)</option>
          </select>
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Voltage Setpoint |V| (p.u.)
          </label>
          <input
            type="number"
            step="0.001"
            disabled={!isEditMode}
            value={initialVmPu}
            onChange={(e) => setInitialVmPu(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Voltage Angle δ Reference (deg)
          </label>
          <input
            type="number"
            step="0.1"
            disabled={!isEditMode || busType !== 'slack'}
            value={initialVaDeg}
            onChange={(e) => setInitialVaDeg(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Min Voltage Limit Vmin (p.u.)
          </label>
          <input
            type="number"
            step="0.01"
            disabled={!isEditMode}
            value={vMinPu}
            onChange={(e) => setVMinPu(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
            Max Voltage Limit Vmax (p.u.)
          </label>
          <input
            type="number"
            step="0.01"
            disabled={!isEditMode}
            value={vMaxPu}
            onChange={(e) => setVMaxPu(e.target.value)}
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
                In-Service (Online / Energized)
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
                Out-of-Service (Offline / De-energized)
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Connected Equipment Summary */}
      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-1.5">
        <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px]">
          Connected Network Equipment at Substation:
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600 dark:text-slate-400 font-mono">
          <div>Generators: {bus.connectedEquipment?.generators?.length ?? 0}</div>
          <div>Loads: {bus.connectedEquipment?.loads?.length ?? 0}</div>
          <div>Lines: {bus.connectedEquipment?.lines?.length ?? 0}</div>
          <div>Transformers: {bus.connectedEquipment?.transformers?.length ?? 0}</div>
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
