import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const STATUS_STYLE = {
  won:     { bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.28)', color: '#34d399', label: '🏆 WON'     },
  lost:    { bg: 'rgba(239,68,68,0.07)',  border: 'rgba(239,68,68,0.18)',  color: '#f87171', label: '✗ LOST'     },
  pending: { bg: 'rgba(251,191,36,0.07)', border: 'rgba(251,191,36,0.2)',  color: '#fbbf24', label: '⏳ PENDING' },
};

function pad(n) { return String(n).padStart(2, '0'); }

function calcCountdown() {
  const now = new Date();
  const ph = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  const h = ph.getHours(), m = ph.getMinutes(), s = ph.getSeconds();
  const nowSecs = h * 3600 + m * 60 + s;
  const drawTimes = [
    { hour: 14, label: '2:00 PM' },
    { hour: 17, label: '5:00 PM' },
    { hour: 21, label: '9:00 PM' },
  ];
  for (const d of drawTimes) {
    const drawSecs = d.hour * 3600;
    if (drawSecs > nowSecs) {
      const diff = drawSecs - nowSecs;
      return { h: Math.floor(diff / 3600), m: Math.floor((diff % 3600) / 60), s: diff % 60, drawTime: d.label, hasDraw: true };
    }
  }
  return { h: 0, m: 0, s: 0, drawTime: '', hasDraw: false };
}

export default function Dashboard() {
  const { user, refreshUser } = useAuth();
  const [draws, setDraws] = useState([]);
  const [recentBets, setRecentBets] = useState([]);
  const [countdown, setCountdown] = useState(() => calcCountdown());
  const [winAlerts, setWinAlerts] = useState([]);

  useEffect(() => {
    refreshUser();
    api.get('/draws/recent').then(r => setDraws(r.data.draws.slice(0, 3)));
    api.get('/bets?limit=20').then(r => {
      const bets = r.data.bets || [];
      setRecentBets(bets.slice(0, 5));

      // Check for unseen wins using localStorage
      const seenKey = 'swertres_seen_wins';
      const seen = JSON.parse(localStorage.getItem(seenKey) || '[]');
      const newWins = bets.filter(b => b.status === 'won' && !seen.includes(b.id));
      if (newWins.length > 0) {
        setWinAlerts(newWins);
        // Mark them as seen
        localStorage.setItem(seenKey, JSON.stringify([...seen, ...newWins.map(b => b.id)]));
      }
    });
  }, []);

  useEffect(() => {
    const t = setInterval(() => setCountdown(calcCountdown()), 1000);
    return () => clearInterval(t);
  }, []);

  const firstName = user?.name?.split(' ')[0] || 'Bettor';

  return (
    <div className="animate-fadeInUp">

      {/* ── Win notification banners ─── */}
      {winAlerts.map(w => (
        <div key={w.id} style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(5,150,105,0.2) 100%)',
          border: '1.5px solid rgba(52,211,153,0.4)',
          borderRadius: 18, padding: '16px 18px', marginBottom: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
        }}>
          <div>
            <div style={{ fontSize: 20, marginBottom: 3 }}>🎉 You Won!</div>
            <div style={{ color: '#34d399', fontWeight: 900, fontSize: 22 }}>
              +₱{parseFloat(w.prize_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
              {w.numbers} · {w.draw_time} · {w.draw_date}
            </div>
          </div>
          <button onClick={() => setWinAlerts(a => a.filter(x => x.id !== w.id))} style={{
            background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)',
            color: '#34d399', borderRadius: 8, padding: '6px 14px',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
          }}>Dismiss</button>
        </div>
      ))}

      {/* ── Hero: Balance + Countdown ─── */}      <div style={{
        background: 'linear-gradient(140deg, #0a1628 0%, #0f2257 45%, #0c1d50 100%)',
        borderRadius: 24,
        padding: '24px 22px',
        marginBottom: 14,
        boxShadow: '0 8px 40px rgba(0,0,0,0.55)',
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.07)',
      }}>
        {/* Decorative glow blobs */}
        <div style={{ position:'absolute', top:-50, right:-50, width:180, height:180, background:'radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)', borderRadius:'50%', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-40, left:-40, width:140, height:140, background:'radial-gradient(circle, rgba(251,191,36,0.07) 0%, transparent 70%)', borderRadius:'50%', pointerEvents:'none' }} />

        {/* Greeting + balance */}
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 2 }}>
          Kumusta, {firstName}! 👋
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>
          Available Balance
        </div>
        <div style={{ fontSize: 44, fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: -1, marginBottom: 22 }}>
          ₱{parseFloat(user?.balance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
        </div>

        {/* Countdown + Deposit row */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {countdown.hasDraw ? (
            <div style={{ flex: 1, minWidth: 190 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                <span className="live-dot" />
                <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                  Next Draw · {countdown.drawTime}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {[{ v: countdown.h, l: 'HRS' }, { v: countdown.m, l: 'MIN' }, { v: countdown.s, l: 'SEC' }].map(({ v, l }) => (
                  <div key={l} className="countdown-box">
                    <div className="countdown-num">{pad(v)}</div>
                    <div className="countdown-lbl">{l}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
              🌙 All draws done for today.<br />Come back tomorrow!
            </div>
          )}
          <Link to="/wallet" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'linear-gradient(90deg, #fbbf24, #f59e0b)',
            color: '#1a0900', fontWeight: 800, fontSize: 13,
            padding: '11px 20px', borderRadius: 12,
            textDecoration: 'none',
            boxShadow: '0 4px 16px rgba(251,191,36,0.35)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>
            + Deposit
          </Link>
        </div>
      </div>

      {/* ── Jackpot teaser + BET NOW ─── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(251,191,36,0.07) 0%, rgba(217,119,6,0.1) 100%)',
        border: '1px solid rgba(251,191,36,0.22)',
        borderRadius: 20,
        padding: '18px 20px',
        marginBottom: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(251,191,36,0.6)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 5 }}>
            3-Digit Jackpot
          </div>
          <div className="prize-glow-text" style={{ fontSize: 30, fontWeight: 900, lineHeight: 1 }}>
            WIN ₱4,500
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', fontWeight: 500, marginTop: 4 }}>
            for just ₱10 · Straight bet
          </div>
        </div>
        <Link to="/bet" className="neon-cta-btn" style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: '14px 26px', borderRadius: 14, fontSize: 16,
          flexShrink: 0,
        }}>
          ⚡ BET NOW
        </Link>
      </div>

      {/* ── Latest PCSO results ────────── */}
      {draws.length > 0 && (
        <div className="dark-card">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14 }}>
            🎯 Latest PCSO 3D Results
          </div>
          {draws.map(d => (
            <div key={d.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'inline-flex', background: 'rgba(251,191,36,0.1)', color: '#fbbf24', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, marginBottom: 10, border: '1px solid rgba(251,191,36,0.2)' }}>
                {d.draw_date} · {d.draw_time}
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {d.winning_numbers.split('-').map((n, i) => (
                  <div key={i} className="lotto-ball">{n}</div>
                ))}
              </div>
            </div>
          ))}
          <Link to="/results" style={{ color: '#38d9f5', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            View all results →
          </Link>
        </div>
      )}

      {/* ── Recent bets ─────────────────── */}
      {recentBets.length > 0 && (
        <div className="dark-card">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14 }}>
            📋 My Recent Bets
          </div>
          {recentBets.map(b => {
            const st = STATUS_STYLE[b.status] || STATUS_STYLE.pending;
            const potentialPrize = ((parseFloat(b.amount) / 10) * 4500).toLocaleString();
            return (
              <div key={b.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px', borderRadius: 14, marginBottom: 8,
                background: st.bg,
                border: `1px solid ${st.border}`,
              }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 4, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                    {b.numbers}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 3 }}>
                    {b.draw_date} · {b.draw_time} · {b.bet_type}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: 'rgba(255,255,255,0.8)' }}>
                    ₱{parseFloat(b.amount).toFixed(2)}
                  </div>
                  {b.status === 'won' && (
                    <div style={{ color: '#34d399', fontWeight: 800, fontSize: 13 }}>
                      +₱{parseFloat(b.prize_amount).toFixed(2)}
                    </div>
                  )}
                  {b.status === 'pending' && (
                    <div style={{ fontSize: 11, color: 'rgba(251,191,36,0.75)', fontWeight: 600 }}>
                      could win ₱{potentialPrize}
                    </div>
                  )}
                  <span style={{ background: 'rgba(0,0,0,0.3)', color: st.color, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, display: 'inline-block', marginTop: 3 }}>
                    {st.label}
                  </span>
                </div>
              </div>
            );
          })}
          <Link to="/my-bets" style={{ color: '#38d9f5', fontSize: 13, fontWeight: 700, display: 'block', marginTop: 10, textDecoration: 'none' }}>
            View all bets →
          </Link>
        </div>
      )}
    </div>
  );
}


