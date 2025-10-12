const { pool } = require("../db");

/**
 * Middleware to resolve user language.
 * Priority order:
 * 1️⃣ ?lang= in URL query (highest)
 * 2️⃣ X-User-Lang header
 * 3️⃣ X-User-Phone header → fetch from DB
 * 4️⃣ req.body.lang (for POST)
 * 5️⃣ fallback to 'en'
 */
async function resolveLang(req, _res, next) {
  try {
    // Helper to normalize to 2-letter lowercase
    const pick = (val) => (val || "").toString().slice(0, 2).toLowerCase();

    // 1. Direct query parameter (highest priority)
    let lang = pick(req.query.lang);
    if (lang) {
      req.userLang = lang;
      return next();
    }

    // 2. X-User-Lang header (optional for API clients)
    lang = pick(req.headers["x-user-lang"]);
    if (lang) {
      req.userLang = lang;
      return next();
    }

    // 3. Check DB if phone number header is provided
    const phone = (req.headers["x-user-phone"] || "").replace(/[^\d+]/g, "").trim();
    if (phone) {
      const q = await pool.query(
        "SELECT preferred_language FROM users WHERE phone_number=$1 LIMIT 1",
        [phone]
      );
      if (q.rows.length && q.rows[0].preferred_language) {
        req.userLang = pick(q.rows[0].preferred_language);
        return next();
      }
    }

    // 4. Body field (POST requests like /api/chat)
    if (req.body && req.body.lang) {
      req.userLang = pick(req.body.lang);
      return next();
    }

    // 5. Default fallback
    req.userLang = "en";
    next();
  } catch (err) {
    console.error("resolveLang error:", err.message);
    req.userLang = "en";
    next();
  }
}

module.exports = { resolveLang };
