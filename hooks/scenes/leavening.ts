import { beat, clamp, ease, frames, hash, hex, lerp, particles, random, shade, type Ramp, type Scene } from '../engine'

const W = 64
const LOOP = 72

const SKY = hex('151a3e 222a5c 3a3474 5f3d84 8e4a86 b85c7e dc8478 efb486')
const TOWN = hex('120f2a 1b1838 261f49 342a5c 463a70')
const SNOW = hex('4e4c7e 6f6c9e 9693c0 bdbbdc e2e0f2')
const GLOW = hex('7a3a1c c0702a f2b450 ffe08a fff6d6')
const FRAME = hex('2e1f22 4a3434 6d4f48 937062 b8937c d6b799 ecd8ba')
const WALL = hex('1c0f14 2b151a 3e1d20 552a28 6e3a31 89503c a86a48')
const DOUGH = hex('6e5038 977252 b9946c d4b588 e6d0a6 f3e6c6 fdf7e6')
const GLASS = hex('20243f 3a4064 5d6890 8fa0bf c4d2e2 eef4f6')
const BAND = hex('3e1014 6c1b1c 9c2a22 c8432a e46c40')
const TIN = hex('23232f 3a3a4a 575868 7d7f90 a8aab8 d8d9e2 fbfaf4')
const POT = hex('3a1810 5e2816 87401e ad5a2a cc7a40 e49a5c')
const HERB = hex('0f1d1a 183027 23463a 33604a 4a7c58 6a9a66')
const LINEN = hex('5a4a44 8a7868 b8a690 dccbb0 f1e6cf')
const STRIPE = hex('1c2448 2c3a6e 44569a')

const lamp = (x: number, y: number) => clamp(1.25 - Math.hypot(x + 12, (y - 6) * 1.4) / 64)

type Tone = readonly [Ramp, number]

const HOUSES = [
  { x0: 6, x1: 13, eave: 15, peak: 12 },
  { x0: 14, x1: 19, eave: 16, peak: 14 },
  { x0: 22, x1: 29, eave: 14, peak: 11 },
  { x0: 33, x1: 40, eave: 15, peak: 12 },
  { x0: 45, x1: 50, eave: 16, peak: 13 },
  { x0: 51, x1: 57, eave: 14, peak: 10 },
] as const
const LIT = new Set([[8, 17], [11, 17], [16, 18], [24, 16], [27, 16], [36, 17], [46, 18], [48, 18], [53, 16], [53, 17], [55, 17]].map(([x, y]) => (y ?? 0) * W + (x ?? 0)))
const STARS = [[9, 2], [16, 5], [25, 1], [36, 3], [41, 7], [56, 6], [46, 1]] as const
const MOON = ['.MM', 'M..', 'M..', '.MM']
const LEAVES = [[9.6, 14.6, 1], [14.6, 14.2, 1.2], [12, 12.2, 1.6], [10.2, 17.2, 2.4], [14.2, 17.4, 2.2], [12.2, 15.6, 2.8]] as const

const isPane = (x: number, y: number) => y <= 20 && ((x >= 6 && x <= 19) || (x >= 22 && x <= 41) || (x >= 44 && x <= 57))
const hillY = (x: number) => 13.2 + 1.3 * Math.sin(x * 0.14 + 0.6) + 0.8 * Math.sin(x * 0.37)

function backdrop(x: number, y: number, f: number): Tone {
  const lit = lamp(x, y)
  if (y >= 24) {
    if (y <= 25 && x >= 1 && x <= 62) {
      const jarShadow = (x >= 39 && x <= 45 - (y - 24) * 2) || (y === 25 && x >= 26 && x <= 38) ? 1.5 : 0
      return [FRAME, 3.6 + lit * 1.8 - (y === 24 ? 0.5 : 0) - jarShadow]
    }
    if (y === 26 && x >= 1 && x <= 62) return [FRAME, 4.6 + lit * 1.6]
    if (y === 27 && x >= 1 && x <= 62) return [FRAME, 2 + lit * 1.4]
    if (y === 28) return [WALL, 0.4 + lit]
    if (x >= 12 && x <= 51) {
      if (y === 29) return [FRAME, 2.6 + lit * 2]
      if ((x - 12) % 3 === 2) return [WALL, 0.3]
      return [FRAME, 2 + lit * 1.6 - (y - 30) * 0.5 + ((x - 12) % 3 === 0 ? 0.5 : 0)]
    }
    return [WALL, 1.3 + lit * 3]
  }
  if (x <= 2 || x >= 61) return [WALL, 1.6 + lit * 4]
  if (y >= 21 || x <= 5 || x >= 58 || x === 20 || x === 21 || x === 42 || x === 43) {
    const facing = x === 3 || x === 20 || x === 42 ? 0.7 : x === 5 || x === 21 || x === 43 || x === 60 ? -0.9 : 0
    const sill = y === 21 ? -1 : y === 23 ? 0.4 : 0
    const shadow = y >= 21 && x >= 39 && x <= 41 ? 1.2 : 0
    return [FRAME, 2.4 + lit * 3 + facing + sill - shadow]
  }
  for (const [p0, p1] of [[6, 19], [22, 41], [44, 57]] as const) {
    if (x < p0 || x > p1) continue
    const d = Math.min(x - p0, p1 - x) * 0.9 + (20 - y) * 1.3
    if (d < 2.4 + Math.sin(x * 1.3) * 0.8) return [SNOW, d < 1.3 ? 4 : 3]
  }
  if (y >= 19) return [SNOW, y === 19 ? 2.2 : 1.6]
  if (x >= 55 && x <= 56 && y >= 9 && y <= 12) return [TOWN, y === 9 ? 3 : 0.6]
  for (const h of HOUSES) {
    if (x < h.x0 || x > h.x1) continue
    const mid = (h.x0 + h.x1) / 2
    const roof = Math.round(h.peak + ((h.eave - h.peak) * Math.abs(x - mid)) / ((h.x1 - h.x0) / 2))
    if (y < roof) continue
    if (y === roof) return [SNOW, x < mid ? 1.6 : 2.4]
    if (LIT.has(y * W + x)) return [GLOW, 2.4 + ((x + y + Math.floor(f / 18)) % 3 === 0 ? 0.3 : 0)]
    return [TOWN, y <= h.eave ? 0.6 : 1]
  }
  if (y >= hillY(x)) return [TOWN, 2.6 - (y - hillY(x)) * 0.25]
  const star = STARS.some(([sx, sy]) => sx === x && sy === y)
  if (star) return [SNOW, (x * 3 + Math.floor(f / 6)) % 5 === 0 ? 2.6 : 4]
  const moon = MOON[y - 2]?.[x - 50] === 'M'
  if (moon) return [GLOW, 4]

  return [SKY, y * 0.48]
}

function rise(f: number): { r: number; d: number; spill: number } {
  const t = beat(f, 2, 40)
  const r = f < 40 ? 0.45 * t + 0.55 * ease.inOut(t) : f < 63 ? 1 : (1 + Math.cos(Math.PI * beat(f, 63, 71))) / 2
  let d = 0
  if (f >= 40 && f < 48) d = 2.6 * ease.out(beat(f, 40, 46))
  else if (f >= 48 && f < 58) d = f === 48 ? 3.6 : f === 49 ? 3.3 : 3
  else if (f >= 58 && f < 64) d = 3 * (1 - ease.inOut(beat(f, 58, 64)))
  const spill = f === 46 || f === 47 ? 1.5 : d > 0 ? 0.8 : 0

  return { r, d, spill }
}

function jarRow(y: number): readonly [number, number] | undefined {
  if (y === 9 || y === 10) return [27, 36]
  if (y === 11) return [26, 37]
  if (y >= 12 && y <= 23) return [25, 38]
  if (y === 24) return [26, 37]
  return undefined
}

const BUBBLES = (() => {
  const next = random(0x1ea7e)
  return Array.from({ length: 11 }, () => ({ u: next(), v: next(), s: next(), at: next() }))
})()

function render(): Int32Array[] {
  const snow = (f: number) => particles(f, LOOP, 13, 66, 3)

  return frames(LOOP, (c, f) => {
    const { r, d, spill } = rise(f)
    const top = Math.round(lerp(19, 9, r))

    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < W; x++) {
        const [ramp, level] = backdrop(x, y, f)
        c.set(x, y, shade(ramp, level))
      }
    }

    for (const p of snow(f)) {
      const x = Math.round(p.r[1] * 60 + 2 + Math.sin(p.t * 0.12 + p.r[2] * 6) * 1.5)
      const y = Math.round(-1 + p.age * 21)
      if (isPane(x, y) && y < 19) c.set(x, y, SNOW[p.r[3] > 0.5 ? 4 : 3] ?? 0)
    }

    c.line(11, 19, 9, 15, HERB[1] ?? 0)
    c.line(12, 19, 14, 14, HERB[1] ?? 0)
    c.line(12, 19, 12, 12, HERB[1] ?? 0)
    for (const [lx, ly, depth] of LEAVES) {
      for (let y = Math.floor(ly - 2); y <= Math.ceil(ly + 2); y++) {
        for (let x = Math.floor(lx - 3); x <= Math.ceil(lx + 3); x++) {
          const u = (x - lx) / 2.7
          const v = (y - ly) / 1.9
          if (u * u + v * v > 1) continue
          const isUnder = (x - lx) / 2.7 + ((y + 1 - ly) / 1.9) ** 2 > 1 && v > 0.3
          c.set(x, y, shade(HERB, depth + (u + v * 1.4 < -0.2 ? 1.1 : 0) - (isUnder ? 0.9 : 0)))
        }
      }
      c.set(Math.round(lx - 1), Math.round(ly - 1), shade(HERB, depth + 2 + lamp(lx, ly)))
    }
    for (let y = 19; y <= 25; y++) {
      const [x0, x1] = y <= 20 ? [8, 15] : y <= 23 ? [9, 14] : [10, 13]
      for (let x = x0; x <= x1; x++) {
        const lit = 2.4 + lamp(x, y) * 1.6 - (x - x0) * 0.32 + (x === x0 ? 0.8 : 0) + (y === 19 ? 1 : y === 20 ? -0.6 : 0)
        c.set(x, y, shade(POT, lit))
      }
    }

    for (let y = 22; y <= 25; y++) {
      for (let x = y === 22 ? 48 : 47; x <= 57; x++) {
        const isStripe = y === 23 && x !== 47
        const lvl = 2.4 + (y === 22 ? 1 : 0) - (y === 25 ? 1 : 0) + (x <= 48 ? 0.4 : 0) - (x - 47) * 0.05
        c.set(x, y, isStripe ? shade(STRIPE, lvl - 1.4) : shade(LINEN, lvl))
      }
    }

    const surfacePop = r > 0.35 && hash(Math.floor(f / 2), 9) < 0.55
    const popX = 28 + Math.floor(hash(Math.floor(f / 2), 4) * 8)
    for (let y = 9; y <= 24; y++) {
      const row = jarRow(y)
      if (!row) continue
      const [x0, x1] = row
      for (let x = x0; x <= x1; x++) {
        const isWall = x === x0 || x === x1 || y === 24
        const lit = lamp(x, y)
        if (isWall) {
          const level = y === 24 ? 1.6 + lit : x === x0 ? 3.2 + lit * 1.6 : 1.4
          c.set(x, y, shade(GLASS, level))
          continue
        }
        const dome = Math.abs(x - 31.5) < 3 && r > 0.05 && r < 1 ? 1 : 0
        const isStarter = y >= top - dome
        if (!isStarter) {
          const [ramp, level] = backdrop(x, y, f)
          const streak = x === 27 && y >= 13 && y <= 20 ? 3 : x === 28 && y >= 13 && y <= 15 ? 1.6 : 0
          c.set(x, y, streak ? shade(GLASS, 3.2 + streak * 0.6) : shade(ramp, level + 0.9))
          continue
        }
        const isTop = y === top - dome
        const side = (31.5 - x) * 0.14
        const streak = x === 27 && y >= 13 && y <= 20 ? 1.2 : 0
        let level = 2.7 + side + lit * 0.9 + (isTop ? 1.3 : 0) + streak - (x === x1 - 1 ? 0.6 : 0)
        if (isTop && surfacePop && x === popX) level = 1.4
        c.set(x, y, shade(DOUGH, level))
      }
    }

    for (const b of BUBBLES) {
      if (b.at > r + 0.25) continue
      const x = 26 + Math.round(b.u * 11)
      const y = Math.round(lerp(22.6, top + 1.5, b.v))
      if (y < top + 1 || y > 23) continue
      const big = b.s * (0.5 + r) > 0.85
      if (big && x < 37) {
        c.set(x, y, shade(DOUGH, 1.4))
        c.set(x + 1, y, shade(DOUGH, 1.9))
        if (y < 23) {
          c.set(x, y + 1, shade(DOUGH, 3.4))
          c.set(x + 1, y + 1, shade(DOUGH, 5))
        }
      } else {
        c.set(x, y, shade(DOUGH, 1.7))
        if (y < 23) c.set(x, y + 1, shade(DOUGH, 4.6))
      }
    }

    for (let y = 13; y <= 20; y++) c.set(27, y, shade(GLASS, y === 13 || y === 20 ? 3.6 : 4.6))
    c.set(28, 13, shade(GLASS, 4))
    c.set(28, 14, shade(GLASS, 3.6))
    c.set(36, 15, shade(GLASS, 3))
    c.set(36, 16, shade(GLASS, 3))
    c.set(28, 10, shade(GLASS, 4.4))
    c.set(29, 10, shade(GLASS, 3.8))
    c.set(35, 10, shade(GLASS, 2.6))

    let lidTop = 7
    if (d > 0) {
      for (let k = 1; k <= 4; k++) {
        const t = (k - 0.5) / (d + 0.3)
        if (t >= 1) break
        const y = 9 - k
        const hw = (4 + spill) * Math.sqrt(1 - t * t)
        lidTop = y - 2
        for (let x = Math.ceil(31.5 - hw); x <= Math.floor(31.5 + hw); x++) {
          const isEdge = Math.abs(x - 31.5) > hw - 1
          const level = 3.2 + (31.5 - x) * 0.16 + (k === Math.floor(d + 0.3) ? 1.2 : 0.4) + lamp(x, y) * 0.8 - (isEdge && x > 31.5 ? 0.8 : 0)
          c.set(x, y, shade(DOUGH, level))
        }
      }
    }

    for (let x = 24; x <= 39; x++) {
      const level = x === 24 ? 2 : x === 39 ? 0.6 : 3.6 - (x - 25) * 0.16 + (x === 26 ? 0.8 : 0)
      c.set(x, 17, shade(BAND, level))
    }

    let lidY = lidTop + 0.5
    let tilt = 0
    if (f >= 43 && f < 48) tilt = f % 2 ? 0.1 : -0.1
    if (f >= 48 && f < 56) {
      const t = beat(f, 48, 56)
      lidY -= 20 * t * (1 - t)
      tilt = -0.42 * Math.sin(Math.PI * t * 1.4)
    } else if (f >= 56 && f < 62) {
      tilt = 0.14 * Math.sin((f - 56) * 2.2) * (1 - beat(f, 56, 62))
    }
    const cos = Math.cos(tilt)
    const sin = Math.sin(tilt)
    for (let y = Math.floor(lidY - 4); y <= Math.ceil(lidY + 4); y++) {
      for (let x = 23; x <= 40; x++) {
        const lx = (x - 31.5) * cos + (y - lidY) * sin
        const ly = -(x - 31.5) * sin + (y - lidY) * cos
        if (Math.abs(lx) > 5.8 || Math.abs(ly) > 0.95) continue
        const glint = ly < 0 && lx > -4.6 && lx < -3.4 ? 1.6 : 0
        const level = (ly < 0 ? 4.4 : 2.4) + lamp(x, y) * 0.8 - (lx + 5.8) * 0.13 + glint
        c.set(x, y, shade(TIN, level))
      }
    }

    if (f === 48 || f === 49) {
      const r0 = f === 48 ? 7 : 9
      for (const a of [-2.75, -2.25, -0.9, -0.4, 0.25, 2.9]) {
        for (const k of [0, 1]) c.set(31.5 + Math.cos(a) * (r0 + k), lidTop + 1 + Math.sin(a) * (r0 + k) * 0.55, GLOW[f === 48 ? 4 : 3] ?? 0)
      }
    }
    if (f === 56 || f === 57) {
      const gx = 36
      const gy = lidTop
      c.set(gx, gy, GLOW[4] ?? 0)
      if (f === 56) for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1], [0, 1]] as const) c.set(gx + dx, gy + dy, GLOW[3] ?? 0)
    }
  })
}

export const scene: Scene = {
  verb: 'Leavening',
  render,
  hero: 50,
  snaps: [{ frames: 49, box: [16, 0, 41, 6], why: 'the pop: the lid flies off the jar fast and the bright dashes from the rim spread and dim' }],
}
