import { useState, useEffect, useRef, useCallback } from "react";

// ⚠️ Sostituisci con la tua chiave da developers.giphy.com
const GIPHY_KEY = "dcApjiuczFNVUnC16oSYCkgLG7fu197tkr";
const GIPHY_SEARCH = "https://api.giphy.com/v1/gifs/search";
const GIPHY_TRENDING = "https://api.giphy.com/v1/gifs/trending";

const COLORS = ["#FF6B6B","#FF9F43","#FECA57","#48DBFB","#FF9FF3","#54A0FF","#A29BFE","#01CBC6"];
const COLLECTION_COLORS = ["#FF6B6B","#FF9F43","#FECA57","#48DBFB","#FF9FF3","#54A0FF","#A29BFE","#01CBC6","#6C5CE7","#00B894"];

function tagColor(tag) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = tag.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

function useLocalStorage(key, initial) {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : initial; }
    catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }, [key, val]);
  return [val, setVal];
}

export default function GIFpocket() {
  const [gifs, setGifs] = useLocalStorage("gifpocket_gifs", []);
  const [collections, setCollections] = useLocalStorage("gifpocket_collections", []);

  const [tab, setTab] = useState("pocket");
  const [activeCollection, setActiveCollection] = useState(null);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState(null);
  const [copied, setCopied] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  // GIPHY
  const [giphyQuery, setGiphyQuery] = useState("");
  const [giphyResults, setGiphyResults] = useState([]);
  const [giphyLoading, setGiphyLoading] = useState(false);
  const [savedIds, setSavedIds] = useState(new Set());
  const debounce = useRef(null);

  // Save modal
  const [saveModal, setSaveModal] = useState(null);
  const [pendingTags, setPendingTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [manualUrl, setManualUrl] = useState("");
  const [manualTitle, setManualTitle] = useState("");

  // Collection modal
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColEmoji, setNewColEmoji] = useState("📁");
  const [newColColor, setNewColColor] = useState(COLLECTION_COLORS[0]);

  // Add to collection from card
  const [addToColModal, setAddToColModal] = useState(null);

  useEffect(() => { setSavedIds(new Set(gifs.map((g) => g.giphyId).filter(Boolean))); }, [gifs]);

  const fetchGiphy = useCallback(async (q) => {
    setGiphyLoading(true);
    try {
      const url = q.trim()
        ? `${GIPHY_SEARCH}?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=24&rating=g`
        : `${GIPHY_TRENDING}?api_key=${GIPHY_KEY}&limit=24&rating=g`;
      const res = await fetch(url);
      const data = await res.json();
      setGiphyResults((data.data || []).map(g => ({
        id: g.id, giphyId: g.id,
        url: g.images.fixed_height.url,
        title: g.title,
      })));
    } catch { setGiphyResults([]); }
    finally { setGiphyLoading(false); }
  }, []);

  useEffect(() => { if (tab === "search") fetchGiphy(""); }, [tab]);

  function handleGiphyInput(e) {
    const q = e.target.value; setGiphyQuery(q);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => fetchGiphy(q), 500);
  }

  function openSaveModal(gif, source) {
    setSaveModal({ gif, source });
    setPendingTags([]); setTagInput(""); setSelectedCollections([]);
    setManualUrl(""); setManualTitle("");
  }

  function handleTagKey(e) {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      const t = tagInput.trim().replace(/,/g, "").toLowerCase();
      if (!pendingTags.includes(t)) setPendingTags((p) => [...p, t]);
      setTagInput("");
    }
  }

  function toggleSaveCollection(id) {
    setSelectedCollections((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  }

  function saveGif() {
    if (!saveModal) return;
    const { gif, source } = saveModal;
    const url = source === "giphy" ? gif.url : manualUrl.trim();
    if (!url) return;
    setGifs((prev) => [{
      id: Date.now(),
      giphyId: source === "giphy" ? gif.giphyId : undefined,
      url,
      title: source === "giphy" ? gif.title : (manualTitle.trim() || "GIF senza titolo"),
      tags: pendingTags.length > 0 ? pendingTags : [source === "giphy" ? "giphy" : "custom"],
      collections: selectedCollections,
      addedAt: Date.now(),
    }, ...prev]);
    setSaveModal(null);
  }

  function handleCopy(gif) {
    navigator.clipboard.writeText(gif.url);
    setCopied(gif.id); setTimeout(() => setCopied(null), 1800);
  }
  function handleDelete(id) { setGifs((prev) => prev.filter((g) => g.id !== id)); }

  function toggleGifCollection(gifId, colId) {
    setGifs((prev) => prev.map((g) => {
      if (g.id !== gifId) return g;
      const cols = g.collections || [];
      return { ...g, collections: cols.includes(colId) ? cols.filter((c) => c !== colId) : [...cols, colId] };
    }));
    setAddToColModal(prev => {
      if (!prev || prev.id !== gifId) return prev;
      const cols = prev.collections || [];
      return { ...prev, collections: cols.includes(colId) ? cols.filter((c) => c !== colId) : [...cols, colId] };
    });
  }

  function createCollection() {
    if (!newColName.trim()) return;
    setCollections((p) => [...p, { id: Date.now().toString(), name: newColName.trim(), emoji: newColEmoji, color: newColColor }]);
    setNewColName(""); setNewColEmoji("📁"); setNewColColor(COLLECTION_COLORS[0]);
    setShowNewCollection(false);
  }

  function deleteCollection(id) {
    setCollections((p) => p.filter((c) => c.id !== id));
    setGifs((prev) => prev.map((g) => ({ ...g, collections: (g.collections || []).filter((c) => c !== id) })));
    if (activeCollection === id) setActiveCollection(null);
  }

  const allTags = [...new Set(gifs.flatMap((g) => g.tags))];
  const filtered = gifs.filter((g) => {
    const ms = search === "" || g.title.toLowerCase().includes(search.toLowerCase()) || g.tags.some((t) => t.includes(search.toLowerCase()));
    const mt = activeTag === null || g.tags.includes(activeTag);
    const mc = activeCollection === null || (g.collections || []).includes(activeCollection);
    return ms && mt && mc;
  });
  const activeColObj = collections.find((c) => c.id === activeCollection);

  return (
    <div style={s.root}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box;} input::placeholder{color:#555;} button:hover{opacity:0.85;}`}</style>
      <div style={s.bgGlow} />

      <header style={s.header}>
        <div style={s.logo}>
          <span style={s.logoMark}>▣</span>
          <span style={s.logoText}>GIF<span style={s.logoOrange}>pocket</span></span>
        </div>
        <nav style={s.nav}>
          {[
            { id: "pocket", label: "Il mio Pocket", badge: gifs.length },
            { id: "collections", label: "Collezioni", badge: collections.length },
            { id: "search", label: "Cerca su GIPHY" },
          ].map((t) => (
            <button key={t.id} style={{ ...s.navBtn, ...(tab === t.id ? s.navActive : {}) }}
              onClick={() => { setTab(t.id); setActiveCollection(null); setActiveTag(null); setSearch(""); }}>
              {t.label}
              {t.badge > 0 && <span style={s.badge}>{t.badge}</span>}
            </button>
          ))}
        </nav>
        <button style={s.urlBtn} onClick={() => openSaveModal({ id: "_manual" }, "manual")}>+ URL</button>
      </header>

      {/* ── POCKET ── */}
      {tab === "pocket" && (
        <div style={s.page}>
          <div style={s.toolbar}>
            <div style={s.searchWrap}>
              <span style={s.sIco}>⌕</span>
              <input style={s.sInput} placeholder="Cerca nel tuo pocket..." value={search}
                onChange={(e) => { setSearch(e.target.value); setActiveTag(null); }} />
              {search && <button style={s.clearBtn} onClick={() => setSearch("")}>✕</button>}
            </div>
          </div>
          {collections.length > 0 && (
            <div style={s.tagRow}>
              <button style={{ ...s.chip, ...(activeCollection === null ? s.chipOn : {}) }} onClick={() => setActiveCollection(null)}>Tutte</button>
              {collections.map((c) => (
                <button key={c.id} onClick={() => setActiveCollection(activeCollection === c.id ? null : c.id)}
                  style={{ ...s.chip, borderColor: c.color + "77", color: activeCollection === c.id ? "#000" : c.color, background: activeCollection === c.id ? c.color : "transparent" }}>
                  {c.emoji} {c.name}
                </button>
              ))}
            </div>
          )}
          {allTags.length > 0 && (
            <div style={{ ...s.tagRow, marginTop: 6 }}>
              {allTags.map((t) => (
                <button key={t} onClick={() => setActiveTag(activeTag === t ? null : t)}
                  style={{ ...s.chip, fontSize: 11, borderColor: tagColor(t) + "77", color: activeTag === t ? "#000" : tagColor(t), background: activeTag === t ? tagColor(t) : "transparent" }}>
                  #{t}
                </button>
              ))}
            </div>
          )}
          <div style={s.countLine}>
            {filtered.length} GIF
            {activeColObj && <span style={{ color: activeColObj.color }}> · {activeColObj.emoji} {activeColObj.name}</span>}
            {activeTag && <span> · #{activeTag}</span>}
          </div>
          {gifs.length === 0 ? (
            <div style={s.empty}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
              <p style={s.emptyT}>Il tuo pocket è vuoto</p>
              <p style={s.emptyS}>Vai su "Cerca su GIPHY" per aggiungere le tue prime GIF</p>
              <button style={{ ...s.urlBtn, marginTop: 20, padding: "12px 24px", fontSize: 15 }} onClick={() => setTab("search")}>Cerca su GIPHY →</button>
            </div>
          ) : filtered.length === 0 ? (
            <div style={s.empty}><p style={s.emptyT}>Nessun risultato</p><p style={s.emptyS}>Prova un altro filtro</p></div>
          ) : (
            <div style={s.grid}>
              {filtered.map((gif) => (
                <div key={gif.id} style={s.card} onMouseEnter={() => setHoveredId(gif.id)} onMouseLeave={() => setHoveredId(null)}>
                  <div style={s.imgBox}>
                    <img src={gif.url} alt={gif.title} style={s.img} />
                    {hoveredId === gif.id && (
                      <div style={s.overlay}>
                        <button style={s.oBtn} onClick={() => handleCopy(gif)}>{copied === gif.id ? "✓ Copiato!" : "⎘ Copia URL"}</button>
                        <button style={{ ...s.oBtn, background: "rgba(255,159,67,0.2)", borderColor: "rgba(255,159,67,0.4)", color: "#FF9F43" }} onClick={() => setAddToColModal(gif)}>📁 Collezioni</button>
                        <button style={{ ...s.oBtn, ...s.oBtnRed }} onClick={() => handleDelete(gif.id)}>✕ Rimuovi</button>
                      </div>
                    )}
                  </div>
                  <div style={s.foot}>
                    <p style={s.cardTitle}>{gif.title}</p>
                    <div style={s.cardTags}>
                      {(gif.collections || []).map((cid) => {
                        const col = collections.find((c) => c.id === cid);
                        return col ? <span key={cid} style={{ ...s.mTag, color: col.color, borderColor: col.color + "55", fontSize: 10 }}>{col.emoji} {col.name}</span> : null;
                      })}
                      {gif.tags.map((t) => (
                        <span key={t} style={{ ...s.mTag, color: tagColor(t), borderColor: tagColor(t) + "55" }} onClick={() => setActiveTag(t)}>#{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── COLLECTIONS ── */}
      {tab === "collections" && (
        <div style={s.page}>
          <div style={s.colHeader}>
            <h2 style={s.colTitle}>Le tue Collezioni</h2>
            <button style={s.newColBtn} onClick={() => setShowNewCollection(true)}>+ Nuova</button>
          </div>
          {collections.length === 0 ? (
            <div style={s.empty}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
              <p style={s.emptyT}>Nessuna collezione</p>
              <p style={s.emptyS}>Crea la tua prima collezione per organizzare le GIF</p>
              <button style={{ ...s.urlBtn, marginTop: 20, padding: "12px 24px", fontSize: 15 }} onClick={() => setShowNewCollection(true)}>+ Crea Collezione</button>
            </div>
          ) : (
            <div style={s.colGrid}>
              {collections.map((col) => {
                const colGifs = gifs.filter((g) => (g.collections || []).includes(col.id));
                const preview = colGifs.slice(0, 4);
                return (
                  <div key={col.id} style={{ ...s.colCard, borderColor: col.color + "33" }}
                    onClick={() => { setActiveCollection(col.id); setTab("pocket"); }}>
                    <div style={{ ...s.colPreview, background: col.color + "11" }}>
                      {preview.length === 0 ? (
                        <span style={{ fontSize: 40, opacity: 0.25 }}>{col.emoji}</span>
                      ) : (
                        <div style={s.colPreviewGrid}>
                          {[0,1,2,3].map((i) => (
                            <div key={i} style={s.colPreviewCell}>
                              {preview[i] && <img src={preview[i].url} alt="" style={s.colPreviewImg} />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={s.colCardBody}>
                      <div style={s.colCardTop}>
                        <span style={s.colEmoji}>{col.emoji}</span>
                        <div>
                          <p style={s.colName}>{col.name}</p>
                          <p style={{ ...s.colCount, color: col.color }}>{colGifs.length} GIF</p>
                        </div>
                      </div>
                      <button style={s.colDeleteBtn} onClick={(e) => { e.stopPropagation(); deleteCollection(col.id); }}>✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── GIPHY SEARCH ── */}
      {tab === "search" && (
        <div style={s.page}>
          <div style={{ marginBottom: 20 }}>
            <div style={s.searchWrap}>
              <span style={s.sIco}>⌕</span>
              <input style={s.sInput} placeholder="Cerca GIF su GIPHY..." value={giphyQuery} onChange={handleGiphyInput} autoFocus />
              {giphyQuery && <button style={s.clearBtn} onClick={() => { setGiphyQuery(""); fetchGiphy(""); }}>✕</button>}
            </div>
            {!giphyQuery && <p style={{ fontSize: 12, color: "#444", marginTop: 10, fontStyle: "italic" }}>Trending adesso su GIPHY</p>}
          </div>
          {giphyLoading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 0" }}>
              <div style={{ width: 36, height: 36, border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "#FF9F43", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            </div>
          ) : giphyResults.length === 0 ? (
            <div style={s.empty}>
              <p style={s.emptyT}>Nessun risultato</p>
              <p style={s.emptyS}>Prova un altro termine di ricerca</p>
            </div>
          ) : (
            <div style={s.gGrid}>
              {giphyResults.map((g) => {
                const already = savedIds.has(g.giphyId);
                return (
                  <div key={g.id} style={s.gCard} onMouseEnter={() => setHoveredId("g_" + g.id)} onMouseLeave={() => setHoveredId(null)}>
                    <div style={s.imgBox}>
                      <img src={g.url} alt={g.title} style={s.img} />
                      {hoveredId === "g_" + g.id && (
                        <div style={s.overlay}>
                          {already
                            ? <button style={{ ...s.oBtn, opacity: 0.5 }}>✓ Già salvata</button>
                            : <button style={{ ...s.oBtn, background: "#FF9F43", color: "#000", borderColor: "#FF9F43", fontWeight: 700 }} onClick={() => openSaveModal(g, "giphy")}>+ Salva nel Pocket</button>
                          }
                        </div>
                      )}
                      {already && <div style={s.sBadge}>✓</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: SALVA ── */}
      {saveModal && (
        <div style={s.backdrop} onClick={() => setSaveModal(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.mHead}>
              <h2 style={s.mTitle}>{saveModal.source === "giphy" ? "Salva nel Pocket" : "Aggiungi da URL"}</h2>
              <button style={s.xBtn} onClick={() => setSaveModal(null)}>✕</button>
            </div>
            {saveModal.source === "giphy" ? (
              <img src={saveModal.gif.url} alt={saveModal.gif.title} style={{ width: "100%", borderRadius: 12, marginBottom: 20, maxHeight: 200, objectFit: "cover" }} />
            ) : (
              <>
                <label style={s.lbl}>URL della GIF *</label>
                <input style={s.mInput} placeholder="https://media.giphy.com/..." value={manualUrl} onChange={(e) => setManualUrl(e.target.value)} autoFocus />
                {manualUrl && (
                  <div style={{ borderRadius: 12, overflow: "hidden", margin: "12px 0", background: "#111", maxHeight: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <img src={manualUrl} alt="preview" style={{ maxWidth: "100%", maxHeight: 160, objectFit: "contain" }} />
                  </div>
                )}
                <label style={s.lbl}>Titolo</label>
                <input style={s.mInput} placeholder="Nome della GIF" value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} />
              </>
            )}
            <label style={s.lbl}>Tag (premi Enter)</label>
            <div style={s.tBox}>
              {pendingTags.map((t) => (
                <span key={t} style={{ ...s.ptag, background: tagColor(t) + "22", color: tagColor(t) }}>
                  #{t}<button style={s.rTag} onClick={() => setPendingTags((p) => p.filter((x) => x !== t))}>✕</button>
                </span>
              ))}
              <input style={s.tInline} placeholder={pendingTags.length === 0 ? "es: reazione, gatto..." : ""} value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={handleTagKey} autoFocus={saveModal.source === "giphy"} />
            </div>
            {collections.length > 0 && (
              <>
                <label style={s.lbl}>Aggiungi a Collezione</label>
                <div style={s.colCheckRow}>
                  {collections.map((c) => (
                    <button key={c.id} onClick={() => toggleSaveCollection(c.id)}
                      style={{ ...s.colCheck, borderColor: c.color + "66", background: selectedCollections.includes(c.id) ? c.color + "22" : "transparent", color: selectedCollections.includes(c.id) ? c.color : "#888" }}>
                      {selectedCollections.includes(c.id) && "✓ "}{c.emoji} {c.name}
                    </button>
                  ))}
                </div>
              </>
            )}
            <button style={{ ...s.saveBtn, opacity: (saveModal.source === "giphy" || manualUrl) ? 1 : 0.4 }} onClick={saveGif}>Salva nel Pocket →</button>
          </div>
        </div>
      )}

      {/* ── MODAL: GESTISCI COLLEZIONI DA CARD ── */}
      {addToColModal && (
        <div style={s.backdrop} onClick={() => setAddToColModal(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.mHead}>
              <h2 style={s.mTitle}>Gestisci Collezioni</h2>
              <button style={s.xBtn} onClick={() => setAddToColModal(null)}>✕</button>
            </div>
            <p style={{ color: "#666", fontSize: 13, marginTop: -12, marginBottom: 16 }}>{addToColModal.title}</p>
            {collections.length === 0 ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <p style={{ color: "#555" }}>Nessuna collezione creata</p>
                <button style={{ ...s.urlBtn, marginTop: 12 }} onClick={() => { setAddToColModal(null); setShowNewCollection(true); }}>+ Crea Collezione</button>
              </div>
            ) : (
              <div style={s.colCheckRow}>
                {collections.map((c) => {
                  const isIn = (addToColModal.collections || []).includes(c.id);
                  return (
                    <button key={c.id} onClick={() => toggleGifCollection(addToColModal.id, c.id)}
                      style={{ ...s.colCheck, borderColor: c.color + "66", background: isIn ? c.color + "22" : "transparent", color: isIn ? c.color : "#888" }}>
                      {isIn && "✓ "}{c.emoji} {c.name}
                    </button>
                  );
                })}
              </div>
            )}
            <button style={s.saveBtn} onClick={() => setAddToColModal(null)}>Fatto</button>
          </div>
        </div>
      )}

      {/* ── MODAL: NUOVA COLLEZIONE ── */}
      {showNewCollection && (
        <div style={s.backdrop} onClick={() => setShowNewCollection(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.mHead}>
              <h2 style={s.mTitle}>Nuova Collezione</h2>
              <button style={s.xBtn} onClick={() => setShowNewCollection(false)}>✕</button>
            </div>
            <label style={s.lbl}>Nome *</label>
            <input style={s.mInput} placeholder="es: Reazioni, Gatti, Lavoro..." value={newColName} onChange={(e) => setNewColName(e.target.value)} autoFocus />
            <label style={s.lbl}>Emoji</label>
            <input style={{ ...s.mInput, width: 80, textAlign: "center", fontSize: 22 }} value={newColEmoji} onChange={(e) => setNewColEmoji(e.target.value)} maxLength={2} />
            <label style={s.lbl}>Colore</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              {COLLECTION_COLORS.map((c) => (
                <button key={c} onClick={() => setNewColColor(c)}
                  style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: newColColor === c ? "3px solid #fff" : "3px solid transparent", cursor: "pointer" }} />
              ))}
            </div>
            <button style={{ ...s.saveBtn, opacity: newColName.trim() ? 1 : 0.4 }} onClick={createCollection} disabled={!newColName.trim()}>
              Crea Collezione →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  root: { minHeight: "100vh", background: "#0C0C0E", color: "#F0EDE8", fontFamily: "'DM Sans', sans-serif", position: "relative" },
  bgGlow: { position: "fixed", inset: 0, background: "radial-gradient(ellipse at 15% 15%, #1a1035 0%, transparent 55%), radial-gradient(ellipse at 85% 85%, #0d1f2d 0%, transparent 55%)", pointerEvents: "none", zIndex: 0 },
  header: { position: "sticky", top: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", background: "rgba(12,12,14,0.9)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)", gap: 10, flexWrap: "wrap" },
  logo: { display: "flex", alignItems: "center", gap: 8 },
  logoMark: { fontSize: 20, color: "#FF9F43" },
  logoText: { fontSize: 20, fontWeight: 700, letterSpacing: "-0.5px" },
  logoOrange: { color: "#FF9F43" },
  nav: { display: "flex", gap: 4, background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 4 },
  navBtn: { background: "none", border: "none", color: "#888", padding: "8px 14px", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 },
  navActive: { background: "rgba(255,255,255,0.1)", color: "#F0EDE8" },
  badge: { background: "#FF9F43", color: "#000", borderRadius: 100, padding: "1px 7px", fontSize: 11, fontWeight: 700 },
  urlBtn: { background: "rgba(255,159,67,0.15)", color: "#FF9F43", border: "1px solid rgba(255,159,67,0.3)", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  page: { position: "relative", zIndex: 1, padding: "20px 24px 60px" },
  toolbar: { marginBottom: 16 },
  searchWrap: { position: "relative", display: "flex", alignItems: "center", maxWidth: 480 },
  sIco: { position: "absolute", left: 14, fontSize: 18, color: "#555", pointerEvents: "none" },
  sInput: { width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "11px 40px", color: "#F0EDE8", fontSize: 14, outline: "none" },
  clearBtn: { position: "absolute", right: 12, background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 14 },
  tagRow: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 },
  chip: { background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 100, padding: "5px 12px", fontSize: 12, color: "#aaa", cursor: "pointer", fontWeight: 600 },
  chipOn: { background: "#FF9F43", color: "#000", borderColor: "#FF9F43" },
  countLine: { fontSize: 11, color: "#444", letterSpacing: "0.5px", textTransform: "uppercase", fontWeight: 600, marginBottom: 16 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 },
  gGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 },
  card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" },
  gCard: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" },
  imgBox: { position: "relative", aspectRatio: "4/3", overflow: "hidden", background: "#111" },
  img: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  overlay: { position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7 },
  oBtn: { background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, color: "#fff", padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", width: 160 },
  oBtnRed: { background: "rgba(255,80,80,0.15)", borderColor: "rgba(255,80,80,0.3)", color: "#ff6b6b" },
  sBadge: { position: "absolute", top: 8, right: 8, background: "#01CBC6", color: "#000", borderRadius: 100, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 },
  foot: { padding: "10px 12px" },
  cardTitle: { fontSize: 13, fontWeight: 600, margin: "0 0 6px", color: "#ddd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  cardTags: { display: "flex", gap: 4, flexWrap: "wrap" },
  mTag: { fontSize: 11, fontWeight: 600, border: "1px solid", borderRadius: 100, padding: "2px 7px", cursor: "pointer" },
  empty: { textAlign: "center", padding: "80px 0" },
  emptyT: { fontSize: 18, fontWeight: 700, color: "#444", margin: 0 },
  emptyS: { fontSize: 14, color: "#333", marginTop: 8 },
  colHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  colTitle: { fontSize: 22, fontWeight: 700, margin: 0 },
  newColBtn: { background: "#FF9F43", color: "#000", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  colGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 },
  colCard: { background: "rgba(255,255,255,0.04)", border: "1px solid", borderRadius: 16, overflow: "hidden", cursor: "pointer" },
  colPreview: { height: 130, display: "flex", alignItems: "center", justifyContent: "center" },
  colPreviewGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", width: "100%", height: "100%" },
  colPreviewCell: { overflow: "hidden", background: "#111" },
  colPreviewImg: { width: "100%", height: "100%", objectFit: "cover" },
  colCardBody: { padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  colCardTop: { display: "flex", alignItems: "center", gap: 10 },
  colEmoji: { fontSize: 24 },
  colName: { fontSize: 15, fontWeight: 700, margin: 0 },
  colCount: { fontSize: 12, fontWeight: 600, margin: "2px 0 0" },
  colDeleteBtn: { background: "rgba(255,80,80,0.1)", border: "none", color: "#ff6b6b", borderRadius: 8, width: 28, height: 28, cursor: "pointer", fontSize: 12 },
  colCheckRow: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 },
  colCheck: { border: "1px solid", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  backdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(10px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  modal: { background: "#161618", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: 24, width: "100%", maxWidth: 420, maxHeight: "90vh", overflowY: "auto" },
  mHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  mTitle: { fontSize: 18, fontWeight: 700, margin: 0 },
  xBtn: { background: "rgba(255,255,255,0.06)", border: "none", color: "#888", width: 30, height: 30, borderRadius: 8, cursor: "pointer", fontSize: 13 },
  lbl: { display: "block", fontSize: 11, fontWeight: 700, color: "#666", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 8, marginTop: 16 },
  mInput: { width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 14px", color: "#F0EDE8", fontSize: 14, outline: "none" },
  tBox: { display: "flex", flexWrap: "wrap", gap: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 10px", minHeight: 44, alignItems: "center" },
  ptag: { fontSize: 12, fontWeight: 600, borderRadius: 100, padding: "3px 10px", display: "flex", alignItems: "center", gap: 4 },
  rTag: { background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "inherit", padding: 0, opacity: 0.7 },
  tInline: { background: "none", border: "none", outline: "none", color: "#F0EDE8", fontSize: 13, flex: 1, minWidth: 120 },
  saveBtn: { width: "100%", marginTop: 20, background: "#FF9F43", color: "#000", border: "none", borderRadius: 12, padding: "13px", fontSize: 15, fontWeight: 700, cursor: "pointer" },
};
