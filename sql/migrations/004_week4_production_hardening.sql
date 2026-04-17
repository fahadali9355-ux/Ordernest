-- Migration: Week 4 database finalization + production hardening

-- 1) whatsapp_numbers FINAL VERSION upgrades
ALTER TABLE whatsapp_numbers
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE whatsapp_numbers
  ALTER COLUMN phone_number SET NOT NULL;

-- Ensure FK cascade on delete (best-effort: drop/recreate if needed)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_numbers_shop_id_fkey') THEN
    ALTER TABLE whatsapp_numbers DROP CONSTRAINT whatsapp_numbers_shop_id_fkey;
  END IF;
  ALTER TABLE whatsapp_numbers
    ADD CONSTRAINT whatsapp_numbers_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
EXCEPTION WHEN undefined_table THEN
  -- ignore in fresh DB ordering issues
END $$;

-- 2) chat_sessions FINAL VERSION upgrades
ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS last_message TEXT;

ALTER TABLE chat_sessions
  ALTER COLUMN state SET DEFAULT 'NEW';

-- temp_data default '{}'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_sessions' AND column_name = 'temp_data'
  ) THEN
    ALTER TABLE chat_sessions
      ALTER COLUMN temp_data SET DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Ensure FK cascade on delete (best-effort)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_sessions_shop_id_fkey') THEN
    ALTER TABLE chat_sessions DROP CONSTRAINT chat_sessions_shop_id_fkey;
  END IF;
  ALTER TABLE chat_sessions
    ADD CONSTRAINT chat_sessions_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
EXCEPTION WHEN undefined_table THEN
END $$;

-- 3) processed_messages (idempotency)
CREATE TABLE IF NOT EXISTS processed_messages (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(100) UNIQUE NOT NULL,
    shop_id INT,
    phone VARCHAR(20),
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4) logs (production debug)
CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    shop_id INT,
    type VARCHAR(50),
    message TEXT,
    meta JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5) orders production fields
ALTER TABLE orders ADD COLUMN IF NOT EXISTS message_id VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address TEXT;

-- 6) products soft-delete
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- 7) Indexes (performance)
CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_shop ON orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_chat_phone ON chat_sessions(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_phone ON whatsapp_numbers(phone_number);

