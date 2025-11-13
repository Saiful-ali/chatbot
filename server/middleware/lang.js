// ========================================
// middleware/lang.js
// ========================================
const { pool } = require("../db");

async function resolveLang(req, _res, next) {
  try {
    const pick = (val) => (val || "").toString().slice(0, 2).toLowerCase();

    let lang = pick(req.query.lang);
    if (lang) {
      req.userLang = lang;
      return next();
    }

    lang = pick(req.headers["x-user-lang"]);
    if (lang) {
      req.userLang = lang;
      return next();
    }

    const phone = (req.headers["x-user-phone"] || "").replace(/[^\d+]/g, "").trim();
    if (phone) {
      const q = await pool.query("SELECT preferred_language FROM users WHERE phone_number=$1 LIMIT 1", [phone]);
      if (q.rows.length && q.rows[0].preferred_language) {
        req.userLang = pick(q.rows[0].preferred_language);
        return next();
      }
    }

    if (req.body && req.body.lang) {
      req.userLang = pick(req.body.lang);
      return next();
    }

    req.userLang = "en";
    next();
  } catch (err) {
    console.error("resolveLang error:", err.message);
    req.userLang = "en";
    next();
  }
}

module.exports = { resolveLang };
