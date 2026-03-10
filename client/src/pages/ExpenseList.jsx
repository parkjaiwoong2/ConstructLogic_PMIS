import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import Pagination, { PAGE_SIZE } from '../components/Pagination';
import './DocumentList.css';

function formatCurrency(n) {
  return new Intl.NumberFormat('ko-KR').format(n || 0);
}

export default function ExpenseList() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [projects, setProjects] = useState([]);
  const [accountItems, setAccountItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState({ from: '', to: '', project: '', account_item_name: '', user_name: '', description: '' });

  const load = (pageOverride) => {
    const p = pageOverride ?? page;
    const params = { ...filter, limit: PAGE_SIZE, offset: (p - 1) * PAGE_SIZE };
    Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
    api.getExpenses(params).then(data => {
      if (Array.isArray(data)) {
        setItems(data);
        setTotal(data.length);
      } else {
        setItems(data.items || []);
        setTotal(data.total || 0);
      }
    }).catch(() => { setItems([]); setTotal(0); });
  };

  useEffect(() => { load(); }, [page, filter.from, filter.to, filter.project, filter.account_item_name, filter.user_name, filter.description]);
  useEffect(() => { api.getProjects().then(setProjects); api.getAccountItems().then(setAccountItems); api.getUsers().then(setUsers).catch(() => []); }, []);

  return (
    <div className="document-list">
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
              <th>문서</th>
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
                <td><Link to={`/documents/${row.document_id}`} className="link">보기</Link></td>
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
