import { TAU, clamp, ease, frames, hash, hex, lerp, loopNoise, mix, mod, noise, shade, threshold, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const SKY = hex('6f93c4 86a6cc 9fb6d2 b9c4d4 d2ced0 e6d4c6 f4d9bc fbe2c0')
const SUN = hex('fbe2c0 fdedd2 fff6e6 fffdf6')
const FAR = hex('6e7798 7f87a6 9097b2 a3a8bf')
const WATER = hex('0d2a45 133a5c 1b4d73 26618a 34779c 4d8faa 6ea7b4 9cc0c0 cbd6c8 ecdcc4')
const FOAM = hex('8fb8c4 c4dfe2 eef8f6 ffffff')
const HULL = hex('2c0c14 561620 86221f b2341f d4502a ea7a44')
const DARK = hex('0c0e18 171a26 232736 343a4e 4c5470')
const CREAM = hex('5a5058 857868 b2a28a d4c4a6 ece0c4 fff8e6')
const GLASS = hex('132838 1e4258 3a6e88 8cc4d4')
const BAND = hex('7a4a10 c08420 eab83c f8dc78')
const ROPE = hex('3e2614 6a4422 9a6a38 c8955a')
const SMOKE = hex('3e3a46 57515c 746c76 948a92 b5aaae d6cac6 eee2d8')
const GULL = hex('2a2c38 6c7284 a8aebc dfe2ea fbfbfa')
const BEAK = 0xe8a13a

const HZ = 13
const SUN_X = 9
const SUN_Y = 5

const TUG = [
  '...................p...........',
  '...........kk......p...........',
  '...........ss......p...........',
  '...........yy...rrrrrrrrr......',
  '...........ss....wgwgwgw.......',
  '...........ss....wwwwwww.......',
  '...........ss..rrrrrrrrrrr.....',
  '...........ss..wwLwgwwgwww...bb',
  '..t........ss..wwLwwwwwwww..bbb',
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  'OhhhhhhhhhhhhhhhhhhhhhhhhhhhhhF',
  '.hhhhohhhhhhhhohhhhhhhhohhhhhFF',
  '..hhhhhhhhhhhhhhhhhhhhhhhhhhhF.',
  '...ddddddddddddddddddddddddd...',
]
const TUG_X = 17
const WL = 25
const TUG_TOP = WL - TUG.length + 1
const STACK_X = TUG_X + 11.5
const BOW_X = TUG_X + 30

const at = (col: number, row: number) => TUG[row]?.[col] ?? '.'

function tugColor(ch: string, col: number, row: number): number | undefined {
  const left = at(col - 1, row) === '.'
  const right = at(col + 1, row) === '.'
  const above = at(col, row - 1)
  switch (ch) {
    case 'p':
      return row === 0 ? 0xfff2c8 : shade(DARK, 2, col, row)
    case 'k':
      return shade(DARK, col === 11 ? 1.6 : 0.6, col, row)
    case 's':
      return shade(DARK, col === 11 ? 2.4 : 1, col, row)
    case 'y':
      return shade(BAND, col === 11 ? 3 : 2, col, row)
    case 'r':
      return shade(CREAM, left ? 5 : right ? 3.6 : 4.4, col, row)
    case 'w': {
      const underRoof = above === 'r'
      return shade(CREAM, 3.4 + (left ? 1 : 0) - (right ? 0.8 : 0) - (underRoof ? 1.2 : 0), col, row)
    }
    case 'g':
      return shade(GLASS, at(col, row - 1) === 'r' || at(col, row - 1) === 'w' ? 1.4 : 2.6, col, row)
    case 'L':
      return row % 2 ? 0xd84a32 : 0xf4ece0
    case 't':
      return shade(DARK, 2.6, col, row)
    case 'b':
      return shade(DARK, above === '.' || above === undefined ? 3.4 : 2, col, row)
    case 'h':
      return shade(HULL, row === 10 ? 4.4 : row === 11 ? 3.4 : 2.4 + (left ? 0.6 : 0), col, row)
    case 'o':
    case 'O':
      return shade(DARK, 1.2, col, row)
    case 'F':
      return shade(ROPE, row === 10 ? 2.8 : 1.6, col, row)
    case 'd':
      return shade(DARK, 1.4, col, row)
  }
  return undefined
}

function heave(f: number): number {
  const bob = 0.6 * wave(f, LOOP, 4, 0.1)
  let swell = 0
  if (f >= 52 && f < 63) swell = -2.2 * ease.inOut(clamp((f - 52) / 10))
  else if (f >= 63 && f < 80) {
    const t = (f - 63) / 17
    swell = (-2.2 + 3.4 * ease.out(clamp((f - 63) / 2))) * (1 - t) ** 2 * Math.cos(t * 3.4)
  }
  return Math.round(bob * (f >= 50 && f < 82 ? 0.3 : 1) + swell)
}
const SLAP = 64
function ripple(x: number, y: number, f: number): number {
  const d = (y - HZ) / (H - 1 - HZ)
  const speed = lerp(0.18, 1.35, d * d)
  const period = speed * LOOP
  const a = ((x + speed * f) / period) * TAU
  const r = period / TAU / lerp(2.2, 7.5, d)
  const slide = noise(Math.cos(a) * r + 40, Math.sin(a) * r * 1.0 + 40, y * 2.3)
  const shimmer = loopNoise(x * 0.45, y * 1.7, f / LOOP, 3, 4)
  return lerp(shimmer, slide, clamp(d * 1.6))
}
const SHORE: Int8Array = (() => {
  const out = new Int8Array(W * H)
  for (let x = 0; x < W; x++) {
    const block = Math.floor(x / 4)
    const h = 1 + Math.floor(hash(block, 3) * 3)
    for (let y = HZ - h; y < HZ; y++) out[y * W + x] = y === HZ - h && hash(block, 4) > 0.5 ? 2 : 1
  }
  const put = (x: number, y: number, v = 1) => {
    if (x >= 0 && x < W && y >= 0 && y < H) out[y * W + x] = v
  }
  for (const cx of [38, 46]) {
    for (let y = 6; y < HZ; y++) {
      put(cx, y)
      put(cx + 3, y)
    }
    for (let x = cx - 4; x <= cx + 6; x++) put(x, 6)
    put(cx + 1, 5)
    put(cx + 2, 5)
    put(cx - 4, 7)
  }
  for (let y = 7; y < HZ; y++) put(58, y)
  put(57, 10)
  put(59, 10)
  for (let y = 9; y < HZ; y++) {
    put(57, y)
    put(59, y)
  }
  return out
})()
type Puff = { born: number; big: boolean }
const PUFFS: Puff[] = Array.from({ length: LOOP / 6 }, (_, i) => ({ born: Math.floor(i / 2) * 12 + (i % 2) * 4, big: i % 2 === 0 }))
const PUFF_LIFE = 30
const GULL_ART: Record<string, string[]> = {
  up: ['k...k', '.gwg.'],
  glide: ['.....', 'kgwgk'],
  down: ['.gwg.', 'k...k'],
  perch: ['...wo', 'kggw.', '.ww..'],
}
const GULL_PAINT = { g: GULL[2] ?? 0, k: GULL[0] ?? 0, w: GULL[4] ?? 0, o: BEAK }
function drawGull(c: { sprite: (x: number, y: number, art: readonly string[], p: Record<string, number>, flip?: boolean) => void }, x: number, y: number, pose: string, flip = false) {
  const art = GULL_ART[pose]
  if (art) c.sprite(Math.round(x), Math.round(y), art, GULL_PAINT, flip)
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const dy = heave(f)
    for (let y = 0; y < HZ; y++) {
      for (let x = 0; x < W; x++) {
        const sun = Math.hypot(x - SUN_X, (y - SUN_Y) * 1.1)
        const level = (y / HZ) * 7.2 + Math.max(0, 1 - sun / 14) * 2
        c.set(x, y, shade(SKY, level, x, y))
        if (sun < 4.6) c.set(x, y, shade(SUN, sun < 2 ? 3 : sun < 3.2 ? 2 : 1, x, y))
      }
    }
    for (let y = 0; y < HZ; y++) {
      for (let x = 0; x < W; x++) {
        const v = SHORE[y * W + x]
        if (v) c.set(x, y, shade(FAR, v === 2 ? 2 : 1 + (y > HZ - 2 ? -1 : 0), x, y))
      }
    }
    for (let y = HZ; y < H; y++) {
      const d = (y - HZ) / (H - 1 - HZ)
      for (let x = 0; x < W; x++) {
        const n = ripple(x, y, f)
        let level = 8.4 - d * 5.4 + (n > 0.68 ? 1 : n < 0.3 && d > 0.3 ? -0.8 : 0)
        if (y === HZ) level = 8.4
        c.set(x, y, shade(WATER, level, x, y))
        const reach = 1 + d * 5
        if (Math.abs(x - SUN_X - d * 2) < reach && n > 0.7) c.set(x, y, n > 0.76 ? 0xfffbea : shade(SUN, 1, x, y))
      }
    }
    for (let row = 0; row < TUG.length; row++) {
      const ry = WL + 1 + (WL - (TUG_TOP + row)) + dy
      if (ry >= H || ry <= WL) continue
      const wob = Math.round(wave(f, LOOP, 8, ry * 0.21) * 0.8)
      for (let col = 0; col < 31; col++) {
        const ch = at(col, row)
        const color = tugColor(ch, col, row)
        if (color === undefined || ch === 'p') continue
        const x = TUG_X + col + wob
        if (ripple(x, ry, f) > 0.66) continue
        c.set(x, ry, mix(color, c.get(x, ry), 0.66))
      }
    }
    const stern = TUG_X + 1
    for (let y = WL - 1; y < H; y++) {
      for (let x = 0; x < stern + 2; x++) {
        const dist = stern - x
        const spread = WL + 0.5 + dist * 0.12
        if (y > spread || (y === WL - 1 && dist > 3)) continue
        const n = ripple(x, y + 7, f)
        const fade = clamp(dist / 30)
        const edge = y >= spread - 1 ? -0.12 : 0
        if (n > 0.38 + fade * 0.42 + edge * -1) c.set(x, y, shade(FOAM, 2.4 - fade * 2.2 + (y <= WL ? 0.6 : 0), x, y))
      }
    }
    TUG.forEach((line, row) => {
      for (let col = 0; col < line.length; col++) {
        const color = tugColor(line[col] ?? '.', col, row)
        if (color !== undefined) c.set(TUG_X + col, TUG_TOP + row + dy, color)
      }
    })
    for (let x = TUG_X + 2; x <= TUG_X + 28; x++) {
      const n = ripple(x, WL + 1, f)
      c.set(x, WL + 1, shade(WATER, n > 0.55 ? 6.4 : 5.2, x, WL + 1))
      if (n > 0.6) c.set(x, WL + dy, shade(FOAM, 1, x, WL))
    }
    const push = 0.5 + 0.5 * wave(f, LOOP, 12, 0.2)
    const slap = f >= SLAP && f < SLAP + 8 ? 1 - (f - SLAP) / 8 : 0
    const bowY = WL + dy
    for (const [bx, by, l] of [[0, 0, 3], [1, 0, 2.4], [0, -1, 2.6], [-1, 1, 2.4], [-3, 1, 1.6], [-5, 1, 1.2], [2, 1, 1.4], [1, -1, 1.6]] as const) {
      const strength = l + push * 0.6 + slap * 2
      if (strength > 1.8 || slap > 0) c.set(BOW_X - 1 + bx, bowY + by, shade(FOAM, strength - 0.6, 0, 0))
    }
    if (f >= SLAP && f < SLAP + 12) {
      const t = f - SLAP
      for (let i = 0; i < 12; i++) {
        const vx = (hash(i, 1) - 0.65) * 1.6
        const vy = -0.8 - hash(i, 2) * 1.5
        const life = 7 + Math.floor(hash(i, 3) * 5)
        if (t >= life) continue
        const x = BOW_X - 1 + vx * t - t * 0.25
        const y = WL - 1 + vy * t + 0.16 * t * t
        c.set(x, y, shade(FOAM, 3 - (t / life) * 2.4, 0, 0))
        if (t < 3 && i % 3 === 0) c.set(x + 1, y, shade(FOAM, 2, 0, 0))
      }
    }
    for (const p of PUFFS) {
      const a = mod(f - p.born, LOOP)
      if (a >= PUFF_LIFE) continue
      const t = a / PUFF_LIFE
      const lift = 1 - (1 - t) ** 1.6
      const x = STACK_X - a * 0.42 - t * t * 3
      const y = TUG_TOP - 0.5 - lift * 12 + heave(mod(p.born, LOOP))
      const r = (p.big ? 1 : 0.75) * (0.8 + ease.out(t) * 2.5)
      const density = (1 - t) ** 0.7 * (p.big ? 1.15 : 1)
      const lobes = [[-0.45, 0.15, 0.75], [0.4, -0.25, 0.8], [0.05, 0.4, 0.7]] as const
      for (let py = Math.floor(y - r * 1.3); py <= Math.ceil(y + r * 1.3); py++) {
        for (let px = Math.floor(x - r * 1.4); px <= Math.ceil(x + r * 1.4); px++) {
          let d = 9
          for (const [ox, oy, k] of lobes) d = Math.min(d, Math.hypot(px - x - ox * r, py - y - oy * r) / (r * k + 0.45))
          if (d > 1) continue
          const dens = density * (1.25 - d * d * 0.5)
          if (dens < 0.28 || (dens < 0.5 && threshold(px, py) > (dens - 0.28) * 4.5)) continue
          const lit = ((x - px) + (y - py)) / Math.max(1, r)
          const band = lit > 0.5 ? 1.4 : lit > -0.3 ? 0.4 : -0.6
          c.set(px, py, shade(SMOKE, 1.3 + band + t * 3.4 + (a < 3 ? -1.2 : 0), px, py))
        }
      }
    }
    if (f % 12 < 2) c.set(TUG_X + 11, TUG_TOP + dy, shade(DARK, 1.6, 0, 0))
    {
      const gx = 44 + 9 * Math.cos((f / LOOP) * TAU)
      const gy = 3.5 + 1.6 * Math.sin((f / LOOP) * TAU * 2)
      const flap = mod(f, 48)
      const pose = flap < 8 ? (['up', 'glide', 'down', 'glide'] as const)[Math.floor(flap / 2) % 4] ?? 'glide' : 'glide'
      drawGull(c, gx, gy, pose, Math.sin((f / LOOP) * TAU) > 0)
    }
    {
      const perchX = TUG_X + 20
      const perchY = TUG_TOP + dy
      const flight = f > SLAP && f < SLAP + 28 ? (f - SLAP) / 28 : -1
      if (flight < 0) {
        const look = f % 48 > 30 && f % 48 < 38
        drawGull(c, perchX, perchY, 'perch', look)
      } else {
        const t = flight
        const up = Math.sin(Math.PI * t)
        const x = perchX - 15 * Math.sin(Math.PI * t) ** 1.3 + 1
        const y = perchY - 9 * up ** 0.6
        const pose = t < 0.35 || t > 0.8 ? (Math.floor(f / 2) % 2 ? 'up' : 'down') : t < 0.6 ? 'glide' : f % 4 < 2 ? 'glide' : 'up'
        drawGull(c, x, y, pose, t < 0.5)
      }
    }
  })
}
const STEPS = Array.from({ length: LOOP }, (_, f) => f).filter(f => heave(f) !== heave(mod(f - 1, LOOP)))
export const scene: Scene = {
  verb: 'Puttering',
  render,
  hero: 40,
  snaps: STEPS.map(f => ({ frames: f, box: [TUG_X - 3, TUG_TOP - 2, BOW_X + 1, H - 1] as const, why: 'the tug bobs a pixel on the swell: hull, cabin, stack, reflection and the wash at its stern step together' })),
}