import { Canvas, beat, clamp, frames, hash, hex, lerp, mix, particles, shade, smoothstep, type Scene } from '../engine'

const W = 64
const LOOP = 96

const WALL = hex('13141d 1b1d29 242737 2f3345 3c4155 4b5065')
const SUN = hex('3c4155 5b5763 806f6c a68a76 c8a581 e3c293 f3dcae')
const FLOOR = hex('0d0a0d 171114 241a1b 342421 472f26 5c3c2c')
const BEECH = hex('22150f 3b2417 5a3920 7d522c 9f6f3c bf8f55 d9ae74')
const PAPER = hex('2a282d 48434a 736c6b 9f978c c7bdab e5dac5 f8f1e0')
const CHAR = hex('0c0b10 1a1820 2c2932 4f4b56')
const COBALT = hex('090c24 101843 1a2a6c 284199 4163c2 7c9de2 cadbf7')
const RED = hex('240a10 47101a 741a20 a2281f c94329 e56c3f f39a66 fbd0a0')
const VELVET = hex('060e0c 0a1a14 10271c 173723 204b2b 2d6334 41803f')
const METAL = hex('1b1a21 3e3b47 7f7787 b1a7b2 e6dcd8')
const RAG = hex('2a2730 4a4550 77707a 9d96a0')

const rampOf = new Map<number, readonly number[]>(
  [WALL, SUN, FLOOR, BEECH, PAPER, CHAR, COBALT, RED, VELVET, METAL, RAG].flatMap(r => r.map(col => [col, r] as [number, readonly number[]])),
)
const DIM = [0x39363d, 0x928d8c, 0xa9a199, 0xb4afa9, 0xc3bcb3]
function glaze(col: number, over: number, t: number): number {
  const m = mix(col, over, t)
  const d = (a: number) => Math.abs(((a >> 16) & 255) - ((m >> 16) & 255)) + Math.abs(((a >> 8) & 255) - ((m >> 8) & 255)) + Math.abs((a & 255) - (m & 255))
  return [...(rampOf.get(col) ?? []), ...DIM].reduce((best, k) => (d(k) < d(best) ? k : best))
}

type Pt = readonly [number, number]

function profile(v: number): number {
  const keys: Pt[] = [[0, 2.6], [0.1, 1.7], [0.28, 1.9], [0.45, 4.3], [0.62, 5.6], [0.8, 5.0], [0.93, 3.6], [1, 3.4]]
  for (let i = 0; i + 1 < keys.length; i++) {
    const [v0, w0] = keys[i] ?? [0, 0]
    const [v1, w1] = keys[i + 1] ?? [1, 0]
    if (v <= v1) return lerp(w0, w1, smoothstep(v0, v1, v))
  }

  return 3.4
}

const LIFE = { cx: 13, top: 7, h: 12, s: 0.7 }
const inLifeVase = (x: number, y: number) =>
  y >= LIFE.top && y <= LIFE.top + LIFE.h && Math.abs(x - LIFE.cx) <= profile((y - LIFE.top) / LIFE.h) * LIFE.s + 0.3
const LIFE_APPLE = { cx: 20.4, cy: 17.9, rx: 2.4, ry: 2.2 }
const inLifeApple = (x: number, y: number) => ((x - LIFE_APPLE.cx) / LIFE_APPLE.rx) ** 2 + ((y - LIFE_APPLE.cy) / LIFE_APPLE.ry) ** 2 <= 1

const SHEET = { x0: 33, x1: 58, y0: 3, y1: 24 }
const DRAW = { cx: 41, top: 6, h: 15 }
const BOTTOM = DRAW.top + DRAW.h
const APPLE = { cx: 51, cy: 18.5, rx: 3.3, ry: 3 }
const edge = (y: number, dir: number) => Math.round(DRAW.cx + dir * profile((y - DRAW.top) / DRAW.h))
const inApple = (x: number, y: number) => ((x - APPLE.cx) / APPLE.rx) ** 2 + ((y - APPLE.cy) / APPLE.ry) ** 2 <= 1

function side(dir: number): Pt[] {
  const pts: Pt[] = []
  for (let y = DRAW.top + 1; y <= BOTTOM; y++) {
    const e0 = edge(y, dir)
    const e1 = y < BOTTOM ? edge(y + 1, dir) : e0
    const step = Math.sign(e1 - e0)
    for (let x = e0; ; x += step) {
      pts.push([x, y])
      if (step === 0 || Math.abs(e1 - x) <= 1) break
    }
  }

  return pts
}

const CONTOUR: Pt[][] = (() => {
  const { cx, top } = DRAW
  const lip: Pt[] = [[cx - 3, top], [cx - 2, top - 1], [cx - 1, top - 1], [cx, top - 1], [cx + 1, top - 1], [cx + 2, top - 1],
    [cx + 3, top], [cx + 2, top + 1], [cx + 1, top + 1], [cx, top + 1], [cx - 1, top + 1], [cx - 2, top + 1]]
  const foot: Pt[] = []
  for (let x = edge(BOTTOM, -1) + 1; x < edge(BOTTOM, 1); x++) foot.push([x, BOTTOM])
  const ring: Pt[] = []
  for (let y = 14; y <= 23; y++) {
    for (let x = 46; x <= 56; x++) {
      if (!inApple(x, y)) continue
      if (inApple(x - 1, y) && inApple(x + 1, y) && inApple(x, y - 1) && inApple(x, y + 1)) continue
      ring.push([x, y])
    }
  }
  const angle = ([x, y]: Pt) => (Math.atan2(x - APPLE.cx, APPLE.cy - y) + Math.PI * 2.1) % (Math.PI * 2)
  ring.sort((a, b) => angle(a) - angle(b))
  const stem: Pt[] = [[51, 15], [52, 14], [52, 13]]

  return [lip, side(-1), foot, side(1).reverse(), ring, stem]
})()

type Region = 'form' | 'core' | 'cast'

const SHADOWS: ReadonlyMap<number, Region> = (() => {
  const out = new Map<number, Region>()
  for (let y = DRAW.top + 2; y < BOTTOM; y++) {
    const half = profile((y - DRAW.top) / DRAW.h)
    for (let x = edge(y, -1) + 1; x < edge(y, 1); x++) {
      const u = (x - DRAW.cx) / half
      if (u >= 0.5) out.set(y * W + x, 'core')
      else if (u >= 0.05) out.set(y * W + x, 'form')
    }
  }
  for (let y = 16; y <= 21; y++) {
    for (let x = 47; x <= 55; x++) {
      if (!inApple(x, y) || !inApple(x - 1, y) || !inApple(x + 1, y) || !inApple(x, y - 1) || !inApple(x, y + 1)) continue
      const u = (x - APPLE.cx) / APPLE.rx
      const v = (y - APPLE.cy) / APPLE.ry
      if (u >= 0.4) out.set(y * W + x, 'core')
      else if (u + v * 0.6 >= -0.15) out.set(y * W + x, 'form')
    }
  }
  for (const [x0, x1, y] of [[45, 47, 20], [44, 48, 21], [55, 56, 20], [55, 57, 21]] as const) {
    for (let x = x0; x <= x1; x++) if (!out.has(y * W + x)) out.set(y * W + x, 'cast')
  }

  return out
})()

const HATCH: Pt[][] = (() => {
  const lines = new Map<string, Pt[]>()
  for (const [key, region] of SHADOWS) {
    const x = key % W
    const y = Math.floor(key / W)
    const isApple = x >= 47 && x <= 55 && y >= 16
    const group = isApple ? 'a' : region === 'cast' ? 'c' : 'v'
    if ((x + y) % 3 === 0) {
      const id = `${group}/${x + y}`
      lines.set(id, [...(lines.get(id) ?? []), [x, y]])
    }
    if (region === 'core' && (x - y + 99) % 3 === 0) {
      const id = `${group}\\${x - y}`
      lines.set(id, [...(lines.get(id) ?? []), [x, y]])
    }
  }
  const order = (id: string) => ({ v: 0, a: 1000, c: 2000 })[id[0] as 'v' | 'a' | 'c'] + (id[1] === '/' ? 0 : 500) + Number(id.slice(2))

  return [...lines.entries()]
    .sort((a, b) => order(a[0]) - order(b[0]))
    .map(([id, pts]) => [...pts].sort((a, b) => (id[1] === '/' ? b[1] - a[1] : a[1] - b[1])))
})()

const HATCH_LEVEL = new Map<number, number>()
for (const stroke of HATCH) {
  for (const [x, y] of stroke) {
    const k = y * W + x
    HATCH_LEVEL.set(k, Math.min(HATCH_LEVEL.get(k) ?? 9, SHADOWS.get(k) === 'core' ? 2 : 3))
  }
}

type Mark = { x: number; y: number; t: number }
type Tip = { x: number; y: number; lift: number; pose?: Pose }
type Pose = 'stand' | 'lean' | 'low' | 'lie'

function route(strokes: Pt[][], start: number, end: number, slow: readonly number[] = []): { marks: Mark[]; at: (f: number) => Tip } {
  const nodes: { x: number; y: number; d: number; isHop: boolean }[] = []
  let d = 0
  strokes.forEach((stroke, s) => {
    stroke.forEach(([x, y], i) => {
      const last = nodes[nodes.length - 1]
      const gap = last ? Math.hypot(x - last.x, y - last.y) : 0
      d += i === 0 ? gap : gap * (slow[s] ?? 1)
      nodes.push({ x, y, d, isHop: i === 0 && gap > 1.5 })
    })
  })
  const per = (end - start) / Math.max(1, d)
  const marks = nodes.map(n => ({ x: n.x, y: n.y, t: start + n.d * per }))
  const at = (f: number): Tip => {
    const u = clamp((f - start) / (end - start)) * d
    let i = 1
    while (i < nodes.length - 1 && (nodes[i]?.d ?? 0) < u) i++
    const a = nodes[i - 1] ?? nodes[0] ?? { x: 0, y: 0, d: 0 }
    const b = nodes[i] ?? a
    const p = b.d > a.d ? clamp((u - a.d) / (b.d - a.d)) : 1
    const hop = (nodes[i]?.isHop ?? false) && p < 1 ? Math.sin(p * Math.PI) * 1.5 + 0.5 : 0
    return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), lift: Math.round(hop) }
  }
  return { marks, at }
}
const T = { contour: [2, 30], hatch: [35, 48], rub: [49, 64], rest: 72, lie: 74, flip: [74, 92], rise: 82, stand: 84 } as const
const CONTOUR_ROUTE = route(CONTOUR, T.contour[0], T.contour[1], [1, 1, 1, 1, 1.6, 1.6])

const HATCH_ORDER: Pt[][] = (() => {
  const left = [...HATCH]
  const out: Pt[][] = []
  let at: Pt = [DRAW.cx + 1, DRAW.top + 3]
  while (left.length > 0) {
    let best = 0
    let isBack = false
    let near = Infinity
    left.forEach((s, i) => {
      const head = s[0] ?? at
      const tail = s[s.length - 1] ?? at
      const dHead = Math.hypot(head[0] - at[0], head[1] - at[1])
      const dTail = Math.hypot(tail[0] - at[0], tail[1] - at[1])
      if (Math.min(dHead, dTail) < near) [near, best, isBack] = [Math.min(dHead, dTail), i, dTail < dHead]
    })
    const [s] = left.splice(best, 1)
    const stroke = isBack ? [...(s ?? [])].reverse() : (s ?? [])
    out.push(stroke)
    at = stroke[stroke.length - 1] ?? at
  }
  return out
})()
const HATCH_ROUTE = route(HATCH_ORDER, T.hatch[0], T.hatch[1])
const LINES = CONTOUR_ROUTE.marks
const HATCHES = HATCH_ROUTE.marks
const RUB_PATH: Pt[] = (() => {
  const pts: Pt[] = [[56, 20.5], [53, 20], [53, 18.5], [51, 17], [46, 20.5]]
  for (let y = 19; y >= 9; y--) pts.push([(DRAW.cx + edge(y, 1)) / 2 + 1, y])

  return pts
})()
const RUB = route([RUB_PATH], T.rub[0], T.rub[1])

const SMUDGE_TIME: ReadonlyMap<number, number> = (() => {
  const out = new Map<number, number>()
  for (const key of SHADOWS.keys()) {
    const x = key % W
    const y = Math.floor(key / W)
    let best = Infinity
    for (let g = T.rub[0]; g <= T.rub[1]; g += 0.25) {
      const tip = RUB.at(g)
      const dist = Math.hypot(tip.x - x, (tip.y - y) * 1.3)
      if (dist < best - 0.01) {
        best = dist
        out.set(key, g)
      }
    }
  }
  return out
})()
const START: Tip = { x: DRAW.cx - 3, y: DRAW.top, lift: 2 }
const REST: Tip = { x: 37, y: 25, lift: 0 }
function travel(a: Tip, b: Tip, p: number): Tip {
  const e = smoothstep(0, 1, p)
  return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e) - Math.sin(e * Math.PI) * 2, lift: Math.round(lerp(a.lift, b.lift, e)) }
}
function rub(g: number): Tip {
  const a = -((g - T.rub[0]) / 5 + 0.25) * Math.PI * 2
  const at = RUB.at(g)
  return { x: at.x + Math.sin(a), y: at.y - Math.cos(a) * 0.85, lift: 0 }
}
function hatching(f: number): Tip {
  let x = 0
  let y = 0
  for (let k = -2; k <= 2; k++) {
    const at = HATCH_ROUTE.at(f + k / 2)
    x += at.x / 5
    y += at.y / 5
  }
  return { x, y, lift: 0 }
}
function tipAt(f: number): Tip {
  if (f < T.contour[0]) return { ...START, lift: 2 - f }
  if (f <= T.contour[1]) return CONTOUR_ROUTE.at(f)
  const lastLine = CONTOUR_ROUTE.at(T.contour[1])
  if (f < T.hatch[0]) return travel(lastLine, hatching(T.hatch[0]), beat(f, T.contour[1], T.hatch[0]))
  if (f <= T.hatch[1]) return hatching(f)
  if (f < T.rub[0]) return travel(hatching(T.hatch[1]), rub(T.rub[0]), beat(f, T.hatch[1], T.rub[0]))
  if (f <= T.rub[1]) return rub(f)
  if (f <= T.rest) return travel(rub(T.rub[1]), REST, beat(f, T.rub[1] - 1, T.rest))
  if (f < T.lie) return { ...REST, pose: 'lean' }
  if (f === T.lie) return { ...REST, pose: 'low' }
  if (f < T.rise) return { ...REST, pose: 'lie' }
  if (f === T.rise) return { ...REST, pose: 'low' }
  if (f < T.stand) return { ...REST, pose: 'lean' }
  return travel(REST, START, beat(f, T.stand, LOOP))
}
function sunlit(x: number, y: number): number {
  if (y < 3 || y > 15) return 0
  const xl = 2 + (y - 3) * 0.5
  if (x < xl || x > xl + 17) return 0
  const u = Math.round(x - xl)
  if (u === 9 || y === 9) return 0

  if (inLifeVase(x - 5, y - 2)) return 0
  return u === 0 || u === 17 || y === 3 || y === 15 ? 0.5 : 1
}
function drawRoom(c: Canvas, f: number): void {
  for (let y = 0; y < 25; y++) {
    for (let x = 0; x < W; x++) {
      const near = clamp(1 - Math.hypot(x - 12, (y - 10) * 1.3) / 48)
      const easelShadow = x >= 60 && y >= 4 ? 1 : 0
      const wall = shade(WALL, 1.8 + near * 2.2 - easelShadow, x, y)
      const sun = sunlit(x, y)
      c.set(x, y, sun === 0 ? wall : shade(SUN, sun === 1 ? 4.6 : 3.2, x, y))
    }
  }
  for (const p of particles(f, LOOP, 7, 54, 3)) {
    const x = Math.round(3 + p.r[1] * 20 + p.age * 4)
    const y = Math.round(3 + p.r[2] * 12 + p.age * 3 + Math.sin(p.age * 6 + p.r[3] * 6))
    if (sunlit(x, y) === 1 && p.age > 0.1 && p.age < 0.9) c.set(x, y, SUN[6] ?? 0)
  }
  for (let x = 0; x < W; x++) c.set(x, 25, WALL[1] ?? 0)
  for (let y = 26; y < 32; y++) {
    const row = y < 28 ? 0 : y < 30 ? 1 : 2
    const seamX = Math.floor(hash(row, 7) * 20) + row * 9
    for (let x = 0; x < W; x++) {
      const isSeam = y === 28 || y === 30 || (x - seamX) % 23 === 0
      const pool = x < 14 - (y - 26) && y > 26 ? 1 : 0
      c.set(x, y, shade(FLOOR, 1.6 + (y - 26) * 0.35 + pool - (isSeam ? 1 : 0), x, y))
    }
  }
}
function drawStillLife(c: Canvas): void {
  for (let y = 20; y <= 26; y++) {
    const spread = y <= 21 ? 0 : (y - 21) * 0.3
    const x0 = Math.round(6 - spread)
    const x1 = Math.round(24 + spread)
    for (let x = x0; x <= x1; x++) {
      if (y === 20 && (x === x0 || x === x1)) continue
      let level: number
      if (y <= 21) {
        level = (y === 20 ? 5 : 4) - (x - 6) * 0.08
        if (y === 20 && x >= 16 && x <= 17) level -= 2
        if (y === 20 && x >= 23 && x <= 24) level -= 1.6
      } else {
        const fold = Math.sin((x - 4) * 1.05)
        level = 2.6 + fold * 0.9 - (x - 6) * 0.05 - (y - 22) * 0.18 - (y === 22 ? 0.8 : 0)
        if (y === 26 && fold < -0.6) continue
      }
      c.set(x, y, shade(VELVET, level, x, y))
    }
  }
  for (let x = 6; x <= 24; x++) c.set(x, 27, FLOOR[0] ?? 0)
  for (let y = LIFE.top; y <= LIFE.top + LIFE.h; y++) {
    const v = (y - LIFE.top) / LIFE.h
    const half = profile(v) * LIFE.s + 0.3
    for (let x = Math.floor(LIFE.cx - half); x <= Math.ceil(LIFE.cx + half); x++) {
      if (!inLifeVase(x, y)) continue
      const u = (x - LIFE.cx) / half
      let level = 4.6 - (u + 1) * 1.9
      if (x === LIFE.cx - 2 && v > 0.45 && v < 0.85) level = 6
      if (u > 0.7 && v > 0.5) level += 0.9
      if (y === LIFE.top) level = x === LIFE.cx + 1 ? 1 : 3.6
      c.set(x, y, shade(COBALT, level, x, y))
    }
  }
  for (let y = 15; y <= 20; y++) {
    for (let x = 17; x <= 23; x++) {
      if (!inLifeApple(x, y)) continue
      const nx = (x - LIFE_APPLE.cx) / LIFE_APPLE.rx
      const ny = (y - LIFE_APPLE.cy) / LIFE_APPLE.ry
      const level = 4.2 - nx * 1.8 - ny * 1.1 + (x === 19 && y === 17 ? 2.5 : 0)
      c.set(x, y, shade(RED, level, x, y))
    }
  }
  c.set(21, 15, BEECH[1] ?? 0)
}
function drawEasel(c: Canvas): void {
  const leg = (x0: number, x1: number, lit: number) => {
    for (let y = 0; y < 32; y++) {
      const x = Math.round(lerp(x0, x1, y / 31))
      c.set(x, y, shade(BEECH, lit + 1, x, y))
      c.set(x + 1, y, shade(BEECH, lit, x + 1, y))
    }
    const foot = Math.round(x1)
    c.set(foot + 2, 31, FLOOR[0] ?? 0)
    c.set(foot + 3, 31, FLOOR[1] ?? 0)
  }
  for (let y = 0; y < 32; y++) c.set(46, y, BEECH[1] ?? 0)
  leg(35, 31, 3)
  leg(56, 61, 2.6)
  for (let y = 2; y <= 25; y++) {
    for (let x = 32; x <= 59; x++) {
      const level = y === 2 ? 4.4 : x === 32 ? 3.6 : x === 59 ? 1.8 : 2.6
      c.set(x, y, shade(BEECH, level, x, y))
    }
  }

  for (let x = 30; x <= 61; x++) {
    c.set(x, 26, shade(BEECH, x < 34 ? 5 : 4, x, 26))
    c.set(x, 27, shade(BEECH, 1.6, x, 27))
  }
  c.sprite(51, 24, ['.ab.', 'abcb'], { a: RAG[1] ?? 0, b: RAG[2] ?? 0, c: RAG[3] ?? 0 })
}
function glide(t: number): number {
  const r = 0.25
  const s = t < r ? (t * t) / (2 * r) : t <= 1 - r ? t - r / 2 : 1 - r - (1 - t) ** 2 / (2 * r)
  return s / (1 - r)
}

const paperLevel = (x: number, y: number) => (x + y > 70 ? 5 : 6)
function drawSheet(c: Canvas, f: number): void {
  const ink = new Map<number, number>()
  const put = (k: number, level: number) => ink.set(k, Math.min(ink.get(k) ?? 9, level))
  const isSmudged = (k: number) => f >= (SMUDGE_TIME.get(k) ?? Infinity)
  for (const m of LINES) if (m.t <= f) put(m.y * W + m.x, m.t > f - 0.6 ? 1 : 0)
  for (const m of HATCHES) {
    const k = m.y * W + m.x
    if (m.t <= f && !isSmudged(k)) put(k, HATCH_LEVEL.get(k) ?? 3)
  }
  for (const [k, region] of SHADOWS) if (isSmudged(k)) put(k, region === 'form' ? 4 : 3)
  const [flip0, flip1] = T.flip
  const roll = f < flip0 ? 99 : Math.round(lerp(SHEET.y1 + 2, 0, glide(beat(f, flip0, flip1))))
  const isFresh = f >= flip1 || f < T.contour[0]
  const corner = f >= flip0 - 6 && f < flip1 ? Math.min(3, Math.floor((f - flip0 + 6) / 2) + 1) : 0
  for (let y = SHEET.y0; y <= SHEET.y1; y++) {
    for (let x = SHEET.x0; x <= SHEET.x1; x++) {
      const base = paperLevel(x, y)
      let level = base
      if (!isFresh && y < roll - 1) level = Math.min(base, ink.get(y * W + x) ?? 9)
      if (y === roll + 2) level = base - 1.1
      const dog = SHEET.x1 - x + (SHEET.y1 - y)
      if (corner > 0 && y < roll - 1 && dog < corner) level = 4
      if (corner > 0 && y < roll - 1 && dog === corner) level = 2.6
      c.set(x, y, shade(PAPER, level, x, y))
    }
  }
  c.sprite(44, 2, ['abc', '.a.'], { a: METAL[2] ?? 0, b: METAL[4] ?? 0, c: METAL[1] ?? 0 })
  if (roll < 99) {
    for (const [dy, level] of [[-1, 5.4], [0, 4.2], [1, 3.2]] as const) {
      const y = roll + dy
      if (y < SHEET.y0 || y > SHEET.y1) continue
      const over = Math.max(0, SHEET.y0 + 1 - roll) * 1.2
      for (let x = SHEET.x0; x <= SHEET.x1; x++) c.set(x, y, shade(PAPER, level + over - (x > 52 ? 0.6 : 0), x, y))
    }
  }
}
const POSES: Record<Pose, string[]> = {
  stand: ['...ba', '..ca.', '..ca.', '.ca..', '.ca..', 'd....'],
  lean: ['....ba', '...ca.', '..ca..', '.ca...', 'd.....'],
  low: ['....ccb', '.ccaa..', 'daa....'],
  lie: ['dcaacab'],
}

const pixelsOf = (pose: Pose): Pt[] => {
  const art = POSES[pose]
  return art.flatMap((row, j) => [...row].flatMap((ch, i): Pt[] => (ch === '.' ? [] : [[i, j - art.length + 1]])))
}
function drawSmear(c: Canvas, from: Tip, to: Tip): void {
  if (from.pose || to.pose) return
  const x = Math.round(from.x)
  const y = Math.round(from.y) - from.lift
  const step = Math.hypot(x - Math.round(to.x), y - (Math.round(to.y) - to.lift))
  if (step < 2) return
  for (const [dx, dy] of pixelsOf('stand')) c.set(x + dx, y + dy, glaze(c.get(x + dx, y + dy), CHAR[3] ?? 0, 0.4))
}
function drawCharcoal(c: Canvas, tip: Tip): void {
  const x = Math.round(tip.x)
  const y = Math.round(tip.y) - tip.lift
  const pose = tip.pose ?? 'stand'
  const fall = 1 + tip.lift
  for (const [dx, dy] of pixelsOf(pose)) {
    const sx = x + dx + fall
    const sy = y + dy + fall
    const isOnSheet = sx >= SHEET.x0 && sx <= SHEET.x1 && sy >= SHEET.y0 && sy <= SHEET.y1
    if (isOnSheet) c.set(sx, sy, glaze(c.get(sx, sy), 0x3a3440, 0.28))
  }
  const art = POSES[pose]
  c.sprite(x, y - art.length + 1, art, { a: CHAR[1] ?? 0, b: CHAR[2] ?? 0, c: CHAR[3] ?? 0, d: CHAR[0] ?? 0 })
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    drawRoom(c, f)
    drawStillLife(c)
    drawEasel(c)
    drawSheet(c, f)
    drawSmear(c, tipAt((f + LOOP - 1) % LOOP), tipAt(f))
    drawCharcoal(c, tipAt(f))
  })
}
const dart = (frames: number, box: readonly [number, number, number, number], why: string) => ({
  frames,
  box,
  colors: [...CHAR, PAPER[1] ?? 0, ...DIM],
  why,
})

export const scene: Scene = {
  verb: 'Sketching',
  render,
  hero: 62,
  snaps: [
    dart(4, [46, 3, 48, 6], 'the charcoal whips round the end of the lip'),
    dart(10, [36, 16, 40, 20], 'the charcoal swings round the belly of the vase'),
    dart(17, [45, 6, 50, 13], 'the charcoal flicks up the neck to the lip, its smear behind it'),
    dart(33, [47, 5, 54, 11], 'the charcoal hops off the stem and over to the vase to start hatching'),
    dart(91, [38, 5, 44, 14], 'the charcoal is lifted quickly back to the top of the fresh sheet'),
  ],
}