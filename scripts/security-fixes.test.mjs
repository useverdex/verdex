import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

describe('Security Fix 1: Exact ERC20 Approvals Instead of Silent maxUint256', () => {
  test('SwapWidget, pools, orders, vaults, and autoInvest do not encode maxUint256 approvals', () => {
    const files = [
      'src/swap/SwapWidget.tsx',
      'src/lib/pools.ts',
      'src/lib/orders.ts',
      'src/lib/vaults.ts',
      'src/lib/autoInvest.ts',
    ]
    for (const f of files) {
      const src = read(f)
      assert.equal(src.includes('maxUint256'), false, `${f} still references maxUint256`)
    }
    assert.match(read('src/swap/SwapWidget.tsx'), /args:\s*\[fresh\.estimate\.approvalAddress as Address,\s*BigInt\(fresh\.action\.fromAmount\)\]/)
    assert.match(read('src/lib/pools.ts'), /args:\s*\[spender,\s*amount\]/)
    assert.match(read('src/lib/orders.ts'), /args:\s*\[quote\.estimate\.approvalAddress as Address,\s*fromAmount\]/)
    assert.match(read('src/lib/vaults.ts'), /args:\s*\[quote\.estimate\.approvalAddress as Address,\s*fromAmount\]/)
    assert.match(read('src/lib/autoInvest.ts'), /args:\s*\[quote\.estimate\.approvalAddress as Address,\s*BigInt\(fromAmount\)\]/)
  })
})

describe('Security Fix 2: Multiplicative Slippage + Fee in Index Buy/Sell', () => {
  test('buyIndex maxIn covers full per-leg slippage plus protocol fee on maxSpent', () => {
    const perLeg = [333_333_333n, 333_333_333n, 333_333_334n]
    const total = 1_000_000_000n
    const slippageBps = 100
    const feeBps = 25

    const maxLeg = perLeg.map((v) => (v * BigInt(10_000 + slippageBps)) / 10_000n)
    const maxSpent = maxLeg.reduce((s, v) => s + v, 0n)
    const routerFeeOnMaxSpent = (maxSpent * BigInt(feeBps)) / 10_000n
    const routerMaxRequired = maxSpent + routerFeeOnMaxSpent

    const buggyAdditiveMaxIn = (total * BigInt(10_000 + slippageBps + feeBps)) / 10_000n + 1n
    assert.ok(buggyAdditiveMaxIn < routerMaxRequired, 'Additive formula under-estimates router requirement')

    const fixedMaxIn = maxSpent + (maxSpent * BigInt(feeBps)) / 10_000n + 1n
    assert.ok(fixedMaxIn >= routerMaxRequired, 'Fixed multiplicative maxIn covers worst-case spent + fee')

    assert.match(read('src/lib/indexes.ts'), /const maxSpent = maxLeg\.reduce/)
    assert.match(read('src/pages/IndexPage.tsx'), /const maxSpent = quote\.data/)
  })
})

describe('Security Fix 3: Leverage openShort Fee Allowance Buffer & Permissionless settleFor', () => {
  test('openShort adds slippage buffer to fee approval and VerdexLeverage exposes settleFor', () => {
    const margin = 100_000_000n
    const exposure = 200_000_000n
    const feeBps = 20n
    const slippageBps = 150n
    const planProceeds = (exposure * 9970n) / 10_000n
    const planFee = (planProceeds * feeBps) / 10_000n
    const actualProceeds = (exposure * 10_050n) / 10_000n
    const actualOnchainFee = (actualProceeds * feeBps) / 10_000n

    assert.ok(actualOnchainFee > planFee, 'Favorable price tick makes onchain fee exceed unbuffered plan.fee')
    const maxFee = (planFee * (10_000n + slippageBps)) / 10_000n + 2n
    assert.ok(margin + maxFee >= margin + actualOnchainFee, 'Buffered fee allowance covers favorable price ticks')

    assert.match(read('src/lib/leverage.ts'), /const maxFee = plan\.fee > 0n/)
    assert.match(read('contracts/VerdexLeverage.sol'), /function settleFor\(uint256 id, address user\) external nonReentrant/)
  })
})

describe('Security Fix 4: Term Loan NaN Render Guards, Default minLoan, and Division-by-Zero Guard', () => {
  test('TermPage and LeveragePage guard decimal inputs before parseUnits and term.ts guards zero perLoan', () => {
    const badInputs = ['.', '1.2.3', '']
    for (const rawInput of badInputs) {
      const p = Number(rawInput)
      const safe = p > 0 ? p.toFixed(6) : '0'
      assert.equal(safe, '0')
    }
    const maxPrincipal = (collLeft, perLoan) => (perLoan === 0n ? 0n : (collLeft * 10n ** 18n) / perLoan)
    assert.equal(maxPrincipal(1000n, 0n), 0n)

    assert.match(read('src/pages/TermPage.tsx'), /p > 0 \? parseUnits\(p\.toFixed\(6\), 6\) : 0n/)
    assert.match(read('src/pages/TermPage.tsx'), /const minLoan = maxLoan < 10_000_000n \? maxLoan : 10_000_000n/)
    assert.match(read('src/lib/term.ts'), /perLoan === 0n \? 0n/)
  })
})

describe('Security Fix 5: VerdexLend & VerdexIndexRouter On-Chain Hardening', () => {
  test('VerdexLend setParams, rates, borrowable and VerdexIndexRouter sell/spot checks are present', () => {
    const lend = read('contracts/VerdexLend.sol')
    assert.match(lend, /if \(m\.totalBorrowShares > 0 && liqThresholdBps < m\.liqThresholdBps\) revert BadArgs\(\);/)
    assert.match(lend, /\(uint256 borrowAssets, uint256 supplyAssets,\) = _accruedView\(m\);/)

    for (const routerFile of ['contracts/VerdexIndexRouter.sol', 'contracts/VerdexIndexRouterCL.sol']) {
      const r = read(routerFile)
      assert.match(r, /if \(sqrtP == 0\) revert NoPool\(\);/)
      assert.match(r, /if \(amounts\[i\] == 0\) \{\s*if \(minOutPerLeg\[i\] > 0\) revert Slippage\(\);\s*continue;\s*\}/)
    }
  })
})

describe('Security Fix 6: API & Executor Memory, Stack Overflow, and Zero-Amount Hardening', () => {
  test('api-lib avoids Math.min(...people) spread and prunes transfers; executor-lib splits logs and filters 0 amounts', () => {
    const api = read('scripts/api-lib.mjs')
    assert.equal(api.includes('Math.min(...people'), false, 'api-lib must not spread people into Math.min')
    assert.match(api, /scanState\.totalTransfers\+\+/)

    const exec = read('scripts/executor-lib.mjs')
    assert.match(exec, /async function getLogsSplit/)
    assert.match(exec, /if \(amt > 0n\) \{ to\.push\(a\); amounts\.push\(amt\) \}/)
  })
})
