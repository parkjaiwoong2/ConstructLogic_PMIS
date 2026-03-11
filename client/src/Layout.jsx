import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import './Layout.css';

const DEFAULT_COMPANY = { name: 'Construct Logic', logo_url: null };

const MENUS = [
  { to: '/', end: true, label: '대시보드' },
  { to: '/expense/new', end: false, label: '사용내역 입력' },
  { to: '/expenses', end: false, label: '사용내역 조회' },
  { to: '/import', end: false, label: 'CSV 임포트' },
  { to: '/documents', end: false, label: '결재 문서' },
  { to: '/approval', end: false, label: '결재함' },
  { to: '/masters', end: false, label: '마스터 관리' },
  { to: '/settings', end: false, label: '내 설정' },
  { to: '/admin/company', end: false, label: '회사 등록', admin: true },
  { to: '/admin/users', end: false, label: '사용자 권한', admin: true },
  { to: '/admin/role-permissions', end: false, label: '역할권한', admin: true },
  { to: '/admin/approval-sequence', end: false, label: '결재순서', admin: true },
  { to: '/admin/edit-history', end: false, label: '관리자 수정 히스토리', admin: true },
];

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, company, loading, canAccess, logout } = useAuth();
  const navigate = useNavigate();
  const displayCompany = company || DEFAULT_COMPANY;

  useEffect(() => {
    if (user && !user.is_admin) localStorage.setItem('currentUserName', user.name || '');
  }, [user]);

  const closeMenu = () => setMenuOpen(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>로딩 중...</div>;
  if (!user) return <Navigate to="/login" replace />;

  const hasFullAccess = user?.is_admin || user?.role === 'admin';
  const visibleMenus = MENUS.filter(m => {
    if (m.admin && !hasFullAccess) return false;
    return canAccess(m.to === '/' ? '/' : m.to);
  });

  return (
    <div className="layout">
      <button type="button" className="menu-toggle" aria-label="메뉴 열기" onClick={() => setMenuOpen(true)}>
        <span /><span /><span />
      </button>
      {menuOpen && <div className="sidebar-overlay" onClick={closeMenu} aria-hidden="true" />}
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <Link to="/" className="sidebar-brand" onClick={closeMenu}>
            <span className="sidebar-brand-row">
              {displayCompany.logo_url && <img src={displayCompany.logo_url} alt="" className="sidebar-logo" />}
              <span className="logo">{displayCompany.name}</span>
            </span>
            {user?.name && <span className="sidebar-user">{user.name}</span>}
          </Link>
          <button type="button" className="sidebar-close" aria-label="메뉴 닫기" onClick={closeMenu}>×</button>
        </div>
        <nav className="app-nav" onClick={closeMenu}>
          {visibleMenus.map(m => (
            <NavLink key={m.to} to={m.to} end={m.end}>{m.label}</NavLink>
          ))}
          <button type="button" className="nav-logout" onClick={handleLogout}>로그아웃</button>
        </nav>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
