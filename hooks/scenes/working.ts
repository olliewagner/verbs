import { Canvas, beat, clamp, ease, hash, hex, lerp, shade, threshold, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96
const PX = 12
const PY = 6
const PAN = 24

const VOID = hex('080402 100804 1a0d06 26140a 341c0e')
const WAX = hex('2c1508 4a240c 6c3612 8e4c1a ae662a cc843c e4a454 f4c676')
const FRESH = hex('9a8460 c4b08a e4d6b4 f8f0dc')
const HONEY = hex('6a2606 963e08 c2600c e88a16 fab02a ffd04c ffea92 fffadc')
const CAP = hex('6a4a26 8e6a34 b08a44 cca858 e2c274 f2dc9a fdf0c8')
const STRIPE = hex('120a06 2a1a0c 6a4610 a8741c d8a030 f2c450')
const FUZZ = hex('3a2210 6a421e 9a6430 c68a46 e2ac62')
const WING = hex('8aa0b0 c4d4de eef6fa')
const GLASS = hex('4a5058 7a8288 a39e98 d4cab2 f4eedc')
const POLLEN = [hex('5a2408 8a3a10 c46a1a e8a030 f8c860'), hex('3e400c 6a6a14 a0a428 c8cc50 e4e88a'), hex('4a160e 7a2418 b0402a d8684a f09a78')]

const pollenOf = (cell: Cell) => {
  if (cell.i === 1 || cell.i === 3) return undefined
  const h = hash(cell.i + 20, ((cell.j % 4) + 4) % 4, 9)
  return h < 0.2 ? POLLEN[Math.floor(h * 15)] : undefined
}

type Spot = { dj: number; di: number; dx: number; dy: number; isWall: boolean }
const TILE: Spot[] = (() => {
  const tile: Spot[] = []
  for (let ly = 0; ly < PY; ly++) {
    for (let lx = 0; lx < PX; lx++) {
      const near: { j: number; i: number; d: number; dx: number; dy: number }[] = []
      for (let j = -2; j <= 3; j++) {
        for (let i = -2; i <= 2; i++) {
          const cx = 6 * j + 4.5
          const cy = 6 * i + 3 + 3 * (j & 1)
          near.push({ j, i, d: Math.hypot(lx - cx, (ly - cy) * 1.05), dx: lx - cx, dy: ly - cy })
        }
      }
      near.sort((a, b) => a.d - b.d)
      const [a, b] = near
      if (!a || !b) continue
      tile.push({ dj: a.j, di: a.i, dx: a.dx, dy: a.dy, isWall: b.d - a.d < 1 })
    }
  }
  return tile
})()

type Cell = { j: number; i: number }
const centreX = (cell: Cell) => 6 * cell.j + 4.5
const centreY = (cell: Cell) => 6 * cell.i + 3 + 3 * (cell.j & 1)

function spotAt(X: number, Y: number): { cell: Cell; dx: number; dy: number; isWall: boolean } {
  const tx = Math.floor(X / PX)
  const ty = Math.floor(Y / PY)
  const s = TILE[(Y - ty * PY) * PX + (X - tx * PX)] ?? { dj: 0, di: 0, dx: 0, dy: 0, isWall: true }
  return { cell: { j: s.dj + 2 * tx, i: s.di + ty }, dx: s.dx, dy: s.dy, isWall: s.isWall }
}

const START = 56
const BUILD = 8
const EMPTY = 10
const FULL = 25
const CAPPING = 29
const CAPPED = 37

const ragged = (i: number) => hash(i + 50, 3) * 3 - 1.5 + ((6 * i + 4.5 - 16) / 16) ** 2 * 9
const camAt = (f: number) => (f / LOOP) * PAN
const progress = (cell: Cell, f: number) => START - (centreX(cell) - camAt(f) + ragged(cell.i))
const fill = (p: number) => clamp((p - EMPTY) / (FULL - EMPTY))
const capped = (p: number) => clamp((p - CAPPING) / (CAPPED - CAPPING))

const BEE = [
  '...ww......',
  '..wwWw.l...',
  '.sKsKsFFh.a',
  'KsKsKsFFHH.',
  '.sKsKsFFh.a',
  '..wwWw.l...',
  '...ww......',
]

type Dir = 0 | 1 | 2 | 3

function drawBee(c: Canvas, x: number, y: number, dir: Dir, lit: number, f: number, opts: { buzz?: number; pump?: boolean; walk?: boolean; chew?: boolean } = {}) {
  const paint: Record<string, number> = {
    s: shade(STRIPE, 3.4 + lit * 1.8), K: STRIPE[0] ?? 0,
    f: shade(FUZZ, 1 + lit * 2.4), F: shade(FUZZ, 1.8 + lit * 2.4), h: STRIPE[1] ?? 0, H: STRIPE[1] ?? 0,
    a: STRIPE[1] ?? 0, l: STRIPE[0] ?? 0, w: shade(WING, 1 + lit * 1.4), W: shade(WING, 1.6 + lit * 1.4),
  }
  const dots: [number, number, number, boolean][] = []
  const put = (dx: number, dy: number, col: number, isWing: boolean) => {
    const [rx, ry] = dir === 0 ? [dx, dy] : dir === 1 ? [-dy, dx] : dir === 2 ? [-dx, -dy] : [dy, -dx]
    dots.push([x + rx, y + ry, col, isWing])
  }
  BEE.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const ch = row[rx] ?? '.'
      if (ch === '.') continue
      if (rx === 0 && opts.pump && f % 4 < 2) continue
      const dx = rx - 5 - (ch === 'l' && opts.walk && f % 4 < 2 ? 1 : 0) - (ch === 'a' && opts.chew && f % 6 < 3 ? 1 : 0)
      const dy = ry - 3
      const col = paint[ch] ?? 0
      const buzz = opts.buzz ?? 0
      if (ch !== 'w' && ch !== 'W') put(dx, dy, col, false)
      else {
        if (threshold(dx, dy) < lerp(1, 0.6, buzz)) put(dx, dy, col, true)
        const out = dy + (dy < 0 ? -1 : 1)
        if (threshold(dx, out) < 0.5 * buzz) put(dx, out, col, true)
      }
    }
  })
  for (const [px, py, , isWing] of dots) if (!isWing) c.tint(px + 1, py + 1, 0x080402, 0.6)
  for (const [px, py, col, isWing] of dots) c.set(px, py, isWing ? glass(c.get(px, py), col) : col)
}

function glass(under: number, wing: number): number {
  const luma = (0.299 * ((under >> 16) & 255) + 0.587 * ((under >> 8) & 255) + 0.114 * (under & 255)) / 255
  return shade(GLASS, 0.6 + luma * 2.6 + Math.max(0, WING.indexOf(wing)) * 0.5)
}
function rider(f: number, row: number, zone: number, at: (cell: Cell) => [number, number]): [number, number, number, number] {
  const camX = Math.floor(camAt(f))
  for (let j = Math.floor(camX / 6) - 2; j < Math.floor(camX / 6) + 13; j++) {
    const cell: Cell = { j, i: row }
    const p = progress(cell, f)
    if (p < zone - 3 || p >= zone + 3) continue
    const [x0, y0] = at(cell)
    const q = beat(p, zone + 1.5, zone + 3)
    const t = q < 0.5 ? 2 * q * q : 1 - 2 * (1 - q) ** 2
    if (t <= 0) return [x0 - camX, y0, beat(p, zone - 3, zone + 1.5), -1]
    const [x1, y1] = at({ j: j + 1, i: row })
    const cam = (q: number) => Math.floor(camAt(f) + q - p)
    return [lerp(x0 - cam(zone + 1.5), x1 - cam(zone + 3), t), lerp(y0, y1, t), -1, beat(p, zone + 1.5, zone + 3)]
  }
  return [-20, -20, 0, -1]
}
function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const camX = Math.floor(camAt(f))
    const j0 = Math.floor(camX / 6) - 2

    const lights: [number, number, number][] = []
    for (let j = j0; j < j0 + 15; j++) {
      for (let i = -1; i <= 5; i++) {
        const p = progress({ j, i }, f)
        const glow = pollenOf({ j, i }) ? 0 : fill(p) * (1 - capped(p) * 0.8)
        if (glow > 0.05) lights.push([centreX({ j, i }) - camX, centreY({ j, i }), glow])
      }
    }
    const lightAt = (x: number, y: number) => {
      let sum = 0.1
      for (const [lx, ly, power] of lights) {
        const d = Math.hypot(x - lx, (y - ly) * 1.2)
        if (d < 18) sum += power * 0.36 * (1 - d / 18) ** 1.3
      }
      return Math.min(1.5, Math.round(sum * 5) / 5)
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const s = spotAt(x + camX, y)
        const p = progress(s.cell, f)
        const vg = Math.round((((x - 34) / 40) ** 2 + ((y - 16) / 18) ** 2) * 2.4) / 2
        const lit = lightAt(x, y) - vg * 0.35
        const dark = shade(VOID, 0.8 + lit * 2.2, x, y)
        if (s.isWall) {
          const reach = Math.abs(Math.atan2(s.dy, -s.dx)) / Math.PI
          if (p < BUILD * reach) {
            c.set(x, y, dark)
            continue
          }
          const fresh = 1 - clamp((p - BUILD) / 6)
          c.set(x, y, fresh > 0.3 ? shade(FRESH, 0.8 + lit * 2, x, y) : shade(WAX, 3 + lit * 2.6, x, y))
          continue
        }
        if (p < BUILD * 0.5) {
          c.set(x, y, dark)
          continue
        }
        const cl = lightAt(centreX(s.cell) - camX, centreY(s.cell)) - vg * 0.35
        const r = Math.hypot(s.dx / 4, s.dy / 2.4)
        const pollen = pollenOf(s.cell)
        if (pollen && fill(p) > 0 && 2.5 - s.dy < fill(p) * 5) {
          const l = -s.dx * 0.2 - s.dy * 0.35
          c.set(x, y, shade(pollen, 1.6 + (l > 0.4 ? 1 : l < -0.5 ? -1 : 0) + (r > 0.85 ? -0.6 : 0) + cl, x, y))
          continue
        }
        const cap = pollen ? 0 : capped(p)
        if (cap > 0 && r > 1 - cap * 1.05) {
          const l = -s.dx * 0.18 - s.dy * 0.4
          const band = l > 0.5 ? 2 : l > -0.4 ? 1 : 0
          const seam = cap < 1 && r < 1.2 - cap * 1.05 ? -1 : 0
          c.set(x, y, shade(CAP, 2 + band + seam + cl * 1.2, x, y))
          continue
        }
        const level = fill(p)
        const height = 2.5 - s.dy
        if (level > 0 && height < level * 5) {
          const surface = level < 0.97 && height >= level * 5 - 1
          const core = r < 0.55 ? 1 : 0
          const gloss = level > 0.9 && s.dx > -2 && s.dx < 0 && s.dy > -2 && s.dy < 0 ? 1.4 : 0
          c.set(x, y, shade(HONEY, 2 + level * 1.6 + core + cl + (surface ? 1.2 : 0) + gloss, x, y))
          continue
        }
        const lip = r > 0.8 && s.dy > 0 ? 1.4 : r > 0.8 ? 0.5 : 0
        c.set(x, y, shade(WAX, lip + cl * 1.6, x, y))
      }
    }
    for (let j = j0; j < j0 + 15; j++) {
      for (let i = -1; i <= 5; i++) {
        const p = progress({ j, i }, f)
        const cx = Math.round(centreX({ j, i }) - camX - 0.5)
        const cy = centreY({ j, i })
        if (pollenOf({ j, i })) continue
        if (p >= FULL && p < FULL + 0.75) {
          c.set(cx, cy - 1, HONEY[7] ?? 0)
          c.set(cx - 1, cy - 1, HONEY[7] ?? 0)
        }
        if (p >= CAPPED && p < CAPPED + 0.75) {
          c.set(cx - 1, cy - 1, CAP[6] ?? 0)
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.set(cx - 1 + dx, cy - 1 + dy, CAP[5] ?? 0)
        }
      }
    }
    const beeLit = (x: number, y: number) => clamp(lightAt(x, y) * 0.9)
    const [bx, by, bt, bs] = rider(f, 2, 4, cell => [centreX(cell) + 2, centreY(cell)])
    drawBee(c, bx, by, 2, beeLit(bx, by) + 0.2, f, { buzz: bs >= 0 ? Math.sin(bs * Math.PI) : 0, walk: bt < 0, chew: bt >= 0 })
    const [fx, fy, ft] = rider(f, 1, 18, cell => [centreX(cell) - 0.5, centreY(cell) - 4])
    drawBee(c, fx, fy, 1, beeLit(fx, fy), f, { pump: ft >= 0, walk: ft < 0 })
    const [kx, ky, kt] = rider(f, 3, 33, cell => [centreX(cell) - 2, centreY(cell)])
    const rim = kt >= 0 ? [1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 0, 0, 0, 0][Math.round(kt * 18)] ?? 0 : 0
    drawBee(c, kx + rim, ky, 0, beeLit(kx, ky), f, { walk: true })
    const t = ((f + 30) % 48) / 48
    const there = ease.out(beat(t, 0, 0.36)) - ease.in(beat(t, 0.64, 1))
    const wx = Math.round(lerp(72, 58, there))
    const wy = Math.round(lerp(t < 0.5 ? 30 : 4, 26, there))
    drawBee(c, wx, wy, t < 0.5 ? 2 : 3, beeLit(wx, wy) + 0.15, f, { buzz: clamp((1 - there) * 10), walk: true })
    out.push(c.copy())
  }
  return out
}
export const scene: Scene = {
  verb: 'Working',
  render,
  hero: 40,
  snaps: [{ frames: 25, box: [38, 19, 43, 20], colors: [...HONEY.slice(4, 7)], why: 'a cell brims: its two-pixel flash, then the gloss on the full honey' }],
}
