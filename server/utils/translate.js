// utils/translate.js
// Robust language detection + hybrid translation helper
// Supports franc-min/franc compatibility and multiple online translators.
//
// Changes in this version:
// - Robust resolution of franc/franc-min exports (handles default/franc/named shapes)
// - Short-query heuristic: treat very short queries (<=2 words or <20 chars) as English
//   to avoid franc mis-detections on single-word queries like "vaccine", "fever", etc.
// - Keeps existing online/offline hybrid translation and caching.

"use strict";

// Try franc-min first, then franc as fallback
const francModule = (() => {
  try {
    return require("franc-min");
  } catch (err) {
    try {
      return require("franc");
    } catch (err2) {
      return null;
    }
  }
})();

const langs = require("langs");
const NodeCache = require("node-cache");

// Compatibility: resolve a usable franc function from the module shape
function resolveFrancFn(mod) {
  if (!mod) return null;
  if (typeof mod === "function") return mod;
  // common shapes: { default: [Function] }, { franc: [Function] }, or other
  if (typeof mod.default === "function") return mod.default;
  if (typeof mod.franc === "function") return mod.franc;
  // sometimes package exports an object with the function nested further
  for (const k of Object.keys(mod)) {
    if (typeof mod[k] === "function") return mod[k];
  }
  return null;
}

const franc = resolveFrancFn(francModule);
if (!franc) {
  console.warn(
    "⚠️ franc language detector not available or exported in an unexpected shape. To inspect, run: console.log(require('franc-min'))"
  );
} else {
  // console.log("✅ franc detector loaded (function)");
}

// Translation cache (24 hours TTL)
const translationCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

// Try multiple translation providers (best-effort)
let googleTranslator = null;
let libreTranslate = null;

try {
  googleTranslator = require("google-translate-api-x");
  console.log("✅ Google Translate API loaded");
} catch (err) {
  console.warn("⚠️ Google Translate not available");
}

try {
  const { translate } = require("@vitalets/google-translate-api");
  libreTranslate = translate;
  console.log("✅ Alternative translate API loaded");
} catch (err) {
  console.warn("⚠️ Alternative translate not available");
}

/**
 * Comprehensive offline dictionary for common health terms
 * (kept small — expand as needed)
 */
const healthDictionary = {
  "en-hi": {
    /* ... your en-hi map ... */
  },
  "en-or": {
    /* ... your en-or map ... */
  },
  "hi-en": {},
  "or-en": {}
};

// build reverse dictionaries (safe: only if source maps exist)
if (healthDictionary["en-hi"]) {
  Object.entries(healthDictionary["en-hi"]).forEach(([en, hi]) => {
    healthDictionary["hi-en"][hi] = en;
  });
}
if (healthDictionary["en-or"]) {
  Object.entries(healthDictionary["en-or"]).forEach(([en, od]) => {
    healthDictionary["or-en"][od] = en;
  });
}

/**
 * Detect language from text (returns 'en' | 'hi' | 'or' or fallback two-letter)
 *
 * Heuristics added:
 * - If input is empty or too short, default to 'en'
 * - If input is very short (<=2 words or <20 chars) assume English (franc is unreliable for short inputs)
 * - Script checks for Devanagari (Hindi) and Odia
 * - Use franc for other languages (ISO639-3 -> ISO639-1 via langs)
 */
function detectLanguage(text = "") {
  try {
    if (!text || typeof text !== "string") return "en";
    const trimmed = text.trim();
    if (trimmed.length < 2) return "en";

    // If the string is very short (common for queries), prefer English
    // This prevents franc misclassifying single-word inputs like "vaccine", "fever", etc.
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length <= 2 || trimmed.length < 20) {
      // still allow explicit script detection for Hindi/Odia if those scripts are present
      if (/[\u0900-\u097F]/.test(trimmed)) return "hi";
      if (/[\u0B00-\u0B7F]/.test(trimmed)) return "or";
      return "en";
    }

    // Script checks (fast & reliable for Hindi/Odia)
    if (/[\u0900-\u097F]/.test(trimmed)) return "hi"; // Devanagari script -> Hindi
    if (/[\u0B00-\u0B7F]/.test(trimmed)) return "or"; // Odia script -> Odia

    // Use franc for other languages (returns ISO639-3)
    if (!franc) {
      // franc not available; fall back to English to avoid breaking
      return "en";
    }

    const lang3 = franc(trimmed);
    if (!lang3 || lang3 === "und") return "en";

    if (lang3 === "hin") return "hi";
    if (lang3 === "ori" || lang3 === "ory") return "or";
    if (lang3 === "eng") return "en";

    // Fallback: map ISO-3 -> ISO-1 with langs package
    const info = langs.where("3", lang3);
    if (info && info["1"]) {
      const code2 = info["1"];
      if (["en", "hi", "or"].includes(code2)) return code2;
      return code2;
    }

    return "en";
  } catch (err) {
    console.warn("⚠️ detectLanguage error:", err && err.message ? err.message : err);
    return "en";
  }
}

/**
 * Try online translation providers (first googleTranslator, then libreTranslate)
 */
async function translateOnline(text, fromLang, toLang) {
  if (!text || !text.trim()) return text;

  if (googleTranslator) {
    try {
      // google-translate-api-x usage: function(text, options)
      const result = await googleTranslator(text, { from: fromLang, to: toLang });
      // Many implementations return a result object with .text
      if (result && result.text) return result.text;
      if (typeof result === "string") return result;
      // some variants return a nested structure
      if (result && result.data && typeof result.data === "string") return result.data;
    } catch (err) {
      console.warn("⚠️ Google Translate failed:", err && err.message ? err.message : err);
    }
  }

  if (libreTranslate) {
    try {
      const result = await libreTranslate(text, { from: fromLang, to: toLang });
      if (result && result.text) return result.text;
      if (typeof result === "string") return result;
      if (result && result.data && typeof result.data === "string") return result.data;
    } catch (err) {
      console.warn("⚠️ Alternative translate failed:", err && err.message ? err.message : err);
    }
  }

  throw new Error("No online translator available");
}

/**
 * Offline dictionary fallback (word-by-word)
 */
function translateOffline(text, fromLang, toLang) {
  if (!text || !text.trim()) return text;
  const dictKey = `${fromLang}-${toLang}`;
  const dictionary = healthDictionary[dictKey];
  if (!dictionary) return text;

  const words = text.split(/\s+/);
  return words
    .map((w) => {
      const clean = w.replace(/[.,!?;:()"'`]/g, "").toLowerCase();
      return dictionary[clean] || w;
    })
    .join(" ");
}

/**
 * Hybrid translation (online first, offline fallback + cache)
 * signature: translateText(text, toLang='en', fromLang='auto')
 */
async function translateText(text, toLang = "en", fromLang = "auto") {
  try {
    if (!text || !text.trim()) return "";

    if (fromLang === "auto") fromLang = detectLanguage(text);

    // If a short query and user explicitly wants auto detection, ensure we don't force weird languages:
    // (detectLanguage already handles short-query heuristic, so no extra action needed here)

    if (fromLang === toLang) return text;

    const cacheKey = `${fromLang}-${toLang}-${text.substring(0, 100)}`;
    const cached = translationCache.get(cacheKey);
    if (cached) return cached;

    let translated = text;
    try {
      translated = await translateOnline(text, fromLang, toLang);
      console.log(`🌐 Online translation: ${fromLang} → ${toLang}`);
    } catch (onlineErr) {
      console.log(`📚 Using offline dictionary: ${fromLang} → ${toLang}`);
      translated = translateOffline(text, fromLang, toLang);
    }

    translationCache.set(cacheKey, translated);
    return translated;
  } catch (err) {
    console.error("❌ translateText error:", err && err.message ? err.message : err);
    return text;
  }
}

/**
 * Translate listed string fields of an object
 * translateFields(obj, ["title","content"], toLang, fromLang='en')
 *
 * Note: translateText signature is translateText(text, toLang='en', fromLang='auto')
 * so we pass args accordingly.
 */
async function translateFields(obj, fields, toLang, fromLang = "en") {
  if (!obj || !fields || !fields.length) return obj;
  if (toLang === fromLang) return obj;
  const out = { ...obj };
  for (const f of fields) {
    if (out[f] && typeof out[f] === "string") {
      // out[f] = await translateText(out[f], toLang, fromLang);
      // translateText expects (text, toLang, fromLang)
      out[f] = await translateText(out[f], toLang, fromLang);
    }
  }
  return out;
}

/**
 * Batch translate array of objects
 */
async function translateBatch(items, fields, toLang, fromLang = "en") {
  if (!items || !items.length) return items;
  if (toLang === fromLang) return items;
  return Promise.all(items.map((item) => translateFields(item, fields, toLang, fromLang)));
}

function getLanguageName(code) {
  const names = { en: "English", hi: "हिन्दी (Hindi)", or: "ଓଡ଼ିଆ (Odia)" };
  return names[code] || code;
}

function getSupportedLanguages() {
  return [
    { code: "en", name: "English", native: "English" },
    { code: "hi", name: "Hindi", native: "हिन्दी" },
    { code: "or", name: "Odia", native: "ଓଡ଼ିଆ" }
  ];
}

module.exports = {
  translateText,
  detectLanguage,
  translateFields,
  translateBatch,
  getLanguageName,
  getSupportedLanguages
};
