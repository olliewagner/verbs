import { TAU, beat, ease, frames, hash, hex, shade, type Canvas, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const SKY = hex('09071e 0f0b2e 17103e 21164e 2d1c5a 3c2364 4f2a6a 66326c 7e3c6a a04c62 c0625a dc8256')
const CITY = hex('0a0614 100a1e 170e28 1f1232 281838')
const WINDOW = hex('5a3a2a a8702e f0b450 ffe08c')
const SLATE = hex('050409 0a0812 110d1c 191426 231c32 30273f')
const BRICK = hex('0b0610 160a14 24101a 361620 4c1e24 6a2c2a 8c4030 b45a36')
const BRASS = hex('140b08 2a1810 4a2c14 76481c 9e6826 c68c34 e6b456 f8dc8e fff4d4')
const LEG = hex('0c0708 1a0f0c 2c1a12 42281a 5a3822')
const STAR = hex('1e2050 3a4890 6e8cd0 b0cef4 eef6ff')
const LINE = hex('1c1a4a 2a2c66 3c4888 5a6eb0 82a0dc')
const CAT = hex('040208 0a0610 120a1a 1e1028 3a1c34 6a3038')

const OUTLINE: readonly (readonly [number, number])[] = [
  [32, 8], [34, 5], [40, 3], [47, 4], [53, 6], [57, 8], [62, 4], [60, 8], [62, 12], [56, 10], [49, 12], [41, 12], [35, 11],
]
const FIN: readonly (readonly [number, number])[] = [[42, 12], [45, 15]]
const MOUTH: readonly (readonly [number, number])[] = [[32, 8], [37, 9]]
const EYE: readonly [number, number] = [36, 7]
const BLOWHOLE: readonly [number, number] = [40, 3]

const STAR_AT = (k: number) => 6 + k * 1.3
const EYE_AT = 37
const SWIM = [37, 64] as const

function swim(f: number, x: number, y: number): [number, number] {
  const env = Math.sin(Math.PI * beat(f, SWIM[0], SWIM[1]))
  const lag = (x - 32) * 0.1
  const drift = -2.4 * ease.inOut(Math.sin(Math.PI * beat(f - lag, SWIM[0], SWIM[1])))
  const tail = Math.max(0, (x - 46) / 15) ** 1.6
  const beatPhase = ((f - SWIM[0]) / 13) * TAU
  const flap = Math.sin(beatPhase - x * 0.12) * 2.2 * tail * env
  return [Math.round(x + drift), Math.round(y + flap)]
}

function starLevel(f: number, at: number): number {
  if (f < at) return 0.25
  if (f < at + 1) return 1.35
  const fade = 1 - ease.inOut(beat(f, 58, 68))
  return 0.25 + 0.75 * fade
}

const FIELD: [number, number, number][] = Array.from({ length: 40 }, (_, i): [number, number, number] => [
  Math.floor(hash(i, 11) * W),
  Math.floor(hash(i, 12) * 18),
  hash(i, 13),
]).filter(([x, y]) => !OUTLINE.some(([px, py]) => Math.abs(px - x) <= 2 && Math.abs(py - y) <= 2) && !(x < 30 && y > 9))

type Block = { x0: number; x1: number; top: number }
const BLOCKS: Block[] = (() => {
  const out: Block[] = []
  let x = -1
  for (let i = 0; x < W; i++) {
    const w = 3 + Math.floor(hash(i, 21) * 6)
    const isLow = x + w > 28 && x < 42
    out.push({ x0: x, x1: x + w - 1, top: isLow ? 21 + Math.floor(hash(i, 22) * 2) : 16 + Math.floor(hash(i, 22) * 6) })
    x += w
  }
  return out
})()

const T0 = [11, 20] as const
const T1 = [28, 10] as const
const TLEN = Math.hypot(T1[0] - T0[0], T1[1] - T0[1])
const TD = [(T1[0] - T0[0]) / TLEN, (T1[1] - T0[1]) / TLEN] as const
const TN = [-TD[1], TD[0]] as const

function drawTelescope(c: Canvas, glow: number): void {
  for (let y = 6; y < 24; y++) {
    for (let x = 6; x < 32; x++) {
      const px = x - T0[0]
      const py = y - T0[1]
      const u = (px * TD[0] + py * TD[1]) / TLEN
      const v = px * TN[0] + py * TN[1]
      const r = u > 0.8 ? 1.75 : u < 0 ? 0.6 : 1.15
      if (u < -0.14 || u > 1.02 || Math.abs(v) > r) continue
      let level = 3.2 + (v < -0.45 ? 1.6 + glow * 1.2 : v > 0.5 ? -1 : 0)
      if ((u > 0.3 && u < 0.36) || (u > 0.74 && u < 0.81)) level -= 1.3
      if (u < 0) level -= 0.8
      if (u > 0.97) level = 1.4 + (v < 0 ? glow * 3 : 0)
      c.set(x, y, shade(BRASS, level))
    }
  }
  for (const [x, y] of [[18, 17], [19, 17], [18, 18], [19, 18]] as const) c.set(x, y, shade(SLATE, x === 18 && y === 17 ? 4 : 2.4))
  for (const [x1, y1, level] of [[13, 29, 3.2], [24, 29, 2.6], [19, 30, 1.6]] as const) {
    const steps = 12
    for (let k = 1; k <= steps; k++) {
      const t = k / steps
      c.set(18.5 + (x1 - 18.5) * t, 18 + (y1 - 18) * t, shade(LEG, level + (t < 0.3 ? 0.6 : 0)))
    }
  }
}

function drawScene(c: Canvas, f: number): void {
  const lit = 1 - ease.inOut(beat(f, 58, 68))
  const glow = Math.min(1, beat(f, 6, 30) * 1.2) * lit

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) c.set(x, y, shade(SKY, y * 0.47 + (y > 14 ? (y - 14) * 0.12 : 0)))

  for (const [x, y, r] of FIELD) {
    const tw = Math.floor(f / 6 + r * 12) % 7 === 0 ? 1 : 0
    c.set(x, y, shade(STAR, (r > 0.75 ? 1.4 : 0.7) + tw))
  }

  const pts = OUTLINE.map(([x, y]) => swim(f, x, y))
  const lineFade = 1 - ease.inOut(beat(f, 54, 62))
  const segment = (a: readonly [number, number], b: readonly [number, number], start: number) => {
    const t = beat(f, start, start + 1.6)
    if (t <= 0 || lineFade <= 0) return
    const ex = a[0] + (b[0] - a[0]) * t
    const ey = a[1] + (b[1] - a[1]) * t
    c.line(a[0], a[1], ex, ey, shade(LINE, 1 + lineFade * 2.4))
    if (t < 1) c.set(ex, ey, shade(STAR, 3.2))
  }
  pts.forEach((p, k) => {
    const q = pts[(k + 1) % pts.length]
    if (q) segment(p, q, 19 + k * 1.3)
  })
  const fin = FIN.map(([x, y]) => swim(f, x, y))
  if (fin[0] && fin[1]) segment(fin[0], fin[1], 35)
  const mouth = MOUTH.map(([x, y]) => swim(f, x, y))
  if (mouth[0] && mouth[1]) segment(mouth[0], mouth[1], 36)

  const drawStar = (x: number, y: number, b: number) => {
    if (b <= 0) return
    c.set(x, y, shade(STAR, 0.9 + b * 3))
    if (b > 0.6) c.set(x + 1, y, shade(STAR, b * 2.4))
    if (b > 1) for (const [dx, dy] of [[0, -1], [1, -1]] as const) c.set(x + dx, y + dy, shade(STAR, 3.4))
  }
  pts.forEach(([x, y], k) => drawStar(x, y, starLevel(f, STAR_AT(k))))
  fin.forEach(([x, y], k) => drawStar(x, y, starLevel(f, STAR_AT(OUTLINE.length + k))))
  const [ex, ey] = swim(f, EYE[0], EYE[1])
  drawStar(ex, ey, f === 50 ? 0 : starLevel(f, EYE_AT))

  const [bx, by] = swim(f, BLOWHOLE[0], BLOWHOLE[1])
  for (let k = 0; k < 16; k++) {
    const born = 44 + k * 0.5
    const age = f - born
    if (age < 0 || age > 9) continue
    const side = (k % 2 ? 1 : -1) * (0.25 + hash(k, 5) * 0.55)
    const x = bx + side * age
    const y = by - 1 - age * 1.5 + age * age * 0.16
    c.set(x, y, shade(STAR, 3.6 - age * 0.35 - (hash(k, 6) > 0.5 ? 0.8 : 0)))
  }

  for (const [i, b] of BLOCKS.entries()) {
    for (let y = b.top; y < 25; y++) {
      for (let x = Math.max(0, b.x0); x <= Math.min(W - 1, b.x1); x++) {
        const isWindow = x % 2 === 1 && y % 3 === 1 && y > b.top && x > b.x0 && x < b.x1
        const on = isWindow && hash(x, y, Math.floor(f / 24)) > 0.72
        c.set(x, y, on ? shade(WINDOW, 1.6 + hash(x, y) * 1.8) : shade(CITY, (i % 2 ? 1.6 : 2.2) + (y === b.top ? 0.8 : 0)))
      }
    }
  }

  for (let y = 15; y < 25; y++) {
    for (let x = 51; x <= 58; x++) {
      if (y < 17 && x !== 52 && x !== 53 && x !== 56 && x !== 57) continue
      const rim = (y === 15 || y === 17) && x !== 54 && x !== 55 ? 2.4 : x === 51 ? 0.8 : 0
      const mortar = y > 17 && (y % 3 === 0 || (x + (Math.floor(y / 3) % 2) * 2) % 4 === 0) ? -0.8 : 0
      c.set(x, y, shade(BRICK, 1.6 + rim + mortar))
    }
  }

  for (let x = 0; x < W; x++) {
    c.set(x, 24, shade(BRICK, 5.6 - Math.abs(x - 34) / 30))
    for (let y = 25; y <= 26; y++) {
      const mortar = y === 26 || (x + (y === 25 ? 0 : 2)) % 5 === 0
      c.set(x, y, shade(BRICK, 2.2 - (mortar ? 0.9 : 0)))
    }
    c.set(x, 27, shade(SLATE, 0.6))
    for (let y = 28; y < H; y++) c.set(x, y, shade(SLATE, 1.6 + (y - 28) * 0.35 + ((x + y * 3) % 11 === 0 ? 0.8 : 0)))
  }

  drawTelescope(c, glow)

  const up = f >= 45 && f < 60 ? 1 : 0
  const cat = up
    ? ['....#.#', '....###', '...###.', '..####.', '.####..', '.#####.', '######.']
    : ['.......', '...#.#.', '...###.', '..####.', '.####..', '.#####.', '######.']
  const CX = 33
  const CY = 17
  cat.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] !== '#') continue
      const rim = j > 0 && cat[j - 1]?.[i] !== '#' ? 1.4 : (row[i + 1] ?? '.') !== '#' ? 0.8 : 0
      c.set(CX + i, CY + j, shade(CAT, 1 + rim))
    }
  })
  const swing = Math.round(Math.sin((f / LOOP) * TAU * 3) * 1.2)
  for (const [x, y] of [[CX - 1, 23], [CX - 2, 24], [CX - 2, 25], [CX - 2 + (swing < 0 ? -1 : swing > 0 ? 1 : 0), 26], [CX - 2 + swing, 27]] as const) {
    c.set(x, y, shade(CAT, 1.2))
  }
}

export const scene: Scene = {
  verb: 'Envisioning',
  render: () => frames(LOOP, drawScene),
  hero: 47,
}
