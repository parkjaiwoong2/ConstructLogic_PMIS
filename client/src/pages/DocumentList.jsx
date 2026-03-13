import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, nextTick } from '../api';
import { useAuth } from '../contexts/AuthContext';
import Pagination, { PAGE_SIZE } from '../components/Pagination';
import ProgressBar from '../components/ProgressBar';
import './DocumentList.css';

const CURRENT_USER_KEY = 'currentUserName';

function formatCurrency(n) {
  return new Intl.NumberFormat('ko-KR').format(n || 0);
}

const statusMap = {
  draft: { label: '작성중', color: '#6b7280' },
  pending: { label: '결재대기', color: '#d97706' },
  approved: { label: '승인', color: '#059669' },
  rejected: { label: '반려', color: '#dc2626' },
};

function getDefaultCompanyForCombo(list, user) {
  if (!list?.length) return null;
  if (list.length === 1) return list[0];
  return list.find(c => c.id === user?.company_id) || list[0];
}

export default function DocumentList() {
  const { user, company } = useAuth();
  const [docs, setDocs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [tab, setTab] = useState('all'); // 'all' | 'mine'
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem(CURRENT_USER_KEY) || '');
  const [filter, setFilter] = useState({ status: '', project: '', period_from: '', period_to: '', company_id: '' });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(null);
  const [withdrawing, setWithdrawing] = useState(null);

  const effectiveFilter = {
    ...filter,
    user_name: tab === 'mine' && currentUser ? currentUser : '',
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };
  if (!effectiveFilter.period_from) delete effectiveFilter.period_from;
  if (!effectiveFilter.period_to) delete effectiveFilter.period_to;
  if (!effectiveFilter.company_id) delete effectiveFilter.company_id;

  const loadDocs = async () => {
    setLoading(true);
    await nextTick();
    try {
      const data = await api.getDocuments(effectiveFilter);
      if (Array.isArray(data)) {
        setDocs(data);
        setTotal(data.length);
      } else {
        setDocs(data.items || []);
        setTotal(data.total || 0);
      }
    } catch {
      setDocs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadDocs(); }, [effectiveFilter.status, effectiveFilter.project, effectiveFilter.period_from, effectiveFilter.period_to, effectiveFilter.user_name, effectiveFilter.company_id, page]);

  useEffect(() => {
    const cid = filter.company_id ? parseInt(filter.company_id, 10) : null;
    (cid ? api.getProjects(cid) : api.getProjects())
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [filter.company_id]);

  useEffect(() => {
    api.getUsers().then(setUsers).catch(() => setUsers([]));
    api.getCompanies({ list: 1, mine: 1 }).then(list => {
      const arr = list || [];
      setCompanies(arr);
      setFilter(prev => {
        if (prev.company_id) return prev;
        const def = getDefaultCompanyForCombo(arr, user);
        return def ? { ...prev, company_id: String(def.id) } : prev;
      });
    }).catch(() => setCompanies([]));
  }, []);

  useEffect(() => {
    if (currentUser) localStorage.setItem(CURRENT_USER_KEY, currentUser);
  }, [currentUser]);

  const handleSubmit = async (docId) => {
    setSubmitting(docId);
    setLoading(true);
    try {
      await api.submitDocument(docId);
      alert('결재 요청되었습니다. 결재함에서 확인하실 수 있습니다.');
      loadDocs();
    } catch (err) {
      alert(err.message || '결재 요청 실패');
    } finally {
      setSubmitting(null);
    }
  };

  const handleWithdraw = async (docId) => {
    if (!confirm('기안을 취소하시겠습니까? 작성중으로 돌아가 수정할 수 있습니다.')) return;
    setWithdrawing(docId);
    setLoading(true);
    await nextTick();
    try {
      await api.withdrawDocument(docId);
      alert('기안이 취소되었습니다.');
      loadDocs();
    } catch (err) {
      alert(err.message || '기안 취소 실패');
    } finally {
      setWithdrawing(null);
      setLoading(false);
    }
  };

  return (
    <div className="document-list">
      <ProgressBar loading={loading} />
      <header className="page-header">
        <h1>결재 문서</h1>
        <Link to="/expense/new" className="btn btn-primary">+ 새 문서 작성</Link>
      </header>
      <p className="subtitle">작성중 문서는 [결재 요청] 버튼을 눌러야 결재함에 올라갑니다. 결재대기 문서는 [기안 취소]로 수정이 가능합니다.</p>

      <div className="user-tabs-row">
        <div className="current-user-select">
          <label>현재 사용자</label>
          <input
            list="user-list"
            value={currentUser}
            onChange={e => setCurrentUser(e.target.value)}
            placeholder="등록할 사용자 선택/입력"
          />
          <datalist id="user-list">
            {users.map(u => <option key={u} value={u} />)}
          </datalist>
        </div>
        <div className="doc-tabs">
          <button
            type="button"
            className={`tab ${tab === 'all' ? 'active' : ''}`}
            onClick={() => { setTab('all'); setPage(1); }}
          >
            전체
          </button>
          <button
            type="button"
            className={`tab ${tab === 'mine' ? 'active' : ''}`}
            onClick={() => { setTab('mine'); setPage(1); }}
          >
            내가 등록한 문서
          </button>
        </div>
      </div>

      <div className="filters">
        <select value={filter.company_id || ''} onChange={e => { setFilter(f => ({ ...f, company_id: e.target.value || '' })); setPage(1); }} disabled={companies.length === 1}>
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
          onChange={e => { setFilter(f => ({ ...f, period_to: e.target.value })); setPage(1); }}
          placeholder="종료일"
        />
        <select value={filter.status} onChange={e => { setFilter(f => ({ ...f, status: e.target.value })); setPage(1); }}>
          <option value="">전체 상태</option>
          <option value="draft">작성중</option>
          <option value="pending">결재대기</option>
          <option value="approved">승인</option>
          <option value="rejected">반려</option>
        </select>
        <select value={filter.project} onChange={e => { setFilter(f => ({ ...f, project: e.target.value })); setPage(1); }}>
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
              const isAuthor = user?.name && d.user_name && String(user.name).trim() === String(d.user_name).trim();
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
                    {isAuthor && d.status === 'draft' && (
                      <>
                        <button
                          type="button"
                          className="link btn-link ml"
                          onClick={() => handleSubmit(d.id)}
                          disabled={submitting === d.id}
                        >
                          {submitting === d.id ? '요청 중...' : '결재 요청'}
                        </button>
                        <Link to={`/expense/${d.id}/edit`} className="link ml">수정</Link>
                      </>
                    )}
                    {isAuthor && d.status === 'pending' && (
                      <button
                        type="button"
                        className="link btn-link ml"
                        onClick={() => handleWithdraw(d.id)}
                        disabled={withdrawing === d.id}
                      >
                        {withdrawing === d.id ? '취소 중...' : '기안 취소'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {docs.length === 0 && (
          <div className="empty">
            {tab === 'mine' && !currentUser
              ? '현재 사용자를 선택한 후 "내가 등록한 문서"에서 조회할 수 있습니다.'
              : '결재 문서가 없습니다.'}
          </div>
        )}
        <Pagination total={total} page={page} onChange={setPage} />
      </div>
    </div>
  );
}
