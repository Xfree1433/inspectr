export function SkeletonCard() {
  return (
    <div className="skel-card">
      <div className="skel-line skel-w60" />
      <div className="skel-line skel-w80" />
      <div className="skel-line skel-w40" />
      <div className="skel-bar" />
    </div>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </>
  );
}

export function SkeletonFeed({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skel-feed">
          <div className="skel-dot" />
          <div style={{ flex: 1 }}>
            <div className="skel-line skel-w80" />
            <div className="skel-line skel-w40" style={{ height: 10 }} />
          </div>
        </div>
      ))}
    </>
  );
}
