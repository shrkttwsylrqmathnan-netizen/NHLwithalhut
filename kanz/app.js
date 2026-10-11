/* 🐋 كنوز الحوت — الواجهة والشبكة · V1.0
   ═══════════════════════════════════════════════════════════════════════
   ما الذي يختلف عن clearing.html (لوحة التصفير القديمة) ولماذا:

   ① كلّ المطاعم لا عشرون: القديمة تجمّد «دفعة» من ٢٠، ومن عليه دينٌ خارجها
      لا يُرى حتى تكتمل. هنا القائمة كلّها مع بحثٍ ومناطق وترتيبٍ بالقرب.
   ② التحميل: القديمة تنزّل ledgers/restaurants (≈١ م.ب — تحمل طلبات اليوم
      لكلّ مطعم) و restaurants_config (≈١ م.ب — تحمل قوائم الأسعار) عند كلّ
      «تحديث». هنا يُقرأ حقل debt وحده لكلّ مطعم (بضعة ك.ب)، والأسماء
      والمواقع من restaurants_locations (≈٨٠ ك.ب) مرّةً في اليوم، ولقطةٌ
      محفوظة تُعرض فوراً عند الفتح.
   ③ المبلغ المقبوض: يُكتب في الطلب (received) ويُتحقَّق من الدين الحيّ
      لحظة الاستلام — فالمدير يطرح ما قُبض لا ما تراكم بعده.
   ④ الموقع عند الاستلام (dist_m): دليلٌ لا ادّعاء.
   ⑤ طابور: ما يُسجَّل بلا اتصال لا يضيع بإغلاق التطبيق.
   ⑥ سجلّ الليدر (collector_log): تاريخٌ لا يُدهَس — منه تُحسب اللعبة.

   🔒 لا onclick في الصفحة: كلّ الأحداث بتفويضٍ عبر data-act (CSP بلا inline).
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
"use strict";
const VERSION = "1.0-Kanz";
/* ⚠️ رابط النشر نفسه المستعمل في Nahlelidersas.html و clearing.html — إن أُعيد نشر GAS برابطٍ جديد فبدّله في الثلاثة. */
const API = "https://script.google.com/macros/s/AKfycbyiFprfbDKMwOG75eZl-V5_M7XmqLkmK49YBQjhHKr_Gka77Gmdgt6uU6K5KeXilMViDw/exec";
const TOK = "NAHLA_APP_4E9C71B8A6D3F250E1AC8B37D94F6021";   /* توكن التطبيقات — لا ADMIN_API_TOKEN أبداً */

const LS_SESSION = "kanz_session", LS_STATIC = "kanz_static", LS_DEBTS = "kanz_debts",
      LS_MUTE = "kanz_mute", LS_AUTOPRINT = "kanz_autoprint", LS_ZONE = "kanz_zone_done", LS_BG = "kanz_bg_at";
const STATIC_TTL = 12 * 3600000, BG_TTL = 20 * 3600000, HOLD_MS = 700;

try { firebase.initializeApp({ apiKey: "AIzaSyAsmQKlCCZpCgfJG8AZM7fWmYPWVZkpjSQ", authDomain: "nahla-delivery-6b06f.firebaseapp.com", databaseURL: "https://nahla-delivery-6b06f-default-rtdb.europe-west1.firebasedatabase.app", projectId: "nahla-delivery-6b06f", storageBucket: "nahla-delivery-6b06f.firebasestorage.app", messagingSenderId: "592782211437", appId: "1:592782211437:web:4af068aab5807926bf0264" }); } catch (_) {}
const db = firebase.database(), auth = firebase.auth();
const $ = function (id) { return document.getElementById(id); };

/* ════════════════════ الحالة ════════════════════ */
const S = {
  name: "", phone: "", uid: "",
  R: {},            /* هاتف المطعم → {n الاسم, a المنطقة, la, lo, c العمولة, s الحالة} */
  D: {},            /* هاتف المطعم → الدين */
  orphans: [],      /* دفاتر عليها دين بلا مطعمٍ في المرآة */
  REQS: {}, RESETS: {}, SUBS: {}, LOG: [],
  Z: { zones: [], of: {} },
  me: null, meAt: 0,
  opts: { q: "", zone: "", sort: "debt", show: "open", min: 0 },
  qs: "", tab: "list", month: "", monthOff: 0,
  queue: [], ready: false, online: false, debtsAt: 0, staticAt: 0, cfgLoaded: false,
  sheet: null, mute: false
};

/* ════════════════════ أدوات ════════════════════ */
function esc(s) { if (s == null) return ""; const d = document.createElement("div"); d.textContent = String(s); return d.innerHTML.replace(/"/g, "&quot;"); }
function num(n) { return Math.round(Number(n) || 0).toLocaleString("ar-EG"); }
function lsGet(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (_) { return def; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (_) { return false; } }
function toast(m, t) {
  const el = document.createElement("div"); el.className = "toast " + (t || ""); el.textContent = m;
  $("toasts").appendChild(el);
  setTimeout(function () { el.style.opacity = "0"; el.style.transition = "opacity .3s"; setTimeout(function () { el.remove(); }, 320); }, 3400);
}
function withTimeout(p, ms) {
  return new Promise(function (res, rej) {
    const t = setTimeout(function () { rej(new Error("timeout")); }, ms);
    p.then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); });
  });
}
function apiGet(params) {
  const q = new URLSearchParams(Object.assign({ token: TOK }, params)).toString();
  return fetch(API + "?" + q).then(function (r) { return r.json(); });
}
function today() { return K.baghdadDay(Date.now()); }
function qKey() { return "kanz_queue_" + S.uid; }

/* ════════════════════ الصوت والاهتزاز ════════════════════ */
let AC = null;
function ac() {
  if (S.mute) return null;
  try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === "suspended") AC.resume(); } catch (_) { AC = null; }
  return AC;
}
function tone(f, at, dur, type, vol) {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + at;
  o.type = type || "sine"; o.frequency.setValueAtTime(f, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol || 0.16, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.03);
}
const sfx = {
  tap: function () { tone(660, 0, 0.05, "triangle", 0.07); },
  tick: function () { tone(440, 0, 0.04, "square", 0.04); },
  err: function () { tone(196, 0, 0.18, "sawtooth", 0.1); tone(147, 0.12, 0.22, "sawtooth", 0.1); },
  coin: function (at) { tone(988, at || 0, 0.07, "square", 0.09); tone(1319, (at || 0) + 0.07, 0.22, "square", 0.09); },
  open: function () {
    [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.95 + i * 0.09, 0.22, "triangle", 0.15); });
    for (let i = 0; i < 6; i++) sfx.coin(1.3 + i * 0.11);
  },
  level: function () { [523, 659, 784, 1047, 1319, 1568].forEach(function (f, i) { tone(f, 2.0 + i * 0.11, 0.3, "triangle", 0.16); }); },
  sticker: function () { tone(1175, 1.75, 0.12, "sine", 0.14); tone(1568, 1.87, 0.25, "sine", 0.14); }
};
function buzz(p) { try { if (!S.mute && navigator.vibrate) navigator.vibrate(p); } catch (_) {} }

/* ════════════════════ العملات المتطايرة ════════════════════ */
function coinRain(ms) {
  const cv = $("fx"), ctx = cv.getContext("2d"), dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr;
  const P = [];
  for (let i = 0; i < 70; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9, v = (9 + Math.random() * 13) * dpr;
    P.push({ x: W / 2, y: H * 0.36, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: (7 + Math.random() * 8) * dpr,
             s: Math.random() * 6, e: i % 9 === 0 ? "💎" : (i % 5 === 0 ? "⭐" : "") });
  }
  const t0 = performance.now() + 950;      /* تنطلق حين ينفتح الصندوق */
  function frame(now) {
    const t = now - t0;
    ctx.clearRect(0, 0, W, H);
    if (t > ms) return;
    if (t >= 0) {
      P.forEach(function (p) {
        p.vy += 0.42 * dpr; p.x += p.vx; p.y += p.vy; p.s += 0.25;
        const a = Math.max(0, 1 - t / ms);
        ctx.globalAlpha = a;
        if (p.e) { ctx.font = (p.r * 2) + "px serif"; ctx.fillText(p.e, p.x, p.y); }
        else {
          const w = Math.abs(Math.cos(p.s)) * p.r + 1;
          ctx.fillStyle = "#f5b301"; ctx.beginPath(); ctx.ellipse(p.x, p.y, w, p.r, 0, 0, 6.3); ctx.fill();
          ctx.fillStyle = "#ffe27a"; ctx.beginPath(); ctx.ellipse(p.x, p.y, w * 0.55, p.r * 0.55, 0, 0, 6.3); ctx.fill();
        }
      });
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ════════════════════ المصادقة ════════════════════ */
let tokAt = 0;
function encP(p) { return btoa(unescape(encodeURIComponent(p))); }
function decP(p) { return decodeURIComponent(escape(atob(p))); }
async function signIn(phone, pass) {
  const d = await apiGet({ action: "STAFF_LOGIN", phone: phone, password: pass });
  if (!d || !d.success) return { ok: false, msg: (d && d.msg) || "تعذّر الدخول" };
  if (!d.firebase_token) return { ok: false, msg: "تعذّرت المصادقة السحابية" };
  await auth.signInWithCustomToken(d.firebase_token);
  tokAt = Date.now();
  S.name = d.name || "ليدر"; S.phone = String(d.phone || phone);
  S.uid = (auth.currentUser && auth.currentUser.uid) || S.phone;
  return { ok: true };
}
/* التوكن المخصّص يصلح ساعة: نجدّده كلّ ٥٠ دقيقة، وعند العودة إلى التطبيق بعد غياب. */
async function refreshToken() {
  const s = lsGet(LS_SESSION, null);
  if (!s || !s.p) return false;
  try { const r = await signIn(s.phone, decP(s.p)); return r.ok; } catch (_) { return false; }
}
setInterval(function () { if (S.ready && Date.now() - tokAt > 50 * 60000) refreshToken(); }, 60000);
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState !== "visible" || !S.ready) return;
  if (Date.now() - tokAt > 45 * 60000) refreshToken();
  flush();
  if (Date.now() - S.debtsAt > 10 * 60000) loadDebts();
});

async function doLogin() {
  const phone = $("sPhone").value.trim(), pass = $("sPass").value.trim();
  if (!phone || !pass) { sfx.err(); return toast("أدخل الهاتف وكلمة المرور", "e"); }
  const btn = $("loginBtn"); btn.disabled = true; btn.textContent = "جارٍ الإبحار…";
  try {
    const r = await signIn(phone, pass);
    if (!r.ok) { sfx.err(); toast(r.msg, "e"); return; }
    lsSet(LS_SESSION, { name: S.name, phone: S.phone, p: encP(pass) });
    enterApp();
  } catch (_) { sfx.err(); toast("تعذّر الاتصال بالخادم — تحقّق من الإنترنت", "e"); }
  finally { btn.disabled = false; btn.textContent = "ابدأ الرحلة ⚓"; }
}
function logout() {
  if (S.queue.length) { sfx.err(); return toast("عندك " + S.queue.length + " تسجيلات لم تُرسَل بعد — انتظر عودة الاتصال", "w"); }
  try { localStorage.removeItem(LS_SESSION); } catch (_) {}
  try { auth.signOut(); } catch (_) {}
  location.reload();
}

/* ════════════════════ الإقلاع ════════════════════ */
function enterApp() {
  $("login").style.display = "none";
  $("app").style.display = "flex";
  $("hName").textContent = S.name;
  paintPrBtn();
  $("ver").textContent = "كنوز الحوت " + VERSION + " · نحلة للتوصيل";
  S.month = K.monthKey(Date.now(), 0);
  S.queue = lsGet(qKey(), []);
  /* اللقطة المحفوظة أوّلاً: القائمة تظهر قبل أن تردّ الشبكة */
  const st = lsGet(LS_STATIC, null), dv = lsGet(LS_DEBTS, null);
  if (st && st.R) { S.R = st.R; S.staticAt = st.t || 0; S.orphans = st.orphans || []; S.cfgLoaded = !!st.cfg; rebuildZones(); }
  if (dv && dv.D) { S.D = dv.D; S.debtsAt = dv.t || 0; }
  if (st && dv) { S.ready = true; render(); }
  listen();
  startGeo();
  loadAll(false);
}
function listen() {
  const bad = function (what) { return function () { toast("تعذّرت قراءة " + what + " — راجع قواعد فايربيس", "e"); }; };
  db.ref("clearing_requests").on("value", function (s) { S.REQS = s.val() || {}; render(); }, bad("طلبات التصفير"));
  db.ref("ledgers/reset_events/RESTAURANT").on("value", function (s) { S.RESETS = s.val() || {}; render(); }, bad("أختام التصفير"));
  [0, -1].forEach(function (off) {
    const m = K.monthKey(Date.now(), off);
    db.ref("sub_collections/" + m).on("value", function (s) { S.SUBS[m] = s.val() || {}; render(); }, bad("سجلّ الاشتراكات"));
  });
  db.ref("collector_log/" + S.uid).on("value", function (s) {
    const v = s.val() || {};
    S.LOG = Object.keys(v).map(function (id) { return Object.assign({ id: id }, v[id]); });
    render();
  }, bad("سجلّك"));
  let first = true;
  db.ref(".info/connected").on("value", function (s) {
    S.online = !!s.val();
    if (S.online) { $("net").classList.remove("on"); flush(); first = false; }
    else setTimeout(function () { if (!S.online && !first) $("net").classList.add("on"); }, 2500);
  });
}

let loading = false;
async function loadAll(force) {
  if (loading) return;
  loading = true;
  $("rfBtn").classList.add("spin");
  try {
    await loadStatic(force);
    await loadDebts();
    S.ready = true; render();
    setTimeout(background, 2500);
  } catch (e) {
    if (/permission|denied/i.test(String(e && e.message))) {
      if (await refreshToken()) { try { await loadStatic(force); await loadDebts(); S.ready = true; render(); } catch (_) { toast("تعذّرت قراءة البيانات — راجع قواعد فايربيس", "e"); } }
      else toast("انتهت الجلسة — اخرج وادخل من جديد", "e");
    } else if (!S.ready) toast("لا اتصال — ولا لقطة محفوظة بعد", "e");
    else toast("تعذّر التحديث — المعروض من آخر لقطة", "w");
  } finally { loading = false; $("rfBtn").classList.remove("spin"); }
}
/* الأسماء والمواقع: تتغيّر نادراً ⇒ مرّة كلّ ١٢ ساعة (أو بضغط «تحديث» مطوّلاً) */
async function loadStatic(force) {
  if (!force && S.staticAt && Date.now() - S.staticAt < STATIC_TTL && Object.keys(S.R).length) return;
  const snap = await withTimeout(db.ref("restaurants_locations").get(), 20000);
  const v = snap.val() || {}, R = {};
  Object.keys(v).forEach(function (p) {
    const x = v[p] || {}, old = S.R[p] || {};
    R[p] = { n: String(x.name || "").slice(0, 120), a: String(x.area || "").slice(0, 160), la: Number(x.lat) || 0, lo: Number(x.lng) || 0, c: old.c, s: old.s };
  });
  if (!Object.keys(R).length) throw new Error("empty_locations");
  S.R = R; S.staticAt = Date.now();
  rebuildZones(); saveStatic();
}
function saveStatic() { lsSet(LS_STATIC, { t: S.staticAt, R: S.R, orphans: S.orphans, cfg: S.cfgLoaded }); }
function rebuildZones() {
  S.Z = K.buildZones(Object.keys(S.R).map(function (p) { return { phone: p, area: S.R[p].a, lat: S.R[p].la, lng: S.R[p].lo }; }));
}
/* الديون: حقل debt وحده لكلّ مطعم — لا العقدة كلّها (فيها طلبات اليوم، ≈١ م.ب) */
async function loadDebts() {
  const keys = {};
  Object.keys(S.R).forEach(function (p) { keys[p] = 1; });
  S.orphans.forEach(function (p) { keys[p] = 1; });
  Object.keys(S.REQS).forEach(function (p) { keys[p] = 1; });
  const list = Object.keys(keys), D = {};
  let fail = 0, denied = false;
  await Promise.all(list.map(function (p) {
    return withTimeout(db.ref("ledgers/restaurants/" + p + "/debt").get(), 20000).then(function (s) {
      D[p] = Number(s.val()) || 0;
    }, function (e) {
      fail++; if (/permission|denied/i.test(String(e && e.message))) denied = true;
      if (S.D[p] != null) D[p] = S.D[p];
    });
  }));
  if (denied) throw new Error("permission_denied");
  if (fail === list.length) throw new Error("offline");
  S.D = D; S.debtsAt = Date.now();
  lsSet(LS_DEBTS, { t: S.debtsAt, D: D });
  if (fail) toast("تعذّر تحديث " + num(fail) + " مطعماً — أُبقيت أرقامها السابقة", "w");
}
/* في الخلفية، مرّة في اليوم:
   (أ) قاعدة العمولة والحالة لكلّ مطعم — للاشتراكات وشارة «محذوف».
   (ب) الدفاتر اليتيمة: دينٌ على هاتفٍ لا مطعم له في المرآة. لا يجوز أن يختفي دين. */
let bgBusy = false;
async function background(forceCfg) {
  if (bgBusy) return;
  const due = Date.now() - (lsGet(LS_BG, 0) || 0) > BG_TTL;
  if (!due && S.cfgLoaded && !forceCfg) return;
  bgBusy = true;
  try {
    const keys = Object.keys(S.R);
    await Promise.all(keys.map(function (p) {
      return Promise.all([
        withTimeout(db.ref("restaurants_config/" + p + "/comm").get(), 30000),
        withTimeout(db.ref("restaurants_config/" + p + "/status").get(), 30000)
      ]).then(function (a) { S.R[p].c = a[0].val(); S.R[p].s = a[1].val(); }, function () {});
    }));
    S.cfgLoaded = true; saveStatic(); render();
    if (due) {
      const led = (await withTimeout(db.ref("ledgers/restaurants").get(), 60000)).val() || {};
      const orph = [];
      Object.keys(led).forEach(function (p) {
        const d = Number((led[p] || {}).debt) || 0;
        if (!S.R[p] && d > 0) { orph.push(p); S.D[p] = d; }
      });
      S.orphans = orph; saveStatic(); lsSet(LS_BG, Date.now()); render();
    }
  } catch (_) { /* خلفيّة: تُعاد في الفتح القادم */ }
  finally { bgBusy = false; }
}

/* ════════════════════ الموقع ════════════════════ */
let geoAsked = false;
function startGeo() {
  if (geoAsked || !navigator.geolocation) return;
  geoAsked = true;
  navigator.geolocation.watchPosition(function (p) {
    const first = !S.me;
    S.me = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
    S.meAt = Date.now();
    if (first || S.opts.sort === "near" || S.opts.sort === "route" || S.tab === "map") render();
  }, function () { geoAsked = false; }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 });
}
function meFresh() { return (S.me && Date.now() - S.meAt < 5 * 60000) ? S.me : null; }
function distTo(p) {
  const r = S.R[p], me = meFresh();
  if (!r || !me || !K.geoOk(r.la, r.lo)) return null;
  return Math.round(K.hav(me.lat, me.lng, r.la, r.lo));
}

/* ════════════════════ الصفوف ════════════════════ */
function queued(kind, res, month) {
  return S.queue.find(function (q) { return q.kind === kind && q.res === res && (kind !== "sub" || q.month === month); });
}
function rows() {
  const keys = {}, out = [];
  Object.keys(S.D).forEach(function (p) { if (S.D[p] > 0) keys[p] = 1; });
  Object.keys(S.REQS).forEach(function (p) { if (K.reqState(S.REQS[p], S.RESETS[p]) !== "none") keys[p] = 1; });
  S.queue.forEach(function (q) { if (q.kind === "debt") keys[q.res] = 1; });
  Object.keys(keys).forEach(function (p) {
    const r = S.R[p] || {}, st = K.reqState(S.REQS[p], S.RESETS[p]), q = queued("debt", p);
    out.push({
      phone: p, name: r.n || "دفتر بلا مطعم (" + p + ")", area: r.a || "", zone: S.Z.of[p] || "_other",
      lat: r.la, lng: r.lo, debt: Number(S.D[p]) || 0,
      state: q ? "pending" : (st === "none" ? "open" : st), queued: !!q,
      since: K.tsMs(S.RESETS[p]), deleted: r.s === "deleted", orphan: !S.R[p], req: S.REQS[p] || null
    });
  });
  return out;
}
function entriesAll() {
  const have = {}, out = S.LOG.slice();
  out.forEach(function (e) { have[e.id] = 1; });
  S.queue.forEach(function (q) { if (!have[q.id]) out.push(Object.assign({ id: q.id }, q.log)); });
  return out;
}
function game() {
  const e = entriesAll();
  return K.gameState(e, K.logStates(e, S.REQS, S.RESETS, S.SUBS), today(), { zone: !!lsGet(LS_ZONE, 0) });
}

/* ════════════════════ العرض ════════════════════ */
let rafId = 0;
function render() {
  if (!S.ready) return;
  if (rafId) return;
  rafId = requestAnimationFrame(function () { rafId = 0; paint(); });
}
function paint() {
  const all = rows(), g = game();
  paintHud(all, g);
  if (S.tab === "list") paintList(all);
  else if (S.tab === "map") paintMap(all);
  else if (S.tab === "sub") paintSubs();
  else paintMe(g);
  const subLeft = subPool().filter(function (x) { return x.state === "open" || x.state === "rejected"; }).length;
  const nS = $("nSub"); nS.textContent = num(subLeft); nS.classList.toggle("dn", !subLeft || !S.cfgLoaded);
}
function paintHud(all, g) {
  const L = g.level;
  $("hIcon").textContent = L.icon; $("hLvl").textContent = L.n; $("hTitle").textContent = L.name + " · " + num(L.xp) + " نقطة";
  $("hXp").style.width = L.pct + "%"; $("hFire").textContent = "🔥 " + num(g.streak);
  $("dCount").textContent = num(g.today.count); $("dSum").textContent = num(g.today.sum);
  const open = all.filter(function (r) { return r.state === "open" || r.state === "rejected"; });
  $("dLeft").textContent = num(open.length);
}
function zoneStats(all) {
  const st = {};
  all.forEach(function (r) {
    const z = st[r.zone] || (st[r.zone] = { open: 0, wait: 0, sum: 0 });
    if (r.state === "open" || r.state === "rejected") { z.open++; z.sum += r.debt; } else z.wait++;
  });
  return st;
}
function stars(open, wait) {
  const t = open + wait, p = t ? wait / t : 0, n = p >= 1 ? 3 : (p >= 0.66 ? 2 : (p >= 0.33 ? 1 : 0));
  return "★".repeat(n) + "<u>" + "★".repeat(3 - n) + "</u>";
}
function zoneChipsHtml(all) {
  const st = zoneStats(all);
  const zs = S.Z.zones.filter(function (z) { return st[z.id]; })
    .sort(function (a, b) { return st[b.id].sum - st[a.id].sum; });
  const totalOpen = all.filter(function (r) { return r.state === "open" || r.state === "rejected"; }).length;
  let h = '<button class="isl' + (S.opts.zone ? "" : " on") + '" data-act="zone" data-v=""><b>🌊 كلّ البحر</b><span>' + num(totalOpen) + ' كنزاً</span><em>&nbsp;</em></button>';
  zs.forEach(function (z) {
    const s = st[z.id];
    h += '<button class="isl' + (S.opts.zone === z.id ? " on" : "") + '" data-act="zone" data-v="' + esc(z.id) + '"><b>🏝️ ' + esc(z.label) + '</b><span>' +
      num(s.open) + ' كنزاً · ' + num(s.sum) + '</span><em>' + stars(s.open, s.wait) + '</em></button>';
  });
  /* منطقةٌ اكتملت وللّيدر فيها ٣ استلامات اليوم ⇒ ملصق «جزيرة نظيفة» */
  if (!lsGet(LS_ZONE, 0)) {
    const mine = {};
    game().today.list.forEach(function (e) { const z = S.Z.of[e.res]; if (z) mine[z] = (mine[z] || 0) + 1; });
    if (Object.keys(st).some(function (z) { return st[z].open === 0 && (mine[z] || 0) >= 3; })) lsSet(LS_ZONE, 1);
  }
  return h;
}
function badge(r) {
  if (r.queued) return '<div class="bdg q">📡 يُرسَل…</div>';
  if (r.state === "approved") return '<div class="bdg a">✅ قبله المدير</div>';
  return '<div class="bdg p">⏳ بانتظار المدير</div>';
}
function contactBtns(phone, lat, lng) {
  let h = '<a class="ib" href="tel:0' + esc(phone) + '" aria-label="اتصال">📞</a>' +
          '<a class="ib" href="https://wa.me/964' + esc(phone) + '" target="_blank" rel="noopener" aria-label="واتساب">💬</a>';
  if (K.geoOk(lat, lng)) h += '<a class="ib" href="https://www.google.com/maps/dir/?api=1&destination=' + Number(lat) + ',' + Number(lng) + '" target="_blank" rel="noopener" aria-label="الطريق">🧭</a>';
  return h;
}
function cardHtml(r, now) {
  const t = K.tier(r.debt), wait = !(r.state === "open" || r.state === "rejected");
  const bits = [], qd = r.queued ? queued("debt", r.phone) : null;
  const got = qd ? qd.log.amount : (r.req && r.req.received != null ? Number(r.req.received) : null);
  if (r.area) bits.push("📍 " + esc(r.area));
  if (r.dist != null) bits.push("<u>" + K.fmtDist(r.dist) + "</u>");
  return '<article class="card t-' + t.id + (wait ? " s-wait" : "") + '">' +
    '<div class="ctop"><div class="cic">' + t.icon + (r.step ? "<i>" + r.step + "</i>" : "") + '</div>' +
    '<div class="cinf"><b>' + esc(r.name) + (r.deleted ? '<span class="tagx">محذوف</span>' : "") + (r.orphan ? '<span class="tagx">بلا ملفّ</span>' : "") + '</b>' +
    '<span>' + (bits.join(" · ") || "بلا منطقة") + '</span><span>' + esc(K.sinceLabel(r.since, now)) + '</span></div>' +
    '<div class="camt"><b class="num">' + num(r.debt) + '</b><span>د.ع</span></div></div>' +
    (r.state === "rejected" ? '<div class="rej">💀 رفض المدير طلبك السابق — تأكّد من المبلغ وأعد التسجيل</div>' : "") +
    (wait && got != null ? '<div class="got">🤝 استُلم <b class="num">' + num(got) + '</b> د.ع' + (r.req && r.req.byName && !r.queued ? " · " + esc(r.req.byName) : "") + '</div>' : "") +
    '<div class="cact">' + contactBtns(r.phone, r.lat, r.lng) +
    (wait ? badge(r) : '<button class="grab" data-act="grab" data-p="' + esc(r.phone) + '">💰 استلمت</button>') +
    '</div></article>';
}
function currentList(all) {
  const o = Object.assign({}, S.opts, { me: meFresh() });
  return K.filterSort(all, o);
}
function paintList(all) {
  $("zoneChips").innerHTML = zoneChipsHtml(all);
  const list = currentList(all), now = Date.now(), me = meFresh();
  const sum = list.reduce(function (s, r) { return s + r.debt; }, 0);
  let left = num(list.length) + " كنزاً";
  if (S.opts.sort === "route" && me && list.routeCount) left = "🧭 مسار " + num(list.routeCount) + " محطّة · ≈ " + K.fmtDist(list.routeTotal);
  $("sumL").textContent = left; $("sumR").textContent = num(sum) + " د.ع";
  if (!list.length) {
    const none = !all.length;
    $("cards").innerHTML = '<div class="empty"><div>' + (none ? "🏝️" : "🔍") + '</div><b>' + (none ? "البحر هادئ — لا ديون" : "لا كنز بهذه المواصفات") +
      '</b><p>' + (none ? "كلّ الدفاتر مصفّرة. عُد بعد أن تتراكم طلبات اليوم." : "جرّب منطقة أخرى، أو امسح البحث، أو اختر «الكل».") + '</p></div>';
  } else $("cards").innerHTML = list.slice(0, 400).map(function (r) { return cardHtml(r, now); }).join("");
  paintSay(all, me);
  const nL = $("nList"); nL.classList.add("dn");
}
function paintSay(all, me) {
  const open = all.filter(function (r) { return r.state === "open" || r.state === "rejected"; });
  let h;
  if (!open.length) h = "أحسنت! لم يبقَ كنزٌ في البحر 🎉";
  else if ((S.opts.sort === "near" || S.opts.sort === "route") && !me) h = "شغّل <b>الموقع</b> في هاتفك لأدلّك على أقرب كنز 📍";
  else if (me) {
    K.withDistance(open, me);
    const n = open.filter(function (r) { return r.dist != null; }).sort(function (a, b) { return a.dist - b.dist; })[0];
    h = n ? "أقرب كنز إليك: <b>" + esc(n.name) + "</b> على بعد <b>" + K.fmtDist(n.dist) + "</b> وفيه <b>" + num(n.debt) + "</b> د.ع" : "في البحر <b>" + num(open.length) + "</b> كنزاً بانتظارك";
  } else {
    const top = open.slice().sort(function (a, b) { return b.debt - a.debt; })[0];
    h = "في البحر <b>" + num(open.length) + "</b> كنزاً. أكبرها عند <b>" + esc(top.name) + "</b>: <b>" + num(top.debt) + "</b> د.ع";
  }
  if (S.debtsAt && Date.now() - S.debtsAt > 30 * 60000) h += "<br>⚠️ الأرقام من " + Math.round((Date.now() - S.debtsAt) / 60000) + " دقيقة — اضغط 🔄";
  $("say").innerHTML = h;
}

/* ── الخريطة ── */
function paintMap(all) {
  $("zoneChips2").innerHTML = zoneChipsHtml(all);
  const list = currentList(all).filter(function (r) { return K.geoOk(r.lat, r.lng); });
  const me = meFresh(), svg = $("map");
  if (!list.length) { svg.innerHTML = '<text x="500" y="500" text-anchor="middle" font-size="42" fill="#8a6d2a" font-family="Cairo">لا كنوز تُرسم هنا</text>'; return; }
  const Zm = S.zoom || 1, kz = 1 / Math.pow(Zm, 0.75);
  const cLat = list.reduce(function (s, r) { return s + Number(r.lat); }, 0) / list.length,
        cLng = list.reduce(function (s, r) { return s + Number(r.lng); }, 0) / list.length;
  const pts = list.map(function (r) { return { r: r, lat: Number(r.lat), lng: Number(r.lng) }; });
  const meIn = me && K.geoOk(me.lat, me.lng) && K.hav(me.lat, me.lng, cLat, cLng) < 7000;
  if (meIn) pts.push({ me: true, lat: me.lat, lng: me.lng });
  /* المقياس بالمئينات: مطعمٌ شاذّ بعيد لا يُصغّر المشهد كلّه — يُقصّ على الحافة */
  const qt = function (arr, q) { const a = arr.slice().sort(function (x, y) { return x - y; }); return a[Math.min(a.length - 1, Math.max(0, Math.round(q * (a.length - 1))))]; };
  const cut = pts.length >= 12 ? 0.04 : 0, lats = pts.map(function (p) { return p.lat; }), lngs = pts.map(function (p) { return p.lng; });
  const la0 = qt(lats, cut), la1 = qt(lats, 1 - cut), lo0 = qt(lngs, cut), lo1 = qt(lngs, 1 - cut);
  const clamp = function (v) { return Math.max(24, Math.min(976, v)); };
  const kx = Math.cos(cLat * Math.PI / 180), w = Math.max((lo1 - lo0) * kx, 0.002), hh = Math.max(la1 - la0, 0.002);
  const sc = 860 / Math.max(w, hh), ox = (1000 - w * sc) / 2, oy = (1000 - hh * sc) / 2;
  const X = function (lng) { return clamp(ox + (lng - lo0) * kx * sc); }, Y = function (lat) { return clamp(1000 - (oy + (lat - la0) * sc)); };
  let h = '<defs><pattern id="wv" width="90" height="46" patternUnits="userSpaceOnUse"><path d="M0 30 q22 -16 45 0 t45 0" fill="none" stroke="#c9ad62" stroke-width="2" opacity=".35"/></pattern></defs>' +
          '<rect width="1000" height="1000" fill="url(#wv)"/>';
  /* أسماء المناطق عند مراكزها */
  const seen = {};
  list.forEach(function (r) { seen[r.zone] = 1; });
  const zst = zoneStats(all);
  const named = S.Z.zones.filter(function (z) { return seen[z.id] && z.lat != null; })
    .sort(function (a, b) { return (zst[b.id] ? zst[b.id].sum : 0) - (zst[a.id] ? zst[a.id].sum : 0); }).slice(0, Zm >= 2 || S.opts.zone ? 40 : 7);
  named.forEach(function (z) {
    h += '<text x="' + X(z.lng).toFixed(0) + '" y="' + (Y(z.lat) - 40 * kz).toFixed(0) + '" text-anchor="middle" font-size="' + (30 * kz).toFixed(0) + '" font-weight="900" stroke="#fdf3d7" stroke-width="' + (6 * kz).toFixed(1) + '" paint-order="stroke" fill="#7a5a12" opacity=".7" font-family="Cairo">' + esc(z.label) + '</text>';
  });
  if (S.opts.sort === "route" && meIn) {
    const path = [[X(me.lng), Y(me.lat)]].concat(list.filter(function (r) { return r.step; }).map(function (r) { return [X(Number(r.lng)), Y(Number(r.lat))]; }));
    h += '<polyline points="' + path.map(function (p) { return p[0].toFixed(0) + "," + p[1].toFixed(0); }).join(" ") + '" fill="none" stroke="#b3261e" stroke-width="' + (6 * kz).toFixed(1) + '" stroke-dasharray="' + (16 * kz).toFixed(0) + ' ' + (14 * kz).toFixed(0) + '" stroke-linecap="round" opacity=".8"/>';
  }
  list.slice().sort(function (a, b) { return a.debt - b.debt; }).forEach(function (r) {
    const t = K.tier(r.debt), wait = !(r.state === "open" || r.state === "rejected");
    const rad = (t.id === "boss" ? 34 : (t.id === "gem" ? 28 : (t.id === "chest" ? 23 : 18))) * kz;
    const x = X(Number(r.lng)).toFixed(0), y = Y(Number(r.lat)).toFixed(0);
    h += '<g data-act="grab" data-p="' + esc(r.phone) + '" opacity="' + (wait ? ".4" : "1") + '"><circle cx="' + x + '" cy="' + y + '" r="' + rad + '" fill="' + (wait ? "#cfc7b0" : "#fff8e1") + '" stroke="' +
      (t.id === "boss" ? "#7a5af8" : (t.id === "gem" ? "#11b5a4" : "#d99a00")) + '" stroke-width="' + (5 * kz).toFixed(1) + '"/>' +
      '<text x="' + x + '" y="' + (Number(y) + rad * 0.38).toFixed(0) + '" text-anchor="middle" font-size="' + (rad * 1.05).toFixed(0) + '">' + t.icon + '</text>' +
      (r.step ? '<text x="' + (Number(x) + rad).toFixed(0) + '" y="' + (Number(y) - rad + 8 * kz).toFixed(0) + '" text-anchor="middle" font-size="' + (26 * kz).toFixed(0) + '" font-weight="900" fill="#b3261e" font-family="Cairo">' + r.step + '</text>' : "") + '</g>';
  });
  if (meIn) h += '<circle cx="' + X(me.lng).toFixed(0) + '" cy="' + Y(me.lat).toFixed(0) + '" r="' + (44 * kz).toFixed(0) + '" fill="#2a8cff" opacity=".18"/><text x="' + X(me.lng).toFixed(0) + '" y="' + (Y(me.lat) + 20 * kz).toFixed(0) + '" text-anchor="middle" font-size="' + (58 * kz).toFixed(0) + '">🐋</text>';
  svg.innerHTML = h;
  /* التكبير: اللوحة تتّسع داخل إطارٍ يُمرَّر باللمس، وتتمركز على موقعي (أو على الوسط) */
  const box = $("mapScroll");
  if (S.zoomDirty) {
    S.zoomDirty = false;
    svg.style.width = (Zm * 100) + "%";
    const fx = meIn ? X(me.lng) / 1000 : 0.5, fy = meIn ? Y(me.lat) / 1000 : 0.5, W = box.clientWidth * Zm;
    box.scrollLeft = fx * W - box.clientWidth / 2; box.scrollTop = fy * W - box.clientHeight / 2;
  }
  $("zoomLbl").textContent = "×" + Zm;
  $("sayMap").innerHTML = "على الخريطة <b>" + num(list.length) + "</b> كنزاً" + (S.opts.zone ? "" : " — اختر منطقة لتقريبها") + (meIn ? "" : " · موقعك غير ظاهر");
}

/* ── الاشتراكات ── */
function subPool() {
  const done = S.SUBS[S.month] || {}, out = [];
  Object.keys(S.R).forEach(function (p) {
    const r = S.R[p], amt = K.monthlySubAmount(r.c);
    if (amt === null || r.s === "deleted") return;
    const rec = done[p] || null, q = queued("sub", p, S.month);
    const st = q ? "pending" : (!rec ? "open" : (rec.status === "approved" ? "approved" : (rec.status === "rejected" ? "rejected" : "pending")));
    out.push({ phone: p, name: r.n || p, area: r.a || "", lat: r.la, lng: r.lo, amount: amt, rec: rec, state: st, queued: !!q });
  });
  return out;
}
function paintSubs() {
  $("monSeg").innerHTML = [0, -1].map(function (off) {
    const m = K.monthKey(Date.now(), off);
    return '<button class="' + (S.monthOff === off ? "on" : "") + '" data-act="month" data-v="' + off + '">' + esc(K.monthLabel(m)) + '</button>';
  }).join("");
  if (!S.cfgLoaded) { $("subCards").innerHTML = '<div class="skel"></div><div class="skel"></div>'; $("subL").textContent = "يحمّل قواعد الاشتراك…"; $("subR").textContent = ""; background(true); return; }
  const me = meFresh();
  let list = subPool().filter(function (r) { return K.matchQuery(r, S.qs); });
  if (me) K.withDistance(list, me);
  const rank = function (s) { return s === "open" || s === "rejected" ? 0 : 1; };
  list.sort(function (a, b) { return rank(a.state) - rank(b.state) || b.amount - a.amount; });
  const open = list.filter(function (r) { return rank(r.state) === 0; });
  $("subL").textContent = "باقٍ " + num(open.length) + " من " + num(list.length);
  $("subR").textContent = num(open.reduce(function (s, r) { return s + r.amount; }, 0)) + " د.ع";
  if (!list.length) { $("subCards").innerHTML = '<div class="empty"><div>🎟️</div><b>لا مطاعم اشتراك</b><p>لا مطعم قاعدته «شهري» يطابق بحثك.</p></div>'; return; }
  $("subCards").innerHTML = list.map(function (r) {
    const wait = rank(r.state) === 1, shown = r.rec && wait ? (Number(r.rec.amount) || 0) : r.amount;
    return '<article class="card t-boss' + (wait ? " s-wait" : "") + '"><div class="ctop"><div class="cic">🎟️</div>' +
      '<div class="cinf"><b>' + esc(r.name) + '</b><span>' + (r.area ? "📍 " + esc(r.area) : "بلا منطقة") + (r.dist != null ? " · <u>" + K.fmtDist(r.dist) + "</u>" : "") + '</span>' +
      '<span>' + (r.amount > 0 ? "اشتراك " + esc(K.monthLabel(S.month)) : "بلا مبلغٍ معلن") + '</span></div>' +
      '<div class="camt"><b class="num">' + num(shown) + '</b><span>د.ع</span></div></div>' +
      (r.state === "rejected" ? '<div class="rej">💀 رفض المدير تسجيلك السابق — صحّح وأعد التسجيل</div>' : "") +
      '<div class="cact">' + contactBtns(r.phone, r.lat, r.lng) +
      (wait ? (r.queued ? '<div class="bdg q">📡 يُرسَل…</div>' : (r.state === "approved" ? '<div class="bdg a">✅ أكّده المدير</div>' : '<div class="bdg p">⏳ بانتظار المدير</div>'))
            : '<button class="grab v" data-act="grabSub" data-p="' + esc(r.phone) + '">🎟️ استلمت الاشتراك</button>') +
      '</div></article>';
  }).join("");
}

/* ── إنجازاتي ── */
function paintMe(g) {
  const L = g.level;
  $("mIcon").textContent = L.icon; $("mTitle").textContent = L.name; $("mSub").textContent = "المستوى " + num(L.n) + " · " + num(g.count) + " كنزاً مفتوحاً";
  $("mXp").style.width = L.pct + "%";
  $("mNext").textContent = L.next == null ? "بلغتَ القمّة 👑" : "بقي " + num(L.next - L.xp) + " نقطة للمستوى التالي: " + K.LEVELS[L.n].icon + " " + K.LEVELS[L.n].name;
  $("gOk").textContent = num(g.confirmed); $("gWait").textContent = num(g.pending); $("gNo").textContent = num(g.rejected);
  $("quests").innerHTML = g.quests.map(function (q) {
    return '<div class="quest' + (q.done ? " done" : "") + '"><span class="qi">' + (q.done ? "✅" : q.icon) + '</span><div class="qm"><b>' + esc(q.name) +
      '</b><div class="bar"><i style="width:' + Math.round(q.value / q.target * 100) + '%"></i></div></div><span class="qv">' + num(q.value) + " / " + num(q.target) + '</span></div>';
  }).join("");
  const has = g.stickers.filter(function (s) { return s.has; }).length;
  $("stkN").textContent = "(" + num(has) + " من " + num(g.stickers.length) + ")";
  $("stickers").innerHTML = g.stickers.map(function (s) {
    return '<div class="' + (s.has ? "has" : "off") + '" data-act="stk" data-v="' + esc(s.hint) + '"><span>' + s.icon + '</span><b>' + esc(s.name) + '</b></div>';
  }).join("");
  const tl = g.today.list.slice().reverse();
  $("todayList").innerHTML = tl.length ? tl.map(function (e) {
    const d = new Date(K.tsMs(e.ts) + 3 * 3600000);
    return '<div><em>' + String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0") + '</em><span>' + (e.kind === "sub" ? "🎟️ " : "💰 ") + esc(e.name) +
      '</span><b class="num">' + num(e.amount) + '</b></div>';
  }).join("") : '<div><span style="color:var(--ink3)">لم تفتح كنزاً اليوم بعد — هيّا! ⚓</span></div>';
}
function reportData() {
  const g = game();
  return { day: today(), by: S.name, sum: g.today.sum, list: g.today.list };
}

/* ════════════════════ ورقة الاستلام ════════════════════ */
function closeSheet() { $("shade").classList.remove("on"); $("sheet").innerHTML = ""; S.sheet = null; cancelHold(); }
function geoLine(p) {
  const d = distTo(p);
  if (d == null) return '<div class="geo na">📍 موقعك غير معروف الآن — سيُسجَّل الاستلام بلا موقع</div>';
  if (d <= K.ONSITE_M) return '<div class="geo ok">📍 أنت عند المطعم (' + K.fmtDist(d) + ') — مكافأة «في الموقع» ✓</div>';
  return '<div class="geo far">📍 أنت على بعد ' + K.fmtDist(d) + ' عن المطعم — يُسجَّل ذلك مع الطلب</div>';
}
function sheetHead(icon, cls, name, sub) {
  return '<div class="grip"></div><div class="sh-h ' + cls + '"><div class="cic">' + icon + '</div><div><b>' + esc(name) + '</b><span>' + sub + '</span></div></div>';
}
function openGrab(p) {
  const r = S.R[p] || {}, name = r.n || "دفتر بلا مطعم (" + p + ")", shown = Number(S.D[p]) || 0;
  if (!K.canSubmit(S.REQS[p], S.RESETS[p]) || queued("debt", p)) { sfx.err(); return toast("لهذا المطعم طلبٌ قائم بانتظار المدير", "w"); }
  const t = K.tier(shown);
  S.sheet = { kind: "debt", p: p, name: name, live: null, orders: 0, shown: shown };
  $("sheet").innerHTML = sheetHead(t.icon, "t-" + t.id, name, (r.a ? "📍 " + esc(r.a) + " · " : "") + esc(K.sinceLabel(K.tsMs(S.RESETS[p]), Date.now()))) +
    '<div class="acts"><a href="tel:0' + esc(p) + '"><span>📞</span>اتصال</a><a href="https://wa.me/964' + esc(p) + '" target="_blank" rel="noopener"><span>💬</span>واتساب</a>' +
    (K.geoOk(r.la, r.lo) ? '<a href="https://www.google.com/maps/dir/?api=1&destination=' + r.la + ',' + r.lo + '" target="_blank" rel="noopener"><span>🧭</span>الطريق</a>' : "") + '</div>' +
    '<div class="live"><span>دين المطعم الآن</span><b class="num" id="shLive">يتحقّق…</b></div><div id="shWarn"></div>' + geoLine(p) +
    '<label for="shAmt">كم استلمتَ؟ (د.ع)</label><div class="amt"><input id="shAmt" inputmode="numeric" autocomplete="off" value="' + Math.round(shown) + '">' +
    '<button data-act="amtFull">الكلّ</button><button data-act="amtHalf">النصف</button></div><div class="rem" id="shRem"></div>' +
    '<textarea id="shNote" maxlength="300" placeholder="ملاحظة للمدير (اختيارية)"></textarea>' +
    '<button class="hold" id="shHold" disabled><i></i><span>🗝️ اضغط مطوّلاً لفتح الكنز</span></button>' +
    '<div class="holdtip">الضغط المطوّل يمنع التسجيل بالخطأ · الطلب يذهب إلى المدير وهو من يُصفّر الدفتر</div>';
  $("shade").classList.add("on");
  /* 🔒 الدين الحيّ لحظة الاستلام — لا رقم اللقطة. فإن أرشف المحرّك طلباتٍ منذ آخر تحديث رآها الليدر الآن. */
  Promise.all([
    withTimeout(db.ref("ledgers/restaurants/" + p + "/debt").get(), 7000),
    withTimeout(db.ref("ledgers/restaurants/" + p + "/completed_orders").get(), 7000)
  ]).then(function (a) {
    if (!S.sheet || S.sheet.p !== p) return;
    const live = Number(a[0].val()) || 0;
    S.sheet.live = live; S.sheet.orders = Number(a[1].val()) || 0; S.D[p] = live;
    if (live <= 0) { closeSheet(); toast("هذا المطعم صُفِّر دينه للتوّ", "w"); render(); return; }
    $("shLive").textContent = num(live) + " د.ع";
    if (Math.round(live) !== Math.round(shown)) {
      $("shWarn").innerHTML = '<div class="warn">⚠️ تغيّر الدين منذ آخر تحديث: كان ' + num(shown) + ' وصار ' + num(live) + ' د.ع</div>';
      $("shAmt").value = Math.round(live);
    }
    $("shHold").disabled = false; checkAmt();
  }, function () {
    if (!S.sheet || S.sheet.p !== p) return;
    S.sheet.live = shown;
    $("shLive").textContent = num(shown) + " د.ع";
    $("shWarn").innerHTML = '<div class="warn">⚠️ تعذّر التحقّق من الدين الآن (لا اتصال). الرقم من آخر تحديث — وسيُرسَل تسجيلك حين يعود الاتصال.</div>';
    $("shHold").disabled = false; checkAmt();
  });
}
function checkAmt() {
  const sh = S.sheet; if (!sh || sh.kind === "printer") return null;
  const el = $("shAmt"), rem = $("shRem");
  if (sh.kind === "sub") {
    const r = K.parseAmount(el.value);
    if (!r.ok || r.value <= 0) { rem.className = "rem bad"; rem.textContent = "اكتب المبلغ الذي استلمتَه"; return null; }
    rem.className = "rem";
    rem.textContent = sh.declared > 0 && r.value !== sh.declared ? (r.value < sh.declared ? "أقلّ من الاشتراك المعلن (" + num(sh.declared) + ") — اكتب السبب في الملاحظة" : "أكثر من الاشتراك المعلن (" + num(sh.declared) + ")") : "";
    return { value: r.value };
  }
  if (sh.live == null) return null;
  const c = K.checkReceived(el.value, sh.live);
  if (!c.ok) { rem.className = "rem bad"; rem.textContent = c.msg; return null; }
  rem.className = "rem";
  rem.textContent = c.full ? "✓ استلام كامل — يُصفَّر الدين" : "استلام جزئي — يبقى على المطعم " + num(sh.live - c.value) + " د.ع";
  return c;
}
function openGrabSub(p) {
  const r = S.R[p] || {}, name = r.n || p, declared = K.monthlySubAmount(r.c) || 0, rec = (S.SUBS[S.month] || {})[p];
  if ((rec && rec.status !== "rejected") || queued("sub", p, S.month)) { sfx.err(); return toast("سُجّل استلام هذا الاشتراك من قبل", "w"); }
  S.sheet = { kind: "sub", p: p, name: name, declared: declared, month: S.month };
  $("sheet").innerHTML = sheetHead("🎟️", "t-boss", name, "اشتراك " + esc(K.monthLabel(S.month)) + (declared ? " · المعلن " + num(declared) + " د.ع" : "")) + geoLine(p) +
    '<label for="shAmt">كم استلمتَ؟ (د.ع)</label><div class="amt"><input id="shAmt" inputmode="numeric" autocomplete="off" value="' + (declared || "") + '">' +
    (declared ? '<button data-act="amtFull">الكلّ</button><button data-act="amtHalf">النصف</button>' : "") + '</div><div class="rem" id="shRem"></div>' +
    '<textarea id="shNote" maxlength="300" placeholder="ملاحظة (مثل: نصف اشتراك — عمل نصف الشهر)"></textarea>' +
    '<button class="hold v" id="shHold"><i></i><span>🎟️ اضغط مطوّلاً لتسجيل الاستلام</span></button>' +
    '<div class="holdtip">هذا توثيقٌ لما قبضتَه — لا يُصفَّر شيء في الدفتر</div>';
  $("shade").classList.add("on"); checkAmt();
}

/* ── الضغط المطوّل ── */
let holdT = 0, holdStart = 0, holdRaf = 0;
function cancelHold() {
  if (holdT) clearTimeout(holdT); holdT = 0;
  if (holdRaf) cancelAnimationFrame(holdRaf); holdRaf = 0;
  const b = $("shHold"); if (b) b.firstChild.style.width = "0";
}
function startHold() {
  const b = $("shHold");
  if (!b || b.disabled || holdT) return;
  if (!checkAmt()) { sfx.err(); buzz(60); return; }
  holdStart = performance.now(); sfx.tick();
  const step = function (now) {
    const p = Math.min(1, (now - holdStart) / HOLD_MS);
    b.firstChild.style.width = (p * 100) + "%";
    if (p < 1) holdRaf = requestAnimationFrame(step);
  };
  holdRaf = requestAnimationFrame(step);
  holdT = setTimeout(function () { holdT = 0; buzz(30); submit(); }, HOLD_MS);
}
document.addEventListener("pointerdown", function (e) { if (e.target.closest && e.target.closest("#shHold")) { e.preventDefault(); startHold(); } });
["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) {
  document.addEventListener(ev, function (e) { if (holdT && (ev !== "pointerleave" || e.target.id === "shHold")) cancelHold(); }, true);
});
document.addEventListener("contextmenu", function (e) { if (e.target.closest && e.target.closest("#shHold")) e.preventDefault(); });

/* ════════════════════ التسجيل والطابور ════════════════════ */
function submit() {
  const sh = S.sheet; if (!sh) return;
  const c = checkAmt(); if (!c) { sfx.err(); return; }
  const note = String(($("shNote") || {}).value || "").slice(0, 300), ts = new Date().toISOString();
  const id = db.ref("collector_log/" + S.uid).push().key, d = distTo(sh.p), before = game();
  const upd = {}; let log;
  if (sh.kind === "debt") {
    /* إعادة فحص: ربّما رفع زميلٌ طلباً لهذا المطعم وأنا في الورقة */
    if (!K.canSubmit(S.REQS[sh.p], S.RESETS[sh.p])) { closeSheet(); sfx.err(); return toast("سبقك زميلٌ إلى هذا المطعم — طلبه قائم", "w"); }
    const received = c.full ? sh.live : c.value;      /* «الكلّ» يحمل الدين بكسوره كي يُصفَّر تماماً */
    /* phone · by · ts · status تشترطها قاعدة .validate — لا تحذف أياً منها. */
    const req = { phone: sh.p, by: S.phone, ts: ts, status: "pending", name: sh.name.slice(0, 120), byName: S.name.slice(0, 80),
      debt_at_request: sh.live, received: received, orders_at_request: sh.orders || 0, note: note, src: "kanz" };
    log = { res: sh.p, name: sh.name.slice(0, 120), amount: received, debt: sh.live, kind: "debt", ts: ts };
    if (d != null) { req.dist_m = d; log.dist_m = d; }
    upd["clearing_requests/" + sh.p] = req;
  } else {
    const rec = { phone: sh.p, by: S.phone, ts: ts, status: "pending", month: sh.month, amount: c.value, declared: sh.declared,
      name: sh.name.slice(0, 120), byName: S.name.slice(0, 80), note: note, src: "kanz" };
    log = { res: sh.p, name: sh.name.slice(0, 120), amount: c.value, kind: "sub", month: sh.month, ts: ts };
    if (d != null) { rec.dist_m = d; log.dist_m = d; }
    upd["sub_collections/" + sh.month + "/" + sh.p] = rec;
  }
  upd["collector_log/" + S.uid + "/" + id] = log;
  /* 💾 يُحفظ قبل الإرسال: إغلاق التطبيق أو انقطاع الشبكة لا يُضيّعان التسجيل. */
  S.queue.push({ id: id, kind: sh.kind, res: sh.p, month: sh.month || null, upd: upd, log: log });
  if (!lsSet(qKey(), S.queue)) toast("تعذّر الحفظ في ذاكرة الهاتف — لا تُغلق التطبيق قبل الإرسال", "w");
  const info = { name: sh.name, amount: log.amount, p: sh.p, kind: sh.kind, remaining: sh.kind === "debt" ? Math.max(0, Math.round(sh.live - log.amount)) : 0, xp: K.xpFor(log) };
  info.month = sh.month || null; info.by = S.name; info.when = nowStamp().d; info.time = nowStamp().t;
  lastReceipt = info;
  closeSheet();
  celebrate(info, before);
  render(); flush();
  /* 🖨️ الطباعة التلقائية: صامتةٌ إن لم تُختَر طابعة — لا تعطّل الاستلام أبداً */
  if (NATIVE && lsGet(LS_AUTOPRINT, true)) printReceipt(info, true);
}
const inFlight = {};
function dropQ(id) { S.queue = S.queue.filter(function (q) { return q.id !== id; }); lsSet(qKey(), S.queue); render(); }
function flush() {
  S.queue.forEach(function (q) {
    if (inFlight[q.id]) return;
    inFlight[q.id] = 1;
    db.ref().update(q.upd).then(function () { delete inFlight[q.id]; dropQ(q.id); }, function (e) {
      delete inFlight[q.id];
      if (!/permission|denied/i.test(String(e && e.message))) return;       /* شبكة: يبقى في الطابور */
      /* رفضٌ من القواعد: إمّا وصل في محاولةٍ سابقة (السجلّ موجود) وإمّا رفضٌ حقيقي */
      db.ref("collector_log/" + S.uid + "/" + q.id).get().then(function (s) {
        if (s.exists()) return dropQ(q.id);
        dropQ(q.id); sfx.err();
        toast("لم يُقبل تسجيل «" + q.log.name + "» — ربّما سبقك زميل. أعد المحاولة.", "e");
      }, function () {});
    });
  });
}

/* ════════════════════ الطابعة ════════════════════
   الجسر (KanzNative) موجودٌ داخل تطبيق الأندرويد فقط. في المتصفّح تُعرض المعاينة بلا طباعة.
   الأحداث تعود من الأصل عبر CustomEvent('kanz-printer', {detail:{type,msg,name}}). */
const NATIVE = (typeof window.KanzNative !== "undefined") ? window.KanzNative : null;
let lastReceipt = null;
function prStatus() {
  if (!NATIVE) return { native: false, connected: false, name: "", addr: "" };
  try { return Object.assign({ native: true }, JSON.parse(NATIVE.printerStatus() || "{}")); } catch (_) { return { native: true, connected: false, name: "", addr: "" }; }
}
function paintPrBtn() {
  const st = prStatus(), b = $("prBtn");
  b.classList.toggle("ok", !!st.connected);
  b.classList.toggle("sel", !st.connected && !!st.addr);
}
function receiptCanvas(o) {
  const W = K.PRINT_W, L = K.receiptLines(o), PAD = 14;
  const m = document.createElement("canvas").getContext("2d");
  const font = function (l) { return (l.b ? "900 " : "700 ") + l.s + "px Cairo, sans-serif"; };
  /* القياس أوّلاً: الاسم الطويل يلتفّ على سطرين فأكثر */
  const rows = [];
  L.forEach(function (l) {
    if (l.rule) return rows.push({ rule: 1, h: 26 });
    if (l.gap) return rows.push({ h: l.gap });
    m.font = font(l);
    let parts = [String(l.t || "")];
    if (l.wrap && m.measureText(parts[0]).width > W - 2 * PAD) {
      const words = parts[0].split(" "); parts = []; let cur = "";
      words.forEach(function (w) {
        const t = cur ? cur + " " + w : w;
        if (m.measureText(t).width > W - 2 * PAD && cur) { parts.push(cur); cur = w; } else cur = t;
      });
      if (cur) parts.push(cur);
    }
    parts.slice(0, 3).forEach(function (t) { rows.push({ t: t, font: font(l), h: Math.round(l.s * 1.5) }); });
  });
  const H = rows.reduce(function (a, r) { return a + r.h; }, 0) + 2 * PAD;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const x = cv.getContext("2d");
  x.fillStyle = "#fff"; x.fillRect(0, 0, W, H);
  x.fillStyle = "#000"; x.textAlign = "center"; x.textBaseline = "middle"; x.direction = "rtl";
  let y = PAD;
  rows.forEach(function (r) {
    if (r.rule) { x.fillRect(PAD, y + r.h / 2 - 1, W - 2 * PAD, 3); }
    else if (r.t) { x.font = r.font; x.fillText(r.t, W / 2, y + r.h / 2, W - 2 * PAD); }
    y += r.h;
  });
  return cv;
}
function printReceipt(o, silent) {
  if (!NATIVE) { if (!silent) toast("الطباعة تعمل داخل تطبيق الأندرويد فقط", "w"); return false; }
  const st = prStatus();
  if (!st.addr) { if (!silent) { toast("اختر الطابعة أوّلاً من زرّ 🖨️", "w"); openPrinter(); } return false; }
  try {
    const cv = receiptCanvas(o), d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height);
    const bytes = K.rasterEscPos(cv.width, cv.height, d.data, 4);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.slice(i, i + 8192));
    NATIVE.printerPrint(btoa(bin));
    return true;
  } catch (_) { toast("تعذّر تجهيز الوصل للطباعة", "e"); return false; }
}
function nowStamp() {
  const n = new Date();
  return { d: n.toLocaleDateString("en-GB", { timeZone: "Asia/Baghdad", day: "2-digit", month: "2-digit", year: "numeric" }),
           t: n.toLocaleTimeString("en-GB", { timeZone: "Asia/Baghdad", hour: "2-digit", minute: "2-digit" }) };
}
function sampleReceipt() {
  return { kind: "debt", name: "مطعم تجريبي — وصل اختبار", amount: 25000, remaining: 5000, by: S.name, when: nowStamp().d, time: nowStamp().t };
}
function openPrinter() {
  const st = prStatus(), auto = lsGet(LS_AUTOPRINT, true);
  let h = sheetHead("🖨️", "t-chest", "الطابعة الفورية", st.connected ? "متّصلة: " + esc(st.name || st.addr) : (st.addr ? "محفوظة وغير متّصلة: " + esc(st.name || st.addr) : "لم تُختَر طابعة بعد"));
  if (!NATIVE) h += '<div class="warn">الطباعة تعمل داخل تطبيق الأندرويد فقط. هذه معاينةٌ لشكل الوصل:</div>';
  else {
    let list = [];
    try { list = JSON.parse(NATIVE.printerList() || "[]"); } catch (_) { list = []; }
    if (list && list.perm) h += '<div class="warn">اسمح للتطبيق بإذن «الأجهزة القريبة» (البلوتوث) ثم افتح هذه النافذة من جديد.</div>';
    else if (list && list.off) h += '<div class="warn">البلوتوث مُطفأ — شغّله من الهاتف ثم افتح هذه النافذة من جديد.</div>';
    else if (!list.length) h += '<div class="warn">لا طابعة مقترنة. من إعدادات الهاتف ← البلوتوث: شغّل الطابعة واقترن بها (الرمز عادةً 0000 أو 1234)، ثم عُد إلى هنا.</div>';
    else {
      h += '<label>اختر طابعتك من الأجهزة المقترنة</label><div class="prlist">' + list.map(function (d) {
        return '<button data-act="prPick" data-v="' + esc(d.addr) + '" class="' + (d.addr === st.addr ? "on" : "") + '"><b>' + esc(d.name || "جهاز بلا اسم") + '</b><span>' + esc(d.addr) + (d.addr === st.addr ? (st.connected ? " · متّصلة ✓" : " · محفوظة") : "") + '</span></button>';
      }).join("") + '</div>';
    }
    h += '<button class="btn2" data-act="prAuto">' + (auto ? "✅ الطباعة التلقائية بعد كلّ استلام: مفعّلة" : "⬜ الطباعة التلقائية بعد كلّ استلام: متوقّفة") + '</button>' +
         '<button class="btn2" data-act="prTest">🧾 اطبع وصلاً تجريبياً</button>' +
         (st.addr ? '<button class="btn2 red" data-act="prForget">انسَ هذه الطابعة</button>' : "");
  }
  h += '<div class="prev" id="prPrev"></div>';
  $("sheet").innerHTML = h; $("shade").classList.add("on");
  S.sheet = { kind: "printer" };
  const show = function () { const p = $("prPrev"); if (p) { p.innerHTML = ""; p.appendChild(receiptCanvas(lastReceipt || sampleReceipt())); } };
  if (document.fonts && document.fonts.load) document.fonts.load("900 40px Cairo").then(show, show); else show();
}
window.addEventListener("kanz-printer", function (e) {
  const d = (e && e.detail) || {};
  if (d.type === "connected") { toast("🖨️ اتّصلت الطابعة: " + (d.name || ""), "g"); sfx.coin(); }
  else if (d.type === "failed") { toast("تعذّر الاتصال بالطابعة — تأكّد أنّها مشغّلة وقريبة", "e"); sfx.err(); }
  else if (d.type === "printed") toast("🧾 طُبع الوصل", "g");
  else if (d.type === "printfail") { toast("لم يُطبع الوصل — تحقّق من الطابعة ثم اضغط «أعد الطباعة»", "e"); sfx.err(); }
  paintPrBtn();
  if (S.sheet && S.sheet.kind === "printer" && d.type !== "printed") openPrinter();
});

/* ════════════════════ الاحتفال ════════════════════ */
function celebrate(info, before) {
  const after = game(), newS = after.stickers.filter(function (s, i) { return s.has && !before.stickers[i].has; });
  const up = after.level.n > before.level.n;
  const qDone = after.quests.filter(function (q, i) { return q.done && !before.quests[i].done; });
  /* التالي: أقرب كنزٍ مفتوح، وإلا الأعلى في المنطقة نفسها */
  let next = null;
  if (info.kind === "debt") {
    const open = rows().filter(function (r) { return (r.state === "open" || r.state === "rejected") && r.phone !== info.p; });
    const me = meFresh();
    if (me) { K.withDistance(open, me); next = open.filter(function (r) { return r.dist != null; }).sort(function (a, b) { return a.dist - b.dist; })[0] || null; }
    if (!next) { const z = S.Z.of[info.p]; next = open.filter(function (r) { return r.zone === z; }).sort(function (a, b) { return b.debt - a.debt; })[0] || open.sort(function (a, b) { return b.debt - a.debt; })[0] || null; }
  }
  const when = new Date().toLocaleString("ar-IQ", { timeZone: "Asia/Baghdad", dateStyle: "medium", timeStyle: "short" });
  const txt = K.receiptText({ name: info.name, amount: info.amount, remaining: info.remaining, when: when, by: S.name });
  let h = '<div class="chest">' + (info.kind === "sub" ? "🎟️" : K.tier(info.amount).icon) + '</div>' +
    '<h2>' + (info.kind === "sub" ? "سُجّل الاشتراك!" : "فُتح الكنز!") + '</h2><div class="wamt num">' + num(info.amount) + ' د.ع</div><div class="wnm">' + esc(info.name) + '</div>' +
    '<div class="wxp">+' + num(info.xp) + ' نقطة ⭐</div><div class="wnew">';
  if (up) h += '<div class="lv">' + after.level.icon + ' مستوى جديد: ' + esc(after.level.name) + '</div>';
  qDone.forEach(function (q) { h += '<div class="lv">🎯 أُنجزت مهمّة: ' + esc(q.name) + '</div>'; });
  newS.forEach(function (s) { h += '<div>' + s.icon + ' ملصق جديد: ' + esc(s.name) + '</div>'; });
  h += '</div><div class="wbtns">';
  if (next) h += '<button class="gbtn" data-act="next" data-p="' + esc(next.phone) + '">➡️ التالي: ' + esc(next.name) + (next.dist != null ? " (" + K.fmtDist(next.dist) + ")" : "") + '</button>';
  if (NATIVE) h += '<button class="ghost" data-act="reprint">🖨️ ' + (lsGet(LS_AUTOPRINT, true) && prStatus().addr ? "أعد طباعة الوصل" : "اطبع الوصل") + '</button>';
  h += '<a class="ghost" href="https://wa.me/964' + esc(info.p) + '?text=' + encodeURIComponent(txt) + '" target="_blank" rel="noopener">🧾 أرسل وصلاً للمطعم بواتساب</a>' +
       '<button class="ghost" data-act="closeWin">تمّ</button></div>';
  $("wbox").innerHTML = h; $("win").classList.add("on");
  sfx.open(); if (newS.length || qDone.length) sfx.sticker(); if (up) sfx.level();
  buzz([0, 950, 60, 60, 120]); coinRain(2600);
}

/* ════════════════════ الأحداث ════════════════════ */
function setChips(boxId, act, v) {
  $(boxId).querySelectorAll('[data-act="' + act + '"]').forEach(function (b) { b.classList.toggle("on", b.dataset.v === String(v)); });
}
function goTab(t) {
  S.tab = t;
  document.querySelectorAll(".view").forEach(function (v) { v.classList.toggle("on", v.id === "v-" + t); });
  document.querySelectorAll("nav button").forEach(function (b) { b.classList.toggle("on", b.dataset.v === t); });
  $("main").scrollTop = 0; render();
}
function copyText(t) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t);
  return new Promise(function (res, rej) {
    const a = document.createElement("textarea"); a.value = t; document.body.appendChild(a); a.select();
    try { document.execCommand("copy") ? res() : rej(); } catch (e) { rej(e); } finally { a.remove(); }
  });
}
let rfLong = 0;
document.addEventListener("click", function (e) {
  if (e.target.id === "shade") return closeSheet();
  const el = e.target.closest ? e.target.closest("[data-act]") : null;
  if (!el) return;
  const a = el.dataset.act, v = el.dataset.v;
  switch (a) {
    case "login": doLogin(); break;
    case "logout": logout(); break;
    case "tab": sfx.tap(); goTab(v); break;
    case "refresh": sfx.tap(); if (Date.now() - rfLong > 1200) loadAll(false); break;
    case "sound": S.mute = !S.mute; lsSet(LS_MUTE, S.mute); $("sndBtn").textContent = S.mute ? "🔇" : "🔊"; sfx.tap(); break;
    case "sort":
      sfx.tap(); S.opts.sort = v; setChips("sortChips", "sort", v);
      if ((v === "near" || v === "route") && !meFresh()) { startGeo(); toast("أبحث عن موقعك… شغّل الموقع في الهاتف", "w"); }
      render(); break;
    case "show": sfx.tap(); S.opts.show = v; setChips("showChips", "show", v); render(); break;
    case "min": sfx.tap(); S.opts.min = S.opts.min === Number(v) ? 0 : Number(v); setChips("showChips", "min", S.opts.min || "x"); render(); break;
    case "zone": sfx.tap(); S.opts.zone = v || ""; S.zoom = 1; S.zoomDirty = true; render(); break;
    case "clearq": $("q").value = ""; S.opts.q = ""; render(); break;
    case "clearqs": $("qs").value = ""; S.qs = ""; render(); break;
    case "month": sfx.tap(); S.monthOff = Number(v); S.month = K.monthKey(Date.now(), S.monthOff); render(); break;
    case "zoomIn": sfx.tap(); S.zoom = Math.min(8, (S.zoom || 1) * 2); S.zoomDirty = true; render(); break;
    case "zoomOut": sfx.tap(); S.zoom = Math.max(1, (S.zoom || 1) / 2); S.zoomDirty = true; render(); break;
    case "grab": sfx.tap(); openGrab(el.dataset.p); break;
    case "grabSub": sfx.tap(); openGrabSub(el.dataset.p); break;
    case "amtFull": $("shAmt").value = S.sheet.kind === "sub" ? S.sheet.declared : Math.round(S.sheet.live != null ? S.sheet.live : S.sheet.shown); checkAmt(); break;
    case "amtHalf": $("shAmt").value = Math.round((S.sheet.kind === "sub" ? S.sheet.declared : (S.sheet.live != null ? S.sheet.live : S.sheet.shown)) / 2); checkAmt(); break;
    case "closeWin": $("win").classList.remove("on"); $("wbox").innerHTML = ""; break;
    case "next": $("win").classList.remove("on"); $("wbox").innerHTML = ""; goTab("list"); openGrab(el.dataset.p); break;
    case "stk": toast(v); break;
    case "printer": sfx.tap(); openPrinter(); break;
    case "prPick": sfx.tap(); if (NATIVE) { toast("أتّصل بالطابعة…"); NATIVE.printerConnect(v); } break;
    case "prAuto": lsSet(LS_AUTOPRINT, !lsGet(LS_AUTOPRINT, true)); openPrinter(); break;
    case "prTest": printReceipt(sampleReceipt(), false); break;
    case "prForget": if (NATIVE) NATIVE.printerForget(); paintPrBtn(); openPrinter(); break;
    case "reprint": if (lastReceipt) printReceipt(lastReceipt, false); break;
    case "copyReport": copyText(K.reportText(reportData())).then(function () { toast("نُسخ تقرير اليوم ✓", "g"); }, function () { toast("تعذّر النسخ", "e"); }); break;
    case "waReport": window.open("https://wa.me/?text=" + encodeURIComponent(K.reportText(reportData())), "_blank", "noopener"); break;
  }
});
let qT = 0;
document.addEventListener("input", function (e) {
  if (e.target.id === "q" || e.target.id === "qs") {
    clearTimeout(qT);
    qT = setTimeout(function () { if (e.target.id === "q") S.opts.q = e.target.value; else S.qs = e.target.value; render(); }, 140);
  } else if (e.target.id === "shAmt") checkAmt();
});
document.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && (e.target.id === "sPass" || e.target.id === "sPhone")) doLogin();
});
/* تحديثٌ كامل (الأسماء والمواقع أيضاً) بالضغط المطوّل على 🔄 */
let rfT = 0;
$("rfBtn").addEventListener("pointerdown", function () { rfT = setTimeout(function () { rfT = 0; rfLong = Date.now(); buzz(30); toast("تحديثٌ كامل للأسماء والمواقع…"); loadAll(true); }, 900); });
["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { $("rfBtn").addEventListener(ev, function () { if (rfT) clearTimeout(rfT); rfT = 0; }); });

/* زرّ الرجوع في الأندرويد: نغلق ما هو مفتوح ونردّ true؛ false = لا شيء يُغلق فيغادر التطبيق إلى الخلفيّة. */
window.kanzBack = function () {
  if ($("win").classList.contains("on")) { $("win").classList.remove("on"); $("wbox").innerHTML = ""; return true; }
  if ($("shade").classList.contains("on")) { closeSheet(); return true; }
  if (S.ready && S.tab !== "list") { goTab("list"); return true; }
  return false;
};

/* ════════════════════ البداية ════════════════════ */
(function bubbles() {
  const b = $("bubbles"); let h = "";
  for (let i = 0; i < 14; i++) {
    const s = 8 + Math.round(Math.random() * 26);
    h += '<i style="left:' + Math.round(Math.random() * 100) + '%;width:' + s + 'px;height:' + s + 'px;animation-duration:' + (6 + Math.random() * 9).toFixed(1) + 's;animation-delay:-' + (Math.random() * 12).toFixed(1) + 's"></i>';
  }
  b.innerHTML = h;
})();
S.mute = !!lsGet(LS_MUTE, false);
$("sndBtn").textContent = S.mute ? "🔇" : "🔊";
/* ⚡ الفتح السريع: فايربيس يحفظ جلسته ويجدّد توكنه بنفسه، فلا ننتظر ردّ الخادم (ثوانٍ) لنعرض القائمة.
   والتحقّق من أنّ الحساب ما زال قائماً يجري في الخلفية — وحسابٌ أُلغي يُخرَج فور الردّ. */
(function resume() {
  const s = lsGet(LS_SESSION, null);
  if (!s || !s.p || !s.phone) return;
  $("sPhone").value = s.phone;
  const btn = $("loginBtn"); btn.disabled = true; btn.textContent = "جارٍ الإبحار…";
  const off = auth.onAuthStateChanged(async function (u) {
    off();
    try {
      if (u) {
        S.name = s.name || "ليدر"; S.phone = String(s.phone); S.uid = u.uid;
        enterApp();
        apiGet({ action: "STAFF_LOGIN", phone: s.phone, password: decP(s.p) }).then(function (d) {
          if (d && d.success && d.firebase_token) return auth.signInWithCustomToken(d.firebase_token).then(function () { tokAt = Date.now(); });
          /* الإخراج لرفضٍ صريح فقط (موقوف · غير موجود · كلمة مرور خاطئة) — لا لعطلٍ عابر أو حظرٍ مؤقّت */
          if (d && d.success === false && /موقوف|غير موجود|خاطئة/.test(String(d.msg || ""))) { try { localStorage.removeItem(LS_SESSION); } catch (_) {} auth.signOut().then(function () { location.reload(); }); }
        }).catch(function () {});
        return;
      }
      const r = await signIn(s.phone, decP(s.p));
      if (r.ok) enterApp(); else toast(r.msg, "e");
    } catch (_) { toast("لا اتصال — أعد المحاولة حين يعود الإنترنت", "w"); }
    finally { btn.disabled = false; btn.textContent = "ابدأ الرحلة ⚓"; }
  });
})();
})();
