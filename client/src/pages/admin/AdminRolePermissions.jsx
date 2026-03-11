import { useState, useEffect } from 'react';
import { api, nextTick } from '../../api';
import ProgressBar from '../../components/ProgressBar';
import './Admin.css';

const ALL_MENUS = [
  { path: '/', label: '대시보드' },
  { path: '/expense/new', label: '사용내역 입력' },
  { path: '/expenses', label: '사용내역 조회' },
  { path: '/import', label: 'CSV 임포트' },
  { path: '/documents', label: '결재 문서' },
  { path: '/approval', label: '결재함' },
  { path: '/card-settlement', label: '카드정산' },
  { path: '/masters', label: '마스터 관리' },
  { path: '/settings', label: '내 설정' },
  { path: '/admin/company', label: '회사 등록' },
  { path: '/admin/users', label: '사용자 권한' },
  { path: '/admin/role-permissions', label: '역할권한' },
  { path: '/admin/approval-sequence', label: '결재순서' },
];

export default function AdminRolePermissions() {
  const [roles, setRoles] = useState([]);
  const [roleMenus, setRoleMenus] = useState({});
  const [loading, setLoading] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ adding: false, editing: null, code: '', label: '' });

  const load = async () => {
    setLoading(true);
    await nextTick();
    try {
      const data = await api.getAdminBatchRolePermissions();
      setRoles(Array.isArray(data?.roles) ? data.roles : []);
      setRoleMenus(data?.roleMenus && typeof data.roleMenus === 'object' ? data.roleMenus : {});
    } catch (e) {
      alert(e?.message || '로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleMenu = (path) => {
    if (!editingRole) return;
    const list = roleMenus[editingRole] || [];
    const next = list.includes(path) ? list.filter(p => p !== path) : [...list, path];
    setRoleMenus(r => ({ ...r, [editingRole]: next }));
  };

  const addRole = async (e) => {
    e.preventDefault();
    if (!roleForm.label?.trim()) {
      alert('역할 이름을 입력하세요.');
      return;
    }
    try {
      await api.createAdminRole({ label: roleForm.label.trim() });
      setRoleForm({ adding: false, editing: null, code: '', label: '' });
      alert('역할이 등록되었습니다.');
      load();
    } catch (err) {
      alert(err.message || '등록 실패');
    }
  };

  const updateRole = async (e) => {
    e.preventDefault();
    if (!roleForm.editing || !roleForm.label?.trim()) return;
    try {
      await api.updateAdminRole(roleForm.editing, { label: roleForm.label.trim() });
      setRoleForm({ adding: false, editing: null, code: '', label: '' });
      alert('역할이 수정되었습니다.');
      load();
    } catch (err) {
      alert(err.message || '수정 실패');
    }
  };

  const deleteRole = async (id) => {
    const r = roles.find(x => x.id === id);
    if (!r) return;
    if (r.code === 'admin') {
      alert('관리자 역할은 삭제할 수 없습니다.');
      return;
    }
    if (!confirm(`"${r.label}" 역할을 삭제하시겠습니까?`)) return;
    try {
      await api.deleteAdminRole(id);
      if (editingRole === r.code) setEditingRole(null);
      setRoleForm({ adding: false, editing: null, code: '', label: '' });
      load();
    } catch (err) {
      alert(err.message || '삭제 실패');
    }
  };

  const saveRoleMenus = async () => {
    if (!editingRole) return;
    try {
      await api.updateRoleMenus({ role: editingRole, menus: roleMenus[editingRole] || [] });
      alert('저장되었습니다.');
      load();
    } catch (err) {
      alert(err.message || '저장 실패');
    }
  };

  return (
    <div className="admin-page">
      <ProgressBar loading={loading} />
      <header className="page-header">
        <h1>역할권한</h1>
      </header>
      <p className="subtitle">역할을 추가·수정·삭제하고, 역할별 메뉴 접근 권한을 설정합니다.</p>

      <section className="card">
        <h2>역할 관리</h2>
        <p className="desc">역할을 추가·수정·삭제합니다. 관리자 역할은 삭제할 수 없습니다.</p>
        <div className="role-list">
          {roles.map(r => (
            <div key={r.id} className="role-item">
              <span>{r.label}</span>
              <span className="role-code">({r.code})</span>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setRoleForm({ adding: false, editing: r.id, code: r.code, label: r.label })}>수정</button>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => deleteRole(r.id)} disabled={r.code === 'admin'}>삭제</button>
            </div>
          ))}
        </div>
        {roleForm.adding ? (
          <form onSubmit={addRole} className="role-form">
            <input placeholder="역할 이름 (코드는 자동 생성)" value={roleForm.label} onChange={e => setRoleForm(f => ({ ...f, label: e.target.value }))} required />
            <button type="submit" className="btn btn-primary btn-sm">추가</button>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setRoleForm({ adding: false, editing: null, code: '', label: '' })}>취소</button>
          </form>
        ) : roleForm.editing ? (
          <form onSubmit={updateRole} className="role-form">
            <span className="role-code">{roleForm.code}</span>
            <input placeholder="역할 이름" value={roleForm.label} onChange={e => setRoleForm(f => ({ ...f, label: e.target.value }))} required />
            <button type="submit" className="btn btn-primary btn-sm">저장</button>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setRoleForm({ adding: false, editing: null, code: '', label: '' })}>취소</button>
          </form>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRoleForm({ adding: true, editing: null, code: '', label: '' })}>+ 역할 추가</button>
        )}
      </section>

      <section className="card">
        <h2>역할별 메뉴 권한</h2>
        <p className="desc">역할을 선택한 후, 해당 역할에 허용할 메뉴를 체크하세요. 사용자는 역할에 매핑된 메뉴만 접근할 수 있습니다. 관리자는 모든 메뉴 접근 가능.</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {roles.filter(r => r.code !== 'admin').map(r => (
            <button
              key={r.id}
              type="button"
              className={`btn btn-sm ${editingRole === r.code ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setEditingRole(editingRole === r.code ? null : r.code)}
            >
              {r.label}
            </button>
          ))}
        </div>
        {editingRole && (
          <div className="role-menu-form">
            <p className="desc" style={{ marginBottom: '0.75rem' }}><strong>{roles.find(r => r.code === editingRole)?.label}</strong> 역할에 허용할 메뉴:</p>
            <div className="role-menu-checkboxes">
              {ALL_MENUS.map(m => (
                <label key={m.path} className="role-menu-item">
                  <input
                    type="checkbox"
                    checked={(roleMenus[editingRole] || []).includes(m.path)}
                    onChange={() => toggleMenu(m.path)}
                  />
                  <span>{m.label}</span>
                </label>
              ))}
            </div>
            <button type="button" className="btn btn-primary" onClick={saveRoleMenus} style={{ marginTop: '1rem' }}>저장</button>
          </div>
        )}
      </section>
    </div>
  );
}
