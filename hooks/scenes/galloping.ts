import { Canvas, TAU, clamp, hex, lerp, mix, mod, random, shade, threshold, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96
const SPEED = 4
const WORLD = SPEED * LOOP
const GROUND = 27
const VANISH = 17
const depth = (y: number) => (y - VANISH) / (GROUND - VANISH)
const wrap = (x: number, period: number) => mod(x + period / 2, period) - period / 2

const SKY = hex('1b1036 2a1446 3f1a55 5a215f 7a2a62 9c355f bc4659 d65d4f ea7a45 f59a45 fbbb52 fdd77a')
const SUN = hex('fde3a0 fff1c6 fffae8')
const MESA = hex('8e4468 a85270 c0626e d6766c e8906e')
const HILL = hex('4c1e4a 64285a 7c3460 964262 b45662 d47064')
const GRASS = hex('1c0c1c 2a1222 3c1a26 52222a 6c2e2c 8a3e2e a8522e c66e36 de8c42 eeac54 f8ca6c')
const NEAR = hex('241020 381826 4e202a c26a34 da8a40')
const HORSE = hex('0e0710 180b16 24101c 361620 54201f 803221 b85426 e68a36 fcc862')

const SUN_X = 37
const SUN_Y = 11
const SUN_R = 7.5

const WISPS: readonly (readonly [number, number, number])[] = [[-3, 3, 17], [46, 2, 20], [24, 8, 9], [52, 10, 10]]

function skyAt(x: number, y: number): [number, number] {
  const dx = x - SUN_X
  const dy = y - SUN_Y
  const d = Math.hypot(dx, dy)
  let cloud = 0
  for (const [wx, wy, len] of WISPS) {
    if (y === wy && x >= wx && x < wx + len) cloud = 1
    if (y === wy + 1 && x >= wx + 2 && x < wx + len - 3) cloud = 2
  }
  if (d <= SUN_R) {
    if (cloud) return [cloud === 1 ? 0xf09a52 : 0xfac46e, 0.85]
    return [d < 4 ? (SUN[2] ?? 0) : d < 6.2 ? (SUN[1] ?? 0) : (SUN[0] ?? 0), 1]
  }
  const e = Math.hypot(dx, dy * 1.3)
  const glow = e < SUN_R + 1.6 ? 2 : e < SUN_R + 5 ? 1.2 : e < SUN_R + 10 ? 0.6 : 0
  let level = Math.min(10, 1 + 9.4 * (y / 18) ** 1.35 + glow)
  if (cloud === 1) level -= 1.3
  if (cloud === 2) level += 0.9
  const top = SKY.length - 1
  return [shade(SKY, level, x, y), clamp(level / top) * 0.85]
}

const BUTTES: readonly (readonly [number, number, number])[] = [[2, 12, 14], [20, 25, 15.5], [33, 46, 13], [53, 57, 16]]
function mesaTop(x: number): number {
  let top = 99
  for (const [a, b, t] of BUTTES) {
    for (const shift of [-64, 0, 64]) {
      const out = Math.max(0, a + shift - x, x - b - shift)
      top = Math.min(top, t + out * 1.4)
    }
  }
  return top
}
const hillTop = (x: number) =>
  20 - 1.3 * Math.sin((TAU * x) / 128) - 0.9 * Math.sin((TAU * x * 3) / 128 + 1) - 0.5 * Math.sin((TAU * x * 5) / 128 + 2.4)
const TREES = [14, 52, 101] as const
const TREE = [' +++ ', '+####', '#####', ' ### ', '  #  ', '  #  ']

const CREEK_X = 186
const CREEK_HALF = 7
const meander = (y: number) => 5 * Math.sin((y - VANISH) * 0.5)

type Tuft = { x: number; y: number; h: number; blades: number }
const TUFTS: Tuft[] = (() => {
  const next = random(0x9a11)
  return Array.from({ length: 30 }, () => ({ x: next() * WORLD, y: 29 + Math.floor(next() * 3), h: 1.5 + next() * 1.5, blades: 2 + Math.floor(next() * 2) }))
})()
const STALKS: readonly (readonly [number, number])[] = [[20, 7], [130, 6], [300, 8]]

type Pt = readonly [number, number]
const rot = (x: number, y: number, a: number): Pt => [x * Math.cos(a) + y * Math.sin(a), -x * Math.sin(a) + y * Math.cos(a)]

type Hoof = { g: number } | { a: Pt }
const g = (x: number): Hoof => ({ g: x })
const a = (x: number, y: number): Hoof => ({ a: [x, y] })

const FORE: readonly Hoof[] = [g(4), g(0), g(-4), a(-7, 7), a(-4, 4), a(0, 3.5), a(4, 5), a(6, 7.5)]
const HIND: readonly Hoof[] = [g(5), g(1), g(-3), a(-7, 6.5), a(-5, 4.5), a(-1, 4), a(3, 5.5), a(6, 7)]

type Leg = { joint: Pt; fore: boolean; near: boolean; offset: number; upper: number; lower: number }
const LEGS: readonly Leg[] = [
  { joint: [-4, 2.5], fore: false, near: false, offset: 1, upper: 4.6, lower: 4.6 },
  { joint: [5.5, 2.5], fore: true, near: false, offset: 4, upper: 4.3, lower: 4.6 },
  { joint: [-5, 2.5], fore: false, near: true, offset: 0, upper: 4.6, lower: 4.6 },
  { joint: [4.5, 2.5], fore: true, near: true, offset: 3, upper: 4.3, lower: 4.6 },
]
const BOB = [0, 0, 1, 1, 1, 0, -1, -1] as const
const PITCH = [0, 0.03, 0.04, 0.02, -0.02, -0.04, -0.02, 0] as const
const NECK = [0.12, 0.056, 0.076, 0.012, 0.022, -0.041, -0.107, -0.043] as const

type Pose = { dy: number; pitch: number; neck: number; legs: readonly Hoof[] }

const JUMP_AT = 40
const T = a(1.5, 4.5)
const F = a(1, 5)
const JUMP: readonly Pose[] = [
  { dy: 0, pitch: 0.03, neck: 0.03, legs: [g(6), a(-2, 3.5), g(5), a(0, 3)] },
  { dy: 0, pitch: 0.09, neck: 0.02, legs: [g(2), a(1, 4.5), g(1), a(2, 4)] },
  { dy: 0, pitch: 0.14, neck: 0.1, legs: [g(-2), F, g(-3), T] },
  { dy: -1, pitch: 0.13, neck: 0.12, legs: [a(-7, 6.5), F, a(-8, 6), T] },
  { dy: -3, pitch: 0.08, neck: 0.15, legs: [a(-6.5, 6), F, a(-7, 6), T] },
  { dy: -4, pitch: 0.06, neck: 0.15, legs: [a(-5, 5.5), F, a(-5.5, 5.5), T] },
  { dy: -6, pitch: 0, neck: 0.09, legs: [a(-3.5, 5), F, a(-4, 5), T] },
  { dy: -6, pitch: -0.06, neck: 0.1, legs: [a(-2.5, 4.5), a(3, 5), a(-3, 4.5), a(3, 5)] },
  { dy: -6, pitch: -0.13, neck: 0.08, legs: [a(-2, 4), a(4.5, 6), a(-2.5, 4), a(5, 5.5)] },
  { dy: -5, pitch: -0.17, neck: 0.07, legs: [a(-1, 4.5), a(5, 7), a(-1, 4.5), a(5, 7.5)] },
  { dy: -4, pitch: -0.17, neck: 0.02, legs: [a(0, 5), a(5.5, 7.5), a(0, 5), a(4, 8.5)] },
  { dy: -2, pitch: -0.13, neck: 0, legs: [a(1, 5.5), a(6, 7.5), a(0, 5), g(4)] },
  { dy: -1, pitch: -0.1, neck: 0.01, legs: [a(0, 5), g(4), a(1, 4.5), g(0)] },
  { dy: 0, pitch: -0.09, neck: 0.03, legs: [a(-1, 4.5), g(0), a(2, 5), g(-4)] },
  { dy: 1, pitch: -0.03, neck: 0.03, legs: [a(1, 4.5), g(-4), a(3, 5.5), a(-7, 7)] },
  { dy: 0, pitch: 0, neck: 0.03, legs: [a(3, 5.5), a(-7, 7), a(6, 7), a(-4, 4)] },
]

function poseAt(f: number): Pose {
  const jump = JUMP[mod(f, LOOP) - JUMP_AT]
  if (jump) return jump
  const c = mod(f, 8)
  return {
    dy: BOB[c] ?? 0,
    pitch: PITCH[c] ?? 0,
    neck: NECK[c] ?? 0,
    legs: LEGS.map(l => (l.fore ? FORE : HIND)[mod(c - l.offset, 8)] ?? g(0)),
  }
}

const CX = 28
const CY = 16
const NECK_BASE: Pt = [5, -1.5]
const NECK_POLY: readonly Pt[] = [[3.2, -3.3], [11.2, -8.6], [13.6, -7.8], [13.6, -5.2], [8.4, 1.2], [5, 2]]

const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
function inCapsule(x: number, y: number, ax: number, ay: number, bx: number, by: number, ra: number, rb: number): boolean {
  const dx = bx - ax
  const dy = by - ay
  const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))
  return Math.hypot(x - ax - dx * t, y - ay - dy * t) <= lerp(ra, rb, t)
}
function inPoly(x: number, y: number, pts: readonly Pt[]): boolean {
  let inside = false
  pts.forEach(([ax, ay], i) => {
    const [bx, by] = pts[(i + 1) % pts.length] ?? [ax, ay]
    if (ay > y !== by > y && x < ax + ((y - ay) / (by - ay)) * (bx - ax)) inside = !inside
  })
  return inside
}

function toNeck(x: number, y: number, neck: number): Pt {
  const [nx, ny] = rot(x - NECK_BASE[0], y - NECK_BASE[1], -neck)
  return [nx + NECK_BASE[0], ny + NECK_BASE[1]]
}
function fromNeck(x: number, y: number, neck: number): Pt {
  const [nx, ny] = rot(x - NECK_BASE[0], y - NECK_BASE[1], neck)
  return [nx + NECK_BASE[0], ny + NECK_BASE[1]]
}

function isBody(x: number, y: number, neck: number): boolean {
  if (inEllipse(x, y, 0, 0.4, 6.4, 3.3)) return true
  if (inEllipse(x, y, -5.2, -0.4, 3.8, 3.6)) return true
  if (inEllipse(x, y, 4.8, 0, 3.2, 3.4)) return true
  const [qx, qy] = toNeck(x, y, neck)
  return (
    inPoly(qx, qy, NECK_POLY) ||
    inCapsule(qx, qy, 12.4, -7.8, 17.4, -4, 1.7, 1.1) ||
    inEllipse(qx, qy, 13.8, -6, 1.8, 1.5) ||
    inCapsule(qx, qy, 11.8, -8.6, 11, -10.6, 0.6, 0.45)
  )
}

const BODY = 2
const FAR_LEG = 1
const NEAR_LEG = 3
const HAIR = 4

type Horse = { mask: Uint8Array; landings: number[] }

function worldAt(f: number, bx: number, by: number): Pt {
  const pose = poseAt(f)
  const [rx, ry] = rot(bx, by, pose.pitch)
  return [CX + rx, CY + pose.dy + ry]
}

const TAILS: readonly (readonly Pt[])[] = (() => {
  const rest = (f: number): Pt[] => {
    const [dx0, dy0] = worldAt(f, -8.8, -2.4)
    return Array.from({ length: 10 }, (_, i): Pt => {
      const sway = Math.sin(TAU * (f / 8) - i * 0.75) * (0.2 + i * 0.12)
      return [dx0 - i * 1.0, dy0 + i * 0.32 + 0.02 * i * i + sway]
    })
  }
  let now = rest(0)
  const out: Pt[][] = []
  for (let f = 0; f < LOOP * 2; f++) {
    const goal = rest(f)
    now = goal.map(([gx, gy], i): Pt => [gx, lerp(now[i]?.[1] ?? gy, gy, 1 - i * 0.065)])
    if (f >= LOOP) out.push(now)
  }
  return out
})()

function drawHorse(f: number): Horse {
  const pose = poseAt(f)
  const prev = poseAt(f - 1)
  const cy = CY + pose.dy
  const mask = new Uint8Array(W * H)
  const put = (x: number, y: number, part: number) => {
    const ix = Math.round(x)
    const iy = Math.round(y)
    if (ix >= 0 && ix < W && iy >= 0 && iy < H) mask[iy * W + ix] = part
  }
  const line = (x0: number, y0: number, x1: number, y1: number, part: number) => {
    const c = new Canvas()
    c.line(x0, y0, x1, y1, 1)
    c.px.forEach((v, i) => {
      if (v) mask[i] = part
    })
  }
  const world = (bx: number, by: number): Pt => {
    const [rx, ry] = rot(bx, by, pose.pitch)
    return [CX + rx, cy + ry]
  }

  const tail = TAILS[mod(f, LOOP)] ?? []
  tail.forEach(([x, y], i) => {
    const [nx, ny] = tail[i + 1] ?? [x, y]
    if (i < 9) line(x, y, nx, ny, HAIR)
    if (i < 7) line(x, y + 1, nx, ny + 1, HAIR)
    if (i < 3) line(x, y - 1, nx, ny - 1, HAIR)
  })
  const [ex, ey] = tail[9] ?? [0, 0]
  const [px, py] = tail[7] ?? [0, 0]
  line(px, py + 1.4, ex - 0.5, ey + 1.6, HAIR)

  const landings: number[] = []
  const legs = LEGS.map((leg, i) => {
    const spec = pose.legs[i] ?? g(0)
    const [jx, jy] = world(leg.joint[0], leg.joint[1])
    const target: Pt = 'g' in spec ? [Math.round(jx + spec.g), GROUND] : world(leg.joint[0] + spec.a[0], leg.joint[1] + spec.a[1])
    const dx = target[0] - jx
    const dy = target[1] - jy
    const dist = clamp(Math.hypot(dx, dy), Math.abs(leg.upper - leg.lower) + 0.6, leg.upper + leg.lower - 0.01)
    const th = Math.atan2(dy, dx)
    const bend = Math.acos(clamp((leg.upper ** 2 + dist ** 2 - leg.lower ** 2) / (2 * leg.upper * dist), -1, 1))
    const ang = leg.fore ? th - bend : th + bend
    const knee: Pt = [jx + Math.cos(ang) * leg.upper, jy + Math.sin(ang) * leg.upper]
    const was = prev.legs[i] ?? g(0)
    if ('g' in spec && !('g' in was)) landings.push(target[0])
    return { leg, joint: [jx, jy] as Pt, knee, hoof: target, isDown: 'g' in spec }
  })
  const drawLeg = (l: (typeof legs)[number]) => {
    const part = l.leg.near ? NEAR_LEG : FAR_LEG
    const [jx, jy] = l.joint
    const [kx, ky] = l.knee
    const [hx, hy] = l.hoof
    const side = l.leg.fore ? -1 : 1
    line(jx, jy, kx, ky, part)
    line(jx + side, jy, lerp(jx, kx, 0.7) + side * 0.6, lerp(jy, ky, 0.7), part)
    line(kx, ky, hx, hy, part)
    if (l.isDown) put(hx + 1, hy, part)
  }
  for (const l of legs) if (!l.leg.near) drawLeg(l)

  for (let y = 0; y < H; y++) {
    for (let x = 8; x < 52; x++) {
      const [bx, by] = rot(x - CX, y - cy, -pose.pitch)
      if (isBody(bx, by, pose.neck)) mask[y * W + x] = BODY
    }
  }
  for (const l of legs) if (l.leg.near) drawLeg(l)

  for (let i = 0; i <= 12; i++) {
    const t = i / 12
    const ax = lerp(3.6, 11.2, t)
    const ay = lerp(-3.6, -8.8, t)
    const flutter = Math.sin(TAU * (f / 8) + t * 4) * 0.6
    const [sx, sy] = world(...fromNeck(ax, ay, pose.neck))
    const [tx, ty] = world(...fromNeck(ax - 2.4 - t * 0.6, ay - 0.6 + flutter, pose.neck))
    line(sx, sy, tx, ty, HAIR)
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x
        if (mask[i]) continue
        const n = [i - 1, i + 1, i - W, i + W].filter(j => (mask[j] ?? 0) >= BODY).length
        if (n >= 3) mask[i] = HAIR
      }
    }
  }

  return { mask, landings }
}

function tufts(c: Canvas, cam: number) {
  for (const t of TUFTS) {
    const k = depth(t.y)
    const sx = Math.round(32 + wrap(t.x - cam, WORLD) * k)
    const creek = Math.abs(wrap(t.x - CREEK_X - meander(t.y), WORLD))
    if (creek < CREEK_HALF + 2 || sx < -2 || sx > W + 2) continue
    const tall = Math.max(1, Math.round(t.h * k * 1.3))
    for (let b = 0; b < t.blades; b++) {
      const bx = sx + b - Math.floor(t.blades / 2)
      const bh = tall - (b % 2)
      for (let j = 1; j <= bh; j++) {
        if (bx >= 0 && bx < W) c.set(bx, t.y - j, j === bh ? (NEAR[3] ?? 0) : t.y === 29 ? (NEAR[2] ?? 0) : (NEAR[1] ?? 0))
      }
    }
  }
}

function render(): Int32Array[] {
  const horses = Array.from({ length: LOOP }, (_, f) => drawHorse(f))
  const puffs: { f: number; x: number; big: boolean }[] = []
  horses.forEach((h, f) => {
    const isJump = f - JUMP_AT === 2 || f - JUMP_AT === 11
    for (const x of h.landings) puffs.push({ f, x, big: isJump })
    if (f - JUMP_AT === 2) puffs.push({ f, x: 20, big: true })
  })

  const drawn = horses.map(({ mask }, f) => {
    const c = new Canvas()
    const bright = new Float32Array(W * H)
    const cam = SPEED * f
    const paint = (x: number, y: number, color: number, b: number) => {
      c.set(x, y, color)
      bright[y * W + x] = b
    }

    const shadow = new Uint8Array(W * H)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!mask[y * W + x]) continue
        const h = GROUND - y
        const sy = GROUND + Math.round(h * 0.2)
        const sx = x - Math.round(h * 0.12)
        if (sy >= GROUND && sy < H && sx >= 0) shadow[sy * W + sx] = 1
      }
    }

    for (let y = 19; y < H; y++) {
      const k = depth(y)
      const base = 9 - (y - 19) * 0.45
      for (let x = 0; x < W; x++) {
        const X = cam + (x - 32) / k
        const u = (X / WORLD) * TAU
        const patch = Math.sin(u * 5 + y * 0.35) + 0.5 * Math.sin(u * 11 + y * 0.6 + 1)
        let level = base + Math.round(patch * 0.8) * 0.5
        const creek = Math.abs(wrap(X - CREEK_X - meander(y), WORLD)) * k
        const half = CREEK_HALF * k
        if (creek < half) {
          const ry = 2 * VANISH - y
          const [sky] = skyAt(x, ry)
          const ripple = mod(y, 3) === 0
          const isSun = Math.hypot(x - SUN_X, ry - SUN_Y) <= SUN_R + 0.5
          paint(x, y, isSun ? (ripple ? 0xe8823e : 0xfbc65e) : mix(sky, 0x1b1036, ripple ? 0.5 : 0.3), isSun ? 0.8 : 0.5)
          continue
        }
        if (creek < half + 1.1) level = 1.2 + (y - 19) * 0.08
        if (shadow[y * W + x]) level -= 2
        paint(x, y, shade(GRASS, level, x, y), clamp(level / 14))
      }
    }

    const mesaShift = (cam * 64) / WORLD
    const hillShift = (cam * 128) / WORLD
    for (let y = 0; y < 22; y++) {
      for (let x = 0; x < W; x++) {
        const ht = hillTop(mod(x + hillShift, 128))
        if (y >= 19 && y < ht) continue
        if (y >= ht && y <= 20) {
          const rim = y < ht + 1 ? 3.2 : 0
          paint(x, y, shade(HILL, 1.4 + rim + (y > ht + 2 ? -0.6 : 0), x, y), 0.3 + rim * 0.1)
          continue
        }
        if (y >= 19) continue
        const mt = mesaTop(mod(x + mesaShift, 64))
        if (y >= mt) {
          const rim = y < mt + 1 ? 2.4 : 0
          paint(x, y, shade(MESA, 0.9 + rim + (y >= 18 ? 0.6 : 0), x, y), 0.45)
          continue
        }
        const [color, b] = skyAt(x, y)
        paint(x, y, color, b)
      }
    }
    for (const tx0 of TREES) {
      const tx = Math.round(mod(tx0 - hillShift + 4, 128) - 4)
      if (tx < -3 || tx > W + 2) continue
      const ty = Math.round(hillTop(mod(tx + hillShift, 128)))
      c.sprite(tx - 2, ty - 6, TREE, { '#': HILL[0] ?? 0, '+': HILL[3] ?? 0 })
    }

    for (const p of puffs) {
      const age = mod(f - p.f, LOOP)
      if (age < 1 || age > 6) continue
      const life = 1 - age / 7
      const r = (p.big ? 1.3 : 0.7) + age * (p.big ? 0.45 : 0.3)
      const px = p.x - age * SPEED * 0.8
      const py = GROUND - 0.6 - age * 0.45
      for (let y = Math.floor(py - r); y <= Math.ceil(py + r); y++) {
        for (let x = Math.floor(px - r); x <= Math.ceil(px + r); x++) {
          const d = Math.hypot(x - px, (y - py) * 1.3) / r
          const density = life * (1.1 - d)
          if (d > 1 || density < threshold(x, y) * 0.9) continue
          c.tint(x, y, 0xf4a860, density > 0.5 ? 0.5 : 0.3)
        }
      }
    }

    const level = new Float32Array(W * H).fill(-1)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const part = mask[y * W + x] ?? 0
        if (!part) continue
        let glow = 0
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y - 1], [x, y + 1]] as const) {
          if (nx < 0 || nx >= W || ny < 0 || ny >= H || mask[ny * W + nx]) continue
          glow = Math.max(glow, bright[ny * W + nx] ?? 0)
        }
        const isLeg = part === FAR_LEG || part === NEAR_LEG
        const rim = clamp((glow - (isLeg ? 0.8 : 0.6)) / 0.4)
        const base = part === FAR_LEG ? 0.6 : part === HAIR ? 1.2 : 1.8
        level[y * W + x] = rim > 0.1 ? 3 + rim * 3 : base
      }
    }
    return { c, cam, level }
  })

  const isEdge = (level: Float32Array, i: number) => {
    const x = i % W
    return [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W].some(j => j >= 0 && j < W * H && (level[j] ?? -1) < 0)
  }
  let was = drawn[LOOP - 1]?.level ?? new Float32Array(W * H)
  for (let lap = 0; lap < 2; lap++) {
    for (const d of drawn) {
      const now = d.level.slice()
      for (let i = 0; i < W * H; i++) {
        const want = d.level[i] ?? -1
        if (want < 0 || !isEdge(d.level, i)) continue
        const x = i % W
        const y = (i - x) / W
        let near = -1
        let best = 99
        for (let v = -2; v <= 2; v++) {
          for (let u = -2; u <= 2; u++) {
            const j = (y + v) * W + x + u
            const l = was[j] ?? -1
            const dist = u * u + v * v
            if (x + u < 0 || x + u >= W || l < 0 || dist >= best || !isEdge(was, j)) continue
            best = dist
            near = l
          }
        }
        now[i] = near < 0 ? want : clamp(want, near - 1, near + 1)
      }
      if (lap === 1) d.level = now
      was = now
    }
  }

  return drawn.map(({ c, cam, level }) => {
    for (let i = 0; i < W * H; i++) {
      const l = level[i] ?? -1
      if (l >= 0) c.set(i % W, Math.floor(i / W), shade(HORSE, l, i % W, Math.floor(i / W)))
    }

    tufts(c, cam)
    for (const [sx0, tall] of STALKS) {
      const sx = Math.round(32 + wrap(sx0 - cam, WORLD) * 1.45)
      if (sx < -4 || sx > W + 4) continue
      for (let b = -2; b <= 2; b++) {
        const h = tall - Math.abs(b) * 2 + (b === 1 ? 1 : 0)
        const lean = b * 0.5
        for (let j = 0; j < h; j++) {
          const x = Math.round(sx + b + lean * (j / h) * 2)
          c.set(x, H - 1 - j, (j === h - 1 ? NEAR[4] : j > h - 3 ? NEAR[2] : NEAR[0]) ?? 0)
        }
      }
    }

    return c.px
  })
}

export const scene: Scene = {
  verb: 'Galloping',
  render,
  hero: JUMP_AT + 5,
  snaps: [{ box: [0, 23, 63, 31], colors: NEAR, why: 'the grass right in front of the lens whips past at 5 to 6 px a frame, the speed of the gallop' }],
}
