import { useApp } from '../context/AppContext';
import { InspectionCard } from './InspectionCard';

export function InspectionList() {
  const { inspections, activeInspection, filter, setFilter, selectInspection, loadInspections } = useApp();

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
      <div className="list-scroll">
        {inspections.length === 0 ? (
          <div className="empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            <div className="empty-state-title">No Inspections Found</div>
            <div className="empty-state-text">
              {filter !== 'all'
                ? `No ${filter} inspections. Try a different filter or create a new inspection.`
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
