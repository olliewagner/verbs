import { Canvas, PALETTE, TAU, beat, ease, frames, hash, hex, lerp, noise, shade, smoothstep, type Scene } from '../engine'

const W = 64
const LOOP = 72
const LX = 22
const LY = 13

const WALL = hex('06070b 0b0f13 111a1b 182520 23321f 364224 535629 786d32 a08a43')
const WOOD = hex('050408 0d090d 180f13 271617 3a201a 52301f 6e4224 905a2c b47738 d6994f')
const BRASS = hex('060508 120e0b 241809 3e290d 624016 8a5c1f b37f2a d9a63c f2cd68 fff0b8')
const PAPER = hex('08070b 17141a 2e2a2a 544c42 82745f ac9c80 d1c19e ecdfba fcf5dc')
const GLASS = hex('090b12 141b24 213038 33463f 556552 8e8c6c cfc39a f8ecc4')
const GLOW = hex('3a1a0e 6a3414 9c5a1e c8862e e8b24c f8d67c fff0bc')
const FIRE = PALETTE.fire
const SMOKE = GLASS
const MOTH = PAPER
const SPINES = [
  hex('07050a 1a0a10 34101a 551820 7c2424 a3372a c4553a e07d4f'),
  hex('05080a 0b1612 13261a 1d3b22 2c552a 457136 6b8e43 98ad57'),
  hex('06060e 0d0f22 151b38 1f2c52 2d426c 425c86 62799c 8f9fb2'),
  hex('08060a 1b120c 33210f 523313 774a19 9e6522 c4862f e2ad4b'),
] as const
const SEA = hex('05070c 0b141d 13252e 1f3b40 30544f 4a6e5c 6f8b6a a1aa7f')
const LAND = PAPER
const FLESH = hex('08060a 1e1214 3c2220 64382c 8c5440 b0745a cf9978 e8bf9a')
const HAIR = hex('08080c 1a1a20 32303a 524e58 767078 9b938f bfb5a8 e0d6c4')
const COAT = hex('040408 0a0a10 12121a 1c1b24 28262e 383440')
const OIL = hex('050608 0b0d0e 141612 1e2116 2b2d1a 3b3b20 504c28 69602f')

type Lamp = { flame: number; power: number; radius: number; ember: number }

function sputter(f: number, at: number, flame: number, power: number, radius: number, base: Lamp): Lamp | undefined {
  if (f < at || f > at + 3) return undefined
  const k = 0.68 ** (f - at)
  return { flame: flame * k, power: lerp(base.power, power, k), radius: lerp(base.radius, radius, k), ember: base.ember }
}

function lampAt(f: number): Lamp {
  const ember = f >= 64 ? 1 - (f - 64) * 0.09 : f < 6 ? 0.3 + f * 0.03 : f < 11 ? 0.55 : 0.7
  const out: Lamp = { flame: 0, power: ember * 0.18, radius: 7, ember }
  if (f < 15) return sputter(f, 6, 0.3, 0.5, 14, out) ?? sputter(f, 11, 0.55, 0.7, 22, out) ?? out
  if (f >= 64) return out
  const grow = 1 - (1 - beat(f, 15, 33)) ** 1.6
  const dim = smoothstep(0, 1, beat(f, 50, 64))
  const flicker = noise(f * 0.9, 7.3)
  return {
    flame: (1 + 0.3 * (1 - beat(f, 15, 19))) * lerp(1, 0.12, dim) * (0.94 + 0.08 * flicker),
    power: (1 + 0.25 * 0.5 ** (f - 15)) * lerp(1, 0.35, dim) * (0.95 + 0.05 * flicker),
    radius: lerp(16, 66, grow) * lerp(1, 0.1, dim) * (0.98 + 0.02 * flicker),
    ember,
  }
}

function lightOf(l: Lamp, x: number, y: number): number {
  const d = Math.hypot(x - LX, (y - LY) * 1.15)
  return l.power * Math.max(0, 1 - d / l.radius) ** 1.3
}

const GLOBE_X = 51
const GLOBE_Y = 15
const GLOBE_R = 4.5
const CASTERS: ReadonlySet<number> = (() => {
  const s = new Set<number>()
  for (let y = 17; y <= 21; y++) for (let x = 18; x <= 26; x++) s.add(y * W + x)
  for (let y = 10; y <= 20; y++) {
    for (let x = 46; x <= 56; x++) if (Math.hypot(x - GLOBE_X, y - GLOBE_Y) <= GLOBE_R) s.add(y * W + x)
  }
  for (let y = 17; y <= 22; y++) for (let x = 4; x <= 14; x++) s.add(y * W + x)
  return s
})()

const castShadow = (x: number, y: number) => {
  const sx = Math.round(LX + (x - LX) / 1.3)
  const sy = Math.round(LY + (y - LY) / 1.3)
  return CASTERS.has(sy * W + sx)
}

type Moth = { x: number; y: number; z: number; isUp: boolean }

function mothPath(t: number): Moth | undefined {
  if (t < 23 || t > 55) return undefined
  const p = (t - 23) / 32
  const u = p * 2.25 * TAU
  const th = u - 0.85 * Math.sin(u) - 0.35
  const a = ease.out(smoothstep(0, 0.24, p))
  const e = ease.in(smoothstep(0.76, 1, p))
  const ox = LX + 7 * Math.cos(th)
  const oy = 10.5 + 2 * Math.sin(th * 2 + 0.6)
  return {
    x: lerp(lerp(-4, ox, a), 42, e),
    y: lerp(lerp(3, oy, a), -4, e),
    z: Math.sin(th),
    isUp: Math.ceil(t) % 2 === 0,
  }
}

function mothAt(f: number): Moth | undefined {
  const m = mothPath(f)
  return m && { ...m, x: Math.round(m.x), y: Math.round(m.y) }
}

function inMothShadow(m: Moth, x: number, y: number): boolean {
  const k = 2.4
  const dx = LX + (x - LX) / k - m.x
  const dy = LY + (y - LY) / k - m.y
  if (Math.abs(dx) <= 0.45 && Math.abs(dy) <= 0.8) return true
  const wy = m.isUp ? -0.7 : 0.1
  return [-1, 1].some(s => ((dx - s * 1.05) / 0.8) ** 2 + ((dy - wy) / 0.5) ** 2 <= 1)
}

type Blur = { m: Moth; weight: number }

function mothBlur(f: number): Blur[] {
  return [0, 0.25, 0.5, 0.75].flatMap(s => {
    const m = mothPath(f - s)
    const before = mothPath(f - s - 0.5)
    if (!m || !before) return []
    const speed = Math.hypot(m.x - before.x, m.y - before.y) * 2 * 2.4
    return [{ m, weight: (smoothstep(0.4, 0.05, m.z) * Math.min(1, (5.5 / speed) ** 2)) / 4 }]
  })
}
function mothShadowAt(blur: readonly Blur[], x: number, y: number): number {
  let n = 0
  for (const { m, weight } of blur) if (weight > 0 && inMothShadow(m, x, y)) n += weight
  return n
}
type Spine = { hue: number; offset: number }
const SHELF_ROWS = [[0, 6], [8, 14], [16, 22]] as const
const BOOKS: ReadonlyMap<number, Spine> = (() => {
  const books = new Map<number, Spine>()
  const fill = (x0: number, x1: number, seed: number, facing: number) => {
    SHELF_ROWS.forEach(([top, bottom], row) => {
      let x = x0
      for (let i = 0; x <= x1; i++) {
        const r = hash(seed, row, i)
        if (hash(seed, row, i + 50) < 0.08) {
          x++
          continue
        }
        const w = Math.min(r < 0.2 ? 1 : r < 0.8 ? 2 : 3, x1 - x + 1)
        const t = top + Math.floor(hash(seed, row, i + 90) * 3)
        const hue = Math.floor(hash(seed, row, i + 130) * SPINES.length)
        const isBanded = hash(seed, row, i + 170) > 0.45
        for (let bx = x; bx < x + w; bx++) {
          const lit = w > 1 && bx === (facing > 0 ? x + w - 1 : x) ? 0.9 : w > 1 && bx === (facing > 0 ? x : x + w - 1) ? -0.7 : 0
          for (let by = t; by <= bottom; by++) {
            const band = isBanded && w > 1 && (by === t + 1 || by === bottom - 1) ? 1.3 : 0
            books.set(by * W + bx, { hue, offset: lit + band })
          }
        }
        x += w
      }
    })
  }
  fill(0, 12, 3, 1)
  fill(59, 63, 11, -1)
  return books
})()
const PORTRAIT = [
  'bbhhhhbb',
  'bhffffhb',
  'bhefefhb',
  'bbffffbb',
  'bbfmmfbb',
  'bbssssbb',
  'bcssssbc',
  'cccssccc',
  'cccccccc',
]
const PAINT: Record<string, [readonly number[], number]> = {
  b: [OIL, 1.2], h: [HAIR, 3.4], f: [FLESH, 3], e: [FLESH, 1], m: [HAIR, 4], s: [HAIR, 3.6], c: [COAT, 1],
}
const OPEN_BOOK = [
  '.ppiipiigiippi.',
  'piipiipgpiipiip',
  'ceeeeeeGeeeeeec',
]
const GLASS_ROWS: readonly (readonly [number, number, number])[] = [[6, 21, 23], [7, 21, 23], [8, 21, 23], [9, 21, 23], [10, 21, 23], [11, 20, 24], [12, 19, 25], [13, 19, 25], [14, 19, 25], [15, 20, 24]]
const FONT_ROWS: readonly (readonly [number, number, number, number])[] = [[16, 20, 24, 2], [17, 19, 25, 2.4], [18, 18, 26, 1.4], [19, 18, 26, 0.3], [20, 19, 25, -0.6], [21, 21, 23, -0.6], [22, 19, 25, 0.6]]
function drawScene(c: Canvas, f: number): void {
  const l = lampAt(f)
  const m = mothAt(f)
  const blur = mothBlur(f)
  const lit = (x: number, y: number) => lightOf(l, x, y)
  const onWall = (x: number, y: number) => lit(x, y) * (castShadow(x, y) ? 0.2 : 1 - 0.8 * mothShadowAt(blur, x, y))
  const vig = (x: number, y: number) => (((x - 30) / 38) ** 2 + ((y - 13) / 22) ** 2) * 0.9
  const detail = (v: number) => Math.min(1, v * 3)
  for (let y = 0; y < 23; y++) {
    for (let x = 13; x < 59; x++) {
      const L = onWall(x, y)
      const k = detail(L)
      if (y < 17) {
        c.set(x, y, shade(WALL, 0.4 + L * 7.4 - (x % 4 === 1 && k > 0.6 ? 1 : 0) - vig(x, y)))
        continue
      }
      const o = y === 17 ? 1.3 : y === 18 ? -0.9 : (x - 15) % 10 === 0 ? -0.9 : (x - 15) % 10 === 1 ? 0.5 : 0
      c.set(x, y, shade(WOOD, 0.6 + L * 6.4 + o * k - vig(x, y)))
    }
  }
  for (const [x0, x1, post, face] of [[0, 12, 13, 14], [59, 63, 58, 57]] as const) {
    for (let y = 0; y < 23; y++) {
      for (let x = Math.min(x0, face); x <= Math.max(x1, face); x++) {
        const L = onWall(x, y)
        const k = detail(L)
        const v = vig(x, y)
        if (x === face) c.set(x, y, shade(WOOD, 1 + L * 7.2 + 0.8 * k - v))
        else if (x === post) c.set(x, y, shade(WOOD, 0.6 + L * 5 - v))
        else if (y === 7 || y === 15) c.set(x, y, shade(WOOD, 1 + L * 7 + 0.4 * k - v))
        else {
          const b = BOOKS.get(y * W + x)
          if (b) c.set(x, y, shade(SPINES[b.hue] ?? WOOD, 0.7 + L * 6.6 + b.offset * k - v))
          else c.set(x, y, shade(WOOD, 0.2 + L * 2.6 - v))
        }
      }
    }
  }
  for (let y = 2; y <= 14; y++) {
    for (let x = 33; x <= 44; x++) {
      const L = onWall(x, y)
      const k = detail(L)
      const ring = Math.min(x - 33, 44 - x, y - 2, 14 - y)
      if (ring === 0) {
        const bevel = x === 33 || y === 14 ? 1 : -0.6
        c.set(x, y, shade(BRASS, 0.8 + L * 7.5 + bevel * k))
      } else if (ring === 1) {
        const bevel = x === 34 || y === 13 ? -0.5 : 0.6
        c.set(x, y, shade(BRASS, 0.5 + L * 6.5 + bevel * k))
      } else {
        const ch = PORTRAIT[y - 4]?.[x - 35] ?? 'b'
        const [r, base] = PAINT[ch] ?? [OIL, 1]
        const painted = x <= 37 ? 0.6 : x >= 40 ? -0.4 : 0
        c.set(x, y, shade(r, (base + painted) * Math.min(1, 0.25 + L * 1.4) + L * 2.5))
      }
    }
  }
  for (let y = 23; y < 32; y++) {
    for (let x = 0; x < W; x++) {
      const L = lit(x, y)
      const k = detail(L)
      const v = vig(x, y)
      if (y <= 24) {
        const under = Math.abs(x - LX)
        const blocked = under <= 3 ? 0.3 : under <= 5 ? 0.65 : 1
        c.set(x, y, shade(WOOD, 1.1 + L * 8 * blocked + (y === 23 ? -0.3 : 0) - v))
      } else if (y === 25) c.set(x, y, shade(WOOD, 1.4 + L * 6.6 - v))
      else if (y === 26 || y === 31) c.set(x, y, shade(WOOD, 0.3 + L * 2 - v))
      else {
        const isGap = x === 21 || x === 42 || x === 0 || x === 63
        const isPull = y === 28 && (x === 10 || x === 11 || x === 31 || x === 32 || x === 52 || x === 53)
        if (isPull) c.set(x, y, shade(BRASS, 1 + L * 7 + (x % 2 ? 0 : 0.6) - v))
        else c.set(x, y, shade(WOOD, 0.8 + L * 3.6 - (isGap ? 1 : 0) + (y === 27 ? 0.6 * k : 0) - v))
      }
    }
  }
  const stack: [number, number, number, number, number][] = [[21, 22, 4, 14, 0], [19, 20, 5, 13, -1], [17, 18, 6, 12, 2]]
  for (const [y0, y1, x0, x1, kind] of stack) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const L = lit(x, y)
        const k = detail(L)
        const end = x === x1 ? 1 : x === x0 ? -0.6 : 0
        if (kind < 0) {
          if (y === y0) c.set(x, y, shade(SPINES[1], 0.8 + L * 6.6 + end * k))
          else c.set(x, y, shade(PAPER, 0.8 + L * 6.4 + end * k))
        } else {
          const band = (x === x0 + 2 || x === x1 - 2) ? 1.2 : 0
          c.set(x, y, shade(SPINES[kind] ?? WOOD, 0.8 + L * 6.6 + (end + band + (y === y0 ? 0.4 : 0)) * k))
        }
      }
    }
  }
  OPEN_BOOK.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i]
      const x = 26 + i
      const y = 22 + j
      const L = lit(x, y)
      const k = detail(L)
      if (ch === 'p') c.set(x, y, shade(PAPER, 0.9 + L * 8.4))
      else if (ch === 'i') c.set(x, y, shade(PAPER, 0.9 + L * 8.4 - 2.6 * k))
      else if (ch === 'g' || ch === 'G') c.set(x, y, shade(PAPER, 0.7 + L * 6.2))
      else if (ch === 'e') c.set(x, y, shade(PAPER, 0.8 + L * 7 - 1.2 * k))
      else if (ch === 'c') c.set(x, y, shade(SPINES[0], 0.8 + L * 6.4))
    }
  })
  const gl = lit(GLOBE_X, GLOBE_Y)
  const lv = [LX - GLOBE_X, LY - GLOBE_Y, 9]
  const ln = Math.hypot(lv[0] ?? 0, lv[1] ?? 0, lv[2] ?? 0)
  for (let y = 10; y <= 20; y++) {
    for (let x = 46; x <= 56; x++) {
      const nx = (x - GLOBE_X) / GLOBE_R
      const ny = (y - GLOBE_Y) / GLOBE_R
      const r2 = nx * nx + ny * ny
      if (r2 > 1) continue
      const nz = Math.sqrt(1 - r2)
      const diffuse = Math.max(0, (nx * (lv[0] ?? 0) + ny * (lv[1] ?? 0) + nz * (lv[2] ?? 0)) / ln)
      const tx = nx * 0.92 + ny * 0.38
      const ty = ny * 0.92 - nx * 0.38
      const isLand = noise(tx * 2.1 + 4, ty * 2.6 + 9, nz * 2.1 + 2, 5) > 0.53
      const level = 0.5 + gl * (1.4 + diffuse * 6.4) + (diffuse > 0.93 ? gl * 2 : 0)
      c.set(x, y, shade(isLand ? LAND : SEA, level))
    }
  }
  for (let a = -1.3; a <= 1.3; a += 0.05) {
    const x = GLOBE_X + Math.sin(a + 0.4) * 5.6
    const y = GLOBE_Y - Math.cos(a + 0.4) * 5.6
    const L = lit(x, y)
    c.set(x, y, shade(BRASS, 0.8 + L * 7.4 + (x < GLOBE_X ? 0.8 : -0.4) * detail(L)))
  }
  for (const [x, y] of [[48, 10], [51, 21], [50, 22], [51, 22], [52, 22], [49, 22], [53, 22]] as const) {
    const L = lit(x, y)
    c.set(x, y, shade(BRASS, 0.8 + L * 6.6 + (y === 22 && x < 51 ? 0.7 : 0) * detail(L)))
  }
  if (m && m.z < 0) drawMoth(c, m, l)
  const fl = l.flame
  for (const [y, x0, x1] of GLASS_ROWS) {
    for (let x = x0; x <= x1; x++) {
      const isEdge = x === x0 || x === x1 || y === 6
      const isNeck = y < 11
      if (isEdge) {
        const lift = isNeck ? fl * 3.6 - (11 - y) * 0.25 : fl * 5.4
        c.set(x, y, shade(GLASS, 1.2 + lift + (x === x0 ? 0.4 : 0) + l.ember * 0.6 * (y > 11 ? 1 : 0)))
      } else if (isNeck) {
        const L = onWall(x, y)
        c.set(x, y, shade(WALL, 0.4 + L * 7.4 + fl * 0.8 - vig(x, y)))
      } else if (fl > 0) {
        const d = Math.hypot(x - LX, (y - 14) * 0.9)
        c.set(x, y, shade(GLOW, fl * 4.6 - d * 1.5))
      } else {
        const d = Math.hypot(x - LX, y - 15)
        c.set(x, y, shade(GLASS, 0.5 + Math.max(0, l.ember * 1.6 - d * 0.5)))
      }
    }
  }
  if (fl > 0) {
    const h = fl * 4.6
    const sway = noise(f * 0.8, 2.1) > 0.62 ? 1 : noise(f * 0.8, 2.1) < 0.3 ? -1 : 0
    for (let k = 0; k < Math.ceil(h); k++) {
      const t = 1 - k / h
      const x = k === Math.ceil(h) - 1 && k > 1 ? LX + sway : LX
      c.set(x, 15 - k, shade(FIRE, 3.5 + t * 5.2 * Math.min(1, fl * 2.5)))
    }
    if (fl > 0.55) for (const x of [LX - 1, LX + 1]) c.set(x, 15, shade(FIRE, 4.4 + fl))
    if (fl > 0.95) for (const x of [LX - 1, LX + 1]) c.set(x, 14, shade(FIRE, 4.2 + fl * 0.8))
  } else {
    c.set(LX, 15, shade(FIRE, 0.6 + l.ember * 3.2))
  }
  for (const [y, x0, x1, top] of FONT_ROWS) {
    for (let x = x0; x <= x1; x++) {
      const L = lit(x, y)
      const k = detail(L)
      const side = x === x0 || x === x1 ? -0.7 : 0
      const spec = (x === 20 && y === 18) || (x === 21 && y === 17) ? 1.6 : 0
      c.set(x, y, shade(BRASS, 0.8 + L * 5.4 + (top + side + spec) * k))
    }
  }
  for (const x of [25, 26]) c.set(x, 16, shade(BRASS, 0.8 + lit(x, 16) * 6 + (x === 26 ? 0.8 : 0) * detail(lit(x, 16))))
  if (m && m.z >= 0) drawMoth(c, m, l)
  if (f >= 63) {
    const age = f - 63
    const len = Math.min(8, age * 1.5 + 1)
    for (let s = Math.max(0, (age - 4) * 1.3); s < len; s++) {
      const y = 5 - s
      const x = LX + Math.round(Math.sin(s * 0.7 - age * 0.6) * s * 0.24)
      const a = (1 - age / 9) * (1 - s / 10)
      if (a > 0.1) c.set(x, y, shade(SMOKE, 0.8 + a * 3.8))
    }
  }
}
function drawMoth(c: Canvas, m: Moth, l: Lamp): void {
  const L = lightOf(l, m.x, m.y)
  const wing = m.z < 0 ? 1.6 + L * 6.4 : 1.4 + L * 4.2
  const body = wing - 1.4
  if (m.isUp) {
    c.set(m.x - 1, m.y - 1, shade(MOTH, wing))
    c.set(m.x + 1, m.y - 1, shade(MOTH, wing))
  } else {
    c.set(m.x - 1, m.y, shade(MOTH, wing))
    c.set(m.x + 1, m.y, shade(MOTH, wing))
  }
  c.set(m.x, m.y, shade(MOTH, body))
}
export const scene: Scene = {
  verb: 'Elucidating',
  render: () => frames(LOOP, drawScene),
  hero: 37,
  snaps: [
    { frames: 6, box: [19, 11, 26, 18], why: 'The first sputter: the wick flares for a frame and the chimney glows, then the flare dies away over three frames.' },
    { frames: 11, box: [9, 3, 36, 22], why: 'The second sputter, brighter: the flare throws a flash of light over the shelves, the book stack and the portrait frame for a frame, then dies away over three.' },
    { frames: 15, box: [12, 6, 31, 21], why: 'The wick catches: the flame stands up in the chimney at once and flashes over the wall round the lamp, the payoff of the two sputters; its light then spreads over the room.' },
  ],
}