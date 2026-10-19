import { Canvas, TAU, beat, clamp, ease, hex, lerp, mod, noise, shade, threshold, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72
const HORIZON = 17

const SKY = hex('121634 1a1d48 262556 382c64 52346e 703c74 924a76 b25a74 cd6e70 e48e70')
const MOON = hex('a89aa6 cbbcbe e6dccc f8f0dc fffbec')
const TREES = hex('120f26 1a1531 231b3c 2d2246')
const WATER = hex('0b0d22 11142e 191b3c 22224a 2e2a58 3e3264 543c6c 704870 9a5e70')
const SHEEN = hex('5a4a78 8a76a0 c4b4c4 f0e6d6')
const PAD = hex('0c1c1a 122a22 1b3c2a 265032 336438 46783e')
const LILY = hex('6a2e52 a85878 de92a8 f8d2dc fff4f4')
const REED = hex('07081a 0d0f24 151830 20223e')
const FROG = hex('0b1a16 13291f 1d3e29 2b5631 3d6e38 568a42 79a656 a8c87a')
const BELLY = hex('4e4c3e 7c7658 aca07a d6cc9e')
const IRIS = hex('6a4210 b0801e e2b440 f8e08a')
const WINGS = hex('8a8cb4 c6cae6')
const DRAGON = hex('0c3040 1a6878 34aab0 8ae8d8')

const MX = 15
const MY = 8
const MR = 5

const FX = 38
const FY = 12

type Region = 'skin' | 'belly' | 'eye' | 'mouth'

function inEllipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number, angle = 0): boolean {
  const dx = x - cx
  const dy = y - cy
  const u = dx * Math.cos(angle) + dy * Math.sin(angle)
  const v = -dx * Math.sin(angle) + dy * Math.cos(angle)
  return (u / rx) ** 2 + (v / ry) ** 2 <= 1
}

const EYE_X = 6.6
const EYE_Y = 3
const EYE_R = 2.6
const THIGH = [13.8, 9.4, 3.9, 2.7] as const

function frogAt(x: number, y: number, gulp: number): Region | undefined {
  const px = x + 0.5
  const py = y + 0.5
  if (inEllipse(px, py, EYE_X, EYE_Y, EYE_R, EYE_R)) return 'eye'
  const head = inEllipse(px, py, 5.8, 6.2, 5.8, 3.2, 0.34)
  const body = inEllipse(px, py, 11.4, 8, 6.2, 4.2)
  const thigh = inEllipse(px, py, THIGH[0], THIGH[1], THIGH[2], THIGH[3])
  const foot = inEllipse(px, py, 11.5, 12.4, 5.8, 1)
  const arm = (px >= 4.8 && px <= 6.6 && py >= 8.5 && py <= 12) || inEllipse(px, py, 4.8, 12.4, 2.4, 0.9)
  if (!head && !body && !thigh && !foot && !arm) return undefined
  const u = (px - 5.8) * Math.cos(0.34) + (py - 6.2) * Math.sin(0.34)
  const v = -(px - 5.8) * Math.sin(0.34) + (py - 6.2) * Math.cos(0.34)
  if (head && u < 2.6 && v > 0.2 && v < 1.2) return 'mouth'
  if ((head || body) && inEllipse(px, py, 5.2, 9, 3.4 + gulp, 2.2 + gulp * 0.5) && !thigh && !arm) return 'belly'
  return 'skin'
}

type Gaze = [number, number]

function drawFrog(c: Canvas, gaze: Gaze, lid: number, gulp: number): void {
  for (let y = -1; y < 15; y++) {
    for (let x = -1; x < 19; x++) {
      const r = frogAt(x, y, gulp)
      if (!r) continue
      const sx = FX + x
      const sy = FY + y
      const out = (dx: number, dy: number) => !frogAt(x + dx, y + dy, gulp)
      const rim = out(-1, 0) || out(0, -1)
      const dark = out(1, 0) || out(0, 1)
      if (r === 'eye') {
        const ex = x + 0.5 - EYE_X
        const ey = y + 0.5 - EYE_Y
        const lidLine = -EYE_R + lid * EYE_R * 2
        const d = Math.hypot(ex, ey)
        if (d > EYE_R - 0.85) {
          c.set(sx, sy, shade(FROG, rim ? 7 : dark ? 2.6 : 4.6))
          continue
        }
        if (ey < lidLine) {
          c.set(sx, sy, shade(FROG, ey < lidLine - 1 ? 6 : 5))
          continue
        }
        const isPupil = Math.abs(ex - gaze[0]) < 1 && Math.abs(ey - gaze[1]) < 0.55
        c.set(sx, sy, isPupil ? 0x08060c : shade(IRIS, 2.2 - ey * 0.7 - ex * 0.3))
        continue
      }
      if (r === 'mouth') {
        c.set(sx, sy, FROG[1] ?? 0)
        continue
      }
      if (r === 'belly') {
        c.set(sx, sy, shade(BELLY, (rim ? 3 : 2.2) - (dark ? 1.2 : 0) - (y > 10 ? 0.8 : 0)))
        continue
      }
      const inThigh = inEllipse(x + 0.5, y + 0.5, THIGH[0], THIGH[1], THIGH[2], THIGH[3])
      const crease = !inThigh && inEllipse(x + 0.5, y + 0.5, THIGH[0], THIGH[1], THIGH[2] + 0.9, THIGH[3] + 0.9) && y >= 6 ? -1.6 : 0
      const spot = (x === 10 && y === 5) || (x === 13 && y === 5) || (x === 15 && y === 9) || (x === 12 && y === 10) ? -1 : 0
      const sheen = inThigh && x + 0.5 < THIGH[0] && y + 0.5 < THIGH[1] - 0.5 ? 1 : 0
      const base = 4.8 - y * 0.2
      c.set(sx, sy, shade(FROG, base + (rim ? 2.2 : 0) - (dark ? 2 : 0) + crease + spot + sheen))
    }
  }
  c.set(FX + 1, FY + 3, FROG[2] ?? 0)
  if (lid < 0.4) c.set(Math.round(FX + EYE_X - 1.5), Math.round(FY + EYE_Y - 1.5), 0xfff8e8)
}

type Fly = { x: number; y: number; isHovering: boolean }

const STOPS: [number, number, number][] = [
  [6, -6, 10],
  [14, 22, 13],
  [24, 33, 13],
  [38, 28, 5],
  [48, 70, 3],
]

function flyAt(f: number): Fly | undefined {
  if (f < (STOPS[0]?.[0] ?? 0) || f >= (STOPS[STOPS.length - 1]?.[0] ?? 0)) return undefined
  for (let i = 0; i + 1 < STOPS.length; i++) {
    const [f0, x0, y0] = STOPS[i] as [number, number, number]
    const [f1, x1, y1] = STOPS[i + 1] as [number, number, number]
    if (f < f0 || f >= f1) continue
    const dart = 3
    const hold = f1 - f0 - dart
    if (f - f0 < hold) {
      const bob = Math.floor((f - f0) / 3) % 2
      return { x: x0, y: y0 + bob, isHovering: true }
    }
    const t = ease.out((f - f0 - hold + 1) / dart)
    return { x: Math.round(lerp(x0, x1, t)), y: Math.round(lerp(y0, y1, t)), isHovering: false }
  }
  return undefined
}

function drawFly(c: Canvas, fly: Fly, f: number): void {
  const { x, y } = fly
  for (let i = 1; i <= 6; i++) c.set(x - i, y, shade(DRAGON, i === 6 ? 0 : i % 2 ? 1.2 : 2.2))
  c.set(x, y, DRAGON[3] ?? 0)
  c.set(x + 1, y, DRAGON[1] ?? 0)
  const WINGBEAT: readonly (readonly [number, number, number][])[] = [
    [[-1, -1, 1], [-2, -2, 0], [0, -1, 1], [1, -2, 0]],
    [[-1, -1, 1], [-2, -2, 0], [-2, -1, 1], [0, -1, 1], [1, -1, 0]],
    [[-1, -1, 1], [-2, -1, 1], [-3, -1, 0], [0, -1, 1], [1, -1, 0]],
  ]
  const wings = WINGBEAT[f % 3] ?? []
  for (const [dx, dy, level] of wings) c.set(x + dx, y + dy, WINGS[level] ?? 0)
}

function render(): Int32Array[] {
  const out: Int32Array[] = []

  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()

    c.fill((x, y) => {
      const d = Math.hypot(x - MX, y - MY)
      const halo = d < MR + 2 ? 1 : d < MR + 5 ? 0.5 : 0
      return shade(SKY, (y / HORIZON) ** 1.4 * 9 + halo)
    })
    for (const [sx, sy, ph] of [[34, 2, 0], [47, 4, 0.3], [58, 1, 0.6], [27, 6, 0.8], [52, 8, 0.15], [5, 2, 0.45]] as const) {
      const tw = wave(f, LOOP, 3, ph)
      c.set(sx, sy, tw > 0.6 ? 0xf4ecff : shade(SKY, 3 + tw))
    }
    c.disc(MX, MY, MR, (x, y) => {
      const sea = noise(x * 0.5, y * 0.5, 0, 4) > 0.58 ? -1 : 0
      const limb = Math.hypot(x - MX, y - MY) > MR - 1 && x > MX ? -1 : 0
      return shade(MOON, 3.2 + sea + limb - (y - MY > 2 ? 0.4 : 0))
    })
    for (let x = 0; x < W; x++) {
      const top = HORIZON - 2 - Math.round(noise(x * 0.18, 1, 0, 2) * 4 + (x > 5 && x < 11 ? 1 : 0))
      for (let y = top; y < HORIZON; y++) c.set(x, y, shade(TREES, y === top ? 2.4 : 1.2 + (y - top) * 0.1))
    }

    for (let y = HORIZON; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const depth = (y - HORIZON) / (H - HORIZON)
        c.set(x, y, shade(WATER, 6.4 - depth * 6.2 + (y === HORIZON ? 1 : 0)))
      }
    }
    for (let y = HORIZON + 1; y < H; y++) {
      const spread = 2 + (y - HORIZON) * 0.45
      const sway = wave(f, LOOP, 4, y * 0.13) * 1.2
      const open = 0.5 + 0.5 * Math.sin(TAU * (y / 3 - f / 18))
      if (open < 0.25) continue
      const len = Math.round(spread * (0.6 + 0.4 * wave(f, LOOP, 3, y * 0.27)) * Math.min(1, (open - 0.25) * 2))
      const cx = Math.round(MX + sway)
      for (let x = cx - len; x <= cx + len; x++) {
        const edge = Math.abs(x - cx) / Math.max(1, len)
        c.set(x, y, shade(SHEEN, 3 - edge * 2 - (y - HORIZON) * 0.1))
      }
    }

    for (let k = 0; k < 3; k++) {
      const age = mod(f - k * 24, LOOP) / 40
      if (age >= 1) continue
      const rx = 11 + age * 16
      const ry = rx * 0.22
      for (let a = 0; a < TAU; a += 0.02) {
        const x = Math.round(46 + Math.cos(a) * rx)
        const y = Math.round(26 + Math.sin(a) * ry)
        if (y <= HORIZON || 1 - age < threshold(x, y) * 0.8) continue
        c.set(x, y, shade(WATER, 5 - age * 2.5 + (Math.sin(a) < 0 ? 0.6 : 0)))
      }
    }

    const pads: [number, number, number, number, number][] = [
      [46, 26, 10, 3, 0.4], [20, 29, 7, 2, 2.6], [7, 23, 4, 1.2, 1.4], [61, 30, 6, 2, 3.6],
    ]
    for (const [px, py, rx, ry, notch] of pads) {
      c.ellipse(px, py, rx, ry, (x, y) => {
        const a = Math.atan2((y - py) / ry, (x - px) / rx)
        if (Math.abs(mod(a - notch + Math.PI, TAU) - Math.PI) < 0.28) return undefined
        const rim = (y - py) / ry > 0.55 ? -1 : 0
        const lit = (y - py) / ry < -0.4 ? 1 : 0
        return shade(PAD, 3 + lit + rim - (x - px) / rx * 0.7)
      })
      for (let x = Math.ceil(px - rx + 1); x <= Math.floor(px + rx - 1); x++) {
        const y = Math.round(py + ry * Math.sqrt(Math.max(0, 1 - ((x - px) / rx) ** 2))) + 1
        if (y < H) c.set(x, y, shade(WATER, 0))
      }
    }
    c.sprite(17, 25, ['..d.d..', '.ddcdd.', 'bcccccb', '.abbba.'], { a: LILY[0] ?? 0, b: LILY[1] ?? 0, c: LILY[2] ?? 0, d: LILY[3] ?? 0 })
    c.set(20, 26, 0xf6d26a)

    const fly = flyAt(f)
    const look = clamp(Math.min(beat(f, 15, 19), 1 - beat(f, 36, 41)))
    const gaze: Gaze = [lerp(-0.7, -0.9, look), lerp(-0.7, 0, look)]
    const blink = f >= 46 && f < 58 ? [0.35, 0.7, 1, 1, 1, 1, 1, 1, 0.85, 0.6, 0.3, 0.1][f - 46] ?? 0 : 0
    const gulp = Math.max(0, wave(f, LOOP, 6)) ** 3 * 0.8
    for (let x = FX + 6; x <= FX + 19; x++) c.set(x, FY + 13 + (x > FX + 15 ? 1 : 0), shade(PAD, 1))
    drawFrog(c, gaze, blink, gulp)
    for (const [rx, top, lean, ph] of [[59, 6, 2, 0], [61, 9, -1, 0.3], [63, 4, 1, 0.6], [56, 13, 1.5, 0.15]] as const) {
      const sway = wave(f, LOOP, 2, ph) * 0.8
      for (let y = top; y < H; y++) {
        const t = (H - y) / (H - top)
        const x = Math.round(rx + (lean + sway) * t * t)
        c.set(x, y, shade(REED, 1 + (y < HORIZON ? 1 : 0)))
        if (y > top + 1 && y < top + 6 && lean !== -1) c.set(x + 1, y, shade(REED, 0.4))
      }
      if (lean !== -1) {
        const tx = Math.round(rx + (lean + sway))
        for (let y = top + 1; y < top + 5; y++) c.set(tx, y, y === top + 1 ? 0x2a1a24 : 0x3a2228)
      }
    }

    for (const [cx, cy, rx, ry, ph] of [[60, 21, 2, 2, 0], [27, 19, 4, 1.5, 0.4], [9, 15, 3, 1.5, 0.7]] as const) {
      const glow = wave(f, LOOP, 2, ph)
      if (glow < -0.2) continue
      const x = Math.round(cx + Math.cos(TAU * (f / LOOP + ph)) * rx)
      const y = Math.round(cy + Math.sin(TAU * (2 * f / LOOP + ph)) * ry)
      c.set(x, y, glow > 0.5 ? 0xf6f2a0 : 0xb8c060)
      if (glow > 0.7) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.tint(x + dx, y + dy, 0xd8e070, 0.35)
    }

    if (fly) drawFly(c, fly, f)

    out.push(c.px)
  }

  return out
}

const DART = 'The dragonfly darts: it crosses to its next stop in three frames, too fast to follow, as dragonflies do.'

export const scene: Scene = {
  verb: 'Pondering',
  render,
  hero: 28,
  snaps: [
    { frames: [11, 13], box: [0, 7, 24, 15], colors: [...DRAGON, ...WINGS], why: DART },
    { frames: [21, 23], box: [20, 10, 35, 15], colors: [...DRAGON, ...WINGS], why: DART },
    { frames: [35, 37], box: [24, 2, 36, 15], colors: [...DRAGON, ...WINGS], why: DART },
    { frames: [45, 47], box: [20, 0, 63, 8], colors: [...DRAGON, ...WINGS], why: DART },
  ],
}
