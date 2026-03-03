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
  createProject: (name: string) => Project;
  deleteProject: (id: string) => void;
  selectProject: (id: string) => void;
  updateProjectName: (id: string, name: string) => void;
}

const STORAGE_KEY_PREFIX = 'lineaccurate_projects_';

function getStorageKey(username?: string): string | null {
  if (!username) return null;
  return `${STORAGE_KEY_PREFIX}${username.toLowerCase()}`;
}

function loadProjectsFromStorage(storageKey: string | null): Project[] {
  if (!storageKey) return [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) return JSON.parse(raw);
  } catch {
    localStorage.removeItem(storageKey);
  }
  return [];
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
  const [projects, setProjects] = useState<Project[]>(() => loadProjectsFromStorage(storageKey));
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const isInitialRender = useRef(true);

  // Reload account-scoped projects whenever logged-in user changes.
  useEffect(() => {
    setProjects(loadProjectsFromStorage(storageKey));
    setCurrentProject(null);
    isInitialRender.current = true;
  }, [storageKey]);

  // Persist to localStorage whenever projects change (skip the very first render
  // to avoid overwriting during React 18 StrictMode double-mount)
  useEffect(() => {
    if (!storageKey) return;
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    localStorage.setItem(storageKey, JSON.stringify(projects));
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
    <ProjectContext.Provider value={{ projects, currentProject, createProject, deleteProject, selectProject, updateProjectName }}>
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
