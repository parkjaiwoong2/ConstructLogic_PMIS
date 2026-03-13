import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [menus, setMenus] = useState([]);
  const [company, setCompany] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAuth = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setUser(null);
      setMenus([]);
      setCompany(null);
      setSubscription(null);
      setLoading(false);
      return;
    }
    try {
      const { user: u, menus: m, company: c, subscription: s } = await api.authMe();
      setUser(u);
      setMenus(m || []);
      setCompany(c || null);
      setSubscription(s || null);
    } catch {
      localStorage.removeItem('auth_token');
      setUser(null);
      setMenus([]);
      setCompany(null);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuth();
  }, []);

  const login = async (email, password) => {
    const { token, user: u } = await api.login({ email, password });
    localStorage.setItem('auth_token', token);
    const { user: u2, menus: m, company: c } = await api.authMe();
    setUser(u2 || u);
    setMenus(m || []);
    setCompany(c || null);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('currentUserName');
    setUser(null);
    setMenus([]);
  };

  const canAccess = (path) => {
    if (!user) return false;
    if (user.is_admin) return true;
    const norm = (path === '/' || path === '' || !path) ? '/' : (String(path).replace(/\/$/, '') || '/');
    return menus.some(m => {
      const mn = (m === '' || m === '/' || !m) ? '/' : (String(m).trim().replace(/\/$/, '') || '/');
      return mn === norm || mn === path || m === norm || m === path;
    });
  };

  const MENU_ORDER = ['/', '/expense/new', '/expenses', '/import', '/approval-processing', '/card-management', '/masters', '/settings', '/admin/company', '/admin/approval-sequence', '/admin/permissions', '/admin/edit-history', '/admin/super'];
  const ADMIN_PATHS = ['/admin/company', '/admin/approval-sequence', '/admin/permissions', '/admin/edit-history', '/admin/super'];
  const SUPER_ONLY_PATHS = ['/admin/super'];
  const firstAccessiblePath = (() => {
    if (!user) return '/';
    const hasAdmin = user.is_admin || user.role === 'admin';
    const isSuper = user.is_admin === true;
    for (const p of MENU_ORDER) {
      if (ADMIN_PATHS.includes(p) && !hasAdmin) continue;
      if (SUPER_ONLY_PATHS.includes(p) && !isSuper) continue;
      if (canAccess(p)) return p;
    }
    return '/';
  })();

  return (
    <AuthContext.Provider value={{ user, menus, company, subscription, loading, login, logout, loadAuth, canAccess, firstAccessiblePath }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
