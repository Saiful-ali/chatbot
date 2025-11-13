// ========================================
// routes/alerts.js
// ========================================
const express = require("express");
const { pool } = require("../db");
const { translateFields } = require("../utils/translate");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    let userLang = req.query.lang || "en";
    const result = await pool.query(
      `SELECT id, title, description, alert_type, priority FROM health_alerts WHERE is_active = true AND (expires_at IS NULL OR expires_at >= NOW()) ORDER BY priority DESC`
    );

    let alerts = result.rows;
    if (userLang !== "en") {
      alerts = await Promise.all(alerts.map((a) => translateFields(a, ["title", "description"], userLang)));
    }

    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
