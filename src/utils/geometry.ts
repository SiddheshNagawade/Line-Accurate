import { Point } from '../context/DrawingContext';

/**
 * Check whether a point is within `threshold` pixels of a line segment.
 */
export function isPointNearLine(
  point: Point,
  lineStart: Point,
  lineEnd: Point,
  threshold = 5,
): boolean {
  return distPointToSegment(point, lineStart, lineEnd) <= threshold;
}

/**
 * Compute the perpendicular distance from a point to a line segment.
 */
export function distPointToSegment(
  point: Point,
  segA: Point,
  segB: Point,
): number {
  const A = point.x - segA.x;
  const B = point.y - segA.y;
  const C = segB.x - segA.x;
  const D = segB.y - segA.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;

  if (lenSq === 0) return Math.hypot(A, B);

  const param = Math.max(0, Math.min(1, dot / lenSq));
  const projX = segA.x + param * C;
  const projY = segA.y + param * D;

  return Math.hypot(point.x - projX, point.y - projY);
}
