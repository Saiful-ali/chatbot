// utils/generateVoice.js
const gTTS = require("gtts");
const fs = require("fs");
const path = require("path");

async function generateVoice(text, lang = "en") {
  return new Promise((resolve, reject) => {
    try {
      const safeLang = ["en", "hi", "or"].includes(lang) ? lang : "en";
      const tmpDir = path.join(__dirname, "../tmp");
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

      const fileName = `voice_${Date.now()}.mp3`;
      const filePath = path.join(tmpDir, fileName);

      const tts = new gTTS(text, safeLang);
      tts.save(filePath, (err) => {
        if (err) return reject(err);
        console.log(`🔊 Voice generated: ${filePath}`);
        resolve(filePath);
      });
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateVoice };
