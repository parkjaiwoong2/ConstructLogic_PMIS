import { useState, useEffect } from 'react';
import { api, nextTick } from '../api';
import { useAuth } from '../contexts/AuthContext';
import ProgressBar from '../components/ProgressBar';
import './Masters.css';

export default function Masters() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superAdmin' || user?.is_admin;
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState('');
  const [accountItems, setAccountItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newAccount, setNewAccount] = useState({ name: '' });
  const [newProject, setNewProject] = useState({ name: '' });

  useEffect(() => {
    api.getCompanies({ list: 1, mine: 1 }).then(list => {
      const arr = Array.isArray(list) ? list : [];
      setCompanies(arr);
      const def = arr.find(c => String(c.id) === String(user?.company_id)) || arr.find(c => c.is_default) || arr[0];
      if (def) setCompanyId(String(def.id));
    }).catch(() => setCompanies([]));
  }, [user?.company_id]);

  const showCompanySelect = companies.length > 1;
  const effectiveCompanyId = companies.length === 1 ? companyId : (showCompanySelect ? companyId : (user?.company_id ? String(user.company_id) : ''));
  const canAdd = !!(effectiveCompanyId && effectiveCompanyId !== '');

  const load = async () => {
    setLoading(true);
    setError(null);
    await nextTick();
    try {
      const [items, projs] = await Promise.all([
        api.getAccountItems(effectiveCompanyId || undefined),
        api.getProjects(effectiveCompanyId || undefined),
      ]);
      setAccountItems(Array.isArray(items) ? items : []);
      setProjects(Array.isArray(projs) ? projs : []);
    } catch (e) {
      console.error(e);
      setError(e?.message || '데이터를 불러오지 못했습니다. 서버가 실행 중인지 확인하세요.');
      setAccountItems([]);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [effectiveCompanyId]);

  const addAccount = async (e) => {
    e.preventDefault();
    if (!canAdd || !newAccount.name?.trim()) return;
    setLoading(true);
    await nextTick();
    try {
      await api.createAccountItem({ name: newAccount.name, company_id: canAdd ? effectiveCompanyId : undefined });
      setNewAccount({ name: '' });
      load();
    } catch (err) {
      alert(err.message || '등록 실패');
    } finally {
      setLoading(false);
    }
  };

  const addProject = async (e) => {
    e.preventDefault();
    if (!canAdd || !newProject.name?.trim()) return;
    setLoading(true);
    await nextTick();
    try {
      await api.createProject({ code: newProject.code || undefined, name: newProject.name, company_id: canAdd ? effectiveCompanyId : undefined });
      setNewProject({ code: '', name: '' });
      load();
    } catch (err) {
      alert(err.message || '등록 실패');
    } finally {
      setLoading(false);
    }
  };

  const [editingAccount, setEditingAccount] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [deletingAccount, setDeletingAccount] = useState(null);
  const [deletingProject, setDeletingProject] = useState(null);

  const startEditAccount = (a) => setEditingAccount({ id: a.id, name: a.name });
  const startEditProject = (p) => setEditingProject({ id: p.id, name: p.name });
  const cancelEditAccount = () => setEditingAccount(null);
  const cancelEditProject = () => setEditingProject(null);

  const saveAccount = async (e) => {
    e?.preventDefault();
    if (!editingAccount?.name?.trim()) return;
    setLoading(true);
    try {
      await api.updateAccountItem(editingAccount.id, { name: editingAccount.name });
      setEditingAccount(null);
      load();
    } catch (err) {
      alert(err.message || '수정 실패');
    } finally {
      setLoading(false);
    }
  };

  const saveProject = async (e) => {
    e?.preventDefault();
    if (!canAdd || !editingProject?.name?.trim()) return;
    setLoading(true);
    await nextTick();
    try {
      await api.updateProject(editingProject.id, { name: editingProject.name });
      setEditingProject(null);
      load();
    } catch (err) {
      alert(err.message || '수정 실패');
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = async (id) => {
    if (!canAdd) return;
    if (!confirm('이 항목을 삭제하시겠습니까?')) return;
    setDeletingAccount(id);
    setLoading(true);
    await nextTick();
    try {
      await api.deleteAccountItem(id);
      setEditingAccount(null);
      load();
    } catch (err) {
      alert(err.message || '삭제 실패');
    } finally {
      setDeletingAccount(null);
      setLoading(false);
    }
  };

  const deleteProject = async (id) => {
    if (!canAdd) return;
    if (!confirm('이 현장을 삭제하시겠습니까?')) return;
    setDeletingProject(id);
    setLoading(true);
    await nextTick();
    try {
      await api.deleteProject(id);
      setEditingProject(null);
      load();
    } catch (err) {
      alert(err.message || '삭제 실패');
    } finally {
      setDeletingProject(null);
      setLoading(false);
    }
  };

  return (
    <div className="masters">
      <ProgressBar loading={loading} />
      <header className="page-header">
        <h1>마스터 관리</h1>
      </header>
      <p className="subtitle">사용 중인 항목/현장은 삭제할 수 없습니다. {showCompanySelect && '회사별로 항목/현장을 등록·수정·삭제할 수 있습니다.'}</p>
      {companies.length > 0 && (
        <div className="form-row" style={{ marginBottom: '1rem' }}>
          <label>회사</label>
          <select value={companyId} onChange={e => setCompanyId(e.target.value)} disabled={companies.length <= 1}>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.is_default ? ' (대표)' : ''}</option>
            ))}
          </select>
          {!canAdd && <span className="ml" style={{ color: '#6b7280', fontSize: '0.9rem' }}>추가·수정·삭제는 회사를 선택하세요.</span>}
        </div>
      )}
      {error && (
        <div style={{ padding: '1rem', background: '#fef2f2', color: '#dc2626', borderRadius: 8, marginBottom: '1rem' }}>
          {error} <button type="button" className="btn btn-sm btn-secondary" onClick={load}>다시 시도</button>
        </div>
      )}

      <div className="masters-grid">
        <section className="card">
          <h2>계정과목 (항목)</h2>
          <form onSubmit={addAccount} className="add-form">
            <input
              placeholder="항목명 *"
              value={newAccount.name}
              onChange={e => setNewAccount(a => ({ ...a, name: e.target.value }))}
              required
              disabled={!canAdd}
            />
            <button type="submit" className="btn btn-primary" disabled={!canAdd}>추가</button>
          </form>
          <ul className="master-list">
            {(accountItems || []).map(a => (
              <li key={a.id}>
                {editingAccount?.id === a.id ? (
                  <form className="edit-inline" onSubmit={saveAccount}>
                    <input
                      placeholder="항목명 *"
                      value={editingAccount.name}
                      onChange={e => setEditingAccount(x => ({ ...x, name: e.target.value }))}
                      required
                      disabled={!canAdd}
                    />
                    <button type="submit" className="btn btn-sm btn-primary" disabled={!canAdd}>저장</button>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={cancelEditAccount}>취소</button>
                  </form>
                ) : (
                  <>
                    <span className="code">{a.code || '-'}</span>
                    <span className="name">{a.name}</span>
                    <span className="actions ml">
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => startEditAccount(a)} disabled={!canAdd}>수정</button>
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => deleteAccount(a.id)} disabled={!canAdd || deletingAccount === a.id}>
                        {deletingAccount === a.id ? '삭제 중...' : '삭제'}
                      </button>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>현장 (공사)</h2>
          <form onSubmit={addProject} className="add-form">
            <input
              placeholder="현장명 *"
              value={newProject.name}
              onChange={e => setNewProject(p => ({ ...p, name: e.target.value }))}
              required
              disabled={!canAdd}
            />
            <button type="submit" className="btn btn-primary" disabled={!canAdd}>추가</button>
          </form>
          <ul className="master-list">
            {(projects || []).map(p => (
              <li key={p.id}>
                {editingProject?.id === p.id ? (
                  <form className="edit-inline" onSubmit={saveProject}>
                    <input
                      placeholder="현장명 *"
                      value={editingProject.name}
                      onChange={e => setEditingProject(x => ({ ...x, name: e.target.value }))}
                      required
                      disabled={!canAdd}
                    />
                    <button type="submit" className="btn btn-sm btn-primary" disabled={!canAdd}>저장</button>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={cancelEditProject}>취소</button>
                  </form>
                ) : (
                  <>
                    <span className="code">{p.code || '-'}</span>
                    <span className="name">{p.name}</span>
                    <span className="actions ml">
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => startEditProject(p)} disabled={!canAdd}>수정</button>
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => deleteProject(p.id)} disabled={!canAdd || deletingProject === p.id}>
                        {deletingProject === p.id ? '삭제 중...' : '삭제'}
                      </button>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
