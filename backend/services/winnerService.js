/**
 * winnerService.js
 *
 * After a draw result is saved, this service:
 *  1. Finds all pending bets for that draw
 *  2. Determines winners (straight & rambolito)
 *  3. Credits prize money to winners
 *  4. Marks all bets as won or lost
 */

const supabase = require('../config/supabase');

// ₱4,500 prize per ₱10 straight bet → multiplier 450
const STRAIGHT_MULTIPLIER = 450;

// Rambolito: 6 permutations (all digits different) → ₱750/₱10 → ×75
//            3 permutations (one pair) → ₱1,500/₱10 → ×150
// We auto-detect which rambolito type applies per bet's numbers
function getRamboMultiplier(numbers) {
  const digits = numbers.split('-');
  const unique = new Set(digits);
  if (unique.size === 3) return 75;   // 6 combos: rambolito 6
  if (unique.size === 2) return 150;  // 3 combos: rambolito 3
  return 0; // all same (e.g. 1-1-1) — not a valid rambolito
}

/**
 * Generate all permutations of a 3-digit string.
 */
function permutations(digits) {
  const perms = new Set();
  const arr = digits.split('-');
  const permute = (arr, current = []) => {
    if (arr.length === 0) { perms.add(current.join('-')); return; }
    for (let i = 0; i < arr.length; i++) {
      permute([...arr.slice(0, i), ...arr.slice(i + 1)], [...current, arr[i]]);
    }
  };
  permute(arr);
  return perms;
}

/**
 * Process winners for a specific draw.
 * @param {string} drawDate  - 'YYYY-MM-DD'
 * @param {string} drawTime  - '2PM' | '5PM' | '9PM'
 */
async function processWinners(drawDate, drawTime) {
  const { data: draw } = await supabase
    .from('draws').select('winning_numbers').eq('draw_date', drawDate).eq('draw_time', drawTime).single();

  if (!draw) {
    console.log(`[WinnerService] No draw found for ${drawDate} ${drawTime}`);
    return;
  }

  const winningNumbers = draw.winning_numbers;
  const winningPerms = permutations(winningNumbers);

  const { data: pendingBets } = await supabase
    .from('bets').select('*')
    .eq('draw_date', drawDate).eq('draw_time', drawTime).eq('status', 'pending');

  console.log(`[WinnerService] Processing ${pendingBets?.length || 0} bets for ${drawDate} ${drawTime} (winning: ${winningNumbers})`);
  let winnersCount = 0;

  for (const bet of (pendingBets || [])) {
    let isWinner = false;
    let multiplier = 0;

    if (bet.bet_type === 'straight') {
      isWinner = bet.numbers === winningNumbers;
      multiplier = STRAIGHT_MULTIPLIER;
    } else if (bet.bet_type === 'rambolito') {
      isWinner = winningPerms.has(bet.numbers);
      multiplier = getRamboMultiplier(bet.numbers);
    }

    if (isWinner && multiplier > 0) {
      const prize = (parseFloat(bet.amount) / 10) * multiplier;
      const { data, error } = await supabase.rpc('award_prize', { p_bet_id: bet.id, p_prize_amount: prize });
      if (error) console.error(`[WinnerService] award_prize error for bet ${bet.id}:`, error.message);
      else { winnersCount++; console.log(`[WinnerService] User ${bet.user_id} WON ₱${prize} on bet ${bet.id}`); }
    } else {
      await supabase.from('bets').update({ status: 'lost' }).eq('id', bet.id);
    }
  }

  console.log(`[WinnerService] Done processing ${drawDate} ${drawTime} — ${winnersCount} winner(s)`);
  return winnersCount;
}

module.exports = { processWinners };
