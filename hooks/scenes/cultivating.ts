import { TAU, Canvas, beat, ease, frames, hash, hex, lerp, mod, particles, shade, threshold, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const SKY = hex('59609a 74709f 9581a8 bb93a6 dca79c f0bd8e f8d49a fde6b8')
const SUN = hex('fbe7b8 fff3d6 fffcf0')
const HAZE = hex('8b7c9f a48ca4 bb9ba6 d2ada6')
const HILL = hex('4e4468 5f4f70 745c76 8b6a7c a07a80')
const TREE = hex('251e30 33283a 463542 5f4648 8a6a4c c49a58')
const STUBBLE = hex('4a3442 6c4a40 94673e b8873e d4a650 e8c46c f5dc98')
const SOIL = hex('1c1020 2b1620 3e2020 552c22 6f3e28 8c5432 b47442')
const RED = hex('2c0b14 4f1219 7c1d1e a82a22 d0402a ec6638 f79a5e fcc68e')
const IRON = hex('120e16 1e1a24 2f2934 453c48 625561 8a7a80 c4b0a0 f0e2c8')
const CREAM = hex('5e4a44 8e7662 c2a98a e9d6b0 fbf0d6')
const DENIM = hex('1e2440 2e3a62 44598a 6a82b0')
const SKIN = hex('6e3a2a a8644a d89a6e')
const STRAW = hex('8a5a24 c8963c f0cc6c fbe8a0')
const GULL = hex('231e2a 4e4a60 8a86a0 c8c2cc f0e8e4 fffaf0')
const SMOKE = hex('3e3646 524858 6c6070 8a7c88 a89aa0')
const WORM = hex('a0485a d8788a')

const SUN_X = 9
const SUN_Y = 8
const HORIZON = 15
const STRIP = 21
const GROUND = 27
const AXLE = 37
const PLOUGH = 24

const isClod = (w: number) => hash(mod(w, LOOP), 5) > 0.84
const isLifted = (w: number) => isClod(w) || isClod(w - 1)
function bobOf(f: number): number {
  const w = Math.round(AXLE + f)
  return isLifted(w) || (isLifted(w - 1) && isLifted(w + 1)) ? -1 : 0
}

type Gull = { x: number; y: number; flap: number; isDown: boolean; peck: number; tug: number }
const HOMES = [
  { x: 15, y: 12, ax: 5, ay: 2.5, ph: 0, rate: 7 },
  { x: 24, y: 6, ax: 4, ay: 2, ph: 0.35, rate: 6 },
  { x: 4, y: 16, ax: 3, ay: 2, ph: 0.7, rate: 8 },
]
const DIVE = 36
const LAND = 46
const LIFT = 62
const BACK = 78
const LAND_X = 22
const LAND_Y = GROUND - 2

const STROKE = [0, 1, 2, 1]

function flight(i: number, f: number): [number, number] {
  const h = HOMES[i] ?? HOMES[0] ?? { x: 0, y: 0, ax: 0, ay: 0, ph: 0, rate: 6 }
  return [h.x + h.ax * wave(f, LOOP, 2, h.ph) + 2 * wave(f, LOOP, 3, h.ph * 2), h.y + h.ay * wave(f, LOOP, 3, h.ph + 0.25)]
}

function gullAt(i: number, f: number): Gull {
  const h = HOMES[i] ?? { ph: 0, rate: 6 }
  const [fx, fy] = flight(i, f)
  const glide = wave(f, LOOP, 2, h.ph + 0.1) > 0.5
  const flap = glide ? 1 : STROKE[Math.floor(mod(f + i * 3, h.rate) / (h.rate / 4))] ?? 1
  const flying = { x: fx, y: fy, flap, isDown: false, peck: 0, tug: 0 }
  if (i !== 0 || f < DIVE || f >= BACK) return flying
  if (f < LAND) {
    const [sx, sy] = flight(0, DIVE)
    const t = ease.in(beat(f, DIVE, LAND))
    return { ...flying, x: lerp(sx, LAND_X, t), y: lerp(sy, LAND_Y, t) - Math.sin(t * Math.PI) * 2, flap: t < 0.15 ? 0 : 3 }
  }
  const gx = LAND_X - (Math.min(f, LIFT) - LAND)
  if (f < LIFT) {
    const peck = f < 54 && mod(f, 4) < 2 ? 1 : 0
    const tug = f < 54 ? 0 : f < 61 ? Math.min(3, Math.floor((f - 53) / 2)) : 0
    return { ...flying, x: gx, y: LAND_Y, isDown: true, peck, tug }
  }
  const t = ease.inOut(beat(f, LIFT, BACK))
  return { ...flying, x: lerp(gx, fx, t), y: lerp(LAND_Y, fy, t) - Math.sin(t * Math.PI) * 3 }
}

const GULL_ART: readonly (readonly string[])[] = [
  ['k.......k', '.w.....w.', '..wbbbh..'],
  ['.........', 'kwwbbbhwk', '.........'],
  ['..wbbbh..', '.w.....w.', 'k.......k'],
  ['...bbbh..', '..kwww...', '.........'],
]
const STANDING = ['...hhy', 'kwwbb.', '..l.l.']
const PECKING = ['......', 'kwwbbh', '..l.ly']

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    sky(c)
    field(c, f)
    const body = tractorPixels(f)
    for (const i of body.keys()) {
      const x = i % W
      const y = Math.floor(i / W)
      const h = GROUND - y
      for (const k of [0, 0.35, 0.7]) {
        const sx = Math.round(x + (h + k) * 1.25)
        const sy = Math.round(GROUND + (h + k) * 0.3)
        if (sx < W && sy < H && sy >= STRIP) c.set(sx, sy, groundAt(sx, sy, f, 1.6))
      }
    }
    for (const [i, color] of body) {
      const isRim = !body.has(i - 1) || !body.has(i - W - 1)
      c.set(i % W, Math.floor(i / W), isRim ? brighter(color) : color)
    }
    smoke(c, f)
    gulls(c, f)
    foreground(c, f)
  })
}

function sky(c: Canvas): void {
  for (let y = 0; y <= HORIZON; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - SUN_X, (y - SUN_Y) * 1.3)
      const glow = Math.max(0, 1 - d / 26) ** 1.6 * 2.2
      const streak = Math.abs(y - 6.5 - (x - SUN_X) * 0.05) < 0.6 && x < 30 ? (d < 9 ? 1.4 : -0.5) : 0
      const high = y === 3 && x > 33 && x < 55 ? -0.7 : y === 4 && x > 38 && x < 50 ? 0.5 : 0
      c.set(x, y, shade(SKY, (y / HORIZON) * 6.4 + glow + streak + high))
      if (d < 2.7) c.set(x, y, shade(SUN, 2.1 - d * 0.6))
    }
  }
  for (let x = 0; x < W; x++) {
    const far = 11.5 - 2.2 * Math.sin(x * 0.09 + 0.5) - Math.sin(x * 0.23 + 2)
    const near = 13.5 - 1.6 * Math.sin(x * 0.07 + 2.6) - 0.8 * Math.sin(x * 0.19)
    for (let y = Math.floor(far); y <= HORIZON; y++) {
      const lit = Math.max(0, 1 - Math.hypot(x - SUN_X, y - SUN_Y) / 30)
      c.set(x, y, shade(HAZE, 1.2 + lit * 2.4 + (y < far + 1 ? 0.6 : 0)))
    }
    for (let y = Math.floor(near); y <= HORIZON; y++) {
      const lit = Math.max(0, 1 - Math.hypot(x - SUN_X, y - SUN_Y) / 34)
      c.set(x, y, shade(HILL, 1 + lit * 3 + (y < near + 1 ? 0.8 : 0)))
    }
  }
}

function groundAt(x: number, y: number, f: number, dim = 0): number {
  const wx = mod(x + f, LOOP)
  const lit = Math.max(0, 1 - Math.abs(x - SUN_X) / 80)
  const row = Math.floor((y - STRIP) / 3)
  if (y < 30 && x < PLOUGH + 1 - row * 2) {
    const k = (y - STRIP) % 3
    const clod = hash(Math.floor(wx / 2), row, 3)
    const bump = k === 0 && clod > 0.62 ? 1 : k === 1 && clod > 0.62 ? 0.6 : 0
    return shade(SOIL, (k === 0 ? 4.4 : k === 1 ? 3 : 1.4) + lit * 1.4 + bump + (y > 26 ? 0.3 : 0) - dim)
  }
  const rows = (y - STRIP) % 3 === 0 ? 0.7 : (y - STRIP) % 3 === 2 ? -0.5 : 0
  const stalk = hash(Math.floor(wx / 3), Math.floor((y - STRIP) / 3), 9) > 0.72 && (y - STRIP) % 3 === 1 ? 0.9 : 0
  return shade(STUBBLE, 2.7 + lit * 1.4 + rows + stalk - (y > 29 ? 0.7 : 0) - dim)
}

function field(c: Canvas, f: number): void {
  for (let x = 0; x < W; x++) {
    const wx = mod(x + f * 0.5, 48)
    for (let y = HORIZON; y <= 17; y++) c.set(x, y, shade(TREE, 1.8 + (y === HORIZON ? 0.9 : 0) - (y === 17 ? 0.6 : 0)))
    for (const [tx, ty, rx, ry] of [[10, 11.5, 3.6, 3.4], [33, 13.5, 2.4, 2]] as const) {
      const dx = wx - tx
      for (let y = Math.floor(ty - ry); y <= HORIZON; y++) {
        const dy = y - ty
        const r = (dx / rx) ** 2 + (dy / ry) ** 2
        if (r > 1 && !(y > ty && Math.abs(dx) < 0.6)) continue
        const lit = (-dx / rx) * 0.8 - (dy / ry) * 0.5
        c.set(x, y, shade(TREE, 2.5 + lit * 1.1 + (r > 0.55 && dx < -0.5 && dy < 1 ? 1.3 : 0)))
      }
    }
  }
  for (let y = 18; y < STRIP; y++) {
    for (let x = 0; x < W; x++) {
      const lit = Math.max(0, 1 - Math.abs(x - SUN_X) / 70)
      if (y === 19) c.set(x, y, shade(SOIL, 3.4 + lit * 1.4))
      else c.set(x, y, shade(STUBBLE, 3 + lit * 1.8 + (y === 18 ? 0.6 : 0)))
    }
  }
  for (let y = STRIP; y < H; y++) for (let x = 0; x < W; x++) c.set(x, y, groundAt(x, y, f))
  for (const p of particles(f, LOOP, 40, 6, 21)) {
    const x = PLOUGH - 1 - p.t * 1.1 - p.r[1] * 1.5
    const y = GROUND - 3 + p.r[2] * 3 - Math.sin(p.age * Math.PI) * (1.5 + p.r[3] * 2)
    c.set(x, y, shade(SOIL, 3 + (1 - p.age) * 2.5))
  }
}

type Put = (x: number, y: number, color: number) => void

function brighter(color: number): number {
  for (const r of [RED, IRON, CREAM, DENIM, SKIN, STRAW]) {
    const i = r.indexOf(color)
    if (i >= 0) return r[Math.min(r.length - 1, i + 1)] ?? color
  }
  return color
}

function tractorPixels(f: number): Map<number, number> {
  const px = new Map<number, number>()
  const put: Put = (x, y, color) => {
    const ix = Math.round(x)
    const iy = Math.round(y)
    if (ix >= 0 && ix < W && iy >= 0 && iy < H) px.set(iy * W + ix, color)
  }
  const b = bobOf(f)
  const G = GROUND
  const A = AXLE

  for (let x = PLOUGH; x <= A - 5; x++) put(x, G - 6 + b + (x < A - 9 ? 1 : 0), shade(IRON, x === A - 9 ? 4 : 3.2))
  for (const bx of [PLOUGH, PLOUGH + 5]) {
    put(bx + 1, G - 4, shade(IRON, 2.4))
    put(bx + 1, G - 3, shade(IRON, 2.4))
    put(bx, G - 4, shade(IRON, 6.6))
    put(bx - 1, G - 3, shade(IRON, 7))
    put(bx, G - 3, shade(IRON, 5))
    put(bx - 1, G - 2, shade(IRON, 4.6))
    put(bx, G - 2, shade(IRON, 3.4))
  }
  for (let x = A - 6; x <= A - 4; x++) put(x, G - 5 + b, shade(IRON, 2))

  wheel(put, A, G - 5.6, 5.8, 14, (f / LOOP) * 28 * (TAU / 14), 3.2)
  wheel(put, A + 16, G - 3.1, 3.2, 8, (f / LOOP) * 30 * (TAU / 8), 1.8)

  for (let y = G - 6; y <= G - 4; y++) for (let x = A + 6; x <= A + 13; x++) put(x, y + b, shade(IRON, 1.6 + (y === G - 6 ? 0.8 : 0) + (x % 3 === 0 ? 0.5 : 0)))
  for (let y = G - 6; y <= G - 4; y++) put(A + 16, y + b, shade(IRON, 2.4))
  for (let y = G - 11; y <= G - 7; y++) {
    for (let x = A + 4; x <= A + 19; x++) {
      const row = y - (G - 11)
      if (row === 0 && (x === A + 4 || x >= A + 18)) continue
      if (x === A + 19 && (row === 0 || row === 4)) continue
      if (x >= A + 18) {
        put(x, y + b, shade(IRON, x === A + 19 ? 1.2 + (row % 2) * 1.6 : 1))
        continue
      }
      const top = row === 0 ? 2.6 : row === 1 ? 1.2 : row === 4 ? -1.3 : 0
      if (row === 2 && x > A + 5 && x < A + 17) {
        put(x, y + b, shade(CREAM, 3.2 - (x - A) * 0.07))
        continue
      }
      put(x, y + b, shade(RED, 3.7 + top - (x - A - 4) * 0.06))
    }
  }
  for (let y = G - 14; y <= G - 6; y++) {
    for (let x = A - 8; x <= A + 6; x++) {
      const dx = x - A
      const dy = y - (G - 5.6)
      const d = Math.hypot(dx, dy)
      const a = Math.atan2(dy, dx)
      if (d < 6.4 || d > 7.8 || a > -0.35 || a < -Math.PI + 0.3) continue
      const lit = -Math.sin(a) * 1.2 - Math.cos(a) * 0.8 + (d > 7.2 ? 0.9 : -0.4)
      put(x, y + b, shade(RED, 3.2 + lit))
    }
  }
  const puff = mod(f, 8) < 2
  for (let y = G - 15; y <= G - 12; y++) put(A + 14, y + b, shade(IRON, y === G - 15 ? 3 : 1.8))
  put(A + 13, G - 16 + b + (puff ? -1 : 0), shade(IRON, 4))
  put(A + 14, G - 16 + b, shade(IRON, 3.4))
  put(A + 5, G - 12 + b, shade(IRON, 2.5))
  put(A + 4, G - 13 + b, shade(IRON, 2.5))
  for (let x = A + 2; x <= A + 5; x++) put(x, G - 14 + b, shade(IRON, x === A + 2 ? 5 : 2.6))
  for (let y = G - 17; y <= G - 13; y++) {
    put(A - 2, y + b, shade(DENIM, 2.6 + (y === G - 17 ? 0.6 : 0)))
    put(A - 1, y + b, shade(DENIM, 1.8))
    put(A, y + b, shade(DENIM, 1.2))
  }
  put(A + 1, G - 15 + b, shade(DENIM, 1.8))
  put(A + 2, G - 15 + b, shade(SKIN, 1.6))
  put(A - 2, G - 18 + b, shade(SKIN, 2.2))
  put(A - 1, G - 18 + b, shade(SKIN, 1.4))
  put(A, G - 18 + b, shade(SKIN, 0.6))
  for (let x = A - 4; x <= A + 2; x++) put(x, G - 19 + b, shade(STRAW, x <= A - 3 ? 2.6 : x === A + 2 ? 0.6 : 1.4))
  for (let x = A - 2; x <= A; x++) put(x, G - 20 + b, shade(STRAW, x === A - 2 ? 3 : 1.8))
  put(A - 1, G - 21 + b, shade(STRAW, 2.2))

  return px
}

function wheel(put: Put, cx: number, cy: number, r: number, lugs: number, turn: number, rim: number): void {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx
      const dy = y - cy
      const d = Math.hypot(dx, dy)
      if (d > r) continue
      const a = Math.atan2(dy, dx)
      const lug = mod(((a + turn) * lugs) / TAU, 1) < 0.5
      if (d > r - 0.55 && !lug) continue
      const lit = (-dx / Math.max(1, d)) * 0.9 - (dy / Math.max(1, d)) * 0.4
      if (d > rim) {
        const tread = d > r - 1.5 ? (lug ? 0.9 : 0) : d < rim + 0.8 ? -0.5 : 0
        put(x, y, shade(IRON, 1.6 + lit * 1.2 + tread))
        continue
      }
      if (d < 1) {
        put(x, y, shade(IRON, 3.5 + lit))
        continue
      }
      const bolt = d > rim - 1.6 && d < rim - 0.5 && mod(((a + turn) * 5) / TAU, 1) < 0.2
      put(x, y, shade(CREAM, 2.1 + lit * 1.3 - (bolt ? 1.4 : 0) - (d > rim - 0.6 ? 0.8 : 0)))
    }
  }
}

function smoke(c: Canvas, f: number): void {
  for (let born = Math.floor((f - 24) / 8) * 8; born <= f; born += 8) {
    const t = f - born
    if (t < 0 || t >= 22) continue
    const age = t / 22
    const r = 0.9 + age * 2.6
    const x = AXLE + 13.5 - t * 1.05 + Math.sin(born) * 0.3
    const y = GROUND - 18 - t * 0.45
    const alpha = (1 - age) * 1.2
    for (let yy = Math.floor(y - r); yy <= Math.ceil(y + r); yy++) {
      for (let xx = Math.floor(x - r); xx <= Math.ceil(x + r); xx++) {
        const d = Math.hypot(xx - x, (yy - y) * 1.2) / r
        const density = alpha * (1.1 - d * d)
        if (d > 1 || density < 0.3 || (density < 0.6 && threshold(xx, yy) > 0.5)) continue
        const warm = xx < x && yy < y + 0.5 ? 1.4 : 0
        c.set(xx, yy, shade(SMOKE, 0.8 + density * 1.8 + warm))
      }
    }
  }
}

function gulls(c: Canvas, f: number): void {
  const palette = { k: GULL[0] ?? 0, w: GULL[2] ?? 0, b: GULL[5] ?? 0, h: GULL[4] ?? 0, y: 0xf0b040, l: 0xd88a4a }
  for (let i = HOMES.length - 1; i >= 0; i--) {
    const g = gullAt(i, f)
    if (g.isDown) {
      const x0 = Math.round(g.x) - 3
      const y0 = Math.round(g.y) - 2
      c.sprite(x0, y0, g.peck ? PECKING : STANDING, palette)
      if (g.tug > 0) for (let k = 0; k <= g.tug; k++) c.set(x0 + 5, y0 + 1 + k, shade(WORM, k === 0 ? 1 : 0))
      continue
    }
    const x0 = Math.round(g.x) - 4
    const y0 = Math.round(g.y) - 1
    c.sprite(x0, y0, GULL_ART[g.flap] ?? GULL_ART[1] ?? [], palette)
    if (i === 0 && f >= LIFT && f < LIFT + 9) {
      c.set(x0 + 7, y0 + 3, shade(WORM, 1))
      c.set(x0 + 7, y0 + 4, shade(WORM, 0))
    }
  }
}

function foreground(c: Canvas, f: number): void {
  const tufts: readonly (readonly [number, number])[] = [[10, 6], [58, 4], [95, 7], [128, 5]]
  for (const [gx, h] of tufts) {
    const x0 = Math.round(mod(gx - f * 1.5, 144))
    if (x0 > W + 3) continue
    for (const [dx, hh, lean] of [[0, h, 1], [-2, h - 2, -1]] as const) {
      for (let k = 0; k < hh; k++) {
        const x = x0 + dx + (k > hh * 0.55 ? lean : 0)
        c.set(x, H - 1 - k, shade(STUBBLE, k >= hh - 1 ? 6 : k >= hh - 2 ? 5 : 1.4 + k * 0.5))
      }
    }
  }
}

export const scene: Scene = { verb: 'Cultivating', render, hero: 58 }
