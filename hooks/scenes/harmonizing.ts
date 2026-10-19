import { Canvas, TAU, beat, clamp, ease, frames, hash, hex, lerp, mix, mod, smoothstep, shade, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const SKY = hex('1b1940 25214f 31295c 433269 593b73 744679 93537d a8607f bd6f80 d28583 e3a088 efbf94')
const FAR = hex('3a2a5a 4a3268 5c3c72')
const NEAR = hex('1c1430 251a3c 2f2148')
const BARK = hex('120a16 1f111e 30192a 452434 5f3440 7e4a4c')
const BLOSSOM = hex('6a2a52 a54a78 d77a9c f2a9bc fdd4d8 fff2ee')
const MOON = hex('b8a4b0 d6c4c4 ece0d4 fbf3e4')

const RIBBONS = [
  hex('0c3446 145e72 22949e 4ec8c2 a6f0e0 e8fff6'),
  hex('3e0c2e 7a1a4c bc3468 ec6a94 fdb0c6 fff0f4'),
  hex('4e2808 8e5410 d08e1c f2c040 fde89a fffbe0'),
]

type Kind = { back: readonly number[]; belly: readonly number[]; cap: readonly number[]; beak: number }
const KINDS: Kind[] = [
  { back: hex('0e1636 18295a 243f88 3660b2 5486d2 84b0ea'), belly: hex('3e3c5c 6a6a8a 9c9cb8 d2d0e0 f2f0f6'), cap: hex('0a0e22 141a3a'), beak: 0x2a2632 },
  { back: hex('1a1016 2c1e1c 433024 5e4430 7c5c40 9a7652'), belly: hex('5a1a0e 902e14 c44e1e e8763a f8a258 fcc884'), cap: hex('1a1016 2c1e1c'), beak: 0x2e2020 },
  { back: hex('3e2a0c 6e5212 a88a1e d8bc32 f2dc5c fdf0a0'), belly: hex('3e2a0c 6e5212 a88a1e d8bc32 f2dc5c fdf0a0'), cap: hex('0e0a12 1c1622'), beak: 0xd8946a },
]

const SOLOS: [number, number][] = [[4, 16], [18, 30], [32, 44]]
const CHORUS: [number, number] = [48, 66]
const inside = (f: number, [a, b]: [number, number]) => f >= a && f < b
const isChorus = (f: number) => inside(mod(f, LOOP), CHORUS)
function isSinging(i: number, f: number): boolean {
  const g = mod(f, LOOP)
  return inside(g, SOLOS[i] ?? [0, 0]) || inside(g, CHORUS)
}

const dip = (f: number) => {
  const p = beat(mod(f, LOOP), CHORUS[0] - 1, CHORUS[0] + 16)
  return p <= 0 || p >= 1 ? 0 : 1.6 * Math.sin(TAU * 1.5 * p) * (1 - p) ** 1.5
}
const branchY = (x: number, f: number) => 26 - 5.5 * smoothstep(-6, 66, x) + Math.sin(x * 0.21) * 0.7 + dip(f) * (x / 60) ** 2
const thickness = (x: number) => lerp(3.8, 1.3, clamp(x / 58))
const branchTop = (x: number, f: number) => Math.round(branchY(x, f) - thickness(x) / 2)

const PERCH = [14, 32, 49]

type Pose = { facing: number; open: number; tilt: number; puff: number; blink: boolean; bob: number }

function poseAt(i: number, f: number): Pose {
  const g = mod(f, LOOP)
  const sings = isSinging(i, g)
  const breath = isSinging(i, g + 2) && !sings
  const chorusBeat = isChorus(g) ? (Math.floor((g - CHORUS[0]) / 3) % 2) : 0
  let facing = i === 2 ? -1 : 1
  if (i === 1) facing = g === 4 ? 0.6 : g === 5 ? -0.6 : g === 16 ? -0.6 : g === 17 ? 0.6 : inside(g, [5, 17]) ? -1 : 1
  return {
    facing,
    open: sings ? 0.55 + 0.45 * Math.abs(Math.sin(g * 1.3 + i)) : 0,
    tilt: sings ? (isChorus(g) ? 1.3 : 1) : breath ? 0.4 : 0,
    puff: breath ? 1 : sings ? 0.4 : 0,
    blink: !sings && hash(i, Math.floor(g / 3), 5) > 0.86,
    bob: sings ? chorusBeat : 0,
  }
}

function beakTip(i: number, f: number): [number, number] {
  const p = poseAt(i, f)
  const x = PERCH[i] ?? 0
  const hx = 2.1 - p.tilt * 0.5
  const hy = -5.8 - p.tilt * 0.6 - p.puff * 0.4 + p.bob
  return [x + p.facing * (hx + 2.4), branchTop(x, f) + hy - 0.4 - p.tilt * 1.4]
}

function drawBird(c: Canvas, i: number, f: number): void {
  const kind = KINDS[i] ?? KINDS[0]!
  const p = poseAt(i, f)
  const bx = PERCH[i] ?? 0
  const by = branchTop(bx, f) + p.bob
  const body = { x: -0.6, y: -3.1 - p.puff * 0.3, rx: 3.4 + p.puff * 0.5, ry: 2.6 + p.puff * 0.4 }
  const head = { x: 2.1 - p.tilt * 0.5, y: -5.8 - p.tilt * 0.6 - p.puff * 0.4, r: 2.25 }
  const light = (nx: number, ny: number) => {
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
    return Math.max(0, 0.62 * nx * p.facing - 0.5 * ny + 0.6 * nz)
  }
  for (let y = by - 10; y <= by; y++) {
    for (let x = bx - 9; x <= bx + 9; x++) {
      const u = (x - bx) / p.facing
      const v = y - by
      const t = clamp(((u + 3) * -3.5 + (v + 2.6) * 1.6) / (3.5 * 3.5 + 1.6 * 1.6))
      const tx = -3 - 3.5 * t
      const ty = -2.6 + 1.6 * t
      const isTail = Math.hypot(u - tx, v - ty) < 0.75 + (1 - t) * 0.35
      const hu = (u - head.x) / head.r
      const hv = (v - head.y) / head.r
      const bu = (u - body.x) / body.rx
      const bv = (v - body.y) / body.ry
      let color: number | undefined
      if (hu * hu + hv * hv <= 1) {
        const lit = light(hu, hv)
        const isTop = hv < -0.15
        if (i === 0) color = isTop || hu < -0.5 ? shade(kind.back, 1.6 + lit * 3.4) : shade(kind.belly, 1 + lit * 3)
        else if (i === 1) color = hu > -0.3 && hv > -0.4 ? shade(kind.belly, 1.2 + lit * 3.6) : shade(kind.back, 1.4 + lit * 3.4)
        else color = hv < -0.25 ? shade(kind.cap, lit * 2) : shade(kind.back, 1.6 + lit * 3.6)
      } else if (bu * bu + bv * bv <= 1) {
        const lit = light(bu, bv)
        const isBelly = bv > -0.1 && bu > -0.55
        const wu = (u - body.x + 0.9) / 2.4
        const wv = (v - body.y + 0.4) / 1.4
        const isWing = wu * wu + wv * wv <= 1
        if (isWing && i === 2) color = wv > 0.45 ? 0xe8e0d8 : shade(kind.cap, 0.6 + lit * 1.4)
        else if (isWing) color = shade(kind.back, 0.6 + lit * 3 + (wv < -0.5 ? 0.8 : 0))
        else if (isBelly) color = shade(kind.belly, 1.2 + lit * 3.4)
        else color = shade(kind.back, 1.2 + lit * 3.6)
      } else if (isTail) color = i === 2 ? shade(kind.cap, 1) : shade(kind.back, 1 + (1 - t) * 0.8)
      if (color !== undefined) c.set(x, y, color)
    }
  }
  const hx = bx + p.facing * head.x
  const hy = by + head.y
  if (i === 0) {
    c.set(hx + p.facing * 0.2, hy, kind.cap[0] ?? 0)
    c.set(hx - p.facing * 1, hy, kind.cap[1] ?? 0)
  }
  c.set(hx + p.facing * 0.8, hy - 0.4, p.blink ? (kind.back[3] ?? 0) : 0x0a0610)
  const dir = -p.tilt * 0.55
  const ox = hx + p.facing * 2
  const oy = hy + 0.3
  for (const [k, side] of [[0, -1], [1, 1]] as const) {
    const a = dir + side * p.open * 0.5
    for (let s = 0; s <= (k === 0 ? 1.8 : 1.2); s += 0.9) {
      c.set(ox + p.facing * Math.cos(a) * s, oy + Math.sin(a) * s, kind.beak)
    }
  }
  if (p.open > 0.6) c.set(ox + p.facing * 0.9, oy + Math.sin(dir) * 0.9, 0x5a1424)
}

const TWIGS: [number, number, number, number][] = [[6, -1, 2, 16], [22, -1, 25, 15], [38, 1, 42, 27], [44, -1, 41, 13], [56, 0, 62, 16]]
type Bloom = { x: number; y: number; size: number; on: number }
const BLOOMS: Bloom[] = [
  [2, 15, 1, 0], [4, 18, 0, 0], [26, 14, 1, 1], [23, 17, 0, 1], [42, 28, 1, 2], [40, 12, 1, 3], [43, 15, 0, 3],
  [62, 15, 1, 4], [59, 18, 0, 4], [9, -1, 0, -1], [20, -1, 1, -1], [37, -1, 0, -1], [27, 0, 0, -1], [54, -1, 0, -1], [61, 19, 0, 4],
].map(([x, y, size, on]) => ({ x: x ?? 0, y: y ?? 0, size: size ?? 0, on: on ?? 0 }))

function bloomAt(b: Bloom, f: number): [number, number] {
  if (b.on < 0) return [b.x, branchTop(b.x, f) + b.y]
  return [b.x, b.y + Math.round(dip(f) * (b.x / 60) ** 2)]
}

function drawBloom(c: Canvas, x: number, y: number, size: number, glow: number): void {
  const petal = (dx: number, dy: number, level: number) => c.set(x + dx, y + dy, shade(BLOSSOM, level + glow))
  const flower = (fx: number, fy: number, lift: number) => {
    petal(fx, fy - 1, 4 + lift)
    petal(fx + 1, fy - 1, 4 + lift)
    petal(fx - 1, fy, 4 + lift)
    petal(fx, fy, 3 + lift)
    petal(fx + 1, fy, 3 + lift)
    petal(fx, fy + 1, 2 + lift)
  }
  if (size) flower(2, 1, -1)
  flower(0, 0, 0)
}

type Point = { x: number; y: number; z: number; twist: number; age: number; isAccent: boolean }
const LIFE = 56
const RATE = TAU / LOOP
const STEP = 0.5

function ribbon(i: number, f: number): Point[][] {
  const runs: Point[][] = []
  let run: Point[] = []
  for (let a = LIFE; a >= 0; a -= STEP) {
    const b = f - a
    const born = Math.floor(b)
    if (!isSinging(i, born)) {
      if (run.length) runs.push(run)
      run = []
      continue
    }
    const chorus = isChorus(born)
    const [x0, y0] = beakTip(i, born)
    const sway = chorus ? b * RATE * 4 + i * (TAU / 3) : b * RATE * 6 + i * 1.7
    const conv = chorus ? smoothstep(0, 14, a) : 0.6 * smoothstep(0, 22, a)
    const amp = chorus ? lerp(0.5, 3.4, smoothstep(0, 14, a)) : lerp(0.4, 4.2, smoothstep(0, 18, a))
    const x = lerp(x0, 32, conv) + amp * Math.sin(sway)
    const y = lerp(y0, 16, chorus ? conv : 0) - (chorus ? 0.72 * a : 0.7 * a + 0.01 * a * a)
    run.push({ x, y, z: chorus ? Math.cos(sway) : -1 + i * 0.1, twist: Math.cos(b * RATE * 9 + a * 0.12 + i), age: a, isAccent: b === born && mod(born, 4) === 0 })
  }
  if (run.length) runs.push(run)
  return runs
}

const STARS: [number, number][] = [[20, 2], [47, 4], [57, 1], [14, 8], [36, 1]]

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const g = mod(f, LOOP)
    const songs = [0, 1, 2].map(i => ribbon(i, f))
    const chorusGlow = smoothstep(CHORUS[0] - 2, CHORUS[0] + 6, g) * (1 - smoothstep(CHORUS[1] - 2, LOOP - 1, g))

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const sun = Math.max(0, 1 - Math.hypot((x - 50) / 30, (y - 31) / 14)) * 2.2
        c.set(x, y, shade(SKY, y * 0.33 + sun + chorusGlow * 0.6))
      }
    }
    for (const [i, [sx, sy]] of STARS.entries()) {
      if (wave(f, LOOP, 3, i * 0.37) > -0.4) c.set(sx, sy, mix(SKY[2] ?? 0, 0xfff6e0, 0.6 + 0.3 * wave(f, LOOP, 3, i * 0.37)))
    }
    for (let y = 1; y < 12; y++) {
      for (let x = 2; x < 14; x++) {
        const d = Math.hypot(x - 7.5, y - 6)
        if (d <= 3.3) {
          const isSea = (x === 6 && y === 5) || (x === 8 && y === 7) || (x === 9 && y === 7) || (x === 7 && y === 8)
          c.set(x, y, MOON[isSea ? 1 : x + y < 12 ? 3 : x + y > 15 ? 0 : 2] ?? 0)
        } else if (d <= 4.6) c.tint(x, y, MOON[3] ?? 0, 0.1)
      }
    }

    for (let x = 0; x < W; x++) {
      const far = Math.round(25.5 + 1.8 * Math.sin(x * 0.075 + 1) + 1.1 * Math.sin(x * 0.23))
      const near = Math.round(28.5 + 1.4 * Math.sin(x * 0.11 + 3.4) + 0.6 * Math.sin(x * 0.37))
      for (let y = far; y < H; y++) c.set(x, y, shade(FAR, y === far ? 2 : 1 - (y - far) * 0.15))
      for (let y = near; y < H; y++) c.set(x, y, shade(NEAR, y === near ? 2 : 0.8))
    }
    for (const [tx, th] of [[11, 4], [14, 3]] as const) {
      const base = Math.round(25.5 + 1.8 * Math.sin(tx * 0.075 + 1) + 1.1 * Math.sin(tx * 0.23))
      for (let y = base - th; y < base; y++) c.set(tx, y, FAR[0] ?? 0)
    }

    for (const [x0, on, x1, y1] of TWIGS) {
      const ty = branchTop(x0, f) + (on > 0 ? 2 : 0)
      const ey = y1 + Math.round(dip(f) * (x1 / 60) ** 2)
      c.line(x0, ty, x1, ey, BARK[2] ?? 0)
      c.line(x0, ty, lerp(x0, x1, 0.5), lerp(ty, ey, 0.5) + (on > 0 ? 0 : 0), BARK[3] ?? 0)
    }
    for (let x = 0; x <= 58; x++) {
      const top = branchTop(x, f)
      const th = Math.max(1, Math.round(thickness(x)))
      for (let k = 0; k < th; k++) {
        const level = k === 0 ? 4 + (x > 40 ? 0.6 : 0) : k === th - 1 && th > 2 ? 0.6 : 2
        const knot = k > 0 && hash(x, 41) > 0.9 ? -1 : 0
        c.set(x, top + k, shade(BARK, level + knot))
      }
    }
    c.line(58, branchTop(58, f), 63, branchTop(58, f) - 3, BARK[3] ?? 0)

    for (const b of BLOOMS) {
      const [x, y] = bloomAt(b, f)
      drawBloom(c, x, y, b.size, chorusGlow * 0.5)
    }
    for (let i = 0; i < 3; i++) drawBird(c, i, f)

    type Seg = { a: Point; b: Point; i: number }
    const segs: Seg[] = []
    songs.forEach((runs, i) => {
      for (const run of runs) for (let k = 0; k + 1 < run.length; k++) segs.push({ a: run[k]!, b: run[k + 1]!, i })
    })
    segs.sort((s, t) => s.a.z + s.b.z - (t.a.z + t.b.z))
    for (const { a, b, i } of segs) {
      const ramp = RIBBONS[i] ?? RIBBONS[0]!
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
      const px = -(b.y - a.y) / len
      const py = (b.x - a.x) / len
      const fade = smoothstep(LIFE - 18, LIFE, a.age)
      const width = Math.round(1 + 1.2 * Math.abs(a.twist) * (1 - fade))
      const face = a.twist > 0 ? 2.9 : 1.6
      for (let k = width - 1; k >= 0; k--) {
        const level = face + (k === 0 ? 0.9 : -0.7 * k) + a.z * 0.5 - fade * 1.2
        c.line(a.x + px * k, a.y + py * k, b.x + px * k, b.y + py * k, shade(ramp, level))
      }
      if (a.isAccent && a.twist > 0 && a.age > 1 && fade < 0.5) c.set(a.x, a.y, ramp[5] ?? 0)
    }

    for (let k = 0; k < 9; k++) {
      const born = CHORUS[0] + 1 + k * 2
      const age = mod(f - born, LOOP)
      if (age > 34) continue
      const src = BLOOMS[(k * 5) % BLOOMS.length] ?? BLOOMS[0]!
      const [sx, sy] = bloomAt(src, born)
      const x = sx + age * 0.35 + Math.sin(age * 0.4 + k) * 1.5
      const y = sy + age * 0.42 * ease.out(Math.min(1, (age + 2) / 8))
      if (y > H) continue
      c.set(x, y, shade(BLOSSOM, 3.4 + (Math.sin(age * 0.8 + k) > 0 ? 1 : 0)))
    }
  })
}

export const scene: Scene = { verb: 'Harmonizing', render, hero: 68 }
