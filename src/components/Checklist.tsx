import { useMemo, useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import { FailureListModal } from './FailureListModal';
import type { CheckItemPhoto } from '../types';

export function Checklist({ onOpenFailModal, onOpenReport }: { onOpenFailModal: (title: string, checkItemId: string) => void; onOpenReport?: () => void }) {
  const { activeInspection, checklist, loadChecklist, toast, incrementFailBadge, refreshAll } = useApp();
  const [showFailures, setShowFailures] = useState(false);
  const [lightbox, setLightbox] = useState<{ photos: CheckItemPhoto[]; index: number } | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoTargetRef = useRef<string>('');

  const handleAddPhoto = (checkItemId: string) => {
    photoTargetRef.current = checkItemId;
    photoInputRef.current?.click();
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeInspection) return;
    if (file.size > 5 * 1024 * 1024) { toast('Photo must be under 5 MB', 't-fail', '!'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      if (!ev.target?.result) return;
      await api.addCheckItemPhoto(photoTargetRef.current, ev.target.result as string);
      toast('Photo added', 't-pass', '📷');
      loadChecklist(activeInspection.id);
    };
    reader.onerror = () => toast('Failed to read photo', 't-fail', '!');
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!activeInspection) return;
    await api.deleteCheckItemPhoto(photoId);
    toast('Photo removed', 't-info', '~');
    loadChecklist(activeInspection.id);
    setLightbox(null);
  };

  const { totalItems, doneItems, pct } = useMemo(() => {
    let total = 0, done = 0;
    checklist.forEach(g => {
      g.items.forEach(i => {
        if (i.status === 'na') return;
        total++;
        if (i.status === 'done' || i.status === 'failed') done++;
      });
    });
    return { totalItems: total, doneItems: done, pct: total > 0 ? Math.round(done / total * 100) : 0 };
  }, [checklist]);

  if (!activeInspection) {
    return (
      <div className="empty-state" style={{ height: '100%' }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
        </svg>
        <div className="empty-state-title">No Inspection Selected</div>
        <div className="empty-state-text">
          Select an inspection from the list to view its checklist. Use the ✓ and ✕ buttons to mark each item as passed or failed.
        </div>
      </div>
    );
  }

  const handlePass = async (itemId: string) => {
    await api.updateCheckItem(itemId, { status: 'done' });
    if (navigator.vibrate) navigator.vibrate(40);
    toast('Item passed', 't-pass', '✓');
    loadChecklist(activeInspection.id);
  };

  const handleNA = async (itemId: string) => {
    await api.updateCheckItem(itemId, { status: 'na' });
    toast('Item marked N/A', 't-info', '—');
    loadChecklist(activeInspection.id);
  };

  const handleFail = async (itemId: string, text: string) => {
    await api.updateCheckItem(itemId, { status: 'failed' });
    if (navigator.vibrate) navigator.vibrate([60, 30, 60]);
    toast('Failure flagged — add detail', 't-fail', '⚠');
    incrementFailBadge();
    loadChecklist(activeInspection.id);
    onOpenFailModal(text, itemId);
  };

  const handleReset = async (itemId: string) => {
    await api.updateCheckItem(itemId, { status: '' });
    toast('Item reset to unchecked', 't-info', '↺');
    loadChecklist(activeInspection.id);
  };

  const handleSubmit = async () => {
    await api.submitReport(activeInspection.id);
    toast('Report submitted for supervisor approval', 't-pass', '✓');
    refreshAll();
  };

  const statusBadge = activeInspection.status === 'pass' ? 'bp' : activeInspection.status === 'fail' ? 'bf' : 'bn';
  const isLocked = activeInspection.status === 'pass' || activeInspection.status === 'fail';

  return (
    <div className="cl-col">
      <div className="cl-hdr">
        <div className="cl-site">{activeInspection.site}</div>
        <div className="cl-meta">
          <span className={`badge ${statusBadge}`}>{activeInspection.status === 'pending' ? 'IN PROGRESS' : activeInspection.status.toUpperCase()}</span>
          {activeInspection.id} · {activeInspection.type}
        </div>
        <div className="cl-prog">
          <div className="ptr"><div className="pf" style={{ width: `${pct}%` }} /></div>
          <div className="pp">{pct}%</div>
          <div className="pfr">{doneItems}/{totalItems}</div>
        </div>
      </div>
      <div className="cl-actions">
        <button className="btn-ghost" title="View logged failures and remediation status" onClick={() => setShowFailures(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Failures
        </button>
        {onOpenReport && (
          <button className="btn-ghost" title="View the full inspection report" onClick={onOpenReport}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            Report
          </button>
        )}
        {!isLocked && (
          <button className="btn-ghost" title="Flag this inspection for supervisor review" onClick={() => toast('Inspection flagged for review', 't-warn', '⚑')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
            Flag
          </button>
        )}
        {!isLocked && <span className="auto-saved-badge" title="Changes are saved automatically as you work">AUTO-SAVED ✓</span>}
      </div>
      {isLocked ? (
        <div className="cl-locked-banner">
          This inspection has been submitted and is now read-only.
        </div>
      ) : (
        <div className="section-hint">
          Work through each item below. Tap ✓ to pass or ✕ to flag a failure. Failed items open a detail form for notes, photos, and assignment.
        </div>
      )}
      <div className="cl-scroll">
        {checklist.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-text">No checklist items for this inspection.</div>
          </div>
        ) : (
          checklist.map(group => (
            <div key={group.name}>
              <div className="grp">{group.name}</div>
              {group.items.map(item => (
                <div
                  key={item.id}
                  className={`crow${item.status ? ` ${item.status}` : ''}${item.status && !isLocked ? ' crow-clickable' : ''}`}
                  onClick={() => {
                    if (isLocked || !item.status) return;
                    if (item.status === 'failed') onOpenFailModal(item.text, item.id);
                    else handleReset(item.id);
                  }}
                >
                  <div className="cbox">
                    {item.status === 'done' && (
                      <svg viewBox="0 0 11 11"><polyline points="1.5,5.5 4.5,8.5 9.5,2" stroke="#0A0A09" strokeWidth="1.8" fill="none" strokeLinecap="round"/></svg>
                    )}
                    {item.status === 'failed' && (
                      <svg viewBox="0 0 11 11"><line x1="2" y1="2" x2="9" y2="9" stroke="var(--fail)" strokeWidth="1.8"/><line x1="9" y1="2" x2="2" y2="9" stroke="var(--fail)" strokeWidth="1.8"/></svg>
                    )}
                    {item.status === 'na' && (
                      <svg viewBox="0 0 11 11"><line x1="2" y1="5.5" x2="9" y2="5.5" stroke="var(--text-ghost)" strokeWidth="1.8" strokeLinecap="round"/></svg>
                    )}
                  </div>
                  <div className="crow-body">
                    <div className="crow-text">{item.text}</div>
                    {item.failNote && (
                      <div className="fail-note">
                        ⚠ {item.failNote}{!isLocked && ' — tap to edit'}
                      </div>
                    )}
                    {item.photos && item.photos.length > 0 && (
                      <div className="crow-photos">
                        {item.photos.map((p, pi) => (
                          <div key={p.id} className={`crow-photo-thumb${p.isReference ? ' ref' : ''}`} onClick={(e) => { e.stopPropagation(); setLightbox({ photos: item.photos, index: pi }); }}>
                            <img src={p.dataUrl} alt="" />
                            {p.isReference && <span className="ref-badge">REF</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {!item.status && !isLocked && (
                    <div className="crow-acts">
                      <button className="act act-cam" title="Take photo" onClick={(e) => { e.stopPropagation(); handleAddPhoto(item.id); }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      </button>
                      <button className="act act-p" title="Mark as passed" onClick={(e) => { e.stopPropagation(); handlePass(item.id); }}>
                        <svg width="12" height="12" viewBox="0 0 12 12"><polyline points="1.5,6 4.5,9 10.5,2.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round"/></svg>
                      </button>
                      <button className="act act-na" title="Not applicable — skip this item" onClick={(e) => { e.stopPropagation(); handleNA(item.id); }}>
                        <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                      </button>
                      <button className="act act-f" title="Flag as failed — opens failure detail form" onClick={(e) => { e.stopPropagation(); handleFail(item.id, item.text); }}>
                        <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.8"/><line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.8"/></svg>
                      </button>
                    </div>
                  )}
                  {item.status && !isLocked && (
                    <div className="crow-done-acts">
                      <button className="act act-cam" title="Take photo" onClick={(e) => { e.stopPropagation(); handleAddPhoto(item.id); }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      </button>
                      <div className="crow-undo" title={item.status === 'failed' ? 'View/edit failure details' : 'Reset to unchecked'}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          {item.status === 'failed' ? (
                            <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></>
                          ) : (
                            <><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></>
                          )}
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
        {!isLocked && (
          <div className="sub-bar">
            <button type="button" className="btn-lime sub-bar-submit" title="Submit completed inspection for approval" onClick={handleSubmit}>SUBMIT REPORT</button>
          </div>
        )}
      </div>
      <input ref={photoInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handlePhotoCapture} />
      {lightbox && (
        <div className="lightbox-overlay" onClick={() => setLightbox(null)}>
          <div className="lightbox" onClick={e => e.stopPropagation()}>
            <img src={lightbox.photos[lightbox.index].dataUrl} alt="" />
            <div className="lightbox-bar">
              {lightbox.photos[lightbox.index].isReference && <span className="badge bn">REFERENCE PHOTO</span>}
              <span className="lightbox-counter">{lightbox.index + 1} / {lightbox.photos.length}</span>
              <div className="lightbox-nav">
                {lightbox.photos.length > 1 && (
                  <>
                    <button type="button" className="btn-ghost" onClick={() => setLightbox({ ...lightbox, index: (lightbox.index - 1 + lightbox.photos.length) % lightbox.photos.length })}>Prev</button>
                    <button type="button" className="btn-ghost" onClick={() => setLightbox({ ...lightbox, index: (lightbox.index + 1) % lightbox.photos.length })}>Next</button>
                  </>
                )}
                {!isLocked && !lightbox.photos[lightbox.index].isReference && (
                  <button type="button" className="btn-ghost" style={{ color: 'var(--fail)' }} onClick={() => handleDeletePhoto(lightbox.photos[lightbox.index].id)}>Delete</button>
                )}
                <button type="button" className="btn-ghost" onClick={() => setLightbox(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <FailureListModal
        open={showFailures}
        inspectionId={activeInspection.id}
        onClose={() => setShowFailures(false)}
      />
    </div>
  );
}
