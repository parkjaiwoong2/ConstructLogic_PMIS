import { useState, useEffect } from 'react';
import { api, nextTick } from '../../api';
import ProgressBar from '../../components/ProgressBar';
import Pagination, { PAGE_SIZE } from '../../components/Pagination';
import './Admin.css';

export default function AdminCompanySuper() {
  const [companies, setCompanies] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', userName: '관리자', password: '000000' });
  const [filter, setFilter] = useState({ name: '', ceo_name: '', email: '' });

  const load = async (pageOverride) => {
    setLoading(true);
    await nextTick();
    try {
      const p = pageOverride ?? page;
      const params = { limit: PAGE_SIZE, offset: (p - 1) * PAGE_SIZE };
      if (filter.name?.trim()) params.name = filter.name.trim();
      if (filter.ceo_name?.trim()) params.ceo_name = filter.ceo_name.trim();
      if (filter.email?.trim()) params.email = filter.email.trim();
      const data = await api.getAdminSuperCompaniesPage(params);
      setCompanies(Array.isArray(data?.rows) ? data.rows : []);
      setTotal(data?.total ?? 0);
    } catch (e) {
      alert(e?.message || '로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page]);

  const handleSearch = () => {
    setPage(1);
    load(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.name?.trim()) {
      alert('회사명을 입력하세요.');
      return;
    }
    if (!addForm.email?.trim()) {
      alert('관리자 이메일을 입력하세요.');
      return;
    }
    if (!addForm.password || addForm.password.length < 4) {
      alert('비밀번호를 4자 이상 입력하세요.');
      return;
    }
    setSaving(true);
    try {
      await api.createCompanyWithAdmin({
        name: addForm.name.trim(),
        email: addForm.email.trim(),
        userName: addForm.userName?.trim() || addForm.email.split('@')[0],
        password: addForm.password
      });
      alert('회사와 관리자가 등록되었습니다. 사용자 권한 화면에서 해당 회사 관리자로 확인할 수 있습니다.');
      setAddForm({ name: '', email: '', userName: '관리자', password: '000000' });
      load();
    } catch (err) {
      alert(err?.message || '등록 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page">
      <ProgressBar loading={loading || saving} />
      <header className="page-header">
        <h1>회사관리 (슈퍼관리자)</h1>
      </header>
      <p className="subtitle">회사명, 관리자 이메일, 이름을 입력하면 회사가 등록되고 해당 회사의 관리자로 사용자가 자동 등록·승인됩니다.</p>

      <section className="card">
        <h2>회사 + 관리자 등록</h2>
        <form onSubmit={handleSubmit} className="add-form" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
          <input
            placeholder="회사명 *"
            value={addForm.name}
            onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
            style={{ minWidth: 140 }}
          />
          <input
            type="email"
            placeholder="관리자 이메일 *"
            value={addForm.email}
            onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
            style={{ minWidth: 180 }}
          />
          <input
            placeholder="관리자 이름"
            value={addForm.userName}
            onChange={e => setAddForm(f => ({ ...f, userName: e.target.value }))}
            style={{ minWidth: 100 }}
          />
          <input
            type="password"
            placeholder="비밀번호 (4자 이상) *"
            value={addForm.password}
            onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))}
            style={{ minWidth: 140 }}
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>등록</button>
        </form>
      </section>

      <section className="card">
        <h2>등록된 회사 목록</h2>
        <div className="filter-section" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
          <label>회사명</label>
          <input
            type="text"
            placeholder="회사명"
            value={filter.name}
            onChange={e => setFilter(f => ({ ...f, name: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            style={{ minWidth: 120 }}
          />
          <label>대표</label>
          <input
            type="text"
            placeholder="대표명"
            value={filter.ceo_name}
            onChange={e => setFilter(f => ({ ...f, ceo_name: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            style={{ minWidth: 100 }}
          />
          <label>이메일</label>
          <input
            type="text"
            placeholder="이메일"
            value={filter.email}
            onChange={e => setFilter(f => ({ ...f, email: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            style={{ minWidth: 140 }}
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={handleSearch}>조회</button>
        </div>
        <div className="admin-users-table-wrap">
          <table className="data-table admin-users-table">
            <thead>
              <tr>
                <th>id</th>
                <th>회사명</th>
                <th>로고</th>
                <th>주소</th>
                <th>대표</th>
                <th>설립일</th>
                <th>사업자번호</th>
                <th>Tel</th>
                <th>Fax</th>
                <th>E-mail</th>
                <th>Copyright</th>
                <th>요금제</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(c => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>
                    <strong>{c.name}</strong>
                    {c.is_default && <span className="badge" style={{ marginLeft: '0.25rem' }}>대표</span>}
                  </td>
                  <td>{c.logo_url ? <img src={c.logo_url} alt="" style={{ maxHeight: 32, maxWidth: 80 }} /> : '-'}</td>
                  <td>{c.address || '-'}</td>
                  <td>{c.ceo_name || '-'}</td>
                  <td>{c.founded_date || '-'}</td>
                  <td>{c.business_reg_no || '-'}</td>
                  <td>{c.tel || '-'}</td>
                  <td>{c.fax || '-'}</td>
                  <td>{c.email || '-'}</td>
                  <td>{c.copyright_text || '-'}</td>
                  <td>0원</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {companies.length === 0 && !loading && (
          <p className="admin-users-empty">등록된 회사가 없습니다.</p>
        )}
        <Pagination total={total} page={page} onChange={setPage} />
      </section>
    </div>
  );
}
