const router = require('express').Router();
const { body, query } = require('express-validator');
const ctrl = require('../controllers/adminController');
const { authenticate, adminOnly } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(authenticate, adminOnly);

router.get('/dashboard', ctrl.getDashboard);
router.get('/earnings', ctrl.getEarnings);
router.post('/fetch-results', ctrl.fetchResults);
router.get('/users', ctrl.getUsers);
router.patch('/users/:id/toggle', ctrl.toggleUser);
router.get('/users/:id/transactions', ctrl.getUserTransactions);
router.get('/bets', ctrl.getBets);
router.get('/winners', ctrl.getWinners);
router.get('/draw-winners', ctrl.getDrawWinners);
router.post('/process-draw', ctrl.processDraw);

// Bet limits
router.get('/bet-limits', ctrl.getBetLimits);
router.post('/bet-limits', ctrl.setBetLimit);
router.delete('/bet-limits/:id', ctrl.deleteBetLimit);

// Manual draw result entry
router.post('/draw-result', ctrl.setDrawResult);

// Withdrawals
router.get('/withdrawals', ctrl.getWithdrawals);
router.patch('/withdrawals/:id', ctrl.processWithdrawal);

// Deposits
router.get('/deposits', ctrl.getDeposits);
router.patch('/deposits/:id', ctrl.processDeposit);

router.post('/credit',
  [
    body('user_id').isInt({ min: 1 }).withMessage('Valid user ID required.'),
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be positive.'),
  ],
  validate,
  ctrl.creditUser
);

// Cash bets (face-to-face / paper slip bets placed by admin)
router.post('/cash-bets',
  [
    body('draw_date').isDate().withMessage('Valid draw_date required.'),
    body('draw_time').isIn(['2PM', '5PM', '9PM']).withMessage('Valid draw_time required.'),
    body('bets').isArray({ min: 1 }).withMessage('bets array required.'),
  ],
  validate,
  ctrl.placeCashBets
);

// Handwritten slip OCR via Google Cloud Vision API
router.post('/scan-slip', ctrl.scanSlip);

module.exports = router;
