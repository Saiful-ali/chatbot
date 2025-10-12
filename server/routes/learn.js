const express = require("express");
const { pool } = require("../db");
const { translateFields, detectLanguage } = require("../utils/translate");
const router = express.Router();

/**
 * GET /api/learn/categories?lang=en|hi|or|auto
 * Returns translated health categories.
 */
router.get("/categories", async (req, res) => {
  try {
    let userLang = req.query.lang || "en";

    // 🌍 Auto-detect language from headers if "auto"
    if (userLang === "auto") {
      const headerLang = req.headers["accept-language"] || "";
      const guess = headerLang.slice(0, 2).toLowerCase();
      userLang = ["hi", "or", "en"].includes(guess)
        ? guess
        : await detectLanguage("health");
      console.log(`🌍 Auto-detected learn category language: ${userLang}`);
    }

    // 🧠 Fetch categories
    const { rows } = await pool.query(
      `SELECT id, name, type, description FROM health_categories ORDER BY name`
    );

    let categories = rows;

    // 🈶 Translate fields if needed
    if (userLang !== "en") {
      console.log(`🔤 Translating ${rows.length} categories to [${userLang}]...`);
      categories = await Promise.all(
        rows.map((r) => translateFields(r, ["name", "description"], userLang))
      );
    }

    res.json(categories);
  } catch (err) {
    console.error("❌ learn categories error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/learn/entries?categoryId=1&lang=en|hi|or|auto
 * Returns translated health learning entries.
 */
router.get("/entries", async (req, res) => {
  try {
    let userLang = req.query.lang || "en";
    const { categoryId } = req.query;

    // 🌍 Auto-detect language if requested
    if (userLang === "auto") {
      const headerLang = req.headers["accept-language"] || "";
      const guess = headerLang.slice(0, 2).toLowerCase();
      userLang = ["hi", "or", "en"].includes(guess)
        ? guess
        : await detectLanguage("disease");
      console.log(`🌍 Auto-detected learn entries language: ${userLang}`);
    }

    // 🧠 Build SQL query
    const params = [];
    let sql = `
      SELECT he.id, he.title, he.content, he.risk_level, hc.name AS category
      FROM health_entries he
      JOIN health_categories hc ON hc.id = he.category_id
    `;
    if (categoryId) {
      sql += " WHERE he.category_id = $1";
      params.push(categoryId);
    }
    sql += " ORDER BY he.title;";

    const { rows } = await pool.query(sql, params);
    let entries = rows;

    // 🈶 Translate fields if needed
    if (userLang !== "en") {
      console.log(`🔤 Translating ${rows.length} entries to [${userLang}]...`);
      entries = await Promise.all(
        rows.map((e) =>
          translateFields(e, ["title", "content", "category"], userLang)
        )
      );
    }

    res.json(entries);
  } catch (err) {
    console.error("❌ learn entries error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
