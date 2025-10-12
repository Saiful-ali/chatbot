const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { test } = require("./db");
require("dotenv").config();

const chatRoutes = require("./routes/chat");
const vaccineRoutes = require("./routes/vaccines");
const alertRoutes = require("./routes/alerts");

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (req, res) => res.json({ ok: true, service: "Public Health Chatbot" }));

app.use("/api/chat", chatRoutes);
app.use("/api/vaccines", vaccineRoutes);
app.use("/api/alerts", alertRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  await test();
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
