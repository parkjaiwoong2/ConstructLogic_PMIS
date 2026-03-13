import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import './Main.css';

export default function Main() {
  const [company, setCompany] = useState({ name: 'PMIS', logo_url: null });
  const { user, loading } = useAuth();
  const location = useLocation();
  const isService = location.pathname === '/service';

  useEffect(() => {
    api.getCompanies().then(c => setCompany(c || { name: 'PMIS', logo_url: null })).catch(() => {});
  }, []);

  if (loading) return <div className="main-page"><div className="main-loading">로딩 중...</div></div>;
  if (user) return null;

  return (
    <div className="main-page main-frontdoor">
      {/* Main Nav - 회사 대문 스타일 */}
      <header className="main-nav">
        <div className="main-nav-inner">
          <Link to="/" className="main-nav-logo">
            {company.logo_url ? <img src={company.logo_url} alt="" /> : <span className="main-nav-logo-icon">◈</span>}
            <span className="main-nav-brand">{company.name}</span>
          </Link>
          <nav className="main-nav-links">
            <Link to="/service" className={`main-nav-link ${isService ? 'active' : ''}`}>서비스소개</Link>
            <Link to="/pricing" className="main-nav-link">요금안내</Link>
            <Link to="/support" className="main-nav-link">지원</Link>
          </nav>
          <div className="main-nav-actions">
            <Link to="/login" className="main-nav-btn-text">로그인</Link>
            <Link to="/signup" className="main-nav-btn-primary">무료체험 신청</Link>
          </div>
        </div>
      </header>

      {/* Hero - AI 이미지 배경 위에 텍스트 */}
      <section className="main-hero-section" id="hero">
        <div className="main-hero-bg-img" style={{ backgroundImage: 'url(/assets/main-hero-person-with-laptop.png)' }} aria-hidden="true" />
        <div className="main-hero-overlay" aria-hidden="true" />
        <div className="main-hero-inner">
          <div className="main-hero-content">
            <p className="main-hero-intro">하나로 연결되는 건설 PMIS 혁신, {company.name}</p>
            <h1 className="main-hero-title">No.1 건설사 전용 PMIS로<br />사용내역부터 결재까지 한곳에서 관리하세요.</h1>
            <p className="main-hero-desc">반복되는 입력·결재·집계 업무를 PMIS 하나로 통합하세요.</p>
            <div className="main-hero-cta">
              <Link to="/signup?plan=trial" className="main-hero-btn main-hero-btn-primary">무료 체험하기</Link>
              <Link to="/pricing" className="main-hero-btn main-hero-btn-secondary">도입 상담하기</Link>
            </div>
          </div>
        </div>
      </section>

      {/* 프로모션 배너 (사방넷 스타일) */}
      <section className="main-promo-section">
        <div className="main-promo-inner">
          <span className="main-promo-icon">🎯</span>
          <div className="main-promo-text">
            <strong>건설사의 빠른 시작, PMIS</strong>
            <span>사용내역 입력부터 결재·집계까지 한곳에서. 지금 무료 체험으로 시작해보세요.</span>
          </div>
          <Link to="/signup?plan=trial" className="main-promo-cta">무료 체험</Link>
        </div>
      </section>

      {/* Feature 배지 섹션 (사방넷 2.0 스타일) */}
      <section className="main-feature-badge-section">
        <span className="main-feature-badge">{company.name}</span>
        <h2 className="main-feature-headline">{company.name}에서 사용내역 입력부터 결재까지, 모든 과정을 한 번에 관리하세요.</h2>
        <p className="main-feature-desc">반복되는 사용내역 입력, 결재 요청, 집계 작업까지 {company.name} 하나로 건설사의 재무·행정 업무를 연결하세요.</p>
      </section>

      {/* Footer */}
      <footer className="main-footer-landing">
        <div className="main-auth-links">
          <Link to="/login">로그인</Link>
          <span className="main-footer-divider">·</span>
          <Link to="/signup">회원가입</Link>
        </div>
        <p className="main-footer-copy">© {company.name}</p>
      </footer>

      {/* Floating CTA (사방넷 스타일) */}
      <Link to="/pricing" className="main-fab" title="도입 상담">
        <span className="main-fab-icon">↻</span>
        <span className="main-fab-text">도입상담</span>
      </Link>
    </div>
  );
}
