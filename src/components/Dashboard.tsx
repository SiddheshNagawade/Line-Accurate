import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectContext';
import { Plus, Trash2, LogOut, ChevronDown } from 'lucide-react';
import { useRef } from 'react';
import { preloadEditorShell } from '../utils/routePreload';

export function Dashboard() {
  const { user, signOut } = useAuth();
  const { projects, createProject, deleteProject } = useProjects();
  const navigate = useNavigate();
  const [newProjectName, setNewProjectName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dashboardReady, setDashboardReady] = useState(false);
  const [newlyCreatedProjectId, setNewlyCreatedProjectId] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setDashboardReady(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleCreateProject = () => {
    if (!newProjectName.trim() || isCreatingProject) return;

    setIsCreatingProject(true);
    const project = createProject(newProjectName);
    setNewlyCreatedProjectId(project.id);
    setNewProjectName('');
    setShowCreateModal(false);

    window.setTimeout(() => {
      navigate(`/app/${project.id}`);
      setIsCreatingProject(false);
    }, 320);
  };

  const handleOpenProject = (projectId: string) => {
    preloadEditorShell();
    navigate(`/app/${projectId}`);
  };

  const handleSignOut = () => {
    signOut();
    navigate('/login');
  };

  const getFirstName = () => {
    if (!user?.fullName) return 'User';
    return user.fullName.split(' ')[0];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen w-screen bg-gradient-to-br from-[#0f0f12] via-[#1a1a1f] to-[#0f0f12]">
      {/* Header */}
      <header className="shrink-0 z-30">
        <div className="glass-panel rounded-b-2xl border-b border-x border-white/20 shadow-lg">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-[#cc8bed] to-[#9966cc] rounded-lg flex items-center justify-center shadow-lg shadow-[#cc8bed]/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                <path d="M22 12A10 10 0 0 0 12 2v10z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">LineAccurate</h1>
              <p className="text-[10px] text-white/40">Projects</p>
            </div>
          </div>

          {/* User Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 transition"
            >
              <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-semibold">
                {user?.fullName?.slice(0, 1).toUpperCase() ?? 'U'}
              </span>
              <span>{getFirstName()}</span>
              <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 glass-panel rounded-xl shadow-2xl border border-white/20 overflow-hidden z-50">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:text-white hover:bg-white/10 transition"
                >
                  <span className="text-[10px]">👤</span>
                  <span>Profile</span>
                </button>
                <div className="h-px bg-white/10"></div>
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    handleSignOut();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-white/10 transition"
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Intro */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-2">Welcome back, {getFirstName()}!</h2>
          <p className="text-white/50">Start a new project or continue working on your recent files</p>
        </div>

        {/* Create New Project Card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          <button
            onClick={() => setShowCreateModal(true)}
            className={`group relative h-48 rounded-xl border-2 border-dashed border-white/20 hover:border-[#cc8bed]/50 bg-white/5 hover:bg-white/10 transition-all duration-200 flex items-center justify-center cursor-pointer dashboard-card-enter ${dashboardReady ? 'dashboard-card-ready' : ''}`}
            style={{ ['--card-delay' as any]: '0ms' }}
          >
            <div className="flex flex-col items-center space-y-2 group-hover:scale-110 transition-transform">
              <div className="w-12 h-12 rounded-lg bg-[#cc8bed]/20 group-hover:bg-[#cc8bed]/30 flex items-center justify-center transition">
                <Plus size={24} className="text-[#cc8bed]" />
              </div>
              <span className="text-sm font-medium text-white/80 group-hover:text-white transition">
                New Project
              </span>
            </div>
          </button>

          {/* Project Cards */}
          {projects.map((project, projectIndex) => (
            <div
              key={project.id}
              onClick={() => handleOpenProject(project.id)}
              onMouseEnter={preloadEditorShell}
              onFocus={preloadEditorShell}
              className={`group relative h-48 rounded-xl glass-panel border border-white/10 hover:border-[#cc8bed]/50 overflow-hidden cursor-pointer hover:shadow-lg hover:shadow-[#cc8bed]/20 transition-all duration-200 dashboard-card-enter ${dashboardReady ? 'dashboard-card-ready' : ''} ${newlyCreatedProjectId === project.id ? 'project-pop-bounce' : ''}`}
              style={{ ['--card-delay' as any]: `${Math.min((projectIndex + 1) * 60, 420)}ms` }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#cc8bed]/5 to-transparent opacity-0 group-hover:opacity-100 transition" />
              
              <div className="relative h-full flex flex-col justify-between p-4">
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-[#cc8bed] to-[#9966cc] shadow-lg shadow-[#cc8bed]/20 flex items-center justify-center">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <h3 className="text-sm font-semibold text-white truncate group-hover:text-[#cc8bed] transition">
                    {project.name}
                  </h3>
                  <p className="text-xs text-white/40 mt-1">
                    {formatDate(project.updatedAt)}
                  </p>
                </div>
              </div>

              {/* Delete Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete "${project.name}"?`)) {
                    deleteProject(project.id);
                  }
                }}
                className="absolute top-2 right-2 p-2 rounded-lg bg-red-500/0 hover:bg-red-500/20 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition"
                title="Delete project"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </main>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-panel rounded-2xl p-8 border border-white/20 shadow-2xl w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Create New Project</h3>
            
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateProject()}
              placeholder="Project name"
              autoFocus
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#cc8bed] focus:border-transparent transition mb-6"
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewProjectName('');
                }}
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 hover:text-white font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                disabled={!newProjectName.trim()}
                className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#cc8bed] to-[#9966cc] text-white font-medium hover:shadow-lg hover:shadow-[#cc8bed]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
