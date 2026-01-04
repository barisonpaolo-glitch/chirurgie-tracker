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
  const cat = yearData(y).catalog;
  const catMap = catalogMap(y);

  modalCtx = { mode, recId, y, dateStr, cat, catMap, modeType: "single", selA:null, selB:null };

  $("#modalTitle").textContent = mode === "edit" ? "Modifica intervento" : "Nuovo intervento";
  $("#searchSingle").value = "";
  $("#searchA").value = "";
  $("#searchB").value = "";
  $("#priceInput").value = "";
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
  if(!$("#priceInput").value) $("#priceInput").value = String(v ?? 0);
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

// ------------- Chart -------------
function drawChart(){
  const y = getYear();
  const dateStr = getDate();
  const data = allDailyTotals(y);
  const canvas = $("#chart");
  const ctx = canvas.getContext("2d");

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(320, Math.floor(rect.width * dpr));
  canvas.height = Math.floor(210 * dpr);

  ctx.clearRect(0,0,canvas.width, canvas.height);

  const padL = 52*dpr, padR = 14*dpr, padT = 14*dpr, padB = 28*dpr;
  const w = canvas.width - padL - padR;
  const h = canvas.height - padT - padB;

  const maxY = Math.max(1, ...data.map(d=>d.total));
  const minY = 0;

  // grid
  ctx.lineWidth = 1*dpr;
  ctx.strokeStyle = "rgba(91,107,132,.22)";
  const steps = 4;
  for(let i=0;i<=steps;i++){
    const y0 = padT + (h * i/steps);
    ctx.beginPath();
    ctx.moveTo(padL, y0);
    ctx.lineTo(padL+w, y0);
    ctx.stroke();
  }

  // y labels
  ctx.fillStyle = "rgba(91,107,132,.92)";
  ctx.font = `${12*dpr}px system-ui`;
  for(let i=0;i<=steps;i++){
    const v = (maxY * (1 - i/steps));
    const y0 = padT + (h * i/steps);
    const lbl = euro(v).replace(/\u00A0/g," ");
    ctx.fillText(lbl, 6*dpr, y0 + 4*dpr);
  }

  // line
  ctx.strokeStyle = "rgba(27,42,74,.95)";
  ctx.lineWidth = 2*dpr;
  ctx.beginPath();
  data.forEach((d, i)=>{
    const x = padL + (w * (i/(data.length-1)));
    const yv = padT + h * (1 - (d.total - minY)/(maxY - minY));
    if(i===0) ctx.moveTo(x,yv); else ctx.lineTo(x,yv);
  });
  ctx.stroke();

  // highlight selected day
  const idx = data.findIndex(d=>d.date===dateStr);
  if(idx>=0){
    const x = padL + (w * (idx/(data.length-1)));
    const yv = padT + h * (1 - (data[idx].total - minY)/(maxY - minY));
    ctx.fillStyle = "rgba(47,95,255,.95)";
    ctx.beginPath();
    ctx.arc(x,yv, 4.5*dpr, 0, Math.PI*2);
    ctx.fill();

    const label = `${dateStr} • ${euro(data[idx].total)} • ${data[idx].n} int.`;
    ctx.font = `${12*dpr}px system-ui`;
    const tw = ctx.measureText(label).width + 12*dpr;
    const th = 20*dpr;
    const bx = Math.min(canvas.width - tw - 8*dpr, Math.max(8*dpr, x - tw/2));
    const by = Math.max(8*dpr, yv - 28*dpr);

    // bubble
    ctx.fillStyle = "rgba(255,255,255,.96)";
    ctx.strokeStyle = "rgba(230,235,243,1)";
    ctx.lineWidth = 1*dpr;
    roundRect(ctx, bx, by, tw, th, 8*dpr);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(11,18,32,.92)";
    ctx.fillText(label, bx + 6*dpr, by + 14*dpr);
  }
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
function exportExcel(){
  const year = String(getYear());
  const yd = yearData(year);
  const cat = catalogMap(year);

  const rowsDetail = [];
  const rowsDaily = [];
  const rowsMonthly = new Map();

  const dates = Object.keys(yd.days).sort();
  for(const d of dates){
    const recs = yd.days[d] || [];
    const dayTotal = recs.reduce((s,r)=>s+parseNum(r.price),0);
    rowsDaily.push([d, recs.length, dayTotal]);

    const m = d.slice(0,7);
    if(!rowsMonthly.has(m)) rowsMonthly.set(m, {n:0, total:0});
    rowsMonthly.get(m).n += recs.length;
    rowsMonthly.get(m).total += dayTotal;

    for(const r of recs){
      if(r.type === "double"){
        const a = cat.get(r.procedures?.[0])?.name || `ID ${r.procedures?.[0]}`;
        const b = cat.get(r.procedures?.[1])?.name || `ID ${r.procedures?.[1]}`;
        rowsDetail.push([d, "Doppio", a, b, parseNum(r.price), r.note || ""]);
      } else {
        const a = cat.get(r.procedures?.[0])?.name || `ID ${r.procedures?.[0]}`;
        rowsDetail.push([d, "Singolo", a, "", parseNum(r.price), r.note || ""]);
      }
    }
  }

  const rowsMonthlyArr = Array.from(rowsMonthly.entries())
    .sort((a,b)=>a[0].localeCompare(b[0]))
    .map(([m,v])=>[m, v.n, v.total]);

  const tot = ytdStats(year, `${year}-12-31`);
  const xml = buildSpreadsheetML({
    year,
    detail: rowsDetail,
    daily: rowsDaily,
    monthly: rowsMonthlyArr,
    summary: [[`Totale ${year}`, tot.n, tot.total]]
  });

  const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
  downloadBlob(blob, `Chirurgie_${year}_resoconto.xls`);
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
  $("#backupBtn").addEventListener("click", exportBackup);
  $("#resetBtn").addEventListener("click", resetFromSeed);

  $("#importFile").addEventListener("change", (e)=>{
    const file = e.target.files?.[0];
    if(file) importBackup(file);
    e.target.value = "";
  });

  $("#closeModal").addEventListener("click", closeModal);
  modal.addEventListener("click", (e)=>{ if(e.target === modal) closeModal(); });

  $("#toggleSingle").addEventListener("click", ()=>setModeType("single"));
  $("#toggleDouble").addEventListener("click", ()=>setModeType("double"));

  $("#searchSingle").addEventListener("input", rebuildPicklists);
  $("#searchA").addEventListener("input", rebuildPicklists);
  $("#searchB").addEventListener("input", rebuildPicklists);

  $("#confirmModal").addEventListener("click", confirmModal);

  window.addEventListener("keydown", (e)=>{
    if(!modal.classList.contains("show")) return;
    if(e.key === "Escape") closeModal();
    if(e.key === "Enter" && (e.ctrlKey || e.metaKey)) confirmModal();
  });

  window.addEventListener("resize", ()=>drawChart());
}

async function init(){
  state = await loadState();
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
