import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { api, nextTick } from '../api';
import ProgressBar from '../components/ProgressBar';
import './Dashboard.css';

function formatCurrency(n) {
  return new Intl.NumberFormat('ko-KR').format(n || 0);
}

const CHART_COLORS = ['#1e5a8e', '#2a7ab8', '#0d9488', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777'];

export default function Dashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const loadSummary = async () => {
    setLoading(true);
    setError(null);
    await nextTick();
    try {
      const data = await api.getDashboardSummary({ from, to });
      setSummary(data);
      setError(null);
    } catch (err) {
      setError(err?.message || '데이터를 불러오지 못했습니다.');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSummary(); }, [from, to]);

  if (loading && !summary) return <ProgressBar loading={loading} />;
  if (error) return (
    <div className="page-loading" style={{ flexDirection: 'column', gap: '1rem' }}>
      <p style={{ color: '#dc2626' }}>{error}</p>
      <button className="btn btn-primary" onClick={loadSummary}>다시 시도</button>
    </div>
  );

  const accountChartData = summary.byAccount?.map((a, i) => ({
    name: a.account_item_name,
    value: Number(a.total) || 0,
    fill: CHART_COLORS[i % CHART_COLORS.length],
    account_item_id: a.account_item_id,
  })) || [];

  const projectChartData = summary.byProject?.map((p, i) => ({
    name: p.project_name,
    amount: Number(p.total) || 0,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  })) || [];

  const monthChartData = summary.byMonth?.map(m => ({
    name: m.month,
    amount: Number(m.total) || 0,
  })) || [];

  const goDetail = (params) => {
    const q = new URLSearchParams({ ...params, from, to });
    navigate(`/dashboard/detail?${q}`);
  };

  return (
    <div className="dashboard">
      <ProgressBar loading={loading} />
      <header className="page-header">
        <h1>CEO 대시보드</h1>
        <span className="chart-hint">그래프를 클릭하면 상세 내역을 볼 수 있습니다</span>
        <div className="date-range">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <span>~</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </header>

      <div className="dashboard-grid">
        <section className="card card-chart">
          <h2>항목별 지출</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={accountChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  onClick={(ev) => {
                  const p = ev?.payload ?? ev;
                  if (!p?.name) return;
                  goDetail({ type: 'account', ...(p.account_item_id != null ? { id: p.account_item_id } : {}), name: p.name });
                }}
                  cursor="pointer"
                >
                  {accountChartData.map((_, i) => (
                    <Cell key={i} fill={accountChartData[i].fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(v) + '원'} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {accountChartData.length === 0 && <div className="chart-empty">데이터 없음</div>}
        </section>

        <section className="card card-chart">
          <h2>현장(건)별 지출</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={projectChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => (v >= 10000 ? (v / 10000) + '만' : v)} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => formatCurrency(v) + '원'} cursor={{ fill: 'rgba(0,0,0,0.06)' }} />
                <Bar dataKey="amount" name="금액" fill="#1e5a8e" radius={[0, 4, 4, 0]} onClick={(data) => data?.name && goDetail({ type: 'project', project: data.name, name: data.name })} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {projectChartData.length === 0 && <div className="chart-empty">데이터 없음</div>}
        </section>

        <section className="card card-chart card-full">
          <h2>월별 지출 추이</h2>
          <div className="chart-container chart-tall">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthChartData} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => (v >= 10000 ? (v / 10000) + '만' : v)} />
                <Tooltip formatter={(v) => formatCurrency(v) + '원'} cursor={{ fill: 'rgba(0,0,0,0.06)' }} />
                <Bar dataKey="amount" name="지출" fill="#1e5a8e" radius={[4, 4, 0, 0]} onClick={(data) => data?.name && goDetail({ type: 'month', month: data.name })} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {monthChartData.length === 0 && <div className="chart-empty">데이터 없음</div>}
        </section>
      </div>

      <div className="quick-actions">
        <Link to="/expense/new" className="btn btn-primary">사용내역 입력</Link>
        <Link to="/documents" className="btn btn-secondary">결재 문서 목록</Link>
      </div>
    </div>
  );
}
