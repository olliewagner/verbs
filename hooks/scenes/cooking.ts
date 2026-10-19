import { Canvas, PALETTE, clamp, ease, fract, hash, hex, loopNoise, noise, particles, shade, smoothstep, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 48

const SKY = hex('080a1e 0b0e27 0f1331 141a3c 1b2147 252651 3a2c52 5a344c')
const STAR = hex('2c3566 56639e 9aa6dc e8ecff')
const FAR = hex('05061a 080a20 0d0e26 1a142a 34202c 552c2c')
const TREE = hex('020309 04060c 080b10 0e1314 181c18 2e2619 52341a 7e461b b25f20 e08a36 f6b860')
const GROUND = hex('040306 0a070a 140c0e 211311 331a14 4b2416 6a3318 8f4a1e')
const ROCK = hex('08060b 120e16 1d161e 2b1f27 3f2b2d 583a32 7a4f37 a26a3c d08e48')
const IRON = hex('050407 0b0a0e 131118 1d1921 29222a 3a2e33 553d3b 7a5240 a8703f d79a52')
const COOL = hex('0b0b13 161824 23283c 363f5e 56638a 8592b8')
const FIRE = PALETTE.fire
const EGG = hex('5e3a1c 94622e c99a5c e9d4ac f7eedb fffcf2')
const YOLK = hex('8a3606 c45a08 ee8812 f9b428 ffd85a fff3b4')
const LEAN = hex('2c090c 581312 86211a b03a22 d2643a ec9258')
const FAT = hex('5a2e22 965c40 cc9670 eccaa0 fbecd4')
const STEAM = hex('2a2840 4a4660 7a728c b0a6b8')

const FIRE_X = 32
const FIRE_Y = 25

function flare(f: number): number {
  if (f < 34) return 0
  if (f < 36) return (f - 33) / 2
  return Math.max(0, 1 - (f - 36) / 11) ** 1.6
}

const power = (f: number) => 1 + 0.07 * wave(f, LOOP, 5) + 0.05 * wave(f, LOOP, 9, 0.37) + 0.55 * flare(f)

function lightOf(p: number, x: number, y: number, reach = 60): number {
  const d = Math.hypot(x - FIRE_X, (y - FIRE_Y) * 1.25)
  return p * Math.max(0, 1 - d / reach) ** 1.4
}

const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

type Pine = { x: number; top: number; base: number; half: number; tiers: number }

function halfAt(p: Pine, y: number): number {
  const h = (y - p.top) / (p.base - p.top)
  return p.half * (0.1 + 0.9 * h) * (0.55 + 0.45 * fract(h * p.tiers + 0.15))
}

const inPine = (p: Pine, x: number, y: number) => y >= p.top && y <= p.base && Math.abs(x - p.x) <= halfAt(p, y)

const FAR_PINES: Pine[] = Array.from({ length: 22 }, (_, i) => ({
  x: i * 3.1 + hash(i, 1) * 2,
  top: 10 + hash(i, 2) * 6,
  base: 21,
  half: 1.8 + hash(i, 3) * 1.4,
  tiers: 3,
}))

const NEAR_PINES: Pine[] = [
  { x: 3, top: -7, base: 20, half: 8.5, tiers: 4.5 },
  { x: 11, top: 2, base: 20, half: 5, tiers: 3.5 },
  { x: 61, top: -8, base: 20, half: 9, tiers: 4.5 },
  { x: 53, top: 3, base: 20, half: 4.6, tiers: 3.5 },
]

const SKY_LINE = 21

const FOREST: Uint8Array = (() => {
  const m = new Uint8Array(W * H)
  for (let y = 0; y <= SKY_LINE + 3; y++) {
    for (let x = 0; x < W; x++) {
      if (y <= SKY_LINE && FAR_PINES.some(p => inPine(p, x, y))) m[y * W + x] = 1
      NEAR_PINES.forEach((p, i) => {
        const isTrunk = y > p.base - 1 && (x === p.x || (p.half > 6 && x === p.x - 1))
        if (inPine(p, x, y)) m[y * W + x] = 2 + i
        else if (isTrunk) m[y * W + x] = 8 + i
      })
    }
  }
  return m
})()

const forestAt = (x: number, y: number) => (x < 0 || x >= W || y < 0 || y >= H ? 0 : FOREST[y * W + x] ?? 0)

const PX = 32
const PY = 16.5
const RX = 15.5
const RY = 6

const outer = (x: number, y: number) => inEllipse(x, y, PX, PY, RX, RY)
const inner = (x: number, y: number) => inEllipse(x, y, PX, PY, RX - 1.3, RY - 1.1)
const floor = (x: number, y: number) => inner(x, y) && inEllipse(x, y, PX, PY + 1.6, RX - 2.6, RY - 1.8)
const wall = (x: number, y: number) => !outer(x, y) && y > PY && inEllipse(x, y, PX, PY + 3, RX - 0.8, RY)

type Tongue = { x: number; half: number; height: number; cycles: number; phase: number; front: boolean; right: boolean }
const TONGUES: Tongue[] = [
  { x: 14.5, half: 2, height: 9, cycles: 5, phase: 0, front: false, right: false },
  { x: 17, half: 1.4, height: 6, cycles: 7, phase: 0.3, front: false, right: false },
  { x: 12, half: 1.2, height: 5, cycles: 8, phase: 0.6, front: false, right: false },
  { x: 49.5, half: 2, height: 9.5, cycles: 6, phase: 0.2, front: false, right: true },
  { x: 47, half: 1.4, height: 6, cycles: 7, phase: 0.8, front: false, right: true },
  { x: 52, half: 1.2, height: 5, cycles: 9, phase: 0.45, front: false, right: true },
  { x: 25, half: 1.3, height: 4, cycles: 6, phase: 0.1, front: true, right: false },
  { x: 32, half: 1.5, height: 4.5, cycles: 5, phase: 0.55, front: true, right: false },
  { x: 39, half: 1.3, height: 4, cycles: 7, phase: 0.9, front: true, right: true },
]
const FIRE_BASE = 27

function flame(f: number, x: number, y: number, isFront: boolean): number {
  let t = 0
  for (const g of TONGUES) {
    if (isFront !== g.front) continue
    const isMain = g.right && g.half > 1.8
    const boost = isMain ? 1 + 1.1 * flare(f) : g.right ? 1 + 0.4 * flare(f) : 1 + 0.2 * flare(f)
    const h = g.height * boost * (0.8 + 0.2 * wave(f, LOOP, g.cycles, g.phase))
    const v = (FIRE_BASE + 0.5 - y) / h
    if (v < 0 || v > 1) continue
    const c = g.x + wave(f, LOOP, g.cycles + 2, g.phase + v * 0.35) * 1.2 * v * v
    const half = g.half * (isMain ? 1 + 0.7 * flare(f) : 1) * Math.min(1, 0.55 + v * 2.4) * (1 - v) ** 0.8
    const d = Math.abs(x - c) / Math.max(0.35, half)
    if (d > 1) continue
    t = Math.max(t, (1 - d * d) * (1 - v ** 1.3))
  }
  return t
}

const RASHER = { x: 39, y: 19.5, length: 10 }

function rasherPose(f: number) {
  const tremble = f >= 16 && f <= 19 && f % 2 === 0 ? 0.6 : 0
  const curl = f < 20 ? 3 * ease.inOut(clamp((f - 10) / 7)) + tremble : f < 31 ? 3 * (1 - ease.out((f - 20) / 6)) : 0
  const t = clamp((f - 20) / 11)
  const isFlying = f > 20 && f < 31
  const lift = isFlying ? 44 * t * (1 - t) : 0
  const theta = isFlying ? Math.PI * t : 0
  const stretch = f === 31 || f === 32 ? 1.6 : 0
  return { curl, lift, theta, stretch, isFlying }
}

function drawRasher(c: Canvas, cx: number, cy: number, length: number, theta: number, curl: number, under: number, isBack = false): void {
  const half = length / 2
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  for (let s = -half; s <= half + 0.01; s += 0.25) {
    const k = s / half
    const curlUp = curl * Math.max(0, -k - 0.3) ** 2 / 0.49
    const ripple = Math.cos(s * 1.3)
    const x = cx + s * cos
    const y = cy - s * sin - curlUp + ripple * 0.55 * Math.abs(cos)
    const end = Math.abs(k) > 0.92 ? -0.8 : 0
    const back = isBack ? -0.8 : 0
    for (const w of [-1, -0.5, 1, 0.5, 0]) {
      const px = Math.round(x + w * sin)
      const py = Math.round(y + w * cos)
      const isFat = w === 0
      const level = isFat ? 3 + under * 0.5 : w < 0 ? 3.2 : 2 + under
      c.set(px, py, shade(isFat ? FAT : LEAN, level + end + back, px, py))
    }
  }
}
const SPRAY: [number, number, number][] = [[20, 5, 0.8], [31, 9, 1.6]]

function drawSpray(c: Canvas, f: number): void {
  for (const [start, count, spread] of SPRAY) {
    const dt = f - start
    if (dt < 0 || dt > 7) continue
    for (let k = 0; k < count; k++) {
      const isDrip = start === 31 && k === count - 1
      const vx = isDrip ? 2.2 : (k / (count - 1) - 0.5) * 2 * spread + (hash(k, start) - 0.5) * 0.5
      const vy = isDrip ? -1.6 : -1.3 - hash(k, start, 2) * 1.2
      const x = RASHER.x + (isDrip ? 5 : (k / (count - 1) - 0.5) * 9) + vx * dt
      const y = RASHER.y - 1 + vy * dt + 0.34 * dt * dt
      if (!isDrip && y > RASHER.y) continue
      if (isDrip && y > FIRE_BASE - 1) continue
      c.set(x, y, shade(FAT, 4.4 - dt * 0.3, 0, 0))
    }
  }
}
function render(): Int32Array[] {
  const out: Int32Array[] = []

  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const p = power(f)
    const lit = (x: number, y: number) => lightOf(p, x, y)
    const fl = flare(f)
    for (let y = 0; y <= SKY_LINE; y++) {
      for (let x = 0; x < W; x++) {
        const glow = lit(x, y) ** 1.5 * 3.2
        c.set(x, y, shade(SKY, y * 0.21 + glow, x, y))
        if (hash(x, y, 31) < 0.016 && y < 15 && forestAt(x, y) === 0) {
          const b = hash(x, y, 32)
          const tw = wave(f, LOOP, 1 + Math.floor(b * 3), hash(x, y, 33))
          const level = b * b * 2.6 + (b > 0.7 ? tw * 0.7 : 0) - glow * 0.5
          if (level > 0.3) c.set(x, y, shade(STAR, level, x, y))
        }
      }
    }
    for (let y = 0; y <= SKY_LINE + 3; y++) {
      for (let x = 0; x < W; x++) {
        const m = forestAt(x, y)
        if (m === 0) continue
        const l = lightOf(p, x, y, 80)
        if (m === 1) {
          c.set(x, y, shade(FAR, 0.5 + l * 1.4 + (forestAt(x, y - 1) === 0 ? 0.5 : 0), x, y))
          continue
        }
        const pine = NEAR_PINES[(m - 2) % 6]
        if (!pine) continue
        const toward = pine.x < FIRE_X ? 1 : -1
        const isEdge = forestAt(x + toward, y) < 2
        if (m >= 8) {
          c.set(x, y, shade(TREE, 0.8 + l * (1.4 + (isEdge ? 6 : 0)), x, y))
          continue
        }
        const u = clamp(((x - pine.x) * toward) / Math.max(1, halfAt(pine, y)), -1, 1)
        const band = u > 0.5 ? 1 : u > 0 ? 0.5 : 0
        const low = smoothstep(-4, 20, y)
        c.set(x, y, shade(TREE, 0.4 + l * (1.2 + band * 13 * low), x, y))
      }
    }
    for (let y = SKY_LINE + 1; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (forestAt(x, y) === 3) continue
        const l = lit(x, y)
        c.set(x, y, shade(GROUND, 0.4 + l * 5 - (y === SKY_LINE + 1 ? 0.5 : 0), x, y))
      }
    }
    for (let i = 0; i < 16; i++) {
      const gx = Math.floor(hash(i, 40) * W)
      const gy = SKY_LINE + 2 + Math.floor(hash(i, 41) * 9)
      if (Math.abs(gx - FIRE_X) < 21 && gy > 23) continue
      const l = lit(gx, gy)
      if (i % 2 === 1) continue
      c.set(gx, gy, shade(TREE, 1 + l * 5, gx, gy))
      c.set(gx, gy - 1, shade(TREE, 1.6 + l * 7, gx, gy))
      c.set(gx + 1, gy, shade(TREE, 0.8 + l * 4, gx, gy))
    }
    const stones: { x: number; y: number; rx: number; ry: number; isFront: boolean }[] = []
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2 + 0.12
      stones.push({
        x: FIRE_X + Math.cos(a) * 19,
        y: 27 + Math.sin(a) * 4,
        rx: 2.2 + hash(k, 50) * 0.8,
        ry: 1.3 + hash(k, 51) * 0.4,
        isFront: Math.sin(a) > 0,
      })
    }
    const drawStones = (isFront: boolean) => {
      for (const s of stones) {
        if (s.isFront !== isFront) continue
        c.ellipse(s.x, s.y, s.rx, s.ry, (x, y) => {
          const l = lit(x, y)
          const top = y < s.y - 0.3 ? 1.4 : y > s.y + 0.6 ? -0.8 : 0
          const inward = (x - s.x) * (FIRE_X - s.x) > 0 ? 1 : 0
          return shade(ROCK, 1 + l * 2.6 + top * (0.4 + l) + inward * l * 1.5, x, y)
        })
      }
    }
    drawStones(false)
    for (let y = 23; y < H; y++) {
      for (let x = 12; x < 53; x++) {
        if (!inEllipse(x, y, FIRE_X, 27, 17, 3.4)) continue
        const heat = 1 - Math.hypot((x - FIRE_X) / 17, (y - 25.5) / 4.5)
        const v = heat * 1.3 + (loopNoise(x * 0.22, y * 0.5, f / LOOP, 2, 5) - 0.5) * 0.9 + fl * 0.25
        if (v < 0.3) c.set(x, y, shade(ROCK, 1.2 + v * 4, x, y))
        else c.set(x, y, shade(FIRE, 1.5 + v * 4.2, x, y))
      }
    }
    for (let y = 8; y <= FIRE_BASE; y++) {
      for (let x = 6; x < 58; x++) {
        const t = flame(f, x, y, false)
        if (t > 0.04) c.set(x, y, shade(FIRE, 2 + Math.round(t * 3.4) * 1.8, x, y))
      }
    }
    for (let y = 9; y < 27; y++) {
      for (let x = 14; x < 50; x++) {
        const l = lit(x, y)
        const side = smoothstep(9, 15, Math.abs(x - PX))
        if (wall(x, y)) {
          const low = smoothstep(22, 25.5, y)
          c.set(x, y, shade(IRON, 1 + l * 1.2 + low * 3.6 * p + side * 2.2, x, y))
        } else if (outer(x, y) && !inner(x, y)) {
          if (y < PY) c.set(x, y, shade(COOL, 2.4 + (x > PX ? 0.9 : 0) - side * 0.6, x, y))
          else c.set(x, y, shade(IRON, 3.4 + l * 1.6 + side * 2.6, x, y))
        } else if (floor(x, y)) {
          const sheen = y === 15 && x >= 33 && x <= 37 ? 1 : 0
          c.set(x, y, shade(IRON, 1.2 + side * 1.4 + sheen, x, y))
        } else if (inner(x, y)) {
          c.set(x, y, shade(IRON, 2.6 + side * 1.6 + l, x, y))
        }
      }
    }
    drawRasher(c, 37.5, 15.5, 9, 0, 0, 0, true)

    const pose = rasherPose(f)
    for (const [ex, ey, seed] of [[24, 15.9, 3], [29, 19.3, 9]] as const) {
      const isWhite = (x: number, y: number) => {
        const a = Math.atan2((y - ey) / 2.5, (x - ex) / 4.7)
        const rr = 1 + 0.3 * (noise(Math.cos(a) * 1.4 + seed, Math.sin(a) * 1.4 + seed) - 0.5)
        return inEllipse(x, y, ex, ey, 4.7 * rr, 2.5 * rr)
      }
      for (let y = Math.floor(ey - 4); y <= ey + 4; y++) {
        for (let x = Math.floor(ex - 7); x <= ex + 7; x++) {
          if (!isWhite(x, y) || !floor(x, y)) continue
          const isEdge = !isWhite(x - 1, y) || !isWhite(x + 1, y) || !isWhite(x, y - 1) || !isWhite(x, y + 1)
          const lip = y > ey + 0.8 ? -0.5 : y < ey - 0.8 ? 0.6 : 0
          c.set(x, y, shade(EGG, isEdge ? 1.8 + lip : 3.7 + lip, x, y))
        }
      }
      const wobble = f === 31 ? 1 : f === 32 ? 2 : 0
      const yolk = wobble === 1 ? ['.....', '.hyy.', 'hyyyd', '.ddd.'] : wobble === 2 ? ['..h..', '.hyy.', '.yyd.', '.dd..'] : ['.....', '.hy..', 'hyyd.', '.dd..']
      c.sprite(Math.round(ex) - 2, Math.round(ey) - 3, yolk, { h: YOLK[5] ?? 0, y: YOLK[3] ?? 0, d: YOLK[1] ?? 0 })
    }
    if (!pose.isFlying) drawRasher(c, RASHER.x, RASHER.y, RASHER.length + pose.stretch, 0, pose.curl, 0)

    for (let x = 46; x <= 58; x++) {
      const y = Math.round(16.8 - (x - 46) * 0.22)
      const l = lit(x, y)
      const isHole = x === 56
      c.set(x, y, shade(COOL, isHole ? 0.5 : 2.2 + (x > 54 ? 0.8 : 0), x, y))
      c.set(x, y + 1, shade(IRON, isHole ? 0.6 : 2 + l * 4.6, x, y))
    }
    for (const [x0, y0, x1, y1] of [[5, 31, 20, 27], [59, 31, 44, 27]] as const) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
      for (let i = 0; i <= n; i++) {
        const x = Math.round(x0 + ((x1 - x0) * i) / n)
        const y = Math.round(y0 + ((y1 - y0) * i) / n)
        const l = lit(x, y)
        c.set(x, y - 1, shade(TREE, 1.6 + l * 5 + (i >= n - 2 ? 3 : 0), x, y))
        c.set(x, y, shade(ROCK, 1 + l * 1.6, x, y))
        if (i === 0) {
          c.set(x, y - 1, shade(ROCK, 4.4 + l * 2, x, y))
          c.set(x, y, shade(ROCK, 3.4 + l * 2, x, y))
        }
      }
    }
    drawStones(true)
    for (let y = 20; y <= FIRE_BASE; y++) {
      for (let x = 18; x < 46; x++) {
        const t = flame(f, x, y, true)
        if (t > 0.3) c.set(x, y, shade(FIRE, 2 + Math.round(t * 3.4) * 1.8, x, y))
      }
    }
    for (const [sx, phase] of [[23, 0], [41, 0.5]] as const) {
      for (let k = 0; k < 7; k++) {
        const rise = fract(f / 24 + phase + k / 7)
        const y = Math.round(14 - rise * 9)
        const x = Math.round(sx + Math.sin(rise * 6 + phase * 4) * 1.3)
        const a = Math.sin(Math.PI * rise)
        if (a > 0.3 && (k & 1) === 0) c.set(x, y, shade(STEAM, a * 3, x, y))
      }
    }
    for (const e of particles(f, LOOP, 14, 24, 11)) {
      const [r0, r1, r2, r3] = e.r
      const bx = r0 < 0.5 ? 11 + r1 * 7 : 46 + r1 * 7
      const x = bx + Math.sin(e.t * 0.3 + r2 * 6) * 1.4 + e.t * (r3 - 0.4) * 0.15
      const y = FIRE_BASE - 8 - e.t * (0.65 + r2 * 0.45)
      c.set(x, y, shade(FIRE, 7.4 - e.age * 5.5, x, y))
    }
    if (f >= 34) {
      for (let k = 0; k < 10; k++) {
        const t = f - 34 - (k % 3)
        if (t < 0 || t > 10) continue
        const x = 49 + (hash(k, 60) - 0.5) * (4 + t * 1.2) + Math.sin(t * 0.35 + k) * 1.2
        const y = 20 - t * (0.9 + hash(k, 61) * 0.9)
        c.set(x, y, shade(FIRE, 8 - t * 0.6, x, y))
      }
    }
    for (const s of particles(f, LOOP, 16, 5, 23)) {
      const [r0, r1, r2] = s.r
      const x0 = 20 + r0 * 24
      const y0 = 15 + r1 * 5
      const x = x0 + (r2 - 0.5) * 1.6 * s.t
      const y = y0 - (1.3 + r2 * 0.8) * s.t + 0.4 * s.t * s.t
      if (y > y0 || s.t === 0) continue
      c.set(x, y, shade(FAT, 4.4 - s.t * 0.4, 0, 0))
    }
    drawSpray(c, f)
    if (pose.isFlying) drawRasher(c, RASHER.x, RASHER.y - pose.lift, RASHER.length, pose.theta, pose.curl, 1)

    out.push(c.px)
  }

  return out
}

export const scene: Scene = {
  verb: 'Cooking',
  render,
  hero: 24,
  snaps: [
    { frames: [21, 22], box: [33, 10, 45, 21], colors: [...LEAN, ...FAT], why: 'The rasher leaps out of the pan at 4 px a frame.' },
    { frames: [29, 30], box: [33, 10, 45, 21], colors: [...LEAN, ...FAT], why: 'It slaps back down at 4 px a frame.' },
    { frames: 34, box: [48, 17, 51, 20], colors: [0xfffbe0, 0xfbecd4], why: 'The drop of fat spits white as it hits the coals and the fire flares.' },
  ],
}