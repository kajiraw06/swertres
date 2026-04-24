const supabase = require('../config/supabase');
const moment = require('moment-timezone');
const TZ = 'Asia/Manila';
const { fetchAndSaveToday } = require('../services/pcsoScraper');

exports.getDashboard = async (req, res) => {
  try {
    const today = moment().tz(TZ).format('YYYY-MM-DD');
    const todayStart = moment().tz(TZ).startOf('day').toISOString();
    const [
      { count: totalUsers },
      { count: betsToday },
      { data: depositsData },
      { count: pendingBets },
      { count: pendingDeposits },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'bettor'),
      supabase.from('bets').select('*', { count: 'exact', head: true }).eq('draw_date', today),
      supabase.from('transactions').select('amount, balance_before, balance_after').eq('type', 'deposit').gte('created_at', todayStart),
      supabase.from('bets').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);
    // Only count deposits that were actually credited (balance_after > balance_before)
    const totalDeposits = depositsData?.reduce((s, t) => {
      if (parseFloat(t.balance_after) > parseFloat(t.balance_before)) {
        return s + parseFloat(t.amount);
      }
      return s;
    }, 0) || 0;
    return res.json({ total_users: totalUsers, bets_today: betsToday, deposits_today: totalDeposits, pending_bets: pendingBets, pending_deposits: pendingDeposits });
  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).json({ message: 'Failed to load dashboard.' });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let query = supabase
      .from('users')
      .select('id, name, phone, email, balance, role, is_active, created_at', { count: 'exact' })
      .eq('role', 'bettor')
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);
    if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    const { data: users, count, error } = await query;
    if (error) return res.status(500).json({ message: 'Failed to get users.' });
    return res.json({ total: count, page: parseInt(page), users: users || [] });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to get users.' });
  }
};

exports.toggleUser = async (req, res) => {
  try {
    const { data: user } = await supabase.from('users').select('id, name, is_active').eq('id', req.params.id).single();
    if (!user) return res.status(404).json({ message: 'User not found.' });
    const newState = !user.is_active;
    await supabase.from('users').update({ is_active: newState }).eq('id', user.id);
    return res.json({ message: `User ${newState ? 'enabled' : 'disabled'}.`, is_active: newState });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to toggle user.' });
  }
};

exports.creditUser = async (req, res) => {
  try {
    const { user_id, amount, note } = req.body;
    const { data, error } = await supabase.rpc('credit_user_balance', {
      p_user_id: user_id,
      p_amount:  parseFloat(amount),
      p_note:    note || 'Manual credit by admin',
    });
    if (error) throw error;
    if (data.error) return res.status(400).json({ message: data.error });
    const { data: user } = await supabase.from('users').select('name').eq('id', user_id).single();
    return res.json({ message: `₱${amount} credited to ${user?.name}.`, new_balance: parseFloat(data.new_balance) });
  } catch (err) {
    console.error('Credit error:', err);
    return res.status(500).json({ message: 'Failed to credit user.' });
  }
};

exports.fetchResults = async (req, res) => {
  try {
    const date = req.body.date || moment().tz('Asia/Manila').format('YYYY-MM-DD');
    const results = await fetchAndSaveToday(date);
    return res.json({ message: `Fetched ${results.length} result(s) for ${date}.`, results });
  } catch (err) {
    console.error('Manual fetch error:', err.message);
    return res.status(500).json({ message: 'Failed to fetch results from PCSO.', error: err.message });
  }
};

exports.getDrawWinners = async (req, res) => {
  try {
    const { draw_date, draw_time } = req.query;
    if (!draw_date) return res.status(400).json({ message: 'draw_date required.' });

    // Get the draw result for this date/time
    let drawQuery = supabase.from('draws').select('draw_date, draw_time, winning_numbers, jackpot, winners_count');
    drawQuery = drawQuery.eq('draw_date', draw_date);
    if (draw_time) drawQuery = drawQuery.eq('draw_time', draw_time);
    const { data: draws } = await drawQuery;

    // Get all won bets for this date/time with user info
    let betsQuery = supabase
      .from('bets')
      .select('id, draw_date, draw_time, numbers, bet_type, amount, prize_amount, status, created_at, user:users(id, name, phone, balance)')
      .eq('draw_date', draw_date)
      .eq('status', 'won')
      .order('prize_amount', { ascending: false });
    if (draw_time) betsQuery = betsQuery.eq('draw_time', draw_time);
    const { data: winners, error } = await betsQuery;
    if (error) return res.status(500).json({ message: 'Failed to get winners.' });

    // Also get pending bets count per draw_time to show unprocessed
    let pendingQuery = supabase
      .from('bets')
      .select('draw_time, id', { count: 'exact' })
      .eq('draw_date', draw_date)
      .eq('status', 'pending');
    if (draw_time) pendingQuery = pendingQuery.eq('draw_time', draw_time);
    const { data: pendingBets } = await pendingQuery;

    const pendingByTime = {};
    for (const b of (pendingBets || [])) {
      pendingByTime[b.draw_time] = (pendingByTime[b.draw_time] || 0) + 1;
    }

    return res.json({ draws: draws || [], winners: winners || [], pending_by_time: pendingByTime });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to get draw winners.' });
  }
};

exports.processDraw = async (req, res) => {
  try {
    const { draw_date, draw_time } = req.body;
    if (!draw_date || !draw_time) return res.status(400).json({ message: 'draw_date and draw_time required.' });
    const { processWinners } = require('../services/winnerService');
    const winners_count = await processWinners(draw_date, draw_time);
    return res.json({ message: `Draw ${draw_time} on ${draw_date} processed successfully.`, winners_count: winners_count || 0 });
  } catch (err) {
    console.error('Process draw error:', err.message);
    return res.status(500).json({ message: 'Failed to process draw.', error: err.message });
  }
};

exports.getWinners = async (req, res) => {
  try {
    const { numbers } = req.query;
    if (!numbers) return res.status(400).json({ message: 'numbers param required.' });
    const { data: bets, error } = await supabase
      .from('bets')
      .select('id, draw_date, draw_time, numbers, bet_type, amount, prize_amount, user:users(id, name, phone)')
      .eq('status', 'won')
      .eq('numbers', numbers)
      .order('draw_date', { ascending: false })
      .limit(100);
    if (error) return res.status(500).json({ message: 'Failed to get winners.' });
    return res.json({ winners: bets || [] });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to get winners.' });
  }
};

exports.getBets = async (req, res) => {
  try {
    const { draw_date, draw_time, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let query = supabase
      .from('bets')
      .select('*, user:users(id, name, phone)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);
    if (draw_date) query = query.eq('draw_date', draw_date);
    if (draw_time) query = query.eq('draw_time', draw_time);
    const { data: bets, count, error } = await query;
    if (error) return res.status(500).json({ message: 'Failed to get bets.' });
    return res.json({ total: count, page: parseInt(page), bets: bets || [] });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to get bets.' });
  }
};

// ── Bet Limits ──────────────────────────────────────────────
exports.getBetLimits = async (req, res) => {
  try {
    const { draw_time } = req.query;
    let query = supabase.from('bet_limits').select('*').order('draw_time').order('numbers');
    if (draw_time) query = query.eq('draw_time', draw_time);
    const { data, error } = await query;
    if (error) return res.status(500).json({ message: 'Failed to get limits.' });
    return res.json({ limits: data || [] });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to get limits.' });
  }
};

exports.setBetLimit = async (req, res) => {
  try {
    const { draw_time, numbers, max_amount, is_blocked } = req.body;
    if (!draw_time || !numbers) return res.status(400).json({ message: 'draw_time and numbers required.' });
    const { data, error } = await supabase.from('bet_limits').upsert(
      { draw_time, numbers, max_amount: max_amount ?? 500, is_blocked: is_blocked ?? false, updated_at: new Date().toISOString() },
      { onConflict: 'draw_time,numbers' }
    ).select().single();
    if (error) return res.status(500).json({ message: 'Failed to set limit.' });
    return res.json({ message: 'Limit saved.', limit: data });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to set limit.' });
  }
};

exports.deleteBetLimit = async (req, res) => {
  try {
    const { id } = req.params;
    await supabase.from('bet_limits').delete().eq('id', id);
    return res.json({ message: 'Limit removed.' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to remove limit.' });
  }
};

// ── Manual Draw Entry ────────────────────────────────────────
exports.setDrawResult = async (req, res) => {
  try {
    const { draw_date, draw_time, winning_numbers } = req.body;
    if (!draw_date || !draw_time || !winning_numbers)
      return res.status(400).json({ message: 'draw_date, draw_time, and winning_numbers required.' });
    if (!/^\d-\d-\d$/.test(winning_numbers))
      return res.status(400).json({ message: 'winning_numbers must be in format D-D-D (e.g. 1-2-3).' });

    const { error } = await supabase.from('draws').upsert(
      { draw_date, draw_time, winning_numbers, fetched_at: new Date().toISOString() },
      { onConflict: 'draw_date,draw_time' }
    );
    if (error) return res.status(500).json({ message: 'Failed to save draw result.' });
    return res.json({ message: `Draw result saved: ${draw_time} on ${draw_date} → ${winning_numbers}` });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to save draw result.' });
  }
};

// ── Withdrawals ──────────────────────────────────────────────
exports.getWithdrawals = async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabase
      .from('withdrawals')
      .select('*, user:users(id, name, phone, balance)')
      .order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) return res.status(500).json({ message: 'Failed to get withdrawals.' });
    return res.json({ withdrawals: data || [] });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to get withdrawals.' });
  }
};

exports.processWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, note } = req.body; // action: 'approved' | 'rejected'
    if (!['approved', 'rejected'].includes(action))
      return res.status(400).json({ message: 'action must be approved or rejected.' });

    const { data: withdrawal, error: fetchErr } = await supabase
      .from('withdrawals').select('*, user:users(id, name, balance)').eq('id', id).single();
    if (fetchErr || !withdrawal) return res.status(404).json({ message: 'Withdrawal not found.' });
    if (withdrawal.status !== 'pending') return res.status(400).json({ message: 'Already processed.' });

    if (action === 'approved') {
      // Deduct balance
      const newBalance = parseFloat(withdrawal.user.balance) - parseFloat(withdrawal.amount);
      if (newBalance < 0) return res.status(400).json({ message: 'User has insufficient balance.' });
      await supabase.from('users').update({ balance: newBalance }).eq('id', withdrawal.user.id);
      await supabase.from('transactions').insert({
        user_id: withdrawal.user.id, type: 'withdrawal',
        amount: withdrawal.amount,
        balance_before: parseFloat(withdrawal.user.balance),
        balance_after: newBalance,
        reference: `WD-${id}`,
        note: `Withdrawal to GCash ${withdrawal.gcash_number} (${withdrawal.gcash_name})`,
      });
    }

    await supabase.from('withdrawals').update({
      status: action, note: note || null, processed_at: new Date().toISOString()
    }).eq('id', id);

    return res.json({ message: `Withdrawal ${action}.` });
  } catch (err) {
    console.error('Process withdrawal error:', err);
    return res.status(500).json({ message: 'Failed to process withdrawal.' });
  }
};

// ── Deposits ─────────────────────────────────────────────────
exports.getDeposits = async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabase
      .from('payments')
      .select('*, user:users(id, name, phone, balance)')
      .not('transaction_id', 'is', null)
      .order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) return res.status(500).json({ message: 'Failed to get deposits.' });
    return res.json({ deposits: data || [] });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to get deposits.' });
  }
};

exports.processDeposit = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, note } = req.body; // action: 'paid' | 'failed'
    if (!['paid', 'failed'].includes(action))
      return res.status(400).json({ message: 'action must be paid or failed.' });

    const { data: payment, error: fetchErr } = await supabase
      .from('payments')
      .select('*, user:users(id, name, balance)')
      .eq('id', id).single();
    if (fetchErr || !payment) return res.status(404).json({ message: 'Deposit not found.' });
    if (payment.status !== 'pending') return res.status(400).json({ message: 'Already processed.' });

    if (action === 'paid') {
      // Use existing RPC: credits balance + marks payment.status = 'paid'
      const { data: result } = await supabase.rpc('confirm_deposit', {
        p_payment_id:     payment.id,
        p_transaction_id: payment.transaction_id,
        p_user_id:        payment.user_id,
        p_amount:         parseFloat(payment.amount),
      });
      if (result?.error) return res.status(400).json({ message: result.error });
      if (payment.transaction_id) {
        await supabase.from('transactions').update({
          note: `GCash deposit ₱${payment.amount} APPROVED — ref: ${payment.paymongo_id}`,
        }).eq('id', payment.transaction_id);
      }
    } else {
      await supabase.from('payments')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (payment.transaction_id) {
        await supabase.from('transactions').update({
          note: `GCash deposit REJECTED${note ? ' — ' + note : ''} — ref: ${payment.paymongo_id}`,
        }).eq('id', payment.transaction_id);
      }
    }

    return res.json({ message: `Deposit ${action === 'paid' ? 'approved and credited' : 'rejected'}.` });
  } catch (err) {
    console.error('Process deposit error:', err);
    return res.status(500).json({ message: 'Failed to process deposit.' });
  }
};

// ── User Transaction History ─────────────────────────────────
exports.getUserTransactions = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return res.status(500).json({ message: 'Failed to get transactions.' });
    return res.json({ transactions: data || [] });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to get transactions.' });
  }
};

