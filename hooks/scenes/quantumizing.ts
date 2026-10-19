import { Canvas, TAU, beat, clamp, ease, hex, mod, shade, smoothstep, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 48
const CX = 32
const CY = 16

const BG = hex('05041a 0a0824 100e33 161743 1b2452 21345e 2a4868')
const ORBIT = hex('1c1a48 2a2b6a 3b438f 5566b3 7f9cd6 bcdcf2')
const CLOUD = hex('102a52 164a74 1d7496 2ea2b4 5ccccc a2eedf effff6')
const PROTON = hex('2c0a1c 5c1428 922431 c84434 ec7a48 fbb878 fff0c8')
const NEUTRON = hex('1a1636 342d58 554c80 7e76a6 aaa4c8 dcd8ee')
const PHOTON = hex('6a3a12 b07018 eebc44 fff0b0 ffffff')

const HIT = 24
const SPREAD_START = 33
const SPREAD_END = 44

type Orbit = { rot: number; rx: number; ry: number }
const ORBITS: Orbit[] = [
  { rot: 0, rx: 29, ry: 6.5 },
  { rot: 0.5, rx: 27, ry: 6 },
  { rot: -0.5, rx: 27, ry: 6 },
]

function at(o: Orbit, t: number): { x: number; y: number; z: number; tx: number; ty: number } {
  const ex = o.rx * Math.cos(t)
  const ey = o.ry * Math.sin(t)
  const dx = -o.rx * Math.sin(t)
  const dy = o.ry * Math.cos(t)
  const c = Math.cos(o.rot)
  const s = Math.sin(o.rot)
  const tx = dx * c - dy * s
  const ty = dx * s + dy * c
  const n = Math.hypot(tx, ty) || 1

  return { x: CX + ex * c - ey * s, y: CY + ex * s + ey * c, z: Math.sin(t), tx: tx / n, ty: ty / n }
}

type Step = { x: number; y: number; z: number; t: number }
const PATHS: Step[][] = ORBITS.map(o => {
  const raw: Step[] = []
  for (let i = 0; i < 900; i++) {
    const t = (i / 900) * TAU
    const p = at(o, t)
    const x = Math.round(p.x)
    const y = Math.round(p.y)
    const last = raw[raw.length - 1]
    if (last && last.x === x && last.y === y) continue
    raw.push({ x, y, z: p.z, t })
  }
  const first = raw[0]
  const end = raw[raw.length - 1]
  if (first && end && first.x === end.x && first.y === end.y) raw.pop()
  const keep: Step[] = []
  for (let i = 0; i < raw.length; i++) {
    const a = raw[mod(i - 1, raw.length)]
    const b = raw[i]
    const n = raw[mod(i + 1, raw.length)]
    if (!a || !b || !n) continue
    const isCorner = Math.abs(a.x - n.x) === 1 && Math.abs(a.y - n.y) === 1 && keep[keep.length - 1] !== a
    if (isCorner && keep.length > 0) continue
    keep.push(b)
  }

  return keep
})

type Ball = { x: number; y: number; z: number; isProton: boolean }
const BALLS: Ball[] = ([
  [-3.4, 0.6, -1, false], [3.4, 0.4, -1, true], [0, -2.6, -0.6, true], [0.2, 2.8, -0.4, false],
  [-2, -1.2, 0, true], [2, -1.3, 0, false], [-1.8, 1.6, 0.2, false], [2, 1.5, 0.2, true], [0, 0, 1, true],
] as const).map(([x, y, z, isProton]) => ({ x, y, z, isProton })).sort((a, b) => a.z - b.z)
const BALL_R = 2.1
const NUCLEUS_R = 5.2

function cloudiness(f: number): number {
  if (f < HIT) return 1
  if (f < SPREAD_START) return 0
  return smoothstep(SPREAD_START, SPREAD_END, f)
}

const GHOSTS = 3
const FOUND = [2.24, -0.5, 0.4]
const DIR = [1, -1, -1]

const clock = (f: number) => (f < HIT ? f + LOOP : f)
const FOUND_AT = HIT - 1 + LOOP
const DOT_RATE = 0.068
const CLOUD_RATE = (TAU / GHOSTS - DOT_RATE * (SPREAD_START - (HIT - 1))) / (FOUND_AT - SPREAD_START)
const BREATH: number[] = (() => {
  const b: number[] = []
  let phase = 0
  for (let c = 0; c <= FOUND_AT; c++) {
    b.push(phase)
    phase += TAU / (12 - 4 * smoothstep(LOOP + 12, FOUND_AT, c))
  }
  return b
})()
const sway = (o: number, k: number, c: number) => 0.08 * (Math.sin((TAU * (c - FOUND_AT)) / 20 + o * 2.1 + k * 1.7) - Math.sin(o * 2.1 + k * 1.7))
function ghost(o: number, k: number, f: number): { t: number; b: number } {
  const c = clock(f)
  const t = (FOUND[o] ?? 0) + (DIR[o] ?? 1) * CLOUD_RATE * (c - FOUND_AT) + (k / GHOSTS) * TAU + sway(o, k, c) * cloudiness(f)
  const turn = (BREATH[c] ?? 0) - (BREATH[FOUND_AT] ?? 0) + (k === 0 ? 0 : k * Math.PI + o)
  return { t, b: 0.75 + 0.25 * Math.cos(turn) }
}
const dotT = (o: number, f: number) => (FOUND[o] ?? 0) + (DIR[o] ?? 1) * DOT_RATE * (f - (HIT - 1))
const TARGET = (() => {
  const p = at(ORBITS[0] as Orbit, FOUND[0] ?? 0)
  return { x: Math.round(p.x), y: Math.round(p.y) }
})()
const angleTo = (from: number, to: number) => mod(to - from + Math.PI, TAU) - Math.PI
function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const q = cloudiness(f)
    const flash = f === HIT ? 3.2 : f === HIT + 1 ? 1.6 : f === HIT + 2 ? 0.7 : 0
    const spread = beat(f, SPREAD_START, SPREAD_END)

    type Smear = { x: number; y: number; z: number; tx: number; ty: number; b: number; len: number; wid: number }
    const smears: Smear[] = []
    ORBITS.forEach((o, i) => {
      if (q > 0) {
        for (let k = 0; k < GHOSTS; k++) {
          const g = ghost(i, k, f)
          const isDots = mod(k - (DIR[i] ?? 1), GHOSTS) === 0 && f >= SPREAD_START && f < SPREAD_END
          const t = isDots ? dotT(i, f) + angleTo(dotT(i, f), g.t) * ease.inOut(spread) : g.t
          const p = at(o, t)
          smears.push({ ...p, b: g.b * q * 1.15, len: 2.5 + 3.4 * q, wid: 1.4 + 1.8 * q })
        }
      }
    })
    const front = new Float32Array(W * H)
    const back = new Float32Array(W * H)
    const glow = new Float32Array(W * H)
    for (const s of smears) {
      const field = s.z >= 0 ? front : back
      for (let y = Math.floor(s.y - 9); y <= Math.ceil(s.y + 9); y++) {
        for (let x = Math.floor(s.x - 11); x <= Math.ceil(s.x + 11); x++) {
          if (x < 0 || x >= W || y < 0 || y >= H) continue
          const dx = x - s.x
          const dy = y - s.y
          const along = (dx * s.tx + dy * s.ty) / s.len
          const across = (-dx * s.ty + dy * s.tx) / s.wid
          const d2 = along * along + across * across
          if (d2 < 1) field[y * W + x] = (field[y * W + x] ?? 0) + s.b * (1 - d2) ** 1.2
          const g = Math.hypot(dx * 0.7, dy) / 9
          if (g < 1) glow[y * W + x] = (glow[y * W + x] ?? 0) + s.b * (1 - g) ** 2
        }
      }
    }
    if (q < 1) {
      ORBITS.forEach((o, i) => {
        const p = at(o, dotT(i, f))
        for (let y = Math.floor(p.y - 8); y <= Math.ceil(p.y + 8); y++) {
          for (let x = Math.floor(p.x - 11); x <= Math.ceil(p.x + 11); x++) {
            if (x < 0 || x >= W || y < 0 || y >= H) continue
            const g = Math.hypot((x - p.x) * 0.7, y - p.y) / 8
            if (g < 1) glow[y * W + x] = (glow[y * W + x] ?? 0) + (1 - q) * 0.9 * (1 - g) ** 2
          }
        }
      })
    }
    c.fill((x, y) => {
      const d = Math.hypot((x - CX) * 0.62, y - CY)
      const v = Math.hypot((x - CX) / 34, (y - CY) / 20)
      return shade(BG, 2.6 - d / 7 - v * 0.6 + Math.min(2, (glow[y * W + x] ?? 0) * 1.3) + flash, x, y)
    })
    const drawOrbits = (isFront: boolean) => {
      PATHS.forEach((path, i) => {
        for (const p of path) {
          if (p.z >= 0 !== isFront) continue
          const lit = Math.min(2, (glow[p.y * W + p.x] ?? 0) * 1.3)
          const swell = 0.5 + 0.5 * Math.sin(p.t * 3 - (DIR[i] ?? 1) * (f / LOOP) * TAU * 3 + i)
          const haze = q * swell * (isFront ? 1 : 0.7)
          c.set(p.x, p.y, haze > 0.55
            ? shade(CLOUD, 0.2 + haze * 1.6 + lit * 0.6, p.x, p.y)
            : shade(ORBIT, (isFront ? 1.3 : 0.45) + lit + flash * 0.8, p.x, p.y))
        }
      })
    }
    const drawCloud = (field: Float32Array, isFront: boolean) => {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const d = field[y * W + x] ?? 0
          if (d < 0.3) continue
          if (!isFront && Math.hypot(x - CX, (y - CY) * 1.1) < NUCLEUS_R) continue
          c.set(x, y, shade(CLOUD, d < 0.5 ? 0 : 0.4 + d * 4 - (isFront ? 0 : 0.7), x, y))
        }
      }
    }
    drawOrbits(false)
    drawCloud(back, false)
    for (const b of BALLS) {
      const bx = CX + b.x
      const by = CY + b.y
      const ramp = b.isProton ? PROTON : NEUTRON
      for (let y = Math.floor(by - BALL_R); y <= Math.ceil(by + BALL_R); y++) {
        for (let x = Math.floor(bx - BALL_R); x <= Math.ceil(bx + BALL_R); x++) {
          const nx = (x - bx) / BALL_R
          const ny = (y - by) / BALL_R
          const r2 = nx * nx + ny * ny
          if (r2 > 1) continue
          const nz = Math.sqrt(1 - r2)
          const lit = clamp(-nx * 0.45 - ny * 0.6 + nz * 0.55)
          const level = 1 + lit * 3.4 + b.z * 0.5 + flash * 0.5 + (r2 > 0.7 ? -0.6 : 0)
          c.set(x, y, shade(ramp, level, x, y))
        }
      }
      if (b.z >= 0) c.set(Math.round(bx - 0.8), Math.round(by - 0.9), shade(ramp, 5.2 + flash, 0, 0))
    }
    drawOrbits(true)
    drawCloud(front, true)
    if (q < 1) {
      ORBITS.forEach((o, i) => {
        const p = at(o, dotT(i, f))
        const x = Math.round(p.x)
        const y = Math.round(p.y)
        const isHidden = p.z < 0 && Math.hypot(x - CX, (y - CY) * 1.1) < NUCLEUS_R
        if (isHidden) return
        const power = 1 - q
        for (let lag = 3; lag >= 1; lag--) {
          const tp = at(o, dotT(i, f - lag * 0.8))
          c.set(tp.x, tp.y, shade(CLOUD, 1 + power * (4 - lag), 0, 0))
        }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          c.set(x + dx, y + dy, shade(CLOUD, 1.6 + power * 3.4, 0, 0))
        }
        c.set(x, y, shade(CLOUD, 2 + power * 4.4, 0, 0))
        if (f === HIT || f === HIT + 1) {
          const reach = f === HIT ? 3 : 2
          for (let k = 2; k <= reach; k++) {
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.set(x + dx * k, y + dy * k, shade(CLOUD, 6 - k, 0, 0))
          }
        }
      })
    }
    if (f >= 15 && f < HIT) {
      const p = beat(f, 15, HIT)
      const hx = Math.round(-4 + (TARGET.x + 4) * p)
      const hy = Math.round(TARGET.y - 13 + 13 * p)
      for (let i = 0; i < 8; i++) {
        const x = hx - i
        const y = hy - Math.round(i * (13 / (TARGET.x + 4))) + Math.round(Math.sin(i * 1.4 - f * 2.2) * 1.2)
        c.set(x, y, shade(PHOTON, 4 - i * 0.55, 0, 0))
      }
    }
    if (f >= HIT && f < HIT + 3) {
      const r = [2.5, 5, 7.5][f - HIT] ?? 0
      for (let y = TARGET.y - 9; y <= TARGET.y + 9; y++) {
        for (let x = TARGET.x - 10; x <= TARGET.x + 10; x++) {
          const d = Math.hypot(x - TARGET.x, (y - TARGET.y) * 1.25)
          if (f === HIT && d < r) c.set(x, y, shade(PHOTON, 4.4 - d * 0.5, x, y))
          if (f > HIT && d > r - 1.2 && d < r) c.set(x, y, shade(PHOTON, f === HIT + 1 ? 3.4 : 2.2, x, y))
        }
      }
      if (f === HIT) {
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
          for (let k = 4; k <= 6; k++) c.set(TARGET.x + dx * k, TARGET.y + dy * Math.round(k * 0.7), PHOTON[3] ?? 0)
        }
      }
    }
    if (f >= HIT + 1 && f < HIT + 9) {
      const p = beat(f, HIT + 1, HIT + 9)
      const hx = TARGET.x - 2 - p * 22
      const hy = TARGET.y + 2 + p * 9
      for (let i = 0; i < 6; i++) {
        const x = Math.round(hx + i)
        const y = Math.round(hy - i * 0.4 + Math.sin(i * 1.4 - f * 2.2))
        c.set(x, y, shade(PHOTON, 3.4 - i * 0.6 - p * 1.2, 0, 0))
      }
    }
    out.push(c.px)
  }
  return out
}
export const scene: Scene = {
  verb: 'Quantumizing',
  render,
  hero: 26,
  snaps: [
    { frames: HIT, why: 'the measurement: a flash lights the field and every cloud collapses to a dot' },
    {
      frames: [HIT + 1, HIT + 3],
      box: [TARGET.x - 9, TARGET.y - 7, TARGET.x + 9, TARGET.y + 7],
      colors: PHOTON,
      why: 'the ring the photon throws off where it hits, gone in two frames',
    },
  ],
}