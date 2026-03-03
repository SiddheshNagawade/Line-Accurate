import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useDrawingContext, Point, DrawingElement, MM_TO_PX, PAGE_MARGIN } from '../context/DrawingContext';
import { snapToGrid } from '../utils/grid';
import { Quadtree, getElementBounds, intersectsRect, type SpatialRect } from '../utils/spatialIndex';
import { LineTool } from './tools/LineTool';
import { AngleTool } from './tools/AngleTool';
import { FreehandTool } from './tools/FreehandTool';
import { SelectTool } from './tools/SelectTool';
import { EraserTool } from './tools/EraserTool';
import { TextTool } from './tools/TextTool';

interface DrawingCanvasProps {
  onCursorMove: (position: Point) => void;
}

export function DrawingCanvas({ onCursorMove }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { state, dispatch } = useDrawingContext();
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState<DrawingElement | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState<Point | null>(null);
  const containerActiveRef = useRef<boolean>(false);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const lodImageCache = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const renderRef = useRef<() => void>(() => {});
  const lastCursorPos = useRef<Point | null>(null);
  // Two-layer canvas: backingCanvas holds the stable scene (pages+grids+elements).
  // Main canvas composites: blit backing + active overlay every frame.
  // backingValidRef = false forces a backing rebuild on the next RAF.
  const backingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const backingValidRef = useRef(false);

  // Dynamic instruction visibility state
  const [showInstructions, setShowInstructions] = useState(false);
  const instructionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show instructions and auto-hide after timeout
  const showInstructionsBriefly = useCallback(() => {
    setShowInstructions(true);
    if (instructionTimeoutRef.current) clearTimeout(instructionTimeoutRef.current);
    instructionTimeoutRef.current = setTimeout(() => {
      setShowInstructions(false);
    }, 4000); // Show for 4 seconds then fade
  }, []);

  // Axis-lock state for smooth two-finger panning
  const panAxisRef = useRef<'free' | 'x' | 'y' | null>(null); // null = gesture not started
  const panAccumRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panGestureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // RAF render coalescing — only one render per animation frame
  const rafIdRef = useRef<number>(0);
  const renderPendingRef = useRef(false);

  const CANVAS_PADDING = 50; // Padding around all pages
  
  // Calculate page position for a given page number
  const getPageBounds = useCallback((pageNumber: number) => {
    return {
      x: CANVAS_PADDING,
      y: CANVAS_PADDING + (pageNumber - 1) * (state.pageHeight + PAGE_MARGIN),
      width: state.pageWidth,
      height: state.pageHeight
    };
  }, [state.pageWidth, state.pageHeight]);

  const elementSpatialIndex = useMemo(() => {
    const indexed = state.elements
      .map((element) => {
        const bounds = getElementBounds(element);
        if (!bounds) return null;
        return { bounds, data: { id: element.id } };
      })
      .filter((item): item is { bounds: SpatialRect; data: { id: string } } => item !== null);

    return new Quadtree(indexed);
  }, [state.elements]);

  const getViewportWorldBounds = useCallback((canvas: HTMLCanvasElement): SpatialRect => {
    const minX = -state.panOffset.x;
    const minY = -state.panOffset.y;
    const maxX = canvas.width / state.zoom - state.panOffset.x;
    const maxY = canvas.height / state.zoom - state.panOffset.y;
    return { minX, minY, maxX, maxY };
  }, [state.panOffset.x, state.panOffset.y, state.zoom]);

  // Compute content dimensions (all pages area incl. padding)
  // Top padding = CANVAS_PADDING; bottom padding = just enough for the add-page button (~80px)
  const getContentSize = useCallback(() => {
    const BOTTOM_PAD = 80; // room for the add-page button below last page
    const totalHeight = CANVAS_PADDING + state.totalPages * state.pageHeight + (state.totalPages - 1) * PAGE_MARGIN + BOTTOM_PAD;
    const totalWidth = CANVAS_PADDING * 2 + state.pageWidth;
    return { totalWidth, totalHeight };
  }, [state.totalPages, state.pageHeight, state.pageWidth]);

  // Clamp pan so no empty space beyond content edges; center when content is smaller than viewport
  // Optional zoomOverride lets us compute correct bounds when zoom changes before state updates
  const clampPan = useCallback((pan: Point, zoomOverride?: number): Point => {
    const container = containerRef.current;
    if (!container) return pan;

    const zoom = zoomOverride ?? state.zoom;
    const { totalWidth, totalHeight } = getContentSize();
    const rect = container.getBoundingClientRect();

    const viewW = rect.width / zoom;
    const viewH = rect.height / zoom;

    let clampedX = pan.x;
    let clampedY = pan.y;

    if (totalWidth <= viewW) {
      clampedX = (viewW - totalWidth) / 2;
    } else {
      const minX = -(totalWidth - viewW);
      const maxX = 0;
      clampedX = Math.max(minX, Math.min(maxX, pan.x));
    }

    if (totalHeight <= viewH) {
      clampedY = (viewH - totalHeight) / 2;
    } else {
      const minY = -(totalHeight - viewH);
      const maxY = 0;
      clampedY = Math.max(minY, Math.min(maxY, pan.y));
    }

    return { x: clampedX, y: clampedY };
  }, [getContentSize, state.zoom]);

  // Determine if panning is allowed (only when content larger than viewport)
  const canPan = useCallback(() => {
    const container = containerRef.current;
    if (!container) return false;
    const { totalWidth, totalHeight } = getContentSize();
    const rect = container.getBoundingClientRect();
    const viewW = rect.width / state.zoom;
    const viewH = rect.height / state.zoom;
    return totalWidth > viewW || totalHeight > viewH;
  }, [getContentSize, state.zoom]);

  // Dynamically compute minimum zoom so page never becomes tiny and stays nicely viewable
  const computeAndApplyMinZoom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const { totalWidth } = getContentSize();
    const rect = container.getBoundingClientRect();
    const widthBasedMin = rect.width / totalWidth; // fully fit width
    const comfortableMin = 0.6; // don't allow zoom-out smaller than 60%
    const newMinZoom = Math.min(1, Math.max(comfortableMin, widthBasedMin));
    dispatch({ type: 'SET_MIN_ZOOM', minZoom: newMinZoom });
    if (state.zoom < newMinZoom) {
      dispatch({ type: 'SET_ZOOM', zoom: newMinZoom });
    }
  }, [dispatch, getContentSize, state.zoom]);

  // Check if a point is within any page bounds
  const getPageAtPoint = useCallback((point: Point): number | null => {
    for (let page = 1; page <= state.totalPages; page++) {
      const bounds = getPageBounds(page);
      if (point.x >= bounds.x && point.x <= bounds.x + bounds.width &&
          point.y >= bounds.y && point.y <= bounds.y + bounds.height) {
        return page;
      }
    }
    return null;
  }, [state.totalPages, getPageBounds]);

  // Clip point to page boundaries
  const clipToPageBounds = useCallback((point: Point): Point => {
    const pageNumber = getPageAtPoint(point);
    if (!pageNumber) return point;
    
    const bounds = getPageBounds(pageNumber);
    return {
      x: Math.max(bounds.x, Math.min(bounds.x + bounds.width, point.x)),
      y: Math.max(bounds.y, Math.min(bounds.y + bounds.height, point.y))
    };
  }, [getPageAtPoint, getPageBounds]);

  // Draw all pages with boundaries and backgrounds
  const drawPages = useCallback((ctx: CanvasRenderingContext2D, viewportBounds?: SpatialRect) => {
    ctx.save();
    
    for (let page = 1; page <= state.totalPages; page++) {
      const bounds = getPageBounds(page);

      if (viewportBounds) {
        const pageRect: SpatialRect = {
          minX: bounds.x - 8,
          minY: bounds.y - 20,
          maxX: bounds.x + bounds.width + 8,
          maxY: bounds.y + bounds.height + 8,
        };
        if (!intersectsRect(viewportBounds, pageRect)) continue;
      }
      
      // Draw page background (white)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
      
      // Draw page border (light grey)
      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
      
      // Draw drop shadow
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(bounds.x + 3, bounds.y + 3, bounds.width, bounds.height);
      ctx.restore();
      
      // Redraw page background over shadow
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
      
      // Redraw border
      ctx.strokeStyle = '#cccccc';
      ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
      
      // Draw page number
      ctx.fillStyle = '#666666';
      ctx.font = '12px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `Page ${page}`,
        bounds.x + bounds.width / 2,
        bounds.y - 10
      );
    }
    
    ctx.restore();
  }, [state.totalPages, getPageBounds]);

  // Draw grid directly as vector paths within each page — stays crisp at any zoom level
  const drawPageGrids = useCallback((ctx: CanvasRenderingContext2D, viewportBounds?: SpatialRect) => {
    if (!state.gridVisible) return;

    const mmToPx = 3.779527559; // 1mm in pixels at 96 DPI
    // LOD: skip 1mm minor lines when zoomed out (they'd be < ~2.5px apart, invisible noise)
    const drawMinor = state.zoom >= 0.7;

    for (let page = 1; page <= state.totalPages; page++) {
      const bounds = getPageBounds(page);
      if (viewportBounds) {
        const pageRect: SpatialRect = {
          minX: bounds.x,
          minY: bounds.y,
          maxX: bounds.x + bounds.width,
          maxY: bounds.y + bounds.height,
        };
        if (!intersectsRect(viewportBounds, pageRect)) continue;
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(bounds.x, bounds.y, bounds.width, bounds.height);
      ctx.clip();

      const x0 = bounds.x;
      const y0 = bounds.y;
      const w = bounds.width;
      const h = bounds.height;

      // Minor grid lines (1mm) — only when zoomed in enough to see them
      if (drawMinor) {
        ctx.beginPath();
        ctx.strokeStyle = '#e8e8e8';
        ctx.lineWidth = 0.5;
        for (let dx = 0; dx <= w; dx += mmToPx) {
          const x = x0 + dx;
          ctx.moveTo(x, y0);
          ctx.lineTo(x, y0 + h);
        }
        for (let dy = 0; dy <= h; dy += mmToPx) {
          const y = y0 + dy;
          ctx.moveTo(x0, y);
          ctx.lineTo(x0 + w, y);
        }
        ctx.stroke();
      }

      // Major grid lines (10mm) — always drawn
      ctx.beginPath();
      ctx.strokeStyle = '#d0d0d0';
      ctx.lineWidth = 1;
      for (let dx = 0; dx <= w; dx += mmToPx * 10) {
        const x = x0 + dx;
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y0 + h);
      }
      for (let dy = 0; dy <= h; dy += mmToPx * 10) {
        const y = y0 + dy;
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + w, y);
      }
      ctx.stroke();

      ctx.restore();
    }
  }, [state.gridVisible, state.totalPages, state.zoom, getPageBounds]);

  // Draw element with page clipping
  const drawElement = useCallback((ctx: CanvasRenderingContext2D, element: DrawingElement) => {
    const layer = state.layers.find(l => l.id === element.layerId);
    if (!layer?.visible) return;

    // Find which page this element belongs to
    if (element.points.length === 0) return;
    const pageNumber = getPageAtPoint(element.points[0]);
    if (!pageNumber) return;
    
    const bounds = getPageBounds(pageNumber);

    ctx.save();
    
    // Clip to page bounds
    ctx.beginPath();
    ctx.rect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.clip();
    
    ctx.strokeStyle = element.style.strokeColor;
    ctx.lineWidth = element.style.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (element.style.fillColor) {
      ctx.fillStyle = element.style.fillColor;
    }

    // Highlight selected elements
    if (element.selected || state.selectedElementIds.includes(element.id)) {
      ctx.shadowColor = '#3b82f6';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#3b82f6';
    }

    switch (element.type) {
      case 'line':
        if (element.points.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(element.points[0].x, element.points[0].y);
          ctx.lineTo(element.points[1].x, element.points[1].y);
          ctx.stroke();

          // Draw measurement parallel to line
          if (element.measurements?.length) {
            const angle = Math.atan2(element.points[1].y - element.points[0].y, element.points[1].x - element.points[0].x);
            const length = element.measurements.length;
            const midX = (element.points[0].x + element.points[1].x) / 2;
            const midY = (element.points[0].y + element.points[1].y) / 2;
            
            // Calculate offset distance — use custom labelOffset or default
            const offsetDistance = element.labelOffset ?? (element.style.strokeWidth * 3 + 8);
            const offsetX = Math.cos(angle + Math.PI / 2) * offsetDistance;
            const offsetY = Math.sin(angle + Math.PI / 2) * offsetDistance;
            
            ctx.save();
            ctx.translate(midX + offsetX, midY + offsetY);
            ctx.rotate(angle);
            
            // High contrast text
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Background for better readability
            const lengthMm = length / MM_TO_PX;
            const text = state.units === 'cm'
              ? `${(lengthMm / 10).toFixed(1)} cm`
              : `${lengthMm.toFixed(1)} mm`;
            const textMetrics = ctx.measureText(text);
            const padding = 4;
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.fillRect(-textMetrics.width/2 - padding, -6, textMetrics.width + padding*2, 12);
            
            ctx.fillStyle = '#000000';
            ctx.fillText(text, 0, 0);
            ctx.restore();
          }

          // Draw connection dots at endpoints
          if (state.zoom > 0.5) {
            const radius = Math.max(0.5, 3 / state.zoom);
            ctx.fillStyle = element.style.strokeColor;
            ctx.beginPath();
            ctx.arc(element.points[0].x, element.points[0].y, radius, 0, 2 * Math.PI);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(element.points[1].x, element.points[1].y, radius, 0, 2 * Math.PI);
            ctx.fill();
          }
        }
        break;
      
      case 'angle':
        if (element.points.length === 2) {
          // Baseline preview (during vertex phase of 3-click workflow)
          ctx.beginPath();
          ctx.moveTo(element.points[0].x, element.points[0].y);
          ctx.lineTo(element.points[1].x, element.points[1].y);
          ctx.stroke();
          
          // Draw dots at start point
          if (state.zoom > 0.5) {
            const radius = Math.max(0.5, 3 / state.zoom);
            ctx.fillStyle = element.style.strokeColor;
            ctx.beginPath();
            ctx.arc(element.points[0].x, element.points[0].y, radius, 0, 2 * Math.PI);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(element.points[1].x, element.points[1].y, radius, 0, 2 * Math.PI);
            ctx.fill();
          }
        } else if (element.points.length >= 3) {
          const baseline = element.points[0];
          const center = element.points[1];
          const endpoint = element.points[2];
          
          // Draw baseline
          ctx.beginPath();
          ctx.moveTo(baseline.x, baseline.y);
          ctx.lineTo(center.x, center.y);
          ctx.stroke();
          
          // Draw angle line
          ctx.beginPath();
          ctx.moveTo(center.x, center.y);
          ctx.lineTo(endpoint.x, endpoint.y);
          ctx.stroke();
          
          // Calculate angles
          const baselineAngle = Math.atan2(baseline.y - center.y, baseline.x - center.x);
          const endpointAngle = Math.atan2(endpoint.y - center.y, endpoint.x - center.x);

          // Dynamic arc radius: proportional to the shorter side, clamped to a sensible range
          const sideA = Math.sqrt((baseline.x - center.x) ** 2 + (baseline.y - center.y) ** 2);
          const sideB = Math.sqrt((endpoint.x - center.x) ** 2 + (endpoint.y - center.y) ** 2);
          const shorterSide = Math.min(sideA, sideB);
          const arcRadius = Math.max(8, Math.min(40, shorterSide * 0.35));
          
          // Calculate angleDiff (counterclockwise sweep from baseline to endpoint)
          let angleDiff = endpointAngle - baselineAngle;
          while (angleDiff < 0) angleDiff += 2 * Math.PI;
          while (angleDiff >= 2 * Math.PI) angleDiff -= 2 * Math.PI;
          
          // Draw arc on the correct side based on selectedAngleSide
          // Primary = the CCW sweep (angleDiff), arc drawn CCW (anticlockwise=false)
          // Secondary = the CW sweep (360-angleDiff), arc drawn CW (anticlockwise=true)
          if (!element.selectedAngleSide || element.selectedAngleSide === 'primary') {
            // Draw primary arc (CCW from baseline to endpoint)
            ctx.beginPath();
            ctx.arc(center.x, center.y, arcRadius, baselineAngle, endpointAngle, false);
            ctx.stroke();
          }
          if (!element.selectedAngleSide || element.selectedAngleSide === 'secondary') {
            // Draw secondary arc (CW from baseline to endpoint = the other side)
            ctx.beginPath();
            ctx.arc(center.x, center.y, arcRadius, baselineAngle, endpointAngle, true);
            ctx.stroke();
          }
          
          // Draw angle measurement labels
          if (element.measurements?.angle) {
            const primaryDeg = (angleDiff * 180 / Math.PI);
            const secondaryDeg = 360 - primaryDeg;

            const midAngle = baselineAngle + angleDiff / 2;
            const textRadius = element.labelOffset ?? (arcRadius + 18);
            const textX = center.x + Math.cos(midAngle) * textRadius;
            const textY = center.y + Math.sin(midAngle) * textRadius;
            
            // Opposite side for complementary label (uses same radius)
            const oppAngle = midAngle + Math.PI;
            const oppX = center.x + Math.cos(oppAngle) * textRadius;
            const oppY = center.y + Math.sin(oppAngle) * textRadius;

            const placeLabel = (label: string, x: number, y: number, opacity: number) => {
              ctx.save();
              ctx.globalAlpha = opacity;
              ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              const textMetrics = ctx.measureText(label);
              const padding = 5;
              const rectX = x - textMetrics.width / 2 - padding;
              const rectY = y - 7;
              const rectW = textMetrics.width + padding * 2;
              const rectH = 14;
              const radius = 4;
              // Rounded rectangle background
              ctx.beginPath();
              ctx.moveTo(rectX + radius, rectY);
              ctx.lineTo(rectX + rectW - radius, rectY);
              ctx.arcTo(rectX + rectW, rectY, rectX + rectW, rectY + radius, radius);
              ctx.lineTo(rectX + rectW, rectY + rectH - radius);
              ctx.arcTo(rectX + rectW, rectY + rectH, rectX + rectW - radius, rectY + rectH, radius);
              ctx.lineTo(rectX + radius, rectY + rectH);
              ctx.arcTo(rectX, rectY + rectH, rectX, rectY + rectH - radius, radius);
              ctx.lineTo(rectX, rectY + radius);
              ctx.arcTo(rectX, rectY, rectX + radius, rectY, radius);
              ctx.closePath();
              ctx.fillStyle = 'rgba(255,255,255,0.9)';
              ctx.fill();
              ctx.fillStyle = '#000000';
              ctx.fillText(label, x, y);
              ctx.restore();
            };

            // Determine opacity based on selected side
            const primaryOpacity = !element.selectedAngleSide ? 0.25 : element.selectedAngleSide === 'primary' ? 1.0 : 0;
            const secondaryOpacity = !element.selectedAngleSide ? 0.25 : element.selectedAngleSide === 'secondary' ? 1.0 : 0;

            if (primaryOpacity > 0) {
              placeLabel(`${primaryDeg.toFixed(1)}°`, textX, textY, primaryOpacity);
            }
            if (secondaryOpacity > 0) {
              placeLabel(`${secondaryDeg.toFixed(1)}°`, oppX, oppY, secondaryOpacity);
            }
          }
        }
        break;
      
      case 'freehand':
        if (element.points.length > 1) {
          const lodStep = state.zoom < 0.35 ? 4 : state.zoom < 0.6 ? 2 : 1;
          ctx.beginPath();
          ctx.moveTo(element.points[0].x, element.points[0].y);
          for (let i = lodStep; i < element.points.length; i += lodStep) {
            const prevPoint = element.points[i - 1];
            const currentPoint = element.points[i];
            const midX = (prevPoint.x + currentPoint.x) / 2;
            const midY = (prevPoint.y + currentPoint.y) / 2;
            ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, midX, midY);
          }
          const last = element.points[element.points.length - 1];
          if (last) ctx.lineTo(last.x, last.y);
          ctx.stroke();
        }
        break;
      
      case 'text':
        if (element.points.length > 0 && element.text) {
          ctx.fillStyle = element.style.strokeColor;
          ctx.font = `${element.fontSize || 14}px system-ui, -apple-system, sans-serif`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(element.text, element.points[0].x, element.points[0].y);
        }
        break;
      
      case 'image':
        if (element.points.length > 0 && element.imageSrc && element.imageWidth && element.imageHeight) {
          let img = imageCache.current.get(element.imageSrc);
          
          if (!img) {
            img = new Image();
            img.src = element.imageSrc;
            imageCache.current.set(element.imageSrc, img);
            
            // Re-render when image loads
            img.onload = () => {
              backingValidRef.current = false;
              renderRef.current();
            };
          }
          
          // Only draw if image is loaded
          if (img.complete && img.naturalHeight !== 0) {
            const lodBucket = state.zoom < 0.4 ? 'low' : state.zoom < 0.8 ? 'mid' : 'full';
            const lodKey = `${element.id}:${lodBucket}`;

            let source: CanvasImageSource = img;
            if (lodBucket !== 'full') {
              let lodCanvas = lodImageCache.current.get(lodKey);
              if (!lodCanvas) {
                const scale = lodBucket === 'low' ? 0.25 : 0.5;
                const w = Math.max(8, Math.round(img.naturalWidth * scale));
                const h = Math.max(8, Math.round(img.naturalHeight * scale));
                lodCanvas = document.createElement('canvas');
                lodCanvas.width = w;
                lodCanvas.height = h;
                const lctx = lodCanvas.getContext('2d');
                if (lctx) {
                  lctx.imageSmoothingEnabled = true;
                  lctx.imageSmoothingQuality = 'high';
                  lctx.drawImage(img, 0, 0, w, h);
                }
                lodImageCache.current.set(lodKey, lodCanvas);
              }
              source = lodCanvas;
            }

            ctx.drawImage(source, element.points[0].x, element.points[0].y, element.imageWidth, element.imageHeight);
            
            // Draw selection border if selected
            if (element.selected || state.selectedElementIds.includes(element.id)) {
              // Reset shadow for selection UI
              ctx.shadowColor = 'transparent';
              ctx.shadowBlur = 0;
              
              ctx.strokeStyle = '#3b82f6';
              ctx.lineWidth = 2 / state.zoom;
              ctx.setLineDash([5 / state.zoom, 5 / state.zoom]);
              ctx.strokeRect(element.points[0].x, element.points[0].y, element.imageWidth, element.imageHeight);
              ctx.setLineDash([]);
              
              // Draw corner resize handles
              const handleSize = 8 / state.zoom;
              const corners = [
                { x: element.points[0].x, y: element.points[0].y },
                { x: element.points[0].x + element.imageWidth, y: element.points[0].y },
                { x: element.points[0].x, y: element.points[0].y + element.imageHeight },
                { x: element.points[0].x + element.imageWidth, y: element.points[0].y + element.imageHeight },
              ];
              
              ctx.fillStyle = '#ffffff';
              ctx.strokeStyle = '#3b82f6';
              ctx.lineWidth = 2 / state.zoom;
              corners.forEach(pos => {
                ctx.fillRect(pos.x - handleSize / 2, pos.y - handleSize / 2, handleSize, handleSize);
                ctx.strokeRect(pos.x - handleSize / 2, pos.y - handleSize / 2, handleSize, handleSize);
              });
              
              // Draw midpoint edge handles
              const midHandleSize = 6 / state.zoom;
              const midpoints = [
                { x: element.points[0].x + element.imageWidth / 2, y: element.points[0].y }, // top
                { x: element.points[0].x + element.imageWidth / 2, y: element.points[0].y + element.imageHeight }, // bottom
                { x: element.points[0].x, y: element.points[0].y + element.imageHeight / 2 }, // left
                { x: element.points[0].x + element.imageWidth, y: element.points[0].y + element.imageHeight / 2 }, // right
              ];
              midpoints.forEach(pos => {
                ctx.fillRect(pos.x - midHandleSize / 2, pos.y - midHandleSize / 2, midHandleSize, midHandleSize);
                ctx.strokeRect(pos.x - midHandleSize / 2, pos.y - midHandleSize / 2, midHandleSize, midHandleSize);
              });
            }
          }
        }
        break;
    }
    
    ctx.restore();
  }, [state.layers, state.selectedElementIds, state.units, state.zoom, getPageAtPoint, getPageBounds]);

  // Main render function — two-layer pipeline:
  //  1. Backing canvas: pages + grids + committed elements (rebuilt only when invalidated).
  //  2. Main canvas: blit backing (GPU copy) + active overlays every frame.
  // This means pointer-move during drawing never repaints the entire scene.
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ── Step 1: Rebuild backing canvas if invalidated ──────────────────────
    if (!backingValidRef.current) {
      let backing = backingCanvasRef.current;
      if (!backing) {
        backing = document.createElement('canvas');
        backingCanvasRef.current = backing;
      }
      // Match physical pixel dimensions of main canvas
      if (backing.width !== canvas.width || backing.height !== canvas.height) {
        backing.width = canvas.width;
        backing.height = canvas.height;
      }
      const bctx = backing.getContext('2d');
      if (bctx) {
        const pixelRatio = window.devicePixelRatio || 1;
        bctx.setTransform(1, 0, 0, 1, 0, 0);
        bctx.scale(pixelRatio, pixelRatio);
        // Clear to canvas background colour
        bctx.fillStyle = '#f5f5f5';
        bctx.fillRect(0, 0, canvas.width / pixelRatio, canvas.height / pixelRatio);
        // World transform
        bctx.save();
        bctx.scale(state.zoom, state.zoom);
        bctx.translate(state.panOffset.x, state.panOffset.y);
        const viewportBounds = getViewportWorldBounds(canvas);
        const cullMargin = Math.max(24, 24 / state.zoom);
        const queryBounds: SpatialRect = {
          minX: viewportBounds.minX - cullMargin,
          minY: viewportBounds.minY - cullMargin,
          maxX: viewportBounds.maxX + cullMargin,
          maxY: viewportBounds.maxY + cullMargin,
        };
        drawPages(bctx, viewportBounds);
        drawPageGrids(bctx, viewportBounds);
        const visibleItems = elementSpatialIndex.query(queryBounds);
        const visibleIds = new Set(visibleItems.map(item => item.data.id));
        state.elements.forEach(element => {
          if (!visibleIds.has(element.id)) return;
          drawElement(bctx, element);
        });
        bctx.restore();
        backingValidRef.current = true;
      }
    }

    // ── Step 2: Composite — blit backing then draw active overlays ──────────
    // 2a. Blit backing in device-pixel space (identity transform = zero overhead GPU copy)
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const backing = backingCanvasRef.current;
    if (backing) {
      ctx.drawImage(backing, 0, 0);
    } else {
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.restore();

    // 2b. Overlays in world coordinates (re-apply zoom + pan over pixelRatio base)
    ctx.save();
    ctx.scale(state.zoom, state.zoom);
    ctx.translate(state.panOffset.x, state.panOffset.y);

    // Active element being drawn/edited
    if (currentElement) {
      if (currentElement.type === 'angle') {
        drawElement(ctx, { ...currentElement, selectedAngleSide: null });
      } else {
        drawElement(ctx, currentElement);
      }
    }

    // Marquee selection rectangle
    if (state.selectionRect) {
      const r = state.selectionRect;
      ctx.save();
      ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
      ctx.lineWidth = 1 / state.zoom;
      ctx.setLineDash([4 / state.zoom, 4 / state.zoom]);
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Add-page button drawn on canvas (no DOM = no layout thrash)
    const lastBounds = getPageBounds(state.totalPages);
    const btnX = lastBounds.x + lastBounds.width / 2;
    const btnY = lastBounds.y + lastBounds.height + 40;
    const btnR = 20 / state.zoom;
    ctx.save();
    ctx.fillStyle = '#1e1e1e';
    ctx.beginPath();
    ctx.arc(btnX, btnY, btnR, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1 / state.zoom;
    ctx.stroke();
    const iconSize = 10 / state.zoom;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2 / state.zoom;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(btnX - iconSize, btnY);
    ctx.lineTo(btnX + iconSize, btnY);
    ctx.moveTo(btnX, btnY - iconSize);
    ctx.lineTo(btnX, btnY + iconSize);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }, [state.zoom, state.panOffset, state.elements, state.totalPages, state.selectionRect, currentElement, drawElement, drawPages, drawPageGrids, getPageBounds, getViewportWorldBounds, elementSpatialIndex]);

  // Full invalidation: mark backing stale then schedule RAF.
  // Call this when elements, zoom, pan, pages, or grid change.
  const scheduleRender = useCallback(() => {
    backingValidRef.current = false;
    if (renderPendingRef.current) return;
    renderPendingRef.current = true;
    rafIdRef.current = requestAnimationFrame(() => {
      renderPendingRef.current = false;
      renderRef.current();
    });
  }, []);

  // Overlay-only: backing is still valid; just re-composite.
  // Call this when only the active element or selection marquee changed.
  const scheduleOverlayRender = useCallback(() => {
    if (renderPendingRef.current) return;
    renderPendingRef.current = true;
    rafIdRef.current = requestAnimationFrame(() => {
      renderPendingRef.current = false;
      renderRef.current();
    });
  }, []);

  // Keep renderRef updated
  renderRef.current = render;

  // Clean up RAF on unmount
  useEffect(() => {
    return () => { cancelAnimationFrame(rafIdRef.current); };
  }, []);

  // Scene-layer changes: invalidate backing and reschedule full composite.
  useEffect(() => {
    scheduleRender();
  }, [state.elements, state.selectedElementIds, state.zoom, state.panOffset, state.currentPage, state.totalPages, state.gridSize, state.gridVisible, scheduleRender]);

  // Overlay-only changes: active element or marquee — no backing rebuild needed.
  useEffect(() => {
    scheduleOverlayRender();
  }, [currentElement, state.selectionRect, scheduleOverlayRender]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const containerRect = container.getBoundingClientRect();
      if (containerRect.width === 0 || containerRect.height === 0) return;
      
      // Always constrain canvas to container size (no DOM scrolling)
      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = containerRect.width * pixelRatio;
      canvas.height = containerRect.height * pixelRatio;
      
      canvas.style.width = `${containerRect.width}px`;
      canvas.style.height = `${containerRect.height}px`;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(pixelRatio, pixelRatio);
      }

      // Recompute min zoom and clamp pan to keep content centered and within bounds
      computeAndApplyMinZoom();
      const clamped = clampPan(state.panOffset);
      if (clamped.x !== state.panOffset.x || clamped.y !== state.panOffset.y) {
        dispatch({ type: 'SET_PAN', offset: clamped });
      }

      // Resize also invalidates the backing canvas (dimensions changed)
      backingValidRef.current = false;
      render();
    };

    // Use ResizeObserver so the canvas smoothly re-centers during CSS panel transitions
    const ro = new ResizeObserver(() => {
      resizeCanvas();
    });
    ro.observe(container);
    resizeCanvas();
    return () => ro.disconnect();
  }, [state.totalPages, state.pageWidth, state.pageHeight, state.panOffset, clampPan, computeAndApplyMinZoom, getContentSize, dispatch, render]);

  // Convert pointer event to canvas coordinates (use CSS pixels; devicePixelRatio handled by context scaling)
  const getCanvasPoint = (e: React.PointerEvent | PointerEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    let x = ((e.clientX - rect.left) / state.zoom) - state.panOffset.x;
    let y = ((e.clientY - rect.top) / state.zoom) - state.panOffset.y;

    // Apply snapping if enabled and within page bounds
    if (state.snapToGrid && state.currentTool !== 'freehand') {
      const pageNumber = getPageAtPoint({ x, y });
      if (pageNumber) {
        const snapped = snapToGrid({ x, y }, state.gridSize);
        x = snapped.x;
        y = snapped.y;
      }
    }

    return { x, y };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const point = getCanvasPoint(e);
    lastCursorPos.current = point;
    onCursorMove(point);

    // Show instructions when moving cursor over canvas
    if (!isDrawing && !isPanning) {
      showInstructionsBriefly();
    }

    // Handle panning
    if (isPanning && lastPanPoint) {
      const deltaX = (e.clientX - lastPanPoint.x) / state.zoom;
      const deltaY = (e.clientY - lastPanPoint.y) / state.zoom;
      
      const nextPan = { x: state.panOffset.x + deltaX, y: state.panOffset.y + deltaY };
      const clamped = clampPan(nextPan);
      dispatch({ type: 'SET_PAN', offset: clamped });
      
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    }
  };

  // Center canvas appropriately when state changes (keep horizontally centered when content fits)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const { totalWidth, totalHeight } = getContentSize();
    const viewW = rect.width / state.zoom;
    const viewH = rect.height / state.zoom;

    let desired = state.panOffset;
    let needsUpdate = false;

    if (totalWidth <= viewW) {
      const centeredX = (viewW - totalWidth) / 2;
      if (Math.abs(desired.x - centeredX) > 0.1) {
        desired = { ...desired, x: centeredX };
        needsUpdate = true;
      }
    }
    if (totalHeight <= viewH) {
      const centeredY = (viewH - totalHeight) / 2;
      if (Math.abs(desired.y - centeredY) > 0.1) {
        desired = { ...desired, y: centeredY };
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      const clamped = clampPan(desired);
      dispatch({ type: 'SET_PAN', offset: clamped });
    }
  }, [state.zoom, state.pageWidth, state.pageHeight, state.totalPages, state.panOffset, clampPan, getContentSize, dispatch]);

  // Handle zoom and pan with wheel / trackpad
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    
    // ── Zoom toward cursor with Ctrl/Cmd + wheel (trackpad pinch) ──
    if (e.ctrlKey || e.metaKey) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Pointer position in CSS pixels relative to canvas element
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Canvas-space point under the cursor before zoom
      const pointX = mouseX / state.zoom - state.panOffset.x;
      const pointY = mouseY / state.zoom - state.panOffset.y;

      const zoomFactor = e.deltaY > 0 ? 0.92 : 1.08;
      const clampedZoom = Math.max(state.minZoom, Math.min(3, state.zoom * zoomFactor));

      // Compute new pan so the same canvas point stays under the cursor
      const newPanX = mouseX / clampedZoom - pointX;
      const newPanY = mouseY / clampedZoom - pointY;

      const clamped = clampPan({ x: newPanX, y: newPanY }, clampedZoom);
      dispatch({ type: 'SET_ZOOM_PAN', zoom: clampedZoom, offset: clamped });
      return;
    }

    // ── Two-finger trackpad panning with axis locking ──
    if (!canPan()) return;

    const rawDX = e.deltaX / state.zoom;
    const rawDY = e.deltaY / state.zoom;

    // Reset axis lock after a gesture pause (120ms without events)
    if (panGestureTimer.current) clearTimeout(panGestureTimer.current);
    panGestureTimer.current = setTimeout(() => {
      panAxisRef.current = null;
      panAccumRef.current = { x: 0, y: 0 };
    }, 120);

    // Accumulate movement to detect dominant axis
    if (panAxisRef.current === null) {
      panAccumRef.current.x += Math.abs(rawDX);
      panAccumRef.current.y += Math.abs(rawDY);
      const total = panAccumRef.current.x + panAccumRef.current.y;

      // Wait for a small amount of movement before deciding
      if (total < 2) return;

      const ratio = Math.max(panAccumRef.current.x, panAccumRef.current.y) / total;
      if (ratio > 0.7) {
        // Strong bias → lock to dominant axis
        panAxisRef.current = panAccumRef.current.x > panAccumRef.current.y ? 'x' : 'y';
      } else {
        // Diagonal → free movement
        panAxisRef.current = 'free';
      }
    }

    let dx = rawDX;
    let dy = rawDY;

    if (panAxisRef.current === 'x') dy = 0;
    else if (panAxisRef.current === 'y') dx = 0;

    const nextPan = { x: state.panOffset.x - dx, y: state.panOffset.y - dy };
    const clamped = clampPan(nextPan);
    dispatch({ type: 'SET_PAN', offset: clamped });
  };

  // Handle pointer down for panning (only when content larger than viewport)
  const handlePointerDown = (e: React.PointerEvent) => {
    containerActiveRef.current = true;
    canvasRef.current?.setPointerCapture(e.pointerId);

    // In pencil mode, only allow pen pointers for drawing
    // Touch pointers can still pan
    const isTouchPointer = e.pointerType === 'touch';
    const shouldPreventDrawing = state.pencilMode && isTouchPointer;

    // Check if the add-page button was clicked
    const point = getCanvasPoint(e);
    const lastBounds = getPageBounds(state.totalPages);
    const btnX = lastBounds.x + lastBounds.width / 2;
    const btnY = lastBounds.y + lastBounds.height + 40;
    const btnR = 20 / state.zoom;
    const dx = point.x - btnX;
    const dy = point.y - btnY;
    if (dx * dx + dy * dy <= btnR * btnR) {
      dispatch({ type: 'ADD_PAGE' });
      return;
    }
    
    // Middle mouse button or touch pointer (when not in pencil mode) can pan
    // In pencil mode, touch pointers can still pan even when pencil mode is active
    if ((e.button === 1 || isTouchPointer) && canPan()) {
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    } else if (!shouldPreventDrawing) {
      // Show instructions when starting to use tool (not panning)
      showInstructionsBriefly();
    }
  };

  // Handle pointer up
  const handlePointerUp = (e: React.PointerEvent) => {
    setIsPanning(false);
    setLastPanPoint(null);
    canvasRef.current?.releasePointerCapture(e.pointerId);
  };

  // Keyboard shortcuts: Undo / Redo with proper platform modifiers
  useEffect(() => {
    const isTextInput = (el: Element | null) => {
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      const editable = (el as HTMLElement).isContentEditable;
      return tag === 'input' || tag === 'textarea' || editable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (isTextInput(active)) return;

      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const mod = isMac ? e.metaKey : e.ctrlKey;
      const shift = e.shiftKey;

      // Undo
      if (mod && !shift && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
        return;
      }
      // Redo (Cmd+Shift+Z on Mac; Ctrl+Y or Ctrl+Shift+Z on Win/Linux)
      if (
        (mod && shift && (e.key === 'z' || e.key === 'Z')) ||
        (!isMac && mod && (e.key === 'y' || e.key === 'Y'))
      ) {
        e.preventDefault();
        dispatch({ type: 'REDO' });
      }
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch]);

  // Cleanup instruction timeout on unmount
  useEffect(() => {
    return () => {
      if (instructionTimeoutRef.current) {
        clearTimeout(instructionTimeoutRef.current);
      }
    };
  }, []);

  // iPad two/three-finger tap: basic detection without heavy libs
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let lastTouchTime = 0;
    let lastTouchCount = 0;

    const onTouchStart = (e: TouchEvent) => {
      // Only if canvas region is active
      if (!containerActiveRef.current) return;
      lastTouchTime = Date.now();
      lastTouchCount = e.touches.length;
    };
    const onTouchEnd = () => {
      const dt = Date.now() - lastTouchTime;
      if (dt < 300) {
        if (lastTouchCount === 2) {
          // Two-finger tap → Undo
          dispatch({ type: 'UNDO' });
        } else if (lastTouchCount === 3) {
          // Three-finger tap → Redo
          dispatch({ type: 'REDO' });
        }
      }
      lastTouchCount = 0;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart as EventListener);
      el.removeEventListener('touchend', onTouchEnd as EventListener);
    };
  }, [dispatch]);

  // Register a native non-passive wheel listener on the canvas so that
  // preventDefault() actually works (React registers onWheel as passive).
  // This prevents the two-finger swipe-back browser gesture on the canvas.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const nativeWheel = (e: WheelEvent) => { e.preventDefault(); };
    canvas.addEventListener('wheel', nativeWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', nativeWheel);
  }, []);

  // Shared helper: add an image element to the canvas at the cursor (or page center)
  // Compresses images via off-screen canvas before storing to reduce data size
  const addImageFromSrc = useCallback((imageSrc: string) => {
    const img = new Image();
    img.onload = () => {
      const maxDisplay = 400;  // max display size on canvas
      const maxStore = 1200;   // max pixel dimension for stored data
      let displayW = img.width;
      let displayH = img.height;

      if (displayW > maxDisplay || displayH > maxDisplay) {
        const ratio = Math.min(maxDisplay / displayW, maxDisplay / displayH);
        displayW *= ratio;
        displayH *= ratio;
      }

      // Compress the image for storage
      let storeW = img.width;
      let storeH = img.height;
      if (storeW > maxStore || storeH > maxStore) {
        const ratio = Math.min(maxStore / storeW, maxStore / storeH);
        storeW = Math.round(storeW * ratio);
        storeH = Math.round(storeH * ratio);
      }
      const offscreen = document.createElement('canvas');
      offscreen.width = storeW;
      offscreen.height = storeH;
      const octx = offscreen.getContext('2d');
      octx?.drawImage(img, 0, 0, storeW, storeH);
      // Use JPEG at 0.8 quality for smaller size (PNG fallback for transparency)
      const compressedSrc = offscreen.toDataURL('image/jpeg', 0.8);

      // Determine which page to place the image on based on cursor position
      const cursorPage = lastCursorPos.current ? getPageAtPoint(lastCursorPos.current) : null;
      const targetPage = cursorPage ?? state.currentPage;
      const bounds = getPageBounds(targetPage);
      let posX: number;
      let posY: number;

      if (lastCursorPos.current && cursorPage) {
        posX = lastCursorPos.current.x - displayW / 2;
        posY = lastCursorPos.current.y - displayH / 2;
      } else {
        posX = bounds.x + (bounds.width - displayW) / 2;
        posY = bounds.y + (bounds.height - displayH) / 2;
      }

      posX = Math.max(bounds.x, Math.min(bounds.x + bounds.width - displayW, posX));
      posY = Math.max(bounds.y, Math.min(bounds.y + bounds.height - displayH, posY));

      const imageElement: DrawingElement = {
        id: `image-${Date.now()}`,
        type: 'image',
        points: [{ x: posX, y: posY }],
        style: { strokeColor: '#000000', strokeWidth: 0 },
        layerId: state.currentLayerId,
        imageSrc: compressedSrc,
        imageWidth: displayW,
        imageHeight: displayH,
      };

      dispatch({ type: 'ADD_ELEMENT', element: imageElement });
    };
    img.src = imageSrc;
  }, [dispatch, state.currentLayerId, state.currentPage, getPageBounds, getPageAtPoint]);

  // Handle paste event for images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) continue;

          const reader = new FileReader();
          reader.onload = (event) => {
            const src = event.target?.result as string;
            if (src) addImageFromSrc(src);
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    };

    const handleInsertImage = (e: Event) => {
      const { imageSrc } = (e as CustomEvent).detail;
      addImageFromSrc(imageSrc);
    };

    window.addEventListener('paste', handlePaste);
    window.addEventListener('insertImage', handleInsertImage);
    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('insertImage', handleInsertImage);
    };
  }, [addImageFromSrc]);

  // Tool-specific handlers
  const toolHandlers = {
    line: LineTool,
    angle: AngleTool,
    freehand: FreehandTool,
    select: SelectTool,
    eraser: EraserTool,
    text: TextTool,
  } as const;

  const ToolComponent = toolHandlers[state.currentTool as keyof typeof toolHandlers];

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-gray-100">
      <style>{`
        .cursor-triangle {
          cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><polygon points="4,20 20,20 12,6" fill="%23000" transform="rotate(-20 12 12)"/></svg>') 12 12, default;
        }
        .cursor-plus { cursor: crosshair; }
        .cursor-ibeam { cursor: text; }
        .cursor-eraser { cursor: crosshair; }
        .cursor-default { cursor: default; }
        .cursor-grab { cursor: grabbing; }
      `}</style>
      <canvas
        ref={canvasRef}
        className={`block touch-none ${
          isPanning ? 'cursor-grab' : 
          state.currentTool === 'select' ? 'cursor-default' :
          state.currentTool === 'eraser' ? 'cursor-eraser' :
          state.currentTool === 'text' ? 'cursor-ibeam' :
          state.currentTool === 'angle' ? 'cursor-plus' :
          state.currentTool === 'line' ? 'cursor-plus' :
          'cursor-crosshair'
        }`}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
      />
      
      {/* Tool component for handling interactions */}
      {ToolComponent && (
        <ToolComponent
          canvasRef={canvasRef}
          getCanvasPoint={getCanvasPoint}
          clipToPageBounds={clipToPageBounds}
          getPageAtPoint={getPageAtPoint}
          isDrawing={isDrawing}
          setIsDrawing={setIsDrawing}
          currentElement={currentElement}
          setCurrentElement={setCurrentElement}
          render={scheduleOverlayRender}
        />
      )}

      {/* Live measurement display */}
      {currentElement && currentElement.measurements && (
        <div className="absolute top-4 left-4 bg-black bg-opacity-80 text-white px-3 py-2 rounded text-sm font-mono pointer-events-none z-50">
          {currentElement.measurements.length && (
            <div>
              {state.units === 'cm'
                ? `Length: ${(currentElement.measurements.length / MM_TO_PX / 10).toFixed(2)} cm`
                : `Length: ${(currentElement.measurements.length / MM_TO_PX).toFixed(2)} mm`}
            </div>
          )}
          {currentElement.measurements.radius && (
            <div>
              {state.units === 'cm'
                ? `Radius: ${(currentElement.measurements.radius / MM_TO_PX / 10).toFixed(2)} cm`
                : `Radius: ${(currentElement.measurements.radius / MM_TO_PX).toFixed(2)} mm`}
            </div>
          )}
          {currentElement.measurements.angle && (
            <div>Angle: {(currentElement.measurements.angle * 180 / Math.PI).toFixed(1)}°</div>
          )}
        </div>
      )}

      {/* Dynamic Tool Instructions - Smooth fade in/out based on interaction */}
      <div 
        className={`absolute bottom-4 left-4 pointer-events-none transition-all duration-500 ease-in-out ${
          showInstructions 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-2'
        }`}
      >
        <div className="bg-black/80 backdrop-blur-md text-white/90 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 shadow-lg flex items-center space-x-2">
          {state.currentTool === 'select' && <span>Click to select • Drag to move • Shift+Click to pan</span>}
          {state.currentTool === 'line' && <span>Click and drag to draw lines</span>}
          {state.currentTool === 'angle' && <span>Click: baseline start → center → angle end</span>}
          {state.currentTool === 'freehand' && <span>Click and drag to draw freehand</span>}
          {state.currentTool === 'eraser' && <span>Click and drag to erase</span>}
          {state.currentTool === 'text' && <span>Click to place text</span>}
          {!['select', 'line', 'angle', 'freehand', 'eraser', 'text'].includes(state.currentTool) && <span>Ready</span>}
        </div>
      </div>

      {/* Add Page Button - Rendered on canvas for lag-free scrolling */}
    </div>
  );
}