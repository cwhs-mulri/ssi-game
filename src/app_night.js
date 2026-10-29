
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
      NETLIVE[code] = v; renderLive(); renderNight(); renderStuStage(v); checkAlert(code, v); renderBoard(v);
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
  el.innerHTML = `<div class="tallyin"><div class="label" style="margin:0">휴대폰 실시간 집계</div>${line(t.m, "마피아")}${line(t.j, "심판")}<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="sm gold" id="tallyApply" ${t.m.best || t.j.best ? "" : "disabled"}>집계 결과 적용</button><button class="sm" id="tallyReset">휴대폰 선택 초기화</button></div><div class="dodoline">${dodoLine()}${dodoPickUI()}</div><span class="muted" style="font-size:.82rem">밤 단계에서 ▶로 넘어가면 저장 안 된 집계가 자동 적용됩니다.</span></div>`;
  const b = $("tallyApply"); if (b) b.onclick = () => applyTally(true);
  if ($("dodoPick")) $("dodoPick").onchange = e => setDodoPick(+e.target.value);
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
  if ($("viewStudent").hidden && $("viewBoard").hidden) return;
  const [kind, title, sub] = SPLASH[e.phase] || ["wrap", e.phase, "선생님 안내를 따르세요"];
  const el = $("splash");
  el.className = `splash sp-${kind}`;
  el.innerHTML = `<div class="sp-in"><div class="sp-art">${SP_ART[kind] || ""}</div><div class="sp-k">DAY ${e.day}${e.day === 1 ? " · 연습" : ""}</div><h2>${esc(title)}</h2><p>${esc(sub)}</p><span class="sp-tap">화면을 누르면 닫힙니다</span></div>`;
  el.hidden = false; void el.offsetWidth; el.classList.add("show"); goSlide("now", false);
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
  if ($("viewStudent").hidden && $("viewBoard").hidden) return;
  const st = v && v.stage;
  if (st && (st.k === "news" || st.k === "frame" || st.k === "tip")) {
    const sk = st.at + (st.why ? "|w" : "");
    if (stuStageDismissed === st.at || stuStageAt === sk) return;
    const fresh = stuStageAt === null || String(stuStageAt).split("|")[0] !== String(st.at);
    stuStageAt = sk; hideSplash();
    if (st.k === "tip" && fresh) { try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch {} }
    $("stageInner").innerHTML = st.k === "tip" ? `<div class="kicker tipkick">ANONYMOUS TIP · 익명 제보</div><h2>출처를 알 수 없는 제보가 들어왔습니다</h2><div class="tipbody">"${esc(st.text || "")}"</div>${st.why ? `<div class="item"><small>진위 공개</small>${esc(st.why)}</div>` : `<p class="muted" style="margin:0">이 제보, 믿어도 될까요? 출처·시기·숫자를 따져 먼저 반박하는 구역이 +2점!</p>`}<button class="primary" id="stageClose" style="justify-self:end">닫기</button>` : st.k === "frame" ? FRAME_STAGE() : `<div class="kicker">DAY ${v.day} · MORNING NEWS</div><h2>아침이 밝았습니다</h2><div class="items">${(st.items || []).map(([k, x]) => `<div class="item"><small>${esc(k)}</small>${esc(x)}</div>`).join("")}</div><button class="primary" id="stageClose" style="justify-self:end">닫기</button>`;
    $("stage").hidden = false;
    $("stageClose").onclick = () => { stuStageDismissed = st.at; stuStageAt = null; $("stage").hidden = true; };
  } else if (stuStageAt !== null) { stuStageAt = null; $("stage").hidden = true; }
}

// iOS suspends pages in the background: re-check the live state when the page comes back
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && liveCode && NETLIVE[liveCode]) { renderLive(); renderNight(); renderStuStage(NETLIVE[liveCode]); } });

// ---------------- mafia phone: surprise anonymous tip button ----------------
let tipArm = 0, tipMsg = "";
function renderTipBox() {
  const box = $("tipBox"), c = parseCode($("code").value), last = store.get("ssi-last4");
  const e = c && last && last.code === c.code ? liveFor(c.code) : null;
  const seat = +$("seat").value, R = c && roles(c);
  const ok = e && R && R.mafia.includes(seat) && !(e.out || []).includes(seat) && e.day >= 2 && e.phase !== "밤" && e.phase !== "아침 뉴스" && e.phase !== "정리";
  if (!ok) { box.hidden = true; box.innerHTML = ""; return; }
  box.hidden = false;
  const sent = ss.get(`ssi-tip-${c.code}`);
  const used = e.tipUsed;
  box.innerHTML = `<div class="tipwrap"><button type="button" class="tipbtn ${tipArm ? "arm" : ""}" id="tipBtn" ${used || sent ? "disabled" : ""}>${used ? "익명 제보 사용 완료 (시즌 1회)" : sent ? "제보 접수됨 · 곧 화면에 뜹니다" : tipArm ? "한 번 더 누르면 바로 제보!" : "기습 익명 제보하기"}</button>
    <p>${esc(tipMsg || (used ? "이번 시즌의 익명 제보는 이미 쓰였습니다." : "마피아 전용 · 시즌 1회. 누르면 그럴듯한 거짓 제보가 모든 휴대폰과 칠판 화면에 뜹니다. 들키지 않게 몰래 누르세요."))}</p></div>`;
  $("tipBtn").onclick = async () => {
    if (used || sent) return;
    if (!tipArm) { tipArm = 1; renderTipBox(); setTimeout(() => { if (tipArm) { tipArm = 0; renderTipBox(); } }, 4000); return; }
    tipArm = 0; tipMsg = "보내는 중…"; renderTipBox();
    try { await NET.ensureAnon(); await NET.put(`${roomPath(c.code)}/votes/tip/s${seat}`, { uid: NET.user.uid, k: "m", target: seat, t: NET.stamp() }); ss.set(`ssi-tip-${c.code}`, 1); tipMsg = ""; }
    catch (err) { tipMsg = "전송 실패. 다시 눌러 주세요."; }
    renderTipBox();
  };
}
// teacher: watch tip requests and pop the tip automatically
let tipSub = null, tipKey = null;
function teacherTipWatch() {
  const key = NET.isTeacher() && S ? S.code : null;
  if (key === tipKey) return;
  tipKey = key; if (tipSub) { tipSub(); tipSub = null; }
  if (!key) return;
  tipSub = NET.watch(`${roomPath(key)}/votes/tip`, v => {
    if (!v || S.code !== key || S.tip || S.day < 2 || S.ended) return;
    const R = roles(C()), out = caughtBefore(S.day);
    const req = Object.entries(v).map(([k, x]) => ({ seat: +k.slice(1), ...x })).find(x => R.mafia.includes(x.seat) && !out.includes(x.seat));
    if (!req) return;
    showTip(); chime(3);
  });
}

// ---------------- special role: 도도새 (from DAY 3, one random citizen is offered a job change) ----------------
function dodoOrder(c) { const R = roles(c); return shuffle([...Array(c.n)].map((_, i) => i + 1).filter(s => !R.mafia.includes(s) && !R.judges.includes(s)), rng(hash(`dodo|${c.key}`))); }
function dodoS() { if (!S.dodo) S.dodo = { offers: [], seat: null, day: null }; return S.dodo; }
function dodoPending() {
  if (S.day < 3 || S.ended) return null;
  const D = dodoS(); if (D.seat) return null;
  let o = D.offers.find(x => x[0] === S.day);
  if (!o) {
    D.offers.forEach(x => { if (x[2] == null) x[2] = "no"; });
    const used = D.offers.map(x => x[1]), order = dodoOrder(C());
    const seat = D.pick && order.includes(D.pick) && !used.includes(D.pick) ? D.pick : order.find(s => !used.includes(s));
    if (!seat) return null;
    o = [S.day, seat, null]; D.offers.push(o); save();
  }
  return o[2] == null ? { day: o[0], seat: o[1] } : null;
}
const dodoWon = (st = S) => !!(st.dodo && st.dodo.seat && st.trials.some(t => t[1] === st.dodo.seat && t[0] >= st.dodo.day));
function dodoPickUI() {
  const D = dodoS(); if (D.seat || S.ended) return "";
  const used = D.offers.filter(x => x[2] != null).map(x => x[1]), opts = dodoOrder(C()).filter(s => !used.includes(s)).sort((a, b) => a - b);
  const pend = D.offers.find(x => x[2] == null), cur = pend ? pend[1] : D.pick;
  return ` <label class="f dodopick" for="dodoPick">${pend ? "제안 대상 바꾸기" : "다음 제안 대상"}<select id="dodoPick"><option value="">무작위 (기본)</option>${opts.map(s => `<option value="${s}" ${(pend ? D.pick === s : cur === s) ? "selected" : ""}>${s}번</option>`).join("")}</select></label>`;
}
function setDodoPick(v) {
  const D = dodoS(); snap(); D.pick = v || null;
  const pend = D.offers.find(x => x[2] == null);
  if (pend) { const used = D.offers.filter(x => x !== pend).map(x => x[1]); pend[1] = D.pick && !used.includes(D.pick) ? D.pick : dodoOrder(C()).find(s => !used.includes(s)); }
  save(); renderTally(); schedulePublish();
}
function dodoLine() {
  const D = S.dodo; if (S.day < 3 && !(D && D.offers.length)) return `<span class="muted">도도새 제안은 DAY 3 밤부터 휴대폰으로 갑니다.</span>`;
  if (!D || !D.offers.length) return `<span class="muted">도도새 제안 준비 중 (진행을 시작하면 전송)</span>`;
  if (D.seat) return `<b>도도새: ${D.seat}번</b> (DAY ${D.day} 수락)${dodoWon() ? ` · <span class="hit">재판대에 올라 승리!</span>` : ""}`;
  const o = D.offers[D.offers.length - 1];
  return `<b>도도새 제안</b> DAY ${o[0]} → ${o[1]}번 · ${o[2] == null ? "응답 대기" : o[2] === "yes" ? "수락" : "거절 (다음 날 다른 사람에게)"}`;
}
// teacher: watch answers
let dodoSub = null, dodoKey = null;
function teacherDodoWatch() {
  const key = NET.isTeacher() && S ? S.code : null;
  if (key === dodoKey) return;
  dodoKey = key; if (dodoSub) { dodoSub(); dodoSub = null; }
  if (!key) return;
  dodoSub = NET.watch(`${roomPath(key)}/votes/dodo`, v => {
    if (!v || S.code !== key || !S.dodo) return;
    const o = S.dodo.offers.find(x => x[2] == null); if (!o) return;
    const a = v["s" + o[1]]; if (!a || a.target !== 1 && a.target !== 2) return;
    snap(); o[2] = a.target === 1 ? "yes" : "no";
    if (o[2] === "yes") { S.dodo.seat = o[1]; S.dodo.day = o[0]; }
    save(); chime(1); if (step === "night") renderTally(); schedulePublish();
  });
}
// student: night popup + card
const dodoAnsKey = (code, day, seat) => `ssi-dodo-ans-${code}-${day}-${seat}`;
const dodoMineKey = (code, seat) => `ssi-dodo-${code}-${seat}`;
let dodoShown = null;
function renderDodo() {
  const c = parseCode($("code").value), last = store.get("ssi-last4");
  const e = c && last && last.code === c.code ? liveFor(c.code) : null, seat = +$("seat").value;
  const o = e && e.dodo;
  const want = o && o.seat === seat && o.day === e.day && e.phase === "밤" && !store.get(dodoAnsKey(c.code, o.day, seat));
  if (!want) { if (dodoShown && dodoShown !== "answered") { dodoShown = null; $("stage").hidden = true; } return; }
  const k = `${c.code}|${o.day}|${seat}`; if (dodoShown === k) return; dodoShown = k;
  hideSplash();
  $("stageInner").innerHTML = `<div class="kicker dodokick">NEW JOB OFFER · 비밀 알림</div>
    <div class="dodoart">${DODO_SVG}</div>
    <h2>직업을 변경하시겠습니까?</h2>
    <div class="tipbody dodobody"><b>도도새</b>가 될 수 있습니다. 도도새는 마피아도 시민도 아닌 특수 직업입니다.<br><br>
    <b>승리 조건</b>: 광장 재판에서 투표 1위로 <b>재판대에 오르면</b> 도도새 승리!<br>토론은 지금 입장 그대로 하되, 살짝 수상하게 행동해 의심을 받으세요. 너무 티 나면 아무도 뽑지 않습니다.</div>
    <p class="muted" style="margin:0">이 알림은 나에게만 보입니다. 한 번 고르면 바꿀 수 없어요.</p>
    <div class="tbtns" style="justify-content:stretch;display:grid;grid-template-columns:1fr 1fr;gap:10px"><button id="dodoNo">지금 직업 유지</button><button class="primary" id="dodoYes">도도새로 변경</button></div>`;
  $("stage").hidden = false;
  try { if (navigator.vibrate) navigator.vibrate([60, 60, 60, 60, 160]); } catch {}
  const answer = async yes => {
    $("dodoYes").disabled = $("dodoNo").disabled = true;
    try {
      await NET.ensureAnon();
      await NET.put(`${roomPath(c.code)}/votes/dodo/s${seat}`, { uid: NET.user.uid, k: "m", target: yes ? 1 : 2, t: NET.stamp() });
      store.set(dodoAnsKey(c.code, o.day, seat), yes ? 1 : 2); dodoShown = "answered";
      if (yes) store.set(dodoMineKey(c.code, seat), o.day);
      $("stageInner").innerHTML = yes ? `<div class="kicker dodokick">JOB CHANGED</div><div class="dodoart">${DODO_SVG}</div><h2>이제 당신은 도도새입니다</h2><p class="muted" style="margin:0">카드가 도도새 카드로 바뀌었습니다. 아무에게도 말하지 마세요.</p><button class="primary" id="stageClose" style="justify-self:end">확인</button>` : `<h2>지금 직업을 유지합니다</h2><button class="primary" id="stageClose" style="justify-self:end">확인</button>`;
      $("stageClose").onclick = () => { $("stage").hidden = true; dodoShown = null; if ($("case")) showCard(false); };
    } catch (err) { $("dodoYes").disabled = $("dodoNo").disabled = false; }
  };
  $("dodoYes").onclick = () => answer(true); $("dodoNo").onclick = () => answer(false);
}
const DODO_SVG = `<svg viewBox="0 0 120 110" aria-hidden="true"><ellipse cx="58" cy="70" rx="34" ry="28" fill="#7FA9B8"/><circle cx="82" cy="40" r="17" fill="#8FB9C6"/><path d="M95 38 q22 4 18 18 q-6 -8 -18 -6z" fill="#E5B550"/><circle cx="86" cy="36" r="3.5" fill="#13141B"/><path d="M30 60 q-14 -4 -18 8 q10 -2 18 2z" fill="#EEE8DC"/><rect x="48" y="94" width="5" height="12" rx="2" fill="#E5B550"/><rect x="64" y="94" width="5" height="12" rx="2" fill="#E5B550"/></svg>`;
function dodoCard(c, seat, day, sealed) {
  const since = store.get(dodoMineKey(c.code, seat));
  if (!since || day < since) return null;
  let h = cardHTML(c, seat, day, sealed, true);
  h = h.replace(/<span class="stamp citizen">시민<\/span>/, '<span class="stamp dodo">도도새</span>');
  h = h.replace(/<div class="evidence">/, `<div class="mission-box dodo-box">비밀 임무: 광장 재판에서 투표 1위로 재판대에 오르세요. 그러면 도도새 승리! 토론은 아래 근거로 평소처럼 하되, 살짝 수상하게.</div><div class="evidence">`);
  return h;
}

// ---------------- judge phone: debate checklist (district) and plaza checklist ----------------
const DEBATE_PH = ["진영 회의", "입론", "검색", "반론·질문", "심판 판정"];
const CHECKS = ["근거를 말했다", "출처를 댔다", "상대 질문에 답했다"];
const jKey = (code, day, kind, seat) => `ssi-judge-${code}-${day}-${kind}-${seat}`;
let judgeMsg = "";
function renderJudge() {
  const box = $("judgeBox"), c = parseCode($("code").value), last = store.get("ssi-last4");
  const e = c && last && last.code === c.code ? liveFor(c.code) : null, seat = +$("seat").value;
  const R = c && roles(c), di = R ? R.judges.indexOf(seat) : -1;
  const kind = e && di >= 0 ? (DEBATE_PH.includes(e.phase) ? "d" : e.phase === "광장 대표토론" ? "p" : null) : null;
  if (!kind) { box.hidden = true; box.innerHTML = ""; return; }
  box.hidden = false;
  const k = jKey(c.code, e.day, kind, seat), st = store.get(k) || { pro: [0, 0, 0], con: [0, 0, 0], lies: 0, mvp: null, win: "", sent: 0 };
  const save2 = () => store.set(k, st);
  const sum = a => a.reduce((x, y) => x + y, 0), P = sum(st.pro), Q = sum(st.con);
  const lead = P > Q ? "찬성 우세" : Q > P ? "반대 우세" : "동점";
  const side = (name, key, cls) => `<div class="jside ${cls}"><h4>${name} ${kind === "p" ? "대표" : "진영"} <span>${sum(st[key])}/3</span></h4>${CHECKS.map((t, i) => `<button type="button" class="jchk ${st[key][i] ? "on" : ""}" data-s="${key}" data-i="${i}"><span class="bx">${st[key][i] ? "✓" : ""}</span>${t}</button>`).join("")}</div>`;
  let extra = "";
  if (kind === "d") {
    const debaters = R.D[di].filter(x => x !== seat);
    extra = `<div class="jrow"><span>거짓 근거 적발</span><div class="jstep"><button type="button" data-l="-1">−</button><b>${st.lies}</b><button type="button" data-l="1">+</button></div></div>
      <div class="jrow col"><span>오늘의 MVP</span><div class="jmvp">${debaters.map(x => `<button type="button" class="${st.mvp === x ? "on" : ""}" data-m="${x}">${x}</button>`).join("")}</div></div>`;
  } else {
    extra = `<div class="jrow col"><span>내 판정</span><div class="jwin">${[["pro", "찬성 승리"], ["con", "반대 승리"], ["draw", "무승부"]].map(([v, t]) => `<button type="button" class="${st.win === v ? "on" : ""}" data-w="${v}">${t}</button>`).join("")}</div></div>`;
  }
  box.innerHTML = `<div class="judgep"><h3>${kind === "d" ? `${di + 1}구역 심판 체크리스트` : "광장 대표토론 심판 체크리스트"}</h3>
    <p>${kind === "d" ? "토론을 들으며 해당하는 항목을 누르세요. 거짓이 적발된 진영은 1개를 빼서 판정합니다." : "대표들의 토론을 듣고 체크한 뒤, 내 판정을 고르세요."}</p>
    <div class="jsides">${side("찬성", "pro", "pro")}${side("반대", "con", "con")}</div>
    <div class="jlead">현재 ${P} : ${Q} · <b>${lead}</b></div>${extra}
    <button type="button" class="primary bigbtn" id="judgeSend">${st.sent ? "다시 보고하기 (수정됨)" : "선생님께 보고하기"}</button>
    <p class="nmsg">${esc(judgeMsg || (st.sent ? `보고 완료 ${hhmm(st.sent)} · 바꾸면 다시 보고하세요` : "판정 시간에 보고 버튼을 누르세요."))}</p></div>`;
  box.querySelectorAll(".jchk").forEach(b => b.onclick = () => { st[b.dataset.s][+b.dataset.i] ^= 1; save2(); judgeMsg = ""; renderJudge(); });
  box.querySelectorAll("[data-l]").forEach(b => b.onclick = () => { st.lies = Math.max(0, Math.min(3, st.lies + +b.dataset.l)); save2(); renderJudge(); });
  box.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { st.mvp = st.mvp === +b.dataset.m ? null : +b.dataset.m; save2(); renderJudge(); });
  box.querySelectorAll("[data-w]").forEach(b => b.onclick = () => { st.win = b.dataset.w; save2(); renderJudge(); });
  $("judgeSend").onclick = async () => {
    if (kind === "p" && !st.win) { judgeMsg = "내 판정(찬성 승리/반대 승리/무승부)을 먼저 고르세요."; renderJudge(); return; }
    judgeMsg = "보내는 중…"; renderJudge();
    const rep = kind === "d" ? { pro: P, con: Q, lies: st.lies, mvp: st.mvp || 0 } : { ppro: P, pcon: Q, win: st.win };
    try { await NET.ensureAnon(); await NET.put(`${roomPath(c.code)}/votes/${kind === "d" ? "j" : "p"}${e.day}/s${seat}`, Object.assign({ uid: NET.user.uid, k: "j", target: seat, t: NET.stamp() }, rep)); st.sent = Date.now(); save2(); judgeMsg = ""; }
    catch (err) { judgeMsg = "전송 실패. 다시 눌러 주세요."; }
    renderJudge();
  };
}
// teacher: receive judge reports
let jSub = null, pSub = null, jKey2 = null, PLAZA_REP = {};
function teacherJudgeWatch() {
  const key = NET.isTeacher() && S ? `${S.code}|${S.day}` : null;
  if (key === jKey2) return;
  jKey2 = key; if (jSub) { jSub(); jSub = null; } if (pSub) { pSub(); pSub = null; } PLAZA_REP = {};
  if (!key) return;
  const d = S.day, code = S.code;
  jSub = NET.watch(`${roomPath(code)}/votes/j${d}`, v => {
    if (!v || S.code !== code || S.day !== d) return;
    const R = roles(C()); let changed = false;
    R.judges.forEach((js, di) => {
      const r = v["s" + js]; if (!r) return;
      const cur = (S.judge[d] || {})[di];
      if (cur && cur.pt && cur.pt >= (+r.t || 0)) return;
      (S.judge[d] = S.judge[d] || {})[di] = { pro: Math.max(0, Math.min(3, +r.pro || 0)), con: Math.max(0, Math.min(3, +r.con || 0)), lies: Math.max(0, Math.min(3, +r.lies || 0)), mvp: +r.mvp || null, pt: +r.t || Date.now(), phone: true };
      changed = true;
    });
    if (changed) { save(); chime(1); if (step === "debate") renderStep(); renderBar(); }
  });
  pSub = NET.watch(`${roomPath(code)}/votes/p${d}`, v => { PLAZA_REP = v || {}; if (step === "plaza") renderPlazaRep(); });
}
function renderPlazaRep() {
  const el = $("plazaRep"); if (!el) return;
  const R = roles(C()), reps = R.judges.map(js => PLAZA_REP["s" + js]).filter(Boolean);
  if (!reps.length) { el.innerHTML = `<span class="muted">심판들이 휴대폰으로 보고하면 여기에 모입니다.</span>`; return; }
  const cnt = { pro: 0, con: 0, draw: 0 }; let P = 0, Q = 0;
  reps.forEach(r => { cnt[r.win] = (cnt[r.win] || 0) + 1; P += +r.ppro || 0; Q += +r.pcon || 0; });
  const best = cnt.pro > cnt.con && cnt.pro > cnt.draw ? "pro" : cnt.con > cnt.pro && cnt.con > cnt.draw ? "con" : P > Q ? "pro" : Q > P ? "con" : "draw";
  el.innerHTML = `<div class="tallyin"><div class="label" style="margin:0">심판 휴대폰 보고 ${reps.length}/${R.judges.length}명</div><div>찬성 승리 ${cnt.pro} · 반대 승리 ${cnt.con} · 무승부 ${cnt.draw} <span class="muted">(체크 합계 ${P} : ${Q})</span> → <b>${best === "draw" ? "무승부" : SIDE[best] + " 승리"}</b></div><button class="sm gold" id="plazaApply">판정에 반영</button></div>`;
  $("plazaApply").onclick = () => { $("pWin").value = best; };
}

// ---------------- student layout: swipeable slides (지금 · 내 카드 · 접속) ----------------
const SLIDES = [["now", "지금 진행"], ["card", "내 카드"], ["join", "접속"]];
let slideCur = 0;
const swipe = (() => {
  const view = $("viewStudent"), wrap = document.createElement("div"), tabs = document.createElement("div");
  tabs.className = "stabs"; tabs.setAttribute("role", "tablist");
  tabs.innerHTML = SLIDES.map(([k, t], i) => `<button type="button" role="tab" data-i="${i}" id="stab-${k}">${t}<i class="dot"></i></button>`).join("") + `<span class="sbar" id="sbar"></span>`;
  wrap.className = "swipe"; wrap.id = "swipe";
  const mk = k => { const d = document.createElement("div"); d.className = "slide"; d.dataset.k = k; wrap.appendChild(d); return d; };
  const sNow = mk("now"), sCard = mk("card"), sJoin = mk("join");
  const joinSec = $("joinForm").closest("section"), cardSec = $("cardSlot").closest("section"), stu = view.querySelector(".student");
  ["liveBox", "nightBox", "tipBox", "judgeBox"].forEach(id => sNow.appendChild($(id)));
  const toCard = document.createElement("button"); toCard.type = "button"; toCard.className = "slidelink"; toCard.textContent = "내 카드 보기 →"; toCard.onclick = () => goSlide("card"); sNow.appendChild(toCard);
  sCard.appendChild(cardSec); sJoin.appendChild(joinSec);
  const hint = document.createElement("p"); hint.className = "muted swipehint"; hint.textContent = "← 옆으로 넘겨서 다른 화면을 볼 수 있어요 →";
  stu.replaceWith(tabs); tabs.after(wrap); wrap.after(hint);
  return { wrap, tabs, slides: [sNow, sCard, sJoin] };
})();
const narrow = () => window.matchMedia("(max-width: 760px)").matches;
function fitSlide() { if (!narrow()) { swipe.wrap.style.height = ""; return; } const s = swipe.slides[slideCur]; swipe.wrap.style.height = s.scrollHeight + "px"; }
function markTabs() {
  swipe.tabs.querySelectorAll("button").forEach((b, i) => { b.classList.toggle("on", i === slideCur); b.setAttribute("aria-selected", String(i === slideCur)); if (i === slideCur) b.classList.remove("new"); });
  const bar = $("sbar"), b = swipe.tabs.querySelectorAll("button")[slideCur]; if (bar && b) { bar.style.width = b.offsetWidth + "px"; bar.style.transform = `translateX(${b.offsetLeft}px)`; }
}
function goSlide(k, smooth = true) {
  const i = typeof k === "number" ? k : SLIDES.findIndex(x => x[0] === k); if (i < 0) return;
  slideCur = i; markTabs(); fitSlide();
  if (narrow()) swipe.wrap.scrollTo({ left: i * swipe.wrap.clientWidth, behavior: smooth ? "smooth" : "auto" });
}
function badge(k) { const i = SLIDES.findIndex(x => x[0] === k); if (i !== slideCur) { const b = $("stab-" + k); if (b) b.classList.add("new"); } }
swipe.tabs.querySelectorAll("button").forEach(b => b.onclick = () => goSlide(+b.dataset.i));
let swT = null;
swipe.wrap.addEventListener("scroll", () => { clearTimeout(swT); swT = setTimeout(() => { const i = Math.round(swipe.wrap.scrollLeft / Math.max(1, swipe.wrap.clientWidth)); if (i !== slideCur) { slideCur = i; markTabs(); fitSlide(); } }, 80); }, { passive: true });
try { const ro = new ResizeObserver(() => fitSlide()); swipe.slides.forEach(s => ro.observe(s)); } catch {}
window.addEventListener("resize", () => { markTabs(); fitSlide(); if (narrow()) swipe.wrap.scrollTo({ left: slideCur * swipe.wrap.clientWidth }); });
// new actions appear -> badge the 지금 tab
try { const mo = new MutationObserver(() => { if (["nightBox", "tipBox", "judgeBox"].some(id => !$(id).hidden)) badge("now"); }); ["nightBox", "tipBox", "judgeBox"].forEach(id => mo.observe($(id), { attributes: true, attributeFilter: ["hidden"] })); } catch {}

// ---------------- phone alert: 도도새 주의보 (morning after a 도도새 appears) ----------------
let alertTimer = null;
function checkAlert(code, v) {
  const a = v && v.alert; if (!a || a.k !== "dodo" || $("viewStudent").hidden && $("viewBoard").hidden) return;
  const k0 = $("viewBoard").hidden ? "" : "b";
  const k = `ssi-alert${k0}-${code}-${a.day}`; if (store.get(k)) return;
  store.set(k, 1);
  clearTimeout(alertTimer);
  alertTimer = setTimeout(() => {
    hideSplash();
    $("stageInner").innerHTML = `<div class="kicker dodokick">SPECIAL ALERT · DAY ${a.day}</div><div class="dodoart dodowarn">${DODO_SVG}</div><h2>도도새 주의보!</h2>
      <div class="tipbody dodobody">어젯밤 마을에 <b>도도새</b>가 나타났습니다.<br><br>도도새는 마피아도 시민도 아닙니다. <b>광장 재판에서 재판대에 오르면 혼자 승리</b>합니다.<br>너무 수상하게 구는 사람이 있다면… 도도새일지도 모릅니다. 재판에 올리기 전에 한 번 더 생각하세요.</div>
      <button class="primary" id="stageClose" style="justify-self:end">확인</button>`;
    $("stage").hidden = false;
    try { if (navigator.vibrate) navigator.vibrate([120, 80, 120, 80, 240]); } catch {}
    $("stageClose").onclick = () => { $("stage").hidden = true; };
  }, !$("splash").hidden ? 3700 : 300);
}

// ---------------- 전자칠판(board) view: public info only ----------------
let boardSubCode = null, BOARDV = null, verdictKey = null;
function boardCode() { const m = location.hash.match(/^#board[/?](?:c=)?([0-9A-Za-z-]+)/), fromUrl = m && parseCode(m[1]); if (fromUrl) return fromUrl.code; const cl = store.get("ssi-v3-class") ?? 0, st = store.get(`ssi-v3-${cl}`); return st && parseCode(st.code) ? parseCode(st.code).code : null; }
function boardStart() {
  const code = boardCode();
  if (!code) { $("viewBoard").innerHTML = `<div class="bwait">선생님 화면에서 반과 시즌을 먼저 준비하세요.</div>`; return; }
  if (boardSubCode !== code) { boardSubCode = code; liveCode = null; watchLive(code); }
  renderBoard(NETLIVE[code]);
}
window.addEventListener("storage", e => { if (!$("viewBoard").hidden && e.key && e.key.startsWith("ssi-v3-")) boardStart(); });
function renderBoard(e) {
  const el = $("viewBoard"); if (el.hidden) return;
  const c = parseCode(boardSubCode || "");
  if (!c) return;
  const qr = `<div class="bqr"><img src="${QR_SRC}" alt="학생 접속 QR"><div><b>ssi-game.web.app</b><span>시즌 코드</span><strong>${esc(c.code)}</strong></div></div>`;
  if (!e) { el.innerHTML = `<div class="bwrap"><div class="bwait"><h2>SSI 마피아 토론</h2><p>선생님이 진행을 시작하면 이 화면에 단계와 시간이 크게 표시됩니다.</p><p class="bdiag">연결된 시즌 코드 <b>${esc(c.code)}</b> · 노트북 화면의 코드와 같은지, 노트북에서 '선생님 로그인'이 되어 있는지 확인하세요.${liveErr ? "<br>" + esc(liveErr) : ""}</p></div>${qr}</div>`; return; }
  const T = TOPICS[dayTopic(c, e.day)], [msg, ph] = STU[e.phase] || ["선생님 안내를 따르세요.", "down"], [pc, pt] = PHONE[ph], r = liveRemain(e);
  let extra = "";
  if (e.scores && e.scores.length) { const mx = Math.max(1, ...e.scores); extra = `<div class="bscore">${e.scores.map((v, i) => `<div><span>${i + 1}구역</span><i style="width:${Math.round(v / mx * 100)}%"></i><b>${v}</b></div>`).join("")}</div>`; }
  el.innerHTML = `<div class="bwrap ${e.phase === "밤" ? "bnight" : ""}">
    <div class="btop"><div><div>${esc(e.cls)} · DAY ${e.day}/${e.days}${e.day === 1 ? " 연습" : ""}</div><div class="btopic">${esc(T.name)} — ${esc(T.claim)}</div></div>${qr}</div>
    <div class="bmain"><div class="bphase">${esc(e.phase)}</div><div class="bclock ${r <= 10 && e.running ? "low" : ""}" id="bClock">${fmt(r)}${e.running ? "" : `<small>❚❚</small>`}</div></div>
    <div class="prog bprog">${[...Array(e.total)].map((_, i) => `<i class="${i < e.pi ? "done" : i === e.pi ? "on" : ""}"></i>`).join("")}</div>
    <div class="bmsg">${esc(msg)} <span class="phone ${pc}">${pt}</span></div>${extra}<div class="bfoot">${esc(c.code)} · ${hhmm(e.updated)} 업데이트</div></div>`;
  boardVerdict(e);
}
setInterval(() => { const el = $("bClock"); if (!el || $("viewBoard").hidden) return; const e = NETLIVE[boardSubCode]; if (!e || !e.running) return; const r = liveRemain(e); el.textContent = fmt(r); el.classList.toggle("low", r <= 10); }, 1000);
function boardVerdict(e) {
  const v = e && e.verdict; if (!v) return;
  const k = `${v.day}|${v.seat}`; if (verdictKey === k) return; verdictKey = k;
  if (verdictKey && store.get("ssi-verdict-seen") === k) return; store.set("ssi-verdict-seen", k);
  const res = v.hit ? ["마피아가 맞습니다!", "체포!", "vhit"] : v.dodo ? ["사실 도도새였습니다!", "재판대에 올라 도도새 승리!", "vdodo"] : ["마피아가 아닙니다.", "누명이었습니다…", "vmiss"];
  $("stageInner").innerHTML = `<div class="kicker">DAY ${v.day} · 광장 재판 판정</div><div class="verdict"><div class="vseat">${v.seat}번은…</div><div class="vres ${res[2]}" id="vres"><b>${res[0]}</b><span>${res[1]}</span></div></div><button class="primary" id="stageClose" style="justify-self:end">닫기</button>`;
  $("stage").hidden = false; $("stageClose").onclick = () => { $("stage").hidden = true; };
  setTimeout(() => { const x = $("vres"); if (x) x.classList.add("show"); }, 1800);
}
// teacher: open board window, secret list
let boardWin = null;
function openBoard() { const url = location.origin + location.pathname + location.search + "#board/" + S.code; boardWin = window.open(url, "ssi-board", "popup,width=1280,height=760"); if (!boardWin) { setSync("err", "팝업이 막혔습니다. 주소창 오른쪽에서 팝업을 허용해 주세요"); } }
function syncBoardWin() { try { if (boardWin && !boardWin.closed && S && !boardWin.location.hash.endsWith(S.code)) boardWin.location.hash = "#board/" + S.code; } catch {} }
let secretTimer = null;
function renderSecret() {
  const P = $("secretPanel"); if (P.hidden) return;
  const c = C(), R = roles(c), caught = caughtAll(), D = S.dodo;
  const pend = D && D.offers ? D.offers.find(x => x[2] == null) : null;
  P.innerHTML = `<div class="secin"><b class="sk">교사 전용 · 전자칠판에는 나오지 않습니다</b>
    <div><span class="sl">마피아</span>${R.mafia.map(s => `<span class="chip ${caught.includes(s) ? "gone" : "maf"}">${s}번 · ${districtOf(c.n, s) + 1}구역${caught.includes(s) ? " (체포)" : ""}</span>`).join("")}</div>
    <div><span class="sl">심판</span>${R.judges.map((s, i) => `<span class="chip">${i + 1}구역 ${s}번</span>`).join("")}</div>
    <div><span class="sl">도도새</span>${D && D.seat ? `<span class="chip dodo">${D.seat}번 (DAY ${D.day}부터)${dodoWon() ? " · 승리" : ""}</span>` : pend ? `<span class="chip">제안 중: ${pend[1]}번 (응답 대기)</span>` : `<span class="muted">아직 없음 (DAY 3 밤부터 제안)</span>`}</div>
    <button class="sm" id="secretHide">숨기기</button></div>`;
  $("secretHide").onclick = toggleSecret;
}
function toggleSecret() {
  const P = $("secretPanel"); P.hidden = !P.hidden; $("secretBtn").setAttribute("aria-pressed", String(!P.hidden)); $("secretBtn").classList.toggle("on", !P.hidden);
  clearTimeout(secretTimer); if (!P.hidden) { renderSecret(); secretTimer = setTimeout(() => { if (!P.hidden) toggleSecret(); }, 20000); }
}
$("boardBtn").onclick = openBoard; $("secretBtn").onclick = toggleSecret;

// ---------------- teacher setup: classroom screen checklist ----------------
function setupGuide() {
  const folded = store.get("ssi-guide-fold") === true;
  const ok = NET.isTeacher();
  return `<div class="sguide ${folded ? "fold" : ""}"><div class="sghead"><b>수업 전 화면 연결</b><span class="muted">노트북 + 전자칠판(HDMI)</span><button class="sm" id="sgFold">${folded ? "펼치기" : "접기"}</button></div>
    <ol class="sgsteps">
      <li class="key"><span class="n">1</span><div><b>Windows 키 + P → '확장'</b><small>'복제'로 두면 노트북 화면(비밀 명단·밤 집계)이 전자칠판에 그대로 나갑니다.</small></div><span class="kbd">⊞ Win + P</span></li>
      <li><span class="n">2</span><div><b>선생님 로그인 확인</b><small>${ok ? `로그인됨 · ${esc(NET.user && NET.user.email || "로컬 모드")}` : "위쪽 '선생님 로그인'을 눌러 주세요. 로그인해야 학생 휴대폰과 연동됩니다."}</small></div><span class="${ok ? "okc" : "noc"}">${ok ? "완료" : "필요"}</span></li>
      <li><span class="n">3</span><div><b>전자칠판 화면 열기</b><small>새 창이 뜨면 전자칠판 쪽으로 끌어다 놓으세요.</small></div><button class="sm gold" id="sgBoard">전자칠판 화면 열기</button></li>
      <li><span class="n">4</span><div><b>전자칠판 창에서 F11</b><small>전체 화면이 됩니다. 진행은 노트북에서만 하세요.</small></div><span class="kbd">F11</span></li>
    </ol></div>`;
}
function bindSetupGuide() {
  const f = $("sgFold"); if (f) f.onclick = () => { store.set("ssi-guide-fold", !(store.get("ssi-guide-fold") === true)); renderStep(); };
  const b = $("sgBoard"); if (b) b.onclick = openBoard;
}

// ---------------- install as an app (PWA) ----------------
let installEvt = null;
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const inApp = () => /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\//i.test(navigator.userAgent);
function updateInstallUI() { ["installBtn", "installBtn2"].forEach(id => { const b = $(id); if (b) b.hidden = isStandalone(); }); }
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; updateInstallUI(); });
window.addEventListener("appinstalled", () => { installEvt = null; updateInstallUI(); });
async function doInstall() {
  if (installEvt) { installEvt.prompt(); try { await installEvt.userChoice; } catch {} installEvt = null; updateInstallUI(); return; }
  const steps = isIOS()
    ? (inApp() ? [["1", "Safari로 열기", "지금은 카카오톡 같은 앱 안의 브라우저입니다. 오른쪽 아래(또는 위) 메뉴에서 'Safari로 열기'를 누르세요."], ["2", "공유 버튼", "Safari 아래쪽 가운데 □↑ 공유 버튼을 누릅니다."], ["3", "홈 화면에 추가", "목록을 내려 '홈 화면에 추가' → '추가'를 누르면 끝!"]]
               : [["1", "공유 버튼", "Safari 아래쪽(아이패드는 위쪽) □↑ 공유 버튼을 누릅니다."], ["2", "홈 화면에 추가", "목록을 아래로 내려 '홈 화면에 추가'를 누릅니다."], ["3", "추가", "오른쪽 위 '추가'를 누르면 홈 화면에 SSI 마피아 아이콘이 생깁니다."]])
    : inApp() ? [["1", "다른 브라우저로 열기", "지금은 앱 안의 브라우저입니다. 메뉴(⋮)에서 'Chrome(다른 브라우저)으로 열기'를 누르세요."], ["2", "앱 설치", "Chrome 메뉴(⋮) → '앱 설치' 또는 '홈 화면에 추가'를 누릅니다."]]
    : [["1", "브라우저 메뉴 열기", "주소창 오른쪽 ⋮ (또는 설치 아이콘 ⊕)을 누릅니다."], ["2", "앱 설치 / 홈 화면에 추가", "'앱 설치' 또는 '홈 화면에 추가'를 누르면 바탕화면·홈 화면에 아이콘이 생깁니다."]];
  $("stageInner").innerHTML = `<div class="kicker">INSTALL · 앱으로 설치</div><div class="appicon"><img src="icons/icon-192.png" alt=""></div><h2>홈 화면에 앱으로 설치하기</h2>
    <div class="items">${steps.map(([n, h, p]) => `<div class="item"><small>${n}단계</small><b>${esc(h)}</b><br>${esc(p)}</div>`).join("")}</div>
    <p class="muted" style="margin:0">설치하면 주소창 없이 전체 화면으로 열리고, 아이콘을 눌러 바로 들어올 수 있습니다.</p>
    <button class="primary" id="stageClose" style="justify-self:end">닫기</button>`;
  $("stage").hidden = false; $("stageClose").onclick = () => { $("stage").hidden = true; };
}
["installBtn", "installBtn2"].forEach(id => { const b = $(id); if (b) b.onclick = doInstall; });
updateInstallUI();
if ("serviceWorker" in navigator && location.protocol === "https:") { window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); }); }
