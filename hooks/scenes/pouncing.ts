import { Canvas, TAU, beat, clamp, ease, hash, hex, lerp, random, shade, smoothstep, threshold, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const HORIZON = 13
const GROUND = 25
const SUN_X = 11
const SUN_Y = 10

const SKY = hex('1b1d4a 282a60 3b3274 5b3e88 874e92 b56492 de8494 f5a898 fdd0a8')
const SNOW = hex('262a5a 363e7c 4c56a0 6874bc 8a96d2 aeb6e2 d0d0ee ebe1ef fcf1ec')
const FOX = hex('2a1020 541a26 8a2a1e bc4418 e2661c f68c30 fcb658 fedc94')
const FUR = hex('46487e 7072a8 a4a4cc d2cee4 f2eaee fffaf4')
const INK = hex('140c1a 2a1a2c 48303e')
const PINE = hex('3a2f62 54427c 6e5890')
const GRASS = hex('2e1c26 5a3428 8c5630 bc8040 e2ae5c f8d890')
const MOUSE = hex('3a2a2e 6e5450 a08478')
const SUN = hex('fde4b4 fff4dc fffcf2')

type V = readonly [number, number]
const JOINTS = [
  'nose', 'head', 'neck', 'shoulder', 'hip', 'tailBase', 'tailMid', 'tailTip',
  'fTop', 'fKnee', 'fFoot', 'fKneeF', 'fFootF', 'bTop', 'bHock', 'bFoot', 'bHockF', 'bFootF',
] as const
type Joint = (typeof JOINTS)[number]
type Pose = { readonly [K in Joint]: V } & { readonly ear: number }

const STAND: Pose = {
  nose: [9, -3.5], head: [6.8, -3.8], neck: [4.8, -2.2], shoulder: [3, -0.4], hip: [-3, -0.4],
  tailBase: [-4.8, -0.3], tailMid: [-8, 0.4], tailTip: [-10.8, 1.6],
  fTop: [3, 1], fKnee: [3.4, 3], fFoot: [3.4, 5], fKneeF: [2.2, 3], fFootF: [2, 5],
  bTop: [-3, 1], bHock: [-4.6, 3.2], bFoot: [-3.6, 5], bHockF: [-3.4, 3.2], bFootF: [-2.4, 5],
  ear: 0,
}
const LISTEN: Pose = {
  ...STAND,
  nose: [8.8, -0.9], head: [6.8, -2.4], neck: [4.8, -1.8],
  tailMid: [-8, 0.9], tailTip: [-10.6, 2.6],
  ear: -0.35,
}
const CROUCH: Pose = {
  nose: [9, 0.4], head: [6.9, -1.2], neck: [4.8, -0.9], shoulder: [3, 0.2], hip: [-3, 0.7],
  tailBase: [-4.8, 0.9], tailMid: [-8, 2], tailTip: [-10.8, 2.8],
  fTop: [3, 1.4], fKnee: [4.4, 2.3], fFoot: [3.8, 3.5], fKneeF: [3.4, 2.4], fFootF: [2.6, 3.5],
  bTop: [-3, 1.8], bHock: [-5.4, 2.4], bFoot: [-3.4, 3.5], bHockF: [-4.6, 2.7], bFootF: [-2.6, 3.5],
  ear: 0.15,
}
const STRETCH: Pose = {
  nose: [11, -0.8], head: [8.8, -1.2], neck: [6.6, -0.8], shoulder: [4, -0.3], hip: [-4, -0.3],
  tailBase: [-5.8, -0.3], tailMid: [-9.3, 0], tailTip: [-12.6, 0.4],
  fTop: [4, 1], fKnee: [6.2, 1.8], fFoot: [8.4, 2.2], fKneeF: [5.8, 2.4], fFootF: [8, 2.8],
  bTop: [-4, 1], bHock: [-6.3, 2.2], bFoot: [-8.8, 2.8], bHockF: [-5.8, 2.6], bFootF: [-8.2, 3.4],
  ear: 0.8,
}
const TUCK: Pose = {
  nose: [10.6, 0.2], head: [8.4, -0.3], neck: [6.3, -0.4], shoulder: [3.8, 0], hip: [-3.6, -0.9],
  tailBase: [-5.4, -1.2], tailMid: [-8.6, -1.8], tailTip: [-11.6, -2.6],
  fTop: [3.8, 1.2], fKnee: [6.4, 1.6], fFoot: [9.2, 1.4], fKneeF: [6, 2], fFootF: [8.8, 2],
  bTop: [-3.6, 0.4], bHock: [-5.8, 1.4], bFoot: [-7.8, 3], bHockF: [-5.3, 2], bFootF: [-7.2, 3.6],
  ear: 1,
}

function mixPose(a: Pose, b: Pose, t: number): Pose {
  const out: Record<string, V | number> = { ear: lerp(a.ear, b.ear, t) }
  for (const j of JOINTS) out[j] = [lerp(a[j][0], b[j][0], t), lerp(a[j][1], b[j][1], t)]
  return out as unknown as Pose
}

function nudge(p: Pose, moves: Partial<Record<Joint, V>>): Pose {
  const out: Record<string, V | number> = { ...p }
  for (const [j, [dx, dy]] of Object.entries(moves) as [Joint, V][]) out[j] = [p[j][0] + dx, p[j][1] + dy]
  return out as unknown as Pose
}

function trot(p: Pose, phase: number, amount: number): Pose {
  const leg = (x: number, y: number, k: number): [V, V] => {
    const swing = Math.sin(phase + k)
    const lift = Math.max(0, Math.cos(phase + k))
    const foot: V = [x + swing * 1.8 * amount, 5 - lift * 1.6 * amount]
    return [foot, [(x + foot[0]) / 2 + 0.5 * amount * lift, 3 - lift * 0.8 * amount]]
  }
  const [fFoot, fKnee] = leg(3.2, 0, 0)
  const [fFootF, fKneeF] = leg(2.2, 0, Math.PI)
  const [bFoot, bHock] = leg(-3.4, 0, Math.PI)
  const [bFootF, bHockF] = leg(-2.6, 0, 0)
  const t = clamp(amount)
  return {
    ...mixPose(p, { ...p, tailMid: [-8.2, -0.2], tailTip: [-11.4, 0.2] }, t),
    fFoot, fKnee, fFootF, fKneeF,
    bFoot: [bFoot[0] - 0.4, bFoot[1]], bHock: [bHock[0] - 1.2, bHock[1]],
    bFootF: [bFootF[0] - 0.4, bFootF[1]], bHockF: [bHockF[0] - 1.1, bHockF[1]],
  }
}

type HeadLook = 'level' | 'down' | 'rig'
type Fox = { pose: Pose; x: number; y: number; angle: number; tilt: number; look: HeadLook; mouse: boolean; snowy: boolean }

type Part = 'tip' | 'tail' | 'body' | 'chest' | 'neck' | 'snout' | 'thigh' | 'arm'
const CAPSULES: readonly (readonly [Joint, Joint, number, number, Part])[] = [
  ['tailTip', 'tailMid', 1.5, 2.2, 'tip'],
  ['tailMid', 'tailBase', 2.2, 1.1, 'tail'],
  ['tailBase', 'hip', 1.1, 2.2, 'body'],
  ['hip', 'shoulder', 2.2, 2.3, 'body'],
  ['shoulder', 'neck', 2.3, 1.6, 'chest'],
  ['neck', 'head', 1.6, 1.8, 'neck'],
  ['head', 'nose', 1.8, 0.6, 'snout'],
  ['hip', 'bHock', 1.7, 0.6, 'thigh'],
  ['shoulder', 'fKnee', 1.2, 0.5, 'arm'],
]

const HEADS: Record<'level' | 'down', readonly string[]> = {
  level: [
    '.k..k....',
    '.dO.dO...',
    'LOOOOOo..',
    'OOOOeooon',
    'Oowwwwww.',
    '.ggwww...',
  ],
  down: [
    '.k..k...',
    '.dO.dO..',
    'LOOOOOo.',
    'OOOOeoo.',
    'Oowwwooo',
    '.ggwwwwn',
  ],
}
const HEAD_INK: Readonly<Record<string, number>> = {
  L: FOX[6] ?? 0, O: FOX[5] ?? 0, o: FOX[4] ?? 0, d: INK[2] ?? 0, k: INK[0] ?? 0, e: INK[0] ?? 0, n: INK[0] ?? 0,
  w: FUR[3] ?? 0, g: FUR[1] ?? 0,
}

const LX = -0.74
const LY = -0.67
const EMPTY = -1
const OUTLINE = 0x3a2650

function drawFox(fox: Fox): Canvas {
  const c = new Canvas()
  c.fill(EMPTY)
  const cos = Math.cos(fox.angle)
  const sin = Math.sin(fox.angle)
  const place = (lx: number, ly: number): V => [fox.x + cos * lx - sin * ly, fox.y + sin * lx + cos * ly]
  const at = (j: Joint): V => {
    const [lx, ly] = fox.pose[j]
    if (fox.tilt === 0 || (j !== 'head' && j !== 'nose')) return place(lx, ly)
    const [nx, ny] = fox.pose.neck
    const ct = Math.cos(fox.tilt)
    const st = Math.sin(fox.tilt)
    return place(nx + ct * (lx - nx) - st * (ly - ny), ny + st * (lx - nx) + ct * (ly - ny))
  }

  const legs = new Set<number>()
  const leg = (top: Joint, knee: Joint, foot: Joint, upper: number, lower: number) => {
    const [ax, ay] = at(top)
    const [bx, by] = at(knee)
    const [dx, dy] = at(foot)
    c.line(ax, ay, bx, by, upper)
    c.line(bx, by, dx, dy, (x, y) => {
      legs.add(y * W + x)
      return lower
    })
  }
  leg('fTop', 'fKneeF', 'fFootF', FOX[1] ?? 0, INK[1] ?? 0)
  leg('bTop', 'bHockF', 'bFootF', FOX[1] ?? 0, INK[1] ?? 0)
  leg('fTop', 'fKnee', 'fFoot', FOX[3] ?? 0, INK[0] ?? 0)
  leg('bTop', 'bHock', 'bFoot', FOX[3] ?? 0, INK[0] ?? 0)

  const caps = CAPSULES.filter(k => fox.look === 'rig' || k[4] !== 'snout').map(([a, b, ra, rb, part]) => {
    const [ax, ay] = at(a)
    const [bx, by] = at(b)
    return { ax, ay, bx, by, ra, rb, part }
  })
  type Hit = { score: number; k: number; t: number; d: number; cx: number; cy: number; r: number }
  const hit = (x: number, y: number): Hit => {
    let best: Hit = { score: Infinity, k: 0, t: 0, d: 0, cx: 0, cy: 0, r: 1 }
    caps.forEach((s, k) => {
      const vx = s.bx - s.ax
      const vy = s.by - s.ay
      const t = clamp(((x - s.ax) * vx + (y - s.ay) * vy) / Math.max(1e-6, vx * vx + vy * vy))
      const cx = s.ax + vx * t
      const cy = s.ay + vy * t
      const r = lerp(s.ra, s.rb, t)
      const d = Math.hypot(x - cx, y - cy)
      if (d - r < best.score) best = { score: d - r, k, t, d, cx, cy, r }
    })
    return best
  }
  const inside = (x: number, y: number) => hit(x, y).score < 0
  const xs = caps.flatMap(s => [s.ax, s.bx])
  const ys = caps.flatMap(s => [s.ay, s.by])
  for (let y = Math.floor(Math.min(...ys) - 3); y <= Math.ceil(Math.max(...ys) + 3); y++) {
    for (let x = Math.floor(Math.min(...xs) - 3); x <= Math.ceil(Math.max(...xs) + 3); x++) {
      const h = hit(x, y)
      const s = caps[h.k]
      if (h.score >= 0 || !s) continue
      const len = Math.max(1e-6, Math.hypot(s.bx - s.ax, s.by - s.ay))
      const ux = (s.by - s.ay) / len
      const uy = -(s.bx - s.ax) / len
      const nx = h.d > 0.01 ? (x - h.cx) / h.d : ux
      const ny = h.d > 0.01 ? (y - h.cy) / h.d : uy
      const lam = nx * LX + ny * LY
      const side = nx * ux + ny * uy
      const rimLit = (!inside(x - 1, y) || !inside(x, y - 1)) && lam > 0.2
      let level = 3.6 + lam * 1.5 * Math.min(1, (h.d / h.r) * 1.6) + (rimLit ? 1.4 : 0)
      const isWhite = (s.part === 'tip' && h.t < 0.45) || ((s.part === 'chest' || s.part === 'neck') && side < -0.3) || (s.part === 'snout' && side < 0.15)
      if (s.part === 'tip' && h.t >= 0.45 && h.t < 0.75) level -= 1.3
      if (s.part === 'body' && side < -0.55) level -= 1
      c.set(x, y, isWhite ? shade(FUR, level - 0.2) : shade(FOX, level))
    }
  }

  const a = fox.angle + fox.tilt
  const up: V = [Math.sin(a), -Math.cos(a)]
  const fwd: V = [Math.cos(a), Math.sin(a)]
  const [hx, hy] = at('head')
  let mouth: V
  const head = new Set<number>()
  if (fox.look !== 'rig') {
    const sx = Math.round(hx) - 2
    const sy = Math.round(hy) - 3
    const art = HEADS[fox.look]
    const pricked = fox.pose.ear < -0.2 ? ['..k..k..', ...art.slice(1)] : art
    pricked.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const color = HEAD_INK[row[i] ?? '.']
        if (color === undefined) continue
        c.set(sx + i, sy + j, color)
        head.add((sy + j) * W + sx + i)
      }
    })
    mouth = fox.look === 'level' ? [sx + 6, sy + 5] : [sx + 6, sy + 6]
    if (fox.snowy) for (const [dx, dy] of [[0, 2], [1, 1], [2, 1], [3, 2], [4, 2]] as const) c.set(sx + dx, sy + dy, FUR[5] ?? 0)
  } else {
    const e = a - fox.pose.ear * 1.1
    const earDir: V = [Math.sin(e), -Math.cos(e)]
    const behind = (x: number, y: number, color: number) => {
      if (c.get(x, y) === EMPTY) c.set(x, y, color)
    }
    const fb: V = [hx + up[0] * 1.6 - fwd[0] * 1.4, hy + up[1] * 1.6 - fwd[1] * 1.4]
    behind(fb[0], fb[1], FOX[2] ?? 0)
    behind(fb[0] + earDir[0] * 1.2, fb[1] + earDir[1] * 1.2, INK[1] ?? 0)
    const nb: V = [hx + up[0] * 1.7, hy + up[1] * 1.7]
    c.set(nb[0], nb[1], FOX[5] ?? 0)
    c.set(nb[0] - fwd[0], nb[1] - fwd[1], INK[1] ?? 0)
    c.set(nb[0] + earDir[0] * 1.3, nb[1] + earDir[1] * 1.3, INK[0] ?? 0)
    c.set(hx + fwd[0] * 0.8 + up[0] * 0.4, hy + fwd[1] * 0.8 + up[1] * 0.4, INK[0] ?? 0)
    const [px, py] = at('nose')
    c.set(px + fwd[0] * 0.5, py + fwd[1] * 0.5, INK[0] ?? 0)
    mouth = [Math.round(px - fwd[0]), Math.round(py + 1)]
    if (fox.snowy) {
      for (const k of [-1, 0, 1]) c.set(hx + up[0] * 1.2 + fwd[0] * k, hy + up[1] * 1.2 + fwd[1] * k, FUR[5] ?? 0)
    }
  }
  if (fox.mouse) {
    const [mx, my] = mouth
    for (const [dx, dy, k] of [[-1, 0, 1], [0, 0, 2], [1, 0, 2], [-1, 1, 0], [0, 1, 1], [1, 1, 1], [2, 1, 0], [-2, 1, 0], [-3, 2, 0]] as const) {
      c.set(mx + dx, my + dy, MOUSE[k] ?? 0)
    }
  }

  const edge: number[] = []
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (c.get(x, y) !== EMPTY) continue
      const from = (dx: number, dy: number) => {
        const nx = x + dx
        const ny = y + dy
        return nx >= 0 && ny >= 0 && c.get(nx, ny) !== EMPTY && !legs.has(ny * W + nx) && !head.has(ny * W + nx)
      }
      if (from(-1, 0) || from(0, -1)) edge.push(y * W + x)
    }
  }
  for (const i of edge) c.px[i] = OUTLINE

  return c
}

const X0 = 18
const ROOT_Y = GROUND - 5
const HOLE_X = 45
const T_CROUCH = 13
const T_JUMP = 21
const T_HIT = 37
const T_SUNK = 42
const T_PULL = 50
const T_OUT = 62
const T_GO = 68

const TAKEOFF: V = [X0 + 0.5, ROOT_Y + 1.5]
const ENTRY: V = [42, 15]
const SUNK: V = [44, 24]
const LANDED: V = [39, ROOT_Y]

const AWAY = [0, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
const IN = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 0, 0, 0]
const T_IN = LOOP - IN.length
const IN_FROM = X0 - IN.reduce((a, b) => a + b, 0)
function trotted(steps: readonly number[], k: number): { dx: number; phase: number; speed: number } {
  let dx = 0
  let phase = 0
  for (let i = 0; i <= k; i++) {
    dx += steps[i] ?? 0
    phase += ((steps[i] ?? 0) * TAU) / 12
  }
  return { dx, phase, speed: ((steps[k] ?? 0) + (steps[k + 1] ?? 0)) / 2 }
}

function flight(p: number): { x: number; y: number; angle: number } {
  const xAt = (q: number) => lerp(TAKEOFF[0], ENTRY[0], 1 - (1 - q) ** 1.3)
  const yAt = (q: number) => lerp(TAKEOFF[1], ENTRY[1], q) - 12 * 4 * q * (1 - q)
  const dx = xAt(Math.min(1, p + 0.02)) - xAt(Math.max(0, p - 0.02))
  const dy = yAt(Math.min(1, p + 0.02)) - yAt(Math.max(0, p - 0.02))
  const along = clamp(Math.atan2(dy, dx), -0.9, 1.25)
  return { x: xAt(p), y: yAt(p), angle: (along + lerp(-0.9, 1.25, p)) / 2 }
}

const sine = (t: number) => (1 - Math.cos(Math.PI * clamp(t))) / 2

function foxAt(f: number): Fox {
  const still = { tilt: 0, mouse: false, snowy: false, look: 'rig' as HeadLook }
  if (f < T_CROUCH) {
    const peer = f >= 5 && f < 11 ? 1 : 0
    const pose = nudge(LISTEN, { head: [0.4 * peer, peer], nose: [0.4 * peer, peer], neck: [0, 0.5 * peer] })
    return { ...still, look: 'down', pose: { ...pose, ear: f >= 3 && f < 9 ? -0.35 : 0 }, x: X0, y: ROOT_Y, angle: 0 }
  }
  if (f < T_JUMP) {
    const t = ease.inOut(beat(f, T_CROUCH, T_CROUCH + 5))
    const coil = 0.5 * beat(f, T_JUMP - 3, T_JUMP - 1)
    const rear = f === T_JUMP - 1 ? -0.12 : 0
    return { ...still, look: 'down', pose: nudge(mixPose(LISTEN, CROUCH, t), { hip: [0, coil] }), x: X0, y: Math.round(ROOT_Y + 1.5 * t), angle: rear }
  }
  if (f < T_HIT) {
    const p = (f - T_JUMP + 1) / (T_HIT - T_JUMP)
    const { x, y, angle } = flight(p)
    const lift = Math.min(1, (f - T_JUMP + 1) / 3)
    const pose = p < 0.25 ? mixPose(CROUCH, STRETCH, p / 0.25) : mixPose(STRETCH, TUCK, ease.inOut(beat(p, 0.45, 0.95)))
    return { ...still, pose, x, y, angle: lerp(-0.15, angle, lift) }
  }
  if (f < T_SUNK) {
    const p = 1 - (1 - (f - T_HIT + 1) / (T_SUNK - T_HIT)) ** 1.5
    const { angle } = flight(1)
    return { ...still, pose: TUCK, x: lerp(ENTRY[0], SUNK[0], p), y: lerp(ENTRY[1], SUNK[1], p), angle: lerp(angle, Math.PI / 2, p) }
  }
  if (f < T_PULL) {
    const k = (f - T_SUNK) / (T_PULL - T_SUNK)
    const wag = Math.sin(TAU * k)
    const kick = Math.sin(TAU * k * 2)
    const pose = nudge(TUCK, {
      tailMid: [0, wag * 1.2], tailTip: [0.4, wag * 2.8],
      bFoot: [kick * 1.4, -kick * 0.6], bHock: [kick * 0.6, 0], bFootF: [-kick * 1.4, kick * 0.6],
    })
    return { ...still, pose, x: SUNK[0], y: SUNK[1] - (kick > 0.7 ? 1 : 0), angle: Math.PI / 2 }
  }
  if (f < T_OUT) {
    const p = beat(f, T_PULL, T_OUT)
    const e = ease.inOut(p)
    const swing = (p + sine(p)) / 2
    return {
      ...still, mouse: p > 0.3, snowy: p > 0.3, look: p > 0.8 ? 'level' : 'rig',
      pose: mixPose(TUCK, STAND, swing),
      x: lerp(SUNK[0], LANDED[0], e), y: lerp(SUNK[1], LANDED[1], e) - 6 * Math.sin(Math.PI * p),
      angle: lerp(Math.PI / 2, 0, swing),
    }
  }
  if (f < T_GO) {
    const shake = Math.sin((TAU * (f - T_OUT)) / (T_GO - T_OUT))
    return {
      ...still, look: 'level', mouse: true, snowy: f <= T_OUT + 1,
      pose: nudge(STAND, { head: [shake * 0.6, 0], neck: [shake * 0.3, 0], tailTip: [0, shake * 1.5], tailMid: [0, shake * 0.6] }),
      x: LANDED[0], y: LANDED[1], angle: 0,
    }
  }
  const { dx, phase, speed } = trotted(AWAY, f - T_GO)
  return { ...still, look: 'level', mouse: true, pose: trot(STAND, phase, clamp(speed / 1.4)), x: LANDED[0] + dx, y: LANDED[1], angle: 0 }
}

function foxesAt(f: number): Fox[] {
  const foxes = f < T_GO + AWAY.length ? [foxAt(f)] : []
  if (f >= T_IN) {
    const { dx, phase, speed } = trotted(IN, f - T_IN)
    const settle = ease.inOut(beat(f, LOOP - 4, LOOP))
    foxes.push({
      tilt: 0, mouse: false, snowy: false, look: settle > 0.5 ? 'down' : 'level',
      pose: mixPose(trot(STAND, phase, clamp(speed / 1.4)), { ...LISTEN, ear: 0 }, settle), x: IN_FROM + dx, y: ROOT_Y, angle: 0,
    })
  }
  return foxes
}

type Chunk = { x: number; y: number; vx: number; vy: number; land: number; big: boolean; gone: number }
function spray(seed: number, count: number, x: number, y: number, power: number, spread: number): Chunk[] {
  const rng = random(seed)
  return Array.from({ length: count }, () => ({
    x: x + (rng() - 0.5) * spread, y, vx: (rng() - 0.5) * 3.4 * power, vy: -(0.8 + rng() * 2.4) * power,
    land: GROUND - 1 + rng() * 5, big: rng() > 0.6, gone: 64 + rng() * 26,
  }))
}
const BURST = spray(0xf0c5, 44, HOLE_X, GROUND - 1, 1.45, 6)
const PULL = spray(0xb4c6, 10, HOLE_X - 1, GROUND - 2, 0.6, 3)
const SHAKE = spray(0x5ac3, 10, LANDED[0] + 1, ROOT_Y - 2, 0.7, 8)
const G = 0.34

function chunkAt(ch: Chunk, t: number): [number, number, boolean] {
  const tl = (-ch.vy + Math.sqrt(ch.vy * ch.vy + 2 * G * Math.max(0, ch.land - ch.y))) / G
  if (t >= tl) return [ch.x + ch.vx * tl, ch.land, true]
  return [ch.x + ch.vx * t, ch.y + ch.vy * t + (G * t * t) / 2, false]
}

const PINES: readonly (readonly [number, number, number])[] = [
  [0, 6, 1], [3, 4, 0], [5, 8, 1], [8, 3, 0], [15, 5, 0], [17, 9, 1], [20, 6, 1], [23, 3, 0],
  [47, 3, 0], [50, 6, 1], [53, 4, 0], [56, 9, 1], [59, 6, 1], [62, 8, 1],
]
const DRIFTS = [
  { y: 17.5, a: 1, k: 0.09, p: 2.1 },
  { y: 21.5, a: 1.3, k: 0.07, p: 4 },
  { y: 28.5, a: 1.4, k: 0.06, p: 1.3 },
]
const STALKS: readonly (readonly [number, number, number])[] = [
  [1, 7, -0.15], [2, 5, 0.12], [4, 8, 0.2], [6, 4, -0.1], [57, 6, -0.2], [59, 9, 0.12], [60, 5, 0.3], [62, 7, -0.1],
]
const SPARKLES: readonly (readonly [number, number])[] = [[27, 16], [36, 19], [52, 17], [9, 21], [58, 26], [31, 29], [21, 18]]

function skyLevel(x: number, y: number): number {
  const d = Math.hypot(x - SUN_X, (y - SUN_Y) * 1.4)
  return (clamp(y / HORIZON) ** 1.4) * 8 + Math.max(0, 1 - d / 16) ** 2 * 2.6
}

function snowLevel(x: number, y: number): number {
  let level = 6.3 - (y - HORIZON) * 0.06 + Math.max(0, 1 - Math.hypot((x - SUN_X) * 0.5, (y - HORIZON) * 1.6) / 9) * 2
  for (const d of DRIFTS) {
    const dy = y - Math.round(d.y + d.a * Math.sin(x * d.k + d.p))
    const m = smoothstep(-0.3, 0.5, Math.sin(x * d.k * 0.6 + d.p * 2.3))
    if (dy === 0) level += 0.9 * m
    else if (dy === 1) level -= 1.4 * m
    else if (dy === 2) level -= 0.7 * m
  }
  if (y > 29) level -= (y - 29) * 0.6
  return level
}

function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const layers = foxesAt(f).map(drawFox)
    const isBuried = f >= T_HIT && f < T_PULL + 3
    const foxPixel = (x: number, y: number) => {
      if (y >= GROUND && (isBuried || y > GROUND + 1)) return EMPTY
      for (let k = layers.length - 1; k >= 0; k--) {
        const color = layers[k]?.get(x, y) ?? EMPTY
        if (color !== EMPTY) return color
      }
      return EMPTY
    }
    const shows = (x: number, y: number) => foxPixel(x, y) !== EMPTY

    const shadow = new Set<number>()
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!shows(x, y)) continue
        const h = GROUND - y
        if (h < 0) continue
        const sy = Math.round(GROUND + 0.5 + h * 0.2)
        for (let sx = Math.round(x + h * 0.9); sx <= Math.round(x + (h + 1) * 0.9); sx++) shadow.add(sy * W + sx)
      }
    }

    for (let y = 0; y <= HORIZON; y++) {
      for (let x = 0; x < W; x++) c.set(x, y, shade(SKY, skyLevel(x, y), x, y, true))
    }
    c.disc(SUN_X, SUN_Y, 2.6, SUN[0] ?? 0)
    c.disc(SUN_X, SUN_Y, 1.9, SUN[1] ?? 0)
    c.disc(SUN_X - 0.4, SUN_Y - 0.4, 0.9, SUN[2] ?? 0)
    for (const [px, height, near] of PINES) {
      for (let k = 0; k < height; k++) {
        const y = HORIZON - height + 1 + k
        const hw = Math.max(0, Math.round(k * 0.42) - (k > 2 && k % 2 === 1 ? 1 : 0))
        for (let x = px - hw; x <= px + hw; x++) {
          const isRim = Math.hypot(x - SUN_X, y - SUN_Y) < 7 && (x === px - hw || x === px + hw)
          c.set(x, y, PINE[near ? (isRim ? 1 : 0) : isRim ? 2 : 1] ?? 0)
        }
      }
    }

    const hole = f >= T_HIT ? 2.6 * (1 - ease.inOut(beat(f, 64, 90))) : 0
    for (let y = HORIZON + 1; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let level = snowLevel(x, y)
        if (shadow.has(y * W + x)) level -= 2.2
        c.set(x, y, shade(SNOW, level, x, y))
      }
    }
    if (hole > 0.4) {
      for (let x = Math.floor(HOLE_X - hole - 2); x <= Math.ceil(HOLE_X + hole + 2); x++) {
        const d = Math.abs(x - HOLE_X) / hole
        if (d < 1) {
          c.set(x, GROUND, SNOW[d < 0.6 ? 0 : 1] ?? 0)
          if (d < 0.7) c.set(x, GROUND + 1, SNOW[2] ?? 0)
        }
        if (d >= 1 && d < 1 + 1.5 / hole) c.set(x, GROUND - 1, SNOW[8] ?? 0)
      }
    }

    const flying: [number, number, boolean, boolean][] = []
    for (const [chunks, t0] of [[BURST, T_HIT], [PULL, T_PULL + 1], [SHAKE, T_OUT + 1]] as const) {
      if (f < t0) continue
      for (const ch of chunks) {
        const [x, y, landed] = chunkAt(ch, f - t0)
        if (landed) {
          if (ch.big && f < ch.gone && y > HORIZON) c.set(x, y, SNOW[7] ?? 0)
        } else flying.push([x, y, ch.big, f - t0 < 4])
      }
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) if (shows(x, y)) c.set(x, y, foxPixel(x, y))
    }
    if (isBuried) {
      for (let x = HOLE_X - 3; x <= HOLE_X + 3; x++) c.set(x, GROUND, SNOW[Math.abs(x - HOLE_X) < 2 ? 8 : 7] ?? 0)
    }

    if (f >= T_HIT && f < T_HIT + 9) {
      const t = (f - T_HIT) / 9
      const r = 3.5 + t * 6
      for (let y = Math.floor(GROUND - r * 1.2); y <= GROUND + 1; y++) {
        for (let x = Math.floor(HOLE_X - r); x <= Math.ceil(HOLE_X + r); x++) {
          const d = Math.hypot(x - HOLE_X, (y - GROUND + 1) * 0.85) / r
          const density = (1 - t) * (1.1 - d)
          if (d < 1 && density > threshold(x, y) * 0.9) c.set(x, y, SNOW[density > 0.5 ? 8 : 7] ?? 0)
        }
      }
    }
    for (const [x, y, big, isFresh] of flying) {
      c.set(x, y, isFresh && big ? (SUN[1] ?? 0) : (SNOW[8] ?? 0))
      if (big) c.set(x + 1, y, SNOW[6] ?? 0)
    }

    for (const [sx, height, lean] of STALKS) {
      const sway = Math.round(wave(f, LOOP, 3, sx * 0.13) * 0.8)
      const tx = sx + lean * height + sway
      c.line(sx, H - 1, tx, H - height, GRASS[1] ?? 0)
      c.set(tx, H - height, GRASS[5] ?? 0)
      c.set(tx, H - height + 1, GRASS[4] ?? 0)
    }

    for (const [gx, gy] of SPARKLES) {
      const phase = Math.floor(hash(gx, gy) * 24)
      if ((f + phase) % 24 < 2 && c.get(gx, gy) !== (SNOW[0] ?? 0)) c.set(gx, gy, SUN[2] ?? 0)
    }

    out.push(c.px)
  }
  return out
}

export const scene: Scene = {
  verb: 'Pouncing', render, hero: 29,
  snaps: [
    { frames: 22, box: [24, 11, 30, 17], colors: [...FUR.slice(2, 4)], why: 'the launch: the fox springs off the snow at its fastest' },
    { frames: 28, box: [18, 8, 22, 11], colors: [...FUR.slice(2, 4), 0xf5a898, 0xbc4418], why: 'the white tail tip sweeps up as the fox turns over at the top of the leap' },
    { frames: 31, box: [44, 11, 47, 13], colors: [...FUR.slice(2, 4), 0x3a2650, 0x140c1a, 0xe2661c], why: 'the white chest turns under as it tips into the dive' },
    { frames: 37, box: [39, 5, 44, 9], colors: [...FUR.slice(4, 6), 0x3a2650, 0x8a2a1e, 0xf68c30], why: 'the tail tip whips down as it hits the snow' },
    { frames: 55, box: [36, 7, 41, 10], colors: [0xd2cee4, 0xfffaf4, 0xb56492], why: 'the snowy head swings up out of the hole' },
    { frames: 57, box: [48, 20, 51, 25], colors: [...MOUSE.slice(1, 3), 0x3a2650], why: 'the mouse swings up with the head' },
    { frames: 61, box: [27, 20, 34, 23], colors: [...FOX.slice(2, 4), 0x3a2650, 0xfcf1ec, 0x140c1a], why: 'the hind legs swing under as it lands from the hop' },
  ],
}
