const express = require("express");
const { pool } = require("../db");
const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT title, description, alert_type, priority, is_active, expires_at, created_at
       FROM health_alerts
       WHERE is_active = true AND (expires_at IS NULL OR expires_at >= NOW())
       ORDER BY priority DESC, created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("alerts error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
