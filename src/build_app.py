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
html = R(html, '<section id="nightBox" aria-live="polite" hidden></section>', '<section id="nightBox" aria-live="polite" hidden></section>\n    <section id="tipBox" hidden></section>\n    <section id="judgeBox" hidden></section>')
html = R(html, '<br>왼쪽에 코드와 출석번호를 입력하세요.', '<br>접속 화면에서 코드와 출석번호를 입력하세요.')
html = R(html, '<div class="steps-nav" id="stepsNav"', '<div class="secret" id="secretPanel" hidden></div>\n    <div class="steps-nav" id="stepsNav"')
html = R(html, '<main id="viewTeacher" class="teacher" hidden>', '<main id="viewBoard" class="eboard" hidden></main>\n  <main id="viewTeacher" class="teacher" hidden>')
html = R(html, '</nav>', '</nav>\n    <button type="button" class="installbtn" id="installBtn">앱 설치</button>')
html = R(html, '1분이면 됩니다.</p>', '1분이면 됩니다.</p>\n      <button type="button" class="installlink" id="installBtn2">휴대폰에 앱으로 설치하기</button>')
html = R(html, '<div class="stage" id="stage" hidden>', '<div class="splash" id="splash" role="alert" hidden></div>\n<div class="stage" id="stage" hidden>')
html = R(html, '<button class="sm" id="syncBtn" aria-pressed="false">학생 화면 연동</button>', '<button class="sm" id="syncBtn">선생님 로그인</button>')
html = R(html, '<button class="sm" id="syncBtn">선생님 로그인</button><span id="syncMsg"></span></span>', '<button class="sm" id="syncBtn">선생님 로그인</button><span id="syncMsg"></span></span>\n        <button class="sm" id="boardBtn" title="새 창을 전자칠판 화면으로 옮기세요">전자칠판 화면 열기</button><button class="sm danger" id="secretBtn" aria-pressed="false">비밀 명단</button>')
css = '''
.installbtn { border: 1px solid var(--gold); color: var(--gold); background: transparent; border-radius: 999px; padding: 7px 14px; font-weight: 700; font-size: .9rem; white-space: nowrap }
.installbtn::before { content: "⤓ " }
.installlink { margin-top: 10px; width: 100%; min-height: 46px; border: 1px dashed var(--gold); border-radius: 12px; background: #1E1A10; color: var(--gold); font-weight: 700 }
.stage .appicon img { width: 84px; height: 84px; border-radius: 20px; box-shadow: 0 6px 24px #0008 }
header { flex-wrap: wrap }
.sguide { border: 1.5px solid var(--gold); border-radius: 14px; background: #1E1A10; padding: 12px 14px; display: grid; gap: 10px; margin: 4px 0 6px }
.sghead { display: flex; gap: 10px; align-items: center; flex-wrap: wrap } .sghead b { color: var(--gold); font-size: 1.05rem } .sghead button { margin-left: auto }
.sguide.fold .sgsteps { display: none }
.sgsteps { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px }
.sgsteps li { display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; background: #15161E; border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px }
.sgsteps li.key { border-color: var(--gold); background: #2A2312 } .sgsteps li.key b { font-size: 1.1rem }
.sgsteps .n { width: 28px; height: 28px; border-radius: 50%; background: var(--gold); color: #13141B; display: grid; place-items: center; font-weight: 800 }
.sgsteps small { display: block; color: var(--muted); font-size: .85rem; word-break: keep-all }
.sgsteps .kbd { font-family: var(--f-mono); border: 1px solid #5A5040; border-bottom-width: 3px; border-radius: 8px; padding: 4px 10px; color: var(--paper); white-space: nowrap }
.sgsteps .okc { color: var(--judge, #4CC08F); font-weight: 800 } .sgsteps .noc { color: var(--stamp); font-weight: 800 }
body.boardmode { padding: 0 !important } body.boardmode header { display: none } body.boardmode .wrap { max-width: none; padding: 0; gap: 0 }
.eboard { display: block; min-height: 100vh } .bdiag { font-size: clamp(14px, 1.4vw, 20px) !important; color: #8E90A6 !important } .bdiag b { color: var(--gold) } .bfoot { position: absolute; left: 2vw; bottom: 1.2vh; font-size: 13px; color: #6C6E82; font-family: var(--f-mono) } .bwrap > .bqr { justify-self: center }
body.boardmode .stage .inner { max-width: 1500px; font-size: 1.45rem } body.boardmode .stage .kicker { font-size: 1.3rem } body.boardmode .stage h2 { font-size: 3.4rem } body.boardmode .stage .item { font-size: 1.6rem } body.boardmode .stage .tipbody { font-size: 2rem }
.bwrap { position: relative; min-height: 100vh; display: grid; grid-template-rows: auto 1fr auto auto auto; gap: 2.5vh; padding: 4vh 5vw 3vh; background: radial-gradient(120% 90% at 50% 20%, #23263A, #0E0F17 70%) }
.bwrap.bnight { background: radial-gradient(2px 2px at 18% 22%, #fff8, transparent), radial-gradient(2px 2px at 72% 14%, #fff9, transparent), radial-gradient(2px 2px at 84% 40%, #fff6, transparent), radial-gradient(110% 80% at 50% 25%, #141936 0%, #05060D 70%) }
.btop { display: flex; gap: 2vw; align-items: center; flex-wrap: wrap; font-size: clamp(16px, 2.2vw, 30px); color: var(--gold); font-weight: 700 }
.btopic { color: var(--paper); font-weight: 500; opacity: .85; word-break: keep-all }
.bmain { display: grid; place-items: center; align-content: center; gap: 1vh; text-align: center }
.bphase { font-family: var(--f-display); font-size: clamp(48px, 9vw, 150px); line-height: 1.05; color: var(--paper) }
.bnight .bphase { color: #E9EEFF; text-shadow: 0 0 40px #9DB4FF55 }
.bclock { font-family: var(--f-mono); font-size: clamp(64px, 14vw, 240px); font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1; color: var(--paper) }
.bclock small { font-size: .35em; margin-left: .3em; color: var(--muted) } .bclock.low { color: var(--stamp) }
.bprog { max-width: 1400px; width: 100%; margin: 0 auto } .bprog i { height: 10px }
.bmsg { text-align: center; font-size: clamp(18px, 2.4vw, 36px); color: #D8D4CC; word-break: keep-all } .bmsg .phone { font-size: .6em; vertical-align: middle }
.bscore { display: grid; gap: 1vh; max-width: 1100px; width: 100%; margin: 0 auto } .bscore div { display: grid; grid-template-columns: 6em 1fr 3em; gap: 1vw; align-items: center; font-size: clamp(16px, 2vw, 30px) } .bscore i { display: block; height: 2.2vh; min-width: 4px; border-radius: 99px; background: var(--gold) } .bscore b { text-align: right }
.btop .bqr { margin-left: auto } .bqr { display: flex; gap: 12px; align-items: center; background: #0B0C14cc; border: 1px solid var(--line); border-radius: 14px; padding: 10px 14px } .bqr img { width: clamp(70px, 8vw, 130px); background: #fff; border-radius: 6px }
.bqr div { display: grid; gap: 2px; font-size: clamp(12px, 1.2vw, 18px); color: var(--muted) } .bqr b { color: var(--paper) } .bqr strong { font-family: var(--f-mono); color: var(--gold); font-size: 1.5em; letter-spacing: .06em }
.bwait { display: grid; place-items: center; align-content: center; text-align: center; min-height: 70vh; gap: 10px } .bwait h2 { font-family: var(--f-display); font-weight: 400; font-size: clamp(40px, 6vw, 90px); margin: 0 } .bwait p { color: var(--muted); font-size: clamp(16px, 2vw, 28px) }
.verdict { display: grid; gap: 3vh; justify-items: center; text-align: center; padding: 4vh 0 }
.vseat { font-family: var(--f-display); font-size: clamp(48px, 8vw, 130px) }
.vres { display: grid; gap: 1vh; opacity: 0; transform: scale(.85); transition: all .6s cubic-bezier(.2,.9,.3,1.3) } .vres.show { opacity: 1; transform: none }
.vres b { font-size: clamp(40px, 6vw, 100px) } .vres span { font-size: clamp(20px, 2.6vw, 40px); color: var(--muted) }
.vhit b { color: var(--stamp) } .vdodo b { color: #7FD3E0 } .vmiss b { color: var(--paper) }
.secret { border: 1px dashed var(--stamp); border-radius: 12px; background: #1A0E10; padding: 10px 14px }
.secin { display: grid; gap: 8px } .secin .sk { color: #FF8A78; font-size: .85rem } .secin .sl { display: inline-block; width: 4em; color: var(--muted); font-size: .85rem }
.secin .chip { display: inline-block; border: 1px solid var(--line); border-radius: 999px; padding: 2px 10px; margin: 2px; font-size: .9rem } .secin .chip.maf { border-color: var(--stamp); color: #FFB4A8 } .secin .chip.gone { opacity: .5; text-decoration: line-through } .secin .chip.dodo { border-color: #7FD3E0; color: #7FD3E0 }
.secin button { justify-self: start } #secretBtn.on { background: var(--stamp); color: #fff }
.stage .dodowarn { animation: dodobob 1.2s ease-in-out infinite } @keyframes dodobob { 50% { transform: translateY(-6px) rotate(-4deg) } } @media (prefers-reduced-motion: reduce) { .stage .dodowarn { animation: none } }
.stabs { position: relative; display: none; gap: 4px; background: #151722; border: 1px solid var(--line); border-radius: 999px; padding: 4px; margin: 2px 0 10px }
.stabs button { position: relative; z-index: 1; flex: 1; border: 0; background: none; color: var(--muted); font-weight: 700; font-size: .92rem; min-height: 40px; border-radius: 999px }
.stabs button.on { color: #13141B } .stabs .dot { display: none; position: absolute; top: 7px; right: 14%; width: 8px; height: 8px; border-radius: 50%; background: #E0533F }
.stabs button.new .dot { display: block } .stabs .sbar { position: absolute; z-index: 0; top: 4px; left: 0; height: calc(100% - 8px); border-radius: 999px; background: var(--paper); transition: transform .3s ease, width .3s ease }
.swipe { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr) minmax(0, .9fr); gap: 16px; align-items: start }
.slide { display: grid; gap: 12px; align-content: start; min-width: 0 }
.slidelink { display: none; justify-self: end; background: none; border: 1px solid var(--line); border-radius: 999px; padding: 8px 14px; color: var(--gold); font-weight: 700 }
.swipehint { display: none; text-align: center; font-size: .8rem; margin: 8px 0 0 }
@media (max-width: 760px) {
  .stabs { display: flex } .slidelink, .swipehint { display: block } .slidelink { display: inline-block }
  .swipe { display: flex; gap: 0; overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; overscroll-behavior-x: contain; scrollbar-width: none; align-items: flex-start; transition: height .25s ease; -webkit-overflow-scrolling: touch }
  .swipe::-webkit-scrollbar { display: none }
  .slide { flex: 0 0 100%; scroll-snap-align: start; scroll-snap-stop: always; padding: 0 2px 4px }
}
@media (max-width: 760px) and (prefers-reduced-motion: reduce) { .swipe, .stabs .sbar { transition: none } }
.judgep { border: 1px solid #2E6B55; background: #0F1D18; border-radius: 16px; padding: 14px 16px; display: grid; gap: 10px }
.judgep h3 { margin: 0; color: var(--judge, #4CC08F); font-size: 1.05rem } .judgep p { margin: 0; font-size: .88rem; color: var(--muted); word-break: keep-all }
.jsides { display: grid; grid-template-columns: 1fr 1fr; gap: 8px }
.jside { display: grid; gap: 6px; align-content: start } .jside h4 { margin: 0; font-size: .95rem; display: flex; justify-content: space-between } .jside.pro h4 { color: var(--pro) } .jside.con h4 { color: var(--con) }
.jchk { display: flex; gap: 8px; align-items: center; text-align: left; min-height: 48px; padding: 8px 10px; border-radius: 12px; border: 1px solid var(--line); background: #151821; color: var(--paper); font-size: .9rem; line-height: 1.25; word-break: keep-all }
.jchk .bx { flex: 0 0 24px; height: 24px; border-radius: 6px; border: 2px solid #5A6070; display: grid; place-items: center; font-weight: 900; color: #0F1D18 }
.jchk.on { border-color: var(--judge, #4CC08F); background: #173328 } .jchk.on .bx { background: var(--judge, #4CC08F); border-color: var(--judge, #4CC08F) }
.jlead { font-size: .95rem } .jrow { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: .92rem } .jrow.col { flex-direction: column; align-items: stretch }
.jstep { display: flex; align-items: center; gap: 12px } .jstep button { width: 44px; height: 44px; border-radius: 10px; font-size: 1.3rem } .jstep b { min-width: 1.5ch; text-align: center; font-size: 1.2rem }
.jmvp, .jwin { display: flex; flex-wrap: wrap; gap: 6px } .jmvp button { min-width: 48px; min-height: 44px; border-radius: 10px; font-weight: 700 } .jwin button { flex: 1; min-height: 46px; border-radius: 10px; font-weight: 700 }
.jmvp button.on, .jwin button.on { background: var(--gold); color: #13141B; border-color: var(--gold) }
.judgep .nmsg { color: var(--paper); font-weight: 700 }
.case .stamp.dodo { color: #1E8796; border-color: #1E8796 }
.case .dodo-box { border: 1.5px solid #1E8796 !important; color: #0E3E46 !important; background: rgba(42,157,173,.14) !important; font-weight: 700 }
.stage .dodokick { color: #7FD3E0 } .stage .dodoart { width: 120px; height: 110px } .stage .dodoart svg { width: 100%; height: 100% }
.stage .dodobody { border-color: #7FD3E0; background: rgba(127,211,224,.08); font-size: 1rem; line-height: 1.6 }
.dodoline { font-size: .9rem; display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center } .dodopick { flex-direction: row !important; align-items: center; gap: 8px; font-size: .85rem } .dodopick select { min-width: 130px }
.tipbtn { width: 100%; min-height: 64px; border-radius: 16px; border: 2px solid #E0533F; background: linear-gradient(180deg, #5A1E19, #3A1411); color: #FFE3DE; font-size: 1.2rem; font-weight: 800; letter-spacing: .02em; box-shadow: 0 0 0 4px #E0533F22, 0 8px 24px #E0533F33; animation: tippulse 2.4s ease-in-out infinite }
.tipbtn.arm { background: #E0533F; color: #fff; animation: none }
.tipbtn[disabled] { opacity: .55; animation: none }
@keyframes tippulse { 50% { box-shadow: 0 0 0 8px #E0533F11, 0 8px 28px #E0533F55 } }
@media (prefers-reduced-motion: reduce) { .tipbtn { animation: none } }
.tipwrap { display: grid; gap: 6px; border: 1px solid #5A2520; background: #1A0E10; border-radius: 16px; padding: 12px 14px }
.tipwrap p { margin: 0; font-size: .86rem; color: #D9B5AE; word-break: keep-all }
.stage .tipkick { color: #FF8A78 }
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
          '    if ($("case")) { showCard(false); liveFlash = `DAY ${e.day} 카드로 바뀌었습니다. 밤에 다시 열어 보세요.`; renderLive(); }\n  }\n  renderNight(); renderTipBox(); renderDodo(); renderJudge();\n}')
js = R(js, 'liveFlash = ""; showCard(false); renderLive();', 'liveFlash = ""; showCard(false); watchLive(c.code); renderLive();')
# teacher hooks
js = R(js, '  $("classTabs").innerHTML =', '  teacherWatch(); teacherTipWatch(); teacherDodoWatch(); teacherJudgeWatch(); syncBoardWin();\n  $("classTabs").innerHTML =')
js = R(js, '$("tNext").onclick = () => { if (pi < phases.length - 1) {', '$("tNext").onclick = () => { if (phases[pi][0] === "밤") applyTally(false); if (pi < phases.length - 1) {')
# boot
js = re.sub(r'setSync\(syncOn \? "on" : "", syncOn \?[^\n]*\n', 'NET.onAuth(() => { renderAuth(); votesKey = undefined; tipKey = undefined; dodoKey = undefined; jKey2 = undefined; teacherWatch(); teacherTipWatch(); teacherDodoWatch(); teacherJudgeWatch(); if (step === "night") renderTally(); if (NET.isTeacher() && booted) schedulePublish(); });\n', js, count=1)
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
# version stamp on the student live box (for checking that phones loaded the latest build)
import datetime
_ver = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).strftime('%m%d-%H%M')
js = R(js, '선생님이 단계를 넘기면 이 화면이 자동으로 바뀝니다 · ${hhmm(e.updated)} 업데이트', '선생님이 단계를 넘기면 이 화면이 자동으로 바뀝니다 · ${hhmm(e.updated)} 업데이트 · v' + _ver)
# anonymous tip: broadcast to phones, reveal mirrored, mafia-triggered
js = R(js, '  showStage(`<div class="kicker">ANONYMOUS TIP', '  stageLive = { k: "tip", text, at: NET.now() }; schedulePublish();\n  showStage(`<div class="kicker">ANONYMOUS TIP')
js = R(js, '$("tipReveal").onclick = () => { $("tipWhy").hidden = false; };', '$("tipReveal").onclick = () => { $("tipWhy").hidden = false; if (stageLive && stageLive.k === "tip") { stageLive = Object.assign({}, stageLive, { why }); schedulePublish(); } };')
js = R(js, 'stage: stageLive, out:', 'stage: stageLive, tipUsed: !!S.tip, out:')
js = R(js, '"마피아가 신호를 보내면 사용"', '"마피아가 휴대폰으로 제보하면 자동으로 뜹니다. 직접 띄워도 됩니다"')
# 도도새 special role hooks
js = R(js, 'function cardHTML(c, seat, day, sealed = true) {', 'function cardHTML(c, seat, day, sealed = true, noDodo = false) {\n  if (!noDodo) { const dc = dodoCard(c, seat, day, sealed); if (dc) return dc; }')
js = R(js, 'stage: stageLive, tipUsed: !!S.tip, out:', 'stage: stageLive, tipUsed: !!S.tip, dodo: dodoPending(), out:')
js = R(js, '`<span class="miss">${last[1]}번은 마피아가 아닙니다. 누명이었습니다.</span>`', '(S.dodo && S.dodo.seat === last[1] && last[0] >= S.dodo.day ? `<span class="hit">${last[1]}번은 마피아가 아닙니다. 사실 도도새였습니다! 재판대에 올라 도도새 승리!</span>` : `<span class="miss">${last[1]}번은 마피아가 아닙니다. 누명이었습니다.</span>`)')
js = R(js, '${hit ? "마피아 체포" : "시민, 누명"}', '${hit ? "마피아 체포" : S.dodo && S.dodo.seat === s && dd >= S.dodo.day ? "도도새 승리" : "시민, 누명"}')
js = R(js, '`${s}번은 시민이었습니다. 누명이었습니다.`', '(S.dodo && S.dodo.seat === s && S.dodo.day <= d - 1 ? `${s}번은 사실 도도새였습니다! 재판대에 오르는 데 성공해 도도새가 승리했습니다.` : `${s}번은 시민이었습니다. 누명이었습니다.`)')
# judge phone reports
js = R(js, '<div class="result">${pz.win ? `광장 대표토론:', '<div id="plazaRep" class="tally"></div>\n      <div class="result">${pz.win ? `광장 대표토론:')
js = R(js, '["pP1", "pP2", "pC1", "pC2"].forEach(id => $(id).addEventListener("change"', 'renderPlazaRep();\n    ["pP1", "pP2", "pC1", "pC2"].forEach(id => $(id).addEventListener("change"')
js = R(js, '<div class="rowx"><button class="sm gold" data-j="${di}">저장</button><span class="out">${ww}</span></div>', '<div class="rowx"><button class="sm gold" data-j="${di}">저장</button><span class="out">${ww}${x.phone ? ` <span class="muted" style="font-size:.78rem">· 심판 휴대폰 보고</span>` : ""}</span></div>')
# swipe layout: after joining go to the card slide; initial slide on boot
js = R(js, 'if (window.matchMedia("(max-width: 760px)").matches) $("cardSlot").scrollIntoView({ behavior: "smooth" });', 'goSlide("card");')
js = R(js, '\nrenderLive();\nbooted = true;', '\nrenderLive();\ngoSlide(store.get("ssi-last4") ? "now" : "join", false); requestAnimationFrame(() => { markTabs(); fitSlide(); });\nbooted = true;')
# 도도새 주의보 in morning news + phone alert
js = R(js, '    items.push(["남은 마피아",', '    if (S.dodo && S.dodo.seat && S.dodo.day === d) items.push(["도도새 주의보", "어젯밤 마을에 도도새가 나타났습니다! 도도새는 광장 재판에서 재판대에 오르면 혼자 승리합니다. 수상해 보인다고 무작정 재판에 올리면 도도새의 함정에 빠집니다."]);\n    items.push(["남은 마피아",')
js = R(js, 'dodo: dodoPending(), out:', 'dodo: dodoPending(), alert: p[4] === "news" && S.dodo && S.dodo.seat && S.dodo.day === S.day ? { k: "dodo", day: S.day } : null, out:')
# board (전자칠판) view, teacher secret list
js = R(js, '  const h = location.hash || "#home";', '  const h = (location.hash || "#home").split(/[/?]/)[0];')
js = R(js, 'const views = { "#home": "viewHome", "#guide": "viewGuide", "#student": "viewStudent", "#teacher": "viewTeacher" };', 'const views = { "#home": "viewHome", "#guide": "viewGuide", "#student": "viewStudent", "#teacher": "viewTeacher", "#board": "viewBoard" };')
js = R(js, '  window.scrollTo(0, 0);\n}\nwindow.addEventListener("hashchange", route);', '  window.scrollTo(0, 0);\n  document.body.classList.toggle("boardmode", v === "viewBoard");\n  if (v === "viewBoard" && typeof boardStart === "function") boardStart();\n  if (v === "viewStudent" && typeof renderLive === "function" && booted) renderLive();\n}\nwindow.addEventListener("hashchange", route);')
js = R(js, 'if (c && store.get("ssi-last4") && store.get("ssi-last4").code === c.code) watchLive(c.code);', 'if (c && !$("viewStudent").hidden && store.get("ssi-last4") && store.get("ssi-last4").code === c.code) watchLive(c.code);')
js = R(js, 'S.trials.push([d, s, hit, hit && nd >= 0 ? nd : null]); save(); chime(hit ? 3 : 1);', 'S.trials.push([d, s, hit, hit && nd >= 0 ? nd : null]); save(); chime(hit ? 3 : 1); schedulePublish();')
js = R(js, 'alert: p[4] === "news"', 'verdict: (() => { if (p[4] !== "trial") return null; const t = S.trials.filter(x => x[0] === S.day).slice(-1)[0]; return t ? { day: t[0], seat: t[1], hit: !!t[2], dodo: !!(S.dodo && S.dodo.seat === t[1] && t[0] >= S.dodo.day) } : null; })(), scores: p[4] === "wrap" ? compute().totals : null, alert: p[4] === "news"')
js = R(js, '  remain = phases[pi][1]; if (typeof stageLive', '  remain = phases[pi][1]; if ($("secretPanel") && !$("secretPanel").hidden) renderSecret(); if (typeof stageLive')
# setup step: classroom screen checklist
js = R(js, '${head("setup", `${CLASSES[cls]} 시즌 준비`, "반 인원과 시즌 길이를 정하고 코드를 학생들에게 보여 주세요.")}', '${head("setup", `${CLASSES[cls]} 시즌 준비`, "반 인원과 시즌 길이를 정하고 코드를 학생들에게 보여 주세요.")}${setupGuide()}')
js = R(js, 'fillSelect($("tN"), 12, 30, c.n, v => `${v}명`);', 'bindSetupGuide(); fillSelect($("tN"), 12, 30, c.n, v => `${v}명`);')
js = R(js, 'NET.onAuth(() => { renderAuth();', 'NET.onAuth(() => { renderAuth(); if (step === "setup" && booted) renderStep();')
# insert net + night code before the student section
mark = '// ---------------- student ----------------'
js = R(js, mark, night + '\n' + mark)

script_cfg = '<script src="firebase-config.js"></script>\n'
i = html.index('</style>') + len('</style>')
pre = '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<meta name="theme-color" content="#13141B">\n<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" href="icons/icon-192.png">\n<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n<meta name="apple-mobile-web-app-title" content="SSI 마피아">\n'
reset = '<style>html{box-sizing:border-box}*,*::before,*::after{box-sizing:inherit}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n'
out = pre + reset + head + '\n' + html[:i] + '\n</head>\n<body>' + html[i:] + script_cfg + '<script>\n(() => {\n' + qrlib + '\n' + net + '\n' + data + '\n' + js + '\n</body>\n</html>\n'
assert '%%' not in out.replace('100%', '').replace('%%LIVE', 'X') or True
open(ROOT + 'public/index.html', 'w').write(out)
print(len(out))
