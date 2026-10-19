import { Canvas, beat, clamp, ease, frames, hash, hex, lerp, mod, random, shade, threshold, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const SKY = hex('7a4e5e 9a5e5e bc745e d8925e eab06a f4cc84 fae4ac')
const STAND = hex('5a3a4c 6a4454 7a5060 8a5c66 9c6a6c b07c72')
const FENCE = hex('4a3442 5e4652 785c64 967674 b69286 d6b094 f2d0a4')
const DIRT = hex('4a2e36 66403e 845646 a26e50 bc865c d29e68 e6b676 f4cc88')
const BAY = hex('120809 21100f 351812 4c2216 6a2e1a 8e4220 b8622c e09440')
const STEER = hex('160a0c 26100f 3c1812 58221a 783020 9c4426 c06a34 e09a4c')
const PATCH = hex('6a5450 9a8270 c8b090 eadcb8')
const HORN = hex('4a3a2e 9a8466 d8c6a0 f8eed4')
const SHIRT = hex('2a1030 4a1838 74203c a02e3a c84a3a e8783e')
const JEANS = hex('141626 20283e 2e3c58 445676')
const HAT = hex('2e1e16 4c3220 70502e 98703e c0965a e2c088 f6e0a8')
const SKIN = hex('3a1e16 6a3624 9a5636 c47c4e e6a46a')
const ROPE = hex('2c1c12 4e3420 7a5632 a8804a d2aa68 f0d48e')
const DUST = hex('a2725a bc8a64 d4a46e e8c084 f8dca2')
const CROWD = hex('4a2c3c 5c3444 6a4a4c 7a3c40 6e5448')

const GROUND = 29
const SPEED = 3

const WIND = 20
const THROW = 25
const LAND = 33
const CINCH = 36
const BUCK = 50
const FREE = 55
const REEL = 59
const HOME = 68

const HORSE_X = 15
function steerX(f: number): number {
  const caught = ease.inOut(beat(f, CINCH, CINCH + 6)) * -4
  const buck = ease.out(beat(f, BUCK, FREE)) * 1
  const surge = ((1 - Math.cos(beat(f, FREE - 1, FREE + 7) * Math.PI)) / 2) * 7
  const settle = ease.inOut(beat(f, FREE + 7, LOOP)) * -4
  return 47 + caught + buck + surge + settle
}

const STRIDE = 6
type Leg = { at: number; offset: number; isNear: boolean; isFore: boolean }
const HORSE_LEGS: Leg[] = [
  { at: -5, offset: 0, isNear: false, isFore: false },
  { at: -4, offset: 0.12, isNear: true, isFore: false },
  { at: 4, offset: 0.38, isNear: false, isFore: true },
  { at: 5, offset: 0.5, isNear: true, isFore: true },
]
const STEER_LEGS: Leg[] = [
  { at: -4.5, offset: 0.3, isNear: false, isFore: false },
  { at: -3.5, offset: 0.4, isNear: true, isFore: false },
  { at: 3, offset: 0.72, isNear: false, isFore: true },
  { at: 4, offset: 0.84, isNear: true, isFore: true },
]

type Point = { x: number; y: number }
function legPoints(hip: Point, p: number, leg: Leg, upper: number, lower: number, reach: number): { knee: Point; hoof: Point } {
  const a = Math.PI * 2 * (p + leg.offset)
  const swing = Math.sin(a) * reach
  const flex = Math.max(0, Math.cos(a))
  const knee = { x: hip.x + Math.sin(swing) * upper, y: hip.y + Math.cos(swing) * upper }
  const fold = leg.isFore ? swing - flex * 1.6 : swing - flex * 0.9
  return { knee, hoof: { x: knee.x + Math.sin(fold) * lower, y: knee.y + Math.cos(fold) * lower } }
}

function drawSky(c: Canvas): void {
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - 9, (y - 5.5) * 1.3)
      const glow = d < 3 ? 6 : d < 4.6 ? 5.2 : d < 9 ? 0.8 : d < 16 ? 0.4 : 0
      c.set(x, y, shade(SKY, 1.4 + y * 0.5 + glow, x, y))
    }
  }
}

function drawStands(c: Canvas, f: number, cheer: number): void {
  const scroll = Math.round(f * 0.5)
  for (let x = 0; x < W; x++) {
    const wx = mod(x + scroll, 36)
    for (let y = 6; y < 15; y++) {
      let level = 2.6 - (y - 8) * 0.12
      if (y === 6) level = 1
      else if (y === 7) level = 2.2
      else if (mod(wx, 12) === 0 && y < 9) level = 1.2
      c.set(x, y, shade(STAND, level, x, y))
    }
    if (mod(wx, 4) < 2) c.set(x, 8, CROWD[Math.floor(wx / 4) % CROWD.length] ?? 0)
  }
  for (let row = 0; row < 3; row++) {
    for (let k = 0; k < 9; k++) {
      if (hash(k, row, 5) < 0.2) continue
      const x0 = mod(k * 4 + row * 2 - scroll, 36)
      const jump = cheer > 0 && hash(k, row, 9) < 0.75 ? Math.round(clamp(cheer * 1.5 - (2 - row) * 0.25 - hash(k, row, 4) * 0.5, 0, 1)) : 0
      const y = 9 + row * 2 - jump
      const tone = CROWD[Math.floor(hash(k, row, 2) * CROWD.length)] ?? 0
      for (const sx of [x0, x0 + 36]) {
        if (sx >= W + 2) continue
        for (const dx of [-1, 0, 1]) c.set(sx + dx, y + 1, tone)
        if (jump > 0) c.set(sx, y + 2, tone)
        c.set(sx, y, shade(STAND, 4.2, sx, y))
        if (jump > 0) c.set(sx + (hash(k, row, 6) < 0.5 ? 2 : -2), y, tone)
      }
    }
  }
}

function drawFence(c: Canvas, f: number): void {
  for (let y = 15; y < 22; y++) for (let x = 0; x < W; x++) c.set(x, y, shade(DIRT, 6.4 - (y - 15) * 0.15, x, y))
  const scroll = f * 2
  for (let x = 0; x < W; x++) {
    const wx = mod(x + scroll, 18)
    for (let y = 14; y < 22; y++) {
      const isPost = wx < 2 && y > 14
      const isRail = y === 15 || y === 16 || y === 18 || y === 19
      if (!isPost && !isRail) continue
      const isTop = y === 15 || y === 18
      c.set(x, y, shade(FENCE, isTop ? 5.6 : isPost ? (wx === 0 ? 3.6 : 2.6) : 3, x, y))
    }
  }
}

function drawDirt(c: Canvas, f: number): void {
  for (let y = 22; y < H; y++) {
    const depth = (y - 18) / 11
    for (let x = 0; x < W; x++) {
      const wx = mod(x + f * SPEED * depth, 216)
      const rut = Math.sin(wx * 0.23 + y * 2.1) + Math.sin(wx * 0.07 + y * 0.9) > 1.35 ? -0.8 : 0
      c.set(x, y, shade(DIRT, 5.8 - (y - 22) * 0.32 + rut, x, y))
    }
  }
}

type Puff = { born: number; x: number; r: number; life: number; rise: number }
function kicks(legs: Leg[], phase: number, seed: number, scale: number): Puff[] {
  const out: Puff[] = []
  const next = random(seed)
  for (let f = 0; f < LOOP; f++) {
    for (const leg of legs.filter(l => !l.isFore || next() < 0.5)) {
      const p = mod((f + phase) / STRIDE + leg.offset, 1)
      if (Math.floor(p * STRIDE) !== 2) continue
      out.push({ born: f, x: leg.at - 1, r: (1.2 + next() * 0.9) * scale, life: 8 + Math.floor(next() * 6), rise: 0.15 + next() * 0.3 })
    }
  }
  return out
}
const HORSE_DUST = kicks(HORSE_LEGS, 0, 0x401, 1)
const STEER_DUST = kicks(STEER_LEGS, 2, 0x402, 0.9)

function drawPuffs(c: Canvas, f: number, puffs: Puff[], at: (f: number) => number): void {
  for (const p of puffs) {
    const a = mod(f - p.born, LOOP)
    if (a >= p.life) continue
    const t = a / p.life
    const x = p.x + at(p.born) - a * SPEED * 0.85
    const y = GROUND - 0.5 - a * p.rise
    const r = p.r + a * 0.28
    for (let j = Math.floor(y - r); j <= Math.ceil(y + r); j++) {
      for (let i = Math.floor(x - r); i <= Math.ceil(x + r); i++) {
        const d = Math.hypot(i - x, (j - y) * 1.3) / r
        const density = (1 - t) * (1.15 - d)
        if (d > 1 || j >= H || density < threshold(i, j) * 0.7) continue
        c.set(i, j, shade(DUST, 1.2 + (1 - d) * 1.8 - t + (j < y ? 0.8 : 0), i, j))
      }
    }
  }
}

function drawLeg(c: Canvas, hip: Point, knee: Point, hoof: Point, upper: number, lower: number, isThick: boolean): void {
  c.line(hip.x, hip.y, knee.x, knee.y, upper)
  if (isThick) c.line(hip.x + 1, hip.y, knee.x + 0.5, knee.y - 0.5, upper)
  c.line(knee.x, knee.y, hoof.x, hoof.y, lower)
}

function drawHorse(c: Canvas, f: number, bx: number, by: number, sitBack: number): void {
  const p = (f % STRIDE) / STRIDE
  const legs = (isNear: boolean) => {
    for (const leg of HORSE_LEGS.filter(l => l.isNear === isNear)) {
      const hip = { x: bx + leg.at, y: by + 1.5 + (leg.isFore ? -sitBack : sitBack) }
      const { knee, hoof } = legPoints(hip, p, leg, 3.3, 3.6, leg.isFore ? 0.75 - sitBack * 0.3 : 0.6)
      drawLeg(c, hip, knee, hoof, shade(BAY, isNear ? 3.2 : 1.6, 0, 0), shade(BAY, isNear ? 1.2 : 0.6, 0, 0), isNear)
      if (isNear) c.set(hoof.x, hoof.y, BAY[0] ?? 0)
    }
  }
  legs(false)
  for (let k = 0; k < 7; k++) {
    const sway = Math.sin(((f - k * 0.7) / STRIDE) * Math.PI * 2) * (k / 6) * 1.2
    c.set(bx - 8 - k, by - 2 + k * 0.5 + sway, shade(BAY, k < 3 ? 1.4 : 0.8, 0, 0))
    if (k > 1 && k < 6) c.set(bx - 8 - k, by - 1 + k * 0.5 + sway, shade(BAY, 0.4, 0, 0))
  }
  const pitch = sitBack * 0.18
  for (let y = Math.floor(by - 5); y <= Math.ceil(by + 4); y++) {
    for (let x = Math.floor(bx - 9); x <= Math.ceil(bx + 9); x++) {
      const dx = (x - bx) / 8
      const dy = (y - by + (x - bx) * pitch) / 3.3
      if (dx * dx + dy * dy > 1) continue
      const rim = dy < -0.72 ? 3.2 : dy < -0.4 ? 1.2 : 0
      c.set(x, y, shade(BAY, 2.6 + rim - dy * 0.5 + (x < bx - 5 ? 0.6 : 0) - (x > bx + 4 ? 0.5 : 0), x, y))
    }
  }
  const toss = f > CINCH && f < CINCH + 11 ? Math.sin(((f - CINCH - 1) / 10) * Math.PI) * 2 : 0
  const nod = Math.round(Math.sin(p * Math.PI * 2) * 0.7 - toss)
  const neck: [number, number][] = [[bx + 3, by - 3], [bx + 6, by - 8 + nod], [bx + 9, by - 7 + nod], [bx + 9, by - 1]]
  c.poly(neck, (x, y) => shade(BAY, 2.8 - (x - bx - 6) * 0.25 + (y < by - 6 + nod ? 2 : 0), x, y))
  const head: [number, number][] = [[bx + 7, by - 9 + nod], [bx + 10, by - 9 + nod], [bx + 14, by - 5.5 + nod], [bx + 13, by - 4 + nod], [bx + 9, by - 6 + nod]]
  c.poly(head, (x, y) => shade(BAY, 2.8 + (y < by - 8 + nod ? 2 : 0) - (x > bx + 12 ? 1.4 : 0), x, y))
  c.set(bx + 8, by - 10 + nod, shade(BAY, 4, 0, 0))
  c.set(bx + 10, by - 7 + nod, BAY[0] ?? 0)
  for (let k = 0; k < 5; k++) c.set(bx + 7 - k, by - 8 + nod + k * 0.8 - (k % 2), shade(BAY, 0.6, 0, 0))
  legs(true)
}

function drawSteer(c: Canvas, f: number, bx: number, by: number, buck: number, head: Point): void {
  const p = ((f + 2) % STRIDE) / STRIDE
  const hipLift = buck * 4
  const legs = (isNear: boolean) => {
    for (const leg of STEER_LEGS.filter(l => l.isNear === isNear)) {
      const kick = leg.isFore ? 0 : clamp((buck - 0.15) / 0.55)
      const hip = { x: bx + leg.at, y: by + 2 - (leg.isFore ? 0 : hipLift) }
      const run = legPoints(hip, p, leg, 2.7, 2.8, 0.65)
      const knee = { x: lerp(run.knee.x, hip.x - 2, kick), y: lerp(run.knee.y, hip.y + 1, kick) }
      const hoof = { x: lerp(run.hoof.x, hip.x - 5, kick), y: lerp(run.hoof.y, hip.y - (isNear ? 1 : 0), kick) }
      drawLeg(c, hip, knee, hoof, shade(STEER, isNear ? 3 : 1.4, 0, 0), shade(STEER, isNear ? 1.4 : 0.6, 0, 0), isNear)
      if (isNear) c.set(hoof.x, hoof.y, STEER[0] ?? 0)
    }
  }
  legs(false)
  for (let k = 0; k < 5; k++) {
    const sway = Math.sin(((f - k) / STRIDE) * Math.PI * 2) * k * 0.3
    c.set(bx - 8 - k * 0.5 - hipLift * 0.3, by - 3 - hipLift + k + sway, shade(STEER, 1.6, 0, 0))
  }
  c.set(bx - 11 - hipLift * 0.3, by + 2 - hipLift, STEER[0] ?? 0)
  for (let y = Math.floor(by - 7); y <= Math.ceil(by + 4); y++) {
    for (let x = Math.floor(bx - 8); x <= Math.ceil(bx + 7); x++) {
      const lift = ((bx - x) / 14 + 0.5) * hipLift
      const dx = (x - bx) / 7.2
      const dy = (y - by + lift) / 3.4
      const hump = Math.max(0, 1 - ((x - bx - 3) / 2.6) ** 2) * 0.35
      if (Math.abs(dx) ** 2.4 + Math.abs(dy + (dy < 0 ? hump : 0)) ** 2.2 > 1) continue
      const top = dy + (dy < 0 ? hump : 0)
      const rim = top < -0.76 ? 3 : top < -0.45 ? 1 : 0
      const level = 2.4 + rim - dy * 0.5 - (x > bx + 3 ? 0.4 : 0)
      const isSpot = ((x - bx + 2) / 2.2) ** 2 + ((y - by + lift + 0.5) / 1.4) ** 2 < 1 || ((x - bx + 6) / 1.4) ** 2 + ((y - by + lift - 1) / 1.1) ** 2 < 1
      c.set(x, y, isSpot ? shade(PATCH, level - 0.8, x, y) : shade(STEER, level, x, y))
    }
  }
  const hx = Math.round(head.x)
  const hy = Math.round(head.y)
  c.poly([[hx - 2, hy - 2], [hx + 1, hy - 2], [hx + 4, hy + 1.5], [hx + 3, hy + 3], [hx - 1, hy + 2]], (x, y) => shade(STEER, 2.4 + (y < hy - 1 ? 2 : 0) - (x > hx + 2 ? 0.8 : 0), x, y))
  c.set(hx + 1, hy, PATCH[3] ?? 0)
  c.set(hx + 2, hy + 1, PATCH[2] ?? 0)
  c.set(hx + 3, hy + 2, STEER[0] ?? 0)
  const horns: [number, number, number][] = [
    [-6, -1, 1.2], [-5, 0, 1.8], [-4, 0, 2.2], [-3, 0, 2.6], [-2, 0, 2.8], [-1, 0, 3], [0, 0, 3], [1, 0, 3], [2, 0, 2.8], [3, 0, 2.6], [4, 0, 2.2], [5, -1, 1.6], [6, -2, 1],
  ]
  for (const [dx, dy, l] of horns) c.set(hx + dx, hy - 3 + dy, shade(HORN, l, 0, 0))
  legs(true)
}

type Lasso =
  | { kind: 'twirl'; angle: number; r: number }
  | { kind: 'loose'; x: number; y: number; rx: number; ry: number; sag: number }
  | { kind: 'caught'; tight: number }

function lasso(f: number, head: Point, hand: Point): Lasso {
  if (f >= HOME || f < WIND) {
    const t = f >= HOME ? f - HOME : f + LOOP - HOME
    return { kind: 'twirl', angle: (t / (WIND + LOOP - HOME)) * Math.PI * 3, r: 2.4 + Math.min(1, t / 10) * 2 }
  }
  if (f < THROW) {
    const t = ease.inOut(beat(f, WIND, THROW))
    return { kind: 'loose', x: hand.x - 4 - t * 2, y: hand.y - 2 + t, rx: lerp(6.2, 4.4, t), ry: 1.3 + t * 0.6, sag: 0.4 }
  }
  if (f < LAND) {
    const t = beat(f, THROW, LAND)
    const x = lerp(hand.x - 6, head.x, t)
    const y = lerp(hand.y - 1, head.y - 3, t) - Math.sin(t * Math.PI) * 5
    return { kind: 'loose', x, y, rx: 4.4 - t * 1.8, ry: 1.9 + t * 1.4, sag: 1.8 * (1 - t) + 0.8 }
  }
  if (f < CINCH) {
    const t = beat(f, LAND, CINCH)
    return { kind: 'loose', x: head.x - t, y: head.y - 3 + t * 2, rx: lerp(2.6, 1, t), ry: lerp(3.3, 2, t), sag: 0.8 + t * 0.6 }
  }
  if (f < FREE) return { kind: 'caught', tight: Math.min(1, (f - CINCH + 1) / 3) }
  if (f < REEL) {
    const t = ease.out(beat(f, FREE, REEL))
    return { kind: 'loose', x: head.x + 1 + t * 3, y: head.y - 3 - t * 3, rx: 1.8 + t * 1.8, ry: 2.2, sag: 2 + t * 2 }
  }
  const t = ease.inOut(beat(f, REEL, HOME))
  return {
    kind: 'loose',
    x: lerp(head.x + 4, hand.x + 1, t),
    y: lerp(head.y - 6, hand.y - 2, t) + Math.sin(t * Math.PI) * 6,
    rx: 3.6 - t * 1.2,
    ry: 2.2 - t * 0.9,
    sag: 4 * (1 - t) + 0.4,
  }
}

function ropeOn(c: Canvas, x: number, y: number, lit: number): number {
  const bg = c.get(x, y)
  const luma = ((bg >> 16) & 255) * 0.3 + ((bg >> 8) & 255) * 0.59 + (bg & 255) * 0.11
  return shade(ROPE, luma > 150 ? 0.6 + lit : 4 + lit, 0, 0)
}

function drawRope(c: Canvas, a: Point, b: Point, sag: number, from: Point = a): void {
  let prev = a
  const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 1.2))
  const pts: Point[] = []
  for (let i = 1; i <= n; i++) {
    const t = i / n
    const next = { x: lerp(from.x, b.x, t), y: lerp(from.y, b.y, t) + Math.sin(t * Math.PI) * sag }
    pts.push(prev, next)
    prev = next
  }
  const marks = new Map<number, number>()
  for (let i = 0; i < pts.length; i += 2) {
    const p = pts[i] ?? a
    const q = pts[i + 1] ?? b
    const probe = new Canvas()
    probe.line(p.x, p.y, q.x, q.y, 1)
    probe.px.forEach((v, k) => {
      if (v && !marks.has(k)) marks.set(k, ropeOn(c, k % W, Math.floor(k / W), 0))
    })
  }
  paintThin(c, marks)
}

function paintThin(c: Canvas, marks: Map<number, number>): void {
  for (const k of [...marks.keys()].sort((a, b) => a - b)) {
    const x = k % W
    const hasH = (x > 0 && marks.has(k - 1)) || (x < W - 1 && marks.has(k + 1))
    const hasV = marks.has(k - W) || marks.has(k + W)
    if (hasH && hasV) marks.delete(k)
  }
  for (const [k, color] of marks) c.set(k % W, Math.floor(k / W), color)
}

function drawLoop(c: Canvas, x: number, y: number, rx: number, ry: number): void {
  const marks = new Map<number, number>()
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2
    const px = Math.round(x + Math.cos(a) * rx)
    const py = Math.round(y + Math.sin(a) * ry)
    if (px < 0 || px >= W || py < 0 || py >= H) continue
    const k = py * W + px
    if (!marks.has(k)) marks.set(k, ropeOn(c, px, py, Math.sin(a) < 0 ? 0.8 : 0))
  }
  paintThin(c, marks)
}

function drawRider(c: Canvas, seat: Point, lean: number, hand: Point): Point {
  const sx = Math.round(seat.x)
  const sy = Math.round(seat.y)
  c.line(sx, sy, sx + 2, sy + 1, shade(JEANS, 3, 0, 0))
  c.line(sx + 2, sy + 1, sx + 1, sy + 4, shade(JEANS, 2, 0, 0))
  c.set(sx + 1, sy + 5, HAT[0] ?? 0)
  c.set(sx + 2, sy + 5, HAT[0] ?? 0)
  const tx = sx + Math.round(lean)
  for (let j = 0; j < 4; j++) {
    const x0 = sx + Math.round(lean * (j / 3)) - 1
    for (let i = 0; i < 3; i++) c.set(x0 + i, sy - j, shade(SHIRT, i === 0 ? 4.6 : i === 1 ? 3 : 2, 0, 0))
  }
  c.line(tx + 1, sy - 2, tx + 3, sy - 1, shade(SHIRT, 2.2, 0, 0))
  c.set(tx + 4, sy - 1, shade(SKIN, 2.4, 0, 0))
  const hy = sy - 6
  c.set(tx, hy + 1, shade(SKIN, 3, 0, 0))
  c.set(tx + 1, hy + 1, shade(SKIN, 2, 0, 0))
  c.set(tx, hy, shade(SKIN, 2.6, 0, 0))
  c.set(tx + 1, hy, shade(SKIN, 1.8, 0, 0))
  for (let i = -2; i <= 3; i++) c.set(tx + i, hy - 1, shade(HAT, i < 0 ? 6 : i < 2 ? 4.4 : 3.2, 0, 0))
  for (let i = -1; i <= 2; i++) c.set(tx + i, hy - 2, shade(HAT, i < 1 ? 4.4 : 2.8, 0, 0))
  c.set(tx, hy - 3, shade(HAT, 4, 0, 0))
  c.set(tx + 1, hy - 3, shade(HAT, 3, 0, 0))
  const shoulder = { x: tx - 1, y: sy - 3 }
  const elbow = { x: Math.round(lerp(shoulder.x, hand.x, 0.5) - 1), y: Math.round(lerp(shoulder.y, hand.y, 0.5)) }
  c.line(shoulder.x, shoulder.y, elbow.x, elbow.y, shade(SHIRT, 4.4, 0, 0))
  c.line(elbow.x, elbow.y, hand.x, hand.y, shade(SHIRT, 4, 0, 0))
  c.set(hand.x, hand.y, shade(SKIN, 3.4, 0, 0))
  return { x: tx, y: sy - 3 }
}

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const cheer = f >= CINCH && f < CINCH + 14 ? Math.sin(((f - CINCH) / 14) * Math.PI) : 0
    drawSky(c)
    drawStands(c, f, cheer)
    drawFence(c, f)
    drawDirt(c, f)

    const p = (f % STRIDE) / STRIDE
    const bob = Math.round(Math.sin(p * Math.PI * 2) * 0.6)
    const sitBack = f >= CINCH && f < CINCH + 6 ? Math.sin(((f - CINCH) / 6) * Math.PI) : 0
    const bx = HORSE_X
    const by = 21 + bob
    const stx = steerX(f)
    const buck = f >= BUCK && f < FREE + 3 ? Math.sin(beat(f, BUCK, FREE + 3) * Math.PI) : 0
    const yank = f >= CINCH && f < CINCH + 5 ? Math.sin(((f - CINCH) / 5) * Math.PI) : 0
    const sty = 21.5 + Math.round(Math.sin((p + 0.3) * Math.PI * 2) * 0.5)
    const head = { x: stx + 8 - yank, y: sty - 1 + buck * 2.8 - yank * 2 }

    for (const [sx, w] of [[bx + 6, 12], [stx + 5, 10]] as const) {
      for (let x = Math.round(sx - w); x <= Math.round(sx + w); x++) {
        for (const y of [GROUND, GROUND + 1, GROUND + 2]) {
          if (Math.abs(x - sx) >= w - (y - GROUND) * 2.5) continue
          const lv = DIRT.indexOf(c.get(x, y))
          c.set(x, y, shade(DIRT, Math.max(0, (lv < 0 ? 4 : lv) - 1.6), x, y))
        }
      }
    }
    drawPuffs(c, f, STEER_DUST, steerX)
    drawSteer(c, f, stx, sty, buck, head)
    drawPuffs(c, f, HORSE_DUST, () => HORSE_X)

    const leanBack = ease.inOut(beat(f, CINCH, CINCH + 4)) - ease.inOut(beat(f, FREE, FREE + 4))
    const lean = 1 - leanBack * 1.6 - sitBack * 0.8
    const seat = { x: bx - 1, y: by - 4 }
    const tx = Math.round(seat.x + lean)
    const top = { x: tx, y: Math.round(seat.y) - 3 }
    const overhead = { x: top.x, y: top.y - 7 }
    const steady = { x: overhead.x, y: overhead.y - bob }
    const state = lasso(f, head, steady)
    let hand = overhead
    if (state.kind === 'twirl') hand = { x: overhead.x + Math.round(Math.cos(state.angle)), y: overhead.y + Math.round(Math.sin(state.angle) * 0.6) }
    else if (f < THROW) {
      const t = ease.inOut(beat(f, WIND - 1, THROW - 1))
      hand = { x: top.x + Math.round(lerp(-1, -2, t)), y: top.y - Math.round(lerp(7, 4, t)) }
    }
    else if (f < LAND) {
      const t = ease.out(beat(f, THROW, THROW + 3))
      hand = { x: top.x + Math.round(lerp(-2, 4, t)), y: top.y - Math.round(lerp(4, 0, t)) }
    } else if (f < REEL) hand = { x: top.x + 3, y: top.y + 1 }
    else hand = { x: top.x + 3 - (Math.floor((f - REEL) / 2) % 2) * 2, y: top.y + 1 - (Math.floor((f - REEL) / 2) % 2) }

    const grip = { x: hand.x, y: hand.y - bob }
    const drawLasso = () => {
      if (state.kind === 'caught') {
        drawRope(c, hand, { x: head.x - 2, y: head.y - 1 }, (1 - state.tight) * 1.2, grip)
        drawLoop(c, head.x - 1, head.y - 1, 1, 2)
      } else if (state.kind === 'twirl') {
        const lx = steady.x + Math.cos(state.angle) * (1 + state.r * 0.7)
        const ly = steady.y - 2 + Math.sin(state.angle) * state.r * 0.3
        const rx = state.r + 1.8
        drawRope(c, hand, { x: lx - Math.cos(state.angle) * rx, y: ly - Math.sin(state.angle) }, 0)
        drawLoop(c, lx, ly, rx, 1.3)
      } else {
        drawRope(c, hand, { x: state.x - state.rx, y: state.y }, state.sag, grip)
        drawLoop(c, state.x, state.y, state.rx, state.ry)
      }
    }
    const isBehind = f >= LAND && f < HOME
    if (isBehind) drawLasso()
    drawHorse(c, f, bx, by, sitBack)
    drawRider(c, seat, lean, hand)
    if (!isBehind) drawLasso()
  })
}

export const scene: Scene = { verb: 'Wrangling', render, hero: 32 }
