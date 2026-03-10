import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import ProgressBar from '../components/ProgressBar';
import './ExpenseNew.css';

function formatCurrency(n) {
  return new Intl.NumberFormat('ko-KR').format(n || 0);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function ExpenseNew() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [accountItems, setAccountItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(() => {
    const today = todayStr();
    const defaultUser = typeof localStorage !== 'undefined' ? localStorage.getItem('currentUserName') || '' : '';
    return {
      user_name: defaultUser || '배명수',
      project_id: '',
      project_name: '',
      period_start: today,
      period_end: today,
      card_no: '',
      items: [{ use_date: today, account_item_id: '', account_item_name: '', description: '', card_amount: '', cash_amount: '', mismatchWarning: null }],
    };
  });
  const [loadingMasters, setLoadingMasters] = useState(true);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [popup, setPopup] = useState(null); // { rowIdx, suggestedName, userSelectedName }

  useEffect(() => {
    setLoadingMasters(true);
    Promise.all([api.getAccountItems(), api.getProjects()]).then(([items, projs]) => {
      setAccountItems(items);
      setProjects(projs);
    }).catch(console.error).finally(() => setLoadingMasters(false));
  }, []);

  useEffect(() => {
    if (isEdit && id) {
      setLoadingDoc(true);
      api.getDocument(id).then(doc => {
        if (doc.status !== 'draft') {
          alert('작성중 상태에서만 수정할 수 있습니다. 기안 취소 후 수정해 주세요.');
          navigate(`/documents/${id}`, { replace: true });
          return;
        }
        setForm({
          user_name: doc.user_name,
          project_id: doc.project_id,
          project_name: doc.project_name,
          period_start: doc.period_start,
          period_end: doc.period_end,
          card_no: doc.card_no || '',
          items: doc.items?.length
            ? doc.items.map(i => ({
                use_date: i.use_date,
                account_item_id: i.account_item_id,
                account_item_name: i.account_item_name,
                description: i.description || '',
                card_amount: i.card_amount,
                cash_amount: i.cash_amount || '',
                remark: i.remark || '',
                mismatchWarning: null,
              }))
            : [{ use_date: todayStr(), account_item_id: '', account_item_name: '', description: '', card_amount: '', cash_amount: '', mismatchWarning: null }],
        });
      }).catch(console.error).finally(() => setLoading(false));
    }
  }, [isEdit, id]);

  const syncPeriodFromItems = (items) => {
    const dates = items.map(i => i.use_date).filter(Boolean);
    if (dates.length === 0) return null;
    const minDate = dates.reduce((a, b) => (a < b ? a : b));
    return { period_start: minDate, period_end: todayStr() };
  };

  const suggestAccount = async (desc) => {
    if (!desc?.trim()) return;
    const r = await api.suggestAccount(desc);
    if (r) return r;
    return null;
  };

  const addRow = () => {
    setForm(f => {
      const nextItems = [...f.items, { use_date: todayStr(), account_item_id: '', account_item_name: '', description: '', card_amount: '', cash_amount: '', mismatchWarning: null }];
      const period = syncPeriodFromItems(nextItems);
      return { ...f, items: nextItems, ...(period || {}) };
    });
  };

  const handleDescriptionBlur = async (idx) => {
    const row = form.items[idx];
    const desc = (row.description || '').trim();
    if (!desc) return;
    const suggested = await suggestAccount(desc);
    if (!suggested) return;
    const userSelectedId = row.account_item_id ? String(row.account_item_id) : '';
    const userSelectedName = row.account_item_name || '';
    if (userSelectedId) {
      if (String(suggested.id) === userSelectedId) return;
      setForm(prev => {
        const n = [...prev.items];
        n[idx] = { ...n[idx], mismatchWarning: { suggestedId: suggested.id, suggestedName: suggested.name } };
        return { ...prev, items: n };
      });
      setPopup({ rowIdx: idx, suggestedName: suggested.name, userSelectedName });
    } else {
      setForm(prev => {
        const n = [...prev.items];
        n[idx] = { ...n[idx], account_item_id: suggested.id, account_item_name: suggested.name, mismatchWarning: null };
        return { ...prev, items: n };
      });
    }
  };

  const updateRow = (idx, field, value) => {
    setForm(f => {
      const next = [...f.items];
      next[idx] = { ...next[idx], [field]: value };
      if (field === 'account_item_id') {
        next[idx].mismatchWarning = null;
        const ai = accountItems.find(a => a.id === parseInt(value, 10));
        if (ai) next[idx].account_item_name = ai.name;
      }
      const updated = { ...f, items: next };
      if (field === 'use_date') {
        const period = syncPeriodFromItems(next);
        if (period) Object.assign(updated, period);
      }
      return updated;
    });
  };

  const removeRow = (idx) => {
    if (form.items.length <= 1) return;
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  };

  const setProject = (e) => {
    const v = e.target.value;
    const p = projects.find(x => x.id === parseInt(v, 10) || x.name === v);
    setForm(f => ({ ...f, project_id: p?.id || '', project_name: p?.name || v }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const items = form.items
      .filter(i => i.use_date && i.account_item_id && (i.card_amount || i.cash_amount))
      .map(({ mismatchWarning, ...i }) => ({
        use_date: i.use_date,
        account_item_id: i.account_item_id,
        account_item_name: i.account_item_name,
        description: i.description || '',
        card_amount: parseInt(String(i.card_amount).replace(/,/g, ''), 10) || 0,
        cash_amount: parseInt(String(i.cash_amount).replace(/,/g, ''), 10) || 0,
        remark: i.remark || '',
      }));
    if (items.length === 0) {
      alert('사용일자, 항목, 금액을 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      let docId = id;
      if (isEdit) {
        await api.updateDocument(id, { ...form, items });
        alert('저장되었습니다.');
      } else {
        const r = await api.createDocument({ ...form, items });
        docId = r.id;
        alert('저장되었습니다.');
        navigate(`/documents/${docId}`);
      }
      if (window.confirm('결재를 요청하시겠습니까? (결재함에 올라갑니다)')) {
        await api.submitDocument(docId);
        alert('결재 요청되었습니다. 결재함에서 확인하실 수 있습니다.');
        navigate(`/documents/${docId}`);
      }
    } catch (err) {
      alert(err.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const totalCard = form.items.reduce((s, i) => s + (parseInt(String(i.card_amount).replace(/,/g, ''), 10) || 0), 0);
  const totalCash = form.items.reduce((s, i) => s + (parseInt(String(i.cash_amount).replace(/,/g, ''), 10) || 0), 0);

  const isLoading = loadingMasters || loadingDoc || saving;

  return (
    <div className="expense-new">
      <ProgressBar loading={isLoading} />
      <header className="page-header">
        <h1>{isEdit ? '사용내역 수정' : '카드/현금 사용내역 입력'}</h1>
      </header>

      <form onSubmit={handleSubmit} className="expense-form">
        <section className="card form-section">
          <h2>기본정보</h2>
          <div className="form-row">
            <label>사용자</label>
            <input value={form.user_name} onChange={e => setForm(f => ({ ...f, user_name: e.target.value }))} />
          </div>
          <div className="form-row">
            <label>현장(공사)</label>
            <select value={form.project_id || form.project_name} onChange={setProject}>
              <option value="">선택</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>기간</label>
            <input type="date" value={form.period_start} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))} />
            <span>~</span>
            <input type="date" value={form.period_end} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))} />
          </div>
          <div className="form-row">
            <label>카드번호</label>
            <input placeholder="5585-****-****-****" value={form.card_no} onChange={e => setForm(f => ({ ...f, card_no: e.target.value }))} />
          </div>
        </section>

        <section className="card form-section">
          <div className="section-head">
            <h2>사용내역</h2>
            <button type="button" className="btn-add" onClick={addRow}>+ 행 추가</button>
          </div>
          <div className="table-wrap">
            <table className="expense-table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>항목</th>
                  <th>세부사용내역</th>
                  <th>카드</th>
                  <th>현금</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((row, idx) => (
                  <tr key={idx} className={row.mismatchWarning ? 'row-mismatch' : ''}>
                    <td>
                      <input type="date" value={row.use_date} onChange={e => updateRow(idx, 'use_date', e.target.value)} />
                    </td>
                    <td>
                      <select
                        value={row.account_item_id}
                        onChange={e => updateRow(idx, 'account_item_id', e.target.value)}
                        required
                        className={!row.account_item_id ? 'required' : ''}
                      >
                        <option value="">선택</option>
                        {accountItems.map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        placeholder="세부사용내역 (입력 완료 후 항목 추천)"
                        value={row.description}
                        onChange={e => updateRow(idx, 'description', e.target.value)}
                        onBlur={() => handleDescriptionBlur(idx)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        placeholder="0"
                        value={row.card_amount}
                        onChange={e => updateRow(idx, 'card_amount', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        placeholder="0"
                        value={row.cash_amount}
                        onChange={e => updateRow(idx, 'cash_amount', e.target.value)}
                      />
                    </td>
                    <td>
                      <button type="button" className="btn-remove" onClick={() => removeRow(idx)} title="삭제">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="totals">
            <span>카드 합계: {formatCurrency(totalCard)}원</span>
            <span>현금 합계: {formatCurrency(totalCash)}원</span>
          </div>
        </section>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>취소</button>
        </div>
      </form>

      {popup && (
        <div className="popup-overlay" onClick={() => setPopup(null)}>
          <div className="popup-box" onClick={e => e.stopPropagation()}>
            <h3>항목 확인</h3>
            <p>
              세부사용내역을 기준으로 <strong>"{popup.suggestedName}"</strong>이(가) 추천되었으나,
              현재 <strong>"{popup.userSelectedName}"</strong>이(가) 선택되어 있습니다.
            </p>
            <p className="popup-hint">해당 행이 빨간색으로 표시됩니다. 필요시 항목을 변경해 주세요.</p>
            <button type="button" className="btn btn-primary" onClick={() => setPopup(null)}>확인</button>
          </div>
        </div>
      )}
    </div>
  );
}
