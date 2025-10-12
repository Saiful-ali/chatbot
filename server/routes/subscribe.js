const express = require("express");
const { pool } = require("../db");
const router = express.Router();

/**
 * POST /api/subscribe
 * body: { phone_number, name?, preferred_language?, channels?: ['whatsapp','sms'] }
 */
router.post("/", async (req, res) => {
  try {
    const { phone_number, name, preferred_language = 'en', channels = ['whatsapp'] } = req.body || {};
    if (!phone_number) return res.status(400).json({ error: "phone_number is required" });

    // upsert user
    const user = await pool.query(
      `INSERT INTO users (phone_number, name, preferred_language, is_authenticated)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (phone_number) DO UPDATE SET name = EXCLUDED.name, preferred_language = EXCLUDED.preferred_language
       RETURNING id`,
      [phone_number, name || null, preferred_language]
    );
    const userId = user.rows[0].id;

    // subscribe channels
    // subscribe channels
for (const ch of channels) {
  await pool.query(
    `INSERT INTO user_subscriptions (user_id, phone_number, channel, is_active)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (user_id, channel)
     DO UPDATE SET is_active = true, phone_number = EXCLUDED.phone_number`,
    [userId, phone_number, ch]
  );
}


    res.json({ ok: true, user_id: userId, channels });
  } catch (err) {
    console.error("subscribe error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
