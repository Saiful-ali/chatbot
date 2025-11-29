// routes/whatsappHandler.js - RESTORED VOICE PROCESSING
const express = require("express");
const { pool } = require("../db");
const natural = require("natural");
const { translateText, detectLanguage } = require("../utils/translate");
const gTTS = require("gtts");
const fs = require("fs");
const path = require("path");
const { sendWhatsAppMessage, sendWhatsAppAudio, getStatus } = require("../services/whatsappService");

const router = express.Router();
const tokenizer = new natural.WordTokenizer();
const tmpDir = path.join(__dirname, "../tmp");
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

async function searchFaq(message) {
  try {
    const res = await pool.query(
      `SELECT answer FROM faqs WHERE LOWER(question) LIKE LOWER($1) OR LOWER(answer) LIKE LOWER($1) LIMIT 1`,
      [`%${message}%`]
    );
    if (res.rows.length) return res.rows[0].answer;

    const tokens = tokenizer.tokenize(message.toLowerCase()).filter(Boolean);
    if (!tokens.length) return null;

    const orLike = tokens.map((_, i) => `LOWER(question) LIKE LOWER(${i + 1})`).join(" OR ");
    const res2 = await pool.query(`SELECT answer FROM faqs WHERE ${orLike} LIMIT 1`, tokens.map((t) => `%${t}%`));
    return res2.rows.length ? res2.rows[0].answer : null;
  } catch (err) {
    console.error("❌ searchFaq error:", err);
    return null;
  }
}

async function generateVoice(text, langCode) {
  return new Promise((resolve, reject) => {
    const file = path.join(tmpDir, `reply_${Date.now()}.mp3`);
    const gtts = new gTTS(text, langCode);
    gtts.save(file, (err) => (err ? reject(err) : resolve(file)));
  });
}

async function handleIncomingMessage(message) {
  try {
    const from = message.from;
    let body = (message.body || "").trim();
    const phone = from.split('@')[0]; // Extract phone number

    console.log(`📩 Message from ${phone}, Type: ${message.type}, HasMedia: ${message.hasMedia}`);

    // Get user's language preference
    let lang = "en";
    const user = await pool.query(`SELECT preferred_lang FROM user_subscriptions WHERE phone_number LIKE $1 LIMIT 1`, [`%${phone}%`]);

    if (user.rows.length) {
      lang = (user.rows[0].preferred_lang || "en").slice(0, 2).toLowerCase();
    } else {
      if (body) {
        lang = (await detectLanguage(body)) || "en";
      }
      await pool.query(
        `INSERT INTO user_subscriptions (phone_number, preferred_lang, channel, is_active)
         VALUES ($1, $2, 'whatsapp', true)
         ON CONFLICT (phone_number) DO UPDATE SET preferred_lang = EXCLUDED.preferred_lang, is_active = true`,
        [phone, lang]
      );
    }

    // Handle voice messages (PTT - Push To Talk)
    if (message.hasMedia && message.type === 'ptt') {
      console.log("🎤 Voice message detected from", phone);
      
      // Since we can't transcribe without external service,
      // let's use the caption/body if available, or provide helpful default response
      if (body && body.length > 0) {
        console.log("📝 Voice message has text caption:", body);
        // Process the caption as normal text
      } else {
        // No caption - provide default health queries
        const defaultQueries = {
          en: "Hello! I'm your health assistant. Please ask about:\n• Dengue\n• Malaria\n• COVID-19\n• Vaccines\n• Prevention tips\n\nType your question for best results!",
          hi: "नमस्ते! मैं आपका स्वास्थ्य सहायक हूं। कृपया पूछें:\n• डेंगू\n• मलेरिया\n• कोविड-19\n• टीके\n• रोकथाम के उपाय\n\nसर्वोत्तम परिणामों के लिए अपना प्रश्न टाइप करें!",
          or: "ନମସ୍କାର! ମୁଁ ଆପଣଙ୍କର ସ୍ୱାସ୍ଥ୍ୟ ସହାୟକ। ଦୟାକରି ପଚାରନ୍ତୁ:\n• ଡେଙ୍ଗୁ\n• ମ୍ୟାଲେରିଆ\n• କୋଭିଡ-19\n• ଟୀକା\n• ପ୍ରତିରୋଧ\n\nସର୍ବୋତ୍ତମ ଫଳାଫଳ ପାଇଁ ଟାଇପ୍ କରନ୍ତୁ!"
        };
        
        body = defaultQueries[lang] || defaultQueries.en;
        await sendWhatsAppMessage(from, body);
        
        if (process.env.SEND_VOICE === "true") {
          const langCode = ["hi", "or"].includes(lang) ? lang : "en";
          const mp3Path = await generateVoice(body, langCode);
          await sendWhatsAppAudio(from, mp3Path);
          setTimeout(() => fs.existsSync(mp3Path) && fs.unlinkSync(mp3Path), 5000);
        }
        return;
      }
    }

    // Handle empty messages or media-only messages
    if (!body || body.length === 0) {
      console.log("⚠️ Empty message from", phone);
      
      const welcomeMessages = {
        en: "👋 Hello! I'm your health assistant.\n\nAsk me about:\n• Disease symptoms\n• Prevention methods\n• Vaccination schedules\n• Health tips\n\nExample: 'What is dengue?'",
        hi: "👋 नमस्ते! मैं आपका स्वास्थ्य सहायक हूं।\n\nमुझसे पूछें:\n• रोग के लक्षण\n• रोकथाम के तरीके\n• टीकाकरण शेड्यूल\n• स्वास्थ्य टिप्स\n\nउदाहरण: 'डेंगू क्या है?'",
        or: "👋 ନମସ୍କାର! ମୁଁ ଆପଣଙ୍କର ସ୍ୱାସ୍ଥ୍ୟ ସହାୟକ।\n\nମୋତେ ପଚାରନ୍ତୁ:\n• ରୋଗ ଲକ୍ଷଣ\n• ପ୍ରତିରୋଧ ପଦ୍ଧତି\n• ଟୀକାକରଣ ସୂଚୀ\n• ସ୍ୱାସ୍ଥ୍ୟ ଟିପ୍ସ\n\nଉଦାହରଣ: 'ଡେଙ୍ଗୁ କଣ?'"
      };
      
      await sendWhatsAppMessage(from, welcomeMessages[lang] || welcomeMessages.en);
      return;
    }

    console.log(`📝 Processing text: "${body}"`);

    // Process text message (including voice captions)
    const queryText = lang !== "en" ? await translateText(body, "en", lang) : body;
    let answer = (await searchFaq(queryText)) || "Sorry, I don't have information about that. Please try:\n• Dengue\n• Malaria\n• COVID-19\n• Vaccines\n\nOr contact your local health office.";

    if (lang !== "en") answer = await translateText(answer, lang, "en");

    await sendWhatsAppMessage(from, answer);

    // Send voice reply
    if (process.env.SEND_VOICE === "true") {
      try {
        const langCode = ["hi", "or"].includes(lang) ? lang : "en";
        const mp3Path = await generateVoice(answer, langCode);
        await sendWhatsAppAudio(from, mp3Path);
        setTimeout(() => fs.existsSync(mp3Path) && fs.unlinkSync(mp3Path), 5000);
      } catch (err) {
        console.warn("🎧 Voice reply failed:", err.message || err);
      }
    }
  } catch (err) {
    console.error("❌ handleIncomingMessage:", err);
  }
}

router.get("/status", (req, res) => res.json(getStatus()));

router.post("/restart", async (req, res) => {
  const { restartWhatsApp } = require("../services/whatsappService");
  try {
    const success = await restartWhatsApp();
    res.json({ success });
  } catch (err) {
    console.error("❌ restart error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = { router, handleIncomingMessage };

// ✅ Import speech recognition (if using Google Speech API)
// For now, we'll use a placeholder transcription
// You can integrate Google Speech-to-Text API later

async function searchFaq(message) {
  try {
    const res = await pool.query(
      `SELECT answer FROM faqs WHERE LOWER(question) LIKE LOWER($1) OR LOWER(answer) LIKE LOWER($1) LIMIT 1`,
      [`%${message}%`]
    );
    if (res.rows.length) return res.rows[0].answer;

    const tokens = tokenizer.tokenize(message.toLowerCase()).filter(Boolean);
    if (!tokens.length) return null;

    const orLike = tokens.map((_, i) => `LOWER(question) LIKE LOWER($${i + 1})`).join(" OR ");
    const res2 = await pool.query(`SELECT answer FROM faqs WHERE ${orLike} LIMIT 1`, tokens.map((t) => `%${t}%`));
    return res2.rows.length ? res2.rows[0].answer : null;
  } catch (err) {
    console.error("❌ searchFaq error:", err);
    return null;
  }
}

async function generateVoice(text, langCode) {
  return new Promise((resolve, reject) => {
    const file = path.join(tmpDir, `reply_${Date.now()}.mp3`);
    const gtts = new gTTS(text, langCode);
    gtts.save(file, (err) => (err ? reject(err) : resolve(file)));
  });
}

/**
 * 🎤 Handle Voice Message from WhatsApp
 * Downloads audio and processes it
 */
async function handleVoiceMessage(message, phone, lang) {
  try {
    console.log("🎤 Voice message received from", phone);

    // Download the audio file
    const media = await message.downloadMedia();
    
    if (!media) {
      console.error("❌ Failed to download voice message");
      await sendWhatsAppMessage(phone, "Sorry, I couldn't process your voice message. Please try sending a text message.");
      return;
    }

    // Save audio file temporarily
    const audioPath = path.join(tmpDir, `voice_${Date.now()}.ogg`);
    fs.writeFileSync(audioPath, media.data, 'base64');
    
    console.log(`💾 Voice message saved: ${audioPath}`);

    // ⚠️ TRANSCRIPTION PLACEHOLDER
    // Since we don't have a speech-to-text service integrated yet,
    // we'll send a helpful message to the user
    
    const responses = {
      en: "🎤 I received your voice message! However, I currently work best with text messages. Please type your health question, and I'll be happy to help!",
      hi: "🎤 मुझे आपका वॉइस मेसेज मिला! हालांकि, मैं अभी टेक्स्ट मेसेज के साथ बेहतर काम करता हूं। कृपया अपना स्वास्थ्य प्रश्न टाइप करें, और मैं खुशी से मदद करूंगा!",
      or: "🎤 ମୁଁ ଆପଣଙ୍କର ଭଏସ୍ ମେସେଜ୍ ପାଇଲି! ତଥାପି, ମୁଁ ବର୍ତ୍ତମାନ ଟେକ୍ସଟ ମେସେଜ୍ ସହିତ ଭଲ କାମ କରେ। ଦୟାକରି ଆପଣଙ୍କର ସ୍ୱାସ୍ଥ୍ୟ ପ୍ରଶ୍ନ ଟାଇପ୍ କରନ୍ତୁ!"
    };

    const response = responses[lang] || responses.en;
    
    // Send text response
    await sendWhatsAppMessage(phone, response);
    
    // Send voice response too
    if (process.env.SEND_VOICE === "true") {
      const langCode = ["hi", "or"].includes(lang) ? lang : "en";
      const mp3Path = await generateVoice(response, langCode);
      await sendWhatsAppAudio(phone, mp3Path);
      setTimeout(() => fs.existsSync(mp3Path) && fs.unlinkSync(mp3Path), 5000);
    }

    // Clean up downloaded voice file
    setTimeout(() => {
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    }, 5000);

  } catch (err) {
    console.error("❌ handleVoiceMessage error:", err);
    await sendWhatsAppMessage(phone, "Sorry, there was an error processing your voice message.");
  }
}

/**
 * 📩 Main Message Handler - Now with Voice Support
 */
async function handleIncomingMessage(message) {
  try {
    const from = message.from;
    const body = (message.body || "").trim();
    const phone = from.replace(/@.*/, "");

    // ✅ CHECK IF MESSAGE IS A VOICE NOTE
    if (message.hasMedia && message.type === 'ptt') {
      console.log("🎤 Voice message detected from", phone);
      
      // Get user's language preference first
      let lang = "en";
      const user = await pool.query(`SELECT preferred_lang FROM user_subscriptions WHERE phone_number = $1 LIMIT 1`, [phone]);
      
      if (user.rows.length) {
        lang = (user.rows[0].preferred_lang || "en").slice(0, 2).toLowerCase();
      }
      
      // Handle voice message
      await handleVoiceMessage(message, phone, lang);
      return;
    }

    // ✅ CHECK IF MESSAGE IS EMPTY (only media, no text)
    if (!body || body.length === 0) {
      console.log("⚠️ Empty message or media-only from", phone);
      
      // Check if it's any other media type
      if (message.hasMedia) {
        const mediaType = message.type;
        console.log(`📎 Media type: ${mediaType}`);
        
        if (mediaType === 'image' || mediaType === 'video' || mediaType === 'document') {
          await sendWhatsAppMessage(phone, "I received your media file. Please send a text message with your health question so I can help you better!");
          return;
        }
      }
      
      // If truly empty, send help message
      await sendWhatsAppMessage(phone, "Hello! I'm your health assistant. Ask me about diseases, symptoms, prevention, or vaccines. Example: 'What is dengue?'");
      return;
    }

    console.log(`📩 Text message from ${phone}: "${body}"`);

    // ✅ REST OF THE TEXT MESSAGE HANDLING (unchanged)
    let lang = "en";
    const user = await pool.query(`SELECT preferred_lang FROM user_subscriptions WHERE phone_number = $1 LIMIT 1`, [phone]);

    if (user.rows.length) {
      lang = (user.rows[0].preferred_lang || "en").slice(0, 2).toLowerCase();
    } else {
      lang = (await detectLanguage(body)) || "en";
      await pool.query(
        `INSERT INTO user_subscriptions (phone_number, preferred_lang, channel, is_active)
         VALUES ($1, $2, 'whatsapp', true)
         ON CONFLICT (phone_number, channel) DO UPDATE SET preferred_lang = EXCLUDED.preferred_lang, is_active = true`,
        [phone, lang]
      );
    }

    const queryText = lang !== "en" ? await translateText(body, "en", lang) : body;
    let answer = (await searchFaq(queryText)) || "Sorry, I don't have an answer. Contact your local health office.";

    if (lang !== "en") answer = await translateText(answer, lang, "en");

    await sendWhatsAppMessage(phone, answer);

    if (process.env.SEND_VOICE === "true") {
      try {
        const langCode = ["hi", "or"].includes(lang) ? lang : "en";
        const mp3Path = await generateVoice(answer, langCode);
        await sendWhatsAppAudio(phone, mp3Path);
        setTimeout(() => fs.existsSync(mp3Path) && fs.unlinkSync(mp3Path), 5000);
      } catch (err) {
        console.warn("🎧 Voice reply failed:", err.message || err);
      }
    }
  } catch (err) {
    console.error("❌ handleIncomingMessage:", err);
  }
}

router.get("/status", (req, res) => res.json(getStatus()));

router.post("/restart", async (req, res) => {
  const { restartWhatsApp } = require("../services/whatsappService");
  try {
    const success = await restartWhatsApp();
    res.json({ success });
  } catch (err) {
    console.error("❌ restart error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Export both router and the handler function
module.exports = { router, handleIncomingMessage };