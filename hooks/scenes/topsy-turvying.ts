import { Canvas, PALETTE, clamp, frames, hash, hex, lerp, lightAt, mix, shade, type Ramp, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96
const CX = 32
const CY = 16

const NIGHT = PALETTE.night
const FRAME = hex('0e080c 1a0f14 2a1a1c 3e2826 563a30')
const PAPER = hex('1c0e18 2a1420 3e1c2a 58283a 74364a 92485a b0606c cc8484')
const WOOD = PALETTE.wood
const VELVET = hex('081a1e 0e2a30 163e44 1f5658 2c7270 46908a 6cb0a4')
const LEAF = PALETTE.leaf
const POT = hex('3a1a10 6a2e18 a04a26 c8683a')
const RUG = hex('140c2e 22164e 34247a 2a0a14 5a1420 8a2430 d8a040')
const FUR = hex('3a1606 6a2c0c a04a14 d07428 eea050 f8cc88')
const BRASS = PALETTE.gold
const GLOW = hex('f6b860 fcdc98 fff6dc')
const CANVAS = hex('2f5e9e 72ade6 46852f 98c24a')

const TURN_OVER = [12, 43] as const
const TURN_BACK = [56, 88] as const

function rimAt(a: number): number {
  const c = Math.cos(a)
  const s = Math.sin(a)
  let far = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - CX
      const dy = y + 0.5 - CY
      if (Math.abs(dx * c + dy * s) < W / 2 && Math.abs(-dx * s + dy * c) < H / 2) far = Math.max(far, Math.hypot(dx, dy))
    }
  }
  return far
}

const A0 = -0.4
const DA = 0.004
const RIM: number[] = (() => {
  const out = [0]
  for (let a = A0; a < Math.PI + 0.2; a += DA) out.push((out[out.length - 1] ?? 0) + rimAt(a + DA / 2) * DA)
  return out
})()
function rimTravel(a: number): number {
  const u = (a - A0) / DA
  const i = clamp(Math.floor(u), 0, RIM.length - 2)
  const s0 = RIM[i] ?? 0
  return s0 + ((RIM[i + 1] ?? s0) - s0) * (u - i)
}
function angleAtTravel(s: number): number {
  let lo = 0
  let hi = RIM.length - 1
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1
    if ((RIM[m] ?? 0) <= s) lo = m
    else hi = m
  }
  const s0 = RIM[lo] ?? 0
  const s1 = RIM[hi] ?? s0
  return A0 + DA * (lo + (s1 > s0 ? (s - s0) / (s1 - s0) : 0))
}

const RAMP = 0.3

function cruise(t: number): number {
  const into = (u: number) => (u - (RAMP / Math.PI) * Math.sin((Math.PI * u) / RAMP)) / 2
  const u = clamp(t)
  const total = 1 - RAMP
  if (u < RAMP) return into(u) / total
  if (u <= 1 - RAMP) return (RAMP / 2 + (u - RAMP)) / total
  return 1 - into(1 - u) / total
}
const sine = (t: number): number => (1 - Math.cos(Math.PI * clamp(t))) / 2

function turn(f: number, [f0, f1]: readonly [number, number], a: number, b: number): number {
  const s0 = rimTravel(a)
  return angleAtTravel(s0 + (rimTravel(b) - s0) * cruise((f - f0) / (f1 - f0)))
}

function angle(f: number): number {
  const PI = Math.PI
  if (f < 6) return 0
  if (f < TURN_OVER[0]) return -0.1 * sine((f - 6) / (TURN_OVER[0] - 6))
  if (f < TURN_OVER[1]) return turn(f, TURN_OVER, -0.1, PI + 0.06)
  if (f < 45) return PI + 0.06
  if (f < 51) return PI + 0.06 - 0.06 * sine((f - 45) / 6)
  if (f < TURN_BACK[0]) return PI
  if (f < TURN_BACK[1]) return turn(f, TURN_BACK, PI, -0.2)
  if (f < 94) return -0.2 + 0.2 * sine((f - 88) / 6)
  return 0
}

type P = readonly [number, number]

function toRoom(sx: number, sy: number, a: number): P {
  const dx = sx - CX
  const dy = sy - CY
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [CX + dx * c + dy * s, CY - dx * s + dy * c]
}
function toScreen(rx: number, ry: number, a: number): P {
  const dx = rx - CX
  const dy = ry - CY
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [CX + dx * c - dy * s, CY + dx * s + dy * c]
}

function shearTurn(u: number, v: number, t: number): P {
  let x = u
  let y = v
  let r = t
  if (Math.abs(r) > Math.PI / 2) {
    x = -x
    y = -y
    r -= Math.sign(r) * Math.PI
  }
  const k = -Math.tan(r / 2)
  x += Math.round(k * y)
  y += Math.round(Math.sin(r) * x)
  x += Math.round(k * y)
  return [x, y]
}
function roomPixel(x: number, y: number, a: number): P {
  const [u, v] = shearTurn(x + 0.5 - CX, y + 0.5 - CY, -a)
  return [CX + u, CY + v]
}
const FLOOR = 27
const WINDOW = { x0: 5, y0: 6, x1: 15, y1: 16 }
const RUG_X0 = 14
const RUG_X1 = 37
function sky(x: number, y: number): number {
  const moon = Math.hypot(x - 10.5, y - 10)
  if (moon < 2.6) return shade(GLOW, moon < 1.4 ? 2 : 1, x, y)
  if (moon < 3.6) return NIGHT[4] ?? 0
  const isStar = hash(x, y, 7) < 0.02
  return isStar ? (hash(x, y, 9) < 0.5 ? (NIGHT[6] ?? 0) : 0xdfe6ff) : shade(NIGHT, 1.2 + (32 - y) * 0.04 + (moon < 8 ? 0.8 : 0), x, y)
}
type Surface = { ramp: Ramp; level: number } | 'outside'
function roomAt(rx: number, ry: number): Surface | undefined {
  const x = Math.floor(rx)
  const y = Math.floor(ry)
  if (x < 0 || x >= W || y < 0 || y >= H) return undefined
  if (x < 2 || x >= 62 || y < 2 || y >= 30) return { ramp: FRAME, level: (x + y) % 5 === 0 ? 1 : 2 }
  if (y >= FLOOR) return { ramp: WOOD, level: y === FLOOR ? 4 : (x + (y % 2) * 4) % 9 === 0 ? 1.4 : 2.6 }
  if (y === 2) return { ramp: WOOD, level: 3 }
  if (x >= WINDOW.x0 && x < WINDOW.x1 && y >= WINDOW.y0 && y < WINDOW.y1) {
    const isEdge = x === WINDOW.x0 || x === WINDOW.x1 - 1 || y === WINDOW.y0 || y === WINDOW.y1 - 1
    const isBar = x === (WINDOW.x0 + WINDOW.x1 - 1) / 2 || y === Math.floor((WINDOW.y0 + WINDOW.y1) / 2)
    return isEdge ? { ramp: WOOD, level: y === WINDOW.y1 - 1 ? 4.4 : 3.2 } : isBar ? { ramp: WOOD, level: 2.6 } : 'outside'
  }
  if (y === 19) return { ramp: WOOD, level: 4 }
  if (y > 19) return { ramp: PAPER, level: x % 6 === 0 ? 1.4 : 2.2 }
  return { ramp: PAPER, level: x % 4 < 2 ? 3 : 2.5 }
}
function rugAt(rx: number, ry: number): number | undefined {
  const x = Math.floor(rx)
  if (Math.floor(ry) !== FLOOR - 1 || x < RUG_X0 || x >= RUG_X1) return undefined
  const isFringe = x === RUG_X0 || x === RUG_X1 - 1
  return isFringe ? 6 : (x - RUG_X0) % 5 === 2 ? 6 : x - RUG_X0 < 2 || RUG_X1 - x < 3 ? 4 : 2
}
type Part = readonly [Ramp, number]
const CHAIR = [
  '..oooooooo..',
  '.ohhhhhhhho.',
  '.ohaaaaaado.',
  'oooaaaaaaooo',
  'ohhoooooohho',
  'ohahhhhhhaho',
  'odaaaaaaaado',
  'oooooooooooo',
  '.l........l.',
]
const CHAIR_PARTS: Record<string, Part> = { o: [VELVET, 1], h: [VELVET, 4.4], a: [VELVET, 3.2], d: [VELVET, 2], l: [WOOD, 2] }
const TABLE = [
  '..g.G..',
  '.gGgGg.',
  'gGgggGg',
  '.ggGgg.',
  '..ppp..',
  '..PPP..',
  'ttttttt',
  'oTTTTTo',
  '.l...l.',
  '.l...l.',
  '.l...l.',
]
const TABLE_PARTS: Record<string, Part> = {
  g: [LEAF, 2.6], G: [LEAF, 4.2], p: [POT, 3], P: [POT, 2], t: [WOOD, 5], T: [WOOD, 3.4], o: [WOOD, 1.6], l: [WOOD, 2.4],
}
const LOAF = [
  '.k.k......',
  'kckck.kkk.',
  'kcccckccck',
  'kecccchcck',
  'kwcccccck.',
  '.kwwkkkk..',
]
const ALARM = [
  'k.k.......',
  'ckck..kkk.',
  'cccckkccck',
  'EpcEccchck',
  'cwcccccckk',
  'kwkwkkwkw.',
]
const CAT_PARTS: Record<string, Part> = {
  k: [FUR, 0.6], c: [FUR, 3], h: [FUR, 4.2], w: [FUR, 5], e: [FUR, 1], E: [hex('c8e050 c8e050'), 1], p: [FUR, 0],
}
const HANGING = [
  '.w...w.',
  '.c...c.',
  '.c...c.',
  'kckkkck',
  'kcEcEck',
  'kccwcck',
  '.kcccck',
  '.ccccc.',
  '.chcccc',
  '.ccccc.',
  '.ccccc.',
  '.cc.cc.',
  '.w...w.',
]
type How = 'fall' | 'slide'
type Key = readonly [f: number, x: number, y: number, how?: How]
const CHAIR_KEYS: Key[] = [
  [0, 44, 26], [19, 44, 26, 'fall'], [24, 50.5, 26], [29, 50.5, 26, 'fall'], [38, 50.5, 11],
  [72, 50.5, 11, 'fall'], [81, 50.5, 26], [85, 50.5, 26, 'slide'], [91, 44, 26], [96, 44, 26],
]
const TABLE_KEYS: Key[] = [
  [0, 57, 26], [17, 57, 26, 'fall'], [21, 58, 26], [28, 58, 26, 'fall'], [37, 58, 13],
  [71, 58, 13, 'fall'], [80, 58, 26], [85, 58, 26, 'slide'], [89, 57, 26], [96, 57, 26],
]
const CHAIR_LANDS = [38, 81] as const
const TABLE_LANDS = [37, 80] as const
const DROP = 0.4
function drop(u: number): number {
  const v = clamp(u)
  const into = v < DROP ? (v - (DROP / Math.PI) * Math.sin((Math.PI * v) / DROP)) / 2 : DROP / 2 + (v - DROP)
  return into / (1 - DROP / 2)
}
function keyed(keys: Key[], f: number): P {
  for (let i = 0; i + 1 < keys.length; i++) {
    const a = keys[i]
    const b = keys[i + 1]
    if (!a || !b || f < a[0] || f >= b[0]) continue
    const u = clamp((f - a[0]) / (b[0] - a[0]))
    const t = a[3] === 'fall' ? drop(u) : a[3] === 'slide' ? sine(u) : 0
    return [lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
  }
  const last = keys[0]
  return last ? [last[1], last[2]] : [0, 0]
}
const LAMP_ANCHOR: P = [31, 3]
const LAMP_CHAIN = 8
const NAIL: P = [43, 7]
const PICTURE_DROP = 3
const CLAWS: P = [22, 26]
const CAT_DROP = 6
const CAT_SLIP = [1.0, 2.2] as const
type Swing = { lamp: P; picture: P; cat: P }
const SWINGS: Swing[] = (() => {
  const out: Swing[] = []
  const bodies = [
    { anchor: LAMP_ANCHOR, len: LAMP_CHAIN, isRope: true, damp: 0.95 },
    { anchor: NAIL, len: PICTURE_DROP, isRope: false, damp: 0.95 },
    { anchor: CLAWS, len: CAT_DROP, isRope: false, damp: 0.88 },
  ]
  const pos = bodies.map(b => toScreen(b.anchor[0], b.anchor[1] + b.len, 0) as [number, number])
  const prev = pos.map(p => [p[0], p[1]] as [number, number])
  for (let n = 0; n < LOOP * 3; n++) {
    const f = n % LOOP
    const a = angle(f)
    const swing: P[] = []
    bodies.forEach((b, i) => {
      const p = pos[i] ?? [0, 0]
      const q = prev[i] ?? [0, 0]
      for (let sub = 0; sub < 4; sub++) {
        const sa = lerp(angle(mod1(f - 1)), a, (sub + 1) / 4)
        const vx = (p[0] - q[0]) * b.damp
        const vy = (p[1] - q[1]) * b.damp
        q[0] = p[0]
        q[1] = p[1]
        p[0] += vx
        p[1] += vy + 0.09
        const [ax, ay] = toScreen(b.anchor[0], b.anchor[1], sa)
        const d = Math.hypot(p[0] - ax, p[1] - ay)
        if (d > b.len || !b.isRope) {
          p[0] = ax + ((p[0] - ax) / Math.max(0.001, d)) * b.len
          p[1] = ay + ((p[1] - ay) / Math.max(0.001, d)) * b.len
        }
        if (b.isRope) {
          const [rx, ry] = toRoom(p[0], p[1], sa)
          if (ry < 4.5) {
            const [nx, ny] = toScreen(rx, 4.5, sa)
            p[0] = nx
            p[1] = ny
            q[0] = lerp(q[0], p[0], 0.5)
            q[1] = lerp(q[1], p[1], 0.5)
          }
        }
      }
      swing.push([p[0], p[1]])
    })
    if (n >= LOOP * 2) out.push({ lamp: swing[0] ?? [0, 0], picture: swing[1] ?? [0, 0], cat: swing[2] ?? [0, 0] })
  }
  return out
})()
function mod1(f: number): number {
  return ((f % LOOP) + LOOP) % LOOP
}
function roomSprite(c: Canvas, art: readonly string[], parts: Record<string, Part>, ox: number, oy: number, a: number, lit: (x: number, y: number) => number): void {
  const w = art[0]?.length ?? 0
  const h = art.length
  const corners = [toScreen(ox, oy, a), toScreen(ox + w, oy, a), toScreen(ox, oy + h, a), toScreen(ox + w, oy + h, a)]
  const xs = corners.map(p => p[0])
  const ys = corners.map(p => p[1])
  for (let y = Math.floor(Math.min(...ys)) - 1; y <= Math.ceil(Math.max(...ys)); y++) {
    for (let x = Math.floor(Math.min(...xs)) - 1; x <= Math.ceil(Math.max(...xs)); x++) {
      const [rx, ry] = roomPixel(x, y, a)
      const part = parts[art[Math.floor(ry - oy)]?.[Math.floor(rx - ox)] ?? '.']
      if (part) c.set(x, y, shade(part[0], part[1] + lit(x, y), x, y))
    }
  }
}
function hungSprite(c: Canvas, art: readonly string[], parts: Record<string, Part>, hx: number, hy: number, a: number, lit: (x: number, y: number) => number, stretch = 1): void {
  const w = art[0]?.length ?? 0
  const h = art.length
  const ax = Math.round(hx)
  const ay = Math.round(hy)
  for (let y = ay - h - 2; y <= ay + h + 2; y++) {
    for (let x = ax - h - 2; x <= ax + h + 2; x++) {
      const [u, v] = shearTurn(x + 0.5 - ax, y + 0.5 - ay, -a)
      const lx = u + w / 2
      const ly = v / stretch
      const part = parts[art[Math.floor(ly)]?.[Math.floor(lx)] ?? '.']
      if (part) c.set(x, y, shade(part[0], part[1] + lit(x, y), x, y))
    }
  }
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const a = angle(f)
    const sw = SWINGS[f] ?? { lamp: [0, 0], picture: [0, 0], cat: [0, 0] }
    const [lx, ly] = sw.lamp
    const light = (x: number, y: number) => lightAt([{ x: lx, y: ly + 1, power: 1.25, radius: 38 }], x, y)
    const lit = (x: number, y: number) => light(x, y) * 3.2 - 0.6
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const [rx, ry] = roomPixel(x, y, a)
        const s = roomAt(rx, ry)
        const band = rugAt(rx, ry)
        if (band !== undefined) c.set(x, y, shade(RUG, band + (band === 6 ? 0 : lit(x, y) * 0.3), x, y))
        else if (s === undefined || s === 'outside') c.set(x, y, sky(x, y))
        else c.set(x, y, shade(s.ramp, s.level + lit(x, y), x, y))
      }
    }
    {
      const [nx, ny] = toScreen(NAIL[0] + 0.5, NAIL[1] + 0.5, a)
      const [px, py] = sw.picture
      const tilt = Math.atan2(-(px - nx), py - ny)
      const art = ['FFFFFFF', 'FsssssF', 'FsshssF', 'FgggggF', 'FGGGGGF', 'FFFFFFF']
      const parts: Record<string, Part> = { F: [BRASS, 3], s: [CANVAS, 0.6], h: [CANVAS, 1.6], g: [CANVAS, 2.4], G: [CANVAS, 3] }
      for (let y = Math.floor(ny - 2); y <= Math.ceil(ny + 2); y++) {
        for (let x = Math.floor(nx - 2); x <= Math.ceil(nx + 2); x++) {
          const d = Math.hypot(x + 0.5 - nx, y + 0.5 - ny)
          const along = ((x + 0.5 - nx) * (px - nx) + (y + 0.5 - ny) * (py - ny)) / PICTURE_DROP
          const off = Math.abs(((x + 0.5 - nx) * (py - ny) - (y + 0.5 - ny) * (px - nx)) / PICTURE_DROP)
          if (d < 2.6 && along > 0 && along < PICTURE_DROP && off < 1.6 && Math.abs(off - along * 0.5) < 0.7) c.set(x, y, shade(BRASS, 2, x, y))
        }
      }
      hungSprite(c, art, parts, px, py, tilt, (x, y) => lit(x, y) * 0.8)
      c.set(nx - 0.5, ny - 0.5, BRASS[6] ?? 0)
    }
    const [tx, ty] = keyed(TABLE_KEYS, f)
    roomSprite(c, TABLE, TABLE_PARTS, tx - 3.5, ty - TABLE.length + 1, a, lit)
    const [chx, chy] = keyed(CHAIR_KEYS, f)
    roomSprite(c, CHAIR, CHAIR_PARTS, chx - 6, chy - CHAIR.length + 1, a, lit)
    const hang = sine((Math.abs(a) - CAT_SLIP[0]) / (CAT_SLIP[1] - CAT_SLIP[0]))
    if (hang > 0) {
      const [ax, ay] = toScreen(CLAWS[0] + 0.5, CLAWS[1] + 0.5, a)
      const [bx, by] = sw.cat
      const swing = clamp(Math.atan2(-(bx - ax), by - ay), -0.7, 0.7)
      const [fx, fy] = toScreen(CLAWS[0] + 0.5, CLAWS[1] - 3, a)
      const hx = lerp(fx, ax, hang)
      const hy = lerp(fy, ay - 0.5, hang)
      const tilt = lerp(Math.abs(a) - Math.PI / 2, swing, hang)
      const stretch = lerp((LOAF[0]?.length ?? 10) / HANGING.length, 1, hang)
      hungSprite(c, HANGING, CAT_PARTS, hx, hy, tilt, lit, stretch)
      let last: P = [hx + 1.5 - Math.sin(tilt) * 12 * stretch, hy + 0.5 + Math.cos(tilt) * 12 * stretch]
      for (let k = 1; k <= Math.round(5 * hang); k++) {
        const sway = Math.sin(f * 0.45 - k * 0.6) * k * 0.45
        const next: P = [hx + 1.5 - Math.sin(tilt) * (12 * stretch + k) + sway, hy + 0.5 + Math.cos(tilt) * (12 * stretch + k)]
        c.line(last[0], last[1], next[0], next[1], shade(FUR, k === 5 ? 5 : 3, 0, 0))
        last = next
      }
    } else {
      const isAwake = f >= 8 && f < 92
      roomSprite(c, isAwake ? ALARM : LOAF, CAT_PARTS, CLAWS[0] + 2, FLOOR - 1 - LOAF.length, a, lit)
    }
    {
      const [ax, ay] = toScreen(LAMP_ANCHOR[0] + 0.5, LAMP_ANCHOR[1] + 0.5, a)
      const dx = lx - ax
      const dy = ly - ay
      const d = Math.max(0.01, Math.hypot(dx, dy))
      const sag = Math.max(0, LAMP_CHAIN - d) * 0.8
      const nearest = new Map<number, { gap: number; colour: number }>()
      const samples = LAMP_CHAIN * 8
      for (let k = 0; k <= samples; k++) {
        const t = k / samples
        const x = lerp(ax, lx, t) + Math.sin(t * Math.PI) * sag * 0.6
        const y = lerp(ay, ly, t) + Math.sin(t * Math.PI) * sag
        const px = Math.floor(x)
        const py = Math.floor(y)
        const gap = Math.hypot(x - px - 0.5, y - py - 0.5)
        if (px < 0 || px >= W || py < 0 || py >= H) continue
        const kept = nearest.get(py * W + px)
        if (!kept || gap < kept.gap) nearest.set(py * W + px, { gap, colour: Math.floor(t * LAMP_CHAIN) % 2 ? (FRAME[1] ?? 0) : (BRASS[2] ?? 0) })
      }
      for (const [i, { colour }] of nearest) c.set(i % W, Math.floor(i / W), colour)
      const ux = dx / d
      const uy = dy / d
      for (let y = Math.floor(ly - 4); y <= Math.ceil(ly + 4); y++) {
        for (let x = Math.floor(lx - 4); x <= Math.ceil(lx + 4); x++) {
          const qx = x + 0.5 - lx
          const qy = y + 0.5 - ly
          const along = qx * ux + qy * uy
          const across = Math.abs(qx * uy - qy * ux)
          if (along > -1.6 && along < 0.6 && across < 1.2 + (along + 1.6) * 0.9) c.set(x, y, shade(BRASS, 3.4 + (along < -0.6 ? 1 : 0) + light(x, y) * 1.2 - 0.6, x, y))
          else if (along >= 0.6 && along < 1.8 && across < 1.4) c.set(x, y, shade(GLOW, 2 - across, x, y))
        }
      }
      for (let y = Math.floor(ly - 6); y <= Math.ceil(ly + 7); y++) {
        for (let x = Math.floor(lx - 7); x <= Math.ceil(lx + 7); x++) {
          const g = Math.hypot(x + 0.5 - lx - ux * 1.5, y + 0.5 - ly - uy * 1.5)
          if (g > 2 && g < 4.5) c.tint(x, y, GLOW[1] ?? 0, 0.14)
        }
      }
    }
    for (const [f0, rx, ry] of [[CHAIR_LANDS[0], 50.5, 3], [CHAIR_LANDS[1], 50.5, 26.5], [TABLE_LANDS[0], 58, 3], [TABLE_LANDS[1], 58, 26.5]] as const) {
      if (f < f0 || f > f0 + 4) continue
      const t = (f - f0) / 4
      for (const side of [-1, 1]) {
        const [sx, sy] = toScreen(rx + side * (5 + t * 4), ry - t * 2 * (ry < 10 ? -1 : 1), a)
        c.set(sx, sy, mix(c.get(sx, sy), 0xd8c8b0, 0.6 * (1 - t)))
      }
    }
  })
}
export const scene: Scene = {
  verb: 'Topsy-turvying',
  render,
  hero: 54,
  snaps: [
    { frames: 27, box: [38, 15, 46, 21], why: 'at the top speed of the turn the lamp is swept round two to three pixels a frame' },
    { frames: 37, box: [53, 3, 60, 8], why: "as the turn slows, the floor's far end still sweeps past about three pixels a frame" },
  ],
}
