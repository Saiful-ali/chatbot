import express, { type Express } from "express";
import * as fs from "fs";
import * as path from "path";
import { type Server } from "http";
import { nanoid } from "nanoid";
import { fileURLToPath } from "url";

// Node-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple logger for Vite
const viteLogger = console;

// Logger utility
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

// Setup Vite dev middleware
export async function setupVite(app: Express, nodeServer: Server) {

  const viteModule: any = await import("vite");
  const createServer = viteModule.createServer as (options?: any) => Promise<any>;

  const viteServer = await createServer({
    configFile: path.resolve(__dirname, "../client/vite.config.ts"),
    root: path.resolve(__dirname, "../client"),
    server: {
      middlewareMode: true,
      allowedHosts: true,
    },
    appType: "custom",
    customLogger: viteLogger,
  });

  app.use(viteServer.middlewares);

  // Catch-all middleware for SPA routes
  app.use(async (req, res, next) => {
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/webhook") ||
      req.method !== "GET"
    ) {
      return next();
    }

    try {
      const clientTemplate = path.resolve(__dirname, "..", "client", "index.html");
      let template = await fs.promises.readFile(clientTemplate, "utf-8");

      // HMR cache-busting
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );

      const page = await viteServer.transformIndexHtml(req.originalUrl, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      viteServer.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

// Serve static production build
export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "..", "client", "dist");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}. Make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // SPA fallback
  app.use((req, res, next) => {
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/webhook") ||
      req.method !== "GET"
    ) {
      return next();
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
