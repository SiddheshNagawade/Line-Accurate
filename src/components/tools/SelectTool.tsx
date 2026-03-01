import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useDrawingContext, Point, DrawingElement } from '../../context/DrawingContext';
import { isPointNearLine, distPointToSegment } from '../../utils/geometry';

interface SelectToolProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  getCanvasPoint: (e: React.PointerEvent | PointerEvent) => Point;
  clipToPageBounds: (point: Point) => Point;
  getPageAtPoint: (point: Point) => number | null;
  isDrawing: boolean;
  setIsDrawing: (drawing: boolean) => void;
  currentElement: DrawingElement | null;
  setCurrentElement: (element: DrawingElement | null) => void;
  render: () => void;
}

export function SelectTool({
  canvasRef,
  getCanvasPoint,
  clipToPageBounds,
  getPageAtPoint,
  isDrawing,
  setIsDrawing,
  currentElement,
  setCurrentElement,
  render,
}: SelectToolProps) {
  const { state, dispatch } = useDrawingContext();
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isMarquee, setIsMarquee] = useState(false); // marquee rectangle selection
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeOrigin, setResizeOrigin] = useState<Point | null>(null);
  const [initialImageSize, setInitialImageSize] = useState<{ width: number; height: number } | null>(null);
  const [initialImagePos, setInitialImagePos] = useState<Point | null>(null);

  // Use a ref so event handlers always read latest state without re-attaching
  const stateRef = useRef(state);
  stateRef.current = state;
  const isDraggingRef = useRef(isDragging);
  isDraggingRef.current = isDragging;
  const isMarqueeRef = useRef(isMarquee);
  isMarqueeRef.current = isMarquee;
  const dragStartRef = useRef(dragStart);
  dragStartRef.current = dragStart;
  const resizeHandleRef = useRef(resizeHandle);
  resizeHandleRef.current = resizeHandle;
  const initialImageSizeRef = useRef(initialImageSize);
  initialImageSizeRef.current = initialImageSize;
  const initialImagePosRef = useRef(initialImagePos);
  initialImagePosRef.current = initialImagePos;

  // --- Helper: compute an element's axis-aligned bounding box ---
  const getElementBounds = useCallback((el: DrawingElement): { minX: number; minY: number; maxX: number; maxY: number } | null => {
    if (el.points.length === 0) return null;

    if (el.type === 'image' && el.imageWidth && el.imageHeight) {
      return {
        minX: el.points[0].x,
        minY: el.points[0].y,
        maxX: el.points[0].x + el.imageWidth,
        maxY: el.points[0].y + el.imageHeight,
      };
    }
    if (el.type === 'text' && el.text) {
      const fontSize = el.fontSize || 14;
      const textWidth = el.text.length * fontSize * 0.6;
      return {
        minX: el.points[0].x,
        minY: el.points[0].y,
        maxX: el.points[0].x + textWidth,
        maxY: el.points[0].y + fontSize,
      };
    }
    // Generic: bounding box from points
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of el.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    // Give lines/angles/freehand a small padding so they're easier to catch
    const pad = el.style.strokeWidth / 2 + 2;
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
  }, []);

  // --- Helper: check if an element's bounding box intersects a rectangle ---
  const elementIntersectsRect = useCallback((el: DrawingElement, rect: { x: number; y: number; w: number; h: number }): boolean => {
    const bounds = getElementBounds(el);
    if (!bounds) return false;
    const rMinX = Math.min(rect.x, rect.x + rect.w);
    const rMaxX = Math.max(rect.x, rect.x + rect.w);
    const rMinY = Math.min(rect.y, rect.y + rect.h);
    const rMaxY = Math.max(rect.y, rect.y + rect.h);
    return bounds.maxX >= rMinX && bounds.minX <= rMaxX && bounds.maxY >= rMinY && bounds.minY <= rMaxY;
  }, [getElementBounds]);


  const findElementAtPoint = (point: Point): DrawingElement | null => {
    const s = stateRef.current;
    for (let i = s.elements.length - 1; i >= 0; i--) {
      const element = s.elements[i];
      const layer = s.layers.find(l => l.id === element.layerId);
      if (!layer?.visible || layer.locked) continue;

      switch (element.type) {
        case 'line':
          if (element.points.length >= 2) {
            if (isPointNearLine(point, element.points[0], element.points[1], s.snapThreshold)) {
              return element;
            }
          }
          break;
        case 'angle':
          if (element.points.length >= 3) {
            const baseline = element.points[0];
            const center = element.points[1];
            const endpoint = element.points[2];
            
            if (isPointNearLine(point, baseline, center, s.snapThreshold) || 
                isPointNearLine(point, center, endpoint, s.snapThreshold)) {
              return element;
            }
            // Also check near the arc area
            const dist = Math.sqrt((point.x - center.x) ** 2 + (point.y - center.y) ** 2);
            if (dist <= 50) {
              return element;
            }
          }
          break;
        case 'freehand':
          for (let j = 0; j < element.points.length - 1; j++) {
            if (isPointNearLine(point, element.points[j], element.points[j + 1], s.snapThreshold)) {
              return element;
            }
          }
          break;
        case 'text':
          if (element.points.length > 0 && element.text) {
            const textPoint = element.points[0];
            const fontSize = element.fontSize || 14;
            const textWidth = element.text.length * fontSize * 0.6;
            
            if (point.x >= textPoint.x && point.x <= textPoint.x + textWidth &&
                point.y >= textPoint.y && point.y <= textPoint.y + fontSize) {
              return element;
            }
          }
          break;
        case 'image':
          if (element.points.length > 0 && element.imageWidth && element.imageHeight) {
            const imgX = element.points[0].x;
            const imgY = element.points[0].y;
            
            if (point.x >= imgX && point.x <= imgX + element.imageWidth &&
                point.y >= imgY && point.y <= imgY + element.imageHeight) {
              return element;
            }
          }
          break;
      }
    }
    return null;
  };

  const HANDLE_HITBOX = 14; // pixels of hitbox around each handle corner

  const getResizeHandle = (point: Point, element: DrawingElement): string | null => {
    if (element.type !== 'image' || !element.imageWidth || !element.imageHeight) return null;
    
    const hitSize = HANDLE_HITBOX / stateRef.current.zoom;
    const imgX = element.points[0].x;
    const imgY = element.points[0].y;
    const imgW = element.imageWidth;
    const imgH = element.imageHeight;
    
    const handles = [
      { name: 'tl', x: imgX, y: imgY },
      { name: 'tr', x: imgX + imgW, y: imgY },
      { name: 'bl', x: imgX, y: imgY + imgH },
      { name: 'br', x: imgX + imgW, y: imgY + imgH },
    ];
    
    for (const handle of handles) {
      if (Math.abs(point.x - handle.x) <= hitSize && Math.abs(point.y - handle.y) <= hitSize) {
        return handle.name;
      }
    }
    
    // Also check edges for resize (top/bottom/left/right edges)
    const edgeThreshold = hitSize / 2;
    if (Math.abs(point.y - imgY) <= edgeThreshold && point.x >= imgX && point.x <= imgX + imgW) return 'top';
    if (Math.abs(point.y - (imgY + imgH)) <= edgeThreshold && point.x >= imgX && point.x <= imgX + imgW) return 'bottom';
    if (Math.abs(point.x - imgX) <= edgeThreshold && point.y >= imgY && point.y <= imgY + imgH) return 'left';
    if (Math.abs(point.x - (imgX + imgW)) <= edgeThreshold && point.y >= imgY && point.y <= imgY + imgH) return 'right';

    return null;
  };

  const getResizeCursor = (handle: string): string => {
    switch (handle) {
      case 'tl': case 'br': return 'nwse-resize';
      case 'tr': case 'bl': return 'nesw-resize';
      case 'top': case 'bottom': return 'ns-resize';
      case 'left': case 'right': return 'ew-resize';
      default: return 'default';
    }
  };

  const determineAngleSide = (point: Point, element: DrawingElement): 'primary' | 'secondary' | null => {
    if (element.type !== 'angle' || element.points.length < 3) return null;
    
    const baseline = element.points[0];
    const center = element.points[1];
    const endpoint = element.points[2];
    
    const distToBaseline = distPointToSegment(point, center, baseline);
    const distToEndpoint = distPointToSegment(point, center, endpoint);
    
    const baselineAngle = Math.atan2(baseline.y - center.y, baseline.x - center.x);
    const endpointAngle = Math.atan2(endpoint.y - center.y, endpoint.x - center.x);
    
    let angleDiff = endpointAngle - baselineAngle;
    while (angleDiff < 0) angleDiff += 2 * Math.PI;
    while (angleDiff >= 2 * Math.PI) angleDiff -= 2 * Math.PI;
    
    const midAngle = baselineAngle + angleDiff / 2;
    const oppAngle = midAngle + Math.PI;
    
    const textRadius = 50;
    const primaryLabelPos = { x: center.x + Math.cos(midAngle) * textRadius, y: center.y + Math.sin(midAngle) * textRadius };
    const secondaryLabelPos = { x: center.x + Math.cos(oppAngle) * textRadius, y: center.y + Math.sin(oppAngle) * textRadius };
    
    const distToPrimary = Math.sqrt((point.x - primaryLabelPos.x) ** 2 + (point.y - primaryLabelPos.y) ** 2);
    const distToSecondary = Math.sqrt((point.x - secondaryLabelPos.x) ** 2 + (point.y - secondaryLabelPos.y) ** 2);
    
    if (distToPrimary < 40 && distToPrimary < distToSecondary) return 'primary';
    if (distToSecondary < 40 && distToSecondary < distToPrimary) return 'secondary';
    
    if (distToBaseline < distToEndpoint) {
      return 'primary';
    } else {
      return 'secondary';
    }
  };



  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handlePointerDown = (e: PointerEvent) => {
      const isShift = e.shiftKey;
      const s = stateRef.current;

      const point = getCanvasPoint(e);

      // First: check resize handles on already-selected images (only for single-image selection)
      if (s.selectedElementIds.length > 0) {
        const selectedEl = s.elements.find(el => s.selectedElementIds.includes(el.id) && el.type === 'image');
        if (selectedEl && s.selectedElementIds.length === 1) {
          const handle = getResizeHandle(point, selectedEl);
          if (handle) {
            setResizeHandle(handle);
            setDragStart(point);
            setInitialImageSize({
              width: selectedEl.imageWidth!,
              height: selectedEl.imageHeight!,
            });
            setInitialImagePos({ x: selectedEl.points[0].x, y: selectedEl.points[0].y });
            setIsDragging(false);
            setIsMarquee(false);
            canvas.setPointerCapture(e.pointerId);
            return;
          }
        }
      }

      const clickedElement = findElementAtPoint(point);

      if (clickedElement) {
        // Angle side selection: if angle is already selected, determine which side was clicked
        if (clickedElement.type === 'angle' && s.selectedElementIds.includes(clickedElement.id)) {
          const side = determineAngleSide(point, clickedElement);
          if (side) {
            dispatch({
              type: 'UPDATE_ELEMENT',
              id: clickedElement.id,
              element: { selectedAngleSide: side },
            });
            dispatch({ type: 'SAVE_STATE' });
            render();
            return;
          }
        }

        // Select / toggle the element
        if (isShift) {
          // Shift+click: toggle element in/out of current selection
          const alreadySelected = s.selectedElementIds.includes(clickedElement.id);
          const newIds = alreadySelected
            ? s.selectedElementIds.filter((id: string) => id !== clickedElement.id)
            : [...s.selectedElementIds, clickedElement.id];
          dispatch({ type: 'SELECT_ELEMENTS', ids: newIds });
        } else {
          // Normal click: if clicking already-selected element in multi-selection, keep selection for drag
          if (s.selectedElementIds.includes(clickedElement.id) && s.selectedElementIds.length > 1) {
            // Don't change selection — allow dragging the whole group
          } else {
            dispatch({ type: 'SELECT_ELEMENTS', ids: [clickedElement.id] });
          }
        }
        setDragStart(point);
        setIsDragging(true);
        setIsMarquee(false);
        canvas.setPointerCapture(e.pointerId);
      } else {
        // Clicked empty space — start marquee selection
        if (!isShift) {
          dispatch({ type: 'SELECT_ELEMENTS', ids: [] });
        }
        setDragStart(point);
        setIsMarquee(true);
        setIsDragging(false);
        canvas.setPointerCapture(e.pointerId);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const s = stateRef.current;
      const currentPoint = getCanvasPoint(e);

      // --- Marquee rectangle selection ---
      if (isMarqueeRef.current && dragStartRef.current) {
        const rect = {
          x: dragStartRef.current.x,
          y: dragStartRef.current.y,
          w: currentPoint.x - dragStartRef.current.x,
          h: currentPoint.y - dragStartRef.current.y,
        };
        dispatch({ type: 'SET_SELECTION_RECT', rect });
        render();
        return;
      }

      // --- Cursor management for resize handles ---
      if (!isDraggingRef.current && !resizeHandleRef.current && s.selectedElementIds.length > 0) {
        const selectedEl = s.elements.find(el => s.selectedElementIds.includes(el.id) && el.type === 'image');
        if (selectedEl && s.selectedElementIds.length === 1) {
          const handle = getResizeHandle(currentPoint, selectedEl);
          if (handle) {
            canvas.style.cursor = getResizeCursor(handle);
          } else {
            const imgX = selectedEl.points[0].x;
            const imgY = selectedEl.points[0].y;
            if (currentPoint.x >= imgX && currentPoint.x <= imgX + selectedEl.imageWidth! &&
                currentPoint.y >= imgY && currentPoint.y <= imgY + selectedEl.imageHeight!) {
              canvas.style.cursor = 'move';
            } else {
              canvas.style.cursor = 'default';
            }
          }
        } else {
          // For multi-select, show move cursor when hovering over any selected element
          const hoveredEl = findElementAtPoint(currentPoint);
          if (hoveredEl && s.selectedElementIds.includes(hoveredEl.id)) {
            canvas.style.cursor = 'move';
          } else {
            canvas.style.cursor = 'default';
          }
        }
      }

      // --- Image resizing (single image only) ---
      if (resizeHandleRef.current && dragStartRef.current && s.selectedElementIds.length === 1 && initialImageSizeRef.current && initialImagePosRef.current) {
        const element = s.elements.find(el => s.selectedElementIds.includes(el.id) && el.type === 'image');
        if (element && element.imageWidth && element.imageHeight) {
          const deltaX = currentPoint.x - dragStartRef.current.x;
          const deltaY = currentPoint.y - dragStartRef.current.y;
          
          let newWidth = initialImageSizeRef.current.width;
          let newHeight = initialImageSizeRef.current.height;
          let newX = initialImagePosRef.current.x;
          let newY = initialImagePosRef.current.y;
          
          const aspectRatio = initialImageSizeRef.current.width / initialImageSizeRef.current.height;
          
          switch (resizeHandleRef.current) {
            case 'br':
              newWidth = Math.max(30, initialImageSizeRef.current.width + deltaX);
              newHeight = newWidth / aspectRatio;
              break;
            case 'bl':
              newWidth = Math.max(30, initialImageSizeRef.current.width - deltaX);
              newHeight = newWidth / aspectRatio;
              newX = initialImagePosRef.current.x + (initialImageSizeRef.current.width - newWidth);
              break;
            case 'tr':
              newWidth = Math.max(30, initialImageSizeRef.current.width + deltaX);
              newHeight = newWidth / aspectRatio;
              newY = initialImagePosRef.current.y + (initialImageSizeRef.current.height - newHeight);
              break;
            case 'tl':
              newWidth = Math.max(30, initialImageSizeRef.current.width - deltaX);
              newHeight = newWidth / aspectRatio;
              newX = initialImagePosRef.current.x + (initialImageSizeRef.current.width - newWidth);
              newY = initialImagePosRef.current.y + (initialImageSizeRef.current.height - newHeight);
              break;
            case 'top':
              newHeight = Math.max(30, initialImageSizeRef.current.height - deltaY);
              newWidth = newHeight * aspectRatio;
              newY = initialImagePosRef.current.y + (initialImageSizeRef.current.height - newHeight);
              break;
            case 'bottom':
              newHeight = Math.max(30, initialImageSizeRef.current.height + deltaY);
              newWidth = newHeight * aspectRatio;
              break;
            case 'left':
              newWidth = Math.max(30, initialImageSizeRef.current.width - deltaX);
              newHeight = newWidth / aspectRatio;
              newX = initialImagePosRef.current.x + (initialImageSizeRef.current.width - newWidth);
              break;
            case 'right':
              newWidth = Math.max(30, initialImageSizeRef.current.width + deltaX);
              newHeight = newWidth / aspectRatio;
              break;
          }
          
          dispatch({
            type: 'UPDATE_ELEMENT',
            id: element.id,
            element: {
              points: [{ x: newX, y: newY }],
              imageWidth: newWidth,
              imageHeight: newHeight,
            },
          });
          render();
        }
        return;
      }

      // --- Element dragging (moves ALL selected elements together) ---
      if (!isDraggingRef.current || !dragStartRef.current || s.selectedElementIds.length === 0) return;

      const deltaX = currentPoint.x - dragStartRef.current.x;
      const deltaY = currentPoint.y - dragStartRef.current.y;

      s.selectedElementIds.forEach(id => {
        const element = s.elements.find(el => el.id === id);
        if (element) {
          const newPoints = element.points.map(p => ({
            x: p.x + deltaX,
            y: p.y + deltaY,
          }));
          
          dispatch({
            type: 'UPDATE_ELEMENT',
            id,
            element: { points: newPoints },
          });
        }
      });

      setDragStart(currentPoint);
      render();
    };

    const handlePointerUp = (e: PointerEvent) => {
      const s = stateRef.current;

      // --- Finalise marquee selection ---
      if (isMarqueeRef.current && dragStartRef.current) {
        const currentPoint = getCanvasPoint(e);
        const rect = {
          x: dragStartRef.current.x,
          y: dragStartRef.current.y,
          w: currentPoint.x - dragStartRef.current.x,
          h: currentPoint.y - dragStartRef.current.y,
        };
        // Only select if the marquee was actually dragged (not just a click)
        if (Math.abs(rect.w) > 3 || Math.abs(rect.h) > 3) {
          const hitIds: string[] = [];
          s.elements.forEach(el => {
            const layer = s.layers.find(l => l.id === el.layerId);
            if (!layer?.visible || layer.locked) return;
            if (elementIntersectsRect(el, rect)) {
              hitIds.push(el.id);
            }
          });
          // If shift was held during the initial click, merge with existing selection
          const prevIds = s.selectedElementIds;
          const mergedIds = e.shiftKey
            ? [...new Set([...prevIds, ...hitIds])]
            : hitIds;
          dispatch({ type: 'SELECT_ELEMENTS', ids: mergedIds });
        }
        dispatch({ type: 'SET_SELECTION_RECT', rect: null });
      }

      if ((isDraggingRef.current || resizeHandleRef.current) && s.selectedElementIds.length > 0) {
        dispatch({ type: 'SAVE_STATE' });
        canvas.releasePointerCapture(e.pointerId);
      }
      setIsDragging(false);
      setIsMarquee(false);
      setDragStart(null);
      setResizeHandle(null);
      setInitialImageSize(null);
      setInitialImagePos(null);
      canvas.style.cursor = 'default';
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (s.selectedElementIds.length > 0) {
          dispatch({ type: 'DELETE_ELEMENTS', ids: s.selectedElementIds });
        }
      }
      // Select all (Cmd/Ctrl+A)
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && (e.key === 'a' || e.key === 'A') && s.currentTool === 'select') {
        e.preventDefault();
        const allIds = s.elements
          .filter(el => {
            const layer = s.layers.find(l => l.id === el.layerId);
            return layer?.visible && !layer.locked;
          })
          .map(el => el.id);
        dispatch({ type: 'SELECT_ELEMENTS', ids: allIds });
      }
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('keydown', handleKeyDown);
    };
  // Only re-attach when canvas ref, getCanvasPoint, or render change — NOT on every state change
  }, [canvasRef, getCanvasPoint, dispatch, render]);

  return null;
}