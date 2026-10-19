import { Canvas, PALETTE, TAU, beat, clamp, ease, hex, lerp, mod, particles, shade, smoothstep, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

type V3 = [number, number, number]
type Axis = 0 | 1 | 2

const COLOURS = {
  yellow: hex('6a4410 a8741a d8a428 f2cc40 fff07a fffbd0'),
  red: hex('4a0c1c 7e1424 b8222c e04436 f47258 ffa080'),
  blue: hex('0c1648 162a80 2048b8 3a72e0 70a4f6 b0d4ff'),
  white: hex('4a4a62 7a7a92 aeaebe dcdae2 f6f4f2 ffffff'),
  orange: hex('5a1a08 963410 d0581a f08030 fbae5c ffd8a0'),
  green: hex('0c3a20 156030 1f8a3a 3cb44a 7ad86a b8f0a0'),
} satisfies Record<string, readonly number[]>
type Colour = keyof typeof COLOURS
const PLASTIC = hex('060609 0f0f14 1a1a22 282832 3a3a46')
const WALL = hex('2a2636 3a3448 4e4659 64596c 7c6f7f 978690 b29f9e ccb6a8 e2cdb2')
const DESK = hex('22140f 34201a 4a2e1e 64402a 7e5434 9a6a40 b6844e d0a062 e6c07e')
const LEAF = PALETTE.leaf
const POT = PALETTE.orange

const PITCH = Math.asin(0.5)
const SCALE = 4 * Math.SQRT2
const CX = 32
const CY = 17.5
const YAW = Math.PI / 4
const DESK_Y = -1.5
const WALL_Z = -3.6
const DESK_FRONT = 6
const UP: V3 = [0, Math.cos(PITCH), -Math.sin(PITCH)]
const TOWARD: V3 = [0, Math.sin(PITCH), Math.cos(PITCH)]
const GRAZE = [0.05, 0.4] as const
const SUN: V3 = (() => {
  const v: V3 = [-0.42, 0.82, 0.38]
  const k = Math.hypot(...v)
  return [v[0] / k, v[1] / k, v[2] / k]
})()

const rotate = (v: V3, axis: Axis, a: number): V3 => {
  const c = Math.cos(a)
  const s = Math.sin(a)
  const [x, y, z] = v
  if (axis === 0) return [x, y * c - z * s, y * s + z * c]
  if (axis === 1) return [x * c + z * s, y, -x * s + z * c]
  return [x * c - y * s, x * s + y * c, z]
}

type Sticker = { p: V3; n: V3; colour: Colour }
const FACES: [Axis, number, Colour][] = [
  [1, 1, 'yellow'], [2, 1, 'red'], [0, -1, 'blue'], [1, -1, 'white'], [2, -1, 'orange'], [0, 1, 'green'],
]
const SOLVED: Sticker[] = FACES.flatMap(([axis, side, colour]) => {
  const out: Sticker[] = []
  for (let a = -1; a <= 1; a++) {
    for (let b = -1; b <= 1; b++) {
      const p: V3 = [0, 0, 0]
      const n: V3 = [0, 0, 0]
      p[axis] = side
      n[axis] = side
      const others = ([0, 1, 2] as Axis[]).filter(k => k !== axis)
      p[others[0] ?? 0] = a
      p[others[1] ?? 0] = b
      out.push({ p, n, colour })
    }
  }
  return out
})

type Move = { axis: Axis; layer: number; turn: 1 | -1 }
const SCRAMBLE: Move[] = [
  { axis: 0, layer: 1, turn: 1 },
  { axis: 1, layer: 1, turn: -1 },
  { axis: 2, layer: 1, turn: 1 },
  { axis: 0, layer: -1, turn: -1 },
  { axis: 1, layer: 1, turn: 1 },
]
const SOLVE: Move[] = [...SCRAMBLE].reverse().map(m => ({ ...m, turn: m.turn === 1 ? -1 : 1 }))

const snap = (v: V3): V3 => [Math.round(v[0]), Math.round(v[1]), Math.round(v[2])]
const apply = (state: Sticker[], m: Move): Sticker[] =>
  state.map(s => (s.p[m.axis] !== m.layer ? s : { ...s, p: snap(rotate(s.p, m.axis, (m.turn * TAU) / 4)), n: snap(rotate(s.n, m.axis, (m.turn * TAU) / 4)) }))

const SCRAMBLED = SCRAMBLE.reduce(apply, SOLVED)

const SOLVE_AT = 2
const TWISTS = [
  { frames: 12, cock: 0.04 },
  { frames: 13, cock: 0.06 },
  { frames: 12, cock: 0.04 },
  { frames: 12, cock: 0.04 },
  { frames: 12, cock: 0.04 },
]
const TWIST_AT = TWISTS.map((_, k) => SOLVE_AT + TWISTS.slice(0, k).reduce((a, w) => a + w.frames, 0))
const COCK = 2
function twist(t: number, { frames, cock }: { frames: number; cock: number }): number {
  if (t < COCK) return -cock * ease.out((t + 1) / COCK)
  const u = (t - COCK + 1) / (frames - COCK)
  return lerp(-cock, 1, (1 - Math.cos(Math.PI * u)) / 2)
}
const HOP_AT = SOLVE_AT + TWISTS.reduce((a, w) => a + w.frames, 0)
const WHIRLS = [3, 3, 3, 4, 6]
const SHUFFLE_AT = LOOP - 1 - WHIRLS.reduce((a, b) => a + b, 0)
const SQUASH = [0.05, 0.1, 0.13, 0.14, 0.07, -0.03, -0.04, -0.02, -0.02, -0.03, 0.05, 0.02]
const HOP = [0, 0, 0, 0, 0.07, 0.2, 0.3, 0.34, 0.29, 0.16, 0, 0]
const SHINE_AT = HOP_AT
const SHINE_FOR = 12
const SHINE_WIDTH = 10
const SHINE_REACH = 15 + SHINE_WIDTH

type Pose = { state: Sticker[]; move?: Move; angle: number; hop: number; squash: number; shine: number }
const still = (state: Sticker[]): Pose => ({ state, angle: 0, hop: 0, squash: 0, shine: 0 })
function poseAt(f: number): Pose {
  let state = SCRAMBLED
  for (let k = 0; k < SOLVE.length; k++) {
    const m = SOLVE[k]
    if (!m) continue
    const start = TWIST_AT[k] ?? 0
    const w = TWISTS[k]
    if (f < start || !w) return still(state)
    const t = f - start
    if (t < w.frames) return { ...still(state), move: m, angle: ((m.turn * TAU) / 4) * twist(t, w) }
    state = apply(state, m)
  }
  if (f < SHUFFLE_AT) {
    const t = f - HOP_AT
    return { ...still(state), hop: HOP[t] ?? 0, squash: SQUASH[t] ?? 0, shine: beat(f, SHINE_AT, SHINE_AT + SHINE_FOR) }
  }
  let start = SHUFFLE_AT
  for (let k = 0; k < SCRAMBLE.length; k++) {
    const m = SCRAMBLE[k]
    const n = WHIRLS[k] ?? 1
    if (!m) continue
    const t = f - start
    if (t < n) {
      const isLast = k === SCRAMBLE.length - 1
      const u = (t + 0.5) / n
      return { ...still(state), move: m, angle: ((m.turn * TAU) / 4) * (isLast ? Math.sin((Math.PI / 2) * u) : u) }
    }
    state = apply(state, m)
    start += n
  }
  return still(state)
}
function box(o: V3, d: V3, lo: V3, hi: V3): { t: number; axis: Axis; side: number } | undefined {
  let t0 = -Infinity
  let t1 = Infinity
  let axis: Axis = 0
  let side = 0
  for (const k of [0, 1, 2] as Axis[]) {
    const ok = o[k]
    const dk = d[k]
    if (Math.abs(dk) < 1e-9) {
      if (ok < lo[k] || ok > hi[k]) return undefined
      continue
    }
    let a = (lo[k] - ok) / dk
    let b = (hi[k] - ok) / dk
    let s = -1
    if (a > b) {
      ;[a, b] = [b, a]
      s = 1
    }
    if (a > t0) {
      t0 = a
      axis = k
      side = s
    }
    t1 = Math.min(t1, b)
    if (t0 > t1) return undefined
  }
  return t0 > 0 ? { t: t0, axis, side } : undefined
}
function toCube(o: V3, d: V3, pose: Pose): [V3, V3] {
  const k = 1 - pose.squash
  const wide = 1 + pose.squash * 0.5
  const lift: V3 = [o[0], o[1] - pose.hop, o[2]]
  const ro = rotate(lift, 1, -YAW)
  const rd = rotate(d, 1, -YAW)
  return [
    [ro[0] / wide, (ro[1] - DESK_Y) / k + DESK_Y, ro[2] / wide],
    [rd[0] / wide, rd[1] / k, rd[2] / wide],
  ]
}
type CubeHit = { t: number; colour?: Colour; normal: V3; edge: number; screen: number }
function castCube(o: V3, d: V3, pose: Pose, index: ReadonlyMap<string, Colour>): CubeHit | undefined {
  const [co, cd] = toCube(o, d, pose)
  if (!box(co, cd, [-1.52, -1.52, -1.52], [1.52, 1.52, 1.52])) return undefined
  let best: CubeHit | undefined
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        if (x === 0 && y === 0 && z === 0) continue
        const p: V3 = [x, y, z]
        const m = pose.move
        const isTurning = m !== undefined && p[m.axis] === m.layer
        const lo = isTurning && m ? rotate(co, m.axis, -pose.angle) : co
        const ld = isTurning && m ? rotate(cd, m.axis, -pose.angle) : cd
        const hit = box(lo, ld, [x - 0.5, y - 0.5, z - 0.5], [x + 0.5, y + 0.5, z + 0.5])
        if (!hit || (best && hit.t >= best.t)) continue
        const n: V3 = [0, 0, 0]
        n[hit.axis] = hit.side
        const q: V3 = [lo[0] + ld[0] * hit.t - x, lo[1] + ld[1] * hit.t - y, lo[2] + ld[2] * hit.t - z]
        const others = ([0, 1, 2] as Axis[]).filter(k => k !== hit.axis)
        const edge = Math.max(...others.map(k => Math.abs(q[k])))
        const key = `${x},${y},${z},${n[0]},${n[1]},${n[2]}`
        let world = isTurning && m ? rotate(n, m.axis, pose.angle) : n
        world = rotate(world, 1, YAW)
        const centre = rotate([x + n[0] * 0.5, y + n[1] * 0.5, z + n[2] * 0.5], 1, YAW)
        const sx = centre[0] * SCALE
        const sy = -(centre[1] * UP[1] + centre[2] * UP[2]) * SCALE
        const facing = world[0] * TOWARD[0] + world[1] * TOWARD[1] + world[2] * TOWARD[2]
        const size = 0.37 * smoothstep(GRAZE[0], GRAZE[1], facing)
        best = { t: hit.t, colour: edge < size ? index.get(key) : undefined, normal: world, edge, screen: sx - sy * 0.8 }
      }
    }
  }
  return best
}
function inShadow(p: V3, pose: Pose): boolean {
  const [co, cd] = toCube(p, SUN, pose)
  return box(co, cd, [-1.5, -1.5, -1.5], [1.5, 1.5, 1.5]) !== undefined
}
const blinds = (x: number, y: number) => {
  const u = x + y * 0.7
  if (u < -10 || u > -0.6 || y < -0.6 || y > 5.2) return 0
  return mod(y * 1.7, 1) < 0.66 ? 1 : 0
}
function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const pose = poseAt(f)
    const index = new Map<string, Colour>()
    for (const s of pose.state) index.set(`${s.p.join(',')},${s.n.join(',')}`, s.colour)
    const c = new Canvas()
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const u = (px - CX) / SCALE
        const v = -(py - CY) / SCALE
        const o: V3 = [u + TOWARD[0] * 30, UP[1] * v + TOWARD[1] * 30, UP[2] * v + TOWARD[2] * 30]
        const d: V3 = [-TOWARD[0], -TOWARD[1], -TOWARD[2]]
        const hit = castCube(o, d, pose, index)
        if (hit) {
          const [nx, ny, nz] = hit.normal
          const light = Math.max(0, nx * SUN[0] + ny * SUN[1] + nz * SUN[2])
          if (hit.colour) {
            const across = hit.screen - lerp(-SHINE_REACH, SHINE_REACH, pose.shine)
            const band = 2.4 * clamp(1 - Math.abs(across) / SHINE_WIDTH)
            const level = 0.7 + light * 3.3 + band
            c.set(px, py, shade(COLOURS[hit.colour], level, px, py))
          } else {
            c.set(px, py, shade(PLASTIC, 0.6 + light * 2.2, px, py))
          }
          continue
        }
        const tDesk = (o[1] - DESK_Y) / -d[1]
        const pDesk: V3 = [o[0] + d[0] * tDesk, DESK_Y, o[2] + d[2] * tDesk]
        if (pDesk[2] > WALL_Z && pDesk[2] < DESK_FRONT) {
          const shadow = inShadow(pDesk, pose)
          const [cx, , cz] = rotate([pDesk[0], 0, pDesk[2]], 1, -YAW)
          const near = Math.max(Math.abs(cx), Math.abs(cz))
          const contact = near < 1.9 ? 1.2 * (1 - (near - 1.5) / 0.4) : 0
          const grain = mod(pDesk[2] * 3.1 + Math.sin(pDesk[0] * 0.9) * 0.35, 1) < 0.18 ? -0.5 : 0
          const far = (pDesk[2] - WALL_Z) * 0.18
          const level = 3.2 + far + grain + (shadow ? -2.2 : 0) - clamp(contact, 0, 1.2) * (shadow ? 0.6 : 1)
          c.set(px, py, shade(DESK, level, px, py))
          continue
        }
        const tWall = (o[2] - WALL_Z) / -d[2]
        const pWall: V3 = [o[0] + d[0] * tWall, o[1] + d[1] * tWall, WALL_Z]
        const sun = blinds(pWall[0], pWall[1])
        const shadow = sun > 0 && inShadow(pWall, pose)
        const level = 2.4 + pWall[1] * 0.12 + (sun && !shadow ? 3.8 : 0) + (pWall[1] < DESK_Y + 0.25 ? -0.8 : 0)
        c.set(px, py, shade(WALL, level, px, py))
      }
    }
    for (let y = 24; y <= 29; y++) {
      const half = y < 25 ? 3 : 2.5 - (y - 25) * 0.2
      for (let x = Math.round(55 - half); x <= Math.round(55 + half); x++) {
        const edge = x <= 55 - half + 1 ? 1 : x >= 55 + half - 0.5 ? -1.4 : 0
        c.set(x, y, shade(POT, (y === 24 ? 3.6 : 2.4) + edge, x, y))
      }
    }
    const leaves: [number, number, number][] = [[52, 20, 0], [53, 18, 1], [55, 17, 2], [57, 18, 1], [58, 20, 0], [54, 21, 1], [56, 21, 0], [55, 22, 2], [53, 23, 0], [57, 23, 1], [56, 19, 3], [54, 19, 2]]
    const rustle = f >= SHUFFLE_AT && f < SHUFFLE_AT + 16 ? Math.round(Math.sin(f * 1.7) * 0.6) : 0
    for (const [x, y, k] of leaves) {
      const lit = 1.6 + k * 0.8 - (x > 55 ? 0.8 : 0)
      c.set(x + (y < 20 ? rustle : 0), y, shade(LEAF, lit, x, y))
      c.set(x + 1 + (y < 20 ? rustle : 0), y, shade(LEAF, lit - 0.6, x, y))
    }
    for (const p of particles(f, LOOP, 6, LOOP, 31)) {
      const x = 2 + p.r[0] * 18 + Math.sin(p.age * TAU * 2 + p.r[1] * 6) * 1.5
      const y = 1 + p.r[2] * 9 + Math.sin(p.age * TAU + p.r[3] * 6) * 1.2
      const twinkle = Math.sin(p.age * TAU * 3 + p.r[3] * 6)
      if (twinkle < 0.5) continue
      c.set(x, y, shade(WALL, 6 + twinkle * 2, 0, 0))
    }
    out.push(c.px)
  }
  return out
}
export const scene: Scene = {
  verb: 'Combobulating',
  render,
  hero: 69,
  snaps: [
    { frames: [76, 79], box: [29, 5, 44, 26], why: 'the scramble flurry: the right-hand layer turns a quarter in three frames' },
    { frames: [79, 82], box: [20, 5, 44, 21], why: 'the scramble flurry: the top layer turns a quarter in three frames' },
    { frames: [82, 85], box: [26, 8, 44, 30], why: 'the scramble flurry: the front face turns a quarter in three frames' },
    { frames: [85, 89], box: [20, 8, 38, 30], why: 'the scramble flurry: the left face turns a quarter in four frames' },
    { frames: [89, 93], box: [20, 5, 44, 21], why: 'the scramble flurry: the top layer turns its last quarter, slowing into the muddle' },
  ],
}