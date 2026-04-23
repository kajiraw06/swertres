const router = require('express').Router();
const ctrl = require('../controllers/drawController');

router.get('/recent', ctrl.getRecentDraws);
router.get('/', ctrl.getDraws);

module.exports = router;
