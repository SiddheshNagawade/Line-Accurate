import { Point } from '../context/DrawingContext';

export function snapToGrid(point: Point, _gridSize: number): Point {
  void _gridSize;
  // Always snap to 1mm grid regardless of gridSize parameter
  const mmToPx = 3.779527559;
  const gridSizePx = mmToPx; // Fixed 1mm grid
  return {
    x: Math.round(point.x / gridSizePx) * gridSizePx,
    y: Math.round(point.y / gridSizePx) * gridSizePx,
  };
}