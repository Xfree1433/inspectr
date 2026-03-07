import { useApp } from '../context/AppContext';
import { InspectionCard } from './InspectionCard';
import { SkeletonList } from './Skeleton';

export function InspectionList() {
  const { inspections, activeInspection, filter, dateFrom, dateTo, loading, setFilter, setDateRange, selectInspection, loadInspections } = useApp();

  const handleFilter = (f: string) => {
    setFilter(f);
    loadInspections(f);
  };

  return (
    <>
      <div className="sec-hdr">
        <div className="sec-t">Inspections</div>
        <div className="sec-c">{inspections.length} RECORDS</div>
      </div>
      <div className="section-hint">
        All field inspections. Select one to view its checklist and progress. Use filters to narrow by status.
      </div>
      <div className="fbar">
        {['all', 'pass', 'fail', 'pending'].map(f => (
          <button key={f} className={`fpill${filter === f ? ' active' : ''}`} onClick={() => handleFilter(f)} title={
            f === 'all' ? 'Show all inspections' :
            f === 'pass' ? 'Show only passed inspections' :
            f === 'fail' ? 'Show only failed inspections' :
            'Show inspections still in progress'
          }>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      <div className="date-filter">
        <input
          type="date"
          className="date-input"
          value={dateFrom}
          onChange={e => setDateRange(e.target.value, dateTo)}
          title="Filter from date"
        />
        <span className="date-sep">to</span>
        <input
          type="date"
          className="date-input"
          value={dateTo}
          onChange={e => setDateRange(dateFrom, e.target.value)}
          title="Filter to date"
        />
        {(dateFrom || dateTo) && (
          <button className="date-clear" onClick={() => setDateRange('', '')} title="Clear date filter">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="2" y1="2" x2="12" y2="12" /><line x1="12" y1="2" x2="2" y2="12" />
            </svg>
          </button>
        )}
      </div>
      <div className="list-scroll">
        {loading ? (
          <SkeletonList count={5} />
        ) : inspections.length === 0 ? (
          <div className="empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            <div className="empty-state-title">No Inspections Found</div>
            <div className="empty-state-text">
              {filter !== 'all' || dateFrom || dateTo
                ? 'No matching inspections. Try adjusting your filters or date range.'
                : 'No inspections yet. Tap + NEW in the header to create your first field inspection.'}
            </div>
          </div>
        ) : (
          inspections.map((insp, i) => (
            <InspectionCard
              key={insp.id}
              inspection={insp}
              selected={activeInspection?.id === insp.id}
              index={i}
              onClick={() => selectInspection(insp)}
            />
          ))
        )}
      </div>
    </>
  );
}
