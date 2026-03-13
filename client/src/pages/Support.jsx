import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Support.css';

export default function Support() {
  const { user } = useAuth();
  const isStandalone = !user;

  return (
    <div className={`support-page ${isStandalone ? 'support-standalone' : ''}`}>
      {isStandalone && (
        <header className="support-header">
          <div className="support-header-inner">
            <Link to="/" className="support-logo" title="메인으로">PMIS</Link>
            <nav className="support-nav">
              <Link to="/service">서비스소개</Link>
              <Link to="/pricing">요금안내</Link>
              <Link to="/support" className="active">지원</Link>
            </nav>
            <div className="support-header-actions">
              <Link to="/login" className="support-header-link">로그인</Link>
              <Link to="/signup" className="support-header-btn">무료체험 신청</Link>
            </div>
          </div>
        </header>
      )}

      <div className="support-content">
        <div className="support-coming">
          <span className="support-coming-badge">서비스 예정</span>
          <p className="support-coming-desc">지원 서비스는 준비 중입니다.</p>
          {isStandalone && <Link to="/" className="support-back">← 메인으로</Link>}
        </div>
      </div>
    </div>
  );
}
