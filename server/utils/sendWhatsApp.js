const twilio = require("twilio");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Sends a WhatsApp message to a specific number
 */
async function sendWhatsApp(to, message) {
  try {
    await client.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to,
      body: message,
    });
    console.log(`✅ WhatsApp message sent to ${to}`);
  } catch (err) {
    console.error(`❌ Failed to send WhatsApp to ${to}:`, err.message);
  }
}

module.exports = { sendWhatsApp };
