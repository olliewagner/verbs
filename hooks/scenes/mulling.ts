import { PALETTE, TAU, beat, ease, frames, hash, hex, lightAt, mix, mod, noise, particles, shade, smoothstep, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const WALL = hex('0a1310 0f1c17 15271f 1c3329 254133 30503c 425f40 5c7046 7c844c 9c9452')
const FRAME = hex('15161e 24252f 37363f 504c52 6e6764 958a7c bcae96')
const NIGHT = hex('060a1c 0a1129 0f1937 152346 1d2f58')
const SNOW = hex('1c2648 2e3c68 46578a 6a7eac 92a6cc bccce4')
const PINE = hex('070b18 0d1426 141d34')
const FROST = hex('5f74a0 93a8cc c8d6ec eaf1fa')
const FOG = hex('3c3c56 5c5a74 858199 aaa6b8')
const COPPER = PALETTE.copper
const WINE = hex('16040c 2a0814 420c1e 5c1228 781a30 942638 b03a42 d0604e f0a070')
const ORANGE = hex('5a1c0c 8a300e bd5212 e07a1c f6a238 fcc866 fee6a8')
const SPICE = hex('1e0e08 361a0e 522812 703a1a 8e5226 ae6e38')
const IRON = hex('060609 0d0d12 15151c 1f1e27 2a2833 393542 4c4656 655d6c')
const STEAM = hex('2a2836 46425a 6c6680 9c94ac ccc4d6 eee8f0')
const FIRE = PALETTE.fire
const BRASS = PALETTE.gold
const CAT = hex('07060b 100e16 1d1a26 2f2a38')
const MIST = hex('2e3e38 485a52 6a7a72 8e9a94 b4bcb8 5a6680 8490ac')
const PALETTE_ALL = [...new Set([WALL, FRAME, NIGHT, SNOW, PINE, FROST, FOG, COPPER, WINE, ORANGE, SPICE, IRON, STEAM, FIRE, BRASS, CAT, MIST].flat()), 0xf2f2e6, 0xc8d0e4, 0xe6ecf6, 0xf4c8c0, 0xfffbe0]

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

const LAMP = { x: 55, y: 7, power: 0.95, radius: 36 }
function lampAt(x: number, y: number): number {
  const l = lightAt([LAMP], x, y)
  if (y <= 6) return l * 0.4
  const spread = Math.abs(x - LAMP.x) / ((y - 6) * 1.15 + 2.5)
  return l * (0.7 + 0.3 * smoothstep(1.4, 0.5, spread))
}

const vignette = (x: number, y: number) => (((x - 34) / 36) ** 2 + ((y - 14) / 22) ** 2) * 1.5

const flicker = (f: number) => 0.8 + 0.12 * wave(f, LOOP, 6) + 0.08 * wave(f, LOOP, 11, 0.37)

const WIN = { x0: 3, x1: 27, y0: 1, y1: 17 }
const PANES = [[5, 14, 3, 7], [16, 25, 3, 7], [5, 14, 9, 15], [16, 25, 9, 15]] as const
const paneOf = (x: number, y: number) => PANES.find(([x0, x1, y0, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)

const CX = 41
const RIM_Y = 14
const BASE_Y = 24
const inside = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
const halfWidth = (y: number) => (y <= 22 ? 14 : y === 23 ? 13.5 : 12.5)
const WINE_Y = 15
const WINE_RX = 12.6
const WINE_RY = 3

const POP = 54
const PUFF_LIFE = 24
const fogAmount = (f: number) => ease.out(beat(f, 68, 78)) * (1 - ease.inOut(beat(f, 80, 95)))
const DRIP_X = 22

function outside(x: number, y: number, f: number): number {
  const ground = x < 15 ? 11.2 + Math.abs(x - 9) * 0.25 : 12.4 + Math.sin(x * 0.5) * 0.6
  let col = shade(NIGHT, 4.2 - y * 0.32, x, y)
  const moon = Math.hypot(x - 10, y - 5.5)
  if (moon < 1.6) col = x + y < 15 ? 0xf2f2e6 : 0xc8d0e4
  else if (moon < 3.2) col = shade(NIGHT, 4.6, x, y)
  for (const [tx, top] of [[19, 9.5], [23, 11], [5, 10]] as const) {
    if (y >= top && Math.abs(x - tx) <= (y - top) * 0.5 + (mod(y - top, 2) === 1 ? 0.3 : 0)) col = shade(PINE, x < tx ? 1 : 2, x, y)
  }
  if (y >= ground) col = shade(SNOW, y - ground < 1 ? 4 : 2.8, x, y)
  for (const p of particles(f, LOOP, 26, 40, 0x5a0f)) {
    const sx = 5 + p.r[1] * 21 + Math.sin(p.t * 0.2 + p.r[2] * TAU) * 1.2 - p.t * 0.06
    const sy = 2 + p.t * 0.36 * (0.8 + p.r[3] * 0.4)
    if (Math.round(sx) === x && Math.round(sy) === y && y < ground) col = p.r[3] > 0.5 ? SNOW[5] ?? 0 : SNOW[4] ?? 0
  }
  return col
}

function frost(x: number, y: number, pane: readonly [number, number, number, number]): number {
  const [x0, x1, y0, y1] = pane
  const corner = Math.min(x - x0, x1 - x) + Math.min(y - y0, y1 - y)
  return (2.6 - corner) / 1.6 + (y === y1 && hash(x, 3) > 0.4 ? 0.8 : 0)
}

type Floater = { kind: 'orange' | 'stick' | 'anise' | 'clove'; r: number; a: number }
const FLOATERS: Floater[] = [
  { kind: 'orange', r: 0.55, a: 1.3 },
  { kind: 'orange', r: 0.5, a: 3.5 },
  { kind: 'stick', r: 0.28, a: 2.1 },
  { kind: 'stick', r: 0.68, a: 5.2 },
  { kind: 'anise', r: 0.66, a: 2.5 },
  { kind: 'anise', r: 0.12, a: 4.8 },
  { kind: 'clove', r: 0.78, a: 0.2 },
  { kind: 'clove', r: 0.72, a: 4.3 },
]

const CAT_ART = [
  '......#.#.',
  '......###.',
  '......####',
  '.....####.',
  '...######.',
  '..#######.',
  '..#######.',
  '.########.',
]
const CAT_X = 4
const CAT_Y = 10

function render(): Int32Array[] {
  const cache = new Map<number, number>()
  return frames(LOOP, (c, f) => {
    const glow = flicker(f)

    for (let y = 0; y < 25; y++) {
      for (let x = 0; x < W; x++) {
        const lit = lampAt(x, y)
        const gx = mod(x + 2, 6)
        const groove = gx === 0 ? -1.1 : gx === 5 && lit > 0.25 ? 0.6 : 0
        c.set(x, y, shade(WALL, 2.3 + lit * 4.2 - vignette(x, y) + groove, x, y))
      }
    }

    const fog = fogAmount(f)
    const drip = beat(f, 80, 90)
    const dripY = 3 + ease.in(drip) * 5
    for (let y = WIN.y0; y <= WIN.y1; y++) {
      for (let x = WIN.x0; x <= WIN.x1; x++) {
        const pane = paneOf(x, y)
        if (!pane) {
          const bevel = paneOf(x + 1, y) || paneOf(x, y + 1) ? 1 : paneOf(x - 1, y) || paneOf(x, y - 1) ? -0.6 : 0
          c.set(x, y, shade(FRAME, 2.4 + lampAt(x, y) * 3 + bevel - vignette(x, y) * 0.6, x, y))
          continue
        }
        let col = outside(x, y, f)
        const fr = frost(x, y, pane)
        if (fr > 1) col = shade(FROST, 2 + (fr - 1) * 2, x, y)
        else if (fr > 0.55) col = mix(col, FROST[1] ?? 0, 0.5)
        if (fog > 0) {
          const d = Math.hypot(x - 19, (y - 6) * 1.25) + (noise(x * 0.7, y * 0.7, 0, 9) - 0.5) * 3
          const reach = 8.5 * Math.sqrt(fog)
          const isTrail = x === DRIP_X && f >= 80 && y >= 3 && y <= dripY
          if (d < reach && !isTrail) {
            const density = fog * (d < reach * 0.55 ? 1 : 0.6)
            col = mix(col, shade(FOG, 1 + density * 2.4, x, y), Math.min(0.85, density * 0.95))
          }
        }
        c.set(x, y, col)
      }
    }
    if (f >= 80 && f <= 92) c.set(DRIP_X, Math.round(dripY), 0xe6ecf6)

    for (let x = 1; x <= 29; x++) {
      c.set(x, 18, shade(FRAME, 4 + lampAt(x, 18) * 2 - vignette(x, 18) * 0.5 + (x < 4 || x > 26 ? -0.6 : 0), x, 18))
      c.set(x, 19, shade(FRAME, 1.6 + lampAt(x, 19) * 2 - vignette(x, 19) * 0.5, x, 19))
      c.set(x, 20, shade(WALL, 1 + lampAt(x, 20) * 3 - vignette(x, 20), x, 20))
    }

    const alert = f >= POP && f < POP + 9
    const blink = f >= 86 && f <= 89
    CAT_ART.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        if (row[i] !== '#') continue
        const isHead = j <= 2 && i >= 6
        const x = CAT_X + i
        const y = CAT_Y + j - (alert && isHead ? 1 : 0)
        const rightEdge = row[i + 1] !== '#'
        const leftEdge = row[i - 1] !== '#'
        const topEdge = (CAT_ART[j - 1]?.[i] ?? '.') !== '#'
        c.set(x, y, rightEdge && j >= 3 ? shade(CAT, 2.4) : topEdge && !leftEdge ? shade(CAT, 1.2) : shade(CAT, 0.4))
      }
    })
    if (alert) for (let i = 6; i <= 8; i++) c.set(CAT_X + i, CAT_Y + 2, shade(CAT, 0.4))
    const eyeY = CAT_Y + 2 - (alert ? 1 : 0)
    if (!blink) c.set(CAT_X + 8, eyeY, alert ? 0xf6d860 : 0xd8a440)
    else c.set(CAT_X + 8, eyeY, shade(CAT, 2))
    const sway = Math.round(wave(f, LOOP, 2, 0.1) * 1.2)
    const tail: [number, number][] = [[2, 18], [2, 19], [2, 20], [1 + Math.max(0, sway), 21], [1 + sway, 22], [2 + sway, 23]]
    for (const [x, y] of tail) c.set(CAT_X - 3 + x, y, shade(CAT, 0.6, x, y))
    c.set(CAT_X - 3 + 3, 17, shade(CAT, 0.4))

    for (let x = 0; x < W; x++) {
      const lit = lampAt(x, 25)
      const contact = x >= 28 && x <= 54 ? -1.2 : 0
      c.set(x, 25, shade(IRON, 3.2 + lit * 3 + contact - vignette(x, 25) * 0.5, x, 25))
      c.set(x, 26, shade(IRON, 4.4 + lit * 3 - vignette(x, 26) * 0.5, x, 26))
      for (let y = 27; y < H; y++) {
        const fireLit = lightAt([{ x: 40.5, y: 29, power: glow * 0.9, radius: 11 }], x, y)
        const isSeam = x === 31 || x === 50 || (y === 27 && (x < 31 || x > 50))
        c.set(x, y, shade(IRON, 1.6 + lampAt(x, y) * 1.4 + fireLit * 2 - (isSeam ? 1 : 0) - vignette(x, y) * 0.6, x, y))
      }
    }
    for (let x = 8; x <= 24; x++) c.set(x, 29, shade(IRON, 5.4 + lampAt(x, 29) * 2 - (x === 8 || x === 24 ? 1 : 0), x, 29))
    for (let x = 34; x <= 47; x++) {
      for (let y = 28; y <= 30; y++) {
        const isSlit = (x - 35) % 3 === 0 && x >= 35 && x <= 46
        const isFrame = y === 28 || y === 30 || x === 34 || x === 47
        if (isSlit && !isFrame) c.set(x, y, shade(FIRE, 4.2 + glow * 2.5 + Math.sin(x * 1.3 + f * 0.7) * 0.6, x, y))
        else if (isFrame) c.set(x, y, shade(IRON, 4 + lampAt(x, y) * 1.5 + glow * 0.8, x, y))
      }
    }

    for (let y = RIM_Y; y <= BASE_Y; y++) {
      const hw = halfWidth(y)
      for (let x = Math.ceil(CX - hw); x <= Math.floor(CX + hw); x++) {
        if (inside(x, y, CX, RIM_Y, 14.4, 4.4)) continue
        const u = (x - CX) / hw
        const lit = lampAt(x, y)
        let level = 2 + u * 1.6 + lit * 2.2
        if (u > 0.42 && u < 0.62) level += 2
        if (u > 0.62) level -= 0.3
        if (y === BASE_Y || y === BASE_Y - 1) level -= 0.8
        const isRim = u < -0.9
        c.set(x, y, isRim ? mix(shade(COPPER, level, x, y), FROST[0] ?? 0, 0.28) : shade(COPPER, level, x, y))
      }
    }
    for (const side of [-1, 1]) {
      for (const [dx, dy] of [[15, 15], [16, 15], [17, 16], [16, 17], [15, 17]] as const) {
        const x = CX + side * dx
        c.set(x, dy, shade(BRASS, side > 0 ? 3.6 + (dy === 15 ? 1.4 : 0) : 1.8 + (dy === 15 ? 0.8 : 0), x, dy))
      }
    }
    const swell = ease.in(beat(f, 36, POP - 1))
    const bubble = f < POP ? swell : 0
    const BX = 36
    for (let y = RIM_Y - 5; y <= RIM_Y + 5; y++) {
      for (let x = CX - 15; x <= CX + 15; x++) {
        if (!inside(x, y, CX, RIM_Y, 14.4, 4.4)) continue
        const u = (x - CX) / 14
        if (!inside(x, y, CX, RIM_Y, 13.1, 3.3)) {
          const isFront = y > RIM_Y
          c.set(x, y, shade(COPPER, (isFront ? 4.6 : 3.4) + u * 2 + lampAt(x, y) * 1.6, x, y))
          continue
        }
        if (!inside(x, y, CX, WINE_Y, WINE_RX, WINE_RY)) {
          c.set(x, y, shade(COPPER, 1 + u * 1.2 + lampAt(x, y), x, y))
          continue
        }
        const sx = (x - CX) / WINE_RX
        const sy = (y - WINE_Y) / WINE_RY
        const edge = sx * sx + sy * sy
        const ripple = noise(x * 0.32 + wave(f, LOOP, 1) * 1.5, y * 0.7, wave(f, LOOP, 2, 0.25) * 0.8, 3)
        let level = 3 - (edge > 0.7 ? 1 : 0) - (sy < -0.5 ? 0.6 : 0)
        const reflect = Math.hypot((sx - 0.42) * 1.6, sy + 0.25)
        let col0 = -1
        if (reflect < 0.36 && ripple > 0.45) level += 2
        if (reflect < 0.2 && ripple > 0.5) col0 = 0xf4c8c0
        const moon = Math.hypot((sx + 0.55) * 2, sy + 0.3)
        let col = col0 >= 0 ? col0 : shade(WINE, level, x, y)
        if (moon < 0.32) col = mix(col, FROST[0] ?? 0, 0.35)
        c.set(x, y, col)
      }
    }

    const turn = (TAU * f) / LOOP
    const floaters = FLOATERS.map(fl => {
      const a = fl.a + turn
      const x = CX + Math.cos(a) * fl.r * WINE_RX
      const y = WINE_Y + Math.sin(a) * fl.r * WINE_RY
      const bob = f >= POP && f < POP + 3 && Math.hypot(x - BX, (y - WINE_Y) * 3) < 7 ? -1 : 0
      return { ...fl, a, x: Math.round(x), y: Math.round(y) + bob }
    }).sort((p, q) => p.y - q.y)
    for (const fl of floaters) {
      const lit = lampAt(fl.x, fl.y) * 1.5
      if (fl.kind === 'orange') {
        c.sprite(fl.x - 3, fl.y - 1, ['.oooo.', 'oyYYyo', '.rrrr.'], {
          o: shade(ORANGE, 3.4 + lit),
          y: shade(ORANGE, 5 + lit * 0.5),
          Y: shade(ORANGE, 5.6 + lit),
          r: shade(ORANGE, 1.8 + lit * 0.5),
        })
      } else if (fl.kind === 'stick') {
        const phi = fl.a * 1.4
        const dx = Math.round(Math.cos(phi) * 2.2)
        const dy = Math.round(Math.sin(phi) * 0.7)
        c.line(fl.x - dx, fl.y - dy + 1, fl.x + dx, fl.y + dy + 1, shade(SPICE, 1.6 + lit))
        c.line(fl.x - dx, fl.y - dy, fl.x + dx, fl.y + dy, shade(SPICE, 4 + lit))
        c.set(fl.x + dx, fl.y + dy, shade(SPICE, 5 + lit))
      } else if (fl.kind === 'anise') {
        const isPlus = mod(fl.a * 1.8, Math.PI / 2) < Math.PI / 4
        const arms = isPlus ? [[0, -1], [1, 0], [0, 1], [-1, 0]] : [[-1, -1], [1, -1], [1, 1], [-1, 1]]
        for (const [dx, dy] of arms) c.set(fl.x + (dx ?? 0), fl.y + (dy ?? 0), shade(SPICE, 1.8 + lit))
        c.set(fl.x, fl.y, shade(SPICE, 4.6 + lit))
      } else {
        c.set(fl.x, fl.y, shade(SPICE, 1.2 + lit))
        c.set(fl.x + 1, fl.y, shade(SPICE, 2.6 + lit))
      }
    }

    for (let y = WINE_Y - 4; y <= WINE_Y + 2; y++) {
      for (let x = BX - 4; x <= BX + 4; x++) {
        const by = WINE_Y - bubble * 1.2
        const d = Math.hypot((x - BX) / (1 + bubble * 1.8), (y - by) / (0.7 + bubble * 1.3))
        if (bubble > 0.08 && d <= 1) c.set(x, y, shade(WINE, d > 0.7 ? (y < by ? 6.4 : 4) : 2.6, x, y))
      }
    }

    if (f >= POP && f < POP + 7) {
      const t = f - POP
      for (const [vx, vy] of [[-0.9, -1.9], [0.7, -2.2], [-0.3, -2.7], [1.3, -1.5], [-1.5, -1.2]] as const) {
        const x = BX + vx * t
        const y = WINE_Y - 1 + vy * t + 0.38 * t * t
        if (y < WINE_Y + 1) c.set(x, y, shade(WINE, t < 2 ? 7 : 5.5))
      }
      if (t < 3) {
        const r = 1.5 + t * 1.2
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * TAU
          c.set(BX + Math.cos(a) * r, WINE_Y + Math.sin(a) * r * 0.4, shade(WINE, t === 0 ? 8 : 6.5 - t))
        }
      }
    }

    const breath = (TAU * f) / LOOP
    for (const [k, wx] of [33, 40, 47].entries()) {
      const height = 13 + k * 2
      for (let s = 0; s < height; s++) {
        const y = 12 - s
        const sway = Math.sin(s * 0.42 - breath * 3 + k * 2.1) * (0.5 + s * 0.11)
        const x = Math.round(wx - s * (0.18 + k * 0.05) + sway)
        const pieces = smoothstep(-0.2, 0.5, Math.sin(s * 0.55 - breath * 4 + k * 1.7))
        const a = smoothstep(0, 3, s) * (1 - s / height) * pieces * (0.75 + 0.25 * wave(f, LOOP, 2, k / 3))
        if (a < 0.12) continue
        const col = shade(STEAM, 3.6 + lampAt(x, y) * 1.6, x, y)
        c.tint(x, y, col, a > 0.4 ? 0.7 : 0.42)
        if (s < 10 && a > 0.25) c.tint(x + 1, y, col, a > 0.45 ? 0.45 : 0.25)
      }
    }
    if (f >= POP && f < POP + PUFF_LIFE) {
      const t = (f - POP) / PUFF_LIFE
      const px = Math.round(BX - 17 * ease.inOut(t))
      const py = Math.round(12 - 7 * ease.out(t))
      const r = 1.4 + t * 3.4
      const a = Math.min(1, (f - POP + 1) / 2) * (1 - t) ** 0.7
      const lobes = [[0, 0, 1], [r * 0.7, r * 0.35, 0.6], [-r * 0.6, -r * 0.3, 0.55], [r * 0.2, -r * 0.6, 0.5]] as const
      for (let y = py - 8; y <= py + 8; y++) {
        for (let x = px - 10; x <= px + 10; x++) {
          let d = 9
          for (const [lx, ly, lr] of lobes) d = Math.min(d, Math.hypot(x - px - lx, (y - py - ly) * 1.2) / (r * lr))
          if (d > 1) continue
          const dense = a * (d < 0.6 ? 1 : 0.55)
          if (dense < 0.15) continue
          c.tint(x, y, shade(STEAM, 3.4 + lampAt(x, y) * 1.4 + (d < 0.6 ? 0.6 : 0), x, y), Math.min(0.8, dense * 0.85))
        }
      }
    }

    for (let y = 0; y <= 2; y++) c.set(55, y, shade(IRON, 2))
    for (const [y, x0, x1] of [[3, 54, 56], [4, 53, 57], [5, 52, 58]] as const) {
      for (let x = x0; x <= x1; x++) c.set(x, y, shade(BRASS, y === 5 ? 5.4 : 1.4 + (x === x0 ? 1.6 : x === x0 + 1 ? 0.8 : 0), x, y))
    }
    for (let x = 54; x <= 56; x++) c.set(x, 6, x === 55 ? 0xfffbe0 : FIRE[7] ?? 0)
    quantize(c.px, cache)
  })
}

export const scene: Scene = {
  verb: 'Mulling',
  render,
  hero: 56,
  snaps: [{ frames: POP, box: [33, 11, 38, 15], colors: [0x4c4656, 0xf0a070, 0xb03a42, 0xae6e38, 0x6e6764], why: 'the swollen bubble pops' }],
}
