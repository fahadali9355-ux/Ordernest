-- Migration: Week 4 idempotency hardening for orders.message_id

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS message_id VARCHAR(100);

-- Ensure duplicates don't create multiple orders for the same WhatsApp message.
-- Postgres UNIQUE allows multiple NULLs, so we restrict to non-null values.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_message_id_unique_not_null
  ON orders(message_id)
  WHERE message_id IS NOT NULL;

