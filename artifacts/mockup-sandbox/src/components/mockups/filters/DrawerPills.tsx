import { useState } from "react";

const GENRES = ["General","News","Sports","Movies","Entertainment","Music","Kids","Documentary","Series","Business","Culture","Lifestyle","Animation","Comedy","Religious","Education"];
const COUNTRIES = [
  {code:"US",flag:"🇺🇸",name:"USA"},{code:"UK",flag:"🇬🇧",name:"UK"},{code:"IN",flag:"🇮🇳",name:"India"},
  {code:"ZA",flag:"🇿🇦",name:"S. Africa"},{code:"ES",flag:"🇪🇸",name:"Spain"},{code:"DE",flag:"🇩🇪",name:"Germany"},
  {code:"FR",flag:"🇫🇷",name:"France"},{code:"BR",flag:"🇧🇷",name:"Brazil"},{code:"AR",flag:"🇦🇷",name:"Argentina"},
  {code:"TR",flag:"🇹🇷",name:"Turkey"},{code:"IT",flag:"🇮🇹",name:"Italy"},{code:"CA",flag:"🇨🇦",name:"Canada"},
  {code:"AU",flag:"🇦🇺",name:"Australia"},{code:"MX",flag:"🇲🇽",name:"Mexico"},{code:"CH",flag:"🇨🇭",name:"Switzerland"},
  {code:"SA",flag:"🇸🇦",name:"Saudi Arabia"},{code:"QA",flag:"🇶🇦",name:"Qatar"},{code:"IR",flag:"🇮🇷",name:"Iran"},
  {code:"RU",flag:"🇷🇺",name:"Russia"},{code:"CN",flag:"🇨🇳",name:"China"},
];
const QUALITIES = [{id:"4k",label:"4K",sub:"2160p"},{id:"fhd",label:"FHD",sub:"1080p"},{id:"hd",label:"HD",sub:"720p"},{id:"sd",label:"SD",sub:"480p↓"}];

function Chip({ active, children, onClick }: { active?: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: active ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.06)",
      border: `1px solid ${active ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.1)"}`,
      borderRadius:"999px", padding:"6px 14px",
      color: active ? "#c4b5fd" : "rgba(255,255,255,0.65)",
      fontSize:"12px", fontWeight:600, cursor:"pointer", whiteSpace:"nowrap", transition:"all 0.15s"
    }}>{children}</button>
  );
}

export function DrawerPills() {
  const [genre, setGenre]     = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [quality, setQuality] = useState<string | null>(null);
  const [online, setOnline]   = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const activeFilters = [
    genre    ? { key:"genre",    label:`🎬 ${genre}`,    remove: () => setGenre(null) }    : null,
    country  ? { key:"country",  label:`${COUNTRIES.find(c=>c.code===country)?.flag} ${COUNTRIES.find(c=>c.code===country)?.name}`, remove: () => setCountry(null) } : null,
    quality  ? { key:"quality",  label:`⭐ ${quality?.toUpperCase()}`,  remove: () => setQuality(null) }  : null,
    online   ? { key:"online",   label:"🟢 Online",  remove: () => setOnline(false) }  : null,
  ].filter(Boolean) as { key: string; label: string; remove: () => void }[];

  return (
    <div style={{background:"#09090f",minHeight:"100vh",fontFamily:"system-ui,sans-serif",position:"relative"}}>
      {/* Header */}
      <div style={{background:"rgba(255,255,255,0.02)",borderBottom:"1px solid rgba(255,255,255,0.06)"}} className="px-8 py-5">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <div style={{background:"linear-gradient(135deg,#7c3aed,#6d28d9)"}} className="w-9 h-9 rounded-xl flex items-center justify-center text-lg">📺</div>
            <span style={{color:"white",fontSize:"20px",fontWeight:700}}>NetStream</span>
          </div>
          <div style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)"}} className="flex items-center gap-2 rounded-full px-4 py-2">
            <span style={{fontSize:"13px",color:"rgba(255,255,255,0.3)"}}>🔍 Search channels...</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-8 pt-5 flex gap-2 max-w-5xl mx-auto">
        {["All Channels","SA Sport","UK","Favorites"].map((t,i) => (
          <button key={t} style={{
            background: i===0 ? "white" : "rgba(255,255,255,0.05)",
            color: i===0 ? "black" : "rgba(255,255,255,0.5)",
            border:"none",borderRadius:"12px",padding:"8px 16px",fontSize:"13px",fontWeight:600,cursor:"pointer"
          }}>{t}</button>
        ))}
      </div>

      {/* ── ACTIVE FILTER PILLS BAR ── */}
      <div className="px-8 pt-4 pb-2 max-w-5xl mx-auto">
        <div className="flex items-center gap-2 flex-wrap min-h-[36px]">
          {activeFilters.length === 0 ? (
            <span style={{color:"rgba(255,255,255,0.2)",fontSize:"12px"}}>No filters active — click the filter button to refine results</span>
          ) : (
            activeFilters.map((f) => (
              <span key={f.key} style={{
                background:"rgba(139,92,246,0.12)", border:"1px solid rgba(139,92,246,0.3)",
                borderRadius:"999px", padding:"5px 12px 5px 10px",
                fontSize:"12px", color:"#c4b5fd", display:"inline-flex", alignItems:"center", gap:"6px"
              }}>
                {f.label}
                <button onClick={f.remove} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(196,181,253,0.5)",fontSize:"11px",lineHeight:1,padding:0}}>✕</button>
              </span>
            ))
          )}
          {activeFilters.length > 1 && (
            <button onClick={() => { setGenre(null); setCountry(null); setQuality(null); setOnline(false); }}
              style={{color:"rgba(255,255,255,0.3)",fontSize:"11px",background:"none",border:"none",cursor:"pointer",marginLeft:"4px"}}>
              Clear all
            </button>
          )}

          {/* Filter button — RIGHT aligned */}
          <button onClick={() => setDrawerOpen(true)} style={{marginLeft:"auto",
            background: activeFilters.length > 0 ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.06)",
            border: activeFilters.length > 0 ? "1px solid rgba(139,92,246,0.4)" : "1px solid rgba(255,255,255,0.1)",
            borderRadius:"12px", padding:"7px 16px", cursor:"pointer",
            color: activeFilters.length > 0 ? "#c4b5fd" : "rgba(255,255,255,0.7)",
            fontSize:"13px", fontWeight:600, display:"flex", alignItems:"center", gap:"6px"
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 3h12M3 7h8M5 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Filters
            {activeFilters.length > 0 && (
              <span style={{background:"#7c3aed",color:"white",borderRadius:"999px",fontSize:"10px",fontWeight:700,padding:"1px 6px",minWidth:18,textAlign:"center"}}>
                {activeFilters.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Channel count */}
      <div className="px-8 pb-3 max-w-5xl mx-auto">
        <p style={{color:"rgba(255,255,255,0.3)",fontSize:"12px"}}><span style={{color:"white",fontWeight:600}}>8,397</span> channels</p>
      </div>

      {/* Sample grid */}
      <div className="px-8 pb-8 max-w-5xl mx-auto">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(8)].map((_,i) => (
            <div key={i} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"16px",aspectRatio:"4/3",display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,0.2)",fontSize:"14px"}}>
              Channel {i+1}
            </div>
          ))}
        </div>
      </div>

      {/* ── DRAWER OVERLAY ── */}
      {drawerOpen && (
        <>
          <div onClick={() => setDrawerOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)",zIndex:40}} />
          <div style={{
            position:"fixed",bottom:0,left:0,right:0,zIndex:50,
            background:"#111118",borderTop:"1px solid rgba(255,255,255,0.1)",
            borderRadius:"24px 24px 0 0",padding:"24px",
            maxHeight:"75vh",overflowY:"auto"
          }}>
            {/* Handle */}
            <div style={{width:40,height:4,background:"rgba(255,255,255,0.2)",borderRadius:2,margin:"0 auto 20px"}} />

            <div className="flex items-center justify-between mb-5">
              <h3 style={{color:"white",fontSize:"18px",fontWeight:700}}>Filters</h3>
              <button onClick={() => setDrawerOpen(false)} style={{color:"rgba(255,255,255,0.4)",background:"rgba(255,255,255,0.06)",border:"none",borderRadius:"8px",width:32,height:32,cursor:"pointer",fontSize:"16px"}}>✕</button>
            </div>

            {/* Genre section */}
            <Section title="Genre">
              <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                <Chip active={genre===null} onClick={() => setGenre(null)}>All</Chip>
                {GENRES.map(g => <Chip key={g} active={genre===g} onClick={() => setGenre(genre===g?null:g)}>{g}</Chip>)}
              </div>
            </Section>

            {/* Country section */}
            <Section title="Country">
              <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                <Chip active={country===null} onClick={() => setCountry(null)}>🌍 All</Chip>
                {COUNTRIES.map(c => <Chip key={c.code} active={country===c.code} onClick={() => setCountry(country===c.code?null:c.code)}>{c.flag} {c.name}</Chip>)}
              </div>
            </Section>

            {/* Quality section */}
            <Section title="Quality">
              <div style={{display:"flex",gap:"8px"}}>
                <Chip active={quality===null} onClick={() => setQuality(null)}>All</Chip>
                {QUALITIES.map(q => <Chip key={q.id} active={quality===q.id} onClick={() => setQuality(quality===q.id?null:q.id)}>{q.label} <span style={{opacity:0.5,fontSize:"10px"}}>{q.sub}</span></Chip>)}
              </div>
            </Section>

            {/* Online */}
            <Section title="Status">
              <Chip active={online} onClick={() => setOnline(v=>!v)}>🟢 Online Only</Chip>
            </Section>

            {/* Apply button */}
            <button onClick={() => setDrawerOpen(false)} style={{
              width:"100%",background:"#7c3aed",color:"white",border:"none",
              borderRadius:"14px",padding:"14px",fontSize:"15px",fontWeight:700,cursor:"pointer",marginTop:"8px"
            }}>
              Show Results {activeFilters.length > 0 ? `(${activeFilters.length} filter${activeFilters.length>1?"s":""} active)` : ""}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{marginBottom:"24px"}}>
      <p style={{color:"rgba(255,255,255,0.35)",fontSize:"11px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"10px"}}>{title}</p>
      {children}
    </div>
  );
}
