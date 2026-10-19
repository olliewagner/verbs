import { Canvas, TAU, clamp, hash, hex, mod, particles, shade, smoothstep, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 48

const SKY = hex('7aaee2 92c0ea abd2f0 c8e2f4 e4f1f7')
const CLOUD = hex('9fb4d8 c3d2ea e2eaf4 fbfcfd')
const FAR = hex('7fae9e 92bfa6 a7cdb0')
const GRASS = hex('17402a 22592e 307333 448e38 5ea83f 80c04a a8d660 cfe88a')
const WOOL = hex('4f4a6e 7a74a0 a9a2c2 d4cdd8 f0e9e2 fffcf3')
const FACE = hex('140f16 261d24 3b2f33 574746')
const BARK = hex('2a1c22 412b2c 5c3d36')
const BLOSSOM = hex('a45a7c c97f9b e6a8bc f6d0da fff1f2')
const PINK = 0xe6909e
const YELLOW = 0xf6d24a
const WHITE = 0xfffdf4

const GROUND = 24
const CX = 26

type Pose = { x: number; foot: number; lift: number; crouch: number; phi: number; tailUp: boolean; perk: number }

type Hop = { at: number; len: number; quarters: number; h: number }

function lamb(f: number, offset: number, a0: number, hops: readonly Hop[]): Pose {
  const t = mod(f - offset, LOOP)
  const k = Math.max(0, hops.findIndex(hp => t < hp.at + hp.len))
  const hop = hops[k] ?? { at: 0, len: 12, quarters: 1, h: 5 }
  const p = t - hop.at
  const before = hops.slice(0, k).reduce((n, hp) => n + hp.quarters, 0)
  const n = hop.len - 3
  const air = p >= 2 && p < hop.len - 1 ? p - 2 : -1
  const lift = air >= 0 ? hop.h * Math.sin((Math.PI * (air + 1)) / (n + 1)) ** 1.6 : 0
  const a = a0 + (before + hop.quarters * clamp((p - 1) / (hop.len - 1.5))) * (TAU / 4)
  const crouch = p === hop.len - 1 ? 0.5 : p <= 1 ? 1 : 0
  return {
    x: CX + Math.cos(a) * 10.5,
    foot: GROUND + Math.sin(a) * 2.5,
    lift,
    crouch,
    phi: clamp(-Math.sin(a) * 2.6, -1, 1),
    tailUp: air > n / 2,
    perk: p === 1 ? 1 : 0,
  }
}
const A_HOPS: readonly Hop[] = [
  { at: 0, len: 12, quarters: 1, h: 5 },
  { at: 12, len: 12, quarters: 1, h: 5 },
  { at: 24, len: 24, quarters: 2, h: 13 },
]
const B_HOPS: readonly Hop[] = [
  { at: 0, len: 12, quarters: 1, h: 5 },
  { at: 12, len: 12, quarters: 1, h: 5 },
  { at: 24, len: 12, quarters: 1, h: 7 },
  { at: 36, len: 12, quarters: 1, h: 5 },
]
const A_OFFSET = -6
const LAND = 41
function drawLamb(c: Canvas, pose: Pose, isBlackFaced: boolean): void {
  const fx = Math.round(pose.x)
  const fy = Math.round(pose.foot - pose.lift)
  const legLen = pose.crouch >= 1 ? 2 : 3
  const bottom = fy - legLen
  const rx = 3.8 + pose.crouch * 0.6
  const ry = 2.2 - pose.crouch * 0.4
  const cy = bottom - ry + 0.4
  const dir = pose.phi === 0 ? 1 : Math.sign(pose.phi)
  const spread = Math.max(Math.abs(pose.phi), 0.45) * dir
  const legs: [number, boolean][] = [[1.6, false], [-1.5, false], [2.7, true], [-2.6, true]]
  for (const [lx, isNear] of legs) {
    const x = fx + Math.round(lx * spread)
    for (let y = bottom; y <= fy; y++) {
      const isHoof = y === fy
      const color = isBlackFaced
        ? FACE[isNear ? 1 : 0] ?? 0
        : isHoof ? FACE[1] ?? 0 : WOOL[isNear ? 3 : 2] ?? 0
      c.set(x, y, color)
    }
  }
  const tx = fx - Math.round(dir * (rx + 0.6))
  c.set(tx, cy - 1 + (pose.tailUp ? -1 : 0), WOOL[3] ?? 0)
  if (!pose.tailUp && Math.abs(pose.phi) > 0.5) c.set(tx, cy, WOOL[2] ?? 0)

  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(fx - rx - 1); x <= Math.ceil(fx + rx + 1); x++) {
      const dx = (x - fx) / rx
      const dy = (y - cy) / ry
      const bump = 0.16 * Math.sin(Math.atan2(dy, dx) * 7 + (isBlackFaced ? 0 : 1.3))
      if (dx * dx + dy * dy > 1 + bump) continue
      const lit = -dx * 0.55 - dy * 0.85
      c.set(x, y, shade(WOOL, 3.3 + lit * 1.6 + (y >= bottom ? -1 : 0), x, y))
    }
  }
  const front = Math.abs(pose.phi) < 0.4
  const hx = fx + Math.round(pose.phi * (rx + 0.2))
  const hy = Math.round(cy - 0.4 - Math.min(1, Math.abs(pose.phi) / 0.8) * 1.2) - pose.perk
  const skin = (x: number, y: number) => {
    const lit = (x < hx ? 1 : 0) + (y < hy ? 1 : 0)
    return isBlackFaced ? FACE[1 + lit] ?? 0 : WOOL[3 + lit] ?? 0
  }
  for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [0, 1]] as const) {
    c.set(hx + dx, hy + dy, skin(hx + dx, hy + dy))
  }
  if (front) {
    c.set(hx - 2, hy - 1, isBlackFaced ? FACE[1] ?? 0 : PINK)
    c.set(hx + 2, hy - 1, isBlackFaced ? FACE[1] ?? 0 : PINK)
    if (!isBlackFaced) c.set(hx, hy + 1, PINK)
  } else {
    c.set(hx + dir * 2, hy, skin(hx + dir * 2, hy))
    c.set(hx - dir * 2, hy - 1, isBlackFaced ? FACE[0] ?? 0 : PINK)
    if (!isBlackFaced) {
      c.set(hx + dir, hy - 1, FACE[0] ?? 0)
      c.set(hx + dir * 2, hy, PINK)
    }
  }
}
const look = (f: number) => smoothstep(28, 33, f) * (1 - smoothstep(40, 47, f))
function drawEwe(c: Canvas, f: number): void {
  const fx = 51
  const fy = 22
  const bottom = fy - 2
  for (const [lx, isNear] of [[-4, true], [-3, false], [3, true], [4, false]] as const) {
    for (let y = bottom; y <= fy; y++) c.set(fx + lx, y, FACE[isNear ? 1 : 0] ?? 0)
  }
  const rx = 6.4
  const ry = 3.4
  const cy = bottom - ry + 0.5
  const chew = look(f) < 0.1 && Math.floor(f / 3) % 2 === 0 ? 1 : 0
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(fx - rx - 1); x <= Math.ceil(fx + rx + 1); x++) {
      const dx = (x - fx) / rx
      const dy = (y - cy) / ry
      const bump = 0.12 * Math.sin(Math.atan2(dy, dx) * 9 + 0.5)
      if (dx * dx + dy * dy > 1 + bump) continue
      const lit = -dx * 0.55 - dy * 0.85
      c.set(x, y, shade(WOOL, 2.9 + lit * 1.5, x, y))
    }
  }
  c.set(fx + rx + 1, cy - 1, WOOL[3] ?? 0)
  const up = look(f)
  const hx = Math.round(fx - rx - 1.5 - up * 0.5)
  const hy = Math.round(fy - 1 + chew - up * 6)
  const nx = Math.round(fx - rx + 1.5)
  const ny = Math.round(cy - 0.5)
  c.line(nx, ny, hx + 1, hy - 1, WOOL[3] ?? 0)
  c.line(nx, ny + 1, hx + 1, hy, WOOL[2] ?? 0)
  for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0], [1, 0], [-2, 0], [-1, 1], [0, 1]] as const) {
    c.set(hx + dx, hy + dy, FACE[dy < 0 || dx < -1 ? 2 : 1] ?? 0)
  }
  c.set(hx + 1, hy - 1, FACE[0] ?? 0)
  c.set(hx + 2, hy - 1 + (up > 0.5 ? 0 : 1), FACE[0] ?? 0)
  if (up < 0.5) c.set(hx - 2, hy + 1, GRASS[5] ?? 0)
}
const hillFar = (x: number) => 11 + 1.8 * Math.sin(x * 0.085 + 1) + Math.sin(x * 0.21 + 2) * 0.8
const hillNear = (x: number) => 15 + 1.6 * Math.sin(x * 0.06 + 3.2) + Math.sin(x * 0.17) * 0.6
type Daisy = { x: number; y: number }
const DAISIES: Daisy[] = Array.from({ length: 70 }, (_, i) => {
  const y = 17 + hash(i, 2) ** 0.75 * 14
  return { x: Math.floor(hash(i, 1) * W), y: Math.floor(y) }
})
function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()

    c.fill((x, y) => shade(SKY, 0.4 + (y / 14) * 4, x, y))
    for (const [ox, oy, s] of [[30, 4, 1], [52, 2, 0.8]] as const) {
      const lumps: [number, number, number][] = [[0, 1, 3], [4, 0, 3.4], [8, 1.5, 2.6], [-3.5, 2, 2]]
      for (const [lx, ly, r] of lumps) {
        c.disc(ox + lx * s, oy + ly, r * s, (x, y) => {
          const lit = (oy + ly - y) / (r * s) + (ox - x) * 0.05
          return y >= oy + 2.5 ? CLOUD[1] ?? 0 : shade(CLOUD, 2 + lit * 1.4, x, y)
        })
      }
    }
    for (let x = 0; x < W; x++) {
      for (let y = Math.round(hillFar(x)); y < H; y++) c.set(x, y, shade(FAR, 2 - (y - hillFar(x)) * 0.5, x, y))
      const top = Math.round(hillNear(x))
      for (let y = top; y < H; y++) {
        const depth = (y - top) / (H - top)
        const lit = 0.6 * Math.sin(x * 0.06 + 3.2 + 1.2)
        c.set(x, y, shade(GRASS, 6.3 - depth * 2.4 - (y - 15) * 0.07 + (y < top + 2 ? lit : 0), x, y))
      }
      const bush = hash(Math.floor(x / 3), 9) > 0.35
      if (bush) {
        c.set(x, top - 1, GRASS[2] ?? 0)
        if (x % 3 !== 2) c.set(x, top - 2, GRASS[3] ?? 0)
      }
    }
    for (let y = 6; y <= 18; y++) {
      c.set(5, y, BARK[1] ?? 0)
      c.set(6, y, BARK[y < 10 ? 2 : 0] ?? 0)
    }
    c.line(6, 10, 10, 6, BARK[1] ?? 0)
    c.line(5, 11, 2, 8, BARK[0] ?? 0)
    for (const [bx, by, r] of [[3, 4, 4.2], [9, 3, 4.6], [12, 7, 3.2], [1, 8, 3], [6, 0, 4]] as const) {
      c.disc(bx, by, r, (x, y) => {
        const lit = (bx - x) * 0.25 + (by - y) * 0.35 + (hash(x >> 1, y >> 1, 4) > 0.7 ? 0.8 : 0)
        return shade(BLOSSOM, 2.3 + lit, x, y)
      })
    }
    for (const pt of particles(f, LOOP, 9, 30, 4)) {
      const x = 6 + pt.r[1] * 8 + pt.t * (0.5 + pt.r[2] * 0.3) + Math.round(Math.sin(pt.t * 0.35 + pt.r[3] * 6))
      const y = 6 + pt.r[3] * 5 + pt.t * 0.38
      c.set(Math.round(x), Math.round(y), (pt.i & 1) === 0 ? BLOSSOM[4] ?? 0 : BLOSSOM[3] ?? 0)
    }
    for (const d of DAISIES) {
      if (d.y < Math.round(hillNear(d.x)) + 1) continue
      if (d.y >= 27 && d.x % 3 === 0) {
        for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) c.set(d.x + dx, d.y + dy, WHITE)
        c.set(d.x, d.y, YELLOW)
      } else if (d.y >= 27) {
        c.set(d.x, d.y, WHITE)
      } else if (d.y >= 22) {
        c.set(d.x, d.y, WHITE)
        c.set(d.x + 1, d.y, WHITE)
      } else {
        c.set(d.x, d.y, CLOUD[3] ?? 0)
      }
    }
    const a = lamb(f, A_OFFSET, -TAU / 8, A_HOPS)
    const b = lamb(f, 0, (TAU * 5) / 8, B_HOPS)
    for (const pose of [a, b]) {
      const r = Math.max(1.5, 4.6 - pose.lift * 0.25)
      c.ellipse(Math.round(pose.x) + 1, Math.round(pose.foot) + 0.6, r, 0.9, (x, y) => shade(GRASS, 2.2, x, y))
    }
    c.ellipse(52, 22.6, 7.5, 1.1, (x, y) => shade(GRASS, 2.6, x, y))
    const actors: [number, () => void][] = [
      [22, () => drawEwe(c, f)],
      [a.foot, () => drawLamb(c, a, true)],
      [b.foot, () => drawLamb(c, b, false)],
    ]
    actors.sort((p, q) => p[0] - q[0]).forEach(([, draw]) => draw())
    if (f >= LAND && f <= LAND + 5) {
      const t = f - LAND + 1
      for (const [vx, vy] of [[-1.1, -1.3], [-0.6, -1.8], [0.7, -1.6], [1.2, -1.1], [0.1, -2]] as const) {
        const x = Math.round(a.x + vx * t * 1.2)
        const y = Math.round(a.foot + vy * t + 0.35 * t * t)
        c.set(x, y, t < 4 ? WHITE : CLOUD[2] ?? 0)
      }
    }
    const bx = Math.round(42 + 9 * wave(f, LOOP, 1))
    const by = Math.round(11 + 3 * wave(f, LOOP, 2, 0.25))
    const isOpen = f % 4 < 2
    c.set(bx, by, FACE[1] ?? 0)
    c.set(bx - 1, by - (isOpen ? 1 : 0), YELLOW)
    c.set(bx + 1, by - (isOpen ? 1 : 0), YELLOW)
    if (isOpen) {
      c.set(bx - 1, by, 0xe0a930)
      c.set(bx + 1, by, 0xe0a930)
    }
    for (let x = 0; x < W; x += 2) {
      const h = 2 + Math.floor(hash(x, 5) * 3)
      const lean = Math.round(wave(f, LOOP, 2, x * 0.05) * 0.6 + (hash(x, 6) - 0.5))
      for (let k = 0; k < h; k++) c.set(x + (k === h - 1 ? lean : 0), H - 1 - k, GRASS[k === h - 1 ? 4 : 1] ?? 0)
    }
    out.push(c.px)
  }
  return out
}
export const scene: Scene = { verb: 'Frolicking', render, hero: 30 }
