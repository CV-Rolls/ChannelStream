import { type Request, type Response, type NextFunction } from "express";
import { rateLimit } from "express-rate-limit";

// Tight rate limit for admin/mutation endpoints
export const adminLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Admin rate limit exceeded." },
});

// Secret-header guard for destructive / expensive endpoints.
// Set ADMIN_SECRET in the environment to enable these routes.
// If ADMIN_SECRET is not configured, all admin endpoints return 403.
export function requireAdminSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env["ADMIN_SECRET"];

  if (!secret) {
    res.status(403).json({ error: "Admin endpoints are disabled (ADMIN_SECRET not configured)." });
    return;
  }

  const provided = req.headers["x-admin-secret"];
  if (typeof provided !== "string" || provided !== secret) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  next();
}
