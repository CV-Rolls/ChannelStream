import { Router, type IRouter } from "express";
import { db, channelsTable, channelHealthTable } from "@workspace/db";
import { eq, ilike, and, sql, desc, count, inArray } from "drizzle-orm";
import {
  ListChannelsQueryParams,
  GetChannelParams,
  GetChannelResponse,
  GetChannelHealthParams,
  GetChannelHealthResponse,
  RefreshChannelsResponse,
} from "@workspace/api-zod";
import { syncChannels, runHealthChecks, enrichLogos, isCommunityRunning, getCommunityResult } from "../lib/iptv-sync";
import { adminLimiter, requireAdminSecret } from "../middlewares/adminGuard";
import { z } from "zod";

const router: IRouter = Router();

const QUALITY_MAP: Record<string, string[]> = {
  "4k":  ["2160p"],
  "fhd": ["1080p", "1280p"],
  "hd":  ["720p", "576p", "576i", "540p", "544p", "614p"],
  "sd":  ["480p", "360p", "240p", "270p", "288p", "320p", "349p", "396p", "400p", "404p",
          "406p", "416p", "432p", "220p", "214p", "226p", "160p", "600p", "504p"],
};

const ExtendedListParams = ListChannelsQueryParams.extend({
  country: z.string().optional(),
  quality: z.enum(["4k", "fhd", "hd", "sd"]).optional(),
  limit: z.coerce.number().int().min(1).max(2000).default(300),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get("/channels", async (req, res): Promise<void> => {
  const query = ExtendedListParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { region, country, category, search, onlineOnly, quality, limit, offset } = query.data;

  const conditions = [];

  if (region && region !== "all") {
    conditions.push(eq(channelsTable.region, region));
  }

  if (country) {
    conditions.push(eq(channelsTable.country, country.toUpperCase()));
  }

  if (category) {
    conditions.push(
      sql`${channelsTable.categories}::jsonb @> ${JSON.stringify([category])}::jsonb`
    );
  }

  if (search) {
    conditions.push(ilike(channelsTable.name, `%${search}%`));
  }

  if (onlineOnly) {
    conditions.push(eq(channelsTable.isOnline, true));
  }

  if (quality && QUALITY_MAP[quality]) {
    conditions.push(inArray(channelsTable.quality, QUALITY_MAP[quality]));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult, channels] = await Promise.all([
    db.select({ count: count() }).from(channelsTable).where(where),
    db
      .select()
      .from(channelsTable)
      .where(where)
      .orderBy(channelsTable.name)
      .limit(limit)
      .offset(offset),
  ]);

  const total = totalResult[0]?.count ?? 0;

  const mapped = channels.map(ch => ({
    id: ch.id,
    name: ch.name,
    logo: ch.logo,
    country: ch.country,
    region: ch.region,
    categories: ch.categories as string[],
    streamUrl: ch.streamUrl,
    streamUrls: (ch.streamUrls as string[]) || [],
    quality: ch.quality,
    isOnline: ch.isOnline,
    lastChecked: ch.lastChecked ?? null,
  }));

  res.json({ channels: mapped, total });
});

router.get("/channels/:channelId", async (req, res): Promise<void> => {
  const params = GetChannelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const raw = Array.isArray(params.data.channelId) ? params.data.channelId[0] : params.data.channelId;

  const [channel] = await db
    .select()
    .from(channelsTable)
    .where(eq(channelsTable.id, raw));

  if (!channel) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }

  const mapped = {
    id: channel.id,
    name: channel.name,
    logo: channel.logo,
    country: channel.country,
    region: channel.region,
    categories: channel.categories as string[],
    streamUrl: channel.streamUrl,
    streamUrls: (channel.streamUrls as string[]) || [],
    quality: channel.quality,
    isOnline: channel.isOnline,
    lastChecked: channel.lastChecked ?? null,
  };

  res.json(GetChannelResponse.parse(mapped));
});

router.get("/channels/:channelId/health", async (req, res): Promise<void> => {
  const params = GetChannelHealthParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid channel ID" });
    return;
  }

  const [channel] = await db
    .select({ id: channelsTable.id })
    .from(channelsTable)
    .where(eq(channelsTable.id, params.data.channelId));

  if (!channel) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }

  const [latestHealth] = await db
    .select()
    .from(channelHealthTable)
    .where(eq(channelHealthTable.channelId, params.data.channelId))
    .orderBy(desc(channelHealthTable.checkedAt))
    .limit(1);

  res.json(GetChannelHealthResponse.parse({
    channelId: channel.id,
    isOnline: latestHealth?.isOnline ?? false,
    streamUrl: latestHealth?.streamUrl ?? null,
    quality: latestHealth?.quality ?? null,
    lastChecked: latestHealth?.checkedAt ?? null,
  }));
});

router.post("/channels/refresh", adminLimiter, requireAdminSecret, async (_req, res): Promise<void> => {
  try {
    const count = await syncChannels();
    runHealthChecks().catch(e => console.error("Health check error after refresh:", e));
    res.json(RefreshChannelsResponse.parse({ message: "Refresh complete", channelsUpdated: count }));
  } catch {
    res.status(500).json({ error: "Failed to refresh channels" });
  }
});

router.post("/channels/enrich-logos", adminLimiter, requireAdminSecret, (_req, res): void => {
  enrichLogos()
    .then(updated => res.json({ success: true, updated }))
    .catch(() => res.status(500).json({ error: "Logo enrichment failed" }));
});

router.get("/channels/sync-community/status", adminLimiter, requireAdminSecret, (_req, res): void => {
  if (isCommunityRunning()) {
    res.json({ status: "running" });
    return;
  }
  const result = getCommunityResult();
  if (result) {
    res.json({ status: "done", ...result });
    return;
  }
  res.json({ status: "idle" });
});

export default router;
