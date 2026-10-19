import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeFrames, encodeFrames } from '../hooks/baked.ts'
import { SCENES } from '../hooks/scenes/index.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const slug = verb => verb.normalize('NFD').replace(/[\u0300-\u036f']/g, '').toLowerCase()

const isCheck = process.argv.includes('--check')
const dir = join(ROOT, 'hooks', 'frames')
mkdirSync(dir, { recursive: true })

const files = []
const stale = []
for (const scene of SCENES) {
  const file = slug(scene.verb)
  const frames = scene.render()
  const text = JSON.stringify(encodeFrames(scene.verb, frames)) + '\n'
  const decoded = decodeFrames(JSON.parse(text))
  const isSame = decoded.length === frames.length && decoded.every((f, i) => f.every((c, j) => c === frames[i][j]))
  if (!isSame) throw new Error(`${file}: the decoded frames differ from the scene's`)
  const path = join(dir, `${file}.txt`)
  if (isCheck) {
    if (!existsSync(path) || readFileSync(path, 'utf8') !== text) stale.push(file)
  } else writeFileSync(path, text)
  files.push({ verb: scene.verb, file, hero: scene.hero ?? 0 })
}
const index = `export const FILMS: readonly { verb: string; file: string; hero: number }[] = [
${files.map(f => `  { verb: ${JSON.stringify(f.verb)}, file: ${JSON.stringify(f.file)}, hero: ${f.hero} },`).join('\n')}
]
`
const indexPath = join(dir, 'index.ts')
if (isCheck) {
  if (!existsSync(indexPath) || readFileSync(indexPath, 'utf8') !== index) stale.push('index.ts')
  const extra = readdirSync(dir).filter(f => f.endsWith('.txt') && !files.some(x => `${x.file}.txt` === f))
  stale.push(...extra)
  if (stale.length > 0) {
    console.error(`bake: stale or missing: ${stale.join(' ')}; run node --import ./tools/ts.mjs tools/bake.mjs`)
    process.exit(1)
  }
  console.log(`bake: ${files.length} scenes, every frame file current`)
} else {
  writeFileSync(indexPath, index)
  console.log(`bake: ${files.length} scenes, every pixel decoded as drawn`)
}
