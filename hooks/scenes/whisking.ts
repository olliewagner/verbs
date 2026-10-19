import { Canvas, TAU, beat, clamp, ease, fract, hex, lerp, mix, mod, particles, shade, smoothstep, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 48

const WALL = hex('1e2532 27303f 313b4c 3d4859 4b5567 5e6676 7a7c84 9a958e')
const MARBLE = hex('7e7c86 9896a0 b4b1b6 cfcbca e4e0da f4f0e8')
const COPPER = hex('2a0f0c 4a1d14 6f2e1a 96441f bd5e2a db8040 eda766 f7cf98 fff3dc')
const FOAM = hex('54537a 74779e 989dbe bcc2d8 dcdfea f2f3f6 ffffff')
const STEEL = hex('34313c 4f4b58 726c7a a49ca6 d8d0d0 ffffff')
const SKIN = hex('4e261e 7e4430 a8644a cc8862 e6aa80 f6cca2')
const SLEEVE = hex('243042 32435a 435a76 587494 7894b2')
const SHELL = hex('7e7262 a8987e cdbfa4 e8dec8 faf5ea')

const RIM = { x: 26, y: 20, rx: 19, ry: 4.5 }
const COUNTER_Y = 25

const rimAt = (x: number, side: -1 | 1) => RIM.y + side * RIM.ry * Math.sqrt(Math.max(0, 1 - ((x - RIM.x) / RIM.rx) ** 2))
const inRim = (x: number, v: number) => ((x - RIM.x) / RIM.rx) ** 2 + ((v - RIM.y) / RIM.ry) ** 2 < 1

const g = (f: number) => mod(f - 45, LOOP)

const turns = (f: number) => {
  const s = clamp(g(f) / 24)
  return 3 * (s - Math.sin(TAU * s) / (3 * TAU))
}
const speed = (f: number) => (g(f) < 24 ? Math.sin(Math.PI * clamp(g(f) / 24)) : 0)
const lifted = (f: number) => ease.inOut(beat(g(f), 25, 29)) - smoothstep(39, 45, g(f))
type Whisk = { tx: number; ty: number; bx: number; by: number; spin: number }
function whisk(f: number): Whisk {
  const a = turns(f) * TAU
  const t = g(f)
  const s = t < 24 ? 1 : 0
  const rise = ease.inOut(beat(t, 25, 29))
  const away = smoothstep(29, 34, t)
  const out = 1 - smoothstep(39, 45, t)
  return {
    tx: 37 - s * (Math.cos(a) - 1) + (away - rise) * 6 * out,
    ty: -6 - (rise * 8 + away * 3) * out,
    bx: 31 + s * 4 * (Math.cos(a) - 1) + (away * 8 - rise) * out,
    by: 19 + s * 1.5 * Math.sin(a) - (rise * 11 + away) * out,
    spin: a / 3,
  }
}
function peak(f: number): number {
  const t = g(f)
  if (t < 25 || t > 45) return 0
  if (t < 29) return lerp(1, 11, ease.inOut(beat(t, 25, 29)))
  if (t < 41) return 8.5 + 2.2 * Math.exp(-(t - 29) * 0.5) * Math.cos((t - 29) * 1.7)
  return 8.5 * (1 - ease.in(beat(t, 41, 45)))
}
const PEAK = { x: 30, y: 13 }
const BLOBS: [number, number, number][] = [
  [14, 18, 2.8], [20, 16.5, 3.4], [27, 16, 3.6], [34, 16.5, 3.2], [40, 18, 2.6],
  [11, 20.5, 3], [18, 20, 4], [26, 19.5, 4.4], [34, 20, 4], [41, 20.5, 3],
  [15, 22.5, 3.6], [23, 23, 4], [31, 23, 4], [38, 22.5, 3.4],
]
function field(f: number): (x: number, y: number) => number {
  const s = speed(f)
  const a = turns(f) * TAU
  const blobs = BLOBS.map(([bx, by, r], i) => [
    bx + s * 1.2 * Math.cos(a + i * 1.7),
    by + s * 0.6 * Math.sin(a + i * 1.7),
    (r * 0.78 + s * 0.35 * Math.sin(a * 2 + i)) ** 2,
  ] as const)
  return (x, y) => {
    let sum = 0
    for (const [bx, by, r2] of blobs) sum += r2 / Math.max(0.2, (x - bx) ** 2 + (y - by) ** 2)
    return sum
  }
}
function drawFoam(c: Canvas, f: number) {
  const F = field(f)
  const allowed = (x: number, y: number) => (y > rimAt(x, -1) ? inRim(x, y) : Math.abs(x - RIM.x) < RIM.rx - 1.5)
  const spin = turns(f) * TAU * 0.5
  for (let y = 0; y < H; y++) {
    for (let x = 6; x < 47; x++) {
      const v = F(x, y)
      if (v < 1 || !allowed(x, y)) continue
      const gx = F(x + 1, y) - F(x - 1, y)
      const gy = F(x, y + 1) - F(x, y - 1)
      const gl = Math.hypot(gx, gy) || 1
      const lit = (-gx / gl) * 0.6 + (gy / gl) * 0.8
      const rim = v < 1.35 && lit < 0 ? -0.6 : 0
      let level = 4.2 + lit * 1.5 + rim - (RIM.x - x) * 0.025
      if (v < 1.6 && lit > 0.8) level += 1.2
      c.set(x, y, shade(FOAM, level, x, y))
    }
  }
  for (const arm of [0, Math.PI]) {
    let prev: [number, number] | undefined
    for (let t = 0.1; t <= 0.85; t += 0.04) {
      const th = t * TAU + arm + spin
      const R = 2 + 13 * t
      const p: [number, number] = [28 + R * Math.cos(th), 18.5 + R * 0.36 * Math.sin(th)]
      if (prev) {
        const [ax, ay] = prev
        c.line(ax, ay, p[0], p[1], (x, y) => (F(x, y) > 1.6 && F(x, y - 1) > 1.2 ? shade(FOAM, Math.sin(th) > 0 ? 2.6 : 3, x, y) : undefined))
        c.line(ax, ay - 1, p[0], p[1] - 1, (x, y) => (F(x, y) > 1.6 && Math.sin(th) > 0.2 && c.get(x, y) !== (FOAM[2] ?? 0) && c.get(x, y) !== (FOAM[3] ?? 0) ? FOAM[6] ?? 0 : undefined))
      }
      prev = p
    }
  }
  const p = peak(f)
  if (p > 0.5) {
    const base = PEAK.y + 1
    const top = base - p
    for (let y = Math.floor(top); y <= base; y++) {
      const v = (y - top) / Math.max(1, p)
      const half = 0.3 + v * v * 3.6
      for (let x = Math.round(PEAK.x - half); x <= Math.round(PEAK.x + half); x++) {
        const side = (x - PEAK.x) / Math.max(0.5, half)
        c.set(x, y, shade(FOAM, 4.4 + side * 1.4 - (side < -0.55 ? 0.9 : 0), x, y))
      }
    }
    const tipY = Math.floor(top)
    if (p > 4) {
      c.set(PEAK.x + 1, tipY, FOAM[4] ?? 0)
      c.set(PEAK.x + 1, tipY + 2, FOAM[6] ?? 0)
    }
  }
}
function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {

    const fg = new Canvas()
    fg.fill(-1)
    const w = whisk(f)
    drawFoam(fg, f)
    for (let y = RIM.y; y < H; y++) {
      const hw = RIM.rx * Math.sqrt(Math.max(0, 1 - ((y - RIM.y) / 17) ** 2))
      for (let x = Math.round(RIM.x - hw); x <= Math.round(RIM.x + hw); x++) {
        if (y <= rimAt(x, 1)) continue
        const nx = (x - RIM.x) / Math.max(1, hw)
        const ny = (y - RIM.y) / 12
        let level = 3.6 + nx * 2.2 - ny * 1.4
        if (Math.abs(nx - 0.55) < 0.09) level = 7.6 - ny * 1.2
        if (Math.abs(nx - 0.73) < 0.05) level = 6.4 - ny
        if (Math.abs(nx + 0.72) < 0.07) level += 1.1
        if (x === Math.round(RIM.x + hw)) level -= 1.4
        fg.set(x, y, shade(COPPER, level, x, y))
      }
    }
    for (let x = RIM.x - RIM.rx; x <= RIM.x + RIM.rx; x++) {
      const nx = (x - RIM.x) / RIM.rx
      const by = Math.round(rimAt(x, -1))
      for (let y = by + 1; y < Math.round(rimAt(x, 1)); y++) if (fg.get(x, y) === -1) fg.set(x, y, shade(COPPER, 2.2 - nx * 1.4, x, y))
      if (fg.get(x, by) === -1) fg.set(x, by, shade(COPPER, 4.4 - nx * 1.2, x, by))
      const fy = Math.round(rimAt(x, 1))
      fg.set(x, fy, shade(COPPER, 5.4 + nx * 1.4 + (Math.abs(nx - 0.55) < 0.07 ? 2.4 : 0), x, fy))
      fg.set(x, fy + 1, shade(COPPER, 3.4 + nx * 1.6, x, fy + 1))
    }
    for (const side of [-1, 1]) {
      const x = RIM.x + side * RIM.rx
      for (let y = RIM.y - 1; y <= RIM.y + 1; y++) fg.set(x, y, shade(COPPER, side > 0 ? 6 : 3.4, x, y))
    }
    const ax = w.tx - w.bx
    const ay = w.ty - w.by
    const len = Math.hypot(ax, ay)
    const ux = ax / len
    const uy = ay / len
    const L = 14
    const neck = [w.bx + ux * L, w.by + uy * L] as const
    const tops = Array.from({ length: W }, (_, x) => {
      for (let y = 0; y < H; y++) if (fg.get(x, y) !== -1) return y
      return H
    })
    const inFoam = (x: number, y: number) => lifted(f) < 0.5 && y > (tops[Math.round(x)] ?? H) + 0.5
    if (lifted(f) > 0.5) {
      const cx = w.bx + ux * 3.6
      const cy = w.by + uy * 3.6
      fg.ellipse(cx, cy, 2.6, 3.2, (x, y) => shade(FOAM, 4 + (x - cx) * 0.6 - (y - cy) * 0.35, x, y))
      fg.set(cx + 1, cy - 2, FOAM[6] ?? 0)
      fg.set(w.bx - 1, w.by + 1, FOAM[4] ?? 0)
      fg.set(w.bx, w.by + 2, FOAM[3] ?? 0)
    }
    for (let k = 0; k < 4; k++) {
      const phi = w.spin + (k * Math.PI) / 4
      const near = Math.sin(phi) >= 0
      let prev: [number, number] | undefined
      for (let s = 0; s <= 1.0001; s += 1 / 16) {
        const r = 4.6 * Math.sin(Math.PI * s) ** 0.7 * (0.75 + 0.25 * s)
        const across = Math.cos(phi) * r
        const x = w.bx + ux * s * L - uy * across
        const y = w.by + uy * s * L + ux * across
        if (prev) {
          fg.line(prev[0], prev[1], x, y, (px, py) => {
            if (inFoam(px, py)) return undefined
            if (!near && fg.get(px, py) !== -1 && fg.get(px, py) !== (STEEL[2] ?? 0)) return undefined
            return shade(STEEL, 3.1 + clamp(Math.sin(phi) * 3, -1, 1) * 0.9 + (across * uy < -0.5 ? 1 : 0), px, py)
          })
        }
        prev = [x, y]
      }
    }
    fg.line(neck[0], neck[1], w.tx, w.ty, (x, y) => shade(STEEL, 3.6, x, y))
    fg.line(neck[0] + 1, neck[1], w.tx + 1, w.ty, (x, y) => shade(STEEL, 2.2, x, y))
    if (speed(f) > 0.4) {
      const p = whisk(f - 1)
      const pn = [p.bx + ((p.tx - p.bx) / Math.hypot(p.tx - p.bx, p.ty - p.by)) * L, p.by + ((p.ty - p.by) / Math.hypot(p.tx - p.bx, p.ty - p.by)) * L]
      fg.line(pn[0] ?? 0, pn[1] ?? 0, p.tx, p.ty, (x, y) => (fg.get(x, y) === -1 ? undefined : mix(fg.get(x, y), STEEL[4] ?? 0, 0.3)))
    }
    const c = new Canvas()
    const sun = (x: number, y: number) => {
      const u = x + y * 0.55
      return y < COUNTER_Y && u >= -6 && u <= 26 && Math.abs(u - 10) > 0.9 && y !== 9
    }
    c.fill((x, y) => {
      if (y < COUNTER_Y) {
        const isLit = sun(x, y) && fg.get(x + 10, y - 2) === -1
        const edge = sun(x, y) && !sun(x - 1, y) ? -0.6 : 0
        return shade(WALL, isLit ? 6 + edge - y * 0.03 : 2.4 - y * 0.03 + (y >= COUNTER_Y - 1 ? -1 : 0), x, y)
      }
      const vein = Math.abs(((x * 0.7 + y * 1.6) % 19) - 9.5) < 0.45
      return shade(MARBLE, 3.6 + x * 0.015 - (y === COUNTER_Y ? 1 : 0) - (vein ? 1 : 0), x, y)
    })
    for (let y = COUNTER_Y + 1; y < H; y++) {
      for (let x = 0; x < 10; x++) c.set(x, y, mix(c.get(x, y), 0x4a4860, x > 5 - (y - COUNTER_Y) * 0.5 ? 0.42 : 0.2))
    }
    c.poly([[46, 15], [53, 16.5], [53, 25], [46, 24]], 0x6a2422)
    c.poly([[53, 16.5], [61, 15], [61, 24], [53, 25]], 0x8a302a)
    c.poly([[47, 15.5], [53, 17], [53, 24], [47, 23]], (x, y) => shade(MARBLE, 4.4 - (y - 15) * 0.06, x, y))
    c.poly([[53, 17], [60, 15.5], [60, 23], [53, 24]], (x, y) => shade(MARBLE, 3.4 + (x - 53) * 0.08, x, y))
    for (const row of [18, 20, 22]) {
      for (let x = 48; x <= 59; x++) {
        if (x === 52 || x === 53 || x === 54 || ((x * 7 + row) % 5 === 0)) continue
        const y = x < 53 ? row + (x - 47) * 0.2 : row + (60 - x) * 0.2
        c.set(x, y, shade(MARBLE, 2.2, x, y))
      }
    }
    c.line(53, 17, 53, 24, shade(MARBLE, 1.6))
    const shellPaint = { r: SHELL[4] ?? 0, i: SHELL[0] ?? 0, j: SHELL[2] ?? 0, o: SHELL[3] ?? 0, s: SHELL[1] ?? 0 }
    c.sprite(48, 26, ['.r.rr.r.', 'riiiijjr', 'soiijjor', '.ssooor.', '..ssoo..'], shellPaint)
    c.sprite(57, 27, ['r.rr.r', 'iiijjr', 'soooor', '.ssoo.'], shellPaint)
    for (const [sx, sy, n] of [[47, 31, 6], [56, 31, 5]] as const) for (let k = 0; k < n; k++) c.tint(sx + k, sy, 0x4a4860, 0.35)
    for (let i = 0; i < fg.px.length; i++) {
      const v = fg.px[i] ?? -1
      if (v !== -1) c.px[i] = v
    }
    for (const p of particles(f, LOOP, 34, 7, 5)) {
      const born = f - p.t
      if (speed(born) < 0.55) continue
      const b = whisk(born)
      const side = p.r[1] < 0.45 ? -1 : 1
      const x0 = b.bx + side * 3
      const y0 = 12
      const vx = side * (0.7 + p.r[2] * 1.5)
      const vy = -1.5 - p.r[3] * 1.6
      const x = x0 + vx * p.t
      const y = y0 + vy * p.t + 0.36 * p.t * p.t
      if (p.t > 2 && y > 13 + Math.abs(x - 27) * 0.3) continue
      c.set(x, y, FOAM[6] ?? 0)
      if (p.r[0] > 0.55 && p.t < 4) c.set(x - Math.sign(vx), y + 1, FOAM[4] ?? 0)
    }
    const t = g(f)
    if (t >= 33 && t <= 37) {
      const sx = PEAK.x + 2
      const sy = Math.round(PEAK.y + 1 - peak(f)) + 2
      const r = t === 34 || t === 35 ? 2 : 1
      c.set(sx, sy, 0xffffff)
      for (let k = 1; k <= r; k++) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.set(sx + dx * k, sy + dy * k, k === r ? (FOAM[4] ?? 0) : 0xffffff)
      }
    }
    out.push(c.copy())
  }
  return out
}
export const scene: Scene = { verb: 'Whisking', render, hero: 32 }