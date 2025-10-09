import twilio from 'twilio';
import { translateText } from './openai'; // your AI translation module

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID || "",
  process.env.TWILIO_AUTH_TOKEN || ""
);

const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || "";
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";

export interface MessageOptions {
  to: string;
  message: string;
  mediaUrl?: string;
  language?: string; // e.g., "en", "hi", "ta"
}

export interface WhatsAppMessageOptions extends MessageOptions {
  messageType?: 'text' | 'media' | 'template';
}

// Helper: Validate Indian phone number
export function validatePhoneNumber(phone: string): boolean {
  const indianPhoneRegex = /^(\+91[\-\s]?)?[0]?(91)?[789]\d{9}$/;
  return indianPhoneRegex.test(phone);
}

// Helper: Format phone number for Twilio
export function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return phone;
}

// Translate message if language is not English
async function prepareMessage(message: string, language?: string): Promise<string> {
  if (!language || language === 'en') return message;
  try {
    return await translateText(message, language);
  } catch (err) {
    console.error("Translation failed, sending original message:", err);
    return message;
  }
}

// Send SMS
export async function sendSMS(options: MessageOptions): Promise<boolean> {
  try {
    if (!validatePhoneNumber(options.to)) throw new Error(`Invalid phone number: ${options.to}`);
    const to = formatPhoneNumber(options.to);
    const msg = await prepareMessage(options.message, options.language);

    await twilioClient.messages.create({
      body: msg,
      from: TWILIO_PHONE_NUMBER,
      to,
      mediaUrl: options.mediaUrl ? [options.mediaUrl] : undefined,
    });

    console.log(`SMS sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error("Failed to send SMS:", error);
    return false;
  }
}

// Send WhatsApp Message
export async function sendWhatsAppMessage(options: WhatsAppMessageOptions): Promise<boolean> {
  try {
    if (!validatePhoneNumber(options.to)) throw new Error(`Invalid phone number: ${options.to}`);
    const to = `whatsapp:${formatPhoneNumber(options.to)}`;
    const msg = await prepareMessage(options.message, options.language);

    const messageData: any = { body: msg, from: TWILIO_WHATSAPP_NUMBER, to };
    if (options.mediaUrl) messageData.mediaUrl = [options.mediaUrl];

    await twilioClient.messages.create(messageData);

    console.log(`WhatsApp message sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error("Failed to send WhatsApp message:", error);
    return false;
  }
}

// Send Health Alert to multiple numbers with translation
export async function sendHealthAlert(
  phoneNumbers: string[],
  alert: { title: string; description: string; language: string; alertType: string }
): Promise<{ smsResults: boolean[]; whatsappResults: boolean[] }> {
  const baseMessage = `🚨 Health Alert - ${alert.title}\n\n${alert.description}\n\nFor emergencies, contact 108 or visit your nearest health center.`;
  const message = await prepareMessage(baseMessage, alert.language);

  const smsPromises = phoneNumbers.map(num => sendSMS({ to: num, message, language: alert.language }));
  const whatsappPromises = phoneNumbers.map(num => sendWhatsAppMessage({ to: num, message, language: alert.language }));

  const [smsResults, whatsappResults] = await Promise.all([
    Promise.all(smsPromises),
    Promise.all(whatsappPromises),
  ]);

  return { smsResults, whatsappResults };
}

// Webhook Handlers
export function setupWhatsAppWebhook() {
  return (req: any, res: any) => {
    try {
      console.log("Received WhatsApp message:", req.body);
      res.status(200).send('OK');
    } catch (err) {
      console.error("WhatsApp webhook error:", err);
      res.status(500).send('Error');
    }
  };
}

export function setupSMSWebhook() {
  return (req: any, res: any) => {
    try {
      console.log("Received SMS message:", req.body);
      res.status(200).send('OK');
    } catch (err) {
      console.error("SMS webhook error:", err);
      res.status(500).send('Error');
    }
  };
}
