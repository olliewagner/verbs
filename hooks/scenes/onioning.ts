import { Canvas, beat, clamp, ease, hex, lerp, loopNoise, mix, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const SAGE = hex('243228 324436 44584a 5a705c 728a72 8ca488 a8bc9e')
const SUN = hex('a8bc9e c2cfaa dadfb6 ece9c4 f8f2d4')
const MAPLE = hex('3a2216 5a3820 7e522c 9e6c3a bc8a4e d4a866 e8c88a f4e0b0')
const STONE = hex('3c3a3e 5a565a 7c7674 a09890 c4bab0')
const SKIN = hex('1c0812 361024 541a34 722646 903658 ac4c66 c66c78 dc9488')
const FLESH = hex('260a26 461242 681e5c 8c2e74 aa468a c26ca2 d898bc ecc6da fcecf4')
const TAN = hex('3a2414 64401e 8e6430 b88c4c d8b474 eed49c')
const CORE = hex('34442a 5c7040 8ca262 bcd08c e2eebc f8fce8')
const SHOOT = hex('17331a 285a20 3e8228 5ea832 88c844 b8e46a')

const CX = 30.5
const BASE = 26.5
const RADII = [10, 8.4, 6.8, 5.3, 3.9, 2.4]
const NECKS = [4.4, 1.8, 1.5, 1.2, 1, 0.8]
const PEELS = [8, 22, 34, 45, 55]
const SPROUT = 63
const REGROW = 80
const PETAL = { spin: 0.1, drift: 0.3, vx: 2, vy: 1.2, g: 0.12 }
const REVEAL = 2.5
type Hit = { sx: number; sy: number; e: number; rim: number; isNeck: boolean; u: number }
function hit(i: number, lx: number, ly: number): Hit | undefined {
  const r = RADII[i] ?? 1
  const neck = NECKS[i] ?? 1
  const sy = (ly + 0.855 * r) / (0.95 * r)
  if (sy > 0.9) return undefined
  if (sy < -1) {
    const u = ((-sy - 1) * 0.95 * r) / neck
    if (u > 1) return undefined
    const lean = i === 0 ? u * u * 1.6 : 0
    const w = 0.4 + 0.12 * r * (1 - u)
    if (Math.abs(lx - lean) > w) return undefined
    return { sx: (lx - lean) / w, sy: -1, e: 0.4, rim: 1, isNeck: true, u }
  }
  const taper = sy < 0 ? 1 - 0.22 * (-sy) ** 1.6 : 1
  const sx = lx / (1.08 * r * taper)
  const e = sx * sx + sy * sy
  if (e > 1) return undefined
  return { sx, sy, e, rim: (1 - Math.sqrt(e)) * r, isNeck: false, u: 0 }
}

function outside(i: number, h: Hit): number {
  if (h.isNeck) {
    if (i === 0) return shade(TAN, 2.6 + (h.sx < 0 ? 1.4 : 0) - h.u * 0.8)
    return i === 5 ? shade(CORE, 3 - h.sx) : shade(FLESH, 4 - h.sx)
  }
  const nz = Math.sqrt(Math.max(0, 1 - h.e))
  const lit = -0.55 * h.sx - 0.6 * h.sy + 0.58 * nz
  const meridian = Math.atan2(h.sx, nz)
  const isStripe = Math.abs(((meridian * 7) / Math.PI) % 1) > 0.82
  if (i === 0) return shade(SKIN, 2.6 + lit * 3.6 - (isStripe ? 0.9 : 0) + (lit > 0.82 ? 0.6 : 0))
  if (i === 5) return shade(CORE, 2 + lit * 2.6)
  if (lit > 0.9 && h.rim > 1.2) return FLESH[8] ?? 0
  return shade(FLESH, 2.6 + (i - 1) * 0.45 + lit * 3.4 - (isStripe ? 0.6 : 0))
}
function inside(i: number, h: Hit): number {
  if (h.rim < (i === 0 ? 1 : 1.1) || h.isNeck) return outside(i, h)
  if (i === 0) return shade(TAN, 4.2 + h.sy * 0.6)
  return shade(FLESH, 7 - (h.sy > 0.3 ? 1 : 0) - (Math.abs(h.sx) > 0.7 ? 0.6 : 0))
}
function turning(i: number, h: Hit, n: number): number {
  const from = outside(i, h)
  const to = inside(i, h)
  if (n <= 0) return from
  const a = (i === 0 ? SKIN : FLESH).indexOf(from)
  const b = (i === 0 ? TAN : FLESH).indexOf(to)
  if (from === to || a < 0 || b < 0) return to
  const path = i === 0 ? [...SKIN.slice(a), ...TAN.slice(4, b + 1)] : FLESH.slice(Math.min(a, b), Math.max(a, b) + 1)
  if (i !== 0 && a > b) path.reverse()
  return path[Math.min(n, path.length - 1)] ?? to
}
function bodyAt(f: number): { i: number; r: number; sqx: number; sqy: number } {
  if (f >= REGROW) {
    let i = 5
    let r = RADII[5] ?? 1
    for (let j = 0; j < 5; j++) {
      const g = REGROW + j * 2.4
      if (f < g) break
      const t = ease.outBack(beat(f, g, g + 3))
      i = 4 - j
      r = lerp(RADII[5 - j] ?? 1, RADII[4 - j] ?? 1, t)
    }
    return { i, r, sqx: 1, sqy: 1 }
  }
  let i = 0
  let sq = 0
  for (const [k, s] of PEELS.entries()) {
    if (f >= s + 2) i = k + 1
    if (f === s + 2) sq = 1
    if (f === s + 3) sq = -0.6
  }
  if (f === 6 || f === 60) sq = 0.6
  if (f === 7 || f === 61) sq = -0.4
  return { i, r: RADII[i] ?? 1, sqx: 1 + sq * 0.07, sqy: 1 - sq * 0.09 }
}
const BRIDGES: [number[], number, number[], number][] = [
  ...[0, 1, 2, 3, 4].map(k => [SKIN, k, FLESH, k] as [number[], number, number[], number]),
  [SKIN, 5, FLESH, 4],
  [SKIN, 6, FLESH, 5],
  [SKIN, 7, FLESH, 6],
  [CORE, 4, FLESH, 8],
  [CORE, 5, FLESH, 8],
]
const NEAR = new Map<number, number[]>()
function link(a: number, b: number): void {
  NEAR.set(a, [...(NEAR.get(a) ?? []), b])
  NEAR.set(b, [...(NEAR.get(b) ?? []), a])
}
for (const ramp of [SKIN, FLESH, CORE]) ramp.slice(1).forEach((c, k) => link(ramp[k] ?? 0, c))
for (const [ra, ka, rb, kb] of BRIDGES) link(ra[ka] ?? 0, rb[kb] ?? 0)
function toward(from: number, to: number): number {
  if (from === to) return to
  const back = new Map<number, number>([[to, to]])
  const queue = [to]
  for (let q = 0; q < queue.length; q++) {
    const at = queue[q] ?? 0
    for (const n of NEAR.get(at) ?? []) {
      if (back.has(n)) continue
      back.set(n, at)
      if (n === from) return at
      queue.push(n)
    }
  }
  return to
}
function beside(was: Int32Array, x: number, y: number): number {
  let best = -1
  let reach = Infinity
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx
      const yy = y + dy
      const d = dx * dx + dy * dy
      if (xx < 0 || yy < 0 || xx >= W || yy >= H || d >= reach) continue
      const c = was[yy * W + xx] ?? -1
      if (c < 0) continue
      best = c
      reach = d
    }
  }
  return best
}
function drawBody(c: Canvas, i: number, r: number, sqx: number, sqy: number, was?: Int32Array): Int32Array {
  const k = r / (RADII[i] ?? 1)
  const now = new Int32Array(W * H).fill(-1)
  for (let y = 0; y < H; y++) {
    for (let x = 8; x < 54; x++) {
      const h = hit(i, (x - CX) / (sqx * k), (y - BASE) / (sqy * k))
      if (!h) continue
      const before = was ? beside(was, x, y) : -1
      const colour = before >= 0 ? toward(before, outside(i, h)) : outside(i, h)
      now[y * W + x] = colour
      c.set(x, y, colour)
    }
  }
  return now
}
function petalPose(t: number): { angle: number; ox: number; oy: number; reveal: number } {
  let angle = 0.05
  let ox = 0
  let oy = 0
  for (let u = 3; u <= t; u++) {
    const spin = PETAL.spin * Math.min(1, (u - 2) / 3) * (u > 5 ? Math.max(PETAL.drift, 1 - (u - 5) * 0.2) : 1)
    const toss = clamp((u - 4) / 4)
    angle += spin
    ox += PETAL.vx * toss
    oy += -PETAL.vy * toss + PETAL.g * Math.max(0, u - 4)
  }
  const reveal = Math.max(0, REVEAL * (t - 2.4))
  return { angle, ox, oy, reveal }
}

function drawPetal(c: Canvas, k: number, side: number, t: number): void {
  const pose = petalPose(t)
  const cos = Math.cos(-side * pose.angle)
  const sin = Math.sin(-side * pose.angle)
  const r = RADII[k] ?? 1
  const px = CX + side * 1.5
  const py = BASE
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - px - side * pose.ox
      const dy = y - py - pose.oy
      const lx = px + dx * cos - dy * sin - CX
      const ly = py + dx * sin + dy * cos - BASE
      if (side * lx <= 0) continue
      const h = hit(k, lx, ly)
      if (!h || h.isNeck) continue
      const n = Math.ceil((pose.reveal - Math.hypot(lx, (ly + 0.9 * r) / 1.6)) / REVEAL)
      c.set(x, y, turning(k, h, n))
    }
  }
  const neck = NECKS[k] ?? 1
  let last: [number, number] | undefined
  for (let j = 0; j <= 4; j++) {
    const u = j / 4
    const lx = (k === 0 ? u * u * 1.6 : 0) + side * 0.5 * (1 - u)
    if (side * lx <= 0) break
    const ly = -1.805 * r - u * neck
    const X = lx + CX - px
    const Y = ly + BASE - py
    const at: [number, number] = [px + side * pose.ox + X * cos + Y * sin, py + pose.oy - X * sin + Y * cos]
    const h: Hit = { sx: 0, sy: -1, e: 0.4, rim: 1, isNeck: true, u }
    const paint = outside(k, h)
    if (last) c.line(last[0], last[1], at[0], at[1], paint)
    last = at
  }
}
function drawShoot(c: Canvas, f: number, r: number): void {
  const top = BASE - 1.805 * r
  let height = 0
  let dry = 0
  if (f >= SPROUT && f < REGROW) height = 12 * ease.outBack(beat(f, SPROUT, SPROUT + 10))
  if (f >= REGROW) {
    height = 12 * (1 - ease.inOut(beat(f, REGROW, REGROW + 10)))
    dry = beat(f, REGROW, REGROW + 9)
  }
  if (height < 0.5 || f >= REGROW + 10) return
  const color = (level: number) => (dry < 0.34 ? shade(SHOOT, level) : dry < 0.67 ? mix(shade(SHOOT, level), shade(TAN, level), 0.5) : shade(TAN, level))
  const sway = f < REGROW ? Math.sin((f - SPROUT) * 0.7) * Math.exp(-(f - SPROUT) / 5) * 1.5 : 0
  for (let j = 0; j < height; j++) {
    const u = j / 12
    const x = Math.round(CX - 0.5 + (sway + 0.8) * u * u)
    const y = Math.round(top - j)
    c.set(x, y, color(3.6 - u * 0.4))
    if (j < height * 0.55) c.set(x + 1, y, color(2.2))
  }

  const leaf = f < REGROW ? ease.out(beat(f, SPROUT + 5, SPROUT + 11)) : 1 - beat(f, REGROW, REGROW + 6)
  const arc: [number, number][] = [[1, 0], [2, -1], [3, -1], [4, -1], [5, 0], [6, 1]]
  const n = Math.round(leaf * arc.length)
  const base = Math.round(top - 5)
  arc.slice(0, n).forEach(([dx, dy], j) => {
    c.set(Math.round(CX - 0.5) + dx + 1, base + dy, color(j === n - 1 ? 4.4 : 3.4))
    if (j < 3) c.set(Math.round(CX - 0.5) + dx + 1, base + dy + 1, color(2))
  })
}
function drawRoom(c: Canvas, f: number, sun: number): void {
  for (let y = 0; y < 22; y++) {
    for (let x = 0; x < W; x++) {
      const left = 5 + y * 0.55
      const isPatch = x >= left && x <= left + 26 && y <= 20
      const isMullion = Math.round(left + 12.5) === x || y === 9
      const leafy = loopNoise(x * 0.22, y * 0.3, f / LOOP, 1, 4) > 0.64
      const fall = Math.hypot(x - 32, y - 8) / 40
      if (isPatch && !isMullion && !leafy) {
        c.set(x, y, shade(SUN, 1.1 + sun - fall * 2.2))
        continue
      }
      c.set(x, y, shade(SAGE, 5 - fall * 2.6 + (isPatch ? 0.6 : 0) - (y > 19 ? 0.6 : 0)))
    }
  }
  for (let y = 22; y < H; y++) {
    for (let x = 0; x < W; x++) c.set(x, y, shade(STONE, 3.2 - (y - 22) * 0.12 - (y === 22 ? 1 : 0)))
  }
  for (let y = 23; y < H; y++) {
    for (let x = 2; x <= 61; x++) {
      const isCorner = (y === 23 || y === 31) && (x === 2 || x === 61)
      if (isCorner) continue
      if (y >= 29) {
        c.set(x, y, shade(MAPLE, (y === 29 ? 3.6 : 2.4) - (x > 56 ? 0.6 : 0)))
        continue
      }
      const grain = Math.round(Math.sin(x * 0.18 + y * 1.7) * 0.8 + y * 0.6) % 3 === 0 ? -0.6 : 0
      c.set(x, y, shade(MAPLE, 4.6 + (y === 23 ? 0.8 : 0) + grain - (x - 2) * 0.012))
    }
  }
}
function render(): Int32Array[] {
  const out: Int32Array[] = []
  let was: Int32Array = new Int32Array(W * H).fill(-1)
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const sun = 0.6 * (ease.inOut(beat(f, SPROUT + 2, SPROUT + 10)) - ease.inOut(beat(f, REGROW + 2, REGROW + 12)))
    drawRoom(c, f, sun)
    const body = bodyAt(f)
    const r = body.r
    c.ellipse(CX + r * 0.9 + 1, BASE + 0.3, r * 1.15 + 1, Math.max(1, r * 0.22), (x, y) => (y >= 24 ? mix(c.get(x, y), MAPLE[1] ?? 0, 0.45) : undefined))
    for (const [dx, ex, ey] of [[-2, -5, 1], [-1, -2, 2], [0, 1, 2], [1, 4, 1], [-1, -4, 2]] as const) {
      c.line(CX + dx, BASE + 0.5, CX + ex, BASE + ey, TAN[3] ?? 0)
    }
    was = drawBody(c, body.i, r, body.sqx, body.sqy, f >= REGROW ? was : undefined)
    for (let x = Math.round(CX - r * 0.5); x <= Math.round(CX + r * 0.6); x++) c.set(x, BASE + 0.5, mix(c.get(x, BASE + 0.5), MAPLE[0] ?? 0, 0.5))
    for (const [k, s] of PEELS.entries()) {
      if (f < s || f >= s + 2) continue
      const rk = RADII[k] ?? 1
      const top = Math.round(BASE - 1.805 * rk) + 1
      const len = (f - s + 1) * rk * 0.4
      for (let y = top; y < top + len; y++) c.set(Math.floor(CX), y, k === 0 ? (SKIN[0] ?? 0) : (FLESH[0] ?? 0))
    }
    drawShoot(c, f, r)
    for (const [k, s] of PEELS.entries()) {
      const t = f - s
      if (t < 2 || t > 24) continue
      drawPetal(c, k, -1, t)
      drawPetal(c, k, 1, t)
    }
    out.push(c.px)
  }
  return out
}
export const scene: Scene = { verb: 'Onioning', render, hero: 72 }