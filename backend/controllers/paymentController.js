const supabase = require('../config/supabase');
const QRCode   = require('qrcode');
const crypto   = require('crypto');

// ── In-memory token store: token -> { gcashNumber, gcashName, amount, expiresAt } ──
const gcashPayTokens = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of gcashPayTokens) {
    if (v.expiresAt < now) gcashPayTokens.delete(k);
  }
}, 5 * 60 * 1000);

// GET /api/payments/admin-gcash  (public — no auth needed)
exports.getAdminGcash = (req, res) => {
  res.json({
    number: process.env.ADMIN_GCASH_NUMBER || '09XXXXXXXXX',
    name:   process.env.ADMIN_GCASH_NAME   || 'Swertres Admin',
  });
};

// GET /api/pay/:token  (PUBLIC — serves GCash redirect page)
exports.handleGcashPayLink = (req, res) => {
  const record = gcashPayTokens.get(req.params.token);
  if (!record || record.expiresAt < Date.now()) {
    return res.status(410).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Expired</title><style>body{font-family:sans-serif;text-align:center;padding:40px;background:#fef2f2}h2{color:#991b1b}p{color:#6b7280}</style></head><body><h2>\u274C Link Expired</h2><p>This QR code has expired. Please generate a new one in the app.</p></body></html>`);
  }

  const { gcashNumber, gcashName, amount } = record;
  const masked = gcashNumber.replace(/^(09\d{2})\d{5}(\d{2})$/, '$1XXXXX$2');
  const deepLink = `gcash://send?to=${gcashNumber}&amount=${Math.round(amount)}`;
  const formatted = parseFloat(amount).toLocaleString('en-PH', { minimumFractionDigits: 2 });

  return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Swertres \u2014 GCash Deposit</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:linear-gradient(135deg,#f0fdf4,#dcfce7);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .card{background:#fff;border-radius:24px;padding:32px 24px;max-width:360px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,0.15);text-align:center}
    .logo{font-size:44px;margin-bottom:10px}
    h1{font-size:20px;color:#065f46;font-weight:900;margin-bottom:4px}
    .sub{color:#9ca3af;font-size:13px;margin-bottom:24px}
    .amount{font-size:46px;font-weight:900;color:#059669;letter-spacing:-1px;margin-bottom:4px}
    .amt-label{font-size:13px;color:#9ca3af;margin-bottom:20px}
    .info{background:#f0fdf4;border:1.5px solid #86efac;border-radius:14px;padding:16px 18px;margin-bottom:24px;text-align:left}
    .row{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:14px}
    .row:last-child{margin-bottom:0}
    .row-label{color:#6b7280}
    .row-val{font-weight:800;color:#065f46}
    .btn{display:block;width:100%;padding:18px;background:linear-gradient(90deg,#059669,#10b981);color:#fff;border:none;border-radius:16px;font-size:18px;font-weight:900;cursor:pointer;text-decoration:none;margin-bottom:16px;box-shadow:0 4px 16px rgba(5,150,105,0.4)}
    ol{text-align:left;font-size:13px;color:#374151;padding-left:20px;line-height:1.8;margin-bottom:16px}
    .note{font-size:12px;color:#d1d5db;margin-top:8px}
    .warn{background:#fefce8;border:1px solid #fde047;border-radius:10px;padding:10px 14px;font-size:13px;color:#854d0e;margin-top:16px}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">\uD83D\uDCB8</div>
    <h1>Swertres Deposit</h1>
    <p class="sub">Send via GCash</p>
    <div class="amount">\u20B1${formatted}</div>
    <p class="amt-label">Send EXACTLY this amount</p>
    <div class="info">
      <div class="row"><span class="row-label">Send to</span><span class="row-val">${gcashName}</span></div>
      <div class="row"><span class="row-label">Number</span><span class="row-val">${masked}</span></div>
      <div class="row"><span class="row-label">Amount</span><span class="row-val">\u20B1${formatted}</span></div>
    </div>
    <a class="btn" href="${deepLink}" id="openBtn">\uD83D\uDCF1 Open GCash App</a>
    <ol>
      <li>Tap <strong>Open GCash App</strong> above</li>
      <li>Send exactly <strong>\u20B1${formatted}</strong></li>
      <li>Save your <strong>reference number</strong></li>
      <li>Go back to Swertres &rarr; Wallet &rarr; submit reference</li>
    </ol>
    <div class="warn">\u26A0\uFE0F Do NOT close Swertres before submitting your reference number.</div>
    <p class="note">\u23F0 This link expires 30 minutes after QR was generated</p>
  </div>
  <script>
    // Auto-attempt GCash deep link on mobile
    if (/android|iphone|ipad/i.test(navigator.userAgent)) {
      setTimeout(() => { window.location.href = '${deepLink}'; }, 600);
    }
  </script>
</body>
</html>`);
};

// POST /api/payments/gcash-link  (authenticated — creates token URL + QR)
exports.createGcashLink = async (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);
    if (isNaN(amount) || amount < 100)
      return res.status(400).json({ message: 'Minimum deposit is \u20B1100.' });

    const gcashNumber = process.env.ADMIN_GCASH_NUMBER;
    const gcashName   = process.env.ADMIN_GCASH_NAME || 'Swertres Admin';
    if (!gcashNumber)
      return res.status(503).json({ message: 'GCash deposit temporarily unavailable.' });

    // Create a 30-minute single-use token
    const token = crypto.randomBytes(20).toString('hex');
    gcashPayTokens.set(token, {
      gcashNumber,
      gcashName,
      amount,
      userId:    req.user.id,
      expiresAt: Date.now() + 30 * 60 * 1000,
    });

    const baseUrl = process.env.BACKEND_URL || 'https://swertres-backend.fly.dev';
    const payUrl  = `${baseUrl}/api/payments/pay/${token}`;

    // QR encodes a URL — phone number is never in the QR
    const qrImage = await QRCode.toDataURL(payUrl, {
      width:  300,
      margin: 2,
      color:  { dark: '#065f46', light: '#ffffff' },
    });

    return res.json({ qr_image: qrImage, amount });
  } catch (err) {
    console.error('GCash link error:', err.message);
    return res.status(500).json({ message: 'Failed to generate payment QR.' });
  }
};

// POST /api/payments/deposit
exports.createDeposit = async (req, res) => {
  try {
    const { amount, gcash_reference } = req.body;
    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount < 50)
      return res.status(400).json({ message: 'Minimum deposit is ₱50.' });
    const ref = (gcash_reference || '').trim();
    if (!ref) return res.status(400).json({ message: 'Enter your GCash reference number.' });

    // Prevent duplicate reference submissions
    const { data: dup } = await supabase.from('payments').select('id').eq('paymongo_id', ref).maybeSingle();
    if (dup) return res.status(400).json({ message: 'This reference number was already submitted.' });

    const { data: user } = await supabase.from('users').select('id, balance').eq('id', req.user.id).single();

    // Create pending transaction (balance_after stays same until admin approves)
    const { data: txn, error: txnErr } = await supabase.from('transactions').insert({
      user_id:        user.id,
      type:           'deposit',
      amount:         depositAmount,
      balance_before: parseFloat(user.balance),
      balance_after:  parseFloat(user.balance),
      note:           `GCash deposit ₱${depositAmount} — ref: ${ref} (pending approval)`,
    }).select().single();
    if (txnErr) throw txnErr;

    // Record pending deposit (reusing paymongo_id column for GCash reference)
    await supabase.from('payments').insert({
      user_id:        user.id,
      transaction_id: txn.id,
      paymongo_id:    ref,
      amount:         depositAmount,
      status:         'pending',
    });

    return res.status(201).json({
      message: `Deposit request of ₱${depositAmount} submitted. Admin will verify and credit your balance shortly.`,
    });
  } catch (err) {
    console.error('Deposit error:', err.message);
    return res.status(500).json({ message: 'Failed to submit deposit request. Please try again.' });
  }
};

// (QRPh PayMongo checkout removed)
exports.createQrphCheckout = (req, res) => res.status(410).json({ message: 'This payment method is no longer available.' });

// GET /api/payments/history
exports.getHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { data: transactions, count } = await supabase
      .from('transactions').select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);
    return res.json({ total: count, page: parseInt(page), transactions: transactions || [] });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to retrieve history.' });
  }
};

// GET /api/payments/withdrawals
exports.getMyWithdrawals = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('withdrawals')
      .select('id, amount, gcash_number, gcash_name, status, note, processed_at, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return res.json({ withdrawals: data || [] });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to retrieve withdrawal history.' });
  }
};

// POST /api/payments/withdraw
exports.requestWithdrawal = async (req, res) => {
  try {
    const { amount, gcash_number, gcash_name } = req.body;
    const userId = req.user.id;
    const withdrawAmount = parseFloat(amount);

    const { data: user } = await supabase.from('users').select('balance').eq('id', userId).single();
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (parseFloat(user.balance) < withdrawAmount)
      return res.status(400).json({ message: 'Insufficient balance.' });

    // Check for existing pending withdrawal
    const { data: existing } = await supabase.from('withdrawals')
      .select('id').eq('user_id', userId).eq('status', 'pending').maybeSingle();
    if (existing) return res.status(400).json({ message: 'You already have a pending withdrawal request.' });

    await supabase.from('withdrawals').insert({
      user_id: userId, amount: withdrawAmount, gcash_number, gcash_name, status: 'pending',
    });
    return res.status(201).json({ message: `Withdrawal request of ₱${withdrawAmount} submitted. Admin will process it shortly.` });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to submit withdrawal request.' });
  }
};


