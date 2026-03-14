/**
 * User Model Reference
 * Table: users
 *
 * Fields:
 *   id            - SERIAL PRIMARY KEY
 *   username      - VARCHAR(100) NOT NULL
 *   email         - VARCHAR(255) UNIQUE NOT NULL
 *   password_hash - TEXT NOT NULL (bcrypt)
 *   role          - VARCHAR(50) DEFAULT 'inventory_staff'
 *                   Roles: admin | warehouse_manager | inventory_staff
 *   is_active     - BOOLEAN DEFAULT true
 *   created_at    - TIMESTAMPTZ
 *   updated_at    - TIMESTAMPTZ
 *
 * Note: Use authController.js for all user operations.
 * Direct DB access via config/database.js.
 */
module.exports = {}; // Model reference only — queries are in controllers
