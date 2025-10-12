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

    // Normalize input for better search
    const cleaned = message.trim().toLowerCase();

    // Try full-text + fuzzy + fallback matches
    const query = `
      SELECT answer, question,
        similarity(question, $1) AS score
      FROM faqs
      WHERE (language = $2 OR $2 IS NULL)
        AND (
          tsv @@ plainto_tsquery('english', unaccent($1))
          OR question % $1
          OR answer % $1
        )
      ORDER BY score DESC
      LIMIT 1;
    `;

    const result = await pool.query(query, [cleaned, lang]);

    if (result.rows.length > 0) {
      const { answer, question } = result.rows[0];
      return res.json({ reply: answer, matched_question: question });
    }

    // Fallback to health_entries if FAQ not found
    const entries = await pool.query(
      `
      SELECT title, content
      FROM health_entries
      WHERE tsv @@ plainto_tsquery('english', unaccent($1))
         OR title % $1
         OR content % $1
      ORDER BY similarity(title, $1) DESC
      LIMIT 1;
      `,
      [cleaned]
    );

    if (entries.rows.length > 0) {
      return res.json({ reply: entries.rows[0].content, matched_title: entries.rows[0].title });
    }

    // Fallback 2: alerts
    const alerts = await pool.query(
      `
      SELECT title, description
      FROM health_alerts
      WHERE is_active = true
        AND (
          tsv @@ plainto_tsquery('english', unaccent($1))
          OR title % $1
          OR description % $1
        )
      LIMIT 1;
      `,
      [cleaned]
    );

    if (alerts.rows.length > 0) {
      return res.json({
        reply: `🚨 ${alerts.rows[0].title}: ${alerts.rows[0].description}`,
      });
    }

    // No match found
    return res.json({
      reply: "Sorry, I couldn’t find information about that topic. Please try another query.",
    });

  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
