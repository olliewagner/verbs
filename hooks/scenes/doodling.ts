import { Canvas, clamp, hash, hex, lerp, shade, type Scene } from '../engine'

const W = 64
const H = 32

const PAPER = hex('8a7d6c ab9e87 c8bca1 ded3b8 ede5ce f8f2e2')
const RULE = hex('5b6a86 7586a4 90a1bf a9bad2 bdcddf ccd9e6')
const MARGIN = hex('7a3e4c 9b505f bd6871 d58285 e59b9a efb2ac')
const LEAD = hex('5a5560 6b6670 7d7882 8e8a93 9f9ba3 aeaab1')
const INK = hex('0b1240 121c62 1a2a84 2238a0 2a46b6 3454c6')
const COVER = hex('0d1220 141b2e 1c263d 25314c')
const WIRE = hex('25232c 403e49 67656f 9997a2 cdcbd3 f2f0f4')
const STEEL = hex('2a2a34 5a5a68 9a9aaa dcdce6')
const BARREL = hex('6a7790 a6b3c7 e2e9f3')

const PEN_X = 2 / Math.sqrt(5)
const PEN_Y = -1 / Math.sqrt(5)
const PLUG = hex('11286f 1d42a8 3a66d4')

type Pt = readonly [number, number]

const HINGE = 4
const PAGE_W = 60
const MARGIN_X = 33

function lamp(x: number, y: number): number {
  const d = Math.hypot(x + 8, (y + 10) * 1.2)
  return 1.7 + 3.4 * clamp(1 - d / 84) ** 1.1
}

const isHole = (u: number, y: number) => u === HINGE && (y % 4 === 1 || y % 4 === 2)

const NOTES: ReadonlySet<number> = (() => {
  const s = new Set<number>()
  for (let row = 1; row < 8; row++) {
    const base = row * 4 + 2
    let x = 37 + Math.floor(hash(row, 1) * 3)
    const end = row === 7 ? 49 : 63 - Math.floor(hash(row, 2) * 5)
    while (x < end - 2) {
      const len = 3 + Math.floor(hash(row, x, 3) * 5)
      for (let i = 0; i < len && x + i < end; i++) {
        const h = hash(row, x + i, 9)
        s.add(base * W + x + i)
        if (h < 0.22 && i > 0 && i < len - 1) {
          s.add((base - 1) * W + x + i)
          if (h < 0.1) s.add((base - 2) * W + x + i)
        }
      }
      x += len + 2
    }
  }

  return s
})()

function bresenham(x0: number, y0: number, x1: number, y1: number, push: (x: number, y: number) => void): void {
  let x = x0
  let y = y0
  const dx = Math.abs(x1 - x)
  const dy = -Math.abs(y1 - y)
  const sx = x < x1 ? 1 : -1
  const sy = y < y1 ? 1 : -1
  let err = dx + dy
  for (;;) {
    push(x, y)
    if (x === x1 && y === y1) return
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x += sx
    }
    if (e2 <= dx) {
      err += dx
      y += sy
    }
  }
}

function trace(points: readonly Pt[]): Pt[] {
  const raw: Pt[] = []
  const push = (x: number, y: number) => {
    const last = raw[raw.length - 1]
    if (!last || last[0] !== x || last[1] !== y) raw.push([x, y])
  }
  for (let i = 0; i + 1 < points.length; i++) {
    const [ax, ay] = points[i] ?? [0, 0]
    const [bx, by] = points[i + 1] ?? [0, 0]
    bresenham(Math.round(ax), Math.round(ay), Math.round(bx), Math.round(by), push)
  }
  const out: Pt[] = []
  raw.forEach((b, i) => {
    const a = out[out.length - 1]
    const c = raw[i + 1]
    if (a && c && Math.abs(a[0] - c[0]) === 1 && Math.abs(a[1] - c[1]) === 1) return
    out.push(b)
  })

  return out
}

const SPIRAL: Pt[][] = [
  trace(Array.from({ length: 165 }, (_, i) => {
    const t = i * 0.08
    const r = 0.41 * t
    return [13 + r * Math.cos(t + 2.2), 9 + r * Math.sin(t + 2.2)] as const
  })).reverse(),
]

const STAR: Pt[][] = [
  trace(Array.from({ length: 11 }, (_, n) => {
    const k = n + 6
    const a = -Math.PI / 2 + (k * Math.PI) / 5
    const r = k % 2 ? 2.35 : 5.6
    return [26 + r * Math.cos(a), 9.2 + r * Math.sin(a)] as const
  })),
]

const ROCKET_POLY: Pt[] = [
  [0, -5.4], [1.3, -3.6], [2.3, -1.2], [2.3, 1.2], [4.3, 3.4], [4.3, 6], [2.3, 4.4],
  [-2.3, 4.4], [-4.3, 6], [-4.3, 3.4], [-2.3, 1.2], [-2.3, -1.2], [-1.3, -3.6],
]
const HOME: Pt = [26, 22]

function inside(poly: readonly Pt[], x: number, y: number): boolean {
  let isIn = false
  poly.forEach(([ax, ay], i) => {
    const [bx, by] = poly[(i + 1) % poly.length] ?? [ax, ay]
    if ((ay > y) !== (by > y) && x < ax + ((y - ay) / (by - ay)) * (bx - ax)) isIn = !isIn
  })

  return isIn
}

type Mark = 'edge' | 'fill' | 'port'
type Shape = ReadonlyMap<string, Mark>
const key = (x: number, y: number) => `${x},${y}`
const unkey = (k: string) => k.split(',').map(Number) as [number, number]

function cover(poly: readonly Pt[], eighths: number, threshold: number, port?: Pt): Shape {
  const a = (eighths * Math.PI) / 4
  const [cos, sin] = [Math.cos(a), Math.sin(a)]
  const [ox, oy] = eighths % 2 ? [0.5, 0] : [0, 0]
  const mask = new Set<string>()
  for (let y = -9; y <= 9; y++) {
    for (let x = -9; x <= 9; x++) {
      let n = 0
      for (let j = 0; j < 6; j++) {
        for (let i = 0; i < 6; i++) {
          const px = x - 0.5 + (i + 0.5) / 6 - ox
          const py = y - 0.5 + (j + 0.5) / 6 - oy
          if (inside(poly, px * cos + py * sin, -px * sin + py * cos)) n++
        }
      }
      if (n / 36 >= threshold) mask.add(key(x, y))
    }
  }
  const marks = new Map<string, Mark>()
  for (const k of mask) {
    const [x, y] = unkey(k)
    const isEdge = !mask.has(key(x + 1, y)) || !mask.has(key(x - 1, y)) || !mask.has(key(x, y + 1)) || !mask.has(key(x, y - 1))
    marks.set(k, isEdge ? 'edge' : 'fill')
  }
  if (port) {
    const k = key(Math.round(port[0] * cos - port[1] * sin + ox), Math.round(port[0] * sin + port[1] * cos + oy))
    if (marks.get(k) === 'fill') marks.set(k, 'port')
  }

  return marks
}

function quarter(shape: Shape): Shape {
  return new Map([...shape].map(([k, m]) => {
    const [x, y] = unkey(k)
    return [key(-y, x), m] as const
  }))
}

function headings(poly: readonly Pt[], port?: Pt): Shape[] {
  const out: Shape[] = [cover(poly, 0, 0.45, port), cover(poly, 1, 0.5, port)]
  for (let k = 2; k < 8; k++) out.push(quarter(out[k - 2] ?? new Map()))
  return out
}

const ROCKETS = headings(ROCKET_POLY, [0, -1])
const FLAMES = [2.2, 3.6].map(n => headings([[-1.8, 5.5], [1.8, 5.5], [0, 5.5 + n]]))
const ring = (r: number): Pt[] => Array.from({ length: 12 }, (_, n) => [r * Math.cos((n * Math.PI) / 6), r * Math.sin((n * Math.PI) / 6)] as const)
const PUFFS = [cover(ring(0.7), 0, 0.5), cover(ring(1.6), 0, 0.5)]
const mod8 = (n: number) => ((n % 8) + 8) % 8

function place(shape: Shape | undefined, cx: number, cy: number): Map<number, Mark> {
  const out = new Map<number, Mark>()
  for (const [k, m] of shape ?? []) {
    const [dx, dy] = unkey(k)
    const x = Math.round(cx) + dx
    const y = Math.round(cy) + dy
    if (x >= 0 && x < W && y >= 0 && y < H) out.set(y * W + x, m)
  }

  return out
}

const ROCKET: Pt[][] = (() => {
  const marks = place(ROCKETS[0], HOME[0], HOME[1])
  const left = [...marks]
    .filter(([i, m]) => m === 'edge' && i % W <= HOME[0])
    .map(([i]) => [i % W, Math.floor(i / W)] as const)
    .sort((a, b) => a[1] - b[1] || a[0] - b[0])
  const half: Pt[] = []
  let at = left.shift()
  while (at) {
    half.push(at)
    const [x, y] = at
    let best = -1
    let dist = Infinity
    left.forEach(([px, py], k) => {
      const d = Math.hypot(px - x, py - y) + (px === x || py === y ? 0 : 0.05)
      if (d < dist) {
        dist = d
        best = k
      }
    })
    at = best < 0 ? undefined : left.splice(best, 1)[0]
  }
  const right = half.filter(([x]) => x < HOME[0]).reverse().map(([x, y]) => [2 * HOME[0] - x, y] as const)
  const port = [...marks].find(([, m]) => m === 'port')?.[0] ?? HOME[1] * W + HOME[0]

  return [[...right.slice(-2), ...half, ...right.slice(0, -2)], [[port % W, Math.floor(port / W)]]]
})()

type Pen = { x: number; y: number; h: number; from?: Pt }
type Beat = { pen: Pen; laid: number[]; fold: number }

const STEP = Math.hypot(2, 1)
const DOODLES: Pt[][][] = [SPIRAL, STAR, ROCKET]
const ROCKET_PX = ROCKET.reduce((n, s) => n + s.length, 0)

const across = (dx: number, dy: number) => -dx * PEN_Y + dy * PEN_X

type Trail = { prev: Pt; across: number }

const isClear = (a: number, b: number) => (a * b >= 0 ? Math.abs(a) + Math.abs(b) <= 3.3 : Math.min(Math.abs(a), Math.abs(b)) <= 0.5)
function stops(px: readonly Pt[], cap: (done: number, left: number) => number, trail: Trail): number[] {
  const at = [0]
  for (let i = 1; i < px.length; i++) {
    const [ax, ay] = px[i - 1] ?? [0, 0]
    const [bx, by] = px[i] ?? [0, 0]
    at.push((at[i - 1] ?? 0) + Math.hypot(bx - ax, by - ay))
  }
  const total = at[at.length - 1] ?? 0
  const pt = (i: number): Pt => px[i] ?? [0, 0]
  const move = (i: number, j: number) => across(pt(j)[0] - pt(i)[0], pt(j)[1] - pt(i)[1])
  const isBack = (j: number, prev: Pt) => pt(j)[0] === prev[0] && pt(j)[1] === prev[1]
  const out: number[] = []
  let [prev, before] = [trail.prev, trail.across]
  let i = 0
  while (i < px.length - 1) {
    const done = at[i] ?? 0
    const c = Math.min(STEP, cap(done, total - done))
    const fits = (j: number) => {
      const a = move(i, j)
      const next = j + 1 < px.length ? move(j, j + 1) : 0
      return Math.hypot(pt(j)[0] - pt(i)[0], pt(j)[1] - pt(i)[1]) <= c && (at[j] ?? 0) - done <= 3 &&
        Math.abs(a) <= 1.8 && isClear(before, a) && isClear(a, next) && !isBack(j, prev)
    }
    let j = i + 1
    while (j + 1 < px.length && (at[j + 1] ?? 0) - done <= 3) j++
    while (j > i + 1 && !fits(j)) j--
    while ((isBack(j, prev) || isBack(j, pt(i))) && j + 1 < px.length) j++
    out.push(j)
    ;[prev, before] = [pt(i), move(i, j)]
    i = j
  }
  return out
}
const START: Pt = SPIRAL[0]?.[0] ?? [13, 9]
const GRAB: Pt = [60, 25]
const CURL = 0.85
const BEND = 7

const PULL: Pt = [56, 27]
const BEATS: Beat[] = (() => {
  const out: Beat[] = []
  const laid = DOODLES.map(() => 0)
  let at: Pt = START
  const trail: Trail = { prev: START, across: 0 }
  const put = (x: number, y: number, h: number, fold = 1, from?: Pt) => {
    Object.assign(trail, { prev: at, across: across(x - at[0], y - at[1]) })
    at = [x, y]
    out.push({ pen: { x, y, h, from }, laid: [...laid], fold })
  }
  const glide = (path: readonly Pt[], lift: number, land?: () => void) => {
    const list = stops(path, (d, l) => 1 + 0.6 * Math.min(d, l), trail)
    const end = list[list.length - 1] ?? 0
    list.forEach(j => {
      const [x, y] = path[j] ?? at
      if (j === end) land?.()
      put(x, y, lift * Math.sin((Math.PI * j) / Math.max(1, end)))
    })
  }
  laid[0] = 1
  put(START[0], START[1], 0)
  DOODLES.forEach((strokes, n) => {
    let offset = 0
    strokes.forEach((stroke, s) => {
      const base = offset
      if (n > 0 || s > 0) {
        const hop = trace([at, stroke[0] ?? at])
        glide(hop, Math.min(2.4, 0.5 + hop.length * 0.12), () => (laid[n] = base + 1))
      }
      for (const j of stops(stroke, d => 1.5 + d, trail)) {
        laid[n] = base + j + 1
        const [x, y] = stroke[j] ?? at
        put(x, y, 0)
      }
      offset += stroke.length
    })
  })
  glide(trace([at, GRAB]), 2.2)
  for (const t of [0.5, 1]) {
    const x = lerp(GRAB[0], PULL[0], t)
    put(Math.round(x), Math.round(lerp(GRAB[1], PULL[1], t)), 0, (x + 4 - HINGE) / PAGE_W)
  }
  put(PULL[0], PULL[1], 0, (PULL[0] + 3.4 - HINGE) / PAGE_W)

  const flick = at
  ;[[0.34, 0.62, 1.4], [0.72, 0.3, 1.2], [0.95, 0.08, 0.8]].forEach(([p = 0, fold = 0, h = 0]) => {
    put(Math.round(lerp(flick[0], START[0], p)), Math.round(lerp(flick[1], START[1], p)), h, fold, at)
  })
  const home = trace([at, START])
  const settle = stops(home, (_, l) => 1 + 0.6 * l, trail)
  settle.slice(0, -1).forEach((j, n) => {
    const [x, y] = home[j] ?? at
    put(x, y, 0.6 * (1 - n / settle.length), 0)
  })
  return out
})()
const LOOP = BEATS.length
const DRAWN = BEATS.findIndex(b => (b.laid[2] ?? 0) >= ROCKET_PX)

const PATH: Pt[] = [
  [26, 22], [26, 22], [28, 17], [33, 14], [40, 13], [46, 10], [48, 5], [44, 3], [39, 6], [40, 11],
  [46, 13], [54, 9], [60, 4], [70, 0], [80, -3], [80, -3],
]
const SAMPLES: { x: number; y: number; at: number }[] = (() => {
  const out: { x: number; y: number; at: number }[] = []
  let at = 0
  for (let k = 1; k + 2 < PATH.length; k++) {
    const [p0, p1, p2, p3] = [PATH[k - 1], PATH[k], PATH[k + 1], PATH[k + 2]] as [Pt, Pt, Pt, Pt]
    for (let s = 0; s < 1; s += 0.05) {
      const cr = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (c - a) * s + (2 * a - 5 * b + 4 * c - d) * s * s + (3 * b - a - 3 * c + d) * s * s * s)
      const x = cr(p0[0], p1[0], p2[0], p3[0])
      const y = cr(p0[1], p1[1], p2[1], p3[1])
      const prev = out[out.length - 1]
      if (prev) at += Math.hypot(x - prev.x, y - prev.y)
      out.push({ x, y, at })
    }
  }
  return out
})()
function along(d: number): { x: number; y: number; turn: number } {
  let i = 0
  while (i + 1 < SAMPLES.length && (SAMPLES[i + 1]?.at ?? 0) < d) i++
  const a = SAMPLES[i] ?? { x: 0, y: 0, at: 0 }
  const b = SAMPLES[Math.min(SAMPLES.length - 1, i + 1)] ?? a
  const c = SAMPLES[Math.min(SAMPLES.length - 1, i + 3)] ?? a
  const t = b.at > a.at ? (d - a.at) / (b.at - a.at) : 0
  const angle = Math.atan2(c.x - a.x, -(c.y - a.y))
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), turn: mod8(Math.round(angle / (Math.PI / 4))) }
}
const SPEEDS = [0.7, 1, 1.5, 2, 2.5, 3, 4, 4, 4, 4, 4, 4.5, 5.5, 7, 9.5, 13, 18]
const ALIVE = DRAWN + 1
const FLIGHT = [ALIVE + 2, ALIVE + 3 + SPEEDS.length] as const
type Rocket = { x: number; y: number; turn: number; h: number; flame: number; isFree: boolean }
function rocketAt(f: number): Rocket | undefined {
  if (f < DRAWN || f >= FLIGHT[1]) return undefined
  if (f < FLIGHT[0]) {
    const a = f - ALIVE
    return { x: HOME[0] + (a === 0 ? -1 : a === 1 ? 1 : 0), y: HOME[1], turn: 0, h: 0, flame: a === 1 ? 1 : 0, isFree: false }
  }
  const p = along(SPEEDS.slice(0, f - FLIGHT[0]).reduce((a, b) => a + b, 0))
  return { x: Math.round(p.x), y: Math.round(p.y), turn: f === FLIGHT[0] ? 0 : p.turn, h: Math.min(4, (f - FLIGHT[0] + 1) * 1.4), flame: 1 + (f % 2), isFree: true }
}
function tail(r: Rocket): Pt {
  const a = (r.turn * Math.PI) / 4
  return [r.x - Math.sin(a) * 8, r.y + Math.cos(a) * 8]
}
function puffsAt(f: number): { x: number; y: number; size: number }[] {
  const out: { x: number; y: number; size: number }[] = []
  for (let born = FLIGHT[0] + 2; born < FLIGHT[1] - 6; born += 3) {
    const age = f - born
    if (age < 0 || age > 3) continue
    const r = rocketAt(born)
    if (!r) continue
    const [x, y] = tail(r)
    out.push({ x: Math.round(x), y: Math.round(y) - Math.floor(age / 2), size: age === 1 || age === 2 ? 1 : 0 })
  }
  return out
}
function render(): Int32Array[] {
  const frames: Int32Array[] = []
  const hole = place(ROCKETS[0], HOME[0], HOME[1])
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const { pen, laid, fold: k } = BEATS[f] ?? { pen: { x: 0, y: 0, h: 0 }, laid: [], fold: 1 }
    const rocket = rocketAt(f)
    const edge = HINGE + PAGE_W * k
    const isTurned = k <= 0

    const ink = new Uint8Array(W * H)
    DOODLES.forEach((strokes, n) => {
      if (n === 2 && f > DRAWN) return
      strokes.flat().slice(0, laid[n] ?? 0).forEach(([x, y]) => (ink[y * W + x] = 1))
    })
    const isHoled = f >= FLIGHT[0] && !isTurned
    const dark = new Float32Array(W * H)
    const throwX = 0.55
    const throwY = 0.7
    const sx = PEN_X + 0.75 * throwX
    const sy = PEN_Y + 0.75 * throwY
    const sl = Math.hypot(sx, sy)
    const ox = pen.x + pen.h * throwX
    const oy = pen.y + pen.h * throwY
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = x - ox
        const dy = y - oy
        const s = (dx * sx + dy * sy) / sl
        const d = (-dx * sy + dy * sx) / sl
        if (s > -0.5 && s < 16 * sl && Math.abs(d) < (s < 2 ? 0.7 : 1.4)) dark[y * W + x] = 1.1
      }
    }
    if (rocket?.isFree) {
      const dx = Math.round(rocket.h * throwX)
      const dy = Math.round(rocket.h * throwY)
      for (const i of place(ROCKETS[rocket.turn], rocket.x + dx, rocket.y + dy).keys()) dark[i] = Math.max(dark[i] ?? 0, 1.1)
    }
    const paper = (u: number, y: number, level: number, isTop: boolean): number => {
      if (isTop && ink[y * W + u]) return shade(INK, level * 0.75, u, y)
      if (isHole(u, y)) return shade(COVER, 0.5)
      if (u === MARGIN_X) return shade(MARGIN, level, u, y)
      if (NOTES.has(y * W + u) && u < W) return shade(LEAD, level + 1.5, u, y)
      if (y % 4 === 3) return shade(RULE, level, u, y)
      return shade(PAPER, level, u, y)
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x
        let level = lamp(x, y) - (dark[i] ?? 0)
        if (x < 2) {
          c.set(x, y, shade(COVER, 1.4 + level * 0.3 - (y % 4 === 0 ? 0.6 : 0)))
          continue
        }
        let u = x
        let isTop = !isTurned
        if (isTop && k < 1 && x >= HINGE) {
          if (x > edge) {
            isTop = false
            const lift = PAGE_W * Math.sin(Math.acos(k)) * 0.2
            if (x - edge < lift) level -= x - edge < lift * 0.5 ? 1.4 : 0.8
          } else if (k >= CURL) {
            const bend = edge - BEND
            if (x > bend) {
              u = Math.round(bend + ((x - bend) * (HINGE + PAGE_W - bend)) / BEND)
              level -= ((x - bend) / BEND) * 0.9
            }
            if (x === Math.round(edge)) level += 1.6
          } else {
            u = Math.round(HINGE + (x - HINGE) / Math.max(k, 0.02))
            level -= (1 - k) * 2.2
            if (x === Math.round(edge)) level += 1.6
          }
        }
        if (isTop && isHoled && u < W && hole.has(y * W + u)) {
          isTop = false
          level -= hole.has(y * W + u - 1) && hole.has((y - 1) * W + u) ? 1.2 : 2
        }
        c.set(x, y, paper(u, y, level, isTop))
      }
    }
    for (let y0 = 1; y0 < H; y0 += 4) {
      const lit = lamp(2, y0)
      c.set(0, y0 + 2, shade(WIRE, 0.5 + lit * 0.3))
      c.set(1, y0 + 1, shade(WIRE, 1.6 + lit * 0.4))
      c.set(2, y0 + 1, shade(WIRE, 2.4 + lit * 0.5))
      c.set(3, y0, shade(WIRE, 3 + lit * 0.5))
      c.set(2, y0, shade(WIRE, 2.6 + lit * 0.5))
      c.set(4, y0, shade(WIRE, 1 + lit * 0.3))
    }
    if (rocket) {
      const before = rocketAt(f - 1)
      const step = before?.isFree ? Math.hypot(before.x - rocket.x, before.y - rocket.y) : 0
      if (before && step > 3) {
        const a = (rocket.turn * Math.PI) / 4
        for (const fin of [-4.3, 4.3]) {
          const fx = rocket.x + fin * Math.cos(a) - 6 * Math.sin(a)
          const fy = rocket.y + fin * Math.sin(a) + 6 * Math.cos(a)
          const len = Math.min(step, 8)
          for (let i = 1.5; i < len; i++) {
            const x = Math.round(fx + ((before.x - rocket.x) / step) * i)
            const y = Math.round(fy + ((before.y - rocket.y) / step) * i)
            if (x >= 0 && x < W && y >= 0 && y < H) c.set(x, y, shade(PAPER, lamp(x, y) + (i < len / 2 ? 1.6 : 1), x, y))
          }
        }
      }
      for (const p of puffsAt(f)) {
        for (const [i, m] of place(PUFFS[p.size], p.x, p.y)) {
          const x = i % W
          const y = Math.floor(i / W)
          c.set(x, y, m === 'edge' ? shade(INK, 3, x, y) : shade(PAPER, lamp(x, y) + 0.6, x, y))
        }
      }
      const body = place(ROCKETS[rocket.turn], rocket.x, rocket.y)
      const flame = rocket.flame ? place(FLAMES[rocket.flame - 1]?.[rocket.turn], rocket.x, rocket.y) : new Map<number, Mark>()
      for (const [i, m] of [...flame, ...body]) {
        const x = i % W
        const y = Math.floor(i / W)
        const level = rocket.isFree ? lamp(x, y) + 0.6 : lamp(x, y) - (dark[i] ?? 0)
        if (m === 'fill') {
          if (rocket.isFree) c.set(x, y, shade(PAPER, level, x, y))
          continue
        }
        c.set(x, y, shade(INK, level * 0.75, x, y))
      }
    }
    const ax = PEN_X
    const ay = PEN_Y
    if (pen.from) {
      const [fx, fy] = pen.from
      for (const s of [2, 9, 16, 23]) {
        const [x0, y0] = [fx + ax * s, fy + ay * s]
        const [x1, y1] = [pen.x + ax * s, pen.y + ay * s]
        const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0))
        for (let i = Math.round(n * 0.3); i < n - 1; i++) {
          const x = Math.round(lerp(x0, x1, i / n))
          const y = Math.round(lerp(y0, y1, i / n))
          if (x >= 0 && x < W && y >= 0 && y < H) c.set(x, y, shade(RULE, i / n < 0.6 ? 3.6 : 2.4))
        }
      }
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = x - pen.x
        const dy = y - pen.y
        const s = dx * ax + dy * ay
        const d = -dx * ay + dy * ax
        if (s < -0.2 || s > 25) continue
        const half = s < 0.5 ? 0.4 : s < 3.5 ? 0.4 + (s - 0.5) * 0.3 : s > 24.2 ? 0.8 : 1.3
        if (Math.abs(d) > half) continue
        const side = d < -0.3 ? 2 : d > 0.3 ? 0 : 1
        let color: number
        if (s < 0.5) color = STEEL[1] ?? 0
        else if (s < 3.5) color = STEEL[side + 1] ?? 0
        else if (s < 21) color = side === 1 ? (s < 5 ? BARREL[1] ?? 0 : INK[3] ?? 0) : (BARREL[side] ?? 0)
        else color = PLUG[side] ?? 0
        c.set(x, y, color)
      }
    }
    frames.push(c.px)
  }
  return frames
}
type Box = readonly [x0: number, y0: number, x1: number, y1: number]
const bound = (pts: readonly Pt[]): Box => [
  Math.max(0, Math.min(...pts.map(p => p[0]))),
  Math.max(0, Math.min(...pts.map(p => p[1]))),
  Math.min(W - 1, Math.max(...pts.map(p => p[0]))),
  Math.min(H - 1, Math.max(...pts.map(p => p[1]))),
]

function rocketReach(f: number): Pt[] {
  const r = rocketAt(f)
  if (!r) return []
  const out: Pt[] = []
  const [dx, dy] = [Math.round(r.h * 0.55), Math.round(r.h * 0.7)]
  for (const [ox, oy] of [[0, 0], [dx, dy]] as const) {
    for (const shape of [ROCKETS[r.turn], FLAMES[1]?.[r.turn]]) {
      for (const k of (shape ?? new Map()).keys()) {
        const [x, y] = unkey(k)
        out.push([r.x + ox + x, r.y + oy + y])
      }
    }
  }
  for (const p of puffsAt(f)) out.push([p.x - 2, p.y - 2], [p.x + 2, p.y + 2])
  const before = rocketAt(f - 1)
  if (before) out.push([before.x - 6, before.y - 6], [before.x + 6, before.y + 6])
  return out.filter(([x, y]) => x >= 0 && x < W && y >= 0 && y < H)
}
const DASH = Array.from({ length: FLIGHT[1] - FLIGHT[0] }, (_, n) => FLIGHT[0] + n).filter(f => {
  const [a, b] = [rocketAt(f - 1), rocketAt(f)]
  return a && b && Math.hypot(a.x - b.x, a.y - b.y) > 2.5
})
const FLICK = BEATS.findIndex(b => b.pen.from)
function flickReach(f: number): number {
  const { pen, fold } = BEATS[f] ?? { pen: { x: 0, y: 0, h: 0 }, fold: 0 }
  const page = fold > 0 && fold < 1 ? HINGE + PAGE_W * fold + PAGE_W * Math.sin(Math.acos(fold)) * 0.2 : HINGE
  return Math.max(page, pen.x + 25, (pen.from?.[0] ?? 0) + 25)
}
const snaps = [
  ...DASH.map(f => ({
    frames: f,
    box: bound([...rocketReach(f - 1), ...rocketReach(f)]),
    why: 'the rocket zooms round its loop and off the page, too fast to follow, trailing puffs and speed lines',
  })),
  ...[0, 1, 2, 3].map(n => FLICK + n).map(f => ({
    frames: f,
    box: [2, 0, Math.min(W - 1, Math.ceil(Math.max(flickReach(f - 1), flickReach(f)))), H - 1] as Box,
    why: 'the pen flicks the page over: it flops past the binding in four frames, the pen swinging back to the margin with streaks behind it',
  })),
]
export const scene: Scene = { verb: 'Doodling', render, hero: FLIGHT[0] + 7, snaps }