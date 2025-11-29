// routes/vaccines.js
const express = require("express");
const { pool } = require("../db");
const { translateFields } = require("../utils/translate");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const userLang = (req.query.lang || "en").slice(0, 2).toLowerCase();
    const result = await pool.query(
      `SELECT he.id, he.title, he.content FROM health_entries he JOIN health_categories hc ON hc.id = he.category_id WHERE hc.type = 'vaccine' ORDER BY he.title`
    );
    let vaccines = result.rows;
    if (userLang !== "en") {
      vaccines = await Promise.all(vaccines.map((v) => translateFields(v, ["title", "content"], userLang)));
    }
    res.json(vaccines);
  } catch (err) {
    console.error("❌ /vaccines error:", err);
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

module.exports = router;
