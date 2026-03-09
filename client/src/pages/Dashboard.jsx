import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import './Dashboard.css';

function formatCurrency(n) {
  return new Intl.NumberFormat('ko-KR').format(n || 0);
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    api.getDashboardSummary({ from, to }).then(setSummary).catch(console.error);
  }, [from, to]);

  if (!summary) return <div className="page-loading">로딩 중...</div>;

  return (
    <div className="dashboard">
      <header className="page-header">
        <h1>CEO 대시보드</h1>
        <div className="date-range">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <span>~</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </header>

      <div className="dashboard-grid">
        <section className="card card-chart">
          <h2>항목별 지출</h2>
          <ul className="list-account">
            {summary.byAccount?.map((a, i) => (
              <li key={i}>
                <span className="label">{a.account_item_name}</span>
                <span className="value">{formatCurrency(a.total)}원</span>
              </li>
            ))}
            {(!summary.byAccount || summary.byAccount.length === 0) && (
              <li className="empty">데이터 없음</li>
            )}
          </ul>
        </section>

        <section className="card card-chart">
          <h2>현장(건)별 지출</h2>
          <ul className="list-project">
            {summary.byProject?.map((p, i) => (
              <li key={i}>
                <span className="label">{p.project_name}</span>
                <span className="value">{formatCurrency(p.total)}원</span>
              </li>
            ))}
            {(!summary.byProject || summary.byProject.length === 0) && (
              <li className="empty">데이터 없음</li>
            )}
          </ul>
        </section>

        <section className="card card-chart card-full">
          <h2>월별 지출 추이</h2>
          <ul className="list-month">
            {summary.byMonth?.map((m, i) => (
              <li key={i}>
                <span className="label">{m.month}</span>
                <span className="value">{formatCurrency(m.total)}원</span>
              </li>
            ))}
            {(!summary.byMonth || summary.byMonth.length === 0) && (
              <li className="empty">데이터 없음</li>
            )}
          </ul>
        </section>
      </div>

      <div className="quick-actions">
        <Link to="/expense/new" className="btn btn-primary">사용내역 입력</Link>
        <Link to="/documents" className="btn btn-secondary">결재 문서 목록</Link>
      </div>
    </div>
  );
}
