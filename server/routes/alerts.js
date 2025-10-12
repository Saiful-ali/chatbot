const express = require("express");
const { pool } = require("../db");
const { translateFields, detectLanguage } = require("../utils/translate"); // ✅ full translation helpers
const router = express.Router();

/**
 * GET /api/alerts?lang=en|hi|or|auto
 * Returns active alerts, translated into user's chosen or detected language.
 */
router.get("/", async (req, res) => {
  try {
    let userLang = req.query.lang || "en";

    // 🌍 Auto-detect language from Accept-Language header (if requested)
    if (userLang === "auto") {
      const headerLang = req.headers["accept-language"] || "";
      const guess = headerLang.slice(0, 2).toLowerCase();
      userLang = ["hi", "or", "en"].includes(guess)
        ? guess
        : await detectLanguage(req.query.q || "health");
      console.log(`🌍 Auto-detected alert language: ${userLang}`);
    }

    // 🧠 Fetch active alerts
    const result = await pool.query(
      `
      SELECT id, title, description, alert_type, priority, is_active, expires_at, created_at
      FROM health_alerts
      WHERE is_active = true
        AND (expires_at IS NULL OR expires_at >= NOW())
      ORDER BY priority DESC, created_at DESC;
      `
    );

    let alerts = result.rows;

    // 🈶 Translate alerts if needed
    if (userLang !== "en") {
      console.log(`🔤 Translating ${alerts.length} alerts to [${userLang}]...`);
      alerts = await Promise.all(
        alerts.map((a) => translateFields(a, ["title", "description"], userLang))
      );
    }

    res.json(alerts);
  } catch (err) {
    console.error("❌ alerts error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
