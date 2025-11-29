// jobs/updater.js
const cron = require("node-cron");
const Parser = require("rss-parser");
const crypto = require("crypto");
const { pool } = require("../db");
const { sendWhatsAppMessage } = require("../services/whatsappService");

const parser = new Parser();

function sha(s) {
  return crypto.createHash("sha256").update(String(s || "")).digest("hex");
}

/**
 * Notify users by WhatsApp concurrently with a small concurrency limit
 * so we don't overload the WhatsApp service at once.
 */
async function notifyUsers(text) {
  try {
    const { rows } = await pool.query(
      `SELECT COALESCE(u.phone_number, us.phone_number) AS phone_number
       FROM user_subscriptions us
       LEFT JOIN users u ON u.id = us.user_id
       WHERE us.is_active = true`
    );

    if (!rows || rows.length === 0) {
      console.log("🔕 notifyUsers: no subscribers found");
      return;
    }

    const phones = rows.map(r => r.phone_number).filter(Boolean);
    if (!phones.length) {
      console.log("🔕 notifyUsers: no phone numbers found");
      return;
    }

    // concurrency chunking
    const CONCURRENCY = 10;
    for (let i = 0; i < phones.length; i += CONCURRENCY) {
      const chunk = phones.slice(i, i + CONCURRENCY);
      const promises = chunk.map(p =>
        sendWhatsAppMessage(p, text).catch((e) => {
          console.error(`❌ notifyUsers send error for ${p}:`, e && e.message ? e.message : e);
          return null;
        })
      );
      await Promise.allSettled(promises);
    }

    console.log(`✅ Notified ${phones.length} subscribers (attempted).`);
  } catch (err) {
    console.error("❌ notifyUsers error:", err && err.message ? err.message : err);
  }
}

/**
 * Run the updater once: fetch active sources, parse latest items,
 * insert gov_updates (only if hash not seen) and notify users.
 */
async function runOnce() {
  console.log("🔄 Running updater...");

  let sources;
  try {
    const res = await pool.query(`SELECT id, name, url FROM gov_sources WHERE active = true`);
    sources = res.rows || [];
    if (!sources.length) {
      console.log("⚠️ No active gov_sources found (skipping).");
      return;
    }
  } catch (err) {
    console.error("❌ Failed to fetch gov_sources:", err && err.message ? err.message : err);
    return;
  }

  for (const src of sources) {
    try {
      if (!src.url) {
        console.warn(`⚠️ Source ${src.id} (${src.name}) has no URL, skipping`);
        continue;
      }

      const feed = await parser.parseURL(src.url).catch(e => {
        throw new Error(`RSS parse error for ${src.url}: ${e && e.message ? e.message : e}`);
      });

      const items = Array.isArray(feed.items) ? feed.items.slice(0, 5) : [];
      if (!items.length) {
        console.log(`ℹ️ No items found for source ${src.name}`);
        continue;
      }

      for (const item of items) {
        try {
          const title = (item.title || "Update").toString().trim();
          const snippet = (item.contentSnippet || item.content || "").toString().trim();
          const link = item.link ? item.link.toString().trim() : null;

          const key = sha(`${src.id}:${link || title}`);

          // Insert if not exists (atomic), returns 1 row if inserted
          const insertSql = `
            INSERT INTO gov_updates (source_id, title, content, url, hash)
            SELECT $1, $2, $3, $4, $5
            WHERE NOT EXISTS (SELECT 1 FROM gov_updates WHERE hash = $5)
            RETURNING id
          `;

          const ins = await pool.query(insertSql, [src.id, title, snippet, link, key]);

          if (!ins.rowCount) {
            // already exists; skip notify
            // console.log(`🔁 Skipping already-seen update (hash: ${key})`);
            continue;
          }

          const text = `🛡️ Health Update: ${title}${link ? ("\n" + link) : ""}`;
          console.log(`🆕 New update inserted (id=${ins.rows[0].id}) from ${src.name}: ${title}`);

          // notify subscribers but don't await per user synchronously (handled inside)
          await notifyUsers(text);
        } catch (itemErr) {
          console.error(`❌ Error processing item for source ${src.name}:`, itemErr && itemErr.message ? itemErr.message : itemErr);
        }
      }
    } catch (srcErr) {
      console.error(`updater error for ${src.name || src.id}:`, srcErr && srcErr.message ? srcErr.message : srcErr);
    }
  }
}

module.exports = function startUpdater() {
  const cronExp = process.env.UPDATER_CRON || "*/10 * * * *";
  console.log(`⏱️ Updater scheduled: ${cronExp}`);
  cron.schedule(cronExp, () => {
    runOnce().catch(e => console.error("❌ Scheduled updater run failed:", e && e.message ? e.message : e));
  });

  // run once now (non-blocking)
  runOnce().catch(e => console.error("❌ Initial updater run failed:", e && e.message ? e.message : e));
};
