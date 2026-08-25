// postbuild: 给 dist/index.html 注入 no-cache meta 和 cache-bust query string
// 解决 GitHub Pages + Safari 强缓存导致用户看不到新版本的问题
import { readFileSync, writeFileSync, cpSync, existsSync, readdirSync } from 'node:fs'

const htmlPath = 'dist/index.html'
let html = readFileSync(htmlPath, 'utf8')

const v = Date.now().toString()

// 1) 给 js 和 css 引用加 ?v=<时间戳>
html = html.replace(
  /<script[^>]*src="\.\/assets\/([^"]+)\.js"[^>]*><\/script>/g,
  (_, p1) => `<script type="module" crossorigin src="./assets/${p1}.js?v=${v}"></script>`
)
html = html.replace(
  /<link[^>]*rel="stylesheet"[^>]*href="\.\/assets\/([^"]+)\.css"[^>]*>/g,
  (_, p1) => `<link rel="stylesheet" crossorigin href="./assets/${p1}.css?v=${v}">`
)

// 2) 注入 4 条 anti-cache meta + PWA meta 到 <title> 之前
const cacheMeta = [
  '<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />',
  '<meta http-equiv="Pragma" content="no-cache" />',
  '<meta http-equiv="Expires" content="0" />',
  `<meta name="wb-build" content="${v}" />`,
  // PWA / iOS Add to Home Screen
  `<link rel="apple-touch-icon" href="./apple-touch-icon.png?v=${v}" />`,
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-title" content="备考工作台" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="application-name" content="备考工作台" />',
  `<link rel="manifest" href="./manifest.webmanifest?v=${v}" />`,
].join('\n    ')

html = html.replace('<title>', `${cacheMeta}\n    <title>`)

writeFileSync(htmlPath, html)
console.log('[postbuild] cache-bust v=' + v + ' applied to index.html')

// 把 PDF.js 的 cMaps / standard_fonts 拷到 dist（同源，保证中文不乱码且不依赖外网 CDN）
for (const [src, dst, label] of [
  ['node_modules/pdfjs-dist/cmaps', 'dist/pdf-cmaps', 'cMaps'],
  ['node_modules/pdfjs-dist/standard_fonts', 'dist/pdf-standard-fonts', 'standard_fonts'],
]) {
  try {
    if (existsSync(src)) {
      cpSync(src, dst, { recursive: true })
      const n = existsSync(dst) ? readdirSync(dst).length : 0
      console.log('[postbuild] pdf ' + label + ' copied -> ' + dst + ' (' + n + ' files)')
    } else {
      console.log('[postbuild] pdf ' + label + ' source not found, skip')
    }
  } catch (e) {
    console.log('[postbuild] copy pdf ' + label + ' failed:', e.message)
  }
}
