import { db, channelsTable, channelHealthTable } from "@workspace/db";
import { eq, sql, and, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

// ─── Quality resolution ranking ──────────────────────────────────────────────
const QUALITY_RANKS: Record<string, number> = {
  "2160p": 100, "4k": 100,
  "1440p": 90,
  "1080p": 80, "1080i": 75,
  "720p":  60,
  "576p":  50, "576i": 48,
  "544p":  45, "540p": 44,
  "480p":  40,
  "404p":  35, "400p": 34, "396p": 33,
  "360p":  30,
  "270p":  20,
  "240p":  15,
  "160p":  10,
};

function extractQualityFromTitle(title: string): { label: string; rank: number } {
  const m = title.match(/\((\d+[pi])\)/i);
  if (m) {
    const label = m[1].toLowerCase();
    return { label, rank: QUALITY_RANKS[label] ?? 5 };
  }
  return { label: "", rank: 5 };
}

interface CommunityFeed {
  name:        string;
  logo:        string;
  categories:  string[];
  streamUrl:   string;
  qualityLabel: string;
  qualityRank: number;
  isGeoBlocked: boolean;
  feed:        string;      // raw @suffix e.g. "SD", "HD", "Plus1"
}

interface IptvChannel {
  id: string;
  name: string;
  alt_names: string[];
  network: string | null;
  owners: string[];
  country: string;
  languages: string[];
  categories: string[];
  is_nsfw: boolean;
  launched: string | null;
  closed: string | null;
  replaced_by: string | null;
  website: string | null;
}

interface IptvStream {
  channel: string;
  feed: string;
  title: string;
  url: string;
  quality: string | null;
  user_agent: string | null;
  referrer: string | null;
}

function getRegion(channel: IptvChannel): string {
  if (
    channel.country === "ZA" &&
    channel.categories.some(c => c.toLowerCase() === "sports")
  ) {
    return "za-sport";
  }
  if (channel.country === "UK") {
    const langs = channel.languages || [];
    if (
      langs.length === 0 ||
      langs.some(l => l.toLowerCase() === "eng" || l.toLowerCase() === "english")
    ) {
      return "uk";
    }
  }
  return channel.country.toLowerCase();
}

function isHls(url: string): boolean {
  const path = url.split("?")[0].toLowerCase();
  return path.endsWith(".m3u8") || path.endsWith(".m3u");
}

function pickBestStream(streams: IptvStream[]): IptvStream | null {
  if (streams.length === 0) return null;
  const qualityOrder = ["1080p", "720p", "576p", "480p", "360p", "240p"];

  // HLS (.m3u8) always preferred over DASH (.mpd) — our player only supports HLS
  const hlsFirst = [...streams].sort((a, b) => {
    const aHls = isHls(a.url) ? 0 : 1;
    const bHls = isHls(b.url) ? 0 : 1;
    if (aHls !== bHls) return aHls - bHls;
    const aIdx = qualityOrder.indexOf(a.quality || "");
    const bIdx = qualityOrder.indexOf(b.quality || "");
    const aRank = aIdx === -1 ? 999 : aIdx;
    const bRank = bIdx === -1 ? 999 : bIdx;
    return aRank - bRank;
  });

  return hlsFirst[0];
}

function parseM3uLogos(m3u: string, logoMap: Map<string, string>): void {
  const lines = m3u.split("\n");
  for (const line of lines) {
    if (!line.startsWith("#EXTINF:")) continue;
    const tvgIdMatch = line.match(/tvg-id="([^"]+)"/);
    const logoMatch = line.match(/tvg-logo="([^"]+)"/);
    if (tvgIdMatch && logoMatch && logoMatch[1]) {
      const fullId = tvgIdMatch[1];
      const baseId = fullId.split("@")[0];
      logoMap.set(baseId, logoMatch[1]);
    }
  }
}

function parseM3uStreams(m3u: string, streamMap: Map<string, string[]>): void {
  const lines = m3u.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("#EXTINF:")) continue;
    const tvgIdMatch = line.match(/tvg-id="([^"]+)"/);
    const nextLine = lines[i + 1]?.trim();
    if (tvgIdMatch && nextLine && nextLine.startsWith("http")) {
      const id = tvgIdMatch[1].split("@")[0];
      const existing = streamMap.get(id) || [];
      if (!existing.includes(nextLine)) {
        existing.push(nextLine);
        streamMap.set(id, existing);
      }
    }
  }
}

async function fetchLogosForCountries(countryCodes: string[]): Promise<Map<string, string>> {
  const logoMap = new Map<string, string>();

  // Build URLs: per-country M3U + category M3U files
  const countryUrls = countryCodes.map(
    cc => `https://iptv-org.github.io/iptv/countries/${cc.toLowerCase()}.m3u`
  );
  const categoryUrls = [
    "https://iptv-org.github.io/iptv/categories/sports.m3u",
    "https://iptv-org.github.io/iptv/categories/news.m3u",
    "https://iptv-org.github.io/iptv/categories/entertainment.m3u",
    "https://iptv-org.github.io/iptv/categories/movies.m3u",
    "https://iptv-org.github.io/iptv/categories/kids.m3u",
    "https://iptv-org.github.io/iptv/categories/music.m3u",
    "https://iptv-org.github.io/iptv/categories/series.m3u",
    "https://iptv-org.github.io/iptv/categories/documentary.m3u",
    "https://iptv-org.github.io/iptv/categories/outdoor.m3u",
    "https://iptv-org.github.io/iptv/categories/classic.m3u",
    "https://iptv-org.github.io/iptv/categories/animation.m3u",
  ];
  const allUrls = [...countryUrls, ...categoryUrls];

  // Fetch in parallel batches of 30 to avoid hammering the CDN
  const BATCH = 30;
  for (let i = 0; i < allUrls.length; i += BATCH) {
    const batch = allUrls.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(url =>
        fetch(url, { signal: AbortSignal.timeout(12000) })
          .then(r => (r.ok ? r.text() : ""))
          .catch(() => "")
      )
    );
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        parseM3uLogos(result.value, logoMap);
      }
    }
  }

  console.log(`[iptv-sync] Fetched logos for ${logoMap.size} channels`);
  return logoMap;
}

export async function enrichLogos(): Promise<number> {
  console.log("[iptv-sync] Running logo enrichment for all channels...");

  // Get all distinct country codes from DB
  const rows = await db
    .selectDistinct({ country: channelsTable.country })
    .from(channelsTable);
  const codes = rows.map(r => r.country).filter(Boolean);

  const logoMap = await fetchLogosForCountries(codes);
  if (logoMap.size === 0) return 0;

  let updated = 0;
  const entries = [...logoMap.entries()];
  const BATCH = 100;
  for (let i = 0; i < entries.length; i += BATCH) {
    const slice = entries.slice(i, i + BATCH);
    for (const [channelId, logo] of slice) {
      const result = await db
        .update(channelsTable)
        .set({ logo })
        .where(and(eq(channelsTable.id, channelId), sql`logo IS NULL`));
      if ((result as any).rowCount > 0) updated++;
    }
  }

  console.log(`[iptv-sync] Logo enrichment done: filled ${updated} missing logos`);
  return updated;
}

async function fetchExtraStreams(): Promise<Map<string, string[]>> {
  const streamMap = new Map<string, string[]>();
  const sources = [
    "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8",
  ];
  const results = await Promise.allSettled(
    sources.map(url => fetch(url, { signal: AbortSignal.timeout(15000) }).then(r => r.text()))
  );
  for (const result of results) {
    if (result.status === "fulfilled") {
      parseM3uStreams(result.value, streamMap);
    }
  }
  console.log(`[iptv-sync] Extra backup streams for ${streamMap.size} channels`);
  return streamMap;
}

export async function syncChannels(): Promise<number> {
  console.log("[iptv-sync] Fetching channel data from iptv-org API...");

  const [channelsRes, streamsRes] = await Promise.all([
    fetch("https://iptv-org.github.io/api/channels.json"),
    fetch("https://iptv-org.github.io/api/streams.json"),
  ]);

  if (!channelsRes.ok || !streamsRes.ok) {
    throw new Error("Failed to fetch from iptv-org API");
  }

  const allChannels = await channelsRes.json() as IptvChannel[];
  const allStreams  = await streamsRes.json() as IptvStream[];

  const streamsByChannel = new Map<string, IptvStream[]>();
  for (const stream of allStreams) {
    if (!stream.channel) continue;
    const existing = streamsByChannel.get(stream.channel) || [];
    existing.push(stream);
    streamsByChannel.set(stream.channel, existing);
  }

  // Only include channels that have at least one stream
  const channelsWithStreams = allChannels.filter(
    ch => !ch.is_nsfw && !ch.closed && streamsByChannel.has(ch.id)
  );

  console.log(`[iptv-sync] ${channelsWithStreams.length} channels have streams (out of ${allChannels.length} total)`);

  // Collect all unique country codes from the channels we're about to sync
  const uniqueCountries = [...new Set(channelsWithStreams.map(ch => ch.country).filter(Boolean))];

  // Fetch logos and extra streams in parallel
  const [logoMap, extraStreamMap] = await Promise.all([
    fetchLogosForCountries(uniqueCountries),
    fetchExtraStreams(),
  ]);

  const channelRows = channelsWithStreams.map(ch => {
    const streams = streamsByChannel.get(ch.id) || [];
    const bestStream = pickBestStream(streams);

    const primaryUrls = streams.map(s => s.url).filter(Boolean);
    const extraUrls = extraStreamMap.get(ch.id) || [];
    const allUrls = [...new Set([...primaryUrls, ...extraUrls])];

    return {
      id: ch.id,
      name: ch.name,
      logo: logoMap.get(ch.id) ?? null,
      country: ch.country,
      region: getRegion(ch),
      languages: ch.languages || [],
      categories: ch.categories,
      streamUrl: bestStream?.url ?? null,
      streamUrls: allUrls,
      quality: bestStream?.quality ?? null,
      isOnline: allUrls.length > 0,
      lastChecked: null as Date | null,
    };
  });

  // Batch upsert — much faster than N+1 queries
  const BATCH = 200;
  for (let i = 0; i < channelRows.length; i += BATCH) {
    const batch = channelRows.slice(i, i + BATCH);
    await db
      .insert(channelsTable)
      .values(batch)
      .onConflictDoUpdate({
        target: channelsTable.id,
        set: {
          name: sql`excluded.name`,
          logo: sql`COALESCE(excluded.logo, ${channelsTable.logo})`,
          country: sql`excluded.country`,
          region: sql`excluded.region`,
          languages: sql`excluded.languages`,
          categories: sql`excluded.categories`,
          streamUrl: sql`excluded.stream_url`,
          streamUrls: sql`excluded.stream_urls`,
          quality: sql`excluded.quality`,
        },
      });
    process.stdout.write(`\r[iptv-sync] Upserted ${Math.min(i + BATCH, channelRows.length)}/${channelRows.length}`);
  }
  console.log(`\n[iptv-sync] Sync complete: ${channelRows.length} channels`);
  return channelRows.length;
}

export async function checkStreamHealth(streamUrl: string, timeoutMs = 6000): Promise<boolean> {
  // Reject DASH manifests immediately — our HLS-only player can't play them
  if (streamUrl.split("?")[0].toLowerCase().endsWith(".mpd")) return false;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(streamUrl, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "Range": "bytes=0-1023",
        "User-Agent": "Mozilla/5.0 (compatible; NetStream-Health/1.0)",
      },
    });
    clearTimeout(timer);

    if (response.status === 404 || response.status === 403 || response.status === 410) return false;
    if (!response.ok && response.status !== 206) return false;

    const lower = streamUrl.toLowerCase().split("?")[0];
    const isManifest = lower.endsWith(".m3u8") || lower.endsWith(".m3u")
      || lower.includes("/playlist") || lower.includes("/manifest")
      || lower.includes("index.m3u");

    if (isManifest) {
      const text = await response.text();
      const trimmed = text.trimStart();
      return trimmed.startsWith("#EXTM3U") || trimmed.startsWith("#EXT-X-");
    }

    return true;
  } catch {
    return false;
  }
}

let _healthRunning = false;

export async function runHealthChecks(): Promise<void> {
  if (_healthRunning) {
    console.log("[iptv-sync] Health check already running — skipping.");
    return;
  }
  _healthRunning = true;

  console.log("[iptv-sync] Starting health checks (channels with streams only)...");

  // Paginate DB reads — never pull all 8 k rows into memory at once
  const PAGE_SIZE  = 100; // rows fetched from DB per page
  const HTTP_BATCH = 8;   // concurrent HTTP health-check requests

  let offset   = 0;
  let checked  = 0;
  let promoted = 0;
  let total    = 0;

  try {
    // Get total count first so we can show progress
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(channelsTable)
      .where(sql`${channelsTable.streamUrl} IS NOT NULL`);
    total = Number(count);

    while (true) {
      // Fetch one page of channels — discard after processing
      const page = await db
        .select()
        .from(channelsTable)
        .where(sql`${channelsTable.streamUrl} IS NOT NULL`)
        .limit(PAGE_SIZE)
        .offset(offset);

      if (page.length === 0) break;

      // Process in small HTTP batches within the page
      for (let i = 0; i < page.length; i += HTTP_BATCH) {
        const batch = page.slice(i, i + HTTP_BATCH);
        const results = await Promise.all(
          batch.map(async (ch) => {
            if (!ch.streamUrl) return { id: ch.id, online: false, streamUrl: ch.streamUrl, activeUrl: ch.streamUrl, quality: ch.quality, error: "No stream URL", streamUrls: ch.streamUrls };

            const startTime = Date.now();
            let online = await checkStreamHealth(ch.streamUrl);
            let activeUrl = ch.streamUrl;

            // If primary failed, try backup streams — promote first working one
            if (!online && Array.isArray(ch.streamUrls) && (ch.streamUrls as string[]).length > 1) {
              const backups = (ch.streamUrls as string[]).filter((u: string) => u !== ch.streamUrl);
              for (const backup of backups.slice(0, 3)) {
                if (await checkStreamHealth(backup)) {
                  online    = true;
                  activeUrl = backup;
                  break;
                }
              }
            }

            const responseTimeMs = String(Date.now() - startTime);
            return { id: ch.id, online, streamUrl: ch.streamUrl, activeUrl, quality: ch.quality, responseTimeMs, error: online ? null : "Stream unreachable", streamUrls: ch.streamUrls };
          })
        );

        const now = new Date();
        for (const result of results) {
          if (result.online && result.activeUrl && result.activeUrl !== result.streamUrl) {
            const currentUrls: string[] = Array.isArray(result.streamUrls) ? (result.streamUrls as string[]) : [];
            const others = currentUrls.filter(u => u !== result.activeUrl);
            await db.update(channelsTable).set({
              isOnline: true,
              lastChecked: now,
              streamUrl:  result.activeUrl,
              streamUrls: [result.activeUrl, ...others] as string[],
            }).where(eq(channelsTable.id, result.id));
            promoted++;
          } else {
            await db.update(channelsTable).set({
              isOnline: result.online,
              lastChecked: now,
            }).where(eq(channelsTable.id, result.id));
          }

          await db.insert(channelHealthTable).values({
            id: randomUUID(),
            channelId: result.id,
            isOnline: result.online,
            streamUrl: result.activeUrl ?? result.streamUrl,
            quality: result.quality,
            responseTimeMs: result.responseTimeMs ?? null,
            errorMessage: result.error ?? null,
            checkedAt: now,
          });
        }

        checked += batch.length;
        process.stdout.write(`\r[iptv-sync] Health checked ${checked}/${total} (${promoted} backups promoted)`);
      }

      offset += PAGE_SIZE;
    }

    console.log(`\n[iptv-sync] Health check complete: ${checked} channels checked`);
  } finally {
    _healthRunning = false;
  }
}

// ─── Community M3U sync ───────────────────────────────────────────────────────
// Parses iptv-org's community index.m3u (community-contributed streams).
// Strategy:
//   • For channels ALREADY in DB: append community stream URLs as ordered backups.
//     Verified primary stream is never replaced.  Backups are sorted best→worst.
//   • For NEW channels (not in DB): insert with highest-quality feed as primary
//     stream and the rest ordered best-first in streamUrls.
//   • Logos: COALESCE — fill missing logos from community M3U, never overwrite.
//   • Geo-blocked feeds: included in backups but deprioritised as primary.
//   • Feeds with no valid base-ID (no country suffix like .de / .us) are skipped.
export async function syncCommunityChannels(): Promise<{ added: number; enriched: number }> {
  console.log("[community-sync] Fetching iptv-org community index.m3u...");

  const m3uText = await fetch("https://iptv-org.github.io/iptv/index.m3u", {
    signal: AbortSignal.timeout(90_000),
  })
    .then(r => (r.ok ? r.text() : ""))
    .catch(() => "");

  if (!m3uText) throw new Error("[community-sync] Failed to fetch community M3U");

  // ── Parse M3U → group feeds by base channel ID ───────────────────────────
  const feedsByChannel = new Map<string, CommunityFeed[]>();
  const lines = m3uText.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("#EXTINF:")) continue;

    const tvgId    = line.match(/tvg-id="([^"]+)"/)?.[1] ?? "";
    const logo     = line.match(/tvg-logo="([^"]*?)"/)?.[1] ?? "";
    const group    = line.match(/group-title="([^"]*?)"/)?.[1] ?? "";
    const rawTitle = line.match(/,(.+)$/)?.[1] ?? "";

    if (!tvgId) continue;

    const atIdx  = tvgId.indexOf("@");
    const baseId = atIdx === -1 ? tvgId : tvgId.slice(0, atIdx);
    const feed   = atIdx === -1 ? ""   : tvgId.slice(atIdx + 1);

    // Must have a 2-3 letter country suffix like .de, .us, .fr
    if (!/\.[a-z]{2,3}$/.test(baseId)) continue;

    // Locate stream URL (next line that starts with http, skipping VLC options)
    let streamUrl = "";
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const next = lines[j].trim();
      if (next.startsWith("http")) { streamUrl = next; break; }
    }
    if (!streamUrl) continue;

    const isGeoBlocked = rawTitle.includes("[Geo-blocked]") || rawTitle.includes("[Geo-Blocked]");
    const cleanName    = rawTitle.replace(/\s*\[.*?\]\s*/g, "").trim();
    const categories   = group ? group.split(";").map(c => c.trim().toLowerCase()).filter(Boolean) : [];
    const { label: qualityLabel, rank: baseRank } = extractQualityFromTitle(rawTitle);
    // Deprioritise geo-blocked and time-shifted feeds as primary stream
    const qualityRank = isGeoBlocked ? baseRank - 5 : feed === "Plus1" ? baseRank - 3 : baseRank;

    const entry: CommunityFeed = { name: cleanName, logo, categories, streamUrl, qualityLabel, qualityRank, isGeoBlocked, feed };
    const arr = feedsByChannel.get(baseId) ?? [];
    arr.push(entry);
    feedsByChannel.set(baseId, arr);
  }

  console.log(`[community-sync] Parsed ${feedsByChannel.size} unique channel IDs from community M3U`);

  // Sort each channel's feeds highest quality first
  for (const feeds of feedsByChannel.values()) {
    feeds.sort((a, b) => b.qualityRank - a.qualityRank);
  }

  // ── Load existing DB channels (id + current streamUrls + logo) ────────────
  const existingRows = await db
    .select({ id: channelsTable.id, streamUrls: channelsTable.streamUrls, logo: channelsTable.logo })
    .from(channelsTable);
  const existingById = new Map(existingRows.map(r => [r.id, r]));

  // ── Process in batches ────────────────────────────────────────────────────
  let added    = 0;
  let enriched = 0;
  const entries = [...feedsByChannel.entries()];
  const BATCH   = 100;

  for (let i = 0; i < entries.length; i += BATCH) {
    const slice = entries.slice(i, i + BATCH);

    for (const [channelId, feeds] of slice) {
      const bestFeed   = feeds[0];
      const allUrls    = feeds.map(f => f.streamUrl);
      const existing   = existingById.get(channelId);

      if (existing) {
        // ── Existing verified channel — add backups + fill logo ─────────────
        const existingUrls: string[] = Array.isArray(existing.streamUrls) ? existing.streamUrls : [];
        const newUrls = allUrls.filter(u => !existingUrls.includes(u));
        const needsLogoFill = !existing.logo && bestFeed.logo;

        if (newUrls.length > 0 || needsLogoFill) {
          // Merge: existing primary + existing backups + new community backups
          const merged = [...new Set([...existingUrls, ...newUrls])];
          await db
            .update(channelsTable)
            .set({
              streamUrls: merged as string[],
              logo: sql`COALESCE(${channelsTable.logo}, ${bestFeed.logo || null})`,
            })
            .where(eq(channelsTable.id, channelId));
          enriched++;
        }
      } else {
        // ── New channel from community M3U only ──────────────────────────────
        const countryMatch = channelId.match(/\.([a-z]{2,3})$/);
        const country = (countryMatch?.[1] ?? "").toUpperCase();
        if (!country) continue;

        await db
          .insert(channelsTable)
          .values({
            id:          channelId,
            name:        bestFeed.name,
            logo:        bestFeed.logo || null,
            country,
            region:      country.toLowerCase(),
            languages:   [],
            categories:  bestFeed.categories,
            streamUrl:   bestFeed.streamUrl,
            streamUrls:  allUrls,
            quality:     bestFeed.qualityLabel || null,
            isOnline:    true,
            lastChecked: null,
          })
          .onConflictDoNothing();
        added++;
      }
    }

    process.stdout.write(`\r[community-sync] Processed ${Math.min(i + BATCH, entries.length)}/${entries.length} channels`);
  }

  console.log(
    `\n[community-sync] Complete — ${added} new channels added, ${enriched} existing channels enriched with backup streams`,
  );
  return { added, enriched };
}

let syncInterval:      NodeJS.Timeout | null = null;
let healthInterval:    NodeJS.Timeout | null = null;
let communityInterval: NodeJS.Timeout | null = null;

// ── Community sync shared state (used by scheduler + optional admin routes) ──
let _communitySyncRunning = false;
let _communitySyncResult: { added: number; enriched: number; completedAt: string } | null = null;

export function isCommunityRunning():  boolean { return _communitySyncRunning; }
export function getCommunityResult()          { return _communitySyncResult; }

async function runCommunitySync(): Promise<void> {
  if (_communitySyncRunning) {
    console.log("[community-sync] Already running, skipping.");
    return;
  }
  _communitySyncRunning = true;
  _communitySyncResult  = null;
  try {
    const result = await syncCommunityChannels();
    _communitySyncResult = { ...result, completedAt: new Date().toISOString() };
  } catch (e) {
    console.error("[community-sync] Error:", e);
    _communitySyncResult = { added: 0, enriched: 0, completedAt: new Date().toISOString() };
  } finally {
    _communitySyncRunning = false;
  }
}

/**
 * startPeriodicSync — called once at server boot.
 *
 * Schedule (all runs are independent of user traffic):
 *   T+0s   : iptv-org channel sync (builds the verified channel catalog)
 *   T+2min : logo enrichment + community M3U sync (adds backup streams &
 *             ~1,300 community-only channels). Delayed so it doesn't compete
 *             with the initial sync's DB writes.
 *   Every 6h : re-sync iptv-org catalog
 *   Every 1h : stream health-checks (batched, ~8 k channels)
 *   Every 24h: re-run community sync (idempotent upserts — safe to repeat)
 *
 * With 10,000 concurrent users none of this code is triggered per request —
 * users only hit fast DB SELECT queries; all external API calls happen here.
 */
export function startPeriodicSync(): void {
  // ── Initial startup sequence — jobs run ONE AT A TIME to avoid OOM ────────
  // Order: catalog sync → logos → community → health checks → EPG
  // Each step awaits the previous so memory from one job is freed before the next.
  (async () => {
    try {
      await syncChannels();
    } catch (e) { console.error("[iptv-sync] Initial sync error:", e); }

    // Small breathing gap after the big catalog write
    await new Promise(r => setTimeout(r, 30_000));

    try {
      await enrichLogos();
    } catch (e) { console.error("[iptv-sync] Logo enrichment error:", e); }

    try {
      await runCommunitySync();
    } catch (e) { console.error("[iptv-sync] Community sync error:", e); }

    try {
      await runHealthChecks();
    } catch (e) { console.error("[iptv-sync] Initial health-check error:", e); }

    // EPG last — largest memory consumer; runs after health checks are done
    try {
      const { autoSyncEpg } = await import("./epg-sync");
      await autoSyncEpg();
    } catch (e) { console.error("[epg-sync] Auto-sync error:", e); }
  })();

  // ── Recurring: iptv-org catalog — every 6 h ───────────────────────────────
  syncInterval = setInterval(() => {
    syncChannels().catch(e => console.error("[iptv-sync] Sync error:", e));
  }, 6 * 60 * 60 * 1000);

  // ── Recurring: health checks — every 2 h (guard prevents overlaps) ────────
  healthInterval = setInterval(() => {
    runHealthChecks().catch(e => console.error("[iptv-sync] Health-check error:", e));
  }, 2 * 60 * 60 * 1000);

  // ── Recurring: community sync — every 24 h ───────────────────────────────
  communityInterval = setInterval(() => {
    runCommunitySync().catch(e => console.error("[iptv-sync] Community sync error:", e));
  }, 24 * 60 * 60 * 1000);
}
