import { useEffect, useState } from 'react';
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
  const [editorReady, setEditorReady] = useState(false);
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const { state: drawingState } = useDrawingContext();

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

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1100px)');

    const handleChange = () => {
      setIsCompactLayout(media.matches);
    };

    handleChange();

    if ('addEventListener' in media) {
      media.addEventListener('change', handleChange);
      return () => media.removeEventListener('change', handleChange);
    }

    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
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
    const overscrollEvent = 'overscroll' as unknown as keyof DocumentEventMap;

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

    const wheelOptions: AddEventListenerOptions = { passive: false, capture: true };
    document.addEventListener('wheel', blockSwipeWheel, wheelOptions);
    document.addEventListener(overscrollEvent, blockOverscroll as EventListener, { passive: false });

    return () => {
      document.removeEventListener('wheel', blockSwipeWheel, wheelOptions);
      document.removeEventListener(overscrollEvent, blockOverscroll as EventListener);
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

  const isPanelOpen = activePanel !== null;

  return (
    <AppLayout>
      <AppHeader>
        <div className={`editor-chrome editor-from-top editor-speed-fast flex w-full flex-wrap items-center justify-between gap-2 ${editorReady ? 'editor-chrome-ready' : ''}`}>
          <div className="flex min-w-0 items-center space-x-2 sm:space-x-3">
            <Button variant="icon" icon={ArrowLeft} iconSize={16} onClick={handleBackToDashboard} title="Back to dashboard" />
            <Logo title="LineAccurate" subtitle={currentProject?.name ?? 'Project'} />
          </div>

          <div className="flex max-w-full items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-0.5">
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
        <div className={`editor-chrome editor-from-left editor-speed-slow shrink-0 z-20 h-full flex flex-col w-[58px] sm:w-[64px] ${editorReady ? 'editor-chrome-ready' : ''}`}>
          <Panel className="h-full overflow-y-auto overflow-x-visible no-scrollbar">
            <Toolbar />
          </Panel>
        </div>

        <div className="flex-1 relative z-0 rounded-2xl overflow-hidden shadow-inner bg-white">
          <DrawingCanvas onCursorMove={setCursorPosition} />
          <CanvasOverlays />

          {isCompactLayout && isPanelOpen && (
            <button
              type="button"
              aria-label="Close side panel"
              className="absolute inset-0 bg-black/25 z-20"
              onClick={() => setActivePanel(null)}
            />
          )}
        </div>

        <div
          className={`editor-chrome editor-from-right editor-speed-slow z-30 h-full flex flex-col transition-[width] duration-300 ease-in-out ${editorReady ? 'editor-chrome-ready' : ''} ${
            isCompactLayout
              ? `absolute right-0 top-0 ${isPanelOpen ? 'w-[min(84vw,320px)]' : 'w-0 overflow-hidden'} max-w-full`
              : `${isPanelOpen ? 'w-[320px]' : 'w-0 overflow-hidden'} shrink-0`
          }`}
        >
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
    </AppLayout>
  );
}
