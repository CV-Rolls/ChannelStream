import { useState, useRef, useEffect } from "react";

const GENRES = ["General","News","Sports","Movies","Entertainment","Music","Kids","Documentary","Series","Business","Culture","Lifestyle","Animation","Comedy","Religious","Education"];
const COUNTRIES = [
  {code:"US",flag:"🇺🇸",name:"USA"},{code:"UK",flag:"🇬🇧",name:"UK"},{code:"IN",flag:"🇮🇳",name:"India"},
  {code:"ZA",flag:"🇿🇦",name:"S. Africa"},{code:"ES",flag:"🇪🇸",name:"Spain"},{code:"DE",flag:"🇩🇪",name:"Germany"},
  {code:"FR",flag:"🇫🇷",name:"France"},{code:"BR",flag:"🇧🇷",name:"Brazil"},{code:"AR",flag:"🇦🇷",name:"Argentina"},
  {code:"TR",flag:"🇹🇷",name:"Turkey"},{code:"IT",flag:"🇮🇹",name:"Italy"},{code:"CA",flag:"🇨🇦",name:"Canada"},
  {code:"AU",flag:"🇦🇺",name:"Australia"},{code:"MX",flag:"🇲🇽",name:"Mexico"},{code:"CH",flag:"🇨🇭",name:"Switzerland"},
];
const QUALITIES = [{id:"4k",label:"4K",sub:"2160p"},{id:"fhd",label:"FHD",sub:"1080p"},{id:"hd",label:"HD",sub:"720p"},{id:"sd",label:"SD",sub:"480p↓"}];

function Dropdown({ label, active, children, accent = "violet" }: { label: string; active: boolean; children: React.ReactNode; accent?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)}
        style={{ background: active ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.05)" }}
        className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold transition-all select-none ${
          active ? "border-violet-500/50 text-violet-300" : "border-white/10 text-white/70 hover:text-white hover:border-white/20"
        }`}>
        {label}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{transform: open ? "rotate(180deg)" : "none", transition:"transform 0.2s"}}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div style={{background:"#111118",border:"1px solid rgba(255,255,255,0.08)",boxShadow:"0 24px 60px rgba(0,0,0,0.7)"}}
          className="absolute top-full left-0 mt-2 rounded-2xl overflow-hidden z-50 p-2 min-w-[220px]">
          {children}
        </div>
      )}
    </div>
  );
}

export function CommandBar() {
  const [genre, setGenre]     = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [quality, setQuality] = useState<string | null>(null);
  const [online, setOnline]   = useState(false);

  const active = [genre, country, quality].filter(Boolean).length + (online ? 1 : 0);

  return (
    <div style={{background:"#09090f",minHeight:"100vh",fontFamily:"system-ui,sans-serif"}}>
      {/* Header */}
      <div style={{background:"rgba(255,255,255,0.02)",borderBottom:"1px solid rgba(255,255,255,0.06)"}} className="px-8 py-5">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <div style={{background:"linear-gradient(135deg,#7c3aed,#6d28d9)"}} className="w-9 h-9 rounded-xl flex items-center justify-center text-lg">📺</div>
            <span style={{color:"white",fontSize:"20px",fontWeight:700}}>NetStream</span>
          </div>
          <div style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)"}} className="flex items-center gap-2 rounded-full px-4 py-2">
            <span style={{fontSize:"13px",color:"rgba(255,255,255,0.4)"}}>🔍</span>
            <span style={{fontSize:"13px",color:"rgba(255,255,255,0.3)"}}>Search channels...</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-8 pt-5 flex gap-2 max-w-5xl mx-auto">
        {["All Channels","SA Sport","UK","Favorites"].map((t,i) => (
          <button key={t} style={{
            background: i===0 ? "white" : "rgba(255,255,255,0.05)",
            color: i===0 ? "black" : "rgba(255,255,255,0.5)",
            border: "none", borderRadius:"12px", padding:"8px 16px",
            fontSize:"13px", fontWeight:600, cursor:"pointer"
          }}>{t}</button>
        ))}
      </div>

      {/* ── THE COMMAND BAR ── */}
      <div className="px-8 pt-4 pb-5 max-w-5xl mx-auto">
        <div className="flex items-center gap-2 flex-wrap">

          {/* Genre dropdown */}
          <Dropdown label={genre ? `🎬 ${genre}` : "🎬 Genre"} active={!!genre}>
            <div className="grid grid-cols-2 gap-0.5">
              {GENRES.map((g) => (
                <button key={g} onClick={() => { setGenre(genre === g ? null : g); }}
                  style={{
                    background: genre === g ? "rgba(139,92,246,0.2)" : "transparent",
                    color: genre === g ? "#c4b5fd" : "rgba(255,255,255,0.6)",
                    borderRadius:"8px", padding:"7px 10px", fontSize:"12px",
                    fontWeight:500, textAlign:"left", cursor:"pointer",
                  }}
                  onMouseEnter={e => { if (genre !== g) (e.target as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                  onMouseLeave={e => { if (genre !== g) (e.target as HTMLElement).style.background = "transparent"; }}
                >{g}</button>
              ))}
            </div>
          </Dropdown>

          {/* Country dropdown */}
          <Dropdown label={country ? `${COUNTRIES.find(c=>c.code===country)?.flag} ${COUNTRIES.find(c=>c.code===country)?.name}` : "🌍 Country"} active={!!country}>
            <div className="grid grid-cols-1 gap-0.5 max-h-64 overflow-y-auto" style={{scrollbarWidth:"none"}}>
              {COUNTRIES.map((c) => (
                <button key={c.code} onClick={() => setCountry(country === c.code ? null : c.code)}
                  style={{
                    background: country === c.code ? "rgba(139,92,246,0.2)" : "transparent",
                    color: country === c.code ? "#c4b5fd" : "rgba(255,255,255,0.6)",
                    borderRadius:"8px", padding:"8px 12px", fontSize:"13px",
                    fontWeight:500, textAlign:"left", cursor:"pointer", display:"flex", gap:"8px", alignItems:"center"
                  }}>{c.flag} {c.name}
                </button>
              ))}
            </div>
          </Dropdown>

          {/* Quality dropdown */}
          <Dropdown label={quality ? `⭐ ${QUALITIES.find(q=>q.id===quality)?.label}` : "⭐ Quality"} active={!!quality}>
            <div className="flex flex-col gap-0.5">
              {QUALITIES.map((q) => (
                <button key={q.id} onClick={() => setQuality(quality === q.id ? null : q.id)}
                  style={{
                    background: quality === q.id ? "rgba(139,92,246,0.2)" : "transparent",
                    color: quality === q.id ? "#c4b5fd" : "rgba(255,255,255,0.6)",
                    borderRadius:"8px", padding:"10px 14px", fontSize:"13px",
                    fontWeight:600, textAlign:"left", cursor:"pointer",
                    display:"flex", alignItems:"center", justifyContent:"space-between"
                  }}>
                  <span>{q.label}</span>
                  <span style={{fontSize:"11px",opacity:0.5}}>{q.sub}</span>
                </button>
              ))}
            </div>
          </Dropdown>

          {/* Online Only toggle */}
          <button onClick={() => setOnline(v => !v)}
            style={{
              background: online ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
              border: online ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(255,255,255,0.1)",
              borderRadius:"999px", padding:"7px 16px",
              color: online ? "#86efac" : "rgba(255,255,255,0.5)",
              fontSize:"13px", fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:"6px"
            }}>
            <span style={{width:7,height:7,borderRadius:"50%",background:online?"#22c55e":"rgba(255,255,255,0.3)",display:"inline-block"}}/>
            Online Only
          </button>

          {/* Clear */}
          {active > 0 && (
            <button onClick={() => { setGenre(null); setCountry(null); setQuality(null); setOnline(false); }}
              style={{marginLeft:"auto", color:"rgba(255,255,255,0.4)", fontSize:"12px", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:"4px"}}>
              ✕ Clear {active} filter{active > 1 ? "s" : ""}
            </button>
          )}
        </div>

        {/* Active filter pills */}
        {active > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {genre && <Pill label={`🎬 ${genre}`} onRemove={() => setGenre(null)} />}
            {country && <Pill label={`${COUNTRIES.find(c=>c.code===country)?.flag} ${COUNTRIES.find(c=>c.code===country)?.name}`} onRemove={() => setCountry(null)} />}
            {quality && <Pill label={`⭐ ${quality.toUpperCase()}`} onRemove={() => setQuality(null)} />}
            {online && <Pill label="🟢 Online" onRemove={() => setOnline(false)} />}
          </div>
        )}
      </div>

      {/* Sample grid */}
      <div className="px-8 pb-8 max-w-5xl mx-auto">
        <p style={{color:"rgba(255,255,255,0.3)", fontSize:"12px", marginBottom:"16px"}}>
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

function Pill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{background:"rgba(139,92,246,0.15)",border:"1px solid rgba(139,92,246,0.3)",borderRadius:"999px",padding:"4px 12px 4px 10px",fontSize:"11px",color:"#c4b5fd",display:"inline-flex",alignItems:"center",gap:"6px"}}>
      {label}
      <button onClick={onRemove} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(196,181,253,0.5)",lineHeight:1,padding:0,fontSize:"12px"}}>✕</button>
    </span>
  );
}
