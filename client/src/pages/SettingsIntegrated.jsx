import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Settings from './Settings';
import AdminApprovalSequence from './admin/AdminApprovalSequence';
import { useAuth } from '../contexts/AuthContext';
import './SettingsIntegrated.css';

const TABS = [
  { id: 'my', label: '내 설정' },
  { id: 'approval-sequence', label: '결재순서', adminOnly: true },
];

export default function SettingsIntegrated() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') || 'my';
  const [activeTab, setActiveTab] = useState(tabParam);
  const { user } = useAuth();
  const hasAdminAccess = user?.is_admin || user?.role === 'admin';

  useEffect(() => {
    const tab = searchParams.get('tab') || 'my';
    const tabDef = TABS.find(t => t.id === tab);
    const canShow = tabDef && (!tabDef.adminOnly || hasAdminAccess);
    setActiveTab(canShow ? tab : 'my');
  }, [searchParams, hasAdminAccess]);

  const visibleTabs = TABS.filter(t => !t.adminOnly || hasAdminAccess);

  const handleTabChange = (id) => {
    setActiveTab(id);
    setSearchParams(id === 'my' ? {} : { tab: id }, { replace: true });
  };

  return (
    <div className="settings-integrated">
      <div className="settings-tabs">
        {visibleTabs.map(t => (
          <button
            key={t.id}
            type="button"
            className={`settings-tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => handleTabChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="settings-tab-content">
        {activeTab === 'my' && <Settings />}
        {activeTab === 'approval-sequence' && hasAdminAccess && <AdminApprovalSequence />}
      </div>
    </div>
  );
}
