import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, nextTick } from '../../api';
import ProgressBar from '../../components/ProgressBar';
import Pagination, { PAGE_SIZE } from '../../components/Pagination';
import './Admin.css';

const statusMap = {
  draft: '작성중',
  pending: '결재대기',
  approved: '승인',
  rejected: '반려',
};

function formatDate(s) {
  if (!s) return '-';
  try {
    const d = new Date(s);
    return d.toLocaleString('ko-KR');
  } catch {
    return String(s);
  }
}

export default function AdminEditHistory() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getCompanies({ list: 1 }).then(list => {
      setCompanies(list || []);
      const def = (list || []).find(c => c.is_default) || (list || [])[0];
      if (def) setCompanyId(String(def.id));
    }).catch(() => setCompanies([]));
  }, []);

  const load = async () => {
    setLoading(true);
    await nextTick();
    try {
      const params = { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE };
      if (companyId) params.company_id = companyId;
      const data = await api.getAdminEditHistory(params);
      setRows(data?.rows ?? []);
      setTotal(data?.total ?? 0);
    } catch (e) {
      alert(e.message || '로드 실패');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, companyId]);

  return (
    <div className="admin-page">
      <ProgressBar loading={loading} />
      <header className="page-header">
        <h1>관리자 수정 히스토리</h1>
      </header>
      <p className="subtitle">관리자가 결재대기·승인·반려 상태의 문서를 수정한 내역입니다.</p>

      <div className="filters" style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <label className="filter-label">회사</label>
        <select value={companyId || ''} onChange={e => { setCompanyId(e.target.value || ''); setPage(1); }} style={{ minWidth: 160 }}>
          <option value="">전체 회사</option>
          {companies.map(c => (
            <option key={c.id} value={c.id}>{c.name}{c.is_default ? ' (대표)' : ''}</option>
          ))}
        </select>
      </div>

      <div className="card table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>수정일시</th>
              <th>관리자</th>
              <th>당시 문서상태</th>
              <th>문서번호</th>
              <th>사용자</th>
              <th>현장</th>
              <th>기간</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{formatDate(r.created_at)}</td>
                <td>{r.admin_name}</td>
                <td>{statusMap[r.document_status] ?? r.document_status}</td>
                <td>{r.doc_no}</td>
                <td>{r.user_name}</td>
                <td>{r.project_name}</td>
                <td>{r.period_start} ~ {r.period_end}</td>
                <td>
                  <Link to={`/documents/${r.document_id}`} className="link">보기</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !loading && (
          <div className="empty">관리자 수정 이력이 없습니다.</div>
        )}
        <Pagination total={total} page={page} onChange={setPage} />
      </div>
    </div>
  );
}
