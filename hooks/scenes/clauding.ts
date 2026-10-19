import { Canvas, beat, clamp, frames, hash, hex, lerp, shade, threshold, type Ramp, type Scene } from '../engine'

const LOOP = 96
const HORIZON = 18
const SUN_X = 54
const NIGHT = 88

const SKY = hex('16142e 25234a 38375f 524f78 726a8e 9a85a0 c09ca2 e0b49c f2c88e f8da92 fcebb4 fff8e2')
const SEA = hex('0e1426 1a2440 2c3852 465068 686a7a 92857e c0a284 e6c28c f8e0a8')
const HILL = hex('0a0a12 14141a 211f22 322c26 4a3e2a 6a5630 94783a c4a24c')
const WOOD = hex('140c0c 26181a 3c2822 5a3c2c 7e5636 a87642')
const PRIMER = hex('8a7a68 b4a48a d6c8a8 eee2c4 fbf3de')
const RED = hex('3a1410 b83c2a')
const BLUE = hex('141e3c 30509c')
const SUN = hex('c2502e f07a3a f8a248 fcca6a fee8a0 fffbe8')

const sunY = (v: number) => (v <= 68 ? lerp(5, 18.6, (v / 68) ** 1.15) : lerp(18.6, 25, beat(v, 68, 80)))
const warmth = (v: number) => clamp(v / 68)
const dusk = (v: number) => beat(v, 68, 84)

const hillY = (x: number) => Math.round(19.6 + x * 0.105 + Math.sin(x * 0.14 + 1) * 1.3)

const PX = 27
const PY = 4
type Stroke = { t: number; ramp: Ramp; level: number }

const PAINTING: Stroke[][] = (() => {
  const cells: Stroke[][] = Array.from({ length: 18 * 12 }, () => [])
  const add = (px: number, py: number, t: number, ramp: Ramp, level: number) => cells[py * 18 + px]?.push({ t, ramp, level })
  for (let py = 0; py < 12; py++) {
    for (let px = 0; px < 18; px++) {
      const j = hash(px, py, 1) * 1.4
      const near = Math.max(0, 1 - Math.hypot(px - 9.5, (py - 6.5) * 1.4) / 7)
      if (py <= 6) add(px, py, 8 + py * 1.5 + px * 0.2 + j, SKY, 6.6 + py * 0.5 + near * 1.6)
      else if (py <= 9) add(px, py, 19 + (py - 7) * 1.6 + px * 0.2 + j, SEA, 6.4 - (py - 7) * 0.7 + near * 1.2)
      else add(px, py, 24 + (py - 10) * 1.5 + px * 0.2 + j, HILL, 3.6 - (py - 10) * 1 + (px > 8 && px < 12 ? 0.8 : 0))
    }
  }
  for (let px = 0; px <= 7; px++) add(px, 10, 28 + px * 0.3, PRIMER, px === 7 ? 1 : 2)
  for (const px of [0, 2, 4, 6]) for (let py = 4; py <= 9; py++) add(px, py, 28.6 + px * 0.5 + py * 0.1, WOOD, px === 6 ? 3 : 2)
  ;[1, 3, 5].forEach((px, k) => {
    for (let py = 9; py >= 4; py--) add(px, py, 30 + k * 3 + (9 - py) * 0.4, PRIMER, py === 4 ? 3 : 2)
  })
  for (let px = 0; px <= 6; px++) add(px, 3, 40 + px * 0.3, PRIMER, px === 6 ? 3 : 2)
  for (let px = 1; px <= 5; px++) add(px, 2, 42 + px * 0.2, PRIMER, px >= 4 ? 2 : 1)
  for (let px = 2; px <= 4; px++) add(px, 1, 43, PRIMER, px === 4 ? 2 : 1)
  for (const py of [8, 9]) add(8, py, 44 + (9 - py) * 0.5, PRIMER, 2)
  add(9, 10, 44.5, PRIMER, 1)
  const clumps = [[15.5, 1.5, 2.6], [13.2, 3.2, 2.2], [16.6, 4.4, 2.4], [12.4, 5.8, 1.8], [15.2, 6.4, 2]] as const
  for (let py = 6; py <= 10; py++) add(14, py, 47, HILL, 1)
  add(13, 7, 47.5, HILL, 1)
  const isLeaf = (px: number, py: number) => clumps.some(([cx, cy, r]) => Math.hypot(px - cx, (py - cy) * 1.25) < r + (hash(px, py, 4) - 0.5) * 1.1)
  clumps.forEach(([cx, cy, r], k) => {
    for (let py = 0; py <= 9; py++) {
      for (let px = 10; px < 18; px++) {
        if (Math.hypot(px - cx, (py - cy) * 1.25) >= r + (hash(px, py, 4) - 0.5) * 1.1) continue
        const rim = !isLeaf(px - 1, py) ? 2.4 : !isLeaf(px, py - 1) ? 1.2 : 0
        add(px, py, 48 + k * 2.6 + clamp((py - Math.max(0, cy - r)) / (cy + r - Math.max(0, cy - r))) * 3 + hash(px, py, 5) * 0.6, HILL, 2.4 + rim + (py > cy ? -0.6 : 0))
      }
    }
  })
  add(10, 9, 60, RED, 1)
  add(10, 10, 60.5, HILL, 1)
  add(12, 9, 61.5, BLUE, 1)
  add(12, 10, 62, HILL, 1)
  for (const [px, py, l] of [[9, 7, 8], [10, 7, 7.4], [9, 8, 7.4], [10, 9, 7]] as const) add(px, py, 64 + py * 0.6, SEA, l)
  for (const [px, py] of [[8, 6], [11, 6], [9, 5], [10, 5]] as const) add(px, py, 67, SKY, 11)
  add(9, 6, 68, SUN, 5)
  add(10, 6, 68, SUN, 4)

  return cells
})()

function paint(c: Canvas, v: number, fade: number, held: number): void {
  const sy = sunY(v)
  const warm = warmth(v)
  const night = dusk(v)
  const sunlight = (1 - night) * (1 - warm * 0.3)
  const glow = (x: number, y: number) => Math.max(0, 1 - Math.hypot(x - SUN_X, (y - sy) * 1.4) / 24) ** 1.4

  for (let y = 0; y < HORIZON; y++) {
    for (let x = 0; x < 64; x++) {
      const level = 5 + (y / HORIZON) * 3.8 - warm * 2.6 - night * 4.2 + glow(x, y) * 1.3 * (1 - night * 0.4)
      c.set(x, y, shade(SKY, level - fade, x, y))
    }
  }
  for (const [cx0, cy, len, speed] of [[6, 4, 16, 0.07], [38, 10, 13, 0.05], [20, 12, 9, 0.06]] as const) {
    const cx = cx0 - v * speed
    for (let k = 0; k < len; k++) {
      const x = Math.round(cx + k)
      const thick = k > 2 && k < len - 3
      const level = 6.4 + (cy / HORIZON) * 3 - warm * 0.8 - night * 5.4 + glow(x, cy) * 2
      c.set(x, cy, shade(SKY, level + 1.2 - fade, x, cy))
      if (thick) c.set(x, cy - 1, shade(SKY, level - 0.4 - fade, x, cy))
    }
  }
  if (night > 0.35) {
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(hash(i, 1) * 64)
      const y = Math.floor(hash(i, 2) * 11)
      if (hash(i, 3) < night - 0.35 && Math.sin(v * 0.7 + i * 2.1) > -0.5) c.set(x, y, shade(SKY, 10 - fade, 0, 0))
    }
  }
  if (sy < HORIZON + 4) {
    const r = 3 + warm * 0.4
    for (let y = Math.floor(sy - r); y < HORIZON; y++) {
      for (let x = Math.floor(SUN_X - r - 1); x <= Math.ceil(SUN_X + r + 1); x++) {
        const d = Math.hypot(x - SUN_X, (y - sy) * (1 + warm * 0.15))
        if (d > r) continue
        c.set(x, y, shade(SUN, 5.4 - warm * 1.4 - night * 2 - fade, x, y))
      }
    }
  }

  for (let y = HORIZON; y < 32; y++) {
    for (let x = 0; x < 64; x++) {
      const depth = y - HORIZON
      let level = 4.6 - warm * 0.9 - night * 3 - depth * 0.28 + glow(x, HORIZON) * 2.4 * (1 - night)
      const spread = 1.2 + depth * 0.9
      const glitter = clamp((HORIZON + 3 - sy) / 2)
      if (Math.abs(x - SUN_X) < spread && glitter > 0) {
        const dash = hash(Math.floor((x + depth * 3) / 2), y, Math.floor(v / 3))
        if (dash > 0.45 + (1 - glitter) * 0.4) level += (2.6 * (1 - Math.abs(x - SUN_X) / spread) + 1) * glitter
      }
      if (y === HORIZON) level += 0.8
      c.set(x, y, shade(SEA, level - fade, x, y))
    }
  }
  for (let x = 0; x < 30; x++) {
    const top = Math.round(HORIZON - 2.2 + Math.abs(x - 12) * 0.16 + Math.sin(x * 0.5) * 0.4)
    for (let y = top; y < HORIZON; y++) c.set(x, y, shade(SKY, 5.6 - warm * 1.6 - night * 4 + (y === top ? 0.5 : 0) - fade, x, y))
  }

  for (let x = 0; x < 64; x++) {
    const top = hillY(x)
    for (let y = top; y < 32; y++) {
      const crest = y === top ? 2.6 * sunlight : y === top + 1 ? 1 * sunlight : 0
      c.set(x, y, shade(HILL, 2.6 - (y - top) * 0.14 + crest - night * 1.2 - fade, x, y))
    }
    if (hash(x, 9) > 0.6) c.set(x, top - 1, shade(HILL, 3 + 2.6 * sunlight - night - fade, x, top - 1))
  }
  for (const [x, col] of [[18, 0xe6a0a0], [22, 0xf2d27a], [52, 0xe6a0a0], [58, 0xf2d27a]] as const) {
    if (night < 0.5 && fade < 1) c.set(x, hillY(x) + 2, col)
  }

  for (let y = 7; y < hillY(5) + 1; y++) {
    const x = Math.round(5 + (y - 7) * -0.12)
    c.set(x, y, shade(HILL, 1.2 - fade, x, y))
    c.set(x + 1, y, shade(HILL, 1.6 + sunlight * 2 - fade, x + 1, y))
  }
  for (let y = 0; y <= 9; y++) {
    for (let x = 0; x <= 18; x++) {
      const d = Math.hypot((x - 6) / 10.5, (y - 4.4) / 3.3) + (hash(x, y, 11) - 0.5) * 0.18
      if (d > 1 || (y > 6 && Math.abs(x - 6) > 6)) continue
      const isEdge = Math.hypot((x + 1 - 6) / 10.5, (y - 4.4) / 3.3) > 0.92 || Math.hypot((x - 6) / 10.5, (y - 1 - 4.4) / 3.3) > 0.94
      c.set(x, y, shade(HILL, 1.3 + (isEdge ? 2.6 * sunlight : 0) + (y > 6 ? -0.6 : 0) - night * 0.6 - fade, x, y))
    }
  }

  const legs = [[31, 26, 27.2], [36, 36, 25.2], [40, 44, 29.6]] as const
  for (const [x0, x1, y1] of legs) {
    const isBack = x0 === 36
    for (let y = 16; y <= Math.round(y1); y++) {
      const x = Math.round(lerp(x0, x1, (y - 16) / (y1 - 16)))
      c.set(x, y, shade(WOOD, (isBack ? 1 : 2) - fade, x, y))
      if (!isBack) c.set(x + 1, y, shade(WOOD, 2.4 + sunlight * 2.6 - night - fade, x + 1, y))
    }
  }
  for (let y = 0; y < 4; y++) {
    c.set(35, y, shade(WOOD, 2 - fade, 35, y))
    c.set(36, y, shade(WOOD, 2.6 + sunlight * 2.4 - night - fade, 36, y))
  }
  for (let x = 25; x <= 46; x++) {
    c.set(x, 17, shade(WOOD, 3 + (x > 40 ? sunlight * 2 : 0) - night - fade, x, 17))
    c.set(x, 18, shade(WOOD, 1.2 - fade, x, 18))
  }

  for (let y = 3; y <= 16; y++) {
    for (let x = 26; x <= 45; x++) {
      const isEdge = x === 26 || x === 45 || y === 3 || y === 16
      if (isEdge) {
        c.set(x, y, shade(PRIMER, (x === 45 ? 3 + sunlight * 1.5 : y === 3 ? 3 : 1.4) - night - held, x, y))
        continue
      }
      const px = x - PX
      const py = y - PY
      let color = shade(PRIMER, (py < 1 ? 3.6 : 3) - night * 1.2 - held, x, y)
      for (const s of PAINTING[py * 18 + px] ?? []) if (v >= s.t) color = shade(s.ramp, s.level - held, x, y)
      c.set(x, y, color)
    }
  }
  if (v >= 68 && v < 76) {
    const k = 1 - beat(v, 68, 76)
    for (const [dx, dy] of [[-1, 0], [2, 0], [0, -1], [1, -1], [0, 1], [1, 1]] as const) {
      const x = PX + 9 + dx
      const y = PY + 6 + dy
      if (k > threshold(x, y) * 0.9) c.set(x, y, SUN[4] ?? 0)
    }
  }

  for (const [start, height, phase] of [[14, 7, 0], [20, 10, 2]] as const) {
    const x = Math.round(68 - (v - start) * 1.1)
    const y = Math.round(height + Math.sin(v * 0.18 + phase) * 1.2)
    if (x < -3 || x > 67 || v < start) continue
    const isUp = Math.floor(v / 3 + phase) % 2 === 0
    const ink = shade(HILL, 1.4 - night - fade, 0, 0)
    const tip = isUp ? -1 : 1
    c.set(x, y, ink)
    c.set(x - 1, y - (isUp ? 1 : 0), ink)
    c.set(x + 1, y - (isUp ? 1 : 0), ink)
    c.set(x - 2, y + tip, ink)
    c.set(x + 2, y + tip, ink)
  }
}

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    if (f < NIGHT) paint(c, f, 5 * beat(f, 80, NIGHT), 5 * beat(f, 83, NIGHT))
    else {
      const k = 5 * (1 - beat(f, NIGHT, LOOP - 2))
      paint(c, 0, k, k)
    }
  })
}

export const scene: Scene = {
  verb: 'Clauding',
  render,
  hero: 70,
  snaps: [
    { frames: NIGHT, box: [0, 0, 63, 25], why: 'the deliberate cut from night to the next afternoon: a fresh canvas, still dark before it fades up' },
    { frames: LOOP - 2, why: 'the last step of the fade-up from the dark, which brightens the whole picture' },
  ],
}
