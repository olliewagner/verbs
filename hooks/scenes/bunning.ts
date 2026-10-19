import { Canvas, PALETTE, ease, hash, hex, lightAt, mix, mod, particles, random, shade, type Light, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 48
const CX = 31.5

const LACQUER = hex('080406 10070a 1a0b0d 260f10 341512 461c15 5c2618 763219')
const GOLD = hex('3a2008 6a420e a06c1a d09a30 f0c858 fce89a')
const PAPER = hex('3a0a0c 6a1214 9c1e18 c83420 e85a2a f88a3c fcc070 fee8b0')
const BAMBOO = hex('2b1714 4a2a1c 6e4426 94632f b8853b d6a84e ebcb76 f8e6a8')
const BUN = hex('4e4560 7b6d86 a898ab d3c7cd ece4e0 fbf7f0 ffffff')
const RED = hex('5a1420 9a2430 d4443c')
const WOK = hex('09080c 141218 1f1b24 2d2833 3f3846 554c5c 72677a 9a8c9c c8bcc4')
const WATER = hex('140a08 22140f 3a2618 6a4a2c a8885a')
const GAS = PALETTE.gas
const COUNTER = hex('0a0506 140a0a 1f100f 2c1814 3c2219 50301f')
const CLAY = hex('25100f 42201a 662f22 8a432e ab5c3b c47a50 dc9c6e')
const STEAM = hex('4e403c 7e6e64 ac9c8e dacebf f6eee4')
const GLOW = hex('6e4a26 a67a36 d4aa58 f2d48c fdf0c8')

const LAMP_X = 7
const LAMP_Y = 6
const SUN: Light[] = [{ x: LAMP_X, y: LAMP_Y, power: 2.3, radius: 54 }]
const sun = (x: number, y: number) => lightAt(SUN, x, y)
const RAIL_Y = 18
const vignette = (x: number, y: number) => (((x - 30) / 44) ** 2 + ((y - 14) / 28) ** 2) * 1.3

const inBeam = (x: number, y: number) => Math.hypot(x - LAMP_X, (y - LAMP_Y) * 1.2) < 22

const LIFT = [
  0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 2,
  4, 6, 8, 9, 9, 9, 9, 9, 9, 9, 9, 9,
  9, 9, 9, 9, 8, 7, 5, 4, 2, 0, 1, 1,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
]
const TILT = [
  0, 0, 1, 1, 0, 0, -1, -1, 0, 0, 0, 0,
  1, 2, 2, 1, 0, -1, -1, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, -1, -1, -1, -1, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
]
const liftAt = (f: number) => LIFT[((Math.round(f) % LOOP) + LOOP) % LOOP] ?? 0
const isOpen = (f: number) => liftAt(f) >= 3

const BY = 15
const BRX = 13
const BRY = 3
const LY = 12
const LRX = 13.6
const LRY = 3.1
const BAND = 3
const WY = 21
const WRX = 18.5
const WRY = 2
const WDEPTH = 7

const across = (x: number, rx: number) => Math.sqrt(Math.max(0, 1 - ((x - CX) / rx) ** 2))

const BUNS = [
  { x: 24.5, delay: 1, spark: 25 },
  { x: 31.5, delay: 0, spark: 21 },
  { x: 38.5, delay: 2, spark: 28 },
]
const BUN_BASE = 16
function squash(f: number, delay: number): number {
  const t = f - 12 - delay
  if (t < 0 || f > 33) return -0.3
  return -0.34 * Math.exp(-t / 4.5) * Math.cos(t * 1.05)
}

type Puff = { born: number; life: number; x: number; y: number; dx: number; dy: number; r0: number; r1: number; a: number; front: boolean }

const PUFFS: Puff[] = (() => {
  const rng = random(0xba0b)
  const out: Puff[] = []
  for (const [f, side] of [[2, 1], [6, -1], [10, 1], [10, -1]] as const) {
    out.push({ born: f, life: 6, x: CX + side * 13, y: 16, dx: side * 3, dy: -3, r0: 1, r1: 2, a: 0.9, front: true })
  }
  for (let k = 0; k < 12; k++) {
    const x = 20 + (k / 11) * 23 + (rng() - 0.5) * 3
    out.push({
      born: 12 + rng() * 2.5, life: 6 + rng() * 4, x, y: 13.5,
      dx: (x - CX) * 0.3, dy: -(2 + rng() * 4), r0: 2.6, r1: 4, a: 1.5, front: true,
    })
  }
  for (let k = 0; k < 16; k++) {
    const x = CX + (rng() - 0.5) * 26
    out.push({
      born: 12 + (k / 16) * 4, life: 8 + rng() * 6, x, y: 13,
      dx: (x - CX) * 0.8 + (rng() - 0.5) * 5, dy: -(9 + rng() * 10), r0: 2, r1: 3.4 + rng() * 2, a: 1.3,
      front: false,
    })
  }
  for (let k = 0; k < 9; k++) {
    out.push({
      born: 17 + k * 1.3, life: 9 + rng() * 4, x: 22 + rng() * 19, y: 11.5,
      dx: (rng() - 0.5) * 4, dy: -(4 + rng() * 4), r0: 1, r1: 2, a: 0.62, front: false,
    })
  }
  for (let k = 0; k < 8; k++) {
    const side = k % 2 ? 1 : -1
    out.push({
      born: 33 + rng() * 1.6, life: 7 + rng() * 4, x: CX + side * 13.5, y: 16,
      dx: side * (5 + rng() * 6), dy: -(1.5 + rng() * 4), r0: 0.5, r1: 2.6, a: 1, front: true,
    })
  }

  return out
})()

function addPuff(fog: Float32Array, px: number, py: number, r: number, alpha: number): void {
  for (let y = Math.floor(py - r); y <= Math.ceil(py + r); y++) {
    for (let x = Math.floor(px - r); x <= Math.ceil(px + r); x++) {
      if (x < 0 || x >= W || y < 0 || y >= H) continue
      const d = Math.hypot(x - px, (y - py) * 1.15) / r
      if (d >= 1) continue
      fog[y * W + x] = Math.min(1.4, (fog[y * W + x] ?? 0) + alpha * (1.1 - d * d))
    }
  }
}

function drawFog(c: Canvas, fog: Float32Array): void {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = fog[y * W + x] ?? 0
      if (d < 0.34) continue
      const ramp = inBeam(x, y) ? GLOW : STEAM
      if (d < 0.6) {
        c.set(x, y, mix(c.get(x, y), ramp[4] ?? 0, 0.45))
        continue
      }
      const above = fog[(y - 1) * W + x - 1] ?? 0
      c.set(x, y, shade(ramp, 2.4 + Math.min(1, (d - 0.55) / 0.5) * 1.4 + (above < d - 0.2 ? 0.6 : 0)))
    }
  }
}

function drawWall(c: Canvas, f: number): void {
  for (let y = 0; y < 29; y++) {
    for (let x = 0; x < W; x++) {
      const lit = sun(x, y) * 1.4 - vignette(x, y)
      if (y === RAIL_Y) {
        c.set(x, y, shade(GOLD, 1.6 + sun(x, y) * 1.8 - vignette(x, y) * 0.6))
        continue
      }
      if (y === RAIL_Y + 1) {
        c.set(x, y, shade(LACQUER, 0.4))
        continue
      }
      if (y > RAIL_Y) {
        const groove = mod(x, 5) === 4 ? -0.8 : 0
        c.set(x, y, shade(LACQUER, 1.4 + lit * 0.8 + groove))
        continue
      }
      const px = mod(x - 4, 16)
      const isFrame = px < 2 || y < 2 || y > RAIL_Y - 3
      if (isFrame) {
        const edge = (px === 0 && y >= 2 && y <= RAIL_Y - 3) || y === 0 || y === RAIL_Y - 2 ? 0.8 : 0
        c.set(x, y, shade(LACQUER, 2.4 + lit + edge))
        continue
      }
      const recess = y === 2 || px === 2 ? -0.8 : 0
      const sheen = px >= 5 && px <= 6 && sun(x, y) > 1.3 ? 1 : 0
      c.set(x, y, shade(LACQUER, 1.8 + lit + recess + sheen))
    }
  }
  const breath = f % 11 === 4 ? -0.3 : 0
  for (let x = LAMP_X - 1; x <= LAMP_X; x++) for (let y = 0; y <= 1; y++) c.set(x, y, shade(GOLD, x === LAMP_X - 1 ? 2 : 1))
  for (let y = 2; y <= 10; y++) {
    for (let x = LAMP_X - 5; x <= LAMP_X + 4; x++) {
      const dx = (x + 0.5 - LAMP_X) / 4.7
      const dy = (y - LAMP_Y) / 4.4
      const r = dx * dx + dy * dy
      if (r > 1) continue
      if (y === 2 || y === 10) {
        if (Math.abs(dx) < 0.62) c.set(x, y, shade(GOLD, 3.6 - dx * 2 + (y === 10 ? -0.8 : 0)))
        continue
      }
      const rib = (x === LAMP_X - 3 || x === LAMP_X + 2) && r < 0.8 ? -1 : 0
      c.set(x, y, shade(PAPER, 2 + (1 - r) * 4.6 - dx * 0.8 + rib + breath))
    }
  }
  const swing = f >= 13 && f <= 20 ? 1 : 0
  for (let y = 11; y <= 14; y++) c.set(LAMP_X - 1 + (y > 12 ? swing : 0), y, shade(GOLD, 3.4 - (y - 11) * 0.5))
  c.set(LAMP_X + swing, 14, shade(GOLD, 1.6))
}

function drawCounter(c: Canvas, f: number): void {
  for (let x = 0; x < W; x++) {
    c.set(x, 29, shade(COUNTER, 4 + sun(x, 29) * 1.6 - vignette(x, 29) * 0.8))
    for (let y = 30; y < H; y++) c.set(x, y, shade(COUNTER, 1.8 + sun(x, y) * 1.2 - (y - 30) * 0.6 - vignette(x, y) * 0.6))
  }
  for (let x = 19; x <= 44; x++) c.set(x, 28, shade(WOK, 1.4))
  for (let x = 20; x <= 43; x++) {
    const n = Math.sin(x * 1.9 + f * 2.3) + Math.sin(x * 0.7 - f * 1.4)
    c.set(x, 27, shade(GAS, 1.3 + n * 0.5))
    if (n > 0.6) c.set(x, 26, shade(GAS, 2 + n * 0.5))
  }
  const tp = 58
  for (let y = 22; y <= 28; y++) {
    for (let x = 53; x <= 63; x++) {
      const dx = (x - tp) / 4.2
      const dy = (y - 25.6) / 3
      if (dx * dx + dy * dy > 1) continue
      const lit = sun(x, y) * 1.4 - dx * 1.5 - dy * 1.1 + (x === 56 && y === 24 ? 1.4 : 0)
      c.set(x, y, shade(CLAY, 2.6 + lit))
    }
  }
  for (let x = 55; x <= 60; x++) c.set(x, 22, shade(CLAY, 4 - (x - 55) * 0.45))
  c.set(57, 21, shade(CLAY, 4.4))
  c.set(58, 21, shade(CLAY, 3.2))
  for (const [x, y] of [[62, 24], [63, 23], [63, 22]] as const) c.set(x, y, shade(CLAY, 2.2))
  for (const [x, y] of [[53, 24], [52, 25], [52, 26], [53, 27]] as const) c.set(x, y, shade(CLAY, 3.2))
}

function drawWokBack(c: Canvas, f: number): void {
  for (let x = 13; x <= 50; x++) {
    const s = across(x, WRX)
    if (s <= 0) continue
    const far = Math.round(WY - WRY * s)
    const near = Math.round(WY + WRY * s)
    c.set(x, far, shade(WOK, 4.6 + sun(x, far) * 1.2 - (x - CX) * 0.05))
    for (let y = far + 1; y < near; y++) {
      const bubble = hash(x, y, Math.floor(f / 2)) > 0.9 && y === near - 1
      c.set(x, y, shade(WATER, y === far + 1 ? 0.4 : 1.5 + (bubble ? 2.4 : 0)))
    }
  }
}

function drawBasket(c: Canvas, f: number): void {
  const inOuter = (x: number, y: number) => ((x - CX) / BRX) ** 2 + ((y - BY) / BRY) ** 2 <= 1
  const inInner = (x: number, y: number) => ((x - CX) / (BRX - 1.1)) ** 2 + ((y - BY) / (BRY - 0.9)) ** 2 <= 1
  for (let y = 10; y <= BY; y++) {
    for (let x = 18; x <= 45; x++) {
      if (!inOuter(x, y)) continue
      const nx = (x - CX) / BRX
      if (inInner(x, y)) c.set(x, y, shade(BAMBOO, 0.6 + Math.max(0, nx) * 2.6 + (y > BY - 1 ? -0.4 : 0)))
      else c.set(x, y, shade(BAMBOO, 4.6 - nx * 1.4))
    }
  }
  for (const b of BUNS) {
    const s = squash(f, b.delay)
    const rx = 3.9 * (1 - s * 0.45)
    const ry = 4.4 * (1 + s)
    const top = BUN_BASE - ry
    for (let y = Math.floor(top); y <= BUN_BASE + 1; y++) {
      for (let x = Math.floor(b.x - rx); x <= Math.ceil(b.x + rx); x++) {
        const nx = (x - b.x) / rx
        const ny = Math.min(0, (y - BUN_BASE) / ry)
        const r2 = nx * nx + ny * ny
        if (r2 > 1) continue
        const nz = Math.sqrt(1 - r2)
        const lit = -nx * 0.55 - ny * 0.5 + nz * 0.62
        const edge = r2 > 0.72 && nx > 0.2 ? -0.6 : 0
        c.set(x, y, shade(BUN, 0.6 + lit * 4.6 + edge + (y > BUN_BASE - 1 ? -1 : 0)))
      }
    }
    const ty = Math.round(top + 0.9)
    c.set(b.x - 0.5, ty, RED[2] ?? 0)
    c.set(b.x + 0.5, ty, RED[1] ?? 0)
    c.set(b.x - 0.5, ty + 1, RED[0] ?? 0)
    c.set(b.x - 2, top + 1.6, BUN[6] ?? 0)
  }
  const shut = liftAt(f) === 0
  for (let x = 18; x <= 45; x++) {
    const s = across(x, BRX)
    if (s <= 0) continue
    const nx = (x - CX) / BRX
    const front = BY + BRY * s
    for (let y = BY + 1; y <= WY + 4; y++) {
      if (inOuter(x, y)) {
        if (!inInner(x, y)) c.set(x, y, shade(BAMBOO, 5.4 - nx * 1.8))
        continue
      }
      const k = y - Math.round(front)
      const lit = -nx * 0.6 + s * 0.7
      const groove = k === 1 ? -1.2 : k === 4 ? -0.8 : 0
      const lash = (k === 2 || k === 3) && Math.abs(Math.asin(clampUnit(nx)) % 0.55) < 0.07 ? 1 : 0
      const hidden = shut && k <= 1 ? -0.8 : 0
      c.set(x, y, shade(BAMBOO, 2.4 + lit * 2.4 + groove + lash + hidden))
    }
  }
}

const clampUnit = (v: number) => Math.max(-1, Math.min(1, v))

function drawWokFront(c: Canvas): void {
  for (let x = 13; x <= 50; x++) {
    const s = across(x, WRX)
    if (s <= 0) continue
    const nx = (x - CX) / WRX
    const near = Math.round(WY + WRY * s)
    const bottom = WY + WDEPTH * Math.sqrt(s)
    c.set(x, near, shade(WOK, 6.6 - nx * 2 + sun(x, near) * 0.6))
    for (let y = near + 1; y <= bottom; y++) {
      const v = (y - near) / Math.max(1, bottom - near)
      const streak = Math.abs(nx + 0.52 - v * 0.12) < 0.05 && v < 0.7 ? 2.6 : 0
      const glow = bottom - y < 1 && Math.abs(nx) < 0.75 ? 1 : 0
      c.set(x, y, shade(WOK, 3.4 - nx * 1.5 - v * 2 + streak + glow))
    }
  }
  for (const [dx, dy] of [[0, -1], [-1, -1], [-2, 0], [-1, 1], [0, 1]] as const) {
    c.set(12 + dx, WY + dy, shade(WOK, 5 + (dy < 0 ? 1 : 0)))
    c.set(51 - dx, WY + dy, shade(WOK, 3 + (dy < 0 ? 1 : 0)))
  }
}

function drawLid(c: Canvas, f: number): void {
  const lift = liftAt(f)
  const tilt = TILT[f] ?? 0
  for (let x = 17; x <= 46; x++) {
    const s = across(x, LRX)
    if (s <= 0) continue
    const nx = (x - CX) / LRX
    const shift = Math.round(tilt * nx)
    for (let y = 0; y < H; y++) {
      const yy = y + lift + shift
      if (nx * nx + ((yy - LY) / LRY) ** 2 <= 1) {
        const inner = ((nx * LRX) / (LRX - 1.3)) ** 2 + ((yy - LY) / (LRY - 0.95)) ** 2 <= 1
        if (!inner) {
          c.set(x, y, shade(BAMBOO, (yy > LY ? 6.2 : 5.2) - nx * 1.5 + sun(x, y) * 0.4))
          continue
        }
        const weave = ((Math.floor((x + 1) / 2) + yy) & 1) === 0 ? 1 : 0
        c.set(x, y, shade(BAMBOO, 3.4 - nx * 1.3 + weave + sun(x, y) * 0.4))
        continue
      }
      if (yy <= LY || yy > Math.round(LY + LRY * s) + BAND) continue
      const k = yy - Math.round(LY + LRY * s)
      const lit = -nx * 0.6 + s * 0.7
      c.set(x, y, shade(BAMBOO, 2.8 + lit * 2.4 + (k === BAND ? -1 : 0)))
    }
  }
}

const SOLID = 0.6
const TAIL = 4

function puffAt(p: Puff, t: number): [x: number, y: number, r: number, alpha: number] {
  const a = t / p.life
  const e = p.front ? ease.out(a) : 1 - (1 - a) ** 2
  const held = p.a > SOLID ? 1 - (SOLID / p.a) ** (1 / 1.2) : 0
  const tail = Math.min(TAIL, (1 - held) * p.life)
  const shrink = Math.max(0, Math.min(1, (held * p.life + tail - t) / tail))
  const r = (p.r0 + (p.r1 - p.r0) * e) * shrink
  const alpha = Math.min(p.a, a < held ? p.a * (1 - a) ** 1.2 : SOLID) * Math.min(1, (t + 1) / 2)
  return [p.x + p.dx * e, p.y + p.dy * e, r, alpha]
}
function steamFogs(f: number): [Float32Array, Float32Array] {
  const back = new Float32Array(W * H)
  const front = new Float32Array(W * H)

  for (const p of particles(f, LOOP, 16, 11, 0x5ea)) {
    const born = f - p.t
    const open = isOpen(born)
    const lift = liftAt(born)
    if (!open && lift !== 0) continue
    const pick = Math.floor(p.r[1] * 3)
    const x0 = open ? 22 + p.r[2] * 19 : pick === 0 ? 18.5 : pick === 1 ? 44.5 : 26 + p.r[2] * 11
    const y0 = open ? 11 : pick === 2 ? 10 : 16
    const out = open ? 0 : pick === 0 ? -1 : pick === 1 ? 1 : 0
    const x = x0 + out * p.t * 0.35 + Math.sin(p.t * 0.55 + p.r[3] * 6) * 1.1
    const y = y0 - p.t * 0.9
    addPuff(open ? back : front, x, y, 0.9 + p.age * 1.1, 0.75 * Math.sin(Math.PI * Math.min(1, p.age * 1.3 + 0.15)))
  }
  for (const p of PUFFS) {
    const t = f - p.born
    if (t < 0 || t >= p.life) continue
    const [x, y, r, alpha] = puffAt(p, t)
    if (r > 0) addPuff(p.front ? front : back, x, y, r, alpha)
  }
  return [back, front]
}
function drawSparkles(c: Canvas, f: number): void {
  for (const b of BUNS) {
    const t = f - b.spark
    if (t < 0 || t > 2) continue
    const s = squash(f, b.delay)
    const x = Math.round(b.x - 2)
    const y = Math.round(BUN_BASE - 4.4 * (1 + s) + 1.6)
    c.set(x, y, 0xffffff)
    if (t === 2) continue
    for (let k = 1; k <= (t === 1 ? 2 : 1); k++) {
      const col = k === 2 ? 0xf6e4b0 : 0xfff6dc
      c.set(x - k, y, col)
      c.set(x + k, y, col)
      c.set(x, y - k, col)
      c.set(x, y + k, col)
    }
  }
}
function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const [back, front] = steamFogs(f)
    drawWall(c, f)
    drawCounter(c, f)
    drawWokBack(c, f)
    drawBasket(c, f)
    drawWokFront(c)
    drawFog(c, back)
    drawLid(c, f)
    drawFog(c, front)
    drawSparkles(c, f)
    out.push(c.px)
  }
  return out
}
export const scene: Scene = { verb: 'Bunning', render, hero: 22 }