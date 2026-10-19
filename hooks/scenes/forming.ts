import { Canvas, TAU, beat, clamp, hash, hex, loopNoise, noise, shade, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96
const N = 620
const HORIZON = 21
const SUN_X = 47

const SKY = hex('1a1033 2c1543 45194d 6a2150 932a4f bb3f46 d95c40 ec8240 f7b35a fde29a fff4cf')
const MARSH = hex('0d0714 170d20 22122b 30183a 46204a 6a2a52')
const INK = 0x120a1c

function skyLevel(x: number, y: number): number {
  const base = clamp(y / HORIZON) ** 1.5 * 8.4
  const d = Math.hypot(x - SUN_X, (y - HORIZON) * 1.6)
  return base + Math.max(0, 1 - d / 24) ** 1.6 * 2.4
}

const CLOUDS: [number, number, number][] = [
  [5, 34, 55], [6, 30, 49], [8, 41, 62], [14, 2, 20], [15, 6, 27], [17, 50, 63],
]

function isCloud(x: number, y: number): boolean {
  return CLOUDS.some(([cy, x0, x1]) => y === cy && x >= x0 + (cy % 3) && x <= x1 - (cy % 2))
}

function isWater(x: number, y: number): boolean {
  if (y <= HORIZON) return false
  const d = y - HORIZON
  const c = 46 - d * 1.5 + Math.sin(d * 0.75 - 0.6) * 4.5
  if (Math.abs(x - c) < 0.6 + d * 0.5) return true
  if (y >= 23 && y <= 24 && x >= 5 + (y - 23) * 2 && x <= 25 - (y - 23) * 3) return true
  if (y >= 27 && y <= 29 && x >= 49 - (y - 27) * 2 && x <= 61) return true
  if (y === 22 && x >= 12 && x <= 19) return true
  return false
}

function farLandTop(x: number): number {
  const clump = noise(x * 0.22, 0, 0, 3)
  return HORIZON - 1 - Math.floor(clump * 2.6) + (x > 38 && x < 56 ? 1 : 0)
}

type Bird = { u: number; v: number; w: number; side: number; r: number }
const BIRDS: Bird[] = Array.from({ length: N }, (_, i) => {
  const u = (i + 0.5) / N
  return { u, v: hash(i, 7), w: hash(i, 11), side: u < 0.5 ? -1 : 1, r: Math.abs(u - 0.5) * 2 }
})

const spin = (f: number) => TAU * smooth(beat(f, 12, 54))
const winding = (f: number) => smooth(beat(f, 14, 44)) - smooth(beat(f, 42, 54))
const scale = (f: number) => 1 - 0.3 * smooth(beat(f, 14, 38)) + 0.3 * smooth(beat(f, 46, 58))
const ribbon = (f: number) => 1 - smooth(beat(f, 10, 28)) + smooth(beat(f, 80, 95))
const birdness = (f: number) => smooth(beat(f, 48, 60)) * (1 - smooth(beat(f, 84, 95)))
const lift = (f: number) => 2.5 + 5 * Math.cos(TAU * 2 * beat(f, 58, 88))
const smooth = (t: number) => t * t * (3 - 2 * t)

function inBird(b: Bird, up: number): [number, number] {
  const q = Math.sqrt(b.v)
  const a = b.w * TAU * 3.7
  if (b.r < 0.2) {
    if (b.w < 0.25) return [Math.cos(a) * 1.7 * q, -4 + Math.sin(a) * 1.6 * q]
    if (b.w < 0.75) return [Math.cos(a) * 2.4 * q, 0 + Math.sin(a) * 3.2 * q]
    return [(b.v - 0.5) * (2 + (b.w - 0.75) * 16), 3 + (b.w - 0.75) * 12]
  }
  const s = (b.r - 0.2) / 0.8
  const span = Math.sqrt(22 * 22 - up * up)
  const lead = -1.2 - up * s ** 1.5 + Math.sin(s * Math.PI) * 1.2
  const chord = 4.6 * (1 - s) ** 0.9 + 1 + (s > 0.55 ? 1.6 * Math.abs(Math.sin(s * 28)) : 0)
  return [b.side * (2 + s * span), lead + b.v * chord]
}

function flock(f: number): Uint8Array {
  const count = new Uint8Array(W * H)
  const cx = 32 + 2.5 * wave(f, LOOP, 1)
  const cy = 11.5 + 1.2 * wave(f, LOOP, 1, 0.25)
  const t = f / LOOP
  const sp = spin(f)
  const wd = winding(f)
  const sc = scale(f)
  const rb = ribbon(f)
  const bd = birdness(f)
  const up = lift(f)
  BIRDS.forEach((b, i) => {
    const theta = (b.side < 0 ? Math.PI : 0) + sp + wd * (1 - b.r) ** 1.2 * TAU * 1.1
    const R = 27 * sc * b.r
    const fold = 0.35 + 0.65 * Math.abs(Math.cos(TAU * (b.u * 1.3 - 2 * t)))
    const bulge = 4.5 * Math.exp(-((b.u - 0.5 - 0.28 * Math.sin(TAU * t)) ** 2) / 0.02)
    const thick = (1.4 + 4.6 * Math.sin(Math.PI * b.u) ** 0.8 + bulge) * fold * rb + (1.8 + 3 * (1 - b.r)) * (1 - rb)
    const flow = 3.6 * Math.sin(TAU * (b.u * 0.8 - 2 * t)) + 1.4 * Math.sin(TAU * (b.u * 2.1 + t))
    let x = Math.cos(theta) * R
    let y = Math.sin(theta) * R * (0.42 + 0.14 * (1 - rb)) + (b.v - 0.5) * thick + flow * rb
    if (bd > 0) {
      const [bx, by] = inBird(b, up)
      x += (bx - x) * bd
      y += (by - y) * bd
    }
    const jitter = 1 - bd * 0.8
    x += (loopNoise(i * 0.31, 1.7, t, 4, 1) - 0.5) * 2.4 * jitter
    y += (loopNoise(i * 0.31, 8.3, t, 4, 2) - 0.5) * 1.6 * jitter
    const px = Math.round(cx + x)
    const py = Math.round(cy + y)
    if (px >= 0 && px < W && py >= 0 && py < H) count[py * W + px] = Math.min(255, (count[py * W + px] ?? 0) + 1)
  })

  return count
}

const shutter = (f: number) => SHUTTER * Math.min(1, 2 * Math.sin(Math.PI * beat(f, 14, 54)))
const SHUTTER = 1
const LOOKS = 8

function smeared(f: number): Uint8Array {
  const open = shutter(f)
  const total = new Uint8Array(W * H)
  for (let j = 0; j < (open > 0 ? LOOKS : 1); j++) {
    const one = flock(f + ((j + 0.5) / LOOKS - 0.5) * open)
    const weight = open > 0 ? 1 : LOOKS
    for (let i = 0; i < W * H; i++) total[i] = Math.min(255, (total[i] ?? 0) + (one[i] ?? 0) * weight)
  }
  return total
}
function skyWithFlock(x: number, y: number, n: number): number {
  const lvl = skyLevel(x, y)
  if (n === 0) return shade(SKY, lvl, x, y)
  if (n <= LOOKS / 2) return shade(SKY, lvl - 2.1, x, y)
  if (n < LOOKS * 1.5) return shade(SKY, lvl - 4.2, x, y)
  if (n < LOOKS * 2.5) return shade(SKY, lvl - 6.6, x, y)
  return INK
}
function waterWithFlock(x: number, y: number, n: number, dim: number): number {
  const deep = n === 0 ? 0 : n <= LOOKS / 2 ? 1.4 : n < LOOKS * 1.5 ? 2.8 : n < LOOKS * 2.5 ? 4.2 : 5.6
  return shade(SKY, skyLevel(x, y) - dim - deep, x, y)
}
type Reed = { x: number; lean: number; top: number; phase: number; head: boolean }
const REEDS: Reed[] = [
  { x: 2, lean: -1, top: 12, phase: 0, head: true }, { x: 3, lean: 2, top: 19, phase: 0.2, head: false },
  { x: 5, lean: 1, top: 15, phase: 0.45, head: true }, { x: 9, lean: 3, top: 23, phase: 0.6, head: false },
  { x: 54, lean: -3, top: 22, phase: 0.3, head: false }, { x: 58, lean: -1, top: 16, phase: 0.75, head: true },
  { x: 60, lean: 1, top: 19, phase: 0.1, head: false }, { x: 61, lean: 0, top: 11, phase: 0.55, head: true },
]
function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const birds = smeared(f)
    const at = (x: number, y: number) => (y >= 0 && y < H ? birds[y * W + x] ?? 0 : 0)
    for (let y = 0; y <= HORIZON; y++) {
      for (let x = 0; x < W; x++) {
        if (isCloud(x, y)) {
          const isUnder = !isCloud(x, y + 1)
          const lit = Math.max(0, 1 - Math.abs(x - SUN_X) / 30)
          c.set(x, y, shade(SKY, skyLevel(x, y) + (isUnder ? 1.2 + lit * 1.6 : -1.4), x, y))
        } else {
          c.set(x, y, shade(SKY, skyLevel(x, y), x, y))
        }
      }
    }
    for (let x = 0; x < W; x++) {
      for (let y = farLandTop(x); y <= HORIZON; y++) c.set(x, y, y === HORIZON && x > 36 && x < 58 ? SKY[8] ?? 0 : SKY[4] ?? 0)
    }
    for (let y = 15; y < 20; y++) {
      for (let x = SUN_X - 4; x <= SUN_X + 4; x++) {
        const d = Math.hypot(x - SUN_X, (y - 19.5) * 1.05)
        if (d < 3.6) c.set(x, y, d < 2.6 ? SKY[10] ?? 0 : SKY[9] ?? 0)
      }
    }
    for (let y = 14; y <= HORIZON; y++) {
      c.set(13, y, SKY[2] ?? 0)
      if (y > 16) c.set(12, y, SKY[2] ?? 0)
      if (y > 19) c.set(14, y, SKY[2] ?? 0)
    }
    const sail = (f / LOOP) * (TAU / 4)
    for (let k = 0; k < 4; k++) {
      const a = sail + (k * TAU) / 4
      for (let r = 1; r <= 4; r++) c.set(13 + Math.cos(a) * r, 14 + Math.sin(a) * r, SKY[2] ?? 0)
    }
    for (let y = HORIZON + 1; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (isWater(x, y)) {
          const my = 2 * HORIZON - y + 1
          const rx = clamp(x + Math.round(Math.sin(y * 1.9 + TAU * 3 * (f / LOOP)) * 0.7), 0, W - 1)
          const isEdge = !isWater(x, y - 1)
          const n = Math.round((at(Math.max(0, rx - 1), my) + 2 * at(rx, my) + at(Math.min(W - 1, rx + 1), my)) / 4)
          c.set(x, y, waterWithFlock(rx, my, n, 1.3 + (isEdge ? 1.5 : 0) + (y - HORIZON) * 0.06))
        } else {
          const isBank = isWater(x, y + 1)
          const lit = Math.max(0, 1 - Math.abs(x - SUN_X) / 26)
          c.set(x, y, shade(MARSH, 3.4 - (y - HORIZON) * 0.3 + (isBank ? 1 + lit : 0) + (hash(x, 3) > 0.8 ? 0.6 : 0), x, y))
        }
      }
    }
    for (let y = 0; y <= HORIZON + 1; y++) {
      for (let x = 0; x < W; x++) {
        const n = at(x, y)
        if (n === 0) continue
        if (y > farLandTop(x) - 1) {
          if (n >= LOOKS * 1.5) c.set(x, y, INK)
          continue
        }
        if (!isCloud(x, y)) c.set(x, y, skyWithFlock(x, y, n))
        else if (n > LOOKS / 2) c.set(x, y, n >= LOOKS * 1.5 ? INK : MARSH[3] ?? 0)
      }
    }
    for (const r of REEDS) {
      const sway = Math.round(wave(f, LOOP, 3, r.phase) * (r.head ? 1.2 : 0.7))
      let hx = r.x
      for (let y = H - 1; y >= r.top; y--) {
        const s = (H - 1 - y) / (H - 1 - r.top)
        hx = Math.round(r.x + (r.lean + sway) * s * s)
        c.set(hx, y, MARSH[0] ?? 0)
      }
      if (r.head) {
        for (let y = r.top + 1; y <= r.top + 3; y++) {
          c.set(hx, y, MARSH[1] ?? 0)
          c.set(hx + 1, y, y === r.top + 1 ? MARSH[4] ?? 0 : MARSH[2] ?? 0)
        }
      }
    }
    for (const [bx, dir, len, ph] of [[2, 1, 9, 0.1], [6, -1, 7, 0.5], [57, -1, 9, 0.3], [61, 1, 6, 0.8]] as const) {
      const sway = wave(f, LOOP, 3, ph) * 0.8
      for (let k = 0; k <= len; k++) {
        const s = k / len
        c.set(bx + dir * (s * s * 5 + s * sway), H - 1 - s * (len + 2) + s * s * 3, MARSH[0] ?? 0)
      }
    }
    out.push(c.px)
  }

  return out
}

export const scene: Scene = { verb: 'Forming', render, hero: 60 }