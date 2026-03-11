import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, nextTick } from '../api';
import { useAuth } from '../contexts/AuthContext';
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

function getDefaultCompanyForCombo(list, user) {
  if (!list?.length) return null;
  if (list.length === 1) return list[0];
  return list.find(c => c.id === user?.company_id) || list[0];
}

export default function ExpenseList() {
  const { user, company } = useAuth();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [projects, setProjects] = useState([]);
  const [accountItems, setAccountItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [filter, setFilter] = useState(() => ({
    ...getDefaultDateRange(),
    status: '',
    project: '',
    account_item_name: '',
    user_name: '',
    description: '',
    company_id: '',
  }));
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const includeDraft = !filter.status || filter.status === 'draft';

  const load = async (pageOverride) => {
    const p = pageOverride ?? page;
    setLoading(true);
    await nextTick();
    const params = { ...filter, limit: PAGE_SIZE, offset: (p - 1) * PAGE_SIZE };
    Object.keys(params).forEach(k => { if (params[k] === '' || params[k] == null) delete params[k]; });
    if (params.company_id) params.company_id = parseInt(params.company_id, 10) || undefined;
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

  useEffect(() => { load(); }, [page, filter.from, filter.to, filter.status, filter.project, filter.account_item_name, filter.user_name, filter.description, filter.company_id]);

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
  useEffect(() => {
    const cid = filter.company_id ? parseInt(filter.company_id, 10) : null;
    (cid ? api.getProjects(cid) : api.getProjects()).then(setProjects).catch(() => setProjects([]));
  }, [filter.company_id]);

  useEffect(() => {
    const cid = filter.company_id ? parseInt(filter.company_id, 10) : undefined;
    api.getAccountItems(cid).then(setAccountItems).catch(() => setAccountItems([]));
  }, [filter.company_id]);

  useEffect(() => {
    api.getUsers().then(setUsers).catch(() => []);
    api.getCompanies({ list: 1 }).then(list => {
      const arr = list || [];
      setCompanies(arr);
      setFilter(prev => {
        if (prev.company_id) return prev;
        const def = getDefaultCompanyForCombo(arr, user);
        return def ? { ...prev, company_id: String(def.id) } : prev;
      });
    }).catch(() => setCompanies([]));
  }, []);

  return (
    <div className="document-list">
      <ProgressBar loading={loading} />
      <header className="page-header">
        <h1>사용내역 조회</h1>
      </header>
      <p className="subtitle">입력된 모든 사용내역을 조회합니다. 작성중 문서는 삭제 가능합니다.</p>

      <section className="card filter-section" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginBottom: '0.75rem', fontSize: '0.95rem' }}>조회 조건</h2>
        <div className="filter-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem' }}>
          <label className="filter-label">회사</label>
          <select value={filter.company_id || ''} onChange={e => setFilter(f => ({ ...f, company_id: e.target.value || '' }))} disabled={companies.length === 1}>
            <option value="">전체 회사</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}{c.id === user?.company_id ? ' (대표)' : ''}</option>)}
          </select>
          <label className="filter-label">기간</label>
          <input type="date" value={filter.from} onChange={e => setFilter(f => ({ ...f, from: e.target.value }))} />
          <span>~</span>
          <input type="date" value={filter.to} onChange={e => setFilter(f => ({ ...f, to: e.target.value }))} />
          <label className="filter-label">결재상태</label>
          <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
            <option value="">전체</option>
            <option value="draft">작성중</option>
            <option value="pending">결재대기</option>
            <option value="approved">승인</option>
            <option value="rejected">반려</option>
          </select>
          <label className="filter-label">현장</label>
          <select value={filter.project} onChange={e => setFilter(f => ({ ...f, project: e.target.value }))}>
            <option value="">전체</option>
            {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
          <label className="filter-label">항목</label>
          <select value={filter.account_item_name} onChange={e => setFilter(f => ({ ...f, account_item_name: e.target.value }))}>
            <option value="">전체</option>
            {accountItems.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
          </select>
        </div>
        <div className="filter-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <label className="filter-label">사용자</label>
          <input type="text" value={filter.user_name} onChange={e => setFilter(f => ({ ...f, user_name: e.target.value }))} placeholder="사용자" list="exp-user-list" style={{ minWidth: 120 }} />
          <datalist id="exp-user-list">{users.map(u => <option key={u} value={u} />)}</datalist>
          <label className="filter-label">적요</label>
          <input type="text" value={filter.description} onChange={e => setFilter(f => ({ ...f, description: e.target.value }))} placeholder="적요 검색" style={{ minWidth: 160 }} />
          <button type="button" className="btn btn-primary" onClick={() => { setPage(1); load(1); }}>조회</button>
        </div>
      </section>

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
                  ) : row.status === 'approved' ? (
                    <span style={{ color: '#059669' }}>승인</span>
                  ) : row.status === 'rejected' ? (
                    <span style={{ color: '#dc2626' }}>반려</span>
                  ) : (
                    <span>{row.status || '-'}</span>
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
