import { Canvas, PALETTE, TAU, beat, clamp, ease, hex, lerp, mod, particles, shade, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 48

const SKY = hex('1f4494 2650a4 2e5db4 396dc2 4880cd 5b94d6 72a7de')
const CLOUD = hex('6080b8 7d9bcf 9cb7e0 bcd1ee')
const CLOTH = hex('2c3260 434f82 6475a6 8ea1c6 b9c9e2 dde7f1 f5f7f1 fffef6')
const GRASS = PALETTE.grass
const FAR = hex('3b6284 527b8e 6a9497 87ada3')
const WOOD = PALETTE.wood
const PEG = hex('5a3a20 8e6236 c08f54 e8c486')
const ROPE = hex('3a3a4e 6a6a7e a6a6b6 d0d0da')
const LEAF = hex('4f7d2b 8ab043 c9d862')
const DAISY = hex('8f9cb8 f4f4ec f2c84a')

function wind(t: number): number {
  const f = mod(t, LOOP)
  const inhale = Math.sin(Math.PI * beat(f, 8, 15)) * 0.16
  const gust = ease.inOut(beat(f, 14, 20)) * (1 - ease.inOut(beat(f, 29, 40)))
  return 0.1 + 0.04 * wave(f, LOOP, 2) - inhale + gust * (0.88 + 0.07 * Math.sin(f * 1.9))
}

type Sheet = { x0: number; x1: number; len: number; lag: number }
const SHEETS: Sheet[] = [
  { x0: 7, x1: 20, len: 12, lag: 0 },
  { x0: 23, x1: 38, len: 13, lag: 1.5 },
  { x0: 41, x1: 55, len: 12, lag: 3 },
]

const SWING: number[][] = SHEETS.map(s => {
  let a = 0
  let v = 0
  const out: number[] = []
  for (let n = 0; n < LOOP * 3; n++) {
    for (let k = 0; k < 4; k++) {
      v += (wind(n + k / 4 - s.lag) - a) * 0.02 - v * 0.07
      a += v
    }
    if (n >= LOOP * 2) out.push(a)
  }
  for (let n = 1; n < out.length; n++) out[n] = Math.min(out[n] ?? 0, (out[n - 1] ?? 0) + 0.24)
  return out
})
const swing = (i: number, f: number) => SWING[i]?.[mod(f, LOOP)] ?? 0

const POP = 22
const CATCH = 39

const LOOSE_ANGLE = [0, -0.06, -0.15, -0.25, -0.32, -0.34, -0.29, -0.2, -0.09, 0.02, 0.13, 0.24, 0.34, 0.4, 0.36, 0.26, 0.13]
const looseAngle = (f: number) => LOOSE_ANGLE[f - POP] ?? 0

const looseness = (f: number) => ease.inOut(beat(f, POP, POP + 4)) * (1 - beat(f, CATCH - 4, CATCH))

const lineY = (x: number, sag: number) => 6 + sag * (1 - ((x - 31.5) / 28.5) ** 2)
const hillY = (x: number) => 22.6 + ((x - 30) / 32) ** 2 * 5
const farY = (x: number) => 20.4 + Math.sin(x * 0.16 + 0.4) * 0.9 + Math.sin(x * 0.41 + 2) * 0.5

type Cloud = { x: number; y: number; puffs: readonly (readonly [number, number, number, number])[] }
const CLOUDS: Cloud[] = [
  { x: 0, y: 4, puffs: [[0, 0, 5, 2], [4, -1.5, 4, 2.8], [8.5, -0.5, 3.5, 2.2], [12, 0.5, 3, 1.5]] },
  { x: 36, y: 2, puffs: [[0, 0, 3.5, 1.5], [3.5, -1, 3, 2], [7, 0, 3.5, 1.4]] },
  { x: 62, y: 5, puffs: [[0, 0, 4, 1.8], [4, -1.8, 4.5, 3], [9, -0.6, 4, 2.3], [13, 0.4, 3, 1.4]] },
]
const cloudX = (c: Cloud, f: number) => mod(c.x + f * 2, 96) - 18

function cloudAt(x: number, y: number, f: number): number | undefined {
  let best: number | undefined
  for (const c of CLOUDS) {
    if (y > c.y + 1) continue
    const cx = cloudX(c, f)
    for (const [dx, dy, rx, ry] of c.puffs) {
      const nx = (x - cx - dx) / rx
      const ny = (y - c.y - dy) / ry
      if (nx * nx + ny * ny > 1) continue
      best = Math.max(best ?? -9, 1.7 - ny * 1.2 - nx * 0.5)
    }
  }
  return best
}

function isCloudShadow(x: number, y: number, f: number): boolean {
  for (const c of CLOUDS) {
    const first = c.puffs[0]
    const last = c.puffs[c.puffs.length - 1]
    if (!first || !last) continue
    const x0 = cloudX(c, f) + first[0] - first[2] + 9 + (y - 22) * 1.6
    const x1 = cloudX(c, f) + last[0] + last[2] + 9 + (y - 22) * 1.6
    for (const lap of [-96, 0]) if (x >= x0 + lap && x <= x1 + lap) return true
  }
  return false
}

const FLOWERS: readonly (readonly [number, number])[] = [[11, 28], [19, 30], [33, 27], [46, 29], [55, 27], [61, 30], [26, 31]]

function render(): Int32Array[] {
  const out: Int32Array[] = []

  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const swings = SHEETS.map((_, i) => swing(i, f))
    const sag = 1.6 + 0.7 * clamp((swings[0]! + swings[1]! + swings[2]!) / 3)
    const isLoose = f >= POP && f < CATCH

    type Sample = { x: number; y: number; level: number; id: number }
    const samples: Sample[] = []
    SHEETS.forEach((s, id) => {
      const sw = swings[id] ?? 0
      const lift = clamp(sw, -0.3, 1.1)
      const lf = id === 2 ? looseness(f) : 0
      const a = lerp(lift * 0.8, 0.95, lf)
      const wd = s.x1 - s.x0
      const tl: [number, number] = [s.x0, lineY(s.x0, sag)]
      const phi = id === 2 ? looseAngle(f) : 0
      const hx0 = s.len * Math.sin(a) * 0.7
      const hy0 = s.len * Math.cos(a) * (1 - 0.12 * clamp(lift))
      const hx = hx0 * Math.cos(phi) - hy0 * Math.sin(phi)
      const hy = hx0 * Math.sin(phi) + hy0 * Math.cos(phi)
      const nu = Math.ceil(wd * 2.6)
      const nv = Math.ceil(s.len * 2.6)
      for (let j = 0; j <= nv; j++) {
        const v = j / nv
        for (let i = 0; i <= nu; i++) {
          const u = i / nu
          const pinX = lerp(s.x0, s.x1, u)
          const pinY = lineY(pinX, sag) + Math.sin(Math.PI * u) * 0.5 * (1 - clamp(lift))
          const tx = lerp(pinX, tl[0] + wd * u * Math.cos(phi), lf)
          const ty = lerp(pinY, tl[1] + wd * u * Math.sin(phi) + Math.sin(TAU * u * 1.1 - f * 1.1) * u * 1.3, lf)
          const amp = (0.2 + 0.85 * clamp(lift)) * (1 + u * 0.8 * lf)
          const phase = TAU * 1.2 * u + v * 1.1 - f * 0.7 - id * 1.7
          const x = tx + hx * v + Math.sin(Math.PI * v) * clamp(lift) * 1.8 * (0.4 + 0.6 * u) + Math.cos(phase) * amp * v * 0.3
          const y = ty + hy * v + Math.sin(phase) * amp * v - Math.sin(Math.PI * u) * v * clamp(lift) * 0.9
          const fold = Math.cos(phase) * Math.min(1, amp) * 1.1
          const hang = Math.cos(TAU * u * 2.2 + 0.7 + id) * 0.7 * v * (1 - clamp(lift))
          const belly = clamp(lift) * (1.3 * Math.cos(Math.PI * (u - 0.25)) - 0.3) - (v < 0.15 ? 0.6 * clamp(lift) : 0)
          const hem = v > 1 - 1.3 / s.len ? -0.9 : 0
          const side = u > 1 - 1 / wd ? -0.7 : u < 1 / wd ? 0.3 : 0
          samples.push({ x, y, level: 5.4 + fold + hang + belly + hem + side, id })
        }
      }
    })

    const sheetShadow = new Set<number>()
    for (const p of samples) {
      const top = lineY(p.x, sag)
      const gx = Math.round(p.x + (p.y - top) * 0.35 + 5)
      const gy = Math.round(hillY(gx) + 0.8 + (p.y - top) * 0.3)
      if (gx >= 0 && gx < W && gy < H) sheetShadow.add(gy * W + gx)
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) c.set(x, y, shade(SKY, 0.6 + (y / 21) * 6, x, y))
    }
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < W; x++) {
        const lit = cloudAt(x, y, f)
        if (lit !== undefined) c.set(x, y, shade(CLOUD, lit, x, y))
      }
    }
    for (let x = 0; x < W; x++) {
      const top = Math.round(farY(x))
      for (let y = top; y < H; y++) c.set(x, y, shade(FAR, y === top ? 3 : y === top + 1 ? 1.2 : 2, x, y))
    }
    for (let x = 0; x < W; x++) {
      const top = Math.round(hillY(x))
      const gx = clamp(wind(f - x / 18) * 1.2)
      for (let y = top; y < H; y++) {
        const depth = y - top
        let level = 5.6 - depth * 0.42 + (depth === 0 ? 1 : 0)
        const streak = Math.sin((TAU * (x - 3 * f)) / 24 + y * 0.9 - x * 0.05) > 0.6
        if (streak) level += 1.4 * gx
        if (isCloudShadow(x, y, f)) level -= 1.8
        if (sheetShadow.has(y * W + x)) level -= 1.3
        c.set(x, y, shade(GRASS, level, x, y))
      }
    }

    for (const px of [2, 60]) {
      const foot = Math.round(hillY(px)) + 1
      for (let y = 5; y <= foot; y++) {
        c.set(px, y, shade(WOOD, 4.6, px, y))
        c.set(px + 1, y, shade(WOOD, 2.4, px + 1, y))
      }
      c.set(px, 4, shade(WOOD, 6, px, 4))
      c.set(px + 1, 4, shade(WOOD, 4, px + 1, 4))
      c.set(px + 2, foot, shade(GRASS, 1, px + 2, foot))
    }
    for (let x = 4; x <= 59; x++) c.set(x, lineY(x, sag), ROPE[2] ?? 0)

    const owner = new Int8Array(W * H).fill(-1)
    for (const p of samples) {
      const ix = Math.round(p.x)
      const iy = Math.round(p.y)
      if (ix < 0 || ix >= W || iy < 0 || iy >= H) continue
      c.set(ix, iy, shade(CLOTH, p.level, ix, iy))
      owner[iy * W + ix] = p.id
    }
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const me = owner[y * W + x] ?? -1
        if (me < 0) continue
        const front = [owner[y * W + x + 1], owner[(y + 1) * W + x], owner[y * W + x - 1]].some(o => (o ?? -1) > me)
        if (front) c.set(x, y, CLOTH[2] ?? 0)
      }
    }

    SHEETS.forEach((s, id) => {
      const sw = clamp(swings[id] ?? 0)
      for (const [k, px] of [s.x0, s.x1].entries()) {
        let py = Math.round(lineY(px, sag))
        const isLast = id === 2 && k === 1
        if (isLast && isLoose) continue
        if (isLast && f >= 17 && f < POP) py -= f % 2
        const lean = sw > 0.55 ? 1 : 0
        c.set(px - lean, py - 1, PEG[3] ?? 0)
        c.set(px, py, PEG[2] ?? 0)
        c.set(px + lean, py + 1, PEG[1] ?? 0)
      }
    })
    if (isLoose) {
      const s = SHEETS[2]!
      const t = f - POP
      const span = CATCH - POP
      const g = 0.15
      const vy = (g * span) / 2
      const py = lineY(s.x1, sag) - vy * t + (g / 2) * t * t
      const px = s.x1 + 1.5 * Math.sin((Math.PI * t) / span)
      const r = ((t / span) * 4 * Math.PI)
      const dx = Math.round(Math.sin(r))
      const dy = Math.round(Math.cos(r))
      c.set(px - dx, py - dy, PEG[3] ?? 0)
      c.set(px, py, PEG[2] ?? 0)
      c.set(px + dx, py + dy, PEG[1] ?? 0)
    }

    for (const p of particles(f, LOOP, 9, 12, 0xb111)) {
      const born = f - p.t
      if (wind(born) < 0.55) continue
      const x = -2 + p.t * 6 + p.r[1] * 4
      const y = 9 + p.r[2] * 15 + Math.sin(p.t * 0.9 + p.r[3] * 6) * 1.6
      const col = LEAF[Math.floor(p.r[3] * 3)] ?? 0
      c.set(x, y, col)
      if (p.t % 2 === 0) c.set(x - 1, y, LEAF[0] ?? 0)
    }

    for (const [fx, fy] of FLOWERS) {
      const gx = clamp(wind(f - fx / 18) * 1.2)
      const nod = gx > 0.55 ? 1 : 0
      c.set(fx + nod, fy - 1, DAISY[1] ?? 0)
      c.set(fx, fy, shade(GRASS, 3, fx, fy))
    }
    for (let x = 0; x < W; x++) {
      const gx = clamp(wind(f - x / 18) * 1.2)
      const tall = (x * 5) % 7 < 2 ? 1 : 0
      if (tall) c.set(x + (gx > 0.5 ? 1 : 0), H - 2, shade(GRASS, 1.6, x, H - 2))
      c.set(x, H - 1, shade(GRASS, 1, x, H - 1))
    }

    out.push(c.px)
  }

  return out
}

export const scene: Scene = { verb: 'Billowing', render, hero: 26 }
