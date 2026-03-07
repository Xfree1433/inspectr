import { useApp } from '../context/AppContext';

export function StatsBar() {
  const { stats } = useApp();
  if (!stats) return <div className="stats" />;

  return (
    <div className="stats">
      <div className="sc pass" title="Total inspections that passed all checklist items">
        <div className="sl">Passed</div>
        <div className="sv">{stats.passed}</div>
        <div className="sd up">↑ {stats.passedToday} today</div>
      </div>
      <div className="sc fail" title="Inspections with one or more failed checklist items">
        <div className="sl">Failures</div>
        <div className="sv">{stats.failures}</div>
        <div className="sd dn">↑ {stats.failuresToday} today</div>
      </div>
      <div className="sc pend" title="Inspections currently in progress or awaiting review">
        <div className="sl">Pending</div>
        <div className="sv">{stats.pending}</div>
        <div className="sd">Active now</div>
      </div>
      <div className="sc rate" title="Overall pass rate across all completed inspections">
        <div className="sl">Rate</div>
        <div className="sv">{stats.rate}%</div>
        <div className="sd up">↑ 2.1% wk</div>
      </div>
    </div>
  );
}
