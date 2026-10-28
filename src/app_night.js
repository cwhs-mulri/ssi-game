
// ---------------- student: live phase subscription ----------------
let lastPhaseKey = null, NETLIVE = {}, liveCode = null, liveSub = null, liveErr = "";
function watchLive(code) {
  if (code === liveCode) return;
  liveCode = code; lastPhaseKey = null; if (liveSub) { liveSub(); liveSub = null; } NETLIVE = {}; liveErr = "";
  watchBoard(null);
  if (!code) return;
  NET.ensureAnon().then(() => {
    if (liveCode !== code) return;
    liveSub = NET.watch(roomPath(code) + "/live", (v, err) => {
      liveErr = err ? "서버에 연결하지 못했습니다. 선생님께 알려 주세요." : "";
      const pk = v ? `${v.day}|${v.pi}|${v.phase}` : null;
      if (lastPhaseKey !== null && pk && pk !== lastPhaseKey && NET.now() - (v.updated || 0) < 60e3) showSplash(v);
      lastPhaseKey = pk;
      NETLIVE[code] = v; renderLive(); renderNight(); renderStuStage(v);
    });
  }).catch(e => { liveErr = "접속 준비에 실패했습니다 (" + ((e && e.code) || "network") + "). 새로고침해 보세요."; renderLive(); });
}

// ---------------- student: night actions on the phone ----------------
let boardSub = null, boardKey = null, BOARD = null;
function watchBoard(key) {
  if (key === boardKey) return;
  boardKey = key; if (boardSub) { boardSub(); boardSub = null; } BOARD = null;
  if (!key) return;
  const [code, day] = key.split("|");
  boardSub = NET.watch(`${roomPath(code)}/board/d${day}`, v => { BOARD = v; renderNight(); });
}
const memoKey = (code, day, seat) => `ssi-memo-${code}-${day}-${seat}`;
const pickKey = (code, day, seat) => `ssi-pick-${code}-${day}-${seat}`;
let nightMsg = "";
function nightContext() {
  const c = parseCode($("code").value), last = store.get("ssi-last4");
  if (!c || !last || last.code !== c.code) return null;
  const e = liveFor(c.code);
  if (!e || e.phase !== "밤" || e.day < 2) return null;
  const seat = +$("seat").value, R = roles(c), out = e.out || [];
  const kind = R.mafia.includes(seat) ? "m" : R.judges.includes(seat) ? "j" : "c";
  return { c, e, seat, R, out, kind, day: e.day };
}
function renderNight() {
  const box = $("nightBox"), x = nightContext();
  if (!x) { box.hidden = true; box.innerHTML = ""; watchBoard(null); return; }
  const { c, seat, R, out, kind, day } = x;
  if (kind !== "c") watchBoard(`${c.code}|${day}`); else watchBoard(null);
  box.hidden = false;
  if (out.includes(seat)) { box.innerHTML = `<div class="nightp"><h3>밤 행동</h3><p>체포된 사람은 밤에 할 일이 없습니다. 고개를 숙이고 기다리세요.</p></div>`; return; }
  const alive = [...Array(c.n)].map((_, i) => i + 1).filter(s => !out.includes(s) && s !== seat);
  const cand = kind === "m" ? alive.filter(s => !R.mafia.includes(s)) : alive;
  const mine = kind === "c" ? store.get(memoKey(c.code, day, seat)) : ss.get(pickKey(c.code, day, seat));
  const b = BOARD && BOARD[kind] || {}, cnt = s => (b["s" + s] || 0);
  const title = { m: "마피아 · 입막음할 사람 고르기", j: "심판 · 보호할 사람 고르기", c: "시민 · 의심 메모" }[kind];
  const help = {
    m: `동료 마피아와 함께 고릅니다. 표가 갈리면 가장 많이 받은 사람이 입막음됩니다(동점이면 나중에 고른 표). ${BOARD ? `마피아 ${BOARD.mN || 0}/${BOARD.mT || 0}명 선택 완료.` : ""}`,
    j: `다른 심판들과 함께 고릅니다. 마피아가 고른 사람과 같으면 입막음을 막아냅니다. ${BOARD ? `심판 ${BOARD.jN || 0}/${BOARD.jT || 0}명 선택 완료.` : ""}`,
    c: "시민은 밤에 할 일이 없습니다. 다른 사람이 눈치채지 못하게, 의심 가는 사람을 하나 눌러 메모해 두세요. 이 메모는 나만 봅니다."
  }[kind];
  box.innerHTML = `<div class="nightp"><h3>DAY ${day} 밤 · ${title}</h3><p>${esc(help)}</p>
    <div class="seatgrid">${cand.map(s => `<button type="button" class="seatb ${+mine === s ? "on" : ""}" data-s="${s}">${s}<small>${kind !== "c" && cnt(s) ? "●".repeat(cnt(s)) : "&nbsp;"}</small></button>`).join("")}</div>
    <p class="nmsg">${esc(nightMsg || (mine ? (kind === "c" ? `메모: ${mine}번` : `내 선택: ${mine}번 · 선생님께 전송됨`) : "아직 고르지 않았습니다."))}</p></div>`;
  box.querySelectorAll(".seatb").forEach(btn => btn.onclick = async () => {
    const s = +btn.dataset.s;
    if (kind === "c") { store.set(memoKey(c.code, day, seat), s); nightMsg = ""; renderNight(); return; }
    nightMsg = `${s}번 전송 중…`; renderNight();
    try {
      await NET.ensureAnon();
      await NET.put(`${roomPath(c.code)}/votes/d${day}/s${seat}`, { uid: NET.user.uid, k: kind, target: s, t: NET.stamp() });
      ss.set(pickKey(c.code, day, seat), s); nightMsg = "";
    } catch (e) { nightMsg = (e && /PERMISSION/i.test(e.code || e.message || "")) ? "이 출석번호는 다른 휴대폰에서 이미 선택했습니다. 선생님께 알려 주세요." : "전송 실패. 다시 눌러 주세요."; }
    renderNight();
  });
}

// ---------------- teacher: live push, vote tally ----------------
let votesSub = null, votesKey = null, VOTES = {}, lastBoard = "";
function teacherWatch() {
  const key = NET.isTeacher() && S ? `${S.code}|${S.day}` : null;
  if (key === votesKey) return;
  votesKey = key; if (votesSub) { votesSub(); votesSub = null; } VOTES = {}; lastBoard = "";
  if (!key) return;
  votesSub = NET.watch(`${roomPath(S.code)}/votes/d${S.day}`, v => { VOTES = v || {}; pushBoard(); if (step === "night") renderTally(); });
}
function tally() {
  const c = C(), R = roles(c), d = S.day, out = caughtBefore(d);
  const one = (seats, k) => {
    const vs = seats.map(s => VOTES["s" + s]).filter(v => v && v.k === k && v.target);
    const counts = {}, last = {};
    vs.forEach(v => { counts[v.target] = (counts[v.target] || 0) + 1; last[v.target] = Math.max(last[v.target] || 0, +v.t || 0); });
    const best = Object.keys(counts).map(Number).sort((a, b) => counts[b] - counts[a] || last[b] - last[a])[0] || null;
    return { counts, n: vs.length, total: seats.length, best };
  };
  return { m: one(R.mafia.filter(s => !out.includes(s)), "m"), j: one(R.judges.filter(s => !out.includes(s)), "j") };
}
function pushBoard() {
  if (!NET.isTeacher() || S.day < 2) return;
  const t = tally(), obj = k => Object.fromEntries(Object.entries(t[k].counts).map(([s, v]) => ["s" + s, v]));
  const board = { m: obj("m"), j: obj("j"), mN: t.m.n, mT: t.m.total, jN: t.j.n, jT: t.j.total };
  const sig = JSON.stringify(board); if (sig === lastBoard) return; lastBoard = sig;
  NET.put(`${roomPath(S.code)}/board/d${S.day}`, board).catch(() => {});
}
function renderTally() {
  const el = $("tally"); if (!el) return;
  if (S.day < 2) { el.innerHTML = `<span class="muted">DAY 1은 연습 판이라 휴대폰 밤 행동이 없습니다.</span>`; return; }
  if (!NET.isTeacher()) { el.innerHTML = `<span class="muted">선생님 로그인 후 학생들의 휴대폰 선택이 여기에 실시간으로 모입니다.</span>`; return; }
  const t = tally(), line = (x, name) => `<div><b>${name} ${x.n}/${x.total}명 선택</b> ${Object.keys(x.counts).length ? Object.entries(x.counts).sort((a, b) => b[1] - a[1]).map(([s, v]) => `<span class="chip">${s}번 ${"●".repeat(v)}</span>`).join(" ") : `<span class="muted">아직 없음</span>`}${x.best ? ` → <b>${x.best}번</b>` : ""}</div>`;
  el.innerHTML = `<div class="tallyin"><div class="label" style="margin:0">휴대폰 실시간 집계</div>${line(t.m, "마피아")}${line(t.j, "심판")}<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="sm gold" id="tallyApply" ${t.m.best || t.j.best ? "" : "disabled"}>집계 결과 적용</button><button class="sm" id="tallyReset">휴대폰 선택 초기화</button></div><span class="muted" style="font-size:.82rem">밤 단계에서 ▶로 넘어가면 저장 안 된 집계가 자동 적용됩니다.</span></div>`;
  const b = $("tallyApply"); if (b) b.onclick = () => applyTally(true);
  $("tallyReset").onclick = () => { if (confirmReset()) NET.put(`${roomPath(S.code)}/votes/d${S.day}`, null).catch(() => {}); };
}
function applyTally(force) {
  if (S.day < 2 || !NET.isTeacher()) return;
  if (!force && S.night[S.day] && (S.night[S.day].target || S.night[S.day].protect)) return;
  const t = tally(); if (!t.m.best && !t.j.best) return;
  snap(); S.night[S.day] = { target: t.m.best, protect: t.j.best }; save();
  if (step === "night") renderStep(); renderBar();
}
function pushLive() {
  if (!NET.isTeacher()) { renderAuth(); return; }
  setSync("wait", "전송 중…");
  NET.put(`${roomPath(S.code)}/live`, liveEntry()).then(() => setSync("on", `전송됨 ${hhmm(Date.now())}`)).catch(e => setSync("err", `전송 실패 ${(e && e.code) || ""}`));
}
function renderAuth() {
  const u = NET.user;
  if (NET.mode === "init") { setSync("wait", "서버 연결 중…"); $("syncBtn").disabled = true; return; }
  if (NET.mode === "local") { setSync("on", NET.hasCfg ? "로컬 모드" : "Firebase 설정 전 · 이 기기만"); $("syncBtn").textContent = "로컬 모드"; $("syncBtn").disabled = true; return; }
  $("syncBtn").disabled = false;
  if (NET.isTeacher()) { setSync("on", u.email); $("syncBtn").textContent = "로그아웃"; }
  else if (u && !u.isAnonymous) { setSync("err", `${u.email}은 선생님 계정으로 등록되지 않았습니다`); $("syncBtn").textContent = "다른 계정으로 로그인"; }
  else { setSync("", "학생 화면 연동은 로그인 후 켜집니다"); $("syncBtn").textContent = "선생님 로그인"; }
}
function setSync(state, msg) { $("syncDot").className = "dot " + (state === "err" ? "err" : state === "on" || state === "wait" ? "on" : ""); $("syncMsg").textContent = msg || ""; }
let resetArm = 0;
function confirmReset() { const b = $("tallyReset"); if (Date.now() - resetArm < 4000) { resetArm = 0; return true; } resetArm = Date.now(); if (b) b.textContent = "한 번 더 누르면 초기화"; setTimeout(() => { if ($("tallyReset")) $("tallyReset").textContent = "휴대폰 선택 초기화"; }, 4000); return false; }

// ---------------- student: full-screen splash when the teacher moves to a new phase ----------------
const SPLASH = {
  "밤": ["night", "밤이 되었습니다", "고개를 숙이고 휴대폰만 보세요"],
  "아침 뉴스": ["dawn", "아침이 밝았습니다", "고개를 들고 아침 뉴스를 들으세요"],
  "진영 회의": ["meet", "작전 회의", "같은 편끼리 모여 근거와 발언 순서를 정하세요"],
  "입론": ["talk", "입론 시작", "한 사람당 30초, 발언 틀을 사용하세요"],
  "검색": ["search", "검색 시간", "확인할 근거를 먼저 말하고 휴대폰을 드세요"],
  "반론·질문": ["talk", "반론과 질문", "휴대폰을 내려놓고 질문 카드를 쓰세요"],
  "심판 판정": ["judge", "판정의 시간", "심판의 판정과 오늘의 MVP를 기다리세요"],
  "광장 대표토론": ["plaza", "광장이 열렸습니다", "구역 대표들이 광장에 섭니다"],
  "광장 재판": ["trial", "광장 재판", "가장 의심스러운 사람은 누구일까요?"],
  "정리": ["wrap", "오늘의 결과", "점수와 소식을 확인하세요"]
};
const SP_ART = {
  night: `<svg viewBox="0 0 120 120" aria-hidden="true"><defs><mask id="spm"><rect width="120" height="120" fill="#fff"/><circle cx="78" cy="48" r="30" fill="#000"/></mask></defs><circle cx="60" cy="60" r="34" fill="#E9EEFF" mask="url(#spm)"/></svg>`,
  dawn: `<svg viewBox="0 0 160 110" aria-hidden="true"><defs><clipPath id="spc"><rect width="160" height="79"/></clipPath></defs><g class="sun" clip-path="url(#spc)"><circle cx="80" cy="78" r="30" fill="#F4C55B"/>${[...Array(9)].map((_, i) => { const a = Math.PI * (i / 8); return `<line x1="${80 - Math.cos(a) * 40}" y1="${78 - Math.sin(a) * 40}" x2="${80 - Math.cos(a) * 54}" y2="${78 - Math.sin(a) * 54}" stroke="#F4C55B" stroke-width="5" stroke-linecap="round"/>`; }).join("")}</g><line x1="10" y1="78" x2="150" y2="78" stroke="#F4C55B" stroke-width="3" stroke-linecap="round"/></svg>`,
  meet: `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="40" cy="48" r="14" fill="#63A9E6"/><circle cx="80" cy="48" r="14" fill="#63A9E6"/><circle cx="60" cy="40" r="14" fill="#EEE8DC"/><rect x="22" y="66" width="76" height="30" rx="15" fill="#2A3A55"/></svg>`,
  talk: `<svg viewBox="0 0 120 120" aria-hidden="true"><rect x="14" y="26" width="64" height="44" rx="12" fill="#63A9E6"/><path d="M30 70 l0 16 l16 -16z" fill="#63A9E6"/><rect x="48" y="50" width="58" height="40" rx="12" fill="#EE9255"/><path d="M92 90 l0 14 l-14 -14z" fill="#EE9255"/></svg>`,
  search: `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="52" cy="52" r="26" fill="none" stroke="#4CC08F" stroke-width="10"/><line x1="72" y1="72" x2="98" y2="98" stroke="#4CC08F" stroke-width="12" stroke-linecap="round"/></svg>`,
  judge: `<svg viewBox="0 0 120 120" aria-hidden="true"><rect x="30" y="30" width="56" height="22" rx="6" fill="#4CC08F" transform="rotate(-30 58 41)"/><rect x="54" y="52" width="10" height="48" rx="5" fill="#4CC08F" transform="rotate(-30 59 76)"/><rect x="20" y="96" width="60" height="10" rx="5" fill="#EEE8DC"/></svg>`,
  plaza: `<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M20 50 L60 22 L100 50z" fill="#E5B550"/><rect x="28" y="54" width="10" height="40" fill="#EEE8DC"/><rect x="55" y="54" width="10" height="40" fill="#EEE8DC"/><rect x="82" y="54" width="10" height="40" fill="#EEE8DC"/><rect x="18" y="96" width="84" height="10" rx="3" fill="#E5B550"/></svg>`,
  trial: `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="44" r="20" fill="#3A3D52"/><path d="M28 100 q32 -44 64 0z" fill="#3A3D52"/><circle cx="53" cy="42" r="3" fill="#E0533F"/><circle cx="67" cy="42" r="3" fill="#E0533F"/><text x="60" y="30" text-anchor="middle" font-size="34" font-weight="800" fill="#E0533F">?</text></svg>`,
  wrap: `<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M60 14 l12 26 28 3 -21 19 6 28 -25 -14 -25 14 6 -28 -21 -19 28 -3z" fill="#E5B550"/></svg>`
};
let splashTimer = null;
function showSplash(e) {
  if ($("viewStudent").hidden) return;
  const [kind, title, sub] = SPLASH[e.phase] || ["wrap", e.phase, "선생님 안내를 따르세요"];
  const el = $("splash");
  el.className = `splash sp-${kind}`;
  el.innerHTML = `<div class="sp-in"><div class="sp-art">${SP_ART[kind] || ""}</div><div class="sp-k">DAY ${e.day}${e.day === 1 ? " · 연습" : ""}</div><h2>${esc(title)}</h2><p>${esc(sub)}</p><span class="sp-tap">화면을 누르면 닫힙니다</span></div>`;
  el.hidden = false; void el.offsetWidth; el.classList.add("show");
  try { if (navigator.vibrate) navigator.vibrate(kind === "night" ? [80, 120, 80] : 120); } catch {}
  clearTimeout(splashTimer); splashTimer = setTimeout(hideSplash, kind === "night" || kind === "dawn" ? 3600 : 2600);
}
function hideSplash() { const el = $("splash"); if (el.hidden) return; el.classList.remove("show"); el.classList.add("hide"); setTimeout(() => { el.hidden = true; el.classList.remove("hide"); }, 450); }
$("splash").onclick = hideSplash;

// ---------------- teacher fullscreen news -> student phones ----------------
var stageLive = null;
function stageClosed() { if (stageLive) { stageLive = null; schedulePublish(); } }
let stuStageAt = null, stuStageDismissed = null;
function renderStuStage(v) {
  if ($("viewStudent").hidden) return;
  const st = v && v.stage;
  if (st && (st.k === "news" || st.k === "frame")) {
    if (stuStageDismissed === st.at || stuStageAt === st.at) return;
    stuStageAt = st.at; hideSplash();
    $("stageInner").innerHTML = st.k === "frame" ? FRAME_STAGE() : `<div class="kicker">DAY ${v.day} · MORNING NEWS</div><h2>아침이 밝았습니다</h2><div class="items">${(st.items || []).map(([k, x]) => `<div class="item"><small>${esc(k)}</small>${esc(x)}</div>`).join("")}</div><button class="primary" id="stageClose" style="justify-self:end">닫기</button>`;
    $("stage").hidden = false;
    $("stageClose").onclick = () => { stuStageDismissed = st.at; stuStageAt = null; $("stage").hidden = true; };
  } else if (stuStageAt !== null) { stuStageAt = null; $("stage").hidden = true; }
}
