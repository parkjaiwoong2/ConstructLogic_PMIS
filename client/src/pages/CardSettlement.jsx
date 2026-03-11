import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, nextTick } from '../api';
import { useAuth } from '../contexts/AuthContext';
import Pagination, { PAGE_SIZE } from '../components/Pagination';
import ProgressBar from '../components/ProgressBar';
import './DocumentList.css';

const MANUAL_INPUT = '__manual__';

function formatCurrency(n) {
  return new Intl.NumberFormat('ko-KR').format(n || 0);
}

function maskCard(c) {
  if (!c) return '-';
  const s = String(c);
  const m = s.match(/^(\d{4})-(\d{4})-(\d{4})-(\d+)$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}-****` : s;
}

function getDefaultPeriod() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const period_from = prev.toISOString().slice(0, 10);
  return { period_from, period_to: today };
}

export default function CardSettlement() {
  const { user } = useAuth();
  const isAdmin = user?.is_admin || user?.role === 'admin';
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [sumCardAmount, setSumCardAmount] = useState(0);
  const [sumCashAmount, setSumCashAmount] = useState(0);
  const [page, setPage] = useState(1);
  const [projects, setProjects] = useState([]);
  const [cards, setCards] = useState([]);
  const [cardSelect, setCardSelect] = useState('');
  const [cardManualInput, setCardManualInput] = useState('');
  const [companies, setCompanies] = useState([]);
  const [filter, setFilter] = useState(() => {
    const { period_from, period_to } = getDefaultPeriod();
    return { period_from, period_to, project: '', settled: '', company_id: '' };
  });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const effectiveCardNo = cardSelect === MANUAL_INPUT ? cardManualInput.trim() : (cardSelect || '');

  const buildParams = (p = page) => {
    const params = {
      period_from: (filter.period_from || '').trim() || undefined,
      period_to: (filter.period_to || '').trim() || undefined,
      project: (filter.project || '').trim() || undefined,
      card_no: effectiveCardNo || undefined,
      settled: (filter.settled || '').trim() || undefined,
      limit: PAGE_SIZE,
      offset: (p - 1) * PAGE_SIZE,
    };
    if (filter.company_id) params.company_id = filter.company_id;
    return params;
  };

  const load = async (pageOverride) => {
    const params = buildParams(pageOverride ?? page);
    setLoading(true);
    await nextTick();
    try {
      const data = await api.getCardSettlement(params);
      setItems(data.items || []);
      setTotal(data.total ?? 0);
      setSumCardAmount(data.sum_card_amount ?? 0);
      setSumCashAmount(data.sum_cash_amount ?? 0);
    } catch (err) {
      console.error('카드정산 조회 실패:', err);
      setItems([]);
      setTotal(0);
      setSumCardAmount(0);
      setSumCashAmount(0);
      alert(err?.message || '조회 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    load(1);
  };

  useEffect(() => {
    load();
  }, [filter.period_from, filter.period_to, filter.project, filter.settled, filter.company_id, effectiveCardNo, page]);

  useEffect(() => {
    const cid = filter.company_id ? parseInt(filter.company_id, 10) : null;
    (cid ? api.getProjects(cid) : api.getProjects()).then(setProjects).catch(() => setProjects([]));
  }, [filter.company_id]);

  useEffect(() => {
    api.getCompanies({ list: 1 }).then(list => {
      const arr = list || [];
      setCompanies(arr);
      setFilter(prev => {
        if (prev.company_id) return prev;
        const def = arr.length === 1 ? arr[0] : (arr.find(c => c.id === user?.company_id) || arr[0]);
        return def ? { ...prev, company_id: String(def.id) } : prev;
      });
    }).catch(() => setCompanies([]));
  }, []);

  useEffect(() => {
    const loadCards = async () => {
      try {
        const companyId = filter.company_id || undefined;
        const list = await api.getCorporateCards(companyId);
        setCards(Array.isArray(list) ? list : []);
        setCardSelect(''); // 회사 변경 시 전체 카드로 초기화
      } catch {
        setCards([]);
        setCardSelect('');
      }
    };
    loadCards();
  }, [filter.company_id]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectableItems = items.filter(d => !d.settled_at);
  const toggleSelectAll = () => {
    const allSelected = selectableItems.every(d => selectedIds.has(d.id));
    if (allSelected && selectableItems.length > 0) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        selectableItems.forEach(d => next.delete(d.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        selectableItems.forEach(d => next.add(d.id));
        return next;
      });
    }
  };

  const handleBatchExcel = async () => {
    try {
      const params = { status: 'approved' };
      if (filter.period_from) params.period_from = filter.period_from;
      if (filter.period_to) params.period_to = filter.period_to;
      if (filter.project) params.project = filter.project;
      if (effectiveCardNo) params.card_no = effectiveCardNo;
      if (filter.company_id) params.company_id = filter.company_id;
      const res = await api.downloadBatchApprovalExcel(params);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || res.statusText || '다운로드 실패');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `카드사용내역서_${filter.period_from || ''}_${filter.period_to || ''}.xlsx`.replace(/__/g, '_').replace(/^_|_$/g, '') || '카드사용내역서.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch (err) {
      alert(err?.message || '출력 실패');
    }
  };

  const handleProcess = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      alert('정산 처리할 문서를 선택하세요.');
      return;
    }
    if (!confirm(`선택한 ${ids.length}건을 정산 처리하시겠습니까?`)) return;
    setProcessing(true);
    try {
      await api.processCardSettlement({ document_ids: ids });
      alert(`${ids.length}건 정산 처리되었습니다.`);
      setSelectedIds(new Set());
      load();
    } catch (err) {
      alert(err.message || '정산 처리 실패');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="document-list card-settlement">
      <ProgressBar loading={loading} />
      <header className="page-header">
        <h1>카드정산</h1>
      </header>
      <p className="subtitle">승인된 결재 문서만 목록에 표시됩니다. 선택한 항목을 정산 처리할 수 있습니다.</p>

      <div className="filters">
        <select value={filter.company_id || ''} onChange={e => { setFilter(f => ({ ...f, company_id: e.target.value || '' })); setPage(1); }} disabled={companies.length === 1} style={{ minWidth: 140 }}>
          <option value="">전체 회사</option>
          {companies.map(c => (
            <option key={c.id} value={c.id}>{c.name}{c.id === user?.company_id ? ' (대표)' : ''}</option>
          ))}
        </select>
        <label className="filter-label">기간</label>
        <input
          type="date"
          value={filter.period_from}
          onChange={e => { setFilter(f => ({ ...f, period_from: e.target.value })); setPage(1); }}
          placeholder="시작일"
        />
        <span>~</span>
        <input
          type="date"
          value={filter.period_to}
          onChange={e => setFilter(f => ({ ...f, period_to: e.target.value }))}
          placeholder="종료일"
        />
        <select value={filter.project} onChange={e => { setFilter(f => ({ ...f, project: e.target.value })); setPage(1); }}>
          <option value="">전체 현장</option>
          {projects.map(p => (
            <option key={p.id} value={p.name}>{p.name}</option>
          ))}
        </select>
        <div className="card-filter-wrap" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <select
            value={cardSelect}
            onChange={e => {
              const v = e.target.value;
              setCardSelect(v);
              if (v !== MANUAL_INPUT) setCardManualInput('');
              setPage(1);
            }}
            style={{ minWidth: 140 }}
          >
            <option value="">전체 카드</option>
            {cards.map(c => (
              <option key={c.id} value={c.card_no}>
                {c.label ? `${c.card_no} (${c.label})` : c.card_no}
              </option>
            ))}
            <option value={MANUAL_INPUT}>직접입력</option>
          </select>
          {cardSelect === MANUAL_INPUT && (
            <input
              type="text"
              value={cardManualInput}
              onChange={e => { setCardManualInput(e.target.value); setPage(1); }}
              placeholder="카드번호 입력"
              style={{ minWidth: 140 }}
            />
          )}
        </div>
        <select value={filter.settled} onChange={e => { setFilter(f => ({ ...f, settled: e.target.value })); setPage(1); }}>
          <option value="">전체 정산여부</option>
          <option value="n">미정산</option>
          <option value="y">정산완료</option>
        </select>
        <button type="button" className="btn btn-primary" onClick={handleSearch}>조회</button>
        <button type="button" className="btn btn-primary" onClick={handleBatchExcel}>일괄결제출력</button>
      </div>

      <div className="settlement-action-row" style={{ marginBottom: '0.5rem', fontSize: '0.95rem', color: 'var(--color-text-muted, #64748b)' }}>
        승인 건 (총 {total}건)
      </div>
      <div className="settlement-action-row" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleProcess}
          disabled={processing || selectedIds.size === 0}
        >
          {processing ? '처리 중...' : `정산처리 (${selectedIds.size}건)`}
        </button>
      </div>

      <div className="card table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 44 }}>
                <input
                  type="checkbox"
                  checked={selectableItems.length > 0 && selectableItems.every(d => selectedIds.has(d.id))}
                  onChange={toggleSelectAll}
                  aria-label="전체 선택"
                />
              </th>
              <th>문서번호</th>
              <th>사용자</th>
              <th>현장</th>
              <th>기간</th>
              <th>카드</th>
              <th>카드금액</th>
              <th>현금금액</th>
              <th>정산여부</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map(d => (
              <tr key={d.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(d.id)}
                    onChange={() => toggleSelect(d.id)}
                    disabled={!!d.settled_at}
                    aria-label={`${d.doc_no} 선택`}
                  />
                </td>
                <td>{d.doc_no}</td>
                <td>{d.user_name}</td>
                <td>{d.project_name}</td>
                <td>{d.period_start} ~ {d.period_end}</td>
                <td>{maskCard(d.card_no)}</td>
                <td>{formatCurrency(d.total_card_amount)}원</td>
                <td>{formatCurrency(d.total_cash_amount)}원</td>
                <td>
                  {d.settled_at ? (
                    <span className="status-badge" style={{ background: '#059669' }}>정산완료</span>
                  ) : (
                    <span className="status-badge" style={{ background: '#6b7280' }}>미정산</span>
                  )}
                </td>
                <td>
                  <Link to={`/documents/${d.id}`} className="link">보기</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <div className="empty">승인된 카드 사용 결재 문서가 없습니다.</div>
        )}
        {items.length > 0 && (
          <div className="settlement-summary" style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--color-bg-muted, #f8fafc)', borderRadius: 6, fontWeight: 600 }}>
            합계: 카드금액 {formatCurrency(sumCardAmount)}원 · 현금금액 {formatCurrency(sumCashAmount)}원
          </div>
        )}
        <Pagination total={total} page={page} onChange={setPage} />
      </div>
    </div>
  );
}
