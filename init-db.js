const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Helper to get connection strings
const getDbUrl = (dbName) => {
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = '/' + dbName;
  return url.toString();
};

async function initDB() {
  console.log('Step 1: Connecting to default "postgres" database to ensure coreinventory exists...');
  const poolAdmin = new Pool({ connectionString: getDbUrl('postgres') });
  
  try {
    const res = await poolAdmin.query("SELECT 1 FROM pg_database WHERE datname = 'coreinventory'");
    if (res.rows.length === 0) {
      console.log('Database "coreinventory" not found. Creating it now...');
      await poolAdmin.query('CREATE DATABASE coreinventory');
      console.log('✅ Database "coreinventory" created successfully!');
    } else {
      console.log('Database "coreinventory" already exists.');
    }
  } catch (err) {
    console.error('❌ Error checking/creating database:', err.message);
    return;
  } finally {
    await poolAdmin.end();
  }

  console.log('\nStep 2: Connecting to "coreinventory" to create tables...');
  const poolApp = new Pool({ connectionString: getDbUrl('coreinventory') });
  
  try {
    const schemaPath = path.join(__dirname, 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('Executing schema.sql...');
    await poolApp.query(schema);
    
    console.log('✅ Database tables created and seeded successfully!');
    
    const users = await poolApp.query('SELECT username, email, role FROM users');
    console.log(`\nFound ${users.rows.length} users:`);
    console.table(users.rows);
    
  } catch (err) {
    console.error('❌ Error executing schema:', err.message);
  } finally {
    await poolApp.end();
  }
}

initDB();
