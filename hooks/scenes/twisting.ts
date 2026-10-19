import { Canvas, TAU, beat, clamp, frames, hex, lerp, mod, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const SKY = hex('5a9ad8 6eaee4 86c2ec a2d4f2 c0e4f6')
const SEA = hex('0e3c6e 14508a 1c66a4 2a7cba 4c9ccc')
const CLOUD = hex('b8d4ec d8e8f4 f4f8fc')
const RED = hex('3e0814 640e1c 8e1624 ba2230 dc3a36 f2664c fca486 fff0e4')
const SKIN = hex('5a2e22 8a4a34 b86e4c d9946a efb88c fad8b4')
const SLEEVE = hex('0e2238 163654 204e72 2e6890 4486ac')
const CUFF = hex('9aa6b4 d6dce4 f6f8fa')
const STRIPE = { blue: hex('0f2a5e 17408a 2056b0 2f6cc8'), white: hex('8a96a8 b8c2d0 e0e6ee f8fafc') }
const WOOD = hex('3e2414 5e3820 84522e a8703e c89458 e2b47a')
const BUNCH = [hex('6a4a08 a07a10 d8ae20 f4d84a fdf0a0'), hex('063c3c 0c5e5c 14847e 2eb0a2 7ad8c8'), hex('2a1450 42227a 6036a4 8456c8 b08ae4')]

const DOG: readonly [number, number][] = [
  [-10, -11], [-7, -10.5], [-6.5, -14.5], [-5, -10.5], [-5, -5.5], [-6.5, 0],
  [-4, -5.5], [4, -5.5], [5, 0], [5.6, -5.5], [8.6, -9.6],
]
const BEHIND = new Set([2, 5, 8])
const GROUP = [0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 2]
const P = [21, 34, 47] as const
const FOLD = P.map(p => p + 6)
const FOLD_LEN = 9
const PINCH = [-1, ...P.flatMap(p => [p, p + 2, p + 4]), -1]
const RISE = 17
const LOW = 20
const TILT = 0.17
const HOPS: readonly (readonly [number, number, number, number])[] = [
  [68, 6, 0, 3], [76, 5, 0, 2.5], [83, 7, 14, 3.5], [92, 14, 40, 5],
]
const sine = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t))
const STRAIGHT: readonly [number, number][] = (() => {
  const lens = DOG.slice(1).map(([x, y], i) => Math.hypot(x - (DOG[i]?.[0] ?? 0), y - (DOG[i]?.[1] ?? 0)))
  const total = lens.reduce((a, b) => a + b, 0)
  let run = 0
  return DOG.map((_, i) => {
    if (i > 0) run += lens[i - 1] ?? 0
    return [-20 + (run / total) * 40, -10] as [number, number]
  })
})()
const R = 1.9
const FIST = [
  '.abbba.',
  'abbbbbt',
  'bcbcbct',
  'bcbcbcb',
  'cbbbbbc',
  '.dcccd.',
]
const FIST_ROLLED = [
  '..abba.',
  '.abbbba',
  'abababb',
  'bbbbbbc',
  'cccccbc',
  '.ddddd.',
]
const FIST_PAINT = { a: SKIN[5] ?? 0, t: SKIN[4] ?? 0, b: SKIN[3] ?? 0, c: SKIN[2] ?? 0, d: SKIN[1] ?? 0 }
const LIGHT = [-0.45, -0.62, 0.64] as const
function stance(f: number): { x: number; y: number; sx: number; sy: number; wag: number } {
  if (f < 60) return { x: 32, y: 22 + LOW * (1 - sine(f / RISE)), sx: 1, sy: 1, wag: 0 }

  let x = 32
  let y = 22 + 3 * sine(beat(f, 60, 65))
  let sy = f === 65 ? 0.94 : f === 66 ? 0.98 : 1
  for (const [h, [start, n, dist, height]] of HOPS.entries()) {
    if (f < start) break
    const k = f - start
    const a = (k - 1.5) / n
    if (a >= 1) {
      x += dist
      continue
    }
    if (k < 2) sy = h === 0 ? [0.94, 0.88][k] ?? 1 : [0.88, 0.93][k] ?? 1
    else {
      x += dist * a
      y -= height * 4 * a * (1 - a)
      sy = a < 0.25 ? lerp(0.95, 1.05, a / 0.25) : 1 + 0.05 * Math.max(0, 1 - (a - 0.25) / 0.35)
    }
  }
  const sx = 1 + (1 - sy) * 0.6
  const wag = 1.3 * sine(beat(f, 63, 69)) * (1 - sine(beat(f, 81, 86))) * Math.sin((TAU * f) / 6)
  return { x, y, sx, sy, wag }
}
function joints(f: number): { pts: [number, number][]; pinch: number[] } {
  const s = stance(f)
  const pts = DOG.map(([dx, dy], i) => {
    const [sx, sy] = STRAIGHT[i] ?? [0, 0]
    const start = FOLD[GROUP[i] ?? 0] ?? 0
    const fold = sine(beat(f, start, start + FOLD_LEN))
    let x = lerp(sx, dx, fold)
    let y = lerp(sy, dy, fold)
    if (i === DOG.length - 1) x += s.wag
    const sag = (1 - fold) * Math.sin(((x + 20) / 40) * Math.PI) * (f < 60 ? 0.8 : 0)
    y += sag + (f < 60 ? x * TILT * (1 - sine(f / (RISE + 2))) : 0)
    return [s.x + x * s.sx, s.y + y * s.sy] as [number, number]
  })
  const pinch = PINCH.map(p => (p < 0 ? 0 : clamp((f - p) / 2)))
  return { pts, pinch }
}
type Pt = [number, number]
const mid = (a: readonly [number, number] | undefined, b: readonly [number, number] | undefined, t = 0.5): Pt =>
  [lerp(a?.[0] ?? 0, b?.[0] ?? 0, t), lerp(a?.[1] ?? 0, b?.[1] ?? 0, t)]
const along = (pts: readonly Pt[], u: number): Pt => {
  const i = clamp(Math.floor(u), 0, pts.length - 2)
  return mid(pts[i], pts[i + 1], u - i)
}

function hands(f: number): { left: Pt; right: Pt; twisting: boolean } {
  const { pts } = joints(f)
  const at = (i: number): Pt => pts[i] ?? [0, 0]
  const on = (u: number) => along(pts, u)
  const blend = (a: Pt, b: Pt, t0: number, t1: number): Pt => mid(a, b, sine(beat(f, t0, t1)))
  const [p0, p1, p2] = P
  const twisting = P.some(p => f >= p - 1 && f <= p + 5)

  const left = f < (FOLD[0] ?? 0) ? blend(on(1.5), on(0.5), p0 - 8, p0 - 3)
    : f < p2 - 5 ? blend(on(0.5), at(3), (FOLD[0] ?? 0) - 1, (FOLD[0] ?? 0) + FOLD_LEN + 1)
    : blend(at(3), mid(at(4), at(6)), p2 - 5, p2 - 1)
  const glide = (p: number, j: number) => on(j + 0.5 + clamp((f - p) / 2, 0, 2) * 0.85 + (f > p + 4 ? 0.05 : 0))
  const right = f <= p0 ? on(lerp(8.5, 1.5, sine(beat(f, 0, p0 - 2))))
    : f < p1 - 2 ? glide(p0, 1)
    : f < p1 ? blend(glide(p0, 1), on(4.5), p1 - 2, p1)
    : f <= p1 + 4 ? glide(p1, 4)
    : f < p2 ? blend(glide(p1, 4), on(7.5), p1 + 4, p2)
    : blend(glide(p2, 7), mid(at(7), at(9)), p2 + 8, p2 + 15)
  if (f < 64) return { left, right, twisting }
  const k = beat(f, 64, 72) ** 2
  return { left: [left[0] - 4 * k, left[1] + 26 * k], right: [right[0] + 4 * k, right[1] + 26 * k], twisting: false }
}
function drawBalloon(c: Canvas, f: number, shift = 0): void {
  const speed = f >= 60 && shift === 0 ? stance(f).x - stance(f - 1).x : 0
  if (Math.abs(speed) > 0.3) drawBalloon(c, f, -speed / 2)
  const pts = joints(f).pts.map(([x, y]) => [x + shift, y] as [number, number])
  const { pinch } = joints(f)
  const bump = (t: number) => Math.max(0, 1 - t * 2.6) ** 2
  const order = [...Array(pts.length - 1).keys()].sort((a, b) => Number(BEHIND.has(b)) - Number(BEHIND.has(a)))
  for (const i of order) {
    const a = pts[i]
    const b = pts[i + 1]
    if (!a || !b) continue
    const pa = pinch[i] ?? 0
    const pb = pinch[i + 1] ?? 0
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len2 = dx * dx + dy * dy || 1
    const isBack = BEHIND.has(i)
    for (let y = Math.floor(Math.min(a[1], b[1]) - R - 1); y <= Math.ceil(Math.max(a[1], b[1]) + R + 1); y++) {
      for (let x = Math.floor(Math.min(a[0], b[0]) - R - 1); x <= Math.ceil(Math.max(a[0], b[0]) + R + 1); x++) {
        const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / len2)
        const qx = a[0] + dx * t
        const qy = a[1] + dy * t
        const r = R * (1 - 0.55 * pa * bump(t) - 0.55 * pb * bump(1 - t))
        const d = Math.hypot(x - qx, y - qy)
        if (d > r) continue
        const nx = (x - qx) / R
        const ny = (y - qy) / R
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
        const lit = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2])
        const gloss = lit > 0.94 && shift === 0 ? 1.6 : 0
        c.set(x, y, shade(RED, 1.4 + lit * 4.4 + gloss - (isBack ? 1.3 : 0)))
      }
    }
  }
  const tip = pts[pts.length - 1]
  const prev = pts[pts.length - 2]
  if (tip && prev) {
    const len = Math.hypot(tip[0] - prev[0], tip[1] - prev[1]) || 1
    c.set(tip[0] + ((tip[0] - prev[0]) / len) * 2.4, tip[1] + ((tip[1] - prev[1]) / len) * 2.4, RED[2] ?? 0)
  }
}
function drawArm(c: Canvas, from: [number, number], hand: [number, number], side: number, twist: boolean, f: number): void {
  const [hx, hy] = hand
  const dx = hx - from[0]
  const dy = hy - from[1]
  const len = Math.hypot(dx, dy) || 1
  for (let k = 0; k <= len - 3; k += 0.5) {
    const x = from[0] + (dx / len) * k
    const y = from[1] + (dy / len) * k
    const isCuff = k > len - 5.5
    for (let oy = -2; oy <= 2; oy++) {
      for (let ox = -2; ox <= 2; ox++) {
        if (ox * ox + oy * oy > 4.5) continue
        const lit = -oy * 0.5 - ox * 0.3 * side
        c.set(x + ox, y + oy, isCuff ? shade(CUFF, 1 + lit) : shade(SLEEVE, 2 + lit * 1.4))
      }
    }
  }
  const art = twist && f % 2 === 0 ? FIST_ROLLED : FIST
  c.sprite(Math.round(hx) - 3, Math.round(hy) - 3, art, FIST_PAINT, side > 0)
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    for (let y = 0; y < 18; y++) {
      for (let x = 0; x < W; x++) c.set(x, y, shade(SKY, 0.6 + y * 0.22))
    }
    const drift = (f / LOOP) * 32
    for (const [cx0, cy, rw] of [[14, 9, 5], [30, 12, 4]] as const) {
      for (let rep = -1; rep <= 2; rep++) {
        const cx = mod(cx0 - drift, 32) + rep * 32
        for (let y = cy - 3; y <= cy + 1; y++) {
          for (let x = Math.floor(cx - rw - 2); x <= cx + rw + 2; x++) {
            const lumps = Math.hypot((x - cx) / rw, (y - cy) / 1.6) < 1 || Math.hypot((x - cx + rw * 0.4) / (rw * 0.55), (y - cy + 1.6) / 1.6) < 1 || Math.hypot((x - cx - rw * 0.3) / (rw * 0.45), (y - cy + 1) / 1.4) < 1
            if (!lumps || y > cy + 1) continue
            c.set(Math.round(x), y, shade(CLOUD, y >= cy + 1 ? 0 : y <= cy - 2 ? 2 : 1))
          }
        }
      }
    }
    for (let y = 18; y < 26; y++) {
      for (let x = 0; x < W; x++) {
        const band = y === 18 ? 0 : 1.2 + (y - 18) * 0.4
        const glint = (x * 7 + y * 13) % 23 === 0 && Math.sin(f * 0.5 + x) > 0.6
        c.set(x, y, shade(SEA, band + (glint ? 2.5 : 0)))
      }
    }
    for (const [k, [bx, by, phase]] of ([[55, 8, 0], [60, 11, 0.33], [53, 14, 0.66]] as const).entries()) {
      const sway = Math.round(Math.sin(TAU * (f / LOOP * 2 + phase)) * 1.2)
      const cx = bx + sway
      const ramp = BUNCH[k] ?? RED
      c.line(cx, by + 4, 57, 26, 0x5a6a7a)
      for (let y = by - 4; y <= by + 4; y++) {
        for (let x = cx - 3; x <= cx + 3; x++) {
          const nx = (x - cx) / 3.2
          const ny = (y - by) / 3.9
          const d2 = nx * nx + ny * ny
          if (d2 > 1) continue
          const nz = Math.sqrt(1 - d2)
          const lit = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2])
          c.set(x, y, shade(ramp, 0.6 + lit * 3 + (lit > 0.95 ? 1 : 0)))
        }
      }
      c.set(cx, by + 4, ramp[1] ?? 0)
    }
    for (let y = 0; y <= 4; y++) {
      for (let x = 0; x < W; x++) {
        const isBlue = Math.floor(x / 4) % 2 === 0
        const k = x % 4
        if (y === 4 && (k === 0 || k === 3)) continue
        const level = y === 0 ? 1 : y === 4 ? 1.4 : 2.4 - (y === 3 ? 0.6 : 0)
        c.set(x, y, shade(isBlue ? STRIPE.blue : STRIPE.white, level))
      }
    }
    const { left, right, twisting } = hands(f)
    drawBalloon(c, f)
    drawArm(c, [left[0] - 9, left[1] + 16], left, -1, false, f)
    drawArm(c, [right[0] + 9, right[1] + 16], right, 1, twisting, f)
    if (stance(f + LOOP).x - 14 < W) drawBalloon(c, f + LOOP)
    if (twisting) {
      const [x, y] = right
      const marks = f % 2 === 0 ? [[2, -4, 3, -5], [4, -2, 5, -2], [0, -5, 0, -6]] : [[3, -4, 4, -5], [4, -1, 5, -1], [1, -5, 1, -6]]
      for (const [ax, ay, bx, by] of marks) c.line(x + (ax ?? 0), y + (ay ?? 0), x + (bx ?? 0), y + (by ?? 0), 0xfffbe8)
    }
    for (let x = 0; x < W; x++) {
      c.set(x, 26, shade(WOOD, 4.4))
      c.set(x, 27, shade(WOOD, 2))
      for (let y = 28; y < H; y++) {
        const isBlue = Math.floor((x + 2) / 4) % 2 === 0
        c.set(x, y, shade(isBlue ? STRIPE.blue : STRIPE.white, y === 28 ? 0.6 : 1.4))
      }
    }

    for (const g of [f, f + LOOP]) {
      const s = stance(g)
      const half = g < 60 ? 5.4 * sine(beat(g, 5, RISE)) : Math.max(0, 9 - (25 - s.y) * 1.2) * s.sx
      if (half > 0.5) for (let x = Math.round(s.x - half); x <= Math.round(s.x + half); x++) c.set(x, 26, shade(WOOD, 2.6))
      if (g < 60) continue
      const { pts } = joints(g)
      for (const i of [5, 8]) {
        const p = pts[i]
        if (p && p[1] >= 24.5) c.set(p[0], 26, shade(WOOD, 1.6))
      }
    }
  })
}
export const scene: Scene = {
  verb: 'Twisting',
  render,
  hero: 73,
  snaps: [
    { frames: 7, box: [19, 22, 32, 25], why: 'the balloon comes up from behind the counter, uncovered by its edge' },
  ],
}