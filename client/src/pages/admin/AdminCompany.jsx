import { useState, useEffect } from 'react';
import { api, nextTick } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import ProgressBar from '../../components/ProgressBar';
import './Admin.css';
import './CompanyInfo.css';

const EMPTY = { name: '', logo_url: '', address: '', ceo_name: '', founded_date: '', business_reg_no: '', tel: '', fax: '', email: '', copyright_text: '' };

export default function AdminCompany() {
  const { user, loadAuth } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ ...EMPTY });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    await nextTick();
    try {
      const data = await api.getAdminCompaniesWithSettings();
      const list = data?.companies ?? data;
      const arr = Array.isArray(list) ? list : [];
      setCompanies(arr);
      if (arr.length > 0 && !selectedId) setSelectedId(String(arr[0].id));
      if (arr.length > 0 && selectedId && !arr.some(c => String(c.id) === selectedId)) setSelectedId(String(arr[0].id));
    } catch (e) {
      alert(e?.message || '로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setEditForm(c => ({ ...c, [k]: e.target.value }));

  const handleLogoFile = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      alert('이미지 파일만 등록 가능합니다.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('이미지는 2MB 이하로 등록해 주세요.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setEditForm(c => ({ ...c, logo_url: reader.result }));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const current = companies.find(c => String(c.id) === selectedId);
  const isRepresentative = current && user?.company_id === current.id;
  const hasMultiCompany = companies.length > 1;

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditForm({ ...EMPTY, ...c });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ ...EMPTY });
  };

  const saveEdit = async () => {
    if (!editForm.name?.trim()) {
      alert('회사명을 입력하세요.');
      return;
    }
    setSaving(true);
    try {
      await api.updateCompany(editingId, { ...editForm, logo_url: editForm.logo_url || null });
      alert('저장되었습니다.');
      cancelEdit();
      load();
    } catch (err) {
      alert(err?.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const setAsRepresentative = async () => {
    if (!current) return;
    setSaving(true);
    try {
      await api.setRepresentativeCompany(current.id);
      alert('대표회사로 설정되었습니다. 상단·하단 회사 정보가 변경됩니다.');
      loadAuth?.();
      load();
    } catch (err) {
      alert(err?.message || '설정 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page company-info-page">
      <ProgressBar loading={loading || saving} />
      <header className="page-header">
        <h1>회사정보관리</h1>
      </header>
      <p className="subtitle">소속 회사 정보를 조회·수정합니다. 멀티회사 소속 시 대표회사를 설정하면 상단·하단에 해당 회사 정보가 표시됩니다.</p>

      {companies.length === 0 && !loading && (
        <section className="card">
          <p className="desc">소속된 회사가 없습니다.</p>
        </section>
      )}

      {companies.length > 0 && (
        <>
          {companies.length > 0 && (
            <section className="card company-info-selector">
              <label>회사 선택</label>
              <select value={selectedId} onChange={e => setSelectedId(e.target.value)} disabled={companies.length === 1} style={{ minWidth: 240 }}>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{user?.company_id === c.id ? ' (대표)' : ''}</option>
                ))}
              </select>
              {current && !isRepresentative && (
                <button type="button" className="btn btn-primary" onClick={setAsRepresentative} disabled={saving}>대표회사로 설정</button>
              )}
            </section>
          )}

          {current && (
            <section className="card company-info-detail">
              <h2>회사 상세정보</h2>
              {editingId === current.id ? (
                <div className="company-info-edit">
                  <div className="company-info-fields">
                    <div className="info-row">
                      <label>회사명</label>
                      <input value={editForm.name} onChange={set('name')} placeholder="회사명" />
                    </div>
                    <div className="info-row logo-row">
                      <label>로고</label>
                      <div className="logo-upload">
                        <input type="file" accept="image/*" onChange={handleLogoFile} id="logo-upload" style={{ display: 'none' }} />
                        <label htmlFor="logo-upload" className="btn btn-secondary btn-sm">로고 선택</label>
                        {editForm.logo_url && (
                          <>
                            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setEditForm(x => ({ ...x, logo_url: '' }))}>삭제</button>
                            <div className="logo-preview"><img src={editForm.logo_url} alt="로고" /></div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="info-row">
                      <label>주소</label>
                      <input value={editForm.address || ''} onChange={set('address')} placeholder="주소" />
                    </div>
                    <div className="info-row info-row-2">
                      <div><label>대표</label><input value={editForm.ceo_name || ''} onChange={set('ceo_name')} placeholder="대표" /></div>
                      <div><label>설립일</label><input value={editForm.founded_date || ''} onChange={set('founded_date')} placeholder="설립일" /></div>
                    </div>
                    <div className="info-row info-row-2">
                      <div><label>사업자번호</label><input value={editForm.business_reg_no || ''} onChange={set('business_reg_no')} placeholder="사업자번호" /></div>
                      <div><label>대표전화</label><input value={editForm.tel || ''} onChange={set('tel')} placeholder="Tel" /></div>
                    </div>
                    <div className="info-row info-row-2">
                      <div><label>팩스</label><input value={editForm.fax || ''} onChange={set('fax')} placeholder="Fax" /></div>
                      <div><label>이메일</label><input value={editForm.email || ''} onChange={set('email')} placeholder="E-mail" type="email" /></div>
                    </div>
                    <div className="info-row">
                      <label>저작권 문구</label>
                      <input value={editForm.copyright_text || ''} onChange={set('copyright_text')} placeholder="Copyright" />
                    </div>
                  </div>
                  <div className="company-info-actions">
                    <button type="button" className="btn btn-primary" onClick={saveEdit} disabled={saving}>저장</button>
                    <button type="button" className="btn btn-secondary" onClick={cancelEdit}>취소</button>
                  </div>
                </div>
              ) : (
                <div className="company-info-view">
                  <div className="company-info-header">
                    {current.logo_url && <img src={current.logo_url} alt="" className="company-logo" />}
                    <div>
                      <h3>{current.name}</h3>
                      {isRepresentative && <span className="badge">대표회사</span>}
                    </div>
                  </div>
                  <dl className="company-info-grid">
                    <dt>주소</dt><dd>{current.address || '-'}</dd>
                    <dt>대표</dt><dd>{current.ceo_name || '-'}</dd>
                    <dt>설립일</dt><dd>{current.founded_date || '-'}</dd>
                    <dt>사업자번호</dt><dd>{current.business_reg_no || '-'}</dd>
                    <dt>대표전화</dt><dd>{current.tel || '-'}</dd>
                    <dt>팩스</dt><dd>{current.fax || '-'}</dd>
                    <dt>이메일</dt><dd>{current.email || '-'}</dd>
                    <dt>저작권 문구</dt><dd>{current.copyright_text || '-'}</dd>
                  </dl>
                  <button type="button" className="btn btn-secondary" onClick={() => startEdit(current)}>수정</button>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
