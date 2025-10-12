const express = require("express");
const { pool } = require("../db");
const { translateFields, detectLanguage } = require("../utils/translate");
const router = express.Router();

/**
 * GET /api/vaccines?lang=en|hi|or|auto
 * Returns translated vaccine-related health entries.
 */
router.get("/", async (req, res) => {
  try {
    let userLang = req.query.lang || "en";

    // 🌍 Auto-detect language if requested
    if (userLang === "auto") {
      const headerLang = req.headers["accept-language"] || "";
      const guess = headerLang.slice(0, 2).toLowerCase();
      userLang = ["hi", "or", "en"].includes(guess)
        ? guess
        : await detectLanguage("vaccine");
      console.log(`🌍 Auto-detected vaccine language: ${userLang}`);
    }

    // 🧠 Fetch vaccine entries
    const result = await pool.query(
      `
      SELECT he.id, he.title, he.content, he.risk_level
      FROM health_entries he
      JOIN health_categories hc ON hc.id = he.category_id
      WHERE hc.type = 'vaccine'
      ORDER BY he.title;
      `
    );

    let vaccines = result.rows;

    // 🈶 Translate title + content fields if needed
    if (userLang !== "en") {
      console.log(`🔤 Translating ${vaccines.length} vaccines to [${userLang}]...`);
      vaccines = await Promise.all(
        vaccines.map((v) => translateFields(v, ["title", "content"], userLang))
      );
    }

    res.json(vaccines);
  } catch (err) {
    console.error("❌ vaccines error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
