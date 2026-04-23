const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/betController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(authenticate);

router.get('/available-draws', ctrl.getAvailableDraws);

router.get('/', ctrl.getMyBets);

router.post('/',
  [
    body('draw_time').isIn(['2PM', '5PM', '9PM']).withMessage('Invalid draw time.'),
    body('numbers').matches(/^\d-\d-\d$/).withMessage('Numbers must be in D-D-D format.'),
    body('bet_type').optional().isIn(['straight', 'rambolito']).withMessage('Invalid bet type.'),
    body('amount').isFloat({ min: 5 }).withMessage('Minimum bet is ₱5.'),
  ],
  validate,
  ctrl.placeBet
);

router.patch('/:id/cancel', ctrl.cancelBet);

module.exports = router;
