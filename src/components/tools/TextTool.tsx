import React, { useEffect, useState } from 'react';
import { useDrawingContext, Point, DrawingElement } from '../../context/DrawingContext';

interface TextToolProps {
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

export function TextTool({
  canvasRef,
  getCanvasPoint,
  clipToPageBounds,
  getPageAtPoint,
  render,
}: TextToolProps) {
  const { state, dispatch } = useDrawingContext();
  const [textInput, setTextInput] = useState('');
  const [inputPosition, setInputPosition] = useState<Point | null>(null);
  const [showInput, setShowInput] = useState(false);
  const [canvasRect, setCanvasRect] = useState<DOMRect | null>(null);

  // Update canvas rect when component mounts or canvas changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const updateRect = () => {
        setCanvasRect(canvas.getBoundingClientRect());
      };
      updateRect();
      window.addEventListener('resize', updateRect);
      return () => window.removeEventListener('resize', updateRect);
    }
  }, [canvasRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handlePointerDown = (e: PointerEvent) => {
      // In pencil mode, only allow pen pointers for drawing
      if (state.pencilMode && e.pointerType === 'touch') {
        return;
      }

      e.preventDefault();
      const point = getCanvasPoint(e);
      
      // Only allow text placement within page bounds
      if (!getPageAtPoint(point)) return;
      
      const clippedPoint = clipToPageBounds(point);
      
      const rect = canvas.getBoundingClientRect();
      const screenX = rect.left + (clippedPoint.x + state.panOffset.x) * state.zoom;
      const screenY = rect.top + (clippedPoint.y + state.panOffset.y) * state.zoom;
      
      setInputPosition({ x: screenX, y: screenY });
      setShowInput(true);
      setTextInput('');
    };

    if (state.currentTool === 'text') {
      canvas.addEventListener('pointerdown', handlePointerDown);
    }

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [canvasRef, getCanvasPoint, clipToPageBounds, getPageAtPoint, state.currentTool, state.pencilMode, state.panOffset, state.zoom]);

  const handleTextSubmit = () => {
    if (textInput.trim() && inputPosition && canvasRect) {
      // Convert screen position back to canvas coordinates
      const canvasX = (inputPosition.x - canvasRect.left) / state.zoom - state.panOffset.x;
      const canvasY = (inputPosition.y - canvasRect.top) / state.zoom - state.panOffset.y;
      
      const newElement: DrawingElement = {
        id: `text-${Date.now()}`,
        type: 'text',
        points: [{ x: canvasX, y: canvasY }],
        style: {
          strokeColor: state.toolSettings.text.strokeColor,
          strokeWidth: 1,
        },
        layerId: state.currentLayerId,
        text: textInput.trim(),
        fontSize: state.toolSettings.text.fontSize,
      };

      dispatch({ type: 'ADD_ELEMENT', element: newElement });
      render();
    }
    
    setShowInput(false);
    setTextInput('');
    setInputPosition(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTextSubmit();
    } else if (e.key === 'Escape') {
      setShowInput(false);
      setTextInput('');
      setInputPosition(null);
    }
  };

  const handleBlur = () => {
    // Small delay to allow for potential click events
    setTimeout(() => {
      handleTextSubmit();
    }, 100);
  };

  return (
    <>
      {showInput && inputPosition && (
        <div
          className="fixed z-50 pointer-events-auto"
          style={{
            left: `${inputPosition.x}px`,
            top: `${inputPosition.y}px`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className="px-2 py-1 bg-white text-black border border-gray-400 rounded text-sm focus:outline-none focus:border-blue-500 shadow-lg"
            style={{ 
              fontSize: `${state.toolSettings.text.fontSize}px`,
              minWidth: '100px'
            }}
            placeholder="Enter text..."
            autoFocus
          />
        </div>
      )}
    </>
  );
}