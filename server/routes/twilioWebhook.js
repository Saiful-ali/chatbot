const express = require("express");
const { pool } = require("../db");
const natural = require("natural");
const { translateText } = require("../utils/translate");
const { detectLanguage } = require("../utils/detectLang"); // 🧠 NEW: auto language detection
const gTTS = require("gtts");
const fs = require("fs");
const path = require("path");
const router = express.Router();

// Ensure tmp folder exists
const tmpDir = path.join(__dirname, "../tmp");
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

const tokenizer = new natural.WordTokenizer();

// --- Find answer in FAQs ---
async function searchFaq(message) {
  try {
    const res = await pool.query(
      `SELECT answer FROM faqs
       WHERE LOWER(question) LIKE LOWER($1)
          OR LOWER(answer) LIKE LOWER($1)
       LIMIT 1`,
      [`%${message}%`]
    );
    if (res.rows.length) return res.rows[0].answer;

    const tokens = tokenizer.tokenize(message.toLowerCase()).filter(Boolean);
    if (!tokens.length) return null;

    const orLike = tokens.map((_, i) => `LOWER(question) LIKE LOWER($${i + 1})`).join(" OR ");
    const res2 = await pool.query(
      `SELECT answer FROM faqs WHERE ${orLike} LIMIT 1`,
      tokens.map(t => `%${t}%`)
    );
    return res2.rows.length ? res2.rows[0].answer : null;
  } catch (err) {
    console.error("❌ Database error in searchFaq:", err);
    return null;
  }
}

// --- Generate TTS file ---
async function generateVoice(text, langCode) {
  return new Promise((resolve, reject) => {
    const file = path.join(tmpDir, `reply_${Date.now()}.mp3`);
    try {
      const gtts = new gTTS(text, langCode);
      gtts.save(file, (err) => {
        if (err) return reject(err);
        console.log(`🔊 Voice generated: ${file}`);
        resolve(file);
      });
    } catch (err) {
      reject(err);
    }
  });
}

// --- WhatsApp Webhook ---
router.post("/", async (req, res) => {
  try {
    const from = req.body.From || "";
    const body = (req.body.Body || "").trim();
    const phone = from.replace("whatsapp:", "");

    console.log(`📩 WhatsApp message from ${from}: "${body}"`);

    // Step 1️⃣ Get or auto-detect user language
    let lang = "en";
    try {
      const langRes = await pool.query(
        `SELECT preferred_lang FROM user_subscriptions WHERE phone_number = $1 LIMIT 1`,
        [phone]
      );

      if (langRes.rows.length) {
        lang = langRes.rows[0].preferred_lang || "en";
      } else {
        lang = detectLanguage(body);
        console.log(`🌍 Auto-detected language for ${phone}: ${lang}`);

        // Save this language for future use
        await pool.query(
          `INSERT INTO user_subscriptions (phone_number, preferred_lang, channel, is_active)
           VALUES ($1, $2, 'whatsapp', true)
           ON CONFLICT (phone_number) DO UPDATE SET preferred_lang = EXCLUDED.preferred_lang`,
          [phone, lang]
        );
      }
    } catch (e) {
      console.warn("⚠️ Could not fetch or detect user language:", e.message);
    }

    // Step 2️⃣ Translate user message to English for DB search
    const queryText = lang !== "en" ? await translateText(body, "en") : body;

    // Step 3️⃣ Find answer
    let answer =
      (await searchFaq(queryText)) ||
      "Sorry, I don’t have an answer for that yet. Please contact your local health office.";

    // Step 4️⃣ Translate answer back to user's language
    if (lang !== "en") {
      answer = await translateText(answer, lang);
    }

    console.log(`✅ Replied to ${from} in [${lang}]: ${answer}`);

    // Step 5️⃣ Prepare TwiML
    let responseXml = `
      <Response>
        <Message>${answer}</Message>
      </Response>
    `;

    // Step 6️⃣ Generate audio reply if enabled
    if (process.env.SEND_VOICE === "true") {
      try {
        const langCode = ["hi", "or"].includes(lang) ? lang : "en";
        const mp3Path = await generateVoice(answer, langCode);
        const fileUrl = `${process.env.SERVER_PUBLIC_URL}/static/${path.basename(mp3Path)}`;
        responseXml = `
          <Response>
            <Message>
              <Body>${answer}</Body>
              <Media>${fileUrl}</Media>
            </Message>
          </Response>
        `;
      } catch (err) {
        console.warn("🎧 Voice generation failed:", err.message);
      }
    }

    res.set("Content-Type", "text/xml");
    res.send(responseXml.trim());
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.set("Content-Type", "text/xml");
    res.send(`<Response><Message>Server error. Please try again.</Message></Response>`);
  }
});

module.exports = router;
