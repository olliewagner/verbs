import { Canvas, beat, clamp, ease, hex, lerp, mod, particles, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const COOL = hex('0a0a18 111428 162236 1b3542 21504e 2c6c5c 3f8a6c')
const WARM = hex('0a0a18 111428 2a2030 503438 80503e b47448 e0a058 f8cf86 fff0c0')
const BENCH = hex('0c0a12 16121c 241a22 36242a 4c3230 6a4434 8c5c3c')
const METAL = hex('0c0d14 171a24 252a36 3a404e 565e6c 7e8794 b4bcc4')
const FLUID = hex('041614 082422 0c3430 124840 1a6050 267a5e 3a9870 5cb888 92dcac')
const BRAIN = hex('3a1028 5e1a3c 8a2a52 b84470 dc6a8e f096b0 fcc4d4 fff0f4')
const SPARK = hex('6a6ee0 4fd8ff a8f4ff ffffff')
const BULB = hex('2a2a36 4a4856 fff0c0 fffbe8')
const FILAMENT = 0xf0a040
const BOOKS = [hex('1a0e1a 3a1a2e 5e2a40 8a3e50'), hex('0e1420 1a2a44 2a4266 40608a'), hex('141a0e 263016 3c4a20 566a2c')]
const VIAL = hex('1e0e2a 3a1a4e 5e2c78 8a48a4 b878cc')

const JAR_X0 = 20
const JAR_X1 = 43
const FLUID_TOP = 11
const JAR_BOTTOM = 24
const BENCH_Y = 27

const EUREKA = 36

const e2 = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2

const GYRI: readonly (readonly [number, number])[][] = [
  [[23.5, 15.5], [24.5, 13.5], [27, 12], [30, 12]],
  [[32, 11.6], [35, 11.4], [38, 12.2], [40.2, 14]],
  [[23.2, 18.2], [25, 16.4], [27.6, 15.4], [29.4, 16.2]],
  [[31.6, 13.8], [31.2, 15.8], [32.2, 17.6]],
  [[34.2, 14.6], [36.4, 14.6], [38.6, 15.8], [41.2, 16.4]],
  [[34.6, 17.8], [37, 18.2], [39.2, 18.2]],
  [[24.8, 19.6], [27.4, 20.4], [30.4, 20.4], [33, 19.6]],
  [[27, 13.9], [28.4, 13.9]],
]
const GYRUS_R = 1.15

function nearestOnGyri(x: number, y: number): { d: number; dy: number } {
  let best = { d: 99, dy: 0 }
  for (const g of GYRI) {
    for (let i = 0; i + 1 < g.length; i++) {
      const [ax, ay] = g[i]!
      const [bx, by] = g[i + 1]!
      const t = clamp(((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2))
      const px = lerp(ax, bx, t)
      const py = lerp(ay, by, t)
      const d = Math.hypot(x - px, y - py)
      if (d < best.d) best = { d, dy: y - py }
    }
  }

  return best
}

const isCerebellum = (x: number, y: number) => e2(x, y, 38, 20.4, 3.3, 1.9) <= 1
const isStem = (x: number, y: number) => x >= 34 && x <= 35 && y >= 21 && y <= 24
const inFill = (x: number, y: number) => e2(x, y, 32, 15.9, 9.6, 5) <= 1 || e2(x, y, 29, 19.2, 5.8, 2) <= 1
const inGyrus = (x: number, y: number) => nearestOnGyri(x, y).d <= GYRUS_R
const inBrain = (x: number, y: number) => inFill(x, y) || inGyrus(x, y) || isCerebellum(x, y) || isStem(x, y)

type Cell = { isFold: boolean; isEdge: boolean; region: number; lit: number }

const CELLS: ReadonlyMap<number, Cell> = (() => {
  const cells = new Map<number, Cell>()
  for (let y = 8; y < 26; y++) {
    for (let x = 18; x < 46; x++) {
      if (!inBrain(x, y)) continue
      const isEdge = !inBrain(x - 1, y) || !inBrain(x + 1, y) || !inBrain(x, y - 1) || !inBrain(x, y + 1)
      const g = nearestOnGyri(x, y)
      const cb = isCerebellum(x, y) && !inGyrus(x, y)
      const isFold = !isEdge && !isStem(x, y) && (cb ? y % 2 === 1 : g.d > GYRUS_R)
      const region = isStem(x, y) ? 0 : cb ? 1 : y >= 19 && x < 34 ? 2 : x < 29 ? 3 : x < 35 ? 4 : 5
      const lit = g.dy < -0.35 ? 1 : g.dy > 0.45 ? -0.6 : 0
      cells.set(y * W + x, { isFold, isEdge, region, lit })
    }
  }

  return cells
})()

type Bolt = { at: number; frames: number; far: number; path: Map<number, number>; arrival: Map<number, number> }

function bolt(seed: readonly [number, number], at: number, frames: number, reachLimit = Infinity): Bolt {
  const start = seed[1] * W + seed[0]
  const dist = new Map<number, number>([[start, 0]])
  const prev = new Map<number, number>()
  const open = [start]
  while (open.length) {
    open.sort((a, b) => (dist.get(b) ?? 0) - (dist.get(a) ?? 0))
    const key = open.pop()!
    const d = dist.get(key) ?? 0
    const x = key % W
    const y = Math.floor(key / W)
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const next = (y + j) * W + x + i
        const cell = CELLS.get(next)
        if (!cell || next === key || cell.isEdge) continue
        const step = (cell.isFold ? 1 : 4) * (i && j ? 1.4 : 1)
        if (d + step < (dist.get(next) ?? Infinity)) {
          dist.set(next, d + step)
          prev.set(next, key)
          open.push(next)
        }
      }
    }
  }
  const targets = new Map<number, [number, number]>()
  for (const [key, d] of dist) {
    const cell = CELLS.get(key)
    if (!cell?.isFold || d > reachLimit) continue
    const best = targets.get(cell.region)
    if (!best || d > best[1]) targets.set(cell.region, [key, d])
  }
  const path = new Map<number, number>()
  for (const [key] of targets.values()) {
    for (let k: number | undefined = key; k !== undefined; k = prev.get(k)) path.set(k, dist.get(k) ?? 0)
  }
  const arrival = new Map<number, number>()
  for (const [key, d] of path) {
    const r = CELLS.get(key)?.region ?? 0
    arrival.set(r, Math.min(arrival.get(r) ?? Infinity, d))
  }
  return { at, frames, far: Math.max(...path.values()), path, arrival }
}

const BOLTS = [bolt([34, 22], 7, 12), bolt([24, 16], 18, 12)]
const IDLE_BOLTS = [bolt([27, 14], 2, 3, 9), bolt([37, 13], 50, 3, 9), bolt([30, 18], 57, 3, 9), bolt([39, 17], 63, 3, 9)]
const TRAIL = 12
const AFTERGLOW = 8
const head = (b: Bolt, f: number) =>
  (1 - (1 - beat(f, b.at, b.at + b.frames)) ** 1.6) * (b.far + TRAIL) + Math.max(0, f - b.at - b.frames) * (AFTERGLOW / 4)
const isLive = (b: Bolt, f: number) => f >= b.at && f <= b.at + b.frames + 4
function bulb(f: number): number {
  if (f < EUREKA) return 0
  if (f === EUREKA) return 0.9
  if (f === EUREKA + 1) return 0.2
  if (f === EUREKA + 2) return 1.15
  return (1 - beat(f, EUREKA + 6, 64)) ** 1.5
}
function activity(f: number): number {
  const ff = mod(f, LOOP)
  const spark = BOLTS.some(b => isLive(b, ff)) ? 0.7 : 0
  const flash = ff >= EUREKA ? Math.max(0, 1 - (ff - EUREKA) / 14) : 0
  const idle = IDLE_BOLTS.some(b => isLive(b, ff)) ? 0.3 : ff > 31 && ff < EUREKA ? 0 : 0.08
  return Math.max(spark, flash, idle)
}
function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const b = bulb(f)
    const act = (activity(f) + activity(f - 1) + activity(f - 2)) / 3
    const glow = 0.5 + act * 0.55 + (f >= EUREKA && f <= EUREKA + 2 ? 0.5 : f > EUREKA + 2 ? 0.5 * Math.max(0, 1 - (f - EUREKA - 2) / 7) : 0)
    const jarLight = (x: number, y: number) => glow * Math.max(0, 1 - Math.hypot(x - 32, (y - 18) * 1.2) / 32) ** 1.4
    const bulbLight = (x: number, y: number) => b * Math.max(0, 1 - Math.hypot(x - 32, (y - 4) * 1.1) / 52) ** 1.2
    const surface = (x: number, y: number, base: number, gain = 6) => {
      const j = jarLight(x, y)
      const w = bulbLight(x, y)
      return w > j ? shade(WARM, base + (w + j * 0.4) * gain * 1.2) : shade(COOL, base + (j + w * 0.4) * gain)
    }
    for (let y = 0; y < BENCH_Y; y++) {
      for (let x = 0; x < W; x++) {
        const rail = y === 19 ? 0.6 : y === 20 ? -0.4 : 0
        const panel = y > 20 && mod(x, 12) === 0 ? -0.5 : 0
        c.set(x, y, surface(x, y, 1.2 + rail + panel))
      }
    }
    for (let x = 1; x < 16; x++) {
      c.set(x, 11, surface(x, 11, 2.2, 7))
      c.set(x, 12, surface(x, 12, 0.8, 3))
    }
    for (const [fx, fw, fh] of [[3, 3, 5], [8, 2, 4], [12, 3, 3]] as const) {
      for (let y = 11 - fh; y < 11; y++) {
        for (let x = fx; x < fx + fw; x++) {
          if (y < 11 - fh + 2 && x !== fx + Math.floor(fw / 2)) continue
          c.set(x, y, x === fx + fw - 1 ? surface(x, y, 2.6, 8) : surface(x, y, 1.4, 4))
        }
      }
    }
    c.set(32, 0, shade(METAL, 2))
    c.set(31, 1, shade(METAL, 3.4))
    c.set(32, 1, shade(METAL, 2.4))
    const lit = b > 0.5 ? BULB[3]! : b > 0.15 ? BULB[2]! : undefined
    for (const [x, y] of [[31, 2], [32, 2], [30, 3], [31, 3], [32, 3], [33, 3], [30, 4], [31, 4], [32, 4], [33, 4], [31, 5], [32, 5]] as const) {
      c.set(x, y, lit ?? shade(BULB, y === 5 || x === 33 ? 0 : 1))
    }
    if (!lit) {
      c.set(31, 4, b > 0 ? FILAMENT : shade(METAL, 2.6))
      c.set(32, 4, b > 0 ? FILAMENT : shade(METAL, 2.6))
    }
    if (b > 0.3) {
      for (let y = 0; y < 10; y++) {
        for (let x = 22; x < 42; x++) {
          const d = Math.hypot(x - 31.5, (y - 3.5) * 1.1)
          if (d < 2.6 || d > 8 * b) continue
          c.set(x, y, shade(WARM, 8.4 - (d - 2.6) * 0.55 * (1.4 - b * 0.4)))
        }
      }
    }
    for (let x = 0; x < W; x++) {
      c.set(x, BENCH_Y, surface(x, BENCH_Y, 3, 6))
      for (let y = BENCH_Y + 1; y < H; y++) {
        const j = jarLight(x, y) * 3 + bulbLight(x, y) * 3
        c.set(x, y, shade(BENCH, 1.4 + j - (y === BENCH_Y + 1 ? 0.8 : 0)))
      }
    }
    for (const [k, [y0, x0, w]] of ([[25, 2, 9], [23, 3, 8], [21, 2, 7]] as const).entries()) {
      const ramp = BOOKS[k % 3]!
      for (let y = y0; y < y0 + 2; y++) {
        for (let x = x0; x < x0 + w; x++) {
          const isPages = y === y0 && x === x0 + w - 1
          const j = jarLight(x, y) * 4 + bulbLight(x, y) * 4
          c.set(x, y, isPages ? surface(x, y, 3, 6) : shade(ramp, 1 + j + (y === y0 ? 0.6 : 0)))
        }
      }
    }
    for (let y = 21; y < BENCH_Y; y++) {
      for (let x = 13; x < 16; x++) {
        const j = jarLight(x, y) * 3 + bulbLight(x, y) * 3
        c.set(x, y, y < 23 ? surface(x, y, 2, 5) : shade(VIAL, 1.4 + j + (x === 15 ? 1 : 0)))
      }
    }
    c.set(14, 20, shade(BENCH, 4))
    for (let y = 15; y < BENCH_Y; y++) {
      for (let x = 47; x < 62; x++) {
        const edge = x === 47 ? 1.4 : y === 15 ? 1 : x === 61 ? -0.6 : 0
        const j = jarLight(x, y) * 3 + bulbLight(x, y) * 3
        c.set(x, y, shade(METAL, 2 + edge + j))
      }
    }
    for (let y = 17; y < 22; y++) {
      for (let x = 49; x < 60; x++) c.set(x, y, shade(FLUID, 1 + (y === 17 ? 0.6 : 0)))
    }
    for (let x = 49; x < 60; x++) {
      const t = f - (59 - x)
      const v = activity(t) * 2.4 * Math.sin(t * 1.7) + Math.sin(t * 0.6) * 0.4
      const y = Math.round(19.5 - clamp(v, -2.4, 2.4))
      c.set(x, y, shade(FLUID, x === 59 ? 8.4 : 7.4))
    }
    for (const [dx, phase] of [[50, 0], [55, 2]] as const) {
      c.disc(dx + 0.5, 24, 1.3, shade(METAL, 1.2))
      const a = -Math.PI / 2 + Math.sin(f * 0.15 + phase) * 0.5 + act * 1.6
      c.set(dx + 0.5 + Math.cos(a) * 1.2, 24 + Math.sin(a) * 1.2, shade(METAL, 6))
    }
    c.set(59, 24, act > 0.5 ? 0xff5050 : 0x6a1a1e)
    for (let k = 0; k <= 20; k++) {
      const t = k / 20
      const x = lerp(48, 37, t)
      const y = lerp(15, 7, t) + Math.sin(t * Math.PI) * 4
      c.set(x, y, shade(METAL, 1 + jarLight(x, y) * 3))
    }
    const inJar = (x: number, y: number) => x > JAR_X0 && x < JAR_X1 && y >= 10 && y <= JAR_BOTTOM && !(y === JAR_BOTTOM && (x === JAR_X0 + 1 || x === JAR_X1 - 1))
    for (let y = 10; y <= JAR_BOTTOM; y++) {
      for (let x = JAR_X0 + 1; x < JAR_X1; x++) {
        if (!inJar(x, y)) continue
        const fromBase = (y - FLUID_TOP) / (JAR_BOTTOM - FLUID_TOP)
        const level = y < FLUID_TOP ? 0.6 + glow * 0.6 : 1.6 + fromBase * 2.2 + glow * 2 - Math.abs(x - 31.5) * 0.06 + (y === FLUID_TOP ? 1.6 : 0)
        c.set(x, y, shade(FLUID, level))
      }
    }
    const bubbles = (inFront: boolean) => {
      for (const p of particles(f, LOOP, 14, 18, 2)) {
        if (p.r[3] < 0.5 !== inFront) continue
        const x = Math.round(JAR_X0 + 2 + p.r[1] * 19 + Math.sin(p.t * 0.7 + p.r[2] * 6) * 0.8)
        const y = Math.round(JAR_BOTTOM - p.age * (JAR_BOTTOM - FLUID_TOP))
        c.set(x, y, shade(FLUID, 6.4 + glow))
      }
      if (f >= EUREKA && f < EUREKA + 10) {
        for (let i = 0; i < 8; i++) {
          if (i % 2 === 0 !== inFront) continue
          const t = f - EUREKA
          const x = 23 + i * 2.5 + Math.sin(t + i) * 0.6
          const y = JAR_BOTTOM - 1 - t * (1.2 + (i % 3) * 0.4)
          if (y > FLUID_TOP) c.set(x, y, shade(FLUID, 8))
        }
      }
    }
    bubbles(false)
    const flash = f >= EUREKA ? Math.max(0, 1 - (f - EUREKA) / 12) : 0
    const breath = f > 31 && f < EUREKA ? -0.6 : 0
    for (const [key, cell] of CELLS) {
      const x = key % W
      const y = Math.floor(key / W)
      let lobe = 0
      for (const bo of BOLTS) {
        const arrival = bo.arrival.get(cell.region)
        if (arrival === undefined || f < bo.at) continue
        const reached = bo.at + bo.frames * (1 - (1 - Math.min(1, arrival / (bo.far + TRAIL))) ** (1 / 1.6))
        if (f >= reached) lobe = Math.max(lobe, Math.min((f - reached + 1) / 3, 1 - (f - reached) / 10))
      }
      let spark: number | undefined
      for (const bo of [...BOLTS, ...IDLE_BOLTS]) {
        const d = bo.path.get(key)
        if (d === undefined || !isLive(bo, f)) continue
        const behind = head(bo, f) - d
        if (behind < 0 || behind >= TRAIL + AFTERGLOW) continue
        spark = SPARK[behind < 2 ? 3 : behind < 5 ? 2 : behind < TRAIL ? 1 : 0]
        break
      }
      if (cell.isFold && f >= EUREKA && f <= EUREKA + 2) spark = SPARK[f === EUREKA + 1 ? 2 : 3]
      if (spark !== undefined) {
        c.set(x, y, spark)
        continue
      }
      const afterglow = cell.isFold && f > EUREKA + 2 ? Math.max(0, EUREKA + 5 - f) * 0.9 : 0
      const base = (cell.isEdge ? 1.4 : cell.isFold ? 1.8 : 3.6 + cell.lit * 1.4) + afterglow
      const under = y >= 20 && !cell.isFold ? -0.6 : 0
      c.set(x, y, shade(BRAIN, base + Math.max(0, lobe) * 1.4 + flash * 2.6 + b * 0.8 + under + breath))
    }
    bubbles(true)
    for (let y = 10; y <= JAR_BOTTOM; y++) {
      const isFoot = y === JAR_BOTTOM
      c.set(JAR_X0 + (isFoot ? 1 : 0), y, shade(FLUID, 3.6 + glow * 1.4 + b * 2))
      c.set(JAR_X1 - (isFoot ? 1 : 0), y, shade(FLUID, 3 + glow + b * 2))
      if (y > 12 && y < 22) c.set(JAR_X0 + 2, y, shade(FLUID, 6 + glow + b * 2))
      if (y > 14 && y < 19) c.set(JAR_X1 - 2, y, shade(FLUID, 5 + glow))
    }
    for (let x = JAR_X0 - 1; x <= JAR_X1 + 1; x++) {
      const warm = bulbLight(x, 7) * 5
      c.set(x, 7, shade(METAL, 4.2 + warm + (x < 26 ? 0.8 : 0)))
      c.set(x, 8, shade(METAL, 2.6 + warm * 0.6))
      c.set(x, 9, shade(METAL, 1.4))
      c.set(x, JAR_BOTTOM + 1, shade(METAL, 3.6 + jarLight(x, 25) * 2))
      c.set(x, JAR_BOTTOM + 2, shade(METAL, 1.6 + jarLight(x, 26) * 1.5))
    }
    for (const tx of [26, 37]) {
      c.set(tx, 6, shade(METAL, 5 + bulbLight(tx, 6) * 4))
      c.set(tx, 5, shade(METAL, 3))
    }
    c.set(JAR_X0 + 3, JAR_BOTTOM + 1, act > 0.3 ? shade(FLUID, 8.4) : shade(FLUID, 4))
    for (const rx of [JAR_X0 - 1, JAR_X1 + 1]) c.set(rx, 8, shade(METAL, 6))
    out.push(c.copy())
  }
  return out
}

const [, CROWN_FLICK, BACK_FLICK, LAST_FLICK] = IDLE_BOLTS as [Bolt, Bolt, Bolt, Bolt]
export const scene: Scene = {
  verb: 'Cerebrating',
  render,
  hero: 38,
  snaps: [
    { frames: [EUREKA, EUREKA + 2], why: 'the eureka: every fold flashes and the bulb flickers on, off and on, lighting the whole lab' },
    { frames: CROWN_FLICK.at + 1, box: [33, 13, 38, 16], colors: SPARK, why: 'an idle spark flicks along a fold of the crown' },
    { frames: BACK_FLICK.at + 1, box: [26, 15, 33, 19], colors: SPARK, why: 'an idle spark flicks along a fold at the back' },
    { frames: LAST_FLICK.at + 1, box: [33, 13, 39, 17], colors: SPARK, why: 'an idle spark flicks along a fold under the crown' },
  ],
}