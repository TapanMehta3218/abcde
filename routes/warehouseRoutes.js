const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// GET /api/warehouses
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM warehouses WHERE is_active = true ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/warehouses
router.post('/', async (req, res) => {
  const { name, code, address } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO warehouses (name, code, address) VALUES ($1, $2, $3) RETURNING *',
      [name, code, address]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
