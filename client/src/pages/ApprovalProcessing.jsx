import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import DocumentList from './DocumentList';
import ApprovalList from './ApprovalList';
import './ApprovalProcessing.css';

const TABS = [
  { id: 'documents', label: '결재문서', component: DocumentList },
  { id: 'approval', label: '결재함', component: ApprovalList },
];

export default function ApprovalProcessing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(() => (TABS.some(t => t.id === tabParam) ? tabParam : 'documents'));

  useEffect(() => {
    if (TABS.some(t => t.id === tabParam) && activeTab !== tabParam) setActiveTab(tabParam);
  }, [tabParam]);

  const handleTabChange = (id) => {
    setActiveTab(id);
    setSearchParams(id === 'approval' ? { tab: 'approval' } : {}, { replace: true });
  };

  const TabContent = TABS.find(t => t.id === activeTab)?.component || DocumentList;

  return (
    <div className="approval-processing">
      <div className="approval-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className={`approval-tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => handleTabChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="approval-tab-content">
        <TabContent />
      </div>
    </div>
  );
}
