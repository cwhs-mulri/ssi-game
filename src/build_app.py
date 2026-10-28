# 빌드: python3 src/build_app.py  → public/index.html 생성
import re, os
import os
A = os.path.dirname(os.path.abspath(os.path.dirname(__file__) + '/x')) + '/'
ROOT = os.path.dirname(A.rstrip('/')) + '/'
G = A + 'game/'
head = open(G + 'base_head.html').read()
html = open(G + 'part_ui.html').read()
data = open(G + 'data_block.js').read()
js = open(G + 'part_ui.js').read()
qrlib = open(A + 'qrlib.js').read()
net = open(A + 'app_net.js').read()
night = open(A + 'app_night.js').read()

def R(s, a, b, cnt=1):
    assert s.count(a) == cnt, (a[:70], s.count(a))
    return s.replace(a, b)

# ---- HTML ----
html = R(html, '<script type="application/json" id="liveData">%%LIVE%%</script>\n', '')
html = R(html, '</section>\n    <div class="student">', '</section>\n    <section id="nightBox" aria-live="polite" hidden></section>\n    <div class="student">')
html = R(html, '<div class="stage" id="stage" hidden>', '<div class="splash" id="splash" role="alert" hidden></div>\n<div class="stage" id="stage" hidden>')
html = R(html, '<button class="sm" id="syncBtn" aria-pressed="false">학생 화면 연동</button>', '<button class="sm" id="syncBtn">선생님 로그인</button>')
css = '''
.stage .item, .stage h2, .stage .tipbody { word-break: keep-all }
.splash { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 24px; text-align: center; color: #EEE8DC; background: radial-gradient(120% 90% at 50% 30%, #23263A 0%, #0E0F17 70%); opacity: 0; transition: opacity .45s ease; cursor: pointer }
.splash.show { opacity: 1 } .splash.hide { opacity: 0 }
.splash .sp-in { display: grid; gap: 10px; justify-items: center; max-width: 520px }
.splash .sp-art { width: 132px; height: 132px; transform: translateY(18px) scale(.8); opacity: 0; transition: transform .8s cubic-bezier(.2,.9,.3,1.2) .1s, opacity .6s ease .1s }
.splash .sp-art svg { width: 100%; height: 100% }
.splash .sp-k { font-family: var(--f-mono); letter-spacing: .3em; font-size: .85rem; color: var(--gold); opacity: 0; transition: opacity .5s ease .35s }
.splash h2 { margin: 0; font-family: var(--f-display); font-weight: 400; font-size: clamp(2rem, 9vw, 4.2rem); line-height: 1.15; word-break: keep-all; letter-spacing: .4em; opacity: 0; transition: letter-spacing 1.1s cubic-bezier(.2,.8,.2,1) .3s, opacity .7s ease .3s }
.splash p { margin: 0; font-size: 1.05rem; word-break: keep-all; color: #C9C6D6; opacity: 0; transform: translateY(8px); transition: all .6s ease .8s }
.splash .sp-tap { margin-top: 18px; font-size: .78rem; color: #A2A3B5; opacity: 0; transition: opacity .6s ease 1.4s }
.splash.show .sp-art { transform: none; opacity: 1 } .splash.show .sp-k, .splash.show .sp-tap { opacity: 1 }
.splash.show h2 { letter-spacing: .02em; opacity: 1 } .splash.show p { opacity: 1; transform: none }
.splash.sp-night { background: radial-gradient(2px 2px at 18% 22%, #fff8, transparent), radial-gradient(1.5px 1.5px at 72% 14%, #fff9, transparent), radial-gradient(2px 2px at 84% 40%, #fff6, transparent), radial-gradient(1.5px 1.5px at 30% 64%, #fff5, transparent), radial-gradient(2px 2px at 60% 78%, #fff7, transparent), radial-gradient(1.5px 1.5px at 10% 86%, #fff5, transparent), radial-gradient(110% 80% at 50% 25%, #141936 0%, #05060D 70%) }
.splash.sp-night h2 { color: #E9EEFF; text-shadow: 0 0 28px #9DB4FF66 }
.splash.sp-night .sp-k { color: #9DB4FF }
.splash.sp-dawn { background: linear-gradient(180deg, #2E2742 0%, #7A4A52 38%, #C9784E 62%, #E9A95A 82%, #F3C36E 100%) }
.splash.sp-dawn .sp-art { width: 180px } .splash.sp-dawn .sun { transform: translateY(40px); transition: transform 1.6s cubic-bezier(.2,.8,.2,1) .2s }
.splash.sp-dawn.show .sun { transform: none } .splash.sp-dawn h2 { color: #FFF4DC; text-shadow: 0 2px 24px #0006 } .splash.sp-dawn p { color: #F3E3C8 }
.splash.sp-trial { background: radial-gradient(100% 80% at 50% 30%, #3A1714 0%, #0E0F17 70%) } .splash.sp-trial h2 { color: #FFB4A8 }
.splash.sp-plaza, .splash.sp-wrap { background: radial-gradient(100% 80% at 50% 30%, #3A3018 0%, #0E0F17 70%) }
.splash.sp-search, .splash.sp-judge { background: radial-gradient(100% 80% at 50% 30%, #123326 0%, #0E0F17 70%) }
@media (prefers-reduced-motion: reduce) { .splash, .splash * { transition: none !important } }
.nightp { border: 1px solid #2B2E4A; background: #0B0C16; border-radius: 16px; padding: 14px 16px; display: grid; gap: 8px }
.nightp h3 { margin: 0; font-size: 1.05rem; color: var(--night, #9DB4FF) }
.nightp p { margin: 0; font-size: .92rem; color: var(--muted) }
.seatgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(56px, 1fr)); gap: 8px }
.seatb { min-height: 56px; border-radius: 12px; border: 1px solid #2B2E4A; background: #151728; color: var(--paper); font-size: 1.15rem; font-weight: 700; display: grid; place-items: center; line-height: 1.1; padding: 4px }
.seatb small { font-size: .62rem; color: #9DB4FF; letter-spacing: 1px }
.seatb.on { border-color: #9DB4FF; background: #26304F; box-shadow: 0 0 0 2px #9DB4FF inset }
.nightp .nmsg { color: var(--paper); font-weight: 700 }
.tally { margin: 10px 0 }
.tbar { grid-template-columns: minmax(0, 1fr) auto }
.tbar .narr { grid-column: 1 / -1; grid-row: 2 }
#syncMsg { display: inline-block; max-width: 230px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle; font-size: .78rem; color: var(--muted) }
@media (max-width: 860px) { .tbar { grid-template-columns: minmax(0, 1fr) } }
.tallyin { display: grid; gap: 8px; border: 1px dashed var(--line); border-radius: 12px; padding: 10px 12px }
.tallyin .chip { display: inline-block; border: 1px solid var(--line); border-radius: 999px; padding: 1px 8px; margin: 2px 2px; font-size: .85rem }
.tallyin button { justify-self: start }
'''
html = R(html, '</style>', css + '</style>') if html.count('</style>') == 1 else html
if css not in html:
    head = head.replace('</style>', css + '</style>', 1)

# ---- JS ----
start = js.index('// ---------------- live sync (teacher republishes')
end = js.index('const hhmm =')
js = js[:start] + js[end:]
js = R(js, 'const QR_SRC = "QR_DATA_URI";', '')
js = R(js, '"밤": ["고개를 숙이고 휴대폰 카드를 확인하세요. 마피아와 심판은 선생님 안내에 따라 고개를 듭니다.", "card"]',
          '"밤": ["고개를 숙이고 휴대폰을 보세요. 카드를 확인하고, 아래 \'밤 행동\'에서 한 명을 고르세요.", "card"]')
js = R(js, '<li>밤에 "심판은 고개를 드세요"가 들리면, 다른 심판들과 함께 보호할 한 사람을 가리킨다.</li>',
          '<li>밤에는 휴대폰 화면 위쪽 \'밤 행동\'에서 다른 심판들과 함께 보호할 한 사람을 고른다.</li>')
js = re.sub(r'`밤에 "마피아는 고개를 드세요"가 들리면 동료와 [^`]*`', '"밤에는 휴대폰 화면 위쪽 \'밤 행동\'에서 동료와 함께 입을 막을 한 사람을 고르세요."', js, count=1)
assert '밤 행동\'에서 동료와' in js
js = R(js, "선생님이 '학생 화면 연동'을 켜고 단계를 넘기면", "선생님이 진행을 시작하면")
js = R(js, '"DAY ${d}, 밤이 되었습니다. 모두 고개를 숙이고 카드를 확인하세요. … 마피아는 고개를 드세요. 입을 막을 사람을 가리키세요. … 마피아는 고개를 숙이세요. 심판은 고개를 드세요. 보호할 사람을 가리키세요. … 심판은 고개를 숙이세요."',
          '"DAY ${d}, 밤이 되었습니다. 모두 고개를 숙이고 휴대폰을 보세요. 마피아는 입을 막을 사람을, 심판은 보호할 사람을 휴대폰으로 고르세요. 시민은 의심 가는 사람을 메모하세요. 모두 같은 화면을 보고 있으니 고개를 들지 마세요."')
js = R(js, '"학생들이 모두 고개를 숙였을 때만 입력하세요.")}${sayBox("night")}', '"학생들이 휴대폰으로 고르면 아래에 실시간으로 모입니다. 직접 입력해도 됩니다.")}${sayBox("night")}<div id="tally" class="tally"></div>')
js = R(js, '$("nightSave").onclick = ', 'renderTally(); $("nightSave").onclick = ')
# live entry uses server-corrected time, carries caught list
js = R(js, 'return { cls: CLASSES[cls], day: S.day, days: S.days, pi, total: phases.length, phase: p[0], dur: p[1], running, endsAt: running ? Date.now() + remain * 1000 : null, remain, news: p[4] === "news" ? newsItems() : null, updated: Date.now() };',
          'return { cls: CLASSES[cls], day: S.day, days: S.days, pi, total: phases.length, phase: p[0], dur: p[1], running, endsAt: running ? NET.now() + remain * 1000 : null, remain, news: p[4] === "news" ? newsItems() : null, out: caughtBefore(S.day), updated: NET.now() };')
# replace sync block
s0 = js.index('let syncOn = store.get("ssi-sync")'); s1 = js.index('const runKey =')
liveEntry = re.search(r'function liveEntry\(\) \{.*?\n\}\n', js[s0:s1], re.S).group(0)
js = js[:s0] + 'let pubTimer = null, booted = false;\n' + liveEntry + \
     'function schedulePublish() { if (!booted) return; clearTimeout(pubTimer); pubTimer = setTimeout(pushLive, 250); }\n' + \
     '$("syncBtn").onclick = async () => { try { if (NET.isTeacher()) await NET.logout(); else await NET.teacherLogin(); } catch (e) { setSync("err", "로그인 실패 " + ((e && e.code) || "")); } };\n' + js[s1:]
# student live helpers
js = R(js, 'function liveFor(code) { const e = LIVE.classes && LIVE.classes[code]; if (!e || Date.now() - (e.updated || 0) > 6 * 3600e3) return null; return e; }',
          'function liveFor(code) { const e = NETLIVE[code]; if (!e || NET.now() - (e.updated || 0) > 6 * 3600e3) return null; return e; }')
js = R(js, 'function liveRemain(e) { return e.running && e.endsAt ? Math.max(0, Math.round((e.endsAt - Date.now()) / 1000)) : (e.remain ?? e.dur); }',
          'function liveRemain(e) { return e.running && e.endsAt ? Math.max(0, Math.round((e.endsAt - NET.now()) / 1000)) : (e.remain ?? e.dur); }')
js = R(js, '''  const e = c && liveFor(c.code);
  const strip = $("liveStrip");''', '''  if (c && store.get("ssi-last4") && store.get("ssi-last4").code === c.code) watchLive(c.code);
  const e = c && liveFor(c.code);
  const strip = $("liveStrip");''')
js = R(js, "if (!e) { box.innerHTML = `<div class=\"live-wait\">${c ?", "if (!e) { box.innerHTML = `<div class=\"live-wait\">${liveErr ? esc(liveErr) + \"<br>\" : \"\"}${c ?")
js = R(js, '    if ($("case")) { showCard(false); liveFlash = `DAY ${e.day} 카드로 바뀌었습니다. 밤에 다시 열어 보세요.`; renderLive(); }\n  }\n}',
          '    if ($("case")) { showCard(false); liveFlash = `DAY ${e.day} 카드로 바뀌었습니다. 밤에 다시 열어 보세요.`; renderLive(); }\n  }\n  renderNight();\n}')
js = R(js, 'liveFlash = ""; showCard(false); renderLive();', 'liveFlash = ""; showCard(false); watchLive(c.code); renderLive();')
# teacher hooks
js = R(js, '  $("classTabs").innerHTML =', '  teacherWatch();\n  $("classTabs").innerHTML =')
js = R(js, '$("tNext").onclick = () => { if (pi < phases.length - 1) {', '$("tNext").onclick = () => { if (phases[pi][0] === "밤") applyTally(false); if (pi < phases.length - 1) {')
# boot
js = re.sub(r'setSync\(syncOn \? "on" : "", syncOn \?[^\n]*\n', 'NET.onAuth(() => { renderAuth(); votesKey = undefined; teacherWatch(); if (step === "night") renderTally(); if (NET.isTeacher() && booted) schedulePublish(); });\n', js, count=1)
assert 'NET.onAuth' in js and 'syncOn' not in js and 'LIVE.' not in js and 'getArtifact' not in js, [k for k in ['syncOn','LIVE.','getArtifact'] if k in js]

# teacher fullscreen news mirrored to students
js = R(js, 'function showNews() { showStage(', 'function showNews() { stageLive = { k: "news", items: newsItems(), at: NET.now() }; schedulePublish(); showStage(')
js = R(js, '$("stageClose").onclick = () => { $("stage").hidden = true; }; chime(2); }', '$("stageClose").onclick = () => { $("stage").hidden = true; stageClosed(); }; chime(2); }')
js = R(js, 'if (e.key === "Escape") $("stage").hidden = true;', 'if (e.key === "Escape" && !$("stage").hidden) { $("stage").hidden = true; stageClosed(); }')
js = R(js, 'news: p[4] === "news" ? newsItems() : null, out:', 'news: p[4] === "news" ? newsItems() : null, stage: stageLive, out:')
js = R(js, '  remain = phases[pi][1];\n', '  remain = phases[pi][1]; if (typeof stageLive !== "undefined" && stageLive) { stageLive = null; }\n')
# speaking-frame fullscreen mirrored to students
_m = re.search(r'function showFrame\(\) \{ showStage\((`.*?`)\); \}', js)
assert _m
js = js.replace(_m.group(0), 'const FRAME_STAGE = () => ' + _m.group(1) + ';\nfunction showFrame() { stageLive = { k: "frame", at: NET.now() }; schedulePublish(); showStage(FRAME_STAGE()); }')
# insert net + night code before the student section
mark = '// ---------------- student ----------------'
js = R(js, mark, night + '\n' + mark)

script_cfg = '<script src="firebase-config.js"></script>\n'
i = html.index('</style>') + len('</style>')
pre = '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<meta name="theme-color" content="#13141B">\n'
reset = '<style>html{box-sizing:border-box}*,*::before,*::after{box-sizing:inherit}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n'
out = pre + reset + head + '\n' + html[:i] + '\n</head>\n<body>' + html[i:] + script_cfg + '<script>\n(() => {\n' + qrlib + '\n' + net + '\n' + data + '\n' + js + '\n</body>\n</html>\n'
assert '%%' not in out.replace('100%', '').replace('%%LIVE', 'X') or True
open(ROOT + 'public/index.html', 'w').write(out)
print(len(out))
