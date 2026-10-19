import { Canvas, TAU, beat, clamp, ease, frames, hex, mod, particles, shade, smoothstep, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 64

const WALL = hex('08070f 0d0b19 131024 1a1532 231b43 2e2356')
const TABLE = hex('07050c 0e0a17 160f24 201632 2d1f45 46306a 7a5aa8')
const FLOOR = hex('060409 0c0814 140e22 1d1530')
const BOWL = hex('0a0813 120f22 1b1733 26204a 342c63 4c4290 8a7ad0 c9bcf2')
const FOG = hex('241c48 33295f 463b80 5c529e 776dba 958cd2 b6afe6 d9d5f5 f6f4ff')
const IRIS = hex('e6dcff f2a6e6 e6dcff a8e4ff')

const TABLE_Y = 20
const LIP_Y = 25
const EDGE_X = 50
const FLOOR_Y = 29
const BOWL_X = 21
const RIM_Y = 14
const RIM_HW = 10
const B0 = 4
const POP = 26

const glow = (x: number, y: number) =>
  Math.max(clamp(1 - Math.hypot((x - 18) / 46, (y - 4) / 30)), clamp(1.15 - Math.hypot((x - LAMP_X) / 20, (y - 6) / 14)))
const LAMP_X = 6
const BULB = hex('b98cf0 e6d2ff ffffff')
const LAMP_GLOW = hex('2a1c4e 3a2768')

function bowlHalf(y: number): number {
  if (y >= RIM_Y && y <= 21) return RIM_HW * Math.sqrt(Math.max(0, 1 - ((y - RIM_Y) / 8.2) ** 2))
  if (y === 22) return 3.5
  if (y === 23) return 4.5
  return -1
}

type Way = readonly [x: number, y: number, t: number, r: number, flat: number, depth: number]

const RIGHT: readonly Way[] = [
  [24, 12.5, 0, 1.6, 1.2, 0], [29, 11.6, 4, 2.2, 1.2, 0], [32.6, 13, 9, 2.4, 1.1, 0], [34, 16.6, 13, 2.4, 1.1, 0.3],
  [35, 21, 17, 2.7, 1.4, 1], [41, 22, 23, 2.9, 1.5, 1], [47.5, 22.3, 29, 3, 1.5, 1], [51.2, 23.8, 33, 2.7, 1.1, 0.4],
  [52.4, 27, 37, 2.5, 0.75, 0.2], [53.8, 30.4, 41, 2.8, 1, 0.3], [60, 31.2, 50, 3.4, 1.4, 0.4], [68, 31.6, 58, 3.6, 1.4, 0.4],
]
const LEFT: readonly Way[] = [
  [18, 12.5, 0, 1.6, 1.2, 0], [13, 11.6, 4, 2.2, 1.2, 0], [9.4, 13, 9, 2.4, 1.1, 0], [8, 16.6, 13, 2.4, 1.1, 0.3],
  [7, 21, 17, 2.7, 1.4, 1], [2, 22, 24, 2.9, 1.5, 1], [-6, 22.3, 32, 3, 1.5, 1],
]
const DRAPE: readonly Way[] = [
  [0, 20.6, 0, 2.2, 1.4, 0], [2, 23, 5, 2.4, 1.4, 0], [3, 25.3, 10, 2.1, 1.1, 0],
  [3.4, 27.6, 15, 1.9, 0.8, 0], [3.7, 30, 21, 1.5, 0.7, 0], [4, 32.6, 26, 1, 0.7, 0],
]
const catmull = (a: number, b: number, c: number, d: number, u: number) =>
  0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (3 * b - a - 3 * c + d) * u * u * u)

function along(path: readonly Way[], t: number): number[] | undefined {
  const n = path.length
  if (t < 0 || t >= path[n - 1]![2]) return undefined
  let i = 0
  while (t >= path[i + 1]![2]) i++
  const a = path[Math.max(0, i - 1)]!
  const b = path[i]!
  const c = path[i + 1]!
  const d = path[Math.min(n - 1, i + 2)]!
  const u = (t - b[2]) / (c[2] - b[2])

  return [0, 1, 3, 4, 5].map(k => catmull(a[k]!, b[k]!, c[k]!, d[k]!, u))
}

function flow(b: number): number {
  const held = smoothstep(B0, B0 + 8, b) * (1 - smoothstep(POP - 1, POP + 1, b))
  return 1 - 0.5 * held + 1.3 * surge(b)
}
const surge = (b: number) => smoothstep(POP - 5, POP, b) * (1 - smoothstep(POP + 6, POP + 14, b))

function bubble(f: number): [number, number] | undefined {
  if (f < B0 || f > POP) return undefined
  const r = 1.5 + 8.6 * ease.inOut(beat(f, B0, POP - 3))
  const wobble = 0.07 * Math.sin((f - B0) * 0.95) * (1 - beat(f, POP - 4, POP))
  const stretch = beat(f, POP - 3, POP)
  return [r * (1 + wobble - 0.05 * stretch), r * (1.02 - wobble + 0.12 * stretch)]
}
const BUBBLE_Y = 13.5
const R_MAX = 10.1

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const back = new Float32Array(W * H)
    const front = new Float32Array(W * H)
    const splat = (x: number, y: number, r: number, a: number, flat: number) => {
      if (a <= 0.01 || r <= 0.3) return
      const layer = Math.abs(x - BOWL_X) < RIM_HW - 1 && y < RIM_Y ? back : front
      for (let j = Math.floor(y - r / flat); j <= Math.ceil(y + r / flat); j++) {
        if (j < 0 || j >= H) continue
        for (let i = Math.floor(x - r); i <= Math.ceil(x + r); i++) {
          if (i < 0 || i >= W) continue
          const d2 = ((i - x) ** 2 + ((j - y) * flat) ** 2) / (r * r)
          if (d2 < 1) layer[j * W + i] = (layer[j * W + i] ?? 0) + a * (1 - d2) ** 2
        }
      }
    }
    const stream = (path: readonly Way[], count: number, seed: number, strength: number, delay: number, place: (x: number, r: readonly number[]) => number) => {
      const end = path[path.length - 1]![2]
      for (const p of particles(f, LOOP, count, end + 2, seed)) {
        const t = p.t * (0.9 + p.r[1] * 0.2)
        const at = along(path, t)
        if (!at) continue
        const [px = 0, py = 0, pr = 1, flat = 1, depth = 0] = at
        const born = mod(f - p.t - delay, LOOP)
        const x = place(px, p.r) + (p.r[2] - 0.5) * 2.2 * depth + Math.sin(t * 0.35 + p.r[0] * 6) * 0.45
        const y = py + (p.r[3] - 0.5) * 3.4 * depth
        const a = strength * flow(born) * smoothstep(0, 3, t) * (1 - smoothstep(end - 9, end, t)) * (1 - 0.4 * t / end)
        splat(x, y, pr * (0.75 + 0.75 * p.r[3]) * (1 + 0.45 * surge(born)), a * (0.8 + 0.4 * p.r[0]), flat)
      }
    }
    stream(RIGHT, 64, 1, 1, 0, x => x)
    stream(LEFT, 24, 2, 0.6, 0, x => x)
    stream(DRAPE, 14, 3, 0.8, 17, (x, r) => x + 34 + (r[0] ?? 0) * 12)
    stream(DRAPE, 8, 4, 0.8, 17, (x, r) => 9 - x - (r[0] ?? 0) * 6)

    for (const p of particles(f, LOOP, 30, 22, 6)) {
      const off = p.r[0] - 0.5
      const x = BOWL_X + off * 16 + Math.sin(p.t * 0.3 + p.r[1] * 6) * 0.6
      const y = 13.2 - (2.5 + 3.5 * (1 - Math.abs(off) * 2)) * ease.out(p.age) + p.r[2]
      splat(x, y, 2.6 + 2 * p.age, Math.sin(Math.PI * p.age), 1.2)
    }
    for (const p of particles(f, LOOP, 5, 20, 7)) {
      const x = BOWL_X + (p.r[0] - 0.5) * 10 + (p.r[1] - 0.5) * 8 * p.age + Math.sin(p.t * 0.4) * 0.6
      const y = 9 - 8 * ease.out(p.age)
      splat(x, y, 2.6 + 2 * p.age, 0.52 * Math.sin(Math.PI * p.age), 1.5)
    }
    const tau = f - POP - 1
    if (tau >= 0 && tau < 18) {
      for (let k = 0; k < 8; k++) {
        const x0 = BOWL_X + (k - 3.5) * 2.3
        const y0 = BUBBLE_Y - R_MAX * 0.55 + (k % 2) * 2.5
        const out = x0 - BOWL_X
        const x = x0 + out * 0.9 * ease.out(tau / 18)
        const y = y0 + (RIM_Y - 0.5 - y0) * ease.inOut(Math.min(1, tau / 9)) + (Math.abs(out) > 5 ? 6 * ease.in(beat(tau, 6, 18)) : 0)
        splat(x, y, 3.4 + tau * 0.06, 1.15 * (1 - smoothstep(5, 18, tau)), 1.1)
      }
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const g = glow(x, y)
        if (x <= EDGE_X && y >= TABLE_Y) {
          const isLeg = y >= 28 && (x === 3 || x === 4 || x === 46 || x === 47)
          const level = y < LIP_Y ? 2.4 - (y - TABLE_Y) * 0.3 + g * 2.4
            : y === LIP_Y ? 4.2 + g * 2 - (x === EDGE_X ? 1 : 0)
            : y < 28 ? 1.2 + g * 1.4
            : isLeg ? 1.2 + g : 0
          c.set(x, y, shade(TABLE, level))
        } else if (y >= FLOOR_Y) {
          c.set(x, y, shade(FLOOR, 1.2 + g * 3 - (y === FLOOR_Y ? 0 : 0.4)))
        } else {
          c.set(x, y, shade(WALL, 0.4 + g * 3.8 - (y === FLOOR_Y - 1 ? 1 : 0)))
        }
      }
    }
    const halo = 4.2 + (f === POP + 1 ? 1.2 : 0)
    for (let y = 3; y < 13; y++) {
      for (let x = 0; x < 14; x++) {
        const d = Math.hypot(x - LAMP_X, (y - 6.5) * 1.2)
        if (d < halo) c.set(x, y, LAMP_GLOW[d < halo * 0.5 ? 1 : 0] ?? 0)
      }
    }
    for (let y = 0; y < 3; y++) c.set(LAMP_X, y, WALL[0] ?? 0)
    for (const [y, half] of [[3, 1], [4, 2], [5, 3]] as const) {
      for (let x = LAMP_X - half; x <= LAMP_X + half; x++) c.set(x, y, shade(BOWL, y === 5 ? 4 : 1.6 - (x - LAMP_X) * 0.4))
    }
    c.set(LAMP_X - 1, 6, BULB[1] ?? 0)
    c.set(LAMP_X, 6, BULB[2] ?? 0)
    c.set(LAMP_X + 1, 6, BULB[1] ?? 0)
    c.set(LAMP_X, 7, BULB[0] ?? 0)

    for (let x = BOWL_X - 7; x <= BOWL_X + 7; x++) c.set(x, 23, shade(TABLE, Math.abs(x - BOWL_X) > 5 ? 1 : 0))
    for (let x = BOWL_X - 5; x <= BOWL_X + 5; x++) c.set(x, 24, shade(TABLE, 1))
    c.ellipse(BOWL_X, 13, RIM_HW + 0.4, 1.6, (x, y) => shade(BOWL, y <= 12 ? 3.4 - (x - BOWL_X) * 0.08 : 0.6))

    const flash = f === POP + 1 ? 0.8 : f === POP + 2 ? 0.4 : 0
    drawFog(c, back, flash)

    const b = bubble(f)
    if (b) {
      const [rx, ry] = b
      for (let y = Math.floor(BUBBLE_Y - ry); y < RIM_Y; y++) {
        for (let x = Math.floor(BOWL_X - rx); x <= Math.ceil(BOWL_X + rx); x++) {
          const u = (x - BOWL_X) / rx
          const v = (y - BUBBLE_Y) / ry
          const e = u * u + v * v
          if (e > 1) continue
          const theta = Math.atan2(v, u)
          const isSkin = Math.sqrt(e) > 1 - 1.15 / Math.max(rx, ry)
          if (isSkin) {
            if (f === POP && Math.floor(mod(theta, TAU) / TAU * 9) % 2 === 0) continue
            const hue = Math.floor(mod(theta / TAU + f * 0.03, 1) * 8) % 4
            c.set(x, y, IRIS[hue] ?? 0)
            continue
          }
          const swirl = Math.sin(theta * 2 + Math.sqrt(e) * 5 - f * 0.5) > 0.55 ? 0.7 : 0
          c.set(x, y, shade(FOG, 3.8 + (1 - e) * 1.8 - u * 1.1 - v * 0.5 + swirl))
        }
      }
      if (f < POP) {
        const hx = Math.round(BOWL_X - rx * 0.45)
        const hy = Math.round(BUBBLE_Y - ry * 0.62)
        c.set(hx, hy, 0xffffff)
        c.set(hx + 1, hy, 0xffffff)
        if (ry > 4) c.set(hx - 1, hy + 1, FOG[7] ?? 0)
        if (ry > 5) c.set(Math.round(BOWL_X + rx * 0.6), Math.round(BUBBLE_Y - ry * 0.2), FOG[7] ?? 0)
      }
    }

    for (let y = RIM_Y; y <= 23; y++) {
      const hw = bowlHalf(y)
      for (let x = Math.ceil(BOWL_X - hw); x <= Math.floor(BOWL_X + hw); x++) {
        const nx = (x - BOWL_X) / Math.max(1, hw)
        const level = y === RIM_Y ? 6 - nx * 1.4 - (Math.abs(nx) > 0.95 ? 1 : 0)
          : y <= 21 ? 2.6 - nx * 1.5 - (y - RIM_Y) * 0.2 - (y === RIM_Y + 1 ? 1 : 0)
            + (nx < -0.82 && y < 20 ? 1.3 : 0) + (Math.abs(nx + 0.5) < 0.1 && y > RIM_Y + 1 && y < 19 ? 2 : 0)
          : 1.6 - nx * 0.8
        c.set(x, y, shade(BOWL, level))
      }
    }

    drawFog(c, front, flash)

    if (f > POP && f <= POP + 4) {
      const t = f - POP
      for (let k = 0; k < 11; k++) {
        const angle = -Math.PI * (k + 0.5) / 11
        const d = R_MAX + 0.5 + t * 1.9
        const x = BOWL_X + Math.cos(angle) * d * 1.1
        const y = BUBBLE_Y + Math.sin(angle) * d * 0.9 + 0.4 * t * t
        c.set(x, y, t < 3 ? IRIS[k % 4] ?? 0 : FOG[5] ?? 0)
      }
    }
  })
}

function drawFog(c: Canvas, D: Float32Array, flash: number): void {
  for (let x = 0; x < W; x++) {
    let depth = 0
    for (let y = 0; y < H; y++) {
      const i = y * W + x
      const d = D[i] ?? 0
      if (d < 0.14) {
        depth = 0
        continue
      }
      const lit = clamp(1 - Math.hypot((x - 14) / 64, (y + 6) / 44))
      const facing = d - (x > 0 && y > 0 ? D[i - W - 1] ?? 0 : 0)
      if (d < 0.45) {
        c.set(x, y, shade(FOG, (d < 0.28 ? 0.4 : 1.4) + lit * 1.4 + flash))
        continue
      }
      let level = 3 + Math.min(d - 0.45, 0.8) * 1.2 + lit * 2.2 + flash - Math.min(depth, 6) * 0.15 + clamp(facing * 3, -1, 1)
      if (depth === 0) level += 1
      depth++
      c.set(x, y, shade(FOG, level))
    }
  }
}
export const scene: Scene = {
  verb: 'Sublimating',
  render,
  hero: POP - 1,
  snaps: [
    { frames: POP + 1, box: [12, 4, 31, 9], colors: [...FOG.slice(3, 6), ...IRIS.slice(0, 3), 0xd9d5f5], why: 'the fog bubble pops: its skin is gone and its fog slumps' },
    { frames: POP + 1, box: [15, 11, 22, 13], colors: [0xb6afe6], why: 'the fog it held drops onto the heap in the bowl' },
  ],
}