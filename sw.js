// =========================================================
// AlHut-Rocket-V13: محرك الكاش الصاروخي (Hybrid Enterprise Edition)
// تحديث: حماية Firebase اللحظي + تمرير رفع الصور (POST) + تسريع الأوفلاين 🚀
// =========================================================

/* ═══════════════════════════════════════════════════════════════════════════
   🔄 [إصلاح الكاش العنيد] V15.6 → V16.0
   ───────────────────────────────────────────────────────────────────────────
   معالج activate أدناه يحذف **كل كاش اسمه ليس CACHE_NAME**. وما دام الاسم
   لم يتغيّر منذ V15.6، فهو لا يحذف شيئاً أبداً مهما رفعتَ من ملفات:

     · الاستراتيجية Stale-While-Revalidate ⇒ يُرجع المخزَّن **أوّلاً** ثم
       يحدّث في الخلفية ⇒ أي رفع جديد لا يظهر إلا في **التحميل التالي**.
     · و ignoreSearch: true ⇒ حتى Restaurant.html?v=123 يطابق المخزَّن،
       فحيلة «كسر الكاش» بالمعاملات لا تعمل هنا.
     · و Restaurant.html **لا يسجّل** عامل الخدمة إطلاقاً — سجّله Driver.html
       بنطاق المجلد، فصفحة المطاعم محكومةٌ بعاملٍ لا تملك عليه سلطاناً.

   ⇒ رقمٌ جديد هو **المفتاح الوحيد** الذي يجعل activate يحذف الكاش القديم
     فعلاً، ويُعيد جلب كل الملفات من الشبكة.

   📌 وارفعه في كل مرّة تُغيّر فيها ملفاً من ASSETS_TO_CACHE.
   ═══════════════════════════════════════════════════════════════════════════ */
const CACHE_NAME = 'Nahla-Core-V19.7';
const CDN_CACHE_NAME = 'Nahla-CDNs-V16.1';

// قائمة الملفات الأساسية للنظام
// 🩹 [كاش الأوفلاين] تصحيح حالة الأحرف: GitHub Pages حسّاس لها، وكانت القائمة
//   تطلب 'Restaurant.html' و'Driver.html' بينما الملفان بحروف صغيرة — فيعودان
//   بـ404 ويُتخطّيان بصمت (cache.add(...).catch). النتيجة: تطبيقا الكابتن
//   والمطعم بلا قشرة أوفلاين إطلاقاً، وهما الأشدّ حاجة إليها (الكابتن على
//   الطريق بشبكة متقطّعة). أُزيل كذلك manifest_driver.json و driver-logo.png
//   لأنهما غير موجودَين في المستودع — أعِدهما هنا فور رفعهما.
const ASSETS_TO_CACHE = [
  './',
  './Driver.html',
  './Restaurant.html',
  './Nhleman.html',
  './Nahlelidersas.html',
  './Monitor.html',
  './manifest_rest.json',
  './manifest_admin.json',
  './manifest_leader.json',
  './driver-logo.png',
  './rest-logo.png',
  './admin-logo.png'
];

// 1. التثبيت (Install)
self.addEventListener('install', event => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('🚀 [AlHut SW] جاري تهيئة محركات الكاش الصاروخية V13...');
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url => cache.add(url).catch(err => console.warn(`⚠️ [AlHut SW] ملف مفقود تم تخطيه: ${url}`)))
      );
    })
  );
});

// 2. التفعيل (Activate)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME && cache !== CDN_CACHE_NAME) {
            console.log('🧹 [AlHut SW] تم تطهير الذاكرة القديمة:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. جلب البيانات (Fetch)
self.addEventListener('fetch', event => {
  // 🚨 أ. خط أحمر: السماح لطلبات POST (مثل رفع الصور إلى ImgBB) بالمرور مباشرة دون تدخل الكاش
  if (event.request.method !== 'GET') {
    return; 
  }

  const url = new URL(event.request.url);

  // 🔴 ب. طلبات قاعدة البيانات (جوجل سكريبت) + Firebase اللحظي -> إنترنت فقط (تُمنع من الكاش نهائياً)
  /* 🔧 [ترتيب] كانت includes('googleapis.com') تلتقط fonts.googleapis.com أيضاً،
     فيخرج ملف الخط من هنا «شبكة فقط» ولا يصل القاعدة (ج) المكتوبة خصّيصاً
     لتخزينه — أي أن الخط الحاجب للعرض لم يكن يُخزَّن أبداً، فبقي في المسار
     الحرج لشاشة التحميل مهما تكرّر الفتح. الآن الاستثناء صريح. */
  const isFontCss = url.hostname === 'fonts.googleapis.com';
  if (!isFontCss && (
      url.hostname === 'script.google.com' ||
      url.hostname.endsWith('firebasedatabase.app') ||
      url.hostname.endsWith('googleapis.com') ||
      url.hostname.includes('imgbb.com'))) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 🔵 ج. ملفات الـ CDNs والأصوات والخرائط -> Cache First
  /* 🔧 www.gstatic.com (حزم Firebase الثلاث) كانت تسقط للقاعدة (د) بالصدفة.
     إدراجها صريحاً هنا يضمن تخزينها — وهي ثلاثة موارد حاجبة لاكتمال التحميل. */
  if (url.hostname.includes('www.gstatic.com') ||
      url.hostname.includes('unpkg.com') || 
      url.hostname.includes('cdn.jsdelivr.net') || 
      url.hostname.includes('fonts.googleapis.com') || 
      url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('basemaps.cartocdn.com') ||
      url.hostname.includes('actions.google.com')) { 
    
    /* ═══════════════════════════════════════════════════════════════════════
       🔴🔴🔴 [الجذر] **هذا هو سبب «زرّ الدخول العالق على جارٍ التحميل».**
       ───────────────────────────────────────────────────────────────────────
       كان السطر:
           if (networkResponse && (networkResponse.status === 200 ||
                                   networkResponse.type === 'opaque'))

       والردّ الـ opaque هو ردّ طلبٍ بلا CORS: **حالته 0 وجسمه غير مقروء**.
       يقع حين تتعثّر الشبكة أو تتدخّل بوّابة مزوّد أو شبكة مقيّدة.

       فإن عاد أحد استيرادات firebase من www.gstatic.com كـopaque مرّة واحدة:
         ① يُخزَّن في CDN_CACHE_NAME
         ② والاستراتيجية هنا **Cache-First**: `if (cachedResponse) return`
            ⇒ يُقدَّم إلى الأبد بلا أي إعادة تحقّق
         ③ ووحدة ES لا تستطيع تنفيذ ردٍّ opaque (لا جسم ولا نوع MIME)
         ⇒ الوحدة تموت عند أول import ⇒ window.authAction لا تُعرَّف أبداً
         ⇒ حارس الإقلاع في Restaurant.html يُبقي الزرّ «⏳ جارٍ التحميل…»

       ⚠️ **ولهذا لم تنفع العودة إلى النسخة القديمة من Restaurant.html:**
          السمّ ليس في صفحة المطاعم بل في كاش الـCDN. أي ملف HTML سيموت
          عند نفس الاستيراد المسموم.

       العلاج طبقتان:
         ① لا نخزّن opaque أبداً لموارد حاجبة للتنفيذ. الردّ غير الصالح
            يُمرَّر للمتصفّح ولا يُحفظ — فتُعاد المحاولة في التحميل التالي.
         ② ولا نثق بالمخزَّن ثقةً عمياء: مدخلٌ حالته ليست 200 يُهمَل
            ويُعاد الجلب — فيُشفى الكاش المسموم من تلقاء نفسه.
       ═══════════════════════════════════════════════════════════════════════ */
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        /* ② المخزَّن الصالح وحده يُقدَّم. (opaque ⇒ status 0 ⇒ يُهمَل) */
        if (cachedResponse && cachedResponse.status === 200 && cachedResponse.type !== 'opaque') {
          return cachedResponse;
        }
        if (cachedResponse) {
          console.warn('🧹 [AlHut SW] مدخل كاش تالف — يُطرح ويُعاد جلبه:', url.pathname);
          caches.open(CDN_CACHE_NAME).then(c => c.delete(event.request)).catch(() => {});
        }

        return fetch(event.request).then(networkResponse => {
          /* ① الصالح وحده يُخزَّن — لا opaque ولا 4xx/5xx. */
          if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
            const responseClone = networkResponse.clone();
            caches.open(CDN_CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          }
          return networkResponse;
        }).catch(err => console.log('⚠️ [AlHut SW] CDN Offline:', url.hostname));
      })
    );
    return;
  }

  // 🟢 د. ملفات النظام الأساسية -> Stale-While-Revalidate مع التجاهل الذكي للمتغيرات (ignoreSearch)
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
        }
        return networkResponse;
      }).catch(() => {
        console.log('📶 وضع الأوفلاين مفعل للمسار:', url.pathname);
      });

      if (cachedResponse) {
         // إجبار المتصفح على عدم إغلاق الـ Service Worker حتى يكتمل التحديث بالخلفية
         event.waitUntil(fetchPromise); 
         return cachedResponse;
      }
      
      return fetchPromise;
    })
  );
});

// 4. التعامل مع الإشعارات (Notification Click)
self.addEventListener('notificationclick', event => {
  event.notification.close(); 

  // التوجيه للجذر أو الرابط المرفق
  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // البحث عن أي نافذة مفتوحة للنظام وتفعيلها
      for (let client of windowClients) {
        if (client.url.includes('Driver.html') || client.url.includes('Restaurant.html') || client.url.includes('Nhleman.html')) {
          if ('focus' in client) {
            return client.focus();
          }
        }
      }
      // إذا كانت مغلقة تماماً، افتح نافذة جديدة
      if (clients.openWindow) {
        return clients.openWindow(targetUrl); 
      }
    })
  );
});
