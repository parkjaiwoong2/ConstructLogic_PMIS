import { useState, useEffect } from 'react';
import { api, nextTick } from '../../api';
import ProgressBar from '../../components/ProgressBar';
import './Admin.css';

const EMPTY = { name: '', logo_url: '', address: '', ceo_name: '', founded_date: '', business_reg_no: '', tel: '', fax: '', email: '', copyright_text: '' };

export default function AdminCompany() {
  const [companies, setCompanies] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ ...EMPTY });
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({ name: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    await nextTick();
    try {
      const data = await api.getAdminCompaniesWithSettings();
      const list = data?.companies ?? data;
      setCompanies(Array.isArray(list) ? list : []);
    } catch (e) {
      alert(e?.message || '로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setEditForm(c => ({ ...c, [k]: e.target.value }));

  const handleLogoFile = (e, formSetter) => {
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
    reader.onload = () => formSetter(c => ({ ...c, logo_url: reader.result }));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

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

  const addCompany = async (e) => {
    e.preventDefault();
    if (!addForm.name?.trim()) {
      alert('회사명을 입력하세요.');
      return;
    }
    setSaving(true);
    try {
      await api.createAdminCompany({ name: addForm.name.trim() });
      setAdding(false);
      setAddForm({ name: '' });
      alert('회사가 등록되었습니다.');
      load();
    } catch (err) {
      alert(err?.message || '등록 실패');
    } finally {
      setSaving(false);
    }
  };

  const setDefault = async (id) => {
    try {
      await api.setCompanyDefault(id);
      alert('대표 회사로 설정되었습니다.');
      load();
    } catch (err) {
      alert(err?.message || '설정 실패');
    }
  };

  const deleteCompany = async (id) => {
    if (!confirm('이 회사를 삭제하시겠습니까? 소속 사용자가 없어야 합니다.')) return;
    try {
      await api.deleteAdminCompany(id);
      if (editingId === id) cancelEdit();
      alert('삭제되었습니다.');
      load();
    } catch (err) {
      alert(err?.message || '삭제 실패');
    }
  };

  return (
    <div className="admin-page">
      <ProgressBar loading={loading || saving} />
      <header className="page-header">
        <h1>회사 등록</h1>
      </header>
      <p className="subtitle">여러 회사를 등록하고, 대표 회사를 지정하세요. 상단·하단(푸터)에 표시되는 회사 정보는 대표 회사로 연동됩니다.</p>

      <section className="card">
        <h2>회사 목록</h2>
        {adding ? (
          <form onSubmit={addCompany} className="add-form" style={{ marginBottom: '1rem' }}>
            <input placeholder="회사명 *" value={addForm.name} onChange={e => setAddForm({ name: e.target.value })} required />
            <button type="submit" className="btn btn-primary btn-sm">추가</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAdding(false)}>취소</button>
          </form>
        ) : (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setAdding(true)} style={{ marginBottom: '1rem' }}>+ 회사 추가</button>
        )}
        <ul className="master-list" style={{ listStyle: 'none', padding: 0 }}>
          {companies.map(c => (
            <li key={c.id} style={{ padding: '0.75rem', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {editingId === c.id ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <input placeholder="회사명 *" value={editForm.name} onChange={set('name')} style={{ width: 280 }} />
                  <div className="logo-upload">
                    <input type="file" accept="image/*" onChange={e => handleLogoFile(e, setEditForm)} id={`logo-${c.id}`} style={{ display: 'none' }} />
                    <label htmlFor={`logo-${c.id}`} className="btn btn-secondary btn-sm">로고 선택</label>
                    {editForm.logo_url && (
                      <>
                        <button type="button" className="btn btn-sm btn-secondary" onClick={() => setEditForm(x => ({ ...x, logo_url: '' }))}>삭제</button>
                        <div className="logo-preview"><img src={editForm.logo_url} alt="로고 미리보기" /></div>
                      </>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <input placeholder="주소" value={editForm.address} onChange={set('address')} style={{ width: 300 }} />
                    <input placeholder="대표" value={editForm.ceo_name} onChange={set('ceo_name')} style={{ width: 120 }} />
                    <input placeholder="설립일" value={editForm.founded_date} onChange={set('founded_date')} style={{ width: 100 }} />
                    <input placeholder="사업자번호" value={editForm.business_reg_no} onChange={set('business_reg_no')} style={{ width: 140 }} />
                    <input placeholder="Tel" value={editForm.tel} onChange={set('tel')} style={{ width: 100 }} />
                    <input placeholder="Fax" value={editForm.fax} onChange={set('fax')} style={{ width: 100 }} />
                    <input placeholder="E-mail" value={editForm.email} onChange={set('email')} style={{ width: 200 }} />
                    <input placeholder="Copyright" value={editForm.copyright_text} onChange={set('copyright_text')} style={{ width: 280 }} />
                  </div>
                  <div>
                    <button type="button" className="btn btn-primary btn-sm" onClick={saveEdit} disabled={saving}>저장</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={cancelEdit}>취소</button>
                  </div>
                </div>
              ) : (
                <>
                  {c.logo_url && <img src={c.logo_url} alt="" className="company-list-logo" />}
                  <strong>{c.name}</strong>
                  {c.is_default && <span className="badge">대표</span>}
                  <span style={{ color: '#666', fontSize: '0.9rem' }}>
                    {c.address && `· ${c.address}`}{c.ceo_name && ` · 대표 ${c.ceo_name}`}
                  </span>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.25rem' }}>
                    {!c.is_default && (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => setDefault(c.id)}>대표로 설정</button>
                    )}
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => startEdit(c)}>수정</button>
                    {!c.is_default && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => deleteCompany(c.id)}>삭제</button>
                    )}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
        {companies.length === 0 && !adding && <p className="desc">등록된 회사가 없습니다. 회사 추가 버튼을 눌러 등록하세요.</p>}
      </section>
    </div>
  );
}
