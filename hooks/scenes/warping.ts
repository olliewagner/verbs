import { Canvas, TAU, clamp, hash, hex, mod, shade, smoothstep, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72
const SCROLL_X = 64
const SCROLL_Y = 32

const CX = 31.5
const CY = 15.5
const RS = 4.1
const RE = 8.2
const IN = 5.8
const OUT = 17.5
const TILT = 0.2

const SPACE = hex('030208 06040e 0b0717 120b22 1a102e')
const GRID = hex('0d0e24 141738 1d2250 293170 3a47a0 5a6cc8')
const DISK = hex('2a0d14 5a1a1a 8c2e1c bd5422 e08a34 f4bc5a fde28e fff7d6')
const STAR = hex('3a4470 7684b8 c4d0f0 ffffff')
const RING = hex('5a6cc8 9fb4ff d9e4ff ffffff')

const scrollAt = (f: number): [number, number] => {
  const t = f / LOOP
  const p = t + (0.49 / TAU) * Math.sin(TAU * t) - (0.19 / (2 * TAU)) * Math.sin(2 * TAU * t)
  return [SCROLL_X * p, SCROLL_Y * p]
}
const offset = (x: number, y: number, f: number): [number, number] => {
  const [sx, sy] = scrollAt(f)
  return [mod(x - sx - CX + 32, 64) - 32, mod(y - sy - CY + 16, 32) - 16]
}
function source(x: number, y: number, f: number): [number, number] {
  const dx = x - CX
  const dy = y - CY
  const k = 1 - (RE * RE) / Math.max(0.01, dx * dx + dy * dy)
  const [sx, sy] = scrollAt(f)
  return [CX + dx * k + sx, CY + dy * k + sy]
}
function swirl(rho: number, phi: number, f: number): number {
  const turns = rho < 8 ? 6 : rho < 11.5 ? 4 : 3
  const t = Math.sin(3 * phi - (TAU * turns * f) / LOOP + rho * 0.9)
  return t > 0.45 ? 1 : t < -0.55 ? -0.9 : 0
}
type Star = { x: number; y: number; level: number }
const STARS: Star[] = Array.from({ length: 28 }, (_, i) => ({
  x: hash(i, 11) * SCROLL_X,
  y: hash(i, 12) * H,
  level: hash(i, 13) < 0.15 ? 2.6 : hash(i, 13) < 0.5 ? 1.6 : 1,
}))
function images(bx: number, by: number): [number, number, number, number][] {
  const b = Math.max(0.05, Math.hypot(bx, by))
  const ux = bx / b
  const uy = by / b
  const root = Math.sqrt(b * b + 4 * RE * RE)
  const outer = (b + root) / 2
  const inner = (root - b) / 2
  const mag = (t: number) => 1 / Math.abs(1 - (RE / t) ** 4)
  return [
    [CX + ux * outer, CY + uy * outer, outer, mag(outer)],
    [CX - ux * inner, CY - uy * inner, inner, mag(inner)],
  ]
}
function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const [hx, hy] = offset(CX + SCROLL_X / 2 + 0.1, CY + SCROLL_Y / 2 - 0.2, f)
    const beta = Math.hypot(hx, hy)
    const flash = 1 - smoothstep(0.3, 2.2, beta)
    c.fill((x, y) => {
      const e = Math.hypot((x - CX) / 2.1, y - CY)
      return shade(SPACE, e < 4.5 ? 3 : e < 7 ? 2 : e < 11 ? 1 : 0, x, y)
    })
    const lineAt = (v: number, g: number) => Math.abs(v - 8 * Math.round(v / 8)) / Math.max(0.05, g)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = Math.hypot(x - CX, y - CY)
        const fade = smoothstep(RE + 0.5 - flash * 2, RE + 4.5 - flash * 2, d)
        if (fade < 0.45) continue
        const [sx, sy] = source(x, y, f)
        const [ax, ay] = source(x + 0.5, y, f)
        const [bx, by] = source(x, y + 0.5, f)
        const isV = lineAt(sx, Math.hypot(ax - sx, bx - sx) * 2) < 0.5
        const isH = lineAt(sy, Math.hypot(ay - sy, by - sy) * 2) < 0.5
        if (!isV && !isH) continue
        const near = 1 - smoothstep(RE, 26, d)
        const pulse = flash * Math.max(0, 1 - Math.abs(d - (RE + 3 + (1 - flash) * 8)) / 3)
        const level = 0.5 + fade * (0.5 + near * 2.6) + (isV && isH ? 0.6 : 0) + pulse * 2.5
        c.set(x, y, shade(GRID, level, x, y))
      }
    }
    for (const s of STARS) {
      const [bx, by] = offset(s.x, s.y, f)
      const [primary, secondary] = images(bx, by)
      if (primary) {
        const [x, y, , mag] = primary
        c.set(x, y, shade(STAR, s.level + clamp(Math.log2(mag), 0, 1.4), x, y))
      }
      if (secondary && secondary[2] > RS + 1.2 && secondary[3] > 0.25) {
        const [x, y] = secondary
        c.set(x, y, shade(STAR, s.level - 0.8, x, y))
      }
    }
    if (beta > 0.8) {
      for (const [ix, iy, rad, mag] of images(hx, hy)) {
        if (rad < RS + 0.8) continue
        const angle = Math.atan2(iy - CY, ix - CX)
        const spread = clamp(2.4 / beta - 0.3, 0, Math.PI)
        const level = clamp(1.6 + Math.log2(mag), 1, 3)
        if (spread * rad > 0.8) {
          for (let y = Math.floor(CY - rad - 1); y <= Math.ceil(CY + rad + 1); y++) {
            for (let x = Math.floor(CX - rad - 1); x <= Math.ceil(CX + rad + 1); x++) {
              if (Math.abs(Math.hypot(x - CX, y - CY) - rad) > 0.55) continue
              const off = Math.abs(mod(Math.atan2(y - CY, x - CX) - angle + Math.PI, TAU) - Math.PI) / spread
              if (off <= 1) c.set(x, y, shade(RING, level - off * off * 1.8, x, y))
            }
          }
        }
        if (mag < 3) {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.set(ix + dx, iy + dy, shade(STAR, 1, 0, 0))
          c.set(ix, iy, STAR[3] ?? 0)
        }
      }
    }
    if (beta <= 0.8) {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const d = Math.hypot(x - CX, y - CY)
          const band = Math.abs(d - RE)
          if (band < 0.6) c.set(x, y, shade(RING, 1.8 + flash * 1.4, x, y))
          else if (band < 1.4 && flash > 0.5) c.set(x, y, shade(RING, flash * 1.2, x, y))
        }
      }
    }
    const disk = (isFront: boolean) => {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const dx = x - CX
          const dy = (y - CY) / TILT
          if (dy >= 0 !== isFront) continue
          const rho = Math.hypot(dx, dy)
          if (rho < IN || rho > OUT) continue
          const phi = Math.atan2(dy, dx)
          const heat = 6.6 - (rho - IN) * 0.5
          const doppler = 1.1 * Math.cos(phi)
          const edge = rho > OUT - 1 ? -1 : 0
          c.set(x, y, shade(DISK, heat + doppler + swirl(rho, phi, f) + edge, x, y))
        }
      }
    }
    disk(false)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = x - CX
        const dy = y - CY
        const d = Math.hypot(dx, dy)
        if (d < RS) {
          c.set(x, y, 0x000000)
          continue
        }
        const a = Math.atan2(dy, dx)
        const over = Math.max(0, -Math.sin(a))
        const width = 0.9 + 1.5 * over
        if (d < RS + width) {
          const level = 7.2 - (d - RS) * 1.3 - (1 - over) * 1.6 + 0.9 * Math.cos(a) + swirl(IN + 1, -a, f) * 0.8
          c.set(x, y, shade(DISK, level, x, y))
        }
      }
    }
    disk(true)
    out.push(c.px)
  }
  return out
}
export const scene: Scene = {
  verb: 'Warping',
  render,
  hero: 36,
  snaps: [
    { frames: 34, box: [23, 8, 27, 12], colors: [0x9fb4ff], why: 'the arcs close into a ring and it flashes: its halo of light switches on' },
    { frames: 34, box: [36, 19, 41, 23], colors: [0x9fb4ff, 0x0b0717], why: 'the halo switching on, on the ring\'s far side' },
    { frames: 39, box: [23, 6, 31, 12], colors: [0x9fb4ff, 0x1d2250], why: 'the flash ends as the ring splits back into arcs' },
    { frames: 39, box: [23, 19, 40, 25], colors: [0xffffff, 0x9fb4ff], why: 'the flash ending, below the hole' },
  ],
}