import React, { useMemo } from 'react';
import { useDrawingContext, DrawingElement } from '../context/DrawingContext';
import { Grid, ZoomIn, ZoomOut, Settings, Ruler, Eye, Magnet, Palette, Minus, Trash2, Copy, MoveVertical } from 'lucide-react';

export function PropertiesPanel() {
  const { state, dispatch } = useDrawingContext();

  const handleUnitsChange = (units: 'mm' | 'cm') => {
    dispatch({ type: 'SET_UNITS', units });
  };

  const handleZoomChange = (zoom: number) => {
    dispatch({ type: 'SET_ZOOM', zoom });
  };

  // --- Multi-selection helpers ---
  const selectedElements = useMemo(() =>
    state.elements.filter(el => state.selectedElementIds.includes(el.id)),
    [state.elements, state.selectedElementIds],
  );
  const selCount = selectedElements.length;

  // Compute shared/mixed properties across selection
  const selectionInfo = useMemo(() => {
    if (selCount === 0) return null;
    const colors = new Set(selectedElements.map(el => el.style.strokeColor));
    const widths = new Set(selectedElements.map(el => el.style.strokeWidth));
    const types = new Set(selectedElements.map(el => el.type));
    return {
      color: colors.size === 1 ? [...colors][0] : null,   // null = mixed
      width: widths.size === 1 ? [...widths][0] : null,
      types,
      hasNonImage: [...types].some(t => t !== 'image'),
    };
  }, [selectedElements, selCount]);

  const handleBulkColorChange = (color: string) => {
    dispatch({ type: 'UPDATE_ELEMENTS_BULK', ids: state.selectedElementIds, changes: { style: { strokeColor: color } as any } });
    dispatch({ type: 'SAVE_STATE' });
  };

  const handleBulkWidthChange = (width: number) => {
    dispatch({ type: 'UPDATE_ELEMENTS_BULK', ids: state.selectedElementIds, changes: { style: { strokeWidth: width } as any } });
    dispatch({ type: 'SAVE_STATE' });
  };

  const handleDeleteSelection = () => {
    dispatch({ type: 'DELETE_ELEMENTS', ids: state.selectedElementIds });
  };

  const handleDuplicateSelection = () => {
    const newElements: DrawingElement[] = selectedElements.map(el => ({
      ...el,
      id: `${el.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      points: el.points.map(p => ({ x: p.x + 20, y: p.y + 20 })),
    }));
    newElements.forEach(el => dispatch({ type: 'ADD_ELEMENT', element: el }));
    dispatch({ type: 'SELECT_ELEMENTS', ids: newElements.map(el => el.id) });
  };

  // Quick-pick colour palette
  const COLORS = ['#ffffff', '#ff4444', '#44aaff', '#44ff88', '#ffaa00', '#cc8bed', '#ff66cc', '#888888', '#000000'];

  return (
    <div className="h-full flex flex-col text-white">
      <div className="p-5 border-b border-white/10 flex items-center space-x-3">
        <div className="p-2 bg-[#cc8bed]/20 rounded-lg text-[#cc8bed]">
          <Settings size={20} />
        </div>
        <h3 className="font-semibold text-lg tracking-wide">Properties</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar">

        {/* ===== SELECTION PROPERTIES (multi-select) ===== */}
        {selCount > 1 && selectionInfo && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider flex items-center">
              <Palette size={14} className="mr-2" />
              Selection ({selCount} items)
            </h4>

            <div className="bg-white/5 rounded-xl p-4 space-y-4 border border-white/5">
              {/* Element type summary */}
              <div className="text-xs text-white/50">
                {[...selectionInfo.types].map(t => {
                  const count = selectedElements.filter(e => e.type === t).length;
                  return `${count} ${t}${count > 1 ? 's' : ''}`;
                }).join(', ')}
              </div>

              {/* Stroke color */}
              {selectionInfo.hasNonImage && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/80">Stroke Color</label>
                    <div className="flex flex-wrap gap-2">
                      {COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => handleBulkColorChange(c)}
                          className={`w-7 h-7 rounded-lg border-2 transition-all duration-150 hover:scale-110 ${
                            selectionInfo.color === c ? 'border-[#cc8bed] ring-2 ring-[#cc8bed]/40' : 'border-white/10'
                          }`}
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                    </div>
                    {/* Custom colour input */}
                    <div className="flex items-center space-x-2 pt-1">
                      <input
                        type="color"
                        value={selectionInfo.color || '#ffffff'}
                        onChange={e => handleBulkColorChange(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                      />
                      <span className="text-xs text-white/40 font-mono">{selectionInfo.color ?? 'mixed'}</span>
                    </div>
                  </div>

                  <div className="w-full h-px bg-white/5"></div>

                  {/* Stroke width */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium text-white/80 flex items-center">
                        <Minus size={14} className="mr-2" />Stroke Width
                      </label>
                      <span className="text-xs font-mono text-[#cc8bed] bg-[#cc8bed]/10 px-2 py-0.5 rounded">
                        {selectionInfo.width != null ? `${selectionInfo.width}px` : 'mixed'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      step="0.5"
                      value={selectionInfo.width ?? 2}
                      onChange={e => handleBulkWidthChange(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </>
              )}

              <div className="w-full h-px bg-white/5"></div>

              {/* Quick actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleDuplicateSelection}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-lg text-sm transition-all active:scale-95 border border-white/5"
                >
                  <Copy size={14} /> Duplicate
                </button>
                <button
                  onClick={handleDeleteSelection}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg text-sm transition-all active:scale-95 border border-red-500/10"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== LABEL DISTANCE (single line / angle) ===== */}
        {selCount === 1 && (selectedElements[0].type === 'line' || selectedElements[0].type === 'angle') && (() => {
          const el = selectedElements[0];
          const isLine = el.type === 'line';
          const defaultOffset = isLine
            ? el.style.strokeWidth * 3 + 8
            : (() => {
                if (el.points.length < 3) return 30;
                const [b, c, e] = el.points;
                const sA = Math.sqrt((b.x - c.x) ** 2 + (b.y - c.y) ** 2);
                const sB = Math.sqrt((e.x - c.x) ** 2 + (e.y - c.y) ** 2);
                return Math.max(8, Math.min(40, Math.min(sA, sB) * 0.35)) + 18;
              })();
          const currentOffset = el.labelOffset ?? defaultOffset;
          const min = isLine ? -60 : 10;
          const max = isLine ? 60 : 120;

          return (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider flex items-center">
                <MoveVertical size={14} className="mr-2" />
                Label Position
              </h4>
              <div className="bg-white/5 rounded-xl p-4 space-y-4 border border-white/5">
                <div className="text-xs text-white/50">
                  {isLine ? '1 Line' : '1 Angle'} — drag to reposition measurement label
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-white/80">
                      {isLine ? 'Perpendicular Offset' : 'Radius from Vertex'}
                    </label>
                    <span className="text-xs font-mono text-[#cc8bed] bg-[#cc8bed]/10 px-2 py-0.5 rounded">
                      {Math.round(currentOffset)}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step="1"
                    value={currentOffset}
                    onChange={e => {
                      dispatch({ type: 'UPDATE_ELEMENT', id: el.id, element: { labelOffset: Number(e.target.value) } });
                    }}
                    onMouseUp={() => dispatch({ type: 'SAVE_STATE' })}
                    onTouchEnd={() => dispatch({ type: 'SAVE_STATE' })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-white/30">
                    <span>{isLine ? 'Left' : 'Close'}</span>
                    <span>{isLine ? 'Right' : 'Far'}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    dispatch({ type: 'UPDATE_ELEMENT', id: el.id, element: { labelOffset: undefined } });
                    dispatch({ type: 'SAVE_STATE' });
                  }}
                  className="w-full px-3 py-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-lg transition-all duration-200 text-xs font-medium border border-white/5 hover:border-white/10"
                >
                  Reset to Default
                </button>
              </div>
            </div>
          );
        })()}

        {/* Grid Settings */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider flex items-center">
            <Grid size={14} className="mr-2" />
            Grid & Snapping
          </h4>
          
          <div className="bg-white/5 rounded-xl p-4 space-y-4 border border-white/5">
            <div className="flex items-center justify-between group">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg transition-colors ${state.gridVisible ? 'bg-[#cc8bed]/20 text-[#cc8bed]' : 'bg-white/5 text-white/40'}`}>
                  <Eye size={18} />
                </div>
                <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">Show Grid</span>
              </div>
              <button
                onClick={() => dispatch({ type: 'TOGGLE_GRID' })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#cc8bed]/50 ${
                  state.gridVisible ? 'bg-[#cc8bed]' : 'bg-white/10'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                    state.gridVisible ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="w-full h-px bg-white/5"></div>

            <div className="flex items-center justify-between group">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg transition-colors ${state.snapToGrid ? 'bg-[#cc8bed]/20 text-[#cc8bed]' : 'bg-white/5 text-white/40'}`}>
                  <Magnet size={18} />
                </div>
                <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">Snap to Grid</span>
              </div>
              <button
                onClick={() => dispatch({ type: 'TOGGLE_SNAP' })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#cc8bed]/50 ${
                  state.snapToGrid ? 'bg-[#cc8bed]' : 'bg-white/10'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                    state.snapToGrid ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            
            <div className="pt-2">
               <div className="text-xs text-white/40 bg-white/5 rounded-lg px-3 py-2 text-center border border-white/5">
                Grid Size: 1mm (Fixed)
              </div>
            </div>
          </div>
        </div>

        {/* Units */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider flex items-center">
            <Ruler size={14} className="mr-2" />
            Units
          </h4>
          <div className="bg-white/5 rounded-xl p-1 border border-white/5 flex">
            {(['mm', 'cm'] as const).map((unit) => (
              <button
                key={unit}
                onClick={() => handleUnitsChange(unit)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  state.units === unit
                    ? 'bg-[#cc8bed] text-white shadow-lg'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                {unit}
              </button>
            ))}
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider flex items-center">
            <ZoomIn size={14} className="mr-2" />
            View
          </h4>
          
          <div className="bg-white/5 rounded-xl p-4 space-y-5 border border-white/5">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-white/80">Zoom Level</label>
                <span className="text-xs font-mono text-[#cc8bed] bg-[#cc8bed]/10 px-2 py-1 rounded">
                  {(state.zoom * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="300"
                value={Math.min(300, Math.max(10, state.zoom * 100))}
                onChange={(e) => handleZoomChange(Number(e.target.value) / 100)}
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleZoomChange(state.zoom / 1.2)}
                className="flex items-center justify-center px-3 py-2.5 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-lg transition-all duration-200 border border-white/5 hover:border-white/10 active:scale-95"
              >
                <ZoomOut size={16} className="mr-2" />
                <span className="text-sm">Out</span>
              </button>
              <button
                onClick={() => handleZoomChange(state.zoom * 1.2)}
                className="flex items-center justify-center px-3 py-2.5 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-lg transition-all duration-200 border border-white/5 hover:border-white/10 active:scale-95"
              >
                <ZoomIn size={16} className="mr-2" />
                <span className="text-sm">In</span>
              </button>
            </div>

            <button
              onClick={() => handleZoomChange(1)}
              className="w-full px-3 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-lg transition-all duration-200 text-sm font-medium border border-white/5 hover:border-white/10"
            >
              Reset to 100%
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}