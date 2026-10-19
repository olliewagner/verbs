import { beat, clamp, ease, frames, hex, lerp, loopNoise, mix, mod, particles, shade, type Canvas, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const SKY = hex('8ebce0 a8cde8 c4dcee dee9ee f2f1e6 fdf8e8 fffef8')
const TREE = hex('34504c 46645a 5a7a64 72906c 8ea878 aac08a')
const FRAME = hex('3c4256 545c70 707890 9298ae b6bcca dadee6')
const SILL = hex('5a5266 7a7284 9e96a2 c2b8bc e0d6d0 f4ece0 fffaf0')
const WATER = hex('2a5868 3a7484 52929e 72b0b8 98cccc c2e4e0 e8f8f2')
const RAISIN = hex('140810 2a121c 461c24 62282a 7e3a32 9a5440')
const GRAPE = hex('24400e 3e6814 62921e 8cba30 b8da58 e8f6a4')
const BUBBLE = ['.w.', 'o.o', '.o.']
const BIG_BUBBLE = ['.wo.', 'w..o', 'o..d', '.od.']
const STAGES = [0, 1, 2, 3, 4].map(s => RAISIN.map((c, i) => mix(c, GRAPE[i] ?? c, s / 4)))

const CX = 26
const X0 = 18
const X1 = 34
const RIM = 5
const SURFACE = 11
const FLOOR = 25
const SILL_Y = 27
const DROP0 = 64

const PULSES = [18, 24, 30, 36]
const plumpAt = (f: number) => PULSES.reduce((p, s) => p + ease.outBack(beat(f, s, s + 4)) / PULSES.length, 0)
const soakAt = (f: number) => PULSES.reduce((p, s) => p + ease.inOut(beat(f, s, s + 4)) / PULSES.length, 0)

type Fruit = { x: number; y: number; r: number; sx: number; sy: number; p: number; soak: number; inWater: boolean }

function fruitAt(f: number): Fruit | undefined {
  const p = clamp(plumpAt(f))
  const soak = clamp(soakAt(f))
  const r = lerp(2.6, 4.5, p)
  const rest = FLOOR + 0.5 - r
  if (f < 6 || f >= DROP0) {
    const t = (mod(f - DROP0, LOOP) + 1) / (LOOP - DROP0 + 7)
    return { x: CX, y: lerp(-8, SURFACE, t * t), r: 2.6, sx: 0.9, sy: 1.15, p: 0, soak: 0, inWater: false }
  }
  if (f < 14) {
    const t = beat(f, 6, 14)
    return { x: CX + Math.round(Math.sin(t * 5) * (1 - t)), y: lerp(SURFACE, rest, 1 - (1 - t) ** 2), r, sx: 1, sy: 1, p, soak, inWater: true }
  }
  if (f < 48) {
    const land = f < 17 ? [1.2, 0.85, 1][f - 14] ?? 1 : 1
    const jiggle = f >= 40 && f < 47 ? [0.1, 0.14, -0.06, -0.08, 0.04, 0.02, 0][f - 40] ?? 0 : 0
    return { x: CX, y: rest - jiggle * r, r, sx: land - jiggle * 0.6, sy: 2 - land + jiggle, p, soak, inWater: true }
  }
  if (f < 52) {
    const t = ease.inOut(beat(f, 48, 52))
    return { x: CX, y: rest + t * 0.8, r, sx: 1 + 0.22 * t, sy: 1 - 0.2 * t, p, soak, inWater: true }
  }
  if (f < 56) {
    const t = beat(f, 52, 56)
    return { x: CX + t, y: lerp(rest + 0.8, SURFACE - 2, 1 - (1 - t) ** 2), r, sx: 0.8, sy: 1.3, p, soak, inWater: f < 54 }
  }
  return undefined
}

function grapeAt(f: number): Fruit | undefined {
  const t = mod(f - 56, LOOP)
  if (t > 23) return undefined
  const r = 4.5
  const p = 1
  const soak = 1
  const land = SILL_Y - r - 0.3
  if (t < 12) {
    const u = t / 12
    return { x: lerp(CX + 1, 46, u), y: lerp(SURFACE - 2, land, u) - 6 * u * (1 - u), r, sx: 0.95, sy: 1.08, p, soak, inWater: false }
  }
  const k = t - 12
  const squash = [0.06, 0.16, 0.06][k] ?? 0
  const hop = k >= 3 && k <= 7 ? Math.sin(((k - 3) / 4) * Math.PI) * 2 : 0
  return { x: 46 + k * 2, y: land - hop + squash * r, r, sx: 1 + squash, sy: 1 - squash, p, soak, inWater: false }
}

const heave = (f: number) => Math.max(f >= 6 ? 1.6 * (1 - beat(f, 6, 18)) : 0, f >= 55 ? 1.8 * (1 - beat(f, 55, 70)) : 0)

function background(x: number, y: number): number {
  if (x === 47 || x === 48 || y === 13) return shade(FRAME, x === 48 ? 1 : 2)
  const sun = Math.max(0, 1 - Math.hypot(x - 6, (y - 2) * 1.4) / 26)
  const canopy = 15 + Math.round(3 * Math.sin(x * 0.31 + 1) + 2 * Math.sin(x * 0.83) - 1.5 * Math.cos(x * 0.17))
  if (y >= canopy) {
    const lawn = y >= 22
    const edge = y === canopy ? 1.4 : 0
    return shade(TREE, (lawn ? 2.6 : 1.4) + edge + sun * 2 - (y - canopy) * 0.06)
  }
  if (Math.hypot(x - 5, y - 2) < 2.6) return shade(SKY, 6)
  return shade(SKY, 1.2 + (y / 14) * 1.6 + sun * 3.2)
}

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const fruit = fruitAt(f)
    const h = heave(f)
    const surfaceAt = (x: number) => SURFACE + Math.round(h * Math.sin(x * 0.9 - f * 1.3))

    c.fill((x, y) => background(x, y))

    for (let y = SILL_Y; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const isTop = y <= SILL_Y + 2
        const k = y - SILL_Y
        const isShadow = isTop && x >= X0 + 1 + k && x <= X1 + k * 2
        const isFrameShadow = isTop && (x === 49 + k || x === 50 + k)
        let level = isTop ? 4.6 - k * 0.4 : 2 - (y - SILL_Y - 3) * 0.6
        if (isShadow || isFrameShadow) level -= 2
        if (isShadow) {
          const cx = CX + 3 + k * 1.5
          const caustic = Math.max(0, 1 - Math.hypot(x - cx, (y - SILL_Y - 1) * 2.2) / 4)
          level += caustic * 3.6 * (0.8 + 0.4 * loopNoise(x * 0.4, y * 0.5, f / LOOP, 3))
        }
        c.set(x, y, shade(SILL, level))
      }
    }

    for (let y = RIM; y <= FLOOR; y++) {
      for (let x = X0 + 1; x <= X1 - 1; x++) {
        if (y < surfaceAt(x)) continue
        const bx = Math.round(CX - (x - CX) * 0.75)
        const b = background(bx, y)
        const lum = (((b >> 16) & 255) * 0.3 + ((b >> 8) & 255) * 0.55 + (b & 255) * 0.15) / 255
        const depth = (y - SURFACE) / (FLOOR - SURFACE)
        c.set(x, y, shade(WATER, 1.6 + lum * 3.6 - depth * 0.8))
      }
    }

    const bubbles: { x: number; y: number; r: number }[] = []
    for (const [k, s] of PULSES.entries()) {
      const t = f - (s + 2)
      if (t < 0) continue
      const startY = FLOOR - 2 * lerp(2.6, 4.5, (k + 1) / PULSES.length)
      const y = startY - t * 1.3
      if (y < SURFACE + 1) continue
      bubbles.push({ x: CX + 1 + Math.round(Math.sin(t * 0.8 + k) * 1.2), y: Math.round(y), r: k % 2 ? 1 : 1.5 })
    }
    if (fruit && fruit.inWater && f >= 18 && f < 52) {
      for (const p of particles(f, LOOP, 10, 9, 7)) {
        if (p.t + 18 > f - 0) continue
        const y = FLOOR - 3 - p.t * 1.4
        if (y < SURFACE + 1) continue
        bubbles.push({ x: CX - 3 + Math.round(p.r[1] * 7 + Math.sin(p.t * 0.9 + p.i) * 0.6), y: Math.round(y), r: 0.5 })
      }
    }
    for (const b of bubbles) {
      if (b.r < 1) c.set(b.x, b.y, shade(WATER, 5))
      else c.sprite(b.x - 1, b.y - 1, b.r > 1 ? BIG_BUBBLE : BUBBLE, { w: shade(WATER, 6), o: shade(WATER, 5), d: shade(WATER, 4) })
    }

    if (fruit && fruit.inWater) drawFruit(c, fruit, f)

    for (let x = X0 + 1; x <= X1 - 1; x++) {
      const sy = surfaceAt(x)
      c.set(x, sy, shade(WATER, 6))
      c.set(x, sy - 1, shade(WATER, 4))
    }

    for (let y = RIM; y <= FLOOR + 1; y++) {
      c.set(X0, y, shade(WATER, y < SURFACE ? 5 : 6))
      c.set(X1, y, shade(WATER, y < SURFACE ? 3 : 4))
      if (y > RIM + 1 && y < FLOOR - 1 && (y < 9 || y > 13)) c.set(X0 + 2, y, shade(SKY, 6))
    }
    for (let x = X0; x <= X1; x++) {
      c.set(x, FLOOR + 1, shade(WATER, 5))
      c.set(x, RIM, shade(WATER, x < CX ? 6 : 5))
      if (x > X0 + 1 && x < X1 - 1) c.set(x, RIM - 1, shade(SKY, 4.6))
    }
    c.set(X0, RIM - 1, shade(WATER, 6))
    c.set(X1, RIM - 1, shade(WATER, 4))

    for (const [start, n] of [[6, 5], [55, 8]] as const) {
      const t = f - start
      if (t < 0 || t > 9) continue
      for (let i = 0; i < n; i++) {
        const vx = (i - (n - 1) / 2) * 0.55
        const vy = -1.6 - (i % 3) * 0.35
        const x = CX + vx * t * 1.4
        const y = SURFACE - 1 + vy * t + 0.32 * t * t
        if (y > SURFACE + 1 && x > X0 && x < X1) continue
        if (y < SILL_Y) c.set(x, y, shade(WATER, 6))
      }
    }

    for (const fruit of [fruitAt(f), grapeAt(f)]) {
      if (!fruit || fruit.inWater) continue
      const near = clamp(1 - (SILL_Y - (fruit.y + fruit.r)) / 6)
      if (fruit.x > X1 + 2 && near > 0) {
        c.ellipse(fruit.x + 1.5, SILL_Y + 1, fruit.r * (0.5 + 0.5 * near), 0.9, (x, y) => shade(SILL, 2.6 - (y - SILL_Y) * 0.4))
      }
      drawFruit(c, fruit, f)
    }
  })
}

function drawFruit(c: Canvas, fruit: Fruit, f: number): void {
  const { x: fx, y: fy, r, sx, sy, p, soak } = fruit
  const ramp = STAGES[Math.round(soak * 4)] ?? RAISIN
  const cx = Math.round(fx)
  const cy = Math.round(fy)
  const lumps = 1 - p
  for (let y = cy - 6; y <= cy + 6; y++) {
    for (let x = cx - 6; x <= cx + 6; x++) {
      const dx = (x - cx) / (r * sx)
      const dy = (y - cy) / (r * sy)
      const a = Math.atan2(dy, dx)
      const edge = 1 + lumps * (0.16 * Math.sin(5 * a + 1) + 0.1 * Math.sin(3 * a))
      const d = Math.hypot(dx, dy) / edge
      if (d > 1) continue
      const fold = Math.sin((x - cx) * 1.5 + 2.4 * Math.sin((y - cy) * 0.8 + 0.6))
      const wrinkle = lumps * (fold > 0.7 ? 0.9 : fold < -0.4 ? -1.1 : 0)
      const nz = Math.sqrt(Math.max(0, 1 - d * d))
      const lam = -(dx * 0.6 + dy * 0.7) / Math.max(1, edge) + nz * 0.45
      const stage = STAGES[clamp(Math.floor(soak * 4 + 0.5 + 0.45 * clamp(dy, -1, 1)), 0, 4)] ?? ramp
      c.set(x, y, shade(stage, 1.4 + p * 0.5 + (lam + 0.4) * 1.9 + wrinkle))
    }
  }
  if (p > 0.3) {
    const gx = cx - Math.round(r * 0.4)
    const gy = cy - Math.round(r * 0.45 * sy)
    c.set(gx, gy, shade(ramp, 5))
    if (p > 0.8) c.set(gx + 1, gy - 1, shade(ramp, 5))
    if (f >= 42 && f < 45) {
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) c.set(gx + ox, gy + oy, shade(ramp, f === 43 ? 5 : 4))
      if (f === 43) c.set(gx, gy, 0xffffff)
    }
  }
  const top = cy - Math.round(r * sy) - 1
  c.set(cx + 1, top, shade(RAISIN, p > 0.5 ? 3 : 2))
  if (p > 0.5) c.set(cx + 2, top - 1, shade(RAISIN, 4))
}

export const scene: Scene = { verb: 'Osmosing', render, hero: 44 }
