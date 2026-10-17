import React from 'react';
import {
  PowerNetworkModel,
  SelectedNetworkElement,
} from '../../../types/network';
import { findNetworkEquipment } from '../../../model/networkModel';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: SelectedNetworkElement | null;
  network: PowerNetworkModel;
  onConfirmDelete: (target: SelectedNetworkElement) => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  target,
  network,
  onConfirmDelete,
}) => {
  if (!isOpen || !target) return null;

  const found = findNetworkEquipment(network, target);
  if (!found || !found.item) return null;

  const isBus = target.category === 'bus';
  const busNum = isBus ? (found.item as any).number : null;

  // Find cascaded dependent connections if deleting a bus
  const cascadedLines = isBus
    ? network.lines.filter(
        (ln) => ln.fromBusNumber === busNum || ln.toBusNumber === busNum
      )
    : [];
  const cascadedTransformers = isBus
    ? network.transformers.filter(
        (tr) => tr.fromBusNumber === busNum || tr.toBusNumber === busNum
      )
    : [];
  const cascadedGens = isBus
    ? network.generators.filter((g) => g.busNumber === busNum)
    : [];
  const cascadedLoads = isBus
    ? network.loads.filter((l) => l.busNumber === busNum)
    : [];
  const cascadedShunts = isBus
    ? network.shunts.filter((s) => s.busNumber === busNum)
    : [];

  const totalCascadedCount =
    cascadedLines.length +
    cascadedTransformers.length +
    cascadedGens.length +
    cascadedLoads.length +
    cascadedShunts.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-red-500/10 dark:bg-red-950/30">
          <div className="flex items-center gap-2.5 text-red-600 dark:text-red-400 font-bold">
            <Trash2 size={18} />
            <span className="text-sm">Confirm Component Deletion</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            Are you sure you want to delete{' '}
            <strong className="text-slate-900 dark:text-white font-mono">
              {target.id}
            </strong>{' '}
            ({found.item.name}) from the working network model?
          </p>

          {isBus && totalCascadedCount > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold text-[11px]">
                <AlertTriangle size={14} />
                <span>Cascaded Disconnections Required</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                To prevent orphaned terminal references and maintain referential integrity, deleting this bus will also remove:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700 dark:text-slate-300 font-mono pl-1">
                {cascadedLines.length > 0 && (
                  <li>{cascadedLines.length} Transmission Line(s): {cascadedLines.map((l) => l.id).join(', ')}</li>
                )}
                {cascadedTransformers.length > 0 && (
                  <li>{cascadedTransformers.length} Transformer(s): {cascadedTransformers.map((t) => t.id).join(', ')}</li>
                )}
                {cascadedGens.length > 0 && (
                  <li>{cascadedGens.length} Generator(s): {cascadedGens.map((g) => g.id).join(', ')}</li>
                )}
                {cascadedLoads.length > 0 && (
                  <li>{cascadedLoads.length} Load(s): {cascadedLoads.map((l) => l.id).join(', ')}</li>
                )}
                {cascadedShunts.length > 0 && (
                  <li>{cascadedShunts.length} Shunt Bank(s): {cascadedShunts.map((s) => s.id).join(', ')}</li>
                )}
              </ul>
            </div>
          )}

          <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 text-slate-500 text-[11px]">
            This action can be undone using the Undo (Ctrl+Z) tool or by clicking Reset to Defaults.
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirmDelete(target);
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm transition-colors cursor-pointer"
          >
            <Trash2 size={13} />
            Delete Equipment
          </button>
        </div>
      </div>
    </div>
  );
};
