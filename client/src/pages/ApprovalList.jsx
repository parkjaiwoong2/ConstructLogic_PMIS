import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, nextTick } from '../api';
import Pagination, { PAGE_SIZE } from '../components/Pagination';
import ProgressBar from '../components/ProgressBar';
import './DocumentList.css';

function formatCurrency(n) {
  return new Intl.NumberFormat('ko-KR').format(n || 0);
}

export default function ApprovalList() {
  const [docs, setDocs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await nextTick();
      try {
        const data = await api.getDocuments({ status: 'pending', limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
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
  }, [page]);

  return (
    <div className="document-list">
      <ProgressBar loading={loading} />
      <header className="page-header">
        <h1>결재함</h1>
      </header>
      <p className="subtitle">결재 대기 중인 문서를 승인 또는 반려할 수 있습니다. (결재 문서 목록에서 [결재 요청]을 누른 문서만 표시됩니다)</p>

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
