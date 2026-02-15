import { DrawingElement } from '../context/DrawingContext';

export type SerializedProject = DrawingElement[];

export function serializeDrawing(elements: DrawingElement[]): string {
  return JSON.stringify(elements);
}

export function deserializeDrawing(json: string): SerializedProject {
  const data = JSON.parse(json);
  if (!Array.isArray(data)) {
    throw new Error('Invalid format: root is not an array');
  }
  data.forEach((el, idx) => {
    if (typeof el !== 'object' || el === null) {
      throw new Error(`Invalid element at index ${idx}`);
    }
    if (typeof el.id !== 'string') throw new Error(`Missing id at index ${idx}`);
    if (!['line', 'angle', 'freehand', 'text', 'image'].includes(el.type)) {
      throw new Error(`Invalid type at index ${idx}`);
    }
    if (!Array.isArray(el.points)) throw new Error(`Missing points at index ${idx}`);
    el.points.forEach((p: any, pIdx: number) => {
      if (typeof p !== 'object' || p === null || typeof p.x !== 'number' || typeof p.y !== 'number') {
        throw new Error(`Invalid point at element ${idx}, point ${pIdx}`);
      }
    });
    if (!el.style || typeof el.style.strokeColor !== 'string' || typeof el.style.strokeWidth !== 'number') {
      throw new Error(`Invalid style at index ${idx}`);
    }
    if (typeof el.layerId !== 'string') throw new Error(`Missing layerId at index ${idx}`);
  });
  return data as SerializedProject;
}

export function downloadBlob(content: string | Blob, filename: string, type = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCanvasToPNG(canvas: HTMLCanvasElement, filename = 'drawing.png') {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export function exportCanvasToSVG(width: number, height: number): string {
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"></svg>`;
}

