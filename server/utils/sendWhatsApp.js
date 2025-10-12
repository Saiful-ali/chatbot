// utils/sendWhatsApp.js
const twilio = require("twilio");
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Sends a WhatsApp message to a specific number
 * @param {string} to - Recipient number (e.g., +919045141958)
 * @param {string} content - Message text or media URL
 * @param {boolean} isMedia - true if sending media (audio, image, etc.)
 */
async function sendWhatsApp(to, content, isMedia = false) {
  try {
    const msgData = {
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${to.replace("whatsapp:", "")}`, // normalize
    };

    if (isMedia) {
      // 🎧 Send media message (e.g., MP3, image, PDF, etc.)
      msgData.mediaUrl = [content];
    } else {
      // 💬 Send plain text message
      msgData.body = content;
    }

    const msg = await client.messages.create(msgData);
    console.log(`✅ WhatsApp ${isMedia ? "media" : "text"} sent to ${to} | SID: ${msg.sid}`);
  } catch (err) {
    console.error(`❌ Failed to send WhatsApp to ${to}:`, err.message);
  }
}

module.exports = { sendWhatsApp };
