const express = require("express");
const { pool } = require("../db");
const { sendWhatsApp } = require("../utils/sendWhatsApp"); // ✅ Add this import
const router = express.Router();

// ✅ Step 1: Middleware for verifying admin key
function verifyAdmin(req, res, next) {
  const key = req.headers["x-admin-key"];
  if (key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: "Unauthorized: Invalid admin key." });
  }
  next();
}

// ✅ Step 2: Secure POST route to add a new update + WhatsApp broadcast
router.post("/add-update", verifyAdmin, async (req, res) => {
  try {
    const { title, description, priority = "medium", lang = "en" } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: "Title and description are required." });
    }

    // 1️⃣ Insert new update into database
    const result = await pool.query(
      `
      INSERT INTO gov_updates (title, description, priority, lang, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *;
      `,
      [title, description, priority, lang]
    );

    const newUpdate = result.rows[0];

    // 2️⃣ Fetch all active WhatsApp subscribers
    const subs = await pool.query(`
      SELECT phone_number FROM user_subscriptions
      WHERE is_active = true AND channel = 'whatsapp';
    `);

    if (subs.rowCount === 0) {
      console.log("⚠️ No active WhatsApp subscribers found.");
    } else {
      console.log(`📢 Sending update to ${subs.rowCount} WhatsApp users...`);

      // 3️⃣ Format message
      const message = `🩺 *${newUpdate.title}*\n\n${newUpdate.description}\n\nPriority: ${newUpdate.priority.toUpperCase()}`;

      // 4️⃣ Send WhatsApp message to each subscriber
      for (const row of subs.rows) {
        await sendWhatsApp(row.phone_number, message);
      }

      console.log(`✅ Successfully broadcasted update to ${subs.rowCount} users.`);
    }

    res.json({
      success: true,
      message: `Update added and broadcasted to ${subs.rowCount} subscribers.`,
      update: newUpdate,
    });
  } catch (err) {
    console.error("❌ Error adding update or sending broadcast:", err);
    res.status(500).json({ error: "Server error." });
  }
});

// ✅ Step 3: Secure GET route to view all updates
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
