// Records a short walkthrough of Verdex on Solana, on the real site: the baskets, Jupiter prices, the
// composer with its leg count and floors. Fake cursor and caption card as in tour.mjs. ~30 s.
// Usage: node promo/tour-solana.mjs [--base https://useverdex.xyz] [--out promo/verdex-solana-tour.mp4]
import { chromium, request } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d }
const base = arg('--base', 'https://useverdex.xyz')
const out = arg('--out', path.join(root, 'promo', 'verdex-solana-tour.mp4'))
const ffmpeg = process.env.FFMPEG ?? 'ffmpeg'
const tmp = fs.mkdtempSync(path.join(path.dirname(out), '.tour-'))

const api = await request.newContext({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined, ignoreHTTPSErrors: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--force-color-profile=srgb'] })
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: tmp, size: { width: 1920, height: 1080 } }, ignoreHTTPSErrors: true })

// A mock EIP-6963 wallet so the widget can connect; nothing is ever broadcast.
const ACCOUNT = '0x1111111111111111111111111111111111111111'
await ctx.addInitScript(`(() => {
  const state = { chainId: '0x1237', account: '${ACCOUNT}' }
  const listeners = {}
  const emit = (ev, ...a) => (listeners[ev] || []).forEach((f) => { try { f(...a) } catch {} })
  const provider = { on(ev, fn) { (listeners[ev] ||= []).push(fn) }, removeListener(ev, fn) { listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn) },
    async request({ method, params }) { switch (method) {
      case 'eth_requestAccounts': case 'eth_accounts': return [state.account]
      case 'eth_chainId': return state.chainId
      case 'wallet_switchEthereumChain': case 'wallet_addEthereumChain': { state.chainId = params[0].chainId; setTimeout(() => emit('chainChanged', state.chainId), 0); return null }
      default: throw Object.assign(new Error('mock: ' + method), { code: 4200 }) } } }
  const info = { uuid: 'mock-wallet-0001', name: 'Rabby', icon: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#7084FF"/></svg>'), rdns: 'io.rabby' }
  const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: Object.freeze({ info, provider }) }))
  window.addEventListener('eip6963:requestProvider', announce); announce()
})()`)
// Cursor and caption overlay, present on every load.
await ctx.addInitScript(`addEventListener('DOMContentLoaded', () => {
  const st = document.createElement('style'); st.textContent = 'body > :not(#__cur):not(#__cap){zoom:1.3333}' + '#__cur{position:fixed;left:0;top:0;width:30px;height:30px;z-index:99999;pointer-events:none;filter:drop-shadow(0 3px 8px rgba(0,0,0,.6));transform:translate(-4px,-2px)}#__cur.dn{transform:translate(-4px,-2px) scale(.85)}#__cap{position:fixed;left:40px;bottom:40px;z-index:99998;pointer-events:none;max-width:720px;padding:18px 24px;border-radius:16px;background:rgba(14,14,14,.82);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid rgba(255,255,255,.1);box-shadow:0 20px 60px rgba(0,0,0,.5);font-family:Geist,system-ui,sans-serif;color:#fff;opacity:0;transform:translateY(14px);transition:opacity .35s ease,transform .35s ease}#__cap.on{opacity:1;transform:none}#__cap b{display:block;font-size:26px;font-weight:600;letter-spacing:-.01em}#__cap span{display:block;font-size:18px;color:rgba(255,255,255,.7);margin-top:4px}#__cap i{display:inline-block;width:9px;height:9px;border-radius:50%;background:#C2EA8A;margin-right:10px;vertical-align:middle}'
  document.head.appendChild(st)
  const cur = document.createElement('div'); cur.id = '__cur'; cur.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M5 3l14 8-6.2 1.6L10 19z" fill="#fff" stroke="#060606" stroke-width="1.2" stroke-linejoin="round"/></svg>'
  const cap = document.createElement('div'); cap.id = '__cap'
  document.body.append(cur, cap)
  window.__curPos = { x: 960, y: 700 }
  window.__setCur = (x, y) => { window.__curPos = { x, y }; cur.style.left = x + 'px'; cur.style.top = y + 'px' }
  window.__setCur(960, 700)
  window.__press = (on) => cur.classList.toggle('dn', !!on)
  window.__cap = (t, s) => { if (!t) { cap.classList.remove('on'); return } cap.innerHTML = '<b><i></i>' + t + '</b>' + (s ? '<span>' + s + '</span>' : ''); cap.classList.add('on') }
})`)

const page = await ctx.newPage()
page.setDefaultTimeout(20000)
// External requests go through the proxy; CORS headers are replaced so the page can read the responses.
await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, async (route) => {
  const req = route.request()
  try {
    const resp = await api.fetch(req.url(), { method: req.method(), headers: req.headers(), data: req.postData() ?? undefined, timeout: 20000 })
    const headers = Object.fromEntries(Object.entries(resp.headers()).filter(([k]) => !/^access-control-/i.test(k) && !/^content-encoding$|^content-length$/i.test(k)))
    await route.fulfill({ status: resp.status(), headers: { ...headers, 'access-control-allow-origin': '*' }, body: await resp.body() })
  } catch { await route.abort() }
})

const sleep = (ms) => page.waitForTimeout(ms)
const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2)
async function moveTo(x, y, ms = 700) {
  const from = await page.evaluate(() => window.__curPos)
  const n = Math.max(8, Math.round(ms / 16))
  for (let i = 1; i <= n; i++) { const p = ease(i / n); await page.evaluate(([a, b]) => window.__setCur(a, b), [from.x + (x - from.x) * p, from.y + (y - from.y) * p]); await page.mouse.move(from.x + (x - from.x) * p, from.y + (y - from.y) * p); await sleep(16) }
}
async function clickOn(locator, { ms = 700, hold = 160 } = {}) {
  await locator.scrollIntoViewIfNeeded()
  const b = await locator.boundingBox()
  if (!b) throw new Error('no box for ' + locator)
  const x = b.x + b.width / 2, y = b.y + b.height / 2
  await moveTo(x, y, ms)
  await page.evaluate(() => window.__press(true)); await sleep(hold)
  await page.mouse.click(x, y)
  await page.evaluate(() => window.__press(false))
}
async function scrollTo(y0, ms = 1400) {
  const y = y0 * 1.3333
  const from = await page.evaluate(() => window.scrollY)
  const n = Math.round(ms / 16)
  for (let i = 1; i <= n; i++) { await page.evaluate((v) => window.scrollTo(0, v), from + (y - from) * ease(i / n)); await sleep(16) }
}
async function cap(t, s, hold = 0) { await page.evaluate(([a, b]) => window.__cap(a, b), [t ?? '', s ?? '']); if (hold) await sleep(hold) }
async function go(route, wait = 1800) { await page.evaluate((r) => { location.hash = '#' + r; window.scrollTo(0, 0) }, route); await sleep(wait) }
async function type(locator, text, delay = 90) { await clickOn(locator); await sleep(150); await locator.type(text, { delay }) }

// Solana page
await page.goto(`${base}/solana`, { waitUntil: 'domcontentloaded' })
await page.getByText('Verdex Magnificent Seven').first().waitFor({ timeout: 90000 }); await sleep(1200)
await cap('Verdex on Solana', 'Live. The same baskets, made of xStocks, through Jupiter.', 1800)
await cap('No program, no custody', 'Nothing of Verdex on Solana. The stocks go from the pool to your wallet.')
await scrollTo(300, 1000); await sleep(1400)
await cap('Four baskets of xStocks', 'VX7, AI Infrastructure, Frontier, SPY and QQQ. Priced by Jupiter as you look.')
await scrollTo(560, 1200); await sleep(1600)
await cap('Buy with USDC', 'One slice per stock. One transaction per leg.')
await clickOn(page.getByRole('button', { name: 'Buy', exact: true }).first()); await sleep(1100)
await clickOn(page.getByRole('button', { name: '$250', exact: true }).first()); await sleep(900)
await cap('Seven legs, one signature', 'Your wallet signs them all in one prompt. A floor on every leg.', 2600)
await cap('Sell any share the same way', 'Back into USDC, leg by leg.')
await clickOn(page.getByRole('button', { name: 'Sell', exact: true }).nth(1)); await sleep(1600)
await cap('Phantom, Solflare, Backpack', 'Or any wallet that speaks the Wallet Standard.')
const wb = await page.getByRole('button', { name: 'Solana wallet' }).first().boundingBox(); if (wb) await moveTo(wb.x + wb.width / 2, wb.y + wb.height / 2, 900)
await sleep(1500)
await cap('useverdex.xyz/solana', 'Box 6 of 11. Live.', 1800)
await cap(null); await sleep(400)

await page.close()
const video = await page.video().path()
await ctx.close(); await browser.close()
await new Promise((r, j) => spawn(ffmpeg, ['-y', '-loglevel', 'error', '-ss', '1.6', '-i', video, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', out], { stdio: 'inherit' }).on('close', (c) => (c ? j(new Error('ffmpeg ' + c)) : r())))
fs.rmSync(tmp, { recursive: true, force: true })
console.log('wrote', out)
