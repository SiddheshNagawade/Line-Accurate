// IndexedDB-based auto-save for drawing data
// Stores full drawing state including images (base64) which can exceed localStorage limits
// Data persists until explicitly cleared or browser storage is purged

const DB_NAME = 'LineAccurateDB';
const DB_VERSION = 1;
const STORE_NAME = 'autosave';
const DEFAULT_SAVE_KEY = 'current_project';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 day TTL (per-project data should persist longer)

export interface AutoSaveData {
  elements: any[];
  layers: any[];
  currentLayerId: string;
  totalPages: number;
  currentPage: number;
  projectName: string;
  toolSettings: any;
  gridSize: number;
  gridVisible: boolean;
  snapToGrid: boolean;
  units: string;
  timestamp: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveToCache(data: AutoSaveData, projectId?: string): Promise<void> {
  const key = projectId ? `project_${projectId}` : DEFAULT_SAVE_KEY;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ ...data, timestamp: Date.now() }, key);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('[AutoSave] Failed to save to IndexedDB:', err);
    // Fallback: try localStorage (may fail for large images)
    try {
      localStorage.setItem(
        `lineaccurate_autosave_${key}`,
        JSON.stringify({ ...data, timestamp: Date.now() })
      );
    } catch {
      console.warn('[AutoSave] localStorage fallback also failed');
    }
  }
}

export async function loadFromCache(projectId?: string): Promise<AutoSaveData | null> {
  const key = projectId ? `project_${projectId}` : DEFAULT_SAVE_KEY;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);
    const result = await new Promise<AutoSaveData | null>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
    db.close();

    if (result) {
      // Check TTL
      const age = Date.now() - (result.timestamp || 0);
      if (age > TTL_MS) {
        console.info('[AutoSave] Cache expired, clearing');
        await clearCache();
        return null;
      }
      return result;
    }
    return null;
  } catch (err) {
    console.warn('[AutoSave] Failed to load from IndexedDB:', err);
    // Fallback: try localStorage
    try {
      const raw = localStorage.getItem(`lineaccurate_autosave_${key}`);
      if (raw) {
        const data = JSON.parse(raw) as AutoSaveData;
        const age = Date.now() - (data.timestamp || 0);
        if (age > TTL_MS) {
          localStorage.removeItem(`lineaccurate_autosave_${key}`);
          return null;
        }
        return data;
      }
    } catch {
      // ignore
    }
    return null;
  }
}

export async function clearCache(projectId?: string): Promise<void> {
  const key = projectId ? `project_${projectId}` : DEFAULT_SAVE_KEY;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(key);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('[AutoSave] Failed to clear IndexedDB:', err);
  }
  try {
    localStorage.removeItem(`lineaccurate_autosave_${key}`);
  } catch {
    // ignore
  }
}

export function getTimeSinceString(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
