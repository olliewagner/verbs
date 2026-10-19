import { TAU, beat, ease, frames, hash, hex, loopNoise, mod, shade, type Canvas, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const SKY = hex('050916 08102a 0c1a3c 12264e 1a3460 26457a')
const MOON = hex('5a6e9a 9aaed4 d2def2 f4f8ff')
const FAR = hex('0a1630 0f1e3c 152a4c 1e385c 2a4a70')
const NEAR = hex('03070d 060d17 0a1520 0f1f2c 162a3a')
const GROUND = hex('040b0e 07141a 0a1d20 0e2826 133430 18423a 1f5446 2a6c56 3a886a 54a680 7cc49a b0e2c0 e4fae8')
const CAP = hex('0e1828 152840 1c3a54 245066 2e6c78 3e9088 58b49a 84d6b4 bcf0d6 f0fff6')
const STEM = hex('0c121e 162232 223444 34505c 4c7074 6e968e 9cc2b0 d2ecdc')
const BARK = hex('020509 050a12 08101a 0c1824 12222f 1a2e3c 264050')
const FERN = hex('020608 040c0e 071414 0b1e1c 102a26 18382e')
const MOTE = [hex('18423a 2a6c56 54a680 9fe2c0 e4fff0'), hex('2a1e52 4a3888 7a62c0 b8a0ec eee4ff')] as const

const RX = 32
const RY = 23
const RA = 19
const RB = 5.2
const COUNT = 9

type Shroom = { x: number; y: number; depth: number; on: number }
const SHROOMS: Shroom[] = Array.from({ length: COUNT }, (_, i) => {
  const a = TAU / 4 + (i / COUNT) * TAU
  const depth = (Math.sin(a) + 1) / 2
  return { x: Math.round(RX + Math.cos(a) * RA), y: Math.round(RY + Math.sin(a) * RB), depth, on: i === 0 ? 8 : 9 + i * 3 }
})

const SMALL = ['ccc', '.s.']
const MEDIUM = ['.ccc.', 'ccccc', '..s..', '..s..']
const LARGE = ['..ccc..', '.cCcCc.', 'ccccccc', '...s...', '...s...']

function glowOf(i: number, f: number): number {
  const s = SHROOMS[i]
  if (!s) return 0
  const rise = i === 0 && f < s.on + 2 ? (f === s.on ? 0.6 : f === s.on + 1 ? 0.08 : 0) : beat(f, i === 0 ? s.on + 2 : s.on, s.on + 6 + (i === 0 ? 2 : 0))
  const off = 50 + i * 1.6
  const fade = 1 - beat(f, off, off + 8)
  return rise * fade * (0.92 + 0.08 * Math.sin(f * 0.55 + i * 1.7))
}

const flare = (f: number) => beat(f, 35, 37) * (1 - 0.6 * beat(f, 37, 44)) * (1 - beat(f, 50, 62))

type Pine = { x: number; top: number; base: number; width: number }
const pines = (count: number, seed: number, x0: number, span: number, top: number, varTop: number, base: number): Pine[] =>
  Array.from({ length: count }, (_, i) => ({
    x: x0 + (i / count) * span + hash(seed, i) * (span / count) * 0.7,
    top: top + hash(seed, i, 1) * varTop,
    base,
    width: 0.38 + hash(seed, i, 2) * 0.12,
  }))
const FAR_PINES = pines(13, 5, -4, 72, 5, 4, 17)
const NEAR_PINES = [...pines(4, 9, 4, 30, 1, 4, 18), ...pines(3, 13, 52, 14, 0, 3, 18)]
const inPine = (p: Pine, x: number, y: number) => {
  if (y < p.top || y > p.base) return false
  const d = y - p.top
  const tier = (d % 4) / 3
  return Math.abs(x - Math.round(p.x)) <= Math.floor(d * p.width * (0.8 + 0.3 * tier) + 0.3)
}

const TUFTS: [number, number][] = Array.from({ length: 20 }, (_, i): [number, number] => [
  Math.floor(hash(i, 3) * 60) + 2,
  Math.floor(18 + hash(i, 4) * 13),
]).filter(([x, y]) => {
  const e = Math.hypot((x - RX) / RA, (y - RY) / RB)
  return e < 0.75 || e > 1.25
})

type Mote = { x: number; y: number; level: number; hue: number; isBack: boolean }

function motesAt(f: number): Mote[] {
  const out: Mote[] = []
  for (let k = 0; k < 44; k++) {
    const born = 36 + Math.floor(k / 2) * 0.9
    const life = 26 + Math.floor(hash(k, 2) * 8)
    const age = mod(f - born, LOOP)
    if (age >= life) continue
    const t = age / life
    const a = born * 0.6 + age * 0.23 + (k % 2) * Math.PI
    const shrink = 1 - 0.62 * ease.out(Math.min(1, age / 16))
    const wind = Math.max(0, age - 13) ** 1.4 * 0.3
    const rise = age * 1.05 - Math.max(0, age - 13) * 0.4
    const x = RX + Math.cos(a) * RA * shrink + wind
    const y = RY - 1 + Math.sin(a) * RB * shrink - rise
    const twinkle = (Math.floor(f / 2) + k) % 5 === 0 ? 1.2 : 0
    out.push({ x: Math.round(x), y: Math.round(y), level: 3.8 - t * 3.2 + twinkle, hue: k % 4 === 3 ? 1 : 0, isBack: Math.sin(a) < 0 })
  }
  return out
}

function drawShroom(c: Canvas, s: Shroom, g: number, pop: number): void {
  const art = s.depth > 0.75 ? LARGE : s.depth > 0.3 ? MEDIUM : SMALL
  const w = (art[0] ?? '').length
  const stemRows = art.filter(r => r.includes('s')).length
  const top = s.y - art.length + 1
  art.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i]
      const x = s.x - (w >> 1) + i
      const isCap = ch === 'c' || ch === 'C'
      const y = top + j - (isCap ? pop : 0)
      if (isCap) {
        const capRow = j / Math.max(1, art.length - stemRows - 1)
        const side = i > w / 2 ? 0.5 : i < w / 2 - 1 ? -0.3 : 0
        const spot = ch === 'C' ? 1.2 * g : 0
        c.set(x, y, shade(CAP, 1.6 + g * 6 + (1 - capRow) * (0.6 + g) + side + spot))
      } else if (ch === 's') {
        c.set(x, y, shade(STEM, 1.6 + g * 4.6 + (j === art.length - 1 ? -0.6 : 0)))
      }
    }
  })
}

function drawScene(c: Canvas, f: number): void {
  const g = SHROOMS.map((_, i) => glowOf(i, f))
  const fl = flare(f)
  const glowAt = (x: number, y: number) => {
    let sum = 0
    SHROOMS.forEach((s, i) => {
      const gi = g[i] ?? 0
      if (gi <= 0) return
      const d = Math.hypot(x - s.x, (y - s.y + 1) * 2.4) / (5 + s.depth * 4)
      if (d < 1) sum += gi * (1 - d) ** 1.4
    })
    const e = Math.hypot((x - RX) / RA, (y - RY) / RB)
    return sum + fl * (Math.max(0, 1 - Math.abs(e - 1) * 4) * 0.9 + Math.max(0, 1 - e) * 0.35)
  }

  for (let y = 0; y < 18; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - 47, y - 5)
      const halo = d < 7 ? 1.4 : d < 11 ? 0.8 : d < 16 ? 0.35 : 0
      c.set(x, y, shade(SKY, 0.6 + y * 0.17 + halo))
    }
  }
  for (const [sx, sy, p] of [[6, 2, 0], [13, 5, 3], [21, 1, 6], [27, 4, 1], [36, 2, 4], [57, 3, 2], [61, 8, 5], [33, 7, 7]] as const) {
    const lit = (Math.floor(f / 6) + p) % 5 === 0 ? 2.6 : 1.8
    c.set(sx, sy, shade(MOON, lit - 1.6))
  }
  for (let y = 1; y <= 9; y++) {
    for (let x = 43; x <= 51; x++) {
      const d = Math.hypot(x - 47, y - 5)
      if (d > 3.6) continue
      const crater = (x === 46 && y === 4) || (x === 48 && y === 6) || (x === 45 && y === 6)
      c.set(x, y, shade(MOON, 3 - (x < 46 ? 0.7 : 0) - (crater ? 1 : 0) - (d > 3 ? 0.6 : 0)))
    }
  }

  for (let y = 0; y < 18; y++) {
    for (let x = 0; x < W; x++) {
      if (!FAR_PINES.some(p => inPine(p, x, y))) continue
      c.set(x, y, shade(FAR, 1.2 + (y - 6) * 0.08 + (x > 40 && x < 54 ? 0.6 : 0)))
    }
  }
  for (let y = 12; y < 19; y++) {
    for (let x = 0; x < W; x++) {
      const n = loopNoise(x / 14, y / 4, f / LOOP, 1, 3)
      const density = n * (1 - Math.abs(y - 15.5) / 3.5)
      if (density > 0.3) c.set(x, y, shade(FAR, 2.6 + (density > 0.5 ? 1 : 0)))
    }
  }
  for (let y = 0; y < 19; y++) {
    for (let x = 0; x < W; x++) {
      const p = NEAR_PINES.find(q => inPine(q, x, y))
      if (p) c.set(x, y, shade(NEAR, 1 + (y > 14 ? 0.6 : 0)))
    }
  }

  for (let y = 17; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const moon = Math.max(0, 1 - Math.hypot((x - 36) / 30, (y - 22) / 9))
      const e = Math.hypot((x - RX) / RA, (y - RY) / RB)
      const ring = Math.abs(e - 1) < 0.18 ? -0.8 : 0
      const edge = y === 17 ? -0.6 : 0
      c.set(x, y, shade(GROUND, 2 + moon * 2.4 + ring + edge - (y - 17) * 0.05 + glowAt(x, y) * 6.4))
    }
  }
  for (const [x, y] of TUFTS) {
    const level = 3 + Math.max(0, 1 - Math.hypot((x - 36) / 30, (y - 22) / 9)) * 2.4 + glowAt(x, y) * 6.4
    for (const [dx, dy] of [[0, -1], [0, -2], [1, -1]] as const) c.set(x + dx, y + dy, shade(GROUND, level + 0.7))
  }

  const motes = motesAt(f)
  const drawMote = (m: Mote) => {
    const r = m.hue ? MOTE[1] : MOTE[0]
    const level = m.level - (m.isBack ? 0.8 : 0)
    if (level < 0.6) return
    c.set(m.x, m.y, shade(r, level))
    if (level > 2.6) c.set(m.x, m.y + 1, shade(r, level - 2.4))
  }
  motes.filter(m => m.isBack).forEach(drawMote)
  const order = SHROOMS.map((s, i) => ({ s, i })).sort((a, b) => a.s.y - b.s.y)
  for (const { s, i } of order) {
    const hop = i === 0 ? s.on + 2 : s.on
    const pop = f === hop || f === hop + 1 ? 1 : 0
    drawShroom(c, s, Math.min(1, (g[i] ?? 0) + fl * 0.4), pop)
  }
  motes.filter(m => !m.isBack).forEach(drawMote)

  for (let y = 0; y < H; y++) {
    const flare = y > 26 ? (y - 26) * 0.6 : 0
    for (let x = 0; x <= 4 + flare; x++) {
      const isRim = x >= 3 + flare
      c.set(x, y, shade(BARK, 1.2 + (isRim ? 1 + glowAt(x + 2, Math.max(18, y)) * 5 : 0) + (x === 1 && y % 5 === 2 ? -0.6 : 0)))
    }
  }
  const fern = (cx: number, by: number, dir: 1 | -1, len: number, level: number) => {
    for (let k = 0; k < len; k++) {
      const x = cx + dir * k
      const y = by - Math.round(Math.sin((k / len) * Math.PI * 0.9) * 4)
      const color = shade(FERN, level + glowAt(x, by - 2) * 4)
      c.set(x, y, color)
      if (k % 2 === 1 && k < len - 1) c.set(x, y + 1, color)
      if (k % 2 === 1 && k < len - 3) c.set(x, y + 2, color)
    }
  }
  fern(4, 29, 1, 8, 1.4)
  fern(5, 32, 1, 10, 2.2)
  fern(62, 28, -1, 8, 1.4)
  fern(63, 32, -1, 11, 2.2)
}

export const scene: Scene = {
  verb: 'Enchanting',
  render: () => frames(LOOP, drawScene),
  hero: 47,
}
