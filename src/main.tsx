import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Target container '#root' was not found in the DOM.");
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (err: unknown) {
  console.error('Fatal initialization error in main.tsx:', err);
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="height:100vh;display:flex;align-items:center;justify-content:center;background:#080b11;color:#f43f5e;font-family:monospace;padding:20px;">
        <div style="max-width:550px;width:100%;background:#0d121f;border:1px solid #e11d48;border-radius:12px;padding:24px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.6);">
          <h2 style="color:#f87171;margin-top:0;font-size:16px;">Failed to Initialize Application</h2>
          <pre style="background:#05070c;padding:12px;border-radius:6px;font-size:11px;overflow:auto;color:#fda4af;white-space:pre-wrap;max-height:200px;">${err instanceof Error ? err.stack || err.message : String(err)}</pre>
          <button onclick="localStorage.clear();location.reload();" style="background:#06b6d4;color:#05070c;border:none;border-radius:6px;padding:8px 16px;font-weight:bold;cursor:pointer;margin-top:14px;font-family:monospace;font-size:12px;">Clear Settings &amp; Reload</button>
        </div>
      </div>
    `;
  }
}
