import { Canvas, TAU, clamp, ease, frames, hash, hex, lerp, mod, particles, shade, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96
const BEAT = 8

const WALL = hex('0b0a1a 141128 1e1838 2a1f48 3a2656 4e2d60 683668 864270')
const WOOD = hex('140b10 22121a 341a1e 4a2620 643422 82462a a05e34')
const GLASS = hex('260a38 3e1052 5c1a6c 82287e aa3a86 cc5a8a')
const WAX = hex('9a2448 d0423c f2742f ffa846 ffd47a fff0b8')
const METAL = hex('15121e 262236 3c3650 5a5070 8a7a98 c4b0c0 f0e0e0')
const NIGHT = hex('060a1a 0b1230 121c46 1c2a5c 2c3a70')
const LEAF = hex('071410 0c2018 123024 1a4230 245a3c 357048 54884e 86a85c')
const POT = hex('2a0f10 4a1c16 6e2c1c 924024 b05a30 cc7a44')
const RUG = hex('1c0c1a 34122a 561c38 7a2a40 a04048')
const RAIN = 0x40568e

const CX = 30.5
const GLASS_TOP = 5
const GLASS_BOTTOM = 17
const halfWidth = (y: number) => lerp(1.8, 3.9, (y - GLASS_TOP) / (GLASS_BOTTOM - GLASS_TOP))

function trip(t: number): number {
  const p = mod(t, 1)
  if (p < 0.12) return 0.06 * ease.in(p / 0.12)
  if (p < 0.48) return lerp(0.06, 1, ease.inOut((p - 0.12) / 0.36))
  if (p < 0.56) return 1
  return 1 - ease.inOut((p - 0.56) / 0.44)
}
type Blob = { x: number; y: number; r: number; sy: number }
function blobs(f: number): Blob[] {
  const out: Blob[] = [
    { x: CX, y: GLASS_BOTTOM + 1.2, r: 3.1, sy: 1.5 },
    { x: CX, y: GLASS_TOP - 0.7, r: 1.7, sy: 1.3 },
  ]
  for (const [i, phase] of [0, 0.5].entries()) {
    const t = f / LOOP + phase
    const p = trip(t)
    const speed = Math.abs(trip(t + 0.01) - trip(t - 0.01)) * 50
    out.push({
      x: CX + Math.sin(TAU * (t * 2 + i * 0.3)) * 0.7,
      y: lerp(GLASS_BOTTOM + 0.3, GLASS_TOP + 0.4, p),
      r: i === 0 ? 1.55 : 1.35,
      sy: Math.max(0.7, 1 / (1 + speed * 0.3)),
    })
  }
  return out
}
function field(bs: readonly Blob[], x: number, y: number): number {
  let sum = 0
  for (const b of bs) sum += (b.r / Math.sqrt((x - b.x) ** 2 + ((y - b.y) * b.sy) ** 2 + 0.01)) ** 3
  return sum
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const bs = blobs(f)
    const mid = bs.slice(2).reduce((a, b) => a + clamp(1 - Math.abs(b.y - 11) / 5), 0)
    const glow = 1 + mid * 0.14
    const lamp = (x: number, y: number) => {
      const d = Math.hypot(x - CX, (y - 11) * 1.1)
      return glow * Math.max(0, 1 - d / 42) ** 1.6
    }
    const beatT = mod(f, BEAT)
    const thump = beatT === 0 ? 1 : beatT === 1 ? 0.5 : 0
    c.fill((x, y) => shade(WALL, 0.8 + lamp(x, y) * 5.2 + (((x - CX) / 7.5) ** 2 + ((y - 11) / 9.5) ** 2 < 1 ? 0.6 * glow : 0), x, y))

    const WX0 = 2
    const WX1 = 19
    const WY0 = 1
    const WY1 = 14
    for (let y = WY0; y <= WY1; y++) {
      for (let x = WX0; x <= WX1; x++) {
        const isFrame = x === WX0 || x === WX1 || y === WY0 || y === WY1 || x === 11 || y === 7
        if (isFrame) {
          c.set(x, y, shade(WOOD, 1.6 + lamp(x, y) * 4 + (x === WX1 || x === 11 ? 0.6 : 0), x, y))
          continue
        }
        const roof = 9 + Math.round(Math.sin(x * 1.3) * 1.2 + (x % 5 === 0 ? -2 : 0))
        if (y >= roof) {
          const wx = Math.floor(x / 2)
          const lit = hash(wx, y, 7) > 0.66 && y % 2 === 0
          const blink = hash(wx, y, Math.floor(f / 24)) > 0.85
          c.set(x, y, lit && !blink ? (hash(wx, y, 3) > 0.4 ? 0xc0904e : 0x5a8eb4) : shade(NIGHT, 1.2, x, y))
        } else c.set(x, y, shade(NIGHT, 1 + (y - WY0) * 0.28, x, y))
      }
    }
    for (let i = 0; i < 8; i++) {
      const laps = 8
      const travel = ((f / LOOP) * laps + hash(i, 1)) * 16
      const lap = Math.floor(travel / 16)
      const y = WY0 + mod(travel, 16) - 1
      const x = WX0 + 1 + Math.floor(hash(i, mod(lap, laps), 2) * 16)
      for (let k = 0; k < 2; k++) {
        const px = x
        const py = Math.round(y - k)
        if (px > WX0 && px < WX1 && px !== 11 && py > WY0 && py < WY1 && py !== 7) c.set(px, py, k ? RAIN : 0x5670a8)
      }
    }
    for (const p of particles(f, LOOP, 3, 40, 11)) {
      const x = WX0 + 2 + Math.floor(p.r[1] * 14)
      if (x === 11) continue
      const y = WY0 + 1 + p.t * 0.22 + Math.max(0, Math.sin(p.t * 0.45)) * 1.2
      if (y >= WY1) continue
      c.set(x, y - 1, 0x4a5c94)
      c.set(x, y, 0xa8c4f0)
    }
    for (let x = WX0 - 1; x <= WX1 + 1; x++) {
      c.set(x, WY1 + 1, shade(WOOD, 3 + lamp(x, WY1 + 1) * 4, x, WY1 + 1))
      c.set(x, WY1 + 2, shade(WOOD, 0.8, x, WY1 + 2))
    }
    const TOP = 21
    for (let x = 0; x <= 41; x++) {
      c.set(x, TOP, shade(WOOD, 3.6 + lamp(x, TOP) * 3.5, x, TOP))
      for (let y = TOP + 1; y <= 27; y++) {
        const isSeam = x === 14 || x === 28 || y === 27
        c.set(x, y, shade(WOOD, 1.6 + lamp(x, y) * 3.2 - (isSeam ? 1 : 0) + (y === TOP + 1 ? -0.6 : 0), x, y))
      }
    }
    for (const px of [12, 16, 26, 30]) c.set(px, 24, shade(METAL, 3 + lamp(px, 24) * 3, px, 24))
    for (let y = 28; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const isRug = y >= 29 && x >= 8 && x <= 50
        const stripe = isRug ? (y === 30 && mod(x, 4) < 2 ? 1.2 : 0) + (x === 8 || x === 50 ? -1 : 0) : 0
        c.set(x, y, isRug ? shade(RUG, 1.5 + stripe + lamp(x, y) * 2.4, x, y) : shade(WOOD, 0.8 + lamp(x, y) * 2.4 - (x % 9 === 0 ? 0.6 : 0), x, y))
      }
    }
    for (const lx of [2, 39]) for (let y = 28; y <= 29; y++) c.set(lx, y, shade(WOOD, 1.4 + lamp(lx, y) * 2, lx, y))

    for (let x = 2; x <= 18; x++) {
      for (let y = 15; y <= 20; y++) {
        const isTop = y <= 17
        const level = isTop ? 3.2 + (y === 15 ? 0.8 : 0) : 2 - (y === 20 ? 0.6 : 0)
        c.set(x, y, shade(WOOD, level + lamp(x, y) * 2.5 - (x === 2 ? 0.6 : 0), x, y))
      }
    }
    const RX = 9
    const RY = 15.6
    for (let y = 12; y <= 19; y++) {
      for (let x = 2; x <= 16; x++) {
        const dx = (x - RX) / 6.1
        const dy = (y - RY) / 2.7
        const d = Math.hypot(dx, dy)
        if (d > 1) continue
        const isRim = d > 0.84 && dy > 0
        const isLabel = d < 0.3
        const groove = d > 0.5 && d < 0.62 ? 1 : 0
        const sheen = dx > 0.25 && dx < 0.65 && dy < 0 && dy > -0.7 ? 1.4 : 0
        const color = isRim ? shade(METAL, 2.6 + lamp(x, y) * 2, x, y) : isLabel ? (dy < 0 ? 0xd85a40 : 0xa83a34) : shade(METAL, 0.3 + groove * 0.5 + sheen + lamp(x, y) * 1.2, x, y)
        c.set(x, y, color)
      }
    }
    const spin = (f / LOOP) * 4 * TAU
    c.set(RX + Math.cos(spin) * 3.6, RY + Math.sin(spin) * 1.6, 0x8a80a4)
    c.line(17, 13, 17, 16, shade(METAL, 3.6, 0, 0))
    c.line(17, 13, 13, 15, shade(METAL, 4 + lamp(15, 14) * 1.5, 0, 0))
    c.set(12, 15, shade(METAL, 5, 0, 0))
    for (let y = 15; y <= 20; y++) {
      for (let x = 20; x <= 25; x++) c.set(x, y, shade(WOOD, 2.2 + lamp(x, y) * 2.6 - (x === 20 ? 0.6 : 0) + (y === 15 ? 1 : 0), x, y))
    }
    const coneR = 1.6 + thump * 0.6
    for (let y = 16; y <= 20; y++) {
      for (let x = 20; x <= 25; x++) {
        const d = Math.hypot(x - 22.5, y - 17.8)
        if (d < coneR) c.set(x, y, shade(METAL, (d < 0.8 ? 3 + thump * 1.5 : 1.2) + lamp(x, y) * 1.2, x, y))
      }
    }
    if (thump > 0) for (const [x, y] of [[19, 16], [19, 18], [26, 16], [26, 18]] as const) c.set(x, y, shade(WALL, 4 + thump * 2, x, y))
    for (let y = 2; y <= 4; y++) {
      const hw = 0.9 + (y - 2) * 0.55
      for (let x = Math.round(CX - hw); x <= Math.round(CX + hw - 0.01); x++) {
        c.set(x, y, shade(METAL, 3 + (x < CX ? 1.5 : 0) + (y === 4 ? -1 : 0) + lamp(x, y) * 0.8, x, y))
      }
    }
    for (let y = GLASS_TOP; y <= GLASS_BOTTOM; y++) {
      const hw = halfWidth(y)
      for (let x = Math.round(CX - hw); x <= Math.round(CX + hw - 0.01); x++) {
        const v = field(bs, x, y)
        const edge = Math.abs(x - CX) / hw
        let color: number
        if (v > 1) {
          color = shade(WAX, 1.8 + (v > 2 ? 1.2 : 0) + (v > 4.5 ? 1 : 0) + (y > 14 ? 0.6 : 0) - (edge > 0.72 ? 0.9 : 0), x, y)
        } else {
          const near = clamp(v * 1.3)
          const depth = (y - GLASS_TOP) / (GLASS_BOTTOM - GLASS_TOP)
          color = shade(GLASS, 0.8 + depth * 1.6 + near * 1.8 - edge * 0.9, x, y)
        }
        if (x === Math.round(CX - hw) + 1 && y > GLASS_TOP && y < GLASS_BOTTOM - 1 && v <= 1) color = shade(GLASS, 4, x, y)
        c.set(x, y, color)
      }
    }
    const foot = [3.2, 2.5, 2.9, 3.7]
    for (let i = 0; i < foot.length; i++) {
      const y = GLASS_BOTTOM + 1 + i
      const hw = foot[i] ?? 3
      for (let x = Math.round(CX - hw); x <= Math.round(CX + hw - 0.01); x++) {
        const side = (CX - x) / hw
        const band = side > 0.35 ? 1.4 : side < -0.4 ? -1 : 0
        c.set(x, y, shade(METAL, 3 + band + (i === 0 ? 1 : 0) - (i === 3 ? 0.8 : 0), x, y))
      }
    }
    for (let y = 18; y <= 20; y++) for (let x = 35; x <= 39; x++) c.set(x, y, shade(POT, 2.4 + lamp(37, 19) * 2 + (x <= 36 ? 0.8 : 0) + (y === 18 ? 0.8 : 0), x, y))
    const vines: [number, number, number][] = [[36, 26, 0], [38, 29, 1.3], [40, 24, 2.6]]
    for (const [vx, len, ph] of vines) {
      const sway = wave(f, LOOP, 2, ph / TAU)
      for (let y = 18; y <= len; y++) {
        const k = (y - 18) / (len - 18)
        const x = vx + Math.round(sway * k * 1.2 + Math.sin(y * 0.35 + ph) * 0.7)
        c.set(x, y, shade(LEAF, 2 + lamp(vx, 22) * 2.5, x, y))
        if ((y + Math.round(ph)) % 3 === 0) {
          const side = (y + Math.round(ph)) % 2 === 0 ? 1 : -1
          c.set(x + side, y, shade(LEAF, 3.4 + lamp(vx, 22) * 3, x + side, y))
          c.set(x + side, y + 1, shade(LEAF, 2.6 + lamp(vx, 22) * 3, x + side, y + 1))
        }
      }
    }
    for (const [lx, ly] of [[35, 17], [36, 17], [36, 16], [37, 16], [38, 17], [39, 17]] as const) c.set(lx, ly, shade(LEAF, 3.6 + lamp(lx, ly) * 3, lx, ly))
    for (let y = 24; y <= 30; y++) {
      const hw = y === 24 ? 6 : 5 - (y - 25) * 0.3
      for (let x = Math.round(53 - hw); x <= Math.round(53 + hw); x++) {
        const side = (53 - x) / hw
        c.set(x, y, shade(POT, (y === 24 ? 3.6 : 2.2) + side * 1.2 + lamp(x, y) * 3, x, y))
      }
    }
    for (let x = 48; x <= 58; x++) c.set(x, 31, shade(WOOD, 0.3, x, 31))
    type MLeaf = { x: number; y: number; rx: number; ry: number; tilt: number; ph: number }
    const leaves: MLeaf[] = [
      { x: 51, y: 5, rx: 4.6, ry: 3, tilt: 0.15, ph: 0.35 },
      { x: 57, y: 11, rx: 6.4, ry: 3.9, tilt: -0.3, ph: 0.2 },
      { x: 46, y: 14, rx: 5.6, ry: 3.5, tilt: 0.45, ph: 0.55 },
      { x: 58, y: 20, rx: 5.4, ry: 3.2, tilt: -0.12, ph: 0.8 },
    ]
    for (const l of leaves) {
      const sway = wave(f, LOOP, 2, l.ph)
      const lx = l.x + Math.round(sway * 0.9)
      const ly = l.y + Math.round(wave(f, LOOP, 2, l.ph + 0.25) * 0.6)
      c.line(53, 24, lx, ly + l.ry * 0.5, shade(LEAF, 2.4 + lamp(lx, ly) * 2, 0, 0))
    }
    for (const l of leaves) {
      const sway = wave(f, LOOP, 2, l.ph)
      const lx = l.x + Math.round(sway * 0.9)
      const ly = l.y + Math.round(wave(f, LOOP, 2, l.ph + 0.25) * 0.6)
      const ca = Math.cos(l.tilt)
      const sa = Math.sin(l.tilt)
      const facing = lx > 52 ? -1 : 1
      for (let y = Math.floor(ly - l.ry - 2); y <= Math.ceil(ly + l.ry + 2); y++) {
        for (let x = Math.floor(lx - l.rx - 2); x <= Math.ceil(lx + l.rx + 2); x++) {
          const u = ((x - lx) * ca + (y - ly) * sa) / l.rx
          const v = (-(x - lx) * sa + (y - ly) * ca) / l.ry
          if (u * u + v * v > 1) continue
          const su = u * facing
          const isSlit = Math.abs(v) > 0.38 && (Math.abs(su - 0.05) < 0.08 || Math.abs(su - 0.5) < 0.08 || Math.abs(su + 0.45) < 0.08)
          if (isSlit) continue
          const isRib = Math.abs(v) < 0.16 && Math.abs(u) < 0.85
          const rim = u * u + v * v > 0.7 && x < lx ? 1 : 0
          c.set(x, y, shade(LEAF, 2.6 + lamp(x, y) * 3.4 - v * 0.9 + (isRib ? 0.9 : 0) + rim * lamp(x, y) * 3, x, y))
        }
      }
    }
  })
}
export const scene: Scene = { verb: 'Vibing', render, hero: 26 }