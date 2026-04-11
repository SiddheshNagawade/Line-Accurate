import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

function hideBootShell() {
  const shell = document.getElementById('boot-shell');
  if (!shell) return;
  shell.classList.add('boot-shell-hidden');
  window.setTimeout(() => {
    shell.remove();
  }, 220);
}

// ── Minimal Web Vitals capture using native PerformanceObserver ──────────────
// Reports LCP, CLS, and INP to console in dev; swap the handler for an
// analytics endpoint in production without adding any bundle weight.
function observeWebVitals() {
  try {
    // Largest Contentful Paint
    new PerformanceObserver((list) => {
      const last = list.getEntries().at(-1) as PerformanceEntry & { startTime: number };
      if (last) console.log('[Vitals] LCP:', last.startTime.toFixed(0), 'ms');
    }).observe({ type: 'largest-contentful-paint', buffered: true });

    // Cumulative Layout Shift
    let clsScore = 0;
    new PerformanceObserver((list) => {
      list.getEntries().forEach((e: PerformanceEntry & { hadRecentInput?: boolean; value?: number }) => {
        if (!e.hadRecentInput) clsScore += e.value ?? 0;
      });
      console.log('[Vitals] CLS so far:', clsScore.toFixed(4));
    }).observe({ type: 'layout-shift', buffered: true });

    // Interaction to Next Paint (Chrome 96+)
    new PerformanceObserver((list) => {
      list.getEntries().forEach((e: PerformanceEntry & { duration?: number }) => {
        console.log('[Vitals] INP:', (e.duration ?? 0).toFixed(0), 'ms');
      });
    }).observe({ type: 'event', durationThreshold: 16, buffered: true });
  } catch {
    // Browser doesn't support one of the observer types — safe to skip.
  }
}

if (import.meta.env.DEV) observeWebVitals();

// Prevent browser-level pinch-to-zoom so only the drawing canvas zooms.
// Trackpad pinch fires wheel events with ctrlKey; Safari fires gesture events.
const isEditorRoute = () => window.location.pathname.startsWith('/app/');

window.addEventListener('wheel', (e) => {
  if (isEditorRoute() && e.ctrlKey) e.preventDefault();
}, { passive: false });

window.addEventListener('gesturestart', (e) => {
  if (isEditorRoute()) e.preventDefault();
});

window.addEventListener('gesturechange', (e) => {
  if (isEditorRoute()) e.preventDefault();
});

window.addEventListener('gestureend', (e) => {
  if (isEditorRoute()) e.preventDefault();
});

// Block Ctrl/Cmd +/- browser zoom shortcuts
window.addEventListener('keydown', (e) => {
  if (isEditorRoute() && (e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
    e.preventDefault();
  }
}, { passive: false });

// Recovery mode: unregister any previously installed service worker registrations
// to prevent stale cache/control issues from blocking production navigation.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
        });
      })
      .catch(() => {
        // Ignore cleanup failures — app should still boot normally.
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

window.requestAnimationFrame(() => {
  window.requestAnimationFrame(() => {
    hideBootShell();
  });
});
