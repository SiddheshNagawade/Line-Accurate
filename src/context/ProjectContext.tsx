import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useAuth } from './AuthContext';

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  thumbnail?: string;
}

interface ProjectContextType {
  projects: Project[];
  currentProject: Project | null;
  projectsHydrated: boolean;
  createProject: (name: string) => Project;
  deleteProject: (id: string) => void;
  selectProject: (id: string) => void;
  updateProjectName: (id: string, name: string) => void;
}

const STORAGE_KEY_PREFIX = 'lineaccurate_projects_';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface PersistedProjectsEnvelope {
  savedAt: number;
  projects: Project[];
}

function getStorageKey(username?: string): string | null {
  if (!username) return null;
  return `${STORAGE_KEY_PREFIX}${username.toLowerCase()}`;
}

function isProject(value: unknown): value is Project {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Project>;
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.createdAt === 'string' &&
    typeof item.updatedAt === 'string'
  );
}

function isProjectArray(value: unknown): value is Project[] {
  return Array.isArray(value) && value.every(isProject);
}

function createEnvelope(projects: Project[]): PersistedProjectsEnvelope {
  return {
    savedAt: Date.now(),
    projects,
  };
}

function loadProjectsFromStorage(storageKey: string | null): { projects: Project[]; needsMigration: boolean } {
  if (!storageKey) return { projects: [], needsMigration: false };

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { projects: [], needsMigration: false };

    const parsed = JSON.parse(raw) as unknown;

    // Legacy format migration support (plain array of projects).
    if (isProjectArray(parsed)) {
      return { projects: parsed, needsMigration: true };
    }

    if (
      parsed &&
      typeof parsed === 'object' &&
      'savedAt' in parsed &&
      'projects' in parsed
    ) {
      const envelope = parsed as PersistedProjectsEnvelope;
      if (typeof envelope.savedAt !== 'number' || !isProjectArray(envelope.projects)) {
        localStorage.removeItem(storageKey);
        return { projects: [], needsMigration: false };
      }

      if (Date.now() - envelope.savedAt > ONE_DAY_MS) {
        localStorage.removeItem(storageKey);
        return { projects: [], needsMigration: false };
      }

      return { projects: envelope.projects, needsMigration: false };
    }
  } catch {
    localStorage.removeItem(storageKey);
  }

  return { projects: [], needsMigration: false };
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const storageKey = getStorageKey(user?.username);

  useEffect(() => {
    localStorage.removeItem('lineaccurate_projects');
  }, []);

  // Lazy init — read from localStorage synchronously so the first render
  // already has the correct data (avoids the save-effect overwriting with [])
  const initialLoadRef = useRef<{ projects: Project[]; needsMigration: boolean } | null>(null);
  if (initialLoadRef.current === null) {
    initialLoadRef.current = loadProjectsFromStorage(storageKey);
  }
  const [projects, setProjects] = useState<Project[]>(() => initialLoadRef.current.projects);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projectsHydrated, setProjectsHydrated] = useState(true);
  const isInitialRender = useRef(true);
  const needsMigrationRef = useRef(initialLoadRef.current.needsMigration);

  // Reload account-scoped projects whenever logged-in user changes.
  useEffect(() => {
    setProjectsHydrated(false);
    const loaded = loadProjectsFromStorage(storageKey);
    setProjects(loaded.projects);
    setCurrentProject(null);
    isInitialRender.current = true;
    needsMigrationRef.current = loaded.needsMigration;
    setProjectsHydrated(true);
  }, [storageKey]);

  // Persist to localStorage whenever projects change (skip the very first render
  // to avoid overwriting during React 18 StrictMode double-mount)
  useEffect(() => {
    if (!storageKey) return;

    if (isInitialRender.current) {
      isInitialRender.current = false;

      if (needsMigrationRef.current) {
        localStorage.setItem(storageKey, JSON.stringify(createEnvelope(projects)));
        needsMigrationRef.current = false;
      }

      return;
    }

    localStorage.setItem(storageKey, JSON.stringify(createEnvelope(projects)));
  }, [projects, storageKey]);

  const createProject = (name: string): Project => {
    const newProject: Project = {
      id: `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setProjects([newProject, ...projects]);
    setCurrentProject(newProject);
    return newProject;
  };

  const deleteProject = (id: string) => {
    setProjects(projects.filter(p => p.id !== id));
    if (currentProject?.id === id) {
      setCurrentProject(null);
    }
  };

  const selectProject = (id: string) => {
    if (!id) {
      // Clear current project
      setCurrentProject(null);
      return;
    }
    const project = projects.find(p => p.id === id);
    if (project) {
      setCurrentProject(project);
    }
  };

  const updateProjectName = (id: string, name: string) => {
    setProjects(projects.map(p =>
      p.id === id ? { ...p, name, updatedAt: new Date().toISOString() } : p
    ));
    if (currentProject?.id === id) {
      setCurrentProject({ ...currentProject, name });
    }
  };

  return (
    <ProjectContext.Provider value={{ projects, currentProject, projectsHydrated, createProject, deleteProject, selectProject, updateProjectName }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
}
