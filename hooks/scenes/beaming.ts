import { Canvas, TAU, hash, hex, mod, noise, particles, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 60

const SKY = hex('04060c 080c16 0d1320 131b2c 1a2438 232f45 2d3b53 3a4961')
const SEA = hex('020509 050c15 09141f 0e1d2b 142839 1c364a 27475d 3a5d73 5a7d90')
const ROCK = hex('040407 0a090e 121018 1b1822 26212d 332c39 433946 5a4b57 7a6670')
const WHITE = hex('15171f 262a36 3c4150 585f70 7c8394 a5abb8 d0d4da f2f1ec')
const RED = hex('14070b 260b10 3e1016 5c171c 802322 a63328 cc4a32')
const SPRAY = hex('101a26 1d2b3b 2f4357 4a6178 6e879c 9ab0c0 c8d7df eef5f6 ffffff')
const LAMP = hex('6a5a3a a88c52 dcbc6e f6e09a fff4cc fffdf0')
const BEAM = 0xfff1c4
const AIR = hex('2c2f38 45464a 625f58 847d68 a89e7e cbbf98 e9ddb4 fff1c4 ffffff')

const INKS = [...SKY, ...SEA, ...ROCK, ...WHITE, ...RED, ...SPRAY, ...LAMP, ...AIR]
const snapped = new Map<number, number>()
function snap(color: number): number {
  const known = snapped.get(color)
  if (known !== undefined) return known
  const [r, g, b] = [(color >> 16) & 255, (color >> 8) & 255, color & 255]
  let best = 0
  let bestD = Infinity
  for (const ink of INKS) {
    const d = 3 * (((ink >> 16) & 255) - r) ** 2 + 4 * (((ink >> 8) & 255) - g) ** 2 + 2 * ((ink & 255) - b) ** 2
    if (d < bestD) [best, bestD] = [ink, d]
  }
  snapped.set(color, best)
  return best
}

const LX = 40
const LY = 5
const HORIZON = 18

const FACE = 30

const heading = (f: number) => (TAU * (f - FACE)) / LOOP

function beamAt(theta: number, x: number, y: number): number {
  const s = Math.sin(theta)
  const c = Math.cos(theta)
  const dx = x - LX
  const den = 60 * s + dx * c
  if (Math.abs(den) < 1e-6) return 0
  const t = dx / den
  if (t <= 0.02 || t > 3.5 || 1 - t * c < -0.01) return 0
  const depth = Math.max(0.38, 1 - t * c)
  const half = (60 * (0.014 + t * 0.085)) / depth
  const q = Math.abs(y - LY) / half
  if (q > 1) return 0
  const fade = Math.exp(-t * 0.35) * (0.7 + 0.3 * Math.max(0, c) ** 2)
  return fade * (q < 0.3 ? 1 : q < 0.65 ? 0.66 : 0.36)
}

const beamBand = (b: number) => (b > 0.55 ? 0.5 : b > 0.3 ? 0.32 : b > 0.12 ? 0.17 : 0)

const flareOf = (theta: number) => Math.max(0, Math.cos(theta)) ** 10

function rockTop(x: number): number {
  const pts: [number, number][] = [[21, 27], [25, 24.5], [28, 23], [32, 22], [35, 21.5], [45, 21.5], [48, 22.5], [52, 21], [56, 21.5], [60, 22.5], [64, 23]]
  if (x < 21) return 99
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i] ?? [0, 0]
    const [bx, by] = pts[i + 1] ?? [0, 0]
    if (x >= ax && x <= bx) return ay + ((x - ax) / (bx - ax)) * (by - ay) + (hash(x, 7) - 0.5) * 0.9
  }
  return 23
}

function nearTop(x: number): number {
  if (x >= 44) return Math.min(31.5, 26 + Math.abs(x - 54) * 0.28 + (x < 50 ? (50 - x) * 0.7 : 0) + (hash(x, 3) - 0.5) * 0.8)
  if (x <= 10) return 27.5 + Math.abs(x - 4) * 0.35 + (hash(x, 5) - 0.5) * 0.8
  return 99
}

type Splash = { x: number; y: number; t0: number; blobs: number; drops: number; power: number; seed: number }
const SPLASHES: Splash[] = [
  { x: 27, y: 24, t0: 23, blobs: 11, drops: 14, power: 1, seed: 11 },
  { x: 24, y: 25, t0: 50, blobs: 5, drops: 5, power: 0.55, seed: 23 },
]

function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const theta = heading(f)
    const flare = flareOf(theta)
    const beam = (x: number, y: number) => beamAt(theta, x, y)
    const lightOn = (x: number, y: number) =>
      0.15 + flare * 1.1 * Math.max(0.35, 1 - Math.hypot(x - LX, y - LY) / 70) + Math.max(0, 1 - Math.hypot(x - LX, (y - LY) * 1.4) / 9) * 0.6

    const p = f / LOOP
    for (let y = 0; y < HORIZON; y++) {
      for (let x = 0; x < W; x++) {
        const d =
          0.5 +
          0.2 * Math.sin(TAU * ((2 * x) / W + p) + y * 0.42) +
          0.15 * Math.sin(TAU * ((3 * x) / W + p) - y * 0.6 + 1.3) +
          0.1 * Math.sin(TAU * ((1 * x) / W + p) + y * 0.25 + 2.1) +
          (noise(x * 0.12, y * 0.3, 0, 4) - 0.5) * 0.2
        const sky = 1 + Math.floor(y / 4) * 0.8
        const level = d > 0.66 ? sky - 1.4 : d > 0.53 ? sky - 0.6 : d > 0.49 ? sky + 0.7 : sky
        c.set(x, y, shade(SKY, level, x, y))
      }
    }

    for (let y = HORIZON; y < H; y++) {
      const depth = (y - HORIZON) / (H - HORIZON)
      for (let x = 0; x < W; x++) {
        const kx = 0.22 + (1 - depth) * 0.45
        const crest = Math.sin(x * kx + y * 2.3 - TAU * p * 3 + Math.sin(x * 0.09 + y * 1.7) * 1.4)
        const isCrest = crest > 0.8 - depth * 0.1
        const level = 3.2 - depth * 2.2 + (isCrest ? 1.1 + depth * 0.4 : 0)
        c.set(x, y, shade(SEA, level, x, y))
        const isPath = Math.abs(x - LX) < 1 + (y - HORIZON) * 0.45
        if (isPath && isCrest && flare > 0.08) c.set(x, y, shade(LAMP, flare * 6 - depth * 2.5, x, y))
      }
    }
    for (let x = 0; x < W; x++) c.set(x, HORIZON, shade(SEA, 3.8 + flare * 2, x, HORIZON))

    if (Math.cos(theta) <= 0) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) c.tint(x, y, BEAM, beamBand(beam(x, y)) * 0.8)
    }

    const swell = mod(f - 11, LOOP)
    if (swell < 13) {
      const sx = 3 + swell * 1.9
      const lift = swell > 9 ? 2 : swell > 5 ? 1 : 0
      for (let x = Math.round(sx - 8); x <= Math.round(sx); x++) {
        const y = 25 - lift + (x < sx - 5 ? 1 : 0)
        const isLip = x > sx - 2
        c.set(x, y, shade(SPRAY, 2.6 + lightOn(x, y) * 3 + (isLip ? 1.2 : 0), x, y))
        c.set(x, y + 1, shade(SEA, 3.6, x, y + 1))
        c.set(x, y + 2, shade(SEA, 0.8, x, y + 2))
      }
    }

    for (let x = 0; x < W; x++) {
      const top = rockTop(x)
      for (let y = Math.round(top); y < H; y++) {
        const facet = noise(x * 0.4, y * 0.6, 0, 9) > 0.55 ? 0.6 : noise(x * 0.3, y * 0.5, 1, 9) < 0.35 ? -0.5 : 0
        const rim = y === Math.round(top) ? 1.2 : y === Math.round(top) + 1 ? 0.4 : 0
        const l = lightOn(x, y)
        c.set(x, y, shade(ROCK, 1.6 + facet + rim * (0.6 + l) + l * 2.2 - (y - top) * 0.12, x, y))
      }
    }
    for (let x = 21; x < 33; x++) {
      const y = Math.round(rockTop(x))
      const churn = Math.sin(x * 1.1 + f * 0.6) + Math.sin(x * 0.5 - f * 0.3)
      if (churn > 0.4) c.set(x - 1, y, shade(SPRAY, 2.2 + churn + lightOn(x, y) * 3, x, y))
    }

    for (let y = 18; y <= 21; y++) {
      for (let x = 49; x <= 56; x++) {
        if (y === 18 && (x === 49 || x === 56)) continue
        const l = lightOn(x, y)
        c.set(x, y, y <= 19 ? shade(RED, 1.6 + l * 2.5 + (y === 18 ? 1 : 0), x, y) : shade(WHITE, 1.4 + l * 3 - (x > 54 ? 0.6 : 0), x, y))
      }
    }
    c.set(52, 20, LAMP[2] ?? 0)
    c.set(53, 20, LAMP[1] ?? 0)

    for (let y = 9; y <= 21; y++) {
      const half = 2.4 + ((y - 9) / 12) * 1.6
      for (let x = Math.round(LX - half); x <= Math.round(LX + half); x++) {
        const u = (x - LX) / half
        const form = u < -0.45 ? 0.9 : u > 0.5 ? -0.9 : 0
        const isRed = (y >= 12 && y <= 14) || (y >= 18 && y <= 20)
        c.set(x, y, shade(isRed ? RED : WHITE, 1.4 + form + lightOn(x, y) * 3.2 - (y === 9 ? 0.6 : 0), x, y))
      }
    }
    for (const wy of [11, 16]) c.set(LX, wy, LAMP[1] ?? 0)
    c.set(LX, 21, ROCK[0] ?? 0)
    c.set(LX, 20, ROCK[1] ?? 0)

    for (let x = 36; x <= 44; x++) c.set(x, 8, shade(ROCK, 2.4 + lightOn(x, 8) * 3, x, 8))
    for (let x = 37; x <= 43; x++) c.set(x, 7, x % 2 ? shade(ROCK, 3 + lightOn(x, 7) * 2, x, 7) : shade(LAMP, 1 + flare * 3, x, 7))
    for (let y = 4; y <= 6; y++) {
      for (let x = 38; x <= 42; x++) {
        const isFrame = x === 38 || x === 42
        const core = Math.max(0, 1 - Math.hypot(x - LX, y - LY) / 2.2)
        c.set(x, y, isFrame ? shade(ROCK, 2 + flare * 4, x, y) : shade(LAMP, 2.4 + core * 3 + flare * 2, x, y))
      }
    }
    for (let x = 38; x <= 42; x++) c.set(x, 3, shade(RED, 2 + (x < 40 ? 1 : 0) + flare * 3, x, 3))
    for (let x = 39; x <= 41; x++) c.set(x, 2, shade(RED, 1.6 + (x === 39 ? 1 : 0) + flare * 3, x, 2))
    c.set(LX, 1, ROCK[3] ?? 0)

    for (const sp of SPLASHES) {
      const t = mod(f - sp.t0, LOOP)
      if (t > 20) continue
      for (let i = 0; i < sp.blobs + sp.drops; i++) {
        const r0 = hash(i, sp.seed)
        const r1 = hash(i, sp.seed, 1)
        const tt = t - Math.floor(hash(i, sp.seed, 2) * 3)
        if (tt < 0) continue
        const isDrop = i >= sp.blobs
        const vy = (isDrop ? 2.1 + r0 * 1.3 : 1.2 + r0 * 1.6) * sp.power
        const vx = (r1 - 0.62) * (isDrop ? 2.2 : 0.9)
        const x = sp.x + vx * tt
        const y = sp.y - 1 - vy * tt + 0.11 * tt * tt
        if (y > sp.y + 1 || tt > 17) continue
        const l = lightOn(x, y) + beam(x, y) * 0.8
        const sink = Math.min(1, Math.max(0, (sp.y + 1 - y) / 3))
        const radius = isDrop ? 0 : (0.6 + 1.5 * Math.sin(Math.PI * Math.min(1, tt / 12))) * (0.6 + sp.power * 0.5) * sink
        if (radius < 0.75) {
          c.set(x, y, shade(SPRAY, 2.2 + l * 4.4 - tt * 0.05, x, y))
          continue
        }
        c.disc(x, y, radius, (px, py) => {
          const d = Math.hypot(px - x, py - y) / radius
          return shade(SPRAY, 2.4 + l * 4 + (py < y ? 0.6 : 0) - (d > 0.7 ? 0.8 : 0), px, py)
        })
      }
    }

    for (let x = 0; x < W; x++) {
      const top = nearTop(x)
      for (let y = Math.round(top); y < H; y++) {
        const rim = y === Math.round(top) ? 0.6 + flare * 3.4 : 0
        const facet = noise(x * 0.5, y * 0.7, 2, 9) > 0.6 ? 0.5 : 0
        c.set(x, y, shade(ROCK, 0.6 + facet + rim, x, y))
      }
    }
    for (let x = 0; x < W; x++) {
      const top = nearTop(x)
      if (top > 31 || top < 26) continue
      const churn = Math.sin(x * 0.9 - f * 0.4 + 2) + Math.sin(x * 0.4 + f * 0.2)
      if (churn > 0.8) c.set(x, Math.round(top) - 1, shade(SPRAY, 2 + churn * 0.8 + flare * 3, x, top))
    }

    if (Math.cos(theta) > 0) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) c.tint(x, y, BEAM, beamBand(beam(x, y)))
    }

    for (const d of particles(f, LOOP, 200, 7, 5)) {
      const x = d.r[0] * 92 - 4 - d.t * 1.5
      const y = -2 + d.r[1] * 3 + d.t * 4.6
      const b = beam(x, y) * 1.3
      const lit = b + flare * 0.8 * d.r[2]
      if (lit < 0.2) continue
      const ramp = b > flare ? LAMP : SPRAY
      const top = ramp.length - 1
      c.set(x, y, shade(ramp, top - 2.6 + lit * 2.4, x, y))
      if (lit > 0.45) c.set(x + 0.5, y - 1.5, shade(ramp, top - 3.6 + lit * 2, x, y))
    }

    if (flare > 0.02) {
      const reach = 3 + 13 * flare
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const g = flare * Math.max(0, 1 - Math.hypot(x - LX, (y - LY) * 1.25) / reach)
          const band = g > 0.62 ? 0.95 : g > 0.36 ? 0.6 : g > 0.14 ? 0.3 : g > 0.04 ? 0.12 : 0
          if (band > 0) c.tint(x, y, g > 0.62 ? 0xffffff : BEAM, band)
        }
      }
      const len = 6 + 58 * flare
      for (let x = 0; x < W; x++) {
        const k = 1 - Math.abs(x - LX) / len
        if (k <= 0) continue
        const a = Math.round(k * flare * 4) / 4
        c.tint(x, LY, 0xffffff, a)
        c.tint(x, LY - 1, BEAM, a * 0.3)
        c.tint(x, LY + 1, BEAM, a * 0.3)
      }
      for (let y = 0; y < H; y++) {
        const k = 1 - Math.abs(y - LY) / (2 + 9 * flare)
        if (k > 0) c.tint(LX, y, 0xffffff, Math.round(k * flare * 4) / 4)
      }
    }

    out.push(c.px.map(snap))
  }

  return out
}

export const scene: Scene = {
  verb: 'Beaming',
  render,
  hero: 27,
  snaps: [
    { frames: 3, box: [27, LY - 2, LX - 3, LY + 3], why: 'the beam swings out from behind the lamp, lengthening fast as it turns side-on' },
    { frames: 7, box: [2, LY - 2, 7, LY + 1], why: 'the far end of the beam sweeps out to the edge of the picture, several pixels a frame' },
    { frames: [FACE - 5, FACE + 5], why: 'the lamp turns to face us: its flare lights the whole picture and the beam sweeps across us, rising and fading over the turn' },
  ],
}
