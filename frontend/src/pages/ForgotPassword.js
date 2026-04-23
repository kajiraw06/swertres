import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';

const inputStyle = {
  width: '100%', padding: '12px 16px', borderRadius: 12,
  border: '1.5px solid #e2e8f0', fontSize: 15, outline: 'none',
  marginBottom: 14, fontFamily: 'inherit',
};

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', name: '', new_password: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    if (form.new_password !== form.confirm) return toast.error('Passwords do not match.');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', {
        username: form.username,
        name: form.name,
        new_password: form.new_password,
      });
      toast.success('Password reset! You can now log in.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 16px' }}>
      <div style={{ background: '#fff', borderRadius: 24, padding: '36px 28px', boxShadow: '0 8px 40px rgba(0,0,0,0.2)', width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 42, lineHeight: 1 }}>🔑</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#1e40af', marginTop: 8 }}>Reset Password</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Enter your username and full name to verify your account.</div>
        </div>

        <form onSubmit={handle}>
          <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Username</label>
          <input style={inputStyle} placeholder="your_username" value={form.username}
            onChange={e => setForm({ ...form, username: e.target.value })} required />

          <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Full Name (as registered)</label>
          <input style={inputStyle} placeholder="Juan dela Cruz" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} required />

          <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>New Password</label>
          <input style={inputStyle} type="password" placeholder="At least 8 characters" value={form.new_password}
            onChange={e => setForm({ ...form, new_password: e.target.value })} required />

          <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Confirm New Password</label>
          <input style={inputStyle} type="password" placeholder="Repeat new password" value={form.confirm}
            onChange={e => setForm({ ...form, confirm: e.target.value })} required />

          <button
            style={{
              width: '100%', padding: '14px', marginTop: 4,
              background: loading ? '#94a3b8' : 'linear-gradient(90deg,#1e40af,#2563eb)',
              color: '#fff', border: 'none', borderRadius: 14,
              fontSize: 16, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 16px rgba(37,99,235,0.35)',
              fontFamily: 'inherit',
            }}
            disabled={loading}>{loading ? 'Resetting…' : 'Reset Password'}</button>
        </form>

        <Link to="/login" style={{ display: 'block', textAlign: 'center', marginTop: 18, color: '#2563eb', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
          ← Back to Login
        </Link>
      </div>
    </div>
  );
}
