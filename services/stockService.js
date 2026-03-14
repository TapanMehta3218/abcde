const db = require('../config/database');

/**
 * Get the current stock level for a product in a specific warehouse.
 */
const getStockLevel = async (productId, warehouseId) => {
  const result = await db.query(
    `SELECT p.initial_stock +
       COALESCE(SUM(CASE
         WHEN sm.movement_type IN ('receipt', 'adjustment_in', 'transfer_in')
           AND sm.destination_warehouse_id = $2 THEN sm.quantity_change
         WHEN sm.movement_type IN ('delivery', 'adjustment_out', 'transfer_out')
           AND sm.source_warehouse_id = $2 THEN -sm.quantity_change
         ELSE 0
       END), 0) AS stock_level
     FROM products p
     LEFT JOIN stock_movements sm ON sm.product_id = p.id
     WHERE p.id = $1
     GROUP BY p.initial_stock`,
    [productId, warehouseId]
  );
  return result.rows[0]?.stock_level || 0;
};

/**
 * Check if sufficient stock is available before a delivery/transfer.
 */
const checkStockAvailability = async (productId, warehouseId, requiredQty) => {
  const stock = await getStockLevel(productId, warehouseId);
  if (parseFloat(stock) < requiredQty) {
    throw new Error(
      `Insufficient stock. Available: ${stock}, Required: ${requiredQty}`
    );
  }
  return true;
};

/**
 * Record a stock movement entry.
 */
const recordMovement = async (client, {
  productId, movementType, quantityChange,
  sourceWarehouseId, destinationWarehouseId,
  referenceId, referenceType, createdBy, notes,
}) => {
  const result = await client.query(
    `INSERT INTO stock_movements
      (product_id, movement_type, quantity_change, source_warehouse_id,
       destination_warehouse_id, reference_id, reference_type, created_by, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [productId, movementType, quantityChange, sourceWarehouseId,
     destinationWarehouseId, referenceId, referenceType, createdBy, notes]
  );
  return result.rows[0];
};

module.exports = { getStockLevel, checkStockAvailability, recordMovement };
