const cron = require("node-cron");
const Parser = require("rss-parser");
const crypto = require("crypto");
const { pool } = require("../db");
const twilio = require("twilio");

const parser = new Parser();

function sha(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

async function notifyUsers(text) {
  // Fetch subscribed users
  const { rows } = await pool.query(
    `SELECT u.phone_number, us.channel
     FROM user_subscriptions us
     JOIN users u ON u.id = us.user_id
     WHERE us.is_active = true`
  );
  if (!rows.length) return;

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    console.log("ℹ️ Twilio not configured; skipping notifications.");
    return;
  }
  const client = twilio(sid, token);

  for (const r of rows) {
    try {
      if (r.channel === "whatsapp") {
        await client.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: `whatsapp:${r.phone_number.replace(/^whatsapp:/, "")}`,
          body: text
        });
      } else if (r.channel === "sms" && process.env.TWILIO_SMS_NUMBER) {
        await client.messages.create({
          from: process.env.TWILIO_SMS_NUMBER,
          to: r.phone_number,
          body: text
        });
      }
    } catch (e) {
      console.error("notify error:", e.message);
    }
  }
}

async function runOnce() {
  const { rows: sources } = await pool.query(
    `SELECT id, name, url, lang FROM gov_sources WHERE active = true`
  );

  for (const src of sources) {
    try {
      const feed = await parser.parseURL(src.url);
      for (const item of feed.items.slice(0, 5)) { // last 5 entries
        const key = sha(`${src.id}:${item.link || item.id || item.title}`);
        const exists = await pool.query(`SELECT 1 FROM gov_updates WHERE hash = $1`, [key]);
        if (exists.rowCount) continue;

        await pool.query(
          `INSERT INTO gov_updates (source_id, title, content, url, published_at, hash)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [src.id, item.title || "Update", item.contentSnippet || item.content || "", item.link || null, item.isoDate || null, key]
        );

        // Notify subscribers
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
  // Also run on boot
  runOnce();
};
