import { PALETTE, beat, ease, frames, hash, hex, shade, type Canvas, type Scene } from '../engine'

const W = 64
const LOOP = 72

const X0 = 14
const X1 = 49
const Y0 = 7
const Y1 = 24
const RAIL_Y = 30

const WALL = hex('080820 0d0e2e 13163e 1a1f50 222a62 2c3774 394786 4b5a98')
const WOOD = hex('0e080a 1a0f10 2a1816 3d221c 523022 6a3f2a 845234')
const GOLD = PALETTE.gold
const RAIL = hex('0c0a1c 1a1530 2a2140 3d2f4c 554058')
const GEMS = {
  ruby: hex('2a0612 5a0c1e 9a142a d8283c ff6a62 ffd6cc'),
  sapphire: hex('060a30 0c1a62 1a36a4 3a66e2 8ab2ff e2eeff'),
  emerald: hex('03201a 08402e 0f7050 1ea270 72e2a8 d6ffe8'),
  amethyst: hex('1a0628 360c50 5c1a84 8a3ab8 c88aec f2deff'),
} as const

const front = (f: number) => ease.inOut(beat(f, 6, 31)) * 64

const SCROLL = [[0, 1], [0, 2], [0, 3], [1, 4], [2, 4], [3, 4], [4, 3], [3, 2], [2, 2]] as const

type Gilt = { s: number; nx: number; ny: number; root?: number; grow?: number }
const GILT: ReadonlyMap<number, Gilt> = (() => {
  const half = new Map<number, Gilt>()
  const put = (x: number, y: number, g: Gilt) => {
    const key = y * W + x
    const old = half.get(key)
    if (!old || old.s > g.s) half.set(key, g)
  }
  for (const [x, y, s] of [[31, Y1 + 1, 0], [30, Y1 + 2, 0.5], [31, Y1 + 3, 1]] as const) put(x, y, { s, nx: -0.6, ny: 0.8 })
  for (let x = 31; x >= X0 - 1; x--) put(x, Y1 + 1, { s: 31 - x, nx: 0, ny: 1 })
  for (let y = Y1; y >= Y0 - 1; y--) put(X0 - 1, y, { s: 18 + (Y1 + 1 - y), nx: -1, ny: 0 })
  for (let x = X0; x <= 31; x++) put(x, Y0 - 1, { s: 37 + (x - X0 + 1), nx: 0, ny: -1 })

  const scroll = (ax: number, ay: number, out: 'down' | 'up' | 'left', side: 1 | -1, s: number) => {
    const map = ([u, v]: readonly [number, number]): [number, number] =>
      out === 'down' ? [ax + u * side, ay + v] : out === 'up' ? [ax + u * side, ay - v] : [ax - v, ay + u * side]
    const [cx, cy] = map([2, 2.6])
    SCROLL.forEach((p, i) => {
      const [x, y] = map(p)
      const d = Math.hypot(x - cx, y - cy) || 1
      put(x, y, { s: s + 1 + i * 0.6, nx: (x - cx) / d, ny: (y - cy) / d, root: s + 1, grow: Math.floor(i / 3) })
    })
  }
  scroll(27, Y1 + 1, 'down', -1, 4)
  scroll(20, Y1 + 1, 'down', -1, 11)
  scroll(X0, Y1 + 1, 'down', -1, 17)
  scroll(X0 - 1, 19, 'left', 1, 24)
  scroll(X0 - 1, 12, 'left', -1, 31)
  scroll(X0, Y0 - 1, 'up', -1, 38)
  scroll(20, Y0 - 1, 'up', -1, 44)
  scroll(26, Y0 - 1, 'up', 1, 50)

  const all = new Map<number, Gilt>()
  for (const [key, g] of half) {
    const x = key % W
    const y = Math.floor(key / W)
    all.set(key, g)
    all.set(y * W + (63 - x), { ...g, nx: -g.nx })
  }
  return all
})()

const CREST = [
  '.gggg.',
  'gGGGGg',
  'gGjjGg',
  'gGjjGg',
  '.gGGg.',
  '..gg..',
]
const CREST_X = 29
const CREST_AT = 31
const FLASH_AT = CREST_AT + 6
const SHINE_AT = 42
const CRUMBLE = 56

const arrival = (s: number) => {
  let f = 0
  while ((front(f) < s || front(f) <= 0) && f < LOOP) f++
  return f
}

const GILT_AT: ReadonlyMap<number, number> = new Map(
  [...GILT].map(([key, g]) => [key, Math.max(arrival(g.s), arrival(g.root ?? g.s) + (g.grow ?? 0))]),
)

type Gem = { x: number; y: number; ramp: readonly number[]; at: number }
const GEM_LIST: Gem[] = [
  { x: X0, y: Y0, ramp: GEMS.ruby, at: arrival(40) },
  { x: X1 - 1, y: Y0, ramp: GEMS.sapphire, at: arrival(40) + 1 },
  { x: X0, y: Y1 - 1, ramp: GEMS.emerald, at: arrival(21) },
  { x: X1 - 1, y: Y1 - 1, ramp: GEMS.amethyst, at: arrival(21) + 1 },
]
const BEZEL = [[0, -1], [1, -1], [-1, 0], [2, 0], [-1, 1], [2, 1], [0, 2], [1, 2]] as const

const releaseOf = (x: number, y: number) => 52 + (y / 31) * 6 + Math.floor(hash(x, y, 9) * 5)

const isFrame = (x: number, y: number) =>
  x >= X0 && x <= X1 && y >= Y0 && y <= Y1 && !(x > X0 + 1 && x < X1 - 1 && y > Y0 + 1 && y < Y1 - 1)

const wallLevel = (x: number, y: number) => 6.4 - Math.hypot(x + 6, (y + 10) * 1.4) / 10.5

function drawScene(c: Canvas, f: number): void {
  const shine = (x: number, y: number) => {
    const d = x + y * 1.3 - ((f - SHINE_AT) * 9 - 8)
    return f >= SHINE_AT && f <= SHINE_AT + 10 && d >= 0 && d < 4 ? 2.6 - d * 0.4 : 0
  }
  const gold = (x: number, y: number, level: number) => c.set(x, y, shade(GOLD, level + shine(x, y)))
  const glow = f >= FLASH_AT && f < FLASH_AT + 8 ? 1 - (f - FLASH_AT) / 8 : 0

  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < W; x++) {
      if (y >= RAIL_Y) {
        c.set(x, y, shade(RAIL, y === RAIL_Y ? 3.4 - x / 40 : 1.6 - x / 60))
        continue
      }
      let level = wallLevel(x, y)
      const inside = x > X0 + 1 && x < X1 - 1 && y > Y0 + 1 && y < Y1 - 1
      if (inside && (x <= X0 + 3 || y <= Y0 + 3)) level -= x <= X0 + 2 || y <= Y0 + 2 ? 1.6 : 0.8
      if (!inside && !isFrame(x, y) && isFrame(x - 1, y - 1)) level -= 1.5
      if (glow > 0) level += glow * 2.4 * Math.max(0, 1 - Math.hypot(x - 31.5, (y - 3) * 1.6) / 16)
      c.set(x, y, shade(WALL, level))
    }
  }

  for (let y = Y0; y <= Y1; y++) {
    for (let x = X0; x <= X1; x++) {
      if (!isFrame(x, y)) continue
      const isOuter = x === X0 || x === X1 || y === Y0 || y === Y1
      const facesLight = (isOuter && (x === X0 || y === Y0)) || (!isOuter && (x === X1 - 1 || y === Y1 - 1))
      c.set(x, y, shade(WOOD, (isOuter ? 3.6 : 2.4) + (facesLight ? 1.4 : -0.8) - (x + y) / 70 + shine(x, y) * 0.3))
    }
  }

  const visible = (key: number, x: number, y: number) => f >= (GILT_AT.get(key) ?? LOOP) && f < releaseOf(x, y)
  for (const key of GILT.keys()) {
    const x = key % W
    const y = Math.floor(key / W)
    if (!visible(key, x, y)) continue
    const sx = x + 1
    const sy = y + 1
    if (sy < RAIL_Y && !isFrame(sx, sy) && !GILT.has(sy * W + sx)) c.set(sx, sy, shade(WALL, wallLevel(sx, sy) - 1.8))
  }

  for (const [key, g] of GILT) {
    const x = key % W
    const y = Math.floor(key / W)
    if (!visible(key, x, y)) continue
    const lit = -0.62 * g.nx - 0.78 * g.ny
    const tip = [2.4, 1.4, 0.6][f - (GILT_AT.get(key) ?? 0)] ?? 0
    gold(x, y, 4.3 + lit * 1.4 + tip)
  }

  for (const gem of GEM_LIST) {
    if (f < gem.at || f >= CRUMBLE + 2) continue
    const pop = f === gem.at ? 3 : f === gem.at + 1 ? 1.4 : 0
    for (const [dx, dy] of BEZEL) gold(gem.x + dx, gem.y + dy, 4 + (dy < 0 || dx < 0 ? 1.3 : -0.4) + pop)
    if (f === gem.at) {
      for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) c.set(gem.x + dx, gem.y + dy, 0xfffbe8)
      continue
    }
    const twinkle = (f + gem.at * 3) % 24 < 2 ? 1 : 0
    const r = gem.ramp
    const at = (dx: number, dy: number, level: number) => c.set(gem.x + dx, gem.y + dy, shade(r, level + shine(gem.x + dx, gem.y + dy)))
    at(0, 0, 4 + twinkle)
    at(1, 0, 3)
    at(0, 1, 2.2)
    at(1, 1, 1.4 + twinkle * 3.6)
  }

  if (f >= CREST_AT && f < CRUMBLE) {
    const rise = ease.outBack(beat(f, CREST_AT, CREST_AT + 5))
    const shown = Math.min(CREST.length, Math.round(rise * CREST.length))
    const lift = rise > 1.04 ? -1 : 0
    CREST.forEach((row, j) => {
      if (CREST.length - j > shown) return
      for (let i = 0; i < row.length; i++) {
        const x = CREST_X + i
        const y = j + lift
        const ch = row[i]
        const left = i < 3 ? 1 : -1
        if (ch === 'g') gold(x, y, 4.4 + left * 0.8 + (j < 2 ? 0.8 : -0.3))
        else if (ch === 'G') gold(x, y, 2.8 - left * 0.4)
        else if (ch === 'j') {
          const flash = [1, 0.65, 0.35, 0.12][f - FLASH_AT] ?? 0
          const base = i === 2 && j === 2 ? 4.2 : i === 3 && j === 3 ? 1.5 : 2.8
          c.set(x, y, shade(GEMS.ruby, base + (5 - base) * flash + shine(x, y)))
        }
      }
    })
  }

  if (f >= FLASH_AT && f < FLASH_AT + 6) {
    const age = f - FLASH_AT
    const r = 3 + age * 1.6
    for (let y = 0; y < 16; y++) {
      for (let x = 14; x < 50; x++) {
        const d = Math.abs(x - 31.5) + Math.abs(y - 2.5) * 1.3
        if (Math.abs(d - r) < 0.55 && !GILT.has(y * W + x)) c.set(x, y, shade(GOLD, 7.2 - age * 0.9))
      }
    }
  }

  const dust = (x: number, y: number, from: number, ramp: readonly number[], top: number) => {
    const age = f - from
    if (age < 0 || age > 8) return
    const fall = age * 0.6 + age * age * 0.07
    const dx = Math.round(Math.sin(age * 0.9 + hash(x, y) * 6) * 0.7)
    const sparkle = (age + x) % 3 === 0 ? 1.2 : 0
    c.set(x + dx, y + fall, shade(ramp, top - age * 0.7 + sparkle))
  }
  for (const key of GILT.keys()) {
    const x = key % W
    const y = Math.floor(key / W)
    dust(x, y, releaseOf(x, y), GOLD, 6.2)
  }
  for (const gem of GEM_LIST) dust(gem.x, gem.y, CRUMBLE + 2, gem.ramp, 4.6)
  CREST.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] !== '.') dust(CREST_X + i, j, CRUMBLE, row[i] === 'j' ? GEMS.ruby : GOLD, 6)
    }
  })

  if (f >= 3 && f < 6) {
    const level = [4.5, 6.6, 7.4][f - 3] ?? 4
    for (const x of [31, 32]) gold(x, Y1 + 1, level)
  }
}

export const scene: Scene = {
  verb: 'Embellishing',
  render: () => frames(LOOP, drawScene),
  hero: 41,
  snaps: [
    { frames: FLASH_AT, box: [30, 2, 34, 4], why: "the medallion's ruby flashes white, then cools over three frames" },
    { frames: SHINE_AT + 5, box: [30, 2, 36, 6], colors: [...GOLD, ...GEMS.ruby], why: 'the shine sweeps across the medallion at nine pixels a frame' },
    {
      frames: [CRUMBLE, CRUMBLE + 9],
      box: [8, 0, 55, 31],
      colors: [...GOLD, ...GEMS.ruby, ...GEMS.sapphire, ...GEMS.emerald, ...GEMS.amethyst],
      why: 'the gilt and gems crumble into falling gold dust, top first',
    },
  ],
}
