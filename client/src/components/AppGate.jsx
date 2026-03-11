import { useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../Layout';
import Main from '../pages/Main';

export default function AppGate() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>로딩 중...</div>;

  if (!user) {
    if (location.pathname === '/') return <Main />;
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Layout />;
}
