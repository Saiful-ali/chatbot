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

    // Search in faqs by language + question match
    const q = await pool.query(
      `
      SELECT answer
      FROM faqs
      WHERE (language = $2 OR $2 IS NULL)
        AND (LOWER(question) LIKE LOWER($1))
      LIMIT 1
      `,
      [`%${message}%`, lang || null]
    );

    if (q.rows.length) {
      return res.json({ reply: q.rows[0].answer });
    }

    // Fallback: search in answer text too (broader)
    const q2 = await pool.query(
      `
      SELECT answer
      FROM faqs
      WHERE (language = $2 OR $2 IS NULL)
        AND (LOWER(question) LIKE LOWER($1) OR LOWER(answer) LIKE LOWER($1))
      LIMIT 1
      `,
      [`%${message}%`, lang || null]
    );

    if (q2.rows.length) {
      return res.json({ reply: q2.rows[0].answer });
    }

    return res.json({ reply: "Sorry, I don’t have an answer for that yet." });
  } catch (err) {
    console.error("chat error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
