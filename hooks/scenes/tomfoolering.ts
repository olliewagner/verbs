import { Canvas, PALETTE, beat, clamp, ease, frames, hex, lerp, mod, shade, threshold, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 60

const SKY = hex('3f78c0 5592d8 72ade6 97c8f0 c3e2f7')
const STONE = hex('2a2838 3c3a4e 545268 6e6c84 8c8aa0 aeacbe d0cedc')
const COBBLE = hex('2e2420 4a3a30 6a5444 8a705a aa8e74 c8ae92')
const BANNER = hex('141a4a 1f2a78 3048a8 4a68c8')
const GOLD = PALETTE.gold
const RED = hex('3d0c1a 6e1424 a61f2c d63a35 f0644a')
const MUSTARD = hex('4a2a0c 7a4a12 b07818 dcab2a f2d35a')
const SKIN = hex('6a3a2c b06c4c e8a878 fcd4a8')
const RUFF = hex('7a7a96 b8bcd0 eef0f8')
const SHOE = hex('1e1430 3a2650 5a3c78')
const BANANA = hex('5a3a10 a87a18 e8c030 f8e478')
const DUST = hex('8a705a aa8e74 c8ae92 e0ccb4')
const BALLS = [hex('0e4a52 177a80 2fb5a8 8ae8d8'), hex('2a1452 4a2a8a 7a52c8 b490f0'), hex('2a4410 4a7a18 8ab830 cce870')]
const OUTLINE = 0x24121c

const GROUND = 28

const JUGGLE_START = 46
const READY = JUGGLE_START - 4
const SLIP = 9
const LAND = 17
const CATCH = [22, 26, 30] as const
const BONK = 33
const FLICK = 45
const PEEL_REST = 59
const WHIP = SLIP + 1
const SMEAR = [-0.85, -0.55, -0.25, 0.3]

type P = readonly [number, number]

type Pose = { hx: number; hy: number; lean: number; fx: number; fy: number; bx: number; by: number }
type Key = Pose & { f: number; easing?: (t: number) => number }

const STAND: Pose = { hx: 27, hy: 20.5, lean: 0.05, fx: 29, fy: GROUND, bx: 25.5, by: GROUND }
const SIT: Pose = { hx: 26, hy: 26.4, lean: 0.2, fx: 33, fy: 27.5, bx: 32, by: 27.6 }
const lin = (t: number) => t

const KEYS: Key[] = [
  { f: SLIP, hx: 33.5, hy: 20.3, lean: 0.2, fx: 41.5, fy: 27, bx: 31, by: GROUND },
  { f: 10, hx: 34, hy: 18.8, lean: 0.6, fx: 42, fy: 21, bx: 34, by: 26, easing: lin },
  { f: 11, hx: 33.5, hy: 17, lean: 1, fx: 40, fy: 15.5, bx: 37, by: 20, easing: lin },
  { f: 12, hx: 32.3, hy: 16, lean: 1.3, fx: 38, fy: 12.5, bx: 36.5, by: 15, easing: lin },
  { f: 13, hx: 31, hy: 16, lean: 1.42, fx: 37, fy: 12, bx: 35.5, by: 13.5, easing: lin },
  { f: 14, hx: 29.8, hy: 17.3, lean: 1.38, fx: 36, fy: 13, bx: 34.5, by: 15, easing: lin },
  { f: 15, hx: 28.6, hy: 19.8, lean: 1.2, fx: 35, fy: 15.5, bx: 33.5, by: 17.5, easing: lin },
  { f: 16, hx: 27.4, hy: 23.2, lean: 0.9, fx: 34.3, fy: 18, bx: 32.9, by: 19.8, easing: lin },
  { f: LAND, hx: 26.4, hy: 27, lean: 0.6, fx: 33.6, fy: 20.8, bx: 32.3, by: 22.6, easing: lin },
  { f: LAND + 1, hx: 26, hy: 26.8, lean: 0.35, fx: 33.1, fy: 24, bx: 32, by: 25.4, easing: lin },
  { f: LAND + 2, hx: 26, hy: 26.5, lean: 0.2, fx: 33, fy: 26.6, bx: 32, by: 27, easing: lin },
  { f: LAND + 3, ...SIT, lean: 0.12, easing: lin },
  { f: LAND + 5, ...SIT },
  { f: BONK, ...SIT },
  { f: BONK + 1, ...SIT, hy: 27.1, lean: 0.22, easing: ease.out },
  { f: 35, ...SIT, hx: 26.1, hy: 27, lean: 0.12, easing: lin },
  { f: 36, hx: 26.2, hy: 26.6, lean: -0.06, fx: 31.5, fy: 27.8, bx: 30.5, by: 27.8, easing: lin },
  { f: 37, hx: 26.5, hy: 26.4, lean: -0.2, fx: 30.2, fy: GROUND, bx: 28.8, by: GROUND, easing: lin },
  { f: 38, hx: 26.8, hy: 25.8, lean: -0.33, fx: 30, fy: GROUND, bx: 28.5, by: GROUND, easing: lin },
  { f: 39, hx: 27, hy: 24.5, lean: -0.34, fx: 29.7, fy: GROUND, bx: 27.7, by: GROUND, easing: lin },
  { f: 40, hx: 27, hy: 22.6, lean: -0.22, fx: 29.4, fy: GROUND, bx: 26.8, by: GROUND, easing: lin },
  { f: 41, ...STAND, hy: 20.9, lean: -0.05, fx: 29.1, bx: 26, easing: lin },
  { f: 42, ...STAND, hy: 20, lean: 0.1, easing: lin },
  { f: 43, ...STAND, hy: 20.2, lean: 0.2, easing: lin },
  { f: 44, ...STAND, hy: 20.4, lean: 0.02, easing: lin },
  { f: FLICK, ...STAND, lean: -0.16, easing: lin },
  { f: JUGGLE_START, ...STAND, easing: lin },
]

const juggleTime = (f: number) => mod(f - READY, LOOP) - (JUGGLE_START - READY)
const isJuggling = (f: number) => f >= JUGGLE_START || f < SLIP

function walk(j: number): Pose {
  const stride = ease.inOut(beat(j, 16, 21))
  const follow = ease.inOut(beat(j, 19, 23))
  return {
    hx: STAND.hx + 5.5 * ease.inOut(beat(j, 16, 23)),
    hy: STAND.hy + (j < 15 && Math.floor(j / 5) % 2 ? 0.5 : 0) - Math.sin(stride * Math.PI) * 0.8,
    lean: STAND.lean - Math.sin(stride * Math.PI) * 0.15 - 0.21 * (1 - ease.inOut(beat(j, 0, 4))),
    fx: STAND.fx + 9 * stride + Math.max(0, j - 21),
    fy: GROUND - Math.sin(stride * Math.PI) * 2.5,
    bx: STAND.bx + 5 * follow,
    by: GROUND - Math.sin(follow * Math.PI) * 1.2,
  }
}

function pose(f: number): Pose {
  if (isJuggling(f)) return walk(juggleTime(f))
  for (let i = 0; i + 1 < KEYS.length; i++) {
    const a = KEYS[i]
    const b = KEYS[i + 1]
    if (!a || !b || f < a.f || f >= b.f) continue
    const t = (b.easing ?? ease.inOut)((f - a.f) / (b.f - a.f))
    return {
      hx: lerp(a.hx, b.hx, t), hy: lerp(a.hy, b.hy, t), lean: lerp(a.lean, b.lean, t),
      fx: lerp(a.fx, b.fx, t), fy: lerp(a.fy, b.fy, t), bx: lerp(a.bx, b.bx, t), by: lerp(a.by, b.by, t),
    }
  }
  return STAND
}

const up = (lean: number): P => [-Math.sin(lean), -Math.cos(lean)]
const shoulder = (p: Pose): P => {
  const [ux, uy] = up(p.lean)
  return [p.hx + ux * 6, p.hy + uy * 6]
}
const headAt = (p: Pose): P => {
  const [ux, uy] = up(p.lean)
  return [p.hx + ux * 9, p.hy + uy * 9]
}

function along(path: (u: number) => P, tau: number, n: number, speed?: (t: number) => number): P {
  const N = 48
  const lens = [0]
  let prev = path(0)
  for (let i = 1; i <= N; i++) {
    const q = path(i / N)
    lens.push((lens[i - 1] ?? 0) + Math.hypot(q[0] - prev[0], q[1] - prev[1]))
    prev = q
  }
  const total = lens[N] ?? 1
  const c = clamp(1 - 1.6 / (total / n), 0, 0.45)
  const v = speed ?? ((t: number) => 1 + c * Math.cos(2 * Math.PI * t))
  let covered = 0
  let all = 0
  for (let i = 0; i < N; i++) {
    const s = v((i + 0.5) / N)
    all += s
    if ((i + 1) / N <= tau) covered += s
    else if (i / N < tau) covered += s * (tau * N - i)
  }
  const want = (total * covered) / Math.max(1e-6, all)
  let i = 1
  while (i < N && (lens[i] ?? 0) < want) i++
  const a = lens[i - 1] ?? 0
  const b = lens[i] ?? a
  const [x, y] = path((i - 1 + clamp((want - a) / Math.max(1e-6, b - a))) / N)
  return [x + 0.02, y + 0.02]
}
const T = 5
const D = 11
const NEAR_LOOP: P[] = [[8, -5], [7, -4], [6, -3], [5, -4], [4, -5], [4, -6], [5, -7], [6, -7], [7, -7], [8, -6]]
const FAR_LOOP: P[] = NEAR_LOOP.map(([x, y]) => [8 - x, y])
const ORDER = [0, 1, 2]
const STACK: P = [0, -3]
const STACKED = 0
function cascadeHand(near: boolean, j: number, p: Pose): P {
  const [ox, oy] = (near ? NEAR_LOOP : FAR_LOOP)[mod(j - (near ? 6 : 1), 10)] ?? [0, 0]
  const ax = STAND.hx + (p.hx - STAND.hx) * 0.3
  return [Math.round(ax) + ox, Math.round(p.hy) + oy]
}
const juggleHand = (near: boolean, j: number) => cascadeHand(near, j, walk(j))
const CATCHES = [
  { ball: 0, near: true, f: CATCH[2], top: -3, drift: 8, skew: 1 },
  { ball: 1, near: false, f: CATCH[1], top: 2, drift: -3, skew: 1 },
  { ball: 2, near: true, f: CATCH[0], top: 6, drift: -5, skew: 1.7 },
]
const REACH: P[] = [[0, -1], [1, -2], [1, -3], [0, -3], [0, -2], [-1, -1], [-1, 0]]
function sitHand(near: boolean, f: number): P {
  const s = shoulder(SIT)
  let reach: P = [0, 0]
  for (const c of CATCHES) if (c.near === near) reach = REACH[f - c.f + 3] ?? reach
  const x = Math.round(s[0] + (near ? 4.5 : -4.5)) + (near ? reach[0] : -reach[0])
  const y = Math.round(s[1] - 2) + reach[1]
  return [x, y]
}
const FLAIL: P[] = [[2.5, -2], [2, -4.5], [1, -6], [0, -6.5], [0.5, -6.5], [1.5, -6], [2.5, -5.5], [3.5, -4.5], [4, -3]]
const FLAIL_FAR: P[] = [[-1.5, -3], [-2.5, -5], [-3.5, -6], [-4, -5.5], [-4, -5], [-3.5, -5], [-3.5, -4.5], [-4, -3.5], [-4.5, -2.5]]
function hand(near: boolean, f: number): P {
  const p = pose(f)
  const s = shoulder(p)
  if (f >= READY || f < SLIP) return cascadeHand(near, juggleTime(f), p)
  const k = clamp(f - SLIP, 0, FLAIL.length - 1)
  const [ox, oy] = (near ? FLAIL[k] : FLAIL_FAR[k]) ?? [0, 0]
  const flail: P = [s[0] + ox, s[1] + oy]
  if (f < LAND) return flail
  const sit = sitHand(near, f)
  if (f < LAND + 3) {
    const t = ease.inOut((f - LAND + 1) / 4)
    return [lerp(flail[0], sit[0], t), lerp(flail[1], sit[1], t)]
  }
  if (f <= BONK) return sit
  const t = beat(f, BONK, READY)
  const ready = cascadeHand(near, juggleTime(f), pose(READY))
  return [lerp(sit[0], ready[0], t), lerp(sit[1], ready[1], t)]
}
function held(b: number, near: boolean, f: number, stacked: boolean): P {
  const h = hand(near, f)
  return stacked ? [h[0] + STACK[0], h[1] + STACK[1]] : h
}
function ball(b: number, f: number): P {
  if (isJuggling(f) || f >= READY) {
    const j = juggleTime(f)
    let last = -1
    for (let k = 0; k * T <= j; k++) if (ORDER[k % 3] === b) last = k
    if (last < 0) return held(b, b !== 1, f, b === STACKED)
    const t0 = last * T
    const near = last % 2 === 0
    if (j - t0 >= D) return held(b, !near, f, false)
    const h = juggleHand(near, t0)
    const from: P = last === 0 ? [h[0] + STACK[0], h[1] + STACK[1]] : h
    const to = juggleHand(!near, t0 + D)
    const arc = near ? 11 : 9.5
    return along(u => [lerp(from[0], to[0], u), lerp(from[1], to[1], u) - arc * 4 * u * (1 - u)], (j - t0) / D, D)
  }
  const c = CATCHES.find(k => k.ball === b)
  if (!c) return [0, 0]
  if (f < c.f) {
    const from = ball(b, SLIP - 1)
    const to = held(b, c.near, c.f, b === STACKED)
    const lift = (from[1] + to[1]) / 2 - c.top
    const n = c.f - SLIP + 1
    return along(u => [lerp(from[0], to[0], u) + c.drift * Math.sin(Math.PI * u ** c.skew), lerp(from[1], to[1], u) - lift * 4 * u * (1 - u)], (f - SLIP + 1) / n, n)
  }
  return held(b, c.near, f, b === STACKED)
}
const PEEL_X = 39
type Peel = { x: number; y: number; turn: number; on: 'ground' | 'air' | 'hat' }
const hatAt = (f: number): P => {
  const head = headAt(pose(f))
  return [head[0], head[1] - 4]
}
const LIE: P = [PEEL_X - 0.5, GROUND - 1]
const SKID: P = [LIE[0] + 2, LIE[1]]
function lob(a: P, b: P, top: number, n: number, t: number): P {
  const s0 = Math.sqrt(Math.max(0, a[1] - top))
  const s1 = Math.sqrt(Math.max(0, b[1] - top))
  const ta = (n * s0) / Math.max(1e-6, s0 + s1)
  const g = ta > 0 ? (2 * (a[1] - top)) / (ta * ta) : (2 * (b[1] - top)) / (n * n)
  return [lerp(a[0], b[0], t / n), top + (g / 2) * (t - ta) * (t - ta)]
}
function flutter(a: P, b: P, n: number, t: number): P {
  const v0 = -1.5
  const vmax = 1.9
  const fallBy = (g: number, k: number) => {
    let y = 0
    let v = v0
    for (let i = 0; i < k; i++) {
      y += v
      v = Math.min(vmax, v + g)
    }
    return y
  }
  let lo = 0.05
  let hi = 4
  for (let i = 0; i < 40; i++) {
    const g = (lo + hi) / 2
    if (fallBy(g, n) < b[1] - a[1]) lo = g
    else hi = g
  }
  return [lerp(a[0], b[0], t / n), a[1] + fallBy((lo + hi) / 2, t)]
}
function peel(f: number): Peel {
  if (f === SLIP) return { x: SKID[0], y: SKID[1], turn: 6, on: 'ground' }
  if (f > SLIP && f < BONK) {
    const n = BONK - SLIP
    const hat = hatAt(BONK)

    const path = (u: number): P => [lerp(SKID[0], hat[0], 1 - (1 - u) * (1 - u)), lob(SKID, hat, 4, 1, u)[1]]
    const speed = (t: number) => {
      const q = path(t)
      const r = path(t + 0.001)
      return Math.max(1.6, (Math.hypot(r[0] - q[0], r[1] - q[1]) * 1000) / n)
    }
    const [x, y] = along(path, (f - SLIP) / n, n, speed)
    return { x, y, turn: mod(6 - Math.round((10 * (f - SLIP)) / n), 8), on: 'air' }
  }
  if (f >= BONK && f < FLICK) {
    const [x, y] = hatAt(f)
    return { x, y, turn: 4, on: 'hat' }
  }
  if (f >= FLICK && f < PEEL_REST) {
    const n = PEEL_REST - FLICK + 1
    const [x, y] = flutter(hatAt(FLICK - 1), LIE, n, f - FLICK + 1)
    return { x, y, turn: mod(4 + Math.round((10 * (f - FLICK + 1)) / n), 8), on: 'air' }
  }
  return { x: LIE[0], y: LIE[1], turn: 6, on: 'ground' }
}
const BELL_OFFSETS: P[] = [[-4.6, -2.6], [3.8, -3.4]]
const bells: P[][] = (() => {
  const pos = BELL_OFFSETS.map(([ox, oy]) => [STAND.hx + ox, STAND.hy - 9 + oy])
  const vel = BELL_OFFSETS.map(() => [0, 0])
  const out: P[][] = []
  for (let n = 0; n < LOOP * 3; n++) {
    const f = n % LOOP
    const p = pose(f)
    const [hx, hy] = headAt(p)
    const c = Math.cos(-p.lean)
    const s = Math.sin(-p.lean)
    const frame: P[] = []
    BELL_OFFSETS.forEach(([ox, oy], i) => {
      const tx = hx + ox * c - oy * s
      const ty = hy + ox * s + oy * c
      const q = pos[i] ?? [0, 0]
      const v = vel[i] ?? [0, 0]
      v[0] = ((v[0] ?? 0) + (tx - (q[0] ?? 0)) * 0.4) * 0.62
      v[1] = ((v[1] ?? 0) + (ty - (q[1] ?? 0)) * 0.4 + 0.25) * 0.62
      q[0] = (q[0] ?? 0) + (v[0] ?? 0)
      q[1] = (q[1] ?? 0) + (v[1] ?? 0)
      frame.push([q[0] ?? 0, q[1] ?? 0])
    })
    if (n >= LOOP * 2) out.push(frame)
  }
  return out
})()
const JINGLES = [LAND, LAND + 1, ...CATCH, BONK, BONK + 1, 41]
function joint(a: P, b: P, l1: number, l2: number, side: number): P {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const d = Math.min(l1 + l2 - 0.01, Math.max(0.01, Math.hypot(dx, dy)))
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along))
  const nx = dx / Math.hypot(dx, dy || 0.01)
  const ny = dy / Math.hypot(dx, dy || 0.01)
  return [a[0] + nx * along - ny * h * side, a[1] + ny * along + nx * h * side]
}
class Layer {
  readonly px = new Int32Array(W * H).fill(-1)
  set(x: number, y: number, col: number): void {
    const ix = Math.round(x)
    const iy = Math.round(y)
    if (ix >= 0 && ix < W && iy >= 0 && iy < H) this.px[iy * W + ix] = col
  }
  limb(a: P, b: P, r: number, ramp: readonly number[], base: number): void {
    const x0 = Math.floor(Math.min(a[0], b[0]) - r - 1)
    const x1 = Math.ceil(Math.max(a[0], b[0]) + r + 1)
    const y0 = Math.floor(Math.min(a[1], b[1]) - r - 1)
    const y1 = Math.ceil(Math.max(a[1], b[1]) + r + 1)
    const vx = b[0] - a[0]
    const vy = b[1] - a[1]
    const len2 = Math.max(0.0001, vx * vx + vy * vy)
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = clamp(((x - a[0]) * vx + (y - a[1]) * vy) / len2)
        const ox = x - a[0] - vx * t
        const oy = y - a[1] - vy * t
        if (Math.hypot(ox, oy) > r) continue
        const sun = ox * 0.6 - oy * 0.8
        this.set(x, y, shade(ramp, base + (sun > 0.35 ? 1 : sun < -0.45 ? -1 : 0), x, y))
      }
    }
  }
  disc(cx: number, cy: number, r: number, paint: (x: number, y: number, dx: number, dy: number) => number): void {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (Math.hypot(x - cx, y - cy) <= r) this.set(x, y, paint(x, y, x - cx, y - cy))
      }
    }
  }
}
const PEEL_FLAT = ['y...y.', '.yyy..', 'yyyyyb']
const PEEL_HAT = ['.yyy.', 'yy.yy', 'y...y']
const PEEL_TUMBLE = (() => {
  const down = ['.y.y.', 'yy.yy', '.yyy.', '..b..', '.....']
  const downLeft = ['.yy..', '.yy..', '..yyy', '.b.yy', '.....']
  const left = ['...y.', '..yyy', '.by..', '..yyy', '...y.']
  const flipV = (a: string[]) => [...a].reverse()
  const flipH = (a: string[]) => a.map(r => [...r].reverse().join(''))
  const upLeft = flipV(downLeft)
  return [down, downLeft, left, upLeft, flipV(down), flipH(upLeft), flipH(left), flipH(downLeft)].map(art => {
    const lit = art.flatMap((row, j) => [...row].flatMap((ch, i) => (ch === '.' ? [] : [[i, j] as const])))
    const mid = (k: 0 | 1) => lit.reduce((sum, q) => sum + q[k], 0) / Math.max(1, lit.length)
    return { art, cx: mid(0), cy: mid(1) }
  })
})()
function drawPeel(l: Layer, pl: Peel): void {
  if (pl.on === 'air') {
    const { art, cx, cy } = PEEL_TUMBLE[pl.turn] ?? { art: PEEL_FLAT, cx: 2, cy: 2 }
    const x0 = Math.round(pl.x - cx)
    const y0 = Math.round(pl.y - cy)
    art.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i]
        const lit = j === 0 || art[j - 1]?.[i] !== 'y'
        const col = ch === 'y' ? (lit ? BANANA[3] : BANANA[2]) : ch === 'b' ? BANANA[0] : undefined
        if (col !== undefined) l.set(x0 + i, y0 + j, col)
      }
    })
    return
  }
  const art = pl.on === 'hat' ? PEEL_HAT : PEEL_FLAT
  const w = art[0]?.length ?? 0
  const h = art.length
  const x0 = Math.round(pl.x - w / 2 + (pl.on === 'ground' ? 0.5 : 0))
  const y0 = Math.round(pl.y - h + 2)
  art.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i]
      const col = ch === 'y' ? (j === 0 ? BANANA[3] : BANANA[2]) : ch === 'g' ? BANANA[1] : ch === 'b' ? BANANA[0] : undefined
      if (col !== undefined) l.set(x0 + i, y0 + j, col)
    }
  })
}
function legGeometry(p: Pose) {
  const [ux, uy] = up(p.lean)
  const front: P = [uy * -1, ux]
  const legs: [P, readonly number[], number, number][] = [
    [[p.bx, p.by], RED, 1.6, -0.6],
    [[p.fx, p.fy], MUSTARD, 2.2, 0.6],
  ]
  return legs.map(([foot, ramp, base, side]) => {
    const root: P = [p.hx + front[0] * side, p.hy + front[1] * side]
    const knee = joint(root, foot, 3.9, 3.9, -1)
    const sx = foot[0] - knee[0]
    const sy = foot[1] - knee[1]
    const sl = Math.max(0.01, Math.hypot(sx, sy))
    const toe: P = [foot[0] + (-sy / sl) * -2.4, foot[1] + (sx / sl) * -2.4]
    const tip: P = [toe[0] + (-sy / sl) * -0.8 + ux, toe[1] + (sx / sl) * -0.8 + uy]
    return { root, knee, foot, toe, tip, ramp, base }
  })
}
function drawLegs(l: Layer, p: Pose, dim = 0, shoes = true): void {
  for (const { root, knee, foot, toe, tip, ramp, base } of legGeometry(p)) {
    l.limb(root, knee, 1, ramp, base - dim)
    l.limb(knee, foot, 0.9, ramp, base - dim)
    if (!shoes) continue
    l.limb(foot, toe, 0.8, SHOE, 1.4 - dim)
    l.set(tip[0], tip[1], SHOE[2] ?? 0)
  }
}
function legSweep(from: number, to: number): readonly [number, number, number, number] {
  const pts = Array.from({ length: 13 }, (_, k) => legGeometry(pose(lerp(from, to, k / 12)))).flat().flatMap(g => [g.root, g.knee, g.foot, g.toe, g.tip])
  const xs = pts.map(q => q[0])
  const ys = pts.map(q => q[1])
  return [Math.max(0, Math.floor(Math.min(...xs) - 2)), Math.max(0, Math.floor(Math.min(...ys) - 2)), Math.min(W - 1, Math.ceil(Math.max(...xs) + 2)), Math.min(H - 1, Math.ceil(Math.max(...ys) + 2))]
}
function drawJester(l: Layer, f: number): void {
  const p = pose(f)
  const [ux, uy] = up(p.lean)
  const hip: P = [p.hx, p.hy]
  const s = shoulder(p)
  const hd = headAt(p)
  const front: P = [uy * -1, ux]
  if (f === WHIP) for (const k of SMEAR) drawLegs(l, pose(f + k), 0.8, k > 0)
  drawLegs(l, p)
  const x0 = Math.floor(Math.min(hip[0], s[0]) - 4)
  const y0 = Math.floor(Math.min(hip[1], s[1]) - 4)
  for (let y = y0; y <= y0 + 14; y++) {
    for (let x = x0; x <= x0 + 14; x++) {
      const rx = x - hip[0]
      const ry = y - hip[1]
      const height = rx * ux + ry * uy
      const across = rx * front[0] + ry * front[1]
      const dag = Math.round(across + 9) % 2 ? 0.8 : 0
      if (height < -1.8 - dag || height > 6.2) continue
      const width = 2.4 + Math.max(0, -height) * 0.5 - Math.max(0, height - 2) * 0.15
      if (Math.abs(across) > width) continue
      const isFront = across > 0
      l.set(x, y, shade(isFront ? RED : MUSTARD, 2 + (across > width - 1.1 ? 1 : 0) - (across < -width + 1.1 ? 1 : 0), x, y))
    }
  }
  for (let k = -2.5; k <= 2.5; k += 0.5) l.set(hip[0] + front[0] * k + ux * 1.4, hip[1] + front[1] * k + uy * 1.4, GOLD[2] ?? 0)
  for (let k = -2.4; k <= 2.4; k += 0.5) {
    const x = s[0] + front[0] * k
    const y = s[1] + front[1] * k
    l.set(x, y, RUFF[Math.round(k * 2) % 2 ? 1 : 2] ?? 0)
    l.set(x + ux * -0.8, y + uy * -0.8, RUFF[1] ?? 0)
  }
  l.disc(hd[0], hd[1], 2.5, (x, y, dx, dy) => shade(SKIN, 2 + (dx * front[0] + dy * front[1] > 0.8 ? 1 : dx * front[0] + dy * front[1] < -1.2 ? -1 : 0), x, y))
  l.set(hd[0] + front[0] * 1.2 - ux * 0.2, hd[1] + front[1] * 1.2 - uy * 0.2, OUTLINE)
  l.set(hd[0] + front[0] * 1.4 - ux * 1.4, hd[1] + front[1] * 1.4 - uy * 1.4, SKIN[1] ?? 0)
  const capBase: P = [hd[0] + ux * 1.6, hd[1] + uy * 1.6]
  l.disc(hd[0] + ux * 0.6, hd[1] + uy * 0.6, 2.5, (x, y, dx, dy) => {
    const across = dx * front[0] + dy * front[1]
    const height = dx * ux + dy * uy
    if (height < 0.3) return l.px[Math.round(y) * W + Math.round(x)] ?? 0
    return shade(across > 0 ? RED : MUSTARD, 2 + (height > 1.6 ? 1 : 0), x, y)
  })
  const tips = bells[f] ?? []
  tips.forEach((tip, i) => {
    const ramp = i === 0 ? MUSTARD : RED
    const mid: P = [(capBase[0] + tip[0]) / 2 + ux * 1.6, (capBase[1] + tip[1]) / 2 + uy * 1.6]
    l.limb(capBase, mid, 1.3, ramp, 2)
    l.limb(mid, tip, 0.8, ramp, 2)
  })
  tips.forEach(tip => l.disc(tip[0], tip[1] + 0.8, 0.9, (x, y, dx, dy) => shade(GOLD, 5 + (dx > 0 && dy < 0 ? 1.5 : 0), x, y)))
  for (const near of [false, true]) {
    const h = hand(near, f)
    const root: P = [s[0] + front[0] * (near ? 1 : -0.6), s[1] + front[1] * (near ? 1 : -0.6) + 0.6]
    const bone = near ? 3.8 : Math.min(3.8, Math.hypot(h[0] - root[0], h[1] - root[1]) / 2 + 0.6)
    const elbow = joint(root, h, bone, bone, near ? -1 : 1)
    const ramp = near ? RED : MUSTARD
    l.limb(root, elbow, 0.9, ramp, near ? 2.4 : 1.6)
    l.limb(elbow, h, 0.8, ramp, near ? 2.4 : 1.6)
    l.disc(h[0], h[1], 0.8, (x, y) => shade(SKIN, near ? 3 : 2, x, y))
  }
}
function drawBackground(c: Canvas, f: number): void {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (y >= 26) {
        const row = Math.floor((y - 26) / 2)
        const cx = mod(x + row * 2, 5)
        const cy = (y - 26) % 2
        const isGap = cx === 0
        const tone = Math.floor(((x + row * 2) / 5) * 7 + row * 3) % 3 === 0 ? -0.4 : 0
        c.set(x, y, shade(COBBLE, isGap ? 1.4 : 3.2 + (cy === 0 && cx >= 3 ? 1 : 0) + tone - (y === 26 ? 1 : 0), x, y))
        continue
      }
      const crenel = y < 6 && y >= 3 && mod(x, 8) >= 5
      if (y < 3 || crenel) {
        c.set(x, y, shade(SKY, 1 + y * 0.45, x, y))
        continue
      }
      const course = Math.floor((y - 3) / 3)
      const bx = mod(x + (course % 2) * 3, 6)
      const by = (y - 3) % 3
      const isMortar = bx === 0 || by === 2
      const block = Math.floor((x + (course % 2) * 3) / 6) * 7 + course * 13
      const tone = (block % 5 === 0 ? -0.5 : 0) + (block % 7 === 3 ? 0.4 : 0)
      const cap = y === 3 || (y === 6 && mod(x, 8) >= 5) ? 1.2 : 0
      c.set(x, y, shade(STONE, isMortar ? 2.2 : 3.6 + tone + (by === 0 ? 0.6 : 0) + cap - (y > 22 ? (y - 22) * 0.2 : 0), x, y))
    }
  }
  for (let y = 12; y < 26; y++) {
    for (let x = 52; x <= 61; x++) {
      const d = y < 16 ? Math.hypot(x - 56.5, (y - 16) * 1.1) : Math.abs(x - 56.5)
      if (d < 4) c.set(x, y, shade(STONE, d > 3 && x > 56 ? 1 : 0.2, x, y))
      else if (d < 5.2) c.set(x, y, shade(STONE, y < 16 ? 4.8 : 4.2, x, y))
    }
  }
  for (const bx0 of [9, 43]) {
    for (let y = 7; y < 20; y++) {
      const sway = Math.round(wave(f, LOOP, 2, bx0 / 20) * clamp((y - 13) / 6))
      for (let x = bx0; x < bx0 + 6; x++) {
        const tail = y >= 18 && Math.abs(x - bx0 - 2.5) < (y - 17) * 1.2
        if (tail) continue
        const isMotif = Math.abs(x - bx0 - 2.5) + Math.abs(y - 12.5) < 2
        c.set(x + sway, y, isMotif ? shade(GOLD, Math.abs(x - bx0 - 2.5) + Math.abs(y - 12.5) < 1 ? 5 : 4, x, y) : shade(BANNER, 2 + (x === bx0 + 5 ? 1 : x === bx0 ? -1 : 0), x, y))
      }
      c.set(bx0 - 1 + sway, 7, GOLD[3] ?? 0)
    }
    c.rect(bx0 - 1, 6, 8, 1, x => shade(GOLD, x === bx0 + 6 ? 5 : 3, x, 6))
  }
  for (let y = 0; y < 4; y++) c.set(50, y, shade(STONE, y === 0 ? 6 : 1.6, 50, y))
  for (let x = 51; x < 58; x++) {
    const k = x - 51
    const dy = Math.round(wave(f, LOOP, 4, -k * 0.12) * k * 0.18)
    const half = 1.4 - k * 0.18
    for (let y = Math.round(1.4 - half + dy); y <= Math.round(1.4 + half + dy); y++) c.set(x, y, shade(RED, 3 - (y > 1 + dy ? 1 : 0), x, y))
  }
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    drawBackground(c, f)
    const p = pose(f)
    const pl = peel(f)

    const shadowAt = (sx: number, rx: number) => {
      for (let x = Math.floor(sx - rx); x <= Math.ceil(sx + rx); x++) {
        for (const y of [28, 29]) {
          if (Math.abs(x - sx) / rx + (y === 29 ? 0.4 : 0) < 1) c.set(x, y, shade(COBBLE, 1, x, y))
        }
      }
    }
    shadowAt(p.hx - 1.5, clamp(5.5 - (24 - p.hy) * 0.2, 3, 6))
    if (pl.on === 'air') shadowAt(pl.x - 1, 1.5)
    const l = new Layer()
    if (pl.on === 'ground') drawPeel(l, pl)
    drawJester(l, f)
    if (pl.on !== 'ground') drawPeel(l, pl)
    for (let b = 0; b < 3; b++) {
      const [bx, by] = ball(b, f)
      const [qx, qy] = ball(b, mod(f - 1, LOOP))
      const ramp = BALLS[b] ?? BALLS[0] ?? []
      const cx = Math.round(bx) + 0.5
      const cy = Math.round(by) - 1
      const sx = Math.round(qx) - Math.round(bx)
      const sy = Math.round(qy) - Math.round(by)
      if (Math.hypot(sx, sy) > 2.5) l.disc(cx + sx * 0.45, cy + sy * 0.45, 1.1, (x, y) => shade(ramp, 2, x, y))
      l.disc(cx, cy, 1.6, (x, y, dx, dy) => shade(ramp, dx > 0 && dy < 0 ? 3 : dx < 0 && dy > 0 ? 1 : 2, x, y))
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const col = l.px[y * W + x] ?? -1
        if (col >= 0) {
          c.set(x, y, col)
          continue
        }
        const n = (dx: number, dy: number) => {
          const ix = x + dx
          const iy = y + dy
          return ix >= 0 && ix < W && iy >= 0 && iy < H && (l.px[iy * W + ix] ?? -1) >= 0
        }
        if (n(1, 0) || n(-1, 0) || n(0, 1) || n(0, -1)) c.set(x, y, OUTLINE)
      }
    }
    for (const [x, y] of glints(f)) c.set(x, y, GOLD[7] ?? 0)
    if (f >= LAND && f < LAND + 8) {
      const t = (f - LAND) / 8
      for (const side of [-1, 1]) {
        const px = p.hx + side * (2 + t * 6)
        const py = GROUND - 1 - t * 2
        const r = 1.2 + t * 1.4
        for (let y = Math.floor(py - r); y <= Math.ceil(py + r); y++) {
          for (let x = Math.floor(px - r); x <= Math.ceil(px + r); x++) {
            const d = Math.hypot(x - px, y - py) / r
            if (d < 1 && (1 - t) * (1.2 - d) > threshold(x, y) * 0.9) c.set(x, y, shade(DUST, 3 - d * 2 - t, x, y))
          }
        }
      }
    }
  })
}
function glints(f: number): P[] {
  if (!JINGLES.includes(f) && !JINGLES.includes(f - 1)) return []
  const r = JINGLES.includes(f) ? 2 : 3
  return (bells[f] ?? []).flatMap(([bx, by]) => ([[1, -1], [-1, -1], [1, 0.6], [-1, 0.6]] as const).map(([dx, dy]): P => [bx + dx * r, by + 0.8 + dy * r]))
}
const glintBox = (f: number): readonly [number, number, number, number] => {
  const g = glints(f)
  return [Math.floor(Math.min(...g.map(q => q[0]))), Math.floor(Math.min(...g.map(q => q[1]))), Math.ceil(Math.max(...g.map(q => q[0]))), Math.ceil(Math.max(...g.map(q => q[1])))]
}
export const scene: Scene = {
  verb: 'Tomfoolering',
  render: () => render().map((px, f) => shake(px, f === LAND ? 1 : f === LAND + 1 ? -1 : 0)),
  hero: 13,
  snaps: [
    { frames: [LAND, LAND + 2], why: 'the landing shakes the whole picture a pixel down, then up, then back' },
    { frames: WHIP, box: legSweep(WHIP - 1, WHIP + (SMEAR.at(-1) ?? 0)), why: 'the whip of the slip: his legs fly up faster than the eye, drawn as one smear frame from where they were to where they are going' },
    { frames: WHIP + 1, box: legSweep(WHIP + (SMEAR[0] ?? 0), WHIP + 1), why: 'the smear clears as his legs arrive overhead' },
    { frames: CATCH[2], box: glintBox(CATCH[2]), colors: [GOLD[7] ?? 0], why: 'the bell jingles as he catches the third ball: a glint springs from it' },
  ],
}
function shake(px: Int32Array, dy: number): Int32Array {
  if (dy === 0) return px
  const out = new Int32Array(W * H)
  for (let y = 0; y < H; y++) {
    const sy = Math.min(H - 1, Math.max(0, y - dy))
    out.set(px.subarray(sy * W, sy * W + W), y * W)
  }
  return out
}