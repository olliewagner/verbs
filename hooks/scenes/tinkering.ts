import { Canvas, PALETTE, TAU, beat, clamp, ease, frames, hex, lerp, mix, mod, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 48

const WALL = hex('0b0912 120f19 1a1522 241c2b 312535 413040')
const MAT = hex('07131a 0b1c24 10262e 15323a 1c4045 244f4f 2f6059 3f7463')
const WOOD = PALETTE.wood
const GOLD = PALETTE.gold
const STEEL = PALETTE.metal
const PLATE = hex('15141f 201f2c 2d2d3c 3d3e4e 525466 6d7182 9196a3')
const BLUED = hex('0f1640 1c2f86 3558c8 7a9ef0')
const RUBY = hex('3a0812 7a1024 c02034 f05468')
const BULB = hex('f6b860 fcdc98 fff6dc')

const CX = 24
const CY = 18.5
const RX = 12.5
const RY = 10
const K = RY / RX
const INNER = 10.8

const pool = (x: number, y: number) => clamp(1 - Math.hypot((x - 22) / 36, (y - 15) / 20)) ** 1.2
const facing = (nx: number, ny: number) => -0.6 * nx - 0.8 * ny

const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

function toSegment(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax
  const vy = by - ay
  const t = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy))
  return Math.hypot(x - ax - vx * t, y - ay - vy * t)
}

type Gear = { u: number; v: number; r: number; teeth: number; dir: number; spokes: number }
const GEARS: Gear[] = [
  { u: -2.5, v: 2, r: 5.6, teeth: 12, dir: 1, spokes: 4 },
  { u: 6, v: -2, r: 3.8, teeth: 8, dir: -1, spokes: 3 },
  { u: 5.2, v: 4.6, r: 2.7, teeth: 6, dir: 1, spokes: 0 },
]
const BALANCE = { u: -4.8, v: -6.2, r: 2.8 }
const SCREWS: readonly (readonly [number, number])[] = [[-8.6, -0.4], [2, -8.4], [-2.4, 8.6], [8.6, 5.4]]
const TICKS = [15, 17, 19, 21, 23, 25, 27, 29, 31]

type GearPart = 'tooth' | 'rim' | 'spoke' | 'hub' | 'hole'

function gearPart(g: Gear, turn: number, u: number, v: number): GearPart | undefined {
  const du = u - g.u
  const dv = v - g.v
  const r = Math.hypot(du, dv)
  if (r > g.r) return undefined
  const th = Math.atan2(dv, du)
  const a = (g.dir * turn * TAU) / g.teeth
  const root = g.r - 1.4
  if (r > root) return Math.cos(g.teeth * (th - a)) > 0 ? 'tooth' : undefined
  if (r < 1.1) return 'hub'
  if (g.spokes === 0 || r > root - 1.1) return 'rim'
  const step = TAU / g.spokes
  const d = mod(th - a, step)
  return Math.min(d, step - d) * r < 0.75 ? 'spoke' : 'hole'
}

type Key = { f: number; x: number; y: number; gap: number; easing?: (t: number) => number }
const REST = { x: 45, y: 27, gap: 2 }
const WORK = { x: 33.4, y: 17.8 }
const TWEEZERS: Key[] = [
  { f: 0, ...REST },
  { f: 3, ...REST },
  { f: 11, x: WORK.x + 0.6, y: WORK.y - 1.4, gap: 2.4 },
  { f: 15, ...WORK, gap: 0.3, easing: t => t * t * (3 - 2 * t) },
  { f: 18, ...WORK, gap: 0.8 },
  { f: 21, ...WORK, gap: 0.8 },
  { f: 27, x: 41, y: 15, gap: 3.2, easing: t => t * t * (3 - 2 * t) },
  { f: 33, x: 41, y: 15.5, gap: 3 },
  { f: 36, x: 41.5, y: 16, gap: 2.6 },
  { f: 48, ...REST },
]

type Tips = { x: number; y: number; gap: number }

function tweezers(f: number): Tips {
  for (let i = 0; i + 1 < TWEEZERS.length; i++) {
    const a = TWEEZERS[i]
    const b = TWEEZERS[i + 1]
    if (!a || !b || f < a.f || f >= b.f) continue
    const t = (b.easing ?? ease.inOut)((f - a.f) / (b.f - a.f))
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), gap: lerp(a.gap, b.gap, t) }
  }
  return REST
}

const HANDLE_DX = 24
const HANDLE_DY = 9

function tweezersAt(t: Tips, x: number, y: number): number | undefined {
  const hx = t.x + HANDLE_DX
  const hy = t.y + HANDLE_DY
  const upper = toSegment(x, y, t.x, t.y - t.gap / 2, hx, hy - 1.2)
  const lower = toSegment(x, y, t.x, t.y + t.gap / 2, hx, hy + 1.2)
  const half = 0.6 + clamp((x - t.x) / HANDLE_DX) * 0.4
  if (upper < half) return STEEL[upper < half * 0.5 ? 7 : 6]
  if (lower < half) return STEEL[3]
  return undefined
}

function tweezerShadow(t: Tips, x: number, y: number): boolean {
  const lift = 1.2 + (27 - t.y) * 0.3
  return toSegment(x, y, t.x + lift * 0.6, t.y + lift, t.x + HANDLE_DX + 8, t.y + HANDLE_DY + 9) < 0.8
}

type Spring = { h: number; len: number; lean: number }

const SPRING_KEYS: readonly (readonly [h: number, len: number, lean: number])[] = [
  [-2, 2, 0], [-1, 3, 0], [0, 4, 0], [0, 4, 0], [0, 2.5, 0], [0, 1.5, 0],
  [0, 11, 0], [2, 11, 1], [4, 11, 1], [6, 9, 1], [7, 8, 0], [8, 7, -1], [8, 7, -1], [8, 7, -1],
  [7, 8, 0], [6, 8, 0], [4, 8, 0], [2, 8, 0],
  [0, 6, 0], [0, 4, 0], [0, 3, 0], [0, 3, 0], [0, 5, 0], [1, 6, 0], [2, 6, 0], [2, 6, 0], [1, 6, 0], [0, 5, 0],
  [0, 3, 0], [-1, 3, 0], [-2, 3, 0], [-3, 3, 0],
]

function spring(f: number): Spring | undefined {
  const k = SPRING_KEYS[f - 15]
  return k && { h: k[0], len: k[1], lean: k[2] }
}

const SPRING_X = Math.round(CX + BALANCE.u)
const SPRING_Y = Math.round(CY + BALANCE.v * K)

type State = { f: number; turn: number; rock: number; tips: Tips; spring: Spring | undefined }

function watchAt(st: State, x: number, y: number, px: number, py: number, isLoupe = false): number | undefined {
  if (!inEllipse(x, y, CX, CY, RX, RY)) return undefined
  const u = x - CX
  const v = (y - CY) / K
  const r = Math.hypot(u, v)
  const lit = pool(x, y)
  const shadow = tweezerShadow(st.tips, x, y) ? 1.5 : 0
  const nx = u / Math.max(0.01, r)
  const ny = v / Math.max(0.01, r)
  if (r > INNER) {
    const outer = r > (RX + INNER) / 2
    const glint = Math.abs(Math.atan2(v, u) + 2.25) < 0.12 ? 2.2 : 0
    return shade(GOLD, 4.4 + lit + (outer ? facing(nx, ny) * 1.8 : -facing(nx, ny) * 1.4) + glint - shadow, px, py)
  }
  if (!inEllipse(x, y, CX, CY + 1.2, INNER, INNER * K)) return shade(GOLD, 1.6 + lit, px, py)
  const wallShadow = !inEllipse(x - 1.4, y - 1.6, CX, CY + 1.2, INNER, INNER * K) ? 1.2 : 0
  const s = st.spring
  const springShadow = s && inEllipse(x, y, SPRING_X + 1 + s.h * 0.35, SPRING_Y + 1 + s.h * 0.08, Math.max(1, 2.2 - s.h * 0.09), Math.max(0.7, 1.4 - s.h * 0.05)) ? 1.4 : 0
  const dark = wallShadow + shadow + springShadow
  const bu = u - BALANCE.u
  const bv = v - BALANCE.v
  const br = Math.hypot(bu, bv)
  if (br < 0.7) return RUBY[3]
  if (br <= BALANCE.r + 0.2) {
    const th = Math.atan2(bv, bu) - st.rock
    if (br > BALANCE.r - 0.9 || Math.abs(Math.sin(th)) * br < 0.55) {
      return shade(GOLD, 4.8 + facing(bu / br, bv / br) * 1.6 - dark, px, py)
    }
  }
  for (const [su, sv] of SCREWS) {
    const du = u - su
    const dv = (v - sv) * K
    const d = Math.hypot(du, dv)
    if (d < 1) return shade(BLUED, Math.abs(du - dv) < 0.3 ? 0.4 : 2.2 + facing(du / Math.max(0.01, d), dv / Math.max(0.01, d)) * 1.4, px, py)
  }
  for (const g of GEARS) {
    const part = gearPart(g, st.turn, u, v)
    if (!part || part === 'hole') continue
    const gx = u - g.u
    const gy = v - g.v
    const gr = Math.max(0.01, Math.hypot(gx, gy))
    if (part === 'hub') return Math.abs(gx) < 0.55 && Math.abs(gy) < 0.7 ? RUBY[2] : shade(GOLD, 5.6 - dark, px, py)
    const edge = part === 'spoke' ? 0 : facing(gx / gr, gy / gr) * 1.4
    return shade(GOLD, (isLoupe ? 5.2 : 4.6) + edge + lit - dark, px, py)
  }
  const castBy = !isLoupe && (GEARS.some(g => gearPart(g, st.turn, u - 1, v - 1.4) !== undefined) || Math.hypot(bu - 1, bv - 1.4) < BALANCE.r)
  const isHole = GEARS.some(g => gearPart(g, st.turn, u, v) === 'hole')
  return shade(PLATE, (isLoupe ? 3.2 : 2.6) + lit * 2.4 - dark - (castBy || isHole ? 1.4 : 0), px, py)
}
function drawRoom(c: Canvas, tips: Tips): void {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const vig = ((x - 24) / 42) ** 2 + ((y - 15) / 30) ** 2
      if (y < 2) {
        c.set(x, y, shade(WALL, 1 + pool(x, y) * 3 - (x % 9 === 4 ? 0.8 : 0) - vig, x, y))
      } else if (y === 2) {
        c.set(x, y, shade(WOOD, 2.4 + pool(x, y) * 3 - vig * 2, x, y))
      } else {
        const shadow =
          inEllipse(x, y, CX + 2.6, CY + 2.6, RX + 0.2, RY + 0.4) ||
          inEllipse(x, y, 9, 19, 4.2, 9.4) ||
          inEllipse(x, y, 55, 28.4, 3.6, 1.1) ||
          toSegment(x, y, 55, 28, 63, 31) < 0.6 ||
          inEllipse(x, y, 59.5, 22, 4.2, 1.5) ||
          tweezerShadow(tips, x, y)
        c.set(x, y, shade(MAT, 1.2 + pool(x, y) * 6.6 - vig * 1.4 - (shadow ? 2.4 : 0), x, y))
      }
    }
  }
  c.ellipse(58, 21, 4, 1.6, (x, y) => shade(STEEL, (y < 21 ? 4.4 : 2.4) + pool(x, y), x, y))
  c.ellipse(58, 21, 2.8, 0.8, (x, y) => shade(STEEL, 1.4, x, y))
  for (const [x, y, col] of [[56, 21, GOLD[5]], [57, 21, GOLD[4]], [59, 21, BLUED[2]], [60, 21, GOLD[6]]] as const) c.set(x, y, col ?? 0)
  c.ellipse(53, 27.4, 3, 1.1, (x, y) => shade(STEEL, y < 27 ? 4 : 1.8, x, y))
  for (let y = 4; y < 27; y++) {
    c.set(52, y, shade(STEEL, 3.8, 52, y))
    c.set(53, y, shade(STEEL, 1.6, 53, y))
  }
  c.rect(52, 3, 2, 2, x => shade(STEEL, x === 52 ? 4.6 : 2.6, x, 0))
}
function drawWatch(c: Canvas, st: State): void {
  c.ellipse(6.6, 17, 4.6, 9.6, (x, y) => {
    const nx = (x - 6.6) / 4.6
    const ny = (y - 17) / 9.6
    if (Math.hypot(nx, ny) > 0.78) return shade(GOLD, 2.6 + facing(nx, ny) * 2.6, x, y)
    const hot = clamp(1 - Math.hypot((x - 5) / 2, (y - 11) / 4.5))
    return shade(GOLD, 1 + hot * 4.6 - facing(nx, ny) * 0.8 + pool(x, y) * 0.6, x, y)
  })
  c.rect(11, 17, 2, 3, (x, y) => shade(GOLD, 3.6 - (y - 17) * 0.8 + (x === 11 ? 0.6 : 0), x, y))
  c.ellipse(CX, 4.6, 3.2, 2.2, (x, y) => (Math.hypot((x - CX) / 3.2, (y - 4.6) / 2.2) > 0.5 ? shade(GOLD, 3 + facing((x - CX) / 3.2, (y - 4.6) / 2.2) * 2.4, x, y) : undefined))
  for (let x = CX - 1; x <= CX + 1; x++) {
    for (let y = 6; y <= 8; y++) c.set(x, y, shade(GOLD, x < CX ? 5.4 : 3.4, x, y))
  }
  for (let y = 7; y < H; y++) {
    for (let x = Math.floor(CX - RX - 1); x <= Math.ceil(CX + RX + 1); x++) {
      const top = watchAt(st, x, y, x, y)
      if (top !== undefined) c.set(x, y, top)
      else if (inEllipse(x, y, CX, CY + 1.8, RX, RY)) {
        const shadow = tweezerShadow(st.tips, x, y) ? 1.5 : 0
        c.set(x, y, shade(GOLD, 2.8 - ((x - CX) / RX) * 1.3 + pool(x, y) - (y > CY + RY + 1 ? 0.9 : 0) - shadow, x, y))
      }
    }
  }
}
function drawTweezers(c: Canvas, t: Tips): void {
  for (let y = Math.floor(t.y - 3); y < H; y++) {
    for (let x = Math.floor(t.x - 1); x < W; x++) {
      const col = tweezersAt(t, x, y)
      if (col !== undefined) c.set(x, y, col)
    }
  }
}
function drawSpring(c: Canvas, f: number, s: Spring | undefined): void {
  if (!s || s.len <= 0.4) return
  const baseY = SPRING_Y - s.h
  const turns = 3.5
  const wire = new Map<number, number>()
  const ring = (p: number, front: boolean) => {
    const y = Math.round(baseY - p * s.len)
    const x = Math.round(SPRING_X + s.lean * p)
    if (y > SPRING_Y) return
    for (let dx = -2; dx <= 2; dx++) {
      wire.set(y * W + x + dx, front ? shade(STEEL, 7.4 - (Math.abs(dx) === 2 ? 2 : 0) - (dx === -1 ? 0.6 : 0)) : (STEEL[2] ?? 0))
    }
  }
  for (let k = 0; k < turns; k++) ring((k + 0.5) / turns, false)
  for (let k = 0; k < turns; k++) ring(k / turns, true)
  for (const key of wire.keys()) {
    for (const d of [1, -1, W, -W]) {
      const n = key + d
      if (!wire.has(n) && Math.abs((n % W) - (key % W)) <= 1 && n < (SPRING_Y + 1) * W) c.set(n % W, Math.floor(n / W), STEEL[0] ?? 0)
    }
  }
  for (const [key, col] of wire) c.set(key % W, Math.floor(key / W), col)
  if (f === 21 || f === 22) {
    const r = f === 21 ? 3 : 4.5
    for (const [ux, uy] of [[1, 0], [-1, 0], [0.7, -0.7], [-0.7, -0.7], [0, -1]] as const) {
      c.set(SPRING_X + ux * r, SPRING_Y - 1 + uy * r * 0.8, f === 21 ? (BULB[2] ?? 0) : (BULB[0] ?? 0))
    }
  }
}
const LX = 33
const LY = 17.5
const LR = 6.2
function drawLoupe(c: Canvas, st: State): void {
  for (let y = Math.floor(LY - LR - 1.2); y <= Math.ceil(LY + LR + 1.2); y++) {
    for (let x = Math.floor(LX - LR - 1.2); x <= Math.ceil(LX + LR + 1.2); x++) {
      const dx = x - LX
      const dy = y - LY
      const d = Math.hypot(dx, dy)
      if (d < LR) {
        const sx = LX + dx / 2
        const sy = LY + dy / 2
        let col = tweezersAt(st.tips, sx, sy) ?? watchAt(st, sx, sy, x, y, true) ?? shade(MAT, 1.2 + pool(sx, sy) * 6.6, x, y)
        const a = Math.atan2(dy, dx)
        if (d > LR - 1) col = mix(col, 0x0c0a08, 0.45)
        else if (d > LR - 2.1 && a > -2.7 && a < -1.8) col = mix(col, 0xfff8ea, 0.6)
        else col = mix(col, 0xfff4e0, 0.12)
        c.set(x, y, col)
      } else if (d < LR + 1.6) {
        const lit = facing(dx / d, dy / d)
        c.set(x, y, shade(STEEL, d < LR + 0.8 ? 2.2 + lit * 4.4 : 0.4 + lit * 1.2, x, y))
      }
    }
  }
  c.line(LX + 5, LY - 6, 51, 4, STEEL[5] ?? 0)
  c.line(LX + 6, LY - 5, 51, 5, STEEL[2] ?? 0)
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const running = clamp((f - 15) / 2) * clamp((34 - f) / 3)
    const st: State = {
      f,
      turn: TICKS.filter(t => t <= f).length / 3,
      rock: running * 1.5 * Math.sin(((f - 15) / 4) * TAU),
      tips: tweezers(f),
      spring: spring(f),
    }
    drawRoom(c, st.tips)
    drawWatch(c, st)
    drawTweezers(c, st.tips)
    drawLoupe(c, st)
    drawSpring(c, f, st.spring)
  })
}
export const scene: Scene = {
  verb: 'Tinkering',
  render,
  hero: 25,
  snaps: [{ frames: 21, box: [16, 0, 22, 15], colors: STEEL, why: 'The boing: the squashed hairspring springs to full stretch in one frame.' }],
}