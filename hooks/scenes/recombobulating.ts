import { Canvas, PALETTE, beat, clamp, ease, hash, hex, lerp, shade, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 80

const WALL = hex('1a201e 26302a 34423a 44564a 586c5a 70846a 8c9c7a a8b48e c6cca8')
const FLOOR = hex('1e120e 2e1c14 422a1a 583822 704828 8a5c32 a6743e')
const TEAK = hex('160c0a 241410 361e16 4a2a1c 603822 7a4a2c 966034')
const GLAZE = hex('2a3460 46568c 7486b4 a8b6d4 d4dcea f2f4f6 ffffff')
const COBALT = hex('0c1250 182a8a 2e4cbc 5a7ad8')
const GOLD = PALETTE.gold
const FUR = hex('07060a 100e14 1c1822 2c2634 443a4a')
const SKY = hex('d8b070 eccb8a f8e2ae fff2d4')
const LEAF = hex('3a4a26 566a30 7a8c3c')

const FLOOR_Y = 27
const TOP_Y = 19
const VX = 42
const VY0 = 4
const ROWS = [7, 5, 5, 7, 9, 11, 11, 11, 11, 9, 9, 7, 7]
const VY1 = VY0 + ROWS.length - 1
const CENTER = { x: VX, y: (VY0 + VY1) / 2 }
const PIVOT = { x: VX + 3.5, y: VY1 + 0.5 }
const FLOAT = 3

type Px = { color: number; shard: number; isCrack: boolean }
const SEEDS: [number, number][] = [
  [41, 4], [44, 6], [39, 7], [43, 9], [38, 11], [46, 10], [41, 12], [45, 14], [39, 15], [42, 16],
]
const VASE: Map<number, Px> = (() => {
  const out = new Map<number, Px>()
  ROWS.forEach((width, r) => {
    const y = VY0 + r
    const half = (width - 1) / 2
    for (let x = VX - half; x <= VX + half; x++) {
      const nx = (x - VX) / (half + 0.5)
      const u = Math.asin(clamp(nx, -1, 1))
      const isBand = r === 1 || r === 4 || r === 11
      const isFlower = r >= 6 && r <= 8 && [-1, 0, 1].some(uc => Math.hypot((u - uc * 0.95) * 2.6, r - 7) < 1.25)
      const isRimEdge = x === VX + half
      const light = 3.4 - nx * 1.5 - (r === 0 ? -0.6 : 0) - (r >= 11 ? 0.5 : 0) - (isRimEdge ? 1 : 0)
      const isSpec = r >= 5 && r <= 6 && x === VX - 3
      let color = isBand || isFlower ? shade(COBALT, 1 + light * 0.5, x, y) : shade(GLAZE, light + 1, x, y)
      if (isSpec) color = GLAZE[6] ?? 0
      let best = 0
      let bestD = Infinity
      SEEDS.forEach(([sx, sy], i) => {
        const d = Math.hypot(x - sx, (y - sy) * 1.1)
        if (d < bestD) {
          bestD = d
          best = i
        }
      })
      out.set(y * W + x, { color, shard: best, isCrack: false })
    }
  })
  for (const [key, p] of out) {
    const right = out.get(key + 1)
    const down = out.get(key + W)
    p.isCrack = (right !== undefined && right.shard !== p.shard) || (down !== undefined && down.shard !== p.shard)
  }
  return out
})()

type Shard = { hx: number; hy: number; restX: number; restY: number; restRot: number; start: number; spin: number }
const SHARDS: Shard[] = SEEDS.map((_, i) => {
  let sx = 0
  let sy = 0
  let n = 0
  for (const [key, p] of VASE) {
    if (p.shard !== i) continue
    sx += key % W
    sy += Math.floor(key / W)
    n++
  }
  return { hx: sx / n, hy: sy / n, restX: 0, restY: 0, restRot: 0, start: 0, spin: 0 }
})
const STIR = 4
const RISE = 6
SHARDS.forEach((s, i) => {
  s.restX = 47 + ((i * 7) % 10) * 1.6 + hash(i, 3) * 1.2
  s.restY = 28.6 + hash(i, 5) * 2.2
  s.restRot = (hash(i, 7) - 0.5) * 3
  s.spin = hash(i, 9) > 0.5 ? 1 : -1
})
;[...SHARDS].sort((a, b) => b.hy - a.hy).forEach((s, k) => (s.start = RISE + k * 1.6))

const FLIGHT = 25
const HEAL = [46, 52] as const
const LAND = [51, 55] as const
const GLINT = [55, 61] as const
const PAT = 61
const TIP = [64, 68] as const
const FALL = [68, 72] as const
const BURST = [73, 79] as const
const TIPPED = 0.55
const DOWN = Math.PI / 2
const IMPACT = { x: 53.4, y: 25 }

const TREMBLE = [0, 1, 0, -1] as const

const glide = (t: number) => (t < 0.25 ? (8 / 3) * t * t : t > 0.75 ? 1 - (8 / 3) * (1 - t) ** 2 : 1 / 6 + (4 / 3) * (t - 0.25))

const rot = (x: number, y: number, a: number): [number, number] => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]

function wholePose(f: number): { x: number; y: number; a: number } {
  if (f < TIP[0]) {
    const lift = FLOAT * (1 - beat(f, LAND[0], LAND[1]) ** 2)
    return { x: CENTER.x, y: CENTER.y - lift, a: 0 }
  }
  const a0 = beat(f, TIP[0], TIP[1]) ** 2 * TIPPED
  const [ox, oy] = rot(CENTER.x - PIVOT.x, CENTER.y - PIVOT.y, a0)
  const tipped = { x: PIVOT.x + ox, y: PIVOT.y + oy }
  if (f < FALL[0]) return { ...tipped, a: a0 }
  const t = beat(f, FALL[0], FALL[1])
  return {
    x: lerp(tipped.x, IMPACT.x, t),
    y: lerp(tipped.y, IMPACT.y, t * t),
    a: lerp(TIPPED, DOWN, t),
  }
}

function shardPose(s: Shard, f: number): { x: number; y: number; a: number } | undefined {
  if (f >= BURST[0]) {
    const [ox, oy] = rot(s.hx - CENTER.x, s.hy - CENTER.y, DOWN)
    const t = ease.out(beat(f, BURST[0], BURST[1]))
    const hop = Math.sin(Math.PI * Math.min(1, t * 1.2)) * 4
    return { x: lerp(IMPACT.x + ox, s.restX, t), y: lerp(IMPACT.y + oy, s.restY, t) - hop, a: lerp(DOWN, s.restRot, t) }
  }
  if (f < s.start) {
    const tremble = f >= STIR && f < s.start - 1 ? (TREMBLE[Math.floor((f + Math.round(s.hx)) / 2) % 4] ?? 0) * s.spin : 0
    return { x: s.restX + tremble, y: s.restY, a: s.restRot }
  }
  const t = beat(f, s.start, s.start + FLIGHT)
  if (t >= 1) return undefined
  const e = glide(t)
  const homeY = s.hy - FLOAT
  return {
    x: lerp(s.restX, s.hx, e),
    y: lerp(s.restY, homeY, e) - Math.sin(Math.PI * t) * 4,
    a: s.restRot * (1 - e),
  }
}

function stamp(c: Canvas, hx: number, hy: number, x: number, y: number, a: number, accept: (p: Px) => boolean, paint: (p: Px) => number): void {
  const reach = 9
  for (let py = Math.floor(y - reach); py <= Math.ceil(y + reach); py++) {
    for (let px = Math.floor(x - reach); px <= Math.ceil(x + reach); px++) {
      const [lx, ly] = rot(px - x, py - y, -a)
      const p = VASE.get(Math.round(hy + ly) * W + Math.round(hx + lx))
      if (p && accept(p)) c.set(px, py, paint(p))
    }
  }
}
type Look = 'down' | 'up' | 'right' | 'front'
function look(f: number): Look {
  if (f < RISE || f >= FALL[0] + 3) return 'down'
  if (f < HEAL[0] - 1) return 'up'
  if (f >= GLINT[0] + 2 && f < PAT + 1) return 'front'
  return 'right'
}
const pawOf = (f: number) => (f < PAT ? 0 : f < PAT + 3 ? ease.out(beat(f, PAT, PAT + 3)) * 0.6 : f < PAT + 5 ? 1 : 1 - ease.inOut(beat(f, PAT + 5, PAT + 9)))
function drawCat(c: Canvas, f: number): void {
  const fur = (lvl: number) => shade(FUR, lvl, 0, 0)
  const l = look(f)
  c.ellipse(29, 15, 4.2, 4.4, (x, y) => fur(1 + (x < 27 ? 1.4 : 0) + (y < 13 ? 0.6 : 0)))
  c.ellipse(32.2, 13.4, 2.2, 3.4, (x, y) => fur(1.2 + (y < 12 ? 0.8 : 0)))
  const tip = Math.round(wave(f, LOOP, 4, 0.1))
  for (const [x, y] of [[25, 18], [26, 18], [27, 18], [28, 18], [24, 17], [23, 16], [23, 15]] as const) c.set(x, y, fur(2))
  c.set(23 + tip, 14, fur(2.6))
  for (let x = 29; x <= 31; x++) c.set(x, 18, fur(1.6))
  const paw = pawOf(f)
  const sx = 33
  const sy = 14
  const ex = lerp(33, 37, paw)
  const ey = lerp(18, 11.5 + (1 - paw) * 0, paw)
  c.line(sx, sy, ex, ey, fur(1.4))
  c.line(sx - 1, sy, ex - 1, ey + (paw > 0.5 ? 1 : 0), fur(1))
  c.set(ex, ey, fur(3))
  const hx = l === 'front' ? 32.5 : l === 'down' ? 34 : 33.5
  const hy = l === 'down' ? 9.5 : l === 'up' ? 8 : 8.5
  c.ellipse((32.2 + hx) / 2, (12 + hy) / 2, 1.8, 2, (x, y) => fur(1.3 + (x < hx - 1 ? 0.8 : 0)))
  c.ellipse(hx, hy, 2.6, 2.2, (x, y) => fur(1.4 + (x < hx - 1 ? 1 : 0) + (y < hy - 1 ? 0.5 : 0)))
  const ear = (x: number, y: number) => {
    c.set(x, y - 1, fur(2.6))
    c.set(x, y, fur(2))
    c.set(x + 1, y, fur(1.4))
  }
  ear(Math.round(hx - 2), Math.round(hy - 2))
  ear(Math.round(hx + 1), Math.round(hy - 2))
  const eye = 0xd6e04a
  const iy = Math.round(hy)
  if (l === 'front') {
    c.set(Math.round(hx - 1), iy, eye)
    c.set(Math.round(hx + 1), iy, eye)
    c.set(Math.round(hx), iy + 1, 0xc87a8a)
  } else {
    c.set(Math.round(hx + 1), iy + (l === 'down' ? 0 : l === 'up' ? -1 : 0), eye)
    c.set(Math.round(hx + 3), iy + (l === 'up' ? 0 : 1), fur(1.6))
  }
}
function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const fg = new Canvas()
    fg.px.fill(-1)
    const isWhole = f >= HEAL[0] && f < BURST[0]
    const healed = (y: number) => f >= HEAL[0] && (y - VY0) / ROWS.length > 1 - beat(f, HEAL[0], HEAL[1])
    const crackPaint = (p: Px, y: number) => {
      if (!p.isCrack || f >= HEAL[1] || f >= TIP[0] || healed(y)) return p.color
      return shade(GOLD, 5.5 + wave(f + y, 6) * 0.8, 0, 0)
    }
    if (isWhole) {
      const pose = wholePose(f)
      const glint = f >= GLINT[0] && f < GLINT[1] ? Math.round(lerp(VX - 5, VX + 5, beat(f, GLINT[0], GLINT[1]))) : -99
      const prev = wholePose(f - 1)
      const smears = f > FALL[0] ? Math.floor(Math.hypot(pose.x - prev.x, pose.y - prev.y) / 2) : 0
      for (let k = smears; k >= 1; k--) {
        const was = wholePose(f - k / (smears + 1))
        stamp(fg, CENTER.x, CENTER.y, was.x, was.y, was.a, () => true, () => GLAZE[2] ?? 0)
      }
      stamp(fg, CENTER.x, CENTER.y, pose.x, pose.y, pose.a, () => true, p => p.color)
      if (f < HEAL[1]) {
        for (const [key, p] of VASE) {
          const x = key % W
          const y = Math.floor(key / W)
          if (p.isCrack && !healed(y)) fg.set(x + pose.x - CENTER.x, y + pose.y - CENTER.y, crackPaint(p, y))
        }
      }
      if (glint > 0) for (let y = VY0 + 5; y <= VY0 + 8; y++) if (Math.abs(glint - VX) < 5) fg.set(glint, y + pose.y - CENTER.y, GLAZE[6] ?? 0)
    } else {
      for (const [i, s] of SHARDS.entries()) {
        const pose = shardPose(s, f)
        if (pose) {
          stamp(fg, s.hx, s.hy, pose.x, pose.y, pose.a, p => p.shard === i, p => p.color)
          continue
        }
        for (const [key, p] of VASE) {
          if (p.shard !== i) continue
          const x = key % W
          const y = Math.floor(key / W)
          fg.set(x, y - FLOAT, p.isCrack ? shade(GOLD, 5 + wave(f + y, 6) * 0.8, 0, 0) : p.color)
        }
      }
    }
    drawCat(fg, f)
    const c = new Canvas()
    const isShadow = (x: number, y: number) => fg.get(x - 3, y - 1) >= 0 && y < TOP_Y + 1
    const sun = (x: number, y: number) => clamp(1.05 - x / 80)
    for (let y = 0; y < FLOOR_Y; y++) {
      for (let x = 0; x < W; x++) {
        const stripe = (x % 6 === 0 ? -0.5 : 0)
        const shadow = isShadow(x, y) ? -1.6 : 0
        c.set(x, y, shade(WALL, 1.4 + sun(x, y) * 4.6 + stripe + shadow - (y > 22 ? 0.6 : 0), x, y))
      }
    }
    for (let y = 2; y <= 16; y++) {
      for (let x = 1; x <= 11; x++) {
        const isBar = x === 1 || x === 11 || y === 2 || y === 16 || x === 6 || y === 9
        if (isBar) {
          c.set(x, y, shade(TEAK, 4 + (x === 11 || y === 16 ? -1.4 : 0), x, y))
          continue
        }
        const leaf = Math.hypot(x - 4, y - 15) < 3.2 || Math.hypot(x - 9.5, y - 14.5) < 2.4
        c.set(x, y, leaf ? shade(LEAF, 1 + (y < 14 ? 1 : 0) + (x < 4 ? 0.5 : 0), x, y) : shade(SKY, 3.4 - (y - 2) * 0.12, x, y))
      }
    }
    for (let x = 0; x <= 12; x++) c.set(x, 17, shade(TEAK, 5, x, 17))
    for (let k = 0; k < 6; k++) {
      const x = Math.round(14 + k * 4.5 + wave(f, LOOP, 1, k * 0.37) * 2)
      const y = Math.round(4 + ((k * 5) % 13) + wave(f, LOOP, 2, k * 0.21) * 1.5)
      if (fg.get(x, y) < 0) c.set(x, y, shade(WALL, 8, 0, 0))
    }
    for (let y = FLOOR_Y; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const isJoint = (x + (y - FLOOR_Y) * 9) % 13 === 0 && y > FLOOR_Y
        const isGap = y === 29
        c.set(x, y, shade(FLOOR, 2.2 + sun(x, 12) * 2.4 + (y - FLOOR_Y) * 0.25 - (isGap || isJoint ? 1 : 0), x, y))
      }
    }
    for (let x = 12; x <= 48; x++) {
      c.set(x, TOP_Y, shade(TEAK, 5.6 + sun(x, TOP_Y) * 0.6, x, TOP_Y))
      c.set(x, TOP_Y + 1, shade(TEAK, 3.2, x, TOP_Y + 1))
      for (let y = TOP_Y + 2; y <= TOP_Y + 4; y++) {
        const isSplit = x === 30 || y === TOP_Y + 4
        c.set(x, y, shade(TEAK, 2.4 + sun(x, y) * 1.2 - (isSplit ? 1.2 : 0) - (x === 48 ? 1 : 0), x, y))
      }
      for (let y = TOP_Y + 5; y < FLOOR_Y + 1; y++) {
        const isLeg = x === 13 || x === 14 || x === 46 || x === 47
        if (isLeg) c.set(x, y, shade(TEAK, x === 13 || x === 46 ? 3.2 : 2, x, y))
        else c.set(x, y, shade(WALL, 0.6 + (y - TOP_Y) * 0.05, x, y))
      }
    }
    for (let x = 12; x <= 50; x++) c.set(x, FLOOR_Y + 1, shade(FLOOR, 1, x, FLOOR_Y + 1))
    for (const [x, dy] of [[24, 0], [28, 0], [36, 0], [40, 0]] as const) c.set(x, TOP_Y + 3 + dy, shade(GOLD, 4, 0, 0))
    for (let x = VX - 5; x <= VX + 5; x++) {
      c.set(x, VY1 + 1, shade(TEAK, 4.6 + (x === VX - 5 ? 0.8 : 0), x, VY1 + 1))
      if (Math.abs(x - VX) === 4 || Math.abs(x - VX) === 1) c.set(x, VY1 + 2, shade(TEAK, 2.2, x, VY1 + 2))
    }
    for (const s of SHARDS) {
      const pose = shardPose(s, f)
      if (pose && pose.y > FLOOR_Y && Math.abs(pose.y - s.restY) < 0.5) {
        for (let dx = -1; dx <= 1; dx++) c.set(pose.x + dx + 1, Math.round(pose.y) + 1, shade(FLOOR, 0.6, 0, 0))
      }
    }
    for (let i = 0; i < W * H; i++) {
      const v = fg.px[i] ?? -1
      if (v >= 0) c.px[i] = v
    }
    if (f === LAND[1] || f === LAND[1] + 1) {
      const r = f === LAND[1] ? 0 : 1
      for (const dx of [-6 - r, 6 + r]) c.set(VX + dx, VY1 + (r ? 0 : 1), GLAZE[6] ?? 0)
    }
    if (f >= BURST[0] && f < BURST[0] + 4) {
      const t = f - BURST[0]
      for (let k = 0; k < 14; k++) {
        const a = Math.PI + (k / 13) * Math.PI
        const d = 2 + t * 2.4 * (0.6 + hash(k, 1) * 0.6)
        const x = IMPACT.x + Math.cos(a) * d * 1.6
        const y = 29 + Math.sin(a) * d * 0.7 + t * t * 0.3
        c.set(x, y, shade(GLAZE, 6 - t * 1.2, 0, 0))
      }
      if (t === 0) c.ellipse(IMPACT.x, 29, 6, 2, (x, y) => shade(GLAZE, 5.5 - Math.abs(x - IMPACT.x) * 0.3, x, y))
    }
    if (f >= STIR && f < STIR + 3) {
      for (const s of SHARDS) c.set(Math.round(s.restX), Math.round(s.restY) - 1, shade(GOLD, 5 + (f % 2), 0, 0))
    }
    out.push(c.px)
  }

  return out
}

const drop = (frames: number, box: readonly [number, number, number, number], colors: readonly number[]) => ({
  frames,
  box,
  colors,
  why: 'the vase drops off the sideboard and smashes on the boards',
})
export const scene: Scene = {
  verb: 'Recombobulating',
  render,
  hero: HEAL[0],
  snaps: [
    drop(70, [41, 5, 56, 19], GLAZE.slice(2, 7)),
    drop(72, [56, 20, 59, 22], [GLAZE[2] ?? 0]),
    drop(73, [55, 28, 59, 30], GLAZE.slice(4, 6)),
    drop(74, [55, 18, 58, 22], [...GLAZE.slice(5, 7), COBALT[3] ?? 0]),
    drop(74, [48, 24, 52, 26], [...GLAZE.slice(4, 6), ...COBALT.slice(2, 4)]),
  ],
}