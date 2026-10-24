import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, Tv, RefreshCw, Play, CalendarDays, CheckCircle2, AlertCircle, Loader2,
} from "lucide-react";
import { useListChannels } from "@workspace/api-client-react";

const CELL_PX_PER_MIN = 4;
const HEADER_W = 200;
const WINDOW_MINS = 180;

const COUNTRY_OPTIONS: { code: string; label: string }[] = [
  { code: "US", label: "🇺🇸 USA" },
  { code: "GB", label: "🇬🇧 UK" },
  { code: "FR", label: "🇫🇷 France" },
  { code: "DE", label: "🇩🇪 Germany" },
  { code: "IT", label: "🇮🇹 Italy" },
  { code: "ES", label: "🇪🇸 Spain" },
  { code: "NL", label: "🇳🇱 Netherlands" },
  { code: "BR", label: "🇧🇷 Brazil" },
  { code: "TR", label: "🇹🇷 Turkey" },
  { code: "AU", label: "🇦🇺 Australia" },
  { code: "CA", label: "🇨🇦 Canada" },
  { code: "IN", label: "🇮🇳 India" },
  { code: "RU", label: "🇷🇺 Russia" },
  { code: "PL", label: "🇵🇱 Poland" },
  { code: "RO", label: "🇷🇴 Romania" },
  { code: "GR", label: "🇬🇷 Greece" },
  { code: "PT", label: "🇵🇹 Portugal" },
  { code: "AR", label: "🇦🇷 Argentina" },
  { code: "MX", label: "🇲🇽 Mexico" },
  { code: "SE", label: "🇸🇪 Sweden" },
  { code: "NO", label: "🇳🇴 Norway" },
  { code: "DK", label: "🇩🇰 Denmark" },
  { code: "FI", label: "🇫🇮 Finland" },
  { code: "CZ", label: "🇨🇿 Czechia" },
  { code: "HU", label: "🇭🇺 Hungary" },
  { code: "UA", label: "🇺🇦 Ukraine" },
  { code: "ZA", label: "🇿🇦 South Africa" },
  { code: "JP", label: "🇯🇵 Japan" },
  { code: "KR", label: "🇰🇷 South Korea" },
  { code: "CN", label: "🇨🇳 China" },
  { code: "IL", label: "🇮🇱 Israel" },
  { code: "SA", label: "🇸🇦 Saudi Arabia" },
  { code: "ID", label: "🇮🇩 Indonesia" },
  { code: "MY", label: "🇲🇾 Malaysia" },
  { code: "TH", label: "🇹🇭 Thailand" },
];

const CATEGORY_OPTIONS = [
  { value: "", label: "All" },
  { value: "news", label: "📰 News" },
  { value: "sports", label: "⚽ Sports" },
  { value: "entertainment", label: "🎬 Entertainment" },
  { value: "movies", label: "🎥 Movies" },
  { value: "music", label: "🎵 Music" },
  { value: "kids", label: "🧒 Kids" },
  { value: "documentary", label: "🎞 Documentary" },
  { value: "general", label: "📺 General" },
];

interface Program {
  id: string;
  channelId: string;
  title: string;
  start: string;
  end: string;
  category?: string | null;
}

type EpgMap = Record<string, Program[]>;

type SyncStatus = {
  status: "idle" | "running" | "done" | "error";
  country?: string;
  inserted?: number;
  error?: string;
};

function timeLabel(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function snapToHour(date: Date): Date {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

function useNow(interval = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}

async function fetchEpgBatch(ids: string[]): Promise<EpgMap> {
  if (ids.length === 0) return {};
  const batches = [];
  for (let i = 0; i < ids.length; i += 100) {
    batches.push(ids.slice(i, i + 100));
  }
  const result: EpgMap = {};
  for (const batch of batches) {
    const params = new URLSearchParams({ ids: batch.join(",") });
    const res = await fetch(`/api/epg/now/batch?${params}`);
    const data = res.ok ? await res.json() : { programs: {} };
    for (const [channelId, prog] of Object.entries(data.programs ?? {})) {
      result[channelId] = [prog as Program];
    }
  }
  return result;
}

export default function Guide() {
  const now = useNow();
  const windowStart = snapToHour(new Date(now.getTime() - 30 * 60_000));
  const windowEnd   = new Date(windowStart.getTime() + WINDOW_MINS * 60_000);

  const [epgMap, setEpgMap]         = useState<EpgMap>({});
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ status: "idle" });
  const [country, setCountry]       = useState("US");
  const [category, setCategory]     = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const queryCountry = country;
  const queryCategory = category || undefined;

  const { data, isLoading } = useListChannels({
    country: queryCountry,
    category: queryCategory,
    limit: 100,
    offset: 0,
  });
  const channels = data?.channels ?? [];

  const loadEpg = useCallback(async (chans: typeof channels) => {
    if (chans.length === 0) return;
    const map = await fetchEpgBatch(chans.map((c) => c.id));
    setEpgMap(map);
  }, []);

  useEffect(() => {
    loadEpg(channels);
  }, [channels.map((c) => c.id).join(",")]);

  // Auto-trigger EPG sync when page opens if no data loaded yet
  const autoSyncedRef = useRef(false);
  useEffect(() => {
    if (autoSyncedRef.current) return;
    if (syncStatus.status !== "idle") return;
    if (channels.length === 0) return;
    const hasEpg = Object.keys(epgMap).length > 0;
    if (!hasEpg) {
      autoSyncedRef.current = true;
      handleSync();
    }
  }, [channels.length, Object.keys(epgMap).length, syncStatus.status]);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const pollSyncStatus = useCallback(() => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/epg/status");
        const data: SyncStatus = await res.json();
        setSyncStatus(data);
        if (data.status === "done" || data.status === "error") {
          stopPolling();
          if (data.status === "done") {
            loadEpg(channels);
          }
        }
      } catch {
        stopPolling();
      }
    }, 2000);
  }, [channels, loadEpg]);

  useEffect(() => () => stopPolling(), []);

  const handleSync = async () => {
    setSyncStatus({ status: "running", country });
    try {
      await fetch("/api/epg/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country }),
      });
      stopPolling();
      pollSyncStatus();
    } catch {
      setSyncStatus({ status: "error", error: "Request failed" });
    }
  };

  const timeTicks = useMemo(() => {
    const ticks: Date[] = [];
    let t = new Date(windowStart);
    while (t <= windowEnd) {
      ticks.push(new Date(t));
      t = new Date(t.getTime() + 30 * 60_000);
    }
    return ticks;
  }, [windowStart.getTime()]);

  const nowOffsetPx = Math.max(0,
    ((now.getTime() - windowStart.getTime()) / 60_000) * CELL_PX_PER_MIN
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = Math.max(0, nowOffsetPx - 120);
    }
  }, [nowOffsetPx]);

  const epgCount = Object.keys(epgMap).length;
  const syncRunning = syncStatus.status === "running";

  return (
    <div className="min-h-screen bg-background text-white flex flex-col">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-white/5 bg-black/40 backdrop-blur-md shrink-0">
        <Link href="/" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mr-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>

        <div className="flex items-center gap-2 mr-2">
          <CalendarDays className="w-5 h-5 text-primary" />
          <h1 className="text-base font-display font-bold">TV Guide</h1>
        </div>

        <span className="text-xs text-muted-foreground bg-white/5 px-2.5 py-1 rounded-full font-mono">
          {timeLabel(windowStart)} – {timeLabel(windowEnd)}
        </span>

        <div className="flex-1" />

        {/* Country selector */}
        <select
          value={country}
          onChange={(e) => { setCountry(e.target.value); setSyncStatus({ status: "idle" }); }}
          className="bg-secondary/50 border border-white/10 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/50 max-w-[160px]"
        >
          {COUNTRY_OPTIONS.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>

        {/* Sync button */}
        <button
          onClick={handleSync}
          disabled={syncRunning}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all disabled:opacity-60 whitespace-nowrap"
        >
          {syncRunning ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" />Syncing…</>
          ) : syncStatus.status === "done" ? (
            <><CheckCircle2 className="w-3.5 h-3.5 text-green-300" />Synced</>
          ) : syncStatus.status === "error" ? (
            <><AlertCircle className="w-3.5 h-3.5 text-red-300" />Retry</>
          ) : (
            <><RefreshCw className="w-3.5 h-3.5" />Sync EPG</>
          )}
        </button>
      </header>

      {/* Category filter pills */}
      <div className="flex items-center gap-2 px-5 py-2.5 border-b border-white/5 bg-black/20 overflow-x-auto shrink-0 scrollbar-none">
        {CATEGORY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setCategory(opt.value)}
            className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
              category === opt.value
                ? "bg-primary border-primary text-white"
                : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
            }`}
          >
            {opt.label}
          </button>
        ))}
        {epgCount > 0 && (
          <span className="ml-auto flex-shrink-0 text-xs text-muted-foreground bg-white/5 px-2.5 py-1 rounded-full">
            {epgCount} with EPG
          </span>
        )}
        {syncStatus.status === "done" && syncStatus.inserted !== undefined && (
          <span className="flex-shrink-0 text-xs text-green-400 bg-green-400/10 px-2.5 py-1 rounded-full">
            ✓ {syncStatus.inserted} programs loaded
          </span>
        )}
        {syncStatus.status === "error" && (
          <span className="flex-shrink-0 text-xs text-red-400 bg-red-400/10 px-2.5 py-1 rounded-full">
            Sync failed — {syncStatus.error ?? "unknown error"}
          </span>
        )}
      </div>

      {/* Guide grid */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span>Loading channels…</span>
        </div>
      ) : channels.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          No channels found for this selection.
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Channel name column (fixed) */}
          <div
            className="shrink-0 flex flex-col border-r border-white/5 bg-black/20"
            style={{ width: HEADER_W }}
          >
            <div className="h-10 border-b border-white/5 bg-black/30 flex items-center px-4 shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {channels.length} channels
              </span>
            </div>
            <div className="overflow-y-auto flex-1">
              {channels.map((ch) => (
                <Link key={ch.id} href={`/play/${ch.id}`}>
                  <div className="h-14 flex items-center gap-3 px-3 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group">
                    <div className="w-8 h-8 rounded bg-card border border-white/5 flex items-center justify-center shrink-0 overflow-hidden">
                      {ch.logo ? (
                        <img src={ch.logo} alt="" className="w-full h-full object-contain p-1"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <Tv className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate group-hover:text-primary transition-colors">{ch.name}</p>
                      <p className="text-[9px] text-muted-foreground truncate">
                        {ch.isOnline
                          ? <span className="text-green-400 font-bold">● LIVE</span>
                          : <span className="text-white/20">● offline</span>
                        }
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Scrollable timeline */}
          <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto">
            <div style={{ width: WINDOW_MINS * CELL_PX_PER_MIN + 40, minWidth: "100%" }}>
              {/* Time header */}
              <div className="h-10 border-b border-white/5 bg-black/30 sticky top-0 z-10 relative shrink-0">
                {timeTicks.map((tick) => {
                  const left = ((tick.getTime() - windowStart.getTime()) / 60_000) * CELL_PX_PER_MIN;
                  return (
                    <div key={tick.getTime()} className="absolute top-0 bottom-0 flex items-center" style={{ left }}>
                      <span className="text-[10px] text-muted-foreground font-mono pl-2">{timeLabel(tick)}</span>
                      <div className="absolute left-0 top-0 bottom-0 w-px bg-white/5" />
                    </div>
                  );
                })}
                <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20" style={{ left: nowOffsetPx }} />
              </div>

              {/* Channel rows */}
              <div className="relative">
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500/30 z-10 pointer-events-none"
                  style={{ left: nowOffsetPx }}
                />
                {channels.map((ch) => {
                  const programs = epgMap[ch.id] ?? [];
                  return (
                    <div key={ch.id} className="h-14 flex items-stretch border-b border-white/5 relative">
                      {timeTicks.map((tick) => (
                        <div
                          key={tick.getTime()}
                          className="absolute top-0 bottom-0 w-px bg-white/5"
                          style={{ left: ((tick.getTime() - windowStart.getTime()) / 60_000) * CELL_PX_PER_MIN }}
                        />
                      ))}

                      {programs.length > 0 ? (
                        programs.map((prog) => {
                          const pStart  = new Date(prog.start);
                          const pEnd    = new Date(prog.end);
                          const left    = Math.max(0, ((pStart.getTime() - windowStart.getTime()) / 60_000) * CELL_PX_PER_MIN);
                          const rawW    = ((pEnd.getTime() - pStart.getTime()) / 60_000) * CELL_PX_PER_MIN;
                          const width   = Math.max(40, rawW - 2);
                          const isOnNow = pStart <= now && pEnd >= now;
                          return (
                            <Link key={prog.id} href={`/play/${ch.id}`}>
                              <div
                                className={`absolute top-1.5 bottom-1.5 rounded-lg cursor-pointer overflow-hidden flex items-center px-2 gap-1.5 transition-all hover:brightness-125 ${
                                  isOnNow
                                    ? "bg-primary/25 border border-primary/40"
                                    : "bg-white/5 border border-white/8 hover:bg-white/10"
                                }`}
                                style={{ left, width }}
                                title={prog.title}
                              >
                                {isOnNow && <Play className="w-2.5 h-2.5 text-primary shrink-0" />}
                                <span className={`text-[10px] font-semibold truncate ${isOnNow ? "text-primary/90" : "text-white/70"}`}>
                                  {prog.title}
                                </span>
                              </div>
                            </Link>
                          );
                        })
                      ) : (
                        <Link href={`/play/${ch.id}`}>
                          <div className="absolute top-1.5 bottom-1.5 left-1 right-1 rounded-lg bg-white/3 border border-white/5 hover:bg-white/6 cursor-pointer flex items-center px-3 transition-colors">
                            <span className="text-[10px] text-white/20">No EPG · click to watch</span>
                          </div>
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
