import { beat, clamp, frames, hash, hex, mix, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 64

const SKY = hex('04061a 080c26 0d1334 131b44 1a2454 222f66 2b3b78 36488a 42569a')
const FAR = hex('0a1030 0f163a 141c46 1b2552')
const FIELD = hex('05090f 080e16 0c141d 111b25 16222c 1c2a33')
const HILL = hex('020409 05080f 0a0f19 101826 1a2638')
const TOWER = hex('010207 04060e 0a0e1c 1c2440 3c4c78 7e92c4')
const RING = hex('06283a 0a4a62 0e7690 16a8c0 3cd8e6 98f6fa eaffff')
const WIN = hex('2a1a12 5a3418 9a5c20 dc9030 f8bf52 ffe48e fffbe6')
const BEACON = hex('3a0810 7a1018 c41c1e f43a2c ff8a6a ffe2d6')
const STAR = hex('2a3460 5260a0 9aa8e0 e6ecff')
const MOON = hex('5a6488 98a0bc d8dcea f6f6fa')
const ROOF = hex('020409 05080f 0a0f1a 121a2a 1e2a40')
const WALL = hex('0c1220 162036 24304e 3a4a70 5a6c96')

const TX = 15
const TIP_Y = 1
const BASE = 16
const EMIT = 6

const HORIZON = 18
const hillY = (x: number) => BASE - 0.4 + ((x - TX) / 9) ** 2 * 2.2
const farY = (x: number) => 16.4 + Math.sin(x * 0.09 + 1) * 0.8 + Math.sin(x * 0.23 + 2) * 0.4
const MOON_AT = [54, 6] as const

function radius(f: number): number {
  if (f < EMIT) return -99
  return 72 * (1 - (1 - beat(f, EMIT, EMIT + 36)) ** 1.6)
}

const groundDistance = (x: number, y: number) => Math.hypot(x - TX, (y - BASE) * 3)

type House = { x: number; y: number; size: 'far' | 'mid' | 'near' }
const HOUSES: House[] = [
  { x: 25, y: 19, size: 'far' },
  { x: 36, y: 19, size: 'far' },
  { x: 47, y: 19, size: 'far' },
  { x: 59, y: 19, size: 'far' },
  { x: 1, y: 23, size: 'mid' },
  { x: 27, y: 23, size: 'mid' },
  { x: 49, y: 23, size: 'mid' },
  { x: 7, y: 31, size: 'near' },
  { x: 40, y: 31, size: 'near' },
]

const ART: Record<House['size'], string[]> = {
  far: ['.r.', 'rrr', 'wWw'],
  mid: ['..rrr..', '.rrrrr.', 'rrrrrrr', '.wWwWw.'],
  near: ['......c....', '...rrrrc...', '..rrrrrrr..', '.rrrrrrrrr.', 'rrrrrrrrrrr', '.wWWwwwWWw.', '.wWWwdwWWw.'],
}

function windowTimes(h: House, i: number): [number, number] {
  const d = groundDistance(h.x + ART[h.size][0]!.length / 2, h.y)
  let on = LOOP
  for (let f = EMIT; f < LOOP; f++) {
    if (radius(f) >= d) {
      on = f
      break
    }
  }
  return [on, 48 + Math.floor(hash(i, 3) * 14)]
}

function windowLevel(f: number, on: number, off: number): number {
  if (f < on || f > off) return 0
  const age = f - on
  if (age === 0) return 6
  if (age === 1) return 5.2
  if (f >= off - 1) return 2.6 - (off - f === 0 ? 1 : 0)
  return 5
}

type Layer = { kind: 'sky' | 'far' | 'field' | 'hill'; level: number }

const WORLD: Layer[] = (() => {
  const out: Layer[] = []
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (y >= hillY(x) && y < HORIZON + 1) {
        const isCrest = y - hillY(x) < 1
        out.push({ kind: 'hill', level: isCrest ? (x > TX ? 3 : 2) : 1 })
        continue
      }
      if (y < farY(x) && y < HORIZON) {
        const moon = Math.max(0, 1 - Math.hypot(x - MOON_AT[0], y - MOON_AT[1]) / 13) * 1.2
        out.push({ kind: 'sky', level: 0.3 + (y / HORIZON) * 7.6 + moon })
        continue
      }
      if (y < HORIZON) {
        out.push({ kind: 'far', level: y - farY(x) < 1 ? 2 : 1 })
        continue
      }
      const rows = [19.6, 21.6, 24.6, 28.4].map((r, k) => r + Math.sin(x * 0.11 + k * 1.9) * 0.7)
      const band = rows.filter(r => r <= y).length
      const isHedge = rows.some(r => Math.round(r) === y)
      const v = (y - HORIZON) / (H - HORIZON)
      out.push({ kind: 'field', level: isHedge ? 0.6 : 3.4 - v * 1.6 + (band % 2 ? 0.6 : 0) })
    }
  }
  return out
})()

const RAMP: Record<Layer['kind'], readonly number[]> = { sky: SKY, far: FAR, field: FIELD, hill: HILL }
const WASH = [0, 0.2, 0.4].map(t => ({ field: FIELD.map(c => mix(c, RING[3] ?? 0, t)), hill: HILL.map(c => mix(c, RING[3] ?? 0, t)) }))
const BAYER = [0.125, 0.625, 0.875, 0.375]

const RING_HALO = (c: number) => [mix(c, RING[3] ?? 0, 0.45), mix(c, RING[3] ?? 0, 0.25)]
const WAVE_SKY = [...RING, ...[...SKY, ...STAR, ...MOON].flatMap(RING_HALO)]

const WAVE_GROUND = [...RING, ...WASH.slice(1).flatMap(w => [...w.field, ...w.hill]), ...ROOF, ...WALL, ...WIN]

const STARS: [number, number, number][] = (() => {
  const out: [number, number, number][] = []
  for (let y = 0; y < 11; y++) {
    for (let x = 0; x < W; x++) {
      if (hash(x, y, 11) > 0.982 && Math.hypot(x - MOON_AT[0], y - MOON_AT[1]) > 6 && Math.abs(x - TX) > 5) out.push([x, y, hash(x, y, 12)])
    }
  }
  return out
})()

const TOWER_ART = [
  '.....#.....',
  '.....#.....',
  '....###....',
  '....#.#....',
  '....#.#....',
  '...#####...',
  '...##.##...',
  '...#.#.#...',
  '...##.##...',
  '..#######..',
  '..##...##..',
  '..#.#.#.#..',
  '.#...#...#.',
  '.#..#.#..#.',
  '###########',
]

function render(): Int32Array[] {
  const times = HOUSES.map((h, i) => windowTimes(h, i))

  return frames(LOOP, (c, f) => {
    const R = radius(f)
    const charge = f < EMIT ? beat(f, 1, EMIT) : 0
    const flash = f === EMIT ? 1 : f === EMIT + 1 ? 0.6 : f === EMIT + 2 ? 0.25 : 0
    const s = Math.round(clamp(1 - R / 90) * 4) / 4

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const layer = WORLD[y * W + x]
        if (!layer) continue
        if (layer.kind === 'sky') {
          const tip = Math.max(0, 1 - Math.hypot(x - TX, y - TIP_Y) / 12) * (flash * 3 + charge * 1.2)
          c.set(x, y, shade(SKY, layer.level + tip))
          continue
        }
        if (R < 0 || layer.kind === 'far') {
          c.set(x, y, shade(RAMP[layer.kind], layer.level))
          continue
        }
        const behind = R - groundDistance(x, y)
        const strength = clamp((60 - R) / 40) * (behind < 3.5 ? 2 : 1)
        const step = Math.floor(strength) + (strength % 1 > (BAYER[(y & 1) * 2 + (x & 1)] ?? 0) ? 1 : 0)
        const wash = behind > 0 && behind < 7 ? WASH[step] : undefined
        if (Math.abs(behind) < 0.9) c.set(x, y, shade(RING, 3.4 + s * 2.4))
        else c.set(x, y, shade(wash?.[layer.kind] ?? RAMP[layer.kind], layer.level))
      }
    }

    for (const [x, y, n] of STARS) {
      const tw = Math.sin((f / LOOP) * Math.PI * 2 * (1 + Math.floor(n * 3)) + n * 9)
      c.set(x, y, shade(STAR, (n > 0.8 ? 2 : 1) + tw * 0.7))
    }

    for (let y = 2; y <= 10; y++) {
      for (let x = 50; x <= 58; x++) {
        const inMoon = Math.hypot(x - MOON_AT[0], y - MOON_AT[1]) <= 3.2
        const bitten = Math.hypot(x - 52.6, y - 5.2) <= 2.9
        if (inMoon && !bitten) c.set(x, y, shade(MOON, x > 55 ? 3 : 2 - (y > 7 ? 1 : 0)))
      }
    }

    if (R > 0) {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (WORLD[y * W + x]?.kind !== 'sky') continue
          const d = Math.hypot(x - TX, y - TIP_Y)
          for (let k = 0; k < 3; k++) {
            const r = R - k * 5
            if (r < 1.5) continue
            const off = Math.abs(d - r)
            if (off < 0.6) {
              c.set(x, y, shade(RING, 3.6 + s * 2.6 - k * 1.1))
              break
            }
            if (k === 0 && off < 1.6) {
              c.set(x, y, mix(c.get(x, y), RING[3] ?? 0, s > 0.5 ? 0.45 : 0.25))
              break
            }
          }
        }
      }
    }

    HOUSES.forEach((h, i) => {
      const [on, off] = times[i] ?? [LOOP, 0]
      const lit = windowLevel(f, on, off)
      const art = ART[h.size]
      const top = h.y - art.length + 1
      const width = art[0]!.length
      const hit = 1.4 * clamp(1 - Math.abs(groundDistance(h.x + width / 2, h.y) - R) / 4)
      if (lit > 3) {
        const reach = h.size === 'near' ? 6 : h.size === 'mid' ? 3.5 : 2
        const gx = h.x + width / 2
        for (let y = top; y <= Math.min(H - 1, h.y + 3); y++) {
          for (let x = Math.floor(gx - reach - 1); x <= Math.ceil(gx + reach + 1); x++) {
            const d = Math.hypot((x - gx) / reach, (y - h.y) / 2.6)
            if (d < 1 && WORLD[y * W + x]?.kind === 'field') c.tint(x, y, WIN[3] ?? 0, d < 0.55 ? 0.3 : 0.16)
          }
        }
      }
      art.forEach((row, j) => {
        for (let k = 0; k < row.length; k++) {
          const ch = row[k]
          const x = h.x + k
          const y = top + j
          const isRight = row[k + 1] === undefined || row[k + 1] === '.'
          const isTop = j === 0 || art[j - 1]?.[k] !== 'r'
          if (ch === 'r' || ch === 'c') c.set(x, y, shade(ROOF, 1 + (isTop ? 1.4 : 0) + (isRight ? 1 : 0) + hit))
          if (ch === 'w' || ch === 'd') c.set(x, y, shade(WALL, (ch === 'd' ? 0.4 : 1.4) + (isRight ? 1 : 0) + hit + (lit > 3 ? 0.8 : 0)))
          if (ch === 'W') c.set(x, y, lit > 0 ? shade(WIN, lit - (j === art.length - 1 && h.size === 'near' ? 0.6 : 0)) : shade(WALL, 0.4 + hit))
        }
      })
    })

    const glow = f === EMIT + 3 ? 0.16 : flash
    const lift = (y: number) => Math.round((glow * 3.4 * clamp(1 - (y - TIP_Y) / 15) + charge * 1.6 * clamp(1 - (y - TIP_Y) / 6)) * 2) / 2
    TOWER_ART.forEach((row, j) => {
      const y = TIP_Y + 1 + j
      const right = row.lastIndexOf('#')
      for (let k = 0; k < row.length; k++) {
        if (row[k] !== '#') continue
        const level = k === right ? 3 : 1
        const l = lift(y)
        c.set(TX - 5 + k, y, l > 0.4 ? shade(RING, Math.min(6, level * 0.5 + l)) : shade(TOWER, level))
      }
    })
    const blink = f % 16 < 8 ? 3.4 : 1.6
    const beacon = flash > 0 ? 5 : charge > 0 ? 3 + charge * 2 : blink
    if (beacon >= 3) for (let y = 0; y <= 4; y++) for (let x = TX - 4; x <= TX + 4; x++) {
      const d = Math.hypot(x - TX, y - TIP_Y)
      if (d < 3.6 && WORLD[y * W + x]?.kind === 'sky') c.tint(x, y, BEACON[2] ?? 0, d < 2 ? 0.4 : 0.2)
    }
    c.set(TX, TIP_Y, shade(BEACON, beacon))
    const arm = flash > 0 ? RING[6] ?? 0 : shade(BEACON, beacon - 1.4)
    if (beacon >= 3) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1]] as const) c.set(TX + dx, TIP_Y + dy, arm)
    if (flash >= 0.5 || charge > 0.8) {
      for (const [dx, dy] of [[-2, 0], [2, 0], [0, -1], [-1, -1], [1, -1], [-1, 1], [1, 1]] as const) c.tint(TX + dx, TIP_Y + dy, RING[6] ?? 0, flash > 0 ? flash * 0.85 : 0.4)
    }
  })
}

export const scene: Scene = {
  verb: 'Propagating',
  render,
  hero: 19,
  snaps: [
    { frames: [EMIT, EMIT + 2], box: [8, 0, 22, 16], why: 'the pulse leaves the tip: a white flash lights the tower cyan and drains off it over three frames' },
    {
      frames: [EMIT + 3, EMIT + 22],
      box: [0, 0, W - 1, HORIZON - 1],
      colors: WAVE_SKY,
      why: 'the rings race out faster than they are wide, so each spot of sky lights for a frame as a ring sweeps over it',
    },
    {
      frames: [EMIT + 1, EMIT + 22],
      box: [0, BASE - 1, W - 1, H - 1],
      colors: WAVE_GROUND,
      why: 'the wave front races over the fields with its cyan wash behind it, striking each farmhouse and flashing its window on',
    },
  ],
}
