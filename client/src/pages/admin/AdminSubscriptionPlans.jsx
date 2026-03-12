import { useState, useEffect } from 'react';
import { api, nextTick } from '../../api';
import ProgressBar from '../../components/ProgressBar';
import './Admin.css';

function formatPrice(n) {
  if (n == null || n === '') return '';
  if (Number(n) === 0) return '무료';
  return new Intl.NumberFormat('ko-KR').format(Number(n)) + '원';
}

const DEFAULT_LIMITS = { max_users: 10, max_docs_monthly: 100 };

export default function AdminSubscriptionPlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [addForm, setAddForm] = useState(false);
  const [form, setForm] = useState({
    code: '', name: '', description: '', price_monthly: 0, setup_fee: 0, max_users: 10,
    features_json: [], limits_json: {}, display_order: 99, is_trial: false, trial_days: 14,
    is_recommended: false, plan_type: 'basic'
  });

  const load = async () => {
    setLoading(true);
    await nextTick();
    try {
      const data = await api.getSubscriptionPlans();
      setPlans(Array.isArray(data) ? data : []);
    } catch (e) {
      alert(e?.message || '로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({
      code: '', name: '', description: '', price_monthly: 0, setup_fee: 0, max_users: 10,
      features_json: [], limits_json: {}, display_order: 99, is_trial: false, trial_days: 14,
      is_recommended: false, plan_type: 'basic'
    });
    setEditing(null);
    setAddForm(false);
  };

  const startEdit = (plan) => {
    setForm({
      code: plan.code,
      name: plan.name,
      description: plan.description || '',
      price_monthly: plan.price_monthly ?? 0,
      setup_fee: plan.setup_fee ?? 0,
      max_users: plan.max_users ?? 10,
      features_json: Array.isArray(plan.features_json) ? [...plan.features_json] : [],
      limits_json: plan.limits_json && typeof plan.limits_json === 'object' ? { ...plan.limits_json } : {},
      display_order: plan.display_order ?? 99,
      is_trial: !!plan.is_trial,
      trial_days: plan.trial_days ?? 14,
      is_recommended: !!plan.is_recommended,
      plan_type: plan.plan_type === 'unlimited' ? 'unlimited' : 'basic'
    });
    setEditing(plan.id);
    setAddForm(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.code?.trim() || !form.name?.trim()) {
      alert('코드와 이름은 필수입니다.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.updateSubscriptionPlan(editing, {
          ...form,
          features_json: form.features_json,
          limits_json: form.limits_json
        });
        alert('저장되었습니다.');
      } else {
        await api.createSubscriptionPlan({
          ...form,
          features_json: form.features_json,
          limits_json: form.limits_json
        });
        alert('등록되었습니다.');
      }
      resetForm();
      load();
    } catch (err) {
      alert(err?.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('이 요금제를 삭제하시겠습니까? 사용 중인 요금제는 삭제할 수 없습니다.')) return;
    setSaving(true);
    try {
      await api.deleteSubscriptionPlan(id);
      alert('삭제되었습니다.');
      load();
    } catch (err) {
      alert(err?.message || '삭제 실패');
    } finally {
      setSaving(false);
    }
  };

  const updateFeature = (idx, val) => {
    const arr = [...(form.features_json || [])];
    if (idx >= arr.length) arr.push(val);
    else arr[idx] = val;
    setForm(f => ({ ...f, features_json: arr }));
  };

  const removeFeature = (idx) => {
    setForm(f => ({ ...f, features_json: (f.features_json || []).filter((_, i) => i !== idx) }));
  };

  return (
    <div className="admin-page">
      <ProgressBar loading={loading || saving} />
      <header className="page-header">
        <h1>요금제 관리 (슈퍼관리자)</h1>
      </header>
      <p className="subtitle">요금안내 페이지에 노출되는 요금제를 등록·수정·삭제합니다.</p>

      {(addForm || editing) && (
        <section className="card" style={{ marginBottom: '1.5rem' }}>
          <h2>{editing ? '요금제 수정' : '요금제 등록'}</h2>
          <form onSubmit={handleSave} className="admin-form">
            <div className="form-row">
              <label>코드 *</label>
              <input
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                placeholder="예: basic, pro"
                disabled={!!editing}
              />
            </div>
            <div className="form-row">
              <label>이름 *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="예: 베이직" />
            </div>
            <div className="form-row">
              <label>설명</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="요금제 설명" />
            </div>
            <div className="form-row" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <label>월 요금 (원)</label>
                <input type="number" min={0} value={form.price_monthly} onChange={e => setForm(f => ({ ...f, price_monthly: parseInt(e.target.value, 10) || 0 }))} />
              </div>
              <div>
                <label>가입비 (원)</label>
                <input type="number" min={0} value={form.setup_fee} onChange={e => setForm(f => ({ ...f, setup_fee: parseInt(e.target.value, 10) || 0 }))} />
              </div>
              <div>
                <label>최대 사용자</label>
                <input type="number" min={1} value={form.max_users} onChange={e => setForm(f => ({ ...f, max_users: parseInt(e.target.value, 10) || 10 }))} />
              </div>
              <div>
                <label>표시순서</label>
                <input type="number" value={form.display_order} onChange={e => setForm(f => ({ ...f, display_order: parseInt(e.target.value, 10) || 0 }))} />
              </div>
            </div>
            <div className="form-row" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={form.is_trial} onChange={e => setForm(f => ({ ...f, is_trial: e.target.checked }))} />
                무료체험
              </label>
              {form.is_trial && (
                <div>
                  <label>체험일수</label>
                  <input type="number" min={1} value={form.trial_days} onChange={e => setForm(f => ({ ...f, trial_days: parseInt(e.target.value, 10) || 14 }))} style={{ width: 80 }} />
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={form.is_recommended} onChange={e => setForm(f => ({ ...f, is_recommended: e.target.checked }))} />
                추천
              </label>
              <div>
                <label>구분</label>
                <select value={form.plan_type} onChange={e => setForm(f => ({ ...f, plan_type: e.target.value }))}>
                  <option value="basic">기본</option>
                  <option value="unlimited">무제한</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <label>기능 목록 (한 줄씩)</label>
              <div>
                {(form.features_json || []).map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input value={f} onChange={e => updateFeature(i, e.target.value)} placeholder={`기능 ${i + 1}`} style={{ flex: 1 }} />
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => removeFeature(i)}>삭제</button>
                  </div>
                ))}
                <button type="button" className="btn btn-sm" onClick={() => updateFeature((form.features_json || []).length, '')}>+ 기능 추가</button>
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>저장</button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>취소</button>
            </div>
          </form>
        </section>
      )}

      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>요금제 목록</h2>
          {!addForm && !editing && (
            <button type="button" className="btn btn-primary" onClick={() => { setAddForm(true); setEditing(null); setForm({ code: '', name: '', description: '', price_monthly: 0, setup_fee: 0, max_users: 10, features_json: [], limits_json: {}, display_order: 99, is_trial: false, trial_days: 14, is_recommended: false, plan_type: 'basic' }); }}>+ 요금제 등록</button>
          )}
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>순서</th>
              <th>코드</th>
              <th>이름</th>
              <th>월요금</th>
              <th>가입비</th>
              <th>최대인원</th>
              <th>추천</th>
              <th>구분</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(plans || []).map((p) => (
              <tr key={p.id}>
                <td>{p.display_order}</td>
                <td>{p.code}</td>
                <td>{p.name}{p.is_recommended && <span className="badge" style={{ marginLeft: '0.5rem', background: '#2563eb', color: '#fff', fontSize: '0.75rem', padding: '0.15rem 0.4rem', borderRadius: 4 }}>추천</span>}</td>
                <td>{formatPrice(p.price_monthly)}</td>
                <td>{formatPrice(p.setup_fee)}</td>
                <td>{p.max_users}명</td>
                <td>{p.is_recommended ? 'O' : '-'}</td>
                <td>{p.plan_type === 'unlimited' ? '무제한' : '기본'}</td>
                <td>
                  <button type="button" className="btn btn-sm" onClick={() => startEdit(p)}>수정</button>
                  {' '}
                  <button type="button" className="btn btn-sm" style={{ color: '#dc2626' }} onClick={() => handleDelete(p.id)}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
