import { useState } from 'react';
import MastersSuper from './MastersSuper';
import RolePermissionsSuper from './RolePermissionsSuper';
import AdminCompanySuper from './AdminCompanySuper';
import './Admin.css';

const TABS = [
  { id: 'masters', label: '마스터관리', component: MastersSuper },
  { id: 'roles', label: '역할관리', component: RolePermissionsSuper },
  { id: 'company', label: '회사관리', component: AdminCompanySuper },
];

export default function AdminSuper() {
  const [activeTab, setActiveTab] = useState('masters');

  const TabContent = TABS.find(t => t.id === activeTab)?.component || MastersSuper;

  return (
    <div className="admin-page admin-super">
      <div className="admin-tabs" style={{ marginBottom: '1rem', display: 'flex', gap: '0.25rem', borderBottom: '1px solid #eee' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className={`admin-tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="admin-tab-content" style={{ marginTop: '1rem' }}>
        <TabContent />
      </div>
    </div>
  );
}
