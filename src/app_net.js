
// ---------------- network: Firebase Realtime Database, or a same-device local fallback ----------------
const FBV = "10.12.2";
const NET = (() => {
  const subs = new Set();
  let mode = "init", user = null, offset = 0, api = null, authCbs = [];
  const fireAuth = () => authCbs.forEach(f => { try { f(user); } catch {} });

  // local backend: one JSON tree in localStorage, BroadcastChannel to wake other tabs
  const LK = "ssi-net-tree";
  const bc = (() => { try { return new BroadcastChannel("ssi-net"); } catch { return null; } })();
  const readTree = () => { try { return JSON.parse(localStorage.getItem(LK)) || {}; } catch { return {}; } };
  const at = (tree, path) => path.split("/").reduce((o, k) => (o == null ? undefined : o[k]), tree);
  function localPut(path, val) {
    const tree = readTree(), ks = path.split("/"); let o = tree;
    ks.slice(0, -1).forEach(k => { if (typeof o[k] !== "object" || o[k] === null) o[k] = {}; o = o[k]; });
    if (val === null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = JSON.parse(JSON.stringify(val));
    try { localStorage.setItem(LK, JSON.stringify(tree)); } catch {}
    if (bc) bc.postMessage(1);
    localFire();
  }
  function localFire() { const tree = readTree(); subs.forEach(s => { if (s.local) s.cb(at(tree, s.path) ?? null); }); }
  if (bc) bc.onmessage = localFire;
  window.addEventListener("storage", e => { if (e.key === LK) localFire(); });

  const cfg = window.FB_CONFIG;
  const hasCfg = !!(cfg && cfg.apiKey && cfg.databaseURL && !/여기|YOUR/.test(cfg.apiKey));
  const forceLocal = /[?&]local\b/.test(location.search);

  const ready = (async () => {
    if (!hasCfg || forceLocal) { mode = "local"; user = { uid: "local-" + (sessionStorage.getItem("ssi-local-uid") || (() => { const u = Math.random().toString(36).slice(2, 10); try { sessionStorage.setItem("ssi-local-uid", u); } catch {} return u; })()), local: true }; fireAuth(); return; }
    const base = `https://www.gstatic.com/firebasejs/${FBV}/`;
    const [A, U, D] = await Promise.all([import(base + "firebase-app.js"), import(base + "firebase-auth.js"), import(base + "firebase-database.js")]);
    const app = A.initializeApp(cfg), auth = U.getAuth(app), db = D.getDatabase(app);
    api = { U, D, auth, db };
    mode = "fb";
    D.onValue(D.ref(db, ".info/serverTimeOffset"), s => { offset = s.val() || 0; });
    await new Promise(res => { let first = true; U.onAuthStateChanged(auth, u => { user = u; fireAuth(); if (first) { first = false; res(); } }); });
  })().catch(e => { console.warn("Firebase 연결 실패, 로컬 모드로 동작", e); mode = "local"; user = { uid: "local-x", local: true }; fireAuth(); });

  return {
    get mode() { return mode; }, get user() { return user; }, ready, hasCfg,
    now: () => Date.now() + offset,
    onAuth(cb) { authCbs.push(cb); cb(user); },
    isTeacher() { if (mode === "init") return false; if (mode === "local") return true; const em = (user && user.email || "").toLowerCase(); return !!(user && !user.isAnonymous && (window.TEACHER_EMAILS || []).map(s => s.toLowerCase()).includes(em)); },
    async ensureAnon() { await ready; if (mode !== "fb" || user) return user; await api.U.signInAnonymously(api.auth); return api.auth.currentUser; },
    async teacherLogin() { await ready; if (mode !== "fb") return user; if (user && user.isAnonymous) await api.U.signOut(api.auth); const r = await api.U.signInWithPopup(api.auth, new api.U.GoogleAuthProvider()); return r.user; },
    async logout() { await ready; if (mode === "fb") await api.U.signOut(api.auth); },
    watch(path, cb) {
      const s = { path, cb, local: true, off: null };
      subs.add(s);
      ready.then(() => {
        if (!subs.has(s)) return;
        if (mode === "fb") { s.local = false; s.off = api.D.onValue(api.D.ref(api.db, path), snap => cb(snap.val()), err => { console.warn("watch", path, err && err.code); cb(null, err); }); }
        else cb(at(readTree(), path) ?? null);
      });
      return () => { subs.delete(s); if (s.off) s.off(); };
    },
    async put(path, val) { await ready; if (mode === "fb") return api.D.set(api.D.ref(api.db, path), val); localPut(path, val); },
    stamp() { return mode === "fb" ? api.D.serverTimestamp() : Date.now(); }
  };
})();
const roomPath = code => `rooms/${String(code).replace(/[.#$\[\]\/]/g, "_")}`;

// QR code for this page's student link, drawn as SVG
function qrSVG(text) {
  const q = new QRLIB.QRCode(-1, QRLIB.ECL.M); q.addData(text); q.make();
  const n = q.getModuleCount(), m = 4; let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 2 * m} ${n + 2 * m}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
const studentURL = () => location.origin + location.pathname + "#student";
const QR_SRC = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(qrSVG(studentURL()));
