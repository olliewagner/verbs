import { Canvas, TAU, beat, clamp, ease, hash, hex, lerp, loopNoise, noise, shade, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72
const HORIZON = 13
const WATERLINE = 24
const SUN_X = 9
const SUN_Y = 5

const SKY = hex('86a2c8 9fb5d2 b8c8da d2d8dc e6e0d2 f4e6c6 fbf2dc')
const HAZE = hex('4f6a7c 5d788a 6f8a98 87a0aa')
const WATER = hex('10263a 163346 1d4254 26535f 32666e 467a7d 63938f 8fb3a8 c2d8c6')
const GOOSE = hex('414962 616a84 8892a9 b3bbcb d9dde4 f1f1ec ffffff')
const BEAK = hex('6a2414 a8401a d8681e f0902e f8b85a')
const FROG = hex('10261a 1c4420 30702a 4f9c34 84c44a c2e27a')
const PAD = hex('0d2220 16382a 205030 2e6c38 468a44')
const REED = hex('0a1a1c 132c2a 1d4038 2a5644 3e6e52')
const CATTAIL = hex('2a1610 482618 66381f 845026')
const MIST = 0xc9d6d2
const SKY_LIFT = hex('86a2c8 9fb5d2 b8c8da d2d8dc e6e0d2 f4e6c6 fbf2dc ffffff')
const BANK_LIFT = hex('4f6a7c 5d788a 6f8a98 87a0aa b4c8d2 dce6ec ffffff')
const WATER_LIFT = hex('10263a 163346 1d4254 26535f 32666e 467a7d 63938f 8fb3a8 c2d8c6 dce6ec ffffff')
const PAD_LIFT = hex('0d2220 16382a 205030 2e6c38 468a44 76a86c b4c8d2 dce6ec ffffff')
const LIFTS = [SKY_LIFT, BANK_LIFT, WATER_LIFT, PAD_LIFT]
const LIFT_OF = new Map<number, [number[], number]>()
for (const r of LIFTS) r.forEach((c, i) => LIFT_OF.has(c) || LIFT_OF.set(c, [r, i]))

function lift(color: number, steps: number, fromTop = false): number {
  let at = LIFT_OF.get(color)
  if (!at) {
    let best = Infinity
    for (const [c, v] of LIFT_OF) {
      const d = Math.abs((c >> 16) - (color >> 16)) + Math.abs(((c >> 8) & 255) - ((color >> 8) & 255)) + Math.abs((c & 255) - (color & 255))
      if (d < best) [best, at] = [d, v]
    }
  }
  if (!at) return color
  const [r, i] = at
  const top = r.length - 1
  return r[fromTop ? Math.max(Math.min(top, i + 1), top - (RING_FULL - steps)) : Math.min(top, i + steps)] ?? color
}
const TREE_TOP: number[] = Array.from({ length: W }, (_, x) =>
  Math.round(9.6 - 3.2 * noise(x * 0.21, 0.5, 0, 7) - 1.5 * noise(x * 0.55, 3.1, 0, 2)))
const treeTop = (x: number) => TREE_TOP[clamp(Math.round(x), 0, W - 1)] ?? 9
function skyLevel(x: number, y: number): number {
  const glow = Math.max(0, 1 - Math.hypot(x - SUN_X, (y - SUN_Y) * 1.3) / 18)
  return (Math.max(0, y) / 12) * 3.6 + glow * glow * 3
}
function treeColor(x: number, y: number): number {
  const top = treeTop(x)
  const isLit = y === top || treeTop(x - 1) > y
  const isCrown = noise(x * 0.45, y * 0.5, 0, 11) > 0.62
  return shade(HAZE, 1.4 + (isLit ? 1 : 0) - (isCrown ? 0.8 : 0) - (y >= 11 ? 0.6 : 0))
}
const ripple = (y: number, f: number) => Math.round(0.65 * Math.sin(y * 1.9 + (f / LOOP) * TAU * 2))
function waterLevel(x: number, y: number, f: number): number {
  if (y === HORIZON) return 4.2
  const xs = x + ripple(y, f)
  const m = 2 * HORIZON - y
  const level = m >= treeTop(xs) ? 2.3 + (m === treeTop(xs) ? 0.7 : 0) : 3.3 + skyLevel(xs, m) * 0.7
  return level - (y - HORIZON) * 0.07
}
type Pose = { hx: number; hy: number; cx: number; cy: number; lean: number; bob: number; isOpen: boolean; tail: number }

const THRUST = [0, 0.25, 0.55, 0.8, 1]
function pose(f: number): Pose {
  const coil = ease.inOut(beat(f, 10, 23 - THRUST.length + 1))
  const k = clamp(f - (23 - THRUST.length + 1), 0, THRUST.length - 1)
  const thrust = lerp(THRUST[Math.floor(k)] ?? 1, THRUST[Math.ceil(k)] ?? 1, k - Math.floor(k))
  const settle = ease.outBack(beat(f, 30, 41))
  const at = (idle: number, back: number, honk: number) => lerp(lerp(lerp(idle, back, coil), honk, thrust), idle, settle)
  const bob = Math.round(wave(f, LOOP, 2, 0.1) * 0.7)
  return {
    hx: Math.round(at(26, 20, 31)),
    hy: Math.round(at(10, 13, 9)) + bob,
    cx: at(20, 25, 27),
    cy: at(12, 17, 15) + bob,
    lean: Math.round(at(0, -1, 1)),
    bob,
    isOpen: f >= 22 && f < 31,
    tail: f >= 42 && f < 50 ? ((f >> 1) % 2 ? 1 : -1) : 0,
  }
}
const mouth = (p: Pose) => ({ x: p.hx + 4, y: p.hy })
const G = { None: 0, White: 1, Wing: 2, Tip: 3, Beak: 4, Lower: 5, Knob: 6, Eye: 7, Mouth: 8 } as const

function gooseMask(p: Pose): Int32Array {
  const m = new Canvas()
  const ox = p.lean
  const oy = p.bob
  m.ellipse(14 + ox, 21.6 + oy, 8.2, 3.5, G.White)
  m.disc(20.5 + ox, 20.6 + oy, 3.4, G.White)
  m.poly([[3.4 + ox + p.tail, 16.4 + oy], [5.2 + ox + p.tail, 16.4 + oy], [11 + ox, 19 + oy], [8 + ox, 23.5 + oy]], G.White)
  m.ellipse(13 + ox, 20.6 + oy, 6.2, 1.8, G.Wing)
  m.poly([[5 + ox + p.tail, 18.5 + oy], [10 + ox, 19.6 + oy], [9 + ox, 21.4 + oy]], G.Tip)
  const bx = 20.5 + ox
  const by = 18.5 + oy
  const ex = p.hx - 0.6
  const ey = p.hy + 1
  for (let t = 0; t <= 1; t += 0.02) {
    const x = (1 - t) ** 2 * bx + 2 * (1 - t) * t * (p.cx + ox) + t * t * ex
    const y = (1 - t) ** 2 * by + 2 * (1 - t) * t * p.cy + t * t * ey
    m.set(x, y, G.White)
    m.set(x + 1, y, G.White)
    if (t < 0.4) m.set(x - 1, y, G.White)
  }
  const X = p.hx
  const Y = p.hy
  m.ellipse(X, Y, 2.5, 1.6, G.White)
  m.set(X - 1, Y + 2, G.White)
  m.set(X + 1, Y - 1, G.Eye)
  m.set(X + 2, Y - 1, G.Knob)
  if (!p.isOpen) {
    m.set(X + 3, Y, G.Beak)
    m.set(X + 4, Y, G.Beak)
    m.set(X + 2, Y + 1, G.Lower)
    m.set(X + 3, Y + 1, G.Lower)
  } else {
    m.set(X + 3, Y - 1, G.Beak)
    m.set(X + 4, Y - 2, G.Beak)
    m.set(X + 3, Y, G.Mouth)
    m.set(X + 3, Y + 1, G.Mouth)
    m.set(X + 2, Y + 1, G.Lower)
    m.set(X + 3, Y + 2, G.Lower)
    m.set(X + 4, Y + 2, G.Lower)
  }
  for (let i = (WATERLINE + 1) * W; i < W * H; i++) m.px[i] = G.None
  return m.px
}
function gooseColors(mask: Int32Array): Map<number, number> {
  const out = new Map<number, number>()
  const at = (x: number, y: number) => (x < 0 || x >= W || y < 0 || y >= H ? G.None : mask[y * W + x] ?? G.None)
  for (let y = 0; y <= WATERLINE; y++) {
    for (let x = 0; x < W; x++) {
      const id = at(x, y)
      if (id === G.None) continue
      const isRim = at(x - 1, y) === G.None || at(x, y - 1) === G.None
      const isShadow = at(x + 1, y) === G.None || at(x, y + 1) === G.None
      let color: number
      if (id === G.White || id === G.Wing || id === G.Tip) {
        let level = id === G.White ? 4.8 : id === G.Wing ? 4.3 : 2.8
        if (isRim) level += 1.3
        if (isShadow) level -= 1.2
        if (y >= WATERLINE - 1) level -= 1.1
        if (y === WATERLINE - 2 && x > 8) level -= 0.5
        if (id === G.Wing && at(x, y - 1) !== G.Wing && at(x, y - 1) !== G.Tip) level -= 1.6
        if (id === G.Tip && at(x, y - 1) !== G.Tip) level -= 0.8
        color = shade(GOOSE, level)
      } else if (id === G.Beak) color = shade(BEAK, isRim ? 4 : 3)
      else if (id === G.Lower) color = BEAK[1] ?? 0
      else if (id === G.Knob) color = BEAK[2] ?? 0
      else if (id === G.Eye) color = 0x15131b
      else color = 0x55182a
      out.set(y * W + x, color)
    }
  }
  return out
}

const SIT = ['pw...pw', 'GGGGGGG', 'dGTTTGd', 'dd...dd']
const STARTLED = ['ww...ww', 'wp...pw', 'GGGGGGG', 'dGTTTGd', 'dd...dd']
const FLUNG = ['d.ww.ww.d', '.dGGGGGd.', '..GTTTG..', '.d.G.G.d.', 'd.......d']
const SURFACED = ['pw.pw', 'GG.GG']
const BLINK = ['GG.GG', 'dd.dd']
function frogPaint(isPulse: boolean): Record<string, number> {
  return {
    G: FROG[4] ?? 0, d: FROG[2] ?? 0, T: isPulse ? 0xf4eebc : 0xd8d494,
    w: 0xffffff, p: 0x101418,
  }
}
const PAD_X = 50
const PAD_Y = 25
const LAUNCH = 31
const SPLASH = 46
const SPLASH_X = 57
const SURFACE = SPLASH + 6
const HOP = SURFACE + 6
const LAND = HOP + 8
const HOP_H = 2
const SURFACE_Y = 26
const STRETCH_FROM = 1.2
const FLIGHT_H = 13
function flight(t: number): { x: number; y: number } {
  const u = Math.min(1, (t - LAUNCH) / (SPLASH - LAUNCH))
  const sink = Math.max(0, t - SPLASH)
  return {
    x: lerp(PAD_X - 4, SPLASH_X - 4, u) + 0.3 * sink,
    y: lerp(PAD_Y - 5, SURFACE_Y - 4.5, u) - FLIGHT_H * 4 * u * (1 - u) + 2 * sink,
  }
}
const RINGS = [23, 26, 29]
const RING_SPEED = 2
const RING_LIFE = 15
const RING_TAIL = [1, 1]

const RING_FULL = 9
const ringLift = (age: number) => clamp(RING_LIFE - 1 - age, 0, RING_FULL)
function reedBend(f: number, x: number): number {
  const sway = 0.6 * wave(f, LOOP, 2, x * 0.13)
  const hit = RINGS[0]! + Math.round((x - 37) / RING_SPEED)
  const k = f - hit
  const push = k < 0 ? 0 : 2.6 * Math.exp(-k / 5) * Math.cos(k * 0.75) * smooth(k / 1.5)
  return sway + (x > 32 ? push : 0)
}
const smooth = (t: number) => ease.out(clamp(t))
function drawReed(c: Canvas, base: number, top: number, bend: number, level: number, isTail: boolean): void {
  let last = base
  for (let y = H - 1; y >= top; y--) {
    const t = (H - 1 - y) / (H - 1 - top)
    const x = Math.round(base + bend * t * t)
    c.set(x, y, shade(REED, level + (y < top + 3 ? 0.6 : 0)))
    if (Math.abs(x - last) > 1) c.set((x + last) / 2, y + 1, shade(REED, level))
    last = x
  }
  if (isTail) {
    const x = Math.round(base + bend)
    for (let k = 0; k < 4; k++) c.set(x, top + 1 + k, shade(CATTAIL, k === 0 ? 3 : k === 3 ? 0.6 : 1.8))
    c.set(x, top, shade(REED, level + 1))
  }
}
function render(): Int32Array[] {
  const origin = mouth(pose(23))
  return Array.from({ length: LOOP }, (_, f) => {
    const c = new Canvas()
    const p = pose(f)

    for (let y = 0; y < HORIZON; y++) {
      for (let x = 0; x < W; x++) {
        if (y >= treeTop(x)) {
          c.set(x, y, treeColor(x, y))
          continue
        }
        const d = Math.hypot(x - SUN_X, y - SUN_Y)
        c.set(x, y, d < 2.2 ? 0xfffbea : d < 3.3 ? SKY[6] ?? 0 : shade(SKY, skyLevel(x, y)))
      }
    }
    for (let y = HORIZON; y < H; y++) {
      for (let x = 0; x < W; x++) c.set(x, y, shade(WATER, waterLevel(x, y, f)))
    }
    for (let y = 8; y < 17; y++) {
      for (let x = 0; x < W; x++) {
        const d = 1 - Math.abs(y - 12.4) / 3.6
        if (d <= 0) continue
        const v = d * (0.2 + 1.1 * loopNoise(x * 0.16, y * 0.45, f / LOOP, 1.5, 5))
        if (v > 0.92) c.set(x, y, MIST)
        else if (v > 0.6) c.tint(x, y, MIST, 0.3)
      }
    }
    for (let k = 0; k < 10; k++) {
      const gy = 18 + Math.floor(hash(k, 1) * 13)
      const gx = Math.floor(hash(k, 2) * 58) + 3
      if (wave(f, LOOP, 2 + (k % 2), hash(k, 3)) < 0.35) continue
      for (let i = 0; i < (gy > 25 ? 3 : 2); i++) c.set(gx + i, gy, WATER[7] ?? 0)
    }
    const mask = gooseMask(p)
    const goose = gooseColors(mask)
    for (const [key, color] of goose) {
      const x = key % W
      const y = Math.floor(key / W)
      const ry = 2 * WATERLINE + 1 - y
      if (ry >= H) continue
      const r = (color >> 16) & 255
      const g = (color >> 8) & 255
      const lum = (r + g + (color & 255)) / 765
      const fade = (ry - WATERLINE) * 0.18
      c.set(x + ripple(ry, f), ry, r > g + 40 ? 0x7a6450 : shade(WATER, 2.6 + lum * 3.4 - fade))
    }
    for (let x = 4 + p.lean; x <= 25 + p.lean; x++) {
      if (wave(f, LOOP, 3, x * 0.06) > -0.5) c.set(x, WATERLINE + 1, WATER[6] ?? 0)
    }
    const waterRing = (cx: number, cy: number, born: number, speed: number, life: number, squash: number) => {
      const age = f - born
      if (age < 0 || age >= life) return
      const r = 2 + age * speed
      const level = age < life * 0.5 ? 7.4 : 6.2
      for (let y = WATERLINE + 1; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const d = Math.hypot(x - cx, (y - cy) / squash)
          if (Math.abs(d - r) < 0.55) c.set(x, y, shade(WATER, level))
        }
      }
    }
    waterRing(20 + p.lean, WATERLINE + 1, 23, 2.2, 16, 0.24)
    waterRing(20 + p.lean, WATERLINE + 1, 27, 1.8, 14, 0.24)
    waterRing(SPLASH_X, 27, SPLASH, 0.9, 16, 0.32)
    waterRing(SPLASH_X, 27, SPLASH + 4, 0.8, 12, 0.32)
    waterRing(55, 26.5, SURFACE, 0.5, 8, 0.4)
    const pad = (cx: number, cy: number, rx: number, ry: number) => {
      c.ellipse(cx, cy + 1, rx, ry, (x, y) => shade(WATER, waterLevel(x, y, f) - 1.2))
      c.ellipse(cx, cy, rx, ry, (x, y) => {
        if (x > cx && x < cx + rx * 0.7 && Math.abs(y - cy) < 0.6 && y <= cy) return undefined
        return shade(PAD, 2.4 + (y < cy ? 1 : 0) - (x > cx + rx * 0.5 ? 0.8 : 0) + (x < cx - rx * 0.6 && y < cy ? 0.7 : 0))
      })
    }
    pad(38, 29, 3.4, 1)
    pad(30, 27, 2.2, 0.7)
    c.set(38, 28, 0xf2a8c0)
    c.set(37, 28, 0xd06890)
    c.set(38, 27, 0xfbd0dc)
    const padDip = f === LAND || f === LAND + 1 || f === LAUNCH || f === LAUNCH + 1 ? 1 : 0
    pad(PAD_X, PAD_Y + padDip, 5, 1.4)
    for (const born of RINGS) {
      const age = f - born
      const steps = ringLift(age)
      if (age < 0 || steps <= 0) continue
      const r = 2 + age * RING_SPEED
      for (let y = 0; y < H; y++) {
        for (let x = origin.x - 2; x < W; x++) {
          const dx = x - origin.x
          const dy = y - origin.y
          const d = Math.hypot(dx, dy)
          if (Math.abs(Math.atan2(dy, dx)) > 0.35 + 0.7 * (steps / RING_FULL)) continue
          const behind = Math.round(r - d)
          const by = behind === 0 ? steps : Math.min(steps, RING_TAIL[behind - 1] ?? 0)
          if (by > 0) c.set(x, y, lift(c.get(x, y), by, behind === 0))
        }
      }
    }
    const isPulse = (f >= 4 && f < 7) || (f >= 14 && f < 17)
    const paint = frogPaint(isPulse)
    if (f < 24 || f >= LAND) {
      c.sprite(PAD_X - 3, PAD_Y - 4 + (f === LAND ? 1 : 0), SIT, paint)
    } else if (f < LAUNCH) {
      c.sprite(PAD_X - 3, PAD_Y - 5, STARTLED, paint)
    } else if (f >= SURFACE && f < HOP) {
      c.sprite(53, 25, f === SURFACE + 2 || f === SURFACE + 3 ? BLINK : SURFACED, paint)
    } else if (f >= HOP) {
      const t = (f - HOP) / (LAND - HOP)
      const y = lerp(25, PAD_Y - 4, t) - HOP_H * 4 * t * (1 - t)
      const wet = (color: number) => (_x: number, y: number) => (y < SURFACE_Y + 1 ? color : undefined)
      c.sprite(lerp(52, PAD_X - 3, t), y, SIT, Object.fromEntries(Object.entries(paint).map(([k, v]) => [k, wet(v)])))
    }
    for (const [key, color] of goose) c.set(key % W, Math.floor(key / W), color)
    if (f >= LAUNCH && f <= SPLASH + 2) {
      const at = flight(f)

      const vy = flight(f + 0.5).y - flight(Math.max(LAUNCH, f - 0.5)).y
      const n = clamp(Math.round(Math.abs(vy) - STRETCH_FROM), 0, 3)
      const art = [...FLUNG.slice(0, 3), ...Array<string>(n).fill(FLUNG[2] ?? ''), ...FLUNG.slice(3)]
      const above = (color: number) => (_x: number, y: number) => (y < SURFACE_Y ? color : undefined)
      c.sprite(at.x, at.y - (vy > 0 ? n : 0), art, Object.fromEntries(Object.entries(paint).map(([k, v]) => [k, above(v)])))
    }
    if (f >= SPLASH && f < SPLASH + 3) {
      const h = [4, 6, 3][f - SPLASH] ?? 0
      for (let k = 0; k < h; k++) {
        c.set(SPLASH_X, 26 - k, WATER[8] ?? 0)
        if (k < h - 2) {
          c.set(SPLASH_X - 1, 26 - k, WATER[7] ?? 0)
          c.set(SPLASH_X + 1, 26 - k, WATER[7] ?? 0)
        }
      }
    }
    for (let k = 0; k < 7; k++) {
      const age = f - SPLASH - 1
      if (age < 0 || age > 7) continue
      const a = -Math.PI / 2 + (k / 6 - 0.5) * 2.4
      const v = 1.1 + hash(k, 9) * 0.6
      const x = SPLASH_X + Math.cos(a) * v * age * 1.2
      const y = 25 + Math.sin(a) * v * age * 1.4 + 0.22 * age * age
      if (y < 27) c.set(x, y, age < 4 ? WATER[8] ?? 0 : WATER[7] ?? 0)
    }
    const reeds: [number, number, number, boolean][] = [
      [58, 18, 2.2, false], [60, 12, 1.4, true], [61, 16, 2.8, false], [62, 9, 1.8, true], [63, 14, 2.4, false],
      [0, 17, 2, true], [1, 21, 2.6, false], [2, 24, 1.6, false],
    ]
    for (const [x, top, level, isTail] of reeds) drawReed(c, x, top, reedBend(f, x), level, isTail)

    const shake = f === 23 ? [1, 0] : f === 24 ? [1, 1] : f === 25 ? [0, 1] : [0, 0]
    const sx = shake[0] ?? 0
    const sy = shake[1] ?? 0
    if (sx === 0 && sy === 0) return c.px
    const out = new Int32Array(W * H)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) out[y * W + x] = c.px[clamp(y - sy, 0, H - 1) * W + clamp(x - sx, 0, W - 1)] ?? 0
    }
    return out
  })
}
export const scene: Scene = {
  verb: 'Honking',
  render,
  hero: 30,
  snaps: [{ frames: 24, why: 'the honk shakes the whole picture a pixel, as a camera would' }],
}
