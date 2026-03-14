const express = require('express');
const router = express.Router();
const {
  getReceipts, getReceiptById, createReceipt, validateReceipt
} = require('../controllers/receiptController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', getReceipts);
router.get('/:id', getReceiptById);
router.post('/', createReceipt);
router.post('/:id/validate', validateReceipt);

module.exports = router;
