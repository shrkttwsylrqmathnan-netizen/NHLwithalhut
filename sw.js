// =========================================================
// Nahla-Rocket-V13: محرك الكاش الصاروخي (Hybrid Enterprise Edition)
// نسخة مخصصة لشركة نحلة كركوك 🐝
// تحديث: حماية Firebase اللحظي + تمرير رفع الصور (POST) + تسريع الأوفلاين 🚀
// =========================================================

const CACHE_NAME = 'Nahla-Core-V13.0'; 
const CDN_CACHE_NAME = 'Nahla-CDNs-V13.0';

// قائمة الملفات الأساسية لنظام نحلة (جميع الواجهات)
const ASSETS_TO_CACHE = [
  './',
  './Master.html',
  './Restaurant.html', 
  './Driver.html',     
  './manifest_master.json',
  './manifest_restaurant.json',
  './manifest_driver.json',
  './master-logo.png',
  './rest-logo.png',
  './driver-logo.png',
  './sw.js'
];

// 1. التثبيت (Install)
self.addEventListener('install', event => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('🚀 [Nahla SW] جاري تهيئة محركات الكاش الصاروخية V13...');
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url => cache.add(url).catch(err => console.warn(`⚠️ [Nahla SW] ملف مفقود تم تخطيه: ${url}`)))
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
            console.log('🧹 [Nahla SW] تم تطهير الذاكرة القديمة:', cache);
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
  if (url.hostname.includes('script.google.com') || 
      url.hostname.includes('firebasedatabase.app') || 
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('imgbb.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 🔵 ج. ملفات الـ CDNs والأصوات والخرائط -> Cache First
  if (url.hostname.includes('unpkg.com') || 
      url.hostname.includes('cdn.jsdelivr.net') || 
      url.hostname.includes('fonts.googleapis.com') || 
      url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('basemaps.cartocdn.com') ||
      url.hostname.includes('actions.google.com')) { 
    
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) return cachedResponse; 
        
        return fetch(event.request).then(networkResponse => {
          // 🚨 السماح للردود التي ليس بها CORS (Opaque) بالدخول للكاش
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            const responseClone = networkResponse.clone();
            caches.open(CDN_CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          }
          return networkResponse;
        }).catch(err => console.log('⚠️ [Nahla SW] CDN Offline:', url.hostname));
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
        if (client.url.includes('Driver.html') || client.url.includes('Restaurant.html') || client.url.includes('Master.html')) {
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
