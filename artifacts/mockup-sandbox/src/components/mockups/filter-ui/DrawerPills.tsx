import { useState } from "react";
import { X, SlidersHorizontal, Search, Tv, LayoutGrid, ChevronUp } from "lucide-react";

const CATEGORIES = ["News", "Sports", "Entertainment", "Movies", "Music", "Kids", "Documentary", "General"];
const COUNTRIES = [
  { code: "US", flag: "🇺🇸", name: "USA" },
  { code: "GB", flag: "🇬🇧", name: "UK" },
  { code: "IN", flag: "🇮🇳", name: "India" },
  { code: "FR", flag: "🇫🇷", name: "France" },
  { code: "DE", flag: "🇩🇪", name: "Germany" },
  { code: "ES", flag: "🇪🇸", name: "Spain" },
  { code: "BR", flag: "🇧🇷", name: "Brazil" },
  { code: "TR", flag: "🇹🇷", name: "Turkey" },
  { code: "AU", flag: "🇦🇺", name: "Australia" },
  { code: "CA", flag: "🇨🇦", name: "Canada" },
];
const QUALITIES = ["4K", "FHD 1080p", "HD 720p", "SD"];

const FAKE_CHANNELS = [
  { id: "1", name: "BBC News", country: "GB", category: "News", quality: "FHD", online: true },
  { id: "2", name: "ESPN", country: "US", category: "Sports", quality: "HD", online: true },
  { id: "3", name: "CNN", country: "US", category: "News", quality: "FHD", online: true },
  { id: "4", name: "Disney Channel", country: "US", category: "Kids", quality: "HD", online: false },
  { id: "5", name: "MTV Base", country: "GB", category: "Music", quality: "HD", online: true },
  { id: "6", name: "Nat Geo", country: "US", category: "Documentary", quality: "4K", online: true },
  { id: "7", name: "Sky Sports", country: "GB", category: "Sports", quality: "4K", online: true },
  { id: "8", name: "HBO", country: "US", category: "Movies", quality: "4K", online: true },
  { id: "9", name: "France 24", country: "FR", category: "News", quality: "FHD", online: true },
  { id: "10", name: "Discovery", country: "US", category: "Documentary", quality: "HD", online: true },
];

interface ActiveFilter {
  id: string;
  label: string;
  type: "category" | "country" | "quality" | "live";
}

export function DrawerPills() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([
    { id: "news", label: "📰 News", type: "category" },
    { id: "US", label: "🇺🇸 USA", type: "country" },
  ]);
  const [search, setSearch] = useState("");
  const [drawerTab, setDrawerTab] = useState<"category" | "country" | "quality">("category");

  const removeFilter = (id: string) =>
    setActiveFilters((prev) => prev.filter((f) => f.id !== id));

  const addFilter = (filter: ActiveFilter) => {
    setActiveFilters((prev) => {
      const withoutSameType = prev.filter(
        (f) => !(filter.type !== "live" && f.type === filter.type)
      );
      return [...withoutSameType, filter];
    });
  };

  const hasType = (type: string) => activeFilters.some((f) => f.type === type);

  const filtered = FAKE_CHANNELS.filter((ch) => {
    const catFilter = activeFilters.find((f) => f.type === "category");
    const ctryFilter = activeFilters.find((f) => f.type === "country");
    const liveFilter = activeFilters.find((f) => f.type === "live");
    if (catFilter && ch.category !== catFilter.id) return false;
    if (ctryFilter && ch.country !== ctryFilter.id) return false;
    if (liveFilter && !ch.online) return false;
    if (search && !ch.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: "#09090f", fontFamily: "'Inter', sans-serif" }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-30 px-5 pt-5 pb-3 flex flex-col gap-3"
        style={{ background: "#09090f", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}
            >
              <Tv className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
            </div>
            <span className="text-white font-bold tracking-tight">NetStream</span>
          </div>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" style={{ width: 14, height: 14, color: "rgba(255,255,255,0.25)" }} />
            <input
              type="text"
              placeholder="Search channels..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-sm pl-9 pr-4 py-2.5 rounded-xl outline-none text-white placeholder-white/25"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.07)" }}
            />
          </div>
        </div>

        {/* Pills bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: "none" }}>
          {/* Filter button */}
          <button
            onClick={() => setDrawerOpen((v) => !v)}
            className="shrink-0 flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-full transition-all"
            style={{
              background: drawerOpen ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.07)",
              border: drawerOpen ? "1px solid rgba(124,58,237,0.5)" : "1px solid rgba(255,255,255,0.1)",
              color: drawerOpen ? "#a78bfa" : "rgba(255,255,255,0.6)",
            }}
          >
            <SlidersHorizontal style={{ width: 12, height: 12 }} />
            Filters
            {activeFilters.length > 0 && (
              <span
                className="w-4 h-4 rounded-full text-[10px] font-black flex items-center justify-center"
                style={{ background: "#7c3aed", color: "white" }}
              >
                {activeFilters.length}
              </span>
            )}
          </button>

          {/* Live pill */}
          <button
            onClick={() => {
              const liveActive = activeFilters.some((f) => f.type === "live");
              if (liveActive) removeFilter("live");
              else addFilter({ id: "live", label: "● Live", type: "live" });
            }}
            className="shrink-0 flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-full transition-all"
            style={{
              background: hasType("live") ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
              border: hasType("live") ? "1px solid rgba(34,197,94,0.35)" : "1px solid rgba(255,255,255,0.09)",
              color: hasType("live") ? "#4ade80" : "rgba(255,255,255,0.45)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: hasType("live") ? "#4ade80" : "rgba(255,255,255,0.25)", boxShadow: hasType("live") ? "0 0 5px #4ade80" : "none" }}
            />
            Live Only
          </button>

          {/* Active filter pills */}
          {activeFilters.map((f) => (
            <div
              key={f.id}
              className="shrink-0 flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-full"
              style={{
                background: "rgba(124,58,237,0.18)",
                border: "1px solid rgba(124,58,237,0.4)",
                color: "#c4b5fd",
              }}
            >
              <span>{f.label}</span>
              <button
                onClick={() => removeFilter(f.id)}
                className="rounded-full transition-all hover:bg-white/10"
                style={{ color: "rgba(196,181,253,0.6)" }}
              >
                <X style={{ width: 10, height: 10 }} />
              </button>
            </div>
          ))}

          {/* Channel count */}
          <div
            className="ml-auto shrink-0 text-xs font-bold px-3 py-1.5 rounded-full"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}
          >
            {filtered.length} channels
          </div>
        </div>
      </div>

      {/* Channel grid */}
      <div
        className="flex-1 p-5 grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", paddingBottom: drawerOpen ? 320 : 20 }}
      >
        {filtered.map((ch) => (
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
                {ch.online && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#4ade80" }} />}
                <p className="text-white text-xs font-semibold truncate">{ch.name}</p>
              </div>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{ch.quality}</p>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-12 gap-2">
            <Tv className="w-8 h-8" style={{ color: "rgba(255,255,255,0.1)" }} />
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>No channels match</p>
          </div>
        )}
      </div>

      {/* Filter drawer (slides up from bottom) */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl overflow-hidden transition-transform duration-300"
        style={{
          background: "rgba(13,13,24,0.98)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderBottom: "none",
          backdropFilter: "blur(30px)",
          boxShadow: "0 -20px 60px rgba(0,0,0,0.6)",
          transform: drawerOpen ? "translateY(0)" : "translateY(100%)",
          height: 310,
        }}
      >
        {/* Drawer handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
        </div>

        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-2">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>Filter Channels</span>
          <button onClick={() => setDrawerOpen(false)} style={{ color: "rgba(255,255,255,0.35)" }}>
            <ChevronUp style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 mb-3">
          {(["category", "country", "quality"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setDrawerTab(tab)}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
              style={{
                background: drawerTab === tab ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.05)",
                color: drawerTab === tab ? "#a78bfa" : "rgba(255,255,255,0.4)",
                border: drawerTab === tab ? "1px solid rgba(124,58,237,0.3)" : "1px solid transparent",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Options */}
        <div className="px-5 flex flex-wrap gap-2 overflow-y-auto" style={{ maxHeight: 160 }}>
          {drawerTab === "category" && CATEGORIES.map((cat) => {
            const emoji = { News: "📰", Sports: "⚽", Entertainment: "🎭", Movies: "🎥", Music: "🎵", Kids: "🧒", Documentary: "🎞️", General: "📺" }[cat] ?? "";
            const active = activeFilters.some((f) => f.id === cat.toLowerCase() && f.type === "category");
            return (
              <button key={cat}
                onClick={() => active ? removeFilter(cat.toLowerCase()) : addFilter({ id: cat.toLowerCase(), label: `${emoji} ${cat}`, type: "category" })}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-all"
                style={{
                  background: active ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.06)",
                  border: active ? "1px solid rgba(124,58,237,0.45)" : "1px solid rgba(255,255,255,0.08)",
                  color: active ? "#c4b5fd" : "rgba(255,255,255,0.55)",
                }}
              >
                <span>{emoji}</span>{cat}
              </button>
            );
          })}
          {drawerTab === "country" && COUNTRIES.map((c) => {
            const active = activeFilters.some((f) => f.id === c.code && f.type === "country");
            return (
              <button key={c.code}
                onClick={() => active ? removeFilter(c.code) : addFilter({ id: c.code, label: `${c.flag} ${c.name}`, type: "country" })}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-all"
                style={{
                  background: active ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.06)",
                  border: active ? "1px solid rgba(124,58,237,0.45)" : "1px solid rgba(255,255,255,0.08)",
                  color: active ? "#c4b5fd" : "rgba(255,255,255,0.55)",
                }}
              >
                <span>{c.flag}</span>{c.name}
              </button>
            );
          })}
          {drawerTab === "quality" && QUALITIES.map((q) => {
            const id = q.split(" ")[0].toLowerCase();
            const active = activeFilters.some((f) => f.id === id && f.type === "quality");
            return (
              <button key={q}
                onClick={() => active ? removeFilter(id) : addFilter({ id, label: q, type: "quality" })}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-all"
                style={{
                  background: active ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.06)",
                  border: active ? "1px solid rgba(124,58,237,0.45)" : "1px solid rgba(255,255,255,0.08)",
                  color: active ? "#c4b5fd" : "rgba(255,255,255,0.55)",
                }}
              >
                {q}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
