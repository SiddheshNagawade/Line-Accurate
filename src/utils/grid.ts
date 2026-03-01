import { Point } from '../context/DrawingContext';

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  gridSize: number, // This parameter is kept for compatibility but we use fixed 1mm grid
  canvasBackground: string = '#2a2a2a'
) {
  ctx.save();
  
  // Grid colors for better visibility
  const isLightBackground = canvasBackground === '#ffffff' || canvasBackground === '#f0f0f0' || canvasBackground === '#2a2a2a';
  const minorGridColor = isLightBackground ? '#e8e8e8' : '#404040';
  const majorGridColor = isLightBackground ? '#d0d0d0' : '#606060';
  
  // 1mm grid size (3.779527559 pixels at 96 DPI)
  const mmToPx = 3.779527559;
  const gridSizePx = mmToPx; // 1mm grid

  // Draw minor grid lines (1mm)
  ctx.strokeStyle = minorGridColor;
  ctx.lineWidth = 0.5;
  ctx.setLineDash([]);


  // Draw vertical lines
  for (let x = 0; x <= width; x += gridSizePx) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Draw horizontal lines
  for (let y = 0; y <= height; y += gridSizePx) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Draw major grid lines every 10 units
  ctx.strokeStyle = majorGridColor;
  ctx.lineWidth = 1;

  // Draw major vertical lines (every 10mm)
  for (let x = 0; x <= width; x += gridSizePx * 10) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Draw major horizontal lines (every 10mm)
  for (let y = 0; y <= height; y += gridSizePx * 10) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.restore();
}

export function snapToGrid(point: Point, gridSize: number): Point {
  // Always snap to 1mm grid regardless of gridSize parameter
  const mmToPx = 3.779527559;
  const gridSizePx = mmToPx; // Fixed 1mm grid
  return {
    x: Math.round(point.x / gridSizePx) * gridSizePx,
    y: Math.round(point.y / gridSizePx) * gridSizePx,
  };
}