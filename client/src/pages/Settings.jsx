import { useState, useEffect } from 'react';
import { api, nextTick } from '../api';
import ProgressBar from '../components/ProgressBar';
import './Settings.css';

const CURRENT_USER_KEY = 'currentUserName';

export default function Settings() {
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem(CURRENT_USER_KEY) || '');
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [cards, setCards] = useState([]);
  const [settings, setSettings] = useState({ default_project_id: null });
  const [newCardNo, setNewCardNo] = useState('');
  const [newCardLabel, setNewCardLabel] = useState('');
  const [newCardDefault, setNewCardDefault] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getUsers().then(setUsers).catch(() => []);
    api.getProjects().then(setProjects).catch(() => []);
  }, []);

  const load = async () => {
    if (!currentUser?.trim()) {
      setCards([]);
      setSettings({ default_project_id: null });
      return;
    }
    setLoading(true);
    await nextTick();
    try {
      const [cardsRes, settingsRes] = await Promise.all([
        api.getUserCards(currentUser),
        api.getUserSettings(currentUser),
      ]);
      setCards(Array.isArray(cardsRes) ? cardsRes : []);
      setSettings(settingsRes || { default_project_id: null });
    } catch (e) {
      setCards([]);
      setSettings({ default_project_id: null });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) localStorage.setItem(CURRENT_USER_KEY, currentUser);
  }, [currentUser]);

  const addCard = async (e) => {
    e.preventDefault();
    if (!currentUser?.trim() || !newCardNo?.trim()) {
      alert('사용자를 선택하고 카드번호를 입력하세요.');
      return;
    }
    setSaving(true);
    try {
      await api.createUserCard({ user_name: currentUser, card_no: newCardNo.trim(), label: newCardLabel.trim() || null, is_default: newCardDefault });
      setNewCardNo('');
      setNewCardLabel('');
      setNewCardDefault(false);
      load();
    } catch (err) {
      alert(err.message || '카드 등록 실패');
    } finally {
      setSaving(false);
    }
  };

  const setDefaultCard = async (id) => {
    setSaving(true);
    try {
      await api.updateUserCard(id, { is_default: true });
      load();
    } catch (err) {
      alert(err.message || '기본 설정 실패');
    } finally {
      setSaving(false);
    }
  };

  const deleteCard = async (id) => {
    if (!confirm('이 카드를 삭제하시겠습니까?')) return;
    setSaving(true);
    try {
      await api.deleteUserCard(id);
      load();
    } catch (err) {
      alert(err.message || '삭제 실패');
    } finally {
      setSaving(false);
    }
  };

  const saveDefaultProject = async (projectId) => {
    if (!currentUser?.trim()) return;
    setSaving(true);
    try {
      const res = await api.updateUserSettings({ user_name: currentUser, default_project_id: projectId || null });
      setSettings(res);
    } catch (err) {
      alert(err.message || '설정 저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const defaultProject = projects.find(p => p.id === settings.default_project_id);

  return (
    <div className="settings-page">
      <ProgressBar loading={loading || saving} />
      <header className="page-header">
        <h1>내 설정</h1>
      </header>
      <p className="subtitle">카드 등록 및 기본 현장을 설정합니다. 사용내역 입력·CSV 임포트 시 기본값으로 적용됩니다.</p>

      <section className="card settings-section">
        <h2>사용자 선택</h2>
        <div className="form-row">
          <label>현재 사용자</label>
          <select value={currentUser} onChange={e => setCurrentUser(e.target.value)}>
            <option value="">선택</option>
            {users.map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </section>

      {currentUser && (
        <>
          <section className="card settings-section">
            <h2>등록 카드</h2>
            <form onSubmit={addCard} className="add-card-form">
              <input placeholder="카드번호 (예: 5585-****-****-****)" value={newCardNo} onChange={e => setNewCardNo(e.target.value)} />
              <input placeholder="라벨 (선택, 예: 법인카드1)" value={newCardLabel} onChange={e => setNewCardLabel(e.target.value)} />
              <label className="checkbox-label">
                <input type="checkbox" checked={newCardDefault} onChange={e => setNewCardDefault(e.target.checked)} />
                기본으로 설정
              </label>
              <button type="submit" className="btn btn-primary" disabled={saving}>추가</button>
            </form>
            <ul className="card-list">
              {cards.map(c => (
                <li key={c.id}>
                  <span className="card-info">
                    <strong>{c.label || c.card_no}</strong>
                    {c.label && <span className="card-no">{c.card_no}</span>}
                  </span>
                  {c.is_default && <span className="badge">기본</span>}
                  <span className="actions">
                    {!c.is_default && (
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => setDefaultCard(c.id)} disabled={saving}>기본 설정</button>
                    )}
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => deleteCard(c.id)} disabled={saving}>삭제</button>
                  </span>
                </li>
              ))}
            </ul>
            {cards.length === 0 && <p className="empty-msg">등록된 카드가 없습니다.</p>}
          </section>

          <section className="card settings-section">
            <h2>기본 현장</h2>
            <p className="desc">사용내역 입력·CSV 임포트 시 선택한 현장이 기본으로 적용됩니다.</p>
            <div className="form-row">
              <select
                value={settings.default_project_id ?? ''}
                onChange={e => saveDefaultProject(e.target.value || null)}
                disabled={saving}
              >
                <option value="">선택 안 함</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            {defaultProject && <p className="current-default">현재 기본: <strong>{defaultProject.name}</strong></p>}
          </section>
        </>
      )}
    </div>
  );
}
