import React from 'react';
import { WorkspaceLayout } from '../types/settings';
import { Columns, Activity, BarChart2 } from 'lucide-react';

interface LayoutSelectorProps {
  layout: WorkspaceLayout;
  onLayoutChange: (layout: WorkspaceLayout) => void;
}

export const LayoutSelector: React.FC<LayoutSelectorProps> = ({
  layout,
  onLayoutChange,
}) => {
  return (
    <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-mono select-none">
      <button
        onClick={() => onLayoutChange('both')}
        title="Show both Time-Domain and Frequency-Domain plots side-by-side"
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
          layout === 'both'
            ? 'bg-white dark:bg-[#161f33] text-cyan-700 dark:text-cyan-300 shadow-sm font-semibold border border-slate-200/80 dark:border-cyan-500/30'
            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
        }`}
      >
        <Columns className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Both</span>
      </button>

      <button
        onClick={() => onLayoutChange('time')}
        title="Time Domain Only"
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
          layout === 'time'
            ? 'bg-white dark:bg-[#161f33] text-cyan-700 dark:text-cyan-300 shadow-sm font-semibold border border-slate-200/80 dark:border-cyan-500/30'
            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
        }`}
      >
        <Activity className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Time Domain</span>
      </button>

      <button
        onClick={() => onLayoutChange('frequency')}
        title="Frequency Domain Only"
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
          layout === 'frequency'
            ? 'bg-white dark:bg-[#161f33] text-cyan-700 dark:text-cyan-300 shadow-sm font-semibold border border-slate-200/80 dark:border-cyan-500/30'
            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
        }`}
      >
        <BarChart2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Frequency Domain</span>
      </button>
    </div>
  );
};
