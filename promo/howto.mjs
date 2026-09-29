// Records one short how-to clip per feature on the real site (swap, bridge, baskets, private,
// slippage, lend, pools, flip), each 10 to 20 seconds at 1080p with a cursor and captions.
// Usage: node promo/howto.mjs [--only swap,flip] [--base http://localhost:4174] [--dir promo/howto]
import { chromium, request } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d }
const base = arg('--base', 'http://localhost:4174')
const outDir = arg('--dir', path.join(root, 'promo', 'howto'))
const only = arg('--only', '').split(',').filter(Boolean)
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
const OVERLAY = `addEventListener('DOMContentLoaded', () => {
  const st = document.createElement('style'); st.textContent = 'body > :not(#__cur):not(#__cap){zoom:1.3333}' + '#__cur{position:fixed;left:0;top:0;width:30px;height:30px;z-index:99999;pointer-events:none;filter:drop-shadow(0 3px 8px rgba(0,0,0,.6));transform:translate(-4px,-2px)}#__cur.dn{transform:translate(-4px,-2px) scale(.85)}#__cap{position:fixed;left:40px;bottom:40px;z-index:99998;pointer-events:none;max-width:760px;padding:18px 24px;border-radius:16px;background:rgba(14,14,14,.82);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid rgba(255,255,255,.1);box-shadow:0 20px 60px rgba(0,0,0,.5);font-family:Geist,system-ui,sans-serif;color:#fff;opacity:0;transform:translateY(14px);transition:opacity .35s ease,transform .35s ease}#__cap.on{opacity:1;transform:none}#__cap b{display:block;font-size:26px;font-weight:600;letter-spacing:-.01em}#__cap span{display:block;font-size:18px;color:rgba(255,255,255,.7);margin-top:4px}#__cap i{display:inline-block;width:9px;height:9px;border-radius:50%;background:#C2EA8A;margin-right:10px;vertical-align:middle}#__step{position:fixed;right:40px;bottom:44px;z-index:99998;pointer-events:none;font-family:Geist,system-ui,sans-serif;font-size:17px;font-weight:600;letter-spacing:.06em;color:#C2EA8A;background:rgba(14,14,14,.82);border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:8px 16px;opacity:0;transition:opacity .3s}#__step.on{opacity:1}'
  document.head.appendChild(st)
  const cur = document.createElement('div'); cur.id = '__cur'; cur.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M5 3l14 8-6.2 1.6L10 19z" fill="#fff" stroke="#060606" stroke-width="1.2" stroke-linejoin="round"/></svg>'
  const cap = document.createElement('div'); cap.id = '__cap'
  const step = document.createElement('div'); step.id = '__step'
  document.body.append(cur, cap, step)
  window.__curPos = { x: 960, y: 700 }
  window.__setCur = (x, y) => { window.__curPos = { x, y }; cur.style.left = x + 'px'; cur.style.top = y + 'px' }
  window.__setCur(960, 700)
  window.__press = (on) => cur.classList.toggle('dn', !!on)
  window.__cap = (t, s) => { if (!t) { cap.classList.remove('on'); return } cap.innerHTML = '<b><i></i>' + t + '</b>' + (s ? '<span>' + s + '</span>' : ''); cap.classList.add('on') }
  window.__step = (t) => { if (!t) { step.classList.remove('on'); return } step.textContent = t; step.classList.add('on') }
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
  const cap = async (t, s, hold = 0) => { await page.evaluate(([a, b]) => window.__cap(a, b), [t ?? '', s ?? '']); if (hold) await sleep(hold) }
  const step = async (t) => page.evaluate((v) => window.__step(v), t ?? '')
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
  return { sleep, moveTo, clickOn, scrollTo, cap, step, go, type, openWidget, connect, pickTo, amount, tab }
}

// Each clip: setup runs before the cut point, the scripted part after it is what ends up in the file.
const CLIPS = {
  swap: async (h) => {
    await h.openWidget(); await h.connect()
    const t0 = Date.now()
    await h.step('HOW TO: SWAP')
    await h.cap('1. Pick what to buy', 'Any tokenized stock, ETF or commodity.')
    await h.pickTo('NVDA')
    await h.cap('2. Enter an amount', 'The quote is priced live across 36 bridges and 37 DEXs.')
    await h.amount('0.5'); await h.sleep(4200)
    await h.cap('3. Check the route', 'DEXs, bridges, minimum received and fee, before you sign.', 2600)
    await h.cap('4. Sign once', 'The order swaps, bridges and buys in a single signature.', 2600)
    await h.cap(null); await h.sleep(500)
    return t0
  },
  bridge: async (h) => {
    await h.openWidget(); await h.connect()
    const t0 = Date.now()
    await h.step('HOW TO: BRIDGE')
    await h.cap('1. Open Bridge', 'Move funds between 70 chains in one step.')
    await h.tab('Bridge'); await h.sleep(600)
    await h.cap('2. Choose the destination', 'From Robinhood Chain to Arc, Base, Solana, Ethereum or any other.', 2000)
    await h.cap('3. Enter an amount', 'The best bridge is picked for you.')
    await h.amount('0.5'); await h.sleep(4200)
    await h.cap('4. One signature', 'Funds arrive on the other chain, no extra apps.', 2600)
    await h.cap(null); await h.sleep(500)
    return t0
  },
  baskets: async (h) => {
    await h.go('/rwa-baskets', 1400)
    const t0 = Date.now()
    await h.step('HOW TO: BASKETS')
    await h.cap('1. Pick a basket', 'A whole portfolio in one token, fully backed at published weights.')
    await h.scrollTo(640, 1200); await h.sleep(1000)
    await h.cap('2. Press Buy', 'The basket token is preselected in the swap.')
    await h.clickOn(page.getByRole('link', { name: 'Buy' }).first()); await h.sleep(1600)
    const intro = page.getByRole('button', { name: 'Get Started' })
    if (await intro.isVisible().catch(() => false)) { await h.clickOn(intro); await h.sleep(1200) }
    await h.connect(); await h.sleep(600)
    await h.cap('3. Enter an amount', 'Filled on a DEX, or minted on Reserve at published weights when no pool has it.')
    await h.amount('0.5'); await h.sleep(3800)
    await h.cap('4. Redeem any time', 'The basket can be redeemed for the tokens inside it.', 2400)
    await h.cap(null); await h.sleep(500)
    return t0
  },
  private: async (h) => {
    await h.openWidget(); await h.connect()
    const t0 = Date.now()
    await h.step('HOW TO: PRIVATE')
    await h.cap('1. Open Private', 'Send to a separate address you control.')
    await h.tab('Private'); await h.sleep(600)
    await h.cap('2. Enter the receiving address', 'Funds are routed through partner liquidity and settle there.')
    const rec = page.getByPlaceholder(/separate address/)
    await h.type(rec, '0x7a3F9c2E1b8D4a6C5e0F1b2C3d4E5f6A7b8C9d0E', 26); await h.sleep(800)
    await h.cap('3. Enter an amount and sign', 'Funds are routed through partner liquidity. Allow 15 to 45 minutes cross-chain.', 3200)
    await h.cap('4. Settles at the receiving address', 'Nothing links the sending and receiving addresses onchain.', 2800)
    await h.cap(null); await h.sleep(500)
    return t0
  },
  slippage: async (h) => {
    await h.openWidget(); await h.connect(); await h.pickTo('NVDA'); await h.amount('0.5'); await h.sleep(3800)
    const t0 = Date.now()
    await h.step('HOW TO: SLIPPAGE')
    await h.cap('1. Open settings', 'The gear at the top of the widget.')
    await h.clickOn(page.getByRole('button', { name: 'Settings' })); await h.sleep(900)
    await h.cap('2. Pick a tolerance', '0.1% for deep pools, 1% for thin ones.')
    await h.clickOn(page.getByRole('button', { name: '0.1%', exact: true })); await h.sleep(1300)
    await h.clickOn(page.getByRole('button', { name: '1%', exact: true })); await h.sleep(1300)
    await h.cap('3. Minimum received updates', 'The order reverts if the price moves past it.', 2600)
    await h.clickOn(page.getByRole('button', { name: 'Settings' })); await h.sleep(800)
    await h.cap(null); await h.sleep(400)
    return t0
  },
  lend: async (h) => {
    await h.go('/lend', 1600)
    const t0 = Date.now()
    await h.step('HOW TO: LEND AND BORROW')
    await h.cap('1. Pick a market', 'xStocks, STRCx and Sentora markets on Kamino.')
    await h.scrollTo(560, 1300); await h.sleep(1200)
    await h.cap('2. Supply', 'Deposit a stock token and earn the supply APY.')
    await h.moveTo(1240, 690, 700); await h.sleep(1500)
    await h.cap('3. Borrow', 'Borrow against it, up to the liquidation LTV shown.')
    await h.moveTo(1560, 690, 600); await h.sleep(1600)
    await h.cap('4. Or Multiply', 'Lever the position up in one transaction.')
    await h.clickOn(page.getByText('Multiply', { exact: true }).first()); await h.sleep(2400)
    await h.cap(null); await h.sleep(400)
    return t0
  },
  pools: async (h) => {
    await h.go('/rwa-pools', 1500)
    const t0 = Date.now()
    await h.step('HOW TO: POOLS')
    await h.cap('1. Find the pool', '19 pools where tokenized stocks trade, with liquidity, volume and fee APR.')
    await h.scrollTo(420, 1200); await h.sleep(1200)
    await h.cap('2. Filter by chain', 'Robinhood Chain, Base, Solana, BNB Chain.')
    await h.clickOn(page.getByText('Base', { exact: true }).first()); await h.sleep(1600)
    await h.clickOn(page.getByText('All chains', { exact: true }).first()); await h.sleep(1000)
    await h.cap('3. Deposit', 'One transaction on the DEX, from your own wallet.', 2600)
    await h.cap(null); await h.sleep(400)
    return t0
  },
  markets: async (h) => {
    await h.go('/assets', 1600)
    const t0 = Date.now()
    await h.step('HOW TO: MARKETS')
    await h.cap('1. One list', '226 real-world assets from 12 issuers. Most traded, top by market cap, most available.', 2200)
    await h.scrollTo(560, 1200); await h.sleep(600)
    await h.cap('2. Filter by category', 'Stocks, ETFs, commodities, private credit, treasuries.')
    await h.clickOn(page.getByText(/^Commodities/).first()); await h.sleep(1400)
    await h.clickOn(page.getByText(/^Stocks/).first()); await h.sleep(1000)
    await h.cap('3. Filter by issuer', 'Only Ondo, only xStocks, only Robinhood, or all of them.')
    await h.clickOn(page.getByText('Ondo', { exact: true }).first()); await h.sleep(1400)
    await h.clickOn(page.getByText('All issuers', { exact: true }).first()); await h.sleep(800)
    await h.cap('4. Or search', 'A ticker, a company name, gold, SpaceX.')
    await h.type(page.getByPlaceholder(/Search AAPL/), 'gold', 130); await h.sleep(2200)
    await h.cap(null); await h.sleep(400)
    return t0
  },
  asset: async (h) => {
    await h.go('/assets', 1400)
    const t0 = Date.now()
    await h.step('HOW TO: ONE STOCK, EVERY ISSUER')
    await h.cap('1. Search a stock', 'NVDA, for example.')
    await h.scrollTo(560, 1000); await h.sleep(400)
    await h.type(page.getByPlaceholder(/Search AAPL/), 'NVDA', 130); await h.sleep(1200)
    await h.cap('2. Open it', 'The row shows its issuers and chains at a glance.')
    await h.clickOn(page.locator('a[href*="/assets/NVDA"]').first()); await h.sleep(2000)
    await h.cap('3. Every version, side by side', 'NVDAon, NVDAx, NVDAB, NVDA: each issuer and chain with its own price.')
    await h.scrollTo(420, 1200); await h.sleep(2400)
    await h.cap('4. Pick one and trade', 'The one with the best price, or the chain you already use.', 2400)
    await h.cap(null); await h.sleep(400)
    return t0
  },
  discover: async (h) => {
    await h.go('/rwa-baskets/discover', 1600)
    const t0 = Date.now()
    await h.step('HOW TO: DISCOVER BASKETS')
    await h.cap('1. Every basket in one table', 'Index and automated baskets, with holdings, market cap, price and 30-day return.', 2200)
    await h.cap('2. Filter by kind', 'Index baskets are one token. Automated baskets rebalance on a schedule.')
    await h.clickOn(page.getByText('Index', { exact: true }).first()); await h.sleep(1400)
    await h.clickOn(page.getByText('Automated', { exact: true }).first()); await h.sleep(1400)
    await h.clickOn(page.getByText('All', { exact: true }).first()); await h.sleep(800)
    await h.cap('3. Filter by chain', 'Only the chains you already use.')
    await h.clickOn(page.getByText('Base', { exact: true }).first()); await h.sleep(1600)
    await h.cap('4. Open one to buy', 'Holdings, weights, fees and the buy button.', 2200)
    await h.cap(null); await h.sleep(400)
    return t0
  },
  issuers: async (h) => {
    await h.go('/issuers', 1600)
    const t0 = Date.now()
    await h.step('HOW TO: ISSUERS')
    await h.cap('1. Who issues what', 'Ondo, xStocks, bStocks, Robinhood, Coinbase, Backed, Tether, Paxos, Maple, Ethena, USD.AI, Theo.', 2400)
    await h.scrollTo(520, 1400); await h.sleep(1400)
    await h.cap('2. Suffixes explained', 'NVDAon is Ondo, NVDAx is xStocks, NVDAB is bStocks. Same stock, different issuer.', 2600)
    await h.scrollTo(1000, 1400); await h.sleep(1200)
    await h.cap('3. One aggregator', 'Verdex lists all of them side by side, so you never pick an issuer blind.', 2400)
    await h.cap(null); await h.sleep(400)
    return t0
  },
  wallet: async (h) => {
    await h.openWidget()
    const t0 = Date.now()
    await h.step('HOW TO: CONNECT')
    await h.cap('1. Press Connect', 'Every wallet you have installed is detected automatically.')
    await h.clickOn(page.getByRole('button', { name: /^Connect/ }).first()); await h.sleep(1400)
    await h.cap('2. Pick one', 'MetaMask, Rabby, Coinbase Wallet, Phantom, any EIP-6963 wallet.')
    const mock = page.getByText('Rabby').first()
    if (await mock.isVisible().catch(() => false)) { await h.clickOn(mock); await h.sleep(1400) }
    await h.cap('3. Connected', 'Your address and chain show at the top. Switch chains from there.')
    await h.moveTo(1560, 36, 700); await h.sleep(1800)
    await h.cap('4. Non-custodial', 'Verdex never holds funds. Every transaction is signed in your own wallet.', 2600)
    await h.cap(null); await h.sleep(400)
    return t0
  },
  portfolio: async (h) => {
    await h.openWidget(); await h.connect()
    await h.go('/portfolio', 1800)
    const t0 = Date.now()
    await h.step('HOW TO: PORTFOLIO')
    await h.cap('1. Everything you hold', 'Balances across every chain, from the wallet you connected.', 2400)
    await h.scrollTo(420, 1200); await h.sleep(1200)
    await h.cap('2. Baskets and lending', 'Basket tokens and lending positions, in the same view.', 2400)
    await h.cap('3. Activity', 'Every swap, bridge and deposit, with explorer links.', 2400)
    await h.cap(null); await h.sleep(400)
    return t0
  },
  docs: async (h) => {
    await h.go('/docs', 1600)
    const t0 = Date.now()
    await h.step('HOW TO: DOCS')
    await h.cap('1. How every part works', 'Swap and bridge, baskets, lending, pools, fees and safety.', 2200)
    await h.scrollTo(700, 1500); await h.sleep(1400)
    await h.cap('2. Fees, in plain numbers', 'The Verdex fee, gas, and what each source charges.')
    await h.scrollTo(1500, 1600); await h.sleep(1600)
    await h.cap('3. Safety', 'What Verdex can and cannot do with your funds. Short answer: nothing without your signature.')
    await h.scrollTo(2300, 1600); await h.sleep(2000)
    await h.cap(null); await h.sleep(400)
    return t0
  },
  ca: async (h) => {
    await h.go('/', 1500)
    const t0 = Date.now()
    await h.step('HOW TO: THE CA')
    await h.cap('1. It is on the site', 'Under the buttons on the home page and at the bottom of every page.', 2000)
    await h.cap('2. One click copies it', 'Never copy it from replies.')
    await h.clickOn(page.getByRole('button', { name: /Copy contract address/ }).first(), { ms: 900 }); await h.sleep(1800)
    await h.cap('3. Check it matches', '0x96f455a90a80dcf0c2df6703ea4ba3bedf286e43', 2800)
    await h.cap(null); await h.sleep(400)
    return t0
  },
  flip: async (h) => {
    await h.openWidget(); await h.connect(); await h.pickTo('NVDA'); await h.amount('0.5'); await h.sleep(3800)
    const t0 = Date.now()
    await h.step('HOW TO: FLIP')
    await h.cap('1. You are buying NVDA with ETH', 'The quote and route are live.', 1800)
    await h.cap('2. Press the arrows', 'Send and receive swap places.')
    await h.clickOn(page.getByTestId('widget-swap-tokens-button')); await h.sleep(1400)
    await h.cap('3. Now you are selling NVDA', 'Enter an amount and the route reprices.')
    await h.amount('2'); await h.sleep(4000)
    await h.cap('Buy or sell, same widget', 'One signature either way.', 2200)
    await h.cap(null); await h.sleep(400)
    return t0
  },
}

let page
const names = only.length ? only : Object.keys(CLIPS)
for (const name of names) {
  const tmp = fs.mkdtempSync(path.join(outDir, '.rec-'))
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: tmp, size: { width: 1920, height: 1080 } }, ignoreHTTPSErrors: true })
  await ctx.addInitScript(WALLET_MOCK); await ctx.addInitScript(OVERLAY)
  page = await ctx.newPage(); page.setDefaultTimeout(20000)
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
  const h = helpers(page)
  let t0 = start
  try { t0 = await CLIPS[name](h) } catch (e) { console.log(`clip ${name} failed:`, e.message.split('\n')[0]) }
  await page.close()
  const video = await page.video().path()
  await ctx.close()
  const cut = Math.max(0, (t0 - start) / 1000 - 0.3)
  const out = path.join(outDir, `howto-${name}.mp4`)
  await new Promise((r, j) => spawn(ffmpeg, ['-y', '-loglevel', 'error', '-ss', cut.toFixed(2), '-i', video, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', out], { stdio: 'inherit' }).on('close', (c) => (c ? j(new Error('ffmpeg failed')) : r())))
  fs.rmSync(tmp, { recursive: true, force: true })
  console.log('wrote', out, `(cut at ${cut.toFixed(1)}s)`)
}
await browser.close()
