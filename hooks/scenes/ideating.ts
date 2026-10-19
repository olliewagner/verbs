import { Canvas, PALETTE, beat, clamp, ease, hex, lerp, shade, smoothstep, threshold, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72
const FLOOR = 27
const DESK_Y = 20

const WALL = hex('07060d 0f0c18 191321 271b29 3a262f 553633 744a3b 966240 b88049 d6a35e ecc684')
const FLOORING = hex('060509 0e0a10 1a1216 2a1a18 3e261c 563420 704424 8c5830')
const WOOD = PALETTE.wood
const SHIRT = hex('0a1014 132026 1d3236 2a4a48 3c6458 548070')
const PANTS = hex('08070e 110e18 1b1624 282034 3a2e48')
const SKIN = hex('1e120e 3a2218 62381f 8e5430 b8764a d8a06c')
const HAIR = hex('060404 140e0c 241812 3a281c')
const BRASS = hex('140e08 2e200e 56401a 8a6a2c c4a050')
const PAPER = hex('2a2a34 50505c 8c8a8c c8c2b4 f2ead4')
const NIGHT = hex('060a18 0c1630 183060 3a5c98 9ab8e0 e8f0ff')
const FILAMENT = hex('1a0e0c 4a1410 8a2410 d04a14 f48a2a fcc85c fff0b8 ffffff')
const GLASS = hex('2a2c38 4a1410 8a2410 d04a14 f48a2a fcc85c fff0b8')
const GLASS_EDGE = hex('1a1a26 1a0e0c 4a1410 8a2410 d04a14 f48a2a fcc85c')

const SPUTTER = [0.45, 0, 0, 0, 0.75, 0.15, 0, 0, 0.35, 0.95, 0, 0.55, 0.85, 0.2]
const BLAZE = 22
const FADE = 58

function power(f: number): number {
  if (f < 8) return 0
  if (f < BLAZE) return SPUTTER[f - 8] ?? 0
  if (f === BLAZE) return 1.7
  if (f === BLAZE + 1) return 1.35
  if (f < FADE) return 1.1 + 0.03 * Math.sin(f * 2.1)
  return 1.1 * (1 - smoothstep(0, 1, beat(f, FADE, 65)))
}

function heat(f: number): number {
  if (f >= FADE) return Math.max(0, 1 - beat(f, FADE, 71) ** 0.7 * 1.02)
  return clamp(power(f) / 1.1)
}

const PIVOT_X = 38
const CORD = 13

function bulbAt(f: number): { x: number; y: number; angle: number } {
  const kick = f >= BLAZE ? 0.07 * Math.exp(-(f - BLAZE) / 14) * Math.sin((f - BLAZE) * 0.5) : 0
  const angle = 0.06 * wave(f, LOOP, 2) + kick
  return { x: PIVOT_X + Math.sin(angle) * CORD, y: -4 + Math.cos(angle) * CORD, angle }
}

type Pose = { sx: number; sy: number; hx: number; hy: number; ex: number; ey: number; px: number; py: number }
const SLUMP: Pose = { sx: 27, sy: 15, hx: 29.5, hy: 13, ex: 31, ey: 19, px: 30, py: 15.5 }
const BOLT: Pose = { sx: 24.5, sy: 13.5, hx: 25.5, hy: 9.5, ex: 27.5, ey: 12, px: 28, py: 8 }
const WRITE: Pose = { sx: 26.5, sy: 14.5, hx: 28.5, hy: 12, ex: 31, ey: 18, px: 35, py: 19 }
const CRUMPLE: Pose = { sx: 26, sy: 14, hx: 27.5, hy: 11, ex: 29.5, ey: 17, px: 31, py: 15 }
const WIND: Pose = { sx: 26, sy: 14, hx: 27, hy: 11, ex: 26, ey: 12, px: 25, py: 10 }
const TOSS: Pose = { sx: 26.5, sy: 14, hx: 28, hy: 11, ex: 29.5, ey: 11.5, px: 32.5, py: 9.5 }
const smoothstep01 = (t: number) => smoothstep(0, 1, t)
const take = (t: number) => {
  const k = [0, 0.55, 1.03, 1]
  const i = Math.min(2, Math.floor(t * 3))
  return lerp(k[i] ?? 1, k[i + 1] ?? 1, t * 3 - i)
}
const KEYS: [number, Pose, (t: number) => number][] = [
  [0, SLUMP, ease.inOut], [BLAZE, SLUMP, take], [BLAZE + 3, BOLT, ease.inOut], [28, BOLT, smoothstep01],
  [32, WRITE, ease.inOut], [44, WRITE, ease.inOut], [47, CRUMPLE, ease.inOut], [50, CRUMPLE, ease.inOut],
  [52, WIND, ease.out], [53, TOSS, ease.inOut], [59, TOSS, ease.inOut], [66, SLUMP, ease.inOut], [LOOP, SLUMP, ease.inOut],
]

function pose(f: number): Pose {
  for (let k = 0; k + 1 < KEYS.length; k++) {
    const [f0, a, curve] = KEYS[k] ?? [0, SLUMP, ease.inOut]
    const [f1, b] = KEYS[k + 1] ?? [LOOP, SLUMP, ease.inOut]
    if (f < f0 || f >= f1) continue
    const t = curve((f - f0) / (f1 - f0))
    const out = { ...a }
    for (const key of Object.keys(a) as (keyof Pose)[]) out[key] = lerp(a[key], b[key], t)
    if (f < BLAZE || f >= 66) {
      const breath = Math.round(wave(f, LOOP, 3) * 0.55)
      out.sy += breath
      out.hy += breath
    }
    if (f >= 32 && f < 44) out.px += [0, 1, 2, 1][f % 4] ?? 0
    return out
  }

  return SLUMP
}

const PART = { None: 0, Chair: 1, Pants: 2, Shirt: 3, Skin: 4, Hair: 5, Desk: 6, DeskDark: 7, Paper: 8, Bin: 9, Pencil: 10 } as const

function figure(f: number, p: Pose): Canvas {
  const m = new Canvas()
  m.line(19, 12, 19, FLOOR - 1, PART.Chair)
  m.line(19, 21, 25, 21, PART.Chair)
  m.line(25, 22, 25, FLOOR - 1, PART.Chair)
  m.line(20, 14, 20, 15, PART.Chair)
  m.line(21, 20, 28, 20, PART.Pants)
  m.line(21, 19, 27, 19, PART.Pants)
  m.line(28, 20, 29, FLOOR - 1, PART.Pants)
  m.line(29, FLOOR - 1, 31, FLOOR - 1, PART.Hair)
  m.line(22, 19, p.sx - 1, p.sy, PART.Shirt)
  m.line(23, 19, p.sx, p.sy, PART.Shirt)
  m.line(24, 19, p.sx + 0.5, p.sy + 1, PART.Shirt)
  m.disc(p.hx, p.hy, 1.9, PART.Skin)
  m.ellipse(p.hx - 0.9, p.hy - 1.1, 1.5, 1.1, PART.Hair)
  m.set(p.hx - 2, p.hy, PART.Hair)
  m.line(p.sx, p.sy + 0.5, (p.sx + p.hx) / 2, (p.sy + p.hy) / 2 + 0.6, PART.Skin)
  m.line(p.sx, p.sy, p.ex, p.ey, PART.Shirt)
  m.line(p.ex, p.ey, p.px, p.py, PART.Shirt)
  m.set(p.px, p.py, PART.Skin)
  if (f >= 29 && f < 46) m.line(p.px + 1, p.py - 1, p.px + 1, p.py, PART.Pencil)
  m.rect(32, DESK_Y, 25, 1, PART.Desk)
  m.rect(32, DESK_Y + 1, 25, 1, PART.DeskDark)
  m.rect(46, DESK_Y + 2, 10, 3, PART.DeskDark)
  m.line(33, DESK_Y + 2, 33, FLOOR - 1, PART.DeskDark)
  m.line(55, DESK_Y + 5, 55, FLOOR - 1, PART.DeskDark)
  if (f < 46 || f >= 67) m.rect(34, DESK_Y - 1, 6, 1, PART.Paper)
  m.rect(50, DESK_Y - 3, 5, 1, PART.Desk)
  m.rect(51, DESK_Y - 2, 4, 2, PART.Paper)
  const wobble = f === 58 || f === 59 ? 1 : 0
  for (let y = 22; y < FLOOR; y++) m.line(58 - (y < 23 ? 0 : 0) + (y === 22 ? wobble : 0), y, 62 + (y === 22 ? wobble : 0), y, PART.Bin)

  return m
}

function ball(f: number, p: Pose): [number, number] | null {
  if (f === 46) return [p.px + 1, p.py + 1]
  if (f >= 47 && f < 53) return [p.px + 1, p.py]
  if (f >= 53 && f < 58) {
    const t = (f - 53) / 5
    return [lerp(p.px + 1, 60, t), lerp(p.py, 21, t) - 9 * 4 * t * (1 - t)]
  }
  return null
}

type Moth = { from: [number, number]; to: [number, number]; arrive: number; rx: number; ry: number; speed: number; phase: number }
const MOTHS: Moth[] = [
  { from: [-3, 4], to: [70, 2], arrive: 25, rx: 6, ry: 3.5, speed: 0.31, phase: 0 },
  { from: [68, 12], to: [-4, 10], arrive: 28, rx: 4.5, ry: 4, speed: -0.38, phase: 2 },
  { from: [20, -3], to: [66, -3], arrive: 32, rx: 7, ry: 2.5, speed: 0.26, phase: 4 },
]

function mothAt(m: Moth, f: number): [number, number] | null {
  const b = bulbAt(f)
  const orbit = (): [number, number] => [
    b.x + Math.cos(f * m.speed + m.phase) * m.rx + Math.sin(f * 0.9 + m.phase) * 1.2,
    b.y + 3 + Math.sin(f * m.speed * 1.4 + m.phase) * m.ry,
  ]
  if (f < m.arrive) return null
  const [ox, oy] = orbit()
  const inT = ease.out(beat(f, m.arrive, m.arrive + 8))
  const outT = ease.in(beat(f, FADE + 2, FADE + 12))
  if (outT >= 1) return null
  const x = lerp(lerp(m.from[0], ox, inT), m.to[0], outT)
  const y = lerp(lerp(m.from[1], oy, inT), m.to[1], outT)
  return [x, y]
}

function render(): Int32Array[] {
  return Array.from({ length: LOOP }, (_, f) => {
    const c = new Canvas()
    const b = bulbAt(f)
    const bx = Math.round(b.x)
    const lightX = bx
    const lightY = 13
    const P = power(f)
    const p = pose(f)
    const fig = figure(f, p)
    const occluded = (x: number, y: number) => fig.get(x, y) !== PART.None
    const light = (x: number, y: number) => {
      const d = Math.hypot(x - lightX, (y - lightY) * 1.1)
      return P * Math.max(0, 1 - d / 44) ** 1.3
    }
    const onWall = (x: number, y: number, depth: number) => {
      const qx = (x + lightX * depth) / (1 + depth)
      const qy = (y + lightY * depth) / (1 + depth)
      return light(x, y) * (occluded(qx, qy) ? 0.4 : 1)
    }
    const moon = (x: number, y: number) => Math.max(0, 1 - Math.hypot(x - 8, y - 12) / 22) * 0.9

    for (let y = 0; y < FLOOR; y++) {
      for (let x = 0; x < W; x++) {
        const lit = onWall(x, y, 0.32)
        const stripe = x % 6 === 0 ? -0.5 : 0
        c.set(x, y, shade(WALL, 1 + moon(x, y) + lit * 8.2 + stripe * Math.min(1, lit * 2)))
      }
    }
    for (let y = FLOOR; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const lit = onWall(x, y, 0.25)
        const seam = y === FLOOR ? -1.4 : (x + (y % 2) * 7) % 14 === 0 ? -1 : 0
        c.set(x, y, shade(FLOORING, 1 + moon(x, y) * 0.8 + lit * 6 + seam - (y - FLOOR) * 0.15))
      }
    }
    for (let y = 3; y <= 14; y++) {
      for (let x = 3; x <= 13; x++) {
        const isFrame = x === 3 || x === 13 || y === 3 || y === 14 || x === 8 || y === 8
        if (isFrame) {
          c.set(x, y, shade(WALL, 1.5 + light(x, y) * 7))
          continue
        }
        const dm = Math.hypot(x - 10.5, y - 5.5)
        c.set(x, y, dm < 1.6 ? NIGHT[5] ?? 0 : dm < 2.6 ? NIGHT[3] ?? 0 : shade(NIGHT, 1.6 - (y - 4) * 0.08 + (x < 8 ? 0.3 : 0)))
      }
    }
    for (let x = 2; x <= 14; x++) c.set(x, 15, shade(WALL, 2 + moon(x, 15) + light(x, 15) * 8))
    for (let y = 4; y <= 9; y++) {
      for (let x = 50; x <= 57; x++) {
        const lit = light(x, y)
        const isFrame = x === 50 || x === 57 || y === 4 || y === 9
        const isHill = y >= 8 - (x > 53 ? 1 : 0) - (x === 55 ? 1 : 0)
        const level = 0.8 + lit * 6
        c.set(x, y, isFrame ? shade(WOOD, level + 0.5) : isHill ? shade(SHIRT, level + 0.5) : x === 52 && y === 6 ? shade(FILAMENT, 2 + lit * 4) : shade(NIGHT, 1 + lit * 2.6))
      }
    }

    const moths = MOTHS.map(m => mothAt(m, f))
    if (P > 0.5) {
      for (const at of moths) {
        if (!at) continue
        const sx = at[0] + (at[0] - lightX) * 1.6
        const sy = at[1] + (at[1] - lightY) * 1.6
        if (sy > FLOOR - 2) continue
        if (sx > 2 && sx < 15 && sy < 16) continue
        c.ellipse(sx, sy, 1.3, 0.8, (x, y) => shade(WALL, 1 + moon(x, y) + light(x, y) * 5))
      }
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const id = fig.get(x, y)
        if (id === PART.None) continue
        const towardX = Math.sign(lightX - x)
        const towardY = Math.sign(lightY - y)
        const facesLight = fig.get(x + towardX, y) === PART.None || fig.get(x, y + towardY) === PART.None
        const facesMoon = (fig.get(x - 1, y) === PART.None || fig.get(x, y - 1) === PART.None) && x < 31
        const lit = light(x, y) * (facesLight ? 1.35 : 0.8)
        const m = moon(x, y) * 0.4
        const ramp = id === PART.Chair || id === PART.Desk || id === PART.DeskDark ? WOOD
          : id === PART.Pants ? PANTS : id === PART.Shirt ? SHIRT : id === PART.Skin ? SKIN
            : id === PART.Hair ? HAIR : id === PART.Paper ? PAPER : id === PART.Bin ? BRASS : FILAMENT
        let level = 0.4 + m + lit * (ramp.length - 1) * 0.75
        if (id === PART.DeskDark || id === PART.Chair) level -= 0.8
        if (id === PART.Bin && (x + y) % 2 === 0) level -= 0.6
        if (id === PART.Pencil) level = 4 + lit
        if (facesMoon && P < 0.4 && id !== PART.Chair) {
          c.set(x, y, NIGHT[id === PART.Skin || id === PART.Shirt ? 2 : 1] ?? 0)
          continue
        }
        c.set(x, y, shade(ramp, level + (P > 0.4 ? 0.5 : 0)))
      }
    }
    const crumpled = ball(f, p)
    if (crumpled) {
      const lit = light(crumpled[0], crumpled[1])
      c.rect(crumpled[0], crumpled[1] - 1, f === 46 ? 3 : 2, 2, shade(PAPER, 1 + lit * 3))
      c.set(crumpled[0], crumpled[1] - 1, shade(PAPER, 2 + lit * 3))
    }

    c.line(PIVOT_X + Math.sin(b.angle) * 4 - 0, 0, bx, 9, shade(HAIR, 1 + P * 1.5))
    c.rect(bx - 1, 9, 3, 2, shade(BRASS, 1.5 + P * 2.2))
    c.set(bx + 1, 9, shade(BRASS, 2.5 + P * 2))
    const h = heat(f)
    if (P > 0.3) {
      for (let y = 4; y <= 22; y++) {
        for (let x = bx - 9; x <= bx + 9; x++) {
          const d = Math.hypot(x - bx, (y - 13) * 1.1)
          if (d < 3.2 || d > 3 + P * 2.4) continue
          c.tint(x, y, 0xfff0c0, 0.3)
        }
      }
    }
    const warmth = f >= FADE ? clamp(h / 0.6) * 6 : h > 0.6 ? 6 : h > 0.3 ? 5 : 0
    const glass = shade(GLASS, warmth)
    const glassEdge = shade(GLASS_EDGE, warmth)
    c.sprite(bx - 2, 11, ['.eee.', 'eggge', 'eggge', 'eggge', '.eee.'], { e: glassEdge, g: glass })
    if (h > 0.6) {
      c.rect(bx - 1, 12, 3, 2, FILAMENT[7] ?? 0)
    } else {
      if (h < 0.3) c.set(bx - 1, 12, 0x6a7898)
      const filament = shade(FILAMENT, h * 7.2)
      c.set(bx - 1, 13, filament)
      c.set(bx, 12, filament)
      c.set(bx + 1, 13, filament)
      c.set(bx - 1, 12, shade(BRASS, 1.5))
      c.set(bx + 1, 12, shade(BRASS, 1.5))
    }

    moths.forEach((at, i) => {
      if (!at) return
      const lit = light(at[0], at[1])
      const color = shade(PAPER, 1.6 + lit * 2.2)
      const isUp = (f + i) % 2 === 0
      const x = Math.round(at[0])
      const y = Math.round(at[1])
      c.set(x, y, shade(HAIR, 3))
      if (isUp) {
        c.set(x - 1, y - 1, color)
        c.set(x + 1, y - 1, color)
      } else {
        c.set(x - 1, y, color)
        c.set(x + 1, y, color)
      }
    })

    const blazeAge = f - BLAZE
    if (blazeAge >= 0 && blazeAge <= 2) {
      const r = 5.5 + blazeAge * 1.6
      for (let y = 3; y <= 23; y++) {
        for (let x = bx - 11; x <= bx + 11; x++) {
          const d = Math.hypot(x - bx, (y - 13) * 1.1)
          if (Math.abs(d - r) >= 1) continue
          if (blazeAge === 0) {
            if ((x + y) % 2 === 0 || d < 5.3) c.set(x, y, FILAMENT[7] ?? 0)
          } else if (threshold(x, y) < (blazeAge === 1 ? 0.5 : 0.25)) c.set(x, y, FILAMENT[7] ?? 0)
        }
      }
    }
    return c.px
  })
}

export const scene: Scene = {
  verb: 'Ideating',
  render,
  hero: 26,
  snaps: [
    { frames: [8, BLAZE], why: 'the bulb sputters, then blazes on: each flicker lights the whole room' },
    { frames: 56, box: [49, 5, 53, 8], why: "a moth's shadow flits over the picture as the tossed page flies past" },
  ],
}
