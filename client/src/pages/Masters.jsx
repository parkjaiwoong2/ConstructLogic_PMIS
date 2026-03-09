import { useState, useEffect } from 'react';
import { api } from '../api';
import './Masters.css';

export default function Masters() {
  const [accountItems, setAccountItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [newAccount, setNewAccount] = useState({ code: '', name: '' });
  const [newProject, setNewProject] = useState({ code: '', name: '' });

  const load = () => {
    api.getAccountItems().then(setAccountItems);
    api.getProjects().then(setProjects);
  };

  useEffect(load, []);

  const addAccount = async (e) => {
    e.preventDefault();
    if (!newAccount.name?.trim()) return;
    try {
      await api.createAccountItem({ code: newAccount.code || undefined, name: newAccount.name });
      setNewAccount({ code: '', name: '' });
      load();
    } catch (err) {
      alert(err.message || '등록 실패');
    }
  };

  const addProject = async (e) => {
    e.preventDefault();
    if (!newProject.name?.trim()) return;
    try {
      await api.createProject({ code: newProject.code || undefined, name: newProject.name });
      setNewProject({ code: '', name: '' });
      load();
    } catch (err) {
      alert(err.message || '등록 실패');
    }
  };

  return (
    <div className="masters">
      <header className="page-header">
        <h1>마스터 관리</h1>
      </header>

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
            {accountItems.map(a => (
              <li key={a.id}>
                <span className="code">{a.code}</span>
                <span className="name">{a.name}</span>
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
            {projects.map(p => (
              <li key={p.id}>
                <span className="code">{p.code || '-'}</span>
                <span className="name">{p.name}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
