import { Canvas, PALETTE, TAU, clamp, hash, hex, mix, mod, particles, shade, smoothstep, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 64
const PERIOD = 64
const P0 = 20
const P1 = 42
const MX = 36
const GY = 11
const TR = 3.6

const SKY = hex('4f8fd8 66a3e2 80b8ec 9ccbf2 bcdcf5 d8ecf8')
const CLOUD = hex('9cc0e6 c8dcf2 eef4fb ffffff')
const SUNC = hex('fff2b0 fffadc ffffff')
const GRASS = PALETTE.grass
const TOPSOIL = hex('1c100c 2a1810 3a2215 4c2e1c 603c24 76502f')
const CLAY = hex('2e140e 4a2015 642c1a 7e3c22 98502c b06638 c6824c')
const MOUND = hex('3e2418 5a361f 784a2a 965f36 b27744 c89056 dcac70')
const DEEP = hex('16141e 201e2a 2c2a38 3a3848 4c4a5c 646274')
const TUNNEL = hex('0b0605 140c09 1e130e')
const ROOT = hex('5e4a34 86704e b09a72')
const STONE = hex('1e1a22 34303a 4c4652 68606c 88808a aca4ac')
const BONE = hex('8a7c66 c8b898 eee2c6')
const MOLE = hex('0c0a12 1a1724 2a2638 3c3750 524c68 6c6584 8e86a6')
const PINK = hex('7a2c46 b85470 e5899e fbbcc6')
const PETAL = hex('c8ccd8 ffffff')
const CAP = hex('6a1418 b02a26 e04a36')

const TRAVEL = LOOP - (P1 - P0)
const DIST: number[] = (() => {
  const v = (s: number) => smoothstep(0, 9, s) * (1 - smoothstep(TRAVEL - 9, TRAVEL, s))
  const raw: number[] = [0]
  let d = 0
  for (let s = 0; s < TRAVEL; s++) {
    for (let k = 0; k < 10; k++) d += v(s + (k + 0.5) / 10) / 10
    raw.push(d)
  }

  return raw.map(r => (r / d) * PERIOD)
})()

function moleX(f: number): number {
  const k = Math.floor(f / LOOP)
  const g = mod(f, LOOP)
  const x = g >= P0 && g <= P1 ? MX : g > P1 ? MX + (DIST[g - P1] ?? 0) : MX + (DIST[g + LOOP - P1] ?? 0) - PERIOD
  return x + k * PERIOD
}
const camAt = (f: number) => Math.round(moleX(f)) - MX

const tunnelY = (wx: number) => 21.5 + 1.2 * Math.sin((TAU * wx) / PERIOD)
const topsoilEnd = (m: number) => 17 + Math.sin((TAU * m * 2) / PERIOD + 0.5) + 0.5 * Math.sin((TAU * m * 5) / PERIOD + 1)
const clayEnd = (m: number) => 26.5 + Math.sin((TAU * m * 3) / PERIOD + 2)

function tunnelAge(wx: number, f: number): number {
  if (moleX(f) + 7 < wx) return -1
  for (let k = 1; k < LOOP; k++) if (moleX(f - k) + 7 < wx) return k - 1
  return LOOP
}

type Pixel = readonly [number, number, number]
const ROOTS: Pixel[] = [
  [4, 12, 1], [4, 13, 1], [5, 14, 1], [5, 15, 1], [6, 16, 0], [3, 14, 1], [2, 15, 0],
  [9, 12, 1], [9, 13, 1], [10, 14, 1], [10, 15, 1], [10, 16, 1], [11, 17, 0], [8, 14, 0],
  [26, 12, 1], [26, 13, 1], [25, 14, 1], [25, 15, 0], [27, 14, 0],
  [45, 12, 1], [46, 13, 1], [46, 14, 0], [44, 13, 0],
  [55, 12, 1], [55, 13, 1], [56, 14, 1], [56, 15, 1], [57, 16, 0], [54, 14, 0],
]
const STONES = [[17, 14.5, 1.8, 1.1], [43, 15, 1.3, 0.9], [61, 14, 1.6, 1], [6, 28.5, 3, 1.8], [27, 29.5, 2.3, 1.5], [52, 28, 3.3, 2.1]] as const
const BONE_ART = ['ww...ww', '.wwwww.', 'ww...ww']

const blade = (m: number) => {
  const g = Math.floor(m / 3)
  const tuft = hash(g, 11)
  if (tuft < 0.45) return 0
  const k = m % 3
  return k === 1 ? (tuft > 0.8 ? 3 : 2) : hash(g, k, 12) > 0.4 ? 1 : 0
}

const HEAD = [
  '..oddmo..',
  '.odmmmlo.',
  'odmmmmmlo',
  'odmmmmmlo',
  'odmmnmmlo',
  'odmnNnmlo',
  'odmmmmmlo',
]
const PAW = ['qp.', 'qpp']

function headY(s: number): number | undefined {
  if (s < 6 || s > 18) return undefined
  return s === 6 ? 2 : s === 17 ? 2 : s === 18 ? 5 : 3
}
type Eyes = 'open' | 'shut' | 'sun'
function eyes(s: number): Eyes {
  if (s === 6 || s === 7 || s === 12 || s === 13) return 'shut'
  if (s >= 9 && s <= 11) return 'sun'
  return 'open'
}

function moundHeight(f: number, isCurrent: boolean): number {
  if (!isCurrent) return 3.6
  const s = f - P0
  if (s < 3) return 0
  return [1, 2, 3, 4.4, 4][s - 3] ?? 3.6
}

function drawSky(c: Canvas, s: number): void {
  const flash = s === 6 ? 1 : s === 7 ? 0.6 : s === 8 ? 0.3 : 0
  for (let y = 0; y < GY; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - 55, y - 3)
      let col = shade(SKY, 0.4 + y * 0.42 + (d < 9 + flash * 4 ? 1 : 0) + (d < 5.5 + flash * 3 ? 1 : 0))
      if (d < 2.6) col = shade(SUNC, 2 - d * 0.6)
      c.set(x, y, col)
    }
  }
  if (flash > 0.5) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) {
      for (let k = 4; k <= (dx && dy ? 5 : 6); k++) c.set(55 + dx * k, 3 + dy * k, SUNC[k > 4 ? 0 : 1] ?? 0)
    }
  }
  for (const [cx, cy, w] of [[12, 3, 5], [25, 6, 3.5]] as const) {
    for (let y = cy - 2; y <= cy + 1; y++) {
      for (let x = cx - w - 2; x <= cx + w + 2; x++) {
        const lobe = Math.hypot((x - cx) / (w + 1), (y - cy + 0.5) / 1.6) < 1 || Math.hypot((x - cx - 1.5) / (w * 0.55), (y - cy + 1.6) / 1.2) < 1
        if (!lobe) continue
        c.set(x, y, shade(CLOUD, y === cy + 1 ? 0.6 : y === cy ? 1.6 : 2.6 + (x > cx ? 0.4 : 0)))
      }
    }
  }
}

function drawGround(c: Canvas, cam: number, f: number): void {
  for (let x = 0; x < W; x++) {
    const m = mod(x + cam, PERIOD)
    const b1 = topsoilEnd(m)
    const b2 = clayEnd(m)
    for (let y = GY; y < H; y++) {
      const depth = (y - GY) * 0.035
      let col: number
      if (y === GY) col = shade(GRASS, 5 + (hash(Math.floor(m / 2), 3) > 0.6 ? 1 : 0))
      else if (y === GY + 1) col = shade(GRASS, 2 + (hash(Math.floor(m / 3), 4) > 0.5 ? 1 : 0))
      else if (y < b1) {
        const fleck = hash(Math.floor(m / 2), y, 5) > 0.88 ? 1 : 0
        col = shade(TOPSOIL, 3 - depth + fleck - (y > b1 - 1 ? 1 : 0))
      } else if (y < b2) {
        const strata = mod(y + Math.round(1.5 * Math.sin(m * 0.21)), 3) === 0 ? -0.6 : 0
        col = shade(CLAY, 3.6 - depth * 2 + strata - (y > b2 - 1 ? 1 : 0))
      } else {
        const fleck = hash(Math.floor(m / 3), y, 9) > 0.92 ? 1 : 0
        col = shade(DEEP, 3 - depth * 1.5 + fleck)
      }
      c.set(x, y, col)
    }
    const hb = blade(m)
    for (let k = 1; k <= hb; k++) c.set(x, GY - k, shade(GRASS, 5 + (hash(Math.floor(m / 2), 3) > 0.6 ? 1 : 0) + (k === 3 ? 1 : 0)))
  }
  for (const [rm, ry, k] of ROOTS) {
    const x = mod(rm - cam, PERIOD)
    c.set(x, ry, ROOT[k + 1] ?? 0)
  }
  for (const [sm, sy, rx, ry] of STONES) for (const sx of [mod(sm - cam + 8, PERIOD) - 8, mod(sm - cam + 8, PERIOD) + PERIOD - 8]) {
    for (let y = Math.floor(sy - ry); y <= Math.ceil(sy + ry); y++) {
      for (let x = Math.floor(sx - rx); x <= Math.ceil(sx + rx); x++) {
        const nx = (x - sx) / rx
        const ny = (y - sy) / ry
        const r2 = nx * nx + ny * ny
        if (r2 > 1) continue
        c.set(x, y, shade(STONE, 2.4 - nx * 0.9 - ny * 1.3 + (r2 > 0.7 && ny > 0 ? -0.8 : 0)))
      }
    }
  }
  for (const bx of [mod(36 - cam + 8, PERIOD) - 8, mod(36 - cam + 8, PERIOD) + PERIOD - 8]) c.sprite(bx, 28, BONE_ART, { w: (x: number, y: number) => shade(BONE, y === 28 ? 2 : x > bx + 3 ? 1 : 1.4) })
  for (const wx of [mod(52 - cam + 8, PERIOD) - 8, mod(52 - cam + 8, PERIOD) + PERIOD - 8]) for (let i = 0; i < 5; i++) {
    const wy = 14 + Math.round(Math.sin(i * 1.3 + (f / LOOP) * TAU * 6) * 0.6)
    c.set(wx + i, wy, shade(PINK, i === 4 ? 3 : 2))
  }
  for (const dm of [9, 55, 9 + PERIOD, 55 + PERIOD]) {
    const x = mod(dm - cam + 4, PERIOD) - 4 + (dm >= PERIOD ? PERIOD : 0)
    const sway = Math.round(Math.sin((f / LOOP) * TAU * 2 + dm) * 0.7)
    for (let y = GY - 3; y < GY; y++) c.set(x + (y < GY - 2 ? sway : 0), y, shade(GRASS, 4))
    const hx = x + sway
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) c.set(hx + dx, GY - 4 + dy, PETAL[dx > 0 || dy < 0 ? 1 : 0] ?? 0)
    c.set(hx, GY - 4, 0xf2c230)
  }
  for (const tx of [mod(21 - cam + 4, PERIOD) - 4, mod(21 - cam + 4, PERIOD) + PERIOD - 4]) {
    for (let dx = -2; dx <= 2; dx++) c.set(tx + dx, GY - 3, shade(CAP, 1.6 + dx * 0.4))
    for (let dx = -1; dx <= 1; dx++) c.set(tx + dx, GY - 4, shade(CAP, 2 + dx * 0.5))
    c.set(tx - 1, GY - 3, 0xfbeedc)
    c.set(tx + 1, GY - 4, 0xfbeedc)
    c.set(tx, GY - 2, 0xe8dcc8)
    c.set(tx, GY - 1, 0xc8bca8)
  }
}

function loose(m: number, y: number): number {
  const lump = hash(Math.floor(m / 3), Math.floor(y / 2), 21) > 0.6 ? 1 : 0
  if (y < GY) return shade(TOPSOIL, 4 + lump)
  return y < topsoilEnd(m) ? shade(TOPSOIL, 3.6 + lump) : y < clayEnd(m) ? shade(CLAY, 4.4 + lump) : shade(DEEP, 3.6 + lump)
}

function drawTunnels(c: Canvas, cam: number, f: number): void {
  const mole = moleX(f)
  for (let x = 0; x < W; x++) {
    const wx = x + cam
    const m = mod(wx, PERIOD)
    const ty = tunnelY(wx)
    const age = tunnelAge(wx, f)
    if (age < 0) continue
    const ahead = wx - (mole + 4)
    const reach = ahead > 0 ? TR * Math.sqrt(Math.max(0, 1 - (ahead / 3.6) ** 2)) : TR
    if (reach <= 0.3) continue
    const fill = clamp((age - 7) / 14)
    const top = Math.round(ty - reach)
    const bottom = Math.round(ty + reach)
    const fillTop = bottom + 1 - fill * (bottom - top + 1)
    for (let y = top; y <= bottom; y++) {
      if (y >= fillTop) c.set(x, y, loose(m, y))
      else c.set(x, y, shade(TUNNEL, (y - top) / Math.max(1, bottom - top) * 2.4))
    }
    c.set(x, top - 1, mix(c.get(x, top - 1), 0x000000, 0.35))
    if (fill < 0.05) c.set(x, bottom + 1, mix(c.get(x, bottom + 1), 0x000000, 0.2))
    if (age > 2 && age < 20 && hash(m, 31) > 0.8) {
      const phase = mod(age + Math.floor(hash(m, 32) * 6), 6)
      const cy = top + Math.round((phase / 5) * Math.max(0, fillTop - top - 1))
      if (cy < fillTop) c.set(x, cy, loose(m, top + 1))
    }
  }
  for (const [mh, isCurrent] of [[MX, true], [MX - PERIOD, false]] as const) {
    if (isCurrent && f < P0 + 2) continue
    const left = isCurrent ? f - (P1 - 2) : f + LOOP - (P1 - 2)
    const fill = clamp((left - 2) / 10)
    for (let wx = mh - 3; wx <= mh + 3; wx++) {
      const x = wx - cam
      if (x < 0 || x >= W) continue
      const ty = Math.round(tunnelY(wx))
      const fillTop = ty + 1 - fill * (ty - GY)
      for (let y = GY; y <= ty; y++) {
        const edge = Math.abs(wx - mh) === 3
        if (edge && fill < 0.6) c.set(x, y, mix(c.get(x, y), 0x000000, 0.35))
        else if (!edge) c.set(x, y, y >= fillTop ? loose(mod(wx, PERIOD), y) : shade(TUNNEL, 0.4 + (y - GY) * 0.12))
      }
    }
  }
}

function drawMounds(c: Canvas, cam: number, f: number): void {
  for (const [mh, isCurrent] of [[MX, true], [MX - PERIOD, false]] as const) {
    const h = moundHeight(f, isCurrent)
    if (h <= 0) continue
    const mx = mh - cam
    const rx = 3.5 + h * 1.4
    for (let x = Math.floor(mx - rx); x <= Math.ceil(mx + rx); x++) {
      const dx = (x - mx) / rx
      if (Math.abs(dx) > 1) continue
      const top = GY + 0.4 - h * (1 - dx * dx) ** 0.7
      for (let y = Math.round(top); y <= GY; y++) {
        const lump = hash(Math.floor((x + cam) / 2), Math.floor(y / 2), 41) > 0.55 ? 0.8 : 0
        const lit = dx * 1.2 + (y === Math.round(top) ? 1 : 0) - (y === GY ? 0.8 : 0)
        c.set(x, y, shade(MOUND, 2.6 + lit + lump))
      }
    }
  }
}

function drawMoleSide(c: Canvas, cx: number, cy: number, theta: number, paw: number, clipY: number): void {
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  const local = (x: number, y: number) => {
    const du = x - cx
    const dv = y - cy
    return [du * cos + dv * sin, -du * sin + dv * cos] as const
  }
  const body = (u: number, v: number) => (u / 5.6) ** 2 + (v / 3) ** 2 <= 1 || ((u - 4) / 2.8) ** 2 + ((v - 0.3) / 2.2) ** 2 <= 1
  const part = (x: number, y: number): string | undefined => {
    const [u, v] = local(x, y)
    if (u > 6.2 && u < 8.4 && v > -0.3 && v < 1.5 - (u - 6.2) * 0.35) return 'n'
    if (((u - 3 - paw) / 1.7) ** 2 + ((v - 2.9) / 1.2) ** 2 <= 1) return 'p'
    if (((u + 3.6) / 1.2) ** 2 + ((v - 2.8) / 0.9) ** 2 <= 1) return 'q'
    if (body(u, v)) return 'b'
    if (u < -5.4 && u > -7.2 && Math.abs(v + 0.4) < 0.6) return 't'
    return undefined
  }
  for (let y = Math.floor(cy - 9); y <= Math.ceil(cy + 9); y++) {
    if (y < clipY) continue
    for (let x = Math.floor(cx - 9); x <= Math.ceil(cx + 9); x++) {
      const p = part(x, y)
      if (p === undefined) continue
      const [u, v] = local(x, y)
      if (p === 'n') c.set(x, y, shade(PINK, u > 7.4 ? 3 : 2))
      else if (p === 'p') c.set(x, y, shade(PINK, v < 2.6 ? 3 : 2))
      else if (p === 'q' || p === 't') c.set(x, y, shade(PINK, 1.4))
      else {
        const isEdge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => part(x + (dx ?? 0), y + (dy ?? 0)) === undefined)
        const sheen = v < -1.6 && u > -3 && u < 3 ? 1 : 0
        const eye = Math.abs(u - 4.7) < 0.5 && Math.abs(v + 0.9) < 0.5
        c.set(x, y, eye ? MOLE[0] ?? 0 : shade(MOLE, isEdge ? 1 : 3.4 - v * 0.35 + sheen))
      }
    }
  }
}

function drawHead(c: Canvas, x: number, y: number, look: Eyes, nose: number): void {
  const pal: Record<string, number> = {
    o: MOLE[1] ?? 0, d: MOLE[3] ?? 0, m: MOLE[5] ?? 0, l: MOLE[6] ?? 0, n: PINK[3] ?? 0, N: PINK[1] ?? 0,
  }
  c.sprite(x, y, HEAD, pal)
  const shift = look === 'sun' ? 1 : 0
  for (const ex of [2, 6]) {
    if (look === 'shut') {
      c.set(x + ex - 1, y + 3, MOLE[2] ?? 0)
      c.set(x + ex, y + 3, MOLE[2] ?? 0)
      continue
    }
    c.set(x + ex + shift, y + 3, 0x07060a)
    c.set(x + ex + shift, y + 2, 0xffffff)
  }
  if (nose) {
    c.set(x + 4, y + 3, PINK[2] ?? 0)
    c.set(x + 4, y + 5, PINK[3] ?? 0)
  }
}

function drawPaws(c: Canvas, x: number, y: number): void {
  const pal = { p: PINK[3] ?? 0, q: PINK[2] ?? 0 }
  c.sprite(x - 2, y, PAW, pal)
  c.sprite(x + 8, y, PAW, pal, true)
}

function drawClods(c: Canvas, cam: number, f: number): void {
  for (const p of particles(f, LOOP, 40, 7, 0xc10d)) {
    const born = f - p.t
    if (moleX(born + 1) - moleX(born) < 0.6) continue
    const wx = moleX(born) - 6 - p.r[1] * 2 - p.t * (0.4 + p.r[2] * 0.5)
    const y0 = tunnelY(moleX(born)) + 0.5
    const y = Math.min(y0 + 3, y0 - 1.6 * p.t + 0.35 * p.t * p.t)
    c.set(Math.round(wx - cam), Math.round(y), loose(0, 20 + (p.i % 3)))
  }
}

function drawSpray(c: Canvas, f: number): void {
  const t = f - P0 - 6
  if (t < 0 || t > 7) return
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1
    const vx = side * (1.1 + hash(i, 51) * 1.6)
    const vy = -1.3 - hash(i, 52) * 1.5
    const x = MX + side * 2 + vx * t
    const y = GY - 5 + vy * t + 0.45 * t * t
    if (y > GY - 1) continue
    c.set(Math.round(x), Math.round(y), shade(MOUND, 2 + (i % 3)))
  }
}

function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const cam = camAt(f)
    const s = f - P0
    drawSky(c, s)
    drawGround(c, cam, f)
    drawTunnels(c, cam, f)
    const travelling = s < 0 || s > 22
    const speed = Math.min(1, Math.abs(moleX(f + 1) - moleX(f)))
    const paw = travelling ? speed * ([-1.5, -0.5, 0.5, 1.5, 0][mod(f - P1 - 1, LOOP) % 5] ?? 0) : 0
    const hy = headY(s)
    if (travelling) {
      drawMoleSide(c, MX, Math.round(tunnelY(moleX(f))), 0, paw, 0)
    } else {
      const ty = Math.round(tunnelY(MX))
      const turn = s <= 3 ? s / 3 : s >= 19 ? (22 - s) / 3 : 1
      const rise = s <= 3 ? s : s <= 5 ? 3 + (s - 3) : s >= 19 ? 22 - s : 5
      drawMoleSide(c, MX, ty - rise, (-Math.PI / 2) * turn, 0, hy !== undefined ? GY + 1 : 0)
    }
    drawSpray(c, f)
    if (hy !== undefined) drawHead(c, MX - 4, hy, eyes(s), s === 10 || s === 15 ? 1 : 0)
    drawMounds(c, cam, f)
    if (hy !== undefined && hy <= 3) drawPaws(c, MX - 4, hy + 5)
    drawClods(c, cam, f)
    out.push(c.px)
  }

  return out
}

export const scene: Scene = {
  verb: 'Burrowing',
  render,
  hero: P0 + 10,
  snaps: [{ frames: P0 + 6, box: [30, 1, 42, 8], colors: [...MOLE, ...PINK, 0x1a1724], why: 'The pop: the mole\'s head bursts out of the molehill in a spray of earth.' }],
}
