import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import router from "./routes";

const app: Express = express();

// ── 1. Strip server fingerprint + block indexing ─────────────────────────────
app.disable("x-powered-by");
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  next();
});

// ── 2. Security headers via Helmet ────────────────────────────────────────────
// CSP is intentionally permissive for media/img because this app streams
// video from hundreds of external CDN origins and loads logos from anywhere.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
        mediaSrc: ["'self'", "blob:", "https:", "http:"],
        connectSrc: ["'self'", "https:", "http:"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
        upgradeInsecureRequests: null,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
  })
);

// ── 3. CORS ───────────────────────────────────────────────────────────────────
// Proxy routes need a wildcard so HLS.js can load segments from any client.
// All other /api routes are same-origin only (Replit proxy ensures this).
const allowedOriginPattern = /\.replit\.dev$|\.janeway\.replit\.dev$|localhost/;

app.use("/api/proxy", cors({ origin: "*", methods: ["GET", "OPTIONS"] }));
app.use(
  "/api",
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOriginPattern.test(origin)) return cb(null, true);
      cb(new Error("Not allowed by CORS"));
    },
    credentials: false,
  })
);

// ── 4. Rate limiting ──────────────────────────────────────────────────────────
// Generous limits so normal use is never affected.
const windowMs = 60_000; // 1 minute window

// Proxy: HLS fetches many segments — 300/min per IP is ~5 req/s, ample
const proxyLimiter = rateLimit({
  windowMs,
  max: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many proxy requests, slow down." },
  skip: () => process.env.NODE_ENV === "development",
});

// Data API: generous for normal browsing; blocks scrapers
const dataLimiter = rateLimit({
  windowMs,
  max: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests." },
  skip: () => process.env.NODE_ENV === "development",
});

app.use("/api/proxy", proxyLimiter);
app.use("/api", dataLimiter);

// ── 5. Body parsing — explicit limits ────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: true, limit: "64kb" }));

// ── 6. Cache-Control per route ────────────────────────────────────────────────
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  const p = req.path;
  if (req.method !== "GET") return next();
  if (p.startsWith("/channels") || p.startsWith("/epg/now/batch")) {
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  } else if (p.startsWith("/epg")) {
    res.set("Cache-Control", "public, max-age=120, stale-while-revalidate=600");
  } else if (p.startsWith("/status")) {
    res.set("Cache-Control", "no-store");
  }
  next();
});

// ── 7. Routes ─────────────────────────────────────────────────────────────────
app.use("/api", router);

// ── 8. Global error handler — never leak stack traces ─────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const status = (err as { status?: number }).status ?? 500;
  const safe = status < 500 ? err.message : "Internal server error";
  res.status(status).json({ error: safe });
});

export default app;
