import { Canvas, TAU, clamp, hash, hex, mod, noise, shade, threshold, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 84

const CLOUD = hex('8fb6dc b3cfe8 d6e6f4 f2f8fd')
const SKY = hex('5a97dc 6aa6e4 7ab5eb 8cc4f1 a2d3f5 bce2f8 d8eefb')
const FAR = hex('4e7f86 5d8f88 6e9f8c 82b090 9ac198')
const HEDGE = hex('173a2a 1f4a2e 2a5c32 387036 4b8639 649c40 82b44c')
const LEAF = hex('0c2416 133420 1c4826 2a6230 3d7e35 579b3b 79b748 a6d562')
const STEM = hex('1c4022 2d5e2a 467e34 66a040')
const CORN = hex('1a1858 2a2a8a 3c45b8 5466dc 7590ee a2bcf8 d0e0ff')
const POPPY = hex('3f0a12 6e1218 a31c1c d2321f f15a2e fb8c52 fdbb86')
const DAISY = hex('6a7894 98a3ba c3cbd9 e2e7ee f7f9fb ffffff')
const DISC = hex('5a2e06 8f520c c47e16 e8aa2a f8d356 fdf09a')
const DARK = hex('120a18 241430 3a2348 55346a')
const POLLEN = hex('c88a12 e8b42c f8d850 fff2a0')
const FUR = hex('6a3c08 a06a12 d49a22 f0c440 fde68a')
const BLACK = hex('0a080c 18141c 2a2430 40384a')
const WING = hex('c4dcef e8f4fc')

type Flower = {
  x: number
  y: number
  r: number
  petals: number
  petalW: number
  spin: number
  ramp: readonly number[]
  disc: readonly number[]
  discR: number
  dip: number
  land: number
  leave: number
  phase: number
}

const FLOWERS: Flower[] = [
  { x: 12, y: 16, r: 6, petals: 8, petalW: 1.3, spin: 0.2, ramp: CORN, disc: DARK, discR: 1.6, dip: 2.6, land: 0, leave: 12, phase: 0 },
  { x: 32, y: 10, r: 7.5, petals: 4, petalW: 4.2, spin: 0.5, ramp: POPPY, disc: DARK, discR: 2.2, dip: 2.2, land: 25, leave: 37, phase: 0.33 },
  { x: 52, y: 14, r: 6.5, petals: 13, petalW: 0.85, spin: 0.1, ramp: DAISY, disc: DISC, discR: 2.1, dip: 2.6, land: 50, leave: 62, phase: 0.66 },
]

const SINK = [0, 0.38, 0.77, 1.1, 1.3, 1.3, 1.1, 1]
function dipOf(fl: Flower, f: number): number {
  const a = mod(f - fl.land, LOOP)
  const stay = mod(fl.leave - fl.land, LOOP)
  const sink = (k: number) => fl.dip * (SINK[Math.min(k, SINK.length - 1)] ?? 1) + (k >= stay - 2 ? 1 : 0)
  if (a < stay) return sink(a)
  const b = a - stay + 0.5
  return sink(stay - 1) * Math.exp(-b / 4) * Math.cos(b * 0.5)
}
const swayOf = (fl: Flower, f: number) => wave(f, LOOP, 1, fl.phase) * 0.6
function headOf(fl: Flower, f: number): [number, number] {
  const d = dipOf(fl, f)
  return [Math.round(fl.x + swayOf(fl, f) + d * 0.3), Math.round(fl.y + d)]
}

function perch(fl: Flower, f: number): [number, number] {
  return [Math.round(fl.x + swayOf(fl, fl.land)), Math.round(fl.y + dipOf(fl, f)) - 2]
}
type Pose = { x: number; y: number; isFlying: boolean; isFacingLeft: boolean; isFront: boolean }

function flown(dist: number, n: number, j: number): number {
  const q = Math.floor(dist / n)
  const long = dist - q * n
  const start = Math.floor((n - long) / 2)
  let x = 0
  for (let k = 0; k < j; k++) x += k >= start && k < start + long ? q + 1 : q
  return x
}

function arcAt(x0: number, y0: number, x1: number, y1: number, lift: number, s: number): [number, number] {
  const mx = (x0 + x1) / 2
  const my = Math.min(y0, y1) - lift
  return [(1 - s) ** 2 * x0 + 2 * (1 - s) * s * mx + s * s * x1, (1 - s) ** 2 * y0 + 2 * (1 - s) * s * my + s * s * y1]
}
function beeAt(f: number): Pose {
  for (let i = 0; i < FLOWERS.length; i++) {
    const prev = FLOWERS[(i + FLOWERS.length - 1) % FLOWERS.length] as Flower
    const fl = FLOWERS[i] as Flower
    const next = FLOWERS[(i + 1) % FLOWERS.length] as Flower
    const a = mod(f - fl.land, LOOP)
    const stay = mod(fl.leave - fl.land, LOOP)
    const isReturn = i === FLOWERS.length - 1
    const cameLeft = fl.x < prev.x
    const goesLeft = next.x < fl.x
    if (a < stay) {
      const [px, py] = perch(fl, f)
      const shuffle = a === 3 || a === 4 ? 1 : 0
      const turn = stay - 4
      const isTurning = cameLeft !== goesLeft
      return {
        x: px + shuffle,
        y: py,
        isFlying: false,
        isFacingLeft: isTurning && a > turn ? goesLeft : cameLeft,
        isFront: isTurning && a === turn,
      }
    }
    const trip = mod(next.land - fl.leave, LOOP)
    if (a - stay < trip) {
      const t = (a - stay) / trip
      const [x0, y0] = perch(fl, fl.leave)
      const [x1, y1] = perch(next, next.land)
      const x = x0 + Math.sign(x1 - x0) * flown(Math.abs(x1 - x0), trip, a - stay)
      const [, y] = arcAt(x0, y0, x1, y1, isReturn ? 16 : 5, x1 === x0 ? t : (x - x0) / (x1 - x0))
      const bob = Math.sin(t * TAU * 2) * Math.sin(t * Math.PI) * (isReturn ? 1.5 : 0.6)
      return { x, y: Math.round(y - bob), isFlying: true, isFacingLeft: goesLeft, isFront: false }
    }
  }
  return { x: 0, y: 0, isFlying: false, isFacingLeft: false, isFront: false }
}
function drawFlower(c: Canvas, fl: Flower, f: number): void {
  const [cx, cy] = headOf(fl, f)
  const tilt = 0.5
  const bx = fl.x + 2
  const by = H + 2
  const sy = cy + 2
  for (let s = 0; s <= 1; s += 0.02) {
    const x = (1 - s) ** 2 * bx + 2 * (1 - s) * s * ((bx + cx) / 2 + 2) + s * s * cx
    const y = (1 - s) ** 2 * by + 2 * (1 - s) * s * ((by + sy) / 2) + s * s * sy
    c.set(x, y, STEM[1] ?? 0)
    c.set(x - 1, y, STEM[2] ?? 0)
  }
  const lx = Math.round(bx + (cx - bx) * 0.45 + 1)
  const ly = Math.round(by + (sy - by) * 0.45)
  c.sprite(lx - 1, ly - 2, ['...bc', '.bcc.', 'abb..'], { a: STEM[1] ?? 0, b: STEM[2] ?? 0, c: STEM[3] ?? 0 })
  const step = TAU / fl.petals
  for (let y = Math.floor(cy - fl.r * tilt - 1); y <= Math.ceil(cy + fl.r * tilt + 1); y++) {
    for (let x = Math.floor(cx - fl.r - 1); x <= Math.ceil(cx + fl.r + 1); x++) {
      const u = x - cx
      const v = (y - cy) / tilt
      const r = Math.hypot(u, v)
      if (r > fl.r) continue
      const a = Math.atan2(v, u) - fl.spin
      const k = Math.round(a / step)
      const arc = Math.abs(a - k * step) * r
      const half = r < fl.discR + 1.2 ? 9 : fl.petalW * Math.sin(Math.PI * Math.min(1, r / fl.r)) ** 0.35
      if (arc > half) continue
      const lit = (-u / fl.r) * 0.9 - (v / fl.r) * 0.45
      const seam = arc > half - 0.75 && r > fl.discR + 1.2 ? -1 : 0
      const inner = r < fl.r * 0.45 ? -0.7 : 0
      const alt = fl.petals > 9 && mod(k, 2) === 1 ? -0.35 : 0
      c.set(x, y, shade(fl.ramp, 3.3 + lit + seam + inner + alt))
    }
  }
  for (let y = cy - 2; y <= cy + 2; y++) {
    for (let x = cx - 3; x <= cx + 3; x++) {
      if (((x - cx) / fl.discR) ** 2 + ((y - cy + 0.3) / (fl.discR * 0.75)) ** 2 > 1) continue
      c.set(x, y, shade(fl.disc, 2.2 - (x - cx) * 0.45 - (y - cy) * 0.6))
    }
  }
  if (fl.ramp === POPPY) {
    for (const [dx, dy] of [[-1, -1], [1, -1], [-2, 0], [2, 0], [0, 1]] as const) c.set(cx + dx, cy + dy, POLLEN[2] ?? 0)
  } else if (fl.ramp === DAISY) {
    c.set(cx - 1, cy - 1, DISC[5] ?? 0)
  }
}
const BEE = [
  '...YYkY..',
  '.wkyykykK',
  'wwkyykykk',
  '.wkookokk',
  '..kook...',
]
const BEE_PAINT = {
  Y: FUR[4] ?? 0, y: FUR[3] ?? 0, o: FUR[1] ?? 0, k: BLACK[1] ?? 0, K: BLACK[3] ?? 0,
  w: DAISY[3] ?? 0,
}
const BEE_FRONT = [
  '..k.k..',
  '.wYYYw.',
  'wyykyyw',
  'wykKkyw',
  '.okkko.',
]
const FLAP: [number, number, number][][] = [
  [[-1, -3, 1], [0, -3, 1], [-1, -4, 1], [0, -4, 0], [-1, -5, 0], [-2, -4, 0]],
  [[-1, -3, 1], [-2, -3, 1], [-1, -4, 1], [-2, -4, 0], [-3, -4, 0]],
  [[-1, -3, 1], [-2, -3, 1], [-3, -3, 0], [-4, -3, 0]],
]
function drawBee(c: Canvas, b: Pose, f: number): void {
  if (b.isFront) {
    c.sprite(b.x - 3, b.y - 3, BEE_FRONT, BEE_PAINT)
    c.set(b.x - 1, b.y + 2, BLACK[1] ?? 0)
    c.set(b.x + 1, b.y + 2, BLACK[1] ?? 0)
    c.set(b.x - 1, b.y + 3, POLLEN[1] ?? 0)
    c.set(b.x + 1, b.y + 3, POLLEN[1] ?? 0)
    return
  }
  const flip = b.isFacingLeft
  const at = (dx: number, dy: number) => [b.x + (flip ? -dx : dx), b.y + dy] as const
  const put = (dx: number, dy: number, col: number) => c.set(...at(dx, dy), col)
  if (b.isFlying) {
    put(-1, 3, BLACK[1] ?? 0)
    put(-1, 4, POLLEN[1] ?? 0)
    put(1, 3, BLACK[1] ?? 0)
  } else {
    put(-1, 3, POLLEN[1] ?? 0)
  }
  c.sprite(b.x - 4, b.y - 2, BEE, BEE_PAINT, flip)
  put(5, -2, BLACK[1] ?? 0)
  const wings = !b.isFlying ? [[-2, -3, 1], [-1, -3, 1], [-3, -3, 0]] as const : (FLAP[mod(f, 3)] ?? [])
  for (const [dx, dy, level] of wings) put(dx, dy, WING[level] ?? 0)
}
const CLOUDS: [number, number, number, number][] = [
  [47, 5, 6, 2.6], [53, 4, 5, 3.2], [58, 5.5, 5, 2.2], [42, 6.5, 4, 1.6], [20, 8, 3.5, 1.4], [24, 7.5, 3, 1.6],
]
type Leaf = { x: number; y: number; angle: number; length: number; width: number; phase: number }
const LEAVES: Leaf[] = [
  { x: -2, y: 33, angle: -0.5, length: 12, width: 2.6, phase: 0 },
  { x: 6, y: 34, angle: -1.15, length: 10, width: 2.4, phase: 0.2 },
  { x: 13, y: 33, angle: -0.35, length: 13, width: 2.8, phase: 0.5 },
  { x: 24, y: 34, angle: -2.4, length: 11, width: 2.5, phase: 0.7 },
  { x: 27, y: 33, angle: -0.75, length: 12, width: 2.7, phase: 0.1 },
  { x: 40, y: 34, angle: -2.7, length: 13, width: 2.6, phase: 0.4 },
  { x: 43, y: 33, angle: -1.3, length: 9, width: 2.3, phase: 0.85 },
  { x: 50, y: 34, angle: -0.6, length: 12, width: 2.7, phase: 0.6 },
  { x: 66, y: 33, angle: -2.5, length: 12, width: 2.6, phase: 0.3 },
]
function drawLeaf(c: Canvas, leaf: Leaf, f: number): void {
  const a = leaf.angle + wave(f, LOOP, 1, leaf.phase) * 0.05
  const ux = Math.cos(a)
  const uy = Math.sin(a)
  for (let y = 18; y < H; y++) {
    for (let x = -1; x <= W; x++) {
      const dx = x - leaf.x
      const dy = y - leaf.y
      const u = dx * ux + dy * uy
      const v = -dx * uy + dy * ux
      if (u < 0 || u > leaf.length) continue
      const half = leaf.width * Math.sin(Math.PI * (u / leaf.length) ** 0.8)
      if (Math.abs(v) > half) continue
      const upper = v * (ux >= 0 ? -1 : 1) > 0
      const rib = Math.abs(v) < 0.5 && u > 2 && u < leaf.length - 3 ? -0.9 : 0
      const edge = Math.abs(v) > half - 0.8 && upper ? 1.2 : 0
      c.set(x, y, shade(LEAF, (upper ? 4.4 : 3) + u / leaf.length + rib + edge))
    }
  }
}
function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    c.fill((x, y) => shade(SKY, y * 0.28 + clamp(1 - Math.hypot(x + 4, y + 6) / 26) * 3))
    for (const [cx, cy, rx, ry] of CLOUDS) {
      c.ellipse(cx, cy, rx, ry, (x, y) => {
        const top = (y - (cy - ry)) / (2 * ry)
        return shade(CLOUD, 3.4 - top * 2.6)
      })
    }
    for (let x = 0; x < W; x++) {
      const far = 13 + Math.round(noise(x * 0.12, 0, 0, 3) * 5 - Math.sin(x * 0.3) * 0.8)
      for (let y = far; y < H; y++) c.set(x, y, shade(FAR, 3.2 - (y - 11) * 0.25))
      const nearAt = (i: number) => 19 + Math.round(noise(i * 0.15, 4, 0, 9) * 3 - Math.abs(Math.sin(i * 0.3)) * 2.4)
      const near = nearAt(x)
      for (let y = near; y < H; y++) {
        const lit = y === near ? 1.8 : y === near + 1 ? 0.8 : 0
        c.set(x, y, shade(HEDGE, (y - near < 2 ? 3.2 + lit : 3.4 - (y - 20) * 0.35)))
      }
    }
    for (let k = 2; k <= 8; k += 2) {
      const then = beeAt(mod(f - k, LOOP))
      if (then.isFlying && beeAt(mod(f - k + 1, LOOP)).isFlying) c.set(then.x - (then.isFacingLeft ? -4 : 4), then.y + 1, k <= 4 ? 0xf4fbff : (SKY[6] ?? 0))
    }
    for (const fl of FLOWERS) drawFlower(c, fl, f)
    for (let y = 27; y < H; y++) for (let x = 0; x < W; x++) c.set(x, y, shade(LEAF, 1.2 - (y - 27) * 0.3))
    for (const leaf of LEAVES) drawLeaf(c, leaf, f)
    for (const [fi, fl] of FLOWERS.entries()) {
      for (const [event, count] of [[fl.land, 7], [fl.leave, 4]] as const) {
        const age = mod(f - event, LOOP)
        if (age > 13) continue
        const [hx, hy] = headOf(fl, event)
        for (let k = 0; k < count; k++) {
          const ang = -Math.PI * (0.1 + 0.8 * hash(fi, event, k))
          const speed = 0.5 + hash(k, event, fi) * 0.7
          const x = hx + Math.cos(ang) * speed * age * 1.6 + wave(age, 13, 1, k * 0.3) * 0.5
          const y = hy - 1 + Math.sin(ang) * speed * age * 1.1 + 0.035 * age * age
          const life = 1 - age / 13
          if (life < threshold(Math.round(x), Math.round(y)) * 0.9) continue
          c.set(x, y, shade(POLLEN, 0.6 + life * 3))
        }
      }
    }
    drawBee(c, beeAt(f), f)
    out.push(c.px)
  }
  return out
}
export const scene: Scene = { verb: 'Pollinating', render, hero: 28 }