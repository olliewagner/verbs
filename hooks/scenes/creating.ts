import { Canvas, beat, ease, hash, hex, lerp, mod, noise, shade, smoothstep, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const SPACE = hex('020208 04040e 070716 0b0a20 100e2a 16133a')
const NEBULA = hex('0b0a20 120f2e 1a133a 241846 301c4e')
const GAL = hex('0a0920 141236 201c52 2c2870 3c3a92 5252b2 6e74cc a0a8e4 ccd4f4 f4f6ff')
const CORE = hex('241228 4a2238 82403e b8683e e09a52 f6c47a ffe4ac fff6e2 ffffff')
const PINK = hex('4a1640 862a62 c4468a f07ab4 ffb4d8')
const STAR = hex('1a1a3a 3a3c6a 7076a8 b4bce0 f0f4ff')

const CX = 32
const CY = 16
const ANGLE = -0.22
const SQUASH = 0.42
const R_MAX = 27

const FLASH = [0, 0, 0, 0, 0, 1, 1.4, 1.35, 1, 0.65, 0.35, 0.15, 0.04]
const flashAt = (f: number) => FLASH[f] ?? 0

function radius(f: number): number {
  if (f < 6) return 0
  if (f < 28) return R_MAX * ease.out(beat(f, 6, 28))
  if (f < 54) return R_MAX
  return R_MAX * (1 - ease.in(beat(f, 54, 72)))
}

function wind(f: number): number {
  if (f < 28) return lerp(0.6, 4.2, ease.out(beat(f, 6, 28)))
  if (f < 54) return 4.2
  return lerp(4.2, 7, ease.in(beat(f, 54, 72)))
}

const ROT: number[] = (() => {
  const out: number[] = []
  let a = 0
  for (let f = 0; f < LOOP; f++) {
    const w = f < 6 ? 0 : f < 28 ? 0.04 + 0.32 * (1 - ease.out(beat(f, 6, 28))) : f < 54 ? 0.04 : 0.04 + 0.2 * ease.in(beat(f, 54, 72))
    a += w
    out.push(a)
  }
  return out
})()

function toPlane(x: number, y: number): [number, number] {
  const dx = x - CX
  const dy = y - CY
  const c = Math.cos(ANGLE)
  const s = Math.sin(ANGLE)
  return [dx * c + dy * s, (-dx * s + dy * c) / SQUASH]
}
function toScreen(gx: number, gy: number): [number, number] {
  const c = Math.cos(ANGLE)
  const s = Math.sin(ANGLE)
  const py = gy * SQUASH
  return [CX + gx * c - py * s, CY + gx * s + py * c]
}

function galaxyAt(x: number, y: number, r: number, rot: number, w: number): { core: number; arms: number } {
  if (r < 0.5) return { core: 0, arms: 0 }
  const [gx, gy] = toPlane(x, y)
  const rr = Math.hypot(gx, gy) / r
  if (rr > 1.25) return { core: 0, arms: 0 }
  const phi = Math.atan2(gy, gx)
  const core = 1.2 * Math.exp(-((rr / 0.15) ** 2)) + 0.45 * Math.exp(-((rr / 0.3) ** 2))
  const disc = 0.3 * Math.exp(-rr / 0.32) * (1 - smoothstep(0.6, 1.2, rr))
  const a = mod(phi - rot - w * rr, Math.PI)
  const dist = Math.abs(a - Math.PI / 2) / (Math.PI / 2)
  const envelope = smoothstep(0.06, 0.24, rr) * (1 - smoothstep(0.62, 1.15, rr))
  const arm = (1 - dist) ** (2.2 + 2.5 * rr) * envelope
  const dust = 0.3 * Math.exp(-(((a - Math.PI / 2 + 0.55) / 0.16) ** 2)) * envelope
  return { core, arms: Math.max(0, disc + arm * 0.95 - dust) }
}

type Spark = { rr: number; arm: number; offset: number; at: number; bright: number; isPink: boolean; phase: number }
const SPARKS: Spark[] = Array.from({ length: 40 }, (_, i) => {
  const rr = 0.2 + hash(i, 1) * 0.75
  return {
    rr,
    arm: hash(i, 2) < 0.5 ? 0 : 1,
    offset: (hash(i, 3) - 0.5) * 0.55,
    at: 12 + rr * 26 + hash(i, 4) * 6,
    bright: 0.4 + hash(i, 5) * 0.6,
    isPink: hash(i, 6) < 0.28,
    phase: hash(i, 7),
  }
})

function render(): Int32Array[] {
  const out: Int32Array[] = []

  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const flash = flashAt(f)
    const r = radius(f)
    const rot = ROT[f] ?? 0
    const w = wind(f)

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const n = noise(x * 0.09, y * 0.16, 0, 3) * 0.7 + noise(x * 0.2, y * 0.3, 0, 8) * 0.3
        const d = Math.hypot(x - CX, (y - CY) * 2) / 40
        const lit = flash * Math.max(0, 1 - d) * 2.4
        if (n > 0.52) c.set(x, y, shade(NEBULA, (n - 0.52) * 9 + lit, x, y))
        else c.set(x, y, shade(SPACE, 1.4 - Math.abs(y - CY) / 14 + lit * 0.8, x, y))
      }
    }
    for (let i = 0; i < 38; i++) {
      const x = Math.floor(hash(i, 21) * W)
      const y = Math.floor(hash(i, 22) * H)
      const b = hash(i, 23)
      const level = b * b * 3 + wave(f, LOOP, 1 + (i % 3), hash(i, 24)) * (b > 0.6 ? 0.8 : 0.3)
      if (level > 0.4) c.set(x, y, shade(STAR, level, x, y))
    }

    if (r > 0.5) {
      const fade = f < 54 ? 1 : 1 - beat(f, 62, 72) * 0.5
      const armFade = f < 54 ? 1 : 1 - beat(f, 62, 71)
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const g = galaxyAt(x, y, r, rot, w)
          if (g.core > 0.3 && g.core > g.arms * 0.8) c.set(x, y, shade(CORE, 1.6 + g.core * 5 * fade, x, y))
          else if (g.arms > 0.07) c.set(x, y, shade(GAL, 0.6 + g.arms * 9.5 * armFade, x, y))
        }
      }
    }

    if (f >= 6 && f < 22) {
      const k = f - 6
      const t = k / 15
      const ringR = 4 + 2.4 * k - 0.035 * k * k
      const alpha = (1 - t) ** 1.2
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const [gx, gy] = toPlane(x, y)
          const d = Math.hypot(gx, gy) - ringR
          if (d > -1.6 && d < 0.9) c.set(x, y, shade(GAL, 0.3 + alpha * 8.1, x, y))
          else if (d > -4 && d <= -1.6 && alpha > 0.4) c.set(x, y, shade(GAL, 1 + alpha * 2.6 + (d + 1) * 0.3, x, y))
        }
      }
    }

    for (const s of SPARKS) {
      const age = f - s.at
      if (age < 0 || r < 4 || f >= 68) continue
      const phi = rot + w * s.rr + Math.PI / 2 + s.arm * Math.PI + s.offset
      const [x, y] = toScreen(Math.cos(phi) * s.rr * r, Math.sin(phi) * s.rr * r)
      const ix = Math.round(x)
      const iy = Math.round(y)
      const fading = f < 54 ? 1 : 1 - beat(f, 54, 67)
      if (age < 1) {
        c.set(ix, iy, 0xffffff)
        for (const [ox, oy] of [[1, 0], [-1, 0]] as const) c.set(ix + ox, iy + oy, STAR[3] ?? 0)
        continue
      }
      const tw = wave(f, LOOP, 3, s.phase) * 0.35
      const level = (s.bright + tw) * fading
      if (level < 0.25) continue
      if (s.isPink) {
        c.set(ix, iy, shade(PINK, 1 + level * 3.4, ix, iy))
        if (level > 0.5) c.set(ix + 1, iy, shade(PINK, level * 2.6, ix, iy))
      } else c.set(ix, iy, shade(STAR, 1.2 + level * 3, ix, iy))
    }

    const point = [1, 0.7, 0.45, 0.55, 0.85, 0][f] ?? (f >= 70 ? ([0.5, 0.85][f - 70] ?? 0) : 0)
    if (point > 0) {
      c.set(CX, CY, shade(CORE, 4.6 + point * 3.4, CX, CY))
      for (const [ox, oy, k] of [[1, 0, 1], [-1, 0, 1], [0, 1, 0.6], [0, -1, 0.6]] as const) {
        c.set(CX + ox, CY + oy, shade(CORE, k * point * 3.2, 0, 0))
      }
    }
    if (flash > 0) {
      const rad = 1.5 + flash * 3.4
      c.ellipse(CX, CY, rad * 1.6, rad * 1.1, (x, y) => {
        const d = Math.hypot((x - CX) / 1.6, (y - CY) / 1.1) / rad
        const level = 1.2 + (1 - d) ** 1.4 * (4.4 + flash * 2.2)
        return shade(CORE, Math.min(8, level), x, y)
      })
    }

    out.push(c.px)
  }

  return out
}

export const scene: Scene = {
  verb: 'Creating',
  render,
  hero: 40,
  snaps: [{ frames: [5, 10], box: [19, 9, 45, 23], colors: [...CORE, ...GAL], why: 'the point flares white, and the shock ring bursts out from behind the glow as it shrinks' }],
}
