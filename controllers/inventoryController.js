const db = require('../config/database');

// GET /api/inventory - stock levels per product per warehouse
const getInventory = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        p.sku,
        p.unit_of_measure,
        p.low_stock_threshold,
        w.id AS warehouse_id,
        w.name AS warehouse_name,
        COALESCE(
          SUM(CASE
            WHEN sm.movement_type IN ('receipt', 'adjustment_in', 'transfer_in') THEN sm.quantity_change
            WHEN sm.movement_type IN ('delivery', 'adjustment_out', 'transfer_out') THEN -sm.quantity_change
            ELSE 0
          END), 0
        ) + CASE WHEN sm.destination_warehouse_id = w.id OR sm.source_warehouse_id IS NULL THEN p.initial_stock ELSE 0 END AS stock_level
      FROM products p
      CROSS JOIN warehouses w
      LEFT JOIN stock_movements sm ON sm.product_id = p.id
        AND (sm.source_warehouse_id = w.id OR sm.destination_warehouse_id = w.id)
      WHERE p.is_active = true AND w.is_active = true
      GROUP BY p.id, p.name, p.sku, p.unit_of_measure, p.low_stock_threshold, p.initial_stock, w.id, w.name
      ORDER BY p.name, w.name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Get inventory error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/inventory/stock-ledger
const getStockLedger = async (req, res) => {
  try {
    const { product_id, warehouse_id, start_date, end_date, movement_type } = req.query;
    let query = `
      SELECT sm.*, p.name AS product_name, p.sku,
             ws.name AS source_warehouse_name, wd.name AS destination_warehouse_name,
             u.username AS created_by_name
      FROM stock_movements sm
      LEFT JOIN products p ON p.id = sm.product_id
      LEFT JOIN warehouses ws ON ws.id = sm.source_warehouse_id
      LEFT JOIN warehouses wd ON wd.id = sm.destination_warehouse_id
      LEFT JOIN users u ON u.id = sm.created_by
      WHERE 1=1
    `;
    const params = [];

    if (product_id) { params.push(product_id); query += ` AND sm.product_id = $${params.length}`; }
    if (warehouse_id) {
      params.push(warehouse_id);
      query += ` AND (sm.source_warehouse_id = $${params.length} OR sm.destination_warehouse_id = $${params.length})`;
    }
    if (movement_type) { params.push(movement_type); query += ` AND sm.movement_type = $${params.length}`; }
    if (start_date) { params.push(start_date); query += ` AND sm.created_at >= $${params.length}`; }
    if (end_date) { params.push(end_date); query += ` AND sm.created_at <= $${params.length}`; }

    query += ` ORDER BY sm.created_at DESC LIMIT 500`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Stock ledger error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/inventory/adjustments
const createAdjustment = async (req, res) => {
  const { product_id, warehouse_id, quantity_change, reason, notes } = req.body;
  try {
    const movementType = quantity_change >= 0 ? 'adjustment_in' : 'adjustment_out';
    const result = await db.query(
      `INSERT INTO stock_movements
        (product_id, movement_type, quantity_change, destination_warehouse_id, reference_type, notes, created_by)
       VALUES ($1, $2, $3, $4, 'adjustment', $5, $6) RETURNING *`,
      [product_id, movementType, Math.abs(quantity_change), warehouse_id, notes || reason, req.user.id]
    );

    await db.query(
      `INSERT INTO inventory_adjustments (product_id, warehouse_id, quantity_change, reason, notes, movement_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [product_id, warehouse_id, quantity_change, reason, notes, result.rows[0].id, req.user.id]
    );

    res.status(201).json({ message: 'Adjustment applied', movement: result.rows[0] });
  } catch (err) {
    console.error('Adjustment error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/inventory/adjustments
const getAdjustments = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT ia.*, p.name AS product_name, p.sku, w.name AS warehouse_name, u.username AS created_by_name
      FROM inventory_adjustments ia
      LEFT JOIN products p ON p.id = ia.product_id
      LEFT JOIN warehouses w ON w.id = ia.warehouse_id
      LEFT JOIN users u ON u.id = ia.created_by
      ORDER BY ia.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/inventory/dashboard
const getDashboardStats = async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM products WHERE is_active = true) AS total_products,
        (SELECT COUNT(DISTINCT product_id) FROM (
          SELECT p.id AS product_id,
            COALESCE(SUM(CASE WHEN sm.movement_type IN ('receipt','adjustment_in','transfer_in') THEN sm.quantity_change
                             WHEN sm.movement_type IN ('delivery','adjustment_out','transfer_out') THEN -sm.quantity_change
                             ELSE 0 END), 0) + p.initial_stock AS stock
          FROM products p LEFT JOIN stock_movements sm ON sm.product_id = p.id
          WHERE p.is_active = true GROUP BY p.id
        ) sq WHERE stock <= 0) AS out_of_stock,
        (SELECT COUNT(*) FROM receipts WHERE status = 'pending') AS pending_receipts,
        (SELECT COUNT(*) FROM deliveries WHERE status = 'pending') AS pending_deliveries,
        (SELECT COUNT(*) FROM transfers WHERE status = 'pending') AS pending_transfers
    `);

    // Low stock count
    const lowStock = await db.query(`
      SELECT COUNT(*) AS low_stock FROM (
        SELECT p.id,
          COALESCE(SUM(CASE WHEN sm.movement_type IN ('receipt','adjustment_in','transfer_in') THEN sm.quantity_change
                           WHEN sm.movement_type IN ('delivery','adjustment_out','transfer_out') THEN -sm.quantity_change
                           ELSE 0 END), 0) + p.initial_stock AS stock,
          p.low_stock_threshold
        FROM products p LEFT JOIN stock_movements sm ON sm.product_id = p.id
        WHERE p.is_active = true GROUP BY p.id, p.low_stock_threshold
      ) sq WHERE stock > 0 AND stock <= low_stock_threshold
    `);

    // Recent movements (last 7 days)
    const recentMovements = await db.query(`
      SELECT DATE(created_at) AS date, movement_type, COUNT(*) AS count, SUM(quantity_change) AS total_qty
      FROM stock_movements
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at), movement_type
      ORDER BY date ASC
    `);

    res.json({
      ...stats.rows[0],
      low_stock: lowStock.rows[0].low_stock,
      recent_movements: recentMovements.rows,
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getInventory, getStockLedger, createAdjustment, getAdjustments, getDashboardStats };
