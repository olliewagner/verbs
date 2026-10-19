import { Canvas, TAU, beat, clamp, ease, frames, hash, hex, lerp, mod, shade, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72
const HORIZON = 17
const WATER = 24
const WAVE_ROWS = [18, 19, 21, 22, 24, 26, 28, 30]

const SKY = hex('2d63b4 3a78c6 4f8ed4 69a6e0 88bee9 aad3f0 cbe6f5')
const CLOUD = hex('7fa6d0 a3c3e2 c8dcee e6f0f5 f8fbfa')
const SEA = hex('0b2a4f 0f3e6b 155a8a 1e78a6 2f96bd 4fb3cf 7fcfdd b5e6e8 e8f8f4')
const SAIL = hex('34406a 4f5e8a 7584a8 9eabc4 c3c9d6 dedfdc f0ece2 fffbf2')
const HULL = hex('1a0f12 2b1918 432519 5e3420 7c4828 9c5f33')
const BAND = hex('5a3a12 8a5a1a b8822a dcae48 f2d27a')
const SPAR = hex('22161a 3a2620 56392a')
const ROPE = 0x3d4c70
const PENNANT = hex('4e1016 7a1a1e a6281f cf4229 ee6a3a f79a5e')
const FOAM = 0xf2fbf8

function wind(f: number): number {
  if (f < 24 || f >= 63) return 0
  if (f < 33) return ease.outBack(beat(f, 24, 33) ** 1.5)
  if (f < 54) return 1
  return 1 - ease.inOut(beat(f, 54, 63))
}

const gustFront = (f: number) => lerp(-24, 96, ease.inOut(beat(f, 15, 35)))

const SPEED = Array.from({ length: LOOP }, (_, f) => 0.45 + 1.9 * clamp(wind(f), 0, 1))
const OFFSET = SPEED.reduce<number[]>((acc, v, i) => (acc.push((acc[i - 1] ?? 0) + (i ? (SPEED[i - 1] ?? 0) : 0)), acc), [])
const TRAVEL = SPEED.reduce((a, b) => a + b, 0)

type Sail = { x0: number; x1: number; yard: number; h: number; drop: number; furl: number; seed: number }

const MASTS = [
  { x: 22, top: 5, pennant: 6 },
  { x: 32, top: 2, pennant: 11 },
  { x: 42, top: 3, pennant: 8 },
]
const SAILS: Sail[] = [
  { x0: 19, x1: 25, yard: 7, h: 4, drop: 9, furl: 60, seed: 1 },
  { x0: 18, x1: 26, yard: 12, h: 5, drop: 12, furl: 57, seed: 2 },
  { x0: 28, x1: 36, yard: 4, h: 5, drop: 7, furl: 61, seed: 3 },
  { x0: 26, x1: 38, yard: 10, h: 7, drop: 10, furl: 58, seed: 4 },
  { x0: 38, x1: 46, yard: 5, h: 5, drop: 8, furl: 60, seed: 5 },
  { x0: 37, x1: 47, yard: 11, h: 6, drop: 11, furl: 57, seed: 6 },
]

function unfurled(f: number, drop: number, furl: number, rows = 7): number {
  if (f < drop || f >= furl + 7) return 0
  const fall = Math.ceil(rows / 2)
  if (f < drop + fall) return Math.min(1, (2 * (f - drop + 1)) / rows)
  if (f === drop + fall) return 1 + 1 / rows
  if (f < furl) return 1
  return 1 - beat(f, furl, furl + 7)
}

function canvasLevel(ln: number, fold: number, full: number): number {
  return 4.1 + full * (0.6 - ln * 1.9 - ln * ln * 0.4) + fold * 2.2 - (1 - full) * 0.3
}
function drawSail(c: Canvas, s: Sail, f: number, dx: number, dy: number, full: number): void {
  const u = unfurled(f, s.drop, s.furl, s.h)
  const x0 = s.x0 + dx
  const x1 = s.x1 + dx
  const yard = s.yard + dy
  const cx = (x0 + x1) / 2
  const half = (x1 - x0) / 2
  const rows = Math.round(u * s.h)
  for (let j = 0; j < rows; j++) {
    const ny = s.h > 1 ? j / (s.h - 1) : 0
    const bow = Math.round(full * Math.sin(Math.PI * Math.min(1, ny)) * 1.2)
    const inset = Math.round((1 - full) * ny * 0.9)
    const isFoot = j === rows - 1
    for (let x = x0 - bow + inset; x <= x1 + bow - inset; x++) {
      const ln = (x - cx) / half
      if (isFoot && full > 0.5 && Math.abs(ln) > 0.78) continue
      const fold = (1 - full) * 0.45 * Math.sin(ln * TAU * 1.25 + f * 0.3 + s.seed * 2)
      const level = canvasLevel(ln, fold, full) - (j === 0 ? 1.1 : 0) - (isFoot ? 0.4 : 0)
      c.set(x, yard + 1 + j, shade(SAIL, level, x, yard + 1 + j))
    }
    if (isFoot && full > 0.5 && rows >= s.h) {
      for (let x = Math.ceil(cx - half * 0.45); x <= Math.floor(cx + half * 0.45); x++) {
        const ln = (x - cx) / half
        c.set(x, yard + 2 + j, shade(SAIL, canvasLevel(ln, 0, full) - 1.2, x, yard + 2 + j))
      }
    }
  }
  for (let x = x0 - 1; x <= x1 + 1; x++) c.set(x, yard, SPAR[x === x0 - 1 || x === x1 + 1 ? 0 : 1] ?? 0)
  if (u < 0.3) {
    for (let x = x0; x <= x1; x++) {
      const isTie = (x - x0) % 3 === 1
      const level = isTie ? 2.4 : 5.4 - (x - x0) / (x1 - x0) * 1.6
      c.set(x, yard - 1, shade(SAIL, level, x, yard - 1))
    }
  }
}
function drawJib(c: Canvas, f: number, dx: number, dy: number, full: number): void {
  const u = unfurled(f, 13, 59)
  if (u <= 0.05) return
  const tack: [number, number] = [57 + dx, 14 + dy]
  const head: [number, number] = [lerp(tack[0], 45 + dx, Math.min(1, u)), lerp(tack[1], 5 + dy, Math.min(1, u))]
  const clew: [number, number] = [lerp(tack[0], 47 + dx - full * 1.5, Math.min(1, u)), lerp(tack[1], 16 + dy, Math.min(1, u))]
  const mid: [number, number] = [(head[0] + clew[0]) / 2 - full * 2.2, (head[1] + clew[1]) / 2]
  const pts: [number, number][] = [head, tack, clew, mid]
  c.poly(pts, (x, y) => {
    const t = clamp((y - head[1]) / Math.max(1, clew[1] - head[1]))
    const ln = clamp((x - lerp(head[0], clew[0], t)) / 6) * 2 - 1
    const fold = (1 - full) * 0.35 * Math.sin(y * 1.3 + f * 0.3)
    return shade(SAIL, canvasLevel(ln * 0.8, fold, full) - 0.3, x, y)
  })
}
function drawPennant(c: Canvas, x: number, y: number, len: number, w: number, f: number, phase: number): void {

  const lim = { x: 0.3, y: 1 }
  const out = { x: 1, y: 0.12 }
  let dirX = lerp(lim.x, out.x, w)
  let dirY = lerp(lim.y, out.y, w)
  const n = Math.hypot(dirX, dirY)
  dirX /= n
  dirY /= n
  const amp = 0.35 + 0.95 * clamp(w)
  const speed = 0.25 + 1.35 * clamp(w)
  let px = x
  let py = y
  for (let i = 0; i < len; i++) {
    const k = i / len
    const phi = i * 1.05 - f * speed * 1.4 + phase
    const off = Math.sin(phi) * amp * k
    const qx = x + dirX * i - dirY * off
    const qy = y + dirY * i + dirX * off
    const level = 3 + Math.cos(phi) * 1.4 * clamp(w + 0.3) - k * 0.8
    if (i > 0) c.line(px, py, qx, qy, shade(PENNANT, level))
    c.set(qx, qy, shade(PENNANT, level))
    if (i < 3) c.set(qx - dirY, qy + dirX, shade(PENNANT, level - 1.2))
    px = qx
    py = qy
  }
}
const HULL_MASK: ReadonlySet<number> = (() => {
  const mask = new Set<number>()
  const c = new Canvas()
  c.poly([[12, 17.5], [21.5, 17.5], [21.5, 19.5], [46.5, 19.5], [49.5, 17.5], [52.5, 17.5], [51.5, 20.5], [48.5, 24.6], [15.5, 24.6], [12.5, 21]], (x, y) => {
    mask.add(y * W + x)
    return undefined
  })
  return mask
})()
const CLOUDS: [number, number, number][][] = [
  [[9, 11, 3], [13, 9, 3.5], [17, 10, 3], [21, 11.5, 2], [6, 12, 2]],
  [[50, 7, 2.5], [54, 5.5, 3], [58, 6.5, 2.5], [61, 7.5, 2]],
]
function cloudLevel(x: number, y: number): number | undefined {
  for (const cloud of CLOUDS) {
    const base = Math.max(...cloud.map(([, cy, r]) => cy + r * 0.5))
    if (y > base) continue
    let best: number | undefined
    for (const [cx, cy, r] of cloud) {
      const d = Math.hypot(x - cx, (y - cy) * 1.15)
      if (d > r) continue
      const lit = 2.6 + ((cx - x) * 0.35 + (cy - y) * 0.8) / r * 1.3 - (y >= base - 0.5 ? 1 : 0)
      best = Math.max(best ?? -9, lit)
    }
    if (best !== undefined) return best
  }
  return undefined
}
const GULL = {
  up: ['d...d', '.d.d.', '..w..'],
  mid: ['.....', 'ddwdd', '.....'],
  down: ['.....', '.dwd.', 'd...d'],
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const w = wind(f)
    const wc = clamp(w)
    const off = OFFSET[f] ?? 0
    const bob = Math.round(0.5 + 0.6 * wave(f, LOOP, 3, 0.1)) > 0 ? 1 : 0
    const surge = Math.round(2 * (f < 27 ? 0 : f < 33 ? ease.out(beat(f, 27, 33)) : f < 56 ? 1 : 1 - ease.inOut(beat(f, 56, 70))))
    const calmAgain = 1 - beat(f, 54, 66)
    c.fill((x, y) => {
      if (y >= HORIZON) return undefined
      const band = 0.5 + (y / HORIZON) * 6 + (x < 20 ? (20 - x) / 40 : 0)
      return shade(SKY, band, x, y)
    })
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 12; x++) {
        const d = Math.hypot(x - 5, (y - 3) * 1.05)
        if (d < 2.6) c.set(x, y, 0xfffbe6)
        else if (d < 4) c.set(x, y, SKY[6] ?? 0)
      }
    }
    c.fill((x, y) => {
      if (y >= HORIZON) return undefined
      const l = cloudLevel(x, y)
      return l === undefined ? undefined : shade(CLOUD, l, x, y)
    })
    for (let x = 0; x < W; x++) {
      const top = 15 + Math.round(Math.sin(x * 0.31) * 0.6 + Math.sin(x * 0.13 + 1) * 0.7)
      for (let y = top; y < HORIZON; y++) c.set(x, y, y === top ? 0xd7ebf3 : 0xc4e1ee)
    }

    const front = gustFront(f)
    const crest = (x: number, y: number, windy: number): number => {
      const d = (y - HORIZON) / (H - 1 - HORIZON)
      const fac = 0.12 + 0.88 * d * d
      const travel = TRAVEL * fac
      const lam = 7 + d * 16
      const k1 = Math.max(1, Math.round(travel / lam))
      const k2 = Math.max(1, Math.round(travel / (lam * 0.57)))
      const u = (x + off * fac) / travel
      return Math.sin(TAU * u * k1 + y * 2.3) + 0.6 * Math.sin(TAU * u * k2 + y * 1.1) + windy * 0.35
    }
    for (let y = HORIZON; y < H; y++) {
      const d = (y - HORIZON) / (H - 1 - HORIZON)
      const isLine = WAVE_ROWS.includes(y)
      const isUnder = WAVE_ROWS.includes(y - 1)
      for (let x = 0; x < W; x++) {
        const gust = f >= 17 && f < 40 ? clamp((front - x) / 14 + 0.3) : 0
        const windy = Math.max(Math.min(gust, 1), f >= 33 ? 1 : 0) * calmAgain
        const isFront = gust > 0.3 && gust < 0.75 && d > 0.15
        let level = lerp(6.2, 3.3, Math.sqrt(d)) - windy * 1.2
        let color: number | undefined
        if (isLine) {
          const s = crest(x, y, windy)
          if (s > 1.05) {
            level += 1.5
            if (x < 13 - d * 4 || (windy > 0.6 && s > 1.45 && d > 0.3) || isFront) color = x < 13 ? 0xfdf8e2 : FOAM
          }
        } else if (isUnder && crest(x, y - 1, windy) > 1.05) level -= 0.8
        if (y === HORIZON) level = 6.6
        c.set(x, y, color ?? shade(SEA, level, x, y))
      }
    }
    const sx = surge
    const sy = bob
    for (let y = WATER + 1; y < WATER + 5; y++) {
      const k = (y - WATER) / 5
      for (let x = 15 + sx; x <= 50 + sx; x++) {
        const wob = Math.sin(y * 2.1 + (x + off) * 0.7)
        const i = SEA.indexOf(c.get(x, y))
        if (wob > -0.2 + k * 0.9 && i >= 0) c.set(x, y, SEA[Math.max(0, i - (k < 0.4 ? 2 : 1))] ?? 0)
      }
    }
    for (const m of MASTS) {
      for (let y = m.top + sy; y <= 19 + sy; y++) c.set(m.x + sx, y, SPAR[y === m.top + sy ? 2 : 1] ?? 0)
    }
    c.line(51 + sx, 18 + sy, 60 + sx, 14 + sy, SPAR[1] ?? 0)
    c.line(42 + sx, 3 + sy, 60 + sx, 14 + sy, ROPE)
    c.line(32 + sx, 2 + sy, 42 + sx, 6 + sy, ROPE)
    c.line(32 + sx, 2 + sy, 22 + sx, 7 + sy, ROPE)
    c.line(22 + sx, 5 + sy, 13 + sx, 17 + sy, ROPE)

    for (const key of HULL_MASK) {
      const lx = key % W
      const ly = Math.floor(key / W)
      const x = lx + sx
      const y = ly + sy
      if (y > WATER) continue
      const isTop = !HULL_MASK.has(key - W)
      const side = (30 - lx) / 70
      let color: number
      if (isTop) color = shade(HULL, 4.6 + side, x, y)
      else if (ly === 21 && lx > 14 && lx < 50) color = lx % 4 === 0 && lx > 22 && lx < 47 ? (HULL[0] ?? 0) : shade(BAND, 2.6 + side * 1.5, x, y)
      else if (ly === 19 && lx < 21 && lx > 13 && lx % 2 === 0) color = shade(BAND, 4, x, y)
      else color = shade(HULL, (ly >= 23 ? 1.6 : 2.6) + side, x, y)
      c.set(x, y, color)
    }
    for (const s of SAILS) drawSail(c, s, f, sx, sy, wc)
    drawJib(c, f, sx, sy, wc)
    for (const [i, m] of MASTS.entries()) drawPennant(c, m.x + sx + 1, m.top + sy, m.pennant, w, f, i * 1.9)
    for (let x = 14 + sx; x <= 51 + sx; x++) {
      const isFoam = Math.sin((x + off) * 0.9) + Math.sin((x + off * 1.3) * 0.37) > 0.7 - (x > 40 + sx ? wc * 1.5 : 0)
      if (isFoam) c.set(x, WATER + 1, x > 44 + sx ? FOAM : 0xc9ecef)
    }
    if (wc > 0.2) {
      const bx = 50 + sx
      c.set(bx + 1, WATER, FOAM)
      c.set(bx + 2, WATER + 1, FOAM)
      if (wc > 0.6) {
        c.set(bx + 2, WATER, 0xc9ecef)
        c.set(bx + 3, WATER + 1, 0xc9ecef)
      }
    }
    const wakeLen = 3 + wc * 14
    for (let x = 14 + sx; x > 14 + sx - wakeLen; x--) {
      const k = (14 + sx - x) / wakeLen
      if (Math.sin((x + off) * 0.8) > -0.2 + k * 0.9) c.set(x, WATER + 1 + Math.round(k * 0.8), k < 0.4 ? FOAM : 0xb5e6e8)
    }
    for (let b = f - 7; b <= f; b++) {
      if (clamp(wind(mod(b, LOOP))) < 0.5) continue
      for (let i = 0; i < 2; i++) {
        const t = f - b
        const vx = 0.4 + hash(b, i, 1) * 0.7
        const vy = 0.9 + hash(b, i, 2) * 0.8
        const x = 51 + sx + vx * t
        const y = WATER - vy * t + 0.32 * t * t
        if (y > WATER + 1) continue
        c.set(x, y, t < 4 ? FOAM : 0xb5e6e8)
      }
    }
    const gx = mod(70 - f * (80 / LOOP), 80) - 8
    const gy = 13 + Math.round(wave(f, LOOP, 2) * 1.2)
    const flap = Math.floor(f / 3) % 4
    const art = flap === 0 ? GULL.up : flap === 2 ? GULL.down : GULL.mid
    c.sprite(gx, gy, art, { w: 0xfdfdf8, d: 0x2a3550 })
  })
}
export const scene: Scene = { verb: 'Unfurling', render, hero: 42 }
