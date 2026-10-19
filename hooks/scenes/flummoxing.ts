import { Canvas, TAU, clamp, ease, hex, lerp, mod, shade, smoothstep, threshold, type Ramp, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const SKY = hex('86a8c0 a6b8bc cec8aa ecd29c f6e2b4')
const TREES = hex('1e3236 28423e 345440 46663f 5c7a44')
const FENCE = hex('3c2a26 5a3c2e 7a5236 9a6a40 b8844e d0a064 e4bc80')
const GRASS = hex('1a3420 23452a 2f5a2e 3f7032 548836 6ca03c 8ab84a aed060')
const HOUSE = hex('1e2440 2c3a60 3e5280 566ea0 7088b6')
const ROOF = hex('3a1418 5c1e1e 862c24 aa3e2a c85636')
const FUR = hex('3a3040 5e5462 857b84 aca2a4 d0c6c0 ece2d6 fff8ec')
const PATCH = hex('2a1208 4a210c 6e3414 924a1e b46428 d08238 e6a458')
const EAR = hex('1e0c06 341608 4e220c 6a3012 863f18')
const BALL = hex('34420c 5a6e14 8aa020 b6cc34 dcec5e f4fa9e')
const STAR = hex('c0841c f2c84a fde88c fffce0')
const DUST = hex('7a6a4c a49070 cab694 eadcb8')
const TONGUE = hex('9a2e44 d65a72 f08a9a')
const INK = 0x1e1018

const at = (a: readonly number[], i: number) => a[i] ?? 0

const GROUND_Y = 33.5
const DEPTH = 0.45
const toX = (X: number) => 32 + X
const toY = (Y: number, Z: number) => GROUND_Y - Y - Z * DEPTH

const LIGHT = (() => {
  const l = [-0.62, -0.5, 0.6]
  const n = Math.hypot(...l)
  return l.map(v => v / n) as [number, number, number]
})()

type V = [number, number, number]
const add = (a: V, b: V, k = 1): V => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const scale = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k]
const forward = (phi: number): V => [Math.cos(phi), 0, Math.sin(phi)]
const rightOf = (phi: number): V => [Math.sin(phi), 0, -Math.cos(phi)]
const UP: V = [0, 1, 0]

const CX = 1
const CZ = 9
const SPIN0 = 20
const SPIN1 = 60
const FLOP0 = 64
const FLOP1 = 68
const RISE0 = 88
const TURNS = 3

const TURN: number[] = (() => {
  const omega = (f: number) => {
    const t = (f - SPIN0) / (SPIN1 - SPIN0)
    if (t <= 0 || t >= 1) return 0
    return (0.1 + t ** 1.8) * (1 - smoothstep(0.88, 1, t))
  }
  const cum = [0]
  for (let f = 0; f < LOOP; f++) cum.push(at(cum, f) + omega(f + 0.5))
  const total = at(cum, LOOP)
  return cum.map(v => (v / total) * TAU * TURNS)
})()
const turnAt = (f: number) => at(TURN, f)
const speedAt = (f: number) => at(TURN, f + 1) - at(TURN, f)

type Pose = {
  heading: number
  curl: number
  roll: number
  height: number
  rump: number
  run: number
  headYaw: number
  headLift: number
  wag: number
  earFly: number
  dizzy: boolean
  tongue: boolean
}

const HEIGHT = 4.3

function pose(f: number): Pose {
  const wag = Math.sin((TAU * 16 * f) / LOOP)
  const notice = ease.inOut(clamp((f - 2) / 7))
  const coil = ease.in(clamp((f - 15) / 5))
  const crouch = Math.sin(clamp((f - 13) / 7) * Math.PI)
  const stop = ease.inOut(clamp((f - SPIN1 + 1) / 5))
  const flop = ease.in(clamp((f - FLOP0) / (FLOP1 - FLOP0)))
  const rise = ease.inOut(clamp((f - RISE0) / (LOOP - RISE0)))
  const spinning = f >= SPIN0 && f < SPIN1
  const wobble = f >= SPIN1 && f < FLOP0 + 1 ? Math.sin((f - SPIN1) * 1.1) * (1 - (f - SPIN1) / 6) : 0
  const lying = flop * (1 - rise)
  const bounce = f >= FLOP1 && f < FLOP1 + 5 ? Math.min(1, 1.3 * Math.sin(((f - FLOP1) / 5) * Math.PI)) * 0.7 : 0
  const breathe = lying > 0.9 && f < RISE0 ? Math.max(0, Math.sin((f - FLOP1) * 0.8)) * 0.35 : 0
  const hop = Math.sin(rise * Math.PI) * 1.4
  const lifting = smoothstep(82, 87, f) * (1 - rise)

  return {
    heading: -turnAt(f),
    curl: f < SPIN1 ? 0.5 * notice + 0.5 * coil : (1 - stop) + stop * 0.3 * (1 - flop),
    roll: Math.PI * lying + wobble * 0.4,
    height: lerp(HEIGHT, 2.3, lying) - crouch * 0.9 + bounce + breathe + hop,
    rump: f >= 13 && f < SPIN0 ? Math.sin((f - 13) * 2.2) * 0.5 * crouch : 0,
    run: spinning ? clamp(speedAt(f) * 2.5 + 0.45) : f >= SPIN1 ? 0.45 * clamp(1 - (f - SPIN1 + 1) / 3) : 0,
    headYaw: f < SPIN0 ? -0.9 * notice + 0.5 * coil : spinning ? -0.4 : wobble * 0.6,
    headLift: lifting * 1.2,
    wag: f < SPIN0 ? wag * (0.4 + notice * 0.6) : f >= 83 ? wag : spinning ? wag * 0.4 : 0,
    earFly: spinning ? clamp(speedAt(f)) : 0,
    dizzy: f >= SPIN1 && f < RISE0 + 2,
    tongue: f >= SPIN1 + 3 && f < RISE0 + 3,
  }
}

type Ball = { p: V; r: number; ramp: Ramp; base: number; saddle?: Ramp; up: V }
type Mark = { p: V; color: number }

const SPINE = 9
const KAPPA = 1 / 3.2

function dog(f: number, q: Pose): { balls: Ball[]; marks: Mark[]; head: V; mouth: V } {
  const kappa = -q.curl * KAPPA
  const right0 = rightOf(q.heading)
  const mid: V = add([CX, 0, CZ], right0, -q.curl / KAPPA)
  const up: V = add(scale(UP, Math.cos(q.roll)), right0, -Math.sin(q.roll))
  const down = scale(up, -1)

  const ds = 0.5
  const half = SPINE / 2 / ds
  const pts: { x: number; z: number; phi: number }[] = []
  let x = mid[0]
  let z = mid[2]
  let phi = q.heading
  for (let i = 0; i < half; i++) {
    x -= Math.cos(phi) * ds
    z -= Math.sin(phi) * ds
    phi -= kappa * ds
    pts.unshift({ x, z, phi })
  }
  x = mid[0]
  z = mid[2]
  phi = q.heading
  pts.push({ x, z, phi })
  for (let i = 0; i < half; i++) {
    phi += kappa * ds
    x += Math.cos(phi) * ds
    z += Math.sin(phi) * ds
    pts.push({ x, z, phi })
  }

  const balls: Ball[] = []
  const marks: Mark[] = []
  const along = (s: number) => pts[Math.round(clamp(s) * (pts.length - 1))] ?? { x: 0, z: 0, phi: 0 }
  for (let k = 0; k <= SPINE; k++) {
    const s = k / SPINE
    const p = along(s)
    const r = 2 + 0.35 * Math.exp(-(((s - 0.82) / 0.16) ** 2)) + 0.1 * Math.exp(-(((s - 0.12) / 0.1) ** 2))
    const y = q.height + (s < 0.4 ? q.rump * (0.4 - s) * 2.5 : 0) + s * 0.4
    balls.push({ p: [p.x, y, p.z], r, ramp: FUR, base: 4.4, saddle: s > 0.25 && s < 0.62 ? PATCH : undefined, up })
  }

  const swingPhase = turnAt(f) * 2.4
  const legLen = (h: number) => Math.max(1.6, h - 1.1)
  for (const [s, side, phase] of [[0.86, 1, 0], [0.86, -1, Math.PI], [0.1, 1, Math.PI * 0.5], [0.1, -1, Math.PI * 1.5]] as const) {
    const p = along(s)
    const sideV = add(scale(rightOf(p.phi), Math.cos(q.roll)), UP, Math.sin(q.roll))
    const fwd = forward(p.phi)
    const root = add(add([p.x, q.height, p.z], down, 1.1), sideV, side * 1.05)
    const kick = q.roll > 2 ? Math.sin(f * 0.6 + phase) * 0.25 : 0
    const swing = q.run * Math.sin(swingPhase + phase) * 1.3 + kick
    const lift = q.run * Math.max(0, Math.cos(swingPhase + phase)) * 0.9
    const len = legLen(q.roll > 1.5 ? HEIGHT : q.height + (q.roll < 1.5 ? 0 : 0)) - lift
    for (let t = 0; t <= 1.001; t += 0.25) {
      balls.push({ p: add(add(root, down, len * t), fwd, swing * t * t), r: 0.72, ramp: FUR, base: t > 0.9 ? 3.6 : 4, up })
    }
  }

  const root = pts[0] ?? { x: 0, z: 0, phi: 0 }
  let tp: V = [root.x, q.height + 0.9, root.z]
  let tphi = root.phi
  for (let k = 0; k < 6; k++) {
    tphi -= (kappa + q.wag * 0.4) * 0.75
    tp = add(add(tp, forward(tphi), -0.62), up, (0.62 - k * 0.06) * (1 - q.curl * 0.6))
    balls.push({ p: tp, r: 0.66 - k * 0.04, ramp: k >= 4 ? PATCH : FUR, base: k >= 4 ? 4.6 : 4.6, up })
  }

  const neck = pts[pts.length - 1] ?? { x: 0, z: 0, phi: 0 }
  const hphi = neck.phi + q.headYaw
  const hf = forward(hphi)
  const hr = add(scale(rightOf(hphi), Math.cos(q.roll)), UP, Math.sin(q.roll))
  const lift = (p: V, min: number): V => [p[0], Math.max(min, p[1]) + q.headLift, p[2]]
  const head = lift(add(add([neck.x, q.height, neck.z], hf, 1.3), up, 2.3), 2.3)
  balls.push({ p: head, r: 2.3, ramp: PATCH, base: 4.4, up })
  const snout = lift(add(add(head, hf, 2), up, -0.6), 1.3)
  balls.push({ p: snout, r: 1.25, ramp: FUR, base: 4.8, up })
  const muzzle = add(add(snout, hf, 1), up, -0.1)
  balls.push({ p: muzzle, r: 0.85, ramp: FUR, base: 4.6, up })
  marks.push({ p: add(add(muzzle, hf, 0.75), up, 0.2), color: INK })
  for (const side of [-1, 1]) {
    marks.push({ p: add(add(add(head, hf, 1.3), up, 0.5), hr, side * 1.1), color: INK })
  }
  const outward = scale(rightOf(neck.phi), -1)
  for (const side of [-1, 1]) {
    const base = add(add(add(head, hf, -0.2), up, 1.4), hr, side * 1.5)
    const flap = Math.sin(f * 1.3 + side) * 0.3 * (q.dizzy ? 1 : 0)
    const tip = add(add(add(base, add(add(up, hr, side * 0.6), hf, 0.7), -1.2 * (1 - q.earFly) + flap), outward, q.earFly * 2.4), hf, -q.earFly * 1.3)
    balls.push({ p: base, r: 0.95, ramp: EAR, base: 3.4, up })
    balls.push({ p: tip, r: 0.85, ramp: EAR, base: 3, up })
  }

  return { balls, marks, head, mouth: add(muzzle, hf, 0.2) }
}

const YARD: Int32Array = (() => {
  const c = new Canvas()
  for (let y = 0; y < 8; y++) c.rect(0, y, W, 1, shade(SKY, (y / 7) * 4.2))
  const domes = [[3, 6, 7], [14, 4, 6], [24, 7, 6], [37, 3, 8], [50, 5, 7], [61, 4, 6]] as const
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < W; x++) {
      for (const [dx, dy, r] of domes) {
        const d = Math.hypot((x - dx) / r, (y - dy) / (r * 0.8))
        if (d > 1) continue
        const lit = -((x - dx) / r) * 0.8 - ((y - dy) / r) * 0.6
        c.set(x, y, shade(TREES, 2 + lit * 1.4))
      }
    }
  }
  for (let x = 0; x < W; x++) {
    const k = mod(x + 1, 5)
    for (let y = 7; y < 17; y++) {
      const isTop = y === 7 && k !== 4
      const isGap = k === 4 && y > 7
      const isRail = y === 10 || y === 14
      if (isGap) {
        c.set(x, y, shade(FENCE, isRail ? 1.4 : 0.8))
        continue
      }
      c.set(x, y, shade(FENCE, 3.4 + (isTop ? 1.5 : 0) + (k === 0 ? 0.6 : 0) + (isRail ? -0.8 : 0) - (y - 7) * 0.12))
    }
  }
  for (let y = 17; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const band = 2.4 + ((y - 17) / 14) * 3.2
      c.set(x, y, shade(GRASS, band - (y === 17 ? 1.2 : 0)))
    }
  }
  for (let i = 0; i < 26; i++) {
    const x = Math.floor((i * 23.7 + 5) % 62) + 1
    const y = 19 + ((i * 7) % 12)
    const lv = 2.4 + ((y - 17) / 14) * 3.2
    c.set(x, y, shade(GRASS, lv + 1.2))
    c.set(x + 1, y, shade(GRASS, lv + 1.2))
    c.set(x + 1, y - 1, shade(GRASS, lv + 1.6))
  }
  c.poly([[1.5, 13.5], [8, 7], [14.5, 13.5]], (px, py) => shade(ROOF, 3 + (px < 8 ? 0.9 : -0.4) - (py - 7) * 0.08))
  c.line(2, 13, 8, 7, at(ROOF, 4))
  c.rect(3, 13, 10, 8, (px, py) => shade(HOUSE, 3 + (px < 5 ? 0.7 : px > 10 ? -0.8 : 0) - (py === 13 ? 1.4 : 0)))
  c.rect(6, 16, 4, 5, at(HOUSE, 0))
  c.rect(7, 15, 2, 1, at(HOUSE, 0))
  c.rect(13, 20, 4, 1, shade(GRASS, 1.2))
  c.rect(17, 22, 5, 2, (px, py) => shade(HOUSE, 2.4 + (px === 17 ? 1.4 : 0) + (py === 22 ? 0.8 : 0)))
  c.rect(18, 21, 3, 1, at(HOUSE, 4))
  c.rect(22, 23, 3, 1, shade(GRASS, 2.2))
  c.disc(53.5, 28.5, 1.6, (px, py) => shade(BALL, 3 - (px - 53) * 0.9 - (py - 28) * 0.5))
  c.set(53, 28, at(BALL, 5))
  c.rect(55, 30, 3, 1, shade(GRASS, 3))
  return c.px
})()

const grassAt = (y: number) => 2.4 + ((y - 17) / 14) * 3.2

function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    c.px.set(YARD)
    const q = pose(f)
    const { balls, marks, head, mouth } = dog(f, q)

    for (const b of balls) {
      const gx = toX(b.p[0] + b.p[1] * 0.75)
      const gy = toY(0, b.p[2] + b.p[1] * 0.5)
      const rx = b.r * 1.1
      const ry = b.r * 0.6
      for (let y = Math.floor(gy - ry); y <= gy + ry; y++) {
        for (let x = Math.floor(gx - rx); x <= gx + rx; x++) {
          if (((x - gx) / rx) ** 2 + ((y - gy) / ry) ** 2 > 1 || y < 18 || y >= H || x < 0 || x >= W) continue
          c.set(x, y, shade(GRASS, grassAt(y) - 2))
        }
      }
    }

    const dust: { x: number; y: number; z: number; r: number; a: number }[] = []
    for (let b = SPIN0 + 12; b < SPIN1 + 1; b += 2) {
      const age = f - b
      if (age < 0 || age > 8) continue
      const ang = -turnAt(b) + 2.4
      dust.push({ x: CX + Math.cos(ang) * (3.5 + age * 0.3), y: 0.8 + age * 0.35, z: CZ + Math.sin(ang) * (3.5 + age * 0.3), r: 0.9 + age * 0.17, a: 1 - age / 8 })
    }
    if (f >= FLOP1 - 1 && f < FLOP1 + 8) {
      const age = f - FLOP1 + 1
      for (const side of [-1, 1]) dust.push({ x: CX + side * (5 + age * 0.6), y: 0.5 + age * 0.25, z: CZ - 2, r: 1 + age * 0.15, a: 1 - age / 8 })
    }
    const drawDust = (isFront: boolean) => {
      for (const d of dust) {
        if ((d.z < CZ) !== isFront) continue
        const px = toX(d.x)
        const py = toY(d.y, d.z)
        for (let y = Math.floor(py - d.r); y <= py + d.r; y++) {
          for (let x = Math.floor(px - d.r); x <= px + d.r; x++) {
            const dd = Math.hypot(x - px, y - py) / d.r
            const density = d.a * (1.2 - dd)
            if (dd > 1 || density < 0.25 || (density < 0.55 && (x + y) % 2 === 1)) continue
            c.set(x, y, shade(DUST, 1 + density * 2.4 - (y - py) * 0.3))
          }
        }
      }
    }
    drawDust(false)

    const speed = speedAt(f)
    const swoosh = (isFront: boolean) => {
      const len = Math.min(2.4, (speed - 0.4) * 3)
      if (len <= 0) return
      const lead = -turnAt(f) + Math.PI / 2
      for (const [rx, ry, yy] of [[10.5, 3.8, 3.5], [9, 3.2, 7]] as const) {
        for (let a = 0; a < len; a += 0.04) {
          const ang = lead + 0.6 + a
          const z = Math.sin(ang)
          if ((z < 0) !== isFront) continue
          const px = Math.round(toX(CX + Math.cos(ang) * rx))
          const py = Math.round(toY(yy, CZ) - z * ry)
          const t = 1 - a / len
          if (t > threshold(px, py) * 0.9) c.set(px, py, t > 0.55 ? at(DUST, 3) : at(DUST, 2))
        }
      }
    }
    swoosh(false)

    const zbuf = new Float32Array(W * H).fill(Infinity)
    const level = new Float32Array(W * H)
    const ramps: (Ramp | undefined)[] = new Array<Ramp | undefined>(W * H)
    for (const b of balls) {
      const cx = toX(b.p[0])
      const cy = toY(b.p[1], b.p[2])
      for (let y = Math.floor(cy - b.r); y <= Math.ceil(cy + b.r); y++) {
        for (let x = Math.floor(cx - b.r); x <= Math.ceil(cx + b.r); x++) {
          if (x < 0 || x >= W || y < 0 || y >= H) continue
          const dx = (x - cx) / b.r
          const dy = (y - cy) / b.r
          const d2 = dx * dx + dy * dy
          if (d2 > 1) continue
          const nz = Math.sqrt(1 - d2)
          const depth = b.p[2] - nz * b.r * 0.6
          const i = y * W + x
          if (depth >= (zbuf[i] ?? Infinity)) continue
          zbuf[i] = depth
          const lit = dx * LIGHT[0] + dy * LIGHT[1] + nz * LIGHT[2]
          const isSaddle = b.saddle && dx * b.up[0] - dy * b.up[1] - nz * b.up[2] > -0.1
          ramps[i] = isSaddle ? b.saddle : b.ramp
          level[i] = b.base - 1.8 + lit * 2.8
        }
      }
    }
    for (let i = 0; i < W * H; i++) {
      const ramp = ramps[i]
      if (!ramp) continue
      const z = zbuf[i] ?? 0
      let crease = 0
      for (const j of [i - 1, i + 1, i - W, i + W]) if ((zbuf[j] ?? Infinity) < z - 1.4) crease = 1
      c.set(i % W, Math.floor(i / W), shade(ramp, (level[i] ?? 0) - crease * 1.6))
    }
    for (let i = 0; i < W * H; i++) {
      if (ramps[i]) continue
      const x = i % W
      const isEdge = (x > 0 && ramps[i - 1]) || (x < W - 1 && ramps[i + 1]) || ramps[i - W] || ramps[i + W]
      if (isEdge) c.set(x, Math.floor(i / W), INK)
    }
    for (const m of marks) {
      const x = Math.round(toX(m.p[0]))
      const y = Math.round(toY(m.p[1], m.p[2]))
      if (x < 0 || x >= W || y < 0 || y >= H) continue
      const z = zbuf[y * W + x] ?? Infinity
      if (z === Infinity || m.p[2] <= z + 1.2) c.set(x, y, m.color)
    }

    if (q.tongue) {
      const mx = Math.round(toX(mouth[0]))
      const my = Math.round(toY(mouth[1], mouth[2])) + 1
      const len = 1 + Math.round(Math.sin(f * 0.8) * 0.5 + 0.5)
      for (let k = 0; k < len; k++) c.set(mx, my + k, at(TONGUE, k === len - 1 ? 1 : 2))
      c.set(mx + 1, my + len, INK)
      c.set(mx, my + len, INK)
    }

    swoosh(true)
    drawDust(true)

    const starIn = smoothstep(FLOP0 - 3, FLOP0 + 1, f) * (1 - smoothstep(RISE0 - 2, RISE0 + 2, f))
    if (starIn > 0) {
      const hx = toX(head[0])
      const hy = toY(head[1], head[2]) - 4
      for (let k = 0; k < 3; k++) {
        const a = (TAU * f) / 16 + (k * TAU) / 3
        const x = Math.round(hx + Math.cos(a) * 5.5)
        const y = Math.round(hy + Math.sin(a) * 1.8)
        const isBehind = Math.sin(a) < 0
        const put = (px: number, py: number, col: number) => {
          if (isBehind && ramps[py * W + px]) return
          c.set(px, py, col)
        }
        const isBig = starIn > 0.3 && f < RISE0 - 4 + k * 2 && (f + k * 3) % 8 < 6
        put(x, y, at(STAR, 3))
        if (isBig) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) put(x + dx, y + dy, at(STAR, 1))
      }
    }

    out.push(c.px)
  }
  return out
}

export const scene: Scene = {
  verb: 'Flummoxing',
  render,
  hero: 76,
  snaps: [
    { frames: 55, box: [25, 20, 28, 22], colors: [INK, ...EAR], why: 'At top speed the dog comes round side-on for one frame, its head and ear flung out to the left.' },
  ],
}
