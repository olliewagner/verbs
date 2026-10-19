import { Canvas, TAU, beat, hex, lerp, shade, smoothstep, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const DESK = hex('080b14 0e1322 172038 25304a 3a3f55 57505a 7c6460 a07e6a')
const BOARD = hex('1e1214 3a2016 5a3420 7c4a2a 9c6434 bc8244 d8a45c')
const PAPER = hex('4c4c6a 7c7c9c aaa8be d2ccd6 ece4e0 fbf5ec fffdf6')
const CLIP = hex('1c1c28 3c3c4c 6a6a7c a0a0b2 d4d4e0 f6f6fa')
const LAMP = hex('2a0c10 4e1418 7a2020 a83428 d0503a')
const MUG = hex('0f2422 1a3a38 2a5a54 3e7e72 5ea494 8ccab4')
const STEAM = hex('2a3048 444c68 69728e')
const BODY = hex('5a3a10 a8701a e0a828 f8d048 fff090')
const ERASER = hex('8a3848 d06878 f4a0aa')
const WOOD = hex('a07048 e0b080')
const LEAD = 0x262838
const INK = 0x2a2c40
const GOLD = hex('c08a20 ffd860 fff6c8')

const lamp = (x: number, y: number) => Math.max(0, 1 - Math.hypot(x - 37, (y - 12) * 1.25) / 36) ** 1.1

const BOARD_X0 = 16
const BOARD_X1 = 46
const PAGE_X0 = 18
const PAGE_X1 = 44
const PAGE_Y0 = 4
const BOX_X = 21
const ROW_Y = [8, 14, 20, 26] as const
const WORDS = [[4, 1, 5, 1, 3], [6, 1, 4], [3, 1, 6, 1, 2], [5, 1, 3, 1, 4]] as const

const TICK_AT = [6, 24, 42, 60] as const
const SPARKLE_AT = 68
const BACK_TO = 82
const FLIP_FROM = 75
const FLIP_TO = 94
const APPROACH = 85

const STROKE = [[1, 2, 0.6], [1, 2, 0], [2, 3, 0], [3, 2, 0], [4, 1, 0], [5, 0, 0], [6, -1, 0], [7, -2, 1.6]] as const
const MARK = [[1, 2, 1], [2, 3, 2], [3, 2, 3], [4, 1, 4], [5, 0, 5], [6, -1, 6]] as const
const REST: readonly [number, number, number] = [45, 23, 3]
const SHADOW_LIFT = 1.5
function glide(t: number, r = 0.15): number {
  const v = 1 / (1 - r)
  if (t <= 0) return 0
  if (t >= 1) return 1
  if (t < r) return (v * t * t) / (2 * r)
  if (t > 1 - r) return 1 - (v * (1 - t) ** 2) / (2 * r)
  return v * (t - r / 2)
}
const KEYS: (readonly [number, number, number, number, number])[] = []
for (const [i, at] of TICK_AT.entries()) {
  for (const [t, [dx, dy, lift]] of STROKE.entries()) KEYS.push([at + t, BOX_X + dx, (ROW_Y[i] ?? 0) + dy, lift, i < 3 && t === STROKE.length - 1 ? 0.4 : 0])
}
KEYS.push([BACK_TO, ...REST, 0], [APPROACH, ...REST, 1.2], [LOOP + TICK_AT[0], BOX_X + 1, ROW_Y[0] + 2, 0.6, 0])
function tip(f: number): [number, number, number] {
  const g = f < TICK_AT[0] ? f + LOOP : f
  for (let k = 0; k < KEYS.length - 1; k++) {
    const [f0, x0, y0, l0, arc] = KEYS[k] ?? [0, 0, 0, 0, 0]
    const [f1, x1, y1, l1] = KEYS[k + 1] ?? [0, 0, 0, 0, 0]
    if (g < f0 || g >= f1) continue
    const p = glide(beat(g, f0, f1), f1 - f0 > 12 ? 0.2 : 0.15)
    return [lerp(x0, x1, p), lerp(y0, y1, p), lerp(l0, l1, p) + Math.sin(p * Math.PI) * arc]
  }
  return [KEYS[0]?.[1] ?? 0, KEYS[0]?.[2] ?? 0, KEYS[0]?.[3] ?? 0]
}
function inked(i: number, f: number): number {
  if (f >= FLIP_TO) return 0
  return f - (TICK_AT[i] ?? 0)
}
function page(x: number, y: number, f: number, isOld: boolean): number {
  const flash = [0.3, 0.24, 0.14, 0.05][f - SPARKLE_AT] ?? 0
  const light = lamp(x, y) + flash
  const base = shade(PAPER, 2.6 + light * 3.2, x, y)
  if (y === 5 && x >= BOX_X && x <= BOX_X + 13) return PAPER[1] ?? 0
  for (const [i, by] of ROW_Y.entries()) {
    if (isOld) {
      for (const [j, [mx, my, step]] of MARK.entries()) {
        if (x === BOX_X + mx && y === by + my && inked(i, f) >= step) {
          const run = i === 3 ? f - SPARKLE_AT - j : -1
          return run === 0 ? GOLD[2] ?? 0 : run === 1 ? GOLD[1] ?? 0 : INK
        }
      }
    }
    if (y >= by && y <= by + 4 && x >= BOX_X && x <= BOX_X + 4) {
      const edge = y === by || y === by + 4 || x === BOX_X || x === BOX_X + 4
      return edge ? shade(PAPER, 0.6 + light * 1.2, x, y) : base
    }
    if (y === by + 2 && x >= BOX_X + 7) {
      let at = BOX_X + 7
      for (const [k, run] of (WORDS[i] ?? []).entries()) {
        if (x >= at && x < at + run) return k % 2 ? base : shade(PAPER, 1.5 + light * 1.4, x, y)
        at += run
      }
    }
  }
  return base
}
function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const flip = glide(beat(f, FLIP_FROM, FLIP_TO), 0.3)
    const flipping = f >= FLIP_FROM && f < FLIP_TO
    const edge = Math.round(lerp(H - 1, PAGE_Y0, flip))
    const stand = Math.sin(Math.PI * flip)
    c.fill((x, y) => {
      const light = lamp(x, y)
      const isShadow = x + 2 >= BOARD_X0 && x + 2 <= BOARD_X1 && y - 2 >= 1
      const onBoard = x >= BOARD_X0 && x <= BOARD_X1 && y >= 1
      if (onBoard) {
        const rim = x === BOARD_X1 ? 1.2 : x === BOARD_X0 ? -0.8 : 0
        return shade(BOARD, 1.6 + light * 4 + rim, x, y)
      }
      return shade(DESK, 0.6 + light * 5.4 - (isShadow ? 1.6 : 0), x, y)
    })

    const lifted = new Map<number, number>()
    if (flipping) {
      const roll = 2 + Math.round(stand)
      const squash = lerp(1, (edge - roll + 1 - PAGE_Y0) / (H - PAGE_Y0), smoothstep(0.12, 0.75, flip))
      const dark = (c: number) => ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11
      for (let sy = PAGE_Y0; sy < H; sy++) {
        const y = PAGE_Y0 + Math.floor((sy - PAGE_Y0) * squash)
        for (let x = PAGE_X0; x <= PAGE_X1; x++) {
          const col = page(x, sy, f, true)
          const was = lifted.get(y * W + x)
          if (was === undefined || dark(col) < dark(was)) lifted.set(y * W + x, col)
        }
      }
    }
    for (let y = PAGE_Y0; y < H; y++) {
      for (let x = PAGE_X0; x <= PAGE_X1; x++) {
        if (!flipping || f < FLIP_FROM) {
          c.set(x, y, page(x, y, f, f < FLIP_TO))
          continue
        }
        const level = 2.6 + lamp(x, y) * 3.2
        const roll = 2 + Math.round(stand)
        if (y <= edge) {
          const top = y === edge - roll + 1
          const old = lifted.get(y * W + x) ?? shade(PAPER, level, x, y)
          c.set(x, y, y > edge - roll ? shade(PAPER, lerp(level, top ? 4.6 : 6, Math.min(1, stand * 3)), x, y) : old)
        } else {
          const shadow = y - edge <= 1 + Math.round(stand * 2)
          const dark = lerp(level, 1.2 + lamp(x, y) * 1.6, Math.min(1, stand * 2))
          c.set(x, y, shadow ? shade(PAPER, dark, x, y) : page(x, y, f, false))
        }
      }
    }
    for (let y = PAGE_Y0 + 1; y < H; y++) c.set(PAGE_X0 - 1, y, shade(BOARD, 0.8 + lamp(PAGE_X0 - 1, y) * 2, 0, 0))
    for (let y = 0; y <= 5; y++) {
      for (let x = 25; x <= 37; x++) {
        const isPlate = y >= 2 && (y < 5 || (x > 26 && x < 36))
        const isLever = y <= 1 && x >= 28 && x <= 34
        if (!isPlate && !isLever) continue
        const level = isLever ? (y === 0 ? 4.5 : 3) : y === 2 ? 4.4 : y === 5 ? 1.4 : 2.6 + (x > 33 ? 1 : 0)
        c.set(x, y, shade(CLIP, level + lamp(x, y) * 0.8, x, y))
      }
    }
    c.set(31, 3, CLIP[0] ?? 0)
    c.set(32, 3, CLIP[1] ?? 0)
    const mx = 8
    for (let y = 19; y <= 28; y++) {
      for (let x = mx - 4; x <= mx + 4; x++) {
        const isTop = y <= 20
        const body = !isTop || (y === 20 && Math.abs(x - mx) <= 4)
        if (!body && !(y === 19 && Math.abs(x - mx) <= 3)) continue
        const side = (x - mx) / 4
        if (isTop) {
          const rim = y === 19 || Math.abs(x - mx) === 4
          c.set(x, y, rim ? shade(MUG, 3.6 + side * 1.2, 0, 0) : 0x2a160c)
        } else {
          c.set(x, y, shade(MUG, 2.4 + side * 1.6 + (x === mx + 3 ? 1 : 0) - (y === 28 ? 0.8 : 0), x, y))
        }
      }
    }
    c.set(mx + 1, 20, 0x6a4024)
    for (const [x, y] of [[mx + 5, 22], [mx + 6, 23], [mx + 6, 24], [mx + 5, 25]] as const) c.set(x, y, shade(MUG, 3.4, 0, 0))
    for (let x = mx - 3; x <= mx + 5; x++) c.set(x, 29, DESK[1] ?? 0)
    for (let k = 0; k < 2; k++) {
      for (let y = 18; y >= 9; y--) {
        const h = 18 - y
        const phase = (f / LOOP) * 4 + k * 0.5 - h / 9
        const on = ((phase % 1) + 1) % 1 < 0.55
        if (!on) continue
        const x = mx - 1 + k * 2 + Math.round(Math.sin(h * 0.7 + TAU * (f / LOOP) * 3 + k * 2) * (0.5 + h * 0.12))
        c.set(x, y, STEAM[h < 4 ? 2 : h < 7 ? 1 : 0] ?? 0)
      }
    }
    c.poly([[52.6, 3.6], [58.4, 9.4], [65, 5], [65, -1], [55, -1]], (x, y) => {
      const crown = Math.abs((x - 56) - (y - 2)) / 7
      return shade(LAMP, 3.2 - crown * 2.4 - (x + y > 64 ? 0.8 : 0), x, y)
    })
    for (let y = 1; y <= 11; y++) {
      for (let x = 50; x <= 60; x++) {
        const u = (-(x - 55.5) + (y - 6.5)) / Math.SQRT2
        const v = ((x - 55.5) + (y - 6.5)) / Math.SQRT2
        const mouth = (u / 1.7) ** 2 + (v / 4.1) ** 2
        if (mouth > 1) continue
        c.set(x, y, mouth < 0.35 ? 0xffffff : mouth < 0.7 ? 0xfff4d0 : GOLD[1] ?? 0)
      }
    }
    const [tx, ty, lift] = tip(f)
    const across = Math.round(tx - ty + lift * 0.25)
    const px = Math.round((tx + ty - lift * 0.25 + across) / 2)
    const py = px - across
    const off = Math.round(2 + lift * SHADOW_LIFT)
    for (let k = 0; k <= 18; k++) {
      const s = Math.round(k * 0.12)
      for (const w of k >= 4 ? [-1, 0, 1] : [0, 1]) {
        const x = px + k + w - (off >> 1) - s
        const y = py + k + off - (off >> 1) + s
        const under = c.get(x, y)
        if (PAPER.includes(under)) c.set(x, y, PAPER[Math.max(0, PAPER.indexOf(under) - 2)] ?? under)
        else if (BOARD.includes(under)) c.set(x, y, BOARD[Math.max(0, BOARD.indexOf(under) - 2)] ?? under)
        else if (DESK.includes(under)) c.set(x, y, DESK[Math.max(0, DESK.indexOf(under) - 2)] ?? under)
      }
    }
    for (let k = 0; k <= 18; k++) {
      const x = px + k
      const y = py + k
      if (k === 0) {
        c.set(x, y, LEAD)
        continue
      }
      const [left, right] = k === 1 ? [LEAD, WOOD[1] ?? 0]
        : k <= 3 ? [WOOD[0] ?? 0, WOOD[1] ?? 0]
          : k <= 14 ? [BODY[k === 4 ? 1 : 2] ?? 0, BODY[3] ?? 0]
            : k <= 16 ? [CLIP[2] ?? 0, CLIP[4] ?? 0]
              : [ERASER[1] ?? 0, ERASER[2] ?? 0]
      c.set(x, y, left)
      c.set(x + 1, y, right)
      if (k >= 4) c.set(x - 1, y, (k <= 14 ? BODY[0] : k <= 16 ? CLIP[1] : ERASER[0]) ?? 0)
    }
    for (let i = 0; i < 3; i++) {
      const t = f - (TICK_AT[i] ?? 0) - 2
      const by = ROW_Y[i] ?? 0
      if (t === 4) for (const [dx, dy] of [[0, 0], [1, -1], [2, 0], [0, -2]] as const) c.set(BOX_X + 8 + dx, by - 2 + dy, GOLD[2] ?? 0)
      if (t === 5) for (const [dx, dy] of [[2, -1], [-1, -3]] as const) c.set(BOX_X + 8 + dx, by - 2 + dy, GOLD[1] ?? 0)
    }
    if (f >= SPARKLE_AT && f < SPARKLE_AT + 11) {
      const by = ROW_Y[3]
      for (const [sx, sy, delay] of [[BOX_X + 8, by - 3, 0], [BOX_X - 3, by, 2], [BOX_X + 3, by - 5, 1], [BOX_X + 11, by + 2, 3], [BOX_X - 1, by - 5, 4]] as const) {
        const t = f - SPARKLE_AT - delay
        const size = [1, 2, 3, 4, 3, 2, 1][t] ?? 0
        if (size === 0) continue
        c.set(sx, sy, 0xffffff)
        for (let k = 1; k < size; k++) {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.set(sx + dx * k, sy + dy * k, GOLD[k === size - 1 ? 1 : 2] ?? 0)
        }
      }
    }
    out.push(c.px)
  }
  return out
}
export const scene: Scene = { verb: 'Doing', render, hero: SPARKLE_AT + 4 }