import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MousePointer2, Minus, Ruler, PenTool, Type, Eraser, RotateCcw, RotateCw, ImagePlus, LayoutGrid, Check } from 'lucide-react';
import { useDrawingContext, Tool, ToolSettings } from '../context/DrawingContext';

// Map tool ids to lucide icons
const toolIconMap: Record<Tool | 'image', React.ElementType> = {
  select: MousePointer2,
  line: Minus,
  angle: Ruler,
  freehand: PenTool,
  text: Type,
  eraser: Eraser,
  image: ImagePlus,
};

interface ToolDef {
  id: Tool | 'image';
  label: string;
  shortcut: string;
}

const allTools: ToolDef[] = [
  { id: 'select', label: 'Select', shortcut: 'V' },
  { id: 'line', label: 'Line', shortcut: 'L' },
  { id: 'angle', label: 'Angle', shortcut: 'A' },
  { id: 'freehand', label: 'Freehand', shortcut: 'P' },
  { id: 'text', label: 'Text', shortcut: 'T' },
  { id: 'eraser', label: 'Eraser', shortcut: 'E' },
  { id: 'image', label: 'Insert Image', shortcut: 'I' },
];

const drawingToolIds: Tool[] = ['select', 'line', 'angle', 'freehand', 'text', 'eraser'];

const DEFAULT_VISIBLE: (Tool | 'image')[] = ['select', 'line', 'freehand', 'eraser'];

const thicknessPresets = [1, 2, 3];

export function Toolbar() {
  const { state, dispatch } = useDrawingContext();
  const [showAllTools, setShowAllTools] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [visibleToolIds, setVisibleToolIds] = useState<(Tool | 'image')[]>(() => {
    try {
      const saved = localStorage.getItem('la_visible_tools');
      return saved ? JSON.parse(saved) : DEFAULT_VISIBLE;
    } catch { return DEFAULT_VISIBLE; }
  });

  const btnRef = useRef<HTMLButtonElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const settingsPortalRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const [settingsPos, setSettingsPos] = useState({ top: 0, left: 0 });

  // Persist visible tools
  useEffect(() => {
    localStorage.setItem('la_visible_tools', JSON.stringify(visibleToolIds));
  }, [visibleToolIds]);

  // Dropdown position
  useEffect(() => {
    if (showAllTools && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.top, left: rect.right + 10 });
    }
  }, [showAllTools]);

  // Settings panel position — anchored to the active tool button
  useEffect(() => {
    if (showSettings && settingsBtnRef.current) {
      const rect = settingsBtnRef.current.getBoundingClientRect();
      setSettingsPos({ top: rect.top, left: rect.right + 10 });
    }
  }, [showSettings, state.currentTool]);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!showAllTools && !showSettings) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (showAllTools &&
        btnRef.current && !btnRef.current.contains(target) &&
        portalRef.current && !portalRef.current.contains(target)
      ) {
        setShowAllTools(false);
      }
      if (showSettings &&
        settingsBtnRef.current && !settingsBtnRef.current.contains(target) &&
        settingsPortalRef.current && !settingsPortalRef.current.contains(target)
      ) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAllTools, showSettings]);

  const handleToolSelect = (tool: Tool) => {
    dispatch({ type: 'SET_TOOL', tool });
  };

  const toggleToolVisibility = (toolId: Tool | 'image') => {
    setVisibleToolIds(prev => {
      if (prev.includes(toolId)) {
        if (prev.length <= 1) return prev;
        return prev.filter(t => t !== toolId);
      } else {
        return [...prev, toolId];
      }
    });
  };

  const handleInsertImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageSrc = event.target?.result as string;
        if (imageSrc) window.dispatchEvent(new CustomEvent('insertImage', { detail: { imageSrc } }));
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleStrokeWidthChange = (tool: Tool, width: number) => {
    const t = tool === 'select' ? 'line' : tool;
    dispatch({ type: 'UPDATE_TOOL_SETTINGS', tool: t as keyof ToolSettings, settings: { strokeWidth: width } as any });
  };

  const handleColorChange = (tool: Tool, color: string) => {
    if (tool === 'eraser') return;
    const t = tool === 'select' ? 'line' : tool;
    dispatch({ type: 'UPDATE_TOOL_SETTINGS', tool: t as keyof ToolSettings, settings: { strokeColor: color } as any });
  };

  const getCurrentStrokeWidth = (): number => {
    switch (state.currentTool) {
      case 'line': return state.toolSettings.line.strokeWidth;
      case 'angle': return state.toolSettings.angle.strokeWidth;
      case 'freehand': return state.toolSettings.freehand.strokeWidth;
      case 'eraser': return state.toolSettings.eraser.strokeWidth;
      default: return 2;
    }
  };

  const getCurrentColor = (): string => {
    switch (state.currentTool) {
      case 'line': return state.toolSettings.line.strokeColor;
      case 'angle': return state.toolSettings.angle.strokeColor;
      case 'freehand': return state.toolSettings.freehand.strokeColor;
      case 'text': return state.toolSettings.text.strokeColor;
      default: return '#ffffff';
    }
  };

  const visibleTools = allTools.filter(t => visibleToolIds.includes(t.id));
  const hasSettings = state.currentTool !== 'select';

  return (
    <div className="h-full py-3 flex flex-col items-center space-y-2 bg-transparent overflow-y-auto overflow-x-hidden no-scrollbar px-1.5">

      {/* ── All Tools button ── */}
      <button
        ref={btnRef}
        onClick={() => { setShowAllTools(!showAllTools); setShowSettings(false); }}
        className={`w-11 h-11 rounded-xl transition-all duration-200 flex items-center justify-center shrink-0 ${
          showAllTools
            ? 'bg-[#cc8bed]/30 text-[#cc8bed] ring-1 ring-[#cc8bed]/40'
            : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
        }`}
        title="All Tools"
      >
        <LayoutGrid size={20} />
      </button>

      {/* All Tools dropdown via Portal */}
      {showAllTools && createPortal(
        <div
          ref={portalRef}
          className="fixed w-56 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl py-2"
          style={{ top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999 }}
        >
          <div className="px-3 py-1.5 text-[10px] text-white/40 uppercase tracking-wider font-medium">All Tools</div>
          {allTools.map(tool => {
            const isVisible = visibleToolIds.includes(tool.id);
            const isActive = tool.id !== 'image' && state.currentTool === tool.id;
            const Icon = toolIconMap[tool.id];
            return (
              <div
                key={tool.id}
                className={`flex items-center px-3 py-2.5 mx-1 rounded-lg cursor-pointer transition-all ${
                  isActive
                    ? 'bg-[#cc8bed]/20 text-white'
                    : 'hover:bg-white/5 text-white/70 hover:text-white'
                }`}
                onClick={() => {
                  if (tool.id === 'image') {
                    handleInsertImage();
                  } else {
                    handleToolSelect(tool.id as Tool);
                    if (!visibleToolIds.includes(tool.id)) {
                      setVisibleToolIds(prev => [...prev, tool.id]);
                    }
                  }
                  setShowAllTools(false);
                }}
              >
                <Icon size={18} className="mr-3 shrink-0" />
                <span className="text-sm flex-1">{tool.label}</span>
                <span className="text-[10px] text-white/30 mr-2.5 font-mono">{tool.shortcut}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleToolVisibility(tool.id); }}
                  className={`w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0 ${
                    isVisible
                      ? 'bg-[#cc8bed] border-[#cc8bed] text-white'
                      : 'border-white/20 hover:border-white/40'
                  }`}
                  title={isVisible ? 'Hide from toolbar' : 'Show in toolbar'}
                >
                  {isVisible && <Check size={12} strokeWidth={3} />}
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}

      {/* ── Separator ── */}
      <div className="w-8 h-px bg-white/10 rounded-full shrink-0" />

      {/* ── Undo / Redo ── */}
      <div className="flex flex-col space-y-1.5 shrink-0">
        <button
          onClick={() => dispatch({ type: 'UNDO' })}
          disabled={state.historyIndex <= 0}
          className="w-11 h-11 rounded-xl transition-all duration-200 flex items-center justify-center bg-white/5 text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed group relative"
          title="Undo (Cmd+Z)"
        >
          <RotateCcw size={18} />
          <div className="absolute left-full ml-3 px-2.5 py-1 bg-[#1e1e1e] text-white text-[11px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 border border-white/10 pointer-events-none">Undo</div>
        </button>
        <button
          onClick={() => dispatch({ type: 'REDO' })}
          disabled={state.historyIndex >= state.history.length - 1}
          className="w-11 h-11 rounded-xl transition-all duration-200 flex items-center justify-center bg-white/5 text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed group relative"
          title="Redo (Cmd+Shift+Z)"
        >
          <RotateCw size={18} />
          <div className="absolute left-full ml-3 px-2.5 py-1 bg-[#1e1e1e] text-white text-[11px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 border border-white/10 pointer-events-none">Redo</div>
        </button>
      </div>

      {/* ── Separator ── */}
      <div className="w-8 h-px bg-white/10 rounded-full shrink-0" />

      {/* ── Visible tool buttons ── */}
      <div className="flex flex-col space-y-1.5">
        {visibleTools.map((tool) => {
          const Icon = toolIconMap[tool.id];
          const isImage = tool.id === 'image';
          const isActive = !isImage && state.currentTool === tool.id;
          return (
            <button
              key={tool.id}
              ref={isActive && hasSettings ? settingsBtnRef : undefined}
              onClick={() => {
                if (isImage) {
                  handleInsertImage();
                } else {
                  handleToolSelect(tool.id as Tool);
                  // Show settings flyout if tool has settings
                  if (tool.id !== 'select') {
                    setShowSettings(true);
                    setShowAllTools(false);
                  } else {
                    setShowSettings(false);
                  }
                }
              }}
              className={`w-11 h-11 rounded-xl transition-all duration-200 group relative flex items-center justify-center ${
                isActive
                  ? 'bg-[#cc8bed] text-white shadow-[0_0_15px_-3px_rgba(204,139,237,0.5)]'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
              }`}
              title={`${tool.label} (${tool.shortcut})`}
            >
              <Icon size={20} />
              {/* Tooltip */}
              <div className="absolute left-full ml-3 px-2.5 py-1 bg-[#1e1e1e] text-white text-[11px] font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap z-50 border border-white/10 shadow-xl pointer-events-none">
                {tool.label} <span className="text-white/30 ml-0.5">{tool.shortcut}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Tool settings flyout via Portal ── */}
      {showSettings && hasSettings && createPortal(
        <div
          ref={settingsPortalRef}
          className="fixed bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl p-3"
          style={{ top: settingsPos.top, left: settingsPos.left, zIndex: 9999, minWidth: 180 }}
        >
          <div className="text-[10px] text-white/40 uppercase tracking-wider font-medium mb-2">
            {state.currentTool.charAt(0).toUpperCase() + state.currentTool.slice(1)} Settings
          </div>

          {/* Stroke thickness */}
          {['line', 'angle', 'freehand'].includes(state.currentTool) && (
            <div className="mb-3">
              <span className="text-[10px] text-white/50 block mb-1.5">Thickness</span>
              <div className="flex space-x-2">
                {thicknessPresets.map((t) => (
                  <button
                    key={t}
                    onClick={() => handleStrokeWidthChange(state.currentTool, t)}
                    className={`w-9 h-8 rounded-lg flex items-center justify-center transition-all ${
                      getCurrentStrokeWidth() === t ? 'bg-[#cc8bed]/20 ring-1 ring-[#cc8bed]/40' : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div
                      className={`rounded-full ${getCurrentStrokeWidth() === t ? 'bg-[#cc8bed]' : 'bg-white/50'}`}
                      style={{ width: t * 3 + 2, height: t * 3 + 2 }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Eraser size */}
          {state.currentTool === 'eraser' && (
            <div className="mb-3">
              <span className="text-[10px] text-white/50 block mb-1.5">Size · {getCurrentStrokeWidth()}px</span>
              <input
                type="range" min="5" max="50"
                value={getCurrentStrokeWidth() || 10}
                onChange={(e) => handleStrokeWidthChange(state.currentTool, Number(e.target.value))}
                className="w-full h-1.5 accent-[#cc8bed] rounded-full"
              />
            </div>
          )}

          {/* Font size */}
          {state.currentTool === 'text' && (
            <div className="mb-3">
              <span className="text-[10px] text-white/50 block mb-1.5">Font Size · {state.toolSettings.text.fontSize || 14}px</span>
              <input
                type="range" min="8" max="48"
                value={state.toolSettings.text.fontSize || 14}
                onChange={(e) => dispatch({ type: 'UPDATE_TOOL_SETTINGS', tool: 'text', settings: { fontSize: Number(e.target.value) } })}
                className="w-full h-1.5 accent-[#cc8bed] rounded-full"
              />
            </div>
          )}

          {/* Color picker */}
          {state.currentTool !== 'eraser' && (
            <div>
              <span className="text-[10px] text-white/50 block mb-1.5">Color</span>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <div
                    className="w-8 h-8 rounded-lg border-2 border-white/15 cursor-pointer"
                    style={{ backgroundColor: getCurrentColor() }}
                  />
                  <input
                    type="color"
                    value={getCurrentColor()}
                    onChange={(e) => handleColorChange(state.currentTool, e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
                <span className="text-[11px] text-white/40 font-mono">{getCurrentColor()}</span>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}