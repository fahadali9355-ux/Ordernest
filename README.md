# WEEK 1 — DB + Backend Foundation

## Setup

### 1) Create DB + tables (PostgreSQL)

- Create database:

```sql
CREATE DATABASE whatsapp_orders;
```

- Run schema:

```bash
psql -U postgres -d whatsapp_orders -f sql/schema.sql
```

If you already have DB (Week 2+), run migrations:

```bash
psql -U postgres -d whatsapp_orders -f sql/migrations/002_multitenant.sql
psql -U postgres -d whatsapp_orders -f sql/migrations/003_week3_whatsapp_core.sql
psql -U postgres -d whatsapp_orders -f sql/migrations/004_week4_production_hardening.sql
```

### 2) Configure environment

- Copy `.env.example` to `.env.local` and update credentials:

```bash
copy .env.example .env.local
```

Example:

```
PORT=3000
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/whatsapp_orders
JWT_SECRET=change_me_to_a_long_random_string
```

### 3) Run backend

```bash
npm install
npm run dev
```

Server:
- `GET /` → `API Running`

## APIs (Required)

## Auth (Mandatory, SaaS)

### Register
- `POST /auth/register`

Body:
```json
{ "name": "Owner", "email": "owner@example.com", "password": "pass1234" }
```

### Login
- `POST /auth/login`

Body:
```json
{ "email": "owner@example.com", "password": "pass1234" }
```

Response:
```json
{ "token": "JWT_HERE" }
```

Use header on protected routes:
`Authorization: Bearer <token>`

Token payload carries `shop_id` (multi-tenant isolation).

### Add Product
- `POST /products`

Body:
```json
{ "name": "Burger", "price": 350, "stock_quantity": 10 }
```

### Get Products
- `GET /products`

### Create Order
- `POST /orders`

Body:
```json
{
  "customer_name": "Ali",
  "customer_phone": "0300xxxxxxx",
  "address": "Street 1",
  "payment_method": "COD",
  "items": [
    { "product_id": 1, "quantity": 2 }
  ]
}
```

### Get Orders
- `GET /orders`

### Order Details
- `GET /orders/:id`

## Week 3 — WhatsApp Core

### Webhook (Meta entry point)
- `POST /webhook/whatsapp`

Incoming payload example:
```json
{
  "messages": [
    { "from": "923001112233", "text": { "body": "2 burger" } }
  ]
}
```

Requirements:
- Map WhatsApp phone to a shop in DB table `whatsapp_numbers` (`phone_number` -> `shop_id`)

## Week 4 — Meta WhatsApp API Integration

### ENV
Set in `.env.local`:
- `WA_TOKEN`
- `WA_PHONE_ID`
- `WA_VERIFY_TOKEN`

### Webhook verification
Meta dashboard will call:
- `GET /webhook/whatsapp?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`

### Message receiver
- `POST /webhook/whatsapp`

### Shop phone mapping (dev)
- `POST /dev/map-phone` (JWT protected)

Body:
```json
{ "phone": "923001112233" }
```

### Week 4 migrations
If you already ran Week 2/3, also run:
```bash
psql -U postgres -d whatsapp_orders -f sql/migrations/006_week4_orders_message_id_unique.sql
```

