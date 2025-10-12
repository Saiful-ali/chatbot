// routes/twilioWebhook.js
const express = require("express");
const { pool } = require("../db");
const natural = require("natural");
const router = express.Router();

const tokenizer = new natural.WordTokenizer();

// 🧠 Function to find answer from FAQ table
async function searchFaq(message, lang) {
  try {
    // First, try direct match
    const res = await pool.query(
      `SELECT answer FROM faqs
       WHERE (language = $2 OR $2 IS NULL)
         AND (LOWER(question) LIKE LOWER($1) OR LOWER(answer) LIKE LOWER($1))
       LIMIT 1`,
      [`%${message}%`, lang || null]
    );

    if (res.rows.length) return res.rows[0].answer;

    // If not found, try fuzzy search on individual words
    const tokens = tokenizer.tokenize(message.toLowerCase()).filter(Boolean);
    if (!tokens.length) return null;

    const orLike = tokens.map((_, i) => `LOWER(question) LIKE LOWER($${i + 2})`).join(" OR ");
    const res2 = await pool.query(
      `SELECT answer FROM faqs
       WHERE (language = $1 OR $1 IS NULL)
         AND (${orLike})
       LIMIT 1`,
      [lang || null, ...tokens.map(t => `%${t}%`)]
    );

    return res2.rows.length ? res2.rows[0].answer : null;
  } catch (err) {
    console.error("❌ Database error in searchFaq:", err);
    return null;
  }
}

// 📩 Twilio webhook route
router.post("/", async (req, res) => {
  try {
    const from = req.body.From || "";
    const body = (req.body.Body || "").trim();
    const lang = "en"; // later can detect from DB or user preference

    console.log(`📩 WhatsApp message from ${from}: "${body}"`);

    const answer =
      (await searchFaq(body, lang)) ||
      "Sorry, I don’t have an answer for that yet. Please contact your local health office.";

    // ✅ Respond in TwiML (Twilio-compatible XML)
    res.set("Content-Type", "text/xml");
    res.send(`
      <Response>
        <Message>${answer}</Message>
      </Response>
    `.trim());

    console.log(`✅ Replied to ${from}: ${answer}`);
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.set("Content-Type", "text/xml");
    res.send(`<Response><Message>Server error. Please try again.</Message></Response>`);
  }
});

module.exports = router;
