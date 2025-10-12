const express = require("express");
const { pool } = require("../db");
const router = express.Router();

// ✅ Step 1: Middleware for verifying admin key
function verifyAdmin(req, res, next) {
  const key = req.headers["x-admin-key"];
  if (key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: "Unauthorized: Invalid admin key." });
  }
  next();
}

// ✅ Step 2: Secure POST route to add a new update
router.post("/add-update", verifyAdmin, async (req, res) => {
  try {
    const { title, description, priority = "medium", lang = "en" } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: "Title and description are required." });
    }

    // Insert new update into database
    const result = await pool.query(
      `
      INSERT INTO gov_updates (title, description, priority, lang, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *;
      `,
      [title, description, priority, lang]
    );

    // TODO: Later we can send WhatsApp broadcast here

    res.json({ success: true, inserted: result.rows[0] });
  } catch (err) {
    console.error("Error adding update:", err);
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
    console.error("Error loading updates:", err);
    res.status(500).json({ error: "Server error." });
  }
});

module.exports = router;
