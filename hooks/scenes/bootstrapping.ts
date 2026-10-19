import { Canvas, PALETTE, beat, clamp, ease, frames, hex, lerp, lightAt, shade, wave, type Scene } from '../engine'

const W = 64
const H = 32

const BENCH_Y = 25
const LAMP = { x: 13, y: 6, power: 1.25, radius: 46 }

const WALL = hex('0c0e15 121621 1a1f2d 242838 313242 433d46 5c4c48 7c6048 9c7850')
const BOARD = hex('0c0e15 141720 1d1f2a 2a2830 3c3434 54443a 6e5640')
const WOOD = PALETTE.wood
const LEATHER = hex('1a0b0a 2c120e 461c14 66291a 883a22 a8502c c46c3a de9452 f4c084')
const TAN = hex('2e1a10 5a3418 8a5428 b67e40 d8a860 f0d090')
const SOLE = hex('0c090c 1c1418 2e2428 463a3a')
const DUSK = hex('1c2450 2c3a72 4c5a92 8a76a6 d49aa0 f2c4a0')
const RIM = hex('2a2032 3e3450 585478')
const BRASS = PALETTE.gold
const STEEL = hex('1a1c24 2e3240 4a5060 727a8a a8b0bc')
const THREAD = hex('3a0e18 6e1a26 a62c34 d8504a')
const DUST = hex('3c3434 5a4e48 7e6e62 a49280')

const glow = (x: number, y: number) => lightAt([LAMP], x, y)
const vignette = (x: number, y: number) => (((x - 32) / 38) ** 2 + ((y - 14) / 26) ** 2) * 1.6

const TUG_FROM = 9
const TUGS: readonly (readonly [number, number, number, number])[] = [
  [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 1, 0],
  [0, 0, 2, 0], [1, -1, 2, 0], [1, -1, 2, 0], [0, 0, 2, 0], [0, 1, 1, 0],
  [0, 0, 0, 1], [0, 0, 0, 1], [0, 0, 0, 0], [0, 0, 0, -1], [0, 0, 0, -1],
  [0, 1, 0, 0], [0, 1, 1, 0],
  [0, 0, 2, 0], [1, -1, 2, 0], [2, -1, 2, 0], [2, -1, 2, 0], [1, 0, 2, 0], [0, 0, 1, 0],
  [0, 0, 0, -1], [0, 0, 0, -1],
  [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 1, 0],
]
const RISE = TUG_FROM + TUGS.length - 1
const LAND = RISE + 22
const LOOP = LAND + 7
function liftAt(f: number): { y: number; squash: number } {
  if (f < TUG_FROM) return { y: 0, squash: 0 }
  const pose = TUGS[f - TUG_FROM]
  if (pose) return { y: pose[0], squash: pose[1] }
  if (f < RISE + 8) return { y: [1, 3, 5, 6, 6, 5, 5][f - RISE - 1] ?? 5, squash: f < RISE + 3 ? -1 : 0 }
  if (f < RISE + 17) return { y: 5 + Math.round(0.5 + 0.5 * wave(f - RISE - 8, 9, 1, 0.25)) - 1, squash: f >= RISE + 10 && f < RISE + 15 ? -1 : 0 }
  if (f < LAND) return { y: Math.round(5 * (1 - ease.inOut(beat(f, LAND - 6, LAND)))), squash: 0 }
  if (f < LAND + 2) return { y: 0, squash: 1 }
  return { y: 0, squash: 0 }
}
function strapAt(f: number): { p: number; tug: number } {
  const up = ease.out(beat(f, 4, 9))
  const down = ease.outBounce(beat(f, LAND, LAND + 5))
  const tug = TUGS[f - TUG_FROM]?.[2] ?? (f > RISE && f <= RISE + 2 ? 1 : 0)
  return { p: f < LAND ? up : 1 - down, tug }
}

function tiltAt(f: number): number {
  const pose = TUGS[f - TUG_FROM]
  if (pose) return pose[3]
  if (f >= RISE + 8 && f < RISE + 17) return Math.round(wave(f - RISE - 8, 9, 1) * 0.6)
  return 0
}
type Boot = { x: number; y: number; squash: number; tilt: number; strap: { p: number; tug: number }; isFar: boolean; gleam: number }
type Part = 'sole' | 'foot' | 'shaft' | 'cuff'
type Row = { spans: readonly (readonly [number, number])[]; part: Part }

function bootRows(shaftH: number): Row[] {
  const rows: Row[] = [
    { spans: [[0, 2], [7, 11]], part: 'sole' },
    { spans: [[0, 12]], part: 'sole' },
    { spans: [[0, 12]], part: 'foot' },
    { spans: [[0, 11]], part: 'foot' },
    { spans: [[0, 9]], part: 'foot' },
    { spans: [[0, 7]], part: 'foot' },
  ]
  for (let i = 0; i < shaftH; i++) rows.push({ spans: [[0, i === 0 ? 6 : 5]], part: 'shaft' })
  rows.push({ spans: [[-1, 6]], part: 'cuff' }, { spans: [[-1, 6]], part: 'cuff' })
  return rows
}

function drawLoop(c: Canvas, ax: number, ay: number, dir: number, p: number, tug: number, light: number, dim: number): void {
  const t = ease.inOut(p)
  const hx = Math.round(lerp(ax + dir * 3.5, ax + 0.5, t))
  const hy = Math.round(lerp(ay + 3, ay - 4 - tug, t))
  const lit = shade(TAN, 3.6 + light + dim, 0, 0)
  const dark = shade(TAN, 2.2 + dim, 0, 0)
  c.line(ax, ay - 1, hx, hy, lit)
  c.line(ax + 2, ay - 1, hx + 1, hy, dark)
  c.set(hx, hy, shade(TAN, 4.4 + light + dim, 0, 0))
  c.set(hx + 1, hy, lit)
}
function drawBoot(c: Canvas, b: Boot): void {
  const rows = bootRows(7 - b.squash)
  const n = rows.length
  const dim = b.isFar ? -1 : 0
  rows.forEach((r, k) => {
    const y = b.y - k
    const shear = Math.round((b.tilt * k) / n)
    for (const [x0, x1] of r.spans) {
      for (let i = x0; i <= x1; i++) {
        const x = b.x + i + shear
        const lamp = glow(x, y) * 1.5
        const isBack = i === x0
        const isFront = i === x1
        if (r.part === 'sole') {
          c.set(x, y, shade(SOLE, (k === 1 ? 2 : 1) + (isFront || isBack ? 0.6 : 0) + lamp * 0.6 + dim, x, y))
          continue
        }
        if (r.part === 'cuff') {
          const isTop = k === n - 1
          c.set(x, y, shade(TAN, (isTop ? 3.4 : 2.3) + (isBack ? 1.1 : isFront ? -1.2 : 0) + lamp + dim, x, y))
          continue
        }
        let level: number
        if (r.part === 'shaft') {
          const u = (i - x0) / Math.max(1, x1 - x0)
          level = 4.6 - u * 2.8 + lamp
          if ((k === 7 && i === 2) || (k === 8 && i === 3) || (k === 7 && i === 3)) level -= 1.3
          if (isFront && !b.isFar) {
            c.set(x, y, shade(RIM, 1.4, x, y))
            continue
          }
        } else {
          const isTop = !rows[k + 1]?.spans.some(([a, z]) => i >= a && i <= z)
          level = 3.2 + lamp + (isTop ? 1.3 : 0) - (k === 2 ? 0.9 : 0) - (isBack ? -0.6 : 0)
          if (Math.hypot(i - 9.6, (k - 3.4) * 1.3) < 1.2) level += 1.8
          if (b.gleam > 0 && Math.abs(i - (1 + b.gleam * 11)) < 0.8 && k >= 3) level += 2.4
        }
        c.set(x, y, shade(LEATHER, clamp(level + dim, 0.5, 8), x, y))
      }
    }
  })
  const top = b.y - n + 1
  const sx = b.x + Math.round(b.tilt)
  const light = glow(sx, top) * 1.2
  drawLoop(c, sx - 1, top, -1, b.strap.p, b.strap.tug, light, dim)
  drawLoop(c, sx + 3, top, 1, b.strap.p, b.strap.tug, light * 0.6, dim - 0.4)
}
function draw(c: Canvas, f: number): void {
  const lift = liftAt(f)
  const strap = strapAt(f)
  const tilt = tiltAt(f)
  const gleam = f >= RISE + 9 && f <= RISE + 14 ? (f - RISE - 9) / 5 : 0
  for (let y = 0; y < BENCH_Y; y++) {
    for (let x = 0; x < W; x++) {
      const l = glow(x, y)
      if (y >= 16) {
        const isSeam = x % 6 === 0
        c.set(x, y, shade(BOARD, 1.4 + l * 4 - (isSeam ? 0.9 : 0) - (y === 16 ? -1 : 0) - vignette(x, y), x, y))
      } else {
        c.set(x, y, shade(WALL, 1.6 + l * 4.6 - vignette(x, y), x, y))
      }
    }
  }
  for (let y = 2; y <= 11; y++) {
    for (let x = 49; x <= 60; x++) {
      const isFrame = x === 49 || x === 60 || y === 2 || y === 11 || x === 54 || y === 6
      c.set(x, y, isFrame ? shade(WOOD, x === 49 || y === 2 ? 1 : 2.4, x, y) : shade(DUSK, (y - 2) * 0.62 - 0.4, x, y))
    }
  }
  c.set(57, 4, DUSK[5] ?? 0)
  for (let x = 48; x <= 61; x++) c.set(x, 12, shade(WOOD, 3, x, 12))
  for (let y = 14; y <= 21; y++) c.set(52, y, shade(WOOD, 3, 52, y))
  for (let x = 50; x <= 54; x++) {
    c.set(x, 14, shade(STEEL, x === 50 ? 3.4 : 2.4, x, 14))
    c.set(x, 15, shade(STEEL, 1.6, x, 15))
  }
  c.line(57, 14, 59, 21, STEEL[2] ?? 0)
  c.line(59, 14, 57, 21, STEEL[3] ?? 0)
  c.set(58, 17, STEEL[4] ?? 0)
  for (let y = 0; y <= 2; y++) c.set(LAMP.x, y, BRASS[1] ?? 0)
  for (let y = 3; y <= 5; y++) {
    const half = (y - 3) * 1.5 + 1.5
    for (let x = Math.round(LAMP.x - half); x <= Math.round(LAMP.x + half); x++) {
      c.set(x, y, shade(BRASS, 3.6 - (x - LAMP.x) * 0.4 + (y === 5 ? -1.5 : 0), x, y))
    }
  }
  c.sprite(LAMP.x - 1, 6, ['abba', '.cc.'], { a: 0xf9c86a, b: 0xfffbe0, c: 0xfee996 }, false)
  for (let x = 1; x <= 12; x++) {
    c.set(x, 13, shade(WOOD, 4 + glow(x, 13) * 1.5, x, 13))
    c.set(x, 14, shade(WOOD, 1.2, x, 14))
  }
  for (const lx of [2, 8]) {
    c.sprite(lx, 9, ['.ab..', 'aabb.', 'aabbb', 'abbbb'], { a: PALETTE.sand[5] ?? 0, b: PALETTE.sand[3] ?? 0 })
  }
  for (let x = 0; x < W; x++) {
    c.set(x, BENCH_Y, shade(WOOD, 3.6 + glow(x, BENCH_Y) * 2.6 - vignette(x, BENCH_Y), x, BENCH_Y))
    c.set(x, BENCH_Y + 1, shade(WOOD, 3 + glow(x, BENCH_Y) * 2 - vignette(x, BENCH_Y), x, BENCH_Y + 1))
    c.set(x, BENCH_Y + 2, shade(WOOD, 4.6 + glow(x, BENCH_Y) * 1.6, x, BENCH_Y + 2))
    for (let y = BENCH_Y + 3; y < H; y++) {
      const isDrawer = x >= 22 && x <= 42 && (y === BENCH_Y + 4 || y === H - 1 || x === 22 || x === 42)
      c.set(x, y, shade(WOOD, 1.4 + glow(x, y) * 1.2 - (isDrawer ? 0.8 : 0) - vignette(x, y) * 0.5, x, y))
    }
  }
  c.set(32, 29, BRASS[4] ?? 0)
  c.set(33, 29, BRASS[2] ?? 0)
  for (let x = 4; x <= 12; x++) c.set(x, BENCH_Y - 1, shade(WOOD, 4.4 + (x === 4 ? 1 : 0), x, BENCH_Y - 1))
  c.sprite(12, BENCH_Y - 3, ['ab', 'ab', 'ab'], { a: STEEL[4] ?? 0, b: STEEL[2] ?? 0 })
  c.sprite(49, BENCH_Y - 4, ['abbc', 'deef', 'deef', 'abbc'], {
    a: WOOD[5] ?? 0, b: WOOD[4] ?? 0, c: WOOD[2] ?? 0, d: THREAD[3] ?? 0, e: THREAD[2] ?? 0, f: THREAD[1] ?? 0,
  })
  c.set(17, BENCH_Y, STEEL[4] ?? 0)
  c.set(19, BENCH_Y + 1, STEEL[3] ?? 0)
  const farLift = liftAt(Math.max(0, f - 1)).y
  for (const [bx, h, row] of [[32, farLift, BENCH_Y], [24, lift.y, BENCH_Y + 1]] as const) {
    const half = 7 - h * 0.45
    const cx = bx + 8 + h * 0.5
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const v = 1.4 - h * 0.12
      c.set(x, row, shade(WOOD, 3.6 + glow(x, row) * 2.6 - v - (Math.abs(x - cx) < half - 2 ? 0.7 : 0), x, row))
    }
  }
  const far = liftAt(Math.max(0, f - 1))
  const farStrap = strapAt(Math.max(0, f - 1))
  drawBoot(c, { x: 32, y: BENCH_Y - 1 - far.y, squash: far.squash, tilt: tiltAt(Math.max(0, f - 1)), strap: farStrap, isFar: true, gleam: 0 })
  drawBoot(c, { x: 24, y: BENCH_Y - lift.y, squash: lift.squash, tilt, strap, isFar: false, gleam })
  for (const [start, n] of [[RISE + 1, 4], [LAND, 5]] as const) {
    const t = f - start
    if (t < 0 || t >= n) continue
    for (const [dir, x0] of [[-1, 23], [1, 37]] as const) {
      const x = x0 + dir * (1 + t * 1.4)
      const y = BENCH_Y - 1 - (t > 1 ? 1 : 0)
      const l = 3 - t * 0.7
      c.set(x, y, shade(DUST, l, x, y))
      if (t < n - 1) c.set(x + dir, y, shade(DUST, l - 1, x, y))
      if (t >= 1 && t < n - 1) c.set(x, y - 1, shade(DUST, l - 0.8, x, y))
    }
  }
}
export const scene: Scene = { verb: 'Bootstrapping', render: () => frames(LOOP, draw), hero: RISE + 11 }