import React, { useEffect, useState } from 'react';
import { useDrawingContext, Point, DrawingElement } from '../../context/DrawingContext';

interface AngleToolProps {
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

export function AngleTool({
  canvasRef,
  getCanvasPoint,
  clipToPageBounds,
  getPageAtPoint,
  isDrawing,
  setIsDrawing,
  currentElement,
  setCurrentElement,
  render,
}: AngleToolProps) {
  const { state, dispatch } = useDrawingContext();
  // 3-click workflow: 'start' -> 'vertex' -> 'endpoint'
  const [phase, setPhase] = useState<'start' | 'vertex' | 'endpoint'>('start');

  // Helper: check if a point is near an existing angle label
  const findAngleLabelAtPoint = (point: Point): { element: DrawingElement; side: 'primary' | 'secondary' } | null => {
    for (let i = state.elements.length - 1; i >= 0; i--) {
      const el = state.elements[i];
      if (el.type !== 'angle' || el.points.length < 3 || !el.measurements?.angle) continue;
      
      const layer = state.layers.find(l => l.id === el.layerId);
      if (!layer?.visible) continue;

      const center = el.points[1];
      const baseline = el.points[0];
      const endpoint = el.points[2];

      const baselineAngle = Math.atan2(baseline.y - center.y, baseline.x - center.x);
      const endpointAngle = Math.atan2(endpoint.y - center.y, endpoint.x - center.x);

      let angleDiff = endpointAngle - baselineAngle;
      while (angleDiff < 0) angleDiff += 2 * Math.PI;
      while (angleDiff >= 2 * Math.PI) angleDiff -= 2 * Math.PI;

      const arcRadius = 30;
      const textRadius = arcRadius + 20;
      const midAngle = baselineAngle + angleDiff / 2;
      const oppAngle = midAngle + Math.PI;

      const primaryLabelPos = { x: center.x + Math.cos(midAngle) * textRadius, y: center.y + Math.sin(midAngle) * textRadius };
      const secondaryLabelPos = { x: center.x + Math.cos(oppAngle) * textRadius, y: center.y + Math.sin(oppAngle) * textRadius };

      const distToPrimary = Math.sqrt((point.x - primaryLabelPos.x) ** 2 + (point.y - primaryLabelPos.y) ** 2);
      const distToSecondary = Math.sqrt((point.x - secondaryLabelPos.x) ** 2 + (point.y - secondaryLabelPos.y) ** 2);

      const hitRadius = 30; // generous hit area around labels

      // Only allow clicking labels that are currently visible
      const primaryVisible = !el.selectedAngleSide || el.selectedAngleSide === 'primary';
      const secondaryVisible = !el.selectedAngleSide || el.selectedAngleSide === 'secondary';

      if (primaryVisible && distToPrimary <= hitRadius && distToPrimary < distToSecondary) {
        return { element: el, side: 'primary' };
      }
      if (secondaryVisible && distToSecondary <= hitRadius && distToSecondary < distToPrimary) {
        return { element: el, side: 'secondary' };
      }
    }
    return null;
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

      // Only allow drawing within page bounds
      if (!getPageAtPoint(point)) return;
      
      const clippedPoint = clipToPageBounds(point);

      // Before starting a new angle, check if user clicked on an existing angle label
      if (phase === 'start') {
        const labelHit = findAngleLabelAtPoint(clippedPoint);
        if (labelHit) {
          dispatch({
            type: 'UPDATE_ELEMENT',
            id: labelHit.element.id,
            element: { selectedAngleSide: labelHit.side },
          });
          dispatch({ type: 'SAVE_STATE' });
          render();
          return; // Don't start a new angle
        }
      }

      if (phase === 'start') {
        // Click 1: Set starting point of baseline
        const newElement: DrawingElement = {
          id: `angle-${Date.now()}`,
          type: 'angle',
          points: [clippedPoint, clippedPoint], // Start point; second point follows cursor
          style: {
            strokeColor: state.toolSettings.angle.strokeColor,
            strokeWidth: state.toolSettings.angle.strokeWidth,
          },
          layerId: state.currentLayerId,
        };

        setCurrentElement(newElement);
        setIsDrawing(true);
        setPhase('vertex');
      } else if (phase === 'vertex') {
        // Click 2: Set vertex (center), locking the baseline
        if (currentElement) {
          const startPoint = currentElement.points[0];
          // Make sure vertex is different from start
          const dx = clippedPoint.x - startPoint.x;
          const dy = clippedPoint.y - startPoint.y;
          if (Math.sqrt(dx * dx + dy * dy) < 3) return; // Too close, ignore

          const updatedElement = {
            ...currentElement,
            points: [startPoint, clippedPoint], // baseline is now locked
          };
          setCurrentElement(updatedElement);
          setPhase('endpoint');
        }
      } else if (phase === 'endpoint') {
        // Click 3: Set endpoint, finalize angle
        if (currentElement && currentElement.points.length >= 2) {
          const startPoint = currentElement.points[0];
          const center = currentElement.points[1];
          
          const baselineAngle = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);
          const endpointAngle = Math.atan2(clippedPoint.y - center.y, clippedPoint.x - center.x);
          
          let angleDiff = endpointAngle - baselineAngle;
          if (angleDiff < 0) {
            angleDiff += 2 * Math.PI;
          }

          const finalElement = {
            ...currentElement,
            points: [startPoint, center, clippedPoint],
            measurements: {
              angle: angleDiff,
            },
            selectedAngleSide: null, // Start with both sides at 25% opacity
          };
          
          dispatch({ type: 'ADD_ELEMENT', element: finalElement });
          dispatch({ type: 'SAVE_STATE' });
          setCurrentElement(null);
          setIsDrawing(false);
          setPhase('start');
        }
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const point = getCanvasPoint(e);
      const clippedPoint = clipToPageBounds(point);

      // Show pointer cursor when hovering over angle labels
      if (phase === 'start') {
        const labelHit = findAngleLabelAtPoint(clippedPoint);
        canvas.style.cursor = labelHit ? 'pointer' : 'crosshair';
      }

      if (!currentElement) return;

      if (phase === 'vertex') {
        // Show baseline preview: start point is locked, second point follows cursor
        const updatedElement = {
          ...currentElement,
          points: [currentElement.points[0], clippedPoint],
        };
        setCurrentElement(updatedElement);
        render();
      } else if (phase === 'endpoint') {
        // Show angle preview: baseline is locked, third point follows cursor
        const startPoint = currentElement.points[0];
        const center = currentElement.points[1];
        
        const baselineAngle = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);
        const endpointAngle = Math.atan2(clippedPoint.y - center.y, clippedPoint.x - center.x);
        
        let angleDiff = endpointAngle - baselineAngle;
        if (angleDiff < 0) {
          angleDiff += 2 * Math.PI;
        }

        const updatedElement = {
          ...currentElement,
          points: [startPoint, center, clippedPoint],
          measurements: {
            angle: angleDiff
          }
        };
        setCurrentElement(updatedElement);
        render();
      }
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
    };
  }, [canvasRef, getCanvasPoint, clipToPageBounds, getPageAtPoint, isDrawing, setIsDrawing, currentElement, setCurrentElement, render, state.toolSettings.angle, state.currentLayerId, state.elements, state.layers, dispatch, phase]);

  // Reset phase when tool changes
  useEffect(() => {
    if (state.currentTool !== 'angle') {
      setPhase('start');
      setCurrentElement(null);
      setIsDrawing(false);
    }
  }, [state.currentTool, setCurrentElement, setIsDrawing]);

  // Escape key to cancel angle drawing mid-way
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase !== 'start') {
        setPhase('start');
        setCurrentElement(null);
        setIsDrawing(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, setCurrentElement, setIsDrawing]);

  return null;
}