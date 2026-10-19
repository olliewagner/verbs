import { Canvas, TAU, beat, clamp, ease, frames, hash, hex, lerp, mod, type Scene, shade } from '../engine'

const W = 64
const LOOP = 72
const SURFACE = 11
const SEED_Y = 21
const SUN_X = 54
const SUN_Y = 3
const PAN = 60

const SKY = hex('2f5e9e 3f78c0 5592d8 72ade6 97c8f0 c3e2f7 e4f2f6')
const SUN = hex('f8dc84 fdeeb4 fffbe8')
const CLOUD = hex('8aa6cf b4cbe6 dce8f4 f8fbfd')
const TURF = hex('1a2e16 2c4a1e 44692a 64893a 8fae4c b8cf6a')
const TOPSOIL = hex('140b0c 1f1210 2d1a14 3d2419 503020 66402a')
const CLAY = hex('22140f 341e14 4a2b19 633b20 7e4d2a 9a6236')
const GRAVEL = hex('1a1214 2a1f1e 3d2f2a 54433a 6e5a4c 8c7562')
const STONE = hex('2a2430 463c46 6a5e64 948684 bcb0a6')
const SEED = hex('3a2216 6a4224 9c6a38 c8975a e4c088 f6e2b6')
const GERM = hex('4f6e24 86a83a bdd86a')
const ROOT = hex('4a3a2c 8a7660 c4b294 e6d8be faf2e0')
const PALE = hex('6e6c44 a4a46c d2d49c ecefc4')
const LEAF = hex('16301a 285222 3f7a2a 62a33a 93c955 c8ea84 eefab8')
const WORM = hex('4a1e2a 7e3444 b0525e d8808a f0aeae')
const WATER = hex('3a7ab8 7ec0ec d4f0ff')

type Point = [number, number]

const ROW = 512
const keyOf = (x: number, y: number) => (Math.round(y) + 64) * ROW + Math.round(x) + 256
const xOf = (key: number) => mod(key, ROW) - 256
const yOf = (key: number) => Math.floor(key / ROW) - 64

function trace(x0: number, y0: number, length: number, angle: (s: number) => number): Point[] {
  const raw: Point[] = [[Math.round(x0), Math.round(y0)]]
  let x = x0
  let y = y0
  for (let s = 0; s < length; s += 0.2) {
    const a = angle(s)
    x += Math.sin(a) * 0.2
    y -= Math.cos(a) * 0.2
    const last = raw[raw.length - 1]
    const p: Point = [Math.round(x), Math.round(y)]
    if (!last || last[0] !== p[0] || last[1] !== p[1]) raw.push(p)
  }
  const pts: Point[] = []
  raw.forEach((p, i) => {
    const prev = pts[pts.length - 1]
    const next = raw[i + 1]
    if (prev && next && Math.abs(prev[0] - next[0]) === 1 && Math.abs(prev[1] - next[1]) === 1) return
    pts.push(p)
  })
  return pts
}

function ribbon(x0: number, y0: number, length: number, angle: (s: number) => number) {
  const left = new Set<number>()
  const right = new Set<number>()
  let x = x0
  let y = y0
  let a = angle(0)
  const put = () => {
    left.add(keyOf(x, y))
    right.add(keyOf(x + Math.cos(a), y + Math.sin(a)))
  }
  put()
  for (let s = 0; s < length; s += 0.2) {
    a = angle(s)
    x += Math.sin(a) * 0.2
    y -= Math.cos(a) * 0.2
    put()
  }
  for (const k of right) left.delete(k)
  return { left, right, x: x + Math.cos(a) * 0.5, y: y + Math.sin(a) * 0.5, a }
}
function growth(t: number) {
  const stem = 11.1 * ease.inOut(beat(t, 16, 33)) + 0.6 * ease.inOut(beat(t, 35, 44))
  const straighten = (1 - Math.cos(Math.PI * beat(t, 35, 43))) / 2
  const settle = clamp((t - 50) / 4)
  return {
    swell: ease.inOut(beat(t, 2, 12)) - 0.2 * beat(t, 30, 50),
    stretch: t >= 9 && t <= 12 ? (t - 8) * 0.15 : 0,
    shiver: t === 11 ? 1 : t === 12 ? -1 : 0,
    crack: beat(t, 12, 15),
    root: 12 * ease.out(beat(t, 13, 34)),
    laterals: ease.out(beat(t, 26, 42)),
    stem,
    bend: Math.PI * Math.min(1, stem / 4.5) * (1 - straighten),
    open: t < 43 ? 0 : ease.outBack(beat(t, 43, 51)),
    sway: 0.1 * Math.sin((t - 50) * 0.55) * settle,
  }
}
type Growth = ReturnType<typeof growth>
function stemOf(sx: number, g: Growth) {
  const hook = Math.min(g.stem, 4.5)
  const top = SEED_Y - 2 - Math.round(1.8 + g.swell * 0.8)
  return ribbon(sx, top + 1, g.stem, s => -g.bend * clamp((s - (g.stem - hook)) / hook) + g.sway * (s / Math.max(1, g.stem)) ** 2)
}

const BREAK = (() => {
  for (let t = 16; t < 44; t++) {
    const { left, right } = stemOf(0, growth(t))
    const top = [...left, ...right].reduce((best, k) => (k < best ? k : best), Infinity)
    if (yOf(top) < SURFACE) return { t, x: xOf(top) }
  }
  return { t: 34, x: 0 }
})()
const CRUMBS = [[-0.7, 1.3], [0.5, 1.7], [1.1, 1.1]] as const
function crumbAt(i: number, t: number): Point | undefined {
  const [vx, vy] = CRUMBS[i] ?? [0, 0]
  const s = t - BREAK.t
  const y = SURFACE - 1 - vy * s + 0.25 * s * s
  if (s < 0 || y > SURFACE - 1) return undefined
  return [Math.round(BREAK.x + vx * s), Math.round(y)]
}
const STONES: readonly [number, number, number, number][] = [
  [4, 15, 2.2, 1.5], [52, 25, 2.6, 1.7], [21, 30, 2.4, 1.6], [59, 14, 1.5, 1.1], [43, 30, 1.8, 1.3], [12, 21, 1.3, 1],
]

const TUFTS: readonly [number, number][] = [[3, 2], [8, 1], [16, 3], [21, 1], [42, 1], [47, 3], [55, 2], [61, 1]]
const CLOUDS: readonly [number, number, number][] = [
  [5, 4.4, 1.9], [9, 3.4, 2.6], [13.5, 2.8, 3], [18, 3.6, 2.5], [21.5, 4.6, 1.8], [41, 6, 1.7], [44.5, 5.2, 2.2], [48, 6, 1.6],
]
const wrap = (d: number) => mod(d + 32, 64) - 32
function isCloud(cx: number, y: number): boolean {
  if (y > (wrap(cx - 13) ** 2 < 144 ? 5 : 6)) return false
  return CLOUDS.some(([px, py, r]) => Math.hypot(wrap(cx - px) * 0.8, (y - py) * 1.2) <= r)
}

const panAt = (f: number) => 32 * (1 - Math.cos(Math.PI * beat(f, PAN, LOOP)))
function drawPlant(c: Canvas, sx: number, t: number, glow: number): void {
  if (sx < -20 || sx > W + 20) return
  const g = growth(t)
  const rx = 3.3 + g.swell * 0.9 - g.stretch * 0.6
  const ry = 1.8 + g.swell * 0.8 + g.stretch
  const top = SEED_Y - ry
  if (g.root > 0.5) {
    const root = trace(sx, SEED_Y + 1, g.root + 1, s => Math.PI + 0.42 * Math.cos(s * 0.5))
    root.forEach(([x, y], i) => {
      const isTip = i === root.length - 1
      c.set(x, y, shade(ROOT, isTip ? 4 : 3 - (i > 7 ? 0.6 : 0)))
      if (i < 4) c.set(x + 1, y, shade(ROOT, 1.6))
      for (const [at, dir, reach] of [[5, -1, 3], [8, 1, 2.5]] as const) {
        const n = Math.round(g.laterals * reach)
        if (i !== at) continue
        for (let k = 1; k <= n; k++) c.set(x + dir * (k + (dir > 0 ? 1 : 0)), y + k, shade(ROOT, k === n ? 2.6 : 2))
      }
    })
  }
  if (g.stem > 0.3) {
    const stem = stemOf(sx, g)
    for (const [side, keys] of [[0, stem.left], [1, stem.right]] as const) {
      for (const key of keys) {
        const x = xOf(key)
        const y = yOf(key)
        if (y >= SURFACE) c.set(x, y, shade(PALE, side ? 2.6 : 1.4))
        else c.set(x, y, shade(LEAF, (side ? 4 : 2.6) - (y >= SURFACE - 2 ? 0.6 : 0) + glow * 0.6 * side))
      }
    }
    const tx = stem.x
    const ty = stem.y
    const open = g.open
    const sprout = lerp(0.4, 1, clamp(g.stem / 2.5))
    const leaf = new Set<number>()
    for (const side of [-1, 1]) {
      const a = stem.a + side * open * 1.02 + side * g.sway * 0.8
      const dx = Math.sin(a)
      const dy = -Math.cos(a)
      const len = lerp(1.9, 3.5, clamp(open)) * sprout
      const wid = lerp(1.2, 1.75, clamp(open)) * Math.sqrt(sprout)
      const cx = tx + dx * len * 0.85
      const cy = ty + dy * len * 0.85
      for (let y = Math.floor(cy - 5); y <= cy + 5; y++) {
        for (let x = Math.floor(cx - 5); x <= cx + 5; x++) {
          const u = (x - cx) * dx + (y - cy) * dy
          const v = -(x - cx) * dy + (y - cy) * dx
          const w = wid * (u > 0 ? 1 : 0.8)
          if ((u / len) ** 2 + (v / w) ** 2 <= 1) leaf.add(keyOf(x, y))
        }
      }
    }
    for (const key of leaf) {
      const x = xOf(key)
      const y = yOf(key)
      const isTop = !leaf.has(key - ROW)
      const isUnder = !leaf.has(key + ROW)
      if (y >= SURFACE) {
        c.set(x, y, shade(GERM, 1 + (isTop ? 1 : 0) - (isUnder ? 0.6 : 0)))
        continue
      }
      const level = 3.2 + (isTop ? 1.2 : 0) - (isUnder ? 1.4 : 0) + (x > tx ? 0.5 : 0) + glow * (isTop ? 1.4 : 0.6)
      c.set(x, y, shade(LEAF, level))
    }
  }
  const cx = sx + 0.5 + g.shiver
  for (let y = Math.floor(top); y <= SEED_Y + ry; y++) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const nx = (x - cx) / rx
      const ny = (y - SEED_Y) / ry
      const r = nx * nx + ny * ny
      if (r > 1) continue
      const isGlint = Math.round(nx * rx) === -2 && Math.round(ny * ry) === -1
      c.set(x, y, shade(SEED, 3 - ny * 1.2 - nx * 0.5 - (r > 0.72 ? 0.7 : 0) + (isGlint ? 1.5 : 0)))
    }
  }
  c.set(cx - 0.5, Math.round(SEED_Y + ry) - 1, SEED[1] ?? 0)
  c.set(cx + 0.5, Math.round(SEED_Y + ry) - 1, SEED[1] ?? 0)
  if (g.crack > 0) {
    const reach = Math.round((rx - 0.8) * g.crack)
    const y0 = Math.round(top) + 1
    for (let i = -reach; i <= reach; i++) {
      const x = Math.round(cx - 0.5 + i)
      const y = y0 + (Math.abs(i) >= 2 ? 1 : 0)
      const isOpen = g.crack >= 1 && Math.abs(i) <= reach - 1 && Math.abs(i) <= 1
      c.set(x, y, isOpen ? shade(GERM, 1.6) : SEED[0] ?? 0)
    }
  }
  for (const [i, ox] of [-5, 1, 5].entries()) {
    const p = beat(t, 1 + i * 3, 7 + i * 3)
    if (p <= 0 || p >= 1) continue
    const x = Math.round(sx + ox * (1 - p * 0.6))
    const y = Math.round(lerp(SURFACE + 2, top - 1, ease.in(p)))
    c.set(x, y, WATER[2] ?? 0)
    c.set(x, y - 1, WATER[1] ?? 0)
  }
  const lead = BREAK.t - t
  const bx = sx + BREAK.x
  if (lead > 0 && lead <= 3) {
    c.set(bx, SURFACE - 1, shade(TOPSOIL, 4.5))
    c.set(bx + 1, SURFACE - 1, shade(TOPSOIL, 4))
    if (lead === 1) c.set(bx, SURFACE - 2, shade(TOPSOIL, 4.5))
  }
  if (t >= BREAK.t) {
    c.set(bx - 1, SURFACE - 1, shade(TOPSOIL, 4.2))
    c.set(bx + 2, SURFACE - 1, shade(TOPSOIL, 3.6))
    CRUMBS.forEach((_, i) => {
      const p = crumbAt(i, t)
      if (p) c.set(sx + p[0], p[1], shade(TOPSOIL, 4.6))
    })
  }
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const pan = Math.round(panAt(f))
    const drift = Math.round((f * 32) / LOOP + panAt(f) * 0.5)
    const glow = ease.out(beat(f, 45, 50)) * (1 - ease.inOut(beat(f, 52, 66)))
    const swellOf = (k: number) => growth(k < 0 ? PAN : k > 0 ? 0 : f).swell
    for (let y = 0; y < SURFACE; y++) {
      for (let x = 0; x < W; x++) {
        const d = Math.hypot(x - SUN_X, (y - SUN_Y) * 1.1)
        let level = 1 + y * 0.45 + (d < 6 ? 1 : d < 9 ? 0.5 : 0)
        const angle = Math.atan2(y - SUN_Y, x - SUN_X)
        if (glow > 0 && Math.sin(angle * 5 + 0.4) > 0.55 && d > 4) level += glow * 2.4 * clamp(1.2 - d / 30)
        c.set(x, y, shade(SKY, level))
        const cx = mod(x + drift, 64)
        if (isCloud(cx, y)) {
          const isBottom = !isCloud(cx, y + 1)
          const isTop = !isCloud(cx, y - 1)
          c.set(x, y, CLOUD[isBottom ? 1 : isTop ? 3 : 2] ?? 0)
        }
        if (d < 2.4 + glow * 0.6) c.set(x, y, SUN[2] ?? 0)
        else if (d < 3.4 + glow) c.set(x, y, SUN[1] ?? 0)
      }
    }
    for (let y = SURFACE; y < 32; y++) {
      for (let x = 0; x < W; x++) {
        const wx = x + pan
        const m = mod(wx, 64)
        const b1 = 23 + Math.round(Math.sin((TAU * m * 2) / 64) * 1.2 + Math.sin((TAU * m * 3) / 64 + 1) * 0.8)
        const b2 = 29 + Math.round(Math.sin((TAU * m) / 64 + 2) * 1.1)
        const fleck = hash(m, y, 3) < 0.03 || hash(mod(m - 1, 64), y, 3) < 0.03
        let damp = 0
        for (const k of [-1, 0, 1]) {
          const r = Math.hypot((wx - 32.5 - 64 * k) / 1.25, (y - SEED_Y) * 1.1)
          if (r < 3 + swellOf(k) * 2.6) damp = 1
        }
        let color: number
        if (y === SURFACE) color = shade(TURF, 2.6 + (fleck ? 0.8 : 0))
        else if (y < b1) color = shade(TOPSOIL, 3.4 - (y - SURFACE) * 0.1 + (fleck ? 1 : 0) - damp)
        else if (y < b2) color = shade(CLAY, (y === b1 ? 4 : 3.4 - (y - b1) * 0.15) + (fleck ? 0.9 : 0) - damp)
        else color = shade(GRAVEL, (y === b2 ? 3.3 : 2.5) + (fleck ? 1 : 0))
        const tunnel = Math.hypot(wrap(m - 11) / 7.5, (y - 27.5) / 1.3)
        if (tunnel < 1) color = shade(CLAY, 1.2 - (y <= 27 ? 0.6 : 0))
        c.set(x, y, color)
        for (const [px, py, srx, sry] of STONES) {
          const nx = wrap(m - px) / srx
          const ny = (y - py) / sry
          if (nx * nx + ny * ny > 1) continue
          c.set(x, y, shade(STONE, 2.2 - ny * 1.2 - nx * 0.6))
        }
      }
    }
    for (const [tx, tall] of TUFTS) {
      for (const k of [0, 1]) {
        const x = tx + 64 * k - pan
        if (x < -3 || x > W + 3) continue
        const nod = Math.round(Math.sin(TAU * (f / LOOP) * 3 + tx) * 0.7)
        c.set(x, SURFACE - 1, shade(TURF, 3))
        c.set(x - 1, SURFACE - 1, shade(TURF, 2.4))
        c.set(x + 1, SURFACE - 1, shade(TURF, 3.6))
        if (tall === 1) c.set(x + 1 + nod, SURFACE - 2, shade(TURF, 4.2))
        else c.set(x, SURFACE - 2, shade(TURF, 4))
        if (tall === 2) c.set(x + nod, SURFACE - 3, shade(TURF, 4.8))
        if (tall === 3) {
          c.set(x - 1, SURFACE - 2, shade(TURF, 3.4))
          c.set(x + nod, SURFACE - 3, shade(TURF, 4.6))
          c.set(x - 1 + nod, SURFACE - 4, shade(TURF, 5))
        }
      }
    }
    const head = 11 + 4 * Math.sin((TAU * f) / LOOP)
    const bunch = 1.5 + 1.5 * Math.sin((TAU * f * 4) / LOOP)
    const dir = Math.cos((TAU * f) / LOOP) >= 0 ? 1 : -1
    for (const k of [0, 1]) {
      const hx = Math.round(head + 64 * k - pan)
      const len = Math.round(6 - bunch)
      for (let i = 0; i <= len; i++) {
        const y = 28 + (len < 5 && i === Math.floor(len / 2) ? -1 : 0)
        c.set(hx - dir * i, y, shade(WORM, i === 0 ? 4 : i === len ? 1.6 : 2.6 + (i % 2) * 0.6))
      }
    }
    drawPlant(c, 32 - 64 - pan, PAN, 0)
    drawPlant(c, 32 + 64 - pan, 0, 0)
    drawPlant(c, 32 - pan, f, glow)
  })
}
export const scene: Scene = {
  verb: 'Germinating',
  render,
  hero: 52,
  snaps: [
    {
      frames: [PAN + 1, 0],
      box: [0, 0, W - 1, 31],
      colors: [...CLOUD, ...TURF, ...TOPSOIL, ...CLAY, ...GRAVEL, ...STONE, ...SEED, ...GERM, ...ROOT, ...PALE, ...LEAF, ...WORM, ...WATER],
      why: 'the view slides along the row to the next bean: everything but the sky and sun moves up to 8 px a frame, and the last 1 px step lands on frame 0',
    },
  ],
}