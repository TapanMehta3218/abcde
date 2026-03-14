/**
 * Warehouse Model Reference
 * Table: warehouses
 *
 * Fields:
 *   id         - SERIAL PRIMARY KEY
 *   name       - VARCHAR(150) UNIQUE NOT NULL
 *   code       - VARCHAR(20) UNIQUE NOT NULL (e.g. WH-MAIN)
 *   address    - TEXT
 *   manager_id - FK -> users.id
 *   is_active  - BOOLEAN DEFAULT true
 *   created_at - TIMESTAMPTZ
 *
 * See: routes/warehouseRoutes.js
 */
module.exports = {};
