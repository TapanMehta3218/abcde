const db = require('../config/database');

// GET /api/deliveries
const getDeliveries = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT d.*, w.name AS warehouse_name, u.username AS created_by_name,
             COUNT(di.id) AS item_count
      FROM deliveries d
      LEFT JOIN warehouses w ON w.id = d.warehouse_id
      LEFT JOIN users u ON u.id = d.created_by
      LEFT JOIN delivery_items di ON di.delivery_id = d.id
      GROUP BY d.id, w.name, u.username
      ORDER BY d.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/deliveries/:id
const getDeliveryById = async (req, res) => {
  try {
    const delivery = await db.query(
      `SELECT d.*, w.name AS warehouse_name, u.username AS created_by_name
       FROM deliveries d LEFT JOIN warehouses w ON w.id = d.warehouse_id
       LEFT JOIN users u ON u.id = d.created_by WHERE d.id = $1`,
      [req.params.id]
    );
    if (delivery.rows.length === 0) return res.status(404).json({ message: 'Delivery not found' });

    const items = await db.query(
      `SELECT di.*, p.name AS product_name, p.sku, p.unit_of_measure
       FROM delivery_items di LEFT JOIN products p ON p.id = di.product_id
       WHERE di.delivery_id = $1`,
      [req.params.id]
    );

    res.json({ ...delivery.rows[0], items: items.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/deliveries
const createDelivery = async (req, res) => {
  const { customer_name, warehouse_id, scheduled_date, notes, items } = req.body;
  const client = await require('../config/database').pool.connect();
  try {
    await client.query('BEGIN');

    const delivery = await client.query(
      `INSERT INTO deliveries (customer_name, warehouse_id, scheduled_date, notes, status, created_by)
       VALUES ($1, $2, $3, $4, 'pending', $5) RETURNING *`,
      [customer_name, warehouse_id, scheduled_date, notes, req.user.id]
    );

    for (const item of items) {
      await client.query(
        `INSERT INTO delivery_items (delivery_id, product_id, quantity_ordered)
         VALUES ($1, $2, $3)`,
        [delivery.rows[0].id, item.product_id, item.quantity]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Delivery order created', delivery: delivery.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
};

// POST /api/deliveries/:id/validate
const validateDelivery = async (req, res) => {
  const { items } = req.body;
  const client = await require('../config/database').pool.connect();
  try {
    await client.query('BEGIN');

    const deliveryRes = await client.query('SELECT * FROM deliveries WHERE id = $1', [req.params.id]);
    if (deliveryRes.rows.length === 0) throw new Error('Delivery not found');
    if (deliveryRes.rows[0].status !== 'pending') throw new Error('Delivery is not pending');

    const delivery = deliveryRes.rows[0];

    for (const item of items) {
      const diRes = await client.query('SELECT * FROM delivery_items WHERE id = $1', [item.delivery_item_id]);
      const di = diRes.rows[0];

      await client.query(
        'UPDATE delivery_items SET quantity_shipped = $1 WHERE id = $2',
        [item.quantity_shipped, item.delivery_item_id]
      );

      await client.query(
        `INSERT INTO stock_movements
          (product_id, movement_type, quantity_change, source_warehouse_id, reference_id, reference_type, created_by)
         VALUES ($1, 'delivery', $2, $3, $4, 'delivery', $5)`,
        [di.product_id, item.quantity_shipped, delivery.warehouse_id, delivery.id, req.user.id]
      );
    }

    await client.query(
      `UPDATE deliveries SET status = 'shipped', shipped_at = NOW(), validated_by = $1 WHERE id = $2`,
      [req.user.id, req.params.id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Delivery validated and shipped' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message || 'Server error' });
  } finally {
    client.release();
  }
};

module.exports = { getDeliveries, getDeliveryById, createDelivery, validateDelivery };
