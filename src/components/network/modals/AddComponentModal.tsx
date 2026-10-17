import React, { useState } from 'react';
import {
  NetworkBus,
  NetworkEquipmentCategory,
  NetworkGenerator,
  NetworkLoad,
  NetworkShunt,
  NetworkTransformer,
  NetworkTransmissionLine,
  PowerNetworkModel,
} from '../../../types/network';
import { PlusCircle, X, AlertCircle, Check } from 'lucide-react';

interface AddComponentModalProps {
  isOpen: boolean;
  onClose: () => void;
  network: PowerNetworkModel;
  initialCategory?: NetworkEquipmentCategory;
  onAddBus: (busData: Partial<NetworkBus>) => void;
  onAddGenerator: (genData: Partial<NetworkGenerator> & { busNumber: number }) => void;
  onAddLoad: (loadData: Partial<NetworkLoad> & { busNumber: number }) => void;
  onAddLine: (
    lineData: Partial<NetworkTransmissionLine> & {
      fromBusNumber: number;
      toBusNumber: number;
    }
  ) => void;
  onAddTransformer: (
    txData: Partial<NetworkTransformer> & {
      fromBusNumber: number;
      toBusNumber: number;
    }
  ) => void;
  onAddShunt: (shuntData: Partial<NetworkShunt> & { busNumber: number }) => void;
}

export const AddComponentModal: React.FC<AddComponentModalProps> = ({
  isOpen,
  onClose,
  network,
  initialCategory = 'bus',
  onAddBus,
  onAddGenerator,
  onAddLoad,
  onAddLine,
  onAddTransformer,
  onAddShunt,
}) => {
  const [category, setCategory] = useState<NetworkEquipmentCategory>(initialCategory);
  const [error, setError] = useState<string | null>(null);

  // Next suggested bus number
  const nextBusNum =
    network.buses.length > 0 ? Math.max(...network.buses.map((b) => b.number)) + 1 : 1;
  const firstBusNum = network.buses[0]?.number ?? 1;
  const secondBusNum = network.buses[1]?.number ?? firstBusNum;

  // Form states
  const [busName, setBusName] = useState(`Substation ${nextBusNum} (132 kV)`);
  const [busBaseKv, setBusBaseKv] = useState('132');
  const [busType, setBusType] = useState<NetworkBus['busType']>('pq');

  const [fromBus, setFromBus] = useState(firstBusNum);
  const [toBus, setToBus] = useState(secondBusNum);
  const [lineR, setLineR] = useState('0.04');
  const [lineX, setLineX] = useState('0.15');
  const [lineB, setLineB] = useState('0.02');
  const [lineRating, setLineRating] = useState('65');

  const [txR, setTxR] = useState('0.00');
  const [txX, setTxX] = useState('0.10');
  const [txTap, setTxTap] = useState('1.000');
  const [txRating, setTxRating] = useState('65');

  const [genBus, setGenBus] = useState(firstBusNum);
  const [genP, setGenP] = useState('25.0');
  const [genVSet, setGenVSet] = useState('1.02');
  const [genQMin, setGenQMin] = useState('-20');
  const [genQMax, setGenQMax] = useState('40');

  const [loadBus, setLoadBus] = useState(firstBusNum);
  const [loadP, setLoadP] = useState('12.0');
  const [loadQ, setLoadQ] = useState('5.0');

  const [shuntBus, setShuntBus] = useState(firstBusNum);
  const [shuntB, setShuntB] = useState('10.0');
  const [shuntType, setShuntType] = useState<NetworkShunt['shuntType']>('Capacitor Bank');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (category === 'bus') {
      const kv = parseFloat(busBaseKv);
      if (!busName.trim()) return setError('Bus name is required.');
      if (isNaN(kv) || kv <= 0) return setError('Base voltage must be > 0 kV.');
      onAddBus({
        name: busName.trim(),
        baseKv: kv,
        busType,
      });
      onClose();
    } else if (category === 'line') {
      if (fromBus === toBus) {
        return setError('Source and destination buses must be distinct.');
      }
      const r = parseFloat(lineR);
      const x = parseFloat(lineX);
      const b = parseFloat(lineB);
      const mva = parseFloat(lineRating);
      if (isNaN(r) || isNaN(x) || isNaN(b) || isNaN(mva)) {
        return setError('All electrical parameters must be valid numbers.');
      }
      if (x <= 0) return setError('Reactance X must be > 0 p.u.');
      onAddLine({
        fromBusNumber: fromBus,
        toBusNumber: toBus,
        resistancePu: r,
        reactancePu: x,
        chargingSusceptancePu: b,
        ratingMva: mva,
      });
      onClose();
    } else if (category === 'transformer') {
      if (fromBus === toBus) {
        return setError('Source and destination buses must be distinct.');
      }
      const r = parseFloat(txR);
      const x = parseFloat(txX);
      const tap = parseFloat(txTap);
      const mva = parseFloat(txRating);
      if (isNaN(r) || isNaN(x) || isNaN(tap) || isNaN(mva)) {
        return setError('All electrical parameters must be valid numbers.');
      }
      if (x <= 0) return setError('Leakage reactance X must be > 0 p.u.');
      if (tap <= 0) return setError('Turns ratio must be > 0 p.u.');
      onAddTransformer({
        fromBusNumber: fromBus,
        toBusNumber: toBus,
        resistancePu: r,
        reactancePu: x,
        tapRatioPu: tap,
        ratingMva: mva,
      });
      onClose();
    } else if (category === 'generator') {
      const p = parseFloat(genP);
      const v = parseFloat(genVSet);
      const qmin = parseFloat(genQMin);
      const qmax = parseFloat(genQMax);
      if (isNaN(p) || isNaN(v) || isNaN(qmin) || isNaN(qmax)) {
        return setError('All generator parameters must be valid numbers.');
      }
      onAddGenerator({
        busNumber: genBus,
        scheduledActivePowerMw: p,
        voltageSetpointPu: v,
        reactivePowerMinMvar: qmin,
        reactivePowerMaxMvar: qmax,
      });
      onClose();
    } else if (category === 'load') {
      const p = parseFloat(loadP);
      const q = parseFloat(loadQ);
      if (isNaN(p) || isNaN(q)) {
        return setError('Load demand values must be valid numbers.');
      }
      onAddLoad({
        busNumber: loadBus,
        configuredActivePowerMw: p,
        configuredReactivePowerMvar: q,
      });
      onClose();
    } else if (category === 'shunt') {
      const b = parseFloat(shuntB);
      if (isNaN(b)) {
        return setError('Susceptance must be a valid number.');
      }
      onAddShunt({
        busNumber: shuntBus,
        shuntType,
        configuredSusceptanceMvarAtUnitV: b,
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <PlusCircle size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Add Network Component
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Instantiate supported electrical apparatus into the working model
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Category Selector Tabs */}
        <div className="flex flex-wrap gap-1 p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-950/40 text-xs">
          {(
            [
              { id: 'bus', label: '+ Bus' },
              { id: 'line', label: '+ Line' },
              { id: 'transformer', label: '+ Transformer' },
              { id: 'generator', label: '+ Generator' },
              { id: 'load', label: '+ Load' },
              { id: 'shunt', label: '+ Shunt' },
            ] as { id: NetworkEquipmentCategory; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setCategory(t.id);
                setError(null);
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                category === t.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {error && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {category === 'bus' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  New Bus Number (#)
                </label>
                <input
                  type="text"
                  disabled
                  value={`#${nextBusNum} (Next sequential)`}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 font-mono text-slate-500 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Base Voltage (kV)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={busBaseKv}
                  onChange={(e) => setBusBaseKv(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Bus Name / Location
                </label>
                <input
                  type="text"
                  value={busName}
                  onChange={(e) => setBusName(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Bus Type
                </label>
                <select
                  value={busType}
                  onChange={(e) => setBusType(e.target.value as NetworkBus['busType'])}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 font-semibold"
                >
                  <option value="pq">PQ (Load / Switching Node)</option>
                  <option value="pv">PV (Voltage-Controlled)</option>
                  <option value="slack">Slack / Swing Reference</option>
                </select>
              </div>
            </div>
          )}

          {category === 'line' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  From Bus
                </label>
                <select
                  value={fromBus}
                  onChange={(e) => setFromBus(parseInt(e.target.value, 10))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold"
                >
                  {network.buses.map((b) => (
                    <option key={b.id} value={b.number}>
                      Bus #{b.number}: {b.name} ({b.baseKv} kV)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  To Bus
                </label>
                <select
                  value={toBus}
                  onChange={(e) => setToBus(parseInt(e.target.value, 10))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold"
                >
                  {network.buses.map((b) => (
                    <option key={b.id} value={b.number}>
                      Bus #{b.number}: {b.name} ({b.baseKv} kV)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Series Resistance R (p.u.)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={lineR}
                  onChange={(e) => setLineR(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Series Reactance X (p.u.)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={lineX}
                  onChange={(e) => setLineX(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Charging B (p.u.)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={lineB}
                  onChange={(e) => setLineB(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Continuous Rating (MVA)
                </label>
                <input
                  type="number"
                  step="1"
                  value={lineRating}
                  onChange={(e) => setLineRating(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>
            </div>
          )}

          {category === 'transformer' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  From Bus (Tap Side)
                </label>
                <select
                  value={fromBus}
                  onChange={(e) => setFromBus(parseInt(e.target.value, 10))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold"
                >
                  {network.buses.map((b) => (
                    <option key={b.id} value={b.number}>
                      Bus #{b.number}: {b.name} ({b.baseKv} kV)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  To Bus
                </label>
                <select
                  value={toBus}
                  onChange={(e) => setToBus(parseInt(e.target.value, 10))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold"
                >
                  {network.buses.map((b) => (
                    <option key={b.id} value={b.number}>
                      Bus #{b.number}: {b.name} ({b.baseKv} kV)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Series Resistance R (p.u.)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={txR}
                  onChange={(e) => setTxR(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Leakage Reactance X (p.u.)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={txX}
                  onChange={(e) => setTxX(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tap Ratio τ (p.u.)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={txTap}
                  onChange={(e) => setTxTap(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Continuous Rating (MVA)
                </label>
                <input
                  type="number"
                  step="1"
                  value={txRating}
                  onChange={(e) => setTxRating(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>
            </div>
          )}

          {category === 'generator' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Terminal Bus
                </label>
                <select
                  value={genBus}
                  onChange={(e) => setGenBus(parseInt(e.target.value, 10))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold"
                >
                  {network.buses.map((b) => (
                    <option key={b.id} value={b.number}>
                      Bus #{b.number}: {b.name} ({b.baseKv} kV)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Scheduled Active Power P (MW)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={genP}
                  onChange={(e) => setGenP(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Voltage Setpoint |V| (p.u.)
                </label>
                <input
                  type="number"
                  step="0.005"
                  value={genVSet}
                  onChange={(e) => setGenVSet(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Qmin (MVAr)
                </label>
                <input
                  type="number"
                  step="1"
                  value={genQMin}
                  onChange={(e) => setGenQMin(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Qmax (MVAr)
                </label>
                <input
                  type="number"
                  step="1"
                  value={genQMax}
                  onChange={(e) => setGenQMax(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>
            </div>
          )}

          {category === 'load' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Terminal Bus
                </label>
                <select
                  value={loadBus}
                  onChange={(e) => setLoadBus(parseInt(e.target.value, 10))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold"
                >
                  {network.buses.map((b) => (
                    <option key={b.id} value={b.number}>
                      Bus #{b.number}: {b.name} ({b.baseKv} kV)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Active Demand P (MW)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={loadP}
                  onChange={(e) => setLoadP(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reactive Demand Q (MVAr)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={loadQ}
                  onChange={(e) => setLoadQ(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>
            </div>
          )}

          {category === 'shunt' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Connected Bus
                </label>
                <select
                  value={shuntBus}
                  onChange={(e) => setShuntBus(parseInt(e.target.value, 10))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold"
                >
                  {network.buses.map((b) => (
                    <option key={b.id} value={b.number}>
                      Bus #{b.number}: {b.name} ({b.baseKv} kV)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Shunt Device Class
                </label>
                <select
                  value={shuntType}
                  onChange={(e) => setShuntType(e.target.value as NetworkShunt['shuntType'])}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-semibold"
                >
                  <option value="Capacitor Bank">Capacitor Bank (MVAr Injection)</option>
                  <option value="Reactor">Shunt Reactor (MVAr Absorption)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Susceptance Bs (MVAr @ 1.0 p.u.)
                </label>
                <input
                  type="number"
                  step="1"
                  value={shuntB}
                  onChange={(e) => setShuntB(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors cursor-pointer"
            >
              <Check size={14} />
              Add Component
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
