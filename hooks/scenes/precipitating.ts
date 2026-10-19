import { Canvas, beat, clamp, ease, hash, hex, mix, mod, particles, type Ramp, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const G = 24
const FEET = 25

const NIGHT = hex('04040c 07081a 0b0c24 10122e 161a3c 1e2450 2a3266')
const HAZE = hex('1a1040 2a1858 40228a 5e34c0 8a5cf0 bfa0ff')
const PINK = hex('2a0a2e 4c0f4a 82166e c21e8c f43caa ff86d2 ffd2f0')
const CYAN = hex('08202e 0c3a4c 0e6478 129aaa 34d2dc 9af4f2 e4ffff')
const WARM = hex('2c120e 50200e 84380e bc5c16 e88c2a fbbe50 ffe596 fff8e0')
const RED = hex('3c0814 6e0e18 a8181c e0321e ff6a3a')
const ALL = [...NIGHT, ...HAZE, ...PINK, ...CYAN, ...WARM, ...RED]

type Rgb = readonly [number, number, number]
const rgbOf = (c: number): Rgb => [(c >> 16) & 255, (c >> 8) & 255, c & 255]
const ALL_RGB = ALL.map(rgbOf)
const luma = (c: number) => {
  const [r, g, b] = rgbOf(c)
  return (r * 0.3 + g * 0.55 + b * 0.15) / 255
}

const RAMPS = [NIGHT, HAZE, PINK, CYAN, WARM, RED]
const rampStep = (r: Ramp, i: number) => r[clamp(Math.round(i), 0, r.length - 1)] ?? 0
function paler(color: number): number {
  for (const r of RAMPS) {
    const i = r.indexOf(color)
    if (i >= 0) return r[Math.min(r.length - 1, i + 1)] ?? color
  }
  return color
}

const snapCache = new Map<number, number>()
function snap(c: number): number {
  const hit = snapCache.get(c)
  if (hit !== undefined) return hit
  const [r, g, b] = rgbOf(c)
  let best = 0
  let bestD = Infinity
  ALL_RGB.forEach(([pr, pg, pb], i) => {
    const d = (r - pr) ** 2 * 0.9 + (g - pg) ** 2 * 1.1 + (b - pb) ** 2 * 0.7
    if (d < bestD) {
      bestD = d
      best = i
    }
  })
  const out = ALL[best] ?? 0
  snapCache.set(c, out)
  return out
}

type Lamp = { x0: number; y0: number; x1: number; y1: number; ramp: readonly number[]; power: number; reach: number; wet?: number }

function strongest(lamps: readonly Lamp[], x: number, y: number, spread = 1, isRain = false): [Lamp | undefined, number] {
  let best: Lamp | undefined
  let bestK = 0
  for (const l of lamps) {
    const d = Math.hypot(Math.max(0, l.x0 - x, x - l.x1), Math.max(0, l.y0 - y, y - l.y1))
    const k = l.power * Math.max(0, 1 - d / (l.reach * (isRain ? (l.wet ?? 1.6) * spread : spread))) ** 1.5
    if (k > bestK) {
      best = l
      bestK = k
    }
  }
  return [best, bestK]
}

function lit(base: number, lamps: readonly Lamp[], x: number, y: number, gain = 1): number {
  const [l, k] = strongest(lamps, x, y)
  const level = Math.floor(k * gain * 3)
  if (!l || level <= 0) return base
  return l.ramp[Math.min(1, level - 1)] ?? base
}

function caught(lamps: readonly Lamp[], x: number, y: number, gain = 1): number | undefined {
  const [l, k] = strongest(lamps, x, y, 1.8)
  const level = Math.floor(k * gain * 4)
  if (!l || level <= 0) return undefined
  return l.ramp[Math.min(l.ramp.length - 2, level + 1)]
}

const GLYPH = {
  ra: ['.###.', '.....', '#####', '....#', '.###.'],
  cho: ['.....', '.....', '#####', '.....', '.....'],
  me: ['....#', '.#.#.', '..#..', '.#.#.', '#....'],
  n: ['#....', '.#..#', '...#.', '..#..', '##...'],
  yama: ['..#..', '#.#.#', '#.#.#', '#.#.#', '#####'],
  ta: ['#####', '#.#.#', '#####', '#.#.#', '#####'],
} as const

function strokes(glyphs: readonly (readonly string[])[], vertical: boolean): number[] {
  const width = vertical ? 5 : glyphs.length * 6 - 1
  return Array.from({ length: width }, (_, col) => {
    let n = 0
    glyphs.forEach((g, k) => g.forEach(row => {
      const i = vertical ? col : col - k * 6
      if (row[i] === '#') n++
    }))
    return n === 0 ? 0 : Math.min(1, 0.45 + n / (vertical ? 6 : 4))
  })
}
const FASCIA_STROKES = [0, ...strokes([GLYPH.ra, GLYPH.cho, GLYPH.me, GLYPH.n], false), 0]
const BAR_STROKES = strokes([GLYPH.yama, GLYPH.ta], true)
const streaky = (x: number) => [1, 0, 0.75, 0.45, 0, 0.9, 0.6, 0][mod(x * 3 + Math.floor(hash(x >> 3, 8) * 4), 8)] ?? 1

type Mirror = { x0: number; x1: number; y: number; ramp: readonly number[]; top: number; weight: (x: number) => number }

type Box = { x: number; y: number; w: number; h: number }
const FASCIA: Box = { x: 2, y: 7, w: 25, h: 7 }
const BAR_SIGN: Box = { x: 38, y: 0, w: 7, h: 13 }
const LOWER_SIGN: Box = { x: 39, y: 14, w: 5, h: 5 }
const DOOR = { x: 11, w: 13 }
const DOOR_X = DOOR.x + 6
const GAP = { x0: 29, x1: 35 }
const LOW_ROOF = 10
const LOW_X = 50
const VENDING: Box = { x: 53, y: 14, w: 8, h: 10 }
const MARQUEE: Box = { x: 51, y: 11, w: 13, h: 3 }
const POLE_X = 49

const inBox = (b: Box, x: number, y: number) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h
const isSign = (x: number, y: number) => inBox(FASCIA, x, y) || inBox(BAR_SIGN, x, y) || inBox(LOWER_SIGN, x, y) || inBox(VENDING, x, y) || inBox(MARQUEE, x, y)

const TICKER = [
  '###..####', '#.##.####', '.#.###.#.', '###.#.###', '#..##.#..', '.........',
  '###...###', '.#.###.#.', '####.####', '#..###...', '###..####', '.........',
]

function flickerPower(f: number): number {
  const off: Record<number, number> = { 12: 0, 13: 0.4, 14: 0, 15: 0, 16: 1, 17: 0, 80: 0.4, 81: 0, 82: 0, 83: 0, 84: 0, 85: 0.4 }
  return off[f] ?? 1
}

const TRAIN_START = 12
const TRAIN_END = 59
const TRAIN_LEN = 30
const TRAIN_Y = 7
const trainX = (f: number) => (f < TRAIN_START || f > TRAIN_END ? null : W - (f - TRAIN_START) * 2)

const STOP = 56
const CLOSE = 60
const TURN = 65
const DUCK = 69
const GONE = 74
const START_X = 69
const SLOWING = 8
const CRUISE = (START_X - DOOR_X) / (STOP - SLOWING / 2)
const STRIDE = (START_X - DOOR_X) / 19.5
function walkerX(f: number): number {
  const slow = STOP - SLOWING
  if (f < slow) return START_X - f * CRUISE
  const t = Math.min(f, STOP) - slow
  return START_X - slow * CRUISE - CRUISE * (t - (t * t) / (2 * SLOWING))
}

const sway = (f: number) => (f < DUCK + 2 ? 0 : Math.exp(-(f - DUCK - 2) / 7) * Math.sin((f - DUCK - 2) * 0.6) * 1.6)
const doorOpen = (f: number) => ease.out(beat(f, DUCK, GONE)) * (1 - ease.inOut(beat(f, GONE + 4, GONE + 18)))

const BODY = ['..hh.', '.shh.', '..cc.', '.accc', '.accc', '..ccc', '..ccc']
const LEGS = [['..l.l', '.b..b'], ['..ll.', '..bb.'], ['.l..l', 'b...b'], ['..ll.', '..bb.']]
const BACK = ['.hh.', '.hh.', 'cccc', 'cccc', 'cccc', 'cccc', '.cc.', '.ll.', '.bb.']
const UMBRELLA = [
  ['...ooo...', '.oogggoo.', 'ogggggggo', 'k.k.k.k.k'],
  ['..ooo..', '.ogggo.', 'oggggko', '.k.k.k.'],
  ['.oo.', 'oggo', '.ok.', '..k.'],
]

const PUDDLES: readonly (readonly [number, number, number, number])[] = [
  [19, 29.2, 7, 1.5], [40, 26.4, 6, 1.1], [57, 30.6, 6, 1.4],
]
const inPuddle = (x: number, y: number) => PUDDLES.some(([px, py, rx, ry]) => ((x - px) / rx) ** 2 + ((y - py) / ry) ** 2 <= 1)
const RIPPLE_SPOTS: readonly (readonly [number, number])[] = (() => {
  const spots: [number, number][] = []
  for (let i = 0; spots.length < 20 && i < 4000; i++) {
    const x = Math.floor(hash(i, 7) * W)
    const y = 25 + Math.floor(hash(i, 11) * 7)
    if (inPuddle(x, y) && inPuddle(x - 2, y) && inPuddle(x + 2, y)) spots.push([x, y])
  }
  return spots
})()

function drawRain(c: Canvas, emit: Int32Array, lamps: readonly Lamp[], f: number, layer: 'near' | 'far', isSheltered: (x: number, y: number) => boolean): void {
  const isNear = layer === 'near'
  const count = isNear ? 64 : 110
  const speed = isNear ? 6 : 3
  const length = isNear ? 3 : 2
  const xAt = (x0: number, y: number) => x0 - Math.floor((y - 2) / 3)
  for (let i = 0; i < count; i++) {
    const x0 = Math.floor(hash(i, isNear ? 21 : 1) * (W + 12))
    const head = mod(3 * Math.floor(hash(i, isNear ? 22 : 2) * 16) + f * speed, 48) - 8
    const [l, power] = strongest(lamps, xAt(x0, head), head, isNear ? 1.2 : 1, true)
    if (!l || power < (isNear ? 0.06 : 0.1)) continue
    const color = rampStep(l.ramp, (isNear ? 3 : 2) + (power > 0.35 ? 2 : power > 0.15 ? 1 : 0))
    for (let k = 0; k < length; k++) {
      const y = head - k
      const x = xAt(x0, y)
      if (y < 0 || y >= H || y > G + (isNear ? 3 : 0)) continue
      if (isSign(x, y) || isSheltered(x, y)) continue
      const behind = emit[y * W + x] ?? -1
      if (behind >= 0) {
        if (isNear) c.set(x, y, paler(behind))
        continue
      }
      c.set(x, y, color)
    }
  }
}
function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const emit = new Int32Array(W * H).fill(-1)
    const glow = (x: number, y: number, color: number) => {
      c.set(x, y, color)
      if (x >= 0 && x < W && y >= 0 && y < H) emit[Math.round(y) * W + Math.round(x)] = color
    }
    const open = doorOpen(f)
    const flick = flickerPower(f)
    const tx = trainX(f)
    const lamps: Lamp[] = [
      { x0: FASCIA.x, y0: FASCIA.y, x1: FASCIA.x + FASCIA.w - 1, y1: FASCIA.y + FASCIA.h - 1, ramp: PINK, power: 0.8, reach: 4, wet: 2.6 },
      { x0: DOOR.x, y0: 19, x1: DOOR.x + DOOR.w - 1, y1: 23, ramp: WARM, power: 0.7 + open * 0.3, reach: 5 + open * 4, wet: 2.2 },
      { x0: 2, y0: 17, x1: 4, y1: 20, ramp: RED, power: 0.9, reach: 4, wet: 2 },
      { x0: VENDING.x + 1, y0: 15, x1: VENDING.x + VENDING.w - 2, y1: 19, ramp: CYAN, power: 0.8, reach: 6, wet: 0.8 },
      { x0: MARQUEE.x, y0: MARQUEE.y, x1: MARQUEE.x + MARQUEE.w - 1, y1: MARQUEE.y + MARQUEE.h - 1, ramp: RED, power: 0.35, reach: 3, wet: 0.8 },
      { x0: BAR_SIGN.x, y0: BAR_SIGN.y, x1: BAR_SIGN.x + BAR_SIGN.w - 1, y1: BAR_SIGN.y + BAR_SIGN.h - 1, ramp: CYAN, power: 0.5, reach: 3, wet: 1.6 },
      { x0: LOWER_SIGN.x, y0: LOWER_SIGN.y, x1: LOWER_SIGN.x + LOWER_SIGN.w - 1, y1: LOWER_SIGN.y + LOWER_SIGN.h - 1, ramp: HAZE, power: 0.5 * flick, reach: 3, wet: 1.2 },
    ]
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) c.set(x, y, (y < 4 ? NIGHT[3] : y < 8 ? HAZE[0] : HAZE[1]) ?? 0)
    for (let y = 0; y < TRAIN_Y; y++) {
      for (let x = 55; x <= 61; x++) {
        const isWindow = x % 2 === 1 && y % 2 === 1 && y > 1 && hash(x, y, 3) < 0.4
        c.set(x, y, isWindow ? (HAZE[2] ?? 0) : (NIGHT[1] ?? 0))
      }
    }
    for (let x = 0; x < W; x++) {
      c.set(x, TRAIN_Y + 2, NIGHT[1] ?? 0)
      for (let y = TRAIN_Y + 3; y < H; y++) c.set(x, y, mod(x, 6) === 0 ? (NIGHT[1] ?? 0) : (HAZE[1] ?? 0))
    }
    if (tx !== null) {
      for (let x = tx; x < tx + TRAIN_LEN; x++) {
        c.set(x, TRAIN_Y, NIGHT[4] ?? 0)
        c.set(x, TRAIN_Y + 1, mod(x - tx, 5) === 4 ? (NIGHT[4] ?? 0) : (CYAN[5] ?? 0))
        c.set(x, TRAIN_Y + 2, mod(x - tx, 5) === 4 ? (NIGHT[1] ?? 0) : (CYAN[2] ?? 0))
      }
    }
    for (let y = TRAIN_Y + 3; y < G; y++) {
      for (let x = GAP.x0; x <= GAP.x1; x++) {
        const depth = Math.min(x - GAP.x0, GAP.x1 - x) + (y > 13 ? 1 : 0) + (y > 18 ? 1 : 0)
        c.set(x, y, [NIGHT[1], NIGHT[2], HAZE[0], HAZE[1], HAZE[2], HAZE[2]][Math.min(5, depth)] ?? 0)
      }
    }
    for (const y of [13, 14, 15, 16]) c.set(GAP.x0 + 2, y, PINK[2] ?? 0)
    c.set(GAP.x1 - 2, 19, WARM[3] ?? 0)
    for (let y = 0; y < G; y++) for (let x = GAP.x1 + 1; x < LOW_X; x++) c.set(x, y, lit(NIGHT[2] ?? 0, lamps, x, y))
    for (let y = BAR_SIGN.y; y < BAR_SIGN.y + BAR_SIGN.h; y++) {
      for (let x = BAR_SIGN.x; x < BAR_SIGN.x + BAR_SIGN.w; x++) {
        const isEdge = y === BAR_SIGN.y || y === BAR_SIGN.y + BAR_SIGN.h - 1 || x === BAR_SIGN.x || x === BAR_SIGN.x + BAR_SIGN.w - 1
        c.set(x, y, isEdge ? (CYAN[1] ?? 0) : (CYAN[0] ?? 0))
      }
    }
    ;(['yama', 'ta'] as const).forEach((g, k) => {
      GLYPH[g].forEach((row, j) => {
        for (let i = 0; i < row.length; i++) if (row[i] === '#') glow(BAR_SIGN.x + 1 + i, BAR_SIGN.y + 1 + k * 6 + j, CYAN[3] ?? 0)
      })
    })
    ;['ooooo', 'o..oo', 'ooooo', 'oo..o', 'ooooo'].forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const isMark = row[i] === '.'
        const level = flick >= 1 ? (isMark ? 1 : 2) : flick > 0 ? (isMark ? 0 : 1) : 0
        if (flick > 0) glow(LOWER_SIGN.x + i, LOWER_SIGN.y + j, HAZE[level] ?? 0)
        else c.set(LOWER_SIGN.x + i, LOWER_SIGN.y + j, HAZE[level] ?? 0)
      }
    })
    c.rect(BAR_SIGN.x + 3, BAR_SIGN.y + BAR_SIGN.h, 1, 1, NIGHT[4] ?? 0)
    c.rect(44, 17, 4, 7, NIGHT[0] ?? 0)
    c.rect(44, 22, 4, 1, WARM[1] ?? 0)
    c.rect(44, 23, 4, 1, WARM[2] ?? 0)
    const chase = Math.floor(f / 4) % 3
    for (let k = 0; k < 3; k++) {
      const color = k === chase ? (WARM[4] ?? 0) : (WARM[1] ?? 0)
      const x = 36 + k * 3
      glow(x, 19, color)
      glow(x + 1, 20, color)
      glow(x, 21, color)
    }
    for (let y = LOW_ROOF; y < G; y++) for (let x = LOW_X; x < W; x++) c.set(x, y, lit(NIGHT[2] ?? 0, lamps, x, y))
    for (let x = LOW_X; x < W; x++) c.set(x, LOW_ROOF, NIGHT[4] ?? 0)
    for (let y = MARQUEE.y; y < MARQUEE.y + MARQUEE.h; y++) for (let x = MARQUEE.x; x < MARQUEE.x + MARQUEE.w; x++) c.set(x, y, NIGHT[0] ?? 0)
    for (let i = 0; i < MARQUEE.w; i++) {
      const col = mod(i + Math.floor(f / 2), 48)
      const shape = TICKER[Math.floor(col / 4)] ?? ''
      const k = col % 4
      if (k === 3) continue
      for (let j = 0; j < 3; j++) {
        if (shape[j * 3 + k] !== '#') continue
        c.set(MARQUEE.x + i, MARQUEE.y + j, RED[2] ?? 0)
        emit[(MARQUEE.y + j) * W + MARQUEE.x + i] = RED[2] ?? 0
      }
    }
    c.rect(VENDING.x, VENDING.y, VENDING.w, VENDING.h, CYAN[2] ?? 0)
    c.rect(VENDING.x, VENDING.y, 1, VENDING.h, CYAN[3] ?? 0)
    for (let y = 15; y <= 20; y++) for (let x = VENDING.x + 1; x < VENDING.x + VENDING.w - 1; x++) glow(x, y, CYAN[4] ?? 0)
    for (let i = 0; i < 6; i++) for (const y of [16, 17, 19, 20]) c.set(VENDING.x + 1 + i, y, CYAN[i % 2 ? 3 : 2] ?? 0)
    c.rect(VENDING.x + 1, 21, 6, 2, CYAN[1] ?? 0)
    for (let y = 0; y < G; y++) for (let x = 0; x < GAP.x0; x++) c.set(x, y, lit(NIGHT[2] ?? 0, lamps, x, y))
    const tv = [HAZE[2], HAZE[3], NIGHT[6]][Math.floor(hash(Math.floor(f / 6), 3) * 3)] ?? 0
    c.rect(2, 1, 7, 5, NIGHT[0] ?? 0)
    c.rect(3, 2, 5, 3, tv)
    c.rect(3, 2, 2, 3, HAZE[1] ?? 0)
    c.rect(12, 2, 6, 4, NIGHT[4] ?? 0)
    c.rect(12, 5, 6, 1, NIGHT[3] ?? 0)
    c.rect(13, 3, 2, 2, NIGHT[2] ?? 0)
    c.line(18, 4, 20, 4, NIGHT[3] ?? 0)
    c.line(20, 4, 20, 6, NIGHT[3] ?? 0)
    for (let y = FASCIA.y; y < FASCIA.y + FASCIA.h; y++) {
      for (let x = FASCIA.x; x < FASCIA.x + FASCIA.w; x++) {
        const isEdge = y === FASCIA.y || y === FASCIA.y + FASCIA.h - 1 || x === FASCIA.x || x === FASCIA.x + FASCIA.w - 1
        c.set(x, y, isEdge ? (PINK[1] ?? 0) : (PINK[0] ?? 0))
      }
    }
    ;(['ra', 'cho', 'me', 'n'] as const).forEach((g, k) => {
      GLYPH[g].forEach((row, j) => {
        for (let i = 0; i < row.length; i++) if (row[i] === '#') glow(FASCIA.x + 1 + k * 6 + i, FASCIA.y + 1 + j, PINK[5] ?? 0)
      })
    })
    const doorLevel = 5 + Math.round(open)
    for (let y = 15; y < G - 1; y++) {
      for (let x = 7; x <= 9; x++) glow(x, y, WARM[y === 20 ? 2 : 3] ?? 0)
      for (let x = DOOR.x; x < DOOR.x + DOOR.w; x++) glow(x, y, WARM[y === 20 || y > 21 ? doorLevel - 1 : doorLevel] ?? 0)
    }
    c.rect(8, 18, 1, 1, WARM[0] ?? 0)
    c.rect(7, 19, 3, 2, WARM[0] ?? 0)
    c.rect(6, 14, 1, G - 14, NIGHT[0] ?? 0)
    c.rect(10, 14, 1, G - 14, NIGHT[0] ?? 0)
    c.rect(DOOR.x + DOOR.w, 14, 1, G - 14, NIGHT[0] ?? 0)
    c.rect(6, G - 1, DOOR.x + DOOR.w - 5, 1, NIGHT[3] ?? 0)
    c.sprite(1, 14, ['..k..', '.kkk.', 'rRRRr', 'RRWRR', 'rrrrr', 'RRWRR', 'rRRRr', '.kkk.', '..t..'], {
      k: NIGHT[0] ?? 0, r: RED[2] ?? 0, R: RED[3] ?? 0, W: RED[4] ?? 0, t: RED[1] ?? 0,
    })
    for (let y = 16; y <= 20; y++) for (let x = 1; x <= 5; x++) emit[y * W + x] = c.get(x, y)
    c.rect(25, 15, 3, 2, NIGHT[4] ?? 0)
    c.rect(25, 16, 3, 1, NIGHT[3] ?? 0)
    for (let y = G; y < H; y++) for (let x = 0; x < W; x++) c.set(x, y, NIGHT[y === G ? 2 : 1] ?? 0)
    const mirrors: Mirror[] = [
      { x0: FASCIA.x, x1: FASCIA.x + FASCIA.w - 1, y: 10, ramp: PINK, top: 2, weight: x => FASCIA_STROKES[x - FASCIA.x] ?? 0 },
      { x0: DOOR.x, x1: DOOR.x + DOOR.w - 1, y: 19, ramp: WARM, top: open > 0.5 ? 4 : 3, weight: streaky },
      { x0: 7, x1: 9, y: 18, ramp: WARM, top: 2, weight: streaky },
      { x0: 1, x1: 5, y: 18, ramp: RED, top: 3, weight: x => (x === 1 || x === 5 ? 0.5 : 1) },
      { x0: GAP.x0 + 2, x1: GAP.x1 - 2, y: 18, ramp: HAZE, top: 2, weight: () => 0.8 },
      { x0: BAR_SIGN.x + 1, x1: BAR_SIGN.x + BAR_SIGN.w - 2, y: 6, ramp: CYAN, top: 3, weight: x => BAR_STROKES[x - BAR_SIGN.x - 1] ?? 0 },
      { x0: LOWER_SIGN.x, x1: LOWER_SIGN.x + LOWER_SIGN.w - 1, y: 16, ramp: HAZE, top: flick >= 1 ? 3 : 1, weight: streaky },
      { x0: VENDING.x + 1, x1: VENDING.x + VENDING.w - 2, y: 17, ramp: CYAN, top: 3, weight: streaky },
      { x0: MARQUEE.x, x1: MARQUEE.x + MARQUEE.w - 1, y: 12, ramp: RED, top: 2, weight: x => 0.5 * streaky(x) },
    ]
    for (let y = G + 1; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const isPuddle = inPuddle(x, y)
        const ripple = mod(y + Math.round(1.4 * Math.sin(x * 0.45 + y)), 4)
        if (!isPuddle && ripple === 0) continue
        const sx = isPuddle ? x + Math.round(Math.sin(y * 2.3 + (f / LOOP) * Math.PI * 2 * 6) * 0.7) : x
        let best = -1
        let bestScore = 0
        for (const m of mirrors) {
          if (sx < m.x0 || sx > m.x1) continue
          const peak = G + 1 + (G - m.y) * 0.3
          const along = y < peak ? 1 - (peak - y) / (peak - G + 0.5) : 1 - (y - peak) / 10
          const k = m.weight(sx) * along * (isPuddle ? 1.3 : 1)
          const band = k >= 0.55 ? 0 : k >= 0.2 ? 1 : -1
          if (band < 0) continue
          const color = rampStep(m.ramp, m.top - band + (isPuddle ? 1 : 0))
          const score = luma(color)
          if (score > bestScore) {
            best = color
            bestScore = score
          }
        }
        if (best >= 0) c.set(x, y, best)
      }
    }
    for (let x = GAP.x0 + 1; x < GAP.x1; x++) c.set(x, G, HAZE[0] ?? 0)
    const drawNoren = () => {
      const swing = sway(f)
      for (let p = 0; p < 4; p++) {
        const x0 = DOOR.x + p * 3 + (p > 1 ? 1 : 0)
        const isLifted = f >= DUCK && f < DUCK + 4 && (p === 1 || p === 2)
        const off = Math.round(swing * (p < 2 ? -1 : 1) * (p === 0 || p === 3 ? 0.5 : 1))
        for (let j = 0; j < (isLifted ? 3 : 5); j++) {
          const dx = j >= 3 ? off : 0
          for (let i = 0; i < 3; i++) {
            if (i === 2 && p !== 1 && p !== 3) continue
            c.set(x0 + i + dx, 14 + j, j === (isLifted ? 2 : 4) ? (HAZE[2] ?? 0) : (HAZE[1] ?? 0))
          }
        }
      }
      c.rect(DOOR.x - 1, 14, DOOR.w + 2, 1, NIGHT[0] ?? 0)
    }
    if (f < DUCK) drawNoren()
    const wx = Math.round(walkerX(f))

    const step = Math.floor((START_X - walkerX(f)) / STRIDE) % 4
    const bob = step % 2 === 1 ? -1 : 0
    const umbrellaY = FEET - 12 + bob
    const isSheltered = (x: number, y: number) => f < CLOSE && y >= umbrellaY && Math.abs(x - wx + 1) <= 4
    drawRain(c, emit, lamps, f, 'far', isSheltered)
    const pixels: [number, number, string][] = []
    if (f < GONE) {
      const isBack = f >= TURN
      const ducking = f >= DUCK
      const legs = isBack ? BACK.slice(7) : (LEGS[step] ?? [])
      const body = [...(isBack ? BACK.slice(0, 7) : BODY), ...(bob ? [legs[0] ?? '', ...legs] : legs)]
      const ox = isBack ? 2 : 3
      body.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
          const ch = row[i] ?? '.'
          const lean = ducking && j < 3 ? 1 : 0
          if (ch !== '.') pixels.push([wx - ox + i, FEET - body.length + 1 + j + lean - (ducking ? Math.min(2, f - DUCK) : 0), ch])
        }
      })
      const u = f < CLOSE ? 0 : f < CLOSE + 2 ? 1 : f < CLOSE + 4 ? 2 : -1
      const umbrella = UMBRELLA[u]
      if (umbrella) {
        const uw = umbrella[0]?.length ?? 0
        umbrella.forEach((row, j) => {
          for (let i = 0; i < row.length; i++) {
            const ch = row[i] ?? '.'
            if (ch !== '.') pixels.push([wx - 1 - Math.floor(uw / 2) + i, umbrellaY + j + (u === 2 ? 2 : 0), ch])
          }
        })
        for (let y = umbrellaY + umbrella.length + (u === 2 ? 2 : 0); y < FEET - 5 + bob; y++) pixels.push([wx - 1, y, 'k'])
      } else if (f < DUCK) {
        for (let y = FEET - 5; y <= FEET - 1; y++) pixels.push([wx + 2, y, 'k'])
      }
    }
    const isFigure = new Set(pixels.filter(([, , ch]) => ch !== 'g' && ch !== 'o').map(([x, y]) => y * W + x))
    const [nearest, rimPower] = strongest(lamps, wx, FEET - 5, 2.2)
    const rimLamp = nearest && rimPower > 0.1 ? nearest : undefined
    const rimDx = rimLamp ? clamp(wx, rimLamp.x0, rimLamp.x1) - wx : 0
    const rimSide: readonly [number, number] = rimDx ? [Math.sign(rimDx), 0] : [0, -1]
    const walkerColor = (ch: string, x: number, y: number) => {
      const behind = c.get(x, y)
      const isBright = luma(behind) > 0.3
      if (ch === 'g') return snap(mix(behind, 0xd8e4ff, isBright ? 0.25 : 0.42))
      if (ch === 'o') return isBright ? (NIGHT[1] ?? 0) : (caught(lamps, x, y, 2.5) ?? (HAZE[4] ?? 0))
      if (f >= GONE - 3 && isBright) return WARM[[1, 3, 4][f - GONE + 3] ?? 4] ?? 0
      if (ch === 'k' || isBright) return NIGHT[0] ?? 0
      if (rimLamp && !isFigure.has((y + rimSide[1]) * W + x + rimSide[0])) return rampStep(rimLamp.ramp, rimPower > 0.35 ? 5 : 4)
      const isBacklit = x >= DOOR.x - 1 && x <= DOOR.x + DOOR.w && y >= 15 && y < G
      if (isBacklit) return NIGHT[0] ?? 0
      if (ch === 's') return 0x8a5a4a
      return ch === 'c' ? (NIGHT[5] ?? 0) : ch === 'a' ? (NIGHT[4] ?? 0) : ch === 'l' ? (NIGHT[2] ?? 0) : (NIGHT[0] ?? 0)
    }
    for (const [x, y, ch] of pixels) {
      if (ch === 'g' || y >= FEET - 1) continue
      const ry = 2 * FEET + 1 - y
      if (ry < H) c.set(x, ry, snap(mix(c.get(x, ry), walkerColor(ch, x, y), inPuddle(x, ry) ? 0.6 : 0.35)))
    }
    const colors = pixels.map(([x, y, ch]) => walkerColor(ch, x, y))
    pixels.forEach(([x, y], i) => c.set(x, y, colors[i] ?? 0))
    if (f >= DUCK) drawNoren()
    for (let y = 0; y < 27; y++) {
      c.set(POLE_X, y, lit(NIGHT[3] ?? 0, lamps, POLE_X + 1, y, 1.5))
      c.set(POLE_X - 1, y, NIGHT[1] ?? 0)
    }
    c.rect(POLE_X - 5, 2, 10, 1, NIGHT[0] ?? 0)
    const wire = (x0: number, y0: number, x1: number, y1: number, sag: number) => {
      for (let x = x0; x <= x1; x++) {
        const t = (x - x0) / (x1 - x0)
        const y = Math.round(y0 + (y1 - y0) * t + sag * 4 * t * (1 - t))
        c.set(x, y, luma(c.get(x, y)) > 0.05 ? (NIGHT[0] ?? 0) : (NIGHT[4] ?? 0))
      }
    }
    wire(POLE_X + 4, 2, 63, 3, 1)
    wire(0, 3, POLE_X - 5, 2, 2.5)
    wire(POLE_X + 2, 3, 63, 6, 1)
    const steam = new Float32Array(W * H)
    const puff = (px: number, py: number, r: number, a: number) => {
      for (let y = Math.floor(py - r); y <= Math.ceil(py + r); y++) {
        for (let x = Math.floor(px - r); x <= Math.ceil(px + r); x++) {
          if (x < 0 || x >= W || y < 0 || y >= H) continue
          const d = Math.hypot(x - px, (y - py) * 1.2) / r
          if (d < 1) steam[y * W + x] = (steam[y * W + x] ?? 0) + a * (1 - d * d)
        }
      }
    }
    for (const p of particles(f, LOOP, 16, 36, 3)) {
      const px = 27 + p.age * 6 + Math.sin(p.age * 5 + p.r[1] * 6) * 1.2
      const py = 16 - p.age * 16
      puff(px, py, 1.2 + p.age * 2, (1 - p.age) * Math.min(1, p.age * 5) * 1.1)
    }
    for (const k of [0, 1, 2]) {
      const t = clamp((f - DUCK - 2 - k * 2) / 18)
      if (t <= 0 || t >= 1) continue
      puff(DOOR_X + (k - 1) * 3 + t * 4, 15 - t * 7, 1.4 + t * 2, (1 - t) * 1.2)
    }
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < W; x++) {
        const d = steam[y * W + x] ?? 0
        if (d < 0.3 || isSign(x, y)) continue
        const [l, k] = strongest(lamps, x, y, 2.2)
        const isDense = d > 0.75
        c.set(x, y, l && k > 0.04 ? rampStep(l.ramp, isDense ? 3 : 2) : rampStep(NIGHT, isDense ? 6 : 5))
      }
    }
    for (const p of particles(f, LOOP, 24, 3, 9)) {
      const x = Math.floor(p.r[1] * W)
      const y = G + 1 + Math.floor(p.r[2] * (H - G - 1))
      if (inPuddle(x, y)) continue
      const color = caught(lamps, x, y, 2)
      if (color === undefined) continue
      if (p.t === 0) c.set(x, y, color)
      else if (p.t === 1) {
        c.set(x - 1, y - 1, color)
        c.set(x + 1, y - 1, color)
      }
    }
    for (const p of particles(f, LOOP, 30, 6, 13)) {
      const [px, py] = RIPPLE_SPOTS[Math.floor(p.r[1] * RIPPLE_SPOTS.length)] ?? [0, 0]
      const rx = 0.6 + p.t * 0.7
      const ry = Math.max(0.5, rx * 0.35)
      for (let y = Math.floor(py - ry - 1); y <= Math.ceil(py + ry + 1); y++) {
        for (let x = Math.floor(px - rx - 1); x <= Math.ceil(px + rx + 1); x++) {
          const d = Math.hypot((x - px) / rx, (y - py) / ry)
          if (Math.abs(d - 1) < 0.35 && inPuddle(x, y)) c.set(x, y, snap(mix(c.get(x, y), 0xc0d0ff, p.t < 3 ? 0.35 : 0.2)))
        }
      }
    }
    drawRain(c, emit, lamps, f, 'near', isSheltered)
    out.push(c.px)
  }
  return out
}
export const scene: Scene = {
  verb: 'Precipitating',
  render,
  hero: 58,
  snaps: [
    { frames: [12, 18], box: [37, 12, 45, 31], why: 'the violet sign stutters out and back, and its reflection with it' },
    { frames: [80, 86], box: [37, 12, 45, 31], why: 'the violet sign stutters out and back, and its reflection with it' },
    { box: [2, 1, 8, 5], why: 'the television flickers in the upstairs window' },
    { frames: [69, 79], box: [6, 12, 32, 31], why: 'the walker ducks through the noren and the door breathes out its light' },
    { box: [50, 10, 63, 14], why: 'the marquee steps a pixel at a time, as LEDs do' },
    { box: [0, 0, 63, 26], colors: [PINK, CYAN, WARM, RED, HAZE].flatMap(r => r.slice(2)), why: 'rain: streaks fall three or six pixels a frame and show only while they cross a light' },
  ],
}