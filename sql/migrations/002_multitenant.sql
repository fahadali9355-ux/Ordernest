-- Migration: Multi-tenant upgrade (shops + shop_id isolation + whatsapp_sessions)

CREATE TABLE IF NOT EXISTS shops (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    password TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add shop_id to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS shop_id INT;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_shop_id_fkey'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id);
  END IF;
END $$;

-- Add shop_id to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shop_id INT;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_shop_id_fkey'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id);
  END IF;
END $$;

-- WhatsApp sessions (Week 3)
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id SERIAL PRIMARY KEY,
    shop_id INT,
    phone VARCHAR(20),
    last_state TEXT,
    context JSONB,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

