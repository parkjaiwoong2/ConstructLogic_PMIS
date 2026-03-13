import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import './Main.css';

export default function ServiceIntro() {
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
    <div className="main-page main-service-intro">
      {/* Nav - 메인과 동일 */}
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

      {/* Service Introduction (카드 + 상세 사용법) */}
      <section className="main-service-section" id="service">
        <h2 className="main-service-headline">건설사마다 반복되는 업무, PMIS 하나로 끝내세요.</h2>
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

        {/* 상세 사용법 (사방넷 스타일) */}
        <div className="main-howto-inner">
          {/* 1. 사용내역 입력 */}
          <div className="main-howto-block">
            <div className="main-howto-visual">
              <div className="main-howto-mockup main-howto-mockup-form">
                <div className="main-howto-mockup-bar" />
                <div className="main-howto-mockup-body">
                  <div className="main-howto-mockup-field"><span className="main-howto-mockup-label">날짜</span><span className="main-howto-mockup-input animate-typing" /></div>
                  <div className="main-howto-mockup-field"><span className="main-howto-mockup-label">항목</span><span className="main-howto-mockup-input animate-slide" /></div>
                  <div className="main-howto-mockup-field"><span className="main-howto-mockup-label">금액</span><span className="main-howto-mockup-input animate-pulse" /></div>
                  <div className="main-howto-mockup-btn animate-fade">저장</div>
                </div>
              </div>
            </div>
            <div className="main-howto-content">
              <span className="main-howto-label">사용내역 입력</span>
              <ul className="main-howto-list">
                <li><span className="main-howto-check" /> <strong>카드·현금 사용내역 한곳에서 입력</strong><br />현장별, 사용자별로 사용내역을 빠르고 편리하게 등록할 수 있습니다.</li>
                <li><span className="main-howto-check" /> <strong>일괄 수정 및 검색</strong><br />날짜·항목·금액 등 조건으로 검색하고 필요 시 일괄 수정할 수 있습니다.</li>
              </ul>
            </div>
          </div>

          {/* 2. 결재 흐름 */}
          <div className="main-howto-block main-howto-block-alt">
            <div className="main-howto-visual">
              <div className="main-howto-mockup main-howto-mockup-flow">
                <div className="main-howto-mockup-bar" />
                <div className="main-howto-mockup-body">
                  <div className="main-howto-flow-step animate-flow">작성</div>
                  <span className="main-howto-flow-arrow">→</span>
                  <div className="main-howto-flow-step animate-flow">검토</div>
                  <span className="main-howto-flow-arrow">→</span>
                  <div className="main-howto-flow-step animate-flow">승인</div>
                  <span className="main-howto-flow-arrow">→</span>
                  <div className="main-howto-flow-step animate-flow">완료</div>
                </div>
              </div>
            </div>
            <div className="main-howto-content">
              <span className="main-howto-label">결재 흐름</span>
              <ul className="main-howto-list">
                <li><span className="main-howto-check" /> <strong>단계별 결재 프로세스</strong><br />검토 → 승인 단계로 투명하고 체계적인 업무 처리를 지원합니다.</li>
                <li><span className="main-howto-check" /> <strong>실시간 상태 확인</strong><br />문서별 결재 진행 상황을 한눈에 확인할 수 있습니다.</li>
              </ul>
            </div>
          </div>

          {/* 3. CSV 임포트 */}
          <div className="main-howto-block">
            <div className="main-howto-visual">
              <div className="main-howto-mockup main-howto-mockup-table">
                <div className="main-howto-mockup-bar" />
                <div className="main-howto-mockup-body">
                  <div className="main-howto-table-row animate-row">날짜 | 항목 | 금액</div>
                  <div className="main-howto-table-row animate-row">2024.01.15 | 소모품 | 50,000</div>
                  <div className="main-howto-table-row animate-row">2024.01.16 | 복리후생 | 120,000</div>
                  <div className="main-howto-mockup-btn animate-fade">임포트</div>
                </div>
              </div>
            </div>
            <div className="main-howto-content">
              <span className="main-howto-label">CSV 임포트</span>
              <ul className="main-howto-list">
                <li><span className="main-howto-check" /> <strong>엑셀·CSV 대량 등록</strong><br />다량의 사용내역을 엑셀·CSV로 한 번에 일괄 등록해 입력 시간을 단축합니다.</li>
                <li><span className="main-howto-check" /> <strong>템플릿 다운로드</strong><br />정해진 형식의 템플릿을 다운로드해 데이터를 준비할 수 있습니다.</li>
              </ul>
            </div>
          </div>

          {/* 4. 법인카드·대시보드 */}
          <div className="main-howto-block main-howto-block-alt">
            <div className="main-howto-visual">
              <div className="main-howto-mockup main-howto-mockup-dash">
                <div className="main-howto-mockup-bar" />
                <div className="main-howto-mockup-body">
                  <div className="main-howto-dash-card animate-dash" />
                  <div className="main-howto-dash-card animate-dash" />
                  <div className="main-howto-dash-card animate-dash" />
                </div>
              </div>
            </div>
            <div className="main-howto-content">
              <span className="main-howto-label">법인카드·대시보드</span>
              <ul className="main-howto-list">
                <li><span className="main-howto-check" /> <strong>법인카드 관리</strong><br />회사별 법인카드 등록 및 사용자 연결로 현장별 사용을 명확히 관리합니다.</li>
                <li><span className="main-howto-check" /> <strong>현황 대시보드</strong><br />현장별·항목별 집계로 사용 현황을 한눈에 파악하고 의사결정을 지원합니다.</li>
              </ul>
            </div>
          </div>
        </div>
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

      <Link to="/pricing" className="main-fab" title="도입 상담">
        <span className="main-fab-icon">↻</span>
        <span className="main-fab-text">도입상담</span>
      </Link>
    </div>
  );
}
