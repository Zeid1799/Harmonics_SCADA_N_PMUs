import React, { useState, useRef, useEffect } from 'react';
import { AppSettings, AppTheme, AppViewMode } from '../types/settings';
import { Settings as SettingsIcon, Palette, Network, Activity } from 'lucide-react';

interface SettingsDropdownProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

export const SettingsDropdown: React.FC<SettingsDropdownProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdateSettings({ theme: e.target.value as AppTheme });
  };

  const handleViewModeChange = (mode: AppViewMode) => {
    onUpdateSettings({ viewMode: mode });
  };

  return (
    <div ref={dropdownRef} className="relative inline-block text-left">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        title="Application Settings"
        aria-label="Application Settings"
        aria-expanded={isOpen}
        className={`flex items-center gap-1.5 p-2 rounded-lg border transition-all ${
          isOpen
            ? 'bg-slate-200 dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 border-cyan-500/50 shadow-sm'
            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-800 hover:text-slate-900 dark:hover:text-slate-100 hover:border-slate-400 dark:hover:border-slate-700'
        }`}
      >
        <SettingsIcon className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`} />
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e1424] shadow-2xl z-50 p-3.5 flex flex-col gap-3 font-sans animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80 font-mono text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            <span>Settings</span>
          </div>

          {/* Section: View Mode */}
          <div className="flex flex-col gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <Network className="w-3.5 h-3.5 text-cyan-500" />
              <span>Workspace View</span>
            </div>

            <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[11px]">
              <button
                type="button"
                onClick={() => handleViewModeChange('waveform')}
                className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-md font-semibold transition-all ${
                  settings.viewMode === 'waveform'
                    ? 'bg-white dark:bg-[#161f33] text-cyan-700 dark:text-cyan-300 shadow-sm border border-slate-200/80 dark:border-cyan-500/30'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Activity className="w-3 h-3" />
                <span>Waveform View</span>
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange('network')}
                className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-md font-semibold transition-all ${
                  settings.viewMode === 'network'
                    ? 'bg-white dark:bg-[#161f33] text-cyan-700 dark:text-cyan-300 shadow-sm border border-slate-200/80 dark:border-cyan-500/30'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Network className="w-3 h-3" />
                <span>Simulator</span>
              </button>
            </div>
          </div>

          {/* Section: Appearance */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <Palette className="w-3.5 h-3.5 text-cyan-500" />
              <span>Appearance</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Theme</span>
              <select
                value={settings.theme}
                onChange={handleThemeChange}
                className="rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1 text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 cursor-pointer"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

