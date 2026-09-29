// Records clean clips of the real site (cursor only, no captions) for the showcase films, one folder
// per theme, and extracts each clip to 30 fps frames that showcase.html plays inside a window.
// Usage: node promo/showcase.mjs [--theme markets,trade,invest] [--base http://localhost:4174] [--dir promo/showcase]
import { chromium, request } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d }
const base = arg('--base', 'http://localhost:4174')
const outDir = arg('--dir', path.join(root, 'promo', 'showcase'))
const themes = arg('--theme', 'markets,trade,invest').split(',').filter(Boolean)
const ffmpeg = process.env.FFMPEG ?? 'ffmpeg'
const FPS = 30, FW = 1440, FH = 810
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
  try { localStorage.setItem('verdex-install-seen', '1'); localStorage.setItem('verdex-swap-intro-seen', '1') } catch {}
})()`
const OVERLAY = `addEventListener('DOMContentLoaded', () => {
  const st = document.createElement('style'); st.textContent = 'body > :not(#__cur){zoom:1.3333}::-webkit-scrollbar{display:none}#__cur{position:fixed;left:0;top:0;width:30px;height:30px;z-index:99999;pointer-events:none;filter:drop-shadow(0 3px 8px rgba(0,0,0,.6));transform:translate(-4px,-2px);transition:transform .12s}#__cur.dn{transform:translate(-4px,-2px) scale(.85)}'
  document.head.appendChild(st)
  const cur = document.createElement('div'); cur.id = '__cur'; cur.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M5 3l14 8-6.2 1.6L10 19z" fill="#fff" stroke="#060606" stroke-width="1.2" stroke-linejoin="round"/></svg>'
  document.body.append(cur)
  window.__curPos = { x: 960, y: 700 }
  window.__setCur = (x, y) => { window.__curPos = { x, y }; cur.style.left = x + 'px'; cur.style.top = y + 'px' }
  window.__setCur(960, 700)
  window.__press = (on) => cur.classList.toggle('dn', !!on)
})`

const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2)
function helpers(page) {
  const sleep = (ms) => page.waitForTimeout(ms)
  const moveTo = async (x, y, ms = 650) => {
    const from = await page.evaluate(() => window.__curPos)
    const n = Math.max(8, Math.round(ms / 16))
    for (let i = 1; i <= n; i++) { const p = ease(i / n); const cx = from.x + (x - from.x) * p, cy = from.y + (y - from.y) * p; await page.evaluate(([a, b]) => window.__setCur(a, b), [cx, cy]); await page.mouse.move(cx, cy); await sleep(16) }
  }
  const clickOn = async (locator, { ms = 650, hold = 150 } = {}) => {
    await locator.scrollIntoViewIfNeeded()
    const b = await locator.boundingBox(); if (!b) throw new Error('no box')
    const x = b.x + b.width / 2, y = b.y + b.height / 2
    await moveTo(x, y, ms); await page.evaluate(() => window.__press(true)); await sleep(hold); await page.mouse.click(x, y); await page.evaluate(() => window.__press(false))
  }
  const scrollTo = async (y0, ms = 1200) => {
    const y = y0 * 1.3333, from = await page.evaluate(() => window.scrollY), n = Math.round(ms / 16)
    for (let i = 1; i <= n; i++) { await page.evaluate((v) => window.scrollTo(0, v), from + (y - from) * ease(i / n)); await sleep(16) }
  }
  const go = async (route, wait = 1600) => { await page.evaluate((r) => { location.hash = '#' + r; window.scrollTo(0, 0) }, route); await sleep(wait) }
  const type = async (locator, text, delay = 90) => { await clickOn(locator); await sleep(120); await locator.type(text, { delay }) }
  const openWidget = async () => {
    await go('/', 800)
    await clickOn(page.getByRole('button', { name: 'Swap and Bridge' }).first()); await sleep(1100)
    const intro = page.getByRole('button', { name: 'Get Started' })
    if (await intro.isVisible().catch(() => false)) { await clickOn(intro); await sleep(600) }
  }
  const connect = async () => {
    await clickOn(page.getByRole('button', { name: /^Connect/ }).first()); await sleep(900)
    const mock = page.getByText('Rabby').first()
    if (await mock.isVisible().catch(() => false)) { await clickOn(mock); await sleep(1100) }
  }
  const pickTo = async (q) => {
    await clickOn(page.getByTestId('widget-to-token-button')); await sleep(900)
    await page.getByText('Select token').waitFor(); await sleep(400)
    await page.getByPlaceholder(/Search/).last().type(q, { delay: 110 }); await sleep(1100)
    const row = page.getByRole('button').filter({ hasText: new RegExp(q) }).filter({ hasNotText: /Swap|Bridge/ }).last()
    if (await row.isVisible().catch(() => false)) { await clickOn(row); await sleep(900) }
  }
  const amount = async (v) => { await type(page.locator('input[name="fromAmount"]'), v, 150) }
  const tab = async (name) => { await clickOn(page.getByRole('tab', { name })); await sleep(900) }
  const failed = () => page.getByText(/Rate limit|No route|failed|cannot be prepared/i).count().then((n) => n > 0)
  return { sleep, moveTo, clickOn, scrollTo, go, type, openWidget, connect, pickTo, amount, tab, failed, page }
}

// Each clip: setup before `t0`, footage after it. A clip may return { t0, retry: true } to be recorded again after a pause.
const THEMES = {
  markets: {
    landing: async (h) => { await h.go('/', 1800); const t0 = Date.now(); await h.sleep(2200); await h.scrollTo(520, 2200); await h.sleep(900); await h.scrollTo(1250, 2200); await h.sleep(1400); return t0 },
    assets: async (h) => { await h.go('/assets', 1600); const t0 = Date.now(); await h.sleep(900); await h.scrollTo(560, 1400); await h.sleep(700); await h.clickOn(h.page.getByText(/^Commodities/).first()); await h.sleep(1500); await h.clickOn(h.page.getByText(/^Stocks/).first()); await h.sleep(1200); await h.scrollTo(1000, 1400); await h.sleep(1200); return t0 },
    search: async (h) => { await h.go('/assets', 1400); await h.scrollTo(560, 10); const t0 = Date.now(); await h.sleep(500); await h.type(h.page.getByPlaceholder(/Search AAPL/), 'NVDA', 120); await h.sleep(2200); await h.page.getByPlaceholder(/Search AAPL/).fill(''); await h.sleep(400); await h.type(h.page.getByPlaceholder(/Search AAPL/), 'gold', 120); await h.sleep(2400); return t0 },
    issuers: async (h) => { await h.go('/issuers', 1600); const t0 = Date.now(); await h.sleep(1400); await h.scrollTo(520, 1600); await h.sleep(1200); await h.scrollTo(1100, 1600); await h.sleep(1400); return t0 },
    discover: async (h) => { await h.go('/rwa-baskets/discover', 1600); const t0 = Date.now(); await h.sleep(1200); await h.clickOn(h.page.getByText('Index', { exact: true }).first()); await h.sleep(1400); await h.clickOn(h.page.getByText('All', { exact: true }).first()); await h.sleep(600); await h.scrollTo(500, 1400); await h.sleep(1500); return t0 },
  },
  trade: {
    wallet: async (h) => { await h.openWidget(); const t0 = Date.now(); await h.sleep(600); await h.clickOn(h.page.getByRole('button', { name: /^Connect/ }).first()); await h.sleep(1500); const mock = h.page.getByText('Rabby').first(); if (await mock.isVisible().catch(() => false)) { await h.clickOn(mock); await h.sleep(1400) } await h.moveTo(1560, 36, 700); await h.sleep(1400); return t0 },
    swap: async (h) => { await h.openWidget(); await h.connect(); const t0 = Date.now(); await h.sleep(500); await h.pickTo('NVDA'); await h.amount('0.5'); await h.sleep(4200); const retry = await h.failed(); await h.sleep(2200); return { t0, retry } },
    bridge: async (h) => { await h.openWidget(); await h.connect(); const t0 = Date.now(); await h.sleep(400); await h.tab('Bridge'); await h.sleep(800); await h.amount('0.5'); await h.sleep(4200); const retry = await h.failed(); await h.sleep(1800); return { t0, retry } },
    private: async (h) => { await h.openWidget(); await h.connect(); const t0 = Date.now(); await h.sleep(400); await h.tab('Private'); await h.sleep(1000); await h.type(h.page.getByPlaceholder(/0x|address/i).first(), '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', 28); await h.sleep(2200); return t0 },
    slippage: async (h) => { await h.openWidget(); await h.connect(); const t0 = Date.now(); await h.sleep(400); await h.clickOn(h.page.getByRole('button', { name: 'Settings' })); await h.sleep(1000); await h.clickOn(h.page.getByRole('button', { name: '0.1%' })); await h.sleep(900); await h.clickOn(h.page.getByRole('button', { name: '1%' })); await h.sleep(1200); await h.clickOn(h.page.getByRole('button', { name: '0.5%' })); await h.sleep(1200); return t0 },
  },
  invest: {
    baskets: async (h) => { await h.go('/rwa-baskets', 1600); const t0 = Date.now(); await h.sleep(1000); await h.scrollTo(640, 1600); await h.sleep(1200); await h.scrollTo(1300, 1600); await h.sleep(1600); return t0 },
    lend: async (h) => { await h.go('/lend', 1600); const t0 = Date.now(); await h.sleep(1000); await h.scrollTo(520, 1400); await h.sleep(900); await h.clickOn(h.page.getByRole('tab', { name: 'Multiply' }).or(h.page.getByRole('button', { name: 'Multiply' })).first()); await h.sleep(1600); await h.scrollTo(900, 1400); await h.sleep(1200); return t0 },
    pools: async (h) => { await h.go('/rwa-pools', 1600); const t0 = Date.now(); await h.sleep(1000); await h.scrollTo(600, 1600); await h.sleep(1200); await h.scrollTo(1200, 1600); await h.sleep(1400); return t0 },
    autoinvest: async (h) => { await h.go('/auto-invest', 1800); await h.connect(); await h.scrollTo(0, 10); const t0 = Date.now(); await h.sleep(800); await h.clickOn(h.page.getByRole('button', { name: '$250' })); await h.sleep(900); await h.clickOn(h.page.getByRole('button', { name: 'Every two weeks' })); await h.sleep(900); await h.clickOn(h.page.getByRole('button', { name: /USDG on Robinhood Chain/ })); await h.sleep(1000); await h.clickOn(h.page.getByRole('button', { name: /^Start on/ })); await h.sleep(2600); return t0 },
    portfolio: async (h) => { await h.openWidget(); await h.connect(); await h.go('/portfolio', 1800); const t0 = Date.now(); await h.sleep(1400); await h.scrollTo(420, 1400); await h.sleep(2000); return t0 },
  },
}

const run = (args) => new Promise((r, j) => spawn(ffmpeg, ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' }).on('close', (c) => (c ? j(new Error('ffmpeg failed')) : r())))
for (const theme of themes) {
  const dir = path.join(outDir, theme); fs.mkdirSync(dir, { recursive: true })
  const index = { fps: FPS, width: FW, height: FH, clips: {} }
  for (const [name, clip] of Object.entries(THEMES[theme])) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const tmp = fs.mkdtempSync(path.join(outDir, '.rec-'))
      const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: tmp, size: { width: 1920, height: 1080 } }, ignoreHTTPSErrors: true })
      await ctx.addInitScript(WALLET_MOCK); await ctx.addInitScript(OVERLAY)
      const page = await ctx.newPage(); page.setDefaultTimeout(20000)
      await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, async (route) => {
        const req = route.request()
        try {
          const resp = await api.fetch(req.url(), { method: req.method(), headers: req.headers(), data: req.postData() ?? undefined, timeout: 20000 })
          const headers = Object.fromEntries(Object.entries(resp.headers()).filter(([k]) => !/^access-control-|^content-encoding$|^content-length$/i.test(k)))
          await route.fulfill({ status: resp.status(), headers: { ...headers, 'access-control-allow-origin': '*' }, body: await resp.body() })
        } catch { await route.abort() }
      })
      const start = Date.now()
      await page.goto(`${base}/#/`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500)
      let t0 = start, retry = false
      try { const r = await clip(helpers(page)); if (typeof r === 'object') { t0 = r.t0; retry = r.retry } else t0 = r } catch (e) { console.log(`clip ${theme}/${name} failed:`, e.message.split('\n')[0]); retry = attempt < 3 }
      await page.close()
      const video = await page.video().path()
      await ctx.close()
      if (retry && attempt < 3) { fs.rmSync(tmp, { recursive: true, force: true }); console.log(`retrying ${theme}/${name} in 70s`); await new Promise((r) => setTimeout(r, 70_000)); continue }
      const cut = Math.max(0, (t0 - start) / 1000 - 0.2)
      const frames = path.join(dir, name); fs.rmSync(frames, { recursive: true, force: true }); fs.mkdirSync(frames)
      await run(['-ss', cut.toFixed(2), '-i', video, '-vf', `fps=${FPS},scale=${FW}:${FH}`, '-q:v', '4', path.join(frames, '%05d.jpg')])
      fs.rmSync(tmp, { recursive: true, force: true })
      index.clips[name] = fs.readdirSync(frames).length
      console.log(`${theme}/${name}: ${index.clips[name]} frames`)
      break
    }
  }
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index, null, 2))
}
await browser.close()
