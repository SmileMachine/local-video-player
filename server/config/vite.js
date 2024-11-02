import path from "path";
import express from "express";

export async function setupVite(app, isDev) {
  if (isDev) {
    // Vite is used to serve the frontend under development
    const vite = await import("vite");
    const viteServer = await vite.createServer({
      server: { middlewareMode: true },
      appType: "spa", // Single Page Application
    });

    app.use(viteServer.middlewares);
  } else {
    // Under production, use express to serve the frontend
    app.use(express.static(path.resolve("dist")));
  }
}
