const express = require("express");
const { pool } = require("../db");
const natural = require("natural");
const tokenizer = new natural.WordTokenizer();
const router = express.Router();

async function searchFaq(message, lang) {
  const res = await pool.query(
    `SELECT answer FROM faqs
     WHERE (language = $2 OR $2 IS NULL)
       AND (LOWER(question) LIKE LOWER($1) OR LOWER(answer) LIKE LOWER($1))
     LIMIT 1`,
    [`%${message}%`, lang || null]
  );
  if (res.rows.length) return res.rows[0].answer;

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
}

router.post("/", async (req, res) => {
  try {
    const from = req.body.From || "";
    const body = (req.body.Body || "").trim();
    const lang = "en"; // you can map by user phone later

    const answer = (await searchFaq(body, lang)) || "Sorry, I don’t have an answer for that yet.";

    // TwiML response
    res.set("Content-Type", "text/xml");
    res.send(`
      <Response>
        <Message>${answer}</Message>
      </Response>
    `.trim());
  } catch (err) {
    console.error("twilio webhook error:", err);
    res.set("Content-Type", "text/xml");
    res.send(`<Response><Message>Server error</Message></Response>`);
  }
});

module.exports = router;
