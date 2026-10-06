// Verdex Agent: natural language in, proposals out. The user brings their own model key (Anthropic or
// OpenAI), kept only in this browser and sent only to that provider. The agent reads Verdex's market
// snapshot, the live price feed and the connected wallet through a fixed set of tools, and every action
// it wants to take comes back as a proposal: an order, an Auto-Invest plan or a vault. Nothing is placed,
// scheduled or created until the user approves the card, and execution then runs through the same
// engines the buttons use, so the wallet still confirms every trade. Without a key, a small rules-based
// helper answers the common requests so the flow can be tried.
import { formatUnits, type Address } from 'viem'
import type Anthropic from '@anthropic-ai/sdk'
import { ROBINHOOD, type Asset, type AssetToken } from './api'
import { readBalance, type ChainX } from './lifi'
import { CADENCES, PAY_TOKENS, addPlan, firstRunAt, getPlans, tokenPrice, type Cadence, type PlanToken } from './autoInvest'
import { EXPIRIES, addOrder, describe, getOrders, isLive, nowMs, type Side, type Trigger } from './orders'
import { RULES, TEMPLATES, addVault, defaultQuote, getVaults, nextRunAfter, normalise, toVaultAsset, type Rule, type VaultAsset } from './vaults'

// Provider setup. The key lives in localStorage on this device only.
export type Provider = 'anthropic' | 'openai' | 'demo'
export type AgentConfig = { provider: Provider; key: string; model: string }
export const PROVIDERS: { key: Provider; label: string; model: string; hint: string; keysUrl?: string }[] = [
  { key: 'anthropic', label: 'Anthropic', model: 'claude-opus-5-5', hint: 'sk-ant-…', keysUrl: 'https://console.anthropic.com/settings/keys' },
  { key: 'openai', label: 'OpenAI', model: 'gpt-5', hint: 'sk-…', keysUrl: 'https://platform.openai.com/api-keys' },
  { key: 'demo', label: 'No key', model: '', hint: '' },
]
const KEY = 'verdex-agent-key'
export function loadConfig(): AgentConfig {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<AgentConfig>
      if (p && typeof p === 'object' && PROVIDERS.some((x) => x.key === p.provider)) return { provider: p.provider as Provider, key: p.key ?? '', model: p.model ?? '' }
    }
  } catch {
    /* storage unavailable */
  }
  return { provider: 'demo', key: '', model: '' }
}
export function saveConfig(c: AgentConfig) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c))
  } catch {
    /* storage unavailable */
  }
}
export function clearConfig() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* storage unavailable */
  }
}
export const modelFor = (c: AgentConfig) => c.model.trim() || PROVIDERS.find((p) => p.key === c.provider)?.model || ''
export const ready = (c: AgentConfig) => c.provider === 'demo' || c.key.trim().length > 10

// What the agent hands back. A proposal is complete: approving it needs nothing but the wallet address.
type Base = { id: string; status: 'pending' | 'approved' | 'dismissed'; summary: string; note?: string }
export type OrderProposal = Base & { kind: 'order'; ticker: string; name: string; logo?: string; asset: PlanToken; quote: PlanToken; chain: string; side: Side; trigger: Trigger; price: number; amountUsd?: number; units?: number; expiry: string; current?: number }
export type PlanProposal = Base & { kind: 'plan'; ticker: string; name: string; logo?: string; target: PlanToken; pay: PlanToken; chain: string; amountUsd: number; cadence: Cadence; buyNow: boolean; firstAt: number; current?: number }
export type VaultProposal = Base & { kind: 'vault'; name: string; chainId: number; chain: string; quote: PlanToken; assets: VaultAsset[]; rule: Rule; threshold: number; template?: string }
export type MandateProposal = Base & { kind: 'mandate'; rule: 'dip' | 'trend' | 'profit' | 'loss'; ruleName: string; side: 'buy' | 'sell'; paramBps: number; tickers: string[]; perTrade: number; perDay: number; budget: number; cooldown: number; expires: number; chain: string }
export type Proposal = OrderProposal | PlanProposal | VaultProposal | MandateProposal
export type AgentEvent = { type: 'text'; text: string } | { type: 'tool'; name: string; label: string } | { type: 'proposal'; proposal: Proposal } | { type: 'error'; message: string }
export type ToolCtx = { assets: Asset[]; chains: ChainX[] | undefined; account?: { address: Address; chainId: number }; holder: boolean }

export const SUGGESTIONS = ['Buy $250 of NVDA if it drops 5%', 'Let the agent buy NVDA and AMD dips with $500', 'Every week put $100 into SPY', 'Set a stop-loss on my TSLA at $380', 'Build an AI vault: NVDA 40, AMD 30, TSM 30', 'What do I hold?', "What's gold trading at?"]

// Approve a proposal: the same store the page buttons write to, so the card shows up where it belongs.
export function approve(p: Proposal, owner: Address): string {
  if (p.kind === 'order') {
    const exp = EXPIRIES.find((e) => e.key === p.expiry) ?? EXPIRIES[0]
    addOrder({ owner, ticker: p.ticker, name: p.name, logo: p.logo, asset: p.asset, quote: p.quote, side: p.side, trigger: p.trigger, price: p.price, amountUsd: p.side === 'buy' ? p.amountUsd : undefined, units: p.side === 'sell' ? p.units : undefined, expiresAt: exp.ms ? nowMs() + exp.ms : 0, lastPrice: p.current })
    return '/orders#orders'
  }
  if (p.kind === 'plan') {
    addPlan({ owner, ticker: p.ticker, name: p.name, logo: p.logo, target: p.target, pay: p.pay, amountUsd: p.amountUsd, cadence: p.cadence, nextRunAt: firstRunAt(p.buyNow, p.cadence) })
    return '/auto-invest#plans'
  }
  if (p.kind === 'mandate') return mandateUrl(p)
  addVault({ owner, name: p.name, template: p.template, chainId: p.chainId, quote: p.quote, assets: p.assets, rule: p.rule, threshold: p.threshold, nextRunAt: nextRunAfter(Date.now(), p.rule) })
  return '/vaults#vaults'
}

// The Agent without you page reads a draft from the query string: the contract is signed there, never from here.
export const mandateUrl = (p: MandateProposal) => `/agent/without-you?${new URLSearchParams({ rule: p.rule, param: String(p.paramBps), tokens: p.tickers.join(','), perTrade: String(p.perTrade), perDay: String(p.perDay), budget: String(p.budget), cooldown: String(p.cooldown), expires: String(p.expires) })}#agent-composer`
const MANDATE_RULES = { dip: { name: 'Buy the dips', side: 'buy', dir: 'down' }, trend: { name: 'Buy strength', side: 'buy', dir: 'up' }, profit: { name: 'Take profits', side: 'sell', dir: 'up' }, loss: { name: 'Cut losses', side: 'sell', dir: 'down' } } as const
export const SUGGESTION_MANDATE = 'Let the agent buy NVDA and AMD dips with $500'

// Asset lookup. Plain words map to the ticker people mean.
const ALIASES: Record<string, string> = { nvidia: 'NVDA', apple: 'AAPL', microsoft: 'MSFT', google: 'GOOGL', alphabet: 'GOOGL', amazon: 'AMZN', meta: 'META', facebook: 'META', tesla: 'TSLA', gold: 'GLD', silver: 'SLV', bitcoin: 'IBIT', btc: 'IBIT', 'sp500': 'SPY', 's&p': 'SPY', 's&p500': 'SPY', 'the s&p 500': 'SPY', 's&p 500': 'SPY', nasdaq: 'QQQ', 'nasdaq 100': 'QQQ', treasuries: 'SGOV', treasury: 'SGOV', 'treasury bills': 'SGOV', tbills: 'SGOV', 't-bills': 'SGOV', oil: 'USO', spacex: 'SPCX', coinbase: 'COIN', microstrategy: 'MSTR', strategy: 'MSTR', palantir: 'PLTR', broadcom: 'AVGO', tsmc: 'TSM', micron: 'MU', netflix: 'NFLX', costco: 'COST', lilly: 'LLY', 'eli lilly': 'LLY', crowdstrike: 'CRWD', 'rocket lab': 'RKLB', robinhood: 'HOOD', circle: 'CRCL', berkshire: 'BRK.B', jpmorgan: 'JPM', 'jp morgan': 'JPM', intel: 'INTC', qualcomm: 'QCOM', shopify: 'SHOP', alibaba: 'BABA', asml: 'ASML', 'applied materials': 'AMAT' }
export function findAssets(assets: Asset[], query: string, limit = 8): Asset[] {
  const q = query.trim().toLowerCase().replace(/^\$/, '')
  if (!q) return []
  const alias = ALIASES[q]
  const score = (a: Asset) => {
    const tk = a.ticker.toLowerCase(), nm = a.name.toLowerCase()
    if (tk === q || (alias && a.ticker === alias)) return 0
    if (nm === q) return 1
    if (tk.startsWith(q)) return 2
    if (nm.startsWith(q)) return 3
    if (nm.includes(q)) return 4
    if (q.length >= 3 && tk.includes(q)) return 5
    return 9
  }
  return assets
    .map((a) => ({ a, s: score(a) }))
    .filter((x) => x.s < 9)
    .sort((x, y) => x.s - y.s || y.a.marketCap - x.a.marketCap)
    .slice(0, limit)
    .map((x) => x.a)
}
const SOLANA = 1151111081099710
const evmIds = (ctx: ToolCtx) => new Set(ctx.chains ? ctx.chains.filter((c) => c.chainType === 'EVM').map((c) => c.id) : [ROBINHOOD, 8453, 42161, 1, 56, 999, 10, 137])
// The version of an asset to act on: Robinhood Chain first, then the wallet's chain, then any EVM chain.
export function pickVersion(a: Asset, ctx: ToolCtx): AssetToken | undefined {
  const ids = evmIds(ctx)
  const v = a.tokens.filter((tk) => tk.chainId !== SOLANA && ids.has(tk.chainId))
  return v.find((tk) => tk.chainId === ROBINHOOD) ?? v.find((tk) => tk.chainId === ctx.account?.chainId) ?? v.find((tk) => PAY_TOKENS.some((p) => p.chainId === tk.chainId)) ?? v[0]
}
const toPlanToken = (v: AssetToken): PlanToken => ({ chainId: v.chainId, address: v.address, symbol: v.symbol, decimals: v.decimals, issuer: v.issuer })
const chainName = (ctx: ToolCtx, id: number, fallback?: string) => ctx.chains?.find((c) => c.id === id)?.name ?? fallback ?? `chain ${id}`
const usd = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: n >= 100 ? 0 : 2 })}`
const units = (u: number) => (u >= 100 ? u.toFixed(0) : u >= 1 ? u.toFixed(2) : u.toFixed(4))
const pid = () => `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
async function livePrice(a: Asset, v: AssetToken | undefined) {
  if (v) {
    try {
      return await tokenPrice(toPlanToken(v))
    } catch {
      /* snapshot below */
    }
  }
  return v?.price ?? a.price
}

// Tool definitions, one schema for both providers: every field required, optional ones nullable, no
// extra properties, so strict mode holds on either side.
type Schema = { type: 'object'; properties: Record<string, unknown>; required: string[]; additionalProperties: false }
const obj = (properties: Record<string, unknown>): Schema => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false })
const str = (description: string, e?: string[]) => ({ type: 'string', description, ...(e && { enum: e }) })
const numOrNull = (description: string) => ({ type: ['number', 'null'], description })
export const TOOLS: { name: string; description: string; schema: Schema; label: (input: Record<string, unknown>) => string }[] = [
  { name: 'search_assets', description: 'Find tokenized assets Verdex lists (stocks, ETFs, commodities, treasuries) by ticker, company or fund name. Returns up to 8 matches with price, category and the chains each is issued on. Call this before proposing anything so the ticker is right.', schema: obj({ query: str('Ticker or name, e.g. NVDA, Apple, gold, S&P 500') }), label: (i) => `Searching ${i.query}` },
  { name: 'get_price', description: 'Live USD price of one listed asset from the onchain feed, with the market snapshot as fallback.', schema: obj({ ticker: str('Ticker as returned by search_assets') }), label: (i) => `Pricing ${i.ticker}` },
  { name: 'get_holdings', description: "What the connected wallet holds: the stablecoins Verdex pays with on each supported chain, plus any listed assets you name. Returns units and USD value. Needs a connected wallet.", schema: obj({ tickers: { type: 'array', items: { type: 'string' }, description: 'Tickers to check, up to 12. Leave empty to check only stables and the assets in the user\'s plans, orders and vaults.' } }), label: () => 'Reading wallet balances' },
  { name: 'list_activity', description: "The user's existing Auto-Invest plans, limit and stop orders, and vaults on this device.", schema: obj({}), label: () => 'Reading plans, orders and vaults' },
  { name: 'propose_order', description: 'Queue a limit or stop order for the user to approve. Buy below = limit buy, buy above = stop buy, sell above = limit sell, sell below = stop-loss. Buys need amount_usd, sells need units. Returns the proposal; the user must approve the card before anything is placed.', schema: obj({ ticker: str('Ticker from search_assets'), side: str('buy or sell', ['buy', 'sell']), trigger: str('below or above the price level', ['below', 'above']), price: { type: 'number', description: 'Trigger price in USD' }, amount_usd: numOrNull('For buys: how much to spend, in USD. null for sells'), units: numOrNull('For sells: how many units to sell. null for buys'), expiry: str('How long the order lives', ['gtc', 'day', 'week', 'month']) }), label: (i) => `Drafting ${i.side} order on ${i.ticker}` },
  { name: 'propose_plan', description: 'Queue a recurring Auto-Invest buy for the user to approve: a fixed USD amount of one asset on a cadence, paid in the stablecoin of the asset\'s chain. Returns the proposal; nothing is scheduled until the user approves.', schema: obj({ ticker: str('Ticker from search_assets'), amount_usd: { type: 'number', description: 'USD per buy' }, cadence: str('day, week, two (every two weeks) or month', ['day', 'week', 'two', 'month']), buy_now: { type: 'boolean', description: 'true to make the first buy right after approval, false to wait for the first scheduled date' } }), label: (i) => `Drafting a ${i.cadence === 'two' ? 'two-week' : `${i.cadence}ly`} plan for ${i.ticker}` },
  { name: 'propose_mandate', description: 'Queue a mandate for Agent without you: a budget and rules in a contract on Robinhood Chain that the Verdex executor works 24/7 without the user. Rules: dip (buy a stock when it is down param% or more on the day), trend (buy when up), profit (sell a slice when up), loss (sell when down). Caps in USD: per_trade, per_day, and for buy rules a total budget. Returns the proposal; the user must approve the card, which opens the mandate for their wallet to sign.', schema: obj({ rule: str('dip, trend, profit or loss', ['dip', 'trend', 'profit', 'loss']), tickers: { type: 'array', items: { type: 'string' }, description: 'Tickers from search_assets, 1 to 12, on Robinhood Chain' }, param_pct: { type: 'number', description: 'Size of the day move that fires the rule: 2, 3, 5 or 10', enum: [2, 3, 5, 10] }, per_trade_usd: { type: 'number', description: 'USD per trade: 25, 50, 100, 250 or 500', enum: [25, 50, 100, 250, 500] }, trades_per_day: { type: 'number', description: 'At most this many trades worth per day: 1, 2, 3 or 5', enum: [1, 2, 3, 5] }, budget_usd: numOrNull('For buy rules: USD in all, 100, 250, 500, 1000 or 2500. null for sell rules'), cooldown: str('Least time between two trades on the same stock', ['6h', 'day', '3d', 'week']), expires: str('How long the mandate lives', ['month', 'quarter', 'never']) }), label: (i) => `Drafting a mandate: ${MANDATE_RULES[(i.rule as keyof typeof MANDATE_RULES) ?? 'dip']?.name ?? i.rule}` },
  { name: 'propose_vault', description: 'Queue a vault for the user to approve: a target allocation across up to 12 listed assets on one chain, kept on target by rebalances the wallet confirms. Give explicit weights, or a template id (mag7, ai, core, balanced, hard, space) with an empty weights list. Returns the proposal; nothing is created until the user approves.', schema: obj({ name: str('Short name for the vault'), template: { type: ['string', 'null'], description: 'Template id or null' }, weights: { type: 'array', description: 'Assets and relative weights; they are normalised to 100', items: obj({ ticker: str('Ticker from search_assets'), weight: { type: 'number', description: 'Relative weight' } }) }, rule: str('When to rebalance: week, month, quarter, or drift (only when off target)', ['week', 'month', 'quarter', 'drift']), threshold: { type: 'number', description: 'Drift threshold in percentage points: 2, 5 or 10', enum: [2, 5, 10] } }), label: (i) => `Drafting vault ${i.name}` },
]
export const toolLabel = (name: string, input: Record<string, unknown>) => TOOLS.find((t) => t.name === name)?.label(input) ?? name

// Run one tool. Results are compact JSON strings for the model; proposals are also emitted for the page.
export async function runTool(name: string, raw: unknown, ctx: ToolCtx, emit: (e: AgentEvent) => void): Promise<string> {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const s = (k: string) => String(input[k] ?? '').trim()
  const n = (k: string) => (input[k] == null || input[k] === '' ? undefined : Number(input[k]))
  const fail = (error: string) => JSON.stringify({ error })
  const resolve = (ticker: string): { error: string } | { a: Asset; v: AssetToken } => {
    const a = findAssets(ctx.assets, ticker, 1)[0]
    if (!a) return { error: `No listed asset matches "${ticker}". Use search_assets.` }
    const v = pickVersion(a, ctx)
    if (!v) return { error: `${a.ticker} has no version on a supported EVM chain.` }
    return { a, v }
  }
  switch (name) {
    case 'search_assets': {
      const hits = findAssets(ctx.assets, s('query'))
      if (!hits.length) return JSON.stringify({ matches: [], note: 'Nothing matched. Try the ticker or the company name.' })
      return JSON.stringify({ matches: hits.map((a) => ({ ticker: a.ticker, name: a.name, category: a.category, price_usd: Number(a.price.toFixed(2)), chains: [...new Set(a.tokens.filter((tk) => tk.chainId !== SOLANA).map((tk) => tk.chain))], default_chain: chainName(ctx, pickVersion(a, ctx)?.chainId ?? 0, pickVersion(a, ctx)?.chain) })) })
    }
    case 'get_price': {
      const r = resolve(s('ticker'))
      if ('error' in r) return fail(r.error)
      const price = await livePrice(r.a, r.v)
      return JSON.stringify({ ticker: r.a.ticker, name: r.a.name, price_usd: Number(price.toFixed(2)), chain: chainName(ctx, r.v.chainId, r.v.chain), symbol: r.v.symbol, market_cap_usd: Math.round(r.a.marketCap), volume_24h_usd: Math.round(r.a.volume24h) })
    }
    case 'get_holdings': {
      if (!ctx.account) return fail('No wallet is connected. Connect one first, then ask again.')
      if (!ctx.chains) return fail('Chains are still loading. Try again in a moment.')
      const owner = ctx.account.address
      const asked = (Array.isArray(input.tickers) ? (input.tickers as unknown[]).map(String) : []).slice(0, 12)
      const mine = (x: { owner: string }) => x.owner.toLowerCase() === owner.toLowerCase()
      const implied = asked.length ? [] : [...getPlans().filter(mine).map((p) => p.ticker), ...getOrders().filter(mine).map((o) => o.ticker), ...getVaults().filter(mine).flatMap((v) => v.assets.map((a) => a.ticker))]
      const tickers = [...new Set([...asked, ...implied])].slice(0, 16)
      const jobs: { ticker: string; symbol: string; token: PlanToken; price: number; chain: string }[] = PAY_TOKENS.map((p) => ({ ticker: p.symbol, symbol: p.symbol, token: p, price: 1, chain: p.chain }))
      for (const tk of tickers) {
        const r = resolve(tk)
        if ('error' in r) continue
        jobs.push({ ticker: r.a.ticker, symbol: r.v.symbol, token: toPlanToken(r.v), price: r.v.price || r.a.price, chain: r.v.chain })
      }
      const out = await Promise.all(
        jobs.map(async (j) => {
          const chain = ctx.chains!.find((c) => c.id === j.token.chainId)
          if (!chain) return undefined
          try {
            const bal = await readBalance(chain, j.token.address, owner)
            const u = Number(formatUnits(bal, j.token.decimals))
            return u > 0 ? { ticker: j.ticker, symbol: j.symbol, chain: chainName(ctx, j.token.chainId, j.chain), units: Number(u.toFixed(6)), usd: Number((u * j.price).toFixed(2)) } : undefined
          } catch {
            return undefined
          }
        }),
      )
      const holdings = out.filter((x): x is NonNullable<typeof x> => !!x)
      return JSON.stringify({ wallet: owner, checked: [...new Set(jobs.map((j) => j.ticker))], holdings, total_usd: Number(holdings.reduce((t, h) => t + h.usd, 0).toFixed(2)), note: holdings.length ? undefined : 'Nothing found among the checked tokens.' })
    }
    case 'list_activity': {
      const owner = ctx.account?.address.toLowerCase()
      if (!owner) return fail('No wallet is connected, so there is nothing to list yet. Connect one first.')
      const plans = getPlans().filter((p) => p.owner.toLowerCase() === owner).map((p) => ({ ticker: p.ticker, amount_usd: p.amountUsd, cadence: p.cadence, status: p.status, next_buy: new Date(p.nextRunAt).toISOString(), buys_so_far: p.history.length }))
      const orders = getOrders().filter((o) => o.owner.toLowerCase() === owner).map((o) => ({ type: describe(o.side, o.trigger), ticker: o.ticker, side: o.side, trigger: o.trigger, level_usd: o.price, amount_usd: o.amountUsd, units: o.units, status: o.status, last_price_usd: o.lastPrice, live: isLive(o) }))
      const vaults = getVaults().filter((v) => v.owner.toLowerCase() === owner).map((v) => ({ name: v.name, chain: chainName(ctx, v.chainId), weights: v.assets.map((a) => `${a.ticker} ${a.weight.toFixed(0)}%`), rule: v.rule, threshold_pct: v.threshold, status: v.status, funded_usd: v.funded, rebalances: v.history.length }))
      return JSON.stringify({ plans, orders, vaults })
    }
    case 'propose_order': {
      const r = resolve(s('ticker'))
      if ('error' in r) return fail(r.error)
      const side = s('side') === 'sell' ? 'sell' : 'buy'
      const trigger = s('trigger') === 'above' ? 'above' : 'below'
      const price = n('price') ?? 0
      const amountUsd = n('amount_usd'), unitsN = n('units')
      if (!(price > 0)) return fail('price must be a positive USD level.')
      if (side === 'buy' && !(amountUsd && amountUsd > 0)) return fail('A buy needs amount_usd.')
      if (side === 'sell' && !(unitsN && unitsN > 0)) return fail('A sell needs units. Use get_holdings to see how many the wallet holds.')
      const expiry = EXPIRIES.some((e) => e.key === s('expiry')) ? s('expiry') : 'gtc'
      const current = await livePrice(r.a, r.v)
      const quote = defaultQuote(r.v.chainId)
      const size = side === 'buy' ? usd(amountUsd!) : `${units(unitsN!)} ${r.a.ticker}`
      const p: OrderProposal = { id: pid(), kind: 'order', status: 'pending', ticker: r.a.ticker, name: r.a.name, logo: r.a.logo, asset: toPlanToken(r.v), quote: { chainId: quote.chainId, address: quote.address, symbol: quote.symbol, decimals: quote.decimals }, chain: chainName(ctx, r.v.chainId, r.v.chain), side, trigger, price, amountUsd: side === 'buy' ? amountUsd : undefined, units: side === 'sell' ? unitsN : undefined, expiry, current, summary: `${describe(side, trigger)}: ${size} ${trigger} ${usd(price)}` }
      emit({ type: 'proposal', proposal: p })
      const crossed = trigger === 'below' ? current <= price : current >= price
      return JSON.stringify({ proposal_id: p.id, summary: p.summary, current_price_usd: Number(current.toFixed(2)), chain: p.chain, pays_with: quote.symbol, expiry, note: `${crossed ? 'The level is already crossed, so the order would trigger on its first check. ' : ''}Queued for the user's approval; nothing is placed yet.` })
    }
    case 'propose_plan': {
      const r = resolve(s('ticker'))
      if ('error' in r) return fail(r.error)
      const amountUsd = n('amount_usd') ?? 0
      if (!(amountUsd > 0)) return fail('amount_usd must be positive.')
      const cadence = (CADENCES.some((c) => c.key === s('cadence')) ? s('cadence') : 'week') as Cadence
      const buyNow = input.buy_now === true
      const current = await livePrice(r.a, r.v)
      const pay = defaultQuote(r.v.chainId)
      const p: PlanProposal = { id: pid(), kind: 'plan', status: 'pending', ticker: r.a.ticker, name: r.a.name, logo: r.a.logo, target: toPlanToken(r.v), pay: { chainId: pay.chainId, address: pay.address, symbol: pay.symbol, decimals: pay.decimals }, chain: chainName(ctx, r.v.chainId, r.v.chain), amountUsd, cadence, buyNow, firstAt: firstRunAt(buyNow, cadence), current, summary: `${CADENCES.find((c) => c.key === cadence)!.label}: buy ${usd(amountUsd)} of ${r.a.ticker}` }
      emit({ type: 'proposal', proposal: p })
      return JSON.stringify({ proposal_id: p.id, summary: p.summary, first_buy: buyNow ? 'right after approval' : new Date(p.firstAt).toISOString(), pays_with: `${pay.symbol} on ${pay.chain}`, current_price_usd: Number(current.toFixed(2)), note: "Queued for the user's approval; nothing is scheduled yet." })
    }
    case 'propose_mandate': {
      const ruleKey = (['dip', 'trend', 'profit', 'loss'] as const).find((k) => k === s('rule')) ?? 'dip'
      const rule = MANDATE_RULES[ruleKey]
      const given = (Array.isArray(input.tickers) ? (input.tickers as unknown[]).map(String) : []).slice(0, 12)
      const tickers: string[] = [], dropped: string[] = []
      for (const tk of given) { const a = findAssets(ctx.assets, tk, 1)[0]; const v = a?.tokens.find((x) => x.chainId === ROBINHOOD); if (a && v && !tickers.includes(a.ticker)) tickers.push(a.ticker); else dropped.push(tk) }
      if (!tickers.length) return fail(`None of those stocks is on Robinhood Chain${dropped.length ? ` (${dropped.join(', ')})` : ''}. Use search_assets and pick ones issued there.`)
      const paramPct = [2, 3, 5, 10].includes(n('param_pct') ?? -1) ? n('param_pct')! : 3
      const perTrade = [25, 50, 100, 250, 500].includes(n('per_trade_usd') ?? -1) ? n('per_trade_usd')! : 100
      const perDayX = [1, 2, 3, 5].includes(n('trades_per_day') ?? -1) ? n('trades_per_day')! : 2
      let budget = rule.side === 'buy' ? ([100, 250, 500, 1000, 2500].includes(n('budget_usd') ?? -1) ? n('budget_usd')! : 500) : 0
      if (rule.side === 'buy' && budget < perTrade) budget = [100, 250, 500, 1000, 2500].find((b) => b >= perTrade) ?? 2500
      const cooldown = ({ '6h': 21_600, day: 86_400, '3d': 259_200, week: 604_800 } as Record<string, number>)[s('cooldown')] ?? 86_400
      const expires = ({ month: 30 * 86_400, quarter: 90 * 86_400, never: 0 } as Record<string, number>)[s('expires')] ?? 30 * 86_400
      const joined = tickers.length <= 1 ? tickers.join('') : `${tickers.slice(0, -1).join(', ')} or ${tickers[tickers.length - 1]}`
      const p: MandateProposal = { id: pid(), kind: 'mandate', status: 'pending', rule: ruleKey, ruleName: rule.name, side: rule.side, paramBps: paramPct * 100, tickers, perTrade, perDay: perTrade * perDayX, budget, cooldown, expires, chain: chainName(ctx, ROBINHOOD, 'Robinhood Chain'), summary: `${rule.name}: ${rule.side === 'buy' ? usd(perTrade) : `up to ${usd(perTrade)}`} of ${joined} when one is ${paramPct}% ${rule.dir} on the day` }
      emit({ type: 'proposal', proposal: p })
      return JSON.stringify({ proposal_id: p.id, summary: p.summary, caps: `${usd(perTrade)} a trade, ${usd(perTrade * perDayX)} a day${budget ? `, ${usd(budget)} in all` : ''}`, cooldown: s('cooldown') || 'day', expires: s('expires') || 'month', dropped: dropped.length ? dropped : undefined, note: "Queued for the user's approval. Approving opens the mandate on the Agent without you page, where their wallet signs it; nothing is on the chain yet." })
    }
    case 'propose_vault': {
      const tpl = TEMPLATES.find((x) => x.id === s('template'))
      const given = Array.isArray(input.weights) ? (input.weights as { ticker?: unknown; weight?: unknown }[]).map((w) => [String(w?.ticker ?? ''), Number(w?.weight ?? 0)] as [string, number]).filter((w) => w[0]) : []
      const weights = given.length ? given : (tpl?.weights ?? [])
      if (!weights.length) return fail('Give weights or a template id.')
      const chainId = ROBINHOOD
      const assets: VaultAsset[] = []
      const dropped: string[] = []
      for (const [tk, w] of weights.slice(0, 12)) {
        const a = findAssets(ctx.assets, tk, 1)[0]
        const va = a && toVaultAsset(a, chainId, w > 0 ? w : 1)
        if (va) assets.push(va)
        else dropped.push(tk)
      }
      if (assets.length < 2) return fail(`Only ${assets.length} of those assets exist on ${chainName(ctx, chainId, 'Robinhood Chain')}; a vault needs at least two. Dropped: ${dropped.join(', ') || 'none'}.`)
      const rule = (RULES.some((x) => x.key === s('rule')) ? s('rule') : (tpl?.rule ?? 'month')) as Rule
      const threshold = [2, 5, 10].includes(n('threshold') ?? -1) ? n('threshold')! : (tpl?.threshold ?? 5)
      const quote = defaultQuote(chainId)
      const name = s('name') || tpl?.name || assets.map((a) => a.ticker).join(' / ')
      const norm = normalise(assets)
      const p: VaultProposal = { id: pid(), kind: 'vault', status: 'pending', name, template: tpl?.id, chainId, chain: chainName(ctx, chainId, 'Robinhood Chain'), quote: { chainId: quote.chainId, address: quote.address, symbol: quote.symbol, decimals: quote.decimals }, assets: norm, rule, threshold, summary: `${name}: ${norm.map((a) => `${a.ticker} ${a.weight.toFixed(0)}%`).join(', ')}` }
      emit({ type: 'proposal', proposal: p })
      return JSON.stringify({ proposal_id: p.id, summary: p.summary, chain: p.chain, rule, threshold_pct: threshold, dropped: dropped.length ? dropped : undefined, note: "Queued for the user's approval; nothing is created yet. Funding happens on the Vaults page after approval." })
    }
    default:
      return fail(`Unknown tool ${name}.`)
  }
}

function systemPrompt(ctx: ToolCtx) {
  const wallet = ctx.account ? `Connected wallet ${ctx.account.address} on ${chainName(ctx, ctx.account.chainId)}. VERDEX holder: ${ctx.holder ? 'yes, so no Verdex fee' : 'no, so the 0.25% Verdex fee applies on every trade; holding any VERDEX removes it'}.` : 'No wallet connected: the user can still ask and get proposals, but must connect to approve them.'
  return `You are Verdex Agent, the assistant inside Verdex (useverdex.xyz), a non-custodial marketplace for tokenized stocks, ETFs, commodities and treasuries on EVM chains. You help the user act on those markets from their own wallet.

You work only through tools. Read with search_assets, get_price, get_holdings and list_activity. Act with propose_order, propose_plan, propose_vault and propose_mandate: each queues a card the user must approve. A mandate (Agent without you) is the one thing that then works without the user: a budget and rules in a contract on Robinhood Chain, worked by Verdex's executor 24/7 inside caps the contract enforces; propose one when the user wants something done for them while they are away, with limits. You never place, schedule, execute or cancel anything yourself, and after approval the wallet still confirms every trade.

Rules:
- Call search_assets before proposing anything so the ticker and chain are right, and use the ticker it returns.
- One clear proposal per request unless the user asks for several. Fill sensible defaults and say what you assumed: limit buys default to $250 and until cancelled; plans default to weekly, paid in the chain's stablecoin; vaults default to Robinhood Chain, monthly, 5% threshold.
- "If it drops 5%" means a buy below today's price less 5%: read the price first, then propose. A stop-loss is a sell below. Sells need units: read get_holdings when the user does not say how many.
- Mandates default to buy the dips at 3%, $100 a trade, two trades a day, $500 in all, a day between trades on the same stock, for 30 days. Say that the contract keeps the limits and the executor keeps the rule, and that nothing is signed until they open the page.
- Keep replies to two or three short sentences in plain words, no headers or bullet lists unless comparing options. Prices in USD.
- After a proposal, say what it does and that the card needs their approval. Never say something is placed, scheduled or done.
- Describe assets and order types freely, but do not give personal investment advice or predictions. Never ask for keys, seed phrases or passwords.
- Supported chains for orders and plans: Robinhood Chain (default), Base, Arbitrum, Ethereum, and where issued, BNB Chain and HyperEVM. Verdex lists ${ctx.assets.length} assets.

Today is ${new Date().toDateString()}. ${wallet}`
}

// Shared shapes for the OpenAI wire format.
type OAToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } }
type OAMessage = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null; tool_calls?: OAToolCall[]; tool_call_id?: string }
const MAX_ROUNDS = 8

// One conversation. Provider history is kept here in memory only; the page keeps the visible transcript.
export class Session {
  private anthropic: Anthropic.MessageParam[] = []
  private openai: OAMessage[] = []
  private demoTurns: { user: string; agent: string }[] = []
  busy = false
  constructor(public config: AgentConfig) {}
  reset() {
    this.anthropic = []
    this.openai = []
    this.demoTurns = []
  }
  async send(text: string, ctx: ToolCtx, emit: (e: AgentEvent) => void) {
    if (this.busy) return
    this.busy = true
    try {
      if (this.config.provider === 'anthropic') await this.runAnthropic(text, ctx, emit)
      else if (this.config.provider === 'openai') await this.runOpenAI(text, ctx, emit)
      else await this.runDemo(text, ctx, emit)
    } catch (e) {
      emit({ type: 'error', message: describeAgentError(e) })
    } finally {
      this.busy = false
    }
  }

  private async runAnthropic(text: string, ctx: ToolCtx, emit: (e: AgentEvent) => void) {
    const mod = await import('@anthropic-ai/sdk')
    const client = new mod.default({ apiKey: this.config.key.trim(), dangerouslyAllowBrowser: true })
    const tools: Anthropic.Tool[] = TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.schema as Anthropic.Tool.InputSchema, strict: true }))
    const messages = [...this.anthropic, { role: 'user' as const, content: text }]
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const message = await client.messages.create({ model: modelFor(this.config), max_tokens: 4096, system: systemPrompt(ctx), tools, messages })
      messages.push({ role: 'assistant', content: message.content })
      const texts = message.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text.trim()).filter(Boolean)
      if (message.stop_reason === 'refusal') {
        this.anthropic = messages.slice(0, -1)
        emit({ type: 'error', message: 'The model declined that request. Try wording it differently.' })
        return
      }
      const calls = message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      if (message.stop_reason === 'max_tokens' && calls.length) {
        emit({ type: 'error', message: 'The reply was cut off before the tool input was complete. Ask again in fewer words.' })
        this.anthropic = messages.slice(0, -1)
        return
      }
      if (!calls.length) {
        if (message.stop_reason === 'pause_turn') continue
        if (texts.length) emit({ type: 'text', text: texts.join('\n\n') })
        this.anthropic = messages
        return
      }
      const results: Anthropic.ToolResultBlockParam[] = []
      for (const c of calls) {
        emit({ type: 'tool', name: c.name, label: toolLabel(c.name, c.input as Record<string, unknown>) })
        results.push({ type: 'tool_result', tool_use_id: c.id, content: await runTool(c.name, c.input, ctx, emit) })
      }
      messages.push({ role: 'user', content: results })
    }
    this.anthropic = messages
    emit({ type: 'error', message: 'That took too many steps. Try a narrower request.' })
  }

  private async runOpenAI(text: string, ctx: ToolCtx, emit: (e: AgentEvent) => void) {
    const tools = TOOLS.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.schema, strict: true } }))
    const messages: OAMessage[] = [...this.openai, { role: 'user', content: text }]
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${this.config.key.trim()}` }, body: JSON.stringify({ model: modelFor(this.config), messages: [{ role: 'system', content: systemPrompt(ctx) }, ...messages], tools, parallel_tool_calls: false }) })
      const j = (await r.json().catch(() => ({}))) as { error?: { message?: string }; choices?: { message: OAMessage; finish_reason: string }[] }
      if (!r.ok) throw new Error(j.error?.message ?? `OpenAI returned ${r.status}.`)
      const msg = j.choices?.[0]?.message
      if (!msg) throw new Error('OpenAI returned an empty reply.')
      messages.push({ role: 'assistant', content: msg.content ?? null, ...(msg.tool_calls?.length && { tool_calls: msg.tool_calls }) })
      if (!msg.tool_calls?.length) {
        if (msg.content?.trim()) emit({ type: 'text', text: msg.content.trim() })
        this.openai = messages
        return
      }
      for (const c of msg.tool_calls) {
        let input: unknown = {}
        try {
          input = JSON.parse(c.function.arguments || '{}')
        } catch {
          messages.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify({ error: 'Arguments were not valid JSON.' }) })
          continue
        }
        emit({ type: 'tool', name: c.function.name, label: toolLabel(c.function.name, input as Record<string, unknown>) })
        messages.push({ role: 'tool', tool_call_id: c.id, content: await runTool(c.function.name, input, ctx, emit) })
      }
    }
    this.openai = messages
    emit({ type: 'error', message: 'That took too many steps. Try a narrower request.' })
  }

  // No key: a small parser for the requests people actually type. It uses the same tools, so the
  // proposals are the real thing.
  private async runDemo(text: string, ctx: ToolCtx, emit: (e: AgentEvent) => void) {
    const reply = await demoReply(text, ctx, emit)
    this.demoTurns.push({ user: text, agent: reply })
    emit({ type: 'text', text: reply })
  }
}

export function describeAgentError(e: unknown) {
  const status = (e as { status?: number })?.status
  const msg = (e as Error)?.message ?? 'Something went wrong.'
  if (status === 401 || /invalid.*api key|incorrect api key|authentication/i.test(msg)) return 'That key was rejected by the provider. Check it in Setup.'
  if (status === 429 || /rate limit/i.test(msg)) return 'The provider is rate-limiting this key. Wait a moment and try again.'
  if (status === 404 || /model.*not (found|exist)|does not exist/i.test(msg)) return 'That model name was not found for this key. Change it in Setup.'
  if (/failed to fetch|networkerror|load failed/i.test(msg)) return 'Could not reach the provider. Check your connection or an ad blocker.'
  return msg.length > 240 ? msg.slice(0, 240) + '…' : msg
}

// The rules-based helper. Every branch goes through runTool so the results and proposals match the
// model-backed path exactly.
const money = (s: string) => {
  const m = s.replace(/[,$\s]/g, '').toLowerCase()
  const k = m.endsWith('k')
  const v = Number(k ? m.slice(0, -1) : m)
  return isFinite(v) ? (k ? v * 1000 : v) : 0
}
function findTickers(text: string, assets: Asset[]) {
  const lower = ` ${text.toLowerCase().replace(/[^\w&.$%-]+/g, ' ')} `
  const found: { i: number; ticker: string }[] = []
  const byTicker = new Set(assets.map((a) => a.ticker))
  for (const m of text.matchAll(/\$?\b([A-Za-z][A-Za-z.]{0,5})\b/g)) {
    const tk = m[1].toUpperCase()
    if (byTicker.has(tk) && (m[0].startsWith('$') || m[1] === tk || /^[A-Z]/.test(m[1]))) found.push({ i: m.index ?? 0, ticker: tk })
  }
  for (const [alias, tk] of Object.entries(ALIASES)) {
    const i = lower.indexOf(` ${alias} `)
    if (i >= 0 && byTicker.has(tk)) found.push({ i, ticker: tk })
  }
  for (const a of assets) {
    const nm = a.name.toLowerCase()
    if (nm.length >= 5 && !/ etf| trust| fund| inc| corp/.test(nm)) {
      const i = lower.indexOf(` ${nm} `)
      if (i >= 0) found.push({ i, ticker: a.ticker })
    }
  }
  const seen = new Set<string>()
  return found.sort((a, b) => a.i - b.i).filter((f) => !seen.has(f.ticker) && seen.add(f.ticker)).map((f) => f.ticker)
}
async function demoReply(text: string, ctx: ToolCtx, emit: (e: AgentEvent) => void): Promise<string> {
  const lower = text.toLowerCase()
  const call = async (name: string, input: Record<string, unknown>) => {
    emit({ type: 'tool', name, label: toolLabel(name, input) })
    return JSON.parse(await runTool(name, input, ctx, emit)) as Record<string, unknown>
  }
  const tickers = findTickers(text, ctx.assets)
  const amounts = [...text.matchAll(/\$\s?([\d,]+(?:\.\d+)?k?)|\b([\d,]+(?:\.\d+)?k?)\s?(?:dollars|usd|bucks)\b/gi)].map((m) => money(m[1] ?? m[2])).filter((v) => v > 0)
  const help = 'I can draft orders, recurring buys and vaults from one sentence, and read your wallet. Try "buy $250 of NVDA below $200", "every week put $100 into SPY", "stop-loss on my TSLA at $380", "build a vault: NVDA 40, AMD 30, TSM 30", or "what do I hold?".'

  if (/\b(my|open|active|current|running|existing)\b[^.]*\b(orders?|plans?|vaults?|activity)\b|what('s| is) running|list (orders|plans|vaults)/.test(lower)) {
    const r = await call('list_activity', {})
    if (r.error) return `${r.error}`
    const plans = r.plans as { ticker: string; amount_usd: number; cadence: string; status: string }[]
    const orders = r.orders as { type: string; ticker: string; level_usd: number; status: string; live: boolean }[]
    const vaults = r.vaults as { name: string; weights: string[]; status: string }[]
    if (!plans.length && !orders.length && !vaults.length) return 'Nothing yet for this wallet: no plans, orders or vaults. Ask me for one and I will draft it.'
    const parts = [plans.length && `${plans.length} plan${plans.length > 1 ? 's' : ''} (${plans.map((p) => `${usd(p.amount_usd)} of ${p.ticker} ${CADENCES.find((c) => c.key === p.cadence)?.label.toLowerCase() ?? p.cadence}${p.status === 'paused' ? ', paused' : ''}`).join('; ')})`, orders.length && `${orders.length} order${orders.length > 1 ? 's' : ''} (${orders.map((o) => `${o.type.toLowerCase()} ${o.ticker} at ${usd(o.level_usd)}, ${o.status}`).join('; ')})`, vaults.length && `${vaults.length} vault${vaults.length > 1 ? 's' : ''} (${vaults.map((v) => `${v.name}: ${v.weights.join(', ')}`).join('; ')})`].filter(Boolean)
    return `You have ${parts.join(', ')}.`
  }
  if (/\b(hold|holdings|balances?|own|have got|do i have|portfolio value|worth)\b/.test(lower) && !/\b(buy|sell|every|vault|stop)\b/.test(lower)) {
    const r = await call('get_holdings', { tickers })
    if (r.error) return `${r.error}`
    const h = r.holdings as { ticker: string; units: number; usd: number; chain: string }[]
    if (!h.length) return `Nothing among the tokens I checked (${(r.checked as string[]).join(', ')}) in ${(r.wallet as string).slice(0, 6)}…. Name a ticker and I will look for it.`
    return `${(r.wallet as string).slice(0, 6)}… holds ${h.map((x) => `${units(x.units)} ${x.ticker} on ${x.chain} (${usd(x.usd)})`).join(', ')}, about ${usd(r.total_usd as number)} in total.`
  }
  if (/\b(price|trading at|trade at|quote|how much is|worth|cost)\b/.test(lower) && tickers.length && !/\b(buy|sell|every|vault|stop)\b/.test(lower)) {
    const r = await call('get_price', { ticker: tickers[0] })
    if (r.error) return `${r.error}`
    return `${r.ticker} (${r.name}) is at ${usd(r.price_usd as number)} on ${r.chain}. Want an order on it? Say "buy $250 of ${r.ticker} below ${usd((r.price_usd as number) * 0.95)}".`
  }
  if (/\b(every|each|weekly|daily|monthly|biweekly|fortnight\w*|dca|recurring|per (day|week|month)|a (day|week|month))\b/.test(lower) && tickers.length) {
    const cadence: Cadence = /\b(daily|every day|each day|per day|a day)\b/.test(lower) ? 'day' : /\b(two weeks|2 weeks|biweekly|fortnight\w*|other week)\b/.test(lower) ? 'two' : /\b(month\w*)\b/.test(lower) ? 'month' : 'week'
    const amount = amounts[0] ?? 100
    const r = await call('propose_plan', { ticker: tickers[0], amount_usd: amount, cadence, buy_now: /\b(now|today|right away|immediately|starting now)\b/.test(lower) })
    if (r.error) return `${r.error}`
    return `Drafted: ${r.summary}, paid with ${r.pays_with}, first buy ${r.first_buy === 'right after approval' ? 'right after you approve' : `on ${new Date(r.first_buy as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}. ${r.ticker ?? tickers[0]} is at ${usd(r.current_price_usd as number)} now. Review the card and approve it to schedule the plan.`
  }
  if (/\b(mandate|agent|without me|while i sleep|24\/7|on its own|automatically|autopilot|the dips|buy dips|dip[s]?\b|take profits?|cut (my )?losses|trailing)\b/.test(lower) && tickers.length) {
    const ruleKey = /\b(take profits?|profits?)\b/.test(lower) ? 'profit' : /\b(cut|losses?|stop)\b/.test(lower) ? 'loss' : /\b(strength|momentum|breakout|trend|rips?|green)\b/.test(lower) ? 'trend' : 'dip'
    const pctM = /\b(2|3|5|10)\s?%/.exec(lower)
    const per = amounts.find((v) => [25, 50, 100, 250, 500].includes(v))
    const bud = amounts.find((v) => [100, 250, 500, 1000, 2500].includes(v) && v !== per)
    const r = await call('propose_mandate', { rule: ruleKey, tickers, param_pct: pctM ? Number(pctM[1]) : 3, per_trade_usd: per ?? 100, trades_per_day: 2, budget_usd: bud ?? (per ? Math.max(500, per * 5) : 500), cooldown: /\bweek/.test(lower) ? 'week' : /\b6 ?h|six hours/.test(lower) ? '6h' : 'day', expires: /\b(90|quarter|three months)\b/.test(lower) ? 'quarter' : /\b(never|until i (stop|close))\b/.test(lower) ? 'never' : 'month' })
    if (r.error) return `${r.error}`
    return `Drafted a mandate: ${r.summary}; ${r.caps}; the same stock at most once a ${r.cooldown === '6h' ? 'quarter day' : r.cooldown === 'week' ? 'week' : r.cooldown === '3d' ? 'three days' : 'day'}. Approve the card and it opens on the Agent without you page, where your wallet signs it; the contract keeps the limits and the executor keeps the rule.`
  }
  if (/\b(vault|portfolio|allocation|basket|split|rebalanc\w*)\b/.test(lower)) {
    const template = /\bmag(nificent)?\s?7\b/.test(lower) ? 'mag7' : /\b60\s?\/\s?40\b|balanced/.test(lower) ? 'balanced' : /\bhard assets?\b|commodit/.test(lower) ? 'hard' : /\bspace\b|frontier/.test(lower) ? 'space' : /\bcore\b|index/.test(lower) && !tickers.length ? 'core' : /\bai\b/.test(lower) && !tickers.length ? 'ai' : null
    const weights = tickers.map((tk) => {
      const m = new RegExp(`\\b${tk.replace('.', '\\.')}\\b\\s*:?\\s*(\\d{1,3})\\s?%?|(\\d{1,3})\\s?%\\s*(?:in|of|to)?\\s*\\b${tk.replace('.', '\\.')}\\b`, 'i').exec(text)
      return { ticker: tk, weight: Number(m?.[1] ?? m?.[2] ?? 0) || 1 }
    })
    if (!template && weights.length < 2) return 'Name at least two assets with weights, like "NVDA 40, AMD 30, TSM 30", or a template: Magnificent 7, AI Leaders, Core Index, Balanced 60/40, Hard Assets, or Space and Frontier.'
    const rule: Rule = /\bweek/.test(lower) ? 'week' : /\bquarter/.test(lower) ? 'quarter' : /\bdrift|only when/.test(lower) ? 'drift' : 'month'
    const threshold = /\b(2|5|10)\s?%\s*(drift|threshold|off)/.exec(lower)?.[1]
    const nameM = /\b(?:called|named|name it)\s+"?([^"]+?)"?(?:[.,]|$)/i.exec(text)
    const r = await call('propose_vault', { name: nameM?.[1]?.trim() ?? (template ? TEMPLATES.find((t) => t.id === template)!.name : /\bai\b/.test(lower) ? 'AI vault' : weights.map((w) => w.ticker).join(' / ')), template, weights: template && !weights.length ? [] : weights, rule, threshold: threshold ? Number(threshold) : 5 })
    if (r.error) return `${r.error}`
    return `Drafted: ${r.summary} on ${r.chain}, rebalanced ${RULES.find((x) => x.key === r.rule)!.label.toLowerCase()} with a ${r.threshold_pct}% drift threshold${r.dropped ? ` (not on that chain: ${(r.dropped as string[]).join(', ')})` : ''}. Approve the card to create it, then fund it on the Vaults page.`
  }
  if (/\b(buy|sell|limit|stop|stop-loss|stop loss|take profit|take-profit)\b/.test(lower)) {
    if (!tickers.length) return `Which asset? For example: "buy $250 of NVDA below $200" or "sell 2 TSLA above $450".`
    const ticker = tickers[0]
    const side: Side = /\b(sell|stop-loss|stop loss|take profit|take-profit)\b/.test(lower) ? 'sell' : 'buy'
    const lvl = /\b(below|under|beneath|drops? to|falls? to|dips? to|at|above|over|breaks?|hits?|reaches|rises? to|climbs? to)\s*\$?\s?([\d,]+(?:\.\d+)?k?)\b/i.exec(text)
    const pct = /\b(drops?|falls?|dips?|down|slides?|rises?|climbs?|up|gains?|breaks? out|jumps?)\s*(?:by\s*)?([\d.]+)\s?%/i.exec(text)
    let price = lvl ? money(lvl[2]) : 0
    let trigger: Trigger = side === 'buy' ? 'below' : 'above'
    const pr = await call('get_price', { ticker })
    if (pr.error) return `${pr.error}`
    const current = pr.price_usd as number
    if (lvl) {
      const kw = lvl[1].toLowerCase()
      trigger = /below|under|beneath|drop|fall|dip/.test(kw) ? 'below' : /above|over|break|hit|reach|rise|climb/.test(kw) ? 'above' : side === 'buy' ? 'below' : 'above'
    } else if (pct) {
      const down = /drop|fall|dip|down|slide/i.test(pct[1])
      price = Number((current * (1 + (down ? -1 : 1) * Number(pct[2]) / 100)).toFixed(current >= 100 ? 0 : 2))
      trigger = down ? 'below' : 'above'
    } else if (/\bstop/.test(lower) && side === 'sell') {
      trigger = 'below'
    }
    if (!(price > 0)) return `${ticker} is at ${usd(current)}. At what level? For example: "${side} ${side === 'buy' ? '$250 of ' : ''}${ticker} ${trigger} ${usd(current * (trigger === 'below' ? 0.95 : 1.05))}".`
    const amount = amounts.find((v) => v !== price) ?? 250
    let unitsN = Number(/\b([\d.]+)\s*(shares?|units?|tokens?)\b/i.exec(text)?.[1] ?? 0)
    if (side === 'sell' && !(unitsN > 0)) {
      const h = await call('get_holdings', { tickers: [ticker] })
      const held = ((h.holdings as { ticker: string; units: number }[] | undefined) ?? []).find((x) => x.ticker === ticker)
      const frac = /\bhalf\b/.test(lower) ? 0.5 : /\b(\d{1,3})\s?%/.exec(lower) ? Number(/\b(\d{1,3})\s?%/.exec(lower)![1]) / 100 : 1
      unitsN = held ? Number((held.units * frac).toFixed(6)) : 0
      if (!(unitsN > 0)) return h.error ? `Connect a wallet so I can read how much ${ticker} you hold, or say how many units to sell.` : `This wallet holds no ${ticker} on the supported chains, and a sell needs units to sell.`
    }
    const expiry = /\b(24 hours|today|one day|a day)\b/.test(lower) ? 'day' : /\b(this week|7 days|a week)\b/.test(lower) ? 'week' : /\b(30 days|this month|a month)\b/.test(lower) ? 'month' : 'gtc'
    const r = await call('propose_order', { ticker, side, trigger, price, amount_usd: side === 'buy' ? amount : null, units: side === 'sell' ? unitsN : null, expiry })
    if (r.error) return `${r.error}`
    return `Drafted: ${r.summary}, ${side === 'buy' ? `paid in ${r.pays_with}` : `into ${r.pays_with}`} on ${r.chain}. ${ticker} is at ${usd(current)} now${/already crossed/.test(String(r.note)) ? ', so this would trigger on its first check' : ''}. Review the card and approve it to place the order.`
  }
  return help
}
