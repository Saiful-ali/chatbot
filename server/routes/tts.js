// ========================================
// routes/tts.js
// ========================================
const express = require("express");
const fs = require("fs");
const path = require("path");
const gTTS = require("gtts");
const router = express.Router();

const tmpDir = path.join(__dirname, "../tmp");
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

async function generateVoice(text, lang = "en") {
  const filename = `reply_${lang}_${Date.now()}.mp3`;
  const filePath = path.join(tmpDir, filename);

  return new Promise((resolve, reject) => {
    const gtts = new gTTS(text, lang);
    gtts.save(filePath, (err) => (err ? reject(err) : resolve(filePath)));
  });
}

router.get("/", async (req, res) => {
  try {
    const text = (req.query.text || "").trim();
    const lang = (req.query.lang || "en").slice(0, 2);
    const stream = req.query.stream === "true";

    if (!text) return res.status(400).json({ error: "Text required" });

    const filePath = await generateVoice(text, lang);
    const fileUrl = `${process.env.SERVER_PUBLIC_URL || "http://localhost:5000"}/static/${path.basename(filePath)}`;

    if (stream) {
      res.setHeader("Content-Type", "audio/mpeg");
      const readStream = fs.createReadStream(filePath);
      readStream.pipe(res);
      readStream.on("close", () => fs.unlink(filePath, () => {}));
    } else {
      res.json({ url: fileUrl });
    }
  } catch (err) {
    res.status(500).json({ error: "TTS failed" });
  }
});

module.exports = router;