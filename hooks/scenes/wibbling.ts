import { Canvas, TAU, beat, clamp, ease, hash, hex, lerp, loopNoise, mix, shade, smoothstep, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 48

const SKY = hex('110e2c 18143a 221a48 2e2054 3e2860 52306a 6a3a6e 86466e a85a6c c87668 e2986a f2bc7c')
const NEAR = hex('0b0818 120d22 1a132e 2a1c3c')
const RIM = hex('5a3450 8a4a5a c06a5e')
const WINDOW = hex('c88a3a f2c060 fde49a')
const HOUSE = [SKY[1] ?? 0, SKY[2] ?? 0, SKY[3] ?? 0, 0x4a3050]
const FAR_TREE = [SKY[3] ?? 0]
const FENCE = [NEAR[2] ?? 0, ...hex('2e2240 3a2a4c 5e3e5e 4a3050')]
const SMOKE = [SKY[4] ?? 0, SKY[5] ?? 0]
const LAWN = [...hex('0e0f1e 141828 1b2232'), 0x3a2a4c]
const FILM = hex('5a6cff 3ad0ff 6effa8 fff07a ffb04a ff5aa8 c060ff')
const FIREFLY = hex('6a7034 c8d860 f4fca8')

const skyLevel = (x: number, y: number) => 9.6 * Math.max(0, y / 30) ** 0.9 + Math.max(0, 1 - Math.hypot((x + 6) / 60, (y - 34) / 24)) * 3
const skyAt = (x: number, y: number) => shade(SKY, skyLevel(x, y), x, y)
const FILM_DIM = FILM.map(col => mix(col, SKY[4] ?? 0, 0.5))
const STARLIGHT = mix(SKY[3] ?? 0, 0xfff6e0, 0.7)
const LAWN_TOP = 28
const FENCE_TOP = 24
const CHIMNEY = { x: 24, y: 8 }

function gable(c: Canvas, x0: number, x1: number, eave: number) {
  const mid = (x0 + x1) / 2
  const peak = eave - Math.floor((x1 - x0) / 2)
  c.rect(x0 + 1, eave, x1 - x0 - 1, H - eave, HOUSE[2] ?? 0)
  for (let y = peak; y <= eave; y++) {
    const half = y - peak
    for (let x = Math.ceil(mid - half); x <= Math.floor(mid + half); x++) c.set(x, y, HOUSE[1] ?? 0)
    c.set(Math.ceil(mid - half), y, HOUSE[3] ?? 0)
  }
  c.rect(x0 + 1, eave + 1, x1 - x0 - 1, 1, HOUSE[0] ?? 0)
}

function hipped(c: Canvas, x0: number, x1: number, eave: number, ridge: number) {
  c.rect(x0 + 1, eave, x1 - x0 - 1, H - eave, HOUSE[2] ?? 0)
  for (let y = ridge; y <= eave; y++) {
    const inset = eave - y
    for (let x = x0 + inset; x <= x1 - inset; x++) c.set(x, y, HOUSE[1] ?? 0)
    c.set(x0 + inset, y, HOUSE[3] ?? 0)
  }
  c.rect(x0 + 2 + (eave - ridge), ridge, x1 - x0 - 3 - 2 * (eave - ridge), 1, HOUSE[3] ?? 0)
  c.rect(x0 + 1, eave + 1, x1 - x0 - 1, 1, HOUSE[0] ?? 0)
}

const BACKDROP: Int32Array = (() => {
  const c = new Canvas()
  c.fill(skyAt)
  c.disc(55.5, 4.5, 2.6, 0xf6e8c8)
  c.disc(56.7, 3.8, 2.4, (x, y) => skyAt(x, y))
  for (const [x, y] of [[6, 2], [17, 5], [27, 1], [38, 4], [46, 1], [61, 9], [31, 8]] as const) c.set(x, y, STARLIGHT)
  for (const [tx, ty, r] of [[30, 14, 3.2], [44, 14, 3.6], [40, 15, 2.6]] as const) c.disc(tx, ty, r, FAR_TREE[0] ?? 0)
  c.rect(CHIMNEY.x, CHIMNEY.y + 1, 2, 6, HOUSE[1] ?? 0)
  c.rect(CHIMNEY.x - 1, CHIMNEY.y, 4, 1, HOUSE[0] ?? 0)
  gable(c, 14, 28, 17)
  hipped(c, 27, 46, 19, 16)
  c.rect(17, 19, 2, 2, WINDOW[1] ?? 0)
  c.set(17, 19, WINDOW[2] ?? 0)
  c.rect(23, 19, 2, 2, HOUSE[3] ?? 0)
  c.set(21, 14, WINDOW[0] ?? 0)
  c.rect(33, 21, 4, 2, WINDOW[1] ?? 0)
  c.rect(34, 21, 1, 2, WINDOW[0] ?? 0)
  c.rect(40, 21, 2, 2, HOUSE[3] ?? 0)
  c.rect(0, FENCE_TOP, W, LAWN_TOP - FENCE_TOP, FENCE[1] ?? 0)
  c.rect(0, FENCE_TOP, 21, LAWN_TOP - FENCE_TOP, FENCE[2] ?? 0)
  for (let x = 1; x < W; x += 3) c.rect(x, FENCE_TOP + 1, 1, LAWN_TOP - FENCE_TOP - 1, FENCE[0] ?? 0)
  c.rect(0, FENCE_TOP, W, 1, FENCE[3] ?? 0)
  for (let x = 9; x < W; x += 12) {
    c.rect(x, FENCE_TOP - 1, 2, LAWN_TOP - FENCE_TOP + 1, FENCE[2] ?? 0)
    c.set(x, FENCE_TOP - 1, FENCE[3] ?? 0)
  }
  for (let x = 0; x < W; x++) {
    for (let y = LAWN_TOP; y < H; y++) c.set(x, y, shade(LAWN, 2.4 - (y - LAWN_TOP) * 0.8, x, y))
    if (x < 26) c.set(x, LAWN_TOP, LAWN[3] ?? 0)
  }
  for (const x of [15, 27, 38, 52, 62]) {
    c.rect(x, LAWN_TOP - 1, 3, 1, LAWN[2] ?? 0)
    c.set(x, LAWN_TOP - 2, LAWN[2] ?? 0)
    c.set(x + 2, LAWN_TOP - 2, LAWN[2] ?? 0)
  }
  c.rect(57, 16, 2, LAWN_TOP + 1 - 16, NEAR[1] ?? 0)
  c.line(56, 19, 47, 15, NEAR[1] ?? 0)
  for (const [tx, ty, r] of [[57, 12, 5], [52, 13, 3.6], [62, 15, 4.4], [59, 8, 3.4], [54, 9, 3]] as const) {
    c.disc(tx, ty, r, (x, y) => (Math.hypot(x - tx + 1, y - ty + 1) > r - 0.4 && x < tx && y < ty ? NEAR[3] : NEAR[1]) ?? 0)
  }
  c.rect(55, LAWN_TOP + 1, 6, 1, NEAR[0] ?? 0)
  return c.copy()
})()

function drawSwing(c: Canvas, f: number) {
  const sway = Math.round(wave(f, LOOP) * 1.2)
  const seat = { x: 47 + sway, y: 26 }
  c.line(48, 16, seat.x, seat.y - 1, FENCE[4] ?? 0)
  c.line(52, 17, seat.x + 4, seat.y - 1, FENCE[4] ?? 0)
  c.rect(seat.x, seat.y, 5, 1, FENCE[3] ?? 0)
  c.rect(seat.x, seat.y + 1, 5, 1, NEAR[1] ?? 0)
}

function drawSmoke(c: Canvas, f: number) {
  for (let k = 0; k < 7; k++) {
    const x = CHIMNEY.x + 1 + Math.round(k * 0.45 + Math.sin(k * 0.8 - TAU * f / LOOP * 2) * k * 0.16)
    c.set(x, CHIMNEY.y - 1 - k, (k < 3 ? SMOKE[1] : SMOKE[0]) ?? 0)
  }
}

const CHILD = [
  '...###..',
  '..#####.',
  '.######.',
  '..####..',
  '...##...',
  '..####..',
  '.######.',
  '.#####..',
  '..####..',
  '..####..',
  '..#..#..',
  '..#..#..',
]
const CHILD_X = 3

function lift(f: number): number {
  if (f >= 1 && f <= 6) return Math.round(Math.sin(beat(f, 1, 6) * Math.PI))
  if (f >= 38 && f <= 44) return Math.round(Math.sin(beat(f, 38, 44) * Math.PI) * 3)
  return 0
}

type Bubble = { x: number; y: number; r: number; a2: number; p2: number; a3: number; thin: number }

const POP = 37
const RING = { x: 13, y: 21 }

function bubble(f: number): Bubble | undefined {
  if (f < 6 || f >= POP) return undefined
  if (f < 16) {
    const t = smoothstep(0, 1, beat(f, 6, 15))
    const r = lerp(1.2, 5.6, t)
    return { x: RING.x + r * 0.9, y: RING.y - t * 0.6, r, a2: 0.22 * (1 - t * 0.4), p2: 0, a3: 0.05, thin: 0 }
  }
  const t = beat(f, 16, POP)
  const k = f - 16
  const wob = Math.exp(-k * 0.18)
  return {
    x: lerp(RING.x + 5, 45, smoothstep(0, 1, t)) + Math.sin(t * Math.PI * 2) * 2,
    y: lerp(RING.y - 0.6, 9, ease.out(t)) - Math.sin(t * Math.PI) * 1,
    r: 5.8,
    a2: 0.16 * wob * Math.cos(k * 0.6) + 0.035 * Math.sin(k * 0.55),
    p2: 0.2 * Math.sin(k * 0.3),
    a3: 0.05 * Math.sin(k * 0.8 + 1) * (0.4 + wob),
    thin: beat(f, 31, POP),
  }
}

function drawBubble(c: Canvas, b: Bubble, f: number) {
  const cx = Math.round(b.x * 2) / 2
  const cy = Math.round(b.y * 2) / 2
  const reach = b.r * (1 + Math.abs(b.a2) + Math.abs(b.a3)) + 1
  for (let y = Math.floor(cy - reach); y <= Math.ceil(cy + reach); y++) {
    for (let x = Math.floor(cx - reach); x <= Math.ceil(cx + reach); x++) {
      const dx = x - cx
      const dy = y - cy
      const th = Math.atan2(dy, dx)
      const edge = b.r * (1 + b.a2 * Math.cos(2 * (th - b.p2)) + b.a3 * Math.cos(3 * th + 0.7))
      const d = Math.hypot(dx, dy)
      if (d > edge) continue
      const u = d / edge
      const sunk = y - Math.round(b.y) - Math.floor(f / 2)
      const swirl = loopNoise((x - Math.round(b.x)) * 0.22 + 3, sunk * 0.22, 0, 3, 7)
      const thick = sunk / b.r * 0.9 + swirl * 2.2
      const band = Math.floor(thick * 3)
      const film = FILM[((band % FILM.length) + FILM.length) % FILM.length] ?? 0
      const under = c.get(x, y)
      const isSky = under === skyAt(x, y)
      const isRim = edge - d < 1
      const ring = Math.floor((((th + Math.PI + Math.floor(f / 2) / b.r) / TAU) * FILM.length) % FILM.length)
      const spot = b.thin > 0 && dy < 0 && Math.hypot(dx, dy + b.r * 0.55) < b.thin * b.r * 0.75
      const clear = isSky ? shade(SKY, skyLevel(x, y) + 0.9, x, y) : under
      let col: number
      if (isRim) col = spot ? (FILM_DIM[ring % 2 ? 3 : 4] ?? 0) : (FILM[ring] ?? 0)
      else if (spot) col = under
      else if (u > 0.74) col = FILM_DIM[ring] ?? 0
      else col = thick * 3 - band < 0.16 && u > 0.25 ? (FILM_DIM[((band % FILM.length) + FILM.length) % FILM.length] ?? 0) : clear
      if (!isRim && u > 0.62 && dy > 0 && dx < b.r * 0.3) col = SKY[10] ?? 0
      if (u > 0.5 && u < 0.82 && th > -2.75 && th < -1.95) col = 0xfff8f0
      c.set(x, y, col)
    }
  }
  c.set(cx + b.r * 0.4, cy + b.r * 0.42, SKY[11] ?? 0)
}

function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    c.px.set(BACKDROP)
    drawSmoke(c, f)
    drawSwing(c, f)

    for (const [fx, fy, phase] of [[50, 23, 0], [61, 26, 0.45], [46, 28, 0.75]] as const) {
      const on = Math.sin(TAU * (f / LOOP * 2 + phase))
      if (on < 0) continue
      const x = fx + Math.round(Math.sin(TAU * (f / LOOP + phase)) * 1.5)
      const y = fy + Math.round(Math.cos(TAU * (f / LOOP * 2 + phase)))
      c.set(x, y, shade(FIREFLY, 1 + on * 1.4))
      if (on > 0.6) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.set(x + dx, y + dy, FIREFLY[0] ?? 0)
    }

    const ly = lift(f)
    const top = 20 - ly
    c.sprite(CHILD_X, top, CHILD, { '#': NEAR[0] ?? 0 })
    const tail = f >= 39 && f <= 45 ? (lift(f - 1) > ly ? -1 : 1) : 0
    c.set(CHILD_X + 1, top + 1 + tail, NEAR[0] ?? 0)
    c.set(CHILD_X, top + 2 + tail, NEAR[0] ?? 0)
    CHILD.forEach((row, j) => {
      const i = row.indexOf('#')
      if (i >= 0 && j > 0) c.set(CHILD_X + i, top + j, RIM[j < 4 ? 1 : 0] ?? 0)
    })
    const raised = f < 17 || f > 45 ? 1 : f > 40 ? beat(f, 40, 46) : 1 - beat(f, 17, 22)
    const ring = { x: Math.round(lerp(12, RING.x, raised)), y: Math.round(lerp(25, RING.y, raised)) - ly }
    c.line(CHILD_X + 6, top + 7, ring.x - 2, ring.y + 2, NEAR[0] ?? 0)
    c.line(ring.x - 1, ring.y + 1, ring.x - 2, ring.y + 2, NEAR[2] ?? 0)
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) c.set(ring.x + dx, ring.y + dy, RIM[1] ?? 0)
    if (f > 44 || f < 6) c.set(ring.x, ring.y, FILM_DIM[(f >> 1) % FILM.length] ?? 0)

    const b = bubble(f)
    if (b) drawBubble(c, b, f)

    const at = bubble(POP - 1)
    if (at && f === POP) {
      for (let k = 0; k < 28; k++) {
        const th = (k / 28) * TAU
        const fromTop = Math.abs(((th + Math.PI / 2 + Math.PI) % TAU) - Math.PI)
        if (fromTop < 1.3) continue
        const r = at.r + 0.6
        c.set(at.x + Math.cos(th) * r, at.y + Math.sin(th) * r, FILM[k % FILM.length] ?? 0)
      }
      c.set(at.x, at.y - at.r, 0xffffff)
    }
    if (at && f > POP && f <= POP + 10) {
      const t = f - POP
      for (let k = 0; k < 16; k++) {
        const th = (k / 16) * TAU + hash(k, 3) * 0.3
        const v = 0.9 + hash(k, 5) * 0.9
        const life = 5 + ((k * 5) % 6)
        if (t > life) continue
        const x = at.x + Math.cos(th) * (at.r + v * t)
        const y = at.y + Math.sin(th) * (at.r + v * t * 0.8) + 0.16 * t * t
        c.set(x, y, t < 2 + (k % 3) ? 0xfff8f0 : (t < life - 2 ? FILM : FILM_DIM)[k % FILM.length] ?? 0)
      }
    }

    out.push(c.copy())
  }

  return out
}

export const scene: Scene = { verb: 'Wibbling', render, hero: 28 }
