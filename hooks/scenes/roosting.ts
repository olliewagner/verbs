import { beat, clamp, ease, frames, hex, lerp, mix, mod, noise, shade, type Scene } from '../engine'

const LOOP = 64
const W = 64
const H = 32

const SKY = hex('2f3577 3b3f8c 4d479a 6550a0 8257a0 a35e98 c4688c dc7d80 eb9a78 f4b878 fad390 feecba')
const RIDGE_FAR = hex('5a3f78 6e4880 85507e')
const HILLS = hex('140f28 1d1636 271d44 352654')
const ROCK = hex('050307 0b0810 120d18 1a1321 241a2c 312236 432b40 5a3546 774349 9a5750 bc7356')
const BAT = hex('07050a 0f0a12 1a1018 281820')
const GLOW = hex('2a1218 3e1a1e 5a241f 7c3424')
const RIM = hex('4a2a44 6e3e54 98585e c47a68')

const q = (t: number) => Math.round(clamp(t) * 4) / 4

const HORIZON = 22
const SUN_X = 37
const SLOT_X = [42, 33, 24, 15, 6, -3, -12]
const PERCH = 5

const ceilingY = (x: number) => 4.6 + (x > 46 ? (x - 46) * 0.7 : 0) + (x < 9 ? (9 - x) * 0.6 : 0) + (x > 26 && x < 30 ? 0.6 : 0)
const floorY = (x: number) => 24.6 + Math.sin(x * 0.23 + 1) * 1.1 + Math.sin(x * 0.61) * 0.45

const STALACTITES: [number, number][] = [[19.5, 3], [28.5, 2], [37.5, 4], [48.5, 5]]
const STALAGMITES: [number, number, number][] = [[10, 27, 18], [13.5, 26, 21.5], [55, 26, 17.5]]

function isSpike(x: number, y: number): boolean {
  for (const [sx, len] of STALACTITES) {
    const t = (y - ceilingY(sx)) / len
    if (t >= 0 && t <= 1 && Math.abs(x - sx) <= (1 - t) * 1.7) return true
  }
  for (const [sx, base, tip] of STALAGMITES) {
    const t = (base - y) / (base - tip)
    if (t >= 0 && t <= 1 && Math.abs(x - sx) <= (1 - t) * 2.4 + 0.3) return true
  }
  return false
}

function isOpen(x: number, y: number): boolean {
  const a = Math.atan2(y - 15, x - 32)
  const ragged = noise(Math.cos(a) * 2.6 + 3, Math.sin(a) * 2.6 + 3, 0, 5) * 0.3
  const inside = Math.abs((x - 32) / 27) ** 2.6 + Math.abs((y - 15) / 14) ** 2.6 < 0.88 + ragged
  return inside && y > ceilingY(x) && y < floorY(x) && !isSpike(x, y)
}

const POOL = { x: 32, y: 28.4, rx: 15, ry: 2.4 }
const isPool = (x: number, y: number) => y >= 27 && ((x - POOL.x) / POOL.rx) ** 2 + ((y - POOL.y) / POOL.ry) ** 2 <= 1

const DIST: Float32Array = (() => {
  const d = new Float32Array(W * H).fill(99)
  const open: [number, number][] = []
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isOpen(x, y)) open.push([x, y])
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let best = 99
      for (const [ox, oy] of open) best = Math.min(best, Math.hypot(x - ox, (y - oy) * 1.3))
      d[y * W + x] = best
    }
  }
  return d
})()

function skyLevelAt(x: number, y: number): number {
  const d = Math.hypot((x - SUN_X) / 4, (y - HORIZON) * 0.85)
  return 11.4 - d * 0.62
}

function landscape(x: number, y: number): number {
  const far = 20.4 + Math.sin(x * 0.13 + 0.4) * 1.1 + Math.sin(x * 0.37) * 0.3
  const ridge = 22.3 + Math.sin(x * 0.19 + 2) * 0.7
  const pine = [3, 4, 7, 9, 14, 15, 22, 26, 27, 44, 47, 48, 52].includes(x % 56) ? 1 : 0
  if (y >= ridge - pine) return shade(HILLS, 2.4 - (y - ridge) * 0.8 + (Math.abs(x - SUN_X) < 6 ? 0.6 : 0), x, y)
  if (y >= far) return shade(RIDGE_FAR, 2 - (y - far) * 0.6 + (Math.abs(x - SUN_X) < 7 ? 1 : 0), x, y)
  const isCloud = (y === 11 && x > 27 && x < 46) || (y === 12 && x > 33 && x < 51) || (y === 8 && x > 13 && x < 24)
  return shade(SKY, skyLevelAt(x, y) + (isCloud ? 1.4 : 0), x, y)
}

function rock(x: number, y: number): number {
  const d = DIST[y * W + x] ?? 99
  const lip = Math.round(Math.exp(-(d - 1) / 3.6) * 4.4)
  const lump = noise(x * 0.11, y * 0.18, 0, 3) > 0.55 ? 0.8 : 0
  const isFloor = y > 20 && y >= floorY(x) - 0.5
  const top = isFloor && y < floorY(x) + 1.5 ? 1.2 : 0
  const corner = Math.max(0, Math.hypot((x - 32) / 34, (y - 15) / 19) - 0.6) * 5
  const underside = y < 12 && isOpen(x, y + 1) ? 1.4 : 0
  return shade(ROCK, 1.4 + lip + lump + top + underside - corner, x, y)
}

type Art = readonly string[]
const FOLDED: Art = ['..F.F..', '..BBB..', '..BBB..', '.BBBBB.', '.BBmBB.', 'BBBmBBB', 'BBmBmBB', 'BBmBmBB', '.BBBBB.', '..HHH..', '.HeHeH.', '.E...E.']
const CRACK: Art = [
  '...F.F...', '...BBB...', '...BBB...', '..BBBBB..', '.BBmBmBB.', 'BBmBBBmBB', 'BmmBBBmmB', 'B.BmBmB.B', '..BBBBB..',
  '...HHH...', '..HeHeH..', '..E...E..',
]
const HALF: Art = [
  '....F.F....', '....BBB....', '....BBB....', '...BBBBB...', '..BmBBBmB..', '.BmmBBBmmB.', 'BmmmBBBmmmB',
  'B.B.BBB.B.B', '....BBB....', '....HHH....', '...HeHeH...', '...E...E...',
]
const SPREAD: Art = [
  '......F.F......', '......BBB......', '......BBB......', 'B....BBBBB....B', 'BB..BmBBBmB..BB', 'BmB.BmBBBmB.BmB',
  'BmmBmmBBBmmBmmB', 'BmmmmmBBBmmmmmB', '.B.B.B.B.B.B.B.', '......HHH......', '.....HeHeH.....', '.....E...E.....',
]
const FLY: Art[][] = [
  [['H'], ['H'], ['H'], ['H']],
  [['H.H', '.H.'], ['HHH'], ['.H.', 'H.H'], ['HHH']],
  [['B...B', '.BHB.'], ['BBHBB'], ['.BHB.', 'B...B'], ['BBHBB']],
  [
    ['B.......B', 'BmB...BmB', '.BmBHBmB.', '..B.H.B..'],
    ['...E.E...', 'BBBBHBBBB', '.B.BHB.B.'],
    ['...EHE...', '..BBHBB..', '.BmB.BmB.', 'B.......B'],
    ['...E.E...', 'BBBBHBBBB', '.B.BHB.B.'],
  ],
  [
    ['B...........B', 'BmB.......BmB', '.BmB.E.E.BmB.', '..BmBHHHBmB..', '...B.HHH.B...', '......H......'],
    ['.....E.E.....', '.BBBBHHHBBBB.', 'BmmmBHHHBmmmB', '.B.B..H..B.B.'],
    ['.....E.E.....', '.....HHH.....', '...BBHHHBB...', '..BmmBHBmmB..', '.BmB.....BmB.', 'BB.........BB'],
    ['.....E.E.....', '.BBBBHHHBBBB.', 'BmmmBHHHBmmmB', '.B.B..H..B.B.'],
  ],
  [
    ['B.............B', 'BB...........BB', 'BmB.........BmB', 'BmmB..E.E..BmmB', '.BmmB.HHH.BmmB.', '..BmmBHHHBmmB..', '...B.BHHHB.B...', '.......H.......'],
    ['......E.E......', '.BBBB.HHH.BBBB.', 'BmmmmBHHHBmmmmB', 'BmBmmmHHHmmmBmB', '.B.BB..H..BB.B.'],
    ['......E.E......', '......HHH......', '....BBHHHBB....', '...BmmBHBmmB...', '..BmmB...BmmB..', '.BmB.......BmB.', 'BB...........BB'],
    ['......E.E......', '.BBBB.HHH.BBBB.', 'BmmmmBHHHBmmmmB', 'BmBmmmHHHmmmBmB', '.B.BB..H..BB.B.'],
  ],
]
const sizeOf = (scale: number) => (scale < 0.12 ? 0 : scale < 0.23 ? 1 : scale < 0.44 ? 2 : scale < 0.53 ? 3 : scale < 0.78 ? 4 : 5)

type Placed = { art: Art; x: number; y: number; shear: number; alpha: number; glow: number }

const FLIGHT: [number, number, number, number][] = [
  [0, 36, 19.5, 0.05], [9, 38, 18, 0.13], [17, 41, 16, 0.3], [23, 45, 14.5, 0.6],
  [27, 47, 13.5, 0.85], [29, 49, 11, 1], [31, 45, 8, 1], [32, 42, 5, 1],
]
const FLIGHT_START = 54
const BOB = [1, 0, 0, -1, -1, 0, 0, 1]
const LAND = mod(FLIGHT_START + 32, LOOP)
function flightAt(t: number): { x: number; y: number; scale: number } {
  let i = 0
  while (i + 2 < FLIGHT.length && (FLIGHT[i + 1]?.[0] ?? 0) <= t) i++
  const a = FLIGHT[i] ?? [0, 0, 0, 0]
  const b = FLIGHT[i + 1] ?? a
  const u = clamp((t - a[0]) / Math.max(1, b[0] - a[0]))
  return { x: lerp(a[1], b[1], u), y: lerp(a[2], b[2], u), scale: lerp(a[3], b[3], u) }
}

const MOVE_AT = [33, 36, 39, 42, 45, 48]
const MOVE_FRAMES = 6

function feetX(slot: number, f: number): number {
  const at = MOVE_AT[slot] ?? 99
  const u = beat(f, at, at + MOVE_FRAMES)
  const step = u < 0.5 ? ease.inOut(u * 2) * 0.55 : 0.55 + ease.inOut((u - 0.5) * 2) * 0.45
  const from = SLOT_X[slot] ?? 0
  const to = SLOT_X[slot + 1] ?? from - 9
  return lerp(from, to, step)
}

function swings(slot: number): number[] {
  const out: number[] = []
  let d = slot === 0 ? 3.5 : 0
  let v = slot === 0 ? -0.5 : 0
  for (let f = 0; f < LOOP; f++) {
    if (slot === 0 && f < LAND) {
      out.push(0)
      continue
    }
    out.push(d)
    for (let k = 0; k < 4; k++) {
      const dx = feetX(slot, f + (k + 1) / 4) - feetX(slot, f + k / 4)
      v += (-0.45 * d - 0.3 * v) / 4
      d += v / 4 - dx
    }
  }
  return out
}
const SWING = SLOT_X.map((_, slot) => swings(slot))
function render(): Int32Array[] {
  const bg = new Int32Array(W * H)
  const open = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const isSky = isOpen(x, y)
      open[y * W + x] = isSky ? 1 : 0
      bg[y * W + x] = isSky ? landscape(x, y) : rock(x, y)
    }
  }
  const glowAt = (x: number, y: number) => (open[y * W + x] ? clamp(skyLevelAt(x, y) / 11) : 0)
  return frames(LOOP, (c, f) => {
    c.px.set(bg)

    c.set(14, 8, f % 16 < 2 ? 0xfff6dc : 0xe8d8c8)
    for (const [k, y0] of [[0, 15], [30, 10]] as const) {
      const x = 4 + mod(f + k, LOOP) * 0.9
      const y = Math.round(y0 + Math.sin((f + k) * 0.35) * 0.6)
      const ink = (px: number, py: number) => {
        if (open[Math.round(py) * W + Math.round(px)]) c.set(px, py, mix(c.get(px, py), BAT[1] ?? 0, 0.6))
      }
      ink(x, y)
      if ((f + k) % 4 < 2) {
        ink(x - 1, y - 1)
        ink(x + 1, y - 1)
      }
    }

    const tip = ceilingY(48.5) + 5
    if (f < 44) c.set(48, tip, mix(0x6a4a70, 0xd8c8e8, q(beat(f, 6, 40))))
    else if (f < 48) c.set(48, lerp(tip + 1, 27, ease.in(beat(f, 44, 48))), 0xe0d8f0)

    const placed: Placed[] = []
    for (let slot = 0; slot < SLOT_X.length - 1; slot++) {
      if (slot === 0 && f < LAND) continue
      let art = FOLDED
      if (slot === 0) {
        const since = f - LAND
        art = since < 4 ? SPREAD : since < 6 ? HALF : since < 7 ? CRACK : FOLDED
      }
      if (slot === 3 && f >= 7 && f < 16) art = f < 8 || f >= 15 ? CRACK : f < 9 || f >= 14 ? HALF : SPREAD
      placed.push({ art, x: feetX(slot, f), y: PERCH, shear: SWING[slot]?.[f] ?? 0, alpha: 1, glow: art === FOLDED ? 0 : art === CRACK ? 0.5 : 1 })
    }
    const t = mod(f - FLIGHT_START, LOOP)
    if (t < 32) {
      const p = flightAt(t)
      const size = sizeOf(p.scale)
      const flap = Math.floor(t / 2 + 1) % 4
      const art: Art = FLY[size]?.[flap] ?? ['H']
      const alpha = size < 3 ? 0.45 + p.scale * 1.5 : 1
      const bob = size >= 3 ? BOB[t % 8] ?? 0 : 0
      placed.push({ art, x: Math.round(p.x), y: Math.round(p.y - art.length / 2) + bob, shear: 0, alpha, glow: 1 })
    }
    const parts = new Map<number, string>()
    const alpha = new Map<number, number>()
    const glows = new Map<number, number>()
    for (const b of placed) {
      const w = b.art[0]?.length ?? 0
      b.art.forEach((row, j) => {
        const left = Math.round(b.x + (b.shear * j) / 11) - (w >> 1)
        for (let i = 0; i < row.length; i++) {
          const ch = row[i] ?? '.'
          if (ch === '.') continue
          const x = left + i
          const y = b.y + j
          if (x < 0 || x >= W || y < 0 || y >= H) continue
          const key = y * W + x
          parts.set(key, ch)
          alpha.set(key, b.alpha)
          if (b.glow > 0) glows.set(key, b.glow)
          else glows.delete(key)
        }
      })
    }
    for (const [key, ch] of parts) {
      const x = key % W
      const y = Math.floor(key / W)
      const back = glowAt(x, y)
      let color = BAT[ch === 'H' ? 2 : ch === 'm' ? 2 : ch === 'B' ? 1 : 0] ?? 0
      if (ch === 'm' && glows.has(key)) color = shade(GLOW, (0.6 + back * 3.2) * (glows.get(key) ?? 0), x, y)
      if (ch === 'e') color = back > 0 ? 0x8a5048 : BAT[3] ?? 0
      let rim = 0
      for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0]] as const) {
        if (!parts.has(key + dy * W + dx)) rim = Math.max(rim, glowAt(x + dx, y + dy) * (dy ? 1 : 0.8))
      }
      if (rim > 0.42 && (ch === 'B' || ch === 'H')) color = shade(RIM, (rim - 0.42) * 7, x, y)
      const a = alpha.get(key) ?? 1
      c.set(x, y, a >= 1 ? color : mix(c.get(x, y), color, q(a)))
    }

    for (let y = 27; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!isPool(x, y)) continue
        const wob = Math.round(Math.sin(y * 2.1 + f * 0.39) * 0.6)
        const src = c.get(x + wob, 2 * HORIZON - y + 3)
        const ring = Math.abs(Math.hypot((x - 48) * 0.3, (y - 28.2) * 1.2) - (f - 48) * 0.26)
        const isRing = f >= 49 && f < 60 && ring < 0.4
        const isEdge = !isPool(x, y - 1)
        let color = mix(src, ROCK[2] ?? 0, q(0.28 + (y - 27) * 0.08 + (y % 2) * 0.16))
        const sway = Math.round(Math.sin(y * 1.7 + f * 0.785) * 0.7)
        const glint = Math.abs(x - SUN_X - sway) <= 2 - (y - 27) * 0.5 && (y + Math.floor(f / 4)) % 2 === 0
        if (glint) color = mix(src, 0xfff0c8, 0.4)
        if (isEdge) color = mix(color, ROCK[5] ?? 0, 0.5)
        if (isRing) color = mix(color, 0xfde8c4, q(0.35 * (1 - beat(f, 49, 60))))
        c.set(x, y, color)
      }
    }
    if (f === 48) c.set(48, 27, 0xf6e2d0)
    if (f === 49) {
      c.set(47, 26, 0xc8a0b0)
      c.set(49, 26, 0xc8a0b0)
    }
  })
}
export const scene: Scene = {
  verb: 'Roosting',
  render,
  hero: 20,
  snaps: [
    {
      frames: [21, 22],
      box: [35, 5, 53, 16],
      why: 'The late bat lands: at the lip it brakes with its wings up (frames 20-21), then flips upside down and hangs by its feet in one frame, wings still spread. The flip is the beat of the landing; the wings fold over the next seven frames.',
    },
  ],
}