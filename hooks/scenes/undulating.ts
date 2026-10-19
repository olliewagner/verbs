import { Canvas, TAU, clamp, ease, frames, hash, hex, mix, mod, particles, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 48

const WATER = hex('03050f 050a1c 08112c 0b1a3e 0f2451 152f64 1d3c77 284c8a')
const PINK = hex('1c0a30 3a1254 6a1d7c a02c98 d24fb2 f287cc ffc2e4 fff0f8')
const CYAN = hex('061a30 0b324c 12536a 1b7b8a 2aa8a8 5cd2c2 a4eedb e8fff4')
const VIOLET = hex('0d0b2a 1a1748 2a2468 3c3488 52489f 6f64ba 9488d4')
const SNOW = hex('34477a 5a6f9e 92a6cc')

type Jelly = {
  x: number
  y: number
  rx: number
  ry: number
  period: number
  phase: number
  rise: number
  ramp: readonly number[]
  glow: number
  far: number
  tentacles: number
  length: number
  arms: number
}

const JELLIES: Jelly[] = [
  { x: 37, y: 25, rx: 3.2, ry: 2.6, period: 12, phase: 0.35, rise: 1, ramp: VIOLET, glow: 0x5a50c0, far: 1.2, tentacles: 3, length: 6, arms: 0 },
  { x: 50, y: 11, rx: 5.2, ry: 4.6, period: 16, phase: 0.55, rise: 2, ramp: CYAN, glow: 0x2a9ca8, far: 0, tentacles: 4, length: 15, arms: 2 },
  { x: 20, y: 14, rx: 8.2, ry: 7.2, period: 24, phase: 0, rise: 2, ramp: PINK, glow: 0xb03c9c, far: 0, tentacles: 5, length: 20, arms: 2 },
]

const squeeze = (t: number) => (t < 0.2 ? ease.out(t / 0.2) : 1 - ease.inOut((t - 0.2) / 0.8))
const lift = (t: number) => (t < 0.38 ? ease.out(t / 0.38) : 1 - ease.inOut((t - 0.38) / 0.62))

type Pose = { t: number; s: number; x: number; y: number; rx: number; ry: number }

function pose(j: Jelly, f: number): Pose {
  const t = mod(f / j.period + j.phase, 1)
  const s = squeeze(t)

  return {
    t,
    s,
    x: j.x + Math.sin(TAU * (f / LOOP + j.phase)) * 0.8,
    y: j.y - j.rise * lift(t),
    rx: j.rx * (1 - 0.2 * s),
    ry: j.ry * (1 + 0.16 * s),
  }
}

function water(x: number, y: number, f: number): number {
  const along = x + y * 0.6
  const shaft = Math.sin(along * 0.2 + Math.sin(TAU * (f / LOOP)) * 0.5) + 0.6 * Math.sin(along * 0.47 + 1.3)
  const lit = shaft > 1.05 ? clamp(1 - y / 24) * 1.1 : 0

  return 4.6 - y * 0.14 + lit
}

function drawTentacles(c: Canvas, j: Jelly, f: number, now: Pose): void {
  for (let i = 0; i < j.tentacles; i++) {
    const u = j.tentacles === 1 ? 0 : -0.85 + (1.7 * i) / (j.tentacles - 1)
    const length = Math.round(j.length * (0.72 + 0.28 * hash(i, j.period)))
    let prev: [number, number] | undefined
    for (let k = 0; k <= length; k++) {
      const fd = f - k * 0.9
      const p = pose(j, fd)
      const along = k / j.length
      const sway = Math.sin(TAU * (fd / j.period) - k * 0.36 + i * 0.55) + 0.4 * Math.sin(TAU * (fd / LOOP) * 2 - k * 0.2 + i * 0.4)
      const x = p.x + u * p.rx * 0.85 + u * k * 0.16 * (1 - p.s) + sway * along * 2.4
      const y = Math.round(p.y) + 1 + k * (0.92 + 0.14 * p.s)
      const level = 0.7 + 3.2 * (1 - along) ** 1.5 + now.s * 0.7 - j.far
      const pt: [number, number] = [Math.round(x), Math.round(y)]
      if (prev) c.line(prev[0], prev[1], pt[0], pt[1], shade(j.ramp, level))
      prev = pt
    }
  }
  for (let a = 0; a < j.arms; a++) {
    const off = (a - (j.arms - 1) / 2) * 2.6
    const len = Math.round(j.length * 0.5)
    for (let k = 0; k <= len; k++) {
      const fd = f - k * 0.8
      const p = pose(j, fd)
      const along = k / len
      const x = Math.round(p.x + off + Math.sin(TAU * (fd / j.period) - k * 0.6 + a * 2.4) * along * 1.1)
      const y = Math.round(p.y) + 1 + k
      const frill = (k + a) % 3 === 0 ? 1 : 0
      const level = 2.4 + 3 * (1 - along) + now.s * 0.6
      c.set(x, y, shade(j.ramp, level + frill * 0.6))
      const out = off < 0 ? -1 : 1
      if (frill && k > 1) c.set(x + out, y, shade(j.ramp, level - 0.8))
    }
  }
}

function drawBell(c: Canvas, j: Jelly, p: Pose): void {
  const bx = Math.round(p.x)
  const by = Math.round(p.y)
  const width = (v: number) => p.rx * Math.sqrt(1 - v * v) * (1 - 0.34 * p.s * (1 - v) ** 2)
  const inside = (x: number, y: number) => {
    const v = (by - y) / (p.ry + 0.5)
    return v >= 0 && v <= 1 && Math.abs(x - bx) <= width(v) + 0.2
  }
  for (let y = by - Math.ceil(p.ry) - 1; y <= by; y++) {
    for (let x = bx - Math.ceil(p.rx) - 1; x <= bx + Math.ceil(p.rx) + 1; x++) {
      if (!inside(x, y)) continue
      const v = (by - y) / (p.ry + 0.5)
      const across = (x - bx) / (width(v) + 0.2)
      const isEdge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1)
      let level: number
      if (y === by) {
        level = 4.2 + ((x - bx) % 2 === 0 ? 1.4 : 0) + p.s * 1.4
      } else if (isEdge) {
        level = 4.6 + (across < 0 ? 0.7 : 0) + p.s * 0.8
      } else {
        const canal = j.rx > 4 && [-0.66, -0.22, 0.22, 0.66].some(k => Math.abs(across - k) < 0.09)
        const gleam = across < -0.15 && across > -0.7 && v > 0.62 && v < 0.88
        level = 2.4 + v * 1.4 + (canal ? 1.1 : 0) + (gleam ? 2.2 : 0) + p.s * 0.6
      }
      c.set(x, y, shade(j.ramp, level - j.far, x, y))
    }
  }
}

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const poses = JELLIES.map(j => pose(j, f))

    c.fill((x, y) => {
      let base = shade(WATER, water(x, y, f), x, y)
      let best = 0
      let tint = 0
      JELLIES.forEach((j, n) => {
        const p = poses[n]
        if (!p) return
        const d = Math.hypot(x - p.x, (y - (p.y - p.ry * 0.45)) * 1.25)
        const reach = p.rx * 2.4 + 3
        const h = (0.55 + 0.45 * p.s) * Math.max(0, 1 - d / reach) ** 2 * (j.far > 0 ? 0.5 : 1)
        if (h > best) {
          best = h
          tint = j.glow
        }
      })
      const band = best > 0.42 ? 2 : best > 0.14 ? 1 : 0
      if (band) base = shade(WATER, water(x, y, f) + band * 0.9, x, y)
      if (band === 2) base = mix(base, tint, 0.18)
      return base
    })

    for (const s of particles(f, LOOP, 16, LOOP, 3)) {
      const x = Math.round(s.r[0] * 66 - 1 + Math.sin(s.t * 0.13 + s.r[1] * 6))
      const y = Math.round(s.r[2] * 30 - 2 + s.t * (0.08 + s.r[3] * 0.05))
      const a = Math.sin(s.age * Math.PI)
      if (a > 0.3) c.set(x, y, shade(SNOW, a > 0.7 ? 1 : 0))
    }

    JELLIES.forEach((j, n) => {
      const p = poses[n]
      if (!p) return
      drawTentacles(c, j, f, p)
      drawBell(c, j, p)
    })

    for (const s of particles(f, LOOP, 7, LOOP, 9)) {
      const x = Math.round(s.r[0] * 66 - 1 + Math.sin(s.t * 0.11 + s.r[1] * 6) * 1.5)
      const y = Math.round(s.r[2] * 26 - 2 + s.t * (0.16 + s.r[3] * 0.06))
      const a = Math.sin(s.age * Math.PI)
      if (a > 0.25) c.set(x, y, shade(SNOW, a > 0.6 ? 2 : 1))
    }
  })
}

export const scene: Scene = { verb: 'Undulating', render, hero: 20 }
