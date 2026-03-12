import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import './Main.css';

export default function Main() {
  const [company, setCompany] = useState({ name: 'Construct Logic', logo_url: null });
  const { user, loading } = useAuth();

  useEffect(() => {
    api.getCompanies().then(c => setCompany(c || { name: 'Construct Logic', logo_url: null })).catch(() => {});
  }, []);

  if (loading) return <div className="main-page"><div className="main-loading">로딩 중...</div></div>;
  if (user) return null;

  return (
    <div className="main-page main-sabangnet">
      {/* Top Bar */}
      <div className="main-topbar">
        <div className="main-topbar-inner">
          <Link to="/" className="main-topbar-link active" title="메인으로">Construct Logic</Link>
          <span className="main-topbar-divider">|</span>
          <span className="main-topbar-link disabled">PMIS</span>
        </div>
      </div>

      {/* Main Nav */}
      <header className="main-nav">
        <div className="main-nav-inner">
          <Link to="/" className="main-nav-logo">
            {company.logo_url && <img src={company.logo_url} alt="" />}
            <span className="main-nav-brand">{company.name}</span>
          </Link>
          <nav className="main-nav-links">
            <Link to="/#service" className="main-nav-link">서비스소개</Link>
            <Link to="/pricing" className="main-nav-link">요금안내</Link>
            <Link to="/#support" className="main-nav-link">지원</Link>
          </nav>
          <div className="main-nav-actions">
            <Link to="/login" className="main-nav-btn-text">로그인</Link>
            <Link to="/signup" className="main-nav-btn-primary">무료체험 신청</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="main-hero-section" id="hero">
        <div className="main-hero-bg" aria-hidden="true" />
        <div className="main-hero-inner">
          <p className="main-hero-intro">하나로 연결되는 건설 PMIS 혁신</p>
          <h1 className="main-hero-title">No.1 건설사 전용 PMIS로</h1>
          <p className="main-hero-desc">카드·현금 사용내역부터 결재까지 한곳에서 관리하세요.</p>
          <div className="main-hero-cta">
            <Link to="/signup?plan=trial" className="main-hero-btn main-hero-btn-primary">무료 체험하기</Link>
            <Link to="/pricing" className="main-hero-btn main-hero-btn-secondary">도입 상담하기</Link>
          </div>
        </div>
      </section>

      {/* Service Introduction */}
      <section className="main-service-section" id="service">
        <h2 className="main-service-headline">건설사마다 반복되는 업무, Construct Logic 하나로 끝내세요.</h2>
        <p className="main-service-subhead">사용내역 입력부터 결재·집계까지, 건설사의 시간을 잡아먹는 반복 업무를 한곳에서 통합 관리하세요.</p>
        <div className="main-service-cards">
          <div className="main-service-card">
            <div className="main-service-card-icon">📝</div>
            <h3 className="main-service-card-title">사용내역 입력</h3>
            <p className="main-service-card-desc">카드·현금 사용내역을 한 곳에서 간편하게 입력하고 관리합니다.</p>
          </div>
          <div className="main-service-card">
            <div className="main-service-card-icon">✓</div>
            <h3 className="main-service-card-title">결재 흐름</h3>
            <p className="main-service-card-desc">검토·승인 단계별 결재로 투명하고 체계적인 업무 처리를 지원합니다.</p>
          </div>
          <div className="main-service-card">
            <div className="main-service-card-icon">📊</div>
            <h3 className="main-service-card-title">CSV 임포트</h3>
            <p className="main-service-card-desc">엑셀·CSV로 대량 데이터를 일괄 등록해 입력 시간을 단축합니다.</p>
          </div>
          <div className="main-service-card">
            <div className="main-service-card-icon">💳</div>
            <h3 className="main-service-card-title">법인카드 관리</h3>
            <p className="main-service-card-desc">회사별 법인카드 등록 및 사용자 연결로 현장별 사용을 명확히 관리합니다.</p>
          </div>
          <div className="main-service-card">
            <div className="main-service-card-icon">📈</div>
            <h3 className="main-service-card-title">대시보드</h3>
            <p className="main-service-card-desc">현장별·항목별 집계로 사용 현황을 한눈에 파악하고 의사결정을 지원합니다.</p>
          </div>
          <Link to="/pricing" className="main-service-card main-service-card-cta">
            <div className="main-service-card-icon">🔄</div>
            <h3 className="main-service-card-title">도입 상담</h3>
            <p className="main-service-card-desc">요금제 선택 및 맞춤 상담</p>
          </Link>
        </div>
      </section>

      {/* Footer / Support */}
      <footer className="main-footer-landing" id="support">
        <div className="main-auth-links">
          <Link to="/login">로그인</Link>
          <span className="main-footer-divider">·</span>
          <Link to="/signup">회원가입</Link>
        </div>
        <p className="main-footer-copy">© {company.name}</p>
      </footer>

      {/* Floating CTA */}
      <Link to="/pricing" className="main-fab" title="도입 상담">
        <span className="main-fab-icon">💬</span>
        <span className="main-fab-text">도입상담</span>
      </Link>
    </div>
  );
}
