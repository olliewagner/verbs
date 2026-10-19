import { TAU, beat, clamp, ease, frames, hash, hex, mod, shade, wave, type Canvas, type Scene } from '../engine'

const W = 64
const LOOP = 72

const BOARD = hex('1a100f 271813 362117 482c1c 5c3a22 72492a 8a5a33')
const FLOOR = hex('22150f 321f15 45291a 5a3720 72482a 8c5a32 a87040')
const STRAW = hex('5a4218 7e5e22 a8822e cfa63e ebc75a f8e28c')
const SKY = hex('9fc6d8 c8e2e8 f2f6ea')
const DUST = hex('4a3a30 6e5a48 94806a b8a68a d6c6a8 ece0c6 fbf4e2')
const LINE = 0x2e2018
const TIN = hex('2a2c34 444852 646a74 8a909a b4bac0 e0e4e4')
const STAR = hex('a86a14 e8aa2a fcd84a fff3a8')
const CAT = { K: 0x2a140c, O: 0xe08a3a, D: 0xa9561f, L: 0xf6dcae, E: 0xc8e64a, P: 0xe47c86 }
const HEN = { K: 0x3a2a2a, W: 0xf4efe4, G: 0xc4bcb2, R: 0xd8352e, Y: 0xf0b432, E: 0x1a1414 }

const FLOOR_Y = 24

const inShaft = (x: number, y: number) => y > 9 && x - 0.9 * y >= 4 && x - 0.9 * y <= 14

function cloudX(f: number): number {
  if (f < 27) {
    const t = beat(f + 0.5, 0, 27.5)
    return 21 + 24 * (1 - (1 - t) ** 1.35)
  }
  if (f < 50) return 45
  const t = beat(f, 50, 71.5)
  return 45 - 24 * t * t
}
const THINNING = [1.23, 1.15, 1.05, 0.93, 0.8, 0.68, 0.56, 0.45, 0.35, 0.27, 0.2, 0.14]

function cloudSize(f: number): number {
  if (f < 22 || f >= 50) return 1
  if (f < 28) return 1 + 0.25 * ease.inOut(beat(f, 22, 27))
  if (f < 40) return THINNING[f - 28] ?? 0
  if (f < 46) return 0
  return ease.outBack(beat(f, 46, 50))
}
type Kind = 'star' | 'paw' | 'foot' | 'feather' | 'tail'
const POPS: readonly (readonly [number, Kind, number])[] = [
  [2, 'star', -2.3], [5, 'paw', 0.3], [8, 'feather', -1.2], [10, 'foot', 2.7], [13, 'star', -0.6],
  [16, 'paw', 3.5], [18, 'feather', -2.5], [21, 'tail', -1.7], [24, 'star', -0.9],
  [47, 'star', -0.7], [47, 'star', -2.5], [48, 'feather', -1.6],
  [52, 'paw', 3.0], [54, 'star', -1.0], [57, 'foot', 0.4], [59, 'feather', -2.1], [62, 'star', -2.6],
  [64, 'paw', -0.2], [67, 'tail', -1.5], [71, 'foot', 2.6],
]
const PUFFS = Array.from({ length: 9 }, (_, k) => ({
  angle: k === 0 ? 0 : ((k - 1) / 8) * TAU + hash(k, 3) * 0.4,
  orbit: k === 0 ? 0 : 6.6 + hash(k, 5) * 1.2,
  size: k === 0 ? 6.4 : k % 2 ? 4.4 : 3.6,
}))
const CAT_ART = [
  '.K...............',
  'KOK........K...K.',
  'KDK..K.K..KOKKKOK',
  'KOK..KKKK.KOOOOOK',
  '.KDKKOOOOKKOEOEOK',
  '.KOKODODOOKLLPLLK',
  '..KOOOOOOOOKLLLK.',
  '..KOOOOOOOOOKKK..',
  '...KOOOOOOOLLK...',
  '...KOKKKKKOLK....',
  '...KOK...KOK.....',
  '...KKK...KKK.....',
]
const HEN_ART = [
  '...RRR......',
  '..KRRRK.....',
  '.KWWEWWK..K.',
  'YYWWWWWK.KWK',
  '.RKWWWWWKKWK',
  '..KWWWWWWWWK',
  '..KWWGGGWWWK',
  '..KWGGGGWWK.',
  '...KWWWWWK..',
  '....KYKYK...',
  '....Y..Y....',
]
function backdrop(c: Canvas, f: number): void {
  c.fill((x, y) => {
    const lit = inShaft(x, y) ? 1.4 : 0
    if (y < FLOOR_Y) {
      if (x >= 3 && x <= 13 && y >= 1 && y <= 8) {
        if (x === 3 || x === 13 || y === 1 || x - 3 === y - 1 + 2) return shade(BOARD, 3)
        return SKY[y < 4 ? 1 : y < 7 ? 2 : 0] ?? 0
      }
      if (y === 10 || y === 11) return shade(BOARD, y === 10 ? 4.6 + lit : 2 + lit * 0.6)
      const plank = Math.floor((x + 1) / 5)
      const seam = (x + 1) % 5 === 0
      const slit = seam && y > 12 && y < 21 && hash(plank, 8) > 0.72
      if (slit) return shade(STRAW, y === 13 || y === 20 ? 2.6 : 3.8)
      const grain = hash(plank, Math.floor(y / 6), 2) > 0.7 ? -0.5 : 0
      const depth = y < 10 ? -0.6 : 0
      return shade(BOARD, seam ? 0.8 + lit * 0.5 : 2.4 + lit + grain + depth + (y - 12) * 0.05)
    }
    const row = y < 26 ? 0 : y < 29 ? 1 : 2
    const isSeam = y === 26 || y === 29
    const joint = row === 1 ? (x + 7) % 21 === 0 : row === 2 ? (x + 15) % 26 === 0 : (x + 3) % 17 === 0
    const shaftFloor = x - 0.9 * Math.min(y, 26) >= 4 + (y - 26) * 0.6 && x - 0.9 * Math.min(y, 26) <= 14 + (y - 26) * 0.9
    return shade(FLOOR, isSeam || joint ? 1 : 3 + (y === FLOOR_Y ? -0.8 : 0) + (shaftFloor ? 1.6 : 0) + (row === 2 ? 0.3 : 0))
  })
  for (let y = 15; y < 27; y++) {
    for (let x = 52; x < W; x++) {
      if (y === 15 && x === 52) continue
      const isTwine = x === 56 || x === 61
      const stripe = (y + (x % 3 === 0 ? 1 : 0)) % 3 === 0 ? -0.8 : 0
      const level = isTwine ? 1 : 3.2 + stripe + (y === 15 ? 1.2 : 0) - (x === 52 ? 1 : 0) - (y > 24 ? 1 : 0)
      c.set(x, y, shade(STRAW, level))
    }
  }
  for (const [x, y] of [[49, 27], [50, 28], [47, 30], [20, 30], [21, 29], [8, 29], [58, 29], [59, 30]] as const) c.set(x, y, shade(STRAW, 3.4))
  for (let k = 0; k < 7; k++) {
    const x = 12 + k * 3.3 + wave(f, LOOP, 1, k * 0.37) * 1.5
    const y = 14 + mod(k * 5.1 - f * 0.15, 11)
    if (inShaft(Math.round(x), Math.round(y))) c.set(x, y, shade(STRAW, 5))
  }
}
const SHAKE = [0, 1, 1, 0, 0, -1, -1, 0]
const TILT = [0, 1, 1, 0, 0, 0, 0, 0]
function pail(c: Canvas, f: number): void {
  const shake = SHAKE[f] ?? 0
  const tilt = TILT[f] ?? 0
  for (let y = 18; y <= 26; y++) {
    const half = 3.4 - (y - 18) * 0.12
    for (let x = Math.round(3.5 - half); x <= Math.round(3.5 + half); x++) {
      const u = (x - 3.5) / half
      const band = y === 19 || y === 25 ? 0.6 : 0
      const level = 3 - u * 1.4 + band + (y === 18 ? 1.4 : 0) - (y === 26 ? 1 : 0)
      c.set(x + shake + (y < 22 ? tilt : 0), y, shade(TIN, level))
    }
  }
  for (let k = 0; k <= 6; k++) {
    const a = Math.PI + (k / 6) * Math.PI
    c.set(3.5 + shake + tilt + Math.cos(a) * 3, 18 + Math.sin(a) * 3.2, shade(TIN, 2))
  }
  if (f <= 1) {
    for (const [dx, dy] of [[1, -4], [3, -3], [4, -1]] as const) c.set(7 + dx + f, 19 + dy - f, STAR[3] ?? 0)
  }
}
function brawlers(c: Canvas, f: number): void {
  const isBlink = f === 37
  const isSquawk = f >= 42 && f < 46
  const lash = f % 4 < 2 ? 0 : 1
  const cat = CAT_ART.map((row, j) => (isBlink && j === 4 ? row.replace(/E/g, 'K') : row))
  const crouch = isSquawk ? 1 : 0
  const lunge = Math.max(0, f - 45)
  const cx = 29 + lunge
  c.sprite(cx, 15 + crouch, cat, CAT)
  if (lash) {
    c.set(cx, 16 + crouch, BOARD[2] ?? 0)
    c.set(cx + 1, 15 + crouch, CAT.K)
    c.set(cx - 1, 16 + crouch, CAT.K)
    c.set(cx, 17 + crouch, CAT.K)
  }
  const hop = f >= 44 && f < 46 ? -1 : 0
  const hx = 46 - lunge
  c.sprite(hx, 16 + hop, HEN_ART, HEN)
  if (isSquawk) {
    c.set(hx, 19 + hop, BOARD[3] ?? 0)
    c.set(hx, 20 + hop, HEN.Y)
    c.set(hx + 1, 20 + hop, HEN.Y)
    c.set(hx + 2, 17 + hop, HEN.W)
    c.set(hx + 3, 16 + hop, HEN.W)
  }
}
function drawCloud(c: Canvas, f: number, cx: number, cy: number, size: number): void {
  if (size <= 0.02) return
  const spin = (cx - 21) / 9
  const puffs = PUFFS.map((p, k) => ({
    x: cx + Math.cos(p.angle + spin) * p.orbit * 1.2 * size,
    y: cy + Math.sin(p.angle + spin) * p.orbit * 0.62 * size,
    r: (p.size + 0.5 * wave(f, LOOP, 6, k * 0.37)) * size,
  }))
  const depth = (x: number, y: number) => {
    let best = -1
    let second = -1
    let at = -1
    puffs.forEach((p, k) => {
      if (y > 27) return
      const d = p.r - Math.hypot(x - p.x, (y - p.y) * 1.1)
      if (d > best) {
        second = best
        best = d
        at = k
      } else if (d > second) second = d
    })
    return { best, second, at }
  }
  for (let y = Math.floor(cy - 14); y <= 27; y++) {
    for (let x = Math.floor(cx - 20); x <= Math.ceil(cx + 20); x++) {
      const { best, second, at } = depth(x, y)
      if (best < 0) continue
      const isEdge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => depth(x + (dx ?? 0), y + (dy ?? 0)).best < 0)
      if (isEdge) {
        c.set(x, y, LINE)
        continue
      }
      const p = puffs[at]
      if (!p) continue
      const nx = (x - p.x) / p.r
      const ny = (y - p.y) / p.r
      const isCrease = second > -0.2 && best < 1.1 && at !== 0
      const light = -(0.55 * nx + 0.85 * ny)
      const level = 3.3 + light * 2.1 + (inShaft(x, y) ? 0.9 : 0) - (y > cy + 4 ? 0.7 : 0) - (isCrease ? 1.4 : 0)
      c.set(x, y, shade(DUST, level))
    }
  }
}
const REACH = [0.12, 0.42, 0.72, 0.92, 1, 0.86, 0.7, 0.53, 0.36, 0.2]
const STAR_ART = [
  ['.a.', 'aca', '.a.'],
  ['..a..', '.aba.', 'abcba', '.aba.', '.a.a.'],
  ['..a..', '.aba.', 'abcba', '.aba.', '.a.a.'],
  ['.a.', 'aba', '.a.'],
  ['b'],
]
function drawLimb(c: Canvas, kind: Kind, a: number, age: number, cx: number, cy: number): void {
  const reach = REACH[age] ?? 0
  const ca = Math.cos(a)
  const sa = Math.sin(a)
  const bx = cx + ca * 8.5
  const by = cy + sa * 4.8
  const ex = bx + ca * reach * 7
  const ey = by + sa * reach * 4.6
  if (kind === 'paw') {
    c.line(bx, by, ex, ey, CAT.D)
    c.line(bx, by + 1, ex, ey + 1, CAT.O)
    c.sprite(ex - 2, ey - 1, ['.K.K.', 'KOKOK', 'KOOOK', '.KKK.'], CAT)
  } else if (kind === 'foot') {
    c.line(bx, by, ex, ey, HEN.Y)
    const toe = 0.8 + 1.6 * reach
    for (const da of [-0.7, 0, 0.7]) c.line(ex, ey, ex + Math.cos(a + da) * toe, ey + Math.sin(a + da) * toe, da ? HEN.Y : 0xc88a20)
  } else if (kind === 'tail') {
    for (let k = 0; k <= 2 + 7.5 * reach; k++) {
      const wob = Math.sin(k * 0.9 + age * 0.8) * 1.2
      c.set(bx + ca * k - sa * wob, by + sa * k * 0.8 + ca * wob, k % 3 === 2 ? CAT.D : CAT.O)
    }
  }
}
function drawStar(c: Canvas, a: number, age: number, cx: number, cy: number): void {
  const art = STAR_ART[age]
  if (!art) return
  const half = (art.length - 1) / 2
  const x = Math.round(cx + Math.cos(a) * (12.5 + age * 1.2))
  const y = Math.round(cy + Math.sin(a) * (7.4 + age * 0.9))
  c.sprite(x - half, y - half, art, { a: STAR[1] ?? 0, b: STAR[2] ?? 0, c: STAR[3] ?? 0 })
}
function drawFeather(c: Canvas, age: number, x0: number, y0: number, a: number): void {
  const t = age / 30
  const flick = 1 - (1 - Math.min(1, age / 6)) ** 2
  const x = x0 + Math.cos(a) * 4 * flick + Math.sin(age * 0.35) * 2
  const y = y0 + Math.sin(a) * 3 * flick + Math.max(0, age - 6) * 0.42
  if (y > 27 || t >= 1) return
  const rock = Math.sin(age * 0.35) > 0
  c.sprite(x - 1, y - 1, rock ? ['.ab', 'ab.', 'a..'] : ['ba.', '.ba', '..a'], { a: HEN.G, b: HEN.W })
}
function isRushing(f: number): boolean {
  const g = mod(f, LOOP)
  return Math.abs(cloudX(mod(g + 1, LOOP)) - cloudX(mod(g - 1, LOOP))) > 1.6 && cloudSize(g) >= 1
}

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    backdrop(c, f)
    pail(c, f)
    const cx = cloudX(f)
    const size = cloudSize(f)
    const speed = cloudX(mod(f + 1, LOOP)) - cloudX(mod(f - 1, LOOP))
    const bounce = Math.abs(wave(f + 0.5, LOOP, 9)) * 1.6 * clamp((size - 0.8) * 5)
    const cy = 17.6 - bounce
    if (size > 0.1) {
      for (let x = Math.round(cx - 12 * size); x <= Math.round(cx + 12 * size); x++) c.set(x, 27, shade(FLOOR, 1.4))
    }
    for (let k = 0; k < LOOP; k += 3) {
      const age = mod(f - k, LOOP)
      const vx = cloudX(mod(k + 1, LOOP)) - cloudX(k)
      if (age > 8 || Math.abs(vx) < 0.4 || cloudSize(k) < 1) continue
      const x = cloudX(k) - Math.sign(vx) * (11 + age * 0.6)
      const r = 1 + age * 0.25
      for (let dy = -1; dy <= 0; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (Math.hypot(dx, dy * 1.6) > r || hash(k, dx, dy) < age / 9) continue
          c.set(x + dx, 26 + dy - age * 0.15, shade(DUST, 3.6 - age * 0.25))
        }
      }
    }
    if (f >= 27 && f < 48) brawlers(c, f)
    if (f >= 30 && f < 40) {
      const t = beat(f, 30, 40)
      for (const [wx, wy, s] of [[-12, 25, -1], [13, 24, 1], [-9, 14, -1], [10, 13, 1]] as const) {
        const x = 45 + wx + s * t * 4
        for (let k = 0; k < 4 - Math.floor(t * 4); k++) c.set(x + s * k, wy - t * 2, shade(DUST, 4 - k * 0.4))
      }
    }
    for (const [t0, kind, a] of POPS) {
      const age = mod(f - t0, LOOP)
      if (kind !== 'feather' && kind !== 'star' && age < REACH.length && size > 0.6) drawLimb(c, kind, a, age, cx, cy)
    }
    drawCloud(c, f, cx, cy, size)
    const lines = isRushing(f) ? f : isRushing(f - 1) ? f - 1 : undefined
    if (lines !== undefined) {
      const g = mod(lines, LOOP)
      const back = -Math.sign(cloudX(mod(g + 1, LOOP)) - cloudX(mod(g - 1, LOOP)))
      const reach = lines === f && isRushing(f - 1) ? 1 : 0.5
      for (const [dy, gap, len] of [[-4, 17, 3], [1, 15, 5], [5, 19, 2]] as const) {
        const x0 = cloudX(g) + back * gap
        c.line(x0, cy + dy, x0 + back * Math.max(0, Math.round(len * reach) - 1), cy + dy, shade(DUST, lines === f ? 4.6 : 3.6))
      }
    }
    for (const [t0, kind, a] of POPS) {
      const age = mod(f - t0, LOOP)
      if (kind === 'feather' && age < 30) drawFeather(c, age, cloudX(t0) + Math.cos(a) * 11, 17.6 + Math.sin(a) * 6, a)
      if (kind === 'star' && size > 0.6) drawStar(c, a, age, cloudX(t0), 16.8)
    }
    if (f >= 39 && f < 46 && f % 3 !== 2) {
      const zig = f % 2 ? [[46, 17], [45, 18], [46, 19], [45, 20]] : [[45, 17], [46, 18], [45, 19], [46, 20]]
      for (const [x, y] of zig) c.set(x ?? 0, (y ?? 0) - 3, STAR[f % 2 ? 2 : 3] ?? 0)
    }

    if (f >= 31 && f < 46) {
      const t = f - 31
      const x = 46 + Math.sin(t * 0.5) * 2
      const y = 6 + t * 0.9
      const rock = Math.sin(t * 0.5) > 0
      c.sprite(x - 1, y - 1, rock ? ['.ab', 'ab.', 'a..'] : ['ba.', '.ba', '..a'], { a: HEN.G, b: HEN.W })
    }
  })
}
export const scene: Scene = {
  verb: 'Kerfuffling',
  render,
  hero: 13,
  snaps: [
    { frames: 47, box: [36, 12, 55, 24], colors: [...DUST.slice(1, 6), HEN.W], why: 'they lunge and the brawl cloud bursts back over them at once: the punchline' },
    { frames: 48, box: [35, 8, 55, 24], colors: [LINE], why: 'the burst cloud swells past full size over the last of the brawlers' },
  ],
}