-- Migration: Week 3 WhatsApp core engine tables

CREATE TABLE IF NOT EXISTS whatsapp_numbers (
    id SERIAL PRIMARY KEY,
    shop_id INT REFERENCES shops(id),
    phone_number VARCHAR(20) UNIQUE
);

CREATE TABLE IF NOT EXISTS chat_sessions (
    id SERIAL PRIMARY KEY,
    shop_id INT,
    phone VARCHAR(20),
    state VARCHAR(50),
    temp_data JSONB,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Helpful index for session lookups
CREATE INDEX IF NOT EXISTS chat_sessions_shop_phone_idx ON chat_sessions (shop_id, phone);

