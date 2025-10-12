const express = require("express");
const { pool } = require("../db");
const { translateText } = require("../utils/translate");
const router = express.Router();

router.get("/categories", async (req, res) => {
  try {
    const userLang = req.query.lang || "en";
    const { rows } = await pool.query(
      `SELECT id, name, type, description FROM health_categories ORDER BY name`
    );

    let categories = rows;
    if (userLang !== "en") {
      categories = await Promise.all(
        rows.map(async (r) => ({
          ...r,
          name: await translateText(r.name, userLang),
          description: await translateText(r.description, userLang),
        }))
      );
    }

    res.json(categories);
  } catch (err) {
    console.error("learn categories error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/entries", async (req, res) => {
  try {
    const userLang = req.query.lang || "en";
    const { categoryId } = req.query;
    const params = [];
    let sql = `SELECT he.id, he.title, he.content, he.risk_level, hc.name as category
               FROM health_entries he
               JOIN health_categories hc ON hc.id = he.category_id`;
    if (categoryId) {
      sql += " WHERE he.category_id = $1";
      params.push(categoryId);
    }
    sql += " ORDER BY he.title";
    const { rows } = await pool.query(sql, params);

    let entries = rows;
    if (userLang !== "en") {
      entries = await Promise.all(
        rows.map(async (e) => ({
          ...e,
          title: await translateText(e.title, userLang),
          content: await translateText(e.content, userLang),
          category: await translateText(e.category, userLang),
        }))
      );
    }

    res.json(entries);
  } catch (err) {
    console.error("learn entries error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
