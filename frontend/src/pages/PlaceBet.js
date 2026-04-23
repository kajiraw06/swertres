import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const QUICK_AMOUNTS = [5, 10, 20, 50, 100, 200];

function BetReceipt({ bet, onPlaceAnother, onViewBets }) {
  const prize = bet.bet_type === 'straight'
    ? (bet.amount / 10) * 4500
    : (bet.amount / 10) * 1500;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '20px 16px',
    }}>
      <div style={{
        background: 'linear-gradient(145deg,#0f172a,#1e1b4b)',
        border: '1.5px solid rgba(56,217,245,0.25)',
        borderRadius: 28, padding: '30px 24px', width: '100%', maxWidth: 380,
        boxShadow: '0 0 60px rgba(56,217,245,0.12)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 44 }}>🎟️</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginTop: 8 }}>Bet Confirmed!</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>Ref #{String(bet.id).padStart(6, '0')}</div>
        </div>

        {/* Numbers */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 22 }}>
          {bet.numbers.split('-').map((n, i) => (
            <div key={i} className="lotto-ball-lg">{n}</div>
          ))}
        </div>

        {/* Details */}
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '16px 18px', marginBottom: 20 }}>
          {[
            ['Draw', `${bet.draw_time} · ${bet.draw_date}`],
            ['Bet Type', bet.bet_type === 'straight' ? '🎯 Straight' : '🔀 Rambolito'],
            ['Amount', `₱${parseFloat(bet.amount).toLocaleString()}`],
            ['Win Up To', `₱${prize.toLocaleString()}`],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: label === 'Win Up To' ? '#fbbf24' : 'rgba(255,255,255,0.85)' }}>{value}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onPlaceAnother} style={{
            flex: 1, padding: '13px', borderRadius: 12,
            background: 'rgba(56,217,245,0.1)', border: '1.5px solid rgba(56,217,245,0.3)',
            color: '#38d9f5', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit',
          }}>+ Another Bet</button>
          <button onClick={onViewBets} style={{
            flex: 1, padding: '13px', borderRadius: 12,
            background: 'linear-gradient(90deg,#1d4ed8,#2563eb)',
            border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit',
          }}>My Bets</button>
        </div>
      </div>
    </div>
  );
}

export default function PlaceBet() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [digits, setDigits] = useState(['', '', '']);
  const [drawTime, setDrawTime] = useState('');
  const [betType, setBetType] = useState('straight');
  const [amount, setAmount] = useState(5);
  const [draws, setDraws] = useState([]);
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    api.get('/bets/available-draws').then(r => {
      setDraws(r.data.draws);
      const firstOpen = r.data.draws.find(d => d.is_open);
      if (firstOpen) setDrawTime(firstOpen.draw_time);
    });
  }, []);

  const prize = betType === 'straight'
    ? (amount / 10) * 4500
    : (amount / 10) * 1500;

  const allUnique = new Set(digits.filter(Boolean)).size === 3;

  const handleRandom = () => {
    setDigits([
      Math.floor(Math.random() * 10).toString(),
      Math.floor(Math.random() * 10).toString(),
      Math.floor(Math.random() * 10).toString(),
    ]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (digits.some(d => d === '')) return toast.error('Please enter all 3 digits.');
    if (!drawTime) return toast.error('No available draws right now.');
    setLoading(true);
    try {
      const { data } = await api.post('/bets', {
        draw_time: drawTime,
        numbers: digits.join('-'),
        bet_type: betType,
        amount,
      });
      refreshUser();
      setReceipt(data.bet);
      setDigits(['', '', '']);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to place bet.');
    } finally {
      setLoading(false);
    }
  };

  if (receipt) {
    return (
      <BetReceipt
        bet={receipt}
        onPlaceAnother={() => setReceipt(null)}
        onViewBets={() => navigate('/my-bets')}
      />
    );
  }

  return (
    <div className="animate-fadeInUp">

      {/* ── Balance / Win strip ─── */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: '14px 18px',
        marginBottom: 14,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: 1.5 }}>Your Balance</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>
            ₱{parseFloat(user?.balance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(251,191,36,0.55)', textTransform: 'uppercase', letterSpacing: 1 }}>Win Up To</div>
          <div className="prize-glow-text" style={{ fontSize: 22, fontWeight: 900 }}>
            ₱{((amount / 10) * 4500).toLocaleString()}
          </div>
        </div>
      </div>

      {/* ── Main form card ─────────── */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 24,
        padding: '22px 20px',
        marginBottom: 14,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 22, textAlign: 'center' }}>
          🎱 Pick Your Lucky Numbers
        </div>

        {draws.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0', color: 'rgba(255,255,255,0.38)', fontSize: 14 }}>
            ⏰ No more draws available today. Come back tomorrow!
          </div>
        ) : draws.every(d => !d.is_open) ? (
          <div style={{ textAlign: 'center', padding: '28px 0', color: 'rgba(255,255,255,0.38)', fontSize: 14 }}>
            ⏰ All draws are closed for today. Come back tomorrow!
          </div>
        ) : (
          <form onSubmit={handleSubmit}>

            {/* ── Digit inputs ── */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginBottom: 10 }}>
              {[0, 1, 2].map(i => (
                <input
                  key={i}
                  className={`digit-input-dark${digits[i] !== '' ? ' is-filled' : ''}`}
                  type="number" min={0} max={9}
                  maxLength={1}
                  value={digits[i]}
                  onChange={e => {
                    const v = e.target.value.slice(-1);
                    if (v === '' || /^\d$/.test(v)) {
                      const nd = [...digits]; nd[i] = v; setDigits(nd);
                    }
                  }}
                  placeholder={i + 1}
                  required
                />
              ))}
            </div>

            {/* Random button */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <button type="button" onClick={handleRandom} style={{
                background: 'rgba(56,217,245,0.07)',
                border: '1.5px solid rgba(56,217,245,0.28)',
                color: '#38d9f5',
                borderRadius: 10, padding: '7px 20px',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}>
                🎲 Random Lucky Numbers
              </button>
            </div>

            {/* ── Draw Time ── */}
            <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.2 }}>
              Draw Time
            </label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              {draws.map(d => {
                const active = drawTime === d.draw_time;
                const closed = !d.is_open;
                return (
                  <button key={d.draw_time} type="button"
                    disabled={closed}
                    onClick={() => !closed && setDrawTime(d.draw_time)}
                    style={{
                      flex: 1, padding: '12px 6px', borderRadius: 12, fontFamily: 'inherit',
                      border: `2px solid ${closed ? 'rgba(255,255,255,0.06)' : active ? '#38d9f5' : 'rgba(255,255,255,0.12)'}`,
                      background: closed ? 'rgba(255,255,255,0.02)' : active ? 'rgba(56,217,245,0.1)' : 'rgba(255,255,255,0.03)',
                      color: closed ? 'rgba(255,255,255,0.2)' : active ? '#38d9f5' : 'rgba(255,255,255,0.65)',
                      cursor: closed ? 'not-allowed' : 'pointer',
                      fontWeight: 700, fontSize: 13, transition: 'all 0.15s',
                    }}>
                    <div>{d.draw_time}</div>
                    {closed
                      ? <div style={{ fontSize: 10, marginTop: 3, color: '#ef4444', fontWeight: 700 }}>CLOSED</div>
                      : <div style={{ fontSize: 10, marginTop: 3, opacity: 0.5 }}>Open</div>}
                  </button>
                );
              })}
            </div>

            {/* ── Bet Type ── */}
            <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.2 }}>
              Bet Type
            </label>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              {['straight', 'rambolito'].map(t => {
                const active = betType === t;
                const disabled = t === 'rambolito' && !allUnique;
                const accentColor = t === 'straight' ? '#38d9f5' : '#a78bfa';
                return (
                  <button key={t} type="button"
                    style={{
                      flex: 1, padding: '13px 8px', borderRadius: 14,
                      border: `2px solid ${active ? accentColor : 'rgba(255,255,255,0.09)'}`,
                      background: active ? `${accentColor}18` : 'rgba(255,255,255,0.02)',
                      color: active ? accentColor : disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.55)',
                      fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
                      fontSize: 14, fontFamily: 'inherit', transition: 'all 0.15s',
                    }}
                    onClick={() => !disabled && setBetType(t)}
                    disabled={disabled}
                  >
                    {t === 'straight' ? '🎯 Straight' : '🔀 Rambolito'}
                    <div style={{ fontSize: 11, fontWeight: 500, marginTop: 3, opacity: 0.65 }}>
                      {t === 'straight' ? 'Exact order · ₱4,500/₱10' : (!allUnique ? 'need 3 diff digits' : 'Any order · ₱1,500/₱10')}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ── Amount ── */}
            <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.2 }}>
              Bet Amount (₱)
            </label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              {QUICK_AMOUNTS.map(a => {
                const active = amount === a;
                return (
                  <button key={a} type="button"
                    style={{
                      padding: '8px 14px', borderRadius: 10,
                      border: `2px solid ${active ? '#fbbf24' : 'rgba(255,255,255,0.09)'}`,
                      background: active ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.02)',
                      fontWeight: 700, cursor: 'pointer',
                      color: active ? '#fbbf24' : 'rgba(255,255,255,0.55)',
                      fontSize: 14, fontFamily: 'inherit', transition: 'all 0.12s',
                    }}
                    onClick={() => setAmount(a)}>₱{a}
                  </button>
                );
              })}
            </div>
            <input
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 12,
                border: '1.5px solid rgba(255,255,255,0.12)',
                fontSize: 15, marginBottom: 20, fontFamily: 'inherit',
                background: 'rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.85)', outline: 'none',
              }}
              type="number" min={5} step={5} value={amount}
              onChange={e => setAmount(parseInt(e.target.value) || 5)} />

            {/* ── Potential prize ── */}
            <div style={{
              background: 'rgba(251,191,36,0.07)',
              border: '1.5px solid rgba(251,191,36,0.22)',
              borderRadius: 16, padding: '16px 18px', marginBottom: 22,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontWeight: 700, color: 'rgba(251,191,36,0.65)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2 }}>
                  🏆 Potential Prize
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', marginTop: 3 }}>
                  {betType === 'straight' ? '₱4,500 per ₱10 · exact order' : '₱1,500 per ₱10 · any order'}
                </div>
              </div>
              <div className="prize-glow-text" style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1 }}>
                ₱{prize.toLocaleString()}
              </div>
            </div>

            <button
              className={loading ? '' : 'neon-cta-btn'}
              style={{
                width: '100%', padding: '17px 16px',
                background: loading ? 'rgba(51,65,85,0.8)' : undefined,
                color: loading ? 'rgba(255,255,255,0.38)' : undefined,
                border: loading ? '1px solid rgba(255,255,255,0.08)' : 'none',
                borderRadius: 14,
                fontSize: 16, fontWeight: 900,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', letterSpacing: 0.3,
                transition: 'all 0.15s',
              }}
              disabled={loading}>
              {loading ? 'Placing bet…' : `🎯 BET ₱${amount} — WIN UP TO ₱${prize.toLocaleString()}`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}


