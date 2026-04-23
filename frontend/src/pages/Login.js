import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const inputStyle = {
  width: '100%', padding: '12px 16px', borderRadius: 12,
  border: '1.5px solid #e2e8f0', fontSize: 15, outline: 'none',
  marginBottom: 14, fontFamily: 'inherit',
  transition: 'border-color 0.2s',
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.username, form.password);
      navigate(user.role === 'admin' ? '/admin' : '/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 16px' }}>
      <div style={{ background: '#fff', borderRadius: 24, padding: '36px 28px', boxShadow: '0 8px 40px rgba(0,0,0,0.2)', width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48, lineHeight: 1 }}>🎱</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#1e40af', marginTop: 8, letterSpacing: 0.5 }}>SWERTRES</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4, fontWeight: 500 }}>3D Lotto Betting Platform</div>
        </div>

        <form onSubmit={handle}>
          <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Username</label>
          <input style={inputStyle} placeholder="your_username" value={form.username}
            onChange={e => setForm({ ...form, username: e.target.value })} required />
          <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Password</label>
          <input style={inputStyle} type="password" placeholder="••••••••" value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })} required />
          <button
            style={{
              width: '100%', padding: '14px', marginTop: 4,
              background: loading ? '#94a3b8' : 'linear-gradient(90deg,#1e40af,#2563eb)',
              color: '#fff', border: 'none', borderRadius: 14,
              fontSize: 16, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 16px rgba(37,99,235,0.35)',
              fontFamily: 'inherit',
            }}
            disabled={loading}>{loading ? 'Logging in…' : 'Login'}</button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}>
          <Link to="/forgot-password" style={{ color: '#64748b', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            Forgot password?
          </Link>
          <Link to="/register" style={{ color: '#2563eb', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
