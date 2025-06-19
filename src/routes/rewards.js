const express = require('express');
const router = express.Router();
const rewardsController = require('../controllers/rewardsController');

/**
 * @route GET /api/rewards/:address
 * @desc Get rewards information for a specific address
 * @access Public
 */
router.get('/:address', rewardsController.getRewardsByAddress);

/**
 * @route GET /api/rewards/:address/history
 * @desc Get detailed rewards history for a specific address
 * @access Public
 */
router.get('/:address/history', rewardsController.getRewardsHistory);

/**
 * @route GET /api/rewards/stats/total
 * @desc Get total rewards statistics across all users
 * @access Public
 */
router.get('/stats/total', rewardsController.getTotalRewardsStats);

module.exports = router;