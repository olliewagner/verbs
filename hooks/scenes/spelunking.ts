import { TAU, ease, frames, hash, hex, lerp, mod, noise, shade, smoothstep, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 64

const ROCK = hex('060509 0d0a12 15111b 201924 2d2330 3d2f3b 524043 6c5549 8a6d52 ad8c62 d2b47c')
const COOL = hex('060509 0a1220 0f1f38 15304f 1d4668 285f80 377a96')
const HAZE = hex('060509 120d14 1e161b 2e2220 44321f 5e4628 7d5e34 a07c46 c49e5e e6c884')
const CRYSTAL = hex('0c1a36 15306a 1f56a0 2f88c8 56bfe2 9de9f0 e8fffa')
const AMETHYST = hex('1c0b2c 371350 5e2178 9a3c9c d672c0 f6bde0')
const WATER = hex('03060b 07101b 0c1b2b 132b3d 1f4250 336264 5e8c80 a8bc94')
const FG = 0x020103

const POOL_Y = 26
const POOL_X0 = 19
const POOL_X1 = 41
const DRIP_X = 30

const ceilY = (x: number) => 2.6 + 1.3 * Math.sin(x * 0.23 + 1) + 0.4 * Math.sin(x * 0.61 + 2) + Math.max(0, 8 - x) * 0.9
function floorY(x: number): number {
  if (x <= 13) return 23
  if (x < POOL_X0) return 23 + (x - 13) * 0.6
  if (x <= POOL_X1) return POOL_Y + 1 + 3.6 * Math.sqrt(Math.max(0, 1 - ((x - 30) / 11.5) ** 2))
  return 25.5 - Math.sin(x * 0.5) * 0.6
}

type Spike = readonly [x: number, half: number, len: number]
const STALACTITES: Spike[] = [[12, 1.5, 6], [16, 1, 4], [20, 2, 8], [25, 1, 5], [DRIP_X, 1.5, 6], [34, 1, 4], [38, 2, 7], [42, 1, 4], [46, 1.5, 6], [49, 1, 3], [57, 1.5, 7]]
const STALAGMITES: Spike[] = [[16, 1, 3], [44, 1.5, 4]]

const MAP = (() => {
  const m = new Uint8Array(W * H)
  for (let x = 0; x < W; x++) {
    const isPool = x >= POOL_X0 && x <= POOL_X1
    for (let y = 0; y < H; y++) {
      const isRock = y < ceilY(x) || y >= floorY(x)
      m[y * W + x] = isRock ? 1 : isPool && y >= POOL_Y ? 2 : 0
    }
  }
  for (const [sx, half, len] of STALACTITES) {
    const base = Math.floor(ceilY(sx))
    for (let y = base; y < base + len; y++) {
      for (let x = sx - 3; x <= sx + 3; x++) {
        if (Math.abs(x - sx) <= half * (1 - (y - base) / len) + 0.3) m[y * W + x] = 1
      }
    }
  }
  for (const [sx, half, len] of STALAGMITES) {
    const base = Math.ceil(floorY(sx))
    for (let y = base; y > base - len; y--) {
      for (let x = sx - 3; x <= sx + 3; x++) {
        if (Math.abs(x - sx) <= half * (1 - (base - y) / len) + 0.3) m[y * W + x] = 1
      }
    }
  }
  return m
})()
const isRock = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H && MAP[y * W + x] === 1
const DRIP_TIP = Math.floor(ceilY(DRIP_X)) + 5

const STRATA = Float32Array.from({ length: W * H }, (_, i) => Math.floor(noise((i % W) * 0.16, Math.floor(i / W) * 0.45, 0, 7) * 3) * 0.4 - 0.4)

const FLECKS: [number, number][] = []
for (let y = 1; y < 20; y++) {
  for (let x = 12; x < 58; x++) if (isRock(x, y) && !isRock(x, y + 1) && hash(x, y, 5) < 0.13) FLECKS.push([x, y])
}

type Lamp = { x: number; y: number; a: number }
const HALF = 0.21

function beam(l: Lamp, x: number, y: number, reach = 110, falloff = 0.5): number {
  const dx = x - l.x
  const dy = y - l.y
  const d = Math.hypot(dx, dy)
  const da = Math.abs(mod(Math.atan2(dy, dx) - l.a + Math.PI, TAU) - Math.PI)
  const cone = 0.7 * smoothstep(HALF, HALF * 0.8, da) + 0.3 * smoothstep(HALF * 0.55, HALF * 0.4, da)
  const spill = 0.13 * smoothstep(HALF * 2.6, HALF, da)
  const near = d < 3 ? 0.4 : 0
  return (cone + spill) * Math.max(0, 1 - d / reach) ** falloff + near
}

function depth(l: Lamp, x: number, y: number): number {
  const n = Math.ceil(Math.hypot(x - l.x, y - l.y) * 2)
  let count = 0
  let px = -99
  let py = -99
  for (let i = 1; i <= n; i++) {
    const ix = Math.round(l.x + ((x - l.x) * i) / n)
    const iy = Math.round(l.y + ((y - l.y) * i) / n)
    if (ix === px && iy === py) continue
    px = ix
    py = iy
    if (isRock(ix, iy) && ++count > 3) return count
  }
  return count
}

const GLOWS = [[50, 23, 15, 0.8], [55, 24, 10, 0.5]] as const
function glow(x: number, y: number, f: number): number {
  let sum = 0
  GLOWS.forEach(([gx, gy, r, p], i) => {
    sum += p * (0.8 + 0.2 * wave(f, LOOP, 2, i * 0.3)) * Math.max(0, 1 - Math.hypot(x - gx, (y - gy) * 1.4) / r) ** 1.3
  })
  return sum
}

type Crystal = { x: number; y: number; a: number; len: number; w: number; ramp: readonly number[] }
const CRYSTALS: Crystal[] = [
  { x: 50, y: 25.5, a: -1.78, len: 11, w: 3.4, ramp: CRYSTAL },
  { x: 46.5, y: 25.5, a: -2.35, len: 6, w: 2.4, ramp: AMETHYST },
  { x: 53.5, y: 25.5, a: -1.2, len: 8, w: 2.8, ramp: CRYSTAL },
  { x: 56.5, y: 26, a: -0.75, len: 5, w: 2.2, ramp: AMETHYST },
  { x: 51.5, y: 26.5, a: -2.1, len: 4, w: 2, ramp: CRYSTAL },
]
const ROOST_X = 53
const ROOST_Y = Math.ceil(ceilY(ROOST_X))
const FLY_START = 35
const FLY_END = 52
type Bat = { x: number; y: number; isFlying: boolean } | undefined
function batAt(f: number): Bat {
  if (f < FLY_START) return { x: ROOST_X, y: ROOST_Y, isFlying: false }
  if (f >= FLY_END) return undefined
  const t = ((f - FLY_START) / (FLY_END - FLY_START)) ** 1.25
  const u = 1 - t
  const bx = u ** 3 * 53 + 3 * u * u * t * 46 + 3 * u * t * t * 20 + t ** 3 * -10
  const by = u ** 3 * 6 + 3 * u * u * t * 22 + 3 * u * t * t * 17 + t ** 3 * 2
  return { x: Math.round(bx), y: Math.round(by + Math.sin(f * 1.9) * 0.6), isFlying: true }
}

const HANG = ['.b.', 'bbb', 'bBb', 'bbb', 'ese', 'b.b']
const FLAPS = [
  ['b.......b', 'bb.....bb', '.bb.b.bb.', '..bbbbb..', '...beb...', '....b....'],
  ['...b.b...', 'bbbbbbbbb', '.b.bebb.b', '...bbb...', '....b....'],
  ['...b.b...', '..bbebb..', '.bbbbbbb.', 'bb..b..bb', 'b.......b'],
]
const STAND = [
  '...yyy..',
  '..yYYYy.',
  '.hyyyyyL',
  '...hff..',
  '...hfs..',
  '..pjjj..',
  '.ppjjjj.',
  '.ppjjak.',
  '..pjjj..',
  '..tttt..',
  '..tt.tt.',
  '.bbb.bbb',
]
const CROUCH = [
  '...yyy..',
  '..yYYYy.',
  '.hyyyyyL',
  '...hff..',
  '..pjjjs.',
  '.ppjjjj.',
  '.ppjjak.',
  '..pjjj..',
  '..ttttt.',
  '.bbb.bbb',
]
const BEND = [
  '...yyy..',
  '..yYYYy.',
  '.hyyyyyL',
  '...hff..',
  '...hfs..',
  '..pjjj..',
  '.ppjjjj.',
  '.ppjjak.',
  '..pjjj..',
  '..ttttt.',
  '.bbb.bbb',
]
const LOW = [
  '...yyy..',
  '..yYYYy.',
  '.hyyyyyL',
  '..phff..',
  '.ppjjjs.',
  '.ppjjjk.',
  '..pjjj..',
  '..ttttt.',
  '.bbb.bbb',
]
const DUCK = [
  '..yyy...',
  '.yYYYy..',
  'hyyyyyyL',
  '.pjhff..',
  'ppjjjjk.',
  'ppjjjjj.',
  '.ttttt..',
  '.bbb.bbb',
]
const POSES = [STAND, BEND, CROUCH, LOW, DUCK]
const FIGURE: Record<string, number> = {
  y: 0xc9921f, Y: 0xeec14e, h: 0x5a3818, L: 0xfffbe6, f: 0xc98a63, s: 0x5a3818,
  p: 0x3b3a2a, j: 0x8e3326, a: 0x5a3818, k: 0xc98a63, t: 0x262838, b: 0x141017,
}
const CAVER_X = 3
const CAVER_FEET = 22
const poseAt = (f: number) => (f < 43 || f > 52 ? 0 : f < 47 ? f - 42 : f < 50 ? 4 : 53 - f)
const lampY = (pose: number) => CAVER_FEET + 1 - (POSES[pose] ?? STAND).length + 2

const POOL_A = 0.56
const ROOST_A = Math.atan2(ROOST_Y + 2.5 - lampY(0), ROOST_X - CAVER_X - 7)
const smooth = (t: number) => smoothstep(0, 1, t)
const ANGLES = (() => {
  const keys: [number, number, (t: number) => number][] = [
    [0, POOL_A, ease.inOut], [6, POOL_A + 0.04, ease.inOut], [17, -0.48, smooth], [24, 0.06, smooth],
    [29, ROOST_A, ease.outBack], [35, ROOST_A, ease.inOut],
  ]
  const at = (f: number): number => {
    for (let k = 0; k < keys.length - 1; k++) {
      const [f0, a0] = keys[k] ?? [0, 0]
      const [f1, a1, fn] = keys[k + 1] ?? [0, 0, ease.inOut]
      if (f >= f0 && f < f1) return lerp(a0, a1, fn((f - f0) / (f1 - f0)))
    }
    return ROOST_A
  }
  const track = (f: number) => {
    const b = batAt(f - 1)
    return b ? Math.atan2(b.y + 2 - lampY(0), b.x - CAVER_X - 7) : ROOST_A
  }
  const out: number[] = []
  for (let f = 0; f < LOOP; f++) {
    if (f < FLY_START) out.push(at(f))
    else if (f < 43) out.push(lerp(ROOST_A, track(f), smoothstep(FLY_START, FLY_START + 3, f)))
    else if (f < 49) out.push(lerp(out[42] ?? ROOST_A, 1.0, smooth((f - 42) / 7)))
    else if (f < 58) out.push(lerp(1.0, POOL_A, ease.inOut((f - 49) / 9)))
    else out.push(POOL_A)
  }
  return out
})()
const DROP_FALL = 57
const DROP_LAND = 62
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const pose = poseAt(f)
    const lamp: Lamp = { x: CAVER_X + 7, y: lampY(pose), a: ANGLES[f] ?? POOL_A }
    const was = ANGLES[mod(f - 1, LOOP)] ?? POOL_A
    const trail = [1 / 3, 2 / 3].map(s => ({ ...lamp, a: lerp(lamp.a, was, s) }))
    const light = (x: number, y: number, reach?: number, falloff?: number) => {
      let b = beam(lamp, x, y, reach, falloff)
      trail.forEach((l, i) => {
        b = Math.max(b, beam(l, x, y, reach, falloff) * (0.8 - i * 0.2))
      })
      return b
    }
    const warmAt = new Float32Array(W * H)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const kind = MAP[y * W + x]
        if (kind === 2) continue
        const b = light(x, y)
        const d = b > 0.02 ? depth(lamp, x, y) : 9
        const strata = STRATA[y * W + x] ?? 0
        const cool = glow(x, y, f)
        if (kind === 1) {
          const isUnderwater = x >= POOL_X0 && x <= POOL_X1 && y > POOL_Y
          const warm = isUnderwater ? 0 : b * (d === 1 ? 1 : d === 2 ? 0.6 : d === 3 ? 0.3 : 0)
          warmAt[y * W + x] = warm
          const edge = MAP[(y - 1) * W + x] === 0 || MAP[(y + 1) * W + x] === 0 ? 0.7 : 0
          const wl = 2.4 + edge + warm * 9 + strata * Math.min(1, warm * 3)
          const cl = 1.4 + edge + cool * 4.2 + strata * 0.5
          c.set(x, y, cl > wl + 0.2 ? shade(COOL, cl) : shade(ROCK, wl))
        } else {
          const haze = d === 0 ? light(x, y, 88, 1.1) : 0
          warmAt[y * W + x] = haze
          const wl = 0.6 + haze * 5.6
          const cl = 0.6 + cool * 2.1
          c.set(x, y, cl > wl + 0.2 ? shade(COOL, cl) : shade(HAZE, wl))
        }
      }
    }
    for (let i = 0; i < 9; i++) {
      const x = Math.round(14 + hash(i, 1) * 40 + 2.5 * wave(f, LOOP, 1, hash(i, 2)))
      const y = Math.round(4 + hash(i, 3) * 22 + 1.5 * wave(f, LOOP, 1, hash(i, 4) + 0.25))
      const lit = warmAt[y * W + x] ?? 0
      if (MAP[y * W + x] === 0 && lit > 0.3) c.set(x, y, shade(HAZE, 2.6 + lit * 6.8))
    }
    for (const [x, y] of FLECKS) {
      const lit = warmAt[y * W + x] ?? 0
      if (lit > 0.5) c.set(x, y, CRYSTAL[lit > 0.8 ? 6 : 5] ?? 0)
    }
    for (const k of CRYSTALS) {
      const dx = Math.cos(k.a)
      const dy = Math.sin(k.a)
      const half = k.w / 2
      const pulse = 0.8 + 0.2 * wave(f, LOOP, 2, k.x * 0.05)
      let tipLit = 0
      for (let y = Math.floor(k.y - k.len - 1); y <= Math.ceil(k.y + 2); y++) {
        for (let x = Math.floor(k.x - k.len - 1); x <= Math.ceil(k.x + k.len + 1); x++) {
          const u = (x - k.x) * dx + (y - k.y) * dy
          const v = -(x - k.x) * dy + (y - k.y) * dx
          if (u < -1 || u > k.len) continue
          const hw = u < k.len - k.w ? half : (half * (k.len - u)) / k.w
          if (Math.abs(v) > hw + 0.05) continue
          const facet = v < -half / 3 ? 1 : v > half / 3 ? -0.9 : 0.2
          const lit = light(x, y)
          if (u > k.len - 1.5) tipLit = Math.max(tipLit, lit)
          c.set(x, y, shade(k.ramp, 1.4 + facet + (u > k.len * 0.55 ? 0.9 : 0) + pulse * 0.6 + lit * 3.4, x, y))
        }
      }
      if (tipLit > 0.75) {
        const tx = Math.round(k.x + dx * k.len)
        const ty = Math.round(k.y + dy * k.len)
        c.set(tx, ty, CRYSTAL[6] ?? 0)
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.set(tx + ox, ty + oy, CRYSTAL[5] ?? 0)
      }
    }
    const bat = batAt(f)
    if (bat) {
      const art = bat.isFlying ? (FLAPS[f % 3] ?? []) : HANG
      const stir = !bat.isFlying && f >= 32 ? f - 31 : 0
      const ox = bat.isFlying ? bat.x - 4 : bat.x - 1
      art.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
          const ch = row[i]
          if (ch === '.' || ch === undefined) continue
          const x = ox + i
          const y = bat.y + j + (stir >= 3 && j > 0 ? 1 : 0)
          const lit = light(x, y)
          if (!bat.isFlying && lit < 0.05) continue
          const isOpen = bat.isFlying || f >= 29
          if (ch === 'e' && isOpen && lit > 0.2) {
            c.set(x, y, shade(HAZE, lit > 0.5 ? 9 : 7))
            continue
          }
          const edge = i === 0 || i === row.length - 1 ? -0.5 : 0
          c.set(x, y, shade(ROCK, (bat.isFlying ? 2.6 : 1) + lit * 6.5 + (ch === 'B' ? 1 : 0) + edge))
        }
      })
      if (stir === 2 || stir === 3) {
        c.set(ox - 1, bat.y + 2 + (stir === 3 ? 1 : 0), shade(ROCK, 1 + light(ox - 1, bat.y + 2) * 6.5))
        c.set(ox - 2, bat.y + 3 + (stir === 3 ? 1 : 0), shade(ROCK, 0.8 + light(ox - 2, bat.y + 3) * 6.5))
      }
    }
    const tf = f - DROP_FALL
    if (f >= 44 && f < DROP_FALL) {
      const swell = (f - 44) / (DROP_FALL - 44)
      c.set(DRIP_X, DRIP_TIP + 1, shade(WATER, 4 + swell * 2))
      if (swell > 0.7) c.set(DRIP_X, DRIP_TIP + 2, shade(WATER, 3 + swell * 2))
    } else if (tf >= 0 && f < DROP_LAND) {
      const y = DRIP_TIP + 2 + 0.75 * tf * tf
      const lit = light(DRIP_X, y)
      c.set(DRIP_X, y, shade(WATER, 6 + lit * 3))
      if (tf >= 2) c.set(DRIP_X, y - 1, shade(WATER, 4 + lit * 2))
    }
    const rings = [0, 4].map(lag => mod(f - DROP_LAND - lag, LOOP))
    for (let y = POOL_Y; y < H; y++) {
      for (let x = POOL_X0; x <= POOL_X1; x++) {
        if (MAP[y * W + x] !== 2) continue
        const k = y - POOL_Y
        const ry = POOL_Y - 1 - k
        let wob = 0
        for (const t of rings) {
          const r = 1 + t * 0.8
          if (t < 16 && Math.abs(Math.hypot(x - DRIP_X, (y - POOL_Y - 1.2) * 3.2) - r) < 1) wob = x < DRIP_X ? -1 : 1
        }
        const src = c.get(x + wob, ry)
        const lum = (((src >> 16) & 255) * 0.3 + ((src >> 8) & 255) * 0.59 + (src & 255) * 0.11) / 255
        const surf = k === 0 ? light(x, y) * 2.2 + 0.5 : 0
        c.set(x, y, shade(WATER, 1 + lum * 9 * (0.85 - k * 0.12) + surf))
      }
    }
    rings.forEach((t, ri) => {
      if (t >= 16) return
      const r = 1 + t * 0.8
      for (let n = 0; n < 48; n++) {
        const th = (n / 48) * TAU
        const x = Math.round(DRIP_X + r * Math.cos(th))
        const y = Math.round(POOL_Y + 1.2 + (r / 3.2) * Math.sin(th))
        if (MAP[y * W + x] === 2) c.set(x, y, shade(WATER, 6.2 - t * 0.22 - ri * 1.2 - (th < Math.PI ? 0 : 0.8) + light(x, y) * 2))
      }
    })
    const splash = mod(f - DROP_LAND, LOOP)
    if (splash === 0) {
      c.set(DRIP_X, POOL_Y - 1, WATER[7] ?? 0)
      c.set(DRIP_X - 1, POOL_Y - 1, WATER[6] ?? 0)
      c.set(DRIP_X + 1, POOL_Y - 1, WATER[6] ?? 0)
    } else if (splash === 1) {
      c.set(DRIP_X, POOL_Y - 2, WATER[7] ?? 0)
      c.set(DRIP_X - 2, POOL_Y - 2, WATER[7] ?? 0)
      c.set(DRIP_X + 2, POOL_Y - 2, WATER[7] ?? 0)
    } else if (splash === 2) {
      c.set(DRIP_X - 3, POOL_Y - 1, WATER[6] ?? 0)
      c.set(DRIP_X + 3, POOL_Y - 1, WATER[6] ?? 0)
    }
    const art = POSES[pose] ?? STAND
    c.sprite(CAVER_X, CAVER_FEET + 1 - art.length, art, FIGURE)
    c.set(lamp.x + 1, lamp.y, HAZE[9] ?? 0)
    for (let y = 0; y < H; y++) {
      const left = 59.5 + 1.4 * Math.sin(y * 0.38 + 1) + Math.max(0, 12 - y) * 0.7 - Math.max(0, y - 25) * 0.9
      for (let x = Math.ceil(left); x < W; x++) {
        const isRim = x === Math.ceil(left)
        c.set(x, y, isRim ? shade(COOL, 0.6 + glow(x - 1, y, f) * 5) : FG)
      }
    }
  })
}
export const scene: Scene = { verb: 'Spelunking', render, hero: 31 }