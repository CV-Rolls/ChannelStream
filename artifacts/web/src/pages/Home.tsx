import { useState, useMemo, useEffect, useRef } from "react";
import { Search, Tv, LayoutGrid, List, LayoutList, Grid3x3, ChevronDown, SlidersHorizontal, X, Keyboard } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { useListChannels } from "@workspace/api-client-react";
import { ChannelCard, type ViewMode } from "@/components/ChannelCard";
import { useFavorites } from "@/hooks/use-favorites";

import { useEpgBatch } from "@/hooks/use-epg-batch";
import { useRecentlyWatched } from "@/hooks/use-recently-watched";
import type { QualityGroup } from "@workspace/api-client-react";

const PAGE_SIZE = 300;

type TabValue = "all" | "favorites" | "recent";

const TABS: { id: TabValue; label: string; shortLabel: string; icon: React.ReactNode }[] = [
  { id: "all", label: "All Channels", shortLabel: "All", icon: <Tv className="w-4 h-4" /> },
  {
    id: "favorites", label: "Favorites", shortLabel: "Saved",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>
  },
  {
    id: "recent", label: "Recently Watched", shortLabel: "Recent",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  },
];

const CATEGORIES: { id: string | null; label: string; emoji: string }[] = [
  { id: null,           label: "All",          emoji: "🎬" },
  { id: "general",      label: "General",      emoji: "📺" },
  { id: "news",         label: "News",         emoji: "📰" },
  { id: "entertainment",label: "Entertainment",emoji: "🎭" },
  { id: "sports",       label: "Sports",       emoji: "⚽" },
  { id: "movies",       label: "Movies",       emoji: "🎥" },
  { id: "music",        label: "Music",        emoji: "🎵" },
  { id: "religious",    label: "Religious",    emoji: "✝️" },
  { id: "kids",         label: "Kids",         emoji: "🧒" },
  { id: "education",    label: "Education",    emoji: "📚" },
  { id: "documentary",  label: "Documentary",  emoji: "🎞️" },
  { id: "series",       label: "Series",       emoji: "📺" },
  { id: "culture",      label: "Culture",      emoji: "🏛️" },
  { id: "business",     label: "Business",     emoji: "💼" },
  { id: "lifestyle",    label: "Lifestyle",    emoji: "🌿" },
  { id: "animation",    label: "Animation",    emoji: "🎨" },
  { id: "comedy",       label: "Comedy",       emoji: "😄" },
  { id: "legislative",  label: "Legislative",  emoji: "🏛️" },
];

const COUNTRIES: { code: string; name: string; flag: string }[] = [
  { code: "US", name: "USA",          flag: "🇺🇸" },
  { code: "UK", name: "UK",           flag: "🇬🇧" },
  { code: "IN", name: "India",        flag: "🇮🇳" },
  { code: "ZA", name: "S. Africa",   flag: "🇿🇦" },
  { code: "ES", name: "Spain",        flag: "🇪🇸" },
  { code: "RU", name: "Russia",       flag: "🇷🇺" },
  { code: "AR", name: "Argentina",    flag: "🇦🇷" },
  { code: "CN", name: "China",        flag: "🇨🇳" },
  { code: "CA", name: "Canada",       flag: "🇨🇦" },
  { code: "FR", name: "France",       flag: "🇫🇷" },
  { code: "IT", name: "Italy",        flag: "🇮🇹" },
  { code: "MX", name: "Mexico",       flag: "🇲🇽" },
  { code: "BR", name: "Brazil",       flag: "🇧🇷" },
  { code: "TR", name: "Turkey",       flag: "🇹🇷" },
  { code: "DE", name: "Germany",      flag: "🇩🇪" },
  { code: "AU", name: "Australia",    flag: "🇦🇺" },
  { code: "NL", name: "Netherlands",  flag: "🇳🇱" },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "PL", name: "Poland",       flag: "🇵🇱" },
  { code: "CO", name: "Colombia",     flag: "🇨🇴" },
  { code: "DO", name: "Dom. Rep.",    flag: "🇩🇴" },
  { code: "ID", name: "Indonesia",    flag: "🇮🇩" },
  { code: "GR", name: "Greece",       flag: "🇬🇷" },
  { code: "QA", name: "Qatar",        flag: "🇶🇦" },
  { code: "IR", name: "Iran",         flag: "🇮🇷" },
  { code: "TH", name: "Thailand",     flag: "🇹🇭" },
  { code: "PT", name: "Portugal",     flag: "🇵🇹" },
  { code: "RO", name: "Romania",      flag: "🇷🇴" },
  { code: "CL", name: "Chile",        flag: "🇨🇱" },
  { code: "PK", name: "Pakistan",     flag: "🇵🇰" },
  { code: "CH", name: "Switzerland",  flag: "🇨🇭" },
];

const QUALITIES: { id: QualityGroup | null; label: string; sub: string }[] = [
  { id: null,    label: "All",  sub: "" },
  { id: "4k",    label: "4K",   sub: "2160p" },
  { id: "fhd",   label: "FHD",  sub: "1080p" },
  { id: "hd",    label: "HD",   sub: "720p" },
  { id: "sd",    label: "SD",   sub: "480p↓" },
];

export default function Home() {
  const [activeTab, setActiveTab]           = useState<TabValue>("all");
  const [searchQuery, setSearchQuery]       = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showOnlineOnly, setShowOnlineOnly] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry]   = useState<string | null>(null);
  const [selectedQuality, setSelectedQuality]   = useState<QualityGroup | null>(null);
  const [viewMode, setViewMode]             = useState<ViewMode>("grid");
  const [offset, setOffset]                 = useState(0);

  const [, navigate] = useLocation();
  const searchRef           = useRef<HTMLInputElement>(null);
  const displayedChannelsRef = useRef<{ id: string }[]>([]);

  // ── Keyboard navigation ───────────────────────────────────────────────────
  const [kbIndex, setKbIndex]   = useState<number | null>(null);
  const [kbMode, setKbMode]     = useState(false);

  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const { recentChannels, removeRecent, clearRecent } = useRecentlyWatched();

  const handleTabChange = (tab: TabValue) => {
    setActiveTab(tab);
    setOffset(0);
  };

  const handleCountrySelect = (code: string | null) => {
    setSelectedCountry(code);
    setActiveTab("all");
    setOffset(0);
  };

  const resetFilters = () => {
    setSelectedCategory(null);
    setSelectedCountry(null);
    setSelectedQuality(null);
    setSearchQuery("");
    setShowOnlineOnly(false);
    setOffset(0);
  };

  // ── Keyboard navigation effect ────────────────────────────────────────────
  useEffect(() => {
    const COLS = viewMode === "compact" ? 8 : viewMode === "large" ? 3 : 4;

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "/" || e.key === "f") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === "Escape") { setKbMode(false); setKbIndex(null); return; }

      const channels = displayedChannelsRef.current;
      const total = channels.length;
      if (total === 0) return;

      if (["ArrowRight","ArrowLeft","ArrowDown","ArrowUp","Enter"].includes(e.key)) {
        e.preventDefault();
        setKbMode(true);
        setKbIndex((prev) => {
          const cur = prev ?? 0;
          if (e.key === "Enter") {
            const ch = channels[cur];
            if (ch) navigate(`/play/${ch.id}`);
            return cur;
          }
          if (e.key === "ArrowRight") return Math.min(cur + 1, total - 1);
          if (e.key === "ArrowLeft")  return Math.max(cur - 1, 0);
          if (e.key === "ArrowDown")  return Math.min(cur + COLS, total - 1);
          if (e.key === "ArrowUp")    return Math.max(cur - COLS, 0);
          return cur;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewMode, navigate]);

  // Debounce search input — only fire API request 300ms after typing stops
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const queryParams = {
    country: selectedCountry || undefined,
    search: debouncedSearch || undefined,
    onlineOnly: showOnlineOnly || undefined,
    category: selectedCategory || undefined,
    quality: selectedQuality || undefined,
    limit: PAGE_SIZE,
    offset,
  };

  const { data, isLoading, isError } = useListChannels(queryParams);

  const rawChannels = data?.channels ?? [];
  const serverTotal = data?.total ?? 0;

  const displayedChannels = useMemo(() => {
    let result = rawChannels;
    if (activeTab === "favorites") {
      result = result.filter(c => favorites.includes(c.id));
    }
    return result;
  }, [rawChannels, activeTab, favorites]);

  displayedChannelsRef.current = displayedChannels;

  const channelIdsForEpg = useMemo(
    () => displayedChannels.slice(0, 100).map((c) => c.id),
    [displayedChannels]
  );
  const epgMap = useEpgBatch(channelIdsForEpg);

  const hasMore = activeTab === "all" && rawChannels.length === PAGE_SIZE;

  const activeFilterCount = [
    selectedCategory,
    selectedCountry,
    selectedQuality,
    showOnlineOnly ? "online" : null,
  ].filter(Boolean).length;

  const countLabel = useMemo(() => {
    if (isLoading) return null;
    if (activeTab === "favorites") return `${displayedChannels.length} favourite${displayedChannels.length !== 1 ? "s" : ""}`;
    return `${serverTotal.toLocaleString()} channel${serverTotal !== 1 ? "s" : ""} (showing ${offset + rawChannels.length})`;
  }, [isLoading, activeTab, displayedChannels.length, serverTotal, offset, rawChannels.length]);

  return (
    <div className="min-h-screen bg-background relative selection:bg-primary/30">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent/10 blur-[120px]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <div className="relative z-10 container mx-auto px-4 md:px-8 py-8 md:py-12 flex flex-col gap-6">

        {/* ── Header ── */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <Tv className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-white tracking-tight">NetStream</h1>
              <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase mt-0.5">Premium IPTV Player</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <Link href="/sports" className="flex items-center justify-center gap-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 hover:border-green-500/40 text-green-400 hover:text-green-300 rounded-xl py-2.5 px-5 outline-none focus:ring-2 focus:ring-green-500/50 transition-all font-medium text-sm">
              <span>🏆</span>
              <span>Live Sports</span>
            </Link>
            <Link href="/guide" className="flex items-center justify-center gap-2 bg-secondary/50 hover:bg-secondary border border-secondary-border text-white/70 hover:text-white rounded-xl py-2.5 px-5 outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium text-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>TV Guide</span>
            </Link>
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                ref={searchRef}
                type="search"
                placeholder="Search channels... (press /)"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setOffset(0); }}
                className="w-full sm:w-64 bg-secondary/50 border border-secondary-border text-white placeholder:text-muted-foreground rounded-xl py-2.5 pl-10 pr-4 outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* ── Keyboard mode hint ── */}
        {kbMode && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/30 border border-white/5 rounded-xl px-4 py-2 w-fit"
          >
            <Keyboard className="w-3.5 h-3.5 text-primary" />
            <span><kbd className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-white">↑↓←→</kbd> navigate · <kbd className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-white">Enter</kbd> play · <kbd className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-white">Esc</kbd> exit</span>
          </motion.div>
        )}

        {/* ── Continue Watching — compact row, hidden when Recent tab is open ── */}
        {recentChannels.length > 0 && activeTab !== "recent" && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <h2 className="text-sm font-semibold text-white uppercase tracking-widest">Continue Watching</h2>
              </div>
              <button
                onClick={() => handleTabChange("recent")}
                className="text-xs text-primary hover:text-primary/70 transition-colors"
              >
                See all →
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {recentChannels.map((ch) => (
                <Link key={ch.id} href={`/play/${ch.id}`} className="outline-none">
                  <div className="shrink-0 w-32 group cursor-pointer relative">
                    <div className="relative w-32 h-20 rounded-xl bg-card border border-white/5 group-hover:border-primary/40 overflow-hidden transition-all flex items-center justify-center">
                      {ch.logo ? (
                        <img src={ch.logo} alt="" className="w-full h-full object-contain p-3" loading="lazy" decoding="async" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <span className="text-lg font-display font-bold text-white/20">{ch.name.substring(0, 2).toUpperCase()}</span>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                        <span className="text-white text-[10px] font-bold">▶ Play</span>
                      </div>
                      {ch.quality && (
                        <span className="absolute top-1.5 left-1.5 text-[9px] font-bold text-white/50 bg-black/60 px-1 rounded uppercase">{ch.quality}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1.5 group-hover:text-white transition-colors">{ch.name}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Tabs + Genre + Online Only ── */}
        <div className="flex flex-col gap-2.5">

          {/* Row 1: Primary tabs + Online Only toggle (always visible, never scrolls away) */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-xl font-semibold text-sm transition-all outline-none focus:ring-2 focus:ring-primary/40 shrink-0 min-h-[44px] ${
                  activeTab === tab.id && selectedCategory === null
                    ? "bg-white text-black shadow-lg"
                    : "bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-white"
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="inline sm:hidden text-xs">{tab.shortLabel}</span>
              </button>
            ))}

            <div className="ml-auto flex items-center gap-2 flex-wrap justify-end shrink-0">
              {selectedCategory && (
                <button
                  onClick={() => { setSelectedCategory(null); setOffset(0); }}
                  className="flex items-center gap-1.5 text-xs bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 px-2.5 py-1 rounded-lg transition-colors"
                >
                  <span>{CATEGORIES.find(c => c.id === selectedCategory)?.emoji}</span>
                  <span className="hidden sm:inline max-w-[80px] truncate">{CATEGORIES.find(c => c.id === selectedCategory)?.label}</span>
                  <X className="w-3 h-3 shrink-0" />
                </button>
              )}
              {selectedCountry && (
                <button
                  onClick={() => { setSelectedCountry(null); setOffset(0); }}
                  className="flex items-center gap-1.5 text-xs bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 px-2.5 py-1 rounded-lg transition-colors"
                >
                  <span>{COUNTRIES.find(c => c.code === selectedCountry)?.flag ?? selectedCountry}</span>
                  <span className="hidden sm:inline">{COUNTRIES.find(c => c.code === selectedCountry)?.name ?? selectedCountry}</span>
                  <X className="w-3 h-3 shrink-0" />
                </button>
              )}
              {selectedQuality && (
                <button
                  onClick={() => { setSelectedQuality(null); setOffset(0); }}
                  className="flex items-center gap-1.5 text-xs bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 px-2.5 py-1 rounded-lg transition-colors"
                >
                  <span className="font-bold">{QUALITIES.find(q => q.id === selectedQuality)?.label ?? selectedQuality}</span>
                  <X className="w-3 h-3 shrink-0" />
                </button>
              )}
              <label className="flex items-center gap-2.5 cursor-pointer group min-h-[44px]">
                <div className={`w-10 h-5 rounded-full transition-colors relative flex items-center ${showOnlineOnly ? 'bg-green-500' : 'bg-secondary'}`}>
                  <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] transition-transform duration-300 ${showOnlineOnly ? 'translate-x-[22px]' : 'translate-x-[3px]'}`} />
                </div>
                <span className="text-white text-sm font-medium select-none group-hover:text-green-400 transition-colors whitespace-nowrap">
                  <span className="hidden sm:inline">Online Only</span>
                  <span className="inline sm:hidden">Online</span>
                </span>
                <input type="checkbox" className="sr-only" checked={showOnlineOnly} onChange={(e) => { setShowOnlineOnly(e.target.checked); setOffset(0); }} />
              </label>
            </div>
          </div>

          {/* Row 2: Category pills — single horizontal-scroll row on mobile, wraps on md+ */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap">
            {CATEGORIES.filter(c => c.id !== null).map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.id); setActiveTab("all"); setOffset(0); }}
                className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium transition-all outline-none focus:ring-2 focus:ring-primary/40 whitespace-nowrap shrink-0 min-h-[44px] md:min-h-0 ${
                  selectedCategory === cat.id
                    ? "bg-primary/20 text-primary border border-primary/40 shadow-sm shadow-primary/10"
                    : "bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-white border border-transparent"
                }`}
              >
                <span>{cat.emoji}</span>
                {cat.label}
              </button>
            ))}
          </div>

        </div>

        {/* ── Filter Panel — hidden on Recent tab ── */}
        {activeTab !== "recent" && <div className="flex flex-col gap-3 p-4 rounded-2xl bg-secondary/20 border border-white/5">

          {/* Country */}
          {activeTab !== "recent" && (
            <div className="flex items-start gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground pt-2.5 shrink-0 w-14">Country</span>
              {/* Mobile: single scrollable row. md+: wrap to multiple rows */}
              <div className="flex flex-nowrap md:flex-wrap gap-1.5 overflow-x-auto scrollbar-hide pb-0.5 md:pb-0 -mx-1 px-1">
                {/* All */}
                <button
                  onClick={() => handleCountrySelect(null)}
                  className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-xl text-xs font-medium transition-all border whitespace-nowrap ${
                    selectedCountry === null
                      ? "bg-accent/20 text-accent border-accent/40 shadow-sm shadow-accent/10"
                      : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white border-transparent"
                  }`}
                >
                  <span className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-base shrink-0">🌍</span>
                  <span>All</span>
                </button>
                {/* Country flags */}
                {COUNTRIES.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => handleCountrySelect(c.code)}
                    className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-xl text-xs font-medium transition-all border whitespace-nowrap ${
                      selectedCountry === c.code
                        ? "bg-accent/20 text-accent border-accent/40 shadow-sm shadow-accent/10"
                        : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white border-transparent"
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-base shrink-0 ${
                      selectedCountry === c.code ? "bg-accent/20" : "bg-white/10"
                    }`}>{c.flag}</span>
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quality */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0 w-14">Quality</span>
            <div className="flex flex-wrap gap-1.5">
              {QUALITIES.map((q) => (
                <button
                  key={q.id ?? "all"}
                  onClick={() => { setSelectedQuality(q.id); setOffset(0); }}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    selectedQuality === q.id
                      ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40"
                      : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white border-transparent"
                  }`}
                >
                  {q.label}
                  {q.sub && <span className="text-[9px] opacity-60 font-normal">{q.sub}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>}

        {/* ── Count bar + View mode ── */}
        <div className="flex items-center justify-between">
          <AnimatePresence mode="wait">
            <motion.p
              key={countLabel ?? "loading"}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="text-sm text-muted-foreground"
            >
              {isLoading ? (
                <span className="inline-block w-40 h-4 rounded bg-secondary/50 animate-pulse" />
              ) : (
                <span dangerouslySetInnerHTML={{
                  __html: (countLabel ?? "").replace(/^([\d,]+)/, '<span class="text-white font-semibold">$1</span>')
                }} />
              )}
            </motion.p>
          </AnimatePresence>

          <div className="flex items-center gap-1 bg-secondary/40 rounded-xl p-1 border border-white/5">
            {([
              { mode: "large" as ViewMode,   icon: <LayoutGrid className="w-4 h-4" />,  title: "Large" },
              { mode: "grid" as ViewMode,    icon: <Grid3x3 className="w-4 h-4" />,     title: "Grid" },
              { mode: "compact" as ViewMode, icon: <LayoutList className="w-4 h-4" />,  title: "Compact" },
              { mode: "list" as ViewMode,    icon: <List className="w-4 h-4" />,        title: "List" },
            ]).map(({ mode, icon, title }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                title={title}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === mode ? "bg-white text-black shadow-sm" : "text-muted-foreground hover:text-white"
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        {/* ── Channels Grid ── */}
        <div>
          <AnimatePresence mode="wait">
            {activeTab === "recent" ? (
              recentChannels.length === 0 ? (
                <motion.div key="recent-empty" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-32 text-center">
                  <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-5">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </div>
                  <h3 className="text-2xl font-display font-bold text-white mb-2">Nothing watched yet</h3>
                  <p className="text-muted-foreground">Channels you play will appear here automatically.</p>
                </motion.div>
              ) : (
                <motion.div key="recent-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-muted-foreground">{recentChannels.length} channel{recentChannels.length !== 1 ? "s" : ""} watched</p>
                    <button onClick={clearRecent} className="text-xs text-muted-foreground hover:text-red-400 transition-colors flex items-center gap-1">
                      <X className="w-3 h-3" /> Clear all
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {recentChannels.map((ch) => {
                      const relTime = (() => {
                        const mins = Math.floor((Date.now() - ch.watchedAt) / 60000);
                        if (mins < 1)   return "Just now";
                        if (mins < 60)  return `${mins}m ago`;
                        const hrs = Math.floor(mins / 60);
                        if (hrs < 24)   return `${hrs}h ago`;
                        return `${Math.floor(hrs / 24)}d ago`;
                      })();
                      return (
                        <Link key={ch.id} href={`/play/${ch.id}`} className="outline-none">
                          <div className="group relative flex flex-col cursor-pointer rounded-2xl border border-white/10 hover:border-primary/30 bg-card hover:bg-card/80 overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98]">
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
                                title="Remove"
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
                </motion.div>
              )
            ) : isLoading ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-6">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="rounded-2xl bg-secondary/30 animate-pulse aspect-[4/3] border border-secondary-border" />
                ))}
              </motion.div>
            ) : isError ? (
              <motion.div key="error" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-24 text-center">
                <AlertCircle className="w-16 h-16 text-destructive/60 mb-4" />
                <h3 className="text-2xl font-display font-bold text-white mb-2">Failed to load channels</h3>
                <p className="text-muted-foreground">Problem connecting to the server. Please try refreshing.</p>
                <button onClick={() => window.location.reload()}
                  className="mt-6 px-8 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-colors">
                  Try Again
                </button>
              </motion.div>
            ) : displayedChannels.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-32 text-center">
                <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-5">
                  <SlidersHorizontal className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="text-2xl font-display font-bold text-white mb-2">No channels found</h3>
                <p className="text-muted-foreground max-w-md">
                  {activeTab === "favorites"
                    ? "Click the ♥ on any channel card to save it here."
                    : "Try adjusting your filters or search."}
                </p>
                {activeFilterCount > 0 && (
                  <button onClick={resetFilters} className="mt-5 px-6 py-2.5 bg-secondary border border-white/10 text-white rounded-xl text-sm font-medium hover:bg-white/10 transition-colors">
                    Clear all filters
                  </button>
                )}
              </motion.div>
            ) : (
              <>
                <motion.div
                  key={`grid-${viewMode}-${offset}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={
                    viewMode === "list"
                      ? "flex flex-col gap-2"
                      : viewMode === "large"
                      ? "grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-6"
                      : viewMode === "compact"
                      ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-2"
                      : "grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-6"
                  }
                >
                  {displayedChannels.map((channel, i) => (
                    <motion.div
                      key={channel.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: Math.min(i * 0.015, 0.25), duration: 0.2 }}
                    >
                      <ChannelCard
                        channel={channel}
                        isFavorite={isFavorite(channel.id)}
                        viewMode={viewMode}
                        keyboardFocused={kbMode && kbIndex === i}
                        epgProgram={epgMap[channel.id]?.title ?? null}
                        onToggleFavorite={(e) => { e.preventDefault(); toggleFavorite(channel.id); }}
                      />
                    </motion.div>
                  ))}
                </motion.div>

                {/* Pagination */}
                <div className="flex items-center justify-center gap-3 mt-10 pb-4">
                  {offset > 0 && (
                    <button
                      onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                      className="px-5 py-2.5 bg-secondary/50 border border-white/10 text-white rounded-xl text-sm font-medium hover:bg-secondary transition-colors"
                    >
                      ← Previous
                    </button>
                  )}
                  {hasMore && (
                    <button
                      onClick={() => setOffset(offset + PAGE_SIZE)}
                      className="flex items-center gap-2 px-7 py-2.5 bg-primary/20 border border-primary/30 text-primary rounded-xl text-sm font-semibold hover:bg-primary/30 transition-colors"
                    >
                      <ChevronDown className="w-4 h-4" />
                      Load More
                      {serverTotal - offset - rawChannels.length > 0 &&
                        <span className="text-primary/70 font-normal">({(serverTotal - offset - rawChannels.length).toLocaleString()} more)</span>
                      }
                    </button>
                  )}
                </div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function AlertCircle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
