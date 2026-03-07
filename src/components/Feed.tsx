import { useApp } from '../context/AppContext';

const colorMap: Record<string, string> = {
  pass: 'var(--lime)',
  fail: 'var(--fail)',
  warn: 'var(--warn)',
  ghost: 'var(--text-ghost)',
};

export function Feed() {
  const { feed } = useApp();

  return (
    <>
      <div className="sec-hdr">
        <div className="sec-t">Activity</div>
        <div className="sec-c">{feed.length} EVENTS</div>
      </div>
      {feed.map((event, i) => (
        <div key={event.id} className="feed-item" style={{ animationDelay: `${i * 0.05}s` }}>
          <div className="fdot" style={{ background: colorMap[event.color] || event.color }} />
          <div className="fb">
            <div className="ft" dangerouslySetInnerHTML={{ __html: event.html }} />
            <div className="ftime">{event.time}</div>
          </div>
        </div>
      ))}
    </>
  );
}
