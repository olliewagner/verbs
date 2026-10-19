import { Canvas, beat, clamp, frames, hash, hex, lerp, mix, mod, particles, random, shade, smoothstep, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const WALL = hex('0a0a10 111119 181823 202130 2a2c3e 373a50 474c66')
const STEEL = hex('0a0b10 12141c 1c1f2a 282d3a 363d4d 4a5366 66718a 909bb0 c4ccd8 eef2f6')
const PLATE = hex('050508 0b0b10 121218 1a1a22 23232d 2e2e3a')
const RAW = hex('4e3c26 7a6240 a68c5e caaf7e e4d0a2 f6ead0 fffaee')
const GOLD = hex('341404 622a0a 924810 c06c1a e0962a f4c050 fde396 fff6d6')
const HANDLE = hex('120a0c 26121a 3c1c26 562830')
const PAPER = hex('6e6a62 a8a294 d8d2c2 f0ecdf')
const PINK = 0xff4f9e
const TEAL = 0x2fe0cf
const LAMP = 0xffb45e
const STEAM = 0xb4b8cc

const CX = 30
const BASE = 21
const LIP = 9
const FRONT = 27

const DROP = 0
type Chop = { f: number; side: number; x: number }
const CHOPS: Chop[] = [
  { f: 12, side: -1, x: 25 }, { f: 16, side: 1, x: 35 }, { f: 20, side: -1, x: 23 },
  { f: 24, side: 1, x: 37 }, { f: 28, side: -1, x: 21 }, { f: 32, side: 1, x: 39 },
]
const chopsBy = (f: number) => CHOPS.filter(c => f >= c.f).length
const cutsAt = (f: number, x: number) => CHOPS.filter(c => f >= c.f && Math.abs(x - c.x) <= 5).length
const PRESS = 42
const FLIP = 63
const PATS = [80, 86]
const SERVE = 88
const RELEASE = 93
const SERVE_X = [0, 1, 1, 2, 2]
const servedX = (f: number) => {
  const k = f - SERVE
  let x = 0
  for (let i = 0; i < Math.min(k, SERVE_X.length); i++) x += SERVE_X[i] ?? 0
  return x + 2 * Math.max(0, k - SERVE_X.length)
}
const FLIP_LIFT = [0, 1, 2, 4, 5, 6, 6, 6, 5, 4, 3.5, 2.5, 1.5, 0.5]
const FLIP_TURN = [0, 0.15, 0.3, 0.45, 0.65, 0.9, 1.2, 1.55, 1.95, 2.3, 2.55, 2.75, 2.92, 3.05]
const LAND = FLIP + FLIP_LIFT.length

type Food = {
  kind: 'heap' | 'patty' | 'none'
  cx: number
  hw: number
  h: number
  cuts: ((x: number) => number) | null
  landed: number
  crisp: number
  turn: number
  lift: number
  squash: number
}

function foodAt(f: number): Food {
  const food: Food = { kind: 'heap', cx: CX, hw: 9.5, h: 8, cuts: null, landed: 1, crisp: 0, turn: 0, lift: 0, squash: 0 }
  if (f < PRESS) {
    const landed = smoothstep(DROP + 2, DROP + 9, f)
    const k = chopsBy(f)
    if (landed <= 0) return { ...food, kind: 'none' }
    return { ...food, hw: 1 + landed * 8.5 + k * 0.5, h: 8 * landed - k * 0.85, cuts: x => cutsAt(f, x), landed }
  }
  food.kind = 'patty'
  food.crisp = smoothstep(PRESS + 3, FLIP, f)
  food.squash = ({ [PRESS]: 0.6, [PRESS + 1]: 0.6, [PRESS + 2]: 0.45, [PRESS + 3]: 0.2, [LAND]: 0.55, [LAND + 1]: 0.2 } as Record<number, number>)[f] ?? 0
  if (PATS.includes(f)) food.squash = 0.3
  if (f >= FLIP && f < LAND) {
    const t = (f - FLIP) / (LAND - FLIP)
    food.turn = FLIP_TURN[f - FLIP] ?? 0
    food.lift = FLIP_LIFT[f - FLIP] ?? 0
    food.cx = CX + Math.round(1.5 * Math.sin(Math.PI * t))
  } else if (f >= LAND) food.turn = Math.PI
  if (f >= SERVE) {
    food.cx = CX + servedX(f)
    if (food.cx - 13 >= W) food.kind = 'none'
  }
  return food
}

type Hold = { x: number; y: number; tilt: number; smear: number }
type Key = readonly [f: number, x: number, y: number, tilt: number]
const READY = (side: number) => CX + side * 19

function chopKeys(side: number, then: Key): Key[] {
  const mine = CHOPS.filter(c => c.side === side)
  const rise = [-1, -3, -5, -6.5, -8, -8]
  return mine.flatMap((c, i) => {
    const next = mine[i + 1]
    const keys: Key[] = [[c.f, c.x, BASE + 1, 1], [c.f + 1, c.x, BASE + 1, 1], [c.f + 2, c.x, BASE - 1, 1]]
    if (next) rise.slice(1).forEach((dy, k) => keys.push([c.f + 3 + k, lerp(c.x, next.x, Math.min(1, (k + 1) / (rise.length - 2))), BASE + dy, 1]))
    else keys.push([c.f + 3, lerp(c.x, then[1], 0.3), BASE - 3, lerp(1, then[3], 0.3)], then)
    return keys
  })
}
const KEYS: Record<number, Key[]> = {
  [-1]: [
    [10, 25, BASE - 8, 1], [11, 25, BASE - 8, 1],
    ...chopKeys(-1, [36, 25, BASE - 6, 0.4]),
    [PRESS - 3, 25, BASE - 6, 0.4], [PRESS - 2, 25, BASE - 4.5, 0.3], [PRESS - 1, 25, BASE - 3.25, 0.15], [PRESS, 25, BASE - 2, 0], [PRESS + 2, 25, BASE - 2, 0],
    [PRESS + 3, 25, BASE - 3, 0.1], [PRESS + 4, 25, BASE - 4, 0.3], [58, 11, BASE, 1], [65, 11, BASE, 1], [66, 11, BASE - 1, 1], [69, 11, BASE - 1, 1],
    [77, 26, BASE - 5, 0.3], [78, 26, BASE - 4, 0.2], [79, 26, BASE - 3, 0.1], [PATS[0]!, 26, BASE - 2, 0], [PATS[0]! + 1, 26, BASE - 2, 0],
    [82, 26, BASE - 3, 0.1], [83, 26, BASE - 4, 0.2], [84, 26, BASE - 4, 0.2], [85, 26, BASE - 3, 0.1], [PATS[1]!, 26, BASE - 2, 0], [PATS[1]! + 1, 26, BASE - 2, 0],
    [88, 26, BASE - 3, 0.1], [89, 26, BASE - 4, 0.3],
    [96, 17, BASE - 2, 0.9], [LOOP + 1, 17, BASE - 2, 0.9], [LOOP + 10, 25, BASE - 8, 1],
  ],
  [1]: [
    [14, 35, BASE - 8, 1], [15, 35, BASE - 8, 1],
    ...chopKeys(1, [37, 36, BASE - 6, 0.4]),
    [PRESS - 3, 36, BASE - 6, 0.4], [PRESS - 2, 36, BASE - 4.5, 0.3], [PRESS - 1, 36, BASE - 3.25, 0.15], [PRESS, 36, BASE - 2, 0], [PRESS + 2, 36, BASE - 2, 0],
    [PRESS + 3, 36, BASE - 3, 0.1], [PRESS + 4, 36.5, BASE - 3.5, 0.15],
    [56, 46, BASE + 2, 0], [58, 46, BASE + 2, 0], [59, 45, BASE + 2, 0], [60, 43, BASE + 2, 0], [61, 41, BASE + 2, 0], [62, 39, BASE + 2, 0], [FLIP, 38, BASE + 2, 0],
    [FLIP + 1, 39, BASE + 1, 0.2], [FLIP + 2, 40, BASE, 0.4], [FLIP + 3, 41, BASE - 1, 0.6], [FLIP + 4, 42, BASE - 2, 0.8], [FLIP + 5, 43, BASE - 3, 1],
    [FLIP + 6, 44, BASE - 4, 1], [FLIP + 7, 44, BASE - 4, 1],
    [79, 46, BASE + 2, 0], [83, 46, BASE + 2, 0], [84, 45, BASE + 2, 0], [85, 43, BASE + 2, 0], [86, 41, BASE + 2, 0], [87, 39, BASE + 2, 0], [SERVE, 38, BASE + 2, 0],
    [RELEASE, 38 + 6, BASE + 2, 0], [RELEASE + 1, 45.5, BASE + 2, 0], [RELEASE + 2, 46.5, BASE + 2, 0], [RELEASE + 3, 47, BASE + 1.5, 0.2],
    [LOOP + 12, 36, BASE - 7.5, 1], [LOOP + 14, 35, BASE - 8, 1],
  ],
}
const STRIKES = new Set(CHOPS.map(c => c.f))

function holdAt(side: number, f: number): Hold {
  const keys = KEYS[side] ?? []
  const g = f < (keys[0]?.[0] ?? 0) ? f + LOOP : f
  const i = Math.max(1, keys.findIndex(k => k[0] > g))
  const a = keys[i - 1] ?? keys[0]!
  const b = keys[i] ?? a
  if (side > 0 && f >= SERVE && f <= RELEASE) return { x: foodAt(f).cx + 8, y: BASE + 2, tilt: 0, smear: 0 }
  const t = b[0] > a[0] ? (g - a[0]) / (b[0] - a[0]) : 0
  const isMine = (g: number) => CHOPS.some(c => c.f === g && c.side === side)
  const hold = { x: lerp(a[1], b[1], t), y: lerp(a[2], b[2], t), tilt: lerp(a[3], b[3], t), smear: isMine(f) ? 1 : isMine(f - 1) ? 0.4 : 0 }
  if (a[1] === READY(side) && b[1] === READY(side) && a[2] === BASE && b[2] === BASE) hold.y += (f + (side > 0 ? 3 : 0)) % 12 < 6 ? 0 : -1
  return hold
}
const isStrike = (f: number) => STRIKES.has(f) || f === PRESS || f === LAND || PATS.includes(f)

const CUP: [number, number, number, number][] = [
  [3, 3, 3, 7], [3, 7, 4, 8], [4, 8, 8, 8], [8, 8, 9, 7], [9, 7, 9, 3], [3, 3, 9, 3], [10, 4, 11, 4], [11, 4, 11, 6], [11, 6, 10, 6],
  [5, 1, 5, 2], [7, 0, 7, 1],
]
function drawRoom(c: Canvas, f: number): void {
  const buzz = wave(f, LOOP, 6) > 0.9 ? 0.6 : 1
  for (let y = 0; y < LIP; y++) {
    for (let x = 0; x < W; x++) {
      const lamp = Math.max(0, 1 - Math.hypot((x - CX) / 24, (y - 9) / 12)) * 2
      let color = shade(WALL, 1.2 + lamp + (x % 12 === 0 ? -1 : x % 12 === 1 ? 0.4 : 0))
      const pink = clamp(1 - Math.hypot(x - 7, y - 5) / 13) * buzz
      const teal = clamp((x - 48) / 16)
      if (pink > 0.05) color = mix(color, PINK, pink > 0.45 ? 0.32 : 0.16)
      if (teal > 0) color = mix(color, TEAL, teal > 0.5 ? 0.22 : 0.11)
      c.set(x, y, color)
    }
  }
  for (const [x0, y0, x1, y1] of CUP) c.line(x0, y0, x1, y1, buzz < 1 ? mix(PINK, WALL[2] ?? 0, 0.5) : 0xffb4d8)
  for (let x = 14; x < 62; x++) c.set(x, 1, shade(STEEL, x > 20 && x < 42 ? 7 : 5.5))
  for (const [i, [tx, tw, th]] of ([[19, 5, 6], [27, 6, 7], [44, 5, 6], [53, 6, 5]] as const).entries()) {
    const sway = wave(f, LOOP, 2, i * 0.3) > 0.5 ? 1 : 0
    for (let y = 0; y < th; y++) {
      const dx = y >= th - 2 ? sway : 0
      for (let x = 0; x < tw; x++) {
        const isRule = y > 0 && y < th - 1 && y % 2 === 0 && x > 0 && x < tw - 1
        c.set(tx + x + dx, 2 + y, PAPER[y === 0 ? 1 : isRule ? 2 : 3] ?? 0)
      }
    }
  }
  for (let x = 0; x < W; x++) {
    c.set(x, LIP, shade(STEEL, 6.5 + (x > 16 && x < 44 ? 1.5 : 0) - (x < 4 || x > 59 ? 1 : 0)))
    c.set(x, LIP + 1, PLATE[3] ?? 0)
    for (let y = LIP + 2; y < FRONT; y++) {
      const lamp = Math.max(0, 1 - Math.hypot((x - CX) / 32, (y - 18) / 9)) * 4.4
      let color = shade(PLATE, 0.6 + lamp)
      if (y >= 13 && y <= 14 && x < 16 && (x + 2 * y) % 6 !== 0) color = mix(color, PINK, (y === 13 ? 0.28 : 0.14) * buzz)
      if (y >= 15 && y <= 16 && x > 47 && (x * 3 + y) % 7 !== 0) color = mix(color, TEAL, y === 15 ? 0.24 : 0.12)
      if (y === LIP + 2 && x > 18 && x < 42) color = mix(color, LAMP, 0.16)
      if ((y === 24 && x > 6 && x < 13) || (y === 25 && x > 47 && x < 55) || (y === 13 && x > 41 && x < 46)) color = shade(PLATE, 2.6 + lamp)
      c.set(x, y, color)
    }
    c.set(x, FRONT, shade(STEEL, 7 + (x > 16 && x < 44 ? 1.5 : 0)))
    c.set(x, FRONT + 1, x % 9 === 4 ? mix(GOLD[2] ?? 0, PLATE[1] ?? 0, 0.3) : (PLATE[0] ?? 0))
    for (let y = FRONT + 2; y < H; y++) c.set(x, y, shade(STEEL, y === FRONT + 2 ? 4.4 : 2.8 - (y - FRONT - 2) * 0.5 + (x % 16 === 0 ? -1 : 0)))
  }
  for (const kx of [10, 30, 50]) {
    c.sprite(kx - 1, 29, ['abb', 'bcb', '.b.'], { a: STEEL[8] ?? 0, b: STEEL[1] ?? 0, c: kx === 30 ? 0xff7a3a : (STEEL[5] ?? 0) })
  }
}
type Shred = { u: number; v: number; a: number; len: number; tone: number }
const SHREDS: Shred[] = (() => {
  const r = random(9)
  return Array.from({ length: 64 }, () => ({ u: r() * 2 - 1, v: r(), a: r() * Math.PI, len: 2 + r() * 2.5, tone: r() }))
})()
function heapTop(food: Food, x: number): number {
  const d = (x - food.cx) / food.hw
  if (Math.abs(d) > 1) return Infinity
  return BASE - food.h * (1 - d * d) ** 0.7 + (hash(x, food.cuts?.(x) ?? 100, 3) - 0.5) * 1.4
}
function drawHeap(c: Canvas, food: Food): void {
  for (let x = Math.floor(food.cx - food.hw); x <= food.cx + food.hw; x++) {
    const top = Math.round(heapTop(food, x))
    const d = (x - food.cx) / food.hw
    const front = Math.round(BASE + 2.2 * Math.min(1, food.h / 3) * Math.sqrt(Math.max(0, 1 - d * d)))
    for (let y = top; y <= front; y++) {
      const depth = (y - top) / Math.max(1, front - top)
      c.set(x, y, shade(RAW, 3.8 - depth * 2.6 - d * 0.6))
    }
  }
  for (const s of SHREDS.slice(0, Math.ceil(SHREDS.length * food.landed))) {
    const x = food.cx + s.u * food.hw * 0.92
    const a = s.a + hash(Math.round(s.u * 100), food.cuts?.(Math.round(x)) ?? 100) * 2
    const top = heapTop(food, Math.round(x))
    if (!Number.isFinite(top)) continue
    const y = lerp(top + 0.4, BASE + 1.5, s.v * 0.85)
    const dx = (Math.cos(a) * s.len) / 2
    const dy = (Math.sin(a) * s.len) / 2.5
    c.line(x - dx, y - dy, x + dx, y + dy, shade(RAW, s.tone > 0.3 ? 4.2 + s.tone * 1.2 - s.v : 1.4))
  }
}
function drawPatty(c: Canvas, food: Food, f: number, blur = 0): void {
  const facing = Math.sin(0.4 - food.turn)
  const isGolden = facing < 0
  const rx = 12 + food.squash * 1.2
  const ry = Math.max(0.7, 8.6 * Math.abs(facing)) * (1 - food.squash * 0.25)
  const cy = BASE - 1.8 - food.lift + food.squash * 0.6
  const band = 2
  const sweep = f >= LAND + 2 && f < SERVE ? lerp(-18, 18, beat(f, LAND + 2, SERVE - 2)) : 99
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + band + 1; y++) {
    for (let x = Math.floor(food.cx - rx - 1); x <= food.cx + rx + 1; x++) {
      const u = (x - food.cx) / rx
      const onTop = u * u + ((y - cy) / ry) ** 2 <= 1
      const onSide = !onTop && u * u + ((y - cy - band) / ry) ** 2 <= 1 && y > cy
      if (!onTop && !onSide) continue
      if (onSide) {
        c.set(x, y, food.crisp > 0.25 + 0.5 * (1 - Math.abs(u)) ? shade(GOLD, 1 + food.crisp * 2.2 - (y - cy - ry) * 0.6 - u * 0.4) : shade(RAW, 1.8 - (y - cy - ry) * 0.5))
        continue
      }
      const v = (y - cy) / ry
      const rim = u * u + v * v > 0.7
      let color: number
      if (isGolden) {
        const glint = Math.abs(x - food.cx + (y - cy) * 2 - sweep) < 1.5 ? 2 : 0
        color = shade(GOLD, 4.2 - v * 0.9 - u * 0.5 + glint - (rim ? 0.8 : 0))
      } else {
        color = shade(RAW, 4.2 - v * 0.9 - u * 0.5)
        if (rim && food.crisp > 0.4 + 0.4 * (1 - Math.abs(u))) color = shade(GOLD, 3 + food.crisp)
      }
      c.set(x, y, color)
    }
  }
  if (ry < 1.2) return
  for (const [i, s] of SHREDS.entries()) {
    const x = food.cx + s.u * rx * 0.8
    const y = cy + (s.v * 2 - 1) * ry * 0.7
    if (((x - food.cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 0.66) continue
    const a = (s.a - Math.PI / 2) * (ry > 4 ? 1 : 0.4)
    const dx = (Math.cos(a) * s.len) / 2
    const dy = (Math.sin(a) * s.len) / 2 * Math.min(1, ry / 4)
    let color = (isGolden ? (s.tone > 0.5 ? GOLD[6] : GOLD[2]) : s.tone > 0.4 ? RAW[5] : RAW[2]) ?? 0
    if (hash(i, 7) < blur) {
      const face = Math.round(4.2 - ((y - cy) / ry) * 0.9 - ((x - food.cx) / rx) * 0.5)
      color = shade(isGolden ? GOLD : RAW, face + (s.tone > 0.5 ? 1 : 0))
    }
    c.line(x - dx, y - dy, x + dx, y + dy, color)
  }
}
function neckAt(side: number, f: number): [number, number] {
  const h = holdAt(side, mod(f, LOOP))
  return [h.x + side * (3 * (1 - h.tilt) + 2), h.y - lerp(2, 7, h.tilt) - 3]
}
function handAt(side: number, f: number): [number, number] {
  let x = 0
  let y = 0
  for (let d = -4; d <= 4; d++) {
    const [nx, ny] = neckAt(side, f + d)
    x += nx / 9
    y += ny / 9
  }
  return [Math.round(x + side * 16), Math.round(y - 11)]
}
function drawSpatula(c: Canvas, side: number, hold: Hold, hand: readonly [number, number]): void {
  const bw = 9
  const x0 = Math.round(hold.x - 4)
  const y0 = Math.round(hold.y - lerp(2, 7, hold.tilt) + 1)
  const bh = Math.max(2, Math.round(hold.y) - y0 + 1)
  const neon = side < 0 ? PINK : TEAL
  const nx = Math.round(hold.x + side * 3 * (1 - hold.tilt))
  const ny = y0 - 1
  const kx = nx + side * 2
  const ky = ny - 3
  c.line(nx, ny, kx, ky, STEEL[7] ?? 0)
  c.line(nx + side, ny, kx + side, ky, STEEL[4] ?? 0)
  const [hx, hy] = hand
  for (let k = -1; k <= 2; k++) c.line(kx + side, ky + k, hx, hy + k, HANDLE[2 - k] ?? 0)
  c.set(Math.round(lerp(kx, hx, 0.25)), Math.round(lerp(ky, hy, 0.25)) + 1, STEEL[8] ?? 0)
  if (hold.smear > 0) {
    for (let i = 0; i < bw; i++) for (let k = 1; k <= (hold.smear >= 1 ? 8 : 3); k++) c.tint(x0 + i, y0 - k, STEEL[7] ?? 0, 0.4 - k * 0.04)
  }
  for (let y = LIP - 1; y <= LIP + 1; y++) {
    if (y < y0 || y >= y0 + bh) continue
    c.set(x0 - 1, y, PLATE[0] ?? 0)
    c.set(x0 + bw, y, PLATE[0] ?? 0)
  }
  for (let j = 0; j < bh; j++) {
    for (let i = 0; i < bw; i++) {
      if (bh > 3 && j === 0 && (i === 0 || i === bw - 1)) continue
      let level = bh === 3 ? 6 : bh === 4 ? 5.2 : 4.4 - (i - 4) * 0.15 * side
      if (j === bh - 1) level = 8.4
      else if (j === 0) level = 6.6
      else if (bh > 3 && ((i + j) % 9 === 2 || (i + j) % 9 === 3)) level = 7.2
      let color = shade(STEEL, level)
      if (bh > 3 && j > 0 && j < bh - 1 && (side < 0 ? i < 3 : i > 5)) color = mix(color, neon, 0.25)
      c.set(x0 + i, y0 + j, color)
    }
  }
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const served = foodAt(f + LOOP)
    const food = foodAt(f)
    drawRoom(c, f)
    for (const it of [food, served]) {
      if (it.kind === 'none') continue
      const hw = it.kind === 'patty' ? 12 : it.hw
      for (let x = Math.floor(it.cx - hw + 1); x <= it.cx + hw - 1; x++) c.set(x, BASE + 3, shade(PLATE, 0.3))
    }
    const isCooking = food.kind !== 'none' && food.cx < 44
    const presence = f < PRESS ? smoothstep(DROP + 2, DROP + 9, f) : 1
    const puff = Math.max(smoothstep(PRESS, PRESS + 2, f) * (1 - smoothstep(PRESS + 3, PRESS + 12, f)), f >= LAND ? 1 - smoothstep(LAND, LAND + 10, f) : 0)
    if (isCooking) {
      for (const p of particles(f, LOOP, 16, 16, 3)) {
        const [r0, r1, r2] = p.r
        if (r2 > 0.4 + puff * 0.6) continue
        const x = food.cx + (r0 - 0.5) * 20 + Math.sin(p.t * 0.45 + r1 * 6) * 1.4
        const y = BASE - 4 - p.t * 0.85
        const a = Math.sin(Math.PI * p.age) * (0.6 + puff * 0.4) * presence
        if (a < 0.3) continue
        for (const [dx, dy] of [[0, 0], [1, 0], [0, -1], [1, -1]] as const) c.tint(x + dx, y + dy, STEAM, a > 0.6 ? 0.42 : 0.22)
      }
    }
    const blurOf = (g: number) => {
      if (g >= FLIP && g <= LAND) return [0.35, 0.7][g - FLIP] ?? [0.35, 0.7][LAND - g] ?? 1
      const k = g - SERVE
      return k <= 1 ? 0 : clamp((k - 1) / 3)
    }
    if (served.kind === 'patty') drawPatty(c, served, f + LOOP, blurOf(f + LOOP))
    if (food.kind === 'heap') drawHeap(c, food)
    if (food.kind === 'patty') drawPatty(c, food, f, blurOf(f))
    const fall = mod(f - (DROP - 1), LOOP)
    if (fall < 10) {
      const r = random(41)
      for (let i = 0; i < 22; i++) {
        const t = fall - i * 0.16
        const x = CX + (r() - 0.5) * 16
        const a = r() * Math.PI
        const tone = r()
        if (t < 0) continue
        const y = -3 + 1.2 * t + 1.1 * t * t
        if (y > BASE - 3) continue
        c.line(x - Math.cos(a), y - Math.sin(a), x + Math.cos(a), y + Math.sin(a), shade(RAW, 3.5 + tone * 2))
      }
    }
    drawSpatula(c, -1, holdAt(-1, f), handAt(-1, f))
    drawSpatula(c, 1, holdAt(1, f), handAt(1, f))
    if (food.kind !== 'none' && food.cx < 44) {
      for (const p of particles(f, LOOP, 26, 4, 11)) {
        const [r0, r1, r2] = p.r
        const x = food.cx + (r0 - 0.5) * 28 + (r1 - 0.5) * p.t * 2.5
        const y = BASE + 1 - (2 + r2 * 3) * p.t + 0.8 * p.t * p.t
        c.set(x, y, p.t === 0 ? (GOLD[7] ?? 0) : (GOLD[5] ?? 0))
      }
    }
    for (let back = 0; back < 4; back++) {
      if (!isStrike(f - back)) continue
      for (let k = 0; k < 7; k++) {
        const vx = (hash(f - back, k, 1) - 0.5) * 3.6
        const vy = 1.8 + hash(f - back, k, 2) * 2.2
        const x = foodAt(f - back).cx + (hash(f - back, k, 3) - 0.5) * 18 + vx * back
        const y = BASE - vy * back + 0.6 * back * back
        if (y > BASE + 1) continue
        c.set(x, y, back === 0 ? 0xfffbe8 : (GOLD[6] ?? 0))
      }
    }
  })
}
export const scene: Scene = {
  verb: 'Hashing',
  render,
  hero: 82,
  snaps: [

    ...[3, 19, 35, 51, 67, 83].map(f => ({ frames: [f, f + 3] as const, box: [3, 0, 11, 8] as const, why: 'the neon cup buzzes and dims' })),
    { frames: [LOOP - 1, 8], box: [21, 0, 39, 20], colors: RAW, why: 'a fresh handful of shreds falls onto the steel' },
    ...CHOPS.map(c => ({
      frames: c.f,
      box: (c.side < 0 ? [c.x - 13, 1, c.x + 5, 23] : [c.x - 5, 1, c.x + 13, 23]) as [number, number, number, number],
      why: 'the chop: the blade slams down into the heap in one frame, smeared, and the handle swings after it',
    })),
    { frames: [FLIP + 2, FLIP + 5], box: [19, 9, 41, 21], why: 'the patty turns edge-on in the air and opens out, raw side to golden' },
  ],
}