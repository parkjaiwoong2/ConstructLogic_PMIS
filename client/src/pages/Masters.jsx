import { useState, useEffect } from 'react';
import { api, nextTick } from '../api';
import ProgressBar from '../components/ProgressBar';
import './Masters.css';

export default function Masters() {
  const [accountItems, setAccountItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newAccount, setNewAccount] = useState({ code: '', name: '' });
  const [newProject, setNewProject] = useState({ code: '', name: '' });

  const load = async () => {
    setLoading(true);
    setError(null);
    await nextTick();
    try {
      const [items, projs] = await Promise.all([api.getAccountItems(), api.getProjects()]);
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

  useEffect(() => { load(); }, []);

  const addAccount = async (e) => {
    e.preventDefault();
    if (!newAccount.name?.trim()) return;
    setLoading(true);
    await nextTick();
    try {
      await api.createAccountItem({ code: newAccount.code || undefined, name: newAccount.name });
      setNewAccount({ code: '', name: '' });
      load();
    } catch (err) {
      alert(err.message || '등록 실패');
    } finally {
      setLoading(false);
    }
  };

  const addProject = async (e) => {
    e.preventDefault();
    if (!newProject.name?.trim()) return;
    setLoading(true);
    await nextTick();
    try {
      await api.createProject({ code: newProject.code || undefined, name: newProject.name });
      setNewProject({ code: '', name: '' });
      load();
    } catch (err) {
      alert(err.message || '등록 실패');
    } finally {
      setLoading(false);
    }
  };

  const [editingAccount, setEditingAccount] = useState(null); // { id, code, name }
  const [editingProject, setEditingProject] = useState(null); // { id, code, name }

  const startEditAccount = (a) => setEditingAccount({ id: a.id, code: a.code || '', name: a.name });
  const startEditProject = (p) => setEditingProject({ id: p.id, code: p.code || '', name: p.name });
  const cancelEditAccount = () => setEditingAccount(null);
  const cancelEditProject = () => setEditingProject(null);

  const saveAccount = async (e) => {
    e?.preventDefault();
    if (!editingAccount?.name?.trim()) return;
    setLoading(true);
    try {
      await api.updateAccountItem(editingAccount.id, { code: editingAccount.code || undefined, name: editingAccount.name });
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
    if (!editingProject?.name?.trim()) return;
    setLoading(true);
    await nextTick();
    try {
      await api.updateProject(editingProject.id, { code: editingProject.code || undefined, name: editingProject.name });
      setEditingProject(null);
      load();
    } catch (err) {
      alert(err.message || '수정 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="masters">
      <ProgressBar loading={loading} />
      <header className="page-header">
        <h1>마스터 관리</h1>
      </header>
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
              placeholder="코드 (선택)"
              value={newAccount.code}
              onChange={e => setNewAccount(a => ({ ...a, code: e.target.value }))}
            />
            <input
              placeholder="항목명 *"
              value={newAccount.name}
              onChange={e => setNewAccount(a => ({ ...a, name: e.target.value }))}
              required
            />
            <button type="submit" className="btn btn-primary">추가</button>
          </form>
          <ul className="master-list">
            {(accountItems || []).map(a => (
              <li key={a.id}>
                {editingAccount?.id === a.id ? (
                  <form className="edit-inline" onSubmit={saveAccount}>
                    <input
                      placeholder="코드"
                      value={editingAccount.code}
                      onChange={e => setEditingAccount(x => ({ ...x, code: e.target.value }))}
                    />
                    <input
                      placeholder="항목명 *"
                      value={editingAccount.name}
                      onChange={e => setEditingAccount(x => ({ ...x, name: e.target.value }))}
                      required
                    />
                    <button type="submit" className="btn btn-sm btn-primary">저장</button>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={cancelEditAccount}>취소</button>
                  </form>
                ) : (
                  <>
                    <span className="code">{a.code || '-'}</span>
                    <span className="name">{a.name}</span>
                    <button type="button" className="btn btn-sm btn-secondary ml" onClick={() => startEditAccount(a)}>수정</button>
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
              placeholder="코드 (선택)"
              value={newProject.code}
              onChange={e => setNewProject(p => ({ ...p, code: e.target.value }))}
            />
            <input
              placeholder="현장명 *"
              value={newProject.name}
              onChange={e => setNewProject(p => ({ ...p, name: e.target.value }))}
              required
            />
            <button type="submit" className="btn btn-primary">추가</button>
          </form>
          <ul className="master-list">
            {(projects || []).map(p => (
              <li key={p.id}>
                {editingProject?.id === p.id ? (
                  <form className="edit-inline" onSubmit={saveProject}>
                    <input
                      placeholder="코드"
                      value={editingProject.code}
                      onChange={e => setEditingProject(x => ({ ...x, code: e.target.value }))}
                    />
                    <input
                      placeholder="현장명 *"
                      value={editingProject.name}
                      onChange={e => setEditingProject(x => ({ ...x, name: e.target.value }))}
                      required
                    />
                    <button type="submit" className="btn btn-sm btn-primary">저장</button>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={cancelEditProject}>취소</button>
                  </form>
                ) : (
                  <>
                    <span className="code">{p.code || '-'}</span>
                    <span className="name">{p.name}</span>
                    <button type="button" className="btn btn-sm btn-secondary ml" onClick={() => startEditProject(p)}>수정</button>
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
