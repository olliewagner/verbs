import { TAU, beat, clamp, ease, frames, hash, hex, lerp, loopNoise, mix, particles, shade, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const WALL = hex('0e0f0b 15170f 1c1f13 252918 2f3320 3c3f26 4c4d2d 5f5c35 76703f')
const CLOTH = hex('231e19 352d24 4a3f31 615340 7b6a51 978465 b19e7c c9b795 dfd0b0 f0e6cc')
const GLASS = hex('1b1d16 2e3127 4a4c3d 6e6e5a 9a967e c6bf9f e9e1c2 fffaea')
const PALE = hex('2a2414 3d331a 554522 6f5a2b 8b7034 a8893f c4a450 dbbf68')
const AMBER = hex('4a250b 6a350e 8c4912 ad5f17 c97920 de9530 eeb24c')
const DEEP = hex('3e1406 5a1e08 7a2a0b 993a10 b44c16 cc621f')
const LEAF = hex('131a0b 1d2911 2a3a16 3a4f1d 4e6626 668032 829b42 a3b55a')
const PETAL = hex('2c0716 4f0d22 7a162c a82334 cf3a3d ea5f4a f88e6a fcc39a')
const CHINA = hex('3a342e 58504a 7f766c a89f92 cbc3b4 e7e0d0 faf6ec')
const GOLD = hex('8a6a1c b98d2a dcb24a f2d47a fdeeb4')

const CX = 27
const CY = 17
const RX = 14
const RY = 10.5
const MOUTH = 8
const FOOT = 27
const SURFACE = 10
const TABLE = 22

const BODY = 1
const SPOUT = 2
const HANDLE = 3
const LID = 4
const KNOB = 5

const bodyR = (x: number, y: number) => (Math.abs((x - CX) / RX) ** 2.4 + Math.abs((y - CY) / RY) ** 2.4) ** (1 / 2.4)

function spoutAt(x: number, y: number): number {
  const [x0, y0, x1, y1] = [38, 20, 50, 8]
  const dx = x1 - x0
  const dy = y1 - y0
  const s = ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy)
  if (s < 0 || s > 1) return -1
  const d = Math.hypot(x - (x0 + dx * s), y - (y0 + dy * s))
  return d <= lerp(2.5, 1.1, s) ? s : -1
}

const PART: Int8Array = (() => {
  const part = new Int8Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const r = Math.hypot((x - 15) / 7, (y - 16.5) / 6.6)
      part[y * W + x] = y >= MOUTH && y <= FOOT && bodyR(x, y) <= 1 ? BODY
        : y < MOUTH && y >= 5 && ((x - CX) / 8.6) ** 2 + ((y - MOUTH) / 3.2) ** 2 <= 1 ? LID
        : ((x - CX) / 1.6) ** 2 + ((y - 3.8) / 1.3) ** 2 <= 1 ? KNOB
        : spoutAt(x, y) >= 0 ? SPOUT
        : x <= 15 && r >= 0.72 && r <= 1 ? HANDLE
        : 0
    }
  }
  return part
})()
const partAt = (x: number, y: number) => (x < 0 || x >= W || y < 0 || y >= H ? 0 : PART[y * W + x] ?? 0)
const isEdge = (x: number, y: number) => {
  const p = partAt(x, y)
  return p !== 0 && (partAt(x - 1, y) !== p || partAt(x + 1, y) !== p || partAt(x, y - 1) !== p || partAt(x, y + 1) !== p)
}

function pose(f: number) {
  const swell = f < 16 ? ease.inOut(beat(f, 8, 16)) : 1 - ease.out(beat(f, 16, 22))
  const open = f < 52 ? ease.outBack(beat(f, 16, 30)) : 1 - ease.inOut(beat(f, 54, 70))
  const rise = f < 52 ? ease.inOut(beat(f, 21, 33)) : 1 - ease.inOut(beat(f, 55, 67))
  const bloom = f < 50 ? ease.outBack(beat(f, 28, 38)) : 1 - ease.inOut(beat(f, 50, 60))
  const sway = wave(f, LOOP, 2, 0.1) * rise

  return { swell, open, rise, bloom, sway }
}

type Wisp = { t0: number; x: number; y: number; phase: number; lean: number; top: number }
const WISPS: Wisp[] = [
  { t0: 18, x: CX - 4, y: 23, phase: 0, lean: -0.16, top: 13 },
  { t0: 20, x: CX + 4, y: 23, phase: 2.1, lean: 0.14, top: 15 },
  { t0: 24, x: CX - 7, y: 24, phase: 4, lean: -0.08, top: 17 },
  { t0: 27, x: CX + 7, y: 24, phase: 1.3, lean: 0.1, top: 14 },
  { t0: 31, x: CX - 1, y: 21, phase: 3.3, lean: -0.3, top: 16 },
]
const WISP_LIFE = 34

function plume(w: Wisp, f: number, x: number, y: number): number {
  const a = f - w.t0
  if (a < 0 || a > WISP_LIFE) return 0
  const fade = 1 - ease.inOut(beat(a, 15, WISP_LIFE))
  const spread = ease.out(beat(a, 14, WISP_LIFE))
  const climb = ease.out(Math.min(1, a / 18))
  const headY = w.y - climb * (w.y - w.top)
  const tailY = w.y - beat(a, 12, 30) * (w.y - headY)
  const centre = (yy: number) => {
    const along = w.y - yy
    return w.x + Math.sin(along * 0.5 + w.phase - a * 0.18) * (0.3 + along * 0.1) + w.lean * along
  }
  let d = 0
  if (y >= headY && y <= tailY) {
    const along = w.y - y
    const width = 0.6 + along * 0.06 + spread * 1.4
    d = Math.max(d, (1 - Math.abs(x - centre(y)) / width) * 0.8)
  }
  const hx = centre(headY)
  const r = 1.3 + climb * 1.2 + spread * 1.8
  const flat = 1 + spread * 0.25
  for (const side of [-1, 1]) {
    const lx = hx + side * r * 0.6 * flat
    const ly = headY + r * 0.2 / flat
    const dist = Math.hypot((x - lx) / flat, (y - ly) * flat) / (r * (side < 0 ? 1.08 : 0.92))
    d = Math.max(d, dist < 1 ? (1 - dist * dist) * 1.05 : 0)
  }
  const dome = Math.hypot((x - hx) / (r * 1.1 * flat), (y - headY + r * 0.25) / (r * 0.7 / flat))
  d = Math.max(d, dome < 1 ? (1 - dome * dome) * 0.6 : 0)
  return d * fade
}

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const p = pose(f)
    const tf = f / LOOP
    const glow = WISPS.reduce((s, w) => s + Math.sin(Math.PI * beat(f - w.t0, 0, WISP_LIFE)), 0) / 2.6

    const tea = (x: number, y: number) => {
      const wx = x + (loopNoise(x * 0.2, y * 0.25, tf, 2, 3) - 0.5) * 3
      const wy = y + (loopNoise(x * 0.2 + 9, y * 0.25, tf, 2, 4) - 0.5) * 2
      return WISPS.reduce((m, w) => Math.max(m, plume(w, f, wx, wy)), 0)
    }

    for (let y = 0; y < TABLE; y++) {
      for (let x = 0; x < W; x++) {
        const u = x + y * 0.62
        const isSun = u > 1 && u < 19 && Math.abs(u - 10) > 0.8 && y < 19 && Math.abs(y - 9) > 0.5
        const vignette = ((x - 26) / 40) ** 2 + ((y - 12) / 22) ** 2
        c.set(x, y, shade(WALL, 3.2 + (isSun ? 1.7 : 0) - vignette * 2.4 - y * 0.02 + (x < 40 ? 0 : -0.3)))
      }
    }
    for (let y = TABLE; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let lit = 5.2 - x * 0.035 + (y - TABLE) * 0.1 - (y === TABLE ? 1.2 : 0)
        const sd = ((x - CX - 12) / 15) ** 2 + ((y - 29.2) / 2.4) ** 2
        if (y >= FOOT && sd <= 1) lit -= 1.8 + (sd < 0.4 ? 0.6 : 0)
        c.set(x, y, y === 30 ? mix(shade(CLOTH, lit - 1.2), 0x7a3324, 0.45) : shade(CLOTH, lit))
        const k = ((x - CX - 11) / (1.8 + glow * 2.6)) ** 2 + ((y - 29.2) / (0.8 + glow * 0.5)) ** 2
        if (k <= 1 && glow > 0.15) c.set(x, y, shade(GOLD, glow * 2.4 - k * 1.6 - (y === 30 ? 0.8 : 0)))
      }
    }

    for (let x = 0; x <= 8; x++) {
      c.set(x, 27, shade(CHINA, 5 - x * 0.25 - (x === 8 ? 1 : 0)))
      if (x > 0 && x < 8) c.set(x, 28, shade(CHINA, 2.4 - x * 0.1))
    }
    for (const [bx, by] of [[2, 25], [6, 25], [4, 24]] as const) {
      c.ellipse(bx, by + 0.4, 1.6, 1.4, (x, y) => shade(LEAF, 2.6 - (x - bx) * 0.9 - (y - by) * 0.9))
    }

    for (let x = 50; x <= 62; x++) {
      const isRim = x === 50 || x === 62
      c.set(x, 27, shade(CHINA, 4.6 - (x - 50) * 0.18 - (isRim ? 1 : 0)))
      if (!isRim) c.set(x, 28, shade(CHINA, 2.2 - (x - 50) * 0.08))
    }
    for (let y = 22; y <= 26; y++) {
      const inset = y === 26 ? 1 : 0
      for (let x = 52 + inset; x <= 60 - inset; x++) {
        c.set(x, y, shade(CHINA, 5.3 - (x - 52) * 0.42 - (y - 22) * 0.1 + (x === 53 && y < 25 ? 0.7 : 0)))
      }
    }
    for (let x = 53; x <= 59; x++) c.set(x, 22, shade(AMBER, x < 56 ? 5 : 4))
    c.set(52, 22, CHINA[6] ?? 0)
    c.set(60, 22, CHINA[3] ?? 0)
    for (const [x, y] of [[61, 23], [62, 23], [62, 24], [61, 25]] as const) c.set(x, y, shade(CHINA, 2.4))

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const part = partAt(x, y)
        if (part === BODY || part === SPOUT) {
          if (y < SURFACE || (part === SPOUT && y < SURFACE + 1)) {
            c.tint(x, y, GLASS[4] ?? 0, 0.16)
            continue
          }
          const lit = 2.2 + clamp(1 - (x - 13) / 30) * 4.2 - (y > 23 ? (y - 23) * 0.4 : 0) + (y === SURFACE + 1 ? 0.6 : 0)
          const d = part === SPOUT ? 0 : tea(x, y)
          c.set(x, y, d > 0.8 ? shade(DEEP, lit * 0.62 + 0.8) : d > 0.3 ? shade(AMBER, lit * 0.8 + 0.6) : shade(PALE, lit))
        } else if (part === LID || part === KNOB || part === HANDLE) {
          c.tint(x, y, GLASS[4] ?? 0, part === HANDLE ? 0.3 : 0.2)
        }
      }
    }
    const ripple = f >= 25 && f < 31 ? 1 - (f - 25) / 6 : 0
    for (let x = 13; x <= 48; x++) {
      const part = partAt(x, SURFACE)
      if (part !== BODY && part !== SPOUT) continue
      const isRing = ripple > 0 && Math.abs(Math.abs(x - CX - 1) - (f - 24) * 1.5) < 1
      c.set(x, SURFACE, shade(GOLD, 3.6 - (x - 13) * 0.08 + (isRing ? ripple * 1.5 : 0)))
    }

    const ballR = 3.6 * (1 + p.swell * 0.14) * (1 - p.open * 0.6)
    const ballY = 22.4 + p.open * 1.6
    for (let y = Math.floor(ballY - ballR); y <= Math.ceil(ballY + ballR); y++) {
      for (let x = Math.floor(CX - ballR); x <= Math.ceil(CX + ballR); x++) {
        const dx = (x - CX) / ballR
        const dy = (y - ballY) / ballR
        if (dx * dx + dy * dy > 1) continue
        const ridge = Math.abs(((Math.atan2(dy, dx) * 3 + Math.hypot(dx, dy) * 4) % 2 + 2) % 2 - 1) < 0.3
        c.set(x, y, shade(LEAF, 2.6 - (dx + dy) * 1.3 - (ridge ? 0.8 : 0) + p.swell * 0.6))
      }
    }
    const order = [0, 8, 1, 7, 2, 6, 3, 5, 4]
    for (const i of order) {
      const t = i / 8 - 0.5
      const a = t * lerp(0.75, 3.05, p.open) + p.sway * 0.06
      const len = lerp(4.6, 8.7, Math.min(1.1, p.open)) * (1 - Math.abs(t) * 0.22) * (1 + p.swell * 0.12)
      const bend = t * 0.7 * p.open
      const dx = Math.sin(a)
      const dy = -Math.cos(a)
      for (let y = 14; y <= 27; y++) {
        for (let x = 15; x <= 39; x++) {
          const vx = x - CX
          const vy = y - 25.6
          const s = (vx * dx + vy * dy) / len
          if (s < 0.05 || s > 1) continue
          const q = vx * Math.cos(a) + vy * Math.sin(a) - bend * s * s * len
          const w = lerp(1.25, 1.75, p.open) * Math.sin(Math.PI * s) ** 0.6
          if (Math.abs(q) > w) continue
          const isVein = p.open > 0.45 && Math.abs(q) < 0.5 && s > 0.2 && s < 0.85
          c.set(x, y, shade(LEAF, 2.3 + s * 1.6 + (q < -0.4 ? 0.9 : q > 0.5 ? -0.5 : 0) - dx * 0.5 + p.open * 0.5 - (isVein ? 0.9 : 0)))
        }
      }
    }

    if (p.rise > 0.02) {
      const hx = Math.round(CX + p.sway * 1.2)
      const hy = Math.round(22.5 - p.rise * 8.6)
      c.line(CX, 24, hx, hy + 1, (x, y) => shade(LEAF, 4 + (x < CX ? 0.6 : 0) + (y < 18 ? 0.5 : 0)))
      if (p.rise > 0.35) {
        for (const [k, side] of [[0.38, -1], [0.68, 1]] as const) {
          const sy = Math.round(lerp(24, hy, k))
          const sx = Math.round(lerp(CX, hx, k)) + side
          const big = p.bloom > 0.4
          c.set(sx, sy, CHINA[big ? 6 : 5] ?? 0)
          c.set(sx + side, sy, CHINA[4] ?? 0)
          if (big) c.set(sx, sy + 1, CHINA[3] ?? 0)
        }
      }
      if (p.bloom < 0.08) {
        const k = 0.45 + 0.55 * clamp(p.rise * 6)
        c.ellipse(hx, hy, 1.2 * k, 1.7 * k, (x, y) => shade(PETAL, 3.4 + (x < hx ? 0.8 : 0) - (y > hy ? 0.6 : 0)))
      } else {
        const R = 1 + 3 * p.bloom
        const petals = Array.from({ length: 6 }, (_, k) => k * (TAU / 6) + 0.26 + p.sway * 0.1)
        petals.sort((a, b) => Math.sin(a) - Math.sin(b))
        for (const phi of petals) {
          const px = hx + Math.cos(phi) * R * 0.6
          const py = hy + Math.sin(phi) * R * 0.45
          const pr = 0.6 + R * 0.42
          c.ellipse(px, py, pr, pr * 0.8, (x, y) => {
            const out = Math.hypot(x - hx, (y - hy) * 1.3) / (R + 0.6)
            return shade(PETAL, 2.6 + out * 2.8 + (x < px ? 0.6 : -0.2) - (y > py + 0.5 ? 0.6 : 0) + Math.sin(phi) * 0.5)
          })
        }
        c.rect(hx - (p.bloom > 0.6 ? 1 : 0), hy, p.bloom > 0.6 ? 2 : 1, 1, GOLD[3] ?? 0)
        if (p.bloom > 0.6) c.set(hx - 1, hy - 1, GOLD[4] ?? 0)
      }
    }

    if (f >= 14 && f < 25) {
      const t = f - 14
      const by = Math.round(20 - t * 0.95)
      const bx = Math.round(CX + 1 + Math.sin(t * 0.9) * 0.6)
      c.set(bx, by, GLASS[7] ?? 0)
      c.set(bx + 1, by, GLASS[5] ?? 0)
      c.set(bx, by + 1, GLASS[5] ?? 0)
      c.set(bx + 1, by + 1, GLASS[4] ?? 0)
    }
    for (const b of particles(f, LOOP, 7, 16, 5)) {
      const by = Math.round(23 - b.t * 0.8)
      if (by <= SURFACE) continue
      const bx = Math.round(CX - 4 + b.r[1] * 8 + Math.sin(b.t * 0.7 + b.r[2] * 6))
      c.set(bx, by, GLASS[6] ?? 0)
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const part = partAt(x, y)
        if (!isEdge(x, y)) continue
        const ang = Math.atan2(y - CY, x - CX)
        let lit = 2.8 + Math.cos(ang + 2.45) * 3
        if (part === BODY && y < SURFACE) lit = Math.max(lit, 3)
        if (part === HANDLE) lit = x < 10 && y < 19 ? 5.6 : x < 12 ? 3.4 : 2.4
        if (part === SPOUT) lit = partAt(x - 1, y) === 0 || partAt(x, y - 1) === 0 ? 4.8 : 2.6
        if (part === LID || part === KNOB) lit = 3.8 + (x < CX ? 1.8 : 0) + (part === KNOB && y < 4 ? 1 : 0)
        c.set(x, y, shade(GLASS, lit))
      }
    }
    for (let y = MOUTH; y <= 24; y++) {
      for (let x = 13; x <= 30; x++) {
        if (partAt(x, y) !== BODY) continue
        const r = bodyR(x, y)
        const ang = Math.atan2((y - CY) / RY, (x - CX) / RX)
        if (r > 0.74 && r < 0.86 && ang > -2.75 && ang < -1.95) c.set(x, y, GLASS[7] ?? 0)
        if (r > 0.74 && r < 0.86 && ang > 2.55 && ang < 2.85) c.set(x, y, shade(GLASS, 5.4))
      }
    }
    c.set(39, 12, GLASS[6] ?? 0)
    c.set(39, 13, GLASS[5] ?? 0)
    for (let x = 22; x <= 32; x++) c.set(x, FOOT, shade(GLASS, x < 27 ? 5 : 3.4))

    const steam = [
      ...particles(f, LOOP, 6, 22, 9).map(q => ({ q, x0: 50, y0: 6 })),
      ...particles(f, LOOP, 4, 18, 13).map(q => ({ q, x0: 56, y0: 20 })),
    ]
    for (const { q, x0, y0 } of steam) {
      const y = Math.round(y0 - q.t * 0.45)
      const x = Math.round(x0 + Math.sin(q.t * 0.35 + q.r[1] * 6) * 1.4 + q.age * 2)
      const alpha = Math.sin(Math.PI * q.age) > 0.6 ? 0.4 : 0.25
      if (Math.sin(Math.PI * q.age) < 0.3) continue
      c.tint(x, y, GLASS[6] ?? 0, alpha)
      c.tint(x, y - 1, GLASS[6] ?? 0, 0.25)
    }

    for (let i = 0; i < 6; i++) {
      const u = (hash(i, 7) + tf * (0.5 + hash(i, 8))) % 1
      const x = Math.round(2 + hash(i, 9) * 12 + Math.sin(TAU * (tf * 2 + hash(i, 3))) * 1.5)
      const y = Math.round(1 + u * 16)
      const twinkle = Math.sin(TAU * (tf * 3 + hash(i, 4)))
      if (twinkle > -0.3 && partAt(x, y) === 0) c.set(x, y, twinkle > 0.5 ? 0xe8d49a : 0xa89a6a)
    }
  })
}

export const scene: Scene = { verb: 'Infusing', render, hero: 40 }
