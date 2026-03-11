import { useState, useEffect } from 'react';
import { api, nextTick } from '../../api';
import ProgressBar from '../../components/ProgressBar';
import './Admin.css';

export default function MastersSuper() {
  const [accountItems, setAccountItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: '' });
  const [newProject, setNewProject] = useState({ name: '' });
  const [editingAccount, setEditingAccount] = useState(null);
  const [editingProject, setEditingProject] = useState(null);

  const load = async () => {
    setLoading(true);
    await nextTick();
    try {
      const [items, projs] = await Promise.all([
        api.getMasterTemplatesAccountItems(),
        api.getMasterTemplatesProjects(),
      ]);
      setAccountItems(Array.isArray(items) ? items : []);
      setProjects(Array.isArray(projs) ? projs : []);
    } catch (e) {
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
    try {
      await api.createMasterTemplateAccountItem({ name: newAccount.name });
      setNewAccount({ name: '' });
      load();
    } catch (err) {
      alert(err?.message || '등록 실패');
    } finally {
      setLoading(false);
    }
  };

  const addProject = async (e) => {
    e.preventDefault();
    if (!newProject.name?.trim()) return;
    setLoading(true);
    try {
      await api.createMasterTemplateProject({ name: newProject.name });
      setNewProject({ name: '' });
      load();
    } catch (err) {
      alert(err?.message || '등록 실패');
    } finally {
      setLoading(false);
    }
  };

  const saveAccount = async (e) => {
    e?.preventDefault();
    if (!editingAccount?.name?.trim()) return;
    setLoading(true);
    try {
      await api.updateMasterTemplateAccountItem(editingAccount.id, { name: editingAccount.name });
      setEditingAccount(null);
      load();
    } catch (err) {
      alert(err?.message || '수정 실패');
    } finally {
      setLoading(false);
    }
  };

  const saveProject = async (e) => {
    e?.preventDefault();
    if (!editingProject?.name?.trim()) return;
    setLoading(true);
    try {
      await api.updateMasterTemplateProject(editingProject.id, { name: editingProject.name });
      setEditingProject(null);
      load();
    } catch (err) {
      alert(err?.message || '수정 실패');
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = async (id) => {
    if (!confirm('이 템플릿 항목을 삭제하시겠습니까?')) return;
    setLoading(true);
    try {
      await api.deleteMasterTemplateAccountItem(id);
      setEditingAccount(null);
      load();
    } catch (err) {
      alert(err?.message || '삭제 실패');
    } finally {
      setLoading(false);
    }
  };

  const deleteProject = async (id) => {
    if (!confirm('이 템플릿 현장을 삭제하시겠습니까?')) return;
    setLoading(true);
    try {
      await api.deleteMasterTemplateProject(id);
      setEditingProject(null);
      load();
    } catch (err) {
      alert(err?.message || '삭제 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-page">
      <ProgressBar loading={loading} />
      <header className="page-header">
        <h1>마스터관리 (슈퍼관리자)</h1>
      </header>
      <p className="subtitle">여기에 등록한 계정과목·현장은 신규 회사 생성 시 자동으로 해당 회사의 마스터에 복사됩니다.</p>

      <div className="masters-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
        <section className="card settings-section">
          <h2>계정과목 템플릿</h2>
          <form onSubmit={addAccount} className="add-form" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <input
              placeholder="항목명 *"
              value={newAccount.name}
              onChange={e => setNewAccount(a => ({ ...a, name: e.target.value }))}
              required
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary">추가</button>
          </form>
          <ul className="master-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {accountItems.map(a => (
              <li key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0', borderBottom: '1px solid #eee' }}>
                {editingAccount?.id === a.id ? (
                  <form onSubmit={saveAccount} style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                    <input value={editingAccount.name} onChange={e => setEditingAccount(x => ({ ...x, name: e.target.value }))} required style={{ flex: 1 }} />
                    <button type="submit" className="btn btn-sm btn-primary">저장</button>
                    <button type="button" className="btn btn-sm" onClick={() => setEditingAccount(null)}>취소</button>
                  </form>
                ) : (
                  <>
                    <span style={{ color: '#666', minWidth: 80 }}>{a.code || '-'}</span>
                    <span style={{ flex: 1 }}>{a.name}</span>
                    <button type="button" className="btn btn-sm" onClick={() => setEditingAccount({ id: a.id, name: a.name })}>수정</button>
                    <button type="button" className="btn btn-sm" onClick={() => deleteAccount(a.id)} style={{ color: '#c00' }}>삭제</button>
                  </>
                )}
              </li>
            ))}
          </ul>
          {accountItems.length === 0 && !loading && <p style={{ color: '#666', marginTop: '0.5rem' }}>등록된 항목 없음</p>}
        </section>

        <section className="card settings-section">
          <h2>현장 템플릿</h2>
          <form onSubmit={addProject} className="add-form" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <input
              placeholder="현장명 *"
              value={newProject.name}
              onChange={e => setNewProject(p => ({ ...p, name: e.target.value }))}
              required
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary">추가</button>
          </form>
          <ul className="master-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {projects.map(p => (
              <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0', borderBottom: '1px solid #eee' }}>
                {editingProject?.id === p.id ? (
                  <form onSubmit={saveProject} style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                    <input value={editingProject.name} onChange={e => setEditingProject(x => ({ ...x, name: e.target.value }))} required style={{ flex: 1 }} />
                    <button type="submit" className="btn btn-sm btn-primary">저장</button>
                    <button type="button" className="btn btn-sm" onClick={() => setEditingProject(null)}>취소</button>
                  </form>
                ) : (
                  <>
                    <span style={{ color: '#666', minWidth: 80 }}>{p.code || '-'}</span>
                    <span style={{ flex: 1 }}>{p.name}</span>
                    <button type="button" className="btn btn-sm" onClick={() => setEditingProject({ id: p.id, name: p.name })}>수정</button>
                    <button type="button" className="btn btn-sm" onClick={() => deleteProject(p.id)} style={{ color: '#c00' }}>삭제</button>
                  </>
                )}
              </li>
            ))}
          </ul>
          {projects.length === 0 && !loading && <p style={{ color: '#666', marginTop: '0.5rem' }}>등록된 현장 없음</p>}
        </section>
      </div>
    </div>
  );
}
