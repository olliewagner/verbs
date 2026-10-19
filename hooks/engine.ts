export const W = 64
export const H = 32
export const FRAME_MS = 83

export type Scene = {
  verb: string
  render: () => Int32Array[]
  hero?: number
  snaps?: readonly Snap[]
}

export type Snap = {
  frames?: number | readonly [from: number, to: number]
  box?: readonly [x0: number, y0: number, x1: number, y1: number]
  colors?: readonly number[]
  why: string
}
export const TAU = Math.PI * 2
export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const fract = (v: number) => v - Math.floor(v)
export const mod = (v: number, n: number) => ((v % n) + n) % n
export function smoothstep(a: number, b: number, v: number): number {
  const t = clamp((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}
export const beat = (f: number, start: number, end: number) => clamp((f - start) / (end - start))
export const wave = (f: number, loop: number, cycles = 1, phase = 0) => Math.sin(TAU * ((f / loop) * cycles + phase))
export const ease = {
  in: (t: number) => t * t * t,
  out: (t: number) => 1 - (1 - t) ** 3,
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outBack: (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  outElastic: (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
  outBounce: (t: number) => {
    const n = 7.5625
    const d = 2.75
    if (t < 1 / d) return n * t * t
    if (t < 2 / d) return n * (t - 1.5 / d) ** 2 + 0.75
    if (t < 2.5 / d) return n * (t - 2.25 / d) ** 2 + 0.9375
    return n * (t - 2.625 / d) ** 2 + 0.984375
  },
}
export function random(seed: number): () => number {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export function hash(a: number, b = 0, c = 0): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export function noise(x: number, y: number, z = 0, seed = 0): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const s = (t: number) => t * t * (3 - 2 * t)
  const u = s(x - xi)
  const v = s(y - yi)
  const w = s(z - zi)
  const at = (i: number, j: number, k: number) => hash(xi + i + seed * 131, yi + j, zi + k)
  const plane = (k: number) => lerp(lerp(at(0, 0, k), at(1, 0, k), u), lerp(at(0, 1, k), at(1, 1, k), u), v)
  return lerp(plane(0), plane(1), w)
}
export function loopNoise(x: number, y: number, t: number, speed = 2, seed = 0): number {
  const p = fract(t)
  return lerp(noise(x, y, p * speed, seed), noise(x, y, (p - 1) * speed, seed), p)
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
export const threshold = (x: number, y: number) => ((BAYER[(y & 3) * 4 + (x & 3)] ?? 0) + 0.5) / 16

export type Ramp = readonly number[]

export const hex = (s: string): number[] => s.trim().split(/\s+/).map(h => parseInt(h, 16))

export function mix(a: number, b: number, t: number): number {
  const k = clamp(t)
  const channel = (shift: number) => Math.round(((a >> shift) & 255) * (1 - k) + ((b >> shift) & 255) * k)
  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}

export function ramp(stops: string, steps: number): number[] {
  const keys = hex(stops)
  return Array.from({ length: steps }, (_, i) => {
    const p = (i / Math.max(1, steps - 1)) * (keys.length - 1)
    const k = Math.min(keys.length - 2, Math.floor(p))
    return mix(keys[k] ?? 0, keys[k + 1] ?? keys[k] ?? 0, p - k)
  })
}

export function shade(r: Ramp, level: number, x = 0, y = 0, isDithered = false): number {
  const top = r.length - 1
  const l = clamp(level, 0, top)
  const i = Math.floor(l)
  const frac = l - i
  const step = !isDithered ? Math.round(frac) : frac < 0.35 ? 0 : frac > 0.65 ? 1 : (x + y) & 1
  return r[Math.min(top, i + step)] ?? 0
}

export const PALETTE = {
  fire: hex('3a0a10 6a1412 a1221a d23e1c ef6822 f99832 fcc657 fee996 fffbe0'),
  gas: hex('16236e 2747c7 4f86ff a9d0ff'),
  smoke: hex('1f1a25 2e2735 413848 594e60 766b7d'),
  steam: hex('3a3444 5f5870 958da3 c9c2d4'),
  night: hex('05060f 0b0d1e 141834 1f2550 2d3870 3f4f8f 5a6fae'),
  dusk: hex('1a1033 3a1846 6a2150 a0304f d1513f ec8240 f7b35a fde29a'),
  day: hex('2f5e9e 3f78c0 5592d8 72ade6 97c8f0 c3e2f7'),
  sea: hex('061126 0a2140 0f3560 15507e 1f6f99 3592b3 5cb6c9 9ddbe0'),
  grass: hex('0e1f12 173322 1f4a2a 2d6630 46852f 6aa337 98c24a c8dc6e'),
  leaf: hex('15261a 23402a 386436 568f44 7cb24f a9d35f'),
  bark: hex('1a0f0b 2b1a12 3f2719 573620 704829 8b5d36'),
  wood: hex('1e1214 2f1b19 46271e 653726 8a4c2e b06838 d68f4c'),
  stone: hex('0d0a10 17131b 221c27 30293a 463b4c 63515e 8a6f73'),
  metal: hex('0e0d12 1b1a21 2a2832 3e3b47 595462 7f7787 b1a7b2 e6dcd8'),
  gold: hex('2c1a08 4e300c 7a4c10 a8701a d1982a eec24a fae58a fffbd8'),
  copper: hex('2a0f0c 4a1d14 6f2e1a 96441f bd5e2a db8040 eda766 f7cf98'),
  sand: hex('3a2418 5c3a22 86582e ae7c3e d2a35a ecc87e f8e6ac'),
  snow: hex('2a3350 46557a 6c7fa6 9aaecc c6d6e8 eef4fa'),
  ice: hex('0c2a44 15486b 22708f 3c9cb3 6cc6d1 a6e6e6 e0fbf6'),
  candy: hex('3d0f2b 6a1a45 9a2760 c83c78 e5639a f594b9 fcc3d8'),
  magic: hex('12081f 22103a 371a5a 512a7e 7040a3 935fc4 ba86e0 e0b8f5'),
  slime: hex('0b1d10 133a1b 1d5c22 2b8227 4aa82c 7fcc3a b8e85a e8fa96'),
  red: hex('2a0a0e 4e1016 7a1a1e a6281f cf4229 ee6a3a f79a5e'),
  chocolate: hex('1a0c08 2e170e 472516 623520 80492c a0603a c0825a'),
  cream: hex('6b5a48 9a8468 c4ae8a e3d1ad f5ead2 fffaf0'),
  paper: hex('3c362e 6b6153 9a8e7a c4b9a2 e3dac4 f7f1e2'),
  plaster: hex('100b15 191120 25172b 352033 4f2a37 74393b 9c5141 c4704a e3955a'),
  glass: hex('120806 22100b 3a1a10 5c2a14 864018 b05e20 d9893a f3bd73'),
  orange: hex('4a1c07 7a300b ad4c10 d8701a f39634 fbbd5e fde09a'),
} satisfies Record<string, Ramp>
export type Light = { x: number; y: number; power: number; radius: number }
export function lightAt(lights: readonly Light[], x: number, y: number): number {
  let sum = 0
  for (const l of lights) {
    const d = Math.hypot(x - l.x, y - l.y)
    sum += l.power * Math.max(0, 1 - d / l.radius) ** 1.5
  }
  return sum
}

export type Paint = number | ((x: number, y: number) => number | undefined)
export class Canvas {
  readonly px = new Int32Array(W * H)
  set(x: number, y: number, paint: Paint): void {
    const ix = Math.round(x)
    const iy = Math.round(y)
    if (ix < 0 || ix >= W || iy < 0 || iy >= H) return
    const c = typeof paint === 'number' ? paint : paint(ix, iy)
    if (c !== undefined) this.px[iy * W + ix] = c
  }

  get(x: number, y: number): number {
    const ix = Math.round(x)
    const iy = Math.round(y)
    if (ix < 0 || ix >= W || iy < 0 || iy >= H) return 0
    return this.px[iy * W + ix] ?? 0
  }

  tint(x: number, y: number, color: number, t: number): void {
    this.set(x, y, mix(this.get(x, y), color, t))
  }
  fill(paint: Paint): void {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) this.set(x, y, paint)
  }

  rect(x: number, y: number, w: number, h: number, paint: Paint): void {
    for (let j = Math.round(y); j < Math.round(y + h); j++) {
      for (let i = Math.round(x); i < Math.round(x + w); i++) this.set(i, j, paint)
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, paint: Paint): void {
    let x = Math.round(x0)
    let y = Math.round(y0)
    const ex = Math.round(x1)
    const ey = Math.round(y1)
    const dx = Math.abs(ex - x)
    const dy = -Math.abs(ey - y)
    const sx = x < ex ? 1 : -1
    const sy = y < ey ? 1 : -1
    let err = dx + dy
    for (;;) {
      this.set(x, y, paint)
      if (x === ex && y === ey) return
      const e2 = 2 * err
      if (e2 >= dy) {
        err += dy
        x += sx
      }
      if (e2 <= dx) {
        err += dx
        y += sy
      }
    }
  }
  disc(cx: number, cy: number, r: number, paint: Paint): void {
    this.ellipse(cx, cy, r, r, paint)
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, paint: Paint): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) this.set(x, y, paint)
      }
    }
  }
  poly(points: readonly (readonly [number, number])[], paint: Paint): void {
    const ys = points.map(p => p[1])
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(H - 1, Math.ceil(Math.max(...ys))); y++) {
      const xs: number[] = []
      points.forEach(([ax, ay], i) => {
        const [bx, by] = points[(i + 1) % points.length] ?? [ax, ay]
        if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax))
      })
      xs.sort((a, b) => a - b)
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil((xs[k] ?? 0) - 0.5); x <= Math.floor((xs[k + 1] ?? 0) - 0.5); x++) this.set(x, y, paint)
      }
    }
  }
  sprite(x: number, y: number, art: readonly string[], palette: Readonly<Record<string, Paint>>, isFlipped = false): void {
    art.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const paint = palette[row[isFlipped ? row.length - 1 - i : i] ?? ' ']
        if (paint !== undefined) this.set(Math.round(x) + i, Math.round(y) + j, paint)
      }
    })
  }
  copy(): Int32Array {
    return this.px.slice()
  }
}
export function frames(loop: number, draw: (c: Canvas, f: number) => void): Int32Array[] {
  return Array.from({ length: loop }, (_, f) => {
    const c = new Canvas()
    draw(c, f)
    return c.px
  })
}
export type Particle = {
  i: number
  t: number
  age: number
  r: readonly [number, number, number, number]
}
export function particles(f: number, loop: number, count: number, life: number, seed = 0): Particle[] {
  const alive: Particle[] = []
  for (let i = 0; i < count; i++) {
    const next = random(seed * 7919 + i * 104729 + 1)
    const r = [next(), next(), next(), next()] as const
    const born = ((i + r[0] * 0.8) / count) * loop
    for (let t = mod(f - born, loop); t < life; t += loop) alive.push({ i, t, age: t / life, r })
  }

  return alive
}