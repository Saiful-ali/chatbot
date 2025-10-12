// utils/translate.js

// ✅ Universal import fix — works in all environments (CommonJS & ESM)
let translator;
try {
  translator = require("@vitalets/google-translate-api");
  if (translator.default) translator = translator.default;
} catch (err) {
  console.error("❌ Failed to load google-translate-api:", err);
}

/**
 * Translate plain text into another language.
 * @param {string} text - Text to translate.
 * @param {string} toLang - Target language code (e.g. 'hi', 'or', 'en').
 */
async function translateText(text, toLang = "en") {
  if (!text || toLang === "en" || toLang === "auto") return text || "";

  try {
    if (!translator) throw new Error("translator not initialized");
    const res = await translator(text, { to: toLang });
    return res.text;
  } catch (e) {
    console.warn("⚠️ translateText error:", e.message);
    return text; // graceful fallback
  }
}

/**
 * Detect language of given text.
 * @param {string} text
 * @returns {Promise<string>} language code like 'en', 'hi', 'or'
 */
async function detectLanguage(text) {
  try {
    if (!text) return "en";
    if (!translator) throw new Error("translator not initialized");

    const res = await translator(text, { to: "en" });
    // Correct access to detected language
    return res?.from?.language?.iso || "en";
  } catch (e) {
    console.warn("⚠️ detectLanguage error:", e.message);
    return "en";
  }
}

/**
 * Translate multiple fields in an object (row) to given language.
 */
async function translateFields(row, fields, toLang) {
  const out = { ...row };
  if (!row || !fields?.length || toLang === "en") return out;

  for (const field of fields) {
    if (out[field]) {
      out[field] = await translateText(out[field], toLang);
    }
  }
  return out;
}

module.exports = { translateText, detectLanguage, translateFields };
