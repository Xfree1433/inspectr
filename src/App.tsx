import { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import { Header } from './components/Header';
import { StatsBar } from './components/StatsBar';
import { InspectionList } from './components/InspectionList';
import { Checklist } from './components/Checklist';
import { Feed } from './components/Feed';
import { BottomNav } from './components/BottomNav';
import { ToastContainer } from './components/ToastContainer';
import { FailureModal } from './components/FailureModal';
import { NewInspectionModal } from './components/NewInspectionModal';
import { ReportModal } from './components/ReportModal';
import { SearchBar } from './components/SearchBar';
import './styles/global.css';
import './styles/layout.css';
import './styles/components.css';

function AppInner() {
  const { activeTab } = useApp();
  const [showNewModal, setShowNewModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [failModal, setFailModal] = useState<{ open: boolean; title: string; checkItemId: string }>({ open: false, title: '', checkItemId: '' });
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return (
    <>
      <ToastContainer />
      <Header onNewInspection={() => setShowNewModal(true)} />
      <SearchBar />
      <StatsBar />

      <div className="app">
        {isDesktop ? (
          <>
            <div className="panel active panel-list" style={{ display: 'flex', flexDirection: 'column', position: 'relative', inset: 'auto', overflow: 'hidden', borderRight: '1px solid var(--border)' }}>
              <InspectionList />
            </div>
            <div className="dright" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="cl-col" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderBottom: '1px solid var(--border)' }}>
                <Checklist onOpenFailModal={(title, id) => setFailModal({ open: true, title, checkItemId: id })} onOpenReport={() => setShowReportModal(true)} />
              </div>
              <div className="feed-col" style={{ height: 210, overflowY: 'auto', flexShrink: 0 }}>
                <Feed />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className={`panel${activeTab === 'list' ? ' active' : ''}`}>
              <InspectionList />
            </div>
            <div className={`panel${activeTab === 'check' ? ' active' : ''}`}>
              <Checklist onOpenFailModal={(title, id) => setFailModal({ open: true, title, checkItemId: id })} />
            </div>
            <div className={`panel${activeTab === 'feed' ? ' active' : ''}`}>
              <Feed />
            </div>
          </>
        )}
      </div>

      {!isDesktop && (
        <BottomNav onOpenReport={() => setShowReportModal(true)} />
      )}

      <FailureModal
        open={failModal.open}
        title={failModal.title}
        checkItemId={failModal.checkItemId}
        onClose={() => setFailModal({ open: false, title: '', checkItemId: '' })}
      />
      <NewInspectionModal open={showNewModal} onClose={() => setShowNewModal(false)} />
      <ReportModal open={showReportModal} onClose={() => setShowReportModal(false)} />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <AppInner />
      </AppProvider>
    </ThemeProvider>
  );
}
