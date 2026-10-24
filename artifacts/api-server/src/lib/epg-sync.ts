import { XMLParser } from "fast-xml-parser";
import { db, channelsTable, channelProgramsTable } from "@workspace/db";
import { eq, gte, lte, and, inArray, sql, like } from "drizzle-orm";

// ── EPG source definitions ────────────────────────────────────────────────────
//
// Two source types:
//  "exact_id"   — XMLTV channel IDs match iptv-org channel IDs exactly
//                 (Freeview-EPG uses the same <channel id="BBCOne.uk"> format)
//  "name_match" — XMLTV uses numeric/proprietary IDs; we match channels by
//                 display-name ↔ our channel name (normalised comparison)
//
type SourceType = "exact_id" | "name_match";

interface GuideSource {
  url: string;
  type: SourceType;
}

export const GUIDE_BY_COUNTRY: Record<string, GuideSource> = {
  // UK — Freeview-EPG: exact iptv-org channel IDs, updated every 12 h, 7-day window
  GB: { url: "https://raw.githubusercontent.com/dp247/Freeview-EPG/master/epg.xml", type: "exact_id" },
  UK: { url: "https://raw.githubusercontent.com/dp247/Freeview-EPG/master/epg.xml", type: "exact_id" },

  // All others — epg.pw per-country XMLTV, matched by channel name
  US: { url: "https://epg.pw/xmltv/epg_US.xml", type: "name_match" },
  FR: { url: "https://epg.pw/xmltv/epg_FR.xml", type: "name_match" },
  DE: { url: "https://epg.pw/xmltv/epg_DE.xml", type: "name_match" },
  ES: { url: "https://epg.pw/xmltv/epg_ES.xml", type: "name_match" },
  IT: { url: "https://epg.pw/xmltv/epg_IT.xml", type: "name_match" },
  NL: { url: "https://epg.pw/xmltv/epg_NL.xml", type: "name_match" },
  BR: { url: "https://epg.pw/xmltv/epg_BR.xml", type: "name_match" },
  TR: { url: "https://epg.pw/xmltv/epg_TR.xml", type: "name_match" },
  AU: { url: "https://epg.pw/xmltv/epg_AU.xml", type: "name_match" },
  CA: { url: "https://epg.pw/xmltv/epg_CA.xml", type: "name_match" },
  IN: { url: "https://epg.pw/xmltv/epg_IN.xml", type: "name_match" },
  RU: { url: "https://epg.pw/xmltv/epg_RU.xml", type: "name_match" },
  PL: { url: "https://epg.pw/xmltv/epg_PL.xml", type: "name_match" },
  RO: { url: "https://epg.pw/xmltv/epg_RO.xml", type: "name_match" },
  GR: { url: "https://epg.pw/xmltv/epg_GR.xml", type: "name_match" },
  PT: { url: "https://epg.pw/xmltv/epg_PT.xml", type: "name_match" },
  AR: { url: "https://epg.pw/xmltv/epg_AR.xml", type: "name_match" },
  MX: { url: "https://epg.pw/xmltv/epg_MX.xml", type: "name_match" },
  SE: { url: "https://epg.pw/xmltv/epg_SE.xml", type: "name_match" },
  NO: { url: "https://epg.pw/xmltv/epg_NO.xml", type: "name_match" },
  DK: { url: "https://epg.pw/xmltv/epg_DK.xml", type: "name_match" },
  FI: { url: "https://epg.pw/xmltv/epg_FI.xml", type: "name_match" },
  CZ: { url: "https://epg.pw/xmltv/epg_CZ.xml", type: "name_match" },
  HU: { url: "https://epg.pw/xmltv/epg_HU.xml", type: "name_match" },
  UA: { url: "https://epg.pw/xmltv/epg_UA.xml", type: "name_match" },
  ZA: { url: "https://epg.pw/xmltv/epg_ZA.xml", type: "name_match" },
  JP: { url: "https://epg.pw/xmltv/epg_JP.xml", type: "name_match" },
  KR: { url: "https://epg.pw/xmltv/epg_KR.xml", type: "name_match" },
  CN: { url: "https://epg.pw/xmltv/epg_CN.xml", type: "name_match" },
  IL: { url: "https://epg.pw/xmltv/epg_IL.xml", type: "name_match" },
  SA: { url: "https://epg.pw/xmltv/epg_SA.xml", type: "name_match" },
  ID: { url: "https://epg.pw/xmltv/epg_ID.xml", type: "name_match" },
  MY: { url: "https://epg.pw/xmltv/epg_MY.xml", type: "name_match" },
  TH: { url: "https://epg.pw/xmltv/epg_TH.xml", type: "name_match" },
};

// ── Sync state ────────────────────────────────────────────────────────────────

type SyncStatus = {
  status: "idle" | "running" | "done" | "error";
  country?: string;
  inserted?: number;
  error?: string;
  startedAt?: Date;
  finishedAt?: Date;
};

const syncState: SyncStatus = { status: "idle" };

export function getSyncStatus(): SyncStatus {
  return { ...syncState };
}

// ── XMLTV date parsing ────────────────────────────────────────────────────────

function parseXmltvDate(s: string): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?$/);
  if (!m) return null;
  const [, y, mo, d, h, min, sec, tz] = m;
  const offset = tz
    ? parseInt(tz.slice(0, 3)) * 60 + parseInt(tz.slice(3))
    : 0;
  const utc = Date.UTC(+y, +mo - 1, +d, +h, +min, +sec) - offset * 60 * 1000;
  return new Date(utc);
}

// ── Channel name normalisation (for name_match sources) ───────────────────────

function normaliseName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(hd|sd|4k|fhd|uhd)\b/g, "")   // strip quality suffixes
    .replace(/[^a-z0-9]/g, "")                   // strip everything non-alphanumeric
    .trim();
}

// ── Raw XMLTV structures ──────────────────────────────────────────────────────

interface XmltvChannel {
  epgId: string;        // value from <channel id="...">
  displayName: string;  // from <display-name>
  normName: string;     // normalised display-name for matching
}

interface ParsedProgram {
  channelId: string;    // our DB channel ID (resolved after matching)
  title: string;
  description?: string;
  start: Date;
  end: Date;
  category?: string;
  episode?: string;
  icon?: string;
}

// ── XML parsing ───────────────────────────────────────────────────────────────

function parseXmltvDoc(xml: string): { channels: XmltvChannel[]; programs: ParsedProgram[] } {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (name) => ["channel", "programme", "display-name", "category", "episode-num"].includes(name),
    textNodeName: "#text",
  });

  let doc: any;
  try {
    doc = parser.parse(xml);
  } catch {
    return { channels: [], programs: [] };
  }

  const tv = doc?.tv;
  if (!tv) return { channels: [], programs: [] };

  // Parse channel entries
  const channels: XmltvChannel[] = [];
  for (const ch of tv.channel ?? []) {
    const epgId = ch["@_id"] as string;
    if (!epgId) continue;
    const dnNode = ch["display-name"];
    const displayName = typeof dnNode === "string"
      ? dnNode
      : Array.isArray(dnNode)
        ? (typeof dnNode[0] === "string" ? dnNode[0] : dnNode[0]?.["#text"] ?? "")
        : "";
    channels.push({ epgId, displayName: String(displayName), normName: normaliseName(String(displayName)) });
  }

  // Parse programmes
  const rawPrograms: Array<{ epgId: string; prog: ParsedProgram }> = [];
  for (const prog of tv.programme ?? []) {
    const epgId   = prog["@_channel"] as string;
    const startStr = prog["@_start"] as string;
    const stopStr  = prog["@_stop"]  as string;
    if (!epgId || !startStr || !stopStr) continue;

    const start = parseXmltvDate(startStr);
    const end   = parseXmltvDate(stopStr);
    if (!start || !end) continue;

    const titleNode = prog.title;
    const title = typeof titleNode === "string"
      ? titleNode
      : Array.isArray(titleNode)
        ? (titleNode[0]?.["#text"] ?? titleNode[0] ?? "")
        : (titleNode?.["#text"] ?? titleNode ?? "Unknown");

    const descNode = prog.desc;
    const description = typeof descNode === "string"
      ? descNode
      : (descNode?.["#text"] ?? undefined);

    const catArr = prog.category;
    const category = catArr
      ? (typeof catArr[0] === "string" ? catArr[0] : catArr[0]?.["#text"])
      : undefined;

    const epArr = prog["episode-num"];
    const episode = epArr
      ? (typeof epArr[0] === "string" ? epArr[0] : epArr[0]?.["#text"])
      : undefined;

    const icon = prog.icon?.["@_src"] ?? undefined;

    rawPrograms.push({
      epgId,
      prog: {
        channelId: epgId, // will be replaced after ID resolution
        title: String(title),
        description: description ? String(description) : undefined,
        start,
        end,
        category: category ? String(category) : undefined,
        episode: episode ? String(episode) : undefined,
        icon: icon ? String(icon) : undefined,
      },
    });
  }

  return { channels, programs: rawPrograms.map((r) => r.prog) };
}

// ── Core sync function ────────────────────────────────────────────────────────

export async function syncEpgForCountry(country: string): Promise<number> {
  const code   = country.toUpperCase();
  const source = GUIDE_BY_COUNTRY[code];
  if (!source) return 0;

  console.log(`[epg-sync] Fetching EPG for ${code} from ${source.url} (${source.type})`);

  let xml: string;
  try {
    const res = await fetch(source.url, {
      headers: { "Accept-Encoding": "gzip, deflate", "User-Agent": "NetStream/1.0" },
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) {
      console.warn(`[epg-sync] ${code}: HTTP ${res.status} from ${source.url}`);
      return 0;
    }
    xml = await res.text();
  } catch (err) {
    console.warn(`[epg-sync] ${code}: fetch failed —`, err);
    return 0;
  }

  const { channels: epgChannels, programs: rawPrograms } = parseXmltvDoc(xml);
  if (rawPrograms.length === 0) {
    console.warn(`[epg-sync] ${code}: parsed 0 programmes from EPG feed`);
    return 0;
  }

  console.log(`[epg-sync] ${code}: parsed ${epgChannels.length} EPG channels, ${rawPrograms.length} programmes`);

  // ── Build EPG-id → our DB channel-id mapping ─────────────────────────────

  let epgIdToOurId: Map<string, string>;

  if (source.type === "exact_id") {
    // Freeview-EPG: their channel IDs ARE our channel IDs
    const epgIds = [...new Set(rawPrograms.map((p) => p.channelId))];
    const matched = await db
      .select({ id: channelsTable.id })
      .from(channelsTable)
      .where(inArray(channelsTable.id, epgIds));
    epgIdToOurId = new Map(matched.map((c) => [c.id, c.id]));
  } else {
    // epg.pw: numeric IDs — match by display-name
    const epgNameMap = new Map<string, string>(); // normName → epgId
    for (const ch of epgChannels) {
      if (!epgNameMap.has(ch.normName)) {
        epgNameMap.set(ch.normName, ch.epgId);
      }
    }

    // Pull all our channels for this country (or all if country can't be inferred)
    const ourChannels = await db
      .select({ id: channelsTable.id, name: channelsTable.name })
      .from(channelsTable)
      .where(like(channelsTable.id, `%.${code.toLowerCase()}`) );

    epgIdToOurId = new Map<string, string>();
    for (const ch of ourChannels) {
      const norm = normaliseName(ch.name);
      const epgId = epgNameMap.get(norm);
      if (epgId) {
        epgIdToOurId.set(epgId, ch.id);
      }
    }
    console.log(`[epg-sync] ${code}: name-matched ${epgIdToOurId.size} / ${ourChannels.length} channels`);
  }

  if (epgIdToOurId.size === 0) {
    console.warn(`[epg-sync] ${code}: no channels matched`);
    return 0;
  }

  // ── Filter & remap programmes ─────────────────────────────────────────────

  const now    = new Date();
  const future = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const toInsert = rawPrograms
    .filter((p) => {
      const ourId = epgIdToOurId.get(p.channelId);
      return ourId && p.end > now && p.start < future;
    })
    .map((p) => ({
      id:          `${epgIdToOurId.get(p.channelId)}|${p.start.getTime()}`,
      channelId:   epgIdToOurId.get(p.channelId)!,
      title:       p.title,
      description: p.description ?? null,
      start:       p.start,
      end:         p.end,
      category:    p.category ?? null,
      episode:     p.episode ?? null,
      icon:        p.icon ?? null,
    }));

  if (toInsert.length === 0) {
    console.warn(`[epg-sync] ${code}: 0 programmes to insert after filtering`);
    return 0;
  }

  const BATCH = 200;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    await db
      .insert(channelProgramsTable)
      .values(toInsert.slice(i, i + BATCH))
      .onConflictDoUpdate({
        target: channelProgramsTable.id,
        set: {
          title:       sql`excluded.title`,
          description: sql`excluded.description`,
          start:       sql`excluded.start`,
          end:         sql`excluded.end`,
          category:    sql`excluded.category`,
          episode:     sql`excluded.episode`,
          icon:        sql`excluded.icon`,
        },
      });
  }

  console.log(`[epg-sync] ${code}: inserted/updated ${toInsert.length} programmes`);
  return toInsert.length;
}

// ── Background runner (single country, rate-limited) ─────────────────────────

export function syncEpgBackground(country: string): void {
  if (syncState.status === "running") return;
  syncState.status    = "running";
  syncState.country   = country.toUpperCase();
  syncState.startedAt = new Date();
  syncState.inserted  = 0;
  syncState.error     = undefined;

  syncEpgForCountry(country)
    .then((count) => {
      syncState.status     = "done";
      syncState.inserted   = count;
      syncState.finishedAt = new Date();
    })
    .catch((err) => {
      syncState.status     = "error";
      syncState.error      = err instanceof Error ? err.message : String(err);
      syncState.finishedAt = new Date();
    });
}

// ── Auto-sync on startup: kick off a few priority countries in sequence ───────
// Runs quietly in background; doesn't block server startup.

export async function autoSyncEpg(): Promise<void> {
  const priority = ["GB", "US", "AU", "CA", "FR", "DE", "IN"];
  for (const country of priority) {
    try {
      await syncEpgForCountry(country);
    } catch (err) {
      console.warn(`[epg-sync] auto-sync failed for ${country}:`, err);
    }
    // Small delay between countries to avoid hammering the source
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log("[epg-sync] Auto-sync complete for priority countries");
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export async function getCurrentProgram(channelId: string) {
  const now = new Date();
  const rows = await db
    .select()
    .from(channelProgramsTable)
    .where(
      and(
        eq(channelProgramsTable.channelId, channelId),
        lte(channelProgramsTable.start, now),
        gte(channelProgramsTable.end, now)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getUpcomingPrograms(channelId: string, limit = 5) {
  const now = new Date();
  return db
    .select()
    .from(channelProgramsTable)
    .where(
      and(
        eq(channelProgramsTable.channelId, channelId),
        gte(channelProgramsTable.start, now)
      )
    )
    .orderBy(channelProgramsTable.start)
    .limit(limit);
}
