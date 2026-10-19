import { Canvas, TAU, clamp, ease, hash, hex, lerp, mod, noise, shade, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 64
const CX = 30
const GROUND = 27.5
const OBL = 0.5
const P = 46
const HORIZON = 20

const SKY = 0x05050b
const STAR = hex('22243a 464a68 8a90b4 dfe4fa')
const SUIT = hex('121426 23283f 3a4160 5b6483 8790aa b6bac8 dddbd8 f6f1e8 fffdf6')
const VISOR = hex('170b05 3a1c08 6b380e a6621a dc9935 f6d27a fff5d0')
const BOOT = hex('0f0f16 1e1e29 33333f 4d4c58 6c6a72 908c90')
const REG = hex('0b0a10 15141b 211e27 2e2a32 3e3940 524c4e 68615d 7f776d 9a8f7e b8ab94')
const OCEAN = hex('060a1c 0c1840 15326f 1f4f9c 3478c4 5ea4e0')
const CONTINENT = hex('0d1a10 1d331c 37532a 5f7a3a 8d9650')
const CLOUD = hex('1a1f33 3e4767 7b86a8 bcc5dc f0f3fa')

type V3 = readonly [number, number, number]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len = (a: V3) => Math.hypot(a[0], a[1], a[2])
const norm = (a: V3): V3 => mul(a, 1 / len(a))
const vlerp = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]

const SUN = norm([-0.75, -0.5, 0.55])
const SUN_LOW = norm([-0.8, -0.5, 0.17])
const EARTHSHINE = norm([0.6, -0.55, 0.4])
const RAY = norm([0, OBL, -1])

type Arm = { elbow: V3; hand: V3 }
type Foot = { a: number; lift: number }
type Pose = { x: number; dy: number; air: number; theta: number; lean: number; feet: [Foot, Foot]; arms: [Arm, Arm] }

function bodyX(f: number): number {
  if (f < 40) return -f
  if (f < 50) return -40 - (8 / 3) * ease.out((f - 40) / 10)
  if (f < 58) return -40 - 8 / 3
  const t = (f - 58) / 6
  return -40 - 8 / 3 - (10 / 3) * t * t
}

const restArm = (s: number, swing: number): Arm => ({ elbow: [-0.9 + swing * 0.6, 3.4 * s, 15.7], hand: [1.5 + swing * 1.3, 3.2 * s, 17.3] })
const tuckArm = (s: number): Arm => ({ elbow: [-0.4, 3.3 * s, 15.4], hand: [1.9, 2.6 * s, 15.9] })

function moonwalk(f: number): Pose {
  const k = Math.floor(f / 8)
  const p = f / 8 - k
  const swap = p < 0.125 ? 0.5 : 0
  const q = p + 1 / 16
  const slide: Foot = { a: 4 - 8 * q, lift: swap }
  const plant: Foot = { a: -4 + 8 * q, lift: 1 - swap }
  const swing = -0.8 * Math.cos((Math.PI * f) / 8)
  return {
    x: -f, dy: 0, air: 0, theta: 0, lean: 0,
    feet: k % 2 === 0 ? [slide, plant] : [plant, slide],
    arms: [restArm(1, swing), restArm(-1, -swing)],
  }
}

function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const foot = (p: Foot, q: Foot): Foot => ({ a: lerp(p.a, q.a, t), lift: lerp(p.lift, q.lift, t) })
  const arm = (p: Arm, q: Arm): Arm => ({ elbow: vlerp(p.elbow, q.elbow, t), hand: vlerp(p.hand, q.hand, t) })
  return {
    x: lerp(a.x, b.x, t), dy: lerp(a.dy, b.dy, t), air: lerp(a.air, b.air, t), theta: lerp(a.theta, b.theta, t),
    lean: lerp(a.lean, b.lean, t),
    feet: [foot(a.feet[0], b.feet[0]), foot(a.feet[1], b.feet[1])],
    arms: [arm(a.arms[0], b.arms[0]), arm(a.arms[1], b.arms[1])],
  }
}

const TUCK: Pose = { x: 0, dy: 0.9, air: 0, theta: 0, lean: 0.2, feet: [{ a: 0.7, lift: 0.5 }, { a: 0.1, lift: 0.5 }], arms: [tuckArm(1), tuckArm(-1)] }
const LANDED: Pose = { ...TUCK, dy: 1.0, lean: 0.4, feet: [{ a: 0.8, lift: 0.3 }, { a: 0.2, lift: 0.3 }] }
const STAND: Pose = {
  x: 0, dy: -0.9, air: 0, theta: 0, lean: 1.2,
  feet: [{ a: 1.0, lift: 1 }, { a: 0.4, lift: 1 }],
  arms: [{ elbow: [4.2, 3.3, 10.6], hand: [7.4, 3.2, 7.9] }, { elbow: [-2.3, -3.5, 15.6], hand: [-0.6, -3.1, 17.8] }],
}

function pose(f: number): Pose {
  const x = bodyX(f)
  if (f < 40) return moonwalk(f)
  if (f < 42) return { ...lerpPose(moonwalk(40 - 1e-6), TUCK, ease.inOut((f - 40) / 2)), x }
  if (f < 50) {
    const s = (f - 42) / 8
    return { ...TUCK, x, theta: TAU * s, air: 2.8 * Math.sin(Math.PI * s), dy: 0.9 * (1 - clamp(s * 3)) }
  }
  if (f < 51) return { ...LANDED, x }
  if (f < 52) return { ...lerpPose(LANDED, STAND, 0.6), x }
  if (f < 58) return { ...STAND, x, lean: STAND.lean + (f >= 54 && f < 57 ? 0.4 : 0) }
  return { ...lerpPose(STAND, moonwalk(0), ease.inOut((f - 58) / 6)), x }
}

type Mat = 'suit' | 'helmet' | 'pack' | 'panel' | 'boot' | 'glove'
type Part = { mat: Mat; isMelted: boolean; group: number; d: (p: V3) => number }

const sdSphere = (c: V3, r: number) => (p: V3) => len(sub(p, c)) - r
function sdCapsule(a: V3, b: V3, r: number): (p: V3) => number {
  const ba = sub(b, a)
  const bb = Math.max(1e-6, dot(ba, ba))
  return p => {
    const pa = sub(p, a)
    return len(sub(pa, mul(ba, clamp(dot(pa, ba) / bb)))) - r
  }
}
function sdBox(c: V3, theta: number, half: V3, r: number): (p: V3) => number {
  const cs = Math.cos(theta)
  const sn = Math.sin(theta)
  return p => {
    const dx = p[0] - c[0]
    const dz = p[2] - c[2]
    const qa = Math.abs(dx * cs + dz * sn) - half[0]
    const qy = Math.abs(p[1] - c[1]) - half[1]
    const qb = Math.abs(-dx * sn + dz * cs) - half[2]
    return Math.hypot(Math.max(qa, 0), Math.max(qy, 0), Math.max(qb, 0)) + Math.min(Math.max(qa, qy, qb), 0) - r
  }
}
function smin(a: number, b: number, k: number): number {
  if (a === Infinity) return b
  const h = clamp(0.5 + (0.5 * (b - a)) / k)
  return lerp(b, a, h) - k * h * (1 - h)
}

function knee(hip: readonly [number, number], ankle: readonly [number, number], l1: number, l2: number): [number, number] {
  const da = ankle[0] - hip[0]
  const dy = ankle[1] - hip[1]
  const d = Math.min(l1 + l2 - 0.01, Math.hypot(da, dy))
  const ua = da / Math.hypot(da, dy)
  const uy = dy / Math.hypot(da, dy)
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
  const out = Math.sqrt(Math.max(0, l1 * l1 - along * along))
  return [hip[0] + ua * along + uy * out, hip[1] + uy * along - ua * out]
}

type Model = { parts: Part[]; theta: number; helmet: V3 }

function model(p: Pose, bx: number): Model {
  const cs = Math.cos(p.theta)
  const sn = Math.sin(p.theta)
  const body = p.dy - p.air
  const at = (a: number, b: number, y: number, isBody = true): V3 => [bx + a * cs - b * sn, y + (isBody ? body : -p.air), a * sn + b * cs]
  const L = (v: V3) => at(v[0], v[1], v[2])
  const lean = p.lean
  const parts: Part[] = []
  let group = 0
  const put = (mat: Mat, isMelted: boolean, d: (q: V3) => number) => parts.push({ mat, isMelted, group, d })

  const helmet = at(0.7 + lean, 0, 8.7)
  put('helmet', false, sdSphere(helmet, 3.9))
  group = 1
  put('suit', true, sdBox(at(0.1 + lean * 0.55, 0, 14.9), p.theta, [1.6, 2.2, 1.9], 1.0))
  put('suit', true, sdCapsule(at(0, -1.5, 19.1), at(0, 1.5, 19.1), 1.6))
  group = 2
  put('pack', false, sdBox(at(-3.5 + lean * 0.55, 0, 14.3), p.theta, [0.8, 3.0, 2.3], 0.6))
  group = 3
  put('panel', false, sdBox(at(2.75 + lean * 0.55, 0, 15.3), p.theta, [0.35, 0.8, 1.1], 0.3))

  for (const [i, s] of [[0, 1], [1, -1]] as const) {
    const arm = p.arms[i]
    group = 4 + i
    const shoulder = at(0.3 + lean * 0.75, 2.9 * s, 12.9)
    const elbow = L(arm.elbow)
    const hand = L(arm.hand)
    put('suit', true, sdCapsule(shoulder, elbow, 1.2))
    put('suit', false, sdCapsule(elbow, hand, 1.05))
    put('glove', false, sdSphere(hand, 1.1))

    const foot = p.feet[i]
    group = 6 + i
    const hipY = 19.4
    const toe: [number, number] = [foot.a + 1.3, 26.6]
    const heel: [number, number] = [foot.a - 1.2, 26.6 - foot.lift * 1.4]
    const ankle: [number, number] = [heel[0] + 0.5, heel[1] - 1.3 - (p.air > 0 ? 0.6 : 0)]
    const k = knee([0, hipY + body + p.air], ankle, 3.7, 3.9)
    const b = 1.3 * s
    put('suit', true, sdCapsule(at(0, b, hipY), at(k[0], b, k[1], false), 1.35))
    put('suit', false, sdCapsule(at(k[0], b, k[1], false), at(ankle[0], b, ankle[1], false), 1.25))
    put('boot', false, sdCapsule(at(heel[0], b, heel[1], false), at(toe[0], b, toe[1], false), 0.95))
  }

  return { parts, theta: p.theta, helmet }
}

function groupAt(m: Model, p: V3): number {
  let best = Infinity
  let group = 0
  for (const part of m.parts) {
    const d = part.d(p)
    if (d < best) {
      best = d
      group = part.group
    }
  }
  return group
}

function sdf(m: Model, p: V3): [number, Mat] {
  let melted = Infinity
  let best = Infinity
  let mat: Mat = 'suit'
  for (const part of m.parts) {
    const d = part.d(p)
    if (part.isMelted) melted = smin(melted, d, 0.5)
    else if (d < best) {
      best = d
      mat = part.mat
    }
  }
  if (melted < best) return [melted, 'suit']
  return [best, mat]
}

function march(m: Model, o: V3, d: V3, far: number): number | undefined {
  let t = 0
  for (let i = 0; i < 120; i++) {
    const s = sdf(m, add(o, mul(d, t)))[0]
    if (s < 0.0005) return t
    t += Math.max(s, 0.0004)
    if (t > far) return undefined
  }
  return undefined
}

function normal(m: Model, p: V3): V3 {
  const e = 0.12
  const g = (dx: number, dy: number, dz: number) => sdf(m, [p[0] + dx, p[1] + dy, p[2] + dz])[0]
  return norm([g(e, 0, 0) - g(-e, 0, 0), g(0, e, 0) - g(0, -e, 0), g(0, 0, e) - g(0, 0, -e)])
}

const CRATERS = [
  { x: 12, z: -8, r: 5.5 },
  { x: 36, z: 5.5, r: 3.2 },
  { x: 29, z: -12.5, r: 2.4 },
]
const wrap = (d: number) => mod(d + P / 2, P) - P / 2

const RIDGES = [
  { peaks: [[3, 5.5, 11], [19, 3.5, 9], [33, 2.5, 8], [47, 7, 13], [64, 4.5, 10]], shadow: 1.2, lit: 2.6 },
  { peaks: [[-4, 2.5, 9], [12, 3.4, 8], [27, 1.8, 7], [39, 2.8, 8], [57, 2.2, 9]], shadow: 1.9, lit: 3.6 },
] as const

function ridgeAt(x: number, peaks: readonly (readonly [number, number, number])[]): [number, boolean] {
  let h = 0
  let isLit = true
  for (const [px, ph, hw] of peaks) {
    const v = ph * (1 - Math.abs(x - px) / hw)
    if (v > h) {
      h = v
      isLit = x <= px
    }
  }
  return [h, isLit]
}

type Puff = { born: number; x: number; z: number; size: number; vx: number }
const PUFFS: Puff[] = [
  ...[1, 2, 3, 4, 5].map(k => ({ born: 8 * k, x: -8 * k - 5, z: k % 2 === 1 ? 1.3 : -1.3, size: 1, vx: -0.06 })),
  { born: 50, x: -45.2, z: 0.6, size: 1.3, vx: -0.08 },
  { born: 50, x: -39.4, z: 0.6, size: 1.2, vx: 0.08 },
  { born: 60, x: -47, z: -1.3, size: 0.8, vx: -0.05 },
]
const PUFF_LIFE = 26

function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const p = pose(f)
    const cam = Math.round(p.x - CX)
    const bx = p.x - cam
    const m = model(p, bx)

    c.fill(SKY)
    for (let i = 0; i < 24; i++) {
      const sx = Math.floor(hash(i, 11) * W)
      const sy = Math.floor(hash(i, 12) * 16)
      const b = hash(i, 13)
      const tw = i % 5 === 0 ? wave(f, LOOP, 2 + (i % 3), hash(i, 14)) * 0.9 : 0
      c.set(sx, sy, shade(STAR, b * b * 2.6 + tw))
    }

    const ex = 53
    const ey = 7
    const er = 5.2
    const earthSun = norm([-0.85, -0.2, 0.5])
    for (let y = 0; y < 15; y++) {
      for (let x = 45; x < W; x++) {
        const dx = (x - ex) / er
        const dy = (y - ey) / er
        const d2 = dx * dx + dy * dy
        if (d2 > 1) {
          if (d2 < 1.35 && dx * earthSun[0] + dy * earthSun[1] > 0.45) c.set(x, y, 0x1d3466)
          continue
        }
        const n: V3 = [dx, dy, Math.sqrt(1 - d2)]
        const lit = clamp(dot(n, earthSun) * 1.25 + 0.05)
        const lon = Math.atan2(n[0], n[2])
        const isLand = noise(lon * 1.5 + 9, n[1] * 2.2, 0, 4) > 0.56
        const isCloud = noise(lon * 1.8 + 3, n[1] * 3.6, 0, 9) > 0.64 || n[1] < -0.86
        const level = lit * 4.6
        if (isCloud) c.set(x, y, shade(CLOUD, level * 0.9 + (lit > 0.05 ? 0.4 : 0)))
        else if (isLand) c.set(x, y, shade(CONTINENT, level * 0.85))
        else c.set(x, y, shade(OCEAN, 0.4 + level))
      }
    }

    for (const ridge of RIDGES) {
      for (let x = 0; x < W; x++) {
        const [h, isLit] = ridgeAt(x, ridge.peaks)
        const top = Math.round(HORIZON - 0.5 - h)
        for (let y = top; y < HORIZON; y++) c.set(x, y, shade(REG, isLit ? ridge.lit + (y === top ? 0.7 : 0) : ridge.shadow))
      }
    }

    const marks = new Map<number, 'groove' | 'toe'>()
    const key = (x: number, y: number) => y * 4096 + x + 2048
    for (let t = f - 40; t <= f; t += 0.5) {
      const q = pose(mod(t, LOOP))
      if (Math.cos(q.theta) < 0.95 || q.air > 0.1) continue
      const shift = t < 0 ? P : 0
      q.feet.forEach((foot, i) => {
        const row = i === 0 ? 28 : 27
        const wx = q.x + shift + foot.a
        if (foot.lift < 0.35) for (let a = -1; a <= 1; a++) marks.set(key(Math.round(wx + a), row), 'groove')
        else if (!marks.has(key(Math.round(wx + 1), row))) marks.set(key(Math.round(wx + 1), row), 'toe')
      })
    }

    for (let y = HORIZON; y < H; y++) {
      const z = (y - GROUND) / OBL
      for (let x = 0; x < W; x++) {
        const wx = x + cam
        const u = mod(wx, P)
        let level = y === HORIZON ? 5.2 : y < 24 ? 4.3 : 4.8
        for (const cr of CRATERS) {
          const dx = wrap(wx - cr.x) / cr.r
          const dz = (z - cr.z) / cr.r
          const e = Math.hypot(dx, dz)
          if (e >= 1.22) continue
          if (e < 1) {
            const isShadow = Math.hypot(dx - 0.45, dz * 1.15) > 0.92
            level = isShadow ? 1.5 : e > 0.7 && dx > 0.25 ? 6.8 : 4.3 + dx * 1.1
          } else level += dx < 0.1 ? 0.9 : -1.2
        }
        const cell = Math.floor(u)
        const pebble = (i: number) => hash(mod(i, P), 7) < 0.05 && y === Math.round(GROUND + (hash(mod(i, P), 8) - 0.5) * 8)
        if (pebble(cell)) level = 7.2
        else if (pebble(cell - 1)) level = 5.6
        else if (pebble(cell - 2)) level = 2.2
        const mark = marks.get(key(wx, y))
        if (mark === 'groove') level -= 1.6
        if (mark === 'toe') level -= 1.4
        if (mark === undefined && marks.get(key(wx, y + 1)) === 'groove') level += 0.9
        if (x > bx - 6) {
          const g: V3 = [x, GROUND, z]
          if (march(m, add(g, [0, -0.05, 0]), SUN_LOW, 40) !== undefined) level = Math.min(level, 1.3 + (level - 4.6) * 0.3)
        }
        c.set(x, y, shade(REG, level))
      }
    }

    const puffAt = (pf: Puff, age: number, shift: number, isFront: boolean) => {
      if (age < 0 || age >= PUFF_LIFE || pf.z > 0 !== isFront) return
      const k = age / PUFF_LIFE
      const rise = Math.max(0, 0.3 * age - 0.0115 * age * age)
      const sx = Math.round(pf.x + shift + pf.vx * age - cam)
      const sy = Math.round(GROUND + pf.z * OBL - 0.6 - rise)
      const r = pf.size * (0.6 + 1.5 * Math.sin(Math.PI * Math.min(1, k * 1.1)) ** 0.7)
      if (r < 0.6) return
      for (let y = Math.floor(sy - r); y <= Math.ceil(sy + r); y++) {
        for (let x = Math.floor(sx - r); x <= Math.ceil(sx + r); x++) {
          const d = Math.hypot((x - sx) / r, (y - sy) / (r * 0.75))
          if (d > 1) continue
          const lit = (sx - x) * 0.45 + (sy - y) * 0.55
          c.set(x, y, shade(REG, 6.6 + lit - k * 1.4 - (d > 0.8 ? 0.7 : 0)))
        }
      }
    }
    const puffs = (isFront: boolean) => {
      for (const pf of PUFFS) {
        puffAt(pf, f - pf.born, 0, isFront)
        puffAt(pf, f - pf.born + LOOP, P, isFront)
      }
    }
    puffs(false)

    const lv = new Float32Array(W * H).fill(NaN)
    const zs = new Float32Array(W * H).fill(-99)
    const groups = new Int8Array(W * H).fill(-1)
    const mats: (Mat | 'visor' | undefined)[] = new Array(W * H)
    for (let y = 1; y < 30; y++) {
      for (let x = Math.floor(bx - 10); x <= Math.ceil(bx + 10); x++) {
        if (x < 0 || x >= W) continue
        const o: V3 = [x, y - OBL * 10, 10]
        const t = march(m, o, RAY, 30)
        if (t === undefined) continue
        const hit = add(o, mul(RAY, t))
        const [, mat] = sdf(m, hit)
        const n = normal(m, hit)
        const isShadowed = march(m, add(hit, mul(n, 0.12)), SUN, 14) !== undefined
        const diffuse = Math.max(0, dot(n, SUN)) * (isShadowed ? 0.2 : 1)
        const rim = Math.max(0, dot(n, EARTHSHINE)) ** 2
        const near = clamp((hit[2] - 1.5) * 0.45, -1.2, 0.6)
        let level = 1.5 + diffuse * 6.4 + rim * 1.2 + near
        let tag: Mat | 'visor' = mat
        if (mat === 'pack') level -= 0.7
        if (mat === 'boot') level = 1.4 + diffuse * 4 + rim * 0.6 + near
        if (mat === 'panel') level = 0.6 + diffuse * 3
        if (mat === 'helmet') {
          const nl = norm(sub(hit, m.helmet))
          const facing = nl[0] * Math.cos(m.theta) + nl[2] * Math.sin(m.theta)
          if (facing > 0.18 && nl[1] > -0.55 && nl[1] < 0.48) {
            const r = sub(RAY, mul(n, 2 * dot(RAY, n)))
            level = dot(r, SUN) > 0.9 ? 6 : r[1] > 0.12 ? 3 + r[1] * 2 : 1.1
            tag = 'visor'
          }
        }
        lv[y * W + x] = level
        zs[y * W + x] = hit[2]
        groups[y * W + x] = groupAt(m, hit)
        mats[y * W + x] = tag
      }
    }
    for (let y = 1; y < 30; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x
        const l = lv[i] ?? NaN
        if (Number.isNaN(l)) continue
        const z = zs[i] ?? 0
        const isEdge = [i - 1, i + 1, i - W, i + W].some(j => (groups[j] ?? -1) >= 0 && groups[j] !== groups[i] && (zs[j] ?? -99) > z + 1.1)
        const mat = mats[i]
        const level = mat === 'visor' ? l : Math.round((isEdge ? l - 1.8 : l) / 1.6) * 1.6
        c.set(x, y, mat === 'visor' ? shade(VISOR, level) : mat === 'boot' || mat === 'panel' ? shade(BOOT, level) : shade(SUIT, level))
      }
    }
    for (let y = HORIZON + 2; y < H; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x
        if (!Number.isNaN(lv[i] ?? NaN)) continue
        if ([i - 1, i + 1, i - W].some(j => !Number.isNaN(lv[j] ?? NaN))) c.set(x, y, shade(REG, 1.2))
      }
    }
    if (Math.cos(p.theta) > 0.5) {
      const px = Math.round(bx + 2.75 + p.lean * 0.55 + 0.6)
      const py = Math.round(15.3 + p.dy - p.air)
      if (mats[py * W + px] === 'panel') c.set(px, py, f % 16 < 8 ? 0xe2503c : 0x7a2a26)
      if (mats[(py + 1) * W + px] === 'panel') c.set(px, py + 1, 0x63cf74)
    }
    if (f >= 52 && f <= 55) {
      const gx = Math.round(bx + 3.2 + p.lean)
      const gy = Math.round(7.8 + p.dy)
      c.set(gx, gy, 0xfffbe8)
      if (f === 53 || f === 54) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.set(gx + dx, gy + dy, VISOR[5] ?? 0)
    }

    puffs(true)
    out.push(c.px)
  }
  return out
}

export const scene: Scene = {
  verb: 'Moonwalking',
  render,
  hero: 54,
  snaps: [
    { frames: 46, box: [25, 5, 31, 10], colors: [...VISOR.slice(3, 7), 0x3a1c08], why: 'mid-spin, the visor turns edge-on as it swings away' },
    { frames: 50, box: [33, 8, 35, 13], colors: [...VISOR.slice(3, 6), 0x3a1c08], why: 'the spin ends and the visor swings back into view as they land' },
  ],
}
