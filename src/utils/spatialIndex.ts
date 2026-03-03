import { DrawingElement } from '../context/DrawingContext';

export interface SpatialRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SpatialItem<T> {
  bounds: SpatialRect;
  data: T;
}

export function intersectsRect(a: SpatialRect, b: SpatialRect): boolean {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

export function expandRect(rect: SpatialRect, padding: number): SpatialRect {
  return {
    minX: rect.minX - padding,
    minY: rect.minY - padding,
    maxX: rect.maxX + padding,
    maxY: rect.maxY + padding,
  };
}

export function pointRect(x: number, y: number, radius: number): SpatialRect {
  return {
    minX: x - radius,
    minY: y - radius,
    maxX: x + radius,
    maxY: y + radius,
  };
}

export function getElementBounds(element: DrawingElement, extraPad = 0): SpatialRect | null {
  if (!element.points.length) return null;

  if (element.type === 'image' && element.imageWidth && element.imageHeight) {
    return expandRect(
      {
        minX: element.points[0].x,
        minY: element.points[0].y,
        maxX: element.points[0].x + element.imageWidth,
        maxY: element.points[0].y + element.imageHeight,
      },
      extraPad
    );
  }

  if (element.type === 'text' && element.text) {
    const fontSize = element.fontSize || 14;
    const textWidth = element.text.length * fontSize * 0.6;
    return expandRect(
      {
        minX: element.points[0].x,
        minY: element.points[0].y,
        maxX: element.points[0].x + textWidth,
        maxY: element.points[0].y + fontSize,
      },
      extraPad
    );
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of element.points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }

  const pad = (element.style?.strokeWidth || 1) / 2 + 2 + extraPad;
  return {
    minX: minX - pad,
    minY: minY - pad,
    maxX: maxX + pad,
    maxY: maxY + pad,
  };
}

class QuadNode<T> {
  bounds: SpatialRect;
  items: Array<SpatialItem<T>> = [];
  children: QuadNode<T>[] | null = null;
  depth: number;
  capacity: number;
  maxDepth: number;

  constructor(bounds: SpatialRect, depth: number, capacity: number, maxDepth: number) {
    this.bounds = bounds;
    this.depth = depth;
    this.capacity = capacity;
    this.maxDepth = maxDepth;
  }

  insert(item: SpatialItem<T>) {
    if (!intersectsRect(this.bounds, item.bounds)) return;

    if (!this.children && (this.items.length < this.capacity || this.depth >= this.maxDepth)) {
      this.items.push(item);
      return;
    }

    if (!this.children) {
      this.subdivide();
      const currentItems = this.items;
      this.items = [];
      for (const existing of currentItems) {
        this.insertIntoChildren(existing);
      }
    }

    this.insertIntoChildren(item);
  }

  query(area: SpatialRect, out: Array<SpatialItem<T>>) {
    if (!intersectsRect(this.bounds, area)) return;

    for (const item of this.items) {
      if (intersectsRect(item.bounds, area)) out.push(item);
    }

    if (this.children) {
      for (const child of this.children) child.query(area, out);
    }
  }

  private subdivide() {
    const { minX, minY, maxX, maxY } = this.bounds;
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const d = this.depth + 1;

    this.children = [
      new QuadNode<T>({ minX, minY, maxX: midX, maxY: midY }, d, this.capacity, this.maxDepth),
      new QuadNode<T>({ minX: midX, minY, maxX, maxY: midY }, d, this.capacity, this.maxDepth),
      new QuadNode<T>({ minX, minY: midY, maxX: midX, maxY }, d, this.capacity, this.maxDepth),
      new QuadNode<T>({ minX: midX, minY: midY, maxX, maxY }, d, this.capacity, this.maxDepth),
    ];
  }

  private insertIntoChildren(item: SpatialItem<T>) {
    if (!this.children) return;
    for (const child of this.children) {
      if (intersectsRect(child.bounds, item.bounds)) {
        child.insert(item);
      }
    }
  }
}

export class Quadtree<T> {
  private root: QuadNode<T> | null = null;

  constructor(items: Array<SpatialItem<T>>, capacity = 16, maxDepth = 8) {
    if (!items.length) return;
    const bounds = computeSceneBounds(items.map((item) => item.bounds));
    this.root = new QuadNode<T>(bounds, 0, capacity, maxDepth);
    for (const item of items) {
      this.root.insert(item);
    }
  }

  query(area: SpatialRect): Array<SpatialItem<T>> {
    if (!this.root) return [];
    const out: Array<SpatialItem<T>> = [];
    this.root.query(area, out);
    return out;
  }
}

function computeSceneBounds(boundsList: SpatialRect[]): SpatialRect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const bounds of boundsList) {
    if (bounds.minX < minX) minX = bounds.minX;
    if (bounds.minY < minY) minY = bounds.minY;
    if (bounds.maxX > maxX) maxX = bounds.maxX;
    if (bounds.maxY > maxY) maxY = bounds.maxY;
  }

  return expandRect({ minX, minY, maxX, maxY }, 64);
}