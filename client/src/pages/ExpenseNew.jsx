import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import './ExpenseNew.css';

function formatCurrency(n) {
  return new Intl.NumberFormat('ko-KR').format(n || 0);
}

export default function ExpenseNew() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [accountItems, setAccountItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({
    user_name: '배명수',
    project_id: '',
    project_name: '',
    period_start: '',
    period_end: '',
    card_no: '',
    items: [{ use_date: '', account_item_id: '', account_item_name: '', description: '', card_amount: '', cash_amount: '' }],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getAccountItems().then(setAccountItems);
    api.getProjects().then(setProjects);
  }, []);

  useEffect(() => {
    if (isEdit && id) {
      api.getDocument(id).then(doc => {
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
              }))
            : [{ use_date: '', account_item_id: '', account_item_name: '', description: '', card_amount: '', cash_amount: '' }],
        });
      }).catch(console.error);
    }
  }, [isEdit, id]);

  const suggestAccount = async (desc) => {
    if (!desc?.trim()) return;
    const r = await api.suggestAccount(desc);
    if (r) return r;
    return null;
  };

  const addRow = () => {
    setForm(f => ({ ...f, items: [...f.items, { use_date: '', account_item_id: '', account_item_name: '', description: '', card_amount: '', cash_amount: '' }] }));
  };

  const updateRow = (idx, field, value) => {
    setForm(f => {
      const next = [...f.items];
      next[idx] = { ...next[idx], [field]: value };
      if (field === 'description') {
        suggestAccount(value).then(r => {
          if (r) {
            setForm(prev => {
              const n = [...prev.items];
              n[idx] = { ...n[idx], account_item_id: r.id, account_item_name: r.name };
              return { ...prev, items: n };
            });
          }
        });
      }
      if (field === 'account_item_id') {
        const ai = accountItems.find(a => a.id === parseInt(value, 10));
        if (ai) next[idx].account_item_name = ai.name;
      }
      return { ...f, items: next };
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
      .map(i => ({
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
      if (isEdit) {
        await api.updateDocument(id, { ...form, items });
        alert('저장되었습니다.');
      } else {
        const r = await api.createDocument({ ...form, items });
        alert('저장되었습니다.');
        navigate(`/documents/${r.id}`);
      }
    } catch (err) {
      alert(err.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const totalCard = form.items.reduce((s, i) => s + (parseInt(String(i.card_amount).replace(/,/g, ''), 10) || 0), 0);
  const totalCash = form.items.reduce((s, i) => s + (parseInt(String(i.cash_amount).replace(/,/g, ''), 10) || 0), 0);

  return (
    <div className="expense-new">
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
                  <tr key={idx}>
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
                        placeholder="세부사용내역 (입력 시 항목 자동 추천)"
                        value={row.description}
                        onChange={e => updateRow(idx, 'description', e.target.value)}
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
    </div>
  );
}
