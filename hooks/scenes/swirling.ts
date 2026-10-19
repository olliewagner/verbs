import { TAU, clamp, frames, hash, hex, mod, particles, shade, smoothstep, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 48

const SKY = hex('0a1235 101d55 172a72 1f398c 2a4ca4 3b64b8 5784c8 7ea6d8 b0cde4 e4efe6')
const HALO = hex('4f7cc0 86b0c8 c4d6a4 eedf7c fbefb0 fffbe6')
const MOON = hex('b8662a e0952e f5c445 fbe58c fff8d8')
const CYPRESS = hex('05080a 0b120f 121c15 1a2919 25361e 334725 475b2c 66783a')
const HILL = hex('091229 0f1c40 172a56 213a6c 2d4b7e')
const WALL = hex('0e1430 18223f 233253 31456a')
const ROOF = hex('080b1c 0e1430 182246')
const LAMP = hex('c0692a f2b23e fde58a')
const BUSH = hex('04080a 08120f 0e1d17 152a1f 1f3a26')
const SMOKE = hex('3a4a78 56689a 7c8eb8')

const turn = (f: number) => f / LOOP - (0.5 / TAU) * Math.sin((TAU * f) / LOOP)
const gust = (f: number) => (1 - Math.cos((TAU * f) / LOOP)) / 2

type Vortex = { x: number; y: number; rx: number; ry: number; spin: number; pitch: number }
const VORTICES: Vortex[] = [
  { x: 34, y: 8.5, rx: 11.5, ry: 7.5, spin: 1, pitch: 4.6 },
  { x: 18.5, y: 6, rx: 6, ry: 4.5, spin: -1, pitch: 3.4 },
]

type Star = { x: number; y: number; r: number; phase: number }
const STARS: Star[] = [
  { x: 48, y: 15, r: 3.8, phase: 0 },
  { x: 14.5, y: 13.5, r: 3, phase: 0.35 },
  { x: 23, y: 15.5, r: 2.4, phase: 0.6 },
  { x: 59, y: 16.5, r: 2.4, phase: 0.8 },
  { x: 3, y: 3, r: 2.4, phase: 0.2 },
  { x: 47, y: 2, r: 2.2, phase: 0.5 },
]
const MOON_X = 57
const MOON_Y = 6

const hill = (x: number) => 19.6 + 1.5 * Math.sin(x * 0.11 + 0.5) + 0.8 * Math.sin(x * 0.29 + 2)
const bushTop = (x: number) => 28.6 + 0.9 * Math.sin(x * 0.55) + 0.6 * Math.sin(x * 1.3 + 1)

const GROUND = 28
const HOUSES: readonly (readonly [number, number, number, number])[] = [
  [16, 5, 3, 2], [22, 4, 2, 2], [27, 6, 3, 2], [34, 4, 3, 2], [45, 3, 2, 2], [49, 5, 3, 2], [55, 4, 2, 2], [59, 6, 3, 3],
]
const CHURCH_X = 39

function sky(x: number, y: number, f: number): number {
  const g = gust(f)
  const spin = turn(f)
  for (const v of VORTICES) {
    const u = (x - v.x) / v.rx
    const w = (y - v.y) / v.ry
    const r = Math.hypot(u, w)
    if (r > 1) continue
    const theta = Math.atan2(w, u) - v.spin * TAU * spin
    const s = r * v.rx + v.spin * (theta / TAU) * v.pitch
    const band = Math.floor(s / (v.pitch / 2))
    const isLight = mod(band, 2) === 0
    const dash = Math.floor(mod(theta / TAU, 1) * 7 + (isLight ? 0 : 3.5))
    if (r > 0.93) return 2
    if (r < 0.16) return 8.6 + g * 0.6
    const fade = r > 0.74 ? 1 : 0
    const stroke = hash(1, mod(dash, 7), v.spin)
    return isLight ? 7.2 - fade * 2 + (stroke > 0.5 ? 0.8 : 0) + g * 0.8 : 3.6 - fade * 0.8
  }
  const psi = y + 1.5 * Math.sin(x * 0.13 + 0.6) + 0.8 * Math.sin(x * 0.31 + y * 0.45)
  const band = Math.floor(psi / 2)
  const len = 4 + Math.floor(hash(band, 9) * 3)
  const shift = turn(f) * len * 3
  const dash = Math.floor((x - shift) / len + hash(band, 5) * 3)
  const stroke = hash(band, mod(dash, 3))
  const near = Math.hypot(x - MOON_X, y - MOON_Y) < 11 ? 1 : 0
  return 2.4 + (stroke > 0.6 ? 1.2 : stroke > 0.3 ? 0.5 : 0) + (stroke > 0.88 ? 1.6 : 0) + near + g * 0.3
}

function ringColor(d: number, reach: number, pulse: number, g: number): number {
  const ring = Math.floor(d / 1.3 - pulse)
  const h = 1 - ((ring + pulse + 0.5) * 1.3) / reach + g * 0.15
  return mod(ring, 2) === 0 ? shade(HALO, 1.6 + h * 3.4) : shade(SKY, 4.4 + h * 4)
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const g = gust(f)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const top = hill(x)
        if (y < top) {
          c.set(x, y, shade(SKY, sky(x, y, f)))
          continue
        }
        const band = Math.floor((y - top) / 1.6)
        const stroke = hash(band, Math.floor((x + band * 3) / 4))
        c.set(x, y, shade(HILL, 3.4 - band * 0.7 + (stroke > 0.6 ? 0.7 : 0) + (y - top < 1 ? 0.6 : 0)))
      }
    }
    for (const s of STARS) {
      const pulse = 2 * turn(f) + s.phase
      for (let y = Math.floor(s.y - s.r); y <= Math.ceil(s.y + s.r); y++) {
        for (let x = Math.floor(s.x - s.r); x <= Math.ceil(s.x + s.r); x++) {
          if (y >= hill(x)) continue
          const d = Math.hypot(x - s.x, y - s.y)
          if (d > s.r) continue
          const core = s.r * 0.28
          if (d <= core) {
            c.set(x, y, HALO[5] ?? 0)
            continue
          }
          c.set(x, y, ringColor(d - core, s.r - core, pulse, g))
        }
      }
    }
    const moonPulse = turn(f) * 2
    for (let y = 0; y < 15; y++) {
      for (let x = 46; x < W; x++) {
        const d = Math.hypot(x - MOON_X, y - MOON_Y)
        if (d <= 3.9) {
          const isLit = Math.hypot(x - MOON_X + 1.7, y - MOON_Y + 1.2) > 3.3
          c.set(x, y, isLit ? shade(MOON, x - MOON_X > 1.5 ? 1 : 2) : HALO[3] ?? 0)
          continue
        }
        if (d < 8.3) c.set(x, y, ringColor(d - 3.9, 4.4, moonPulse, g))
      }
    }
    for (const [hx, hw, wall, roof] of HOUSES) {
      for (let j = 0; j < wall; j++) {
        for (let i = 0; i < hw; i++) {
          const x = hx + i
          const y = GROUND - 1 - j
          c.set(x, y, shade(WALL, 1.4 + (i === hw - 1 ? 1.2 : i / hw)))
        }
      }
      for (let j = 0; j < roof; j++) {
        const y = GROUND - wall - 1 - j
        const inset = Math.round(((j + 1) / (roof + 1)) * (hw / 2))
        for (let x = hx - 1 + inset; x <= hx + hw - inset; x++) c.set(x, y, shade(ROOF, j === roof - 1 ? 2 : x > hx + hw / 2 ? 1 : 0))
      }
      for (let i = 1; i < hw - 1; i += 2) {
        if (hash(hx, i) < 0.65) c.set(hx + i, GROUND - 2, shade(LAMP, 1 + hash(hx, i, 2) + (hash(hx, i, Math.floor(f / 6)) > 0.92 ? -1 : 0)))
      }
    }
    for (let y = 21; y < GROUND; y++) for (let x = CHURCH_X; x < CHURCH_X + 5; x++) c.set(x, y, shade(WALL, x === CHURCH_X + 4 ? 2.6 : 1.4))
    for (let x = CHURCH_X - 1; x <= CHURCH_X + 5; x++) c.set(x, 20, shade(ROOF, 1))
    for (let x = CHURCH_X; x <= CHURCH_X + 4; x++) c.set(x, 19, shade(ROOF, 1))
    for (let y = 16; y <= 18; y++) for (let x = CHURCH_X + 1; x <= CHURCH_X + 3; x++) c.set(x, y, shade(WALL, x === CHURCH_X + 3 ? 2 : 1))
    for (let y = 10; y <= 15; y++) c.set(CHURCH_X + 2, y, shade(ROOF, y < 13 ? 2 : 1))
    c.set(CHURCH_X + 2, 24, LAMP[2] ?? 0)
    c.set(CHURCH_X + 2, 25, LAMP[1] ?? 0)
    c.set(30, 23, shade(ROOF, 1))
    c.set(30, 22, shade(ROOF, 2))
    for (const p of particles(f, LOOP, 8, 20, 3)) {
      const x = 30 + p.age * (7 + 7 * g) + Math.sin(p.t * 0.5 + p.r[0] * 6) * 0.6
      const y = 21 - p.age * 5 + p.age * p.age * 2
      if (p.age < 0.85) c.set(x, y, shade(SMOKE, 2.4 - p.age * 2.6))
    }
    for (let x = 0; x < W; x++) {
      const top = bushTop(x)
      for (let y = Math.ceil(top); y < H; y++) c.set(x, y, shade(BUSH, y - top < 1 ? 3.2 - (x % 7 === 0 ? 1 : 0) : 1.6 - (y - top) * 0.3))
    }
    for (const [tx, ty, tr] of [[25.5, 26, 2.2], [43, 25.5, 2], [53, 26.5, 1.8]] as const) {
      c.ellipse(tx, ty, tr, tr * 1.4, (x, y) => shade(BUSH, 2 + (x > tx ? 1 : 0) - (y > ty ? 1 : 0)))
    }
    drawCypress(c, f)
  })
}
function drawCypress(c: { set: (x: number, y: number, p: number) => void }, f: number): void {
  const lag = (1 - Math.cos(TAU * (f / LOOP - 0.1))) / 2
  const lean = 2.2 * lag + 0.5 * Math.sin(TAU * (f / LOOP) * 2 - 2.2) * lag
  const climb = turn(f) * 3
  for (let y = 0; y < H; y++) {
    const t = clamp((y - 0.5) / 30)
    const reach = (1 - t) ** 2
    const cx = 9 + lean * reach + 0.6 * Math.sin(y * 0.4 + 1)
    const half = 0.4 + 5.2 * t ** 0.8
    const tongueR = 1.8 * Math.max(0, Math.sin(y * 0.8 - TAU * climb)) * (0.3 + t)
    const tongueL = 1.5 * Math.max(0, Math.sin(y * 0.66 + 1.7 - TAU * climb)) * (0.3 + t)
    const x0 = cx - half - tongueL
    const x1 = cx + half + tongueR
    for (let x = Math.round(x0); x <= Math.round(x1); x++) {
      const q = (x - cx) / Math.max(1, half)
      const stroke = Math.floor(q * 1.5 - y * 0.2 + climb * 2)
      const isLit = mod(stroke, 2) === 0
      const rim = x === Math.round(x1) ? 1.4 : 0
      c.set(x, y, shade(CYPRESS, 1.6 + Math.round(q * 1.5) * 0.9 + (isLit ? 1 : 0) + rim))
    }
  }
}
export const scene: Scene = {
  verb: 'Swirling',
  render,
  hero: 24,
  snaps: [{ frames: 9, box: [14, 12, 16, 15], colors: [0xeedf7c], why: 'the small star throbs: a new ring of light is born at its core' }],
}
