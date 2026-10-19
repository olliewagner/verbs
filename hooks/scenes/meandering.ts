import { fract, frames, hash, hex, mod, noise, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const GRASS = hex('132a1c 1c3c22 28552a 3a7032 528a3a 6ea444 92bc56')
const MEADOW = hex('1c3a20 2c5428 447430 5e8a3a 7a9e48 98b45c')
const WHEAT = hex('3a3418 5e5022 86702e a88c3c c4a64e dcbe68')
const PLOUGH = hex('2a1a14 40281a 5a3a22 72502e 8a6a3e')
const TREE = hex('08160e 0f2414 173620 21492a 2f5e30')
const WATER = hex('0b2240 113656 194c72 22648e 3584aa 5aa6c4 9ad0de e4f6f8')
const SAND = hex('6a5a3e 9a8456 c4ac74 e2cc96')
const ROOF = hex('4a1a14 7a2c1e b0482a d86a38')
const HULL = hex('5a2a1e c84a2e f4efe4')

const COURSE: [number, number][] = [
  [-6, 11], [2, 12], [9, 17], [9, 24], [13, 28.5], [19, 26], [21, 18], [23, 9], [29, 4.5], [35, 8], [36, 16],
  [38, 24], [44, 27.5], [50, 24], [51, 16], [55, 10], [62, 8.5], [70, 10],
]
const HALF = 2

type Sample = { x: number; y: number; tx: number; ty: number; s: number }

function riverSamples(): Sample[] {
  const dense: [number, number][] = []
  for (let i = 0; i < COURSE.length - 1; i++) {
    const p0 = COURSE[Math.max(0, i - 1)] ?? [0, 0]
    const p1 = COURSE[i] ?? [0, 0]
    const p2 = COURSE[i + 1] ?? [0, 0]
    const p3 = COURSE[Math.min(COURSE.length - 1, i + 2)] ?? [0, 0]
    for (let t = 0; t < 1; t += 0.02) {
      const t2 = t * t
      const t3 = t2 * t
      const at = (k: 0 | 1) =>
        0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)
      dense.push([at(0), at(1)])
    }
  }
  const out: Sample[] = []
  let s = 0
  let next = 0
  for (let i = 1; i < dense.length; i++) {
    const [ax, ay] = dense[i - 1] ?? [0, 0]
    const [bx, by] = dense[i] ?? [0, 0]
    const len = Math.hypot(bx - ax, by - ay)
    while (next <= s + len) {
      const t = (next - s) / len
      out.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, tx: (bx - ax) / len, ty: (by - ay) / len, s: next })
      next += 0.5
    }
    s += len
  }
  return out
}

type Ground = { d: number; s: number; side: number; curl: number }

const CLOUDS: [number, number, number, number][] = [
  [0, 8, 10, 5.5], [7, 6, 6, 4], [38, 24, 9, 4.5], [44, 22, 5, 3.5],
]

function render(): Int32Array[] {
  const river = riverSamples()
  const length = river[river.length - 1]?.s ?? 1

  const ground: Ground[] = []
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let best = 1e9
      let at = 0
      for (let i = 0; i < river.length; i++) {
        const p = river[i]
        if (!p) continue
        const d = (p.x - x) ** 2 + (p.y - y) ** 2
        if (d < best) {
          best = d
          at = i
        }
      }
      const p = river[at] ?? { x: 0, y: 0, tx: 1, ty: 0, s: 0 }
      const q = river[Math.min(river.length - 1, at + 6)] ?? p
      const o = river[Math.max(0, at - 6)] ?? p
      const curl = o.tx * q.ty - o.ty * q.tx
      const side = Math.sign(p.tx * (y - p.y) - p.ty * (x - p.x))
      ground.push({ d: Math.sqrt(best), s: p.s, side, curl })
    }
  }
  const groundAt = (x: number, y: number) => (x < 0 || x >= W || y < 0 || y >= H ? undefined : ground[y * W + x])

  const isTree = (x: number, y: number) => {
    const g = groundAt(x, y)
    if (!g || g.d < HALF + 0.9) return false
    return g.d < HALF + 3.4 && noise(x * 0.3, y * 0.3, 1) > 0.47
  }

  const isOxbow = (x: number, y: number) => {
    const d = Math.hypot((x - 29) / 5, (y - 23.5) / 4.6)
    return d > 0.6 && d < 1 && y > 24
  }

  const fieldOf = (x: number, y: number) => {
    const u = x * 0.97 + y * 0.24
    const v = -x * 0.24 + y * 0.97
    const cu = Math.floor(u / 12)
    const cv = Math.floor(v / 9)
    const isHedge = mod(u, 12) < 1 || mod(v, 9) < 1
    return { kind: Math.floor(hash(cu, cv, 5) * 4), isHedge, u, v, tone: hash(cu, cv, 9) > 0.5 ? 0.5 : 0 }
  }

  const HOUSES: [number, number, number][] = [[27, 12, 0], [31, 14, 1], [28, 16, 1], [33, 11, 0]]

  return frames(LOOP, (c, f) => {
    const drift = (f / LOOP) * (W + 40)
    const isShadow = (x: number, y: number) => {
      for (const [cx, cy, rx, ry] of CLOUDS) {
        const px = mod(cx + drift + 20, W + 40) - 20
        if (Math.hypot((x - px) / rx, (y - cy) / ry) < 1) return true
      }
      return false
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const g = ground[y * W + x]
        if (!g) continue
        const dark = isShadow(x, y) ? 1.4 : 0
        if (g.d < HALF) {
          const up = groundAt(x - 1, y - 1)
          const isBankShade = !!up && up.d >= HALF && !isOxbow(x - 1, y - 1)
          const ripple = fract((g.s - (f / LOOP) * 24) / 8)
          const glint = ripple < 0.26 && g.d < HALF * 0.8 ? 1 : 0
          c.set(x, y, shade(WATER, (isBankShade ? 2.6 : 3.8) + (isBankShade ? 0 : glint) - dark))
          continue
        }
        if (isOxbow(x, y)) {
          c.set(x, y, shade(WATER, 3.2 - dark))
          continue
        }
        const isInside = g.curl * g.side > 0
        if (g.d < HALF + 1.3 && isInside && Math.abs(g.curl) > 0.55) {
          c.set(x, y, shade(SAND, 2.6 - dark))
          continue
        }
        if (isTree(x, y)) {
          c.set(x, y, shade(TREE, (isTree(x - 1, y - 1) ? 2.6 : 4) - dark))
          continue
        }
        if (isTree(x - 1, y - 1)) {
          c.set(x, y, shade(GRASS, 1.4 - dark))
          continue
        }
        if (g.d < HALF + 3.6) {
          c.set(x, y, shade(GRASS, 3 - dark))
          continue
        }
        const fd = fieldOf(x, y)
        if (fd.isHedge) {
          c.set(x, y, shade(GRASS, 2 - dark))
          continue
        }
        if (fd.kind === 0) c.set(x, y, shade(WHEAT, 3.6 + fd.tone - dark))
        else if (fd.kind === 1) c.set(x, y, shade(PLOUGH, 3.4 - (mod(Math.floor(fd.v / 2), 2) ? 0.9 : 0) - dark))
        else if (fd.kind === 2) c.set(x, y, shade(MEADOW, 4 + fd.tone - dark))
        else c.set(x, y, shade(GRASS, 4 + fd.tone - dark))
      }
    }

    for (const [hx, hy, turn] of HOUSES) {
      const dark = isShadow(hx, hy) ? 1.4 : 0
      const w = turn ? 2 : 3
      const h = turn ? 3 : 2
      c.rect(hx + 1, hy + 1, w, h, shade(GRASS, 1 - dark))
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const isSunny = turn ? i === 0 : j === 0
          c.set(hx + i, hy + j, shade(ROOF, (isSunny ? 3 : 1.8) - dark))
        }
      }
    }

    for (const b of [0, 1]) {
      const s = mod(b * length * 0.5 + (f / LOOP) * length * 0.5, length)
      const i = Math.round(s / 0.5)
      const at = (k: number) => river[Math.max(0, Math.min(river.length - 1, k))]
      for (let k = 4; k < 22; k++) {
        const p = at(i - k)
        if (!p) continue
        const spread = 0.3 + k * 0.1
        for (const sd of [-1, 1]) {
          const wx = Math.round(p.x - p.ty * spread * sd)
          const wy = Math.round(p.y + p.tx * spread * sd)
          const g = groundAt(wx, wy)
          if (!g || g.d >= HALF) continue
          c.set(wx, wy, shade(WATER, 6.4 - k * 0.12 - (isShadow(wx, wy) ? 1.4 : 0)))
        }
      }
      const head = at(i)
      const tail = at(i - 4)
      if (!head || !tail) continue
      const dark = isShadow(head.x, head.y) ? 1 : 0
      c.set(tail.x + 0.7, tail.y + 0.7, shade(WATER, 1.6))
      c.set(head.x + 0.7, head.y + 0.7, shade(WATER, 1.6))
      c.set(tail.x, tail.y, shade(HULL, 1 - dark))
      c.set((head.x + tail.x) / 2, (head.y + tail.y) / 2, shade(HULL, 2 - dark))
      c.set(head.x, head.y, shade(HULL, 2 - dark))
    }
  })
}

export const scene: Scene = { verb: 'Meandering', render, hero: 30 }
