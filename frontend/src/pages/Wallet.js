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
  fontFamily: 'inherit',
};

const lbl = { fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6, display: 'block' };

const QUICK = [100, 200, 500, 1000];

export default function Wallet() {
  const { user, refreshUser } = useAuth();
  const [amount, setAmount]   = useState(100);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const [wdAmount, setWdAmount]   = useState(100);
  const [wdPhone, setWdPhone]     = useState('');
  const [wdName, setWdName]       = useState('');
  const [wdLoading, setWdLoading] = useState(false);
  const [myWithdrawals, setMyWithdrawals] = useState([]);

  const loadWithdrawals = useCallback(() => {
    api.get('/payments/withdrawals').then(r => setMyWithdrawals(r.data.withdrawals || [])).catch(() => {});
  }, []);

  useEffect(() => {
    refreshUser();
    api.get('/payments/history').then(r => setHistory(r.data.transactions));
    loadWithdrawals();
  }, []); // eslint-disable-line

  const handleGcashCheckout = async () => {
    if (amount < 100) return toast.error('Minimum deposit is ₱100.');
    setLoading(true);
    try {
      const { data } = await api.post('/payments/gcash-checkout', { amount });
      window.location.href = data.checkout_url;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create checkout. Try again.');
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (wdAmount < 100) return toast.error('Minimum withdrawal is ₱100.');
    if (!/^09\d{9}$/.test(wdPhone)) return toast.error('Enter a valid GCash number (09XXXXXXXXX).');
    if (!wdName.trim()) return toast.error('Enter your GCash account name.');
    setWdLoading(true);
    try {
      const { data } = await api.post('/payments/withdraw', { amount: wdAmount, gcash_number: wdPhone, gcash_name: wdName.trim() });
      toast.success(data.message);
      setWdAmount(100); setWdPhone(''); setWdName('');
      loadWithdrawals();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Request failed. Try again.');
    } finally {
      setWdLoading(false);
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
          &#8369;{parseFloat(user?.balance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
        </div>
      </div>

      {/* Deposit via GCash */}
      <div style={card}>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#007AFF', marginBottom: 6 }}>&#128154; Deposit via GCash</div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
          Pay securely via GCash. Balance is credited automatically after payment.
        </div>

        <label style={lbl}>Choose Amount</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {QUICK.map(a => (
            <button key={a}
              style={{
                padding: '8px 16px', borderRadius: 10, fontFamily: 'inherit',
                border: `2px solid ${amount === a ? '#007AFF' : '#e2e8f0'}`,
                background: amount === a ? '#eff6ff' : '#f8fafc',
                color: amount === a ? '#007AFF' : '#374151',
                fontWeight: 700, cursor: 'pointer', fontSize: 14,
              }}
              onClick={() => setAmount(a)}>&#8369;{a}</button>
          ))}
        </div>
        <input style={inp} type="number" min={100} value={amount}
          onChange={e => setAmount(parseInt(e.target.value) || 100)} />

        <button
          style={{
            width: '100%', padding: 14,
            background: loading ? '#94a3b8' : 'linear-gradient(90deg,#007AFF,#0055CC)',
            color: '#fff', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 800,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 4px 14px rgba(0,122,255,0.4)',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
          disabled={loading} onClick={handleGcashCheckout}>
          <span style={{ fontSize: 20 }}>&#128241;</span>
          {loading ? 'Redirecting to GCash...' : `Pay &#8369;${amount} via GCash`}
        </button>

        <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 10 }}>
          You will be redirected to the GCash payment page.
        </div>
      </div>

      {/* Withdraw */}
      <div style={card}>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#7c3aed', marginBottom: 6 }}>&#127978; Withdraw to GCash</div>
        <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#854d0e' }}>
          &#9888;&#65039; Withdrawal requests are reviewed by admin and usually processed within 24 hours.
        </div>

        <label style={lbl}>Amount (minimum &#8369;100)</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {[100, 200, 500, 1000].map(a => (
            <button key={a}
              style={{
                padding: '8px 14px', borderRadius: 10, fontFamily: 'inherit',
                border: `2px solid ${wdAmount === a ? '#7c3aed' : '#e2e8f0'}`,
                background: wdAmount === a ? '#f5f3ff' : '#f8fafc',
                color: wdAmount === a ? '#7c3aed' : '#374151',
                fontWeight: 700, cursor: 'pointer', fontSize: 14,
              }}
              onClick={() => setWdAmount(a)}>&#8369;{a}</button>
          ))}
        </div>
        <input style={inp} type="number" min={100} value={wdAmount} onChange={e => setWdAmount(parseInt(e.target.value) || 100)} />
        <label style={lbl}>GCash Number (09XXXXXXXXX)</label>
        <input style={inp} type="tel" placeholder="09XXXXXXXXX" value={wdPhone} onChange={e => setWdPhone(e.target.value)} />
        <label style={lbl}>GCash Account Name</label>
        <input style={inp} type="text" placeholder="Full name on GCash" value={wdName} onChange={e => setWdName(e.target.value)} />
        <button
          style={{ width: '100%', padding: 14, background: wdLoading ? '#94a3b8' : 'linear-gradient(90deg,#7c3aed,#6d28d9)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: wdLoading ? 'not-allowed' : 'pointer', boxShadow: wdLoading ? 'none' : '0 4px 14px rgba(124,58,237,0.35)', fontFamily: 'inherit' }}
          disabled={wdLoading} onClick={handleWithdraw}>
          {wdLoading ? 'Submitting...' : `Request &#8369;${wdAmount} Withdrawal`}
        </button>
      </div>

      {/* Withdrawal history */}
      {myWithdrawals.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#1e40af', marginBottom: 14 }}>&#128184; My Withdrawal Requests</div>
          {myWithdrawals.map(w => {
            const ok  = w.status === 'approved';
            const bad = w.status === 'rejected';
            return (
              <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid #f1f5f9', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>&#8369;{parseFloat(w.amount).toFixed(2)} to {w.gcash_name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{w.gcash_number} &middot; {new Date(w.created_at).toLocaleString('en-PH')}</div>
                  {w.note && <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>Note: {w.note}</div>}
                </div>
                <span style={{ padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', background: ok ? '#dcfce7' : bad ? '#fee2e2' : '#fef3c7', color: ok ? '#166534' : bad ? '#991b1b' : '#92400e' }}>
                  {ok ? 'Approved' : bad ? 'Rejected' : 'Pending'}
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
                    {isCredit ? '+' : '-'}&#8369;{parseFloat(tx.amount).toFixed(2)}
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
