import React from 'react';
import { AppSettings, AppTheme, AppViewMode } from '../types/settings';
import { Settings as SettingsIcon, Moon, Sun, Gauge, Info, Network } from 'lucide-react';

interface SettingsTabProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdateSettings({ theme: e.target.value as AppTheme });
  };

  const handleViewModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdateSettings({ viewMode: e.target.value as AppViewMode });
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdateSettings({ playbackSpeed: parseFloat(e.target.value) });
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 flex flex-col gap-6">
      {/* Title */}
      <div className="flex items-center gap-2.5 border-b pb-4 border-slate-200 dark:border-slate-800">
        <SettingsIcon className="w-5 h-5 text-cyan-500" />
        <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
          Application Settings
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* View Mode Setting */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d121f] p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 mt-0.5">
                <Network className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <label
                  htmlFor="view-mode-select"
                  className="block text-sm font-semibold text-slate-900 dark:text-slate-100"
                >
                  Visualization Mode
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Switch between Waveform View (default) and the IEEE 30-Bus Power-System Simulator.
                </p>
              </div>
            </div>

            <div className="w-full sm:w-48">
              <select
                id="view-mode-select"
                value={settings.viewMode}
                onChange={handleViewModeChange}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 cursor-pointer"
              >
                <option value="waveform">Waveform View (Default)</option>
                <option value="network">Power-System Simulator</option>
              </select>
            </div>
          </div>
        </div>

        {/* Theme Setting */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d121f] p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 mt-0.5">
                {settings.theme === 'dark' ? (
                  <Moon className="w-4 h-4 text-cyan-400" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-500" />
                )}
              </div>
              <div>
                <label
                  htmlFor="theme-select"
                  className="block text-sm font-semibold text-slate-900 dark:text-slate-100"
                >
                  Theme
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Choose between dark technical oscilloscope aesthetic or high-contrast light mode.
                </p>
              </div>
            </div>

            <div className="w-full sm:w-48">
              <select
                id="theme-select"
                value={settings.theme}
                onChange={handleThemeChange}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 cursor-pointer"
              >
                <option value="dark">Dark Theme</option>
                <option value="light">Light Theme</option>
              </select>
            </div>
          </div>
        </div>

        {/* Playback Speed Setting */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d121f] p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 mt-0.5">
                <Gauge className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <label
                  htmlFor="speed-select"
                  className="block text-sm font-semibold text-slate-900 dark:text-slate-100"
                >
                  Visualization Playback Speed
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Controls the visual sweep speed of the waveform animation without changing signal frequency.
                </p>
              </div>
            </div>

            <div className="w-full sm:w-48">
              <select
                id="speed-select"
                value={settings.playbackSpeed}
                onChange={handleSpeedChange}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 cursor-pointer font-mono"
              >
                <option value="0.25">0.25×</option>
                <option value="0.5">0.5×</option>
                <option value="1">1× (Default)</option>
                <option value="2">2×</option>
                <option value="4">4×</option>
              </select>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Info className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
            <span>
              Note: Waveform period and physical frequency remain exact ({`T = 1/f`}). This setting only alters visual animation pacing.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
