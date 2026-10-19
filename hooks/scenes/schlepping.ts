import { clamp, frames, hex, mod, noise, shade, type Canvas, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72
const TRAVEL = 36
const STRIDE = 24

const SKY = hex('3c2c58 54386a 74466e 9a5670 c06c6c dc8a6a eeac72 f6cc86 fbe4a8')
const HILLS = hex('4a3460 5a3e68 6c4a6e 7e566e')
const ROAD = hex('2e1c1a 4a2c22 6a4028 8c5a32 ae7a40 cc9a54 e4ba6c f2d48a')
const GRASS = hex('1e1a16 2c2618 3e3418 54461c 6c5a22 88722c a88c3a')
const COAT = hex('120e14 1e1820 2c2428 3e3436 524646 6a5c58 847268 a08a7a bea490 dcc0a4')
const PALE = hex('5a4c4c 7e6e68 a49284 c8b6a2 e6d6c0')
const WOOD = hex('1a0f10 2b1a16 40261c 5a3622 784a2a 98602f b67a3c d09a52')
const TICK = hex('1c2236 2e3a56 4a5a7a 7488a6 a8b8cc d8e0e8')
const RUG = hex('2a0a12 4e1018 7a1a1e a6281f cf4229 ee6a3a')
const GOLD = hex('4e300c 7a4c10 a8701a d1982a eec24a fae58a')
const CHAIR = hex('10201c 1a342a 284a3a 386250 4e7c62')
const SACKR = hex('3a2418 5c3a22 86582e ae7c3e d2a35a ecc87e')
const FERN = hex('0e1f12 173322 1f4a2a 2d6630 46852f 6aa337 98c24a')
const TERRA = hex('3a140c 5e2412 86381a ae5226 cc7036')
const IRON = hex('0a090e 15141a 222028 34313c 4c4856 6c6676 9890a0')
const COPPER = hex('2a0f0c 4a1d14 6f2e1a 96441f bd5e2a db8040 eda766 f7cf98')

const SLOPE = 0.16
const groundY = (x: number) => 26.5 - (x - 32) * SLOPE
const COS = Math.cos(Math.atan(SLOPE))
const SIN = Math.sin(Math.atan(SLOPE))

const scroll = (f: number) => (f / LOOP) * TRAVEL

const stoneX = (f: number, k: number) => mod(3 - scroll(f), TRAVEL) + k * TRAVEL
const WHEEL = { x: 23, r: 4.5 }
const DROP = 32

function lift(f: number): number {
  const d = stoneX(f, 0) - WHEEL.x
  if (d > 3 || d <= -2) return 0
  if (d >= 0.5) return Math.round(2 * Math.sin(((3 - d) / 2.5) * (Math.PI / 2)))
  return d > -0.25 ? 1 : d > -0.75 ? 0 : -1
}

function sway(t: number): number {
  const since = mod(t - DROP, LOOP)
  const ease = clamp(since / 4)
  const kick = Math.exp(-since / 12) * Math.sin(since * 0.4) * 1.25 * ease * ease * (3 - 2 * ease)
  return kick + Math.sin((t / STRIDE) * Math.PI * 4) * 0.17
}

const LEAN = Array.from({ length: 6 }, (_, i) => {
  const xs = Array.from({ length: LOOP }, (_, f) => Math.round(sway(f - i * 2.2) * (i / 5) ** 1.15 * 4.4) - Math.round(i * 0.45))
  for (let pass = 0; pass < 4; pass++) {
    for (let f = 0; f < LOOP; f++) {
      const prev = xs[mod(f - 1, LOOP)] ?? 0
      if (prev === xs[mod(f + 1, LOOP)] && xs[f] !== prev) xs[f] = prev
    }
  }
  return xs
})

type Part = 'coat' | 'dark' | 'belly' | 'muzzle' | 'eye' | 'ear' | 'collar' | 'brass'
function donkeyPart(lx: number, ly: number, flinch: number, ear: number, swish: number): Part | undefined {
  const hx = 11.9 - flinch * 0.3
  const hy = -1.2 - flinch * 1.2
  const tilt = 0.9 - flinch * 0.35
  const ax = Math.cos(tilt)
  const ay = Math.sin(tilt)
  const du = (lx - hx) * ax + (ly - hy) * ay
  const dv = -(lx - hx) * ay + (ly - hy) * ax
  if (Math.abs(lx - (hx - 0.5)) < 0.5 && Math.abs(ly - (hy - 1)) < 0.5) return 'eye'
  if ((du / 2.9) ** 2 + (dv / 1.6) ** 2 <= 1) return du > 1.5 ? (du > 2.3 && dv > 0.3 ? 'dark' : 'muzzle') : 'coat'
  for (const [ex, ey, isNear] of [[hx - 2.2, hy - 2.1, true], [hx - 1.5, hy - 2.4, false]] as const) {
    const a = 2.3 - ear * (isNear ? 1 : 0.85) - (isNear ? 0 : 0.3)
    const len = 4.6
    const vx = Math.cos(a) * len
    const vy = -Math.sin(a) * len
    const p = clamp(((lx - ex) * vx + (ly - ey) * vy) / (len * len))
    const d = Math.hypot(lx - (ex + vx * p), ly - (ey + vy * p))
    if (d < 0.5 + Math.sin(Math.min(1, p * 1.3) * Math.PI) * 0.55) return p > 0.8 ? 'dark' : isNear ? 'ear' : 'dark'
  }
  const n = clamp((lx - 3.6) / (hx - 1.5 - 3.6))
  if (lx >= 3.6 && lx <= hx - 0.6) {
    const top = -3 + n * (hy - 1.6 + 3)
    const bottom = 1.8 + n * (hy + 1 - 1.8)
    if (ly >= top && ly <= bottom) {
      if (Math.abs(lx - 6.2) < 0.7) return ly < top + 1.2 ? 'brass' : 'collar'
      return ly < top + 0.9 ? 'dark' : 'coat'
    }
  }
  if ((lx / 7) ** 2 + (ly / 3.2) ** 2 <= 1 || ((lx + 4.8) / 3) ** 2 + ((ly + 0.5) / 3.2) ** 2 <= 1 || ((lx - 4.4) / 2.8) ** 2 + ((ly + 0.2) / 3) ** 2 <= 1) {
    if (Math.abs(ly + 2.6) < 0.5 && lx > -5 && lx < 3) return 'dark'
    return ly > 1.8 ? 'belly' : 'coat'
  }
  const tp = clamp((ly + 1.5) / 5.5)
  const tx = -7.6 - tp * 0.8 + Math.sin(swish + tp * 2) * tp * 1.2
  if (ly >= -1.5 && ly <= 4 && Math.abs(lx - tx) < 0.6) return tp > 0.6 ? 'dark' : 'coat'
  return undefined
}
type Leg = { jx: number; isFore: boolean; isNear: boolean; phase: number }
const LEGS: Leg[] = [
  { jx: -5.2, isFore: false, isNear: false, phase: 0.5 },
  { jx: 3.6, isFore: true, isNear: false, phase: 0.75 },
  { jx: -4.4, isFore: false, isNear: true, phase: 0 },
  { jx: 4.6, isFore: true, isNear: true, phase: 0.25 },
]
const DONKEY = { x: 46, lift: 8.3 }
const SHOULDER_Y = 2.4

function hoof(f: number, leg: Leg, cx: number): { x: number; y: number; planted: number } {
  const p = mod(f / STRIDE + leg.phase, 1)
  const reach = (TRAVEL / LOOP) * STRIDE * 0.72
  const base = cx + leg.jx * COS + 0.6
  if (p < 0.72) {
    const x = base + reach / 2 - (p / 0.72) * reach
    return { x, y: groundY(x), planted: p * STRIDE }
  }
  const s = (p - 0.72) / 0.28
  const x = base - reach / 2 + (s * s * (3 - 2 * s)) * reach
  return { x, y: groundY(x) - Math.sin(s * Math.PI) * 2, planted: -1 }
}
function drawLeg(c: Canvas, f: number, leg: Leg, cx: number, cy: number): void {
  const jx = cx + leg.jx * COS + SHOULDER_Y * SIN
  const jy = cy - leg.jx * SIN + SHOULDER_Y * COS
  const h = hoof(f, leg, cx)
  const bend = h.planted < 0 ? (leg.isFore ? 1.2 : -1.2) : 0
  const kx = (jx + h.x) / 2 + bend
  const ky = (jy + h.y) / 2
  const level = leg.isNear ? 3.4 : 1.8
  for (const [ax, ay, bx, by] of [[jx, jy, kx, ky], [kx, ky, h.x, h.y - 1]] as const) {
    c.line(ax, ay, bx, by, (x, y) => shade(COAT, level + (x > (ax + bx) / 2 ? 0.8 : 0), x, y))
    c.line(ax - 1, ay, bx - 1, by, (x, y) => shade(COAT, level - 0.8, x, y))
  }
  c.set(h.x, h.y - 1, shade(COAT, leg.isNear ? 1 : 0.4, 0, 0))
  c.set(h.x - 1, h.y - 1, shade(COAT, leg.isNear ? 1 : 0.4, 0, 0))
}

function block(c: Canvas, x0: number, y0: number, w: number, h: number, ramp: readonly number[], base: number, stripe?: (i: number, j: number) => number): void {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const rim = i === w - 1 ? 1.4 : i === 0 ? -0.8 : 0
      const top = j === 0 ? 0.8 : j === h - 1 ? -0.6 : 0
      c.set(x0 + i, y0 + j, shade(ramp, base + rim + top + (stripe ? stripe(i, j) : 0), x0 + i, y0 + j))
    }
  }
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const s = scroll(f)

    c.fill((x, y) => {
      const d = Math.hypot(x - 44, (y - 8) * 1.1)
      if (d < 3.6) return 0xfff3cc
      if (d < 5) return 0xfde2a4
      const glow = d < 9 ? 1 : d < 14 ? 0.5 : 0
      const ridge = 15.5 + noise(x * 0.09, 0, 0, 2) * 5 - Math.max(0, x - 40) * 0.12
      if (y > ridge) return shade(HILLS, 1.4 + (y - ridge) * -0.1 + (x > 36 ? 1.2 : 0), x, y)
      return shade(SKY, 1 + y * 0.42 + glow, x, y)
    })
    for (let x = 0; x < W; x++) {
      const gy = Math.round(groundY(x))
      const wx = mod(x + s, TRAVEL)
      const tuft = wx > 6 && wx < 9 ? 1 : wx > 22 && wx < 24 ? 1 : 0
      for (let y = gy - 2 - tuft; y < H; y++) {
        const depth = y - gy
        if (depth < 0) c.set(x, y, shade(GRASS, 3.4 + (depth === -1 ? 0.8 : 0) + tuft * 0.8, x, y))
        else if (depth < 3) c.set(x, y, shade(ROAD, [5.2, 4.4, 3.6][depth] ?? 3, x, y))
        else c.set(x, y, shade(GRASS, depth < 5 ? 3 : depth < 8 ? 2.2 : 1.4, x, y))
      }
    }
    for (let k = -1; k < 4; k++) {
      const x = Math.round(mod(10 - s, 18) + k * 18)
      const top = Math.round(groundY(x)) - 9
      for (let y = top; y < top + 6; y++) c.set(x, y, shade(WOOD, y === top ? 4 : 2.6, x, y))
    }
    for (let x = 0; x < W; x++) c.set(x, Math.round(groundY(x)) - 7, shade(WOOD, 2.2, x, 0))
    for (const k of [0, 1]) {
      const x = Math.round(stoneX(f, k))
      const y = Math.round(groundY(x))
      c.set(x, y - 1, shade(PALE, 3.4, x, y))
      c.set(x + 1, y - 1, shade(PALE, 4, x, y))
      c.set(x - 1, y, shade(PALE, 1.4, x, y))
      c.set(x, y, shade(PALE, 2, x, y))
      c.set(x + 1, y, shade(PALE, 2.6, x, y))
      c.set(x - 2, y + 1, shade(ROAD, 2.6, x, y))
      c.set(x - 1, y + 1, shade(ROAD, 2.6, x, y))
    }

    for (let x = 7; x < 44; x++) {
      const y = Math.round(groundY(x)) + 1
      c.set(x, y, shade(ROAD, 2.6, x, y))
    }

    const since = mod(f - DROP, LOOP)
    const flinch = since < 2 ? 0 : since < 5 ? 1 : since < 14 ? 1 - (since - 5) / 9 : 0
    const bob = Math.round(0.5 + 0.5 * Math.sin((f / STRIDE) * Math.PI * 4))
    const cx = DONKEY.x
    const cy = groundY(cx) - DONKEY.lift + bob
    const ear = Math.sin((f / STRIDE) * Math.PI * 4 + 1) * 0.12 - flinch * 0.9 + (since > 8 && since < 20 ? 0.35 : 0)
    const swish = Math.sin((f / LOOP) * Math.PI * 6) * 1.2
    for (const leg of LEGS.filter(l => !l.isNear)) drawLeg(c, f, leg, cx, cy)
    const parts = new Map<number, Part>()
    for (let y = 0; y < H; y++) {
      for (let x = 30; x < W; x++) {
        const rx = x - cx
        const ry = y - cy
        const part = donkeyPart(rx * COS - ry * SIN, rx * SIN + ry * COS, flinch, ear, swish)
        if (part) parts.set(y * W + x, part)
      }
    }
    for (const [key, part] of parts) {
      const x = key % W
      const y = Math.floor(key / W)
      const isRim = !parts.has(key - W + 1) || !parts.has(key + 1)
      const isUnder = !parts.has(key + W) || !parts.has(key - 1)
      const lit = (isRim ? 2 : 0) - (isUnder && !isRim ? 0.8 : 0)
      if (part === 'eye') c.set(x, y, COAT[0] ?? 0)
      else if (part === 'dark') c.set(x, y, shade(COAT, 1.4 + lit * 0.5, x, y))
      else if (part === 'belly' || part === 'muzzle') c.set(x, y, shade(PALE, 2.4 + lit * 0.8, x, y))
      else if (part === 'ear') c.set(x, y, shade(COAT, 5 + lit, x, y))
      else if (part === 'collar') c.set(x, y, shade(WOOD, 3 + lit * 0.6, x, y))
      else if (part === 'brass') c.set(x, y, shade(GOLD, 3 + lit * 0.8, x, y))
      else c.set(x, y, shade(COAT, 5 + lit, x, y))
    }
    for (const leg of LEGS.filter(l => l.isNear)) drawLeg(c, f, leg, cx, cy)

    for (const leg of LEGS) {
      const h = hoof(f, leg, cx)
      if (h.planted < 0 || h.planted > 5) continue
      const a = h.planted
      const x = Math.round(h.x - 1 - a * 0.6)
      const y = Math.round(h.y - 1 - a * 0.3)
      c.set(x, y, shade(ROAD, 6.6 - a * 0.6, x, y))
      if (a < 3) c.set(x - 1, y + 1, shade(ROAD, 6 - a * 0.6, x, y))
    }
    if (since >= 3 && since < 9) {
      const x = Math.round(cx + 9 + (since - 3) * 0.7)
      const y = Math.round(cy - 6 - (since - 3) * 1.4 + (since - 3) ** 2 * 0.45)
      c.set(x, y, 0xcfe8f4)
    }

    const up = lift(f)
    const bed = (x: number) => Math.round(groundY(x) - 7.6 - up + (x - WHEEL.x) * 0)
    const collarX = cx + 6.4 * COS
    const collarY = cy - 6.4 * SIN + 1
    c.line(35, bed(35) + 1, collarX, collarY, (x, y) => shade(WOOD, 4.6, x, y))
    c.line(35, bed(35) + 2, collarX - 1, collarY + 1, (x, y) => shade(WOOD, 2.4, x, y))
    for (let x = 9; x <= 36; x++) {
      const y0 = bed(x)
      for (let j = 0; j < 3; j++) c.set(x, y0 + j, shade(WOOD, (j === 0 ? 5 : j === 2 ? 2 : 3.4) + (x === 36 ? 1 : 0) - (x === 9 ? 1 : 0) + ((x - 9) % 9 === 0 && j > 0 ? -1 : 0), x, y0 + j))
    }
    const wy = groundY(WHEEL.x) - WHEEL.r - up
    const turn = (f / LOOP) * 8 * ((Math.PI * 2) / 6)
    for (let y = Math.floor(wy - 5); y <= Math.ceil(wy + 5); y++) {
      for (let x = WHEEL.x - 5; x <= WHEEL.x + 5; x++) {
        const d = Math.hypot(x - WHEEL.x, y - wy)
        const a = Math.atan2(y - wy, x - WHEEL.x) + turn
        const isTyre = d <= WHEEL.r + 0.5 && d > WHEEL.r - 0.7
        const isSpoke = d < WHEEL.r - 0.5 && Math.abs(Math.sin((a * 6) / 2)) < 0.28 / Math.max(0.6, d * 0.4)
        const isHub = d < 1.2
        if (isTyre) c.set(x, y, shade(IRON, 2.6 + (x > WHEEL.x && y < wy ? 2 : 0) - (x < WHEEL.x ? 0.8 : 0), x, y))
        else if (isHub) c.set(x, y, shade(WOOD, 5, x, y))
        else if (isSpoke) c.set(x, y, shade(WOOD, 3.8 + (x > WHEEL.x ? 1 : 0), x, y))
      }
    }

    const lean = (i: number) => LEAN[i]?.[f] ?? 0
    const base = bed(22)
    block(c, 10, base - 3, 26, 3, TICK, 2.6, i => (mod(i, 5) < 2 ? -1.2 : 0))
    c.set(9, base - 1, shade(TICK, 1.4, 9, 0))
    const l1 = lean(1)
    block(c, 12 + l1, base - 8, 10, 5, WOOD, 4.2, (i, j) => (j === 2 ? -1.4 : 0) + (i === 0 || i === 9 ? -0.4 : 0))
    c.poly([[22.5 + l1, base - 3], [23 + l1, base - 7.5], [26 + l1, base - 9], [30 + l1, base - 8], [31.5 + l1, base - 3]], (x, y) => shade(SACKR, 3 + (x > 28 + l1 ? 1.2 : 0) - (y > base - 5 ? 0.6 : 0), x, y))
    c.set(26 + l1, base - 10, shade(SACKR, 2, 0, 0))
    c.set(27 + l1, base - 10, shade(SACKR, 3, 0, 0))
    const l2 = lean(2)
    block(c, 7 + l2, base - 11, 28, 2, RUG, 3, i => (mod(i, 7) < 2 ? 1.4 : 0))
    c.set(35 + l2, base - 11, shade(GOLD, 4, 0, 0))
    c.set(35 + l2, base - 10, shade(RUG, 2, 0, 0))
    const l3 = lean(3)
    block(c, 13 + l3, base - 13, 11, 2, CHAIR, 2.6)
    for (const lx of [13, 23]) for (let y = base - 18; y < base - 13; y++) c.set(lx + l3, y, shade(CHAIR, lx === 23 ? 4 : 2.2, lx, y))
    for (let y = base - 16; y < base - 13; y++) c.set(19 + l3, y, shade(CHAIR, 3, 19, y))
    c.line(13 + l3, base - 16, 19 + l3, base - 16, (x, y) => shade(CHAIR, 1.6, x, y))
    const l4 = lean(4)
    const l5 = lean(5)
    block(c, 16 + l4, base - 17, 5, 3, TERRA, 2.4, (i, j) => (j === 0 ? 1 : 0))
    for (const [dx, dy, len] of [[-2, -1, 3], [0, -3, 3], [2, -2, 3], [3, -1, 3], [-1, -2, 3]] as const) {
      for (let k = 0; k < len; k++) {
        const x = 18 + l5 + Math.round((dx * (k + 1)) / len)
        const y = base - 18 + Math.round((dy * (k + 1)) / len)
        c.set(x, y, shade(FERN, 3.4 + k * 0.7 + (dx > 0 ? 0.8 : 0), x, y))
      }
    }
    c.line(11, base - 3, 17 + l3, base - 13, (x, y) => shade(SACKR, 4.6, x, y))
    c.line(34, base - 3, 24 + l3, base - 13, (x, y) => shade(SACKR, 5.4, x, y))

    const swing = since < 30 ? -Math.exp(-since / 8) * Math.sin(since * 0.6 + 0.5) * 1.1 : 0
    const ang = Math.max(-0.55, swing + Math.sin((f / STRIDE) * Math.PI * 4) * 0.12)
    const isClang = since === 3 || since === 13
    const px = 9 + Math.sin(ang) * 4
    const py = base + 1 + Math.cos(ang) * 4
    c.line(9, base + 1, px, py - 1, shade(SACKR, 3.4, 0, 0))
    block(c, 4, base + 2, 3, 3, COPPER, 3.4)
    c.set(3, base + 3, shade(COPPER, 2, 0, 0))
    c.set(5, base + 1, shade(COPPER, 4, 0, 0))
    block(c, Math.round(px) - 1, Math.round(py), 4, 3, IRON, 2.6, (_, j) => (j === 0 ? 1.4 : 0))
    if (isClang) {
      const x = Math.round(px) - 2
      const y = Math.round(py) + 1
      c.set(x, y, 0xffffff)
      for (const [dx, dy] of [[-2, -2], [-3, 0], [-2, 2], [0, -3]] as const) c.set(x + dx, y + dy, 0xfff1c4)
    }
  })
}
export const scene: Scene = { verb: 'Schlepping', render, hero: 36 }