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

const roleLabelMap = { reviewer: '검토', approver: '승인', ceo: '승인' };

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.is_admin || user?.role === 'admin';
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [comment, setComment] = useState('');
  const [showApprovalModal, setShowApprovalModal] = useState(false);

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

  const handleApprove = async (act) => {
    if (!['approved', 'rejected'].includes(act)) return;
    setApproving(true);
    setLoading(true);
    await nextTick();
    try {
      await api.approveDocument(id, { action: act, comment });
      const d = await api.getDocument(id);
      setDoc(d);
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

  const handleDelete = async () => {
    if (!confirm('이 문서를 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.')) return;
    setLoading(true);
    try {
      await api.deleteDocument(id);
      navigate('/approval-processing', { replace: true });
    } catch (err) {
      alert(err.message || '삭제 실패');
    } finally { setLoading(false); }
  };

  if (!doc) return (
    <>
      <ProgressBar loading={loading} />
      {!loading && <div className="page-loading">데이터를 불러올 수 없습니다.</div>}
    </>
  );

  const isAuthor = user?.name && doc.user_name && String(user.name).trim() === String(doc.user_name).trim();
  const hideApprovalContent = doc.hide_approval_content === true || isAuthor;
  const approvalConfigured = doc.approval_sequences_configured === true || (doc.approval_line || []).length > 0 || (doc.approval_pending_list || []).length > 0;
  const canApprove = doc.can_approve === true;
  const canEdit = doc.status === 'draft' && isAuthor;
  const canSubmit = doc.status === 'draft' && isAuthor;
  const canWithdraw = doc.status === 'pending' && isAuthor;
  const canDelete = doc.status === 'draft' && isAuthor;
  const canAdminEdit = isAdmin && (!isAuthor || doc.status !== 'draft');

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
          {canDelete && <button type="button" className="btn btn-secondary" onClick={handleDelete} style={{ color: '#dc2626' }}>삭제</button>}
        </div>
      </header>

      {!hideApprovalContent && (
        <section className="card approval-progress-section">
          <h2>결재진행</h2>
          <table className="approval-line-table">
            <thead>
              <tr>
                <th>구분</th>
                <th>결재자</th>
                <th>처리</th>
                <th>의견</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>기안</td>
                <td>{doc.user_name}</td>
                <td>-</td>
                <td>-</td>
              </tr>
              {(doc.approval_steps || []).map((s, i) => (
                <tr key={i}>
                  <td>{s.label}</td>
                  <td>{s.name}</td>
                  <td><span className={s.action === 'rejected' ? 'rejected' : 'approved'}>{s.action === 'approved' ? '승인' : s.action === 'rejected' ? '반려' : '-'}</span></td>
                  <td className="approval-comment-cell">{s.comment || '-'}</td>
                </tr>
              ))}
              {doc.status === 'pending' && (doc.approval_line || []).slice((doc.approval_steps || []).length).map((seq, i) => (
                <tr key={`pending-${i}`} className="approval-pending-row">
                  <td>{roleLabelMap[seq.role] || seq.role}</td>
                  <td colSpan={3}>대기</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {hideApprovalContent && (
        <section className="card approval-progress-section">
          <p className="approval-status-text">
            {doc.status === 'pending' && '결재 진행 중입니다. 결재자가 검토 후 처리합니다.'}
            {doc.status === 'pending' && !approvalConfigured && (
              <span className="approval-hint"> 결재선이 설정되지 않아 결재가 진행되지 않습니다. 설정 → 결재순서에서 결재선을 추가해 주세요.</span>
            )}
            {doc.status === 'pending' && approvalConfigured && (
              <span className="approval-hint"> 결재자는 <Link to="/approval-processing?tab=approval"><strong>결재함</strong></Link> 탭에서 문서를 확인 후 승인/반려할 수 있습니다.</span>
            )}
            {doc.status === 'approved' && '승인되었습니다.'}
            {doc.status === 'rejected' && '반려되었습니다.'}
          </p>
        </section>
      )}

      <section className="card doc-info">
        <h2>기본정보</h2>
        <div className="info-grid">
          <div><span className="label">문서번호</span> {doc.doc_no}</div>
          <div>
            <span className="label">상태</span>
            <button
              type="button"
              className="status-clickable"
              onClick={() => setShowApprovalModal(true)}
              title="결재 진행 상황 확인"
            >
              {statusMap[doc.status]}
            </button>
          </div>
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
          <div className="approve-banner">
            <strong>귀하는 이 문서의 현재 결재자입니다.</strong> 아래에서 승인 또는 반려할 수 있습니다.
          </div>
          <h2>결재 처리</h2>
          <div className="approve-form">
            <div className="form-row">
              <label>의견</label>
              <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="결재 의견 (선택)" rows={3} />
            </div>
            <div className="approve-actions">
              <button className="btn btn-primary" onClick={() => handleApprove('approved')} disabled={approving}>
                {approving ? '처리 중...' : '승인'}
              </button>
              <button className="btn btn-secondary btn-reject" onClick={() => handleApprove('rejected')} disabled={approving}>
                반려
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="back-link">
        <Link to="/approval-processing">← 목록으로</Link>
      </div>

      {showApprovalModal && (
        <div className="approval-modal-overlay" onClick={() => setShowApprovalModal(false)}>
          <div className="approval-modal" onClick={e => e.stopPropagation()}>
            <div className="approval-modal-header">
              <h3>결재 진행 상황</h3>
              <button type="button" className="approval-modal-close" onClick={() => setShowApprovalModal(false)} aria-label="닫기">×</button>
            </div>
            <div className="approval-modal-body">
              <div className="approval-modal-status">
                <strong>문서 상태</strong> {statusMap[doc.status]}
              </div>
              <table className="approval-modal-table">
                <thead>
                  <tr>
                    <th>순서</th>
                    <th>구분</th>
                    <th>결재자</th>
                    <th>처리</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>0</td>
                    <td>기안</td>
                    <td>{doc.user_name}</td>
                    <td>-</td>
                  </tr>
                  {(doc.approval_steps || []).map((s, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{s.label}</td>
                      <td>{s.name}</td>
                      <td><span className={s.action === 'rejected' ? 'rejected' : 'approved'}>{s.action === 'approved' ? '승인' : s.action === 'rejected' ? '반려' : '-'}</span></td>
                    </tr>
                  ))}
                  {(doc.status === 'pending' || doc.status === 'draft') && (doc.approval_pending_list || []).map((item, i) => (
                    <tr key={`p-${i}`} className="approval-pending-row">
                      <td>{(doc.approval_steps || []).length + i + 1}</td>
                      <td>{item.roleLabel}</td>
                      <td>
                        {item.names?.length ? (
                          <span className={doc.status === 'pending' && i === 0 ? 'approval-current' : ''}>
                            {doc.status === 'pending' && i === 0 && <strong>현재 결재할 차례 — </strong>}
                            {item.names.join(', ')}
                          </span>
                        ) : (
                          <span className="approval-pending-empty">
                            {doc.status === 'pending' && i === 0 && '현재 결재할 차례 — '}
                            {item.roleLabel} 역할
                          </span>
                        )}
                      </td>
                      <td>대기</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {doc.status === 'pending' && !approvalConfigured && (
                <div className="approval-modal-warning">
                  <p><strong>결재선이 설정되지 않았습니다.</strong></p>
                  <p>설정 → 결재순서에서 결재선을 추가해 주세요. (자동승인 사용 시 결재 요청 시 즉시 승인됩니다.)</p>
                  <p>결재자는 결재처리 → <strong>결재함</strong> 탭에서 문서를 확인 후 승인/반려할 수 있습니다.</p>
                </div>
              )}
              {doc.status === 'draft' && (
                <p className="approval-modal-done">작성중입니다. 결재 요청 시 결재선이 진행됩니다.</p>
              )}
              {doc.status === 'approved' && (
                <p className="approval-modal-done">모든 결재가 완료되었습니다. (승인)</p>
              )}
              {doc.status === 'rejected' && (
                <p className="approval-modal-done">반려 처리되었습니다.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
