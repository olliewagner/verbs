import { PALETTE, clamp, frames, hash, hex, particles, shade, type Scene, type Snap } from '../engine'

const W = 64
const H = 32
const LOOP = 72
const SEG = 24

const WALL = hex('0b0a17 120f22 1a152e 231c3c 2e244c 3b2f5e 4c3d70')
const FLOOR = hex('09080f 110e1a 1a1526 241d33 302641 3f3352')
const PAINT = hex('240810 461019 6e1820 9a241f c43c26 e2643a f4965a')
const CHROME = PALETTE.metal
const COPPER = PALETTE.copper
const BEAM = hex('241e78 3a4ad0 4f9cf0 8ce4ff dcfffb')
const CLOUD = hex('3e3560 6c6196 a49cc8 dcd8f2')
const BOARD = hex('0d1a18 142824 1d3a33 6f8a80 a8bcb2')
const WOOD = PALETTE.wood
const FIRE = PALETTE.fire

const RAMPS = {
  duck: hex('5a3a0c 8a5c12 c08a1a e8b42a f6d84a fdf088 fffbd0'),
  beak: PALETTE.orange,
  green: hex('0f2418 1a3d24 25592e 33783a 4c9a44 76bc58 a8da7a'),
  belly: hex('3e4a26 64703a 909a52 b8bc72 d6d48e'),
  wing: hex('10242a 1a3a40 26545a 357074 4a908c'),
  horn: hex('6b5a48 9a8468 c4ae8a e3d1ad'),
  china: hex('3a3e58 5c637e 8a92aa b8c0d4 dde4ee f6f9fc'),
  band: hex('101c4a 1c2f7a 2c48a8 4466c8'),
  eye: hex('120a18'),
} as const
type Mat = keyof typeof RAMPS

type Prim =
  | { kind: 'oval'; cx: number; cy: number; rx: number; ry: number; mat: Mat; stripe?: [number, number] }
  | { kind: 'ring'; cx: number; cy: number; rx: number; ry: number; w: number; mat: Mat }
  | { kind: 'poly'; pts: [number, number][]; mat: Mat; level: number }
  | { kind: 'dot'; x: number; y: number; mat: Mat }

const DUCK = (blink: boolean, tail = 0): Prim[] => [
  { kind: 'poly', pts: [[3.4, -3.2], [6.4, -7.6 + tail], [6.4, -2.4]], mat: 'duck', level: 3.4 },
  { kind: 'oval', cx: 0.5, cy: -3.2, rx: 5.6, ry: 3.2, mat: 'duck' },
  { kind: 'oval', cx: 1.8, cy: -3.8, rx: 2.8, ry: 1.6, mat: 'duck' },
  { kind: 'oval', cx: -2.2, cy: -8.2, rx: 3, ry: 2.8, mat: 'duck' },
  { kind: 'oval', cx: -5.4, cy: -7.4, rx: 1.9, ry: 1, mat: 'beak' },
  ...(blink ? [] : [{ kind: 'dot', x: -3, y: -9, mat: 'eye' } as const]),
]

const DRAGON = (flap: number): Prim[] => [
  { kind: 'poly', pts: [[2.5, -1.4], [6.6, -1.2], [8.4, -3.4], [8, -5.2], [6.8, -3], [3, -3.4]], mat: 'green', level: 2.8 },
  { kind: 'poly', pts: [[0.5, -6.5], [5, -10.8 + flap], [8, -9.6 + flap], [6.4, -7.6 + flap * 0.5], [6.6, -5.6], [2.5, -4.4]], mat: 'wing', level: 3 },
  { kind: 'oval', cx: 0.4, cy: -3.7, rx: 3.7, ry: 3.7, mat: 'green' },
  { kind: 'oval', cx: -1, cy: -3.2, rx: 1.8, ry: 2.4, mat: 'belly' },
  { kind: 'oval', cx: -2.4, cy: -0.6, rx: 1.5, ry: 0.9, mat: 'green' },
  { kind: 'oval', cx: 2, cy: -0.6, rx: 1.5, ry: 0.9, mat: 'green' },
  { kind: 'poly', pts: [[-0.4, -10.4], [0.8, -13.2], [1.6, -10]], mat: 'horn', level: 2.6 },
  { kind: 'oval', cx: -1.6, cy: -9, rx: 2.8, ry: 2.4, mat: 'green' },
  { kind: 'oval', cx: -4.4, cy: -8.2, rx: 1.9, ry: 1.3, mat: 'green' },
  { kind: 'poly', pts: [[-2.6, -10.8], [-2.2, -13.2], [-1, -10.8]], mat: 'horn', level: 3.4 },
  { kind: 'dot', x: -2, y: -9.6, mat: 'eye' },
]

const TEAPOT = (lid: number): Prim[] => [
  { kind: 'ring', cx: 5.4, cy: -5, rx: 2.5, ry: 2.7, w: 1.15, mat: 'china' },
  { kind: 'poly', pts: [[-3.6, -2.2], [-6.6, -6], [-8.6, -9], [-6.8, -9.4], [-5, -7.6], [-3.4, -6.6]], mat: 'china', level: 3.6 },
  { kind: 'oval', cx: 0, cy: -4.4, rx: 5.3, ry: 4.4, mat: 'china', stripe: [-5.6, -4.4] },
  { kind: 'oval', cx: 0, cy: -8.6 - lid, rx: 3.3, ry: 1.2, mat: 'china' },
  { kind: 'oval', cx: 0, cy: -10.2 - lid, rx: 1.1, ry: 1, mat: 'band' },
]

const LX = -0.25
const LY = -0.82
const LZ = 0.52

function inPoly(pts: readonly [number, number][], x: number, y: number): boolean {
  let isIn = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i] ?? [0, 0]
    const [xj, yj] = pts[j] ?? [0, 0]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) isIn = !isIn
  }
  return isIn
}

function figureAt(prims: readonly Prim[], x: number, y: number, scale: readonly [number, number] = [1, 1]): number | undefined {
  for (let k = prims.length - 1; k >= 0; k--) {
    const p = prims[k]
    if (!p) continue
    const ramp = RAMPS[p.mat]
    if (p.kind === 'dot') {
      if (Math.round((x - p.x) * scale[0]) === 0 && Math.round((y - p.y) * scale[1]) === 0) return ramp[0]
      continue
    }
    if (p.kind === 'poly') {
      if (inPoly(p.pts, x, y)) return shade(ramp, p.level)
      continue
    }
    const nx = (x - p.cx) / p.rx
    const ny = (y - p.cy) / p.ry
    const d2 = nx * nx + ny * ny
    if (d2 > 1) continue
    if (p.kind === 'ring') {
      const ix = (x - p.cx) / (p.rx - p.w)
      const iy = (y - p.cy) / (p.ry - p.w)
      if (ix * ix + iy * iy < 1) continue
    }
    const nz = Math.sqrt(Math.max(0, 1 - d2))
    const lit = Math.max(0, nx * LX + ny * LY + nz * LZ)
    const top = ramp.length - 1
    const isStripe = p.kind === 'oval' && p.stripe && y >= p.stripe[0] && y <= p.stripe[1]
    if (isStripe) return shade(RAMPS.band, 0.4 + lit * 3.2)
    return shade(ramp, 0.6 + lit * (top - 0.4) + (lit > 0.96 ? 1 : 0))
  }
  return undefined
}

const FIGURE_X = 46
const FIGURE_Y = 22.5
const PLINTH_Y = 23
const DUCK_HOP: [number, number][] = [[0, 0], [0, 0], [-1, 1], [-1, -1], [0, 1], [0, 0], [0, 0], [0, 0], [0, 0], [-1, 1], [-1, -1], [0, 1]]

function figure(kind: number, u: number): Prim[] {
  if (kind === 0) return DUCK(u === 6 || u === 7, DUCK_HOP[u]?.[1])
  if (kind === 1) return DRAGON([0, 1.4, 2.6, 1.4][u % 4] ?? 0)
  return TEAPOT(u === 3 || u === 4 || u === 8 || u === 9 ? 1 : 0)
}

const charge = (u: number) => (u < 11 ? 0 : u <= 16 ? (u - 10) / 6 : u <= 18 ? 1 : clamp(1 - (u - 18) / 3))
const FLAME: [number, number, number][] = [[0, 1, 0], [0, 3, 0], [0, 5, 0], [0, 5, 1.5], [2, 5, 3]]

const SMOKE: [number, number, number][][] = [
  [[-12, -9, 0.6]],
  [[-12, -10, 1], [-13, -10, 1], [-12, -11, 1]],
  [[-13, -11, 0.8], [-14, -11, 0.8]],
  [[-15, -11.5, 0.4]],
]
const CLOUD_PUFFS: [number, number, number][] = [[-3.5, -6, 3.6], [2, -9, 3.6], [4.2, -4, 3.2], [-4.4, -2, 2.8], [0, -3, 4.2], [-0.6, -11.5, 2.8], [5.6, -9.5, 2.4]]
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const seg = Math.floor(f / SEG)
    const u = f % SEG
    const kind = (seg + (u >= 19 ? 1 : 0)) % 3
    const ch = charge(u)
    const isZap = u >= 17 && u <= 18
    const flash = [0.4, 1, 0.6, 0.3][u - 17] ?? 0
    const recoil = isZap ? -1 : 0
    const inCone = (x: number, y: number) => y >= 5 && Math.abs(x - 46) <= 1.6 + (y - 5) * 0.46
    const glowAt = (x: number, y: number) => ch * Math.max(0, 1 - Math.hypot(x - 23, y - 13) / (5 + ch * 7))
    for (let y = 0; y < 27; y++) {
      for (let x = 0; x < W; x++) {
        const isSeam = x % 13 === 6
        const isRail = y === 18
        const lower = y > 18
        let level = 2.2 - (isSeam ? 0.9 : 0) + (isRail ? 1.4 : 0) - (lower ? 0.7 : 0) - (y === 19 ? 0.8 : 0)
        if (inCone(x, y)) level += 1.2
        level += Math.round(glowAt(x, y) * 3) * 0.7 + flash * 2.4
        c.set(x, y, shade(WALL, level))
      }
    }
    for (let y = 2; y <= 10; y++) {
      for (let x = 26; x <= 38; x++) {
        const isFrame = x === 26 || x === 38 || y === 2 || y === 10
        if (isFrame) c.set(x, y, shade(WOOD, 2.4 + (y === 2 ? 1 : 0) + flash * 2))
        else c.set(x, y, shade(BOARD, 1 + flash * 1.4))
      }
    }
    const chalk = shade(BOARD, 3 + flash)
    for (const [x0, y0, n] of [[28, 4, 6], [35, 4, 2], [28, 7, 3], [32, 7, 4]] as const) {
      for (let i = 0; i < n; i++) c.set(x0 + i, y0 + (i % 3 === 1 ? -1 : 0), chalk)
    }
    for (let x = 30; x <= 36; x++) c.set(x, 9, chalk)
    c.set(30, 8, chalk)
    c.set(36, 8, chalk)
    c.set(37, 3, shade(BOARD, 4 + flash))
    for (let y = 27; y < H; y++) {
      const depth = y - 27
      for (let x = 0; x < W; x++) {
        const tile = Math.floor((x - 32) / (5 + depth * 1.4) + 10) + depth
        const pool = ((x - 46) / 12) ** 2 + ((y - 28.6) / 2.6) ** 2 < 1
        const level = (tile % 2 ? 1.2 : 2.2) + (pool ? 1.6 : 0) + flash * 1.6 + (y === 27 ? -0.6 : 0)
        c.set(x, y, shade(FLOOR, level))
      }
    }
    c.set(46, 0, shade(CHROME, 2))
    c.set(46, 1, shade(CHROME, 2))
    c.poly([[42.5, 4.5], [44.5, 1.5], [47.5, 1.5], [49.5, 4.5]], (x, y) => shade(CHROME, (y === 2 ? 4 : 2.6) + (x < 45 ? 0.8 : 0)))
    for (let x = 44; x <= 48; x++) c.set(x, 5, x === 44 || x === 48 ? 0xc9b48a : 0xfff1c8)

    for (let y = PLINTH_Y; y <= 27; y++) {
      for (let x = 38; x <= 54; x++) {
        const isTop = y === PLINTH_Y
        const edge = x === 38 || x === 54
        if ((isTop || y === 27) && edge) continue
        const side = (x - 46) / 8
        const level = isTop ? 4.6 : 2.4 - side * 1.2 + (x === 39 ? 0.8 : 0) - (y === PLINTH_Y + 1 ? 0.6 : 0)
        c.set(x, y, shade(CHROME, level + flash * 2))
      }
    }
    const pop: [number, number] = u === 20 ? [1.3, 0.62] : u === 21 ? [0.84, 1.22] : u === 22 ? [1.06, 0.94] : [1, 1]
    const hop = kind === 0 ? (DUCK_HOP[u]?.[0] ?? 0) : 0
    const prims = figure(kind, u)
    const isHidden = u >= 19 && u <= 20 && u === 19
    if (!isHidden) {
      for (let x = FIGURE_X - 1; x <= FIGURE_X + 1; x++) c.set(x, PLINTH_Y, shade(CHROME, 3.2 + flash * 2))
      for (let y = 6; y <= 23; y++) {
        for (let x = 34; x <= 58; x++) {
          const lx = (x - FIGURE_X) / pop[0]
          const ly = (y - FIGURE_Y - hop) / pop[1]
          const col = figureAt(prims, lx, ly, pop)
          if (col === undefined) continue
          if (isZap) {
            const isRim = figureAt(prims, lx - 1, ly) === undefined || figureAt(prims, lx + 1, ly) === undefined || figureAt(prims, lx, ly - 1) === undefined
            c.set(x, y, BEAM[isRim ? 3 : 4] ?? 0)
            continue
          }
          c.set(x, y, col)
        }
      }
    }
    for (const m of particles(f, LOOP, 7, 36, 5)) {
      const y = Math.round(6 + m.r[1] * 4 + m.t * 0.42)
      const x = Math.round(46 + (m.r[2] - 0.5) * (2 + (y - 5) * 0.8) + Math.sin(m.t * 0.2 + m.r[3] * 6))
      if (inCone(x, y) && y >= 7 && y < 17 && m.age > 0.1 && m.age < 0.9 && c.get(x, y) === shade(WALL, 3.4)) c.set(x, y, shade(WALL, 5))
    }
    if (kind === 1 && u >= 5 && u <= 9) {
      const [from, reach, dim] = FLAME[u - 5] ?? [0, 0, 0]
      for (let i = from; i < reach; i++) {
        const x = FIGURE_X - 7 - i
        const y = FIGURE_Y - 8 + (i > 2 ? -1 : 0)
        c.set(x, y, shade(FIRE, 8 - i * 1.2 - dim))
        if (i > 0 && i < reach - 1) c.set(x, y + 1, shade(FIRE, 5 - i * 0.8 - dim))
      }
    }
    if (kind === 1 && u >= 9 && u <= 12) {
      const puff = SMOKE[u - 9] ?? []
      for (const [dx, dy, level] of puff) c.set(FIGURE_X + dx, FIGURE_Y + dy, shade(CLOUD, level))
    }
    if (kind === 2) {
      for (let k = 0; k < 2; k++) {
        const t = ((u + k * 4) % 8) / 8
        const born = u - t * 8
        if (born < 0 || born > 12) continue
        const x = Math.round(FIGURE_X - 9 - t * 2 + Math.sin(t * 6 + k * 2) * 1.2)
        const y = Math.round(FIGURE_Y - 10 - t * 7)
        if (t > 0.85) continue
        c.set(x, y, shade(CLOUD, 3 - t * 2))
        c.set(x, y - 1, shade(CLOUD, 2.4 - t * 2))
        if (t > 0.25) c.set(x + (k ? 1 : -1), y, shade(CLOUD, 2 - t * 2))
      }
    }
    const gx = recoil
    for (let x = 3; x <= 16; x++) {
      c.set(x, 26, shade(PAINT, (x === 3 ? 3.4 : 2.4) + (x > 14 ? -0.8 : 0) + flash))
      c.set(x, 27, shade(PAINT, 1 + flash))
    }
    for (let y = 18; y <= 25; y++) {
      c.set(9, y, shade(CHROME, 5 + flash))
      c.set(10, y, shade(CHROME, 2.6 + flash))
    }
    for (let x = 6 + gx; x <= 13 + gx; x++) c.set(x, 17, shade(CHROME, 2 + flash))
    c.poly([[3 + gx, 10.5], [-0.5 + gx, 6], [1.5 + gx, 5.5], [6 + gx, 10]], (x, y) => shade(PAINT, 3.2 - (y - 6) * 0.2 + flash))
    c.poly([[3 + gx, 15.5], [-0.5 + gx, 20], [1.5 + gx, 20.5], [6 + gx, 16]], (x, y) => shade(PAINT, 1.8 + flash - (y - 16) * 0.1))
    c.line(7 + gx, 9, 7 + gx, 5, shade(CHROME, 3.4 + flash))
    const blink = ch > 0 ? u % 2 === 0 : u % 12 < 2
    c.set(7 + gx, 4, blink ? 0xff6a5a : shade(PAINT, 2.4))
    for (let y = 9; y <= 17; y++) {
      for (let x = 2 + gx; x <= 16 + gx; x++) {
        const nx = (x - 9 - gx) / 7.4
        const ny = (y - 13) / 4.4
        const d2 = nx * nx + ny * ny
        if (d2 > 1) continue
        const nz = Math.sqrt(1 - d2)
        const lit = Math.max(0, nx * 0.35 + ny * -0.7 + nz * 0.6)
        const isBand = x - gx === 6 || x - gx === 12
        const glow = Math.round(glowAt(x, y) * 3) * 0.6
        c.set(x, y, isBand ? shade(CHROME, 1.6 + lit * 5 + glow + flash) : shade(PAINT, 0.8 + lit * 5.2 + glow + flash))
      }
    }
    for (let x = 17 + gx; x <= 20 + gx; x++) {
      c.set(x, 12, shade(CHROME, 5.4 + flash))
      c.set(x, 13, shade(CHROME, 3.6 + flash))
      c.set(x, 14, shade(CHROME, 1.8 + flash))
    }
    for (const [k, cx] of [[0, 17], [1, 19]] as const) {
      const isLit = ch > 0.3 + k * 0.3
      for (let y = 11; y <= 15; y++) {
        const end = y === 11 || y === 15 ? -1 : 0
        c.set(cx + gx, y, isLit ? shade(BEAM, 3 + end + (u % 2)) : shade(COPPER, 4 + end + (y === 12 ? 1.5 : 0) + flash))
      }
    }
    for (let y = 9; y <= 17; y++) {
      for (let x = 21; x <= 24; x++) {
        const reach = x - 20
        if (Math.abs(y - 13) > reach + 0.5 || (x < 24 && Math.abs(y - 13) < reach - 0.5)) continue
        c.set(x + gx, y, shade(CHROME, (y < 13 ? 5 : 2.4) + (x === 24 ? 1 : 0) + flash))
      }
    }
    const bulb = 1 + ch * 3
    for (const [x, y, d] of [[22, 13, 0], [23, 12, 1], [23, 13, 0], [23, 14, 1], [22, 12, 1], [22, 14, 1]] as const) c.set(x + gx, y, shade(BEAM, bulb - d))
    if (isZap || u === 16) {
      const pts: [number, number][] = []
      const n = 8
      const reach = u === 16 ? 3 : n
      for (let i = 0; i <= reach; i++) {
        const t = i / n
        const jig = i === 0 || i === n ? 0 : (hash(i, f, 3) - 0.5) * 5
        pts.push([25 + t * (FIGURE_X - 4 - 25), 13 + t * (FIGURE_Y - 6 - 13) + jig])
      }
      for (let i = 0; i + 1 < pts.length; i++) {
        const [ax, ay] = pts[i] ?? [0, 0]
        const [bx, by] = pts[i + 1] ?? [0, 0]
        c.line(ax, ay - 1, bx, by - 1, (x, y) => (c.get(x, y) === BEAM[4] ? undefined : BEAM[2]))
        c.line(ax, ay + 1, bx, by + 1, (x, y) => (c.get(x, y) === BEAM[4] ? undefined : BEAM[1]))
        c.line(ax, ay, bx, by, BEAM[4] ?? 0)
      }
    }
    if (u >= 19 && u <= 23) {
      const t = (u - 19) / 4
      for (const [i, [px, py, r]] of CLOUD_PUFFS.entries()) {
        const cx = FIGURE_X + px * (1 + t * 0.9)
        const cy = FIGURE_Y + py * (1 + t * 0.5) - t * 4
        const rr = r * (1.1 - t * 0.85) - (i % 3) * t * 0.6
        if (rr < 0.25) continue
        if (rr < 0.7) {
          c.set(cx, cy, shade(CLOUD, 2 - t * 1.2))
          continue
        }
        for (let y = Math.floor(cy - rr); y <= Math.ceil(cy + rr); y++) {
          for (let x = Math.floor(cx - rr); x <= Math.ceil(cx + rr); x++) {
            const nx = (x - cx) / rr
            const ny = (y - cy) / rr
            const d2 = nx * nx + ny * ny
            if (d2 > 1) continue
            const lit = Math.max(0, -ny * 0.8 - nx * 0.2 + Math.sqrt(1 - d2) * 0.5)
            c.set(x, y, shade(CLOUD, 0.6 + lit * 2.8 + (u === 19 ? 0.6 : 0) - t * 1.2))
          }
        }
      }
      for (const [sx, sy, s] of [[-8, -12, 19], [7, -13, 20], [-7, -3, 21], [8, -2, 20]] as const) {
        const size = u - s === 0 ? 2 : u - s === 1 ? 1 : 0
        if (!size) continue
        const x = FIGURE_X + sx
        const y = FIGURE_Y + sy
        c.set(x, y, BEAM[4] ?? 0)
        if (size > 1) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.set(x + dx, y + dy, BEAM[3] ?? 0)
      }
    }
  })
}
const ROOM = [...WALL, ...FLOOR, ...BOARD, ...WOOD, ...CHROME, ...PAINT, ...COPPER]
const SNAPS: Snap[] = [0, SEG, SEG * 2].flatMap((s): Snap[] => [
  {
    frames: [s + 16, s + 19],
    box: [25, 9, 55, 23],
    why: 'The ray gun fires: a bolt of lightning leaps from the dish, strikes the figure and turns it white, crackles into a new shape on the flash, and is gone as the figure vanishes in a puff of smoke that bursts out at full size, the cartoon cover for the change.',
  },
  {
    frames: [s + 20, s + 22],
    box: [34, 6, 57, 23],
    why: 'The new figure pops out of the thinning puff squashed flat, springs up tall, overshoots and settles, a squash and a stretch a frame apart.',
  },
  {
    frames: [s + 17, s + 21],
    box: [0, 0, W - 1, H - 1],
    colors: ROOM,
    why: 'The zap lights the whole room: walls, floor, chalkboard, plinth and gun jump brighter for the strike and dim back over three frames.',
  },
])
export const scene: Scene = { verb: 'Transmogrifying', render, hero: 17, snaps: SNAPS }