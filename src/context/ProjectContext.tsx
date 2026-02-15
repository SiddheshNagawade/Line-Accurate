import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';

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

const STORAGE_KEY = 'lineaccurate_projects';

function loadProjectsFromStorage(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return [];
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  // Lazy init — read from localStorage synchronously so the first render
  // already has the correct data (avoids the save-effect overwriting with [])
  const [projects, setProjects] = useState<Project[]>(loadProjectsFromStorage);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const isInitialRender = useRef(true);

  // Persist to localStorage whenever projects change (skip the very first render
  // to avoid overwriting during React 18 StrictMode double-mount)
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }, [projects]);

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
