import React, { useEffect, useState, useMemo } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

const DRAW_TIMES = ['2PM', '5PM', '9PM'];
const STRAIGHT_PAYOUT = 4500;
const RAMBOLITO_PAYOUT = 750;

const S = {
  card:   { background: '#fff', borderRadius: 20, padding: 20, marginBottom: 14, boxShadow: '0 4px 24px rgba(0,0,0,0.12)' },
  title:  { fontSize: 20, fontWeight: 800, color: '#1e40af', marginBottom: 16 },
  input:  { padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, flex: 1, fontFamily: 'inherit' },
  btn:    { padding: '10px 18px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  row:    { padding: '10px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  toggle: (on) => ({ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, background: on ? '#dcfce7' : '#fef2f2', color: on ? '#166534' : '#dc2626', fontSize: 13, fontFamily: 'inherit', whiteSpace: 'nowrap' }),
  tab:    (on) => ({ padding: '8px 18px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, borderRadius: '8px 8px 0 0', background: on ? '#1e40af' : '#e2e8f0', color: on ? '#fff' : '#64748b', fontFamily: 'inherit', whiteSpace: 'nowrap' }),
};

function Digit({ n }) {
  return <span className="lotto-ball" style={{ width: 28, height: 28, fontSize: 13 }}>{n}</span>;
}
function Num({ numbers }) {
  return <span style={{ display: 'inline-flex', gap: 4 }}>{numbers.split('-').map((n, i) => <Digit key={i} n={n} />)}</span>;
}

export default function Admin() {
  const [stats, setStats]           = useState({});
  const [users, setUsers]           = useState([]);
  const [search, setSearch]         = useState('');
  const [creditUser, setCreditUser] = useState(null);
  const [creditAmt, setCreditAmt]   = useState('');
  const [allBets, setAllBets]       = useState([]);
  const [drawDate, setDrawDate]     = useState(new Date().toISOString().slice(0, 10));
  const [activeTab, setActiveTab]   = useState('2PM');
  const [expanded, setExpanded]     = useState(null);
  const [numSearch, setNumSearch]   = useState('');
  const [sortBy, setSortBy]         = useState('total');
  const [winners, setWinners]       = useState({});
  const [tallyPage, setTallyPage]   = useState('0'); // first digit 0-9
  const [showAll, setShowAll]       = useState(false); // toggle all 1000 vs bets-only

  // Winners payout section
  const [payoutDate, setPayoutDate]     = useState(new Date().toISOString().slice(0, 10));
  const [payoutTab, setPayoutTab]       = useState('2PM');
  const [drawWinners, setDrawWinners]   = useState(null);
  const [drawResults, setDrawResults]   = useState([]);
  const [pendingByTime, setPendingByTime] = useState({});
  const [processing, setProcessing]     = useState(false);

  // Bet limits
  const [limitsTab, setLimitsTab]       = useState('2PM');
  const [limits, setLimits]             = useState([]);
  const [limitForm, setLimitForm]       = useState({ numbers: '', max_amount: 500, is_blocked: false });
  const [savingLimit, setSavingLimit]   = useState(false);

  // Manual draw entry
  const [drawEntryDate, setDrawEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [drawEntryTime, setDrawEntryTime] = useState('2PM');
  const [drawEntryNums, setDrawEntryNums] = useState('');
  const [savingDraw, setSavingDraw]       = useState(false);

  // Withdrawals
  const [withdrawals, setWithdrawals]     = useState([]);
  const [wdFilter, setWdFilter]           = useState('pending');
  const [wdNote, setWdNote]               = useState({});

  // Deposits
  const [deposits, setDeposits]     = useState([]);
  const [depFilter, setDepFilter]   = useState('pending');
  const [depNote, setDepNote]       = useState({});

  const loadStats = () => api.get('/admin/dashboard').then(r => setStats(r.data));

  useEffect(() => {
    loadStats();
    api.get('/admin/users').then(r => setUsers(r.data.users || []));
    api.get(`/admin/bets?draw_date=${drawDate}&limit=500`).then(r => setAllBets(r.data.bets || []));
    api.get('/admin/bet-limits').then(r => setLimits(r.data.limits || []));
    api.get('/admin/withdrawals?status=pending').then(r => setWithdrawals(r.data.withdrawals || []));
    api.get('/admin/deposits?status=pending').then(r => setDeposits(r.data.deposits || []));
    // Auto-refresh stats every 60 seconds
    const interval = setInterval(loadStats, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadBets = () => {
    api.get(`/admin/bets?draw_date=${drawDate}&limit=500`).then(r => {
      setAllBets(r.data.bets || []);
      setExpanded(null);
      setNumSearch('');
    });
  };

  const toggleUser  = async (u) => {
    try {
      await api.patch(`/admin/users/${u.id}/toggle`);
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: !x.is_active } : x));
      toast.success(`User ${u.is_active ? 'disabled' : 'enabled'}.`);
    } catch { toast.error('Failed.'); }
  };
  const doCredit = async (uid) => {
    if (!creditAmt || parseFloat(creditAmt) <= 0) return toast.error('Enter valid amount.');
    try {
      const { data } = await api.post('/admin/credit', { user_id: uid, amount: parseFloat(creditAmt), note: 'Manual cash deposit' });
      toast.success(data.message);
      setCreditUser(null); setCreditAmt('');
    } catch (err) { toast.error(err.response?.data?.message || 'Credit failed.'); }
  };

  const loadDrawWinners = () => {
    setDrawWinners('loading');
    api.get(`/admin/draw-winners?draw_date=${payoutDate}`)
      .then(r => {
        setDrawWinners(r.data.winners || []);
        setDrawResults(r.data.draws || []);
        setPendingByTime(r.data.pending_by_time || {});
      })
      .catch(() => setDrawWinners([]));
  };

  const processDraw = async (draw_time) => {
    setProcessing(draw_time);
    try {
      const { data } = await api.post('/admin/process-draw', { draw_date: payoutDate, draw_time });
      toast.success(data.message);
      loadDrawWinners(); // refresh
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to process draw.');
    } finally {
      setProcessing(false);
    }
  };

  const loadWithdrawals = (status) => {
    const s = status ?? wdFilter;
    api.get(`/admin/withdrawals?status=${s}`).then(r => setWithdrawals(r.data.withdrawals || []));
  };

  const processWithdrawal = async (id, action) => {
    try {
      await api.patch(`/admin/withdrawals/${id}`, { action, note: wdNote[id] || '' });
      toast.success(`Withdrawal ${action}.`);
      loadWithdrawals();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
  };

  const loadDeposits = (status) => {
    const s = status ?? depFilter;
    api.get(`/admin/deposits?status=${s}`).then(r => setDeposits(r.data.deposits || []));
  };

  const processDeposit = async (id, action) => {
    try {
      await api.patch(`/admin/deposits/${id}`, { action, note: depNote[id] || '' });
      toast.success(`Deposit ${action === 'paid' ? 'approved — balance credited!' : 'rejected.'}`);
      loadDeposits();
      loadStats();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
  };

  const saveLimit = async () => {
    if (!limitForm.numbers.trim()) return toast.error('Enter a number.');
    const nums = limitForm.numbers.trim().replace(/\s/g, '');
    const formatted = nums.includes('-') ? nums : `${nums[0]}-${nums[1]}-${nums[2]}`;
    if (!/^\d-\d-\d$/.test(formatted)) return toast.error('Format must be D-D-D (e.g. 1-2-3).');
    setSavingLimit(true);
    try {
      await api.post('/admin/bet-limits', { draw_time: limitsTab, numbers: formatted, max_amount: parseFloat(limitForm.max_amount) || 500, is_blocked: limitForm.is_blocked });
      toast.success('Limit saved.');
      const r = await api.get('/admin/bet-limits');
      setLimits(r.data.limits || []);
      setLimitForm({ numbers: '', max_amount: 500, is_blocked: false });
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    finally { setSavingLimit(false); }
  };

  const deleteLimit = async (id) => {
    await api.delete(`/admin/bet-limits/${id}`);
    setLimits(prev => prev.filter(l => l.id !== id));
    toast.success('Limit removed.');
  };

  const saveDraw = async () => {
    const nums = drawEntryNums.trim().replace(/\s/g, '');
    const formatted = nums.includes('-') ? nums : `${nums[0]}-${nums[1]}-${nums[2]}`;
    if (!/^\d-\d-\d$/.test(formatted)) return toast.error('Format must be D-D-D (e.g. 6-2-8).');
    setSavingDraw(true);
    try {
      await api.post('/admin/draw-result', { draw_date: drawEntryDate, draw_time: drawEntryTime, winning_numbers: formatted });
      // Automatically process winners right after saving
      const { data: wd } = await api.post('/admin/process-draw', { draw_date: drawEntryDate, draw_time: drawEntryTime });
      toast.success(`Result saved & winners processed. ${wd.winners_count ?? 0} winner(s) paid.`);
      setDrawEntryNums('');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    finally { setSavingDraw(false); }
  };

  const handleExpand = (numbers) => {
    const isOpen = expanded === numbers;
    setExpanded(isOpen ? null : numbers);
    if (!isOpen && !winners[numbers]) {
      setWinners(prev => ({ ...prev, [numbers]: 'loading' }));
      api.get(`/admin/winners?numbers=${encodeURIComponent(numbers)}`)
        .then(r => setWinners(prev => ({ ...prev, [numbers]: r.data.winners || [] })))
        .catch(() => setWinners(prev => ({ ...prev, [numbers]: [] })));
    }
  };

  // Per-draw totals for tab badges
  const drawTotals = useMemo(() => DRAW_TIMES.reduce((acc, t) => {
    const tb = allBets.filter(b => b.draw_time === t);
    acc[t] = { count: tb.length, total: tb.reduce((s, b) => s + parseFloat(b.amount), 0) };
    return acc;
  }, {}), [allBets]);

  // Bets for active tab
  const tabBets = useMemo(() => allBets.filter(b => b.draw_time === activeTab), [allBets, activeTab]);

  // Group by number → tally rows
  const grouped = useMemo(() => {
    const g = {};
    for (const b of tabBets) {
      if (!g[b.numbers]) g[b.numbers] = { numbers: b.numbers, straightAmt: 0, ramboAmt: 0, total: 0, bettors: [] };
      const amt = parseFloat(b.amount);
      if (b.bet_type === 'straight') g[b.numbers].straightAmt += amt;
      else                           g[b.numbers].ramboAmt   += amt;
      g[b.numbers].total += amt;
      g[b.numbers].bettors.push(b);
    }
    return g;
  }, [tabBets]);

  const payout = (row) =>
    (row.straightAmt / 10) * STRAIGHT_PAYOUT + (row.ramboAmt / 10) * RAMBOLITO_PAYOUT;

  // All 1000 combinations merged with actual bets
  const all1000 = useMemo(() => {
    const list = [];
    for (let i = 0; i <= 999; i++) {
      const d1 = Math.floor(i / 100);
      const d2 = Math.floor((i % 100) / 10);
      const d3 = i % 10;
      const key = `${d1}-${d2}-${d3}`;
      const bet = grouped[key];
      list.push(bet ? bet : { numbers: key, straightAmt: 0, ramboAmt: 0, total: 0, bettors: [] });
    }
    return list;
  }, [grouped]);

  // Filter + sort
  const rows = useMemo(() => {
    let list = showAll ? all1000 : Object.values(grouped);
    if (numSearch.trim()) {
      const q = numSearch.trim().replace(/\s+/g, '-');
      // Allow plain 3-digit input like '153'
      const plain = q.replace(/-/g, '');
      list = list.filter(r => r.numbers.includes(q) || r.numbers.replace(/-/g, '').includes(plain));
    } else if (showAll) {
      // When showing all 1000, filter by selected first digit page
      list = list.filter(r => r.numbers.startsWith(tallyPage + '-'));
    }
    if (sortBy === 'number') list.sort((a, b) => a.numbers.localeCompare(b.numbers));
    else if (sortBy === 'payout') list.sort((a, b) => payout(b) - payout(a));
    else list.sort((a, b) => b.total - a.total);
    return list;
  }, [grouped, all1000, numSearch, sortBy, showAll, tallyPage]);

  const totalCollected   = tabBets.reduce((s, b) => s + parseFloat(b.amount), 0);
  const totalPayoutRisk  = rows.reduce((s, r) => s + payout(r), 0);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => u.name?.toLowerCase().includes(q) || u.phone?.includes(q));
  }, [users, search]);

  const riskColor = (p) => p > 20000 ? '#dc2626' : p > 8000 ? '#d97706' : '#16a34a';
  const riskBg    = (p) => p > 20000 ? '#fef2f2' : p > 8000 ? '#fffbeb' : '#f0fdf4';
  const riskBd    = (p) => p > 20000 ? '#fca5a5' : p > 8000 ? '#fcd34d' : '#86efac';

  return (
    <div className="animate-fadeInUp">
      {/* Stats */}
      <div style={S.card}>
        <div style={S.title}>⚙️ Admin Dashboard</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
          {[
            ['👥 Users', stats.total_users],
            ['🎲 Bets Today', stats.bets_today],
            ['💰 Deposits Today', `₱${parseFloat(stats.deposits_today || 0).toFixed(2)}`],
            ['📥 Pending Deposits', stats.pending_deposits ?? '—'],
            ['⏳ Pending Bets', stats.pending_bets],
          ].map(([l, v]) => (
            <div key={l} style={{ background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', borderRadius: 14, padding: '14px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#1e40af' }}>{v ?? '—'}</div>
              <div style={{ fontSize: 11, color: '#2563eb', fontWeight: 700, marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tally */}
      <div style={S.card}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={S.title}>📋 Number Tally</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...S.input, flex: 'none', width: 150 }} type="date" value={drawDate} onChange={e => setDrawDate(e.target.value)} />
            <button style={S.btn} onClick={loadBets}>Load</button>
          </div>
        </div>

        {/* Draw time tabs */}
        <div className="admin-tab-bar" style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e2e8f0', flexWrap: 'wrap' }}>
          {DRAW_TIMES.map(t => (
            <button key={t} style={S.tab(activeTab === t)} onClick={() => { setActiveTab(t); setExpanded(null); setNumSearch(''); }}>
              {t}
              {drawTotals[t]?.count > 0 &&
                <span style={{ marginLeft: 6, background: 'rgba(255,255,255,0.3)', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>
                  {drawTotals[t].count}
                </span>}
            </button>
          ))}
          <button
            style={{ ...S.tab(showAll), marginLeft: 'auto' }}
            onClick={() => { setShowAll(v => !v); setNumSearch(''); setTallyPage('0'); }}>
            {showAll ? '📊 All 1000' : '📊 All 1000'}
          </button>
        </div>

        {/* First-digit page tabs (only when showAll is active) */}
        {showAll && !numSearch.trim() && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: '8px 0 4px', borderBottom: '1px solid #e2e8f0' }}>
            {Array.from({ length: 10 }, (_, d) => String(d)).map(d => {
              const hasBets = all1000.some(r => r.numbers.startsWith(d + '-') && r.total > 0);
              return (
                <button key={d} onClick={() => setTallyPage(d)}
                  style={{
                    padding: '5px 12px', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 14,
                    borderRadius: 8, fontFamily: 'inherit',
                    background: tallyPage === d ? '#1e40af' : hasBets ? '#dbeafe' : '#f1f5f9',
                    color: tallyPage === d ? '#fff' : hasBets ? '#1d4ed8' : '#94a3b8',
                  }}>
                  {d}__
                  {hasBets && <span style={{ marginLeft: 3, fontSize: 10, background: tallyPage === d ? 'rgba(255,255,255,0.3)' : '#1e40af', color: '#fff', borderRadius: 8, padding: '0 5px' }}>
                    {all1000.filter(r => r.numbers.startsWith(d + '-') && r.total > 0).length}
                  </span>}
                </button>
              );
            })}
          </div>
        )}

        <div style={{ background: '#f8faff', borderRadius: '0 0 12px 12px', padding: 14 }}>
          {/* Summary totals */}
          {tabBets.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {[
                ['Unique Numbers', Object.keys(grouped).length, '#1e40af'],
                ['Total Bets', tabBets.length, '#1e40af'],
                ['Collected', `₱${totalCollected.toFixed(2)}`, '#16a34a'],
                ['Max Payout Risk', `₱${totalPayoutRisk.toLocaleString()}`, riskColor(totalPayoutRisk)],
              ].map(([l, v, c]) => (
                <div key={l} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', flex: 1, minWidth: 80 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: c }}>{v}</div>
                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>{l}</div>
                </div>
              ))}
            </div>
          )}

          {/* Search + sort controls */}
          {tabBets.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <input
                style={{ ...S.input, flex: 1, minWidth: 120, fontSize: 14, padding: '8px 12px' }}
                placeholder="Search number e.g. 1-2-3 or 123"
                value={numSearch}
                onChange={e => setNumSearch(e.target.value)}
              />
              <select style={{ padding: '8px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontWeight: 600, color: '#374151', fontFamily: 'inherit' }}
                value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="total">Highest Total</option>
                <option value="payout">Highest Risk</option>
                <option value="number">By Number</option>
              </select>
            </div>
          )}

          {!showAll && tabBets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8', fontSize: 15 }}>
              No bets for {activeTab} on {drawDate}. Pick a date and click Load.
            </div>
          ) : rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>No numbers match "{numSearch}"</div>
          ) : (
            <div className="scroll-x" style={{ borderRadius: 10 }}>
            <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0', minWidth: 560 }}>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 110px 110px 28px', background: '#1e40af', color: '#fff', padding: '10px 14px', fontSize: 12, fontWeight: 700, gap: 8, alignItems: 'center' }}>
                <span>NUMBER</span>
                <span style={{ textAlign: 'right' }}>STRAIGHT</span>
                <span style={{ textAlign: 'right' }}>RAMBOLITO</span>
                <span style={{ textAlign: 'right' }}>TOTAL BET</span>
                <span style={{ textAlign: 'right' }}>IF WINS</span>
                <span></span>
              </div>

              {rows.map((row, idx) => {
                const p = payout(row);
                const isOpen = expanded === row.numbers;
                return (
                  <React.Fragment key={row.numbers}>
                    {/* Main row */}
                    <div
                      onClick={() => handleExpand(row.numbers)}
                      style={{
                        display: 'grid', gridTemplateColumns: '120px 1fr 1fr 110px 110px 28px',
                        padding: '10px 14px', gap: 8, alignItems: 'center', cursor: 'pointer',
                        background: isOpen ? riskBg(p) : idx % 2 === 0 ? '#fff' : '#fafbff',
                        borderTop: '1px solid #e2e8f0',
                        borderLeft: `4px solid ${riskColor(p)}`,
                      }}>
                      <span><Num numbers={row.numbers} /></span>
                      <span style={{ textAlign: 'right', fontSize: 13 }}>
                        {row.straightAmt > 0
                          ? <><span style={{ fontWeight: 700 }}>₱{row.straightAmt.toFixed(2)}</span><br /><span style={{ fontSize: 11, color: '#64748b' }}>{row.bettors.filter(b => b.bet_type === 'straight').length} bet{row.bettors.filter(b => b.bet_type === 'straight').length !== 1 ? 's' : ''}</span></>
                          : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </span>
                      <span style={{ textAlign: 'right', fontSize: 13 }}>
                        {row.ramboAmt > 0
                          ? <><span style={{ fontWeight: 700 }}>₱{row.ramboAmt.toFixed(2)}</span><br /><span style={{ fontSize: 11, color: '#64748b' }}>{row.bettors.filter(b => b.bet_type !== 'straight').length} bet{row.bettors.filter(b => b.bet_type !== 'straight').length !== 1 ? 's' : ''}</span></>
                          : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </span>
                      <span style={{ textAlign: 'right', fontWeight: 900, fontSize: 15, color: '#16a34a' }}>₱{row.total.toFixed(2)}</span>
                      <span style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: riskColor(p) }}>₱{p.toLocaleString()}</span>
                      <span style={{ textAlign: 'center', fontSize: 14, color: '#94a3b8' }}>{isOpen ? '▲' : '▼'}</span>
                    </div>

                    {/* Expanded bettors + past winners */}
                    {isOpen && (
                      <div style={{ background: riskBg(p), borderLeft: `4px solid ${riskColor(p)}`, borderTop: `1px dashed ${riskBd(p)}` }}>
                        {/* Current bettors */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: 'rgba(30,64,175,0.07)' }}>
                              <th style={{ padding: '7px 14px', textAlign: 'left',   fontWeight: 700, color: '#374151' }}>#</th>
                              <th style={{ padding: '7px 8px',  textAlign: 'left',   fontWeight: 700, color: '#374151' }}>Name</th>
                              <th style={{ padding: '7px 8px',  textAlign: 'left',   fontWeight: 700, color: '#374151' }}>Phone</th>
                              <th style={{ padding: '7px 8px',  textAlign: 'center', fontWeight: 700, color: '#374151' }}>Type</th>
                              <th style={{ padding: '7px 8px',  textAlign: 'right',  fontWeight: 700, color: '#374151' }}>Amount</th>
                              <th style={{ padding: '7px 14px', textAlign: 'right',  fontWeight: 700, color: '#374151' }}>Payout</th>
                            </tr>
                          </thead>
                          <tbody>
                            {row.bettors.map((b, i) => {
                              const rate = b.bet_type === 'straight' ? STRAIGHT_PAYOUT : RAMBOLITO_PAYOUT;
                              const bp   = (parseFloat(b.amount) / 10) * rate;
                              return (
                                <tr key={b.id} style={{ borderTop: '1px solid rgba(0,0,0,0.06)', background: i % 2 === 0 ? 'rgba(255,255,255,0.7)' : 'transparent' }}>
                                  <td style={{ padding: '7px 14px', color: '#94a3b8', fontSize: 12 }}>{i + 1}</td>
                                  <td style={{ padding: '7px 8px',  fontWeight: 600 }}>{b.user?.name || '—'}</td>
                                  <td style={{ padding: '7px 8px',  color: '#64748b' }}>{b.user?.phone || '—'}</td>
                                  <td style={{ padding: '7px 8px',  textAlign: 'center' }}>
                                    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: b.bet_type === 'straight' ? '#dbeafe' : '#fef3c7', color: b.bet_type === 'straight' ? '#1d4ed8' : '#92400e' }}>
                                      {b.bet_type}
                                    </span>
                                  </td>
                                  <td style={{ padding: '7px 8px',  textAlign: 'right', fontWeight: 700 }}>₱{parseFloat(b.amount).toFixed(2)}</td>
                                  <td style={{ padding: '7px 14px', textAlign: 'right', fontWeight: 700, color: riskColor(bp) }}>₱{bp.toLocaleString()}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: 'rgba(30,64,175,0.1)', fontWeight: 800 }}>
                              <td colSpan={4} style={{ padding: '8px 14px', color: '#1e40af' }}>SUBTOTAL — {row.numbers}</td>
                              <td style={{ padding: '8px 8px',  textAlign: 'right', color: '#16a34a' }}>₱{row.total.toFixed(2)}</td>
                              <td style={{ padding: '8px 14px', textAlign: 'right', color: riskColor(p) }}>₱{p.toLocaleString()}</td>
                            </tr>
                          </tfoot>
                        </table>

                        {/* Past winners */}
                        <div style={{ borderTop: '2px solid #fbbf24', background: '#fffbeb', padding: '10px 14px' }}>
                          <div style={{ fontWeight: 800, fontSize: 13, color: '#92400e', marginBottom: 8 }}>🏆 Past Winners for {row.numbers}</div>
                          {winners[row.numbers] === 'loading' ? (
                            <div style={{ color: '#94a3b8', fontSize: 13, padding: '6px 0' }}>Loading…</div>
                          ) : !winners[row.numbers] || winners[row.numbers].length === 0 ? (
                            <div style={{ color: '#94a3b8', fontSize: 13, padding: '6px 0' }}>No past winners found for this number.</div>
                          ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                              <thead>
                                <tr style={{ background: 'rgba(245,158,11,0.15)' }}>
                                  <th style={{ padding: '5px 8px', textAlign: 'left',   fontWeight: 700, color: '#78350f' }}>Name</th>
                                  <th style={{ padding: '5px 8px', textAlign: 'left',   fontWeight: 700, color: '#78350f' }}>Phone</th>
                                  <th style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700, color: '#78350f' }}>Date</th>
                                  <th style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700, color: '#78350f' }}>Draw</th>
                                  <th style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700, color: '#78350f' }}>Type</th>
                                  <th style={{ padding: '5px 8px', textAlign: 'right',  fontWeight: 700, color: '#78350f' }}>Bet</th>
                                  <th style={{ padding: '5px 8px', textAlign: 'right',  fontWeight: 700, color: '#78350f' }}>Prize Won</th>
                                </tr>
                              </thead>
                              <tbody>
                                {winners[row.numbers].map((w, i) => (
                                  <tr key={w.id} style={{ borderTop: '1px solid rgba(0,0,0,0.05)', background: i % 2 === 0 ? 'rgba(255,255,255,0.6)' : 'transparent' }}>
                                    <td style={{ padding: '5px 8px', fontWeight: 600 }}>{w.user?.name || '—'}</td>
                                    <td style={{ padding: '5px 8px', color: '#64748b' }}>{w.user?.phone || '—'}</td>
                                    <td style={{ padding: '5px 8px', textAlign: 'center', color: '#374151' }}>{w.draw_date}</td>
                                    <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                                      <span style={{ background: '#1e40af', color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>{w.draw_time}</span>
                                    </td>
                                    <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                                      <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: w.bet_type === 'straight' ? '#dbeafe' : '#fef3c7', color: w.bet_type === 'straight' ? '#1d4ed8' : '#92400e' }}>
                                        {w.bet_type}
                                      </span>
                                    </td>
                                    <td style={{ padding: '5px 8px', textAlign: 'right' }}>₱{parseFloat(w.amount).toFixed(2)}</td>
                                    <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>₱{parseFloat(w.prize_amount).toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr style={{ background: 'rgba(245,158,11,0.2)', fontWeight: 800 }}>
                                  <td colSpan={5} style={{ padding: '6px 8px', color: '#92400e' }}>{winners[row.numbers].length} win{winners[row.numbers].length !== 1 ? 's' : ''} total</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right', color: '#374151' }}>₱{winners[row.numbers].reduce((s, w) => s + parseFloat(w.amount), 0).toFixed(2)}</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right', color: '#16a34a' }}>₱{winners[row.numbers].reduce((s, w) => s + parseFloat(w.prize_amount), 0).toLocaleString()}</td>
                                </tr>
                              </tfoot>
                            </table>
                          )}
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}

              {/* Grand total row */}
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 110px 110px 28px', background: '#1e40af', color: '#fff', padding: '12px 14px', gap: 8, alignItems: 'center', fontWeight: 800 }}>
                <span style={{ fontSize: 13 }}>TOTAL ({Object.keys(grouped).length})</span>
                <span style={{ textAlign: 'right', fontSize: 13 }}>₱{Object.values(grouped).reduce((s, r) => s + r.straightAmt, 0).toFixed(2)}</span>
                <span style={{ textAlign: 'right', fontSize: 13 }}>₱{Object.values(grouped).reduce((s, r) => s + r.ramboAmt, 0).toFixed(2)}</span>
                <span style={{ textAlign: 'right', fontSize: 15, color: '#86efac' }}>₱{totalCollected.toFixed(2)}</span>
                <span style={{ textAlign: 'right', fontSize: 13, color: '#fca5a5' }}>₱{totalPayoutRisk.toLocaleString()}</span>
                <span></span>
              </div>
            </div>
            </div>
          )}
        </div>
      </div>

      {/* Winners Payout */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={S.title}>🏆 Winners & Payout</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...S.input, flex: 'none', width: 150 }} type="date" value={payoutDate} onChange={e => setPayoutDate(e.target.value)} />
            <button style={S.btn} onClick={loadDrawWinners}>Load</button>
          </div>
        </div>

        {/* Draw time tabs */}
        <div className="admin-tab-bar" style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e2e8f0' }}>
          {DRAW_TIMES.map(t => {
            const tabWinners = Array.isArray(drawWinners) ? drawWinners.filter(w => w.draw_time === t) : [];
            return (
              <button key={t} style={S.tab(payoutTab === t)} onClick={() => setPayoutTab(t)}>
                {t}
                {tabWinners.length > 0 &&
                  <span style={{ marginLeft: 6, background: '#fbbf24', color: '#78350f', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>
                    {tabWinners.length}
                  </span>}
              </button>
            );
          })}
        </div>

        <div style={{ background: '#f8faff', borderRadius: '0 0 12px 12px', padding: 14 }}>
          {drawWinners === null ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8', fontSize: 15 }}>
              Select a date and click <b>Load</b> to see winners.
            </div>
          ) : drawWinners === 'loading' ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>Loading…</div>
          ) : (() => {
            const draw    = drawResults.find(d => d.draw_time === payoutTab);
            const tabWins = drawWinners.filter(w => w.draw_time === payoutTab);
            const pending = pendingByTime[payoutTab] || 0;
            const totalPrize = tabWins.reduce((s, w) => s + parseFloat(w.prize_amount), 0);

            return (
              <div>
                {/* Draw result + process button */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                  {draw ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 10, padding: '8px 14px', flex: 1 }}>
                      <span style={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>Winning number:</span>
                      <span style={{ display: 'inline-flex', gap: 4 }}>
                        {draw.winning_numbers.split('-').map((n, i) => (
                          <span key={i} className="lotto-ball" style={{ width: 28, height: 28, fontSize: 13 }}>{n}</span>
                        ))}
                      </span>
                      <span style={{ marginLeft: 6, fontSize: 12, color: '#16a34a' }}>{draw.winners_count} winner{draw.winners_count !== 1 ? 's' : ''} (PCSO)</span>
                    </div>
                  ) : (
                    <div style={{ flex: 1, background: '#fef9c3', border: '1.5px solid #fde047', borderRadius: 10, padding: '8px 14px', fontSize: 13, color: '#854d0e', fontWeight: 600 }}>
                      No draw result saved yet for {payoutTab} on {payoutDate}.
                    </div>
                  )}
                  {pending > 0 ? (
                    <button
                      style={{ ...S.btn, background: draw ? '#dc2626' : '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}
                      onClick={() => processDraw(payoutTab)}
                      disabled={processing === payoutTab || !draw}
                      title={!draw ? 'Need a draw result first' : `Process ${pending} pending bets`}
                    >
                      {processing === payoutTab ? 'Processing…' : `⚡ Process ${pending} pending`}
                    </button>
                  ) : draw && (
                    <div style={{ padding: '8px 14px', borderRadius: 10, background: '#dcfce7', color: '#166534', fontWeight: 700, fontSize: 13 }}>
                      ✓ All bets processed
                    </div>
                  )}
                </div>

                {/* Summary */}
                {tabWins.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    {[
                      ['🏆 Winners', tabWins.length, '#92400e', '#fef3c7'],
                      ['💸 Total Prizes', `₱${totalPrize.toLocaleString()}`, '#166534', '#dcfce7'],
                    ].map(([l, v, c, bg]) => (
                      <div key={l} style={{ background: bg, borderRadius: 9, padding: '8px 16px', flex: 1 }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{v}</div>
                        <div style={{ fontSize: 11, color: c, fontWeight: 600, opacity: 0.8 }}>{l}</div>
                      </div>
                    ))}
                  </div>
                )}

                {tabWins.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 14 }}>
                    {draw ? `No winners for ${payoutTab} on ${payoutDate}.` : `No draw result yet — results will auto-fetch or use the Tally page to fetch manually.`}
                  </div>
                ) : (
                  <div className="scroll-x" style={{ borderRadius: 10 }}>
                  <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0', minWidth: 560 }}>
                    {/* Header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 90px 110px 100px', background: '#92400e', color: '#fff', padding: '9px 14px', fontSize: 11, fontWeight: 700, gap: 8, alignItems: 'center' }}>
                      <span>NAME / PHONE</span>
                      <span style={{ textAlign: 'center' }}>NUMBER</span>
                      <span style={{ textAlign: 'center' }}>TYPE</span>
                      <span style={{ textAlign: 'right'  }}>BET</span>
                      <span style={{ textAlign: 'right'  }}>PRIZE WON</span>
                      <span style={{ textAlign: 'right'  }}>BALANCE</span>
                    </div>
                    {tabWins.map((w, idx) => (
                      <div key={w.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 90px 110px 100px', padding: '10px 14px', gap: 8, alignItems: 'center', borderTop: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fffbeb' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{w.user?.name || '—'}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{w.user?.phone || '—'}</div>
                        </div>
                        <div style={{ textAlign: 'center', display: 'flex', gap: 3, justifyContent: 'center' }}>
                          {w.numbers.split('-').map((n, i) => (
                            <span key={i} className="lotto-ball" style={{ width: 26, height: 26, fontSize: 12 }}>{n}</span>
                          ))}
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: w.bet_type === 'straight' ? '#dbeafe' : '#fef3c7', color: w.bet_type === 'straight' ? '#1d4ed8' : '#92400e' }}>
                            {w.bet_type}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 13, color: '#374151' }}>₱{parseFloat(w.amount).toFixed(2)}</div>
                        <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: '#16a34a' }}>₱{parseFloat(w.prize_amount).toLocaleString()}</div>
                        <div style={{ textAlign: 'right', fontSize: 12, color: parseFloat(w.user?.balance) > 0 ? '#374151' : '#94a3b8' }}>₱{parseFloat(w.user?.balance || 0).toFixed(2)}</div>
                      </div>
                    ))}
                    {/* Footer */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 90px 110px 100px', background: '#92400e', color: '#fff', padding: '10px 14px', gap: 8, alignItems: 'center', fontWeight: 800 }}>
                      <span style={{ fontSize: 13 }}>TOTAL ({tabWins.length} winner{tabWins.length !== 1 ? 's' : ''})</span>
                      <span></span><span></span>
                      <span style={{ textAlign: 'right', fontSize: 13 }}>₱{tabWins.reduce((s, w) => s + parseFloat(w.amount), 0).toFixed(2)}</span>
                      <span style={{ textAlign: 'right', fontSize: 14, color: '#86efac' }}>₱{totalPrize.toLocaleString()}</span>
                      <span></span>
                    </div>
                  </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Manual Draw Entry */}
      <div style={S.card}>
        <div style={S.title}>✏️ Manual Draw Result Entry</div>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
          Use this if the auto-fetch failed or PCSO site was down. This will also allow you to then process winners.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Date</label>
            <input style={{ ...S.input, flex: 'none', width: 150 }} type="date" value={drawEntryDate} onChange={e => setDrawEntryDate(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Draw</label>
            <select style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' }}
              value={drawEntryTime} onChange={e => setDrawEntryTime(e.target.value)}>
              {DRAW_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Winning Numbers (D-D-D)</label>
            <input style={{ ...S.input, width: '100%' }} placeholder="e.g. 6-2-8" value={drawEntryNums}
              onChange={e => setDrawEntryNums(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveDraw()} />
          </div>
          <button style={{ ...S.btn, background: '#7c3aed', height: 44 }} onClick={saveDraw} disabled={savingDraw}>
            {savingDraw ? 'Saving…' : '💾 Save Result'}
          </button>
        </div>
      </div>

      {/* Bet Limits */}
      <div style={S.card}>
        <div style={S.title}>🚫 Bet Limits per Number</div>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
          Set a maximum total bet amount per number per draw, or block a number entirely. Protects against high-risk numbers.
        </p>

        {/* Tabs */}
        <div className="admin-tab-bar" style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e2e8f0', marginBottom: 14 }}>
          {DRAW_TIMES.map(t => (
            <button key={t} style={S.tab(limitsTab === t)} onClick={() => setLimitsTab(t)}>{t}</button>
          ))}
        </div>

        {/* Add form */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14, background: '#f8faff', padding: 12, borderRadius: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Number (D-D-D)</label>
            <input style={{ ...S.input, flex: 'none', width: 120 }} placeholder="e.g. 1-2-3"
              value={limitForm.numbers} onChange={e => setLimitForm(f => ({ ...f, numbers: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Max Total Bet (₱)</label>
            <input style={{ ...S.input, flex: 'none', width: 130 }} type="number" min={10}
              value={limitForm.max_amount} onChange={e => setLimitForm(f => ({ ...f, max_amount: e.target.value }))}
              disabled={limitForm.is_blocked} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 2 }}>
            <input type="checkbox" id="isBlocked" checked={limitForm.is_blocked}
              onChange={e => setLimitForm(f => ({ ...f, is_blocked: e.target.checked }))}
              style={{ width: 16, height: 16, cursor: 'pointer' }} />
            <label htmlFor="isBlocked" style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', cursor: 'pointer' }}>Block number entirely</label>
          </div>
          <button style={{ ...S.btn, background: '#dc2626', height: 44 }} onClick={saveLimit} disabled={savingLimit}>
            {savingLimit ? 'Saving…' : '+ Add Limit'}
          </button>
        </div>

        {/* Limits list */}
        {limits.filter(l => l.draw_time === limitsTab).length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8', fontSize: 14 }}>No limits set for {limitsTab}.</div>
        ) : (
          <div className="scroll-x" style={{ borderRadius: 10 }}>
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0', minWidth: 420 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 110px 90px', background: '#dc2626', color: '#fff', padding: '9px 14px', fontSize: 11, fontWeight: 700, gap: 8 }}>
              <span>NUMBER</span><span>MAX BET</span><span style={{ textAlign: 'center' }}>STATUS</span><span style={{ textAlign: 'center' }}>ACTION</span>
            </div>
            {limits.filter(l => l.draw_time === limitsTab).map((l, idx) => (
              <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 110px 90px', padding: '9px 14px', borderTop: '1px solid #f1f5f9', alignItems: 'center', gap: 8, background: idx % 2 === 0 ? '#fff' : '#fafbff' }}>
                <span style={{ display: 'inline-flex', gap: 3 }}>
                  {l.numbers.split('-').map((n, i) => <span key={i} style={{ width: 24, height: 24, background: l.is_blocked ? '#dc2626' : '#1e40af', color: '#fff', borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13 }}>{n}</span>)}
                </span>
                <span style={{ fontSize: 13, color: l.is_blocked ? '#dc2626' : '#374151', fontWeight: 600 }}>
                  {l.is_blocked ? 'BLOCKED' : `₱${parseFloat(l.max_amount).toLocaleString()} max`}
                </span>
                <span style={{ textAlign: 'center' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: l.is_blocked ? '#fef2f2' : '#dcfce7', color: l.is_blocked ? '#dc2626' : '#16a34a' }}>
                    {l.is_blocked ? '🚫 Blocked' : '✓ Limited'}
                  </span>
                </span>
                <span style={{ textAlign: 'center' }}>
                  <button onClick={() => deleteLimit(l.id)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#fee2e2', color: '#dc2626', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>Remove</button>
                </span>
              </div>
            ))}
          </div>
          </div>
        )}
      </div>

      {/* Deposit Requests */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div style={S.title}>📥 Deposit Requests</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['pending', 'paid', 'failed'].map(s => (
              <button key={s} style={{ padding: '6px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
                background: depFilter === s ? '#16a34a' : '#e2e8f0', color: depFilter === s ? '#fff' : '#64748b' }}
                onClick={() => { setDepFilter(s); loadDeposits(s); }}>
                {s === 'paid' ? 'Approved' : s === 'failed' ? 'Rejected' : 'Pending'}
              </button>
            ))}
          </div>
        </div>

        {deposits.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 14 }}>
            No {depFilter === 'paid' ? 'approved' : depFilter === 'failed' ? 'rejected' : depFilter} deposit requests.
          </div>
        ) : (
          <div className="scroll-x" style={{ borderRadius: 10 }}>
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0', minWidth: 600 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 170px 220px', background: '#16a34a', color: '#fff', padding: '9px 14px', fontSize: 11, fontWeight: 700, gap: 8 }}>
              <span>PLAYER</span>
              <span style={{ textAlign: 'right' }}>AMOUNT</span>
              <span>GCASH REF #</span>
              <span style={{ textAlign: 'center' }}>ACTION</span>
            </div>
            {deposits.map((d, idx) => (
              <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 170px 220px', padding: '10px 14px', borderTop: '1px solid #f1f5f9', alignItems: 'center', gap: 8, background: idx % 2 === 0 ? '#fff' : '#fafbff' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{d.user?.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{d.user?.phone}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{new Date(d.created_at).toLocaleString('en-PH')}</div>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 15, color: '#16a34a' }}>₱{parseFloat(d.amount).toLocaleString()}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12, fontFamily: 'monospace', color: '#1e40af' }}>{d.paymongo_id}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Balance: ₱{parseFloat(d.user?.balance || 0).toFixed(2)}</div>
                </div>
                <div>
                  {d.status === 'pending' ? (
                    <div style={{ display: 'flex', gap: 4, flexDirection: 'column' }}>
                      <input placeholder="Rejection note (optional)" value={depNote[d.id] || ''} onChange={e => setDepNote(n => ({ ...n, [d.id]: e.target.value }))}
                        style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, width: '100%', fontFamily: 'inherit' }} />
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => processDeposit(d.id, 'paid')}
                          style={{ flex: 1, padding: '6px 4px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                          ✓ Approve
                        </button>
                        <button onClick={() => processDeposit(d.id, 'failed')}
                          style={{ flex: 1, padding: '6px 4px', borderRadius: 8, border: 'none', background: '#fee2e2', color: '#dc2626', fontWeight: 700, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                          ✗ Reject
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                        background: d.status === 'paid' ? '#dcfce7' : '#fee2e2',
                        color: d.status === 'paid' ? '#16a34a' : '#dc2626' }}>
                        {d.status === 'paid' ? '✓ Credited' : '✗ Rejected'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          </div>
        )}
      </div>

      {/* Withdrawals */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div style={S.title}>💸 Withdrawal Requests</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['pending', 'approved', 'rejected'].map(s => (
              <button key={s} style={{ padding: '6px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
                background: wdFilter === s ? '#1e40af' : '#e2e8f0', color: wdFilter === s ? '#fff' : '#64748b' }}
                onClick={() => { setWdFilter(s); loadWithdrawals(s); }}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {withdrawals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 14 }}>No {wdFilter} withdrawal requests.</div>
        ) : (
          <div className="scroll-x" style={{ borderRadius: 10 }}>
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0', minWidth: 600 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 150px 90px 200px', background: '#1e40af', color: '#fff', padding: '9px 14px', fontSize: 11, fontWeight: 700, gap: 8 }}>
              <span>PLAYER</span><span style={{ textAlign: 'right' }}>AMOUNT</span><span>GCASH</span><span style={{ textAlign: 'center' }}>BALANCE</span><span style={{ textAlign: 'center' }}>ACTION</span>
            </div>
            {withdrawals.map((w, idx) => (
              <div key={w.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 150px 90px 200px', padding: '10px 14px', borderTop: '1px solid #f1f5f9', alignItems: 'center', gap: 8, background: idx % 2 === 0 ? '#fff' : '#fafbff' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{w.user?.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{w.user?.phone}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{new Date(w.created_at).toLocaleString('en-PH')}</div>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 15, color: '#dc2626' }}>₱{parseFloat(w.amount).toLocaleString()}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{w.gcash_name}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{w.gcash_number}</div>
                </div>
                <div style={{ textAlign: 'center', fontSize: 13, color: parseFloat(w.user?.balance) >= parseFloat(w.amount) ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                  ₱{parseFloat(w.user?.balance || 0).toFixed(2)}
                </div>
                <div>
                  {w.status === 'pending' ? (
                    <div style={{ display: 'flex', gap: 4, flexDirection: 'column' }}>
                      <input placeholder="Note (optional)" value={wdNote[w.id] || ''} onChange={e => setWdNote(n => ({ ...n, [w.id]: e.target.value }))}
                        style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, width: '100%', fontFamily: 'inherit' }} />
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => processWithdrawal(w.id, 'approved')}
                          style={{ flex: 1, padding: '6px 4px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                          ✓ Approve
                        </button>
                        <button onClick={() => processWithdrawal(w.id, 'rejected')}
                          style={{ flex: 1, padding: '6px 4px', borderRadius: 8, border: 'none', background: '#fee2e2', color: '#dc2626', fontWeight: 700, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                          ✗ Reject
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                        background: w.status === 'approved' ? '#dcfce7' : '#fee2e2',
                        color: w.status === 'approved' ? '#16a34a' : '#dc2626' }}>
                        {w.status === 'approved' ? '✓ Approved' : '✗ Rejected'}
                      </span>
                      {w.note && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{w.note}</div>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          </div>
        )}
      </div>

      {/* Users */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={S.title}>👥 Users</div>
          <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
            {filteredUsers.length} / {users.length} users
          </span>
        </div>
        <input
          style={{ ...S.input, marginBottom: 10, display: 'block' }}
          placeholder="🔍  Search by name or phone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {filteredUsers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>No users match "{search}"</div>
        ) : (
          <div style={{ maxHeight: 420, overflowY: 'auto', overflowX: 'auto', borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <div style={{ minWidth: 450 }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 80px 140px', background: '#1e40af', color: '#fff', padding: '8px 14px', fontSize: 11, fontWeight: 700, gap: 8, position: 'sticky', top: 0, zIndex: 1 }}>
              <span>NAME / PHONE</span>
              <span style={{ textAlign: 'right' }}>BALANCE</span>
              <span style={{ textAlign: 'center' }}>STATUS</span>
              <span style={{ textAlign: 'center' }}>ACTIONS</span>
            </div>
            {filteredUsers.map((u, idx) => (
              <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 80px 140px', padding: '8px 14px', gap: 8, alignItems: 'center', borderTop: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafbff' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{u.phone}</div>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: parseFloat(u.balance) > 0 ? '#16a34a' : '#94a3b8' }}>
                  ₱{parseFloat(u.balance).toFixed(2)}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <button style={S.toggle(u.is_active)} onClick={() => toggleUser(u)}>
                    {u.is_active ? '✓ On' : '✗ Off'}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                  {creditUser === u.id ? (
                    <>
                      <input
                        type="number" placeholder="₱"
                        value={creditAmt}
                        onChange={e => setCreditAmt(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && doCredit(u.id)}
                        style={{ width: 64, padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit' }}
                        autoFocus
                      />
                      <button style={{ ...S.btn, padding: '4px 10px', fontSize: 12, background: '#16a34a' }} onClick={() => doCredit(u.id)}>OK</button>
                      <button style={{ ...S.btn, padding: '4px 10px', fontSize: 12, background: '#6b7280' }} onClick={() => setCreditUser(null)}>✕</button>
                    </>
                  ) : (
                    <button style={{ ...S.btn, padding: '5px 12px', fontSize: 12, background: '#16a34a' }} onClick={() => { setCreditUser(u.id); setCreditAmt(''); }}>+ Credit</button>
                  )}
                </div>
              </div>
            ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

