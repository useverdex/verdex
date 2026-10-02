// Renders a promo timeline page frame by frame and encodes it to MP4.
// Usage: node promo/render.mjs [--page promo/index.html] [--still t1,t2,...] [--fps 60] [--workers 4] [--out file.mp4] [--w 1920 --h 1080]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { spawn } from 'node:child_process'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]]] : a), []))
const fps = Number(args.fps ?? 60)
const out = args.out ?? path.join(root, 'promo', 'verdex-promo.mp4')
const ffmpeg = args.ffmpeg ?? process.env.FFMPEG ?? 'ffmpeg'
const pagePath = args.page ?? 'promo/index.html'
const types = { '.html': 'text/html', '.js': 'text/javascript', '.ts': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end() }
  res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }); fs.createReadStream(file).pipe(res)
}).listen(0)
const port = server.address().port

const launch = () => chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--force-color-profile=srgb'] })
async function openStage() {
  const browser = await launch()
  const page = await browser.newPage({ viewport: { width: Number(args.w ?? 1920), height: Number(args.h ?? 1080) } })
  await page.goto(`http://localhost:${port}/${pagePath}`)
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 })
  return { browser, page }
}

if (args.still) {
  const { browser, page } = await openStage()
  for (const t of args.still.split(',').map(Number)) {
    await page.evaluate((v) => window.renderAt(v), t)
    await page.screenshot({ path: path.join(args.dir ?? '.', `still-${t}.png`) })
  }
  await browser.close()
} else {
  // Frames are independent, so split the timeline across workers (one browser and one encoder each),
  // then join the segments without re-encoding.
  const workers = Number(args.workers ?? 4)
  const { browser: probe, page: probePage } = await openStage()
  const duration = await probePage.evaluate(() => window.DURATION)
  await probe.close()
  const frames = Math.round(duration * fps)
  const per = Math.ceil(frames / workers)
  const tmp = fs.mkdtempSync(path.join(path.dirname(out), '.segments-'))
  let done = 0
  const encode = (file) => spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-threads', '2', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(fps), file], { stdio: ['pipe', 'inherit', 'inherit'] })
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const { browser, page } = await openStage()
    const enc = encode(path.join(tmp, `seg-${w}.mp4`))
    for (let f = w * per; f < Math.min(frames, (w + 1) * per); f++) {
      await page.evaluate((v) => window.renderAt(v), f / fps)
      const buf = await page.screenshot({ type: 'jpeg', quality: 95 })
      if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once('drain', r))
      if (++done % 120 === 0) console.log(`frame ${done}/${frames}`)
    }
    enc.stdin.end()
    await new Promise((r) => enc.on('close', r))
    await browser.close()
  }))
  const list = path.join(tmp, 'list.txt')
  fs.writeFileSync(list, Array.from({ length: workers }, (_, w) => `file 'seg-${w}.mp4'`).join('\n'))
  await new Promise((r, j) => spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out], { stdio: 'inherit' }).on('close', (c) => (c ? j(new Error('concat failed')) : r())))
  fs.rmSync(tmp, { recursive: true, force: true })
  console.log('wrote', out)
}
server.close()
