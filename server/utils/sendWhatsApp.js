// utils/sendWhatsApp.js
const twilio = require("twilio");
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

/**
 * Normalize phone:
 * - If already starts with '+' keep it (assume includes country code)
 * - If starts with leading 0, strip and add +91
 * - Else, assume Indian local number and add +91
 */
function normalizePhone(to) {
  let s = String(to).trim();
  s = s.replace(/\s+/g, "");

  if (s.startsWith("+")) return s;         // already has country code
  if (s.startsWith("0")) s = s.replace(/^0+/, ""); // drop leading zeros
  // fallback: assume India if no plus sign present
  return s.startsWith("91") ? `+${s}` : `+91${s}`;
}

async function sendWhatsApp(to, content, isMedia = false) {
  try {
    const formattedTo = normalizePhone(to);
    const msgData = {
      from: process.env.TWILIO_WHATSAPP_NUMBER, // should be 'whatsapp:+123456...'
      to: `whatsapp:${formattedTo}`
    };

    if (isMedia) msgData.mediaUrl = [content];
    else msgData.body = content;

    const msg = await client.messages.create(msgData);
    console.log(`✅ WhatsApp ${isMedia ? "media" : "text"} sent to ${formattedTo} | SID: ${msg.sid}`);
    return msg.sid;
  } catch (err) {
    console.error(`❌ Failed to send WhatsApp to ${to}:`, err && err.message ? err.message : err);
    throw err;
  }
}

module.exports = { sendWhatsApp, normalizePhone };
