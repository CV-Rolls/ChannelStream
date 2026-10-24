import { useState, useRef, useEffect } from "react";

const SUGGESTIONS = [
  { type:"genre",   label:"Sports",      icon:"⚽", hint:"Filter by genre" },
  { type:"genre",   label:"News",        icon:"📰", hint:"Filter by genre" },
  { type:"genre",   label:"Movies",      icon:"🎬", hint:"Filter by genre" },
  { type:"genre",   label:"Music",       icon:"🎵", hint:"Filter by genre" },
  { type:"genre",   label:"Kids",        icon:"🧒", hint:"Filter by genre" },
  { type:"country", label:"USA",         icon:"🇺🇸", hint:"United States" },
  { type:"country", label:"UK",          icon:"🇬🇧", hint:"United Kingdom" },
  { type:"country", label:"India",       icon:"🇮🇳", hint:"Country filter" },
  { type:"country", label:"South Africa",icon:"🇿🇦", hint:"Country filter" },
  { type:"quality", label:"4K",          icon:"✨", hint:"2160p streams" },
  { type:"quality", label:"FHD",         icon:"🌟", hint:"1080p streams" },
  { type:"quality", label:"HD",          icon:"💎", hint:"720p streams" },
];

const PRESETS = [
  { label:"🇿🇦 SA Sports",  filters:["Sports","South Africa"] },
  { label:"📺 UK News",      filters:["News","UK"] },
  { label:"🎬 4K Movies",   filters:["Movies","4K"] },
  { label:"🌍 World News",  filters:["News"] },
  { label:"🎵 Music TV",    filters:["Music"] },
  { label:"🧒 Kids Safe",   filters:["Kids"] },
];

export function SmartSearch() {
  const [query, setQuery]       = useState("");
  const [focused, setFocused]   = useState(false);
  const [activeFilters, setActiveFilters] = useState<{icon:string;label:string;type:string}[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.length > 0
    ? SUGGESTIONS.filter(s => s.label.toLowerCase().includes(query.toLowerCase()) || s.type.includes(query.toLowerCase()))
    : SUGGESTIONS.slice(0, 8);

  const addFilter = (s: typeof SUGGESTIONS[number]) => {
    if (!activeFilters.find(f => f.label === s.label)) {
      setActiveFilters(prev => [...prev, { icon: s.icon, label: s.label, type: s.type }]);
    }
    setQuery("");
    inputRef.current?.focus();
  };

  const removeFilter = (label: string) => setActiveFilters(prev => prev.filter(f => f.label !== label));

  const applyPreset = (preset: typeof PRESETS[number]) => {
    const newFilters = preset.filters.map(l => {
      const s = SUGGESTIONS.find(s => s.label === l);
      return s ? { icon: s.icon, label: s.label, type: s.type } : null;
    }).filter(Boolean) as { icon: string; label: string; type: string }[];
    setActiveFilters(newFilters);
  };

  return (
    <div style={{background:"#09090f",minHeight:"100vh",fontFamily:"system-ui,sans-serif"}}>
      {/* Header */}
      <div style={{background:"rgba(255,255,255,0.02)",borderBottom:"1px solid rgba(255,255,255,0.06)"}} className="px-8 py-5">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <div style={{background:"linear-gradient(135deg,#7c3aed,#6d28d9)"}} className="w-9 h-9 rounded-xl flex items-center justify-center text-lg">📺</div>
            <span style={{color:"white",fontSize:"20px",fontWeight:700}}>NetStream</span>
          </div>
          <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
            {["All Channels","SA Sport","UK","Favorites"].map((t,i) => (
              <button key={t} style={{
                background:i===0?"white":"rgba(255,255,255,0.05)",
                color:i===0?"black":"rgba(255,255,255,0.5)",
                border:"none",borderRadius:"10px",padding:"6px 14px",fontSize:"12px",fontWeight:600,cursor:"pointer"
              }}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── SMART SEARCH BAR ── */}
      <div className="px-8 py-6 max-w-5xl mx-auto">
        <div style={{position:"relative"}}>
          <div style={{
            background: focused ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.04)",
            border: focused ? "1.5px solid rgba(139,92,246,0.5)" : "1.5px solid rgba(255,255,255,0.1)",
            borderRadius:focused && (query || filtered.length)?"20px 20px 0 0":"20px",
            padding:"12px 16px", display:"flex", alignItems:"flex-start", gap:"10px",
            transition:"all 0.2s", flexWrap:"wrap", minHeight:48
          }}>
            {/* Search icon */}
            <span style={{color:"rgba(255,255,255,0.4)",fontSize:"16px",paddingTop:"2px",flexShrink:0}}>🔍</span>

            {/* Active filter chips inside search bar */}
            {activeFilters.map(f => (
              <span key={f.label} style={{
                background:"rgba(139,92,246,0.25)",border:"1px solid rgba(139,92,246,0.5)",
                borderRadius:"999px",padding:"2px 10px 2px 8px",fontSize:"12px",color:"#c4b5fd",
                display:"inline-flex",alignItems:"center",gap:"5px",flexShrink:0
              }}>
                {f.icon} {f.label}
                <button onClick={() => removeFilter(f.label)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(196,181,253,0.5)",fontSize:"11px",padding:0,lineHeight:1}}>✕</button>
              </span>
            ))}

            {/* Text input */}
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              placeholder={activeFilters.length === 0 ? "Search channels, countries, genres, quality..." : "Add more filters..."}
              style={{
                flex:1,background:"none",border:"none",outline:"none",
                color:"white",fontSize:"14px",
                placeholder: "rgba(255,255,255,0.3)"
              }}
            />

            {/* Clear all */}
            {(activeFilters.length > 0 || query) && (
              <button onClick={() => { setActiveFilters([]); setQuery(""); }}
                style={{color:"rgba(255,255,255,0.3)",background:"none",border:"none",cursor:"pointer",fontSize:"12px",flexShrink:0,paddingTop:"2px"}}>
                ✕ Clear
              </button>
            )}
          </div>

          {/* Dropdown suggestions */}
          {focused && (
            <div style={{
              background:"#111118",border:"1.5px solid rgba(139,92,246,0.3)",borderTop:"none",
              borderRadius:"0 0 20px 20px",overflow:"hidden",position:"absolute",width:"100%",zIndex:50,
              boxShadow:"0 20px 40px rgba(0,0,0,0.6)"
            }}>
              <div style={{padding:"8px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px"}}>
                {filtered.map(s => (
                  <button key={s.label} onMouseDown={() => addFilter(s)}
                    style={{
                      background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",
                      borderRadius:"12px",padding:"10px 14px",cursor:"pointer",textAlign:"left",
                      display:"flex",alignItems:"center",gap:"10px"
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}>
                    <span style={{fontSize:"18px"}}>{s.icon}</span>
                    <div>
                      <div style={{color:"white",fontSize:"13px",fontWeight:600}}>{s.label}</div>
                      <div style={{color:"rgba(255,255,255,0.35)",fontSize:"11px"}}>{s.hint}</div>
                    </div>
                    <span style={{marginLeft:"auto",background:"rgba(255,255,255,0.06)",borderRadius:"6px",padding:"2px 8px",fontSize:"10px",color:"rgba(255,255,255,0.3)",fontWeight:500,textTransform:"uppercase"}}>
                      {s.type}
                    </span>
                  </button>
                ))}
              </div>
              {filtered.length === 0 && (
                <div style={{padding:"24px",textAlign:"center",color:"rgba(255,255,255,0.3)",fontSize:"13px"}}>
                  No suggestions for "{query}"
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick preset pills */}
        {activeFilters.length === 0 && !focused && (
          <div style={{marginTop:"14px"}}>
            <p style={{color:"rgba(255,255,255,0.25)",fontSize:"11px",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:"8px"}}>Quick presets</p>
            <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
              {PRESETS.map(p => (
                <button key={p.label} onClick={() => applyPreset(p)} style={{
                  background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",
                  borderRadius:"999px",padding:"6px 14px",color:"rgba(255,255,255,0.6)",
                  fontSize:"12px",fontWeight:600,cursor:"pointer",transition:"all 0.15s"
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)"; (e.currentTarget as HTMLElement).style.color = "white"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)"; }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active filter summary */}
        {activeFilters.length > 0 && (
          <div style={{marginTop:"10px",display:"flex",alignItems:"center",gap:"6px"}}>
            <span style={{color:"rgba(255,255,255,0.3)",fontSize:"12px"}}>Filtering by:</span>
            {activeFilters.map(f => (
              <span key={f.label} style={{
                background:"rgba(139,92,246,0.12)",border:"1px solid rgba(139,92,246,0.25)",
                borderRadius:"999px",padding:"3px 10px",fontSize:"11px",color:"#c4b5fd"
              }}>{f.icon} {f.label}</span>
            ))}
          </div>
        )}
      </div>

      {/* Channel count + grid */}
      <div className="px-8 pb-8 max-w-5xl mx-auto">
        <p style={{color:"rgba(255,255,255,0.3)",fontSize:"12px",marginBottom:"16px"}}>
          <span style={{color:"white",fontWeight:600}}>8,397</span> channels
        </p>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(8)].map((_,i) => (
            <div key={i} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"16px",aspectRatio:"4/3",display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,0.2)",fontSize:"14px"}}>
              Channel {i+1}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
