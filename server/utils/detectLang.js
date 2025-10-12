const franc = require("franc-min");
const langs = require("langs");

/**
 * Detects a 2-letter ISO language code ('en', 'hi', 'or')
 * from the given text input.
 */
function detectLanguage(text) {
  try {
    if (!text || text.trim().length < 3) return "en";

    // franc returns 3-letter ISO639-3 code (like "hin" for Hindi)
    const lang3 = franc(text);

    if (lang3 === "und") return "en"; // und = undefined

    const langInfo = langs.where("3", lang3);
    if (!langInfo) return "en";

    // Convert to 2-letter code
    const lang2 = langInfo["1"];
    if (["hi", "or", "en"].includes(lang2)) return lang2;

    return "en"; // fallback
  } catch (err) {
    console.error("Language detection error:", err.message);
    return "en";
  }
}

module.exports = { detectLanguage };
