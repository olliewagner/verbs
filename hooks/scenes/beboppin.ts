import { Canvas, hash, hex, loopNoise, mod, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 48
const BEAT = 6

const WALL = hex('07050b 0d0912 150d1b 1e1125 2a1630 3a1d3a 52283f 6e3644 8c4a48 a8644c')
const FLOOR = hex('0c0709 1a0e10 2b1714 412218 5a301c 774322 99592b c07a3c e0a060')
const TEAL = hex('061214 0b2225 123438 1b4a4d 286363 3a7f7a 58a095 86c2b0')
const SKIN = hex('1a0c0a 2e1610 4a2418 6b3822 8c4f2e ad6a3e c98a58 e0aa78')
const FELT = hex('0a080c 151218 221d26 332c38 4a4050 625468')
const BRASS = hex('2a1606 4c2a0a 7a4810 a8701a d39a2e efc452 fbe58c fffbe0')
const DOVE = hex('100e16 1d1a26 2e2a3a 444055 5e5a72 7c7792 9f9ab2 c6c0d4')
const WOOD = hex('1a0806 2e0f09 4a180d 6a2612 8d3a18 b05420 d07a34 e8a456')
const BERET = hex('12060a 260a12 40101c 601828 842636 a83a44')
const EBONY = hex('050405 0e0b0e 1a151a 2a2229 3d3238')
const SHIRT = hex('2a2630 4a4652 7a7480 b0a8b0 e6dede')
const SHADOW = hex('030205 07050a 0c0912 140f1c 1e1628 2c1f36 3e2b46 56385a')
const NOTE = hex('3a2a28 6a5040 a8865c dcbc84 f8e4b0 fff8e4')
const CANDLE = hex('3a0c0c 7a1a14 c0381c f07a2a ffc860 fff0b0')

const SX = 31.5
const coneHalf = (y: number) => 10 + y * 0.24
function spot(x: number, y: number): number {
  const q = Math.abs(x - SX) / coneHalf(y)
  return q < 0.62 ? 1 : q < 0.84 ? 0.74 : q < 1 ? 0.48 : q < 1.25 ? 0.16 : 0.05
}

type Part = { ramp: readonly number[]; base: number; gain: number; group: number }
const PARTS: Record<number, Part> = {
  1: { ramp: TEAL, base: 1.2, gain: 3.6, group: 1 },
  2: { ramp: SKIN, base: 1.6, gain: 3.6, group: 1 },
  3: { ramp: FELT, base: 0.8, gain: 2.8, group: 1 },
  4: { ramp: BRASS, base: 2.2, gain: 3.4, group: 1 },
  5: { ramp: EBONY, base: 0, gain: 1, group: 1 },
  6: { ramp: EBONY, base: 0.6, gain: 2.4, group: 1 },
  7: { ramp: SHIRT, base: 1.4, gain: 2.6, group: 1 },
  8: { ramp: TEAL, base: 0.4, gain: 2.6, group: 1 },
  9: { ramp: BRASS, base: 3.6, gain: 3.4, group: 1 },
  10: { ramp: BRASS, base: 0.2, gain: 1.4, group: 1 },
  31: { ramp: DOVE, base: 1, gain: 3.6, group: 2 },
  32: { ramp: SKIN, base: 1.2, gain: 3.6, group: 2 },
  33: { ramp: BERET, base: 1, gain: 3.2, group: 2 },
  34: { ramp: WOOD, base: 1.4, gain: 3.8, group: 3 },
  35: { ramp: EBONY, base: 0.6, gain: 2.4, group: 3 },
  36: { ramp: EBONY, base: 0.6, gain: 2.4, group: 2 },
  37: { ramp: SHIRT, base: 1.2, gain: 2.8, group: 2 },
  38: { ramp: SHIRT, base: 1, gain: 2.4, group: 3 },
  39: { ramp: DOVE, base: 0.4, gain: 2.6, group: 2 },
  40: { ramp: EBONY, base: 0.2, gain: 1, group: 2 },
  41: { ramp: WOOD, base: 0, gain: 0.8, group: 3 },
  61: { ramp: SHADOW, base: 2.4, gain: 3, group: 4 },
  62: { ramp: BERET, base: 0.6, gain: 2, group: 4 },
  63: { ramp: SHADOW, base: 3, gain: 2, group: 4 },
  65: { ramp: SHADOW, base: 2.6, gain: 3, group: 4 },
}

const SAX_KEYS = { h: 3, k: 2, g: 5, t: 1, w: 7, b: 4, B: 9, o: 10, p: 8, s: 6 }
const SAX_UP = [
  '.....hhhh.......',
  '.....hhhh.......',
  '...hhhhhhhh.....',
  '....kkkkkk......',
  '....kkkkgg......',
  '....kkkkkkB.....',
  '.....kkkk.bb....',
  '...tttwwtt..b...',
  '..tttttttttkb...',
  '..ttttttttt.B...',
  '..tttttttt..bBBB',
  '..tttttttttkbbob',
  '..tttttttt..b.b.',
  '...ttttttt..b.b.',
  '...ttttttt..bbb.',
]
const SAX_BACK = [
  '...hhhh.........',
  '...hhhh.........',
  '.hhhhhhhh.......',
  '..kkkkkk........',
  '..kkkkgg........',
  '..kkkkkkB.......',
  '...kkkk.bb...BBB',
  '..tttwwt..b..bob',
  '.ttttttttkb..bb.',
  '.ttttttttt.B.b..',
  '..tttttttt.b.b..',
  '..ttttttttkb.b..',
  '..ttttttt..bbb..',
  '...ttttttt......',
  '...ttttttt......',
]
const SAX_MID = [
  '....hhhh........',
  '....hhhh........',
  '..hhhhhhhh......',
  '...kkkkkk.......',
  '...kkkkgg.......',
  '...kkkkkkB......',
  '....kkkk.bb.....',
  '..ttttwwt..b....',
  '..ttttttttkb.BBB',
  '..ttttttttt.Bbob',
  '..tttttttt..b.b.',
  '..tttttttttkb.b.',
  '..tttttttt..b.b.',
  '...ttttttt..bbb.',
  '...ttttttt......',
]
const SAX_LEGS = ['...pp...pp......', '...pp...pp......', '...pp....pp.....', '..sss....sss....']
const SAX_X = 16
const SAX_Y = 7

const BASSIST_KEYS = { r: 33, k: 32, d: 31, w: 37, x: 39, s: 36, e: 40 }
const BASSIST = [
  '..rrrrr..',
  '.rrrrrrr.',
  '..kkkkk..',
  '.kkekkk..',
  '..kkkkk..',
  '...kkk...',
  '..ddwddd.',
  '.ddddwddd',
  '.dddddddd',
  '.dddddddd',
  '..ddddddd',
  '..ddddddd',
  '..ddddddd',
  '..ddddddd',
  '..xx..xx.',
  '..xx..xx.',
  '..xx..xx.',
  '..xx..xx.',
  '..xx..xx.',
  '.sss..sss',
]
const BASS_KEYS = { w: 34, e: 35, m: 38, f: 41 }
const BASS = [
  '....ww...',
  '...wew...',
  '....e....',
  '....e....',
  '....e....',
  '....e....',
  '....e....',
  '....e....',
  '....e....',
  '...wew...',
  '..wweww..',
  '.wwwewww.',
  '.wwwewww.',
  '..wweww..',
  '.wwwewww.',
  'wfwwewwfw',
  'wwwwewwww',
  'wwwmmmwww',
  'wwwwewwww',
  '.wwwewww.',
  '..wwwww..',
  '....m....',
]
const BASS_X = 32
const BASS_Y = 4
const BASSIST_X = 37
const BASSIST_Y = 6

type Note = { t0: number; isPair: boolean; drift: number }
const NOTES: Note[] = [
  { t0: 3, isPair: false, drift: 0.45 },
  { t0: 10, isPair: true, drift: 0.3 },
  { t0: 15, isPair: false, drift: 0.55 },
  { t0: 27, isPair: false, drift: 0.1 },
  { t0: 30, isPair: true, drift: 0.5 },
  { t0: 33, isPair: false, drift: 0.35 },
  { t0: 36, isPair: true, drift: 0.65 },
  { t0: 41, isPair: false, drift: 0.4 },
]
const EIGHTH = ['.#.', '.##', '.#.', '##.', '##.']
const PAIR = ['.####', '.#..#', '.#..#', '##.##', '##.##']

const isLeaning = (f: number) => f >= 25 && f < 41
const leanOf = (f: number) => (f === 24 || f === 40 ? 1 : isLeaning(f) ? 2 : 0)
const dipOf = (f: number) => (mod(f, BEAT) < 2 ? 1 : 0)
const bellAt = (f: number): [number, number] => [SAX_X + 14, SAX_Y + 10 - 2 * leanOf(f) + dipOf(f)]

const INKS = [...WALL, ...FLOOR, ...TEAL, ...SKIN, ...FELT, ...BRASS, ...DOVE, ...WOOD, ...BERET, ...EBONY, ...SHIRT, ...SHADOW, ...NOTE, ...CANDLE]
const snapped = new Map<number, number>()
function snap(color: number): number {
  const known = snapped.get(color)
  if (known !== undefined) return known
  const [r, g, b] = [(color >> 16) & 255, (color >> 8) & 255, color & 255]
  let best = 0
  let bestD = Infinity
  for (const ink of INKS) {
    const d = 3 * (((ink >> 16) & 255) - r) ** 2 + 4 * (((ink >> 8) & 255) - g) ** 2 + 2 * ((ink & 255) - b) ** 2
    if (d < bestD) [best, bestD] = [ink, d]
  }
  snapped.set(color, best)
  return best
}

function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const smoke = (x: number, y: number) => {
      const n = loopNoise(x * 0.07 + y * 0.05, y * 0.16, f / LOOP, 1, 3)
      return spot(x, y) * (n > 0.6 ? 2.2 : n > 0.45 ? 1.3 : 0.6) * (1 - y / 30)
    }

    for (let y = 0; y < 23; y++) {
      for (let x = 0; x < W; x++) {
        const row = Math.floor(y / 3)
        const isMortar = y % 3 === 2 || (x + (row % 2) * 3) % 6 === 0
        const lit = spot(x, y)
        c.set(x, y, shade(WALL, 1.2 + lit * 3 - (isMortar ? 0.3 + lit * 1.1 : 0) + smoke(x, y), x, y))
      }
    }
    for (let y = 23; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (y >= 28) {
          c.set(x, y, shade(SHADOW, 1, x, y))
          continue
        }
        const pool = ((x - SX) / 17) ** 2 + ((y - 25) / 2.6) ** 2
        const lit = pool < 0.45 ? 1 : pool < 0.75 ? 0.7 : pool < 1 ? 0.45 : 0.1
        const isSeam = y === 24 || (y === 26 && (x + 2) % 9 === 0)
        c.set(x, y, shade(FLOOR, y === 27 ? 1.6 + lit * 3.4 : 1 + lit * 3.6 - (isSeam ? 0.9 : 0), x, y))
      }
    }
    for (const [cx, rx] of [[21.5, 4.5], [38, 5.5]] as const) {
      c.ellipse(cx, 25.4, rx, 0.9, (x, y) => shade(FLOOR, 1.3 + (Math.abs(x - cx) > rx - 1.5 ? 1 : 0), x, y))
    }

    const map = new Canvas()

    const age = mod(f, BEAT)
    const isCrash = f >= 24 && f < 36
    const power = isCrash ? 1.2 - (f - 24) / 14 : 0.45
    for (let x = 47; x < W; x++) map.set(x, 22, 65)
    map.disc(56, 9.4, 1.7, 61)
    map.poly([[53.5, 16], [53.5, 12.2], [54.5, 11.2], [57.5, 11.2], [59, 12.6], [59, 16]], 61)
    map.ellipse(51, 16.6, 2, 0.8, 62)
    map.rect(49, 17, 4, 2, 62)
    map.line(50, 19, 49, 21, 65)
    map.line(52, 19, 53, 21, 65)
    map.disc(55.5, 19, 3.2, 63)
    map.ellipse(61, 17.5, 2, 0.8, 62)
    map.rect(59, 18, 4, 3, 62)
    map.line(49, 11, 49, 21, 65)
    map.line(62, 13, 62, 21, 65)
    map.line(60.5, 12.6, 63.5, 12.6, 65)
    const isUp = age >= 3
    const hand: [number, number] = isUp ? [53, 7] : age === 0 ? [51.5, 9.6] : [52, 9]
    map.line(55, 12, hand[0], hand[1], 61)
    map.line(55, 12.6, 57.4, 15, 61)

    const nod = mod(f + 6, 12) < 2 ? 1 : 0
    const pluck = mod(f, BEAT) < 2 ? 1 : 0
    map.sprite(BASSIST_X, BASSIST_Y + nod, BASSIST.slice(0, 14), BASSIST_KEYS)
    map.sprite(BASSIST_X, BASSIST_Y + 14, BASSIST.slice(14), BASSIST_KEYS)
    map.line(BASSIST_X + 2, BASSIST_Y + 7 + nod, 37.4, 11.6, 31)
    map.sprite(BASS_X, BASS_Y, BASS, BASS_KEYS)
    map.set(36.6, 11, 32)
    map.line(BASSIST_X + 7, BASSIST_Y + 7 + nod, BASSIST_X + 8, BASSIST_Y + 10, 31)
    map.line(BASSIST_X + 8, BASSIST_Y + 10, 39 - pluck, 17, 31)
    map.set(38 - pluck, 17, 32)

    const dip = dipOf(f)
    map.sprite(SAX_X, SAX_Y + dip, [SAX_UP, SAX_MID, SAX_BACK][leanOf(f)] ?? SAX_UP, SAX_KEYS)
    map.sprite(SAX_X, SAX_Y + 15 + dip, SAX_LEGS.slice(dip), SAX_KEYS)

    const flash = age < 2 ? power : 0
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const id = map.get(x, y)
        const p = PARTS[id]
        if (p === undefined) continue
        const same = (dx: number, dy: number) => PARTS[map.get(x + dx, y + dy)]?.group === p.group
        const lit = spot(x, y)
        let level = p.base + lit * p.gain - (y - 8) * 0.05 * lit
        if (p.group === 4) {
          level += !same(-1, 0) ? 1.6 : 0
          const near = Math.hypot(x - 49, y - 10)
          level += (near < 4 ? 2.4 : near < 8 ? 1.2 : 0) * flash
        } else if (p.ramp !== BRASS && id !== 35 && id !== 38) {
          level += !same(0, -1) ? 1.1 * lit : 0
          level -= !same(1, 0) ? 0.7 : 0
        }
        if (id === 34) level += x <= 34 && y >= 14 ? 0.9 * lit : x >= 39 ? -0.7 : 0
        c.set(x, y, shade(p.ramp, level, x, y))
      }
    }
    c.set(SAX_X + 9 - leanOf(f), SAX_Y + 4 + dip, SHIRT[3] ?? 0)
    const bell = bellAt(f)
    c.set(bell[0] + 1, bell[1], BRASS[7] ?? 0)

    const wob = age < 4 ? Math.cos(age * 1.7) * Math.exp(-age * 0.4) * (isCrash ? 1 : 0.6) : 0
    const tilt = 0.6 + Math.round(wob * 2) * 0.35
    const cyX = 49
    const cyY = 10
    const ring = age < 3 ? power * (3 - age) * 0.9 : 0
    c.ellipse(cyX, cyY, 3.4, Math.max(0.4, tilt), (x, y) => shade(BRASS, 1.4 + ring + (y < cyY ? 0.8 : 0) - (x > cyX + 2 ? 0.6 : 0), x, y))
    c.set(cyX, cyY - 1, BRASS[3] ?? 0)
    const step = mod(Math.floor(f / 3), 8)
    const glintX = cyX - 3 + Math.min(step, 6)
    c.set(glintX, cyY, BRASS[age < 2 ? 7 : 5] ?? 0)
    if (isCrash && age < 4) {
      const r = [2, 3, 2, 1][age] ?? 1
      for (let k = 1; k <= r; k++) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          c.tint(glintX + dx * k, cyY + dy * k, BRASS[7] ?? 0, k === r ? 0.45 : 0.85)
        }
      }
    }
    const tip: [number, number] = isUp ? [hand[0] - 1.5, hand[1] - 2] : [hand[0] - 2, hand[1] + 0.2]
    c.line(hand[0], hand[1], tip[0], tip[1], (x, y) => shade(FLOOR, 2 + flash * 3, x, y))

    for (const n of NOTES) {
      const t = mod(f - n.t0, LOOP)
      if (t > 15) continue
      const [bx, by] = bellAt(n.t0)
      const x = bx + t * n.drift + Math.sin(t * 0.55 + n.t0) * 1.2
      const y = by - 2 - t * 0.85
      const level = 1.4 + spot(x, y) * 2.6 - (t > 11 ? (t - 11) * 0.7 : 0)
      if (t === 0) {
        c.set(x, y + 1, NOTE[5] ?? 0)
        continue
      }
      const sprite = n.isPair ? PAIR : EIGHTH
      const shown = sprite.slice(t === 1 ? 3 : t === 2 ? 1 : 0)
      c.sprite(Math.round(x) - 1, Math.round(y) - shown.length + 1, shown, { '#': (px, py) => shade(NOTE, level + (t <= 2 ? 1.5 : 0), px, py) })
    }

    const nodA = mod(f, 12) < 2 ? 1 : 0
    const nodC = mod(f + 6, 12) < 2 ? 1 : 0
    const sil = new Canvas()
    const heads: [number, number, number, number, boolean][] = [
      [5, 26.4, 3, 5.6, false], [19, 27.2 + nodA, 2.6, 5, false], [48, 26.6 + nodC, 2.8, 5.4, true], [60, 27.6, 2.5, 5, false],
    ]
    for (const [hx, hy, r, sw, hasHat] of heads) {
      sil.disc(hx, hy, r, 1)
      sil.ellipse(hx, H + 0.6, sw, 3.4, 1)
      if (hasHat) {
        sil.line(hx - 4, hy - r + 0.6, hx + 4, hy - r + 0.6, 1)
        sil.rect(hx - 2, hy - r - 1.6, 5, 2, 1)
      }
    }
    sil.rect(10, 29, 8, 1, 2)
    sil.rect(13, 30, 2, 2, 2)
    const flicker = hash(f, 3) > 0.5 ? 1 : 0
    for (let y = 20; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const id = sil.get(x, y)
        if (id === 0) continue
        const isTop = sil.get(x, y - 1) === 0
        const near = Math.hypot(x - 14, y - 27.5)
        const candle = near < 3 ? 1 : near < 6 ? 0.5 : 0
        const rim = isTop ? 2 + spot(x, 25) * 3 : 0
        c.set(x, y, shade(SHADOW, 0.4 + rim + candle * 2.6 + (id === 2 ? 1 : 0), x, y))
      }
    }
    c.set(14, 28, CANDLE[2] ?? 0)
    c.set(15, 28, CANDLE[1] ?? 0)
    c.set(14, 27, CANDLE[4 + flicker] ?? 0)
    if (flicker) c.set(14, 26, CANDLE[3] ?? 0)

    out.push(c.px.map(snap))
  }

  return [...out.slice(4), ...out.slice(0, 4)]
}

export const scene: Scene = {
  verb: "Beboppin'",
  render,
  hero: 30,
  snaps: [
    { frames: 20, box: [45, 8, 56, 14], colors: [...SHADOW.slice(6, 8), 0xefc452, 0x4c2a0a, 0xe6dede, 0x7a7480], why: 'the crash: the cymbal flashes and lights the drummer' },
    { frames: 26, box: [46, 8, 49, 13], colors: [0x4c2a0a, 0x7a7480, 0xf8e4b0, 0xfff0b0, 0x3e2b46], why: 'the second crash flashes the cymbal again' },
  ],
}
