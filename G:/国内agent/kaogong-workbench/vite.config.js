import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 给 HTML 注入 cache-busting query 字符串 + no-cache meta，避免 GitHub Pages + Safari 缓存旧版本
const cacheBustPlugin = () => ({
  name: 'cache-bust',
  transformIndexHtml(html) {
    const v = Date.now()
    const next = html
      .replace(/<script[^>]*src="\.\/assets\/([^"]+)\.js"[^>]*><\/script>/,
        (_, p1) => `<script type="module" crossorigin src="./assets/${p1}.js?v=${v}"></script>`)
      .replace(/<link rel="stylesheet"[^>]*href="\.\/assets\/([^"]+)\.css"[^>]*>/,
        (_, p1) => `<link rel="stylesheet" crossorigin href="./assets/${p1}.css?v=${v}">`)
    // 注入 4 个 anti-cache meta 到 <head>
    const cacheMeta = `
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />
    <meta name="wb-build" content="${v}" />
`
    return next.replace(/<title>/, cacheMeta + '<title>')
  },
})

export default defineConfig({
  base: './',
  plugins: [cacheBustPlugin(), react()],
  server: { port: 5173, host: true },
})
