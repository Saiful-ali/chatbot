const express = require("express");
const { pool } = require("../db");
const router = express.Router();

/**
 * GET /api/alerts
 */
router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT disease, district, severity, message, starts_at, ends_at, source
       FROM alerts
       WHERE (starts_at IS NULL OR starts_at <= NOW())
         AND (ends_at IS NULL OR ends_at >= NOW())
       ORDER BY severity DESC, starts_at DESC NULLS LAST
       LIMIT 50`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
