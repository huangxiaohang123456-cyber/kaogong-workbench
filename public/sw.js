// 轻量 Service Worker
// 作用：让首页（index.html）始终走「网络优先」拿最新版，根治 GitHub Pages 强缓存导致看不到新部署的问题；
//       带哈希的静态资源（/assets/*.js *.css）走缓存优先，加速二次加载。
// 部署后无需手动清缓存、无需换 ?v= 链接，正常打开即为最新版。
// v3：强制清掉 v2 的旧缓存（activate 会删除所有不等于当前 v3 名称的缓存），避免旧 SW 残留导致页面卡死
const SHELL_CACHE = 'kw-shell-v3'
const ASSET_CACHE = 'kw-assets-v3'

self.addEventListener('install', () => {
  // 安装后立即激活，尽早接管页面
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // 只处理同源请求
  if (url.origin !== self.location.origin) return

  // 1) 页面导航 / HTML 文档 → 网络优先 + 绕过 HTTP 缓存，确保总是最新
  const isNav = req.mode === 'navigate'
  const isHtml =
    url.pathname.endsWith('index.html') ||
    url.pathname.endsWith('/') ||
    (!url.pathname.includes('.') && !url.pathname.endsWith('/'))
  if (isNav || isHtml) {
    event.respondWith(
      fetch(req, { cache: 'reload' })
        .then((res) => {
          // 顺手缓存一份，作为离线兜底
          const copy = res.clone()
          caches.open(SHELL_CACHE).then((c) => c.put(req, copy))
          return res
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    )
    return
  }

  // 2) 带哈希的静态资源 → 缓存优先 + 后台刷新
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.open(ASSET_CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          const network = fetch(req).then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone())
            return res
          }).catch(() => cached)
          return cached || network
        })
      )
    )
    return
  }

  // 3) 其它同源 GET → 网络优先兜底
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  )
})
