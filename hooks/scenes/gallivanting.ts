import { Canvas, beat, clamp, ease, hash, hex, mix, mod, shade, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96
const HORIZON = 10
const PERIOD = 96

const SKY = hex('2f68c0 3d7ed0 5294dc 6eaae4 8cc0ea acd4f0 cce4f4')
const CLOUD = hex('8ea6d0 b4c8e6 d8e4f4 f6faff')
const HILLS = hex('6a92b8 7ea4c4 94b6cc')
const HAZE = 0xa6c6dc
const HEDGE = hex('16301e 22442a 2e5a32')
const CROPS = [
  hex('5e7a26 7c9a30 9cba3e'),
  hex('a8802c c89c3a e2bc54'),
  hex('3e6a2a 4e8030 64983a'),
  hex('c8b028 e2cc36 f4e45a'),
  hex('6e4a2e 86603a a07a4a'),
  hex('2a4a24 345a2a 426c32'),
] as const
const RIVER = hex('3e78b4 6aa2d6 a8d2f0 e8f6ff')
const ROOF = hex('6a2a20 9a3e28 c05c36')
const WALL = hex('9a8670 c8b494 ece0c0')
const STONE = hex('5c5a68 85808a aca6a8')
const SLATE = hex('2c3040 3e4456 566078')
const RED = hex('4c1224 7e1c2c b42c32 de4c3c f47e54 fcb27c')
const CREAM = hex('6c5a6a a28a7c d2ba92 f0dcb0 fff6dc')
const BLUE = hex('16224c 203c7c 2c5caa 4c88d2 84baee')
const WICKER = hex('3a2414 5c3a1e 82552a a8743a')
const FLAME = hex('d23e1c f99832 fcc657 fee996 fffbe0')

const depth = (y: number) => 20.5 / (y - HORIZON + 0.5)

const BANDS = [1.3, 1.65, 2.15, 2.9, 4, 5.6, 8.5, 14, Infinity]
const WIDTHS = [24, 32, 19.2, 48, 24, 32, 16, 24, 32]
const OFFSETS = [5, 21, 2, 33, 11, 7, 3, 9, 0]

const bandOf = (z: number) => BANDS.findIndex(b => z < b)

const TOWN_X = 22
const TOWN_Z: readonly [number, number] = [1.12, 1.55]

const wrap = (d: number) => mod(d + PERIOD / 2, PERIOD) - PERIOD / 2

const riverAt = (z: number) => 62 + 13 * Math.sin(z * 1.5 + 0.4) + 4 * Math.sin(z * 4.1)

const BALLOON_X = 21
const flare = (f: number) => (f >= 30 && f <= 41 ? Math.min(1, (f - 29) / 2) * (1 - beat(f, 38, 42)) : 0)
const height = (f: number) => Math.round(2.5 * ease.inOut(beat(f, 34, 56)) - 2.5 * ease.inOut(beat(f, 56, 96)) + 0.6 * wave(f, LOOP, 2))

function halfWidth(r: number): number {
  if (r < 0 || r > 17) return 0
  if (r <= 7.5) return Math.sqrt(Math.max(0, 8.2 ** 2 - (7.6 - r) ** 2))
  return 8.2 - ((r - 7.5) / 9.5) ** 1.25 * 6.2
}

type Cloud = { x: number; y: number; s: number }
const CLOUDS: Cloud[] = [{ x: 47, y: 3, s: 1 }, { x: 6, y: 4, s: 0.7 }, { x: 60, y: 7, s: 0.5 }]

function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const cam = (f / LOOP) * PERIOD
    const fl = flare(f)
    const top = 1 - height(f)

    c.fill((x, y) => shade(SKY, (y / HORIZON) * 6.2, x, y))
    for (const cl of CLOUDS) {
      const lumps: [number, number, number][] = [[0, 1, 3], [4, 0, 3.6], [8, 1.2, 2.8], [-3.6, 2, 2.2], [11, 2.4, 1.8]]
      for (const [lx, ly, r] of lumps) {
        c.disc(cl.x + lx * cl.s * 1.2, cl.y + ly * cl.s, r * cl.s, (x, y) => {
          if (y >= cl.y + 2.4 * cl.s) return CLOUD[1] ?? 0
          const lit = (cl.y + ly * cl.s - y) / (r * cl.s) + (cl.x - x) * 0.04
          return shade(CLOUD, 2.1 + lit * 1.3, x, y)
        })
      }
    }

    for (let x = 0; x < W; x++) {
      const t = Math.round(HORIZON - 1.5 - 1.3 * Math.sin(x * 0.11 + 1.2) - 0.8 * Math.sin(x * 0.29))
      for (let y = t; y <= HORIZON; y++) c.set(x, y, HILLS[y === t ? 2 : x < 30 ? 1 : 0] ?? 0)
    }

    const shadowOf = (x: number, y: number) =>
      ((x - 13) / 11) ** 2 + ((y - 25.5) / 3.2) ** 2 < 1 ||
      ((x - 52) / 13) ** 2 + ((y - 15) / 1.8) ** 2 < 1
    for (let y = HORIZON + 1; y < H; y++) {
      const z = depth(y)
      const band = bandOf(z)
      const isBandEdge = bandOf(depth(y + 1)) !== band && y < H - 1
      const width = WIDTHS[band] ?? 24
      const haze = z > 8 ? 0.7 : z > 5 ? 0.5 : z > 3.2 ? 0.3 : z > 2.2 ? 0.12 : 0
      for (let x = 0; x < W; x++) {
        const X = cam + (x - 32) * z
        const u = (X + (OFFSETS[band] ?? 0)) / width
        const col = mod(Math.floor(u), Math.round(PERIOD / width))
        const crop = CROPS[Math.floor(hash(col, band, 5) * CROPS.length)] ?? CROPS[0]
        const isHedge = z < 6 && (isBandEdge || (u - Math.floor(u)) * width < z * 0.95)
        const isShadow = shadowOf(x, y)
        let color: number
        const dr = Math.abs(wrap(X - riverAt(z)))
        const tx = wrap(X - TOWN_X)
        if (z > TOWN_Z[0] - 0.05 && z < TOWN_Z[1] + 0.1 && Math.abs(tx) < 15) {
          color = shade(hex('6e7a4a 8a925a a8aa70'), isShadow ? 0 : 1 + (hash(Math.floor(X / 3), y) > 0.7 ? 1 : 0), x, y)
        } else if (dr < 2.4) {
          const glint = !isShadow && z < 3 && hash(Math.floor(X / 2), y, Math.floor(f / 6)) > 0.93
          color = RIVER[glint ? 3 : isShadow ? 0 : dr > 1.6 ? 1 : 2] ?? 0
        } else if (isHedge) {
          color = HEDGE[isShadow ? 0 : 1] ?? 0
        } else {
          const isRow = z < 2.4 && crop !== CROPS[2] && crop !== CROPS[0] && Math.floor(X / 2.5) % 2 === 0
          const isTree = crop === CROPS[5] && z < 2.2 && Math.floor(X / 3) % 2 === 0 && y % 2 === 0
          color = shade(crop, (isShadow ? 0 : 1.2) + (isRow ? -0.6 : 0) + (isTree ? 0.8 : 0) + (z < 1.6 ? 0.3 : 0), x, y)
        }
        c.set(x, y, haze > 0 ? mix(color, HAZE, haze) : color)
      }
    }

    const townZ = (TOWN_Z[0] + TOWN_Z[1]) / 2
    const yOf = (zz: number) => Math.round(HORIZON - 0.5 + 20.5 / zz)
    const houses: [number, number, boolean][] = [
      [-10, 1.5, false], [-6, 1.2, false], [-2, 1.45, false], [4, 1.25, false], [8, 1.5, false],
      [11, 1.2, false], [-13, 1.25, false], [1, 1.15, true], [-8, 1.4, true],
    ]
    houses.sort((p, q) => q[1] - p[1])
    for (const lap of [-1, 0, 1]) {
    const tx0 = Math.round(32 + (wrap(TOWN_X - cam) + lap * PERIOD) / townZ)
    if (tx0 < -20 || tx0 > W + 20) continue
    for (const [dx, zz, isChurch] of houses) {
      const hx = tx0 + dx
      const base = yOf(zz)
      if (isChurch) {
        for (let y = base - 4; y <= base; y++) {
          c.set(hx, y, STONE[2] ?? 0)
          c.set(hx + 1, y, STONE[1] ?? 0)
        }
        c.set(hx + 2, base, STONE[1] ?? 0)
        c.set(hx + 3, base, STONE[0] ?? 0)
        c.set(hx + 2, base - 1, SLATE[2] ?? 0)
        c.set(hx + 3, base - 1, SLATE[1] ?? 0)
        c.set(hx, base - 5, SLATE[2] ?? 0)
        c.set(hx + 1, base - 5, SLATE[1] ?? 0)
        c.set(hx, base - 6, SLATE[2] ?? 0)
        c.set(hx, base - 7, SLATE[1] ?? 0)
        c.set(hx + 1, base - 3, SLATE[0] ?? 0)
      } else {
        for (let i = 0; i < 3; i++) c.set(hx + i, base, WALL[i === 0 ? 2 : i === 1 ? 1 : 0] ?? 0)
        c.set(hx, base - 1, ROOF[2] ?? 0)
        c.set(hx + 1, base - 1, ROOF[1] ?? 0)
        c.set(hx + 2, base - 1, ROOF[0] ?? 0)
        c.set(hx + 1, base, WALL[0] ?? 0)
      }
    }
    }

    c.ellipse(BALLOON_X + 16, 28.5, 4.5, 1.6, (x, y) => mix(c.get(x, y), 0x14281c, 0.4))
    c.ellipse(BALLOON_X + 16, 30.5, 1, 0.6, (x, y) => mix(c.get(x, y), 0x14281c, 0.3))

    const bx = BALLOON_X
    const by = top + 19
    c.line(bx - 3, top + 17, bx - 2, by, WICKER[0] ?? 0)
    c.line(bx + 3, top + 17, bx + 2, by, WICKER[0] ?? 0)
    const reach = f >= 26 && f <= 41
    c.set(bx, by - 1, 0x2a2a3a)
    c.set(bx - 1, by, 0xe0a07a)
    if (reach) c.set(bx, by - 2, 0xe0a07a)
    for (let y = by + 1; y <= by + 3; y++) {
      for (let x = bx - 2; x <= bx + 2; x++) {
        const lit = (x < bx ? 1 : 0) + (y === by + 1 ? 1 : 0) + fl * 0.8
        c.set(x, y, shade(WICKER, 1 + lit - (x === bx + 2 ? 1 : 0) + ((x + y) % 2 === 0 ? 0.3 : 0), x, y))
      }
    }
    const phase = (f / LOOP) * (4 * Math.PI) / 6
    for (let r = 0; r <= 17; r++) {
      const hw = halfWidth(r)
      for (let x = Math.floor(bx - hw); x <= Math.ceil(bx + hw); x++) {
        const dx = x - bx
        if (Math.abs(dx) > hw - 0.4 || r > 16) continue
        const nx = clamp(dx / hw, -1, 1)
        const lon = Math.asin(nx) + phase
        const stripe = mod(Math.floor(lon / (Math.PI / 6)), 4)
        const ramp = stripe === 0 ? RED : stripe === 2 ? BLUE : CREAM
        const ny = r < 7.6 ? (r - 7.6) / 8.2 : 0.25
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
        const lit = -0.62 * nx - 0.5 * ny + 0.6 * nz
        const inner = fl * Math.max(0, 1 - Math.hypot(dx * 0.9, r - 18) / 10) * 3.2
        c.set(x, top + r, shade(ramp, 1.3 + lit * 2.6 + inner + (r === 0 ? 0.5 : 0), x, top + r))
      }
    }
    for (let x = bx - 2; x <= bx + 2; x++) c.set(x, top + 17, shade(RED, 0.4 + fl * 2 + (x < bx ? 0.5 : 0), x, top + 17))
    c.set(bx - 1, by - 1, 0x4a4a58)
    c.set(bx + 1, by - 1, 0x2e2e3a)
    if (fl > 0) {
      const tall = f === 30 || f === 31 ? 5 : f < 34 ? 4 : 2 + (f % 3 === 0 ? 1 : 0)
      for (let k = 0; k < tall; k++) {
        const y = by - 2 - k
        c.set(bx, y, FLAME[4 - Math.min(4, k)] ?? 0)
        if (k < tall - 1 && (k === 0 || f % 2 === 0)) c.set(bx + (k % 2 === 0 ? -1 : 1), y, FLAME[1] ?? 0)
      }
    }

    const lead = 74 - (f - 38) * 1.45
    if (f >= 38) {
      for (const [ox, oy, ph] of [[0, 0, 0], [3, -1, 1], [6, -2, 2], [3, 2, 3], [7, 3, 1]] as const) {
        const x = Math.round(lead + ox)
        const y = Math.round(6 + oy + wave(f, LOOP, 4, ox * 0.05) * 0.6)
        const flap = Math.floor((f + ph) / 2) % 3
        c.set(x, y, 0x1c2433)
        const wy = flap === 0 ? -1 : flap === 1 ? 0 : 1
        c.set(x - 1, y + wy, 0x2a3446)
        c.set(x + 1, y + wy, 0x2a3446)
      }
    }

    out.push(c.px)
  }

  return out
}

export const scene: Scene = { verb: 'Gallivanting', render, hero: 31 }
