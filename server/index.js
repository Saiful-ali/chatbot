const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const bodyParser = require("body-parser");
require("dotenv").config();

const { test } = require("./db");
const chatRoutes = require("./routes/chat");
const alertsRoutes = require("./routes/alerts");
const vaccinesRoutes = require("./routes/vaccines");
const learnRoutes = require("./routes/learn");
const subscribeRoutes = require("./routes/subscribe");
const twilioWebhook = require("./routes/twilioWebhook");
const startUpdater = require("./jobs/updater");

const app = express();
app.use(cors());
app.use(morgan("dev"));
app.use(bodyParser.urlencoded({ extended: false })); // Twilio sends x-www-form-urlencoded
app.use(express.json());

app.get("/", (_req, res) => res.json({ ok: true, service: "Public Health Chatbot" }));

// Web APIs
app.use("/api/chat", chatRoutes);
app.use("/api/alerts", alertsRoutes);
app.use("/api/vaccines", vaccinesRoutes);
app.use("/api/learn", learnRoutes);
app.use("/api/subscribe", subscribeRoutes);

// Twilio inbound (WhatsApp)
app.post("/twilio/whatsapp", twilioWebhook);

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  await test();
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  if (process.env.UPDATER_ENABLED === "true") startUpdater();
});
