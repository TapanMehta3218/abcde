const express = require('express');
const router = express.Router();
const {
  getTransfers, getTransferById, createTransfer, validateTransfer
} = require('../controllers/transferController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', getTransfers);
router.get('/:id', getTransferById);
router.post('/', createTransfer);
router.post('/:id/validate', validateTransfer);

module.exports = router;
