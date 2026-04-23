import React, { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

const STATUS = {
  won:       { cls: 'bet-card-won',     color: '#34d399', label: '🏆 WON'       },
  lost:      { cls: 'bet-card-lost',    color: '#f87171', label: '✗ LOST'       },
  pending:   { cls: 'bet-card-pending', color: '#fbbf24', label: '⏳ PENDING'   },
  cancelled: { cls: 'bet-card-lost',    color: '#9ca3af', label: '✕ CANCELLED'  },
};

const FILTERS = ['all', 'pending', 'won', 'lost'];
const FILTER_LABELS = { all: 'All', pending: '⏳ Pending', won: '🏆 Won', lost: '✗ Lost' };

// Draw cutoffs (PH time) — same as backend
const CUTOFFS = { '2PM': { h: 13, m: 30 }, '5PM': { h: 16, m: 30 }, '9PM': { h: 20, m: 30 } };
function isBeforeCutoff(drawDate, drawTime) {
  const c = CUTOFFS[drawTime];
  if (!c) return false;
  const now = new Date();
  const [y, mo, d] = drawDate.split('-').map(Number);
  const cutoff = new Date(y, mo - 1, d, c.h, c.m, 0);
  // Convert to PH time (UTC+8)
  const phNow = new Date(now.getTime() + (8 * 60 - now.getTimezoneOffset()) * 60000);
  const phCutoff = new Date(cutoff.getTime());
  return phNow < phCutoff;
}

export default function MyBets() {
  const [bets, setBets] = useState([]);
  const [filter, setFilter] = useState('all');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(null);
  const LIMIT = 20;

  const fetchBets = () => {
    setLoading(true);
    const params = { page, limit: LIMIT };
    if (filter !== 'all') params.status = filter;
    api.get('/bets', { params }).then(r => {
      setBets(r.data.bets);
      setTotal(r.data.total);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchBets(); }, [filter, page]); // eslint-disable-line

  const handleCancel = async (bet) => {
    if (!window.confirm(`Cancel bet ${bet.numbers} (${bet.draw_time})? ₱${parseFloat(bet.amount).toFixed(2)} will be refunded.`)) return;
    setCancelling(bet.id);
    try {
      const { data } = await api.patch(`/bets/${bet.id}/cancel`);
      toast.success(data.message);
      fetchBets();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel bet.');
    } finally {
      setCancelling(null);
    }
  };

  return (
    <div className="animate-fadeInUp">
      <div className="dark-card">
        <div style={{ fontSize: 22, fontWeight: 900, color: 'rgba(255,255,255,0.9)', marginBottom: 16 }}>My Bets</div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {FILTERS.map(f => {
            const active = filter === f;
            return (
              <button key={f}
                style={{
                  padding: '7px 16px', borderRadius: 20,
                  border: `2px solid ${active ? '#38d9f5' : 'rgba(255,255,255,0.1)'}`,
                  background: active ? 'rgba(56,217,245,0.1)' : 'rgba(255,255,255,0.02)',
                  color: active ? '#38d9f5' : 'rgba(255,255,255,0.45)',
                  fontWeight: 700, cursor: 'pointer', fontSize: 13,
                  fontFamily: 'inherit', transition: 'all 0.15s',
                }}
                onClick={() => { setFilter(f); setPage(1); }}>
                {FILTER_LABELS[f]}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)' }}>Loading…</div>
        ) : bets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)' }}>No bets found.</div>
        ) : (
          bets.map(b => {
            const st = STATUS[b.status] || STATUS.pending;
            const potentialPrize = ((parseFloat(b.amount) / 10) * 4500).toLocaleString();
            return (
              <div key={b.id} className={st.cls}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 5, color: '#fff', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                      {b.numbers}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 5 }}>
                      {b.draw_date} · {b.draw_time} · <span style={{ textTransform: 'capitalize' }}>{b.bet_type}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: 'rgba(255,255,255,0.8)' }}>
                      ₱{parseFloat(b.amount).toFixed(2)}
                    </div>
                    {b.status === 'won' && (
                      <div style={{ color: '#34d399', fontWeight: 800, fontSize: 15 }}>
                        +₱{parseFloat(b.prize_amount).toFixed(2)}
                      </div>
                    )}
                    {b.status === 'pending' && (
                      <div style={{ fontSize: 11, color: 'rgba(251,191,36,0.78)', fontWeight: 600 }}>
                        🏆 could win ₱{potentialPrize}
                      </div>
                    )}
                    <span style={{
                      background: 'rgba(0,0,0,0.28)',
                      color: st.color,
                      padding: '3px 10px', borderRadius: 20,
                      fontSize: 11, fontWeight: 700,
                      display: 'inline-block', marginTop: 4,
                    }}>
                      {st.label}
                    </span>
                  </div>
                </div>
                {b.status === 'pending' && isBeforeCutoff(b.draw_date, b.draw_time) && (
                  <div style={{ marginTop: 10, textAlign: 'right' }}>
                    <button
                      onClick={() => handleCancel(b)}
                      disabled={cancelling === b.id}
                      style={{
                        background: 'rgba(239,68,68,0.12)',
                        border: '1px solid rgba(239,68,68,0.35)',
                        color: '#f87171',
                        borderRadius: 8,
                        padding: '5px 14px',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: cancelling === b.id ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit',
                        opacity: cancelling === b.id ? 0.5 : 1,
                      }}
                    >
                      {cancelling === b.id ? 'Cancelling…' : '✕ Cancel Bet'}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}

        {total > LIMIT && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, marginTop: 18 }}>
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              style={{
                padding: '8px 18px', borderRadius: 10,
                border: '1.5px solid rgba(255,255,255,0.1)',
                cursor: page === 1 ? 'not-allowed' : 'pointer',
                fontWeight: 700, background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.6)',
                fontFamily: 'inherit', opacity: page === 1 ? 0.3 : 1,
              }}>
              ← Prev
            </button>
            <span style={{ color: 'rgba(255,255,255,0.38)', fontWeight: 600, fontSize: 14 }}>Page {page}</span>
            <button disabled={page * LIMIT >= total} onClick={() => setPage(p => p + 1)}
              style={{
                padding: '8px 18px', borderRadius: 10,
                border: '1.5px solid rgba(255,255,255,0.1)',
                cursor: page * LIMIT >= total ? 'not-allowed' : 'pointer',
                fontWeight: 700, background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.6)',
                fontFamily: 'inherit', opacity: page * LIMIT >= total ? 0.3 : 1,
              }}>
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

