import { Canvas, TAU, beat, ease, hex, loopNoise, mod, shade, smoothstep, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const DUSK = hex('1a1033 2e1544 4a1c50 74264f a0344b cc5240 e87c42 f6ac5c fdd890')
const SUN = hex('fbc66c feea9e fffbe0')
const SEA = hex('110a22 1b1032 291644 3a1e52 532a5e 723a66 965070')
const GLINT = hex('e87c42 f8b660 ffe6a0 fffbe6')
const ROCK = hex('0a0610 120a18 1b1022 26162c 361e34 4c283a 6e3640 a04e42')
const GRASS = hex('0e0a12 1a1418 2c2018 4a3020 7a4a28')
const FIG = hex('0c0610 170c1a 241322')
const RIM = hex('7a3a3c c4664a f29a5a')
const SCARF = hex('1c0814 34101e 5a1626 a03430')

const HORIZON = 16
const SUN_X = 44
const SUN_R = 5.6
const EDGE_Y = 19

type Band = { y: number; period: number; bumps: [number, number, number][] }
const BANDS: Band[] = [
  { y: 4.5, period: 64, bumps: [[6, 11, 1.6], [26, 8, 1.1], [44, 13, 1.9], [60, 5, 0.8]] },
  { y: 9.5, period: 64, bumps: [[14, 9, 1.0], [36, 6, 0.7], [52, 10, 1.2]] },
  { y: 14, period: 32, bumps: [[8, 7, 0.8], [24, 5, 0.6]] },
]
function cloudAt(b: Band, x: number, y: number, f: number): number {
  const off = Math.round((f * b.period) / LOOP)
  const u = mod(x + off, b.period)
  let t = 0
  for (const [c, half, h] of b.bumps) {
    const d = mod(u - c + b.period / 2, b.period) - b.period / 2
    t = Math.max(t, h * (1 - (d / half) ** 2))
  }
  const cy = b.y + 0.6 * Math.sin((u / b.period) * TAU)
  const dy = y - cy
  if (t < 0.35 || dy < -t * 0.7 || dy > t * 0.45) return 0
  return dy > t * 0.45 - 1 ? 2 : 1
}

function faceX(y: number): number {
  if (y < EDGE_Y) return -1
  return [20, 20, 21, 21, 20, 20, 21, 22, 22, 22, 23, 24, 26][y - EDGE_Y] ?? 26
}

const BODY_REST = [
  '...###....',
  '..#####...',
  '...###....',
  '...ss.....',
  '..####....',
  '..#####...',
  '..######..',
  '..###.##..',
  '..###..#..',
  '..########',
  '.########.',
]
const BODY_UP = [
  '....###...',
  '..#####...',
  '...##.....',
  ...BODY_REST.slice(3),
]
const FIG_X = 12
const FIG_Y = 8

function gullA(f: number): [number, number, number] | null {
  const x = Math.round(68 - (f - 14) * 1.03)
  if (x < -6 || x > 66) return null
  const y = Math.round(6 + 1.5 * Math.sin((f - 14) * 0.08))
  const flap = (f >= 14 && f < 30) || (f >= 66 && f < 74) ? [0, 1, 2, 1][Math.floor(f / 2) % 4] ?? 1 : 1
  return [x, y, flap]
}
const GULL = [
  ['x...x', '.x.x.', '..x..'],
  ['.x.x.', 'x.x.x'],
  ['..x..', '.x.x.', 'x...x'],
]

function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()

    for (let y = 0; y < HORIZON; y++) {
      for (let x = 0; x < W; x++) {
        const d = Math.hypot((x - SUN_X) * 0.8, (y - HORIZON) * 1.3)
        const glow = 2.4 * Math.max(0, 1 - d / 30) ** 1.6
        let level = 0.4 + (y / HORIZON) * 4.6 + glow
        let cloud = 0
        for (const b of BANDS) cloud = Math.max(cloud, cloudAt(b, x, y, f))
        if (cloud) level = cloud === 2 ? level + 1.6 : level - 1.4 - (y > 11 ? 0.6 : 0)
        c.set(x, y, shade(DUSK, level))
      }
    }
    c.set(7, 2, shade(DUSK, 7 + wave(f, LOOP, 2) * 0.9))

    for (let y = HORIZON - 7; y < HORIZON; y++) {
      for (let x = SUN_X - 7; x <= SUN_X + 7; x++) {
        const d = Math.hypot(x - SUN_X, y - HORIZON + 0.5)
        if (d > SUN_R) continue
        const band = cloudAt(BANDS[2] ?? BANDS[0]!, x, y, f)
        if (band === 1) {
          c.set(x, y, shade(DUSK, 5))
          continue
        }
        c.set(x, y, shade(SUN, d > SUN_R - 1 ? 0 : d > 2.6 ? 1 : 2))
      }
    }
    for (let x = 52; x < W; x++) {
      const top = Math.round(HORIZON - 1 - Math.min(3, (x - 52) * 0.35) + (x > 59 ? (x - 59) * 0.3 : 0))
      for (let y = top; y < HORIZON; y++) c.set(x, y, shade(DUSK, 3.2 - (y === top ? 0 : 0.4)))
    }

    for (let y = HORIZON; y < H; y++) {
      const depth = y - HORIZON
      const half = 2.2 + depth * 0.62
      for (let x = 0; x < W; x++) {
        const swell = loopNoise(x * 0.12, y * 0.9, f / LOOP, 2, 4) > 0.58 ? 0.6 : 0
        const near = Math.max(0, 1 - Math.abs(x - SUN_X) / (half * 2.2))
        const level = 5.2 - depth * 0.3 + near * 1.6 + swell - (depth === 0 ? -0.4 : 0)
        c.set(x, y, shade(SEA, level))
        const off = Math.abs(x - SUN_X) / half
        if (off > 1) continue
        const n = loopNoise(x * (0.42 - depth * 0.012), y * 1.3, f / LOOP, 5, 9)
        const bar = 0.5 + off * 0.32 - (depth < 2 ? 0.25 : 0)
        if (n > bar + 0.12) c.set(x, y, GLINT[off < 0.35 ? 3 : 2] ?? 0)
        else if (n > bar) c.set(x, y, GLINT[off < 0.5 ? 1 : 0] ?? 0)
      }
    }

    const surge = 0.5 + 0.5 * wave(f, LOOP, 3, 0.1)
    for (let y = 28; y < H; y++) {
      const reach = Math.round(1 + surge * 2.4 - (y - 28) * 0.3)
      const x0 = faceX(y) + 1
      for (let x = x0; x < x0 + reach; x++) c.set(x, y, shade(DUSK, x === x0 + reach - 1 ? 6 : 7.4))
    }
    for (const [x, y, k] of [[29, 29, 'rrr.'], [28, 30, 'rrrr'], [28, 31, 'rrrrr']] as const) {
      for (let i = 0; i < k.length; i++) if (k[i] === 'r') c.set(x + i, y, shade(ROCK, i === k.length - 1 || k[i + 1] !== 'r' ? 6.4 : 2.4))
    }
    const ring = Math.round(surge * 1.6)
    for (const y of [29, 30]) {
      c.set(27 - ring, y, shade(DUSK, 6.6))
      c.set(33 + ring - (y === 29 ? 1 : 0), y, shade(DUSK, 7))
    }

    for (let y = EDGE_Y; y < H; y++) {
      const fx = faceX(y)
      for (let x = 0; x <= fx; x++) {
        const ledge = fx > faceX(y - 1) && y > EDGE_Y
        const stratum = (y + Math.floor(x / 7)) % 3 === 0 && x % 7 !== 3 ? -0.7 : 0
        const level = x === fx ? (ledge ? 6.4 : 5.2) : x === fx - 1 ? 3.4 : 1.8 + stratum - (x < 6 ? 0.6 : 0) + (y === EDGE_Y ? 1.6 : 0)
        c.set(x, y, shade(ROCK, level))
      }
    }
    const gust = Math.round(0.5 + 0.5 * wave(f, LOOP, 4))
    for (let x = 0; x <= 19; x++) {
      const h = [1, 2, 1, 0, 2, 3, 1, 2, 0, 1, 1, 0, 0, 0, 0, 0, 1, 2, 1, 1][x] ?? 1
      for (let k = 1; k <= h; k++) {
        const lean = k === h && h > 1 ? -gust : 0
        c.set(x + lean, EDGE_Y - k, shade(GRASS, k === h ? 4 - (x < 8 ? 1 : 0) : 2.2))
      }
    }

    const look = smoothstep(52, 58, f) * (1 - smoothstep(72, 78, f))
    const body = look > 0.5 ? BODY_UP : BODY_REST
    const swing = ease.inOut(beat(f, 22, 30)) * (1 - ease.inOut(beat(f, 34, 44)))
    const legs: [number, number][] = [[20, 19], [21, 19], [20, 20], [21, 20], [20, 21], [21, 21]]
    const foot = Math.round(swing * 1.4)
    legs.push([20 + foot, 22], [21 + foot, 22], [22 + foot, 22])
    const isFig = (x: number, y: number) => {
      const row = body[y - FIG_Y]
      const ch = row?.[x - FIG_X]
      if (ch === '#' || ch === 's') return true
      return legs.some(([lx, ly]) => lx === x && ly === y)
    }
    const figPixels: [number, number, boolean][] = []
    body.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (row[i] === '#' || row[i] === 's') figPixels.push([FIG_X + i, FIG_Y + j, row[i] === 's'])
    })
    for (const [x, y] of legs) figPixels.push([x, y, false])
    for (const [x, y, isScarf] of figPixels) {
      const lit = !isFig(x + 1, y)
      const top = !isFig(x, y - 1)
      if (isScarf) c.set(x, y, shade(SCARF, lit ? 3 : top ? 2 : 1.2))
      else c.set(x, y, lit ? RIM[y < 12 ? 2 : 1] ?? 0 : top ? RIM[0] ?? 0 : FIG[x < 14 ? 0 : 1] ?? 0)
    }
    for (let k = 1; k <= 4; k++) {
      const y = FIG_Y + 3 + Math.round(Math.sin(TAU * ((f / LOOP) * 6) - k * 1.1) * (0.3 + k * 0.2))
      c.set(FIG_X + 3 - k, y, shade(SCARF, k === 4 ? 1.2 : 2 - k * 0.2 + (y < FIG_Y + 3 ? 1 : 0)))
    }

    const a = gullA(f)
    if (a) {
      const [gx, gy, pose] = a
      c.sprite(gx, gy, GULL[pose] ?? [], { x: FIG[0] ?? 0 })
    }
    const bx = Math.round(mod(70 - f * (78 / LOOP), 78) - 6)
    const by = 11 + Math.round(wave(f, LOOP, 1) * 0.6)
    const far = Math.floor(f / 3) % 4 < 2 ? ['x.x', '.x.'] : ['.x.', 'x.x']
    c.sprite(bx, by, far, { x: shade(DUSK, 1.4) })

    out.push(c.px)
  }

  return out
}

export const scene: Scene = { verb: 'Contemplating', render, hero: 60 }
