import { useState, useEffect } from 'react';
import { api, nextTick } from '../../api';
import ProgressBar from '../../components/ProgressBar';
import Pagination, { PAGE_SIZE } from '../../components/Pagination';
import './Admin.css';

export default function AdminUsersSuper() {
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [projectsForCompany, setProjectsForCompany] = useState([]);
  const [rolesForCompany, setRolesForCompany] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('000000');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newCompanyId, setNewCompanyId] = useState('');
  const [newApproved, setNewApproved] = useState(true);
  const [filters, setFilters] = useState({ company_id: '', name: '' });
  const [page, setPage] = useState(1);
  const pageSize = PAGE_SIZE;
  const [totalUsers, setTotalUsers] = useState(0);

  const load = async (pageOverride, filterOverrides) => {
    setLoading(true);
    await nextTick();
    try {
      const ef = filterOverrides ? { ...filters, ...filterOverrides } : filters;
      const params = { limit: pageSize, offset: ((pageOverride ?? page) - 1) * pageSize };
      if (ef.company_id) params.company_id = ef.company_id;
      if (ef.name?.trim()) params.name = ef.name.trim();

      const data = await api.getAdminSuperBatchUsersPage(params);
      const u = data?.rows ?? [];
      const comp = data?.companies ?? [];
      setUsers(Array.isArray(u) ? u : []);
      setTotalUsers(data?.total ?? 0);
      setCompanies(Array.isArray(comp) ? comp : []);
      const def = comp.find(c => c.is_default) || comp[0];
      if (!newCompanyId && def) setNewCompanyId(String(def.id));
    } catch (e) {
      alert(e.message || '로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page]);

  useEffect(() => {
    if (!newCompanyId) {
      setProjectsForCompany([]);
      setRolesForCompany([]);
      setNewProjectId('');
      setNewRole('');
      return;
    }
    const cid = parseInt(newCompanyId, 10);
    Promise.all([api.getProjects(cid), api.getRolesByCompany(cid)])
      .then(([p, r]) => {
        const projList = Array.isArray(p) ? p : [];
        const roleList = Array.isArray(r) ? r : [];
        setProjectsForCompany(projList);
        setRolesForCompany(roleList);
        setNewProjectId(projList[0] ? String(projList[0].id) : '');
        setNewRole(roleList[0]?.code || '');
      })
      .catch(() => { setProjectsForCompany([]); setRolesForCompany([]); setNewProjectId(''); setNewRole(''); });
  }, [newCompanyId]);

  const handleSearch = () => {
    setPage(1);
    load(1);
  };

  const totalPages = Math.ceil(totalUsers / pageSize) || 1;

  const addUser = async (e) => {
    e.preventDefault();
    if (!newEmail.trim()) {
      alert('이메일을 입력하세요.');
      return;
    }
    if (!newCompanyId) {
      alert('회사를 선택하세요.');
      return;
    }
    setLoading(true);
    try {
      await api.createAdminUser({
        email: newEmail.trim(), password: newPassword, name: newName || newEmail.split('@')[0],
        role: newRole, project_id: newProjectId || undefined, company_id: newCompanyId || undefined, is_approved: newApproved
      });
      setNewEmail('');
      setNewPassword('000000');
      setNewName('');
      setNewProjectId('');
      load();
    } catch (err) {
      alert(err.message || '등록 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-page">
      <ProgressBar loading={loading} />
      <header className="page-header">
        <h1>사용자관리자추가</h1>
      </header>
      <p className="subtitle">전체 회사에 사용자를 등록하고 조회합니다.</p>

      <section className="card">
        <h2>사용자 등록</h2>
        <form onSubmit={addUser} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
          <select value={newCompanyId} onChange={e => setNewCompanyId(e.target.value)} style={{ minWidth: 150 }}>
            <option value="">회사 선택</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}{c.is_default ? ' (대표)' : ''}</option>)}
          </select>
          <input placeholder="이메일 *" value={newEmail} onChange={e => setNewEmail(e.target.value)} required />
          <input type="password" placeholder="비밀번호 (기본: 000000, 수정가능)" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          <input placeholder="이름" value={newName} onChange={e => setNewName(e.target.value)} />
          <select value={newProjectId} onChange={e => setNewProjectId(e.target.value)} style={{ minWidth: 120 }}>
            <option value="">구분 선택</option>
            {projectsForCompany.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={newRole || ''} onChange={e => setNewRole(e.target.value)}>
            <option value="">역할 선택</option>
            {rolesForCompany.map(r => <option key={r.id} value={r.code}>{r.label}</option>)}
          </select>
          <label><input type="checkbox" checked={newApproved} onChange={e => setNewApproved(e.target.checked)} /> 즉시승인</label>
          <button type="submit" className="btn btn-primary">추가</button>
        </form>
      </section>

      <section className="card">
        <h2>사용자 목록</h2>
        <div className="admin-users-filters">
          <select
            value={filters.company_id}
            onChange={e => setFilters(f => ({ ...f, company_id: e.target.value }))}
            aria-label="회사"
          >
            <option value="">회사 전체</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}{c.is_default ? ' (대표)' : ''}</option>)}
          </select>
          <input
            type="search"
            placeholder="이름 또는 이메일 검색"
            value={filters.name}
            onChange={e => setFilters(f => ({ ...f, name: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            aria-label="사용자"
          />
          <button type="button" className="btn btn-primary" onClick={handleSearch}>조회</button>
        </div>
        <div className="admin-users-table-wrap">
          <table className="data-table admin-users-table">
            <thead>
              <tr><th>이메일</th><th>이름</th><th>회사</th><th>현장</th><th>역할</th><th>승인</th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={`${u.id}-${u.row_company_id ?? u.company_id ?? 0}`} style={!u.is_approved ? { backgroundColor: 'rgba(255,200,0,0.1)' } : {}}>
                  <td>{u.email}</td>
                  <td>{u.name}</td>
                  <td>{u.row_company_name ?? (companies.find(c => c.id === u.company_id)?.name ?? '-')}</td>
                  <td>{u.project_name ?? '-'}</td>
                  <td>{u.role ?? '-'}</td>
                  <td>{u.is_approved ? <span className="badge">승인됨</span> : '대기'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && !loading && (
          <p className="admin-users-empty">조회 결과가 없습니다.</p>
        )}
        <Pagination total={totalUsers} page={page} onChange={setPage} />
      </section>
    </div>
  );
}
