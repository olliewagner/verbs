import { Canvas, clamp, frames, hash, hex, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72
const ON = 46
const OFF = 64

const FENCE = hex('08090f 10121f 191c2e 242a40 3a384a 5e4c48 87664a b2884e d8ae64 f0d08a')
const GROUND = hex('07080d 0e1119 171b27 222837 363846 524c4c 76665a 9c8466 c4a676')
const CAN = hex('080a12 121826 1e283a 2c3a50 445268 64707e 8c8e90 b8b0a0 e2d6b8 fff4d8')
const FUR = hex('07070c 121219 1d1d27 2c2b38 413e4c 5c5662 7c7480 a29aa0')
const PALE = hex('2c2e40 4a4e64 767a90 aeb0bc dedcd8 fff8ec')
const SKY = hex('04050c 080b18 0d1124')
const DOOR = hex('0a0a12 1a1320 2e1e26 5a3430 8a4e36 c07848')
const GLOW = hex('1a1a22 3a3428 fff0b0 fffce8')
const EYE_DIM = 0x6a9a4a
const EYE_LIT = 0xf2ffc0
const BONE = hex('6a6a74 b4b0a8 ece6d6')
const BANANA = hex('6a4a10 c89a20 f4d84a')
const RED = hex('4a1418 9a2a28 d44a3a')
const LAMP_X = 5
const LAMP_Y = 4

const RIM_Y = 16
const CAN_X = 31
const BASE_Y = 28
const B_Y = 20

const RACCOON = [
  '.ae.....ea.',
  'aagggggggaa',
  'agwwgggwwga',
  'gKKoKgKoKKg',
  'aKKKwgwKKKa',
  '.gKwwwwwKg.',
  '..gwwnwwg..',
  '...gwwwg...',
]
const FUR_LEVEL: Record<string, number> = { a: 1, g: 2.8, e: 4.2, K: 0, n: 0 }

type Item = readonly string[]
const ITEMS: Item[] = [
  ['.r.r.t', 'hsssss', '.r.r.t'],
  ['MMM', 'mRm', 'mRm', 'MMM'],
  ['.s.', 'rRr', '.c.', 'rRr'],
  ['Y.y.Y', '.YyY.', '..Y..'],
]
const ITEM_PAINT: Record<string, number> = {
  h: BONE[2] ?? 0, s: BONE[1] ?? 0, r: BONE[1] ?? 0, t: BONE[2] ?? 0, M: CAN[6] ?? 0, m: CAN[4] ?? 0,
  R: RED[2] ?? 0, c: PALE[4] ?? 0, Y: BANANA[2] ?? 0, y: BANANA[1] ?? 0,
}
const itemPaint = (ch: string, porch: number) => (porch > 0 ? ITEM_PAINT[ch] : ch in ITEM_PAINT ? PALE['htMcY'.includes(ch) ? 3 : 1] : undefined)
const rot = (art: Item, turns: number): Item => {
  let a = art
  for (let k = 0; k < turns % 4; k++) {
    const rows = a.length
    const cols = a[0]?.length ?? 0
    a = Array.from({ length: cols }, (_, i) => Array.from({ length: rows }, (_, j) => a[rows - 1 - j]?.[i] ?? '.').join(''))
  }
  return a
}

type Act = { top: number; look: number; holds?: number; letGo?: boolean; lid: number; tilt: number; sway: number }
const THROWS = [[22, 0], [29, 1], [36, 2]] as const
function actAt(f: number): Act {
  const shut: Act = { top: 99, look: 0, lid: RIM_Y - 1, tilt: 0, sway: 0 }
  if (f < 4) return shut
  if (f < 8) return { ...shut, lid: RIM_Y - 1 - (f === 4 || f === 6 ? 1 : 0) }
  if (f < 10) return { ...shut, lid: RIM_Y - 2, tilt: f === 9 ? -0.6 : 0 }
  if (f < 14) return { ...shut, lid: RIM_Y - 3 }
  if (f === 14) return { top: 12, look: 0, lid: 10.5, tilt: 0.3, sway: 0 }
  if (f === 15) return { top: 9, look: 0, lid: 7.5, tilt: -0.6, sway: 0 }
  if (f < 22) return { top: 7, look: f < 18 ? -1 : f < 20 ? 1 : 0, lid: 5.5, tilt: -0.8, sway: 0 }
  if (f >= 42 && f < 46) {
    const top = [9, 11, 12, 9][f - 42] ?? 7
    return { top, look: 0, ...(f > 43 ? { holds: 3 } : {}), lid: top - 1.5, tilt: f === 45 ? -0.6 : -0.3, sway: 0 }
  }
  for (const [start, item] of THROWS) {
    const d = f - start
    if (d < 0 || d >= 7) continue
    const top = [9, 11, 12, 9, 7, 7, 8][d] ?? 7
    const tilt = [-0.5, -0.3, -0.2, -0.6, -1, -0.8, -0.7][d] ?? -0.8
    const held = d >= 2 && d <= 4 ? { holds: item, letGo: d === 4 } : {}
    return { top, look: d === 4 ? 1 : 0, ...held, lid: top - 1.5, tilt, sway: d >= 5 ? 1 : 0 }
  }
  if (f < 56) {
    const look = f >= 50 && f < 54 ? -1 : 0
    return { top: 7, look, holds: 3, lid: 5.5, tilt: -0.8, sway: 0 }
  }
  if (f === 56) return { top: 13, look: 0, lid: 9, tilt: -0.4, sway: 0 }
  if (f === 57) return { ...shut, tilt: 1 }
  if (f === 58) return { ...shut, tilt: -0.7 }

  return shut
}

function peekAt(f: number): { x: number; eyesOnly: boolean } | undefined {
  if (f >= 28 && f < 34) return { x: CAN_X + 5, eyesOnly: true }
  if (f >= 34 && f < 56) return { x: CAN_X + (f === 34 ? 7 : 9), eyesOnly: false }
  if (f === 56) return { x: CAN_X + 6, eyesOnly: false }
  if (f >= 66 && f < 70 && f !== 68) return { x: CAN_X + 5, eyesOnly: true }
  return undefined
}

function porchAt(f: number): number {
  if (f < ON || f > OFF) return 0
  if (f === OFF) return 0.12
  return f === ON ? 1.4 : f === ON + 1 ? 0.5 : 1
}

const canHalf = (y: number) => 6.4 + (BASE_Y - y) * 0.06
const fenceTop = (x: number) => 3 + Math.abs(((x - 16) % 5) - 2) * 0.5

function draw(c: Canvas, f: number): void {
  const porch = porchAt(f)
  const act = actAt(f)
  const peek = peekAt(f)
  const lamp = (x: number, y: number) => porch * clamp(1 - Math.hypot(x - LAMP_X, (y - LAMP_Y) * 1.2) / 100) ** 1.1

  const block = new Set<number>()
  const occlude = (x: number, y: number) => {
    if (x >= 0 && x < W && y >= 0 && y < H) block.add(y * W + Math.round(x))
  }
  for (let y = RIM_Y; y <= BASE_Y; y++) for (let x = Math.ceil(CAN_X - canHalf(y)); x <= Math.floor(CAN_X + canHalf(y)); x++) occlude(x, y)
  const lidX = CAN_X + (act.top < 99 ? act.sway : 0)
  for (let x = lidX - 7; x <= lidX + 7; x++) {
    const shift = Math.round((act.tilt * (x - lidX)) / 7)
    for (let y = Math.round(act.lid) - 2; y <= Math.round(act.lid) + 1; y++) occlude(x, y + shift)
  }
  if (act.top < 99) {
    RACCOON.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (row[i] !== '.' && act.top + j < RIM_Y + 1) occlude(CAN_X - 5 + act.sway + i, act.top + j)
    })
    if (act.holds !== undefined) {
      const ax = CAN_X + 6 + act.sway
      const art = ITEMS[act.holds] ?? []
      for (let y = act.top - art.length + 1; y <= act.top + 3; y++) occlude(ax, y)
      art.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) if (row[i] !== '.') occlude(ax - Math.floor(row.length / 2) + i, act.top + 1 - art.length + j)
      })
    }
  }
  const isShadowed = (x: number, y: number) => {
    if (porch === 0) return false
    const d = Math.hypot(x - LAMP_X, y - LAMP_Y)
    for (let k = 1; k < d - 1; k++) {
      const t = k / d
      if (block.has(Math.round(LAMP_Y + (y - LAMP_Y) * t) * W + Math.round(LAMP_X + (x - LAMP_X) * t))) return true
    }
    return false
  }
  const hx = CAN_X + act.sway
  const isFigure = (u: number, v: number) => {
    if (v >= RIM_Y - 0.5 && v <= BASE_Y && Math.abs(u - CAN_X) <= canHalf(v)) return true
    const dx = u - lidX
    const brim = act.lid + (act.tilt * dx) / 7
    if (Math.abs(dx) <= 7.5 && Math.abs(v - brim) <= 0.8) return true
    if (((dx / 5.4) ** 2 + ((v - brim + 0.4) / 2.1) ** 2 <= 1 && v <= brim) || (Math.abs(dx) <= 1.1 && v >= brim - 3.2 && v <= brim)) return true
    if (act.top >= 99) return false
    const hy = act.top + 3.8
    if (((u - hx) / 5.2) ** 2 + ((v - hy) / 3.9) ** 2 <= 1) return true
    if (Math.abs(u - hx) <= 3.4 && v >= hy && v <= RIM_Y) return true
    if (Math.hypot(u - hx + 3.8, v - act.top + 0.1) <= 1.4 || Math.hypot(u - hx - 3.8, v - act.top + 0.1) <= 1.4) return true
    if (act.holds !== undefined) {
      const [ax, ay, bx, by] = [hx + 4, act.top + 5, hx + 6, act.top - 1]
      const t = clamp(((u - ax) * (bx - ax) + (v - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2))
      if (Math.hypot(u - ax - (bx - ax) * t, v - ay - (by - ay) * t) <= 0.9) return true
      if (Math.hypot(u - hx - 6, (v - act.top + 2.6) * 1.3) <= 1.7) return true
    }
    return false
  }
  const isOnFence = (x: number, y: number) => porch > 0 && isFigure(LAMP_X + (x - LAMP_X) / 1.6, LAMP_Y + (y - LAMP_Y) / 1.6)

  for (let y = 0; y < 5; y++) for (let x = 16; x < W; x++) c.set(x, y, shade(SKY, y * 0.6))
  for (const [x, y, k] of [[22, 1, 0], [29, 0, 1], [36, 2, 2], [47, 1, 3], [55, 0, 4], [61, 2, 5]] as const) {
    c.set(x, y, (f + k * 7) % 24 < 2 ? (SKY[2] ?? 0) : (PALE[k % 2 ? 2 : 3] ?? 0))
  }

  for (let x = 16; x < W; x++) {
    const p = (x - 16) % 5
    const plank = Math.floor((x - 16) / 5)
    for (let y = Math.ceil(fenceTop(x)); y < 26; y++) {
      const isGap = p === 4
      const moon = (p === 3 ? 0.6 : 0) + (y < 6 ? 0.4 : 0)
      const lit = isOnFence(x, y) ? 0 : lamp(x, y) * 7.5
      const lvl = 1.7 + (hash(plank, 1) - 0.5) * 0.5 + moon * (1 - Math.min(1, porch)) + lit + (y === 8 || y === 20 ? -0.4 : 0) - (isGap ? 1.4 : 0)
      c.set(x, y, shade(FENCE, lvl))
    }
  }

  for (let y = 0; y < 26; y++) {
    for (let x = 0; x < 16; x++) {
      const lit = lamp(x, y) * 7.5 * (y < LAMP_Y - 2 && Math.abs(x - LAMP_X) < 3 ? 0.55 : 1)
      if (x === 15) {
        c.set(x, y, shade(FENCE, 3.2 + lit))
        continue
      }
      const isDoor = x >= 2 && x <= 8 && y >= 9
      if (isDoor) {
        const isFrame = x === 2 || x === 8 || y === 9
        const isPane = x >= 4 && x <= 6 && y >= 11 && y <= 14
        const isKnob = x === 7 && y === 18
        const lvl = isFrame ? 2.2 + lit * 0.8 : isPane ? 0.4 + lit * 0.2 : 1.2 + lit * 0.55
        c.set(x, y, isKnob ? shade(CAN, 3 + lit) : shade(isFrame ? FENCE : DOOR, lvl))
        continue
      }
      const board = (y + 1) % 3
      c.set(x, y, shade(FENCE, 2.1 + lit + (board === 0 ? -0.9 : board === 1 ? 0.3 : 0)))
    }
  }
  for (let x = LAMP_X - 2; x <= LAMP_X + 2; x++) c.set(x, LAMP_Y - 3, shade(FUR, 1.4 + porch * 2))
  for (let y = LAMP_Y - 2; y <= LAMP_Y; y++) {
    for (let x = LAMP_X - 1; x <= LAMP_X + 1; x++) {
      c.set(x, y, porch > 0.3 ? (GLOW[x === LAMP_X ? 3 : 2] ?? 0) : porch > 0 ? (GLOW[1] ?? 0) : shade(PALE, 0.4 + (x === LAMP_X + 1 ? 0.6 : 0)))
    }
    c.set(LAMP_X - 2, y, shade(FUR, 1 + porch))
    c.set(LAMP_X + 2, y, shade(FUR, 1 + porch))
  }
  for (let x = LAMP_X - 1; x <= LAMP_X + 1; x++) c.set(x, LAMP_Y + 1, shade(FUR, 1.4 + porch * 2))

  for (let y = 26; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const isJoint = (x + Math.round((y - 26) * 0.6)) % 14 === 0 || y === 29
      const lit = isShadowed(x, y) ? 0 : lamp(x, y) * 6.5
      const moonShadow = porch === 0 && y <= 28 && x > CAN_X - 12 && x < CAN_X - 4 ? 0.8 : 0
      c.set(x, y, shade(GROUND, 2.2 + lit - (isJoint ? 0.9 : 0) - (y === 26 ? 0.6 : 0) - moonShadow))
    }
  }

  const face = (ox: number, oy: number, lookShift: number, light: (x: number, y: number) => number, isEyesOnly: boolean, clip: (x: number, y: number) => boolean) => {
    RACCOON.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i] ?? '.'
        const x = ox + i
        const y = oy + j
        if (ch === '.' || clip(x, y)) continue
        if (ch === 'o') continue
        if (isEyesOnly) continue
        const l = light(x, y)
        if (ch === 'w') c.set(x, y, shade(PALE, 1.4 + l * 0.8))
        else c.set(x, y, shade(FUR, (FUR_LEVEL[ch] ?? 2) + (ch === 'K' || ch === 'n' ? 0 : l * 0.9) - (porch > 0 ? 0 : 0.6)))
      }
    })
    for (const ex of [3, 7]) {
      const x = ox + ex + lookShift
      const y = oy + 3
      if (clip(x, y)) continue
      const isBlazing = porch > 0.3
      c.set(x, y, isBlazing ? EYE_LIT : EYE_DIM)
    }
  }
  if (peek) {
    face(Math.round(peek.x) - 5, B_Y, 0, (x, y) => (isShadowed(x, y) ? 0 : lamp(x, y) * 5), peek.eyesOnly, (x, y) => y > 26 || x <= CAN_X + canHalf(y))
  }

  for (let y = RIM_Y + 1; y <= BASE_Y; y++) {
    const half = canHalf(y)
    for (let x = Math.ceil(CAN_X - half); x <= Math.floor(CAN_X + half); x++) {
      const n = (x - CAN_X) / half
      const moon = n > 0.7 ? 1 : 0
      const lit = lamp(x, y) * 7 * clamp(0.8 - n * 0.7, 0.05, 1.3)
      const spec = n > -0.6 && n < -0.38 ? lamp(x, y) * 2.5 : 0
      const rib = y === 20 || y === 25 ? 0.8 : y === 21 || y === 26 ? -0.8 : 0
      const lvl = 2.5 + moon * (1 - Math.min(1, porch)) * 1.6 + lit + spec + rib - (y === BASE_Y ? 0.8 : 0) - (Math.abs(n) > 0.92 ? 0.5 : 0)
      c.set(x, y, shade(CAN, lvl))
    }
  }
  const isOpen = act.lid < RIM_Y - 1.5
  for (let y = RIM_Y - 2; y <= RIM_Y + 2; y++) {
    for (let x = CAN_X - 8; x <= CAN_X + 8; x++) {
      const e = ((x - CAN_X) / 7.2) ** 2 + ((y - RIM_Y) / 1.6) ** 2
      if (e > 1) continue
      const isRim = e > 0.45
      c.set(x, y, shade(CAN, isRim ? 3.4 + lamp(x, y) * 6 - (x > CAN_X ? 0.8 : 0) : isOpen ? 0.4 : 2))
    }
  }

  if (act.top < 99) {
    const ox = CAN_X - 5 + act.sway
    face(ox, act.top, act.look, (x, y) => lamp(x, y) * 5.5 * (x < CAN_X ? 1.2 : 0.8), false, (_x, y) => y > RIM_Y)
    if (act.top <= 9) {
      for (const [px, side] of [[ox - 1, 0], [ox + 10, 1]] as const) {
        if (side === 1 && act.holds !== undefined) continue
        c.set(px, RIM_Y, shade(FUR, 2 + lamp(px, RIM_Y) * 4))
        c.set(px + 1, RIM_Y, shade(FUR, 2.6 + lamp(px, RIM_Y) * 4))
        c.set(px, RIM_Y + 1, shade(FUR, 1.2))
        c.set(px + 1, RIM_Y + 1, shade(FUR, 1.4))
      }
    }
    if (act.holds !== undefined) {
      const ax = ox + 11
      const ay = act.top + 1
      c.set(ax, ay + 2, shade(FUR, 2.2 + lamp(ax, ay) * 4))
      c.set(ax, ay + 1, shade(FUR, 2.2 + lamp(ax, ay) * 4))
      const art = ITEMS[act.holds] ?? []
      const x0 = ax - Math.floor((art[0]?.length ?? 0) / 2)
      art.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
          const paint = itemPaint(row[i] ?? '.', porch)
          if (paint !== undefined && !act.letGo) c.set(x0 + i, ay - art.length + j, paint)
        }
      })
    }
  } else if (f >= 10 && f < 14) {
    for (const ex of [CAN_X - 2, CAN_X + 2]) c.set(ex, RIM_Y - 1, f === 12 ? (EYE_DIM & 0x3a5a2a) : EYE_DIM)
  }

  for (const [start, item] of THROWS) {
    const t = f - start - 4
    if (t < 0 || t > 9) continue
    const s = Math.max(0, t - 0.5) / 8.5
    const art0 = ITEMS[item] ?? []
    const w0 = art0[0]?.length ?? 0
    const cx = CAN_X + 6 - Math.floor(w0 / 2) + w0 / 2 + 18 * s
    const cy = 8 - art0.length / 2 - 22 * s + 26 * s * s
    const art = rot(art0, Math.floor(t / 2))
    const left = Math.round(cx - (art[0]?.length ?? 0) / 2)
    const top = Math.round(cy - art.length / 2)
    art.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const paint = itemPaint(row[i] ?? '.', porch)
        const px = left + i
        const py = top + j
        if (paint === undefined || (s > 0.42 && py >= fenceTop(px))) continue
        c.set(px, py, paint)
      }
    })
  }

  for (let x = lidX - 8; x <= lidX + 8; x++) {
    const dx = x - lidX
    const shift = Math.round((act.tilt * dx) / 7)
    const brim = Math.round(act.lid) + shift
    if (Math.abs(dx) > 7.6) continue
    const dome = Math.abs(dx) <= 6 ? Math.round(1.6 * Math.sqrt(1 - (dx / 6.6) ** 2)) : 0
    const lit = lamp(x, brim) * 6.5 * clamp(0.9 - (dx / 7) * 0.7, 0.1, 1.4)
    const moon = dx > 4 ? 0.8 * (1 - Math.min(1, porch)) : 0
    for (let k = dome; k >= 1; k--) c.set(x, brim - k, shade(CAN, 2.6 + lit + moon + (k === dome ? 0.8 : 0)))
    c.set(x, brim, shade(CAN, 3.4 + lit + moon))
    c.set(x, brim + 1, shade(CAN, 1.4 + lit * 0.5))
    if (Math.abs(dx) <= 1) c.set(x, brim - dome - 1, shade(CAN, 3 + lit + moon))
  }

  if (porch > 0.3 && f > ON + 2) {
    const mx = LAMP_X + Math.round(Math.cos(f * 1.3) * 3)
    const my = LAMP_Y - 1 + Math.round(Math.sin(f * 2.1) * 2)
    c.set(mx, my, GLOW[3] ?? 0)
  }
}

function render(): Int32Array[] {
  return frames(LOOP, draw)
}

export const scene: Scene = {
  verb: 'Shenaniganing',
  render,
  hero: 49,
  snaps: [
    { frames: [4, 7], box: [24, 11, 38, 16], why: 'the lid rattles: it jumps a pixel and drops back on alternate frames, the first sign that something is inside' },
    { frames: [ON, ON + 2], box: [0, 0, W - 1, H - 1], why: 'the porch light snaps on with a stutter, flash, dip, on, and lights the whole yard' },
    { frames: [56, 57], box: [0, 0, W - 1, 26], why: 'caught, both raccoons vanish in two frames, a cartoon zip into the can, and the big hatted shadow goes with them, reshaping the whole lamp-lit wall and fence' },
    { frames: OFF, box: [0, 0, W - 1, H - 1], why: 'the porch light clicks off and the yard drops back to moonlight' },
  ],
}
