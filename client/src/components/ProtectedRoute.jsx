import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, path }) {
  const { user, loading, canAccess, firstAccessiblePath, logout } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>로딩 중...</div>;
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (path && !canAccess(path)) {
    const firstMenu = firstAccessiblePath ?? '/';
    if (canAccess(firstMenu)) return <Navigate to={firstMenu} replace />;
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>접근 권한이 없습니다.</p>
        <button type="button" className="btn btn-primary" onClick={logout} style={{ marginTop: '1rem' }}>로그아웃</button>
      </div>
    );
  }
  return children;
}
