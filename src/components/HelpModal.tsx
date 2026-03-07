import { useState, useMemo } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface HelpSection {
  title: string;
  icon: string;
  content: string[];
}

const guide: HelpSection[] = [
  {
    title: 'Getting Started',
    icon: '🚀',
    content: [
      'INSPECTR is a field inspection management tool designed for tablets, phones, and PCs.',
      'Start by setting up your profile (tap the person icon in the top bar) so your name and company appear on reports.',
      'Then add your companies, sites, inspectors, and checklist templates via the Settings gear icon.',
      'Once configured, tap the "+ NEW" button to create your first inspection.',
    ],
  },
  {
    title: 'Creating an Inspection',
    icon: '📋',
    content: [
      'Tap the "+ NEW" button in the top bar to open the New Inspection form.',
      'Choose a checklist template — this determines which items the inspector will check.',
      'Search and select a site, or type a new site name directly.',
      'Optionally assign a client company to the inspection.',
      'Select the inspector who will perform the inspection.',
      'Set the date and time, add any pre-inspection notes, then tap "Create Inspection".',
    ],
  },
  {
    title: 'Checklist & Inspecting',
    icon: '✅',
    content: [
      'After creating an inspection, select it from the list to view its checklist.',
      'Each item can be marked as Pass (checkmark), Fail (X), or N/A (dash).',
      'When you fail an item, you can add a failure note describing the issue.',
      'Use the camera button on any checklist item to capture a photo as evidence.',
      'Photos are attached directly to the item and included in reports.',
      'You can undo a checked item by tapping the undo arrow on completed items.',
      'The inspection score updates automatically as items are checked.',
    ],
  },
  {
    title: 'Failures & Remediation',
    icon: '⚠️',
    content: [
      'When a checklist item fails, you can log a detailed failure record.',
      'Set the severity (Low, Medium, High) and provide a description.',
      'Assign the failure to an inspector for remediation and set a due date.',
      'Reference a standard or code if applicable.',
      'Track remediation status: Open → In Progress → Verified → Closed.',
      'The failure badge on the checklist shows the count of open failures.',
    ],
  },
  {
    title: 'Reports',
    icon: '📊',
    content: [
      'Tap the "Generate Report" button in the checklist view to preview the inspection report.',
      'Reports include the inspection summary, checklist scores by group, and individual item results.',
      'Failed items are highlighted with their notes and photos.',
      'Tap "Submit Report" to finalize the inspection and lock its status.',
      'Submitted inspections cannot be further modified.',
    ],
  },
  {
    title: 'Search',
    icon: '🔍',
    content: [
      'Use the search bar below the header to find inspections and documents.',
      'Search by inspection ID, site name, type, inspector name, email, phone, company, or address.',
      'Documents are also searchable by name, file type, company, or site.',
      'Results appear in a dropdown — tap an inspection to jump directly to its checklist.',
      'Minimum 2 characters to trigger a search.',
    ],
  },
  {
    title: 'Managing Companies',
    icon: '🏢',
    content: [
      'Open Settings (gear icon) and go to the Companies tab.',
      'Add companies with a name, contact person, and phone number.',
      'Companies can be linked to inspections, inspectors, and documents.',
      'Edit or delete companies from the same tab.',
    ],
  },
  {
    title: 'Managing Sites',
    icon: '📍',
    content: [
      'Open Settings and go to the Sites tab.',
      'Add a site with a name, contact person, phone, and physical address.',
      'Use the "Lookup" button to auto-fill coordinates from the address.',
      'Or enter latitude and longitude manually for remote locations.',
      'A map preview shows the site location when coordinates are set.',
      'Sites are linked to inspections during creation.',
    ],
  },
  {
    title: 'Managing Inspectors',
    icon: '👷',
    content: [
      'Open Settings and go to the Inspectors tab.',
      'Add inspectors with a name, initials (auto-generated if blank), email, phone, and company.',
      'Inspectors appear as selectable assignees when creating new inspections.',
      'An inspector\'s company, email, and phone are shown on reports.',
    ],
  },
  {
    title: 'Templates',
    icon: '📝',
    content: [
      'Templates define the checklist items that are generated for each inspection.',
      'Open Settings and go to the Templates tab to create or edit templates.',
      'Each template has a name, icon emoji, and one or more groups of check items.',
      'Groups organize items by category (e.g., "Structural", "Electrical", "Safety").',
      'You can add reference photos to template items — these appear on the checklist as guidance.',
      'Save the template first, then add photos to individual items.',
    ],
  },
  {
    title: 'Documents',
    icon: '📄',
    content: [
      'Upload SOPs, standards, reference guides, site plans, or any supporting documents.',
      'Open Settings and go to the Docs tab.',
      'Tap "+ Add Document" to upload a file (images, PDFs, Word, Excel, CSV, or text — up to 10 MB).',
      'Link documents to a company and/or site for easy organization.',
      'Download documents anytime from the Docs tab.',
      'Documents are searchable from the main search bar.',
    ],
  },
  {
    title: 'Activity Feed',
    icon: '📡',
    content: [
      'The activity feed shows recent events across all inspections.',
      'Events include new inspections, status changes, and failure updates.',
      'The feed auto-refreshes every 30 seconds when the tab is visible.',
      'On desktop, the feed appears below the checklist. On mobile, use the Feed tab.',
    ],
  },
  {
    title: 'Profile & Preferences',
    icon: '👤',
    content: [
      'Tap the person icon in the top bar to set your profile.',
      'Your name and company appear on the report header and footer.',
      'Your email is used for report correspondence.',
      'Toggle between light and dark mode using the sun/moon icon in the top bar.',
      'Light mode is optimized for outdoor readability with high contrast.',
    ],
  },
  {
    title: 'Offline & Connectivity',
    icon: '📶',
    content: [
      'INSPECTR shows a live connection status in the top bar.',
      'If you lose connectivity, an "OFFLINE" pill appears and the live badge dims.',
      'You\'ll get a toast notification when you go offline or come back online.',
      'The app works best with an active connection for real-time sync.',
    ],
  },
  {
    title: 'Tips for Field Use',
    icon: '💡',
    content: [
      'Use light mode outdoors — it\'s designed for sunlight readability.',
      'All buttons are sized for gloved or wet hands (minimum 44px touch targets).',
      'Use the camera button to capture evidence photos directly from the checklist.',
      'Swipe between List, Checklist, and Feed tabs on mobile using the bottom navigation.',
      'The search bar supports fuzzy matching across inspections and documents.',
      'Set up templates before going to the field so inspections are quick to create.',
    ],
  },
];

export function HelpModal({ open, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return guide;
    const q = search.toLowerCase();
    return guide.filter(
      s => s.title.toLowerCase().includes(q) || s.content.some(c => c.toLowerCase().includes(q))
    );
  }, [search]);

  const toggle = (idx: number) => {
    setExpandedIdx(expandedIdx === idx ? null : idx);
  };

  if (!open) return null;

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal help-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-title">User Guide</div>
          <button className="modal-close" onClick={onClose}>
            <svg width="12" height="12" viewBox="0 0 12 12"><line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.8"/><line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.8"/></svg>
          </button>
        </div>
        <div className="help-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search the guide..."
            value={search}
            onChange={e => { setSearch(e.target.value); setExpandedIdx(null); }}
            autoFocus
          />
          {search && (
            <button className="help-search-clear" onClick={() => setSearch('')}>
              <svg width="12" height="12" viewBox="0 0 12 12"><line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.8"/><line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.8"/></svg>
            </button>
          )}
        </div>
        <div className="help-body">
          {filtered.length === 0 ? (
            <div className="help-empty">No topics found for "{search}"</div>
          ) : (
            filtered.map((section, i) => {
              const isOpen = expandedIdx === i || !!search.trim();
              return (
                <div key={section.title} className={`help-section${isOpen ? ' open' : ''}`}>
                  <button className="help-section-hdr" onClick={() => toggle(i)}>
                    <span className="help-section-icon">{section.icon}</span>
                    <span className="help-section-title">{section.title}</span>
                    <svg className={`help-chevron${isOpen ? ' open' : ''}`} width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="4 5 7 8 10 5" />
                    </svg>
                  </button>
                  {isOpen && (
                    <ul className="help-section-body">
                      {section.content.map((line, j) => (
                        <li key={j}>{highlightMatch(line, search)}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="help-highlight">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}
