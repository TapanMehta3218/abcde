const express = require('express');
const router = express.Router();
const {
  getDeliveries, getDeliveryById, createDelivery, validateDelivery
} = require('../controllers/deliveryController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', getDeliveries);
router.get('/:id', getDeliveryById);
router.post('/', createDelivery);
router.post('/:id/validate', validateDelivery);

module.exports = router;
