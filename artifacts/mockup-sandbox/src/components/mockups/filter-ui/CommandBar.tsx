import { useState } from "react";
import { ChevronDown, X, Search, Tv, Check, SlidersHorizontal, LayoutGrid, Zap } from "lucide-react";

const CATEGORIES = [
  { id: "all", label: "All Genres", emoji: "" },
  { id: "news", label: "News", emoji: "📰" },
  { id: "sports", label: "Sports", emoji: "⚽" },
  { id: "entertainment", label: "Entertainment", emoji: "🎭" },
  { id: "movies", label: "Movies", emoji: "🎥" },
  { id: "music", label: "Music", emoji: "🎵" },
  { id: "kids", label: "Kids", emoji: "🧒" },
  { id: "documentary", label: "Documentary", emoji: "🎞️" },
  { id: "general", label: "General", emoji: "📺" },
];

const COUNTRIES = [
  { code: "all", name: "All Countries", flag: "" },
  { code: "US", name: "USA", flag: "🇺🇸" },
  { code: "GB", name: "UK", flag: "🇬🇧" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "TR", name: "Turkey", flag: "🇹🇷" },
  { code: "RU", name: "Russia", flag: "🇷🇺" },
];

const QUALITIES = [
  { id: "all", label: "All Quality" },
  { id: "4k", label: "4K" },
  { id: "fhd", label: "FHD 1080p" },
  { id: "hd", label: "HD 720p" },
  { id: "sd", label: "SD" },
];

const FAKE_CHANNELS = [
  { id: "1", name: "BBC News", country: "GB", category: "news", quality: "FHD", online: true },
  { id: "2", name: "ESPN", country: "US", category: "sports", quality: "HD", online: true },
  { id: "3", name: "CNN International", country: "US", category: "news", quality: "FHD", online: true },
  { id: "4", name: "Disney Channel", country: "US", category: "kids", quality: "HD", online: false },
  { id: "5", name: "MTV Base", country: "GB", category: "music", quality: "HD", online: true },
  { id: "6", name: "National Geographic", country: "US", category: "documentary", quality: "4K", online: true },
  { id: "7", name: "Sky Sports", country: "GB", category: "sports", quality: "4K", online: true },
  { id: "8", name: "HBO Movies", country: "US", category: "movies", quality: "4K", online: true },
  { id: "9", name: "Cartoon Network", country: "US", category: "kids", quality: "HD", online: false },
  { id: "10", name: "France 24", country: "FR", category: "news", quality: "FHD", online: true },
  { id: "11", name: "beIN Sports", country: "QA", category: "sports", quality: "FHD", online: true },
  { id: "12", name: "Discovery", country: "US", category: "documentary", quality: "HD", online: true },
];

type OpenMenu = "genre" | "country" | "quality" | null;

export function CommandBar() {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [category, setCategory] = useState("all");
  const [country, setCountry] = useState("all");
  const [quality, setQuality] = useState("all");
  const [search, setSearch] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);

  const toggleMenu = (menu: OpenMenu) =>
    setOpenMenu((prev) => (prev === menu ? null : menu));

  const activeCount = [category !== "all", country !== "all", quality !== "all", onlineOnly].filter(Boolean).length;

  const filtered = FAKE_CHANNELS.filter((ch) => {
    if (onlineOnly && !ch.online) return false;
    if (category !== "all" && ch.category !== category) return false;
    if (country !== "all" && ch.country !== country) return false;
    if (quality !== "all") {
      const qMap: Record<string, string[]> = { "4k": ["4K"], "fhd": ["FHD"], "hd": ["HD"], "sd": ["SD"] };
      if (!qMap[quality]?.some((q) => ch.quality.toUpperCase().includes(q))) return false;
    }
    if (search && !ch.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const catLabel = CATEGORIES.find((c) => c.id === category);
  const ctryLabel = COUNTRIES.find((c) => c.code === country);
  const qualLabel = QUALITIES.find((q) => q.id === quality);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#09090f", fontFamily: "'Inter', sans-serif" }}
      onClick={() => setOpenMenu(null)}
    >
      {/* Top command bar */}
      <div
        className="sticky top-0 z-40 border-b px-6 py-4 flex flex-col gap-3"
        style={{ background: "#09090f", borderColor: "rgba(255,255,255,0.06)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Row 1: Logo + search + live toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)" }}
            >
              <Tv className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
            </div>
            <span className="text-white font-bold text-base tracking-tight">NetStream</span>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
              style={{ width: 14, height: 14 }}
            />
            <input
              type="text"
              placeholder="Search channels..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-sm pl-9 pr-4 py-2.5 rounded-xl outline-none text-white placeholder-white/30"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
                caretColor: "#7c3aed",
              }}
            />
          </div>

          <div className="flex-1" />

          {/* Live toggle */}
          <button
            onClick={() => setOnlineOnly((v) => !v)}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl transition-all"
            style={{
              background: onlineOnly ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)",
              border: onlineOnly ? "1px solid rgba(34,197,94,0.35)" : "1px solid rgba(255,255,255,0.08)",
              color: onlineOnly ? "#4ade80" : "rgba(255,255,255,0.5)",
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: onlineOnly ? "#4ade80" : "rgba(255,255,255,0.2)",
                boxShadow: onlineOnly ? "0 0 6px #4ade80" : "none",
              }}
            />
            Live Only
          </button>

          {/* Channel count badge */}
          <div
            className="text-xs font-bold px-3 py-1.5 rounded-full"
            style={{ background: "rgba(124,58,237,0.15)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.25)" }}
          >
            {filtered.length} channels
          </div>
        </div>

        {/* Row 2: Command Dropdowns */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="text-white/30 shrink-0" style={{ width: 14, height: 14 }} />

          {/* Genre dropdown */}
          <div className="relative">
            <button
              onClick={() => toggleMenu("genre")}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-all"
              style={{
                background: category !== "all" ? "rgba(124,58,237,0.18)" : "rgba(255,255,255,0.05)",
                border: category !== "all" ? "1px solid rgba(124,58,237,0.4)" : "1px solid rgba(255,255,255,0.07)",
                color: category !== "all" ? "#c4b5fd" : "rgba(255,255,255,0.55)",
              }}
            >
              {catLabel?.emoji && <span className="text-base leading-none">{catLabel.emoji}</span>}
              <span>{catLabel?.label ?? "Genre"}</span>
              <ChevronDown
                style={{
                  width: 13, height: 13,
                  transform: openMenu === "genre" ? "rotate(180deg)" : "none",
                  transition: "transform 0.15s",
                  opacity: 0.5,
                }}
              />
            </button>
            {openMenu === "genre" && (
              <div
                className="absolute top-full left-0 mt-1.5 rounded-2xl p-1.5 z-50 min-w-[200px]"
                style={{
                  background: "rgba(15,15,26,0.97)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(124,58,237,0.1)",
                  backdropFilter: "blur(20px)",
                }}
              >
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => { setCategory(cat.id); setOpenMenu(null); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm transition-all text-left"
                    style={{
                      color: category === cat.id ? "#c4b5fd" : "rgba(255,255,255,0.6)",
                      background: category === cat.id ? "rgba(124,58,237,0.15)" : "transparent",
                    }}
                  >
                    {cat.emoji && <span className="w-5 text-center">{cat.emoji}</span>}
                    <span className="flex-1">{cat.label}</span>
                    {category === cat.id && <Check style={{ width: 13, height: 13, color: "#a78bfa" }} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Country dropdown */}
          <div className="relative">
            <button
              onClick={() => toggleMenu("country")}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-all"
              style={{
                background: country !== "all" ? "rgba(124,58,237,0.18)" : "rgba(255,255,255,0.05)",
                border: country !== "all" ? "1px solid rgba(124,58,237,0.4)" : "1px solid rgba(255,255,255,0.07)",
                color: country !== "all" ? "#c4b5fd" : "rgba(255,255,255,0.55)",
              }}
            >
              {ctryLabel?.flag && <span className="text-base leading-none">{ctryLabel.flag}</span>}
              <span>{ctryLabel?.name ?? "Country"}</span>
              <ChevronDown style={{ width: 13, height: 13, opacity: 0.5, transform: openMenu === "country" ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
            </button>
            {openMenu === "country" && (
              <div
                className="absolute top-full left-0 mt-1.5 rounded-2xl p-1.5 z-50 min-w-[200px]"
                style={{
                  background: "rgba(15,15,26,0.97)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(124,58,237,0.1)",
                  backdropFilter: "blur(20px)",
                }}
              >
                {COUNTRIES.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => { setCountry(c.code); setOpenMenu(null); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm transition-all text-left"
                    style={{
                      color: country === c.code ? "#c4b5fd" : "rgba(255,255,255,0.6)",
                      background: country === c.code ? "rgba(124,58,237,0.15)" : "transparent",
                    }}
                  >
                    {c.flag && <span className="w-5 text-center">{c.flag}</span>}
                    <span className="flex-1">{c.name}</span>
                    {country === c.code && <Check style={{ width: 13, height: 13, color: "#a78bfa" }} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quality dropdown */}
          <div className="relative">
            <button
              onClick={() => toggleMenu("quality")}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-all"
              style={{
                background: quality !== "all" ? "rgba(124,58,237,0.18)" : "rgba(255,255,255,0.05)",
                border: quality !== "all" ? "1px solid rgba(124,58,237,0.4)" : "1px solid rgba(255,255,255,0.07)",
                color: quality !== "all" ? "#c4b5fd" : "rgba(255,255,255,0.55)",
              }}
            >
              <Zap style={{ width: 13, height: 13, opacity: 0.7 }} />
              <span>{qualLabel?.label ?? "Quality"}</span>
              <ChevronDown style={{ width: 13, height: 13, opacity: 0.5, transform: openMenu === "quality" ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
            </button>
            {openMenu === "quality" && (
              <div
                className="absolute top-full left-0 mt-1.5 rounded-2xl p-1.5 z-50 min-w-[170px]"
                style={{
                  background: "rgba(15,15,26,0.97)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
                  backdropFilter: "blur(20px)",
                }}
              >
                {QUALITIES.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => { setQuality(q.id); setOpenMenu(null); }}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm transition-all text-left"
                    style={{
                      color: quality === q.id ? "#c4b5fd" : "rgba(255,255,255,0.6)",
                      background: quality === q.id ? "rgba(124,58,237,0.15)" : "transparent",
                    }}
                  >
                    <span className="flex-1">{q.label}</span>
                    {quality === q.id && <Check style={{ width: 13, height: 13, color: "#a78bfa" }} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Clear filters */}
          {activeCount > 0 && (
            <button
              onClick={() => { setCategory("all"); setCountry("all"); setQuality("all"); setOnlineOnly(false); }}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl ml-1 transition-all"
              style={{ color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <X style={{ width: 11, height: 11 }} />
              Clear {activeCount}
            </button>
          )}
        </div>
      </div>

      {/* Channel grid */}
      <div className="flex-1 p-5 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
        {filtered.slice(0, 12).map((ch) => (
          <div
            key={ch.id}
            className="rounded-2xl overflow-hidden cursor-pointer transition-all"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div
              className="aspect-video flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.03)" }}
            >
              <LayoutGrid className="w-6 h-6" style={{ color: "rgba(255,255,255,0.1)" }} />
            </div>
            <div className="px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                {ch.online && (
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#4ade80", boxShadow: "0 0 4px #4ade80", flexShrink: 0 }} />
                )}
                <p className="text-white text-xs font-semibold truncate">{ch.name}</p>
              </div>
              <p className="text-xs mt-0.5 font-medium" style={{ color: "rgba(255,255,255,0.3)" }}>{ch.quality}</p>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 gap-3">
            <Tv className="w-10 h-10" style={{ color: "rgba(255,255,255,0.1)" }} />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No channels match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
