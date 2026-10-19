import { Canvas, clamp, ease, hash, hex, lerp, mix, mod, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const TILE = hex('0f2a2c 15363a 1c4548 245458 2e6466 3b7674')
const ROSE = hex('1c2a34 2a3442 3c3f52 4e4a60')
const NEON = hex('7a1d4e c8357e ff5fa8 ffb4d8')
const SKY = hex('7fb4c8 a8d4dc d4ece6 fbf6e0')
const CHROME = hex('1e2028 3a3e4a 6a7080 a4abb8 dde2ea')
const COUNTER = hex('2a0810 46101a 641824 862230 a83238 c84c48 e0786a')
const PLATE = hex('5a5f78 7d87a2 a4aec4 c9d1e0 e6ecf4 fbfdff')
const STRIPE = hex('1a4a3a 2a6e52 3f8f68')
const CAKE = hex('3b1a0e 5c2b13 82401a a95f24 cc8434 e3a84e f2cc80 fbe8b8')
const SYRUP = hex('2c0b04 4f1705 7a2808 a6420c cc6612 e8901e f8bf48 fff0b0')
const BUTTER = hex('a07a26 cca238 eecb54 fce78a fffadc')
const STEAM = hex('5e6a68 8a8f8a')

const CX = 30
const BASE = 25
const N = 6
const TOP = BASE - 3 * N + 1
type Cake = { dx: number; r: number }
const CAKES: Cake[] = Array.from({ length: N }, (_, i) => ({
  dx: Math.round((hash(i, 4) - 0.5) * 2),
  r: 11 + (hash(i, 9) < 0.35 ? 1 : 0) - (i === N - 1 ? 1 : 0),
}))

const SHIFT = 12
const at = (t: number) => mod(t - SHIFT, LOOP)
const SKID = [5, 3, 2, 1]
const WIND = 60
const GONE = 65

function slide(t: number): { ox: number; smear: number } | undefined {
  if (t === -1) return { ox: 34, smear: 30 }
  if (t < 0) return undefined
  if (t < SKID.length) return { ox: SKID[t] ?? 0, smear: t === 0 ? 14 : 0 }
  if (t < WIND) return { ox: 0, smear: 0 }
  if (t < GONE) return { ox: Math.round(2 * ease.inOut(clamp((t - WIND) / 4))), smear: 0 }
  if (t === GONE) return { ox: -14, smear: 16 }
  if (t === GONE + 1) return { ox: -44, smear: 22 }
  return undefined
}

const LEAN_IN = [1, -1, -1.2, -2, -2.2, -2, -1.2, 0, 1, 1, 0.4, -0.2]
const LEAN_WIND = [0, -0.4, -1, -1, 0]
function lean(t: number): number {
  if (t < 0) return 1
  if (t < LEAN_IN.length) return LEAN_IN[t] ?? 0
  if (t < WIND) return 0
  if (t < GONE) return LEAN_WIND[t - WIND] ?? 0
  return 3
}

const topAt = (t: number) => (slide(t)?.ox ?? 0) + Math.round(lean(t))

const POUR = [14, 34] as const
const spoutX = (t: number) => CX + 1 + Math.sin((t - POUR[0]) * 0.5) * 6 * clamp((t - POUR[0]) / 4)

const pool = (t: number) => ease.out(clamp((t - POUR[0] - 1) / 16))

type Drip = { dx: number; start: number; len: number; speed: number }
const DRIPS: Drip[] = [
  { dx: -8, start: 23, len: 6, speed: 12 },
  { dx: -3, start: 26, len: 11, speed: 18 },
  { dx: 3, start: 22, len: 18, speed: 20 },
  { dx: 8, start: 28, len: 8, speed: 14 },
]
const dripLength = (d: Drip, t: number) => d.len * ease.out(clamp((t - d.start) / d.speed))

const lip = (dx: number, spread: number) => (spread < 0.7 ? 0 : Math.round((1 + Math.sin(dx * 1.3 + 1) * 0.8) * clamp((spread - 0.7) / 0.3)))

function butter(t: number): { x: number; y: number; isTipped: boolean; isSmall: boolean } {
  const ride = ease.in(clamp((t - 30) / 7))
  const drop = clamp((t - 37) / 9)
  const fall = drop < 0.5 ? ease.in(drop * 2) * 0.5 : 0.5 + ease.out((drop - 0.5) * 2) * 0.5
  const isLurching = (t >= 1 && t < LEAN_IN.length + 1) || (t > WIND && t < GONE)
  const wobble = isLurching ? clamp(topAt(t - 1) - topAt(t), -1, 1) : 0
  return {
    x: Math.round(lerp(-2, 4, ride)) + wobble,
    y: Math.round(ride * 1.5 + fall * 7),
    isTipped: drop > 0 && drop < 0.6,
    isSmall: t > 40,
  }
}

function render(): Int32Array[] {
  const frames: Int32Array[] = []

  const tubes: { x: number; y: number; isSteam: boolean }[] = []
  for (let x = 7; x <= 15; x++) tubes.push({ x, y: 7, isSteam: false })
  for (let y = 8; y <= 10; y++) tubes.push({ x: 7, y, isSteam: false }, { x: 15, y, isSteam: false })
  for (let x = 8; x <= 14; x++) tubes.push({ x, y: 11, isSteam: false })
  tubes.push({ x: 16, y: 8, isSteam: false }, { x: 17, y: 9, isSteam: false }, { x: 16, y: 10, isSteam: false })
  for (const sx of [9, 12]) {
    for (const [dx, dy] of [[0, 5], [1, 4], [1, 3], [0, 2], [0, 1], [1, 0]] as const) tubes.push({ x: sx + dx, y: dy, isSteam: true })
  }

  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const g = mod(f + SHIFT, LOOP)
    const isSteamLit = !(g === 40 || g === 42 || g === 43)
    const lit = tubes.filter(t => !t.isSteam || isSteamLit)

    for (let y = 0; y < 18; y++) {
      for (let x = 0; x < W; x++) {
        const row = Math.floor(y / 4)
        const isGrout = y % 4 === 3 || (x + (row % 2) * 3) % 6 === 0
        const sun = clamp(1 - Math.hypot(x - 58, (y - 6) * 1.4) / 34)
        let glow = 0
        for (const t of lit) glow = Math.max(glow, clamp(1 - Math.hypot(x - t.x, (y - t.y) * 1.2) / 3.5))
        const level = 1.6 + sun * 2.8 - (isGrout ? 0.6 : 0) - (y < 2 ? 0.4 : 0)
        c.set(x, y, glow > 0.4 ? shade(ROSE, level + 0.6, x, y) : shade(TILE, level, x, y))
      }
    }
    for (let y = 1; y <= 13; y++) {
      for (let x = 46; x <= 62; x++) {
        const isFrame = x === 46 || x === 62 || y === 1 || y === 13 || x === 54 || y === 7
        if (isFrame) {
          c.set(x, y, shade(CHROME, x === 46 || y === 13 ? 2 : 3.4))
          continue
        }
        const glare = clamp(1 - Math.hypot(x - 60, y - 3) / 9)
        c.set(x, y, shade(SKY, 0.6 + (13 - y) * 0.12 + glare * 2.2, x, y))
      }
    }
    for (const t of tubes) c.set(t.x, t.y, lit.includes(t) ? NEON[3] ?? 0 : NEON[0] ?? 0)
    for (let x = 0; x < W; x++) {
      c.set(x, 18, shade(CHROME, 2 + (x > 40 ? 1.6 : 0.6)))
      c.set(x, 19, shade(CHROME, 1))
      for (let y = 20; y < 30; y++) {
        const sheen = clamp(1 - Math.abs(y - 21.5) / 2.5) * clamp((x - 34) / 20)
        c.set(x, y, shade(COUNTER, 2.6 + (y - 20) * 0.12 + sheen * 2.6, x, y))
      }
      c.set(x, 30, shade(CHROME, 3.6 - (x < 20 ? 0.6 : 0)))
      c.set(x, 31, shade(CHROME, 1.4))
    }

    for (const t of [g, g - LOOP]) {
      const s = slide(t)
      if (s && s.smear > 0) drawSmeared(c, s.ox, t, s.smear)
      else if (s) drawPlate(c, s.ox, t)
    }

    if (g >= POUR[0] && g <= POUR[1] + 2) {
      const head = g - POUR[0]
      const tail = g - POUR[1]
      const yTop = tail > 0 ? tail * 4 : 0
      const yEnd = Math.min(TOP - 2, head * 4 + 1)
      for (let y = yTop; y <= yEnd; y++) {
        const x = Math.round(spoutX(g - y * 0.14))
        c.set(x, y, shade(SYRUP, (y + g) % 6 === 0 ? 7 : 5.4, x, y))
      }
      if (tail <= 0) {
        const x = Math.round(spoutX(g))
        c.set(x - 1, 0, shade(CHROME, 2))
        c.set(x, 0, shade(CHROME, 3.6))
        c.set(x + 1, 0, shade(CHROME, 2.6))
      }
    }

    frames.push(c.px)
  }

  return frames
}

const EMPTY = -1

function drawSmeared(c: Canvas, ox: number, t: number, reach: number): void {
  const layer = new Canvas()
  layer.fill(EMPTY)
  drawPlate(layer, 0, t)
  for (let y = 0; y < H; y++) {
    let xl = W
    let xr = -1
    for (let x = 0; x < W; x++) {
      if (layer.get(x, y) === EMPTY) continue
      xl = Math.min(xl, x)
      xr = x
    }
    if (xr < 0) continue
    const len = Math.round(reach * (0.5 + 0.5 * hash(y, 17)))
    const span = xr - xl
    for (let x = xl; x <= xr + len; x++) {
      const col = layer.get(xl + Math.round(((x - xl) * span) / (span + len)), y)
      if (col === EMPTY) continue
      c.set(x + ox, y, col)
    }
  }
}
function drawPlate(c: Canvas, ox: number, t: number): void {
  const cx = CX + ox
  const top = lean(t)
  const shift = (i: number) => Math.round((top * i) / (N - 1))
  const rowShift = (y: number) => shift(clamp(Math.floor((BASE - y) / 3), 0, N - 1))
  c.ellipse(cx - 3, 27.4, 20, 3.4, (x, y) => shade(COUNTER, 1.2 + (y - 20) * 0.1, x, y))
  c.ellipse(cx, 26.5, 19, 4.2, (x, y) => {
    const d = Math.hypot((x - cx) / 19, (y - 26.5) / 4.2)
    const side = (x - cx) / 19
    if (d > 0.8 && d < 0.9) return shade(STRIPE, 1.4 + side, x, y)
    const isShadowed = Math.hypot((x - (cx - 6)) / 13, (y - 26) / 2.4) < 1
    const well = d < 0.7 ? -0.5 : 0
    const rim = d > 0.92 && y < 27 ? 0.8 : 0
    return shade(PLATE, 3.5 + side * 1.3 - (y > 28 ? 0.7 : 0) + well + rim - (isShadowed ? 1.4 : 0), x, y)
  })
  const puddle = clamp((t - 36) / 16)
  if (puddle > 0) {
    const rx = 8 + puddle * 6
    const ry = 1 + puddle * 1.4
    c.ellipse(cx + 3, 26, rx, ry, (x, y) => {
      const d = Math.hypot((x - cx - 3) / rx, (y - 26) / ry)
      const glint = y === 26 && x >= cx + 9 && x <= cx + 10 ? 3 : 0
      return shade(SYRUP, 3.4 - (d > 0.75 ? 1 : 0) + glint, x, y)
    })
  }
  for (let i = 0; i < N; i++) {
    const cake = CAKES[i] ?? { dx: 0, r: 11 }
    const y0 = BASE - 3 * i - 2
    const mid = cx + cake.dx + shift(i)
    for (let j = 0; j < 3; j++) {
      const y = y0 + j
      const inset = j === 1 ? 0 : 1
      const band = j === 0 ? 5.4 : j === 1 ? 4.2 : 2.4
      for (let x = mid - cake.r + inset; x <= mid + cake.r - inset; x++) {
        const n = (x - mid) / cake.r
        const isRim = x === mid - cake.r + inset
        const color = shade(CAKE, band + n * 1.3 + (x === mid + cake.r - inset ? 0.8 : 0), x, y)
        c.set(x, y, isRim ? mix(shade(CAKE, band - 0.6), NEON[2] ?? 0, 0.3) : color)
      }
    }
  }
  const cake = CAKES[N - 1] ?? { dx: 0, r: 10 }
  const tx = cx + cake.dx + shift(N - 1)
  const ty = TOP - 1
  c.ellipse(tx, ty + 0.5, cake.r - 0.5, 2, (x, y) => {
    const d = Math.hypot((x - tx) / cake.r, (y - ty - 0.5) / 2)
    return shade(CAKE, 5.2 - d * 1.4 + (x - tx) * 0.04 + (y < ty ? 0.5 : 0), x, y)
  })
  const fresh = clamp((t - 2) / 4) * clamp(1 - (t - 18) / 12)
  const sx = cx + cake.dx
  if (fresh > 0) {
    for (const [k, wx] of [-4, 2].entries()) {
      for (const lag of [0, 6]) {
        const p = mod(t + k * 4 + lag, 12) / 12
        const alpha = Math.sin(p * Math.PI) * fresh
        if (alpha < 0.35) continue
        const x = sx + wx + Math.round(Math.sin(p * 5 + k * 2) * 1.2)
        const y = Math.round(ty - 2 - p * 7)
        for (const dy of [0, 1]) c.set(x, y + dy, STEAM[alpha > 0.7 && dy === 0 ? 1 : 0] ?? 0)
      }
    }
  }
  const spread = pool(t)
  if (spread > 0) {
    const rx = Math.max(0.6, (cake.r + 0.4) * spread)
    const ry = Math.max(0.6, 2.2 * spread)
    const pcx = tx + 1
    c.ellipse(pcx, ty + 0.5, rx, ry, (x, y) => {
      const d = Math.hypot((x - pcx) / rx, (y - ty - 0.5) / ry)
      return shade(SYRUP, 4.4 - (d > 0.75 ? 1.2 : 0) + (y > ty ? -0.6 : 0), x, y)
    })
    if (spread > 0.5) for (let x = pcx + 2; x <= pcx + 4; x++) c.set(x, ty, SYRUP[7] ?? 0)
    if (spread > 0.5) c.set(pcx + 5, ty, SYRUP[6] ?? 0)
    for (let x = Math.round(pcx - rx + 1); x <= Math.round(pcx + rx - 1); x++) {
      const hang = lip(x - tx, spread)
      for (let y = TOP; y < TOP + hang; y++) c.set(x + rowShift(y) - shift(N - 1), y, shade(SYRUP, 3.2, x, y))
    }
  }
  for (const d of DRIPS) {
    const len = dripLength(d, t)
    if (len < 1) continue
    const head = TOP + Math.round(len)
    for (let y = TOP; y <= head; y++) {
      const x = cx + d.dx + rowShift(y)
      const isBead = y >= head - 1 && len > 3
      const isTip = y === head
      const left = isTip && isBead ? x : x - (isBead ? 1 : 0)
      const right = x + 1
      for (let px = left; px <= right; px++) {
        let level = px === left ? 2.4 : 3.8
        if (px === right && y > TOP && y < TOP + 3) level = 6.4
        if (isBead && !isTip && px === right) level = 6.8
        c.set(px, y, shade(SYRUP, level, px, y))
      }
    }
  }
  const b = butter(t)
  const bw = b.isSmall ? 4 : 5
  const bx = tx + b.x - (bw >> 1)
  const by = ty - 2 + b.y
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < bw; i++) {
      const x = bx + i + (j === 0 && b.isTipped ? 1 : 0)
      const y = by + j
      if (j === 2 && (i === 0 || i === bw - 1)) continue
      const level = j === 0 ? 3.6 + (i === bw - 1 ? 0.6 : 0) : 2.2 + (i >= bw - 2 ? 0.8 : 0) - (j === 2 ? 0.8 : 0)
      c.set(x, y, shade(BUTTER, level, x, y))
    }
  }
}
export const scene: Scene = {
  verb: 'Drizzling',
  render,
  hero: at(40),
  snaps: [
    { frames: [at(GONE), at(GONE + 2)], box: [0, 6, 50, 30], why: 'the plate is whisked off left: two smear frames, then the empty counter' },
    { frames: [at(GONE), at(GONE + 2)], box: [5, 0, 19, 12], why: 'the neon cup, hidden by the smear as it passes in front, shows again' },
    { frames: [at(40), at(44)], box: [9, 0, 13, 5], why: 'the neon steam tubes sputter out and back on' },
    { frames: [at(-1), at(1)], box: [11, 5, 63, 30], why: 'the next stack shoots in from the right: two smear frames, then it lands and skids' },
  ],
}