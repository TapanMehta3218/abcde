const db = require('../config/database');
const stockService = require('../services/stockService');

// GET /api/receipts
const getReceipts = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT r.*, w.name AS warehouse_name, u.username AS created_by_name,
             COUNT(ri.id) AS item_count
      FROM receipts r
      LEFT JOIN warehouses w ON w.id = r.warehouse_id
      LEFT JOIN users u ON u.id = r.created_by
      LEFT JOIN receipt_items ri ON ri.receipt_id = r.id
      GROUP BY r.id, w.name, u.username
      ORDER BY r.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/receipts/:id
const getReceiptById = async (req, res) => {
  try {
    const receipt = await db.query(
      `SELECT r.*, w.name AS warehouse_name, u.username AS created_by_name
       FROM receipts r LEFT JOIN warehouses w ON w.id = r.warehouse_id
       LEFT JOIN users u ON u.id = r.created_by WHERE r.id = $1`,
      [req.params.id]
    );
    if (receipt.rows.length === 0) return res.status(404).json({ message: 'Receipt not found' });

    const items = await db.query(
      `SELECT ri.*, p.name AS product_name, p.sku, p.unit_of_measure
       FROM receipt_items ri LEFT JOIN products p ON p.id = ri.product_id
       WHERE ri.receipt_id = $1`,
      [req.params.id]
    );

    res.json({ ...receipt.rows[0], items: items.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/receipts
const createReceipt = async (req, res) => {
  const { supplier_name, warehouse_id, expected_date, notes, items } = req.body;
  const client = await require('../config/database').pool.connect();
  try {
    await client.query('BEGIN');

    const receipt = await client.query(
      `INSERT INTO receipts (supplier_name, warehouse_id, expected_date, notes, status, created_by)
       VALUES ($1, $2, $3, $4, 'pending', $5) RETURNING *`,
      [supplier_name, warehouse_id, expected_date, notes, req.user.id]
    );

    const receiptId = receipt.rows[0].id;

    // Insert receipt items
    for (const item of items) {
      await client.query(
        `INSERT INTO receipt_items (receipt_id, product_id, quantity_expected)
         VALUES ($1, $2, $3)`,
        [receiptId, item.product_id, item.quantity]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Receipt created', receipt: receipt.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create receipt error:', err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
};

// POST /api/receipts/:id/validate
const validateReceipt = async (req, res) => {
  const { items } = req.body; // items: [{ receipt_item_id, quantity_received }]
  const client = await require('../config/database').pool.connect();
  try {
    await client.query('BEGIN');

    const receiptRes = await client.query('SELECT * FROM receipts WHERE id = $1', [req.params.id]);
    if (receiptRes.rows.length === 0) throw new Error('Receipt not found');
    if (receiptRes.rows[0].status !== 'pending') throw new Error('Receipt is not pending');

    const receipt = receiptRes.rows[0];

    for (const item of items) {
      const riRes = await client.query('SELECT * FROM receipt_items WHERE id = $1', [item.receipt_item_id]);
      const ri = riRes.rows[0];

      await client.query(
        'UPDATE receipt_items SET quantity_received = $1 WHERE id = $2',
        [item.quantity_received, item.receipt_item_id]
      );

      // Create stock movement
      await client.query(
        `INSERT INTO stock_movements
          (product_id, movement_type, quantity_change, destination_warehouse_id, reference_id, reference_type, created_by)
         VALUES ($1, 'receipt', $2, $3, $4, 'receipt', $5)`,
        [ri.product_id, item.quantity_received, receipt.warehouse_id, receipt.id, req.user.id]
      );
    }

    await client.query(
      `UPDATE receipts SET status = 'validated', validated_at = NOW(), validated_by = $1 WHERE id = $2`,
      [req.user.id, req.params.id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Receipt validated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Validate receipt error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  } finally {
    client.release();
  }
};

module.exports = { getReceipts, getReceiptById, createReceipt, validateReceipt };
