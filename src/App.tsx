import { useEffect, useState, useRef, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { DrawingCanvas } from './components/DrawingCanvas';
import { Toolbar } from './components/Toolbar';
import { StatusBar } from './components/StatusBar';
import { LayerPanel } from './components/LayerPanel';
import { PropertiesPanel } from './components/PropertiesPanel';
import { PagesPanel } from './components/PagesPanel';
import { DrawingContextProvider } from './context/DrawingContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProjectProvider, useProjects } from './context/ProjectContext';
import { LoadingScreen } from './components/LoadingScreen';
import { NavFileControls } from './components/NavFileControls';
import { CanvasOverlays } from './components/CanvasOverlays';
import { Layers, Settings, FileText, ChevronDown, User, LogOut, ArrowLeft } from 'lucide-react';

// Lazy-load non-critical routes to reduce initial bundle size
const LoginPage = lazy(() => import('./components/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));

// Route change handler component
function RouteHandler({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return <>{children}</>;
}

function AppContent() {
  const { user, signOut } = useAuth();
  const { currentProject, selectProject } = useProjects();
  const navigate = useNavigate();
  const [activePanel, setActivePanel] = useState<'layers' | 'properties' | 'pages' | null>('properties');
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [activeNav, setActiveNav] = useState<'layers' | 'properties' | 'export' | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showNotice = (type: 'success' | 'error', text: string) => setNotice({ type, text });

  // ── Aggressively prevent two-finger swipe back/forward navigation ──
  useEffect(() => {
    // 1. Capture-phase wheel handler — fires BEFORE any other handler,
    //    blocks any horizontal-dominant scroll the browser would use for nav.
    //    Skips canvas elements so trackpad panning still works on the drawing.
    const blockSwipeWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      // Allow horizontal wheel events on the drawing canvas (for panning)
      if (target?.tagName === 'CANVAS') return;
      if (Math.abs(e.deltaX) > 0 && Math.abs(e.deltaX) >= Math.abs(e.deltaY)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    // 2. Block the "overscroll" event Chrome fires for swipe gestures
    const blockOverscroll = (e: Event) => {
      e.preventDefault();
    };

    // 3. Popstate trap — re-push current URL so back gesture has nowhere to go
    window.history.pushState({ swipeGuard: true }, '', window.location.href);
    const handlePopState = (e: PopStateEvent) => {
      window.history.pushState({ swipeGuard: true }, '', window.location.href);
    };

    // Capture phase = earliest possible interception
    document.addEventListener('wheel', blockSwipeWheel, { passive: false, capture: true });
    document.addEventListener('overscroll' as any, blockOverscroll, { passive: false });
    window.addEventListener('popstate', handlePopState);

    // 4. Force overscroll-behavior on <html> via JS (some browsers ignore CSS)
    document.documentElement.style.overscrollBehaviorX = 'none';
    document.body.style.overscrollBehaviorX = 'none';

    return () => {
      document.removeEventListener('wheel', blockSwipeWheel, { capture: true } as any);
      document.removeEventListener('overscroll' as any, blockOverscroll);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const closeAllNav = () => setActiveNav(null);

  const togglePanel = (panel: 'layers' | 'properties' | 'pages') => {
    setActivePanel(current => current === panel ? null : panel);
  };

  const handleBackToDashboard = () => {
    // Clear current project selection
    selectProject('');
    navigate('/dashboard');
  };

  const handleSignOut = () => {
    signOut();
    navigate('/login');
  };

  const getFirstName = () => {
    if (!user?.fullName) return 'User';
    return user.fullName.split(' ')[0];
  };

  return (
      <div className="h-screen w-screen flex flex-col bg-[#f0f0f0] overflow-hidden">
        
        {/* Header */}
        <header className="shrink-0 z-30">
          <div className="glass-panel rounded-b-2xl px-4 py-2 flex items-center justify-between shadow-lg border-b border-x border-white/20">
            <div className="flex items-center space-x-3">
              <button
                onClick={handleBackToDashboard}
                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition"
                title="Back to dashboard"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="w-7 h-7 bg-[#cc8bed] rounded-md flex items-center justify-center shadow-lg shadow-[#cc8bed]/30">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                  <path d="M22 12A10 10 0 0 0 12 2v10z" />
                </svg>
              </div>
              <div>
                <h1 className="text-base font-bold text-white tracking-tight">LineAccurate</h1>
                <div className="flex items-center space-x-2 text-[9px] text-white/50 font-medium uppercase tracking-wider">
                  <span>{currentProject?.name ?? 'Project'}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <NavFileControls
                activeKey={activeNav}
                onToggle={(key) => {
                  if (key === 'export') {
                    setActiveNav(prev => (prev === 'export' ? null : 'export'));
                    setDropdownOpen(false);
                  }
                }}
                onCloseAll={closeAllNav}
                showNotice={showNotice}
              />
              
              <div className="w-px h-5 bg-white/10 mx-1"></div>

              <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/5">
                <button
                  onClick={() => togglePanel('pages')}
                  className={`p-1.5 rounded-md transition-all duration-200 ${
                    activePanel === 'pages' 
                      ? 'bg-[#cc8bed] text-white shadow-md' 
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                  title="Pages"
                >
                  <FileText size={16} />
                </button>
                <button
                  onClick={() => togglePanel('layers')}
                  className={`p-1.5 rounded-md transition-all duration-200 ${
                    activePanel === 'layers' 
                      ? 'bg-[#cc8bed] text-white shadow-md' 
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                  title="Layers"
                >
                  <Layers size={16} />
                </button>
                <button
                  onClick={() => togglePanel('properties')}
                  className={`p-1.5 rounded-md transition-all duration-200 ${
                    activePanel === 'properties' 
                      ? 'bg-[#cc8bed] text-white shadow-md' 
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                  title="Properties"
                >
                  <Settings size={16} />
                </button>
              </div>

              <div className="w-px h-5 bg-white/10 mx-1"></div>

              {/* User Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => { setDropdownOpen(!dropdownOpen); setActiveNav(null); }}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 transition"
                >
                  <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-semibold">
                    {user?.fullName?.slice(0, 1).toUpperCase() ?? 'U'}
                  </span>
                  <span>{getFirstName()}</span>
                  <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 glass-panel rounded-xl shadow-2xl border border-white/20 overflow-hidden z-50">
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        // Navigate to profile - you can implement this later
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:text-white hover:bg-white/10 transition"
                    >
                      <User size={16} />
                      <span>Profile</span>
                    </button>
                    <div className="h-px bg-white/10"></div>
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        handleSignOut();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-white/10 transition"
                    >
                      <LogOut size={16} />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 flex min-h-0 px-2 py-2 gap-2 relative">
          {/* Left Toolbar */}
          <div className="shrink-0 z-20 h-full flex flex-col">
             <div className="glass-panel rounded-2xl h-full overflow-y-auto overflow-x-visible shadow-lg border border-white/20 no-scrollbar">
                <Toolbar />
             </div>
          </div>

          {/* Canvas Area */}
          <div className="flex-1 relative z-0 rounded-2xl overflow-hidden shadow-inner bg-gray-100">
             <DrawingCanvas onCursorMove={setCursorPosition} />
             <CanvasOverlays />
          </div>

          {/* Right Panels */}
          <div className={`shrink-0 z-20 h-full flex flex-col transition-all duration-300 ease-in-out ${activePanel ? 'w-[320px] opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
             <div className="flex-1 overflow-hidden glass-panel rounded-2xl flex flex-col shadow-lg border border-white/20">
                {activePanel === 'pages' && <PagesPanel />}
                {activePanel === 'layers' && <LayerPanel />}
                {activePanel === 'properties' && <PropertiesPanel />}
             </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className="shrink-0 z-20">
           <StatusBar cursorPosition={cursorPosition} />
        </div>

        {/* Notice Toast */}
        {notice && (
              <div
                role={notice.type === 'error' ? 'alert' : 'status'}
                className={`absolute left-1/2 -translate-x-1/2 top-20 mt-4 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl border z-50 flex items-center space-x-3 animate-in slide-in-from-top-2 fade-in duration-300
                  ${notice.type === 'success' 
                    ? 'bg-[#1e1e1e]/90 border-green-500/50 text-green-400 backdrop-blur-xl' 
                    : 'bg-[#1e1e1e]/90 border-red-500/50 text-red-400 backdrop-blur-xl'}`}
              >
                <div className={`w-2 h-2 rounded-full ${notice.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span>{notice.text}</span>
              </div>
        )}
      </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProjectProvider>
          <RouteHandler>
            <Routes>
              <Route path="/login" element={<LoginRoute />} />
              <Route path="/dashboard" element={<DashboardRoute />} />
              <Route path="/app/:projectId" element={<ProtectedRoute />} />
              <Route path="/" element={<Navigate to="/login" replace />} />
            </Routes>
          </RouteHandler>
        </ProjectProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

function LoginRoute() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <LoadingScreen />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <LoginPage />
    </Suspense>
  );
}

function DashboardRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Dashboard />
    </Suspense>
  );
}

function ProtectedRoute() {
  const { user, loading } = useAuth();
  const { currentProject, selectProject, projects } = useProjects();
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!projectId) return;
    
    if (projects.length > 0) {
      const project = projects.find(p => p.id === projectId);
      if (project) {
        selectProject(projectId);
      } else {
        // Project not found, redirect to dashboard
        navigate('/dashboard', { replace: true });
      }
    }
  }, [projectId, projects, selectProject, navigate]);

  // If current project is cleared (e.g., by back button), redirect
  useEffect(() => {
    if (projectId && !currentProject && projects.length > 0) {
      navigate('/dashboard', { replace: true });
    }
  }, [currentProject, projectId, projects.length, navigate]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Wait for project to be selected
  if (!currentProject || currentProject.id !== projectId) {
    return <LoadingScreen />;
  }

  return (
    <DrawingContextProvider key={projectId} projectId={projectId}>
      <AppContent />
    </DrawingContextProvider>
  );
}

export default App;