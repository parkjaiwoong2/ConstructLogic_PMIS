import { useState, useEffect } from 'react';
import { api, nextTick } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import Pagination, { PAGE_SIZE } from '../components/Pagination';
import ProgressBar from '../components/ProgressBar';
import './DocumentList.css';

function formatCurrency(n) {
  return new Intl.NumberFormat('ko-KR').format(n || 0);
}

export default function ApprovalList() {
  const { user, company } = useAuth();
  const [docs, setDocs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCompanies({ list: 1, mine: 1 }).then(list => {
      const arr = list || [];
      setCompanies(arr);
      const def = arr.length === 1 ? arr[0] : (arr.find(c => c.id === user?.company_id) || arr[0]);
      if (def) setCompanyId(String(def.id));
    }).catch(() => setCompanies([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await nextTick();
      const params = { status: 'pending', limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE };
      if (companyId) params.company_id = parseInt(companyId, 10);
      try {
        const data = await api.getDocuments(params);
        if (cancelled) return;
        if (Array.isArray(data)) {
          setDocs(data);
          setTotal(data.length);
        } else {
          setDocs(data.items || []);
          setTotal(data.total || 0);
        }
      } catch {
        if (!cancelled) { setDocs([]); setTotal(0); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page, companyId]);

  return (
    <div className="document-list">
      <ProgressBar loading={loading} />
      <header className="page-header">
        <h1>결재함</h1>
      </header>
      <p className="subtitle">결재 대기 중인 문서를 승인 또는 반려할 수 있습니다. (결재 문서 목록에서 [결재 요청]을 누른 문서만 표시됩니다)</p>

      <div className="filters" style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <label className="filter-label">회사</label>
        <select value={companyId || ''} onChange={e => { setCompanyId(e.target.value || ''); setPage(1); }} disabled={companies.length <= 1} style={{ minWidth: 160 }}>
          {companies.map(c => (
            <option key={c.id} value={c.id}>{c.name}{c.id === user?.company_id ? ' (대표)' : ''}</option>
          ))}
        </select>
      </div>

      <div className="card table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>문서번호</th>
              <th>사용자</th>
              <th>현장</th>
              <th>기간</th>
              <th>카드금액</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {docs.map(d => (
              <tr key={d.id}>
                <td>{d.doc_no}</td>
                <td>{d.user_name}</td>
                <td>{d.project_name}</td>
                <td>{d.period_start} ~ {d.period_end}</td>
                <td>{formatCurrency(d.total_card_amount)}원</td>
                <td>
                  <Link to={`/documents/${d.id}`} className="btn btn-sm btn-primary">결재하기</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {docs.length === 0 && <div className="empty">결재 대기 문서가 없습니다.</div>}
        <Pagination total={total} page={page} onChange={setPage} />
      </div>
    </div>
  );
}
