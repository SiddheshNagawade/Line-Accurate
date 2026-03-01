import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent browser-level pinch-to-zoom so only the drawing canvas zooms.
// Trackpad pinch fires wheel events with ctrlKey; Safari fires gesture events.
window.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
window.addEventListener('gesturestart', (e) => e.preventDefault());
window.addEventListener('gesturechange', (e) => e.preventDefault());
window.addEventListener('gestureend', (e) => e.preventDefault());

// Block Ctrl/Cmd +/- browser zoom shortcuts
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
    e.preventDefault();
  }
}, { passive: false });

// Register Service Worker for offline support and aggressive caching
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(new URL('./service-worker.ts', import.meta.url), { type: 'module' })
      .then((reg) => {
        console.log('[App] Service Worker registered:', reg);
        // Check for updates every 10 seconds
        setInterval(() => reg.update(), 10000);
      })
      .catch((err) => console.error('[App] Service Worker registration failed:', err));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
