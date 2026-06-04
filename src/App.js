import { useState, useEffect, useCallback } from "react";
import supabase from "./supabase";

const CATEGORIES = ["Vlees", "Vis", "Groenten", "Fruit", "Maaltijden", "Brood", "Zuivel", "Overig"];
const CATEGORY_ICONS = {
  Vlees: "🥩", Vis: "🐟", Groenten: "🥦", Fruit: "🍓",
  Maaltijden: "🍲", Brood: "🍞", Zuivel: "🧀", Overig: "📦"
};

const FREEZERS = {
  "Boven":  { icon: "🧊", color: "#5ac8fa", locaties: ["Plank 1", "Plank 2", "Plank 3", "Lade 1", "Lade 2"] },
  "Kelder": { icon: "🏠", color: "#bf5af2", locaties: ["Lade 1","Lade 2","Lade 3","Lade 4","Lade 5","Lade 6","Lade 7","Lade 8"] },
  "Bruine": { icon: "🤎", color: "#c98b4a", locaties: [] }
};

const DEMO_ITEMS = [
  { id: 1, name: "Kipfilet", category: "Vlees", quantity: 2, unit: "kg", frozenDate: "2026-05-10", expiryDate: "2026-08-10", vriezer: "Boven", locatie: "Plank 1", notes: "" },
  { id: 2, name: "Zalmmoten", category: "Vis", quantity: 4, unit: "stuks", frozenDate: "2026-05-20", expiryDate: "2026-08-20", vriezer: "Kelder", locatie: "Lade 2", notes: "Wilde zalm" },
  { id: 3, name: "Spinazie", category: "Groenten", quantity: 500, unit: "g", frozenDate: "2026-04-15", expiryDate: "2026-10-15", vriezer: "Kelder", locatie: "Lade 5", notes: "" },
  { id: 4, name: "Lasagne", category: "Maaltijden", quantity: 3, unit: "porties", frozenDate: "2026-05-28", expiryDate: "2026-08-28", vriezer: "Boven", locatie: "Lade 1", notes: "Zelfgemaakt" },
];

const ROW_ID = 1;
const APP_PASSWORD = "DihwwvdFA1962!";

function LoginScreen({ onLogin }) {
  const [pw, setPw] = useState("");
  const [fout, setFout] = useState(false);

  function probeer() {
    if (pw === APP_PASSWORD) { onLogin(); }
    else { setFout(true); setTimeout(() => setFout(false), 2000); }
  }

  return (
    <div style={{ minHeight:"100vh", background:"#0a0f1e", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans','Helvetica Neue',sans-serif", padding:24 }}>
      <div style={{ background:"#111827", borderRadius:20, padding:"40px 32px", width:"100%", maxWidth:360, border:"1px solid rgba(255,255,255,0.08)", textAlign:"center" }}>
        <div style={{ width:60, height:60, borderRadius:16, background:"linear-gradient(135deg,#5ac8fa,#007aff)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, margin:"0 auto 20px" }}>❄️</div>
        <div style={{ fontSize:22, fontWeight:700, color:"#e8eaf0", marginBottom:6 }}>FrostKeep</div>
        <div style={{ fontSize:13, color:"#8892a4", marginBottom:32 }}>Voer het wachtwoord in om verder te gaan</div>
        <input
          type="password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === "Enter" && probeer()}
          placeholder="Wachtwoord"
          style={{ width:"100%", background:"rgba(255,255,255,0.07)", border:`1px solid ${fout ? "#ff4444" : "rgba(255,255,255,0.1)"}`, borderRadius:10, padding:"12px 14px", color:"#e8eaf0", fontSize:15, outline:"none", boxSizing:"border-box", marginBottom:8, transition:"border-color 0.2s" }}
        />
        {fout && <div style={{ color:"#ff4444", fontSize:12, marginBottom:8 }}>Onjuist wachtwoord</div>}
        <button onClick={probeer} style={{ width:"100%", background:"linear-gradient(135deg,#5ac8fa,#007aff)", border:"none", borderRadius:10, color:"#fff", padding:"13px", fontSize:15, fontWeight:700, cursor:"pointer", marginTop:8 }}>
          Inloggen
        </button>
      </div>
    </div>
  );
}

function getDaysUntilExpiry(d) {
  return Math.ceil((new Date(d) - new Date()) / 86400000);
}
function getExpiryStatus(days) {
  if (days < 0) return "expired";
  if (days <= 30) return "soon";
  if (days <= 90) return "ok";
  return "fresh";
}

const STATUS_CONFIG = {
  expired: { label: "Verlopen",       color: "#ff4444", bg: "rgba(255,68,68,0.12)" },
  soon:    { label: "Bijna verlopen", color: "#ff9500", bg: "rgba(255,149,0,0.12)" },
  ok:      { label: "Goed",           color: "#34c759", bg: "rgba(52,199,89,0.12)" },
  fresh:   { label: "Vers",           color: "#5ac8fa", bg: "rgba(90,200,250,0.12)" },
};

const statusFilterMap = { "Alles":"Alles","Vers":"fresh","Goed":"ok","Bijna verlopen":"soon","Verlopen":"expired" };

async function loadFromDB() {
  const { data, error } = await supabase
    .from("items")
    .select("data")
    .eq("id", ROW_ID)
    .single();
  if (error || !data) return null;
  return JSON.parse(data.data);
}

async function saveToDB(items) {
  await supabase.from("items").upsert({ id: ROW_ID, data: JSON.stringify(items), updated_at: new Date().toISOString() });
}

export default function App() {
  const [ingelogd, setIngelogd] = useState(() => sessionStorage.getItem("fk_auth") === "1");

  if (!ingelogd) return <LoginScreen onLogin={() => { sessionStorage.setItem("fk_auth","1"); setIngelogd(true); }} />;

  return <FrostKeep />;
}

function FrostKeep() {
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  const [view, setView] = useState("grid");
  const [filterCat, setFilterCat] = useState("Alles");
  const [filterStatus, setFilterStatus] = useState("Alles");
  const [filterVriezer, setFilterVriezer] = useState("Alles");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("expiry");
  const [activeTab, setActiveTab] = useState("lijst");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const emptyForm = { name:"", category:"Vlees", quantity:"", unit:"stuks", frozenDate: new Date().toISOString().split("T")[0], expiryDate:"", vriezer:"Boven", locatie:"Plank 1", notes:"" };
  const [form, setForm] = useState(emptyForm);

  // Initial load
  useEffect(() => {
    (async () => {
      const remote = await loadFromDB();
      if (remote && remote.length > 0) {
        setItems(remote);
      } else {
        setItems(DEMO_ITEMS);
        await saveToDB(DEMO_ITEMS);
      }
      setLastSync(new Date());
      setReady(true);
    })();
  }, []);

  // Realtime sync via Supabase
  useEffect(() => {
    if (!ready) return;
    const channel = supabase
      .channel("items-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "items" }, async () => {
        const remote = await loadFromDB();
        if (remote) { setItems(remote); setLastSync(new Date()); }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [ready]);

  const updateItems = useCallback(async (newItems) => {
    setItems(newItems);
    setSyncing(true);
    await saveToDB(newItems);
    setLastSync(new Date());
    setSyncing(false);
  }, []);

  function handleSubmit() {
    if (!form.name || !form.expiryDate || !form.quantity) return;
    const newItems = editItem
      ? items.map(i => i.id === editItem.id ? { ...form, id: editItem.id } : i)
      : [...items, { ...form, id: Date.now() }];
    updateItems(newItems);
    setShowForm(false); setEditItem(null); setForm(emptyForm);
  }

  function handleDelete(id) { updateItems(items.filter(i => i.id !== id)); }
  function handleEdit(item) { setEditItem(item); setForm({ ...item }); setShowForm(true); }

  const filtered = items
    .filter(i => filterCat === "Alles" || i.category === filterCat)
    .filter(i => filterVriezer === "Alles" || i.vriezer === filterVriezer)
    .filter(i => { if (filterStatus === "Alles") return true; return getExpiryStatus(getDaysUntilExpiry(i.expiryDate)) === statusFilterMap[filterStatus]; })
    .filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "expiry") return new Date(a.expiryDate) - new Date(b.expiryDate);
      if (sortBy === "name")   return a.name.localeCompare(b.name);
      return a.category.localeCompare(b.category);
    });

  const expiringCount = items.filter(i => { const d = getDaysUntilExpiry(i.expiryDate); return d >= 0 && d <= 30; }).length;
  const expiredCount  = items.filter(i => getDaysUntilExpiry(i.expiryDate) < 0).length;

  if (!ready) return (
    <div style={{ minHeight:"100vh", background:"#0a0f1e", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16, color:"#8892a4", fontFamily:"'DM Sans','Helvetica Neue',sans-serif" }}>
      <div style={{ fontSize:48 }}>❄️</div>
      <div style={{ fontSize:15 }}>Voorraad laden…</div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#0a0f1e", color:"#e8eaf0", fontFamily:"'DM Sans','Helvetica Neue',sans-serif", padding:"0 0 60px" }}>

      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#0d1a3a 0%,#0a0f1e 100%)", borderBottom:"1px solid rgba(255,255,255,0.06)", padding:"24px 24px 20px", position:"sticky", top:0, zIndex:100, backdropFilter:"blur(20px)" }}>
        <div style={{ maxWidth:900, margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:12, background:"linear-gradient(135deg,#5ac8fa,#007aff)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>❄️</div>
              <div>
                <div style={{ fontSize:20, fontWeight:700, letterSpacing:"-0.5px" }}>FrostKeep</div>
                <div style={{ fontSize:11, color:"#8892a4", letterSpacing:"0.5px" }}>GEDEELDE VRIEZER VOORRAAD</div>
              </div>
            </div>
            <button onClick={() => { setShowForm(true); setEditItem(null); setForm(emptyForm); }} style={{ background:"linear-gradient(135deg,#5ac8fa,#007aff)", border:"none", borderRadius:10, color:"#fff", padding:"10px 18px", fontSize:14, fontWeight:600, cursor:"pointer" }}>
              + Toevoegen
            </button>
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
            {[
              { label:"Totaal", value:items.length, color:"#5ac8fa" },
              { label:"Bijna verlopen", value:expiringCount, color:"#ff9500" },
              { label:"Verlopen", value:expiredCount, color:"#ff4444" },
            ].map(s => (
              <div key={s.label} style={{ background:"rgba(255,255,255,0.05)", borderRadius:10, padding:"8px 16px", display:"flex", alignItems:"center", gap:8, border:"1px solid rgba(255,255,255,0.07)" }}>
                <span style={{ fontSize:18, fontWeight:700, color:s.color }}>{s.value}</span>
                <span style={{ fontSize:12, color:"#8892a4" }}>{s.label}</span>
              </div>
            ))}
            <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6, fontSize:11, color: syncing ? "#ff9500" : "#34c759" }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background: syncing ? "#ff9500" : "#34c759", boxShadow: syncing ? "0 0 6px #ff9500" : "0 0 6px #34c759" }} />
              {syncing ? "Opslaan…" : lastSync ? `Gesynchroniseerd ${lastSync.toLocaleTimeString("nl-NL", { hour:"2-digit", minute:"2-digit" })}` : ""}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:900, margin:"0 auto", padding:"20px 16px 0" }}>

        {/* Tabs */}
        <div style={{ display:"flex", gap:4, marginBottom:20, background:"rgba(255,255,255,0.05)", borderRadius:12, padding:4 }}>
          {[["lijst","📋 Alle producten"],["vriezers","🧊 Per vriezer"]].map(([k,l]) => (
            <button key={k} onClick={() => setActiveTab(k)} style={{ flex:1, padding:"9px", border:"none", borderRadius:9, cursor:"pointer", fontSize:13, fontWeight:600, background: activeTab===k ? "rgba(255,255,255,0.12)" : "transparent", color: activeTab===k ? "#e8eaf0" : "#8892a4" }}>{l}</button>
          ))}
        </div>

        {activeTab === "vriezers" ? (
          <div style={{ display:"grid", gap:20 }}>
            {Object.entries(FREEZERS).map(([naam, cfg]) => {
              const vItems = items.filter(i => i.vriezer === naam);
              return (
                <div key={naam} style={{ background:"rgba(255,255,255,0.03)", border:`1px solid ${cfg.color}30`, borderRadius:18, overflow:"hidden" }}>
                  <div style={{ background:`linear-gradient(135deg,${cfg.color}18,transparent)`, padding:"16px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontSize:22 }}>{cfg.icon}</span>
                      <div>
                        <div style={{ fontWeight:700, fontSize:16 }}>Vriezer {naam}</div>
                        <div style={{ fontSize:12, color:"#8892a4" }}>{cfg.locaties.length > 0 ? cfg.locaties.join(" · ") : "Geen vaste locaties"}</div>
                      </div>
                    </div>
                    <div style={{ background:`${cfg.color}20`, color:cfg.color, borderRadius:20, padding:"4px 14px", fontSize:13, fontWeight:700, border:`1px solid ${cfg.color}40` }}>
                      {vItems.length} product{vItems.length !== 1 ? "en" : ""}
                    </div>
                  </div>
                  {cfg.locaties.length > 0 ? (
                    <div style={{ padding:16, display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:10 }}>
                      {cfg.locaties.map(loc => {
                        const locItems = vItems.filter(i => i.locatie === loc);
                        return (
                          <div key={loc} style={{ background:"rgba(255,255,255,0.04)", borderRadius:12, padding:12, border:"1px solid rgba(255,255,255,0.07)", minHeight:70 }}>
                            <div style={{ fontSize:11, color:cfg.color, fontWeight:700, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.5px" }}>{loc}</div>
                            {locItems.length === 0
                              ? <div style={{ fontSize:12, color:"#4a5568", fontStyle:"italic" }}>Leeg</div>
                              : locItems.map(item => {
                                  const days = getDaysUntilExpiry(item.expiryDate);
                                  const scfg = STATUS_CONFIG[getExpiryStatus(days)];
                                  return (
                                    <div key={item.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                                      <span style={{ fontSize:12, color:"#c8d0de", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{CATEGORY_ICONS[item.category]} {item.name}</span>
                                      <span style={{ fontSize:10, color:scfg.color, marginLeft:6, flexShrink:0, fontWeight:600 }}>{days < 0 ? "!" : `${days}d`}</span>
                                    </div>
                                  );
                                })
                            }
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ padding:16 }}>
                      {vItems.length === 0
                        ? <div style={{ color:"#4a5568", fontSize:13, fontStyle:"italic" }}>Geen producten</div>
                        : vItems.map(item => {
                            const days = getDaysUntilExpiry(item.expiryDate);
                            const scfg = STATUS_CONFIG[getExpiryStatus(days)];
                            return (
                              <div key={item.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                                <span style={{ fontSize:18 }}>{CATEGORY_ICONS[item.category]}</span>
                                <span style={{ flex:1, fontSize:14 }}>{item.name}</span>
                                <span style={{ fontSize:12, color:"#8892a4" }}>{item.quantity} {item.unit}</span>
                                <span style={{ fontSize:11, color:scfg.color, fontWeight:600 }}>{days < 0 ? "Verlopen" : `nog ${days}d`}</span>
                              </div>
                            );
                          })
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Zoeken..." style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:9, padding:"8px 14px", color:"#e8eaf0", fontSize:13, outline:"none", flex:"1 1 140px", minWidth:120 }} />
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:9, padding:"8px 12px", color:"#e8eaf0", fontSize:13, outline:"none" }}>
                <option value="expiry">Datum</option>
                <option value="name">Naam</option>
                <option value="category">Categorie</option>
              </select>
              <button onClick={() => setView(view === "grid" ? "list" : "grid")} style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:9, padding:"8px 14px", color:"#8892a4", fontSize:13, cursor:"pointer" }}>
                {view === "grid" ? "☰ Lijst" : "⊞ Raster"}
              </button>
            </div>

            <div style={{ display:"flex", gap:6, marginBottom:10, overflowX:"auto", paddingBottom:2 }}>
              {["Alles", ...Object.keys(FREEZERS)].map(v => {
                const fc = v !== "Alles" ? FREEZERS[v] : null;
                return (
                  <button key={v} onClick={() => setFilterVriezer(v)} style={{ background: filterVriezer===v ? (fc ? `${fc.color}22` : "rgba(255,255,255,0.12)") : "rgba(255,255,255,0.04)", border:`1px solid ${filterVriezer===v ? (fc ? fc.color : "rgba(255,255,255,0.4)") : "rgba(255,255,255,0.1)"}`, borderRadius:20, padding:"5px 14px", color: filterVriezer===v ? (fc ? fc.color : "#e8eaf0") : "#8892a4", fontSize:12, cursor:"pointer", whiteSpace:"nowrap", fontWeight: filterVriezer===v ? 700 : 400 }}>
                    {v === "Alles" ? "Alle vriezers" : `${fc.icon} ${v}`}
                  </button>
                );
              })}
            </div>

            <div style={{ display:"flex", gap:6, marginBottom:10, overflowX:"auto", paddingBottom:2 }}>
              {["Alles", ...CATEGORIES].map(cat => (
                <button key={cat} onClick={() => setFilterCat(cat)} style={{ background: filterCat===cat ? "linear-gradient(135deg,#5ac8fa,#007aff)" : "rgba(255,255,255,0.06)", border:"1px solid "+(filterCat===cat ? "transparent" : "rgba(255,255,255,0.1)"), borderRadius:20, padding:"5px 14px", color: filterCat===cat ? "#fff" : "#8892a4", fontSize:12, cursor:"pointer", whiteSpace:"nowrap", fontWeight: filterCat===cat ? 600 : 400 }}>
                  {cat === "Alles" ? "Alles" : `${CATEGORY_ICONS[cat]} ${cat}`}
                </button>
              ))}
            </div>

            <div style={{ display:"flex", gap:6, marginBottom:20, flexWrap:"wrap" }}>
              {["Alles","Vers","Goed","Bijna verlopen","Verlopen"].map(s => {
                const k = statusFilterMap[s]; const sc = k !== "Alles" ? STATUS_CONFIG[k] : null;
                return (
                  <button key={s} onClick={() => setFilterStatus(s)} style={{ background: filterStatus===s ? (sc ? sc.bg : "rgba(255,255,255,0.12)") : "transparent", border:"1px solid "+(filterStatus===s ? (sc ? sc.color : "rgba(255,255,255,0.3)") : "rgba(255,255,255,0.1)"), borderRadius:8, padding:"4px 12px", color: filterStatus===s ? (sc ? sc.color : "#e8eaf0") : "#8892a4", fontSize:12, cursor:"pointer", fontWeight: filterStatus===s ? 600 : 400 }}>{s}</button>
                );
              })}
            </div>

            {filtered.length === 0
              ? <div style={{ textAlign:"center", padding:"60px 0", color:"#4a5568" }}><div style={{ fontSize:48, marginBottom:12 }}>🧊</div><div style={{ fontSize:16 }}>Geen producten gevonden</div></div>
              : <div style={{ display: view==="grid" ? "grid" : "flex", gridTemplateColumns: view==="grid" ? "repeat(auto-fill,minmax(260px,1fr))" : undefined, flexDirection: view==="list" ? "column" : undefined, gap:12 }}>
                  {filtered.map(item => {
                    const days = getDaysUntilExpiry(item.expiryDate);
                    const scfg = STATUS_CONFIG[getExpiryStatus(days)];
                    const fcfg = FREEZERS[item.vriezer];
                    return view === "grid"
                      ? <GridCard key={item.id} item={item} days={days} cfg={scfg} fcfg={fcfg} onEdit={handleEdit} onDelete={handleDelete} />
                      : <ListRow key={item.id} item={item} days={days} cfg={scfg} fcfg={fcfg} onEdit={handleEdit} onDelete={handleDelete} />;
                  })}
                </div>
            }
          </>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:200, backdropFilter:"blur(6px)" }} onClick={e => e.target===e.currentTarget && setShowForm(false)}>
          <div style={{ background:"#111827", borderRadius:"20px 20px 0 0", padding:"28px 24px 40px", width:"100%", maxWidth:520, border:"1px solid rgba(255,255,255,0.08)", maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
              <div style={{ fontSize:18, fontWeight:700 }}>{editItem ? "Product bewerken" : "Toevoegen aan vriezer"}</div>
              <button onClick={() => { setShowForm(false); setEditItem(null); }} style={{ background:"rgba(255,255,255,0.08)", border:"none", borderRadius:8, color:"#8892a4", padding:"6px 12px", cursor:"pointer", fontSize:14 }}>✕</button>
            </div>
            <div style={{ display:"grid", gap:14 }}>
              <Field label="Naam"><input value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="bijv. Kipfilet" style={inputStyle} /></Field>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Field label="Categorie">
                  <select value={form.category} onChange={e => setForm({...form, category:e.target.value})} style={inputStyle}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>)}
                  </select>
                </Field>
                <Field label="Eenheid">
                  <select value={form.unit} onChange={e => setForm({...form, unit:e.target.value})} style={inputStyle}>
                    {["stuks","porties","g","kg","ml","l","zakken","dozen"].map(u => <option key={u}>{u}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Hoeveelheid"><input type="number" value={form.quantity} onChange={e => setForm({...form, quantity:e.target.value})} placeholder="0" style={inputStyle} /></Field>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Field label="Vriezer">
                  <select value={form.vriezer} onChange={e => { const v=e.target.value; setForm({...form, vriezer:v, locatie:FREEZERS[v].locaties[0]||""}); }} style={{ ...inputStyle, borderColor: FREEZERS[form.vriezer]?.color+"60" }}>
                    {Object.keys(FREEZERS).map(v => <option key={v} value={v}>{FREEZERS[v].icon} {v}</option>)}
                  </select>
                </Field>
                <Field label="Locatie">
                  {FREEZERS[form.vriezer]?.locaties.length > 0
                    ? <select value={form.locatie} onChange={e => setForm({...form, locatie:e.target.value})} style={inputStyle}>{FREEZERS[form.vriezer].locaties.map(l => <option key={l}>{l}</option>)}</select>
                    : <input value={form.locatie} onChange={e => setForm({...form, locatie:e.target.value})} placeholder="bijv. Vak links" style={inputStyle} />
                  }
                </Field>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Field label="Ingevroren op"><input type="date" value={form.frozenDate} onChange={e => setForm({...form, frozenDate:e.target.value})} style={inputStyle} /></Field>
                <Field label="Houdbaar tot"><input type="date" value={form.expiryDate} onChange={e => setForm({...form, expiryDate:e.target.value})} style={inputStyle} /></Field>
              </div>
              <Field label="Notities (optioneel)"><input value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} placeholder="Eventuele notities..." style={inputStyle} /></Field>
              <button onClick={handleSubmit} style={{ background:"linear-gradient(135deg,#5ac8fa,#007aff)", border:"none", borderRadius:12, color:"#fff", padding:"14px", fontSize:15, fontWeight:700, cursor:"pointer", marginTop:4 }}>
                {editItem ? "Wijzigingen opslaan" : "Toevoegen aan vriezer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

}

function Field({ label, children }) {
  return <div><div style={{ fontSize:12, color:"#8892a4", marginBottom:6, fontWeight:500 }}>{label}</div>{children}</div>;
}

const inputStyle = { width:"100%", background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"10px 12px", color:"#e8eaf0", fontSize:14, outline:"none", boxSizing:"border-box" };

function GridCard({ item, days, cfg, fcfg, onEdit, onDelete }) {
  return (
    <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:16, padding:18, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:0, right:0, width:80, height:80, background:`radial-gradient(circle at top right,${cfg.color}18,transparent 70%)` }} />
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
        <div style={{ fontSize:28 }}>{CATEGORY_ICONS[item.category]}</div>
        <span style={{ background:cfg.bg, color:cfg.color, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:600, border:`1px solid ${cfg.color}40` }}>{cfg.label}</span>
      </div>
      <div style={{ fontSize:16, fontWeight:700, marginBottom:2 }}>{item.name}</div>
      <div style={{ fontSize:12, color:"#8892a4", marginBottom:8 }}>{item.category}</div>
      <div style={{ display:"inline-flex", alignItems:"center", gap:5, background:`${fcfg.color}15`, border:`1px solid ${fcfg.color}35`, borderRadius:8, padding:"3px 10px", marginBottom:10 }}>
        <span style={{ fontSize:10 }}>{fcfg.icon}</span>
        <span style={{ fontSize:11, color:fcfg.color, fontWeight:600 }}>{item.vriezer}{item.locatie ? ` · ${item.locatie}` : ""}</span>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"#8892a4", marginBottom:8 }}>
        <span>Aantal: <b style={{ color:"#e8eaf0" }}>{item.quantity} {item.unit}</b></span>
        <span style={{ color:cfg.color, fontWeight:600 }}>{days < 0 ? `${Math.abs(days)}d geleden` : days === 0 ? "Vandaag!" : `nog ${days}d`}</span>
      </div>
      <div style={{ fontSize:11, color:"#4a5568", marginBottom:14 }}>Houdbaar tot: {item.expiryDate}</div>
      {item.notes && <div style={{ fontSize:12, color:"#6b7590", marginBottom:12, fontStyle:"italic" }}>"{item.notes}"</div>}
      <div style={{ display:"flex", gap:8 }}>
        <button onClick={() => onEdit(item)} style={{ flex:1, background:"rgba(255,255,255,0.07)", border:"none", borderRadius:8, color:"#8892a4", padding:"7px", cursor:"pointer", fontSize:13 }}>✏️ Bewerken</button>
        <button onClick={() => onDelete(item.id)} style={{ background:"rgba(255,68,68,0.1)", border:"none", borderRadius:8, color:"#ff4444", padding:"7px 12px", cursor:"pointer", fontSize:13 }}>🗑</button>
      </div>
    </div>
  );
}

function ListRow({ item, days, cfg, fcfg, onEdit, onDelete }) {
  return (
    <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"14px 16px", display:"flex", alignItems:"center", gap:14 }}>
      <div style={{ fontSize:24, flexShrink:0 }}>{CATEGORY_ICONS[item.category]}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:600, fontSize:14, marginBottom:2 }}>{item.name}</div>
        <div style={{ fontSize:12, color:"#8892a4" }}>{item.category} · {item.quantity} {item.unit}</div>
        <div style={{ fontSize:11, marginTop:2 }}>
          <span style={{ color:fcfg.color, fontWeight:600 }}>{fcfg.icon} {item.vriezer}</span>
          {item.locatie && <span style={{ color:"#6b7590" }}> · {item.locatie}</span>}
        </div>
      </div>
      <div style={{ textAlign:"right", flexShrink:0 }}>
        <div style={{ color:cfg.color, fontWeight:700, fontSize:14 }}>{days < 0 ? `${Math.abs(days)}d geleden` : days === 0 ? "Vandaag!" : `nog ${days}d`}</div>
        <div style={{ fontSize:11, color:"#4a5568" }}>{item.expiryDate}</div>
      </div>
      <span style={{ background:cfg.bg, color:cfg.color, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:600, flexShrink:0, border:`1px solid ${cfg.color}40` }}>{cfg.label}</span>
      <div style={{ display:"flex", gap:6, flexShrink:0 }}>
        <button onClick={() => onEdit(item)} style={{ background:"rgba(255,255,255,0.07)", border:"none", borderRadius:7, color:"#8892a4", padding:"6px 10px", cursor:"pointer", fontSize:12 }}>✏️</button>
        <button onClick={() => onDelete(item.id)} style={{ background:"rgba(255,68,68,0.1)", border:"none", borderRadius:7, color:"#ff4444", padding:"6px 10px", cursor:"pointer", fontSize:12 }}>🗑</button>
      </div>
    </div>
  );
}
