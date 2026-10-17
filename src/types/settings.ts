export type AppTheme = 'dark' | 'light';
export type WorkspaceLayout = 'both' | 'time' | 'frequency';
export type AppViewMode = 'waveform' | 'network';

export interface AppSettings {
  theme: AppTheme;
  playbackSpeed: number; // 0.1, 0.25, 0.5, 1 (default 1)
  layout: WorkspaceLayout; // 'both' | 'time' | 'frequency' (default 'both')
  viewMode: AppViewMode; // 'waveform' | 'network' (default 'waveform')
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  playbackSpeed: 1,
  layout: 'both',
  viewMode: 'waveform',
};

