// ========================================
// routes/whatsappHandler.js
// ========================================
const express = require("express");
const { pool } = require("../db");
const natural = require("natural");
const { translateText, detectLanguage } = require("../utils/translate");
const gTTS = require("gtts");
const fs = require("fs");
const path = require("path");
const { sendWhatsAppMessage, sendWhatsAppAudio, getStatus } = require("../services/whatsappService");

const router = express.Router();
const tokenizer = new natural.WordTokenizer();
const tmpDir = path.join(__dirname, "../tmp");
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

async function searchFaq(message) {
  try {
    const res = await pool.query(
      `SELECT answer FROM faqs WHERE LOWER(question) LIKE LOWER($1) OR LOWER(answer) LIKE LOWER($1) LIMIT 1`,
      [`%${message}%`]
    );
    if (res.rows.length) return res.rows[0].answer;

    const tokens = tokenizer.tokenize(message.toLowerCase()).filter(Boolean);
    if (!tokens.length) return null;

    const orLike = tokens.map((_, i) => `LOWER(question) LIKE LOWER($${i + 1})`).join(" OR ");
    const res2 = await pool.query(`SELECT answer FROM faqs WHERE ${orLike} LIMIT 1`, tokens.map((t) => `%${t}%`));
    return res2.rows.length ? res2.rows[0].answer : null;
  } catch (err) {
    console.error("❌ searchFaq error:", err);
    return null;
  }
}

async function generateVoice(text, langCode) {
  return new Promise((resolve, reject) => {
    const file = path.join(tmpDir, `reply_${Date.now()}.mp3`);
    const gtts = new gTTS(text, langCode);
    gtts.save(file, (err) => (err ? reject(err) : resolve(file)));
  });
}

async function handleIncomingMessage(message) {
  try {
    const from = message.from;
    const body = message.body.trim();
    const phone = from.replace("@c.us", "");

    console.log(`📩 Message from ${phone}: "${body}"`);

    let lang = "en";
    const user = await pool.query(`SELECT preferred_lang FROM user_subscriptions WHERE phone_number = $1 LIMIT 1`, [phone]);

    if (user.rows.length) {
      lang = user.rows[0].preferred_lang || "en";
    } else {
      lang = await detectLanguage(body);
      await pool.query(
        `INSERT INTO user_subscriptions (phone_number, preferred_lang, channel, is_active) VALUES ($1, $2, 'whatsapp', true) ON CONFLICT (phone_number) DO UPDATE SET preferred_lang = EXCLUDED.preferred_lang`,
        [phone, lang]
      );
    }

    const queryText = lang !== "en" ? await translateText(body, "en") : body;
    let answer = (await searchFaq(queryText)) || "Sorry, I don't have an answer. Contact your local health office.";

    if (lang !== "en") answer = await translateText(answer, lang);

    await sendWhatsAppMessage(phone, answer);

    if (process.env.SEND_VOICE === "true") {
      try {
        const langCode = ["hi", "or"].includes(lang) ? lang : "en";
        const mp3Path = await generateVoice(answer, langCode);
        await sendWhatsAppAudio(phone, mp3Path);
        setTimeout(() => fs.existsSync(mp3Path) && fs.unlinkSync(mp3Path), 5000);
      } catch (err) {
        console.warn("🎧 Voice failed:", err.message);
      }
    }
  } catch (err) {
    console.error("❌ handleIncomingMessage:", err);
  }
}

router.get("/status", (req, res) => res.json(getStatus()));

router.post("/restart", async (req, res) => {
  const { restartWhatsApp } = require("../services/whatsappService");
  const success = await restartWhatsApp();
  res.json({ success });
});

module.exports = { router, handleIncomingMessage };

