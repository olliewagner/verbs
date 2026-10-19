import { Canvas, PALETTE, clamp, ease, hash, hex, lerp, loopNoise, random, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const WALL = hex('07070c 0d0c14 15131d 1f1b27 2c2533 3e3140 563f48 74504e')
const IRON = hex('08080c 121218 1c1c24 2a2a34 3c3b48 54505e 75697a a08c94 d8b8a8')
const WOOD = PALETTE.wood
const BRICK = hex('140a0c 22100f 361814 4e2219 6a2e1e 8a3e24 aa5430 c87040')
const SKIN = hex('2a1410 4a2418 703a24 965030 b86c40 d68c56 ecb07a')
const HOT = hex('1c1c22 2c2a30 4a2018 7a1e12 b2300e de5a12 f68e22 fcc24a fee9a0 fffbe8')
const STEAM = hex('2a2a36 46465a 6c6a80 9a96a8 c8c2cc ece6e6')
const WATER = hex('04080e 08121c 0e1e2c 16304a 24486a')

const at = (a: readonly number[], i: number) => a[i] ?? 0

const IMPACTS = [6, 16, 26]
const LIFT = 32
const DIP = 42
const SOAK = 44
const OUT = 56
const IN = 70
const HEAT = 84
const BACK = LOOP

const BAR_LEN = 11
const ANVIL: [number, number] = [25, 16]
const TUB: [number, number] = [2, 25]
const COALS: [number, number] = [50, 13]

const arc = (a: [number, number], b: [number, number], t: number, lift: number): [number, number] => {
  const e = (1 - Math.cos(Math.PI * clamp(t))) / 2
  return [lerp(a[0], b[0], e), lerp(a[1], b[1], e) - Math.sin(e * Math.PI) * lift]
}

function barAt(f: number): [number, number] {
  const above: [number, number] = [TUB[0], 18]
  if (f < LIFT) return ANVIL
  if (f < DIP) return arc(ANVIL, above, (f - LIFT) / (DIP - LIFT), 5)
  if (f < SOAK) return arc(above, TUB, (f - DIP) / (SOAK - DIP), 0)
  if (f < OUT) return [TUB[0], TUB[1] + (f % 4 < 2 ? 0 : 0.4)]
  if (f < OUT + 2) return arc(TUB, above, (f - OUT) / 2, 0)
  if (f < IN) return arc(above, COALS, (f - OUT - 2) / (IN - OUT - 2), 6)
  if (f < HEAT) return COALS
  if (f < BACK) return arc(COALS, ANVIL, (f - HEAT) / (BACK - HEAT), 5)
  return ANVIL
}

function heat(f: number): number {
  if (f < DIP) return 1 - 0.18 * (f / DIP)
  if (f < SOAK + 4) return lerp(0.82, 0.18, ease.out((f - DIP) / (SOAK + 4 - DIP)))
  if (f < OUT) return lerp(0.18, 0, (f - SOAK - 4) / (OUT - SOAK - 4))
  if (f < IN) return 0
  if (f < HEAT) return ease.inOut((f - IN) / (HEAT - IN))
  return 1
}

function raised(f: number): number {
  for (const i of IMPACTS) {
    const d = f - i
    const v = [0.45, 0, 0.16, 0.34, 0.51, 0.66, 0.79, 0.89, 0.96][d + 1]
    if (v !== undefined) return v
  }
  return 1
}

const bellows = (f: number) => (f >= IN + 2 && f < IN + 10 ? Math.sin(((f - IN - 2) / 8) * Math.PI) : 0)

type Lamp = { x: number; y: number; power: number; radius: number }
function lightOf(lamps: readonly Lamp[], x: number, y: number): number {
  let sum = 0
  for (const l of lamps) sum += l.power * Math.max(0, 1 - Math.hypot(x - l.x, (y - l.y) * 1.2) / l.radius) ** 1.5
  return sum
}

type Spark = { x: number; y: number; vx: number; vy: number; life: number; born: number }
const SPARKS: Spark[] = (() => {
  const out: Spark[] = []
  IMPACTS.forEach((t, k) => {
    const rng = random(0x5ba4c + k * 977)
    for (let n = 0; n < 16; n++) {
      const a = -Math.PI / 2 + (rng() - 0.5) * 2.6
      const v = 1.2 + rng() * 1.8
      out.push({ x: 31 + (rng() - 0.5) * 4, y: 15.5, vx: Math.cos(a) * v * 1.3, vy: Math.sin(a) * v, life: 6 + Math.floor(rng() * 8), born: t })
    }
  })
  const rng = random(0xc0a1)
  for (let n = 0; n < 8; n++) {
    out.push({ x: 51 + rng() * 9, y: 13, vx: (rng() - 0.5) * 0.6, vy: -0.8 - rng() * 0.8, life: 6 + Math.floor(rng() * 6), born: IN + 3 + Math.floor(rng() * 6) })
  }
  return out
})()

type Puff = { x: number; born: number; r: number; drift: number }
const PUFFS: Puff[] = (() => {
  const rng = random(0x57ea)
  return Array.from({ length: 13 }, (_, n) => ({
    x: 3 + rng() * 10,
    born: SOAK + (n < 5 ? 0 : Math.floor((n - 4) * 1.4)),
    r: 1.6 + rng() * 1.2,
    drift: 0.15 + rng() * 0.3,
  }))
})()

const ANVIL_SHAPE: [number, number][] = [
  [12.5, 17.5], [22, 17.5], [41.5, 17.5], [41.5, 20.5], [37.5, 20.5], [35.5, 22.5], [35.5, 24], [39.5, 26.5],
  [22.5, 26.5], [26.5, 24], [26.5, 22.5], [24.5, 20.5], [21, 20], [16, 19],
]
const IN_ANVIL: ReadonlySet<number> = (() => {
  const c = new Canvas()
  c.poly(ANVIL_SHAPE, 1)
  const s = new Set<number>()
  c.px.forEach((v, i) => v && s.add(i))
  return s
})()

const vignette = (x: number, y: number) => (((x - 30) / 36) ** 2 + ((y - 16) / 22) ** 2) * 1.4

function render(): Int32Array[] {
  const out: Int32Array[] = []

  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const T = heat(f)
    const [bx, by] = barAt(f)
    const isUnder = f >= SOAK - 1 && f < OUT
    const impact = IMPACTS.includes(f) ? 1 : IMPACTS.includes(f - 1) ? 0.4 : 0
    const flash = [1, 0.5, 0.25, 0.1, 0.03].find((_, d) => IMPACTS.includes(f - d)) ?? 0
    const breath = bellows(f)
    const flicker = 0.5 + 0.25 * loopNoise(0, 0, f / LOOP, 12, 3)
    const lamps: Lamp[] = [
      { x: bx + BAR_LEN / 2, y: by + 1, power: T * T * (isUnder ? 0.3 : 1.15), radius: 34 },
      { x: 56, y: 14, power: flicker + breath * 0.7, radius: 30 },
      { x: 31, y: 16, power: flash * 1.4, radius: 44 },
    ]
    const lit = (x: number, y: number) => lightOf(lamps, x, y)

    for (let y = 0; y < 28; y++) {
      for (let x = 0; x < W; x++) {
        const row = Math.floor(y / 4)
        const bxk = Math.floor((x + (row % 2) * 4) / 8)
        const isMortar = y % 4 === 3 || (x + (row % 2) * 4) % 8 === 7
        const tone = hash(bxk, row) * 0.5
        c.set(x, y, shade(WALL, 0.9 + lit(x, y) * 4.6 - vignette(x, y) + tone - (isMortar ? 0.9 : 0)))
      }
    }
    for (const [x0, len] of [[8, 9], [10, 8]] as const) c.line(x0, 1, x0 + 1, len, (x, y) => shade(IRON, 1 + lit(x, y) * 4))
    for (const hx of [16, 21]) {
      for (const [dx, dy] of [[0, 1], [0, 2], [1, 3], [2, 3], [3, 2], [3, 1]] as const) {
        c.set(hx + dx, 3 + dy, shade(IRON, 1.2 + lit(hx + dx, 3 + dy) * 4.4 + (dx === 0 ? 0.6 : 0)))
      }
      c.set(hx + 1.5, 2, shade(IRON, 1 + lit(hx, 2) * 3))
    }

    for (let y = 28; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const isJoint = y === 28 || (x + (y > 29 ? 5 : 0)) % 11 === 0
        c.set(x, y, shade(WALL, 1.4 + lit(x, y) * 3.6 - vignette(x, y) * 0.8 - (isJoint ? 0.9 : 0) - (y - 28) * 0.15))
      }
    }

    c.poly([[45, 0], [64, 0], [64, 9], [49, 9]], (x, y) => shade(IRON, 1 + lit(x, y + 3) * 2.6 - (y === 8 ? -0.8 : 0)))
    for (let y = 16; y < 28; y++) {
      for (let x = 47; x < W; x++) {
        const isMortar = y % 3 === 0 || (x + (Math.floor(y / 3) % 2) * 2) % 4 === 0
        const top = y === 16 ? 1.4 : 0
        c.set(x, y, shade(BRICK, 0.8 + lit(x, y) * 2.4 + top - (isMortar ? 0.8 : 0) - (y - 16) * 0.08))
      }
    }
    const coalHeat = (x: number, y: number) => loopNoise(x * 0.5, y * 0.7, f / LOOP, 6, 7) * 0.7 + 0.45 + breath * 0.5
    const drawCoals = (isFront: boolean) => {
      for (let y = 13; y < 16; y++) {
        for (let x = 48; x < 63; x++) {
          const lump = hash(x >> 1, y, 5)
          if (isFront ? y < 15 || lump < 0.25 : y === 15) continue
          if (!isFront && y === 13 && lump < 0.5) continue
          const h = coalHeat(x, y)
          c.set(x, y, shade(HOT, 2 + h * 4.2 - (y - 13) * 0.3 + (lump > 0.8 ? 1 : 0)))
        }
      }
      if (isFront) return
      for (let x = 49; x < 62; x++) {
        const tall = loopNoise(x * 0.7, 0, f / LOOP, 9, 11) * (2 + breath * 3) - 0.4
        for (let k = 1; k <= Math.floor(tall); k++) c.set(x, 13 - k, shade(HOT, 7 - k * 1.2 + breath))
      }
    }
    drawCoals(false)

    for (let y = 21; y < 29; y++) {
      for (let x = 0; x < 15; x++) {
        const isHoop = y === 23 || y === 27
        const stave = x % 3 === 2 ? -0.5 : 0
        c.set(x, y, isHoop ? shade(IRON, 1.4 + lit(x, y) * 3.4) : shade(WOOD, 1 + lit(x, y) * 3.6 + stave - (x > 12 ? 0.6 : 0)))
      }
    }
    for (let x = 0; x < 15; x++) c.set(x, 21, shade(WOOD, 2.2 + lit(x, 21) * 3.6))

    for (let y = 26; y < 29; y++) {
      for (let x = 24; x < 38; x++) c.set(x, y, shade(WOOD, 1.2 + lit(x, y) * 3 - (x > 35 ? 0.6 : 0) + (y === 26 ? 0.6 : 0)))
    }
    for (const key of IN_ANVIL) {
      const x = key % W
      const y = Math.floor(key / W)
      const isFace = !IN_ANVIL.has(key - W)
      const isEdge = !IN_ANVIL.has(key - 1)
      const l = lit(x, y)
      c.set(x, y, shade(IRON, 1.6 + l * (isFace ? 6.5 : 3) + (isFace ? 1.2 : 0) + (isEdge ? l * 1.5 : 0) - (y > 21 ? 0.4 : 0)))
    }

    const drawBar = () => {
      for (let k = 0; k < BAR_LEN; k++) {
        for (let t = 0; t < 2; t++) {
          const x = Math.round(bx) + k
          const y = Math.round(by) + t
          const dent = impact > 0 && Math.abs(x - 31) < 2 && t === 0 && !isUnder
          if (dent) continue
          const edge = k === 0 || k === BAR_LEN - 1 ? -0.6 : 0
          const glow = isUnder ? T * 6 : 1 + T * 6.3 + (impact === 1 ? 1.5 : 0)
          c.set(x, y, shade(HOT, glow + edge + (t === 0 ? 0.7 : 0) + lit(x, y) * (T < 0.2 ? 1.6 : 0)))
        }
      }
      const jx = Math.round(bx) - 1
      const jy = Math.round(by)
      for (const off of [0, 1]) c.line(jx + off, jy + off, jx - 7 + off, jy - 22, (x, y) => shade(IRON, 1.6 + lit(x, y) * 3.4 + (off ? 0 : 0.8)))
      c.set(jx, jy + 1, shade(IRON, 2 + lit(jx, jy) * 3))
    }
    if (!isUnder) drawBar()
    drawCoals(true)

    const waterTop = 22
    for (let x = 0; x < 14; x++) {
      for (let y = waterTop; y < 24; y++) {
        const isOver = isUnder && y === waterTop && x >= bx && x < bx + BAR_LEN && T > 0.08
        c.set(x, y, isOver ? shade(HOT, 2 + T * 6 - (x === bx || x === bx + BAR_LEN - 1 ? 1 : 0)) : shade(WATER, 1 + lit(x, y) * 2.4 + (y === waterTop ? 1 : 0)))
      }
    }
    if (isUnder) {
      const jx = Math.round(bx) - 1
      for (const off of [0, 1]) c.line(jx + off - 1, waterTop - 1, jx - 7 + off, Math.round(by) - 22, (x, y) => shade(IRON, 1.6 + lit(x, y) * 3.4 + (off ? 0 : 0.8)))
    }
    if (f === SOAK || f === SOAK + 1) {
      for (const [dx, dy] of [[-1, -2], [2, -3], [5, -2], [8, -3], [11, -2]] as const) {
        c.set(2 + dx, waterTop + dy - (f - SOAK) * 2, at(STEAM, 5))
      }
    }
    if (f >= SOAK && f < OUT) {
      for (let k = 0; k < 6; k++) {
        const x = 2 + Math.floor(hash(k, f, 9) * 11)
        if (hash(k, f, 10) < 0.6) c.set(x, waterTop, at(STEAM, 5))
        if (hash(k, f, 11) < 0.3) c.set(x, waterTop - 1, at(STEAM, 4))
      }
    }

    const a = raised(f)
    const hx = lerp(42, 45, a)
    const hy = lerp(11.5, 7.5, a)
    const ang = lerp(170, 216, a) * (Math.PI / 180)
    const ux = Math.cos(ang)
    const uy = Math.sin(ang)
    const headX = hx + ux * 11
    const headY = hy + uy * 11
    const ex = hx + 11
    const ey = hy - 4.5
    for (let k = -1; k <= 1; k++) {
      c.line(hx + 1, hy + k, ex, ey + k, (x, y) => shade(SKIN, 2 + lit(x, y) * 3.4 - k * 0.9))
      c.line(ex, ey + k - 0.5, 64, ey - 5 + k, (x, y) => shade(WOOD, 0.6 + lit(x, y) * 2.6 - k * 0.6))
    }
    c.line(ex, ey - 2, ex, ey + 2, (x, y) => shade(WOOD, 2 + lit(x, y) * 2.6))
    c.line(hx, hy, headX, headY, (x, y) => shade(WOOD, 3 + lit(x, y) * 3.4))
    c.rect(hx - 1, hy - 1, 3, 3, (x, y) => shade(SKIN, 1.6 + lit(x, y) * 3.4 + (y < hy ? 0.9 : 0) - (x > hx ? 0.6 : 0)))
    const px = -uy
    const py = ux
    const head: [number, number][] = [
      [headX - ux * 2 - px * 3, headY - uy * 2 - py * 3],
      [headX + ux * 1.6 - px * 3, headY + uy * 1.6 - py * 3],
      [headX + ux * 1.6 + px * 3, headY + uy * 1.6 + py * 3],
      [headX - ux * 2 + px * 3, headY - uy * 2 + py * 3],
    ]
    c.poly(head, (x, y) => {
      const along = (x - headX) * px + (y - headY) * py
      const face = along > 1.9 ? 2 : along < -2 ? 0.6 : 0
      return shade(IRON, 2.8 + lit(x, y) * 4 + face + ((x - headX) * ux + (y - headY) * uy < -1 ? 0.8 : 0))
    })

    if (impact === 1) {
      for (const [dx, dy, l] of [[0, 0, 9], [-1, 0, 8], [1, 0, 8], [-2, 0, 7], [2, 0, 7], [0, -1, 8], [-3, -1, 6], [3, -1, 6], [-4, 0, 5], [4, 0, 5]] as const) {
        c.set(31 + dx, 16 + dy, at(HOT, l))
      }
    }
    for (const s of SPARKS) {
      const t = f - s.born
      if (t < 0 || t >= s.life) continue
      let x = s.x
      let y = s.y
      let vx = s.vx
      let vy = s.vy
      for (let k = 0; k < t; k++) {
        x += vx
        y += vy
        vy += 0.22
        vx *= 0.94
        if (y > 28.5 && vy > 0) {
          y = 28.5
          vy *= -0.35
          vx *= 0.6
        }
      }
      const life = 1 - t / s.life
      const level = 3.5 + life * 5
      if (Math.hypot(vx, vy) > 0.8) c.set(x - vx * 0.6, y - vy * 0.6, shade(HOT, level - 2))
      c.set(x, y, shade(HOT, level))
    }

    for (const p of PUFFS) {
      const t = f - p.born
      if (t < 0 || t > 16) continue
      const age = t / 16
      const cx = p.x + t * p.drift
      const cy = 21 - t * 1.3 + age * age * 4
      const r = p.r + t * 0.34
      const alpha = (1 - age) ** 1.2 * Math.min(1, (t + 1) / 2)
      const reach = Math.min(0.9, (t + 1) * 0.35, (1 - age) * 2.4)
      for (let y = Math.floor(cy - r); y <= cy + r; y++) {
        for (let x = Math.floor(cx - r); x <= cx + r; x++) {
          const d = Math.hypot(x - cx, (y - cy) * 1.1) / r
          const density = alpha * (1.15 - d * d)
          if (d > reach) continue
          c.set(x, y, shade(STEAM, 0.6 + density * 4.6 + (y < cy ? 0.4 : 0) + lit(x, y) * 0.8))
        }
      }
    }

    out.push(c.px)
  }

  return out
}

export const scene: Scene = {
  verb: 'Forging',
  render,
  hero: 18,
  snaps: [
    ...IMPACTS.map(f => ({ frames: f, why: 'the blow: a white flash where the hammer meets the bar lights the whole smithy, then dies away' })),
    { frames: SOAK, box: [0, 17, 14, 22], why: 'the hiss: the hot bar goes into the water and steam spits up off the tub' },
  ],
}
