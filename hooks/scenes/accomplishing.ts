import { Canvas, beat, clamp, ease, hash, hex, lerp, noise, shade, smoothstep, type Ramp, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const SKY = hex('0a0b20 12142f 1b1c40 27244f 37295c 4c2f66 64366d 7e3f70 9a4a6f b65a6c d06f68 e48c66 f0ad6c f8cc80 fde6a6 fff6d4')
const SNOW = hex('1a1e3e 262c58 363f74 4c5690 6a72aa 8c8ec0 b0aad2')
const GOLD = hex('7a5a8c a86a8a d4847e ecaa7c f8cc86 fde6aa fff8de')
const ROCK = hex('0c0a1a 15122a 201b3a 2e2648 3e3054 523a5c 6c4a60 8c5e5c b07a58')
const CLOUD = hex('241f46 34305e 4a4276 66558a 865f94 a86e96 c88296 e29c94 f2bc98 fadcae')
const JACKET = hex('2a160c 5a3210 925814 c88420 eeb43a fbd870')
const CLOTH = hex('22081a 4a0e22 7a1626 aa2430 d43c38 ee6a44 f9a066')
const DARK = hex('0a0814 141024 201a34 2e2644 46385a')
const SKIN = hex('6a3a34 a0604c d08c6c')

const SUN_X = 53.5
const HORIZON = 21

const AXE = 8
const PLANT = 30
const SUNRISE = 32
const CHEER = 41
const GUST0 = 56
const GUST1 = 70

const dawn = (t: number) => ease.out(beat(t, SUNRISE - 1, SUNRISE + 8))
const preglow = (t: number) => 0.3 + 0.7 * ease.inOut(beat(t, 12, SUNRISE))
const sunY = (t: number) => Math.round(23.2 - 7 * beat(t, SUNRISE - 1, GUST1) ** 0.8)
const sunLine = (t: number) => (t < SUNRISE ? -9 : 9 + 24 * smoothstep(SUNRISE, GUST0, t))

const RIDGE: readonly (readonly [number, number])[] = [
  [-1, 26], [1, 24], [3, 22], [4, 21], [6, 18], [7, 18], [9, 20], [10, 19], [12, 16], [13, 16], [15, 19],
  [16, 19], [19, 15], [21, 14], [22, 13], [23, 12], [28, 12], [29, 13], [30, 15], [31, 15], [33, 17],
  [34, 18], [36, 16], [37, 15], [38, 16], [40, 19], [42, 20], [44, 22], [47, 24], [50, 27], [53, 30],
  [55, 32], [70, 40],
]
const TOP: readonly number[] = Array.from({ length: W }, (_, x) => {
  for (let i = 0; i + 1 < RIDGE.length; i++) {
    const [ax, ay] = RIDGE[i] ?? [0, 0]
    const [bx, by] = RIDGE[i + 1] ?? [0, 0]
    if (x >= ax && x <= bx) return Math.round(ay + ((by - ay) * (x - ax)) / (bx - ax))
  }
  return H
})
const topAt = (x: number) => TOP[x] ?? H

type Arete = { px: number; py: number; bx: number; h: number }
const ARETES: readonly Arete[] = [
  { px: 6.5, py: 18, bx: 4, h: 3 },
  { px: 12.5, py: 16, bx: 10, h: 5 },
  { px: 25.5, py: 12, bx: 20, h: 10 },
  { px: 30.5, py: 15, bx: 30, h: 6.5 },
  { px: 37, py: 15, bx: 35, h: 5.5 },
]

function faceAt(x: number, y: number): { lit: boolean; edge: boolean } {
  let best = -Infinity
  let spine = 0
  for (const a of ARETES) {
    const sx = Math.round(a.px + ((a.bx - a.px) * (y - a.py)) / (31 - a.py))
    const z = a.h - Math.abs(x - sx) * 0.7
    if (z > best) {
      best = z
      spine = sx
    }
  }
  return { lit: x >= spine, edge: x === spine }
}

const SNOWY: Uint8Array = (() => {
  const raw = new Uint8Array(W * H)
  for (let x = 0; x < W; x++) {
    for (let y = topAt(x); y < H; y++) {
      const depth = y - topAt(x)
      const n = noise(x * 0.28, y * 0.11, 0, 11)
      raw[y * W + x] = depth < 3 || n > 0.3 + depth * 0.03 + (y - 14) * 0.016 + (faceAt(x, y).lit ? -0.1 : 0.04) ? 1 : 0
    }
  }
  const clean = raw.slice()
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x
      const same = [i - 1, i + 1, i - W, i + W].filter(j => raw[j] === raw[i]).length
      if (same <= 1) clean[i] = raw[i] ? 0 : 1
    }
  }
  return clean
})()
const isSnow = (x: number, y: number) => SNOWY[y * W + x] === 1

const seaTop = (x: number, t: number) => {
  const u = x - t * 0.07
  return Math.round(HORIZON - 0.4 - 1.5 * Math.abs(Math.sin(u * 0.31)) - 0.9 * Math.abs(Math.sin(u * 0.13 + 1.1)))
}
const nearTop = (x: number, t: number) => {
  const u = x - t * 0.22
  return Math.round(29 - 2.4 * Math.abs(Math.sin(u * 0.19 + 0.4)) - 1.4 * Math.abs(Math.sin(u * 0.08 + 2)))
}

const POSES: Record<string, readonly string[]> = {
  climb: ['.o...', '.hh..', '.hf..', 'bjj..', 'bjj..', 'bjj..', '.pp..', '.pp..', '.kk..'],
  crouch: ['.....', '.....', '.o...', '.hh..', '.hfg.', 'bjjj.', 'bjpp.', '.p.p.', '.k.k.'],
  rise: ['.....', '.o...', '.hh..', '.hf..', 'bjjg.', 'bjj..', '.pp..', '.p.p.', '.k.k.'],
  stand: ['.o...', '.hh..', '.hf..', 'bjj..', 'bjjg.', 'bjj..', '.pp..', '.pp..', '.kk..'],
  lift: ['.o..g', '.hhj.', '.hfj.', 'bjj..', 'bjj..', 'bjj..', '.pp..', '.pp..', '.kk..'],
  plant: ['.....', '.o...', '.hh..', '.hf..', 'bjjjg', 'bjj..', '.ppp.', '.p.p.', '.k.k.'],
  hold: ['.o...', '.hh..', '.hf..', 'bjjjg', 'bjj..', 'bjj..', '.pp..', '.pp..', '.kk..'],
  cheer: ['.o.g.', '.hhj.', '.hfj.', 'bjj..', 'bjj..', 'bjj..', '.pp..', '.p.p.', '.k.k.'],
}
const PARTS: Record<string, readonly [Ramp, number]> = {
  o: [SNOW, 6.6], h: [SNOW, 5.6], f: [SKIN, 1.6], j: [JACKET, 3.2], b: [DARK, 2.6], p: [DARK, 2.2], k: [DARK, 0.8], g: [DARK, 1.2],
}

const BODY_X = 24
const POLE_X = 27
const STAND_Y = 11

function climberAt(t: number): { pose: string; fy: number } | undefined {
  if (t < 12) return undefined
  if (t < 16) return { pose: 'climb', fy: STAND_Y + Math.round(lerp(10, 5, ease.out(beat(t, 12, 16)))) }
  if (t < 18) return { pose: 'climb', fy: STAND_Y + (t < 17 ? 5 : 6) }
  if (t < 21) return { pose: 'climb', fy: STAND_Y + Math.round(lerp(6, 1, ease.inOut(beat(t, 18, 21)))) }
  if (t < 23) return { pose: 'crouch', fy: STAND_Y }
  if (t < 24) return { pose: 'rise', fy: STAND_Y }
  if (t < 27) return { pose: 'stand', fy: STAND_Y }
  if (t < PLANT) return { pose: 'lift', fy: STAND_Y }
  if (t < PLANT + 2) return { pose: 'plant', fy: STAND_Y }
  if (t < CHEER - 1) return { pose: 'hold', fy: STAND_Y }
  if (t < CHEER) return { pose: 'plant', fy: STAND_Y }
  return { pose: 'cheer', fy: STAND_Y }
}

function poleFoot(t: number): number | undefined {
  if (t < 27) return undefined
  if (t < PLANT) return STAND_Y - Math.round(1 + 3 * ease.out(beat(t, 27, PLANT - 1)))
  return STAND_Y
}

function drawScene(c: Canvas, t: number): void {
  const d = dawn(t)
  const g = preglow(t)
  const sy = sunY(t)
  const line = sunLine(t)
  const gust = beat(t, GUST0 - 6, GUST0)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = Math.min(1, y / HORIZON)
      const glow = Math.max(0, 1 - Math.hypot((x - SUN_X) * 0.55, (y - HORIZON) * 1.25) / 24) ** 2
      c.set(x, y, shade(SKY, Math.min(12.4, 0.4 + v * 6 + d * (1 + 5 * v * v) + glow * (g * 3 + d * 4.5)), x, y))
    }
  }
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < W; x++) {
      if (hash(x, y, 3) > 0.022 || hash(x, y, 5) < d * 1.2) continue
      const twinkle = (t + Math.floor(hash(x, y, 4) * 50)) % 19 < 2
      c.set(x, y, twinkle || y > 9 ? 0x5a5c94 : 0xb8bce8)
    }
  }
  if (d < 0.75) {
    const star = d < 0.4 ? 0xfff2e0 : 0xc8b8d8
    c.set(15, 7, star)
    if (d < 0.4) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.set(15 + dx, 7 + dy, 0x6c6aa8)
  }

  c.disc(SUN_X, sy, 3.3, (x, y) => shade(SKY, 15.4 - Math.max(0, y - sy) * 0.7, x, y))

  for (const [px, py, half] of [[58, 17, 6], [63, 15, 5]] as const) {
    for (let y = py; y < HORIZON + 2; y++) {
      const w = (y - py) * (half / 6)
      for (let x = Math.ceil(px - w); x <= Math.floor(px + w); x++) {
        const lit = x >= px
        c.set(x, y, shade(CLOUD, (lit ? 2.4 + d * 3 + g * 0.6 : 1.4 + d * 0.8) + (y === py ? 0.6 : 0), x, y))
      }
    }
  }

  for (let x = 0; x < W; x++) {
    const top = seaTop(x, t)
    const rising = seaTop(x - 1, t) > top ? 1 : seaTop(x + 1, t) > top ? -1 : 0
    const sun = Math.max(0, 1 - Math.abs(x - SUN_X) / 30)
    for (let y = top; y < H; y++) {
      const depth = y - top
      const rim = depth === 0 ? 1.6 : depth === 1 ? 0.7 : 0
      const lift = rim * (0.6 + d * 1.8 + sun * (g + d * 2) + rising * -0.5)
      c.set(x, y, shade(CLOUD, 2 + g * 0.6 + d * 1.6 + sun * d * 1.2 - depth * 0.18 + lift, x, y))
    }
  }

  if (t === SUNRISE || t === SUNRISE + 1) {
    const reach = t === SUNRISE ? 11 : 6
    for (let x = Math.round(SUN_X - reach); x <= Math.round(SUN_X + reach); x++) {
      const y = seaTop(x, t)
      c.set(x, y, shade(SKY, 15 - Math.abs(x - SUN_X) * 0.25, x, y))
      if (Math.abs(x - SUN_X) < reach / 2) c.set(x, y + 1, shade(SKY, 13, x, y))
    }
  }

  for (let x = 0; x < W; x++) {
    for (let y = topAt(x); y < H; y++) {
      const { lit, edge } = faceAt(x, y)
      const sunny = lit && y < line
      const dawning = lit && y >= line && y < line + 2
      const depth = y - topAt(x)
      const crest = depth === 0 ? 1 : 0
      const haze = Math.max(0, y - 22) * 0.12
      if (isSnow(x, y)) {
        if (sunny) c.set(x, y, shade(GOLD, 3 + crest * 1.8 + (edge ? 0.8 : 0) - depth * 0.06, x, y))
        else if (dawning) c.set(x, y, shade(GOLD, 1, x, y))
        else c.set(x, y, shade(SNOW, (lit ? 3.3 + g * 0.8 : 1.7 + g * 0.3) + d * 0.8 + crest * 1.2 + haze, x, y))
      } else {
        if (sunny) c.set(x, y, shade(ROCK, 5.6 + (edge ? 1 : 0), x, y))
        else c.set(x, y, shade(ROCK, (lit ? 2.6 + g * 0.5 : 1.2) + d * 0.6 + haze, x, y))
      }
    }
  }

  drawClimb(c, t, d, g)

  for (let k = 0; k < 26; k++) {
    const born = SUNRISE + 3 + k * 0.95
    const age = t - born
    const life = 8 + Math.floor(hash(k, 1) * 5)
    if (age < 0 || age >= life) continue
    const x0 = 21 + Math.floor(hash(k, 2) * 14)
    const x = x0 + age * (1.1 + gust * 0.8) + age * age * 0.04
    const y = topAt(Math.round(x0)) - 1 - age * 0.35 + age * age * 0.03 + Math.sin(age * 0.9 + k) * 0.6
    c.set(x, y, shade(GOLD, 5.5 - (age / life) * 3, 0, 0))
  }

  for (let x = 0; x < W; x++) {
    const top = nearTop(x, t)
    const rising = nearTop(x - 1, t) > top ? 1 : nearTop(x + 1, t) > top ? -1 : 0
    for (let y = top; y < H; y++) {
      const depth = y - top
      const rim = depth === 0 ? 1.4 : depth === 1 ? 0.5 : 0
      c.set(x, y, shade(CLOUD, 1.2 + g * 0.5 + d * 1.2 + rim * (1 + d * 2 + rising * -0.6) - depth * 0.25, x, y))
    }
  }
}

function drawClimb(c: Canvas, t: number, d: number, g: number): void {
  const behind = (x: number, y: number) => y < topAt(Math.round(x))
  const metal = shade(SNOW, 5 + d, 0, 0)
  const gust = beat(t, GUST0 - 6, GUST0)

  if (t >= AXE) {
    const k = Math.min(2, t - AXE)
    const [hx, hy] = ([[24, 8], [23, 10], [21, 12]] as const)[k] ?? [21, 12]
    for (let i = 1; i <= 6; i++) {
      const x = hx + 1 + Math.round(i * 0.4)
      const y = hy + i
      if (behind(x, y)) c.set(x, y, shade(DARK, 3, 0, 0))
    }
    c.set(hx - 1, hy, shade(DARK, 2, 0, 0))
    c.set(hx, hy, metal)
    c.set(hx + 1, hy, shade(DARK, 1, 0, 0))
    c.set(hx - 1, hy + 1, shade(DARK, 1, 0, 0))
    if (t >= AXE + 2 && t < AXE + 5) {
      const s = t - AXE - 2
      c.set(hx - 2 - s, hy - s, shade(SNOW, 6 - s * 1.5, 0, 0))
      c.set(hx + 2 + s, hy - 1 - s, shade(SNOW, 6 - s * 1.5, 0, 0))
    }
  }
  if (t >= 11 && t < 21) c.set(26, 11, shade(DARK, 0.6, 0, 0))

  const pose = climberAt(t)
  if (pose !== undefined) {
    const art = POSES[pose.pose] ?? []
    const x0 = BODY_X - 2
    const y0 = pose.fy - 8
    if (pose.pose === 'climb') {
      for (const [gx, gy] of [[22, 12], [26, 11]] as const) {
        const sx = BODY_X + (gx > 24 ? 1 : 0)
        const syy = pose.fy - 5
        for (let i = 0; i <= 8; i++) {
          const x = Math.round(lerp(sx, gx, i / 8))
          const y = Math.round(lerp(syy, gy + 1, i / 8))
          if (behind(x, y)) c.set(x, y, shade(JACKET, 1.6, 0, 0))
        }
        c.set(gx, gy, shade(DARK, 0.6, 0, 0))
      }
    }
    if (t < 27) {
      for (let i = 0; i < 8; i++) {
        const x = x0
        const y = pose.fy - 4 - i
        if (behind(x, y)) c.set(x, y, i > 4 && i < 7 ? shade(CLOTH, 2.4, 0, 0) : shade(SNOW, 3.6, 0, 0))
      }
    }
    art.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const part = PARTS[row[i] ?? '.']
        if (part === undefined) continue
        const x = x0 + i
        const y = y0 + j
        if (!behind(x, y)) continue
        const isRim = (PARTS[row[i + 1] ?? '.'] === undefined)
        const isBack = i === 0 || PARTS[row[i - 1] ?? '.'] === undefined
        const [r, base] = part
        c.set(x, y, shade(r, base - 0.4 + d * 0.4 + (isRim ? g * 1.1 + d * 1.6 : 0) + (isBack ? -0.5 : 0), x, y))
      }
    })
  }

  const foot = poleFoot(t)
  if (foot === undefined) return
  const top = foot - 9
  for (let y = top; y <= foot; y++) c.set(POLE_X, y, shade(SNOW, 4.6 + d * 1.4, 0, 0))
  c.set(POLE_X, top - 1, shade(GOLD, 3 + d * 3, 0, 0))
  if (t >= PLANT && t < PLANT + 4) {
    const s = t - PLANT
    for (const dir of [-1, 1]) c.set(POLE_X + dir * (1 + s), foot - (s === 0 ? 0 : 1), shade(SNOW, 6 - s * 1.2 + d, 0, 0))
    if (s < 2) c.set(POLE_X + 1, foot - 1 - s, shade(SNOW, 5, 0, 0))
  }

  const open = [0, 0.3, 0.55, 0.8, 1, 1.1][t - SUNRISE - 1] ?? (t > SUNRISE ? 1 : 0)
  const len = Math.max(1, Math.round(8 * open))
  for (let i = 0; i < len; i++) {
    const x = POLE_X + 1 + i
    const along = (i + 1) / 8
    const droop = Math.round((1 - clamp(open)) * along * 3)
    const phase = t * (0.95 + gust * 0.35) - i * 0.9
    const off = Math.round((0.55 + gust * 0.9) * along * Math.sin(phase)) + droop
    const slope = Math.cos(phase)
    const isTail = i === len - 1 && len >= 7
    for (let j = 0; j < 4; j++) {
      if (isTail && (j === 1 || j === 2)) continue
      if (len === 1 && j > 1) continue
      const y = top + j + off + (len === 1 ? 0 : 0)
      const level = 3 + slope * along * 1.2 + d * 1.2 + (j === 0 ? 0.5 : j === 3 ? -0.6 : 0) - (1 - d) * 0.6
      c.set(x, y, shade(CLOTH, level, x, y))
    }
  }
}

const PUFFS: readonly (readonly [number, number, number, number])[] = [
  [-12, 2, 10, 6], [-8, 12, 11, 7], [-11, 23, 10, 6], [-6, 31, 11, 6],
  [2, 6, 11, 7], [5, 17, 12, 7], [3, 27, 11, 6],
  [11, 0, 8, 5], [13, 11, 8, 6], [14, 21, 9, 6], [12, 31, 8, 5],
]
const WISPS: readonly (readonly [number, number, number])[] = [
  [4, -21, 9], [9, -27, 12], [15, -19, 7], [19, -30, 14], [26, -22, 10], [30, -26, 8],
]
const gustCentre = (f: number) => lerp(-27, 96, ease.inOut(beat(f, GUST0, GUST1)) * 0.3 + beat(f, GUST0, GUST1) * 0.7)

function drawGust(c: Canvas, cx: number): Uint8Array {
  const mask = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = Math.max(0, Math.ceil(cx - 11)); x <= Math.min(W - 1, Math.floor(cx + 11)); x++) {
      mask[y * W + x] = 1
      c.set(x, y, shade(CLOUD, 2.4 + ((x - cx) / 11) * 1.4, x, y))
    }
  }
  for (const [y, dx, len] of WISPS) {
    for (let x = Math.round(cx + dx); x < Math.round(cx + dx + len); x++) {
      if (x < 0 || x >= W) continue
      mask[y * W + x] = 1
      c.set(x, y, shade(CLOUD, x < cx + dx + 2 ? 2.4 : 3.2, x, y))
    }
  }
  for (const [dx, py, rx, ry] of PUFFS) {
    const px = Math.round(cx + dx)
    const warm = (dx + 12) / 26
    for (let y = Math.floor(py - ry); y <= Math.ceil(py + ry); y++) {
      for (let x = Math.floor(px - rx); x <= Math.ceil(px + rx); x++) {
        if (x < 0 || x >= W || y < 0 || y >= H) continue
        const nx = (x - px) / rx
        const ny = (y - py) / ry
        const dd = nx * nx + ny * ny
        if (dd > 1) continue
        mask[y * W + x] = 1
        const light = nx * 0.55 - ny * 0.85
        const rim = dd > 0.72 && light < -0.2 ? -1.2 : dd > 0.72 && light > 0.45 ? 1 : 0
        c.set(x, y, shade(CLOUD, 2.4 + warm * 3.8 + Math.round(light * 1.5) + rim, x, y))
      }
    }
  }
  for (let y = 0; y < H; y++) {
    let lo = W
    let hi = -1
    for (let x = 0; x < W; x++) {
      if (!mask[y * W + x] || Math.abs(x - cx) > 26) continue
      lo = Math.min(lo, x)
      hi = Math.max(hi, x)
    }
    for (let x = lo; x <= hi; x++) {
      if (mask[y * W + x]) continue
      mask[y * W + x] = 1
      c.set(x, y, shade(CLOUD, 3 + ((x - cx) / 11) * 1.4, x, y))
    }
  }
  return mask
}

function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    drawScene(c, f >= GUST1 ? f - LOOP : f)
    if (f > GUST0 && f < GUST1) {
      const next = new Canvas()
      drawScene(next, f - LOOP)
      const cx = gustCentre(f)
      const cloud = new Canvas()
      cloud.px.set(c.px)
      const mask = drawGust(cloud, cx)
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x
          if (mask[i]) c.px[i] = cloud.px[i] ?? 0
          else if (x < cx) c.px[i] = next.px[i] ?? 0
        }
      }
    }
    out.push(c.px)
  }
  return out
}

function gustSpan(f: number): readonly [number, number, number, number] {
  return [Math.max(0, Math.floor(gustCentre(f - 1) - 30)), 0, Math.min(W - 1, Math.ceil(gustCentre(f) + 23)), H - 1]
}

export const scene: Scene = {
  verb: 'Accomplishing',
  render,
  hero: 45,
  snaps: [
    { frames: SUNRISE, box: [43, 18, 63, 21], why: "the sun breaks the horizon: its first light flashes along the cloud tops, then shrinks back over two frames" },
    ...Array.from({ length: GUST1 - GUST0 }, (_, i) => ({
      frames: GUST0 + 1 + i,
      box: gustSpan(GUST0 + 1 + i),
      why: 'the gust: a bank of cloud blows across and wipes the scene back to before dawn',
    })),
  ],
}
