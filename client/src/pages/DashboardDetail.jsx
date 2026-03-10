import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api, nextTick } from '../api';
import ProgressBar from '../components/ProgressBar';
import './DashboardDetail.css';

function formatCurrency(n) {
  return new Intl.NumberFormat('ko-KR').format(n || 0);
}

function getMonthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const from = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

export default function DashboardDetail() {
  const [searchParams, setSearchParams] = useSearchParams();
  const type = searchParams.get('type');
  const initAccountId = searchParams.get('id');
  const initAccountName = searchParams.get('name');
  const initProject = searchParams.get('project');
  const initMonth = searchParams.get('month');
  const initFrom = searchParams.get('from');
  const initTo = searchParams.get('to');

  const [filters, setFilters] = useState({
    from: '',
    to: '',
    account_item_id: '',
    account_item_name: '',
    project: '',
    user_name: '',
    description: '',
  });
  const [accountItems, setAccountItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtersReady, setFiltersReady] = useState(false);

  useEffect(() => {
    api.getAccountItems().then(setAccountItems);
    api.getProjects().then(setProjects);
  }, []);

  useEffect(() => {
    let from = initFrom || '';
    let to = initTo || '';
    let account_item_id = initAccountId ? String(initAccountId) : '';
    let account_item_name = '';
    let project = '';
    if (type === 'account') {
      account_item_name = initAccountName || '';
      if (!account_item_id && account_item_name && accountItems.length) {
        const found = accountItems.find(a => (a.name || '').trim() === (account_item_name || '').trim());
        if (found) account_item_id = String(found.id);
      }
    }
    if (type === 'project') project = initAccountName || initProject || '';
    if (type === 'month' && initMonth) {
      const range = getMonthRange(initMonth);
      from = range.from;
      to = range.to;
    }
    setFilters(f => ({
      ...f,
      from: from || f.from,
      to: to || f.to,
      account_item_id: account_item_id || f.account_item_id,
      account_item_name: account_item_name || f.account_item_name,
      project: project,
    }));
    setFiltersReady(true);
  }, [type, initAccountId, initAccountName, initProject, initMonth, initFrom, initTo, accountItems]);

  const buildParams = useCallback(() => {
    const p = {};
    if (filters.from) p.from = filters.from;
    if (filters.to) p.to = filters.to;
    if (filters.account_item_id) p.account_item_id = filters.account_item_id;
    else if (filters.account_item_name) p.account_item_name = filters.account_item_name;
    if (filters.project && filters.project.trim()) p.project = filters.project.trim();
    if (filters.user_name) p.user_name = filters.user_name;
    if (filters.description) p.description = filters.description;
    return p;
  }, [filters.from, filters.to, filters.account_item_id, filters.account_item_name, filters.project, filters.user_name, filters.description]);

  const fetchItems = useCallback(async () => {
    const params = buildParams();
    setLoading(true);
    await nextTick();
    try {
      const data = await api.getExpenses(params);
      setItems(data.filter(i => i.status === 'approved' || i.status === 'pending'));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    if (!filtersReady) return;
    fetchItems();
  }, [filtersReady, fetchItems]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchItems();
  };

  const getTitle = () => {
    if (type === 'account') return `항목별 상세: ${initAccountName || initAccountId || ''}`;
    if (type === 'project') return `현장별 상세: ${initAccountName || initProject || ''}`;
    if (type === 'month') return `월별 상세: ${initMonth || ''}`;
    return '상세 내역';
  };

  const total = items.reduce((s, i) => s + (Number(i.total_amount) || 0), 0);

  return (
    <div className="dashboard-detail">
      <ProgressBar loading={loading} />
      <header className="page-header">
        <h1>{getTitle()}</h1>
        <Link to="/" className="btn btn-secondary">← 대시보드</Link>
      </header>

      <section className="card filter-section">
        <h2>조회 조건</h2>
        <form onSubmit={handleSearch} className="filter-form">
          <div className="filter-row">
            <label>기간</label>
            <input type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
            <span>~</span>
            <input type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
          </div>
          <div className="filter-row">
            <label>항목</label>
            <select value={filters.account_item_id} onChange={e => setFilters(f => ({ ...f, account_item_id: e.target.value }))}>
              <option value="">전체</option>
              {accountItems.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div className="filter-row">
            <label>현장</label>
            <select value={filters.project} onChange={e => setFilters(f => ({ ...f, project: e.target.value }))}>
              <option value="">전체</option>
              {projects.map(p => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="filter-row">
            <label>사용자</label>
            <input placeholder="검색" value={filters.user_name} onChange={e => setFilters(f => ({ ...f, user_name: e.target.value }))} />
          </div>
          <div className="filter-row">
            <label>사용내역</label>
            <input placeholder="세부사용내역 검색" value={filters.description} onChange={e => setFilters(f => ({ ...f, description: e.target.value }))} />
          </div>
          <button type="submit" className="btn btn-primary">조회</button>
        </form>
      </section>

      {loading ? (
        <div className="page-loading" />
      ) : (
        <div className="card table-card">
          <div className="detail-summary">
            <span>총 {items.length}건</span>
            <span className="total">합계: {formatCurrency(total)}원</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>사용일자</th>
                <th>사용자</th>
                <th>현장</th>
                <th>항목</th>
                <th>세부사용내역</th>
                <th>카드</th>
                <th>현금</th>
                <th>합계</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i, idx) => (
                <tr key={idx}>
                  <td>{i.use_date}</td>
                  <td>{i.user_name || '-'}</td>
                  <td>{i.project_name}</td>
                  <td>{i.account_item_name}</td>
                  <td>{i.description}</td>
                  <td>{formatCurrency(i.card_amount)}</td>
                  <td>{formatCurrency(i.cash_amount)}</td>
                  <td>{formatCurrency(i.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <div className="empty">상세 내역이 없습니다.</div>}
        </div>
      )}
    </div>
  );
};
