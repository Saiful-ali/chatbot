import "dotenv/config"; 
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import mongoose from "mongoose";

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors({ origin: "http://localhost:5173", credentials: true }));

// Logging
app.use((req, res, next) => {
  const start = Date.now();
  const originalJson = res.json;
  res.json = function (body, ...args) {
    const result = originalJson.apply(res, [body, ...args]);
    if (req.path.startsWith("/api")) {
      const duration = Date.now() - start;
      log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms :: ${JSON.stringify(body)}`);
    }
    return result;
  };
  next();
});

(async () => {
  // Connect to MongoDB
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/chatbot";
  try {
    await mongoose.connect(mongoUri, { autoIndex: true });
    log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }

  // Register API routes
  const server = await registerRoutes(app);

  // Error handler middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  // Setup Vite or serve static
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  const serverInstance = server.listen(port, "localhost", () => {
    log(`Backend running on http://localhost:${port}`);
  });

  // Graceful shutdown
  const gracefulShutdown = (signal: string) => {
    log(`Received ${signal}. Shutting down gracefully...`);
    serverInstance.close((err) => {
      if (err) {
        log(`Error during shutdown: ${err.message}`);
        process.exit(1);
      }
      log('Server closed successfully');
      process.exit(0);
    });

    setTimeout(() => {
      log('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'));
  process.on('uncaughtException', (err) => {
    log(`Uncaught Exception: ${err.message}`);
    gracefulShutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason, promise) => {
    log(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
    gracefulShutdown('unhandledRejection');
  });
})();
