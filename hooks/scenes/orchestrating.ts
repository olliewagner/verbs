import { PALETTE, beat, clamp, ease, frames, hex, lerp, mod, shade, smoothstep, type Canvas, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const WALL = hex('0a0508 140a0e 1f0f12 2e1616 421f1a 5a2c1e 77401f 9a5a26')
const FLOOR = hex('0e0809 1c100d 2e1a12 44261a 5e3622 7c4a2c 9c6236 c08046 e0a660 f6cc88')
const SUIT = hex('040308 0a0912 141120 221d32 342c48 4a4062')
const SKIN = hex('2e1814 5a2e22 8c4c34 b87050 dc9c74 f4c8a0')
const CELLO = hex('1e0a06 3c160a 66280e 924016 bc6024 dc8a3e f2b066')
const BRASS = PALETTE.gold
const COPPER = PALETTE.copper
const BOW = hex('4a4038 7e7262 b4a88e e2d8bc fbf4e0')
const HAIR = hex('3a3848 5e5c72 8e8ca4 bcbacc e2e0ee fbfaff')
const VELVET = hex('0c0408 1a070c 2c0c12 44121a 5e1a20 7a2428')

const LIP = 24
const STRIKE = 50

function lights(f: number) {
  const fade = 1 - beat(f, 58, 70)
  const payoff = f >= STRIKE ? fade : 0
  const up = (from: number) => smoothstep(from, from + 10, f) + 0.15 * Math.sin(Math.PI * beat(f, from + 8, from + 16))
  const strings = Math.max(f < 32 ? up(6) * (1 - beat(f, 24, 32)) : 0, payoff)
  const brass = Math.max(f >= 24 && f < STRIKE ? up(24) * (1 - beat(f, 41, 49)) : 0, payoff)
  const timpani = Math.max(f < STRIKE ? 0.3 * ease.in(beat(f, 41, 49)) : 0, payoff)
  const flash = f >= STRIKE ? (1 - beat(f, STRIKE, STRIKE + 8)) ** 1.5 : 0
  return { strings, brass, timpani, flash }
}

type Pose = { rx: number; ry: number; angle: number; lx: number; ly: number; turn: number; nod: number }
const REST: Pose = { rx: 46, ry: 18, angle: -118, lx: 18, ly: 19, turn: 0, nod: 0 }
const KEYS: [number, Pose][] = [
  [0, REST],
  [4, { rx: 48, ry: 13, angle: -80, lx: 18, ly: 18, turn: 0, nod: 0 }],
  [10, { rx: 28, ry: 13, angle: -172, lx: 15, ly: 15, turn: -1, nod: 0 }],
  [22, { rx: 28, ry: 13, angle: -166, lx: 15, ly: 15, turn: -1, nod: 0 }],
  [28, { rx: 50, ry: 13, angle: -16, lx: 19, ly: 18, turn: 1, nod: 0 }],
  [40, { rx: 50, ry: 13, angle: -22, lx: 19, ly: 18, turn: 1, nod: 0 }],
  [47, { rx: 42, ry: 6, angle: -94, lx: 22, ly: 6, turn: 0, nod: -1 }],
  [STRIKE, { rx: 48, ry: 21, angle: -36, lx: 16, ly: 21, turn: 0, nod: 1 }],
  [56, { rx: 47, ry: 19, angle: -56, lx: 17, ly: 19, turn: 0, nod: 0 }],
  [61, { rx: 47, ry: 19, angle: -60, lx: 17, ly: 19, turn: 0, nod: 0 }],
  [LOOP, REST],
]

const BEAT: [number, number][] = [[1, 8], [1, 0], [0, -8], [0, 0]]
function rawPose(f: number): Pose {
  const g = mod(f, LOOP)
  let i = 0
  while (i < KEYS.length - 2 && (KEYS[i + 1]?.[0] ?? 0) <= g) i++
  const [f0, a] = KEYS[i] ?? [0, REST]
  const [f1, b] = KEYS[i + 1] ?? [LOOP, REST]
  const p = beat(g, f0, f1)
  const t = f1 === STRIKE ? p ** 4 : f0 === STRIKE ? ease.out(p) : smoothstep(0, 1, p)
  const tNod = f1 === STRIKE ? ease.in(p) : t
  const isHolding = (f0 === 10 && f1 === 22) || (f0 === 28 && f1 === 40)
  const [dy, down] = isHolding ? BEAT[Math.floor(g - f0) % 4] ?? [0, 0] : [0, 0]
  const angle = lerp(a.angle, b.angle, t)
  return {
    rx: lerp(a.rx, b.rx, t), ry: lerp(a.ry, b.ry, t) + dy, angle: angle + down * Math.sign(Math.cos((angle * Math.PI) / 180)),
    lx: lerp(a.lx, b.lx, t), ly: lerp(a.ly, b.ly, t) + dy, turn: lerp(a.turn, b.turn, t), nod: lerp(a.nod, b.nod, tNod),
  }
}
function poseAt(f: number): Pose {
  const p = rawPose(f)
  const r = Math.round
  return { rx: r(p.rx), ry: r(p.ry), angle: p.angle, lx: r(p.lx), ly: r(p.ly), turn: r(p.turn), nod: r(p.nod) }
}
type LightFn = (x: number, y: number) => number
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const L = lights(f)
    const pools: [number, number, number, number][] = [
      [11, 14, 15, L.strings], [53, 13, 15, L.brass], [32, 5, 13, L.timpani],
    ]
    const lightAt: LightFn = (x, y) => {
      let sum = 0.1 + L.flash * 0.7 + 0.55 * Math.max(0, 1 - Math.hypot((x - 32) / 17, (y - 15) / 10)) ** 0.8
      for (const [px, py, r, l] of pools) {
        sum += l * Math.max(0, 1 - Math.hypot(x - px, (y - py) * 1.3) / r) ** 1.1
        if (y < py) {
          const k = (y + 3) / (py + 3)
          if (Math.abs(x - lerp(px + 6, px, k)) < lerp(1.5, 5, k)) sum += 0.25 * l
        }
      }
      return sum
    }
    for (let y = 0; y < LIP; y++) {
      for (let x = 0; x < W; x++) {
        const lit = lightAt(x, y)
        if (y < 5) c.set(x, y, shade(WALL, 1 + lit * 4.4 + (x % 8 === 0 ? -0.6 : 0) + (y === 4 ? -0.8 : 0)))
        else c.set(x, y, shade(FLOOR, 0.8 + lit * 6.8 + ((y - 5) % 3 === 0 ? -0.5 : 0)))
      }
    }
    drawTimpani(c, f, lightAt)
    drawBrass(c, f, L.brass, lightAt)
    drawCellos(c, f, L.strings, lightAt)
    for (let x = 0; x < W; x++) {
      c.set(x, LIP, shade(FLOOR, 1.6 + lightAt(x, LIP - 2) * 3))
      for (let y = LIP + 1; y < H; y++) c.set(x, y, shade(VELVET, y === LIP + 1 ? 0.6 : 1.8))
    }
    drawConductor(c, f, lightAt)

    const glow = 0.3 + L.flash * 1.5 + 0.6 * Math.max(L.strings, L.brass, L.timpani)
    for (let x = 0; x < W; x++) {
      const isGap = x % 9 === 4
      c.set(x, 29, shade(VELVET, isGap ? 1 : 2.6 + glow * 1.6))
      for (let y = 30; y < H; y++) c.set(x, y, shade(VELVET, isGap ? 0 : 1.2))
    }
  })
}
function drawPlayer(c: Canvas, x: number, y: number, lit: number, rows: number): void {
  for (let j = 3; j < 3 + rows; j++) {
    for (let i = 0; i <= 4; i++) {
      if (j === 3 && (i === 0 || i === 4)) continue
      c.set(x + i, y + j, shade(SUIT, 1 + lit * 2.6 + (i === 0 ? -0.5 : i === 4 ? 0.3 : 0) + (j === 3 ? 0.4 : 0)))
    }
  }
  for (let i = 1; i <= 3; i++) {
    c.set(x + i, y, shade(SUIT, 1.6 + lit * 1.8))
    c.set(x + i, y + 1, shade(SKIN, 1.2 + lit * 3.2 + (i === 1 ? -0.6 : 0)))
    c.set(x + i, y + 2, shade(SKIN, 1 + lit * 3 + (i === 1 ? -0.6 : 0)))
  }
}
function drawCellos(c: Canvas, f: number, on: number, lightAt: LightFn): void {
  const saw = on > 0.5 ? [0, 1, 2, 1, 0, -1, -2, -1][f % 8] ?? 0 : 0
  const halves = [1.2, 1.7, 1.7, 1.2, 1.2, 2.2, 2.4, 2.4, 2]
  for (const x of [1, 8, 15]) {
    const y = 8
    const lit = lightAt(x + 2, y + 6)
    drawPlayer(c, x, y, lit, 7)
    c.line(x + 4, y - 2, x + 3, y + 5, shade(CELLO, 1 + lit * 2.5))
    c.set(x + 4, y - 2, shade(CELLO, 1.6 + lit * 3.6))
    halves.forEach((half, j) => {
      for (let i = Math.round(2.5 - half); i <= Math.round(2.5 + half); i++) {
        const round = (i - 2.5) / 2.4
        c.set(x + i, y + 5 + j, shade(CELLO, 0.8 + lit * 4.6 - round * 1.2 - (j === halves.length - 1 ? 0.8 : 0)))
      }
    })
    c.set(x + 3, y + 3, shade(SKIN, 1.2 + lit * 3))
    c.line(x - 1 + saw, y + 10, x + 5 + saw, y + 9, shade(BOW, 0.5 + lit * 3))
    c.set(x - 1 + saw, y + 10, shade(SKIN, 1 + lit * 3))
  }
}
function drawBrass(c: Canvas, f: number, on: number, lightAt: LightFn): void {
  const lift = on > 0.5 ? 1 : 0
  for (const [k, x] of [43, 49].entries()) {
    const y = 8
    const lit = lightAt(x + 2, y + 4)
    drawPlayer(c, x, y, lit, 9)
    const bx = x + 2
    const by = y + 3 - lift
    c.disc(bx, by, 2.1, (px, py) => shade(BRASS, 1 + lit * 4.4 + (px < bx ? 0.6 : px > bx ? -0.5 : 0) + (py < by ? 0.4 : py > by ? -0.4 : 0)))
    c.set(bx, by, shade(BRASS, 0.8 + lit * 3))
    if (on > 0.5 && (f + k * 4) % 8 < 3) c.set(bx - 1, by - 1, BRASS[7] ?? 0)
  }
  const tx = 56
  const lit = lightAt(tx + 2, 12)
  drawPlayer(c, tx, 9, lit, 9)
  c.line(tx + 4, 11 - lift, tx + 3, 14, shade(BRASS, 0.8 + lit * 3))
  c.ellipse(tx + 2, 16, 2.6, 2.2, (px, py) => {
    const isHole = Math.abs(px - (tx + 2)) < 1 && py === 16
    return shade(BRASS, 0.8 + lit * 4 + (px < tx + 2 ? 0.5 : -0.4) + (isHole ? -2 : 0))
  })
  const bx = tx + 5
  const by = 7 - lift
  c.disc(bx, by, 3.2, (px, py) => {
    const d = Math.hypot(px - bx, py - by)
    return shade(BRASS, (d > 2.2 ? 1.8 : d < 1 ? 0.6 : 1.1) + lit * 4.2 + (px < bx ? 0.4 : -0.3))
  })
  if (on > 0.5 && f % 8 >= 4) c.set(bx - 2, by - 2, BRASS[7] ?? 0)
}
function drawTimpani(c: Canvas, f: number, lightAt: LightFn): void {
  const px = 30
  const py = 0
  drawPlayer(c, px, py, lightAt(px + 2, py + 3), 5)
  const isRolling = f >= STRIKE && f < STRIKE + 8
  const raise = f >= 43 && f < STRIKE ? Math.round(ease.out(beat(f, 43, 47)) * 2) : 0
  const kettles = [25, 39]
  for (const [k, cx] of kettles.entries()) {
    const isStruck = isRolling && (f + k) % 2 === 0
    for (let y = 5; y <= 9; y++) {
      const half = y <= 7 ? 3.4 : y === 8 ? 2.7 : 1.8
      for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
        const lit = lightAt(x, y)
        if (y === 5) {
          c.set(x, y, shade(BOW, 1.4 + lit * 2.6 + (isStruck ? 1.4 : 0)))
          continue
        }
        const round = (x - cx) / 3.4
        const spec = x === cx - 2 && y === 6 ? 1.2 : 0
        c.set(x, y, shade(COPPER, 1.6 + lit * 4 - round * 1.6 - (y - 6) * 0.5 + spec))
      }
    }
    const hand = k === 0 ? px : px + 4
    const tipX = cx + (k === 0 ? 2 : -2)
    const tipY = isRolling && (f + k) % 2 === 0 ? 5 : 3 - raise
    c.line(hand, py + 5, tipX, tipY, shade(BOW, 0.6 + lightAt(hand, py + 5) * 2))
    c.set(tipX, tipY, shade(BOW, 2.4 + lightAt(tipX, tipY) * 2))
  }
}
type Part = 'coat' | 'sleeve' | 'hair' | 'skin' | 'collar' | 'cuff'
const HEAD = [
  '..hhhhh..',
  '.hhhhhhh.',
  'hhhhhhhhh',
  'hhhhhhhhh',
  'hhhhhhhhh',
  '.hhhhhhh.',
  '..hsssh..',
]
function drawConductor(c: Canvas, f: number, lightAt: LightFn): void {
  const pose = poseAt(f)
  const parts = new Map<number, Part>()
  const put = (x: number, y: number, part: Part) => {
    const ix = Math.round(x)
    const iy = Math.round(y)
    if (ix >= 0 && ix < W && iy >= 0 && iy < H) parts.set(iy * W + ix, part)
  }
  const arm = (sx: number, sy: number, hx: number, hy: number, out: number) => {
    const d = Math.hypot(hx - sx, hy - sy)
    const bend = Math.sqrt(Math.max(0, 49 - (d / 2) ** 2)) * 0.75
    let nx = -(hy - sy) / Math.max(d, 0.01)
    let ny = (hx - sx) / Math.max(d, 0.01)
    if (nx * out + ny * 0.6 < 0) {
      nx = -nx
      ny = -ny
    }
    const ex = Math.round((sx + hx) / 2 + nx * bend)
    const ey = Math.round((sy + hy) / 2 + ny * bend)
    for (const [ax, ay, bx, by, r] of [[sx, sy, ex, ey, 1.4], [ex, ey, hx, hy, 1]] as const) {
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)))
      for (let k = 0; k <= n; k++) {
        const x = lerp(ax, bx, k / n)
        const y = lerp(ay, by, k / n)
        for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (Math.hypot(i, j) <= r) put(x + i, y + j, 'sleeve')
      }
    }
    put(lerp(ex, hx, 0.8), lerp(ey, hy, 0.8), 'cuff')
    put(lerp(ex, hx, 0.8) + (Math.abs(hy - ey) > Math.abs(hx - ex) ? 1 : 0), lerp(ey, hy, 0.8) + (Math.abs(hy - ey) > Math.abs(hx - ex) ? 0 : 1), 'cuff')
    put(hx, hy, 'skin')
    put(hx + out, hy, 'skin')
  }
  for (let y = 17; y < H; y++) {
    const half = y === 17 ? 4.5 : y === 18 ? 6.5 : y < 23 ? 7 : 6.5
    for (let x = Math.round(32 - half); x <= Math.round(32 + half); x++) put(x, y, 'coat')
  }
  arm(38, 19, pose.rx, pose.ry, 1)
  arm(26, 19, pose.lx, pose.ly, -1)
  for (const x of [30, 31, 32, 33, 34]) put(x, 17, 'collar')
  const hx = 32 + pose.turn
  const hy = 10 + pose.nod
  const lag = poseAt(f - 2).nod - pose.nod
  HEAD.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] === 'h') put(hx - 4 + i, hy + j, 'hair')
      if (row[i] === 's') put(hx - 4 + i, hy + j, 'skin')
    }
  })
  if (lag < 0) for (const [dx, dy] of [[-2, -1], [0, -1], [0, -2], [2, -1], [3, -2]] as const) put(hx + dx, hy + dy, 'hair')
  for (const [key, part] of parts) {
    const x = key % W
    const y = Math.floor(key / W)
    const isOpen = (dx: number, dy: number) => !parts.has((y + dy) * W + x + dx)
    let rim = 0
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1]] as const) if (isOpen(dx, dy)) rim = Math.max(rim, lightAt(x + dx * 3, y + dy * 3))
    if (part === 'coat' || part === 'sleeve') {
      c.set(x, y, shade(SUIT, 0.3 + clamp(rim - 0.5, 0, 1) * 2.4))
    } else if (part === 'hair') {
      const top = isOpen(0, -1) ? 0.8 : 0
      const side = isOpen(-1, 0) ? -0.7 : isOpen(1, 0) ? 0.3 : 0
      c.set(x, y, shade(HAIR, 3.4 + top + side - (y - hy) * 0.25 + clamp(rim - 0.6) * 1.2))
    } else if (part === 'skin') c.set(x, y, shade(SKIN, 1.2 + rim * 1.6))
    else c.set(x, y, shade(HAIR, 3.6 + rim))
  }
  const was = poseAt(f - 1)
  if (f !== STRIKE && Math.hypot(was.rx - pose.rx, was.ry - pose.ry) > 2.5) {
    c.line(was.rx, was.ry, pose.rx, pose.ry, (x, y) => (parts.has(y * W + x) ? undefined : HAIR[1]))
  }
  const drag = rawPose(f - 1).angle
  const isWhip = f !== STRIKE && Math.abs(drag - pose.angle) > 15
  const bend = (s: number) => {
    const a = ((isWhip ? lerp(pose.angle, drag, s / 9) : pose.angle) * Math.PI) / 180
    return [pose.rx + Math.cos(a) * s, pose.ry + Math.sin(a) * s] as const
  }
  const step = isWhip ? 1.5 : 9
  for (let s = 0; s < 9; s += step) c.line(...bend(s), ...bend(s + step), HAIR[4] ?? 0)
  c.set(...bend(9), HAIR[5] ?? 0)
}
export const scene: Scene = {
  verb: 'Orchestrating',
  render,
  hero: 51,
  snaps: [
    {
      frames: STRIKE,
      box: [0, 0, W - 1, H - 1],
      why: 'The downbeat: the hands come down from high to low as the timpani strike, and the whole stage flashes white in that frame; the flash then fades over eight frames.',
    },
  ],
}