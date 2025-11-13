// ========================================
// routes/admin.js
// ========================================
const express = require("express");
const { pool } = require("../db");
const { sendWhatsAppMessage, sendWhatsAppAudio } = require("../services/whatsappService");
const { translateText } = require("../utils/translate");
const gTTS = require("gtts");
const fs = require("fs");
const path = require("path");
const router = express.Router();

function verifyAdmin(req, res, next) {
  const key = req.headers["x-admin-key"];
  if (key !== process.env.ADMIN_KEY) return res.status(403).json({ error: "Unauthorized" });
  next();
}

async function generateVoice(text, langCode) {
  return new Promise((resolve, reject) => {
    const file = path.join(__dirname, `../tmp/update_${Date.now()}.mp3`);
    const gtts = new gTTS(text, langCode);
    gtts.save(file, (err) => (err ? reject(err) : resolve(file)));
  });
}

router.post("/add-update", verifyAdmin, async (req, res) => {
  try {
    const { title, description, priority = "medium" } = req.body;
    if (!title || !description) return res.status(400).json({ error: "Title and description required" });

    const result = await pool.query(
      `INSERT INTO gov_updates (title, description, priority, lang, created_at) VALUES ($1, $2, $3, 'en', NOW()) RETURNING *`,
      [title, description, priority]
    );
    const newUpdate = result.rows[0];

    const subs = await pool.query(`SELECT phone_number, preferred_lang FROM user_subscriptions WHERE is_active = true AND channel = 'whatsapp'`);

    if (subs.rowCount === 0) {
      return res.json({ success: true, message: "No subscribers", update: newUpdate });
    }

    const baseMessage = `🩺 *${newUpdate.title}*\n\n${newUpdate.description}\n\nPriority: ${newUpdate.priority.toUpperCase()}`;

    let successCount = 0;
    for (const user of subs.rows) {
      try {
        const userLang = user.preferred_lang || "en";
        let message = baseMessage;
        if (userLang !== "en") message = await translateText(baseMessage, userLang);

        const sent = await sendWhatsAppMessage(user.phone_number, message);
        if (!sent) continue;

        if (process.env.SEND_VOICE === "true") {
          const langCode = userLang === "hi" ? "hi" : userLang === "or" ? "or" : "en";
          const mp3Path = await generateVoice(message, langCode);
          await sendWhatsAppAudio(user.phone_number, mp3Path);
          setTimeout(() => fs.existsSync(mp3Path) && fs.unlinkSync(mp3Path), 10000);
        }

        successCount++;
      } catch (err) {
        console.warn(`❌ Failed ${user.phone_number}:`, err.message);
      }
    }

    res.json({
      success: true,
      message: `Sent to ${successCount}/${subs.rowCount} subscribers`,
      update: newUpdate,
      stats: { success: successCount, total: subs.rowCount }
    });
  } catch (err) {
    console.error("❌ add-update error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/updates", verifyAdmin, async (_req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM gov_updates ORDER BY created_at DESC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

