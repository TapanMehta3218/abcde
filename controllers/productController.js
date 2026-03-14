const db = require('../config/database');

// GET /api/products
const getProducts = async (req, res) => {
  try {
    const { search, category_id, low_stock } = req.query;
    let query = `
      SELECT p.*, c.name AS category_name,
             COALESCE(SUM(CASE WHEN sm.movement_type IN ('receipt','adjustment_in') THEN sm.quantity_change
                              WHEN sm.movement_type IN ('delivery','adjustment_out','transfer_out') THEN -sm.quantity_change
                              ELSE 0 END), p.initial_stock) AS current_stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN stock_movements sm ON sm.product_id = p.id
      WHERE p.is_active = true
    `;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length})`;
    }
    if (category_id) {
      params.push(category_id);
      query += ` AND p.category_id = $${params.length}`;
    }

    query += ` GROUP BY p.id, c.name`;

    if (low_stock === 'true') {
      query += ` HAVING COALESCE(SUM(CASE WHEN sm.movement_type IN ('receipt','adjustment_in') THEN sm.quantity_change
                              WHEN sm.movement_type IN ('delivery','adjustment_out','transfer_out') THEN -sm.quantity_change
                              ELSE 0 END), p.initial_stock) <= p.low_stock_threshold`;
    }

    query += ` ORDER BY p.name ASC`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/products/:id
const getProductById = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*, c.name AS category_name FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1 AND p.is_active = true`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/products
const createProduct = async (req, res) => {
  const { name, sku, category_id, unit_of_measure, initial_stock, low_stock_threshold, description } = req.body;
  try {
    const skuCheck = await db.query('SELECT id FROM products WHERE sku = $1', [sku]);
    if (skuCheck.rows.length > 0) return res.status(409).json({ message: 'SKU already exists' });

    const result = await db.query(
      `INSERT INTO products (name, sku, category_id, unit_of_measure, initial_stock, low_stock_threshold, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, sku, category_id, unit_of_measure, initial_stock || 0, low_stock_threshold || 10, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/products/:id
const updateProduct = async (req, res) => {
  const { name, sku, category_id, unit_of_measure, low_stock_threshold, description } = req.body;
  try {
    const result = await db.query(
      `UPDATE products SET name=$1, sku=$2, category_id=$3, unit_of_measure=$4,
       low_stock_threshold=$5, description=$6, updated_at=NOW()
       WHERE id=$7 AND is_active=true RETURNING *`,
      [name, sku, category_id, unit_of_measure, low_stock_threshold, description, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/products/:id (soft delete)
const deleteProduct = async (req, res) => {
  try {
    await db.query('UPDATE products SET is_active=false WHERE id=$1', [req.params.id]);
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/products/categories
const getCategories = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM categories ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getProducts, getProductById, createProduct, updateProduct, deleteProduct, getCategories };
