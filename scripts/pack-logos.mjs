// Packs public/img/logos/*.webp into <outDir>/img/logo-pack.json (data URIs) and drops the loose files from <outDir>.
// Used for the hosted preview, which accepts a limited number of files per page.
import fs from 'node:fs'
import path from 'node:path'

const outDir = process.argv[2] || 'dist-preview'
const src = path.resolve('public/img/logos')
const pack = {}
for (const f of fs.readdirSync(src).filter((f) => f.endsWith('.webp'))) pack[f.slice(0, -5)] = `data:image/webp;base64,${fs.readFileSync(path.join(src, f)).toString('base64')}`
fs.writeFileSync(path.join(outDir, 'img/logo-pack.json'), JSON.stringify(pack))
fs.rmSync(path.join(outDir, 'img/logos'), { recursive: true, force: true })
console.log(`packed ${Object.keys(pack).length} logos into ${outDir}/img/logo-pack.json`)
