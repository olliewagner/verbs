import { Canvas, beat, clamp, ease, hash, hex, lerp, mix, mod, shade, smoothstep, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72
const BURST = 58
const ASPECT = 1.45
const TILT = 0.62
const SA = Math.sin(TILT)
const CA = Math.cos(TILT)
const EDGE_Y = 8
const WALL_DEPTH = (H - 1 - EDGE_Y) * ASPECT
const WALL_ROW = 1 / CA

const WIN_X0 = 21
const WIN_X1 = 42
const WIN_BAR = 31.5
const WIN_Z0 = 2.6
const WIN_Z1 = 26
const WIN_RAILS = [WALL_ROW * (EDGE_Y - 2), 17] as const
const SUN_X = 27.5
const SUN_Z = 5.6
const SUN_R = 1.7

const WALL = hex('0e0b11 151018 1e1721 282029 352a33')
const SKY = hex('6f80a8 93a3c4 b4c0d8 d2d4de ecdccc f8dcb6 fde9cc')
const FRAME = hex('120c0e 21171a 352622 52402f 735a42 94785a')
const SLATE = hex('08090d 0e1016 14181f 1b2029 232a35 2d3542 3a4351 4b5463 5f687a')
const MERC = hex('06070b 101219 1b1f29 2a303d 3e4555 596173 7b8496 a2aab9 cad0da eef1f5')
const WARM = hex('c99a62 f0c98e fff1d6')
const GLASS = hex('0f1817 172422 22362f 345043 4f7461 7da38c c3dccb')

type Bead = { x: number; y: number; r: number; parent: number; t0: number; t1: number; out: number }
const BEADS: readonly Bead[] = [
  { x: 38, y: 21, r: 5, parent: -1, t0: 0, t1: 0, out: 0 },
  { x: 19, y: 18, r: 3.6, parent: 0, t0: 20, t1: 33, out: 10 },
  { x: 50, y: 25, r: 3.3, parent: 0, t0: 22, t1: 35, out: 11 },
  { x: 47, y: 13, r: 2.6, parent: 0, t0: 16, t1: 28, out: 9 },
  { x: 27, y: 28, r: 2.4, parent: 0, t0: 13, t1: 24, out: 8 },
  { x: 6, y: 13, r: 2.1, parent: 1, t0: 9, t1: 19, out: 13 },
  { x: 59, y: 29, r: 1.9, parent: 2, t0: 11, t1: 20, out: 13 },
  { x: 58, y: 11, r: 1.7, parent: 3, t0: 6, t1: 15, out: 12 },
  { x: 32, y: 12, r: 1.5, parent: 0, t0: 8, t1: 17, out: 9 },
  { x: 9, y: 28, r: 1.5, parent: 4, t0: 5, t1: 14, out: 13 },
]

type State = { x: number; y: number; rad: number; mass: number; a: number; wob: number; sx: number; sy: number; s: number }

const ring = (t: number) => (t < 0 || t > 26 ? 0 : Math.exp(-t / 5.5) * Math.sin(t * 0.9))

function statesAt(f: number): State[] {
  const out: State[] = []
  BEADS.forEach((b, i) => {
    const p = out[b.parent]
    let x = b.x
    let y = b.y
    let a = 0
    if (p) {
      if (f >= BURST) {
        const u = beat(f, BURST, BURST + b.out)
        const dx = b.x - p.x
        const dy = b.y - p.y
        const d = Math.hypot(dx, dy * ASPECT) || 1
        const k = Math.min(0.8, (p.rad * 0.6) / d)
        x = lerp(p.x + dx * k, b.x, ease.out(u))
        y = lerp(p.y + dy * k, b.y, ease.out(u))
        a = 1 - smoothstep(0, 0.3, u)
      } else if (f < b.t0) {
        const k = beat(f, b.t0 - 7, b.t0)
        x += ([0, 0.6, 0, -0.6][f % 4] ?? 0) * k
      } else if (f < b.t1) {
        const u = ease.in(beat(f, b.t0, b.t1))
        x = lerp(b.x, p.x, u)
        y = lerp(b.y, p.y, u)
      } else {
        x = p.x
        y = p.y
        a = smoothstep(b.t1 - 1, b.t1 + 4, f)
      }
    }
    out[i] = { x, y, rad: 0, mass: b.r * b.r, a, wob: 0, sx: 0, sy: 0, s: 0 }
  })
  for (let i = BEADS.length - 1; i >= 0; i--) {
    const s = out[i]
    const b = BEADS[i]
    if (!s || !b) continue
    s.rad = Math.sqrt(s.mass * (1 - s.a))
    const p = out[b.parent]
    if (p) p.mass += s.mass * s.a
  }
  BEADS.forEach((b, i) => {
    const s = out[i]
    if (!s) return
    let w = 0
    BEADS.forEach((c, j) => {
      if (c.parent === i) w += (((out[j]?.mass ?? 0) / Math.max(1, s.mass)) * 1.6 + 0.05) * ring(f - c.t1 - 1)
    })
    if (i === 0) w += 0.55 * ring(f - BURST)
    else w += 0.3 * ring(mod(f - BURST - 1 - b.out, LOOP))
    s.wob = clamp(w, -0.45, 0.45)
  })
  return out
}

function field(st: readonly State[], x: number, y: number): [number, number] {
  let F = 0
  let R = 0
  for (const s of st) {
    if (s.rad < 0.2) continue
    let dx = x - s.x
    let dy = (y - s.y) * ASPECT
    if (s.s > 0) {
      const along = dx * s.sx + dy * s.sy
      const across = -dx * s.sy + dy * s.sx
      const a = along / (1 + s.s)
      const c = across / (1 - s.s * 0.35)
      dx = a * s.sx - c * s.sy
      dy = a * s.sy + c * s.sx
    }
    dx /= 1 + s.wob
    dy /= 1 - s.wob * 0.8
    const d2 = dx * dx + dy * dy
    const cut = 1 / 6.25
    const k = (s.rad * s.rad) / Math.max(0.01, d2)
    const fi = Math.max(0, (k - cut) / (1 - cut))
    F += fi
    R += fi * s.rad
  }
  return [F, F > 0 ? R / F : 0]
}

function pool(x: number, y: number): number {
  const t = (y - EDGE_Y - 1) / (H - EDGE_Y - 2)
  const x0 = lerp(WIN_X0 + 1, WIN_X0 + 6, t)
  const x1 = lerp(WIN_X1 - 1, WIN_X1 + 16, t)
  if (x < x0 || x > x1) return 0
  if (Math.abs(x - lerp(WIN_BAR, WIN_BAR + 10, t)) < 0.5 + t * 0.6) return 0
  if (Math.abs(y - 16) < 0.6 + t * 0.4) return 0
  return 1
}

const roofAt = (x: number) => 3.6 + ([0, 1, 2, 1, 0.4, 0.4, 0.4, 3.2, 3.2, 0.4, 1, 2, 3, 2, 1, 0.2, 0.2, 2.4, 2.4, 1.2, 1.2, 1.2][x - WIN_X0] ?? 0) * 0.7

const skyAt = (z: number, glow: number) => shade(SKY, 6.4 - (z - WIN_Z0) * 0.2 + glow, 0, 0)

function mirror(px: number, py: number, pz: number, nx: number, ny: number, nz: number, glow: number): number {
  const dn = ny * CA - nz * SA
  const rx = -2 * dn * nx
  const ry = CA - 2 * dn * ny
  const rz = -SA - 2 * dn * nz
  if (rz < -0.02) {
    const t = -pz / rz
    const hx = px + rx * t
    const hy = H - 1 - (py + ry * t) / ASPECT
    const far = clamp((WALL_DEPTH - (py + ry * t)) / WALL_DEPTH)
    return shade(MERC, 2.3 + pool(hx, hy) * 1.8 + (1 - far) * 1.2, 0, 0)
  }
  if (ry > 0.05) {
    const t = (WALL_DEPTH - py) / ry
    const hx = WIN_BAR + (px + rx * t - WIN_BAR) * 0.75
    const hz = pz + rz * t
    if (hz < 0.6) return shade(MERC, 5.2, 0, 0)
    if (hx > WIN_X0 && hx < WIN_X1 && hz > WIN_Z0 && hz < WIN_Z1) {
      if (Math.hypot(hx - SUN_X, hz - SUN_Z) < SUN_R + 0.4) return 0xfffbf0
      if (hx < WIN_X0 + 1 || hx > WIN_X1 - 1 || hz < WIN_Z0 + 0.8) return shade(MERC, 3, 0, 0)
      return mix(skyAt(hz, glow), MERC[9] ?? 0, 0.55)
    }
    return shade(MERC, hz > WIN_Z1 + 6 ? 3.4 : 4.2, 0, 0)
  }
  const az = Math.atan2(rx, -ry)
  const el = Math.asin(clamp(rz, -1, 1))
  const lamp = Math.hypot(az - 0.5, el - 0.35)
  if (lamp < 0.14) return lamp < 0.07 ? WARM[2] ?? 0 : WARM[1] ?? 0
  return shade(MERC, el > 0.9 ? 3.6 : 5.6 - el * 1.2, 0, 0)
}
const RIM_PALETTE = [...MERC, ...WARM]
function nearest(color: number): number {
  let best = color
  let bestD = Infinity
  for (const p of RIM_PALETTE) {
    const d = Math.abs(((p >> 16) & 255) - ((color >> 16) & 255)) + Math.abs(((p >> 8) & 255) - ((color >> 8) & 255)) + Math.abs((p & 255) - (color & 255))
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  return best
}
function height(st: readonly State[], x: number, y: number, ripple: number, cx: number, cy: number, f: number): number {
  const [F, R] = field(st, x, y)
  if (F <= 1) return 0
  const h = (1 - 1 / F) ** lerp(0.9, 0.4, smoothstep(2.5, 7, R)) * R * 0.9
  const d = Math.hypot(x - cx, (y - cy) * ASPECT)
  return h + ripple * Math.sin(d * 1.15 - f * 1.1) * smoothstep(0, 3, d)
}
const FLASK = [
  '  ccc  ',
  '  gGg  ',
  '  gGg  ',
  '  gGg  ',
  ' ggGgg ',
  ' gGggg ',
  'gGggggg',
  'gGgggmg',
  'ggggggg',
]
function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const st = statesAt(f)
    const prev = statesAt(mod(f - 1, LOOP))
    st.forEach((s, i) => {
      const p = prev[i]
      if (!p) return
      const vx = s.x - p.x
      const vy = (s.y - p.y) * ASPECT
      const v = Math.hypot(vx, vy)
      if (v > 0.2 && v < 20) {
        s.sx = vx / v
        s.sy = vy / v
        s.s = Math.min(0.4, v * 0.12)
      }
    })
    const core = st[0] ?? { x: 38, y: 21 }
    let ripple = 0
    BEADS.forEach(b => {
      if (b.parent >= 0 && f > b.t1 && f < BURST) ripple += Math.exp(-(f - b.t1 - 1) / 4) * 0.3
    })
    ripple += f >= BURST ? 0.5 * Math.exp(-(f - BURST) / 4) : 0
    ripple = Math.min(0.6, ripple)
    const glow = 0.8 * smoothstep(38, 46, f) * (1 - smoothstep(54, 62, f))
    const hop = f === BURST || f === BURST + 1 ? 1 : 0
    const c = new Canvas()
    const vignette = (x: number, y: number) => (((x - 32) / 40) ** 2 + ((y - 14) / 26) ** 2) * 1.4
    for (let y = 0; y < EDGE_Y; y++) {
      for (let x = 0; x < W; x++) {
        const z = (EDGE_Y - y) * WALL_ROW
        const isWindow = x >= WIN_X0 && x <= WIN_X1 && z > WIN_Z0
        if (!isWindow) {
          const near = Math.max(0, 1 - Math.hypot(x - 31, y - 2) / 30)
          c.set(x, y, shade(WALL, 1.2 + near * 2.6 - vignette(x, y) * 0.8 - (y === EDGE_Y - 1 ? 0.8 : 0), x, y))
          continue
        }
        const isBar = x === WIN_X0 || x === WIN_X1 || Math.abs(x - WIN_BAR) < 1 || WIN_RAILS.some(r => Math.abs(z - r) < 0.6)
        const isRoof = z < roofAt(x)
        if (Math.hypot(x - SUN_X, z - SUN_Z) < SUN_R && !isRoof) {
          c.set(x, y, mix(SKY[6] ?? 0, 0xfffbf0, 0.4 + glow * 0.6))
          continue
        }
        c.set(x, y, isBar ? shade(FRAME, x === WIN_X0 || x === Math.floor(WIN_BAR) ? 2 : 1, x, y) : isRoof ? mix(SKY[0] ?? 0, WALL[2] ?? 0, 0.45 - glow * 0.2) : skyAt(z, glow - 1.5))
      }
    }
    for (let x = WIN_X0 - 1; x <= WIN_X1 + 1; x++) {
      c.set(x, EDGE_Y - 2, shade(FRAME, x === WIN_X0 - 1 || x === WIN_X1 + 1 ? 3 : 4.4 + glow, x, EDGE_Y - 2))
    }
    for (let x = 0; x < W; x++) {
      const lit = x > WIN_X0 - 4 && x < WIN_X1 + 4 ? 1.6 + glow : 0
      c.set(x, EDGE_Y, shade(SLATE, 3.6 + lit - vignette(x, EDGE_Y) * 0.7, x, EDGE_Y))
    }
    for (let y = EDGE_Y + 1; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const grain = hash(Math.floor(x / 6 + hash(y) * 5), y, 3) < 0.16 ? -0.6 : 0
        const lit = pool(x, y) * (1.8 + glow)
        const [sf] = field(st, x - 0.5, y - 1.4)
        const shadow = sf > 0.8 ? -lit - 1 : sf > 0.5 ? -0.5 - lit * 0.6 : 0
        const sheen = y < EDGE_Y + 4 ? (EDGE_Y + 4 - y) * 0.2 : 0
        c.set(x, y, shade(SLATE, 2.2 + lit + sheen + grain + shadow - vignette(x, y), x, y))
      }
    }
    c.sprite(53, 1 - hop, FLASK, {
      c: FRAME[3] ?? 0,
      g: (x, y) => shade(GLASS, 2 + (x < 56 ? 0.8 : 0), x, y),
      G: (x, y) => shade(GLASS, 5 + glow, x, y),
      m: MERC[7] ?? 0,
    })
    const zAt = (x: number, y: number) => height(st, x, y, ripple, core.x, core.y, f)
    for (let y = EDGE_Y + 1; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const [F, R] = field(st, x, y)
        if (F < 1) continue
        const gx = zAt(x + 0.5, y) - zAt(x - 0.5, y)
        const gy = (zAt(x, y + 0.5) - zAt(x, y - 0.5)) / ASPECT
        let nx = -gx
        let ny = gy
        if (F < 1.2 && R > 1) {
          const k = Math.hypot(nx, ny) || 1
          const t = smoothstep(1.2, 1, F)
          nx = lerp(nx, (nx / k) * 3, t)
          ny = lerp(ny, (ny / k) * 3, t)
        }
        const n = Math.hypot(nx, ny, 1)
        const color = mirror(x, (H - 1 - y) * ASPECT, zAt(x, y), nx / n, ny / n, 1 / n, glow)
        const isRim = F < 1.12 || field(st, x, y + 1)[0] < 1 || field(st, x, y - 1)[0] < 1
        const isNear = field(st, x, y + 1)[0] < 1 || (isRim && ny < -0.3)
        const isFar = field(st, x, y - 1)[0] < 1
        c.set(x, y, isRim && isNear ? nearest(mix(color, MERC[7] ?? 0, 0.55)) : isRim && isFar ? nearest(mix(color, MERC[1] ?? 0, 0.5)) : color)
      }
    }
    out.push(c.px)
  }
  return out
}

export const scene: Scene = {
  verb: 'Coalescing',
  render,
  hero: 46,
  snaps: [
    { frames: BURST + 1, box: [38, 16, 42, 18], colors: [0xf5ede3, MERC[5] ?? 0], why: 'the thumped blob slaps flat as it bursts, smearing the window it held' },
  ],
}