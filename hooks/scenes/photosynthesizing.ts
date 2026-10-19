import { Canvas, H, W, TAU, beat, clamp, frames, hash, hex, loopNoise, particles, shade, smoothstep, wave, type Scene } from '../engine'

const LOOP = 72

const WATER = hex('041418 06202a 092c34 0e3a3e 154844 1e5848 2a6a4c 3c7e50 549456 72aa5c 98c066 c0d880')
const WEED = hex('04140c 0a2412 12361a 1c4c1e 2a6422 3e7e26 5a9a2c 80b836 aed448 dcee70')
const BLADE = hex('0a2a28 103632 18443a 225444 2e644c 3e7652')
const SILT = hex('0a1414 142020 20302a 2e4034 40523e 586a48 788a58')
const BUBBLE = hex('4e8a80 9cd4c6 e0fff4 ffffff')
const SURFACE = hex('5a9a6a 8cc078 bce090 e8f8c0')

const sun = (f: number) => 0.5 + 0.5 * (0.5 - 0.5 * Math.cos(TAU * ((f - 4) / LOOP)))

function caustic(x: number, y: number, f: number): number {
  const t = f / LOOP
  const a = Math.sin(x * 0.55 + y * 0.25 + TAU * t * 3)
  const b = Math.sin(x * 0.3 - y * 0.5 - TAU * t * 2 + 1.3)
  const c = Math.sin((x + y) * 0.4 + TAU * t * 4 + 0.7)
  return clamp(1 - Math.abs(a + b + c) * 0.9)
}

function shaft(x: number, y: number, f: number): number {
  const u = x - y * 0.42
  let s = 0
  for (const [c, w, p] of [[12, 3.2, 0], [27, 2, 0.3], [38, 4, 0.55], [55, 2.5, 0.8]] as const) {
    const drift = wave(f, LOOP, 1, p) * 1.5
    s += smoothstep(w, 0, Math.abs(u - c - drift)) * (0.7 + 0.3 * wave(f, LOOP, 3, p))
  }
  return s * (1 - y / 40)
}

const BASE = { x: 33, y: 30 }
const TOP_Y = 5
type Leaf = { t: number; side: number; len: number; tilt: number }
const LEAVES: readonly Leaf[] = [
  { t: 0.16, side: -1, len: 9, tilt: 0.3 },
  { t: 0.3, side: 1, len: 9.5, tilt: 0.38 },
  { t: 0.46, side: -1, len: 9, tilt: 0.45 },
  { t: 0.61, side: 1, len: 8.5, tilt: 0.55 },
  { t: 0.76, side: -1, len: 7, tilt: 0.65 },
  { t: 0.88, side: 1, len: 6, tilt: 0.8 },
  { t: 1, side: -1, len: 4.5, tilt: 1.2 },
]

const stemX = (t: number, f: number) => BASE.x - t * 2.5 + Math.sin(t * 3.2) * 1.2 + wave(f, LOOP, 2, -t * 0.18) * 2.2 * t ** 1.6
const stemY = (t: number) => BASE.y - t * (BASE.y - TOP_Y)

function leafFrame(l: Leaf, f: number) {
  const ax = stemX(l.t, f)
  const ay = stemY(l.t)
  const flutter = wave(f, LOOP, 2, -l.t * 0.18 - 0.08) * 0.18 * l.t + wave(f, LOOP, 5, l.t) * 0.04
  const ang = l.tilt + flutter * l.side
  return { ax, ay, dx: l.side * Math.cos(ang), dy: -Math.sin(ang) }
}

type Bead = { leaf: number; s: number; edge: number; start: number; grow: number; free: number; size: number }
const BEADS: readonly Bead[] = Array.from({ length: 16 }, (_, i) => {
  const r = (k: number) => hash(i, k, 7)
  return {
    leaf: i % LEAVES.length,
    s: 0.3 + r(1) * 0.65,
    edge: r(2) < 0.6 ? -1 : 1,
    start: 6 + Math.floor(r(3) * 18),
    grow: 10 + Math.floor(r(4) * 8),
    free: 36 + Math.floor(r(5) * 7),
    size: r(6) < 0.12 ? 3 : r(6) < 0.6 ? 2 : 1,
  }
})

function beadAt(b: Bead, f: number): { x: number; y: number } {
  const leaf = LEAVES[b.leaf] ?? LEAVES[0]!
  const { ax, ay, dx, dy } = leafFrame(leaf, f)
  const len = leaf.len * b.s
  const w = 2.4 * Math.sin(Math.PI * b.s) ** 0.7
  return { x: ax + dx * len - dy * w * b.edge, y: ay + dy * len + dx * w * b.edge * -1 }
}

function drawBubble(c: Canvas, x: number, y: number, size: number, bright: number): void {
  const ix = Math.round(x)
  const iy = Math.round(y)
  const lvl = (n: number) => shade(BUBBLE, n + bright, ix, iy)
  if (size <= 1) {
    c.set(ix, iy, lvl(1.6))
  } else if (size === 2) {
    c.set(ix, iy, lvl(2))
    c.set(ix + 1, iy, lvl(1))
    c.set(ix, iy + 1, lvl(1))
    c.set(ix + 1, iy + 1, lvl(0.2))
  } else {
    for (const [dx, dy, n] of [[0, -1, 1.4], [1, -1, 1], [-1, 0, 1.4], [2, 0, 0.4], [-1, 1, 0.8], [2, 1, 0.2], [0, 2, 0.4], [1, 2, 0.2]] as const) {
      c.set(ix + dx, iy + dy, lvl(n))
    }
    c.set(ix, iy, lvl(2.4))
  }
}

function draw(c: Canvas, f: number): void {
  const light = sun(f)
  const t = f / LOOP

  c.fill((x, y) => {
    const depth = 1 - y / H
    const murk = loopNoise(x * 0.12, y * 0.15, t, 1, 3) - 0.5
    return shade(WATER, 1 + depth * 5 + shaft(x, y, f) * 3.4 * light + murk * 1.1, x, y)
  })
  for (let x = 0; x < W; x++) {
    const r = Math.sin(x * 0.7 + TAU * t * 4) + Math.sin(x * 0.31 - TAU * t * 3 + 2)
    c.set(x, 0, shade(SURFACE, 1.8 + r * 0.6 + light, x, 0))
    c.set(x, 1, shade(SURFACE, 0.4 + r * 0.7 + light * 0.6, x, 1))
    if (r > 1) c.set(x, 2, shade(WATER, 9 + light, x, 2))
  }

  for (const [bx, top, ph] of [[4, 9, 0], [9, 14, 0.4], [16, 11, 0.7], [47, 12, 0.2], [53, 8, 0.6], [59, 13, 0.9], [23, 17, 0.5]] as const) {
    for (let y = top; y <= 30; y++) {
      const v = (30 - y) / (30 - top)
      const x = Math.round(bx + wave(f, LOOP, 1, ph - v * 0.15) * 2.4 * v ** 1.5 + v * 1.5)
      const lit = shaft(x, y, f) * light
      c.set(x, y, shade(BLADE, 2.4 + lit * 2 - (y === top ? 0.8 : 0), x, y))
      if (y > top + 2) c.set(x + 1, y, shade(BLADE, 1.6 + lit * 1.6, x + 1, y))
    }
  }

  const fx = Math.round(70 - (f / LOOP) * 78)
  const fy = Math.round(15 + wave(f, LOOP, 2) * 1.2)
  const isFlick = Math.floor(f / 3) % 2 === 0
  c.sprite(fx, fy, [
    '.bbb..' + (isFlick ? 't' : '.'),
    'ebbbbtt',
    '.ddd..' + (isFlick ? '.' : 't'),
  ], { b: BLADE[5] ?? 0, d: BLADE[3] ?? 0, t: BLADE[4] ?? 0, e: BLADE[1] ?? 0 })

  for (let x = 0; x < W; x++) {
    const top = Math.round(28 + Math.sin(x * 0.21) * 0.8 + Math.sin(x * 0.53 + 1) * 0.5)
    for (let y = top; y < H; y++) {
      const net = caustic(x * 0.6, y * 1.2, f) > 0.75 ? 1.6 * light : 0
      c.set(x, y, shade(SILT, 2.6 - (y - top) * 0.6 + (y === top ? 1 : 0) + net, x, y))
    }
  }
  for (const [px, py, pw] of [[10, 29, 3], [26, 30, 2], [44, 29, 3], [57, 30, 2], [38, 30, 2]] as const) {
    for (let i = 0; i < pw; i++) {
      c.set(px + i, py, shade(SILT, i === 0 ? 4.6 : 3.4, px + i, py))
      c.set(px + i, py + 1, shade(SILT, 2, px + i, py + 1))
    }
  }

  for (let y = TOP_Y; y <= BASE.y; y++) {
    const tt = (BASE.y - y) / (BASE.y - TOP_Y)
    const x = Math.round(stemX(tt, f))
    c.set(x, y, shade(WEED, 3.2 + shaft(x, y, f) * light * 1.6, x, y))
    if (tt < 0.5) c.set(x + 1, y, shade(WEED, 2, x + 1, y))
  }
  for (const leaf of LEAVES) {
    const { ax, ay, dx, dy } = leafFrame(leaf, f)
    const L = leaf.len
    for (let y = Math.floor(ay - L - 2); y <= Math.ceil(ay + 3); y++) {
      for (let x = Math.floor(ax - L - 2); x <= Math.ceil(ax + L + 2); x++) {
        const px = x - ax
        const py = y - ay
        const along = (px * dx + py * dy) / L
        const across = -px * dy + py * dx
        if (along < 0 || along > 1) continue
        const half = 2.1 * Math.sin(Math.PI * along) ** 0.8
        if (Math.abs(across) > half) continue
        const isUpper = across * leaf.side > 0
        const isRib = Math.abs(across) < 0.5 && along > 0.06 && along < 0.9
        const isEdge = Math.abs(across) > half - 0.8
        const lvl = 3.4 + along * 0.6 + (isUpper ? 0.9 : -0.5) + (isEdge && isUpper ? 1.2 : 0) - (isRib ? 1.1 : 0) + shaft(x, y, f) * light * 1.8
        c.set(x, y, shade(WEED, lvl, x, y))
      }
    }
  }

  for (const b of BEADS) {
    if (f < b.start) continue
    if (f < b.free) {
      const p = beat(f, b.start, b.start + b.grow)
      const size = p < 0.35 ? 1 : Math.min(b.size, p < 0.75 ? 2 : 3)
      const at = beadAt(b, f)
      const ox = size === 3 ? -0.5 : size === 2 ? -0.5 : 0
      drawBubble(c, at.x + ox, at.y + ox, size, p < 0.2 ? -1 : 0)
      continue
    }
    const k = f - b.free
    const at = beadAt(b, b.free)
    const y = at.y - (0.35 * k + 0.028 * k * k)
    if (y < 3) {
      if (y > -4) {
        const x = Math.round(at.x + Math.sin(k * 0.6 + b.leaf) * 1.1)
        c.set(x - 1, 2, SURFACE[3] ?? 0)
        c.set(x, 1, SURFACE[3] ?? 0)
        c.set(x + 1, 2, SURFACE[3] ?? 0)
      }
      continue
    }
    const x = at.x + Math.sin(k * 0.6 + b.leaf) * Math.min(1.2, k * 0.15)
    drawBubble(c, x - (b.size > 1 ? 0.5 : 0), y, b.size, light * 0.5)
  }
  for (const p of particles(f, LOOP, 9, 26, 5)) {
    const leaf = LEAVES[4 + (p.i % 3)] ?? LEAVES[0]!
    const born = Math.round(((p.i + p.r[0] * 0.8) / 9) * LOOP)
    const { ax, ay, dx, dy } = leafFrame(leaf, born)
    const x = ax + dx * leaf.len * 0.8 + Math.sin(p.t * 0.7 + p.r[1] * 6) * 0.8
    const y = ay + dy * leaf.len * 0.8 - 1 - p.t * (0.5 + p.r[2] * 0.3) - p.t * p.t * 0.01
    if (y > 2) drawBubble(c, x, y, 1, 0)
  }

  for (const p of particles(f, LOOP, 12, 60, 9)) {
    const x = Math.round(p.r[1] * 64 + p.age * 6 - 3)
    const y = Math.round(4 + p.r[2] * 22 + Math.sin(p.age * 4 + p.r[3] * 6) * 1.5)
    if (shaft(x, y, f) * light > 0.5) c.set(x, y, WATER[10] ?? 0)
  }

  for (const [bx, top, ph, side] of [[2, 5, 0.3, 1], [61, 3, 0.8, -1]] as const) {
    for (let y = top; y < H; y++) {
      const v = (H - y) / (H - top)
      const x = Math.round(bx + wave(f, LOOP, 1, ph - v * 0.2) * 1.8 * v ** 1.4 + side * v * 2)
      const w = y < top + 3 ? 0 : y < top + 7 ? 1 : 2
      for (let i = 0; i <= w; i++) c.set(x + i * side, y, shade(WEED, i === 0 ? 2.2 : 0.8, x + i * side, y))
    }
  }
}

export const scene: Scene = { verb: 'Photosynthesizing', render: () => frames(LOOP, draw), hero: 42 }
