const express = require("express");
const { pool } = require("../db");
const { sendWhatsApp } = require("../utils/sendWhatsApp");
const { translateText } = require("../utils/translate"); // ✅ import translator
const gTTS = require("gtts"); // ✅ for optional voice replies
const fs = require("fs");
const path = require("path");
const router = express.Router();

// ✅ Middleware to verify admin key
function verifyAdmin(req, res, next) {
  const key = req.headers["x-admin-key"];
  if (key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: "Unauthorized: Invalid admin key." });
  }
  next();
}

// ✅ Function to generate voice file (optional audio broadcast)
async function generateVoice(text, langCode) {
  return new Promise((resolve, reject) => {
    const file = path.join(__dirname, `../tmp/update_${Date.now()}.mp3`);
    try {
      const gtts = new gTTS(text, langCode);
      gtts.save(file, (err) => {
        if (err) return reject(err);
        resolve(file);
      });
    } catch (err) {
      reject(err);
    }
  });
}

// ✅ POST route to add new update and broadcast
router.post("/add-update", verifyAdmin, async (req, res) => {
  try {
    const { title, description, priority = "medium" } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: "Title and description are required." });
    }

    // 1️⃣ Insert new update (always store in English)
    const result = await pool.query(
      `INSERT INTO gov_updates (title, description, priority, lang, created_at)
       VALUES ($1, $2, $3, 'en', NOW())
       RETURNING *;`,
      [title, description, priority]
    );
    const newUpdate = result.rows[0];

    // 2️⃣ Fetch all active WhatsApp subscribers
    const subs = await pool.query(`
      SELECT phone_number, preferred_lang
      FROM user_subscriptions
      WHERE is_active = true AND channel = 'whatsapp';
    `);

    if (subs.rowCount === 0) {
      console.log("⚠️ No active WhatsApp subscribers found.");
      return res.json({ success: true, message: "No subscribers to notify.", update: newUpdate });
    }

    console.log(`📢 Sending update to ${subs.rowCount} WhatsApp users...`);

    // 3️⃣ Prepare English message
    const baseMessage = `🩺 *${newUpdate.title}*\n\n${newUpdate.description}\n\nPriority: ${newUpdate.priority.toUpperCase()}`;

    // 4️⃣ Send translated message to each user
    for (const user of subs.rows) {
      try {
        const userLang = user.preferred_lang || "en";

        // 🌍 Translate if user language isn’t English
        let message = baseMessage;
        if (userLang !== "en") {
          message = await translateText(baseMessage, userLang);
        }

        // ✅ Send WhatsApp message
        await sendWhatsApp(user.phone_number, message);

        // 🎧 (Optional) Send voice message version
        if (process.env.SEND_VOICE === "true") {
          const langCode = userLang === "hi" ? "hi" : userLang === "or" ? "or" : "en";
          const mp3Path = await generateVoice(message, langCode);
          const fileUrl = `https://YOUR_NGROK_URL/static/${path.basename(mp3Path)}`;
          await sendWhatsApp(user.phone_number, fileUrl, true); // true → send as media
        }

        console.log(`✅ Sent update to ${user.phone_number} in [${userLang}]`);
      } catch (err) {
        console.warn(`❌ Failed for ${user.phone_number}:`, err.message);
      }
    }

    console.log(`✅ Broadcast completed to ${subs.rowCount} users.`);

    res.json({
      success: true,
      message: `Update added and sent to ${subs.rowCount} subscribers.`,
      update: newUpdate,
    });
  } catch (err) {
    console.error("❌ Error adding update or broadcasting:", err);
    res.status(500).json({ error: "Server error." });
  }
});

// ✅ GET all updates (admin dashboard)
router.get("/updates", verifyAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, description, priority, lang, created_at
       FROM gov_updates
       ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error loading updates:", err);
    res.status(500).json({ error: "Server error." });
  }
});

module.exports = router;
