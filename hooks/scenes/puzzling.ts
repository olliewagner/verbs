import { TAU, beat, clamp, ease, frames, hash, hex, shade, type Canvas, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const PW = 40
const PH = 24
const COLS = 4
const ROWS = 3
const CW = PW / COLS
const CH = PH / ROWS
const BX = 12
const BY = 4

const SKY = hex('3a72c4 4a86d0 5f9cdc 7cb2e4 9cc8ec bcdcf2')
const ROCK = hex('2a3460 3c4882 54619e 7280ba 98a6d2')
const SNOW = hex('8ea4d0 c4d6ee eef4fc')
const HILLS = hex('1a4a3a 24623e 2f7a40 46963e 6aae48')
const LAKE = hex('183e78 22569a 3272b6 5694d0 8cbce6 d6f0fa')
const MEADOW = hex('2a5e2a 3a7c30 52983a 76b448 a2cc60')
const PINE = hex('071814 0c2620 133628 1c4a30 2a6238')
const CABIN = hex('5a1a18 8e2c22 c4442c e6683c')
const WOOD = hex('140c0a 1e130e 2a1a12 382216 482c1a 5c391f 734a28 8a5c33')
const MUG = hex('2c3a4a 46607a 6c8eaa 9ec0d6 d6ecf6')
const TEA = hex('1a0c06 3a1c0c 6a3814 a8662a e8b878')
const TRAY = hex('121620 191e2a 212836 2b3444 3a4558')

const RAMPS = [SKY, ROCK, SNOW, HILLS, LAKE, MEADOW, PINE, CABIN, WOOD, MUG, TEA, TRAY]
const PLACE = new Map<number, readonly [readonly number[], number]>()
for (const r of RAMPS) r.forEach((c, i) => PLACE.has(c) || PLACE.set(c, [r, i]))
function placeOf(color: number): readonly [readonly number[], number] {
  const at = PLACE.get(color)
  if (at) return at
  const rgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255] as const
  const [r0, g0, b0] = rgb(color)
  let best: readonly [readonly number[], number] = [[color], 0]
  let far = Infinity
  for (const [c, place] of PLACE) {
    const [r1, g1, b1] = rgb(c)
    const d = (r1 - r0) ** 2 + (g1 - g0) ** 2 + (b1 - b0) ** 2
    if (d < far) [far, best] = [d, place]
  }
  PLACE.set(color, best)
  return best
}
function step(color: number, d: number): number {
  if (d === 0) return color
  const [r, i] = placeOf(color)
  return r[clamp(i + d, 0, r.length - 1)] ?? color
}
function toward(color: number, t: number): number {
  const [r, i] = placeOf(color)
  return step(color, Math.round(t * (t > 0 ? r.length - 1 - i : i)))
}
const stepped = (color: number, amount: number) => step(color, Math.round(amount))
const sunAt = [33, 3.5] as const
const ridgeA = (px: number) => 2 + Math.abs(px - 13) * 0.82 + (px > 13 ? Math.sin(px * 1.3) * 0.4 : 0)
const ridgeB = (px: number) => 5.5 + Math.abs(px - 29) * 0.72
const hillLine = (px: number) => 11.4 + Math.sin(px * 0.27 + 1) * 1.1
const SHORE = 15
const meadowLine = (px: number) => 19.6 + Math.sin(px * 0.33) * 0.7
function paint(px: number, py: number): number {
  const isMeadow = py >= meadowLine(px)
  if (isMeadow) {
    const flower = hash(px, py, 3)
    if (flower > 0.94 && py > 20 && hash(px - 1, py, 3) < 0.9 && hash(px + 1, py, 3) < 0.9) return flower > 0.96 ? 0xfff4c0 : flower > 0.93 ? 0xf06a5a : 0xf6d24a
    return shade(MEADOW, 3.4 - (py - 19) * 0.45 + (px > 20 ? 0.5 : 0), px, py)
  }
  if (py >= SHORE) {
    const my = 2 * SHORE - py - 1
    const mirrored = py === SHORE ? 3.8 : layerAt(px, my) === 'rock' ? 1.2 : layerAt(px, my) === 'snow' ? 3 : layerAt(px, my) === 'hill' ? 0.6 : 3.4
    return shade(LAKE, mirrored + (py === SHORE ? 0 : (py - SHORE) * 0.15), px, py)
  }
  const layer = layerAt(px, py)
  if (layer === 'hill') return shade(HILLS, 3 - (py - hillLine(px)) * 0.5 + (px > 24 ? 0.6 : 0), px, py)
  if (layer === 'snow') return shade(SNOW, px >= 13 && px < 29 ? 2 : px >= 29 ? 2 : 1, px, py)
  if (layer === 'rock') {
    const isLitA = py < ridgeB(px) || px < 22 ? px > 13 : px > 29
    return shade(ROCK, (isLitA ? 3 : 1.6) - (py > 9 ? 0.6 : 0), px, py)
  }
  const sd = Math.hypot(px - sunAt[0], py - sunAt[1])
  if (sd < 2.1) return 0xfff8dc
  if (sd < 3.1) return 0xfde7a0
  const cloud = cloudAt(px, py)
  if (cloud > 0) return cloud > 1 ? 0xf6f8fc : 0xc6d4ec
  return shade(SKY, 0.4 + (py / 11) * 4.6, px, py)
}
function cloudAt(px: number, py: number): number {
  const lobes = [[6, 3, 3.6, 1.3], [9, 2.2, 2.2, 1.2], [21, 5.4, 3.4, 1.1], [23, 4.6, 1.8, 1]] as const
  let best = 0
  for (const [cx, cy, rx, ry] of lobes) {
    const d = ((px + 0.5 - cx) / rx) ** 2 + ((py + 0.5 - cy) / ry) ** 2
    if (d <= 1) best = Math.max(best, py + 0.5 > cy + ry * 0.35 ? 1 : 2)
  }
  return best
}
function layerAt(px: number, py: number): 'sky' | 'rock' | 'snow' | 'hill' {
  if (py >= hillLine(px)) return 'hill'
  const a = ridgeA(px)
  const b = ridgeB(px)
  if (py >= a || py >= b) {
    const isA = py >= a && (py < b || a < b + 0.5 || px < 21)
    const peak = isA ? 2 : 5.5
    const snowline = peak + 3.4 + Math.round(Math.sin(px * 1.7) * 0.8)
    return py < snowline ? 'snow' : 'rock'
  }
  return 'sky'
}
const PICTURE: Int32Array = (() => {
  const out = new Int32Array(PW * PH)
  for (let py = 0; py < PH; py++) for (let px = 0; px < PW; px++) out[py * PW + px] = paint(px, py)
  const put = (px: number, py: number, color: number) => {
    if (px >= 0 && px < PW && py >= 0 && py < PH) out[py * PW + px] = color
  }
  for (const [tx, base, height] of [[4, 23, 12], [9, 22, 8], [36, 14, 5], [38, 14, 4]] as const) {
    for (let k = 0; k < height; k++) {
      const half = Math.round(k * 0.36) - (k > 0 && k % 3 === 0 ? 1 : 0)
      for (let dx = -half; dx <= half; dx++) put(tx + dx, base - height + 1 + k, shade(PINE, dx > 0 ? 3 : dx < 0 ? 0.6 : 1.6 + (dx === half ? 1 : 0), tx + dx, k))
    }
    put(tx, base + 1, shade(WOOD, 4, 0, 0))
  }
  const cabin = ['..rr..c', '.rrrrrc', 'rrrrrrr', '.wwhww.', '.wwhwW.']
  cabin.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i]
      const px = 24 + i
      const py = 10 + j
      if (ch === 'r') put(px, py, shade(CABIN, j === 0 || i === 0 ? 0.6 : 0, px, py))
      if (ch === 'c') put(px, py, 0x3a2424)
      if (ch === 'w') put(px, py, shade(CABIN, i >= 4 ? 3 : 2, px, py))
      if (ch === 'h') put(px, py, 0x4a1810)
      if (ch === 'W') put(px, py, 0xffd76a)
    }
  })
  return out
})()
const tabRight = (i: number, j: number) => hash(i, j, 41) > 0.5
const tabDown = (i: number, j: number) => hash(i, j, 43) > 0.5
const inKnob = (px: number, py: number, cx: number, cy: number) => Math.hypot(px + 0.5 - cx, py + 0.5 - cy) <= 1.6

const OWNER: Int8Array = (() => {
  const out = new Int8Array(PW * PH)
  for (let py = 0; py < PH; py++) {
    for (let px = 0; px < PW; px++) {
      let i = Math.floor(px / CW)
      let j = Math.floor(py / CH)
      const ci = i
      const cj = j
      if (ci > 0 && tabRight(ci - 1, cj) && inKnob(px, py, ci * CW + 1.3, cj * CH + CH / 2)) i = ci - 1
      if (ci < COLS - 1 && !tabRight(ci, cj) && inKnob(px, py, (ci + 1) * CW - 1.3, cj * CH + CH / 2)) i = ci + 1
      if (cj > 0 && tabDown(ci, cj - 1) && inKnob(px, py, ci * CW + CW / 2, cj * CH + 1.3)) j = cj - 1
      if (cj < ROWS - 1 && !tabDown(ci, cj) && inKnob(px, py, ci * CW + CW / 2, (cj + 1) * CH - 1.3)) j = cj + 1
      out[py * PW + px] = j * COLS + i
    }
  }
  return out
})()
const ownerAt = (px: number, py: number) => (px < 0 || py < 0 || px >= PW || py >= PH ? -1 : OWNER[py * PW + px] ?? -1)
const ORDER = [0, 3, 8, 11, 1, 2, 4, 7, 9, 10, 5, 6]
const LAST = 6
const startOf = (n: number) => Math.round(n * 2.3)
type Pose = { x: number; y: number; angle: number; height: number; landed: boolean; bevel?: number }
const homeOf = (k: number): [number, number] => [BX + (k % COLS) * CW + CW / 2, BY + Math.floor(k / COLS) * CH + CH / 2]

const SPEED = 2
const ACCEL = 0.4
const REACH = 60
const AWAY: readonly (readonly number[])[] = [[-0.6, -1, -1, 0], [-0.25, -1, -1, 0], [0.5, -1, 1, 0], [0.7, -1, 1, 0], [-1, -0.25], [-0.3, 1], [0.5, -1], [1, 0.4], [-0.6, 1], [-0.2, 1], [0.25, 1], [0.7, 1]]
type Flight = { x: Float64Array; y: Float64Array; t: Float64Array; time: number }
function flight(hx: number, hy: number, away: readonly number[], bow: number, isSeen: (x: number, y: number) => boolean): Flight {
  const [ax = 0, ay = -1, ix, iy] = away
  const len = Math.hypot(ax, ay)
  const [ux, uy] = [ax / len, ay / len]
  const [cx, cy] = ix !== undefined && iy !== undefined ? [hx + ix * 16, hy + iy * 16] : [hx + ux * REACH * 0.5 - uy * bow, hy + uy * REACH * 0.5 + ux * bow]
  const [fx, fy] = [hx + ux * REACH, hy + uy * REACH]
  const N = 480
  const x = new Float64Array(N + 1)
  const y = new Float64Array(N + 1)
  const t = new Float64Array(N + 1)
  let s = 0
  for (let i = 0; i <= N; i++) {
    const u = i / N
    x[i] = (1 - u) ** 2 * hx + 2 * u * (1 - u) * cx + u * u * fx
    y[i] = (1 - u) ** 2 * hy + 2 * u * (1 - u) * cy + u * u * fy
    if (i === 0) continue
    const ds = Math.hypot((x[i] ?? 0) - (x[i - 1] ?? 0), (y[i] ?? 0) - (y[i - 1] ?? 0))
    t[i] = (t[i - 1] ?? 0) + ds / Math.min(SPEED, Math.sqrt(2 * ACCEL * (s + ds / 2)))
    s += ds
  }
  let time = t[N] ?? 0
  for (let i = N; i >= 0 && !isSeen(x[i] ?? 0, y[i] ?? 0); i--) time = t[i] ?? 0
  return { x, y, t, time: Math.ceil(time) }
}
function along(p: Flight, time: number): [number, number] {
  let lo = 0
  let hi = p.t.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if ((p.t[mid] ?? 0) <= time) lo = mid
    else hi = mid
  }
  const [t0, t1] = [p.t[lo] ?? 0, p.t[hi] ?? 0]
  const u = clamp((time - t0) / (t1 - t0 || 1))
  return [(p.x[lo] ?? 0) + ((p.x[hi] ?? 0) - (p.x[lo] ?? 0)) * u, (p.y[lo] ?? 0) + ((p.y[hi] ?? 0) - (p.y[lo] ?? 0)) * u]
}
function isSeen(k: number, p: Pose): boolean {
  let seen = false
  for (const d of [0, 1, 4]) eachPixel(k, p, d, d, () => (seen = true))
  return seen
}
const FLIGHTS = Array.from({ length: COLS * ROWS }, (_, k) =>
  flight(...homeOf(k), AWAY[k] ?? [], hash(k, 5) > 0.5 ? 5 : -5, (x, y) => isSeen(k, { x, y, angle: 0, height: 1, landed: false })),
)
const landOf = (k: number) => startOf(ORDER.indexOf(k)) + (FLIGHTS[k]?.time ?? 0)
const LAST_IN = 20
const LAST_FLIGHT = flight(homeOf(LAST)[0] + 5, homeOf(LAST)[1] - 4, [1, -0.3], 5, (x, y) => isSeen(LAST, { x, y, angle: TAU / 4, height: 1, landed: false }))
const HOVER = LAST_IN + LAST_FLIGHT.time
const TURN = HOVER + 6
const DROP = TURN + 12
const CLICK = DROP + 2
const ALIVE_END = CLICK + 15
const LIFT = ALIVE_END
const LIFTING = 8
const departOf = (k: number) => LOOP - 5 - (FLIGHTS[k]?.time ?? 0) - (k === 2 ? 1 : 0)
function pose(k: number, f: number): Pose | undefined {
  const [hx, hy] = homeOf(k)
  const path = FLIGHTS[k]
  if (!path) return undefined
  if (f >= LIFT && f >= departOf(k) - LIFTING) {
    const from = Math.max(LIFT, departOf(k) - LIFTING)
    const lift = 0.5 * beat(f, from, from + 5)
    const away = f - departOf(k)
    const bevel = beat(f, from - 1, from + 5)
    if (away <= 0) return { x: hx, y: hy, angle: 0, height: lift, landed: false, bevel }
    const [x, y] = along(path, away)
    return { x, y, angle: 0, height: lift + 0.5 * clamp(away / 6), landed: false, bevel }
  }
  if (k === LAST) {
    if (f < LAST_IN) return undefined
    if (f < HOVER) {
      const [x, y] = along(LAST_FLIGHT, HOVER - f)
      return { x, y, angle: TAU / 4, height: 1, landed: false }
    }
    if (f < TURN) {
      const bob = Math.sin(((f - HOVER) / (TURN - HOVER)) * TAU)
      return { x: hx + 5, y: hy - 4 + Math.round(bob), angle: TAU / 4, height: 1, landed: false }
    }
    if (f < DROP) {
      const u = beat(f, TURN, DROP - 1)
      const t = u * u * (3 - 2 * u)
      const glide = ease.inOut(u)
      return { x: hx + 5 * (1 - glide), y: hy - 4 + 3 * glide, angle: (TAU / 4) * (1 - t), height: 1, landed: false }
    }
    if (f < CLICK) return { x: hx, y: hy - (f === DROP ? 1 : 0), angle: 0, height: f === DROP ? 0.6 : 0.2, landed: false }
    return { x: hx, y: hy, angle: 0, height: 0, landed: true }
  }
  const s = startOf(ORDER.indexOf(k))
  const land = landOf(k)
  if (f < s) return undefined
  if (f >= land) return { x: hx, y: hy, angle: 0, height: 0, landed: true }
  const [x, y] = along(path, land - f)
  return { x, y, angle: 0, height: clamp((land - f - 0.5) / 7), landed: false }
}
function eachPixel(k: number, p: Pose, dx: number, dy: number, visit: (x: number, y: number, px: number, py: number) => void) {
  const [cx, cy] = [(k % COLS) * CW + CW / 2, Math.floor(k / COLS) * CH + CH / 2]
  const cos = Math.cos(-p.angle)
  const sin = Math.sin(-p.angle)
  const scale = k === LAST ? 1 + p.height * 0.18 : 1
  const ox = Math.round(p.x) + dx
  const oy = Math.round(p.y) + dy
  for (let y = oy - 10; y <= oy + 10; y++) {
    for (let x = ox - 10; x <= ox + 10; x++) {
      if (x < 0 || x >= W || y < 0 || y >= H) continue
      const rx = (x + 0.5 - ox) / scale
      const ry = (y + 0.5 - oy) / scale
      const px = Math.floor(rx * cos - ry * sin + cx)
      const py = Math.floor(rx * sin + ry * cos + cy)
      if (ownerAt(px, py) === k) visit(x, y, px, py)
    }
  }
}
function table(c: Canvas, flash: number, f: number) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const board = Math.floor((y + 1) / 6)
      const isGap = (y + 1) % 6 === 0
      const grain = Math.sin(x * 0.35 + board * 2.1 + Math.sin(x * 0.11 + board) * 2.2)
      const lamp = Math.max(0, 1 - Math.hypot(x - 30, (y - 13) * 1.5) / 44) * 4.2
      const level = 0.6 + lamp + (grain > 0.75 ? 0.6 : grain < -0.8 ? -0.5 : 0) - (isGap ? 1.2 : 0) + flash
      c.set(x, y, shade(WOOD, level, x, y))
    }
  }
  for (let y = BY - 1; y <= BY + PH; y++) {
    for (let x = BX - 1; x <= BX + PW; x++) {
      const isLip = x === BX - 1 || y === BY - 1 || x === BX + PW || y === BY + PH
      const isLitLip = isLip && (x === BX - 1 || y === BY - 1)
      c.set(x, y, shade(TRAY, isLitLip ? 4 : isLip ? 2.4 : 1 + (x < BX + 2 || y < BY + 1 ? -0.6 : 0) + flash, x, y))
    }
  }
  for (let y = 21; y <= 31; y++) {
    for (let x = 53; x <= 63; x++) {
      const d = Math.hypot(x - 58, (y - 26) * 1.05)
      const lit = (58 - x + 26 - y) / 4
      if (d <= 4.6 && d > 3.2) c.set(x, y, shade(MUG, 2.4 + lit * 0.8 + flash, x, y))
      else if (d <= 3.2) c.set(x, y, shade(TEA, 1.6 + (d > 2.4 ? -0.8 : 0) + (x === 57 && y === 24 ? 2.4 : 0), x, y))
      else if (x === 63 && y >= 25 && y <= 27) c.set(x, y, shade(MUG, y === 25 ? 3 : 1.8, x, y))
    }
  }
  for (let n = 0; n < 3; n++) {
    const t = ((f + n * (LOOP / 3)) % LOOP) / LOOP
    for (let k = 0; k < 4; k++) {
      const u = t * 3 - k * 0.2
      if (u < 0 || u > 1) continue
      const x = Math.round(57 + Math.sin(u * 5 + n * 2) * 1.5 - u * 2)
      const y = Math.round(25 - u * 6)
      c.tint(x, y, 0xe8e4dc, Math.sin(u * Math.PI) > 0.6 ? 0.4 : 0.2)
    }
  }
  for (let py = 0; py < PH; py++) {
    for (let px = 0; px < PW; px++) {
      const k = ownerAt(px, py)
      if (ownerAt(px + 1, py) !== k && px + 1 < PW) c.set(BX + px, BY + py, shade(TRAY, 2, px, py))
      if (ownerAt(px, py + 1) !== k && py + 1 < PH) c.set(BX + px, BY + py, shade(TRAY, 2, px, py))
    }
  }
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const flash = f === CLICK ? 0.9 : f === CLICK + 1 ? 0.4 : 0
    table(c, flash * 0.6, f)
    const poses = Array.from({ length: COLS * ROWS }, (_, k) => pose(k, f))
    const seam = f >= CLICK && f < LIFT ? 1 - beat(f, CLICK + 1, CLICK + 5) + beat(f, LIFT - 5, LIFT - 1) : 1

    for (let py = 0; py < PH; py++) {
      for (let px = 0; px < PW; px++) {
        const k = ownerAt(px, py)
        if (!poses[k]?.landed) continue
        let color = PICTURE[py * PW + px] ?? 0
        const isEdge = ownerAt(px + 1, py) !== k || ownerAt(px, py + 1) !== k
        if (isEdge) color = toward(color, -seam)

        const glow = [1, 0.8, 0.6, 0.4, 0.2][f - (k === LAST ? CLICK : landOf(k))] ?? 0
        if (ownerAt(px - 1, py) !== k || ownerAt(px, py - 1) !== k) color = toward(color, glow)
        c.set(BX + px, BY + py, color)
      }
    }
    if (f > CLICK + 2 && f < ALIVE_END) {
      const life = Math.min(beat(f, CLICK + 2, CLICK + 6), 1 - beat(f, ALIVE_END - 4, ALIVE_END))
      for (let py = SHORE + 1; py < 19; py++) {
        for (let px = 0; px < PW; px++) {
          const g = Math.sin(px * 0.9 - f * 0.7 + py * 2.3) + Math.sin(px * 0.37 + f * 0.45)
          if (g > 1.55 + (1 - life) * 2) c.set(BX + px, BY + py, shade(LAKE, 5, px, py))
        }
      }
      for (let n = 0; n < 3; n++) {
        const age = (f - CLICK + n * 4) % 12
        const sx = 30 + Math.round(age * 0.3 + Math.sin(age * 0.6) * 0.6)
        const sy = 9 - Math.round(age * 0.55)
        if (age < 10 && life > 0.3) c.set(BX + sx, BY + sy, age < 5 ? 0xe6ecf4 : 0xb8c8e2)
      }
      const bt = beat(f, CLICK + 3, ALIVE_END - 1)
      const bx = Math.round(4 + bt * 22)
      const by = Math.round(7 - Math.sin(bt * Math.PI) * 3)
      const up = f % 4 < 2
      for (const [ox, oy] of up ? [[-1, -1], [0, 0], [1, -1]] : [[-1, 0], [0, 0], [1, 0]]) {
        c.set(BX + bx + (ox ?? 0), BY + by + (oy ?? 0), 0x1a2238)
      }
    }
    const staysUp = (k: number) => (f >= LIFT ? -departOf(k) : k === LAST ? CLICK : landOf(k))
    const flying = poses
      .map((p, k) => [k, p] as const)
      .filter((e): e is readonly [number, Pose] => !!e[1] && !e[1].landed)
      .sort((a, b) => a[1].height - b[1].height || staysUp(a[0]) - staysUp(b[0]))

    const shaded = new Set<number>()
    const plain = new Map<number, number>()
    for (const [k, p] of flying) {
      const dark = clamp(p.height * 2.5)
      const off = Math.round(1 + p.height * 3)
      eachPixel(k, p, off, off, (x, y) => {
        const i = y * W + x
        if (shaded.has(i) || x < 0 || x >= W || y < 0 || y >= H) return
        c.set(x, y, toward(plain.get(i) ?? c.get(x, y), -dark))
        shaded.add(i)
      })
      const mask = new Map<number, number>()
      eachPixel(k, p, 0, 0, (x, y, px, py) => mask.set(y * W + x, PICTURE[py * PW + px] ?? 0))
      const edge = clamp(p.height * 2.5)
      const cut = (x: number, y: number) => {
        if (x < 0 || x >= W || y < 0 || y >= H) return
        const under = plain.get(y * W + x) ?? c.get(x, y)
        c.set(x, y, stepped(under, -2 * edge))
        plain.set(y * W + x, under)
      }
      for (const i of mask.keys()) {
        const x = i % W
        const y = Math.floor(i / W)
        if (!mask.has(i + W)) cut(x, y + 1)
        if (!mask.has(i + 1) && !mask.has(i + W + 1)) cut(x + 1, y + 1)
        for (const j of [i, i + W, i + W + 1]) shaded.delete(j)
      }
      for (const [i, color] of mask) {
        const x = i % W
        const y = Math.floor(i / W)
        const isTopLeft = !mask.has(i - 1) || !mask.has(i - W)
        const isBottomRight = !mask.has(i + 1) || !mask.has(i + W)
        c.set(x, y, isTopLeft ? stepped(color, 2 * (p.bevel ?? 1)) : isBottomRight ? step(color, -2) : color)
        plain.set(i, color)
      }
    }
    if (f >= CLICK && f < CLICK + 5) {
      const [hx, hy] = homeOf(LAST)
      const t = f - CLICK
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1.3], [0, 1.3], [-1.3, 0], [1.3, 0]] as const) {
        const r = 6 + t * 1.6
        const x = hx + sx * r * 1.15
        const y = hy + sy * r * 0.85
        c.set(x, y, t < 2 ? 0xfff6dc : t < 4 ? 0xd8b88a : 0x8a6a48)
      }
    }
  })
}
const BREAK = 'the picture breaks up: the top row lifts off over the tray lip, baring the empty tray'
export const scene: Scene = {
  verb: 'Puzzling',
  render,
  hero: 41,
  snaps: [
    { frames: 76, box: [18, 5, 21, 11], colors: TRAY, why: BREAK },
    { frames: 78, box: [11, 3, 52, 13], colors: TRAY, why: BREAK },
    { frames: 80, box: [14, 3, 37, 8], colors: TRAY, why: BREAK },
    { frames: 81, box: [47, 3, 52, 5], colors: TRAY, why: BREAK },
  ],
}