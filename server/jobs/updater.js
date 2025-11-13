// ========================================
// jobs/updater.js
// ========================================
const cron = require("node-cron");
const Parser = require("rss-parser");
const crypto = require("crypto");
const { pool } = require("../db");
const { sendWhatsAppMessage } = require("../services/whatsappService");

const parser = new Parser();

function sha(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

async function notifyUsers(text) {
  const { rows } = await pool.query(
    `SELECT u.phone_number FROM user_subscriptions us JOIN users u ON u.id = us.user_id WHERE us.is_active = true`
  );
  if (!rows.length) return;

  for (const r of rows) {
    try {
      await sendWhatsAppMessage(r.phone_number, text);
    } catch (e) {
      console.error("notify error:", e.message);
    }
  }
}

async function runOnce() {
  console.log("🔄 Running updater...");
  const { rows: sources } = await pool.query(`SELECT id, name, url FROM gov_sources WHERE active = true`);

  for (const src of sources) {
    try {
      const feed = await parser.parseURL(src.url);
      for (const item of feed.items.slice(0, 5)) {
        const key = sha(`${src.id}:${item.link || item.title}`);
        const exists = await pool.query(`SELECT 1 FROM gov_updates WHERE hash = $1`, [key]);
        if (exists.rowCount) continue;

        await pool.query(
          `INSERT INTO gov_updates (source_id, title, content, url, hash) VALUES ($1, $2, $3, $4, $5)`,
          [src.id, item.title || "Update", item.contentSnippet || "", item.link || null, key]
        );

        const text = `🛡️ Health Update: ${item.title}\n${item.link || ""}`;
        await notifyUsers(text);
      }
    } catch (err) {
      console.error(`updater error for ${src.name}:`, err.message);
    }
  }
}

module.exports = function startUpdater() {
  const cronExp = process.env.UPDATER_CRON || "*/10 * * * *";
  console.log(`⏱️ Updater scheduled: ${cronExp}`);
  cron.schedule(cronExp, runOnce);
  runOnce();
};