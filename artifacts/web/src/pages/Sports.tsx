import { useState, useMemo, useCallback } from "react";
import { Link } from "wouter";
import { Trophy, Tv, LayoutGrid, Grid3x3, LayoutList, List, Clock, X } from "lucide-react";
import { useRecentlyWatched } from "@/hooks/use-recently-watched";
import { useListChannels } from "@workspace/api-client-react";
import { useEpgBatch } from "@/hooks/use-epg-batch";
import { useFavorites } from "@/hooks/use-favorites";
import { useQueryClient } from "@tanstack/react-query";
import { getGetChannelQueryOptions } from "@workspace/api-client-react";
import { ChannelCard, type ViewMode } from "@/components/ChannelCard";
import { cn } from "@/lib/utils";

// ── Sport-type detection ─────────────────────────────────────────────────────
type SportType = "all" | "cricket" | "football" | "basketball" | "tennis" | "rugby" | "racing" | "golf" | "fighting";
type LiveFilter = "all" | "online" | "live";

const SPORT_TYPES: { id: SportType; label: string; icon: string; pattern: RegExp }[] = [
  { id: "all",        label: "All Sports",  icon: "🏆", pattern: /./            },
  { id: "cricket",    label: "Cricket",     icon: "🏏", pattern: /cricket|willow|star\s*sport/i },
  { id: "football",   label: "Football",    icon: "⚽", pattern: /football|soccer|premier|bundesliga|serie\s*a|ligue|laliga|mls|champions|bein|espnfc/i },
  { id: "basketball", label: "Basketball",  icon: "🏀", pattern: /basket|nba|euroleague/i },
  { id: "tennis",     label: "Tennis",      icon: "🎾", pattern: /tennis|atp|wta|wimbledon/i },
  { id: "rugby",      label: "Rugby",       icon: "🏉", pattern: /rugby|nrl|super\s*rugby/i },
  { id: "racing",     label: "Racing",      icon: "🏎️", pattern: /formula\s*1|f1\b|motogp|nascar|indycar|motorsport/i },
  { id: "golf",       label: "Golf",        icon: "⛳", pattern: /golf|pga|lpga/i },
  { id: "fighting",   label: "Fighting",    icon: "🥊", pattern: /box(ing)?|ufc|mma|fight|combat/i },
];

const LIVE_TABS: { id: LiveFilter; label: string }[] = [
  { id: "all",    label: "All"    },
  { id: "online", label: "Online" },
  { id: "live",   label: "Live"   },
];

const VIEW_MODES: { mode: ViewMode; icon: React.ReactNode; title: string }[] = [
  { mode: "large",   icon: <LayoutGrid className="w-4 h-4" />,  title: "Large"   },
  { mode: "grid",    icon: <Grid3x3 className="w-4 h-4" />,     title: "Grid"    },
  { mode: "compact", icon: <LayoutList className="w-4 h-4" />,  title: "Compact" },
  { mode: "list",    icon: <List className="w-4 h-4" />,        title: "List"    },
];

type PageTab = "channels" | "recent";

export default function Sports() {
  const [pageTab,        setPageTab]        = useState<PageTab>("channels");
  const [activeSport,    setActiveSport]    = useState<SportType>("all");
  const [liveFilter,     setLiveFilter]     = useState<LiveFilter>("online");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [viewMode,       setViewMode]       = useState<ViewMode>("grid");

  const { isFavorite, toggleFavorite } = useFavorites();
  const queryClient = useQueryClient();
  const { recentChannels, removeRecent, clearRecent } = useRecentlyWatched();

  // Filter recently-watched to sports channels only (has "Sports" category or name matches a sport)
  const recentSports = useMemo(() => {
    return recentChannels.filter(ch => {
      const hasCategory = ch.categories?.some(c => c.toLowerCase() === "sports");
      const matchesSport = SPORT_TYPES.slice(1).some(t => t.pattern.test(ch.name));
      return hasCategory || matchesSport;
    });
  }, [recentChannels]);

  // Fetch ALL sports channels
  const { data, isLoading } = useListChannels({
    category: "sports",
    country: selectedCountry || undefined,
    limit: 400,
    offset: 0,
  });

  const allChannels = data?.channels ?? [];

  // EPG for all channels
  const channelIds = useMemo(() => allChannels.map(c => c.id), [allChannels]);
  const epgMap = useEpgBatch(channelIds);

  // 1. Sport-type filter
  // Helper: is a channel showing a genuine live event?
  // Programmes > 4h are archive/marathon blocks (e.g. Cricket Gold's 16h classic match replay).
  // Real live sport events (matches, races) fit within ~4 hours.
  const isReallyLive = useCallback((id: string): boolean => {
    const p = epgMap[id];
    if (!p) return false;
    const durMin = (new Date(p.end).getTime() - new Date(p.start).getTime()) / 60000;
    return durMin <= 240;
  }, [epgMap]);

  // Apply liveFilter to ALL sports channels first (without sport-type restriction).
  // This base set drives both the sport-pill counts AND the channel grid.
  const liveFilteredBase = useMemo(() => {
    if (liveFilter === "live")   return allChannels.filter(c => c.isOnline && isReallyLive(c.id));
    if (liveFilter === "online") return allChannels.filter(c => c.isOnline);
    return allChannels;
  }, [allChannels, liveFilter, isReallyLive]);

  // Apply sport-type filter on top of the live-filtered base
  const sportFiltered = useMemo(() => {
    if (activeSport === "all") return liveFilteredBase;
    const type = SPORT_TYPES.find(s => s.id === activeSport);
    return type ? liveFilteredBase.filter(c => type.pattern.test(c.name)) : liveFilteredBase;
  }, [liveFilteredBase, activeSport]);

  // Sort: genuinely live (EPG ≤ 4h) → online (no live event) → offline
  const sorted = useMemo(() => {
    return [...sportFiltered].sort((a, b) => {
      const aLive = a.isOnline && isReallyLive(a.id);
      const bLive = b.isOnline && isReallyLive(b.id);
      if (aLive && !bLive) return -1;
      if (!aLive && bLive) return 1;
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [sportFiltered, isReallyLive]);

  // In "live" mode, separately collect all offline channels (sport-filtered) for the secondary section.
  // They won't have EPG data so isReallyLive() returns false for them — we just list them dimmed below.
  const liveTabOfflineChannels = useMemo(() => {
    if (liveFilter !== "live") return [];
    const offlineAll = allChannels.filter(c => !c.isOnline);
    if (activeSport === "all") return [...offlineAll].sort((a, b) => a.name.localeCompare(b.name));
    const type = SPORT_TYPES.find(s => s.id === activeSport);
    return type
      ? [...offlineAll].filter(c => type.pattern.test(c.name)).sort((a, b) => a.name.localeCompare(b.name))
      : [...offlineAll].sort((a, b) => a.name.localeCompare(b.name));
  }, [allChannels, liveFilter, activeSport]);

  // Show offline divider in "all" mode and in "live" mode (offline channels below live ones)
  const showOfflineSection =
    (liveFilter === "all" && sorted.some(c => !c.isOnline) && sorted.some(c => c.isOnline)) ||
    (liveFilter === "live" && liveTabOfflineChannels.length > 0);
  const onlineChannels  = liveFilter === "all" ? sorted.filter(c => c.isOnline)  : sorted;
  const offlineChannels = liveFilter === "all" ? sorted.filter(c => !c.isOnline) : liveTabOfflineChannels;

  // Country list derived from all sports channels
  const countries = useMemo(() => {
    const seen = new Set<string>();
    allChannels.forEach(c => seen.add(c.country));
    return Array.from(seen).sort();
  }, [allChannels]);

  // Sport-pill counts reflect the CURRENT tab filter so the count matches what you'd see
  const sportCounts = useMemo(() => {
    const counts: Partial<Record<SportType, number>> = { all: liveFilteredBase.length };
    for (const t of SPORT_TYPES.slice(1)) {
      counts[t.id] = liveFilteredBase.filter(c => t.pattern.test(c.name)).length;
    }
    return counts;
  }, [liveFilteredBase]);

  const onlineCount  = allChannels.filter(c => c.isOnline).length;
  const liveNowCount = allChannels.filter(c => c.isOnline && isReallyLive(c.id)).length;

  const handleToggleFav = useCallback((channelId: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    toggleFavorite(channelId);
  }, [toggleFavorite]);

  const gridClass = useMemo(() => {
    if (viewMode === "list")    return "flex flex-col gap-2";
    if (viewMode === "large")   return "grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-6";
    if (viewMode === "compact") return "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-2";
    return "grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-6";
  }, [viewMode]);

  return (
    <div className="min-h-screen bg-background relative selection:bg-primary/30">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-green-500/8 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary/8 blur-[120px]" />
      </div>

      <div className="relative z-10 container mx-auto px-4 md:px-8 py-8 md:py-12 flex flex-col gap-6">

        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="outline-none">
              <button className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
            </Link>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
              <Trophy className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-white tracking-tight">Live Sports</h1>
              <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase mt-0.5">
                {isLoading ? "Loading..." : `${onlineCount} online · ${liveNowCount} live`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View mode selector */}
            <div className="flex items-center gap-1 bg-secondary/40 border border-white/5 rounded-xl p-1">
              {VIEW_MODES.map(({ mode, icon, title }) => (
                <button
                  key={mode}
                  title={title}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    viewMode === mode ? "bg-white text-black shadow-sm" : "text-muted-foreground hover:text-white"
                  )}
                >
                  {icon}
                </button>
              ))}
            </div>
            <Link href="/guide" className="outline-none">
              <button className="flex items-center gap-2 bg-secondary/50 hover:bg-secondary border border-white/10 text-white/70 hover:text-white rounded-xl py-2 px-4 text-sm font-medium transition-all">
                <Tv className="w-4 h-4" />
                <span>TV Guide</span>
              </button>
            </Link>
          </div>
        </header>

        {/* Page tabs: Live Sports | Recently Watched */}
        <div className="flex items-center gap-2 border-b border-white/5 pb-1 -mb-2">
          <button
            onClick={() => setPageTab("channels")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-semibold transition-all outline-none",
              pageTab === "channels"
                ? "text-white border-b-2 border-green-500 -mb-px"
                : "text-muted-foreground hover:text-white"
            )}
          >
            <Trophy className="w-3.5 h-3.5" />
            Live Sports
          </button>
          <button
            onClick={() => setPageTab("recent")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-semibold transition-all outline-none",
              pageTab === "recent"
                ? "text-white border-b-2 border-green-500 -mb-px"
                : "text-muted-foreground hover:text-white"
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            Recently Watched
            {recentSports.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-white/50">{recentSports.length}</span>
            )}
          </button>
        </div>

        {/* Live / Online / All tabs — only on channels tab */}
        {pageTab === "channels" && <div className="flex items-center gap-2">
          {LIVE_TABS.map(tab => {
            const count = tab.id === "live" ? liveNowCount : tab.id === "online" ? onlineCount : allChannels.length;
            return (
              <button
                key={tab.id}
                onClick={() => setLiveFilter(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all outline-none focus:ring-2 focus:ring-primary/40 shrink-0",
                  liveFilter === tab.id
                    ? tab.id === "live"
                      ? "bg-green-500 text-white shadow-lg shadow-green-500/20"
                      : "bg-white text-black shadow-lg"
                    : "bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-white"
                )}
              >
                {tab.id === "live" && liveFilter === "live" && (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inset-0 rounded-full bg-white opacity-75 animate-ping" />
                    <span className="relative rounded-full h-2 w-2 bg-white" />
                  </span>
                )}
                {tab.label}
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                  liveFilter === tab.id
                    ? tab.id === "live" ? "bg-white/20 text-white" : "bg-black/10 text-black"
                    : "bg-white/10 text-white/50"
                )}>{count}</span>
              </button>
            );
          })}
        </div>}

        {/* Sport-type filter pills — only on channels tab */}
        {pageTab === "channels" && <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
          {SPORT_TYPES.map(type => {
            const count = sportCounts[type.id] ?? 0;
            if (type.id !== "all" && count === 0) return null;
            return (
              <button
                key={type.id}
                onClick={() => setActiveSport(type.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap border transition-all shrink-0 outline-none",
                  activeSport === type.id
                    ? "bg-green-500/20 border-green-500/40 text-green-300"
                    : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
                )}
              >
                <span>{type.icon}</span>
                <span>{type.label}</span>
                {type.id !== "all" && <span className="text-[10px] opacity-60">({count})</span>}
              </button>
            );
          })}
        </div>}

        {/* Country filter — only on channels tab */}
        {pageTab === "channels" && countries.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
            <button
              onClick={() => setSelectedCountry(null)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap shrink-0 transition-all outline-none",
                !selectedCountry ? "bg-primary/20 border-primary/40 text-primary" : "bg-white/5 border-white/10 text-white/50 hover:text-white"
              )}
            >🌍 All</button>
            {countries.map(cc => (
              <button
                key={cc}
                onClick={() => setSelectedCountry(cc === selectedCountry ? null : cc)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap shrink-0 transition-all outline-none",
                  selectedCountry === cc ? "bg-primary/20 border-primary/40 text-primary" : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                )}
              >
                {cc.split("").map(c => String.fromCodePoint(127397 + c.toUpperCase().charCodeAt(0))).join("")} {cc}
              </button>
            ))}
          </div>
        )}

        {/* Recently Watched grid */}
        {pageTab === "recent" && (
          recentSports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
              <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center">
                <Clock className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-2xl font-display font-bold text-white">No sports watched yet</h3>
              <p className="text-muted-foreground">Sports channels you play will appear here automatically.</p>
              <button onClick={() => setPageTab("channels")} className="text-green-400 text-sm hover:underline">
                Browse Live Sports →
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{recentSports.length} channel{recentSports.length !== 1 ? "s" : ""} watched</p>
                <button onClick={clearRecent} className="text-xs text-muted-foreground hover:text-red-400 transition-colors flex items-center gap-1">
                  <X className="w-3 h-3" /> Clear all
                </button>
              </div>
              <div className={gridClass}>
                {recentSports.map((ch) => {
                  const mins = Math.floor((Date.now() - ch.watchedAt) / 60000);
                  const relTime = mins < 1 ? "Just now" : mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.floor(mins / 60)}h ago` : `${Math.floor(mins / 1440)}d ago`;
                  return (
                    <Link key={ch.id} href={`/play/${ch.id}`} className="outline-none">
                      <div className="group relative flex flex-col cursor-pointer rounded-2xl border border-white/10 hover:border-green-500/30 bg-card hover:bg-card/80 overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5">
                        <div className="relative aspect-video bg-secondary/30 flex items-center justify-center overflow-hidden">
                          {ch.logo ? (
                            <img src={ch.logo} alt="" className="w-full h-full object-contain p-4" loading="lazy" decoding="async" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          ) : (
                            <span className="text-2xl font-display font-bold text-white/10">{ch.name.substring(0, 2).toUpperCase()}</span>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-3">
                            <span className="text-white text-xs font-bold">▶ Play</span>
                          </div>
                          {ch.quality && (
                            <span className="absolute top-2 left-2 text-[9px] font-bold text-white/60 bg-black/60 px-1.5 py-0.5 rounded uppercase">{ch.quality}</span>
                          )}
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeRecent(ch.id); }}
                            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-medium text-white truncate">{ch.name}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[11px] text-white/40">{ch.country}</span>
                            <span className="text-[11px] text-white/30">{relTime}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )
        )}

        {/* Channel grid — only on channels tab */}
        {pageTab === "channels" && (isLoading ? (
          <div className={gridClass}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-card border border-white/5 animate-pulse h-28" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <Trophy className="w-12 h-12 text-white/10" />
            <p className="text-white/40 text-lg">
              {liveFilter === "live" ? "No live events right now" : "No channels match"}
            </p>
            <div className="flex gap-2">
              {liveFilter !== "all" && (
                <button onClick={() => setLiveFilter("all")} className="text-green-400 text-sm hover:underline">Show all</button>
              )}
              {activeSport !== "all" && (
                <button onClick={() => setActiveSport("all")} className="text-primary text-sm hover:underline">All sports</button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Online/Live channels */}
            <div className={gridClass}>
              {onlineChannels.map(channel => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  isFavorite={isFavorite(channel.id)}
                  onToggleFavorite={(e) => handleToggleFav(channel.id, e)}
                  viewMode={viewMode}
                  epgProgram={epgMap[channel.id]?.title ?? null}
                  isLive={isReallyLive(channel.id)}
                />
              ))}
            </div>

            {/* Offline section — only in "all" mode */}
            {showOfflineSection && (
              <>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex-1 h-px bg-white/5" />
                  <span className="text-xs text-white/25 font-medium px-2 uppercase tracking-wider">
                    Offline · {offlineChannels.length}
                  </span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>
                <div className={cn(gridClass, "opacity-40")}>
                  {offlineChannels.map(channel => (
                    <ChannelCard
                      key={channel.id}
                      channel={channel}
                      isFavorite={isFavorite(channel.id)}
                      onToggleFavorite={(e) => handleToggleFav(channel.id, e)}
                      viewMode={viewMode}
                      epgProgram={null}
                      isLive={false}
                    />
                  ))}
                </div>
              </>
            )}

            <p className="text-center text-sm text-white/20 pb-4">
              {liveFilter === "live"
                ? `${sorted.length} live now${liveTabOfflineChannels.length > 0 ? ` · ${liveTabOfflineChannels.length} offline` : ""}`
                : `${onlineChannels.length} online${showOfflineSection ? ` · ${offlineChannels.length} offline` : ""}`}
            </p>
          </>
        ))}
      </div>
    </div>
  );
}
