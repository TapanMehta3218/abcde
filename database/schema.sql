-- CoreInventory PostgreSQL Schema
-- Run this file to initialize the database

-- Enable UUID extension (optional, we use SERIAL here)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id           SERIAL PRIMARY KEY,
  username     VARCHAR(100) NOT NULL,
  email        VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  role         VARCHAR(50)  NOT NULL DEFAULT 'inventory_staff',
    -- roles: admin, warehouse_manager, inventory_staff
  is_active    BOOLEAN      NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- WAREHOUSES
-- ============================================================
CREATE TABLE IF NOT EXISTS warehouses (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(150) NOT NULL UNIQUE,
  code        VARCHAR(20)  NOT NULL UNIQUE,
  address     TEXT,
  manager_id  INTEGER REFERENCES users(id),
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- LOCATIONS (sub-locations within warehouses)
-- ============================================================
CREATE TABLE IF NOT EXISTS locations (
  id           SERIAL PRIMARY KEY,
  warehouse_id INTEGER      NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  name         VARCHAR(100) NOT NULL,
  code         VARCHAR(30),
  location_type VARCHAR(30) DEFAULT 'internal',
    -- internal, supplier, customer, virtual
  is_active    BOOLEAN      NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id                  SERIAL PRIMARY KEY,
  name                VARCHAR(255) NOT NULL,
  sku                 VARCHAR(100) NOT NULL UNIQUE,
  category_id         INTEGER REFERENCES categories(id),
  unit_of_measure     VARCHAR(50)  NOT NULL DEFAULT 'Unit',
  initial_stock       NUMERIC(15,3) NOT NULL DEFAULT 0,
  low_stock_threshold NUMERIC(15,3) NOT NULL DEFAULT 10,
  description         TEXT,
  is_active           BOOLEAN      NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- RECEIPTS (Incoming goods)
-- ============================================================
CREATE TABLE IF NOT EXISTS receipts (
  id             SERIAL PRIMARY KEY,
  supplier_name  VARCHAR(255),
  warehouse_id   INTEGER NOT NULL REFERENCES warehouses(id),
  status         VARCHAR(30) NOT NULL DEFAULT 'pending',
    -- pending, validated, cancelled
  expected_date  DATE,
  validated_at   TIMESTAMPTZ,
  validated_by   INTEGER REFERENCES users(id),
  notes          TEXT,
  created_by     INTEGER NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS receipt_items (
  id                SERIAL PRIMARY KEY,
  receipt_id        INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  product_id        INTEGER NOT NULL REFERENCES products(id),
  quantity_expected NUMERIC(15,3) NOT NULL,
  quantity_received NUMERIC(15,3),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DELIVERIES (Outgoing goods)
-- ============================================================
CREATE TABLE IF NOT EXISTS deliveries (
  id             SERIAL PRIMARY KEY,
  customer_name  VARCHAR(255),
  warehouse_id   INTEGER NOT NULL REFERENCES warehouses(id),
  status         VARCHAR(30) NOT NULL DEFAULT 'pending',
    -- pending, shipped, cancelled
  scheduled_date DATE,
  shipped_at     TIMESTAMPTZ,
  validated_by   INTEGER REFERENCES users(id),
  notes          TEXT,
  created_by     INTEGER NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_items (
  id               SERIAL PRIMARY KEY,
  delivery_id      INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  product_id       INTEGER NOT NULL REFERENCES products(id),
  quantity_ordered NUMERIC(15,3) NOT NULL,
  quantity_shipped NUMERIC(15,3),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRANSFERS (Internal)
-- ============================================================
CREATE TABLE IF NOT EXISTS transfers (
  id                      SERIAL PRIMARY KEY,
  source_warehouse_id      INTEGER NOT NULL REFERENCES warehouses(id),
  destination_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  status                  VARCHAR(30) NOT NULL DEFAULT 'pending',
    -- pending, done, cancelled
  completed_at            TIMESTAMPTZ,
  validated_by            INTEGER REFERENCES users(id),
  notes                   TEXT,
  created_by              INTEGER NOT NULL REFERENCES users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transfer_items (
  id          SERIAL PRIMARY KEY,
  transfer_id INTEGER NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id),
  quantity    NUMERIC(15,3) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- STOCK MOVEMENTS (Ledger)
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id                       SERIAL PRIMARY KEY,
  product_id               INTEGER NOT NULL REFERENCES products(id),
  movement_type            VARCHAR(30) NOT NULL,
    -- receipt, delivery, transfer_in, transfer_out, adjustment_in, adjustment_out
  quantity_change          NUMERIC(15,3) NOT NULL,
  source_warehouse_id      INTEGER REFERENCES warehouses(id),
  destination_warehouse_id INTEGER REFERENCES warehouses(id),
  reference_id             INTEGER,
  reference_type           VARCHAR(30),
    -- receipt, delivery, transfer, adjustment
  notes                    TEXT,
  created_by               INTEGER REFERENCES users(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INVENTORY ADJUSTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id              SERIAL PRIMARY KEY,
  product_id      INTEGER NOT NULL REFERENCES products(id),
  warehouse_id    INTEGER NOT NULL REFERENCES warehouses(id),
  quantity_change NUMERIC(15,3) NOT NULL,
  reason          VARCHAR(255),
  notes           TEXT,
  movement_id     INTEGER REFERENCES stock_movements(id),
  created_by      INTEGER NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type       ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_products_sku               ON products(sku);
CREATE INDEX IF NOT EXISTS idx_receipts_status            ON receipts(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_status          ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_transfers_status           ON transfers(status);

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT INTO categories (name, description) VALUES
  ('Raw Materials',   'Base materials used in production'),
  ('Finished Goods',  'Completed products ready to ship'),
  ('Spare Parts',     'Replacement parts for equipment'),
  ('Packaging',       'Boxes, wraps, and packing materials'),
  ('Electronics',     'Electronic components and devices')
ON CONFLICT DO NOTHING;

INSERT INTO warehouses (name, code, address) VALUES
  ('Main Warehouse',   'WH-MAIN', '123 Industrial Blvd, City A'),
  ('Secondary Depot',  'WH-SEC',  '456 Logistics Park, City B'),
  ('Returns Center',   'WH-RET',  '789 Reverse Logistics Rd, City C')
ON CONFLICT DO NOTHING;

-- Default admin user  (password: Admin@123)
INSERT INTO users (username, email, password_hash, role) VALUES
  ('Admin', 'admin@coreinventory.com',
   '$2a$10$xMB7UXGi2lq.MVMXrGHW5OkqRPLiQf1v7.sE3Fmqpz.sN9iRgKJRi',
   'admin')
ON CONFLICT DO NOTHING;
