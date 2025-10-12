const express = require("express");
const { pool } = require("../db");
const { translateText } = require("../utils/translate"); // ✅ helper for auto translation
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const userLang = req.query.lang || "en"; // Default to English if not provided

    const result = await pool.query(
      `SELECT title, description, alert_type, priority, is_active, expires_at, created_at
       FROM health_alerts
       WHERE is_active = true AND (expires_at IS NULL OR expires_at >= NOW())
       ORDER BY priority DESC, created_at DESC`
    );

    // Translate only if user requested a non-English language
    let alerts = result.rows;
    if (userLang !== "en") {
      alerts = await Promise.all(
        alerts.map(async (a) => ({
          ...a,
          title: await translateText(a.title, userLang),
          description: await translateText(a.description, userLang),
        }))
      );
    }

    res.json(alerts);
  } catch (err) {
    console.error("alerts error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
