import React, { useEffect, useState } from 'react';
import { useDrawingContext, Point, DrawingElement } from '../../context/DrawingContext';
import { isPointNearLine } from '../../utils/geometry';

interface EraserToolProps {
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

export function EraserTool({
  canvasRef,
  getCanvasPoint,
  clipToPageBounds,
  getPageAtPoint,
  isDrawing,
  setIsDrawing,
  currentElement,
  setCurrentElement,
  render,
}: EraserToolProps) {
  const { state, dispatch } = useDrawingContext();



  const findElementsToErase = (point: Point): string[] => {
    const eraserSize = state.toolSettings.eraser.strokeWidth / 2;
    const elementsToErase: string[] = [];

    state.elements.forEach(element => {
      const layer = state.layers.find(l => l.id === element.layerId);
      if (!layer?.visible || layer.locked) return;

      let shouldErase = false;

      switch (element.type) {
        case 'line':
          if (element.points.length >= 2) {
            shouldErase = isPointNearLine(point, element.points[0], element.points[1], eraserSize);
          }
          break;
        case 'angle':
          if (element.points.length >= 3) {
            const baseline = element.points[0];
            const center = element.points[1];
            const endpoint = element.points[2];
            
            shouldErase = isPointNearLine(point, baseline, center, eraserSize) || 
                         isPointNearLine(point, center, endpoint, eraserSize);
          }
          break;
        case 'freehand':
          for (let j = 0; j < element.points.length - 1; j++) {
            if (isPointNearLine(point, element.points[j], element.points[j + 1], eraserSize)) {
              shouldErase = true;
              break;
            }
          }
          break;
        case 'text':
          if (element.points.length > 0 && element.text) {
            const textPoint = element.points[0];
            const fontSize = element.fontSize || 14;
            const textWidth = element.text.length * fontSize * 0.6;
            
            if (point.x >= textPoint.x - eraserSize && point.x <= textPoint.x + textWidth + eraserSize &&
                point.y >= textPoint.y - eraserSize && point.y <= textPoint.y + fontSize + eraserSize) {
              shouldErase = true;
            }
          }
          break;
        case 'image':
          if (element.points.length > 0 && element.imageWidth && element.imageHeight) {
            const imgX = element.points[0].x;
            const imgY = element.points[0].y;
            
            if (point.x >= imgX - eraserSize && point.x <= imgX + element.imageWidth + eraserSize &&
                point.y >= imgY - eraserSize && point.y <= imgY + element.imageHeight + eraserSize) {
              shouldErase = true;
            }
          }
          break;
      }

      if (shouldErase) {
        elementsToErase.push(element.id);
      }
    });

    return elementsToErase;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handlePointerDown = (e: PointerEvent) => {
      // In pencil mode, only allow pen pointers for drawing
      if (state.pencilMode && e.pointerType === 'touch') {
        return;
      }

      const point = getCanvasPoint(e);
      
      // Only allow erasing within page bounds
      if (!getPageAtPoint(point)) return;
      
      const elementsToErase = findElementsToErase(point);
      
      if (elementsToErase.length > 0) {
        dispatch({ type: 'DELETE_ELEMENTS', ids: elementsToErase });
      }
      
      setIsDrawing(true);
      canvas.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDrawing) return;

      const point = getCanvasPoint(e);
      
      // Only erase within page bounds
      if (!getPageAtPoint(point)) return;
      
      const elementsToErase = findElementsToErase(point);
      
      if (elementsToErase.length > 0) {
        dispatch({ type: 'DELETE_ELEMENTS', ids: elementsToErase });
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (isDrawing) {
        dispatch({ type: 'SAVE_STATE' });
        canvas.releasePointerCapture(e.pointerId);
      }
      setIsDrawing(false);
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
    };
  }, [canvasRef, getCanvasPoint, clipToPageBounds, getPageAtPoint, isDrawing, setIsDrawing, state, dispatch]);

  return null;
}