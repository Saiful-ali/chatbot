const express = require("express");
const { pool } = require("../db");
const router = express.Router();

/**
 * GET /api/vaccines?lang=en
 * Note: current schema stores title/content in plain text; translations JSONB exists but is optional.
 * We ignore translations for now; you can expand later to read from *_translations by lang.
 */
router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT he.title, he.content, he.risk_level
      FROM health_entries he
      JOIN health_categories hc ON hc.id = he.category_id
      WHERE hc.type = 'vaccine'
      ORDER BY he.title
      `
    );
    res.json(result.rows);
  } catch (err) {
    console.error("vaccines error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
