const translate = require('@vitalets/google-translate-api');

async function translateText(text, toLang = 'en') {
  if (!text || toLang === 'en') return text || '';
  try {
    const res = await translate(text, { to: toLang });
    return res.text;
  } catch (e) {
    console.error('translate error:', e.message);
    return text;
  }
}

async function translateFields(row, fields, toLang) {
  const out = { ...row };
  for (const f of fields) {
    out[f] = await translateText(out[f], toLang);
  }
  return out;
}

module.exports = { translateText, translateFields };
