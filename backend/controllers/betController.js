const moment = require('moment-timezone');
const TZ = 'Asia/Manila';
const supabase = require('../config/supabase');

const DRAW_CUTOFFS = {
  '2PM': { hour: 13, minute: 45 },
  '5PM': { hour: 16, minute: 45 },
  '9PM': { hour: 20, minute: 45 },
};

function isDrawOpen(drawTime) {
  const now = moment().tz(TZ);
  const c = DRAW_CUTOFFS[drawTime];
  if (!c) return false;
  return now.isBefore(now.clone().startOf('day').hour(c.hour).minute(c.minute));
}

function getAllDrawsWithStatus() {
  const now = moment().tz(TZ);
  const today = now.format('YYYY-MM-DD');
  return Object.entries(DRAW_CUTOFFS).map(([time, c]) => ({
    draw_date: today,
    draw_time: time,
    is_open: now.isBefore(now.clone().startOf('day').hour(c.hour).minute(c.minute)),
    closes_at: `${c.hour}:${String(c.minute).padStart(2, '0')}`,
  }));
}

exports.getAvailableDraws = (req, res) => res.json({ draws: getAllDrawsWithStatus() });

exports.placeBet = async (req, res) => {
  try {
    const { draw_date, draw_time, numbers, bet_type = 'straight', amount } = req.body;
    const userId = req.user.id;

    if (!/^\d-\d-\d$/.test(numbers))
      return res.status(400).json({ message: 'Numbers must be in format D-D-D (e.g. 1-2-3).' });

    const targetDate = draw_date || moment().tz(TZ).format('YYYY-MM-DD');
    const isToday = targetDate === moment().tz(TZ).format('YYYY-MM-DD');
    if (isToday && !isDrawOpen(draw_time))
      return res.status(400).json({ message: `Betting for ${draw_time} draw is already closed.` });

    const betAmount = parseFloat(amount);
    if (isNaN(betAmount) || betAmount < 5)
      return res.status(400).json({ message: 'Minimum bet amount is ₱5.' });

    // Check bet limits / blocked numbers
    const { data: limitRow } = await supabase
      .from('bet_limits')
      .select('max_amount, is_blocked')
      .eq('draw_time', draw_time)
      .eq('numbers', numbers)
      .maybeSingle();

    if (limitRow?.is_blocked)
      return res.status(400).json({ message: `Number ${numbers} is not available for ${draw_time}.` });

    const { data, error } = await supabase.rpc('place_bet', {
      p_user_id:   userId,
      p_draw_date: targetDate,
      p_draw_time: draw_time,
      p_numbers:   numbers,
      p_bet_type:  bet_type,
      p_amount:    betAmount,
    });

    if (error) { console.error('place_bet RPC error:', error); return res.status(500).json({ message: 'Failed to place bet.' }); }
    if (data.error) return res.status(400).json({ message: data.error });

    return res.status(201).json({
      message: 'Bet placed successfully!',
      bet: { id: data.bet_id, numbers, bet_type, amount: betAmount, draw_date: targetDate, draw_time },
      new_balance: parseFloat(data.new_balance),
    });
  } catch (err) {
    console.error('Place bet error:', err);
    return res.status(500).json({ message: 'Failed to place bet.' });
  }
};

exports.getMyBets = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let query = supabase
      .from('bets').select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);
    if (status) query = query.eq('status', status);
    const { data: bets, count, error } = await query;
    if (error) return res.status(500).json({ message: 'Failed to retrieve bets.' });
    return res.json({ total: count, page: parseInt(page), bets: bets || [] });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to retrieve bets.' });
  }
};

exports.cancelBet = async (req, res) => {
  try {
    const betId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    if (isNaN(betId)) return res.status(400).json({ message: 'Invalid bet ID.' });

    const { data: bet } = await supabase
      .from('bets').select('*').eq('id', betId).eq('user_id', userId).maybeSingle();
    if (!bet) return res.status(404).json({ message: 'Bet not found.' });
    if (bet.status !== 'pending') return res.status(400).json({ message: 'Only pending bets can be cancelled.' });

    // Check draw cutoff using specific draw_date + draw_time
    const now = moment().tz(TZ);
    const c = DRAW_CUTOFFS[bet.draw_time];
    if (c) {
      const cutoff = moment.tz(String(bet.draw_date), 'YYYY-MM-DD', TZ).hour(c.hour).minute(c.minute).second(0);
      if (now.isAfter(cutoff)) {
        return res.status(400).json({ message: `Cannot cancel — ${bet.draw_time} draw cutoff has passed.` });
      }
    }

    // Update bet to cancelled
    const { error: cancelError } = await supabase.from('bets').update({ status: 'cancelled' }).eq('id', betId);
    if (cancelError) return res.status(500).json({ message: 'Failed to cancel bet.' });

    // Get current balance
    const { data: userRow } = await supabase.from('users').select('balance').eq('id', userId).single();
    const balanceBefore = parseFloat(userRow?.balance || 0);
    const refundAmount = parseFloat(bet.amount);

    // Credit refund
    const { error: creditError } = await supabase
      .from('users').update({ balance: balanceBefore + refundAmount }).eq('id', userId);
    if (creditError) {
      await supabase.from('bets').update({ status: 'pending' }).eq('id', betId);
      return res.status(500).json({ message: 'Failed to process refund.' });
    }

    // Record refund transaction
    await supabase.from('transactions').insert({
      user_id: userId,
      type: 'refund',
      amount: refundAmount,
      balance_before: balanceBefore,
      balance_after: balanceBefore + refundAmount,
      reference: 'BET-' + betId,
      note: `Bet cancelled: ${bet.numbers} (${bet.bet_type}) for ${bet.draw_time} draw on ${bet.draw_date}`,
    });

    return res.json({ message: 'Bet cancelled. Refund of ₱' + refundAmount.toFixed(2) + ' added to your wallet.', amount: refundAmount });
  } catch (err) {
    console.error('Cancel bet error:', err);
    return res.status(500).json({ message: 'Failed to cancel bet.' });
  }
};
