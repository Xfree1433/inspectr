import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { Inspection, Stats, Inspector, CheckGroup, FeedEvent } from '../types';
import { api } from '../api/client';

type ToastType = 't-pass' | 't-fail' | 't-info' | 't-warn';

interface Toast {
  id: number;
  msg: string;
  type: ToastType;
  icon: string;
  out: boolean;
}

interface AppState {
  stats: Stats | null;
  inspections: Inspection[];
  inspectors: Inspector[];
  activeInspection: Inspection | null;
  checklist: CheckGroup[];
  feed: FeedEvent[];
  filter: string;
  activeTab: string;
  toasts: Toast[];
  isOnline: boolean;
  failBadgeCount: number;
}

interface AppActions {
  loadStats: () => Promise<void>;
  loadInspections: (filter?: string) => Promise<void>;
  loadInspectors: () => Promise<void>;
  selectInspection: (insp: Inspection) => void;
  loadChecklist: (inspectionId: string) => Promise<void>;
  loadFeed: () => Promise<void>;
  setFilter: (f: string) => void;
  setActiveTab: (tab: string) => void;
  toast: (msg: string, type?: ToastType, icon?: string) => void;
  incrementFailBadge: () => void;
  refreshAll: () => Promise<void>;
}

const AppContext = createContext<(AppState & AppActions) | null>(null);

let toastCounter = 0;

export function AppProvider({ children }: { children: ReactNode }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [activeInspection, setActiveInspection] = useState<Inspection | null>(null);
  const [checklist, setChecklist] = useState<CheckGroup[]>([]);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [filter, setFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('list');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [failBadgeCount, setFailBadgeCount] = useState(1);

  const toast = useCallback((msg: string, type: ToastType = 't-info', icon: string = '•') => {
    const id = ++toastCounter;
    setToasts(prev => [...prev, { id, msg, type, icon, out: false }]);
    if (navigator.vibrate) {
      if (type === 't-fail') navigator.vibrate([60, 40, 60]);
      else if (type === 't-pass') navigator.vibrate(40);
      else navigator.vibrate(20);
    }
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, out: true } : t));
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
    }, 2800);
  }, []);

  const loadStats = useCallback(async () => {
    try { setStats(await api.getStats()); } catch { toast('Failed to load stats', 't-fail', '!'); }
  }, [toast]);

  const loadInspections = useCallback(async (f?: string) => {
    try {
      const data = await api.getInspections(f || filter);
      setInspections(data);
      if (!activeInspection && data.length > 0) {
        setActiveInspection(data[0]);
      }
    } catch { toast('Failed to load inspections', 't-fail', '!'); }
  }, [filter, activeInspection, toast]);

  const loadInspectors = useCallback(async () => {
    try { setInspectors(await api.getInspectors()); } catch { /* quiet */ }
  }, []);

  const selectInspection = useCallback((insp: Inspection) => {
    setActiveInspection(insp);
  }, []);

  const loadChecklist = useCallback(async (inspectionId: string) => {
    try { setChecklist(await api.getChecklist(inspectionId)); } catch { toast('Failed to load checklist', 't-fail', '!'); }
  }, [toast]);

  const loadFeed = useCallback(async () => {
    try { setFeed(await api.getFeed()); } catch { /* quiet */ }
  }, []);

  const incrementFailBadge = useCallback(() => setFailBadgeCount(c => c + 1), []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadStats(), loadInspections(), loadFeed()]);
  }, [loadStats, loadInspections, loadFeed]);

  useEffect(() => {
    const onOnline = () => { setIsOnline(true); toast('Back online', 't-pass', '✓'); };
    const onOffline = () => { setIsOnline(false); toast('No network connection', 't-warn', '⚡'); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, [toast]);

  useEffect(() => {
    loadStats();
    loadInspections();
    loadInspectors();
    loadFeed();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeInspection) loadChecklist(activeInspection.id);
  }, [activeInspection]);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppContext.Provider value={{
      stats, inspections, inspectors, activeInspection, checklist, feed, filter, activeTab, toasts, isOnline, failBadgeCount,
      loadStats, loadInspections, loadInspectors, selectInspection, loadChecklist, loadFeed,
      setFilter, setActiveTab, toast, incrementFailBadge, refreshAll,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
