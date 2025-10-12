const express = require("express");
const { pool } = require("../db");
const router = express.Router();

/**
 * GET /api/vaccines?lang=en
 */
router.get("/", async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const result = await pool.query(
      `SELECT disease, vaccine, age_group, schedule, COALESCE(notes,'') AS notes
       FROM vaccines
       WHERE lang = $1
       ORDER BY disease, age_group`,
      [lang]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
