// routes/subscribe.js
const express = require("express");
const { pool } = require("../db");
const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { phone_number, name, preferred_language = "en", channels = ["whatsapp"] } = req.body || {};
    if (!phone_number) return res.status(400).json({ error: "phone_number required" });

    const pref = (preferred_language || "en").slice(0, 2).toLowerCase();

    const user = await pool.query(
      `INSERT INTO users (phone_number, name, preferred_lang, is_authenticated)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (phone_number) DO UPDATE SET name = EXCLUDED.name, preferred_lang = EXCLUDED.preferred_lang
       RETURNING id`,
      [phone_number, name || null, pref]
    );
    const userId = user.rows[0].id;

    for (const ch of channels) {
      // Ensure conflict target matches your DB unique constraint (phone_number, channel) recommended
      await pool.query(
        `INSERT INTO user_subscriptions (user_id, phone_number, preferred_lang, channel, is_active)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (phone_number, channel) DO UPDATE SET is_active = true, preferred_lang = EXCLUDED.preferred_lang`,
        [userId, phone_number, pref, ch]
      );
    }

    res.json({ ok: true, user_id: userId });
  } catch (err) {
    console.error("❌ subscribe error:", err);
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

module.exports = router;
