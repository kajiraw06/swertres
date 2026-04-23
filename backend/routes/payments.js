const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

// Public — no auth (players need to see where to send before logging in)
router.get('/admin-gcash', ctrl.getAdminGcash);

// All other routes require authentication
router.use(authenticate);

router.post('/gcash-checkout',
  [body('amount').isFloat({ min: 100 }).withMessage('Minimum deposit is ₱100.')],
  validate,
  ctrl.createGcashCheckout
);

router.post('/qrph-checkout',
  [body('amount').isFloat({ min: 100 }).withMessage('Minimum deposit is ₱100.')],
  validate,
  ctrl.createQrphCheckout
);

router.post('/deposit',
  [
    body('amount').isFloat({ min: 50 }).withMessage('Minimum deposit is ₱50.'),
    body('gcash_reference').trim().notEmpty().withMessage('GCash reference number required.'),
  ],
  validate,
  ctrl.createDeposit
);

router.get('/status/:paymentId', ctrl.getStatus);
router.get('/history', ctrl.getHistory);
router.get('/withdrawals', ctrl.getMyWithdrawals);
router.post('/withdraw',
  [body('amount').isFloat({ min: 100 }).withMessage('Minimum withdrawal is ₱100.'),
   body('gcash_number').matches(/^09\d{9}$/).withMessage('Enter valid GCash number (09XXXXXXXXX).'),
   body('gcash_name').trim().notEmpty().withMessage('GCash account name required.')],
  validate,
  ctrl.requestWithdrawal
);

module.exports = router;
