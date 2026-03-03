import React from 'react';

export function CanvasOverlays() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {/* Overlays are now handled dynamically in DrawingCanvas */}
    </div>
  );
}
