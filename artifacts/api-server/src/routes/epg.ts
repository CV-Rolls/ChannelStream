import { Router, type IRouter } from "express";
import { db, channelProgramsTable } from "@workspace/db";
import { gte, lte, and, inArray } from "drizzle-orm";
import {
  getCurrentProgram,
  getUpcomingPrograms,
  syncEpgBackground,
  getSyncStatus,
  GUIDE_BY_COUNTRY,
} from "../lib/epg-sync";
import { adminLimiter, requireAdminSecret } from "../middlewares/adminGuard";
import { z } from "zod/v4";

const router: IRouter = Router();

router.get("/epg/countries", (_req, res): void => {
  const countries = Object.keys(GUIDE_BY_COUNTRY)
    .filter((k) => k !== "UK")
    .sort();
  res.json({ countries });
});

router.get("/epg/status", (_req, res): void => {
  res.json(getSyncStatus());
});

router.get("/epg/now/batch", async (req, res): Promise<void> => {
  const ids = req.query.ids;
  if (!ids || typeof ids !== "string") {
    res.status(400).json({ error: "ids query param required (comma-separated)" });
    return;
  }

  const channelIds = ids.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 200);
  if (channelIds.length === 0) {
    res.json({ programs: {} });
    return;
  }

  const now = new Date();

  const rows = await db
    .select()
    .from(channelProgramsTable)
    .where(
      and(
        lte(channelProgramsTable.start, now),
        gte(channelProgramsTable.end, now),
        inArray(channelProgramsTable.channelId, channelIds)
      )
    );

  const byChannel: Record<string, typeof rows[number]> = {};
  for (const row of rows) {
    if (!byChannel[row.channelId]) {
      byChannel[row.channelId] = row;
    }
  }

  res.json({ programs: byChannel });
});

router.get("/epg/:channelId", async (req, res): Promise<void> => {
  const { channelId } = req.params;
  if (!channelId) {
    res.status(400).json({ error: "channelId required" });
    return;
  }

  const [current, upcoming] = await Promise.all([
    getCurrentProgram(channelId),
    getUpcomingPrograms(channelId, 6),
  ]);

  res.json({ current: current ?? null, upcoming });
});

const KNOWN_COUNTRIES = new Set(Object.keys(GUIDE_BY_COUNTRY));

const EpgSyncBody = z.object({
  country: z.string().optional(),
});

router.post("/epg/sync", adminLimiter, requireAdminSecret, (req, res): void => {
  const parsed = EpgSyncBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const country = (parsed.data.country ?? "US").toUpperCase().slice(0, 3);
  if (!KNOWN_COUNTRIES.has(country)) {
    res.status(400).json({ error: `Unknown country code: ${country}` });
    return;
  }

  const status = getSyncStatus();

  if (status.status === "running") {
    res.json({ success: true, status: "already_running", country: status.country });
    return;
  }

  syncEpgBackground(country);
  res.json({ success: true, status: "started", country });
});

export default router;
