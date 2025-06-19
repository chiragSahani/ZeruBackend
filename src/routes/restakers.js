const express = require('express');
const router = express.Router();
const restakerController = require('../controllers/restakersController');

/**
 * @route GET /api/restakers
 * @desc Get all restakers with their staking information
 * @access Public
 */
router.get('/', restakerController.getAllRestakers);

/**
 * @route GET /api/restakers/:address
 * @desc Get specific restaker information by address
 * @access Public
 */
router.get('/:address', restakerController.getRestakerByAddress);

/**
 * @route GET /api/restakers/stats/summary
 * @desc Get restaking statistics summary
 * @access Public
 */
router.get('/stats/summary', restakerController.getRestakingStats);

module.exports = router;