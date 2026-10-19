import { TAU, beat, clamp, ease, frames, hash, hex, lightAt, noise, particles, shade, type Light, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const AMETHYST = hex('140a24 1f1038 2d1754 401f73 562a91 6f3aad 8b52c5 aa74d9 c99ce9 e7c9f6 fdf2ff')
const DRUSE = hex('0b0716 120b21 1a102e 23163c 2e1d4b 3b265b')
const AGATE = hex('1f1e2b 2f3045 444862 61688a 858fab adb6cb d6dce8')
const RIND = hex('120d0d 1d1614 2a201b 3a2c24 4c3a2e 614a3a 7a5f49')

const CX = 32
const CY = 16
const RX = 29
const RY = 12.4
const P = 2.6

const wallR = (th: number) => 1 + 0.05 * Math.sin(2 * th + 0.6) + 0.035 * Math.sin(5 * th + 2.1) + 0.02 * Math.sin(9 * th + 4)

function wallAt(th: number): [number, number] {
  const r = wallR(th)
  const cx = Math.cos(th)
  const sy = Math.sin(th)
  const k = r / (Math.abs(cx) ** P + Math.abs(sy) ** P) ** (1 / P)
  return [CX + cx * RX * k, CY + sy * RY * k]
}

function locate(x: number, y: number): { s: number; th: number; out: number } {
  const nx = (x - CX) / RX
  const ny = (y - CY) / RY
  const th = Math.atan2(ny, nx)
  const s = (Math.abs(nx) ** P + Math.abs(ny) ** P) ** (1 / P) / wallR(th)
  const rho = Math.hypot(x - CX, y - CY)
  return { s, th, out: s > 0.01 ? (rho / s) * (s - 1) : -99 }
}

const SUN = [-0.62, -0.55, 0.56].map(k => k / Math.hypot(0.62, 0.55, 0.56))

type Crystal = {
  bx: number; by: number; dx: number; dy: number
  w: number; len: number; tip: number
  start: number; dur: number; fall: number
}

const CRYSTALS: Crystal[] = (() => {
  const list: Crystal[] = []
  const add = (th: number, scale: number, seed: number) => {
    const [wx, wy] = wallAt(th)
    const aim = Math.atan2(CY - wy, (CX - wx) * 0.7) + (hash(seed, 3) - 0.5) * 1.1
    const room = Math.hypot((CX - wx) * 0.6, CY - wy)
    const len = Math.min(10, room * (0.35 + 0.5 * hash(seed, 5) ** 2)) * scale
    const w = clamp(len * 0.26 + hash(seed, 9) * 0.5, 1, 2.6)
    const rise = clamp(1 - (wy - (CY - RY)) / (2 * RY))
    list.push({
      bx: wx - Math.cos(aim) * 0.8, by: wy - Math.sin(aim) * 0.8, dx: Math.cos(aim), dy: Math.sin(aim),
      w, len, tip: Math.max(w * 1.5, len * 0.55),
      start: 3 + rise * 23 + hash(seed, 11) * 3, dur: 4 + len * 0.45 + hash(seed, 13) * 3,
      fall: 52 + rise * 7 + hash(seed, 17) * 2,
    })
  }
  let th = 0.1
  for (let i = 0; th < TAU + 0.05; i++) {
    const size = hash(i, 21)
    const n = 2 + Math.floor(hash(i, 22) * 3)
    for (let j = 0; j < n; j++) add(th + (j - n / 2) * 0.07, 0.3 + 0.3 * hash(i, j + 30), 300 + i * 8 + j)
    add(th, size > 0.45 ? 1 : 0.62, 100 + i)
    th += 0.24 + hash(i, 23) * 0.22
  }

  return list.filter(c => !(Math.abs(c.bx - CX) < 7 && c.by > CY)).sort((a, b) => a.len - b.len)
})()

const FLOOR = wallAt(TAU / 4)
const HERO: Crystal = {
  bx: CX + 0.5, by: FLOOR[1] + 1, dx: 0.05, dy: -0.999, w: 3.6, len: 16.5, tip: 6,
  start: 33, dur: 9, fall: 59,
}
const FLANKS: Crystal[] = [
  { bx: CX - 3.5, by: FLOOR[1] + 1, dx: -0.38, dy: -0.92, w: 2.1, len: 9, tip: 3.6, start: 31, dur: 8, fall: 58 },
  { bx: CX + 4.5, by: FLOOR[1] + 1, dx: 0.33, dy: -0.94, w: 2.3, len: 10.5, tip: 4, start: 32, dur: 8, fall: 58 },
]
const FLASH = 42
const GLINT = [46, 58] as const

const smooth = (t: number) => t * t * (3 - 2 * t)

function lengthOf(c: Crystal, f: number): number {
  if (c === HERO) {
    const peek = smooth(beat(f, 27, 31)) * 3
    const rise = smooth(beat(f, c.start, c.start + c.dur))
    return (peek + rise * (c.len - 3)) * (1 - smooth(beat(f, c.fall, c.fall + 12)))
  }
  return c.len * smooth(beat(f, c.start, c.start + c.dur)) * (1 - smooth(beat(f, c.fall, c.fall + 5 + c.len * 0.6)))
}

function hit(c: Crystal, len: number, x: number, y: number): { t: number; u: number } | undefined {
  const px = x - c.bx
  const py = y - c.by
  const u = px * c.dx + py * c.dy
  const v = -px * c.dy + py * c.dx
  if (u < -Math.min(2, len * 0.5) || u > len) return undefined
  const half = u < len - c.tip ? c.w : (c.w * (len - u)) / c.tip
  if (Math.abs(v) > half + 0.2) return undefined
  return { t: v / Math.max(0.4, half + 0.2), u }
}

function facet(c: Crystal, t: number, isPoint: boolean): number {
  const side = c.w < 1.6 ? (t < 0 ? -1 : 1) : t < -0.34 ? -1 : t > 0.34 ? 1 : 0
  const nx = -c.dy * side * 0.85
  const ny = c.dx * side * 0.85
  const nz = side === 0 ? 1 : 0.55
  const tilt = isPoint ? 0.55 : 0
  const x = nx + c.dx * tilt
  const y = ny + c.dy * tilt
  const d = (x * (SUN[0] ?? 0) + y * (SUN[1] ?? 0) + nz * (SUN[2] ?? 0)) / Math.hypot(x, y, nz)

  return Math.max(0, d)
}

function glowOf(f: number): number {
  const grown = beat(f, 4, 32) * 0.28 + 0.1 * beat(f, 34, FLASH)
  const sink = 1 - ease.inOut(beat(f, 55, 69))
  return 0.66 + grown * sink + (f >= FLASH ? 0.45 * 0.6 ** (f - FLASH) : 0)
}

type Ground = { s: number; out: number; th: number; grain: number; coarse: number }
const GROUND: Ground[] = Array.from({ length: W * H }, (_, i) => {
  const x = i % W
  const y = Math.floor(i / W)
  return { ...locate(x, y), grain: noise(x * 0.2, y * 0.34, 0, 3), coarse: noise(x * 0.13, y * 0.2, 0, 8) }
})

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const glow = glowOf(f)
    const heroLen = lengthOf(HERO, f)
    const tipX = HERO.bx + HERO.dx * heroLen
    const tipY = HERO.by + HERO.dy * heroLen
    const flash = f >= FLASH ? 0.6 ** (f - FLASH) : 0
    const lamp: Light[] = heroLen > 3
      ? [{ x: tipX, y: tipY + 3, power: 0.25 * beat(heroLen, 3, HERO.len) * (1 - beat(f, 56, 64)) + flash * 0.7, radius: 16 + flash * 14 }]
      : []

    const level = new Float32Array(W * H)
    const ramp: (readonly number[])[] = []
    for (let i = 0; i < W * H; i++) {
      const x = i % W
      const y = Math.floor(i / W)
      const g = GROUND[i]
      if (!g) continue
      const key = ((CX - x) * 0.35 + (CY - y) * 0.8) / 24
      const extra = lightAt(lamp, x, y)
      if (g.out < 0) {
        const bowl = ((x - CX) / RX) * 0.5 + ((y - CY) / RY) * 0.6
        const fur = g.grain > 0.64 ? 0.7 : 0
        level[i] = (0.4 + g.s ** 2 * 2.4 + bowl * 1.1 + fur) * glow + extra * 2.4
        ramp[i] = DRUSE
        continue
      }
      const o = g.out + (noise(g.th * 3, 0.5, 0, 7) - 0.5) * 1.2
      if (o < 4.4) {
        const band = o < 1 ? 4.3 : o < 1.8 ? 2.6 : o < 2.6 ? 4.8 : o < 3.4 ? 1.6 : 3.4
        level[i] = band + key * 1.2 + (glow - 0.8) * 1.4 + extra * 1.5
        ramp[i] = AGATE
        continue
      }
      const rough = g.coarse > 0.6 ? 1 : g.coarse < 0.38 ? -1 : 0
      level[i] = 2.4 + Math.round(key * 2) + rough + (o < 5.2 ? -1 : 0) + extra
      ramp[i] = RIND
    }

    const grown = CRYSTALS.map(k => ({ k, len: lengthOf(k, f) })).filter(g => g.len > 0.5)
    const flanks = FLANKS.map(k => ({ k, len: lengthOf(k, f) })).filter(g => g.len > 0.5)
    const all = heroLen > 0.5 ? [...grown, ...flanks, { k: HERO, len: heroLen }] : [...grown, ...flanks]
    for (const { k, len } of all) {
      const box = boxOf(k, len)
      for (let y = box.y0; y <= box.y1; y++) {
        for (let x = box.x0; x <= box.x1; x++) {
          if (!hit(k, len, x, y) && hit(k, len, x - 1, y - 1) && (GROUND[y * W + x]?.out ?? 0) < 0) {
            level[y * W + x] = (level[y * W + x] ?? 0) - 1.3
          }
        }
      }
    }
    for (let i = 0; i < W * H; i++) c.set(i % W, Math.floor(i / W), shade(ramp[i] ?? DRUSE, level[i] ?? 0))

    for (const { k, len } of all) {
      const isHero = k === HERO
      const growing = 2.2 * clamp((len - lengthOf(k, f - 1)) / 1.5)
      const across = k.bx + k.dx * len * 0.6 + (k.by + k.dy * len * 0.6 - 16) * 0.7
      const passes = GLINT[0] + clamp(across / 64) * (GLINT[1] - GLINT[0])
      const glint = clamp((4 - Math.abs(f - passes)) / 3)
      const box = boxOf(k, len)
      for (let y = box.y0; y <= box.y1; y++) {
        for (let x = box.x0; x <= box.x1; x++) {
          const h = hit(k, len, x, y)
          if (!h) continue
          const lit = facet(k, h.t, h.u > len - k.tip)
          const rim = k.w >= 1.6 && !hit(k, len, x - 1, y - 1) && lit > 0.35 ? 1 : 0
          const edge = !hit(k, len, x + 1, y + 1) ? -0.9 : 0
          const fresh = h.u > len - 1.6 ? growing : 0
          const shine = glint * (lit > 0.45 ? 3 : 1.2)
          const extra = lightAt(lamp, x, y) * (isHero ? 0.5 : 2.2)
          const core = isHero && Math.abs(h.t) < 0.34 && h.u < len - k.tip ? 0.4 : 0
          const lift = isHero ? 0.9 : 0
          c.set(x, y, shade(AMETHYST, 1.8 + lit * 6.4 * glow + rim + edge + fresh + shine + extra + core + lift))
        }
      }
    }

    const age = f - FLASH
    if (age >= 0 && age < 6) {
      const arm = [2, 3, 3, 2, 1, 1][age] ?? 0
      const x0 = Math.round(tipX)
      const y0 = Math.round(tipY) - 1
      for (let k = 1; k <= arm; k++) {
        const color = AMETHYST[Math.max(7, 10 - k)] ?? 0
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.set(x0 + dx * k, y0 + dy * k, color)
      }
      c.set(x0, y0, AMETHYST[10] ?? 0)
    }

    for (const p of particles(f, LOOP, 10, 4, 11)) {
      const x = Math.round(CX + (p.r[1] - 0.5) * RX * 1.6)
      const y = Math.round(CY + (p.r[2] - 0.5) * RY * 1.4)
      const g = GROUND[y * W + x]
      if (!g || g.out >= -0.5 || g.s < 0.5) continue
      c.set(x, y, shade(AMETHYST, ([6, 8, 7, 5][p.t] ?? 5) * Math.min(1, glow + 0.15)))
    }
  })
}

function boxOf(k: Crystal, len: number): { x0: number; y0: number; x1: number; y1: number } {
  const ex = k.bx + k.dx * len
  const ey = k.by + k.dy * len
  const r = k.w + 3

  return {
    x0: Math.max(0, Math.floor(Math.min(k.bx, ex) - r)),
    x1: Math.min(W - 1, Math.ceil(Math.max(k.bx, ex) + r)),
    y0: Math.max(0, Math.floor(Math.min(k.by, ey) - r)),
    y1: Math.min(H - 1, Math.ceil(Math.max(k.by, ey) + r)),
  }
}

export const scene: Scene = {
  verb: 'Crystallizing',
  render,
  hero: 49,
  snaps: [
    { frames: FLASH, box: [0, 0, W - 1, H - 1], why: 'the tip flashes and lights the whole geode for a frame' },
  ],
}
