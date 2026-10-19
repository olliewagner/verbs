import { Canvas, PALETTE, TAU, beat, clamp, ease, frames, hash, hex, lerp, mod, particles, shade, smoothstep, type Scene } from '../engine'

const LOOP = 48

const WALL = hex('0d0a14 141020 1c1529 261b33 30223d')
const WOOD = hex('120a0a 1d100e 2b1914 3b231a 503020 6a4029')
const LACQUER = hex('04100f 08191a 0d2528 133337 1b4447 265a5a 357370')
const VELVET = hex('1a0510 2c0819 420d24 5c1430 7a1d3c 9a2a48 bc3e56')
const GOLD = PALETTE.gold
const MIRROR = hex('141c2c 22304a 34486a 4e668a 7290ac a4bccc d4e2ea')
const STEEL = hex('1a1c24 30343e 4c525e 727a86 a6aeb8 e4e8ec')
const TUTU = hex('4a3a56 6e5e80 9a8cac c6bcd6 e6e0f0 fffcff')
const PINK = hex('4a1a30 7a2c48 ac4864 d87488 f4a8b2')
const SKIN = hex('5a302e 8a5048 bc7c66 e2a88a f8d0b2')
const HAIR = hex('180c12 2e1820 4a2a2a')
const MOTE = 0xffe6b8

const FLOOR_Y = 19
const BX = 39
const MIRROR_X = 21.5
const MIRROR_Y = 8

function beam(x: number, y: number): number {
  const half = 1.6 + (y + 5) * 0.24
  return clamp(1 - Math.abs(x - (BX + 0.5)) / half)
}

type V3 = readonly [number, number, number]
type Arm = readonly [V3, V3, V3]

const SECOND: Arm = [[-1.5, -11, 0], [-3.8, -11.3, 0.4], [-6, -10.4, 0.6]]
const FIRST: Arm = [[-1.5, -11, 0], [-3.4, -10, 1.6], [-1, -9.2, 3]]
const CROWN: Arm = [[-1.5, -11.4, 0], [-3, -14, 0.3], [-0.8, -16.2, 0.3]]

const mixV = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
const mixArm = (a: Arm, b: Arm, t: number): Arm => [mixV(a[0], b[0], t), mixV(a[1], b[1], t), mixV(a[2], b[2], t)]
const flipArm = (a: Arm): Arm => [[-a[0][0], a[0][1], a[0][2]], [-a[1][0], a[1][1], a[1][2]], [-a[2][0], a[2][1], a[2][2]]]

function armsOf(f: number): Arm {
  if (f < 8) return SECOND
  if (f < 14) return mixArm(SECOND, FIRST, ease.inOut(beat(f, 8, 13)))
  if (f < 26) return FIRST
  if (f < 32) return mixArm(FIRST, CROWN, ease.outBack(beat(f, 26, 31)))
  if (f < 38) return CROWN
  return mixArm(CROWN, SECOND, ease.inOut(beat(f, 38, 47)))
}

const facing = (f: number) => TAU * (f / LOOP) + 2 * TAU * smoothstep(14, 26, f)

function lift(f: number): number {
  if (f < 10) return Math.sin(TAU * (f / 12)) > 0.7 ? 1 : 0
  if (f < 14) return f < 11 ? 0 : f < 13 ? -1 : 0
  if (f < 26) return 1
  if (f < 36) {
    const t = (f - 26) / 10
    return Math.round(Math.cos(t * TAU * 1.6) * 1.4 * (1 - t))
  }
  return Math.sin(TAU * ((f - 36) / 12)) > 0.7 ? 1 : 0
}

const passe = (f: number) => (f < 13 ? 0 : f < 15 ? beat(f, 13, 15) : f < 26 ? 1 : 1 - beat(f, 26, 28))

type Ink = (ramp: readonly number[], level: number, x: number, y: number) => number

function dancer(c: Canvas, bx: number, by: number, th: number, arms: Arm, leg: number, ink: Ink): void {
  const cos = Math.cos(th)
  const sin = Math.sin(th)
  const project = ([x, y, z]: V3): [number, number, number] => {
    const X = x * cos + z * sin
    const Z = -x * sin + z * cos
    return [bx + 0.5 + X, by + y - Z * 0.22, Z]
  }
  const put = (x: number, y: number, ramp: readonly number[], level: number) => c.set(x, y, ink(ramp, level, x, y))
  const dot = (p: V3, ramp: readonly number[], level: number) => {
    const [x, y] = project(p)
    put(Math.round(x), Math.round(y), ramp, level)
  }
  const limb = (pts: readonly V3[], ramp: readonly number[], level: number) => {
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k] ?? [0, 0, 0]
      const b = pts[k + 1] ?? a
      for (let s = 0; s <= 8; s++) dot(mixV(a, b, s / 8), ramp, level)
    }
  }
  const both = [arms, flipArm(arms)]
  const depth = (a: Arm) => project(a[2])[2] + project(a[1])[2]
  const working: V3[] = [[0.5, -6, 0], mixV([0.5, -3, 0], [3.4, -4.4, 0.9], leg), mixV([0.5, 0, 0], [0.5, -3, 0.3], leg)]
  const legBehind = leg > 0 && project(working[1] ?? [0, 0, 0])[2] < 0

  for (const a of both) if (depth(a) < 0) limb(a, SKIN, 2)
  if (legBehind) limb(working, PINK, 2.6)
  limb([[-0.5, -6, 0], [-0.5, 0, 0]], PINK, 3.4)
  if (!legBehind) limb(working, PINK, 3.8)

  for (let row = -1; row <= 1; row++) {
    const half = row === 0 ? 5.4 : row === -1 ? 4.4 : 3.6
    for (let x = Math.ceil(bx + 0.5 - half); x <= Math.floor(bx + 0.5 + half); x++) {
      const y = by - 7 + row
      const level = row === -1 ? 4.8 : row === 0 ? 4 - Math.abs(x - bx - 0.5) * 0.28 : 2.2
      put(x, y, TUTU, level)
    }
  }
  for (let k = 0; k < 4; k++) {
    const phi = th + (k / 4) * TAU + 0.4
    if (Math.cos(phi) < 0.2) continue
    const x = Math.round(bx + 0.5 + Math.sin(phi) * 5)
    put(x, by - 7, PINK, 3)
  }

  for (const y of [-10, -9, -8]) for (const s of [-0.5, 0.5]) dot([s, y, 0], PINK, y === -10 ? 3.4 : 2.6)
  for (const col of [bx, bx + 1]) put(col, by - 11, SKIN, 3)
  for (const [col, side] of [[bx, -1], [bx + 1, 1]] as const) {
    const isFace = cos > 0.45 || (cos > -0.35 && Math.sign(sin) === side)
    put(col, by - 12, isFace ? SKIN : HAIR, isFace ? 3.4 : 1.4)
    put(col, by - 13, isFace && cos > 0.45 ? SKIN : HAIR, isFace && cos > 0.45 ? 3.8 : 2)
    put(col, by - 14, HAIR, 2.2)
  }
  const bunX = Math.round(bx + 0.5 - sin * 1.4)
  put(cos > 0.3 ? bx + (sin > 0 ? 1 : 0) : bunX, by - 15, HAIR, 1.8)
  if (cos < 0.3) put(bunX, by - 14, HAIR, 2.2)

  for (const a of both) if (depth(a) >= 0) limb(a, SKIN, 3.4)
}

function draw(c: Canvas, f: number): void {
  const spot = 1 + 0.25 * Math.sin(Math.PI * beat(f, 24, 40))
  const lit = (x: number, y: number) => beam(x, y) * spot

  for (let y = 0; y < 29; y++) {
    for (let x = 0; x < 64; x++) {
      const stripe = x % 6 === 0 ? -0.7 : x % 6 === 3 ? 0.4 : 0
      const vig = ((x - 38) / 40) ** 2 * 2 + (y / 40) ** 2
      c.set(x, y, shade(WALL, 2.4 + stripe - vig, x, y))
    }
  }
  for (let y = 29; y < 32; y++) {
    for (let x = 0; x < 64; x++) {
      const grain = Math.sin(x * 0.35 + y * 2.1) > 0.85 ? -0.7 : 0
      const shadow = x >= 8 && x <= 56 && y === 29 ? -2.5 : x >= 9 && x <= 55 && y === 30 ? -1 : 0
      c.set(x, y, shade(WOOD, (y === 29 ? 4 : 2.8 - (y - 30) * 0.7) + grain + shadow - ((x - 34) / 40) ** 2 * 2, x, y))
    }
  }

  for (let y = 0; y <= 15; y++) {
    for (let x = 9; x <= 54; x++) {
      if (x <= 10 || x >= 53) {
        c.set(x, y, shade(LACQUER, x <= 10 ? 2 + (x === 10 ? 0.6 : 0) : x === 53 ? 4.4 : 3.2, x, y))
        continue
      }
      if (x === 11 || x === 52) {
        c.set(x, y, shade(GOLD, 2.2 + lit(x, y) * 2, x, y))
        continue
      }
      const band = mod(y - 1, 4)
      const quilt = band === 0 ? -0.8 : band === 1 ? 0.5 : 0
      const b = lit(x, y)
      c.set(x, y, shade(VELVET, 1.6 + quilt + (b > 0.6 ? 1.6 : b > 0.12 ? 0.8 : 0), x, y))
    }
  }
  for (let y = 2; y <= 15; y++) {
    for (let x = 12; x <= 31; x++) {
      const d = Math.hypot((x - MIRROR_X) / 8, (y - MIRROR_Y) / 6.6)
      if (d > 1) continue
      if (d > 0.86) {
        c.set(x, y, shade(GOLD, 3 + (y < MIRROR_Y ? 1 : -0.8) + (x > MIRROR_X ? 0.6 : 0), x, y))
        continue
      }
      const streak = mod(x + y, 10) < 2 && y < MIRROR_Y ? 1 : 0
      c.set(x, y, shade(MIRROR, 1.6 + (MIRROR_Y - y) * 0.1 + streak, x, y))
    }
  }

  const th = facing(f)
  const up = lift(f)
  const arms = armsOf(f)
  const leg = passe(f)
  const silver: Ink = (r, level, x, y) => {
    if (Math.hypot((x - MIRROR_X) / 8, (y - MIRROR_Y) / 6.6) > 0.86) return c.get(x, y)
    const base = r === TUTU ? 5 : r === HAIR ? 0.6 : 3.6
    return shade(MIRROR, base + (level - 3) * 0.3, x, y)
  }
  dancer(c, Math.round(MIRROR_X - 0.5), 16 - up, th + Math.PI, arms, leg, silver)

  for (let y = 16; y <= FLOOR_Y; y++) {
    for (let x = 10; x <= 53; x++) {
      const pool = Math.max(0, 1 - Math.hypot((x - BX - 0.5) / 6.5, (y - 18.5) / 1.8)) * spot
      c.set(x, y, shade(VELVET, (y === 16 ? 0.4 : 1.8) + (y - 16) * 0.4 + (pool > 0.55 ? 3 : pool > 0.2 ? 1.8 : pool > 0 ? 0.8 : 0), x, y))
    }
  }
  for (const p of particles(f, LOOP, 6, 30, 5)) {
    const y = Math.round(p.r[1] * 4 + p.age * 12)
    const x = Math.round(BX + 0.5 + (p.r[2] - 0.5) * (2 + y * 0.4) + Math.sin(p.t * 0.25 + p.r[3] * 6) * 0.8)
    if (beam(x, y) > 0.25 && Math.sin(p.age * Math.PI) > 0.35) c.set(x, y, MOTE)
  }

  const by = FLOOR_Y - 3 - up
  for (let x = BX - 1; x <= BX + 2; x++) c.set(x, FLOOR_Y, shade(GOLD, x === BX + 2 ? 6 : x === BX - 1 ? 3 : 4.6, 0, 0))
  for (let y = by + 1; y < FLOOR_Y; y++) {
    const k = y - by
    c.set(BX + (k % 2), y, shade(STEEL, 3.4 + (k % 2) * 1.2, 0, 0))
  }
  const warm: Ink = (r, level, x, y) => shade(r, level + 0.4 + (lit(x, y) - 0.7) * 1.1, x, y)
  const speed = Math.abs(facing(f + 0.5) - facing(f - 0.5))
  if (speed > 0.6) {
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI
      const x = Math.round(BX + 0.5 - Math.cos(a) * 7.2)
      const y = Math.round(by - 7 + Math.sin(a) * 1.4)
      if (Math.cos(a + th) > 0.1 || speed > 1.2) c.set(x, y, shade(TUTU, speed > 1.2 ? 3 : 2, 0, 0))
    }
  }
  dancer(c, BX, by, th, arms, leg, warm)

  for (let x = 9; x <= 54; x++) c.set(x, 20, shade(GOLD, 3.6 + (Math.abs(x - BX - 0.5) < 6 ? 1.6 : 0), x, 20))
  for (let y = 21; y <= 27; y++) {
    for (let x = 9; x <= 54; x++) {
      const edge = x === 9 ? -1 : x === 54 ? 0.8 : 0
      c.set(x, y, shade(LACQUER, 4.2 - (y - 21) * 0.42 + edge, x, y))
    }
  }
  for (let x = 9; x <= 54; x++) c.set(x, 28, shade(GOLD, x === 9 ? 1.2 : 2.4, x, 28))
  for (const fx of [11, 51]) {
    c.set(fx, 29, shade(GOLD, 3.6, 0, 0))
    c.set(fx + 1, 29, shade(GOLD, 2, 0, 0))
  }

  const WX0 = 14
  const WX1 = 30
  for (let y = 21; y <= 27; y++) {
    for (let x = WX0; x <= WX1; x++) {
      const isFrame = x === WX0 || x === WX1 || y === 21 || y === 27
      c.set(x, y, isFrame ? shade(GOLD, y === 21 || x === WX0 ? 4 : 2, x, y) : shade(LACQUER, 0.3, x, y))
    }
  }
  const slot = Math.floor(f / 2)
  for (let x = WX0 + 2; x <= WX1 - 2; x++) {
    for (const [row, level] of [[22, 5], [23, 4], [24, 2.6]] as const) {
      const s = mod(row - 22 - slot, 24)
      const isPin = (x - WX0) % 2 === 0 && hash(x, s, 7) > 0.62
      c.set(x, row, isPin ? shade(GOLD, 7, 0, 0) : shade(GOLD, level - (x === WX0 + 2 ? 1 : 0), x, row))
    }
  }
  for (const x of [WX0 + 1, WX1 - 1]) for (let y = 22; y <= 24; y++) c.set(x, y, shade(STEEL, y === 22 ? 3.6 : 2.4, 0, 0))
  for (let x = WX0 + 2; x <= WX1 - 2; x += 2) {
    const plucked = hash(x, mod(2 - slot, 24), 7) > 0.62 && f % 2 === 0
    c.set(x, 25, shade(STEEL, plucked ? 5 : 3.6, 0, 0))
    c.set(x, 26, shade(STEEL, plucked ? 4 : 2.6, 0, 0))
  }
  for (const [dx, dy, l] of [[0, -1, 4.6], [-1, 0, 3.2], [1, 0, 5], [0, 1, 2.6], [0, 0, 6.4]] as const) c.set(42 + dx, 24 + dy, shade(GOLD, l, 0, 0))

  const spin = Math.abs(Math.cos(TAU * (f / 24)))
  c.set(55, 24, shade(GOLD, 2.4, 0, 0))
  c.set(56, 24, shade(GOLD, 3, 0, 0))
  const wing = spin < 0.3 ? 0 : spin < 0.8 ? 1 : 2
  for (let y = 22; y <= 26; y++) {
    const reach = y === 22 || y === 26 ? wing - 1 : wing
    for (let dx = -Math.max(0, reach); dx <= Math.max(0, reach); dx++) {
      if (y === 24 && dx === 0 && wing > 0) continue
      c.set(58 + dx, y, shade(GOLD, 3 + (dx < 0 ? 1.4 : 0) + (y < 24 ? 0.6 : -0.4) + spin * 0.6, 0, 0))
    }
  }
  if (wing === 0) for (let y = 22; y <= 26; y++) c.set(58, y, shade(GOLD, 4.6, 0, 0))
}

export const scene: Scene = { verb: 'Choreographing', render: () => frames(LOOP, draw), hero: 30 }
