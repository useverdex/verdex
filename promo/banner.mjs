// Renders promo/banner.html to the X header image (1500x500 PNG).
// Usage: node promo/banner.mjs [--phrase 'Wall Street, *onchain*.'] [--name] [--size 52] [--loud] [--out promo/verdex-banner.png]
// *word* in the phrase is set in lime; --name adds a small Verdex under it.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined }
const out = arg('--out') ?? path.join(root, 'promo', 'verdex-banner.png')
const qs = new URLSearchParams(); if (arg('--phrase')) qs.set('phrase', arg('--phrase')); if (process.argv.includes('--name')) qs.set('name', '1'); if (arg('--size')) qs.set('size', arg('--size')); if (process.argv.includes('--loud')) qs.set('quiet', '0')
const types = { '.html': 'text/html', '.js': 'text/javascript', '.ts': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end() }
  res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }); fs.createReadStream(file).pipe(res)
}).listen(0)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--force-color-profile=srgb'] })
const page = await browser.newPage({ viewport: { width: 1500, height: 500 } })
await page.goto(`http://localhost:${server.address().port}/promo/banner.html?${qs}`)
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 })
await page.locator('#banner').screenshot({ path: out })
await browser.close()
server.close()
console.log('wrote', out)
