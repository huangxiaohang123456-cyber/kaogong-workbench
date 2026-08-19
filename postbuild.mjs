// postbuild: 给 dist/index.html 注入 no-cache meta 和 cache-bust query string
// 解决 GitHub Pages + Safari 强缓存导致用户看不到新版本的问题
import { readFileSync, writeFileSync } from 'node:fs'

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

// 2) 注入 4 条 anti-cache meta 到 <title> 之前
const cacheMeta = [
  '<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />',
  '<meta http-equiv="Pragma" content="no-cache" />',
  '<meta http-equiv="Expires" content="0" />',
  `<meta name="wb-build" content="${v}" />`,
].join('\n    ')

html = html.replace('<title>', `${cacheMeta}\n    <title>`)

writeFileSync(htmlPath, html)
console.log('[postbuild] cache-bust v=' + v + ' applied to index.html')
