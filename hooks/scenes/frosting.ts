import {
  Canvas, TAU, beat, ease, hash, hex, lightAt, loopNoise, mix, particles, random, shade, threshold, type Light, type Scene,
} from '../engine'

const W = 64
const H = 32
const LOOP = 96

const NIGHT = hex('070a1a 0c1230 141c46 1d2a5c 2a3a72 3d4f88')
const SNOW = hex('1e2648 2c3866 405290 5b72b0 8099cc aac0e2 d4e2f4')
const FROST = hex('4e6f9c 7899c4 a6c6e4 d4e8f8 f6fcff')
const FROST_WARM = hex('7e5a50 b48a6c dcb684 f6dca8 fff6de')
const WOOD = hex('140b0c 22120f 361c14 4f2919 6c3a20 8c4f28 ae6a32 d08c44')
const WAX = hex('8a6a5a b8957a dcc0a0 f4e2c4 fff6e4')
const BRASS = hex('3a2210 6a4218 a06a24 d49a3a f6cc6a')
const FLAME = hex('a1221a ef6822 f99832 fcc657 fee996 fffbe0')
const WINDOW = hex('a86a2a e0a040 f8d070')

const X0 = 3
const X1 = 60
const MULLION = 31
const Y0 = 2
const Y1 = 26

const PANES = [
  [X0, Y0, MULLION - 1, Y1],
  [MULLION + 2, Y0, X1, Y1],
] as const

const isGlass = (x: number, y: number) => PANES.some(([l, t, r, b]) => x >= l && x <= r && y >= t && y <= b)

const CANDLE_X = 45
const FLAME_Y = 18

const PART = new Uint8Array(W * H)

const FROST_TIME: Float32Array = (() => {
  const time = new Float32Array(W * H).fill(Infinity)
  const rng = random(0xf2057)
  const put = (x: number, y: number, t: number, part: number) => {
    const ix = Math.round(x)
    const iy = Math.round(y)
    if (!isGlass(ix, iy)) return false
    const k = iy * W + ix
    if (t < (time[k] ?? Infinity)) time[k] = t
    PART[k] = Math.max(PART[k] ?? 0, part)
    return true
  }
  const frond = (x: number, y: number, a: number, len: number, width: number, curl: number, t0: number) => {
    let px = x
    let py = y
    for (let s = 1; s <= len; s++) {
      a += curl
      px += Math.cos(a)
      py += Math.sin(a)
      if (!put(px, py, t0 + s, 2)) return
      const vane = width * (1 - s / (len + 1)) ** 0.7 + (s % 2 === 0 ? 0.6 : -0.3)
      for (const side of [-1, 1]) {
        const ba = a + side * 1.0
        for (let k = 1; k <= Math.round(vane); k++) {
          put(px + Math.cos(ba) * k, py + Math.sin(ba) * k, t0 + s + k * 0.6, k === Math.round(vane) && k > 1 ? 0 : 1)
        }
      }
    }
  }
  for (const [l, t, r, b] of PANES) {
    const corners = [[l, t, Math.PI / 4], [r, t, (3 * Math.PI) / 4], [r, b, (-3 * Math.PI) / 4], [l, b, -Math.PI / 4]] as const
    for (const [cx, cy, a0] of corners) {
      frond(cx, cy, a0 - 0.6, 11 + rng() * 3, 2.2, 0.06, rng() * 2)
      frond(cx, cy, a0 + 0.05, 7 + rng() * 2, 1.6, -0.02, 1 + rng() * 2)
      frond(cx, cy, a0 + 0.65, 6 + rng() * 2, 1.5, -0.07, 2 + rng() * 2)
    }
    frond(l + 9 + rng() * (r - l - 18), b + 1, -Math.PI / 2 + (rng() - 0.5) * 0.5, 5, 1.6, 0.06, 7)
  }
  let max = 0
  for (const t of time) if (t !== Infinity) max = Math.max(max, t)
  for (let i = 0; i < time.length; i++) if (time[i] !== Infinity) time[i] = (time[i] ?? 0) / max
  return time
})()
const SEED = 0.05
const growth = (f: number) => SEED + (1 - SEED) * (1 - (1 - beat(f, 1, 66)) ** 1.6)
const thaw = (f: number) => 45 * beat(f, 69, 95)
const heatDistance = (x: number, y: number) => Math.hypot(x - CANDLE_X, (y - FLAME_Y) * (y < FLAME_Y ? 0.8 : 1.4))

function thawFrame(x: number, y: number): number {
  const d = heatDistance(x, y)
  for (let f = 69; f < LOOP; f++) if (thaw(f) > d) return f
  return LOOP
}
const DROPS = [[40, 11], [52, 7], [23, 9], [9, 13], [56, 15]] as const
function haze(x: number, y: number, g: number, melt: number): number {
  if (heatDistance(x, y) < melt) return 0
  let d = Infinity
  for (const [l, t, r, b] of PANES) {
    if (x < l || x > r || y < t || y > b) continue
    for (const [cx, cy] of [[l, t], [r, t], [r, b], [l, b]] as const) d = Math.min(d, Math.hypot(x - cx, y - cy))
    d = Math.min(d + 3, Math.min(y - t, b - y) * 2.2 + 4 + 0.15 * Math.min(x - l, r - x))
  }
  const reach = 1.5 + g * 4
  return d < reach * 0.55 ? 1 : d < reach ? 0.5 : 0
}
const hillTop = (x: number) => 16 + 1.4 * Math.sin(x * 0.11 + 0.5) + 0.8 * Math.sin(x * 0.27 + 2)
type House = { x: number; w: number; h: number; lit: readonly number[] }
const HOUSES: House[] = [
  { x: 5, w: 5, h: 3, lit: [6] }, { x: 12, w: 4, h: 4, lit: [13] }, { x: 18, w: 6, h: 3, lit: [19, 22] },
  { x: 25, w: 4, h: 3, lit: [26] }, { x: 41, w: 5, h: 3, lit: [43] }, { x: 49, w: 4, h: 4, lit: [50] },
  { x: 54, w: 5, h: 3, lit: [57] },
]
function outside(c: Canvas, f: number): void {
  c.fill((x, y) => shade(NIGHT, 0.4 + (y / 17) * 3.6 + Math.max(0, 1 - Math.hypot(x - 36, (y - 17) * 2) / 26) * 1.2, x, y))

  for (let y = 0; y < 14; y++) {
    for (let x = 8; x < 27; x++) {
      const d = Math.hypot(x - 17, y - 8)
      if (d < 3.4) {
        const isLit = Math.hypot(x - 18.6, y - 6.8) > 2.9
        c.set(x, y, isLit ? (d < 2.5 ? 0xfdf6d8 : 0xe8e0c0) : NIGHT[3] ?? 0)
      } else if (d < 6.5) {
        c.tint(x, y, NIGHT[5] ?? 0, d < 5 ? 0.5 : 0.25)
      }
    }
  }
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(hash(i, 1) * W)
    const y = Math.floor(hash(i, 2) * 13)
    if (Math.hypot(x - 17, y - 8) < 7) continue
    const twinkle = hash(i, Math.floor((f + i * 5) / 6), 3) > 0.8
    c.set(x, y, twinkle ? 0xf4f2ff : i % 3 === 0 ? 0x9aa6d8 : 0x6c78b4)
  }
  for (let x = 0; x < W; x++) {
    const top = Math.round(hillTop(x))
    const slope = hillTop(x + 1) - hillTop(x - 1)
    for (let y = top; y < H; y++) {
      const depth = y - top
      c.set(x, y, shade(SNOW, 3.2 - depth * 0.35 + (y < top + 2 ? -slope * 1.2 : 0) + (y > 21 ? (y - 21) * 0.5 : 0), x, y))
    }
  }
  const cbase = Math.round(hillTop(37)) + 1
  for (let y = cbase - 7; y <= cbase; y++) for (let x = 36; x <= 38; x++) c.set(x, y, x === 36 ? NIGHT[1] ?? 0 : NIGHT[2] ?? 0)
  c.poly([[35.5, cbase - 7.5], [39.5, cbase - 7.5], [37.5, cbase - 13]], (x, y) => (x <= 37 ? SNOW[4] ?? 0 : SNOW[2] ?? 0))
  c.set(37, cbase - 5, WINDOW[1] ?? 0)
  c.set(37, cbase - 1, WINDOW[0] ?? 0)
  c.set(37, cbase - 14, NIGHT[4] ?? 0)
  for (const h of HOUSES) {
    const base = Math.round(hillTop(h.x + h.w / 2)) + 2
    for (let y = base - h.h; y <= base; y++) for (let x = h.x; x < h.x + h.w; x++) c.set(x, y, NIGHT[x === h.x ? 1 : 2] ?? 0)
    for (let x = h.x - 1; x <= h.x + h.w; x++) c.set(x, base - h.h - 1, SNOW[x < h.x + h.w / 2 ? 5 : 4] ?? 0)
    for (let x = h.x; x < h.x + h.w; x++) c.set(x, base - h.h - 2, SNOW[x < h.x + 2 ? 6 : 5] ?? 0)
    for (const wx of h.lit) {
      const isOut = wx === 50 && f >= 40 && f < 82
      c.set(wx, base - 1, isOut ? NIGHT[1] ?? 0 : WINDOW[2] ?? 0)
      if (!isOut) c.tint(wx, base + 1, WINDOW[1] ?? 0, 0.35)
    }
  }
  for (const [sx, phase] of [[14, 0], [20, 0.4], [56, 0.7]] as const) {
    const base = Math.round(hillTop(sx)) - 3
    for (let k = 1; k < 9; k++) {
      const x = sx + k * 0.45 + (loopNoise(k * 0.4, sx, f / LOOP + phase, 3) - 0.5) * 2.4
      const alpha = 0.7 - k * 0.07
      if (alpha > threshold(Math.round(x), base - k)) c.tint(x, base - k, SNOW[3] ?? 0, 0.55)
    }
  }
  for (const [px, py, s] of [[8, 25, 1], [26, 26, 0.8], [52, 25, 1.1], [58, 26, 0.9]] as const) {
    for (let k = 0; k < 7 * s; k++) {
      const half = Math.floor(k / 2.2)
      for (let dx = -half; dx <= half; dx++) {
        c.set(px + dx, py - 7 * s + k, dx === -half || k % 3 === 0 ? SNOW[3] ?? 0 : 0x0a1a24)
      }
    }
  }
  for (const p of particles(f, LOOP, 20, 70, 9)) {
    const x = p.r[1] * 72 - 4 + p.t * 0.12 + Math.sin(p.t * 0.18 + p.r[2] * TAU) * 1.2
    const y = -2 + p.t * (0.36 + p.r[3] * 0.12)
    c.set(Math.round(x), Math.round(y), p.r[3] > 0.6 ? 0xe8f0ff : SNOW[5] ?? 0)
  }
}
function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const flicker = loopNoise(0.5, 0.5, f / LOOP, 14, 2)
    const flameH = flicker > 0.62 ? 4 : flicker < 0.35 ? 2 : 3
    const lean = Math.round((loopNoise(3, 1, f / LOOP, 10, 5) - 0.5) * 2.2)
    const candle: Light = { x: CANDLE_X, y: FLAME_Y - 1, power: 0.95 + flicker * 0.25, radius: 38 }
    const g = growth(f)
    const melt = thaw(f)
    outside(c, f)

    for (let y = Y0; y <= Y1; y++) {
      for (let x = X0; x <= X1; x++) {
        if (!isGlass(x, y)) continue
        const lit = lightAt([candle], x, y)
        const isWarm = lit > 0.7
        const ramp = isWarm ? FROST_WARM : FROST
        const hz = haze(x, y, g, melt)
        if (hz > 0) c.set(x, y, hz > 0.5 ? ramp[0] ?? 0 : mix(c.get(x, y), ramp[0] ?? 0, 0.45))
        const t = FROST_TIME[y * W + x] ?? Infinity
        const isThawed = t >= SEED && heatDistance(x, y) < melt
        if (t > g || isThawed) {
          const edge = melt - heatDistance(x, y)
          if (t <= 1 && t > SEED && edge >= 0 && edge < 2.5 && t < g) c.tint(x, y, ramp[2] ?? 0, 0.35)
          continue
        }
        const isTip = g - t < 0.035 && g < 0.99
        const glint = hash(x, y, Math.floor(f / 3)) > 0.985
        const part = PART[y * W + x] ?? 0
        c.set(x, y, ramp[isTip || glint ? 4 : part === 2 ? 3 : part === 1 ? 2 : 1] ?? 0)
      }
    }
    for (const [dx, dy] of DROPS) {
      const start = thawFrame(dx, dy) + 1
      const t = f - start
      if (t < 0 || t > 7) continue
      const y = dy + Math.round(ease.inOut(t / 7) * 6)
      for (let k = dy; k < y; k++) c.tint(dx, k, FROST[2] ?? 0, 0.3)
      c.set(dx, y, FROST[4] ?? 0)
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (isGlass(x, y) || y >= 27) continue
        const lit = lightAt([candle], x, y)
        const isMullion = x >= MULLION && x <= MULLION + 1
        const bevel =
          (x === X0 - 1 && y >= Y0) || (y === Y0 - 1 && x >= X0) || (isMullion && x === MULLION + 1) ? -0.8 :
          (x === X1 + 1 || (isMullion && x === MULLION) || y === Y0 - 1) ? 0.9 : 0
        c.set(x, y, shade(WOOD, 1.6 + lit * 4.4 + bevel - (x === 0 || x === W - 1 || y === 0 ? 0.8 : 0), x, y))
      }
    }
    for (let x = 0; x < W; x++) {
      for (let y = 27; y < H; y++) {
        const lit = lightAt([candle], x, y)
        c.set(x, y, shade(WOOD, (y === 27 ? 3.2 : y === 28 ? 1.4 : 1.9) + lit * (y === 27 ? 4 : 2.4), x, y))
      }
    }
    for (let x = CANDLE_X - 4; x <= CANDLE_X + 4; x++) {
      const d = Math.abs(x - CANDLE_X)
      c.set(x, 27, shade(BRASS, 3.4 - d * 0.35 + (x < CANDLE_X ? 0.5 : 0), x, 27))
      if (d < 4) c.set(x, 28, shade(BRASS, 1.4 - d * 0.2, x, 28))
    }
    c.set(CANDLE_X + 4, 26, BRASS[2] ?? 0)
    c.set(CANDLE_X + 5, 26, BRASS[1] ?? 0)
    for (let y = 20; y <= 26; y++) {
      for (let x = CANDLE_X - 1; x <= CANDLE_X + 1; x++) {
        const isTop = y === 20
        c.set(x, y, shade(WAX, isTop ? 4 : 3 - (x - CANDLE_X) * 0.9 - (y - 20) * 0.12, x, y))
      }
    }
    c.set(CANDLE_X + 1, 21, WAX[3] ?? 0)
    c.set(CANDLE_X - 1, 22, WAX[4] ?? 0)
    for (let y = FLAME_Y - 7; y <= FLAME_Y + 3; y++) {
      for (let x = CANDLE_X - 6; x <= CANDLE_X + 6; x++) {
        if (!isGlass(x, y)) continue
        const d = Math.hypot(x - CANDLE_X, (y - FLAME_Y + 1) * 0.9)
        if (d < 2.6) c.tint(x, y, 0xf6c47a, 0.45)
        else if (d < 4.6) c.tint(x, y, 0xc07a6a, 0.24)
      }
    }
    c.set(CANDLE_X, 19, WOOD[0] ?? 0)
    c.set(CANDLE_X - 1, FLAME_Y, FLAME[2] ?? 0)
    c.set(CANDLE_X, FLAME_Y, FLAME[5] ?? 0)
    c.set(CANDLE_X + 1, FLAME_Y, FLAME[1] ?? 0)
    c.set(CANDLE_X, FLAME_Y - 1, FLAME[5] ?? 0)
    if (flameH >= 3) {
      c.set(CANDLE_X - 1, FLAME_Y - 1, FLAME[3] ?? 0)
      c.set(CANDLE_X + 1, FLAME_Y - 1, FLAME[2] ?? 0)
    }
    c.set(CANDLE_X + (flameH >= 3 ? 0 : lean), FLAME_Y - 2, FLAME[flameH >= 3 ? 4 : 2] ?? 0)
    if (flameH >= 3) c.set(CANDLE_X + lean, FLAME_Y - 3, FLAME[flameH >= 4 ? 3 : 1] ?? 0)
    if (flameH >= 4) c.set(CANDLE_X + lean, FLAME_Y - 4, FLAME[1] ?? 0)
    out.push(c.px)
  }
  return out
}
export const scene: Scene = { verb: 'Frosting', render, hero: 66 }