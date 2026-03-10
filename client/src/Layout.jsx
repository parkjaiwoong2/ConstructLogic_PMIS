import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import './Layout.css';

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="layout">
      <button
        type="button"
        className="menu-toggle"
        aria-label="메뉴 열기"
        onClick={() => setMenuOpen(true)}
      >
        <span />
        <span />
        <span />
      </button>
      {menuOpen && (
        <div className="sidebar-overlay" onClick={closeMenu} aria-hidden="true" />
      )}
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <span className="logo">Construct Logic</span>
          <button type="button" className="sidebar-close" aria-label="메뉴 닫기" onClick={closeMenu}>×</button>
        </div>
        <nav className="app-nav" onClick={closeMenu}>
          <NavLink to="/" end>대시보드</NavLink>
          <NavLink to="/expense/new">사용내역 입력</NavLink>
          <NavLink to="/expenses">사용내역 조회</NavLink>
          <NavLink to="/import">CSV 임포트</NavLink>
          <NavLink to="/documents">결재 문서</NavLink>
          <NavLink to="/approval">결재함</NavLink>
          <NavLink to="/masters">마스터 관리</NavLink>
        </nav>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
