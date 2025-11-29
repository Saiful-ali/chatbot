// middleware/lang.js
// Robust language resolver middleware
const { pool } = require("../db");

/**
 * Normalize to 2-letter lower-case language code.
 * Accepts things like 'en', 'EN', 'eng', 'hindi' -> returns 'en'|'hi'|'or' or fallback 'en'
 */
function pickLang(val) {
  if (!val) return "";
  const s = String(val).trim().toLowerCase();
  if (s.length === 2) return s;
  // Accept common 3-letter codes returned by franc or langs
  if (s.startsWith("eng") || s === "eng") return "en";
  if (s.startsWith("hin") || s === "hin") return "hi";
  if (s.startsWith("ori") || s === "ory") return "or";
  // fallback: first two letters
  return s.slice(0, 2);
}

/**
 * Normalize phone for lookup attempts.
 * Returns array of candidate phone forms to try in the DB.
 *
 * Examples:
 *  - input "whatsapp:+919876543210@c.us" -> candidates: ["+919876543210", "919876543210", "9876543210", "+919876543210"]
 *  - input "9876543210" -> ["+919876543210", "919876543210", "9876543210"]
 */
function phoneCandidates(raw) {
  if (!raw) return [];
  let s = String(raw).trim();

  // remove whatsapp:/@c.us wrappers and non phone characters except + and digits
  s = s.replace(/^whatsapp:/i, "");
  s = s.replace(/@c\.us$/i, "");
  s = s.replace(/[^\d+]/g, "");

  const cand = new Set();

  // if includes + and digits keep +form
  if (/^\+\d+$/.test(s)) {
    cand.add(s);
    // without plus
    cand.add(s.replace(/^\+/, ""));
    // try stripping country code (common: India 91)
    const sansCC = s.replace(/^\+?91/, "");
    if (sansCC.length >= 8) cand.add(sansCC);
  } else {
    // No plus: numeric only
    const digits = s.replace(/\D/g, "");
    if (!digits) return [];
    cand.add(digits);
    // try with +91
    if (!digits.startsWith("91")) {
      cand.add(`91${digits}`);
      cand.add(`+91${digits}`);
    } else {
      cand.add(`+${digits}`);
    }
    // also bare local (maybe already best)
    cand.add(digits.replace(/^0+/, "")); // strip leading zeros
  }

  return Array.from(cand);
}

async function resolveLang(req, _res, next) {
  try {
    // 1) Query param override
    const queryLang = pickLang(req.query?.lang);
    if (queryLang) {
      req.userLang = queryLang;
      return next();
    }

    // 2) Header override (explicit)
    const headerLang = pickLang(req.headers["x-user-lang"]);
    if (headerLang) {
      req.userLang = headerLang;
      return next();
    }

    // 3) Body lang (e.g., from forms / mobile)
    if (req.body && req.body.lang) {
      const bodyLang = pickLang(req.body.lang);
      if (bodyLang) {
        req.userLang = bodyLang;
        return next();
      }
    }

    // 4) Try user phone header -> lookup preferred lang in DB
    const rawPhone = req.headers["x-user-phone"] || req.body?.phone || req.body?.phone_number || "";
    const candidates = phoneCandidates(rawPhone);

    if (candidates.length) {
      // Try user_subscriptions first (we store preferred_lang there), then users table
      const tryTables = [
        { table: "user_subscriptions", col: "preferred_lang", where: "phone_number" },
        { table: "users", col: "preferred_lang", where: "phone_number" },
        // older schema fallback (if your DB still uses 'preferred_language' name)
        { table: "user_subscriptions", col: "preferred_language", where: "phone_number" },
        { table: "users", col: "preferred_language", where: "phone_number" }
      ];

      for (const { table, col, where } of tryTables) {
        // Build parameterized IN query depending on number of candidates
        const params = candidates;
        const placeholders = params.map((_, i) => `$${i + 1}`).join(", ");
        const sql = `SELECT ${col} FROM ${table} WHERE ${where} IN (${placeholders}) LIMIT 1`;
        try {
          const q = await pool.query(sql, params);
          if (q.rows.length && q.rows[0] && q.rows[0][col]) {
            req.userLang = pickLang(q.rows[0][col]);
            return next();
          }
        } catch (e) {
          // If table/column doesn't exist, skip silently (schema mismatch)
          // but log for debugging
          if (e && e.code === "42P01") { // undefined_table
            // skip
          } else if (e && e.code === "42703") { // undefined_column
            // skip
          } else {
            // other DB error: log and continue to fallback
            console.warn("resolveLang DB check error:", e.message || e);
          }
        }
      }
    }

    // 5) Final fallback: detect via body.message or query.q if present (optional)
    // If your app accepts a message text, we could attempt language detection here,
    // but keep it simple: default to 'en'
    req.userLang = "en";
    next();
  } catch (err) {
    console.error("resolveLang error:", err && err.message ? err.message : err);
    req.userLang = "en";
    next();
  }
}

module.exports = { resolveLang };
