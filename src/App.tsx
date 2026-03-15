import { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProfileProvider } from './context/ProfileContext';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import { ProfileModal } from './components/ProfileModal';
import { SettingsModal } from './components/SettingsModal';
import { HelpModal } from './components/HelpModal';
import { DemoBanner } from './components/DemoBanner';
import { SearchBar } from './components/SearchBar';
import { LoginPage } from './components/LoginPage';
import './styles/global.css';
import './styles/layout.css';
import './styles/components.css';

function AppInner() {
  const { activeTab } = useApp();
  const [showNewModal, setShowNewModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
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
      {import.meta.env.VITE_DEMO && <DemoBanner />}
      <Header onNewInspection={() => setShowNewModal(true)} onOpenProfile={() => setShowProfileModal(true)} onOpenSettings={() => setShowSettingsModal(true)} onOpenHelp={() => setShowHelpModal(true)} />
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
      <ProfileModal open={showProfileModal} onClose={() => setShowProfileModal(false)} />
      <SettingsModal open={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
      <HelpModal open={showHelpModal} onClose={() => setShowHelpModal(false)} />
    </>
  );
}

function AuthGate() {
  const { user, loading, demoLogin } = useAuth();
  const [demoLoading, setDemoLoading] = useState(false);

  useEffect(() => {
    // Auto-login for /demo URL
    if (window.location.pathname === '/demo' && !user && !loading) {
      setDemoLoading(true);
      demoLogin().then(() => {
        window.history.replaceState({}, '', '/');
      }).catch(() => {
        setDemoLoading(false);
      });
    }
  }, [user, loading, demoLogin]);

  if (loading || demoLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#111', borderRadius: '50%', animation: 'spin 0.6s linear infinite', margin: '0 auto 1rem' }} />
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <ProfileProvider>
      <AppProvider>
        <AppInner />
      </AppProvider>
    </ProfileProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </ThemeProvider>
  );
}
