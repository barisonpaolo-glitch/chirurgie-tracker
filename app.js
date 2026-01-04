/* Chirurgie Tracker PRO - offline-first PWA (localStorage) */
const STORAGE_KEY = "chirurgie-tracker:pro:v1";

const $ = (sel, root=document) => root.querySelector(sel);

function euro(n){
  const x = Number(n || 0);
  return x.toLocaleString("it-IT", { style:"currency", currency:"EUR" });
}
function isoDate(d){
  const pad=(v)=>String(v).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function clampDateToYear(dateStr, year){
  const min = `${year}-01-01`;
  const max = `${year}-12-31`;
  if(dateStr < min) return min;
  if(dateStr > max) return max;
  return dateStr;
}
function parseNum(x){
  const n = Number(String(x ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function escapeXml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&apos;");
}
function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}

function svgEdit(){
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 20h9" stroke="rgba(27,42,74,.9)" stroke-width="2" stroke-linecap="round"/>
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5Z"
      stroke="rgba(27,42,74,.9)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
function svgTrash(){
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3 6h18" stroke="rgba(27,42,74,.9)" stroke-width="2" stroke-linecap="round"/>
    <path d="M8 6V4h8v2" stroke="rgba(27,42,74,.9)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M6 6l1 16h10l1-16" stroke="rgba(27,42,74,.9)" stroke-width="2" stroke-linejoin="round"/>
    <path d="M10 11v6M14 11v6" stroke="rgba(27,42,74,.9)" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

let state = null;

async function loadSeed(){
  const res = await fetch("./seed_data.json", { cache: "no-cache" });
  if(!res.ok) throw new Error("Impossibile caricare seed_data.json");
  return await res.json();
}

async function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw){
    try { return JSON.parse(raw); } catch(e){}
  }
  const seed = await loadSeed();
  const today = isoDate(new Date());
  const init = {
    version: 1,
    years: seed.years,
    ui: {
      year: "2026",
      dateByYear: { "2025": "2025-01-01", "2026": "2026-01-01" }
    }
  };
  init.ui.dateByYear["2026"] = clampDateToYear(today, "2026");
  init.ui.dateByYear["2025"] = clampDateToYear(today, "2025");
  saveState(init);
  return init;
}

function saveState(s){
  state = s;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function getYear(){ return state.ui.year; }
function setYear(y){ state.ui.year = String(y); saveState(state); }
function getDate(){
  const y = getYear();
  return state.ui.dateByYear[y] || `${y}-01-01`;
}
function setDate(dateStr){
  const y = getYear();
  state.ui.dateByYear[y] = clampDateToYear(dateStr, y);
  saveState(state);
}
function yearData(y){ return state.years[String(y)]; }

function catalogMap(y){
  const map = new Map();
  for(const c of yearData(y).catalog) map.set(Number(c.id), c);
  return map;
}
function dayRecords(y, dateStr){
  const days = yearData(y).days;
  if(!days[dateStr]) days[dateStr] = [];
  return days[dateStr];
}
function setDayRecords(y, dateStr, recs){
  yearData(y).days[dateStr] = recs;
  saveState(state);
}

function recordLabel(catMap, rec){
  const ids = rec.procedures || [];
  if(rec.type === "double" && ids.length === 2){
    const a = catMap.get(ids[0])?.name || `ID ${ids[0]}`;
    const b = catMap.get(ids[1])?.name || `ID ${ids[1]}`;
    return `${a} + ${b}`;
  }
  if(ids.length === 1){
    return catMap.get(ids[0])?.name || `ID ${ids[0]}`;
  }
  return "Intervento";
}

function dailyStats(y, dateStr){
  const cat = catalogMap(y);
  const recs = dayRecords(y, dateStr);
  const n = recs.length;
  const total = recs.reduce((s,r)=>s + parseNum(r.price), 0);
  return { n, total, cat, recs };
}
function ytdStats(y, dateStr){
  const days = yearData(y).days;
  const dates = Object.keys(days).sort();
  let n=0, total=0;
  for(const d of dates){
    if(d > dateStr) break;
    const recs = days[d] || [];
    n += recs.length;
    total += recs.reduce((s,r)=>s + parseNum(r.price), 0);
  }
  return { n, total };
}
function allDailyTotals(y){
  const days = yearData(y).days;
  const dates = Object.keys(days).sort();
  return dates.map(d => ({
    date: d,
    total: (days[d] || []).reduce((s,r)=>s + parseNum(r.price), 0),
    n: (days[d] || []).length
  }));
}

function render(){
  const y = getYear();
  const dateStr = getDate();
  $("#yearSelect").value = y;
  $("#dateInput").value = dateStr;
  $("#dateInput").min = `${y}-01-01`;
  $("#dateInput").max = `${y}-12-31`;

  const d = new Date(dateStr + "T00:00:00");
  const fmt = new Intl.DateTimeFormat("it-IT", { weekday:"long", day:"2-digit", month:"long", year:"numeric" });
  $("#datePretty").textContent = fmt.format(d);

  const { n, total, cat, recs } = dailyStats(y, dateStr);
  $("#dayN").textContent = String(n);
  $("#dayTotal").textContent = euro(total);

  const ytd = ytdStats(y, dateStr);
  $("#ytdN").textContent = String(ytd.n);
  $("#ytdTotal").textContent = euro(ytd.total);

  const list = $("#dayList");
  list.innerHTML = "";
  if(recs.length === 0){
    const empty = document.createElement("div");
    empty.className = "note";
    empty.textContent = "Nessun intervento registrato per questo giorno.";
    list.appendChild(empty);
  } else {
    for(const rec of recs){
      const item = document.createElement("div");
      item.className = "item";

      const left = document.createElement("div");
      left.className = "meta";

      const title = document.createElement("div");
      title.className = "title";
      title.textContent = recordLabel(cat, rec);

      const small = document.createElement("div");
      small.className = "small";
      small.textContent = rec.type === "double" ? "Doppio intervento (conta come 1)" : "Singolo";

      left.appendChild(title);
      left.appendChild(small);

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.gap = "10px";
      right.style.alignItems = "center";

      const price = document.createElement("div");
      price.className = "price";
      price.textContent = euro(rec.price);

      const actions = document.createElement("div");
      actions.className = "actions";

      const editBtn = document.createElement("button");
      editBtn.className = "iconbtn";
      editBtn.setAttribute("aria-label","Modifica intervento");
      editBtn.innerHTML = svgEdit();
      editBtn.addEventListener("click", () => openModal({ mode:"edit", recId: rec.rid }));

      const delBtn = document.createElement("button");
      delBtn.className = "iconbtn";
      delBtn.setAttribute("aria-label","Elimina intervento");
      delBtn.innerHTML = svgTrash();
      delBtn.addEventListener("click", () => deleteRecord(rec.rid));

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      right.appendChild(price);
      right.appendChild(actions);

      item.appendChild(left);
      item.appendChild(right);

      list.appendChild(item);
    }
  }

  drawChart();
}

function moveDay(delta){
  const y = getYear();
  const d = new Date(getDate() + "T00:00:00");
  d.setDate(d.getDate() + delta);
  setDate(clampDateToYear(isoDate(d), y));
  render();
}

function deleteRecord(rid){
  const y = getYear();
  const dateStr = getDate();
  const recs = dayRecords(y, dateStr);
  const idx = recs.findIndex(r => r.rid === rid);
  if(idx < 0) return;
  const label = recordLabel(catalogMap(y), recs[idx]);
  if(!confirm(`Eliminare questo intervento?\n\n${label}`)) return;
  recs.splice(idx,1);
  setDayRecords(y, dateStr, recs);
  render();
}

// ---------------- Modal (add/edit) ----------------
const modal = $("#modal");
let modalCtx = null;

function openModal({ mode, recId }){
  const y = getYear();
  const dateStr = getDate();
  const cat = yearData(y).catalog.filter(c => c.active !== false);
  const catMap = catalogMap(y);

  modalCtx = { mode, recId, y, dateStr, cat, catMap, modeType: "single", selA:null, selB:null, priceTouched:false };

  $("#modalTitle").textContent = mode === "edit" ? "Modifica intervento" : "Nuovo intervento";
  $("#searchSingle").value = "";
  $("#searchA").value = "";
  $("#searchB").value = "";
  $("#priceInput").value = "";
  modalCtx.priceTouched = false;
  $("#noteInput").value = "";

  $("#selectedSingle").textContent = "—";
  $("#selectedA").textContent = "—";
  $("#selectedB").textContent = "—";

  setModeType("single");

  if(mode === "edit"){
    const rec = dayRecords(y, dateStr).find(r => r.rid === recId);
    if(!rec){ alert("Record non trovato."); return; }
    modalCtx.modeType = rec.type || "single";
    $("#noteInput").value = rec.note || "";
    if(rec.type === "double"){
      modalCtx.selA = rec.procedures?.[0] ?? null;
      modalCtx.selB = rec.procedures?.[1] ?? null;
      $("#selectedA").textContent = modalCtx.selA ? (catMap.get(modalCtx.selA)?.name || `ID ${modalCtx.selA}`) : "—";
      $("#selectedB").textContent = modalCtx.selB ? (catMap.get(modalCtx.selB)?.name || `ID ${modalCtx.selB}`) : "—";
      setModeType("double");
    } else {
      modalCtx.selA = rec.procedures?.[0] ?? null;
      $("#selectedSingle").textContent = modalCtx.selA ? (catMap.get(modalCtx.selA)?.name || `ID ${modalCtx.selA}`) : "—";
      setModeType("single");
    }
    $("#priceInput").value = String(rec.price ?? "");
    modalCtx.priceTouched = true;
  }

  rebuildPicklists();
  modal.classList.add("show");
  focusBestSearch();
}

function focusBestSearch(){
  if(modalCtx?.modeType === "double"){
    ($("#searchA").value ? $("#searchB") : $("#searchA")).focus();
  } else {
    $("#searchSingle").focus();
  }
}
function closeModal(){
  modal.classList.remove("show");
  modalCtx = null;
}

function setModeType(t){
  if(!modalCtx) return;
  modalCtx.modeType = t;
  $("#toggleSingle").classList.toggle("active", t==="single");
  $("#toggleDouble").classList.toggle("active", t==="double");
  $("#singleBlock").style.display = (t==="single") ? "block" : "none";
  $("#doubleBlock").style.display = (t==="double") ? "block" : "none";

  if(t==="single"){
    const def = modalCtx.selA ? modalCtx.catMap.get(modalCtx.selA)?.default_price : null;
    $("#defaultHintSingle").textContent = def != null ? `Default: ${euro(def)} (modificabile)` : "Seleziona un intervento";
  } else {
    updateDoubleDefaultHint();
  }


  // Recompute suggested price when switching mode, unless user already edited it
  if(!modalCtx.priceTouched){
    if(t==="single"){
      const def = modalCtx.selA ? (modalCtx.catMap.get(modalCtx.selA)?.default_price ?? 0) : 0;
      $("#priceInput").value = String(parseNum(def));
    } else {
      const a = modalCtx.selA ? (modalCtx.catMap.get(modalCtx.selA)?.default_price ?? 0) : 0;
      const b = modalCtx.selB ? (modalCtx.catMap.get(modalCtx.selB)?.default_price ?? 0) : 0;
      $("#priceInput").value = String(parseNum(a + b));
    }
  }

  rebuildPicklists();
  focusBestSearch();
}

function rebuildPicklists(){
  if(!modalCtx) return;
  if(modalCtx.modeType === "single"){
    buildPicklist($("#pickSingle"), $("#searchSingle").value, (id)=>selectSingle(id));
  } else {
    buildPicklist($("#pickA"), $("#searchA").value, (id)=>selectA(id));
    buildPicklist($("#pickB"), $("#searchB").value, (id)=>selectB(id));
  }
}

function buildPicklist(container, query, onPick){
  const q = (query||"").trim().toLowerCase();
  container.innerHTML = "";
  const items = modalCtx.cat
    .filter(c => {
      if(!q) return true;
      const name = String(c.name||"").toLowerCase();
      return name.startsWith(q) || name.includes(q);
    })
    .slice(0, 180);

  for(const c of items){
    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerHTML = `<div class="nm">${escapeHtml(c.name)}</div><div class="pr">${euro(c.default_price)}</div>`;
    btn.addEventListener("click", ()=>onPick(Number(c.id)));
    container.appendChild(btn);
  }

  if(items.length === 0){
    const div = document.createElement("div");
    div.className = "note";
    div.style.padding = "10px 12px";
    div.textContent = "Nessun intervento trovato.";
    container.appendChild(div);
  }
}

function maybeFillPriceDefault(v){
  // Fill/overwrite ONLY if user hasn't manually touched the price field
  if(!modalCtx) return;
  const inp = $("#priceInput");
  if(!inp) return;
  if(modalCtx.priceTouched) return;
  inp.value = String(parseNum(v));
}

function selectSingle(id){
  modalCtx.selA = id;
  $("#selectedSingle").textContent = modalCtx.catMap.get(id)?.name || `ID ${id}`;
  const def = modalCtx.catMap.get(id)?.default_price ?? 0;
  maybeFillPriceDefault(def);
  $("#defaultHintSingle").textContent = `Default: ${euro(def)} (modificabile)`;
}

function selectA(id){
  modalCtx.selA = id;
  $("#selectedA").textContent = modalCtx.catMap.get(id)?.name || `ID ${id}`;
  const sum = (modalCtx.catMap.get(modalCtx.selA)?.default_price ?? 0) + (modalCtx.catMap.get(modalCtx.selB)?.default_price ?? 0);
  maybeFillPriceDefault(sum);
  updateDoubleDefaultHint();
}
function selectB(id){
  modalCtx.selB = id;
  $("#selectedB").textContent = modalCtx.catMap.get(id)?.name || `ID ${id}`;
  const sum = (modalCtx.catMap.get(modalCtx.selA)?.default_price ?? 0) + (modalCtx.catMap.get(modalCtx.selB)?.default_price ?? 0);
  maybeFillPriceDefault(sum);
  updateDoubleDefaultHint();
}
function updateDoubleDefaultHint(){
  const a = modalCtx.selA ? (modalCtx.catMap.get(modalCtx.selA)?.default_price ?? 0) : 0;
  const b = modalCtx.selB ? (modalCtx.catMap.get(modalCtx.selB)?.default_price ?? 0) : 0;
  const sum = a + b;
  $("#defaultHintDouble").textContent = (modalCtx.selA || modalCtx.selB) ? `Somma default: ${euro(sum)} (modificabile)` : "Seleziona 2 interventi da sommare";
}

function confirmModal(){
  if(!modalCtx) return;
  const y = modalCtx.y;
  const dateStr = modalCtx.dateStr;
  const recs = dayRecords(y, dateStr);

  const price = parseNum($("#priceInput").value);
  const note = ($("#noteInput").value || "").trim();

  if(modalCtx.modeType === "single"){
    if(!modalCtx.selA){ alert("Seleziona un intervento."); return; }
    const payload = { type:"single", procedures:[modalCtx.selA], price, note };
    if(modalCtx.mode === "edit"){
      const idx = recs.findIndex(r => r.rid === modalCtx.recId);
      if(idx<0){ alert("Record non trovato."); return; }
      recs[idx] = { ...recs[idx], ...payload };
    } else {
      recs.push({ rid: makeRid(dateStr), created_from:"app", ...payload });
    }
  } else {
    if(!modalCtx.selA || !modalCtx.selB){ alert("Seleziona 2 interventi."); return; }
    const payload = { type:"double", procedures:[modalCtx.selA, modalCtx.selB], price, note };
    if(modalCtx.mode === "edit"){
      const idx = recs.findIndex(r => r.rid === modalCtx.recId);
      if(idx<0){ alert("Record non trovato."); return; }
      recs[idx] = { ...recs[idx], ...payload };
    } else {
      recs.push({ rid: makeRid(dateStr), created_from:"app", ...payload });
    }
  }

  setDayRecords(y, dateStr, recs);
  closeModal();
  render();
}

function makeRid(dateStr){
  const now = new Date();
  const pad=(v)=>String(v).padStart(2,"0");
  const t = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const r = Math.random().toString(16).slice(2,6);
  return `${dateStr.replaceAll("-","")}-${t}-${r}`;
}



function byId(id){ return document.getElementById(id); }

function safeOn(id, ev, fn){
  const el = byId(id) || document.querySelector("#"+id);
  if(!el) return;
  el.addEventListener(ev, fn);
}

function getCatalogModalEl(){ return byId("catalogModal"); }
function getChartModalEl(){ return byId("chartModal"); }

// ---------------- Catalog modal (CRUD interventi) ----------------
let catalogModal = null;
let catalogCtx = null;

function getCatalog(year){
  return yearData(year).catalog || [];
}
function nextCatalogId(year){
  const cat = getCatalog(year);
  let maxId = 0;
  for(const c of cat){
    const id = Number(c.id);
    if(Number.isFinite(id) && id > maxId) maxId = id;
  }
  return maxId + 1;
}

function openCatalogModal(){
  catalogModal = getCatalogModalEl();
  if(!catalogModal){
    alert("Errore: finestra Catalogo non trovata. Aggiorna la pagina (Ctrl+F5) o reinstalla la PWA.");
    return;
  }
  const y = getYear();
  catalogCtx = { year: y, selectedId: null };
  $("#catSearch").value = "";
  $("#catShowArchived").checked = false;
  newCatalogItem();
  renderCatalogList();
  catalogModal.classList.add("show");
  $("#catSearch").focus();
}
function closeCatalogModal(){
  catalogModal = getCatalogModalEl();
  if(!catalogModal) return;
  if(!catalogModal) return;
  catalogModal.classList.remove("show");
  catalogCtx = null;
}

function renderCatalogList(){
  if(!catalogCtx) return;
  const year = catalogCtx.year;
  const cat = getCatalog(year);
  const q = ($("#catSearch").value || "").trim().toLowerCase();
  const showArchived = $("#catShowArchived").checked;

  const items = cat
    .filter(c => showArchived ? true : (c.active !== false))
    .filter(c => {
      if(!q) return true;
      const nm = String(c.name || "").toLowerCase();
      return nm.startsWith(q) || nm.includes(q);
    })
    .sort((a,b) => String(a.name||"").localeCompare(String(b.name||""), "it-IT"))
    .slice(0, 300);

  const list = $("#catList");
  list.innerHTML = "";

  for(const c of items){
    const btn = document.createElement("button");
    btn.type = "button";
    const archived = (c.active === false);
    btn.innerHTML = `
      <div class="nm">${escapeHtml(c.name || "(senza nome)")}${archived ? " <span style='color:rgba(91,107,132,.8)'>· archiviato</span>" : ""}</div>
      <div class="pr">ID ${escapeHtml(c.id)} · ${euro(c.default_price)}</div>
    `;
    btn.addEventListener("click", () => selectCatalogItem(Number(c.id)));
    list.appendChild(btn);
  }

  if(items.length === 0){
    const div = document.createElement("div");
    div.className = "note";
    div.style.padding = "10px 12px";
    div.textContent = "Nessun intervento trovato.";
    list.appendChild(div);
  }

  if(catalogCtx.selectedId == null && items.length > 0 && $("#catId").value !== "(nuovo)"){
    selectCatalogItem(Number(items[0].id));
  }
}

function selectCatalogItem(id){
  if(!catalogCtx) return;
  const year = catalogCtx.year;
  const cat = getCatalog(year);
  const item = cat.find(c => Number(c.id) === Number(id));
  if(!item) return;

  catalogCtx.selectedId = Number(id);
  $("#catId").value = String(item.id);
  $("#catName").value = String(item.name || "");
  $("#catPrice").value = String(parseNum(item.default_price));
  $("#catActive").checked = (item.active !== false);
  $("#catArchiveBtn").textContent = (item.active === false) ? "Ripristina" : "Archivia";
}

function newCatalogItem(){
  if(!catalogCtx) return;
  catalogCtx.selectedId = null;
  $("#catId").value = "(nuovo)";
  $("#catName").value = "";
  $("#catPrice").value = "";
  $("#catActive").checked = true;
  $("#catArchiveBtn").textContent = "Archivia";
}

function saveCatalogItem(){
  if(!catalogCtx) return;
  const year = catalogCtx.year;
  const cat = getCatalog(year);

  const name = ($("#catName").value || "").trim();
  const price = parseNum($("#catPrice").value);
  const active = $("#catActive").checked;

  if(!name){
    alert("Inserisci un nome per l’intervento.");
    $("#catName").focus();
    return;
  }

  if(catalogCtx.selectedId == null){
    const id = nextCatalogId(year);
    cat.push({ id, name, default_price: price, active });
    yearData(year).catalog = cat;
    saveState(state);
    catalogCtx.selectedId = id;
    $("#catId").value = String(id);
    alert("Intervento aggiunto.");
  } else {
    const item = cat.find(c => Number(c.id) === Number(catalogCtx.selectedId));
    if(!item){ alert("Elemento non trovato."); return; }
    item.name = name;
    item.default_price = price;
    item.active = active;
    saveState(state);
    alert("Modifiche salvate.");
  }

  $("#catArchiveBtn").textContent = ($("#catActive").checked) ? "Archivia" : "Ripristina";
  renderCatalogList();
  render();
}

function toggleArchiveCatalogItem(){
  if(!catalogCtx || catalogCtx.selectedId == null) return;
  const year = catalogCtx.year;
  const cat = getCatalog(year);
  const item = cat.find(c => Number(c.id) === Number(catalogCtx.selectedId));
  if(!item) return;

  const nowActive = (item.active !== false);
  if(nowActive){
    if(!confirm("Archiviare questo intervento?\n\nNon comparirà più nella selezione, ma resterà compatibile con i record già salvati.")) return;
    item.active = false;
  } else {
    item.active = true;
  }
  $("#catActive").checked = (item.active !== false);
  $("#catArchiveBtn").textContent = (item.active === false) ? "Ripristina" : "Archivia";
  saveState(state);
  renderCatalogList();
  render();
}


// ------------- Chart -------------
function monthKeyFromDate(dateStr){ return dateStr.slice(0,7); }

function monthTotals(year){
  const yd = yearData(String(year));
  const out = Array.from({length:12}, (_,i)=>({ idx:i, key:`${year}-${String(i+1).padStart(2,"0")}`, n:0, total:0 }));
  const days = yd.days || {};
  for(const d of Object.keys(days)){
    const m = d.slice(0,7);
    const recs = days[d] || [];
    const t = recs.reduce((s,r)=>s+parseNum(r.price),0);
    const obj = out.find(x=>x.key===m);
    if(obj){
      obj.n += recs.length;
      obj.total += t;
    }
  }
  return out;
}

function dailyTotalsForMonth(year, monthKey){
  const yd = yearData(String(year));
  const days = yd.days || {};
  const list = Object.keys(days).filter(d=>d.startsWith(monthKey)).sort();
  // Ensure days with 0 are present
  const y = monthKey.slice(0,4);
  const m = monthKey.slice(5,7);
  const first = new Date(`${y}-${m}-01T00:00:00`);
  const next = new Date(first); next.setMonth(next.getMonth()+1);
  const maxDay = Math.round((next-first)/86400000);
  const out = [];
  for(let i=1;i<=maxDay;i++){
    const d = `${monthKey}-${String(i).padStart(2,"0")}`;
    const recs = days[d] || [];
    out.push({ date:d, n: recs.length, total: recs.reduce((s,r)=>s+parseNum(r.price),0) });
  }
  return out;
}

function drawMonthlyChart(){
  const y = getYear();
  const dateStr = getDate();
  const mKey = monthKeyFromDate(dateStr);
  const data = monthTotals(y);
  const canvas = $("#chart");
  const ctx = canvas.getContext("2d");

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(360, Math.floor(rect.width * dpr));
  canvas.height = Math.floor(230 * dpr);

  ctx.clearRect(0,0,canvas.width, canvas.height);

  const padL = 56*dpr, padR = 18*dpr, padT = 16*dpr, padB = 44*dpr;
  const w = canvas.width - padL - padR;
  const h = canvas.height - padT - padB;

  const values = data.map(d=>d.total);
  const max = Math.max(1, ...values);
  const maxY = max * 1.12;

  // grid + y labels
  ctx.strokeStyle = "rgba(169,181,200,.55)";
  ctx.lineWidth = 1*dpr;
  ctx.fillStyle = "rgba(91,107,132,.95)";
  ctx.font = `${12*dpr}px system-ui`;

  const steps = 4;
  for(let i=0;i<=steps;i++){
    const y0 = padT + (h * i/steps);
    ctx.beginPath();
    ctx.moveTo(padL, y0);
    ctx.lineTo(padL+w, y0);
    ctx.stroke();
    const v = maxY * (1 - i/steps);
    const lbl = euro(v).replace(/\u00A0/g," ");
    ctx.fillText(lbl, 6*dpr, y0 + 4*dpr);
  }

  // x labels
  const monthLbl = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
  ctx.fillStyle = "rgba(91,107,132,.95)";
  ctx.font = `${12*dpr}px system-ui`;
  data.forEach((d,i)=>{
    const x = padL + (w * (i/11));
    ctx.fillText(monthLbl[i], x - 10*dpr, padT + h + 28*dpr);
  });

  // line
  ctx.strokeStyle = "rgba(27,42,74,.95)";
  ctx.lineWidth = 2*dpr;
  ctx.beginPath();
  data.forEach((d,i)=>{
    const x = padL + (w * (i/11));
    const yv = padT + h * (1 - (d.total / maxY));
    if(i===0) ctx.moveTo(x,yv); else ctx.lineTo(x,yv);
  });
  ctx.stroke();

  // area fill
  ctx.lineTo(padL+w, padT+h);
  ctx.lineTo(padL, padT+h);
  ctx.closePath();
  ctx.fillStyle = "rgba(47,95,255,.10)";
  ctx.fill();

  // points + highlight current month
  data.forEach((d,i)=>{
    const x = padL + (w * (i/11));
    const yv = padT + h * (1 - (d.total / maxY));
    ctx.fillStyle = (d.key===mKey) ? "rgba(47,95,255,.95)" : "rgba(27,42,74,.85)";
    ctx.beginPath();
    ctx.arc(x,yv, 4.3*dpr, 0, Math.PI*2);
    ctx.fill();
  });

  // title hint
  ctx.fillStyle = "rgba(27,42,74,.95)";
  ctx.font = `${13*dpr}px system-ui`;
  ctx.fillText("Totali mensili · tocchi un mese per dettaglio", padL, 14*dpr);

  // store hit zones
  canvas._monthHit = { padL, padT, w, h, dpr };
}


function drawChart(){
  const y = getYear();
  const dateStr = getDate();
  const data = allDailyTotals(y); // [{date,total,n}]
  const canvas = $("#chart");
  const ctx = canvas.getContext("2d");

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(520, Math.floor(rect.width * dpr));
  canvas.height = Math.floor(230 * dpr);

  ctx.clearRect(0,0,canvas.width, canvas.height);

  const padL = 56*dpr, padR = 18*dpr, padT = 18*dpr, padB = 46*dpr;
  const w = canvas.width - padL - padR;
  const h = canvas.height - padT - padB;

  const values = data.map(d=>d.total);
  const max = Math.max(1, ...values);
  const maxY = max * 1.12;

  // grid + y labels
  ctx.strokeStyle = "rgba(169,181,200,.55)";
  ctx.lineWidth = 1*dpr;
  ctx.fillStyle = "rgba(91,107,132,.95)";
  ctx.font = `${12*dpr}px system-ui`;

  const steps = 4;
  for(let i=0;i<=steps;i++){
    const y0 = padT + (h * i/steps);
    ctx.beginPath();
    ctx.moveTo(padL, y0);
    ctx.lineTo(padL+w, y0);
    ctx.stroke();
    const v = maxY * (1 - i/steps);
    const lbl = euro(v).replace(/\u00A0/g," ");
    ctx.fillText(lbl, 6*dpr, y0 + 4*dpr);
  }

  // x labels: months
  const monthLbl = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
  ctx.fillStyle = "rgba(91,107,132,.95)";
  ctx.font = `${12*dpr}px system-ui`;

  // precompute month start indices
  const monthStarts = [];
  for(let m=1;m<=12;m++){
    const mk = `${y}-${String(m).padStart(2,"0")}-01`;
    // find first index >= mk
    let idx = 0;
    while(idx < data.length && data[idx].date < mk) idx++;
    monthStarts.push({ m, idx: Math.min(idx, data.length-1) });
  }

  monthStarts.forEach(({m,idx})=>{
    const x = padL + (w * (idx/(data.length-1)));
    ctx.fillText(monthLbl[m-1], x - 12*dpr, padT + h + 30*dpr);
  });

  // line
  ctx.strokeStyle = "rgba(27,42,74,.95)";
  ctx.lineWidth = 2*dpr;
  ctx.beginPath();
  data.forEach((d,i)=>{
    const x = padL + (w * (i/(data.length-1)));
    const yv = padT + h * (1 - (d.total / maxY));
    if(i===0) ctx.moveTo(x,yv); else ctx.lineTo(x,yv);
  });
  ctx.stroke();

  // subtle fill under curve (professional but not noisy)
  ctx.lineTo(padL+w, padT+h);
  ctx.lineTo(padL, padT+h);
  ctx.closePath();
  ctx.fillStyle = "rgba(47,95,255,.08)";
  ctx.fill();

  // highlight today point
  const ti = data.findIndex(d=>d.date===dateStr);
  if(ti >= 0){
    const x = padL + (w * (ti/(data.length-1)));
    const yv = padT + h * (1 - (data[ti].total / maxY));
    ctx.fillStyle = "rgba(47,95,255,.95)";
    ctx.beginPath();
    ctx.arc(x,yv, 4.6*dpr, 0, Math.PI*2);
    ctx.fill();
  }

  // title hint
  ctx.fillStyle = "rgba(27,42,74,.95)";
  ctx.font = `${13*dpr}px system-ui`;
  ctx.fillText("Andamento annuale · mesi in asse · tocca un punto per dettaglio", padL, 14*dpr);

  // store hit mapping for clicks
  canvas._hit = { padL, padT, w, h, dpr, n:data.length };
}


// ---------------- Chart zoom modal ----------------
let chartModal = null;
let chartZoom = 1.4;
let chartMonthKey = null;

function openChartModal(monthKey){
  chartModal = getChartModalEl();
  if(!chartModal){
    alert("Errore: finestra Grafico non trovata. Aggiorna la pagina.");
    return;
  }
  chartMonthKey = monthKey;
  chartZoom = 1.6;

  const title = byId("chartTitle");
  const sub = byId("chartSubTitle");
  const [yy, mm] = monthKey.split("-");
  const monthNames = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
  if(title) title.textContent = `Dettaglio mese · ${monthNames[Number(mm)-1]} ${yy}`;
  if(sub) sub.textContent = "Usa + / − per zoom e scorri orizzontalmente.";

  chartModal.classList.add("show");
  drawZoomChart();
}

function closeChartModal(){
  chartModal = getChartModalEl();
  if(!chartModal) return;
  chartModal.classList.remove("show");
  chartMonthKey = null;
}

function drawZoomChart(){
  if(!chartMonthKey) return;
  const y = getYear();
  const data = dailyTotalsForMonth(y, chartMonthKey);
  const canvas = byId("zoomChart");
  const wrap = byId("zoomWrap");
  if(!canvas || !wrap) return;

  const dpr = window.devicePixelRatio || 1;

  const baseW = Math.max(700, wrap.getBoundingClientRect().width);
  const width = Math.floor(baseW * chartZoom * dpr);
  const height = Math.floor(260 * dpr);
  canvas.width = width;
  canvas.height = height;

  // Make scroll area
  canvas.style.width = `${Math.floor(width/dpr)}px`;
  canvas.style.height = "260px";

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0,0,width,height);

  const padL = 56*dpr, padR = 18*dpr, padT = 16*dpr, padB = 46*dpr;
  const w = width - padL - padR;
  const h = height - padT - padB;

  const max = Math.max(1, ...data.map(d=>d.total));
  const maxY = max * 1.12;

  // grid
  ctx.strokeStyle = "rgba(169,181,200,.55)";
  ctx.lineWidth = 1*dpr;
  ctx.fillStyle = "rgba(91,107,132,.95)";
  ctx.font = `${12*dpr}px system-ui`;
  const steps = 4;
  for(let i=0;i<=steps;i++){
    const y0 = padT + (h * i/steps);
    ctx.beginPath(); ctx.moveTo(padL,y0); ctx.lineTo(padL+w,y0); ctx.stroke();
    const v = maxY*(1-i/steps);
    ctx.fillText(euro(v).replace(/\u00A0/g," "), 6*dpr, y0+4*dpr);
  }

  // x labels (days every 2)
  ctx.fillStyle = "rgba(91,107,132,.95)";
  ctx.font = `${11*dpr}px system-ui`;
  for(let i=0;i<data.length;i++){
    if((i+1)%2!==0) continue;
    const x = padL + (w * (i/(data.length-1)));
    ctx.fillText(String(i+1), x-5*dpr, padT+h+28*dpr);
  }

  // line
  ctx.strokeStyle = "rgba(27,42,74,.95)";
  ctx.lineWidth = 2*dpr;
  ctx.beginPath();
  data.forEach((d,i)=>{
    const x = padL + (w * (i/(data.length-1)));
    const yv = padT + h*(1-(d.total/maxY));
    if(i===0) ctx.moveTo(x,yv); else ctx.lineTo(x,yv);
  });
  ctx.stroke();

  // points
  ctx.fillStyle = "rgba(27,42,74,.85)";
  data.forEach((d,i)=>{
    const x = padL + (w * (i/(data.length-1)));
    const yv = padT + h*(1-(d.total/maxY));
    ctx.beginPath(); ctx.arc(x,yv, 3.6*dpr, 0, Math.PI*2); ctx.fill();
  });

  // set scroll roughly to today if same month
  const today = getDate();
  if(today.startsWith(chartMonthKey)){
    const day = Number(today.slice(8,10));
    const target = Math.max(0, (canvas.width/dpr) * ((day-1)/(data.length-1)) - (wrap.clientWidth/2));
    wrap.scrollLeft = target;
  }
}

function chartCanvasToPngDataUrl(){
  // build a crisp monthly chart for export
  const y = getYear();
  const data = monthTotals(y);
  const dpr = 2;
  const width = 1200*dpr;
  const height = 420*dpr;

  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");

  ctx.clearRect(0,0,width,height);

  const padL = 90*dpr, padR = 30*dpr, padT = 40*dpr, padB = 80*dpr;
  const w = width - padL - padR;
  const h = height - padT - padB;
  const values = data.map(d=>d.total);
  const max = Math.max(1, ...values);
  const maxY = max*1.12;

  // background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0,0,width,height);

  // grid
  ctx.strokeStyle = "rgba(169,181,200,.6)";
  ctx.lineWidth = 1*dpr;
  ctx.fillStyle = "rgba(91,107,132,1)";
  ctx.font = `${14*dpr}px system-ui`;
  const steps = 4;
  for(let i=0;i<=steps;i++){
    const y0 = padT + h*(i/steps);
    ctx.beginPath(); ctx.moveTo(padL,y0); ctx.lineTo(padL+w,y0); ctx.stroke();
    const v = maxY*(1-i/steps);
    ctx.fillText(euro(v).replace(/\u00A0/g," "), 10*dpr, y0+5*dpr);
  }

  const monthLbl = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
  ctx.fillStyle = "rgba(91,107,132,1)";
  ctx.font = `${14*dpr}px system-ui`;
  data.forEach((d,i)=>{
    const x = padL + w*(i/11);
    ctx.fillText(monthLbl[i], x-12*dpr, padT+h+44*dpr);
  });

  // line
  ctx.strokeStyle = "rgba(27,42,74,1)";
  ctx.lineWidth = 3*dpr;
  ctx.beginPath();
  data.forEach((d,i)=>{
    const x = padL + w*(i/11);
    const yv = padT + h*(1-(d.total/maxY));
    if(i===0) ctx.moveTo(x,yv); else ctx.lineTo(x,yv);
  });
  ctx.stroke();

  // points
  ctx.fillStyle = "rgba(27,42,74,.9)";
  data.forEach((d,i)=>{
    const x = padL + w*(i/11);
    const yv = padT + h*(1-(d.total/maxY));
    ctx.beginPath(); ctx.arc(x,yv, 6*dpr, 0, Math.PI*2); ctx.fill();
  });

  // title
  ctx.fillStyle = "rgba(27,42,74,1)";
  ctx.font = `${18*dpr}px system-ui`;
  ctx.fillText(`Chirurgie ${y} · andamento mensile`, padL, 26*dpr);

  return c.toDataURL("image/png");
}

function roundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

// ------------- Export (Excel-compatible XML) -------------

// ---------------- Minimal XLSX writer (no external libs) ----------------
// Writes an .xlsx as an uncompressed ZIP of OOXML parts.
// Supports plain text (inlineStr) and numbers.

function crc32(buf){
  let c = 0 ^ (-1);
  for(let i=0;i<buf.length;i++){
    c = (c >>> 8) ^ CRC32_TABLE[(c ^ buf[i]) & 0xFF];
  }
  return (c ^ (-1)) >>> 0;
}
const CRC32_TABLE = (()=>{
  const t = new Uint32Array(256);
  for(let i=0;i<256;i++){
    let c = i;
    for(let k=0;k<8;k++){
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[i] = c >>> 0;
  }
  return t;
})();

function u32le(n){ return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]); }
function u16le(n){ return new Uint8Array([n&255,(n>>>8)&255]); }

function concatBytes(chunks){
  let len = 0;
  for(const c of chunks) len += c.length;
  const out = new Uint8Array(len);
  let o = 0;
  for(const c of chunks){ out.set(c,o); o += c.length; }
  return out;
}

function zipStore(files){
  // files: [{name, data(Uint8Array)}]
  const central = [];
  const body = [];
  const te = new TextEncoder();
  let offset = 0;

  for(const f of files){
    const nameBytes = te.encode(f.name);
    const data = f.data;
    const crc = crc32(data);
    const localHeader = concatBytes([
      u32le(0x04034b50),
      u16le(20),       // version needed
      u16le(0),        // flags
      u16le(0),        // compression 0 = store
      u16le(0), u16le(0), // time/date
      u32le(crc),
      u32le(data.length),
      u32le(data.length),
      u16le(nameBytes.length),
      u16le(0),
      nameBytes
    ]);
    body.push(localHeader, data);

    const centralHeader = concatBytes([
      u32le(0x02014b50),
      u16le(20), u16le(20),
      u16le(0),
      u16le(0),
      u16le(0), u16le(0),
      u32le(crc),
      u32le(data.length),
      u32le(data.length),
      u16le(nameBytes.length),
      u16le(0), u16le(0),
      u16le(0), u16le(0),
      u32le(0),
      u32le(offset),
      nameBytes
    ]);
    central.push(centralHeader);

    offset += localHeader.length + data.length;
  }

  const centralDir = concatBytes(central);
  const centralOffset = offset;
  const end = concatBytes([
    u32le(0x06054b50),
    u16le(0), u16le(0),
    u16le(files.length), u16le(files.length),
    u32le(centralDir.length),
    u32le(centralOffset),
    u16le(0)
  ]);

  return concatBytes([...body, centralDir, end]);
}

function colName(n){
  let s = "";
  while(n >= 0){
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n/26) - 1;
  }
  return s;
}

function xmlEscape(s){
  return String(s)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

function sheetXmlFromAoa(aoa){
  // aoa: array of rows, each row array of values (string/number/null)
  const rows = [];
  const maxR = aoa.length;
  const maxC = Math.max(1, ...aoa.map(r=>r.length));
  const dim = `A1:${colName(maxC-1)}${maxR}`;

  for(let r=0;r<aoa.length;r++){
    const cells = [];
    const row = aoa[r];
    for(let c=0;c<row.length;c++){
      const v = row[c];
      if(v === null || typeof v === "undefined" || v === "") continue;
      const ref = `${colName(c)}${r+1}`;
      if(typeof v === "number" && Number.isFinite(v)){
        cells.push(`<c r="${ref}"><v>${v}</v></c>`);
      } else {
        cells.push(`<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(v)}</t></is></c>`);
      }
    }
    rows.push(`<row r="${r+1}">${cells.join("")}</row>`);
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<dimension ref="${dim}"/>` +
    `<sheetData>${rows.join("")}</sheetData>` +
    `</worksheet>`;
}

function buildXlsx(sheets){
  // sheets: [{name, aoa}]
  const te = new TextEncoder();
  const files = [];

  const contentTypes = [
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`,
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`,
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`,
    `<Default Extension="xml" ContentType="application/xml"/>`,
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`,
    ...sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`),
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`,
    `</Types>`
  ].join("");

  files.push({ name:"[Content_Types].xml", data: te.encode(contentTypes) });

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;
  files.push({ name:"_rels/.rels", data: te.encode(rels) });

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>` +
    sheets.map((s,i)=>`<sheet name="${xmlEscape(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join("") +
    `</sheets></workbook>`;
  files.push({ name:"xl/workbook.xml", data: te.encode(workbook) });

  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join("") +
    `<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;
  files.push({ name:"xl/_rels/workbook.xml.rels", data: te.encode(wbRels) });

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="1"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font></fonts>` +
    `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
    `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `<dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium9" defaultPivotStyle="PivotStyleLight16"/>` +
    `</styleSheet>`;
  files.push({ name:"xl/styles.xml", data: te.encode(styles) });

  // sheets
  for(let i=0;i<sheets.length;i++){
    const xml = sheetXmlFromAoa(sheets[i].aoa);
    files.push({ name:`xl/worksheets/sheet${i+1}.xml`, data: te.encode(xml) });
  }

  return zipStore(files);
}

function exportExcel(){
  const year = String(getYear());
  const yd = yearData(year);
  const cat = catalogMap(year);

  const dates = Object.keys(yd.days || {}).sort();
  const daily = [];
  const detail = [];
  const monthly = new Map();

  for(const d of dates){
    const recs = yd.days[d] || [];
    const dayTotal = recs.reduce((s,r)=>s+parseNum(r.price),0);
    daily.push({ date:d, n:recs.length, total:dayTotal });

    const m = d.slice(0,7);
    if(!monthly.has(m)) monthly.set(m, { n:0, total:0 });
    monthly.get(m).n += recs.length;
    monthly.get(m).total += dayTotal;

    for(const r of recs){
      if(r.type === "double"){
        const a = cat.get(r.procedures?.[0])?.name || `ID ${r.procedures?.[0]}`;
        const b = cat.get(r.procedures?.[1])?.name || `ID ${r.procedures?.[1]}`;
        detail.push({ date:d, tipo:"Doppio", a, b, price:parseNum(r.price), note:r.note||"" });
      } else {
        const a = cat.get(r.procedures?.[0])?.name || `ID ${r.procedures?.[0]}`;
        detail.push({ date:d, tipo:"Singolo", a, b:"", price:parseNum(r.price), note:r.note||"" });
      }
    }
  }

  const monthlyArr = Array.from(monthly.entries())
    .sort((a,b)=>a[0].localeCompare(b[0]))
    .map(([m,v])=>({ month:m, n:v.n, total:v.total }));

  const totalN = daily.reduce((s,x)=>s+x.n,0);
  const totalEuro = daily.reduce((s,x)=>s+parseNum(x.total),0);

  // Build sheets (AOA = array of arrays)
  const shSummary = [
    ["Anno", "Interventi totali", "Fatturato totale (€)"],
    [year, totalN, Number(totalEuro.toFixed(2))]
  ];

  const shMonthly = [
    ["Mese", "N interventi", "Totale (€)"],
    ...monthlyArr.map(r=>[r.month, r.n, Number(r.total.toFixed(2))])
  ];

  const shDaily = [
    ["Data", "N interventi", "Totale (€)"],
    ...daily.map(r=>[r.date, r.n, Number(r.total.toFixed(2))])
  ];

  const shDetail = [
    ["Data", "Tipo", "Intervento 1", "Intervento 2", "Importo (€)", "Note"],
    ...detail.map(r=>[r.date, r.tipo, r.a, r.b, Number(r.price.toFixed(2)), r.note])
  ];

  const xlsxBytes = buildXlsx([
    { name:"Riepilogo", aoa: shSummary },
    { name:"Mensile", aoa: shMonthly },
    { name:"Giornaliero", aoa: shDaily },
    { name:"Dettaglio", aoa: shDetail },
  ]);

  const blob = new Blob([xlsxBytes], { type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  downloadBlob(blob, `Chirurgie_${year}_Dati.xlsx`);
}

function buildSpreadsheetML({ year, detail, daily, monthly, summary }){
  const header = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="sHeader">
   <Font ss:Bold="1"/>
   <Interior ss:Color="#E6EBF3" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A9B5C8"/>
   </Borders>
  </Style>
  <Style ss:ID="sMoney">
   <NumberFormat ss:Format="€ #,##0.00"/>
  </Style>
  <Style ss:ID="sDate">
   <NumberFormat ss:Format="yyyy-mm-dd"/>
  </Style>
 </Styles>`;

  function sheet(name, headers, rows, moneyCols=[]){
    const colCount = headers.length;
    const headerRow = `<Row>${headers.map(h=>`<Cell ss:StyleID="sHeader"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join("")}</Row>`;
    const body = rows.map(r=>{
      const cells = r.map((v, idx)=>{
        const isMoney = moneyCols.includes(idx);
        const isDate = (idx===0 && String(v).match(/^\d{4}-\d{2}-\d{2}$/));
        const typ = (typeof v === "number") ? "Number" : "String";
        const style = isMoney ? ` ss:StyleID="sMoney"` : (isDate ? ` ss:StyleID="sDate"` : "");
        return `<Cell${style}><Data ss:Type="${typ}">${escapeXml(v)}</Data></Cell>`;
      }).join("");
      return `<Row>${cells}</Row>`;
    }).join("");
    return `<Worksheet ss:Name="${escapeXml(name)}"><Table ss:ExpandedColumnCount="${colCount}">${headerRow}${body}</Table></Worksheet>`;
  }

  const ws4 = sheet("Riepilogo", ["Voce","N interventi","Totale (€)"], summary, [2]);
  const ws3 = sheet("Mensile", ["Mese","N interventi","Totale (€)"], monthly, [2]);
  const ws2 = sheet("Giornaliero", ["Data","N interventi","Totale (€)"], daily, [2]);
  const ws1 = sheet("Dettaglio", ["Data","Tipo","Intervento 1","Intervento 2","Importo (€)","Note"], detail, [4]);

  return `${header}\n${ws4}\n${ws3}\n${ws2}\n${ws1}\n</Workbook>`;
}

function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 5000);
}

// ------------- Backup import/export -------------
function exportBackup(){
  const blob = new Blob([JSON.stringify(state, null, 2)], { type:"application/json" });
  downloadBlob(blob, `Chirurgie_backup_${getYear()}.json`);
}
function importBackup(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const obj = JSON.parse(reader.result);
      if(!obj || !obj.years || !obj.version) throw new Error("File non valido.");
      saveState(obj);
      render();
      alert("Backup importato.");
    } catch(e){
      alert("Import fallito: " + e.message);
    }
  };
  reader.readAsText(file);
}
async function resetFromSeed(){
  if(!confirm("Reset: ricarico i dati originali. I dati attuali sul dispositivo verranno sovrascritti.\n\nConsiglio: fai prima “Esporta backup”.")) return;
  const seed = await loadSeed();
  const today = isoDate(new Date());
  const s = {
    version: 1,
    years: seed.years,
    ui: {
      year: state?.ui?.year || "2026",
      dateByYear: { "2025": clampDateToYear(today, "2025"), "2026": clampDateToYear(today, "2026") }
    }
  };
  saveState(s);
  render();
  alert("Reset completato.");
}

// ------------- Events / init -------------
function wire(){
  $("#prevDay").addEventListener("click", ()=>moveDay(-1));
  $("#nextDay").addEventListener("click", ()=>moveDay(1));
  $("#dateInput").addEventListener("change", (e)=>{ setDate(e.target.value); render(); });
  $("#yearSelect").addEventListener("change", (e)=>{
    setYear(e.target.value);
    setDate(clampDateToYear(getDate(), getYear()));
    render();
  });

  $("#addBtn").addEventListener("click", ()=>openModal({ mode:"add" }));
  $("#exportBtn").addEventListener("click", exportExcel);
  safeOn("catalogBtn","click", openCatalogModal);
  $("#backupBtn").addEventListener("click", exportBackup);
  $("#resetBtn").addEventListener("click", resetFromSeed);

  $("#importFile").addEventListener("change", (e)=>{
    const file = e.target.files?.[0];
    if(file) importBackup(file);
    e.target.value = "";
  });

  $("#closeModal").addEventListener("click", closeModal);
  modal.addEventListener("click", (e)=>{ if(e.target === modal) closeModal(); });


  safeOn("closeCatalog","click", closeCatalogModal);
  const cm2 = getCatalogModalEl();
  if(cm2){ cm2.addEventListener("click", (e)=>{ if(e.target === cm2) closeCatalogModal(); }); }
  $("#catSearch").addEventListener("input", renderCatalogList);
  $("#catShowArchived").addEventListener("change", renderCatalogList);
  $("#catNewBtn").addEventListener("click", newCatalogItem);
  $("#catSaveBtn").addEventListener("click", saveCatalogItem);
  $("#catArchiveBtn").addEventListener("click", toggleArchiveCatalogItem);


  $("#toggleSingle").addEventListener("click", ()=>setModeType("single"));
  $("#toggleDouble").addEventListener("click", ()=>setModeType("double"));

  $("#searchSingle").addEventListener("input", rebuildPicklists);
  $("#searchA").addEventListener("input", rebuildPicklists);
  $("#searchB").addEventListener("input", rebuildPicklists);

  $("#confirmModal").addEventListener("click", confirmModal);
  $("#priceInput").addEventListener("input", ()=>{ if(modalCtx) modalCtx.priceTouched = true; });


  window.addEventListener("keydown", (e)=>{
    if(!modal.classList.contains("show")) return;
    if(e.key === "Escape") { closeModal(); closeCatalogModal();  }
    if(e.key === "Enter" && (e.ctrlKey || e.metaKey)) confirmModal();
  });

  window.addEventListener("resize", ()=>drawChart());



}



function ensureCatalogFlags(){
  // Backward compatibility: se manca 'active', considera attivo
  for(const y of Object.keys(state.years || {})){
    const yd = state.years[y];
    if(!yd?.catalog) continue;
    for(const c of yd.catalog){
      if(typeof c.active === "undefined") c.active = true;
    }
  }
  saveState(state);
}

async function init(){
  state = await loadState();
  ensureCatalogFlags();
  wire();

  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }

  const y = getYear();
  const today = isoDate(new Date());
  if(today.startsWith(y+"-")) setDate(today);
  else setDate(state.ui.dateByYear[y] || `${y}-01-01`);

  render();
}
init();
