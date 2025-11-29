// server.js - UPDATED FOR WHATSAPP-WEB.JS
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const bodyParser = require("body-parser");
require("dotenv").config();
const path = require("path");

const { test } = require("./db");

// 📱 Initialize WhatsApp Web Service
const { initWhatsApp } = require("./services/whatsappService");
const whatsappClient = initWhatsApp();

// 💬 Message Handler
const { handleIncomingMessage } = require("./routes/whatsappHandler");

// Setup message listener for WhatsApp
whatsappClient.on('message', async (message) => {
  // Ignore group messages and status updates
  if (message.isGroupMsg || message.isStatus) return;
  
  // Handle incoming message
  await handleIncomingMessage(message);
});

// -------------------------------
// 📦 Import Routes
// -------------------------------
const chatRoutes = require("./routes/chat");
const alertsRoutes = require("./routes/alerts");
const vaccinesRoutes = require("./routes/vaccines");
const learnRoutes = require("./routes/learn");
const subscribeRoutes = require("./routes/subscribe");
const adminRoutes = require("./routes/admin");
const { router: whatsappRoutes } = require("./routes/whatsappHandler");
const ttsRoute = require("./routes/tts");

const startUpdater = require("./jobs/updater");
const { resolveLang } = require("./middleware/lang");
const nbRoutes = require("./routes/naiveBayes"); 
const { nbClassifier } = require("./utils/naiveBayes");
nbClassifier.loadModels();  

// -------------------------------
// 🚀 Initialize Express App
// -------------------------------
const app = express();

// -------------------------------
// ⚙️ Middleware Setup
// -------------------------------
app.use(cors());
app.use(morgan("dev"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use(resolveLang);

// ✅ Serve static files
app.use("/static", express.static(path.join(__dirname, "tmp")));

// -------------------------------
// 🏠 Root Route
// -------------------------------
app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "Public Health Chatbot",
    version: "3.0 - WhatsApp Web.js",
    message: "Backend service is running successfully.",
    whatsapp: whatsappClient ? "Connected" : "Initializing..."
  });
});

// -------------------------------
// 🌐 Web API Routes
// -------------------------------
app.use("/api/chat", chatRoutes);
app.use("/api/alerts", alertsRoutes);
app.use("/api/vaccines", vaccinesRoutes);
app.use("/api/learn", learnRoutes);
app.use("/api/tts", ttsRoute);
app.use("/api/subscribe", subscribeRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/whatsapp", whatsappRoutes); // ✅ WhatsApp status/control endpoints
app.use("/api/nb", nbRoutes); // <-- add this line


// -------------------------------
// ⚙️ Start Server
// -------------------------------
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  await test(); // Test PostgreSQL connection

  console.log("✅ PostgreSQL connected");
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log("📱 WhatsApp Web.js initializing... (scan QR code in console)");

  if (process.env.UPDATER_ENABLED === "true") {
    console.log("🔄 Auto-updater enabled...");
    startUpdater();
  } else {
    console.log("⏸️ Auto-updater disabled (manual admin updates only).");
  }
});