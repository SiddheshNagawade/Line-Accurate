type IdleHandle = number;

declare global {
  interface Window {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => IdleHandle;
    cancelIdleCallback?: (handle: IdleHandle) => void;
  }
}

let loginPromise: Promise<typeof import('../components/auth/LoginPage')> | null = null;
let dashboardPromise: Promise<typeof import('../components/Dashboard')> | null = null;
let editorPromise: Promise<typeof import('../components/EditorPage')> | null = null;
let landingPromise: Promise<typeof import('../components/LandingPage')> | null = null;

export function loadLoginPage() {
  if (!loginPromise) {
    loginPromise = import('../components/auth/LoginPage');
  }
  return loginPromise;
}

export function loadDashboardPage() {
  if (!dashboardPromise) {
    dashboardPromise = import('../components/Dashboard');
  }
  return dashboardPromise;
}

export function loadEditorPage() {
  if (!editorPromise) {
    editorPromise = import('../components/EditorPage');
  }
  return editorPromise;
}

export function loadLandingPage() {
  if (!landingPromise) {
    landingPromise = import('../components/LandingPage');
  }
  return landingPromise;
}

function scheduleIdle(task: () => void, timeout = 1200) {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(task, { timeout });
    return;
  }
  window.setTimeout(task, 180);
}

export function preloadLandingAdjacentRoutes(isAuthenticated: boolean) {
  scheduleIdle(() => {
    if (isAuthenticated) {
      void loadDashboardPage();
      return;
    }
    void Promise.all([loadLoginPage(), loadDashboardPage()]);
  });
}

export function preloadEditorShell() {
  scheduleIdle(() => {
    void loadEditorPage();
  }, 800);
}
