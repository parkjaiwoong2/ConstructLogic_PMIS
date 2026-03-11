import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

const defaultCompany = { name: 'Construct Logic', logo_url: null };

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState([]);
  const [company, setCompany] = useState(defaultCompany);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.getCompanies().then(c => setCompany(c ? { ...defaultCompany, ...c } : defaultCompany)).catch(() => {});
    api.getProjects().then(p => setProjects(Array.isArray(p) ? p : [])).catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (user && !authLoading) navigate('/', { replace: true });
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.signup({ email: email.trim(), password, name: name.trim() || undefined, project_id: projectId || null });
      setDone(true);
    } catch (err) {
      setError(err.message || '가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return <div className="login-page"><div className="login-loading">로딩 중...</div></div>;
  if (user) return <div className="login-page"><div className="login-loading">이동 중...</div></div>;

  if (done) {
    return (
      <div className="login-page">
        <div className="login-brand">
          {company.logo_url && <img src={company.logo_url} alt="" className="login-logo" />}
          <h1 className="login-company-name">{company.name}</h1>
        </div>
        <div className="login-form">
          <h2>가입 완료</h2>
          <p style={{ margin: '1rem 0', lineHeight: 1.6 }}>가입이 완료되었습니다.<br />관리자 승인 후 로그인할 수 있습니다.</p>
          <Link to="/login" className="btn btn-primary btn-block">로그인 화면으로</Link>
          <p style={{ marginTop: '1rem', textAlign: 'center' }}>
            <Link to="/" className="login-back">메인으로 돌아가기</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-brand">
        {company.logo_url && <img src={company.logo_url} alt="" className="login-logo" />}
        <h1 className="login-company-name">{company.name}</h1>
        <p className="login-tagline">회원가입</p>
      </div>
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>회원가입</h2>
        {error && <div className="login-error">{error}</div>}
        <input
          type="email"
          placeholder="이메일 (ID)"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <input
          type="password"
          placeholder="비밀번호 (4자 이상)"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={4}
          required
        />
        <input
          type="text"
          placeholder="이름"
          value={name}
          onChange={e => setName(e.target.value)}
          autoComplete="name"
        />
        <select
          value={projectId}
          onChange={e => setProjectId(e.target.value)}
          required
          className="login-select"
        >
          <option value="">현장 선택 *</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ''}</option>
          ))}
        </select>
        {projects.length === 0 && <p style={{ fontSize: '0.85rem', opacity: 0.8, margin: '-0.5rem 0 1rem' }}>등록된 현장이 없습니다. 관리자가 마스터 관리에서 현장을 등록해 주세요.</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={loading || projects.length === 0}>
          {loading ? '가입 중...' : '가입하기'}
        </button>
        <p style={{ marginTop: '1rem', textAlign: 'center' }}>
          <Link to="/login" className="login-back">로그인</Link>
          {' · '}
          <Link to="/" className="login-back">메인으로</Link>
        </p>
      </form>
    </div>
  );
}
