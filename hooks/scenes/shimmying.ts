import { Canvas, PALETTE, TAU, clamp, frames, hash, hex, lerp, lightAt, shade, type Light, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 48

const PANEL = hex('140a0a 22120e 321a12 472616 5e341c 784424 935630 ad6c3e')
const CLOTH = hex('2e1a0e 4a2a10 6e4214 945c1c b87a28 d69a3a eabb58 f6da8a')
const RUBY = hex('260410 480818 72102a b01a34 d8303e f05a52 ff9a84 ffd8c4')
const CREAM = hex('5a3e36 8a6a58 b89a80 dcc4a4 f3e4c8 fff8ea')
const LIME = hex('10280e 1e4614 2e6a1c 4a9226 72b82e a4da4a d8f290 f6ffd0')
const GLASS = hex('1a2630 34505a 5a8088 90b8bc cce8e6 f4fffc')
const LAMP = PALETTE.orange
const METAL = PALETTE.metal
const OLIVE = hex('1c2210 2e3a16 46561e 62722a 82903a a8b050')

const TABLE_Y = 18
const FRONT_Y = 28
const GX = 32
const GBASE = 24
const GH = 14

const THUDS: [number, number][] = [[3, 0.22], [9, 0.4], [15, 1]]
const BIG = 15

function shimmy(f: number): number {
  let s = 0
  for (const [t, k] of THUDS) {
    const d = f - t
    if (d < 0) continue
    s += k * 4.4 * Math.exp(-d / (k > 0.5 ? 7.5 : 3)) * Math.sin((d * TAU) / 6.4)
  }
  return s
}

function squash(f: number): number {
  let q = 0
  for (const [t, k] of THUDS) {
    const d = f - t
    if (d < 0) continue
    q += k * 0.2 * Math.exp(-d / 4) * Math.cos((d * TAU) / 5)
  }
  return q
}

const swing = (f: number) => (f < BIG ? 0 : 2.6 * Math.exp(-(f - BIG) / 10) * Math.sin(((f - BIG) * TAU) / 15))

function halfWidth(h: number): number {
  if (h < 0.07) return 11.4
  if (h < 0.72) return 10.6 - ((h - 0.07) / 0.65) * 2
  const t = (h - 0.72) / 0.28
  return 8.6 * Math.sqrt(Math.max(0, 1 - t * t))
}

type Gel = { ramp: readonly number[]; level: number }

function draw(c: Canvas, f: number): void {
  const lx = 17 + swing(f)
  const lamp: Light = { x: lx, y: 7, power: 1.25, radius: 46 }
  const lit = (x: number, y: number) => lightAt([lamp], x, y)
  const s = shimmy(f)
  const q = squash(f)

  for (let y = 0; y < TABLE_Y; y++) {
    for (let x = 0; x < W; x++) {
      const board = Math.floor(x / 6)
      const isGroove = x % 6 === 0
      const grain = (hash(board, 7) - 0.5) * 0.6
      c.set(x, y, shade(PANEL, 1 + lit(x, y) * 4.4 + grain - (isGroove ? 1.1 : 0) - (y === TABLE_Y - 1 ? 0.8 : 0)))
    }
  }
  for (let y = 1; y <= 10; y++) {
    for (let x = 42; x <= 57; x++) {
      const l = lit(x, y)
      if (x === 42 || x === 57 || y === 1 || y === 10) {
        c.set(x, y, shade(CLOTH, 2.6 + l * 3 + (x === 42 || y === 1 ? 0.8 : -0.4)))
        continue
      }
      const sun = Math.hypot(x - 49.5, (y - 7) * 1.1) < 2.6
      const hill = y >= 8 - Math.round(Math.sin(x * 0.7) * 0.8 + (x > 50 ? 1 : 0))
      const lvl = hill ? 0.6 : sun ? 4.4 : 1.6 + (y - 2) * 0.4
      c.set(x, y, shade(hill ? PANEL : LAMP, lvl + l * 1.2))
    }
  }

  const cordTop = 17
  for (let y = 0; y <= 1; y++) c.set(Math.round(cordTop + (lx - cordTop) * (y / 2)), y, shade(METAL, 2))
  for (let y = 2; y <= 6; y++) {
    for (let x = Math.floor(lx - 7); x <= Math.ceil(lx + 7); x++) {
      const dx = (x - lx) / 6.5
      const dy = (6 - y) / 4.5
      if (dx * dx + dy * dy > 1) continue
      const glow = 1 - Math.abs(dx) * 0.8
      c.set(x, y, shade(LAMP, 2 + glow * 3 + (y === 6 ? 1.2 : 0) - (dx > 0.5 ? 0.6 : 0)))
    }
  }
  for (let x = Math.round(lx) - 3; x <= Math.round(lx) + 3; x++) c.set(x, 7, Math.abs(x - lx) < 2.5 ? 0xfffbe6 : (LAMP[6] ?? 0))

  for (let y = TABLE_Y; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const l = lit(x, y)
      if (y < FRONT_Y) {
        c.set(x, y, shade(CLOTH, 2.4 + l * 3.6 - (y === TABLE_Y ? 0.8 : 0)))
      } else if (y === FRONT_Y) {
        c.set(x, y, shade(CLOTH, 2.6 + l * 3))
      } else {
        const fold = x % 8 < 1 ? -0.8 : x % 8 > 5 ? 0.4 : 0
        const scallop = y === H - 1 && x % 4 === 1 ? -1 : 0
        c.set(x, y, shade(CLOTH, 1.2 + l * 1.8 + fold - (y - FRONT_Y) * 0.25 + scallop))
      }
    }
  }

  const shadowShift = -(lx - 17) * 0.5
  for (let y = 22; y <= 27; y++) {
    for (let x = 24; x < 60; x++) {
      const gx = GX + 9 + s * 0.35 + shadowShift
      if (((x - gx) / 11) ** 2 + ((y - 25) / 1.9) ** 2 <= 1) {
        const glow = ((x - gx - 1) / 4.5) ** 2 + ((y - 25.2) / 0.9) ** 2 <= 1
        c.set(x, y, glow ? shade(RUBY, 5) : shade(CLOTH, 1.6 + lit(x, y) * 1.6))
      }
      if (((x - 57.5 - shadowShift) / 3.4) ** 2 + ((y - 25) / 0.9) ** 2 <= 1) c.set(x, y, shade(CLOTH, 1.8 + lit(x, y) * 1.6))
    }
  }

  for (let y = 21; y <= 27; y++) {
    for (let x = 16; x <= 48; x++) {
      const e = ((x - GX) / 14.5) ** 2 + ((y - 24.2) / 2.6) ** 2
      if (e > 1) continue
      const under = c.get(x, y)
      const isRim = e > 0.62
      c.set(x, y, isRim ? shade(GLASS, (y > 24 ? 3.4 : 4.2) + (x < GX ? 0.8 : -0.6)) : under === (RUBY[5] ?? 0) ? under : shade(CLOTH, 3 + lit(x, y) * 3.4))
    }
  }
  for (let x = 20; x <= 44; x++) c.set(x, 27, shade(GLASS, 1.6))
  c.set(20, 25, GLASS[5] ?? 0)

  const gel = new Map<number, Gel>()
  const hScale = GH * (1 - q)
  for (let y = GBASE - GH - 3; y <= GBASE; y++) {
    for (let x = 14; x <= 50; x++) {
      const h = (GBASE + 0.5 - y) / hScale
      if (h < 0 || h > 1) continue
      const u = (x - GX - s * h ** 1.4) / (1 + q * 0.7)
      const w = halfWidth(h)
      if (Math.abs(u) > w) continue
      const a = u / w
      const tilt = h - u * s * 0.008
      const p = ((Math.asin(clamp(a, -1, 1)) / Math.PI + 0.5) * 6.5) % 1
      const rib = h > 0.74 ? 0 : p < 0.35 ? 0.8 : p > 0.8 ? -0.9 : 0
      let level = -a * 1.1 + rib + (h > 0.74 ? 0.7 : 0)
      const spec = Math.abs(a - (-0.52 + (lx - 17) * 0.05)) < 0.075 && h > 0.12 && h < 0.86
      let ramp: readonly number[] = LIME
      if (tilt < 0.36) {
        ramp = RUBY
        level += 3 + (h < 0.16 && Math.abs(a) < 0.6 ? 0.8 : 0)
      } else if (tilt < 0.5) {
        ramp = CREAM
        level += 2.6
      } else {
        level += 3
      }
      if (spec) level += 2.4
      gel.set(y * W + x, { ramp, level })
    }
  }
  for (const [key, g] of gel) {
    const x = key % W
    const y = Math.floor(key / W)
    const edge = !gel.has(key + 1) ? -0.9 : !gel.has(key - 1) ? 0.8 : 0
    const top = !gel.has(key - W) ? 0.9 : 0
    c.set(x, y, shade(g.ramp, g.level + edge + top))
  }

  const topY = GBASE + 0.5 - hScale
  const hop = f - BIG
  let cy = topY - 0.6
  let cx = GX + s
  if (hop >= 0 && hop <= 10) {
    const t = clamp(hop / 8)
    const before = GBASE + 0.5 - GH * (1 - squash(BIG - 1)) - 0.6
    cy = lerp(before, cy, t) - (hop <= 8 ? 22 * t * (1 - t) * 0.9 : hop === 9 ? 1 : 0)
    cx = GX + shimmy(BIG) + (s - shimmy(BIG)) * t * t
  }
  const cherry = ['.ss.', 'aCCa', 'CHCb', 'aCbb', '.bb.']
  const tone: Record<string, number> = {
    s: OLIVE[2] ?? 0, H: RUBY[7] ?? 0, C: RUBY[4] ?? 0, a: RUBY[3] ?? 0, b: RUBY[2] ?? 0,
  }
  c.sprite(Math.round(cx) - 2, Math.round(cy) - 4, cherry, tone)
  c.set(Math.round(cx) + 1, Math.round(cy) - 5, OLIVE[3] ?? 0)

  for (const [mx, delay, hops] of [[5, 0, [2, 2, 1]], [11, 1, [1, 2, 2, 1]]] as const) {
    const d = f - BIG - delay
    const up = hops[d] ?? 0
    const by = 23 - up
    const shaker = ['.oo.', 'oOOo', 'dddd', '.cc.', '.cC.']
    const pal: Record<string, number> = {
      O: shade(LAMP, 4 + lit(mx, by) * 1.6), o: shade(LAMP, 2.6 + lit(mx, by) * 1.4), d: shade(LAMP, 1.2),
      c: shade(CREAM, 3 + lit(mx, by)), C: shade(CREAM, 1.8 + lit(mx, by)),
    }
    if (up === 0) for (let x = mx + 1; x <= mx + 4; x++) c.set(x, 24, shade(CLOTH, 1.6 + lit(x, 24) * 1.6))
    c.sprite(mx, by - 4, shaker, pal)
  }

  const slosh = f < BIG ? 0 : Math.round(1.6 * Math.exp(-(f - BIG) / 8) * Math.sin(((f - BIG) * TAU) / 7))
  for (let y = 12; y <= 25; y++) {
    for (let x = 48; x <= 58; x++) {
      const isBowl = y <= 19 && x >= 49 + Math.max(0, y - 17) && x <= 57 - Math.max(0, y - 17)
      if (isBowl) {
        const left = x === 49 + Math.max(0, y - 17)
        const right = x === 57 - Math.max(0, y - 17)
        const surface = 15 + Math.round(((x - 53) / 4) * slosh)
        if (left || right) c.set(x, y, shade(GLASS, left ? 4.6 : 2.8))
        else if (y === surface) c.set(x, y, shade(GLASS, 4.4 - (x > 54 ? 0.8 : 0)))
        else if (y > surface) c.set(x, y, shade(GLASS, 2.2 + (x === 50 ? 1 : 0) - (y === 19 ? 0.6 : 0)))
        else c.set(x, y, shade(PANEL, 2.2 + lit(x, y) * 4.4))
        if (y === 12 && !left && !right) c.set(x, y, shade(GLASS, 3.6))
      } else if (x === 53 && y >= 20 && y <= 23) {
        c.set(x, y, shade(GLASS, 3.6))
      } else if (y === 24 && x >= 51 && x <= 55) {
        c.set(x, y, shade(GLASS, x < 53 ? 4.4 : 3))
      }
    }
  }
  for (const [t, k] of THUDS) {
    const d = f - t
    if (d < 0 || d > 3 || k > 0.5) continue
    for (const side of [-1, 1]) c.set(53 + side * (d + 1), 15, GLASS[5] ?? 0)
    if (d === 0) c.set(53, 15, GLASS[5] ?? 0)
  }

  for (let y = 26; y <= 28; y++) {
    for (let x = 45 - (y - 26); x <= 60 - (y - 26); x++) c.set(x, y, shade(OLIVE, 2.4 + lit(x, y) * 2.2 + (y === 26 ? 0.8 : 0)))
  }
  const rattle = [1, 1, 0, 0, 1, 1][f - BIG] ?? 0
  const sy = 27 - rattle
  for (let x = 51; x <= 58; x++) c.set(x, sy - (x > 55 ? 1 : 0), shade(METAL, x < 54 ? 6 : 5))
  c.set(48, sy, shade(METAL, 6.6))
  c.set(49, sy, shade(METAL, 5.4))
  c.set(50, sy, shade(METAL, 4.6))
  c.set(48, sy + 1, shade(METAL, 4))
  c.set(49, sy + 1, shade(METAL, 3.2))

  for (let k = 0; k < 4; k++) {
    const d = f - BIG - k * 2
    if (d < 0) continue
    const x = 10 + hash(k, 3) * 16 + Math.sin(d * 0.3 + k) * 1.2
    const y = d * 0.9
    if (y > 17) continue
    const l = lit(x, y)
    if (l > 0.3) c.set(x, y, l > 0.7 ? (CLOTH[7] ?? 0) : (CLOTH[5] ?? 0))
  }
}

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    draw(c, f)
  })
}

export const scene: Scene = {
  verb: 'Shimmying',
  render,
  hero: 17,
  snaps: [
    { frames: [BIG + 2, BIG + 4], box: [36, 9, 43, 22], colors: [...RUBY, ...CREAM, ...LIME], why: 'The big thud\'s first swings shear the dessert at up to 4 px a frame.' },
    { frames: BIG + 8, box: [29, 2, 36, 10], colors: [...RUBY, ...OLIVE, 0xffd8c4], why: 'The cherry drops back onto the top.' },
  ],
}
