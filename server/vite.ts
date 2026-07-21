import express, { type Express } from "express";
import fs from "fs";
import type { Server } from "http";
import path from "path";
import { createServer as createViteServer } from "vite";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

export async function setupVite(app: Express, server: Server) {
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: { 
        server,
      },
    },
    appType: "spa",
  });

  app.use(vite.middlewares);

  app.use(async (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith("/api")) {
      return next();
    }

    // Skip health/monitoring routes
    if (req.path.startsWith("/health") || req.path.startsWith("/metrics")) {
      return next();
    }

    // Skip static assets - let Vite middleware handle them
    // Only serve HTML for routes without file extensions or explicitly .html
    const hasFileExtension = /\.[a-zA-Z0-9]+$/.test(req.path);
    if (hasFileExtension && !req.path.endsWith('.html')) {
      return next();
    }

    const url = req.originalUrl;

    try {
      let template = fs.readFileSync(
        path.resolve(process.cwd(), "index.html"),
        "utf-8",
      );

      template = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
