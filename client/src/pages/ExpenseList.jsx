import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, nextTick } from '../api';
import Pagination, { PAGE_SIZE } from '../components/Pagination';
import ProgressBar from '../components/ProgressBar';
import './DocumentList.css';

function formatCurrency(n) {
  return new Intl.NumberFormat('ko-KR').format(n || 0);
}

function getDefaultDateRange() {
  const today = new Date();
  const prevMonth23 = new Date(today.getFullYear(), today.getMonth() - 1, 23);
  return {
    from: prevMonth23.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
  };
}

export default function ExpenseList() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [projects, setProjects] = useState([]);
  const [accountItems, setAccountItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState(() => ({
    ...getDefaultDateRange(),
    project: '',
    account_item_name: '',
    user_name: '',
    description: '',
  }));
  const [includeDraft, setIncludeDraft] = useState(true);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = async (pageOverride) => {
    const p = pageOverride ?? page;
    setLoading(true);
    await nextTick();
    const params = { ...filter, include_draft: includeDraft ? '1' : undefined, limit: PAGE_SIZE, offset: (p - 1) * PAGE_SIZE };
    Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
    try {
      const data = await api.getExpenses(params);
      if (Array.isArray(data)) {
        setItems(data);
        setTotal(data.length);
      } else {
        setItems(data.items || []);
        setTotal(data.total || 0);
      }
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, includeDraft, filter.from, filter.to, filter.project, filter.account_item_name, filter.user_name, filter.description]);

  const handleDelete = async (docId) => {
    if (!confirm('이 문서를 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.')) return;
    setDeleting(docId);
    setLoading(true);
    await nextTick();
    try {
      await api.deleteDocument(docId);
      load();
    } catch (err) {
      alert(err.message || '삭제 실패');
    } finally {
      setDeleting(null);
      setLoading(false);
    }
  };
  useEffect(() => { api.getProjects().then(setProjects); api.getAccountItems().then(setAccountItems); api.getUsers().then(setUsers).catch(() => []); }, []);

  return (
    <div className="document-list">
      <ProgressBar loading={loading} />
      <header className="page-header">
        <h1>사용내역 조회</h1>
      </header>
      <p className="subtitle">승인/결재대기 문서의 사용내역을 조회할 수 있습니다.</p>

      <div className="filters" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
        <input type="date" value={filter.from} onChange={e => setFilter(f => ({ ...f, from: e.target.value }))} placeholder="시작일" />
        <input type="date" value={filter.to} onChange={e => setFilter(f => ({ ...f, to: e.target.value }))} placeholder="종료일" />
        <select value={filter.project} onChange={e => setFilter(f => ({ ...f, project: e.target.value }))}>
          <option value="">전체 현장</option>
          {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
        <select value={filter.account_item_name} onChange={e => setFilter(f => ({ ...f, account_item_name: e.target.value }))}>
          <option value="">전체 항목</option>
          {accountItems.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
        </select>
        <input type="text" value={filter.user_name} onChange={e => setFilter(f => ({ ...f, user_name: e.target.value }))} placeholder="사용자" list="exp-user-list" />
        <datalist id="exp-user-list">{users.map(u => <option key={u} value={u} />)}</datalist>
        <input type="text" value={filter.description} onChange={e => setFilter(f => ({ ...f, description: e.target.value }))} placeholder="적요" />
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <input type="checkbox" checked={includeDraft} onChange={e => setIncludeDraft(e.target.checked)} />
          작성중 포함
        </label>
        <button type="button" className="btn btn-secondary" onClick={() => { setPage(1); load(1); }}>조회</button>
      </div>

      <div className="card table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>사용일</th>
              <th>현장</th>
              <th>항목</th>
              <th>적요</th>
              <th>카드</th>
              <th>현금</th>
              <th>합계</th>
              <th>사용자</th>
              <th>상태</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map(row => (
              <tr key={row.id}>
                <td>{row.use_date}</td>
                <td>{row.project_name}</td>
                <td>{row.account_item_name}</td>
                <td>{row.description}</td>
                <td>{formatCurrency(row.card_amount)}</td>
                <td>{formatCurrency(row.cash_amount)}</td>
                <td>{formatCurrency(row.total_amount)}</td>
                <td>{row.user_name}</td>
                <td>
                  {row.status === 'draft' ? (
                    <span style={{ color: '#6b7280' }}>작성중</span>
                  ) : row.status === 'pending' ? (
                    <span style={{ color: '#d97706' }}>결재대기</span>
                  ) : (
                    <span style={{ color: '#059669' }}>승인</span>
                  )}
                </td>
                <td>
                  <Link to={`/documents/${row.document_id}`} className="link">보기</Link>
                  {row.status === 'draft' && (
                    <button
                      type="button"
                      className="link btn-link ml"
                      onClick={() => handleDelete(row.document_id)}
                      disabled={deleting === row.document_id}
                    >
                      {deleting === row.document_id ? '삭제 중...' : '삭제'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <div className="empty">조회 결과가 없습니다.</div>}
        <Pagination total={total} page={page} onChange={setPage} />
      </div>
    </div>
  );
}
