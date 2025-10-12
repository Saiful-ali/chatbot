const express = require("express");
const { pool } = require("../db");
const { translateText } = require("../utils/translate");
const { detectLanguage } = require("../utils/detectLang"); // 🧠 new
const router = express.Router();

/**
 * POST /api/chat
 * body: { message: string, lang?: 'auto'|'en'|'hi'|'or' }
 */
router.post("/", async (req, res) => {
  try {
    let { message, lang = "auto" } = req.body || {};

    if (!message) return res.status(400).json({ error: "Message is required" });
    message = message.trim();
    console.log(`🧠 [Chatbot Query] "${message}" (${lang})`);

    // Step 1️⃣ — Detect language automatically if set to "auto"
    if (lang === "auto" || !lang) {
      lang = detectLanguage(message);
      console.log(`🌍 Auto-detected language: ${lang}`);
    }
    lang = lang.slice(0, 2).toLowerCase(); // Normalize (e.g., "hi-IN" → "hi")

    // Step 2️⃣ — Translate user input to English for DB search
    const englishInput = lang !== "en" ? await translateText(message, "en") : message;
    const cleaned = englishInput.toLowerCase();

    // Step 3️⃣ — Search FAQs first
    const faqResult = await pool.query(
      `
      SELECT answer, question, similarity(question, $1) AS score
      FROM faqs
      WHERE tsv @@ plainto_tsquery('english', unaccent($1))
         OR question % $1
         OR answer % $1
      ORDER BY score DESC
      LIMIT 1;
      `,
      [cleaned]
    );

    let reply = null;

    if (faqResult.rows.length > 0) {
      reply = faqResult.rows[0].answer;
    } else {
      // Step 4️⃣ — Search health_entries
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
        reply = entries.rows[0].content;
      } else {
        // Step 5️⃣ — Search active alerts
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
          reply = `🚨 ${alerts.rows[0].title}: ${alerts.rows[0].description}`;
        }
      }
    }

    // Step 6️⃣ — Default fallback
    if (!reply) {
      reply =
        "Sorry, I couldn’t find information about that topic. Please try another query.";
    }

    // Step 7️⃣ — Translate the reply back to user’s language
    const translatedReply =
      lang !== "en" ? await translateText(reply, lang) : reply;

    // Step 8️⃣ — Send response
    res.json({
      reply: translatedReply,
      original: reply,
      langDetected: lang,
    });
  } catch (err) {
    console.error("❌ Chat error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
