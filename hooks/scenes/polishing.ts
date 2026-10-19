import { Canvas, TAU, beat, clamp, hex, lerp, mod, noise, particles, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72
const GAP = 48
const CX = 31.5
const PAN = [64, 72] as const
const GLEAM = [55, 61] as const

const VELVET = hex('050f0e 091a18 0d2522 12322d 1a433a 245548 31684f 467d5c')
const SILVER = hex('0b1416 18262a 2b3b3f 45565b 66777b 8f9ea0 bac5c4 e4e9e1 fffcef')
const TARNISH = hex('2a2419 3b3424 4f4630 655a3e 7a6e4f 8d8262')
const WOOD = hex('120a07 21130e 341d13 4a2a18 643a20 82502b a66c39 c98d4f')
const BRASS = hex('3a2408 6a4512 a0701e d29e36 f2d26e fff4c0')
const CLOTH = hex('4a2c10 7d521c b5832c deb24c f3d886 fff3c4')

type Part = 'lip' | 'mouth' | 'bowl' | 'handle' | 'stem' | 'plinth' | 'plaque'
type Hit = { part: Part; nx: number; ny: number }

const BOWL: Record<number, number> = { 5: 9.5, 6: 9.5, 7: 9.5, 8: 9.5, 9: 9, 10: 8.5, 11: 7.5, 12: 6.5, 13: 5.5, 14: 4.5, 15: 2.5 }
const STEM: Record<number, number> = { 16: 1.5, 17: 1.5, 18: 2.5, 19: 1.5, 20: 2.5, 21: 3.5, 22: 5.5 }

function cup(dx: number, y: number): Hit | undefined {
  const a = Math.abs(dx)
  if (y === 3 && a <= 8.5) return { part: 'lip', nx: dx / 9.5, ny: -1 }
  if (y === 4) {
    if (a <= 7.5) return { part: 'mouth', nx: dx / 8, ny: 0 }
    if (a <= 9.5) return { part: 'lip', nx: dx / 10, ny: -0.5 }
  }
  const b = BOWL[y]
  if (b !== undefined && a <= b) return { part: y === 5 ? 'lip' : 'bowl', nx: dx / (b + 0.5), ny: y >= 12 ? 0.6 : 0 }
  const s = STEM[y]
  if (s !== undefined && a <= s) return { part: 'stem', nx: dx / (s + 0.5), ny: y === 22 ? 0.3 : 0 }
  if (y >= 23 && y <= 26 && a <= 7.5) return { part: y >= 24 && y <= 25 && a <= 2.5 ? 'plaque' : 'plinth', nx: dx / 8, ny: y === 23 ? -1 : 0 }
  if (y >= 5 && y <= 12 && a > (b ?? 0)) {
    const hx = a - 10.5
    const hy = y - 8.5
    const d = Math.hypot(hx, hy)
    if (Math.abs(d - 2.8) < 0.72 && a <= 14) return { part: 'handle', nx: Math.sign(dx) * (0.55 + 0.4 * (hx / d)), ny: hy / d }
  }
  return undefined
}

function chrome(nx: number): number {
  if (nx < -0.86) return 4
  if (nx < -0.52) return 8
  if (nx < -0.32) return 6
  if (nx < 0.12) return 3
  if (nx < 0.42) return 5
  if (nx < 0.8) return 2
  return 4
}

type State = 'dull' | 'hazy' | 'clean'

function cupColor(hit: Hit, state: State, x: number, y: number, seed: number): number {
  if (hit.part === 'plinth') {
    const edge = hit.nx < -0.85 ? 2 : hit.nx > 0.85 ? -1 : 0
    return shade(WOOD, (hit.ny < 0 ? 5 : 3) + edge - (y === 26 ? 1 : 0))
  }
  if (hit.part === 'plaque') return shade(BRASS, hit.nx < 0 ? 3 : 2.4 + (y === 24 ? 0.6 : 0))
  if (hit.part === 'mouth') {
    const level = hit.nx > 0.35 ? 2 : hit.nx > -0.1 ? 1 : 0
    return state === 'clean' ? shade(SILVER, level) : shade(TARNISH, level * 0.6)
  }
  let c = chrome(hit.nx)
  if (hit.part === 'lip') c = Math.max(c, hit.ny < -0.8 ? 6 : 5)
  if (hit.part === 'handle') c = chrome(hit.nx) - hit.ny * 1.5
  c -= hit.ny > 0 ? hit.ny * 1.6 : 0
  if (state === 'clean') return shade(SILVER, c)
  if (state === 'hazy') return shade(SILVER, 3.4 + (c - 4) * 0.45)
  const blotch = noise(x * 0.6 + seed, y * 0.7, 0, 7) > 0.7 ? -1 : 0
  return shade(TARNISH, 2.8 + (c - 4) * 0.28 + blotch)
}

type Band = { top: number; bottom: number; cy: number; ry: number; x0: number; x1: number; start: number; end: number }
const BANDS: Band[] = [
  { top: 13, bottom: 22, cy: 16, ry: 2.4, x0: -5, x1: 5, start: 9, end: 22 },
  { top: 8, bottom: 12, cy: 10, ry: 1.6, x0: 9, x1: -9, start: 26, end: 39 },
  { top: 2, bottom: 7, cy: 5.5, ry: 1.5, x0: -9, x1: 9, start: 43, end: 55 },
]
const REST: readonly [number, number] = [56, 13]
const PUT_DOWN = 64
const SET_OFF = 67

function loop(b: Band, u: number): [number, number] {
  const s = lerp(b.x0, b.x1, u)
  const turn = u * TAU * 1.75 + (b.x1 > b.x0 ? Math.PI : 0)
  return [CX + s + Math.cos(turn) * 2, b.cy + Math.sin(turn) * b.ry * 0.8]
}

const LENGTHS = BANDS.map(b => {
  const N = 400
  const run = [0]
  let prev = loop(b, 0)
  for (let i = 1; i <= N; i++) {
    const p = loop(b, i / N)
    run.push((run[i - 1] ?? 0) + Math.hypot(p[0] - prev[0], p[1] - prev[1]))
    prev = p
  }
  return run
})

function rub(b: Band, t: number): [number, number] {
  const run = LENGTHS[BANDS.indexOf(b)] ?? [0]
  const N = run.length - 1
  const want = t * (run[N] ?? 0)
  let i = 0
  while (i < N && (run[i + 1] ?? 0) < want) i++
  const a = run[i] ?? 0
  const z = run[i + 1] ?? a
  return loop(b, (i + (z > a ? (want - a) / (z - a) : 0)) / N)
}

function hop(a: readonly [number, number], b: readonly [number, number], t: number, lift: number): [number, number] {
  const e = (t + (1 - Math.cos(Math.PI * t)) / 2) / 2
  return [lerp(a[0], b[0], e), lerp(a[1], b[1], e) - Math.sin(Math.PI * t) * lift]
}

function clothAt(f: number): [number, number] {
  const [a, b, c] = BANDS as [Band, Band, Band]
  if (f >= SET_OFF) return hop(REST, rub(a, 0), beat(f, SET_OFF, a.start + LOOP), 5)
  if (f < a.start) return hop(REST, rub(a, 0), beat(f + LOOP, SET_OFF, a.start + LOOP), 5)
  if (f <= a.end) return rub(a, beat(f, a.start, a.end))
  if (f < b.start) return hop(rub(a, 1), rub(b, 0), beat(f, a.end, b.start), 1)
  if (f <= b.end) return rub(b, beat(f, b.start, b.end))
  if (f < c.start) return hop(rub(b, 1), rub(c, 0), beat(f, b.end, c.start), 1)
  if (f <= c.end) return rub(c, beat(f, c.start, c.end))
  if (f < PUT_DOWN) return hop(rub(c, 1), REST, beat(f, c.end, PUT_DOWN), 4)
  return [REST[0], REST[1]]
}

function render(): Int32Array[] {
  const polish = new Float32Array(W * H)
  const out: Int32Array[] = []

  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const p = (1 - Math.cos(Math.PI * beat(f, PAN[0], PAN[1]))) / 2
    const off = -Math.round(GAP * p)
    const [gxf, gyf] = clothAt(f)
    const gx = Math.round(gxf)
    const gy = Math.round(gyf)

    for (const b of BANDS) {
      if (f < b.start || f > b.end) continue
      for (let y = b.top; y <= b.bottom; y++) {
        for (let x = 0; x < W; x++) {
          if (!cup(x - CX, y)) continue
          const d = Math.abs(x - gxf)
          if (d < 4.5) polish[y * W + x] = (polish[y * W + x] ?? 0) + 0.5 * (1 - d / 4.5)
        }
      }
      if (f === b.end) {
        for (let y = b.top; y <= b.bottom; y++) {
          for (let x = 0; x < W; x++) polish[y * W + x] = Math.max(polish[y * W + x] ?? 0, 0.8)
        }
      }
    }

    const stateOf = (k: number, x: number, y: number): State => {
      if (k === 0) {
        const v = polish[y * W + Math.round(x - off)] ?? 0
        return v >= 0.75 ? 'clean' : v >= 0.3 ? 'hazy' : 'dull'
      }
      return k < 0 ? 'clean' : 'dull'
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const rel = x - off - CX
        const k = Math.floor((rel + GAP / 2) / GAP)
        const lx = rel - k * GAP
        const pool = clamp(1 - Math.hypot((lx + 3) / 20, (y - 10) / 15))
        let col: number
        if (y >= 29) {
          col = shade(WOOD, y === 29 ? 3.4 + pool * 3 : 1.6 - (y - 30) * 0.8 + pool)
        } else if (Math.abs(lx) >= 22.5) {
          const face = lx > 0 ? (lx < 23 ? 4.6 : 3) : lx > -23 ? 1.4 : 2.4
          col = shade(WOOD, face - (y > 20 ? 0.6 : 0) + (y === 0 ? 1 : 0))
        } else if (y <= 1) {
          col = shade(WOOD, y === 0 ? 3 : 1)
        } else if (y >= 25) {
          const back = (y - 25) * 0.5
          const shadow = (y >= 26 && lx > -8 && lx < 11) || (y === 25 && lx > -5 && lx < 12) ? 1.6 : 0
          col = shade(WOOD, 2.2 + back + pool * 2.6 - shadow)
        } else {
          const fold = Math.abs(mod(lx + 1, 8) - 4) / 4
          const shadow = cup(lx - 3, y - 2) && !cup(lx, y) ? 1.7 * Math.min(1, pool * 2) : 0
          const glint = ([0, 0.6, 1, 1.2, 0.8, 0.4][f - 59] ?? 0) * clamp(1 - Math.hypot(lx - 8.5, (y - 4) * 1.4) / 11)
          col = shade(VELVET, 0.6 + pool * 4.6 + (fold - 0.5) * 0.7 * (0.3 + pool) - shadow + glint * 1.6)
        }
        c.set(x, y, col)

        const hit = cup(lx, y)
        if (hit) c.set(x, y, cupColor(hit, stateOf(k, x, y), lx, y, 0))
      }
    }

    const sweep = beat(f, GLEAM[0], GLEAM[1])
    if (sweep > 0 && sweep < 1) {
      const s = lerp(-16, 16, (1 - Math.cos(Math.PI * sweep)) / 2)
      for (let y = 3; y <= 22; y++) {
        for (let x = 14; x < 50; x++) {
          const hit = cup(x - CX - off, y)
          if (!hit || hit.part === 'mouth' || hit.part === 'plinth' || hit.part === 'plaque') continue
          const q = x - CX - off + (y - 12) * 0.6 - s
          if (Math.abs(q) < 1) c.set(x, y, SILVER[8] ?? 0)
          else if (Math.abs(q) < 2) c.set(x, y, SILVER[7] ?? 0)
        }
      }
    }
    const star = [0, 1, 2, 3, 2, 1][f - 59] ?? 0
    if (star > 0) {
      const sx = Math.round(CX + off + 8.5)
      const sy = 4
      c.set(sx, sy, SILVER[8] ?? 0)
      for (let r = 1; r <= star; r++) {
        const col = r === star && star > 1 ? (SILVER[6] ?? 0) : (SILVER[8] ?? 0)
        c.set(sx + r, sy, col)
        c.set(sx - r, sy, col)
        c.set(sx, sy + r, col)
        c.set(sx, sy - r, col)
      }
    }
    for (const [i, b] of BANDS.entries()) {
      const t = f - b.end
      if (t === 1 || t === 2) {
        const [wdx, wy] = ([[-4.5, 13], [-6.5, 9], [-7.5, 6]] as const)[i] ?? [0, 0]
        const wx = Math.round(CX + wdx)
        c.set(wx, wy, SILVER[8] ?? 0)
        if (t === 1) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.set(wx + dx, wy + dy, SILVER[7] ?? 0)
      }
    }

    for (const m of particles(f, LOOP, 8, 40, 5)) {
      const mx = Math.round(12 + m.r[1] * 36 + m.age * 5)
      const my = Math.round(3 + m.r[2] * 16 + m.age * 7)
      const lx = mx - CX - off
      const pool = clamp(1 - Math.hypot((lx + 3) / 20, (my - 10) / 15))
      if (pool > 0.25 && !cup(lx, my) && Math.sin(Math.PI * m.age) > 0.3) c.tint(mx, my, 0xd8e8c8, 0.35 + pool * 0.3)
    }

    const [px, py] = clothAt(mod(f - 1, LOOP))
    const vx = clamp((gxf - (clothAt(mod(f - 2, LOOP))[0] ?? 0)) / 2, -3, 3)
    const HALF = [0.5, 1.5, 2, 2.5, 3, 3.5, 3.5]
    const [sx, sy] = [Math.round(px), Math.round(py)]
    const smears = Math.ceil(Math.hypot(gx - sx, gy - sy) / 2) - 1
    for (let k = 1; k <= smears; k++) {
      const t = k / (smears + 1)
      const mx = Math.round(lerp(sx, gx, t))
      const my = Math.round(lerp(sy, gy, t))
      HALF.forEach((half, j) => {
        if (j === 0 || j === HALF.length - 1) return
        const w = Math.floor(half - 0.5)
        for (let dx = -w; dx <= w; dx++) c.set(mx + dx, my - 3 + j, shade(CLOTH, 1.6 + t - Math.abs(dx) * 0.2))
      })
    }
    HALF.forEach((half, j) => {
      const y = gy - 3 + j
      const lag = Math.round(-vx * 0.35 * Math.max(0, j - 2))
      const cx = gx + lag
      for (let dx = -Math.ceil(half); dx <= Math.ceil(half); dx++) {
        if (Math.abs(dx) > half) continue
        if (j === HALF.length - 1 && (dx === 0 || Math.abs(dx) === 3)) continue
        const fold = j >= 3 ? (Math.floor((dx + 5) / 2) % 2 === 0 ? 0.5 : -0.6) : 0
        const knot = j === 0 ? 1 : 0
        c.set(cx + dx, y, shade(CLOTH, 3 - dx * 0.35 - j * 0.15 + fold + knot))
      }
    })
    c.set(gx - 1, gy - 2, CLOTH[5] ?? 0)

    out.push(c.px)
  }

  return out
}

export const scene: Scene = {
  verb: 'Polishing',
  render,
  hero: 62,
  snaps: [
    {
      frames: [PAN[0] + 1, PAN[1] - LOOP],
      why: 'the whip pan along the shelf to the next cup: the whole cabinet slides left, up to 9 px a frame, landing on the first frame of the loop',
    },
    {
      frames: [GLEAM[0] + 1, GLEAM[1]],
      box: [17, 3, 46, 22],
      colors: [SILVER[7] ?? 0, SILVER[8] ?? 0],
      why: 'the gleam: a bright slash of light sweeps across the clean cup, several pixels a frame, and is gone',
    },
  ],
}
