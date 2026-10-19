import { Canvas, TAU, clamp, ease, hash, hex, lerp, mod, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96
const HORIZON = 20

const SKY = hex('34406f 4f4f85 76609a a26e9c cc7f8e e89a7e f6b878 fcd68e fff0c0')
const MESA = hex('2a1a35 3b2140 52294a 6c3350 8c4250 b0584a d07446 e89c58')
const SAND = hex('3c2134 5a2f3e 7c453f a2633f c2834a d9a35a e9c174 f5dc98')
const SHELL = hex('1e1219 37201f 553524 774e2d 9a6a38 bb8a48 d8ac60 eccb82')
const SKIN = hex('1d1a1f 34302c 4e4a3a 6c6849 8d8a5c afa875 cfc792')
const HAT = hex('1e120e 34201a 50301f 6e4228 8c5832 a8723e c48e52')
const BAND = 0x8a2628
const STRAW = hex('3a2420 5e3c2a 86603a ab8448 cca660 e6c882')
const CACTUS = hex('1d2430 263a34 33503a 466a42 62864e')
const SAGE = hex('3a3040 4e4a4c 6a6a58 8c8a66 aeaa7c')

const SUN_X = 49
const SUN_Y = 11

const TX = 21
const TY = 17
const GROUND = 28
const STEP = 12

const nearCam = (f: number) => Math.floor(f / 2)
const midCam = (f: number) => Math.floor(f / 4)

const SHELL_ROWS = [
  [5, 11], [3, 13], [2, 14], [1, 15], [1, 15], [0, 16], [0, 16], [1, 15],
] as const
function isSeam(x: number, y: number): boolean {
  if (y === 3) return x >= 2 && x <= 14
  if (y <= 2) return x === 5 || x === 11
  if (y <= 5) return x === 3 || x === 8 || x === 13
  if (y === 6) return true
  return x % 3 === 1
}

function drawShell(c: Canvas, ox: number, oy: number): void {
  const L = [0.62, -0.62, 0.48] as const
  SHELL_ROWS.forEach(([a, b], y) => {
    for (let x: number = a; x <= b; x++) {
      const nx = (x - 8) / 8.8
      const ny = (y - 7.6) / 8
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
      const lit = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2])
      let level = 1.6 + lit * 4.6
      if (y >= 6) level -= 0.9
      const seam = isSeam(x, y)
      if (seam) level -= 1.5
      else if (y < 6 && !isSeam(x - 1, y) && !isSeam(x + 1, y) && !isSeam(x, y - 1) && !isSeam(x, y + 1) && y > 0) level += 0.6
      if (x === b && y < 6) level += 0.8
      if (x === a && y > 0) level -= 0.6
      c.set(ox + x, oy + y, shade(SHELL, level))
    }
  })
}

type Leg = { hip: number; isNear: boolean; offset: number }
const LEGS: Leg[] = [
  { hip: 4, isNear: false, offset: 0.5 },
  { hip: 12, isNear: false, offset: 0 },
  { hip: 3, isNear: true, offset: 0 },
  { hip: 13, isNear: true, offset: 0.5 },
]

function drawLeg(c: Canvas, f: number, leg: Leg, bob: number): void {
  const phase = mod(f / STEP + leg.offset, 1)
  const isStance = phase < 0.5
  const dx = isStance ? 1.5 - 3 * (phase / 0.5) : -1.5 + 3 * ease.inOut((phase - 0.5) / 0.5)
  const lift = isStance ? 0 : Math.round(Math.sin(Math.PI * ((phase - 0.5) / 0.5)))
  const hipX = TX + leg.hip + (leg.isNear ? 0 : 1)
  const top = TY + 6 + bob
  const footY = GROUND - lift - (leg.isNear ? 0 : 1)
  const base = leg.isNear ? 0 : -1.2
  for (let y = top; y <= footY; y++) {
    const t = (y - top) / Math.max(1, footY - top)
    const x = Math.round(hipX + dx * t)
    const isFoot = y >= footY - 1
    const w = isFoot ? 4 : 3
    for (let i = 0; i < w; i++) {
      const lx = x - 1 + i - (isFoot ? 0 : 0)
      const level = 2.4 + base + (i === w - 1 ? 1.4 : i === 0 ? -0.8 : 0.4) + (isFoot && y === footY ? -0.6 : 0)
      c.set(lx, y, shade(SKIN, level))
    }
    if (isFoot && y === footY && leg.isNear) {
      c.set(x + 3, y, shade(SKIN, 5.4))
      c.set(x + 1, y, shade(SKIN, 4.6))
    }
  }
}

function drawHead(c: Canvas, nod: number, bob: number, blink: number): { x: number; y: number } {
  const hx = TX + 20 + nod
  const hy = TY + 3 + bob
  for (let x = TX + 15; x <= hx - 2; x++) {
    for (let y = hy; y <= hy + 2; y++) c.set(x, y, shade(SKIN, y === hy ? 3.6 : y === hy + 2 ? 1.6 : 2.8))
    c.set(x, hy - 1 + (x > TX + 16 ? 0 : 1), shade(SKIN, 4.2))
  }
  const art = [
    '.3455.',
    '345565',
    '23444m',
    '.2222.',
  ]
  c.sprite(hx - 2, hy - 1, art, {
    '2': shade(SKIN, 1.8), '3': shade(SKIN, 3), '4': shade(SKIN, 4), '5': shade(SKIN, 5), '6': shade(SKIN, 6),
    'm': shade(SKIN, 1.2),
  })
  const ex = hx + 1
  const ey = hy
  if (blink > 0.5) {
    c.set(ex, ey, shade(SKIN, 1.2))
    c.set(ex + 1, ey, shade(SKIN, 1.6))
  } else {
    c.set(ex, ey, 0x14100e)
    c.set(ex, ey - 1, shade(SKIN, 2.6))
    c.set(ex + 1, ey - 1, shade(SKIN, 3.2))
  }
  return { x: hx + 0.5, y: hy - 1.5 }
}

function drawHat(c: Canvas, cx: number, cy: number, angle: number, squash = 0): void {
  const cs = Math.cos(angle)
  const sn = Math.sin(angle)
  for (let y = Math.floor(cy - 6); y <= Math.ceil(cy + 6); y++) {
    for (let x = Math.floor(cx - 6); x <= Math.ceil(cx + 6); x++) {
      const dx = x - cx
      const dy = y - cy
      const u = dx * cs + dy * sn
      const v = (-dx * sn + dy * cs) * (1 + squash)
      const curl = Math.abs(u) > 2.8 ? (Math.abs(u) - 2.8) * 0.75 : 0
      const isBrim = Math.abs(u) <= 4.5 && v >= -0.5 - curl && v <= 0.5 - curl
      const half = 2.3 - (-v - 0.5) * 0.15 - (v < -2.6 ? 0.5 : 0)
      const isCrown = v < -0.4 && v >= -3.4 && Math.abs(u) <= half
      if (!isBrim && !isCrown) continue
      const isBand = isCrown && v > -1.5
      const side = dx > 0.6 ? 1.3 : dx < -0.8 ? -0.9 : 0.2
      if (isBand) c.set(x, y, side > 1 ? 0xb8443a : BAND)
      else if (isBrim) c.set(x, y, shade(HAT, 2.6 + side + (v > 0 && !isCrown ? -0.8 : 0)))
      else c.set(x, y, shade(HAT, 3.6 + side + (v < -2.6 ? (Math.abs(u) < 0.6 ? -1 : 0.7) : 0)))
    }
  }
}

const R = 4.6
type Contact = { f: number; x: number; y: number; hop: number }
const CONTACTS: Contact[] = [
  { f: 6, x: -14, y: GROUND - R, hop: 4 },
  { f: 14, x: -1.2, y: GROUND - R, hop: 4.5 },
  { f: 22, x: 11.6, y: GROUND - R, hop: 3.5 },
  { f: 31, x: 26, y: 13.6, hop: 8 },
  { f: 48, x: 53.2, y: GROUND - R, hop: 3.5 },
  { f: 56, x: 66, y: GROUND - R, hop: 2 },
  { f: 62, x: 75.6, y: GROUND - R, hop: 0 },
]
function tumbleweed(f: number): { x: number; y: number; height: number } | undefined {
  for (let i = 0; i + 1 < CONTACTS.length; i++) {
    const a = CONTACTS[i]
    const b = CONTACTS[i + 1]
    if (!a || !b || f < a.f || f >= b.f) continue
    const t = (f - a.f) / (b.f - a.f)
    const y = lerp(a.y, b.y, t) - a.hop * 4 * t * (1 - t)
    return { x: lerp(a.x, b.x, t), y, height: GROUND - R - y }
  }
  return undefined
}

const STRANDS = Array.from({ length: 6 }, (_, i) => {
  const a = (i / 6) * TAU + hash(i, 3) * 0.6
  const d = 0.7 + hash(i, 4) * 1.1
  return { x: Math.cos(a) * d, y: Math.sin(a) * d, r: 2.2 + hash(i, 5) * 1.3 }
})

function drawTumbleweed(c: Canvas, x0: number, y0: number, angle: number): void {
  const cs = Math.cos(angle)
  const sn = Math.sin(angle)
  for (let y = Math.floor(y0 - R - 1); y <= Math.ceil(y0 + R + 1); y++) {
    for (let x = Math.floor(x0 - R - 1); x <= Math.ceil(x0 + R + 1); x++) {
      const dx = x - x0
      const dy = y - y0
      const d = Math.hypot(dx, dy)
      if (d > R + 0.3) continue
      const u = dx * cs + dy * sn
      const v = -dx * sn + dy * cs
      let isTwig = d < 0.9
      for (const s of STRANDS) if (Math.abs(Math.hypot(u - s.x, v - s.y) - s.r) < 0.36) isTwig = true
      if (d > R - 0.6 && hash(Math.round(Math.atan2(v, u) * 3) + 20, 9) < 0.45) isTwig = true
      if (!isTwig) continue
      const lit = (dx * 0.6 - dy * 0.6) / R
      c.set(x, y, shade(STRAW, 2.6 + lit * 2.2 - (d < 2 ? 1 : 0)))
    }
  }
}

type Dust = { born: number; x: number; y: number; size: number }
const DUST: Dust[] = [
  { born: 14, x: -1.2, y: GROUND - 0.5, size: 1.4 },
  { born: 22, x: 11.6, y: GROUND - 0.5, size: 1.6 },
  { born: 48, x: 53.2, y: GROUND - 0.5, size: 1.8 },
  { born: 56, x: 66, y: GROUND - 0.5, size: 1.3 },
]

const SAGUARO = [
  '...44..',
  '..3444.',
  '..3444.',
  '..344.4',
  '4.344.4',
  '4.3444.',
  '4.344..',
  '.3344..',
  '..344..',
  '..344..',
  '..344..',
  '..344..',
]

function drawBackdrop(c: Canvas): void {
  for (let y = 0; y < HORIZON; y++) {
    for (let x = 0; x < W; x++) {
      const glow = Math.max(0, 1 - Math.hypot((x - SUN_X) * 0.8, (y - SUN_Y) * 1.4) / 22)
      c.set(x, y, shade(SKY, (y / HORIZON) * 6.4 + glow * 3.2))
    }
  }
  for (const [x0, y0, w] of [[4, 4, 14], [10, 5, 9], [30, 2, 11], [52, 3, 8]] as const) {
    for (let x = x0; x < x0 + w; x++) {
      c.set(x, y0, shade(SKY, 6.6 - (x === x0 || x === x0 + w - 1 ? 0.8 : 0)))
      if (x > x0 + 2 && x < x0 + w - 3) c.set(x, y0 + 1, shade(SKY, 4.6))
    }
  }
  for (let y = SUN_Y - 4; y <= SUN_Y + 4; y++) {
    for (let x = SUN_X - 4; x <= SUN_X + 4; x++) {
      const d = Math.hypot(x - SUN_X, y - SUN_Y)
      if (d < 3.3) c.set(x, y, d < 2.2 ? 0xfffbe6 : 0xffeaa8)
    }
  }
  const mesas: { x0: number; x1: number; top: number; talus: number; haze: number }[] = [
    { x0: -3, x1: 19, top: 8, talus: 4, haze: 0 },
    { x0: 25, x1: 33, top: 14, talus: 3, haze: 0.8 },
    { x0: 52, x1: 60, top: 12, talus: 3, haze: 0.2 },
  ]
  for (const m of mesas) {
    for (let x = m.x0 - m.talus; x <= m.x1 + m.talus; x++) {
      const outside = x < m.x0 ? m.x0 - x : x > m.x1 ? x - m.x1 : 0
      const top = m.top + (outside > 0 ? Math.round(outside * ((HORIZON - m.top) / (m.talus + 1)) * 0.9 + 1) : 0)
      for (let y = top; y < HORIZON; y++) {
        const isLit = x >= m.x1 - 2 && x <= m.x1 + m.talus
        const isRim = y === top && x <= m.x1
        let level = isLit ? 4.6 : 2.2 + (y - top) * 0.05
        if (isRim) level += 1.4
        if ((y - m.top) % 4 === 3 && outside === 0 && !isLit) level -= 0.6
        c.set(x, y, shade(MESA, level + m.haze))
      }
    }
  }
  for (let y = HORIZON - 1; y < HORIZON + 2; y++) {
    for (let x = 0; x < W; x++) {
      const glow = Math.max(0, 1 - Math.abs(x - SUN_X) / 30)
      c.set(x, y, shade(SAND, 3 + (y - HORIZON) * 0.6 + glow * 1.4))
    }
  }
  c.sprite(7, 8, SAGUARO, { '3': CACTUS[1] ?? 0, '4': CACTUS[2] ?? 0 })
  for (let y = 8; y < 20; y++) {
    const row = SAGUARO[y - 8] ?? ''
    const right = row.lastIndexOf('4')
    if (right >= 0) c.set(7 + right, y, CACTUS[4] ?? 0)
  }
}

function render(): Int32Array[] {
  const backdrop = new Canvas()
  drawBackdrop(backdrop)
  const out: Int32Array[] = []

  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    c.px.set(backdrop.px)
    const cam = nearCam(f)
    const mcam = midCam(f)

    for (let y = HORIZON + 2; y < 24; y++) {
      for (let x = 0; x < W; x++) c.set(x, y, shade(SAND, 4.1 + (y - HORIZON) * 0.15))
    }
    for (let x = -6; x < W + 6; x++) {
      const u = mod(x + mcam, 24)
      if (u === 3 || u === 15) {
        const big = u === 3
        const by = big ? 22 : 21
        c.set(x - 2, by + 1, shade(SAND, 2.6))
        for (const [dx, dy, l] of big
          ? [[0, 0, 2.4], [1, 0, 3.4], [2, 0, 3], [-1, 1, 1.8], [0, 1, 2.2], [1, 1, 2.8], [2, 1, 3.6], [3, 1, 2.4]] as const
          : [[0, 0, 2.6], [1, 0, 3.4], [0, 1, 2], [1, 1, 3]] as const) c.set(x + dx, by + dy, shade(SAGE, l))
      }
      if (u === 9) {
        c.set(x, 23, shade(MESA, 3.6))
        c.set(x + 1, 23, shade(MESA, 5.4))
      }
    }

    for (let y = 24; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const u = mod(x + cam, 48)
        let level = y < 27 ? 4.6 : 5.2
        const ripple = mod(u + (y % 3) * 7, 16)
        if ((y === 25 || y === 28 || y === 30) && ripple >= 2 && ripple <= 4) level += ripple === 3 ? 0.8 : 0.5
        if ((y === 26 || y === 29 || y === 31) && ripple >= 1 && ripple <= 3) level -= 0.6
        c.set(x, y, shade(SAND, level))
      }
    }
    for (let x = -4; x < W + 4; x++) {
      const u = mod(x + cam, 48)
      if (u === 6 || u === 31) {
        const py = u === 6 ? 30 : 26
        c.set(x, py, shade(MESA, 3.4))
        c.set(x + 1, py, shade(MESA, 5.6))
        c.set(x - 1, py, shade(SAND, 3))
      }
      if (u === 20) {
        for (const [dx, dy, l] of [[0, 0, 3], [1, -1, 3.6], [1, 0, 2.4], [2, -2, 4], [2, -1, 3], [3, -1, 3.8], [4, 0, 2.8], [-1, 0, 2.2]] as const) {
          c.set(x + dx, 31 + dy, shade(SAGE, l))
        }
      }
      if (u === 41) {
        for (const [dx, dy, l] of [[0, 0, 2.6], [1, -1, 3.4], [2, 0, 3.6], [1, 0, 2.4]] as const) c.set(x + dx, 25 + dy, shade(SAGE, l))
      }
    }

    const bob = mod(f, 6) >= 3 ? 1 : 0
    for (let y = 26; y <= 29; y++) {
      for (let x = TX - 14; x <= TX + 14; x++) {
        const d = Math.hypot((x - (TX + 2)) / 15, (y - 27.6) / 1.7)
        if (d < 1) c.set(x, y, shade(SAND, d > 0.8 ? 2.6 : 2))
      }
    }
    const tw = tumbleweed(f)
    if (tw) {
      const sx = tw.x - 6 - tw.height * 1.3
      const k = clamp(1 - tw.height / 18)
      for (let x = Math.floor(sx - 5); x <= Math.ceil(sx + 5); x++) {
        for (let y = 27; y <= 28; y++) if (Math.abs(x - sx) < 4.5 * k + (y === 28 ? 0 : -1)) c.set(x, y, shade(SAND, 2.6))
      }
    }

    for (const leg of LEGS) if (!leg.isNear) drawLeg(c, f, leg, bob)
    c.set(TX - 1, TY + 6 + bob, shade(SKIN, 2.4))
    c.set(TX - 2, TY + 7 + bob, shade(SKIN, 1.8))
    drawShell(c, TX, TY + bob)
    for (const leg of LEGS) if (leg.isNear) drawLeg(c, f, leg, bob)
    const nod = mod(f + 1, 6) < 3 ? 1 : 0
    const blink = f >= 70 && f <= 73 ? 1 : 0
    const head = drawHead(c, nod, bob, blink)

    const FLICK = 40
    const LANDS = 64
    if (f >= FLICK && f < LANDS) {
      const t = (f - FLICK) / (LANDS - FLICK)
      const rise = 11 * Math.sin(Math.PI * t) ** 1.3
      const angle = -TAU * ease.inOut(t) * 1
      drawHat(c, head.x + 0.5 * Math.sin(t * Math.PI), head.y - 1.2 - rise, angle)
    } else {
      const settle = f >= LANDS && f < LANDS + 3 ? [0.35, -0.12, 0.05][f - LANDS] ?? 0 : 0
      drawHat(c, head.x, head.y - 1.2 + (settle > 0 ? 0.4 : 0), -0.12, settle)
    }

    for (const d of DUST) {
      const age = f - d.born
      if (age < 0 || age > 12) continue
      const k = age / 12
      const r = d.size * (0.6 + k * 1.2)
      const px = d.x + age * 0.5
      const py = d.y - 1 - age * 0.15
      for (let y = Math.floor(py - r); y <= Math.ceil(py + r); y++) {
        for (let x = Math.floor(px - r * 1.4); x <= Math.ceil(px + r * 1.4); x++) {
          const dd = Math.hypot((x - px) / 1.4, y - py) / r
          if (dd > 1 || ((dd > 0.6 || k > 0.5) && ((x + y) & 1) === 0)) continue
          c.set(x, y, shade(SAND, 6 - k * 1.2 + (x > px ? 0.5 : 0)))
        }
      }
    }

    if (tw) drawTumbleweed(c, tw.x, tw.y, tw.x / R)
    out.push(c.px)
  }

  return out
}

export const scene: Scene = { verb: 'Moseying', render, hero: 46 }
