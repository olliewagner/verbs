import { Canvas, TAU, beat, clamp, ease, frames, hex, loopNoise, mod, particles, shade, smoothstep, type Ramp, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const MIST = hex('6a7089 7a809a 8b90a8 9da0b5 aeb0c1 bfbfcc d0cdd5 e1dbdc efe7e2')
const SEA = hex('56607a 657089 757f98 868fa8 979fb5')
const SAND = hex('3e353e 52474e 685a5e 7d6d6d 948281 a99690 bdaa9f')
const SLATE = hex('15171f 21242f 30343f 434855 5b6170 7a8090 9aa0ad')
const UMBER = hex('1d1718 2c2323 3e3230 53443e 6c5a50 887465 a39182')
const BASALT = hex('121214 1d1c20 2a292f 3a3941 504f58 6b6a72 8c8a90')
const RIM = hex('3a2c2a 6e4c34 a87440 dca24e f6cf78 fff0c0')
const HALO = hex('7a6450 a08260 c8a46c e6c27c f8dc98 fff2cc')
const FOAM = hex('a8acc0 d6d6e0 f2f0f2')
const KELP = hex('17140f 2a2516 3d3a1e 545228')

type Stone = {
  cx: number
  cy: number
  rx: number
  ry: number
  ramp: Ramp
  base: number
  lift: number
  turn: number
  marks: readonly (readonly [number, number, number])[]
  ring: number
  drift: number
}

const sphere = (lon: number, lat: number) => [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)] as const

const STONES: Stone[] = [
  { cx: 32, cy: 27.5, rx: 10.5, ry: 3, ramp: SLATE, base: 2.4, lift: 2, turn: 1, marks: [sphere(0.4, -0.3), sphere(1.9, 0.25), sphere(3.3, -0.1), sphere(4.4, -0.35), sphere(5.4, 0.3)], ring: 0, drift: 0 },
  { cx: 31, cy: 21.6, rx: 8, ry: 2.7, ramp: BASALT, base: 2.4, lift: 4.4, turn: -1, marks: [sphere(2.6, -0.4)], ring: 1, drift: -1 },
  { cx: 32.5, cy: 16.2, rx: 6.2, ry: 2.4, ramp: UMBER, base: 2.8, lift: 6.6, turn: 1, marks: [sphere(0.9, -0.2), sphere(2.7, 0.3), sphere(4.4, -0.3)], ring: 0, drift: 2 },
  { cx: 31.8, cy: 11.4, rx: 4, ry: 2.2, ramp: SLATE, base: 3, lift: 8.6, turn: -1, marks: [sphere(0.6, -0.3), sphere(3.6, 0.2)], ring: 0, drift: -1 },
]

function raised(i: number, f: number): number {
  const up = 12 + (STONES.length - 1 - i) * 2
  const down = 47 + i * 3
  return ease.inOut(beat(f, up, up + 13)) * (1 - ease.inOut(beat(f, down, down + 10)))
}

function bob(i: number, f: number): number {
  const done = 12 + (STONES.length - 1 - i) * 2 + 13
  const down = 47 + i * 3
  if (f < done || i % 2 === 0) return 0
  return Math.sin((TAU * (f - done)) / 36) * 0.6 * (1 - smoothstep(down, down + 6, f))
}
function turned(i: number, f: number): number {
  const s = STONES[i]
  if (!s) return 0
  const up = 12 + (STONES.length - 1 - i) * 2
  return TAU * s.turn * ease.inOut(beat(f, up + 4, 47 + i * 3 + 8))
}

const aura = (f: number) => smoothstep(5, 13, f) * (1 - smoothstep(60, 70, f))

function reach(f: number, x: number): number {
  const p = ((f / LOOP) * 3 + x * 0.004) % 1
  const r = p < 0.3 ? ease.out(p / 0.3) : 1 - ease.inOut((p - 0.3) / 0.7)
  return 19.4 + r * 2.6 + Math.sin(x * 0.17) * 0.5
}
const ridge = (x: number) => 11.6 + Math.sin(x * 0.21 + 0.8) * 1.2 + Math.sin(x * 0.5) * 0.5
function backdrop(x: number, y: number, f: number): number {
  if (y < 14) {
    const sun = Math.hypot(x - 50, (y - 5) * 1.2)
    const halo = sun < 2.3 ? 3 : sun < 4.5 ? 1.2 : sun < 8 ? 0.5 : 0
    if (x <= 17 && y >= ridge(x) + (x > 12 ? (x - 12) * 0.5 : 0)) return shade(MIST, 3.2)
    if (x >= 55 && x <= 58 && y >= 10 + (x === 55 ? 1 : 0)) return shade(MIST, 3.8)
    const fog = loopNoise(x * 0.06, y * 0.35, f / LOOP, 1.2, 5) > 0.58 ? 0.6 : 0
    return shade(MIST, 3.4 + y * 0.24 + halo + fog)
  }
  const edge = reach(f, x)
  if (y < edge - 0.5) {
    const shimmer = loopNoise(x * 0.25, y * 0.9, f / LOOP, 2, 9) > 0.64 ? 1 : 0
    const sheet = y >= edge - 1.5 ? 1 : 0
    return shade(SEA, 3.6 - (y - 14) * 0.3 + shimmer + sheet)
  }
  if (y < edge + 0.5) return shade(FOAM, 1 + (x % 5 === 0 ? 1 : 0))
  if (y <= 23) return shade(SAND, 5 - (y - edge) * 0.4)
  const ripple = Math.sin(x * 0.35 + y * 1.6 + Math.sin(x * 0.11) * 2) > 0.75 ? -0.8 : 0
  return shade(SAND, 4.3 - (y - 24) * 0.12 + ripple)
}
function glowOn(c: Canvas, x: number, y: number, strength: number): void {
  const v = c.get(x, y)
  const lum = (((v >> 16) & 255) * 0.3 + ((v >> 8) & 255) * 0.59 + (v & 255) * 0.11) / 255
  c.set(x, y, shade(HALO, lum * 3 + strength - 0.6))
}
const heightsAt = (f: number) => STONES.map((s, i) => s.lift * raised(i, f) + bob(i, f))

function glowAt(i: number, f: number): number {
  const raw = (t: number) => {
    const h = heightsAt(mod(t, LOOP))
    const gap = i === 0 ? (h[0] ?? 0) : (h[i] ?? 0) - (h[i - 1] ?? 0)
    return Math.max(clamp(gap / 1.8), aura(mod(t, LOOP)) * 0.45)
  }
  let g = raw(f - 6)
  for (let t = f - 5; t <= f; t++) g = Math.max(raw(t), g - 0.2)
  return g
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const lifts = heightsAt(f).map(Math.round)
    const cys = STONES.map((s, i) => s.cy - (lifts[i] ?? 0))
    const cxs = STONES.map((s, i) => s.cx + Math.round(s.drift * raised(i, f)))
    const breath = 0.88 + 0.12 * Math.sin(TAU * (f / LOOP) * 3)
    const glow = STONES.map((_, i) => glowAt(i, f) * breath)

    c.fill((x, y) => backdrop(x, y, f))
    c.line(2, 29, 7, 28, KELP[2] ?? 0)
    c.line(8, 28, 13, 30, KELP[1] ?? 0)
    c.line(4, 30, 9, 30, KELP[1] ?? 0)
    c.set(6, 29, KELP[3] ?? 0)
    c.set(10, 29, KELP[3] ?? 0)
    c.sprite(53, 28, ['.ab', 'abb'], { a: SAND[6] ?? 0, b: SAND[5] ?? 0 })

    const s0 = STONES[0]
    if (s0) {
      const g = glow[0] ?? 0
      for (let y = 29; y < H; y++) {
        for (let x = 18; x < 47; x++) {
          const d = Math.hypot((x - s0.cx) / 11.5, (y - 30.6) / 1.7)
          if (d > 1) continue
          const shadow = (1 - (lifts[0] ?? 0) / 2) * (d < 0.85 ? 1 : 0)
          if (shadow > 0.4) c.set(x, y, shade(SAND, 1.8 + d * 1.2))
          if (g > 0.15 && d < 0.4 + g * 0.6) glowOn(c, x, y, d < 0.25 + g * 0.35 ? 2.2 : 1)
        }
      }
    }
    STONES.forEach((s, i) => {
      const g = glow[i] ?? 0
      if (g < 0.12) return
      const below = STONES[i - 1]
      const floor = i === 0 ? 30.5 : (cys[i - 1] ?? 0) - (below?.ry ?? 0)
      const roof = (cys[i] ?? 0) + s.ry
      const yh = (floor + roof) / 2
      const cx = ((cxs[i] ?? s.cx) + (i === 0 ? s.cx : cxs[i - 1] ?? s.cx)) / 2
      const rx = Math.min(s.rx, below?.rx ?? s.rx) * 0.8 + 2 * g
      for (let y = Math.floor(yh - 3); y <= Math.ceil(yh + 3); y++) {
        for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
          const d = Math.hypot((x - cx) / rx, (y - yh) / (0.7 + (floor - roof) * 0.3))
          if (d > g) continue
          const isCore = Math.abs(y - yh) < 0.6 && Math.abs(x - cx) < rx * 0.6 * g
          glowOn(c, x, y, isCore ? 4 : d < g * 0.55 ? 2.4 : 0.9)
        }
      }
    })
    STONES.forEach((s, i) => {
      const cy = cys[i] ?? s.cy
      const cx = cxs[i] ?? s.cx
      const below = glow[i] ?? 0
      const above = i + 1 < STONES.length ? glow[i + 1] ?? 0 : 0
      const inside = (x: number, y: number) => ((x - cx) / s.rx) ** 2 + ((y - cy) / s.ry) ** 2 <= 1
      const underLight = (v: number) => below * ((v - 0.3) / 0.7) * 4.4
      for (let y = Math.floor(cy - s.ry); y <= Math.ceil(cy + s.ry); y++) {
        for (let x = Math.floor(cx - s.rx); x <= Math.ceil(cx + s.rx); x++) {
          if (!inside(x, y)) continue
          const u = (x - cx) / s.rx
          const v = (y - cy) / s.ry
          const nz = Math.sqrt(Math.max(0, 1 - u * u - v * v))
          const light = 0.3 * u - 0.8 * v + 0.45 * nz
          const edge = !inside(x, y + 1) ? -0.9 : !inside(x, y - 1) ? 0.5 : 0
          let color = shade(s.ramp, s.base + light * 1.9 + edge)
          const over = above * ((-v - 0.45) / 0.55) * 3.6
          if (underLight(v) > 0.6) color = shade(RIM, underLight(v))
          else if (over > 0.9) color = shade(RIM, over + 0.4)
          c.set(x, y, color)
        }
      }
      c.set(Math.round(cx + s.rx * 0.32), Math.round(cy - s.ry * 0.55), shade(s.ramp, s.base + 2.7))
      const a = turned(i, f)
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      const plot = (X: number, Y: number, Z: number, bright: number) => {
        const x = X * ca + Z * sa
        const z = -X * sa + Z * ca
        if (z < 0.2) return
        const px = Math.round(cx + x * (s.rx - 0.5))
        const py = Math.round(cy + Y * (s.ry - 0.5))
        if (underLight((py - cy) / s.ry) > 1.3) return
        c.set(px, py, shade(s.ramp, s.base + bright + (z < 0.5 ? -1 : 0) + (0.3 * x - 0.8 * Y) * 1.2))
      }
      for (const [X, Y, Z] of s.marks) plot(X, Y, Z, 2.2)
      if (s.ring) {
        const cb = Math.cos(s.ring)
        const sb = Math.sin(s.ring)
        for (let t = 0; t < TAU; t += 0.1) plot(Math.cos(t) * cb, Math.cos(t) * sb * 0.95 + Math.sin(t) * 0.3, Math.sin(t) * 0.95, 3.4)
      }
    })
    const hover = smoothstep(18, 26, f) * (1 - smoothstep(48, 58, f))
    for (const p of particles(f, LOOP, 14, 22, 2)) {
      if (p.r[3] > hover) continue
      const x = Math.round(32 + (p.r[1] - 0.5) * 26 + Math.sin(p.t * 0.3 + p.r[2] * 6) * 1.2)
      const y = Math.round(28 - p.age * 20 - p.r[2] * 4)
      c.set(x, y, HALO[p.age < 0.5 ? 5 : 4] ?? 0)
    }
    for (const [start, isLanding] of [[19, false], [56, true]] as const) {
      const t = f - start
      if (t < 0 || t > 6) continue
      for (const side of [-1, 1]) {
        if (isLanding) {
          const x = 32 + side * (11 + t * 0.7)
          c.set(x, 28 - Math.min(2, t * 0.6), shade(SAND, 5.6 - t * 0.5))
          if (t < 4) c.set(x - side, 29 - t * 0.4, shade(SAND, 5))
        } else {
          for (const k of [0, 1]) c.set(32 + side * (3 + k * 4), 29 + Math.min(1.6, t * 0.5) - k * 0.4, shade(SAND, 5.4))
        }
      }
    }
  })
}
export const scene: Scene = { verb: 'Levitating', render, hero: 38 }