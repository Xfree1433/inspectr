import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import { ConfirmDialog } from './ConfirmDialog';

interface ReportData {
  id: string;
  site: string;
  type: string;
  score: number;
  inspectorName: string;
  createdAt: string;
  sections: { name: string; score: number; items: { text: string; status: string; note?: string }[] }[];
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ReportModal({ open, onClose }: Props) {
  const { activeInspection, toast } = useApp();
  const [report, setReport] = useState<ReportData | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sigDrawing = useRef(false);
  const [sigStarted, setSigStarted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (open && activeInspection) {
      api.getReport(activeInspection.id).then(setReport).catch(() => {});
    }
  }, [open, activeInspection]);

  const initSig = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.parentElement!.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d')!;
    const style = getComputedStyle(document.documentElement);
    ctx.strokeStyle = style.getPropertyValue('--lime').trim() || '#1B7D2F';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const pos = (e: MouseEvent | TouchEvent) => {
      const r = canvas.getBoundingClientRect();
      const src = 'touches' in e ? e.touches[0] : e;
      return [src.clientX - r.left, src.clientY - r.top] as const;
    };

    const onStart = (e: MouseEvent | TouchEvent) => {
      if ('touches' in e) e.preventDefault();
      sigDrawing.current = true;
      const [x, y] = pos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      setSigStarted(true);
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      if ('touches' in e) e.preventDefault();
      if (!sigDrawing.current) return;
      const [x, y] = pos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    };
    const onEnd = () => { sigDrawing.current = false; };

    canvas.addEventListener('mousedown', onStart);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup', onEnd);
    canvas.addEventListener('touchstart', onStart, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onEnd);

    return () => {
      canvas.removeEventListener('mousedown', onStart);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseup', onEnd);
      canvas.removeEventListener('touchstart', onStart);
      canvas.removeEventListener('touchmove', onMove);
      canvas.removeEventListener('touchend', onEnd);
    };
  }, []);

  useEffect(() => {
    if (open && report) {
      const timer = setTimeout(initSig, 100);
      return () => clearTimeout(timer);
    }
  }, [open, report, initSig]);

  const clearSig = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) { ctx.clearRect(0, 0, 99999, 99999); setSigStarted(false); }
  };

  if (!open || !report) return null;

  const scoreColor = report.score >= 80 ? 'var(--lime)' : report.score >= 60 ? 'var(--warn)' : 'var(--fail)';
  const totalItems = report.sections.reduce((a, s) => a + s.items.length, 0);
  const passedItems = report.sections.reduce((a, s) => a + s.items.filter(i => i.status === 'pass').length, 0);
  const failedItems = report.sections.reduce((a, s) => a + s.items.filter(i => i.status === 'fail').length, 0);
  const pendingItems = totalItems - passedItems - failedItems;
  const doneItems = passedItems + failedItems;

  return (
    <div className={`modal-overlay${open ? ' open' : ''}`} onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600, maxHeight: '94vh' }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-title">Inspection Report</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn-ghost" style={{ padding: '8px 14px', fontSize: 12 }} onClick={() => toast('Report exported as PDF', 't-info', '↓')}>EXPORT PDF</button>
            <button className="modal-close" onClick={onClose}>
              <svg width="12" height="12" viewBox="0 0 12 12"><line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.8"/><line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.8"/></svg>
            </button>
          </div>
        </div>
        <div className="modal-body" style={{ padding: 0 }}>
          <div className="report-hero">
            <div className="report-id">{report.id} · {report.type}</div>
            <div className="report-site">{report.site}</div>
            <div className="report-meta">
              <span>Inspector: {report.inspectorName}</span>
              <span>Date: {new Date(report.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
            <div className="report-score-big">
              <div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: .5, color: 'var(--text-ghost)', marginBottom: 4 }}>OVERALL SCORE</div>
                <div className="rsb-num" style={{ color: scoreColor }}>{report.score}</div>
              </div>
              <div className="rsb-bar-wrap">
                <div className="rsb-label">COMPLETION · {doneItems} OF {totalItems} ITEMS</div>
                <div className="rsb-track"><div className="rsb-fill" style={{ width: `${totalItems > 0 ? (doneItems / totalItems * 100) : 0}%`, background: scoreColor }} /></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span className="badge bp">{passedItems} PASSED</span>
                  <span className="badge bf">{failedItems} FAILED</span>
                  <span className="badge bn">{pendingItems} PENDING</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            {report.sections.map(group => (
              <div key={group.name} className="rs-group">
                <div className="rs-group-hdr">
                  <div className="rs-group-title">{group.name}</div>
                  <div className="rs-group-score" style={{ color: group.score === 0 ? 'var(--text-ghost)' : group.score >= 80 ? 'var(--lime)' : 'var(--warn)' }}>
                    {group.score === 0 ? 'PENDING' : `${group.score}%`}
                  </div>
                </div>
                {group.items.map((item, i) => (
                  <div key={i}>
                    <div className="rs-item">
                      <div className="rs-dot" style={{ background: item.status === 'pass' ? 'var(--lime)' : item.status === 'fail' ? 'var(--fail)' : 'var(--border-hi)' }} />
                      <div className="rs-text">{item.text}</div>
                      {item.status !== 'pending' ? (
                        <span className={`badge ${item.status === 'pass' ? 'bp' : 'bf'}`}>{item.status.toUpperCase()}</span>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-ghost)' }}>–</span>
                      )}
                    </div>
                    {item.note && (
                      <div style={{ background: 'var(--fail-bg)', padding: '10px 20px', borderTop: '1px solid rgba(255,59,48,.2)' }}>
                        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 500, color: 'var(--fail)', lineHeight: 1.4 }}>⚠ {item.note}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="sig-block">
            <div className="sig-label">INSPECTOR SIGN-OFF</div>
            <div className="sig-canvas">
              <canvas ref={canvasRef} />
              {!sigStarted && <span style={{ pointerEvents: 'none' }}>Sign here →</span>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-ghost)' }}>
                {report.inspectorName?.toUpperCase()} · {new Date(report.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
              <button onClick={clearSig} style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-ghost)', background: 'transparent', border: 'none', cursor: 'pointer', letterSpacing: .5 }}>CLEAR</button>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Close</button>
          <button className="btn-lime" onClick={() => setShowConfirm(true)} style={{ marginLeft: 'auto' }}>Submit for Approval</button>
        </div>
      </div>
      <ConfirmDialog
        open={showConfirm}
        title="Submit Report?"
        message={`This will finalize inspection ${report.id} and submit it for approval. This action cannot be undone.`}
        confirmLabel="Submit"
        onConfirm={() => {
          setShowConfirm(false);
          api.submitReport(report.id).then(() => {
            toast('Report submitted for approval', 't-pass', '✓');
            onClose();
          }).catch(() => toast('Failed to submit report', 't-fail', '!'));
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
