import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import './Pricing.css';

function formatPrice(n) {
  if (n == null) return '';
  if (Number(n) === 0) return '무료';
  return new Intl.NumberFormat('ko-KR').format(Number(n)) + '원';
}

export default function Pricing() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [planType, setPlanType] = useState('all');
  const [duration, setDuration] = useState(1);
  const { user } = useAuth();

  useEffect(() => {
    api.getSubscriptionPlans()
      .then(setPlans)
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredPlans = (plans || []).filter(p => {
    if (planType === 'basic' && p.plan_type === 'unlimited') return false;
    if (planType === 'unlimited' && p.plan_type !== 'unlimited') return false;
    return true;
  });

  const isStandalone = !user;

  return (
    <div className={`pricing-page ${isStandalone ? 'pricing-standalone' : ''}`}>
      {isStandalone && (
        <header className="pricing-header">
          <div className="pricing-header-inner">
            <Link to="/" className="pricing-logo" title="메인으로">PMIS</Link>
            <nav className="pricing-nav">
              <Link to="/service">서비스소개</Link>
              <Link to="/pricing" className="active">요금안내</Link>
              <Link to="/support">지원</Link>
            </nav>
            <div className="pricing-header-actions">
              <Link to="/login" className="pricing-header-link">로그인</Link>
              <Link to="/signup" className="pricing-header-btn">무료체험 신청</Link>
            </div>
          </div>
        </header>
      )}

      <div className="pricing-content">
        <div className="pricing-hero">
          <h1 className="pricing-title">요금안내</h1>
          <p className="pricing-subtitle">사용내역부터 결재까지 PMIS 하나로 관리하세요.</p>
        </div>

        {/* Filters */}
        <div className="pricing-filters">
          <div className="pricing-filter-group">
            <span className="pricing-filter-label">구분</span>
            <div className="pricing-filter-btns">
              <button type="button" className={planType === 'all' ? 'active' : ''} onClick={() => setPlanType('all')}>전체</button>
              <button type="button" className={planType === 'basic' ? 'active' : ''} onClick={() => setPlanType('basic')}>기본</button>
              <button type="button" className={planType === 'unlimited' ? 'active' : ''} onClick={() => setPlanType('unlimited')}>무제한</button>
            </div>
          </div>
          <div className="pricing-filter-group">
            <span className="pricing-filter-label">기간</span>
            <div className="pricing-filter-btns">
              {[1, 3, 6, 12, 24].map((m) => (
                <button key={m} type="button" className={duration === m ? 'active' : ''} onClick={() => setDuration(m)}>{m}개월</button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="pricing-loading">로딩 중...</div>
        ) : (
          <div className="pricing-grid-capture">
            {filteredPlans.map((plan) => (
              <div key={plan.id} className={`pricing-card-capture ${plan.is_recommended ? 'recommended' : ''}`}>
                {plan.is_recommended && <span className="pricing-card-badge">추천</span>}
                <h3 className="pricing-card-name">{plan.name}</h3>
                <div className="pricing-card-prices">
                  <div className="pricing-card-monthly">
                    <span className="pricing-card-amount">{formatPrice(plan.price_monthly)}</span>
                    {!plan.is_trial && plan.price_monthly > 0 && <span className="pricing-card-period">/월</span>}
                    {plan.is_trial && plan.trial_days && <span className="pricing-card-period">{plan.trial_days}일 체험</span>}
                  </div>
                  <div className="pricing-card-setup">
                    <span className="pricing-card-setup-label">가입비</span>
                    <span className="pricing-card-setup-amount">{formatPrice(plan.setup_fee) || '무료'}</span>
                  </div>
                </div>
                <div className="pricing-card-features">
                  <div className="pricing-card-feature-section">
                    <div className="pricing-card-feature-icon">👤</div>
                    <span className="pricing-card-feature-title">사용자관리</span>
                  </div>
                  <ul className="pricing-card-feature-list">
                    <li>최대 {plan.max_users || '무제한'}명</li>
                  </ul>
                  <div className="pricing-card-feature-section">
                    <div className="pricing-card-feature-icon">📄</div>
                    <span className="pricing-card-feature-title">문서관리</span>
                  </div>
                  <ul className="pricing-card-feature-list">
                    {(Array.isArray(plan.features_json) ? plan.features_json : []).slice(0, 3).map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                    {(!plan.features_json || plan.features_json.length === 0) && <li>전체 기능 제공</li>}
                  </ul>
                </div>
                <Link
                  to={plan.is_trial ? '/signup?plan=trial' : `/signup?plan=${plan.id}`}
                  className={`pricing-card-cta ${plan.is_recommended ? 'primary' : ''}`}
                >
                  {plan.is_trial ? '무료 체험하기' : '신청하기'}
                </Link>
              </div>
            ))}
          </div>
        )}

        <div className="pricing-footer">
          <p>문의사항이 있으시면 연락 주세요.</p>
          {isStandalone && <Link to="/" className="pricing-back">← 메인으로</Link>}
        </div>
      </div>

      <Link to="/pricing" className="pricing-fab" title="도입 상담">
        <span className="pricing-fab-icon">🔄</span>
        <span className="pricing-fab-text">도입상담</span>
      </Link>
    </div>
  );
}
