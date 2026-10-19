import { Canvas, TAU, clamp, ease, hash, hex, mod, noise, shade, smoothstep, type Ramp, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const WATER = hex('06161b 0a2126 0e2c31 13393c 1a4847 245955 316b5f 438069 5d9877 84b38a b9dcc0')
const PAD = hex('0c2618 123620 1b4a26 275f2c 377734 4c8f3c 6aa84a 92c562')
const LOTUS = hex('5c1f3e 8c2f58 bf4a78 e3729a f5a3be fdd8e4')
const POLLEN = hex('a8701a eec24a fae58a')
const PETAL = hex('8c3a5c c45f84 eb93b0 fbc8d8 fff0f4')
const STONE = hex('101418 1c2329 2a3238 3b444a 515a5e 6c7473 8d9389 b3b5a6')
const MOSS = hex('1a3a1e 2c5426 44702e 64903a')
const BARK = hex('140c0c 24161a 362226 4c3132 64433f')
const BLOSSOM = hex('6e2848 a8446c d8789a f2abc2 fdd9e4 fff6f8')
const GOLD = hex('15343a 4a3a24 8a3c12 c0560f e3761a f59a35 fbc160 fde39c')
const WHITE = hex('15343a 46605e 8a9694 bfc3bc e3e0d4 fbf7ec')
const RED = hex('15343a 4a2a2a 7e1c1e b02a24 d6432e ec6a46')
const INK = hex('0a1a1e 121a22 1c2028 2a2c34 3c3c46')

const at = (a: readonly number[], i: number) => a[i] ?? 0
const bump = (f: number, a: number, b: number) => Math.sin(Math.PI * clamp((f - a) / (b - a))) ** 2

const LX = -Math.SQRT1_2
const LY = -Math.SQRT1_2

type Path = { length: number; at: (s: number) => [number, number, number, number] }

function closedPath(points: readonly (readonly [number, number])[]): Path {
  const n = points.length
  const xs: number[] = []
  const ys: number[] = []
  const per = 40
  for (let i = 0; i < n; i++) {
    const [a, b, c, d] = [-1, 0, 1, 2].map(k => points[mod(i + k, n)] ?? [0, 0])
    for (let k = 0; k < per; k++) {
      const t = k / per
      const cr = (p0: number, p1: number, p2: number, p3: number) =>
        0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t)
      xs.push(cr(a?.[0] ?? 0, b?.[0] ?? 0, c?.[0] ?? 0, d?.[0] ?? 0))
      ys.push(cr(a?.[1] ?? 0, b?.[1] ?? 0, c?.[1] ?? 0, d?.[1] ?? 0))
    }
  }
  const count = xs.length
  const cum = [0]
  for (let i = 1; i <= count; i++) {
    cum.push(at(cum, i - 1) + Math.hypot(at(xs, i % count) - at(xs, i - 1), at(ys, i % count) - at(ys, i - 1)))
  }
  const length = at(cum, count)

  return {
    length,
    at(s) {
      const d = mod(s, length)
      let lo = 0
      let hi = count
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1
        if (at(cum, mid) <= d) lo = mid
        else hi = mid
      }
      const t = (d - at(cum, lo)) / Math.max(1e-6, at(cum, lo + 1) - at(cum, lo))
      const x0 = at(xs, lo)
      const y0 = at(ys, lo)
      const x1 = at(xs, (lo + 1) % count)
      const y1 = at(ys, (lo + 1) % count)
      const len = Math.hypot(x1 - x0, y1 - y0) || 1

      return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, (x1 - x0) / len, (y1 - y0) / len]
    },
  }
}

const GULP = 46
const LAND = 18
const DROP = 4
const DRIFT = 0.12
const GX = 40
const GY = 13
const LX0 = GX - (GULP - LAND) * DRIFT

function lap(path: Path, speed: (f: number) => number, at0: number): (f: number) => number {
  const cum = [0]
  for (let f = 0; f < LOOP; f++) cum.push(at(cum, f) + (speed(f) + speed(f + 1)) / 2)
  const total = at(cum, LOOP)
  const pos = (f: number) => {
    const m = mod(f, LOOP)
    const k = Math.floor(m)
    return Math.floor(f / LOOP) * total + at(cum, k) + (at(cum, k + 1) - at(cum, k)) * (m - k)
  }

  return f => ((pos(f) - pos(at0)) / total) * path.length
}

type Skin = (u: number, v: number) => [Ramp, number]

type Koi = {
  path: Path
  s: (f: number) => number
  depth: (f: number) => number
  len: number
  girth: number
  beats: number
  sway: number
  skin: Skin
}

const PATH_A = closedPath([[GX, GY], [49, 10], [56, 16], [51, 24], [39, 25], [28, 21], [25, 14], [30, 9]])
const PATH_B = closedPath([[33, 18], [22, 24], [10, 22], [6, 14], [13, 6], [25, 6], [33, 11]])
const PATH_C = closedPath([[44, 6], [58, 6], [61, 14], [56, 26], [44, 22], [38, 12]])

const speedA = (f: number) => {
  const m = mod(f, LOOP)
  return 1 + 0.7 * bump(m, 26, 42) - 0.85 * bump(m, 41, 51) + 0.6 * bump(m, 50, 60)
}

const KOI: Koi[] = [
  {
    path: PATH_C,
    s: lap(PATH_C, () => 1, 0),
    depth: () => 0.45,
    len: 10,
    girth: 0.85,
    beats: 6,
    sway: 0.7,
    skin: (u, v) => (noise(u * 0.35 + 3, v * 0.6 + 7, 0, 11) < 0.42 || (u > 1 && u < 2.5) ? [INK, 4.2] : [WHITE, 4.4]),
  },
  {
    path: PATH_B,
    s: lap(PATH_B, () => 1, 0),
    depth: () => 0.32,
    len: 15,
    girth: 1.1,
    beats: 6,
    sway: 0.9,
    skin: (u, v) => {
      const n = noise(u * 0.38 + 1, v * 0.5 + 2, 0, 5)
      const isCap = u > 1.2 && u < 4 && Math.abs(v) < 1.3
      return isCap || (n > 0.55 && u > 5 && u < 11.5) ? [RED, 4.4] : [WHITE, 3.6]
    },
  },
  {
    path: PATH_A,
    s: lap(PATH_A, speedA, GULP),
    depth: f => 0.5 - 0.5 * smoothstep(28, 43, f) + 0.5 * smoothstep(49, 64, f),
    len: 13,
    girth: 1,
    beats: 7,
    sway: 0.85,
    skin: (u, v) => [GOLD, noise(u * 0.5, v * 0.7, 0, 9) > 0.62 ? 5.6 : 4.6],
  },
]

type Sample = { u: number; x: number; y: number; tx: number; ty: number }

function spine(k: Koi, f: number): Sample[] {
  const s = k.s(f)
  const phase = (TAU * k.beats * s) / k.path.length
  const kick = 1 + (k.path === PATH_A ? 0.9 * bump(f, 47, 58) : 0)
  const out: Sample[] = []
  for (let u = -0.5; u <= k.len + 0.01; u += 0.5) {
    const [x, y, tx, ty] = k.path.at(s - u)
    const sway = k.sway * kick * (Math.max(0, u) / k.len) ** 1.5 * Math.sin(phase - u * 0.5)
    out.push({ u, x: x - ty * sway, y: y + tx * sway, tx, ty })
  }

  return out
}

function girth(q: number): number {
  if (q < 0.06) return 0.9 + (q / 0.06) * 0.8
  if (q < 0.3) return 1.7 + ((q - 0.06) / 0.24) * 0.5
  if (q < 0.8) return 2.2 - ((q - 0.3) / 0.5) * 1.45
  return 0
}

type Hit = { part: 'body' | 'fin'; u: number; v: number; edge: number }

function koiAt(k: Koi, pts: readonly Sample[], px: number, py: number, isBodyOnly = false): Hit | undefined {
  let best = Infinity
  let near: Sample | undefined
  for (const p of pts) {
    const d = (px - p.x) ** 2 + (py - p.y) ** 2
    if (d < best) {
      best = d
      near = p
    }
  }
  if (!near) return undefined
  const d = Math.sqrt(best)
  const q = near.u / k.len
  const v = (px - near.x) * -near.ty + (py - near.y) * near.tx
  const hw = Math.max(0.75, girth(q) * k.girth)
  if (q <= 0.8 && d <= hw) return { part: 'body', u: near.u, v, edge: Math.abs(v) / hw }
  if (isBodyOnly) return undefined
  if (q > 0.78) {
    const spread = 0.7 + ((q - 0.78) / 0.22) * 1.5 * k.girth
    const isFork = q > 0.93 && Math.abs(v) < 0.6
    if (d <= spread && !isFork) return { part: 'fin', u: near.u, v, edge: 1 }
  }
  const fin = pts[Math.round((k.len * 0.26 + 0.5) / 0.5)]
  if (fin) {
    const reach = girth(0.26) * k.girth + 0.9
    for (const side of [-1, 1]) {
      const fx = fin.x - fin.ty * side * reach - fin.tx * 0.7
      const fy = fin.y + fin.tx * side * reach - fin.ty * 0.7
      if (Math.hypot(px - fx, py - fy) <= 1.05 * k.girth) return { part: 'fin', u: k.len * 0.26, v: side, edge: 1 }
    }
  }

  return undefined
}

type Pad = { x: number; y: number; r: number; notch: number }
const PADS: Pad[] = [
  { x: 10, y: 8, r: 4.6, notch: 0.7 },
  { x: 49, y: 25, r: 5.2, notch: Math.PI },
  { x: 25, y: 28, r: 3.3, notch: -1.9 },
  { x: 29, y: 3, r: 3, notch: 2.4 },
]

function padAt(px: number, py: number): { pad: Pad; dx: number; dy: number } | undefined {
  for (const pad of PADS) {
    const dx = px - pad.x
    const dy = py - pad.y
    const d = Math.hypot(dx, dy)
    if (d > pad.r) continue
    const da = Math.abs(mod(Math.atan2(dy, dx) - pad.notch + Math.PI, TAU) - Math.PI)
    if (d > 0.8 && da < 0.32) continue
    return { pad, dx, dy }
  }

  return undefined
}

const STONES = [
  { x: 2, y: 28.5, rx: 5.2, ry: 4.4 },
  { x: 9.5, y: 31.5, rx: 4, ry: 2.8 },
  { x: -0.5, y: 21, rx: 2.8, ry: 3.2 },
]
const stoneAt = (x: number, y: number) => STONES.find(s => ((x - s.x) / s.rx) ** 2 + ((y - s.y) / s.ry) ** 2 <= 1)

const TWIG: [number, number, number, number, number][] = [
  [64, -1, 57, 3, 2], [57, 3, 51, 4, 1], [57, 3, 56, 7, 1], [61, 1, 62, 5, 1],
]
const BLOSSOMS: [number, number][] = [[50, 4], [53, 3], [56, 8], [62, 6], [59, 1]]

const TWIG_SHADOW: ReadonlySet<number> = (() => {
  const c = new Canvas()
  for (const [x0, y0, x1, y1] of TWIG) c.line(x0 + 3, y0 + 4, x1 + 3, y1 + 4, 1)
  for (const [bx, by] of BLOSSOMS) c.disc(bx + 3, by + 4, 1.6, 1)
  const set = new Set<number>()
  c.px.forEach((v, i) => v && set.add(i))
  return set
})()

const BOTTOM: Float32Array = (() => {
  const b = new Float32Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const shallow = Math.max(0, 1 - Math.hypot((x - 1) / 17, (y - 31) / 12))
      const n = noise(x / 15, y / 8, 0, 3) - 0.5
      const edge = (((x - 30) / 38) ** 2 + ((y - 15) / 20) ** 2) * 1.4
      b[y * W + x] = 3.1 + shallow * 3.4 + n * 1.8 - edge
    }
  }
  return b
})()

const GLINTS = Array.from({ length: 9 }, (_, i) => {
  const r = (k: number) => noise(i * 3.1, k * 1.7, 0, 21)
  return { x: i * 7 + r(1) * 5, y: 2 + ((i * 11) % 28), len: 2 + Math.round(r(2) * 2), phase: r(3) * TAU, fast: i % 3 === 1 }
})

type Ring = { x: number; y: number; t0: number; delay: number; amp: number }
const RINGS: Ring[] = [
  ...[0, 4, 8].map(k => ({ x: LX0 + 0.5, y: GY, t0: LAND, delay: k, amp: k === 0 ? 1 : 0.7 })),
  ...[0, 3, 7].map(k => ({ x: GX + 0.5, y: GY, t0: GULP, delay: k, amp: k === 0 ? 1.15 : 0.8 })),
]

function petal(f: number): { x: number; y: number; h: number } | undefined {
  if (f >= GULP) return undefined
  if (f < DROP) return { x: 50, y: 5, h: 1 }
  if (f < LAND) {
    const t = (f - DROP) / (LAND - DROP)
    const e = ease.inOut(t)
    return {
      x: 50 + (LX0 - 50) * e + Math.sin(t * TAU * 1.5) * 2.2 * (1 - t),
      y: 5 + (GY - 5) * e,
      h: 1 - t,
    }
  }
  return { x: LX0 + (f - LAND) * DRIFT, y: GY, h: 0 }
}

const CREST = 1
const FAR = 2
const GLINT = 3

function render(): Int32Array[] {
  const out: Int32Array[] = []

  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()

    const surface = new Uint8Array(W * H)
    for (const g of GLINTS) {
      const shift = ((g.fast ? 64 : 32) * f) / LOOP
      const len = g.len + Math.round(Math.sin(g.phase + (TAU * 3 * f) / LOOP) * 0.9)
      for (const off of [0, 32]) {
        const gx = Math.round(mod(g.x + shift + off, 64))
        for (let i = 0; i < len; i++) {
          const x = (gx + i) % W
          surface[g.y * W + x] = GLINT
        }
      }
    }
    for (const r of RINGS) {
      const age = mod(f - r.t0, LOOP) - r.delay
      if (age < 0 || age > 24) continue
      const rad = 1.4 + age * 0.6
      const a = r.amp * (1 - age / 24)
      for (let y = Math.max(0, Math.floor(r.y - rad - 2)); y <= Math.min(H - 1, r.y + rad + 2); y++) {
        for (let x = Math.max(0, Math.floor(r.x - rad - 2)); x <= Math.min(W - 1, r.x + rad + 2); x++) {
          const d = Math.hypot(x - r.x, y - r.y)
          const facing = (x - r.x) * LX + (y - r.y) * LY > -0.5 - Math.max(0, 3.5 - rad)
          const grain = hash(x, y, 5) - 0.5
          if (Math.abs(d - rad) < 0.65) surface[y * W + x] = a > 0.45 + grain * 0.4 && facing ? CREST : a > 0.15 + grain * 0.2 ? FAR : surface[y * W + x] ?? 0
        }
      }
    }

    const spines = KOI.map(k => spine(k, f))
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let level = BOTTOM[y * W + x] ?? 0
        if (TWIG_SHADOW.has(y * W + x)) level -= 1.3
        if (padAt(x - 2, y - 2)) level -= 1.6
        KOI.forEach((k, i) => {
          const off = 1 + (1 - k.depth(f)) * 1.6
          if (koiAt(k, spines[i] ?? [], x - off, y - off, true)) level -= 1.5 - k.depth(f) * 0.6
        })
        c.set(x, y, shade(WATER, level))
      }
    }

    const isKoi = new Uint8Array(W * H)
    KOI.forEach((k, i) => {
      const pts = spines[i] ?? []
      const depth = k.depth(f)
      const xs = pts.map(p => p.x)
      const ys = pts.map(p => p.y)
      for (let y = Math.max(0, Math.floor(Math.min(...ys) - 4)); y <= Math.min(H - 1, Math.max(...ys) + 4); y++) {
        for (let x = Math.max(0, Math.floor(Math.min(...xs) - 4)); x <= Math.min(W - 1, Math.max(...xs) + 4); x++) {
          const hit = koiAt(k, pts, x, y)
          if (!hit) continue
          isKoi[y * W + x] = 1
          const shadow = padAt(x - 1, y - 1) ? -1.2 : 0
          if (hit.part === 'fin') {
            c.set(x, y, shade(WATER, (BOTTOM[y * W + x] ?? 0) + 2.4 - depth * 1.6 + shadow))
            continue
          }
          const [skin, base] = k.skin(hit.u, hit.v)
          const round = 1 - hit.edge ** 2
          const side = Math.sign(hit.v) * (-(pts[0]?.ty ?? 0) * LX + (pts[0]?.tx ?? 0) * LY)
          c.set(x, y, shade(skin, base - 1.4 + round * 1.7 + side * hit.edge * 0.7 - depth * 2.4 + shadow))
        }
      }
    })

    for (let i = 0; i < W * H; i++) {
      const x = i % W
      const y = Math.floor(i / W)
      const s = surface[i]
      if (s === FAR && !isKoi[i]) c.set(x, y, shade(WATER, Math.max((BOTTOM[i] ?? 0) + 1.6, 5)))
      if (s === GLINT) c.set(x, y, at(WATER, 9))
      if (s === CREST) c.set(x, y, at(WATER, 10))
    }

    const gold = spines[2]?.[0]
    if (gold && f >= GULP - 1 && f <= GULP + 2) {
      const mx = Math.round(gold.x + gold.tx * 0.8)
      const my = Math.round(gold.y + gold.ty * 0.8)
      if (f <= GULP) c.set(mx, my, at(INK, 1))
      if (f === GULP) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.set(mx + dx, my + dy, at(WATER, 10))
      }
      const spray = f - GULP + 1
      if (spray >= 1) {
        for (const [dx, dy] of [[1, -1], [-1, -1], [1, 1], [-1, 1], [0, -1.4]] as const) {
          c.set(mx + dx * (spray + 0.6), my + dy * (spray + 0.6), at(WATER, spray === 1 ? 10 : 9))
        }
      }
    }

    for (let y = 18; y < H; y++) {
      for (let x = 0; x < 15; x++) {
        const s = stoneAt(x, y)
        if (!s) continue
        const nx = (x - s.x) / s.rx
        const ny = (y - s.y) / s.ry
        const lit = -(nx * LX + ny * LY)
        const isRim = !stoneAt(x - 1, y - 1)
        const isMoss = noise(x / 2.2, y / 2.2, 0, 17) > 0.6 && ny < 0.2
        if (isMoss) c.set(x, y, shade(MOSS, 1.6 + lit * 1.4 + (isRim ? 1 : 0)))
        else c.set(x, y, shade(STONE, 3.6 + lit * 2.2 + (isRim ? 1.4 : 0)))
      }
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const hit = padAt(x, y)
        if (!hit) continue
        const { pad, dx, dy } = hit
        const d = Math.hypot(dx, dy) / pad.r
        const a = Math.atan2(dy, dx) - pad.notch
        const vein = d > 0.25 && d < 0.85 && Math.abs(mod(a * (7 / TAU) + 0.5, 1) - 0.5) < 0.07
        const facing = -((dx / pad.r) * LX + (dy / pad.r) * LY)
        const isRim = !padAt(x + 1, y + 1) || !padAt(x - 1, y - 1)
        let level = 3.6 + facing * 1.1 + (isRim ? (facing > 0 ? 1.4 : -1) : 0) - (vein ? 0.8 : 0)
        if (!padAt(x + 1, y + 1) && facing < 0) level -= 0.4
        c.set(x, y, shade(PAD, level))
      }
    }
    c.sprite(47, 23, [
      '.aab.',
      'accdb',
      'acyde',
      'bdde.',
      '.be..',
    ], { a: at(LOTUS, 4), b: at(LOTUS, 3), c: at(LOTUS, 5), d: at(LOTUS, 4), e: at(LOTUS, 2), y: at(POLLEN, 2) })

    const p = petal(f)
    if (p && f >= DROP) {
      const sx = Math.round(p.x + p.h * 5)
      const sy = Math.round(p.y + p.h * 4.5)
      for (const dx of [0, 1]) c.set(sx + dx, sy, shade(WATER, (BOTTOM[sy * W + sx + dx] ?? 2) - 1.6))
      const tumble: [number, number, number][][] = [
        [[0, 0, 3], [1, 0, 2], [1, 1, 1]],
        [[0, 0, 2], [1, 0, 3], [0, 1, 1]],
        [[0, 0, 1], [1, 0, 2], [2, 0, 3]],
        [[0, 0, 3], [0, 1, 2], [1, 1, 2]],
      ]
      const afloat: [number, number, number][] = [[0, 0, 4], [1, 0, 3], [1, 1, 2]]
      const shape = p.h > 0 ? (tumble[Math.floor(f / 2) % tumble.length] ?? afloat) : afloat
      for (const [dx, dy, l] of shape) c.set(p.x + dx, p.y + dy, at(PETAL, l))
    }

    const nod = f >= DROP && f < DROP + 6 ? Math.round(Math.sin(((f - DROP) / 6) * Math.PI)) : 0
    const dip = (x: number) => (x < 55 ? nod : 0)
    for (const [x0, y0, x1, y1, w] of TWIG) {
      c.line(x0, y0, x1, y1 + dip(x1), at(BARK, 2))
      if (w > 1) c.line(x0, y0 + 1, x1, y1 + 1, at(BARK, 1))
      c.line(x0, y0 - 1, x1, y1 - 1 + dip(x1), (x, y) => (c.get(x, y + 1) === at(BARK, 2) ? at(BARK, 4) : undefined))
    }
    for (const [i, [bx, by0]] of BLOSSOMS.entries()) {
      const by = by0 + dip(bx)
      c.sprite(bx - 1, by - 1, [
        '.ab.',
        'acbb',
        '.bb.',
      ].slice(0, 3), { a: at(BLOSSOM, 5 - (i % 2)), b: at(BLOSSOM, 3), c: at(BLOSSOM, 1) })
      c.set(bx + 1, by + 1, at(BLOSSOM, 2))
    }
    if (p && f < DROP) c.set(p.x - 1, p.y + 1, at(PETAL, 3))

    out.push(c.px)
  }

  return out
}

export const scene: Scene = {
  verb: 'Flowing',
  render,
  hero: 44,
  snaps: [
    { frames: LAND, box: [35, 10, 40, 16], why: 'The petal lands and its first ring opens round it.' },
    { frames: GULP, box: [38, 10, 44, 16], why: 'The gulp: the gold koi\'s mouth breaks the surface in a splash.' },
  ],
}
