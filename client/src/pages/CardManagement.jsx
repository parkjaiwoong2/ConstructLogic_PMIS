import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminCorporateCards from './admin/AdminCorporateCards';
import CardSettlement from './CardSettlement';
import { useAuth } from '../contexts/AuthContext';
import './CardManagement.css';

const TABS = [
  { id: 'settlement', label: '카드정산' },
  { id: 'corporate', label: '법인카드', adminOnly: true },
];

export default function CardManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') || 'settlement';
  const [activeTab, setActiveTab] = useState(tabParam);
  const { user } = useAuth();
  const hasAdminAccess = user?.role === 'admin' || user?.role === 'superAdmin' || user?.is_admin;

  useEffect(() => {
    const tab = searchParams.get('tab') || 'settlement';
    const tabDef = TABS.find(t => t.id === tab);
    const canShow = tabDef && (!tabDef.adminOnly || hasAdminAccess);
    setActiveTab(canShow ? tab : 'settlement');
  }, [searchParams, hasAdminAccess]);

  const visibleTabs = TABS.filter(t => !t.adminOnly || hasAdminAccess);

  const handleTabChange = (id) => {
    setActiveTab(id);
    setSearchParams(id === 'settlement' ? {} : { tab: id }, { replace: true });
  };

  return (
    <div className="card-management">
      <div className="card-management-tabs">
        {visibleTabs.map(t => (
          <button
            key={t.id}
            type="button"
            className={`card-management-tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => handleTabChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="card-management-tab-content">
        {activeTab === 'settlement' && <CardSettlement />}
        {activeTab === 'corporate' && hasAdminAccess && <AdminCorporateCards />}
      </div>
    </div>
  );
}
