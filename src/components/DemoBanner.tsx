import { useState } from 'react';

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="demo-banner">
      <span>You're exploring a live demo of <strong>INSPECTR</strong> — create inspections, log failures, and try all features freely.</span>
      <button className="demo-banner-close" onClick={() => setDismissed(true)} title="Dismiss">
        <svg width="12" height="12" viewBox="0 0 12 12"><line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.8"/><line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.8"/></svg>
      </button>
    </div>
  );
}
