import { Canvas, clamp, ease, hex, lerp, mod, shade, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const FELT = hex('050c09 08140f 0d1f16 132a1d 1a3725 22462e 2c5738 3a6a40 527f46')
const PAINTS = [
  hex('3a0c16 7a1a24 c0362e ee6a48 f8a080'),
  hex('4a1a08 8a3a0c d0661a f6a040 fcd08a'),
  hex('4a3408 8a6a10 d0aa22 f8e070 fff6c0'),
  hex('3c3430 7a6c62 bcaea0 e8dccc fffaf0'),
  hex('0e1e4a 1a3a8a 2e6ad0 6aaaf6 bce0ff'),
  hex('2a0e3a 52206e 8a3cb0 c47ae6 eac0ff'),
]
const SKIN = hex('4a2420 7e3e32 b2604a d6866a efb08e')
const NAIL = hex('c88a84 f2c8c0')
const BRASS = hex('3a2810 7a5a24 c09a44 f0d890')
const PENNANT = hex('5a0c14 a01c22 e04030 ff8060')

const DEPTH = 0.55
const SKEW = 0.3
type V3 = readonly [number, number, number]
const screen = ([x, y, z]: V3): [number, number] => [x + y * SKEW - 6, 31 - y * DEPTH - z]

const lampAt = (f: number): V3 => [29 + 1.5 * wave(f, LOOP), 17, 22]

const PATH: [number, number][] = [
  [5, 30], [8, 28], [14, 21], [21, 12], [29, 8], [37, 12], [43, 20], [49, 25], [54, 26], [58, 26],
]
const SPACING = 4.1
const TALL = 8
const WIDE = 4
const THICK = 1.8

type Domino = { x: number; y: number; tx: number; ty: number; paint: readonly number[] }
const DOMINOES: Domino[] = (() => {
  const samples: { x: number; y: number }[] = []
  for (let k = 1; k + 2 < PATH.length; k++) {
    const [p0, p1, p2, p3] = [PATH[k - 1], PATH[k], PATH[k + 1], PATH[k + 2]] as [number, number][]
    for (let s = 0; s < 1; s += 0.02) {
      const cr = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (c - a) * s + (2 * a - 5 * b + 4 * c - d) * s * s + (3 * b - a - 3 * c + d) * s * s * s)
      samples.push({ x: cr(p0?.[0] ?? 0, p1?.[0] ?? 0, p2?.[0] ?? 0, p3?.[0] ?? 0), y: cr(p0?.[1] ?? 0, p1?.[1] ?? 0, p2?.[1] ?? 0, p3?.[1] ?? 0) })
    }
  }
  const out: Domino[] = []
  let run = 0
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1] ?? { x: 0, y: 0 }
    const b = samples[i] ?? a
    run += Math.hypot(b.x - a.x, b.y - a.y)
    if (run >= SPACING || out.length === 0) {
      run = 0
      const l = Math.hypot(b.x - a.x, b.y - a.y) || 1
      out.push({ x: b.x, y: b.y, tx: (b.x - a.x) / l, ty: (b.y - a.y) / l, paint: [] })
    }
  }

  return out.map((d, i) => ({ ...d, paint: PAINTS[Math.min(PAINTS.length - 1, Math.floor((i / out.length) * PAINTS.length))] ?? [] }))
})()
const N = DOMINOES.length

const PUSH = 11
const STEP = 1.45
const FALL = 5
const LAST_FALL = FALL + 1
const REWIND = 57
const BACK_STEP = 0.5

function tilt(i: number, f: number): number {
  const rest = i === N - 1 ? 1.32 : 1.18
  const start = PUSH + i * STEP + Math.max(0, 3 - i) * 0.3
  const isLast = i === N - 1
  const s = clamp((f - start) / (isLast ? LAST_FALL : FALL))
  const down = isLast ? s : s < 0.5 ? ease.in(s * 2) * 0.5 : 0.5 + ease.out((s - 0.5) * 2) * 0.5
  const back = clamp((f - REWIND - (N - 1 - i) * BACK_STEP) / (isLast ? 6 : 4))
  const up = isLast ? back : ease.inOut(back)
  return rest * down * (1 - up)
}

function corners(d: Domino, angle: number): V3[] {
  const [ux, uy] = [-d.ty, d.tx]
  const out: V3[] = []
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  for (const c of [0, TALL]) {
    for (const b of [-THICK / 2, THICK / 2]) {
      for (const a of [-WIDE / 2, WIDE / 2]) {
        const rb = (b - THICK / 2) * cos + c * sin
        const rc = -(b - THICK / 2) * sin + c * cos
        out.push([d.x + ux * a + d.tx * (THICK / 2 + rb), d.y + uy * a + d.ty * (THICK / 2 + rb), rc])
      }
    }
  }

  return out
}

function hull(points: [number, number][]): [number, number][] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const half = (list: [number, number][]) => {
    const out: [number, number][] = []
    for (const q of list) {
      while (out.length >= 2 && cross(out[out.length - 2] ?? q, out[out.length - 1] ?? q, q) <= 0) out.pop()
      out.push(q)
    }
    out.pop()
    return out
  }

  return [...half(p), ...half([...p].reverse())]
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

const FACES = [
  [0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5],
] as const

const HINGE: V3 = [55.5, 26.5, 0]
const POLE = 8
const POP = PUSH + (N - 1) * STEP + LAST_FALL - 1

const UP = (Math.PI / 2) * 0.97

function raise(f: number): number {
  if (f < POP) return 0
  if (f < REWIND - 3) {
    const t = f - POP
    return UP * (ease.outBack(clamp(t / 4)) + Math.sin(t * 1.2) * Math.exp(-t * 0.35) * 0.12)
  }
  return UP * (1 - ease.in(clamp((f - REWIND + 3) / 6)))
}

function fingerAt(f: number): [number, number] {
  const [tx, ty] = screen([DOMINOES[0]?.x ?? 0, (DOMINOES[0]?.y ?? 0) + 1, TALL])
  const away: [number, number] = [tx - 12, ty - 12]
  const near: [number, number] = [tx - 1, ty - 1]
  const u = mod(f - 62, LOOP)
  if (u < 15) {
    const e = ease.out(u / 15)
    return [lerp(away[0], near[0], e), lerp(away[1], near[1], e)]
  }
  if (f < PUSH - 2) return [near[0] - 1, near[1] - 1]
  if (f < PUSH + 2) {
    const e = ease.inOut(clamp((f - PUSH + 2) / 3))
    return [lerp(near[0] - 1, tx + 2, e), lerp(near[1] - 1, ty + 1, e)]
  }
  const e = ease.inOut(clamp((f - PUSH - 2) / 12))
  return [lerp(tx + 2, away[0], e), lerp(ty + 1, away[1], e)]
}

function render(): Int32Array[] {
  const frames: Int32Array[] = []

  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const lamp = lampAt(f)
    const dominoes = DOMINOES.map((d, i) => ({ d, i, pts: corners(d, tilt(i, f)) }))

    const shadow = new Canvas()
    const cast = ([x, y, z]: V3): [number, number] => {
      const k = lamp[2] / Math.max(0.5, lamp[2] - z)
      return screen([lamp[0] + (x - lamp[0]) * k, lamp[1] + (y - lamp[1]) * k, 0])
    }
    for (const { pts } of dominoes) shadow.poly(hull(pts.map(cast)), 1)
    const phi = raise(f)
    const tip: V3 = [HINGE[0] + POLE * Math.cos(phi), HINGE[1], POLE * Math.sin(phi)]
    shadow.line(...cast(HINGE), ...cast(tip), 1)

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const wy = (31 - y) / DEPTH
        const r = Math.hypot(x - lamp[0], (wy - lamp[1]) * 0.9)
        const lit = 0.6 + 7.2 * clamp(1 - r / 40) ** 1.4
        c.set(x, y, shade(FELT, lit - (shadow.get(x, y) ? 1.6 : 0), x, y))
      }
    }

    const [hx, hy] = screen(HINGE).map(Math.round) as [number, number]
    c.rect(hx - 1, hy - 1, 3, 2, shade(BRASS, 1.4))
    c.rect(hx - 1, hy - 2, 3, 1, shade(BRASS, 2.8))
    const [px, py] = screen(tip).map(Math.round) as [number, number]
    c.line(hx, hy - 2, px, py - 2, shade(BRASS, 2.6))
    const flutter = Math.round(wave(f, 6, 1))
    const flag = phi > 0.9
      ? [[1, 0], [2, 0], [3, 0], [4, flutter < 0 ? -1 : 0], [1, 1], [2, 1], [3, 1], [1, 2]]
      : phi > 0.4
        ? [[1, 0], [2, 0], [1, 1], [2, 1], [3, 1]]
        : [[-1, -1], [-2, -1], [-3, -1], [-1, 0], [-2, 0]]
    for (const [dx, dy] of flag) {
      const x = px + (dx ?? 0)
      const y = py - 2 + (dy ?? 0)
      c.set(x, y, shade(PENNANT, (dy === 0 || dy === -1 ? 3 : 2) - (dx === 4 ? 0.6 : 0), x, y))
    }

    if (f >= POP + 1 && f <= POP + 3) {
      const r = f - POP + 3
      for (const [dx, dy] of [[1, -1], [1, 0.2], [-1, -1], [0.4, -1.3]] as const) {
        const x = Math.round(px + 2 + dx * r)
        const y = Math.round(py - 1 + dy * r)
        c.set(x, y, shade(BRASS, 3))
        if (f < POP + 3) c.set(x - Math.sign(dx), y - Math.sign(dy), shade(BRASS, 2))
      }
    }

    dominoes.sort((a, b) => b.d.y - a.d.y || a.i - b.i)
    const owner = new Int16Array(W * H).fill(-1)
    for (const { d, i, pts } of dominoes) {
      const flat = pts.map(screen)
      const center: V3 = [d.x, d.y, TALL / 2]
      const toLamp = sub(lamp, center)
      const ll = Math.hypot(...toLamp)
      const own = new Canvas()
      own.poly(hull(flat), shade(d.paint, 1.2) + 1)
      for (const face of FACES) {
        const corner = (k: number): V3 => pts[k] ?? [0, 0, 0]
        const a = corner(face[0])
        let n = cross(sub(corner(face[1]), a), sub(corner(face[3]), a))
        const mid = face.map(corner).reduce((m, p): V3 => [m[0] + p[0] / 4, m[1] + p[1] / 4, m[2] + p[2] / 4], [0, 0, 0] as V3)
        if (dot(n, sub(mid, center)) < 0) n = [-n[0], -n[1], -n[2]]
        const nl = Math.hypot(...n) || 1
        if (dot(n, [SKEW, -1, DEPTH]) <= 0.05 * nl) continue
        const lambert = clamp(dot(n, toLamp) / (nl * ll))
        const near = clamp(1 - Math.hypot(d.x - lamp[0], d.y - lamp[1]) / 44)
        own.poly(face.map(k => screen(pts[k] ?? [0, 0, 0])), shade(d.paint, 0.5 + lambert * 3.6 * (0.55 + near * 0.6) + (i % 2 ? 0 : 0.35)) + 1)
      }
      const before = owner.slice()
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const at = y * W + x
          const color = own.px[at] ?? 0
          if (!color) continue
          const isContact = [[1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => {
            const n = (y + (dy ?? 0)) * W + x + (dx ?? 0)
            return x + (dx ?? 0) >= 0 && x + (dx ?? 0) < W && y + (dy ?? 0) >= 0 && !own.px[n] && (before[n] ?? -1) >= 0 && before[n] !== i
          })
          c.set(x, y, isContact ? shade(d.paint, 0) : color - 1)
          owner[at] = i
        }
      }
    }

    const [fx, fy] = fingerAt(f)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = x - fx
        const dy = y - fy
        const s = -(dx + dy) * Math.SQRT1_2
        const across = (dx - dy) * Math.SQRT1_2
        if (s < 0 || s > 24) continue
        const half = s < 1.8 ? 0.9 + s * 0.8 : 2.4
        if (Math.abs(across) > half) continue
        const isNail = s > 0.8 && s < 3.6 && across < -0.2 && across > -1.7
        c.set(x, y, isNail ? shade(NAIL, s < 2 ? 1 : 0) : shade(SKIN, 2.4 - across * 0.7 - (s > 14 ? 0.5 : 0), x, y))
      }
    }

    frames.push(c.px)
  }

  return frames
}

export const scene: Scene = { verb: 'Effecting', render, hero: 27 }
