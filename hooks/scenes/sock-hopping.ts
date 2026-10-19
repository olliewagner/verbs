import { Canvas, beat, clamp, ease, frames, hash, hex, lerp, mix, mod, shade, type Ramp, type Scene } from '../engine'

const W = 64
const LOOP = 48
const BEAT = 6

const WALL = hex('0b0b1c 121230 1a1a42 23245a')
const BLEACH = hex('1c120e 2c1b12 40281a 573722 6e4a2c 8a5f38')
const LIGHT_TILE = hex('1e1a2a 2c2640 3e3656 56496a 76627e 9a7e8e c2a4a2 e2c8b6')
const DARK_TILE = hex('0a0810 110d18 18121f 20182a 2a2036')
const WHITE = hex('4c4c6c 8a8aac c6c4d6 ece8ea fffdf6')
const PINK = hex('5a1e44 963a6c cc6896 f09cbc ffcadb')
const STRIPE_RED = hex('6a1424 a8283a d8464a')
const STRIPE_NAVY = hex('121a40 23336e 3a50a0')
const HOLLOW = hex('140e1c 2a2034')
const CREPE: Ramp[] = [hex('8a2a5a d0548a f08ab4'), hex('1e6a5a 3aa88a 7adcb8'), hex('9a6a10 dcac2a f6dc6a'), hex('24508a 4a86c8 8ac0ee')]
const BALLOON: Ramp[] = [hex('7a1a4a c83a7a f07aaa'), hex('1a6a5a 34a88a 8ae0c4'), hex('8a6a0a d6aa1e f6de6a')]
const HOOP = hex('2a2a3c 4a4a5e 6e6e84')
const RIM = hex('7a2a10 c4561c')
const SPARK = hex('f6dc6a fffbe0')
const OUTLINE = 0x0d0a16

const pulse = (f: number) => (f >= 31 && f < 42 ? 0 : mod(f - 3, BEAT) < 2 ? 1 : 0)
const flash = (f: number) => (f === 36 ? 1 : f === 37 ? 0.5 : 0)

const twist = (f: number) => Math.sin((Math.PI * 2 * f) / (BEAT * 2)) * (f < 42 ? 1 - beat(f, 26, 29) : beat(f, 42, 45))
function crouch(f: number): number {
  if (f < 6) return 0
  if (f < 18) return lerp(0, 3, ease.inOut(beat(f, 6, 18)))
  if (f < 26) return lerp(3, 1, ease.inOut(beat(f, 18, 26)))
  if (f < 31) return lerp(1, 4, beat(f, 26, 29))
  if (f < 46) return HOP[f - 31] ?? 0
  return lerp(0.5, 0, beat(f, 46, 48))
}
const HOP = [1, -1, -2, -2, -1, 0, 0, 0, -1, -2, -2, 0, 3, 3, 1.5]
const AIR = 11
const lift = (f: number) => (f >= 31 && f < 31 + AIR ? Math.round(8 * Math.sin((Math.PI * (f - 31)) / AIR)) : 0)
const spin = (f: number) => (f >= 32 && f < 41 ? Math.sin(((f - 32) / 8) * Math.PI * 2) : 0)
const lean = (f: number) => (f >= 31 && f < 31 + AIR ? Math.round(5 * Math.sin((Math.PI * (f - 31)) / AIR)) : 0)

type Sock = {
  x: number
  height: number
  body: Ramp
  kind: 'tube' | 'bobby'
  side: 1 | -1
}
const SOCKS: Sock[] = [
  { x: 24, height: 15, body: WHITE, kind: 'tube', side: 1 },
  { x: 40, height: 12, body: PINK, kind: 'bobby', side: -1 },
]
const FLOOR_Y = 27

function drawRoom(c: Canvas, f: number): void {
  const p = pulse(f)
  const beam = (x: number, y: number) => (Math.abs(x - 32) < 5 + y * 0.8 ? 0.7 + p * 0.5 + flash(f) : 0)
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < W; x++) c.set(x, y, shade(WALL, 2.4 - Math.abs(x - 32) / 26 - y * 0.06 + beam(x, y) * 0.8, x, y))
  }
  for (let y = 1; y <= 6; y++) {
    for (let x = 50; x <= 60; x++) {
      const isFrame = y === 1 || y === 6 || x === 50 || x === 60
      const isBox = (y === 3 || y === 5) && x >= 53 && x <= 57 || (x === 53 || x === 57) && y >= 3 && y <= 5
      c.set(x, y, HOOP[isFrame || isBox ? 2 : 1] ?? 0)
    }
  }
  for (let x = 53; x <= 57; x++) c.set(x, 7, RIM[x === 53 ? 0 : 1] ?? 0)
  for (let y = 8; y <= 9; y++) for (let x = 53 + (y - 8); x <= 57 - (y - 8); x++) if ((x + y) % 2 === 0) c.set(x, y, HOOP[2] ?? 0)

  for (let y = 9; y < 15; y++) {
    for (let x = 0; x < W; x++) {
      const isEdge = (y - 9) % 2 === 0
      const level = (isEdge ? 3.4 : 1.8) - Math.abs(x - 32) / 30 + (y === 14 ? -1.6 : 0)
      c.set(x, y, shade(BLEACH, level + beam(x, y) * 0.9, x, y))
    }
  }

  for (let y = 15; y < 32; y++) {
    for (let x = 0; x < W; x++) c.set(x, y, floorColor(x, y, f, 0))
  }
}

function floorColor(x: number, y: number, f: number, darken: number): number {
  const dz = y - 2
  const u = ((x - 31.5) * 2.4) / dz
  const v = (36 * 2.4) / dz
  const isLight = (Math.floor(u) + Math.floor(v)) % 2 === 0
  const pool = clamp(1 - ((x - 32) / 27) ** 2 - ((y - 25) / 9) ** 2)
  const light = pool * (1 + flash(f) * 0.5) + (pool > 0.55 ? pulse(f) * 0.18 : 0)
  return isLight ? shade(LIGHT_TILE, 0.4 + light * 5.2 - darken, x, y) : shade(DARK_TILE, 0.2 + light * 3.6 - darken * 0.7, x, y)
}

function drawDecor(c: Canvas, f: number): void {
  const swags = [
    { period: 21, phase: 0, top: 0, sag: 4, ramp: 0 },
    { period: 21, phase: 10, top: 1, sag: 3, ramp: 1 },
  ]
  for (const s of swags) {
    const ramp = CREPE[s.ramp] ?? []
    for (let x = 0; x < W; x++) {
      const t = mod(x + s.phase, s.period) / s.period
      const y = Math.round(s.top + s.sag * (1 - (t * 2 - 1) ** 2))
      const color = ramp[mod(x + s.phase, 4) < 2 ? 2 : 1] ?? 0
      c.set(x, y, color)
      c.set(x, y + 1, color)
    }
    for (let low = mod(-s.phase + s.period / 2, s.period); low < W; low += s.period) {
      const x0 = Math.round(low)
      const y0 = Math.round(s.top + s.sag) + 2
      const swing = Math.sin((Math.PI * 2 * f) / (BEAT * 2) + low * 0.7) * 1.4
      for (let k = 0; k < 6; k++) {
        const x = Math.round(x0 + swing * (k / 5) ** 1.5)
        c.set(x, y0 + k, ramp[k < 3 ? 1 : 0] ?? 0)
      }
    }
  }
  const balloons = [[4, 3, 0, 0], [9, 2, 1, 1.7], [6, 7, 2, 3.1]] as const
  for (const [bx, by, k, phase] of balloons) {
    const ramp = BALLOON[k] ?? []
    const dy = Math.round(Math.sin((Math.PI * 2 * f) / LOOP * 2 + phase) * 0.7)
    for (let y = -3; y <= 3; y++) {
      for (let x = -2; x <= 2; x++) {
        if ((x / 2.5) ** 2 + (y / 3) ** 2 > 1) continue
        const level = 1.2 - x * 0.35 - y * 0.25
        c.set(bx + x, by + y + dy, ramp[Math.round(clamp(level, 0, 2))] ?? 0)
      }
    }
    c.set(bx - 1, by - 1 + dy, 0xfff4f8)
    c.set(bx, by + 4 + dy, ramp[0] ?? 0)
  }
}

type Px = { x: number; y: number; color: number }

function sockPixels(s: Sock, f: number): Px[] {
  const out: Px[] = []
  const toe = spin(f) !== 0 ? spin(f) * s.side : twist(f) * s.side
  const squash = crouch(f)
  const h = Math.round(s.height - squash)
  const wide = squash >= 3 ? 1 : 0
  const base = FLOOR_Y - 1 - lift(f)
  const cx = s.x + lean(f) * s.side
  const dir = toe > 0.35 ? 1 : toe < -0.35 ? -1 : 0
  const topShift = -toe * (2.2 + squash * 0.4)
  const put = (x: number, y: number, color: number) => out.push({ x, y, color })

  for (let r = 0; r < h; r++) {
    const y = base - (h - 1) + r
    const fromFoot = h - 1 - r
    const shift = Math.round(topShift * clamp((fromFoot - 2) / (h - 3)))
    let x0 = cx - 2 - wide + shift
    let x1 = cx + 2 + wide + shift
    if (fromFoot <= 2) {
      if (dir !== 0) {
        const reach = fromFoot === 2 ? 1 : 3
        if (dir > 0) x1 += reach
        else x0 -= reach
      } else if (fromFoot <= 1) {
        x0 -= 1
        x1 += 1
      }
    }
    for (let x = x0; x <= x1; x++) {
      const k = (x - x0) / Math.max(1, x1 - x0)
      let level = k < 0.15 ? 3.6 : k > 0.85 ? 1.4 : 2.8
      if (fromFoot === 0) level -= 1
      let color = shade(s.body, level, x, y)
      if (r === 0) {
        if (x === x0 || x === x1) continue
        color = shade(s.body, level + 0.6, x, y)
      } else if (r === 1) {
        color = x === x0 || x === x1 ? shade(s.body, level + 0.4, x, y) : HOLLOW[x === x0 + 1 ? 1 : 0] ?? 0
      } else if (s.kind === 'tube') {
        if (r === 2 || r === 3) color = shade(s.body, level - ((x - shift) % 2 === 0 ? 0.6 : 0), x, y)
        if (r === 4) color = shade(STRIPE_RED, level * 0.7, x, y)
        if (r === 6) color = shade(STRIPE_NAVY, level * 0.7, x, y)
      } else if (r >= 2 && r <= 3) {
        color = shade(WHITE, level + 0.6, x, y)
      }
      put(x, y, color)
    }
    if (s.kind === 'bobby' && r === 4) {
      for (let x = x0 - 1; x <= x1 + 1; x++) if ((x + r) % 2 === 0) put(x, y, shade(WHITE, 3, x, y))
    }
  }

  return out
}

function drawSock(c: Canvas, s: Sock, f: number): void {
  const pixels = sockPixels(s, f)
  const air = lift(f)
  const cx = s.x + lean(f) * s.side
  const rx = Math.max(1.5, 5 - air * 0.35)
  for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    c.set(x, FLOOR_Y, floorColor(x, FLOOR_Y, f, air > 5 ? 1 : 2))
    if (Math.abs(x - cx) < rx - 1.5) c.set(x, FLOOR_Y + 1, floorColor(x, FLOOR_Y + 1, f, 1))
  }
  const ghost = [mix(s.body[2] ?? 0, LIGHT_TILE[4] ?? 0, 0.55), mix(s.body[1] ?? 0, DARK_TILE[2] ?? 0, 0.65)]
  for (const p of pixels) {
    const ry = 2 * FLOOR_Y - 1 - p.y
    if (ry <= FLOOR_Y + 1 || ry >= 32) continue
    const dz = ry - 2
    const isLight = (Math.floor(((p.x - 31.5) * 2.4) / dz) + Math.floor((36 * 2.4) / dz)) % 2 === 0
    c.set(p.x, ry, ghost[isLight ? 0 : 1] ?? 0)
  }
  const has = new Set(pixels.map(p => p.y * W + p.x))
  for (const p of pixels) {
    if (!has.has(p.y * W + p.x + 1)) c.set(p.x + 1, p.y, OUTLINE)
  }
  for (const p of pixels) c.set(p.x, p.y, p.color)
}

function drawClink(c: Canvas, f: number): void {
  if (f < 35 || f > 39) return
  const x = 33
  const y = FLOOR_Y - 1 - lift(f) - 12
  const r = f - 35
  if (r < 2) {
    for (let k = -2 + r; k <= 2 - r; k++) {
      c.set(x + k, y, SPARK[Math.abs(k) < 1 ? 1 : 0] ?? 0)
      c.set(x, y + k, SPARK[Math.abs(k) < 1 ? 1 : 0] ?? 0)
    }
  }
  for (const [dx, dy] of [[1, -1], [-1, -1], [1, 1], [-1, 1], [0, -1.4], [1.4, 0], [-1.4, 0]] as const) {
    if (r >= 1 && hash(dx * 7, dy * 5, f) < 0.85) c.set(x + dx * (r + 1.5), y + dy * (r + 1.5), SPARK[r > 2 ? 0 : 1] ?? 0)
  }
}

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    drawRoom(c, f)
    drawDecor(c, f)
    for (const s of SOCKS) drawSock(c, s, f)
    drawClink(c, f)
  })
}

export const scene: Scene = {
  verb: 'Sock-hopping',
  render,
  hero: 35,
  snaps: [
    { frames: 35, box: [31, 5, 35, 9], colors: SPARK, why: 'The clink as they bump at the top of the hop: a star that is there at once.' },
    { frames: 36, box: [18, 19, 47, 29], colors: LIGHT_TILE.slice(6, 8), why: 'The floor flashes on the bump.' },
  ],
}
