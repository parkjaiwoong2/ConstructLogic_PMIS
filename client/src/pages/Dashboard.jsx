import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, LabelList } from 'recharts';
import { api, nextTick } from '../api';
import { useAuth } from '../contexts/AuthContext';
import ProgressBar from '../components/ProgressBar';
import './Dashboard.css';

function formatCurrency(n) {
  return new Intl.NumberFormat('ko-KR').format(n || 0);
}

const CHART_COLORS = ['#1e5a8e', '#2a7ab8', '#0d9488', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777'];

/** 데이터 기반 보고서 평가 문구 생성 (CEO 보고용) */
function generateReportEvaluation(summary, companyName, from, to) {
  const byAccount = summary?.byAccount || [];
  const byProject = summary?.byProject || [];
  const byMonth = summary?.byMonth || [];
  const totalAmt = byAccount.reduce((s, a) => s + (Number(a.total) || 0), 0) || byProject.reduce((s, p) => s + (Number(p.total) || 0), 0);
  const topAccount = byAccount[0];
  const topProject = byProject[0];
  const monthTrend = byMonth.length >= 2 ? (Number(byMonth[byMonth.length - 1]?.total) || 0) - (Number(byMonth[0]?.total) || 0) : 0;
  const lines = [];
  lines.push(`본 보고서는 ${companyName || '회사'}의 ${from || ''} ~ ${to || ''} 기간 지출 현황을 분석한 결과입니다.`);
  if (totalAmt > 0) {
    lines.push(`총 지출액은 ${new Intl.NumberFormat('ko-KR').format(totalAmt)}원이며,`);
    if (topAccount) lines.push(`항목별로는 "${topAccount.account_item_name || topAccount.name}"(이)가 ${topAccount.total ? new Intl.NumberFormat('ko-KR').format(Number(topAccount.total)) : '-'}원으로 가장 큰 비중을 차지하였습니다.`);
    if (topProject) lines.push(`현장별로는 "${topProject.project_name || topProject.name}"의 지출이 가장 높았습니다.`);
    if (byMonth.length >= 2) {
      if (monthTrend > 0) lines.push(`월별 추이상 전기 대비 증가세를 보였습니다.`);
      else if (monthTrend < 0) lines.push(`월별 추이상 전기 대비 감소세를 보였습니다.`);
      else lines.push(`월별 지출은 안정적인 수준을 유지하였습니다.`);
    }
  } else {
    lines.push('해당 기간 집계된 지출 데이터가 없습니다.');
  }
  return lines.join(' ');
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, company } = useAuth();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState('');
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [chartType, setChartType] = useState('bar');

  useEffect(() => {
    api.getCompanies({ list: 1, mine: 1 }).then(list => {
      const arr = list || [];
      setCompanies(arr);
      const def = arr.length === 1 ? arr[0] : (arr.find(c => c.id === user?.company_id) || arr[0]);
      if (def) setCompanyId(String(def.id));
    }).catch(() => setCompanies([]));
  }, []);

  const loadSummary = async () => {
    setLoading(true);
    setError(null);
    await nextTick();
    try {
      const params = { from, to };
      if (companyId) params.company_id = companyId;
      const data = await api.getDashboardSummary(params);
      setSummary(data);
      setError(null);
    } catch (err) {
      setError(err?.message || '데이터를 불러오지 못했습니다.');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSummary(); }, [from, to, companyId]);

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
    amount: Number(a.total) || 0,
    fill: CHART_COLORS[i % CHART_COLORS.length],
    account_item_id: a.account_item_id,
  })) || [];

  const projectChartData = summary.byProject?.map((p, i) => ({
    name: p.project_name,
    value: Number(p.total) || 0,
    amount: Number(p.total) || 0,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  })) || [];

  const monthChartData = summary.byMonth?.map((m, i) => ({
    name: m.month,
    value: Number(m.total) || 0,
    amount: Number(m.total) || 0,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  })) || [];

  const goDetail = (params) => {
    const q = new URLSearchParams({ ...params, from, to });
    navigate(`/dashboard/detail?${q}`);
  };

  const renderBarChart = (data, dataKey, layout, onClick, opts = {}) => {
    const margin = { left: 20, right: opts.marginRight ?? (layout === 'vertical' ? 90 : 20), top: 28, bottom: 20 };
    return (
    <BarChart data={data} layout={layout} margin={margin} barSize={opts.barSize} barCategoryGap={opts.barCategoryGap}>
      <CartesianGrid strokeDasharray="3 3" />
      {layout === 'vertical' ? (
        <>
          <XAxis type="number" tickFormatter={(v) => (v >= 10000 ? (v / 10000) + '만' : v)} />
          <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
        </>
      ) : (
        <>
          <XAxis dataKey="name" />
          <YAxis tickFormatter={(v) => (v >= 10000 ? (v / 10000) + '만' : v)} />
        </>
      )}
      <Tooltip formatter={(v) => formatCurrency(v) + '원'} cursor={{ fill: 'rgba(0,0,0,0.06)' }} />
      <Bar dataKey={dataKey} name="금액" fill="#1e5a8e" radius={layout === 'vertical' ? [0, 4, 4, 0] : [4, 4, 0, 0]} onClick={onClick} cursor="pointer">
        <LabelList dataKey={dataKey} position={layout === 'vertical' ? 'right' : 'top'} formatter={(v) => formatCurrency(v)} />
      </Bar>
    </BarChart>
  );};

  const renderPieChart = (data, onClick) => (
    <PieChart>
      <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} onClick={onClick} cursor="pointer">
        {data.map((_, i) => (
          <Cell key={i} fill={data[i].fill} />
        ))}
      </Pie>
      <Tooltip formatter={(v) => formatCurrency(v) + '원'} />
    </PieChart>
  );

  const renderLineChart = (data, dataKey, layout, onClick) => (
    <LineChart data={data} layout={layout} margin={{ left: 20, right: 20, top: 20, bottom: 20 }}>
      <CartesianGrid strokeDasharray="3 3" />
      {layout === 'vertical' ? (
        <>
          <XAxis type="number" tickFormatter={(v) => (v >= 10000 ? (v / 10000) + '만' : v)} />
          <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
        </>
      ) : (
        <>
          <XAxis dataKey="name" />
          <YAxis tickFormatter={(v) => (v >= 10000 ? (v / 10000) + '만' : v)} />
        </>
      )}
      <Tooltip formatter={(v) => formatCurrency(v) + '원'} />
      <Line type="monotone" dataKey={dataKey} stroke="#1e5a8e" strokeWidth={2} dot={{ r: 4 }} onClick={onClick} cursor="pointer" />
    </LineChart>
  );

  return (
    <div className="dashboard">
      <ProgressBar loading={loading} />
      <div className="ceo-report-print-only">
        <div className="ceo-report-cover">
          <h1 className="ceo-report-title">경영 보고서</h1>
          <p className="ceo-report-sub">CEO 보고용 · 지출 현황 대시보드</p>
        </div>
      </div>
      <header className="page-header">
        <h1>CEO 대시보드</h1>
        <span className="chart-hint">그래프를 클릭하면 상세 내역을 볼 수 있습니다</span>
        <div className="dashboard-controls no-print" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
          <span className="chart-type-label">그래프</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
            <input type="radio" name="chartType" value="bar" checked={chartType === 'bar'} onChange={() => setChartType('bar')} />
            <span>막대</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
            <input type="radio" name="chartType" value="pie" checked={chartType === 'pie'} onChange={() => setChartType('pie')} />
            <span>원형</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
            <input type="radio" name="chartType" value="line" checked={chartType === 'line'} onChange={() => setChartType('line')} />
            <span>선</span>
          </label>
          <button type="button" className="btn btn-secondary" onClick={() => window.print()} style={{ marginLeft: '0.5rem' }}>그래프 출력</button>
        </div>
        <select value={companyId || ''} onChange={e => setCompanyId(e.target.value || '')} disabled={companies.length <= 1} style={{ minWidth: 140 }}>
          {companies.map(c => (
            <option key={c.id} value={c.id}>{c.name}{c.id === user?.company_id ? ' (대표)' : ''}</option>
          ))}
        </select>
        <div className="date-range">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <span>~</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </header>

      <div className="dashboard-grid dashboard-print-area">
        <section className="card card-chart">
          <h2>항목별 지출</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={240}>
              {chartType === 'bar' && renderBarChart(accountChartData, 'amount', undefined, (ev) => ev?.name && goDetail({ type: 'account', ...(ev.account_item_id != null ? { id: ev.account_item_id } : {}), name: ev.name }))}
              {chartType === 'pie' && renderPieChart(accountChartData, (ev) => { const p = ev?.payload ?? ev; if (p?.name) goDetail({ type: 'account', ...(p.account_item_id != null ? { id: p.account_item_id } : {}), name: p.name }); })}
              {chartType === 'line' && renderLineChart(accountChartData, 'amount', undefined, (ev) => ev?.name && goDetail({ type: 'account', ...(ev?.account_item_id != null ? { id: ev.account_item_id } : {}), name: ev.name }))}
            </ResponsiveContainer>
          </div>
          {accountChartData.length === 0 && <div className="chart-empty">데이터 없음</div>}
        </section>

        <section className="card card-chart">
          <h2>현장(건)별 지출</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={240}>
              {chartType === 'bar' && renderBarChart(projectChartData, 'amount', 'vertical', (ev) => ev?.name && goDetail({ type: 'project', project: ev.name, name: ev.name }), { marginRight: 110 })}
              {chartType === 'pie' && renderPieChart(projectChartData, (ev) => { const p = ev?.payload ?? ev; if (p?.name) goDetail({ type: 'project', project: p.name, name: p.name }); })}
              {chartType === 'line' && renderLineChart(projectChartData, 'amount', 'vertical', (ev) => ev?.name && goDetail({ type: 'project', project: ev.name, name: ev.name }))}
            </ResponsiveContainer>
          </div>
          {projectChartData.length === 0 && <div className="chart-empty">데이터 없음</div>}
        </section>

        <section className="card card-chart card-full">
          <h2>월별 지출 추이</h2>
          <div className="chart-container chart-tall">
            <ResponsiveContainer width="100%" height={280}>
              {chartType === 'bar' && renderBarChart(monthChartData, 'amount', undefined, (ev) => ev?.name && goDetail({ type: 'month', month: ev.name }), { marginRight: 30 })}
              {chartType === 'pie' && renderPieChart(monthChartData, (ev) => { const p = ev?.payload ?? ev; if (p?.name) goDetail({ type: 'month', month: p.name }); })}
              {chartType === 'line' && renderLineChart(monthChartData, 'amount', undefined, (ev) => ev?.name && goDetail({ type: 'month', month: ev.name }))}
            </ResponsiveContainer>
          </div>
          {monthChartData.length === 0 && <div className="chart-empty">데이터 없음</div>}
        </section>
      </div>

      <div className="ceo-report-evaluation ceo-report-print-only">
        <h3>종합 평가</h3>
        <p>{generateReportEvaluation(summary, companies.find(c => String(c.id) === companyId)?.name || company?.name, from, to)}</p>
      </div>

      <div className="ceo-report-footer ceo-report-print-only">
        <span>회사 {companies.find(c => String(c.id) === companyId)?.name || company?.name || '-'} · 보고 기간 {from} ~ {to}</span>
      </div>

      <div className="quick-actions">
        <Link to="/expense/new" className="btn btn-primary">사용내역 입력</Link>
        <Link to="/approval-processing" className="btn btn-secondary">결재처리</Link>
      </div>
    </div>
  );
}
