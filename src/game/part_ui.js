const ROLE = { mafia: "마피아", citizen: "시민", judge: "심판" };
const SIDE = { pro: "찬성", con: "반대" };
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CLASSES = ["1반", "2반", "3반"];
const COL = { n: "#8B93B0", pro: "#63A9E6", con: "#EE9255", judge: "#4CC08F", mafia: "#E0533F", gold: "#E5B550", paper: "#EEE8DC", muted: "#A2A3B5", desk: "#13141B", file: "#1D1F2A", line: "#343849", night: "#9DB4FF" };

// ---------------- deterministic assignment ----------------
function hash(str) { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); return h1 >>> 0; }
function rng(seed) { let a = seed; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function parseCode(raw) {
  const s = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = s.match(/^(1[2-9]|2\d|30)([A-Z2-9]{4})$/);
  return m ? { n: +m[1], key: m[2], code: `${m[1]}-${m[2]}` } : null;
}
function districts(n) {
  const D = Math.ceil(n / 6), base = Math.floor(n / D), extra = n % D, out = []; let s = 1;
  for (let d = 0; d < D; d++) { const size = base + (d < extra ? 1 : 0); out.push([...Array(size)].map((_, i) => s + i)); s += size; }
  return out;
}
const mafiaCount = n => Math.max(2, Math.round(n / 6));
const districtOf = (n, seat) => districts(n).findIndex(d => d.includes(seat));
function roles(c) {
  const N = c.n, D = districts(N), r = rng(hash(`v3|${c.key}|${N}`));
  const judges = D.map(d => d[Math.floor(r() * d.length)]);
  const pool = [...Array(N)].map((_, i) => i + 1).filter(s => !judges.includes(s));
  let mafia;
  for (let t = 0; t < 300; t++) { mafia = shuffle(pool, r).slice(0, mafiaCount(N)); if (D.every(d => d.filter(s => mafia.includes(s)).length <= 2)) break; }
  return { D, judges, mafia: mafia.sort((a, b) => a - b) };
}
const isPlazaDay = (day, days) => day > 1 && (day % 2 === 0 || day === days);
function dayTopic(c, day) { const perm = shuffle(TOPICS.map((_, i) => i), rng(hash(`topics|${c.key}`))); return perm[(day - 1) % perm.length]; }
function dayCards(c, day) {
  const topic = dayTopic(c, day), T = TOPICS[topic], R = roles(c), players = {};
  const activeMafia = day === 1 ? [] : R.mafia;
  R.D.forEach((members, di) => {
    const r = rng(hash(`day3|${c.key}|${day}|${di}`));
    const judge = R.judges[di];
    players[judge] = { seat: judge, district: di, role: "judge" };
    const debaters = members.filter(s => s !== judge);
    const mf = debaters.filter(s => activeMafia.includes(s));
    const lies = shuffle(T.lies, r).slice(0, mf.length);
    let proCount = 0;
    mf.forEach((seat, i) => { const [side, text, why] = lies[i]; if (side === "pro") proCount++; players[seat] = { seat, district: di, role: "mafia", side, text, why, lie: true }; });
    const others = shuffle(debaters.filter(s => !mf.includes(s)), r), k = others.length, size = debaters.length;
    let wantPro = (size % 2 === 0 ? size / 2 : (r() < 0.5 ? Math.floor(size / 2) : Math.ceil(size / 2))) - proCount;
    wantPro = Math.max(Math.max(0, k - 3), Math.min(Math.min(3, k), wantPro));
    const pros = shuffle(T.pro, r), cons = shuffle(T.con, r);
    others.forEach((seat, i) => { const side = i < wantPro ? "pro" : "con"; const [text, src] = side === "pro" ? pros[i] : cons[i - wantPro]; players[seat] = { seat, district: di, role: "citizen", side, text, src, lie: false }; });
    const usedPro = Math.min(wantPro, 3), usedCon = Math.min(k - wantPro, 3);
    mf.forEach((seat, i) => { const p = players[seat]; const pl = p.side === "pro" ? pros : cons; p.alt = pl[((p.side === "pro" ? usedPro : usedCon) + i) % pl.length]; });
  });
  return { topic, T, players, R };
}

// ---------------- helpers ----------------
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
function fillSelect(sel, from, to, val, fmt = v => v) { sel.innerHTML = ""; for (let i = from; i <= to; i++) { const o = document.createElement("option"); o.value = i; o.textContent = fmt(i); if (i === val) o.selected = true; sel.appendChild(o); } }
const seatOpts = (list, sel, empty = "—") => `<option value="">${empty}</option>` + list.map(s => `<option value="${s}" ${+sel === s ? "selected" : ""}>${s}번</option>`).join("");


// ---------------- live sync (teacher republishes the page with the current phase) ----------------
const SELF = %%SELF%%;
const SKEL = "<!doctype html><html><head><meta charset=utf8><meta name=viewport content=\"width=device-width,initial-scale=1,viewport-fit=cover\"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>";
const MK = n => "%%" + n + "%%";
const safeJSON = o => JSON.stringify(o).replace(/</g, "\\u003c");
let LIVE = { v: 1, classes: {} };
try { const t = JSON.parse(document.getElementById("liveData").textContent); if (t && t.classes) LIVE = t; } catch {}
function buildDoc(live) { const content = SELF.replace(MK("LIVE"), () => safeJSON(live)).replace(MK("SELF"), () => safeJSON(SELF)); return SKEL + "\n" + content + "\n</body></html>"; }
const hhmm = t => { const d = new Date(t); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const STU = { "밤": ["고개를 숙이고 휴대폰 카드를 확인하세요. 마피아와 심판은 선생님 안내에 따라 고개를 듭니다.", "card"], "아침 뉴스": ["고개를 들고 아침 뉴스를 들으세요.", "down"], "진영 회의": ["같은 편끼리 모여 근거와 발언 순서를 정하세요.", "card"], "입론": ["발언 틀로 30초씩 입론합니다. 입막음당한 사람은 쪽지로 같은 편이 대신 읽어요.", "card"], "검색": ["확인할 상대 근거를 먼저 말하고 검색하세요. 한 사람당 1개!", "ok"], "반론·질문": ["질문 카드로 반론하세요. 출처·시기·숫자·대상을 따져요.", "card"], "심판 판정": ["심판의 판정과 오늘의 MVP 발표를 기다리세요.", "down"], "광장 대표토론": ["대표들의 토론을 듣고, 가장 설득력 있던 대표를 골라 두세요.", "down"], "광장 재판": ["의심스러운 사람을 지명하고, 신호에 맞춰 동시에 가리키세요.", "down"], "정리": ["오늘의 결과를 확인하세요.", "down"] };
const PHONE = { ok: ["ok", "휴대폰으로 검색 가능"], card: ["card", "내 카드만 보기 (검색 금지)"], down: ["down", "휴대폰 엎어 두기"] };

// ---------------- SVG illustration kit ----------------
function person(x, y, o = {}) {
  const c = o.c || COL.n, s = o.s || 1, op = o.dim ? 0.35 : 1;
  const eyes = o.eyes === "closed" ? `<path d="M${x - 5 * s},${y} h4 M${x + 1 * s},${y} h4" stroke="#1B1C22" stroke-width="1.6" stroke-linecap="round"/>`
    : o.eyes === "red" ? `<circle cx="${x - 3.5 * s}" cy="${y}" r="${2.2 * s}" fill="#FF4A3A"/><circle cx="${x + 3.5 * s}" cy="${y}" r="${2.2 * s}" fill="#FF4A3A"/>`
    : `<circle cx="${x - 3.5 * s}" cy="${y}" r="${1.6 * s}" fill="#1B1C22"/><circle cx="${x + 3.5 * s}" cy="${y}" r="${1.6 * s}" fill="#1B1C22"/>`;
  let g = `<g opacity="${op}">`;
  if (o.glow) g += `<circle cx="${x}" cy="${y + 10 * s}" r="${30 * s}" fill="${o.glow}" opacity=".18"/>`;
  g += `<path d="M${x - 17 * s},${y + 36 * s} q0,-22 17,-22 q17,0 17,22 z" fill="${c}"/>`;
  g += `<circle cx="${x}" cy="${y}" r="${12 * s}" fill="${c}"/>`;
  if (o.ring) g += `<circle cx="${x}" cy="${y + 10 * s}" r="${26 * s}" fill="none" stroke="${o.ring}" stroke-width="2.2" stroke-dasharray="${o.dash ? "5 4" : "none"}"/>`;
  g += eyes;
  if (o.mask) g += `<rect x="${x - 9 * s}" y="${y + 3 * s}" width="${18 * s}" height="${7 * s}" rx="2" fill="#F5F5F5" stroke="#999" stroke-width=".8"/><path d="M${x - 9 * s},${y + 6 * s} l-4,-3 M${x + 9 * s},${y + 6 * s} l4,-3" stroke="#bbb"/>`;
  if (o.shield) g += `<path d="M${x + 16 * s},${y - 14 * s} l10,4 v8 q0,9 -10,13 q-10,-4 -10,-13 v-8 z" fill="${COL.judge}" stroke="#0E2A1F" stroke-width="1"/>`;
  if (o.mark) g += `<text x="${x}" y="${y - 18 * s}" text-anchor="middle" font-size="${14 * s}" font-weight="700" fill="${o.markC || COL.mafia}">${o.mark}</text>`;
  if (o.label != null) g += `<text x="${x}" y="${y + 52 * s}" text-anchor="middle" font-size="${11 * s}" fill="${o.labelC || COL.muted}" font-family="IBM Plex Mono, monospace">${o.label}</text>`;
  return g + `</g>`;
}
const svg = (inner, bg = "#171A26") => `<svg viewBox="0 0 800 420" role="img" xmlns="http://www.w3.org/2000/svg" font-family="Noto Sans KR, Malgun Gothic, sans-serif"><rect width="800" height="420" fill="${bg}"/>${inner}</svg>`;
const T_ = (x, y, t, o = {}) => `<text x="${x}" y="${y}" font-size="${o.fs || 14}" fill="${o.c || COL.paper}" font-weight="${o.w || 500}" text-anchor="${o.a || "start"}">${t}</text>`;
const bubble = (x, y, w, t, c = "#EEE8DC", tc = "#1B1C22", tail = "left") => `<g class="fade"><rect x="${x}" y="${y}" width="${w}" height="34" rx="10" fill="${c}"/><path d="M${tail === "left" ? x + 18 : x + w - 18},${y + 34} l${tail === "left" ? -6 : 6},12 l${tail === "left" ? 14 : -14},-12 z" fill="${c}"/>${T_(x + 12, y + 22, t, { c: tc, fs: 13, w: 700 })}</g>`;
const DEMO_M = [3, 10, 17, 22], DEMO_J = [5, 8, 15, 20];
function village(opt = {}) {
  let g = "";
  const boxes = [[30, 30], [410, 30], [30, 220], [410, 220]];
  boxes.forEach(([bx, by], di) => {
    g += `<rect x="${bx}" y="${by}" width="360" height="170" rx="16" fill="${opt.night ? "#10121C" : "#1D1F2A"}" stroke="${COL.line}"/>`;
    g += T_(bx + 14, by + 24, `${di + 1}구역`, { c: COL.gold, w: 700, fs: 15 }) + T_(bx + 346, by + 24, `${di * 6 + 1}~${di * 6 + 6}번`, { c: COL.muted, fs: 12, a: "end" });
    for (let k = 0; k < 6; k++) {
      const seat = di * 6 + k + 1, x = bx + 40 + k * 56, y = by + 70;
      g += person(x, y, opt.fn ? opt.fn(seat) : { label: seat });
    }
  });
  return g;
}

// ---------------- guide scenes ----------------
const SCENES = [
  { k: "STEP 1 · 마을", t: "반 전체가 하나의 마을", p: "출석번호 순으로 4개 구역(5~6명)으로 나뉩니다. 구역은 시즌 내내 같습니다.",
    draw: () => svg(`<g class="fade">${village()}</g>`) },
  { k: "STEP 2 · 역할", t: "시민, 심판, 그리고 숨은 마피아", p: "구역마다 심판(초록) 1명이 판정을 맡고, 나머지는 날마다 찬성(파랑)·반대(주황)로 나뉩니다. 반 전체에 마피아 4명이 숨어 있지만, 누구인지는 아무도 모릅니다.",
    draw: () => svg(`<g class="fade">${village({ fn: s => DEMO_J.includes(s) ? { c: COL.judge, label: "심판", labelC: COL.judge } : { c: s % 2 ? COL.pro : COL.con, label: s, ring: DEMO_M.includes(s) ? COL.mafia : null, dash: true, mark: DEMO_M.includes(s) ? "?" : null } })}</g>`) },
  { k: "STEP 3 · 밤", t: "밤이 되었습니다", p: "모두 고개를 숙이고 휴대폰 카드를 확인합니다. 마피아는 몰래 한 사람의 입을 막고(다음 날 입론 금지), 심판들은 한 사람을 보호합니다.",
    draw: () => svg(`${village({ night: true, fn: s => DEMO_M.includes(s) ? { c: "#3A3D52", eyes: "red", label: s, glow: COL.mafia } : s === 8 ? { c: "#3A3D52", eyes: "closed", mask: true, label: "입막음", labelC: COL.mafia } : s === 14 ? { c: "#3A3D52", eyes: "closed", shield: true, label: "보호", labelC: COL.judge } : { c: "#3A3D52", eyes: "closed", label: s, dim: true } })}
      
      <path class="fade" d="M150,95 C 250,10 360,10 448,90" fill="none" stroke="${COL.mafia}" stroke-width="2.5" stroke-dasharray="6 5" marker-end="url(#ah)"/>
      <defs><marker id="ah" markerWidth="10" markerHeight="10" refX="6" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${COL.mafia}"/></marker></defs>
      <g class="fade"><circle cx="770" cy="30" r="16" fill="#F5E9B8"/><circle cx="778" cy="25" r="14" fill="#171A26"/></g>`, "#0B0C14") },
  { k: "STEP 4 · 아침", t: "아침 뉴스", p: "선생님이 어제 결과와 오늘의 쟁점을 뉴스처럼 발표합니다. 입막음당한 사람은 마피아가 노린 사람, 즉 시민이 확실합니다.",
    draw: () => svg(`<g class="fade"><rect x="170" y="40" width="460" height="340" rx="18" fill="#EEE8DC"/>
      ${T_(200, 80, "DAY 2 · MORNING NEWS", { c: "#9A6B12", fs: 13, w: 700 })}${T_(200, 118, "아침이 밝았습니다", { c: "#1B1C22", fs: 28, w: 800 })}
      ${[["어젯밤", "마피아가 8번의 입을 막았습니다"], ["어제의 토론", "반대 진영 승리"], ["남은 마피아", "4명이 숨어 있습니다"], ["오늘의 쟁점", "원자력 발전을 늘려야 한다"]].map(([a, b], i) => `<rect x="200" y="${142 + i * 56}" width="400" height="46" rx="10" fill="#E2DACA"/>${T_(216, 170 + i * 56, a, { c: "#6B6B78", fs: 12, w: 700 })}${T_(320, 171 + i * 56, b, { c: "#1B1C22", fs: 15, w: 700 })}`).join("")}</g>`) },
  { k: "STEP 5 · 구역 토론", t: "받은 입장으로 토론", p: "같은 편끼리 작전을 짜고, 발언 틀로 30초씩 입론합니다. 그런데 찬성 진영 안에 배신자가 섞여 있습니다. 거짓 근거로 우리 편을 망치려 합니다.",
    draw: () => svg(`<g class="fade"><rect x="30" y="30" width="740" height="360" rx="18" fill="#1D1F2A" stroke="${COL.line}"/>
      ${T_(50, 62, "3구역의 토론 · 오늘의 쟁점: 원자력 발전을 늘려야 한다", { c: COL.gold, w: 700, fs: 15 })}
      ${person(400, 110, { c: COL.judge, label: "심판", labelC: COL.judge })}<rect x="420" y="96" width="22" height="28" rx="3" fill="#EEE8DC"/><path d="M425,104 h12 M425,110 h12 M425,116 h8" stroke="#1F8A62" stroke-width="2"/>
      ${T_(140, 200, "찬성", { c: COL.pro, w: 800, fs: 18, a: "middle" })}${T_(660, 200, "반대", { c: COL.con, w: 800, fs: 18, a: "middle" })}
      ${person(90, 270, { c: COL.pro, label: "13" })}${person(150, 270, { c: COL.pro, label: "16" })}${person(210, 270, { c: COL.pro, label: "17", ring: COL.mafia, dash: true, mark: "?" })}
      ${person(620, 270, { c: COL.con, label: "14" })}${person(690, 270, { c: COL.con, label: "18" })}</g>
      ${bubble(200, 196, 330, "원전 배출량은 태양광의 10분의 1이야!", "#FCE3DE", "#7A1E12")}
      ${bubble(500, 150, 200, "그 숫자, 출처가 어디야?", "#EEE8DC", "#1B1C22", "right")}`) },
  { k: "STEP 6 · 검색", t: "출처를 확인한다", p: "검색 시간에 상대 근거 하나를 골라 확인합니다. 배신자의 근거는 대부분 맞고 숫자·연도·대상 하나만 틀린 '거의 사실'입니다. 꼼꼼히 읽어야 잡힙니다.",
    draw: () => svg(`<g class="fade"><rect x="90" y="40" width="230" height="340" rx="28" fill="#0E0F16" stroke="#3A3D52" stroke-width="3"/><rect x="104" y="70" width="202" height="290" rx="12" fill="#F7F7F7"/>
      <rect x="116" y="84" width="178" height="30" rx="15" fill="#E9EAEE"/>${T_(130, 104, "IPCC 원자력 태양광 배출량", { c: "#333", fs: 11 })}
      ${T_(118, 140, "IPCC 보고서 (2014)", { c: "#1A55C4", fs: 13, w: 700 })}${T_(118, 164, "1 kWh당 전 과정 배출량", { c: "#555", fs: 11 })}
      ${[["원자력", 12, COL.pro], ["풍력", 11, COL.pro], ["태양광", 48, COL.con], ["석탄", 820, "#777"]].map(([n, v, cc], i) => `${T_(118, 192 + i * 34, n, { c: "#333", fs: 12 })}<rect x="168" y="${180 + i * 34}" width="${Math.min(120, v * 1.6 + 6)}" height="16" rx="4" fill="${cc}"/>${T_(296, 193 + i * 34, v + " g", { c: "#333", fs: 11, a: "end" })}`).join("")}
      <circle cx="300" cy="250" r="34" fill="none" stroke="${COL.gold}" stroke-width="6"/><path d="M324,274 l34,34" stroke="${COL.gold}" stroke-width="10" stroke-linecap="round"/></g>
      <g class="fade"><rect x="400" y="90" width="340" height="110" rx="14" fill="#FCE3DE"/>${T_(420, 120, "배신자의 근거", { c: "#7A1E12", fs: 12, w: 700 })}${T_(420, 152, "원자력 배출량은 태양광의", { c: "#1B1C22", fs: 17, w: 700 })}${T_(420, 180, "10분의 1이다", { c: "#1B1C22", fs: 17, w: 700 })}<path d="M418,175 h102" stroke="${COL.mafia}" stroke-width="3"/></g>
      <g class="fade"><rect x="400" y="230" width="340" height="110" rx="14" fill="#DDF3EA"/>${T_(420, 260, "확인 결과", { c: "#1F6B4E", fs: 12, w: 700 })}${T_(420, 292, "12 g 대 약 48 g", { c: "#1B1C22", fs: 17, w: 700 })}${T_(420, 320, "→ 실제로는 약 4분의 1", { c: "#1F6B4E", fs: 17, w: 800 })}</g>`) },
  { k: "STEP 7 · 판정", t: "심판의 체크 세 개", p: "심판은 진영마다 ① 근거를 말했다 ② 출처를 댔다 ③ 질문에 답했다를 체크합니다. 거짓이 적발되면 1개를 뺍니다. 배신자가 섞인 찬성 진영이 졌습니다. 배신 성공일까요?",
    draw: () => {
      const col = (x, name, c, marks, minus) => `<rect x="${x}" y="60" width="280" height="260" rx="16" fill="#1D1F2A" stroke="${c}"/>${T_(x + 20, 96, name, { c, w: 800, fs: 20 })}` + ["근거를 말했다", "출처를 댔다", "질문에 답했다"].map((t, i) => `<rect x="${x + 20}" y="${120 + i * 50}" width="26" height="26" rx="5" fill="none" stroke="${c}" stroke-width="2"/>${marks[i] ? `<path d="M${x + 25},${133 + i * 50} l6,7 l12,-14" stroke="${c}" stroke-width="3.5" fill="none"/>` : ""}${T_(x + 58, 139 + i * 50, t, { fs: 15 })}`).join("") + (minus ? `${T_(x + 20, 290, "거짓 적발 −1", { c: COL.mafia, w: 800, fs: 15 })}` : "") + T_(x + 260, 300, `${marks.filter(Boolean).length - (minus ? 1 : 0)}점`, { c, w: 800, fs: 26, a: "end" });
      return svg(`<g class="fade">${col(70, "찬성 진영", COL.pro, [1, 1, 0], true)}${col(450, "반대 진영", COL.con, [1, 1, 1], false)}</g><g class="fade"><rect x="250" y="340" width="300" height="50" rx="25" fill="${COL.con}"/>${T_(400, 372, "반대 진영 승리", { c: "#1B1C22", w: 800, fs: 20, a: "middle" })}</g>`);
    } },
  { k: "STEP 8 · 광장", t: "광장 대표토론 (DAY 2 · 4)", p: "구역 MVP 중 찬성 2명, 반대 2명이 반 전체 앞에서 토론합니다. 심판 4명이 판정하고, 청중은 가장 설득력 있던 대표를 고릅니다. 대표 중에도 배신자가 있을 수 있습니다!",
    draw: () => svg(`<g class="fade">${[...Array(18)].map((_, i) => person(60 + i * 38, 70, { c: "#3A3D52", s: 0.6 })).join("")}${[...Array(18)].map((_, i) => person(78 + i * 38, 112, { c: "#3A3D52", s: 0.6 })).join("")}
      <path d="M120,380 L180,230 L620,230 L680,380 Z" fill="#2B2440" stroke="#B58CF0"/>${T_(400, 400, "광장", { c: "#B58CF0", w: 800, fs: 15, a: "middle" })}
      ${person(260, 270, { c: COL.pro })}${person(330, 270, { c: COL.pro, ring: COL.mafia, dash: true, mark: "?" })}${person(470, 270, { c: COL.con })}${person(540, 270, { c: COL.con })}
      
      ${[0, 1].map(i => person(60 + i * 50, 300, { c: COL.judge, s: 0.75, label: "심판" , labelC: COL.judge})).join("")}${[0, 1].map(i => person(690 + i * 50, 300, { c: COL.judge, s: 0.75, label: "심판", labelC: COL.judge })).join("")}</g>`) },
  { k: "STEP 9 · 재판", t: "광장 재판: 하루 1명", p: "구역마다 가장 의심스러운 사람을 지명하고, 15초 해명 후 반 전체가 동시에 가리킵니다. 1위가 마피아면 체포! 아니면 누명입니다. 체포돼도 탈락은 없고 다음 날부터 시민으로 토론합니다.",
    draw: () => svg(`<g class="fade">${[[160, 70, "8번", COL.n], [320, 160, "17번", COL.pro], [480, 40, "11번", COL.n], [640, 90, "21번", COL.n]].map(([x, h, n, c]) => `<rect x="${x - 30}" y="${250 - h}" width="60" height="${h}" rx="8" fill="${COL.gold}" opacity=".85"/>${person(x, 290, { c, label: n })}`).join("")}
      <rect x="60" y="360" width="680" height="10" rx="5" fill="#2B2E44"/></g>
      <g class="fade" transform="rotate(-10 330 120)"><rect x="250" y="95" width="170" height="60" rx="10" fill="none" stroke="${COL.mafia}" stroke-width="5"/>${T_(335, 136, "마피아!", { c: COL.mafia, w: 900, fs: 30, a: "middle" })}</g>`) },
  { k: "STEP 10 · 승리", t: "시즌이 끝나면 모두 공개", p: "점수는 구역 점수로 쌓입니다. 마피아 4명을 모두 잡으면 시민 승리, 한 명이라도 살아남으면 마피아 승리. 마지막에 마피아 명단과 거짓 근거의 정답 해설이 공개됩니다.",
    draw: () => svg(`<g class="fade">${[[1, 21], [2, 26], [3, 31], [4, 18]].map(([d, v], i) => `<rect x="${110 + i * 120}" y="${330 - v * 8}" width="80" height="${v * 8}" rx="8" fill="${i === 2 ? COL.gold : "#4A4F6A"}"/>${T_(150 + i * 120, 356, d + "구역", { c: COL.muted, fs: 14, a: "middle" })}${T_(150 + i * 120, 320 - v * 8, v + "점", { c: i === 2 ? COL.gold : COL.paper, fs: 16, w: 800, a: "middle" })}`).join("")}
      <path d="M640,120 h70 v30 q0,35 -35,40 q-35,-5 -35,-40 z" fill="${COL.gold}"/><rect x="665" y="190" width="20" height="30" fill="${COL.gold}"/><rect x="650" y="220" width="50" height="12" rx="3" fill="${COL.gold}"/>
      ${T_(675, 270, "시민 승리 or 마피아 승리", { c: COL.paper, fs: 14, w: 700, a: "middle" })}</g>`) },
];
let sceneI = 0, autoplay = null;
function renderScene() {
  const sc = SCENES[sceneI];
  $("sceneSvg").innerHTML = sc.draw();
  $("sceneK").textContent = sc.k; $("sceneT").textContent = sc.t; $("sceneP").textContent = sc.p;
  $("sceneDots").innerHTML = SCENES.map((_, i) => `<button class="${i === sceneI ? "on" : ""}" data-i="${i}" aria-label="${i + 1}단계">${i + 1}</button>`).join("");
  $("sceneDots").querySelectorAll("button").forEach(b => b.onclick = () => { sceneI = +b.dataset.i; renderScene(); });
  $("scPrev").disabled = sceneI === 0; $("scNext").textContent = sceneI === SCENES.length - 1 ? "처음으로" : "다음 ▶";
}
$("scPrev").onclick = () => { if (sceneI > 0) { sceneI--; renderScene(); } };
$("scNext").onclick = () => { sceneI = (sceneI + 1) % SCENES.length; renderScene(); };
$("scPlay").onclick = () => {
  if (autoplay) { clearInterval(autoplay); autoplay = null; $("scPlay").textContent = "자동 재생"; return; }
  $("scPlay").textContent = "멈춤"; autoplay = setInterval(() => { sceneI = (sceneI + 1) % SCENES.length; renderScene(); }, 6000);
};

// mini quiz
let qState = { right: 0, total: 0 };
function newQuiz() {
  const r = Math.random, T = TOPICS[Math.floor(r() * TOPICS.length)];
  const lie = T.lies[Math.floor(r() * T.lies.length)];
  const trues = [T.pro[Math.floor(r() * 3)], T.con[Math.floor(r() * 3)]];
  const items = [{ text: lie[1], lie: true, why: lie[2] }, ...trues.map(t => ({ text: t[0], src: t[1], lie: false }))].sort(() => r() - 0.5);
  $("qClaim").textContent = `쟁점: ${T.claim}`;
  $("qCards").innerHTML = items.map((it, i) => `<button class="qcard" data-i="${i}">${esc(it.text)}</button>`).join("");
  $("qWhy").textContent = "카드를 하나 고르세요.";
  $("qCards").querySelectorAll(".qcard").forEach(b => b.onclick = () => {
    const pick = items[+b.dataset.i]; qState.total++; if (pick.lie) qState.right++;
    $("qCards").querySelectorAll(".qcard").forEach((x, i) => { x.disabled = true; x.classList.add(items[i].lie ? "right" : "wrong"); if (items[i].lie) x.insertAdjacentHTML("beforeend", `<small style="color:#B23A28;font-weight:700">배신자의 거짓 근거</small>`); if (!items[i].lie) x.insertAdjacentHTML("beforeend", `<small>사실 · 출처: ${esc(items[i].src)}</small>`); });
    const L = items.find(x => x.lie);
    $("qWhy").innerHTML = `${pick.lie ? `<span class="hit">정답! 배신자의 근거를 찾았습니다.</span>` : `<span class="warn">아쉽습니다. 이 카드는 사실이었어요.</span>`} <b>무엇이 틀렸을까?</b> ${esc(L.why)}`;
    $("qScore").textContent = `${qState.total}문제 중 ${qState.right}개 정답`;
  });
}
$("qNext").onclick = newQuiz;

// ---------------- role card ----------------
const FRAME = `<div><b>발언 틀</b>"나는 오늘 쟁점에 <u>찬성/반대</u>한다. 왜냐하면 ______ 이기 때문이다. 근거는 ______ (출처: ______)이다."</div><div><b>질문 카드</b>"그 내용 출처가 어디야?" · "언제 나온 자료야?" · "그 숫자 정확해? 대상이 맞아?"</div>`;
function cardHTML(c, seat, day, sealed = true) {
  const { T, players, R } = dayCards(c, day), p = players[seat], D = R.D, di = p.district;
  let body = "";
  if (p.role === "judge") {
    body = `<div><span class="stamp judge">심판</span></div>
      <div class="evidence"><b>${di + 1}구역 심판 · 시즌 내내 같음 · 절대 마피아가 아님</b><p>오늘은 입장 없이 ${di + 1}구역 토론을 판정합니다.</p></div>
      <ul class="mission">
        <li>진영마다 체크: ① 근거를 말했다 ② 출처를 댔다 ③ 상대 질문에 답했다. 거짓이 적발된 진영은 1개 뺀다.</li>
        <li>반론 시간에 "출처 화면을 보여 주세요"라고 요구할 수 있다.</li>
        <li>오늘 가장 잘한 학생 1명을 MVP로 뽑는다. 광장의 날에는 MVP가 광장 대표토론에 나간다.</li>
        <li>밤에 "심판은 고개를 드세요"가 들리면, 다른 심판들과 함께 보호할 한 사람을 가리킨다.</li>
      </ul>`;
  } else {
    const isM = p.role === "mafia";
    const mission = isM ? `<div class="mission-box">비밀 임무: 오늘 ${di + 1}구역의 ${SIDE[p.side]} 진영(우리 편)이 지게 만들어라. 같은 편인 척하세요.</div>` : "";
    const tips = isM
      ? ["거짓 근거가 적발되면 우리 진영이 불리해집니다. 일부러 들키거나, 반론을 약하게 하세요. 너무 티 나면 재판에 넘겨집니다.", `밤에 "마피아는 고개를 드세요"가 들리면 동료와 함께 입을 막을 한 사람을 가리키세요.`, "익명 제보(시즌 1회)를 쓰고 싶으면 선생님께 몰래 신호를 보내세요.", `마피아 동료: ${R.mafia.filter(s => s !== seat).map(s => `${s}번(${districtOf(c.n, s) + 1}구역)`).join(", ")}`]
      : [day === 1 ? "오늘은 연습 판입니다. 배신자는 아직 없습니다. 토론 방식에 익숙해지세요." : "우리 팀 안에 배신자가 있을 수 있습니다. 근거가 이상하거나 일부러 약하게 말하는 사람을 기억하세요.", "검색 시간에는 확인할 상대 근거 1개를 먼저 말하고 검색하세요.", "입막음을 당했다면 근거를 쪽지에 써서 같은 편이 대신 읽게 하세요."];
    const arrest = isM ? `<details class="arrest"><summary>이미 체포되었다면 여기를 여세요</summary><p style="margin:8px 0 4px;font-size:.92rem">체포된 마피아는 임무가 사라지고, 오늘부터 아래 사실 근거로 우리 진영이 이기도록 토론합니다.</p><div class="evidence" style="margin:0"><b>사실 근거 카드 · ${SIDE[p.side]}</b><p>${esc(p.alt[0])}</p><small>출처: ${esc(p.alt[1])}</small></div></details>` : "";
    body = `<div><span class="stamp ${p.role}">${ROLE[p.role]}</span><span class="stance ${p.side}">오늘 내 입장: ${SIDE[p.side]}</span></div>
      ${mission}
      <div class="evidence"><b>${isM ? "거짓 근거 카드 (대부분 맞고 한 부분만 틀림)" : "근거 카드"}</b><p>${esc(p.text)}</p>${p.src ? `<small>출처: ${esc(p.src)}</small>` : `<small>출처를 물으면 그럴듯하게 대답하세요.</small>`}</div>
      <ul class="mission">${tips.map(m => `<li>${esc(m)}</li>`).join("")}</ul>
      <div class="helper">${FRAME}</div>${arrest}`;
  }
  return `<div class="case" ${sealed ? 'id="case"' : ""}>
      <div class="tab">${esc(c.code)} · DAY ${day} · ${seat}번</div>
      <p class="topic">DAY ${day}${day === 1 ? " 연습" : ""} · ${esc(T.name)} · <b>${di + 1}구역</b> (${D[di][0]}~${D[di][D[di].length - 1]}번)</p>
      <p class="claim">${esc(T.claim)}</p>${body}
      ${sealed ? `<button class="seal" id="seal" type="button" aria-label="카드 열기"><div><strong>기밀 카드</strong><span>밤이 되었습니다. 고개를 숙이고 누르세요</span></div></button>` : ""}
    </div>`;
}
function renderSamples() {
  const c = parseCode("24-DEMO"), R = roles(c), d = 2, cards = dayCards(c, d);
  const cit = Object.values(cards.players).find(p => p.role === "citizen").seat;
  $("samples").innerHTML = [["시민 카드", cit], ["심판 카드", R.judges[0]], ["마피아 카드", R.mafia[0]]].map(([t, s]) => `<div><p class="label">${t}</p>${cardHTML(c, s, d, false)}</div>`).join("");
}

// ---------------- routing ----------------
function route() {
  const h = location.hash || "#home";
  const views = { "#home": "viewHome", "#guide": "viewGuide", "#student": "viewStudent", "#teacher": "viewTeacher" };
  const v = views[h] || "viewHome";
  Object.values(views).forEach(id => { $(id).hidden = id !== v; });
  [["navH", "viewHome"], ["navG", "viewGuide"], ["navS", "viewStudent"], ["navT", "viewTeacher"]].forEach(([n, id]) => $(n).setAttribute("aria-current", id === v ? "page" : "false"));
  if (v !== "viewGuide" && autoplay) { clearInterval(autoplay); autoplay = null; $("scPlay").textContent = "자동 재생"; }
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);

// home doors
$("doors").innerHTML = [
  ["#guide", "처음이에요", "그림으로 보는 게임 방법 10단계와 '거짓 근거 찾기' 미니 체험", "게임 방법 보기 →",
    `<svg viewBox="0 0 300 120"><rect width="300" height="120" fill="#13141B"/>${person(60, 45, { c: COL.pro, s: 0.9 })}${person(110, 45, { c: COL.con, s: 0.9 })}${person(160, 45, { c: COL.judge, s: 0.9 })}${person(210, 45, { c: COL.pro, s: 0.9, ring: COL.mafia, dash: true, mark: "?" })}<rect x="240" y="20" width="44" height="30" rx="6" fill="${COL.gold}"/><path d="M256,27 l12,8 l-12,8 z" fill="#13141B"/></svg>`],
  ["#student", "학생", "시즌 코드와 출석번호를 넣고, 밤에 내 비밀 카드를 확인합니다", "내 카드 받기 →",
    `<svg viewBox="0 0 300 120"><rect width="300" height="120" fill="#13141B"/><rect x="115" y="8" width="70" height="104" rx="12" fill="#0E0F16" stroke="#3A3D52" stroke-width="2"/><rect x="122" y="20" width="56" height="80" rx="6" fill="${COL.paper}"/><rect x="128" y="30" width="44" height="18" rx="3" fill="none" stroke="${COL.mafia}" stroke-width="2.5" transform="rotate(-6 150 39)"/><path d="M128,60 h44 M128,68 h36 M128,76 h40" stroke="#B9AE95" stroke-width="3"/></svg>`],
  ["#teacher", "선생님", "반별 시즌 만들기, 단계별 진행과 타이머, 판정·점수 입력", "진행 화면 열기 →",
    `<svg viewBox="0 0 300 120"><rect width="300" height="120" fill="#13141B"/><rect x="60" y="12" width="180" height="84" rx="8" fill="#1D1F2A" stroke="#3A3D52" stroke-width="2"/><text x="150" y="62" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="30" font-weight="600" fill="${COL.gold}">3:00</text><rect x="135" y="96" width="30" height="12" fill="#3A3D52"/><rect x="110" y="106" width="80" height="6" rx="3" fill="#3A3D52"/></svg>`],
].map(([h, t, p, go, art]) => `<a class="door" href="${h}">${art}<h3>${t}</h3><p>${p}</p><span class="go">${go}</span></a>`).join("");

// ---------------- student ----------------
fillSelect($("day"), 1, 6, 1, v => `DAY ${v}${v === 1 ? " (연습)" : ""}`);
function syncSeats() { const c = parseCode($("code").value); const n = c ? c.n : 30; const cur = +$("seat").value || 1; fillSelect($("seat"), 1, n, Math.min(cur, n), v => `${v}번`); }
syncSeats();
$("code").addEventListener("input", () => { syncSeats(); renderLive(); });
const last = store.get("ssi-last4");
if (last) { $("code").value = last.code; syncSeats(); $("seat").value = last.seat; $("day").value = last.day || 1; }
function stepOn(i) { document.querySelectorAll("#viewStudent .stepper span").forEach((s, k) => s.classList.toggle("on", k === i)); }
$("joinForm").addEventListener("submit", e => {
  e.preventDefault();
  const c = parseCode($("code").value);
  if (!c) { $("joinErr").textContent = "시즌 코드를 다시 확인하세요. 반 인원-영문 4자리 형식입니다(예: 24-K7QD)."; return; }
  $("joinErr").textContent = "";
  store.set("ssi-last4", { code: c.code, seat: +$("seat").value, day: +$("day").value });
  liveFlash = ""; showCard(false); renderLive();
  if (window.matchMedia("(max-width: 760px)").matches) $("cardSlot").scrollIntoView({ behavior: "smooth" });
});


// live banner on the student screen
function liveFor(code) { const e = LIVE.classes && LIVE.classes[code]; if (!e || Date.now() - (e.updated || 0) > 6 * 3600e3) return null; return e; }
function liveRemain(e) { return e.running && e.endsAt ? Math.max(0, Math.round((e.endsAt - Date.now()) / 1000)) : (e.remain ?? e.dur); }
let liveFlash = "";
function renderLive() {
  const c = parseCode($("code").value) || parseCode((store.get("ssi-last4") || {}).code), box = $("liveBox");
  const e = c && liveFor(c.code);
  const strip = $("liveStrip");
  strip.hidden = !e;
  if (!e) { box.innerHTML = `<div class="live-wait">${c ? `${esc(c.code)} 반의 진행 정보가 아직 없습니다. 선생님이 '학생 화면 연동'을 켜고 단계를 넘기면 여기에 지금 단계와 남은 시간이 표시됩니다.` : "우리 반 시즌 코드를 입력하면, 선생님이 진행하는 단계와 남은 시간이 여기에 표시됩니다."}</div>`; return; }
  const [msg, ph] = STU[e.phase] || ["선생님 안내를 따르세요.", "down"], [pc, pt] = PHONE[ph], r = liveRemain(e);
  strip.className = "strip" + (e.phase === "밤" ? " night" : "");
  strip.innerHTML = `<span>DAY ${e.day} · ${esc(e.phase)}</span><span class="phone ${pc}">${pt}</span><span class="cd" id="stripCd">${fmt(r)}</span>`;
  box.innerHTML = `<div class="live ${e.phase === "밤" ? "night" : ""}">
    <div class="top"><div class="now"><small>지금 진행 중 · ${esc(e.cls)} · DAY ${e.day}/${e.days}${e.day === 1 ? " 연습" : ""}</small>${esc(e.phase)}</div><div class="cd ${r <= 10 && e.running ? "low" : ""}" id="liveCd">${fmt(r)}${e.running ? "" : " ❚❚"}</div></div>
    <div class="prog">${[...Array(e.total)].map((_, i) => `<i class="${i < e.pi ? "done" : i === e.pi ? "on" : ""}"></i>`).join("")}</div>
    <div class="todo-s">${esc(msg)}</div>
    <div><span class="phone ${pc}">${pt}</span></div>
    ${e.news && e.news.length ? `<div class="news">${e.news.map(([k, v]) => `<div><b>${esc(k)}</b>${esc(v)}</div>`).join("")}</div>` : ""}
    ${liveFlash ? `<div class="flash">${esc(liveFlash)}</div>` : ""}
    <span class="muted" style="font-size:.8rem">선생님이 단계를 넘기면 이 화면이 자동으로 바뀝니다 · ${hhmm(e.updated)} 업데이트</span></div>`;
  if (+$("day").value !== e.day) {
    $("day").value = e.day; const l = store.get("ssi-last4"); if (l) { l.day = e.day; store.set("ssi-last4", l); }
    if ($("case")) { showCard(false); liveFlash = `DAY ${e.day} 카드로 바뀌었습니다. 밤에 다시 열어 보세요.`; renderLive(); }
  }
}
setInterval(() => { const el = $("liveCd"); if (!el || $("viewStudent").hidden) return; const c = parseCode($("code").value); const e = c && liveFor(c.code); if (!e || !e.running) return; const r = liveRemain(e); el.textContent = fmt(r); el.classList.toggle("low", r <= 10); const sc = $("stripCd"); if (sc) sc.textContent = fmt(r); }, 1000);
const ss = { get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} } };
function showCard(open) {
  const c = parseCode($("code").value); if (!c) return;
  const seat = +$("seat").value, day = +$("day").value;
  $("cardSlot").className = "";
  $("cardSlot").innerHTML = cardHTML(c, seat, day, true) + `<div class="card-actions"><button type="button" id="hideBtn">카드 가리기</button></div>`;
  stepOn(1); ss.set("ssi-card", { shown: true, open: false, day });
  $("seal").onclick = () => { $("seal").hidden = true; $("case").classList.add("open"); stepOn(2); ss.set("ssi-card", { shown: true, open: true, day }); };
  $("hideBtn").onclick = () => { $("seal").hidden = false; $("case").classList.remove("open"); stepOn(1); ss.set("ssi-card", { shown: true, open: false, day }); };
  if (open) $("seal").click();
}

// ---------------- teacher state ----------------
let cls = store.get("ssi-v3-class") ?? 0, S = null, history = [];
const skey = i => `ssi-v3-${i}`;
function makeKey() { const a = new Uint32Array(4); try { crypto.getRandomValues(a); } catch { a.forEach((_, i) => a[i] = Math.floor(Math.random() * 1e9)); } let s = ""; a.forEach(v => s += ALPHA[v % ALPHA.length]); return s; }
const fresh = (n, days) => ({ code: `${n}-${makeKey()}`, days, day: 1, night: {}, judge: {}, plaza: {}, noms: {}, trials: [], tip: null, extra: {}, ended: false });
function load() { S = store.get(skey(cls)); if (!S || !parseCode(S.code)) { S = fresh(24, 4); store.set(skey(cls), S); } history = []; }
const save = () => store.set(skey(cls), S);
const snap = () => { history.push(JSON.stringify(S)); };
const C = () => parseCode(S.code);
const caughtBefore = (d, st = S) => st.trials.filter(t => t[2] && t[0] < d).map(t => t[1]);
const caughtAll = (st = S) => st.trials.filter(t => t[2]).map(t => t[1]);
function compute(st = S) {
  const c = parseCode(st.code), R = roles(c), Dn = R.D.length, per = {}, betray = {};
  const add = (d, di, v) => { (per[d] = per[d] || Array(Dn).fill(0))[di] += v; };
  for (let d = 1; d <= st.day; d++) {
    per[d] = per[d] || Array(Dn).fill(0);
    const j = st.judge[d] || {}, cards = dayCards(c, d);
    R.D.forEach((_, di) => {
      const x = j[di]; if (!x) return;
      add(d, di, (+x.pro || 0) + (+x.con || 0) + (+x.lies || 0));
      if (d > 1) {
        const winner = (+x.pro || 0) > (+x.con || 0) ? "pro" : (+x.con || 0) > (+x.pro || 0) ? "con" : null;
        R.mafia.forEach(m => { const p = cards.players[m]; if (p.district === di && !caughtBefore(d, st).includes(m) && winner && p.side !== winner) betray[m] = (betray[m] || 0) + 1; });
      }
    });
    const nt = st.night[d]; if (nt && nt.target) add(d, districtOf(c.n, +nt.target), 1);
    const pz = st.plaza[d];
    if (pz && pz.win && pz.win !== "draw") (pz.reps || []).forEach((s, i) => { if (s && (i < 2 ? "pro" : "con") === pz.win) add(d, districtOf(c.n, +s), 1); });
    if (pz && pz.aud) add(d, districtOf(c.n, +pz.aud), 1);
    st.trials.filter(t => t[0] === d && t[2] && t[3] != null).forEach(t => add(d, t[3], 2));
    if (st.tip && st.tip.day === d && st.tip.dist != null) add(d, st.tip.dist, 2);
    (st.extra[d] || []).forEach((v, di) => { if (v) add(d, di, v); });
  }
  const allCaught = R.mafia.every(m => caughtAll(st).includes(m));
  const endBonus = st.ended && allCaught ? 3 : 0;
  const totals = R.D.map((_, di) => Object.values(per).reduce((s, a) => s + (a[di] || 0), 0) + endBonus);
  return { per, totals, endBonus, betray, allCaught, R };
}
function dayWinner(d) {
  const j = S.judge[d] || {}; let p = 0, k = 0;
  Object.values(j).forEach(x => { if ((+x.pro || 0) > (+x.con || 0)) p++; else if ((+x.con || 0) > (+x.pro || 0)) k++; });
  if (!p && !k) return null;
  return p > k ? "찬성 진영" : k > p ? "반대 진영" : "무승부";
}
function nightText(d) {
  const nt = S.night[d]; if (!nt || !nt.target) return "";
  return +nt.target === +nt.protect ? `어젯밤 마피아의 공격을 심판이 막아냈습니다! (표적 ${nt.target}번)` : `어젯밤 마피아가 ${nt.target}번의 입을 막았습니다. 오늘 ${nt.target}번은 입론을 직접 말할 수 없습니다.`;
}

// ---------------- teacher: steps ----------------
const ICON = {
  setup: `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#262938"/><path d="M20 22h24v20H20z" fill="none" stroke="${COL.gold}" stroke-width="3"/><path d="M26 48h12M32 42v6" stroke="${COL.gold}" stroke-width="3"/></svg>`,
  night: `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#0B0C14"/><circle cx="34" cy="30" r="14" fill="#F5E9B8"/><circle cx="41" cy="25" r="12" fill="#0B0C14"/><circle cx="18" cy="44" r="2" fill="#F5E9B8"/><circle cx="46" cy="46" r="1.6" fill="#F5E9B8"/></svg>`,
  news: `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#262938"/><rect x="16" y="18" width="32" height="28" rx="3" fill="${COL.paper}"/><path d="M21 25h22M21 31h22M21 37h14" stroke="#9A6B12" stroke-width="2.5"/></svg>`,
  debate: `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#262938"/><rect x="10" y="18" width="24" height="16" rx="6" fill="${COL.pro}"/><rect x="30" y="30" width="24" height="16" rx="6" fill="${COL.con}"/></svg>`,
  plaza: `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#262938"/><path d="M14 46 L20 34 H44 L50 46 Z" fill="#B58CF0"/><circle cx="26" cy="26" r="4" fill="${COL.pro}"/><circle cx="38" cy="26" r="4" fill="${COL.con}"/></svg>`,
  trial: `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#262938"/><rect x="18" y="20" width="22" height="10" rx="3" fill="${COL.gold}" transform="rotate(-30 29 25)"/><path d="M30 30 L44 46" stroke="${COL.gold}" stroke-width="4" stroke-linecap="round"/><rect x="16" y="46" width="22" height="5" rx="2" fill="${COL.gold}"/></svg>`,
  wrap: `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#262938"/><rect x="16" y="34" width="8" height="14" fill="#4A4F6A"/><rect x="28" y="24" width="8" height="24" fill="${COL.gold}"/><rect x="40" y="30" width="8" height="18" fill="#4A4F6A"/></svg>`,
};
const STEPS = [["setup", "시즌 준비", "코드·QR"], ["night", "밤", "입막음·보호"], ["news", "아침 뉴스", "어제 결과"], ["debate", "구역 토론", "입론~판정"], ["plaza", "광장 토론", "DAY 2·4"], ["trial", "광장 재판", "하루 1명"], ["wrap", "점수·마무리", "다음 날로"]];
let step = "setup";
const stepAvail = id => id === "setup" || id === "wrap" || id === "news" || id === "debate" || (id === "night" && S.day > 1) || (id === "trial" && S.day > 1) || (id === "plaza" && isPlazaDay(S.day, S.days));
function renderBar() {
  const c = C(), R = roles(c), left = R.mafia.length - caughtAll().length;
  $("classTabs").innerHTML = CLASSES.map((n, i) => `<button role="tab" aria-selected="${i === cls}" class="${i === cls ? "on" : ""}" data-c="${i}">${n}</button>`).join("");
  $("classTabs").querySelectorAll("button").forEach(b => b.onclick = () => { cls = +b.dataset.c; store.set("ssi-v3-class", cls); load(); booted = false; buildPhases(); restoreRun(); booted = true; renderAllT(); });
  $("barCode").textContent = S.code;
  $("barDay").textContent = `DAY ${S.day}/${S.days}${S.day === 1 ? " 연습" : isPlazaDay(S.day, S.days) ? " ★광장" : ""} · 남은 마피아 ${left}`;
  $("stepsNav").innerHTML = STEPS.map(([id, t, sub]) => `<button role="tab" aria-selected="${id === step}" class="${id === step ? "on" : ""} ${stepAvail(id) ? "" : "off"}" data-s="${id}">${t}<small>${stepAvail(id) ? sub : (id === "plaza" ? "오늘은 없음" : "DAY 1은 없음")}</small></button>`).join("");
  $("stepsNav").querySelectorAll("button").forEach(b => b.onclick = () => goStep(b.dataset.s, true));
}
function goStep(id, syncTimer) {
  step = id; renderBar(); renderStep(); saveRun();
  if (syncTimer) { const i = phases.findIndex(p => p[4] === id); if (i >= 0 && i !== pi) { pi = i; setPhase(false); } }
}
function nextStepBtn(label) {
  const order = STEPS.map(s => s[0]).filter(stepAvail); const i = order.indexOf(step); const nx = order[i + 1];
  return nx ? `<button class="primary bigbtn" id="goNext">${label || "다음 단계"}: ${STEPS.find(s => s[0] === nx)[1]} ▶</button>` : "";
}
function bindNext() { const b = $("goNext"); if (b) b.onclick = () => { const order = STEPS.map(s => s[0]).filter(stepAvail); goStep(order[order.indexOf(step) + 1], true); }; }
function head(id, title, desc) { return `<div class="head">${ICON[id]}<div><h2>${title}</h2><p>${desc}</p></div></div>`; }
const sayBox = id => { const p = phases.find(x => x[4] === id); return p ? `<div class="say"><b>사회자 멘트</b>${esc(p[2])}</div>` : ""; };
const QR_SRC = "QR_DATA_URI";

function renderStep() {
  const c = C(), R = roles(c), d = S.day, P = $("tpanel");
  if (!stepAvail(step)) step = "setup";
  if (step === "setup") {
    P.innerHTML = `${head("setup", `${CLASSES[cls]} 시즌 준비`, "반 인원과 시즌 길이를 정하고 코드를 학생들에게 보여 주세요.")}
      <div class="qrbox"><img src="${QR_SRC}" alt="게임 페이지 QR 코드"><div><div class="muted" style="font-size:.85rem">학생 접속: QR → '학생 카드' → 아래 코드 입력</div><div class="codebig">${esc(S.code)}</div><div class="muted" style="margin-top:6px">DAY ${d} · ${esc(TOPICS[dayTopic(c, d)].name)} · ${R.D.length}개 구역 · 마피아 ${R.mafia.length}명 · 구역 심판 ${R.judges.map((s, i) => `${i + 1}구역 ${s}번`).join(", ")}</div></div></div>
      <div class="rowx"><label class="f" for="tN">반 인원<select id="tN"></select></label><label class="f" for="tD">시즌 길이<select id="tD"></select></label><span id="newArea" style="flex:1;min-width:200px"></span></div>
      <div class="used">${[...Array(S.days)].map((_, i) => `<span class="t ${i + 1 < d ? "done" : ""}" ${i + 1 === d ? 'style="border-color:var(--gold);color:var(--gold)"' : ""}>DAY ${i + 1}${isPlazaDay(i + 1, S.days) ? "★" : ""} ${esc(TOPICS[dayTopic(c, i + 1)].name)}</span>`).join("")}<span>★ 광장 대표토론</span></div>
      <ul class="todo"><li>학생들은 시즌 내내 같은 출석번호를 씁니다. 구역은 출석번호 순으로 자동 편성됩니다.</li><li>심판은 공개해도 됩니다. 구역 심판에게 체크리스트 역할을 알려 주세요.</li><li>준비가 끝나면 위쪽 막대의 '시작'을 누르고 밤부터 진행합니다.</li></ul>
      <div class="next-row"><span class="muted">${d === 1 ? "DAY 1은 연습 판: 밤의 행동과 재판이 없습니다." : ""}</span>${nextStepBtn("시작")}</div>`;
    fillSelect($("tN"), 12, 30, c.n, v => `${v}명`); fillSelect($("tD"), 3, 6, S.days, v => `${v}일`);
    newIdle();
  } else if (step === "night") {
    const nt = S.night[d] || {}, everyone = [...Array(c.n)].map((_, i) => i + 1).filter(s => !caughtBefore(d).includes(s));
    P.innerHTML = `${head("night", `DAY ${d} 밤`, "학생들이 모두 고개를 숙였을 때만 입력하세요.")}${sayBox("night")}
      <div class="rowx"><label class="f" for="nTarget">마피아가 가리킨 사람 (입막음)<select id="nTarget">${seatOpts(everyone, nt.target, "지목 없음")}</select></label>
      <label class="f" for="nProtect">심판들이 가리킨 사람 (보호)<select id="nProtect">${seatOpts(everyone, nt.protect, "지목 없음")}</select></label><button class="gold" id="nightSave">밤 결과 저장</button></div>
      <div class="result">${nightText(d) ? (+nt.target === +nt.protect ? `<span class="hit">${nightText(d)}</span>` : `<span class="warn">${nightText(d)}</span>`) : `<span class="muted">아직 저장하지 않았습니다. 같은 사람을 고르면 보호 성공입니다.</span>`}</div>
      <div class="next-row"><span class="muted">표적이 된 학생의 구역은 +1(마피아가 두려워한 사람)</span>${nextStepBtn()}</div>`;
    $("nightSave").onclick = () => { snap(); S.night[d] = { target: +$("nTarget").value || null, protect: +$("nProtect").value || null }; save(); renderStep(); renderBar(); };
  } else if (step === "news") {
    const items = newsItems();
    P.innerHTML = `${head("news", `DAY ${d} 아침 뉴스`, "전체 화면으로 띄우고 뉴스 앵커처럼 읽어 주세요.")}${sayBox("news")}
      <div class="grid4">${items.map(([k, v]) => `<div class="dcard"><span class="label" style="margin:0">${esc(k)}</span><div>${esc(v)}</div></div>`).join("")}</div>
      <div class="next-row"><button class="gold bigbtn" id="newsBtn">아침 뉴스 전체 화면</button>${nextStepBtn()}</div>`;
    $("newsBtn").onclick = showNews;
  } else if (step === "debate") {
    const j = S.judge[d] || {};
    const subs = phases.map((p, i) => [p, i]).filter(([p]) => p[4] === "debate");
    const sel = (id, v, max) => `<select id="${id}">${[...Array(max + 1)].map((_, i) => `<option value="${i}" ${+v === i ? "selected" : ""}>${i}</option>`).join("")}</select>`;
    const w = dayWinner(d);
    P.innerHTML = `${head("debate", `DAY ${d} 구역 토론 · ${esc(TOPICS[dayTopic(c, d)].name)}`, "작전 회의 → 입론 → 검색 → 반론 → 심판 판정 순서로 진행합니다.")}
      <div class="subphase">${subs.map(([p, i]) => `<button class="${i === pi ? "on" : ""}" data-p="${i}">${p[0]} ${Math.round(p[1] / 60)}분</button>`).join("")}</div>
      ${phases[pi] && phases[pi][4] === "debate" ? `<div class="say"><b>사회자 멘트 · ${esc(phases[pi][0])}</b>${esc(phases[pi][2])}</div>` : sayBox("debate")}
      <div class="rowx"><button id="frameBtn">발언 틀·질문 카드 띄우기</button><button class="danger" id="tipShow" ${S.tip && S.tip.day !== d || d === 1 || S.ended ? "disabled" : ""}>익명 제보 띄우기 (시즌 1회)</button>
      ${S.tip && S.tip.day === d ? `<label class="f" for="tipDist">제보를 먼저 반박한 구역<select id="tipDist"><option value="">—</option>${R.D.map((_, di) => `<option value="${di}" ${S.tip.dist === di ? "selected" : ""}>${di + 1}구역</option>`).join("")}</select></label><button class="gold" id="tipSave">+2 주기</button>` : `<span class="muted" style="font-size:.85rem">${S.tip ? `익명 제보는 DAY ${S.tip.day}에 사용함` : "마피아가 신호를 보내면 사용"}</span>`}</div>
      <p class="label" style="margin:6px 0 0">심판 보고 입력 (체크 0~3 · 거짓 적발 수 · MVP)</p>
      <div class="grid4">${R.D.map((m, di) => { const x = j[di] || {}, debaters = m.filter(s => s !== R.judges[di]); const ww = x.pro == null ? "" : (+x.pro > +x.con ? `<b>찬성 승리</b>` : +x.con > +x.pro ? `<b>반대 승리</b>` : "<b>무승부</b>"); return `<div class="dcard"><h3>${di + 1}구역 <span>${m[0]}~${m[m.length - 1]}번 · 심판 ${R.judges[di]}번</span></h3>
        <div class="mini"><label class="f" for="jp${di}">찬성 체크${sel(`jp${di}`, x.pro ?? 0, 3)}</label><label class="f" for="jc${di}">반대 체크${sel(`jc${di}`, x.con ?? 0, 3)}</label>
        <label class="f" for="jl${di}">거짓 적발 수${sel(`jl${di}`, x.lies ?? 0, 3)}</label><label class="f" for="jm${di}">MVP<select id="jm${di}">${seatOpts(debaters, x.mvp)}</select></label></div>
        <div class="rowx"><button class="sm gold" data-j="${di}">저장</button><span class="out">${ww}</span></div></div>`; }).join("")}</div>
      <div class="result">${w ? `오늘의 토론 결과: <span class="hit">${w}${w === "무승부" ? "" : " 승리"}</span>` : `<span class="muted">구역별로 저장하면 오늘의 승리 진영이 나옵니다.</span>`}</div>
      <div class="next-row"><span></span>${nextStepBtn()}</div>`;
    P.querySelectorAll(".subphase button").forEach(b => b.onclick = () => { pi = +b.dataset.p; setPhase(); renderStep(); });
    $("frameBtn").onclick = showFrame;
    $("tipShow").onclick = showTip;
    if ($("tipSave")) $("tipSave").onclick = () => { const v = $("tipDist").value; if (v === "") return; snap(); S.tip.dist = +v; save(); renderStep(); };
    P.querySelectorAll("button[data-j]").forEach(b => b.onclick = () => { const di = +b.dataset.j; snap(); (S.judge[d] = S.judge[d] || {})[di] = { pro: +$(`jp${di}`).value, con: +$(`jc${di}`).value, lies: +$(`jl${di}`).value, mvp: +$(`jm${di}`).value || null }; save(); renderStep(); });
  } else if (step === "plaza") {
    const cards = dayCards(c, d), pz = S.plaza[d] || {}, j = S.judge[d] || {}, mvps = Object.values(j).map(x => x.mvp).filter(Boolean);
    const pool = side => { const all = Object.values(cards.players).filter(p => p.side === side).map(p => p.seat).sort((a, b) => a - b); const top = all.filter(s => mvps.includes(s)); return [...top, ...all.filter(s => !top.includes(s))]; };
    const reps = pz.reps || [];
    P.innerHTML = `${head("plaza", `DAY ${d} 광장 대표토론`, `구역 MVP${mvps.length ? `(${mvps.join(", ")}번)` : ""} 중 찬성 2명, 반대 2명이 나섭니다. MVP가 목록 맨 위에 나옵니다.`)}${sayBox("plaza")}
      <div class="rowx"><label class="f" for="pP1">찬성 대표 1<select id="pP1">${seatOpts(pool("pro"), reps[0])}</select></label><label class="f" for="pP2">찬성 대표 2<select id="pP2">${seatOpts(pool("pro"), reps[1])}</select></label>
      <label class="f" for="pC1">반대 대표 1<select id="pC1">${seatOpts(pool("con"), reps[2])}</select></label><label class="f" for="pC2">반대 대표 2<select id="pC2">${seatOpts(pool("con"), reps[3])}</select></label></div>
      <div class="rowx"><label class="f" for="pWin">심판단 판정<select id="pWin"><option value="">—</option><option value="pro" ${pz.win === "pro" ? "selected" : ""}>찬성 승리</option><option value="con" ${pz.win === "con" ? "selected" : ""}>반대 승리</option><option value="draw" ${pz.win === "draw" ? "selected" : ""}>무승부</option></select></label>
      <label class="f" for="pAud">청중상<select id="pAud">${seatOpts(reps.filter(Boolean), pz.aud)}</select></label><button class="gold" id="plazaSave">광장 결과 저장</button></div>
      <div class="result">${pz.win ? `광장 대표토론: <span class="hit">${pz.win === "draw" ? "무승부" : SIDE[pz.win] + " 진영 승리"}</span>${pz.aud ? ` · 청중상 ${pz.aud}번` : ""}` : `<span class="muted">입론 30초씩 → 자유 반론 2분 → 심판 4명 판정 → 청중 동시 지목</span>`}</div>
      <div class="next-row"><span></span>${nextStepBtn()}</div>`;
    ["pP1", "pP2", "pC1", "pC2"].forEach(id => $(id).addEventListener("change", () => { const r2 = ["pP1", "pP2", "pC1", "pC2"].map(x => +$(x).value || null); $("pAud").innerHTML = seatOpts(r2.filter(Boolean), $("pAud").value); }));
    $("plazaSave").onclick = () => { snap(); S.plaza[d] = { reps: ["pP1", "pP2", "pC1", "pC2"].map(x => +$(x).value || null), win: $("pWin").value || null, aud: +$("pAud").value || null }; save(); renderStep(); };
  } else if (step === "trial") {
    const noms = S.noms[d] || [], caught = caughtAll(), judgedToday = S.trials.filter(t => t[0] === d);
    const pool = [...new Set(noms.filter(Boolean))].filter(s => !caught.includes(s));
    const last = judgedToday[0];
    P.innerHTML = `${head("trial", `DAY ${d} 광장 재판`, "구역별 용의자 지명 → 15초 해명 → 전체 동시 투표 → 1명 판정")}${sayBox("trial")}
      <div class="grid4">${R.D.map((m, di) => `<div class="dcard"><h3>${di + 1}구역 <span>${m[0]}~${m[m.length - 1]}번</span></h3><label class="f" for="nm${di}">지명한 용의자<select id="nm${di}" data-n="${di}" ${last || S.ended ? "disabled" : ""}>${seatOpts([...Array(c.n)].map((_, i) => i + 1).filter(s => !caught.includes(s) || noms[di] === s), noms[di], "지명 안 함")}</select></label></div>`).join("")}</div>
      <div class="rowx"><label class="f" for="tVote">전체 투표 1위<select id="tVote">${pool.length && !last ? pool.map(s => `<option value="${s}">${s}번</option>`).join("") : `<option value="">—</option>`}</select></label><button class="danger bigbtn" id="trialBtn" ${!pool.length || last || S.ended ? "disabled" : ""}>판정 발표</button></div>
      <div class="result" id="trialResult">${last ? (last[2] ? `<span class="hit">${last[1]}번은 마피아가 맞습니다! 체포${last[3] != null ? ` · ${last[3] + 1}구역 +2` : ""}</span>` : `<span class="miss">${last[1]}번은 마피아가 아닙니다. 누명이었습니다.</span>`) + `<br><span class="muted">남은 마피아 ${R.mafia.length - caught.length}명</span>` : `<span class="muted">지명을 모두 고른 뒤 투표 1위를 판정하세요. 화면에는 그 사람이 마피아인지만 나옵니다.</span>`}</div>
      <div class="log">${S.trials.map(([dd, s, hit]) => `<div>DAY ${dd} · ${s}번 (${districtOf(c.n, s) + 1}구역) → ${hit ? "마피아 체포" : "시민, 누명"}</div>`).join("")}</div>
      <div class="next-row"><span></span>${nextStepBtn()}</div>`;
    P.querySelectorAll("select[data-n]").forEach(s => s.onchange = () => { snap(); (S.noms[d] = S.noms[d] || [])[+s.dataset.n] = +s.value || null; save(); renderStep(); });
    $("trialBtn").onclick = () => {
      const s = +$("tVote").value; if (!s) return; snap();
      const hit = R.mafia.includes(s), nd = (S.noms[d] || []).findIndex(x => +x === s);
      S.trials.push([d, s, hit, hit && nd >= 0 ? nd : null]); save(); chime(hit ? 3 : 1); renderBar(); renderStep();
    };
  } else if (step === "wrap") {
    const { per, totals, endBonus, betray, allCaught } = compute(), days = Object.keys(per).map(Number).sort((a, b) => a - b);
    const sorted = [...new Set(totals)].sort((a, b) => b - a), max = Math.max(1, ...totals);
    let tbl = `<thead><tr><th style="text-align:left">구역</th>${days.map(dd => `<th>DAY ${dd}<br><span style="font-weight:500">${esc(TOPICS[dayTopic(c, dd)].name)}</span></th>`).join("")}${S.ended ? "<th>시즌 결과</th>" : ""}<th>합계</th><th>순위</th><th style="text-align:left">오늘 보너스</th></tr></thead><tbody>`;
    R.D.forEach((m, di) => { const rank = sorted.indexOf(totals[di]) + 1; tbl += `<tr><td class="g">${di + 1}구역 <span class="muted" style="font-weight:500;font-size:.8rem">${m[0]}~${m[m.length - 1]}번</span></td>${days.map(dd => `<td class="${dd === d ? "cur" : ""}">${per[dd][di] || 0}</td>`).join("")}${S.ended ? `<td>${endBonus}</td>` : ""}<td class="total">${totals[di]}<div class="bar"><i style="width:${(totals[di] / max * 100).toFixed(0)}%"></i></div></td><td><span class="rank ${rank === 1 && totals[di] > 0 ? "r1" : ""}">${rank}</span></td><td><div class="acts"><button class="sm" data-d="${di}" data-p="1" ${S.ended ? "disabled" : ""}>+1</button><button class="sm" data-d="${di}" data-p="-1" ${S.ended ? "disabled" : ""}>−1</button></div></td></tr>`; });
    tbl += `</tbody>`;
    let ans = "";
    if (S.ended) {
      const caught = caughtAll();
      ans = `<p class="label" style="margin:8px 0 0">시즌 종료 해설</p><p style="margin:0;font-size:1.1rem"><b class="${allCaught ? "status-win" : "status-lose"}">${allCaught ? "시민 승리" : "마피아 승리"}</b></p><div class="groups">` + R.mafia.map(s => { let h = `<div class="group"><h3>${s}번 · ${districtOf(c.n, s) + 1}구역 마피아 · ${caught.includes(s) ? "체포" : "생존"} · 배신 성공 ${betray[s] || 0}회</h3><ol>`; for (let dd = 2; dd <= S.day; dd++) { if (caughtBefore(dd).includes(s)) break; const { T, players } = dayCards(c, dd), p = players[s]; h += `<li><span class="n">D${dd}</span><span class="chip ${p.side}">${SIDE[p.side]}</span><span class="chip citizen">${esc(T.name)}</span><span class="lie">${esc(p.text)}<em>무엇이 틀렸을까? ${esc(p.why)}</em></span></li>`; } return h + `</ol></div>`; }).join("") + `</div>`;
    }
    const w = dayWinner(d);
    P.innerHTML = `${head("wrap", `DAY ${d} 마무리`, "오늘의 결과와 구역 점수입니다.")}${sayBox("wrap")}
      <div class="result">${w ? `오늘의 토론: ${w}${w === "무승부" ? "" : " 승리"}` : "오늘의 토론 결과 미입력"} · 남은 마피아 ${R.mafia.length - caughtAll().length}명</div>
      <div class="scorewrap"><table class="score" id="scoreTable">${tbl}</table></div>
      <div class="next-row"><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="sm" id="undo" ${history.length ? "" : "disabled"}>되돌리기</button><span id="endArea"></span></div>
      ${d < S.days && !S.ended ? `<button class="primary bigbtn" id="nextDay">DAY ${d + 1}로 넘어가기 ▶</button>` : ""}</div>${ans}
      <div class="cmp"><p class="label" style="margin:10px 0 6px">반 대항 결과</p><div class="scorewrap"><table id="cmpTable"></table></div></div>`;
    P.querySelectorAll("button[data-p]").forEach(b => b.onclick = () => { snap(); const a = S.extra[d] = S.extra[d] || []; const di = +b.dataset.d; a[di] = (a[di] || 0) + +b.dataset.p; save(); renderStep(); });
    $("undo").onclick = () => { if (history.length) { S = JSON.parse(history.pop()); save(); renderAllT(); } };
    if ($("nextDay")) $("nextDay").onclick = () => { snap(); S.day++; save(); buildPhases(); step = "setup"; goStep(S.day > 1 ? "night" : "setup", true); };
    endIdle(); renderCmp();
  }
  bindNext();
}
function newIdle() {
  const area = $("newArea"); if (!area) return;
  area.innerHTML = `<button class="gold" id="newSeason" style="width:100%">${CLASSES[cls]} 새 시즌 시작</button>`;
  $("newSeason").onclick = () => {
    const go = () => { S = fresh(+$("tN").value, +$("tD").value); history = []; save(); buildPhases(); renderAllT(); };
    if (S.ended || (S.day === 1 && !Object.keys(S.judge).length)) { go(); return; }
    area.innerHTML = `<span class="confirm">${CLASSES[cls]}의 진행 중인 시즌 기록이 지워집니다. <button class="sm danger" id="nsYes">새 시즌</button><button class="sm" id="nsNo">취소</button></span>`;
    $("nsYes").onclick = go; $("nsNo").onclick = newIdle;
  };
}
function endIdle() {
  const area = $("endArea"); if (!area) return;
  area.innerHTML = `<button class="sm danger" id="endSeason" ${S.ended ? "disabled" : ""}>${S.ended ? "시즌 종료됨" : "시즌 종료 · 전체 공개"}</button>`;
  if (S.ended) return;
  $("endSeason").onclick = () => {
    area.innerHTML = `<span class="confirm">시즌을 끝내고 모든 정체를 공개할까요? <button class="sm danger" id="endYes">공개</button><button class="sm" id="endNo">취소</button></span>`;
    $("endYes").onclick = () => { snap(); S.ended = true; save(); chime(3); renderAllT(); };
    $("endNo").onclick = endIdle;
  };
}
function renderCmp() {
  const el = $("cmpTable"); if (!el) return;
  let h = `<thead><tr><th>반</th><th>진행</th><th>체포 / 마피아</th><th>누명</th><th>결과</th><th>최고 구역</th></tr></thead><tbody>`;
  CLASSES.forEach((name, i) => {
    const st = i === cls ? S : store.get(skey(i)); const c = st && parseCode(st.code);
    if (!c) { h += `<tr><td>${name}</td><td colspan="5" class="muted">시즌 없음</td></tr>`; return; }
    const { totals, R, allCaught } = compute(st), wrong = st.trials.filter(t => !t[2]).length, best = Math.max(...totals), bi = totals.indexOf(best);
    const res = st.ended ? (allCaught ? `<span class="status-win">시민 승리</span>` : `<span class="status-lose">마피아 승리</span>`) : `<span class="muted">진행 중</span>`;
    h += `<tr><td class="${i === cls ? "on" : ""}">${name}</td><td>DAY ${st.day}/${st.days}</td><td>${caughtAll(st).length} / ${R.mafia.length}</td><td>${wrong}</td><td>${res}</td><td>${best > 0 ? `${bi + 1}구역 (${best}점)` : "—"}</td></tr>`;
  });
  el.innerHTML = h + `</tbody>`;
}
function renderAllT() { renderBar(); renderStep(); }

// full-screen stage: news, tip, speaking frame
function newsItems() {
  const c = C(), d = S.day, t = TOPICS[dayTopic(c, d)], R = roles(c), left = R.mafia.length - caughtBefore(d).length, items = [];
  if (d === 1) items.push(["오늘", "평화로운 마을의 첫날입니다. 오늘은 연습 판, 아직 배신자는 움직이지 않습니다."]);
  else {
    const prev = S.trials.filter(x => x[0] === d - 1);
    items.push(["어제의 광장 재판", prev.length ? prev.map(([, s, hit]) => hit ? `${s}번은 마피아였습니다. 체포!` : `${s}번은 시민이었습니다. 누명이었습니다.`).join(" ") : "어제는 재판이 없었습니다."]);
    const w = dayWinner(d - 1); if (w) items.push(["어제의 토론", `${w}${w === "무승부" ? "" : "이 이겼습니다"}. 진 진영에 배신자가 있었을까요?`]);
    items.push(["어젯밤", nightText(d) || (d === 2 ? "어젯밤 마을에 배신자들이 깨어났습니다." : "조용한 밤이었습니다.")]);
    items.push(["남은 마피아", `${left}명이 아직 마을에 숨어 있습니다.`]);
  }
  items.push(["오늘의 쟁점", `${t.name} · ${t.claim}`]);
  if (isPlazaDay(d, S.days)) items.push(["특별 일정", "오늘은 광장 대표토론이 열립니다. 구역 MVP가 광장에 섭니다."]);
  return items;
}
function showNews() { showStage(`<div class="kicker">DAY ${S.day} · MORNING NEWS</div><h2>아침이 밝았습니다</h2><div class="items">${newsItems().map(([k, v]) => `<div class="item"><small>${esc(k)}</small>${esc(v)}</div>`).join("")}</div><button class="primary" id="stageClose" style="justify-self:end">닫기</button>`); }
function showTip() {
  if (!S.tip) { snap(); S.tip = { day: S.day, dist: null }; save(); }
  const c = C(), T = TOPICS[dayTopic(c, S.day)], r = rng(hash(`tip|${c.key}|${S.day}`)), [, text, why] = T.lies[Math.floor(r() * T.lies.length)];
  showStage(`<div class="kicker">ANONYMOUS TIP · 익명 제보</div><h2>출처를 알 수 없는 제보가 들어왔습니다</h2><div class="tipbody">"${esc(text)}"</div><div class="item" id="tipWhy" hidden><small>진위 공개</small>${esc(why)}</div><div class="tbtns" style="justify-content:flex-end"><button id="tipReveal">진위 공개</button><button class="primary" id="stageClose">닫기</button></div>`);
  $("tipReveal").onclick = () => { $("tipWhy").hidden = false; };
  renderStep();
}
function showFrame() { showStage(`<div class="kicker">말하기 도우미</div><h2>입론 발언 틀 (30초)</h2><div class="tipbody" style="background:rgba(99,169,230,.12);border-color:var(--pro)">"나는 오늘 쟁점에 [찬성 / 반대] 한다. 왜냐하면 ________ 이기 때문이다. 근거는 ________ (출처: ________) 이다."</div><div class="items"><div class="item"><small>질문 카드 · 출처</small>"그 내용 출처가 어디야?"</div><div class="item"><small>질문 카드 · 시기</small>"언제 나온 자료야?"</div><div class="item"><small>질문 카드 · 숫자와 대상</small>"그 숫자 정확해? 대상이 맞아?"</div></div><button class="primary" id="stageClose" style="justify-self:end">닫기</button>`); }
function showStage(html) { $("stageInner").innerHTML = html; $("stage").hidden = false; $("stageClose").onclick = () => { $("stage").hidden = true; }; chime(2); }
document.addEventListener("keydown", e => { if (e.key === "Escape") $("stage").hidden = true; });


// ---------------- teacher: sync toggle and timer persistence ----------------
let syncOn = store.get("ssi-sync") === true, artifactNS, pubTimer = null, booted = false;
async function getArtifact() { if (artifactNS !== undefined) return artifactNS; try { artifactNS = window.claude && window.claude.use ? await window.claude.use("artifact") : null; } catch { artifactNS = null; } return artifactNS; }
function setSync(state, msg) { $("syncDot").className = "dot " + (state === "err" ? "err" : syncOn ? "on" : ""); $("syncMsg").textContent = msg || ""; $("syncBtn").classList.toggle("on", syncOn); $("syncBtn").setAttribute("aria-pressed", String(syncOn)); $("syncBtn").textContent = syncOn ? "학생 화면 연동 켜짐" : "학생 화면 연동"; }
function liveEntry() {
  const p = phases[pi];
  return { cls: CLASSES[cls], day: S.day, days: S.days, pi, total: phases.length, phase: p[0], dur: p[1], running, endsAt: running ? Date.now() + remain * 1000 : null, remain, news: p[4] === "news" ? newsItems() : null, updated: Date.now() };
}
function schedulePublish() { if (!booted || !syncOn) return; clearTimeout(pubTimer); setSync("wait", "곧 전송…"); pubTimer = setTimeout(doPublish, 1200); }
async function doPublish() {
  const a = await getArtifact();
  if (!a) { setSync("err", "이 화면에서는 연동할 수 없습니다 (작성자 계정으로 열어 주세요)"); return; }
  const live = JSON.parse(JSON.stringify(LIVE)), now = Date.now();
  live.classes = live.classes || {};
  Object.keys(live.classes).forEach(k => { const e = live.classes[k]; if (now - (e.updated || 0) > 12 * 3600e3 || (e.cls === CLASSES[cls] && k !== S.code)) delete live.classes[k]; });
  live.classes[S.code] = liveEntry(); live.rev = (live.rev || 0) + 1;
  saveRun();
  try { setSync("wait", "전송 중…"); await a.publish(buildDoc(live)); setSync("on", `전송됨 ${hhmm(now)}`); }
  catch (e) { const code = (e && e.code) || ""; setSync("err", code === "conflict" ? "다른 저장과 겹쳤습니다. 단계를 다시 넘겨 주세요" : code === "not_granted" || code === "not_writer" ? "편집 권한이 없어 전송할 수 없습니다" : `전송 실패 ${code || (e && e.message) || ""}`); }
}
$("syncBtn").onclick = () => { syncOn = !syncOn; store.set("ssi-sync", syncOn); setSync(syncOn ? "on" : "", syncOn ? "켜짐" : "꺼짐"); if (syncOn) { booted = true; schedulePublish(); } };
const runKey = () => `ssi-run-${cls}`;
function saveRun() { if (!S) return; store.set(runKey(), { code: S.code, day: S.day, pi, step, running, endsAt: running ? Date.now() + remain * 1000 : null, remain }); }
function restoreRun() {
  const r = store.get(runKey()); if (!r || r.code !== S.code || r.day !== S.day || r.pi >= phases.length) return;
  pi = r.pi; setPhase(false); if (r.step) step = r.step;
  remain = r.running && r.endsAt ? Math.max(0, Math.round((r.endsAt - Date.now()) / 1000)) : (r.remain ?? remain);
  drawClock(); if (r.running && remain > 0) startTick();
}

// ---------------- timer, narration, sound ----------------
let soundOn = false, actx = null;
function chime(n = 1) {
  if (!soundOn) return;
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); for (let i = 0; i < n; i++) { const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * 0.22; o.frequency.value = i % 2 ? 660 : 880; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.4); } } catch {}
}
$("sound").onclick = () => { soundOn = !soundOn; $("sound").textContent = soundOn ? "효과음 끔" : "효과음"; $("sound").setAttribute("aria-pressed", String(soundOn)); chime(1); };
let phases = [], pi = 0, remain = 0, running = false, tick = null;
function buildPhases() {
  const d = S.day, plaza = isPlazaDay(d, S.days);
  phases = [d === 1
    ? ["밤", 60, `"DAY 1, 밤이 되었습니다. 모두 고개를 숙이고 휴대폰으로 오늘의 카드를 확인하세요. 오늘은 연습 판입니다."`, "", "setup"]
    : ["밤", 120, `"DAY ${d}, 밤이 되었습니다. 모두 고개를 숙이고 카드를 확인하세요. … 마피아는 고개를 드세요. 입을 막을 사람을 가리키세요. … 마피아는 고개를 숙이세요. 심판은 고개를 드세요. 보호할 사람을 가리키세요. … 심판은 고개를 숙이세요."`, "", "night"]];
  phases.push(["아침 뉴스", 60, d === 1 ? `"아침이 밝았습니다. 모두 고개를 드세요. 평화로운 마을의 첫날입니다."` : `"아침이 밝았습니다. 모두 고개를 드세요. DAY ${d} 아침 뉴스입니다."`, "", "news"]);
  phases.push(
    ["진영 회의", plaza ? 60 : 120, `"같은 구역, 같은 편끼리 모여 작전 회의를 하세요. 근거와 발언 순서를 정하세요."`, "", "debate"],
    ["입론", 180, `"찬성부터 입론을 시작하세요. 한 사람당 30초, 발언 틀을 사용하세요."`, "", "debate"],
    ["검색", 120, `"검색 시간입니다. 확인할 상대 근거를 먼저 말하고 휴대폰을 드세요."`, "", "debate"],
    ["반론·질문", plaza ? 120 : 180, `"휴대폰을 내려놓으세요. 질문 카드를 사용해 반론하세요. 심판은 출처 화면을 요구할 수 있습니다."`, "", "debate"],
    ["심판 판정", 60, `"심판은 판정 결과와 오늘의 MVP를 발표하세요."`, "", "debate"]);
  if (plaza) phases.push(["광장 대표토론", 300, `"광장이 열렸습니다. 찬성 대표 두 명, 반대 대표 두 명은 앞으로 나오세요. 한 사람당 30초 입론 후 자유 반론입니다."`, "", "plaza"]);
  if (d > 1) phases.push(["광장 재판", 180, `"각 구역은 가장 의심스러운 사람 한 명을 지명하세요. 지명된 사람은 15초 동안 해명하세요. … 셋, 둘, 하나 하면 마피아라고 생각하는 사람을 가리키세요!"`, "", "trial"]);
  phases.push(["정리", plaza ? 180 : 60, `"오늘의 결과를 발표합니다."`, "", "wrap"]);
  pi = 0; setPhase(false);
}
function fmt(s) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
function setPhase(sound = true) {
  clearInterval(tick); running = false; $("tStart").textContent = "시작";
  remain = phases[pi][1];
  $("barPhase").textContent = `${phases[pi][0]} · ${pi + 1}/${phases.length}`; $("barNarr").textContent = phases[pi][2];
  $("tbar").classList.toggle("night", phases[pi][0] === "밤");
  drawClock(); if (sound) chime(1);
  saveRun(); schedulePublish();
}
function drawClock() { $("clock").textContent = fmt(remain); $("clock").classList.toggle("low", remain <= 10); }
function startTick() {
  clearInterval(tick); running = true; $("tStart").textContent = "일시정지";
  tick = setInterval(() => { remain = Math.max(0, remain - 1); drawClock(); if (!remain) { clearInterval(tick); running = false; $("tStart").textContent = "시작"; chime(3); saveRun(); } }, 1000);
}
$("tStart").onclick = () => {
  if (running) { clearInterval(tick); running = false; $("tStart").textContent = "계속"; saveRun(); schedulePublish(); return; }
  startTick(); saveRun(); schedulePublish();
};
function phaseMoved() { const target = phases[pi][4]; if (target && target !== step && stepAvail(target)) { step = target; renderBar(); } renderStep(); }
$("tNext").onclick = () => { if (pi < phases.length - 1) { pi++; setPhase(); phaseMoved(); } };
$("tPrev").onclick = () => { if (pi > 0) { pi--; setPhase(); phaseMoved(); } };

// ---------------- boot ----------------
load(); buildPhases(); restoreRun(); renderAllT(); renderScene(); newQuiz(); renderSamples(); route();
setSync(syncOn ? "on" : "", syncOn ? (LIVE.classes && LIVE.classes[S.code] ? `마지막 전송 ${hhmm(LIVE.classes[S.code].updated)}` : "켜짐") : "");
{ const cs = ss.get("ssi-card"); if (cs && cs.shown && parseCode($("code").value)) { const sameDay = cs.day === +$("day").value; renderLive(); showCard(sameDay && cs.open); } }
renderLive();
booted = true;
})();
</script>
