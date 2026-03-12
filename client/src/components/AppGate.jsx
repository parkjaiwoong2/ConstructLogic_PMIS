import { useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../Layout';
import Main from '../pages/Main';
import Pricing from '../pages/Pricing';

export default function AppGate() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const path = location.pathname.replace(/\/$/, '') || '/';

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>로딩 중...</div>;

  if (!user) {
    if (path === '/') return <Main />;
    if (path === '/pricing') return <Pricing />;
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Layout />;
}
