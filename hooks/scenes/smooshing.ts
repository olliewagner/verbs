import { Canvas, beat, clamp, ease, frames, hex, lerp, mod, particles, shade, type Scene, type Snap } from '../engine'

const W = 64
const LOOP = 72

const WALL = hex('0a1027 0f1838 15224d 1c2e63 263c79 344d8c')
const GLOW = hex('344d8c 4f5a92 6e6a94 8f7c92')
const WALNUT = hex('140c0c 21130f 321c14 45271a 5a3421 714328 8c5733')
const STEEL = hex('0e0d12 1b1a21 2a2832 3e3b47 595462 7f7787 a69fac cfc8cf eeeaea')
const IRON = hex('07070a 111015 1c1a21 2a2730 3c3842')
const BREAD = hex('3d1c0c 5e2e12 85461c ae6628 cf8a3c e6ae5c f3cf86 f9e6b8')
const CHEESE = hex('a65a0c d68a16 f2b82a fcdb5c fff0a0')
const TOMATO = hex('5a0e12 9a1c1c d23a2a')
const BASIL = hex('1c3c1a 2f6a2a 4f9a3c')
const STEAM = hex('3c4c80 6a76a6 a3abcc d6dbea f4f6fb')
const COPPER = hex('2a0f0c 4a1d14 6f2e1a 96441f bd5e2a db8040 eda766 f7cf98')
const WOOD = hex('2b1712 4a2a1c 6e4128 925a34')

const Y0 = 31
const K = 0.5
const sy = (h: number, d: number) => Y0 - h - d * K
const X0 = 8
const X1 = 56
const PLATE = 4
const LID_L = 11
const LID_T = 3
const TALL = 7
const FLAT = 3.5

const rows = (a: number, b: number): [number, number] => [Math.round(Math.min(a, b)), Math.round(Math.max(a, b)) - 1]

const REAR = 5
const SLAM = 10
const HIT = 14
const LIFT = 32
const OPEN = 46
const REACH = 49
const ARRIVE = 53
const SCOOP = 54
const WHISK = 57
const GONE = 62
const DROP = 64
const LAND = 67

const sine = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t))

function lidAngle(f: number): number {
  if (f < REAR) return 60
  if (f < SLAM) return lerp(60, 70, sine(beat(f, REAR, SLAM)))
  if (f < HIT) return [70, 68.5, 59, 27][f - SLAM] ?? 0
  if (f < LIFT) return 0
  if (f < OPEN) return 60 * sine(beat(f, LIFT, OPEN))
  return 60
}

const isOld = (f: number) => f >= HIT && f < DROP
const SETTLE = [5, 6, 8]

function height(f: number): number {
  if (f >= HIT && f < HIT + 5) {
    const p = beat(f, HIT, HIT + 5)
    return lerp(TALL, FLAT, ease.out(p)) - Math.sin(p * Math.PI) * 0.6
  }
  if (isOld(f)) return FLAT
  if (f >= DROP && f < LAND) return STRETCH[f - DROP] ?? TALL
  return SETTLE[mod(f - LAND, LOOP)] ?? TALL
}

const WHISKED = [1, 3, 7, 15, 30]
const FALL = [-26, -18, -9]
const STRETCH = [8, 9, 9]

function offset(f: number): { x: number; y: number } {
  if (f >= SCOOP && f < GONE) return { x: f < WHISK ? 0 : WHISKED[f - WHISK] ?? 0, y: -1 }
  if (f >= DROP && f < LAND) return { x: 0, y: FALL[f - DROP] ?? 0 }
  return { x: 0, y: 0 }
}

function hinge(f: number): number {
  if (f >= HIT && f < LIFT) return PLATE + height(f)
  if (f >= LIFT && f < OPEN) return lerp(PLATE + FLAT, PLATE + TALL, sine(beat(f, LIFT, OPEN)))
  return PLATE + TALL
}
const toastOf = (f: number) => (isOld(f) ? sine(beat(f, HIT + 6, LIFT)) : 0)

function drawRoom(c: Canvas): void {
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < W; x++) {
      const glow = clamp(1 - Math.hypot(x - 11, (y - 4) * 1.3) / 16)
      const level = 4 - y * 0.06 - x * 0.012
      c.set(x, y, glow > 0.15 ? shade(GLOW, glow * 4.4, x, y) : shade(WALL, level, x, y))
    }
  }
  for (let y = 0; y < 1; y++) c.set(11, y, COPPER[1] ?? 0)
  c.sprite(7, 0, ['..abba..', '.abcdda.', 'abccddea'], { a: COPPER[2] ?? 0, b: COPPER[3] ?? 0, c: COPPER[4] ?? 0, d: COPPER[5] ?? 0, e: COPPER[3] ?? 0 })
  c.sprite(9, 3, ['abba'], { a: 0xf6d89a, b: 0xfff6dc })

  for (let y = 15; y < 32; y++) {
    for (let x = 0; x < W; x++) {
      const isSeam = y === 20 || y === 26 || (y > 20 && y < 26 && (x + 7) % 29 === 0) || (y > 26 && (x + 18) % 31 === 0)
      const grain = Math.sin(x * 0.21 + y * 2.7) > 0.86 ? 0.7 : 0
      const lip = x >= X0 && x <= X1 ? 5.2 - Math.abs(x - 12) * 0.03 : 6
      const level = y === 15 ? lip : 4.2 + (y - 15) * 0.07 - Math.abs(x - 12) * 0.035 - grain - (isSeam ? 1.4 : 0)
      c.set(x, y, shade(WALNUT, level, x, y))
    }
  }
  for (let y = 21; y < 32; y++) {
    for (let x = X1 + 1; x <= X1 + 3 + Math.floor((y - 21) / 3); x++) c.set(x, y, shade(WALNUT, 1, x, y))
  }
  for (let x = X0; x <= X1 + 1; x++) c.set(x, 31, WALNUT[0] ?? 0)
}

function drawBase(c: Canvas, f: number): void {
  const [p0, p1] = rows(sy(PLATE, 12), sy(PLATE, 0))
  for (let y = p0; y <= p1; y++) {
    for (let x = X0; x <= X1; x++) {
      const isRim = x === X0 || x === X1 || y === p0 || y === p1
      const ridge = (x - X0) % 3
      const level = isRim ? 4.6 - (x - X0) * 0.03 + (y === p1 ? 1 : 0) : ridge === 0 ? 3.6 : ridge === 1 ? 1.2 : 2.2
      c.set(x, y, isRim ? shade(STEEL, level, x, y) : shade(IRON, level, x, y))
    }
  }
  const [b0, b1] = rows(sy(PLATE, 0), sy(0, 0))
  for (let y = b0; y <= b1; y++) {
    for (let x = X0; x <= X1; x++) {
      const streak = (x * 2 + y * 3) % 23 < 2 ? 0.8 : 0
      const level = 4.6 - (x - X0) * 0.035 - (y - b0) * 0.45 + streak - (x === X1 ? 1 : 0)
      c.set(x, y, shade(STEEL, level, x, y))
    }
  }
  c.sprite(11, b0 + 1, ['ab', 'bc'], { a: STEEL[2] ?? 0, b: STEEL[1] ?? 0, c: STEEL[0] ?? 0 })
  c.set(12, b0 + 1, STEEL[6] ?? 0)
  const isHeating = f >= HIT && f < LIFT + 4
  const lamp = isHeating ? [0xff9a3a, 0xffd59a] : [0x3cc46a, 0xa8f0b8]
  c.set(51, b0 + 1, lamp[0] ?? 0)
  c.set(52, b0 + 1, lamp[1] ?? 0)
  for (const [dx, dy] of [[-1, 0], [2, 0], [0, -1], [1, -1], [0, 1], [1, 1]] as const) c.tint(51 + dx, b0 + 1 + dy, lamp[0] ?? 0, 0.3)
  for (const fx of [X0 + 2, X0 + 3, X1 - 3, X1 - 2]) c.set(fx, 31, STEEL[0] ?? 0)
}

function lidAt(angle: number, h: number): { a: number; b: number; A: number; front: number; bar: number } {
  const t = (angle * Math.PI) / 180
  const a = Math.sin(t) - K * Math.cos(t)
  const b = Math.cos(t) + K * Math.sin(t)
  const A = sy(h, 12)
  return { a, b, A, front: A - LID_L * a, bar: A - (LID_L + 2.2) * a - 1.5 * b }
}

function drawLid(c: Canvas, angle: number, h: number): void {
  const { a, b, A, front, bar } = lidAt(angle, h)
  if (a > 0) {
    const [u0, u1] = rows(front, A)
    for (let y = u0; y <= u1; y++) {
      for (let x = X0; x <= X1; x++) {
        const isRim = x === X0 || x === X1 || y === u0
        const ridge = (x - X0) % 3
        const depth = (y - u0) / Math.max(1, u1 - u0)
        const level = isRim ? 3.4 - depth : (ridge === 0 ? 3.6 : ridge === 1 ? 1 : 2) - depth * 0.8
        c.set(x, y, isRim ? shade(STEEL, level, x, y) : shade(IRON, level, x, y))
      }
    }
  } else {
    const [t0, t1] = rows(A - LID_T * b, front - LID_T * b)
    for (let y = t0; y <= t1; y++) {
      for (let x = X0; x <= X1; x++) {
        const streak = Math.abs(((x - (y - t0 + 15) * 2) % 24) - 12) < 1.5 ? 1.2 : 0
        const level = 6.2 - (x - X0) * 0.05 - (y === t0 ? 0.8 : 0) + streak - (x === X1 ? 1.2 : 0)
        c.set(x, y, shade(STEEL, level, x, y))
      }
    }
  }
  const [e0, e1] = rows(front - LID_T * b, front)
  for (let y = e0; y <= e1; y++) {
    for (let x = X0; x <= X1; x++) {
      const level = (y === e0 ? 5 : 3.6) - (x - X0) * 0.03 - (x === X1 ? 1 : 0)
      c.set(x, y, shade(STEEL, level, x, y))
    }
  }
  const mid = front - 1.5 * b
  for (const ax of [15, 49]) {
    const [m0, m1] = rows(Math.min(bar, mid), Math.max(bar, mid) + 1)
    for (let y = m0; y <= m1; y++) c.set(ax, y, STEEL[2] ?? 0)
  }
  const top = Math.round(bar - 0.5)
  for (let x = 13; x <= 51; x++) {
    c.set(x, top, x < 30 ? IRON[4] ?? 0 : IRON[3] ?? 0)
    c.set(x, top + 1, IRON[1] ?? 0)
  }
  c.set(13, top, IRON[2] ?? 0)
  c.set(51, top + 1, IRON[0] ?? 0)
}

function drawSlamSmear(c: Canvas, f: number): void {
  if (f !== HIT - 1) return
  const was = lidAt(lidAngle(f - 1), hinge(f - 1))
  const now = lidAt(lidAngle(f), hinge(f))
  const from = rows(was.front - LID_T * was.b, was.front)[0]
  const end = rows(now.front - LID_T * now.b, now.front)[0] - 1
  for (let y = from; y <= end; y++) {
    const isNear = y - from >= (end - from) / 2
    for (let x = X0; x <= X1; x++) {
      const isRidge = (x - X0) % 3 === 0
      c.set(x, y, (isRidge ? (isNear ? IRON[4] : STEEL[3]) : isNear ? IRON[2] : WALL[2]) ?? 0)
    }
  }
}

type Layer = 'crust' | 'bread' | 'cheese' | 'tomato' | 'mash'

function layers(n: number): Layer[] {
  if (n >= 7) return ['crust', 'bread', 'cheese', 'tomato', ...Array<Layer>(n - 5).fill('bread'), 'crust']
  if (n === 6) return ['crust', 'bread', 'cheese', 'tomato', 'bread', 'crust']
  if (n === 5) return ['crust', 'cheese', 'tomato', 'bread', 'crust']
  if (n === 4) return ['crust', 'cheese', 'mash', 'crust']
  return ['crust', 'cheese', 'crust']
}

const DRIPS: [number, number, number][] = [[20, 15, 3], [27, 18, 1], [31, 16, 4], [40, 17, 2], [45, 15, 3]]

function drawSandwich(c: Canvas, f: number): void {
  if (f >= GONE && f < DROP) return
  const o = offset(f)
  const h = height(f)
  const toast = toastOf(f)
  const isGrilled = toast > 0.99
  const squashed = isOld(f)
  const spread = h > TALL + 0.5 ? -1 : squashed || h < TALL - 0.6 ? 1 : 0
  const x0 = 17 - spread + o.x
  const x1 = 47 + spread + o.x
  const top = PLATE + h
  const [t0, t1] = rows(sy(top, 10) + o.y, sy(top, 1) + o.y)
  const [f0, f1] = rows(sy(top, 1) + o.y, sy(PLATE, 1) + o.y)

  for (let y = t0; y <= t1; y++) {
    for (let x = x0; x <= x1; x++) {
      const isCorner = (x === x0 || x === x1) && (y === t0 || y === t1)
      if (isCorner) continue
      const lit = 0.6 - (x - x0) / (x1 - x0) * 0.9 + (y === t0 ? -0.6 : 0)
      const u = x - o.x - X0
      let level = lerp(6.3, 4.6, toast) + lit
      if (isGrilled && u % 3 === 0) level = 1.6 + (y === t0 ? -0.5 : 0)
      if (isGrilled && u % 3 === 1) level -= 0.8
      c.set(x, y, shade(BREAD, level, x, y))
    }
  }
  const stack = layers(f1 - f0 + 1)
  for (let y = f0; y <= f1; y++) {
    const layer = stack[f1 - y] ?? 'bread'
    for (let x = x0; x <= x1; x++) {
      const end = x === x0 || x === x1
      if (end && (y === f0 || y === f1)) continue
      const lit = 0.4 - (x - x0) / (x1 - x0) * 0.8
      let color: number
      if (layer === 'cheese') color = shade(CHEESE, (squashed ? 3.4 : 2.8) + lit, x, y)
      else if (layer === 'tomato') color = ((x - o.x) * 5) % 9 < 2 ? shade(BASIL, 1.4 + lit, x, y) : shade(TOMATO, 1.6 + lit, x, y)
      else if (layer === 'mash') {
        const u = mod(x - o.x, 9)
        const isFleck = toast < 0.05 + 0.9 * (mod((x - o.x) * 7, 17) / 17)
        if (isFleck && u === 1) color = shade(BASIL, 1 + lit, x, y)
        else if (isFleck && (u === 3 || u === 7)) color = shade(TOMATO, 1 + lit, x, y)
        else color = shade(BREAD, lerp(5.6, 4.4, toast) + lit, x, y)
      } else if (layer === 'crust') color = shade(BREAD, lerp(4.4, 3.4, toast) + lit - (y === f1 ? 0.8 : 0), x, y)
      else color = shade(BREAD, lerp(5.6, 4.4, toast) + lit, x, y)
      c.set(x, y, color)
    }
  }
  if (!squashed) return

  const cheeseRow = f1 - 1
  const ooze = ease.out(beat(f, HIT, HIT + 6))
  for (const [ex, dir] of [[x0, -1], [x1, 1]] as const) {
    for (let k = 1; k <= Math.round(ooze * 2); k++) c.set(ex + dir * k, cheeseRow, shade(CHEESE, 3.6 - k * 0.6, ex, cheeseRow))
    const fall = Math.round(ease.out(beat(f, HIT + 3, HIT + 18)) * 3)
    for (let k = 1; k <= fall; k++) c.set(ex + dir, cheeseRow + k, shade(CHEESE, k === fall ? 2 : 3, ex, cheeseRow + k))
  }
  for (const [dx, start, length] of DRIPS) {
    const n = Math.round(ease.out(beat(f, start, start + 12)) * length)
    for (let k = 1; k <= n; k++) {
      c.set(dx + o.x, cheeseRow + k, shade(CHEESE, k === n ? 2.4 : 3.6, dx, cheeseRow + k))
      if (k === n && n === length) c.set(dx + o.x + 1, cheeseRow + k, shade(CHEESE, 1.6, dx, cheeseRow + k))
    }
  }
}

function drawSandwichSmear(c: Canvas, f: number): void {
  if (f < WHISK || f >= GONE) return
  const now = offset(f).x
  const was = offset(f - 1).x
  if (now - was < 4) return
  const y = Math.round(sy(PLATE, 1)) - 1 + offset(f).y
  for (const [dy, ramp, level, lag] of [[-4, BREAD, 5, 2], [-1, CHEESE, 3, 0], [-6, BREAD, 4, 4]] as const) {
    const x0 = 16 + was + lag
    for (let x = x0; x < 16 + now; x++) c.set(x, y + dy, shade(ramp, level - (x - x0 < (now - was) / 3 ? 1 : 0), x, y + dy))
  }
}

const STRINGS: [number, number][] = [[40, 39], [23, 40], [31, 41]]

function drawStrings(c: Canvas, f: number): void {
  if (f <= LIFT || f >= OPEN) return
  const top = Math.round(lidAt(lidAngle(f), hinge(f)).front)
  const bottom = Math.round(sy(PLATE + FLAT, 1))
  const length = bottom - top
  for (const [sx, snap] of STRINGS) {
    const k = f - snap
    if (k < 0) {
      for (let y = top; y < bottom; y++) c.set(sx, y, shade(CHEESE, 3.2, sx, y))
      continue
    }
    const half = (length - 2) / 2
    const up = Math.round(half * ([1, 0.5, 0.2][k] ?? 0))
    const down = Math.round(half * ([1, 0.4, 0.15][k] ?? 0))
    for (let y = top; y < top + up; y++) c.set(sx, y, shade(CHEESE, y === top + up - 1 ? 2.4 : 3.2, sx, y))
    for (let y = bottom - down; y < bottom; y++) c.set(sx, y, shade(CHEESE, y === bottom - down ? 2.4 : 3.2, sx, y))
  }
}

const spatulaX = (f: number) => (f < ARRIVE ? Math.round(lerp(66, 30, ease.out(beat(f, REACH, ARRIVE)))) : 30 + offset(f).x)

function drawSpatula(c: Canvas, f: number): void {
  if (f <= REACH || f >= GONE) return
  const bx = spatulaX(f)
  const y = Math.round(sy(PLATE, 1)) - (f >= SCOOP ? 1 : 0)
  const was = spatulaX(f - 1)
  const s0 = Math.min(bx, was)
  const s1 = Math.max(bx, was) + 20
  if (Math.abs(bx - was) > 3) for (let x = s0; x <= s1; x++) c.set(x, y, STEEL[4] ?? 0)
  for (let x = bx; x <= bx + 20; x++) {
    c.set(x, y, STEEL[x === bx ? 5 : 6] ?? 0)
    c.set(x, y + 1, STEEL[3] ?? 0)
  }
  for (let k = 0; k < 14; k++) {
    const hx = bx + 21 + k
    const hy = y - Math.floor(k / 2)
    c.set(hx, hy, WOOD[k < 3 ? 1 : 3] ?? 0)
    c.set(hx, hy + 1, WOOD[k < 3 ? 0 : 1] ?? 0)
  }
}

function drawSteam(c: Canvas, f: number): void {
  for (const p of particles(f, LOOP, 40, 14, 11)) {
    const born = (f - p.t + LOOP) % LOOP
    const isSeam = born >= HIT + 1 && born < LIFT - 2
    const isToast = born >= OPEN - 2 && born < OPEN + 7
    if (!isSeam && !isToast) continue
    let x: number
    let y: number
    if (isSeam && p.r[2] < 0.45) {
      const side = p.r[1] < 0.5 ? -1 : 1
      const push = born < HIT + 5 ? 9 : 3
      x = (side < 0 ? X0 - 1 : X1 + 1) + side * ease.out(p.age) * push
      y = sy(PLATE + FLAT, 1) - 1 - p.age * 9
    } else if (isSeam) {
      x = 14 + p.r[2] * 36
      y = sy(PLATE + FLAT + LID_T, 1) - 1 - p.age * 11
    } else {
      x = 20 + p.r[2] * 26
      y = sy(PLATE + FLAT, 6) - p.age * 13
    }
    x += Math.sin(p.age * 5 + p.r[3] * 6) * 1.2
    const r = p.age < 0.6 ? 0.5 + p.age * 2 : 1.7 - (p.age - 0.6) * 3
    const level = 4.2 - p.age * 2.2
    const px = Math.round(x)
    const py = Math.round(y)
    if (r < 0.8) c.set(px, py, shade(STEAM, level, px, py))
    else if (r < 1.3) c.rect(px, py, 2, 2, shade(STEAM, level, px, py))
    else {
      c.rect(px - 1, py, 3, 2, shade(STEAM, level, px, py))
      c.rect(px, py - 1, 2, 1, shade(STEAM, level + 0.6, px, py))
    }
  }
}

function puff(c: Canvas, x: number, y: number, size: number, level: number): void {
  const w = [1, 2, 3, 4][size] ?? 1
  const h = [1, 2, 3, 3][size] ?? 1
  const x0 = x - Math.floor((w - 1) / 2)
  const y0 = y - Math.floor((h - 1) / 2)
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const isCorner = w > 2 && h > 2 && (i === 0 || i === w - 1) && (j === 0 || j === h - 1)
      if (!isCorner) c.set(x0 + i, y0 + j, shade(STEAM, level + (j === 0 && h > 1 ? 0.5 : j === h - 1 && h > 2 ? -0.6 : 0), x0 + i, y0 + j))
    }
  }
}

function drawBurst(c: Canvas, f: number): void {
  const t = f - HIT
  if (t < 0 || t > 9) return
  const y0 = sy(PLATE + FLAT, 1) - 1
  for (const side of [-1, 1]) {
    const ex = side < 0 ? X0 - 1 : X1 + 1
    for (let k = 2; k >= 0; k--) {
      const p = clamp((t - k * 0.8) / 7)
      if (p <= 0 || p >= 1) continue
      const x = Math.round(ex + side * (1 + ease.out(p) * (5 + k * 2)))
      const y = Math.round(y0 - k - ease.out(p) * (2 + k * 1.5))
      const size = p < 0.12 ? 0 : p < 0.28 ? 1 : p < 0.45 ? 2 : p < 0.7 ? 3 : p < 0.85 ? 2 : 1
      puff(c, x, y, size, 4.3 - p * 2.4)
    }
  }
}

const snaps: Snap[] = [
  { frames: [HIT - 1, HIT], box: [X0, 4, X1, 22], why: 'the lid slams shut on the sandwich: a smear frame, then the bite' },
  { frames: [REACH + 1, ARRIVE - 1], box: [30, 19, 63, 28], why: 'the spatula darts in from the right' },
  { frames: [WHISK + 3, GONE], box: [16, 16, 63, 29], why: 'the spatula whisks the sandwich off to the right' },
  { frames: [DROP, LAND + 2], box: [16, 0, 48, 26], why: 'a new sandwich drops in, lands squashed and springs back' },
  { frames: [DROP, DROP + 2], box: [X0, 0, X1, 13], why: 'the falling sandwich passes in front of the open lid and the lamp\'s halo, hiding them' },
]

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    drawRoom(c)
    drawBase(c, f)
    const angle = lidAngle(f)
    const isOpen = angle > 26.6
    if (isOpen) drawLid(c, angle, hinge(f))
    drawSlamSmear(c, f)
    drawSandwichSmear(c, f)
    drawSandwich(c, f)
    if (!isOpen) drawLid(c, angle, hinge(f))
    drawStrings(c, f)
    drawSteam(c, f)
    drawBurst(c, f)
    drawSpatula(c, f)
  })
}

export const scene: Scene = { verb: 'Smooshing', render, hero: 48, snaps }
