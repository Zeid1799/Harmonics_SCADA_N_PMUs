import React from 'react';
import { NetworkValidationReport } from '../../../types/network';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Play,
  X,
  ShieldCheck,
} from 'lucide-react';

interface ValidationReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: NetworkValidationReport;
  onRunPowerFlow: () => void;
}

export const ValidationReportModal: React.FC<ValidationReportModalProps> = ({
  isOpen,
  onClose,
  report,
  onRunPowerFlow,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-lg ${
                report.isValid
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-red-500/15 text-red-600 dark:text-red-400'
              }`}
            >
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Network Model Validation Diagnostics
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Pre-solver electrical solvability, topological continuity, and constraint checks
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Status Summary Banner */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-950/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {report.isValid ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40">
                  <CheckCircle2 size={14} />
                  Model Valid (Ready to Solve)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-700 dark:text-red-300 border border-red-500/40">
                  <AlertCircle size={14} />
                  {report.errorCount} Blocking Error{report.errorCount > 1 ? 's' : ''} Detected
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className="text-red-600 dark:text-red-400 font-bold">
                {report.errorCount} Error{report.errorCount === 1 ? '' : 's'}
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-amber-600 dark:text-amber-400 font-bold">
                {report.warningCount} Warning{report.warningCount === 1 ? '' : 's'}
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-blue-600 dark:text-blue-400 font-bold">
                {report.infoCount} Info
              </span>
            </div>
          </div>
        </div>

        {/* Issue List */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {report.issues.length === 0 ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400 space-y-2">
              <CheckCircle2 size={36} className="mx-auto text-emerald-500" />
              <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
                Zero Diagnostic Issues Found
              </p>
              <p className="text-xs max-w-sm mx-auto">
                The working network model satisfies all IEEE 30-bus topological, electrical, and slack-bus reference constraints.
              </p>
            </div>
          ) : (
            report.issues.map((issue) => (
              <div
                key={issue.id}
                className={`p-3.5 rounded-xl border space-y-1.5 ${
                  issue.severity === 'error'
                    ? 'bg-red-500/10 border-red-500/30'
                    : issue.severity === 'warning'
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-blue-500/10 border-blue-500/30'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {issue.severity === 'error' && (
                      <AlertCircle size={15} className="text-red-500 shrink-0" />
                    )}
                    {issue.severity === 'warning' && (
                      <AlertTriangle size={15} className="text-amber-500 shrink-0" />
                    )}
                    {issue.severity === 'info' && (
                      <Info size={15} className="text-blue-500 shrink-0" />
                    )}
                    <span
                      className={`font-bold ${
                        issue.severity === 'error'
                          ? 'text-red-700 dark:text-red-300'
                          : issue.severity === 'warning'
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-blue-700 dark:text-blue-300'
                      }`}
                    >
                      {issue.title}
                    </span>
                  </div>
                  {issue.elementId && (
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">
                      {issue.elementCategory?.toUpperCase()}: {issue.elementId}
                    </span>
                  )}
                </div>

                <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-[11px]">
                  {issue.message}
                </p>

                {issue.fixSuggestion && (
                  <div className="pt-1 text-[11px] text-slate-500 dark:text-slate-400 italic">
                    Recommendation: {issue.fixSuggestion}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <span className="text-[11px] text-slate-500">
            Validated at {new Date(report.timestamp).toLocaleTimeString()}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              disabled={!report.isValid}
              onClick={() => {
                onClose();
                onRunPowerFlow();
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold shadow-sm transition-all cursor-pointer ${
                report.isValid
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-slate-300 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
              }`}
            >
              <Play size={13} className="fill-current" />
              Solve AC Power Flow
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
