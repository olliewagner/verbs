import { Canvas, PALETTE, beat, clamp, ease, frames, hex, lerp, particles, shade, smoothstep, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96
const TABLE_Y = 27

const ROLL = 8
const HIT = 37
const CUP = 41
const RELEASE = 43
const DOMINOES = [46, 49, 52, 55] as const
const PRESS = 59
const FLICK = 67
const LIGHT = 69
const IRIS_OUT = 82

const WALL = hex('0f131e 151a29 1b2234 222a40 2a344e 35405e')
const WARM = hex('0f131e 241e2a 3e2c32 664236 9a6440 d2964e f6c870')
const WOOD = PALETTE.wood
const RAMP = hex('3a2414 6a4224 9a6634 c89050 ecc078')
const MARBLE = hex('3e0814 7e1222 c62a36 f2605c ffc8c0')
const BRASS = PALETTE.gold
const LEATHER = hex('1e0e0c 3a1a12 5e2a1a 86401f a85a2c c87a42')
const TAN = hex('5a3418 8a5428 c08848')
const IVORY = hex('6a625c a69c90 d8cfc0 f6f0e4')
const PIP = 0x1a1418
const MINT = hex('163430 255449 3a7e68 62aa8c 9ad2b4')
const STEEL = hex('22262e 3c424e 646c7a 98a0ac d0d6dc')
const GLASS = hex('2c323c 4e5866 7c8896')
const BULB = hex('f6c870 fff0b0 fffef0')
const NIGHT = 0x07070b

type Plank = { x0: number; y0: number; x1: number; y1: number }
const RAMPS: Plank[] = [
  { x0: 1, y0: 6, x1: 15, y1: 9 },
  { x0: 17, y0: 11, x1: 2, y1: 14 },
  { x0: 1, y0: 17, x1: 13, y1: 20 },
]
const surface = (r: Plank, x: number) => lerp(r.y0, r.y1, clamp((x - r.x0) / (r.x1 - r.x0)))

function marbleAt(f: number): [number, number] {
  const [r1, r2, r3] = RAMPS as [Plank, Plank, Plank]
  const on = (r: Plank, x: number): [number, number] => [x - 1, surface(r, x) - 3]
  const fall = (a: [number, number], b: [number, number], t: number): [number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t * t)]
  if (f < ROLL) return on(r1, 3)
  if (f < 17) return on(r1, 3 + 12 * beat(f, ROLL, 17) ** 1.7)
  if (f < 19) return fall(on(r1, 15), on(r2, 16), beat(f, 17, 19))
  if (f < 27) return on(r2, 16 - 14 * beat(f, 19, 27) ** 1.5)
  if (f < 29) return fall(on(r2, 2), on(r3, 2), beat(f, 27, 29))
  if (f < 35) return on(r3, 2 + 11 * beat(f, 29, 35) ** 1.25)
  if (f < HIT) return [lerp(12, 14, beat(f, 35, HIT)), lerp(surface(r3, 13) - 3, 17.5, beat(f, 35, HIT))]
  if (f < CUP) {
    const t = beat(f, HIT, CUP)
    return [lerp(14, 15.5, t), 17.5 - 2.5 * Math.sin(t * Math.PI * 0.6) + t * t * 5.5]
  }
  const s = seesawAt(f)
  return [s.lx, s.ly - 3]
}

function seesawAt(f: number): { lx: number; ly: number; rx: number; ry: number } {
  const bounce = f > RELEASE ? 0.35 * Math.sin((f - RELEASE) * 1.6) * Math.exp(-(f - RELEASE) / 2) : 0
  const tilt = lerp(-1.5, 1.6, smoothstep(CUP, RELEASE, f)) + bounce
  return { lx: 15.5, ly: 25 + tilt, rx: 33.5, ry: 25 - tilt * 1.15 }
}

function bootAngle(f: number): number {
  if (f < RELEASE) return 0
  const t = f - RELEASE
  return -0.62 * Math.sin(t * 0.42) * Math.exp(-t / 8)
}
function dominoAngle(f: number, i: number): number {
  const last = i === DOMINOES.length - 1
  return (last ? 1.2 : 1.05) * ease.in(beat(f, DOMINOES[i] ?? 0, (DOMINOES[i] ?? 0) + 4))
}
const bellAngleAt = (f: number) => (f >= HIT ? -0.5 * Math.sin((f - HIT) * 0.9) * Math.exp(-(f - HIT) / 5) : 0)

const fanSpeed = (f: number) => 1.15 * ease.inOut(beat(f, PRESS, PRESS + 9))
function fanAngle(f: number): number {
  let a = 0
  for (let k = PRESS; k < f; k++) a += fanSpeed(k)
  return a
}
function irisAt(f: number): { x: number; y: number; r: number } {
  if (f < 8) return { x: 5, y: 4.5, r: f === 0 ? 0 : lerp(2.5, 72, ease.in(beat(f, 0, 7))) }
  if (f < IRIS_OUT) return { x: 32, y: 16, r: 99 }
  if (f < 90) return { x: 42, y: 5, r: lerp(48, 3.2, ease.inOut(beat(f, IRIS_OUT, 90))) }
  if (f < 94) return { x: 42, y: 5, r: 3.2 }
  return { x: 42, y: 5, r: 0 }
}
function stampTurned(c: Canvas, art: readonly string[], pal: Readonly<Record<string, number>>, u: number, v: number, px: number, py: number, angle: number): void {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const reach = Math.hypot(Math.max(u, 9 - u), Math.max(v, art.length - v)) + 2
  for (let y = Math.floor(py - reach); y <= Math.ceil(py + reach); y++) {
    for (let x = Math.floor(px - reach); x <= Math.ceil(px + reach); x++) {
      const dx = x + 0.5 - px
      const dy = y + 0.5 - py
      const col = Math.floor(dx * cos + dy * sin + u)
      const row = Math.floor(-dx * sin + dy * cos + v)
      const paint = pal[art[row]?.[col] ?? ' ']
      if (paint !== undefined) c.set(x, y, paint)
    }
  }
}
const BOOT = [
  '...r.....',
  '...r.....',
  '...r.....',
  '...r.....',
  '...r.....',
  '...r.....',
  '..cccc...',
  '..lmmd...',
  '..lmmd...',
  '..lmmmd..',
  '..lmmmmd.',
  '..lmmmhhd',
  '..sssssss',
  '..ss.....',
]
const BELL = [
  '...h...',
  '..bBd..',
  '..bBd..',
  '.bbBdd.',
  '.bbBdd.',
  'bbbBddd',
  'eeeeeee',
  '...k...',
]
const DOMINO = ['hw', 'wW', 'wW', 'dd', 'wW', 'wW', 'wW']
function draw(c: Canvas, f: number): void {
  const isLit = f >= LIGHT && f !== LIGHT + 1
  const bulbPower = isLit ? (f === LIGHT ? 0.6 : 1) : 0
  const warmAt = (x: number, y: number) => {
    const d = Math.hypot(x - 42, (y - 5) * 1.1) / (bulbPower > 0.8 ? 1 : 1.4)
    return bulbPower === 0 || d > 7 ? 0 : d < 2.6 ? 3.6 : d < 4.8 ? 2.4 : 1.2
  }
  for (let y = 0; y < TABLE_Y; y++) {
    for (let x = 0; x < W; x++) {
      const stripe = x % 5 === 0 ? -0.6 : 0
      const base = 2.6 - y * 0.05 + stripe - (((x - 32) / 40) ** 2 + ((y - 12) / 30) ** 2) * 1.4
      const warm = warmAt(x, y)
      c.set(x, y, warm > 0.4 ? shade(WARM, base + warm, x, y) : shade(WALL, base, x, y))
    }
  }
  for (let x = 0; x < W; x++) {
    c.set(x, TABLE_Y, shade(WOOD, 4.6, x, TABLE_Y))
    c.set(x, TABLE_Y + 1, shade(WOOD, 3.4, x, TABLE_Y + 1))
    for (let y = TABLE_Y + 2; y < H; y++) c.set(x, y, shade(WOOD, 1.6 - (y - TABLE_Y - 2) * 0.25 + (x % 13 === 0 ? -0.6 : 0), x, y))
  }
  for (let y = 0; y <= 2; y++) c.set(42, y, STEEL[1] ?? 0)
  for (let y = 0; y <= 6; y++) c.set(49, y, STEEL[0] ?? 0)
  const dark = WALL[0] ?? 0
  const all = (art: readonly string[]) => Object.fromEntries([...new Set(art.join(''))].filter(ch => ch !== '.').map(ch => [ch, dark]))
  for (const r of RAMPS) c.line(r.x0 + 1, r.y0 + 3, r.x1 + 1, r.y1 + 3, dark)
  stampTurned(c, BELL, all(BELL), 3.5, 0, 22, 14.5, bellAngleAt(f))
  stampTurned(c, BOOT, all(BOOT), 3.5, 0.5, 37, 11, bootAngle(f))
  c.disc(61.5, 17, 4, dark)
  c.rect(48, 8, 3, 5, dark)
  for (const r of RAMPS) {
    c.line(r.x0, r.y0, r.x1, r.y1, RAMP[4] ?? 0)
    c.line(r.x0, r.y0 + 1, r.x1, r.y1 + 1, RAMP[2] ?? 0)
    for (const bx of [Math.min(r.x0, r.x1) + 1, Math.max(r.x0, r.x1) - 2]) {
      const by = Math.round(surface(r, bx)) + 2
      c.set(bx, by, RAMP[1] ?? 0)
      c.set(bx, by + 1, RAMP[0] ?? 0)
      c.set(bx + 1, by, RAMP[0] ?? 0)
    }
  }
  const gateOpen = f >= ROLL - 1
  c.line(5, gateOpen ? 6 : 3, 5, gateOpen ? 4 : 6, gateOpen ? RAMP[1] ?? 0 : RAMP[3] ?? 0)
  if (gateOpen) c.set(6, 4, RAMP[1] ?? 0)
  c.line(20, 11, 25, 11, STEEL[2] ?? 0)
  c.set(25, 12, STEEL[1] ?? 0)
  c.set(20, 12, STEEL[2] ?? 0)
  const bellAngle = bellAngleAt(f)
  stampTurned(c, BELL, { h: STEEL[3] ?? 0, b: BRASS[5] ?? 0, B: BRASS[7] ?? 0, d: BRASS[3] ?? 0, e: BRASS[2] ?? 0, k: BRASS[1] ?? 0 }, 3.5, 0, 20.5, 13, bellAngle)
  if (f >= HIT && f < HIT + 7) {
    const k = (f - HIT) % 2
    const tone = BRASS[k === 0 ? 7 : 6] ?? 0
    for (const [x, y] of [[25, 15], [26, 16], [26, 17], [25, 18]] as const) c.set(x + k * 2, y, tone)
    for (const [x, y] of [[15, 14], [14, 15], [14, 16], [15, 17]] as const) if (f > HIT) c.set(x - k * 2, y - 1, tone)
  }
  const bAngle = bootAngle(f)
  stampTurned(c, BOOT, {
    r: STEEL[2] ?? 0, c: TAN[2] ?? 0, l: LEATHER[4] ?? 0, m: LEATHER[3] ?? 0, d: LEATHER[1] ?? 0, h: LEATHER[5] ?? 0, s: LEATHER[0] ?? 0,
  }, 3.5, 0.5, 35.5, 9.5, bAngle)
  c.disc(35, 9, 1.5, STEEL[1] ?? 0)
  const spoke = Math.round(bAngle * 3) % 2 === 0
  c.set(35, 9, STEEL[4] ?? 0)
  c.set(spoke ? 34 : 36, spoke ? 9 : 8, STEEL[3] ?? 0)
  const s = seesawAt(f)
  c.poly([[23.5, 27.5], [24.5, 25], [25.5, 27.5]], WOOD[2] ?? 0)
  c.line(s.lx, s.ly, s.rx, s.ry, RAMP[3] ?? 0)
  c.line(s.lx, s.ly + 1, s.rx, s.ry + 1, RAMP[1] ?? 0)
  c.set(s.lx - 1, s.ly - 1, STEEL[3] ?? 0)
  c.set(s.lx - 1, s.ly - 2, STEEL[3] ?? 0)
  c.set(s.lx + 3, s.ly - 1, STEEL[2] ?? 0)
  c.set(s.lx + 3, s.ly - 2, STEEL[2] ?? 0)
  DOMINOES.forEach((_, i) => {
    const x = 41 + i * 4
    if (dominoAngle(f, i) < 0.3) c.set(x + 2, TABLE_Y - 1, WOOD[1] ?? 0)
    stampTurned(c, DOMINO, { h: IVORY[3] ?? 0, w: IVORY[2] ?? 0, W: IVORY[1] ?? 0, d: IVORY[0] ?? 0 }, 2, 7, x + 2, TABLE_Y, dominoAngle(f, i))
  })
  const pressed = f >= PRESS
  c.sprite(57, 24, ['..rr...', '.mmmmm.', 'mmmmmmm'], { r: pressed ? 0x8a1a1a : 0xd83a32, m: MINT[2] ?? 0 })
  if (pressed) c.set(58, 24, MINT[2] ?? 0)
  for (let y = 19; y <= 23; y++) c.set(61, y, MINT[y === 19 ? 3 : 1] ?? 0)
  const hub = { x: 60.5, y: 15.5 }
  const speed = fanSpeed(f)
  const spin = fanAngle(f)
  for (let y = 11; y <= 20; y++) {
    for (let x = 56; x < W; x++) {
      const d = Math.hypot(x + 0.5 - hub.x, y + 0.5 - hub.y)
      if (d > 4.2) continue
      if (d > 3.4) {
        c.set(x, y, shade(STEEL, 2.4 + (y < hub.y ? 0.8 : 0), x, y))
        continue
      }
      const a = Math.atan2(y + 0.5 - hub.y, x + 0.5 - hub.x)
      const blade = Math.cos(3 * (a - spin))
      if (speed > 0.75) {
        c.set(x, y, shade(MINT, 2.4 + (d < 1.2 ? 1.6 : 0) + (blade > 0.6 ? 0.6 : 0), x, y))
      } else if (blade > 0.55 && d > 0.8) {
        c.set(x, y, shade(MINT, 3.4 - d * 0.2, x, y))
      } else if (d < 1) {
        c.set(x, y, MINT[4] ?? 0)
      }
    }
  }
  if (f >= PRESS + 4) {
    for (const p of particles(f, LOOP, 18, 5, 21)) {
      if (f - p.t < PRESS + 4) continue
      const x = 55 - p.t * 1.3
      const y = 12.5 + p.r[1] * 5 - p.t * (0.3 + p.r[1] * 0.5)
      c.line(x, y, x + 2, y + 0.6, STEEL[2] ?? 0)
      c.set(x, y, STEEL[4] ?? 0)
    }
  }
  for (let y = 7; y <= 11; y++) for (let x = 47; x <= 49; x++) c.set(x, y, shade(BRASS, x === 47 || y === 7 ? 4 : 2.6, x, y))
  c.set(48, 9, PIP)
  const up = ease.outBack(beat(f, FLICK, FLICK + 2))
  const flutter = f >= PRESS + 6 && f < FLICK && f % 2 === 0 ? -1 : 0
  const tipY = Math.round(lerp(13, 5, up))
  c.line(48, 9, 48, tipY, STEEL[4] ?? 0)
  c.sprite(49, tipY - 1 + flutter, up > 0.5 ? ['ab', 'a.'] : ['a.', 'ab'], { a: 0xf4f0e6, b: 0xb8b0a4 })
  c.set(41, 3, BRASS[3] ?? 0)
  c.set(42, 3, BRASS[5] ?? 0)
  c.set(43, 3, BRASS[2] ?? 0)
  if (bulbPower > 0) {
    const lv = bulbPower > 0.8 ? 0 : 1
    c.sprite(41, 4, ['abc', 'bab', '.b.'], { a: BULB[2 - lv] ?? 0, b: BULB[1 - lv] ?? 0, c: BULB[0] ?? 0 })
  } else {
    c.sprite(41, 4, ['abc', 'bbc', '.c.'], { a: GLASS[2] ?? 0, b: GLASS[1] ?? 0, c: GLASS[0] ?? 0 })
  }
  const [mx, my] = marbleAt(f)
  const [px, py] = marbleAt(f - 1)
  if (f > 0 && Math.hypot(Math.round(mx) - Math.round(px), Math.round(my) - Math.round(py)) > 2.3) {
    c.sprite(Math.round((mx + px) / 2), Math.round((my + py) / 2), ['bbc', 'ccd'], { b: MARBLE[2] ?? 0, c: MARBLE[1] ?? 0, d: MARBLE[0] ?? 0 })
  }
  c.sprite(Math.round(mx), Math.round(my), ['hbc', 'bbc', 'ccd'], { h: MARBLE[4] ?? 0, b: MARBLE[2] ?? 0, c: MARBLE[1] ?? 0, d: MARBLE[0] ?? 0 })
  const iris = irisAt(f)
  if (iris.r < 90) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (Math.hypot(x + 0.5 - iris.x, y + 0.5 - iris.y) > iris.r) c.set(x, y, NIGHT)
      }
    }
  }
}
export const scene: Scene = {
  verb: 'Boondoggling',
  render: () => frames(LOOP, draw),
  hero: 76,
  snaps: [
    { frames: [1, 7], why: 'the iris opens on the marble: a wipe, so the whole picture changes outside the circle' },
    { frames: CUP + 1, box: [12, 13, 37, 28], why: "the marble's weight slams the seesaw over in one in-between, as the bell still rings" },
    { frames: [LIGHT, LIGHT + 2], box: [32, 0, 52, 14], colors: [...BULB, ...WARM], why: 'the bulb sputters on, off and on, and warms the wall round it' },
    { frames: [IRIS_OUT + 1, 94], why: 'the iris closes on the lit bulb, holds, and shuts' },
  ],
}