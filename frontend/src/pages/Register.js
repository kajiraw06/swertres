import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';

const inputStyle = {
  width: '100%', padding: '12px 16px', borderRadius: 12,
  border: '1.5px solid #e2e8f0', fontSize: 15, outline: 'none',
  marginBottom: 14, fontFamily: 'inherit',
};

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', username: '', phone: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return toast.error('Passwords do not match.');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', { name: form.name, username: form.username, phone: form.phone || undefined, password: form.password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      toast.success('Registration successful! Welcome!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 16px' }}>
      <div style={{ background: '#fff', borderRadius: 24, padding: '36px 28px', boxShadow: '0 8px 40px rgba(0,0,0,0.2)', width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 42, lineHeight: 1 }}>🎱</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#1e40af', marginTop: 8 }}>Create Account</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Join Swertres today!</div>
        </div>

        <form onSubmit={handle}>
          <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Full Name</label>
          <input style={inputStyle} placeholder="Juan dela Cruz" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} required />
          <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Username</label>
          <input style={inputStyle} placeholder="juandc123" value={form.username}
            onChange={e => setForm({ ...form, username: e.target.value })} required />
          <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Mobile Number <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span></label>
          <input style={inputStyle} placeholder="09XXXXXXXXX" value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })} />
          <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Password</label>
          <input style={inputStyle} type="password" placeholder="At least 8 characters" value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })} required />
          <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Confirm Password</label>
          <input style={inputStyle} type="password" placeholder="Repeat password" value={form.confirm}
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
            disabled={loading}>{loading ? 'Creating account…' : 'Register'}</button>
        </form>

        <Link to="/login" style={{ display: 'block', textAlign: 'center', marginTop: 18, color: '#2563eb', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
          Already have an account? <u>Login here</u>
        </Link>
      </div>
    </div>
  );
}
