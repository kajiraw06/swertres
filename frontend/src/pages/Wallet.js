import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  const [amount, setAmount]   = useState(100);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  // QRPh state
  const [qrCode, setQrCode]           = useState(null);
  const [qrPaymentId, setQrPaymentId] = useState(null);
  const [qrPaid, setQrPaid]           = useState(false);
  const pollRef = useRef(null);

  // Withdraw state
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

  // Poll for QR payment confirmation
  useEffect(() => {
    if (!qrPaymentId || qrPaid) return;
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/payments/status/${qrPaymentId}`);
        if (data.status === 'completed') {
          clearInterval(pollRef.current);
          setQrPaid(true);
          setQrCode(null);
          toast.success(`${P(data.amount)} credited to your balance!`);
          refreshUser();
          api.get('/payments/history').then(r => setHistory(r.data.transactions));
        }
      } catch {}
    }, 4000);
    return () => clearInterval(pollRef.current);
  }, [qrPaymentId, qrPaid]); // eslint-disable-line

  const handleGenerateQR = async () => {
    if (amount < 100) return toast.error('Minimum deposit is \u20B1100.');
    setLoading(true);
    setQrCode(null);
    setQrPaid(false);
    setQrPaymentId(null);
    clearInterval(pollRef.current);
    try {
      const { data } = await api.post('/payments/qrph-checkout', { amount });
      setQrCode(data.qr_code);
      setQrPaymentId(data.payment_id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate QR. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (wdAmount < 100) return toast.error('Minimum withdrawal is \u20B1100.');
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

  const qrSrc = qrCode
    ? (qrCode.startsWith('data:') || qrCode.startsWith('http') ? qrCode : `data:image/png;base64,${qrCode}`)
    : null;

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

      {/* Deposit via QRPh */}
      <div style={card}>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#1e40af', marginBottom: 6 }}>📱 Deposit via QRPh</div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
          Scan with GCash, Maya, or any QRPh bank app. Balance is credited automatically.
        </div>

        <label style={lbl}>Choose Amount</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {QUICK.map(a => (
            <button key={a}
              style={{
                padding: '8px 16px', borderRadius: 10, fontFamily: 'inherit',
                border: `2px solid ${amount === a ? '#1e40af' : '#e2e8f0'}`,
                background: amount === a ? '#eff6ff' : '#f8fafc',
                color: amount === a ? '#1e40af' : '#374151',
                fontWeight: 700, cursor: 'pointer', fontSize: 14,
              }}
              onClick={() => { setAmount(a); setQrCode(null); setQrPaid(false); }}>
              {P(a)}
            </button>
          ))}
        </div>
        <input style={inp} type="number" min={100} value={amount}
          onChange={e => { setAmount(parseInt(e.target.value) || 100); setQrCode(null); setQrPaid(false); }} />

        {qrPaid ? (
          <div style={{ textAlign: 'center', padding: '20px', background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', borderRadius: 14, border: '2px solid #86efac' }}>
            <div style={{ fontSize: 44 }}>✅</div>
            <div style={{ fontWeight: 900, color: '#166534', fontSize: 18, marginTop: 8 }}>Payment Received!</div>
            <div style={{ color: '#166534', fontSize: 13, marginTop: 4 }}>Your balance has been updated.</div>
            <button style={{ marginTop: 14, background: 'linear-gradient(90deg,#1e40af,#2563eb)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 24px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              onClick={() => { setQrPaid(false); setQrCode(null); }}>Pay Again</button>
          </div>
        ) : qrSrc ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#374151', marginBottom: 10 }}>Scan to pay <b>{P(amount)}</b></div>
            <img src={qrSrc} alt="QRPh QR code" style={{ width: 240, height: 240, maxWidth: '100%', border: '4px solid #e2e8f0', borderRadius: 16, objectFit: 'contain' }} />
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>⏳ Waiting for payment…</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Works with GCash, Maya, BPI, BDO &amp; all QRPh banks</div>
            <button style={{ marginTop: 12, background: 'none', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 16px', fontSize: 13, color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}
              onClick={() => { setQrCode(null); clearInterval(pollRef.current); }}>Cancel</button>
          </div>
        ) : (
          <button
            style={{ width: '100%', padding: 14, background: loading ? '#94a3b8' : 'linear-gradient(90deg,#1e40af,#2563eb)', color: '#fff', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 4px 14px rgba(30,64,175,0.35)', fontFamily: 'inherit' }}
            disabled={loading} onClick={handleGenerateQR}>
            {loading ? 'Generating QR...' : `Generate QR for ${P(amount)}`}
          </button>
        )}
      </div>

      {/* Withdraw */}
      <div style={card}>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#7c3aed', marginBottom: 6 }}>🏧 Withdraw to GCash</div>
        <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#854d0e' }}>
          ⚠️ Withdrawal requests are reviewed by admin and usually processed within 24 hours.
        </div>

        <label style={lbl}>Amount (minimum {P(100)})</label>
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
              onClick={() => setWdAmount(a)}>{P(a)}</button>
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
          {wdLoading ? 'Submitting...' : `Request ${P(wdAmount)} Withdrawal`}
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
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{P(w.amount)} to {w.gcash_name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{w.gcash_number} · {new Date(w.created_at).toLocaleString('en-PH')}</div>
                  {w.note && <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>Note: {w.note}</div>}
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
