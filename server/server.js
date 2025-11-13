const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const bodyParser = require("body-parser");
require("dotenv").config();
const path = require("path");

const { test } = require("./db");

// WhatsApp Service
const { initWhatsApp } = require("./services/whatsappService");
const { handleIncomingMessage } = require("./routes/whatsappHandler");

// Routes
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

const app = express();

// Middleware
app.use(cors());
app.use(morgan("dev"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use(resolveLang);
app.use("/static", express.static(path.join(__dirname, "tmp")));
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "Public Health Chatbot",
    version: "3.0 - WhatsApp Web.js"
  });
});

app.use("/api/chat", chatRoutes);
app.use("/api/alerts", alertsRoutes);
app.use("/api/vaccines", vaccinesRoutes);
app.use("/api/learn", learnRoutes);
app.use("/api/tts", ttsRoute);
app.use("/api/subscribe", subscribeRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/whatsapp", whatsappRoutes);

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  await test();
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log("📱 Initializing WhatsApp...");
  
  const whatsappClient = initWhatsApp();
  
  whatsappClient.on('message', async (message) => {
    if (message.isGroupMsg || message.isStatus) return;
    await handleIncomingMessage(message);
  });

  if (process.env.UPDATER_ENABLED === "true") {
    startUpdater();
  }
});