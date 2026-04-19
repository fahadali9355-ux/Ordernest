const { pool } = require('./db');

// ─────────────────────────────────────────────
// STATE MACHINE
// ─────────────────────────────────────────────
const STATES = Object.freeze({
  NEW: 'NEW',
  SHOWING_MENU: 'SHOWING_MENU',
  ORDERING: 'ORDERING',
  AWAITING_CONFIRM: 'AWAITING_CONFIRM',
  AWAITING_ADDRESS: 'AWAITING_ADDRESS',
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
});

const VALID_TRANSITIONS = Object.freeze({
  [STATES.NEW]:             [STATES.SHOWING_MENU, STATES.ORDERING],
  [STATES.SHOWING_MENU]:    [STATES.ORDERING],
  [STATES.ORDERING]:        [STATES.AWAITING_CONFIRM, STATES.SHOWING_MENU],
  [STATES.AWAITING_CONFIRM]:[STATES.AWAITING_ADDRESS, STATES.ORDERING, STATES.CANCELLED],
  [STATES.AWAITING_ADDRESS]:[STATES.AWAITING_PAYMENT, STATES.CANCELLED],
  [STATES.AWAITING_PAYMENT]:[STATES.CONFIRMED, STATES.CANCELLED],
  [STATES.CONFIRMED]:       [],
  [STATES.CANCELLED]:       [],
});

// Terminal states — reset on next message
const TERMINAL_STATES = new Set([STATES.CONFIRMED, STATES.CANCELLED]);

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

function updateState(current, next) {
  const allowed = VALID_TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    throw new Error(`Invalid state transition: ${current} → ${next}`);
  }
  return next;
}

// ─────────────────────────────────────────────
// ORDER STATUS MACHINE
// ─────────────────────────────────────────────
const VALID_ORDER_TRANSITIONS = Object.freeze({
  PENDING:    ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:  ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['DISPATCHED'],
  DISPATCHED: ['DELIVERED'],
  DELIVERED:  [],
  COMPLETED:  [],
  CANCELLED:  [],
  NEW:        ['CONFIRMED', 'CANCELLED'],
});

function updateOrderStatus(current, next) {
  const allowed = VALID_ORDER_TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    throw new Error(`Invalid order transition: ${current} → ${next}`);
  }
  return next;
}

// ─────────────────────────────────────────────
// TEXT NORMALIZER
// ─────────────────────────────────────────────
function normalizeText(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isValidMessage(text) {
  if (!text) return false;
  if (String(text).length > 300) return false;
  return true;
}

// ─────────────────────────────────────────────
// INTENT DETECTION — with Roman Urdu support
// ─────────────────────────────────────────────
function detectIntent(text) {
  if (!text) return 'UNKNOWN';
  const t = text.toLowerCase().trim();

  // MENU intent — English + Roman Urdu
  if (
    t.includes('menu') || t.includes('manu') ||
    t.includes('menu bhejo') || t.includes('menu dikhao') ||
    t.includes('kya hai') || t.includes('list') ||
    t.includes('items') || t.includes('order karna') ||
    t === 'hi' || t === 'hello' || t === 'helo' ||
    t === 'salam' || t === 'assalam' || t === 'start' ||
    t === 'hey'
  ) return 'MENU';

  // HELP intent
  if (t.includes('help') || t.includes('madad') || t.includes('support')) return 'HELP';

  // CANCEL intent
  if (
    t.includes('cancel') || t.includes('band') || t.includes('nahi') ||
    t.includes('rukao') || t.includes('ruk jao') || t.includes('mat bhejo') ||
    t.includes('wapas') || t === 'no' || t === 'n'
  ) return 'CANCEL';

  // CONFIRM intent
  if (
    t.includes('yes') || t.includes('confirm') || t.includes('haan') ||
    t.includes('han') || t.includes('ha') || t.includes('okay') ||
    t.includes('ok') || t.includes('theek') || t.includes('done') ||
    t.includes('bilkul') || t.includes('zaroor') || t === 'y'
  ) return 'CONFIRM';

  // PICKUP intent (for address step)
  if (
    t.includes('pickup') || t.includes('pick up') || t.includes('khud le lunga') ||
    t.includes('aata hun') || t.includes('self')
  ) return 'PICKUP';

  // ORDER intent — numeric OR item-like text OR Roman Urdu ordering phrases
  if (/\d/.test(t)) return 'ORDER';
  if (t.includes('bhej') || t.includes('chahiye') || t.includes('chahye') ||
      t.includes('do') || t.includes('dena') || t.includes('lena') ||
      t.includes('order')) return 'ORDER';
  if (/[a-z]/.test(t)) return 'ORDER';

  return 'UNKNOWN';
}

// ─────────────────────────────────────────────
// ORDER PARSER
// ─────────────────────────────────────────────
function parseOrder(text) {
  let normalized = normalizeText(text);

  const qtyMatch = normalized.match(/(\d+)/);
  const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;

  let item = normalized
    .replace(/\d+\s*x\s*/gi, ' ')
    .replace(/\d+/g, ' ')
    .replace(/\bx\b/gi, ' ');

  // Remove Roman Urdu filler words + English fillers
  item = item
    .replace(/\b(mujhe|chahiye|chahye|please|plz|pls|bhej|bhejo|dena|dedo|de|do|lena|order|bhai|yar|ek|aik)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { item, qty };
}

function buildFuzzyPattern(itemText) {
  const words = normalizeText(itemText).split(' ').filter(Boolean);
  if (words.length === 0) return null;
  return `%${words.join('%')}%`;
}

// ─────────────────────────────────────────────
// LOGGING
// ─────────────────────────────────────────────
async function logEvent(shop_id, type, message, meta) {
  try {
    await pool.query(
      `INSERT INTO logs (shop_id, type, message, meta) VALUES ($1, $2, $3, $4)`,
      [shop_id, type, message, meta ? JSON.stringify(meta) : null]
    );
  } catch { /* best-effort */ }
}

async function trackEvent(shop_id, event_type, meta) {
  try {
    await pool.query(
      `INSERT INTO events (shop_id, event_type, meta) VALUES ($1, $2, $3)`,
      [shop_id, event_type, meta ? JSON.stringify(meta) : null]
    );
  } catch { /* best-effort */ }
}

async function logError(shop_id, err, meta) {
  try {
    await pool.query(
      `INSERT INTO logs (shop_id, type, message, meta) VALUES ($1, $2, $3, $4)`,
      [
        shop_id || null,
        'ERROR',
        String(err?.message || err || 'Unknown error'),
        JSON.stringify({ ...(meta || {}), stack: err?.stack, raw: String(err) }),
      ]
    );
  } catch { /* best-effort */ }
}

// ─────────────────────────────────────────────
// SEND MESSAGE — with retry + fail-safe
// ─────────────────────────────────────────────
async function sendMessage(phone, text, shop_id) {
  let token = process.env.WA_TOKEN;
  let phoneId = process.env.WA_PHONE_ID;

  // Per-shop credentials
  if (shop_id) {
    try {
      const shopRes = await pool.query(
        `SELECT wa_token, wa_phone_id FROM shops WHERE id = $1`,
        [shop_id]
      );
      if (shopRes.rows.length && shopRes.rows[0].wa_phone_id && shopRes.rows[0].wa_token) {
        token = shopRes.rows[0].wa_token;
        phoneId = shopRes.rows[0].wa_phone_id;
      }
    } catch { /* fallback to env */ }
  }

  // Dev mode: no credentials
  if (!token || !phoneId) {
    console.log('[DEV] SEND TO:', phone, text);
    return { success: true, dev: true };
  }

  // Retry logic: 3 attempts with exponential backoff
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 1000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const resp = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { body: String(text || '') },
        }),
      });

      if (resp.ok) {
        console.log(`✅ MSG SENT to ${phone} [${attempt}]`);
        return { success: true };
      }

      const body = await resp.text().catch(() => '');
      console.error(`❌ WA API error [attempt ${attempt}]: status=${resp.status} body=${body}`);
      const err = new Error(`WhatsApp send failed: ${resp.status} ${body}`);

      if (attempt === MAX_RETRIES) {
        await logEvent(shop_id, 'MESSAGE_SEND_FAILED', err.message, { phone, attempt, text: text?.slice(0, 100) });
        return { success: false, error: err.message };
      }

      // Wait before retry (exponential: 1s, 2s, 4s)
      await new Promise(r => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt - 1)));

    } catch (fetchErr) {
      console.error(`❌ WA fetch error [attempt ${attempt}]:`, fetchErr.message);
      if (attempt === MAX_RETRIES) {
        await logEvent(shop_id, 'MESSAGE_SEND_FAILED', String(fetchErr.message), { phone, attempt });
        return { success: false, error: fetchErr.message };
      }
      await new Promise(r => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt - 1)));
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}

// ─────────────────────────────────────────────
// REPLY HELPERS
// ─────────────────────────────────────────────

// Typing delay for human feel (non-blocking cosmetic)
async function typingDelay(ms = 800) {
  await new Promise(r => setTimeout(r, ms));
}

async function safeReply(phone, text, shop_id) {
  let msg = text;
  if (!msg || String(msg).trim() === '') {
    msg = "⚠️ Something went wrong. Please try again or type 'menu'.";
  }
  await typingDelay(700);
  return sendMessage(phone, msg, shop_id);
}

async function hardFailReply(phone, shop_id) {
  return sendMessage(phone, "⚠️ Something went wrong. Please try again or type 'menu'.", shop_id);
}

async function sendHelp(phone, shop_id) {
  const helpText =
    "🤖 *OrderBot Help*\n\n" +
    "📋 *MENU* — Type: menu\n" +
    "🛒 *ORDER* — Example: 2 burger\n" +
    "✅ *CONFIRM* — Type: yes / haan / ok\n" +
    "❌ *CANCEL* — Type: cancel / nahi\n\n" +
    "Koi masla? Dobara 'menu' type karo.";
  await typingDelay(500);
  return sendMessage(phone, helpText, shop_id);
}

async function sendMenu(shop_id, phone) {
  try {
    const products = await pool.query(
      `SELECT id, name, price FROM products
       WHERE shop_id = $1 AND is_available = true AND is_deleted = false
       ORDER BY created_at DESC`,
      [shop_id]
    );

    // Get shop name
    const shopRes = await pool.query(`SELECT name FROM shops WHERE id = $1`, [shop_id]);
    const shopName = shopRes.rows[0]?.name || 'Our Shop';

    if (products.rows.length === 0) {
      return safeReply(phone, "📭 Menu abhi available nahi hai. Baad mein try karo.", shop_id);
    }

    const EMOJIS = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
    let menu = `🍽️ *MENU — ${shopName}*\n\n`;
    products.rows.forEach((p, idx) => {
      const emoji = EMOJIS[idx] || '•';
      menu += `${emoji} ${p.name} — Rs ${Number(p.price).toLocaleString()}\n`;
    });
    menu += "\n📝 Order karo: item + qty\n   Example: *2 burger* ya *1 fries*\n❓ Help chahiye? Type 'help'";

    await typingDelay(600);
    return sendMessage(phone, menu, shop_id);
  } catch (err) {
    await logError(shop_id, err, { where: 'sendMenu', phone });
    return hardFailReply(phone, shop_id);
  }
}

// ─────────────────────────────────────────────
// CUSTOMER MANAGEMENT
// ─────────────────────────────────────────────
async function getOrCreateCustomer(shop_id, phone) {
  try {
    const existing = await pool.query(
      `SELECT * FROM customers WHERE shop_id = $1 AND phone = $2`,
      [shop_id, phone]
    );
    if (existing.rows.length) return existing.rows[0];

    const created = await pool.query(
      `INSERT INTO customers (shop_id, phone) VALUES ($1, $2) RETURNING *`,
      [shop_id, phone]
    );
    return created.rows[0];
  } catch {
    return null;
  }
}

async function updateCustomerAfterOrder(shop_id, phone, address) {
  try {
    await pool.query(
      `UPDATE customers
       SET total_orders = total_orders + 1,
           last_order_at = CURRENT_TIMESTAMP,
           address = COALESCE($3, address)
       WHERE shop_id = $1 AND phone = $2`,
      [shop_id, phone, address || null]
    );
  } catch { /* best-effort */ }
}

// ─────────────────────────────────────────────
// PRODUCT RESOLUTION
// ─────────────────────────────────────────────
async function resolveProduct(shop_id, itemText) {
  const pattern = buildFuzzyPattern(itemText);
  if (!pattern) return null;

  const result = await pool.query(
    `SELECT id, name, price, stock_quantity, is_available
     FROM products
     WHERE shop_id = $1
       AND is_deleted = false
       AND is_available = true
       AND LOWER(name) LIKE LOWER($2)
     LIMIT 5`,
    [shop_id, pattern]
  );

  if (result.rows.length === 0) return null;
  if (result.rows.length === 1) return result.rows[0];
  return { type: 'MULTI_MATCH', options: result.rows };
}

// ─────────────────────────────────────────────
// ORDER INPUT HANDLER
// ─────────────────────────────────────────────
async function handleOrderInput(shop_id, phone, rawText) {
  const { item, qty } = parseOrder(rawText);

  if (!item) {
    await logEvent(shop_id, 'PRODUCT_MATCH_FAILED', 'Empty item after parse', { phone, rawText });
    return safeReply(phone, "Kya order karna hai? Type 'menu' dekho.", shop_id);
  }
  if (!Number.isInteger(qty) || qty <= 0 || qty > 100) {
    return safeReply(phone, 'Quantity 1 se 100 ke beech honi chahiye.', shop_id);
  }

  let resolved;
  try {
    resolved = await resolveProduct(shop_id, item);
  } catch (err) {
    await logError(shop_id, err, { where: 'resolveProduct', phone, item });
    return hardFailReply(phone, shop_id);
  }

  if (!resolved) {
    await logEvent(shop_id, 'PRODUCT_MATCH_FAILED', 'No product matched', { phone, item, rawText });
    return safeReply(phone, `"${item}" nahi mila. Type 'menu' dekho.`, shop_id);
  }

  if (resolved.type === 'MULTI_MATCH') {
    const options = resolved.options.slice(0, 5).map(p => ({ id: p.id, name: p.name, price: p.price }));
    await pool.query(
      `UPDATE chat_sessions
       SET state = 'ORDERING',
           temp_data = COALESCE(temp_data, '{}'::jsonb) || $1::jsonb,
           updated_at = CURRENT_TIMESTAMP
       WHERE phone = $2 AND shop_id = $3`,
      [JSON.stringify({ multi_match: { options, qty } }), phone, shop_id]
    );

    let msg = '🔍 Multiple items mili:\n\n';
    options.forEach((o, idx) => { msg += `${idx + 1}. ${o.name} — Rs ${o.price}\n`; });
    msg += '\nNumber choose karo (e.g. 1):';
    await trackEvent(shop_id, 'product_matched', { phone, item, type: 'multi', options_count: options.length });
    return safeReply(phone, msg, shop_id);
  }

  const p = resolved;
  await trackEvent(shop_id, 'product_matched', { phone, item, type: 'single', product_id: p.id });

  if (p.stock_quantity !== null && Number(p.stock_quantity) < qty) {
    await logEvent(shop_id, 'STOCK_INSUFFICIENT', 'Not enough stock at order input', { phone, product_id: p.id, qty, stock: p.stock_quantity });
    return safeReply(phone, `❌ Maafi! "${p.name}" ka stock khatam hai.`, shop_id);
  }

  const unit_price = Number(p.price);
  const total = Number((unit_price * qty).toFixed(2));

  await pool.query(
    `UPDATE chat_sessions
     SET state = 'AWAITING_CONFIRM',
         temp_data = COALESCE(temp_data, '{}'::jsonb) || $1::jsonb,
         updated_at = CURRENT_TIMESTAMP
     WHERE phone = $2 AND shop_id = $3`,
    [JSON.stringify({ product_id: p.id, qty, unit_price, total, product_name: p.name }), phone, shop_id]
  );

  return safeReply(
    phone,
    `🛒 *Order Summary*\n\n📦 ${qty}x ${p.name}\n💰 Total: Rs ${total}\n\nConfirm karo? Reply: *yes* / *haan*\nCancel: *cancel*`,
    shop_id
  );
}

// ─────────────────────────────────────────────
// ORDER CONFIRMATION — with address + payment flow
// ─────────────────────────────────────────────
async function confirmOrder(shop_id, phone, confirmationMessageId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const sessionRes = await client.query(
      `SELECT id, state, temp_data FROM chat_sessions
       WHERE phone = $1 AND shop_id = $2 LIMIT 1 FOR UPDATE`,
      [phone, shop_id]
    );

    if (!sessionRes.rows.length) {
      await client.query('ROLLBACK');
      return safeReply(phone, "Koi active order nahi. Type 'menu' karo.", shop_id);
    }

    const session = sessionRes.rows[0];

    // Duplicate spam guard — if already past AWAITING_CONFIRM, ignore
    if (session.state !== 'AWAITING_CONFIRM') {
      await client.query('ROLLBACK');
      if (session.state === 'AWAITING_ADDRESS') {
        return safeReply(phone, "📍 Pehle address bhejo.", shop_id);
      }
      if (session.state === 'AWAITING_PAYMENT') {
        return safeReply(phone, "💰 Pehle payment method choose karo:\n1️⃣ Cash on Delivery\n2️⃣ Online Payment", shop_id);
      }
      return safeReply(phone, "Kuch confirm nahi hai. Type 'menu' karo.", shop_id);
    }

    if (!session.temp_data) {
      await client.query('ROLLBACK');
      return safeReply(phone, "Invalid order. Dobara order karo.", shop_id);
    }

    const data = session.temp_data;
    const product_id = Number(data.product_id);
    const qty = Number(data.qty);

    if (!Number.isInteger(product_id) || !Number.isInteger(qty) || qty <= 0) {
      await client.query('ROLLBACK');
      return safeReply(phone, 'Invalid order data. Dobara try karo.', shop_id);
    }

    // Move to AWAITING_ADDRESS state
    await client.query(
      `UPDATE chat_sessions
       SET state = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [STATES.AWAITING_ADDRESS, session.id]
    );

    await client.query('COMMIT');

    // Ask for address
    return safeReply(
      phone,
      "📍 *Delivery address bhejo!*\n\nPuri address likhein (ghar number, gali, area)\nYa type karo *pickup* agar khud lene aana hai 🏪",
      shop_id
    );
  } catch (err) {
    await client.query('ROLLBACK');
    await logError(shop_id, err, { where: 'confirmOrder', phone });
    return hardFailReply(phone, shop_id);
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────
// ADDRESS HANDLER
// ─────────────────────────────────────────────
async function handleAddress(shop_id, phone, rawText, intent) {
  const address = intent === 'PICKUP' ? 'SELF-PICKUP' : rawText.trim();

  await pool.query(
    `UPDATE chat_sessions
     SET state = $1,
         temp_data = COALESCE(temp_data, '{}'::jsonb) || $2::jsonb,
         updated_at = CURRENT_TIMESTAMP
     WHERE phone = $3 AND shop_id = $4`,
    [STATES.AWAITING_PAYMENT, JSON.stringify({ address }), phone, shop_id]
  );

  await logEvent(shop_id, 'ADDRESS_RECEIVED', 'Customer provided address', { phone, address });

  return safeReply(
    phone,
    "💰 *Payment method choose karo:*\n\n1️⃣ Cash on Delivery (COD)\n2️⃣ Online Payment\n\nSirf number reply karo (1 ya 2)",
    shop_id
  );
}

// ─────────────────────────────────────────────
// PAYMENT HANDLER — creates the actual order
// ─────────────────────────────────────────────
async function handlePayment(shop_id, phone, rawText, sessionData, confirmationMessageId) {
  const client = await pool.connect();
  try {
    const normalized = normalizeText(rawText);
    let paymentMethod = 'COD';
    if (normalized === '2' || normalized.includes('online') || normalized.includes('card') || normalized.includes('transfer')) {
      paymentMethod = 'ONLINE';
    }

    const address = sessionData.address || null;
    const product_id = Number(sessionData.product_id);
    const qty = Number(sessionData.qty);

    if (!Number.isInteger(product_id) || !Number.isInteger(qty) || qty <= 0) {
      return safeReply(phone, 'Order data kho gaya. Dobara order karo.', shop_id);
    }

    await client.query('BEGIN');

    // Lock + validate product
    const productRes = await client.query(
      `SELECT id, price, stock_quantity, is_available, name
       FROM products WHERE id = $1 AND shop_id = $2 FOR UPDATE`,
      [product_id, shop_id]
    );
    if (!productRes.rows.length) {
      throw Object.assign(new Error('Product not found'), { statusCode: 400 });
    }
    const product = productRes.rows[0];
    if (!product.is_available) {
      throw Object.assign(new Error('Product not available'), { statusCode: 400 });
    }

    const unit_price = Number(product.price);
    const total = Number((unit_price * qty).toFixed(2));

    // Safe stock update
    const stockUpdate = await client.query(
      `UPDATE products
       SET stock_quantity = stock_quantity - $1
       WHERE id = $2 AND shop_id = $3 AND stock_quantity >= $1
       RETURNING id, stock_quantity`,
      [qty, product_id, shop_id]
    );
    if (!stockUpdate.rows.length) {
      await logEvent(shop_id, 'STOCK_INSUFFICIENT', 'Stock depleted at payment step', { phone, product_id, qty });
      throw Object.assign(new Error('Insufficient stock — try a lower quantity'), { statusCode: 400 });
    }

    // Low stock alert
    if (stockUpdate.rows[0].stock_quantity < 5) {
      await client.query(
        `INSERT INTO notifications (shop_id, message) VALUES ($1, $2)`,
        [shop_id, `⚠️ Low stock: "${product.name}" sirf ${stockUpdate.rows[0].stock_quantity} bacha hai!`]
      );
    }

    // Get customer name for order
    const customerRes = await pool.query(
      `SELECT name FROM customers WHERE shop_id = $1 AND phone = $2`,
      [shop_id, phone]
    );
    const customerName = customerRes.rows[0]?.name || null;

    // Create order (PENDING → CONFIRMED)
    const orderInsert = await client.query(
      `INSERT INTO orders
         (shop_id, customer_phone, phone, customer_name, address, total_price, payment_method, message_id, status, delivery_estimate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', '~30 mins')
       RETURNING id, status`,
      [shop_id, phone, phone, customerName, address, total, paymentMethod, confirmationMessageId ? String(confirmationMessageId) : null]
    );

    const orderId = orderInsert.rows[0].id;
    const orderNumber = `ORD-${1000 + orderId}`;

    // Set order number
    await client.query(`UPDATE orders SET order_number = $1, status = 'CONFIRMED' WHERE id = $2`, [orderNumber, orderId]);

    // Create order item
    await client.query(
      `INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)`,
      [orderId, product_id, qty, unit_price]
    );

    // Reset session
    await client.query(
      `UPDATE chat_sessions
       SET state = $1, temp_data = '{}'::jsonb, updated_at = CURRENT_TIMESTAMP
       WHERE phone = $2 AND shop_id = $3`,
      [STATES.CONFIRMED, phone, shop_id]
    );

    await client.query('COMMIT');

    // Update customer record
    await updateCustomerAfterOrder(shop_id, phone, address);

    // Notify shop owner
    try {
      await pool.query(
        `INSERT INTO notifications (shop_id, message) VALUES ($1, $2)`,
        [shop_id, `🔔 New order ${orderNumber} from ${phone}! Rs ${total} — ${paymentMethod}`]
      );
    } catch { /* best-effort */ }

    await logEvent(shop_id, 'ORDER_CONFIRMED', 'WhatsApp order confirmed', { phone, order_id: orderId, order_number: orderNumber });
    await trackEvent(shop_id, 'order_created', { phone, order_id: orderId, total, payment_method: paymentMethod });

    // WOW — confirmation message with all details
    const payDisplay = paymentMethod === 'COD' ? 'Cash on Delivery 💵' : 'Online Payment 💳';
    const addressDisplay = address === 'SELF-PICKUP' ? '🏪 Self-Pickup' : `📍 ${address}`;

    return safeReply(
      phone,
      `✅ *Order Confirmed! Shukriya!* 🎉\n\n` +
      `🧾 *${orderNumber}*\n` +
      `📦 ${qty}x ${product.name}\n` +
      `💰 Total: Rs ${total}\n` +
      `${addressDisplay}\n` +
      `💳 ${payDisplay}\n` +
      `⏱️ Estimated delivery: *~30 mins*\n\n` +
      `Dobara order ke liye: 'menu' type karo 🛍️`,
      shop_id
    );
  } catch (err) {
    await client.query('ROLLBACK');
    await logError(shop_id, err, { where: 'handlePayment', phone });
    if (err.statusCode === 400) {
      return safeReply(phone, `❌ ${err.message}. Type 'menu' to start again.`, shop_id);
    }
    return hardFailReply(phone, shop_id);
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────
// MAIN MESSAGE HANDLER
// ─────────────────────────────────────────────
async function handleMessage(shop_id, phone, text, message_id) {
  if (!shop_id) return;
  console.log(`\ud83e\udde0 handleMessage: shop=${shop_id} phone=${phone} text="${text}"`);

  // Get/create customer record
  await getOrCreateCustomer(shop_id, phone);

  // Get/create chat session
  let sessionRes = await pool.query(
    `SELECT * FROM chat_sessions WHERE phone = $1 AND shop_id = $2 LIMIT 1`,
    [phone, shop_id]
  );
  console.log(`\ud83d\udcac Session exists: ${sessionRes.rows.length > 0}, state: ${sessionRes.rows[0]?.state || 'NEW'}`);

  if (!sessionRes.rows.length) {
    await pool.query(
      `INSERT INTO chat_sessions (shop_id, phone, state, temp_data, expires_at)
       VALUES ($1, $2, $3, '{}'::jsonb, $4)`,
      [shop_id, phone, STATES.NEW, new Date(Date.now() + SESSION_TTL_MS)]
    );
    sessionRes = { rows: [{ state: STATES.NEW, temp_data: {} }] };
  }


  let state = sessionRes.rows[0].state || STATES.NEW;
  const temp_data = sessionRes.rows[0].temp_data || {};
  const normalized = normalizeText(text);
  const intent = detectIntent(normalized);
  if (intent === 'MENU') {
    await pool.query(`UPDATE chat_sessions SET state = $1, temp_data = '{}'::jsonb WHERE phone = $2 AND shop_id = $3`, [STATES.NEW, phone, shop_id]);
    return await handleNewState(shop_id, phone);
  }

  if (!isValidMessage(normalized)) {
    return safeReply(phone, "⚠️ Message samajh nahi aaya. Type 'menu' karo.", shop_id);
  }

  // ── SESSION TTL / BREAK RECOVERY ──────────────
  const now = new Date();
  const expiresAt = sessionRes.rows[0].expires_at ? new Date(sessionRes.rows[0].expires_at) : null;
  const isExpired = !expiresAt || expiresAt.getTime() < now.getTime();

  if (isExpired || TERMINAL_STATES.has(state) || !VALID_TRANSITIONS[state]) {
    // Session expired or terminal — reset gracefully
    const wasActive = state !== STATES.NEW && state !== STATES.SHOWING_MENU;
    state = STATES.NEW;
    await pool.query(
      `UPDATE chat_sessions
       SET state = $1, temp_data = '{}'::jsonb, expires_at = $2, updated_at = CURRENT_TIMESTAMP
       WHERE phone = $3 AND shop_id = $4`,
      [STATES.NEW, new Date(now.getTime() + SESSION_TTL_MS), phone, shop_id]
    );
    if (isExpired && wasActive) {
      await logEvent(shop_id, 'SESSION_EXPIRED', 'Session reset after TTL', { phone, old_state: state });
      // Let the message still be processed normally after reset
    }
  } else {
    // Extend TTL on activity
    await pool.query(
      `UPDATE chat_sessions
       SET expires_at = $1, updated_at = CURRENT_TIMESTAMP
       WHERE phone = $2 AND shop_id = $3`,
      [new Date(now.getTime() + SESSION_TTL_MS), phone, shop_id]
    );
  }

  // ── Store last_message ─────────────────────
  try {
    await pool.query(
      `UPDATE chat_sessions SET last_message = $1, updated_at = CURRENT_TIMESTAMP
       WHERE phone = $2 AND shop_id = $3`,
      [normalized, phone, shop_id]
    );
  } catch { /* ignore */ }

  // ── ALWAYS ALLOWED: HELP ───────────────────
  if (intent === 'HELP') return sendHelp(phone, shop_id);

  // ── MENU ───────────────────────────────────
  if (intent === 'MENU') {
    try {
      let next = state;
      // From AWAITING_CONFIRM, go back to ORDERING first
      if (state === STATES.AWAITING_CONFIRM) {
        next = updateState(state, STATES.ORDERING);
        await pool.query(
          `UPDATE chat_sessions SET state = $1, updated_at = CURRENT_TIMESTAMP
           WHERE phone = $2 AND shop_id = $3`,
          [next, phone, shop_id]
        );
        state = next;
      }
      const menuNext = updateState(state, STATES.SHOWING_MENU);
      await pool.query(
        `UPDATE chat_sessions SET state = $1, updated_at = CURRENT_TIMESTAMP
         WHERE phone = $2 AND shop_id = $3`,
        [menuNext, phone, shop_id]
      );
    } catch (err) {
      await logError(shop_id, err, { where: 'menu-transition', phone, state });
      // Force reset and show menu anyway
      await pool.query(
        `UPDATE chat_sessions SET state = $1, temp_data = '{}'::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE phone = $2 AND shop_id = $3`,
        [STATES.SHOWING_MENU, phone, shop_id]
      );
    }

    // Welcome back greeting for returning customers
    const customer = await getOrCreateCustomer(shop_id, phone);
    if (customer && customer.total_orders >= 1) {
      await sendMessage(phone, `👋 Welcome back! Apka ${customer.total_orders} orders ka shukriya!`, shop_id);
      await typingDelay(800);
    }

    return sendMenu(shop_id, phone);
  }

  
  // ── STATE: AWAITING_ADDRESS ────────────────
  if (state === STATES.AWAITING_ADDRESS) {
    if (intent === 'CANCEL') {
      await pool.query(
        `UPDATE chat_sessions
         SET state = $1, temp_data = '{}'::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE phone = $2 AND shop_id = $3`,
        [STATES.CANCELLED, phone, shop_id]
      );
      await trackEvent(shop_id, 'order_cancelled', { phone, stage: 'address' });
      return safeReply(phone, "Order cancel ho gaya. Type 'menu' to start again.", shop_id);
    }
    return handleAddress(shop_id, phone, text, intent);
  }

  // ── STATE: AWAITING_PAYMENT ────────────────
  if (state === STATES.AWAITING_PAYMENT) {
    if (intent === 'CANCEL') {
      await pool.query(
        `UPDATE chat_sessions
         SET state = $1, temp_data = '{}'::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE phone = $2 AND shop_id = $3`,
        [STATES.CANCELLED, phone, shop_id]
      );
      await trackEvent(shop_id, 'order_cancelled', { phone, stage: 'payment' });
      return safeReply(phone, "Order cancel ho gaya. Type 'menu' to start again.", shop_id);
    }
    return handlePayment(shop_id, phone, text, temp_data, message_id);
  }

  // ── CANCEL ─────────────────────────────────
  if (intent === 'CANCEL') {
    try {
      const next = state === STATES.AWAITING_CONFIRM ? updateState(state, STATES.CANCELLED) : STATES.NEW;
      await pool.query(
        `UPDATE chat_sessions SET state = $1, temp_data = '{}'::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE phone = $2 AND shop_id = $3`,
        [next, phone, shop_id]
      );
      await trackEvent(shop_id, 'order_cancelled', { phone });
      return safeReply(phone, "❌ Cancel ho gaya. Type 'menu' to start again.", shop_id);
    } catch (err) {
      await logError(shop_id, err, { where: 'cancel', phone, state });
      return hardFailReply(phone, shop_id);
    }
  }

  // ── CONFIRM ────────────────────────────────
  if (intent === 'CONFIRM') {
    return confirmOrder(shop_id, phone, message_id);
  }

  // ── ORDERING ───────────────────────────────
  if (intent === 'ORDER' && (state === STATES.NEW || state === STATES.SHOWING_MENU || state === STATES.ORDERING)) {
    // Multi-match resolution: digit reply to previous multi-match
    if (temp_data?.multi_match?.options && /^\d+$/.test(normalized)) {
      const idx = Number(normalized) - 1;
      const options = temp_data.multi_match.options || [];
      const qty = Number(temp_data.multi_match.qty || 1);
      const picked = options[idx];

      if (!picked) return safeReply(phone, 'Valid number reply karo list se.', shop_id);

      const pRes = await pool.query(
        `SELECT id, name, price, stock_quantity, is_available FROM products
         WHERE shop_id = $1 AND id = $2 AND is_deleted = false AND is_available = true LIMIT 1`,
        [shop_id, picked.id]
      );
      if (!pRes.rows.length) return safeReply(phone, 'Item nahi mila. Type menu.', shop_id);

      const p = pRes.rows[0];
      if (p.stock_quantity !== null && Number(p.stock_quantity) < qty) {
        return safeReply(phone, `❌ "${p.name}" ka stock khatam hai.`, shop_id);
      }

      const unit_price = Number(p.price);
      const total = Number((unit_price * qty).toFixed(2));

      await pool.query(
        `UPDATE chat_sessions
         SET state = 'AWAITING_CONFIRM',
             temp_data = COALESCE(temp_data, '{}'::jsonb) || $1::jsonb,
             updated_at = CURRENT_TIMESTAMP
         WHERE phone = $2 AND shop_id = $3`,
        [JSON.stringify({ product_id: p.id, qty, unit_price, total, product_name: p.name, multi_match: null }), phone, shop_id]
      );

      return safeReply(
        phone,
        `🛒 *Order Summary*\n\n📦 ${qty}x ${p.name}\n💰 Total: Rs ${total}\n\nConfirm? Reply: *yes* / *haan*\nCancel: *cancel*`,
        shop_id
      );
    }

    // Transition to ORDERING
    try {
      const next = updateState(state, STATES.ORDERING);
      await pool.query(
        `UPDATE chat_sessions SET state = $1, updated_at = CURRENT_TIMESTAMP
         WHERE phone = $2 AND shop_id = $3`,
        [next, phone, shop_id]
      );
    } catch (err) {
      await logError(shop_id, err, { where: 'ordering-transition', phone, state });
    }

    if (message_id) {
      try {
        await pool.query(
          `UPDATE chat_sessions SET temp_data = COALESCE(temp_data, '{}'::jsonb) || $1::jsonb
           WHERE phone = $2 AND shop_id = $3`,
          [JSON.stringify({ message_id }), phone, shop_id]
        );
      } catch { /* ignore */ }
    }

    await handleOrderInput(shop_id, phone, normalized);

    // Sync state to AWAITING_CONFIRM if product was resolved
    try {
      const latest = await pool.query(
        `SELECT state, temp_data FROM chat_sessions WHERE phone = $1 AND shop_id = $2 LIMIT 1`,
        [phone, shop_id]
      );
      const latestTemp = latest.rows[0]?.temp_data || {};
      const latestState = latest.rows[0]?.state || STATES.ORDERING;
      if (latestTemp?.product_id && latestState !== STATES.AWAITING_CONFIRM) {
        await pool.query(
          `UPDATE chat_sessions SET state = 'AWAITING_CONFIRM', updated_at = CURRENT_TIMESTAMP
           WHERE phone = $1 AND shop_id = $2`,
          [phone, shop_id]
        );
      }
    } catch { /* ignore */ }

    return;
  }

  // ── FALLBACK ───────────────────────────────
  await logEvent(shop_id, 'FALLBACK_MESSAGE', 'Unknown intent', { phone, text: normalized, state, intent });
  return safeReply(
    phone,
    "🤔 Samajh nahi aaya. 'menu' type karo items dekhne ke liye ya 'help' for options.",
    shop_id
  );
}

module.exports = {
  handleMessage,
  logEvent,
  logError,
  normalizeText,
  isValidMessage,
  detectIntent,
  parseOrder,
  sendMessage,
  safeReply,
  sendHelp,
  trackEvent,
  STATES,
};
