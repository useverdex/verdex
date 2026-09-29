// Renders the app icons (PWA manifest, Apple touch icon) from the Verdex mark: lime mark on black.
// Usage: node scripts/app-icons.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = fs.readFileSync(path.join(root, 'src/components/logoPath.ts'), 'utf8')
const MARK_PATH = src.match(/MARK_PATH\s*=\s*'([^']+)'/)?.[1] ?? src.match(/MARK_PATH\s*=\s*"([^"]+)"/)[1]
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--force-color-profile=srgb'] })
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } })
// Regular icons fill the tile with the mark at 60%; the maskable one keeps it inside the 80% safe zone.
const html = (markPct) => `<!doctype html><body style="margin:0;background:#000"><div style="width:1024px;height:1024px;display:grid;place-items:center"><svg viewBox="0 0 100 100" width="${1024 * markPct}" height="${1024 * markPct}" fill="#C2EA8A"><path d="${MARK_PATH}"/></svg></div></body>`
const out = (name) => path.join(root, 'public/icons', name)
await page.setContent(html(0.6))
await page.screenshot({ path: out('icon-1024.png') })
await page.setContent(html(0.5))
await page.screenshot({ path: out('icon-maskable-1024.png') })
await browser.close()
