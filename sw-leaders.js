/* ═══════════════════════════════════════════════════════════════════════════
   sw-leaders.js — [V35.75] عامل خدمة «لوحة الليدرز» القابلة للتثبيت
   ───────────────────────────────────────────────────────────────────────────
   نطاقه ./Nahlelidersas.html وحدها، فلا يمسّ sw.js الخاصّ بتطبيق الكابتن ولا أيّ صفحةٍ أخرى.
   لا يخزّن شيئاً عمداً: اللوحة أداة عمل حيّة، ونسخةٌ قديمة منها أخطر من صفحة «لا اتصال».
   ما يفعله وحده: حين تتعذّر الشبكة عند فتح اللوحة يعرض رسالةً واضحة بدل صفحة خطأ المتصفّح.
   ═══════════════════════════════════════════════════════════════════════════ */
const OFFLINE_HTML =
  '<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1"><title>لوحة الليدرز</title>' +
  '<style>body{font-family:Tahoma,sans-serif;text-align:center;padding:64px 20px;background:#fff;color:#111}' +
  'h2{font-size:1.3rem;margin:12px 0}p{color:#666;font-size:.95rem}' +
  'button{background:#111;color:#fff;border:none;border-radius:12px;padding:13px 30px;font-size:1rem;font-weight:700;margin-top:18px}</style></head>' +
  '<body><div style="font-size:56px">📡</div><h2>لا يوجد اتصال بالإنترنت</h2>' +
  '<p>اللوحة تحتاج الإنترنت لتعرض الطلبات الحيّة.</p>' +
  '<button onclick="location.reload()">إعادة المحاولة</button></body></html>';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;   /* البيانات والملفّات تمرّ كما هي */
  e.respondWith(fetch(e.request).catch(() => new Response(OFFLINE_HTML, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
