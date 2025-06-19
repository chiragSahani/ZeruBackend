const express = require('express');
const router = express.Router();
const validatorController = require('../controllers/validatorsController');

/**
 * @route GET /api/validators
 * @desc Get all validators with their information and slash history
 * @access Public
 */
router.get('/', validatorController.getAllValidators);

/**
 * @route GET /api/validators/:address
 * @desc Get specific validator information by operator address
 * @access Public
 */
router.get('/:address', validatorController.getValidatorByAddress);

/**
 * @route GET /api/validators/stats/summary
 * @desc Get validator statistics summary
 * @access Public
 */
router.get('/stats/summary', validatorController.getValidatorStats);

module.exports = router;