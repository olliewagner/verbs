import { Canvas, beat, clamp, ease, frames, hash, hex, lerp, mod, noise, shade, wave, type Paint, type Scene } from '../engine'

const LOOP = 64

const SKY = hex('3d6fb4 4b7fc0 5c90ca 70a1d3 86b2db 9dc2e0 b7d2e4 cfe0e6')
const CLOUD = hex('8e9cc4 aab5d4 c9d0e2 e6e9ef fbfaf6')
const HILL_FAR = hex('86a8b4 95b5b8 a6c2bc b8cfc0')
const HILL = hex('4c7c6a 5a8b6c 6d9a70')
const TREE = hex('25443c 30553f 3f6747')
const GRASS = hex('17311a 214520 2c5b25 3b722a 4f8a2f 68a335 86b83f a8cc52 cce07a')
const WHITE = hex('4e4c70 6c6a94 908eb4 b6b4cc d8d5de f1ede6 fffcf3')
const BLACK = hex('0b0b14 15141f 211f2d 302c3e 433d52')
const PINK = hex('5a2c3c 84465a b2677a d68a94 efb2ae')
const HORN = hex('6e5e48 a8966e d8cca4 f4eed6')
const BUTTERCUP = hex('b8860f e8c020 fbe868')
const DAISY = hex('c9c4d8 f6f2ec')

const LX = -0.5
const LY = -0.68
const LZ = 0.53

const GROUND = 28
const HORIZON = 18

type Blob = { x: number; y: number; rx: number; ry: number }
const BODY: Blob[] = [
  { x: 23, y: 16, rx: 5, ry: 5.5 },
  { x: 28, y: 20.5, rx: 7, ry: 7 },
  { x: 39, y: 21.5, rx: 13, ry: 6.8 },
  { x: 51, y: 19.5, rx: 6, ry: 6.2 },
  { x: 52, y: 23.5, rx: 6.5, ry: 4.6 },
  { x: 21, y: 26.4, rx: 5.5, ry: 1.9 },
]
const EDGE = Math.exp(-3)

function field(x: number, y: number, breath: number): number {
  let s = 0
  for (const [i, b] of BODY.entries()) {
    const ry = b.ry + (i === 2 ? breath * 0.35 : 0)
    const cy = b.y - (i === 2 ? breath * 0.35 : 0)
    s += Math.exp(-3 * (((x - b.x) / b.rx) ** 2 + ((y - cy) / ry) ** 2))
  }
  return s
}

const isBody = (x: number, y: number, breath: number) => y <= GROUND && field(x, y, breath) > EDGE

function bodyLight(x: number, y: number, breath: number): number {
  const F = field(x, y, breath)
  const gx = field(x + 0.5, y, breath) - field(x - 0.5, y, breath)
  const gy = field(x, y + 0.5, breath) - field(x, y - 0.5, breath)
  const g = Math.hypot(gx, gy) || 1
  const d2 = clamp(-Math.log(F) / 3)
  const out = Math.sqrt(d2)
  const nx = (-gx / g) * out
  const ny = (-gy / g) * out
  const nz = Math.sqrt(1 - d2)
  return nx * LX + ny * LY + nz * LZ
}

function isPatch(x: number, y: number): boolean {
  const n = noise(x * 0.17, y * 0.24, 0, 7)
  if (x >= 46 && x <= 54 && y <= 18) return n > 0.4
  if (x < 27) return n > 0.62
  return n > 0.53
}

const HEAD = [
  '....h.......h....',
  '...hkkkwwwkkkh...',
  'eeekkkkwwwkkkkeee',
  'eiikkkkwwwkkkkiie',
  '.eekkokwwwkokkee.',
  '....kkkwwwkkk....',
  '.....kkwwwkk.....',
  '.....wwwwwww.....',
  '.....wwwwwww.....',
  '.....ppppppp.....',
  '....pnnpppnnp....',
  '....ppppppppp....',
]
const JAW = ['.....lllllll.....', '......ccccc......']
const EAR_UP = ['..eee', '.eiie', 'e.ee.']
const HX = 6
const HY = 4

const FLIGHT: [number, number, number][] = [
  [0, 55, 8], [5, 50, 4], [9, 49, 10], [12, 45, 14], [21, 45, 14], [24, 39, 7], [29, 31, 2],
  [34, 27, 6], [38, 21, 5], [46, 21, 5], [49, 27, 0], [54, 36, 3], [59, 47, 6],
]

function flyAt(f: number): { x: number; y: number; isLanded: boolean } {
  const n = FLIGHT.length
  let i = 0
  while (i + 1 < n && (FLIGHT[i + 1]?.[0] ?? LOOP) <= f) i++
  const at = (k: number) => FLIGHT[mod(k, n)] ?? [0, 0, 0]
  const p1 = at(i)
  const p2 = at(i + 1)
  const t1 = p1[0]
  const t2 = i + 1 >= n ? LOOP : p2[0]
  if (p1[1] === p2[1] && p1[2] === p2[2]) return { x: p1[1], y: p1[2], isLanded: true }
  const u = (f - t1) / (t2 - t1)
  const p0 = at(i - 1)
  const p3 = at(i + 2)
  const cr = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u)
  const calm = Math.min(1, u * 4, (1 - u) * 4)
  const isLanding = (at(i + 2)[1] === p2[1] && at(i + 2)[2] === p2[2]) || (at(i - 1)[1] === p1[1] && at(i - 1)[2] === p1[2])
  const buzz = isLanding ? calm : 1
  return {
    x: Math.round(cr(p0[1], p1[1], p2[1], p3[1]) + Math.sin(f * 2.7) * 1.2 * buzz),
    y: Math.round(cr(p0[2], p1[2], p2[2], p3[2]) + Math.sin(f * 3.9 + 1) * 0.9 * buzz),
    isLanded: false,
  }
}

const TAIL_ROOT: [number, number] = [56.5, 15.5]
function tailAngle(f: number): number {
  const rest = 72 + wave(f, LOOP, 4) * 3
  if (f < 14 || f > 44) return rest
  if (f < 18) return lerp(rest, 35, ease.inOut(beat(f, 14, 18)))
  if (f < 21) return lerp(35, -128, ease.in(beat(f, 18, 21)))
  if (f < 26) return -128
  return lerp(-128, rest, glide(beat(f, 26, 44)))
}

function glide(p: number): number {
  if (p < 0.2) return (p * p) / 0.32
  if (p > 0.8) return 1 - (1 - p) ** 2 / 0.32
  return (p - 0.1) / 0.8
}

const tailCurl = (f: number) => lerp(4, -9.5, clamp((72 - tailAngle(f)) / 200))

function tailPoints(f: number): [number, number][] {
  const pts: [number, number][] = [TAIL_ROOT]
  let [x, y] = TAIL_ROOT
  for (let i = 0; i < 11; i++) {
    const a = ((tailAngle(f - i * 0.3) + i * tailCurl(f - i * 0.3)) * Math.PI) / 180
    x += Math.cos(a) * 1.15
    y += Math.sin(a) * 1.15
    pts.push([x, y])
  }
  return pts
}

function chew(f: number): { dx: number; drop: number } {
  const k = mod(f, 8)
  return { dx: [0, -1, -1, -1, 0, 1, 1, 0][k] ?? 0, drop: [0, 1, 1, 0, 0, 0, 0, 0][k] ?? 0 }
}

function sky(x: number, y: number): number {
  const level = 0.6 + y * 0.48 + (x < 20 ? 0.3 : 0)
  return shade(SKY, level, x, y)
}

const CLOUDS: [number, number, number][] = [
  [37, 5, 2.6], [41, 3.5, 3.6], [46, 2.6, 4], [51, 4, 3.2], [55, 5.4, 2.4],
  [24, 4, 1.6], [27, 3, 2.2], [30, 3.6, 1.8],
]

function cloud(x: number, y: number): number | undefined {
  const base = x < 33 ? 4.6 : 6.4
  if (y > base) return undefined
  let best = -1
  let lit = 0
  for (const [cx, cy, r] of CLOUDS) {
    const d = Math.hypot(x - cx, (y - cy) * 1.15)
    if (d > r) continue
    const depth = 1 - d / r
    if (depth > best) {
      best = depth
      lit = ((x - cx) * LX + (y - cy) * LY) / r
    }
  }
  if (best < 0) return undefined
  const under = y >= base - 1 ? -1.3 : 0
  return shade(CLOUD, 2.6 + lit * 1.6 + under, x, y)
}

function ground(x: number, y: number): number {
  const farHill = 14.6 + Math.sin(x * 0.1 + 0.6) * 2 + Math.sin(x * 0.29) * 0.5
  const hill = 16.6 + Math.sin(x * 0.07 + 2.2) * 1.2
  if (y < farHill) return sky(x, y)
  if (y < hill) return shade(HILL_FAR, (y < farHill + 1 ? 2.6 : 1.4) - (y - farHill) * 0.3, x, y)
  if (y < HORIZON + 0.5) return shade(HILL, 1.8 - (y - hill) * 0.6, x, y)
  const depth = (y - HORIZON) / (H_ - HORIZON)
  let level = 6.6 - depth * 3.4
  const row = y % 3
  const tuft = hash(Math.floor((x + (y % 2) * 2) / 3), y, 3) < 0.28
  if (tuft && row === 0) level += 0.9
  if (tuft && row === 1) level -= 0.7
  const sx = (x - 41) / 21
  const sy = (y - 28.6) / 2.4
  if (sx * sx + sy * sy < 1) level -= 2.2
  return shade(GRASS, level, x, y)
}

const H_ = 32

const TREES: [number, number, number][] = [[2, 16, 2.2], [5, 15.5, 2.8], [33, 16.4, 1.8], [61, 16, 2.5], [58, 16.6, 1.7]]

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const breath = wave(f, LOOP, 2) * 0.5 + 0.5

    c.fill((x, y) => cloud(x, y) ?? ground(x, y))
    for (const [tx, ty, r] of TREES) {
      c.ellipse(tx, ty, r, r * 0.8, (x, y) => (y > HORIZON ? undefined : shade(TREE, 1.2 - (x - tx) * 0.3 - (y - ty) * 0.35, x, y)))
    }

    for (let k = 0; k < 22; k++) {
      const fx = Math.floor(hash(k, 1, 9) * 64)
      const fy = Math.floor(31 - Math.sqrt(hash(k, 2, 9)) * 11)
      if (fy >= 23 && fx > 13 && fx < 60) continue
      if (fy < 23 && fx > 16 && fx < 59 && fy > 20) continue
      const isDaisy = hash(k, 3, 9) < 0.4
      const near = fy > 26
      if (isDaisy) c.set(fx, fy, DAISY[fy > 22 ? 1 : 0] ?? 0)
      else c.set(fx, fy, BUTTERCUP[near ? 2 : 1] ?? 0)
      if (near) c.set(fx, fy + 1, GRASS[2] ?? 0)
    }

    const tail = tailPoints(f)
    const before = tailPoints(f - 1)
    const drawTail = () => {
      for (let i = 1; i + 1 < before.length; i++) {
        const [ax, ay] = before[i] ?? [0, 0]
        const [bx, by] = before[i + 1] ?? [0, 0]
        const [nx, ny] = tail[i + 1] ?? [0, 0]
        if (Math.hypot(nx - bx, ny - by) >= 1) c.line(ax, ay, bx, by, BLACK[4] ?? 0)
      }
      for (let i = 0; i + 1 < tail.length; i++) {
        const [ax, ay] = tail[i] ?? [0, 0]
        const [bx, by] = tail[i + 1] ?? [0, 0]
        c.line(ax, ay, bx, by, shade(BLACK, 3.6 - i * 0.2, 0, 0))
        if (i < 4) c.set(ax - 0.6, ay - 0.6, shade(BLACK, 4.4, 0, 0))
      }
      const [ex, ey] = tail[tail.length - 1] ?? [0, 0]
      const [px, py] = tail[tail.length - 3] ?? [0, 0]
      const ux = (ex - px) / 2.3
      const uy = (ey - py) / 2.3
      for (const [k, w] of [[0, 1], [1, 1], [1.8, 0]] as const) {
        c.set(ex + ux * k, ey + uy * k, BLACK[0] ?? 0)
        if (w) c.set(ex + ux * k - uy, ey + uy * k + ux, BLACK[1] ?? 0)
      }
    }
    const bodyColor = (x: number, y: number, dim: number) => {
      const lit = bodyLight(x, y, breath)
      const isRim = !isBody(x - 1, y - 1, breath) && lit > 0.2 && dim === 0
      const isBelly = y >= GROUND - 1
      const patch = isPatch(x, y)
      const level = patch ? 1.6 + lit * 2.4 + (isRim ? 1.2 : 0) : 2.6 + lit * 3.6 + (isRim ? 0.8 : 0)
      return shade(patch ? BLACK : WHITE, level - (isBelly ? 1.2 : 0) - dim, x, y)
    }
    for (let y = 9; y <= GROUND; y++) {
      for (let x = 14; x < 62; x++) if (isBody(x, y, breath)) c.set(x, y, bodyColor(x, y, 0))
    }
    for (const [j, row] of [...HEAD, ...JAW].entries()) {
      for (let i = 0; i < row.length; i++) {
        const x = HX + i + 2
        const y = HY + j + 2
        if (row[i] !== '.' && isBody(x, y, breath)) c.set(x, y, bodyColor(x, y, 2.2))
      }
    }
    c.set(16, 27, BLACK[1] ?? 0)
    c.set(17, 27, BLACK[2] ?? 0)
    c.set(16, 26, shade(WHITE, 3.5, 0, 0))
    c.set(58, 27, BLACK[1] ?? 0)
    c.set(59, 27, BLACK[2] ?? 0)

    for (let x = 0; x < 64; x++) {
      const h = hash(x, 5, 1)
      if (h > 0.55) continue
      const height = 1 + Math.floor(h * 6) % 3
      const sway = Math.round(wave(f, LOOP, 2, x * 0.07) * 0.6 * (height - 1) / 2)
      for (let j = 0; j < height; j++) {
        const by = (h < 0.25 ? 29 : 31) - j
        const bx = x + (j === height - 1 ? sway : 0)
        c.set(bx, by, shade(GRASS, (h < 0.25 ? 4.6 : 3.4) + j * 0.9 - (by < 29 && bx > 20 && bx < 58 ? 1 : 0), bx, by))
      }
    }

    const { dx, drop } = chew(f)
    const isBlink = f === 30 || f === 31
    const earFlick = f >= 46 && f <= 48 ? 1 : 0
    const idleEar = f >= 7 && f <= 8 ? 1 : 0
    const cx = HX + 8
    const lightAcross = (x: number) => (cx - x) * 0.18
    const palette: Record<string, Paint> = {
      w: (x, y) => shade(WHITE, 4.3 + lightAcross(x) - (y - HY) * 0.08 + (x === HX + 5 ? 0.8 : 0), x, y),
      k: (x, y) => shade(BLACK, 2.1 + lightAcross(x) * 0.8 + (y === HY + 1 ? 0.8 : 0), x, y),
      e: (x, y) => shade(BLACK, 1.8 + lightAcross(x) * 0.6, x, y),
      i: (x, y) => shade(PINK, 2.2 + lightAcross(x) * 0.6, x, y),
      h: (x, y) => shade(HORN, 2.3 + lightAcross(x) * 0.5, x, y),
      o: isBlink ? BLACK[3] ?? 0 : (x, y) => (x < cx ? 0xf4f0e6 : BLACK[0] ?? 0),
      p: (x, y) => shade(PINK, 2.8 + lightAcross(x) * 0.7 + (y === HY + 9 ? 0.5 : 0), x, y),
      n: PINK[0] ?? 0,
      l: (x, y) => shade(PINK, 1.7 + lightAcross(x) * 0.6, x, y),
      c: (x, y) => shade(WHITE, 2.7 + lightAcross(x) * 0.6, x, y),
    }
    c.sprite(HX, HY, HEAD, palette)
    if (drop) c.rect(HX + 5 + dx, HY + 12, 7, 1, PINK[0] ?? 0)
    c.sprite(HX + dx, HY + 12 + drop, JAW, palette)
    if (!isBlink) {
      c.set(HX + 5, HY + 4, 0x2a1a14)
      c.set(HX + 5, HY + 3, 0xf4f0e6)
      c.set(HX + 11, HY + 4, 0x2a1a14)
    }
    if (earFlick) {
      for (let j = 2; j <= 4; j++) for (let i = 13; i <= 16; i++) c.set(HX + i, HY + j, cloud(HX + i, HY + j) ?? sky(HX + i, HY + j))
      c.sprite(HX + 13, HY, EAR_UP, palette)
    }
    if (idleEar) {
      for (let j = 2; j <= 4; j++) for (let i = 0; i <= 2; i++) c.set(HX + i, HY + j, cloud(HX + i, HY + j) ?? sky(HX + i, HY + j))
      c.sprite(HX, HY + 1, ['eee', 'eii', '.ee'], palette)
    }

    drawTail()

    const fly = flyAt(f)
    c.set(fly.x, fly.y, 0x101018)
    c.set(fly.x + 1, fly.y, 0x2a2a36)
    if (!fly.isLanded) c.set(fly.x + (f % 2), fly.y - 1, 0xd8e4f0)
    else if (f % 6 < 3) c.set(fly.x, fly.y - 1, 0xb8c4d8)
  })
}

export const scene: Scene = { verb: 'Ruminating', render, hero: 24 }
