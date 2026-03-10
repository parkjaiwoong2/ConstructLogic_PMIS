import { Outlet } from 'react-router-dom';
import { NavLink } from 'react-router-dom';
import './Layout.css';

export default function Layout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo">Construct Logic</div>
        <nav className="app-nav">
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
