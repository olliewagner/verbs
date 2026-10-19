import { Canvas, TAU, hash, hex, mod, particles, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 64

const SKY = hex('6a6f9e 8a80a6 ad8da0 cf9c8e e8b07e f5c784 fadc9c fdecbc fff7e0')
const HAZE = hex('8a7590 9c8294 b09098 c69e98')
const WHEAT = hex('2e1410 4a2214 6c3618 925020 b86e28 d8933a efb853 fad57e fff0b8')
const BIRD = hex('0d1024 1a2040 2c3560 4a5482')
const BELLY = 0xe2bf92
const FACE = 0x9c3a1c
const SUN = hex('fff0b8 fff9e4 fffffa')

const SUN_X = 13
const SUN_Y = 12
const HORIZON = 15

type Way = readonly [x: number, y: number, t: number]
const NEAR: readonly Way[] = [
  [-10, 5, -4], [-2, 5.5, 2], [6, 6.5, 7], [13, 9.5, 12], [20, 15, 16], [27, 19.2, 20], [36, 20.2, 25],
  [45, 19.8, 30], [52, 17.6, 34], [58, 14.6, 38], [64, 11.4, 42], [70, 8.2, 46], [78, 4.5, 50],
]
const FAR: readonly Way[] = [
  [47, -9, 33], [43, -1, 37], [38, 7.5, 41], [32, 14, 45], [25, 16.4, 49], [18, 15.8, 53], [12, 12, 57],
  [6, 6.5, 60], [1, 1.5, 63], [-5, -5, 67], [-12, -10, 71],
]

const catmull = (a: number, b: number, c: number, d: number, u: number) =>
  0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (3 * b - a - 3 * c + d) * u * u * u)

function along(path: readonly Way[], t: number): [number, number] | undefined {
  const n = path.length
  if (t < path[0]![2] || t >= path[n - 1]![2]) return undefined
  let i = 0
  while (t >= path[i + 1]![2]) i++
  const a = path[Math.max(0, i - 1)]!
  const b = path[i]!
  const c = path[i + 1]!
  const d = path[Math.min(n - 1, i + 2)]!
  const u = (t - b[2]) / (c[2] - b[2])

  return [catmull(a[0], b[0], c[0], d[0], u), catmull(a[1], b[1], c[1], d[1], u)]
}

function timeOn(path: readonly Way[], f: number): number {
  return f < path[0]![2] ? f + LOOP : f
}

type Pose = { x: number; y: number; heading: number; art: readonly string[]; scale: number }

const OPEN = [
  '...k.........',
  '....kk.......',
  '.....kkk.....',
  'k.....kkkk...',
  '.k.....kkkk..',
  '..kkkkkkkkkkr',
  '.k.....kkkk..',
  'k.....kkkk...',
  '.....kkk.....',
  '....kk.......',
  '...k.........',
]
const BEAT = [
  '.............',
  '.............',
  '.....kk......',
  'k.....kkkk...',
  '.k.....kkkk..',
  '..kkkkkkkkkkr',
  '.k.....kkkk..',
  'k.....kkkk...',
  '.....kk......',
  '.............',
  '.............',
]
const TUCK = [
  '.............',
  '.............',
  '.............',
  'k............',
  '.k...kkkkk...',
  '..kkkkkkkkkkr',
  '.k...kkkkk...',
  'k............',
  '.............',
  '.............',
  '.............',
]

function pose(path: readonly Way[], f: number, scale: number, wings: (t: number) => readonly string[]): Pose | undefined {
  const t = timeOn(path, f)
  const p = along(path, t)
  if (!p) return undefined
  const q = along(path, t + 0.5)
  const r = along(path, t - 0.5)
  const [ax, ay] = q ?? p
  const [bx, by] = q ? p : r ?? p
  return { x: p[0], y: p[1], heading: Math.atan2(ay - by, ax - bx), art: wings(t), scale }
}

const flap = (t: number, period: number) => (Math.floor((t / period) * 2) % 2 === 0 ? OPEN : BEAT)

function nearWings(t: number): readonly string[] {
  if (t < 10) return flap(t, 4)
  if (t < 19) return TUCK
  if (t < 31) return t >= 25 && t < 28 ? BEAT : OPEN
  return t < 33 ? BEAT : flap(t - 33, 3)
}
function farWings(t: number): readonly string[] {
  if (t < 38) return flap(t, 4)
  if (t < 45) return TUCK
  if (t < 54) return OPEN
  return flap(t - 54, 3)
}

function drawSwallow(c: Canvas, b: Pose): void {
  const isLeft = Math.cos(b.heading) < 0
  const tilt = b.art === TUCK ? 0.9 : 0.35
  const slope = Math.max(-tilt, Math.min(tilt, Math.tan(b.heading)))
  const mask = new Map<number, number>()
  const reach = 8 * b.scale
  for (let y = Math.floor(b.y - reach * 1.6); y <= Math.ceil(b.y + reach * 1.6); y++) {
    for (let x = Math.floor(b.x - reach); x <= Math.ceil(b.x + reach); x++) {
      let bird = 0
      let face = 0
      for (let k = 0; k < 16; k++) {
        const px = x + ((k % 4) + 0.5) / 4 - 0.5 - b.x
        const py = y + (Math.floor(k / 4) + 0.5) / 4 - 0.5 - b.y
        const u = Math.floor((isLeft ? -px : px) / b.scale + 6.5)
        const v = Math.floor((py - px * slope) / b.scale + 5.5)
        const ch = b.art[v]?.[u]
        if (ch === 'k') bird++
        else if (ch === 'r') face++
      }
      if (bird + face < 6 || x < 0 || x >= W || y < 0 || y >= H) continue
      mask.set(y * W + x, face > bird ? FACE : BIRD[0] ?? 0)
    }
  }
  for (const [key, color] of mask) {
    const isLit = color !== FACE && !mask.has(key - W) && mask.has(key + W)
    c.set(key % W, Math.floor(key / W), isLit ? BIRD[2] ?? 0 : color)
  }
}
type Stalk = { x: number; top: number; big: boolean; seed: number }
const STALKS: Stalk[] = (() => {
  const out: Stalk[] = []
  for (let i = 0; i < 34; i++) out.push({ x: i * 2 - 1 + Math.floor(hash(i, 1) * 2), top: 21 + Math.floor(hash(i, 2) * 3), big: false, seed: i })
  for (let i = 0; i < 24; i++) out.push({ x: i * 2.8 - 1 + Math.floor(hash(i, 3) * 2), top: 24 + Math.floor(hash(i, 4) * 4), big: true, seed: i + 50 })
  return out
})()
function passAt(x: number): number | undefined {
  for (let t = 17; t < 33; t += 0.25) {
    const a = along(NEAR, t)
    const b = along(NEAR, t + 0.25)
    if (a && b && a[0] <= x && b[0] > x) return a[1] > 18 ? t : undefined
  }
  return undefined
}
const PASS = STALKS.map(s => passAt(s.x))
function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const wind = (x: number, k = 1) => Math.sin(TAU * ((f / LOOP) * 2) - x * 0.2) * k

    for (let y = 0; y < HORIZON + 1; y++) {
      for (let x = 0; x < W; x++) {
        const d = Math.hypot((x - SUN_X) / 1.4, y - SUN_Y)
        const glow = d < 6 ? 1.3 : d < 11 ? 0.8 : d < 18 ? 0.4 : 0
        c.set(x, y, shade(SKY, y * 0.36 + 0.8 + glow))
      }
    }
    for (const [cx, cy, len] of [[40, 5, 18], [22, 3, 10], [52, 8, 11]] as const) {
      for (let x = cx - len / 2; x <= cx + len / 2; x++) {
        const edge = Math.abs(x - cx) / (len / 2)
        c.set(x, cy, shade(SKY, cy * 0.36 + 2.2 - edge * 0.8))
        if (edge < 0.7) c.set(x + 2, cy + 1, shade(SKY, cy * 0.36 + 3.2))
      }
    }
    c.disc(SUN_X, SUN_Y, 3.2, (x, y) => (Math.hypot(x - SUN_X, y - SUN_Y) < 2.2 ? SUN[2] ?? 0 : SUN[1] ?? 0))
    for (let x = 0; x < W; x++) {
      const top = HORIZON - 0.6 - 1.4 * Math.max(0, Math.sin(x * 0.45 + 1) + Math.sin(x * 0.17)) - (x > 26 && x < 38 ? 1 : 0)
      const near = Math.abs(x - SUN_X) < 8 ? 1.2 : 0
      for (let y = Math.ceil(top); y <= HORIZON; y++) c.set(x, y, shade(HAZE, 1 + near))
    }
    for (let y = 11; y <= HORIZON; y++) for (let x = 46; x <= 50; x++) c.set(x, y, shade(HAZE, x === 46 ? 1 : 0))
    for (const [x, y] of [[47, 10], [48, 10], [49, 10], [48, 9]] as const) c.set(x, y, HAZE[0] ?? 0)
    for (let y = HORIZON + 1; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const far = (y - HORIZON) / (H - HORIZON)
        const sheen = Math.sin(TAU * ((f / LOOP) * 2) - x * 0.16 + y * 0.9) > 0.55 ? 0.8 : 0
        const sunlit = Math.abs(x - SUN_X) < 10 && y < 20 ? 0.8 : 0
        const row = y > 19 && (y + Math.floor(x / 5)) % 2 === 0 ? -0.5 : 0
        c.set(x, y, shade(WHEAT, 6.4 - far * 5.2 + sheen * (1 - far) + sunlit + row))
      }
    }
    {
      const u = f / LOOP
      const x = 34 + 9 * Math.sin(TAU * u)
      const y = 6 + 2 * Math.sin(2 * TAU * u)
      const up = Math.floor(f / 2) % 2 === 0
      const color = HAZE[0] ?? 0
      c.set(x, y, color)
      c.set(x - 1, y + (up ? -1 : 0), color)
      c.set(x + 1, y + (up ? -1 : 0), color)
    }
    const near = pose(NEAR, f, 1, nearWings)
    const far = pose(FAR, f, 0.7, farWings)
    if (far) drawSwallow(c, far)
    STALKS.forEach((s, k) => {
      if (s.big) return
      const sway = Math.round(wind(s.x, 0.8) + bow(PASS[k], f))
      const hx = s.x + sway
      c.set(hx, s.top, shade(WHEAT, 7.4))
      c.set(hx, s.top + 1, shade(WHEAT, 5.4))
      c.set(hx, s.top + 2, shade(WHEAT, 5.4))
    })
    for (const p of particles(f, LOOP, 9, 14, 5)) {
      const born = mod(f - p.t, LOOP)
      if (born < 21 || born > 31) continue
      const at = along(NEAR, born)
      if (!at) continue
      const x = at[0] - 3 + p.r[1] * 3 + p.age * (p.r[2] - 0.3) * 6
      const y = 21 - p.age * (2 + p.r[3] * 4) + p.age * p.age * 4
      c.set(x, y, shade(WHEAT, p.age < 0.6 ? 7.6 : 6.2))
    }
    if (near) drawSwallow(c, near)
    STALKS.forEach((s, k) => {
      if (!s.big) return
      const sway = Math.round(wind(s.x, 1.1) + bow(PASS[k], f) * 0.6)
      const hx = s.x + sway
      c.line(s.x, H - 1, hx, s.top + 4, shade(WHEAT, 2.6 + hash(s.seed, 5)))
      c.set(hx, s.top + 4, shade(WHEAT, 3.4))
      for (let j = 0; j < 4; j++) {
        c.set(hx, s.top + j, shade(WHEAT, j < 2 ? 7 : 5.6))
        c.set(hx + 1, s.top + j, shade(WHEAT, j < 2 ? 5 : 4))
      }
      c.set(hx, s.top - 1, shade(WHEAT, 7.6))
      c.set(hx, s.top - 2, shade(WHEAT, 7.6))
    })
    out.push(c.px)
  }
  return out
}

function bow(pass: number | undefined, f: number): number {
  if (pass === undefined) return 0
  const dt = mod(f - pass, LOOP)
  if (dt > 18) return 0
  return 2.2 * Math.exp(-dt / 5) * Math.sin(dt * 0.6)
}
export const scene: Scene = { verb: 'Swooping', render, hero: 26 }