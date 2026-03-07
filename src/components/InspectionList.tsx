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
      <div className="fbar">
        {['all', 'pass', 'fail', 'pending'].map(f => (
          <button key={f} className={`fpill${filter === f ? ' active' : ''}`} onClick={() => handleFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      <div className="list-scroll">
        {inspections.map((insp, i) => (
          <InspectionCard
            key={insp.id}
            inspection={insp}
            selected={activeInspection?.id === insp.id}
            index={i}
            onClick={() => selectInspection(insp)}
          />
        ))}
      </div>
    </>
  );
}
