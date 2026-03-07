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
  dateFrom: string;
  dateTo: string;
  activeTab: string;
  toasts: Toast[];
  isOnline: boolean;
  failBadgeCount: number;
  loading: boolean;
}

interface AppActions {
  loadStats: () => Promise<void>;
  loadInspections: (filter?: string) => Promise<void>;
  loadInspectors: () => Promise<void>;
  selectInspection: (insp: Inspection) => void;
  loadChecklist: (inspectionId: string) => Promise<void>;
  loadFeed: () => Promise<void>;
  setFilter: (f: string) => void;
  setDateRange: (from: string, to: string) => void;
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
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeTab, setActiveTab] = useState('list');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [failBadgeCount, setFailBadgeCount] = useState(1);
  const [loading, setLoading] = useState(true);

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

  const loadInspections = useCallback(async (f?: string, from?: string, to?: string) => {
    try {
      const data = await api.getInspections(f ?? filter, from ?? (dateFrom || undefined), to ?? (dateTo || undefined));
      setInspections(data);
      if (!activeInspection && data.length > 0) {
        setActiveInspection(data[0]);
      }
    } catch { toast('Failed to load inspections', 't-fail', '!'); }
  }, [filter, dateFrom, dateTo, activeInspection, toast]);

  const loadInspectors = useCallback(async () => {
    try { setInspectors(await api.getInspectors()); } catch (e) { console.error('Failed to load inspectors', e); }
  }, []);

  const selectInspection = useCallback((insp: Inspection) => {
    setActiveInspection(insp);
  }, []);

  const loadChecklist = useCallback(async (inspectionId: string) => {
    try { setChecklist(await api.getChecklist(inspectionId)); } catch { toast('Failed to load checklist', 't-fail', '!'); }
  }, [toast]);

  const loadFeed = useCallback(async () => {
    try { setFeed(await api.getFeed()); } catch (e) { console.error('Failed to load feed', e); }
  }, []);

  const setDateRange = useCallback((from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
    loadInspections(filter, from || undefined, to || undefined);
  }, [filter, loadInspections]);

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
    Promise.all([loadStats(), loadInspections(), loadInspectors(), loadFeed()])
      .finally(() => setLoading(false));
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh feed every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadFeed();
        loadStats();
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [loadFeed, loadStats]);

  useEffect(() => {
    if (activeInspection) loadChecklist(activeInspection.id);
  }, [activeInspection]);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppContext.Provider value={{
      stats, inspections, inspectors, activeInspection, checklist, feed, filter, dateFrom, dateTo, activeTab, toasts, isOnline, failBadgeCount, loading,
      loadStats, loadInspections, loadInspectors, selectInspection, loadChecklist, loadFeed,
      setFilter, setDateRange, setActiveTab, toast, incrementFailBadge, refreshAll,
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
