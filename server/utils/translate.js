// ========================================
// utils/translate.js
// ========================================
const franc = require("franc-min");
const langs = require("langs");

let onlineTranslator;
try {
  onlineTranslator = require("google-translate-api-x");
} catch (err) {
  onlineTranslator = null;
}

const offlineDict = {
  hi: {
    "hello": "नमस्ते",
    "thank you": "धन्यवाद",
    "sorry": "माफ़ कीजिये"
  },
  or: {
    "hello": "ନମସ୍କାର",
    "thank you": "ଧନ୍ୟବାଦ"
  }
};

async function translateOnline(text, toLang = "en") {
  if (!onlineTranslator) throw new Error("No translator");
  const res = await onlineTranslator(text, { to: toLang });
  return res.text;
}

function translateOffline(text, toLang = "en") {
  if (!text) return "";
  const lower = text.toLowerCase().trim();
  return offlineDict[toLang]?.[lower] || text;
}

async function translateText(text, toLang = "en") {
  if (!text || toLang === "en" || toLang === "auto") return text || "";
  try {
    return await translateOnline(text, toLang);
  } catch (e) {
    return translateOffline(text, toLang);
  }
}

async function detectLanguage(text = "") {
  try {
    if (!text || text.length < 2) return "en";
    const lang3 = franc(text);
    if (!lang3 || lang3 === "und") return "en";
    const langInfo = langs.where("3", lang3);
    if (!langInfo) return "en";
    const lang2 = langInfo["1"];
    return ["en", "hi", "or"].includes(lang2) ? lang2 : "en";
  } catch (e) {
    return "en";
  }
}

async function translateFields(row, fields, toLang) {
  const out = { ...row };
  if (!row || !fields?.length || toLang === "en") return out;
  for (const field of fields) {
    if (out[field]) out[field] = await translateText(out[field], toLang);
  }
  return out;
}

module.exports = { translateText, detectLanguage, translateFields };


