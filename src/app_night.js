
// ---------------- student: live phase subscription ----------------
let NETLIVE = {}, liveCode = null, liveSub = null, liveErr = "";
function watchLive(code) {
  if (code === liveCode) return;
  liveCode = code; if (liveSub) { liveSub(); liveSub = null; } NETLIVE = {}; liveErr = "";
  watchBoard(null);
  if (!code) return;
  NET.ensureAnon().then(() => {
    if (liveCode !== code) return;
    liveSub = NET.watch(roomPath(code) + "/live", (v, err) => {
      liveErr = err ? "서버에 연결하지 못했습니다. 선생님께 알려 주세요." : "";
      NETLIVE[code] = v; renderLive(); renderNight();
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
