// Records the phone app for the mobile promo: one short clip per scene on the real preview build at
// an iPhone viewport, captured frame by frame at 2x. The page clock and its CSS animations run at a
// third of real speed so the capture keeps up; the frames are resampled to 30 fps afterwards.
// Usage: node promo/phone.mjs [--only markets,swap] [--base http://localhost:4174] [--dir promo/phone] [--slow 3]
import { chromium, request } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d }
const base = arg('--base', 'http://localhost:4174')
const outDir = arg('--dir', path.join(root, 'promo', 'phone'))
const only = arg('--only', '').split(',').filter(Boolean)
const S = Number(arg('--slow', 3))
const FPS = 30
const W = 393, H = 852, SCALE = 2
const ffmpeg = process.env.FFMPEG ?? 'ffmpeg'
fs.mkdirSync(outDir, { recursive: true })

const api = await request.newContext({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined, ignoreHTTPSErrors: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--force-color-profile=srgb'] })

const ACCOUNT = '0x1111111111111111111111111111111111111111'
const WALLET_MOCK = `(() => {
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
})()`
// Slow the page's own clock so JS-driven motion matches the slowed CSS animations.
const SLOW = `(() => {
  const S = ${S}
  const P = performance, pn = P.now.bind(P), o = pn()
  P.now = () => o + (pn() - o) / S
  const DN = Date.now, d0 = DN()
  Date.now = () => d0 + (DN() - d0) / S
  const st = window.setTimeout.bind(window), si = window.setInterval.bind(window)
  window.setTimeout = (fn, ms, ...a) => st(fn, (Number(ms) || 0) * S, ...a)
  window.setInterval = (fn, ms, ...a) => si(fn, (Number(ms) || 0) * S, ...a)
  // Frame callbacks get the slowed clock: the animation playback rate below also slows the
  // timestamps Chromium hands to requestAnimationFrame, so those cannot be used directly.
  const raf = window.requestAnimationFrame.bind(window)
  window.requestAnimationFrame = (cb) => raf(() => cb(P.now()))
})()`
const OVERLAY = `addEventListener('DOMContentLoaded', () => {
  const st = document.createElement('style'); st.textContent = ':root{--sat:54px!important;--sab:34px!important}html{scroll-behavior:auto!important}::-webkit-scrollbar{display:none}' + '#__touch{position:fixed;left:0;top:0;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(255,255,255,.35);border:1.5px solid rgba(255,255,255,.7);z-index:99999;pointer-events:none;opacity:0;transform:scale(.4)}#__touch.on{animation:__tap .5s cubic-bezier(.2,.7,.2,1) forwards}@keyframes __tap{0%{opacity:.9;transform:scale(.45)}60%{opacity:.5;transform:scale(1)}100%{opacity:0;transform:scale(1.25)}}'
  document.head.appendChild(st)
  const touch = document.createElement('div'); touch.id = '__touch'
  document.body.append(touch)
  window.__tap = (x, y) => { touch.style.left = x + 'px'; touch.style.top = y + 'px'; touch.classList.remove('on'); void touch.offsetWidth; touch.classList.add('on') }
  const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
  window.__scroll = (y, ms) => new Promise((done) => { const from = window.scrollY, t0 = performance.now(); const step = (now) => { const p = Math.min(1, (now - t0) / ms); window.scrollTo(0, from + (y - from) * ease(p)); if (p < 1) requestAnimationFrame(step); else done() }; requestAnimationFrame(step) })
})`

const T0 = Date.now()
const log = (m) => process.env.PHONE_DEBUG && console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s] ${m}`)
function helpers(page) {
  // Every delay here is in clip seconds; the page runs S times slower in real time.
  const sleep = async (ms) => { log(`sleep ${ms}`); await page.waitForTimeout(ms * S) }
  const tap = async (locator, { hold = 260 } = {}) => {
    log('tap')
    await locator.scrollIntoViewIfNeeded()
    await sleep(120)
    const b = await locator.boundingBox(); if (!b) throw new Error('no box')
    await page.evaluate(([a, c]) => window.__tap(a, c), [b.x + b.width / 2, b.y + b.height / 2])
    await sleep(60)
    await locator.click({ timeout: 10000 })
    await sleep(hold)
  }
  const scrollTo = async (y, ms = 1200) => { log(`scroll ${y}`); await page.evaluate(([a, b]) => window.__scroll(a, b), [y, ms]); log('scroll done') }
  const go = async (route, wait = 1600) => { await page.evaluate((r) => { location.hash = '#' + r; window.scrollTo(0, 0) }, route); await sleep(wait) }
  const type = async (locator, text, delay = 110) => { await tap(locator, { hold: 200 }); await locator.type(text, { delay: delay * S }) }
  const connect = async () => {
    await tap(page.getByRole('button', { name: /^Connect/ }).first()); await sleep(900)
    const mock = page.getByText('Rabby').first()
    if (await mock.isVisible().catch(() => false)) { await tap(mock); await sleep(1100) }
  }
  const openSwap = async () => {
    await tap(page.locator('#app-tabbar').getByRole('button', { name: 'Trade' })); await sleep(1100)
    const intro = page.getByRole('button', { name: 'Get Started' })
    if (await intro.isVisible().catch(() => false)) { await tap(intro); await sleep(700) }
  }
  const pickTo = async (q) => {
    await tap(page.getByTestId('widget-to-token-button')); await sleep(900)
    await page.getByText('Select token').waitFor(); await sleep(300)
    await page.getByPlaceholder(/Search/).last().type(q, { delay: 110 * S }); await sleep(1100)
    const row = page.getByRole('button').filter({ hasText: new RegExp(q) }).filter({ hasNotText: /Swap|Bridge/ }).last()
    if (await row.isVisible().catch(() => false)) { await tap(row); await sleep(900) }
  }
  const amount = async (v) => { await type(page.locator('input[name="fromAmount"]'), v, 160) }
  const install = () => page.evaluate(() => window.dispatchEvent(new Event('verdex-install')))
  return { sleep, tap, scrollTo, go, type, connect, openSwap, pickTo, amount, install }
}

// Each clip: everything before `rec.start()` is setup; the part after it is the footage.
const CLIPS = {
  markets: async (h, rec) => {
    await h.go('/assets', 1800)
    rec.start()
    await h.sleep(900)
    await h.scrollTo(470, 1500); await h.sleep(900)
    await h.tap(h.page.getByText(/^Commodities/).first()); await h.sleep(1500)
    await h.tap(h.page.getByText(/^Stocks/).first()); await h.sleep(1200)
    await h.scrollTo(900, 1500); await h.sleep(1400)
  },
  search: async (h) => {
    await h.go('/assets', 1600)
    await h.scrollTo(470, 10); await h.sleep(300)
    h.rec.start()
    await h.sleep(500)
    await h.type(h.page.getByPlaceholder(/Search AAPL/), 'NVDA', 120); await h.sleep(1000)
    await h.scrollTo(640, 1300); await h.sleep(2600)
    await h.tap(h.page.getByRole('button', { name: /^Commodities/ }).or(h.page.getByText(/^Commodities/)).first()); await h.sleep(300)
    await h.page.getByPlaceholder(/Search AAPL/).fill(''); await h.sleep(100)
    await h.scrollTo(470, 10); await h.sleep(80)
    await h.type(h.page.getByPlaceholder(/Search AAPL/), 'gold', 120); await h.sleep(1000)
    await h.scrollTo(640, 1300); await h.sleep(2400)
  },
  swap: async (h) => {
    await h.openSwap(); await h.connect()
    h.rec.start()
    await h.sleep(600)
    await h.pickTo('NVDA')
    await h.amount('0.5'); await h.sleep(4200)
    await h.sleep(1200)
  },
  baskets: async (h) => {
    await h.go('/rwa-baskets', 1600)
    h.rec.start()
    await h.sleep(700)
    await h.scrollTo(560, 1500); await h.sleep(1200)
    await h.scrollTo(1100, 1500); await h.sleep(1000)
    await h.tap(h.page.getByRole('link', { name: 'Buy' }).first()); await h.sleep(1800)
    const intro = h.page.getByRole('button', { name: 'Get Started' })
    if (await intro.isVisible().catch(() => false)) { await h.tap(intro); await h.sleep(1400) }
    await h.sleep(1200)
  },
  lend: async (h) => {
    await h.go('/lend', 1600)
    h.rec.start()
    await h.sleep(800)
    await h.scrollTo(520, 1500); await h.sleep(1200)
    await h.tap(h.page.getByRole('tab', { name: 'Multiply' }).or(h.page.getByRole('button', { name: 'Multiply' })).first()); await h.sleep(1800)
    await h.scrollTo(900, 1400); await h.sleep(1400)
  },
  portfolio: async (h) => {
    await h.openSwap(); await h.connect()
    await h.go('/portfolio', 1800)
    h.rec.start()
    await h.sleep(1200)
    await h.scrollTo(330, 1500); await h.sleep(2800)
  },
  install: async (h) => {
    await h.go('/assets', 1600)
    h.rec.start()
    await h.sleep(600)
    await h.install(); await h.sleep(3200)
    await h.tap(h.page.getByRole('button', { name: 'Got it' })); await h.sleep(1000)
  },
}

const names = only.length ? only : Object.keys(CLIPS)
for (const name of names) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true })
  await ctx.addInitScript(SLOW); await ctx.addInitScript(WALLET_MOCK); await ctx.addInitScript(OVERLAY)
  const page = await ctx.newPage(); page.setDefaultTimeout(30000)
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, async (route) => {
    const req = route.request()
    try {
      const resp = await api.fetch(req.url(), { method: req.method(), headers: req.headers(), data: req.postData() ?? undefined, timeout: 20000 })
      const headers = Object.fromEntries(Object.entries(resp.headers()).filter(([k]) => !/^access-control-|^content-encoding$|^content-length$/i.test(k)))
      await route.fulfill({ status: resp.status(), headers: { ...headers, 'access-control-allow-origin': '*' }, body: await resp.body() })
    } catch { await route.abort() }
  })
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Animation.enable'); await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 / S })
  await ctx.addInitScript(() => { try { localStorage.setItem('verdex-install-seen', '1') } catch {} })
  await page.goto(`${base}/#/`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500)

  // Capture loop: grabs frames as fast as the browser encodes them and stamps each with clip time.
  const raw = path.join(outDir, `.raw-${name}`); fs.rmSync(raw, { recursive: true, force: true }); fs.mkdirSync(raw)
  const stamps = []
  let running = false, t0 = 0, loop
  const rec = {
    start() { t0 = Date.now(); running = true; loop = (async () => { let i = 0; while (running) { const buf = await page.screenshot({ type: 'jpeg', quality: 88 }); const t = (Date.now() - t0) / 1000 / S; fs.writeFileSync(path.join(raw, `${i}.jpg`), buf); stamps.push([t, i++]) } })() },
    async stop() { running = false; await loop },
  }
  const h = { ...helpers(page), page, rec }
  try { await CLIPS[name](h, rec) } catch (e) { console.log(`clip ${name} failed:`, e.message.split('\n')[0]) }
  await rec.stop()
  await ctx.close()

  // Resample to a steady 30 fps: each output frame takes the latest capture at or before its time.
  const frames = path.join(outDir, name); fs.rmSync(frames, { recursive: true, force: true }); fs.mkdirSync(frames)
  const dur = stamps.length ? stamps[stamps.length - 1][0] : 0
  const n = Math.floor(dur * FPS)
  let j = 0
  for (let k = 0; k < n; k++) {
    const t = k / FPS
    while (j + 1 < stamps.length && stamps[j + 1][0] <= t) j++
    fs.copyFileSync(path.join(raw, `${stamps[j][1]}.jpg`), path.join(frames, `${String(k).padStart(5, '0')}.jpg`))
  }
  fs.rmSync(raw, { recursive: true, force: true })
  const out = path.join(outDir, `phone-${name}.mp4`)
  await new Promise((r, rj) => spawn(ffmpeg, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(frames, '%05d.jpg'), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: 'inherit' }).on('close', (c) => (c ? rj(new Error('ffmpeg failed')) : r())))
  console.log(`wrote ${out}: ${n} frames, ${dur.toFixed(1)}s, ${(stamps.length / Math.max(dur, 0.01)).toFixed(1)} captures/s`)
}
// Frame counts per clip, read by app.html.
const index = {}
for (const name of Object.keys(CLIPS)) if (fs.existsSync(path.join(outDir, name))) index[name] = fs.readdirSync(path.join(outDir, name)).filter((f) => f.endsWith('.jpg')).length
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify({ fps: FPS, width: W * SCALE, height: H * SCALE, frames: index }, null, 2))
await browser.close()
