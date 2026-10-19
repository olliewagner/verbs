import { Canvas, TAU, beat, clamp, ease, hex, loopNoise, mod, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72
const CX = 31.5
const HORIZON = 15
const WATERLINE = 26

const SKY = hex('05071a 0a0e26 101634 182046 202b56 2a3866 36467a')
const MOON = hex('c4c8dc e6e8f2 fdfaea')
const TREES = hex('03050c 060a16 0b1020')
const WATER = hex('03050f 060a1b 0a1028 0f1836 152246 1d2d58')
const GLINT = hex('5a6ca4 9aaad8 dce6fa')
const SWAN = hex('1c2240 323c64 4e5c8a 7280ae 9ca8d0 c4cee8 e6ecf8 ffffff')
const REFL = hex('0e1834 172650 22366a 2e4680')
const REED = hex('010205 04080c 0a1116 121e26')
const CATTAIL = hex('120806 22110b 361d12')
const FLY = hex('4a6a1e 8ab83a d2ee6e f8ffc8')
const BEAK = 0xe8742c
const KNOB = 0x0a0a14

type Point = readonly [number, number]

function pose(f: number): number {
  if (f < 8) return 0
  if (f < 12) return -0.18 * ease.inOut(beat(f, 8, 12))
  if (f < 30) return -0.18 + 1.18 * ease.inOut(beat(f, 12, 30))
  if (f < 56) return 1
  return 1 - ease.inOut(beat(f, 56, 68))
}

function gap(f: number): number {
  if (f < 8) return 7
  if (f < 32) return 7 - 5.5 * ease.inOut(beat(f, 8, 32))
  if (f < 52) return 1.5
  return 1.5 + 5.5 * ease.inOut(beat(f, 52, 68))
}

const lerpPoint = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

const UPRIGHT: Point[] = [[-0.5, -3], [-4.5, -8], [1.5, -11], [1, -16]]
const HEART: Point[] = [[-0.5, -3], [-10, -6], [-8, -22], [-0.6, -12.6]]
const LIFTED: Point[] = [[-0.5, -3], [-3, -9], [0, -14], [0, -17.5]]

function neckAt(p: number): Point[] {
  if (p < 0) return UPRIGHT.map((q, k) => lerpPoint(q, LIFTED[k] ?? q, -p / 0.18))
  const lift = Math.sin(Math.PI * p) * 0.35
  return UPRIGHT.map((q, k) => {
    const mid = lerpPoint(q, LIFTED[k] ?? q, lift)
    return lerpPoint(mid, HEART[k] ?? q, p)
  })
}

function bezier(pts: Point[], t: number): Point {
  const [a, b, c, d] = pts as [Point, Point, Point, Point]
  const u = 1 - t
  return [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
  ]
}

type Part = { level: number; kind: 'white' | 'beak' | 'knob' }

function swanAt(u: number, v: number, neck: Point[], samples: Point[], p: number, isBodyOnly = false): Part | undefined {
  if (isBodyOnly) return bodyAt(u, v)
  const head = neck[3] ?? [0, 0]
  const k = clamp(p)
  const dx0 = 1 - k * 0.4
  const dy0 = 0.2 + k * 0.6
  const len = Math.hypot(dx0, dy0)
  const dx = dx0 / len
  const dy = dy0 / len
  const hu = u - head[0]
  const hv = v - head[1]
  const along = hu * dx + hv * dy
  const across = -hu * dy + hv * dx
  if (along > 1.2 && along < 3.6 && Math.abs(across) < 0.6) return { level: 0, kind: along < 1.9 ? 'knob' : 'beak' }
  if ((along / 1.9) ** 2 + (across / 1.35) ** 2 <= 1) return { level: across < -0.5 ? 6.6 : 5.6, kind: 'white' }
  let best = 99
  let bestK = 0
  samples.forEach(([su, sv], i) => {
    const d = Math.hypot(u - su, v - sv)
    if (d < best) {
      best = d
      bestK = i
    }
  })
  const t = bestK / (samples.length - 1)
  if (t > 0.03 && best < 1.45 - t * 0.55) {
    const [su, sv] = samples[bestK] ?? [0, 0]
    const ny = (v - sv) / Math.max(0.01, best)
    const nx = (u - su) / Math.max(0.01, best)
    return { level: ny < -0.4 || nx < -0.6 ? 6.4 : 5.2, kind: 'white' }
  }
  return bodyAt(u, v)
}

function bodyAt(u: number, v: number): Part | undefined {
  if (v > 0) return undefined
  const wing = ((u + 8) / 5.4) ** 2 + ((v + 4.4) / 2.6) ** 2
  const breast = ((u + 5.5) / 6.6) ** 2 + ((v + 1.9) / 2.9) ** 2
  const tail = ((u + 13.4) / 2.4) ** 2 + ((v + 3.8 + (u + 13.4) * 0.5) / 1.1) ** 2
  const tips = u < -11 && u > -14 && v < -3 && v > -6.5 && wing < 1.35 && Math.round(u - v) % 2 === 0
  if (wing <= 1 || tips) {
    const isEdge = wing > 0.62 && v > -4.6
    return { level: v < -6.3 ? 7 : isEdge ? 4.4 : tips ? 5.2 : 6.2, kind: 'white' }
  }
  if (breast <= 1 || tail <= 1) return { level: v < -3.6 && u > -2 ? 6.4 : v > -0.9 ? 3.6 : 5, kind: 'white' }
  return undefined
}

function drawSwans(c: Canvas, f: number): void {
  const p = pose(f)
  const neck = neckAt(p)
  const samples = Array.from({ length: 49 }, (_, k) => bezier(neck, k / 48))
  const g = gap(f)
  for (const flip of [false, true]) {
    const cx = flip ? CX + g : CX - g
    const local = (x: number) => (flip ? cx - x : x - cx)
    for (let y = 0; y < H; y++) {
      for (let x = Math.floor(cx - 18); x <= Math.ceil(cx + 18); x++) {
        if (x < 0 || x >= W) continue
        if (y <= WATERLINE) {
          const part = swanAt(local(x), y - WATERLINE, neck, samples, p)
          if (!part) continue
          c.set(x, y, part.kind === 'beak' ? BEAK : part.kind === 'knob' ? KNOB : shade(SWAN, part.level))
          continue
        }
        if ((y - WATERLINE) % 3 === 2) continue
        const wob = Math.round(Math.sin(y * 1.9 + (f / LOOP) * TAU * 4) * 0.8)
        const part = swanAt(local(x + wob), WATERLINE - y, neck, samples, p, true)
        if (!part) continue
        c.set(x, y, shade(REFL, (part.level > 5.5 ? 2.2 : 1.4) - (y - WATERLINE) * 0.15))
      }
    }
  }
}

type Ring = { at: number; x: number; big: boolean }
function rings(): Ring[] {
  const out: Ring[] = []
  for (const at of [2, 14, 26, 58, 66]) {
    const g = gap(at)
    out.push({ at, x: CX - g, big: false }, { at: at + 3, x: CX + g, big: false })
  }
  out.push({ at: 34, x: CX, big: true })
  return out
}
const RINGS = rings()

function drawWater(c: Canvas, f: number): void {
  for (let y = HORIZON; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const depth = (y - HORIZON) / (H - HORIZON)
      let level = 4.4 - depth * 3.2
      const halfWidth = 1.5 + (y - HORIZON) * 0.5
      const off = Math.abs(x - CX) / halfWidth
      if (off < 1) {
        const n = loopNoise(x * 0.35, y * 1.6, f / LOOP, 3, 7)
        const glow = 1 - off * off
        if (n * glow > 0.4) {
          c.set(x, y, shade(GLINT, n * glow * 3 - 0.6))
          continue
        }
        level += glow * 1.2
      }
      c.set(x, y, shade(WATER, level))
    }
  }
  for (const r of RINGS) {
    const age = mod(f - r.at, LOOP)
    const life = r.big ? 26 : 18
    if (age >= life) continue
    const rx = 2 + age * (r.big ? 1.2 : 0.75)
    const ry = Math.max(1, rx * 0.24)
    const col = GLINT[r.big ? (age < life * 0.35 ? 2 : age < life * 0.65 ? 1 : 0) : age < life * 0.5 ? 1 : 0] ?? 0
    const seen = new Set<number>()
    for (let a = 0; a < 200; a++) {
      const th = (a / 200) * TAU
      const x = Math.round(r.x + Math.cos(th) * rx)
      const y = Math.round(WATERLINE + Math.sin(th) * ry)
      if (y < HORIZON || y >= H || x < 0 || x >= W || seen.has(y * W + x)) continue
      seen.add(y * W + x)
      if (Math.abs(Math.sin(th)) < 0.5 && (x + age) % 4 === 0) continue
      if (Math.sin(th) < -1 + 2.2 * clamp((age - life + 6) / 6)) continue
      c.set(x, y, col)
    }
  }
}

function drawSky(c: Canvas, f: number, kiss: number): void {
  for (let y = 0; y < HORIZON; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - CX, (y - 4) * 1.1)
      const halo = d < 7.5 ? 1 : d < 11 ? 0.5 : 0
      c.set(x, y, shade(SKY, 0.6 + y * 0.32 + halo * (1 + kiss * 0.5)))
    }
  }
  for (const [x, y, k] of [[4, 2, 0], [11, 5, 1], [18, 1, 2], [24, 9, 3], [44, 2, 4], [50, 7, 5], [57, 3, 6], [61, 9, 7], [8, 10, 8], [38, 11, 9], [53, 11, 10]] as const) {
    const tw = Math.sin((f / LOOP) * TAU * (1 + (k % 3)) + k * 1.7)
    c.set(x, y, tw > 0.6 ? 0xe8ecff : tw > -0.4 ? 0x8a96c8 : shade(SKY, 0.6 + y * 0.32 + 1))
  }
  for (let y = 0; y <= 8; y++) {
    for (let x = 27; x <= 36; x++) {
      const d = Math.hypot(x - CX, y - 4)
      if (d > 3.3) continue
      const sea = (x === 30 && y === 3) || (x === 31 && y === 3) || (x === 33 && y === 5)
      c.set(x, y, shade(MOON, 2 - (sea ? 1 : 0) - (d > 2.7 ? 0.6 : 0) - (x > 32 && y > 4 ? 0.5 : 0)))
    }
  }
  for (let x = 0; x < W; x++) {
    const top = HORIZON - 1 - Math.round(1.6 + Math.sin(x * 0.55) * 0.9 + Math.sin(x * 0.17 + 1) * 1.3 + (Math.abs(x - CX) < 9 ? -1.2 : 0))
    for (let y = Math.max(0, top); y < HORIZON; y++) c.set(x, y, shade(TREES, y === top ? 1.6 : 1))
  }
  for (let x = 0; x < W; x++) c.set(x, HORIZON, shade(WATER, 4.6))
}

function drawReeds(c: Canvas, f: number): void {
  const reeds: readonly [number, number, number][] = [
    [1, 13, 4], [3, 18, 0], [5, 15, 4], [7, 20, 0], [9, 22, 0], [2, 21, 0],
    [62, 14, 5], [60, 19, 0], [58, 16, 4], [56, 21, 0], [54, 23, 0], [61, 22, 0],
  ]
  for (const [x0, top, cattail] of reeds) {
    const sway = Math.sin((f / LOOP) * TAU * 2 + x0 * 0.7) * 1.2
    for (let y = top; y < H; y++) {
      const k = (H - y) / (H - top)
      const x = Math.round(x0 + sway * k * k)
      c.set(x, y, shade(REED, 1 + (x0 < 32 ? 0.6 : 0.3) + (y === top ? 1 : 0)))
      if (y > top + 5 && (x0 + y) % 7 === 0) c.set(x + (x0 < 32 ? 1 : -1), y - 1, shade(REED, 1.4))
    }
    if (cattail) {
      const x = Math.round(x0 + sway * 0.85)
      for (let y = top + 2; y < top + 2 + cattail; y++) {
        c.set(x, y, shade(CATTAIL, y === top + 2 ? 2 : 1.2))
        c.set(x + 1, y, shade(CATTAIL, 0.6))
      }
    }
  }
}

function drawFireflies(c: Canvas, f: number): void {
  const flies: readonly [number, number, number, number, number][] = [
    [6, 12, 1, 2, 0.3], [11, 17, 2, 1, 1.9], [4, 21, 1, 3, 3.1], [57, 11, 2, 1, 0.8], [52, 16, 1, 2, 2.4], [60, 20, 3, 1, 4.2],
  ]
  const glow = (x: number, y: number, on: number) => {
    if (on <= 0) return
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.tint(x + dx, y + dy, FLY[1] ?? 0, 0.35 * on)
    c.set(x, y, shade(FLY, 1.5 + on * 1.6))
  }
  for (const [x0, y0, a, b, ph] of flies) {
    const t = (f / LOOP) * TAU
    const x = Math.round(x0 + 3 * Math.sin(t * a + ph))
    const y = Math.round(y0 + 2 * Math.sin(t * b + ph * 1.3))
    const blink = Math.sin(t * 3 + ph * 2)
    glow(x, y, blink > 0.2 ? 1 : blink > -0.3 ? 0.45 : 0)
  }
  const age = f - 34
  if (age >= 0 && age < 30) {
    const k = age / 30
    const x = Math.round(CX + 0.5 + Math.sin(k * TAU * 1.5) * 1.2)
    const y = Math.round(WATERLINE - 3 - k * 18)
    glow(x, y, Math.sin(Math.PI * k) > 0.25 ? 1 : 0.45)
  }
}

function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const kiss = f >= 34 && f < 54 ? 1 : 0
    const c = new Canvas()
    drawSky(c, f, kiss)
    drawWater(c, f)
    drawSwans(c, f)
    drawReeds(c, f)
    drawFireflies(c, f)
    out.push(c.px)
  }

  return out
}

export const scene: Scene = { verb: 'Canoodling', render, hero: 42 }
