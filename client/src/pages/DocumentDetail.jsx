import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, nextTick } from '../api';
import { useAuth } from '../contexts/AuthContext';
import ProgressBar from '../components/ProgressBar';
import './DocumentDetail.css';

function formatCurrency(n) {
  return new Intl.NumberFormat('ko-KR').format(n || 0);
}

const statusMap = {
  draft: '작성중',
  pending: '결재대기',
  approved: '승인',
  rejected: '반려',
};

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.is_admin || user?.role === 'admin';
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [action, setAction] = useState('');
  const [comment, setComment] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await nextTick();
      try {
        const d = await api.getDocument(id);
        if (!cancelled) { setDoc(d); }
      } catch {
        if (!cancelled) setDoc(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const handleApprove = async () => {
    if (!['approved', 'rejected'].includes(action)) return;
    setApproving(true);
    setLoading(true);
    await nextTick();
    try {
      await api.approveDocument(id, { action, comment });
      const d = await api.getDocument(id);
      setDoc(d);
      setAction('');
      setComment('');
    } catch (err) {
      alert(err.message || '처리 실패');
    } finally {
      setApproving(false);
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!doc?.card_no?.trim()) {
      alert('카드번호가 없습니다. 문서를 수정해 카드번호를 입력한 후 기안해 주세요.');
      return;
    }
    setLoading(true);
    try {
      await api.submitDocument(id);
      const d = await api.getDocument(id);
      setDoc(d);
    } catch (err) {
      alert(err.message || '제출 실패');
    } finally { setLoading(false); }
  };

  const handleWithdraw = async () => {
    if (!confirm('기안을 취소하시겠습니까? 작성중으로 돌아가 수정할 수 있습니다.')) return;
    setLoading(true);
    await nextTick();
    try {
      await api.withdrawDocument(id);
      const d = await api.getDocument(id);
      setDoc(d);
    } catch (err) {
      alert(err.message || '기안 취소 실패');
    } finally { setLoading(false); }
  };

  if (!doc) return (
    <>
      <ProgressBar loading={loading} />
      {!loading && <div className="page-loading">데이터를 불러올 수 없습니다.</div>}
    </>
  );

  const canApprove = ['pending'].includes(doc.status);
  const canEdit = doc.status === 'draft';
  const canSubmit = doc.status === 'draft';
  const canWithdraw = doc.status === 'pending';
  const canAdminEdit = isAdmin && !canEdit;

  return (
    <div className="document-detail">
      <ProgressBar loading={loading} />
      <header className="page-header">
        <h1>결재 문서 상세</h1>
        <div className="header-actions">
          {canEdit && <Link to={`/expense/${id}/edit`} className="btn btn-secondary">수정</Link>}
          {canAdminEdit && <Link to={`/expense/${id}/edit`} className="btn btn-secondary">관리자 수정</Link>}
          {canSubmit && <button className="btn btn-primary" onClick={handleSubmit}>결재 요청</button>}
          {canWithdraw && <button className="btn btn-secondary" onClick={handleWithdraw}>기안 취소</button>}
        </div>
      </header>

      <section className="card approval-progress-section">
        <h2>결재진행</h2>
        <div className="approval-progress">
          <div className="progress-chain">
            작성자({doc.user_name})
            {(doc.approval_steps || []).map((s, i) => (
              <span key={i}>
                {' → '}
                <span className={s.action === 'rejected' ? 'rejected' : ''}>{s.label}({s.name})</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="card doc-info">
        <h2>기본정보</h2>
        <div className="info-grid">
          <div><span className="label">문서번호</span> {doc.doc_no}</div>
          <div><span className="label">상태</span> {statusMap[doc.status]}</div>
          <div><span className="label">사용자</span> {doc.user_name}</div>
          <div><span className="label">카드번호</span> {doc.card_no || '-'}</div>
          <div><span className="label">현장</span> {doc.project_name}</div>
          <div><span className="label">기간</span> {doc.period_start} ~ {doc.period_end}</div>
          <div><span className="label">카드 합계</span> {formatCurrency(doc.total_card_amount)}원</div>
          <div><span className="label">현금 합계</span> {formatCurrency(doc.total_cash_amount)}원</div>
        </div>
      </section>

      <section className="card doc-items">
        <h2>사용내역</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>날짜</th>
              <th>항목</th>
              <th>세부사용내역</th>
              <th>카드</th>
              <th>현금</th>
            </tr>
          </thead>
          <tbody>
            {doc.items?.map((i, idx) => (
              <tr key={idx}>
                <td>{i.use_date}</td>
                <td>{i.account_item_name}</td>
                <td>{i.description}</td>
                <td>{formatCurrency(i.card_amount)}</td>
                <td>{formatCurrency(i.cash_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {canApprove && (
        <section className="card approve-section">
          <h2>결재</h2>
          <div className="approve-form">
            <div className="form-row">
              <label>처리</label>
              <select value={action} onChange={e => setAction(e.target.value)}>
                <option value="">선택</option>
                <option value="approved">승인</option>
                <option value="rejected">반려</option>
              </select>
            </div>
            <div className="form-row">
              <label>의견</label>
              <input value={comment} onChange={e => setComment(e.target.value)} placeholder="(선택)" />
            </div>
            <button
              className="btn btn-primary"
              onClick={handleApprove}
              disabled={!action || approving}
            >
              {approving ? '처리 중...' : '확인'}
            </button>
          </div>
        </section>
      )}

      <div className="back-link">
        <Link to="/documents">← 목록으로</Link>
      </div>
    </div>
  );
}
