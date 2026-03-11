import { useState } from 'react';
import AdminUsers from './AdminUsers';
import AdminRolePermissions from './AdminRolePermissions';
import './Admin.css';

const TABS = [
  { id: 'users', label: '사용자권한', component: AdminUsers },
  { id: 'roles', label: '역할권한', component: AdminRolePermissions },
];

export default function AdminPermissions() {
  const [activeTab, setActiveTab] = useState('users');

  const TabContent = TABS.find(t => t.id === activeTab)?.component || AdminUsers;

  return (
    <div className="admin-page admin-permissions">
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
