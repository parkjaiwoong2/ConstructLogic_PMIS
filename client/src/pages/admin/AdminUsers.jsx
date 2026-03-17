import { useState, useEffect, useRef } from 'react';
import { api, nextTick } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import ProgressBar from '../../components/ProgressBar';
import Pagination, { PAGE_SIZE } from '../../components/Pagination';
import './Admin.css';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectsForCompany, setProjectsForCompany] = useState([]); // 선택한 회사 소속 현장(구분)
  const [rolesForCompany, setRolesForCompany] = useState([]); // 선택한 회사에서 설정한 역할
  const [projectsForFilter, setProjectsForFilter] = useState([]);
  const [rolesForFilter, setRolesForFilter] = useState([]);
  const [projectsByCompany, setProjectsByCompany] = useState({}); // 회사별 구분 (테이블 행용)
  const [rolesByCompany, setRolesByCompany] = useState({}); // 회사별 역할 (테이블 행용)
  const [roleMenus, setRoleMenus] = useState({});
  const [loading, setLoading] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newCompanyId, setNewCompanyId] = useState('');
  const [newApproved, setNewApproved] = useState(true);
  const [edits, setEdits] = useState({});
  const { company } = useAuth();
  const [filters, setFilters] = useState({ company_id: '', project_id: '', role: '', name: '' });
  const [page, setPage] = useState(1);
  const hasSetDefaultCompany = useRef(false);
  const pageSize = PAGE_SIZE;
  const [totalUsers, setTotalUsers] = useState(0);

  const load = async (pageOverride, filterOverrides) => {
    setLoading(true);
    await nextTick();
    try {
      const ef = filterOverrides ? { ...filters, ...filterOverrides } : filters;
      const params = {};
      if (ef.company_id) params.company_id = ef.company_id;
      if (ef.project_id) params.project_id = ef.project_id;
      if (ef.role) params.role = ef.role;
      if (ef.name?.trim()) params.name = ef.name.trim();
      const effectivePage = pageOverride ?? page;
      params.limit = pageSize;
      params.offset = (effectivePage - 1) * pageSize;

      const data = await api.getAdminBatchUsersPage(params);
      const u = data?.rows ?? [];
      const comp = data?.companies ?? [];
      setUsers(Array.isArray(u) ? u : []);
      setTotalUsers(data?.total ?? 0);
      setRoles(Array.isArray(data?.roles) ? data.roles : []);
      setRoleMenus(data?.roleMenus && typeof data.roleMenus === 'object' ? data.roleMenus : {});
      setProjects(Array.isArray(data?.projects) ? data.projects : []);
      setCompanies(Array.isArray(comp) ? comp : []);
      const projList = Array.isArray(data?.projects) ? data.projects : [];
      const roleList = Array.isArray(data?.roles) ? data.roles : [];
      setProjectsForFilter(projList);
      setRolesForFilter(roleList);
      const def = comp.find(c => c.is_default) || comp[0];
      if (def && !ef.company_id) setFilters(f => ({ ...f, company_id: String(def.id) }));
      const cids = [...new Set(u.map(x => x.row_company_id ?? x.company_id).filter(Boolean))];
      cids.forEach(cid => {
        Promise.all([api.getProjects(cid), api.getRolesByCompany(cid)])
          .then(([p, r]) => {
            setProjectsByCompany(prev => ({ ...prev, [cid]: Array.isArray(p) ? p : [] }));
            setRolesByCompany(prev => ({ ...prev, [cid]: Array.isArray(r) ? r : [] }));
          })
          .catch(() => {});
      });
      const defCompany = comp.find(c => c.is_default) || comp[0];
      if (!newCompanyId && defCompany) setNewCompanyId(String(defCompany.id));
      if (!newRole && Array.isArray(data?.roles) && data.roles.length) setNewRole(data.roles[0].code);
    } catch (e) {
      alert(e.message || '로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page]);

  useEffect(() => {
    if (company?.id && !hasSetDefaultCompany.current) {
      hasSetDefaultCompany.current = true;
      const cid = String(company.id);
      setFilters(f => ({ ...f, company_id: cid }));
      load(1, { company_id: cid });
    }
  }, [company?.id]);

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

  useEffect(() => {
    if (!filters.company_id) {
      setProjectsForFilter([]);
      setRolesForFilter([]);
      return;
    }
    const cid = parseInt(filters.company_id, 10);
    Promise.all([api.getProjects(cid), api.getRolesByCompany(cid)])
      .then(([p, r]) => {
        setProjectsForFilter(Array.isArray(p) ? p : []);
        setRolesForFilter(Array.isArray(r) ? r : []);
      })
      .catch(() => { setProjectsForFilter([]); setRolesForFilter([]); });
  }, [filters.company_id]);

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
      setNewPassword('');
      setNewName('');
      setNewProjectId('');
      load();
    } catch (err) {
      alert(err.message || '등록 실패');
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (id, body) => {
    try {
      await api.updateAdminUser(id, body);
      setEdits(e => { const next = { ...e }; delete next[id]; return next; });
      load();
    } catch (err) {
      alert(err.message || '수정 실패');
    }
  };

  const setRowEdit = (id, field, value) => {
    setEdits(e => ({ ...e, [id]: { ...e[id], [field]: value } }));
  };
  const getRowValue = (u, field) => (edits[u.id]?.[field] !== undefined) ? edits[u.id][field] : (u[field] ?? '');

  const saveRow = async (u) => {
    const email = getRowValue(u, 'email') || u.email;
    const name = getRowValue(u, 'name') || u.name;
    if (!email?.trim()) {
      alert('이메일을 입력하세요.');
      return;
    }
    const projId = getRowValue(u, 'project_id') ?? u.project_id;
    const compId = getRowValue(u, 'company_id') ?? u.company_id;
    const body = {
      email: email.trim(),
      name: (name || '').trim(),
      role: getRowValue(u, 'role') ?? u.role,
      is_approved: u.is_approved,
      project_id: projId ? parseInt(projId, 10) : null,
      company_id: compId ? parseInt(compId, 10) : null,
    };
    const pw = edits[u.id]?.password;
    if (pw && pw.length >= 4) body.password = pw;
    await updateUser(u.id, body);
  };

  const approveUser = async (id) => {
    try {
      await api.approveAdminUser(id);
      load();
    } catch (err) {
      alert(err.message || '승인 실패');
    }
  };

  return (
    <div className="admin-page">
      <ProgressBar loading={loading} />
      <header className="page-header">
        <h1>사용자 권한</h1>
      </header>
      <p className="subtitle">사용자별 역할과 메뉴 접근 권한을 설정합니다.</p>

      <section className="card">
        <h2>사용자 등록</h2>
        <form onSubmit={addUser} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
          <select value={newCompanyId} onChange={e => setNewCompanyId(e.target.value)} style={{ minWidth: 120 }} required disabled={companies.length <= 1}>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}{c.is_default ? ' (대표)' : ''}</option>)}
          </select>
          <input placeholder="이메일" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
          <input type="password" placeholder="비밀번호 (신규만 필수)" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
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
        <p className="subtitle">승인 대기 회원은 승인 버튼을 눌러 로그인 가능하게 합니다.</p>
        <div className="admin-users-filters">
          <select
            value={filters.company_id}
            onChange={e => {
              const v = e.target.value;
              setFilters(f => ({ ...f, company_id: v, project_id: v ? f.project_id : '', role: v ? f.role : '' }));
            }}
            aria-label="회사"
          >
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}{c.is_default ? ' (대표)' : ''}</option>)}
          </select>
          <select
            value={filters.project_id}
            onChange={e => setFilters(f => ({ ...f, project_id: e.target.value }))}
            aria-label="구분"
          >
            <option value="">구분 전체</option>
            {projectsForFilter.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select
            value={filters.role}
            onChange={e => setFilters(f => ({ ...f, role: e.target.value }))}
            aria-label="역할"
          >
            <option value="">역할 전체</option>
            {rolesForFilter.map(r => <option key={r.id} value={r.code}>{r.label}</option>)}
          </select>
          <input
            type="search"
            placeholder="이름 또는 이메일 검색"
            value={filters.name}
            onChange={e => setFilters(f => ({ ...f, name: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            aria-label="이름 또는 이메일"
          />
          <button type="button" className="btn btn-primary" onClick={handleSearch}>조회</button>
        </div>
        <div className="admin-users-table-wrap">
        <table className="data-table admin-users-table">
          <thead>
            <tr><th>이메일</th><th>이름</th><th>비밀번호</th><th>회사</th><th>현장</th><th>역할</th><th>승인</th><th>권한</th><th></th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={`${u.id}-${u.row_company_id ?? u.company_id ?? 0}`} style={!u.is_approved ? { backgroundColor: 'rgba(255,200,0,0.1)' } : {}}>
                <td>
                  <input
                    type="email"
                    className="input-sm"
                    value={getRowValue(u, 'email')}
                    onChange={e => setRowEdit(u.id, 'email', e.target.value)}
                    placeholder="이메일"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="input-sm"
                    value={getRowValue(u, 'name')}
                    onChange={e => setRowEdit(u.id, 'name', e.target.value)}
                    placeholder="이름"
                  />
                </td>
                <td>
                  <input
                    type="password"
                    className="input-sm"
                    value={edits[u.id]?.password ?? ''}
                    onChange={e => setRowEdit(u.id, 'password', e.target.value)}
                    placeholder="변경 시 입력 (4자 이상)"
                  />
                </td>
                <td>
                  {u.row_company_name ?? (companies.find(c => c.id === u.company_id)?.name ?? '-')}
                  <select
                    value={String(getRowValue(u, 'company_id') ?? u.company_id ?? '')}
                    onChange={e => setRowEdit(u.id, 'company_id', e.target.value ? parseInt(e.target.value, 10) : null)}
                    style={{ minWidth: 100, marginTop: 2 }}
                    title="메인 회사"
                  >
                    <option value="">메인회사</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </td>
                <td>
                  <select
                    value={getRowValue(u, 'project_id') ?? u.project_id ?? ''}
                    onChange={e => setRowEdit(u.id, 'project_id', e.target.value ? parseInt(e.target.value, 10) : null)}
                    style={{ minWidth: 100 }}
                  >
                    <option value="">구분 선택</option>
                    {(projectsByCompany[getRowValue(u, 'company_id') ?? u.row_company_id ?? u.company_id] || projectsForFilter).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </td>
                <td>
                  <select
                    value={getRowValue(u, 'role') || u.role || ''}
                    onChange={e => setRowEdit(u.id, 'role', e.target.value)}
                  >
                    {(rolesByCompany[getRowValue(u, 'company_id') ?? u.row_company_id ?? u.company_id] || rolesForFilter).map(r => <option key={r.id} value={r.code}>{r.label}</option>)}
                  </select>
                </td>
                <td>
                  {!u.is_approved ? (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => approveUser(u.id)}>승인</button>
                  ) : (
                    <span className="badge">승인됨</span>
                  )}
                </td>
                <td>{((getRowValue(u, 'role') ?? u.role) === 'admin' || u.is_admin) ? '전체' : (roleMenus[getRowValue(u, 'role') ?? u.role] || []).length + '개 메뉴'}</td>
                <td>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => saveRow(u)}>저장</button>
                </td>
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
