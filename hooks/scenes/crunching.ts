import { Canvas, PALETTE, beat, ease, hash, hex, particles, shade, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 48

const WALL = hex('07120e 0b1a14 10231b 152d22 1b382a 234433 2e5240 3c6250')
const PAINT = hex('0a0e1a 141c2e 223046 4a5a72 8a96a8')
const MANTEL = hex('1e1a18 3a322c 5a4c40 7e6c58 a08a70 c2ac8c dccaa8 f0e4c8')
const RED = hex('22080e 440e16 6e141c 9a1e20 c2302a e0503a f4784e')
const BLACK = hex('06060a 0e0e18 181828 26263a 3a3a52 5a5a74')
const GOLD = PALETTE.gold
const WHITE = hex('2e2a34 5a5462 8c8696 bcb8c4 e2e0e6 fcfaf6')
const SKIN = hex('4a2018 84422e bc7050 e0a07a f4c6a0 ffe2c8')
const BASE = hex('081a10 0f2e1a 184426 225c32')
const LEVER = hex('24140c 42281a 66401f 8c5a2c b07a3e')
const NUT = hex('1e1008 361e10 543018 744420 966030 b48048')
const KERNEL = hex('5c3e22 94703e c8a066 ead09a')
const WAX = hex('4a3a32 7e6852 b49c7c dccaa4 f4ead2 fffaf0')
const FIRE = PALETTE.fire
const NIGHT = hex('060a1c 0b1430 132046 1e3060 2e4678')
const SNOW = hex('5a6a90 9aaac8 dce6f4 ffffff')

const LIGHT_X = 8
const LIGHT_Y = 15
const MANTEL_Y = 27

const flicker = (f: number) => 1 + 0.04 * wave(f, LOOP, 6) + 0.025 * wave(f, LOOP, 11, 0.3)

function lightOf(p: number, x: number, y: number): number {
  const d = Math.hypot(x - LIGHT_X, (y - LIGHT_Y) * 1.2)
  return p * Math.max(0, 1 - d / 72) ** 1.3
}

type Ramp = readonly number[]
type Px = { ramp: Ramp; level: number }

const BODY = [
  '..................',
  '....kkkkkkk.......',
  '...kKkkkkkkk......',
  '...kKkkkkkkk......',
  '...kKkkkkgGk......',
  '...kKkkkkGgk......',
  '...kKkkkkkkk......',
  '...GgggggggggVV...',
  '...Hhsssswwwss....',
  '...HhssssWeSssN...',
  '...HhSsssssssNnn..',
  '...HhSssppsssnNn..',
  '...Hhssssmmmmmm...',
  '...HhsssSMtttttm..',
  '...Hrrrrr.........',
  '...rrRRrrrrrr.....',
  '...rRRRrrrrrr.....',
  '...rRRRrrrrrr.....',
  '...rRRRrrrrrr.....',
  '...rRRRrrrrrrb....',
  '...rcccrrrrrr.....',
  '...rdddBBBBBBg....',
  '..rr.uuuuuuu......',
  '.....uUuuUuu......',
  '.....xxx.xxxx.....',
  '...yyyyyyyyyyy....',
  '...zzzzzzzzzzz....',
]

const PARTS: Record<string, Px> = {
  k: { ramp: BLACK, level: 1.3 }, K: { ramp: BLACK, level: 2.6 }, V: { ramp: BLACK, level: 2.4 },
  g: { ramp: GOLD, level: 4.4 }, G: { ramp: GOLD, level: 2.8 }, b: { ramp: GOLD, level: 5 }, c: { ramp: GOLD, level: 3.6 },
  h: { ramp: WHITE, level: 3 }, H: { ramp: WHITE, level: 1.8 }, w: { ramp: WHITE, level: 4.4 }, W: { ramp: WHITE, level: 4.6 },
  m: { ramp: WHITE, level: 4 }, M: { ramp: WHITE, level: 2 }, t: { ramp: WHITE, level: 4.4 },
  s: { ramp: SKIN, level: 2.8 }, S: { ramp: SKIN, level: 1.8 }, p: { ramp: RED, level: 4.6 },
  n: { ramp: SKIN, level: 3.2 }, N: { ramp: SKIN, level: 4.2 }, e: { ramp: BLACK, level: 0 },
  r: { ramp: RED, level: 3 }, R: { ramp: RED, level: 2 }, d: { ramp: SKIN, level: 2.6 },
  B: { ramp: BLACK, level: 1.2 }, u: { ramp: WHITE, level: 3.4 }, U: { ramp: WHITE, level: 2.2 },
  x: { ramp: BLACK, level: 1.6 }, y: { ramp: GOLD, level: 3.6 }, z: { ramp: BASE, level: 2 },
}

const JAW = [
  '..rrrtttt.',
  '..rrrrrrrr',
  '.bbbbbbbbb',
  '..bbbbbbB.',
  '...bbbbB..',
  '....bbB...',
]
const JAW_PARTS: Record<string, Px> = {
  r: { ramp: RED, level: 2.4 }, t: { ramp: WHITE, level: 3.6 },
  b: { ramp: WHITE, level: 3.6 }, B: { ramp: WHITE, level: 2.4 },
}
const HINGE_X = 24
const HINGE_Y = 13.5

function jawAt(f: number): number {
  if (f < 6) return 0
  if (f < 12) return 0.62 * ease.outBack(beat(f, 6, 12))
  if (f < 24) return 0.62 + (f >= 21 && f % 2 === 1 ? 0.04 : 0)
  if (f === 24) return 0.5
  if (f === 25) return 0.24
  if (f < 34) return 0
  if (f < 40) return 0.16 * Math.sin(Math.PI * beat(f, 34, 40))
  return 0
}

function soldier(theta: number, hop: number): Map<number, Px> {
  const map = new Map<number, Px>()
  const put = (x: number, y: number, px: Px) => {
    if (x >= 0 && x < W && y >= 0 && y < H) map.set(y * W + x, px)
  }
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  for (let s = 0; s <= 8; s += 0.5) {
    const lx = -s * 0.85
    const ly = s * 0.55 + 0.5
    const x = Math.round(HINGE_X + lx * cos - ly * sin)
    const y = Math.round(HINGE_Y + lx * sin + ly * cos - hop)
    put(x, y, { ramp: LEVER, level: 3 })
    put(x, y + 1, { ramp: LEVER, level: 1.6 })
  }
  BODY.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const px = PARTS[row[i] ?? '.']
      if (px) put(16 + i, j - hop, px)
    }
  })
  for (let y = 12; y < 24; y++) {
    for (let x = 18; x < 34; x++) {
      const dx = x - HINGE_X
      const dy = y + hop - HINGE_Y
      const jx = Math.round(HINGE_X + dx * cos + dy * sin)
      const jy = Math.round(HINGE_Y - dx * sin + dy * cos)
      const px = JAW_PARTS[JAW[jy - 14]?.[jx - 22] ?? '.']
      if (px) put(x, y, px)
    }
  }
  return map
}

function mouth(theta: number, hop: number): Set<number> {
  const set = new Set<number>()
  if (theta < 0.05) return set
  for (let x = 25; x <= 30; x++) {
    const top = 14
    const bottom = 14 + (x - HINGE_X) * Math.tan(theta)
    for (let y = top; y < bottom; y++) set.add((y - hop) * W + x)
  }
  return set
}

const NUT_ART = ['.ab.', 'abcb', 'bcbc', '.cb.']
const NUT_SQUASHED = ['abcbc', 'cbabc']

function nutAt(f: number): { x: number; y: number; art: readonly string[] } | undefined {
  if (f < 11 || f > 25) return undefined
  if (f === 25) return { x: 28, y: 14.5, art: NUT_SQUASHED }
  if (f >= 20) return { x: 28, y: f === 20 ? 14 : 15, art: NUT_ART }
  const t = beat(f, 11, 20)
  const x = 66 + (28 - 66) * t
  const y = 6 + (15 - 6) * t - 12 * 4 * t * (1 - t) * 0.6
  return { x, y, art: f % 2 ? NUT_ART : NUT_ART.map(r => [...r].reverse().join('')) }
}

const SHARDS = Array.from({ length: 14 }, (_, i) => ({
  vx: i < 3 ? -0.4 - hash(i, 1) * 0.7 : 0.4 + hash(i, 1) * 2.2,
  vy: -0.8 - hash(i, 2) * 2.2,
  isKernel: i % 4 === 1,
  spin: Math.floor(hash(i, 3) * 3),
}))

function render(): Int32Array[] {
  const out: Int32Array[] = []

  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const p = flicker(f)
    const lit = (x: number, y: number) => lightOf(p, x, y)
    const theta = jawAt(f)
    const hop = f === 26 || f === 27 ? 1 : 0
    const figure = soldier(theta, hop)
    const open = mouth(theta, hop)

    for (let y = 0; y < MANTEL_Y; y++) {
      for (let x = 0; x < W; x++) {
        const sx = Math.round(LIGHT_X + (x - LIGHT_X) / 1.45)
        const sy = Math.round(LIGHT_Y + (y - LIGHT_Y) / 1.45)
        const isShadow = x > 16 && (figure.has(sy * W + sx) || open.has(sy * W + sx))
        const stripe = x % 6 < 3 ? 0.5 : 0
        const motif = x % 6 === 1 && y % 6 === 3 ? 0.7 : 0
        const l = lit(x, y)
        const level = isShadow ? 0.6 + stripe * 0.5 + l * 1.2 : 1 + stripe + motif + l * 4.6
        c.set(x, y, shade(WALL, level - (y < 2 ? 0.5 : 0), x, y))
      }
    }
    for (let y = 2; y <= 11; y++) {
      for (let x = 1; x <= 13; x++) {
        const l = lit(x, y)
        if (x === 1 || x === 13 || y === 2 || y === 11) {
          c.set(x, y, shade(GOLD, 1.6 + l * 3 + (y === 2 || x === 13 ? 0.8 : 0), x, y))
          continue
        }
        const hill = 8 - Math.round(Math.sin(x * 0.6) * 1.2) - (x > 8 ? 1 : 0)
        if (y >= hill) c.set(x, y, shade(PAINT, 2.4 + l * 1.4 + (y === hill ? 0.6 : 0), x, y))
        else c.set(x, y, shade(PAINT, 0.6 + (y - 2) * 0.12 + l, x, y))
      }
    }
    c.set(10, 6, shade(PAINT, 1, 0, 0))
    c.set(10, 5, shade(PAINT, 1, 0, 0))
    c.set(4, 4, shade(PAINT, 3.6, 0, 0))

    for (let y = 2; y <= 17; y++) {
      for (let x = 46; x <= 59; x++) {
        const l = lit(x, y)
        const isFrame = x === 46 || x === 59 || y === 2 || y === 16 || x === 53 || y === 9
        if (y === 17) c.set(x, y, shade(MANTEL, 3.6 + l * 3, x, y))
        else if (isFrame) c.set(x, y, shade(MANTEL, 1.4 + l * 3 + (x === 46 || y === 2 ? 0.6 : 0), x, y))
        else {
          const roof = y >= 14 - (x > 53 ? 1 : 0) - (x % 5 === 0 ? 1 : 0)
          c.set(x, y, roof ? shade(SNOW, y === 15 ? 0.6 : 1.4, x, y) : shade(NIGHT, (y - 2) * 0.28, x, y))
        }
      }
    }
    for (const s of particles(f, LOOP, 12, LOOP, 5)) {
      const [r0, r1, r2] = s.r
      const x = Math.round(47 + r0 * 12 + Math.sin(s.t * 0.25 + r1 * 6) * 0.8)
      const y = Math.round(3 + s.age * 12)
      const isPane = x !== 53 && y !== 9 && x > 46 && x < 59 && y < 14
      if (isPane) c.set(x, y, shade(SNOW, 1.6 + r2 * 2, x, y))
    }

    for (let x = 0; x < W; x++) {
      for (let y = MANTEL_Y; y < H; y++) {
        const l = lit(x, y)
        const level = y === MANTEL_Y ? 3.4 + l * 4 : y === MANTEL_Y + 1 ? 4.2 + l * 3.4 : y === MANTEL_Y + 2 ? 1.2 + l * 1.6 : 2.4 + l * 3
        c.set(x, y, shade(MANTEL, level - (y === H - 1 ? 0.6 : 0), x, y))
      }
    }
    for (let x = 19; x <= 38; x++) c.set(x, MANTEL_Y, shade(MANTEL, 2.2 + lit(x, MANTEL_Y) * 1.5 + (x > 32 ? 1 : 0), x, MANTEL_Y))

    for (let x = 47; x <= 59; x++) {
      for (let y = 22; y <= 26; y++) {
        const u = (x - 53) / 6.5
        const bottom = 26
        const rim = 23
        if (y < rim || u * u + ((y - rim) / 3.5) ** 2 > 1) continue
        const l = lit(x, y)
        c.set(x, y, shade(GOLD, 1.2 + l * 2.5 + (y === rim ? 1.6 : 0) + (x < 50 ? 0.6 : 0) - (y === bottom ? 0.6 : 0), x, y))
      }
    }
    for (const [nx, ny] of [[49, 21], [52, 20], [55, 21], [58, 21]] as const) {
      c.sprite(nx, ny, ['.ab.', 'abcb'], { a: NUT[3] ?? 0, b: NUT[2] ?? 0, c: NUT[1] ?? 0 })
    }

    for (let y = 19; y < MANTEL_Y; y++) {
      for (let x = 6; x <= 9; x++) {
        c.set(x, y, shade(WAX, (y === 19 ? 4.6 : 3.4 - (y - 20) * 0.15) + (x === 6 ? -1 : x === 9 ? -0.6 : 0.4), x, y))
      }
    }
    c.set(9, 20, shade(WAX, 4.4, 0, 0))
    c.set(9, 21, shade(WAX, 4, 0, 0))
    c.set(7, 18, BLACK[1] ?? 0)
    const lean = Math.round(wave(f, LOOP, 4) * 0.7 - (f >= 26 && f <= 30 ? 1 : 0))
    const tall = 4 + Math.round(wave(f, LOOP, 6, 0.2) * 0.6 + 0.4)
    for (let k = 0; k < tall; k++) {
      const y = 17 - k
      const x = 7 + (k >= tall - 2 ? lean : 0)
      const level = k === 0 ? 3 : k < tall - 1 ? 8 - k * 0.6 : 5
      c.set(x, y, shade(FIRE, level, 0, 0))
      if (k > 0 && k < tall - 2) c.set(x + 1, y, shade(FIRE, level - 2.4, 0, 0))
    }

    for (const [key, px] of figure) {
      const x = key % W
      const y = Math.floor(key / W)
      const l = lit(x, y)
      const left = !figure.has(key - 1) ? 1 : 0
      const right = !figure.has(key + 1) ? -0.8 : 0
      const under = !figure.has(key + W) ? -0.4 : 0
      c.set(x, y, shade(px.ramp, px.level + l * 1.6 + left * l * 1.8 + right + under, x, y))
    }
    for (const key of open) c.set(key % W, Math.floor(key / W), RED[0] ?? 0)
    const nut = nutAt(f)
    if (nut) c.sprite(nut.x, nut.y - hop, nut.art, { a: NUT[5] ?? 0, b: NUT[3] ?? 0, c: NUT[1] ?? 0 })
    if (nut && f >= 20) {
      for (const [key, px] of figure) {
        const x = key % W
        const y = Math.floor(key / W)
        if (y < 14 - hop || x < 26 || px.ramp === LEVER) continue
        if (y <= 13 - hop) continue
        if (px.ramp !== WHITE && px.ramp !== RED) continue
        if (y < 15 + Math.round((x - HINGE_X) * Math.tan(theta)) - hop) continue
        c.set(x, y, shade(px.ramp, px.level + lit(x, y) * 1.6, x, y))
      }
    }

    if (f >= 26) {
      const t = f - 26 + 0.6
      SHARDS.forEach((s, i) => {
        const x = Math.round(31 + s.vx * t)
        const y = Math.round(14 - hop + s.vy * t + 0.3 * t * t)
        if (y > H + 1) return
        const ramp = s.isKernel ? KERNEL : NUT
        const level = s.isKernel ? 2.8 : 4
        const turn = (f + s.spin + i) % 3
        const bits: readonly (readonly [number, number, number])[] = s.isKernel
          ? [[0, 0, 0.6], [1, 0, -0.6]]
          : turn === 0 ? [[0, 0, 0.6], [1, 0, -0.4], [2, 0, -1.4]] : turn === 1 ? [[0, 0, 0.6], [0, 1, -1]] : [[0, 0, 0.8], [1, 0, -0.2], [0, 1, -1.2], [1, 1, -2]]
        for (const [bx, by, d] of bits) c.set(x + bx, y + by, shade(ramp, level + d, 0, 0))
      })
    }

    if (f === 26) {
      const px = c.copy()
      for (let y = H - 1; y > 0; y--) for (let x = 0; x < W; x++) c.px[y * W + x] = px[(y - 1) * W + x] ?? 0
    }

    out.push(c.px)
  }

  return out
}

export const scene: Scene = {
  verb: 'Crunching',
  render,
  hero: 26,
  snaps: [
    { frames: [13, 16], box: [45, 3, 61, 7], colors: [...NUT], why: 'the walnut is tossed in from the right, tumbling, about 4 px a frame' },
    { frames: [21, 24], box: [16, 13, 19, 15], colors: [...LEVER], why: 'he strains on the nut: the lever at his back quivers' },
    { frames: [26, 27], why: 'the crunch jolts the whole picture down a pixel for a frame' },
    { frames: 28, box: [13, 0, 45, 30], why: 'the soldier, jolted up by the crunch, drops back to the mantel as the shards fly' },
    { frames: 36, box: [38, 18, 40, 20], colors: [...NUT, ...KERNEL], why: 'a shell shard falls past the mantel, faster than 2 px a frame' },
  ],
}

