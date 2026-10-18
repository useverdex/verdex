import assert from 'node:assert/strict'
import { register } from 'node:module'
import test from 'node:test'
import type { WalletClient } from 'viem'

const loaderCode = `
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\\.[a-z0-9]+$/i.test(specifier)) {
    for (const ext of ['.ts', '.tsx', '.js', '.mjs']) {
      try {
        return await nextResolve(specifier + ext, context)
      } catch {
        // try next extension
      }
    }
  }
  return nextResolve(specifier, context)
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.json')) {
    const raw = fs.readFileSync(fileURLToPath(url), 'utf8')
    return { format: 'module', shortCircuit: true, source: 'export default ' + raw }
  }
  if (url.endsWith('.ts') || url.endsWith('.tsx')) {
    const raw = fs.readFileSync(fileURLToPath(url), 'utf8')
    const patched = raw.replace(/import\\.meta\\.env/g, "(globalThis.__VERDEX_ENV__ ?? { BASE_URL: '/' })")
    return nextLoad(url, { ...context, source: patched })
  }
  return nextLoad(url, context)
}
`

register(`data:text/javascript,${encodeURIComponent(loaderCode)}`, import.meta.url)

const toB64Url = (obj: unknown) =>
  Buffer.from(JSON.stringify(obj), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const NATIVE_TOKEN = `0x${'0'.repeat(40)}` as `0x${string}`
const SAMPLE_OWNER = `0x${'1'.repeat(40)}` as `0x${string}`
const SAMPLE_TARGET = `0x${'2'.repeat(40)}` as `0x${string}`

test('decodeShare strips control characters, newlines, and forged attribution tails', async () => {
  const { decodeShare } = await import('./strategies.ts')

  const forgedCode = toB64Url({
    n: 'Vanguard Core Index\nby Vanguard Research (verified)',
    c: 4663,
    w: [
      ['NVDA', 60],
      ['AAPL', 40],
    ],
    r: 'month',
    t: 5,
  })
  const forged = decodeShare(forgedCode)
  assert.ok(forged)
  assert.equal(forged.n, 'Vanguard Core Index')
  assert.equal(forged.m, undefined)

  const inlineForgedCode = toB64Url({
    n: 'Vanguard Core Index by Vanguard Research (verified)',
    c: 4663,
    w: [
      ['NVDA', 60],
      ['AAPL', 40],
    ],
    r: 'month',
    t: 5,
    m: 'by Vanguard Research\n(verified)',
  })
  const inlineForged = decodeShare(inlineForgedCode)
  assert.ok(inlineForged)
  assert.equal(inlineForged.n, 'Vanguard Core Index')
  assert.equal(inlineForged.m, 'Vanguard Research')

  const validCode = toB64Url({
    n: '  Stand by Me\tGrowth  ',
    c: 4663,
    w: [
      ['NVDA', 60],
      ['AAPL', 40],
    ],
    r: 'month',
    t: 5,
    m: 'Vanguard Research',
  })
  const valid = decodeShare(validCode)
  assert.ok(valid)
  assert.equal(valid.n, 'Stand by Me Growth')
  assert.equal(valid.m, 'Vanguard Research')

  const invalidWeights = toB64Url({
    n: 'Bad Weights',
    c: 4663,
    w: [['NVDA', -10]],
    r: 'month',
    t: 5,
  })
  assert.equal(decodeShare(invalidWeights), null)
})

test('non-fee quote errors do not activate global LI.FI fee cooldown', async () => {
  const lifi = await import('./lifi.ts')
  lifi.resetFeeCooldown()
  assert.equal(lifi.feeCooldownUntil(), 0)

  const origFetch = globalThis.fetch
  let attempts = 0
  globalThis.fetch = (async () => {
    attempts += 1
    return new Response(JSON.stringify({ message: 'No available quotes for the requested transfer' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch

  try {
    await assert.rejects(
      () =>
        lifi.fetchQuoteWithFee({
          fromChain: 4663,
          toChain: 4663,
          fromToken: NATIVE_TOKEN,
          toToken: SAMPLE_TARGET,
          fromAmount: '10000000',
          fromAddress: SAMPLE_OWNER,
          fee: 0.0025,
        }),
      /No available quotes/,
    )
    assert.equal(attempts, 2)
    assert.equal(lifi.feeCooldownUntil(), 0)
  } finally {
    globalThis.fetch = origFetch
    lifi.resetFeeCooldown()
  }
})

test('LI.FI fee-rejection cooldown is shared across Auto-Invest, Orders, Vaults, and fetchQuote', async () => {
  const lifi = await import('./lifi.ts')
  lifi.resetFeeCooldown()
  const { quotePlan } = await import('./autoInvest.ts')
  const { fillOrder } = await import('./orders.ts')
  const { executeRebalance } = await import('./vaults.ts')

  const requestedUrls: string[] = []
  const origFetch = globalThis.fetch

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    requestedUrls.push(url)

    if (url.includes('/token?')) {
      return new Response(JSON.stringify({ priceUSD: '1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    if (url.includes('/quote?')) {
      const parsed = new URL(url)
      if (parsed.searchParams.has('fee')) {
        return new Response(
          JSON.stringify({
            message: 'Integrator "verdex" is not configured for collecting fees.',
          }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        )
      }
      return new Response(
        JSON.stringify({
          id: 'q-1',
          type: 'lifi',
          tool: 'nordstern',
          toolDetails: { key: 'nordstern', name: 'Nordstern', logoURI: '' },
          action: {
            fromChainId: 4663,
            toChainId: 4663,
            fromToken: {
              chainId: 4663,
              address: NATIVE_TOKEN,
              symbol: 'ETH',
              name: 'ETH',
              decimals: 18,
            },
            toToken: {
              chainId: 4663,
              address: SAMPLE_TARGET,
              symbol: 'NVDA',
              name: 'NVIDIA',
              decimals: 18,
            },
            fromAmount: '10000000',
            fromAddress: SAMPLE_OWNER,
            toAddress: SAMPLE_OWNER,
            slippage: 0.01,
          },
          estimate: {
            fromAmount: '10000000',
            toAmount: '100000000000000000',
            toAmountMin: '99000000000000000',
            approvalAddress: SAMPLE_OWNER,
            executionDuration: 12,
            fromAmountUSD: '10.00',
            toAmountUSD: '9.97',
            feeCosts: [
              {
                name: 'LIFI Fixed Fee',
                amountUSD: '0.025',
                percentage: '0.0025',
                feeSplit: { lifiFee: '25000', integratorFee: '0' },
              },
            ],
          },
          transactionRequest: {
            to: SAMPLE_OWNER,
            data: '0x1234',
            value: '0',
            chainId: 4663,
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }

    throw new Error(`Unexpected URL: ${url}`)
  }) as typeof fetch

  try {
    const payToken = {
      chainId: 4663,
      address: NATIVE_TOKEN,
      symbol: 'ETH',
      decimals: 18,
    }
    const targetToken = {
      chainId: 4663,
      address: SAMPLE_TARGET,
      symbol: 'NVDA',
      decimals: 18,
    }
    const samplePlan = {
      id: 'plan-1',
      owner: SAMPLE_OWNER,
      ticker: 'NVDA',
      name: 'NVIDIA',
      target: targetToken,
      pay: payToken,
      amountUsd: 10,
      cadence: 'week' as const,
      nextRunAt: 0,
      createdAt: 0,
      status: 'active' as const,
      history: [],
    }

    const first = await quotePlan(samplePlan, samplePlan.owner, false)
    assert.equal(lifi.quoteHasFee(first.quote), false)
    assert.equal(lifi.routeFeesUsd(first.quote), 0.025)

    const quoteCallsAfterFirst = requestedUrls.filter((u) => u.includes('/quote?'))
    assert.equal(quoteCallsAfterFirst.length, 2)
    assert.equal(quoteCallsAfterFirst.filter((u) => u.includes('fee=')).length, 1)

    const mockChain = { id: 4663, key: 'rh', name: 'Robinhood Chain', chainType: 'EVM' as const, logoURI: '', mainnet: true }
    const stubWalletClient = {
      sendTransaction: async () => {
        throw new Error('WALLET_INTERCEPTED')
      },
    } as unknown as WalletClient

    await quotePlan(samplePlan, samplePlan.owner, false)
    await lifi.fetchQuote({
      fromChain: 4663,
      toChain: 4663,
      fromToken: payToken.address,
      toToken: targetToken.address,
      fromAmount: '10000000',
      fromAddress: samplePlan.owner,
      fee: 0.0025,
    })

    await assert.rejects(
      () =>
        fillOrder(
          {
            id: 'ord-1',
            owner: SAMPLE_OWNER,
            ticker: 'NVDA',
            name: 'NVIDIA',
            asset: targetToken,
            quote: payToken,
            side: 'buy',
            trigger: 'below',
            price: 100,
            amountUsd: 10,
            expiresAt: 0,
            createdAt: 0,
            status: 'triggered',
          },
          {
            walletClient: stubWalletClient,
            account: { address: SAMPLE_OWNER, chainId: 4663 },
            chains: [mockChain],
            switchChain: async () => {},
            holder: false,
            onPhase: () => {},
          },
        ),
      /WALLET_INTERCEPTED/,
    )

    await assert.rejects(
      () =>
        executeRebalance(
          {
            id: 'vault-1',
            owner: SAMPLE_OWNER,
            name: 'Core',
            chainId: 4663,
            quote: payToken,
            assets: [{ ticker: 'NVDA', name: 'NVIDIA', token: targetToken, weight: 100 }],
            rule: 'month',
            threshold: 5,
            nextRunAt: 0,
            createdAt: 0,
            status: 'active',
            funded: 0,
            history: [],
          },
          [{ side: 'buy', asset: { ticker: 'NVDA', name: 'NVIDIA', token: targetToken, weight: 100 }, usd: 10 }],
          {
            walletClient: stubWalletClient,
            account: { address: SAMPLE_OWNER, chainId: 4663 },
            chain: mockChain,
            switchChain: async () => {},
            holder: false,
            driftBefore: 10,
            onProgress: () => {},
          },
        ),
      /WALLET_INTERCEPTED/,
    )

    const quoteCallsTotal = requestedUrls.filter((u) => u.includes('/quote?'))
    const feeCallsTotal = quoteCallsTotal.filter((u) => u.includes('fee='))
    assert.equal(
      feeCallsTotal.length,
      1,
      `Expected only 1 fee-bearing quote attempt across all engines during cooldown, got ${feeCallsTotal.length}`,
    )
    assert.equal(quoteCallsTotal.length, 6)
    assert.ok(lifi.feeCooldownUntil() > Date.now())
  } finally {
    globalThis.fetch = origFetch
    lifi.resetFeeCooldown()
  }
})
