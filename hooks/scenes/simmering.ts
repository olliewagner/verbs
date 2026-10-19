import { Canvas, PALETTE, beat, frames, hex, loopNoise, particles, shade, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 48
const POP = 30

const WALL = hex('2b1a20 3f2526 5a3428 76452a 935b2e b0773c cb9852 e3ba70 f5d999 fff1c8')
const ENAMEL = hex('3b3139 5b4d52 7d6d6a a18f82 c3af97 dccaa9 eee1c0 fbf4de')
const POT = hex('0b0d26 131c47 1c2c6c 254196 345bba 5180d3 80a8e5 bad4f3')
const SAUCE = hex('2a0608 4a0b0c 701410 98200f bd3514 da5320 ee7f3c f9b072')
const SPOON = hex('3a1e14 5e3420 864e2c ac6c3a cc8e50 e6b072 f6d39c')
const IRON = hex('0e0b10 1c1820 2c2730 403a44 5a5260')
const GAS = PALETTE.gas
const CHROME = PALETTE.metal
const CHILE = hex('2a0709 4e0e0f 7c1712 a82416 cc3a1c e8602c')
const GARLIC = hex('3e2c44 6e5468 a48e9c d6c8c2 f3ebe0')
const STEAM = [hex('6e5654 8a7470'), hex('c49a70 dcbc98'), hex('efd6a8 fbecc8')]

const CX = 29.5
const RIM_Y = 11
const RIM_RX = 14.5
const RIM_RY = 6
const IN_Y = 11.4
const IN_RX = 13.2
const IN_RY = 5.1
const SAUCE_Y = 12
const SAUCE_RX = 12.9
const SAUCE_RY = 4.8
const BASE_Y = 25
const GUARD_Y = 14
const TOP_Y = 20

const inside = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
const potHalf = (y: number) => RIM_RX - Math.max(0, y - 21.5) ** 2 * 0.36
const isSauce = (x: number, y: number) =>
  inside(x, y, CX, SAUCE_Y, SAUCE_RX, SAUCE_RY) && inside(x, y, CX, IN_Y, IN_RX, IN_RY)
const ristraAt = (x: number, y: number) =>
  y >= 2 && y <= 13 && Math.abs(x - 6) <= (y < 4 ? y - 1.5 : 2.6 - Math.max(0, y - 8) * 0.5)
const vignette = (x: number, y: number) => Math.round((((x - 30) / 40) ** 2 + ((y - 14) / 28) ** 2) * 1.8)

function sunOn(x: number, y: number): number {
  if (y < 1 || y > 12) return 0
  const xl = 30 + y * 1.1
  const xm = xl + 12
  if (x < xl - 0.5 || x > xl + 24.5 || Math.abs(x - xm) < 1) return 0
  return y === 1 || y === 12 ? 0.5 : 1
}

type Drop = { tx: number; ty: number; t: number; h: number; isMark: boolean }
const BUBBLE_X = 29
const BUBBLE_Y = 12.4
const DROPS: Drop[] = [
  { tx: 9, ty: 22, t: 9, h: 9, isMark: true },
  { tx: 52, ty: 27, t: 11, h: 13, isMark: true },
  { tx: 21, ty: 20, t: 7, h: 6, isMark: true },
  { tx: 22, ty: 13, t: 5, h: 4, isMark: false },
  { tx: 35, ty: 15, t: 5, h: 3, isMark: false },
  { tx: 26, ty: 9, t: 6, h: 6, isMark: false },
  { tx: 33, ty: 9, t: 6, h: 7, isMark: false },
  { tx: 24, ty: 15, t: 6, h: 5, isMark: false },
]
const MARKS: [number, number, number][] = [[9, 22, 3], [10, 22, 2], [52, 27, 3], [53, 27, 2], [15, 28, 2]]
const POT_MARKS: [number, number, number][] = [[21, 20, 3], [21, 21, 2]]

function steamAt(f: number): Float32Array {
  const fog = new Float32Array(W * H)
  const add = (px: number, py: number, r: number, a: number) => {
    for (let y = Math.floor(py - r); y <= Math.ceil(py + r); y++) {
      for (let x = Math.floor(px - r); x <= Math.ceil(px + r); x++) {
        if (x < 0 || x >= W || y < 0 || y >= H) continue
        const d = Math.hypot(x - px, (y - py) * 1.2) / r
        if (d < 1) fog[y * W + x] = (fog[y * W + x] ?? 0) + a * (1 - d * d)
      }
    }
  }
  for (const p of particles(f, LOOP, 14, 28, 5)) {
    const x = 19 + p.r[1] * 20 + p.t * 0.36 + Math.sin(p.t * 0.2 + p.r[2] * 6) * 1.4
    add(x, SAUCE_Y - 2 - p.t * 0.4, 1.6 + p.age * 2.4, Math.sin(p.age * Math.PI) * (0.7 + p.r[3] * 0.4))
  }
  const g = f - POP
  if (g >= 0 && g < 16) add(30 + g * 0.35, SAUCE_Y - 3 - g * 0.55, 2 + g * 0.18, Math.sin((g / 16) * Math.PI) * 1.1)

  return fog
}

function steamBand(fog: Float32Array, x: number, y: number): number {
  const v = fog[y * W + x] ?? 0
  return v > 0.7 ? 2 : v > 0.3 ? 1 : 0
}

function draw(c: Canvas, f: number): void {
  const fog = steamAt(f)

  for (let y = 0; y < GUARD_Y; y++) {
    for (let x = 0; x < W; x++) {
      const s = sunOn(x, y)
      const shadow = ristraAt(x - 2, y - 1) ? 1 : 0
      const band = steamBand(fog, x, y)
      c.set(x, y, band ? (STEAM[s * 2]?.[band - 1] ?? 0) : shade(WALL, 2.4 + s * 4.8 - vignette(x, y) - shadow))
    }
  }
  for (let k = 0; k < 6; k++) {
    const x = Math.round(39 + k * 3.7 + 1.5 * wave(f, LOOP, 1, k * 0.17))
    const y = Math.round(2.5 + ((k * 5) % 9) + wave(f, LOOP, 1, k * 0.31 + 0.25) * 1.2)
    if (sunOn(x, y) === 1) c.set(x, y, WALL[9] ?? 0)
  }
  c.set(6, 0, shade(IRON, 3))
  c.set(6, 1, shade(IRON, 3))
  for (let y = 2; y <= 13; y++) {
    for (let x = 2; x <= 10; x++) {
      if (!ristraAt(x, y)) continue
      const lvl = (x <= 6 ? 4 : 2.4) - (y % 2 ? 1.2 : 0) - (y > 11 ? 0.6 : 0)
      c.set(x, y, shade(CHILE, lvl))
    }
  }

  for (let x = 0; x < W; x++) {
    c.set(x, GUARD_Y, shade(CHROME, 5.6 - x * 0.03 - vignette(x, GUARD_Y)))
    for (let y = GUARD_Y + 1; y < TOP_Y; y++) {
      let lvl = 4.6 - x * 0.02 - vignette(x, y)
      if (y === GUARD_Y + 1) lvl -= 1
      if (y === TOP_Y - 1) lvl -= 0.9
      if (x >= 45 && x <= 49 + (y - GUARD_Y) * 0.5) lvl -= 1.4
      c.set(x, y, shade(ENAMEL, lvl))
    }
  }
  for (const kx of [4, 9, 55, 60]) {
    c.set(kx, 16, shade(CHROME, 6))
    c.set(kx + 1, 16, shade(CHROME, 6))
    c.set(kx, 17, shade(CHROME, 2.6))
    c.set(kx + 1, 17, shade(CHROME, 2.6))
  }

  for (let y = TOP_Y; y < 30; y++) {
    for (let x = 0; x < W; x++) {
      let lvl = 5.4 - x * 0.018 - vignette(x, y) - (y === TOP_Y ? 1.2 : y === TOP_Y + 1 ? 0.5 : 0)
      if (inside(x, y, CX + 8, 24, 16, 3.4)) lvl -= 1.4
      c.set(x, y, shade(ENAMEL, lvl))
    }
  }
  for (let x = 0; x < W; x++) {
    c.set(x, 30, shade(CHROME, 5.8 - x * 0.03 - vignette(x, 30)))
    c.set(x, 31, shade(ENAMEL, 1.2 - vignette(x, 31) * 0.4))
  }
  for (const [x, y, l] of MARKS) c.set(x, y, shade(SAUCE, l))
  const garlic = ['..e..', '.ddc.', 'cddcb', 'cdcbb', '.bba.']
  const gl: Record<string, number> = { e: GARLIC[4] ?? 0, d: GARLIC[3] ?? 0, c: GARLIC[2] ?? 0, b: GARLIC[1] ?? 0, a: GARLIC[0] ?? 0 }
  for (let x = 55; x <= 59; x++) c.set(x, 28, shade(ENAMEL, 3))
  c.sprite(55, 23, garlic, gl)

  for (let y = 21; y <= 29; y++) {
    for (let x = 10; x < 50; x++) {
      if (!inside(x, y, CX, 25, 17, 3.6)) continue
      if (inside(x, y, CX, 25, 15.8, 2.9)) c.set(x, y, shade(IRON, 1.4 + (y > 26 ? 0.6 : 0)))
      else c.set(x, y, shade(CHROME, 4.8 - ((x - CX) / 17) * 1.4 + (y > 25 ? 0.6 : -0.8)))
    }
  }
  for (let x = 20; x <= 39; x++) {
    const n = loopNoise(x * 0.3, 0, f / LOOP, 5, 3)
    c.set(x, 26, shade(GAS, 0.6 + n * 2.8))
    if (n > 0.72) c.set(x, 27, shade(GAS, 0.4))
  }
  c.set(19, 25, shade(GAS, 1.5 + wave(f, LOOP, 6)))
  c.set(40, 25, shade(GAS, 1.5 + wave(f, LOOP, 5, 0.3)))
  for (let x = 14; x <= 18; x++) c.set(x, 25, shade(IRON, 3.4))
  for (let x = 41; x <= 45; x++) c.set(x, 25, shade(IRON, 2.6))
  for (const y of [26, 27]) {
    c.set(29, y, shade(IRON, 3.4))
    c.set(30, y, shade(IRON, 2.4))
  }

  for (let y = RIM_Y; y <= BASE_Y; y++) {
    const half = potHalf(y)
    for (let x = 0; x < W; x++) {
      const n = (x - CX) / half
      if (Math.abs(n) > 1) continue
      let lvl = 3.1 - n * 1.9
      if (n > -0.62 && n < -0.46) lvl += 2.2
      if (n > 0.88) lvl += 0.9
      if (y >= 23) lvl -= (y - 22) * 0.55
      const lip = RIM_Y + RIM_RY * Math.sqrt(Math.max(0, 1 - ((x - CX) / RIM_RX) ** 2))
      if (y > lip && y - lip < 1.2) lvl -= 0.8
      c.set(x, y, shade(POT, lvl))
    }
  }
  for (const [x, y, l] of POT_MARKS) c.set(x, y, shade(SAUCE, l))
  for (const [x, y] of [[13, 13], [14, 13], [13, 15], [14, 15]] as const) c.set(x, y, shade(POT, 3.6))
  c.set(12, 14, shade(POT, 4.8))
  for (const [x, y] of [[45, 13], [46, 13], [45, 15], [46, 15]] as const) c.set(x, y, shade(POT, 1.4))
  c.set(47, 14, shade(POT, 2.2))

  for (let y = 4; y <= 18; y++) {
    for (let x = 14; x <= 45; x++) {
      if (!inside(x, y, CX, RIM_Y, RIM_RX, RIM_RY)) continue
      if (!inside(x, y, CX, IN_Y, IN_RX, IN_RY)) {
        const n = (x - CX) / RIM_RX
        const glint = y > RIM_Y && (x === 21 || x === 22) ? 1.6 : 0
        c.set(x, y, shade(POT, (y > RIM_Y ? 5.5 - n * 1.7 : 4.6 + n * 0.8) + glint))
        continue
      }
      if (!isSauce(x, y)) {
        c.set(x, y, shade(POT, 1.2 + (x > CX ? 1.8 : 0)))
        continue
      }
      let lvl = 3.1 + (loopNoise(x * 0.16, y * 0.4, f / LOOP, 2, 4) - 0.5) * 1.1 - (y > 14 ? 0.6 : 0)
      if ((x - CX) / SAUCE_RX < -0.72) lvl -= 1.1
      if (inside(x, y, 21, 9, 6, 0.9)) lvl += 1.8
      lvl += steamBand(fog, x, y) * 0.5
      c.set(x, y, shade(SAUCE, lvl))
    }
  }

  const saucy = (x: number, y: number, lvl: number) => {
    if (isSauce(x, y)) c.set(x, y, shade(SAUCE, lvl))
  }
  for (const p of particles(f, LOOP, 17, 11, 3)) {
    const bx = Math.round(CX + (p.r[1] * 2 - 1) * 0.8 * SAUCE_RX)
    const by = Math.round(SAUCE_Y + (p.r[2] * 2 - 1) * 0.62 * SAUCE_RY)
    const nearBig = Math.abs(bx - BUBBLE_X) < 5 && f > 14 && f < POP + 10
    if (nearBig || (bx >= 18 && bx <= 23 && by < 13) || !isSauce(bx, by)) continue
    const isBig = p.r[3] > 0.5
    if (p.age < 0.68) {
      if (p.age < 0.2) continue
      if (isBig && p.age > 0.4) {
        for (const dx of [-1, 0, 1]) saucy(bx + dx, by + 1, 1.4)
        saucy(bx - 1, by, 4.6)
        saucy(bx, by, 5)
        saucy(bx + 1, by, 3.6)
        saucy(bx, by - 1, 6.2)
      } else {
        saucy(bx, by + 1, 1.5)
        saucy(bx, by, 5.6)
      }
    } else if (p.age < 0.78) {
      saucy(bx - 1, by, 1.2)
      saucy(bx + 1, by, 1.2)
      saucy(bx, by, 2)
      if (isBig) {
        saucy(bx - 2, by, 4.6)
        saucy(bx + 2, by, 4.6)
      }
      saucy(bx, by - 2, 6.4)
    } else {
      saucy(bx, by, 1.8)
    }
  }

  const g = f - POP
  if (f >= 18 && g < 0) {
    let r = 0.8 + beat(f, 18, POP) ** 1.6 * 3.8
    if (g >= -4) r += f % 2 ? 0.3 : -0.2
    const ry = r * 0.72
    const cy = BUBBLE_Y - r * 0.35
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(BUBBLE_Y + 2); y++) {
      for (let x = Math.floor(BUBBLE_X - r - 1); x <= Math.ceil(BUBBLE_X + r + 1); x++) {
        if (inside(x, y, BUBBLE_X, cy, r, ry)) {
          c.set(x, y, shade(SAUCE, 4.2 - ((y - cy) / ry) * 1.4 - ((x - BUBBLE_X) / r) * 0.7))
        } else if (isSauce(x, y) && inside(x, y, BUBBLE_X, BUBBLE_Y + 0.3, r + 0.9, 0.9 + r * 0.15)) {
          c.set(x, y, shade(SAUCE, 1.3))
        }
      }
    }
    c.set(BUBBLE_X - r * 0.4, cy - ry * 0.45, SAUCE[7] ?? 0)
  }
  if (g === 0 || g === 1) {
    for (let y = 10; y <= 15; y++) {
      for (let x = 24; x <= 34; x++) {
        if (inside(x, y, BUBBLE_X, BUBBLE_Y, 3.2 + g * 0.5, 1.2 + g * 0.1)) saucy(x, y, 1 + g * 0.5)
      }
    }
    const crown: [number, number][] = g === 0 ? [[-4, 2], [-2, 4], [0, 5], [2, 4], [4, 2]] : [[-4, 1], [-2, 2], [1, 2], [4, 1]]
    for (const [dx, hgt] of crown) {
      for (let k = 1; k <= hgt; k++) c.set(BUBBLE_X + dx, Math.round(BUBBLE_Y) - k, shade(SAUCE, 4.6 + k * 0.5))
    }
  }
  if (g >= 2 && g < 11) {
    const rr = 2.6 + (g - 2) * 1.1
    for (let y = 6; y <= 17; y++) {
      for (let x = 14; x <= 45; x++) {
        const d = Math.hypot((x - BUBBLE_X) / rr, (y - BUBBLE_Y) / (rr * 0.32))
        if (Math.abs(d - 1) < 0.11) saucy(x, y, g < 6 ? 4.8 : 4.2)
        else if (g < 5 && d < 0.7) saucy(x, y, 2)
      }
    }
  }

  const swing = Math.floor(g / 2)
  const rattle = g >= 0 && swing < 4 ? 0.16 * Math.exp(-swing / 1.8) * (swing % 2 ? -1 : 1) : 0
  for (let y = 0; y <= 10; y++) {
    const cx = 17.5 + (y - 7.6) * (1 + rattle)
    const xl = Math.round(cx - 0.5)
    if (y === 10) {
      saucy(xl, y, 5)
      saucy(xl + 1, y, 4)
      continue
    }
    const isStained = y >= 8
    c.set(xl, y, isStained ? shade(SAUCE, 2.4) : shade(SPOON, 3.2))
    c.set(xl + 1, y, isStained ? shade(SAUCE, 4) : shade(SPOON, y === 7 ? 6 : 5))
  }

  for (const d of DROPS) {
    if (g < 1 || g > d.t + 1) continue
    if (g === d.t + 1) {
      if (d.isMark) {
        c.set(d.tx, d.ty, shade(SAUCE, 5.4))
        c.set(d.tx + 1, d.ty, shade(SAUCE, 4))
      }
      continue
    }
    const at = (t: number) => {
      const s = t / d.t
      return [BUBBLE_X + (d.tx - BUBBLE_X) * s, BUBBLE_Y - 1 + (d.ty - BUBBLE_Y + 1) * s - d.h * 4 * s * (1 - s)] as const
    }
    const [x, y] = at(g)
    if (g === d.t) {
      for (const [dx, dy, l] of [[0, 0, 6.4], [-1, 0, 4.2], [1, 0, 4.2], [0, -1, 4.6]] as const) {
        if (d.isMark || isSauce(d.tx + dx, d.ty + dy)) c.set(d.tx + dx, d.ty + dy, shade(SAUCE, l))
      }
      continue
    }
    const [px, py] = at(g - 0.6)
    if (Math.hypot(x - px, y - py) > 1.2) c.set(px, py, shade(SAUCE, 3.4))
    c.set(x, y, shade(SAUCE, 5.6))
  }
}

function render(): Int32Array[] {
  return frames(LOOP, draw)
}

export const scene: Scene = {
  verb: 'Simmering',
  render,
  hero: 32,
  snaps: [
    {
      frames: [POP + 4, POP + 6],
      box: [9, 0, 46, 17],
      colors: [...SAUCE, ...SPOON, ...STEAM.flat()],
      why: 'the burst: its ring spreads over the sauce, spatter lands, a gust of steam rises and the knocked spoon rattles',
    },
  ],
}
