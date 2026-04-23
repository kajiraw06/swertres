require('dotenv').config();
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');

const PLAYERS = [
  { name: 'Juan Dela Cruz',    phone: '09100000001' },
  { name: 'Maria Santos',      phone: '09100000002' },
  { name: 'Pedro Reyes',       phone: '09100000003' },
  { name: 'Ana Garcia',        phone: '09100000004' },
  { name: 'Jose Mendoza',      phone: '09100000005' },
  { name: 'Rosa Villanueva',   phone: '09100000006' },
  { name: 'Carlos Ramos',      phone: '09100000007' },
  { name: 'Linda Torres',      phone: '09100000008' },
  { name: 'Roberto Cruz',      phone: '09100000009' },
  { name: 'Elena Pascual',     phone: '09100000010' },
  { name: 'Miguel Bautista',   phone: '09100000011' },
  { name: 'Teresa Aquino',     phone: '09100000012' },
  { name: 'Ricardo Flores',    phone: '09100000013' },
  { name: 'Cynthia Navarro',   phone: '09100000014' },
  { name: 'Ernesto Lim',       phone: '09100000015' },
  { name: 'Gloria Tan',        phone: '09100000016' },
  { name: 'Danilo Soriano',    phone: '09100000017' },
  { name: 'Maricel Castro',    phone: '09100000018' },
  { name: 'Alfredo Abad',      phone: '09100000019' },
  { name: 'Nida Macaraeg',     phone: '09100000020' },
];

// Bets: [numbers, draw_time, bet_type, amount]
const BETS_TEMPLATE = [
  ['1-2-3', '2PM', 'straight',  20],
  ['1-2-3', '2PM', 'straight',  10],
  ['4-5-6', '2PM', 'straight',  50],
  ['4-5-6', '2PM', 'rambolito', 20],
  ['7-8-9', '2PM', 'straight',  10],
  ['0-0-1', '2PM', 'rambolito', 30],
  ['2-2-2', '2PM', 'straight',  100],
  ['3-6-9', '2PM', 'straight',  20],
  ['1-2-3', '5PM', 'straight',  10],
  ['5-5-5', '5PM', 'straight',  50],
  ['5-5-5', '5PM', 'rambolito', 20],
  ['8-8-8', '5PM', 'straight',  30],
  ['0-1-2', '5PM', 'straight',  10],
  ['4-5-6', '5PM', 'straight',  20],
  ['7-7-7', '5PM', 'straight',  100],
  ['9-0-1', '9PM', 'straight',  10],
  ['1-2-3', '9PM', 'straight',  50],
  ['6-6-6', '9PM', 'straight',  20],
  ['3-3-3', '9PM', 'rambolito', 30],
  ['4-5-6', '9PM', 'straight',  10],
];

const today = new Date().toISOString().slice(0, 10);

(async () => {
  const hashed = await bcrypt.hash('test1234', 10);

  console.log('Creating 20 test players...');
  const userIds = [];

  for (const p of PLAYERS) {
    // Upsert user (skip if already exists)
    const { data: existing } = await supabase.from('users').select('id').eq('phone', p.phone).maybeSingle();
    if (existing) {
      userIds.push(existing.id);
      console.log(`  ↩ ${p.name} already exists (id ${existing.id})`);
      continue;
    }
    const { data: user, error } = await supabase.from('users')
      .insert({ name: p.name, phone: p.phone, password: hashed, balance: 500 })
      .select('id').single();
    if (error) { console.error(`  ❌ ${p.name}:`, error.message); userIds.push(null); continue; }
    userIds.push(user.id);
    console.log(`  ✅ Created ${p.name} (id ${user.id})`);
  }

  console.log('\nPlacing bets...');
  for (let i = 0; i < PLAYERS.length; i++) {
    const userId = userIds[i];
    if (!userId) continue;
    const [numbers, draw_time, bet_type, amount] = BETS_TEMPLATE[i];

    const { data, error } = await supabase.rpc('place_bet', {
      p_user_id:   userId,
      p_numbers:   numbers,
      p_draw_date: today,
      p_draw_time: draw_time,
      p_bet_type:  bet_type,
      p_amount:    amount,
    });

    if (error || data?.error) {
      console.error(`  ❌ Bet for ${PLAYERS[i].name}:`, error?.message || data?.error);
    } else {
      console.log(`  ✅ ${PLAYERS[i].name} → ${numbers} (${draw_time}, ${bet_type}, ₱${amount})`);
    }
  }

  console.log('\nDone! Go to the admin panel and click Load to see the bets.');
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
