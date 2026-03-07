import { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { useApp } from '../context/AppContext';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ProfileModal({ open, onClose }: Props) {
  const { profile, updateProfile } = useProfile();
  const { toast } = useApp();
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (open) {
      setName(profile.name);
      setCompany(profile.company);
      setEmail(profile.email);
    }
  }, [open, profile]);

  const handleSave = () => {
    updateProfile({ name: name.trim(), company: company.trim(), email: email.trim() });
    toast('Profile saved', 't-pass', '✓');
    onClose();
  };

  if (!open) return null;

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-title">Profile Settings</div>
          <button className="modal-close" onClick={onClose}>
            <svg width="12" height="12" viewBox="0 0 12 12"><line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.8"/><line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.8"/></svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="section-hint" style={{ margin: '-16px -16px 16px', padding: '10px 16px', borderTop: 'none' }}>
            Your name and company appear on emailed reports and the report footer.
          </div>
          <div className="fm-group">
            <label className="fm-label">Full Name</label>
            <input
              className="fm-input"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Mark Patterson"
              autoFocus
            />
          </div>
          <div className="fm-group">
            <label className="fm-label">Company / Organization</label>
            <input
              className="fm-input"
              type="text"
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="e.g. Acme Inspections Ltd."
            />
          </div>
          <div className="fm-group">
            <label className="fm-label">Email Address</label>
            <input
              className="fm-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="e.g. mark@acme.com"
            />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-lime" style={{ marginLeft: 'auto' }} onClick={handleSave}>Save Profile</button>
        </div>
      </div>
    </div>
  );
}
