import { useState, useEffect } from 'react';
import { api, nextTick } from '../api';
import { useAuth } from '../contexts/AuthContext';
import ProgressBar from '../components/ProgressBar';
import './Settings.css';

const CURRENT_USER_KEY = 'currentUserName';

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.is_admin === true;
  const selfName = user?.name || '';
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem(CURRENT_USER_KEY) || '');
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState('');
  const [projects, setProjects] = useState([]);
  const [cards, setCards] = useState([]);
  const [settings, setSettings] = useState({ default_project_id: null });
  const [newCardNo, setNewCardNo] = useState('');
  const [newCardLabel, setNewCardLabel] = useState('');
  const [newCardDefault, setNewCardDefault] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [corporateCards, setCorporateCards] = useState([]);
  const [userCompanyId, setUserCompanyId] = useState(null);

  useEffect(() => {
    api.getCompanies({ list: 1, mine: 1 }).then(list => {
      const arr = Array.isArray(list) ? list : [];
      setCompanies(arr);
      const def = arr.length === 1 ? arr[0] : (arr.find(c => String(c.id) === String(user?.company_id)) || arr.find(c => c.is_default) || arr[0]);
      if (def) setCompanyId(String(def.id));
    }).catch(() => setCompanies([]));
    if (!isAdmin) {
      setUsers([]);
      setCurrentUser(selfName);
    }
  }, [isAdmin, selfName]);

  const showCompanySelect = isAdmin && companies.length > 1;
  const effectiveCompanyIdForUsers = (showCompanySelect && companyId) ? parseInt(companyId, 10) : (user?.company_id ?? null);

  useEffect(() => {
    if (!isAdmin) return;
    const params = effectiveCompanyIdForUsers ? { company_id: effectiveCompanyIdForUsers } : {};
    api.getAdminUsers(params)
      .then(u => {
        const rows = Array.isArray(u) ? u : (u?.rows ?? []);
        const hasSelf = rows.some(x => x?.name === selfName);
        const list = hasSelf ? rows : [{ id: 0, name: selfName }, ...rows];
        setUsers(list);
        setCurrentUser(prev => {
          const inList = list.some(x => x?.name === prev);
          if (inList) return prev;
          const selfIn = list.find(x => x?.name === selfName);
          if (selfIn) return selfName;
          return list[0]?.name ?? prev;
        });
      })
      .catch(() => setUsers([]));
  }, [isAdmin, selfName, effectiveCompanyIdForUsers]);

  const effectiveUser = isAdmin ? currentUser : selfName;

  const load = async () => {
    if (!effectiveUser?.trim()) {
      setCards([]);
      setSettings({ default_project_id: null });
      return;
    }
    setLoading(true);
    await nextTick();
    try {
      const [cardsRes, settingsRes] = await Promise.all([
        api.getUserCards(effectiveUser, false, effectiveCompanyId || undefined),
        api.getUserSettings(effectiveUser),
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
  }, [effectiveUser, companyId]);

  const singleCompanyOnly = companies.length === 1;
  const effectiveCompanyId = showCompanySelect ? (companyId ? parseInt(companyId, 10) : null) : (user?.company_id ?? null);
  const canManageCards = !!effectiveCompanyId;

  useEffect(() => {
    if (!effectiveUser?.trim()) {
      setUserCompanyId(null);
      return;
    }
    api.getUserCompany(effectiveUser).then(r => setUserCompanyId(r?.company_id ?? null)).catch(() => setUserCompanyId(null));
  }, [effectiveUser]);

  useEffect(() => {
    if (!effectiveCompanyId) {
      setCorporateCards([]);
      return;
    }
    api.getCorporateCards(effectiveCompanyId).then(list => setCorporateCards(Array.isArray(list) ? list : [])).catch(() => setCorporateCards([]));
  }, [effectiveCompanyId]);

  useEffect(() => {
    if (effectiveCompanyId) {
      api.getProjects(effectiveCompanyId).then(list => setProjects(Array.isArray(list) ? list : [])).catch(() => setProjects([]));
    } else {
      setProjects([]);
    }
  }, [effectiveCompanyId]);

  useEffect(() => {
    if (effectiveUser) localStorage.setItem(CURRENT_USER_KEY, effectiveUser);
  }, [effectiveUser]);

  const addCard = async (e) => {
    e.preventDefault();
    if (!effectiveUser?.trim() || !newCardNo?.trim()) {
      alert('사용자를 선택하고 카드번호를 입력하세요.');
      return;
    }
    setSaving(true);
    try {
      await api.createUserCard({ user_name: effectiveUser, card_no: newCardNo.trim(), label: newCardLabel.trim() || null, is_default: newCardDefault, company_id: effectiveCompanyId || undefined });
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
    if (!canManageCards) return;
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
    if (!effectiveUser?.trim()) return;
    setSaving(true);
    try {
      const res = await api.updateUserSettings({ user_name: effectiveUser, default_project_id: projectId || null });
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

      <section className="card settings-section" style={{ marginBottom: '1rem' }}>
        <h3>회사 선택</h3>
        <div className="form-row" style={{ marginTop: '0.5rem' }}>
          <select
            value={companyId || ''}
            onChange={e => setCompanyId(e.target.value || '')}
            style={{ minWidth: 180 }}
            disabled={singleCompanyOnly || companies.length <= 1}
          >
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.is_default ? ' (대표)' : ''}</option>
            ))}
          </select>
          {showCompanySelect && !canManageCards && (
            <span style={{ color: '#6b7280', fontSize: '0.9rem', marginLeft: '0.5rem' }}>카드 등록을 위해 회사를 선택하세요.</span>
          )}
        </div>
      </section>

      <section className="card settings-section">
        <h2>사용자 선택</h2>
        <div className="form-row">
          <label>현재 사용자</label>
          {isAdmin ? (
            <select value={currentUser} onChange={e => setCurrentUser(e.target.value)}>
              <option value="">선택</option>
              {users.map(u => (
                <option key={u.id} value={u.name}>{u.name}{u.email ? ` (${u.email})` : ''}</option>
              ))}
            </select>
          ) : (
            <input type="text" value={selfName} readOnly disabled style={{ background: '#f5f5f5', color: '#666' }} />
          )}
        </div>
        {isAdmin && <p className="desc">관리자는 모든 사용자의 카드·기본 현장을 설정할 수 있습니다.</p>}
      </section>

      {effectiveUser && (
        <>
          <section className="card settings-section">
            <h2>등록 카드</h2>
            {!canManageCards && showCompanySelect && (
              <p className="desc" style={{ marginBottom: '1rem', color: '#6b7280' }}>위에서 회사를 선택하면 해당 회사에 카드를 등록할 수 있습니다.</p>
            )}
            {canManageCards && corporateCards.length > 0 && (
              <div className="form-row" style={{ marginBottom: '0.75rem' }}>
                <label>법인카드에서 선택</label>
                <select
                  value=""
                  onChange={e => {
                    const v = e.target.value;
                    if (v) {
                      const card = corporateCards.find(c => String(c.id) === v);
                      if (card) {
                        setNewCardNo(card.card_no);
                        setNewCardLabel(card.label || '');
                      }
                    }
                  }}
                  style={{ minWidth: 200 }}
                >
                  <option value="">-- 법인카드 선택 (선택 시 아래 필드에 자동 입력) --</option>
                  {corporateCards.map(c => (
                    <option key={c.id} value={c.id}>{c.label || c.card_no} {c.label && `(${c.card_no})`}</option>
                  ))}
                </select>
              </div>
            )}
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
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => setDefaultCard(c.id)} disabled={saving || !canManageCards}>기본 설정</button>
                    )}
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => deleteCard(c.id)} disabled={saving || !canManageCards}>삭제</button>
                  </span>
                </li>
              ))}
            </ul>
            {cards.length === 0 && <p className="empty-msg">등록된 카드가 없습니다.</p>}
          </section>

          <section className="card settings-section">
            <h2>기본 현장</h2>
            <p className="desc">사용내역 입력·CSV 임포트 시 선택한 현장이 기본으로 적용됩니다. 회사를 선택하면 해당 회사의 현장만 표시됩니다.</p>
            <div className="form-row">
              <select
                value={settings.default_project_id ?? ''}
                onChange={e => saveDefaultProject(e.target.value ? parseInt(e.target.value, 10) : null)}
                disabled={saving || !effectiveCompanyId}
              >
                <option value="">{effectiveCompanyId ? '선택 안 함' : '회사를 먼저 선택하세요'}</option>
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
