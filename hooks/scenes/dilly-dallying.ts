import { Canvas, TAU, clamp, hash, hex, loopNoise, mix, noise, smoothstep, shade, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72
const GROUND = 26

const SKY = hex('2a2650 3f3468 5b4079 7d4d84 a35d88 c97586 e5937f f4b582 fbd59a fdeec0')
const HEDGE = hex('2b2442 3b2f52 4e3c60 674c6e 87607a')
const LEAVES = hex('141f27 1c2f30 27423b 365747 4b6d4f 6c8756 9ca666 d2c27c')
const STONE = hex('1e1824 2f2735 463a48 5f4f5a 7a6670 9a8484 bba49a dcc6b2')
const MOSS = hex('161f20 22322c 33472f 4c6236')
const SHEEN = hex('4a3c4c 66566a 8a7a90 c8bccc fbf1f4')
const BODY = hex('2e1c22 553330 7e5040 a26f52 c08e66 d9ae80 ecca9e f8e6c4')
const SHELL = hex('1f1018 3a1c1e 5e2e22 864627 aa6230 c98440 e2a95a f4cf86')
const PETAL = hex('6e6488 9c94b4 cfc8dc f2eef4 ffffff')
const BLOOM = hex('a8641a e0a020 f8d048')
const WING = hex('1c2450 2c4a9a 4a7ad8 8cb8f4 d4ecff')
const EYE = 0x1a1420

const SUN = { x: 53, y: 10 }
const TO_SUN = [0.75, -0.66] as const

function key(f: number, keys: readonly (readonly [number, number])[]): number {
  for (let k = 0; k + 1 < keys.length; k++) {
    const [f0, v0] = keys[k] ?? [0, 0]
    const [f1, v1] = keys[k + 1] ?? [0, 0]
    if (f >= f0 && f <= f1) return v0 + (v1 - v0) * smoothstep(f0, f1, f)
  }
  return f < (keys[0]?.[0] ?? 0) ? keys[0]?.[1] ?? 0 : keys[keys.length - 1]?.[1] ?? 0
}

const X_KEYS = [[0, 24], [3, 24], [7, 26], [11, 26], [15, 28], [45, 28], [49, 26], [52, 26], [56, 24], [72, 24]] as const
const STRETCH_KEYS = [
  [0, 0], [3, 2], [7, 0], [11, 2], [15, 0], [18, 1], [20, 2], [21, 1], [23, 2], [24, 1], [28, 1], [32, 0],
  [36, 0], [37, -2], [39, -2], [41, 0], [42, 0], [45, 2], [49, 0], [52, 2], [56, 0],
  [62, 0], [63, -2], [65, -2], [67, 0],
] as const
const STALK_KEYS = [
  [0, 5], [36, 5], [37, 1.5], [39, 1.5], [41, 5], [56, 5], [58, 3.4], [62, 3.4], [63, 1.5], [65, 1.5], [68, 5], [69, 5.6], [71, 5],
] as const
const LEAN_KEYS = [
  [0, 0.35], [15, 0.35], [18, 0.85], [20, 1.15], [21, 0.85], [23, 1.15], [24, 0.85], [28, 0.7], [56, 0.6], [58, 1.3], [62, 1.3], [68, 0.35],
] as const
const WATCH_KEYS = [[28, 0], [31, 1], [52, 1], [55, 0]] as const
const dirAt = (f: number): 1 | -1 => (f >= 38 && f < 64 ? -1 : 1)

const FLIGHT = [
  [22, 68, 7], [30.5, 50, 9], [34.3, 42, 8], [37.3, 36, 10], [40, 31, 7], [44.4, 22, 9], [48.4, 14, 6], [52.6, 5, 4], [58, -6, 1],
] as const
function through(f: number, keys: readonly (readonly [number, number])[]): number {
  for (let k = 0; k + 1 < keys.length; k++) {
    const [f0, v0] = keys[k] ?? [0, 0]
    const [f1, v1] = keys[k + 1] ?? [0, 0]
    if (f >= f0 && f <= f1) return v0 + ((v1 - v0) * (f - f0)) / (f1 - f0)
  }
  return keys[keys.length - 1]?.[1] ?? 0
}
function butterfly(f: number): [number, number] | undefined {
  if (f < 22 || f > 58) return undefined
  const x = through(f, FLIGHT.map(([k, bx]) => [k, bx] as const))
  const y = through(f, FLIGHT.map(([k, , by]) => [k, by] as const))
  return [Math.round(x), Math.round(y)]
}
const WINGS = [
  ['bb...bb', 'bbb.bbb', '.bbabb.', '..b.b..'],
  ['.......', '.bb.bb.', '.bbabb.', '..b.b..'],
  ['.......', '...b...', '..bb...', '...a...'],
  ['.......', '.bb.bb.', '.bbabb.', '..b.b..'],
] as const

const STROKE = [0, 0, 1, 2, 2, 3]
const beatOf = (f: number) => f % STROKE.length

const DAISY = { x: 41, y: 16 }
const nod = (f: number) => (f === 20 || f === 21 || f === 24 || f === 25 ? 1 : 0)

const TRAIL: readonly (readonly [number, number])[] = (() => {
  const points = [[-1, 29], [4, 29], [8, 28], [11, 28], [13, 29], [12, 30], [10, 29], [12, 27], [17, 26]] as const
  const out: [number, number][] = []
  const seen = new Set<number>()
  for (let k = 0; k + 1 < points.length; k++) {
    const [ax, ay] = points[k] ?? [0, 0]
    const [bx, by] = points[k + 1] ?? [0, 0]
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 2
    for (let i = 0; i < n; i++) {
      const x = Math.round(ax + ((bx - ax) * i) / n)
      const y = Math.round(ay + ((by - ay) * i) / n)
      if (!seen.has(y * W + x)) out.push([x, y])
      seen.add(y * W + x)
    }
  }
  return out
})()
const TRAIL_AT = new Map(TRAIL.map(([x, y], i) => [y * W + x, i]))

const hedgeTop = (x: number) => Math.round(8 + noise(x / 5, 0.5, 0, 3) * 4)
const bedTop = (x: number) => Math.round(14 + noise(x / 3.5, 2.5, 0, 9) * 3)
const ROWS = [[21, 23, 8], [25, 28, 11], [30, 31, 14]] as const
function stoneAt(x: number, y: number): [number, number] {
  for (const [r, [y0, y1, width]] of ROWS.entries()) {
    if (y < y0 || y > y1) continue
    let edge = -Math.round(hash(r, 99) * width)
    for (let s = 0; s < 12; s++) {
      const next = edge + width - 2 + Math.round(hash(r, s) * 4)
      if (x === next) return [-1, x]
      if (x < next) {
        const corner = (x === edge + 1 || x === next - 1) && (y === y0 || y === y1)
        return [corner ? -1 : r * 16 + s, (edge + next) / 2]
      }
      edge = next
    }
  }
  return [-1, x]
}
const FLOWERS = [[6, 16, 0xd77a9c], [17, 15, 0xb48fd0], [35, 15, 0xe4c060], [50, 17, 0xd77a9c]] as const

function scenery(): Int32Array {
  const c = new Canvas()
  c.fill((x, y) => {
    const sun = Math.max(0, 1 - Math.hypot(x - SUN.x, (y - SUN.y) * 1.3) / 26)
    if (y < hedgeTop(x)) {
      const d = Math.hypot(x - SUN.x, y - SUN.y)
      if (d < 3.6) return d < 2.4 ? 0xfffbea : 0xfdeec0
      return shade(SKY, (y / 13) * 6.4 + sun * 3, x, y)
    }
    if (y < bedTop(x)) {
      const rim = y === hedgeTop(x) ? 1.6 + sun * 2.4 : 0
      return shade(HEDGE, 1.6 + (y - 8) * -0.15 + sun * 1.5 + rim, x, y)
    }
    if (y <= 20) {
      const clump = Math.round(noise(x / 6, y / 3.5, 0, 5) * 1.6)
      const rim = y === bedTop(x) ? 2.6 + sun * 2 : 0
      return shade(LEAVES, 1.4 + clump + rim + (y >= 19 ? -1 : 0), x, y)
    }
    const [s, mid] = stoneAt(x, y)
    if (s < 0) return shade(MOSS, 0.6 + x / 64, x, y)
    const isTop = stoneAt(x, y - 1)[0] < 0
    const isBottom = stoneAt(x, y + 1)[0] < 0 || y === H - 1
    const level = Math.round(2.5 + (mid / 64) * 1.8 + (hash(s, 7) - 0.5) * 0.8)
    return shade(STONE, level + (isTop ? 1.3 : 0) - (isBottom ? 0.8 : 0), x, y)
  })
  for (const [fx, fy, col] of FLOWERS) {
    c.rect(fx, fy, 2, 2, col)
    c.set(fx + 1, fy, mix(col, 0xfff4dc, 0.5))
    c.set(fx, fy + 2, LEAVES[1] ?? 0)
  }
  return c.px
}

type Layer = Map<number, number>

function snail(f: number, look: [number, number] | undefined): Layer {
  const layer: Layer = new Map()
  const put = (x: number, y: number, col: number) => {
    const ix = Math.round(x)
    const iy = Math.round(y)
    if (ix >= 0 && ix < W && iy >= 0 && iy < H) layer.set(iy * W + ix, col)
  }
  const dir = dirAt(f)
  const sx = Math.round(key(f, X_KEYS)) - (dir < 0 ? 3 : 0)
  const nose = 6 + Math.round(key(f, STRETCH_KEYS))
  const height = (u: number) => {
    if (u < -9 || u > nose + 1) return 0
    if (u < -5) return 1 + Math.floor((u + 9) / 2)
    if (u < 2) return 3
    if (u >= nose) return u === nose ? 4 : 3
    return Math.round(3 + (2 * (u - 2)) / Math.max(1, nose - 3))
  }
  for (let u = -9; u <= nose + 1; u++) {
    const h = height(u)
    for (let v = 0; v < h; v++) {
      const x = sx + u * dir
      const y = GROUND - v
      const level = v === h - 1 ? 6.2 : v === 0 ? 2.6 : 4 + (u > nose - 3 ? 0.6 : 0)
      put(x, y, shade(BODY, level, x, y))
    }
  }
  put(sx + (nose + 2) * dir, GROUND - 1, BODY[4] ?? 0)
  const R = 5.6
  const scx = sx - 1.5 * dir
  const scy = GROUND - 7.2
  for (let y = Math.floor(scy - R); y <= Math.ceil(scy + R); y++) {
    for (let x = Math.floor(scx - R); x <= Math.ceil(scx + R); x++) {
      const dx = x - scx
      const dy = y - scy
      const r = Math.hypot(dx, dy)
      if (r > R) continue
      const a = Math.atan2(-dy, dx * dir)
      const coil = (r / R) * 2 + a / TAU + 0.15
      const isGroove = ((coil % 1) + 1) % 1 < 0.32 && r > 0.9 && r < R - 0.6
      const lit = r > 0 ? (dx * TO_SUN[0] + dy * TO_SUN[1]) / r : 0
      const rim = r > R - 1.1 && lit > 0.15 ? 2.6 : 0
      const glint = lit > 0.7 && r > R - 2.4 && r <= R - 1.1 ? 1.6 : 0
      const foot = dy > 3.5 ? -1 : 0
      put(x, y, shade(SHELL, 3.2 + lit * 1.4 * (r / R) + rim + glint + foot - (isGroove ? 2 : 0), x, y))
    }
  }
  const length = key(f, STALK_KEYS)
  const baseX = sx + (nose - 1) * dir
  const baseY = GROUND - height(nose - 1) + 1
  let lean = key(f, LEAN_KEYS)
  const watch = key(f, WATCH_KEYS)
  if (look && watch > 0) {
    const toward = Math.atan2((look[0] - baseX) * dir, baseY - look[1])
    lean += (clamp(toward, -0.6, 1.5) - lean) * watch
  }
  for (const [offset, tilt, level] of [[-1, 0.3, 4.4], [0, 0, 6.3]] as const) {
    const bx = baseX + offset * dir
    const a = lean + tilt
    const tx = bx + Math.sin(a) * length * dir
    const ty = baseY - Math.cos(a) * length
    const n = Math.max(1, Math.round(length))
    for (let i = 0; i < n; i++) put(bx + ((tx - bx) * i) / n, baseY + ((ty - baseY) * i) / n, shade(BODY, level, 0, 0))
    put(tx, ty, EYE)
  }
  return layer
}

function render(): Int32Array[] {
  const still = scenery()
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    c.px.set(still)
    const fly = butterfly(f)
    const body = snail(f, fly)

    for (let y = 10; y <= 17; y++) {
      for (let x = 0; x < W; x++) {
        if (y < hedgeTop(x) || y >= bedTop(x)) continue
        const m = loopNoise(x / 9, y / 2.5, f / LOOP, 1, 4) - Math.abs(y - 13) * 0.05
        if (m > 0.52) c.set(x, y, HEDGE[m > 0.62 ? 4 : 3] ?? 0)
      }
    }
    for (const gx of [2, 13, 21, 30, 46, 55, 61]) {
      const sway = Math.round(wave(f, LOOP, 2, gx / 23) * 0.7)
      for (const [dx, tall] of [[0, 3], [1, 4], [2, 2]] as const) {
        for (let k = 0; k < tall; k++) c.set(gx + dx + (k === tall - 1 && tall > 2 ? sway : 0), 20 - k, shade(LEAVES, k === tall - 1 ? 6 : 2.6 + k * 0.7, 0, 0))
      }
    }

    const run = ((f / LOOP) * (TRAIL.length + 24)) - 12
    for (const [x, y] of TRAIL) {
      const i = TRAIL_AT.get(y * W + x) ?? 0
      const d = Math.abs(i - run)
      c.set(x, y, shade(SHEEN, 1.6 + x / 40 + (d < 1 ? 2.4 : d < 2.5 ? 1 : 0), x, y))
    }

    for (let y = GROUND + 1; y < H; y++) {
      const d = y - GROUND
      for (let x = 0; x < W; x++) {
        const isShade = body.has(Math.round(GROUND - d * 2.1) * W + Math.round(x + d * 1.6))
        if (isShade) c.set(x, y, mix2(c.get(x, y)))
      }
    }
    if (fly && fly[0] > 4 && fly[0] < 60) {
      const shx = fly[0] - 6
      for (const dx of [0, 1]) c.set(shx + dx, 30, mix2(c.get(shx + dx, 30)))
    }

    const dy = nod(f)
    for (let y = DAISY.y + 2 + dy; y <= 21; y++) {
      const x = DAISY.x + (y > 19 ? 1 : 0)
      c.set(x, y, shade(LEAVES, y === 21 ? 2 : 4.2, x, y))
    }
    c.set(DAISY.x + 2, 19, shade(LEAVES, 5.4, 0, 0))
    c.set(DAISY.x + 3, 18, shade(LEAVES, 6.2, 0, 0))
    const hx = DAISY.x
    const hy = DAISY.y + dy
    for (const [px, py] of [[-1, -1], [0, -2], [1, -1], [2, 0], [1, 1], [0, 2], [-1, 1], [-2, 0], [0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const lit = px * TO_SUN[0] + py * TO_SUN[1]
      c.set(hx + px, hy + py, shade(PETAL, 2.4 + lit * 0.9, 0, 0))
    }
    c.set(hx, hy, BLOOM[2] ?? 0)
    c.set(hx - 1, hy, BLOOM[1] ?? 0)
    c.set(hx, hy + 1, BLOOM[0] ?? 0)
    for (let k = 0; k < 3; k++) {
      const t = f - 24 - k * 2
      if (t >= 0 && t < 7) c.set(hx - 1 + k + Math.round(Math.sin(t * 0.9 + k) * 0.6), hy - 3 - Math.round(t * 0.7), BLOOM[t < 4 ? 2 : 1] ?? 0)
    }

    for (const [k, col] of body) c.px[k] = col

    if (fly) {
      const b = beatOf(f)
      const art = WINGS[STROKE[b] ?? 0] ?? WINGS[0]
      const flip = fly[0] < 34
      c.sprite(fly[0] - 3, fly[1] - 2, art, { b: shade(WING, STROKE[b] === 2 ? 2 : 3, 0, 0), a: WING[0] ?? 0 }, flip)
      if (b < 2) c.set(fly[0] + (flip ? -3 : 3), fly[1] - 2, WING[4] ?? 0)
    }

    for (const [dx, dy0, at] of [[8, 18, 6], [47, 17, 30], [58, 19, 50], [3, 19, 64]] as const) {
      const t = f - at
      if (t >= 0 && t < 3) {
        c.set(dx, dy0, 0xffffff)
        if (t === 1) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.set(dx + ox, dy0 + oy, SKY[9] ?? 0)
      }
    }

    out.push(c.px)
  }
  return out
}

function mix2(col: number): number {
  for (const r of [STONE, MOSS, SHEEN]) {
    const i = r.indexOf(col)
    if (i >= 0) return r[Math.max(0, i - 2)] ?? col
  }
  return col
}

const FLUTTER = 'A wingbeat: the butterfly\'s wings flick open in a frame as it flies.'

export const scene: Scene = {
  verb: 'Dilly-dallying',
  render,
  hero: 40,
  snaps: [
    { frames: 24, box: [60, 4, 63, 8], colors: WING, why: FLUTTER },
    { frames: 36, box: [35, 6, 40, 10], colors: WING, why: FLUTTER },
  ],
}
