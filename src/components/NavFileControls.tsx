import React, { useRef, useState, useEffect } from 'react';
import { useDrawingContext } from '../context/DrawingContext';
import { useProjects } from '../context/ProjectContext';
import { Save, Upload, Download, FileJson, Image as ImageIcon, FileCode, FileText, ChevronLeft } from 'lucide-react';

interface NavFileControlsProps {
  activeKey: 'layers' | 'properties' | 'export' | null;
  onToggle: (key: 'layers' | 'properties' | 'export') => void;
  onCloseAll: () => void;
  showNotice: (type: 'success' | 'error', text: string) => void;
}

export function NavFileControls({ activeKey, onToggle, onCloseAll, showNotice }: NavFileControlsProps) {
  const { state, dispatch } = useDrawingContext();
  const { currentProject } = useProjects();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const saveDropdownRef = useRef<HTMLDivElement>(null);
  const isExportOpen = activeKey === 'export';
  const [saveDropdownOpen, setSaveDropdownOpen] = useState(false);
  const [pdfPanel, setPdfPanel] = useState(false);
  const [pdfMode, setPdfMode] = useState<'all' | 'current' | 'range'>('all');
  const [pdfFrom, setPdfFrom] = useState(1);
  const [pdfTo, setPdfTo] = useState(state.totalPages);
  const getErrorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

  // Sanitized project name for filenames
  const baseName = (currentProject?.name || 'drawing').replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'drawing';

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(target)) {
        onCloseAll();
        setPdfPanel(false);
      }
      if (saveDropdownRef.current && !saveDropdownRef.current.contains(target)) {
        setSaveDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCloseAll]);

  const handleSaveJson = async () => {
    try {
      const { serializeDrawing, downloadBlob } = await import('../utils/serialization');
      const json = serializeDrawing(state.elements);
      downloadBlob(json, `${baseName}.json`);
      showNotice('success', 'Project saved successfully');
      onCloseAll();
    } catch (error: unknown) {
      showNotice('error', getErrorMessage(error, 'Save failed'));
    }
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { deserializeDrawing } = await import('../utils/serialization');
      const text = await file.text();
      const parsed = deserializeDrawing(text);
      const validLayerIds = new Set(state.layers.map(l => l.id));
      const fallback = state.currentLayerId;
      const normalized = parsed.map(el => ({ ...el, layerId: validLayerIds.has(el.layerId) ? el.layerId : fallback }));
      dispatch({ type: 'REPLACE_ELEMENTS', elements: normalized });
      showNotice('success', 'Project loaded successfully');
      onCloseAll();
    } catch (error: unknown) {
      showNotice('error', getErrorMessage(error, 'Invalid project file'));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExportPng = () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return showNotice('error', 'Canvas not found');
    import('../utils/serialization').then(({ exportCanvasToPNG }) => {
      exportCanvasToPNG(canvas, `${baseName}.png`);
      showNotice('success', 'Exported as PNG');
      onCloseAll();
    }).catch((error: unknown) => showNotice('error', getErrorMessage(error, 'PNG export failed')));
  };

  const handleExportSvg = () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return showNotice('error', 'Canvas not found');
    import('../utils/serialization').then(({ exportCanvasToSVG, downloadBlob }) => {
      const svg = exportCanvasToSVG(canvas.width, canvas.height);
      downloadBlob(svg, `${baseName}.svg`, 'image/svg+xml');
      showNotice('success', 'Exported as SVG');
      onCloseAll();
    }).catch((error: unknown) => showNotice('error', getErrorMessage(error, 'SVG export failed')));
  };

  const handleExportPdf = async () => {
    try {
      const { exportDrawingToPdf } = await import('../utils/pdfExport');
      const count = await exportDrawingToPdf({
        elements: state.elements,
        layers: state.layers,
        units: state.units,
        gridVisible: state.gridVisible,
        currentPage: state.currentPage,
        totalPages: state.totalPages,
        pageWidth: state.pageWidth,
        pageHeight: state.pageHeight,
        pdfMode,
        pdfFrom,
        pdfTo,
        baseName,
      });
      showNotice('success', `Exported ${count} page${count > 1 ? 's' : ''} as PDF`);
      setPdfPanel(false);
      onCloseAll();
    } catch (error: unknown) {
      showNotice('error', getErrorMessage(error, 'PDF export failed'));
    }
  };

  return (
    <div className="flex items-center space-x-3">
      {/* Save dropdown */}
      <div className="relative" ref={saveDropdownRef}>
        <button
          onClick={() => setSaveDropdownOpen(!saveDropdownOpen)}
          className="flex items-center space-x-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/90 hover:text-white rounded-xl transition-all duration-200 border border-white/5 hover:border-white/10 active:scale-95 group"
          title="Save your work"
        >
          <Save size={18} className="text-[#cc8bed] group-hover:scale-110 transition-transform" />
          <span className="text-sm font-medium">Save</span>
        </button>

        {saveDropdownOpen && (
          <div className="absolute left-0 top-full mt-3 w-64 glass-panel rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-left border border-white/10">
            <div className="p-1.5 space-y-1">
              {/* Save to Local */}
              <button
                onClick={() => {
                  handleSaveJson();
                  setSaveDropdownOpen(false);
                }}
                className="w-full flex items-center space-x-3 px-3 py-2.5 text-sm text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-150 text-left"
              >
                <Download size={16} className="text-[#cc8bed] shrink-0" />
                <div className="flex-1">
                  <div className="font-medium">Save to Local</div>
                  <div className="text-[11px] text-white/50 mt-0.5">Download as .json file</div>
                </div>
              </button>

              <div className="h-px bg-white/10 my-1"></div>

              {/* Save to Account (Disabled) */}
              <button
                disabled
                className="w-full flex items-center space-x-3 px-3 py-2.5 text-sm text-white/30 cursor-not-allowed rounded-lg transition-all duration-150 text-left"
                title="Coming soon - cloud storage"
              >
                <svg size={16} className="text-white/20 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="17" r="1"/><path d="M12 2v6m4.22 3.22a5 5 0 0 0-7.1.1m3.93 4.94a10 10 0 0 1-8.48-8.48"/>
                </svg>
                <div className="flex-1">
                  <div className="font-medium">Save to Account</div>
                  <div className="text-[11px] text-white/40 mt-0.5">Coming soon</div>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleFileChange}
      />

      <button
        onClick={handleUploadClick}
        className="flex items-center justify-center w-10 h-10 bg-white/5 hover:bg-white/10 text-white/90 hover:text-white rounded-xl transition-all duration-200 border border-white/5 hover:border-white/10 active:scale-95 group"
        title="Open Project"
      >
        <Upload size={18} className="group-hover:scale-110 transition-transform" />
      </button>

      <div className="relative" ref={exportDropdownRef}>
        <button
          onClick={() => onToggle('export')}
          className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 border active:scale-95 group ${
            isExportOpen 
              ? 'bg-[#cc8bed] text-white border-[#cc8bed] shadow-[0_0_15px_-5px_rgba(204,139,237,0.5)]' 
              : 'bg-white/5 hover:bg-white/10 text-white/90 hover:text-white border-white/5 hover:border-white/10'
          }`}
          title="Export As..."
        >
          <Download size={18} className="group-hover:scale-110 transition-transform" />
        </button>
        
        {isExportOpen && (
          <div className="absolute right-0 top-full mt-3 w-56 glass-panel rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right border border-white/10">
            <div className="p-1.5 space-y-1">
              {pdfPanel ? (
                /* ───────── PDF Page Range Sub-Panel ───────── */
                <>
                  <button
                    onClick={() => setPdfPanel(false)}
                    className="flex items-center space-x-1.5 px-2 py-1.5 text-xs text-white/50 hover:text-white/80 transition-colors"
                  >
                    <ChevronLeft size={14} />
                    <span>Back</span>
                  </button>
                  <div className="px-3 py-1.5 text-xs font-semibold text-white/40 uppercase tracking-wider">
                    Page Range
                  </div>
                  {/* All Pages */}
                  <button
                    onClick={() => setPdfMode('all')}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${pdfMode === 'all' ? 'bg-[#cc8bed]/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${pdfMode === 'all' ? 'border-[#cc8bed]' : 'border-white/30'}`}>
                      {pdfMode === 'all' && <span className="w-1.5 h-1.5 rounded-full bg-[#cc8bed]" />}
                    </span>
                    <span>All Pages <span className="text-white/40">({state.totalPages})</span></span>
                  </button>
                  {/* Current Page */}
                  <button
                    onClick={() => setPdfMode('current')}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${pdfMode === 'current' ? 'bg-[#cc8bed]/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${pdfMode === 'current' ? 'border-[#cc8bed]' : 'border-white/30'}`}>
                      {pdfMode === 'current' && <span className="w-1.5 h-1.5 rounded-full bg-[#cc8bed]" />}
                    </span>
                    <span>Current Page <span className="text-white/40">({state.currentPage})</span></span>
                  </button>
                  {/* Custom Range */}
                  <button
                    onClick={() => { setPdfMode('range'); setPdfFrom(1); setPdfTo(state.totalPages); }}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${pdfMode === 'range' ? 'bg-[#cc8bed]/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${pdfMode === 'range' ? 'border-[#cc8bed]' : 'border-white/30'}`}>
                      {pdfMode === 'range' && <span className="w-1.5 h-1.5 rounded-full bg-[#cc8bed]" />}
                    </span>
                    <span>Page Range</span>
                  </button>
                  {pdfMode === 'range' && (
                    <div className="flex items-center space-x-2 px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        max={state.totalPages}
                        value={pdfFrom}
                        onChange={(e) => setPdfFrom(Math.max(1, Math.min(state.totalPages, parseInt(e.target.value) || 1)))}
                        className="w-14 px-2 py-1 bg-white/5 border border-white/10 rounded-md text-sm text-white text-center focus:outline-none focus:border-[#cc8bed]/50"
                      />
                      <span className="text-white/40 text-sm">to</span>
                      <input
                        type="number"
                        min={1}
                        max={state.totalPages}
                        value={pdfTo}
                        onChange={(e) => setPdfTo(Math.max(1, Math.min(state.totalPages, parseInt(e.target.value) || 1)))}
                        className="w-14 px-2 py-1 bg-white/5 border border-white/10 rounded-md text-sm text-white text-center focus:outline-none focus:border-[#cc8bed]/50"
                      />
                    </div>
                  )}
                  <button
                    onClick={handleExportPdf}
                    className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 mt-1 bg-[#cc8bed] hover:bg-[#b97ad4] text-white rounded-lg text-sm font-medium transition-colors active:scale-95"
                  >
                    <FileText size={15} />
                    <span>Export PDF</span>
                  </button>
                </>
              ) : (
                /* ───────── Main Export Menu ───────── */
                <>
              <div className="px-3 py-2 text-xs font-semibold text-white/40 uppercase tracking-wider">
                Export Format
              </div>
              <button 
                onClick={handleExportPng} 
                className="w-full flex items-center space-x-3 px-3 py-2.5 hover:bg-white/10 rounded-lg text-sm text-white/90 hover:text-white transition-colors group"
              >
                <div className="p-1.5 bg-[#cc8bed]/10 rounded-md text-[#cc8bed] group-hover:bg-[#cc8bed]/20 transition-colors">
                  <ImageIcon size={16} />
                </div>
                <span>PNG Image</span>
              </button>
              <button 
                onClick={handleExportSvg} 
                className="w-full flex items-center space-x-3 px-3 py-2.5 hover:bg-white/10 rounded-lg text-sm text-white/90 hover:text-white transition-colors group"
              >
                <div className="p-1.5 bg-[#cc8bed]/10 rounded-md text-[#cc8bed] group-hover:bg-[#cc8bed]/20 transition-colors">
                  <FileCode size={16} />
                </div>
                <span>SVG Vector</span>
              </button>
              <button 
                onClick={() => { setPdfPanel(true); setPdfTo(state.totalPages); }}
                className="w-full flex items-center space-x-3 px-3 py-2.5 hover:bg-white/10 rounded-lg text-sm text-white/90 hover:text-white transition-colors group"
              >
                <div className="p-1.5 bg-[#cc8bed]/10 rounded-md text-[#cc8bed] group-hover:bg-[#cc8bed]/20 transition-colors">
                  <FileText size={16} />
                </div>
                <span>PDF Document</span>
              </button>
              <button 
                onClick={handleSaveJson} 
                className="w-full flex items-center space-x-3 px-3 py-2.5 hover:bg-white/10 rounded-lg text-sm text-white/90 hover:text-white transition-colors group"
              >
                <div className="p-1.5 bg-[#cc8bed]/10 rounded-md text-[#cc8bed] group-hover:bg-[#cc8bed]/20 transition-colors">
                  <FileJson size={16} />
                </div>
                <span>Project JSON</span>
              </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

