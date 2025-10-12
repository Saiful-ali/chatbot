// utils/generateVoice.js
const gTTS = require("gtts");
const fs = require("fs");
const path = require("path");

/**
 * Generates an MP3 voice file from text and language code.
 * @param {string} text - The text to convert to speech.
 * @param {string} lang - The language code ('en', 'hi', 'or').
 * @returns {Promise<string>} - The file path to the saved MP3.
 */
async function generateVoice(text, lang = "en") {
  return new Promise((resolve, reject) => {
    try {
      const safeLang = ["en", "hi", "or"].includes(lang) ? lang : "en";
      const fileName = `voice_${Date.now()}.mp3`;
      const filePath = path.join(__dirname, "../tmp", fileName);

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
