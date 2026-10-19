import { beat, clamp, ease, frames, hash, hex, lerp, mix, shade, smoothstep, type Canvas, type Scene } from '../engine'

const LOOP = 64
const W = 64
const H = 32

const SKY = hex('04040c 070818 0b0c24 111234 1a1846 26205a 362a6c 4a347c')
const FILL = hex('03040c 060818 0a0e22 0e142e 131a3a')
const GRID = hex('0c1e3a 113052 164a6e 1c6a8c 2894aa 48c0c8 8ae8e0 d8fff4')
const GOLD = hex('3a1e10 6a3414 a85a18 e08a22 f8b840 ffe08a fff8d8')
const PINK = hex('4a0c38 8a1458 d0287a ff5aa0 ffb0d2 fff0f8')
const WALL = hex('14163e 1e2256 2a3070 384290 5560b0 8a90d0')
const SETTLE = hex('48c0c8 4ca0c0 5180b8 5560b0')
const WARM_LOW = hex('1c6a8c 537e79 8a9166 c1a553 f8b840 ffe08a')
const WARM_HIGH = hex('2894aa 5c9d90 90a675 c4af5b f8b840 ffe08a')
const COOL = hex('1c6a8c 557c9e 8e8daf c69fc1 ffb0d2')

const along = (path: number[], t: number) => path[Math.round(clamp(t) * (path.length - 1))] ?? 0

const CAM_H = 7
const PITCH = 0.27
const FOCAL = 36
const CX = 32
const CY = 16
const COS = Math.cos(PITCH)
const SIN = Math.sin(PITCH)

function project(x: number, y: number, z: number): [number, number, number] {
  const ry = y - CAM_H
  const zc = z * COS - ry * SIN
  const yc = ry * COS + z * SIN
  return [CX + (x * FOCAL) / zc, CY - (yc * FOCAL) / zc, zc]
}
const HORIZON_Y = CY - FOCAL * Math.tan(PITCH)

const CITY_X = 0
const CITY_Z = 19
const flatten = (f: number) => ease.inOut(beat(f, 6, 15)) * (1 - ease.inOut(beat(f, 52, 61)))

function height(x: number, z: number, f: number): number {
  const t = ((f + 0.2) / LOOP) * Math.PI * 2
  const roll =
    1.3 * Math.sin(0.17 * x + 0.15 * z + t * 2) +
    0.8 * Math.sin(-0.13 * x + 0.21 * z + t * 3 + 1.3) +
    0.35 * Math.sin(0.31 * x - 0.08 * z - t + 2.1)
  const near = smoothstep(17, 9, Math.hypot(x - CITY_X, (z - CITY_Z) * 1.3))
  return roll * (1 - flatten(f) * near) * smoothstep(2, 12, z)
}

function pixelOf(x: number, z: number, f: number): [number, number] {
  const at = (g: number) => {
    const k = ((g % LOOP) + LOOP) % LOOP
    const [px, py] = project(x, height(x, z, k), z)
    return [Math.round(px), Math.round(py)] as const
  }
  const [was, now, next] = [at(f - 1), at(f), at(f + 1)]
  const settle = (i: 0 | 1) => (was[i] === next[i] && now[i] !== was[i] ? was[i] : now[i])
  return [settle(0), settle(1)]
}
const POINTS: [number, number][] = [[-11, 15], [-5, 20.5], [1, 17.5], [6, 22], [11, 19.5]]
const POP_AT = [13, 14.5, 16, 17.5, 19]
const DRAW_AT = 19
const SNAP_AT = 23
function catmull(t: number): [number, number] {
  const n = POINTS.length - 1
  const s = clamp(t) * n
  const i = Math.min(n - 1, Math.floor(s))
  const u = s - i
  const at = (k: number) => POINTS[Math.max(0, Math.min(n, k))] ?? [0, 0]
  const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
  const cr = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u)
  return [cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])]
}
function road(t: number, f: number): [number, number] {
  const [ax, az] = POINTS[0] ?? [0, 0]
  const [bx, bz] = POINTS[POINTS.length - 1] ?? [0, 0]
  const [sx, sz] = catmull(t)
  const k = ease.outElastic(beat(f, SNAP_AT, SNAP_AT + 9))
  return [lerp(lerp(ax, bx, t), sx, k), lerp(lerp(az, bz, t), sz, k)]
}
type Building = { x: number; z: number; w: number; d: number; h: number; along: number; seed: number }
const BUILDINGS: Building[] = (() => {
  const out: Building[] = []
  for (let gx = -9; gx <= 9; gx += 2) {
    for (let gz = 13; gz <= 25; gz += 2) {
      let best = 99
      let along = 0
      for (let s = 0; s <= 60; s++) {
        const [rx, rz] = catmull(s / 60)
        const d = Math.hypot(gx + 0.7 - rx, gz + 0.7 - rz)
        if (d < best) {
          best = d
          along = s / 60
        }
      }
      if (best < 1.5 || best > 4) continue
      const seed = Math.floor((gx + 20) * 31 + gz * 7)
      if (hash(seed, 1) < 0.3) continue
      const downtown = 1 - Math.min(1, Math.hypot(gx, (gz - 19) * 1.4) / 11)
      out.push({ x: gx, z: gz, w: 1.4, d: 1.4, h: 0.8 + downtown * (1.5 + hash(seed, 2) * 3), along, seed })
    }
  }
  return out.sort((a, b) => b.z - a.z || Math.abs(b.x) - Math.abs(a.x))
})()
const riseOf = (b: Building, f: number) =>
  ease.inOut(beat(f, 26 + b.along * 6, 33 + b.along * 6)) * (1 - ease.inOut(beat(f, 49 + b.along * 3, 56 + b.along * 3)))
const lightsOf = (b: Building, f: number) => beat(f, 31 + b.along * 7, 38 + b.along * 7) * (1 - beat(f, 47, 52))
const solidOf = (b: Building, f: number) => beat(f, 30 + b.along * 7, 36 + b.along * 7) * (1 - beat(f, 45 + b.along * 3, 51 + b.along * 3))
function cityGlow(x: number, z: number, f: number): number {
  const reach = beat(f, 29, 43) * 19.6
  const fade = 1 - beat(f, 48, 56)
  const d = Math.hypot(x - CITY_X, (z - CITY_Z) * 1.2)
  return Math.min(clamp((11 - d) / 3), clamp((reach - d) / 8.4)) * fade
}
const quarter = (t: number) => Math.round(clamp(t) * 4) / 4
const STARS: [number, number][] = [[4, 1], [11, 3], [19, 0], [27, 2], [38, 1], [45, 3], [53, 0], [60, 2], [33, 4], [7, 4]]
function poly(c: Canvas, pts: [number, number][], paint: number): void {
  c.poly(pts, paint)
}

function render(): Int32Array[] {
  const XS: number[] = []
  for (let x = -48; x <= 48; x += 4) XS.push(x)
  const ZS: number[] = []
  for (let z = 3; z <= 71; z += 4) ZS.push(z)

  return frames(LOOP, (c, f) => {
    c.fill((x, y) => shade(SKY, 1 + clamp((y + 3) / (HORIZON_Y + 4)) * 6.4, x, y))
    for (let x = 0; x < W; x++) c.set(x, Math.round(HORIZON_Y), mix(SKY[7] ?? 0, PINK[2] ?? 0, 0.35))
    for (const [k, [sx, sy]] of STARS.entries()) {
      if (sy < HORIZON_Y - 1) c.set(sx, sy, (f + k * 5) % 32 < 2 ? 0xc8d8ff : 0x5a6aa0)
    }
    const grid = XS.map(x => ZS.map(z => {
      const h = height(x, z, f)
      return { p: pixelOf(x, z, f), h, x, z }
    }))
    for (let j = ZS.length - 2; j >= 0; j--) {
      for (let i = 0; i + 1 < XS.length; i++) {
        const a = grid[i]?.[j]
        const b = grid[i + 1]?.[j]
        const cc = grid[i + 1]?.[j + 1]
        const d = grid[i]?.[j + 1]
        if (!a || !b || !cc || !d) continue
        const xs = [a.p[0], b.p[0], cc.p[0], d.p[0]]
        if (Math.max(...xs) < -2 || Math.min(...xs) > W + 2) continue
        const hMid = (a.h + b.h + cc.h + d.h) / 4
        const fog = clamp((a.z - 8) / 52)
        const slope = d.h - a.h
        poly(c, [[a.p[0], a.p[1]], [b.p[0], b.p[1]], [cc.p[0], cc.p[1]], [d.p[0], d.p[1]]],
          shade(FILL, 1.4 + hMid * 0.45 + slope * 0.5 + fog * 1.6, 0, 0))
        if (fog > 0.82) continue
        const wire = (p: typeof a, q: typeof a) => {
          const glow = cityGlow((p.x + q.x) / 2, (p.z + q.z) / 2, f)
          const level = 3.9 - fog * 3 + (p.h + q.h) * 0.45
          const warm = (level >= 3.5 ? WARM_HIGH : WARM_LOW).slice(0, fog > 0.25 ? 5 : 6)
          const color = glow > 0 ? along(warm, glow) : shade(GRID, level, 0, 0)
          const [s0, s1] = p.z < q.z || (p.z === q.z && p.x < q.x) ? [p, q] : [q, p]
          c.line(s0.p[0], s0.p[1], s1.p[0], s1.p[1], fog > 0.4 ? mix(color, FILL[3] ?? 0, quarter((fog - 0.4) * 2.4)) : color)
        }
        wire(a, b)
        wire(b, cc)
        wire(d, cc)
        wire(a, d)
      }
    }
    const fade = 1 - beat(f, 50, 58)
    const roadOn = ease.in(beat(f, DRAW_AT, SNAP_AT))
    if (roadOn > 0 && fade > 0) {
      const steps = 80
      let prev: [number, number] | undefined
      for (let s = 0; s <= steps * roadOn; s++) {
        const [rx, rz] = road(s / steps, f)
        const [px, py] = project(rx, 0.05, rz)
        if (prev) {
          const color = (f < SNAP_AT + 3 ? PINK[5] : PINK[4]) ?? 0
          c.line(prev[0], prev[1], px, py, fade < 1 ? along(COOL, fade) : color)
        }
        prev = [px, py]
      }
    }
    for (const [k, [px, pz]] of POINTS.entries()) {
      const at = POP_AT[k] ?? 0
      const grow = Math.ceil(beat(f, at, at + 3) * 3 - 1e-6)
      const shrink = Math.ceil((1 - beat(f, 50 + k, 54 + k)) * 3 - 1e-6)
      const stage = Math.min(grow, shrink)
      if (stage <= 0) continue
      const [sx, sy] = project(px, 0, pz)
      if (stage === 3) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) c.set(sx + dx, sy + dy, dx === 0 && dy === 0 ? PINK[1] ?? 0 : PINK[4] ?? 0)
        }
      } else {
        if (stage === 2) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) c.set(sx + dx, sy + dy, PINK[4] ?? 0)
        c.set(sx, sy, PINK[5] ?? 0)
      }
      const ring = f - at - 2
      if (ring >= 1 && ring < 3) {
        const rr = 1 + ring
        for (const [dx, dy] of [[-rr, 0], [rr, 0], [0, -rr], [0, rr]] as const) c.set(sx + dx, sy + dy * 0.6, PINK[3] ?? 0)
      }
    }
    const ground = c.copy()
    for (const b of BUILDINGS) {
      const rise = riseOf(b, f)
      if (rise <= 0.02) continue
      const top = b.h * rise
      const x0 = b.x
      const x1 = b.x + b.w
      const z0 = b.z
      const z1 = b.z + b.d
      const P = (x: number, y: number, z: number) => {
        const p = project(x, y, z)
        return [p[0], p[1]] as [number, number]
      }
      const lights = lightsOf(b, f)
      const solid = solidOf(b, f)
      const fill = top * solid
      const rim = mix(GRID[5] ?? 0, WALL[5] ?? 0, quarter(lights))
      const trim = along(SETTLE, lights)
      const corners = {
        a: P(x0, 0, z0), b: P(x1, 0, z0), c: P(x1, 0, z1), d: P(x0, 0, z1),
        A: P(x0, top, z0), B: P(x1, top, z0), C: P(x1, top, z1), D: P(x0, top, z1),
        As: P(x0, fill, z0), Bs: P(x1, fill, z0), Cs: P(x1, fill, z1), Ds: P(x0, fill, z1),
      }
      const edge = (from: keyof typeof corners, to: keyof typeof corners, color: number) =>
        c.line(corners[from][0], corners[from][1], corners[to][0], corners[to][1], color)
      if (solid < 1) {
        const isBare = solid <= 0
        for (const [p, q] of [['B', 'C'], ['C', 'D'], ['D', 'A']] as const) edge(p, q, trim)
        edge('A', 'B', rim)
        edge('A', isBare ? 'a' : 'As', trim)
        edge('B', isBare ? 'b' : 'Bs', trim)
        if (isBare) {
          edge('a', 'b', trim)
          continue
        }
      }
      const face = (k: number) => along([...SETTLE, ...WALL.slice(k, 4).reverse()], solid)
      const sideX = x0 > 0 ? x0 : x1
      poly(c, [P(sideX, 0, z0), P(sideX, 0, z1), P(sideX, fill, z1), P(sideX, fill, z0)], face(1))
      poly(c, [corners.a, corners.b, corners.Bs, corners.As], face(2))
      poly(c, [corners.As, corners.Bs, corners.Cs, corners.Ds], face(3))
      const [fx0, fy0] = corners.a
      const [fx1, fy1] = corners.Bs
      for (let py = Math.round(fy1) + 1; py < Math.round(fy0) - 1; py += 2) {
        for (let px = Math.round(fx0) + 1; px < Math.round(fx1); px += 2) {
          const h = hash(b.seed, px - Math.round(fx0), py - Math.round(fy0))
          if (h < lights * 0.8) c.set(px, py, h < 0.15 ? GOLD[6] ?? 0 : GOLD[4] ?? 0)
        }
      }
      edge('Ds', 'Cs', trim)
      edge(x0 > 0 ? 'As' : 'Bs', x0 > 0 ? 'Ds' : 'Cs', trim)
      edge('As', 'Bs', rim)
    }
    if (f >= 34 && f < 47) {
      const u = beat(f, 34, 45)
      for (const [k, back] of [[0, 0], [1, 0.035], [2, 0.07]] as const) {
        const [rx, rz] = road(Math.max(0, u - back), f)
        const [px, py] = project(rx, 0.05, rz)
        c.set(px, py, PINK[5 - k] ?? 0)
        if (k === 0) {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            if (c.get(px + dx, py + dy) === ground[Math.round(py + dy) * W + Math.round(px + dx)]) c.tint(px + dx, py + dy, PINK[4] ?? 0, 0.7)
          }
        }
      }
    }
  })
}
export const scene: Scene = { verb: 'Reticulating', render, hero: 44 }