import { Canvas, TAU, clamp, ease, hex, lerp, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72
const PLUG_IN = 16
const PLUG_OUT = 60

const ALU = hex('121419 1b1e24 252930 30353d 3d434c 4c535d 5e6670 747c86 9098a0')
const BLACK = hex('070809 0c0e11 121519 191c22 21252c 2b3038')
const WOOD = hex('120a08 1e100b 2e1910 432618 5a341f 744628')
const KNOB = hex('060608 101014 1c1c22 2c2c34 40404a')
const CREAM = hex('2e2820 5a5040 8c8064 bcae8a ded2ae f6eed6')
const SCOPE = hex('030b06 06160c 0b2414 133a1e 1e5a2c 33863e 62bc5c a8ec90 e8ffd8')
const RED = hex('240810 50101a 8c1c24 c83430 f06a50')
const YELLOW = hex('342206 664409 a6780e dcae2a f6dc78')
const ORANGE = hex('3a1206 742408 c04a12 f07a2a fcb870')
const LED_RED = hex('2a0a0c 5a1210 a82014 f04a26 ffb08a fff4e0')
const LED_GREEN = hex('0a1e10 124a1a 22a032 7ae86c')
const LED_AMBER = hex('2e1a06 6a400a e0961e ffe08a')

const DARKER = (() => {
  const m = new Map<number, number>()
  for (const r of [ALU, BLACK, WOOD, KNOB, CREAM, SCOPE, LED_RED, LED_GREEN, LED_AMBER, RED, YELLOW]) {
    r.forEach((col, i) => m.set(col, r[Math.max(0, i - 2)] ?? col))
  }
  return m
})()
const darken = (c: Canvas, x: number, y: number) => c.set(x, y, DARKER.get(c.get(x, y)) ?? (BLACK[0] ?? 0))

const lamp = (x: number, y: number) => clamp(1.2 - Math.hypot(x + 2, (y + 6) * 1.4) / 58)

const ROW_A = [2, 14] as const
const ROW_B = [17, 28] as const
type Module = { x0: number; x1: number; row: readonly [number, number]; isBlack: boolean }
const MODULES: Module[] = [
  { x0: 2, x1: 11, row: ROW_A, isBlack: true },
  { x0: 12, x1: 32, row: ROW_A, isBlack: false },
  { x0: 33, x1: 45, row: ROW_A, isBlack: true },
  { x0: 46, x1: 61, row: ROW_A, isBlack: false },
  { x0: 2, x1: 37, row: ROW_B, isBlack: false },
  { x0: 38, x1: 48, row: ROW_B, isBlack: true },
  { x0: 49, x1: 61, row: ROW_B, isBlack: false },
]

const SCREEN = { x0: 14, x1: 30, y0: 3, y1: 10 }
const STEPS = 8
const STEP_FRAMES = 3
const stepX = (i: number) => 4 + Math.round(i * 4.3)
const PITCH = [0.2, 0.7, 0.45, 0.9, 0.3, 0.6, 0.1, 0.8]

type Jack = readonly [number, number]
const TARGET: Jack = [57, 12]
const CABLES: [Jack, Jack, readonly number[], number][] = [
  [[9, 12], [36, 12], RED, 3.6],
  [[42, 12], [50, 12], YELLOW, 2.4],
]
const JACKS: Jack[] = [[4, 12], [9, 12], [36, 12], [42, 12], [50, 12], TARGET]

function shapeAt(f: number): number {
  if (f < PLUG_IN) return 0
  const seg: [number, number, number][] = [[PLUG_IN + 1, 1, 4], [30, 2, 4], [44, 3, 4], [PLUG_OUT, 4, 5]]
  let s = 0
  for (const [start, to, len] of seg) if (f >= start) s = lerp(to - 1, to, ease.inOut(clamp((f - start) / len)))
  return s % 4
}

function waveValue(p: number, s: number): number {
  const ph = p - Math.floor(p)
  const shapes = [
    Math.sin(ph * TAU),
    ph < 0.25 ? ph * 4 : ph < 0.75 ? 2 - ph * 4 : ph * 4 - 4,
    ph < 0.5 ? 0.85 : -0.85,
    1 - ph * 2,
  ]
  const i = Math.floor(s) % 4
  return lerp(shapes[i] ?? 0, shapes[(i + 1) % 4] ?? 0, s - Math.floor(s))
}

function plugAt(f: number): { x: number; y: number; isIn: boolean } {
  const [tx, ty] = TARGET
  if (f < PLUG_IN) {
    const t = f / PLUG_IN
    const swing = Math.sin(t * TAU * 1.25) * 3.5 * (1 - t) ** 1.4
    const y = f < 12 ? lerp(-5, ty - 3, ease.out(f / 12)) : ty - 3 + (f >= 14 ? -1 : 0)
    return { x: tx + swing, y, isIn: false }
  }
  if (f < PLUG_OUT) return { x: tx, y: ty, isIn: true }
  const t = (f - PLUG_OUT) / (LOOP - PLUG_OUT)
  return { x: tx - Math.sin(t * 4) * 1.5 * t, y: lerp(ty - 2, -8, ease.in(t)), isIn: false }
}

const jolt = (f: number) => (f >= PLUG_IN ? Math.exp(-(f - PLUG_IN) / 7) * Math.sin((f - PLUG_IN) * 0.8) : 0)

function knob(c: Canvas, cx: number, cy: number, r: number, angle: number, ramp: readonly number[], light: number) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx
      const dy = y - cy
      const d = Math.hypot(dx, dy)
      if (d > r + 0.15) continue
      const isShadowEdge = d > r - 0.85 && dx + dy > 0.3
      const isLitEdge = d > r - 0.85 && dx + dy < -0.3
      const level = r < 2
        ? 2 + light * 1.4 - (dx > 0.5 || dy > 0.5 ? 1.2 : 0)
        : 1.8 + light * 1.6 + (isLitEdge ? 1 : 0) - (isShadowEdge ? 1.2 : 0)
      c.set(x, y, shade(ramp, level, x, y))
    }
  }
  for (const [dx, dy] of [[1, 1], [0, 1], [1, 0]] as const) {
    const sx = Math.round(cx + r * 0.7 + dx)
    const sy = Math.round(cy + r * 0.7 + dy)
    if (Math.hypot(sx - cx, sy - cy) > r + 0.4) darken(c, sx, sy)
  }
  const tip = r > 2 ? r - 0.6 : r - 0.4
  const pointer = ramp === CREAM ? (KNOB[0] ?? 0) : (CREAM[5] ?? 0)
  if (r > 2) c.line(cx + Math.cos(angle) * 0.6, cy + Math.sin(angle) * 0.6, cx + Math.cos(angle) * tip, cy + Math.sin(angle) * tip, pointer)
  else c.set(cx + Math.cos(angle) * tip, cy + Math.sin(angle) * tip, pointer)
}

function jack(c: Canvas, x: number, y: number) {
  for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const) {
    c.set(x + dx, y + dy, ALU[dx + dy < 0 ? 7 : dx + dy > 0 ? 4 : 6] ?? 0)
  }
  c.set(x, y, BLACK[0] ?? 0)
}

function plugHead(c: Canvas, x: number, y: number, ramp: readonly number[]) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) c.set(x + dx, y + dy, KNOB[dx + dy < 0 ? 4 : dx + dy > 0 ? 1 : 2] ?? 0)
  }
  c.set(x, y + 1, ramp[2] ?? 0)
}

function cable(c: Canvas, a: readonly [number, number], b: readonly [number, number], sag: number, swing: number, ramp: readonly number[]) {
  const mx = (a[0] + b[0]) / 2 + swing
  const my = Math.max(a[1], b[1]) + sag * 2
  const pts = new Map<number, [number, number]>()
  for (let i = 0; i <= 120; i++) {
    const t = i / 120
    const x = Math.round((1 - t) ** 2 * a[0] + 2 * t * (1 - t) * mx + t * t * b[0])
    const y = Math.round((1 - t) ** 2 * a[1] + 2 * t * (1 - t) * my + t * t * b[1])
    pts.set(y * W + x, [x, y])
  }
  const shadow = new Set<number>()
  for (const [x, y] of pts.values()) shadow.add((y + 2) * W + x + 1)
  for (const k of shadow) if (!pts.has(k) && !pts.has(k - W)) darken(c, k % W, Math.floor(k / W))
  for (const [x, y] of pts.values()) if (!pts.has((y + 1) * W + x)) c.set(x, y + 1, ramp[1] ?? 0)
  for (const [x, y] of pts.values()) c.set(x, y, shade(ramp, 2.4 + lamp(x, y) * 1.6, x, y))
}

function render(): Int32Array[] {
  const out: Int32Array[] = []

  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const step = Math.floor(f / STEP_FRAMES) % STEPS
    const pluck = 1 - (f % STEP_FRAMES) / STEP_FRAMES
    const s = shapeAt(f)
    const isLive = f >= PLUG_IN && f < PLUG_OUT + 5
    const click = f === PLUG_IN ? 1 : f === PLUG_IN + 1 ? 0.5 : 0
    const j = jolt(f)
    const glow = isLive ? 1 : 0.6

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const l = lamp(x, y) + click * 0.3 * Math.max(0, 1 - Math.hypot(x - TARGET[0], y - TARGET[1]) / 14)
        if (x < 2 || x > 61) {
          const isEdge = x === 1 || x === 62
          c.set(x, y, shade(WOOD, 1.2 + l * 3 + (isEdge ? 0.8 : 0) - (y > 29 ? 1 : 0), x, y))
          continue
        }
        if (y >= 30) {
          c.set(x, y, shade(WOOD, 0.6 + l * 1.4 - (y - 30) * 0.6, x, y))
          continue
        }
        const m = MODULES.find(md => x >= md.x0 && x <= md.x1 && y >= md.row[0] && y <= md.row[1])
        if (!m) {
          const isRail = y <= 1 || y === 15 || y === 16 || y === 29
          const isHole = isRail && (y === 0 || y === 16) && x % 8 === 4
          const level = isRail ? 3.4 + (y === 1 || y === 15 ? -1.6 : 0) + l * 3 : 0
          c.set(x, y, isHole ? (BLACK[0] ?? 0) : shade(isRail ? ALU : BLACK, level, x, y))
          continue
        }
        const isSeam = x === m.x1 && m.x1 < 61
        const ramp = m.isBlack ? BLACK : ALU
        const spill = Math.hypot((x - 22) / 14, (y - 7) / 8) < 1 ? 0.8 * glow : 0
        c.set(x, y, shade(ramp, (m.isBlack ? 1.2 : 1.8) + l * (m.isBlack ? 2.6 : 3.8) + spill - (isSeam ? 1.8 : 0) + (x === m.x0 ? 0.8 : 0), x, y))
      }
    }
    for (const m of MODULES) {
      for (const sx of [m.x0 + 1, m.x1 - 1]) c.set(sx, m.row[0], ALU[6] ?? 0)
    }

    for (let y = SCREEN.y0 - 1; y <= SCREEN.y1 + 1; y++) {
      for (let x = SCREEN.x0 - 1; x <= SCREEN.x1 + 1; x++) {
        const isIn = x >= SCREEN.x0 && x <= SCREEN.x1 && y >= SCREEN.y0 && y <= SCREEN.y1
        if (!isIn) {
          c.set(x, y, BLACK[y === SCREEN.y1 + 1 ? 4 : x === SCREEN.x0 - 1 || y === SCREEN.y0 - 1 ? 0 : 1] ?? 0)
          continue
        }
        const gx = x - SCREEN.x0
        const gy = y - SCREEN.y0
        const isGrid = (gx % 4 === 0 && gy % 2 === 1) || (gy === 4 && gx % 2 === 0)
        const isCorner = (gx === 0 || gx === 16) && (gy === 0 || gy === 7)
        c.set(x, y, SCOPE[isCorner ? 0 : isGrid ? 2 : 1] ?? 0)
      }
    }
    const cyclesAt = (ff: number) => {
      const live = ff >= PLUG_IN && ff < PLUG_OUT + 5
      return live ? 1.5 + (PITCH[Math.floor(mod(ff) / STEP_FRAMES) % STEPS] ?? 0) * 1.5 : 2
    }
    const amp = (isLive ? 0.78 + 0.22 * pluck : 0.8) * 3.3
    const trace = (ff: number) =>
      Array.from({ length: SCREEN.x1 - SCREEN.x0 + 1 }, (_, i) => {
        const p = (i / 17) * cyclesAt(ff) + (mod(ff) / LOOP) * 6
        return Math.round(SCREEN.y0 + 3.5 - waveValue(p, shapeAt(mod(ff))) * amp)
      })
    const plot = (ys: number[], level: number, isBloom: boolean) => {
      ys.forEach((y, i) => {
        const x = SCREEN.x0 + i
        const prev = ys[i - 1] ?? y
        for (let yy = Math.min(y, prev); yy <= Math.max(y, prev); yy++) {
          if (yy < SCREEN.y0 || yy > SCREEN.y1) continue
          if (isBloom) {
            for (const by of [yy - 1, yy + 1]) {
              if (by >= SCREEN.y0 && by <= SCREEN.y1 && c.get(x, by) !== (SCOPE[7] ?? 0)) c.set(x, by, SCOPE[4] ?? 0)
            }
          }
          c.set(x, yy, SCOPE[level] ?? 0)
        }
      })
    }
    plot(trace(f - 1), 3, false)
    const now = trace(f)
    plot(now, 7, true)
    const tip = now[now.length - 1] ?? 6
    if (tip >= SCREEN.y0 && tip <= SCREEN.y1) c.set(SCREEN.x1, tip, SCOPE[8] ?? 0)

    knob(c, 6.5, 6, 2.6, -2.3 + Math.sin((TAU * f) / LOOP) * 0.25, CREAM, lamp(6, 6))
    knob(c, 17, 13, 1.4, -2.4, KNOB, lamp(17, 13))
    knob(c, 22, 13, 1.4, -2.4 + s * 1.25, KNOB, lamp(22, 13))
    knob(c, 27, 13, 1.4, -0.7, KNOB, lamp(27, 13))
    knob(c, 39.5, 5.5, 2.6, -1.6 + Math.sin((TAU * f) / LOOP + 1) * 1.1, CREAM, lamp(39, 5))
    knob(c, 51, 5.5, 2.1, -0.9, KNOB, lamp(51, 5))
    for (const [x, y] of JACKS) jack(c, x, y)
    const blink = isLive ? f % 6 < 3 : f % 12 < 6
    c.set(58, 4, LED_AMBER[blink ? 2 + click : 0] ?? 0)
    if (blink) c.set(58, 5, LED_AMBER[1] ?? 0)

    for (let i = 0; i < STEPS; i++) {
      const x = stepX(i)
      const isOn = i === step
      const isTrail = i === (step + STEPS - 1) % STEPS
      const led = isOn ? Math.round(3 + pluck * 1.4 + click) : isTrail ? 2 : 0
      c.set(x, 19, LED_RED[Math.min(5, led)] ?? 0)
      c.set(x + 1, 19, LED_RED[Math.min(5, Math.max(0, led - 1))] ?? 0)
      if (isOn) {
        c.set(x, 20, LED_RED[1] ?? 0)
        c.set(x + 1, 20, LED_RED[1] ?? 0)
      }
      knob(c, x + 0.5, 23.5, 1.4, -2.4 + (PITCH[i] ?? 0) * 4.8, KNOB, lamp(x, 23))
      const isGate = (PITCH[i] ?? 0) > 0.25
      c.set(x, 27, isGate ? (CREAM[3] ?? 0) : (BLACK[2] ?? 0))
      c.set(x + 1, 27, isGate ? (CREAM[3] ?? 0) : (BLACK[2] ?? 0))
    }

    for (const [mx, k] of [[41, 0], [44, 1]] as const) {
      const base = isLive ? 3.2 + (PITCH[step] ?? 0) * 3 + pluck * 1.4 - k : 1.6 + pluck * 0.8 - k * 0.5
      const level = Math.round(Math.min(8, base + click * 4))
      for (let i = 0; i < 8; i++) {
        const y = 27 - i
        const ramp = i >= 7 ? LED_RED : i >= 5 ? LED_AMBER : LED_GREEN
        const isOn = i < level
        c.set(mx, y, ramp[isOn ? 2 : 0] ?? 0)
        c.set(mx + 1, y, ramp[isOn ? 3 : 1] ?? 0)
      }
    }

    for (const [fx, pos] of [[52, 0.3], [55, 0.7], [58, 0.5]] as const) {
      for (let y = 19; y <= 27; y++) c.set(fx, y, BLACK[0] ?? 0)
      const cy = Math.round(lerp(26, 20, pos))
      for (let dx = -1; dx <= 1; dx++) {
        c.set(fx + dx, cy, CREAM[dx < 0 ? 5 : 4] ?? 0)
        c.set(fx + dx, cy + 1, CREAM[1] ?? 0)
      }
    }

    CABLES.forEach(([a, b, ramp, sag], i) => {
      const sway = Math.sin((TAU * f) / LOOP + i * 2.1) * 0.9 + j * (2.4 - i)
      cable(c, [a[0], a[1] + 1], [b[0], b[1] + 1], sag + j * 0.7, sway, ramp)
      plugHead(c, a[0], a[1], ramp)
      plugHead(c, b[0], b[1], ramp)
    })

    const p = plugAt(f)
    if (p.y > -4) {
      const px = Math.round(p.x)
      const py = Math.round(p.y)
      const headTop = py - (p.isIn ? 2 : 3)
      const topX = TARGET[0] + 1
      const pts = new Map<number, [number, number]>()
      for (let i = 0; i <= 60; i++) {
        const t = i / 60
        const bow = Math.sin(t * Math.PI) * (0.8 + (px - topX) * -0.35)
        const x = Math.round(lerp(topX, px, t * t) + bow)
        const y = Math.round(lerp(-2, headTop - 1, t))
        pts.set(y * W + x, [x, y])
      }
      for (const [x, y] of pts.values()) if (!pts.has(y * W + x + 1) && !pts.has(y * W + x + 2)) darken(c, x + 2, y + 1)
      for (const [x, y] of pts.values()) {
        c.set(x, y, ORANGE[3] ?? 0)
        if (!pts.has(y * W + x + 1)) c.set(x + 1, y, ORANGE[2] ?? 0)
        if (!pts.has(y * W + x - 1)) c.set(x - 1, y, ORANGE[4] ?? 0)
      }
      for (let dy = headTop - 1; dy <= (p.isIn ? py + 1 : py - 1); dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const isRidge = (dy - headTop) % 2 === 1
          c.set(px + dx, dy, ALU[dx < 0 ? 8 : dx > 0 ? 3 : isRidge ? 4 : 6] ?? 0)
        }
        darken(c, px + 2, dy + 1)
      }
      if (!p.isIn) c.set(px, py, CREAM[5] ?? 0)
    }

    if (click > 0) {
      const [tx, ty] = TARGET
      const r = f === PLUG_IN ? 3 : 5
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]] as const) {
        c.set(tx + dx * r, ty + dy * r, LED_AMBER[3] ?? 0)
        if (f === PLUG_IN) c.set(tx + dx * (r - 1), ty + dy * (r - 1), LED_AMBER[2] ?? 0)
      }
    }

    out.push(c.px)
  }

  return out
}

const mod = (f: number) => ((f % LOOP) + LOOP) % LOOP

export const scene: Scene = {
  verb: 'Synthesizing',
  render,
  hero: 36,
  snaps: [
    {
      frames: [PLUG_IN, PLUG_OUT + 5],
      box: [SCREEN.x0, SCREEN.y0, SCREEN.x1, SCREEN.y1],
      colors: SCOPE,
      why: 'While the patch is live the scope redraws its trace for each note the sequencer plays, jumping to the new pitch as a scope does.',
    },
    { frames: PLUG_IN, box: [54, 10, 60, 15], colors: LED_AMBER.slice(2, 4), why: 'The click: a spark at the jack as the plug drops home.' },
    { frames: PLUG_IN, box: [56, 0, 60, 8], colors: ORANGE.slice(2, 5), why: 'The click: the cable snaps taut as the plug seats.' },
    { frames: PLUG_OUT, box: [55, 5, 60, 11], colors: [...ORANGE, 0x9098a0, 0x5e6670], why: 'The yank: the plug is pulled out of the jack.' },
  ],
}
