import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.05)',
  border: '1.5px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  color: '#fff',
  padding: '11px 14px',
  fontSize: 15,
  fontFamily: 'inherit',
  outline: 'none',
};

export default function Profile() {
  const { user } = useAuth();
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) { toast.error('New passwords do not match.'); return; }
    if (newPwd.length < 8) { toast.error('New password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/change-password', {
        current_password: currentPwd,
        new_password: newPwd,
      });
      toast.success(data.message);
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  const INFO_ROWS = [
    { label: 'Name',     value: user?.name },
    { label: 'Username', value: user?.username },
    { label: 'Phone',    value: user?.phone || '—' },
    { label: 'Email',    value: user?.email || '—' },
    { label: 'Role',     value: user?.role === 'admin' ? '⚙️ Admin' : '🎱 Bettor' },
  ];

  return (
    <div className="animate-fadeInUp">
      {/* User info */}
      <div className="dark-card" style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: 'rgba(255,255,255,0.9)', marginBottom: 18 }}>
          👤 My Profile
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {INFO_ROWS.map(({ label, value }) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 14px', borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: 600 }}>{label}</span>
              <span style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 700 }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Change password */}
      <div className="dark-card">
        <div style={{ fontSize: 18, fontWeight: 800, color: 'rgba(255,255,255,0.85)', marginBottom: 18 }}>
          🔒 Change Password
        </div>
        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'Current Password', value: currentPwd, setter: setCurrentPwd },
            { label: 'New Password (min 8 chars)', value: newPwd, setter: setNewPwd },
            { label: 'Confirm New Password', value: confirmPwd, setter: setConfirmPwd },
          ].map(({ label, value, setter }) => (
            <div key={label}>
              <label style={{
                display: 'block',
                color: 'rgba(255,255,255,0.45)',
                fontSize: 11,
                fontWeight: 700,
                marginBottom: 6,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
              }}>
                {label}
              </label>
              <input
                type="password"
                value={value}
                onChange={e => setter(e.target.value)}
                required
                style={inputStyle}
                placeholder="••••••••"
              />
            </div>
          ))}
          <button
            type="submit"
            disabled={loading}
            className="neon-cta-btn"
            style={{ marginTop: 4 }}
          >
            {loading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
