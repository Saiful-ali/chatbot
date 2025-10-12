// utils/translate.js
const { translate } = require("@deep-translate/core");
const google = require("@deep-translate/google");
const { franc } = require("franc-min");
const langs = require("langs");

/**
 * 🌐 Offline-safe translation using Deep Translate
 * (Automatically falls back to input text if translation fails)
 */
async function translateText(text, toLang = "en") {
  if (!text || toLang === "en" || toLang === "auto") return text || "";
  try {
    const res = await translate(google, text, "auto", toLang);
    return res.data.translation || text;
  } catch (e) {
    console.warn("⚠️ translateText error:", e.message);
    return text; // fallback if translation fails
  }
}

/**
 * 🧠 Detect language of text using franc-min (offline)
 */
async function detectLanguage(text) {
  try {
    if (!text || text.length < 2) return "en";

    const lang3 = franc(text);
    if (!lang3 || lang3 === "und") return "en";

    const langInfo = langs.where("3", lang3);
    if (!langInfo) return "en";

    const lang2 = langInfo["1"];
    return ["en", "hi", "or"].includes(lang2) ? lang2 : "en";
  } catch (e) {
    console.warn("⚠️ detectLanguage error:", e.message);
    return "en";
  }
}

/**
 * 🌐 Translate multiple fields in an object
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
