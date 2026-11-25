import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toNodeHandler } from "better-auth/node";
import compression from "compression";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import nunjucks from "nunjucks";
import { auth } from "./auth/index.js";
import { env } from "./config/env.js";
import { storeConfig } from "./config/store.js";
import { apiRouter } from "./routes/api.js";
import { seoRouter } from "./routes/seo.js";
import { storefrontRouter } from "./routes/storefront.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, "..");
const viewsDir = path.join(serverRoot, "views");
const publicDir = path.join(serverRoot, "public");

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);

  // Per-request CSP nonce for the tiny FOUC-prevention script in layout.njk
  app.use((_req, res, next) => {
    res.locals.cspNonce = crypto.randomBytes(16).toString("base64");
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "https://checkout.razorpay.com",
            (_req, res) => `'nonce-${(res as Response).locals.cspNonce as string}'`,
          ],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https://api.razorpay.com", "https://lumberjack.razorpay.com"],
          frameSrc: ["'self'", "https://api.razorpay.com"],
        },
      },
    }),
  );

  app.use(compression());

  // Mount Better Auth handler BEFORE express.json() so it owns its body stream
  app.all("/api/auth/*splat", toNodeHandler(auth));

  app.use(express.json({ limit: "256kb" }));
  app.use(express.urlencoded({ extended: false, limit: "64kb" }));

  const nunjucksEnv = nunjucks.configure(viewsDir, {
    autoescape: true,
    express: app,
    noCache: env.NODE_ENV === "development",
  });
  nunjucksEnv.addFilter("urlencode", (val: string) => encodeURIComponent(val));
  app.set("view engine", "njk");

  app.use(
    express.static(publicDir, {
      maxAge: env.NODE_ENV === "production" ? "30d" : 0,
      etag: true,
    }),
  );

  app.use(seoRouter);
  app.use("/api", apiRouter);
  app.use(storefrontRouter);

  // 404 fallback
  app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Route not found.",
        },
      });
      return;
    }
    res.status(404).render("pages/not-found.njk", {
      pageTitle: `Not found — ${storeConfig.name}`,
      pageDescription: "This page could not be found.",
      canonicalUrl: `${storeConfig.baseUrl}/`,
      noindex: true,
      store: {
        ...storeConfig,
        nameParts: { first: storeConfig.name, rest: "" },
      },
      ogImageUrl: `${storeConfig.baseUrl}${storeConfig.ogImagePath}`,
    });
  });

  // Error handler
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    console.error("Unhandled request error:", err);
    if (req.path.startsWith("/api/")) {
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Something went wrong on our end.",
        },
      });
      return;
    }
    res.status(500).type("text/plain").send("Internal server error");
  });

  return app;
}
