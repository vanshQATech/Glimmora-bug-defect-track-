import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import Brand from './Brand';
import AIChat from './AIChat';
import {
  LayoutDashboard, FolderKanban, CheckSquare, Users, Bell, LogOut,
  Menu, X, Briefcase, Search, Sparkles, ChevronsLeft, ChevronsRight, Activity
} from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    const fetch = () => api.get('/notifications/unread-count').then(r => setUnreadCount(r.data.count)).catch(() => {});
    fetch();
    const i = setInterval(fetch, 30000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const q = searchQ.trim();
    if (!q) { setSearchResults(null); setSearchLoading(false); return; }
    setSearchLoading(true);
    const t = setTimeout(() => {
      api.get(`/search?q=${encodeURIComponent(q)}`)
        .then(r => setSearchResults(r.data))
        .catch(() => setSearchResults({ projects: [], bugs: [], tasks: [] }))
        .finally(() => setSearchLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [searchQ]);

  useEffect(() => {
    const onClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const goToResult = (to) => {
    setSearchOpen(false);
    setSearchQ('');
    navigate(to);
  };

  const nav = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { to: '/projects', label: 'Projects', icon: FolderKanban },
    { to: '/my-work', label: 'My Work', icon: CheckSquare },
    { to: '/workspace', label: 'Workspace', icon: Briefcase },
    { to: '/activity', label: 'Activity', icon: Activity },
    ...(user?.role === 'Admin' ? [{ to: '/users', label: 'Users', icon: Users }] : []),
  ];

  const isActive = (item) => item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
  const handleLogout = () => { logout(); navigate('/login'); };

  const initials = `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase();

  return (
    <div className="min-h-screen bg-ink-50 bg-brand-radial flex">
      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 z-30 bg-ink-900/40 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 z-40 h-screen bg-white/90 backdrop-blur-xl border-r border-ink-100 flex flex-col transform transition-all duration-200 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'w-20' : 'w-64'}`}>
        <div className={`flex items-center ${collapsed ? 'justify-center px-2' : 'justify-between px-5'} h-16 border-b border-ink-100`}>
          {collapsed ? (
            <img src="/logo.png" alt="Glimmora" className="h-8 w-8 object-contain" onError={(e)=>e.currentTarget.style.display='none'} />
          ) : (
            <Brand className="h-8" showText />
          )}
          <button onClick={() => setMobileOpen(false)} className="lg:hidden text-ink-500"><X className="w-5 h-5" /></button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map(item => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : ''}
                className={`nav-link ${active ? 'nav-link-active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
              >
                <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
                {active && !collapsed && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-500" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-ink-100">
          <Link
            to="/profile"
            onClick={() => setMobileOpen(false)}
            title={collapsed ? `${user?.first_name || ''} ${user?.last_name || ''}`.trim() : ''}
            className={`flex items-center gap-3 p-2 rounded-lg hover:bg-ink-50 transition-colors ${collapsed ? 'justify-center' : ''} ${location.pathname === '/profile' ? 'bg-ink-50' : ''}`}
          >
            <div className="w-9 h-9 rounded-full bg-brand-gradient text-white flex items-center justify-center text-sm font-bold shadow-card flex-shrink-0">
              {initials || 'U'}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-900 truncate">{user?.first_name} {user?.last_name}</p>
                <p className="text-xs text-brand-600 truncate font-medium">{user?.role}</p>
              </div>
            )}
          </Link>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="hidden lg:flex mt-2 w-full items-center justify-center gap-2 py-1.5 rounded-lg text-xs text-ink-400 hover:bg-ink-50 hover:text-ink-700"
          >
            {collapsed ? <ChevronsRight className="w-4 h-4" /> : <><ChevronsLeft className="w-4 h-4" /> Collapse</>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-16 bg-white/80 backdrop-blur-xl border-b border-ink-100 flex items-center gap-3 px-4 md:px-6">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 text-ink-500 hover:text-ink-900">
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo shown in top bar on mobile */}
          <div className="lg:hidden">
            <Brand className="h-7" />
          </div>

          {/* Global search / command bar */}
          <div className="flex-1 max-w-xl hidden md:block" ref={searchRef}>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 group-focus-within:text-brand-600" />
              <input
                type="text"
                value={searchQ}
                onChange={(e) => { setSearchQ(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search bugs, tasks, projects…"
                className="w-full pl-10 pr-20 py-2.5 rounded-xl border border-ink-100 bg-ink-50 hover:bg-white focus:bg-white text-sm placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300 transition"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {searchQ && (
                  <button onClick={() => { setSearchQ(''); setSearchResults(null); }} className="p-0.5 text-ink-400 hover:text-ink-700">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <Sparkles className="w-4 h-4 text-brand-500" />
              </div>

              {searchOpen && searchQ.trim() && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-ink-100 rounded-xl shadow-pop overflow-hidden z-50 max-h-[70vh] overflow-y-auto">
                  {searchLoading && !searchResults && (
                    <div className="px-4 py-6 text-center text-xs text-ink-400">Searching…</div>
                  )}
                  {searchResults && (() => {
                    const { projects = [], bugs = [], tasks = [] } = searchResults;
                    const total = projects.length + bugs.length + tasks.length;
                    if (total === 0) {
                      return <div className="px-4 py-6 text-center text-xs text-ink-400">No matches for "{searchQ}"</div>;
                    }
                    return (
                      <>
                        {projects.length > 0 && (
                          <div>
                            <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-ink-400 font-semibold">Projects</div>
                            {projects.map(p => (
                              <button key={p.id} onClick={() => goToResult(`/projects/${p.id}`)}
                                className="w-full text-left px-4 py-2 hover:bg-ink-50 flex items-center gap-2 text-sm">
                                <FolderKanban className="w-4 h-4 text-brand-500 flex-shrink-0" />
                                <span className="font-medium text-ink-900 truncate">{p.name}</span>
                                <span className="ml-auto text-[10px] text-ink-400">{p.status}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {bugs.length > 0 && (
                          <div className="border-t border-ink-100">
                            <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-ink-400 font-semibold">Bugs</div>
                            {bugs.map(b => (
                              <button key={b.id} onClick={() => goToResult(`/bugs/${b.id}`)}
                                className="w-full text-left px-4 py-2 hover:bg-ink-50 flex items-start gap-2 text-sm">
                                <span className="mt-0.5 text-[10px] font-mono text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">#{b.bug_number || b.id.slice(0,6)}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="text-ink-900 truncate">{b.summary}</div>
                                  <div className="text-[10px] text-ink-400 truncate">{b.project_name} · {b.status} · {b.priority}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        {tasks.length > 0 && (
                          <div className="border-t border-ink-100">
                            <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-ink-400 font-semibold">Tasks</div>
                            {tasks.map(t => (
                              <button key={t.id} onClick={() => goToResult(`/tasks/${t.id}`)}
                                className="w-full text-left px-4 py-2 hover:bg-ink-50 flex items-center gap-2 text-sm">
                                <CheckSquare className="w-4 h-4 text-brand-500 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-ink-900 truncate">{t.title}</div>
                                  <div className="text-[10px] text-ink-400 truncate">{t.project_name} · {t.status} · {t.priority}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 md:hidden" />

          <div className="flex items-center gap-1">
            <Link to="/notifications" className="relative p-2 rounded-lg text-ink-500 hover:text-ink-900 hover:bg-ink-100">
              <Bell className="w-[18px] h-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-brand-gradient text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-card">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            <button onClick={handleLogout} className="p-2 rounded-lg text-ink-500 hover:text-red-600 hover:bg-red-50" title="Logout">
              <LogOut className="w-[18px] h-[18px]" />
            </button>
            <div className="hidden sm:flex items-center gap-2 pl-3 ml-1 border-l border-ink-100" title="Glimmora International">
              <img
                src="/logo.png"
                alt="Glimmora International"
                className="h-8 w-8 object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <div className="leading-tight hidden md:block">
                <div className="text-[12px] font-bold tracking-tight text-ink-900">Glimmora</div>
                <div className="text-[9px] uppercase tracking-[0.15em] text-brand-600 font-semibold">International</div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-auto animate-fade-in">
          <Outlet />
        </main>
      </div>

      <AIChat />
    </div>
  );
}
