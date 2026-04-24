const supabase = require('../config/supabase');
const axios    = require('axios');

const PM_BASE = 'https://api.paymongo.com/v1';
const pmHeaders = () => ({
  Authorization:  `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY + ':').toString('base64')}`,
  'Content-Type': 'application/json',
});

// GET /api/payments/admin-gcash  (public — no auth needed)
exports.getAdminGcash = (req, res) => {
  res.json({
    number: process.env.ADMIN_GCASH_NUMBER || '09XXXXXXXXX',
    name:   process.env.ADMIN_GCASH_NAME   || 'Swertres Admin',
  });
};

// POST /api/payments/gcash-checkout  (automatic via PayMongo)
exports.createGcashCheckout = async (req, res) => {
  try {
    const { amount } = req.body;
    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount < 100)
      return res.status(400).json({ message: 'Minimum deposit is ₱100.' });

    const { data: user } = await supabase
      .from('users').select('id, name, phone, email, balance').eq('id', req.user.id).single();
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Create pending transaction (balance credited only after webhook)
    const { data: txn, error: txnErr } = await supabase.from('transactions').insert({
      user_id:        user.id,
      type:           'deposit',
      amount:         depositAmount,
      balance_before: parseFloat(user.balance),
      balance_after:  parseFloat(user.balance),
      note:           `GCash deposit ₱${depositAmount} — awaiting PayMongo confirmation`,
    }).select().single();
    if (txnErr) throw txnErr;

    // Create payment record first to get our internal ID for the redirect URL
    const { data: payment, error: pmtErr } = await supabase.from('payments').insert({
      user_id:        user.id,
      transaction_id: txn.id,
      amount:         depositAmount,
      status:         'pending',
    }).select().single();
    if (pmtErr) throw pmtErr;

    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    // Create PayMongo GCash source
    const sourceRes = await axios.post(`${PM_BASE}/sources`, {
      data: {
        attributes: {
          amount:   Math.round(depositAmount * 100), // centavos
          redirect: {
            success: `${appUrl}/payment-result?success=true&payment_id=${payment.id}`,
            failed:  `${appUrl}/payment-result?success=false&payment_id=${payment.id}`,
          },
          billing: {
            name:  user.name || 'Swertres User',
            phone: user.phone || '',
            email: user.email || ((user.phone || '').replace(/\D/g, '') ? `${(user.phone || '').replace(/\D/g, '')}@swertres.app` : `user${user.id}@swertres.app`),
          },
          type:     'gcash',
          currency: 'PHP',
        },
      },
    }, { headers: pmHeaders() });

    const source      = sourceRes.data.data;
    const checkoutUrl = source.attributes.redirect.checkout_url;

    // Save PayMongo source ID + checkout URL to payment record
    await supabase.from('payments').update({
      paymongo_id:  source.id,
      checkout_url: checkoutUrl,
    }).eq('id', payment.id);

    return res.json({ checkout_url: checkoutUrl, payment_id: payment.id });
  } catch (err) {
    console.error('GCash checkout error:', err.response?.data || err.message);
    return res.status(500).json({ message: 'Failed to create GCash checkout. Please try again.' });
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

// POST /api/payments/qrph-checkout  (automated QRPh scan-to-pay via PayMongo)
exports.createQrphCheckout = async (req, res) => {
  try {
    const { amount } = req.body;
    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount < 100)
      return res.status(400).json({ message: 'Minimum deposit is ₱100.' });

    const { data: user } = await supabase
      .from('users').select('id, name, phone, email, balance').eq('id', req.user.id).single();
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Step 1: Create Payment Intent
    // NOTE: No transaction/payment DB record until webhook confirms payment
    const piRes = await axios.post(`${PM_BASE}/payment_intents`, {
      data: {
        attributes: {
          amount:                 Math.round(depositAmount * 100),
          currency:               'PHP',
          payment_method_allowed: ['qrph'],
          capture_type:           'automatic',
          description:            `Swertres deposit ₱${depositAmount}`,
        },
      },
    }, { headers: pmHeaders() });
    const pi = piRes.data.data;

    // Step 2: Create Payment Method
    const phoneDigits = (user.phone || '').replace(/\D/g, '');
    const billingEmail = user.email || (phoneDigits ? `${phoneDigits}@swertres.app` : `user${user.id}@swertres.app`);
    const pmRes = await axios.post(`${PM_BASE}/payment_methods`, {
      data: {
        attributes: {
          type: 'qrph',
          billing: {
            name:  user.name || 'Swertres User',
            phone: user.phone || '',
            email: billingEmail,
          },
        },
      },
    }, { headers: pmHeaders() });
    const pm = pmRes.data.data;

    // Step 3: Attach to get QR code
    const appUrl = process.env.APP_URL || 'https://thunderous-lebkuchen-0b668c.netlify.app';
    const attRes = await axios.post(`${PM_BASE}/payment_intents/${pi.id}/attach`, {
      data: {
        attributes: {
          payment_method: pm.id,
          return_url:     appUrl,
        },
      },
    }, { headers: pmHeaders() });
    const attached = attRes.data.data;
    const qrCode = attached.attributes.next_action?.code?.image_url;

    // Save minimal record — transaction_id is NULL for QRPh (auto) until webhook fires
    // Admin only sees deposits where transaction_id IS NOT NULL (manual deposits)
    const { data: payment, error: pmtErr } = await supabase.from('payments').insert({
      user_id:     user.id,
      paymongo_id: pi.id,
      amount:      depositAmount,
      status:      'pending',
    }).select().single();
    if (pmtErr) throw pmtErr;

    return res.json({
      payment_id: payment.id,
      qr_code:    qrCode,
    });
  } catch (err) {
    console.error('QRPh checkout error:', err.response?.data || err.message);
    return res.status(500).json({ message: 'Failed to create QR code. Please try again.' });
  }
};

// GET /api/payments/status/:paymentId
exports.getStatus = async (req, res) => {
  try {
    const { data: payment } = await supabase.from('payments')
      .select('status, amount').eq('id', req.params.paymentId).eq('user_id', req.user.id).single();
    if (!payment) return res.status(404).json({ message: 'Payment not found.' });
    return res.json({ status: payment.status, amount: parseFloat(payment.amount) });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to get payment status.' });
  }
};

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

// POST /api/payments/webhook  (public, raw body — registered in server.js)
exports.handleWebhook = async (req, res) => {
  try {
    const sigHeader = req.headers['paymongo-signature'];
    if (!sigHeader) return res.status(400).send('Missing signature');

    const rawBody = req.body.toString('utf8');
    if (!verifyWebhookSignature(rawBody, sigHeader))
      return res.status(401).send('Invalid signature');

    const event = JSON.parse(rawBody);
    const type  = event.data?.attributes?.type;
    const data  = event.data?.attributes?.data;

    if (type === 'source.chargeable') {
      // User authorized GCash payment — now create the PayMongo payment
      const sourceId = data?.id;
      const amount   = data?.attributes?.amount;
      await _chargeSource(sourceId, amount);
    }

    if (type === 'payment.paid') {
      // PayMongo confirms payment received — auto-credit user balance
      // Payment Intent flow (QRPh) uses payment_intent_id; Source flow (GCash) uses source.id
      const paymentIntentId = data?.attributes?.payment_intent_id;
      const sourceId = data?.attributes?.source?.id;
      if (paymentIntentId) await _creditFromSource(paymentIntentId);
      else if (sourceId) await _creditFromSource(sourceId);
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.sendStatus(500);
  }
};

async function _chargeSource(sourceId, amount) {
  try {
    await axios.post(`${PM_BASE}/payments`, {
      data: {
        attributes: {
          amount,
          currency:    'PHP',
          source:      { id: sourceId, type: 'source' },
          description: 'Swertres 3D Lotto deposit',
        },
      },
    }, { headers: pmHeaders() });
    console.log(`[Webhook] Charged source ${sourceId} for ${amount} centavos`);
  } catch (err) {
    console.error('[Webhook] Charge source error:', err.response?.data || err.message);
  }
}

async function _creditFromSource(sourceId) {
  try {
    const { data: payment } = await supabase
      .from('payments')
      .select('id, user_id, amount, transaction_id, status')
      .eq('paymongo_id', sourceId)
      .maybeSingle();

    if (!payment || payment.status !== 'pending') return;

    // For qrph_pending: create the transaction record now (not before)
    let transactionId = payment.transaction_id;
    if (!transactionId) {
      const { data: user } = await supabase.from('users').select('balance').eq('id', payment.user_id).single();
      const balanceBefore = parseFloat(user?.balance || 0);
      const { data: txn, error: txnErr } = await supabase.from('transactions').insert({
        user_id:        payment.user_id,
        type:           'deposit',
        amount:         parseFloat(payment.amount),
        balance_before: balanceBefore,
        balance_after:  balanceBefore,
        note:           `QRPh deposit ₱${payment.amount} — AUTO CREDITED via PayMongo`,
      }).select().single();
      if (txnErr) throw txnErr;
      transactionId = txn.id;
      await supabase.from('payments').update({ transaction_id: transactionId }).eq('id', payment.id);
    }

    const { data: result } = await supabase.rpc('confirm_deposit', {
      p_payment_id:     payment.id,
      p_transaction_id: transactionId,
      p_user_id:        payment.user_id,
      p_amount:         parseFloat(payment.amount),
    });

    if (result?.success) {
      console.log(`[Webhook] ✅ Auto-credited ₱${payment.amount} to user ${payment.user_id}`);
    }
  } catch (err) {
    console.error('[Webhook] Credit error:', err.message);
  }
}

function verifyWebhookSignature(rawBody, sigHeader) {
  const crypto = require('crypto');
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  const parts  = sigHeader.split(',');
  const tPart  = parts.find((p) => p.startsWith('t='));
  const v1Part = parts.find((p) => p.startsWith('v1='));
  if (!tPart || !v1Part) return false;
  const timestamp = tPart.slice(2);
  const signature = v1Part.slice(3);
  const expected  = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}


