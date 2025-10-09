// server/registerRoutes.ts
import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { sendSMS, sendWhatsAppMessage, sendHealthAlert, validatePhoneNumber, formatPhoneNumber } from "./services/twilio";
import { healthDataService, EMERGENCY_CONTACTS, SUPPORTED_LANGUAGES } from "./services/health-data";
import { insertUserSchema, insertChatMessageSchema, insertDoctorSchema } from "../shared/schema";
import { FAQ } from "./models/FAQ";
import { getEmbedding, cosineSimilarity } from "./services/embeddings";
import { pipeline } from "@xenova/transformers";
import { z } from "zod";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize Whisper pipeline
  const whisper: any = await pipeline("automatic-speech-recognition", "Xenova/whisper-small");

  // -------------------------------
  // Health categories
  // -------------------------------
  app.get("/api/health-categories", async (_req, res) => {
    try {
      const categories = await storage.getHealthCategories();
      res.json(categories);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to fetch health categories" });
    }
  });

  // -------------------------------
  // Health entries by category
  // -------------------------------
  app.get("/api/health-entries/:categoryId", async (req, res) => {
    try {
      const { categoryId } = req.params;
      const entries = await storage.getHealthEntries(categoryId);
      res.json(entries);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to fetch health entries" });
    }
  });

  // -------------------------------
  // Health alerts
  // -------------------------------
  app.get("/api/health-alerts", async (req, res) => {
    try {
      const language = (req.query.lang as string) || "en";
      const alerts = await healthDataService.getLatestAlerts(language);
      res.json(alerts);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to fetch health alerts" });
    }
  });

  // -------------------------------
  // Health facilities
  // -------------------------------
  app.get("/api/health-facilities", async (req, res) => {
    try {
      const { lat, lng, type } = req.query as { lat?: string; lng?: string; type?: string };
      if (lat && lng) {
        const facilities = await healthDataService.getNearbyFacilities(
          parseFloat(lat),
          parseFloat(lng),
          type
        );
        res.json(facilities);
      } else {
        const facilities = await storage.getHealthFacilities(type);
        res.json(facilities);
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to fetch health facilities" });
    }
  });

  // -------------------------------
  // Enhanced search (embedding-based)
  // -------------------------------
  app.post("/api/enhanced-search", async (req, res) => {
    try {
      const body = z.object({ query: z.string(), language: z.string().optional() }).parse(req.body);
      const { query, language = "en" } = body;

      const queryEmbedding = await getEmbedding(query);
      const faqs = await FAQ.find({});
      let bestMatch: typeof faqs[0] | null = null;
      let bestScore = -1;

      for (const faq of faqs) {
        const score = cosineSimilarity(queryEmbedding, faq.embedding);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = faq;
        }
      }

      res.json({
        message: bestMatch?.answer || "Sorry, I don't have an answer for that.",
        language,
        relatedEntries: [],
        recommendations: [],
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to process health query" });
    }
  });

  // -------------------------------
  // Voice transcription
  // -------------------------------
  app.post("/api/transcribe-voice", upload.single("audio"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Audio file is required" });
      const transcriptionResult = await whisper({ audio: req.file.buffer } as { audio: Buffer });
      res.json({ text: transcriptionResult.text });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to transcribe voice input" });
    }
  });

  // -------------------------------
  // User authentication
  // -------------------------------
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      if (!validatePhoneNumber(userData.phoneNumber)) return res.status(400).json({ message: "Invalid phone number format" });

      const formattedPhone = formatPhoneNumber(userData.phoneNumber);
      const existingUser = await storage.getUserByPhone(formattedPhone);
      if (existingUser) return res.status(400).json({ message: "User already exists" });

      const user = await storage.createUser({ ...userData, phoneNumber: formattedPhone });
      res.json({ user: { id: user.id, phoneNumber: user.phoneNumber, name: user.name } });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to register user" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const body = z.object({ phoneNumber: z.string() }).parse(req.body);
      const formattedPhone = formatPhoneNumber(body.phoneNumber);
      const user = await storage.getUserByPhone(formattedPhone);
      if (!user) return res.status(404).json({ message: "User not found" });

      const updatedUser = await storage.updateUser(user.id, { isAuthenticated: true });
      res.json({ user: { id: updatedUser!.id, phoneNumber: updatedUser!.phoneNumber, name: updatedUser!.name } });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to login user" });
    }
  });

  // -------------------------------
  // Chat messages
  // -------------------------------
  app.get("/api/chat-messages/:sessionId", async (req, res) => {
    try {
      const messages = await storage.getChatMessages(req.params.sessionId);
      res.json(messages);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  app.post("/api/chat-messages", async (req, res) => {
    try {
      const messageData = insertChatMessageSchema.parse(req.body);
      const message = await storage.createChatMessage(messageData);
      res.json(message);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to save chat message" });
    }
  });

  // -------------------------------
  // SMS / WhatsApp
  // -------------------------------
  app.post("/api/send-sms", async (req, res) => {
    try {
      const body = z.object({ to: z.string(), message: z.string(), language: z.string().optional() }).parse(req.body);
      if (!validatePhoneNumber(body.to)) return res.status(400).json({ message: "Invalid phone number" });

      const success = await sendSMS({ to: formatPhoneNumber(body.to), message: body.message, language: body.language });
      res.json(success ? { success: true } : { success: false });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to send SMS" });
    }
  });

  app.post("/api/send-whatsapp", async (req, res) => {
    try {
      const body = z.object({ to: z.string(), message: z.string(), language: z.string().optional(), mediaUrl: z.string().optional() }).parse(req.body);
      if (!validatePhoneNumber(body.to)) return res.status(400).json({ message: "Invalid phone number" });

      const success = await sendWhatsAppMessage({ to: formatPhoneNumber(body.to), message: body.message, language: body.language, mediaUrl: body.mediaUrl });
      res.json(success ? { success: true } : { success: false });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to send WhatsApp" });
    }
  });

  // -------------------------------
  // Doctors
  // -------------------------------
  app.get("/api/doctors", async (_req, res) => {
    try {
      const doctors = await storage.getDoctors();
      res.json(doctors);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to fetch doctors" });
    }
  });

  app.get("/api/doctors/:id", async (req, res) => {
    try {
      const doctor = await storage.getDoctor(req.params.id);
      if (!doctor) return res.status(404).json({ message: "Doctor not found" });
      res.json(doctor);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to fetch doctor" });
    }
  });

  app.post("/api/doctors", async (req, res) => {
    try {
      const doctorData = insertDoctorSchema.parse(req.body);
      const doctor = await storage.createDoctor(doctorData);
      res.json(doctor);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to create doctor" });
    }
  });

  app.put("/api/doctors/:id", async (req, res) => {
    try {
      const updates = insertDoctorSchema.partial().parse(req.body);
      const updatedDoctor = await storage.updateDoctor(req.params.id, updates);
      if (!updatedDoctor) return res.status(404).json({ message: "Doctor not found" });
      res.json(updatedDoctor);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to update doctor" });
    }
  });

  app.delete("/api/doctors/:id", async (req, res) => {
    try {
      await storage.deleteDoctor(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to delete doctor" });
    }
  });

  app.get("/api/doctors/search", async (req, res) => {
    try {
      const { specialization, language } = req.query as { specialization?: string; language?: string };
      let doctorsList = await storage.getDoctors();

      if (specialization) {
        doctorsList = doctorsList.filter((d: { specialization: string; }) => d.specialization.toLowerCase().includes(specialization.toLowerCase()));
      }
      if (language) {
        doctorsList = doctorsList.filter((d: { languages: string | string[]; }) => d.languages?.includes(language));
      }

      res.json(doctorsList);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to search doctors" });
    }
  });

  // -------------------------------
  // Temporary webhooks
  // -------------------------------
  app.post("/webhook/whatsapp", (_req, res) => res.json({ message: "WhatsApp webhook received" }));
  app.post("/webhook/sms", (_req, res) => res.json({ message: "SMS webhook received" }));

  // -------------------------------
  // Health check
  // -------------------------------
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      services: {
        database: "connected",
        twilio: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
        openai: false
      }
    });
  });

  return createServer(app);
}
