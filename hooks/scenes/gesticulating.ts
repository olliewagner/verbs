import { Canvas, TAU, beat, clamp, ease, hex, lerp, mod, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const WALL = hex('0b0912 130e1b 1c1424 2a1b2b 3f2530 5a3334 7c4636 a05f3e c27e4a dca05c eec47c f8e2a6 fff4d4')
const QUILT = hex('0a0810 140f1c 201828 30223a 44304e 5c4062')
const DARK = 1.6

const BEAM_X = 31
const BEAM_Y = 13
const BEAM_RX = 27
const BEAM_RY = 15.5
function beamAt(x: number, y: number, f: number): number {
  const d = Math.hypot((x - BEAM_X) / BEAM_RX, (y - BEAM_Y) / BEAM_RY)
  const breathe = 0.15 * Math.sin((TAU * f) / LOOP * 3)
  if (d > 1) return DARK
  const rim = d > 0.93 ? 0.8 : 0
  return DARK + 1.5 + 9.2 * (1 - d * d) ** 0.8 + rim + breathe
}

type Prim = (x: number, y: number) => boolean
function cap(ax: number, ay: number, bx: number, by: number, ra: number, rb: number): Prim {
  const dx = bx - ax
  const dy = by - ay
  const len = dx * dx + dy * dy
  return (x, y) => {
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / len)
    return Math.hypot(x - ax - dx * t, y - ay - dy * t) <= lerp(ra, rb, t)
  }
}
function ell(cx: number, cy: number, rx: number, ry: number, rot = 0): Prim {
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  return (x, y) => {
    const u = (x - cx) * c + (y - cy) * s
    const v = -(x - cx) * s + (y - cy) * c
    return (u / rx) ** 2 + (v / ry) ** 2 <= 1
  }
}
function turn(x: number, y: number, px: number, py: number, a: number): [number, number] {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [px + (x - px) * c - (y - py) * s, py + (x - px) * s + (y - py) * c]
}
function capTurned(ax: number, ay: number, bx: number, by: number, ra: number, rb: number, px: number, py: number, a: number): Prim {
  const [x0, y0] = turn(ax, ay, px, py, a)
  const [x1, y1] = turn(bx, by, px, py, a)
  return cap(x0, y0, x1, y1, ra, rb)
}

function tableAt(table: readonly number[], t: number): number {
  if (t < -1 || t > table.length) return 0
  const i = Math.floor(t)
  const a = i < 0 ? 0 : (table[i] ?? 0)
  const b = table[i + 1] ?? 0
  return lerp(a, b, t - i)
}

type Puppet = { solid: Prim[]; holes: Prim[]; x: number; y: number; rot: number; scale: number }

function dog(f: number): Puppet | undefined {
  if (f > 32) return undefined
  const rise = ease.outBack(beat(f, 0, 8))
  const sink = ease.in(beat(f, 27, 32))
  const barks = [[9, 1], [13, 1], [19, 1.25]] as const
  let jaw = 0
  for (const [at, size] of barks) jaw = Math.max(jaw, size * tableAt([0, 0.35, 0.5, 0.25, 0.08], f - at + 1))
  const ear = -jaw * 0.6 - tableAt([0, 0.25, 0.25], f - 5)
  const tilt = (f >= 23 && f < 28 ? -0.14 * Math.sin(Math.PI * beat(f, 23, 28)) : 0) - jaw * 0.18
  return {
    solid: [
      cap(-16, 16, 0, 1, 3.6, 3.1),
      ell(5, -2.5, 7, 4.3, -0.12),
      ell(3.5, -4.2, 4.6, 3.4),
      cap(8, -3.4, 15.4, -1.9, 2.7, 1.9),
      ell(15.6, -2.2, 1.5, 1.4),
      capTurned(7, 1, 14.5, 2, 1.6, 1.2, 7, 0.5, jaw),
      capTurned(3, -5.5, 0.6, -11.5, 1.7, 1.1, 3, -5.5, ear),
    ],
    holes: [ell(10.4, -3.8, 0.9, 0.6)],
    x: lerp(6, 19, rise) - sink * 10,
    y: lerp(40, 20, rise) + sink * 22,
    rot: tilt,
    scale: 1,
  }
}

function birdPhase(f: number): number {
  return (TAU * Math.max(0, f - 31)) / 16
}

function bird(f: number): Puppet | undefined {
  if (f < 30 || f > 64) return undefined
  const rise = ease.out(beat(f, 30, 42))
  const away = ease.in(beat(f, 50, 63))
  const phase = birdPhase(f) + Math.PI / 2
  const lift = 0.02 + 0.52 * Math.sin(phase)
  const trail = -0.5 * Math.cos(phase)
  const solid: Prim[] = [
    ell(0, -0.6, 2.6, 2.3),
    cap(0, -1, 1, -5.4, 1.5, 1.3),
    ell(1.3, -6.4, 2.3, 2),
    cap(3.1, -6.7, 6.8, -5.8, 1, 0.3),
    ell(-1.2, 2.2, 1.4, 2, 0.5),
  ]
  for (const side of [-1, 1]) {
    const rx = side * 1.8
    const ry = -0.6
    const dx = side * Math.cos(lift)
    const dy = -Math.sin(lift)
    const nx = side * Math.sin(lift)
    const ny = Math.cos(lift)
    const hx = rx + dx * 8
    const hy = ry + dy * 8
    solid.push(cap(rx, ry, hx, hy, 1.9, 1.4))
    solid.push(cap(rx + nx * 1.6, ry + ny * 1.6, rx + dx * 5.5 + nx * 0.8, ry + dy * 5.5 + ny * 0.8, 2.3, 1.2))
    for (let k = 0; k < 4; k++) {
      const a = lift + trail + (k - 1.5) * 0.34
      const len = k === 1 || k === 2 ? 7 : 6
      solid.push(cap(hx, hy, hx + side * Math.cos(a) * len, hy - Math.sin(a) * len, 0.8, 0.45))
    }
  }
  const bob = Math.round(Math.sin(phase) * 0.8)
  return {
    solid,
    holes: [ell(1.8, -6.8, 0.6, 0.6)],
    x: lerp(30, 74, away),
    y: lerp(40, 14, rise) + bob - away * 30,
    rot: -away * 0.3,
    scale: 1.2,
  }
}

function wrists(f: number): Puppet | undefined {
  if (f < 30 || f > 64) return undefined
  const rise = ease.out(beat(f, 30, 42))
  const drop = beat(f, 50, 62) ** 2
  const bob = Math.round(Math.sin(birdPhase(Math.min(f, 50)) + Math.PI / 2) * 0.8)
  return {
    solid: [cap(-0.5, 1.5, -14, 18, 1.1, 1.8), cap(0.8, 2, -11, 19, 1, 1.7)],
    holes: [],
    x: 30 - drop * 8,
    y: lerp(40, 14, rise) + (f < 50 ? bob : 0) + drop * 22,
    rot: 0,
    scale: 1.2,
  }
}

function rabbit(f: number): Puppet | undefined {
  if (f < 62 || f > 95.5) return undefined
  const rise = ease.outBack(beat(f, 62, 68))
  const sink = ease.in(beat(f, 88, 95))
  const hop = f >= 82 && f < 87 ? Math.sin(Math.PI * beat(f, 82, 87)) * 3 : 0
  const twitch = tableAt([0, -0.6, 0, -0.6, 0], f - 69) + tableAt([0, -0.6, 0], f - 84)
  const wiggle = (at: number) => tableAt([0, 0.12, 0.2, 0.08, -0.1, -0.12, -0.02, 0.06, 0.03, 0], f - at + 1)
  const flop = f >= 75 && f < 82 ? Math.sin(Math.PI * beat(f, 75, 82)) * 1.6 : 0
  const ears: Prim[] = []
  for (const [bx, by, base, w, droop] of [[-0.6, -4.8, -0.42, wiggle(68) + wiggle(78), 0], [1.6, -5, -0.16, wiggle(70) + wiggle(84), flop]] as const) {
    const a = base + w
    const mx = bx + Math.sin(a) * 4.8
    const my = by - Math.cos(a) * 4.8
    const b = a + droop
    ears.push(cap(bx, by, mx, my, 1.5, 1.45), cap(mx, my, mx + Math.sin(b) * 4.4, my - Math.cos(b) * 4.4, 1.45, 0.7))
  }
  return {
    solid: [
      ell(-5.4, 4.2, 6.6, 5),
      ell(-11.6, 3.4, 1.7, 1.7),
      ell(1.4, -1.6, 4.4, 3.8),
      ell(4.8, -0.2 + twitch, 2.6, 2.1),
      ell(7.2, -0.7 + twitch, 0.8, 0.7),
      ell(2.4, 5.4, 2.2, 1.6),
      ...ears,
    ],
    holes: [ell(2.9, -2.6, 0.9, 0.8)],
    x: 36,
    y: lerp(40, 21, rise) + sink * 24 - hop,
    rot: 0,
    scale: 1.25,
  }
}

const SHUTTER = [-0.375, -0.125, 0.125, 0.375] as const

function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const cover = new Float32Array(W * H)
    for (const dt of SHUTTER) {
      const t = f + dt
      const puppets = [dog(t), wrists(t), bird(t), rabbit(t)].filter((p): p is Puppet => p !== undefined)
      const inside = (x: number, y: number) => {
        for (const p of puppets) {
          const [tx, ty] = turn(x - p.x, y - p.y, 0, 0, -p.rot)
          const lx = tx / p.scale
          const ly = ty / p.scale
          if (p.holes.some(h => h(lx, ly))) continue
          if (p.solid.some(s => s(lx, ly))) return true
        }
        return false
      }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inside(x, y)) cover[y * W + x] = (cover[y * W + x] ?? 0) + 1 / SHUTTER.length
    }
    const at = (x: number, y: number) => (x >= 0 && x < W && y >= 0 && y < H ? (cover[y * W + x] ?? 0) : 0)

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const lit = beamAt(x, y, f)
        const stripe = mod(x, 8) === 3 ? -0.5 : 0
        const level = lit + (lit > DARK ? stripe : 0)
        const shadow = Math.max(at(x, y), 0.5 * Math.max(at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)))
        c.set(x, y, shade(WALL, lerp(level, Math.min(level, DARK + 0.2), shadow), x, y))
      }
    }
    for (let x = 0; x < W; x++) {
      const top = 28 + Math.round(Math.sin(x * 0.21) * 0.8 + Math.sin(x * 0.53 + 1) * 0.5)
      for (let y = top; y < H; y++) {
        const fold = mod(x + y * 2, 13) === 0 ? -0.6 : 0
        const lit = clamp((beamAt(x, top - 2, f) - DARK) / 10)
        c.set(x, y, shade(QUILT, (y === top ? 2.4 + lit * 3 : 1.4 + lit * 1.2 - (y - top) * 0.3) + fold, x, y))
      }
    }
    out.push(c.px)
  }
  return out
}

export const scene: Scene = { verb: 'Gesticulating', render, hero: 46 }
