import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import './DocumentList.css';

function formatCurrency(n) {
  return new Intl.NumberFormat('ko-KR').format(n || 0);
}

const statusMap = {
  draft: { label: '작성중', color: '#6b7280' },
  pending: { label: '결재대기', color: '#d97706' },
  approved: { label: '승인', color: '#059669' },
  rejected: { label: '반려', color: '#dc2626' },
};

export default function DocumentList() {
  const [docs, setDocs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [filter, setFilter] = useState({ status: '', project: '' });

  useEffect(() => {
    api.getDocuments(filter).then(setDocs);
  }, [filter.status, filter.project]);

  useEffect(() => {
    api.getProjects().then(setProjects);
  }, []);

  return (
    <div className="document-list">
      <header className="page-header">
        <h1>결재 문서</h1>
        <Link to="/expense/new" className="btn btn-primary">+ 새 문서 작성</Link>
      </header>

      <div className="filters">
        <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
          <option value="">전체 상태</option>
          <option value="draft">작성중</option>
          <option value="pending">결재대기</option>
          <option value="approved">승인</option>
          <option value="rejected">반려</option>
        </select>
        <select value={filter.project} onChange={e => setFilter(f => ({ ...f, project: e.target.value }))}>
          <option value="">전체 현장</option>
          {projects.map(p => (
            <option key={p.id} value={p.name}>{p.name}</option>
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
              <th>상태</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {docs.map(d => {
              const s = statusMap[d.status] || { label: d.status, color: '#666' };
              return (
                <tr key={d.id}>
                  <td>{d.doc_no}</td>
                  <td>{d.user_name}</td>
                  <td>{d.project_name}</td>
                  <td>{d.period_start} ~ {d.period_end}</td>
                  <td>{formatCurrency(d.total_card_amount)}원</td>
                  <td><span className="status-badge" style={{ background: s.color }}>{s.label}</span></td>
                  <td>
                    <Link to={`/documents/${d.id}`} className="link">보기</Link>
                    {d.status === 'draft' && (
                      <Link to={`/expense/${d.id}/edit`} className="link ml">수정</Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {docs.length === 0 && <div className="empty">결재 문서가 없습니다.</div>}
      </div>
    </div>
  );
}
