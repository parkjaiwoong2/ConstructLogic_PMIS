import { useState, useEffect } from 'react';
import { api, nextTick } from '../../api';
import ProgressBar from '../../components/ProgressBar';
import './Admin.css';

const COMPANY_ADMIN_MENUS = [
  { path: '/', label: '대시보드' },
  { path: '/expense/new', label: '사용내역 입력' },
  { path: '/expenses', label: '사용내역 조회' },
  { path: '/import', label: 'CSV 임포트' },
  { path: '/approval-processing', label: '결재처리' },
  { path: '/card-management', label: '법인카드 관리' },
  { path: '/masters', label: '마스터 관리' },
  { path: '/settings', label: '내설정' },
  { path: '/admin/company', label: '회사정보관리' },
  { path: '/admin/approval-sequence', label: '결재순서' },
  { path: '/admin/permissions', label: '권한관리' },
  { path: '/admin/edit-history', label: '관리자 수정 히스토리' },
  { path: '/admin/super', label: '관리자관리' },
];

const ROLE_COMPANY_ADMIN = 'company_admin';

export default function RolePermissionsSuper() {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState('');
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    await nextTick();
    try {
      const data = await api.getAdminBatchRolePermissions(companyId || undefined);
      setCompanies(Array.isArray(data?.companies) ? data.companies : []);
      if (!companyId && data?.companies?.length) setCompanyId(String(data.companies.find(c => c.is_default)?.id || data.companies[0]?.id || ''));
      const byRole = data?.roleMenus || {};
      setMenus(Array.isArray(byRole[ROLE_COMPANY_ADMIN]) ? byRole[ROLE_COMPANY_ADMIN] : []);
    } catch (e) {
      setMenus([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [companyId]);

  const toggleMenu = (path) => {
    setMenus(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  const selectAll = () => setMenus(COMPANY_ADMIN_MENUS.map(m => m.path));
  const clearAll = () => setMenus([]);

  const save = async () => {
    if (!companyId) { alert('회사를 선택하세요.'); return; }
    setSaving(true);
    try {
      await api.updateRoleMenus({ role: ROLE_COMPANY_ADMIN, menus, company_id: parseInt(companyId, 10) });
      alert('저장되었습니다.');
      load();
    } catch (err) {
      alert(err?.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page">
      <ProgressBar loading={loading || saving} />
      <header className="page-header">
        <h1>역할관리 (슈퍼관리자)</h1>
      </header>
      <p className="subtitle">
        회사별 관리자(role=admin, is_admin=false)가 접근할 수 있는 메뉴를 설정합니다. 회사를 선택한 후 해당 회사 관리자 메뉴를 설정하세요.
      </p>

      <section className="card">
        <h2>회사 선택</h2>
        <div style={{ marginBottom: '1rem' }}>
          <select value={companyId} onChange={e => setCompanyId(e.target.value)} style={{ minWidth: 200 }}>
            <option value="">회사 선택</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}{c.is_default ? ' (대표)' : ''}</option>)}
          </select>
        </div>
      </section>

      <section className="card settings-section">
        <h2>회사별 관리자 메뉴 권한</h2>
        <p className="desc">회사별 관리자에게 허용할 메뉴를 체크하세요.</p>
        <div style={{ marginBottom: '0.75rem' }}>
          <button type="button" className="btn btn-sm btn-secondary" onClick={selectAll}>전체 선택</button>
          <button type="button" className="btn btn-sm btn-secondary" onClick={clearAll} style={{ marginLeft: '0.5rem' }}>전체 해제</button>
        </div>
        <div className="role-menu-checkboxes">
          {COMPANY_ADMIN_MENUS.map(m => (
            <label key={m.path} className="role-menu-item">
              <input
                type="checkbox"
                checked={menus.includes(m.path)}
                onChange={() => toggleMenu(m.path)}
              />
              <span>{m.label}</span>
            </label>
          ))}
        </div>
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving} style={{ marginTop: '1rem' }}>
          {saving ? '저장 중...' : '저장'}
        </button>
      </section>
    </div>
  );
}
