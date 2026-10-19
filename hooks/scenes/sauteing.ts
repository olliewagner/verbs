import { beat, clamp, ease, frames, hash, hex, lerp, mix, mod, particles, shade, type Canvas, type Paint, type Scene } from '../engine'

const LOOP = 48
const W = 64

const STEEL = hex('12141c 1a1e28 232836 2e3444 3a4254 4a5266 5e667a 7a8294 a0a6b4')
const PAN = hex('07070b 0e0e14 17161e 22202a 302c36 453e48 6a5e62')
const OIL = hex('2a1c12 4a3016 7a5420 b88a34 f0cc6a')
const GAS = hex('16246e 2a4ad0 5a8aff b0d4ff')
const FIRE = hex('6a1412 b8301a e8601e f8a032 fde07a fff6d0')
const PAPER = hex('6a6058 9a8c7c c8b8a2 eadcc4 fbf2e2')
const SKIN = hex('4a2418 7a3e28 a8603c cc8458 e8a878')
const SLEEVE = hex('4c5468 727a90 a0a6b8 c8ccd6 e8e8ea fbf8f2')
const LAMP = hex('3a0c08 7a1c0c c83c14 f87a28 ffc070')
const STEAM = hex('6a6e80 9498a8 c0c2cc e4e2e6')

const VEG: Record<string, readonly number[]> = {
  r: hex('5a0c10 a01a1a d8361e f86a3a ffc8a8'),
  y: hex('7a4a08 c08a10 ecc020 fbe85a fffbd0'),
  g: hex('0e2e14 1e5a1e 3a8a26 6ab83a d8f0a0'),
  p: hex('1a4a1a 3a7a24 6aaa34 9cd050 e8fac0'),
  o: hex('6a2408 b04a10 e87818 fba848 fff0c0'),
  m: hex('4a3424 7a5a40 a8845e d0b088 fff4e0'),
}

const STRIP = [['XXX'], ['..X', '.X.', 'X..'], ['X', 'X', 'X'], ['X..', '.X.', '..X']]
const FLORET = [['.X.', 'XXX', '.s.'], ['.X.', 'XXs', '.X.'], ['.s.', 'XXX', '.X.'], ['.X.', 'sXX', '.X.']]
const COIN = [['XX', 'XX'], ['XX'], ['XX', 'XX'], ['X', 'X']]
const CAP = [['XXX', '.s.'], ['X.', 'Xs', 'X.'], ['.s.', 'XXX'], ['.X', 'sX', '.X']]

type Piece = {
  kind: string
  shapes: string[][]
  x: number
  y: number
  delay: number
  flight: number
  peak: number
  spins: number
}

const PIECES: Piece[] = [
  { kind: 'r', shapes: STRIP, x: 19, y: 19.5, delay: 0, flight: 15, peak: 15, spins: 4 },
  { kind: 'g', shapes: FLORET, x: 23, y: 18, delay: 1, flight: 16, peak: 17, spins: 4 },
  { kind: 'o', shapes: COIN, x: 27, y: 20, delay: 2.5, flight: 12, peak: 9, spins: 6 },
  { kind: 'y', shapes: STRIP, x: 31, y: 18.5, delay: 0.5, flight: 14, peak: 13, spins: 2 },
  { kind: 'm', shapes: CAP, x: 35, y: 19, delay: 1.5, flight: 13, peak: 11, spins: 4 },
  { kind: 'p', shapes: STRIP, x: 25, y: 21, delay: 1.5, flight: 15, peak: 14, spins: 2 },
  { kind: 'r', shapes: STRIP, x: 29, y: 17, delay: 3, flight: 13, peak: 16, spins: 6 },
  { kind: 'g', shapes: FLORET, x: 33, y: 21, delay: 0, flight: 16, peak: 12, spins: 2 },
  { kind: 'o', shapes: COIN, x: 21, y: 21.5, delay: 3.5, flight: 12, peak: 10, spins: 4 },
]

const LAUNCH = 14
const PIVOT: [number, number] = [55, 16.5]

const POSES: [number, number, number, number][] = [
  [0, 0, 0, 0], [8, 0, 0, 0], [10, -1.2, 0.2, 0.02], [12, -3, 0.4, 0.04], [13, -2, 0, -0.02], [14, 0, -0.8, -0.09],
  [15, 2, -1.4, -0.15], [16, 2, -1.5, -0.17], [17, 2, -1.3, -0.14], [21, 1, 0, -0.03], [27, 0, 0, 0], [30, 0, 1.2, 0.03], [33, 0, 0, -0.015],
  [37, 0, 0, 0], [48, 0, 0, 0],
]

function slope(i: number, k: number): number {
  const a = POSES[i - 1]
  const b = POSES[i]
  const c = POSES[i + 1]
  if (!a || !b || !c) return 0
  const d0 = ((b[k] ?? 0) - (a[k] ?? 0)) / (b[0] - a[0])
  const d1 = ((c[k] ?? 0) - (b[k] ?? 0)) / (c[0] - b[0])
  return d0 * d1 <= 0 ? 0 : (2 * d0 * d1) / (d0 + d1)
}
function pose(f: number): { ox: number; oy: number; a: number } {
  const t = mod(f, LOOP)
  let i = 0
  while (i + 2 < POSES.length && (POSES[i + 1]?.[0] ?? 0) <= t) i++
  const p = POSES[i] ?? [0, 0, 0, 0]
  const q = POSES[i + 1] ?? p
  const dt = q[0] - p[0]
  const s = clamp((t - p[0]) / dt)
  const at = (k: number) =>
    (2 * s ** 3 - 3 * s ** 2 + 1) * (p[k] ?? 0) + (s ** 3 - 2 * s ** 2 + s) * dt * slope(i, k) +
    (3 * s ** 2 - 2 * s ** 3) * (q[k] ?? 0) + (s ** 3 - s ** 2) * dt * slope(i + 1, k)
  return { ox: at(1), oy: at(2), a: at(3) }
}
function toScreen(lx: number, ly: number, p: { ox: number; oy: number; a: number }): [number, number] {
  const dx = lx - PIVOT[0]
  const dy = ly - PIVOT[1]
  const ca = Math.cos(p.a)
  const sa = Math.sin(p.a)
  return [PIVOT[0] + p.ox + dx * ca + dy * sa, PIVOT[1] + p.oy - dx * sa + dy * ca]
}
function toPan(x: number, y: number, p: { ox: number; oy: number; a: number }): [number, number] {
  const dx = x - PIVOT[0] - p.ox
  const dy = y - PIVOT[1] - p.oy
  const ca = Math.cos(p.a)
  const sa = Math.sin(p.a)
  return [PIVOT[0] + dx * ca - dy * sa, PIVOT[1] + dx * sa + dy * ca]
}
const PAN_X = 27
const PAN_Y = 19
const RX = 14
const RY = 4
const rimOf = (lx: number, ly: number) => ((lx - PAN_X) / RX) ** 2 + ((ly - PAN_Y) / RY) ** 2
function pieceAt(k: number, piece: Piece, f: number): { x: number; y: number; turn: number; isFlying: boolean } {
  const start = LAUNCH + piece.delay
  const land = start + piece.flight
  const p = pose(f)
  const slide = ease.inOut(beat(f, 9, 13.5))
  const lipX = 15.5 + (k % 4) * 1.3
  const lipY = 18 - (k % 3) * 0.8
  if (f < start || f >= land + 0.01) {
    const settle = f >= land ? 0 : slide
    const [x, y] = toScreen(lerp(piece.x, lipX, settle), lerp(piece.y, lipY, settle), p)
    const bounce = f >= land && f < land + 2.5 ? -1 : 0
    return { x, y: y + bounce, turn: 0, isFlying: false }
  }
  const u = (f - start) / piece.flight
  const [x0, y0] = toScreen(lipX, lipY, pose(start))
  const [x1, y1] = toScreen(piece.x, piece.y, pose(land))
  return {
    x: lerp(x0, x1, ease.inOut(u) * 0.35 + u * 0.65),
    y: lerp(y0, y1, u) - piece.peak * 4 * u * (1 - u),
    turn: Math.floor(u * piece.spins) % 4,
    isFlying: true,
  }
}
const q = (t: number) => Math.round(clamp(t) * 5) / 5
const LAMP_LIGHT = { x: 50, y: 1 }
const lampAt = (x: number, y: number) => Math.max(0, 1 - Math.hypot((x - LAMP_LIGHT.x) * 0.8, (y - LAMP_LIGHT.y) * 1.3) / 34)
function wall(x: number, y: number): number {
  const lit = lampAt(x, y)
  const seam = x % 17 === 12 ? -1.2 : x % 17 === 13 ? 0.8 : 0
  const brush = hash(x, 0, 3) < 0.25 ? 0.4 : 0
  const steel = shade(STEEL, 2.1 + lit * 3.4 + seam + brush - y * 0.03, x, y)
  return lit > 0.35 ? mix(steel, 0xd88850, lit > 0.6 ? 0.22 : 0.12) : steel
}
function drawPiece(c: Canvas, piece: Piece, at: { x: number; y: number; turn: number; isFlying: boolean }, f: number, k: number): void {
  const ramp = VEG[piece.kind] ?? []
  const shape = piece.shapes[at.turn] ?? piece.shapes[0] ?? []
  const w = shape[0]?.length ?? 1
  const x0 = Math.round(at.x - (w - 1) / 2)
  const y0 = Math.round(at.y - shape.length + 1)
  const lift = at.isFlying ? lampAt(at.x, at.y) * 1.5 : 0
  let isGlint = false
  shape.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i]
      if (ch === '.' || ch === undefined) continue
      const top = j === 0 ? 0.8 : 0
      const level = ch === 's' ? 3.2 : 1.6 + top + lift - (j === shape.length - 1 && shape.length > 1 ? 0.6 : 0)
      const glint = !isGlint && j === 0 && (at.isFlying ? (f + k) % 4 < 2 : (f + k * 5) % 16 < 3)
      if (glint) isGlint = true
      c.set(x0 + i, y0 + j, glint ? ramp[4] ?? 0xffffff : shade(ramp, level, 0, 0))
    }
  })
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const p = pose(f)
    const flare = f >= 29 && f < 37 ? Math.sin((beat(f, 29, 37) ** 0.6) * Math.PI) : 0

    c.fill((x, y) => {
      const glow = flare * Math.max(0, 1 - Math.hypot((x - 27) * 0.45, (y - 21) * 1.2) / 8)
      return glow > 0.15 ? mix(wall(x, y), FIRE[3] ?? 0, Math.round(glow * 3) / 3 * 0.45) : wall(x, y)
    })
    for (let x = 36; x < W; x++) {
      c.set(x, 0, STEEL[1] ?? 0)
      c.set(x, 1, STEEL[x === 36 ? 3 : 2] ?? 0)
      c.set(x, 2, x === 36 ? STEEL[2] ?? 0 : shade(LAMP, 3 + Math.sin(x * 0.9) * 0.6 + (x % 4 === 0 ? 0.6 : 0), x, 2))
    }
    for (let x = 0; x < 36; x++) c.set(x, 0, STEEL[1] ?? 0)
    for (let x = 0; x < 17; x++) {
      c.set(x, 3, shade(STEEL, 5 + lampAt(x, 3) * 3, x, 3))
      c.set(x, 4, STEEL[2] ?? 0)
    }
    for (const [k, tx, len] of [[0, 2, 8], [1, 9, 6]] as const) {
      const sway = Math.round(Math.sin((f / LOOP) * Math.PI * 2 * 2 + k * 1.7) * 0.6)
      for (let j = 0; j < len; j++) {
        const dx = j > len - 3 ? sway : 0
        const ink = j === 1 ? 4 : j % 2 === 1 && j < len - 1 ? 3 - ((j + k) % 3 === 0 ? 1 : 0) : 0
        for (let i = 0; i < 5; i++) {
          const isInk = i >= 1 && i < 1 + ink
          const level = 2.8 + lampAt(tx + i, 4 + j) * 1.4 - (i === 4 ? 0.8 : 0) - (j === 0 ? 0.8 : 0)
          c.set(tx + i + dx, 4 + j, isInk ? PAPER[j === 1 ? 0 : 1] ?? 0 : shade(PAPER, level, tx + i, j))
        }
      }
      c.set(tx + 2, 3, STEEL[0] ?? 0)
    }
    for (let x = 0; x < W; x++) {
      c.set(x, 23, shade(STEEL, 4.8 + lampAt(x, 23) * 3, x, 23))
      c.set(x, 24, STEEL[3] ?? 0)
      for (let y = 25; y < 32; y++) c.set(x, y, shade(STEEL, 1.4 + lampAt(x, y) * 1.4 - (y === 25 ? 0.6 : 0), x, y))
    }
    for (const kx of [7, 49]) {
      c.sprite(kx - 2, 26, ['.aba.', 'abcba', 'abcba', '.aaa.'], { a: STEEL[2] ?? 0, b: STEEL[4] ?? 0, c: STEEL[7] ?? 0 })
    }
    for (let x = 12; x <= 42; x++) {
      c.set(x, 22, x % 7 === 0 ? STEEL[3] ?? 0 : PAN[1] ?? 0)
      if (x > 14 && x < 40 && x % 7 !== 0) {
        const n = Math.sin(x * 1.9 + f * 2.3) + Math.sin(x * 0.7 - f * 1.1)
        c.set(x, 21, shade(GAS, 1.2 + n * 0.5, x, 21))
      }
    }
    c.rect(11, 22, 1, 2, PAN[2] ?? 0)
    c.rect(43, 22, 1, 2, PAN[2] ?? 0)
    const panPaint = (front: boolean): Paint => (x, y) => {
      const [lx, ly] = toPan(x, y, p)
      const e = rimOf(lx, ly)
      const lit = lampAt(x, y)
      const fire = flare * 1.5
      if (e <= 1) {
        const isFront = ly > PAN_Y
        if (front) return isFront && e > 0.7 ? shade(PAN, (e > 0.86 ? 5.2 : 3.6) + lit * 1.6 + fire * 0.5, x, y) : undefined
        if (!isFront && e > 0.74) return shade(PAN, (e > 0.88 ? 4.4 : 2.4) + lit * 2, x, y)
        const sheen = Math.abs(lx - PAN_X - 4 - (ly - PAN_Y) * 2.5) < 1.2 && Math.abs(ly - PAN_Y) < 2
        return sheen ? shade(OIL, 2.4 + lit * 1.5 + fire * 0.4, x, y) : shade(PAN, 1.2 + lit * 1.1 + fire * 0.4, x, y)
      }
      if (front) return undefined
      const depth = ly - (PAN_Y + RY * Math.sqrt(Math.max(0, 1 - ((lx - PAN_X) / RX) ** 2)))
      if (ly > PAN_Y && depth >= -0.5 && depth < 2.6 && Math.abs(lx - PAN_X) < RX - 0.6 - depth * 0.8) {
        const under = depth > 1.6 ? 0.35 : 0
        return mix(shade(PAN, 2.2 + lit * 1.8 - depth * 0.5 + fire * 0.8, x, y), GAS[2] ?? 0, under)
      }
      const t = clamp((lx - PAN_X - RX + 1) / (PIVOT[0] - PAN_X - RX + 1))
      const hy = lerp(PAN_Y + 0.6, PIVOT[1], t)
      if (lx > PAN_X + RX - 1 && lx < PIVOT[0] && Math.abs(ly - hy) < 1) return shade(STEEL, 6 + lit * 2 - (ly > hy ? 2.5 : 0), x, y)
      return undefined
    }
    c.rect(8, 8, 50, 20, panPaint(false))
    for (const [lx, ly] of [[20, 20], [24, 19.5], [30, 20.5], [34, 18], [37, 20]] as const) {
      const [x, y] = toScreen(lx, ly, p)
      c.set(x, y, 0xd8cc9a)
      c.set(x + 1, y, 0xb8a878)
    }
    for (let k = 0; k < 2; k++) {
      const n = Math.floor(f / 2) * 2 + k
      const [x, y] = toScreen(16 + hash(n, 1, 7) * 22, 17.5 + hash(n, 2, 7) * 3.5, p)
      if (f % 2 === 0) c.set(x, y, OIL[4] ?? 0)
    }
    const placed = PIECES.map((piece, k) => ({ piece, k, at: pieceAt(k, piece, f) }))
    for (const { piece, k, at } of placed) if (!at.isFlying) drawPiece(c, piece, at, f, k)
    c.rect(8, 8, 50, 20, panPaint(true))
    for (const { piece, k, at } of placed) if (at.isFlying) drawPiece(c, piece, at, f, k)
    const [hx, hy] = toScreen(PIVOT[0], PIVOT[1], p)
    const wristX = Math.round(hx) + 3
    const wristY = Math.round(hy)
    c.poly([[wristX - 1, wristY - 3], [W, 11 + p.oy * 0.4], [W, 22 + p.oy * 0.4], [wristX - 1, wristY + 3]], (x, y) => {
      const top = 11 + p.oy * 0.4 + ((wristY - 3 - 11) * (W - x)) / (W - wristX)
      const d = y - top
      const fold = (x + Math.round(d)) % 6 === 0 && d > 1.5 ? -1 : 0
      return shade(SLEEVE, 4.2 + lampAt(x, y) * 1.5 - d * 0.35 + fold + (d < 1 ? 0.8 : 0), x, y)
    })
    c.sprite(Math.round(hx) - 2, wristY - 2, [
      '.lKlK.',
      'kKKKKk',
      'kkkkKk',
      '.kkkk.',
      '..kk..',
    ], {
      l: (x, y) => shade(SKIN, 4 + lampAt(x, y), x, y),
      k: (x, y) => shade(SKIN, 1.8 + (y < wristY ? 1 : 0), x, y),
      K: (x, y) => shade(SKIN, 2.8 + (y < wristY ? 1 : 0) + lampAt(x, y), x, y),
    })
    if (flare > 0) {
      for (const [bx, dir] of [[13.5, -1], [40.5, 1]] as const) {
        const h = flare * 3.5
        for (let j = 0; j < h; j++) {
          const v = j / h
          const x = bx + dir * v * 1.5 + Math.sin(f * 1.7 + j + bx) * 0.5 * v
          c.set(x, 21 - j, shade(FIRE, 5 - v * 4 + flare, 0, 0))
          if (v < 0.5) c.set(x + 1, 21 - j, shade(FIRE, 3.6 - v * 4, 0, 0))
        }
      }
    }
    for (let k = 0; k < 5; k++) {
      const born = 28 + hash(k, 1, 5) * 3
      const t = f - born
      if (t < 0 || t > 7) continue
      const vx = (hash(k, 2, 5) - 0.5) * 3.2
      const vy = -1.6 - hash(k, 3, 5) * 1.4
      const x = 28 + (hash(k, 4, 5) - 0.5) * 14 + vx * t
      const y = 18 + vy * t + 0.32 * t * t
      if (y < 23) c.set(x, y, t < 3 ? OIL[4] ?? 0 : OIL[3] ?? 0)
    }
    for (const [wi, wx] of [21, 27, 33].entries()) {
      for (const lag of [0, 6]) {
        const u = mod(f + wi * 4 + lag, 12) / 12
        const [bx, by] = toScreen(wx, 17, p)
        const x = bx + Math.sin(u * 5 + wi * 2) * 1.2 + u * 3
        const y = by - u * 11
        const a = Math.sin(u * Math.PI) * 0.4
        c.tint(x, y, STEAM[3] ?? 0, q(a))
        c.tint(x, y + 1, STEAM[2] ?? 0, q(a * 0.6))
      }
    }
    const burst = beat(f, 29, 42)
    if (burst > 0 && burst < 1) {
      for (let k = 0; k < 4; k++) {
        const x = 19 + k * 5 + burst * 5 + Math.sin(k * 2.1 + burst * 5) * 1.2
        const y = 17 - burst * (8 + (k % 2) * 3)
        const a = Math.sin(burst * Math.PI) * 0.3
        for (const [dx, dy, w] of [[0, 0, 1], [1, 0, 1], [0, -1, 0.8], [1, -1, 0.6], [-1, 0, 0.5]] as const) {
          c.tint(x + dx, y + dy, STEAM[3] ?? 0, q(a * w))
        }
      }
    }
  })
}
export const scene: Scene = { verb: 'Sautéing', render, hero: 21 }