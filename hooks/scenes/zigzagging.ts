import { Canvas, frames, hash, hex, mod, random, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const SNOW = hex('262a4a 363d68 4b5689 66739f 8796be a9b8d6 c9d5e9 e6edf6 fbfcff')
const SKY = hex('132c6e 1a3a88 23499e 2f5cb2 3f72c4 5a8fd4 7eaee2 a9cdef')
const PEAK = hex('283768 36487e 4a5f96 6379ae 8499c6 a9bddc cddaee eef3fa')
const PINE = hex('061310 0b1e1a 122b24 1a3a30 244b3c 326048')
const JACKET = hex('3e0b18 6e1622 a82329 d83a2c f2663a fb9a5c')
const PANTS = hex('0c0f1e 161c34 222c4e 33406a 4a5a8a')
const HELMET = hex('6a4a0c a8780e e0aa1a f8d44a fdf0a0')
const SKI = hex('5a1a0e 9a2e14 d8501e f6823a')
const RED = hex('5a0c16 9e1c26 dc3a32 f6704e')
const BLUE = hex('0c1650 1a3698 2e5ad8 5a8cf0')
const POLE = 0x1c1d28
const GLOVE = 0x15141c
const LENS = 0x1a1530
const GLINT = 0xbfe6ff

const HORIZON = 8
const K = 170
const F = 10
const CREST_D = 150
const SKIER_D = 10

const LAMBDA = 16
const PERIOD = 2 * LAMBDA
const SPEED = PERIOD / LOOP
const AMP = 17

const lineU = (v: number) => AMP * Math.sin((2 * Math.PI * v) / LAMBDA)
const project = (u: number, d: number, z = 0) => ({ x: 32 + (u * F) / d, y: HORIZON + (K - z * F) / d })
const camera = (f: number) => -SPEED * f

type Pine = { u: number; v: number; h: number }
const PINES: Pine[] = (() => {
  const out: Pine[] = []
  for (let k = 0; k < 12; k++) {
    for (const side of [-1, 1]) {
      for (const rank of [0, 1]) {
        const s = (side < 0 ? 0 : 2) + rank
        out.push({ u: side * (31 + rank * 9 + hash(k, s, 1) * 5), v: (k + rank * 0.5 + hash(k, s, 2) * 0.4) * (PERIOD / 12), h: 8 + hash(k, s, 3) * 5 + rank * 2 })
      }
    }
  }
  return out
})()

function drawSky(c: Canvas): void {
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < W; x++) c.set(x, y, shade(SKY, 0.6 + y * 0.62, x, y))
  }
  const peaks = [
    { x: 43, y: 0.5, l: 29, r: 61, ridge: 46.5 },
    { x: 14, y: 3.5, l: 0, r: 28, ridge: 16 },
    { x: 61, y: 4.5, l: 52, r: 72, ridge: 63 },
  ]
  for (const p of peaks) {
    for (let y = Math.ceil(p.y); y < 12; y++) {
      const t = (y - p.y) / (10 - p.y)
      const left = p.x - (p.x - p.l) * t
      const right = p.x + (p.r - p.x) * t
      const ridge = p.x + (p.ridge - p.x) * t
      for (let x = Math.ceil(left - 0.5); x <= Math.floor(right - 0.5); x++) {
        const isLit = x < ridge
        const gully = !isLit && Math.abs(x - (ridge + (right - ridge) * 0.45)) < 0.6 && t > 0.3 ? -0.8 : 0
        const rock = isLit && Math.abs(x - (left + (ridge - left) * 0.5)) < 0.6 && t > 0.45 ? -1.2 : 0
        c.set(x, y, shade(PEAK, (isLit ? 6.4 : 3.6) - t * 1.4 + gully + rock, x, y))
      }
    }
  }
}

function drawSlope(c: Canvas, f: number): void {
  const vc = camera(f)
  for (let y = 0; y < H; y++) {
    if (y + 0.5 <= HORIZON + K / CREST_D) continue
    const d = K / (y - HORIZON)
    for (let x = 0; x < W; x++) {
      const u = ((x - 32) * d) / F
      const haze = Math.min(1, d / 70)
      const shadowEdge = -24 + Math.sin(((vc + d) * 2 * Math.PI) / PERIOD * 3) * 1.5
      let level = 6.9 - haze * 0.9
      if (u < shadowEdge) level = 4.3 - haze * 0.3
      if (u > 26) level -= Math.min(1.2, (u - 26) * 0.25)
      c.set(x, y, shade(SNOW, level, x, y))
    }
  }
}

function drawTracks(c: Canvas, f: number): void {
  const vc = camera(f)
  for (let d = SKIER_D + 0.4; d < 80; d += d * 0.008) {
    const v = vc + d
    const u = lineU(v)
    const slope = Math.cos((2 * Math.PI * v) / LAMBDA)
    const level = d < 22 ? 3.4 : d < 40 ? 4.2 : 5
    for (const side of d < 30 ? [-0.9, 0.9] : [0]) {
      const across = side * (1 - Math.abs(slope) * 0.55)
      const p = project(u + across, d + side * slope * 0.5)
      c.set(p.x, p.y, shade(SNOW, level, 0, 0))
    }
  }
}

function drawPine(c: Canvas, p: Pine, d: number): void {
  const base = project(p.u, d)
  const s = F / d
  const h = p.h * s
  const bx = Math.round(base.x)
  const by = Math.round(base.y)
  const haze = Math.min(1.4, d / 60)
  if (h < 2) {
    c.set(bx, by - 1, shade(PINE, 2 + haze, 0, 0))
    return
  }
  const tall = Math.round(h)
  const tiers = Math.max(1, Math.round(h / 3.2))
  for (let j = 0; j < tall; j++) {
    const t = (j + 0.5) / tall
    const tier = (t * tiers) % 1
    const half = (0.1 + 0.3 * t + 0.22 * tier) * h * 0.5
    for (let x = -Math.round(half); x <= Math.round(half); x++) {
      const px = bx + x
      const py = by - tall + j
      const isSnow = tier < 0.3 && x < 0 && x > -Math.round(half) - 1 && h > 5
      const level = (x < 0 ? 2.2 : 1) + (x === -Math.round(half) ? 0.8 : 0) + haze
      c.set(px, py, isSnow ? shade(SNOW, 6 - haze, px, py) : shade(PINE, level, px, py))
    }
  }
  c.set(bx, by, PINE[0] ?? 0)
}

function drawGate(c: Canvas, u: number, d: number, isRed: boolean): void {
  const ramp = isRed ? RED : BLUE
  const base = project(u, d)
  const s = F / d
  const h = Math.max(1, Math.round(8 * s))
  const x = Math.round(base.x)
  const y = Math.round(base.y)
  const dir = u > 0 ? -1 : 1
  const since = (d - SKIER_D - 0.4) / SPEED
  const bend = since < 0 ? 0 : 3.2 * Math.exp(-since / 5) * Math.cos(since * 0.95)
  const lean = (k: number) => Math.round(dir * bend * (k / h) ** 2)
  for (let i = 1; i <= Math.round(4 * s); i++) c.set(x + i, y, shade(SNOW, 4.2, x, y))
  for (let k = 0; k < h; k++) c.set(x + lean(k), y - k, shade(ramp, k % 3 === 2 && h > 5 ? 3 : 1.6, x, y))
  if (s < 0.3) return
  const pw = Math.max(1, Math.round(3.2 * s))
  const ph = Math.max(1, Math.round(2.6 * s))
  for (let j = 0; j < ph; j++) {
    const top = x + lean(h - 1 - j)
    for (let i = 1; i <= pw; i++) c.set(top + dir * i, y - h + 1 + j, shade(ramp, j === 0 ? 3 : 2.2 - (i === pw ? 0.6 : 0), x, y))
  }
}

type Puff = { born: number; u: number; v: number; vu: number; vv: number; vz: number; life: number; big: boolean }
const SPRAY: Puff[] = (() => {
  const out: Puff[] = []
  const next = random(0x51a1)
  for (let turn = 0; turn < 4; turn++) {
    const apex = 12 + turn * 16
    for (let k = 0; k < 48; k++) {
      const born = apex + next() * 6
      const vs = camera(born) + SKIER_D
      const side = Math.sign(lineU(vs))
      out.push({
        born,
        u: lineU(vs) + side * (1.5 + next()),
        v: vs + (next() - 0.5) * 1.5,
        vu: side * (0.4 + next() * 1.1),
        vv: -SPEED * (0.2 + next() * 0.6),
        vz: 0.4 + next() * 0.9,
        life: 10 + Math.floor(next() * 10),
        big: next() < 0.45,
      })
    }
  }
  return out
})()

function drawSpray(c: Canvas, f: number, isFront: boolean): void {
  const vc = camera(f)
  for (const p of SPRAY) {
    const a = mod(f - p.born, LOOP)
    if (a >= p.life) continue
    const k = (1 - 0.8 ** a) / 0.2
    const u = p.u + p.vu * k
    const v = p.v + p.vv * a
    const z = Math.max(0, p.vz * k - 0.035 * a * a)
    const d = v - vc
    if (d < 1 || d < SKIER_D !== isFront) continue
    const q = project(u, d, z)
    const t = a / p.life
    if (z < 0.15 && t > 0.3) continue
    const level = 8.4 - t * 1.8 - (z < 0.8 ? 1 : 0)
    c.set(q.x, q.y, shade(SNOW, level, 0, 0))
    if (p.big && t < 0.7) {
      c.set(q.x + Math.sign(p.vu), q.y, shade(SNOW, level - 0.4, 0, 0))
      c.set(q.x, q.y + 1, shade(SNOW, level - 2.2, 0, 0))
      if (t < 0.35) c.set(q.x + Math.sign(p.vu), q.y + 1, shade(SNOW, level - 2.6, 0, 0))
    }
  }
}

function drawSkier(c: Canvas, fx: number, fy: number, lean: number, head: number, crouch: number): void {
  for (let i = 1; i <= 7; i++) c.set(fx + i, fy + 1 - (i > 4 ? 1 : 0), shade(SNOW, 3 + i * 0.2, fx, fy))
  c.set(fx, fy + 1, shade(SNOW, 3, fx, fy))

  const legs = 5.6 - crouch * 0.9
  const hx = fx + Math.sin(lean) * legs
  const hy = fy - Math.cos(lean) * legs
  const tilt = lean * 0.35
  const sx = hx + Math.sin(tilt) * 4.4
  const sy = hy - Math.cos(tilt) * 4.4

  const lx = head * 4
  const ly = (1 - Math.abs(head)) * 1.6 + 0.3
  const ox = (1 - Math.abs(head)) * 1.3
  const oy = Math.abs(head) > 0.4 ? 1 : 0
  for (const s of [-1, 1]) {
    const cx = fx + s * ox
    const cy = fy + (s > 0 ? oy : 0)
    c.line(cx - lx, cy - ly + 0.5, cx + lx, cy + ly - 0.5, (x, y) => shade(SKI, x <= fx ? 2.4 : 1.6, x, y))
    c.set(cx + lx, cy + ly - 0.5, SKI[3] ?? 0)
  }

  const hands = [[sx - 3.6, sy + 2.6], [sx + 3.6, sy + 2.6]] as const
  for (const [px, py] of hands) c.line(px, py + 1, px + Math.sign(px - sx) * 1.2 - head * 2.4, fy - 1, POLE)

  c.poly([[fx - 2, fy - 0.4], [fx + 2, fy - 0.4], [hx + 2, hy], [hx - 2, hy]], (x, y) => shade(PANTS, x < (hx + fx) / 2 - 0.5 ? 3 : 1.6, x, y))
  c.line(fx, fy - 1, (fx * 0.6 + hx * 0.4), (fy * 0.6 + hy * 0.4), PANTS[0] ?? 0)
  c.poly([[hx - 2.2, hy + 0.5], [hx + 2.2, hy + 0.5], [sx + 2.8, sy - 0.2], [sx - 2.8, sy - 0.2]], (x, y) => shade(JACKET, 2.3 + (x < sx - 0.7 ? 1.7 : 0) - (x > sx + 1.2 ? 0.9 : 0) + (y < sy + 0.8 ? 0.5 : 0), x, y))
  for (const [px, py] of hands) {
    const side = Math.sign(px - sx)
    c.line(sx + side * 2.2, sy + 0.3, px, py, (x, y) => shade(JACKET, side < 0 ? 3.8 : 1.8, x, y))
    c.set(px, py + 1, GLOVE)
  }
  const gx = Math.round(sx + Math.sin(tilt) * 1.5)
  const gy = Math.round(sy - 1)
  for (const [dx, dy, l] of [[-1, -2, 3.6], [0, -2, 3.2], [1, -2, 2.4], [-1, -1, 3.2], [0, -1, 2.6], [1, -1, 1.8]] as const) {
    c.set(gx + dx, gy + dy, shade(HELMET, l, 0, 0))
  }
  for (const dx of [-1, 0, 1]) c.set(gx + dx, gy, dx === -1 ? GLINT : LENS)
}

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const vc = camera(f)
    drawSky(c)
    drawSlope(c, f)
    drawTracks(c, f)

    type Thing = { d: number; draw: () => void }
    const things: Thing[] = []
    for (const p of PINES) {
      for (let rep = 0; rep < 6; rep++) {
        const d = p.v + rep * PERIOD - mod(vc, PERIOD)
        if (d > 4 && d < 110) things.push({ d, draw: () => drawPine(c, p, d) })
      }
    }
    for (let n = -1; n < 12; n++) {
      const v = Math.floor(vc / (LAMBDA / 2)) * (LAMBDA / 2) + LAMBDA / 4 + (n * LAMBDA) / 2
      const d = v - vc
      if (d < 3 || d > 48) continue
      const side = Math.sign(lineU(v))
      const index = Math.round((v - LAMBDA / 4) / (LAMBDA / 2))
      things.push({ d: Math.abs(d - SKIER_D) < 2.5 ? SKIER_D + 0.01 : d, draw: () => drawGate(c, side * (AMP - 5), d, mod(index, 2) === 0) })
    }
    const vs = vc + SKIER_D
    const phase = (2 * Math.PI * vs) / LAMBDA
    const feet = project(lineU(vs), SKIER_D)
    const lean = -Math.sin(phase) * 0.6
    const head = -Math.cos(phase)
    const crouch = Math.abs(Math.sin(phase))
    things.push({
      d: SKIER_D,
      draw: () => {
        drawSpray(c, f, false)
        drawSkier(c, feet.x, feet.y, lean, head, crouch)
        drawSpray(c, f, true)
      },
    })
    things.sort((a, b) => b.d - a.d)
    for (const t of things) t.draw()
  })
}

export const scene: Scene = { verb: 'Zigzagging', render, hero: 23 }
