/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', '"Courier New"', 'monospace'],
      },
      colors: {
        scope: {
          bg: '#0a0d14',
          panel: '#101522',
          card: '#161c2d',
          border: '#1f293d',
          grid: '#1a2333',
          subgrid: '#121927',
          trace: '#00f0ff',
          traceGlow: 'rgba(0, 240, 255, 0.25)',
          harm2: '#a855f7',
          harm3: '#ec4899',
          harm4: '#f59e0b',
        }
      }
    },
  },
  plugins: [],
}
