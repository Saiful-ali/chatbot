// routes/tts.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const gTTS = require("gtts");

const router = express.Router();
const tmpDir = path.join(__dirname, "../tmp");

// Ensure tmp directory exists
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

/**
 * GET /api/tts?text=Hello&lang=en
 * Returns: { url: "http://localhost:5000/static/reply_123.mp3" }
 */
router.get("/", async (req, res) => {
  try {
    const text = req.query.text || "";
    const lang = req.query.lang || "en";

    if (!text.trim()) {
      return res.status(400).json({ error: "Text required" });
    }

    // Create file name and path
    const filename = `reply_${Date.now()}.mp3`;
    const filePath = path.join(tmpDir, filename);

    // Generate TTS audio
    const gtts = new gTTS(text, lang);
    gtts.save(filePath, (err) => {
      if (err) {
        console.error("TTS generation error:", err);
        return res.status(500).json({ error: "Failed to generate TTS" });
      }

      const fileUrl = `${process.env.SERVER_PUBLIC_URL || "http://localhost:5000"}/static/${filename}`;
      res.json({ url: fileUrl });
    });
  } catch (err) {
    console.error("TTS route error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router; // ✅ Correct export
