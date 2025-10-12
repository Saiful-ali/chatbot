const translate = require('@vitalets/google-translate-api');

/**
 * Translate plain text into another language.
 * @param {string} text - Text to translate.
 * @param {string} toLang - Target language code (e.g. 'hi', 'or', 'en').
 */
async function translateText(text, toLang = 'en') {
  if (!text || toLang === 'en' || toLang === 'auto') return text || '';
  try {
    const res = await translate(text, { to: toLang });
    return res.text;
  } catch (e) {
    console.warn('⚠️ translateText error:', e.message);
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
    if (!text) return 'en';
    const res = await translate(text, { to: 'en' }); // translate() returns detection info
    return res.from?.language?.iso || 'en';
  } catch (e) {
    console.warn('⚠️ detectLanguage error:', e.message);
    return 'en';
  }
}

/**
 * Translate multiple fields in an object (row) to given language.
 * e.g. translateFields(row, ['title','description'], 'hi')
 */
async function translateFields(row, fields, toLang) {
  const out = { ...row };
  if (!row || !fields || !fields.length || toLang === 'en') return out;

  for (const field of fields) {
    if (out[field]) {
      out[field] = await translateText(out[field], toLang);
    }
  }
  return out;
}

module.exports = { translateText, detectLanguage, translateFields };
