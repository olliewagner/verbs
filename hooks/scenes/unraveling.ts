import { Canvas, TAU, beat, clamp, ease, frames, hex, lerp, mod, shade, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 84
const G = 26
const FLOOR_TOP = 18

const WALL = hex('2c3a33 3b4c42 4c6052 55695a 607660 7a8e74')
const TRIM = hex('6f6a62 8f897d b2ab9b d4cdbb ece6d4')
const FLOOR = hex('2e1a12 4a2a18 6b3f20 8e5a2c b07a3c cf9c54 ecc47a fde6a8')
const FUR = hex('1a1824 2a2836 3d3c50 56576e 727690 9498ae b9bccb dcdde4')
const CREAM = hex('6e5a52 a08878 cdb8a2 eadcc6 fbf3e4')
const YARN = hex('3a0c1a 64142a 921e30 bf2f36 e04a3c f2764e fbab7a')
const WICKER = hex('3a2414 5a3820 7c5230 a07040 c49456 e0b874')
const TEAL = hex('0e3438 18545a 24767a 3a9a96 64c0b4')
const CURTAIN = hex('4a1e22 6e2c2c 94403a b85a46 d47c5a')
const OUTSIDE = hex('2f5a2a 3f7a34 5a9a40 8cc070 cfe6d8 eef6ee')
const INK = 0x16121c
const PINK = 0xe48c90

type P = readonly [number, number]
type Pose = {
  bx: number; by: number; rx: number; ry: number; hx: number; hy: number
  fp: P; fp2: P; bp: P; bp2: P
  ta: number; tc: number; tl: number
  puff: number; ears: number
  eyes: number
  curl: number; spin: number
}

const crouch = (bx: number, low = 0): Pose => ({
  bx, by: G - 3 + low * 0.6, rx: 5, ry: 2.4 - low * 0.3, hx: bx + 5.5, hy: G - 4.6 + low, fp: [bx + 5, G], fp2: [bx + 3.5, G], bp: [bx - 3, G], bp2: [bx - 4.5, G],
  ta: 0.2, tc: 0.06, tl: 7, puff: 0, ears: 0, eyes: 0, curl: 0, spin: 0,
})
const leap = (bx: number, lift = 0): Pose => ({
  bx, by: G - 6 - lift, rx: 5.6, ry: 2.3, hx: bx + 6.5, hy: G - 7.6 - lift, fp: [bx + 9, G - 5 - lift], fp2: [bx + 8, G - 4 - lift], bp: [bx - 7, G - 4 - lift], bp2: [bx - 8, G - 5 - lift],
  ta: 0.1, tc: 0, tl: 8, puff: 0, ears: 0.3, eyes: 0, curl: 0, spin: 0,
})
const strike = (bx: number): Pose => ({
  bx, by: G - 3.4, rx: 5, ry: 2.6, hx: bx + 5, hy: G - 5.6, fp: [bx + 8, G - 2], fp2: [bx + 4, G], bp: [bx - 3, G], bp2: [bx - 4.5, G],
  ta: 0.7, tc: 0.15, tl: 7, puff: 0, ears: 0, eyes: 0, curl: 0, spin: 0,
})
const gather = (bx: number): Pose => ({
  bx, by: G - 4, rx: 4.4, ry: 2.5, hx: bx + 5, hy: G - 6.6, fp: [bx + 1, G], fp2: [bx + 2, G - 1], bp: [bx, G], bp2: [bx - 1, G - 1],
  ta: 0.8, tc: 0.12, tl: 7, puff: 0, ears: 0, eyes: 0, curl: 0, spin: 0,
})
const reach = (bx: number): Pose => ({
  bx, by: G - 5, rx: 5.8, ry: 2.2, hx: bx + 6.5, hy: G - 7, fp: [bx + 7, G - 1], fp2: [bx + 6, G], bp: [bx - 6, G - 1], bp2: [bx - 7, G],
  ta: 0.45, tc: 0.08, tl: 8, puff: 0, ears: 0, eyes: 0, curl: 0, spin: 0,
})
const ball = (bx: number, spin: number): Pose => ({ ...crouch(bx), by: G - 3.6, curl: 1, spin })
const sit = (bx: number): Pose => ({
  bx, by: G - 4.2, rx: 3.9, ry: 4.2, hx: bx + 1.6, hy: G - 10.2, fp: [bx + 2.5, G], fp2: [bx + 1.5, G], bp: [bx - 1, G], bp2: [bx - 2, G],
  ta: -0.25, tc: -0.12, tl: 6, puff: 0, ears: 0, eyes: 0, curl: 0, spin: 0,
})
const startle = (bx: number, lift: number): Pose => ({
  bx, by: G - 6 - lift, rx: 4.2, ry: 3.4, hx: bx + 4.2, hy: G - 8.5 - lift, fp: [bx + 3, G - lift], fp2: [bx + 2, G - lift], bp: [bx - 3, G - lift], bp2: [bx - 2, G - lift],
  ta: 1.45, tc: 0, tl: 7, puff: 1, ears: 1, eyes: -1, curl: 0, spin: 0,
})
const land = (bx: number): Pose => ({
  bx, by: G - 2.6, rx: 5.8, ry: 2, hx: bx + 5.4, hy: G - 4.2, fp: [bx + 6, G], fp2: [bx + 4.5, G], bp: [bx - 5, G], bp2: [bx - 6, G],
  ta: 0.9, tc: 0, tl: 7, puff: 0.6, ears: 0.6, eyes: -1, curl: 0, spin: 0,
})

const KEYS: [number, Pose, 'through'?][] = [
  [0, crouch(15)],
  [8, crouch(15)],
  [10, crouch(15, 1)],
  [12, leap(17.5), 'through'],
  [14, leap(19.5), 'through'],
  [16, strike(20)],
  [18, gather(23)],
  [20, reach(27)],
  [22, gather(31)],
  [24, leap(34, 2)],
  [26, ball(38, 0)],
  [30, ball(39, Math.PI)],
  [34, ball(39, TAU)],
  [37, sit(39)],
  [57, sit(39)],
  [60, { ...sit(39), ears: 0.7, eyes: -1, by: G - 4.4 }],
  [62, startle(37, 4)],
  [64, startle(33, 8), 'through'],
  [66, startle(28, 10), 'through'],
  [68, startle(23, 9), 'through'],
  [70, startle(19, 5), 'through'],
  [72, land(15), 'through'],
  [76, { ...startle(15, 0), by: G - 5, hy: G - 7.8, ta: 1.1 }],
  [80, { ...crouch(15), ears: 0.2 }],
  [LOOP, crouch(15)],
]

function poseAt(f: number): Pose {
  let i = 0
  while (i < KEYS.length - 2 && (KEYS[i + 1]?.[0] ?? 0) <= f) i++
  const [f0, a] = KEYS[i] ?? KEYS[0]!
  const [f1, b] = KEYS[i + 1] ?? KEYS[0]!
  const u = beat(f, f0, f1)
  const isIn = KEYS[i]?.[2] === 'through'
  const isOut = KEYS[i + 1]?.[2] === 'through'
  const t = isIn && isOut ? u : isOut ? u * u : isIn ? 1 - (1 - u) ** 2 : ease.inOut(u)
  const p = (u: P, v: P): P => [lerp(u[0], v[0], t), lerp(u[1], v[1], t)]
  const curl = b.curl !== a.curl ? (t < 0.5 ? a.curl : b.curl) : a.curl
  return {
    bx: lerp(a.bx, b.bx, t), by: lerp(a.by, b.by, t), rx: lerp(a.rx, b.rx, t), ry: lerp(a.ry, b.ry, t),
    hx: lerp(a.hx, b.hx, t), hy: lerp(a.hy, b.hy, t), fp: p(a.fp, b.fp), fp2: p(a.fp2, b.fp2), bp: p(a.bp, b.bp), bp2: p(a.bp2, b.bp2),
    ta: lerp(a.ta, b.ta, t), tc: lerp(a.tc, b.tc, t), tl: lerp(a.tl, b.tl, t), puff: lerp(a.puff, b.puff, t), ears: lerp(a.ears, b.ears, t),
    eyes: t < 0.5 ? a.eyes : b.eyes, curl, spin: lerp(a.spin, b.spin, t),
  }
}

const wrapAt = (f: number) => (f < 26 ? 0 : f < 37 ? beat(f, 26, 36) : f < 61 ? 1 : 1 - beat(f, 61, 64))

function ballX(f: number): number {
  if (f < 16) return 30
  if (f < 30) return lerp(30, 48, ease.out(beat(f, 16, 30)))
  if (f < 33) return 48 - Math.sin(beat(f, 30, 33) * Math.PI) * 1
  if (f < 61) return 48
  if (f < 69) return lerp(48, 30, beat(f, 61, 69))
  return 30 + Math.round(Math.sin((f - 69) * 1.3) * Math.max(0, 1 - (f - 69) / 7) * 1.2)
}
const ballR = (x: number) => lerp(4, 3, clamp((x - 30) / 18))

function patchSpan(y: number): [number, number] {
  const t = (y - 19) / 12
  return [lerp(19, 31, t), lerp(34, 52, t)]
}
function inBeam(x: number, y: number): boolean {
  const [a, b] = patchSpan(G)
  const fx = x + (G - y) * 0.55
  return fx >= a && fx <= b && y <= G + 1
}
function floorLit(x: number, y: number): number {
  if (y < 19) return 0
  const [a, b] = patchSpan(y)
  if (x < a || x > b) return 0
  const u = (x - a) / (b - a)
  const isBar = Math.abs(u - 0.5) < 0.05 || Math.abs(y - 25) < 0.5
  return isBar ? 0 : 1
}

function drawKitten(c: Canvas, k: Pose, f: number, wrap: number): void {
  const lit = (x: number, y: number) => (inBeam(x, y) ? 1.5 : 0)
  const furAt = (level: number, x: number, y: number) => shade(FUR, level + lit(x, y), x, y)

  if (k.curl > 0.5) {
    const cx = k.bx
    const cy = k.by
    const r = 3.7
    for (let y = Math.floor(cy - r) - 1; y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r) - 1; x <= Math.ceil(cx + r) + 1; x++) {
        const dx = x - cx
        const dy = y - cy
        const d = Math.hypot(dx, dy)
        if (d > r + 0.4) continue
        if (d > r - 0.6) {
          c.set(x, y, furAt(dy > 0 ? 0.6 : 1.6, x, y))
          continue
        }
        const a = Math.atan2(dy, dx) - k.spin
        const isStripe = Math.sin(a * 3) > 0.55 && d > 1.2
        const isBelly = Math.cos(a - 1.2) > 0.75 && d > 1.6
        const level = 3.4 - dx * 0.25 - dy * 0.35 - (isStripe ? 1.3 : 0)
        c.set(x, y, isBelly ? shade(CREAM, 2.6 + lit(x, y) * 0.8, x, y) : furAt(level, x, y))
      }
    }
    for (const [da, len] of [[-1.9, 1.6], [-1.3, 1.6]] as const) {
      const a = da + k.spin
      c.line(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cx + Math.cos(a) * (r + len), cy + Math.sin(a) * (r + len), furAt(2.5, cx, cy))
    }
    for (const da of [0.6, 1.4]) {
      const a = da + k.spin
      c.set(cx + Math.cos(a) * (r + 0.6), cy + Math.sin(a) * (r + 0.6), CREAM[4] ?? 0)
    }
    for (let i = 0; i < 6; i++) {
      const a = k.spin + Math.PI + 0.3 + i * 0.35
      c.set(cx + Math.cos(a) * (r + 1), cy + Math.sin(a) * (r + 1), furAt(i > 4 ? 0.8 : 2.4, cx, cy))
    }
    return
  }

  const shoulder: P = [k.bx + k.rx * 0.55, k.by + k.ry * 0.35]
  const hip: P = [k.bx - k.rx * 0.55, k.by + k.ry * 0.35]
  c.line(shoulder[0] - 1, shoulder[1], k.fp2[0], k.fp2[1], furAt(1.2, k.fp2[0], k.fp2[1]))
  c.line(hip[0] - 1, hip[1], k.bp2[0], k.bp2[1], furAt(1.2, k.bp2[0], k.bp2[1]))
  const isSitting = k.ry > k.rx
  let tx = k.bx - k.rx + (isSitting ? 1.5 : 0.8)
  let ty = isSitting ? k.by + k.ry - 1 : k.by - k.ry * 0.3
  let ang = Math.PI + k.ta + Math.sin(f * 0.5) * 0.08
  for (let i = 0; i < k.tl; i++) {
    const nx = tx + Math.cos(ang) * 1
    const ny = ty - Math.sin(ang) * 1
    const isTip = i >= k.tl - 2
    const color = furAt(isTip ? 1.4 : 3 - (i % 3 === 1 ? 1.2 : 0), nx, ny)
    c.line(tx, ty, nx, ny, color)
    if (k.puff > 0.5 && i > 0) c.set(nx - 1, ny, furAt(2, nx, ny))
    tx = nx
    ty = ny
    ang -= k.tc + (i > k.tl - 4 ? Math.sin(f * 0.7) * 0.18 : 0)
  }
  const ry = k.ry + k.puff * 0.5
  for (let y = Math.floor(k.by - ry) - 1; y <= Math.ceil(k.by + ry) + 1; y++) {
    for (let x = Math.floor(k.bx - k.rx) - 1; x <= Math.ceil(k.bx + k.rx) + 1; x++) {
      const dx = (x - k.bx) / k.rx
      const dy = (y - k.by) / ry
      const d = dx * dx + dy * dy
      if (d > 1) continue
      const isEdge = d > 0.72 && dy > 0.2
      const isBelly = k.ry > k.rx ? dx > 0.25 && dy > -0.4 : dy > 0.5
      const isStripe = !isBelly && dy < 0.35 && mod(x - Math.round(k.bx) + Math.round(dy * 2), 3) === 0
      if (isBelly) c.set(x, y, shade(CREAM, 2.4 - dy + lit(x, y) * 0.7, x, y))
      else c.set(x, y, furAt(3.6 - dx * 0.8 - dy * 1.4 - (isStripe ? 1.4 : 0) - (isEdge ? 0.8 : 0), x, y))
    }
  }
  if (k.puff > 0.5) {
    for (let x = Math.round(k.bx - k.rx + 1); x < k.bx + k.rx - 1; x += 2) c.set(x, k.by - ry - 1, furAt(3, x, k.by - ry))
  }
  for (const [from, paw] of [[shoulder, k.fp], [hip, k.bp]] as const) {
    c.line(from[0], from[1], paw[0], paw[1] - 1, furAt(2.8, paw[0], paw[1]))
    c.set(paw[0], paw[1], shade(CREAM, 3 + lit(paw[0], paw[1]) * 0.6, 0, 0))
  }
  c.set(k.fp2[0], k.fp2[1], shade(CREAM, 1.8, 0, 0))
  const hx = k.hx
  const hy = k.hy
  for (const [ex, flip] of [[-1.7, -1], [1.9, 1]] as const) {
    const back = k.ears
    const tip: P = [hx + ex + flip * (0.3 + back * 1.8) - 0.3, hy - 5 + back * 2.4]
    const pts: P[] = [[hx + ex - 1.8, hy - 1.6], tip, [hx + ex + 1.8, hy - 1.6]]
    c.poly(pts, (x, y) => furAt(flip < 0 ? 3.8 : 2.6, x, y))
    if (back < 0.5) c.set(hx + ex - 0.3, hy - 3, PINK)
  }
  for (let y = Math.floor(hy - 4); y <= Math.ceil(hy + 4); y++) {
    for (let x = Math.floor(hx - 4); x <= Math.ceil(hx + 4); x++) {
      const dx = (x - hx) / 3.7
      const dy = (y - hy) / 3.1
      const d = dx * dx + dy * dy
      if (d > 1) continue
      const isMuzzle = dx > 0.25 && dy > 0.15
      const isStripe = dy < -0.4 && (x === Math.round(hx) || x === Math.round(hx) - 2)
      if (isMuzzle) c.set(x, y, shade(CREAM, 3 - dy + lit(x, y) * 0.6, x, y))
      else c.set(x, y, furAt(4 - dx * 0.9 - dy * 1.3 - (isStripe ? 1.3 : 0) - (d > 0.75 && dy > 0.3 ? 0.9 : 0), x, y))
    }
  }
  const ey = Math.round(hy - 0.2)
  for (const ex of [Math.round(hx) - 0, Math.round(hx) + 2]) {
    if (k.eyes > 0.5) c.set(ex, ey, FUR[1] ?? INK)
    else {
      c.set(ex, ey, INK)
      if (k.eyes < -0.5) c.set(ex, ey - 1, 0xf6f2e2)
    }
  }
  c.set(Math.round(hx) + 3, ey + 1, PINK)

  if (wrap > 0) {
    const inBody = (x: number, y: number) => ((x - k.bx) / (k.rx + 0.5)) ** 2 + ((y - k.by) / (ry + 0.5)) ** 2 <= 1
    const inHead = (x: number, y: number) => ((x - hx) / 3.9) ** 2 + ((y - hy) / 3.3) ** 2 <= 1
    const red = (inside: (x: number, y: number) => boolean, lift: number) => (x: number, y: number) =>
      inside(x, y) ? shade(YARN, 3 + lift - (x - k.bx) * 0.15 + lit(x, y) * 0.9, x, y) : undefined
    const loops: [number, number, number, number, (x: number, y: number) => boolean][] = [
      [k.bx - k.rx - 1, k.by + 1, k.bx + k.rx + 1, k.by - 2, inBody],
      [k.bx - k.rx - 1, k.by + 3, k.bx + k.rx + 1, k.by + 1, inBody],
      [hx - 3, hy + 3, hx, hy - 4, inHead],
    ]
    const n = Math.ceil(wrap * loops.length)
    for (const [i, [x0, y0, x1, y1, inside]] of loops.entries()) if (i < n) c.line(x0, y0, x1, y1, red(inside, i === 2 ? 0.6 : 0))
  }
}

function drawWrap(c: Canvas, k: Pose, wrap: number, f: number): void {
  if (wrap <= 0) return
  const red = (x: number, y: number) => shade(YARN, 3.2 + (inBeam(x, y) ? 1.4 : 0), x, y)
  if (k.curl > 0.5) {
    const n = Math.ceil(wrap * 3)
    for (let i = 0; i < n; i++) {
      const a = k.spin + i * 1.1
      const d = i === 1 ? -1.4 : 1.3
      const half = Math.sqrt(3.6 * 3.6 - d * d)
      const mx = k.bx + Math.cos(a) * d
      const my = k.by + Math.sin(a) * d
      c.line(mx - Math.sin(a) * half, my + Math.cos(a) * half, mx + Math.sin(a) * half, my - Math.cos(a) * half, red)
    }
    return
  }
  if (f >= 61 && f < 64) {
    for (let a = 0; a < 5; a += 0.25) {
      const ang = a + f * 1.9
      c.set(k.bx + Math.cos(ang) * (5 + a * 0.4), k.by + Math.sin(ang) * (4 + a * 0.3), red)
    }
  }
}

function drawBall(c: Canvas, x: number, f: number): void {
  const r = ballR(x)
  const cy = G - r + 0.5
  const theta = (x - 30) / r + (f >= 69 ? Math.sin((f - 69) * 1.3) * Math.max(0, 1 - (f - 69) / 7) * 0.5 : 0)
  for (let y = Math.floor(cy - r) - 1; y <= Math.ceil(cy + r); y++) {
    for (let px = Math.floor(x - r) - 1; px <= Math.ceil(x + r) + 1; px++) {
      const dx = px - x
      const dy = y - cy
      const d2 = (dx * dx + dy * dy) / (r * r)
      if (d2 > 1) continue
      const nz = Math.sqrt(1 - d2)
      const light = (-dx / r) * 0.5 + (-dy / r) * 0.6 + nz * 0.6
      const u = dx * Math.cos(theta) + dy * Math.sin(theta)
      const v = -dx * Math.sin(theta) + dy * Math.cos(theta)
      const groove = u > 0 ? mod(v + u * 0.5, 2) < 0.8 : mod(u - v * 0.4, 2) < 0.8
      const sun = inBeam(px, y) ? 1.3 : 0
      c.set(px, y, shade(YARN, 1.2 + light * 3 + sun - (groove ? 1 : 0) - (d2 > 0.8 ? 0.6 : 0), px, y))
    }
  }
}

const BOARDS = [18, 20, 22, 25, 28, 32]

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const k = poseAt(f)
    const wiggle = [0, 1, 1, 0, -1, -1][f - 3] ?? 0
    const kp: Pose = { ...k, bx: k.bx + wiggle * 0.5, bp: [k.bp[0] + wiggle, k.bp[1]], bp2: [k.bp2[0] + wiggle, k.bp2[1]] }
    const bx = ballX(f)
    const br = ballR(bx)
    const air = clamp((G - 3 - kp.by) / 8)
    const shadows: [number, number, number][] = [[bx, br, 1], [kp.bx, kp.curl > 0.5 ? 3.5 : kp.rx * 0.9, 1 - air * 0.8], [58, 6, 1]]
    const shadowAt = (x: number, y: number) => {
      if (y !== G && y !== G + 1) return 0
      let s = 0
      for (const [sx, w, k2] of shadows) {
        const reach = y === G ? w - 0.5 : w + 0.5
        if (Math.abs(x - sx) <= reach) s = Math.max(s, k2)
      }
      return s
    }

    c.fill((x, y) => {
      if (y < 16) return shade(WALL, 2.3 - (y < 3 ? 0.6 : 0) + (mod(x, 6) < 2 ? 0.45 : 0), x, y)
      if (y < FLOOR_TOP) return shade(TRIM, y === 16 ? 2.8 : 1.4, x, y)
      const row = BOARDS.findIndex(b => b > y) - 1
      const top = BOARDS[row] ?? FLOOR_TOP
      const isSeam = y === top
      const joint = mod(x + row * 13 + 5, 23 + row * 4)
      const isJoint = joint < 1
      const lit = floorLit(x, y)
      const level = 1.8 + row * 0.2 + (row % 2 ? 0.3 : 0) + lit * 2.8 - (isSeam || isJoint ? 0.8 - lit * 0.3 : 0) - shadowAt(x, y) * 1.2
      return shade(FLOOR, level, x, y)
    })

    for (let y = 1; y <= 12; y++) {
      for (let x = 6; x <= 21; x++) {
        const isFrame = x === 6 || x === 21 || y === 1 || y === 12 || x === 13 || x === 14 || y === 6
        if (isFrame) {
          c.set(x, y, shade(TRIM, x === 14 || x === 21 || y === 12 ? 2.4 : 4, x, y))
          continue
        }
        const tree = Math.sin(x * 0.9) + Math.sin(x * 0.37 + y * 0.5) + (y - 4) * 0.55
        const leaf = tree > 1.2 ? (tree > 2.2 ? 1 : 2) : -1
        c.set(x, y, leaf >= 0 ? shade(OUTSIDE, leaf, x, y) : shade(OUTSIDE, y < 4 ? 5 : 4, x, y))
      }
    }
    for (let x = 4; x <= 23; x++) {
      c.set(x, 13, shade(TRIM, 4, x, 13))
      c.set(x, 14, shade(TRIM, 1.4, x, 14))
    }
    for (const [cx0, side] of [[2, -1], [22, 1]] as const) {
      for (let y = 0; y <= 15; y++) {
        const sway = Math.round(wave(f, LOOP, 2, side * 0.2) * (y / 15) * 1.4)
        for (let i = 0; i < 4; i++) {
          const x = cx0 + i + sway
          const fold = i % 2 === 0 ? 0.9 : 0
          c.set(x, y, shade(CURTAIN, 1.6 + fold + (side < 0 ? 0.4 : 0) - (y === 15 ? 0.6 : 0), x, y))
        }
      }
    }
    for (let x = 1; x <= 26; x++) c.set(x, 0, shade(TRIM, 1.2, x, 0))

    for (let y = 2; y <= 9; y++) {
      for (let x = 44; x <= 53; x++) {
        const isFrame = x === 44 || x === 53 || y === 2 || y === 9
        const hill = y > 6 - Math.sin(x * 0.7) * 0.8
        const sun = Math.hypot(x - 50, y - 4.5) < 1.3
        const color = isFrame ? shade(WICKER, x === 53 || y === 9 ? 1 : 2.4, x, y) : sun ? 0xe2b04a : hill ? shade(TEAL, y > 7 ? 1.6 : 2.6, x, y) : 0xe6dcc0
        c.set(x, y, color)
      }
    }

    for (let i = 0; i < 4; i++) {
      const t = mod(f / LOOP + i / 4, 1)
      const mx = Math.round(lerp(16 + i * 3, 34 + i * 3, t) + Math.sin(t * TAU * 2 + i) * 1.5)
      const my = Math.round(lerp(4, 17, t))
      if (Math.sin(t * Math.PI) > 0.3) c.set(mx, my, 0xe8dcb0)
    }

    const bonk = f >= 30 ? Math.sin((f - 30) * 1.4) * Math.max(0, 1 - (f - 30) / 10) : 0
    for (const [nx0, ny0, nx1, ny1] of [[56, 20, 53 + bonk * 1.5, 13], [58, 20, 61 + bonk * 2, 12]] as const) {
      c.line(nx0, ny0, nx1, ny1, shade(TRIM, 3.4, 0, 0))
      c.set(nx1, ny1, shade(YARN, 4, 0, 0))
    }
    c.disc(57, 20, 3, (x, y) => shade(TEAL, 2.4 - (x - 57) * 0.35 - (y - 20) * 0.4 + ((x + y) % 3 === 0 ? -0.8 : 0), x, y))
    for (let y = 20; y <= G; y++) {
      for (let x = 52 + (y > 24 ? 1 : 0); x <= 63; x++) {
        const isRim = y === 20 || y === 21
        const weave = ((Math.floor((x - 52) / 2) + (y % 2)) % 2) * 0.7
        c.set(x, y, shade(WICKER, isRim ? 3.4 - (y - 20) : 2 + weave - (x - 52) * 0.05 - (y === G ? 1 : 0), x, y))
      }
    }

    if (f >= 16) {
      const zipping = f >= 61
      const end: P = [bx - br * 0.7, G]
      const lay = (x0: number, y0: number, x1: number, y1: number) => {
        const n = Math.max(1, Math.ceil(Math.abs(x1 - x0)))
        let px = x0
        let py = y0
        for (let i = 1; i <= n; i++) {
          const t = i / n
          const x = lerp(x0, x1, t)
          const sag = zipping ? 0 : Math.sin(t * Math.PI) * (0.6 + Math.sin(x * 0.55) * 0.9)
          const y = lerp(y0, y1, t) + sag
          c.line(px, py, x, y, (lx, ly) => shade(YARN, 2.8 + floorLit(lx, ly) * 1.6, lx, ly))
          px = x
          py = y
        }
      }
      const wrap = wrapAt(f)
      if (wrap > 0 && !zipping) {
        lay(29, G + 1, kp.bx - 3, G)
        lay(kp.bx + 3, G, end[0], end[1])
      } else lay(29, G + 1, end[0], end[1])
    } else {
      c.line(26, G + 1, 24, G + 1, shade(YARN, 3, 0, 0))
    }

    drawBall(c, bx, f)
    drawKitten(c, kp, f, wrapAt(f))
    drawWrap(c, kp, wrapAt(f), f)
  })
}

const KITTEN = [...FUR, ...CREAM, 0x16121c, 0xe48c90]

export const scene: Scene = {
  verb: 'Unraveling',
  render,
  hero: 44,
  snaps: [
    { frames: 12, box: [17, 18, 26, 22], colors: KITTEN, why: 'The pounce: the forelegs fling out ahead in a frame.' },
    { frames: 20, box: [31, 16, 38, 25], colors: KITTEN, why: 'The gallop\'s reach: the forelegs swing forward in a frame.' },
    { frames: 24, box: [42, 16, 44, 20], colors: KITTEN, why: 'The dive: paws thrown out at the strand for a frame.' },
    { frames: 36, box: [35, 14, 44, 26], colors: [...KITTEN, ...YARN], why: 'Out of the tumble: it sits up in one move, wrapped in yarn.' },
    { frames: [61, 64], box: [28, 7, 45, 25], colors: [...KITTEN, ...YARN], why: 'The tug: the yarn rips off, whipping round the kitten as it springs back in fright.' },
    { frames: 68, box: [18, 7, 33, 17], colors: KITTEN, why: 'Mid-leap, its fur puffs and its tail whips.' },
  ],
}
