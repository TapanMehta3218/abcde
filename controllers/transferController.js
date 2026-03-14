const db = require('../config/database');

// GET /api/transfers
const getTransfers = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT t.*, ws.name AS source_warehouse_name, wd.name AS destination_warehouse_name,
             u.username AS created_by_name, COUNT(ti.id) AS item_count
      FROM transfers t
      LEFT JOIN warehouses ws ON ws.id = t.source_warehouse_id
      LEFT JOIN warehouses wd ON wd.id = t.destination_warehouse_id
      LEFT JOIN users u ON u.id = t.created_by
      LEFT JOIN transfer_items ti ON ti.transfer_id = t.id
      GROUP BY t.id, ws.name, wd.name, u.username
      ORDER BY t.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/transfers/:id
const getTransferById = async (req, res) => {
  try {
    const transfer = await db.query(
      `SELECT t.*, ws.name AS source_warehouse_name, wd.name AS destination_warehouse_name
       FROM transfers t
       LEFT JOIN warehouses ws ON ws.id = t.source_warehouse_id
       LEFT JOIN warehouses wd ON wd.id = t.destination_warehouse_id
       WHERE t.id = $1`,
      [req.params.id]
    );
    if (transfer.rows.length === 0) return res.status(404).json({ message: 'Transfer not found' });

    const items = await db.query(
      `SELECT ti.*, p.name AS product_name, p.sku, p.unit_of_measure
       FROM transfer_items ti LEFT JOIN products p ON p.id = ti.product_id
       WHERE ti.transfer_id = $1`,
      [req.params.id]
    );

    res.json({ ...transfer.rows[0], items: items.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/transfers
const createTransfer = async (req, res) => {
  const { source_warehouse_id, destination_warehouse_id, notes, items } = req.body;
  const client = await require('../config/database').pool.connect();
  try {
    await client.query('BEGIN');

    if (source_warehouse_id === destination_warehouse_id) {
      throw new Error('Source and destination warehouse must be different');
    }

    const transfer = await client.query(
      `INSERT INTO transfers (source_warehouse_id, destination_warehouse_id, notes, status, created_by)
       VALUES ($1, $2, $3, 'pending', $4) RETURNING *`,
      [source_warehouse_id, destination_warehouse_id, notes, req.user.id]
    );

    for (const item of items) {
      await client.query(
        `INSERT INTO transfer_items (transfer_id, product_id, quantity)
         VALUES ($1, $2, $3)`,
        [transfer.rows[0].id, item.product_id, item.quantity]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Transfer created', transfer: transfer.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message || 'Server error' });
  } finally {
    client.release();
  }
};

// POST /api/transfers/:id/validate
const validateTransfer = async (req, res) => {
  const client = await require('../config/database').pool.connect();
  try {
    await client.query('BEGIN');

    const transferRes = await client.query('SELECT * FROM transfers WHERE id = $1', [req.params.id]);
    if (transferRes.rows.length === 0) throw new Error('Transfer not found');
    if (transferRes.rows[0].status !== 'pending') throw new Error('Transfer is not pending');

    const transfer = transferRes.rows[0];
    const items = await client.query('SELECT * FROM transfer_items WHERE transfer_id = $1', [transfer.id]);

    for (const item of items.rows) {
      // Stock out from source
      await client.query(
        `INSERT INTO stock_movements
          (product_id, movement_type, quantity_change, source_warehouse_id, destination_warehouse_id, reference_id, reference_type, created_by)
         VALUES ($1, 'transfer_out', $2, $3, $4, $5, 'transfer', $6)`,
        [item.product_id, item.quantity, transfer.source_warehouse_id, transfer.destination_warehouse_id, transfer.id, req.user.id]
      );

      // Stock in to destination
      await client.query(
        `INSERT INTO stock_movements
          (product_id, movement_type, quantity_change, source_warehouse_id, destination_warehouse_id, reference_id, reference_type, created_by)
         VALUES ($1, 'transfer_in', $2, $3, $4, $5, 'transfer', $6)`,
        [item.product_id, item.quantity, transfer.source_warehouse_id, transfer.destination_warehouse_id, transfer.id, req.user.id]
      );
    }

    await client.query(
      `UPDATE transfers SET status = 'done', completed_at = NOW(), validated_by = $1 WHERE id = $2`,
      [req.user.id, transfer.id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Transfer completed successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message || 'Server error' });
  } finally {
    client.release();
  }
};

module.exports = { getTransfers, getTransferById, createTransfer, validateTransfer };
