import { Canvas, TAU, beat, clamp, ease, fract, hash, hex, lerp, shade, smoothstep, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const WALL = hex('161c1f 1d2528 25302f 2e3c39 3a4a44 4a5b52 5e6d61')
const SUN = hex('5c5a4a 7c7458 a49a70 c8bc8a e6dcaa f6f0cc')
const SKY = hex('9cc4c8 c4e0d4 eef6e0 fffcf0')
const LEAF = hex('2a4a2c 3e6a36 5a8a42 82aa52')
const WOOD = hex('1e1412 30201a 46301f 5e4228 7a5832 98703e')
const BISQUE = hex('3e3632 5a4c44 7a6a5c 9a8a78 b8aa94')
const TUB = hex('0e1216 161c22 202932 2c3846 3c4a5a 52627a 6c7e94')
const METAL = hex('1a1a20 2a2a32 3e3e48 585864 7a7a86 a4a4ae')
const CLAY = hex('260c09 3e150d 5c2212 7c3218 9a4520 b45a2a c87638 da944e e8b26a f4d090 fff0c8')
const SKIN = hex('3a1812 62301e 8a4a2c ae683c c88a58 dca878 ecc49a')
const DENIM = hex('11131c 1a1e2c 252c40 323c56 445070')
const FLOOR = hex('1a1716 242020 302a28 3e3632 4e443c')

const CX = 32
const BASE = 24
const TILT = 0.3

type Shape = { height: number; radius: (u: number) => number; open: number }

function curve(points: readonly (readonly [number, number])[]): (u: number) => number {
  return u => {
    const v = clamp(u)
    let i = 0
    while (i < points.length - 2 && v > (points[i + 1]?.[0] ?? 1)) i++
    const at = (k: number) => points[clamp(k, 0, points.length - 1)] ?? [0, 0]
    const [u1, r1] = at(i)
    const [u2, r2] = at(i + 1)
    const m1 = (at(i + 1)[1] - at(i - 1)[1]) / 2
    const m2 = (at(i + 2)[1] - at(i)[1]) / 2
    const t = (v - u1) / Math.max(1e-6, u2 - u1)
    const t2 = t * t
    const t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * r1 + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * r2 + (t3 - t2) * m2
  }
}

const MOUND: Shape = { height: 7.5, radius: u => 7.4 * Math.max(0, 1 - u ** 2.5) ** 0.5, open: 0 }
const COLUMN: Shape = { height: 15.5, radius: curve([[0, 5.4], [0.12, 4.8], [0.5, 4.3], [0.9, 3.9], [1, 3.9]]), open: 1 }
const VASE: Shape = {
  height: 17,
  radius: curve([[0, 4.4], [0.12, 5.6], [0.3, 6.5], [0.48, 5.7], [0.66, 3.5], [0.8, 2.6], [0.92, 3.1], [1, 4.6]]),
  open: 1,
}
const SQUASH: Shape = { height: 5, radius: u => 9.6 * Math.max(0, 1 - u ** 2.2) ** 0.5, open: 0 }

const blend = (a: Shape, b: Shape, t: number): Shape => ({
  height: lerp(a.height, b.height, t),
  radius: u => lerp(a.radius(u), b.radius(u), t),
  open: lerp(a.open, b.open, t),
})

function clayAt(f: number): { shape: Shape; grip: number; pinch: number } {
  if (f < 8) {
    const wobble = 0.25 * wave(f, 8, 1)
    return { shape: { ...MOUND, radius: u => MOUND.radius(u) + wobble * (1 - u) }, grip: 0.4, pinch: 0.3 }
  }
  if (f < 30) {
    const q = ease.inOut(beat(f, 8, 30))
    return { shape: blend(MOUND, COLUMN, q), grip: lerp(0.4, 0.78, q), pinch: 1 }
  }
  if (f < 40) {
    const q = ease.inOut(beat(f, 30, 37))
    const flare = f < 35 ? 0 : 0.9 * Math.sin(Math.PI * beat(f, 35, 40))
    const shape = blend(COLUMN, VASE, q)
    return {
      shape: { ...shape, radius: u => shape.radius(u) + flare * smoothstep(0.88, 1, u) },
      grip: lerp(0.78, 0.84, q),
      pinch: 1 - beat(f, 36, 40),
    }
  }
  if (f < 62) return { shape: VASE, grip: 0.84, pinch: 0 }
  if (f < 64) return { shape: blend(VASE, SQUASH, f < 63 ? 1 / 6 : 7 / 12), grip: 0.4, pinch: 0 }
  if (f < 67) return { shape: SQUASH, grip: 0.4, pinch: 0 }
  return { shape: blend(SQUASH, MOUND, ease.outBack(beat(f, 67, 72))), grip: 0.4, pinch: 0.3 * beat(f, 67, 72) }
}

function radiusAt(clay: ReturnType<typeof clayAt>, at: number): number {
  const { shape, grip, pinch } = clay
  const u = clamp(at)
  const d = (u - grip) * shape.height
  return Math.max(0, shape.radius(u) - pinch * 0.8 * Math.exp(-((d / 1.3) ** 2)) + pinch * 0.5 * Math.exp(-(((d - 2.6) / 1.4) ** 2)))
}

type Hand = { x: number; y: number; isFlat: boolean; anchorY: number }

function drawnBack(h: Hand, side: -1 | 1, d: number): Hand {
  const ax = side < 0 ? -14 : 78
  const wx = h.x + side * 2
  const wy = h.y + 1
  const len = Math.hypot(ax - wx, h.anchorY - wy)
  return { ...h, x: h.x + ((ax - wx) / len) * d, y: h.y + ((h.anchorY - wy) / len) * d }
}

const LET_GO = [0, 1, 3, 6, 10, 15, 20, 25, 30, 35, 40]
const COME_BACK = [30, 27, 24, 21, 18, 15, 12, 10, 8, 6, 4, 3, 2, 1]

function handsAt(f: number, clay: ReturnType<typeof clayAt>): { left: Hand; right: Hand } {
  const { shape, grip } = clay
  const gy = BASE - grip * shape.height
  const gr = radiusAt(clay, grip)
  const top = BASE - shape.height
  const gone = LET_GO[clamp(f - 40, 0, LET_GO.length - 1)] ?? 0
  const home = f >= 58 && f < 64 ? clayAt(64) : clay
  const leftOn: Hand = { x: CX - radiusAt(home, home.grip) - 2.6, y: BASE - home.grip * home.shape.height, isFlat: false, anchorY: 36 }
  const left = drawnBack(leftOn, -1, f >= 58 ? (COME_BACK[f - 58] ?? 0) : gone)

  let right: Hand
  if (f < 54) right = drawnBack({ x: CX + gr + 2.6, y: gy, isFlat: false, anchorY: 36 }, 1, gone)
  else if (f < 62) {
    const t = ease.out(beat(f, 54, 59))
    const rise = beat(f, 59, 62)
    right = { x: lerp(60, CX + 1, t), y: lerp(-6, top - 2.5, t) - Math.sin(rise * Math.PI * 0.5) * 2.5, isFlat: true, anchorY: -10 }
  } else if (f < 68) right = { x: CX + 1, y: top - 1.6, isFlat: true, anchorY: -10 }
  else {
    const t = ease.inOut(beat(f, 68, 72))
    right = { x: lerp(CX + 1, CX + gr + 2.6, t), y: lerp(top - 1.6, gy, t), isFlat: t < 0.5, anchorY: lerp(-10, 36, t) }
  }
  return { left, right }
}

function drawHand(c: Canvas, h: Hand, side: -1 | 1): void {
  const hx = Math.round(h.x)
  const hy = Math.round(h.y)
  const ax = side < 0 ? -14 : 78
  const ay = h.anchorY
  const wx = hx + side * 2
  const wy = hy + (h.isFlat ? -1 : 1)
  const len = Math.hypot(ax - wx, ay - wy)
  const dx = (ax - wx) / len
  const dy = (ay - wy) / len
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const along = (x - wx) * dx + (y - wy) * dy
      const across = -(x - wx) * dy + (y - wy) * dx
      if (along < 0 || along > len || Math.abs(across) > 1.7) continue
      const lit = -across * Math.sign(dx || 1) * 0.6 + (across * side > 0 ? 0 : 0.4)
      if (along < 8) c.set(x, y, shade(SKIN, 3.2 + lit * 1.6, x, y))
      else if (along < 10) c.set(x, y, shade(DENIM, 3.4 + lit, x, y))
      else c.set(x, y, shade(DENIM, 2 + lit, x, y))
    }
  }
  if (h.isFlat) {
    c.ellipse(hx, hy, 3.4, 1.7, (x, y) => shade(SKIN, 3.6 + (y < hy ? 1 : y > hy ? -1.2 : 0), x, y))
    for (let i = 1; i <= 4; i++) c.set(hx - side * (3 + i), hy + (i > 2 ? 1 : 0), shade(SKIN, i === 4 ? 2.6 : 3.6 + (i === 1 ? 0.5 : 0), 0, 0))
    c.set(hx - side * 4, hy + 1, shade(CLAY, 5, 0, 0))
    return
  }
  c.ellipse(hx, hy, 2.4, 2.1, (x, y) => shade(SKIN, 3.4 + (y < hy ? 0.9 : y > hy + 0.6 ? -1 : 0) + (x * -side > hx * -side ? 0.5 : 0), x, y))
  for (const [row, reach] of [[-1, 3], [0, 3], [1, 2]] as const) {
    for (let i = 1; i <= reach; i++) {
      const x = hx - side * (1 + i)
      const level = row === 1 ? 2.4 : 3.6 - (i === reach ? 0.6 : 0)
      c.set(x, hy + row, shade(SKIN, level, x, hy + row))
    }
  }
  c.set(hx - side * 2, hy - 2, shade(SKIN, 4.6, 0, 0))
  c.set(hx - side * 3, hy - 2, shade(SKIN, 4, 0, 0))
  c.set(hx - side * 4, hy, shade(CLAY, 6.5, 0, 0))
  c.set(hx - side * 3, hy + 1, shade(CLAY, 5.5, 0, 0))
}

function render(): Int32Array[] {
  const out: Int32Array[] = []
  const spin = (f: number) => (TAU * 9 * f) / LOOP

  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()

    const inBeam = (x: number, y: number) => {
      const t = x - 14 - (y - 2) * 0.9
      return t > 0 && t < 22 && y < 22
    }
    for (let y = 0; y < 22; y++) {
      for (let x = 0; x < W; x++) {
        const v = Math.abs(x - 32) / 40
        if (inBeam(x, y)) c.set(x, y, shade(SUN, 1.6 - v * 1.5 + (y > 12 ? 0.4 : 0), x, y))
        else c.set(x, y, shade(WALL, 3.2 - v * 2.5 - (y < 3 ? 0.6 : 0), x, y))
      }
    }
    for (let y = 2; y <= 14; y++) {
      for (let x = 2; x <= 13; x++) {
        const isFrame = x === 2 || x === 13 || y === 2 || y === 14 || x === 7 || x === 8 || y === 8
        if (isFrame) {
          c.set(x, y, shade(WOOD, x === 13 || y === 14 ? 2 : 4, x, y))
          continue
        }
        const leafy = hash(Math.floor(x / 2), Math.floor((y + 1) / 2), 4) < 0.5 && y > 8 - (x % 3)
        const sway = wave(f, LOOP, 2, x * 0.05) > 0.6 && y === 10 && x % 2 === 0
        if (leafy && !sway) c.set(x, y, shade(LEAF, 1.4 + (y < 11 ? 1.2 : 0) + (x < 7 ? 0.6 : 0), x, y))
        else c.set(x, y, shade(SKY, 1 + (14 - y) * 0.18, x, y))
      }
    }
    c.rect(1, 15, 14, 1, shade(WOOD, 4.6, 0, 0))
    c.rect(1, 16, 14, 1, shade(WOOD, 1.6, 0, 0))
    for (let x = 44; x < W; x++) {
      c.set(x, 10, shade(WOOD, 3, x, 10))
      c.set(x, 11, shade(WOOD, 1, x, 11))
    }
    for (const [px, w, h] of [[47, 2.5, 4], [53, 1.8, 6], [58, 3, 3]] as const) {
      for (let y = 10 - h; y < 10; y++) {
        const u = (10 - y) / h
        const r = w * (u > 0.8 ? 0.6 : 1 - (u - 0.4) ** 2 * 0.8)
        for (let x = Math.round(px - r); x <= Math.round(px + r); x++) {
          c.set(x, y, shade(BISQUE, 2 + (x < px ? 0.8 : -0.4) + (y === 10 - h ? 0.6 : 0), x, y))
        }
      }
    }

    for (let y = 22; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const sun = x > 4 && x < 20 && (x + (y - 22) * 0.6) < 22
        c.set(x, y, shade(FLOOR, 1.4 + (y - 22) * 0.12 + (sun ? 2.2 : 0), x, y))
      }
    }

    for (let k = 0; k < 6; k++) {
      const t = fract(f / LOOP + hash(k, 1))
      const x = Math.round(16 + hash(k, 2) * 18 + t * 6)
      const y = Math.round(3 + hash(k, 3) * 14 + Math.sin(t * TAU + k) * 1.5)
      if (inBeam(x, y) && Math.sin(t * Math.PI) > 0.3) c.set(x, y, SUN[5] ?? 0)
    }

    const TY = 25
    const inTub = (x: number, y: number, rx: number, ry: number) => ((x - CX) / rx) ** 2 + ((y - TY) / ry) ** 2 <= 1
    for (let y = 18; y < H; y++) {
      for (let x = 10; x < 54; x++) {
        if (inTub(x, y, 18.4, 4.8)) {
          const isRim = !inTub(x, y, 17, 3.9)
          const level = isRim ? (y < TY ? 4.4 : 3.2) + (x < CX ? 0.8 : 0) : 1 + (y - 20) * 0.25
          c.set(x, y, shade(TUB, level, x, y))
        } else if (y > TY && Math.abs(x - CX) <= 18 - (y - 28) * 0.3) {
          c.set(x, y, shade(TUB, 2.6 - (x > CX + 12 ? 0.8 : 0) + (x < CX - 12 ? 0.6 : 0) - (y - 29) * 0.2, x, y))
        }
      }
    }
    for (const [sx, sy] of [[17, 23], [19, 22], [45, 22], [47, 23], [21, 28], [44, 28], [40, 29]] as const) c.set(sx, sy, shade(CLAY, 4.4, 0, 0))
    c.ellipse(CX, 24.6, 10.8, 2.6, (x, y) => shade(METAL, 3 + (y < 24 ? 1 : 0) + (x < CX - 6 ? 0.8 : 0), x, y))
    for (const a0 of [0, Math.PI]) {
      const a = a0 + spin(f)
      if (Math.cos(a) > 0.1) {
        c.set(CX + Math.sin(a) * 9.6, 24.6 + Math.cos(a) * 1.8, shade(METAL, 0.6, 0, 0))
      }
    }

    const clay = clayAt(f)
    const { shape } = clay
    const r0 = radiusAt(clay, 0)
    const top = BASE - shape.height
    const rAt = (u: number) => radiusAt(clay, u)
    for (let y = Math.floor(top); y <= Math.ceil(BASE + TILT * r0); y++) {
      const u = (BASE - y) / shape.height
      const r = u >= 0 ? rAt(u) : r0
      const up = (rAt(u - 0.04) - rAt(u + 0.04)) / (0.08 * shape.height)
      for (let x = Math.floor(CX - r - 1); x <= Math.ceil(CX + r + 1); x++) {
        const dx = x - CX
        if (Math.abs(dx) > r + 0.25) continue
        if (u < 0 && y > BASE + TILT * Math.sqrt(Math.max(0, r0 * r0 - dx * dx))) continue
        const nx = clamp(dx / Math.max(0.5, r), -1, 1)
        const nz = Math.sqrt(1 - nx * nx)
        const diffuse = clamp(-0.55 * nx + 0.45 * nz + 0.4 * clamp(up, -1, 1) + 0.15)
        const ring = fract(((BASE - y + TILT * nz * r) / 2.6) + 0.3) < 0.3 && u > 0.08 && shape.open > 0.2 ? -0.5 : 0
        const wet = nx > -0.58 && nx < -0.36 ? 3 : 0
        const bounce = nx > 0.82 ? 0.8 : 0
        const foot = u < 0.06 ? -1 : 0
        c.set(x, y, shade(CLAY, 1.4 + diffuse * 5 + (wet ? wet : ring) + bounce + foot, x, y))
      }
    }
    if (shape.open > 0.5) {
      const rx = rAt(1)
      const ry = Math.max(1, rx * 0.34)
      c.ellipse(CX, top, rx, ry, (x, y) => {
        const isInside = ((x - CX) / (rx - 1)) ** 2 + ((y - top) / Math.max(0.5, ry - 0.7)) ** 2 <= 1
        if (isInside) return shade(CLAY, y < top ? 2.2 : 0.6, x, y)
        return shade(CLAY, (y < top ? 7.4 : 5.8) + (x < CX ? 1 : -0.5), x, y)
      })
    }
    for (let k = 0; k < 6; k++) {
      const u = 0.1 + hash(k, 7) * 0.8
      const a = hash(k, 8) * TAU + spin(f)
      if (Math.cos(a) < 0.35) continue
      const r = rAt(u)
      const x = Math.round(CX + r * Math.sin(a))
      const y = Math.round(BASE - u * shape.height)
      c.set(x, y, shade(CLAY, 2.4 + (x < CX ? 1 : 0), 0, 0))
    }
    if (f >= 46 && f < 60) {
      const t = ease.in(beat(f, 46, 60))
      const u = lerp(0.9, 0.35, t)
      const x = Math.round(CX - rAt(u) * 0.35)
      const y = Math.round(BASE - u * shape.height)
      c.set(x, y, CLAY[10] ?? 0)
      c.set(x, y - 1, CLAY[8] ?? 0)
    }

    const { left, right } = handsAt(f, clay)
    drawHand(c, left, -1)
    if ((f >= 62 && f < 65) || (f >= 69 && f < 72)) {
      const from = handsAt(f - 1, clayAt(f - 1)).right
      const trail = new Canvas()
      trail.fill(-1)
      drawHand(trail, from, 1)
      trail.px.forEach((v, i) => {
        if (v !== -1 && i % 2 === 0 && Math.hypot((i % W) - from.x, Math.floor(i / W) - from.y) < 15) c.px[i] = v
      })
    }
    drawHand(c, right, 1)

    if (f >= 63 && f < 70) {
      const dt = f - 63
      for (let k = 0; k < 8; k++) {
        const s = k < 4 ? -1 : 1
        const vx = s * (1.4 + hash(k, 11) * 1.2)
        const vy = -1.2 - hash(k, 12) * 1.2
        const x = CX + s * 6 + vx * dt
        const y = 18 + vy * dt + 0.38 * dt * dt
        if (y < 24) c.set(x, y, shade(CLAY, 7.5 - dt * 0.4, 0, 0))
      }
    }

    out.push(c.px)
  }

  return out
}

export const scene: Scene = { verb: 'Crafting', render, hero: 50 }
