import { Canvas, TAU, clamp, hash, hex, mix, mod, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 48
const BEAT = 6

const TILES = [
  hex('2a0830 5e1260 b0248e f060c8 ffb0ea'),
  hex('2e1006 6a280a d0561a f8963e ffd29a'),
  hex('2e2406 6a520c d4aa1c f6dc58 fff6b8'),
  hex('062230 0c4a68 1898c4 52d6f0 b8f6ff'),
]
const WALL = hex('050309 0a0612 120a1e 1c102c 28163c')
const BALL = hex('1a1824 34303e 5a5464 8c8496 c6c0cc f4f0f6')
const BODY = 0x09060f
const PINK = hex('5a1a52 b02a90 f070d0')
const CYAN = hex('124a5e 22a0c4 7ae4f8')
const WARM = hex('6a3010 d07a2a ffc070')
const DOTS = hex('ffd8f0 fff6e0 d8f6ff')
const HALO = hex('1c102c 3a1448 6a1c62 a8306e e05a6c f8946a ffc88a fff0c0')

const pulse = (f: number) => Math.exp(-mod(f, BEAT) * 0.5)

const HORIZON = 8
const HALO_X = 42
const HALO_Y = 9.5
const FLOOR_Y = 18
const depth = (y: number) => 30 / (y + 0.5 - HORIZON)
const NEAR = depth(H - 0.5)
function tileAt(x: number, y: number): [number, number] {
  const z = depth(y)
  return [Math.floor(((x + 0.5 - 32) * z) / 18 / 0.7), Math.floor((z - NEAR) / 0.5)]
}

const FEET_Y = 29
const SOLES: [number, number][] = [[32, 36], [41, 45]]
const [DI, DJ] = tileAt(39, FEET_Y)

function isLit(i: number, j: number, f: number): boolean {
  const b = Math.floor(f / BEAT)
  const t = mod(f, BEAT)
  if (b === 7) return true
  switch (b % 4) {
    case 0:
      return mod(i + j, 2) === 0
    case 1: {
      const d = Math.abs(i - DI) + Math.abs(j - DJ)
      return d === t || d === t + 1
    }
    case 2:
      return mod(i + j, 2) === 1
    default:
      return mod(i - j - Math.floor(t / 2), 3) === 0
  }
}

type Arm = { at: [number, number]; art: readonly string[] }
const SX = 30
const SY = 1

const UP = [
  '...........................',
  '...........................',
  '...........................',
  '..........hhhhh............',
  '.........hhhhhhh...........',
  '.........hhhhhhh...........',
  '.........#######...........',
  '..........#####............',
  '...........###.............',
  '...........###.............',
  '........########...........',
  '.......#########...........',
  '......aa.#######...........',
  '.....aa...#####............',
  '.....aa...#####............',
  '.......aa.#####............',
  '........#######............',
  '........#######............',
  '.......###.####............',
  '.......###.###.............',
  '......###..###.............',
  '......###..###.............',
  '......##....##.............',
  '.....##.....##.............',
  '....###.....###............',
  '....###.....###............',
  '...####....####............',
  '...####....####............',
  '..#####....#####...........',
]
const UP_SOFT = [
  '...........................',
  '...........................',
  '...........................',
  '...........................',
  '..........hhhhh............',
  '.........hhhhhhh...........',
  '.........hhhhhhh...........',
  '.........#######...........',
  '..........#####............',
  '...........###.............',
  '...........###.............',
  '........########...........',
  '.......#########...........',
  '......aa.#######...........',
  '.....aa...#####............',
  '.....aa...#####............',
  '.......aa.#####............',
  '........#######............',
  '........#######............',
  '.......###.####............',
  '.......###.###.............',
  '......###..###.............',
  '......##....##.............',
  '.....##.....##.............',
  '....###.....###............',
  '....###.....###............',
  '...####....####............',
  '...####....####............',
  '..#####....#####...........',
]
const SHIFT = [
  '...........................',
  '...........................',
  '...........................',
  '...........................',
  '...........hhhhh...........',
  '..........hhhhhhh..........',
  '..........hhhhhhh..........',
  '..........#######..........',
  '...........#####...........',
  '............###............',
  '............###............',
  '.........########..........',
  '........#########..........',
  '.......aa.#######..........',
  '......aa...#####...........',
  '......aa...#####...........',
  '........aa.#####...........',
  '.........#######...........',
  '.........#######...........',
  '.......###.####............',
  '.......###.###.............',
  '......###..###.............',
  '......##....##.............',
  '.....##.....##.............',
  '....###.....###............',
  '....###.....###............',
  '...####....####............',
  '...####....####............',
  '..#####....#####...........',
]
const DOWN = [
  '...........................',
  '...........................',
  '...........................',
  '...........................',
  '...........................',
  '.............hhhhh.........',
  '............hhhhhhh........',
  '............hhhhhhh........',
  '............#######........',
  '.............#####.........',
  '..............###..........',
  '..............###..........',
  '.........#########.........',
  '.......aa.#######..........',
  '......aa..######...........',
  '.....aa...######...........',
  '......aa..#####............',
  '.......aa.#####............',
  '........######.............',
  '........#######............',
  '........###.###............',
  '.......###...###...........',
  '......###....###...........',
  '......##......###..........',
  '.....###.....###...........',
  '....###......###...........',
  '...####.....####...........',
  '...####.....####...........',
  '..#####....#####...........',
]
const DEEP = [
  '...........................',
  '...........................',
  '...........................',
  '...........................',
  '...........................',
  '...........................',
  '.............hhhhh.........',
  '............hhhhhhh........',
  '............hhhhhhh........',
  '............#######........',
  '.............#####.........',
  '..............###..........',
  '..............###..........',
  '.........#########.........',
  '.......aa.#######..........',
  '......aa..######...........',
  '.....aa...######...........',
  '......aa..#####............',
  '.......aa.#####............',
  '........######.............',
  '........#######............',
  '........###.###............',
  '.......###...###...........',
  '......##......###..........',
  '.....###.....###...........',
  '....###......###...........',
  '...####.....####...........',
  '...####.....####...........',
  '..#####....#####...........',
]
const BIG = [
  '...........................',
  '...........................',
  '...........................',
  '..........hhhhh............',
  '.........hhhhhhh...........',
  '.........hhhhhhh...........',
  '.........#######...........',
  '..........#####............',
  '...........###.............',
  '...........###.............',
  '........########...........',
  '.......#########...........',
  '......aa.#######...........',
  '.....aa...#####............',
  '....aa....#####............',
  '...aa.....#####............',
  '..aa.....######............',
  '.a.......######............',
  '.......###.####............',
  '.......###.###.............',
  '......###..###.............',
  '......###..###.............',
  '......##....##.............',
  '.....##.....##.............',
  '....###.....###............',
  '....###.....###............',
  '...####....####............',
  '...####....####............',
  '..#####....#####...........',
]
const BIG_SOFT = [
  '...........................',
  '...........................',
  '...........................',
  '...........................',
  '..........hhhhh............',
  '.........hhhhhhh...........',
  '.........hhhhhhh...........',
  '.........#######...........',
  '..........#####............',
  '...........###.............',
  '...........###.............',
  '........########...........',
  '.......#########...........',
  '......aa.#######...........',
  '.....aa...#####............',
  '....aa....#####............',
  '...aa.....#####............',
  '..aa.....######............',
  '.a.......######............',
  '.......###.####............',
  '.......###.###.............',
  '......###..###.............',
  '......##....##.............',
  '.....##.....##.............',
  '....###.....###............',
  '....###.....###............',
  '...####....####............',
  '...####....####............',
  '..#####....#####...........',
]

const A60: Arm = { at: [0, 9], art: [
  '.....a',
  '....aa',
  '...aa.',
  '...aa.',
  '..aa..',
  '..aa..',
  '.aa...',
  '.aa...',
  'aa....',
  'aa....',
]}
const A40: Arm = { at: [0, 7], art: [
  '.......a',
  '......aa',
  '.....aa.',
  '....aa..',
  '...aa...',
  '..aa....',
  '.aa.....',
  'aa......',
]}
const A10: Arm = { at: [0, 1], art: [
  '.....aaaaaa',
  'aaaaaaaaaa.',
  'aaaaa......',
]}
const AM35: Arm = { at: [0, 0], art: [
  'aaa........',
  '.aaa.......',
  '..aaaa.....',
  '....aaa....',
  '.....aaaa..',
  '.......aaa.',
  '..........a',
]}
const AM55: Arm = { at: [0, 0], art: [
  'aa....',
  '.aa...',
  '.aa...',
  '..aa..',
  '...aa.',
  '...aa.',
  '....aa',
  '.....a',
]}
type Pose = { body: readonly string[]; arm: Arm; shoulder: [number, number] }
const STAND: [number, number] = [46, 11]
const SINK: [number, number] = [46, 12]
const SHIFTED: [number, number] = [47, 12]
const LUNGE: [number, number] = [47, 14]
const LOW: [number, number] = [47, 15]
function poseAt(f: number): Pose {
  const b = Math.floor(f / BEAT)
  const t = mod(f, BEAT)
  const pose = (body: readonly string[], arm: Arm, shoulder: [number, number]): Pose => ({ body, arm, shoulder })
  if (t < 3) {
    if (b === 7) return pose(BIG, A60, STAND)
    if (b === 6) return pose(DEEP, AM55, LOW)
    return b % 2 === 0 ? pose(UP, A60, STAND) : pose(DOWN, AM55, LUNGE)
  }
  if (b === 7) return t < 5 ? pose(BIG_SOFT, A60, SINK) : pose(UP_SOFT, A60, SINK)
  if (b === 5) return t < 5 ? pose(DOWN, AM55, LUNGE) : pose(DEEP, AM55, LOW)
  if (b % 2 === 1 || b === 6) {
    const rise = b === 6 ? BIG_SOFT : UP_SOFT
    if (t === 3) return b === 6 ? pose(DEEP, AM35, LOW) : pose(DOWN, AM35, LUNGE)
    return t === 4 && b !== 6 ? pose(SHIFT, A10, SHIFTED) : pose(rise, t === 4 ? A10 : A40, SINK)
  }
  return t === 3 ? pose(UP_SOFT, A40, SINK) : t === 4 ? pose(SHIFT, A10, SHIFTED) : pose(DOWN, AM35, LUNGE)
}
const hairTop = (f: number) => poseAt(mod(f, LOOP)).body.findIndex(row => row.includes('h'))
function hairAt(f: number): number {
  const moved = (g: number) => Math.sign(hairTop(g) - hairTop(g - 1))
  if (moved(f) !== 0 && moved(f + 1) === 0) return moved(f)
  if (moved(f) === 0 && moved(f - 1) !== 0) return -moved(f - 1)
  return 0
}
function silhouette(f: number): Map<number, string> {
  const px = new Map<number, string>()
  const stamp = (art: readonly string[], x0: number, y0: number) =>
    art.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (row[i] !== '.' && !px.has((y0 + j) * W + x0 + i)) px.set((y0 + j) * W + x0 + i, row[i] ?? '#')
    })
  const { body, arm, shoulder } = poseAt(f)
  stamp(body, SX, SY)
  stamp(arm.art, shoulder[0] - arm.at[0], shoulder[1] - arm.at[1])

  const j = body.findIndex(row => row.includes('h'))
  const span = (row: string): [number, number] => [SX + row.indexOf('h'), SX + row.lastIndexOf('h')]
  const [a0, a1] = span(body[j] ?? '')
  const [b0, b1] = span(body[j + 1] ?? '')
  const y = SY + j
  const lag = hairAt(f)
  if (lag > 0) {
    for (let x = a0; x <= a1; x++) px.set((y - 1) * W + x, 'h')
    for (let x = b0; x <= b1; x++) px.set(y * W + x, 'h')
  }
  if (lag < 0) {
    for (let x = a0; x <= a1; x++) px.delete(y * W + x)
    for (let x = b0; x <= b1; x++) if (x < a0 || x > a1) px.delete((y + 1) * W + x)
  }
  return px
}
function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const e = pulse(f)
    const climax = Math.floor(f / BEAT) === 7 ? 1 : 0
    const rot = (f / LOOP) * (TAU / 4)

    const halo = 10.5 + e * 1.6 + climax * 1.5
    for (let y = 0; y < FLOOR_Y; y++) {
      for (let x = 0; x < W; x++) {
        const r = Math.hypot(x - HALO_X, (y - HALO_Y) * 1.1)
        if (r < halo) {
          c.set(x, y, shade(HALO, 2 + (1 - r / halo) * 5.4, x, y))
          continue
        }
        const glow = clamp((y - 9) / 9) * (1.4 + e * 0.6 + climax)
        c.set(x, y, shade(WALL, 0.6 + glow + (r < halo + 2 ? 0.8 : 0), x, y))
      }
    }
    const sprinkle = (only?: Map<number, string>) => {
      for (let k = 0; k < 9; k++) {
        for (let q = 0; q < 4; q++) {
          const th = (k / 9 + hash(k, 1) * 0.06) * (TAU / 4) + q * (TAU / 4) + rot
          const facing = Math.cos(th)
          if (facing < 0.15) continue
          const x = Math.round(32 + 44 * Math.sin(th))
          const y = Math.round(1 + hash(k, q, 7) * 16)
          if (Math.hypot(x - 20, y - 5) < 6) continue
          const col = DOTS[(k + q) % 3] ?? 0
          for (const dx of facing > 0.6 ? [0, 1] : [0]) {
            const key = y * W + x + dx
            if (only && !only.has(key)) continue
            if (!only && y >= FLOOR_Y) continue
            c.set(x + dx, y, facing > 0.5 ? col : mix(col, c.get(x + dx, y), 0.5))
          }
        }
      }
    }
    sprinkle()
    const bx = 20
    const by = 5
    const br = 4.2
    for (let y = 0; y < by - br; y++) c.set(bx, y, shade(BALL, 1.4, 0, 0))
    for (let y = Math.floor(by - br); y <= Math.ceil(by + br); y++) {
      for (let x = Math.floor(bx - br); x <= Math.ceil(bx + br); x++) {
        const nx = (x - bx) / br
        const ny = (y - by) / br
        const d = nx * nx + ny * ny
        if (d > 1) continue
        const nz = Math.sqrt(1 - d)
        const lon = Math.atan2(nx, nz) + rot
        const fi = Math.floor(lon / (TAU / 16))
        const fj = Math.floor((Math.asin(ny) + Math.PI / 2) / (Math.PI / 7))
        const facet = hash(mod(fi, 4), fj, 3)
        const light = -nx * 0.6 - ny * 0.8 + nz * 0.4
        const glint = facet > 0.82 && light > 0 ? 2 : 0
        c.set(x, y, shade(BALL, 1.6 + light * 1.6 + facet * 1.2 + glint + e * 0.5 - (d > 0.75 ? 0.8 : 0), x, y))
      }
    }
    for (let y = FLOOR_Y; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const [i, j] = tileAt(x, y)
        const [li, lj] = tileAt(x - 1, y)
        const [ui, uj] = tileAt(x, y - 1)
        const isGrout = li !== i || lj !== j || (y > FLOOR_Y && (ui !== i || uj !== j))
        const r = Math.hypot(x - HALO_X, (2 * FLOOR_Y - 1 - y - HALO_Y) * 1.1)
        const sheen = r < halo ? (1 - r / halo) * (1 - (y - FLOOR_Y) / 22) : 0
        if (isGrout) {
          c.set(x, y, shade(WALL, 2 + sheen * 3, x, y))
          continue
        }
        const ramp = TILES[mod(i * 3 + j * 2, 4)] ?? TILES[0]!
        const z = depth(y)
        const X = ((x + 0.5 - 32) * z) / 18 / 0.7
        const Z = (z - NEAR) / 0.5
        const heart = Math.abs(X - i - 0.5) < 0.24 && Math.abs(Z - j - 0.5) < 0.28 ? 0.9 : 0
        let level = 0.4 + heart * 0.5 - j * 0.05
        for (let k = 0; k < 4; k++) {
          const g = mod(f - k, LOOP)
          if (!isLit(i, j, g)) continue
          const on = 2 + pulse(g) * 1.2 + heart + (Math.floor(g / BEAT) === 7 ? 0.4 : 0)
          level = Math.max(level, on - k)
        }
        level += sheen * 5.5
        if (y > FEET_Y && SOLES.some(([a, b]) => x >= a - (y - FEET_Y) + 1 && x <= b + (y - FEET_Y) - 1)) level -= 3 - (y - FEET_Y)
        c.set(x, y, shade(ramp, level, x, y))
      }
    }
    const body = silhouette(f)
    for (const key of body.keys()) {
      const x = key % W
      const y = Math.floor(key / W)
      const has = (k: number) => body.has(k)
      const outer = (d: number) => {
        for (let k = key + d; Math.floor(k / W) === y && k >= 0; k += d) if (has(k)) return false
        return true
      }
      const thick = y >= FLOOR_Y ? 2 : 3
      let col = BODY
      const isDim = y >= FLOOR_Y || Math.hypot(x - HALO_X, (y - HALO_Y) * 1.1) > halo * 0.85
      const out = x < HALO_X ? -1 : 1
      const isRim = (!has(key - W) && has(key + W)) || (!has(key + out) && has(key - out))
      if (body.get(key) === 'a' && isDim && isRim) col = shade(x < HALO_X ? PINK : CYAN, 1.5 + e * 0.6, x, y)
      else if (!has(key - 1) && has(key + 1) && has(key + thick) && (y < FLOOR_Y || outer(-1))) col = shade(PINK, 0.4 + e * 0.8, x, y)
      else if (!has(key + 1) && has(key - 1) && has(key - thick) && (y < FLOOR_Y || outer(1))) col = shade(CYAN, 0.4 + e * 0.8, x, y)
      c.set(x, y, col)
    }
    sprinkle(body)
    out.push(c.px)
  }
  return out
}
const TONES = TILES.flat()
const FLOOR: [number, number, number, number] = [0, FLOOR_Y, W - 1, H - 1]
const floorOn = (frames: number | [number, number]) => ({ frames, box: FLOOR, colors: TONES, why: 'floor tiles switch on with the beat' })
const SWING: [number, number, number, number] = [44, 2, 57, 23]
const swing = (frames: number) => ({ frames, box: SWING, colors: [BODY, ...CYAN, ...PINK, ...HALO, ...WALL, ...DOTS, ...TONES], why: 'the arm swings through between the sky and the floor' })
export const scene: Scene = {
  verb: 'Boogieing',
  render,
  hero: 42,
  snaps: [
    floorOn(12), floorOn([18, 24]), floorOn(36), floorOn(42),
    ...[0, 2, 4, 1, 3, 6].flatMap(b => [3, 4, 5].map(t => swing(b * BEAT + t))),
    { frames: 42, box: [26, 0, 55, 18], colors: [...HALO.slice(1, 4), ...WALL], why: 'the glow swells on the last, biggest beat of the bar' },
  ],
}