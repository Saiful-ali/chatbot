// utils/translate.js
const translate = require("google-translate-api-x");

/**
 * Translate plain text into another language.
 */
async function translateText(text, toLang = "en") {
  if (!text || toLang === "en" || toLang === "auto") return text || "";
  try {
    const res = await translate(text, { to: toLang });
    return res.text;
  } catch (e) {
    console.warn("⚠️ translateText error:", e.message);
    return text;
  }
}

/**
 * Detect language of given text.
 */
async function detectLanguage(text) {
  if (!text) return "en";
  try {
    const res = await translate(text, { to: "en" });
    return res.from?.language?.iso || "en";
  } catch (e) {
    console.warn("⚠️ detectLanguage error:", e.message);
    return "en";
  }
}

/**
 * Translate multiple fields in an object.
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
