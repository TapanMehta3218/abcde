const pool = require('../src/config/database');
const { hashPassword } = require('../src/utils/auth');
require('dotenv').config();

const seedData = async () => {
  try {
    console.log('Starting database seeding...');

    // Create admin user
    const adminPassword = await hashPassword('admin123');
    await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role) 
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      ['admin@coreinventory.com', adminPassword, 'Admin User', 'admin']
    );
    console.log('✓ Admin user created');

    // Create staff user
    const staffPassword = await hashPassword('staff123');
    await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role) 
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      ['staff@coreinventory.com', staffPassword, 'Staff User', 'staff']
    );
    console.log('✓ Staff user created');

    // Create categories
    const categories = [
      { name: 'Electronics', description: 'Electronic components' },
      { name: 'Hardware', description: 'Hardware items' },
      { name: 'Raw Materials', description: 'Raw materials' },
      { name: 'Finished Goods', description: 'Finished products' },
    ];

    for (const cat of categories) {
      await pool.query(
        `INSERT INTO categories (name, description) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [cat.name, cat.description]
      );
    }
    console.log('✓ Categories created');

    // Create warehouses
    const warehouses = [
      { name: 'Main Warehouse', address: '123 Industrial Park' },
      { name: 'Production Floor', address: '123 Industrial Park - Floor 2' },
    ];

    let warehouseIds = [];
    for (const wh of warehouses) {
      const result = await pool.query(
        `INSERT INTO warehouses (name, address) VALUES ($1, $2)
         ON CONFLICT DO NOTHING RETURNING id`,
        [wh.name, wh.address]
      );
      if (result.rows.length > 0) warehouseIds.push(result.rows[0].id);
    }
    console.log('✓ Warehouses created');

    // Create locations
    const locations = [
      { warehouse_idx: 0, name: 'Rack A' },
      { warehouse_idx: 0, name: 'Rack B' },
      { warehouse_idx: 0, name: 'Receiving Area' },
      { warehouse_idx: 1, name: 'Assembly Line' },
    ];

    let locationIds = [];
    if (warehouseIds.length > 0) {
      for (const loc of locations) {
        const result = await pool.query(
          `INSERT INTO locations (warehouse_id, name, location_type) VALUES ($1, $2, $3)
           RETURNING id`,
          [warehouseIds[loc.warehouse_idx], loc.name, 'internal']
        );
        if (result.rows.length > 0) locationIds.push(result.rows[0].id);
      }
    }
    console.log('✓ Locations created');

    // Create sample products
    const products = [
      { name: 'Steel Rods', sku: 'SR-001', category: 'Raw Materials', uom: 'kg', reorder: 100 },
      { name: 'Aluminum Sheets', sku: 'AS-001', category: 'Raw Materials', uom: 'pieces', reorder: 50 },
      { name: 'Plastic Chairs', sku: 'PC-001', category: 'Finished Goods', uom: 'pieces', reorder: 20 },
      { name: 'Electronic Boards', sku: 'EB-001', category: 'Electronics', uom: 'pieces', reorder: 10 },
      { name: 'Bolts Pack', sku: 'BP-001', category: 'Hardware', uom: 'boxes', reorder: 5 },
    ];

    let productIds = [];
    for (const prod of products) {
      const catResult = await pool.query(
        `SELECT id FROM categories WHERE name = $1`,
        [prod.category]
      );
      const catId = catResult.rows[0]?.id;

      const result = await pool.query(
        `INSERT INTO products (name, sku, category_id, uom, reorder_level) 
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING RETURNING id`,
        [prod.name, prod.sku, catId, prod.uom, prod.reorder]
      );
      if (result.rows.length > 0) productIds.push(result.rows[0].id);
    }
    console.log('✓ Products created');

    // Add stock quantities
    if (productIds.length > 0 && locationIds.length > 0) {
      const quantities = [100, 50, 25, 10, 5];
      let idx = 0;
      for (const prodId of productIds) {
        for (let i = 0; i < 2; i++) {
          const locId = locationIds[i % locationIds.length];
          await pool.query(
            `INSERT INTO stock_quant (product_id, location_id, qty) 
             VALUES ($1, $2, $3)
             ON CONFLICT (product_id, location_id) DO UPDATE SET qty = $3`,
            [prodId, locId, quantities[idx] || 10]
          );
        }
        idx++;
      }
    }
    console.log('✓ Stock quantities initialized');

    console.log('\n✅ Database seeding completed successfully!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedData();
