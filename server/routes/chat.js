const express = require("express");
const { pool } = require("../db");
const router = express.Router();

/**
 * POST /api/chat
 * body: { message: string, lang?: 'en'|'hi'|'or' }
 */
router.post("/", async (req, res) => {
  try {
    const { message, lang = "en" } = req.body || {};
    if (!message) return res.status(400).json({ error: "Message is required" });

    // Try full-text search first (if data prepared); else fallback to ILIKE
    const fts = await pool.query(
      `
      SELECT answer, ts_rank_cd(tsv, plainto_tsquery($2, $1)) AS rank
      FROM faq
      WHERE lang = $2 AND tsv @@ plainto_tsquery($2, $1)
      ORDER BY rank DESC
      LIMIT 1
      `,
      [message, lang]
    );

    if (fts.rows.length) {
      return res.json({ reply: fts.rows[0].answer });
    }

    const like = await pool.query(
      `
      SELECT answer
      FROM faq
      WHERE lang = $2 AND (lower(question) LIKE lower($1) OR lower(tags) LIKE lower($1))
      LIMIT 1
      `,
      [`%${message}%`, lang]
    );

    if (like.rows.length) {
      return res.json({ reply: like.rows[0].answer });
    }

    return res.json({ reply: "Sorry, I don’t have an answer for that yet." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
