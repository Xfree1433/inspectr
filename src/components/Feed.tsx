import { useApp } from '../context/AppContext';
import { SkeletonFeed } from './Skeleton';

const colorMap: Record<string, string> = {
  pass: 'var(--lime)',
  fail: 'var(--fail)',
  warn: 'var(--warn)',
  ghost: 'var(--text-ghost)',
};

const tagClass: Record<string, string> = {
  pass: 'tag-p',
  fail: 'tag-f',
  warn: 'tag-n',
};

export function Feed() {
  const { feed, loading } = useApp();

  return (
    <>
      <div className="sec-hdr">
        <div className="sec-t">Activity</div>
        <div className="sec-c">{feed.length} EVENTS</div>
      </div>
      <div className="section-hint">
        Live feed of all inspection activity — completions, failures, and status changes across your team.
      </div>
      {loading ? (
        <SkeletonFeed count={6} />
      ) : feed.length === 0 ? (
        <div className="empty-state">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>
          </svg>
          <div className="empty-state-title">No Activity Yet</div>
          <div className="empty-state-text">
            Events will appear here as inspections are started, items are checked, and reports are submitted.
          </div>
        </div>
      ) : (
        feed.map((event, i) => (
          <div key={event.id} className="feed-item" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="fdot" style={{ background: colorMap[event.color] || event.color }} />
            <div className="fb">
              <div className="ft">
                {event.inspectionId && <strong>{event.inspectionId}</strong>}
                {event.inspectionId && ' — '}
                {event.message}
                {event.tag && (
                  <>
                    {' · '}
                    <span className={tagClass[event.color] || ''}>{event.tag}</span>
                  </>
                )}
              </div>
              <div className="ftime">{event.time}</div>
            </div>
          </div>
        ))
      )}
    </>
  );
}
