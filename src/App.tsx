import React, { useEffect, Suspense, lazy, Component, useCallback, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { DrawingContextProvider } from './context/DrawingContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProjectProvider, useProjects } from './context/ProjectContext';
import { LoadingScreen } from './components/LoadingScreen';
import { LandingPage } from './components/LandingPage';

function RouteLoadingScreen({ source }: { source: string }) {
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const start = performance.now();
    console.log(`[LoadingTrace] ${source} started`);

    return () => {
      const durationMs = performance.now() - start;
      console.log(`[LoadingTrace] ${source} finished in ${durationMs.toFixed(1)}ms`);
    };
  }, [source]);

  return <LoadingScreen />;
}

// Error boundary for the editor — prevents a single project failure from
// crashing the whole app; shows a minimal recovery UI instead.
class EditorErrorBoundary extends Component<
  { children: React.ReactNode },
  { crashed: boolean; error: string }
> {
  state = { crashed: false, error: '' };

  static getDerivedStateFromError(err: unknown) {
    return { crashed: true, error: String(err) };
  }

  componentDidCatch(err: unknown, info: React.ErrorInfo) {
    console.error('[EditorErrorBoundary]', err, info.componentStack);
  }

  render() {
    if (this.state.crashed) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#0f0f12] text-white gap-4 p-8">
          <p className="text-lg font-semibold">Something went wrong in the editor.</p>
          <p className="text-sm text-white/50 max-w-sm text-center">{this.state.error}</p>
          <button
            onClick={() => { this.setState({ crashed: false, error: '' }); }}
            className="px-4 py-2 bg-[#cc8bed] rounded-lg text-sm font-medium hover:bg-[#b87adc] transition"
          >
            Try again
          </button>
          <button
            onClick={() => { window.location.href = '/dashboard'; }}
            className="text-xs text-white/40 hover:text-white/70 transition"
          >
            Back to dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Keep landing in initial chunk; lazy-load non-critical routes
const importLoginPage = () => import('./components/auth/LoginPage').then(m => ({ default: m.LoginPage }));
const importDashboardPage = () => import('./components/Dashboard').then(m => ({ default: m.Dashboard }));
const importEditorPage = () => import('./components/EditorPage').then(m => ({ default: m.EditorPage }));

const LoginPage = lazy(importLoginPage);
const Dashboard = lazy(importDashboardPage);
const EditorPage = lazy(importEditorPage);

const hasRIC = typeof window !== 'undefined' && 'requestIdleCallback' in window;

function runWhenIdle(task: () => void, timeout = 1200) {
  if (hasRIC) {
    const id = (window as Window & {
      requestIdleCallback: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback: (handle: number) => void;
    }).requestIdleCallback(() => task(), { timeout });

    return () => {
      (window as Window & { cancelIdleCallback: (handle: number) => void }).cancelIdleCallback(id);
    };
  }

  const id = window.setTimeout(task, 240);
  return () => window.clearTimeout(id);
}

// Route change handler component
function RouteHandler({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    const isEditorRoute = location.pathname.startsWith('/app/');
    const html = document.documentElement;
    const body = document.body;

    if (isEditorRoute) {
      html.style.overscrollBehaviorX = 'none';
      html.style.overscrollBehaviorY = 'none';
      body.style.overscrollBehaviorX = 'none';
      body.style.overscrollBehaviorY = 'none';
      return;
    }

    html.style.overscrollBehaviorX = '';
    html.style.overscrollBehaviorY = '';
    body.style.overscrollBehaviorX = '';
    body.style.overscrollBehaviorY = '';
  }, [location.pathname]);

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProjectProvider>
          <RouteHandler>
            <Routes>
              <Route path="/" element={<LandingRoute />} />
              <Route path="/landing" element={<LandingRoute />} />
              <Route path="/login" element={<LoginRoute />} />
              <Route path="/dashboard" element={<DashboardRoute />} />
              <Route path="/app/:projectId" element={<ProtectedRoute />} />
            </Routes>
          </RouteHandler>
        </ProjectProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

function LandingRoute() {
  useEffect(() => {
    const cancel = runWhenIdle(() => {
      void importLoginPage();
      void importDashboardPage();
    }, 1500);

    return cancel;
  }, []);

  return (
    <LandingPage />
  );
}

function LoginRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const previewMode = new URLSearchParams(location.search).get('preview') === '1';
  
  if (loading) {
    return <RouteLoadingScreen source="login-auth" />;
  }

  if (user && !previewMode) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Suspense fallback={<RouteLoadingScreen source="login-chunk" />}>
      <LoginPage />
    </Suspense>
  );
}

function DashboardRoute() {
  const { user, loading } = useAuth();
  const preloadEditor = useCallback(() => {
    void importEditorPage();
  }, []);

  if (loading) {
    return <RouteLoadingScreen source="dashboard-auth" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Suspense fallback={<RouteLoadingScreen source="dashboard-chunk" />}>
      <Dashboard onProjectIntent={preloadEditor} />
    </Suspense>
  );
}

function ProtectedRoute() {
  const { user, loading } = useAuth();
  const { selectProject, projects, projectsHydrated } = useProjects();
  const { projectId } = useParams<{ projectId: string }>();
  const [hydrationTimedOut, setHydrationTimedOut] = useState(false);

  const routeProject = projectId ? projects.find(p => p.id === projectId) ?? null : null;

  useEffect(() => {
    if (!routeProject || !projectId) return;
    selectProject(projectId);
  }, [projectId, routeProject, selectProject]);

  useEffect(() => {
    if (projectsHydrated) {
      setHydrationTimedOut(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setHydrationTimedOut(true);
    }, 1200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [projectsHydrated]);

  if (loading) {
    return <RouteLoadingScreen source="editor-auth" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!projectId) {
    return <Navigate to="/dashboard" replace />;
  }

  // Hydration should be near-instant; fail safe to dashboard if it stalls.
  if (!projectsHydrated) {
    if (hydrationTimedOut) {
      return <Navigate to="/dashboard" replace />;
    }
    return <RouteLoadingScreen source="editor-project-hydration" />;
  }

  if (!routeProject) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <EditorErrorBoundary>
      <DrawingContextProvider key={projectId} projectId={projectId}>
        <Suspense fallback={<RouteLoadingScreen source="editor-chunk" />}>
          <EditorPage />
        </Suspense>
      </DrawingContextProvider>
    </EditorErrorBoundary>
  );
}

export default App;