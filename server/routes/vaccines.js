const express = require("express");
const { pool } = require("../db");
const { translateText } = require("../utils/translate"); // ✅ helper for translation
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const userLang = req.query.lang || "en"; // language from query or default English

    const result = await pool.query(
      `SELECT he.title, he.content, he.risk_level
       FROM health_entries he
       JOIN health_categories hc ON hc.id = he.category_id
       WHERE hc.type = 'vaccine'
       ORDER BY he.title`
    );

    let vaccines = result.rows;

    // Only translate if language is not English
    if (userLang !== "en") {
      vaccines = await Promise.all(
        vaccines.map(async (v) => ({
          ...v,
          title: await translateText(v.title, userLang),
          content: await translateText(v.content, userLang),
        }))
      );
    }

    res.json(vaccines);
  } catch (err) {
    console.error("vaccines error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
