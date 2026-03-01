import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useDrawingContext, A4_WIDTH_MM, A4_HEIGHT_MM, MM_TO_PX, PAGE_MARGIN, DrawingElement } from '../context/DrawingContext';
import { useProjects } from '../context/ProjectContext';
import { serializeDrawing, deserializeDrawing, downloadBlob, exportCanvasToPNG, exportCanvasToSVG } from '../utils/serialization';
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
  const isExportOpen = activeKey === 'export';
  const [pdfPanel, setPdfPanel] = useState(false);
  const [pdfMode, setPdfMode] = useState<'all' | 'current' | 'range'>('all');
  const [pdfFrom, setPdfFrom] = useState(1);
  const [pdfTo, setPdfTo] = useState(state.totalPages);

  // Sanitized project name for filenames
  const baseName = (currentProject?.name || 'drawing').replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'drawing';

  // Close export dropdown when clicking outside
  useEffect(() => {
    if (!isExportOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        onCloseAll();
        setPdfPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExportOpen, onCloseAll]);

  const handleSaveJson = () => {
    try {
      const json = serializeDrawing(state.elements);
      downloadBlob(json, `${baseName}.json`);
      showNotice('success', 'Project saved successfully');
      onCloseAll();
    } catch (e: any) {
      showNotice('error', e?.message || 'Save failed');
    }
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = deserializeDrawing(text);
      const validLayerIds = new Set(state.layers.map(l => l.id));
      const fallback = state.currentLayerId;
      const normalized = parsed.map(el => ({ ...el, layerId: validLayerIds.has(el.layerId) ? el.layerId : fallback }));
      dispatch({ type: 'REPLACE_ELEMENTS', elements: normalized });
      showNotice('success', 'Project loaded successfully');
      onCloseAll();
    } catch (err: any) {
      showNotice('error', err?.message || 'Invalid project file');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExportPng = () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return showNotice('error', 'Canvas not found');
    exportCanvasToPNG(canvas, `${baseName}.png`);
    showNotice('success', 'Exported as PNG');
    onCloseAll();
  };

  const handleExportSvg = () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return showNotice('error', 'Canvas not found');
    const svg = exportCanvasToSVG(canvas.width, canvas.height);
    downloadBlob(svg, `${baseName}.svg`, 'image/svg+xml');
    showNotice('success', 'Exported as SVG');
    onCloseAll();
  };

  // Helper: get bounds of a page in canvas-space
  const getPageBounds = useCallback((pageNumber: number) => {
    const CANVAS_PADDING = 50;
    return {
      x: CANVAS_PADDING,
      y: CANVAS_PADDING + (pageNumber - 1) * (state.pageHeight + PAGE_MARGIN),
      width: state.pageWidth,
      height: state.pageHeight,
    };
  }, [state.pageWidth, state.pageHeight]);

  // Helper: determine which page a point belongs to
  const getPageForPoint = useCallback((point: { x: number; y: number }): number | null => {
    for (let p = 1; p <= state.totalPages; p++) {
      const b = getPageBounds(p);
      if (point.x >= b.x && point.x <= b.x + b.width && point.y >= b.y && point.y <= b.y + b.height) return p;
    }
    return null;
  }, [state.totalPages, getPageBounds]);

  // ── Helpers for vector PDF export ──

  // Parse hex color to [r, g, b] (0–255)
  const parseColor = (hex: string): [number, number, number] => {
    const c = hex.replace('#', '');
    const full = c.length === 3 ? c.split('').map(ch => ch + ch).join('') : c;
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
  };

  // Convert a pixel value to mm
  const pxToMm = (px: number) => px / MM_TO_PX;

  // Approximate text width in mm for a given font size in pt
  const approxTextWidthMm = (text: string, fontSizePt: number) => {
    // Average character width ≈ 0.5 × font size for sans-serif
    return text.length * fontSizePt * 0.5 * 0.352778; // pt → mm
  };

  // Render an arc (partial circle) as a polyline into jsPDF since jsPDF
  // doesn't have a native arc-by-angles API that matches Canvas semantics.
  const drawPdfArc = (pdf: any, cx: number, cy: number, r: number, startAngle: number, endAngle: number, ccw: boolean) => {
    // Normalise sweep
    let sweep = endAngle - startAngle;
    if (ccw) {
      while (sweep > 0) sweep -= 2 * Math.PI;
      if (sweep === 0) sweep = -2 * Math.PI;
    } else {
      while (sweep < 0) sweep += 2 * Math.PI;
      if (sweep === 0) sweep = 2 * Math.PI;
    }
    const segments = Math.max(24, Math.ceil(Math.abs(sweep) / (Math.PI / 24)));
    const step = sweep / segments;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= segments; i++) {
      const a = startAngle + i * step;
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    for (let i = 0; i < pts.length - 1; i++) {
      pdf.line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, 'S');
    }
  };

  // Render a single drawing element as vector primitives into jsPDF.
  // All coordinates are converted from canvas-px to mm relative to the page.
  const renderElementToPdf = useCallback((
    pdf: any,
    el: DrawingElement,
    pageOriginX: number,
    pageOriginY: number,
  ) => {
    const layer = state.layers.find(l => l.id === el.layerId);
    if (!layer?.visible) return;
    if (el.points.length === 0) return;

    // Convert element point from canvas-px to page-relative mm
    const mx = (px: number) => pxToMm(px - pageOriginX);
    const my = (py: number) => pxToMm(py - pageOriginY);
    const mLen = (px: number) => pxToMm(px); // length (no offset)

    const [r, g, b] = parseColor(el.style.strokeColor);
    pdf.setDrawColor(r, g, b);
    pdf.setLineWidth(mLen(el.style.strokeWidth));
    pdf.setLineCap('round');
    pdf.setLineJoin('round');

    switch (el.type) {
      case 'line': {
        if (el.points.length < 2) break;
        const x1 = mx(el.points[0].x), y1 = my(el.points[0].y);
        const x2 = mx(el.points[1].x), y2 = my(el.points[1].y);
        pdf.line(x1, y1, x2, y2, 'S');

        // Endpoint dots
        const dotR = mLen(3);
        pdf.setFillColor(r, g, b);
        pdf.circle(x1, y1, dotR, 'F');
        pdf.circle(x2, y2, dotR, 'F');

        // Measurement label
        if (el.measurements?.length) {
          const angle = Math.atan2(el.points[1].y - el.points[0].y, el.points[1].x - el.points[0].x);
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          const offsetDistance = mLen(el.labelOffset ?? (el.style.strokeWidth * 3 + 8));
          const oX = Math.cos(angle + Math.PI / 2) * offsetDist;
          const oY = Math.sin(angle + Math.PI / 2) * offsetDist;
          const lengthMm = el.measurements.length / MM_TO_PX;
          const text = state.units === 'cm' ? `${(lengthMm / 10).toFixed(1)} cm` : `${lengthMm.toFixed(1)} mm`;
          const fontSizePt = 8;
          pdf.setFontSize(fontSizePt);
          pdf.setFont('helvetica', 'bold');
          const tw = approxTextWidthMm(text, fontSizePt);
          const th = fontSizePt * 0.352778; // pt → mm
          const pad = 1.2; // mm
          const lx = midX + oX;
          const ly = midY + oY;
          // Background rect
          pdf.setFillColor(255, 255, 255);
          // Save transform – jsPDF doesn't support rotation on rects natively,
          // so we draw an un-rotated bg centered on the label position.
          pdf.rect(lx - tw / 2 - pad, ly - th / 2 - pad, tw + pad * 2, th + pad * 2, 'F');
          pdf.setTextColor(0, 0, 0);
          pdf.text(text, lx, ly + th * 0.35, { align: 'center' });
        }
        break;
      }
      case 'angle': {
        if (el.points.length < 3) break;
        const [baseline, center, endpoint] = el.points;
        const cx = mx(center.x), cy = my(center.y);
        const bx = mx(baseline.x), by = my(baseline.y);
        const ex = mx(endpoint.x), ey = my(endpoint.y);

        // Two sides
        pdf.line(bx, by, cx, cy, 'S');
        pdf.line(cx, cy, ex, ey, 'S');

        // Arc
        const bAngle = Math.atan2(baseline.y - center.y, baseline.x - center.x);
        const eAngle = Math.atan2(endpoint.y - center.y, endpoint.x - center.x);
        const sA = Math.sqrt((baseline.x - center.x) ** 2 + (baseline.y - center.y) ** 2);
        const sB = Math.sqrt((endpoint.x - center.x) ** 2 + (endpoint.y - center.y) ** 2);
        const arcRPx = Math.max(8, Math.min(40, Math.min(sA, sB) * 0.35));
        const arcR = mLen(arcRPx);
        let angleDiff = eAngle - bAngle;
        while (angleDiff < 0) angleDiff += 2 * Math.PI;
        while (angleDiff >= 2 * Math.PI) angleDiff -= 2 * Math.PI;
        const side = el.selectedAngleSide;

        if (!side || side === 'primary') drawPdfArc(pdf, cx, cy, arcR, bAngle, eAngle, false);
        if (!side || side === 'secondary') drawPdfArc(pdf, cx, cy, arcR, bAngle, eAngle, true);

        // Angle labels
        if (el.measurements?.angle) {
          const primaryDeg = angleDiff * 180 / Math.PI;
          const secondaryDeg = 360 - primaryDeg;
          const midA = bAngle + angleDiff / 2;
          const tR = el.labelOffset != null ? mLen(el.labelOffset) : mLen(arcRPx + 18);
          const fontSizePt = 8;
          pdf.setFontSize(fontSizePt);
          pdf.setFont('helvetica', 'bold');
          const th = fontSizePt * 0.352778;
          const pad = 1.5;

          const drawAngleLabel = (label: string, lx: number, ly: number) => {
            const tw = approxTextWidthMm(label, fontSizePt);
            pdf.setFillColor(255, 255, 255);
            pdf.rect(lx - tw / 2 - pad, ly - th / 2 - pad, tw + pad * 2, th + pad * 2, 'F');
            pdf.setDrawColor(r, g, b); // restore stroke after fill
            pdf.setTextColor(0, 0, 0);
            pdf.text(label, lx, ly + th * 0.35, { align: 'center' });
          };

          if (!side || side === 'primary') drawAngleLabel(`${primaryDeg.toFixed(1)}°`, cx + Math.cos(midA) * tR, cy + Math.sin(midA) * tR);
          if (!side || side === 'secondary') drawAngleLabel(`${secondaryDeg.toFixed(1)}°`, cx + Math.cos(midA + Math.PI) * tR, cy + Math.sin(midA + Math.PI) * tR);
        }
        break;
      }
      case 'freehand': {
        if (el.points.length < 2) break;
        // Flatten quadratic curves into small line segments
        const pts: { x: number; y: number }[] = [{ x: mx(el.points[0].x), y: my(el.points[0].y) }];
        for (let i = 1; i < el.points.length; i++) {
          const prev = el.points[i - 1], cur = el.points[i];
          // Quadratic bezier from prev through prev control to midpoint
          const cpx = prev.x, cpy = prev.y;
          const endx = (prev.x + cur.x) / 2, endy = (prev.y + cur.y) / 2;
          const startx = pts[pts.length - 1].x * MM_TO_PX + pageOriginX; // back to px for interpolation
          const starty = pts[pts.length - 1].y * MM_TO_PX + pageOriginY;
          const steps = 6;
          for (let s = 1; s <= steps; s++) {
            const t = s / steps;
            const ix = (1 - t) * (1 - t) * startx + 2 * (1 - t) * t * cpx + t * t * endx;
            const iy = (1 - t) * (1 - t) * starty + 2 * (1 - t) * t * cpy + t * t * endy;
            pts.push({ x: mx(ix), y: my(iy) });
          }
        }
        for (let i = 0; i < pts.length - 1; i++) {
          pdf.line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, 'S');
        }
        break;
      }
      case 'text': {
        if (el.points.length === 0 || !el.text) break;
        const tx = mx(el.points[0].x);
        const ty = my(el.points[0].y);
        const fontSizePx = el.fontSize || 14;
        const fontSizePt = fontSizePx * 0.75; // px → pt (at 96 DPI)
        pdf.setFontSize(fontSizePt);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(r, g, b);
        pdf.text(el.text, tx, ty + fontSizePt * 0.352778, { align: 'left' }); // offset by ~1 em to match top-baseline
        break;
      }
      case 'image':
        // Images are handled separately
        break;
    }
  }, [state.layers, state.units]);

  const handleExportPdf = async () => {
    try {
      const { jsPDF } = await import('jspdf');

      // Determine which pages to export
      let pagesToExport: number[] = [];
      if (pdfMode === 'current') {
        pagesToExport = [state.currentPage];
      } else if (pdfMode === 'range') {
        const from = Math.max(1, Math.min(pdfFrom, state.totalPages));
        const to = Math.max(from, Math.min(pdfTo, state.totalPages));
        for (let p = from; p <= to; p++) pagesToExport.push(p);
      } else {
        for (let p = 1; p <= state.totalPages; p++) pagesToExport.push(p);
      }

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      for (let idx = 0; idx < pagesToExport.length; idx++) {
        const page = pagesToExport[idx];
        if (idx > 0) pdf.addPage();

        const bounds = getPageBounds(page);

        // ── Vector grid lines ──
        if (state.gridVisible) {
          // Minor grid (every 1 mm)
          pdf.setDrawColor(232, 232, 232); // #e8e8e8
          pdf.setLineWidth(0.13); // ~0.5px → mm
          for (let x = 0; x <= A4_WIDTH_MM; x += 1) {
            pdf.line(x, 0, x, A4_HEIGHT_MM, 'S');
          }
          for (let y = 0; y <= A4_HEIGHT_MM; y += 1) {
            pdf.line(0, y, A4_WIDTH_MM, y, 'S');
          }
          // Major grid (every 10 mm)
          pdf.setDrawColor(208, 208, 208); // #d0d0d0
          pdf.setLineWidth(0.26); // ~1px → mm
          for (let x = 0; x <= A4_WIDTH_MM; x += 10) {
            pdf.line(x, 0, x, A4_HEIGHT_MM, 'S');
          }
          for (let y = 0; y <= A4_HEIGHT_MM; y += 10) {
            pdf.line(0, y, A4_WIDTH_MM, y, 'S');
          }
        }

        // ── Draw elements belonging to this page ──
        const pageElements = state.elements.filter(el => {
          if (el.points.length === 0) return false;
          return getPageForPoint(el.points[0]) === page;
        });

        // Render image elements first (raster — these need addImage)
        for (const el of pageElements) {
          if (el.type === 'image' && el.imageSrc && el.imageWidth && el.imageHeight) {
            try {
              const imgX = pxToMm(el.points[0].x - bounds.x);
              const imgY = pxToMm(el.points[0].y - bounds.y);
              const imgW = pxToMm(el.imageWidth);
              const imgH = pxToMm(el.imageHeight);
              pdf.addImage(el.imageSrc, 'PNG', imgX, imgY, imgW, imgH);
            } catch { /* skip broken images */ }
          }
        }

        // Render vector elements
        pageElements.forEach(el => {
          if (el.type !== 'image') {
            renderElementToPdf(pdf, el, bounds.x, bounds.y);
          }
        });
      }

      pdf.save(`${baseName}.pdf`);
      showNotice('success', `Exported ${pagesToExport.length} page${pagesToExport.length > 1 ? 's' : ''} as PDF`);
      setPdfPanel(false);
      onCloseAll();
    } catch (e: any) {
      showNotice('error', e?.message || 'PDF export failed');
    }
  };

  return (
    <div className="flex items-center space-x-3">
      <button
        onClick={handleSaveJson}
        className="flex items-center space-x-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/90 hover:text-white rounded-xl transition-all duration-200 border border-white/5 hover:border-white/10 active:scale-95 group"
        title="Save Project (JSON)"
      >
        <Save size={18} className="text-[#cc8bed] group-hover:scale-110 transition-transform" />
        <span className="text-sm font-medium">Save Project</span>
      </button>

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

