/**
 * Product Model Reference
 * Table: products
 *
 * Fields:
 *   id                  - SERIAL PRIMARY KEY
 *   name                - VARCHAR(255) NOT NULL
 *   sku                 - VARCHAR(100) UNIQUE NOT NULL
 *   category_id         - FK -> categories.id
 *   unit_of_measure     - VARCHAR(50) DEFAULT 'Unit'
 *   initial_stock       - NUMERIC(15,3) DEFAULT 0
 *   low_stock_threshold - NUMERIC(15,3) DEFAULT 10
 *   description         - TEXT
 *   is_active           - BOOLEAN DEFAULT true
 *   created_at / updated_at
 *
 * Computed:
 *   current_stock = initial_stock + SUM(stock_movements)
 *
 * See: controllers/productController.js
 */
module.exports = {};
