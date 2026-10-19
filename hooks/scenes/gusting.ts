import { Canvas, PALETTE, TAU, beat, clamp, ease, frames, hash, hex, mod, particles, type Scene, shade, smoothstep, threshold } from '../engine'

const W = 64
const H = 32
const LOOP = 72
const AXIS = 40
const PEAK = 15
const HORIZON = 22
const FIELD = 25
const HIT = 28
const STRIKE = 13

const SKY = hex('141c22 1c2830 26363e 31454a 3e5658 4e6864 627c6e 7c9474 9aac7a bcc282 dcd890 f2eaae')
const CLOUD = hex('0a0f14 111920 18232a 212e34 2c3a3e 3a4a4a')
const BARN = hex('240a0c 42100f 661816 8c2620 b03a28 cc5636 e07848')
const TRIM = hex('4a5250 828c86 bcc4b4 e4e8d6 fbfcf0')
const ROOF = hex('100e14 1c1820 2a242c')
const COPPER = PALETTE.copper
const IRON = hex('0c0e12 1a1e24 2c3238')
const GRASS = hex('0c1a0e 14281a 1e3c1e 2c5426 3e6c2c 5a8634 7ea042 a8ba58 d0d47a f0ecaa')
const FAR = hex('17241e 1e3024 283c2a 34482e')
const FOLIAGE = hex('060c08 0c180f 15281a 203a22 2e4e2a')
const BARK = hex('080606 100a0a 1c1210 2a1c16')
const STRAW = hex('5a3e14 8e6826 c49a42 e8c66a f8e6a0')
const LEAVES = [0xf0a030, 0xf8cc48, 0xd8642a, 0xb0c44a]

const lull = (f: number) => smoothstep(10, 15, f) * (1 - smoothstep(17, 20, f))
const gust = (f: number) => smoothstep(18, 23, f) * (1 - smoothstep(36, 58, f))
const wind = (f: number) => 0.42 - 0.3 * lull(f) + 0.6 * gust(f) + 0.04 * Math.sin((TAU * f * 6) / LOOP)
const lag = (x: number) => (x + 8) / 4
const windAt = (x: number, f: number) => wind(f - lag(x))
const gustAt = (x: number, f: number) => gust(f - lag(x))

const DRIFT: number[] = (() => {
  const d = [0]
  for (let f = 1; f <= LOOP; f++) d.push((d[f - 1] ?? 0) + 0.3 + wind(f) * 1.4)
  const total = d[LOOP] ?? 1
  return d.map(v => (v * 128) / total)
})()

function heading(f: number): number {
  const calm = 1 - gust(f)
  const flutter = 0.14 * Math.sin((TAU * f * 6) / LOOP) * calm
  const wander = 0.55 * Math.sin(Math.PI * beat(f, 10, 22)) ** 2
  const spin = f < HIT ? 0
    : f < 37 ? 1.07 * ease.out(beat(f, HIT, 37))
    : 1 + 0.07 * Math.cos((Math.PI * (f - 37)) / 4) * Math.exp(-(f - 37) / 6)
  return Math.PI + flutter + wander + TAU * spin
}

const PLATE = [
  '.#..........r.r...',
  '##.........rrrr...',
  '###........##e##..',
  '#.##.......#####=.',
  '#..##......###r...',
  '#...##....####r...',
  '#....##########...',
  '.#...##########...',
  '......########....',
  '........#..#......',
  '.##.....#..#....#.',
  '##################',
  '.##.............#.',
]
const HALF = 9

function drawVane(c: Canvas, f: number, flash: number): void {
  for (let y = 12; y < PEAK; y++) c.set(AXIS, y, shade(IRON, 1.4 + flash))
  for (let x = AXIS - 5; x <= AXIS + 5; x++) c.set(x, 13, shade(IRON, 1 + flash))
  for (const x of [AXIS - 5, AXIS + 5]) c.set(x, 13, shade(COPPER, 4 + flash))

  const a = heading(f)
  const cosA = Math.cos(a)
  const isEdgeOn = Math.abs(cosA) < 0.15
  const plate = new Map<number, string>()
  PLATE.forEach((row, j) => {
    for (let dx = -HALF - 1; dx <= HALF + 1; dx++) {
      const ch = isEdgeOn ? (dx === 0 && row.includes('#') ? '#' : undefined) : row[Math.floor(HALF + (dx + 0.5) / cosA)]
      if (ch !== undefined && ch !== '.') plate.set(j * W + AXIS + dx, ch)
    }
  })
  const face = 4 + Math.abs(cosA) * 1.2
  for (const [key, ch] of plate) {
    const x = key % W
    const y = Math.floor(key / W)
    const open = (dx: number, dy: number) => !plate.has(key + dy * W + dx)
    if (ch === 'e') {
      c.set(x, y, shade(COPPER, 0.6))
      continue
    }
    if (ch === 'r') {
      c.set(x, y, shade(BARN, (open(0, -1) ? 6 : 5) + flash))
      continue
    }
    const rim = (open(0, -1) ? 1.2 : 0) - (open(0, 1) ? 0.8 : 0)
    c.set(x, y, shade(COPPER, face + rim + flash * 1.5))
    if (open(0, 1) && y + 1 < 12) c.set(x, y + 1, shade(IRON, 0.4))
    if (open(1, 0) && !plate.has(key + 1 - W)) c.set(x + 1, y, shade(IRON, 0.6))
  }
}

function barnShape(x: number, y: number): boolean {
  const d = Math.abs(x - AXIS + 0.5)
  if (y < PEAK) return false
  if (y < PEAK + 3) return d <= 2 + (y - PEAK) * 3.5
  if (y < PEAK + 8) return d <= 10 + (y - PEAK - 3) * 1.2
  return d <= 15.5
}

function hatPose(t: number): readonly [number, number, number] | undefined {
  const after = t - HIT
  const spinA = t * 0.9 - Math.max(0, after) * 0.3
  if (t >= 19 && t < HIT) {
    const hp = beat(t, 19, HIT)
    return [-7 + hp * (AXIS - 7 + 7), 19 - 13 * ease.out(hp) + 2 * Math.sin(hp * 6), spinA]
  }
  if (after >= 0 && after < 10) return [AXIS - 7 + after * 3.6, 6 - after * 1.6 + after * after * 0.1, spinA]
  return undefined
}

function drawHat(c: Canvas, [hx, hy, spinA]: readonly [number, number, number], alpha: number, flash: number): void {
  const cs = Math.cos(spinA)
  const sn = Math.sin(spinA)
  for (let y = Math.floor(hy - 5); y <= hy + 5; y++) {
    for (let x = Math.floor(hx - 5); x <= hx + 5; x++) {
      const u = (x - hx) * cs + (y - hy) * sn
      const v = -(x - hx) * sn + (y - hy) * cs
      const isBrim = Math.abs(v) < 0.75 && Math.abs(u) < 5
      const isCrown = v < -0.4 && v > -3.4 && Math.abs(u) < 2.6 - (v < -2.6 ? 0.7 : 0)
      const isBand = isCrown && v > -1.5
      if (!isBrim && !isCrown) continue
      const col = isBand ? 0xb02a22 : shade(STRAW, isBrim ? 3 : 4 - (u > 0 ? 0.8 : 0) + flash)
      if (alpha >= 1 || threshold(x, y) < alpha) c.set(x, y, col)
    }
  }
}

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const drift = DRIFT[f] ?? 0
    const flash = f === STRIKE ? 1 : f === STRIKE + 2 ? 0.6 : f === STRIKE + 3 ? 0.3 : 0

    for (let y = 0; y < HORIZON; y++) {
      for (let x = 0; x < W; x++) {
        const u = ((x - drift) / 64) * TAU
        const glow = Math.max(0, 1 - Math.hypot((x - 18) / 34, (y - 19) / 9))
        const level = 2.6 + y * 0.12 + glow * 7.4 + flash * 2.4
        const bank = 3.2 + 1.8 * Math.sin(u * 2 + 0.6) + 1.2 * Math.sin(u * 3 + 2.1) + Math.sin(u * 5 + 0.3) * 0.6
        const scud = 9.5 + 1.4 * Math.sin(u * 3 + 1.4) + Math.sin(u * 7) * 0.6
        if (y < bank) {
          const isLip = y > bank - 1.2
          c.set(x, y, shade(CLOUD, (isLip ? 3.6 + glow * 2 : 1.4 + (y / bank) * 1.4) + flash * 2))
          continue
        }
        if (y > scud && y < scud + 1.8 + Math.sin(u * 4 + 1) * 0.8) {
          c.set(x, y, shade(SKY, level - 1.2))
          continue
        }
        c.set(x, y, shade(SKY, level))
      }
    }

    for (let y = HORIZON - 1; y < FIELD; y++) {
      for (let x = 0; x < W; x++) {
        const hedge = HORIZON - 1 + (Math.sin(x * 0.33) + Math.sin(x * 0.9) * 0.4 > 0.2 ? 0 : 1)
        if (y < hedge) continue
        c.set(x, y, shade(FAR, y === hedge ? 0.6 : 2 + (y - HORIZON) * 0.4 + flash))
      }
    }

    const lean = Math.round(windAt(6, f) * 2.2)
    for (let y = 13; y < FIELD + 1; y++) {
      const t = (FIELD - y) / 12
      const x = 5 + Math.round(t * t * (1.5 + lean * 0.6))
      c.set(x, y, shade(BARK, 1.6 + flash))
      if (y > 20) c.set(x + 1, y, shade(BARK, 1))
    }
    c.line(6, 18, 3, 15, shade(BARK, 1.6))
    for (const [cx, cy, r] of [[8, 12, 4], [12.5, 14, 3.2], [4, 14, 2.8], [16, 12.5, 2.2]] as const) {
      const ox = cx + lean * (cy < 13 ? 1.2 : 0.8)
      for (let y = Math.floor(cy - r); y <= cy + r; y++) {
        for (let x = Math.floor(ox - r - 1); x <= ox + r + 1; x++) {
          if (Math.hypot((x - ox) / 1.25, y - cy) > r) continue
          c.set(x, y, shade(FOLIAGE, 1.2 + (y < cy - r * 0.4 ? 1 : 0) - (y > cy + r * 0.4 ? 0.8 : 0) + flash * 1.4))
        }
      }
    }

    for (let y = PEAK; y < H; y++) {
      for (let x = AXIS - 16; x <= AXIS + 16; x++) {
        if (!barnShape(x, y)) continue
        const isTrim = !barnShape(x, y - 1) || !barnShape(x - 1, y) || !barnShape(x + 1, y)
        if (isTrim) {
          c.set(x, y, shade(TRIM, (x < AXIS ? 3.2 : 2.4) + flash * 1.4))
          continue
        }
        const isBoard = mod(x - AXIS, 3) === 0
        const under = barnShape(x, y - 2) ? 0 : -1
        c.set(x, y, shade(BARN, 3.4 - (isBoard ? 0.7 : 0) + under + (x < AXIS ? 0.6 : -0.3) - (y - PEAK) * 0.08 + flash * 2))
      }
    }
    for (let x = AXIS - 16; x <= AXIS + 16; x++) {
      for (let y = PEAK - 1; y < HORIZON + 1; y++) {
        if (!barnShape(x, y) && barnShape(x, y + 1)) c.set(x, y, shade(ROOF, 1.4 + flash * 2))
      }
    }
    c.rect(AXIS - 3, 18, 6, 4, shade(BARN, 0.4))
    c.rect(AXIS - 3, 18, 1, 4, shade(BARN, 1.6 + flash))
    for (let x = AXIS - 4; x <= AXIS + 3; x++) c.set(x, 17, shade(TRIM, 3 + flash))
    for (let y = 18; y <= 21; y++) {
      c.set(AXIS - 4, y, shade(TRIM, 2.8 + flash))
      c.set(AXIS + 3, y, shade(TRIM, 2 + flash))
    }
    for (let x = AXIS - 6; x <= AXIS + 5; x++) c.set(x, 23, shade(TRIM, 2.6 + flash))
    c.line(AXIS - 6, 24, AXIS + 5, 30, shade(TRIM, 2.2 + flash))
    c.line(AXIS + 5, 24, AXIS - 6, 30, shade(TRIM, 2 + flash))

    drawVane(c, f, flash)

    const ghost = hatPose(f - 0.5)
    if (ghost && hatPose(f)) drawHat(c, ghost, 0.45, flash)
    const hat = hatPose(f)
    if (hat) drawHat(c, hat, 1, flash)

    for (let x = -2; x < W + 2; x++) {
      const p = clamp(windAt(x, f))
      const bandAt = (y: number) => {
        const roll = Math.sin(TAU * ((x - (y - FIELD) * 2) / 32 - (f * 8) / LOOP))
        return roll > 0.35 ? Math.max(0.3, gustAt(x, f)) : 0
      }
      const band = bandAt(FIELD)
      const press = clamp(p * 0.8 + band * 0.4)
      for (let y = FIELD; y < H; y++) c.set(x, y, shade(GRASS, 2 + p + bandAt(y) * 5.6 - (y - FIELD) * 0.3 + flash))
      if (mod(x, 3) === 2) continue
      const clump = Math.floor(x / 3)
      const tall = 2 + Math.round(hash(clump, 3) * 2.4)
      const h = Math.max(1, Math.round(tall * (1 - press * 0.7)))
      const bend = Math.round(press * 2.6 + (hash(clump, 5) > 0.5 ? 0.4 : 0))
      for (let k = 1; k <= h; k++) {
        const bx = x + Math.round((bend * k) / h)
        c.set(bx, FIELD - k, shade(GRASS, 3.4 + p + band * 4 + flash))
      }
    }

    for (const leaf of particles(f, LOOP, 30, 20, 9)) {
      const born = mod(f - leaf.t, LOOP)
      const isGust = born >= 17 && born <= 44
      if (!isGust && leaf.r[1] > 0.2) continue
      const speed = 1.6 + windAt(10, born) * 3 + leaf.r[2]
      const x = 8 + leaf.r[3] * 8 + leaf.t * speed
      const y = 10 + leaf.r[1] * 8 + Math.sin(leaf.t * 0.7 + leaf.r[0] * 6) * 2.2 + leaf.t * (leaf.r[2] - 0.4) * 0.6
      if (x > W + 2) continue
      const color = LEAVES[leaf.i % LEAVES.length] ?? 0
      const isFlat = Math.sin(leaf.t * 1.1 + leaf.i) > 0
      c.set(x, y, color)
      c.set(x + (isFlat ? -1 : 0), y + (isFlat ? 0 : 1), color)
    }
  })
}

function hatBox(f: number): readonly [number, number, number, number] | undefined {
  const poses = [hatPose(f), hatPose(f - 0.5)].filter(p => p !== undefined)
  if (!poses.length) return undefined
  const xs = poses.map(p => p[0])
  const ys = poses.map(p => p[1])
  const box = [Math.max(0, Math.floor(Math.min(...xs) - 5)), Math.max(0, Math.floor(Math.min(...ys) - 5)), Math.min(W - 1, Math.ceil(Math.max(...xs) + 5)), Math.min(H - 1, Math.ceil(Math.max(...ys) + 5))] as const
  return box[0] <= box[2] && box[1] <= box[3] ? box : undefined
}

export const scene: Scene = {
  verb: 'Gusting',
  render,
  hero: 26,
  snaps: [
    { frames: [STRIKE, STRIKE + 4], why: 'sheet lightning lights the whole picture, goes dark a frame, flickers back and fades' },
    ...Array.from({ length: LOOP }, (_, f) => f).flatMap(f => {
      const box = hatBox(f)
      return box ? [{ frames: f, box, why: 'the hat tumbles past on the gust faster than it overlaps itself; the box is the hat and its smear' }] : []
    }),
    { frames: [HIT + 2, HIT + 4], box: [AXIS - HALF - 1, 0, AXIS + HALF + 2, 12], colors: [...COPPER, ...IRON, ...BARN.slice(5)], why: 'struck by the hat, the vane whips round a quarter turn a frame and goes edge-on' },
    { frames: 39, box: [52, 12, 58, 15], colors: LEAVES, why: 'leaves stripped by the gust tumble past several pixels a frame' },
  ],
}
