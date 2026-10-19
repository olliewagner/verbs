import { Canvas, H, W, beat, clamp, ease, frames, hex, mod, particles, random, shade, wave, type Ramp, type Scene } from '../engine'

const LOOP = 48

const SKY = hex('2a1c4e 43246a 642c78 8c387a b44a72 d86662 ee8a58 f7b462 fddc8a')
const FAR = hex('4a2a62 5e3470 7a4277')
const NEAR = hex('241634 2f1c40 3c2449')
const WALL = hex('17121f 1f1829 291f35 352842 43324f 54405b 6a5065 86636b')
const FRAME = hex('2a2238 3a3050 54476a 75668a a090ac cbb6c4 eedcd6')
const WOOD = hex('1c1216 2c1b1c 412720 5b3624 7a4a2c 9c6236 c08046 e2a65c')
const ENAMEL = hex('1e1928 2e2638 433949 5d5062 7b6c7e 9c8a99 bfaab2 dcc9c6 f4e6da')
const CHROME = hex('100d18 1c1828 2c2740 433c58 5e5672 7f7792 a69eb6 d2cbdc f8f2f4')
const GLOW = hex('6a2c5e 9c3c62 cc5a5c ea8456 f8b46a fdd892 fff4d0')
const COFFEE = hex('140806 2a110a 46200f 6a3314 914b1c b86b2a dc9440')
const GLASS = hex('3a3150 554b6e 7c7396 aaa3c2 dcd8ec')
const BAKE = hex('0c090e 191318 2a1f26 413039 5c454c 7a5c5e')
const GAS = hex('16206a 2440c0 4a80ff 9ccaff dff0ff')
const MUG = hex('0f1530 18265a 243a80 3656a6 5a7cc4')
const LEAF = hex('0f1d18 17302a 22463a 3a6650 6a9468')
const POT = hex('3a1810 5c2614 84391c a8542a')
const TIN = hex('2a1420 4a1e2c 72303a 9a4a48')
const STEAM_SKY = hex('f2b08c fbd2b0 fff0dc')
const STEAM_WALL = hex('6e6086 a094b8 dcd2ea')

const room = (x: number, y: number) => Math.max(0, 1 - Math.hypot(x - 18, (y - 12) * 1.2) / 44) ** 1.3
const vignette = (x: number, y: number) => ((x - 32) / 36) ** 2 + ((y - 14) / 22) ** 2

const WX0 = 5
const WX1 = 30
const GLASS_X0 = 7
const GLASS_X1 = 28
const GLASS_Y0 = 4
const GLASS_Y1 = 16
const SUN = { x: 21, y: 14.6, r: 3.4 }
const COUNTER_Y = 23
const isGlass = (x: number, y: number) => x >= GLASS_X0 && x <= GLASS_X1 && y >= GLASS_Y0 && y <= GLASS_Y1

function coffee(f: number): number {
  if (f >= 6 && f < 14) return 0.5 * beat(f, 6, 8) * (1 - ease.inOut(beat(f, 9, 14)))
  if (f >= 19 && f < 23) return 0.25
  if (f >= 23 && f < 44) return Math.max(0.25, beat(f, 23, 27)) * (1 - ease.inOut(beat(f, 32, 43)))
  return 0
}

const RATTLE: Record<number, number> = { 7: 1, 8: 1, 19: 1, 20: 2, 22: 1, 23: 2, 24: 2, 25: 1 }
const hop = (f: number) => RATTLE[f] ?? 0
function body(y: number): [number, number] | undefined {
  if (y < 9 || y > 20) return undefined
  if (y <= 13) return [40, 49]
  if (y <= 19) return [39, 50]
  return [38, 51]
}
function chrome(k: number, n: number): [Ramp, number] {
  if (k === 0) return [GLOW, 2.4]
  if (k === 1) return [CHROME, 2.2]
  if (k === 2) return [GLOW, 5.2]
  if (k === 3) return [GLOW, 3.4]
  if (k === n - 1) return [CHROME, 3.2]
  if (k === n - 2) return [CHROME, 1.2]
  if (k === n - 3) return [CHROME, 2.4]
  return [CHROME, 5 - ((k - 4) / Math.max(1, n - 8)) * 1.6]
}
const SPOUT: readonly (readonly [number, number])[] = [[17, 38], [16, 38], [15, 38], [14, 37], [13, 37], [12, 37], [11, 36], [10, 35], [9, 34]]
const HANDLE = [
  '###...',
  '..###.',
  '...##@',
  '...##@',
  '...##@',
  '...##@',
  '..##@.',
  '##@...',
]
type Puff = { x: number; y: number; r: number; a: number }
function puffs(f: number): Puff[] {
  const out: Puff[] = []
  const rng = random(0x5ea)
  for (let i = 0; i < 7; i++) {
    const born = 25 + i * 1.4
    const far = 9 + rng() * 9
    const rise = 4 + rng() * 2.5
    const wob = rng() * 6
    const t = mod(f - born, LOOP)
    if (t >= 24) continue
    const a = t / 24
    const drift = 1 - (1 - a) ** 2
    out.push({
      x: 32.5 - far * drift + Math.sin(a * 4 + wob) * 0.8,
      y: 7.5 - rise * (1 - (1 - a) ** 3) + a * 1.5,
      r: 1.6 + a * 3,
      a: 1.5 * (1 - a) ** 1.1,
    })
  }
  for (const start of [20, 24]) {
    const t = f - start
    if (t < 0 || t > 5) continue
    out.push({ x: 51.5 + t * 0.6, y: 6.5 - t * 0.7, r: 1 + t * 0.25, a: 0.9 * (1 - t / 6) })
  }
  return out
}

function wisps(f: number): Puff[] {
  const strength = f >= 25 && f < 43 ? 1.15 : 0.95
  return particles(f, LOOP, 14, 26, 3).map(p => {
    const a = p.age
    const lift = 1 - (1 - a) ** 2.2
    return {
      x: 32.5 - a * (15 + p.r[2] * 6) + Math.sin(a * 6 + p.r[1] * 6) * (0.3 + a),
      y: 7.2 - lift * (4.5 + p.r[3] * 2) + Math.cos(a * 5 + p.r[1] * 6) * 0.6 * a,
      r: 1 + a * 2.5,
      a: strength * (1 - a) ** 1.2 * Math.min(1, p.t / 2 + 0.45),
    }
  })
}
function draw(c: Canvas, f: number): void {
  const dy = -hop(f)
  const level = coffee(f)
  const flicker = (x: number) => Math.sin(x * 1.9 + f * 1.7) + Math.sin(x * 0.7 - f * 1.1)
  for (let y = 0; y < COUNTER_Y; y++) {
    for (let x = 0; x < W; x++) {
      const k = Math.floor((x + 3) / 7)
      const mid = k * 7 + 0.5
      const lit = 1.6 + room(mid, y) * 4.2 - vignette(mid, y) * 1.8
      const seam = (x + 3) % 7 === 0 ? -1 : (x + 3) % 7 === 1 ? 0.6 : 0
      c.set(x, y, shade(WALL, Math.round(lit) + seam, x, y))
    }
  }
  for (let x = 54; x < W; x++) {
    c.set(x, 7, shade(WOOD, 3.2 - (x - 54) * 0.12, x, 7))
    c.set(x, 8, shade(WOOD, 1.2, x, 8))
  }
  c.set(56, 9, WOOD[1] ?? 0)
  for (let y = 2; y <= 6; y++) {
    for (let x = 56; x <= 59; x++) {
      const band = y === 4 ? 1 : 0
      const side = x === 56 ? 1 : x === 59 ? -0.8 : 0
      c.set(x, y, shade(TIN, 1.4 + band + side + (y === 2 ? 0.8 : 0), x, y))
    }
  }
  for (let y = 4; y <= 6; y++) {
    for (let x = 61; x <= 63; x++) c.set(x, y, shade(COFFEE, y === 4 ? 2.4 : x === 61 ? 2 : 1, x, y))
  }
  c.set(61, 3, GLASS[1] ?? 0)
  c.set(62, 3, GLASS[2] ?? 0)
  const glowR = 13 + wave(f, LOOP, 1) * 1.2
  for (let y = GLASS_Y0; y <= GLASS_Y1; y++) {
    for (let x = GLASS_X0; x <= GLASS_X1; x++) {
      const near = Math.max(0, 1 - Math.hypot(x - SUN.x, (y - SUN.y) * 1.5) / glowR)
      c.set(x, y, shade(SKY, ((y - GLASS_Y0) / (GLASS_Y1 - GLASS_Y0)) * 7.2 + near * 2.6, x, y))
    }
  }
  for (const [cy, x0, x1] of [[7, 9, 15], [8, 11, 17], [11, 23, 28], [6, 21, 25]] as const) {
    for (let x: number = x0; x <= x1; x++) {
      const isEnd = x === x0 || x === x1
      c.set(x, cy, shade(GLOW, isEnd ? 2 : 3.2 + (cy > 9 ? 1.4 : 0), x, cy))
    }
    if (x1 - x0 > 4) for (let x = x0 + 2; x <= x1 - 2; x++) c.set(x, cy - 1, shade(SKY, 3.4 + cy * 0.15, x, cy - 1))
  }
  for (let y = 10; y <= GLASS_Y1; y++) {
    for (let x = GLASS_X0; x <= GLASS_X1; x++) {
      const d = Math.hypot(x - SUN.x, y - SUN.y)
      if (d < SUN.r) c.set(x, y, d < SUN.r - 1.2 ? 0xfffbe6 : 0xfee9a8)
    }
  }
  for (let x = GLASS_X0; x <= GLASS_X1; x++) {
    const far = Math.round(13.8 + Math.sin(x * 0.33 + 1) * 1.1 + Math.sin(x * 0.9) * 0.4)
    for (let y = far; y <= GLASS_Y1; y++) {
      const lit = Math.max(0, 1 - Math.abs(x - SUN.x) / 9)
      c.set(x, y, shade(FAR, (y === far ? 1.2 : 0.6) + lit * 1.4, x, y))
    }
    const tree = x === 10 || x === 25 ? 2 : x === 9 || x === 11 || x === 24 || x === 26 ? 1 : 0
    const near = 15 - tree + (x < 16 ? 0 : 1)
    for (let y = Math.min(near, 16); y <= GLASS_Y1; y++) c.set(x, y, shade(NEAR, y === near ? 1.4 : 0.6, x, y))
  }
  for (const [bx0, by, lag] of [[31, 6, 0], [34, 8, 3]] as const) {
    const t = f - 2 - lag
    const bx = bx0 - Math.floor(t * 0.62)
    if (t < 0 || bx < GLASS_X0 || bx + 2 > GLASS_X1) continue
    const isUp = Math.floor(t / 3) % 2 === 0
    const col = SKY[1] ?? 0
    c.set(bx, by - (isUp ? 1 : 0), col)
    c.set(bx + 1, by, col)
    c.set(bx + 2, by - (isUp ? 1 : 0), col)
  }
  for (let y = 2; y <= 16; y++) {
    for (let x = WX0; x <= WX1; x++) {
      const isBar = isGlass(x, y) && (x === 18 || y === 10)
      if (isGlass(x, y) && !isBar) continue
      const inner = x === GLASS_X0 - 1 || y === GLASS_Y0 - 1 ? 1 : x === GLASS_X1 + 1 ? 0.6 : 0
      c.set(x, y, shade(FRAME, 1.4 + inner + (isBar ? 0.4 : 0) + room(x, y) * 0.8, x, y))
    }
  }
  c.sprite(8, 11, [
    '..l...',
    '.lk.l.',
    'lkkkk.',
    '.kkkkl',
    '.pppp.',
    '..pP..',
  ], { l: LEAF[4] ?? 0, k: LEAF[1] ?? 0, p: POT[1] ?? 0, P: POT[2] ?? 0 })
  for (let x = WX0 - 1; x <= WX1 + 1; x++) {
    c.set(x, 17, shade(FRAME, 5.4 - Math.abs(x - 18) * 0.08, x, 17))
    c.set(x, 18, shade(FRAME, 2 + (x === WX0 - 1 || x === WX1 + 1 ? -0.6 : 0), x, 18))
  }
  for (let x = WX0; x <= WX1; x++) c.set(x, 19, shade(WALL, 1, x, 19))
  for (let x = 0; x < W; x++) {
    const isStove = x >= 33 && x <= 57
    const lit = room(x, COUNTER_Y)
    const shadow = x >= 36 && x <= 54 ? (x >= 38 && x <= 52 ? 1.6 : 0.8) : 0
    if (isStove) {
      c.set(x, COUNTER_Y, shade(ENAMEL, 4.2 + lit * 4 - shadow, x, COUNTER_Y))
      c.set(x, COUNTER_Y + 1, shade(ENAMEL, 3.6 + lit * 3 - shadow * 0.8, x, COUNTER_Y + 1))
      for (let y = COUNTER_Y + 2; y < H; y++) {
        const isTrim = y === COUNTER_Y + 2
        const isDoor = y >= 28 && x >= 37 && x <= 53
        const isDoorGlass = y >= 29 && y <= 30 && x >= 40 && x <= 50
        const isHandle = y === 27 && x >= 39 && x <= 51
        const edge = x === 33 || x === 57 ? -0.7 : 0
        const lvl = isTrim ? 1.8 : isHandle ? 4.2 : isDoorGlass ? 0.2 : isDoor ? 2.3 : 2.8
        c.set(x, y, shade(isTrim || isHandle ? CHROME : ENAMEL, Math.round(lvl + edge - vignette(x, y) * 1.2), x, y))
      }
    } else {
      c.set(x, COUNTER_Y, shade(WOOD, 3.8 + lit * 4 - vignette(x, COUNTER_Y), x, COUNTER_Y))
      c.set(x, COUNTER_Y + 1, shade(WOOD, 2.2 + lit * 2, x, COUNTER_Y + 1))
      for (let y = COUNTER_Y + 2; y < H; y++) {
        const door = x < 33 ? (x - 1) % 16 : (x - 58) % 16
        const isGap = door === 0 || y === COUNTER_Y + 2
        const isPanel = door >= 3 && door <= 12 && y >= 27 && y <= 31
        const isPanelEdge = isPanel && (door === 3 || y === 27)
        const base = Math.round(2.6 + room(x, y) * 1.6 - vignette(x, y) * 1.4)
        c.set(x, y, shade(WALL, base - (isGap ? 1.6 : 0) - (isPanelEdge ? 0.9 : 0), x, y))
      }
    }
  }
  for (const kx of [36, 55]) {
    c.set(kx, 26, CHROME[5] ?? 0)
    c.set(kx, 27, CHROME[3] ?? 0)
  }
  for (let y = 19; y <= 22; y++) {
    for (let x = 24; x <= 27; x++) {
      const side = x === 24 ? 1.2 : x === 27 ? -0.8 : 0
      c.set(x, y, y === 19 ? shade(ENAMEL, 6.6 + side, x, y) : shade(MUG, 2.2 + side - (y === 22 ? 0.6 : 0), x, y))
    }
  }
  for (const [x, y] of [[28, 20], [29, 20], [29, 21], [28, 22]] as const) c.set(x, y, shade(MUG, 1.6, x, y))
  c.set(25, 19, ENAMEL[8] ?? 0)
  for (let x = 36; x <= 53; x++) c.set(x, 22, shade(CHROME, x === 36 || x === 53 ? 1 : 1.8, x, 22))
  for (const gx of [36, 53]) c.set(gx, 21, shade(CHROME, 2.4, gx, 21))
  for (let x = 38; x <= 51; x++) c.set(x, 21, shade(GAS, 2.2 + flicker(x) * 0.6, x, 21))
  for (const [x, side] of [[37, 0], [52, 1]] as const) {
    const n = flicker(x + side * 9)
    c.set(x, 21, shade(GAS, 1.6 + n * 0.5, x, 21))
    if (n > 0.1) c.set(x, 20, shade(GAS, 1.4 + n * 0.5, x, 20))
  }
  for (let y = 9; y <= 20; y++) {
    const span = body(y)
    if (!span) continue
    const [l, r] = span
    const n = r - l + 1
    for (let x = l; x <= r; x++) {
      const k = x - l
      const [rmp, lvl] = chrome(k, n)
      const isStripe = k === 2 || k === 3
      if (y === 20) c.set(x, y, k === 2 ? (GAS[2] ?? 0) : shade(CHROME, k === 0 || k === n - 1 ? 1 : 2, x, y))
      else if ((y === 12 || y === 18) && !isStripe) c.set(x, y, shade(CHROME, k === n - 2 ? 4 : 6, x, y))
      else if ((y === 13 || y === 19) && !isStripe) c.set(x, y, shade(CHROME, k === n - 1 ? 2 : 1.4, x, y))
      else c.set(x, y, shade(rmp, lvl + (isStripe ? (y - 15) * 0.22 : 0), x, y))
    }
  }
  for (const [y, x0] of SPOUT) {
    const l = body(y)?.[0] ?? 40
    for (let x = x0; x < l; x++) {
      const isOuter = x === x0
      const isSeam = x === l - 1 && x > x0
      c.set(x, y, isOuter ? shade(GLOW, 3.4 + (y < 12 ? 1 : 0), x, y) : isSeam ? shade(CHROME, 2.2, x, y) : shade(CHROME, x === x0 + 1 ? 6.4 : 5.4, x, y))
    }
  }
  c.set(33, 8, GLOW[5] ?? 0)
  c.set(34, 8, CHROME[6] ?? 0)
  c.set(35, 8, CHROME[3] ?? 0)
  c.sprite(50, 10, HANDLE, { '#': (x: number, y: number) => shade(BAKE, y <= 11 ? 4 : 2.6, x, y), '@': BAKE[1] ?? 0 })
  for (let x = 39; x <= 50; x++) {
    const k = x - 39
    c.set(x, 8 + dy, k === 2 ? shade(GLOW, 5.6, x, 8) : shade(CHROME, k === 0 || k === 11 ? 3 : 6.2 - k * 0.18, x, 8))
  }
  for (let y = 9 + dy; y <= 8; y++) for (let x = 40; x <= 49; x++) c.set(x, y, CHROME[0] ?? 0)
  for (let x = 40; x <= 49; x++) {
    const [rmp, lvl] = chrome(x - 40, 10)
    c.set(x, 7 + dy, shade(rmp, lvl + 0.4, x, 7))
  }
  for (let x = 42; x <= 47; x++) c.set(x, 6 + dy, shade(CHROME, x === 43 ? 7.4 : x >= 46 ? 3.4 : 5.2, x, 6))
  const rows = clamp(Math.round(level * 4), 0, 4)
  const KNOB: readonly (readonly [number, number, number])[] = [[2, 43, 46], [3, 42, 47], [4, 42, 47], [5, 43, 46]]
  for (const [y, x0, x1] of KNOB) {
    for (let x = x0; x <= x1; x++) {
      const isEdge = x === x0 || x === x1
      const isFull = 5 - y < rows
      const isSurface = isFull && 5 - y === rows - 1 && rows < 4
      let col: number
      if (isFull) {
        const lit = x <= 43 ? 2.2 : x === 44 ? 1.2 : x === 45 ? 0.5 : 0
        col = shade(COFFEE, 2 + lit + (isSurface ? 1.6 : 0) - (x === x1 ? 1.2 : 0) + (y === 2 ? 0.6 : 0), x, y)
      } else {
        col = shade(GLASS, isEdge ? (x === x0 ? 2.6 : 1) : x === 43 ? 3.2 : 1.8, x, y)
      }
      c.set(x, y + dy, col)
    }
  }
  if (rows >= 2) {
    const by = 5 - (f % 3)
    if (5 - by < rows) c.set(45, by + dy, COFFEE[6] ?? 0)
  }
  c.set(43, 3 + dy, GLASS[4] ?? 0)
  const dens = new Float32Array(W * H)
  const put = (x: number, y: number, a: number) => {
    if (x >= 0 && x < W && y >= 0 && y < H) dens[y * W + x] = Math.max(dens[y * W + x] ?? 0, a)
  }
  for (const p of [...puffs(f), ...wisps(f)]) {
    for (let y = Math.floor(p.y - p.r); y <= Math.ceil(p.y + p.r); y++) {
      for (let x = Math.floor(p.x - p.r); x <= Math.ceil(p.x + p.r); x++) {
        const d = Math.hypot(x - p.x, (y - p.y) * 1.1) / p.r
        if (d < 1) put(x, y, p.a * (1.1 - d * d))
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = dens[y * W + x] ?? 0
      const band = d > 0.72 ? 2 : d > 0.42 ? 1 : d > 0.24 ? 0 : -1
      if (band < 0) continue
      c.set(x, y, (isGlass(x, y) ? STEAM_SKY : STEAM_WALL)[band] ?? 0)
    }
  }
}
export const scene: Scene = { verb: 'Percolating', render: () => frames(LOOP, draw), hero: 31 }