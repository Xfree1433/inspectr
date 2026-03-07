import type { Inspection } from '../types';

function scoreColor(score: number, status: string): string {
  if (status === 'pending') return 'var(--warn)';
  if (score >= 80) return 'var(--lime)';
  if (score >= 60) return 'var(--warn)';
  return 'var(--fail)';
}

interface Props {
  inspection: Inspection;
  selected: boolean;
  index: number;
  onClick: () => void;
}

export function InspectionCard({ inspection: r, selected, index, onClick }: Props) {
  const c = scoreColor(r.score, r.status);
  const bc = r.status === 'pass' ? 'bp' : r.status === 'fail' ? 'bf' : 'bn';

  return (
    <div
      className={`icard${selected ? ' sel' : ''}`}
      style={{ animationDelay: `${index * 0.04}s` }}
      onClick={onClick}
    >
      <div className="ic-top">
        <div>
          <div className="ic-id">{r.id}</div>
          <div className="ic-site">{r.site}</div>
          <div className="ic-type">{r.type}</div>
        </div>
        <div className="ic-meta">
          <div className="ic-who">
            <div className="av">{r.inspectorInitials}</div>
            {r.inspectorName}
          </div>
          <div className="ic-time">{r.time}</div>
        </div>
      </div>
      <div className="ic-bot">
        <div className="sw">
          <div className="st">
            <div className="sf" style={{ width: `${r.score}%`, background: c }} />
          </div>
          <div className="sn" style={{ color: c }}>{r.score}</div>
        </div>
        <span className={`badge ${bc}`}>{r.status.toUpperCase()}</span>
      </div>
    </div>
  );
}
