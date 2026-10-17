import React from 'react';
import { RotateCcw, AlertTriangle, X } from 'lucide-react';

interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmReset: () => void;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirmReset,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-amber-500/10 dark:bg-amber-950/30">
          <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400 font-bold">
            <RotateCcw size={18} />
            <span className="text-sm">Reset Network to Defaults</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            Are you sure you want to restore the default IEEE 30-Bus network?
          </p>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5 text-[11px] text-amber-800 dark:text-amber-300">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle size={14} />
              <span>Session Changes Will Be Discarded</span>
            </div>
            <ul className="list-disc list-inside space-y-1 pl-1 text-slate-600 dark:text-slate-300">
              <li>All user-added buses, branches, generators, and loads will be removed.</li>
              <li>Modified impedances, setpoints, and tap ratios will be restored to IEEE CDF baseline.</li>
              <li>Undo and redo history will be cleared.</li>
              <li>AC power flow will be recalculated on the baseline model.</li>
            </ul>
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
              onConfirmReset();
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-colors cursor-pointer"
          >
            <RotateCcw size={13} />
            Reset to Baseline
          </button>
        </div>
      </div>
    </div>
  );
};
