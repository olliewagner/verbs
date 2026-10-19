import { Canvas, PALETTE, TAU, beat, clamp, ease, frames, hash, hex, lerp, mix, particles, shade, threshold, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const SKY = hex('080c20 0e1532 152048 1d2c60 283c78')
const MOON = hex('8aa0c8 b8c8e0 dde6f2 f6f8fc')
const HEDGE = hex('03080c 071214 0c1c1e 122a2a 1a3a36 26504a')
const GRASS = hex('040a0c 081414 0e2020 142c28 1c3a30 284c3c')
const LEAF = hex('061410 0c2418 143420 1e4828 2c5e32 427840')
const PUMPKIN = hex('2a0c1e 4a1420 7a2418 a83e14 d06018 ec8a28 f8b850 fde090')
const GOLD = PALETTE.gold
const STEM = hex('1a1408 3a2c12 5a4a1e 7a6a30')
const GLOW = hex('f6b860 fcdc98 fff6dc')
const MAGIC = hex('6a3aa8 a87ae0 e4ccff ffffff')
const FIREFLY = 0xd8f080
const RIM = [mix(PUMPKIN[5] ?? 0, MOON[2] ?? 0, 0.35), mix(PUMPKIN[6] ?? 0, MOON[2] ?? 0, 0.4)] as const

const MOON_X = 52
const MOON_Y = 7
const L = (() => {
  const v = [0.55, -0.5, 0.67]
  const n = Math.hypot(...v)
  return v.map(c => c / n)
})()

const CHANGE = 27
const CHANGE_BACK = 61
const SWIRL = 12
const SWIRL_BACK = 49
const FLASH: Record<number, number> = { [CHANGE]: 0.9, [CHANGE + 1]: 0.55, [CHANGE + 2]: 0.25, [CHANGE_BACK]: 0.7, [CHANGE_BACK + 1]: 0.4, [CHANGE_BACK + 2]: 0.15 }

function morph(f: number): number {
  if (f < CHANGE - 1) return 0
  if (f < 31) return ease.outBack(beat(f, CHANGE - 1, 31))
  if (f < 58) return 1
  if (f < CHANGE_BACK) return 1 - 0.15 * beat(f, 58, CHANGE_BACK - 1) ** 2
  return 0
}

function squash(f: number): { s: number; lift: number } {
  if (f >= 21 && f < CHANGE) return { s: 0.18 * ease.inOut(beat(f, 21, 24)), lift: 0 }
  const bounce: Record<number, { s: number; lift: number }> = {
    [CHANGE_BACK]: { s: -0.12, lift: 3 },
    62: { s: 0.22, lift: 0 }, 63: { s: -0.14, lift: 1.5 }, 64: { s: -0.06, lift: 2 }, 65: { s: 0.12, lift: 0 }, 66: { s: -0.04, lift: 0.4 }, 67: { s: 0.03, lift: 0 },
  }
  return bounce[f] ?? { s: 0, lift: 0 }
}

type Body = { cx: number; cy: number; rx: number; ry: number; m: number }

function body(f: number): Body {
  const m = morph(f)
  const { s, lift } = squash(f)
  const ry = lerp(4.8, 7.6, m) * (1 - s)
  const ground = lerp(28, 22.4, Math.min(1, m))
  return { cx: 31, cy: ground - ry - lift, rx: lerp(7, 11, m) * (1 + s * 0.8), ry, m }
}

function bodyAt(b: Body, x: number, y: number, magic: number): number | undefined {
  const nx = (x + 0.5 - b.cx) / b.rx
  const ny = (y + 0.5 - b.cy) / b.ry
  const d = nx * nx + ny * ny
  if (d > 1) return undefined
  const nz = Math.sqrt(1 - d)
  const lambert = nx * (L[0] ?? 0) + ny * (L[1] ?? 0) + nz * (L[2] ?? 0)
  const a = Math.asin(clamp(nx / Math.sqrt(Math.max(0.0001, 1 - ny * ny * 0.85)), -1, 1))
  const segment = Math.cos(a * 3.2)
  const isGroove = Math.abs(Math.sin(a * 3.2)) < 0.16 && d < 0.92
  const isCoach = b.m > 0.5
  if (isGroove && isCoach) return shade(GOLD, 4 + lambert * 2.5 + magic, x, y)
  let level = 2.2 + lambert * 3.6 + segment * 0.6 + magic * 1.5
  if (isGroove) level -= 1.6
  if (d > 0.72 && nx > 0.15 && ny < 0.2) return level > 4.5 ? RIM[1] : RIM[0]
  return shade(PUMPKIN, level, x, y)
}

function drawBackground(c: Canvas, f: number): void {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const moon = Math.hypot(x - MOON_X, y - MOON_Y)
      let col: number
      if (moon < 4.6) {
        const crater = (x === 50 && y === 6) || (x === 54 && y === 9) || (x === 53 && y === 5)
        col = shade(MOON, moon < 3.2 ? (crater ? 2 : 3) : 2, x, y)
      } else {
        const halo = moon < 7 ? 1 : moon < 10 ? 0.5 : 0
        col = shade(SKY, 0.6 + (y / 20) * 2.6 + halo, x, y)
        if (hash(x, y, 3) < 0.018 && y < 14 && moon > 8) {
          const twinkle = Math.sin(f * 0.5 + hash(x, y, 4) * TAU) > 0.6
          col = twinkle ? (MOON[3] ?? 0) : (MOON[0] ?? 0)
        }
      }
      const hedgeTop = 14 + Math.round(Math.sin(x * 0.35) * 1.2 + Math.sin(x * 0.13 + 1) * 1.5)
      const cone = (cx: number, top: number, w: number) => y >= top && Math.abs(x - cx) <= (y - top) * w
      const isTopiary = cone(8, 5, 0.42) || cone(57, 8, 0.4)
      if (y >= hedgeTop || isTopiary) {
        const rim = y === hedgeTop || (isTopiary && (y === (x > 32 ? 8 : 5) || Math.abs(x - (x > 32 ? 57 : 8)) === Math.floor((y - (x > 32 ? 8 : 5)) * (x > 32 ? 0.4 : 0.42))))
        const facing = isTopiary ? (x > (x > 32 ? 57 : 8) ? 1 : 0) : 0
        const flower = hash(x, y, 11) < 0.04 && y > hedgeTop + 1 && y < 20
        col = flower ? (MOON[1] ?? 0) : shade(HEDGE, 1.6 + (rim ? 2 : 0) + facing + (y - hedgeTop) * -0.08, x, y)
      }
      if (y >= 20) {
        const blade = hash(x, y, 5) < 0.12 ? 0.6 : 0
        col = shade(GRASS, 3.2 - (y - 20) * 0.22 + blade, x, y)
      }
      c.set(x, y, col)
    }
  }
}

const LEAVES: readonly (readonly [number, number, number, number])[] = [
  [18, 27.5, 3.4, 1.6], [14, 25.5, 2.4, 1.2], [44, 28, 3.6, 1.7], [48, 25.8, 2.6, 1.2], [24, 30, 3, 1.4], [38, 30.4, 3, 1.4],
]

function drawPatch(c: Canvas): void {
  c.line(12, 26, 50, 27, LEAF[1] ?? 0)
  c.line(20, 29, 42, 29, LEAF[1] ?? 0)
  for (const [lx, ly, rx, ry] of LEAVES) {
    c.ellipse(lx, ly, rx, ry, (x, y) => {
      const isVein = Math.round(y) === Math.round(ly) && Math.abs(x - lx) < rx - 1
      const lit = (x - lx) / rx - (y - ly) / ry
      return shade(LEAF, isVein ? 1.6 : 2.6 + (lit > 0.6 ? 1.4 : lit < -0.6 ? -1 : 0), x, y)
    })
  }
  for (const [x, y] of [[11, 24], [10, 23], [11, 22], [51, 25], [52, 24], [51, 23]] as const) c.set(x, y, LEAF[4] ?? 0)
}

function drawCoachParts(c: Canvas, b: Body, f: number): void {
  const m = clamp(b.m)
  if (m < 0.05) return
  for (const wx of [b.cx - 7.5, b.cx + 7.5]) {
    const r = 4.3 * Math.min(1, m)
    const wy = 27.6 - r
    for (let y = Math.floor(wy - r - 1); y <= Math.ceil(wy + r + 1); y++) {
      for (let x = Math.floor(wx - r - 1); x <= Math.ceil(wx + r + 1); x++) {
        const dx = x + 0.5 - wx
        const dy = y + 0.5 - wy
        const d = Math.hypot(dx, dy)
        const isRim = d <= r && d > r - 1.1
        const isHub = d < 1.1
        const spoke = Math.abs(Math.sin(Math.atan2(dy, dx) * 3)) * d < 0.55 && d < r
        if (isRim || isHub || spoke) c.set(x, y, shade(GOLD, (isRim ? 4 : 3.4) + (dx > 0 && dy < 0 ? 1.5 : dx < 0 && dy > 0 ? -1 : 0), x, y))
      }
    }
  }
  if (m > 0.5) {
    const w = clamp((m - 0.5) * 2)
    const wx = b.cx + 2
    const wy = b.cy - 0.5
    const rx = 3.2 * w
    const ry = 3.4 * w
    for (let y = Math.floor(wy - ry - 1); y <= Math.ceil(wy + ry + 1); y++) {
      for (let x = Math.floor(wx - rx - 1); x <= Math.ceil(wx + rx + 1); x++) {
        const d = Math.hypot((x + 0.5 - wx) / Math.max(0.1, rx), (y + 0.5 - wy) / Math.max(0.1, ry))
        if (d > 1.25) continue
        if (d > 0.95) c.set(x, y, shade(GOLD, 4.6 + (x > wx ? 1 : 0), x, y))
        else c.set(x, y, x + 0.5 < wx - rx * 0.4 ? shade(PUMPKIN, 1.6, x, y) : shade(GLOW, 1.6 - d * 1.2, x, y))
      }
    }
    const top = b.cy - b.ry
    c.sprite(Math.round(b.cx) - 2, Math.round(top) - 3, ['.g.g.', 'g.G.g', 'GGGGG'], { g: GOLD[6] ?? 0, G: GOLD[4] ?? 0 })
    const lx = Math.round(b.cx + b.rx + 1)
    const ly = Math.round(b.cy - 3)
    c.line(lx - 2, ly - 1, lx, ly - 1, GOLD[3] ?? 0)
    c.sprite(lx, ly - 1, ['G', 'L', 'L', 'G'], { G: GOLD[5] ?? 0, L: GLOW[2] ?? 0 })
    for (let y = ly - 4; y <= ly + 4; y++) {
      for (let x = lx - 4; x <= lx + 4; x++) {
        const g = Math.hypot(x - lx, y - ly - 0.5)
        if (g > 1.2 && g < 3.6 && w >= 0.5) c.tint(x, y, GLOW[0] ?? 0, 0.22)
      }
    }
    c.rect(Math.round(wx) - 1, Math.round(b.cy + b.ry) - 1, 3, 1, GOLD[3] ?? 0)
    for (let k = 0; k < 7; k++) {
      const phase = (f + k * 5) % 12
      if (phase > 2) continue
      const a = k * 2.3 + 0.6
      const gx = b.cx + Math.cos(a) * b.rx * 0.82
      const gy = b.cy + Math.sin(a) * b.ry * 0.82
      star(c, gx, gy, phase === 1 ? 2 : 1, GOLD[7] ?? 0, GOLD[5] ?? 0)
    }
  }
}

function star(c: Canvas, x: number, y: number, r: number, core: number, arm: number): void {
  const ix = Math.round(x)
  const iy = Math.round(y)
  c.set(ix, iy, core)
  for (let k = 1; k <= r; k++) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.set(ix + dx * k, iy + dy * k, k === r && r > 1 ? arm : core)
  }
}

type Spark = { x: number; y: number; front: boolean; size: number; trail: [number, number] }

function swirl(f: number, start: number, span: number, b: Body, dir: number): Spark[] {
  const out: Spark[] = []
  for (let k = 0; k < 11; k++) {
    const p = (f - start - (k % 3) * 0.7) / span
    if (p < 0 || p > 1) continue
    const at = (q: number): [number, number, number] => {
      const a = (k * TAU) / 11 + dir * q * TAU * 1.3
      const r = lerp(17, 2.5, ease.in(q))
      return [b.cx + Math.cos(a) * r, b.cy + 1 + Math.sin(a) * r * 0.3 - q * 3 + (1 - q) * 2, Math.sin(a)]
    }
    const [x, y, depth] = at(p)
    const [tx, ty] = at(Math.max(0, p - 0.07))
    out.push({ x, y, front: depth > 0, size: p > 0.35 ? 1 : 0, trail: [tx, ty] })
  }
  return out
}

function drawSparks(c: Canvas, sparks: Spark[], front: boolean): void {
  for (const s of sparks) {
    if (s.front !== front) continue
    c.set(s.trail[0], s.trail[1], MAGIC[front ? 1 : 0] ?? 0)
    star(c, s.x, s.y, s.size, front ? (MAGIC[3] ?? 0) : (MAGIC[2] ?? 0), MAGIC[1] ?? 0)
  }
}

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    drawBackground(c, f)
    const b = body(f)

    for (const p of particles(f, LOOP, 5, 36, 21)) {
      const x = 4 + p.r[0] * 56 + Math.sin(p.age * 5 + p.r[1] * 6) * 2
      const y = 12 + p.r[2] * 9 - p.age * 3
      if (Math.sin(p.age * Math.PI) > 0.4 && Math.abs(x - b.cx) > b.rx + 2) c.set(x, y, FIREFLY)
    }

    const sh = clamp(1 - b.m * 0.3)
    c.ellipse(b.cx - 3, 28.4, b.rx * 0.9 + 1, 1.4, (x, y) => (y >= 20 ? shade(GRASS, 0.8 * sh, x, y) : undefined))
    drawPatch(c)

    const sparks = [...swirl(f, SWIRL, CHANGE - SWIRL - 1, b, 1), ...swirl(f, SWIRL_BACK, CHANGE_BACK - SWIRL_BACK - 1, b, -1)]
    drawSparks(c, sparks, false)
    const magic = f >= 18 && f < 31 ? 0.5 * beat(f, 18, 26) : f >= 54 && f < 62 ? 0.5 * beat(f, 54, 60) : 0

    for (let y = Math.floor(b.cy - b.ry - 1); y <= Math.ceil(b.cy + b.ry + 1); y++) {
      for (let x = Math.floor(b.cx - b.rx - 1); x <= Math.ceil(b.cx + b.rx + 1); x++) {
        const col = bodyAt(b, x, y, magic)
        if (col !== undefined) c.set(x, y, col)
      }
    }
    if (b.m < 0.5) {
      const top = Math.round(b.cy - b.ry)
      const sx = Math.round(b.cx)
      c.set(sx, top, STEM[2] ?? 0)
      c.set(sx, top - 1, STEM[3] ?? 0)
      c.set(sx + 1, top - 2, STEM[2] ?? 0)
      c.set(sx - 1, top, STEM[1] ?? 0)
      c.set(sx + 2, top - 1, LEAF[3] ?? 0)
    }
    drawCoachParts(c, b, f)
    drawSparks(c, sparks, true)

    if (f === CHANGE || f === CHANGE + 1) {
      const r = f === CHANGE ? 9 : 14
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * TAU
        star(c, b.cx + Math.cos(a) * r, b.cy + Math.sin(a) * r * 0.6, f === CHANGE ? 1 : 0, MAGIC[3] ?? 0, MAGIC[2] ?? 0)
      }
    }
    if (f >= CHANGE_BACK && f < CHANGE_BACK + 8) {
      const t = (f - CHANGE_BACK) / 8
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU + 0.4
        const r = 3 + t * 9
        const px = b.cx + Math.cos(a) * r
        const py = 24 + Math.sin(a) * r * 0.45 - t * 3
        const pr = 2.2 + t * 1.2
        for (let y = Math.floor(py - pr); y <= Math.ceil(py + pr); y++) {
          for (let x = Math.floor(px - pr); x <= Math.ceil(px + pr); x++) {
            const d = Math.hypot(x - px, y - py) / pr
            if (d < 1 && (1 - t) ** 1.5 * (1.3 - d) > threshold(x, y) * 0.8) c.set(x, y, shade(MAGIC, 1 + (1 - d) * 1.6 - t, x, y, true))
          }
        }
        if (k % 2 === 0 && t < 0.7) star(c, b.cx + Math.cos(a + 0.4) * (r + 3), 22 + Math.sin(a + 0.4) * (r + 3) * 0.5, 1, MAGIC[3] ?? 0, GOLD[6] ?? 0)
      }
    }

    const flash = FLASH[f] ?? 0
    if (flash > 0) {
      for (let i = 0; i < c.px.length; i++) {
        const x = i % W
        const y = (i / W) | 0
        if (flash * 1.4 <= threshold(x, y)) continue
        const col = c.px[i] ?? 0
        const lum = (((col >> 16) & 255) * 0.3 + ((col >> 8) & 255) * 0.55 + (col & 255) * 0.15) / 255
        c.px[i] = MAGIC[Math.min(3, Math.floor(lum * 5 + flash * 1.6))] ?? col
      }
    }
  })
}

function swirlBox(start: number, span: number, dir: number): readonly [number, number, number, number] {
  let [x0, y0, x1, y1] = [W, H, 0, 0]
  for (let f = start; f <= start + span + 2; f++) {
    for (const s of swirl(f, start, span, body(f), dir)) {
      for (const [x, y] of [[s.x, s.y], s.trail] as [number, number][]) {
        x0 = Math.min(x0, Math.floor(x) - 1)
        y0 = Math.min(y0, Math.floor(y) - 1)
        x1 = Math.max(x1, Math.ceil(x) + 1)
        y1 = Math.max(y1, Math.ceil(y) + 1)
      }
    }
  }
  return [Math.max(0, x0), Math.max(0, y0), Math.min(W - 1, x1), Math.min(H - 1, y1)]
}

export const scene: Scene = {
  verb: 'Transfiguring',
  render,
  hero: 38,
  snaps: [
    { frames: [SWIRL, CHANGE - 1], box: swirlBox(SWIRL, CHANGE - SWIRL - 1, 1), colors: [...MAGIC], why: 'sparkles spiral in round the pumpkin, each skipping several pixels a frame as it whirls' },
    { frames: [CHANGE, CHANGE + 3], colors: [...MAGIC], why: "the change: a flash lights the whole garden in the magic's colours as the pumpkin becomes the coach, then dithers away over three frames" },
    { frames: [SWIRL_BACK, CHANGE_BACK - 1], box: swirlBox(SWIRL_BACK, CHANGE_BACK - SWIRL_BACK - 1, -1), colors: [...MAGIC], why: 'the sparkles spiral in again round the coach, each skipping several pixels a frame' },
    { frames: [CHANGE_BACK, CHANGE_BACK + 3], why: 'the change back: a flash as the coach collapses into the falling pumpkin, dithering away over three frames' },
  ],
}
