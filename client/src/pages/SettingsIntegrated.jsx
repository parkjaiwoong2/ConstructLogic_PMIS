import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Settings from './Settings';
import './SettingsIntegrated.css';

const TABS = [
  { id: 'my', label: '내 설정' },
];

export default function SettingsIntegrated() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') || 'my';
  const [activeTab, setActiveTab] = useState(tabParam);
  useEffect(() => {
    const tab = searchParams.get('tab') || 'my';
    const tabDef = TABS.find(t => t.id === tab);
    setActiveTab(tabDef ? tab : 'my');
  }, [searchParams]);

  const visibleTabs = TABS;

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
      </div>
    </div>
  );
}
