// ========================================
// routes/learn.js
// ========================================
const express = require("express");
const { pool } = require("../db");
const { translateFields } = require("../utils/translate");
const router = express.Router();

router.get("/categories", async (req, res) => {
  try {
    let userLang = req.query.lang || "en";
    const { rows } = await pool.query(`SELECT id, name, type, description FROM health_categories`);
    let categories = rows;
    if (userLang !== "en") {
      categories = await Promise.all(rows.map((r) => translateFields(r, ["name", "description"], userLang)));
    }
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/entries", async (req, res) => {
  try {
    let userLang = req.query.lang || "en";
    const { categoryId } = req.query;
    let sql = `SELECT he.id, he.title, he.content, he.risk_level, hc.name AS category FROM health_entries he JOIN health_categories hc ON hc.id = he.category_id`;
    const params = [];
    if (categoryId) {
      sql += " WHERE he.category_id = $1";
      params.push(categoryId);
    }
    const { rows } = await pool.query(sql, params);
    let entries = rows;
    if (userLang !== "en") {
      entries = await Promise.all(rows.map((e) => translateFields(e, ["title", "content", "category"], userLang)));
    }
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

