import { Canvas, TAU, beat, ease, hash, hex, noise, particles, random, shade, threshold, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const WALL = hex('0d0912 140f19 1c1521 271c2a 352432 482d36 5f3a3b 7c4d43 9a654f b88460')
const WOOD = hex('140b0c 24130f 371e14 4f2b19 6a3b1f 8a5028 ab6a34 c98a48')
const GLASS = hex('1a2228 34444a 5e767a 98b4b0 d4ece2 f6fff8')
const BRINE = hex('17200c 26360f 3c5014 5a6e1c 7c8c26 a2aa3c c8c866 eae4a0')
const PICKLE = hex('0c160c 15281a 1f3c22 2c5228 3e6a2e 568436 74a040')
const DILL = hex('1e3412 3a5a1a 6a8c2a a4bc4a')
const RED = hex('2a080c 4a0e14 741619 a0221b c83a22 e45e2e f48a48 fbb470')
const CABBAGE = hex('8a5a34 b88444 dcb066 f2d898')
const AMBER = hex('240e06 3f1a08 642a0c 8c420f b2601a cf8228 e6a646 f6cc7c')
const SCOBY = hex('7a6040 a8885c d0b484 ecd8ac')
const CORK = hex('2e1a0e 4e2f17 744a24 9a6a36 bd8c4e dcb070')
const FOAM = hex('8e8070 c4b8a4 e8e0cc fffaf0')
const GOLD = hex('2c1a08 4e300c 7a4c10 a8701a d1982a eec24a fae58a')
const STEEL = hex('17161c 2a2832 3e3b47 595462 7f7787 b1a7b2 e6dcd8')
const CROCK = hex('2a1d18 4a3426 6e5038 947256 b89a78 d8c09c ecdcbc')
const GLAZE = hex('1c0f0a 2e180e 462414 603418 7c4620 9a5a2a')
const COBALT = hex('101838 1e2c66 34489a')
const CHILI = hex('2a0608 4c0c0e 7a1414 a42018 c8402a')
const GAS = hex('4a3438 7a5e5c b09890 dccbbc f2e6d6')
const MOTE = 0xf6d89a
const HOLLOW = hex('1c1820 2a2630 3e3c42 5a5a58 7a7a6e')

function sun(x: number, y: number, hasBars = false): number {
  const u = x - 0.55 * y
  const e = Math.min(u - 8, 46 - u, y - 2, 26 - y)
  if (e < 0) return 0
  const isBar = hasBars && (Math.abs(u - 27) < 1 || y === 13)
  return (e < 1 ? 0.5 : 1) * (isBar ? 0.2 : 1)
}
type Rows = Map<number, readonly [number, number]>
function rows(spans: readonly (readonly [number, number, number, number])[]): Rows {
  const m: Rows = new Map()
  for (const [y0, y1, x0, x1] of spans) for (let y = y0; y <= y1; y++) m.set(y, [x0, x1])
  return m
}
const PICKLE_JAR = rows([[9, 9, 16, 24], [10, 10, 15, 25], [11, 24, 14, 26], [25, 25, 15, 25]])
const PICKLE_LID = rows([[6, 6, 16, 24], [7, 8, 15, 25]])
const KIMCHI_JAR = rows([[14, 14, 31, 41], [15, 15, 30, 42], [16, 24, 29, 43], [25, 25, 30, 42]])
const BOTTLE = rows([[8, 8, 48, 53], [9, 10, 49, 52], [11, 11, 48, 53], [12, 24, 47, 54], [25, 25, 48, 53]])
const CROCK_BODY = rows([[14, 14, 2, 10], [15, 15, 2, 10], [16, 24, 1, 11], [25, 25, 2, 10]])
const CROCK_LID = rows([[12, 12, 5, 7], [13, 13, 3, 9]])
const BASES: readonly (readonly [number, number])[] = [[2, 10], [15, 25], [30, 42], [48, 53]]
const BURP = 21
function bulge(f: number): number {
  if (f === BURP) return 1
  if (f < 4 || f > BURP) return 0
  return Math.floor(beat(f, 4, 20) ** 1.5 * 2.99)
}
function lidLift(f: number): number {
  return f === BURP ? 2 : f === BURP - 1 || f === BURP + 1 ? 1 : 0
}
const POP = 44
function pressure(f: number): number {
  if (f >= 24 && f < POP) return beat(f, 24, POP) ** 2
  if (f >= POP && f < 52) return 0.7 * (1 - beat(f, POP, 52))
  return 0
}
type Pose = 'up' | 'tilt' | 'side' | 'squash'
type Cork = { x: number; y: number; pose: Pose }
const CORK_REST = 6
function cork(f: number): Cork | undefined {
  if (f < POP) {
    const p = beat(f, 28, 42)
    const lift = p < 0.45 ? 0 : p < 0.8 ? 1 : 2
    const shiver = f >= 38 && f % 2 === 1 ? 1 : 0
    return { x: 49 + shiver, y: CORK_REST - lift, pose: 'up' }
  }
  if (f < POP + 2) return { x: 50 + (f - POP), y: f === POP ? 0 : -3, pose: f === POP ? 'up' : 'tilt' }
  if (f < 59) return undefined
  if (f < 64) return { x: 49, y: [-2, 0, 2, 4, 6][f - 59] ?? CORK_REST, pose: (['side', 'tilt', 'tilt', 'up', 'squash'] as const)[f - 59] ?? 'up' }
  return { x: 49, y: f === 64 ? CORK_REST - 1 : CORK_REST, pose: 'up' }
}
const CORK_ART: Record<Pose, readonly string[]> = {
  up: ['abba', 'bbbc', 'bbcc', 'bccd'],
  tilt: ['.ab.', 'abbc', 'bbcc', '.cd.'],
  side: ['abbbc', 'bbccd', '.ccd.'],
  squash: ['abbba', 'bbbcc', 'bccdd'],
}
function corkMask(k: Cork, put: (x: number, y: number) => void): void {
  CORK_ART[k.pose].forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] !== '.') put(k.x + i, k.y + j)
  })
}
function foamHeight(f: number): number {
  if (f < POP || f > 62) return 0
  if (f < POP + 4) return [3, 5, 7, 9][f - POP] ?? 0
  return Math.round(9 * (1 - beat(f, POP + 4, 62)) ** 1.4)
}
function drip(f: number): { length: number; left: number } {
  if (f < POP + 1 || f > 66) return { length: 0, left: 0 }
  return { length: Math.round(10 * ease.out(beat(f, POP + 1, 55))), left: 1 - beat(f, 56, 66) }
}
const DROPS = (() => {
  const rng = random(0xfe7)
  return Array.from({ length: 12 }, () => ({
    born: POP + Math.floor(rng() * 3),
    vx: (rng() - 0.5) * 2.4,
    vy: -1.6 - rng() * 1.6,
    isAmber: rng() < 0.35,
  }))
})()
const PICKLES: readonly (readonly [number, number, number])[] = [[15, 17, 12], [19, 21, 11], [23, 25, 13]]
const CABBAGE_BITS: readonly (readonly [number, number, number, number])[] = [
  [31, 19, 33, 20], [36, 18, 38, 18], [40, 20, 41, 22], [33, 22, 35, 23], [38, 23, 40, 24], [30, 23, 31, 24],
]
function render(): Int32Array[] {
  const out: Int32Array[] = []

  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const b = bulge(f)
    const shiver = f >= 17 && f < BURP && f % 2 === 1 ? 1 : 0
    const lift = lidLift(f)
    const k = cork(f)
    const solid = new Uint8Array(W * H)
    const mark = (x: number, y: number) => {
      if (x >= 0 && x < W && y >= 0 && y < H) solid[y * W + x] = 1
    }
    for (const r of [PICKLE_JAR, PICKLE_LID, KIMCHI_JAR, BOTTLE, CROCK_BODY, CROCK_LID]) {
      for (const [y, [x0, x1]] of r) for (let x = x0; x <= x1; x++) mark(x, y)
    }
    for (let y = 11 - b; y <= 13; y++) for (let x = 30; x <= 42; x++) mark(x + shiver, y - lift)
    if (k) corkMask(k, mark)
    const isSolid = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H && solid[y * W + x] === 1
    for (let y = 0; y < 25; y++) {
      for (let x = 0; x < W; x++) {
        const board = Math.floor((x + 3) / 8)
        const isSeam = (x + 3) % 8 === 0
        const v = ((x - 32) / 36) ** 2 + ((y - 13) / 24) ** 2
        const lit = sun(x, y, true) * (isSolid(x - 2, y - 3) ? 0.12 : 1)
        c.set(x, y, shade(WALL, 2 + hash(board, 3) * 0.8 + lit * 6 - (isSeam ? 1 : 0) - v * 1.5, x, y))
      }
    }
    for (let x = 0; x < W; x++) {
      const lit = sun(x - 1, 24)
      const isUnder = BASES.some(([a, z]) => x >= a && x <= z)
      const isCast = BASES.some(([, z]) => x > z && x <= z + 3)
      const top = lit * (isCast ? 0.15 : 1)
      c.set(x, 25, shade(WOOD, 3.2 + top * 2.6, x, 25))
      c.set(x, 26, shade(WOOD, 3.8 + top * 2.6 - (isUnder ? 2 : 0), x, 26))
      c.set(x, 27, shade(WOOD, 5.2 + lit * 1.8, x, 27))
      const knot = hash(Math.floor(x / 6), 1) < 0.35 ? 0.7 : 0
      c.set(x, 28, shade(WOOD, 3.1 + lit * 0.9 - knot, x, 28))
      c.set(x, 29, shade(WOOD, 2.6 + lit * 0.6, x, 29))
      c.set(x, 30, shade(WOOD, 0.9, x, 30))
      c.set(x, 31, shade(WOOD, 0.3, x, 31))
    }
    for (const bx of [7, 57]) {
      c.set(bx, 30, shade(STEEL, 2, bx, 30))
      c.set(bx, 31, shade(STEEL, 1.4, bx, 31))
    }
    for (let y = 0; y <= 13; y++) c.set(60, y, shade(WOOD, 2.6, 60, y))
    for (const [cx, cy, isLeft] of [[59, 2, 1], [61, 4, 0], [59, 7, 1], [61, 9, 0], [59, 12, 1]] as const) {
      const x = isLeft ? cx - 1 : cx
      c.set(cx, cy, shade(DILL, 1.4, cx, cy))
      for (let j = 1; j <= 3; j++) {
        c.set(x, cy + j, CHILI[3] ?? 0)
        c.set(x + 1, cy + j, CHILI[2] ?? 0)
      }
      c.set(isLeft ? x : x + 1, cy + 4, CHILI[isLeft ? 3 : 2] ?? 0)
    }
    for (const [y, [x0, x1]] of CROCK_BODY) {
      for (let x = x0; x <= x1; x++) {
        const n = (x - 6) / 5.5
        const round = (1 - n) * 1.1 - (x === x1 ? 0.6 : 0) + (x === x0 + 1 ? 0.5 : 0)
        const lit = sun(x, y)
        if (y <= 17) c.set(x, y, shade(GLAZE, 1.6 + round + lit * 2 + (y === 14 ? 1.2 : 0), x, y))
        else if (y === 20) c.set(x, y, shade(COBALT, 0.6 + round * 0.7, x, y))
        else c.set(x, y, shade(CROCK, 1.6 + round + lit * 2 - (y === 25 ? 0.8 : 0), x, y))
      }
    }
    for (const [y, [x0, x1]] of CROCK_LID) {
      for (let x = x0; x <= x1; x++) c.set(x, y, shade(GLAZE, 2.2 + (6 - x) * 0.25 + (y === 12 ? 0.6 : 0), x, y))
    }
    const blip = mod2(f - 8) < 3 ? mod2(f - 8) : mod2(f - 56) < 3 ? mod2(f - 56) : -1
    if (blip === 0) c.set(9, 13, shade(FOAM, 1, 9, 13))
    if (blip === 1) {
      c.set(9, 12, shade(FOAM, 2, 9, 12))
      c.set(10, 13, shade(FOAM, 1, 10, 13))
    }
    glass(c, PICKLE_JAR, [12, 17, 19], (x, y) => {
      if (y < 11) return undefined
      const lit = sun(x, y)
      for (const [p0, p1, top] of PICKLES) {
        if (x < p0 || x > p1 || y < top || (y === top && x !== p0 + 1)) continue
        const col = x - p0
        const wart = col === 0 && hash(x, y, 5) < 0.12 ? 0.9 : 0
        return shade(PICKLE, 3.8 - col * 1.1 + lit * 2.2 + wart - (y === top ? 0.5 : 0), x, y)
      }
      return shade(BRINE, 3.2 + lit * 2.6 - ((x - 14) / 12) * 1.3 + (y === 11 ? 1.2 : 0), x, y)
    })
    for (let y = 14; y <= 24; y++) c.set(18, y, DILL[1] ?? 0)
    for (const [x, y] of [[17, 11], [18, 11], [19, 11], [17, 12], [18, 12], [18, 13], [19, 13]] as const) {
      c.set(x, y, DILL[y === 11 ? 3 : 2] ?? 0)
    }
    for (const [x, y, l] of [[22, 22, 2.4], [23, 22, 3], [22, 23, 1.6], [23, 23, 2.2]] as const) {
      c.set(x, y, shade(CABBAGE, l + sun(x, y) * 0.8, x, y))
    }
    for (const [x, y] of [[16, 24], [20, 23], [25, 24]] as const) c.set(x, y, PICKLE[0] ?? 0)
    const rise = b > 0 ? 1 : 0
    glass(c, KIMCHI_JAR, [16, 20, 22], (x, y) => {
      const top = 16 - rise
      if (y < top) return undefined
      const lit = sun(x, y)
      const rel = (x - 29) / 14
      if (y < 18 - rise) return shade(RED, 3.6 + lit * 2.4 - rel + (y === top ? 1.2 : 0), x, y)
      const n = noise(x * 0.34, (y + rise) * 0.5, 0, 9)
      return shade(RED, 2 + Math.floor(n * 2.4) * 1.1 + lit * 2 - rel * 1.2, x, y)
    })
    for (const [x0, y0, x1, y1] of CABBAGE_BITS) {
      c.line(x0, y0 - rise, x1, y1 - rise, (x, y) => shade(CABBAGE, 1.2 + sun(x, y) * 2.2 - ((x - 29) / 14) * 0.8, x, y))
    }
    for (const [x, y] of [[35, 20], [36, 20]] as const) c.set(x, y - rise, shade(DILL, 2 + sun(x, y), x, y))
    for (const [x, y] of [[32, 21], [39, 19], [37, 22], [42, 21]] as const) c.set(x, y - rise, RED[1] ?? 0)
    if (k) drawCork(c, k)
    glass(c, BOTTLE, [13, 18, 21], (x, y) => {
      if (y < 11) return undefined
      const lit = sun(x, y)
      const rel = (x - 47) / 7
      if (y === 11) return shade(SCOBY, 2 + lit * 1.4 - rel, x, y)
      if (y === 12) return shade(SCOBY, 0.6 + lit - rel, x, y)
      if ((x === 49 && y <= 15) || (x === 52 && y <= 14)) return shade(AMBER, 4.4 + lit * 2, x, y)
      return shade(AMBER, 3 + lit * 2.6 - rel * 1.4, x, y)
    })
    bubbles(c, f, { seed: 1, count: 10, life: 26, x0: 15, x1: 25, bottom: 24, top: 12, speed: 0.55, ramp: BRINE })
    bubbles(c, f, {
      seed: 2, count: 16, life: 14, x0: 30, x1: 42, bottom: 22, top: 16 - rise + 1, speed: 0.6, ramp: RED,
      rate: born => (born >= 4 && born < BURP ? 0.35 + 0.65 * beat(born, 4, BURP) : 0.3),
    })
    bubbles(c, f, {
      seed: 3, count: 30, life: 14, x0: 48, x1: 53, bottom: 24, top: 13, speed: 0.9, ramp: AMBER,
      rate: born => 0.2 + 0.8 * pressure(born),
    })
    for (const [y, [x0, x1]] of PICKLE_LID) {
      for (let x = x0; x <= x1; x++) {
        const lit = sun(x, y)
        const rel = (x - x0) / (x1 - x0)
        const ridge = y === 7 && (x - x0) % 3 === 2 ? -0.7 : 0
        const level = (y === 6 ? 4.2 : y === 7 ? 3.2 : 2.2) + lit * 1.6 - rel * 1.8 + ridge + (x === 16 && y === 7 ? 1.4 : 0)
        c.set(x, y, shade(GOLD, level, x, y))
      }
    }
    const lx = shiver
    const ly = -lift
    const dome: (readonly [number, number, number])[] = [[11, 31, 41], [12, 30, 42], [13, 30, 42]]
    if (b >= 1) dome.unshift([10, 33, 39])
    if (b >= 2) {
      dome[0] = [10, 32, 40]
      dome.unshift([9, 34, 38])
    }
    for (const [y, x0, x1] of dome) {
      for (let x = x0; x <= x1; x++) {
        const lit = sun(x + lx, y + ly)
        const rel = (x - x0) / Math.max(1, x1 - x0)
        const isTop = y <= 11
        const glint = isTop && x === x0 + 1 ? 1.2 : 0
        const level = (isTop ? 4.2 : y === 12 ? 3.2 : 2.2) + lit * 1.4 - rel * 1.8 + glint
        c.set(x + lx, y + ly, shade(STEEL, level, x, y))
      }
    }
    if (f === BURP || f === BURP + 1) {
      const o = f - BURP
      for (const [x, y, dx] of [[28, 11, -1], [44, 11, 1]] as const) {
        c.set(x + dx * o, y - o, shade(GAS, 4 - o, x, y))
        c.set(x + dx * (o + 1), y - o - 1, shade(GAS, 3.4 - o, x, y))
      }
    }
    for (const [i, [ox, oy, drift]] of ([[31, 12, -0.25], [41, 12, 0.25], [36, 9, 0]] as const).entries()) {
      const t = f - BURP - (i === 2 ? 1 : 0)
      if (t < 0 || t > 14) continue
      const age = t / 14
      const px = Math.round(ox + drift * t) + 0.5
      const py = Math.round(oy - t * 0.5) + 0.5
      const r = 1.2 + age * 2
      const alpha = (1 - age) * Math.min(1, (t + 1) / 2)
      for (let y = Math.floor(py - r); y <= Math.ceil(py + r); y++) {
        for (let x = Math.floor(px - r); x <= Math.ceil(px + r); x++) {
          const d = Math.hypot((x - px) / 1.25, y - py) / r
          const density = alpha * (1.1 - d * d)
          if (d > 1 || density < 0.32) continue
          c.set(x, y, shade(GAS, 1 + density * 3.4, x, y))
        }
      }
    }
    const h = foamHeight(f)
    if (h > 0) {
      const sway = f > POP + 2 ? Math.round(Math.sin(f * 0.9) * 0.6) : 0
      for (let j = 0; j < h; j++) {
        const y = 7 - j
        const isCrown = j >= h - 3 && h > 3
        const isTip = j === h - 1
        const x0 = isTip ? 49 : isCrown ? 48 : 49
        const x1 = isTip ? 52 : isCrown ? 53 : 52
        const dx = j > 2 ? sway : 0
        for (let x = x0; x <= x1; x++) {
          const rel = (x - x0) / Math.max(1, x1 - x0)
          const pit = hash(x, y, f >> 2) < 0.06 ? -0.9 : 0
          c.set(x + dx, y, shade(FOAM, 2.8 - rel * 1.6 + (isCrown ? 0.4 : 0) + pit, x, y))
        }
      }
    }
    const run = drip(f)
    if (run.length > 0) {
      for (const [side, scale] of [[0, 1], [1, 0.6]] as const) {
        const end = 8 + Math.round(run.length * scale)
        for (let y = 8; y <= end; y++) {
          const span = BOTTLE.get(y)
          if (!span) continue
          const x = side === 0 ? span[0] : span[1]
          if (run.left < 1 && threshold(x, y) > run.left) continue
          c.set(x, y, shade(FOAM, side === 0 ? 2.6 : 1.4, x, y))
          if (y === end) c.set(x + (side === 0 ? 1 : -1), y, shade(FOAM, side === 0 ? 2 : 1, x, y))
        }
      }
    }
    if (f === POP || f === POP + 1) {
      const r0 = f === POP ? 3 : 5
      for (let i = 0; i < 7; i++) {
        const a = Math.PI + (i / 6) * Math.PI
        for (let s = 0; s < 2; s++) {
          const x = 50.5 + Math.cos(a) * (r0 + s) * 1.2
          const y = 6 + Math.sin(a) * (r0 + s)
          if (f === POP + 1 && threshold(Math.round(x), Math.round(y)) > 0.6) continue
          c.set(x, y, FOAM[f === POP ? 3 : 2] ?? 0)
        }
      }
      if (f === POP) for (let x = 49; x <= 52; x++) c.set(x, 7, FOAM[3] ?? 0)
    }
    for (const d of DROPS) {
      const t = f - d.born
      if (t < 0 || t > 12) continue
      const x = 50.5 + d.vx * t
      const y = 6 + d.vy * t + 0.22 * t * t
      if (y > 24) continue
      c.set(x, y, d.isAmber ? AMBER[6] ?? 0 : FOAM[3] ?? 0)
    }
    if (k && k.y < CORK_REST - 2) drawCork(c, k)
    for (const p of particles(f, LOOP, 18, 36, 7)) {
      const alpha = Math.sin(p.age * Math.PI)
      const x = Math.round(16 + p.r[0] * 36 + Math.sin(p.t * 0.09 + p.r[2] * TAU) * 1.5)
      const y = Math.round(3 + p.r[1] * 18 + p.t * 0.1)
      if (alpha < 0.4 || sun(x, y) < 1 || isSolid(x, y)) continue
      c.set(x, y, alpha > 0.75 ? MOTE : WALL[9] ?? 0)
    }
    out.push(c.px)
  }

  return out
}

const mod2 = (v: number) => ((v % LOOP) + LOOP) % LOOP
function drawCork(c: Canvas, k: Cork): void {
  const palette = {
    a: shade(CORK, 5, 0, 0),
    b: shade(CORK, 3.6, 0, 0),
    c: shade(CORK, 2.4, 0, 0),
    d: shade(CORK, 1.2, 0, 0),
  }
  c.sprite(k.x, k.y, CORK_ART[k.pose], palette)
}
function glass(c: Canvas, r: Rows, streak: readonly number[], content: (x: number, y: number) => number | undefined): void {
  const bottom = Math.max(...r.keys())
  const [s0 = 0, s1 = 0, s2 = 0] = streak
  for (const [y, [x0, x1]] of r) {
    for (let x = x0; x <= x1; x++) {
      const lit = sun(x, y)
      if (x === x0) c.set(x, y, shade(GLASS, 2 + lit * 2.2, x, y))
      else if (x === x1) c.set(x, y, shade(GLASS, 0.8 + lit * 1.2, x, y))
      else if (y === bottom) c.set(x, y, shade(GLASS, 1.4 + lit * 1.6, x, y))
      else {
        const k = content(x, y)
        if (k === undefined) c.set(x, y, shade(HOLLOW, 1 + lit * 2.2 - (x - x0) / (x1 - x0), x, y))
        else c.set(x, y, k)
        if (x === x0 + 1 && ((y >= s0 && y <= s1) || y === s2)) c.set(x, y, shade(GLASS, 3.4 + lit * 1.6, x, y))
      }
    }
  }
}
type Bubbles = {
  seed: number
  count: number
  life: number
  x0: number
  x1: number
  bottom: number
  top: number
  speed: number
  ramp: readonly number[]
  rate?: (born: number) => number
}
function bubbles(c: Canvas, f: number, o: Bubbles): void {
  for (const p of particles(f, LOOP, o.count, o.life, o.seed)) {
    if (o.rate && p.r[2] > o.rate(mod2(f - p.t))) continue
    const x = o.x0 + Math.floor(p.r[0] * (o.x1 - o.x0 + 1)) + (Math.floor(p.t / 4 + p.r[3] * 4) % 2)
    const y = Math.round(o.bottom - p.t * o.speed * (0.7 + p.r[1] * 0.6))
    if (y < o.top || x > o.x1) continue
    c.set(x, y, o.ramp[o.ramp.length - 2] ?? 0)
  }
}
export const scene: Scene = {
  verb: 'Fermenting',
  render,
  hero: 46,
  snaps: [{ frames: POP, box: [50, 0, 53, 7], colors: [...CORK.slice(1, 3), ...CORK.slice(4, 6)], why: 'the cork pops: it shoots up out of the neck' }],
}
