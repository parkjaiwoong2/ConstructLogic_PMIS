import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import './Main.css';

export default function Main() {
  const [company, setCompany] = useState({ name: 'Construct Logic', logo_url: null, address: '', ceo_name: '', founded_date: '', business_reg_no: '', tel: '', fax: '', email: '', copyright_text: '' });
  const { user, loading } = useAuth();

  useEffect(() => {
    api.getCompanies().then(c => setCompany(c || { name: 'Construct Logic', logo_url: null })).catch(() => {});
  }, []);

  if (loading) return <div className="main-page"><div className="main-loading">로딩 중...</div></div>;
  if (user) return null;

  return (
    <div className="main-page">
      <div className="main-bg" aria-hidden="true" />
      <div className="main-content">
      <header className="main-header">
        {company.logo_url && <img src={company.logo_url} alt="" className="main-logo" />}
        <h1 className="main-company-name">{company.name}</h1>
        <p className="main-tagline">건설 프로젝트 관리 정보 시스템</p>
      </header>
      <section className="main-hero">
        <p className="main-hero-text">건설사 전용 PMIS</p>
        <p className="main-hero-desc">카드·현금 사용내역 및 결재 업무를 한곳에서 관리합니다.</p>
      </section>
      <footer className="main-footer">
        <div className="main-auth-btns">
          <Link to="/login" className="main-btn-login">로그인</Link>
          <Link to="/signup" className="main-btn-signup">회원가입</Link>
        </div>
        {(company.address || company.ceo_name || company.business_reg_no || company.tel || company.email || company.copyright_text) && (
          <div className="main-company-info">
            {(company.address || company.ceo_name || company.founded_date) && (
              <p>{[company.address, company.ceo_name && `대표 ${company.ceo_name}`, company.founded_date && `설립일 ${company.founded_date}`].filter(Boolean).join(' / ')}</p>
            )}
            {(company.business_reg_no || company.tel || company.fax || company.email) && (
              <p>{[company.business_reg_no && `사업자등록번호 ${company.business_reg_no}`, company.tel && `Tel.${company.tel}`, company.fax && `Fax.${company.fax}`, company.email && `E-mail:${company.email}`].filter(Boolean).join(' / ')}</p>
            )}
            {company.copyright_text && <p className="main-copyright">{company.copyright_text}</p>}
          </div>
        )}
      </footer>
      </div>
    </div>
  );
}
