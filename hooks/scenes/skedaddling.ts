import { Canvas, clamp, ease, frames, hash, hex, lerp, loopNoise, noise, shade, smoothstep, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const SKY = hex('3c6cb4 4a82c8 5e98d8 78aee2 96c4ea b6daf0')
const CLOUD = hex('8fa6cc b4c6e2 dce6f4 fbfdff')
const HILLS = hex('7898bc 8aaccb')
const TREES = hex('2a4450 36585a 487060')
const MEADOW = hex('17311a 22481e 31601f 467a26 5e942c 7aac36 98c246 b8d862')
const FUR = hex('241612 3e281c 5c3e2a 7c5638 9c7048 ba8c60 d6ae84 ecd2ae')
const TAIL = hex('8a7c74 cfc6bc f8f4ec')
const PINK = hex('b05a68 e3909a')
const DUST = hex('6a5644 947a60 bea282 dec8a6 f4e8ce')
const YELLOW = hex('c88a14 f2c832 fff07a')
const CLOVER = hex('9a4a78 d07ca4 f2c2da')
const HAWK = 0x2c2a44

const HORIZON = 14
const G = 25
const HOME = 24

type Pose = { rx: number; ry: number; hx: number; hy: number; ear: number; earLen: number; isWide: boolean }
const NIBBLE: Pose = { rx: 4.6, ry: 3.6, hx: 4.4, hy: -4.4, ear: -0.6, earLen: 7, isWide: false }
const ALERT: Pose = { rx: 4.3, ry: 4, hx: 3.4, hy: -7, ear: 0.04, earLen: 7, isWide: true }
const CROUCH: Pose = { rx: 5.6, ry: 2.8, hx: 5, hy: -3.8, ear: -1, earLen: 6, isWide: true }
const BOLT: Pose = { rx: 9, ry: 2.3, hx: 9, hy: -3.4, ear: -1.4, earLen: 6, isWide: true }
const HOP: Pose = { rx: 5.4, ry: 3, hx: 5, hy: -4.6, ear: -0.75, earLen: 6, isWide: false }

type Part = 'body' | 'belly' | 'head' | 'ear' | 'earBack' | 'inner' | 'tail' | 'paw' | 'eye' | 'white' | 'nose'
type Bit = { part: Part; light: number }

function rabbitMask(ax: number, gy: number, p: Pose, chew = 0): Map<number, Bit> {
  const m = new Map<number, Bit>()
  const put = (x: number, y: number, part: Part, light = 0) => {
    if (x >= 0 && x < W && y >= 0 && y < H) m.set(y * W + x, { part, light })
  }
  const by = gy - p.ry
  const hx = ax + p.hx
  const hy = gy + p.hy + chew
  const ear = (x0: number, y0: number, a: number, len: number, half: number, part: Part) => {
    const dx = Math.sin(a)
    const dy = -Math.cos(a)
    for (let y = Math.floor(y0 - len - 2); y <= Math.ceil(y0 + 2); y++) {
      for (let x = Math.floor(x0 - len - 2); x <= Math.ceil(x0 + len + 2); x++) {
        const t = (x - x0) * dx + (y - y0) * dy
        const s = (x - x0) * dy - (y - y0) * dx
        if (t < 0 || t > len) continue
        const w = half * (t < len * 0.55 ? 1 : 1 - ((t - len * 0.55) / (len * 0.45)) * 0.7)
        if (Math.abs(s) > w) continue
        const isInner = part === 'ear' && t > 1 && t < len - 1.5 && s > -0.2 && s < 0.45
        put(x, y, isInner ? 'inner' : part, -s * 0.8 + (1 - t / len) * -0.3)
      }
    }
  }
  ear(hx - 1.4, hy - 1.4, p.ear - 0.32, p.earLen - 0.6, 0.7, 'earBack')
  for (let y = Math.floor(by - p.ry); y <= Math.ceil(gy); y++) {
    for (let x = Math.floor(ax - p.rx); x <= Math.ceil(ax + p.rx); x++) {
      const nx = (x - ax) / p.rx
      const ny = (y - by) / p.ry
      if (nx * nx + ny * ny > 1) continue
      const isBelly = ny > 0.3 && nx > 0.15
      put(x, y, isBelly ? 'belly' : 'body', -nx * 0.7 - ny * 1.1)
    }
  }
  for (let y = Math.floor(gy - p.ry * 1.3); y < gy; y++) {
    for (let x = Math.floor(ax - p.rx); x < ax + 1; x++) {
      const e = ((x - ax + 1.2) / (p.rx * 0.62)) ** 2 + ((y - gy + p.ry * 0.62) / (p.ry * 0.62)) ** 2
      if (e > 0.75 && e <= 1.05 && x > ax - 1.6 && m.get(y * W + x)?.part === 'body') put(x, y, 'body', -1.4)
    }
  }
  for (let y = Math.floor(by - 1.5); y <= Math.ceil(by + 1.5); y++) {
    for (let x = Math.floor(ax - p.rx - 1.5); x <= Math.ceil(ax - p.rx + 1.5); x++) {
      if (Math.hypot(x - (ax - p.rx + 0.3), y - (by + p.ry * 0.15)) <= 1.35) put(x, y, 'tail', -(x - ax + p.rx) * 0.5 - (y - by) * 0.6)
    }
  }
  for (let y = Math.floor(hy - 3); y <= Math.ceil(hy + 3); y++) {
    for (let x = Math.floor(hx - 3.2); x <= Math.ceil(hx + 3.2); x++) {
      const nx = (x - hx) / 2.9
      const ny = (y - hy) / 2.6
      if (nx * nx + ny * ny <= 1) put(x, y, 'head', -nx * 0.7 - ny * 1.1)
    }
  }
  put(Math.round(ax + p.rx * 0.55), gy - 1, 'paw', 0.4)
  put(Math.round(ax + p.rx * 0.55) + 1, gy - 1, 'paw', 0)
  ear(hx - 0.3, hy - 1.7, p.ear, p.earLen, 1, 'ear')
  const ex = Math.round(hx + 1.1)
  const ey = Math.round(hy - 0.5)
  put(ex, ey, 'eye')
  if (p.isWide) put(ex - 1, ey, 'white')
  put(Math.round(hx + 2.7), Math.round(hy + 0.4), 'nose')

  return m
}

const PART_RAMP: Record<Part, [readonly number[], number]> = {
  body: [FUR, 3.6], belly: [FUR, 5.4], head: [FUR, 3.9], ear: [FUR, 3.6], earBack: [FUR, 2.2], inner: [PINK, 0.6],
  tail: [TAIL, 1.6], paw: [FUR, 5.2], eye: [FUR, -1], white: [TAIL, 2], nose: [PINK, 1],
}

function drawRabbit(c: Canvas, m: Map<number, Bit>, shadowed: (x: number) => boolean, fill?: readonly number[]): void {
  for (const [key, b] of m) {
    const x = key % W
    const y = Math.floor(key / W)
    const [ramp, base] = PART_RAMP[b.part]
    if (fill) {
      const edge = !m.has(key + W) || !m.has(key + 1) ? -1 : !m.has(key - W) ? 0.8 : 0
      c.set(x, y, shade(fill, 2.4 - b.light * -0.6 + edge))
      continue
    }
    if (b.part === 'eye' || b.part === 'white' || b.part === 'nose' || b.part === 'inner') {
      c.set(x, y, shade(ramp, base))
      continue
    }
    const below = m.get(key + W)
    const isOutline = !below || !m.has(key + 1)
    const isRim = !m.has(key - W) || !m.has(key - 1)
    const lvl = base + b.light + (isOutline ? -1.2 : isRim ? 0.8 : 0) - (shadowed(x) ? 1.8 : 0)
    c.set(x, y, shade(ramp, lvl))
  }
}

const mixPose = (a: Pose, b: Pose, t: number): Pose => ({
  rx: lerp(a.rx, b.rx, t), ry: lerp(a.ry, b.ry, t), hx: lerp(a.hx, b.hx, t), hy: lerp(a.hy, b.hy, t),
  ear: lerp(a.ear, b.ear, t), earLen: lerp(a.earLen, b.earLen, t), isWide: t < 0.5 ? a.isWide : b.isWide,
})

type Beat = { x: number; y: number; pose: Pose; chew: number }
function rabbitAt(f: number): Beat | undefined {
  const chew = Math.floor(f / 3) % 2 ? 0.7 : 0
  if (f < 18) {
    const flick = f === 9 ? 0.3 : f === 10 ? 0.15 : 0
    return { x: HOME, y: G, pose: { ...NIBBLE, ear: NIBBLE.ear + flick }, chew }
  }
  if (f < 22) return { x: HOME, y: G, pose: { ...NIBBLE, hy: -5, ear: -0.2 }, chew: 0 }
  if (f < 34) return { x: HOME, y: G, pose: f === 22 ? { ...ALERT, hy: -7.5, earLen: 7.5 } : ALERT, chew: 0 }
  if (f === 34) return { x: HOME - 0.5, y: G, pose: mixPose(ALERT, CROUCH, 0.5), chew: 0 }
  if (f === 35) return { x: HOME - 1, y: G, pose: CROUCH, chew: 0 }
  if (f === 36) return { x: HOME - 2, y: G, pose: { ...CROUCH, rx: 6, ry: 2.4, hy: -3.3 }, chew: 0 }
  if (f === 37) return { x: 46, y: G, pose: BOLT, chew: 0 }
  if (f === 38) return { x: 72, y: G, pose: { ...BOLT, rx: 11 }, chew: 0 }
  if (f < 49) return undefined
  if (f < 56) {
    const flick = f === 54 ? 0.25 : f === 55 ? 0.1 : 0
    return { x: lerp(-6, -1, smoothstep(49, 53, f)), y: G, pose: { ...ALERT, ear: ALERT.ear + flick }, chew: 0 }
  }
  const hops: [number, number, number][] = [[56, -1, 7], [61, 7, 15], [66, 15, HOME]]
  for (const [start, x0, x1] of hops) {
    const t = (f - start) / 5
    if (t < 0 || t >= 1) continue
    const lift = Math.sin(Math.PI * t) ** 1.6 * 3.4
    const pose = mixPose(CROUCH, HOP, clamp(t / 0.5))
    return { x: lerp(x0, x1, t), y: G - lift, pose, chew: 0 }
  }
  if (f === 71) return { x: HOME, y: G, pose: { ...NIBBLE, ry: 3.1, rx: 5, hy: -3.8, ear: -0.7 }, chew: 0 }

  return { x: HOME, y: G, pose: { ...NIBBLE, ear: -0.5 }, chew: 0 }
}

const hawkX = (f: number) => (f >= 14 && f <= 36 ? -14 + (f - 14) * 4 : undefined)

function inHawkShadow(sx: number, x: number, y: number): boolean {
  const dx = x - sx
  const ax = Math.abs(dx)
  if (ax > 10) return false
  const cy = 24 - (ax > 2 ? (ax - 2) * 0.18 : 0)
  const half = ax <= 2 ? 1.3 : 1.25 - (ax - 2) * 0.1
  const isTail = dx < -1 && dx > -5 && Math.abs(y - 24.2) < 0.8
  return Math.abs(y - cy) <= half || isTail
}

const whoosh = (x: number, f: number) => {
  if (f < 37 || f >= 53 || x <= 18) return 0
  return f === 37 ? 0.9 : 2.6 * Math.exp(-(f - 38) / 3.5) * Math.cos((f - 38) * 0.9)
}

const FLOWERS = Array.from({ length: 26 }, (_, i) => ({
  x: Math.floor(hash(i, 1) * W),
  y: Math.floor(15 + hash(i, 2) * 11),
  isClover: hash(i, 3) < 0.3,
})).filter(fl => !(fl.x > 16 && fl.x < 36 && fl.y > 19))

function draw(c: Canvas, f: number): void {
  const sx = hawkX(f)

  for (let y = 0; y < HORIZON; y++) {
    for (let x = 0; x < W; x++) c.set(x, y, shade(SKY, y * 0.42))
  }
  const clouds: [number, number, number][][] = [
    [[8, 4, 2.4], [11, 3, 3.2], [15, 4, 2.6], [12, 5, 2.4]],
    [[44, 6, 1.8], [47, 5, 2.4], [50, 6, 1.8]],
  ]
  for (const cloud of clouds) {
    const bottom = Math.max(...cloud.map(([, cy, r]) => cy + r * 0.55))
    for (let y = 0; y < HORIZON; y++) {
      for (let x = 0; x < W; x++) {
        if (y > bottom) continue
        let best = Infinity
        let lit = 0
        for (const [cx, cy, r] of cloud) {
          const d = Math.hypot(x - cx, (y - cy) * 1.3) / r
          if (d < best) {
            best = d
            lit = -(x - cx) / r * 0.5 - (y - cy) / r * 1.4
          }
        }
        if (best <= 1) c.set(x, y, shade(CLOUD, 2 + lit - (y >= bottom - 0.5 ? 1 : 0)))
      }
    }
  }
  for (let x = 0; x < W; x++) {
    const hill = Math.round(10.5 + Math.sin(x * 0.09 + 1) * 1.3 + Math.sin(x * 0.23) * 0.5)
    for (let y = hill; y < HORIZON; y++) c.set(x, y, shade(HILLS, y === hill ? 1 : 0))
    const tree = Math.round(12.3 - hash(Math.floor(x / 3), 5) * 1.6 - (x % 3 === 1 ? 0.6 : 0))
    for (let y = tree; y < HORIZON; y++) c.set(x, y, shade(TREES, y === tree ? 2 : y === HORIZON - 1 ? 0 : 1))
  }

  if (sx !== undefined) {
    const hx = Math.round(sx + 6)
    const isUp = Math.floor(f / 3) % 3 === 0
    const shape = isUp ? ['k...k', '.kkk.'] : ['.kkk.', 'k...k']
    c.sprite(hx - 2, 4, shape, { k: HAWK })
    c.set(hx - 3, isUp ? 4 : 5, HAWK)
    c.set(hx + 3, isUp ? 4 : 5, HAWK)
  }

  for (let y = HORIZON; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = noise(x * 0.16, y * 0.45, 0, 3)
      let lvl = 6.4 - (y - HORIZON) * 0.21 + (n > 0.62 ? -0.8 : n < 0.3 ? 0.6 : 0)
      if (sx !== undefined && inHawkShadow(sx, x, y)) lvl -= 2.4
      c.set(x, y, shade(MEADOW, lvl))
    }
  }
  for (const fl of FLOWERS) {
    const lean = Math.round(whoosh(fl.x, f) * 0.5)
    const isFar = fl.y < 19
    c.set(fl.x + lean, fl.y, isFar ? shade(fl.isClover ? CLOVER : YELLOW, 2) : shade(fl.isClover ? CLOVER : YELLOW, 1.6))
    if (!isFar) c.set(fl.x, fl.y + 1, shade(MEADOW, 3))
  }

  const r = rabbitAt(f)
  const tug = f < 18 && Math.floor(f / 3) % 2 ? 1 : 0
  const whip = Math.round(whoosh(40, f))
  for (let y = G; y >= 22 + tug; y--) c.set(32 + (y < 23 ? whip : 0), y, shade(MEADOW, 3.6))
  c.set(31, G, shade(MEADOW, 4.6))
  c.set(33, G - 1, shade(MEADOW, 4.2))
  c.set(32 + whip, 21 + tug, shade(CLOVER, 2))
  c.set(33 + whip, 21 + tug, shade(CLOVER, 1))
  c.set(32 + whip, 20 + tug, shade(CLOVER, 2.4))

  if (f >= 37 && f <= 41) {
    const x0 = [27, 34, 44, 52, 58][f - 37] ?? W
    const x1 = f === 37 ? 46 - BOLT.rx : W
    for (const [dy, inset] of [[-3, 0], [-6, 3], [-1, 5]] as const) {
      for (let x = x0 + inset; x < x1; x++) c.set(x, G + dy, shade(CLOUD, 3))
    }
  }
  if (r) {
    const lift = G - r.y
    for (let x = Math.floor(r.x - r.pose.rx - 1); x <= Math.ceil(r.x + r.pose.rx + 3); x++) {
      for (const y of [G, G + 1]) {
        if (Math.abs(x - r.x - 1.5) / (r.pose.rx + 1.5 - lift * 0.3) + (y === G + 1 ? 0.35 : 0) <= 1) {
          c.set(x, y, shade(MEADOW, 6.4 - (y - HORIZON) * 0.21 - 2.2))
        }
      }
    }
    const m = rabbitMask(Math.round(r.x), Math.round(r.y), r.pose, r.chew)
    drawRabbit(c, m, x => sx !== undefined && Math.abs(x - sx) < 9.5)
  }

  if (f >= 37 && f <= 40) {
    drawRabbit(c, rabbitMask(HOME - 2, G, { ...CROUCH, rx: 6, ry: 2.4, hy: -3.3 }), () => false, DUST)
  }
  const puffs: [number, number, number, number][] = [
    [-6, -1.6, 2.6, 0], [6, -1.4, 2.4, 1], [-2, -2.2, 3.2, 0], [2.5, -2, 3, 0], [-4, -5, 2.4, 1], [3, -5.4, 2.2, 2], [0, -7, 2.4, 2],
  ]
  const age = f - 39
  if (age > 0 && age < 19) {
    for (const [dx, dy, rad, delay] of puffs) {
      const d = age - delay
      if (d <= 0) continue
      const grow = ease.out(clamp(d / 4))
      const fade = clamp(1 - (d - 7) / 10)
      const rr = rad * (0.55 + 0.6 * grow) * fade
      if (rr < 1.1) continue
      const px = HOME - 1 + dx * (0.8 + grow * 0.25) + d * 0.2
      const py = G + dy - d * 0.16
      for (let y = Math.floor(py - rr); y <= Math.ceil(py + rr); y++) {
        for (let x = Math.floor(px - rr); x <= Math.ceil(px + rr); x++) {
          const ox = (x - px) / rr
          const oy = ((y - py) * 1.1) / rr
          const dd = Math.hypot(ox, oy)
          if (dd > 1) continue
          const isRim = dd > 0.72 && ox + oy > 0.35
          c.set(x, y, shade(DUST, 3 - oy * 1.1 - ox * 0.5 - (isRim ? 1.2 : 0)))
        }
      }
    }
  }

  for (let x = 0; x < W; x++) {
    if (hash(x, 9) > 0.55) continue
    const edge = Math.abs(x - 30) / 30
    const h = Math.round(2 + hash(x, 10) * 3 + edge * 4)
    const wind = (loopNoise(x * 0.07, 0, f / LOOP, 2, 6) - 0.5) * 3 + whoosh(x, f)
    for (let k = 0; k <= h; k++) {
      const bend = Math.round(wind * (k / h) ** 2)
      c.set(x + bend, H - 1 - k, shade(MEADOW, k === h ? 4.2 : 1.6 + (k / h) * 1.4))
    }
  }
}

function render(): Int32Array[] {
  return frames(LOOP, draw)
}

export const scene: Scene = {
  verb: 'Skedaddling',
  render,
  hero: 25,
  snaps: [
    {
      frames: 37,
      box: [16, 17, 63, 26],
      why: 'The gag: the crouched rabbit is gone in a streak. In one frame it is stretched out halfway across the meadow with speed lines behind it, a rabbit-shaped puff of dust stands where it sat, and the grass starts to bend in its wake.',
    },
    {
      frames: 38,
      box: [30, 19, 63, 24],
      why: 'The streak carries on: one frame later the rabbit is already off the right edge, leaving only its speed lines.',
    },
  ],
}
