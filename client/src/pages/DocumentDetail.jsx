import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
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
  const [doc, setDoc] = useState(null);
  const [approving, setApproving] = useState(false);
  const [action, setAction] = useState('');
  const [comment, setComment] = useState('');
  const [approverName, setApproverName] = useState('결재자');

  useEffect(() => {
    api.getDocument(id).then(setDoc).catch(() => setDoc(null));
  }, [id]);

  const handleApprove = async () => {
    if (!['approved', 'rejected'].includes(action)) return;
    setApproving(true);
    try {
      await api.approveDocument(id, { action, approver_name: approverName, comment });
      api.getDocument(id).then(setDoc);
      setAction('');
      setComment('');
    } catch (err) {
      alert(err.message || '처리 실패');
    } finally {
      setApproving(false);
    }
  };

  const handleSubmit = async () => {
    try {
      await api.submitDocument(id);
      api.getDocument(id).then(setDoc);
    } catch (err) {
      alert(err.message || '제출 실패');
    }
  };

  const handleWithdraw = async () => {
    if (!confirm('기안을 취소하시겠습니까? 작성중으로 돌아가 수정할 수 있습니다.')) return;
    try {
      await api.withdrawDocument(id);
      api.getDocument(id).then(setDoc);
    } catch (err) {
      alert(err.message || '기안 취소 실패');
    }
  };

  if (!doc) return <div className="page-loading">로딩 중...</div>;

  const canApprove = ['pending'].includes(doc.status);
  const canEdit = doc.status === 'draft';
  const canSubmit = doc.status === 'draft';
  const canWithdraw = doc.status === 'pending';

  return (
    <div className="document-detail">
      <header className="page-header">
        <h1>결재 문서 상세</h1>
        <div className="header-actions">
          {canEdit && <Link to={`/expense/${id}/edit`} className="btn btn-secondary">수정</Link>}
          {canSubmit && <button className="btn btn-primary" onClick={handleSubmit}>결재 요청</button>}
          {canWithdraw && <button className="btn btn-secondary" onClick={handleWithdraw}>기안 취소</button>}
        </div>
      </header>

      <section className="card doc-info">
        <h2>기본정보</h2>
        <div className="info-grid">
          <div><span className="label">문서번호</span> {doc.doc_no}</div>
          <div><span className="label">상태</span> {statusMap[doc.status]}</div>
          <div><span className="label">사용자</span> {doc.user_name}</div>
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
              <label>결재자</label>
              <input value={approverName} onChange={e => setApproverName(e.target.value)} />
            </div>
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
