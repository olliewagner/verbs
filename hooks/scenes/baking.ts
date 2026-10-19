import { Canvas, beat, clamp, ease, hex, mod, shade, smoothstep, threshold, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const MINT = hex('0e2123 15322f 1e463f 2a5d52 397766 4c917a 66ab8f 8ac4a6 b6dcc0 e2f2dc')
const STEEL = hex('0d0c11 19181f 28262e 3a3741 504b56 6b6470 8e8590 bab0b6 e8ded8')
const CAVITY = hex('060509 100d15 1b1620 281e26 382629 4c3029 653e2b 82502f a5683a')
const ELEMENT = hex('1c1416 3b1a1a 66201a 9a2c17 cf4a18 f17c25 fbb04a fee59c fff8dc')
const CRUST = hex('24120b 43210f 693615 8e4f1d b46e29 d2913d e5b462 f1d18e f9e9c4')
const TIN = hex('0f0d12 1b1820 2a2630 3d3742 554c58 746876 9a8c98 c4b6bc')
const STEAM = hex('3f4a4c 667372 93a09c c3cfc8 e6eee8')
const LAMP = hex('2a0d0a 5a1a10 c2401a f98a2c ffd27a')
const DARK = CAVITY[0] ?? 0
const GLOW = 0xf17c25

const INKS = [...MINT, ...STEEL, ...CAVITY, ...ELEMENT, ...CRUST, ...TIN, ...STEAM, ...LAMP, ...hex('5a3a2a 8a5030 b86a34 3a4a48 5a6a66 7a8c86')]
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

const GX0 = 9
const GX1 = 54
const GY0 = 11
const GY1 = 29
const CX = 31.5
const CY = 20
const RIM_Y = 21

const FADE = [0.5, 0.25, 0.1]

function state(f: number) {
  const bulb = f === 6 ? 0.45 : f >= 7 && f < 58 ? 1 : (FADE[f - 58] ?? 0)
  const heat = ease.inOut(beat(f, 7, 22)) * (1 - smoothstep(58, 71, f))
  const glow = heat * (0.9 + 0.1 * wave(f, LOOP, 4))
  const rise = ease.inOut(beat(f, 12, 44))
  const brown = ease.inOut(beat(f, 22, 56))
  return { bulb, heat, glow, rise, brown, isLampOn: f >= 7 && f < 58 }
}
type State = ReturnType<typeof state>

function litAt(s: State, x: number, y: number): number {
  const b = s.bulb * Math.max(0, 1 - Math.hypot(x - 12, (y - 14) * 1.3) / 34) ** 1.3
  const top = s.glow * Math.max(0, 1 - Math.abs(y - 12) / 9) * 0.6
  const bottom = s.glow * Math.max(0, 1 - Math.abs(y - 28) / 7) * 0.5
  return b + top + bottom
}

function loafTop(s: State, x: number): number | undefined {
  const half = 12.6 + s.rise * 1.6
  const u = Math.abs(x - CX) / half
  if (u > 1) return undefined
  const h = 1.6 + s.rise * 6
  return RIM_Y - h * (1 - u ** 2.8) ** 0.6
}

function cavity(f: number, s: State): Canvas {
  const c = new Canvas()
  const lit = (ramp: readonly number[], level: number, gain = 3.4) => (x: number, y: number) => {
    const l = litAt(s, x, y)
    return l < 0.05 ? DARK : shade(ramp, level + l * gain, x, y)
  }
  for (let y = GY0; y <= GY1; y++) {
    for (let x = GX0; x <= GX1; x++) {
      const u = Math.abs(x - CX) / 23
      const v = Math.abs(y - CY) / 9.5
      const level = Math.max(u, v) <= 0.68 ? 0.2 : u > v ? (x < CX ? 1.1 : 0.6) : y < CY ? 0.6 : 1.1
      c.set(x, y, lit(CAVITY, level))
    }
  }
  if (s.glow > 0.05) {
    for (const ey of [12, 28]) {
      for (let x = 10; x <= 53; x++) {
        for (const [dy, t] of [[-1, 0.35], [1, 0.35], [ey < CY ? 2 : -2, 0.15]] as const) {
          c.tint(x, ey + dy, GLOW, Math.round(t * s.glow * 8) / 8)
        }
      }
    }
  }
  const element = (x: number, y: number) => {
    if (s.heat < 0.01) return c.set(x, y, lit(STEEL, 1, 3))
    c.set(x, y, shade(ELEMENT, s.glow * 6.2 + 0.8 * Math.min(1, s.heat * 6) + (mod(x, 6) === 2 ? s.glow * 0.9 : 0), x, y))
  }
  for (const ey of [12, 28]) {
    for (let x = 11; x <= 52; x++) element(x, ey)
    element(10, ey + (ey < CY ? -1 : 1))
    element(53, ey + (ey < CY ? -1 : 1))
  }

  for (let x = 16; x <= 47; x++) c.set(x, 24, lit(STEEL, 1.5))
  for (let k = 0; k <= 8; k++) {
    const fx = 11 + k * 5.25
    c.line(fx, 26, CX + (fx - CX) * 0.7, 24, lit(STEEL, 1.5))
  }
  for (let x = GX0; x <= GX1; x++) c.set(x, 26, lit(STEEL, 2.4))

  for (let x = 19; x <= 44; x++) c.set(x, 26, lit(STEEL, 0.4, 1))
  for (let y = RIM_Y; y <= 25; y++) {
    const inset = y === 25 ? 1 : 0
    for (let x = 18 + inset; x <= 45 - inset; x++) {
      const isRim = y === RIM_Y
      const isEdge = x === 18 + inset || x === 45 - inset
      const streak = x === 21 || x === 22 ? 1.8 : x === 24 ? 0.9 : 0
      const level = isRim ? 3.4 - Math.max(0, x - 30) * 0.06 : 1.2 - (y - RIM_Y) * 0.25 + streak * s.bulb - (isEdge ? 0.6 : 0) - (x > 36 ? 0.5 : 0)
      c.set(x, y, lit(TIN, level, 2.2))
    }
  }

  const light = clamp(s.bulb * 0.7 + s.glow * 0.5)
  const half = 12.6 + s.rise * 1.6
  const split = ease.out(beat(f, 20, 42))
  for (let x = 16; x <= 47; x++) {
    const top = loafTop(s, x)
    if (top === undefined) continue
    const ty = Math.round(top)
    const h = Math.max(1, RIM_Y - ty)
    for (let y = ty; y < RIM_Y; y++) {
      const here = litAt(s, x, y)
      if (here < 0.05) {
        c.set(x, y, DARK)
        continue
      }
      const dusk = (1 - clamp(s.bulb * 3)) * 4 * (1 - clamp((here - 0.05) / 0.25))
      const t = (RIM_Y - y) / h
      const nx = (x - CX) / half
      const form = (t > 0.7 ? 0.8 : t > 0.35 ? 0.2 : -0.4) + (nx > 0.55 ? -1 : nx > 0.2 ? -0.4 : nx < -0.5 ? 0.5 : 0)
      const crown = s.brown * (3 + (t > 0.6 ? 1 : 0))
      const edge = y === ty ? 0.8 : 0
      const sheen = nx > -0.72 && nx < -0.42 && t > 0.55 && t < 0.95 ? s.bulb * 0.9 : 0
      c.set(x, y, shade(CRUST, 6.6 - crown + form + edge + sheen - (1 - light) * 3.2 - dusk, x, y))
    }
    const along = (x - 22) / 18
    if (split > 0 && along >= 0 && along <= 1 && litAt(s, x, ty) >= 0.05) {
      const open = split * Math.sin(Math.PI * along)
      const sy = ty + (along < 0.45 ? 2 : 1)
      const dusk = (1 - clamp(s.bulb * 3)) * 4 * (1 - clamp((litAt(s, x, ty) - 0.05) / 0.25))
      if (open > 0.2) {
        c.set(x, sy, shade(CRUST, 7.6 - s.brown * 1.2 - (1 - light) * 3.2 - dusk, x, sy))
        c.set(x, sy + 1, shade(CRUST, 4.6 - s.brown * 2.6 - (1 - light) * 3.2 - dusk, x, sy + 1))
        if (open > 0.6) c.set(x, sy - 1, shade(CRUST, 7.2 - s.brown * 1.6 - (1 - light) * 3.2 - dusk, x, sy - 1))
      }
    }
  }

  for (const [x, y, k] of [[12, 13, 0], [13, 13, 0], [12, 14, 1], [13, 14, 1], [11, 14, 2], [14, 14, 2], [12, 15, 2], [13, 15, 2]] as const) {
    if (k < 2 && s.bulb > 0) c.set(x, y, shade(ELEMENT, (k === 0 ? 8 : 7) - (1 - s.bulb) * 3, x, y))
    else c.set(x, y, lit(STEEL, k === 2 ? 2 : 2.5, 2.5))
  }

  return c
}

function steam(c: Canvas, f: number): void {
  const puffs = [
    { x: 30, t0: 58, vx: -0.3 },
    { x: 35, t0: 59, vx: 0.35 },
    { x: 25, t0: 60, vx: -0.5 },
    { x: 40, t0: 61, vx: 0.55 },
    { x: 32, t0: 63, vx: 0 },
  ]
  for (const p of puffs) {
    const t = f - p.t0
    if (t < 0 || t > 9) continue
    const life = t / 9
    const cx = p.x + p.vx * t
    const cy = 4 - ease.out(life) * 5.5
    const r = 1.2 + ease.out(life) * 3.4
    const alpha = (1 - life) * Math.min(1, (t + 1) / 2) * 1.15
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const d = Math.hypot((x - cx) / 1.3, y - cy) / r
        const density = alpha * (1.1 - d * d)
        if (d > 1 || density < 0.2 || (density < 0.45 && threshold(x, y) > 0.5)) continue
        c.set(x, y, shade(STEAM, 0.8 + density * 3.4 + (y < cy ? 0.4 : 0), x, y))
      }
    }
  }
}

function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const s = state(f)
    const c = new Canvas()

    for (let y = 0; y <= 2; y++) {
      for (let x = 0; x < W; x++) {
        const brushed = (x * 3 + y * 5) % 13 === 0 ? 0.6 : 0
        c.set(x, y, shade(STEEL, 4.4 - y * 0.6 - Math.abs(x - 24) * 0.025 + brushed, x, y))
      }
    }
    for (const kx of [5, 12, 51, 58]) {
      c.sprite(kx - 1, 0, ['abb', 'bcd', 'dde'], { a: STEEL[6] ?? 0, b: STEEL[2] ?? 0, c: STEEL[1] ?? 0, d: STEEL[1] ?? 0, e: STEEL[0] ?? 0 })
      c.set(kx, 0, STEEL[7] ?? 0)
    }
    c.set(31, 1, LAMP[s.isLampOn ? 4 : 1] ?? 0)
    c.set(32, 1, LAMP[s.isLampOn ? 3 : 0] ?? 0)
    if (s.isLampOn) {
      for (const [x, y, t] of [[30, 1, 0.4], [33, 1, 0.4], [31, 0, 0.3], [32, 0, 0.2], [31, 2, 0.2], [32, 2, 0.3]] as const) c.tint(x, y, GLOW, t)
    }
    for (let x = 0; x < W; x++) c.set(x, 3, x % 3 === 0 ? STEEL[1] ?? 0 : DARK)

    for (let y = 4; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const edge = x === 0 || x === W - 1 ? -1.4 : x === 1 || x === W - 2 ? -0.6 : x === 2 ? 0.8 : 0
        c.set(x, y, shade(MINT, 6.4 - (y - 4) * 0.075 - x * 0.03 + edge, x, y))
      }
    }
    for (let x = 7; x <= 58; x++) c.set(x, 7, shade(MINT, 4 - x * 0.03, x, 7))
    for (const px of [8, 55]) {
      c.set(px, 7, STEEL[2] ?? 0)
      c.set(px + 1, 8, shade(MINT, 4, px, 8))
    }
    for (let x = 6; x <= 57; x++) {
      const spec = x >= 12 && x <= 16 ? 1.4 : x >= 18 && x <= 19 ? 0.8 : 0
      c.set(x, 5, shade(STEEL, 6.2 + spec - x * 0.02, x, 5))
      c.set(x, 6, shade(STEEL, 3.4 - x * 0.02, x, 6))
    }
    c.set(5, 5, STEEL[4] ?? 0)
    c.set(58, 6, STEEL[2] ?? 0)

    for (let y = 9; y <= 31; y++) {
      for (let x = 7; x <= 56; x++) {
        if ((x === 7 || x === 56) && (y === 9 || y === 31)) continue
        const isBevel = x === 7 || x === 56 || y === 9 || y === 31
        if (!isBevel) {
          c.set(x, y, STEEL[0] ?? 0)
          continue
        }
        const facesLight = x === 56 || y === 31
        c.set(x, y, shade(MINT, facesLight ? 7.6 - x * 0.02 : 2.2 - x * 0.01, x, y))
        if (facesLight && s.glow > 0.1) c.tint(x, y, GLOW, Math.round(s.glow * 2) / 8)
      }
    }

    const inside = cavity(f, s)
    for (let y = GY0; y <= GY1; y++) {
      let off = 0
      if (s.heat > 0.5) {
        for (const [phase, dir] of [[0, 1], [8, -1], [16, 1]] as const) {
          const band = 31 - mod(f + phase, 24) * 1.1
          if (Math.abs(y - band) < 1.2) off = dir
        }
      }
      for (let x = GX0; x <= GX1; x++) {
        if ((x === GX0 || x === GX1) && (y === GY0 || y === GY1)) continue
        c.set(x, y, inside.get(clamp(x - off, GX0, GX1), y))
      }
    }
    const seen = clamp(s.bulb * 0.8 + s.heat * 0.4)
    for (let y = GY0; y <= GY1; y++) {
      for (let x = GX0; x <= GX1; x++) {
        const k = x + y
        const streak = k >= 33 && k <= 35 ? 0.16 : k === 38 ? 0.1 : k >= 70 && k <= 71 ? 0.08 : 0
        if (streak > 0) c.tint(x, y, 0xd6eee2, Math.round(streak * (1.5 - seen) * 16) / 16)
      }
    }

    steam(c, f)
    out.push(c.px.map(snap))
  }

  return out
}

export const scene: Scene = {
  verb: 'Baking',
  render,
  hero: 45,
  snaps: [
    { frames: 6, box: [19, 19, 38, 24], colors: [DARK], why: 'The oven light clicks on, half-lit at first, and the tin appears out of the dark.' },
    { frames: 6, box: [10, 11, 16, 15], colors: [...STEEL.slice(2, 3), DARK], why: 'The bulb and its cage light up as it clicks on.' },
  ],
}
