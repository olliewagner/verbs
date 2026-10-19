import { Canvas, beat, clamp, hash, hex, lerp, shade, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const SKY = hex('1d1a48 2c2560 43307a 63398a 8c4288 b45080 d6667a ec8670 f6a86c fbc874 fde29a fff2c6')
const CLOUD = hex('2a2050 4a2c62 7a3a6c c0587a ee8a74 fcbc7c')
const HILL = hex('3a2450 4c2c5c 5e3664')
const TOWN = hex('1a1028 241634 2e1c3e')
const POLE = hex('0e0814 1a1020 2a1828 6a3432 b85a3a f09a52')
const BIRD = hex('120a14 1c101a 2a1622 3c1e28 54282e')
const RIM = hex('a84a36 e47c44 fbb868')
const CAP = 0x4e2226
const CHEEK = 0xa48690
const BEAK = 0x4a3020
const MOUTH = 0xc0503e
const CHIRP = 0xfff0b8

const SUN_X = 46
const SUN_Y = 27

const WIRE_X0 = 4
const WIRE_Y0 = 12
const WIRE_Y1 = 13
function bounce(f: number): number {
  const kick = (at: number, size: number) => {
    const t = f - at
    return t < 0 ? 0 : size * Math.exp(-t / 7) * Math.sin(t * 0.6)
  }
  return kick(16, 0.8) + kick(40, 2.2)
}
const WIRE: readonly (readonly number[])[] = (() => {
  const cols: number[][] = []
  for (let x = 0; x < W; x++) {
    const u = clamp((x - WIRE_X0) / (W + 4 - WIRE_X0))
    const ys = Array.from({ length: LOOP }, (_, f) => Math.round(lerp(WIRE_Y0, WIRE_Y1, u) + (3.5 + bounce(f)) * 4 * u * (1 - u)))
    for (let pass = 0; pass < 4; pass++) {
      for (let f = 0; f < LOOP; f++) {
        const a = ys[(f + LOOP - 1) % LOOP] ?? 0
        const b = ys[(f + 1) % LOOP] ?? 0
        if (a === b) ys[f] = a
      }
    }
    cols.push(ys)
  }
  return cols
})()
function wireY(x: number, f: number): number {
  return WIRE[clamp(Math.round(x), 0, W - 1)]?.[((f % LOOP) + LOOP) % LOOP] ?? WIRE_Y0
}

type Pose = 'perch' | 'crouch' | 'squash' | 'up' | 'down'
type Bird = { x: number; lift: number; pose: Pose; isLeft: boolean; chirp: number }

const HOME = [13, 24, 35, 46, 57]
const FACING = [false, false, true, false, true]
const CHIRPS: readonly (readonly [number, number])[] = [
  [0, 2], [4, 5], [2, 9], [3, 12], [3, 25], [0, 28], [4, 30],
  [3, 42], [1, 43], [0, 45], [4, 46], [3, 48], [2, 49], [4, 51], [1, 54], [4, 58], [0, 63], [2, 67],
]
const TURNS: readonly (readonly [number, number, number])[] = [
  [0, 20, 44], [3, 6, 18], [4, 22, 56], [3, 43, 60], [4, 62, 68]
]

const TUMBLE = [-1, -2, -3, -4, -5, -5, -6, -6, -5, -4, -3, -1, 0, 2, 3, 5, 6, 6, 5, 4, 3, 2, 1, 0, -1]

function bird(i: number, f: number): Bird {
  let x = HOME[i] ?? 0
  let lift = 0
  let pose: Pose = 'perch'
  let isLeft = FACING[i] ?? false
  for (const [b, a, z] of TURNS) if (b === i && f >= a && f < z) isLeft = !isLeft
  let chirp = -1
  for (const [b, at] of CHIRPS) if (b === i && f >= at && f < at + 3) chirp = f - at

  if (i === 1) {
    if (f >= 11 && f < 14) pose = 'crouch'
    const hop: readonly (readonly [number, number])[] = [[1, 1], [2, 2], [3, 1]]
    const step = hop[f - 14]
    if (step) [x, lift] = [x + step[0], step[1]]
    if (f >= 17 && f < 41) x += 3
    if (f === 41) x += 2
    if (f >= 42 && f < 48) x += 1
    if (f === 47 || f === 48) lift = 1
  }
  if (i === 2) {
    if (f === 16) pose = 'crouch'
    if (f >= 16 && f < 52) x += 1
    if (f >= 17 && f < 40) {
      const isUp = Math.floor((f - 17) / 2) % 2 === 0
      pose = isUp ? 'up' : 'down'
      lift = (TUMBLE[f - 16] ?? 0) + (isUp ? 1 : 0)
      if (f >= 22 && f < 34) x += Math.round(-Math.sin(beat(f, 22, 34) * Math.PI) * 2)
    }
    if (f === 40) pose = 'crouch'
    if (f === 41 || f === 42) pose = 'squash'
    if (f === 43) pose = 'crouch'
    if (f >= 52 && f < 54) lift = 1
    if (f >= 17 && f < 46) isLeft = f < 29
  }
  if (i === 3) {
    if (f >= 41 && f < 50) x += 1
    if (f >= 42 && f < 45) pose = 'crouch'
  }
  if (i === 4 && (f === 8 || f === 9 || f === 60 || f === 61)) lift = 1

  return { x, lift, pose, isLeft, chirp }
}

type Part = 'body' | 'cap' | 'eye' | 'cheek' | 'beak' | 'bib' | 'mouth' | 'foot' | 'wing'

const ART: Record<Pose, readonly string[]> = {
  perch: [
    '......ccc..',
    '.....ccccc.',
    '.....cckEbb',
    '....ddkkBd.',
    '..ddwwwdBd.',
    '.dwwwwwddd.',
    'tdwwwwdddd.',
    't....dddd..',
    '.....f.f...',
  ],
  crouch: [
    '...........',
    '......ccc..',
    '.....ccccc.',
    '.....cckEbb',
    '..ddwwwkBd.',
    'tdwwwwwddd.',
    't.wwwddddd.',
    '.....dddd..',
    '.....f.f...',
  ],
  squash: [
    '...........',
    '...........',
    '......ccc..',
    '.....cckEbb',
    '..ddwwwkBdd',
    'tdwwwwwdddd',
    't.ddddddddd',
    '....dddddd.',
    '.....f.f...',
  ],
  up: [
    '..ww.......',
    '..www.ccc..',
    '...wwccccc.',
    '....wcckEbb',
    '....ddkkBd.',
    '..dddddddd.',
    'tddddddddd.',
    't....dddd..',
    '...........',
  ],
  down: [
    '......ccc..',
    '.....ccccc.',
    '.....cckEbb',
    '....ddkkBd.',
    '..dddddddd.',
    'tdddwwwddd.',
    't...wwwdd..',
    '....ww.....',
    '....w......',
  ],
}
const KIND: Record<string, Part> = { d: 'body', t: 'body', w: 'wing', c: 'cap', E: 'eye', k: 'cheek', b: 'beak', B: 'bib', f: 'foot' }

function shape(pose: Pose, chirp: number): Map<string, Part> {
  const m = new Map<string, Part>()
  const art = ART[pose]
  art.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const kind = KIND[row[i] ?? '.']
      if (kind) m.set(`${i - 6},${j - art.length + 1}`, kind)
    }
  })
  if (chirp >= 0 && chirp < 2) {
    for (const [key, kind] of m) {
      if (kind !== 'beak' || m.get(`${Number(key.split(',')[0]) + 1},${key.split(',')[1]}`) === 'beak') continue
      const [x = 0, y = 0] = key.split(',').map(Number)
      m.set(`${x},${y - 1}`, 'beak')
      m.set(`${x},${y}`, 'mouth')
      m.set(`${x},${y + 1}`, 'beak')
      break
    }
  }

  return m
}

function render(): Int32Array[] {
  const out: Int32Array[] = []

  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const halo = wave(f, LOOP, 2) * 0.35

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = Math.hypot((x - SUN_X) / 1.6, y - SUN_Y)
        const glow = Math.max(0, 1 - d / 26) * 3.2
        c.set(x, y, shade(SKY, y * 0.27 + glow + (d < 11 + halo ? 0.6 : 0), x, y))
      }
    }
    c.disc(SUN_X, SUN_Y, 6.5, (x, y) => shade(SKY, 10.4 + (Math.hypot(x - SUN_X, y - SUN_Y) < 4.5 ? 0.6 : 0), x, y))

    for (const [x0, x1, y, isHigh] of [[30, 62, 2, 1], [40, 56, 4, 0], [6, 28, 3, 1], [-2, 14, 20, 0], [54, 66, 21, 0]] as const) {
      for (let x = x0; x <= x1; x++) {
        const k = Math.min(x - x0, x1 - x) / 3
        if (k < 0.34 && (x + y) % 2 === 0) continue
        const lit = Math.max(0, 1 - Math.hypot((x - SUN_X) / 30, (y - SUN_Y) / 30))
        c.set(x, y, shade(CLOUD, 1.2 + lit * 2.6 + (isHigh ? 0 : 0.4), x, y))
        if (k >= 0.67) c.set(x, y + 1, shade(CLOUD, 2.4 + lit * 3, x, y + 1))
      }
    }

    for (let x = 0; x < W; x++) {
      const hill = Math.round(26 - Math.sin(x * 0.09 + 1) * 1.2 - Math.sin(x * 0.21) * 0.7)
      for (let y = hill; y < H; y++) c.set(x, y, shade(HILL, y === hill ? 2 : 1.2, x, y))
    }
    const roofs: readonly (readonly [number, number, number])[] = [
      [0, 8, 28], [9, 17, 27], [18, 22, 29], [23, 33, 28], [34, 39, 29], [54, 63, 28],
    ]
    for (const [x0, x1, top] of roofs) {
      const mid = (x0 + x1) / 2
      for (let x = x0; x <= x1; x++) {
        const peak = top - Math.round(Math.max(0, (x1 - x0) / 2 - Math.abs(x - mid)) * 0.6)
        for (let y = peak; y < H; y++) c.set(x, y, shade(TOWN, y === peak ? 2 : 1, x, y))
      }
    }
    for (const [x, top] of [[12, 23], [27, 24], [59, 24]] as const) {
      for (let y = top; y < 28; y++) c.set(x, y, TOWN[0] ?? 0)
      c.set(x + 1, top, TOWN[0] ?? 0)
    }
    c.disc(19, 25.5, 3, TOWN[0] ?? 0)
    c.ellipse(21.5, 26.5, 2.2, 1.8, TOWN[0] ?? 0)
    for (let y = 27; y < H; y++) c.set(20, y, TOWN[0] ?? 0)
    for (const [x, y] of [[4, 30], [26, 30], [30, 30], [58, 30], [61, 30]] as const) c.set(x, y, 0xf2b25a)

    for (let y = 0; y < H; y++) {
      c.set(1, y, POLE[1] ?? 0)
      c.set(2, y, POLE[2] ?? 0)
      c.set(3, y, y > 26 ? POLE[3] ?? 0 : POLE[4] ?? 0)
      if (y % 5 === 3 && y > 12) c.set(4, y, POLE[3] ?? 0)
    }
    for (let x = 0; x <= 7; x++) {
      c.set(x, 10, POLE[2] ?? 0)
      c.set(x, 11, x > 3 ? POLE[4] ?? 0 : POLE[1] ?? 0)
    }
    for (const ix of [0, 5]) {
      c.set(ix, 9, POLE[2] ?? 0)
      c.set(ix + 1, 9, POLE[5] ?? 0)
    }

    let prev = wireY(WIRE_X0, f)
    for (let x = WIRE_X0; x < W; x++) {
      const y = wireY(x, f)
      const lit = Math.max(0, 1 - Math.abs(x - SUN_X) / 20)
      c.set(x, y, lit > 0.3 ? 0x4a2a3a : 0x180e1c)
      if (Math.abs(y - prev) > 1) c.set(x, (y + prev) / 2, 0x180e1c)
      prev = y
    }

    for (let i = 0; i < HOME.length; i++) {
      const b = bird(i, f)
      const isFlying = b.pose === 'up' || b.pose === 'down'
      const fy = wireY(b.x, isFlying ? 0 : f) - b.lift
      const m = shape(b.pose, b.chirp)
      const at = (x: number, y: number) => m.get(`${x},${y}`)
      for (const [key, kind] of m) {
        const [lx = 0, ly = 0] = key.split(',').map(Number)
        const sx = b.isLeft ? -lx : lx
        const x = b.x + sx
        const y = fy + ly
        const towardSun = Math.sign(SUN_X - x) * (b.isLeft ? -1 : 1)
        const isRimSide = at(lx + towardSun, ly) === undefined || at(lx, ly + 1) === undefined
        const glow = Math.max(0, 1 - Math.hypot(x - SUN_X, (y - SUN_Y) * 1.4) / 34)
        let color: number
        if (kind === 'eye') color = BIRD[0] ?? 0
        else if (kind === 'cheek') color = CHEEK
        else if (kind === 'beak') color = BEAK
        else if (kind === 'mouth') color = MOUTH
        else if (kind === 'foot' || kind === 'bib') color = BIRD[0] ?? 0
        else if (kind === 'cap') color = CAP
        else if (isRimSide && at(lx, ly + 1) === undefined) color = shade(RIM, glow * 3.4 - 0.2, x, y)
        else if (isRimSide) color = shade(RIM, glow * 2.4 - 0.8, x, y)
        else if (kind === 'wing') color = shade(BIRD, 2.6 + glow, x, y)
        else color = shade(BIRD, 1.2 + glow * 1.6, x, y)
        c.set(x, y, color)
      }
      if (b.chirp >= 0) {
        const dir = b.isLeft ? -1 : 1
        const bx = b.x + dir * 6
        const by = fy - 7
        if (b.chirp < 2) {
          c.set(bx, by - 1, CHIRP)
          c.set(bx + dir, by - 2, CHIRP)
        }
        c.set(bx + dir * (b.chirp === 2 ? 1 : 0), by + 1, CHIRP)
        c.set(bx + dir * (b.chirp === 2 ? 2 : 1), by + 1, b.chirp === 2 ? SKY[10] ?? 0 : CHIRP)
      }
      if (i === 2 && f >= 18 && f < 34) {
        const t = f - 18
        const x = HOME[2] ?? 28
        c.set(x + Math.round(Math.sin(t * 0.7) * 1.5), wireY(x, f) + 2 + Math.round(t * 0.75), hash(t, 1) < 0.5 ? RIM[1] ?? 0 : BIRD[3] ?? 0)
      }
    }

    out.push(c.px)
  }

  return out
}

export const scene: Scene = { verb: 'Flibbertigibbeting', render, hero: 30 }
