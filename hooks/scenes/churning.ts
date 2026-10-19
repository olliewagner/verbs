import { Canvas, TAU, frames, hash, hex, lerp, shade, smoothstep, type Scene } from '../engine'

const LOOP = 60
const EMPTY = -1

const WALL = hex('3a4458 52607a 6e7e98 90a0b6 b6c4d0 d8e0e2 f2f0e4')
const CEILING = hex('2c4a58 3e6674 568a94')
const FLOOR = hex('2c2e36 40444e 585e68 747a82 949a9e b6b8b6 d6d4cc')
const GLASS = hex('1c2a3c 2c4a66 4a7498 86b4d4')
const CURTAIN = hex('6a1c20 9a2c2a c8463a e87a5e')
const GREEN = hex('16301e 214a2a 2e6636 46843e 6aa448')
const SCREEN = hex('101418 181e24 222a30 2e383e')
const OAK = hex('2a170e 422412 5e3518 7c4a20 9a622c b87e3c d49c52')
const IRON = hex('121218 22222a 363640 54545e')
const DRESS = hex('1a2850 283c72 385494 5272b4 7c9ad0')
const APRON = hex('8c90a0 b4b8c4 d8dae0 f4f4f4')
const SKIN = hex('7a4234 a8644c d08c6a eab48e f8d4b0')
const HAIR = hex('5a3814 8a5c1a b88a2c dcb44c f2d47e')
const CAT = hex('4a200c 7a3812 b05c1c d88430 f2aa52 fccf86')
const CREAM = hex('a8a090 d4ccbc f0eadc fffcf2')
const BUTTER = hex('7a4a0c b07414 dc9e1e f2c234 fcde66 fff4ae fffde8')

const FLOOR_Y = 26
const SHADE_Y = 13
const CX = 38.5
const LID_Y = 16

const HEAVE = [12.6, 13, 11.6, 9.7, 7.8, 6.3, 5.5, 4.9, 4.1, 3.4, 3.05, 3, 3, 3, 3.3, 3.9, 4.6, 5.3, 7.2, 9.3]
function dasher(f: number): number {
  if (f < 40) {
    const u = (f + 1) % 10
    if (u <= 5) return lerp(12, 6, smoothstep(0, 5, u))
    if (u <= 8) return lerp(6, 12, ((u - 5) / 3) ** 1.3)
    return 12
  }
  return HEAVE[f - 40] ?? 12
}
const lidLift = (top: number) => Math.round(Math.max(0, 6 - top) * 2)

const GIRL = [
  '...hhhh...',
  '..hhhhhhh.',
  '..hhhhsss.',
  '..hhhsses.',
  '..hhhscsss',
  '...hhsss..',
  '.....ss...',
  '...ddddd..',
  '...ddddd..',
  '...ddaaa..',
  '...ddaaa..',
  '...ddaaa..',
  '...ddaaaa.',
  '..dddaaaa.',
  '..dddaaaaa',
  '.ddddaaaaa',
  '.ddddaaaaa',
  '.DDDDAAAAA',
  '...ll.ll..',
  '...ll.ll..',
  '..bbb.bbb.',
]
const CAT_ART = [
  'k.....k',
  'kk...kk',
  'ooooooo',
  'oEoooEo',
  '.oonoo.',
  '..ooo..',
  '.ooooo.',
  '.owwwo.',
  'oowwwoo',
  'ooowooo',
]
function edgeLight(art: readonly string[], i: number, j: number): number {
  const row = art[j] ?? ''
  const left = i === 0 || row[i - 1] === '.' || row[i - 1] === undefined
  const right = i === row.length - 1 || row[i + 1] === '.' || row[i + 1] === undefined
  const top = j === 0 || (art[j - 1] ?? '')[i] === '.' || (art[j - 1] ?? '')[i] === undefined
  return (left ? 0.9 : 0) + (top ? 0.5 : 0) - (right ? 0.8 : 0)
}

function stamp(c: Canvas, x0: number, y0: number, art: readonly string[], inks: Record<string, [readonly number[], number]>): void {
  art.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ink = inks[row[i] ?? '.']
      if (!ink) continue
      const [r, level] = ink
      c.set(x0 + i, y0 + j, shade(r, level + edgeLight(art, i, j), x0 + i, y0 + j))
    }
  })
}
function draw(c: Canvas, f: number): void {
  const top = dasher(f)
  const lift = lidLift(top)
  const lidY = LID_Y - lift
  const s = f % 10
  const isStroking = f < 40
  const thump = isStroking && (s === 7 || s === 8) ? 1 : 0
  const tiptoe = top < 6 ? 1 : 0
  const layer = new Canvas()
  layer.fill(EMPTY)
  const isAgog = f >= 47 && f < 57
  const catX = 52
  const catY = 19
  const nod = top < 9 ? -1 : 0
  const body = CAT_ART.slice(5)
  const head = CAT_ART.slice(0, 5)
  const catInks: Record<string, [readonly number[], number]> = {
    o: [CAT, 3], k: [CAT, 1.6], w: [CREAM, 2.4], n: [CURTAIN, 3], E: [isAgog ? GREEN : CAT, isAgog ? 4.4 : 0.6],
  }
  const raise = -nod
  stamp(layer, catX, catY + 5, body, catInks)
  for (let k = 1; k <= raise; k++) stamp(layer, catX, catY + 5 - k, ['..ooo..'], catInks)
  stamp(layer, catX, catY - raise, head, catInks)
  if (isAgog) {
    for (const ex of [1, 5]) layer.set(catX + ex, catY + 2 - raise, shade(GREEN, 3.4, 0, 0))
  }
  for (const [x, y] of [[catX + 2, catY + 7], [catX + 4, catY + 8]] as const) layer.set(x, y, shade(CAT, 2, 0, 0))
  const flick = isAgog ? 2 : Math.round(Math.sin(TAU * (f / 30)) * 0.8 + 0.3)
  for (const [x, y] of [[7, 9], [8, 9], [8, 8], [9, 8 - flick], [9, 7 - flick]] as const) {
    layer.set(catX + x, catY + y, shade(CAT, x === 9 ? 2.4 : 3, 0, 0))
  }
  for (let y = 17; y <= 28; y++) {
    const half = lerp(5, 6, (y - 17) / 11)
    for (let x = Math.ceil(CX - half); x <= Math.floor(CX + half); x++) {
      const u = (x - CX) / half
      const stave = Math.abs(((x + 0.5) % 3) - 1.5) < 0.5 ? -0.5 : 0
      const hoop = y === 19 || y === 26
      const light = 3.2 - u * 1.8 - (u > 0.7 ? 0.8 : 0) + (u < -0.7 ? 0.6 : 0)
      layer.set(x, y, hoop ? shade(IRON, 1.6 - u * 1.2 + (y === 19 ? 0.5 : 0), x, y) : shade(OAK, light + stave + (y === 17 ? 1.2 : 0), x, y))
    }
  }
  for (let x = 33; x <= 44; x++) layer.set(x, 28, shade(OAK, 1.6 - (x - 33) * 0.08, x, 28))
  if (lift > 0) for (let x = 34; x <= 43; x++) layer.set(x, 17, shade(OAK, x === 34 || x === 43 ? 2.4 : 0.5, x, 17))
  for (let y = Math.round(top); y <= 17; y++) {
    layer.set(38, y, shade(OAK, 6, 0, 0))
    layer.set(39, y, shade(OAK, 4.4, 0, 0))
  }
  if (lift > 0) {
    const by = lidY + 1
    const lump = ['.bbbb.', 'bbbbbb', 'bbbbbbb', '.bbbbb.']
    const shine = f >= 50 && f < 55
    lump.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        if (row[i] !== 'b' || by + j > 16) continue
        const u = (i - 3) / 3.5
        const level = 4.2 - u * 1.4 - j * 0.55 + (j === 0 ? 0.6 : 0) + (shine ? 0.4 : 0)
        layer.set(35 + i, by + j, shade(BUTTER, level, 35 + i, by + j))
      }
    })
    if (by <= 16) layer.set(36, by, BUTTER[6] ?? 0)
    if (by + 1 <= 16) layer.set(37, by + 1, BUTTER[5] ?? 0)
  }
  for (let x = 33; x <= 44; x++) {
    layer.set(x, lidY, shade(OAK, 4.6 - (x - 33) * 0.2, x, lidY))
  }
  for (let x = 34; x <= 43; x++) layer.set(x, lidY - 1, shade(OAK, 5.4 - (x - 34) * 0.2, x, lidY - 1))
  layer.set(38, lidY - 1, shade(OAK, 6, 0, 0))
  const gx = 21
  const gy = 8 + thump - tiptoe
  const shoulder = (dx: number) => [gx + dx, gy + 8] as const
  const arm = (from: readonly [number, number], hand: readonly [number, number], level: number) => {
    const [sx, sy] = from
    const [hx, hy] = hand
    const d = Math.hypot(hx - sx, hy - sy)
    const bend = Math.sqrt(Math.max(0, (13 / 2) ** 2 - (d / 2) ** 2))
    const ex = (sx + hx) / 2 - ((hy - sy) / d) * bend * 0.4
    const ey = (sy + hy) / 2 + ((hx - sx) / d) * bend
    const seg = (ax: number, ay: number, bx: number, by: number, sleeve: boolean) => {
      for (let k = 0; k <= 10; k++) {
        const t = k / 10
        const isSleeve = sleeve && t < 0.45
        const x = Math.round(lerp(ax, bx, t))
        const y = Math.round(lerp(ay, by, t))
        layer.set(x, y + 1, isSleeve ? shade(DRESS, level - 1, 0, 0) : shade(SKIN, level - 1, 0, 0))
        layer.set(x, y, isSleeve ? shade(DRESS, level, 0, 0) : shade(SKIN, level, 0, 0))
      }
    }
    seg(sx, sy, ex, ey, true)
    seg(ex, ey, hx, hy, false)
  }
  const grip = Math.round(top)
  stamp(layer, gx, gy, GIRL, {
    h: [HAIR, 2.6], s: [SKIN, 3], e: [HAIR, 0], c: [CURTAIN, 3.2], d: [DRESS, 2.6], D: [DRESS, 1.2], a: [APRON, 2.2], A: [APRON, 1],
    l: [APRON, 1.4], b: [OAK, 0.6],
  })
  if (tiptoe) {
    for (const x of [gx + 3, gx + 4, gx + 6, gx + 7]) layer.set(x, gy + 21, shade(APRON, 1.2, 0, 0))
  }
  const swing = isStroking ? Math.sin(TAU * ((f - 2.5) / 10)) : Math.sin(TAU * ((f - 44) / 14)) * (f < 56 ? 1.4 : 0.6)
  for (let k = 1; k <= 6; k++) {
    const x = gx + 2 - Math.round((k / 6) * (1 + swing * 1.2))
    const y = gy + 4 + k
    layer.set(x, y, k === 5 ? shade(CURTAIN, 2.6, 0, 0) : shade(HAIR, k === 6 ? 3.4 : 2.4 + (k % 2) * 0.6, 0, 0))
  }
  layer.set(gx + 3, gy + 1, shade(CURTAIN, 2.6, 0, 0))
  arm(shoulder(6), [37, grip + 1], 3.4)
  for (const [x, y, l] of [[37, grip + 1, 3.8], [38, grip + 1, 3.4], [37, grip + 3, 2.4], [38, grip + 3, 3]] as const) layer.set(x, y, shade(SKIN, l, 0, 0))
  for (let k = 0; k < 4; k++) {
    const born = Math.floor(f / 10) * 10 + 7 - (s < 7 ? 10 : 0)
    const age = f - born
    if (born < 0 || born > 37 || age < 1 || age > 6) continue
    const seed = born * 7 + k
    const vx = (hash(seed, 1) - 0.5) * 3.2
    const vy = -1.2 - hash(seed, 2) * 1.4
    const x = 38.5 + (hash(seed, 3) - 0.5) * 2 + vx * age
    const y = lidY - 1 + vy * age + 0.42 * age * age
    if (y > 27) continue
    layer.set(x, y, shade(CREAM, 3 - age * 0.3, 0, 0))
    if (age < 2) layer.set(x - vx * 0.6, y - vy * 0.6 + 0.4, shade(CREAM, 2, 0, 0))
  }
  if (isStroking && s >= 7 && s <= 8) {
    for (const x of s === 7 ? [37, 40] : [36, 37, 40, 41]) layer.set(x, lidY - 2, shade(CREAM, x === 37 || x === 40 ? 3 : 2, 0, 0))
  }
  if (f >= 49 && f < 55) {
    const dy = (f - 49) * 1.4
    if (lidY + 5 + dy < 17) layer.set(39, lidY + 5 + dy, shade(CREAM, 2.6, 0, 0))
  }
  if (f >= 50 && f < 55) {
    const r = f === 51 || f === 53 ? 2 : 1
    const gxs = 37
    const gys = lidY + 1
    layer.set(gxs, gys, BUTTER[6] ?? 0)
    for (let k = 1; k <= r; k++) {
      for (const [ux, uy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) layer.set(gxs + ux * k, gys + uy * k, k === 1 ? BUTTER[6] ?? 0 : BUTTER[5] ?? 0)
    }
  }
  const isShadow = (x: number, y: number) => layer.get(x - 3, y + 1) !== EMPTY && layer.get(x - 3, y + 1) !== 0
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 64; x++) {
      const dark = isShadow(x, y) ? -1.7 : 0
      if (y < 2) {
        c.set(x, y, shade(CEILING, 1 + y + (x % 5 === 0 ? -1 : 0), x, y))
      } else if (y === 2) {
        c.set(x, y, shade(WALL, 0.4, x, y))
      } else if (y < FLOOR_Y - 1) {
        const board = (y - 3) % 3
        const lip = board === 0 ? -0.9 : board === 1 ? 0.6 : 0
        const shadeLine = y < SHADE_Y ? -2.2 : y === SHADE_Y ? -1 : 0
        c.set(x, y, shade(WALL, 4.6 + lip + shadeLine + dark - (x / 64) * 0.3, x, y))
      } else if (y === FLOOR_Y - 1) {
        c.set(x, y, shade(WALL, 1 + dark * 0.3, x, y))
      } else {
        const seam = y === 28 || y === 30 ? -0.9 : 0
        c.set(x, y, shade(FLOOR, 4.6 + seam + (y - FLOOR_Y) * 0.15 + dark, x, y))
      }
    }
  }
  for (let y = 4; y <= 16; y++) {
    for (let x = 3; x <= 16; x++) {
      const isFrame = x === 3 || x === 16 || y === 4 || y === 16 || x === 9 || x === 10 || y === 10
      if (isFrame) {
        c.set(x, y, shade(WALL, (y < SHADE_Y ? 3.2 : 5.6) + (x === 3 || y === 4 ? 0.6 : 0), x, y))
        continue
      }
      const streak = (x + y) % 9 === 4 || (x + y) % 9 === 5 ? 1.4 : 0
      c.set(x, y, shade(GLASS, 1.2 + (16 - y) * 0.05 + streak, x, y))
    }
  }
  for (const [x0, dir] of [[4, 1], [15, -1]] as const) {
    for (let y = 5; y <= 15; y++) {
      const w = y < 9 ? 2 : y < 12 ? 1 : 2
      for (let k = 0; k < w; k++) c.set(x0 + k * dir, y, shade(CURTAIN, (y < SHADE_Y ? 1.6 : 2.6) + (k === 0 ? 0.6 : 0), x0, y))
    }
    c.set(x0 + dir, 10, shade(CURTAIN, 3.4, 0, 0))
  }
  for (let x = 2; x <= 17; x++) {
    c.set(x, 17, shade(OAK, 4, x, 17))
    c.set(x, 18, shade(OAK, 2.4, x, 18))
  }
  for (let x = 3; x <= 16; x++) {
    const leaf = (x * 5) % 3
    c.set(x, 16, shade(GREEN, 2 + leaf * 0.6, x, 16))
    if (x % 4 === 1) {
      c.set(x, 15, shade(CURTAIN, 2.8, 0, 0))
      c.set(x + 1, 15, shade(CURTAIN, 3.6, 0, 0))
      c.set(x, 14, shade(CURTAIN, 3, 0, 0))
    } else if (x % 4 === 3) c.set(x, 15, shade(GREEN, 3, 0, 0))
  }
  for (let y = 3; y < FLOOR_Y - 1; y++) {
    for (let x = 49; x <= 61; x++) {
      const isFrame = x <= 50 || x >= 60 || y <= 4 || y === 14 || y === 15
      const sun = y < SHADE_Y ? -1.2 : 0
      c.set(x, y, isFrame ? shade(GREEN, 2.4 + sun + (x === 49 || y === 3 || y === 14 ? 0.8 : 0) + (isShadow(x, y) ? -1.4 : 0), x, y) : shade(SCREEN, 1.4 + (y % 2) * 0.4 + (isShadow(x, y) ? -1 : 0), x, y))
    }
  }
  c.set(51, 15, BUTTER[3] ?? 0)
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 64; x++) {
      const p = layer.get(x, y)
      if (p !== EMPTY) c.set(x, y, p)
    }
  }
  for (const [x0, x1, y] of [[33, 45, 29], [23, 30, 29], [51, 60, 29]] as const) {
    for (let x = x0; x <= x1; x++) if (layer.get(x, y) === EMPTY) c.set(x, y, shade(FLOOR, 2.4, x, y))
  }
}
export const scene: Scene = { verb: 'Churning', render: () => frames(LOOP, draw), hero: 52 }