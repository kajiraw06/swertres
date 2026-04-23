const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.post('/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required.'),
    body('username').trim().matches(/^[a-zA-Z0-9_]{3,20}$/).withMessage('Username must be 3–20 characters (letters, numbers, underscore only).'),
    body('phone').optional({ checkFalsy: true }).trim().matches(/^09\d{9}$/).withMessage('Enter a valid PH mobile number (09XXXXXXXXX).'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
    body('email').optional().isEmail().withMessage('Invalid email address.'),
  ],
  validate,
  ctrl.register
);

router.post('/login',
  [
    body('username').trim().notEmpty().withMessage('Username is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  validate,
  ctrl.login
);

router.post('/forgot-password',
  [
    body('username').trim().notEmpty().withMessage('Username is required.'),
    body('name').trim().notEmpty().withMessage('Full name is required.'),
    body('new_password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
  ],
  validate,
  ctrl.forgotPassword
);

router.get('/me', authenticate, ctrl.getMe);

router.post('/refresh', ctrl.refreshToken);

router.post('/change-password',
  authenticate,
  [
    body('current_password').notEmpty().withMessage('Current password is required.'),
    body('new_password').isLength({ min: 8 }).withMessage('New password must be at least 8 characters.'),
  ],
  validate,
  ctrl.changePassword
);

module.exports = router;
