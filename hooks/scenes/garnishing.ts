import { Canvas, TAU, beat, clamp, ease, hex, lerp, lightAt, mix, mod, shade, threshold, type Light, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const WALL = hex('0d0809 140c0d 1c1111 261714 321e18 40261c 50301f 64401f')
const WOOD = hex('120909 1c0e0c 28140f 361b13 472317 5c2d1b 74391f 8e4824 a85a2c c8783a')
const DRINK = hex('0b1a46 10306e 164c9e 1f6cc8 2f92e6 5ab8f6 9adcfc e2f6ff')
const LEMON = hex('8a5206 c48a10 eabe2a f8e060 fff6b0')
const CHERRY = hex('3a0410 7a0c1c b81828 e83a3a ff9a88')
const PINK = hex('8a1c48 c8306a ee5a8e fca0c0')
const PAPER = hex('b8a48e e6d8c4 fff6ea')
const GLASS = hex('3a3440 5a5660 8a8c94 bcc4c8 e4eef0 ffffff')
const BRASS = hex('2a1a0c 4a3014 7a5222 b08038 e0b85a fbe6a0')
const BOTTLES = [hex('1e1008 3a200c 6a3e14 a06a24'), hex('0c1810 163020 245034 3e7a4c'), hex('16161e 26283a 40445c 6a7088')]

const LAMP: Light = { x: 11, y: 3, power: 1, radius: 34 }
const BAR = 24
const RIM = 10
const POINT = 22
const LEVEL = 13.5
const FOOT = 28
const GLINT = 51

function slide(f: number): number {
  if (f < 10) return -44 * (1 - ease.out(beat(f, 0, 10)))
  if (f >= 60) return 46 * ease.in(beat(f, 60, 71))
  return 0
}

const TILT: number[] = (() => {
  let tilt = 0
  let v = 0
  const out: number[] = []
  for (let n = 0; n < LOOP * 2; n++) {
    const f = n % LOOP
    const accel = slide(f + 1) - 2 * slide(f) + slide(f - 1 < 0 ? LOOP - 1 : f - 1)
    const kick = Math.abs(accel) > 20 ? 0 : accel
    v += -0.35 * tilt - 0.22 * v + kick * 0.05
    tilt += v
    if (n >= LOOP) out.push(clamp(tilt, -0.32, 0.32))
  }
  return out
})()

const SHELF_BOTTLES: readonly (readonly [number, number, number, number])[] = [
  [1, 3, 7, 0], [5, 2, 9, 1], [8, 3, 6, 2], [13, 2, 8, 0], [17, 3, 5, 1],
  [45, 3, 6, 2], [49, 2, 8, 0], [52, 3, 7, 1], [57, 2, 9, 2], [60, 3, 6, 0],
]

const BACKDROP: Int32Array = (() => {
  const c = new Canvas()
  for (let y = 0; y < BAR; y++) {
    for (let x = 0; x < W; x++) {
      const lit = lightAt([LAMP], x, y)
      c.set(x, y, shade(WALL, 1.4 + lit * 4.2 - y * 0.03, x, y))
    }
  }
  for (const [bx, w, h, kind] of SHELF_BOTTLES) {
    const r = BOTTLES[kind] ?? BOTTLES[0] ?? []
    const top = 12 - h
    for (let y = top; y < 12; y++) {
      const neck = y < top + 3
      for (let x = bx; x < bx + w; x++) {
        if (neck && x !== bx + Math.floor(w / 2)) continue
        const lit = lightAt([LAMP], x, y)
        const hi = x === bx && !neck ? 1.2 : 0
        c.set(x, y, shade(r, 0.6 + hi + lit * 2, x, y))
      }
    }
  }
  for (let x = 0; x < W; x++) {
    const lit = lightAt([LAMP], x, 12)
    c.set(x, 12, shade(WOOD, 3.4 + lit * 4, x, 12))
    c.set(x, 13, shade(WOOD, 1 + lit * 1.5, x, 13))
  }
  for (let x = 0; x < W; x++) {
    const lit = lightAt([LAMP], x, 21)
    c.set(x, 21, shade(BRASS, 1.6 + lit * 4, x, 21))
    c.set(x, 22, shade(BRASS, 0.4 + lit * 1.5, x, 22))
  }
  for (let y = 0; y <= 2; y++) {
    for (let x = 8 - y; x <= 14 + y; x++) c.set(x, y, shade(BRASS, 1.5 + (x - 8 + y) * 0.28 - (y === 2 ? 0 : 0.5), x, y))
  }
  for (let x = 7; x <= 15; x++) c.set(x, 3, shade(BRASS, x < 9 || x > 13 ? 4 : 5, x, 3))
  for (let y = BAR; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const lit = lightAt([LAMP], x, y * 0.6)
      let level = y === BAR ? 1.4 : y < 30 ? 2.6 + (y - BAR) * 0.25 + lit * 3.2 : y === 30 ? 5.4 + lit * 2.4 : 1.6
      if (y === BAR + 2 && lit > 0.3) level += 1
      c.set(x, y, shade(WOOD, level, x, y))
    }
  }
  return c.copy()
})()

const half = (y: number) => RIM + 12 - y

function drawGlass(c: Canvas, f: number, cx: number, glint: number): void {
  const tilt = TILT[f] ?? 0
  const top = (x: number) => {
    const dx = x - cx
    const r = half(LEVEL) - 0.5
    return LEVEL + tilt * dx - 0.95 * Math.sqrt(Math.max(0, 1 - (dx / r) ** 2))
  }
  const bottom = (x: number) => {
    const dx = x - cx
    const r = half(LEVEL) - 0.5
    return LEVEL + tilt * dx + 0.95 * Math.sqrt(Math.max(0, 1 - (dx / r) ** 2))
  }
  const isSwept = (x: number, y: number) => glint > 0 && glint < 1 && Math.abs(x - cx - lerp(-16, 16, glint) + (y - LEVEL) * 0.6) < 1.1
  const glass = (x: number, y: number, level: number) => (isSwept(x, y) ? (GLASS[5] ?? 0) : shade(GLASS, level, x, y))

  c.ellipse(cx + 7, FOOT - 0.4, 7, 1, (x, y) => mix(c.get(x, y), 0x080405, 0.45))
  c.ellipse(cx + 5, FOOT - 0.4, 2.6, 0.7, (x, y) => mix(c.get(x, y), DRINK[5] ?? 0, 0.45))

  for (let y = RIM; y <= POINT; y++) {
    const hw = half(y)
    for (let x = cx - hw; x <= cx + hw; x++) {
      const dx = x - cx
      const isWall = Math.abs(dx) === hw
      const isWet = y >= Math.round(top(x))
      if (isWet && !isWall) {
        const isSurface = y < Math.round(bottom(x))
        let level = isSurface ? 5.4 - (dx > 2 ? 0.8 : 0) : 3.2 - (y - LEVEL - 1.5) * 0.18 - dx * 0.06
        if (!isSurface && Math.abs(dx) === hw - 1) level += dx < 0 ? 2 : -0.8
        if (!isSurface && y >= POINT - 2) level += 1.2
        c.set(x, y, isSwept(x, y) ? (DRINK[7] ?? 0) : shade(DRINK, level, x, y))
      } else if (isWall) {
        c.set(x, y, isSwept(x, y) ? (GLASS[5] ?? 0) : isWet ? shade(DRINK, dx < 0 ? 6 : 4.4, x, y) : shade(GLASS, dx < 0 ? 4 : 2, x, y))
      } else if (isSwept(x, y)) {
        c.set(x, y, GLASS[3] ?? 0)
      }
    }
  }
  for (let dx = -12; dx <= 12; dx++) {
    const x = cx + dx
    if (Math.abs(dx) >= 11) {
      c.set(x, RIM, glass(x, RIM, 4.4))
      continue
    }
    c.set(x, RIM - 1, glass(x, RIM - 1, dx < 0 ? 2.2 : 1.2))
    if (RIM + 1 < Math.round(top(x))) c.set(x, RIM + 1, glass(x, RIM + 1, dx < 0 ? 3.2 : 2))
  }
  for (let k = 0; k < 3; k++) c.set(cx - 9 + k, RIM + 3 + k, GLASS[5] ?? 0)
  for (let y = POINT + 1; y <= FOOT - 1; y++) c.set(cx, y, y <= POINT + 2 ? (DRINK[5] ?? 0) : glass(cx, y, 3))
  for (let dx = -5; dx <= 5; dx++) {
    c.set(cx + dx, FOOT, shade(GLASS, dx < -2 ? 4 : 2.2, 0, 0))
    if (Math.abs(dx) <= 3) c.set(cx + dx, FOOT - 1, shade(GLASS, 1, 0, 0))
  }
}

const TWIST_DROP = [-9, -6, -3, 0, 3, 6, RIM - 1, RIM - 2, RIM - 3, RIM - 3, RIM - 2, RIM - 1] as const
const TWIST_HIT = 17
function drawTwist(c: Canvas, x0: number, y0: number, sway: number, squash: number): void {
  c.set(x0 - 2, y0, LEMON[3] ?? 0)
  c.set(x0 - 1, y0, LEMON[2] ?? 0)
  const len = 7 * squash
  for (let t = 0; t <= 1; t += 0.01) {
    const ang = t * TAU * 2.25
    const x = x0 + 1.4 * Math.sin(ang) + sway * t * 1.5
    const y = y0 + t * len
    const front = Math.cos(ang)
    c.set(x, y, shade(LEMON, front > 0.3 ? 3.4 + front : front > -0.3 ? 2 : 0.8, 0, 0))
    if (front > 0.5) c.set(x + 1, y, shade(LEMON, 2.4, 0, 0))
  }
}
const CHERRY_ART = [' hr ', 'hrrr', 'rrrd', ' dd ']
const CHERRY_DROP = [-6, -4, -2, 0, 2, 5, 8, 11, LEVEL] as const
const CHERRY_TINT = [0.05, 0.25, 0.6] as const
function drawCherry(c: Canvas, x: number, y: number, sunk: number): void {
  const tint = (col: number) => {
    const under = mix(col, DRINK[3] ?? 0, 0.32)
    return (px: number, py: number) => (threshold(px, py) < sunk ? under : col)
  }
  c.sprite(x - 2, y - 2, CHERRY_ART, { h: tint(CHERRY[4] ?? 0), r: tint(CHERRY[2] ?? 0), d: tint(CHERRY[1] ?? 0) })
  const stem = tint(0x4a3014)
  for (const [sx, sy] of [[0, -3], [0, -4], [1, -5], [2, -6]] as const) c.set(x + sx, y + sy, stem)
}
const UMBRELLA_DROP = [-2, 1, 4, 7, 10, 13, 16, 18] as const
const STICK = 12
function drawUmbrella(c: Canvas, ax: number, ay: number, lean: number, open: number, wetBelow: number): void {
  const up: [number, number] = [Math.sin(lean), -Math.cos(lean)]
  const right: [number, number] = [Math.cos(lean), Math.sin(lean)]
  const tx = ax + up[0] * STICK
  const ty = ay + up[1] * STICK
  for (let k = 0; k <= STICK; k++) {
    const x = ax + up[0] * k
    const y = ay + up[1] * k
    c.set(x, y, Math.round(y) >= wetBelow ? mix(PAPER[0] ?? 0, DRINK[3] ?? 0, 0.6) : (PAPER[0] ?? 0))
  }
  const w = lerp(2.2, 7.5, open)
  const apex = lerp(1.6, 3.4, open)
  const drop = lerp(7, 0.8, clamp(open))
  for (let y = Math.floor(ty - 10); y <= Math.ceil(ty + 10); y++) {
    for (let x = Math.floor(tx - 10); x <= Math.ceil(tx + 10); x++) {
      const u = (x - tx) * right[0] + (y - ty) * right[1]
      const v = (x - tx) * up[0] + (y - ty) * up[1]
      if (Math.abs(u) > w) continue
      const roof = apex * (1 - (u / w) ** 2)
      const hem = -drop * (1 - 0.25 * (u / w) ** 2) + 0.5 * Math.abs(Math.sin((u / w) * Math.PI * 1.5))
      if (v > roof || v < hem) continue
      const stripe = mod(Math.floor(Math.atan2(u, apex + 0.5 - v) / 0.62 + 0.5), 2)
      const lit = (u < -w * 0.3 ? 0.7 : u > w * 0.4 ? -0.6 : 0) + (v < hem + 1 ? -1 : 0)
      c.set(x, y, stripe ? shade(PINK, 1.6 + lit, x, y) : shade(PAPER, 1.4 + lit, x, y))
    }
  }
  c.set(tx + up[0] * (apex + 1), ty + up[1] * (apex + 1), PINK[1] ?? 0)
}
function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    c.px.set(BACKDROP)
    const gx = Math.round(slide(f))
    const cx = 32 + gx
    const glint = beat(f, GLINT, GLINT + 6)
    drawGlass(c, f, cx, glint)
    const tilt = TILT[f] ?? 0
    const surfaceAt = (x: number) => LEVEL + tilt * (x - cx)

    const CHERRY_X = -1
    if (f >= 18) {
      const sink = ease.out(beat(f, 27, 38))
      const y = f <= 26 ? (CHERRY_DROP[f - 18] ?? LEVEL) : lerp(LEVEL + 1, POINT - 2.5, sink)
      drawCherry(c, cx + CHERRY_X, Math.round(y), f <= 26 ? 0 : (CHERRY_TINT[f - 27] ?? 1))
      for (let b = 0; b < 3; b++) {
        const age = mod(f - 34 - b * 4, 12)
        if (f < 34 || f >= 60 || age > 7) continue
        const by = POINT - 4 - age
        if (by > surfaceAt(cx) + 1) c.set(cx + CHERRY_X + (b % 2 ? 1 : 0), by, DRINK[6] ?? 0)
      }
    }
    const t = f - 27
    if (t >= 0 && t <= 7) {
      const ix = cx + CHERRY_X
      for (let k = 0; k < 8; k++) {
        const vx = (k - 3.5) * 0.45
        const vy = -2.3 + Math.abs(k - 3.5) * 0.2
        const x = ix + vx * t
        const y = LEVEL - 0.5 + vy * t + 0.36 * t * t
        if (y < surfaceAt(x) + 0.5) c.set(x, y, t < 3 ? (DRINK[7] ?? 0) : (DRINK[6] ?? 0))
      }
      if (t <= 2) {
        for (const dx of [-2, -1, 1, 2]) {
          const hgt = Math.abs(dx) === 2 ? [1, 2, 1][t] ?? 0 : [2, 1, 0][t] ?? 0
          for (let j = 1; j <= hgt; j++) c.set(ix + dx, Math.round(surfaceAt(ix + dx)) - j, j === hgt ? (DRINK[7] ?? 0) : (DRINK[5] ?? 0))
        }
      }
    }
    if (t >= 1 && t <= 10) {
      const r = 1 + t * 0.85
      for (const side of [-1, 1]) {
        const x = cx + CHERRY_X + side * r
        if (Math.abs(x - cx) < half(LEVEL) - 1.5) c.set(x, Math.round(surfaceAt(x)), t < 6 ? (DRINK[7] ?? 0) : (DRINK[6] ?? 0))
      }
    }
    if (f >= 11) {
      const y = TWIST_DROP[f - 11] ?? RIM - 1
      const settle = f - TWIST_HIT
      const sway = settle >= 0 ? Math.exp(-settle / 5) * Math.sin(settle * 1.3) * 1.2 : 0
      const squash = f === TWIST_HIT || f === TWIST_HIT + 5 ? 0.85 : 1
      drawTwist(c, cx + 13, Math.round(y), sway, squash)
    }
    if (f >= 33) {
      const settle = f - 40
      const lean = -0.26 + (settle >= 0 ? Math.exp(-settle / 2.5) * Math.sin(settle * 2.1) * 0.16 : 0) + (f >= 50 ? Math.sin(TAU * ((f - 50) / 22)) * 0.03 : 0)
      const pop = beat(f, 45, 51)
      const open = f < 43 ? 0 : f < 45 ? -0.15 : ease.outBack(pop)
      const ay = UMBRELLA_DROP[f - 33] ?? 18
      drawUmbrella(c, cx - 3, ay, lean, Math.max(-0.15, open), Math.round(surfaceAt(cx - 4)))
    }
    out.push(c.px)
  }
  return out
}

const glassX = (f: number) => 32 + Math.round(slide(mod(f, LOOP)))
const SLIDES = Array.from({ length: LOOP - 1 }, (_, i) => i + 1).filter(f => Math.abs(glassX(f) - glassX(f - 1)) >= 2)
export const scene: Scene = {
  verb: 'Garnishing',
  render,
  hero: 57,
  snaps: [
    ...SLIDES.map(f => ({
      frames: f,
      box: [Math.max(0, Math.min(glassX(f - 1), glassX(f)) - 12), f < GLINT ? RIM - 1 : 1, Math.min(W - 1, Math.max(glassX(f - 1), glassX(f)) + 16), FOOT] as const,
      why: 'the barman slides the glass in, and later away: a quick slide that covers several pixels a frame',
    })),
    { frames: [GLINT + 1, GLINT + 5], box: [20, RIM - 1, 44, POINT], colors: [GLASS[5] ?? 0, GLASS[3] ?? 0, DRINK[7] ?? 0], why: 'a glint of light sweeps across the glass' },
  ],
}