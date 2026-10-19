import { Canvas, PALETTE, beat, hash, hex, lerp, mix, shade, threshold, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 80

const WALL = hex('0b0809 120d0d 1a1311 241a16 30231b 3e2d21')
const WOOD = PALETTE.wood
const PAPER = hex('3a3330 5a5048 7e7262 a49680 c8baa0 e2d6bc f4ecd8 fffaf0')
const GRID = PAPER.map(c => mix(c, 0x3c6cc4, 0.12))
const INK = hex('1a2e5c 22428a 2c5cb4 4880d8 7cacee c4dcfc')
const GLAZE = hex('061618 0a2628 0e3a3a 145250 1c6c64 2a8a78 46a88c 76c6a4 b4e2c8 f0fbf0')
const SHADE = hex('0a140f 13241a 1d3626 2a4c34')
const BULB = hex('f6b04a ffd98a fff4d4')
const PENCIL = hex('5a3a0c 9a6a14 d8a428 f4d058')
const STEAM = hex('2a2422 4a423c 7a7066 a89e90 cfc6b6')

const DRAW0 = 1
const DRAW1 = 15
const FILL0 = 19
const FILL1 = 37
const GLEAM = 46
const GLEAM1 = 58
const UNDO0 = 62
const UNDO_ROWS = [10, 11, 12, 14, 16, 18, 20, 22, 23, 24, 25, 26, 27]
const UNDO1 = UNDO0 + UNDO_ROWS.length
const FADE1 = UNDO1 + 4

const CX = 32
const BODY_Y = 20
const BODY_RX = 7.5
const BODY_RY = 6
const BASE_Y = 26
const LID_Y = 15
const LIGHT = (() => {
  const v = [0.5, -0.62, 0.6]
  const n = Math.hypot(...v)
  return v.map(c => c / n) as [number, number, number]
})()

function glaze(nx: number, ny: number, isGlossy = true): number {
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
  const diffuse = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2])
  const hx = LIGHT[0]
  const hy = LIGHT[1]
  const hz = LIGHT[2] + 1
  const hl = Math.hypot(hx, hy, hz)
  const spec = Math.max(0, (nx * hx + ny * hy + nz * hz) / hl) ** 40
  const bounce = ny > 0.55 ? 0.8 : 0
  return 0.9 + Math.round(diffuse * 5.4) + bounce + (!isGlossy ? 0 : spec > 0.5 ? 4 : spec > 0.2 ? 1.6 : 0)
}

type Curve = (t: number) => readonly [number, number]
const bezier = (pts: readonly (readonly [number, number])[]): Curve => t => {
  let p = pts.map(q => [q[0], q[1]] as [number, number])
  while (p.length > 1) p = p.slice(1).map((q, i) => [lerp(p[i]?.[0] ?? 0, q[0], t), lerp(p[i]?.[1] ?? 0, q[1], t)])
  return p[0] ?? [0, 0]
}
const SPOUT = bezier([[26.5, 21], [21, 21.5], [18.5, 14]])
const spoutR = (t: number) => lerp(2.4, 1, t)
const HANDLE = bezier([[37, 16], [46, 13.5], [46, 25], [37.5, 23.5]])
const handleR = () => 1.15

function tube(curve: Curve, radius: (t: number) => number, out: Map<number, number>, isBehind = false): void {
  const samples = Array.from({ length: 60 }, (_, i) => {
    const t = i / 59
    const [x, y] = curve(t)
    return { x, y, r: radius(t) }
  })
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let best = Infinity
      let nx = 0
      let ny = 0
      for (const s of samples) {
        const d = Math.hypot(x - s.x, y - s.y) / s.r
        if (d < best) {
          best = d
          nx = (x - s.x) / s.r
          ny = (y - s.y) / s.r
        }
      }
      if (best > 1) continue
      const key = y * W + x
      if (isBehind && out.has(key)) continue
      out.set(key, glaze(nx * 0.9, ny * 0.9, false))
    }
  }
}

const [POT, LID] = (() => {
  const pot = new Map<number, number>()
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x - CX) / BODY_RX
      const ny = (y - BODY_Y) / BODY_RY
      if (nx * nx + ny * ny > 1 || y > BASE_Y - 1 || y < LID_Y) continue
      pot.set(y * W + x, glaze(nx, ny))
    }
  }
  for (let x = CX - 4; x <= CX + 4; x++) pot.set(BASE_Y * W + x, 1.2 + (x < CX ? 0.8 : 0))
  tube(SPOUT, spoutR, pot)
  const [tx, ty] = SPOUT(1)
  pot.set(Math.round(ty) * W + Math.round(tx), 0.2)
  pot.set(Math.round(ty) * W + Math.round(tx) + 1, 0.6)
  tube(HANDLE, handleR, pot, true)

  const lid = new Map<number, number>()
  for (let y = LID_Y - 4; y <= LID_Y; y++) {
    for (let x = CX - 5; x <= CX + 5; x++) {
      const nx = (x - CX) / 4.6
      const ny = (y - LID_Y) / 3.2
      if (nx * nx + ny * ny > 1) continue
      lid.set(y * W + x, y === LID_Y ? 1.4 + (x < CX ? 0.6 : 0) : glaze(nx, ny * 0.8 - 0.2))
    }
  }
  for (let y = LID_Y - 6; y <= LID_Y - 3; y++) {
    for (let x = CX - 2; x <= CX + 2; x++) {
      const nx = (x - CX) / 1.4
      const ny = (y - (LID_Y - 4.6)) / 1.4
      if (nx * nx + ny * ny > 1) continue
      lid.set(y * W + x, glaze(nx * 0.8, ny * 0.8))
    }
  }
  return [pot, lid] as const
})()

type Stroke = { x: number; y: number; order: number; isBack: boolean }

const WIRE: readonly Stroke[] = (() => {
  const paths: { pts: [number, number][]; isBack?: boolean }[] = []
  const ellipse = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, isBack = false) => {
    const pts: [number, number][] = []
    for (let i = 0; i <= 80; i++) {
      const a = lerp(a0, a1, i / 80)
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry])
    }
    paths.push({ pts, isBack })
  }
  const curve = (c: Curve, r: (t: number) => number, side: number) => {
    const pts: [number, number][] = []
    for (let i = 0; i <= 60; i++) {
      const t = i / 60
      const [x0, y0] = c(Math.max(0, t - 0.01))
      const [x1, y1] = c(Math.min(1, t + 0.01))
      const [x, y] = c(t)
      const len = Math.hypot(x1 - x0, y1 - y0) || 1
      pts.push([x - ((y1 - y0) / len) * r(t) * side, y + ((x1 - x0) / len) * r(t) * side])
    }
    paths.push({ pts })
  }
  const PI = Math.PI
  const cut = Math.asin((BASE_Y - 1 - BODY_Y) / BODY_RY)
  ellipse(CX, BODY_Y, BODY_RX, BODY_RY, cut, PI - cut)
  ellipse(CX, BODY_Y, BODY_RX, BODY_RY, PI - cut, 2 * PI + cut)
  paths.push({ pts: [[CX - 4, BASE_Y], [CX + 4, BASE_Y]] })
  ellipse(CX, LID_Y, 4.6, 3.2, PI, 2 * PI)
  ellipse(CX, LID_Y - 4.6, 1.4, 1.4, 0, 2 * PI)
  curve(SPOUT, spoutR, 1)
  curve(SPOUT, spoutR, -1)
  curve(HANDLE, handleR, 1)
  curve(HANDLE, handleR, -1)
  for (const ry of [16.5, 20, 23.5]) {
    const w = BODY_RX * Math.sqrt(1 - ((ry - BODY_Y) / BODY_RY) ** 2)
    ellipse(CX, ry, w, w * 0.24, 0, PI)
    ellipse(CX, ry, w, w * 0.24, PI, 2 * PI, true)
  }
  ellipse(CX, LID_Y, 4.6, 1.1, 0, PI)
  for (const s of [-0.55, 0, 0.55]) {
    const pts: [number, number][] = []
    for (let y = LID_Y; y <= BASE_Y - 1; y += 0.25) {
      const w = BODY_RX * Math.sqrt(Math.max(0, 1 - ((y - BODY_Y) / BODY_RY) ** 2))
      pts.push([CX + w * s, y])
    }
    paths.push({ pts })
  }

  const lengths = paths.map(p => p.pts.reduce((sum, q, i) => (i === 0 ? 0 : sum + Math.hypot(q[0] - (p.pts[i - 1]?.[0] ?? 0), q[1] - (p.pts[i - 1]?.[1] ?? 0))), 0))
  const total = lengths.reduce((a, b) => a + b, 0)
  const seen = new Set<number>()
  const strokes: Stroke[] = []
  let run = 0
  paths.forEach((p, k) => {
    const run0: { x: number; y: number; along: number }[] = []
    let along = 0
    p.pts.forEach((q, i) => {
      if (i > 0) along += Math.hypot(q[0] - (p.pts[i - 1]?.[0] ?? 0), q[1] - (p.pts[i - 1]?.[1] ?? 0))
      const x = Math.round(q[0])
      const y = Math.round(q[1])
      const last = run0[run0.length - 1]
      if (last === undefined || last.x !== x || last.y !== y) run0.push({ x, y, along })
    })
    const clean: typeof run0 = []
    for (const q of run0) {
      clean.push(q)
      const a = clean[clean.length - 3]
      const b = clean[clean.length - 2]
      if (a !== undefined && b !== undefined && Math.abs(a.x - q.x) === 1 && Math.abs(a.y - q.y) === 1) clean.splice(clean.length - 2, 1)
    }
    clean.forEach(({ x, y, along }) => {
      const key = y * W + x
      if (seen.has(key)) return
      seen.add(key)
      const isBack = p.isBack === true
      if (isBack && (x + y) % 2 === 1) return
      strokes.push({ x, y, order: (run + along) / total, isBack })
    })
    run += lengths[k] ?? 0
  })
  return strokes
})()

const TOP_Y = LID_Y - 6
const smooth = (t: number) => t * t * (3 - 2 * t)

function fillRow(f: number): number {
  if (f < FILL0) return 99
  if (f < FILL1) return BASE_Y - Math.round(smooth(beat(f, FILL0, FILL1)) * (BASE_Y - TOP_Y))
  if (f < UNDO1) return -99
  return 99
}
const undoRow = (f: number) => (f < UNDO0 ? -99 : (UNDO_ROWS[f - UNDO0] ?? 99))

const lidHop = (f: number) => [2, 3, 3, 2, 0, 1, 1, 0][f - FILL1 - 1] ?? 0

const pool = (x: number, y: number) => Math.max(0, 1 - Math.hypot((x - 33) / 34, (y - 22) / 15))
const vignette = (x: number, y: number) => (((x - 32) / 36) ** 2 + ((y - 18) / 24) ** 2) * 1.5

const isPaper = (x: number, y: number) => y >= 13 && x >= 9 - (y - 13) * 0.6 && x <= 55 + (y - 13) * 0.6
const isGrid = (x: number, y: number) => [16, 20, 25, 30].includes(y) && x > 1 && x < 62

function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const isReal = f >= FILL1 && f < UNDO1
    const shadowAmt = f < FILL1 ? 0 : f < UNDO0 ? beat(f, FILL1, FILL1 + 6) : 1 - beat(f, UNDO0, UNDO1)

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = pool(x, y)
        if (y < 12) {
          const glow = Math.max(0, 1 - Math.hypot(x - 48, (y - 6) * 1.3) / 22)
          c.set(x, y, shade(WALL, 1.4 + glow * 4 + p * 1.5 - vignette(x, y) * 0.6, x, y))
        } else if (y === 12) {
          c.set(x, y, shade(WOOD, 3 + p * 3 - vignette(x, y), x, y))
        } else if (!isPaper(x, y)) {
          c.set(x, y, shade(WOOD, 1.6 + p * 3.6 - vignette(x, y) + (y === 13 ? -0.8 : 0), x, y))
        } else {
          const edge = y === 13 ? 0.6 : 0
          c.set(x, y, shade(isGrid(x, y) ? GRID : PAPER, 2.6 + p * 5 - vignette(x, y) + edge, x, y))
        }
      }
    }
    for (let i = 0; i <= 12; i++) {
      const x = 59 - i
      const y = 30 - Math.round(i * 0.42)
      const p = pool(x, y)
      if (i < 10) {
        c.set(x, y, shade(PENCIL, 2 + p * 2.4, x, y))
        c.set(x, y + 1, shade(PENCIL, 0.6 + p * 1.6, x, y))
      } else if (i < 12) c.set(x, y, shade(WOOD, 4.6 + p * 2, x, y))
      else c.set(x, y, shade(WALL, 1, x, y))
    }
    for (const [ax, ay, bx, by] of [[16, 29, 3, 29], [16, 29, 16, 20], [16, 20, 3, 29], [13, 27, 8, 27], [13, 27, 13, 24], [13, 24, 8, 27]] as const) {
      c.line(ax, ay, bx, by, (x, y) => shade(GRID, 1.8 + pool(x, y) * 4, x, y))
    }

    if (shadowAmt > 0) {
      for (let y = BASE_Y - 3; y <= BASE_Y + 3; y++) {
        for (let x = CX - 22; x <= CX + 8; x++) {
          const d = Math.hypot((x - (CX - 6 * shadowAmt)) / (10 * shadowAmt + 0.01), (y - (BASE_Y + 0.5)) / (2.6 * Math.min(1, 0.3 + shadowAmt)))
          const isContact = y >= BASE_Y && y <= BASE_Y + 1 && Math.abs(x - CX) <= 5 * shadowAmt
          if ((d > 1 && !isContact) || !isPaper(x, y)) continue
          if (d > 0.8 && threshold(x, y) > 0.5 && !isContact) continue
          const p = pool(x, y)
          c.set(x, y, shade(GRID, 1.2 + p * 2.4 - (isContact ? 1 : 0), x, y))
        }
      }
    }

    const row = isReal ? Math.max(fillRow(f), undoRow(f)) : fillRow(f)
    const solidFrom = f >= UNDO0 && f < UNDO1 ? undoRow(f) : row
    const hop = lidHop(f)
    const gleamAt = f >= GLEAM && f <= GLEAM1 ? lerp(28, 64, beat(f, GLEAM, GLEAM1)) : -99
    const paint = (key: number, level: number, dy: number) => {
      const x = key % W
      const y = Math.floor(key / W) - dy
      if (y < solidFrom) return
      const band = x + y * 0.9 - gleamAt
      const g = Math.abs(band) < 1.3 ? 4 : Math.abs(band - 3.2) < 0.6 ? 3 : band < 0 && band > -3 ? 2 : band < 0 && band > -4.8 ? 1 : 0
      c.set(x, y, shade(GLAZE, level + g, x, y))
    }
    if (solidFrom < 99) {
      for (const [key, level] of POT) paint(key, level, 0)
      for (const [key, level] of LID) paint(key, level, hop)
    }
    const drawn = f < DRAW0 ? 0 : beat(f, DRAW0, DRAW1) ** 1.5
    const fade = f >= UNDO1 ? beat(f, UNDO1 - 1, FADE1) : 0
    if (fade < 1) {
      let head: Stroke | undefined
      for (const s of WIRE) {
        if (s.order > drawn) continue
        if (s.y >= solidFrom && solidFrom < 99) continue
        if (head === undefined || s.order > head.order) head = s
        const fresh = drawn < 1 && drawn - s.order < 0.04
        if (threshold(s.x, s.y) < fade) continue
        const level = (s.isBack ? 1.6 : 2.6) + (fresh ? 1.4 : 0) + fade * 1.6
        c.set(s.x, s.y, shade(INK, level, s.x, s.y))
      }
      if (head !== undefined && drawn < 1) {
        c.set(head.x, head.y, shade(INK, 5, 0, 0))
        c.tint(head.x + 1, head.y, INK[4] ?? 0, 0.5)
      }
    }
    const scan = f >= FILL0 && f < FILL1 ? fillRow(f) : f >= UNDO0 && f < UNDO1 ? undoRow(f) - 1 : -99
    if (scan > 0) {
      for (const [key] of [...POT, ...LID]) {
        const x = key % W
        const y = Math.floor(key / W)
        if (y === scan) c.set(x, y, shade(INK, 5, x, y))
        else if (y === scan - 1 && (x + f) % 3 === 0) c.set(x, y, shade(INK, 4, x, y))
      }
      for (let k = 0; k < 4; k++) {
        const x = CX - 6 + Math.floor(hash(f, k) * 13)
        const y = scan - 2 - Math.floor(hash(f, k, 1) * 4)
        c.set(x, y, shade(INK, 4 + hash(f, k, 2), 0, 0))
      }
    }
    if (f >= FILL1 && f < FILL1 + 4) {
      const s = f - FILL1
      for (const dir of [-1, 1]) {
        c.set(CX + dir * (6 + s * 2), BASE_Y - (s > 1 ? 1 : 0), shade(PAPER, 7 - s, 0, 0))
        if (s < 2) c.set(CX + dir * (5 + s * 2), BASE_Y - 1, shade(PAPER, 6.4 - s, 0, 0))
      }
    }

    const steam = f < FILL1 + 5 ? 0 : f < UNDO0 ? Math.min(1, (f - FILL1 - 5) / 4) : Math.max(0, 1 - (f - UNDO0) / 3)
    if (steam > 0) {
      const [tx, ty] = SPOUT(1)
      for (const wi of [0, 1]) {
        for (let k = 0; k <= 24; k++) {
          const p = k / 24
          const y = Math.round(ty - 2 - p * 12)
          const x = Math.round(tx - 0.5 + wi * 1.5 + Math.sin(p * 5.5 - f * 0.45 + wi * 2.4) * (0.4 + p * 1.8) + p * 1.2)
          const alpha = Math.sin(p * Math.PI) * (0.55 + 0.45 * Math.sin(p * 9 - f * 0.7 + wi * 3)) * steam * (wi === 0 ? 1 : 0.7)
          if (alpha > threshold(x, y) * 0.7 + 0.12) c.set(x, y, shade(STEAM, 0.8 + alpha * 3.6, x, y))
          if (alpha > 0.55 && p > 0.25 && wi === 0) c.set(x + 1, y, shade(STEAM, alpha * 2.6, x + 1, y))
        }
      }
    }

    drawLamp(c)
    out.push(c.px)
  }
  return out
}

function drawLamp(c: Canvas): void {
  const m = (x: number) => W - 1 - x
  c.line(m(0), 6, m(5), 1, shade(SHADE, 1.4, 0, 0))
  c.line(m(5), 1, m(10), 2, shade(SHADE, 1.4, 0, 0))
  c.set(m(5), 1, shade(SHADE, 3, 0, 0))
  c.poly([[m(8), -1], [m(13), -2], [m(21), 5], [m(13), 10]], (x, y) => {
    const u = W - 1 - x
    return shade(SHADE, 1.2 + (y < 1 ? 1.2 : 0) + (u + y < 15 ? 0.8 : 0), x, y)
  })
  c.line(m(13), 9, m(20), 5, (x, y) => shade(SHADE, 3, x, y))
  c.line(m(14), 10, m(21), 6, (x, y) => shade(BULB, Math.abs(W - 1 - x - 17.5) < 2 ? 2 : 1, x, y))
  c.line(m(15), 10, m(21), 7, (x, y) => shade(BULB, Math.abs(W - 1 - x - 18) < 2 ? 1.4 : 0.4, x, y))
}

export const scene: Scene = { verb: 'Actualizing', render, hero: 45 }
