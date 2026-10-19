import { Canvas, PALETTE, TAU, beat, hex, lerp, loopNoise, mix, mod, particles, shade, smoothstep, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const TILE = hex('0c1019 121827 1a2236 232e47 2f3d5c 41527a')
const SUN = 0xf6d6a0
const COPPER = PALETTE.copper
const WATER = hex('425a68 668594 93b2bd c4dce1 eaf6f6')
const DULL = hex('2d3a1c 485828 6a7a3a 8f9c54')
const VIVID = hex('063f1c 0b7a2c 22b844 86ee66')
const ENAMEL = hex('0c1438 15245e 213a8a 3355b0 5a7ed0 8ea8e6')
const RIM = hex('aeb8c8 eef2f6')
const ICEWATER = hex('4f97b8 77c0da a8e0ec d6f6f8')
const ICE = hex('6cb0cc a6dcec dff8fc ffffff')
const STEAM = hex('3a4458 5c6679 8e98aa c3cbd6 eaeff4')
const HOB = hex('06070b 0e1017 181b24 262a36 3c4252')
const WOOD = hex('2a160e 422414 5e3518 7c4a20 9a6230 b87e42 d29e5e')
const BAMBOO = hex('4e3818 7e6030 ae9050 d6c07c')
const BRASS = hex('3e2c0e 6c4e1a 9c7c2a c8a644 ecd47e')
const FLAME = PALETTE.gas

const POT = { x: 19, y: 12, rx: 14.5, ry: 3.4, bottom: 23 }
const POT_WATER = { x: 19, y: 12.9, rx: 12.6, ry: 2.4 }
const BOWL = { x: 51, y: 21, rx: 10.5, ry: 2.6, depth: 7 }
const BOWL_WATER = { x: 51, y: 21.3, rx: 9.2, ry: 1.9 }
const COUNTER_Y = 22

const inEllipse = (e: { x: number; y: number; rx: number; ry: number }, x: number, y: number, k = 1) =>
  ((x - e.x) / (e.rx * k)) ** 2 + ((y - e.y) / (e.ry * k)) ** 2 <= 1

const ENTER = 22
const HOVER = 31
const DIP = 37
const SCOOP = 44
const LIFT = 51
const DUNK = 77
const RELEASE = 82
const GONE = LOOP + 3

const boil = (f: number) => 1 - 0.85 * smoothstep(10, 13, f) * (1 - smoothstep(16, 24, f))

type Pt = readonly [number, number]
function glide(t: number, a: number, b: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  const v = 1 / (1 - a / 2 - b / 2)
  if (t < a) return (v * t * t) / (2 * a)
  if (t > 1 - b) return 1 - (v * (1 - t) ** 2) / (2 * b)
  return v * (t - a / 2)
}
function curve(p0: Pt, via: Pt, p1: Pt): (s: number) => [number, number] {
  const pts: [number, number][] = []
  const lens = [0]
  for (let k = 0; k <= 64; k++) {
    const u = k / 64
    pts.push([
      (1 - u) ** 2 * p0[0] + 2 * u * (1 - u) * via[0] + u * u * p1[0],
      (1 - u) ** 2 * p0[1] + 2 * u * (1 - u) * via[1] + u * u * p1[1],
    ])
    if (k) lens.push(lens[k - 1]! + Math.hypot(pts[k]![0] - pts[k - 1]![0], pts[k]![1] - pts[k - 1]![1]))
  }
  const total = lens[64]!
  return s => {
    const at = Math.min(Math.max(s, 0), 1) * total
    let k = 0
    while (k < 63 && lens[k + 1]! < at) k++
    const u = (at - lens[k]!) / Math.max(1e-9, lens[k + 1]! - lens[k]!)
    return [lerp(pts[k]![0], pts[k + 1]![0], u), lerp(pts[k]![1], pts[k + 1]![1], u)]
  }
}
const line = (p0: Pt, p1: Pt) => curve(p0, [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2], p1)

const HOVER_AT: Pt = [17, 3.5]
const SCOOP_AT: Pt = [24, 12]
const BATH_AT: Pt = [50, 19]
const LEGS: readonly { from: number; to: number; path: (s: number) => [number, number]; a: number; b: number }[] = [
  { from: ENTER, to: HOVER, path: line([HOVER_AT[0] + 7.2, HOVER_AT[1] - 7.56], HOVER_AT), a: 0, b: 0.5 },
  { from: HOVER, to: DIP, path: () => [...HOVER_AT], a: 0, b: 0 },
  { from: DIP, to: LIFT, path: curve(HOVER_AT, [15.5, 13.5], SCOOP_AT), a: 0.45, b: 0.3 },
  { from: LIFT, to: DUNK, path: curve(SCOOP_AT, [36, -1], BATH_AT), a: 0.3, b: 0.35 },
  { from: DUNK, to: RELEASE, path: () => [...BATH_AT], a: 0, b: 0 },
  { from: RELEASE, to: GONE, path: curve(BATH_AT, [52, 8], [71, 3]), a: 0.6, b: 0 },
]
function spider(f: number): [number, number] {
  const g = f < ENTER && f + LOOP < GONE ? f + LOOP : f
  const leg = LEGS.find(l => g >= l.from && g < l.to)
  const [x, y] = leg ? leg.path(glide((g - leg.from) / (leg.to - leg.from), leg.a, leg.b)) : [99, -20]
  return [Math.round(x), Math.round(y)]
}
const SPLASH = (() => {
  for (let f = LIFT; f < DUNK; f++) if (spider(f)[1] + 3.4 >= BOWL_WATER.y - BOWL_WATER.ry) return f
  return DUNK
})()

type Bean = { home: [number, number]; slot: [number, number]; bowl: [number, number]; land: number; spin: number }
const BEANS: Bean[] = [
  { home: [10, 12.6], slot: [-3, -0.6], bowl: [45, 21.2], land: 11, spin: 0.22 },
  { home: [14, 13.8], slot: [-1, 0.2], bowl: [48.5, 20.4], land: 11.6, spin: -0.27 },
  { home: [18, 11.9], slot: [1, -0.8], bowl: [53, 21.6], land: 12.2, spin: 0.19 },
  { home: [22, 13.6], slot: [3, 0], bowl: [55.5, 20.6], land: 12.8, spin: -0.24 },
  { home: [26, 12.4], slot: [-1.5, 1.2], bowl: [50, 22.2], land: 13.4, spin: 0.3 },
  { home: [29, 13.5], slot: [1.8, 1.4], bowl: [57.5, 21.8], land: 14, spin: -0.2 },
]

type BeanState = { x: number; y: number; angle: number; green: number; sink: number } | undefined

function beanAt(b: Bean, i: number, f: number, basket: [number, number]): BeanState {
  const green = Math.round(smoothstep(b.land + 4, b.land + 20, f) * 3) / 3
  const start = b.land - 10
  if (f < start) return undefined
  const wobble: [number, number] = [b.home[0] + 1.6 * Math.sin(f * 0.21 + i * 1.7), b.home[1] + 0.7 * Math.sin(f * 0.33 + i * 2.3)]
  const angle = i * 1.1 + f * b.spin
  if (f < b.land) {
    const t = glide(beat(f, start, b.land), 0.5, 0)
    return { x: lerp(b.home[0] - 2, wobble[0], t), y: lerp(-2.5, wobble[1], t), angle, green, sink: 0 }
  }
  const inBasket: [number, number] = [basket[0] + b.slot[0], basket[1] + b.slot[1] - 0.5]
  if (f < SCOOP) return { x: wobble[0], y: wobble[1], angle, green, sink: 0 }
  if (f < LIFT) {
    const t = glide(beat(f, SCOOP, LIFT), 0.35, 0.35)
    return { x: lerp(wobble[0], inBasket[0], t), y: lerp(wobble[1], inBasket[1], t), angle: angle * (1 - t) + i * 0.5 * t, green, sink: 0 }
  }
  if (f < DUNK) return { x: inBasket[0], y: inBasket[1], angle: i * 0.5 + Math.sin(f * 0.4 + i) * 0.15, green, sink: 0 }
  const float: [number, number] = [b.bowl[0] + Math.sin(f * 0.15 + i * 2) * 0.6, b.bowl[1] + Math.sin(f * 0.27 + i) * 0.4]
  if (f < RELEASE) {
    const t = glide(beat(f, DUNK, RELEASE), 0, 0.6)
    return { x: lerp(inBasket[0], float[0], t), y: lerp(inBasket[1], float[1], t), angle: i * 0.5 + t * i * 0.4, green, sink: 0 }
  }
  const sink = beat(f, 86 + i * 0.4, 92 + i * 0.4)
  if (sink >= 1) return undefined
  return { x: float[0], y: float[1] + sink * 1.2, angle: i * 0.9 + (f - RELEASE) * 0.03, green, sink }
}

function drawBean(c: Canvas, s: NonNullable<BeanState>, roll: number) {
  const len = 2.3 * (0.55 + 0.45 * Math.abs(Math.cos(roll)))
  const dx = Math.cos(s.angle)
  const dy = Math.sin(s.angle) * 0.7
  const colour = (level: number) => {
    const k = Math.round(level)
    const base = mix(DULL[k] ?? 0, VIVID[k] ?? 0, s.green)
    return s.sink > 0 ? mix(base, ICEWATER[1] ?? 0, Math.round(s.sink * 3) / 4) : base
  }
  const flat = Math.abs(dx) >= Math.abs(dy)
  const seen = new Set<number>()
  for (let t = -len; t <= len + 0.01; t += 0.4) {
    const x = Math.round(s.x + dx * t)
    const y = Math.round(s.y + dy * t)
    if (seen.has(y * W + x)) continue
    seen.add(y * W + x)
    const tip = Math.abs(t) > len - 0.7
    c.set(x, y, colour(tip ? 1 : 1.4))
    if (!tip) c.set(flat ? x : x - 1, flat ? y - 1 : y, colour(3))
  }
}

function render(): Int32Array[] {
  const out: Int32Array[] = []

  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const b = boil(f)
    const basket = spider(f)

    for (let y = 0; y < COUNTER_Y; y++) {
      for (let x = 0; x < W; x++) {
        const row = Math.floor(y / 3)
        const tx = mod(x + (row % 2) * 3, 7)
        const isGrout = tx === 0 || y % 3 === 0
        const beam = x - 34 + y * 0.9
        const inBeam = beam > 0 && beam < 17
        const edge = inBeam && (beam < 1.5 || beam > 15.5)
        let level = 2.2 - (isGrout ? 1 : 0) + ((tx === 1 || tx === 2) && y % 3 === 1 ? 0.6 : 0)
        if (inBeam) level += edge ? 1 : 1.9
        level -= ((y - 11) / 14) ** 2 * 0.8 + (x < 4 ? 0.5 : 0)
        const col = shade(TILE, level, x, y)
        c.set(x, y, inBeam && !isGrout ? mix(col, SUN, edge ? 0.12 : 0.22) : col)
      }
    }
    for (let y = COUNTER_Y; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const isHob = x < 37
        if (y === COUNTER_Y) {
          c.set(x, y, isHob ? shade(HOB, 3.4, x, y) : shade(WOOD, 5.6, x, y))
          continue
        }
        if (isHob) {
          const sheen = mod(x - y * 1.5, 22) < 2 ? 1 : 0
          c.set(x, y, shade(HOB, 1 + sheen + (x === 36 ? 1.5 : 0), x, y))
        } else {
          const plank = mod(x - 37, 9) === 0
          const grain = mod(x - 37, 9) === 4 && y % 3 !== 0 ? -0.6 : 0
          c.set(x, y, shade(WOOD, 4.4 - (y - COUNTER_Y) * 0.18 + grain - (plank ? 1.2 : 0), x, y))
        }
      }
    }

    for (let x = 7; x <= 31; x++) {
      const n = Math.sin(x * 1.7 + f * 2.1) + Math.sin(x * 0.6 - f * 1.3)
      c.set(x, POT.bottom + 2, shade(FLAME, 1.6 + n * 0.5, x, 0))
      if (n > 0.2) c.set(x, POT.bottom + 1, shade(FLAME, 2.1 + n * 0.6, x, 0))
      c.set(x, POT.bottom + 3, shade(HOB, 2.6, x, 0))
    }
    for (let x = 4; x <= 34; x++) {
      if (x % 6 === 4) for (let y = POT.bottom + 1; y <= POT.bottom + 3; y++) c.set(x, y, shade(HOB, 3.6, x, y))
    }
    for (const kx of [6, 12, 26, 32]) {
      c.set(kx, 29, shade(HOB, 4, 0, 0))
      c.set(kx + 1, 29, shade(HOB, 3, 0, 0))
      c.set(kx, 30, shade(HOB, 2.4, 0, 0))
      c.set(kx + 1, 30, shade(HOB, 1.6, 0, 0))
    }

    for (let y = POT.y; y <= POT.bottom + 1; y++) {
      for (let x = POT.x - POT.rx; x <= POT.x + POT.rx; x++) {
        const u = (x - (POT.x - POT.rx)) / (2 * POT.rx)
        const foot = POT.bottom + Math.sqrt(Math.max(0, 1 - ((x - POT.x) / POT.rx) ** 2)) * 1.4
        if (y > foot) continue
        const glint = u > 0.17 && u < 0.24 ? 2 : 0
        const warm = y >= foot - 1 ? 0.8 : 0
        const level = 2.6 + 2.6 * Math.cos(Math.PI * (u - 0.32)) + glint + warm - (u > 0.93 ? 0.8 : 0)
        c.set(x, y, shade(COPPER, level, x, y))
      }
    }
    for (const [hx, dir] of [[POT.x - POT.rx - 1, -1], [POT.x + POT.rx + 1, 1]] as const) {
      for (const [dx, dy] of [[0, 0], [dir, 0], [dir, 1], [dir, 2], [0, 2]] as const) {
        c.set(hx + dx, POT.y + 2 + dy, shade(BRASS, dir < 0 ? 3.2 : 1.6, 0, 0))
      }
    }
    for (let y = POT.y - 4; y <= POT.y + 4; y++) {
      for (let x = POT.x - POT.rx; x <= POT.x + POT.rx; x++) {
        if (!inEllipse(POT, x, y, 0.94)) continue
        c.set(x, y, shade(COPPER, 1.2 + (x - POT.x) * -0.05, x, y))
      }
    }
    for (let y = POT.y - 3; y <= POT.y + 4; y++) {
      for (let x = POT.x - POT.rx; x <= POT.x + POT.rx; x++) {
        if (!inEllipse(POT_WATER, x, y)) continue
        const churn = loopNoise(x * 0.35, y * 0.7, f / LOOP, 9, 3)
        const back = y <= POT_WATER.y - POT_WATER.ry + 0.6 ? -0.8 : 0
        c.set(x, y, shade(WATER, 2.1 + (churn - 0.5) * 3.4 * (0.35 + 0.65 * b) + back, x, y))
      }
    }
    for (const p of particles(f, LOOP, 200, 4, 7)) {
      if (p.r[3] > b) continue
      const x = Math.round(POT_WATER.x + (p.r[1] * 2 - 1) * (POT_WATER.rx - 1.5))
      const y = Math.round(POT_WATER.y + (p.r[2] * 2 - 1) * (POT_WATER.ry - 0.6))
      if (!inEllipse(POT_WATER, x, y, 0.92)) continue
      if (p.t < 2) {
        c.set(x, y, WATER[4] ?? 0)
        if (p.t === 1) c.set(x + 1, y, WATER[3] ?? 0)
      } else if (p.t === 2) {
        for (const [dx, dy] of [[-1, 0], [2, 0], [0, -1], [1, -1]] as const) c.set(x + dx, y + dy, WATER[4] ?? 0)
        c.set(x, y, WATER[0] ?? 0)
      }
    }

    for (let y = BOWL.y + BOWL.depth - 2; y <= BOWL.y + BOWL.depth + 1; y++) {
      for (let x = BOWL.x - 10; x <= BOWL.x + 13; x++) {
        if (((x - BOWL.x - 1.5) / 10.5) ** 2 + ((y - BOWL.y - BOWL.depth + 0.5) / 1.6) ** 2 <= 1) c.set(x, y, shade(WOOD, 1.6, x, y))
      }
    }
    for (let y = BOWL.y; y <= BOWL.y + BOWL.depth; y++) {
      for (let x = BOWL.x - BOWL.rx; x <= BOWL.x + BOWL.rx; x++) {
        if (((x - BOWL.x) / BOWL.rx) ** 2 + ((y - BOWL.y) / BOWL.depth) ** 2 > 1) continue
        const u = (x - BOWL.x) / BOWL.rx
        const v = (y - BOWL.y) / BOWL.depth
        const glint = u > -0.62 && u < -0.48 && v > 0.2 && v < 0.6 ? 1.4 : 0
        c.set(x, y, shade(ENAMEL, 3 - u * 1.6 - v * 1.8 + glint, x, y))
      }
    }
    for (let y = BOWL.y - 3; y <= BOWL.y + 3; y++) {
      for (let x = BOWL.x - BOWL.rx; x <= BOWL.x + BOWL.rx; x++) {
        if (!inEllipse(BOWL, x, y)) continue
        if (!inEllipse(BOWL, x, y, 0.88)) {
          c.set(x, y, RIM[y > BOWL.y ? 1 : 0] ?? 0)
          continue
        }
        const isWater = inEllipse(BOWL_WATER, x, y)
        c.set(x, y, isWater ? shade(ICEWATER, 1.6 - (x - BOWL.x) * 0.06 + (y > BOWL_WATER.y ? 0.5 : 0), x, y) : shade(ENAMEL, 2.4, x, y))
      }
    }
    const jolt = Math.max(0, 1 - Math.abs(f - SPLASH - 1) / 4)
    const drawIce = () => {
      for (const [k, [ix, iy]] of ([[45, 20.6], [49, 21.6], [54, 20.4], [57, 21.4]] as const).entries()) {
        const bob = Math.round(Math.sin((TAU * 4 * f) / LOOP + k * 1.9) * 0.6 - jolt * (k % 2 ? 1 : 0))
        const push = Math.round(jolt * (ix < BOWL.x ? -1 : 1))
        const x = Math.round(ix) + push
        const y = Math.round(iy) + bob
        c.set(x, y - 1, ICE[3] ?? 0)
        c.set(x + 1, y - 1, ICE[2] ?? 0)
        c.set(x + 2, y - 1, ICE[2] ?? 0)
        c.set(x, y, ICE[2] ?? 0)
        c.set(x + 1, y, ICE[1] ?? 0)
        c.set(x + 2, y, ICE[0] ?? 0)
      }
    }

    const puff = (px: number, py: number, r: number, alpha: number) => {
      for (let y = Math.floor(py - r); y <= Math.ceil(py + r); y++) {
        for (let x = Math.floor(px - r); x <= Math.ceil(px + r); x++) {
          const d = Math.hypot(x - px, (y - py) * 1.15) / r
          const density = alpha * (1.15 - d * d)
          if (d > 1 || density < 0.3) continue
          const lit = x - 34 + y * 0.9 > 0 && x - 34 + y * 0.9 < 17 ? 1 : 0
          c.set(x, y, shade(STEAM, 1.2 + density * 2.2 + lit, x, y))
        }
      }
    }
    for (let k = 0; k < 7; k++) {
      const born = SPLASH + (k % 4)
      const t = mod(f - born, LOOP)
      if (t >= 17) continue
      const x = BOWL.x - 5 + k * 1.7 + Math.sin(t * 0.3 + k) * 1.2
      const y = BOWL.y - 2 - t * (1 + (k % 3) * 0.2)
      const q = 0.95 * Math.min(1, (t + 1) / 3.2, (17 - t) / 8)
      puff(x, y, 2.2 + t * 0.25, 0.3 / (1.15 - q * q))
    }

    const states = BEANS.map((bean, i) => beanAt(bean, i, f, basket))
    const drawBeans = (scooped: boolean) => states.forEach((s, i) => {
      if (s && f >= SCOOP === scooped) drawBean(c, s, f * 0.45 + i * 1.3)
    })
    drawBeans(false)
    for (const bean of BEANS) {
      const t = f - Math.ceil(bean.land)
      if (t < 0 || t > 3) continue
      for (const [vx, vy] of [[-1, -1.4], [1, -1.2], [0.2, -1.8]] as const) {
        c.set(bean.home[0] + vx * t, bean.home[1] + vy * t + 0.35 * t * t, WATER[4] ?? 0)
      }
    }

    const [bx, by] = basket
    const shown = bx < 74
    const underwater = (x: number, y: number) => inEllipse(POT_WATER, x, y) || inEllipse(BOWL_WATER, x, y, 1.05)
    if (shown) {
      for (let t = 1; t < 44; t++) {
        const x = bx + 4 + t
        const y = by - 1 - t * 1.05
        const node = t % 8 === 0
        c.set(x, y, shade(BAMBOO, node ? 1.2 : 3, 0, 0))
        c.set(x + 1, y + 1, shade(BAMBOO, node ? 0.6 : 1.6, 0, 0))
      }
      for (let y = Math.floor(by); y <= Math.ceil(by + 3.4); y++) {
        for (let x = Math.floor(bx - 5.5); x <= Math.ceil(bx + 5.5); x++) {
          if (((x - bx) / 5.5) ** 2 + ((y - by) / 3.4) ** 2 > 1 || y < by) continue
          const wire = ((x + y) & 1) === 0
          const col = shade(BRASS, (wire ? 2.2 : 0.8) - (x - bx) * 0.12, 0, 0)
          c.set(x, y, underwater(x, y) ? mix(col, WATER[1] ?? 0, 0.5) : col)
        }
      }
    }
    drawBeans(true)
    drawIce()
    if (shown) {
      for (let a = 0; a < 40; a++) {
        const th = (a / 40) * TAU
        const x = bx + Math.cos(th) * 5.5
        const y = by + Math.sin(th) * 1.4
        c.set(x, y, shade(BRASS, Math.sin(th) > 0 ? 4 : 2.6, 0, 0))
      }
    }

    for (let k = 0; k < 10; k++) {
      const born = LIFT + 1 + k
      const t = f - born
      if (t < 0 || t > 5) continue
      const [bx, by] = spider(born)
      const x = bx - 3 + ((k * 3) % 7)
      const y = by + 2.5 + 0.6 * t + 0.35 * t * t
      if (inEllipse(POT_WATER, x, y) || y > POT.bottom) continue
      c.set(x, y, WATER[k % 2 ? 3 : 4] ?? 0)
      if (t < 3) c.set(x, y - 1, WATER[2] ?? 0)
    }

    for (const p of particles(f, LOOP, 35, 20, 3)) {
      const x0 = POT.x + (p.r[1] * 2 - 1) * 10
      const x = x0 + Math.sin(p.t * 0.25 + p.r[2] * 6) * 1.5 - p.t * 0.15
      const y = POT.y - 0.5 - p.t * 0.7
      const alpha = Math.sin(Math.PI * p.age ** 0.7) * (0.35 + 0.65 * boil(f - p.t)) * 1.05
      puff(x, y, 1.4 + p.t * 0.17, alpha)
    }
    for (let k = 0; k < 12; k++) {
      const t = f - SPLASH
      if (t < 0 || t > 9) continue
      const vx = ((k % 6) - 2.5) * 0.55
      const vy = -1.4 - ((k * 7) % 5) * 0.3
      const x = BOWL.x + vx * t + (k < 6 ? -2 : 2)
      const y = BOWL.y - 0.5 + vy * t + 0.3 * t * t
      if (y > BOWL.y + 0.5) continue
      c.set(x, y, ICE[k % 2 ? 2 : 3] ?? 0)
      if (t < 4) c.set(x - vx * 0.7, y - vy * 0.7, ICE[1] ?? 0)
    }

    out.push(c.px)
  }

  return out
}

export const scene: Scene = { verb: 'Blanching', render, hero: 36 }
