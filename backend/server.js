/**
 * server.js — Entry point for the Swertres backend
 */
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { startCronJobs } = require('./cron/drawChecker');

const authRoutes    = require('./routes/auth');
const betRoutes     = require('./routes/bets');
const drawRoutes    = require('./routes/draws');
const paymentRoutes = require('./routes/payments');
const adminRoutes   = require('./routes/admin');

const app = express();
app.set('trust proxy', 1);

// ── Security middleware ─────────────────────────────────────────────────────
app.use(helmet());

app.use(cors({
  origin: [
    process.env.APP_URL || 'http://localhost:3000',
    'https://kajiraw06.github.io',
    'http://localhost:3001',
    'http://localhost:3000',
  ],
  credentials: true,
}));

// Rate limiting
const limiter = (max) => rateLimit({ windowMs: 15 * 60 * 1000, max, standardHeaders: true, legacyHeaders: false, validate: { xForwardedForHeader: false } });
app.use('/api/auth/',     limiter(200));
app.use('/api/bets/',     limiter(500));
app.use('/api/payments/', limiter(300));
app.use('/api/admin/',    limiter(500));

// Webhook needs raw body — must be registered BEFORE express.json()
const paymentCtrl = require('./controllers/paymentController');
app.post('/api/payments/webhook', express.raw({ type: '*/*' }), paymentCtrl.handleWebhook);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/bets',     betRoutes);
app.use('/api/draws',    drawRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin',    adminRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// ── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ message: 'Route not found.' }));

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error.' });
});

// ── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Swertres backend running on port ${PORT}`);
  startCronJobs();
});
