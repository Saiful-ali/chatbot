const express = require("express");
const gTTS = require("gtts");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const tmpDir = path.join(__dirname, "../tmp");
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

/**
 * GET /api/tts?text=Hello&lang=hi
 * Generates a temporary MP3 file and returns its public URL
 */
router.get("/", async (req, res) => {
  try {
    const text = req.query.text;
    const lang = req.query.lang || "en";

    if (!text) return res.status(400).json({ error: "Missing text parameter" });

    const filePath = path.join(tmpDir, `tts_${Date.now()}.mp3`);
    const gtts = new gTTS(text, lang);
    gtts.save(filePath, (err) => {
      if (err) {
        console.error("🎧 gTTS error:", err);
        return res.status(500).json({ error: "TTS generation failed" });
      }

      const publicUrl = `${process.env.SERVER_PUBLIC_URL}/static/${path.basename(filePath)}`;
      res.json({ audioUrl: publicUrl });
    });
  } catch (err) {
    console.error("❌ /api/tts error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
