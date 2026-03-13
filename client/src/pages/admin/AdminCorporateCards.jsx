import { useState, useEffect } from 'react';
import { api, nextTick } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import ProgressBar from '../../components/ProgressBar';
import './Admin.css';

export default function AdminCorporateCards() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState('');
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addForm, setAddForm] = useState({ card_no: '', label: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ card_no: '', label: '' });

  const loadCompanies = async () => {
    try {
      const list = await api.getCompanies({ list: 1, mine: 1 }) || [];
      setCompanies(list);
      const arr = list;
      const def = arr.length === 1 ? arr[0] : (arr.find(c => c.id === user?.company_id) || arr[0]);
      if (def && !companyId) setCompanyId(String(def.id));
    } catch (e) {
      setCompanies([]);
    }
  };

  const loadCards = async () => {
    setLoading(true);
    await nextTick();
    try {
      const list = await api.getCorporateCards(companyId || undefined);
      setCards(Array.isArray(list) ? list : []);
    } catch (e) {
      setCards([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCompanies(); }, []);
  useEffect(() => { loadCards(); }, [companyId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!companyId || !addForm.card_no?.trim()) {
      alert('회사를 선택하고 카드번호를 입력하세요.');
      return;
    }
    setSaving(true);
    try {
      await api.createCorporateCard({ company_id: companyId, card_no: addForm.card_no.trim(), label: addForm.label.trim() || null });
      setAddForm({ card_no: '', label: '' });
      loadCards();
    } catch (err) {
      alert(err?.message || '등록 실패');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (card) => {
    setEditingId(card.id);
    setEditForm({ card_no: card.card_no, label: card.label || '' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ card_no: '', label: '' });
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editForm.card_no?.trim()) return;
    setSaving(true);
    try {
      await api.updateCorporateCard(editingId, { card_no: editForm.card_no.trim(), label: editForm.label.trim() || null });
      cancelEdit();
      loadCards();
    } catch (err) {
      alert(err?.message || '수정 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('이 법인카드를 삭제하시겠습니까?')) return;
    setSaving(true);
    try {
      await api.deleteCorporateCard(id);
      loadCards();
    } catch (err) {
      alert(err?.message || '삭제 실패');
    } finally {
      setSaving(false);
    }
  };

  const getCompanyName = (cid) => companies.find(c => c.id === cid)?.name || '-';

  return (
    <div className="admin-page">
      <ProgressBar loading={loading || saving} />
      <header className="page-header">
        <h1>법인카드 관리</h1>
      </header>
      <p className="subtitle">회사별 법인카드를 등록합니다. 등록된 카드는 내 설정의 카드설정에서 선택하여 사용자에게 연결할 수 있습니다.</p>

      <section className="card settings-section">
        <h2>필터 및 추가</h2>
        <div className="form-row">
          <label>회사</label>
          <select value={companyId} onChange={e => setCompanyId(e.target.value)} disabled={companies.length === 1}>
            <option value="">전체</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.id === user?.company_id ? ' (대표)' : ''}</option>
            ))}
          </select>
        </div>
        <form onSubmit={handleAdd} className="add-card-form" style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <input
            placeholder="카드번호 (예: 5585-****-****-****)"
            value={addForm.card_no}
            onChange={e => setAddForm(f => ({ ...f, card_no: e.target.value }))}
            style={{ minWidth: 200 }}
          />
          <input
            placeholder="라벨 (선택)"
            value={addForm.label}
            onChange={e => setAddForm(f => ({ ...f, label: e.target.value }))}
            style={{ minWidth: 120 }}
          />
          <button type="submit" className="btn btn-primary" disabled={saving || !companyId}>추가</button>
        </form>
      </section>

      <section className="card settings-section" style={{ marginTop: '1rem' }}>
        <h2>법인카드 목록</h2>
        <div className="admin-users-table-wrap">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>회사</th>
                <th>카드번호</th>
                <th>라벨</th>
                <th>등록일</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {cards.map(c => (
                <tr key={c.id}>
                  <td>{getCompanyName(c.company_id)}</td>
                  <td>
                    {editingId === c.id ? (
                      <input
                        className="input-sm"
                        value={editForm.card_no}
                        onChange={e => setEditForm(f => ({ ...f, card_no: e.target.value }))}
                      />
                    ) : (
                      c.card_no
                    )}
                  </td>
                  <td>
                    {editingId === c.id ? (
                      <input
                        className="input-sm"
                        value={editForm.label}
                        onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}
                        placeholder="라벨"
                      />
                    ) : (
                      c.label || '-'
                    )}
                  </td>
                  <td>{c.created_at ? new Date(c.created_at).toLocaleDateString('ko-KR') : '-'}</td>
                  <td>
                    {editingId === c.id ? (
                      <>
                        <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveEdit} disabled={saving}>저장</button>
                        <button type="button" className="btn btn-sm" onClick={cancelEdit} style={{ marginLeft: '0.25rem' }}>취소</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="btn btn-sm" onClick={() => startEdit(c)}>수정</button>
                        <button type="button" className="btn btn-sm" onClick={() => handleDelete(c.id)} style={{ color: '#c00', marginLeft: '0.25rem' }}>삭제</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {cards.length === 0 && !loading && (
          <p className="admin-users-empty">등록된 법인카드가 없습니다. 회사를 선택한 후 카드를 추가하세요.</p>
        )}
      </section>
    </div>
  );
}
