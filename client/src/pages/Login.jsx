import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState({ name: 'Construct Logic', logo_url: null });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user, firstAccessiblePath, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.getCompanies().then(setCompany).catch(() => {});
  }, []);

  useEffect(() => {
    if (user && !authLoading) {
      navigate(firstAccessiblePath || '/', { replace: true });
    }
  }, [user, firstAccessiblePath, authLoading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return <div className="login-page"><div className="login-loading">로딩 중...</div></div>;
  }
  if (user) return null;

  return (
    <div className="login-page">
      <Link to="/" className="login-brand" title="메인으로">
        {company.logo_url && <img src={company.logo_url} alt="" className="login-logo" />}
        <h1 className="login-company-name">{company.name}</h1>
        <p className="login-tagline">건설 프로젝트 관리 정보 시스템</p>
      </Link>
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>로그인</h2>
        {error && <div className="login-error">{error}</div>}
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? '로그인 중...' : '로그인'}
        </button>
        <p style={{ marginTop: '1rem', textAlign: 'center' }}>
          <Link to="/signup" className="login-back">회원가입</Link>
          {' · '}
          <Link to="/" className="login-back">메인으로</Link>
        </p>
      </form>
    </div>
  );
}
