-- FINAL PostgreSQL schema (Multi-tenant SaaS)

-- SHOPS (Shop Owner)
CREATE TABLE IF NOT EXISTS shops (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    password TEXT,
    wa_phone VARCHAR(20),
    wa_phone_id VARCHAR(50),
    wa_token TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PRODUCTS (Menu Items)
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    price DECIMAL(10,2),
    stock_quantity INT DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    shop_id INT REFERENCES shops(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ORDERS
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    shop_id INT REFERENCES shops(id),
    customer_name VARCHAR(100),
    customer_phone VARCHAR(20),
    address TEXT,
    total_price DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, CONFIRMED, PROCESSING, DISPATCHED, DELIVERED, CANCELLED
    payment_method VARCHAR(20), -- COD / ONLINE
    payment_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING / PAID
    message_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ORDER ITEMS (Relation)
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id),
    quantity INT,
    price DECIMAL(10,2)
);

-- WhatsApp sessions (for Week 3)
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id SERIAL PRIMARY KEY,
    shop_id INT,
    phone VARCHAR(20),
    last_state TEXT,
    context JSONB,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- WhatsApp numbers mapping (phone -> shop)
CREATE TABLE IF NOT EXISTS whatsapp_numbers (
    id SERIAL PRIMARY KEY,
    shop_id INT REFERENCES shops(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat sessions (conversation memory)
CREATE TABLE IF NOT EXISTS chat_sessions (
    id SERIAL PRIMARY KEY,
    shop_id INT REFERENCES shops(id) ON DELETE CASCADE,
    phone VARCHAR(20),
    state VARCHAR(50) DEFAULT 'NEW',
    temp_data JSONB DEFAULT '{}'::jsonb,
    last_message TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Processed messages (webhook idempotency)
CREATE TABLE IF NOT EXISTS processed_messages (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(100) UNIQUE NOT NULL,
    shop_id INT,
    phone VARCHAR(20),
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Logs (production debugging)
CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    shop_id INT,
    type VARCHAR(50),
    message TEXT,
    meta JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- DB-backed rate limiting
CREATE TABLE IF NOT EXISTS rate_limits (
    phone VARCHAR(20) PRIMARY KEY,
    count INT DEFAULT 0,
    window_start TIMESTAMP
);

-- Events (basic analytics)
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    shop_id INT,
    event_type TEXT,
    meta JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications (Week 5)
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    shop_id INT REFERENCES shops(id) ON DELETE CASCADE,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

