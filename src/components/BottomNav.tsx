import { useApp } from '../context/AppContext';

export function BottomNav({ onOpenReport }: { onOpenReport: () => void }) {
  const { activeTab, setActiveTab, failBadgeCount } = useApp();

  const tabs = [
    { id: 'list', label: 'List', title: 'Browse all field inspections', icon: <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></> },
    { id: 'check', label: 'Active', title: 'View checklist for the selected inspection', icon: <><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></>, badge: failBadgeCount },
    { id: 'feed', label: 'Feed', title: 'Real-time activity log across all inspections', icon: <><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></> },
  ];

  return (
    <nav className="bnav">
      {tabs.map(tab => (
        <button key={tab.id} className={`nb${activeTab === tab.id ? ' active' : ''}`} onClick={() => setActiveTab(tab.id)} title={tab.title}>
          {tab.badge !== undefined && <div className="nbadge">{tab.badge}</div>}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">{tab.icon}</svg>
          {tab.label}
        </button>
      ))}
      <button className={`nb${activeTab === 'report' ? ' active' : ''}`} onClick={() => { setActiveTab('report'); onOpenReport(); }} title="View and export the inspection report">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
        </svg>
        Report
      </button>
    </nav>
  );
}
