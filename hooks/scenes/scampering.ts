import { clamp, ease, frames, hash, hex, lerp, mod, noise, particles, shade, smoothstep, type Canvas, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96
const LAG = 8

const SKY = hex('9fc4d6 b6d2da cddcd6 e2e2c8 f2e6b6')
const MIST = hex('7f99a8 8ea8b2 9fb6b8 b2c4bc')
const BARK = hex('140d0f 1f1416 2c1d1c 3d2822 523626 6a4630 85593a a26e46')
const MOSS = hex('141a12 1c2616 26331a 33421e 445422 5c6a2a 7a8234')
const LEAF = hex('3a260c 5e3e10 8a6214 b48a1a d8ae26 eec83e f8de6a fdf0a4')
const FUR = hex('1e0c08 3a160c 5e2410 86361a ac4c22 cc6a30 e48c46 f4b068 fcd49a')
const CREAM = hex('8a6a4a c4a07a e8d0a8 f8ecd0')

const GROUND_Y = 28
const TRUNK = { x: 14, r: 6 }

const branchY = (x: number) => 9.5 + (x - 20) * 0.04
const TIP = 57

const RUN = 22
const SPIRAL = 57
const BRANCH = 78
const CROUCH = 83
const LEAP = 93

function cruise(t: number, T: number, a: number, d: number): number {
  const v = 1 / (T - a / 2 - d / 2)
  if (t < a) return (v * t * t) / (2 * a)
  if (t < T - d) return v * (t - a / 2)
  return 1 - (v * (T - t) ** 2) / (2 * d)
}

const ON_TRUNK = TRUNK.x + TRUNK.r - 0.5

const branchX = (t: number) => lerp(ON_TRUNK, 55, cruise(clamp(t - SPIRAL, 0, BRANCH - SPIRAL), BRANCH - SPIRAL, 2, 4))

type Pose = { x: number; y: number; dx: number; dy: number; around?: number; gait: number; crouch: number; speed: number }

function pose(t: number, droop: (x: number) => number): Pose {
  const body = 2.6
  if (t < RUN) {
    const x = lerp(60, ON_TRUNK, cruise(t, RUN, 3, 0))
    return { x, y: GROUND_Y - body, dx: -1, dy: 0, gait: (60 - x) / 8, crouch: 0, speed: Math.min(1, t / 4) }
  }
  if (t < SPIRAL) {
    const q = (t - RUN) / (SPIRAL - RUN)
    const th = Math.PI / 2 - q * 4 * Math.PI
    const x = TRUNK.x + (TRUNK.r - 0.5) * Math.sin(th)
    const y = lerp(GROUND_Y - body, branchY(ON_TRUNK) + droop(ON_TRUNK) - body, q)
    const along = (TRUNK.r - 0.5) * Math.cos(th) * -4 * Math.PI * 0.15
    const onto = smoothstep(RUN - 1, RUN + 4, t)
    const off = smoothstep(SPIRAL - 4, SPIRAL + 1, t)
    const vx = lerp(lerp(-17, along, onto), 17, off)
    const vy = -17 * (onto - off)
    const len = Math.hypot(vx, vy)
    return { x, y, dx: vx / len, dy: vy / len, around: th, gait: q * 9, crouch: 0, speed: 1 }
  }
  if (t < BRANCH) {
    const x = branchX(t)
    return { x, y: branchY(x) + droop(x) - body, dx: 1, dy: 0, gait: x / 8, crouch: 0, speed: 1 - ((x - ON_TRUNK) / (55 - ON_TRUNK)) * 0.6 }
  }
  if (t < CROUCH) {
    const x = 55
    return { x, y: branchY(x) + droop(x) - body, dx: 1, dy: 0, gait: 0, crouch: ease.inOut((t - BRANCH) / (CROUCH - BRANCH)), speed: 0 }
  }
  if (t < LEAP) {
    const p = (t - CROUCH) / (LEAP - CROUCH)
    const y0 = branchY(55) + droop(55) - body
    const y1 = GROUND_Y - body
    const h = 2
    const x = lerp(55, 60, p)
    const y = y0 + (y1 - y0) * p - h * 4 * p * (1 - p)
    const vy = (y1 - y0 - h * 4 * (1 - 2 * p)) * (1 - smoothstep(0.2, 1, p))
    const len = Math.hypot(5, vy)
    return { x, y, dx: 5 / len, dy: vy / len, gait: 0.25, crouch: -1, speed: 1 }
  }
  const k = t - LEAP
  return { x: 60, y: GROUND_Y - body, dx: k < 2 ? 1 : -1, dy: 0, gait: 0, crouch: [0.6, 1, 0.7, 0.4][k] ?? 0.4, speed: [0.6, 0.3, 0.1, 0][k] ?? 0 }
}

function droopFor(f: number): (x: number) => number {
  let weight = 0
  let spring = 0
  for (const lag of [0, LAG]) {
    const t = mod(f - lag, LOOP)
    if (t >= SPIRAL && t < CROUCH) weight += clamp((branchX(t) - ON_TRUNK) / (55 - ON_TRUNK)) ** 1.5
    if (t >= CROUCH) spring += 2 * Math.exp(-(t - CROUCH) / 5) * Math.cos((t - CROUCH) * 0.8)
  }
  const bend = weight * 2.4 + spring
  return (x: number) => Math.round(bend * clamp((x - 20) / (TIP - 20)) ** 2)
}

type Part = 'fur' | 'top' | 'belly' | 'dark' | 'eye' | 'tail'

function tailDiscs(p: Pose, flick: number): [number, number, number][] {
  const curl: [number, number][] = [[-2.7, 0.9], [-4, 2.2], [-4.5, 3.8], [-4, 5.2], [-2.9, 5.9]]
  const stream: [number, number][] = [[-2.9, 0.7], [-4.3, 1.7], [-5.5, 2.9], [-6.2, 4.2], [-6.3, 5.4]]
  const k = clamp(p.speed) * 0.6
  return curl.map(([cu, cv], i) => {
    const r = [1.2, 1.55, 1.8, 1.75, 1.35][i] ?? 1
    const [su, sv] = stream[i] ?? [0, 0]
    const wob = Math.sin(flick - i * 0.8) * i * 0.2
    return [lerp(cu, su, k) - wob, lerp(cv, sv, k) + wob * 0.6 + (p.crouch > 0 ? i * 0.15 * p.crouch : 0), r]
  })
}

function partAt(p: Pose, u: number, v: number, flick: number): Part | undefined {
  const s = Math.sin(p.gait * Math.PI * 2)
  const stretch = p.speed * s * 0.45 - Math.max(0, p.crouch) * 0.4
  const lift = Math.max(0, p.crouch) * -0.5
  if (Math.abs(u - 3.3) < 0.5 && Math.abs(v - 1.3 - lift) < 0.5) return 'eye'
  if (Math.abs(u - 2.3) < 0.5 && Math.abs(v - 2.8 - lift) < 0.6) return 'dark'
  if (((u - 2.9) / 1.5) ** 2 + ((v - 1.1 - lift) / 1.35) ** 2 <= 1) return u > 3.6 && v < 0.8 ? 'belly' : 'top'
  if ((u / (2.6 + stretch)) ** 2 + ((v - 0.1 - lift * 0.5) / (1.65 - stretch * 0.3)) ** 2 <= 1) return v < -0.6 ? 'belly' : v > 0.8 ? 'top' : 'fur'
  const reach = p.speed * s * 1.1
  for (const fu of [1.7 + reach, -1.7 - reach]) if (Math.abs(u - fu) < 0.5 && Math.abs(v + 1.9) < 0.5 && p.crouch >= 0) return 'dark'
  const drawn = 1 + 0.8 * clamp(p.speed)
  for (const [tu, tv, r] of tailDiscs(p, flick)) if (((u - tu) / drawn) ** 2 + (v - tv) ** 2 <= r * r) return 'tail'
  return undefined
}

function behind(x: number, around: number): boolean {
  const s = (x + 0.5 - TRUNK.x) / TRUNK.r
  if (Math.abs(s) >= 1) return false
  const near = Math.asin(s)
  const far = Math.PI - near
  const gap = (a: number) => Math.abs(mod(a - around + Math.PI, 2 * Math.PI) - Math.PI)
  return gap(far) < gap(near)
}
function drawSquirrel(c: Canvas, p: Pose, flick: number, tone: number): void {
  const nx = p.dx >= 0 ? p.dy : -p.dy
  const ny = p.dx >= 0 ? -p.dx : p.dx
  for (let y = Math.floor(p.y - 9); y <= Math.ceil(p.y + 9); y++) {
    for (let x = Math.floor(p.x - 9); x <= Math.ceil(p.x + 9); x++) {
      if (p.around !== undefined && behind(x, p.around)) continue
      const rx = x - p.x
      const ry = y - p.y
      const u = rx * p.dx + ry * p.dy
      const v = rx * nx + ry * ny
      const part = partAt(p, u, v, flick)
      if (!part) continue
      const facing = clamp((-rx * 0.7 - ry * 0.7) / 3, -1, 1)
      const shadow = p.around === undefined ? 0 : -1.2 * clamp(0.5 - Math.cos(p.around) * 2)
      if (part === 'eye') c.set(x, y, 0x120808)
      else if (part === 'dark') c.set(x, y, shade(FUR, 1.6 + tone + shadow, x, y))
      else if (part === 'belly') c.set(x, y, shade(CREAM, 1.6 + facing + tone * 0.5 + shadow, x, y))
      else if (part === 'tail') {
        const isEdge = !partAt(p, u, v + 0.9, flick) || !partAt(p, u - 0.9, v, flick)
        c.set(x, y, shade(FUR, 4.2 + facing * 1.4 + (isEdge ? 1.6 : 0) + tone + shadow, x, y))
      } else c.set(x, y, shade(FUR, (part === 'top' ? 4.8 : 3.8) + facing * 1.6 + tone + shadow, x, y))
    }
  }
}
function foliage(x: number, y: number, shake: number): number {
  const top = noise(x * 0.32, y * 0.5, 0, 3) - y * 0.07 + 0.25 - (x > 30 && x < 46 ? 0.25 : 0)
  const tx = x - TIP + 2
  const ty = y - 3 - shake
  const tip = noise(x * 0.45, (y - shake) * 0.55, 0, 8) + 0.5 - Math.hypot(tx * 0.55, ty) / 5
  return Math.max(top, tip)
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const droop = droopFor(f)
    const shake = droop(TIP)
    c.fill((x, y) => {
      const sky = shade(SKY, 0.4 + y * 0.18 + (x < 24 ? 0.5 : 0), x, y)
      for (const [tx, w, lean] of [[29, 2, 0.05], [37, 3, -0.03], [45, 2, 0.04], [52, 3, 0]] as const) {
        const cx = tx + (y - 16) * lean
        if (x >= cx && x < cx + w) return shade(MIST, (x === Math.floor(cx) ? 2 : 1) + y * 0.04, x, y)
      }
      return sky
    })
    for (let x = 0; x < W; x++) {
      const bush = 23 + Math.round(noise(x * 0.18, 0, 0, 4) * 3)
      for (let y = bush; y < GROUND_Y; y++) c.set(x, y, shade(MIST, 0.6 + (y === bush ? 1 : 0) - (y - bush) * 0.1, x, y))
      for (let y = GROUND_Y; y < H; y++) {
        const litter = noise(x * 0.32, y * 0.6, 0, 6)
        const isShade = x > 19 && x < 37 - (y - GROUND_Y) * 2
        const level = (y === GROUND_Y ? 4.4 : 3) - (y - GROUND_Y) * 0.35 + (x < 30 ? 0.4 : 0) - (isShade ? 1.6 : 0)
        c.set(x, y, litter > 0.68 ? shade(LEAF, 2.6 + (y === GROUND_Y ? 1.4 : 0), x, y) : shade(MOSS, level, x, y))
      }
    }
    for (let y = 0; y < GROUND_Y + 1; y++) {
      const flare = y > GROUND_Y - 4 ? (y - GROUND_Y + 4) * 0.6 : 0
      const hw = TRUNK.r + flare
      for (let x = Math.floor(TRUNK.x - hw); x < Math.ceil(TRUNK.x + hw); x++) {
        const u = (x + 0.5 - TRUNK.x) / hw
        const furrow = Math.abs(Math.sin((x + 0.5 - TRUNK.x) * 1.35 + noise(x * 0.3, y * 0.12, 0, 2) * 2.2)) < 0.22
        const level = 3.6 - u * 2.6 - (furrow ? 1.2 : 0) + (u < -0.7 ? 1 : 0) - (y >= GROUND_Y ? 1.5 : 0)
        c.set(x, y, shade(BARK, level, x, y))
      }
    }
    for (let x = 18; x <= TIP; x++) {
      const y0 = Math.round(branchY(x) + droop(x))
      const thick = x < 22 ? 4 : x < 36 ? 3 : x < 50 ? 2 : 1
      for (let k = 0; k < thick; k++) {
        const y = y0 + k
        c.set(x, y, shade(BARK, k === 0 ? 5.2 : k === thick - 1 ? 1.2 : 3, x, y))
      }
    }
    for (let x = 34; x <= 38; x++) {
      const y = Math.round(branchY(x) + droop(x)) - 1 - Math.round((x - 34) * 0.6)
      c.set(x, y, shade(BARK, 3.4, x, y))
    }
    for (let y = 0; y < 14; y++) {
      for (let x = 0; x < W; x++) {
        const m = foliage(x, y, shake)
        if (m < 0.55) continue
        const lit = m - foliage(x - 1, y - 1, shake)
        const level = 3.2 + (m > 0.7 ? 1 : 0) + (lit > 0.03 ? 1.4 : lit < -0.04 ? -1.2 : 0) - (x > 40 ? 0.4 : 0)
        c.set(x, y, shade(LEAF, level, x, y))
      }
    }
    for (const [lag, tone] of [[LAG, -0.5], [0, 0]] as const) {
      const t = mod(f - lag, LOOP)
      const p = pose(t, droop)
      drawSquirrel(c, p, t * 0.7 + lag, tone)
      if (t < RUN || t >= LEAP) {
        for (let dx = -3; dx <= 3; dx++) {
          const x = Math.round(p.x) + dx
          c.set(x, GROUND_Y, shade(MOSS, 2.2, x, GROUND_Y))
        }
      }
    }
    for (const [born, x0, seed] of [[CROUCH, 53, 1], [CROUCH + 2, 58, 2], [CROUCH + LAG, 50, 3], [40, 44, 4]] as const) {
      const t = mod(f - born, LOOP)
      if (t > 26) continue
      const x = Math.round(x0 + Math.sin(t * 0.38 + seed) * 2.2 + t * 0.15)
      const y = Math.round(6 + t * 0.85)
      const flip = Math.floor(t / 3 + seed) % 2
      c.set(x, y, shade(LEAF, 5 + flip, x, y))
      c.set(x + (flip ? 1 : -1), y, shade(LEAF, 3.6, x, y))
    }
    for (const p of particles(f, LOOP, 5, 40, 9)) {
      const x = Math.round(26 + p.r[1] * 30 + Math.sin(p.t * 0.2 + p.r[2] * 6) * 1.5)
      const y = Math.round(12 + p.r[3] * 10 - p.t * 0.1)
      if (p.age > 0.2 && p.age < 0.8 && hash(p.i, 3) < 0.8) c.set(x, y, 0xfff4d0)
    }
  })
}
const BARK_EDGE = 'a squirrel slips behind the trunk at its left edge, its tail tip showing'
const ROUND = 'a squirrel comes back round the trunk from behind it'
const FURRY = [...FUR, ...CREAM, 0x120808]
export const scene: Scene = {
  verb: 'Scampering',
  render,
  hero: 70,
  snaps: [
    { frames: 31, box: [0, 17, 29, 29], colors: [...FURRY, ...MIST], why: BARK_EDGE },
    { frames: 39, box: [0, 22, 8, 28], colors: [...FURRY, ...MIST], why: BARK_EDGE },
    { frames: 49, box: [2, 12, 7, 19], colors: FURRY, why: BARK_EDGE },
    { frames: 57, box: [1, 11, 16, 20], colors: FURRY, why: BARK_EDGE },
    { frames: 40, box: [18, 12, 26, 24], colors: FURRY, why: ROUND },
    { frames: 48, box: [18, 12, 27, 24], colors: FURRY, why: ROUND },
    { frames: 57, box: [12, 1, 23, 7], colors: FURRY, why: `${ROUND} and steps out onto the branch` },
    { frames: 65, box: [11, 2, 18, 7], colors: FURRY, why: `${ROUND} and steps out onto the branch` },
    { frames: 4, box: [52, 12, 60, 20], colors: FURRY, why: 'the chaser lands behind the leader, its tail whipping over its back' },
    { frames: 95, box: [53, 16, 63, 27], colors: FURRY, why: 'the leader turns round where it landed, to run back' },
  ],
}