-- Migration: Week 3.8 production hardening

-- 1) Order lifecycle status default (PENDING)
ALTER TABLE orders
  ALTER COLUMN status SET DEFAULT 'PENDING';

-- 2) Session TTL
ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

-- 3) DB-backed rate limiting
CREATE TABLE IF NOT EXISTS rate_limits (
    phone VARCHAR(20) PRIMARY KEY,
    count INT DEFAULT 0,
    window_start TIMESTAMP
);

-- 4) Events (basic analytics)
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    shop_id INT,
    event_type TEXT,
    meta JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_shop_type_created ON events (shop_id, event_type, created_at);

