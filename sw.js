/* =============================================
   sw.js - Service Worker for 拼音学习游戏
   ============================================= */

const CACHE_NAME = 'pinyin-game-v1';

// 需要预缓存的核心文件
const PRECACHE_URLS = [
  '.',
  'index.html',
  'style.css',
  'game.js',
  'audio.js',
  'charPY.txt',
  'manifest.json',
  'icons/icon-192.svg',
  'icons/icon-512.svg'
];

// ---- 安装阶段：预缓存核心文件 ----
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => {
      self.skipWaiting();
    })
  );
});

// ---- 激活阶段：清理旧缓存 ----
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => {
      self.clients.claim();
    })
  );
});

// ---- 拦截请求：Cache First 策略 ----
self.addEventListener('fetch', event => {
  // 仅缓存同源请求
  if (event.request.mode === 'navigate') {
    // 导航请求：使用 Network First，确保始终拿到最新版本
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request).then(cached => {
          return cached || caches.match('.');
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then(response => {
        // 只缓存成功的同源资源响应
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });

        return response;
      }).catch(() => {
        // 离线时无法获取资源，返回备用内容
        if (event.request.destination === 'document') {
          return caches.match('.');
        }
        return new Response('', { status: 408 });
      });
    })
  );
});
