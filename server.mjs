// Serves the built site and runs the Auto-Invest executor every ten minutes from the same process.
// Static files come from dist/ with long cache headers for hashed assets, gzip for text, and the SPA
// fallback to index.html. The executor only runs when an executor key and a contract address exist.
import http from 'node:http'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { runOnce, executorBalance, refuelIfNeeded } from './scripts/executor-lib.mjs'
import { AUTOINVEST_ADDRESS as BUILT_IN } from './scripts/autoinvest-address.mjs'

const ROOT = resolve('dist')
const PORT = Number(process.env.PORT ?? 8080)
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.webmanifest': 'application/manifest+json', '.map': 'application/json', '.mp4': 'video/mp4' }
const COMPRESS = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt', '.xml', '.webmanifest', '.map'])
const gz = new Map()

function send(req, res, file, status = 200) {
  const ext = extname(file).toLowerCase()
  const type = TYPES[ext] ?? 'application/octet-stream'
  const immutable = /\/assets\//.test(file) || /\/img\//.test(file) || /\/logos\//.test(file) || /\.(woff2?|png|webp|svg|mp4)$/.test(file)
  const headers = { 'content-type': type, 'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache', 'x-content-type-options': 'nosniff' }
  if (COMPRESS.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
    let buf = gz.get(file)
    if (!buf) { buf = gzipSync(readFileSync(file)); if (gz.size > 500) gz.clear(); gz.set(file, buf) }
    res.writeHead(status, { ...headers, 'content-encoding': 'gzip', 'content-length': buf.length, vary: 'accept-encoding' })
    return req.method === 'HEAD' ? res.end() : res.end(buf)
  }
  res.writeHead(status, { ...headers, 'content-length': statSync(file).size })
  return req.method === 'HEAD' ? res.end() : createReadStream(file).pipe(res)
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end() }
  let path
  try { path = decodeURIComponent(new URL(req.url, 'http://x').pathname) } catch { res.writeHead(400); return res.end() }
  const file = normalize(join(ROOT, path))
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end() }
  if (existsSync(file) && statSync(file).isFile()) return send(req, res, file)
  const index = join(file, 'index.html')
  if (existsSync(index)) return send(req, res, index)
  // Anything with an extension that is not there is a real 404; everything else is a client route.
  if (extname(path) && !path.endsWith('.html')) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found') }
  return send(req, res, join(ROOT, 'index.html'))
})
server.listen(PORT, () => console.log(`verdex serving ${ROOT} on :${PORT}`))

// ---- executor ----
const key = process.env.EXECUTOR_KEY ?? (existsSync('executor.key') ? readFileSync('executor.key', 'utf8').trim() : '')
const address = process.env.AUTOINVEST_ADDRESS || BUILT_IN
const EVERY = Number(process.env.EXECUTOR_EVERY_MS ?? 10 * 60 * 1000)
if (key && address) {
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      const r = await runOnce({ rpc: process.env.RPC, address, key, log: (m) => console.log(`[executor] ${m}`) })
      if (r.due) console.log(`[executor] plans ${r.count} · due ${r.due} · sent ${r.sent} · skipped ${r.skipped}`)
      await refuelIfNeeded({ rpc: process.env.RPC, key, log: (m) => console.log(`[executor] ${m}`) }).catch((e) => console.log(`[executor] refuel failed: ${(e.shortMessage ?? e.message ?? String(e)).slice(0, 160)}`))
    } catch (e) {
      console.log(`[executor] pass failed: ${(e.shortMessage ?? e.message ?? String(e)).slice(0, 160)}`)
    } finally { running = false }
  }
  executorBalance({ rpc: process.env.RPC, key }).then((b) => console.log(`[executor] ${b.address} · ${b.eth.toFixed(6)} ETH · contract ${address} · every ${EVERY / 60000} min`)).catch(() => {})
  setTimeout(tick, 15_000)
  setInterval(tick, EVERY)
} else {
  console.log('[executor] off: no key or contract address')
}
