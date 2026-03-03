import type { SpatialRect } from '../utils/spatialIndex';

export type RenderInvalidation =
  | { kind: 'full' }
  | { kind: 'dirty'; rect: SpatialRect };

export const FULL_RENDER: RenderInvalidation = { kind: 'full' };

export function dirtyRender(rect: SpatialRect): RenderInvalidation {
  return { kind: 'dirty', rect };
}

export interface CanvasRendererBridge {
  requestRender: (invalidation?: RenderInvalidation) => void;
  flushRender: () => void;
  dispose: () => void;
}
