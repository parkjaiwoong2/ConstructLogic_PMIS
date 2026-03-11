import { useState, useEffect } from 'react';
import { api, nextTick } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import ProgressBar from '../../components/ProgressBar';
import './Admin.css';

export default function AdminApprovalSequence() {
  const { company } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [sequences, setSequences] = useState([]);
  const [roles, setRoles] = useState([]);
  const [autoApprove, setAutoApprove] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addRole, setAddRole] = useState('');

  const defaultCompanyId = company?.id ?? null;

  const load = async (companyId) => {
    setLoading(true);
    await nextTick();
    try {
      const data = await api.getAdminBatchApprovalSequence({ company_id: companyId ?? defaultCompanyId });
      setCompanies(Array.isArray(data?.companies) ? data.companies : []);
      const defCompany = (data?.companies || []).find(c => c.is_default) || (data?.companies || [])[0];
      const cid = companyId ?? data?.company?.id ?? defCompany?.id ?? defaultCompanyId;
      setSelectedCompanyId(cid);
      setRoles(Array.isArray(data?.roles) ? data.roles : []);
      setSequences(Array.isArray(data?.sequences) ? data.sequences : []);
      setAutoApprove(data?.auto_approve ?? false);
    } catch (e) {
      alert(e.message || '로드 실패');
    } finally {
      setLoading(false);
    }
  };

  const loadForCompany = async (cid) => {
    setLoading(true);
    await nextTick();
    try {
      const data = await api.getAdminBatchApprovalSequence({ company_id: cid });
      setSequences(Array.isArray(data?.sequences) ? data.sequences : []);
      setAutoApprove(data?.auto_approve ?? false);
    } catch (e) {
      alert(e.message || '로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCompanyChange = (e) => {
    const val = e.target.value;
    const cid = val === '' || val === 'all' ? null : parseInt(val, 10);
    setSelectedCompanyId(cid);
    if (cid) loadForCompany(cid);
    else load();
  };

  const roleLabel = (code) => roles.find(r => r.code === code)?.label ?? code;

  const availableRoles = roles
    .filter(r => r.code !== 'admin' && r.code !== 'author')
    .filter(r => !sequences.some(s => s.role === r.code));

  const move = (idx, dir) => {
    const next = [...sequences];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setSequences(next.map((s, i) => ({ ...s, sort_order: i + 1 })));
  };

  const addToSequence = () => {
    if (!addRole) return;
    const r = roles.find(x => x.code === addRole);
    if (!r) return;
    setSequences(prev => [...prev, { role: r.code, sort_order: prev.length + 1 }]);
    setAddRole('');
  };

  const removeFromSequence = (idx) => {
    setSequences(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, sort_order: i + 1 })));
  };

  const save = async () => {
    if (!selectedCompanyId) {
      alert('회사를 선택한 후 저장하세요.');
      return;
    }
    setLoading(true);
    try {
      await api.updateApprovalSequences({ company_id: selectedCompanyId, sequences });
      alert('저장되었습니다.');
      loadForCompany(selectedCompanyId);
    } catch (err) {
      alert(err.message || '저장 실패');
    } finally {
      setLoading(false);
    }
  };

  const saveAutoApprove = async () => {
    if (!selectedCompanyId) {
      alert('회사를 선택한 후 저장하세요.');
      return;
    }
    setSaving(true);
    try {
      await api.updateCompanySettings({ company_id: selectedCompanyId, auto_approve: autoApprove });
      alert('저장되었습니다.');
      loadForCompany(selectedCompanyId);
    } catch (err) {
      alert(err.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page">
      <ProgressBar loading={loading} />
      <header className="page-header">
        <h1>결재순서</h1>
      </header>
      <p className="subtitle">결재자의 승인 순서를 지정합니다. 사용자 권한의 역할을 추가한 후 여기에서 결재 순서로 배치할 수 있습니다.</p>
      <section className="card" style={{ marginBottom: '1rem' }}>
        <h3>회사 선택</h3>
        <div className="form-row" style={{ marginTop: '0.5rem' }}>
          <select value={selectedCompanyId ?? ''} onChange={handleCompanyChange} style={{ minWidth: 180 }}>
            <option value="">회사 선택</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{c.is_default ? ' (대표)' : ''}
              </option>
            ))}
          </select>
        </div>
      </section>
      <section className="card">
        <p className="desc">역할 추가: 결재에 참여할 역할을 선택 후 추가. 작성자(author)와 관리자(admin)는 제외됩니다.</p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <select value={addRole} onChange={e => setAddRole(e.target.value)} style={{ minWidth: 140 }}>
            <option value="">역할 선택</option>
            {availableRoles.map(r => (
              <option key={r.id} value={r.code}>{r.label} ({r.code})</option>
            ))}
          </select>
          <button type="button" className="btn btn-primary btn-sm" onClick={addToSequence} disabled={!addRole}>
            결재순서에 추가
          </button>
        </div>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {sequences.map((s, i) => (
            <li key={`${s.role}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span>{i + 1}.</span>
              <strong>{roleLabel(s.role)}</strong>
              <span className="role-code">({s.role})</span>
              <button type="button" className="btn btn-sm" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button type="button" className="btn btn-sm" onClick={() => move(i, 1)} disabled={i === sequences.length - 1}>↓</button>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => removeFromSequence(i)}>삭제</button>
            </li>
          ))}
        </ul>
        {sequences.length === 0 && <p className="desc">역할을 추가하여 결재 순서를 설정하세요.</p>}
        <button className="btn btn-primary" onClick={save} disabled={loading} style={{ marginTop: '1rem' }}>저장</button>
      </section>

      <section className="card" style={{ marginTop: '1rem' }}>
        <h3>자동승인</h3>
        <div className="form-row checkbox-label" style={{ marginTop: '0.5rem' }}>
          <label>
            <input type="checkbox" checked={autoApprove} onChange={e => setAutoApprove(e.target.checked)} />
            자동승인 (결재자 없이 제출 시 즉시 승인)
          </label>
        </div>
        <button className="btn btn-primary" onClick={saveAutoApprove} disabled={saving || !selectedCompanyId} style={{ marginTop: '0.5rem' }}>
          {saving ? '저장 중...' : '저장'}
        </button>
      </section>
    </div>
  );
}
