import React from 'react';
import { useDrawingContext } from '../context/DrawingContext';
import { FileText } from 'lucide-react';

export function CanvasOverlays() {
  const { state } = useDrawingContext();

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {/* Bottom Left: Instructions */}
      <div className="absolute bottom-4 left-4 pointer-events-auto">
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

      {/* Bottom Right: Page Counter */}
      <div className="absolute bottom-4 right-4 pointer-events-auto">
           <div className="bg-black/80 backdrop-blur-md text-white/90 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 shadow-lg flex items-center space-x-2">
              <FileText size={12} className="text-white/60" />
              <span>{state.totalPages} Page{state.totalPages !== 1 ? 's' : ''}</span>
           </div>
      </div>
    </div>
  );
}
