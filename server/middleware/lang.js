const { pool } = require('../db');

async function resolveLang(req, _res, next) {
  try {
    const urlLang = (req.query.lang || '').trim();
    if (urlLang) {
      req.userLang = urlLang;
      return next();
    }

    const phone = (req.headers['x-user-phone'] || '').trim();
    if (phone) {
      const q = await pool.query(
        'SELECT preferred_language FROM users WHERE phone_number=$1 LIMIT 1',
        [phone]
      );
      req.userLang = q.rows[0]?.preferred_language || 'en';
      return next();
    }

    req.userLang = 'en';
    next();
  } catch {
    req.userLang = 'en';
    next();
  }
}

module.exports = { resolveLang };
