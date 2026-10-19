import { Canvas, TAU, clamp, hex, lerp, mod, shade, smoothstep, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const MAPLE = hex('2e2018 4a3424 6e5038 94704c b8926a d6b488 ecd2a6')
const WALNUT = hex('140c0a 22140e 341e14 4a2c1c 603a24 784a2e 8e5c38')
const FRAME = hex('0e0808 1c0f0c 2c1810 42241a 5a3322 74452c')
const TABLE = hex('0a0608 120a0c 1c1012 281618 361e1c')
const WALL = hex('0b0f12 10161a 161e22 1e282b 283434 34423f')
const IVORY = hex('3a2e2a 6a5a4c 9a8670 c4b090 e4d2b0 f8ecd2 fffaee')
const EBONY = hex('08070a 131118 1e1b25 2c2836 403a4c 5a5268 7c7290')
const GLOW = hex('0e3640 16545e 22787e 389e9c 5ec4b8 98e4d2 d4fbee')
const TAKE = hex('3a0e14 621a1e 8e2a26 b84434 dc6a48 f49a6a fdc89e')
const BRASS = hex('2a1a0a 4a3012 6e4a1c 966a2a bc8e3e dcb460 f4dc94')
const STEAM = hex('2a2c34 3c3f4a 545866')
const OUTLINE = 0x120b0a

const K = 0.075
const VB = 0.6
const C = 64.4
const HY = 32 - C
const SQ = 13
const depthOf = (v: number) => 1 + K * (v - VB)
const toScreen = (u: number, v: number): [number, number] => [32 + ((u - 4) * SQ) / depthOf(v), HY + C / depthOf(v)]
function toBoard(x: number, y: number): [number, number] {
  const z = C / (y + 0.5 - HY)
  return [4 + ((x + 0.5 - 32) * z) / SQ, VB + (z - 1) / K]
}

const lamp = (x: number, y: number) => clamp(1 - Math.hypot((x - 29) / 36, (y - 19) / 17))

const ART: Record<string, string[]> = {
  knight: [
    '....##...',
    '...####..',
    '..######.',
    '.#e######',
    '#########',
    '##..#####',
    '....#####',
    '...######',
    '..######.',
    '.########',
  ],
  knightFront: [
    '.#...#.',
    '.##.##.',
    '.#####.',
    '.#e#e#.',
    '..###..',
    '..###..',
    '.#####.',
    '.#####.',
    '.#####.',
    '#######',
  ],
  pawn: ['.###.', '.###.', '..#..', '.###.', '.###.', '#####'],
  rook: ['#.#.#', '#####', '.###.', '.###.', '.###.', '.###.', '#####'],
  bishop: ['..#..', '.###.', '.#e#.', '.###.', '..#..', '.###.', '.###.', '#####'],
  queen: ['#.#.#', '.###.', '..#..', '.###.', '.###.', '.###.', '.###.', '#####'],
  king: ['..#..', '.###.', '..#..', '.###.', '#####', '.###.', '.###.', '.###.', '#####'],
}

type Piece = { kind: string; col: number; row: number; isWhite: boolean }
const PIECES: Piece[] = [
  { kind: 'pawn', col: 2, row: 2, isWhite: true },
  { kind: 'pawn', col: 5, row: 2, isWhite: true },
  { kind: 'pawn', col: 0, row: 3, isWhite: true },
  { kind: 'pawn', col: 2, row: 5, isWhite: false },
  { kind: 'pawn', col: 4, row: 6, isWhite: false },
  { kind: 'pawn', col: 6, row: 5, isWhite: false },
  { kind: 'bishop', col: 5, row: 6, isWhite: false },
  { kind: 'rook', col: 0, row: 7, isWhite: false },
  { kind: 'queen', col: 3, row: 7, isWhite: false },
  { kind: 'king', col: 6, row: 7, isWhite: false },
]
const HOME: [number, number] = [3, 3]
const MOVES: [number, number][] = [[1, 2], [1, 4], [2, 1], [2, 5], [4, 1], [4, 5], [5, 4]]
const isTake = (col: number, row: number) => PIECES.some(p => !p.isWhite && p.col === col && p.row === row)

const KEYS: [number, number, number, number][] = [
  [0, 3, 3, 0],
  [6, 3, 3, 0],
  [12, 3, 3, 4.5],
  [21, 4, 5, 4],
  [27, 4, 5, 4],
  [40, 2, 5, 4],
  [44, 2, 5, 4],
  [47, 2, 5, 2],
  [49, 2, 5, 2],
  [53, 2, 5, 4.5],
  [63, 2, 1, 4],
  [68, 2, 1, 4],
  [80, 3, 3, 4.5],
  [83, 3, 3, 4.5],
  [87, 3, 3, 0],
  [96, 3, 3, 0],
]
const LAND = 87
const FACING: [number, number][] = [[0, -1], [12, -1], [18, 1], [27, 1], [33, -1], [68, -1], [74, 1], [78, 1], [83, -1], [96, -1]]

function glide(t: number, frames: number, ramp = 3): number {
  const r = Math.min(0.45, ramp / frames)
  if (t < r) return (t * t) / (2 * r) / (1 - r)
  if (t < 1 - r) return (t - r / 2) / (1 - r)
  return 1 - (1 - t) ** 2 / (2 * r) / (1 - r)
}

function knightAt(f: number): { u: number; v: number; h: number; face: number } {
  let face = -1
  for (let i = 0; i + 1 < FACING.length; i++) {
    const [f0, a0] = FACING[i] ?? [0, -1]
    const [f1, a1] = FACING[i + 1] ?? [0, -1]
    if (f >= f0 && f < f1) face = lerp(a0, a1, smoothstep(f0, f1, f))
  }
  const bob = 0.5 * Math.sin((f / 12) * TAU) * smoothstep(8, 14, f) * (1 - smoothstep(79, 83, f))
  for (let i = 0; i + 1 < KEYS.length; i++) {
    const [f0, c0, r0, h0] = KEYS[i] ?? [0, 3, 3, 0]
    const [f1, c1, r1, h1] = KEYS[i + 1] ?? [0, 3, 3, 0]
    if (f < f0 || f >= f1) continue
    const t = (f - f0) / (f1 - f0)
    const isMove = c0 !== c1 || r0 !== r1
    const k = f1 === LAND ? t * t : isMove ? glide(t, f1 - f0) : smoothstep(0, 1, t)
    const arc = isMove ? Math.sin(k * Math.PI) * 2 : 0
    return { u: lerp(c0, c1, k) + 0.5, v: lerp(r0, r1, k) + 0.5, h: lerp(h0, h1, k) + arc + bob, face }
  }
  return { u: 3.5, v: 3.5, h: 0, face }
}

function openOf(f: number, col: number, row: number): number {
  const start = 12 + mod(Math.atan2(row - 3, col - 3) / TAU, 1) * 9
  return smoothstep(start, start + 5, f) * (1 - smoothstep(LAND - 2, LAND + 4, f))
}

function glowOf(f: number, col: number, row: number): { g: number; focus: number } {
  let near = 0
  for (let k = 0; k < 4; k++) {
    const kn = knightAt(mod(f - k, LOOP))
    near += clamp(1 - Math.hypot(kn.u - (col + 0.5), kn.v - (row + 0.5)) / 1.1) / 4
  }
  const focus = near * openOf(f, col, row)
  const breathe = 0.12 * Math.sin((f / 8) * TAU + col)
  const g = openOf(f, col, row) * (0.55 + breathe) + focus * 1.6
  return { g, focus: clamp((g - 0.7) / 1.2) }
}
function within(x: number, y: number, col: number, row: number, su: number, sv = su): boolean {
  const [u, v] = toBoard(x, y)
  return Math.abs(u - col - 0.5) < 0.5 * su && Math.abs(v - row - 0.5) < 0.5 * sv
}
function drawPiece(c: Canvas, art: readonly string[], bx: number, by: number, isWhite: boolean, isFlipped: boolean, light: number, squash = 0, scaleX = 1, wobble = 0) {
  const full = art[0]?.length ?? 0
  const narrow = Math.max(3, Math.round(full * scaleX))
  const squashed = squash > 0 ? art.filter((_, j) => j !== 2) : art
  const rows = squashed.map(row => Array.from({ length: narrow }, (_, i) => row[Math.floor(((i + 0.5) * full) / narrow)] ?? '.').join(''))
  const w = rows[0]?.length ?? 0
  const h = rows.length
  const x0 = Math.round(bx - w / 2)
  const y0 = Math.round(by) - h + 1
  const at = (i: number, j: number) => {
    const row = rows[j]
    if (!row) return '.'
    return row[isFlipped ? w - 1 - i : i] ?? '.'
  }
  const solid = (i: number, j: number) => at(i, j) !== '.' && at(i, j) !== ' '
  for (let j = -1; j <= h; j++) {
    for (let i = -1; i <= w; i++) {
      if (solid(i, j) || !isWhite) continue
      if (solid(i - 1, j) || solid(i + 1, j) || solid(i, j - 1) || solid(i, j + 1)) c.set(x0 + i, y0 + j, OUTLINE)
    }
  }
  const ramp = isWhite ? IVORY : EBONY
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (!solid(i, j)) continue
      const isTop = !solid(i, j - 1)
      const isLit = !solid(i + (isFlipped ? -1 : 1), j)
      const isShade = !solid(i - (isFlipped ? -1 : 1), j)
      let level = (isWhite ? 2.2 : 1.2) + light * 2
      if (isTop) level += 1.5
      else if (isLit) level += 1
      else if (isShade && w > 6) level -= 1
      if (j === h - 2 && w > 6) level -= 0.8
      if (at(i, j) === 'e') level = isWhite ? 0.5 : 0
      const dx = j < h / 2 ? wobble : 0
      c.set(x0 + i + dx, y0 + j, shade(ramp, level, x0 + i + dx, y0 + j))
    }
  }
}
function render(): Int32Array[] {
  const out: Int32Array[] = []
  const [farX0, farY] = toScreen(0, 8)
  void farX0
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const kn = knightAt(f)
    const sinceLand = f - LAND
    const [baseX, baseY] = toScreen(3.5, 3.5)
    const ripple = 1 + sinceLand * 2
    const strength = sinceLand >= 0 && sinceLand < 7 ? 1 - sinceLand / 7 : 0
    const glows = new Map<number, { g: number; focus: number }>()
    const ringAt = (x: number, y: number) => Math.hypot((x - baseX) / ripple, (y - baseY - 1) / (ripple * 0.32))
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const l = lamp(x, y)
        if (y < 6) c.set(x, y, shade(WALL, 1.2 + l * 3.4 - (x % 11 === 4 ? 1 : 0), x, y))
        else c.set(x, y, shade(TABLE, 1 + l * 3.6 + (y === 6 ? 1 : 0), x, y))
      }
    }
    for (let y = Math.floor(farY) - 2; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const [u, v] = toBoard(x, y)
        const l = lamp(x, y) + 0.25 * strength * clamp(1 - (Math.abs(ringAt(x, y) - 1) * ripple) / 3)
        if (v > 8.42 || u < -0.42 || u > 8.42) continue
        if (v > 8 || u < 0 || u > 8) {
          const isLip = v > 8.25 || u < -0.25 || u > 8.25
          c.set(x, y, shade(FRAME, 1.6 + l * 3.4 + (isLip ? 1 : 0), x, y))
          continue
        }
        const col = Math.floor(u)
        const row = Math.floor(v)
        const isDark = (col + row) % 2 === 0
        const ramp = isDark ? WALNUT : MAPLE
        const level = 0.8 + l * 4.6
        const isMove = MOVES.some(([mc, mr]) => mc === col && mr === row)
        const open = isMove ? openOf(f, col, row) : 0
        if (open > 0 && within(x, y, col, row, open)) {
          const id = col + row * 8
          const { g, focus } = glows.get(id) ?? glows.set(id, glowOf(f, col, row)).get(id) ?? { g: 0, focus: 0 }
          const edge = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) => !within(x + dx, y + dy, col, row, open))
          const gr = isTake(col, row) ? TAKE : GLOW
          if (edge) c.set(x, y, shade(gr, 2.2 + Math.min(1, g) * 1.4 + focus * 2 + l, x, y))
          else if (within(x, y, col, row, smoothstep(0.1, 0.6, focus) * open, 1)) c.set(x, y, shade(gr, (isDark ? 0.4 : 1) + l * 1.4 + focus * 2.6, x, y))
          else c.set(x, y, shade(ramp, level + 0.7, x, y))
          continue
        }
        c.set(x, y, shade(ramp, level, x, y))
      }
    }
    for (let y = 2; y <= 6; y++) {
      for (let x = 6; x <= 10; x++) {
        const isRim = y === 2
        c.set(x, y, shade(IVORY, (isRim ? 2.6 : 1.6) + (x === 7 ? 0.8 : 0) - (x === 10 ? 0.6 : 0) - (y - 2) * 0.2, x, y))
      }
    }
    c.set(11, 3, IVORY[1] ?? 0)
    c.set(12, 4, IVORY[1] ?? 0)
    c.set(11, 5, IVORY[1] ?? 0)
    for (let x = 7; x <= 9; x++) c.set(x, 2, 0x3a1c10)
    for (let k = 0; k < 3; k++) {
      const p = ((f / LOOP) * 4 + k / 3) % 1
      const sy = 1.6 - p * 4
      const sx = 8 + Math.sin(p * 5 + k * 2) * 1.2
      if (sy >= 0 && p < 0.7) c.set(sx, sy, shade(STEAM, 2 - p * 2.4, 0, 0))
    }
    for (let y = 1; y <= 6; y++) {
      for (let x = 50; x <= 59; x++) {
        const fx = x < 55 ? x - 52 : x - 57
        const isFace = y >= 2 && y <= 4 && Math.abs(fx) <= 1 && !(Math.abs(fx) === 1 && y !== 3)
        const level = isFace ? 3.4 - (y === 4 ? 0.8 : 0) : 1.8 + (y === 1 ? 1.4 : 0) - (x === 59 ? 0.8 : 0) + (x === 50 ? 0.6 : 0)
        c.set(x, y, shade(isFace ? IVORY : WALNUT, level + lamp(x, y) * 1.5, x, y))
      }
    }
    const tick = Math.floor(f / 24) % 4
    const hand = ([[52, 2], [53, 3], [52, 4], [51, 3]] as const)[tick] ?? [52, 2]
    c.set(hand[0], hand[1], OUTLINE)
    c.set(57, 2, OUTLINE)
    c.set(52, 0, BRASS[3] ?? 0)
    c.set(57, 0, BRASS[5] ?? 0)
    type Draw = { v: number; draw: () => void }
    const draws: Draw[] = []
    for (const p of PIECES) {
      const isThreatened = !p.isWhite && p.col === 2 && p.row === 5
      const hovering = Math.hypot(kn.u - 2.5, kn.v - 5.5) < 0.6 && kn.h > 0.5
      const fear = isThreatened && hovering ? (kn.h < 3 ? 2 : 1) : 0
      const shiver = fear === 2 ? ([1, 0, -1, 0][f % 4] ?? 0) : fear === 1 ? ([1, 1, 0, 0, -1, -1, 0, 0][f % 8] ?? 0) : 0
      const hop = (sinceLand === 1 || sinceLand === 2) && Math.hypot(p.col - 3, p.row - 3) < 2.5 ? 1 : 0
      draws.push({
        v: p.row + 0.5,
        draw: () => {
          const [x, y] = toScreen(p.col + 0.5, p.row + 0.5)
          for (let i = -3; i <= 3; i++) {
            const sx = Math.round(x) + i
            c.set(sx, Math.round(y) + 1, shade(TABLE, Math.abs(i) > 2 ? 2 : 0.6, sx, 0))
          }
          drawPiece(c, ART[p.kind] ?? [], x, y - hop, p.isWhite, p.isWhite, lamp(x, y - 4), 0, 1, shiver)
        },
      })
    }
    draws.push({
      v: kn.v,
      draw: () => {
        const [x, y] = toScreen(kn.u, kn.v)
        const rx = Math.max(1.5, 4.5 - kn.h * 0.4)
        for (let i = -Math.round(rx); i <= Math.round(rx); i++) {
          const sx = Math.round(x) + i
          const dark = Math.abs(i) > rx - 1 ? 1.4 : kn.h > 2.5 ? 0.9 : 0.4
          c.set(sx, Math.round(y) + 1, shade(TABLE, dark + kn.h * 0.25, sx, 0))
        }
        const isCrouched = f === 4 || f === 5 || sinceLand === 0 || sinceLand === 1
        const isFront = Math.abs(kn.face) < 0.35
        const art = (isFront ? ART.knightFront : ART.knight) ?? []
        const narrow = isFront ? 1 : lerp(5, 9, (Math.abs(kn.face) - 0.35) / 0.65) / 9
        drawPiece(c, art, x, y - kn.h, true, kn.face > 0, lamp(x, y - 6) + 0.25, isCrouched ? 1 : 0, narrow)
      },
    })
    draws.sort((a, b) => b.v - a.v)
    for (const d of draws) d.draw()
    if (strength > 0) {
      for (let y = Math.floor(baseY - ripple * 0.32); y <= baseY + 2 + ripple * 0.32; y++) {
        for (let x = Math.floor(baseX - ripple - 1); x <= baseX + ripple + 1; x++) {
          if (ringAt(x, y) >= 1 || ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).every(([dx, dy]) => ringAt(x + dx, y + dy) < 1)) continue
          const th = Math.atan2((y - baseY - 1) / 0.32, x - baseX)
          if (Math.sin(th) < -0.2 && Math.abs(Math.cos(th)) < 0.85) continue
          if (mod(Math.floor((th / TAU) * 64), 8) >= 8 - Math.max(0, sinceLand - 2) * 2) continue
          c.set(x, y, shade(GLOW, 5.5 - sinceLand * 0.8, x, y))
        }
      }
      if (sinceLand === 0) {
        for (const [dx, dy] of [[-5, -2], [5, -2], [-7, 0], [7, 0]] as const) c.set(baseX + dx, baseY + dy, GLOW[6] ?? 0)
      }
    }
    out.push(c.px)
  }
  return out
}
export const scene: Scene = { verb: 'Thinking', render, hero: 45 }