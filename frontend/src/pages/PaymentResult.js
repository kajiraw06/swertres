import React, { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const S = {
  card:  { background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginTop: 40 },
  icon:  { fontSize: 60, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 800, marginBottom: 8 },
  sub:   { color: '#64748b', marginBottom: 24 },
  btn:   { display: 'inline-block', padding: '14px 28px', background: '#1e40af', color: '#fff', borderRadius: 12, fontWeight: 700, textDecoration: 'none', fontSize: 16 },
};

export default function PaymentResult({ success }) {
  const { refreshUser } = useAuth();
  const [params] = useSearchParams();

  useEffect(() => {
    if (success) {
      // Refresh balance after a short delay (webhook may still be processing)
      setTimeout(() => refreshUser(), 2000);
    }
  }, [success]);

  return (
    <div className="payment-result-card" style={{ ...S.card, marginTop: 40 }}>
      {success ? (
        <>
          <div style={S.icon}>✅</div>
          <div style={{ ...S.title, color: '#16a34a' }}>Payment Successful!</div>
          <div style={S.sub}>Your GCash payment was received. Your balance will be updated shortly.</div>
        </>
      ) : (
        <>
          <div style={S.icon}>❌</div>
          <div style={{ ...S.title, color: '#dc2626' }}>Payment Failed</div>
          <div style={S.sub}>Your GCash payment was not completed. You were not charged.</div>
        </>
      )}
      <Link to="/wallet" style={S.btn}>Go to Wallet</Link>
    </div>
  );
}
