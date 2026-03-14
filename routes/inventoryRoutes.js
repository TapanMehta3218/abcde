const express = require('express');
const router = express.Router();
const {
  getInventory, getStockLedger, createAdjustment, getAdjustments, getDashboardStats
} = require('../controllers/inventoryController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/dashboard', getDashboardStats);
router.get('/stock-ledger', getStockLedger);
router.get('/adjustments', getAdjustments);
router.post('/adjustments', createAdjustment);
router.get('/', getInventory);

module.exports = router;
