const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

async function test() {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    console.log("✅ PostgreSQL connected");
  } finally {
    client.release();
  }
}

module.exports = { pool, test };
