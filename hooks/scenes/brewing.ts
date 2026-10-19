import { Canvas, PALETTE, TAU, beat, clamp, ease, frames, hash, hex, lightAt, loopNoise, particles, shade, smoothstep, type Ramp, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 48

const CX = 32
const RIM_Y = 15
const FLOOR_Y = 28
const POP = 20
const BUBBLE_X = 30

const BREW = hex('0b2a1c 104a26 187a2e 2ba734 5cd13e 9eef62 d9ff9e f7ffe2')
const VAPOUR = hex('15281f 22442f 356b43 4e9758 7cc47a b8eba8 edfde4')
const IRON_G = hex('060609 0c0e13 131a1b 1a2a24 233f2d 315a37 487c44 6fa556')
const IRON_O = hex('060609 0e0c12 1c1317 301818 4b201b 70301d 9c4a22 c86e2c')
const STONE_G = hex('08080d 0e1016 141a1d 1a2624 213429 29452f 365c38 4a7a44')
const STONE_O = hex('08080d 110e15 1b1318 281a1a 39211c 4f2c1e 6a3c22 8c5428')
const FIRE = PALETTE.fire
const WOOD = PALETTE.wood
const NIGHT = hex('070a1c 0c1430 142252 1e3270')
const MOON = hex('5a6a98 a8b6dc eef2ff')
const POTION = { purple: hex('1a0c26 3a1650 6a2a8a b06ad8'), amber: hex('2a1408 5a2a0c 9a5418 e6a040'), teal: hex('061c22 0c3a44 16707a 5cc8c8') }

function lit(rg: Ramp, ro: Ramp, base: number, g: number, o: number, x: number, y: number): number {
  return shade(g >= o ? rg : ro, base + g + o, x, y)
}

const vignette = (x: number, y: number) => (((x - 32) / 36) ** 2 + ((y - 14) / 26) ** 2) * 1.8

const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

const LIP = { rx: 10.5, ry: 2.5 }
const SURFACE = { rx: 8.6, ry: 1.6 }
const BELLY = { cy: 19.4, rx: 12.2, ry: 5.8 }
const inLip = (x: number, y: number) => inEllipse(x, y, CX, RIM_Y, LIP.rx, LIP.ry)
const inBrew = (x: number, y: number) => inEllipse(x, y, CX, RIM_Y, SURFACE.rx, SURFACE.ry)
const inBelly = (x: number, y: number) => y >= RIM_Y + 1 && inEllipse(x, y, CX, BELLY.cy, BELLY.rx, BELLY.ry)

function bubble(f: number): { r: number; sx: number; sy: number } {
  if (f < 4 || f >= POP) return { r: 0, sx: 1, sy: 1 }
  const t = beat(f, 4, POP - 1)
  const r = 0.6 + 4 * ease.inOut(t) - 0.8 * Math.sin(clamp((t - 0.45) / 0.3) * Math.PI)
  const stretch = beat(f, POP - 3, POP - 1)
  const wobble = Math.sin(f * 1.9) * 0.08 * t

  return { r, sx: 1 + wobble - 0.12 * stretch, sy: 1 - wobble + 0.3 * stretch }
}

const flashOf = (f: number) => (f >= POP ? Math.exp(-(f - POP) / 2.6) : 0)

const TONGUES = [
  { x: 20.5, w: 1.6, h: 6, k: 3, p: 0.1 },
  { x: 24, w: 2.2, h: 9, k: 4, p: 0.5 },
  { x: 28, w: 2.2, h: 6, k: 5, p: 0.2 },
  { x: 32, w: 2.8, h: 7, k: 3, p: 0.8 },
  { x: 36, w: 2.2, h: 6, k: 4, p: 0.35 },
  { x: 40, w: 2.2, h: 9, k: 5, p: 0.65 },
  { x: 43.5, w: 1.6, h: 6, k: 3, p: 0.9 },
]
function flame(f: number, x: number, y: number): number {
  let t = 0
  for (const g of TONGUES) {
    const h = g.h * (0.72 + 0.28 * Math.sin(TAU * (f * g.k / LOOP + g.p)))
    const v = (FLOOR_Y + 0.5 - y) / h
    if (v < 0 || v > 1) continue
    const c = g.x + Math.sin(TAU * (f * 2 / LOOP + g.p) + v * 2.4) * 1.2 * v * v
    const half = g.w * Math.min(1, 0.6 + v * 2) * (1 - v) ** 0.8
    const d = Math.abs(x - c) / Math.max(0.35, half)
    if (d <= 1) t = Math.max(t, (1 - d * d) * (1 - v ** 1.3))
  }

  return t
}

function ribbon(field: Float32Array, o: { x: number; y: number; length: number; from: number; width: number; coil: number; sway: number }): void {
  const L = 30
  let x = o.x
  let y = o.y
  let th = -Math.PI / 2 - 0.42
  for (let s = 0; s <= o.length; s += 0.5) {
    if (s >= o.from) {
      const r = o.width * (2.3 - 1.6 * (s / L))
      for (let j = Math.floor(y - r); j <= Math.ceil(y + r); j++) {
        for (let i = Math.floor(x - r); i <= Math.ceil(x + r); i++) {
          if (i < 0 || i >= W || j < 0 || j >= H) continue
          const v = 1 - Math.hypot(i - x, j - y) / Math.max(0.7, r)
          if (v > (field[j * W + i] ?? 0)) field[j * W + i] = v
        }
      }
    }
    const k = s < 7 ? 0.05 : 0.2 + 0.32 * ((s - 7) / (L - 7)) ** 1.5
    th += (o.coil * k + 0.1 * Math.sin(s * 0.6 - o.sway) * (1 - o.coil * 0.7)) * 0.5
    x += Math.cos(th) * 0.5
    y += Math.sin(th) * 0.5
  }
}
function vapour(f: number): { field: Float32Array; thin: number } {
  const field = new Float32Array(W * H)
  const grow = ease.out(beat(f, POP, POP + 12))
  const coil = 0.6 + 0.4 * ease.inOut(beat(f, POP + 2, POP + 15))
  const lift = -3 * ease.in(beat(f, POP + 17, LOOP))
  const tail = 30 * 0.8 * ease.in(beat(f, POP + 15, LOOP - 1))
  if (grow > 0 && f < LOOP - 1) {
    ribbon(field, { x: BUBBLE_X + 2, y: RIM_Y - 1 + lift, length: 30 * grow, from: tail, width: 1, coil, sway: TAU * f * 2 / LOOP })
  }
  return { field, thin: smoothstep(POP + 16, LOOP - 1, f) }
}

type Drop = { x: number; y: number; vx: number; vy: number }
function drops(f: number): Drop[] {
  const out: Drop[] = []
  const t = f - POP
  if (t < 0 || t > 12) return out
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i / 8 - 0.5) * 2.6 + (hash(i, 3) - 0.5) * 0.3
    const sp = 0.9 + hash(i, 9) * 0.8
    const vx0 = Math.cos(a) * sp * 1.3
    const vy0 = Math.sin(a) * sp * 1.4
    const x = BUBBLE_X + 0.5 + vx0 * t
    const y = RIM_Y - 3 + vy0 * t + 0.13 * t * t
    if (y > RIM_Y) continue
    out.push({ x, y, vx: vx0, vy: vy0 + 0.26 * t })
  }
  return out
}
function draw(c: Canvas, f: number): void {
  const flash = flashOf(f)
  const bub = bubble(f)
  const swell = bub.r / 4
  const green = { x: CX, y: RIM_Y - 1, power: 0.95 + 0.07 * Math.sin(TAU * f * 2 / LOOP) + swell * 0.25 + flash * 1.3, radius: 38 }
  const flicker = 0.8 + 0.1 * Math.sin(TAU * f * 5 / LOOP) + 0.08 * Math.sin(TAU * (f * 7 / LOOP + 0.3))
  const fire = { x: CX, y: FLOOR_Y - 1, power: flicker * 1.1, radius: 25 }
  const gAt = (x: number, y: number) => lightAt([green], x, y)
  const oAt = (x: number, y: number) => {
    const o = lightAt([fire], x, y)
    if (y >= 24) return o
    return o * smoothstep(0.8, 1.15, Math.abs(x - CX) / (12 + (24 - y) * 0.9))
  }
  for (let y = 0; y < FLOOR_Y; y++) {
    for (let x = 0; x < W; x++) {
      const course = Math.floor(y / 4)
      const off = Math.floor(hash(course, 7) * 7)
      const col = Math.floor((x + off) / 7)
      const isMortar = y % 4 === 3 || (x + off) % 7 === 0
      const block = Math.floor(hash(col, course, 2) * 3) * 0.25
      const bevel = y % 4 === 0 && !isMortar ? 0.3 : 0
      const base = 1.1 + block + bevel - (isMortar ? 0.9 : 0) - vignette(x, y)
      c.set(x, y, lit(STONE_G, STONE_O, base, gAt(x, y) * 3.2, oAt(x, y) * 4, x, y))
    }
  }
  for (let y = 2; y <= 11; y++) {
    for (let x = 4; x <= 13; x++) {
      const isOpening = y >= 6 ? x >= 5 && x <= 12 : inEllipse(x, y, 8.5, 6, 3.6, 3.6)
      const isReveal = y >= 5 ? x >= 4 && x <= 13 : inEllipse(x, y, 8.5, 6, 4.6, 4.4)
      if (isOpening) {
        const isMoon = inEllipse(x, y, 9.6, 5.6, 2.1, 2.1) && !inEllipse(x, y, 8.6, 4.9, 1.9, 1.9)
        c.set(x, y, isMoon ? shade(MOON, x >= 11 ? 2 : 1, x, y) : shade(NIGHT, 1.6 - (y - 6) * 0.3, x, y))
      } else if (isReveal) {
        c.set(x, y, shade(STONE_G, 0.6, x, y))
      }
    }
  }
  c.set(7, 8, MOON[1] ?? 0)
  c.set(11, 9, NIGHT[3] ?? 0)
  for (let x = 4; x <= 13; x++) c.set(x, 12, lit(STONE_G, STONE_O, 2 + (x >= 5 && x <= 12 ? 0.6 : 0), gAt(x, 12) * 3, 0, x, 12))
  for (let x = 46; x <= 62; x++) {
    c.set(x, 9, lit(STONE_O, STONE_O, 2.6, 0, gAt(x, 9) * 3, x, 9))
    c.set(x, 10, shade(STONE_O, 0.8, x, 10))
  }
  c.set(48, 11, shade(STONE_O, 1.2, 48, 11))
  c.set(60, 11, shade(STONE_O, 1.2, 60, 11))
  const glass = (x: number, y: number, r: Ramp, edge: boolean) =>
    c.set(x, y, shade(r, 1 + (edge ? 1.6 : 0) + gAt(x, y) * 2 + flash * 0.8, x, y))
  for (let y = 4; y <= 8; y++) for (let x = 48; x <= 49; x++) glass(x, y, POTION.teal, x === 48 && y >= 5)
  c.set(48, 3, shade(WOOD, 3, 48, 3))
  for (const [x, y] of [[53, 5], [54, 5], [52, 6], [53, 6], [54, 6], [55, 6], [52, 7], [53, 7], [54, 7], [55, 7], [52, 8], [53, 8], [54, 8], [55, 8]] as const) {
    glass(x, y, POTION.purple, x === 52 || (x === 53 && y === 6))
  }
  c.set(53, 4, shade(WOOD, 3, 53, 4))
  c.set(54, 4, shade(WOOD, 2, 54, 4))
  for (let y = 6; y <= 8; y++) for (let x = 58; x <= 60; x++) glass(x, y, POTION.amber, x === 58)
  for (let x = 57; x <= 61; x++) c.set(x, 5, shade(WOOD, x === 57 ? 3 : 2, x, 5))
  c.line(60, 12, 56, 24, shade(WOOD, 3, 0, 0))
  c.line(61, 12, 57, 24, shade(WOOD, 1.6, 0, 0))
  for (let y = 22; y <= 27; y++) {
    const half = 1 + (y - 22) * 0.55
    for (let x = Math.round(56.5 - half); x <= Math.round(56.5 + half); x++) {
      const isStraw = (x + (y > 24 ? 1 : 0)) % 2 === 0
      c.set(x, y, shade(PALETTE.sand, 0.6 + (isStraw ? 0.8 : 0) + oAt(x, y) * 3 + (y === 22 ? -0.6 : 0), x, y))
    }
  }
  for (let x = 55; x <= 58; x++) c.set(x, 23, shade(WOOD, 1.2, x, 23))
  for (const [lx, ly] of [[5, 25.5], [9, 25.5], [7, 22.5], [13, 25.8]] as const) {
    for (let y = Math.floor(ly - 2); y <= Math.ceil(ly + 2); y++) {
      for (let x = Math.floor(lx - 2); x <= Math.ceil(lx + 2); x++) {
        const d = Math.hypot(x - lx, y - ly)
        if (d > 1.9) continue
        const ring = d > 1.3 ? -0.8 : d < 0.6 ? 0.3 : 0
        c.set(x, y, shade(WOOD, 1.6 + ring + oAt(x, y) * 4 + gAt(x, y) * 1.5, x, y))
      }
    }
  }
  for (let y = FLOOR_Y; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const joint = (y === 30 && x % 11 !== 5) || (x + (y > 30 ? 5 : 0)) % 11 === 0
      const base = 1.4 + (y === FLOOR_Y ? 0.5 : 0) - (joint ? 0.8 : 0) - vignette(x, y) * 0.8
      c.set(x, y, lit(STONE_G, STONE_O, base, gAt(x, y) * 1.4, oAt(x, y) * 4.4, x, y))
    }
  }
  for (let y = 16; y <= FLOOR_Y; y++) {
    for (let x = 16; x < 48; x++) {
      const t = flame(f, x, y)
      if (t > 0.04) c.set(x, y, shade(FIRE, 2 + Math.round(t * 4) * 1.5, x, y))
    }
  }
  for (const lx of [24, 39]) {
    for (let y = 23; y <= FLOOR_Y; y++) {
      for (const dx of [0, 1]) {
        const inner = (lx < CX) === (dx === 1)
        c.set(lx + dx, y, shade(IRON_O, 1.2 + (inner ? 2.2 * flicker : 0.4) + (y === FLOOR_Y ? -0.6 : 0), lx + dx, y))
      }
    }
  }
  for (let y = RIM_Y; y < FLOOR_Y; y++) {
    for (let x = 16; x < 48; x++) {
      if (!inBelly(x, y) || inLip(x, y)) continue
      const nx = (x - CX) / BELLY.rx
      const ny = (y - BELLY.cy) / BELLY.ry
      const under = Math.max(0, ny + 0.2) ** 1.3 * 5 * flicker
      const side = Math.abs(nx) > 0.82 && ny > -0.1 ? 1.2 * flicker : 0
      const sheen = Math.hypot(nx + 0.5, (ny + 0.2) * 0.8) < 0.17 ? 2.6 + flash * 2 : 0
      const glow = Math.max(0, -ny) * 0.8 * green.power + flash * 0.6
      const shadow = !inBelly(x, y - 1) || inLip(x, y - 1) ? -0.7 : 0
      c.set(x, y, lit(IRON_G, IRON_O, 0.8 + shadow, glow + sheen, under + side, x, y))
    }
  }
  for (let y = RIM_Y - 3; y <= RIM_Y + 3; y++) {
    for (let x = 18; x < 47; x++) {
      if (!inLip(x, y)) continue
      if (inBrew(x, y)) {
        const n = loopNoise((x - CX) * 0.2, (y - RIM_Y) * 0.9, f / LOOP, 2, 5)
        const centre = 1 - Math.hypot((x - CX) / SURFACE.rx, (y - RIM_Y) / SURFACE.ry)
        const back = !inBrew(x, y - 1) ? -0.9 : 0
        c.set(x, y, shade(BREW, 2.8 + (n - 0.45) * 3 + centre * 1.6 + back + swell * 0.6 + flash * 2.5, x, y))
        continue
      }
      const isBack = y < RIM_Y
      const isInner = inBrew(x, y - 1) || inBrew(x, y + 1) || inBrew(x - 1, y) || inBrew(x + 1, y)
      const isUnder = !inLip(x, y + 1)
      const g = (isBack ? 1.6 : isInner ? 2.6 : 1.4) * green.power + flash
      const base = isUnder ? 0.4 : isInner && !isBack ? 2.6 : 2
      c.set(x, y, shade(IRON_G, base + g, x, y))
    }
  }
  for (const p of particles(f, LOOP, 7, 9, 41)) {
    const bx = Math.round(CX + (p.r[1] - 0.5) * SURFACE.rx * 1.5)
    const by = Math.round(RIM_Y + (p.r[2] - 0.5) * SURFACE.ry * 1.2)
    if (Math.abs(bx - BUBBLE_X) < 4 && bub.r > 1) continue
    const stage = Math.floor(p.age * 4)
    if (stage === 0) c.set(bx, by, BREW[5] ?? 0)
    if (stage === 1) {
      c.set(bx, by, BREW[6] ?? 0)
      c.set(bx + 1, by, BREW[5] ?? 0)
    }
    if (stage === 2) {
      c.sprite(bx - 1, by - 1, ['.h.', 'bab'], { h: BREW[7] ?? 0, a: BREW[4] ?? 0, b: BREW[6] ?? 0 })
    }
    if (stage === 3) {
      c.set(bx - 1, by - 2, BREW[6] ?? 0)
      c.set(bx + 2, by - 1, BREW[5] ?? 0)
      c.set(bx, by, BREW[3] ?? 0)
    }
  }
  const calm = f < POP ? 1 - beat(f, POP - 3, POP) : beat(f, LOOP - 8, LOOP - 1)
  for (const p of particles(f, LOOP, 5, 12, 13)) {
    const x0 = CX + (p.r[1] - 0.5) * 12
    for (let k = 0; k < 3; k++) {
      const y = RIM_Y - 2 - p.t * 0.7 - k
      const x = x0 + Math.sin(p.t * 0.5 + k * 0.9 + p.r[2] * 6) * 1.2
      const a = Math.sin(p.age * Math.PI) * calm - k * 0.2
      if (a > 0.25) c.set(x, y, shade(VAPOUR, 1.4 + a * 2.2, 0, 0))
    }
  }
  if (bub.r > 0.5) {
    const rx = bub.r * 1.2 * bub.sx
    const ry = bub.r * bub.sy
    const cy = RIM_Y + 0.4
    for (let y = Math.floor(cy - ry); y <= RIM_Y + 1; y++) {
      for (let x = Math.floor(BUBBLE_X - rx); x <= Math.ceil(BUBBLE_X + rx); x++) {
        const d = Math.hypot((x - BUBBLE_X) / rx, (y - cy) / ry)
        if (d > 1) continue
        const skin = d > 1 - 1.2 / Math.max(rx, ry) ? 2 : 0
        const spec = Math.hypot((x - BUBBLE_X) / rx + 0.42, (y - cy) / ry + 0.55) < 0.28 ? 3 : 0
        c.set(x, y, shade(BREW, 3.4 + skin + spec + (y > RIM_Y ? -0.6 : 0), x, y))
      }
    }
  }
  for (const [x0, y0, x1, y1] of [[19, 28, 45, 30], [17, 30, 43, 28]] as const) {
    for (let x = x0; x <= x1; x++) {
      const y = Math.round(y0 + ((x - x0) / (x1 - x0)) * (y1 - y0))
      const glow = loopNoise(x * 0.3, y0, f / LOOP, 3, 9) * 2.4 + oAt(x, y) * 2 - Math.abs(x - CX) * 0.12
      c.set(x, y, glow > 1.6 ? shade(FIRE, 2 + Math.round(glow - 1.6) * 1.5, x, y) : shade(WOOD, 2.6, x, y))
      c.set(x, y + 1, shade(WOOD, 1.2 + oAt(x, y) * 1.2, x, y + 1))
    }
  }
  for (const [x, k] of [[27, 3], [36, 5]] as const) {
    const h = 1 + Math.round(1.2 + Math.sin(TAU * (f * k / LOOP + x * 0.1)))
    for (let j = 0; j < h; j++) c.set(x, 27 - j, shade(FIRE, 6 - j * 1.5, x, 27 - j))
  }
  for (const p of particles(f, LOOP, 10, 10, 7)) {
    const side = p.i % 2 === 0 ? -1 : 1
    const x = CX + side * (11 + p.r[1] * 3) + Math.sin(p.t * 0.7 + p.r[2] * 6) * 0.8
    const y = 24 - p.t * (0.9 + p.r[3] * 0.5)
    c.set(x, y, shade(FIRE, 7 - p.age * 4.5, 0, 0))
  }
  const { field, thin } = vapour(f)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = (field[y * W + x] ?? 0) - thin
      if (v <= 0.04) continue
      c.set(x, y, shade(VAPOUR, 2.4 + v * 3.6 + flash * 1.5, x, y))
    }
  }
  if (f === POP) {
    for (let k = 0; k < 10; k++) {
      const a = Math.PI + (k / 9) * Math.PI
      c.set(BUBBLE_X + Math.cos(a) * 6, RIM_Y - 1 + Math.sin(a) * 5, BREW[7] ?? 0)
      c.set(BUBBLE_X + Math.cos(a) * 4.4, RIM_Y - 1 + Math.sin(a) * 3.6, BREW[6] ?? 0)
    }
  }
  for (const d of drops(f)) {
    if (Math.abs(d.vy) > 0.7) c.set(d.x - d.vx * 0.6, d.y - d.vy * 0.6, BREW[4] ?? 0)
    c.set(d.x, d.y, BREW[6] ?? 0)
  }
}
export const scene: Scene = {
  verb: 'Brewing',
  render: () => frames(LOOP, draw),
  hero: 32,
  snaps: [{ frames: POP, why: 'the bubble bursts in a green flash that lights the whole hut at once, then dies away' }],
}