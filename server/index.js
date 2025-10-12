// -------------------------------
// 🩺 Public Health Chatbot Backend
// -------------------------------

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const bodyParser = require("body-parser");
require("dotenv").config();
const path = require("path");

const { test } = require("./db");

// -------------------------------
// 📦 Import Routes
// -------------------------------
const chatRoutes = require("./routes/chat");
const alertsRoutes = require("./routes/alerts");
const vaccinesRoutes = require("./routes/vaccines");
const learnRoutes = require("./routes/learn");
const subscribeRoutes = require("./routes/subscribe");
const adminRoutes = require("./routes/admin");         // 🧑‍💼 Admin dashboard route
const twilioWebhook = require("./routes/twilioWebhook"); // 💬 WhatsApp Twilio webhook
const ttsRoute = require("./routes/tts");               // 🎧 Text-to-Speech route

const startUpdater = require("./jobs/updater");         // Optional background job
const { resolveLang } = require("./middleware/lang");   // 🌐 Language middleware

// -------------------------------
// 🚀 Initialize Express App
// -------------------------------
const app = express();

// -------------------------------
// ⚙️ Middleware Setup
// -------------------------------
app.use(cors());
app.use(morgan("dev"));
app.use(bodyParser.urlencoded({ extended: false })); // For Twilio x-www-form-urlencoded
app.use(express.json());
app.use(resolveLang); // 🌐 Auto-detect language (query/header/DB)

// ✅ Serve static files (for generated MP3s, images, etc.)
app.use("/static", express.static(path.join(__dirname, "tmp")));

// -------------------------------
// 🏠 Root Route
// -------------------------------
app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "Public Health Chatbot",
    version: "2.0",
    message: "Backend service is running successfully.",
  });
});

// -------------------------------
// 🌐 Web API Routes
// -------------------------------
app.use("/api/chat", chatRoutes);          // 💬 Intelligent chatbot (FAQ + multilingual)
app.use("/api/alerts", alertsRoutes);      // 🚨 Health alerts (disease, disaster)
app.use("/api/vaccines", vaccinesRoutes);  // 💉 Vaccine information
app.use("/api/learn", learnRoutes);        // 📚 Educational health content
app.use("/api/tts", ttsRoute);             // 🎤 Text-to-Speech endpoint (NEW)
app.use("/api/subscribe", subscribeRoutes);// 📲 User subscriptions
app.use("/api/admin", adminRoutes);        // 🧑‍💼 Admin dashboard

// -------------------------------
// 💬 WhatsApp Webhook (Twilio)
// -------------------------------
app.use("/twilio/whatsapp", twilioWebhook); // ✅ Handles incoming WhatsApp messages

// -------------------------------
// ⚙️ Start Server
// -------------------------------
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  await test(); // Test PostgreSQL connection

  console.log("✅ PostgreSQL connected");
  console.log(`🚀 Server running at http://localhost:${PORT}`);

  if (process.env.UPDATER_ENABLED === "true") {
    console.log("🔄 Auto-updater enabled...");
    startUpdater();
  } else {
    console.log("⏸️ Auto-updater disabled (manual admin updates only).");
  }
});
