// utils/sendWhatsApp.js
const twilio = require("twilio");
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * ✅ Sends a WhatsApp message (text or media)
 * @param {string} to - Recipient number (e.g., +919045141958)
 * @param {string} content - Message text or media URL
 * @param {boolean} isMedia - true for media message
 */
async function sendWhatsApp(to, content, isMedia = false) {
  try {
    // ✅ Clean and format recipient
    const formattedTo = to
      .toString()
      .replace(/\s+/g, "")           // remove spaces
      .replace(/^(\+91)?/, "+91")    // ensure country code (India by default)
      .replace(/^whatsapp:/, "");    // remove duplicate prefix if exists

    const msgData = {
      from: process.env.TWILIO_WHATSAPP_NUMBER, // ✅ already includes 'whatsapp:'
      to: `whatsapp:${formattedTo}`,
    };

    if (isMedia) {
      msgData.mediaUrl = [content];
    } else {
      msgData.body = content;
    }

    const msg = await client.messages.create(msgData);
    console.log(`✅ WhatsApp ${isMedia ? "media" : "text"} sent to ${formattedTo} | SID: ${msg.sid}`);
    return msg.sid;
  } catch (err) {
    console.error(`❌ Failed to send WhatsApp to ${to}:`, err.message);
    throw err;
  }
}

module.exports = { sendWhatsApp };
