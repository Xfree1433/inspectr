import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import type { Inspection } from '../types';

export function SearchBar() {
  const { selectInspection, setActiveTab } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Inspection[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      api.searchInspections(query.trim())
        .then(r => { setResults(r); setOpen(true); })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (insp: Inspection) => {
    selectInspection(insp);
    setActiveTab('check');
    setQuery('');
    setOpen(false);
  };

  const statusClass = (s: string) =>
    s === 'pass' ? 'bp' : s === 'fail' ? 'bf' : 'bn';

  return (
    <div className="search-bar-wrap" ref={wrapRef}>
      <div className="search-bar">
        <svg className="search-bar-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          className="search-bar-input"
          placeholder="Search inspections by ID, site, type, or inspector..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
        />
        {query && (
          <button className="search-bar-clear" onClick={() => { setQuery(''); setOpen(false); }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="2" y1="2" x2="12" y2="12" /><line x1="12" y1="2" x2="2" y2="12" />
            </svg>
          </button>
        )}
        {loading && <div className="search-bar-spinner" />}
      </div>
      {open && (
        <div className="search-results">
          {results.length === 0 ? (
            <div className="search-empty">No inspections found for "{query}"</div>
          ) : (
            results.map(r => (
              <button key={r.id} className="search-result" onClick={() => handleSelect(r)}>
                <div className="search-result-top">
                  <span className="search-result-id">{r.id}</span>
                  <span className={`badge ${statusClass(r.status)}`}>{r.status.toUpperCase()}</span>
                </div>
                <div className="search-result-site">{r.site}</div>
                <div className="search-result-meta">
                  {r.type} · {r.inspectorName} · {r.time}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
