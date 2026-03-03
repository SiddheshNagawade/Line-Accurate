import React, { createContext, useContext, useReducer, useLayoutEffect, useEffect, useRef, ReactNode, useState, useMemo, useCallback, useSyncExternalStore } from 'react';

export type Tool = 'select' | 'line' | 'angle' | 'freehand' | 'eraser' | 'text';
export type Units = 'mm' | 'cm' | 'in' | 'ft';

// A4 dimensions in mm
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const MM_TO_PX = 3.779527559; // 96 DPI conversion
export const PAGE_MARGIN = 20; // Margin between pages in pixels

export interface Point {
  x: number;
  y: number;
}

export interface DrawingElement {
  id: string;
  type: 'line' | 'angle' | 'freehand' | 'text' | 'image';
  points: Point[];
  style: {
    strokeColor: string;
    strokeWidth: number;
    fillColor?: string;
  };
  layerId: string;
  text?: string;
  fontSize?: number;
  measurements?: {
    length?: number;
    radius?: number;
    angle?: number;
  };
  selected?: boolean;
  // Image-specific properties
  imageSrc?: string;
  imageWidth?: number;
  imageHeight?: number;
  // Angle-specific properties
  selectedAngleSide?: 'primary' | 'secondary' | null; // null shows both at 25% opacity
  // Measurement label offset (px): for lines = perpendicular distance, for angles = label radius from vertex
  labelOffset?: number;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  color: string;
}

export interface ToolSettings {
  line: { strokeWidth: number; strokeColor: string };
  angle: { strokeWidth: number; strokeColor: string };
  freehand: { strokeWidth: number; strokeColor: string };
  text: { fontSize: number; strokeColor: string };
  eraser: { strokeWidth: number };
}

export interface DrawingState {
  currentTool: Tool;
  elements: DrawingElement[];
  selectedElementIds: string[];
  layers: Layer[];
  currentLayerId: string;
  gridSize: number;
  gridVisible: boolean;
  snapToGrid: boolean;
  units: Units;
  zoom: number;
  panOffset: Point;
  history: { elements: DrawingElement[]; totalPages: number }[];
  historyIndex: number;
  toolSettings: ToolSettings;
  isDragging: boolean;
  dragStart: Point | null;
  editingElement: string | null;
  snapThreshold: number;
  currentPage: number;
  totalPages: number;
  bookmarkedPages: Set<number>;
  pageWidth: number; // A4 width in pixels
  pageHeight: number; // A4 height in pixels
  minZoom: number; // dynamically computed lower bound for zoom based on viewport/content
  selectionRect: { x: number; y: number; w: number; h: number } | null; // marquee selection rectangle
  pencilMode: boolean; // When true, only stylus/pen touches draw; fingers pan/scroll. When false, both can draw.
}

type DrawingAction =
  | { type: 'SET_TOOL'; tool: Tool }
  | { type: 'ADD_ELEMENT'; element: DrawingElement }
  | { type: 'UPDATE_ELEMENT'; id: string; element: Partial<DrawingElement> }
  | { type: 'DELETE_ELEMENTS'; ids: string[] }
  | { type: 'SELECT_ELEMENTS'; ids: string[] }
  | { type: 'REPLACE_ELEMENTS'; elements: DrawingElement[] }
  | { type: 'SET_GRID_SIZE'; size: number }
  | { type: 'TOGGLE_GRID'; visible?: boolean }
  | { type: 'TOGGLE_SNAP'; snap?: boolean }
  | { type: 'SET_UNITS'; units: Units }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'SET_PAN'; offset: Point }
  | { type: 'SET_ZOOM_PAN'; zoom: number; offset: Point }
  | { type: 'ADD_LAYER'; layer: Layer }
  | { type: 'UPDATE_LAYER'; id: string; layer: Partial<Layer> }
  | { type: 'DELETE_LAYER'; id: string }
  | { type: 'SET_CURRENT_LAYER'; id: string }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SAVE_STATE' }
  | { type: 'UPDATE_TOOL_SETTINGS'; tool: keyof ToolSettings; settings: Partial<ToolSettings[keyof ToolSettings]> }
  | { type: 'SET_DRAGGING'; isDragging: boolean; dragStart?: Point | null }
  | { type: 'SET_EDITING_ELEMENT'; id: string | null }
  | { type: 'SET_CURRENT_PAGE'; page: number }
  | { type: 'ADD_PAGE' }
  | { type: 'DELETE_PAGE'; page: number }
  | { type: 'DUPLICATE_PAGE'; page: number }
  | { type: 'REORDER_PAGES'; fromIndex: number; toIndex: number }
  | { type: 'BOOKMARK_PAGE'; page: number }
  | { type: 'SET_MIN_ZOOM'; minZoom: number }
  | { type: 'SET_SELECTION_RECT'; rect: { x: number; y: number; w: number; h: number } | null }
  | { type: 'UPDATE_ELEMENTS_BULK'; ids: string[]; changes: Partial<DrawingElement> }
  | { type: 'TOGGLE_PENCIL_MODE'; };

const initialState: DrawingState = {
  currentTool: 'select',
  elements: [],
  selectedElementIds: [],
  layers: [
    { id: 'layer-1', name: 'Layer 1', visible: true, locked: false, color: '#ffffff' },
    { id: 'layer-2', name: 'Dimensions', visible: true, locked: false, color: '#00ff00' },
    { id: 'layer-3', name: 'Construction', visible: true, locked: false, color: '#ffff00' }
  ],
  currentLayerId: 'layer-1',
  gridSize: 10,
  gridVisible: true,
  snapToGrid: true,
  units: 'mm',
  zoom: 1.0, // Start at 100% zoom
  panOffset: { x: 0, y: 0 },
  history: [{ elements: [], totalPages: 1 }],
  historyIndex: 0,
  toolSettings: {
    line: { strokeWidth: 2, strokeColor: '#ffffff' },
    angle: { strokeWidth: 2, strokeColor: '#00ff00' },
    freehand: { strokeWidth: 2, strokeColor: '#ffffff' },
    text: { fontSize: 14, strokeColor: '#ffffff' },
    eraser: { strokeWidth: 10 },
  },
  isDragging: false,
  dragStart: null,
  editingElement: null,
  snapThreshold: 7,
  currentPage: 1,
  totalPages: 1,
  bookmarkedPages: new Set<number>(),
  pageWidth: Math.round(A4_WIDTH_MM * MM_TO_PX), // 794 pixels
  pageHeight: Math.round(A4_HEIGHT_MM * MM_TO_PX), // 1123 pixels
  minZoom: 0.5,
  selectionRect: null,
  pencilMode: false, // iPad pencil/stylus mode - default off
};

function drawingReducer(state: DrawingState, action: DrawingAction): DrawingState {
  switch (action.type) {
    case 'SET_TOOL':
      return { ...state, currentTool: action.tool, selectedElementIds: [], editingElement: null };
    
    case 'ADD_ELEMENT':
      const newElements = [...state.elements, action.element];
      return {
        ...state,
        elements: newElements,
        history: [...state.history.slice(0, state.historyIndex + 1), { elements: newElements, totalPages: state.totalPages }],
        historyIndex: state.historyIndex + 1,
      };
    
    case 'UPDATE_ELEMENT':
      const updatedElements = state.elements.map(el =>
        el.id === action.id ? { ...el, ...action.element } : el
      );
      return { ...state, elements: updatedElements };
    
    case 'DELETE_ELEMENTS':
      const filteredElements = state.elements.filter(el => !action.ids.includes(el.id));
      return {
        ...state,
        elements: filteredElements,
        selectedElementIds: [],
        history: [...state.history.slice(0, state.historyIndex + 1), { elements: filteredElements, totalPages: state.totalPages }],
        historyIndex: state.historyIndex + 1,
      };
    
    case 'REPLACE_ELEMENTS': {
      const next = action.elements;
      // Auto-detect how many pages are needed based on element positions
      const CANVAS_PADDING = 50;
      const pageH = state.pageHeight;
      const pagePlusMargin = pageH + PAGE_MARGIN;
      let maxPage = 1;
      next.forEach(el => {
        if (el.points && el.points.length > 0) {
          el.points.forEach(pt => {
            const pageNum = Math.floor((pt.y - CANVAS_PADDING) / pagePlusMargin) + 1;
            if (pageNum > maxPage) maxPage = pageNum;
          });
        }
      });
      const requiredPages = Math.max(state.totalPages, maxPage);
      return {
        ...state,
        elements: next,
        totalPages: requiredPages,
        selectedElementIds: [],
        history: [...state.history.slice(0, state.historyIndex + 1), { elements: next, totalPages: requiredPages }],
        historyIndex: state.historyIndex + 1,
      };
    }
    
    case 'SELECT_ELEMENTS':
      return { ...state, selectedElementIds: action.ids };
    
    case 'SET_GRID_SIZE':
      return { ...state, gridSize: Math.max(1, action.size) };
    
    case 'TOGGLE_GRID':
      return { ...state, gridVisible: action.visible ?? !state.gridVisible };
    
    case 'TOGGLE_SNAP':
      return { ...state, snapToGrid: action.snap ?? !state.snapToGrid };
    
    case 'SET_UNITS':
      return { ...state, units: action.units };
    
    case 'SET_ZOOM':
      return { ...state, zoom: Math.max(state.minZoom, Math.min(3, action.zoom)) };
    
    case 'SET_PAN':
      return { ...state, panOffset: action.offset };

    case 'SET_ZOOM_PAN':
      return { ...state, zoom: Math.max(state.minZoom, Math.min(3, action.zoom)), panOffset: action.offset };
    
    case 'ADD_LAYER':
      return { ...state, layers: [...state.layers, action.layer] };
    
    case 'UPDATE_LAYER':
      return {
        ...state,
        layers: state.layers.map(layer =>
          layer.id === action.id ? { ...layer, ...action.layer } : layer
        ),
      };
    
    case 'DELETE_LAYER': {
      if (state.layers.length <= 1) return state;
      const layers = state.layers.filter(l => l.id !== action.id);
      const currentLayerId = state.currentLayerId === action.id ? layers[0].id : state.currentLayerId;
      // Remove any selected elements on deleted layer
      const elements = state.elements.filter(el => el.layerId !== action.id);
      return { ...state, layers, currentLayerId, elements };
    }
    
    case 'SET_CURRENT_LAYER':
      return { ...state, currentLayerId: action.id };
    
    case 'UNDO':
      if (state.historyIndex > 0) {
        const prev = state.history[state.historyIndex - 1];
        return {
          ...state,
          elements: prev.elements,
          totalPages: prev.totalPages,
          currentPage: Math.min(state.currentPage, prev.totalPages),
          historyIndex: state.historyIndex - 1,
          selectedElementIds: [],
        };
      }
      return state;
    
    case 'REDO':
      if (state.historyIndex < state.history.length - 1) {
        const next = state.history[state.historyIndex + 1];
        return {
          ...state,
          elements: next.elements,
          totalPages: next.totalPages,
          currentPage: Math.min(state.currentPage, next.totalPages),
          historyIndex: state.historyIndex + 1,
          selectedElementIds: [],
        };
      }
      return state;
    
    case 'SAVE_STATE':
      return {
        ...state,
        history: [...state.history.slice(0, state.historyIndex + 1), { elements: state.elements, totalPages: state.totalPages }],
        historyIndex: state.historyIndex + 1,
      };

    case 'UPDATE_TOOL_SETTINGS':
      return {
        ...state,
        toolSettings: {
          ...state.toolSettings,
          [action.tool]: {
            ...state.toolSettings[action.tool],
            ...action.settings,
          },
        },
      };

    case 'SET_DRAGGING':
      return { 
        ...state, 
        isDragging: action.isDragging,
        dragStart: action.dragStart !== undefined ? action.dragStart : state.dragStart
      };

    case 'SET_EDITING_ELEMENT':
      return { ...state, editingElement: action.id };
    
    case 'SET_CURRENT_PAGE':
      return { ...state, currentPage: Math.max(1, Math.min(action.page, state.totalPages)) };
    
    case 'ADD_PAGE': {
      const addedTotal = state.totalPages + 1;
      return { 
        ...state, 
        totalPages: addedTotal,
        currentPage: addedTotal,
        history: [...state.history.slice(0, state.historyIndex + 1), { elements: state.elements, totalPages: addedTotal }],
        historyIndex: state.historyIndex + 1,
      };
    }
    
    case 'DELETE_PAGE': {
      if (state.totalPages <= 1) return state;
      const delTotal = state.totalPages - 1;
      const delCurrent = action.page <= state.currentPage && state.currentPage > 1 
        ? state.currentPage - 1 
        : state.currentPage > delTotal 
        ? delTotal 
        : state.currentPage;
      // Update bookmarks: remove the deleted page, shift down pages above it
      const delBookmarks = new Set<number>();
      state.bookmarkedPages.forEach(p => {
        if (p < action.page) delBookmarks.add(p);
        else if (p > action.page) delBookmarks.add(p - 1);
        // p === action.page is removed
      });
      return { 
        ...state, 
        totalPages: delTotal,
        currentPage: delCurrent,
        bookmarkedPages: delBookmarks,
        history: [...state.history.slice(0, state.historyIndex + 1), { elements: state.elements, totalPages: delTotal }],
        historyIndex: state.historyIndex + 1,
      };
    }

    case 'DUPLICATE_PAGE': {
      const dupTotal = state.totalPages + 1;
      // Insert after the duplicated page
      const dupCurrent = action.page + 1;
      // Shift bookmarks: pages after the insertion point move up by 1
      const dupBookmarks = new Set<number>();
      state.bookmarkedPages.forEach(p => {
        if (p <= action.page) dupBookmarks.add(p);
        else dupBookmarks.add(p + 1);
      });
      return {
        ...state,
        totalPages: dupTotal,
        currentPage: dupCurrent,
        bookmarkedPages: dupBookmarks,
        history: [...state.history.slice(0, state.historyIndex + 1), { elements: state.elements, totalPages: dupTotal }],
        historyIndex: state.historyIndex + 1,
      };
    }

    case 'REORDER_PAGES': {
      const { fromIndex, toIndex } = action;
      if (fromIndex === toIndex) return state;
      const fromPage = fromIndex + 1;
      const toPage = toIndex + 1;
      // Remap bookmarks to follow the moved page
      const reorderBookmarks = new Set<number>();
      state.bookmarkedPages.forEach(p => {
        if (p === fromPage) {
          reorderBookmarks.add(toPage);
        } else if (fromIndex < toIndex) {
          // Moving forward: pages between (from+1..to) shift down by 1
          if (p > fromPage && p <= toPage) reorderBookmarks.add(p - 1);
          else reorderBookmarks.add(p);
        } else {
          // Moving backward: pages between (to..from-1) shift up by 1
          if (p >= toPage && p < fromPage) reorderBookmarks.add(p + 1);
          else reorderBookmarks.add(p);
        }
      });
      // Update currentPage if it was the moved page
      let reorderCurrent = state.currentPage;
      if (state.currentPage === fromPage) {
        reorderCurrent = toPage;
      } else if (fromIndex < toIndex) {
        if (state.currentPage > fromPage && state.currentPage <= toPage) reorderCurrent = state.currentPage - 1;
      } else {
        if (state.currentPage >= toPage && state.currentPage < fromPage) reorderCurrent = state.currentPage + 1;
      }
      return {
        ...state,
        currentPage: reorderCurrent,
        bookmarkedPages: reorderBookmarks,
      };
    }

    case 'BOOKMARK_PAGE': {
      const bmPages = new Set(state.bookmarkedPages);
      if (bmPages.has(action.page)) {
        bmPages.delete(action.page);
      } else {
        bmPages.add(action.page);
      }
      return { ...state, bookmarkedPages: bmPages };
    }

    case 'SET_SELECTION_RECT':
      return { ...state, selectionRect: action.rect };

    case 'UPDATE_ELEMENTS_BULK': {
      const styleChanges = action.changes.style;
      const otherChanges = { ...action.changes };
      delete otherChanges.style;
      const bulkUpdated = state.elements.map(el =>
        action.ids.includes(el.id)
          ? { ...el, ...otherChanges, style: { ...el.style, ...(styleChanges || {}) } }
          : el
      );
      return { ...state, elements: bulkUpdated };
    }

    case 'SET_MIN_ZOOM':
      return { ...state, minZoom: Math.min(1, Math.max(0.1, action.minZoom)) };

    case 'TOGGLE_PENCIL_MODE':
      return { ...state, pencilMode: !state.pencilMode };
    
    default:
      return state;
  }
}

export type SaveStatus = 'unsaved';

const DrawingContext = createContext<{
  state: DrawingState;
  dispatch: React.Dispatch<DrawingAction>;
  saveStatus: SaveStatus;
  lastSaveTime: number | null;
} | null>(null);

// ---------------------------------------------------------------------------
// Selector store — exposes a lightweight subscribe/getState API so panel
// components can subscribe to slices of DrawingState without re-rendering on
// every high-frequency dispatch (pan, zoom, pointer-move, etc.).
// ---------------------------------------------------------------------------
interface DrawingStore {
  getState: () => DrawingState;
  subscribe: (listener: () => void) => () => void;
  dispatch: React.Dispatch<DrawingAction>;
}
const DrawingStoreContext = createContext<DrawingStore | null>(null);

export function DrawingContextProvider({ children, projectId }: { children: ReactNode; projectId?: string }) {
  const [state, dispatch] = useReducer(drawingReducer, initialState);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('unsaved');
  const [lastSaveTime, setLastSaveTime] = useState<number | null>(null);

  // --- Selector store wiring ---
  const stateRef = useRef<DrawingState>(state);
  const listenersRef = useRef<Set<() => void>>(new Set());

  // Synchronously update stateRef and notify subscribers after every state
  // change, before the browser paints, so getSnapshot() never returns stale data.
  useLayoutEffect(() => {
    stateRef.current = state;
    listenersRef.current.forEach(l => l());
  }, [state]);

  const store = useMemo<DrawingStore>(() => ({
    getState: () => stateRef.current,
    subscribe: (listener) => {
      listenersRef.current.add(listener);
      return () => listenersRef.current.delete(listener);
    },
    dispatch,
  }), [dispatch]);

  // Warn before leaving/refreshing if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.elements.length > 0) {
        e.preventDefault();
        e.returnValue = 'You have unsaved work. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.elements.length]);

  const contextValue = useMemo(
    () => ({ state, dispatch, saveStatus, lastSaveTime }),
    [state, dispatch, saveStatus, lastSaveTime],
  );

  return (
    <DrawingStoreContext.Provider value={store}>
      <DrawingContext.Provider value={contextValue}>
        {children}
      </DrawingContext.Provider>
    </DrawingStoreContext.Provider>
  );
}

export function useDrawingContext() {
  const context = useContext(DrawingContext);
  if (!context) {
    throw new Error('useDrawingContext must be used within a DrawingContextProvider');
  }
  return context;
}

/**
 * Subscribe to a slice of DrawingState. The component only re-renders when
 * the selected value changes by reference (===). For primitives this is
 * automatic; for derived objects, keep the selector referentially stable.
 *
 * @example
 *   const currentTool = useDrawingSelector(s => s.currentTool);
 *   const layers = useDrawingSelector(s => s.layers);
 */
export function useDrawingSelector<T>(selector: (s: DrawingState) => T): T {
  const store = useContext(DrawingStoreContext);
  if (!store) throw new Error('useDrawingSelector must be used within DrawingContextProvider');

  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  // Cache the last result keyed by state reference. If the state object hasn't
  // changed, return the exact same result reference so useSyncExternalStore
  // won't trigger a re-render.
  const cacheRef = useRef<{ state: DrawingState; result: T } | null>(null);

  const getSnapshot = useCallback((): T => {
    const s = store.getState();
    const c = cacheRef.current;
    if (c && c.state === s) return c.result;
    const result = selectorRef.current(s);
    cacheRef.current = { state: s, result };
    return result;
  }, [store]);

  return useSyncExternalStore(store.subscribe, getSnapshot);
}

/** Get the dispatch function without subscribing to any state. */
export function useDrawingDispatch(): React.Dispatch<DrawingAction> {
  const store = useContext(DrawingStoreContext);
  if (!store) throw new Error('useDrawingDispatch must be used within DrawingContextProvider');
  return store.dispatch;
}