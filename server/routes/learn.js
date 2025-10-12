const express = require("express");
const { pool } = require("../db");
const router = express.Router();

router.get("/categories", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, type, description FROM health_categories ORDER BY name`
    );
    res.json(rows);
  } catch (err) {
    console.error("learn categories error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/entries", async (req, res) => {
  try {
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
    res.json(rows);
  } catch (err) {
    console.error("learn entries error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
