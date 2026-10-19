import { Canvas, hex, mix, particles, shade, type Paint, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 60
const CX = 40
const CY = 17

const PARCH = hex('2a1a12 46301f 6b4a2c 8e6a3e b08c55 cbab6e e0c88e efdeae f8eed0')
const SEA = hex('1b2126 2a3537 3c4c4b 52655f 6a7f73 849988 9fb29d b8c8b1 cfdcc5')
const ROUTE = hex('4a1612 7a2418 a33a22 c4552e e07a44')
const BRASS = hex('2c1a08 4e300c 7a4c10 a8701a d1982a eec24a fae58a fffbd8')
const DIAL = hex('6e5d48 9c8869 c4b18c dfd0ac efe5c8 fbf6e6')
const RED = hex('2a0a0e 4e1016 7a1a1e a6281f cf4229 ee6a3a f79a5e')
const STEEL = hex('10121c 1c2233 2c3550 425074 6276a0 93a6c8')

const TO_LAMP = [-0.6, -0.8] as const

const lamp = (x: number, y: number) => Math.max(0, 1 - Math.hypot(x - 12, (y + 6) * 1.2) / 74) ** 1.2
const vignette = (x: number, y: number) => (((x - 30) / 36) ** 2 + ((y - 15) / 22) ** 2) * 1.4

const ANGLE = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  12, 50, 135, 270, 420, 570, 709, 839, 959, 1068,
  1165, 1250, 1323, 1385, 1436, 1478, 1512, 1539, 1560, 1576,
  1587, 1594, 1598, 1599, 1597, 1590, 1576, 1554, 1524, 1490,
  1456, 1428, 1412, 1404, 1409, 1424, 1440, 1453, 1458, 1454,
  1446, 1439, 1435, 1436, 1440, 1440, 1440, 1440, 1440, 1440,
]
const SETTLE = 54
const HOP = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 1, 0]

const coastX = (y: number) => 17 + 2.6 * Math.sin(y * 0.31 + 0.6) + 1.4 * Math.sin(y * 0.83 + 2)
const isIsland = (x: number, y: number) => ((x - 7) / 3.4) ** 2 + ((y - 24) / 2.3) ** 2 <= 1
const isSea = (x: number, y: number) => x < coastX(y) && !isIsland(x, y)

const SHIP = [
  '...a...',
  '...aa..',
  '...aaa.',
  '...aaaa',
  '...a...',
  'aaaaaaa',
  '.aaaaa.',
]
const WAVES: readonly (readonly [number, number])[] = [[2, 13], [10, 15], [4, 18], [12, 21], [2, 29], [13, 28], [11, 3]]
const MOUNTAINS: readonly (readonly [number, number])[] = [[55, 4], [59, 7], [54, 10], [60, 12]]

const { INK, RED_INK } = (() => {
  const ink = new Map<number, number>()
  const red = new Map<number, number>()
  const at = (x: number, y: number) => y * W + x
  const scratch = new Canvas()
  for (let k = 0; k < 16; k++) {
    if (k % 4 === 2) continue
    const a = (k / 16) * Math.PI * 2
    scratch.line(CX, CY, CX + Math.sin(a) * 80, CY - Math.cos(a) * 80, 1)
  }
  for (let i = 0; i < W * H; i++) {
    const v = scratch.px[i] ?? 0
    if (v === 1) ink.set(i, -1)
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sea = isSea(x, y)
      const shore = !sea && (isSea(x - 1, y) || isSea(x + 1, y) || isSea(x, y - 1) || isSea(x, y + 1))
      if (shore) ink.set(at(x, y), -3)
      else if (sea && Math.round(coastX(y)) - 3 === x) ink.set(at(x, y), -1)
      else if (sea && Math.abs(Math.hypot((x - 7) / 3.4, (y - 24) / 2.3) - 1.65) < 0.22) ink.set(at(x, y), -1)
    }
  }
  SHIP.forEach((row, j) => [...row].forEach((ch, i) => ch === 'a' && ink.set(at(3 + i, 3 + j), -3)))
  for (const [wx, wy] of WAVES) {
    for (const dx of [0, 1, 2]) ink.set(at(wx + dx, wy), -1)
    for (const dx of [2, 3, 4]) ink.set(at(wx + dx, wy + 1), -1)
  }
  for (const [mx, my] of MOUNTAINS) {
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 2 - dy; dx <= 2 + dy; dx++) ink.set(at(mx + dx, my + dy), dx === 2 - dy ? -2.4 : dx <= 2 ? -0.4 : -1.4)
    }
  }
  let n = 0
  let last = -1
  for (let t = 0; t <= 1; t += 0.002) {
    const u = 1 - t
    const x = Math.round(u * u * u * 10 + 3 * u * u * t * 15 + 3 * u * t * t * 36 + t * t * t * 56)
    const y = Math.round(u * u * u * 10 + 3 * u * u * t * 31 + 3 * u * t * t * 34 + t * t * t * 25)
    if (at(x, y) === last) continue
    last = at(x, y)
    if (n++ % 5 < 3) red.set(last, 2)
  }
  for (const [dx, dy] of [[-1, -2], [0, -2], [1, -2], [-2, -1], [2, -1], [-2, 0], [2, 0], [-2, 1], [2, 1], [-1, 2], [0, 2], [1, 2], [0, 0]] as const) {
    red.set(at(58 + dx, 25 + dy), 3)
  }

  return { INK: ink, RED_INK: red }
})()

function chart(x: number, y: number, dark: number): number {
  const i = y * W + x
  const fold = x === 25 ? 0.6 : x === 26 ? -0.7 : 0
  const level = 3 + lamp(x, y) * 3.4 - vignette(x, y) - dark + fold
  const red = RED_INK.get(i)
  if (red !== undefined) return shade(ROUTE, red + (level - 4.5) * 0.7, x, y)
  return shade(isSea(x, y) ? SEA : PARCH, level + (INK.get(i) ?? 0), x, y)
}

const LIT_CHART = Int32Array.from({ length: W * H }, (_, i) => chart(i % W, Math.floor(i / W), 0))
const SHADED_CHART = Int32Array.from({ length: W * H }, (_, i) => chart(i % W, Math.floor(i / W), 1.6))

const NEEDLE_SHADOW = DIAL[2] ?? 0
const rampOf = new Map<number, readonly number[]>([PARCH, SEA, ROUTE, BRASS, DIAL, RED, STEEL].flatMap(r => r.map(c => [c, r] as [number, readonly number[]])))
function brighten(col: number, light: number, t: number): number {
  const m = mix(col, light, t)
  const r = rampOf.get(col) ?? [...rampOf.keys()]
  const d = (a: number) => Math.abs(((a >> 16) & 255) - ((m >> 16) & 255)) + Math.abs(((a >> 8) & 255) - ((m >> 8) & 255)) + Math.abs((a & 255) - (m & 255))
  return r.reduce((best, k) => (d(k) < d(best) ? k : best))
}

type Look = 'needle' | 'shadow' | 'mask'

function drawNeedle(c: Canvas, deg: number, look: Look, dx = 0, dy = 0): void {
  const a = (deg * Math.PI) / 180
  const ux = Math.sin(a)
  const uy = -Math.cos(a)
  const px = -uy
  const py = ux
  const ox = CX + dx
  const cy = CY + dy
  const half = 1.5
  const paint: Paint = (x, y) => {
    const along = (x - ox) * ux + (y - cy) * uy
    if (look === 'shadow') return Math.hypot(x - CX, y - CY) < 10 ? NEEDLE_SHADOW : undefined
    if (look === 'mask') return along >= 0 ? 1 : 2
    const across = (x - ox) * px + (y - cy) * py
    const facet = (across >= 0 ? 1 : -1) * (px * TO_LAMP[0] + py * TO_LAMP[1])
    if (along >= 0) return shade(RED, 3.7 + facet * 1.6 + (along > 5.5 ? 0.6 : 0), x, y)
    return shade(STEEL, 2.6 + facet * 1.5, x, y)
  }
  for (const len of [8.4, -8]) {
    c.poly([[ox + ux * len, cy + uy * len], [ox + px * half, cy + py * half], [ox - px * half, cy - py * half]], paint)
    c.line(ox, cy, ox + ux * (len - Math.sign(len) * 0.4), cy + uy * (len - Math.sign(len) * 0.4), paint)
  }
}

function drawTurningNeedle(c: Canvas, from: number, to: number): void {
  const n = Math.max(1, Math.ceil(Math.abs(to - from) / 3))
  const red = new Float32Array(W * H)
  const steel = new Float32Array(W * H)
  const dark = new Float32Array(W * H)
  for (let j = 1; j <= n; j++) {
    const deg = from + ((to - from) * j) / n
    const body = new Canvas()
    const shadow = new Canvas()
    drawNeedle(body, deg, 'mask')
    drawNeedle(shadow, deg, 'shadow', 1, 1)
    for (let i = 0; i < W * H; i++) {
      if (body.px[i] === 1) red[i] = (red[i] ?? 0) + 1 / n
      else if (body.px[i] === 2) steel[i] = (steel[i] ?? 0) + 1 / n
      if (shadow.px[i] !== 0) dark[i] = (dark[i] ?? 0) + 1 / n
    }
  }
  const crisp = new Canvas()
  crisp.px.set(c.px)
  drawNeedle(crisp, to, 'shadow', 1, 1)
  drawNeedle(crisp, to, 'needle')
  for (let i = 0; i < W * H; i++) {
    const r = red[i] ?? 0
    const s = steel[i] ?? 0
    const cover = r + s
    const at = c.px[i] ?? 0
    if (cover >= 0.75) c.px[i] = crisp.px[i] ?? at
    else if (cover >= 0.15) c.px[i] = mix(at, (r >= s ? RED[4] : STEEL[3]) ?? 0, cover >= 0.4 ? 0.45 : 0.2)
    else if ((dark[i] ?? 0) >= 0.5) c.px[i] = NEEDLE_SHADOW
  }
}
function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const lift = HOP[f] ?? 0
    const deg = ANGLE[f] ?? 0
    const step = f > 0 ? deg - (ANGLE[f - 1] ?? 0) : 0
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const sx = x - CX - 2 - lift
        const sy = y - CY - 2 - lift
        const isShadow = Math.hypot(sx, sy) <= 13 || (Math.abs(sx) <= 1 && sy >= -16 && sy <= -12) || Math.abs(Math.hypot(sx / 3.6, (sy + 16.5) / 2.6) - 0.8) < 0.25
        c.set(x, y, (isShadow ? SHADED_CHART : LIT_CHART)[y * W + x] ?? 0)
      }
    }
    const cy = CY
    const glow = f >= SETTLE && f < SETTLE + 4 ? [1.2, 0.7, 0.35, 0.15][f - SETTLE] ?? 0 : 0
    for (let y = cy - 14; y <= cy + 14; y++) {
      for (let x = CX - 14; x <= CX + 14; x++) {
        const dx = x - CX
        const dy = y - cy
        const r = Math.hypot(dx, dy)
        if (r > 13.2) continue
        const facing = r > 0 ? (dx * TO_LAMP[0] + dy * TO_LAMP[1]) / r : 0
        if (r > 12.4) c.set(x, y, BRASS[facing > 0.2 ? 2 : facing > -0.5 ? 1 : 0] ?? 0)
        else if (r > 11.4) c.set(x, y, shade(BRASS, 4 + facing * 1.9 + (facing > 0.96 ? 1.2 : 0) + glow, x, y))
        else if (r > 10.4) c.set(x, y, shade(BRASS, 2.6 - facing * 1.8 + glow * 0.5, x, y))
        else {
          const rim = r > 9.2 && facing > 0.25 ? -1.3 : 0
          c.set(x, y, shade(DIAL, 3.4 + lamp(x, y) * 1.4 + rim, x, y))
        }
      }
    }
    for (let y = cy - 18; y <= cy - 13; y++) {
      for (let x = CX - 4; x <= CX + 4; x++) {
        const dx = x - CX
        const e = Math.hypot(dx / 3.6, (y - (cy - 16.5)) / 2.6)
        const isRing = Math.abs(e - 0.8) < 0.25
        const isCrown = Math.abs(dx) <= 1 && y >= cy - 14
        if (!isRing && !isCrown) continue
        const lit = isCrown ? (dx < 0 ? 5.5 : dx === 0 ? 4.5 : 2.6) : 3.6 - dx * 0.45 - (y - (cy - 16.5)) * 0.5
        c.set(x, y, shade(BRASS, lit + glow, x, y))
      }
    }
    for (let y = cy - 10; y <= cy + 10; y++) {
      for (let x = CX - 10; x <= CX + 10; x++) {
        const dx = x - CX
        const dy = y - cy
        if (Math.hypot(dx, dy) > 9.2) continue
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2
          const ux = Math.sin(a)
          const uy = -Math.cos(a)
          const along = dx * ux + dy * uy
          const across = dx * -uy + dy * ux
          const len = k % 2 ? 4.6 : 7.6
          if (along < 0 || Math.abs(across) > 1.9 * (1 - along / len)) continue
          c.set(x, y, shade(DIAL, 3.4 + lamp(x, y) * 1.4 - (across > 0 ? 1.2 : 2.4), x, y))
          break
        }
      }
    }
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2
      for (const r of k % 2 ? [9.4] : [8.6, 9.6]) c.set(CX + Math.sin(a) * r, cy - Math.cos(a) * r, DIAL[k % 2 ? 2 : 1] ?? 0)
    }
    for (const [x, y] of [[CX - 1, cy - 10], [CX, cy - 10], [CX + 1, cy - 10], [CX, cy - 9]] as const) {
      c.set(x, y, shade(RED, 4 + (x < CX ? 1 : 0), x, y))
    }
    drawTurningNeedle(c, deg - step, deg)
    for (const [dx, dy, l] of [[0, 0, 5.6], [-1, 0, 5], [0, -1, 5.4], [1, 0, 3], [0, 1, 2.6]] as const) {
      c.set(CX + dx, cy + dy, shade(BRASS, l + glow, CX + dx, cy + dy))
    }
    if (f >= SETTLE - 1 && f < SETTLE + 4) {
      const p = f - (SETTLE - 1)
      const band = -14 + p * 7
      for (let y = cy - 11; y <= cy + 11; y++) {
        for (let x = CX - 11; x <= CX + 11; x++) {
          const d = x - CX + (y - cy) - band
          if (Math.hypot(x - CX, y - cy) <= 10.4 && d >= 0 && d < 2) c.set(x, y, brighten(c.get(x, y), 0xfffbe8, d < 1 ? 0.45 : 0.25))
        }
      }
    }
    if (f >= SETTLE && f < SETTLE + 4) {
      const arm = [4, 3, 1, 0][f - SETTLE] ?? 0
      const gx = CX
      const gy = cy - 8
      c.set(gx, gy, 0xffffff)
      for (let k = 1; k <= arm; k++) {
        const col = k === arm ? BRASS[6] ?? 0 : BRASS[7] ?? 0
        for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.set(gx + sx * k, gy + sy * k, col)
      }
    }
    if (f >= 13 && f < 19) {
      const t = f - 13
      for (const side of [-1, 1]) {
        for (let k = 0; k < 2; k++) {
          const x = CX + side * (11 + t * 0.9 + k * 1.5)
          const y = CY + 10 - t * 0.6 - k
          if (t < 4 - k) c.set(x, y, PARCH[t < 2 ? 8 : 7] ?? 0)
        }
      }
    }
    for (const p of particles(f, LOOP, 5, 40, 7)) {
      const x = Math.round(4 + p.r[1] * 26 + p.t * 0.12)
      const y = Math.round(2 + p.r[2] * 12 - p.t * 0.08 + Math.sin(p.t * 0.2 + p.r[3] * 6))
      if (p.age > 0.1 && p.age < 0.9 && lamp(x, y) > 0.55) c.set(x, y, PARCH[8] ?? 0)
    }
    out.push(c.px)
  }
  return out
}
export const scene: Scene = { verb: 'Determining', render, hero: SETTLE }