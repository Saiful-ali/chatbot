const express = require("express");
const { pool } = require("../db");
const natural = require("natural");
const { translateText, detectLanguage } = require("../utils/translate"); // unified translate utils
const gTTS = require("gtts");
const fs = require("fs");
const path = require("path");
const router = express.Router();

// Ensure tmp folder exists
const tmpDir = path.join(__dirname, "../tmp");
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

const tokenizer = new natural.WordTokenizer();

// 🧠 Find answer from FAQs
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
      tokens.map((t) => `%${t}%`)
    );

    return res2.rows.length ? res2.rows[0].answer : null;
  } catch (err) {
    console.error("❌ Database error in searchFaq:", err);
    return null;
  }
}

// 🎧 Generate TTS audio file
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

// 💬 WhatsApp Webhook
router.post("/", async (req, res) => {
  try {
    const from = req.body.From || "";
    const body = (req.body.Body || "").trim();
    const phone = from.replace("whatsapp:", "");

    console.log(`📩 WhatsApp message from ${phone}: "${body}"`);

    // Step 1️⃣ — Get or auto-detect user language
    let lang = "en";
    try {
      const user = await pool.query(
        `SELECT preferred_lang FROM user_subscriptions WHERE phone_number = $1 LIMIT 1`,
        [phone]
      );

      if (user.rows.length) {
        lang = user.rows[0].preferred_lang || "en";
      } else {
        lang = await detectLanguage(body);
        console.log(`🌍 Auto-detected language for ${phone}: ${lang}`);

        // Save language preference for next time
        await pool.query(
          `INSERT INTO user_subscriptions (phone_number, preferred_lang, channel, is_active)
           VALUES ($1, $2, 'whatsapp', true)
           ON CONFLICT (phone_number)
           DO UPDATE SET preferred_lang = EXCLUDED.preferred_lang`,
          [phone, lang]
        );
      }
    } catch (err) {
      console.warn("⚠️ Could not fetch or detect user language:", err.message);
    }

    // Step 2️⃣ — Translate user input to English for searching
    const queryText = lang !== "en" ? await translateText(body, "en") : body;

    // Step 3️⃣ — Search for answer
    let answer =
      (await searchFaq(queryText)) ||
      "Sorry, I don’t have an answer for that yet. Please contact your local health office.";

    // Step 4️⃣ — Translate answer back to user’s language
    if (lang !== "en") {
      answer = await translateText(answer, lang);
    }

    console.log(`✅ Replied to ${phone} in [${lang}]: ${answer}`);

    // Step 5️⃣ — Generate TTS link (optional playback)
    let audioUrl = null;
    if (process.env.SEND_VOICE === "true") {
      try {
        const langCode = ["hi", "or"].includes(lang) ? lang : "en";
        const mp3Path = await generateVoice(answer, langCode);
        audioUrl = `${process.env.SERVER_PUBLIC_URL}/static/${path.basename(mp3Path)}`;
      } catch (err) {
        console.warn("🎧 Voice generation failed:", err.message);
      }
    }

    // Step 6️⃣ — Build WhatsApp XML reply (with clickable “Play Audio” link)
    const playMsg = audioUrl ? `🎵 *Play Audio:* ${audioUrl}` : "";
    const finalReply = `${answer}\n\n${playMsg}`.trim();

    res.set("Content-Type", "text/xml");
    res.send(`
      <Response>
        <Message>${finalReply}</Message>
      </Response>
    `.trim());
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.set("Content-Type", "text/xml");
    res.send(`<Response><Message>Server error. Please try again.</Message></Response>`);
  }
});

module.exports = router;
