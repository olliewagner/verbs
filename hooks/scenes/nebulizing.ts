import { beat, clamp, ease, frames, hash, hex, mix, noise, smoothstep, wave, type Canvas, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const SPACE = hex('030208 06040e 0a0716')
const MAGENTA = hex('0a0414 1a0828 320c3c 4e1250 6e1a62 902470 b0367a cc5288 e47aa0 f8aac0')
const TEAL = hex('040e18 07192a 0b2a3a 10404c 18585c 22746c 32927c 50b090 80cca8 b8e8cc')
const DUST = hex('030106 08040c 100816 1c0e22')
const STAR = hex('6a7ab8 a8b8f0 dce4ff ffffff')
const GLAZE = hex('3a1a4a 5a2a62 863c84 b45a9e d8c8e0 f0d8f0 4a5a8a 7a88b8 6a8aa8 9ab4c8')
const PALETTE_ALL = [...new Set([SPACE, MAGENTA, TEAL, DUST, STAR, GLAZE].flat())]

function quantize(px: Int32Array, cache: Map<number, number>) {
  for (let i = 0; i < px.length; i++) {
    const c = px[i] ?? 0
    let best = cache.get(c)
    if (best === undefined) {
      let bestD = Infinity
      best = c
      for (const p of PALETTE_ALL) {
        const dr = ((c >> 16) & 255) - ((p >> 16) & 255)
        const dg = ((c >> 8) & 255) - ((p >> 8) & 255)
        const db = (c & 255) - (p & 255)
        const d = 3 * dr * dr + 4 * dg * dg + 2 * db * db
        if (d < bestD) {
          bestD = d
          best = p
        }
      }
      cache.set(c, best)
    }
    px[i] = best
  }
}

const CX = 29
const CY = 15
const KNOT = { x: 16, y: 9, r: 3.2 }
const IGNITE = 44

const CLUSTER = [
  { x: 29, y: 14, size: 3, phase: 0 },
  { x: 34, y: 18, size: 2, phase: 0.3 },
  { x: 25, y: 17, size: 1, phase: 0.6 },
  { x: 33, y: 10, size: 1, phase: 0.15 },
  { x: 23, y: 11, size: 2, phase: 0.8 },
  { x: 30, y: 21, size: 1, phase: 0.45 },
] as const

function fbm(x: number, y: number, seed: number): number {
  let sum = 0
  let amp = 0.5
  let freq = 1
  let norm = 0
  for (let o = 0; o < 3; o++) {
    sum += amp * noise(x * freq, y * freq, o * 7.3, seed)
    norm += amp
    amp *= 0.5
    freq *= 2.03
  }
  return sum / norm
}

function gas(x: number, y: number): number {
  const qx = fbm(x + 3.1, y + 1.7, 21)
  const qy = fbm(x - 2.3, y + 4.9, 22)
  return fbm(x + 2.6 * qx, y + 2.6 * qy, 20)
}

function swirl(x: number, y: number, t: number, seed: number): number {
  const dx = x - CX
  const dy = (y - CY) * 1.3
  const r = Math.hypot(dx, dy)
  const base = Math.atan2(dy, dx) + 1.4 * Math.exp(-r / 16)
  const omega = 0.32 + 0.4 * Math.exp(-r / 12)
  const at = (angle: number) => {
    const u = Math.cos(angle) * r * 0.07
    const v = Math.sin(angle) * r * 0.07
    return seed === 0 ? gas(u, v) : fbm(u * 1.1 + 5, v * 1.1 - 3, seed)
  }
  const a = at(base - omega * t) - 0.5
  const b = at(base - omega * (t - 1)) - 0.5
  return 0.5 + ((1 - t) * a + t * b) / Math.hypot(1 - t, t)
}
const KNOT_MASK = Array.from({ length: W * H }, (_, i) => {
  const x = i % W
  const y = Math.floor(i / W)
  const ax = KNOT.x - CX
  const ay = KNOT.y - CY
  const len = Math.hypot(ax, ay)
  const along = ((x - KNOT.x) * ax + (y - KNOT.y) * ay) / len
  const across = ((x - KNOT.x) * ay - (y - KNOT.y) * ax) / len
  const edge = (noise(x * 0.5, y * 0.5, 0, 9) - 0.5) * 1.2
  if (Math.hypot(x - KNOT.x, (y - KNOT.y) * 1.1) <= KNOT.r + edge) return true
  const bend = Math.sin(along * 0.5) * 1.2 * (along / 7)
  return along > 0 && along < 7 && Math.abs(across - bend) <= KNOT.r * 0.8 * (1 - along / 7) ** 0.8 + edge * 0.5
})
const inKnot = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H && KNOT_MASK[y * W + x] === true
function embryo(f: number): number {
  if (f < IGNITE) {
    const build = ease.in(beat(f, 24, IGNITE))
    const beatAt = (g: number) => Math.max(0, Math.sin(g * (0.5 + ease.in(beat(g, 24, IGNITE)) * 1.4))) * ease.in(beat(g, 24, IGNITE))
    const pulse = Math.max(beatAt(f), 0.5 * beatAt(f - 1))
    return 0.22 + 0.06 * wave(f, LOOP, 3) + pulse * 0.35 + build * 0.15
  }
  return Math.max(0.22, 1.25 * Math.exp(-(f - IGNITE) / 14) + 0.22)
}
function drawStar(c: Canvas, x: number, y: number, reach: number) {
  c.set(x, y, STAR[3] ?? 0)
  for (let k = 1; k <= reach; k++) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.tint(x + dx * k, y + dy * k, STAR[Math.max(0, 3 - k)] ?? 0, k === reach ? 0.5 : 0.85)
  }
}
function render(): Int32Array[] {
  const fieldStars = Array.from({ length: 30 }, (_, i) => ({
    x: Math.floor(hash(i, 1) * W),
    y: Math.floor(hash(i, 2) * H),
    level: hash(i, 3),
    phase: hash(i, 4),
  }))
  const dens = new Float32Array(W * H)
  const cache = new Map<number, number>()
  return frames(LOOP, (c, f) => {
    const t = f / LOOP
    const flare = embryo(f)
    const flash = f === IGNITE ? 1 : f === IGNITE + 1 ? 0.45 : 0
    const echoR = (f - IGNITE) * 1.35
    const echoA = f >= IGNITE ? 1 - beat(f, IGNITE, IGNITE + 34) : 0
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) dens[y * W + x] = swirl(x, y, t, 0)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const r = Math.hypot(x - CX, (y - CY) * 1.3)

        const raw = dens[y * W + x] ?? 0
        const gx = ((dens[y * W + Math.min(W - 1, x + 2)] ?? 0) - (dens[y * W + Math.max(0, x - 2)] ?? 0)) / 2
        const gy = ((dens[Math.min(H - 1, y + 2) * W + x] ?? 0) - (dens[Math.max(0, y - 2) * W + x] ?? 0)) / 2
        const facing = r > 1 ? -(gx * (CX - x) + gy * (CY - y)) / r : 0
        const cavity = 0.3 + 0.7 * clamp((r - 2) / 7)
        const density = (0.12 + 0.88 * clamp((raw - 0.3) * 2.3)) * cavity
        const shell = 0.6 * Math.exp(-(((r - 16) / 6) ** 2))
        const light = 1.1 * Math.max(0, 1 - r / 46) ** 1.1 + 0.42 + shell
        const de = Math.hypot(x - KNOT.x, (y - KNOT.y) * 1.2)
        const echo = echoA * Math.exp(-((de - echoR) ** 2) / 6) * 1.3
        const local = Math.max(0, flare - 0.22) * Math.max(0, 1 - de / 16) ** 1.5 * 1.4
        let level = density * (light + echo + local + flash * 0.6) * 7 + clamp(facing * 7, -1, 2) * density * light
        level *= 1 - 0.6 * smoothstep(0.56, 0.7, swirl(x, y, t, 31))
        level *= 1 - 0.32 * (((x - CX) / 36) ** 2 + ((y - CY) / 20) ** 2)
        if (level > 6) level = 6 + (level - 6) * 0.45
        const hot = (light - shell * 0.6) * (0.7 + 0.6 * swirl(x, y, t, 41))
        const ramp = hot > 1.08 ? TEAL : MAGENTA
        let col = level < 0.8 ? SPACE[Math.round(clamp(level * 2.5, 0, 2))] ?? 0 : ramp[Math.round(clamp(level, 0, 9))] ?? 0
        if (Math.abs(hot - 1.08) < 0.05 && level > 5) col = mix(col, 0xf0d8f0, 0.35)
        c.set(x, y, col)
      }
    }
    const px = c.copy()
    const at = (i: number, j: number) => px[j * W + i] ?? 0
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const me = at(x, y)
        const l = at(x - 1, y)
        const r = at(x + 1, y)
        const u = at(x, y - 1)
        const d = at(x, y + 1)
        if (me === l || me === r || me === u || me === d) continue
        if (l === r) c.set(x, y, l)
        else if (u === d) c.set(x, y, u)
      }
    }
    if (echoA > 0 && f > IGNITE + 1) {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const d = Math.abs(Math.hypot(x - KNOT.x, (y - KNOT.y) * 1.2) - echoR)
          if (d < 0.9) c.tint(x, y, 0xf27ab4, echoA > 0.5 ? 0.42 : 0.24)
        }
      }
    }
    for (const s of fieldStars) {
      const tw = s.level > 0.7 ? 0.5 + 0.5 * wave(f, LOOP, 2 + Math.floor(s.phase * 3), s.phase) : 1
      const b = s.level * tw
      if (b > 0.35) c.tint(s.x, s.y, STAR[b > 0.8 ? 2 : 1] ?? 0, b > 0.6 ? 0.9 : 0.55)
    }
    const glowIn = Math.max(0, flare - 0.25)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!inKnot(x, y)) continue
        const sx = Math.sign(CX - x)
        const sy = Math.sign(CY - y)
        const isRim = !inKnot(x + sx, y) || !inKnot(x, y + sy) || !inKnot(x + sx, y + sy)
        const isInner = !isRim && (!inKnot(x + 2 * sx, y) || !inKnot(x + sx, y + 2 * sy))
        const de = Math.hypot(x - KNOT.x, y - KNOT.y)
        const lit = 0.7 * Math.max(0, 1 - Math.hypot(x - CX, y - CY) / 40) + glowIn * Math.max(0, 1 - de / 6) * 1.6 + flash
        const inner = glowIn * Math.max(0, 1 - de / (KNOT.r + 0.5))
        if (isRim) c.set(x, y, MAGENTA[Math.round(clamp(3.6 + lit * 6, 0, 9))] ?? 0)
        else if (isInner) c.set(x, y, MAGENTA[Math.round(clamp(1.6 + lit * 4, 0, 9))] ?? 0)
        else c.set(x, y, inner > 0.12 ? MAGENTA[Math.round(clamp(2 + inner * 6, 0, 9))] ?? 0 : DUST[de < 2 ? 2 : 1] ?? 0)
      }
    }
    const ex = KNOT.x
    const ey = KNOT.y
    if (f < IGNITE) {
      c.set(ex, ey, mix(MAGENTA[5] ?? 0, 0xfff0f0, clamp((flare - 0.2) * 1.6)))
      if (flare > 0.45) for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1], [0, 1]] as const) c.tint(ex + dx, ey + dy, MAGENTA[8] ?? 0, (flare - 0.45) * 1.6)
    } else {
      if (flash > 0) {
        for (let y = ey - 6; y <= ey + 6; y++) {
          for (let x = ex - 7; x <= ex + 7; x++) {
            const d = Math.hypot(x - ex, (y - ey) * 1.2)
            if (f === IGNITE && d < 4) c.set(x, y, d < 2.5 ? STAR[3] ?? 0 : STAR[2] ?? 0)
            if (f === IGNITE + 1 && d > 4.2 && d < 5.4) c.set(x, y, MAGENTA[9] ?? 0)
          }
        }
      }
      drawStar(c, ex, ey, flare > 0.9 ? 3 : flare > 0.45 ? 2 : 1)
      if (flare > 0.6) for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) c.tint(ex + dx, ey + dy, STAR[1] ?? 0, 0.6)
    }
    for (const s of CLUSTER) {
      const tw = wave(f, LOOP, 4, s.phase)
      drawStar(c, s.x, s.y, s.size === 3 ? (tw > 0.3 ? 2 : 1) : s.size === 2 ? (tw > 0.4 ? 1 : 0) : 0)
      if (s.size === 1 && tw > 0.6) c.tint(s.x + 1, s.y, STAR[1] ?? 0, 0.5)
    }
    quantize(c.px, cache)
  })
}
const TWINKLES = Array.from({ length: LOOP }, (_, f) => f).filter(f => (wave(f, LOOP, 4, 0) > 0.3) !== (wave((f + LOOP - 1) % LOOP, LOOP, 4, 0) > 0.3))
const BRIGHT = CLUSTER[0]

function echoBox(f: number): readonly [number, number, number, number] {
  const r = (f - IGNITE) * 1.35 + 4
  return [Math.max(0, Math.floor(KNOT.x - r)), Math.max(0, Math.floor(KNOT.y - r / 1.2)), Math.min(W - 1, Math.ceil(KNOT.x + r)), Math.min(H - 1, Math.ceil(KNOT.y + r / 1.2))]
}
export const scene: Scene = {
  verb: 'Nebulizing',
  render,
  hero: 47,
  snaps: [
    ...TWINKLES.map(f => ({ frames: f, box: [BRIGHT.x - 2, BRIGHT.y - 2, BRIGHT.x + 2, BRIGHT.y + 2] as const, why: 'the brightest cluster star twinkles, its arms reaching out a pixel and drawing back' })),
    { frames: IGNITE - 2, box: [KNOT.x - 2, KNOT.y - 2, KNOT.x + 2, KNOT.y + 2], why: 'the embryo\'s last pulse before it ignites lights it from within; it fades over the next frame' },
    { frames: [IGNITE, IGNITE + 2], why: 'the embryo ignites: its flash lights the whole cloud for a frame, then fades over two' },
    ...Array.from({ length: 18 }, (_, k) => IGNITE + 6 + k).map(f => ({ frames: f, box: echoBox(f), why: 'the light echo: a ring of light sweeps out from the new star through the gas' })),
  ],
}