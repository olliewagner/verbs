import { Canvas, H, W, beat, ease, frames, hash, hex, lerp, mod, shade, type Scene } from '../engine'

const LOOP = 72

const SKY = hex('060a1a 0a1226 0e1a34 142442 1a2e50 22385c')
const MOON = hex('8a9cb8 c4d2e2 eef4f8')
const HEDGE = hex('03080c 061210 0a1c18 102820 18362a')
const CYPRESS = hex('02060a 050e10 0a1a18 12261f')
const STONE = hex('0e1018 1a1c28 2a2c3a 3e4050 585a6a 7a7c8a a2a4b0')
const BRONZE = hex('0c0806 1a110c 2c1c12 422a16 5c3a1c 7a4e22 9c682c c48a3a e8b45a')
const GRASS = hex('020604 06100a 0c1a10 142618')
const FLY = hex('2a3a14 5a7a20 a8d040 e4ff8a fdffe0')
const FLY_HALO = hex('2c3e1a 4c6a22')

const THINKER = [
  '........hhh...............',
  '.......hhhhh..............',
  '.......hhhhhh.bb..........',
  '.......hhhhhh.bbb.........',
  '........hhhhbbbbbb........',
  '........aaa.bbbbbbb.......',
  '........aaa..bbbbbb.......',
  '........aa...aabbbb.......',
  '........aa..aabbbbb.......',
  '........aa.aabbbbbbb......',
  '........aaaabbbbbbbb......',
  '........aaaabbbbbbbb......',
  '......llaaallbbbbbbb......',
  '.....llllllllllllllb......',
  '.....llllllllllllllb......',
  '......lllllllllllllb......',
  '......llll....rrrrrrrr....',
  '.....llll....rrrrrrrrrrr..',
  '.....llll...rrrrrrrrrrrrr.',
  '.....lll....rrrrrrrrrrrrr.',
  '.....lll....rrrrrrrrrrrrr.',
  '.....ll.....rrrrrrrrrrrrr.',
  '....lll.....rrrrrrrrrrrrr.',
  '.lllllll...rrrrrrrrrrrrrr.',
  'rrrrrrrrrrrrrrrrrrrrrrrrrr',
]
const SX = 29
const SY = 4
const PART = new Map<number, string>()
THINKER.forEach((row, j) => {
  for (let i = 0; i < row.length; i++) if (row[i] !== '.') PART.set((SY + j) * W + SX + i, row[i] ?? '')
})
const isStatue = (x: number, y: number) => PART.has(y * W + x)
const HEAD = { x: SX + 9.5, y: SY + 2.5 }
const MOON_AT = { x: 13, y: 9, r: 5.2 }

const TOP = SY + THINKER.length
const PLINTH: readonly (readonly [number, number, number])[] = [
  [TOP, SX - 1, SX + 26], [TOP + 1, SX, SX + 25], [TOP + 2, SX + 2, SX + 23],
]

const COUNT = 9
const GATHER0 = 16
const GATHER1 = 34
const SCATTER0 = 58
const SCATTER1 = 71
const FLARE = 50

function gathered(f: number): number {
  if (f < GATHER0 || f >= SCATTER1) return 0
  if (f < GATHER1) return ease.inOut(beat(f, GATHER0, GATHER1))
  if (f < SCATTER0) return 1
  return 1 - ease.inOut(beat(f, SCATTER0, SCATTER1))
}

type Fly = { x: number; y: number; depth: number; glow: number }

function flies(f: number): Fly[] {
  const g = gathered(f)
  const t = f / LOOP
  return Array.from({ length: COUNT }, (_, i) => {
    const r = (k: number) => hash(i, k, 404)
    const wx = 4 + r(1) * 56 + Math.sin(Math.PI * 2 * (t + r(2))) * (3 + r(3) * 4)
    const wy = 17 + r(4) * 9 + Math.sin(Math.PI * 2 * (2 * t + r(5))) * 2
    const ang = (i / COUNT) * Math.PI * 2 + f * 0.11
    const rx = 9.5 + r(6) * 1.5
    const ox = HEAD.x + Math.cos(ang) * rx
    const oy = HEAD.y + Math.sin(ang) * 2.8
    const bow = Math.sin(g * Math.PI) * 5
    const k = ease.inOut(g)
    const x = lerp(wx, ox, k) + Math.cos(ang + 1.2) * bow
    const y = lerp(wy, oy, k) - Math.sin(g * Math.PI) * 3
    const blink = Math.max(0, Math.sin(Math.PI * 2 * (3 * t + r(7))))
    const steady = 0.75 + 0.15 * Math.sin(f * 0.5 + i * 1.3)
    const flare = f >= FLARE && f < FLARE + 8 ? 1 - beat(f, FLARE, FLARE + 8) : 0
    const glow = lerp(blink ** 0.6, steady, g) + flare * 0.9 * g
    return { x, y, depth: Math.sin(ang) * g, glow }
  })
}

function draw(c: Canvas, f: number): void {
  const swarm = flies(f)
  const lights = [[flies(mod(f - 1, LOOP)), 0.25], [swarm, 0.5], [flies(mod(f + 1, LOOP)), 0.25]] as const
  const flyLight = (x: number, y: number) => {
    let sum = 0
    for (const [group, w] of lights) {
      for (const s of group) {
        const d = Math.hypot(x - s.x, y - s.y)
        sum += w * s.glow * Math.max(0, 1 - d / 5.5) ** 1.5
      }
    }
    return sum
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const halo = Math.max(0, 1 - Math.hypot(x - MOON_AT.x, y - MOON_AT.y) / 20)
      c.set(x, y, shade(SKY, 0.4 + (y / 22) * 2.4 + halo * 2.6, x, y))
    }
  }
  for (const [x, y, p] of [[6, 2, 0.4], [12, 8, 0.7], [17, 2, 0], [52, 1, 0.6], [59, 6, 0.1], [55, 12, 0.5], [48, 3, 0.9], [3, 13, 0.2]] as const) {
    const tw = Math.sin(((f / LOOP) * 3 + p) * Math.PI * 2)
    c.set(x, y, tw > 0.6 ? 0xdde6f2 : 0x7a88a8)
  }
  for (let y = Math.floor(MOON_AT.y - MOON_AT.r); y <= Math.ceil(MOON_AT.y + MOON_AT.r); y++) {
    for (let x = Math.floor(MOON_AT.x - MOON_AT.r); x <= Math.ceil(MOON_AT.x + MOON_AT.r); x++) {
      const d = Math.hypot(x + 0.5 - MOON_AT.x, y + 0.5 - MOON_AT.y)
      if (d > MOON_AT.r) continue
      const sea = Math.hypot(x - MOON_AT.x + 3, y - MOON_AT.y + 2) < 2.2 || Math.hypot(x - MOON_AT.x - 2, y - MOON_AT.y - 3) < 1.8 || Math.hypot(x - MOON_AT.x + 1, y - MOON_AT.y - 1) < 1.2
      c.set(x, y, MOON[d > MOON_AT.r - 1 || sea ? 1 : 2] ?? 0)
    }
  }

  for (const [cx, top, half] of [[5, 3, 3.2], [58, 6, 2.8], [62, 10, 2.2]] as const) {
    for (let y = top; y < H; y++) {
      const v = (y - top) / (H - top)
      const w = half * Math.min(1, 0.25 + v * 2.2) * (1 - v * 0.15)
      for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w); x++) {
        if (Math.abs(x - cx) > w) continue
        const rim = x < cx - w + 1 ? 1.4 : 0
        c.set(x, y, shade(CYPRESS, 0.8 + rim + flyLight(x, y) * 2, x, y))
      }
    }
  }
  for (let x = 0; x < W; x++) {
    const bump = Math.abs(Math.sin((x + 3) * 0.32))
    const top = Math.round(25 - bump * 2.2 + Math.sin(x * 0.11) * 0.8)
    for (let y = top; y < H; y++) {
      if (x >= 2 && x <= 8 && y < 27) continue
      const rim = y === top ? 1.3 : y === top + 1 && bump > 0.5 ? 0.6 : 0
      const fold = Math.abs(Math.sin((x + 3) * 0.32)) < 0.25 && y > top + 1 ? -0.6 : 0
      c.set(x, y, shade(HEDGE, 1 + rim + fold + flyLight(x, y) * 2.4, x, y))
    }
  }
  for (let x = 0; x < W; x++) {
    for (let y = 30; y < H; y++) c.set(x, y, shade(GRASS, 1.4 + flyLight(x, y) * 2 - (y - 30) * 0.5, x, y))
    if (hash(Math.floor(x / 2), 9) < 0.4) c.set(x, 29, shade(GRASS, 1.6 + flyLight(x, 29) * 2, x, 29))
  }

  const drawFly = (s: Fly) => {
    const x = Math.round(s.x)
    const y = Math.round(s.y)
    if (s.glow < 0.15) return
    if (s.glow > 0.6) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (!isStatue(x + dx, y + dy) || s.depth >= 0) c.set(x + dx, y + dy, FLY_HALO[s.glow > 1.1 ? 1 : 0] ?? 0)
      }
    }
    c.set(x, y, shade(FLY, 1 + s.glow * 3, x, y))
  }
  for (const s of swarm) if (s.depth < 0) drawFly(s)

  for (const [y, x0, x1] of PLINTH) {
    for (let x = x0; x <= x1; x++) {
      const face = x === x0 ? 1.6 : x === x0 + 1 ? 0.8 : x === x1 ? -1 : 0
      const top = y === TOP ? 1 : 0
      const under = y === TOP + 1 ? -0.8 : 0
      const groove = y === TOP + 2 && (x - SX) % 4 === 3 ? -0.6 : 0
      c.set(x, y, shade(STONE, 2.6 + face + top + under + groove + flyLight(x, y) * 1.6, x, y))
    }
  }
  for (const [key, part] of PART) {
    const x = key % W
    const y = Math.floor(key / W)
    const lit = flyLight(x, y)
    const away = !isStatue(x + 1, y) || !isStatue(x, y + 1)
    const ml = Math.hypot(MOON_AT.x - x, MOON_AT.y - y)
    let depth = 1
    while (depth < 4 && isStatue(Math.round(x + ((MOON_AT.x - x) / ml) * depth), Math.round(y + ((MOON_AT.y - y) / ml) * depth))) depth++
    if (part === 'r') {
      c.set(x, y, shade(STONE, [0, 3.4, 2.4, 1.6, 1][depth]! + lit * 1.6, x, y))
      continue
    }
    const level = [0, 6, 4.6, 3.2, 1.4][depth]! - (away && depth > 2 ? 0.8 : 0)
    c.set(x, y, shade(BRONZE, level + lit * 4.4, x, y))
  }

  for (const s of swarm) if (s.depth >= 0) drawFly(s)
}

const DART = 'Fireflies are lights: drawn into orbit or flung out of it they dart past the head faster than 2 px a frame, winking as they cross behind it, and their light on the bronze moves with them.'

export const scene: Scene = {
  verb: 'Philosophizing',
  render: () => frames(LOOP, draw),
  hero: 46,
  snaps: [
    { frames: [23, 27], box: [22, 2, 50, 14], colors: [...FLY, ...FLY_HALO], why: DART },
    { frames: [60, 66], box: [22, 2, 50, 14], colors: [...FLY, ...FLY_HALO, ...BRONZE], why: DART },
  ],
}
