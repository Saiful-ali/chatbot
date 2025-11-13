const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

let whatsappClient = null;
let isReady = false;
let qrCodeData = null;

function initWhatsApp() {
  if (whatsappClient) return whatsappClient;

  whatsappClient = new Client({
    authStrategy: new LocalAuth({
      dataPath: path.join(__dirname, '../.wwebjs_auth')
    }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  whatsappClient.on('qr', (qr) => {
    console.log('📱 Scan QR Code:');
    qrcode.generate(qr, { small: true });
    qrCodeData = qr;
  });

  whatsappClient.on('ready', () => {
    console.log('✅ WhatsApp ready!');
    isReady = true;
    qrCodeData = null;
  });

  whatsappClient.on('auth_failure', (msg) => {
    console.error('❌ Auth failed:', msg);
    isReady = false;
  });

  whatsappClient.on('disconnected', (reason) => {
    console.log('🔌 Disconnected:', reason);
    isReady = false;
  });

  whatsappClient.initialize();
  return whatsappClient;
}

async function sendWhatsAppMessage(phoneNumber, message) {
  try {
    if (!isReady) throw new Error('Not ready');
    const cleanPhone = phoneNumber.replace(/[^\d]/g, '');
    const chatId = `${cleanPhone}@c.us`;
    await whatsappClient.sendMessage(chatId, message);
    console.log(`✅ Sent to ${phoneNumber}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed ${phoneNumber}:`, err.message);
    return false;
  }
}

async function sendWhatsAppAudio(phoneNumber, audioPath) {
  try {
    if (!isReady) throw new Error('Not ready');
    const cleanPhone = phoneNumber.replace(/[^\d]/g, '');
    const chatId = `${cleanPhone}@c.us`;
    const media = MessageMedia.fromFilePath(audioPath);
    await whatsappClient.sendMessage(chatId, media, { sendAudioAsVoice: true });
    console.log(`🎤 Audio sent to ${phoneNumber}`);
    return true;
  } catch (err) {
    console.error(`❌ Audio failed:`, err.message);
    return false;
  }
}

function getStatus() {
  return {
    initialized: !!whatsappClient,
    ready: isReady,
    qrCode: qrCodeData,
    needsQR: !isReady && !!qrCodeData
  };
}

async function restartWhatsApp() {
  try {
    if (whatsappClient) {
      await whatsappClient.destroy();
      whatsappClient = null;
      isReady = false;
    }
    initWhatsApp();
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = {
  initWhatsApp,
  sendWhatsAppMessage,
  sendWhatsAppAudio,
  getStatus,
  restartWhatsApp
};