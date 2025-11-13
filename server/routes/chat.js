// ========================================
// routes/chat.js
// ========================================
const express = require("express");
const { pool } = require("../db");
const { translateText, detectLanguage } = require("../utils/translate");
const router = express.Router();

router.post("/", async (req, res) => {
  try {
    let { message, lang = "auto" } = req.body || {};
    if (!message) return res.status(400).json({ error: "Message required" });

    if (lang === "auto" || !lang) lang = await detectLanguage(message);
    const englishInput = lang !== "en" ? await translateText(message, "en") : message;
    const cleaned = englishInput.toLowerCase();

    const faqResult = await pool.query(
      `SELECT answer FROM faqs WHERE tsv @@ plainto_tsquery('english', $1) OR question % $1 ORDER BY similarity(question, $1) DESC LIMIT 1`,
      [cleaned]
    );

    let reply = null;
    if (faqResult.rows.length > 0) {
      reply = faqResult.rows[0].answer;
    } else {
      const entries = await pool.query(
        `SELECT content FROM health_entries WHERE tsv @@ plainto_tsquery('english', $1) OR title % $1 LIMIT 1`,
        [cleaned]
      );
      if (entries.rows.length > 0) reply = entries.rows[0].content;
    }

    if (!reply) reply = "Sorry, I couldn't find information about that.";

    const translatedReply = lang !== "en" ? await translateText(reply, lang) : reply;

    res.json({ reply: translatedReply, langDetected: lang });
  } catch (err) {
    console.error("❌ chat error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

