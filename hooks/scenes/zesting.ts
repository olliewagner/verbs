import { Canvas, ease, frames, hash, hex, lerp, mod, random, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 48
const STROKE = 24

const WALL = hex('0b0908 12100c 1a1711 241f16 30291d 3e3424 4f4230 66553b 7f6b47')
const WOOD = hex('0e0907 1a110c 281a11 382416 4b3019 61401f 7b5328 976a33')
const LEMON = hex('2c2208 54400e 7f6512 aa8a14 d0ae1a ecca2c f8e25a fdf29a fffcd8')
const PITH = hex('5a5236 8a7f58 b8ad84 ddd3ac f4edcc')
const METAL = hex('101016 1d1d25 2e2e39 43434f 5c5d6a 7c7e8a a4a7b0 d0d3d8 f4f5f2')
const RUBBER = hex('060607 0e0d10 18161b 242128 34303a 47424e')
const SKIN = hex('2b1510 4d2619 773b25 a15536 c3744d de9a70 f0c19b')
const CLOTH = hex('0d111a 171e2e 23304a 33456a 4a5f88 6a80a6')
const LEAF = hex('0f1a0e 1b2e17 2b4521 3f5f2a 5a7a33')

const BEAM = { x: 29, y: 20, dx: 0.42, dy: 0.91, half: 9.5 }
function beam(x: number, y: number): number {
  const o = Math.abs((x - BEAM.x) * BEAM.dy - (y - BEAM.y) * BEAM.dx)
  return o < BEAM.half - 3 ? 1 : o < BEAM.half - 1.2 ? 0.6 : o < BEAM.half ? 0.3 : 0
}
const HAZE = hex('0b0908 15120d 201b13 2d2618 3d331f 514328 6a5733 86703f a38a4c')
const GLINT = hex('7d6a45 b59c66 e2cd98 fff6d6')

const vignette = (x: number, y: number) => (((x - 30) / 36) ** 2 + ((y - 14) / 22) ** 2) * 1.6

const TABLE_Y = 26
const BLADE_Y = 15
const TIP_X = 4
const FERRULE_X = 47
const X_RIGHT = 34
const X_LEFT = 22
const LEMON_Y = 9
const RX = 9.5
const RY = 5.8

const PUSH0 = 2
const PUSH1 = 11
function lemonX(f: number): number {
  const t = mod(f, STROKE)
  if (t < PUSH0) return X_RIGHT
  if (t < PUSH1) return lerp(X_RIGHT, X_LEFT, glide((t - PUSH0) / (PUSH1 - PUSH0)))
  if (t < 13) return X_LEFT
  if (t < 23) return lerp(X_LEFT, X_RIGHT, glide((t - 13) / 10))
  return X_RIGHT
}

function glide(p: number): number {
  const top = 1 / 0.7
  if (p < 0.3) return (top * p * p) / 0.6
  if (p > 0.7) return 1 - (top * (1 - p) ** 2) / 0.6
  return top * (p - 0.15)
}
const lemonLift = (f: number) => {
  const t = mod(f, STROKE)
  return t >= 14 && t < 22 ? 1 : 0
}

const heap = (x: number) => 3.4 * Math.max(0, 1 - ((x - 27.5) / 11) ** 2) ** 1.4
const heapTop = (x: number) => TABLE_Y + 1 - heap(x)

type Zest = { born: number; x: number; vx: number; vy: number; phase: number; tone: number }
const ZEST: Zest[] = (() => {
  const out: Zest[] = []
  const next = random(0x2e57)
  for (let s = 0; s < LOOP / STROKE; s++) {
    for (let k = 0; k < 24; k++) {
      const born = s * STROKE + PUSH0 + 1 + (k / 24) * (PUSH1 - PUSH0 - 1) + next() * 0.9
      out.push({
        born,
        x: lemonX(born) + (next() - 0.5) * 12,
        vx: (next() - 0.65) * 0.35,
        vy: 0.15 + next() * 0.35,
        phase: next() * 6.3,
        tone: next(),
      })
    }
  }
  return out
})()

type Mote = { born: number; x: number; y: number; vx: number; vy: number; life: number; phase: number }
const MIST: Mote[] = (() => {
  const out: Mote[] = []
  const next = random(0x0115)
  for (let s = 0; s < LOOP / STROKE; s++) {
    for (let k = 0; k < 26; k++) {
      const born = s * STROKE + PUSH0 + 2 + next() * (PUSH1 - PUSH0)
      const a = next() * Math.PI * 2
      const v = 0.5 + next() * 0.9
      out.push({
        born,
        x: lemonX(born) - 3 + (next() - 0.5) * 8,
        y: BLADE_Y + 1 + (next() - 0.5) * 3,
        vx: Math.cos(a) * v - 0.3,
        vy: Math.sin(a) * v * 0.7 + 0.2,
        life: 26 + Math.floor(next() * 16),
        phase: next() * 6.3,
      })
    }
  }
  return out
})()

const DUST = Array.from({ length: 7 }, (_, i) => ({
  x: 10 + hash(i, 1) * 34,
  y: 2 + hash(i, 2) * 22,
  phase: hash(i, 3),
}))

function drawWall(c: Canvas): void {
  for (let y = 0; y < TABLE_Y; y++) {
    for (let x = 0; x < W; x++) {
      const b = beam(x, y)
      const plaster = Math.sin(x * 0.21 + Math.sin(y * 0.4) * 1.3) > 0.82 ? 0.5 : 0
      c.set(x, y, shade(b > 0 ? HAZE : WALL, 1.9 + b * 3.4 + plaster - vignette(x, y) - (y === TABLE_Y - 1 ? 0.8 : 0), x, y))
    }
  }
}

function drawTable(c: Canvas, lx: number): void {
  for (let y = TABLE_Y; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const b = beam(x, y)
      const grain = Math.sin(x * 0.09 + y * 2.7 + Math.sin(x * 0.05 + y) * 2) > 0.55 ? 0.6 : 0
      const sx = x - 5
      const inLemonShadow = ((sx - lx) / (RX + 1)) ** 2 + ((y - 29) / 1.6) ** 2 <= 1
      const inBladeShadow = y === 29 && sx >= TIP_X && sx < W
      const shadowed = b > 0 && (inLemonShadow || inBladeShadow)
      const lit = shadowed ? b * 0.25 : b
      const edge = y === TABLE_Y ? 0.9 : 0
      c.set(x, y, shade(WOOD, 2 + lit * 3.2 + grain + edge + (y - TABLE_Y) * 0.15 - vignette(x, y) * 0.8, x, y))
    }
  }
}

function drawHeap(c: Canvas): void {
  for (let x = 16; x <= 39; x++) {
    const top = heapTop(x)
    for (let y = Math.ceil(top - 0.5); y <= TABLE_Y + 1; y++) {
      const b = beam(x, y)
      const slope = heap(x - 1) - heap(x + 1)
      const crumb = hash(x, y, 7) < 0.14 ? 0.7 : 0
      const isSkin = y === Math.ceil(top - 0.5)
      c.set(x, y, shade(LEMON, 2.8 + b * 2.4 + (isSkin ? 0.9 : -(y - top) * 0.4) - slope * 0.7 + crumb - vignette(x, y) * 0.5, x, y))
    }
  }
  for (const [x, y] of [[13, 28], [15, 29], [41, 28], [43, 29], [19, 30], [37, 30]] as const) {
    c.set(x, y, shade(LEMON, 2.6 + beam(x, y) * 2.2, x, y))
  }
}

function drawSpare(c: Canvas): void {
  for (const [x, y, l] of [[49, 24, 2.6], [50, 23, 3], [51, 23, 3.4], [52, 22, 3], [53, 22, 2.4], [50, 24, 1.6], [51, 24, 2], [52, 23, 2.4],
    [54, 23, 1.2], [55, 22, 1.8], [56, 21, 2.4], [57, 21, 2], [56, 22, 1.4]] as const) {
    c.set(x, y, shade(LEAF, l, x, y))
  }
  for (let y = 22; y < H; y++) {
    for (let x = 51; x < W; x++) {
      const dx = (x - 59) / 7.5
      const dy = (y - 27.5) / 4.6
      if (dx * dx + dy * dy > 1) continue
      const nz = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy))
      const lam = -dx * 0.6 - dy * 0.6 + nz * 0.4
      c.set(x, y, shade(LEMON, 1.2 + lam * 2.6 - vignette(x, y) * 0.4, x, y))
    }
  }
}

function drawBlade(c: Canvas, lx: number, isPush: boolean): void {
  for (let x = TIP_X; x < FERRULE_X; x++) {
    const b = beam(x, BLADE_Y)
    const isTip = x === TIP_X
    if (!isTip) c.set(x, BLADE_Y, shade(METAL, 4.2 + b * 2.6, x, BLADE_Y))
    const isTooth = x % 2 === 0
    const caught = !isTooth && x > X_LEFT - 9 && x < X_RIGHT + 8 && hash(x, 3) < 0.45
    const wet = isPush && isTooth && x > lx + RX - 2 && x < lx + RX + 4 ? 2.2 : 0
    const tooth = caught ? shade(LEMON, 3.2 + b * 2.4, x, 0) : shade(METAL, isTooth ? 3.6 + b * 3.4 + wet : 1.2 + b * 0.6, x, 0)
    c.set(x, BLADE_Y + 1, tooth)
    if (!isTip) c.set(x, BLADE_Y + 2, shade(METAL, 2.2 + b * 1.4, x, 0))
  }
  for (let y = BLADE_Y - 1; y <= BLADE_Y + 3; y++) {
    c.set(FERRULE_X, y, shade(METAL, 5.2 - (y - BLADE_Y) * 0.9, FERRULE_X, y))
    c.set(FERRULE_X + 1, y, shade(METAL, 3.4 - (y - BLADE_Y) * 0.8, FERRULE_X, y))
  }
  for (let x = FERRULE_X + 2; x < W; x++) {
    for (let y = BLADE_Y - 1; y <= BLADE_Y + 3; y++) {
      const row = y - (BLADE_Y - 1)
      const lit = [3.6, 2.4, 1.8, 1.2, 0.4][row] ?? 0
      const grip = row >= 1 && row <= 3 && x % 3 === 0 ? -0.6 : 0
      c.set(x, y, shade(RUBBER, lit + grip - vignette(x, y) * 0.4, x, y))
    }
  }
}

function lemonLevel(x: number, y: number, lx: number, ly: number): number | undefined {
  const dx = (x - lx) / RX
  const dy = (y - ly) / RY
  const r = dx * dx + dy * dy
  const nub = Math.abs(dy) < 0.12 && Math.abs(dx) < 1.13
  if (r > 1 && !nub) return undefined
  const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, r)))
  const lam = -dx * 0.55 - dy * 0.65 + nz * 0.5
  const b = beam(x, y)
  const spec = lam > 0.93 ? 1.2 : 0
  const bounce = dy > 0.55 && r > 0.62 ? 1 : 0
  return 1.7 + lam * 4.4 + b * 1.1 + spec + bounce
}

function drawLemon(c: Canvas, lx: number, ly: number): void {
  for (let y = Math.floor(ly - RY - 1); y <= Math.ceil(ly + RY + 1); y++) {
    for (let x = Math.floor(lx - RX - 2); x <= Math.ceil(lx + RX + 2); x++) {
      const level = lemonLevel(x, y, lx, ly)
      if (level !== undefined) c.set(x, y, shade(LEMON, level, x, y))
    }
  }
  c.set(lx + RX + 1, ly, shade(LEAF, 2, 0, 0))
}

function drawHand(c: Canvas, lx: number, ly: number): void {
  const top = lx + 15
  const sleeve: [number, number][] = [[top - 4, -1], [top + 5, -1], [lx + 10, ly - 6], [lx + 5, ly - 8]]
  c.poly(sleeve, (x, y) => shade(CLOTH, 2.4 + beam(x, y) * 1.2 - (x - (lx + 6)) * 0.12 + (y < 1 ? 0.6 : 0), x, y))
  for (let k = 0; k < 6; k++) c.set(lx + 5 + k, ly - 8 + Math.floor(k * 0.5), shade(CLOTH, 4.4 + beam(lx + 5 + k, 0), 0, 0))
  for (let y = ly - 8; y <= ly - 4; y++) {
    for (let x = lx - 6; x <= lx + 8; x++) {
      const dx = (x - (lx + 1)) / 6.8
      const dy = (y - (ly - 5.4)) / 2.3
      if (dx * dx + dy * dy > 1) continue
      const lam = -dx * 0.6 - dy * 0.7
      c.set(x, y, shade(SKIN, 3.4 + lam * 1.5 + beam(x, y) * 0.9, x, y))
    }
  }
  const fingers = [[lx - 6, 2], [lx - 3, 3], [lx, 2]] as const
  for (const [fx, len] of fingers) {
    for (let j = 0; j <= len; j++) {
      const y = ly - 4 + j
      const isTip = j === len
      c.set(fx, y, shade(SKIN, 4.2 - j * 0.35 + beam(fx, y) * 0.9 - (isTip ? 0.4 : 0), fx, y))
      c.set(fx + 1, y, shade(SKIN, 3.5 - j * 0.35 + beam(fx + 1, y) * 0.9 - (isTip ? 0.8 : 0), fx + 1, y))
      if (!isTip) c.set(fx + 2, y, shade(SKIN, 2.2 - j * 0.3, fx + 2, y))
    }
  }
}

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const lx = Math.round(lemonX(f))
    const ly = LEMON_Y - lemonLift(f)

    drawWall(c)
    drawTable(c, lx)
    drawHeap(c)
    drawSpare(c)
    for (const m of MIST) {
      const a = mod(f - m.born, LOOP)
      if (a >= m.life) continue
      const k = (1 - 0.86 ** a) / 0.14
      const x = Math.round(m.x + m.vx * k - a * 0.12 + Math.sin(a * 0.25 + m.phase) * 0.8)
      const y = Math.round(m.y + m.vy * k - a * 0.26)
      const b = beam(x, y)
      if (b === 0) continue
      const glow = Math.sin((Math.PI * a) / m.life) * (0.55 + 0.45 * Math.sin(a * 1.4 + m.phase)) * b
      if (glow < 0.2) continue
      c.set(x, y, shade(GLINT, 1 + glow * 2.4, 0, 0))
      if (glow > 0.72) for (const dx of [1, -1]) c.set(x + dx, y, GLINT[0] ?? 0)
    }
    const t = mod(f, STROKE)
    drawBlade(c, lx, t >= PUSH0 + 1 && t < PUSH1 + 1)
    for (let x = lx - 5; x <= lx + 5; x++) c.set(x, BLADE_Y, shade(METAL, 2.2 + beam(x, BLADE_Y), x, 0))
    drawLemon(c, lx, ly)
    drawHand(c, lx, ly)

    for (const z of ZEST) {
      const a = mod(f - z.born, LOOP)
      const y = BLADE_Y + 2.5 + z.vy * a + 0.07 * a * a
      const x = Math.round(z.x + z.vx * a + Math.sin(a * 0.7 + z.phase) * 0.6)
      if (y >= heapTop(x) || y >= TABLE_Y + 2) continue
      const b = beam(x, y)
      c.set(x, y, shade(LEMON, 3.4 + z.tone * 1.6 + b * 2.4, x, y))
    }

    for (const d of DUST) {
      const x = Math.round(d.x + Math.sin((f / LOOP + d.phase) * Math.PI * 2) * 2)
      const y = Math.round(d.y + Math.cos((f / LOOP + d.phase) * Math.PI * 2) * 1.5)
      if (beam(x, y) === 1) c.set(x, y, GLINT[0] ?? 0)
    }
  })
}

export const scene: Scene = { verb: 'Zesting', render, hero: 10 }
