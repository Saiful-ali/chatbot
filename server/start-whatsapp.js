const { exec } = require("child_process");
const ngrok = require("ngrok");
require("dotenv").config();
const twilio = require("twilio");

// Load Twilio credentials from .env
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

(async function start() {
  try {
    console.log("🚀 Starting local chatbot server...");
    const server = exec("npm run dev");

    // Print live logs
    server.stdout.on("data", (data) => console.log(data.toString()));
    server.stderr.on("data", (data) => console.error(data.toString()));

    console.log("🌐 Starting ngrok tunnel on port 5000...");
    const url = await ngrok.connect({ addr: 5000 });

    console.log(`✅ ngrok tunnel active: ${url}`);

    // Update Twilio webhook automatically
    console.log("🔄 Updating Twilio WhatsApp webhook...");

    await client.incomingPhoneNumbers
      .list({ limit: 1 })
      .then(async (numbers) => {
        if (numbers.length > 0) {
          const sid = numbers[0].sid;
          await client.incomingPhoneNumbers(sid).update({
            smsUrl: `${url}/twilio/whatsapp`,
            smsMethod: "POST",
          });
          console.log(`✅ Twilio webhook updated to: ${url}/twilio/whatsapp`);
        } else {
          console.warn("⚠️ No Twilio phone numbers found. Check your Twilio account.");
        }
      });

    console.log("📲 WhatsApp chatbot is live!");
  } catch (err) {
    console.error("❌ Error starting chatbot:", err);
  }
})();
