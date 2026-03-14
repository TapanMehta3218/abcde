/**
 * StockMovement Model Reference
 * Table: stock_movements
 *
 * This is the immutable ledger — never update or delete rows.
 *
 * Fields:
 *   id                       - SERIAL PRIMARY KEY
 *   product_id               - FK -> products.id NOT NULL
 *   movement_type            - VARCHAR(30) NOT NULL
 *     Values: receipt | delivery | transfer_in | transfer_out
 *             adjustment_in | adjustment_out
 *   quantity_change          - NUMERIC(15,3) NOT NULL (always positive)
 *   source_warehouse_id      - FK -> warehouses.id (nullable)
 *   destination_warehouse_id - FK -> warehouses.id (nullable)
 *   reference_id             - INT (id of the source receipt/delivery/transfer)
 *   reference_type           - VARCHAR(30) (receipt | delivery | transfer | adjustment)
 *   notes                    - TEXT
 *   created_by               - FK -> users.id
 *   created_at               - TIMESTAMPTZ
 *
 * Stock calculation:
 *   current_stock = initial_stock
 *     + SUM(qty WHERE type IN (receipt, adjustment_in, transfer_in) AND dest = warehouse)
 *     - SUM(qty WHERE type IN (delivery, adjustment_out, transfer_out) AND source = warehouse)
 *
 * See: services/stockService.js, controllers/inventoryController.js
 */
module.exports = {};
