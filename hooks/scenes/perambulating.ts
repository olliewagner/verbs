import { PALETTE, TAU, beat, clamp, ease, frames, hash, hex, lerp, mod, particles, shade, type Canvas, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const SKY = hex('101030 181a44 241f52 3a2558 5a2d5e 7e3860 a24a62 c4625e de8a5e f0b46a f8d68a')
const FAR = hex('17153a 211d48 2c2552 382c5c')
const GOLD_LEAF = hex('3a2408 5e3a0c 8a5810 b8801c dca832 f2d062')
const RUST_LEAF = PALETTE.red
const AMBER_LEAF = PALETTE.orange
const BARK = PALETTE.bark
const VERGE = hex('120f16 1c1820 2a2228 3c2e2c 524032')
const GRAVEL = hex('231c26 32283a 463844 5e4c4e 7a6458 9a7e60 bc9a6c')
const IRON = hex('080c0e 101a1a 1a2826 283a34 3c5246')
const FLAME = hex('a1221a d23e1c ef6822 f99832 fcc657 fee996 fffbe0')
const LACQUER = hex('08100e 10201a 1a3428 264a38 36624a 4c7e5c')
const HOOD = hex('08080e 121219 1c1c26 2a2a36 3c3c4a 545464')
const COAT = hex('0c0a10 16121c 211a28 2e2436 3e3246 52445a')
const TROUSERS = hex('1a1820 2a2832 3c3a46 52505c 6a6874')
const SKIN = hex('3a2020 6a3a2e 9a5e46 c88a64 eab48a')
const SCARF = PALETTE.red
const LACE = hex('6e687c 9a94a8 c8c2d2 eeeaf4')
const BRASS = PALETTE.gold

const PATH_Y = 27
const STEP = 16

const gust = (f: number) => Math.sin(Math.PI * beat(mod(f, LOOP), 50, 80)) ** 2
const PUSH: number[] = (() => {
  const sums = [0]
  for (let k = 0; k < LOOP * 2; k++) sums.push((sums[k] ?? 0) + gust(k - LOOP))
  return sums
})()
const pushAt = (f: number) => PUSH[Math.round(f) + LOOP] ?? 0

const lampXs = (f: number) => [0, 1, 2].map(k => mod(70 + 48 * k - f, 144) - 40).filter(x => x > -20 && x < W + 20)

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const lamps = lampXs(f)
    const halo = (x: number, y: number) => lamps.reduce((s, lx) => s + Math.max(0, 1 - Math.hypot(x - lx, (y - 4) * 1.1) / 15) ** 1.6, 0)
    const lampLight = (x: number, y: number) => lamps.reduce((s, lx) => s + Math.max(0, 1 - Math.hypot(x - lx, (y - 4) * 0.8) / 26) ** 1.3, 0)

    c.fill((x, y) => shade(SKY, 0.4 + (y / 22) * 8.6 + halo(x, y) * 2.4))
    for (const [sx, sy] of [[5, 2], [18, 1], [33, 3], [51, 1], [60, 5], [26, 6]] as const) {
      if (halo(sx, sy) < 0.1) c.set(sx, sy, shade(SKY, 6 + (sx % 3 === 0 && mod(f, 24) < 12 ? 1 : 0)))
    }

    const farShift = Math.floor(f / 4)
    for (let x = 0; x < W; x++) {
      const wx = x + farShift
      const top = 16 + Math.round(1.6 * Math.sin((TAU * wx) / 24) + Math.sin((TAU * wx) / 12 + 1) + 0.7 * Math.sin((TAU * wx) / 8 + 2))
      for (let y = top; y < 24; y++) c.set(x, y, shade(FAR, (y === top ? 2 : 1) + halo(x, y) * 1.4))
    }

    const midShift = Math.floor(f / 2)
    for (let k = -1; k <= 2; k++) {
      drawTree(c, 13 + 48 * k - midShift, 0, AMBER_LEAF, halo)
      drawTree(c, 38 + 48 * k - midShift, 1, GOLD_LEAF, halo)
    }

    for (let y = 23; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const wx = x + f
        const pool = lamps.reduce((s, lx) => s + Math.max(0, 1 - Math.hypot((x - lx) / 13, (y - 29) / 4)) ** 1.2, 0)
        if (y < PATH_Y) {
          const tuft = (y === 23 && hash(mod(wx, LOOP), 9) < 0.4) || y > 23 ? 1 : 0
          if (!tuft) continue
          const isLeaf = hash(mod(wx, LOOP) >> 1, y, 3) < 0.1
          c.set(x, y, isLeaf ? shade(RUST_LEAF, 1.6 + pool * 3) : shade(VERGE, 1 + (y === 24 ? 1 : 0) + pool * 2.4))
          continue
        }
        const edge = y === PATH_Y ? 1 : 0
        const rut = y === 29 || y === 31 ? -0.5 : 0
        const fallen = hash(mod(wx, LOOP) >> 1, y, 5)
        if (y > PATH_Y && fallen < 0.07) c.set(x, y, shade(fallen < 0.035 ? AMBER_LEAF : GOLD_LEAF, 2 + pool * 3 + (x % 2 ? 0 : 0.5)))
        else c.set(x, y, shade(GRAVEL, 1.2 + (y - PATH_Y) * 0.25 + pool * 4 + edge + rut))
      }
    }

    for (const lx of lamps) drawLamp(c, lx, f)

    const fallen = particles(f, LOOP, 16, 70, 11)
    drawLeaves(c, f, fallen.filter(p => p.i % 2 === 0))
    drawWalker(c, f, lampLight)
    drawLeaves(c, f, fallen.filter(p => p.i % 2 === 1))

    for (let i = 0; i < 9; i++) {
      const t = f - (52 + i * 2.2)
      const x = Math.round(W + 2 - t * 3.6)
      if (t < 0 || x < -2) continue
      const y = Math.round(5 + ((i * 7) % 9) * 2.4 + Math.sin(t * 0.5 + i) * 1.5)
      const ramp = i % 3 === 0 ? RUST_LEAF : i % 3 === 1 ? AMBER_LEAF : GOLD_LEAF
      const flip = mod(Math.round(t) + i, 4) < 2
      c.set(x, y, shade(ramp, flip ? 5 : 3))
      c.set(x + 1, y + (flip ? 0 : 1), shade(ramp, flip ? 4 : 2))
    }
  })
}

function drawTree(c: Canvas, x: number, kind: number, ramp: readonly number[], halo: (x: number, y: number) => number): void {
  if (x < -14 || x > W + 14) return
  for (let y = 10; y < 25; y++) {
    for (const dx of [0, 1]) c.set(x + dx, y, shade(BARK, 1 + dx + halo(x + dx, y) * 2.5))
  }
  c.line(x + 1, 13, x + 4, 10, shade(BARK, 1.5))
  const lobes: [number, number, number][] = kind === 0
    ? [[-3, 5, 6], [4, 4, 5.5], [0, 0, 5]]
    : [[-4, 6, 5], [3, 6, 6], [0, 1, 5.5]]
  for (let y = -6; y < 14; y++) {
    for (let px = x - 11; px <= x + 12; px++) {
      let inside = -1
      for (const [ox, oy, r] of lobes) {
        const d = Math.hypot(px - (x + ox), (y - oy) * 1.15) / r
        inside = Math.max(inside, 1 - d)
      }
      if (inside < 0 || y < 0) continue
      const side = (x - px) * 0.08 - (y - 4) * 0.12
      const scallop = inside < 0.12 && hash(px, y, kind) < 0.5 ? -0.6 : 0
      c.set(px, y, shade(ramp, 1.2 + side + inside * 1.3 + halo(px, y) * 2.2 + scallop))
    }
  }
}

function drawLamp(c: Canvas, lx: number, f: number): void {
  for (let y = 7; y < PATH_Y - 1; y++) c.set(lx, y, shade(IRON, 2 + (y > 22 ? 0.5 : 0)))
  for (let y = 22; y < PATH_Y - 1; y++) {
    c.set(lx - 1, y, shade(IRON, 1))
    c.set(lx + 1, y, shade(IRON, 3))
  }
  c.line(lx - 2, 8, lx + 2, 8, shade(IRON, 2))
  const flicker = hash(mod(f, LOOP), 7) < 0.15 ? -1 : 0
  for (let y = 3; y <= 6; y++) {
    for (let x = lx - 1; x <= lx + 1; x++) c.set(x, y, shade(FLAME, 4 + (x === lx ? 2 : 0) - (y === 6 ? 1 : 0) + flicker))
  }
  c.set(lx, 7, shade(IRON, 3))
  c.line(lx - 2, 2, lx + 2, 2, shade(IRON, 2))
  c.set(lx, 1, shade(IRON, 2))
  c.set(lx - 2, 3, shade(IRON, 1))
  c.set(lx + 2, 3, shade(IRON, 1))
}

function drawLeaves(c: Canvas, f: number, leaves: ReturnType<typeof particles>): void {
  for (const p of leaves) {
    const [a, b, d, e] = p.r
    const drift = 0.55 * p.t + 1.2 * (pushAt(f) - pushAt(f - p.t))
    const x = Math.round(10 + a * 70 - drift + 2 * Math.sin(p.t * 0.16 + b * 6))
    const y = Math.round(-2 + p.t * 0.48 + Math.sin(p.t * 0.31 + d * 6) * 0.9 - gust(f) * 2 * e)
    const ramp = d < 0.33 ? RUST_LEAF : d < 0.66 ? AMBER_LEAF : GOLD_LEAF
    const flip = mod(p.t + Math.round(b * 6), 6) < 3
    c.set(x, y, shade(ramp, flip ? 5 : 3))
    if (e > 0.5) c.set(x + (flip ? 1 : 0), y + (flip ? 0 : 1), shade(ramp, flip ? 4 : 2))
  }
}

type Part = 'hat' | 'band' | 'skin' | 'coat' | 'trousers' | 'shoe' | 'scarf' | 'body' | 'stripe' | 'hood' | 'rib' | 'lace' | 'tyre' | 'rim' | 'spoke' | 'hub' | 'iron' | 'lining' | 'whisker'
const RAMPS: Record<Part, [readonly number[], number]> = {
  hat: [COAT, 0.6], band: [SCARF, 1.4], skin: [SKIN, 2], coat: [COAT, 1.2], trousers: [TROUSERS, 1.2], shoe: [COAT, 0.2],
  scarf: [SCARF, 2.4], body: [LACQUER, 1.8], stripe: [BRASS, 2.6], hood: [HOOD, 1.2], rib: [HOOD, 0.4], lace: [LACE, 1.6],
  tyre: [HOOD, 0.4], rim: [LACE, 0.4], spoke: [IRON, 2.6], hub: [BRASS, 3.4], iron: [IRON, 2.2], lining: [SCARF, 1], whisker: [BARK, 1.4],
}

function drawWalker(c: Canvas, f: number, lampLight: (x: number, y: number) => number): void {
  const parts = new Map<number, Part>()
  const put = (x: number, y: number, part: Part) => {
    const ix = Math.round(x)
    const iy = Math.round(y)
    if (ix >= 0 && ix < W && iy >= 0 && iy < H) parts.set(iy * W + ix, part)
  }
  const thick = (x0: number, y0: number, x1: number, y1: number, part: Part) => {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)))
    for (let k = 0; k <= n; k++) {
      put(lerp(x0, x1, k / n), lerp(y0, y1, k / n), part)
      put(lerp(x0, x1, k / n) + 1, lerp(y0, y1, k / n), part)
    }
  }

  const phase = (TAU * f) / STEP
  const bob = Math.abs(Math.sin(phase)) < 0.5 ? -1 : 0
  const g = gust(f)

  const hip = 20
  for (const side of [1, -1] as const) {
    const s = Math.sin(phase) * side
    const lift = Math.round(Math.max(0, Math.cos(phase) * side) * 1.6)
    const fx = hip + Math.round(s * 3.5)
    thick(hip, 20 + bob, fx, PATH_Y - 1 - lift, 'trousers')
    put(fx, PATH_Y - lift, 'shoe')
    put(fx + 1, PATH_Y - lift, 'shoe')
    put(fx + 2, PATH_Y - lift, 'shoe')
  }
  const tail = Math.round(Math.sin(phase * 2) * 0.6 - g * 1.5)
  for (let y = 12; y <= 21; y++) {
    const back = y >= 18 ? 18 + tail - (y - 18) : 19
    const front = y <= 13 ? 23 : 22
    for (let x = back; x <= front; x++) put(x, y + bob, 'coat')
  }
  for (let k = 0; k <= 5; k++) {
    const droop = (1 - g) * 0.7
    const flutter = Math.sin(f * (0.7 + g) - k * 0.9) * (0.4 + g * 0.6)
    put(21 - k, 12 + bob + Math.round(k * droop + flutter * Math.min(1, k / 2)), 'scarf')
  }
  put(22, 12 + bob, 'scarf')
  put(23, 12 + bob, 'scarf')
  for (let y = 9; y <= 11; y++) for (let x = 21; x <= 23; x++) put(x, y + bob, 'skin')
  put(24, 10 + bob, 'skin')
  put(21, 9 + bob, 'coat')
  put(21, 10 + bob, 'whisker')
  put(23, 11 + bob, 'whisker')

  let hatX = 0
  let hatY = 0
  let isTilted = false
  if (f >= 56 && f < 60) {
    hatY = [0, -1, -1, 0][f - 56] ?? 0
    isTilted = f === 56 || f === 58
  } else if (f >= 60 && f < 72) {
    const up = beat(f, 59, 63)
    const down = ease.in(beat(f, 68, 72))
    hatY = Math.round(-4 * up * (1 - down))
    hatX = Math.round(-5 * ease.inOut(beat(f, 60, 66)) * (1 - down))
    isTilted = f < 70
  }
  const isSquashed = f === 72 || f === 73
  const hx = 20 + hatX
  const hy = 8 + bob + hatY
  for (let x = hx; x <= hx + 5; x++) put(x, hy, 'hat')
  for (let j = 1; j <= (isSquashed ? 3 : 4); j++) {
    const lean = isTilted && j >= 3 ? -1 : 0
    for (let x = hx + 1 + lean; x <= hx + 4 + lean; x++) put(x, hy - j, j === 1 ? 'band' : 'hat')
  }

  const grip = { x: 28, y: 15 + bob }
  const reach = f >= 63 && f < 76 ? ease.inOut(f < 68 ? beat(f, 63, 67) : 1 - beat(f, 71, 76)) : 0
  const hand = { x: lerp(grip.x, hx + 4, reach), y: lerp(grip.y, hy - 2, reach) }
  thick(22, 13 + bob, lerp(26, 24, reach), lerp(15 + bob, 10 + bob, reach), 'coat')
  thick(lerp(26, 24, reach), lerp(15 + bob, 10 + bob, reach), hand.x - 1, hand.y, 'coat')
  put(hand.x, hand.y, 'skin')

  const ride = Math.abs(Math.sin(phase - 0.8)) < 0.5 ? -1 : 0
  const handleY = 15 + ride
  thick(27, handleY, 31, 18 + ride, 'iron')
  put(27, handleY - 1, 'iron')
  for (let x = 31; x <= 46; x++) {
    const top = x >= 45 ? 15 : 16
    const bottom = 21 - Math.round(((x - 38.5) / 7.5) ** 2 * 3.2)
    for (let y = top; y <= bottom; y++) put(x, y + ride, y === 18 ? 'stripe' : 'body')
  }
  for (let x = 38; x <= 44; x++) put(x, 15 + ride, 'lace')
  put(39, 14 + ride, 'lace')
  put(41, 14 + ride, 'lace')
  for (let y = 9; y <= 16; y++) {
    for (let x = 29; x <= 40; x++) {
      const dx = x - 36
      const dy = 16.5 - y
      if (Math.hypot(dx / 6.5, dy / 7) > 1 || dx > dy * 0.35 + 1.5) continue
      const a = Math.atan2(dy, -dx)
      const isRib = Math.hypot(dx, dy) > 2.5 && [0.75, 1.35].some(r => Math.abs(a - r) < 0.11)
      const isMouth = dx > dy * 0.35 + 0.5
      put(x, y + ride, isMouth ? 'lining' : isRib ? 'rib' : 'hood')
    }
  }
  put(37, 14 + ride, 'lace')
  put(37, 15 + ride, 'skin')
  for (const [x, y] of [[33, 22], [34, 22], [42, 22], [43, 22]] as const) put(x, y + ride, 'iron')

  const wheel = (cx: number, cy: number, r: number, sixths: number) => {
    const turn = (TAU * sixths * f) / 6 / LOOP
    for (let y = cy - r - 1; y <= cy + r + 1; y++) {
      for (let x = cx - r - 1; x <= cx + r + 1; x++) {
        const d = Math.hypot(x - cx, y - cy)
        if (d > r + 0.4) continue
        if (d > r - 0.6) {
          put(x, y, 'tyre')
          continue
        }
        if (d > r - 1.5) {
          put(x, y, 'rim')
          continue
        }
        if (d < 0.6) {
          put(x, y, 'hub')
          continue
        }
        const m = mod(Math.atan2(y - cy, x - cx) + turn, TAU / 6)
        if (d > 1.4 && Math.min(m, TAU / 6 - m) * d < 0.36) put(x, y, 'spoke')
      }
    }
  }
  wheel(34, 23, 5, 18)
  wheel(44, 24, 4, 23)

  for (const [key, part] of parts) {
    const x = key % W
    const y = Math.floor(key / W)
    const lit = lampLight(x, y)
    const [ramp, base] = RAMPS[part]
    const isTop = !parts.has(key - W)
    const isLeft = !parts.has(key - 1)
    const isRight = !parts.has(key + 1)
    const rim = (isTop ? 0.6 : 0) + (isLeft || isRight ? 0.3 : 0)
    const tyreTop = part === 'tyre' && isTop ? 1 : 0
    c.set(x, y, shade(ramp, base + lit * 2.4 + rim * clamp(lit * 1.5 + 0.3) + tyreTop))
  }
}

export const scene: Scene = { verb: 'Perambulating', render, hero: 30 }
