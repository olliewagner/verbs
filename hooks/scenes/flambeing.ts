import { Canvas, PALETTE, hex, random, shade, threshold, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 48

const WALL = PALETTE.plaster
const TILE = hex('150f1b 211727 30202f 452838 64323a 8b453e b2603f d58247 efab62')
const WOOD = PALETTE.wood
const STONE = PALETTE.stone
const METAL = PALETTE.metal
const FOOD = hex('6a3216 9c5524 cc8638 eab65a f8dc8c fff2c4')
const FIRE = PALETTE.fire
const SMOKE = PALETTE.smoke
const STEAM = PALETTE.steam
const BLUE = PALETTE.gas

type Light = { power: number; x: number; y: number; flash: number }

function lightOf(light: Light, x: number, y: number): number {
  const d = Math.hypot(x - light.x, (y - light.y) * 1.15)
  return light.power * Math.max(0, 1 - d / 50) ** 1.5 + light.flash * 0.5
}

const vignette = (x: number, y: number) => Math.round((((x - 32) / 34) ** 2 + ((y - 15) / 24) ** 2) * 1.6)

const GLASS = PALETTE.glass
const LABEL = hex('2a241c 4f4535 7d6c50 ab9670 d6c39a f2e6c4')
const BAND = hex('2e0b0d 5a1716 8a2622 b83d30 dc5c42')
const ORANGE = PALETTE.orange
const LEAF = hex('15261a 23402a 386436 568f44')

type Part = 'glass' | 'liquid' | 'label' | 'band' | 'cork' | 'orange' | 'leaf'

const STILL_LIFE: ReadonlyMap<number, Part> = (() => {
  const parts = new Map<number, Part>()
  const put = (x: number, y: number, part: Part) => parts.set(y * W + x, part)
  put(15, 13, 'cork')
  put(15, 14, 'cork')
  for (let y = 15; y <= 17; y++) put(15, y, 'glass')
  for (let x = 14; x <= 16; x++) put(x, 18, 'glass')
  for (let x = 13; x <= 17; x++) put(x, 19, 'glass')
  for (let y = 20; y <= 26; y++) {
    for (let x = 12; x <= 18; x++) {
      const isLabel = y >= 22 && y <= 24 && x >= 13 && x <= 17
      put(x, y, isLabel ? (y === 23 ? 'band' : 'label') : y <= 20 ? 'glass' : 'liquid')
    }
  }
  for (const [x, y] of [[22, 24], [23, 24], [21, 25], [22, 25], [23, 25], [24, 25], [21, 26], [22, 26], [23, 26], [24, 26]] as const) {
    put(x, y, 'orange')
  }
  put(23, 23, 'leaf')
  put(24, 23, 'leaf')

  return parts
})()

const RAMPS: Record<Part, [readonly number[], number]> = {
  glass: [GLASS, 1.6], liquid: [GLASS, 3], label: [LABEL, 1.6], band: [BAND, 1.4],
  cork: [WOOD, 2.2], orange: [ORANGE, 2.2], leaf: [LEAF, 0.8],
}

const COUNTER_Y = 27

const PAN_X0 = 35
const PAN_X1 = 46
const BASE_Y = 19

function size(f: number): number {
  if (f < 12 || f > 29) return 0
  if (f < 14) return 0.75 + (f - 12) * 0.15
  if (f < 18) return 1
  return Math.max(0, 1 - (f - 18) / 11) ** 1.15
}

type Tongue = { x: number; width: number; height: number; speed: number; phase: number }
const TONGUES: Tongue[] = [
  { x: 40.5, width: 4.6, height: 17, speed: 1.3, phase: 0 },
  { x: 37.5, width: 2.8, height: 12, speed: 1.9, phase: 1.7 },
  { x: 43.5, width: 2.8, height: 13, speed: 1.6, phase: 3.1 },
  { x: 36, width: 1.8, height: 7, speed: 2.4, phase: 4.4 },
  { x: 45, width: 1.8, height: 8, speed: 2.2, phase: 0.9 },
]

function flame(f: number, x: number, y: number): number {
  const s = size(f)
  if (s === 0 || y > BASE_Y) return 0
  let t = 0
  for (const g of TONGUES) {
    const h = g.height * s * (0.78 + 0.22 * Math.sin(f * g.speed + g.phase))
    const v = (BASE_Y + 0.5 - y) / h
    if (v < 0 || v > 1) continue
    const c = g.x + Math.sin(f * 0.8 + g.phase + v * 2.2) * 1.6 * v * v
    const half = g.width * Math.min(1, 0.6 + v * 2.2) * (1 - v) ** 0.85
    const d = Math.abs(x - c) / Math.max(0.35, half)
    if (d > 1) continue
    t = Math.max(t, (1 - d * d) * (1 - v ** 1.3))
  }

  return t
}

type Lick = { x: number; y: number; r: number; age: number }
type Ember = { x: number; y: number; vx: number; vy: number; age: number; life: number; phase: number }
type Puff = { x: number; y: number; r: number; age: number; life: number }

function render(): Int32Array[] {
  const rng = random(0xf1a3be)
  const embers: Ember[] = []
  const puffs: Puff[] = []
  const licks: Lick[] = []
  const out: Int32Array[] = []

  for (let f = 0; f < LOOP; f++) {
    let total = 0
    let top = BASE_Y
    for (let y = 0; y <= BASE_Y; y++) {
      for (let x = 28; x < 54; x++) {
        const t = flame(f, x, y)
        total += t
        if (t > 0.05) top = Math.min(top, y)
      }
    }
    const flash = f === 12 ? 1.4 : f === 13 ? 0.7 : f === 14 ? 0.3 : f === 15 ? 0.1 : 0
    const flicker = 0.95 + 0.05 * Math.sin(f * 0.9)
    const light: Light = {
      power: 1.3 * size(f) * flicker + flash * 0.4,
      x: 40.5,
      y: BASE_Y - 5 * size(f),
      flash,
    }

    const mask = STILL_LIFE
    const sdx = Math.round((15 - light.x) * 0.22)
    const sdy = Math.round((21 - light.y) * 0.2)
    const isShadow = (x: number, y: number) => light.power > 0.05 && mask.has((y - sdy) * W + x - sdx)

    const c = new Canvas()
    for (let y = 0; y < COUNTER_Y; y++) {
      for (let x = 0; x < W; x++) {
        const lit = lightOf(light, x, y) * (isShadow(x, y) ? 0.12 : 1)
        const v = vignette(x, y)
        if (y < 9) {
          c.set(x, y, shade(WALL, 2 + lit * 4.2 - v, x, y))
          continue
        }
        const row = Math.floor((y - 9) / 4)
        const tx = (x + (row % 2) * 3) % 6
        const isGrout = tx === 0 || (y - 9) % 4 === 0
        const isGlint = !isGrout && tx === 1 && (y - 9) % 4 === 1
        c.set(x, y, shade(TILE, 2 + lit * 4.6 - v - (isGrout ? 1 : 0) + (isGlint ? lit * 2 : 0), x, y))
      }
    }
    for (let x = 1; x < 31; x++) {
      c.set(x, 6, shade(WOOD, 2 + lightOf(light, x, 6) * 4 - vignette(x, 6), x, 6, false))
      c.set(x, 7, shade(WOOD, 0.5 + lightOf(light, x, 7) * 2, x, 7, false))
    }
    for (const bx of [5, 26]) c.set(bx, 8, shade(WOOD, 1 + lightOf(light, bx, 8) * 2, bx, 8, false))
    const jars: [number, number, number, number][] = [
      [3, 2, 4, 4], [9, 1, 2, 5], [14, 3, 5, 3], [22, 2, 3, 4], [27, 3, 2, 3],
    ]
    for (const [jx, jy, jw, jh] of jars) {
      for (let y = jy; y < jy + jh; y++) {
        for (let x = jx; x < jx + jw; x++) {
          const lit = lightOf(light, x, y)
          const edge = x === jx + jw - 1 ? lit * 2.5 : 0
          c.set(x, y, shade(TILE, 2.4 + lit * 4.5 + edge - vignette(x, y), x, y, false))
        }
      }
      c.set(jx, jy - 1, shade(WOOD, 2 + lightOf(light, jx, jy) * 4, jx, jy - 1, false))
      if (jw > 2) c.set(jx + 1, jy - 1, shade(WOOD, 2 + lightOf(light, jx, jy) * 4, jx + 1, jy - 1, false))
    }
    for (let y = 1; y < 10; y++) c.set(55, y, shade(METAL, 1.5 + lightOf(light, 55, y) * 5, 55, y, false))
    for (const [x, y] of [[54, 10], [55, 10], [56, 10], [54, 11], [55, 11], [56, 11], [55, 12]] as const) {
      c.set(x, y, shade(METAL, 1.8 + lightOf(light, x, y) * 5 + (x === 54 ? 1 : 0), x, y, false))
    }
    for (let y = 1; y < 6; y++) c.set(60, y, shade(METAL, 1.5 + lightOf(light, 60, y) * 5, 60, y, false))
    for (const [x, y] of [[59, 6], [61, 6], [58, 7], [62, 7], [58, 8], [60, 8], [62, 8], [59, 9], [61, 9], [60, 10]] as const) {
      c.set(x, y, shade(METAL, 1.6 + lightOf(light, x, y) * 5, x, y, false))
    }
    for (let x = 0; x < W; x++) {
      c.set(x, COUNTER_Y, shade(STONE, 3 + lightOf(light, x, COUNTER_Y) * 4 - vignette(x, COUNTER_Y), x, COUNTER_Y))
      for (let y = COUNTER_Y + 1; y < H; y++) {
        const lip = y === COUNTER_Y + 1 ? -1 : 0
        c.set(x, y, shade(STONE, 1.4 + lightOf(light, x, y) * 2.2 - vignette(x, y) + lip, x, y))
      }
    }

    for (let x = 32; x <= 47; x++) {
      c.set(x, 24, shade(METAL, 3.4 + lightOf(light, x, 24) * 2.5, x, 24, false))
      for (let y = 25; y <= 26; y++) c.set(x, y, shade(METAL, 1.3 + lightOf(light, x, y) * 1.5 - (y - 25) * 0.6, x, y, false))
    }
    c.set(45, 25, 0xd8503e)
    c.set(45, 26, 0x7a2a26)
    for (const gx of [33, 39, 40, 46]) c.set(gx, 23, shade(METAL, 2.4 + lightOf(light, gx, 23) * 2, gx, 23, false))
    for (let x = 34; x <= 45; x++) {
      if (x === 39 || x === 40) continue
      const n = Math.sin(x * 1.7 + f * 2.1) + Math.sin(x * 0.6 - f * 1.3)
      c.set(x, 23, shade(BLUE, 1.4 + n * 0.5, x, 23, false))
      if (n > 0.6) c.set(x, 22, shade(BLUE, 2 + n * 0.6, x, 22, false))
    }

    for (const [key, part] of mask) {
      const x = key % W
      const y = Math.floor(key / W)
      const lit = lightOf(light, x, y)
      const rim = mask.get(key + 1) === undefined ? lit * 1.4 : 0
      const shadowSide = mask.get(key - 1) === undefined ? -0.5 * Math.min(1, lit * 2) : 0
      const [ramp, base] = RAMPS[part]
      const glint = (part === 'glass' || part === 'liquid') && x === 17 && (y === 19 || y === 21) ? lit * 4 : 0
      const spec = (part === 'glass' || part === 'liquid') && x === 18 ? lit * 1.6 : 0
      const round = part === 'orange' ? (y === 24 ? 0.9 : y === 26 ? -0.9 : 0) + (x === 23 && y === 24 ? 1.2 : 0) + (x === 21 ? -0.5 : 0) : 0
      c.set(x, y, shade(ramp, base + lit * 3.6 + rim + shadowSide + glint + spec + round, x, y, false))
    }

    const armY = 21
    for (let x = 26; x <= 33; x++) {
      c.set(x, armY, shade(WOOD, 3.2 + lightOf(light, x, armY) * 3, x, armY, false))
    }
    c.set(33, armY - 1, shade(METAL, 2.6 + lightOf(light, 33, armY) * 3, 33, armY - 1, false))
    for (let x = 34; x <= 47; x++) {
      const rimY = 20
      const lit = lightOf(light, x, rimY)
      c.set(x, rimY, shade(METAL, 4.2 + lit * 3.6 + (x === 34 ? -0.8 : 0), x, rimY, false))
      c.set(x, rimY + 1, shade(METAL, 2 + lit * 2.2 - (x - 34) * 0.05, x, rimY + 1, false))
      if (x > 34 && x < 47) c.set(x, rimY + 2, shade(METAL, 1.1 + lit * 1.4, x, rimY + 2, false))
    }
    for (let x = 36; x <= 45; x++) {
      const y = 19
      const lit = lightOf(light, x, y) + (size(f) > 0 ? 0.5 : 0)
      c.set(x, y, shade(FOOD, 2 + lit * 2.5 + ((x * 7) % 3 === 0 ? 0.6 : 0), x, y, false))
      if (x === 37 || x === 38 || x === 42 || x === 43) {
        c.set(x, y - 1, shade(FOOD, 2.8 + lit * 2.5 + (x % 2 ? 0.7 : 0), x, y - 1, false))
      }
    }
    if (f === 10 || f === 11) {
      for (const [x, y, l] of [[47, 20, 5.5], [47, 19, 6.8], [48, 20, 4.5], [46, 19, 6], [47, 18, f === 11 ? 7.8 : 0]] as const) {
        if (l > 0) c.set(x, y + 1, shade(FIRE, l, x, y, false))
      }
    }

    const calm = f < 8 ? 1 : f < 11 ? (11 - f) / 3 : f >= 38 ? Math.min(1, (f - 38) / 5) : 0
    for (const [wi, wx] of [37, 40, 43].entries()) {
      for (const lag of [0, 4]) {
        const p = ((f + wi * 3 + lag) % 8) / 8
        const y = 17 - p * 8
        const x = wx + Math.sin(p * 5 + wi * 2) * 1.1
        const alpha = Math.sin(p * Math.PI) * calm
        for (const dy of [0, 1]) {
          if (alpha * (dy ? 0.6 : 1) > threshold(Math.round(x), Math.round(y + dy))) {
            c.set(x, y + dy, shade(STEAM, 1 + alpha * 2.4 - dy * 0.6, Math.round(x), Math.round(y + dy), false))
          }
        }
      }
    }

    for (let y = 0; y <= BASE_Y; y++) {
      for (let x = 28; x < 54; x++) {
        const t = flame(f, x, y)
        if (t <= 0) continue
        c.set(x, y, shade(FIRE, 1.2 + t * 8.2, x, y, false))
      }
    }
    if (size(f) > 0.3 && f % 2 === 0) {
      licks.push({ x: 39 + rng() * 4, y: top - 1, r: 1.6 * size(f), age: 0 })
    }
    for (const l of licks) {
      if (l.r <= 0.3) continue
      for (let y = Math.floor(l.y - l.r); y <= Math.ceil(l.y + l.r); y++) {
        for (let x = Math.floor(l.x - l.r); x <= Math.ceil(l.x + l.r); x++) {
          const d = Math.hypot(x - l.x, (y - l.y) * 0.8) / l.r
          if (d < 1) c.set(x, y, shade(FIRE, 2.5 + (1 - d) * 3.5 + l.r, x, y, false))
        }
      }
      l.y -= 1.6
      l.x += Math.sin(l.age * 1.3) * 0.5
      l.r -= 0.45
      l.age++
    }

    if (f >= 12 && f <= 24) {
      for (let n = f < 16 ? 2 : f % 2; n > 0; n--) {
        embers.push({
          x: 35 + rng() * 10, y: top + 1 + rng() * 4,
          vx: (rng() - 0.5) * 1.4, vy: -0.6 - rng() * 1.1,
          age: 0, life: 7 + Math.floor(rng() * 8), phase: rng() * 6,
        })
      }
    }
    for (const e of embers) {
      if (e.age >= e.life) continue
      const t = e.age / e.life
      const level = 8 - t * 5
      if (Math.hypot(e.vx, e.vy) > 0.9) c.set(e.x - e.vx * 0.8, e.y - e.vy * 0.8, shade(FIRE, level - 2.5, 0, 0, false))
      c.set(e.x, e.y, shade(FIRE, level, 0, 0, false))
      e.x += e.vx + Math.sin(e.age * 0.8 + e.phase) * 0.35
      e.y += e.vy
      e.vy *= 0.95
      e.vx *= 0.97
      e.age++
    }

    if (f >= 23 && f <= 34 && f % 3 === 2) {
      puffs.push({ x: 40 + (rng() - 0.5) * 2, y: 17, r: 1.2, age: 0, life: 10 + Math.floor(rng() * 3) })
    }
    for (const p of puffs) {
      if (p.age >= p.life) continue
      const t = p.age / p.life
      const alpha = 1.05 * (1 - t) * Math.min(1, (p.age + 1) / 2)
      for (let y = Math.floor(p.y - p.r); y <= Math.ceil(p.y + p.r); y++) {
        for (let x = Math.floor(p.x - p.r); x <= Math.ceil(p.x + p.r); x++) {
          const d = Math.hypot(x - p.x, (y - p.y) * 1.2) / p.r
          const density = alpha * (1.15 - d * d)
          if (d > 1 || density < 0.18 || (density < 0.42 && ((x + y) & 1) === 1)) continue
          c.set(x, y, shade(SMOKE, 1.2 + density * 2.6 + lightOf(light, x, y) * 1.5, x, y, false))
        }
      }
      p.x += Math.sin(p.age * 0.55 + p.life) * 0.45
      p.y -= 1
      p.r += 0.22
      p.age++
    }

    if (f === 12 || f === 13) {
      const r = f === 12 ? 5 : 8
      for (let y = 4; y < 26; y++) {
        for (let x = 28; x < 52; x++) {
          const d = Math.hypot(x - 39.5, (y - 15) * 1.1)
          if (f === 12 && d < r) c.set(x, y, shade(FIRE, 8.6 - d * 0.5, x, y))
          if (f === 13 && d > r - 1.5 && d < r && threshold(x, y) < 0.6) c.set(x, y, shade(FIRE, 6.5, x, y, false))
        }
      }
      if (f === 12) {
        for (let k = 1; k <= 3; k++) {
          for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
            c.set(39.5 + dx * (r + k), 15 + dy * (r + k) * 0.8, FIRE[7] ?? 0)
          }
        }
      }
    }

    out.push(c.px)
  }

  return out
}

export const scene: Scene = {
  verb: 'Flambéing',
  render,
  hero: 16,
  snaps: [
    { frames: [12, 15], why: 'the brandy catches: a white flash lights the whole kitchen and decays over three frames' },
    { frames: [16, 29], why: 'the flambé fire lights the whole room, and its light swells and fades with the flames' },
  ],
}
