// require('dotenv').config({ path: '.env.local' });
// require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('./db');
const { requireAuth } = require('./auth');
const {
  handleMessage, logEvent, logError, normalizeText,
  isValidMessage, sendMessage, trackEvent
} = require('./whatsapp');

const app = express();

// ─────────────────────────────────────────────
// AUTO-MIGRATE SCHEMA ON STARTUP
// Each statement runs separately (Neon PgBouncer fix)
// ─────────────────────────────────────────────
(async () => {
  const migrations = [
    // Core tables (schema.sql already has these, but run safe)
    `CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY, shop_id INT,
        type VARCHAR(50), message TEXT, meta JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY, shop_id INT,
        event_type TEXT, meta JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS rate_limits (
        phone VARCHAR(20) PRIMARY KEY,
        count INT DEFAULT 0, window_start TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS processed_messages (
        id SERIAL PRIMARY KEY,
        message_id VARCHAR(100) UNIQUE NOT NULL,
        shop_id INT, phone VARCHAR(20),
        processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS otps (
        email VARCHAR(100) PRIMARY KEY,
        code VARCHAR(10),
        expires_at TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS whatsapp_numbers (
        id SERIAL PRIMARY KEY,
        shop_id INT REFERENCES shops(id) ON DELETE CASCADE,
        phone_number VARCHAR(20) UNIQUE NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS chat_sessions (
        id SERIAL PRIMARY KEY,
        shop_id INT REFERENCES shops(id) ON DELETE CASCADE,
        phone VARCHAR(20), state VARCHAR(50) DEFAULT 'NEW',
        temp_data JSONB DEFAULT '{}'::jsonb,
        last_message TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        shop_id INT REFERENCES shops(id) ON DELETE CASCADE,
        message TEXT, is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        shop_id INT REFERENCES shops(id) ON DELETE CASCADE,
        phone VARCHAR(20) NOT NULL,
        name VARCHAR(100), address TEXT,
        total_orders INT DEFAULT 0,
        last_order_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(shop_id, phone))`,
    `CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        shop_id INT REFERENCES shops(id) ON DELETE CASCADE,
        phone VARCHAR(20),
        direction VARCHAR(10) CHECK (direction IN ('INCOMING', 'OUTGOING')),
        content TEXT,
        message_id VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS human_mode BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE products ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE shops ADD COLUMN IF NOT EXISTS wa_phone VARCHAR(20)`,
    `ALTER TABLE shops ADD COLUMN IF NOT EXISTS wa_phone_id VARCHAR(50)`,
    `ALTER TABLE shops ADD COLUMN IF NOT EXISTS wa_token TEXT`,
    `ALTER TABLE shops ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`,
    `ALTER TABLE shops ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT 'free'`,
    `ALTER TABLE shops ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE shops ADD COLUMN IF NOT EXISTS otp_code VARCHAR(10)`,
    `ALTER TABLE shops ADD COLUMN IF NOT EXISTS otp_expiry TIMESTAMP`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_estimate VARCHAR(50) DEFAULT '~30 mins'`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number VARCHAR(20)`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone VARCHAR(20)`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS message_id VARCHAR(100)`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'PENDING'`,
    // chat_sessions — add missing columns to existing table
    `ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP`,
    `ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS last_message TEXT`,
    `ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS temp_data JSONB DEFAULT '{}'::jsonb`,
    // whatsapp_numbers missing columns backfill
    `ALTER TABLE whatsapp_numbers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`,
    // Indexes
    `CREATE INDEX IF NOT EXISTS idx_customers_shop_phone ON customers(shop_id, phone)`,
    `CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number)`,
    `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(shop_id, status)`,
    // Backfill
    `UPDATE orders SET order_number = 'ORD-' || (1000 + id) WHERE order_number IS NULL OR order_number = ''`,
  ];

  let ok = 0; let fail = 0;
  for (const sql of migrations) {
    try {
      await pool.query(sql);
      ok++;
    } catch (err) {
      fail++;
      // Only log unexpected errors (not IF NOT EXISTS conflicts)
      if (!err.message?.includes('already exists') && !err.message?.includes('duplicate')) {
        console.warn('Migration warn:', err.message?.slice(0, 120));
      }
    }
  }
  console.log(`✅ DB migration: ${ok} ok, ${fail} skipped/warned`);
})();

app.use(cors());
app.use(bodyParser.json());

app.get('/', (req, res) => res.send('OrderBot API Running ✅'));

// ─────────────────────────────────────────────
// WEBHOOK
// ─────────────────────────────────────────────
app.get('/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  console.log('🔔 Webhook verify request:', { mode, token: token?.slice(0, 10) });
  if (mode === 'subscribe' && token && token === process.env.WA_VERIFY_TOKEN) {
    console.log('✅ Webhook verified!');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post('/webhook/whatsapp', async (req, res) => {
  res.sendStatus(200); // ACK immediately

  (async () => {
    let shop_id = null;
    let phone = null;
    let text = null;
    let message_id = null;

    try {
      const entry = req.body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const messages = changes?.value?.messages;
      const contacts = changes?.value?.contacts;
      const pushName = contacts?.[0]?.profile?.name || null;

      let msg = req.body?.messages?.[0];
      if (!msg) {
        if (!messages || !messages.length) return;
        msg = messages[0];
      }

      phone = msg.from;
      text = normalizeText(msg.text?.body || '');
      message_id = msg.id || null;

      if (!phone || !isValidMessage(text)) {
        if (phone) await sendMessage(phone, "⚠️ Message samajh nahi aaya. Type 'menu'.");
        return;
      }

      if (!message_id) return;

      // Identify shop by phone_number_id (from webhook metadata)
      const phoneNumberId = req.body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
      console.log('📨 Webhook msg:', { phone, text, message_id, phoneNumberId });

      if (phoneNumberId) {
        try {
          // Try with is_active first, fallback without it if column missing
          let shopByPhoneId;
          try {
            shopByPhoneId = await pool.query(
              `SELECT id FROM shops WHERE wa_phone_id = $1 AND is_active = true`,
              [String(phoneNumberId)]
            );
          } catch {
            shopByPhoneId = await pool.query(
              `SELECT id FROM shops WHERE wa_phone_id = $1`,
              [String(phoneNumberId)]
            );
          }
          if (shopByPhoneId.rows.length) shop_id = shopByPhoneId.rows[0].id;
        } catch (e) {
          console.error('Shop lookup by phone_id failed:', e.message);
        }
      }

      // Fallback: env-level phone_id match
      if (!shop_id && phoneNumberId && process.env.WA_PHONE_ID === String(phoneNumberId)) {
        // Try to find ANY shop (single-tenant fallback)
        try {
          const anyShop = await pool.query(`SELECT id FROM shops ORDER BY id ASC LIMIT 1`);
          if (anyShop.rows.length) shop_id = anyShop.rows[0].id;
        } catch { /* ignore */ }
      }

      // Fallback: whatsapp_numbers mapping
      if (!shop_id) {
        try {
          const shop = await pool.query(
            `SELECT shop_id FROM whatsapp_numbers WHERE phone_number = $1 AND is_active = true`,
            [phone]
          );
          if (shop.rows.length) shop_id = shop.rows[0].shop_id;
        } catch { /* table might not exist yet */ }
      }

      console.log('🏪 Shop found:', shop_id);
      if (!shop_id) {
        console.log('❌ No shop found for phoneNumberId:', phoneNumberId, '| phone:', phone);
        return;
      }

      // Upsert customer profile name if available
      try {
         await pool.query(
           `INSERT INTO customers (shop_id, phone, name) VALUES ($1, $2, $3)
            ON CONFLICT (shop_id, phone) DO UPDATE SET name = COALESCE(NULLIF(customers.name, ''), EXCLUDED.name)
            WHERE customers.name IS NULL OR customers.name = ''`,
           [shop_id, phone, pushName || phone]
         );
      } catch (err) { console.log('👤 PushName Upsert Error:', err.message); }

      // DB-backed rate limiting (5 messages per 10s)
      const windowMs = 10_000;
      const limit = 5;
      const now = new Date();
      const rl = await pool.query(`SELECT count, window_start FROM rate_limits WHERE phone = $1`, [phone]);
      if (!rl.rows.length) {
        await pool.query(`INSERT INTO rate_limits (phone, count, window_start) VALUES ($1, $2, $3)`, [phone, 1, now]);
      } else {
        const windowStart = rl.rows[0].window_start ? new Date(rl.rows[0].window_start) : null;
        const count = Number(rl.rows[0].count || 0);
        const withinWindow = windowStart && now.getTime() - windowStart.getTime() < windowMs;
        if (!withinWindow) {
          await pool.query(`UPDATE rate_limits SET count = $2, window_start = $3 WHERE phone = $1`, [phone, 1, now]);
        } else if (count >= limit) {
          await logEvent(shop_id, 'RATE_LIMIT', 'Too many messages', { phone });
          await sendMessage(phone, '⏳ Too many messages. Thodi dair baad try karo.', shop_id);
          return;
        } else {
          await pool.query(`UPDATE rate_limits SET count = count + 1 WHERE phone = $1`, [phone]);
        }
      }

      // Idempotency: skip if already processed
      const inserted = await pool.query(
        `INSERT INTO messages (shop_id, phone, direction, content, message_id)
         VALUES ($1, $2, 'INCOMING', $3, $4) 
         ON CONFLICT (message_id) DO NOTHING RETURNING id`,
        [shop_id || null, phone, String(text || ''), String(message_id)]
      );
      if (inserted.rows.length === 0) return; // Duplicate meta retry

      // Human Mode Override
      let human_mode = false;
      if (shop_id) {
        try {
          const sessionRes = await pool.query(`SELECT human_mode FROM chat_sessions WHERE phone = $1 AND shop_id = $2`, [phone, shop_id]);
          if (sessionRes.rows.length && sessionRes.rows[0].human_mode) {
             human_mode = true;
          }
        } catch { /* best effort */ }
      }

      await logEvent(shop_id, 'INCOMING_MESSAGE', 'Webhook received', { phone, text, message_id, human_mode });
      await trackEvent(shop_id, 'message_received', { phone, text, message_id });
      
      // ABORT Bot Logic if human has taken over
      if (human_mode) return;

      await handleMessage(shop_id, phone, text, message_id);

    } catch (err) {
      console.error(err);
      await logError(shop_id, err, { where: 'webhook/whatsapp', phone, text, message_id });
    }
  })();
});

// ─────────────────────────────────────────────
// AUTHENTICATION & SECURITY (OTP)
// ─────────────────────────────────────────────
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for 587
  requireTLS: true,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  tls: { rejectUnauthorized: false }, // Avoid cert hangs if Railway routing acts weird
  connectionTimeout: 10000, // 10s timeout instead of infinite hang
});

async function sendEmailOTP(email, code) {
  if (!process.env.SMTP_USER) {
    console.log(`[DEV MODE] Mock email to ${email}: OTP is ${code}`);
    return;
  }
  await transporter.sendMail({
    from: `"Ordernest Security" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Your Ordernest Verification Code",
    text: `Your verification code is: ${code}\n\nIt expires in 10 minutes.`
  });
}

// 1. Request OTP
app.post('/auth/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const formattedEmail = String(email).toLowerCase();
    
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60000); // 10 mins
    
    await pool.query(
      `INSERT INTO otps (email, code, expires_at) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET code = $2, expires_at = $3`,
      [formattedEmail, code, expiry]
    );
    
    await sendEmailOTP(formattedEmail, code);
    res.json({ success: true, message: 'OTP sent' });
  } catch (err) {
    console.error("OTP SMTP Error:", err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 2. Verify OTP (For Forgot Password)
app.post('/auth/verify-otp', async (req, res) => {
  try {
    const { email, code } = req.body;
    const formattedEmail = String(email).toLowerCase();
    
    const result = await pool.query(`SELECT * FROM otps WHERE email = $1 AND code = $2 AND expires_at > CURRENT_TIMESTAMP`, [formattedEmail, code]);
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }
    
    // Generate a temporary reset token (valid for 15 mins)
    const resetToken = jwt.sign({ email: formattedEmail, purpose: 'reset' }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '15m' });
    
    // Clear OTP
    await pool.query(`DELETE FROM otps WHERE email = $1`, [formattedEmail]);
    
    res.json({ success: true, resetToken });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Reset Password
app.post('/auth/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) return res.status(400).json({ error: 'Token and new password required' });
    
    const decoded = jwt.verify(resetToken, process.env.JWT_SECRET || 'fallback_secret');
    if (decoded.purpose !== 'reset') throw new Error('Invalid token type');
    
    const hash = await bcrypt.hash(String(newPassword), 10);
    const result = await pool.query(`UPDATE shops SET password = $1 WHERE email = $2 RETURNING id`, [hash, decoded.email]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Account not found' });
    
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, wa_phone, wa_phone_id, wa_token, otp_code } = req.body;
    if (!email || !password || !otp_code) return res.status(400).json({ error: 'email, password and OTP code are required' });

    const formattedEmail = String(email).toLowerCase();

    // Verify OTP
    const otpRes = await pool.query(`SELECT * FROM otps WHERE email = $1 AND code = $2 AND expires_at > CURRENT_TIMESTAMP`, [formattedEmail, otp_code]);
    if (otpRes.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const hash = await bcrypt.hash(String(password), 10);
    const result = await pool.query(
      `INSERT INTO shops (name, email, password, wa_phone, wa_phone_id, wa_token, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, name, email, wa_phone, wa_phone_id, created_at`,
      [name || null, formattedEmail, hash, wa_phone || null, wa_phone_id || null, wa_token || null]
    );

    // Clear OTP
    await pool.query(`DELETE FROM otps WHERE email = $1`, [formattedEmail]);

    if (wa_phone) {
      await pool.query(
        `INSERT INTO whatsapp_numbers (shop_id, phone_number) VALUES ($1, $2)
         ON CONFLICT (phone_number) DO UPDATE SET shop_id = EXCLUDED.shop_id, is_active = true`,
        [result.rows[0].id, String(wa_phone)]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    if (err?.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
    if (!process.env.JWT_SECRET) return res.status(500).json({ error: 'JWT_SECRET not configured' });

    const userRes = await pool.query('SELECT id, name, email, password FROM shops WHERE email = $1', [String(email).toLowerCase()]);
    if (userRes.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = userRes.rows[0];
    const ok = await bcrypt.compare(String(password), String(user.password));
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ shop_id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────
// GET MY PROFILE
// ─────────────────────────────────────────────
app.get('/auth/me', requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, name, email, wa_phone, wa_phone_id, created_at FROM shops WHERE id = $1`,
      [req.shop_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Shop not found' });
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────
// UPDATE WA CREDENTIALS (Settings page)
// ─────────────────────────────────────────────
app.patch('/auth/profile', requireAuth, async (req, res) => {
  try {
    const { wa_phone, wa_phone_id, wa_token } = req.body;
    const updates = [];
    const values  = [];
    let idx = 1;

    if (wa_phone    !== undefined) { updates.push(`wa_phone = $${idx++}`);    values.push(wa_phone    || null); }
    if (wa_phone_id !== undefined) { updates.push(`wa_phone_id = $${idx++}`); values.push(wa_phone_id || null); }
    if (wa_token && wa_token.trim()) {
      updates.push(`wa_token = $${idx++}`);
      values.push(wa_token.trim());
    }

    if (!updates.length) return res.status(400).json({ error: 'Koi field nahi diya' });

    values.push(req.shop_id);
    await pool.query(
      `UPDATE shops SET ${updates.join(', ')} WHERE id = $${idx}`,
      values
    );

    // Also update whatsapp_numbers table if phone changed
    if (wa_phone) {
      await pool.query(
        `INSERT INTO whatsapp_numbers (shop_id, phone_number)
         VALUES ($1, $2)
         ON CONFLICT (phone_number) DO UPDATE SET shop_id = EXCLUDED.shop_id, is_active = true`,
        [req.shop_id, String(wa_phone)]
      );
    }

    res.json({ success: true, message: 'Settings update ho gayi' });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: err.message || 'Internal server error', code: err.code });
  }
});

// ─────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────
app.post('/products', requireAuth, async (req, res) => {
  try {
    const { name, price, stock_quantity } = req.body;
    if (!name || price === undefined) return res.status(400).json({ error: 'name and price are required' });
    const qty = stock_quantity === undefined ? 0 : Number(stock_quantity);
    if (!Number.isFinite(qty) || qty < 0) return res.status(400).json({ error: 'stock_quantity must be a non-negative number' });
    const result = await pool.query(
      'INSERT INTO products (name, price, stock_quantity, shop_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, price, qty, req.shop_id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/products', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE shop_id = $1 ORDER BY created_at DESC', [req.shop_id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/products/:id', requireAuth, async (req, res) => {
  try {
    const { name, price, stock_quantity, is_available, is_deleted } = req.body;
    const updates = []; const values = []; let idx = 1;
    if (name !== undefined)           { updates.push(`name = $${idx++}`);           values.push(name); }
    if (price !== undefined)          { updates.push(`price = $${idx++}`);          values.push(price); }
    if (stock_quantity !== undefined) { updates.push(`stock_quantity = $${idx++}`); values.push(stock_quantity); }
    if (is_available !== undefined)   { updates.push(`is_available = $${idx++}`);   values.push(is_available); }
    if (is_deleted !== undefined)     { updates.push(`is_deleted = $${idx++}`);     values.push(is_deleted); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(Number(req.params.id)); values.push(req.shop_id);
    const query = `UPDATE products SET ${updates.join(', ')} WHERE id = $${idx} AND shop_id = $${idx + 1} RETURNING *`;
    const result = await pool.query(query, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────
// ORDERS
// ─────────────────────────────────────────────
app.post('/orders', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { customer_name, customer_phone, address, items, payment_method, notes } = req.body;
    if (!customer_name || !customer_phone) return res.status(400).json({ error: 'customer_name and customer_phone are required' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items must be a non-empty array' });

    const pm = payment_method || 'COD';
    await client.query('BEGIN');

    const order = await client.query(
      `INSERT INTO orders (shop_id, customer_name, customer_phone, address, total_price, payment_method, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7) RETURNING *`,
      [req.shop_id, customer_name, customer_phone, address || null, 0, pm, notes || null]
    );
    const orderId = order.rows[0].id;
    let total = 0;

    for (const item of items) {
      const productId = Number(item.product_id);
      const quantity = Number(item.quantity);
      if (!Number.isInteger(productId) || productId <= 0) throw Object.assign(new Error('Invalid product_id'), { statusCode: 400 });
      if (!Number.isInteger(quantity) || quantity <= 0)   throw Object.assign(new Error('Invalid quantity'), { statusCode: 400 });

      const productRes = await client.query(
        'SELECT id, price, stock_quantity, is_available FROM products WHERE id = $1 AND shop_id = $2 FOR UPDATE',
        [productId, req.shop_id]
      );
      if (productRes.rows.length === 0) throw Object.assign(new Error(`Product not found: ${productId}`), { statusCode: 400 });
      const product = productRes.rows[0];
      if (!product.is_available) throw Object.assign(new Error(`Product not available: ${productId}`), { statusCode: 400 });
      if (product.stock_quantity < quantity) throw Object.assign(new Error(`Insufficient stock: ${productId}`), { statusCode: 400 });

      const price = Number(product.price);
      total += price * quantity;
      await client.query(`INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)`, [orderId, productId, quantity, price]);

      const stockUpdate = await client.query(
        `UPDATE products SET stock_quantity = stock_quantity - $1
         WHERE id = $2 AND shop_id = $3 AND stock_quantity >= $1 RETURNING id`,
        [quantity, productId, req.shop_id]
      );
      if (stockUpdate.rows.length === 0) throw Object.assign(new Error(`Insufficient stock: ${productId}`), { statusCode: 400 });
    }

    const orderNumber = `ORD-${1000 + orderId}`;
    await client.query('UPDATE orders SET total_price = $1, order_number = $2 WHERE id = $3', [total, orderNumber, orderId]);
    await client.query('COMMIT');

    res.json({ message: 'Order created', orderId, order_number: orderNumber, total_price: total });
  } catch (err) {
    await client.query('ROLLBACK');
    const status = err.statusCode || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Internal server error' });
  } finally {
    client.release();
  }
});

app.get('/orders', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders WHERE shop_id = $1 ORDER BY created_at DESC', [req.shop_id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/orders/:id', requireAuth, async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) return res.status(400).json({ error: 'Invalid order id' });

    const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1 AND shop_id = $2', [orderId, req.shop_id]);
    if (orderRes.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const itemsRes = await pool.query(
      `SELECT oi.id, oi.product_id, p.name AS product_name, oi.quantity, oi.price,
              (oi.quantity * oi.price)::numeric(10,2) AS line_total
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id AND o.shop_id = $2
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1 ORDER BY oi.id ASC`,
      [orderId, req.shop_id]
    );

    const items = itemsRes.rows.map(r => ({
      id: r.id, product_id: r.product_id, product_name: r.product_name,
      quantity: Number(r.quantity), price: Number(r.price), line_total: Number(r.line_total),
    }));
    const computed_total = items.reduce((sum, it) => sum + it.line_total, 0);
    const order = orderRes.rows[0];

    res.json({ order, items, totals: { computed_total, stored_total_price: Number(order.total_price) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET order items only
app.get('/orders/:id/items', requireAuth, async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) return res.status(400).json({ error: 'Invalid order id' });

    // Verify order belongs to this shop
    const orderCheck = await pool.query('SELECT id FROM orders WHERE id = $1 AND shop_id = $2', [orderId, req.shop_id]);
    if (orderCheck.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const itemsRes = await pool.query(
      `SELECT oi.id, oi.product_id, COALESCE(p.name, '[Deleted Product]') AS product_name,
              oi.quantity, oi.price, (oi.quantity * oi.price)::numeric(10,2) AS line_total,
              p.is_deleted
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1 ORDER BY oi.id ASC`,
      [orderId]
    );
    res.json(itemsRes.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// EDIT ORDER — with order locking + stock consistency
app.patch('/orders/:id', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) return res.status(400).json({ error: 'Invalid order id' });

    const { customer_name, address, payment_method, notes, items } = req.body;

    await client.query('BEGIN');

    // Fetch + lock order
    const orderRes = await client.query(
      'SELECT * FROM orders WHERE id = $1 AND shop_id = $2 FOR UPDATE',
      [orderId, req.shop_id]
    );
    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderRes.rows[0];

    // ORDER LOCKING — cannot edit locked orders
    const LOCKED_STATUSES = ['DISPATCHED', 'DELIVERED', 'COMPLETED', 'CANCELLED'];
    if (LOCKED_STATUSES.includes(order.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Order is locked (status: ${order.status}). Cannot edit.` });
    }

    // Update scalar fields
    const scalarUpdates = [];
    const scalarValues = [];
    let idx = 1;
    if (customer_name !== undefined) { scalarUpdates.push(`customer_name = $${idx++}`); scalarValues.push(customer_name); }
    if (address !== undefined)       { scalarUpdates.push(`address = $${idx++}`);       scalarValues.push(address); }
    if (payment_method !== undefined){ scalarUpdates.push(`payment_method = $${idx++}`); scalarValues.push(payment_method); }
    if (notes !== undefined)         { scalarUpdates.push(`notes = $${idx++}`);         scalarValues.push(notes); }

    // Edit items if provided — STOCK CONSISTENCY
    let newTotal = null;
    if (Array.isArray(items) && items.length > 0) {
      // Get existing items to REVERT stock
      const existingItems = await client.query(
        'SELECT product_id, quantity FROM order_items WHERE order_id = $1',
        [orderId]
      );

      // Revert old stock
      for (const old of existingItems.rows) {
        await client.query(
          'UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2 AND shop_id = $3',
          [old.quantity, old.product_id, req.shop_id]
        );
      }

      // Delete old items
      await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);

      // Insert new items + deduct stock
      newTotal = 0;
      for (const item of items) {
        const productId = Number(item.product_id);
        const quantity = Number(item.quantity);
        if (!Number.isInteger(productId) || productId <= 0) throw Object.assign(new Error('Invalid product_id'), { statusCode: 400 });
        if (!Number.isInteger(quantity) || quantity <= 0)   throw Object.assign(new Error('Invalid quantity'), { statusCode: 400 });

        // Lock product (allow deleted products to remain in edited orders)
        const productRes = await client.query(
          'SELECT id, price, stock_quantity, is_available FROM products WHERE id = $1 AND shop_id = $2 FOR UPDATE',
          [productId, req.shop_id]
        );
        if (productRes.rows.length === 0) throw Object.assign(new Error(`Product not found: ${productId}`), { statusCode: 400 });
        const product = productRes.rows[0];

        if (product.stock_quantity < quantity) {
          throw Object.assign(new Error(`Insufficient stock for product ${productId} (available: ${product.stock_quantity})`), { statusCode: 400 });
        }

        const price = Number(product.price);
        newTotal += price * quantity;

        await client.query(
          'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
          [orderId, productId, quantity, price]
        );

        // Deduct new stock
        await client.query(
          'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2 AND shop_id = $3 AND stock_quantity >= $1',
          [quantity, productId, req.shop_id]
        );
      }

      scalarUpdates.push(`total_price = $${idx++}`);
      scalarValues.push(newTotal);
    }

    if (scalarUpdates.length > 0) {
      scalarValues.push(orderId); scalarValues.push(req.shop_id);
      await client.query(
        `UPDATE orders SET ${scalarUpdates.join(', ')} WHERE id = $${idx} AND shop_id = $${idx + 1}`,
        scalarValues
      );
    }

    await client.query('COMMIT');

    await logEvent(req.shop_id, 'ORDER_EDITED', 'Order manually edited', { order_id: orderId, fields: Object.keys(req.body) });

    // Fetch updated order
    const updated = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    res.json(updated.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    const status = err.statusCode || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message || 'Internal server error' });
  } finally {
    client.release();
  }
});

// CANCEL with reason
app.patch('/orders/:id/cancel', requireAuth, async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const { cancel_reason } = req.body;
    if (!Number.isInteger(orderId) || orderId <= 0) return res.status(400).json({ error: 'Invalid order id' });

    const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1 AND shop_id = $2', [orderId, req.shop_id]);
    if (orderRes.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const order = orderRes.rows[0];
    if (order.status === 'CANCELLED') return res.status(400).json({ error: 'Already cancelled' });
    if (['DISPATCHED', 'DELIVERED', 'COMPLETED'].includes(order.status)) {
      return res.status(400).json({ error: `Cannot cancel — order is ${order.status}` });
    }

    await pool.query(
      `UPDATE orders SET status = 'CANCELLED', cancel_reason = $1 WHERE id = $2 AND shop_id = $3`,
      [cancel_reason || null, orderId, req.shop_id]
    );

    await logEvent(req.shop_id, 'ORDER_CANCELLED', cancel_reason || 'No reason provided', { order_id: orderId });

    // Notify customer via WhatsApp
    const phone = order.customer_phone || order.phone;
    if (phone) {
      const orderNum = order.order_number || `ORD-${1000 + orderId}`;
      const reasonText = cancel_reason ? `\nReason: ${cancel_reason}` : '';
      await sendMessage(phone, `❌ Order ${orderNum} cancel ho gaya hai.${reasonText}\n\nDobara order ke liye 'menu' type karo.`, req.shop_id);
    }

    res.json({ success: true, message: 'Order cancelled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// UPDATE STATUS
app.patch('/orders/:id/status', requireAuth, async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const { status } = req.body;

    const VALID_STATUSES = ['NEW', 'PENDING', 'CONFIRMED', 'PROCESSING', 'DISPATCHED', 'DELIVERED', 'COMPLETED', 'CANCELLED'];
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const existing = await pool.query('SELECT * FROM orders WHERE id = $1 AND shop_id = $2', [orderId, req.shop_id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const orderRes = await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2 AND shop_id = $3 RETURNING *',
      [status, orderId, req.shop_id]
    );
    const order = orderRes.rows[0];

    // WhatsApp sync on dispatch
    if (status === 'DISPATCHED') {
      const phone = order.customer_phone || order.phone;
      if (phone) {
        const orderNum = order.order_number || `ORD-${1000 + orderId}`;
        await sendMessage(phone, `🚚 *${orderNum}* dispatch ho gaya! Rasta karo — ⏱️ ~30 mins mein pahunch jayega.`, req.shop_id);
      }
    }

    if (status === 'DELIVERED') {
      const phone = order.customer_phone || order.phone;
      if (phone) {
        const orderNum = order.order_number || `ORD-${1000 + orderId}`;
        await sendMessage(phone, `✅ *${orderNum}* deliver ho gaya! Shukriya for ordering with us 🙏\n\nDobara order ke liye 'menu' type karo.`, req.shop_id);
      }
    }

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────
// DASHBOARD FEEDS
// ─────────────────────────────────────────────
app.get('/dashboard/orders', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders WHERE shop_id = $1 ORDER BY created_at DESC', [req.shop_id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/dashboard/stats', requireAuth, async (req, res) => {
  try {
    const shop_id = req.shop_id;
    const { startDate, endDate } = req.query;

    let dateFilter = "";
    let custDateFilter = "";
    const values = [shop_id];
    let idx = 2;
    
    if (startDate && endDate) {
       dateFilter = ` AND created_at >= $${idx} AND created_at <= $${idx+1}`;
       custDateFilter = ` AND last_order_at >= $${idx} AND last_order_at <= $${idx+1}`; // Optional depending on how customers are counted
       values.push(startDate, endDate + ' 23:59:59');
       idx += 2;
    }

    const [totalOrders, todayOrders, revenue, topProduct, totalCustomers] = await Promise.all([
      pool.query(`SELECT COUNT(*) as count FROM orders WHERE shop_id = $1${dateFilter}`, values),
      pool.query("SELECT COUNT(*) as count FROM orders WHERE shop_id = $1 AND DATE(created_at) = CURRENT_DATE", [shop_id]),
      pool.query(`SELECT COALESCE(SUM(total_price), 0) as revenue FROM orders WHERE shop_id = $1 AND status NOT IN ('CANCELLED')${dateFilter}`, values),
      pool.query(`SELECT p.name, SUM(oi.quantity) as qty
                  FROM order_items oi JOIN orders o ON o.id = oi.order_id
                  JOIN products p ON p.id = oi.product_id
                  WHERE o.shop_id = $1 AND o.status != 'CANCELLED'${dateFilter.replace(/created_at/g, 'o.created_at')}
                  GROUP BY p.name ORDER BY qty DESC LIMIT 1`, values),
      // for customers, either total ever or total matching timeline. Let's just do total ever since it's a global metric
      pool.query(`SELECT COUNT(*) as count FROM customers WHERE shop_id = $1`, [shop_id]),
    ]);

    res.json({
      total_orders: Number(totalOrders.rows[0].count),
      today_orders: Number(todayOrders.rows[0].count),
      revenue: Number(revenue.rows[0].revenue),
      top_product: topProduct.rows.length > 0 ? topProduct.rows[0].name : null,
      total_customers: Number(totalCustomers.rows[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/dashboard/notifications', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM notifications WHERE shop_id = $1 ORDER BY created_at DESC LIMIT 50', [req.shop_id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/dashboard/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = true WHERE id = $1 AND shop_id = $2', [req.params.id, req.shop_id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────
// CUSTOMERS
// ─────────────────────────────────────────────
app.get('/customers', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, 
              (SELECT COUNT(*) FROM orders WHERE customer_phone = c.phone AND shop_id = c.shop_id) as order_count
       FROM customers c
       WHERE c.shop_id = $1
       ORDER BY c.last_order_at DESC NULLS LAST`,
      [req.shop_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/customers/:phone', requireAuth, async (req, res) => {
  try {
    const phone = req.params.phone;
    const customerRes = await pool.query(
      'SELECT * FROM customers WHERE shop_id = $1 AND phone = $2',
      [req.shop_id, phone]
    );
    if (customerRes.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });

    const ordersRes = await pool.query(
      'SELECT * FROM orders WHERE shop_id = $1 AND (customer_phone = $2 OR phone = $2) ORDER BY created_at DESC LIMIT 20',
      [req.shop_id, phone]
    );

    res.json({ customer: customerRes.rows[0], orders: ordersRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/customers/:phone', requireAuth, async (req, res) => {
  try {
    const { name, address } = req.body;
    const updates = []; const values = []; let idx = 1;
    if (name !== undefined)    { updates.push(`name = $${idx++}`);    values.push(name); }
    if (address !== undefined) { updates.push(`address = $${idx++}`); values.push(address); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(req.params.phone); values.push(req.shop_id);
    const result = await pool.query(
      `UPDATE customers SET ${updates.join(', ')} WHERE phone = $${idx} AND shop_id = $${idx + 1} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/customers/import-vcf', requireAuth, async (req, res) => {
  try {
    const { contacts } = req.body;
    if (!Array.isArray(contacts)) return res.status(400).json({ error: 'Contacts must be an array' });
    
    let imported = 0;
    
    // Process sequential to avoid overwhelming connections, or use unnest
    for (const c of contacts) {
      if (!c.phone) continue;
      // Standardize phone (remove +, spaces, formatting)
      let phone = c.phone.replace(/\D/g, '');
      if (phone.length < 10) continue;
      
      await pool.query(
        `INSERT INTO customers (shop_id, phone, name) 
         VALUES ($1, $2, $3)
         ON CONFLICT (shop_id, phone) DO UPDATE SET name = EXCLUDED.name`,
        [req.shop_id, phone, c.name || "Unknown"]
      );
      imported++;
    }
    
    res.json({ success: true, imported });
  } catch (err) {
    console.error('VCF Import Error:', err);
    res.status(500).json({ error: 'Internal server error while importing contacts' });
  }
});

app.post('/customers/broadcast', requireAuth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const customersRes = await pool.query('SELECT phone FROM customers WHERE shop_id = $1', [req.shop_id]);
    const customers = customersRes.rows;
    if (customers.length === 0) return res.status(400).json({ error: 'No customers found for broadcast' });

    // Broadcast logic (runs in background to not block HTTP response)
    const processBroadcast = async () => {
      for (const c of customers) {
        try {
           await sendMessage(c.phone, message, req.shop_id);
           // Delay to avoid WhatsApp Cloud API rate limits (10-20 msgs/sec standard)
           await new Promise(r => setTimeout(r, 150)); 
        } catch(e) {
           console.error('Broadcast failed for:', c.phone, e.message);
        }
      }
    };
    
    processBroadcast();

    res.json({ success: true, count: customers.length, message: 'Broadcast initiated successfully' });
  } catch (err) {
    console.error('Broadcast Setup Error:', err);
    res.status(500).json({ error: 'Internal server error during broadcast setup' });
  }
});

// ─────────────────────────────────────────────
// ADMIN CONTROL PANEL
// ─────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const secret = req.headers['x-admin-secret'];
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

app.get('/admin/shops', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.name, s.email, s.wa_phone, s.wa_phone_id, s.is_active, s.plan, s.created_at,
              (SELECT COUNT(*) FROM orders WHERE shop_id = s.id) as total_orders,
              (SELECT COUNT(*) FROM orders WHERE shop_id = s.id AND DATE(created_at) = CURRENT_DATE) as today_orders,
              (SELECT COUNT(*) FROM customers WHERE shop_id = s.id) as total_customers
       FROM shops s ORDER BY s.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/admin/shops/:id', requireAdmin, async (req, res) => {
  try {
    const { is_active, plan } = req.body;
    const updates = []; const values = []; let idx = 1;
    if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); values.push(is_active); }
    if (plan !== undefined)      { updates.push(`plan = $${idx++}`);      values.push(plan); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields provided' });
    values.push(Number(req.params.id));
    const result = await pool.query(
      `UPDATE shops SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, name, email, is_active, plan`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/admin/shops/:id', requireAdmin, async (req, res) => {
  try {
    const shopId = Number(req.params.id);
    
    const tables = [
      'chat_messages', 'chat_sessions', 'products', 'customers', 
      'whatsapp_numbers', 'whatsapp_sessions', 'processed_messages', 
      'logs', 'events', 'notifications'
    ];
    
    try { await pool.query('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE shop_id = $1)', [shopId]); } catch(e) {}
    try { await pool.query('DELETE FROM orders WHERE shop_id = $1', [shopId]); } catch(e) {}

    for (const table of tables) {
      try { await pool.query(`DELETE FROM ${table} WHERE shop_id = $1`, [shopId]); } catch(e) {}
    }
    
    const result = await pool.query('DELETE FROM shops WHERE id = $1 RETURNING id', [shopId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    
    res.json({ success: true, message: "Shop and all associated data heavily deleted." });
  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ error: err.message, detail: err.detail });
  }
});

// Deprecated fallback
app.get('/notifications', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM notifications WHERE shop_id = $1 ORDER BY created_at DESC LIMIT 50', [req.shop_id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Dev helper
app.post('/dev/map-phone', requireAuth, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone is required' });
    await pool.query(
      `INSERT INTO whatsapp_numbers (shop_id, phone_number) VALUES ($1, $2)
       ON CONFLICT (phone_number) DO UPDATE SET shop_id = EXCLUDED.shop_id, is_active = true`,
      [req.shop_id, String(phone)]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/debug/logs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM logs ORDER BY created_at DESC LIMIT 10');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// CHAT & MESSAGING API
// ─────────────────────────────────────────────
app.get('/chats', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cs.phone, cs.updated_at, cs.human_mode, 
              c.name as customer_name,
              (SELECT content FROM messages m WHERE m.shop_id = $1 AND m.phone = cs.phone ORDER BY created_at DESC LIMIT 1) as last_message_preview,
              (SELECT direction FROM messages m WHERE m.shop_id = $1 AND m.phone = cs.phone ORDER BY created_at DESC LIMIT 1) as last_message_direction
       FROM chat_sessions cs
       LEFT JOIN customers c ON cs.shop_id = c.shop_id AND cs.phone = c.phone
       WHERE cs.shop_id = $1
       ORDER BY cs.updated_at DESC`,
      [req.shop_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/chats/:phone/messages', requireAuth, async (req, res) => {
  try {
    const { phone } = req.params;
    const { after } = req.query; // Delta sync ISO string
    
    let query = `SELECT id, direction, content, created_at, message_id FROM messages WHERE shop_id = $1 AND phone = $2`;
    const values = [req.shop_id, phone];
    
    if (after) {
      query += ` AND created_at > $3`;
      values.push(new Date(after));
    }
    
    query += ` ORDER BY created_at ASC, id ASC LIMIT 500`; // Safety limit
    
    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/chats/:phone/mode', requireAuth, async (req, res) => {
  try {
    const { phone } = req.params;
    const { human_mode } = req.body;
    
    await pool.query(
      `INSERT INTO chat_sessions (shop_id, phone, human_mode, updated_at) 
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (shop_id, phone) 
       DO UPDATE SET human_mode = EXCLUDED.human_mode, updated_at = CURRENT_TIMESTAMP`,
      [req.shop_id, phone, !!human_mode]
    );
    res.json({ success: true, human_mode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/chats/:phone/messages', requireAuth, async (req, res) => {
  try {
    const { phone } = req.params;
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });
    
    // Dynamically lazy-load sendMessage since server.js isn't the primary owner of Meta API
    // Actually, whatsapp.js exports sendMessage but it might become cyclical. Let's send directly here.
    const shopRes = await pool.query(`SELECT wa_token, wa_phone_id FROM shops WHERE id = $1`, [req.shop_id]);
    const shop = shopRes.rows[0];
    const token = shop?.wa_token || process.env.WA_TOKEN;
    const phoneId = shop?.wa_phone_id || process.env.WA_PHONE_ID;
    
    // Insert pending state or let sendMessage do it?
    // We will do HTTP Call then insert.
    if (token && phoneId) {
       const resp = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
         method: 'POST',
         headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
         body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: String(text) } })
       });
       if (!resp.ok) {
          const body = await resp.text();
          console.error("WA API ERROR:", body);
          return res.status(500).json({ error: 'WhatsApp API error', details: body });
       }
    }
    
    // Add to our DB
    const crypto = require('crypto');
    const msgId = 'out_' + crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO messages (shop_id, phone, direction, content, message_id) VALUES ($1, $2, 'OUTGOING', $3, $4) RETURNING *`,
      [req.shop_id, phone, text, msgId]
    );
    
    // Touch chat_sessions
    await pool.query(
      `UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE shop_id = $1 AND phone = $2`,
      [req.shop_id, phone]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});