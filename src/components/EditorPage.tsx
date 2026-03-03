import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Settings, FileText, ChevronDown, User, LogOut, ArrowLeft } from 'lucide-react';
import { DrawingCanvas } from './DrawingCanvas';
import { Toolbar } from './Toolbar';
import { StatusBar } from './StatusBar';
import { LayerPanel } from './LayerPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { PagesPanel } from './PagesPanel';
import { NavFileControls } from './NavFileControls';
import { CanvasOverlays } from './CanvasOverlays';
import { useDrawingContext } from '../context/DrawingContext';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectContext';
import { Button, Divider, Dropdown, DropdownItem, DropdownDivider, ToggleGroup, ToggleItem, Avatar, Panel } from './ui';
import { AppLayout, AppHeader, AppMain, Logo } from './layout';

export function EditorPage() {
  const { user, signOut } = useAuth();
  const { currentProject, selectProject } = useProjects();
  const navigate = useNavigate();
  const [activePanel, setActivePanel] = useState<'layers' | 'properties' | 'pages' | null>('properties');
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [activeNav, setActiveNav] = useState<'layers' | 'properties' | 'export' | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [unsaveWarning, setUnsaveWarning] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const { state: drawingState } = useDrawingContext();
  const pendingNavigationRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEditorReady(true));
    return () => {
      cancelAnimationFrame(raf);
      setEditorReady(false);
    };
  }, []);

  const showNotice = (type: 'success' | 'error', text: string) => setNotice({ type, text });

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (drawingState.elements.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [drawingState.elements.length]);

  useEffect(() => {
    const blockSwipeWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === 'CANVAS') return;
      if (Math.abs(e.deltaX) > 0 && Math.abs(e.deltaX) >= Math.abs(e.deltaY)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    const blockOverscroll = (e: Event) => {
      e.preventDefault();
    };

    document.addEventListener('wheel', blockSwipeWheel, { passive: false, capture: true });
    document.addEventListener('overscroll' as any, blockOverscroll, { passive: false });

    document.documentElement.style.overscrollBehaviorX = 'none';
    document.body.style.overscrollBehaviorX = 'none';

    return () => {
      document.removeEventListener('wheel', blockSwipeWheel, { capture: true } as any);
      document.removeEventListener('overscroll' as any, blockOverscroll);
    };
  }, []);

  const closeAllNav = () => setActiveNav(null);

  const togglePanel = (panel: 'layers' | 'properties' | 'pages') => {
    setActivePanel(current => current === panel ? null : panel);
  };

  const handleBackToDashboard = () => {
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
    <AppLayout>
      <AppHeader>
        <div className={`editor-chrome editor-from-top editor-speed-fast flex w-full items-center justify-between ${editorReady ? 'editor-chrome-ready' : ''}`}>
          <div className="flex items-center space-x-3">
            <Button variant="icon" icon={ArrowLeft} iconSize={16} onClick={handleBackToDashboard} title="Back to dashboard" />
            <Logo title="LineAccurate" subtitle={currentProject?.name ?? 'Project'} />
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

            <Divider orientation="vertical" className="mx-1" />

            <ToggleGroup>
              <ToggleItem icon={<FileText size={16} />} active={activePanel === 'pages'} onClick={() => togglePanel('pages')} title="Pages" />
              <ToggleItem icon={<Layers size={16} />} active={activePanel === 'layers'} onClick={() => togglePanel('layers')} title="Layers" />
              <ToggleItem icon={<Settings size={16} />} active={activePanel === 'properties'} onClick={() => togglePanel('properties')} title="Properties" />
            </ToggleGroup>

            <Divider orientation="vertical" className="mx-1" />

            <Dropdown
              isOpen={dropdownOpen}
              onClose={() => setDropdownOpen(false)}
              trigger={
                <Button variant="ghost" size="sm" onClick={() => { setDropdownOpen(!dropdownOpen); setActiveNav(null); }}>
                  <Avatar name={user?.fullName} />
                  <span>{getFirstName()}</span>
                  <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </Button>
              }
            >
              <DropdownItem icon={User} onClick={() => setDropdownOpen(false)}>
                Profile
              </DropdownItem>
              <DropdownDivider />
              <DropdownItem icon={LogOut} variant="danger" onClick={() => { setDropdownOpen(false); handleSignOut(); }}>
                Logout
              </DropdownItem>
            </Dropdown>
          </div>
        </div>
      </AppHeader>

      <AppMain>
        <div className={`editor-chrome editor-from-left editor-speed-slow shrink-0 z-20 h-full flex flex-col ${editorReady ? 'editor-chrome-ready' : ''}`}>
          <Panel className="h-full overflow-y-auto overflow-x-visible no-scrollbar">
            <Toolbar />
          </Panel>
        </div>

        <div className="flex-1 relative z-0 rounded-2xl overflow-hidden shadow-inner bg-white">
          <DrawingCanvas onCursorMove={setCursorPosition} />
          <CanvasOverlays />
        </div>

        <div className={`editor-chrome editor-from-right editor-speed-slow shrink-0 z-20 h-full flex flex-col transition-[width] duration-300 ease-in-out ${editorReady ? 'editor-chrome-ready' : ''} ${activePanel ? 'w-[320px]' : 'w-0 overflow-hidden'}`}>
          <Panel className="flex-1 overflow-hidden flex flex-col">
            {activePanel === 'pages' && <PagesPanel />}
            {activePanel === 'layers' && <LayerPanel />}
            {activePanel === 'properties' && <PropertiesPanel />}
          </Panel>
        </div>
      </AppMain>

      <div className={`editor-chrome editor-from-bottom editor-speed-fast shrink-0 z-20 ${editorReady ? 'editor-chrome-ready' : ''}`}>
        <StatusBar cursorPosition={cursorPosition} />
      </div>

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

      {unsaveWarning && drawingState.elements.length > 0 && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] animate-in fade-in duration-200">
          <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full mx-4 animate-in zoom-in-95 duration-300">
            <div className="px-6 py-5 border-b border-white/10">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-400">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>Unsaved Changes</span>
              </h2>
            </div>
            <div className="px-6 py-4 space-y-3">
              <p className="text-white/80 text-sm leading-relaxed">
                You have unsaved work on this drawing. Your progress will be lost if you leave without saving.
              </p>
              <p className="text-white/60 text-sm">
                Would you like to save before leaving?
              </p>
            </div>
            <div className="px-6 py-4 border-t border-white/10 flex space-x-3">
              <Button variant="secondary" size="md" onClick={() => setUnsaveWarning(false)} className="flex-1">
                Continue Working
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={() => {
                  setUnsaveWarning(false);
                  if (pendingNavigationRef.current) {
                    pendingNavigationRef.current();
                    pendingNavigationRef.current = null;
                  }
                }}
                className="flex-1"
              >
                Leave Without Saving
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
