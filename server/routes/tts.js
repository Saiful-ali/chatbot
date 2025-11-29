// routes/tts.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const gTTS = require("gtts");
const { translateText, detectLanguage } = require("../utils/translate");
const router = express.Router();

const tmpDir = path.join(__dirname, "../tmp");
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

const ttsLanguageMap = {
  en: "en", hi: "hi", or: "or", bn: "bn", te: "te", ta: "ta",
  mr: "mr", gu: "gu", kn: "kn", ml: "ml", pa: "pa"
};

function cleanForTTS(text) {
  if (!text) return "";
  try {
    return text.replace(/[^\p{L}\p{N}\p{P}\p{Z}\n]/gu, "");
  } catch (err) {
    // Fallback if Unicode property not supported
    return text.replace(/[^\w\s\.\,\!\?\-@#\$%&\(\)]/g, "");
  }
}

async function generateVoice(text, targetLang = "en", sourceLang = "auto") {
  try {
    text = cleanForTTS(text || "");
    if (sourceLang === "auto") sourceLang = await detectLanguage(text);
    let textToSpeak = text;
    if (sourceLang !== targetLang) {
      textToSpeak = await translateText(text, targetLang, sourceLang);
    }
    const ttsLang = ttsLanguageMap[targetLang] || "en";
    const finalLang = ttsLang === "or" ? "hi" : ttsLang;
    const timestamp = Date.now();
    const safeText = textToSpeak.replace(/[^\w\s]/gi, "").slice(0, 30).replace(/\s+/g, "_") || "tts";
    const filename = `tts_${finalLang}_${safeText}_${timestamp}.mp3`;
    const filePath = path.join(tmpDir, filename);

    return new Promise((resolve, reject) => {
      try {
        const gtts = new gTTS(textToSpeak, finalLang);
        gtts.save(filePath, (err) => {
          if (err) {
            console.error("❌ gTTS error:", err);
            reject(err);
          } else {
            console.log(`🔊 Generated TTS: ${filename} (${finalLang})`);
            resolve(filePath);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  } catch (err) {
    console.error("❌ generateVoice error:", err);
    throw err;
  }
}

router.get("/", async (req, res) => {
  try {
    let text = cleanForTTS((req.query.text || "").trim());
    const targetLang = (req.query.lang || "en").slice(0, 2).toLowerCase();
    const sourceLang = (req.query.sourceLang || "auto").slice(0, 2).toLowerCase();
    const stream = req.query.stream === "true";
    const translate = req.query.translate !== "false";

    if (!text) {
      return res.status(400).json({ error: "Text parameter is required", usage: "/api/tts?text=Hello&lang=hi&stream=true" });
    }

    const supportedLangs = Object.keys(ttsLanguageMap);
    if (!supportedLangs.includes(targetLang)) {
      return res.status(400).json({ error: `Language '${targetLang}' not supported`, supported: supportedLangs });
    }

    let detectedLang = sourceLang;
    if (sourceLang === "auto") {
      detectedLang = await detectLanguage(text);
      console.log(`🌍 Detected source language: ${detectedLang}`);
    }

    const filePath = await generateVoice(text, translate ? targetLang : detectedLang, detectedLang);
    const fileUrl = `${process.env.SERVER_PUBLIC_URL || "http://localhost:5000"}/static/${path.basename(filePath)}`;

    if (stream) {
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Disposition", `inline; filename="${path.basename(filePath)}"`);
      const readStream = fs.createReadStream(filePath);
      readStream.pipe(res);
      readStream.on("close", () => {
        setTimeout(() => {
          if (fs.existsSync(filePath)) fs.unlink(filePath, (err) => err && console.warn("⚠️ Failed to delete temp file:", filePath));
        }, 5000);
      });
    } else {
      res.json({
        success: true,
        url: fileUrl,
        language: targetLang,
        detectedSourceLang: detectedLang,
        translated: detectedLang !== targetLang,
        filename: path.basename(filePath)
      });
    }
  } catch (err) {
    console.error("❌ TTS route error:", err?.message || err);
    res.status(500).json({ error: "Failed to generate speech", message: err.message || err });
  }
});

function cleanupOldFiles() {
  try {
    const files = fs.readdirSync(tmpDir);
    const now = Date.now();
    const maxAge = 3600000; // 1 hour
    let deletedCount = 0;
    files.forEach(file => {
      if (!file.startsWith("tts_") && !file.startsWith("reply_")) return;
      const filePath = path.join(tmpDir, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtimeMs;
      if (age > maxAge) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    });
    if (deletedCount > 0) console.log(`🗑️ Cleaned up ${deletedCount} old TTS files`);
  } catch (err) {
    console.warn("⚠️ Cleanup error:", err.message || err);
  }
}

setInterval(cleanupOldFiles, 1800000);

module.exports = router;
