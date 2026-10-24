import { useState, useRef, useEffect } from "react";
import { Search, X, Tv, LayoutGrid, Sparkles, Mic } from "lucide-react";

const SUGGESTIONS = [
  { query: "BBC News", type: "channel" },
  { query: "Sports HD", type: "smart" },
  { query: "Kids USA", type: "smart" },
  { query: "4K Movies", type: "smart" },
  { query: "France 24", type: "channel" },
  { query: "Live News", type: "smart" },
];

const QUICK_FILTERS = [
  { id: "live", label: "● Live Now", color: "#4ade80", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.3)" },
  { id: "4k", label: "✦ 4K", color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)" },
  { id: "news", label: "📰 News", color: "#a78bfa", bg: "rgba(124,58,237,0.12)", border: "rgba(124,58,237,0.3)" },
  { id: "sports", label: "⚽ Sports", color: "#60a5fa", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.3)" },
  { id: "movies", label: "🎥 Movies", color: "#f472b6", bg: "rgba(244,114,182,0.1)", border: "rgba(244,114,182,0.3)" },
  { id: "us", label: "🇺🇸 USA", color: "#a78bfa", bg: "rgba(124,58,237,0.1)", border: "rgba(124,58,237,0.25)" },
  { id: "uk", label: "🇬🇧 UK", color: "#a78bfa", bg: "rgba(124,58,237,0.1)", border: "rgba(124,58,237,0.25)" },
  { id: "hd", label: "⚡ HD+", color: "#34d399", bg: "rgba(52,211,153,0.1)", border: "rgba(52,211,153,0.25)" },
];

const FAKE_CHANNELS = [
  { id: "1", name: "BBC News", country: "GB", category: "news", quality: "FHD", online: true, tags: ["news", "live", "uk"] },
  { id: "2", name: "ESPN", country: "US", category: "sports", quality: "HD", online: true, tags: ["sports", "live", "us", "hd"] },
  { id: "3", name: "CNN", country: "US", category: "news", quality: "FHD", online: true, tags: ["news", "live", "us"] },
  { id: "4", name: "Disney Channel", country: "US", category: "kids", quality: "HD", online: false, tags: ["us", "hd"] },
  { id: "5", name: "MTV Base", country: "GB", category: "music", quality: "HD", online: true, tags: ["live", "uk", "hd"] },
  { id: "6", name: "National Geographic", country: "US", category: "documentary", quality: "4K", online: true, tags: ["4k", "live", "us"] },
  { id: "7", name: "Sky Sports 4K", country: "GB", category: "sports", quality: "4K", online: true, tags: ["sports", "live", "4k", "uk"] },
  { id: "8", name: "HBO Movies", country: "US", category: "movies", quality: "4K", online: true, tags: ["movies", "4k", "us"] },
  { id: "9", name: "France 24", country: "FR", category: "news", quality: "FHD", online: true, tags: ["news", "live"] },
  { id: "10", name: "Paramount Network", country: "US", category: "movies", quality: "FHD", online: true, tags: ["movies", "live", "us"] },
  { id: "11", name: "Sky Cinema", country: "GB", category: "movies", quality: "HD", online: false, tags: ["movies", "uk", "hd"] },
  { id: "12", name: "beIN Sports HD", country: "QA", category: "sports", quality: "FHD", online: true, tags: ["sports", "live", "hd"] },
];

export function SmartSearch() {
  const [query, setQuery]             = useState("");
  const [focused, setFocused]         = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>(["live"]);
  const inputRef = useRef<HTMLInputElement>(null);

  const toggleFilter = (id: string) => {
    setActiveFilters((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const matchedSuggestions = query.length >= 1
    ? SUGGESTIONS.filter((s) => s.query.toLowerCase().includes(query.toLowerCase()))
    : [];

  const filtered = FAKE_CHANNELS.filter((ch) => {
    if (query) {
      return ch.name.toLowerCase().includes(query.toLowerCase()) ||
        ch.category.includes(query.toLowerCase());
    }
    if (activeFilters.length === 0) return true;
    return activeFilters.every((f) => ch.tags.includes(f));
  });

  const activeCount = activeFilters.length + (query ? 1 : 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !focused) { e.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focused]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#09090f", fontFamily: "'Inter', sans-serif" }}
    >
      {/* Ambient glow behind search */}
      <div
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{
          height: 300,
          background: focused
            ? "radial-gradient(ellipse at 50% -20%, rgba(124,58,237,0.15) 0%, transparent 70%)"
            : "radial-gradient(ellipse at 50% -20%, rgba(124,58,237,0.06) 0%, transparent 60%)",
          transition: "background 0.4s ease",
        }}
      />

      {/* Header */}
      <div className="relative z-10 px-6 pt-6 pb-4 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)", boxShadow: "0 4px 16px rgba(124,58,237,0.35)" }}
            >
              <Tv style={{ width: 18, height: 18, color: "white" }} />
            </div>
            <span className="text-white font-bold tracking-tight">NetStream</span>
          </div>

          {/* The unified smart search bar */}
          <div
            className="relative flex-1"
            style={{
              filter: focused ? "drop-shadow(0 0 20px rgba(124,58,237,0.25))" : "none",
              transition: "filter 0.3s",
            }}
          >
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all"
              style={{
                background: focused ? "rgba(124,58,237,0.08)" : "rgba(255,255,255,0.06)",
                border: focused ? "1.5px solid rgba(124,58,237,0.5)" : "1.5px solid rgba(255,255,255,0.08)",
                transition: "all 0.25s",
              }}
            >
              {focused ? (
                <Sparkles style={{ width: 16, height: 16, color: "#a78bfa", flexShrink: 0 }} />
              ) : (
                <Search style={{ width: 16, height: 16, color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
              )}

              <input
                ref={inputRef}
                type="text"
                placeholder={focused ? "Search by channel, genre, country, quality…" : "Search channels, genres, countries… (press /)"}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 150)}
                className="flex-1 bg-transparent text-sm outline-none placeholder-white/25 text-white"
                style={{ caretColor: "#a78bfa" }}
              />

              {(query || activeFilters.length > 0) && (
                <div className="flex items-center gap-2">
                  {activeCount > 0 && (
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(124,58,237,0.25)", color: "#c4b5fd" }}
                    >
                      {activeCount} active
                    </span>
                  )}
                  <button
                    onClick={() => { setQuery(""); setActiveFilters([]); }}
                    style={{ color: "rgba(255,255,255,0.3)" }}
                  >
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              )}

              {!query && (
                <button
                  className="p-1.5 rounded-lg transition-all"
                  style={{ color: "rgba(255,255,255,0.25)" }}
                  title="Voice search"
                >
                  <Mic style={{ width: 14, height: 14 }} />
                </button>
              )}

              <div
                className="px-2 py-1 rounded-lg text-[10px] font-mono font-bold"
                style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" }}
              >
                /
              </div>
            </div>

            {/* Smart suggestions dropdown */}
            {focused && matchedSuggestions.length > 0 && (
              <div
                className="absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden z-50"
                style={{
                  background: "rgba(12,12,22,0.97)",
                  border: "1px solid rgba(124,58,237,0.2)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
                  backdropFilter: "blur(20px)",
                }}
              >
                <div className="px-3 pt-3 pb-1">
                  <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "rgba(167,139,250,0.6)" }}>
                    Smart Suggestions
                  </p>
                </div>
                {matchedSuggestions.map((s) => (
                  <button
                    key={s.query}
                    onClick={() => { setQuery(s.query); setFocused(false); }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left transition-all"
                    style={{ color: "rgba(255,255,255,0.7)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(124,58,237,0.1)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    {s.type === "smart" ? (
                      <Sparkles style={{ width: 13, height: 13, color: "#a78bfa", flexShrink: 0 }} />
                    ) : (
                      <Search style={{ width: 13, height: 13, color: "rgba(255,255,255,0.25)", flexShrink: 0 }} />
                    )}
                    <span className="flex-1">{s.query}</span>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}
                    >
                      {s.type === "smart" ? "smart" : "channel"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Channel count */}
          <div
            className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-full"
            style={{ background: "rgba(124,58,237,0.12)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.2)", whiteSpace: "nowrap" }}
          >
            {filtered.length} channels
          </div>
        </div>

        {/* Quick filter chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none" style={{ scrollbarWidth: "none" }}>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>
            Quick:
          </span>
          {QUICK_FILTERS.map((f) => {
            const active = activeFilters.includes(f.id);
            return (
              <button
                key={f.id}
                onClick={() => toggleFilter(f.id)}
                className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-full transition-all"
                style={{
                  background: active ? f.bg : "rgba(255,255,255,0.05)",
                  border: `1px solid ${active ? f.border : "rgba(255,255,255,0.07)"}`,
                  color: active ? f.color : "rgba(255,255,255,0.4)",
                  transform: active ? "scale(1.02)" : "scale(1)",
                  boxShadow: active ? `0 0 12px ${f.bg}` : "none",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Channel grid */}
      <div className="flex-1 px-5 pb-5 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
        {filtered.slice(0, 12).map((ch) => (
          <div
            key={ch.id}
            className="rounded-2xl overflow-hidden cursor-pointer transition-all"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="aspect-video flex items-center justify-center" style={{ background: "rgba(255,255,255,0.025)" }}>
              <LayoutGrid className="w-6 h-6" style={{ color: "rgba(255,255,255,0.1)" }} />
            </div>
            <div className="px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                {ch.online && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#4ade80", boxShadow: "0 0 4px #4ade80" }} />}
                <p className="text-white text-xs font-semibold truncate">{ch.name}</p>
              </div>
              <p className="text-xs mt-0.5 font-medium" style={{ color: "rgba(255,255,255,0.28)" }}>{ch.quality} · {ch.country}</p>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-12 gap-3">
            <Sparkles className="w-8 h-8" style={{ color: "rgba(167,139,250,0.2)" }} />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>No channels match</p>
            <button
              onClick={() => { setQuery(""); setActiveFilters([]); }}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: "rgba(124,58,237,0.15)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.25)" }}
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
