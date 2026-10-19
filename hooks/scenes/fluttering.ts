import { Canvas, TAU, clamp, ease, hash, hex, mod, shade, smoothstep, wave, type Ramp, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const SKY = hex('8eb4d4 a6c4dc bed2de d8e0da ece8d2 f8eecc fff6de')
const HILLS = hex('6a76a0 7e8ab0 96a0c0 b0b6cc')
const FAR = hex('7c9a62 90ac68 a8be74 c2d088 dade9e')
const GRASS = hex('0e2218 163420 1f4826 2c5e2a 3e7630 588e36 78a840 a2c656 cce07a')
const DAISY = hex('7e7c96 aeacc0 dcdade fbfaf2')
const GOLD = hex('8a4a10 c8801c eeb83a fde27a')
const POPPY = hex('4a0e14 821a1c b82a22 e2482a f8784a')
const LUPINE = hex('2e1a4e 4a2a7a 6a44a8 8e68cc b496e4')
const ORANGE = hex('5a1e06 9a3a0a d0600e f08a1e fbb44a fedc8a fff6d8')
const BLUE = hex('0e1640 1a3684 2a5cc0 4a8ce4 86bef6 c6e4ff f4fbff')
const INK = 0x1a1220
const WHITE = 0xfff8ea

const at = (a: readonly number[], i: number) => a[i] ?? 0

const SUN_X = 9
const SUN_Y = 8
const BEAMS = [0.3, 0.52, 0.8]
const beamAt = (x: number, y: number) => {
  const a = Math.atan2(y - SUN_Y, x - SUN_X)
  let v = 0
  for (const b of BEAMS) v = Math.max(v, 1 - Math.abs(a - b) / 0.075)
  return clamp(v) * smoothstep(3, 12, Math.hypot(x - SUN_X, y - SUN_Y))
}
const inBeam = (x: number, y: number) => (beamAt(x, y) > 0.3 ? 1 : 0)

const MID_TOP = (x: number) => 20.5 + Math.sin(x * 0.19 + 2) * 0.9 + (hash(x >> 1, 31) > 0.75 ? -1 : 0)
const NEAR_TOP = (x: number) => 25.5 + Math.sin(x * 0.13) * 1.4 + Math.sin(x * 0.41 + 1) * 0.5 + (hash(x >> 1, 32) > 0.6 ? -1 : 0) + (hash(x, 33) > 0.88 ? -1 : 0)

function backdrop(beam: number): Int32Array {
  const c = new Canvas()
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - SUN_X, (y - SUN_Y) * 1.4)
      c.set(x, y, shade(SKY, 6.4 - d / 7 - y * 0.06 + inBeam(x, y) * beam))
    }
  }
  c.disc(SUN_X, SUN_Y, 3.3, at(SKY, 6))
  c.disc(SUN_X, SUN_Y, 2.3, WHITE)
  const ridge = (x: number) => 12 + Math.sin(x * 0.1 + 1) * 1.6 + Math.sin(x * 0.23) * 0.6
  const trees = (x: number) => ridge(x) - Math.max(0, 1.6 * Math.sin(x * 0.9) + 0.6) * (x > 34 && x < 60 ? 1 : 0)
  for (let x = 0; x < W; x++) {
    for (let y = Math.round(trees(x)); y < Math.round(ridge(x)); y++) c.set(x, y, at(HILLS, 1))
    for (let y = Math.round(ridge(x)); y < 18; y++) c.set(x, y, shade(HILLS, 2.6 - (y - ridge(x)) * 0.3 + (x < 22 ? 0.7 : 0) + inBeam(x, y) * beam * 0.8))
  }
  for (let y = 15; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (y < Math.round(ridge(x)) + 2) continue
      c.set(x, y, shade(FAR, 3.6 - (y - 15) * 0.4 + (x < 26 ? 0.5 : 0) + inBeam(x, y) * beam * 0.8))
    }
  }
  for (let i = 0; i < 16; i++) {
    const x = Math.floor(hash(i, 1) * 62)
    const y = 17 + Math.floor(hash(i, 2) * 3)
    const col = [at(DAISY, 3), at(FAR, 4), at(LUPINE, 4), at(POPPY, 4)][i % 4] ?? 0
    c.set(x, y, col)
    c.set(x + 1, y, col)
  }
  for (let x = 0; x < W; x++) {
    const top = Math.round(MID_TOP(x))
    for (let y = top; y < H; y++) {
      const d = y - top
      c.set(x, y, shade(GRASS, d === 0 ? 6.4 : 4.6 - d * 0.35 + (x < 24 ? 0.4 : 0) + inBeam(x, y) * beam * 0.7))
    }
  }
  return c.px
}
const BACKS = [0.8, 1.3, 1.8].map(backdrop)

type Kind = 'daisy' | 'poppy' | 'lupine' | 'button'
type Flower = { x: number; y: number; stem: number; kind: Kind; phase: number; isNear: boolean }
const drift = (kind: Kind, xs: readonly number[], y: number, isNear: boolean, seed: number): Flower[] =>
  xs.map((x, i) => ({ x, y: y + Math.round(hash(i, seed) * 2) - (i % 2), stem: isNear ? 4 : 2 + (i % 2), kind, phase: hash(i, seed + 1), isNear }))
const FLOWERS: Flower[] = [
  ...drift('button', [57, 60, 62, 55], 19, false, 41),
  ...drift('lupine', [36, 39, 41, 44, 46], 20, false, 42),
  ...drift('poppy', [2, 5, 8, 11, 14], 21, false, 43),
  ...drift('daisy', [19, 22, 25, 28, 31], 21, false, 44),
  ...drift('poppy', [6, 12], 26, true, 45),
  ...drift('lupine', [24, 27], 26, true, 46),
  ...drift('daisy', [38, 42], 27, true, 47),
  ...drift('button', [58, 61], 25, true, 48),
]

function flower(c: Canvas, fl: Flower, f: number) {
  const sway = Math.round(wave(f, LOOP, 2, fl.phase) * (fl.isNear ? 0.9 : 0.6))
  for (let k = 1; k <= fl.stem; k++) c.set(fl.x + (k < fl.stem / 2 ? sway : 0), fl.y + k, shade(GRASS, fl.isNear ? 3.4 : 4))
  const x = fl.x + sway
  const y = fl.y
  const big = fl.isNear
  if (fl.kind === 'daisy') {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) c.set(x + dx, y + dy, at(DAISY, dx < 0 || dy < 0 ? 3 : 2))
    if (big) for (const [dx, dy] of [[-2, 0], [2, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]] as const) c.set(x + dx, y + dy, at(DAISY, dx < 0 || dy < 0 ? 3 : 1))
    c.set(x, y, at(GOLD, 2))
  } else if (fl.kind === 'poppy') {
    c.rect(x - 1, y - 1, 3, 2, (px, py) => at(POPPY, py < y && px < x + 1 ? 4 : 3))
    if (big) {
      c.set(x - 2, y - 1, at(POPPY, 4))
      c.set(x + 2, y, at(POPPY, 2))
      c.rect(x - 1, y - 2, 3, 1, at(POPPY, 4))
    }
    c.set(x, y, at(POPPY, 0))
  } else if (fl.kind === 'lupine') {
    const n = big ? 6 : 4
    for (let k = 0; k < n; k++) {
      c.set(x, y - k, shade(LUPINE, k < n / 2 ? 2 : 3))
      if (k < n - 1) c.set(x - 1, y - k, shade(LUPINE, k < n / 2 ? 3 : 4))
    }
  } else {
    c.rect(x, y, 2, 1, at(GOLD, 3))
    c.set(x + 1, y, at(GOLD, 2))
    if (big) c.rect(x, y - 1, 2, 1, at(GOLD, 3))
  }
}

function butterfly(c: Canvas, bx: number, by: number, span: number, tall: number, lift: number, ramp: Ramp, glint: number, isBig: boolean) {
  const a = lift * Math.PI * 0.46
  const reach = span * Math.cos(a)
  const rise = span * Math.sin(a)
  const wing = (u: number, v: number) => {
    const fore = ((u - 0.48) / 0.56) ** 2 + ((v + 0.38) / 0.66) ** 2
    const hind = ((u - 0.32) / 0.42) ** 2 + ((v - 0.45) / 0.5) ** 2
    return Math.min(fore, hind)
  }
  const inside = (i: number, y: number) => {
    if (i < 1) return false
    const u = (i - 0.5) / reach
    const v = (y - by + u * rise) / tall
    return wing(u, v) <= 1 ? { u, v, e: wing(u, v) } : undefined
  }
  for (const side of [-1, 1]) {
    if (reach < 0.9) {
      for (let k = 1; k <= Math.round(rise * 0.85); k++) {
        c.set(bx, by - k, k > rise * 0.7 ? INK : shade(ramp, 2.6 + glint))
        if (isBig && k > 1 && k < rise * 0.7) c.set(bx + side, by - k, side > 0 ? INK : shade(ramp, 3.6 + glint))
      }
      continue
    }
    for (let y = Math.floor(by - tall - rise - 1); y <= by + tall + 1; y++) {
      for (let i = 1; i <= Math.ceil(reach) + 1; i++) {
        const hit = inside(i, y)
        if (!hit) continue
        const { u, v, e } = hit
        const x = bx + side * i
        const isRim = (i > 1 && !inside(i + 1, y)) || !inside(i, y - 1) || !inside(i, y + 1) || (isBig && e > 0.62)
        const isSpot = isBig && isRim && e > 0.7 && hash(i, y - Math.round(by), side) > 0.6
        const isVein = isBig && !isRim && Math.abs(v + 0.15 - u * 0.55) < 0.13 && u > 0.3
        if (isSpot) c.set(x, y, WHITE)
        else if (isRim || isVein) c.set(x, y, INK)
        else c.set(x, y, shade(ramp, 3.2 + glint - (v > 0.15 ? 0.9 : 0) + (u < 0.45 && v < 0 ? 0.7 : 0) - lift * 0.6))
      }
    }
  }
  const len = isBig ? 3 : 2
  for (let k = -1; k < len; k++) c.set(bx, by + k, INK)
  c.set(bx - 1, by - 2, INK)
  c.set(bx + 1, by - 2, INK)
  if (isBig) {
    c.set(bx - 2, by - 3, INK)
    c.set(bx + 2, by - 3, INK)
  }
}
const FLAP = 8
const flapPhase = (f: number, offset: number) => mod(f + offset, FLAP) / FLAP
const flapAt = (f: number, offset: number) => 0.45 * (1 - Math.cos(TAU * flapPhase(f, offset)))
const strokeAt = (f: number, offset: number) => Math.max(0, Math.cos(TAU * flapPhase(f, offset))) ** 2
function bask(f: number): number {
  if (f < 18) return 1
  if (f < 30) return 1 - ease.inOut((f - 18) / 12)
  if (f < 50) return f % 10 === 4 ? 0.15 : 0
  if (f < 60) return ease.inOut((f - 50) / 10)
  return 1
}
const PERCH_X = 51
const PERCH_Y = 22
function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const up = 0.5 - 0.5 * Math.cos((TAU * f) / LOOP)
    c.px.set(BACKS[Math.round(up * 2)] ?? BACKS[0] ?? new Int32Array(W * H))

    for (let i = 0; i < 9; i++) {
      const x = Math.round(mod(hash(i, 11) * W + ((f * 16) / LOOP) * (1 + (i % 2)), W))
      const y = Math.round(5 + hash(i, 12) * 16 + wave(f, LOOP, 1 + (i % 3), hash(i, 13)) * 1.5)
      if (inBeam(x, y) && (f + i * 5) % 12 < 9) c.set(x, y, WHITE)
    }

    for (const fl of FLOWERS) if (!fl.isNear) flower(c, fl, f)
    const px = 26 + 4 * Math.sin((TAU * f) / LOOP + 0.4)
    const py = 18.5 - ease.inOut(up) * 9.5
    const theta = (TAU * 3 * f) / LOOP
    const dancers = [
      { th: theta, ramp: ORANGE, offset: 0 },
      { th: theta + Math.PI, ramp: BLUE, offset: FLAP / 2 },
    ].sort((a, b) => Math.sin(a.th) - Math.sin(b.th))
    for (const d of dancers) {
      const stroke = strokeAt(f, d.offset)
      const x = Math.round(px + Math.cos(d.th) * 5)
      const y = Math.round(py + Math.sin(d.th) * 3.2 - stroke)
      const light = inBeam(x, y) + up * 0.5
      const glint = light * 0.5 + (Math.min(2, 0.8 + light * 1.2) - light * 0.5) * stroke
      butterfly(c, x, y, 4, 2.7, flapAt(f, d.offset), d.ramp, glint, false)
    }
    for (let x = 0; x < W; x++) {
      const top = Math.round(NEAR_TOP(x))
      const lean = Math.round(wave(f, LOOP, 2, x * 0.05) * 0.6)
      for (let y = top; y < H; y++) {
        const d = y - top
        c.set(x + (d === 0 ? lean : 0), y, shade(GRASS, d === 0 ? 5 : 3.2 - d * 0.32 + (x < 24 ? 0.3 : 0)))
      }
    }
    for (const fl of FLOWERS) if (fl.isNear) flower(c, fl, f)
    const sway = Math.round(wave(f, LOOP, 1, 0.2) * 0.6)
    const dx0 = PERCH_X + sway
    for (let y = PERCH_Y + 2; y < H; y++) c.set(PERCH_X + (y < PERCH_Y + 5 ? sway : 0), y, shade(GRASS, 2.6))
    c.set(PERCH_X - 1, PERCH_Y + 6, shade(GRASS, 3.4))
    c.set(PERCH_X - 2, PERCH_Y + 5, shade(GRASS, 4))
    for (let y = PERCH_Y; y <= PERCH_Y + 3; y++) {
      for (let x = dx0 - 5; x <= dx0 + 5; x++) {
        const nx = (x - dx0) / 5.2
        const ny = (y - PERCH_Y - 1.4) / 1.9
        if (nx * nx + ny * ny > 1) continue
        const ang = Math.atan2(ny, nx)
        const isGap = Math.abs(mod(ang * (9 / TAU) + 0.5, 1) - 0.5) < 0.1 && nx * nx + ny * ny > 0.35
        c.set(x, y, isGap ? at(DAISY, 1) : shade(DAISY, 2.4 + (nx < 0 ? 0.9 : 0) - (ny > 0.3 ? 1.1 : 0)))
      }
    }
    c.ellipse(dx0, PERCH_Y + 1, 1.6, 0.9, (x, y) => shade(GOLD, 2.4 + (x < dx0 ? 0.8 : 0) - (y - PERCH_Y - 1) * 0.8))
    const open = 1 - bask(f)
    const flash = f >= 32 && f < 50 && (f - 32) % 6 < 2 ? 1 : 0
    butterfly(c, dx0, PERCH_Y - 1, 6, 3.6, bask(f), ORANGE, open * (0.2 + up * 0.5) + flash * 0.7, true)
    for (const [bx, h, lean, ph] of [[1, 10, 2, 0], [4, 7, -1, 0.3], [16, 6, 1, 0.5], [33, 5, -1, 0.7], [46, 6, -2, 0.8], [62, 9, -2, 0.6]] as const) {
      const s = wave(f, LOOP, 2, ph) * 0.8
      for (let k = 0; k < h; k++) {
        const t = k / h
        c.set(bx + Math.round((lean + s) * t * t), H - 1 - k, shade(GRASS, 0.4 + t * 1.4 + (k === h - 1 ? 1.6 : 0)))
      }
    }
    for (let x = 0; x < W; x++) {
      const y = Math.round(NEAR_TOP(x))
      if (inBeam(x, y)) c.set(x, y, shade(GRASS, 6 + up))
    }
    out.push(c.px)
  }
  return out
}
export const scene: Scene = { verb: 'Fluttering', render, hero: 38 }
