// routes/alerts.js
const express = require("express");
const { pool } = require("../db");
const { translateFields } = require("../utils/translate"); // translateFields(obj, [keys], toLang)
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const userLang = (req.query.lang || "en").slice(0, 2).toLowerCase();
    const q = (req.query.q || "").trim();

    // Base SQL: active and not expired
    let sql = `
      SELECT id, title, description, alert_type, priority, expires_at, is_active, created_at
      FROM health_alerts
      WHERE is_active = true AND (expires_at IS NULL OR expires_at >= NOW())
    `;
    const params = [];

    // Optional search query (safe full-text / ILIKE fallback)
    if (q) {
      params.push(q);
      sql += ` AND (tsv @@ plainto_tsquery('english', $1) OR title ILIKE '%' || $1 || '%' OR description ILIKE '%' || $1 || '%')`;
    }

    sql += ` ORDER BY priority DESC, created_at DESC LIMIT 100`;

    const result = await pool.query(sql, params);
    let alerts = result.rows || [];

    alerts = alerts.map((alert) => ({
      id: alert.id,
      title: alert.title,
      description: alert.description,
      type: alert.alert_type,
      priority: alert.priority,
      expiresAt: alert.expires_at ? new Date(alert.expires_at).toISOString() : null,
      isActive: !!alert.is_active,
      createdAt: alert.created_at ? new Date(alert.created_at).toISOString() : null
    }));

    if (userLang !== "en" && alerts.length) {
      alerts = await Promise.all(alerts.map((a) => translateFields(a, ["title", "description"], userLang)));
    }

    res.json(alerts);
  } catch (err) {
    console.error("❌ /api/alerts error:", err);
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

module.exports = router;
