import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const card = {
  background: '#fff',
  borderRadius: 20,
  padding: '20px',
  marginBottom: 14,
  boxShadow: '0 4px 24px rgba(0,0,0,0.13)',
};

const inp = {
  width: '100%', padding: '12px 14px', borderRadius: 12,
  border: '1.5px solid #e2e8f0', fontSize: 15, marginBottom: 14,
  fontFamily: 'inherit', boxSizing: 'border-box',
};

const lbl = { fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6, display: 'block' };

const QUICK = [100, 200, 500, 1000];
const P = (n) => `\u20B1${parseFloat(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

export default function Wallet() {
  const { user, refreshUser } = useAuth();
  const [history, setHistory] = useState([]);

  // Cash-in state
  const [ciAmount, setCiAmount]   = useState(100);
  const [ciNote, setCiNote]       = useState('');
  const [ciLoading, setCiLoading] = useState(false);

  // Cash-out state
  const [coAmount, setCoAmount]     = useState(100);
  const [coNote, setCoNote]         = useState('');
  const [coLoading, setCoLoading]   = useState(false);
  const [myWithdrawals, setMyWithdrawals] = useState([]);

  const loadWithdrawals = useCallback(() => {
    api.get('/payments/withdrawals').then(r => setMyWithdrawals(r.data.withdrawals || [])).catch(() => {});
  }, []);

  useEffect(() => {
    refreshUser();
    api.get('/payments/history').then(r => setHistory(r.data.transactions));
    loadWithdrawals();
  }, []); // eslint-disable-line

  const handleCashIn = async () => {
    if (ciAmount < 50) return toast.error('Minimum cash-in is \u20B150.');
    setCiLoading(true);
    try {
      const { data } = await api.post('/payments/deposit', { amount: ciAmount, note: ciNote.trim() });
      toast.success(data.message);
      setCiNote('');
      api.get('/payments/history').then(r => setHistory(r.data.transactions));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit request. Try again.');
    } finally {
      setCiLoading(false);
    }
  };

  const handleCashOut = async () => {
    if (coAmount < 100) return toast.error('Minimum cash-out is \u20B1100.');
    setCoLoading(true);
    try {
      const { data } = await api.post('/payments/withdraw', { amount: coAmount, contact_info: coNote.trim() });
      toast.success(data.message);
      setCoAmount(100); setCoNote('');
      loadWithdrawals();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Request failed. Try again.');
    } finally {
      setCoLoading(false);
    }
  };


  return (
    <div className="animate-fadeInUp">

      {/* Balance */}
      <div style={{
        background: 'linear-gradient(135deg,#0d1a4a,#1e40af,#2563eb)',
        borderRadius: 22, padding: '22px', marginBottom: 14,
        textAlign: 'center', boxShadow: '0 6px 28px rgba(13,26,74,0.45)',
      }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          Your Balance
        </div>
        <div style={{ fontSize: 42, fontWeight: 900, color: '#fff', letterSpacing: -1 }}>
          {P(user?.balance || 0)}
        </div>
      </div>

      {/* Top Up */}
      <div style={card}>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#059669', marginBottom: 6 }}>💰 Top Up Wallet</div>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#166534' }}>
          Submit a top-up request. Admin will review and credit your balance once confirmed.
        </div>

        <label style={lbl}>Amount (minimum {P(50)})</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {QUICK.map(a => (
            <button key={a}
              style={{
                padding: '8px 16px', borderRadius: 10, fontFamily: 'inherit',
                border: `2px solid ${ciAmount === a ? '#059669' : '#e2e8f0'}`,
                background: ciAmount === a ? '#f0fdf4' : '#f8fafc',
                color: ciAmount === a ? '#059669' : '#374151',
                fontWeight: 700, cursor: 'pointer', fontSize: 14,
              }}
              onClick={() => setCiAmount(a)}>
              {P(a)}
            </button>
          ))}
        </div>
        <input style={inp} type="number" min={50} value={ciAmount}
          onChange={e => setCiAmount(parseInt(e.target.value) || 50)} />

        <label style={lbl}>Message to admin <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span></label>
        <input style={inp} type="text" placeholder="Any message..." value={ciNote}
          onChange={e => setCiNote(e.target.value)} />

        <button
          style={{ width: '100%', padding: 14, background: ciLoading ? '#94a3b8' : 'linear-gradient(90deg,#059669,#10b981)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: ciLoading ? 'not-allowed' : 'pointer', boxShadow: ciLoading ? 'none' : '0 4px 14px rgba(5,150,105,0.35)', fontFamily: 'inherit' }}
          disabled={ciLoading} onClick={handleCashIn}>
          {ciLoading ? 'Submitting...' : `Request Top-Up ${P(ciAmount)}`}
        </button>
      </div>

      {/* Withdraw */}
      <div style={card}>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#7c3aed', marginBottom: 6 }}>🏧 Withdraw</div>
        <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#854d0e' }}>
          Submit a withdrawal request. Admin will process and confirm once done.
        </div>

        <label style={lbl}>Amount (minimum {P(100)})</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {QUICK.map(a => (
            <button key={a}
              style={{
                padding: '8px 14px', borderRadius: 10, fontFamily: 'inherit',
                border: `2px solid ${coAmount === a ? '#7c3aed' : '#e2e8f0'}`,
                background: coAmount === a ? '#f5f3ff' : '#f8fafc',
                color: coAmount === a ? '#7c3aed' : '#374151',
                fontWeight: 700, cursor: 'pointer', fontSize: 14,
              }}
              onClick={() => setCoAmount(a)}>{P(a)}</button>
          ))}
        </div>
        <input style={inp} type="number" min={100} value={coAmount} onChange={e => setCoAmount(parseInt(e.target.value) || 100)} />

        <label style={lbl}>Message to admin <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span></label>
        <input style={inp} type="text" placeholder="Any message..." value={coNote}
          onChange={e => setCoNote(e.target.value)} />

        <button
          style={{ width: '100%', padding: 14, background: coLoading ? '#94a3b8' : 'linear-gradient(90deg,#7c3aed,#6d28d9)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: coLoading ? 'not-allowed' : 'pointer', boxShadow: coLoading ? 'none' : '0 4px 14px rgba(124,58,237,0.35)', fontFamily: 'inherit' }}
          disabled={coLoading} onClick={handleCashOut}>
          {coLoading ? 'Submitting...' : `Request Withdrawal ${P(coAmount)}`}
        </button>
      </div>

      {/* Withdrawal history */}
      {myWithdrawals.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#1e40af', marginBottom: 14 }}>💸 My Withdrawal Requests</div>
          {myWithdrawals.map(w => {
            const ok  = w.status === 'approved';
            const bad = w.status === 'rejected';
            return (
              <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid #f1f5f9', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Cash-Out {P(w.amount)}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{new Date(w.created_at).toLocaleString('en-PH')}</div>
                  {w.contact_info && <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>Note: {w.contact_info}</div>}
                  {w.note && <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>Admin note: {w.note}</div>}
                </div>
                <span style={{ padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', background: ok ? '#dcfce7' : bad ? '#fee2e2' : '#fef3c7', color: ok ? '#166534' : bad ? '#991b1b' : '#92400e' }}>
                  {ok ? '✓ Approved' : bad ? '✗ Rejected' : '⏳ Pending'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Transaction history */}
      <div style={card}>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#1e40af', marginBottom: 14 }}>Transaction History</div>
        {history.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: 30 }}>No transactions yet.</div>
        ) : (
          history.map(tx => {
            const isCredit = tx.type === 'deposit' || tx.type === 'prize' || tx.type === 'refund';
            return (
              <div key={tx.id} style={{ padding: '12px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: tx.type === 'prize' ? '#166534' : '#1e293b' }}>{tx.note || tx.type}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(tx.created_at).toLocaleString('en-PH')}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: isCredit ? '#10b981' : '#ef4444' }}>
                    {isCredit ? '+' : '-'}{P(tx.amount)}
                  </div>
                  <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: isCredit ? '#dcfce7' : '#fee2e2', color: isCredit ? '#166534' : '#991b1b' }}>
                    {tx.type.toUpperCase()}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
