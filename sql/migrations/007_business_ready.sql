-- Migration 007: Business-Ready Upgrade
-- Adds: customers table, order enhancements, admin controls

-- CUSTOMERS table (auto-populated when customer first messages)
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    shop_id INT REFERENCES shops(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    name VARCHAR(100),
    address TEXT,
    total_orders INT DEFAULT 0,
    last_order_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shop_id, phone)
);

-- ORDERS: additional business columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_estimate VARCHAR(50) DEFAULT '~30 mins';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;

-- Backfill order_number for existing orders
UPDATE orders SET order_number = 'ORD-' || (1000 + id) WHERE order_number IS NULL;

-- SHOPS: admin control columns
ALTER TABLE shops ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT 'free';

-- INDEX for fast customer lookup
CREATE INDEX IF NOT EXISTS idx_customers_shop_phone ON customers(shop_id, phone);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(shop_id, status);
