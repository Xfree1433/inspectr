import type { ReactNode } from 'react';
import '../styles/pf9-auth.css';

// PF9 brand (2026-11): the espresso panel shown beside INSPECTR's signed-out
// screens on desktop (hidden on phones). Wording comes from INSPECTR's store
// listing. Styling only — the forms passed in as children are unchanged.
export function Pf9AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="pf9-auth">
      <aside className="pf9-brand" aria-hidden="true">
        <div className="pf9-mark">
          <span className="pf9-tile">🔍</span>
          <span className="pf9-name">INSPECTR</span>
        </div>
        <div>
          <h2>Mobile-first<br /><span>field inspections</span></h2>
          <p className="pf9-lede">Customizable checklists, photo capture, GPS tagging, and instant PDF report generation.</p>
          <ul className="pf9-features">
            <li>Customizable checklists</li>
            <li>Photo capture</li>
            <li>GPS tagging</li>
            <li>Instant PDF reports</li>
            <li>Works from a phone</li>
            <li>Real-time failure logging</li>
          </ul>
        </div>
        <p className="pf9-foot">Plainspoken Foundry Nine</p>
      </aside>
      <div className="pf9-form-side">{children}</div>
    </div>
  );
}
