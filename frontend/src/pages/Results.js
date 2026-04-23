import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

const DRAW_SCHEDULE = [
  { time: '2PM', hour: 14 },
  { time: '5PM', hour: 17 },
  { time: '9PM', hour: 21 },
];

function getManilaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
}

function getManilaDate() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
}

function getNextDraw() {
  const m = getManilaDate();
  const nowMin = m.getHours() * 60 + m.getMinutes();
  for (const d of DRAW_SCHEDULE) {
    if (nowMin < d.hour * 60) {
      const diff = d.hour * 60 - nowMin;
      const h = Math.floor(diff / 60);
      const min = diff % 60;
      return { label: d.time, text: h > 0 ? `${h}h ${min}m` : `${min}m` };
    }
  }
  return null;
}

export default function Results() {
  const [draws, setDraws] = useState([]);
  const [date, setDate] = useState(getManilaToday);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [nextDraw, setNextDraw] = useState(getNextDraw);
  const intervalRef = useRef(null);

  const today = getManilaToday();
  const minDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const load = useCallback((d, silent = false) => {
    if (!silent) setLoading(true);
    api.get(`/draws?date=${d}`)
      .then(r => { setDraws(r.data.draws); setLastUpdated(new Date()); })
      .catch(() => setDraws([]))
      .finally(() => { if (!silent) setLoading(false); });
  }, []);

  // Load on date change; auto-poll every 2 min when viewing today
  useEffect(() => {
    load(date);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (date === getManilaToday()) {
      intervalRef.current = setInterval(() => {
        load(date, true);
        setNextDraw(getNextDraw());
      }, 2 * 60 * 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [date, load]);

  // Update next-draw countdown every minute
  useEffect(() => {
    const t = setInterval(() => setNextDraw(getNextDraw()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const isToday = date === today;

  return (
    <div className="animate-fadeInUp">

      <div className="dark-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'rgba(255,255,255,0.9)' }}>
            📋 PCSO 3D Results
          </div>
          {isToday && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: 'rgba(239,68,68,0.15)', color: '#f87171',
                padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                border: '1px solid rgba(239,68,68,0.3)',
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                LIVE
              </span>
              {nextDraw && (
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                  Next: {nextDraw.label} in {nextDraw.text}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Date picker */}
        <div className="results-search-row" style={{ display: 'flex', marginBottom: 20, gap: 10 }}>
          <input
            style={{
              flex: 1, minWidth: 140, padding: '11px 14px', borderRadius: 12,
              border: '1.5px solid rgba(255,255,255,0.12)', fontSize: 15,
              fontFamily: 'inherit', background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.85)', outline: 'none', colorScheme: 'dark',
            }}
            type="date" value={date} min={minDate} max={today}
            onChange={e => setDate(e.target.value)} />
          <button
            style={{
              padding: '11px 22px',
              background: 'linear-gradient(90deg,#1d4ed8,#2563eb)',
              color: '#fff', border: 'none', borderRadius: 12,
              fontWeight: 700, cursor: 'pointer', fontSize: 14,
              fontFamily: 'inherit',
              boxShadow: '0 3px 14px rgba(37,99,235,0.35)',
            }}
            onClick={() => load(date)}>Search
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)' }}>Loading…</div>
        ) : draws.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)' }}>
            {isToday
              ? 'Draw results will appear here after each draw (2PM, 5PM, 9PM).'
              : 'No results found for this date.'}
          </div>
        ) : (
          draws.map(d => (
            <div key={d.id} style={{
              padding: '18px 0',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', gap: 12,
            }}>
              <div>
                <div style={{
                  display: 'inline-flex', background: 'rgba(251,191,36,0.1)',
                  color: '#fbbf24', padding: '3px 12px', borderRadius: 20,
                  fontSize: 12, fontWeight: 700, marginBottom: 6,
                  border: '1px solid rgba(251,191,36,0.22)',
                }}>
                  {d.draw_time} Draw
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                  {d.draw_date} · {d.winners_count} {d.winners_count === 1 ? 'winner' : 'winners'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {d.winning_numbers.split('-').map((n, i) => (
                  <div key={i} className="lotto-ball-lg">{n}</div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Prize table */}
      <div className="dark-card">
        <div style={{ fontSize: 16, fontWeight: 800, color: 'rgba(255,255,255,0.85)', marginBottom: 16 }}>
          💰 How Prizes Work
        </div>
        <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
          <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(30,64,175,0.35)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: 'rgba(255,255,255,0.75)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  Bet Type
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'rgba(255,255,255,0.75)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  Prize per ₱10
                </th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.65)' }}>🎯 Straight (exact order)</td>
                <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 900, fontSize: 18 }} className="prize-glow-text">
                  ₱4,500
                </td>
              </tr>
              <tr>
                <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.65)' }}>🔀 Rambolito (any order)</td>
                <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 900, color: '#a78bfa', fontSize: 16 }}>
                  ₱750–₱1,500
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
