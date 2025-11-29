// services/whatsappService.js
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

let whatsappClient = null;
let isReady = false;
let qrCodeData = null;

/**
 * 🚀 Initialize WhatsApp Client
 */
function initWhatsApp() {
  if (whatsappClient) {
    console.log("⚠️ WhatsApp client already initialized");
    return whatsappClient;
  }

  whatsappClient = new Client({
    authStrategy: new LocalAuth({
      dataPath: path.join(__dirname, '../.wwebjs_auth')
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    }
  });

  // 📱 QR Code Event
  whatsappClient.on('qr', (qr) => {
    console.log('📱 QR Code received. Scan with WhatsApp:');
    qrcode.generate(qr, { small: true });
    qrCodeData = qr;
  });

  // ✅ Ready Event
  whatsappClient.on('ready', () => {
    console.log('✅ WhatsApp client is ready!');
    isReady = true;
    qrCodeData = null;
  });

  // ⚠️ Authentication Failure
  whatsappClient.on('auth_failure', (msg) => {
    console.error('❌ Authentication failed:', msg);
    isReady = false;
  });

  // 🔌 Disconnected Event
  whatsappClient.on('disconnected', (reason) => {
    console.log('🔌 WhatsApp disconnected:', reason);
    isReady = false;
    qrCodeData = null;
  });

  // 🔄 Loading Screen Event
  whatsappClient.on('loading_screen', (percent, message) => {
    console.log('⏳ Loading WhatsApp...', percent, message);
  });

  // 🚀 Initialize
  whatsappClient.initialize().catch(err => {
    console.error('❌ Failed to initialize WhatsApp:', err);
  });

  return whatsappClient;
}

/**
 * 🔧 Format Chat ID properly
 * Handles both regular users (@c.us) and business accounts (@lid)
 */
function formatChatId(phoneOrChatId) {
  // If already formatted (contains @), return as-is
  if (phoneOrChatId.includes('@')) {
    return phoneOrChatId;
  }
  
  // Clean phone number: remove special chars
  const cleanPhone = phoneOrChatId.replace(/[^\d]/g, '');
  
  // Standard format for regular WhatsApp users
  return `${cleanPhone}@c.us`;
}

/**
 * 📤 Send WhatsApp Message
 * @param {string} phoneNumber - Phone with country code (e.g., "919876543210") or chat ID
 * @param {string} message - Text message to send
 * @returns {Promise<boolean>}
 */
async function sendWhatsAppMessage(phoneNumber, message) {
  try {
    if (!whatsappClient || !isReady) {
      throw new Error('WhatsApp client not ready');
    }

    const chatId = formatChatId(phoneNumber);
    
    // Try to get the chat first to verify it exists
    try {
      const chat = await whatsappClient.getChatById(chatId);
      await chat.sendMessage(message);
      console.log(`✅ Message sent to ${phoneNumber}`);
      return true;
    } catch (chatError) {
      // If @c.us fails, the contact might be a business account
      console.warn(`⚠️ Failed with @c.us format, trying alternative...`);
      
      // Try to find contact in the contact list
      const contacts = await whatsappClient.getContacts();
      const contact = contacts.find(c => 
        c.number === phoneNumber.replace(/[^\d]/g, '') || 
        c.id._serialized === phoneNumber
      );
      
      if (contact) {
        const contactChat = await contact.getChat();
        await contactChat.sendMessage(message);
        console.log(`✅ Message sent via contact lookup to ${phoneNumber}`);
        return true;
      }
      
      throw new Error(`Contact not found: ${phoneNumber}`);
    }
  } catch (err) {
    console.error(`❌ Failed to send message to ${phoneNumber}:`, err.message);
    return false;
  }
}

/**
 * 🎤 Send Voice/Audio Message
 * @param {string} phoneNumber
 * @param {string} audioPath - Path to MP3 file
 * @returns {Promise<boolean>}
 */
async function sendWhatsAppAudio(phoneNumber, audioPath) {
  try {
    if (!whatsappClient || !isReady) {
      throw new Error('WhatsApp client not ready');
    }

    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    const chatId = formatChatId(phoneNumber);

    try {
      const chat = await whatsappClient.getChatById(chatId);
      const media = MessageMedia.fromFilePath(audioPath);
      await chat.sendMessage(media, { sendAudioAsVoice: true });
      console.log(`🎤 Audio sent to ${phoneNumber}`);
      return true;
    } catch (chatError) {
      console.warn(`⚠️ Audio send failed with @c.us, trying contact lookup...`);
      
      const contacts = await whatsappClient.getContacts();
      const contact = contacts.find(c => 
        c.number === phoneNumber.replace(/[^\d]/g, '') || 
        c.id._serialized === phoneNumber
      );
      
      if (contact) {
        const contactChat = await contact.getChat();
        const media = MessageMedia.fromFilePath(audioPath);
        await contactChat.sendMessage(media, { sendAudioAsVoice: true });
        console.log(`🎤 Audio sent via contact lookup to ${phoneNumber}`);
        return true;
      }
      
      throw new Error(`Contact not found for audio: ${phoneNumber}`);
    }
  } catch (err) {
    console.error(`❌ Failed to send audio to ${phoneNumber}:`, err.message);
    return false;
  }
}

/**
 * 🖼️ Send Image with Caption
 */
async function sendWhatsAppImage(phoneNumber, imagePath, caption = '') {
  try {
    if (!whatsappClient || !isReady) {
      throw new Error('WhatsApp client not ready');
    }

    const chatId = formatChatId(phoneNumber);

    try {
      const chat = await whatsappClient.getChatById(chatId);
      const media = MessageMedia.fromFilePath(imagePath);
      await chat.sendMessage(media, { caption });
      console.log(`🖼️ Image sent to ${phoneNumber}`);
      return true;
    } catch (chatError) {
      const contacts = await whatsappClient.getContacts();
      const contact = contacts.find(c => 
        c.number === phoneNumber.replace(/[^\d]/g, '') || 
        c.id._serialized === phoneNumber
      );
      
      if (contact) {
        const contactChat = await contact.getChat();
        const media = MessageMedia.fromFilePath(imagePath);
        await contactChat.sendMessage(media, { caption });
        console.log(`🖼️ Image sent via contact lookup to ${phoneNumber}`);
        return true;
      }
      
      throw new Error(`Contact not found for image: ${phoneNumber}`);
    }
  } catch (err) {
    console.error(`❌ Failed to send image to ${phoneNumber}:`, err.message);
    return false;
  }
}

/**
 * 📊 Get Client Status
 */
function getStatus() {
  return {
    initialized: !!whatsappClient,
    ready: isReady,
    qrCode: qrCodeData,
    needsQR: !isReady && !!qrCodeData
  };
}

/**
 * 🔄 Restart Client
 */
async function restartWhatsApp() {
  try {
    if (whatsappClient) {
      await whatsappClient.destroy();
      whatsappClient = null;
      isReady = false;
      qrCodeData = null;
    }
    initWhatsApp();
    return true;
  } catch (err) {
    console.error('❌ Restart failed:', err);
    return false;
  }
}

/**
 * 🔍 Get WhatsApp Client (for advanced use)
 */
function getClient() {
  return whatsappClient;
}

module.exports = {
  initWhatsApp,
  sendWhatsAppMessage,
  sendWhatsAppAudio,
  sendWhatsAppImage,
  getStatus,
  restartWhatsApp,
  getClient
};