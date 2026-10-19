import { beat, clamp, ease, frames, hash, hex, lightAt, shade, smoothstep, threshold, wave, type Light, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72
const FLOOR_Y = 11

const COOL = hex('05050b 0a0b17 10132a 172038 1e2e4a 26425e 305a74 427c90 6aa8b4 a8dcd8')
const WARM = hex('05050b 0a0b17 10132a 1c1a32 2c2236 422c3a 5e3c3e 805444 a87050 d09a64')
const ENERGY = hex('0c3446 106676 1a9aa8 3ccad0 8cf0ea e8fffa')
const VIOLET = hex('2a1450 4a2a86 7a50c0 b48ae8')
const FLAME = hex('7a2410 d0581c f4a434 fde49a fffbe8')
const WAX = hex('4a3a40 8a7470 c8b4a0 ece0c8')
const SMOKE = hex('1c1c2a 2c2c3e 3e3e52')

const CX = 32
const CY = 22
const ORB_X = 32
const ORB_Y = 10

const OUTER = { rx: 24.5, ry: 8 }
const INNER = { rx: 18, ry: 4.8 }
const MID = { rx: 21.2, ry: 6.4 }
const RUNES = [
  ['x.x', '.x.'], ['xxx', 'x.x'], ['.x.', 'xxx'], ['x..', 'xxx'],
  ['xx.', '.xx'], ['x.x', 'xxx'], ['.xx', 'xx.'], ['xxx', '..x'],
]
const RUNE_START = 6
const RUNE_GAP = 3
const runeAngle = (k: number) => Math.PI / 2 + (k * Math.PI * 2) / RUNES.length

const CANDLES = [
  { x: 12, y: 13, h: 2, w: 1, relight: 64 },
  { x: 52, y: 13, h: 2, w: 1, relight: 66 },
  { x: 4, y: 28, h: 4, w: 2, relight: 68 },
  { x: 58, y: 28, h: 4, w: 2, relight: 70 },
]

const BURST = 40
const PILLARS: [number, number, number][] = [[2, 6, 1], [57, 61, -1]]

const ringRun = (f: number) => clamp((f - RUNE_START) / (RUNE_GAP * RUNES.length))
const ringOn = (f: number) => 1 - smoothstep(59, 68, f)
const sealRun = (f: number) => beat(f, 28, 37)

function orbRadius(f: number): number {
  if (f < BURST || f > 64) return 0
  if (f < BURST + 4) return 2 + ease.outBack(beat(f, BURST, BURST + 4)) * 2.2
  if (f < 56) return 4.2 + wave(f - BURST, 16, 2) * 0.5
  if (f < 59) return 4.2 + ease.out(beat(f, 56, 59)) * 0.8
  return 5 * (1 - ease.in(beat(f, 59, 64)))
}

const fade = (on: number) => Math.min(1, on / 0.4)
const isGlowing = (x: number, y: number, on: number) => threshold(x, y) < fade(on)
const isCandleLit = (f: number, i: number) => f < BURST || f >= (CANDLES[i]?.relight ?? 0)
function ellipsePoints(rx: number, ry: number, from: number, to: number): [number, number, number][] {
  const out: [number, number, number][] = []
  const seen = new Set<number>()
  for (let a = from; a <= to; a += 0.01) {
    const x = Math.round(CX + rx * Math.cos(a))
    const y = Math.round(CY + ry * Math.sin(a))
    if (seen.has(y * W + x)) continue
    seen.add(y * W + x)
    out.push([x, y, a])
  }
  return out
}
function render(): Int32Array[] {
  const outerPts = ellipsePoints(OUTER.rx, OUTER.ry, Math.PI / 2, Math.PI / 2 + Math.PI * 2)
  const innerPts = ellipsePoints(INNER.rx, INNER.ry, Math.PI / 2, Math.PI / 2 + Math.PI * 2)
  const sealPts = ellipsePoints(8, 2.2, -Math.PI / 2, Math.PI * 1.5)
  const SEAL = { rx: 8, ry: 2.2 }
  const spokes: [number, number, number, number][] = [
    [CX - SEAL.rx - 1, CY, CX - INNER.rx + 1, CY], [CX + SEAL.rx + 1, CY, CX + INNER.rx - 1, CY],
    [CX, CY - SEAL.ry - 1, CX, CY - INNER.ry + 1], [CX, CY + SEAL.ry + 1, CX, CY + INNER.ry - 1],
  ]
  return frames(LOOP, (c, f) => {
    const run = ringRun(f)
    const on = ringOn(f)
    const hue = Math.max(on, 0.4)
    const r = orbRadius(f)
    const flash = f === BURST ? 1 : f === BURST + 1 ? 0.5 : 0

    const cool: Light[] = []
    RUNES.forEach((_, k) => {
      const age = f - (RUNE_START + k * RUNE_GAP)
      if (age < 0) return
      const a = runeAngle(k)
      cool.push({ x: CX + MID.rx * Math.cos(a), y: CY + MID.ry * Math.sin(a), power: ([0.9, 0.75, 0.6][age] ?? 0.5) * on, radius: 9 })
    })
    const orbLight = f < BURST ? 0 : f < 59 ? 1 : 1 - smoothstep(59, 67, f)
    if (orbLight > 0) {
      const size = f < 59 ? r : 5 * orbLight
      cool.push({ x: ORB_X, y: ORB_Y, power: (0.55 + size * 0.14) * Math.min(1, orbLight * 1.6) + flash * 1.5, radius: 30 + size * 4 })
    }
    if (sealRun(f) > 0) cool.push({ x: CX, y: CY, power: 0.5 * sealRun(f) * on, radius: 14 })
    const warm: Light[] = CANDLES.flatMap((k, i) => {
      if (!isCandleLit(f, i)) return []
      const flicker = 0.85 + 0.15 * hash(f, i)
      return [{ x: k.x + k.w / 2, y: k.y - k.h, power: 0.55 * flicker, radius: k.w > 1 ? 12 : 9 }]
    })
    const lit = (x: number, y: number, base: number) => {
      const a = lightAt(cool, x, y)
      const b = lightAt(warm, x, y)
      return a >= b ? shade(COOL, base + a * 4.2) : shade(WARM, base + b * 4.6)
    }

    for (let y = 0; y < FLOOR_Y; y++) {
      for (let x = 0; x < W; x++) {
        const row = Math.floor(y / 3)
        const bx = (x + (row % 2) * 5) % 10
        const isMortar = y % 3 === 2 || bx === 0
        const isPillar = (x >= 2 && x <= 6) || (x >= 57 && x <= 61)
        if (isPillar) continue
        const tone = (hash(Math.floor((x + (row % 2) * 5) / 10), row) - 0.5) * 0.5
        c.set(x, y, lit(x, y, 1.6 + tone - (isMortar ? 0.8 : 0)))
      }
    }
    const joints = [FLOOR_Y, 13, 16, 20, 25, 31]
    for (let y = FLOOR_Y; y < H; y++) {
      const band = joints.findIndex((j, i) => y >= j && y < (joints[i + 1] ?? 99))
      const scale = (y + 16) / (31 + 16)
      for (let x = 0; x < W; x++) {
        const u = (x - 32) / scale / 11 + (band % 2) * 0.5
        const isJoint = y === joints[band] || Math.abs(u - Math.round(u)) < 0.5 / (11 * scale)
        const tone = (hash(Math.floor(u + 0.5), band, 3) - 0.5) * 0.4
        c.set(x, y, lit(x, y, 1.9 + tone - (isJoint ? 0.6 : 0) + (y === FLOOR_Y ? -0.6 : 0)))
      }
    }
    for (const [x0, x1, face] of PILLARS) {
      for (let y = 0; y <= FLOOR_Y + 1; y++) {
        for (let x = x0; x <= x1; x++) {
          const edge = face > 0 ? (x === x1 ? 1.4 : x === x0 ? -0.6 : 0) : x === x0 ? 1.4 : x === x1 ? -0.6 : 0
          c.set(x, y, lit(x, y, 1.9 + edge - (y % 6 === 5 ? 0.6 : 0)))
        }
      }
      for (let x = x0 - 1; x <= x1 + 1; x++) c.set(x, FLOOR_Y + 2, lit(x, FLOOR_Y + 2, 1.4))
    }

    const runAngle = Math.PI / 2 + run * Math.PI * 2
    for (const pts of [outerPts, innerPts]) {
      for (const [x, y, a] of pts) {
        const isLit = a <= runAngle && run > 0 && on > 0.02
        if (isLit) {
          const isHead = runAngle - a < 0.25 && run < 1
          const glow = shade(ENERGY, (isHead ? 5 : 2.2 + (y > CY ? 0.5 : 0) + (r > 0 ? 0.4 : 0)) * hue + (1 - hue) * 0.5)
          c.set(x, y, isGlowing(x, y, on) ? glow : lit(x, y, 2.9))
        } else {
          c.set(x, y, lit(x, y, 2.9))
        }
      }
    }
    RUNES.forEach((glyph, k) => {
      const a = runeAngle(k)
      const gx = Math.round(CX + MID.rx * Math.cos(a) - 1)
      const gy = Math.round(CY + MID.ry * Math.sin(a) - 0.5)
      const age = f - (RUNE_START + k * RUNE_GAP)
      const level = age < 0 || on <= 0.02 ? -1 : age === 0 ? 5.4 : age === 1 ? 4.8 : 4 + (r > 0 ? 0.6 : 0)
      c.sprite(gx, gy, glyph, {
        x: (px: number, py: number) => (level < 0 || !isGlowing(px, py, on) ? lit(px, py, 2.7) : shade(ENERGY, level * hue + (1 - hue) * 1.5)),
      })
    })
    const seal = sealRun(f)
    if (seal > 0 && on > 0.02) {
      const sealLevel = (f >= BURST ? 3.4 : 2.6) * hue
      const cut = Math.floor(sealPts.length * seal)
      sealPts.slice(0, cut).forEach(([x, y]) => isGlowing(x, y, on) && c.set(x, y, shade(ENERGY, sealLevel)))
      const reach = clamp(seal * 1.6 - 0.6)
      for (const [ax, ay, bx, by] of spokes) {
        if (reach > 0) c.line(ax, ay, ax + (bx - ax) * reach, ay + (by - ay) * reach, (x, y) => (isGlowing(x, y, on) ? shade(ENERGY, sealLevel - 0.4) : c.get(x, y)))
      }
      if (seal > 0.5 && isGlowing(CX, CY, on)) c.set(CX, CY, shade(ENERGY, sealLevel + 1))
    }

    CANDLES.forEach((k, i) => {
      for (let y = k.y - k.h + 1; y <= k.y; y++) {
        for (let x = k.x; x < k.x + k.w; x++) {
          const glow = isCandleLit(f, i) ? 1.4 : 0
          const side = k.w > 1 ? (x === k.x + (k.x < CX ? 1 : 0) ? 0.6 : -0.4) : 0
          c.set(x, y, shade(WAX, 0.6 + glow + side + (y === k.y - k.h + 1 ? 0.5 : 0) + (r > 0 ? r * 0.25 : 0)))
        }
      }
      const top = k.y - k.h
      const wx = k.x + (k.w > 1 ? (k.x < CX ? 1 : 0) : 0)
      if (isCandleLit(f, i)) {
        const pull = f >= 31 && f < BURST ? (k.x < CX ? 1 : -1) * Math.round(beat(f, 31, 37)) : 0
        const tall = (k.w > 1 ? 2 : 1) + (hash(f >> 1, i, 9) > 0.5 ? 1 : 0)
        const isKindling = f - k.relight >= 0 && f - k.relight < 2
        for (let j = 0; j < tall; j++) {
          const lean = j === tall - 1 ? pull : 0
          c.set(wx + lean, top - j, shade(FLAME, isKindling ? 4 : 3.2 - j * 1.1))
        }
        c.set(wx, top, shade(FLAME, 3.6))
      } else if (f < BURST + 10) {
        for (let j = 0; j < 3; j++) {
          const t = f - BURST - j * 2
          if (t < 0) continue
          const sy = top - 1 - t * 0.6
          const sx = wx + Math.round(Math.sin(t * 0.7 + i) * 0.8)
          c.set(sx, sy, shade(SMOKE, 2.4 - t * 0.25))
        }
      }
    })

    if (f >= 29 && f <= BURST) {
      const head = beat(f, 29, 38)
      const tail = ease.in(beat(f, 32, BURST + 1))
      for (const [ri, ramp] of [ENERGY, VIOLET].entries()) {
        for (let s = tail; s <= head; s += 0.004) {
          const a = ri * Math.PI + s * Math.PI * 4 + f * 0.25
          const x = CX + Math.cos(a) * MID.rx * (1 - s) ** 1.6
          const y = CY + Math.sin(a) * MID.ry * (1 - s) ** 1.6 + (ORB_Y - CY) * s
          const isFront = Math.sin(a) > 0
          const isHead = head - s < 0.04
          c.set(x, y, isHead ? ENERGY[5] ?? 0 : shade(ramp, (isFront ? 3.4 : 1.6) + s * 1.2))
        }
      }
    }

    if (r > 0) {
      for (let y = Math.floor(ORB_Y - r - 1); y <= Math.ceil(ORB_Y + r + 1); y++) {
        for (let x = Math.floor(ORB_X - r - 1); x <= Math.ceil(ORB_X + r + 1); x++) {
          const d = Math.hypot(x - ORB_X, y - ORB_Y) / r
          if (d > 1) continue
          const hi = Math.hypot(x - ORB_X + r * 0.3, y - ORB_Y + r * 0.3) / r
          if (d > 0.82 && r > 2.5) c.set(x, y, shade(VIOLET, 2.6 + (y < ORB_Y ? 0.6 : 0)))
          else c.set(x, y, shade(ENERGY, 5.4 - d * 2.6 - (hi < 0.35 ? -1 : 0)))
        }
      }
      if (f >= BURST + 3 && f < 59) {
        for (let m = 0; m < 3; m++) {
          const a = (f - BURST) * 0.42 + (m * Math.PI * 2) / 3
          const mx = ORB_X + Math.cos(a) * (r + 3.5)
          const my = ORB_Y + Math.sin(a) * 1.6
          if (Math.sin(a) < 0 && Math.abs(mx - ORB_X) < r) continue
          c.set(mx, my, shade(ENERGY, Math.sin(a) > 0 ? 5 : 3))
        }
      }
    }
    if (f === BURST || f === BURST + 1) {
      const rr = f === BURST ? 6 : 10
      for (let y = 0; y < H; y++) {
        for (let x = 12; x < 52; x++) {
          const d = Math.hypot(x - ORB_X, (y - ORB_Y) * 1.2)
          if (f === BURST && d < rr) c.set(x, y, shade(ENERGY, 5.6 - d * 0.35))
          if (f === BURST + 1 && d > rr - 1.4 && d < rr) c.set(x, y, shade(ENERGY, 4))
        }
      }
    }
    if (f >= 63 && f <= 67) {
      const len = [2, 3, 2, 1, 0][f - 63] ?? 0
      const dim = Math.max(0, f - 65)
      for (let k = -len; k <= len; k++) {
        c.set(ORB_X + k, ORB_Y, shade(ENERGY, 5 - Math.abs(k) - dim))
        c.set(ORB_X, ORB_Y + k, shade(ENERGY, 5 - Math.abs(k) - dim))
      }
    }
  })
}

const CATCHES: readonly [number, readonly [number, number, number, number]][] = [
  [0, [29, 27, 35, 29]], [1, [14, 24, 20, 28]], [2, [8, 19, 13, 26]],
  [4, [21, 14, 35, 18]], [5, [44, 16, 50, 20]], [6, [51, 18, 56, 25]],
]
export const scene: Scene = {
  verb: 'Manifesting',
  render,
  hero: 46,
  snaps: [
    ...CATCHES.map(([k, box]) => ({
      frames: RUNE_START + k * RUNE_GAP,
      box,
      why: 'a rune catches in a white flash as the running light reaches it, lighting the floor round it teal',
    })),
    { frames: 31, box: [32, 20, 44, 23], colors: [...ENERGY, ...VIOLET], why: 'the spiral ribbons start to wind up out of the ring' },
    { frames: [BURST, BURST + 2], why: 'the orb bursts into being: a white flash lights the whole crypt, throws a ring out and blows the candles out' },
  ],
}
