/* ═══════════════════════════════════════════════════════════════════════════
   sw.js — [V31.30] عامل الخدمة الحقيقي لتطبيق الكابتن
   ───────────────────────────────────────────────────────────────────────────
   السابق كان نصّاً مضمَّناً يُسجَّل من blob: — ومواصفة Service Worker ترفض أيّ
   مخطّطٍ غير http/https، فلم يُسجَّل يوماً، و.catch ابتلع الرفض. لا كاش،
   لا قشرة بلا إنترنت، ولافتة «يعمل بدون إنترنت» تَعِد بما لا يوجد.

   هذا الملف يُرفع **بجوار Driver.html** على الأصل نفسه (شرطٌ لا تفضيل).

   ما يفعله:
     ① Driver.html: شبكةٌ أوّلاً بمهلة ٨ ث ⇒ الكاش ⇒ صفحة «لا اتصال» صغيرة.
        فعلى شبكةٍ زاحفة يُقلع من الكاش في ثوانٍ **بالجلسة نفسها** (أصلٌ واحد)،
        وحارس العشرين ثانية في MainActivity لا ينطلق — والاحتياطي المدفون
        (file:// بأصلٍ آخر بلا جلسة) يصير طريقاً أخيراً نادراً لا معتاداً.
     ② firebasejs من gstatic: روابط مرقّمة لا تتغيّر ⇒ الكاش أوّلاً.
     ③ الخطوط: الكاش ثم التحديث في الخلفية.
     ④ كل ما يحمل بيانات (Apps Script · RTDB · Functions · Storage · googleapis)
        **لا يُلمس** — تمريرٌ صرف. لا يُخزَّن ردُّ دخولٍ ولا ردُّ طلب.

   ⚠️ VER يجب أن يساوي CURRENT_APP_VERSION في Driver.html حرفاً بحرف:
      build.js يرفض البناء عند الاختلاف، وtest_gate يحرسه. فتغيير الإصدار
      يُنشئ كاشاً جديداً ويُسقط القديم عند التفعيل — لا نسختين معاً.
   ═══════════════════════════════════════════════════════════════════════════ */
const VER   = '34.65-Nahla';   /* [N-14] يطابق CURRENT_APP_VERSION في Driver.html حرفاً بحرف (build.js) · قالب V34.65 (32.22-AccountOff) */
const CACHE = 'nahla-' + VER;
/* [N-14] اسمُ صفحة الكابتن يرد **مرّةً واحدة** هنا، حرفاً كاملاً: خطوة النشر تُبدّله إلى اسم نحلة
   (الأحرف الكبيرة) بمطابقةٍ حرفيّة، وكلّ ما يلي مشتقٌّ منه. لا نمطَ regex يُخفي الاسم (النمط المهرَّب
   لا تلتقطه مطابقةٌ حرفيّة) ولا لصقَ أجزاء. والمقارنة بلا اعتبارٍ لحالة الأحرف فيعمل الملف سواءٌ بُدِّل
   الاسمُ أم لم يُبدَّل. ومساره نسبيٌّ للـsw.js نفسه فيصحّ تحت /NHLwithalhut/ . */
const SHELL_URL  = './Driver.html';
const SHELL_NAME = SHELL_URL.slice(2).toLowerCase();
const SHELL = [SHELL_URL];
const NET_TIMEOUT_MS = 8000;

const OFFLINE_HTML =
  '<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1"><title>نحلة</title>' +
  '<style>body{font-family:Cairo,sans-serif;text-align:center;padding:60px 20px;background:#FFFDF5;color:#111827}' +
  'h2{font-size:1.4rem;margin:12px 0}p{color:#6B7280;font-size:.95rem}' +
  'button{background:#FFB300;color:#fff;border:none;border-radius:16px;padding:14px 32px;font-size:1rem;font-weight:700;margin-top:20px}</style></head>' +
  '<body><div style="font-size:64px">📡</div><h2>لا اتصال بالإنترنت</h2>' +
  '<p>سيعود التطبيق تلقائياً عند عودة الشبكة. طلباتك محفوظة.</p>' +
  '<button onclick="location.reload()">إعادة المحاولة</button></body></html>';

const BYPASS = [
  /script\.google(usercontent)?\.com/, /firebasedatabase\.app/, /firebaseio\.com/,
  /cloudfunctions\.net/, /\.run\.app/, /googleapis\.com/, /firebasestorage/, /securetoken/,
  /identitytoolkit/, /fcm\./
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      /* [N-14] بلا اعتبارٍ لحالة الأحرف: الصفحة المنشورة قبل هذا القالب خزّنت في «Nahla-Core-V20.9» و«Nahla-CDNs-V16.1»
         (أحرفٌ كبيرة) نسخاً قديمةً من كلّ الواجهات — وما كانت لتُحذف أبداً ببادئةٍ صغيرة، فيعود منها
         caches.match القديمُ عند انقطاع الشبكة. */
      .then((ks) => Promise.all(ks.filter((k) => k.toLowerCase().startsWith('nahla-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function withTimeout(p, ms) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('sw_timeout')), ms);
    p.then((v) => { clearTimeout(t); res(v); }, (err) => { clearTimeout(t); rej(err); });
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (BYPASS.some((r) => r.test(url.host + url.pathname))) return;   /* بيانات — لا تُلمس */

  /* 🔴 [V34.39] كان: isShell = req.mode==='navigate' || …Driver.html — فأيُّ تنقّلٍ على الأصل
     (Master · liderdodsas · restaurant · bridge-ui في المتصفّح نفسه، والنطاق «/») يُحفظ
     **باسم Driver.html**، ثم يُقدَّم بدلَ تطبيق الكابتن عند ضعف الشبكة (تدقيق 09-10، OT-09).
     الآن: القشرة هي Driver.html على هذا الأصل وحدها، وأيّ تنقّلٍ آخر لا يُلمس إطلاقاً
     (المتصفّح يجلبه كأنّه لا عامل خدمة). */
  const isShell = url.origin === self.location.origin && url.pathname.toLowerCase().endsWith('/' + SHELL_NAME);   /* [N-14] نصٌّ لا regex — انظر SHELL_URL */
  if (!isShell && req.mode === 'navigate') return;
  if (isShell) {
    e.respondWith(
      withTimeout(fetch(req), NET_TIMEOUT_MS)
        .then((r) => {
          if (r && r.ok) { const cl = r.clone(); caches.open(CACHE).then((c) => c.put(SHELL_URL, cl)); }
          return r;
        })
        .catch(() => caches.match(SHELL_URL).then((r) =>
          r || new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html;charset=utf-8' } })))
    );
    return;
  }

  if (/^www\.gstatic\.com$/.test(url.host) && /\/firebasejs\//.test(url.pathname)) {   /* SDK مرقّم — لا يتغيّر */
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
      if (r && r.ok) { const cl = r.clone(); caches.open(CACHE).then((c) => c.put(req, cl)); }
      return r;
    })));
    return;
  }

  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.host)) {   /* خطوط — الكاش ثم التحديث */
    e.respondWith(caches.match(req).then((hit) => {
      const net = fetch(req).then((r) => { if (r && r.ok) { const cl = r.clone(); caches.open(CACHE).then((c) => c.put(req, cl)); } return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  /* غير ذلك (شعارات · manifest): تمريرٌ مع احتياطي الكاش */
  e.respondWith(fetch(req).catch(() => caches.match(req)));
});

/* 🔔 [V34.39] الإشعار صار يُعرض من هنا (registration.showNotification — كروم أندرويد يرفض
   new Notification بـ«Illegal constructor»). لمسُه يفتح تطبيق الكابتن أو يُبرزه إن كان مفتوحاً. */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((cs) => {
        const c = cs.find((x) => String(x.url).split(/[?#]/)[0].toLowerCase().endsWith('/' + SHELL_NAME));   /* [N-14] */
        if (c && c.focus) return c.focus();
        if (self.clients.openWindow) return self.clients.openWindow(SHELL_URL);
      })
      .catch(() => {})
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'ping' && e.ports && e.ports[0]) e.ports[0].postMessage('pong');
  if (e.data === 'version' && e.ports && e.ports[0]) e.ports[0].postMessage(VER);
});
