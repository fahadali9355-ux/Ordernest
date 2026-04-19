require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema='public'
    `);
    console.log("Tables:", res.rows.map(r => r.table_name));
    
    // Check if whatsapp_numbers has exactly what we expect
    const res2 = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'whatsapp_numbers'
    `);
    console.log("whatsapp_numbers schema:", res2.rows);
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
check();
