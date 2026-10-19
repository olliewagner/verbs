import { Canvas, PALETTE, TAU, beat, ease, hex, lightAt, mix, shade, type Light, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 60

const WALL = hex('050509 0a0a14 10111f 17192c 1f2339 2a2f4a')
const DESK = hex('120706 1e0d09 2e150d 432013 5a2e1b 763f25 965432 b46c40')
const SHADE = hex('041a12 08301c 0e4828 18663a 26864e 3ea866 6ccc86 b0eeb2')
const BRASS = PALETTE.gold
const FRAME = hex('0e0807 1a0f0b 291810 3b2316 4f301d 664027 805232')
const BEAD = hex('1a0606 320c0a 521610 76221a 9c3424 c04e30 dc7444 f2a066 fdd8a4')
const PAPER = hex('2e2a26 4e4840 7a7062 a89a84 d0c2a6 eee2c8')
const INK = 0x1e1a2a

const LAMP = { x: 12, y: 10 }
const MOTH = [['x.x', '.o.', '...'], ['...', 'xox', '...'], ['...', '.o.', 'x.x'], ['...', 'xox', '...']]
const vignette = (x: number, y: number) => (((x - 20) / 50) ** 2 + ((y - 14) / 26) ** 2) * 1.2

const AX0 = 23
const AX1 = 63
const AY0 = 3
const AY1 = 25
const IX0 = AX0 + 2
const IX1 = AX1 - 2
const RODS = [7, 12, 17, 22]
const BEADS = 5
const BW = 5
const leftX = (i: number) => IX0 + i * BW
const rightX = (i: number) => IX1 - (BEADS - i) * BW + 1

const MOVES: (readonly [number, number, number])[][] = [
  [[5, 2, 4], [21, 4, 4], [50, 0, 4]],
  [[3, 3, 4], [11, 1, 4], [36, 2, 7], [51, 0, 4]],
  [[7, 4, 4], [25, 2, 4], [52, 0, 4]],
  [[9, 1, 4], [23, 5, 4], [28, 3, 4], [53, 0, 4]],
]
const FINAL = { rod: 1, bead: 1, lands: 43 }

type BeadState = { x: number; isImpact: boolean; isMoving: boolean }

function bead(r: number, i: number, f: number): BeadState {
  let count = 0
  let x = rightX(i)
  let isImpact = false
  let isMoving = false
  for (const [start, next, dur] of MOVES[r] ?? []) {
    const wasLeft = i < count
    const isLeft = i < next
    const from = wasLeft ? leftX(i) : rightX(i)
    const to = isLeft ? leftX(i) : rightX(i)
    if (f < start) break
    count = next
    x = to
    if (from === to) continue
    const end = start + dur
    const isSlow = r === FINAL.rod && start === 36
    if (f < end) {
      x = from + (to - from) * (isSlow ? ease.inOut(beat(f, start, end)) : beat(f, start, end))
      isMoving = true
    } else if (f === end) {
      x = isSlow ? to - Math.sign(to - from) : to
      isImpact = true
    }
  }
  return { x: Math.round(x), isImpact, isMoving }
}
function lampPower(f: number): number {
  return f === 17 ? 0.72 : f === 18 ? 0.9 : f === 31 ? 0.85 : 1
}

function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const power = lampPower(f)
    const lights: Light[] = [{ x: LAMP.x, y: LAMP.y, power: 2.4 * power, radius: 62 }]
    const lit = (x: number, y: number) => lightAt(lights, x, y)
    const c = new Canvas()
    const solid = new Uint8Array(W * H)
    const mark = (x: number, y: number) => {
      if (x >= 0 && x < W && y >= 0 && y < H) solid[y * W + x] = 1
    }
    for (let y = AY0; y <= AY1; y++) for (let x = AX0; x <= AX1; x++) {
      if (y <= AY0 + 1 || y >= AY1 - 1 || x <= AX0 + 1 || x >= AX1 - 1) mark(x, y)
    }
    const beads: { r: number; i: number; s: BeadState }[] = []
    RODS.forEach((ry, r) => {
      for (let x = IX0; x <= IX1; x++) mark(x, ry)
      for (let i = 0; i < BEADS; i++) {
        const s = bead(r, i, f)
        beads.push({ r, i, s })
        for (let dy = -1; dy <= 1; dy++) for (let dx = dy === 0 ? 0 : 1; dx <= (dy === 0 ? 4 : 3); dx++) mark(s.x + dx, ry + dy)
      }
    })
    for (let y = 0; y < 26; y++) {
      for (let x = 0; x < W; x++) {
        const l = lit(x, y) * 0.55
        const isShadow = solid[(y - 1) * W + x - 4] === 1
        const stripe = x % 6 === 0 ? -0.5 : 0
        c.set(x, y, shade(WALL, 1.4 + (isShadow ? l * 0.2 : l) * 3.2 + stripe - vignette(x, y)))
      }
    }
    for (let y = 0; y < 14; y++) {
      for (let x = 0; x < 28; x++) {
        const d = Math.hypot((x - 12) / 1.6, y - 6)
        if (d < 9) c.set(x, y, mix(c.get(x, y), SHADE[2] ?? 0, (d < 6.5 ? 0.45 : 0.25) * power))
      }
    }
    for (let y = 26; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const pool = Math.hypot((x - 13) / 2.6, (y - 27.5) * 1.6)
        const grain = Math.sin(x * 0.35 + y * 2.1 + Math.sin(x * 0.11) * 3) > 0.75 ? -0.7 : 0
        const edge = y === 26 ? -0.8 : 0
        c.set(x, y, shade(DESK, 1.6 + lit(x, y) * 2.2 + (pool < 9 ? 1 : 0) + (pool < 5 ? 0.8 : 0) + grain + edge - vignette(x, y) * 0.8))
      }
    }
    for (let y = 27; y < H; y++) {
      const skew = (y - 27) * 1
      for (let x = 31 + skew; x <= 45 + skew; x++) {
        c.set(x, y, shade(PAPER, 1.6 + lit(x, y) * 2.4 + (x === 31 + skew ? -0.6 : 0)))
      }
    }
    for (const [y, x0, x1] of [[28, 33, 35], [28, 37, 41], [30, 35, 38], [30, 40, 42]] as const) {
      for (let x = x0; x <= x1; x++) c.set(x, y, mix(c.get(x, y), INK, 0.5))
    }
    for (let k = 0; k < 9; k++) c.set(48 + k, 31 - Math.floor(k / 3), k === 0 ? 0x2a2420 : k < 7 ? shade(BRASS, 3.4 + lit(48 + k, 30) * 1.5) : 0xd88a8a)
    for (let y = AY0; y <= AY1 + 1; y++) {
      for (let x = AX0; x <= AX1; x++) {
        const isRail = y <= AY0 + 1 || (y >= AY1 - 1 && y <= AY1)
        const isPost = x <= AX0 + 1 || x >= AX1 - 1
        const isFoot = y === AY1 + 1 && (x <= AX0 + 2 || x >= AX1 - 2)
        if (!isRail && !isPost && !isFoot) continue
        const l = lit(x, y)
        const face = (y === AY0 || y === AY1 - 1 ? 1 : 0) + (x === AX0 || x === AX1 - 1 ? 0.5 : 0) - (x === AX1 ? 0.8 : 0) - (y === AY1 ? 0.6 : 0)
        c.set(x, y, shade(FRAME, 1.4 + l * 3.4 + face * l * 1.4))
      }
    }
    for (const [x, y] of [[AX0, AY0], [AX1 - 1, AY0], [AX0, AY1 - 1], [AX1 - 1, AY1 - 1]] as const) {
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        c.set(x + dx, y + dy, shade(BRASS, 2.2 + lit(x, y) * 2 + (dx === 0 && dy === 0 ? 1 : 0)))
      }
    }
    for (const ry of RODS) for (let x = IX0; x <= IX1; x++) c.set(x, ry, shade(BRASS, 1.2 + lit(x, ry) * 3.2))
    for (const { r, i, s } of beads) {
      const ry = RODS[r] ?? 0
      const l = lit(s.x + 2, ry)
      const isFinal = r === FINAL.rod && i === FINAL.bead && f >= FINAL.lands - 7 && f < 50
      const base = 1.6 + l * 3.4 + (isFinal ? 0.6 : 0)
      const px: readonly [number, number, number][] = [
        [1, -1, 1], [2, -1, 1], [3, -1, 1], [0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, -1], [4, 0, -1],
        [1, 1, 0], [2, 1, -1], [3, 1, -1],
      ]
      if (s.isMoving) {
        const dir = Math.sign(s.x - bead(r, i, f - 1).x)
        for (let k = 1; k <= 3; k++) c.tint(dir > 0 ? s.x - k : s.x + 4 + k, ry, BEAD[3] ?? 0, 0.7 - k * 0.18)
      }
      for (const [dx, dy, k] of px) c.set(s.x + dx, ry + dy, shade(BEAD, base + k * (0.8 + l * 0.6)))
      if (l > 0.3) c.set(s.x + 1, ry - 1, shade(BEAD, base + 2.4))
      if (s.isImpact) {
        const ex = s.x + (bead(r, i, f - 1).x < s.x ? 5 : -1)
        c.set(ex, ry - 2, 0xf4d6a0)
        c.set(ex, ry + 2, 0xc89a68)
      }
    }
    const g = f - FINAL.lands
    if (g >= 0 && g <= 4) {
      const ry = RODS[FINAL.rod] ?? 0
      const gx = bead(FINAL.rod, FINAL.bead, f).x + 1
      const gy = ry - 1
      const arm = g === 1 || g === 2 ? 2 : g === 4 ? 0 : 1
      c.set(gx, gy, 0xffffff)
      for (let k = 1; k <= arm; k++) {
        const col = k === 1 ? 0xfff2c8 : 0xe8b878
        c.set(gx - k, gy, col)
        c.set(gx + k, gy, col)
        c.set(gx, gy - k, col)
        c.set(gx, gy + k, col)
      }
    }
    for (let x = 6; x <= 18; x++) {
      const dx = (x - 12) / 6.5
      if (Math.abs(dx) > 1) continue
      c.set(x, 25, shade(BRASS, 3.2 + lit(x, 25) * 1.1 - dx * 1.2 + (Math.abs(dx) < 0.3 ? 0.8 : 0)))
      c.set(x, 26, shade(BRASS, 2 + lit(x, 26) * 1.2 - dx * 1.4))
      if (Math.abs(dx) < 0.85) c.set(x, 27, shade(DESK, 0.4))
    }
    for (let y = 11; y <= 24; y++) {
      c.set(12, y, shade(BRASS, 3.6 + (y > 21 ? 0.5 : 0)))
      c.set(13, y, shade(BRASS, 2))
    }
    for (const x of [11, 12, 13, 14]) c.set(x, 18, shade(BRASS, x === 11 ? 5 : x === 14 ? 2 : 3.6))
    const rows: readonly [number, number, number][] = [[4, 6, 18], [5, 4, 20], [6, 3, 21], [7, 3, 21], [8, 3, 21], [9, 2, 22]]
    for (const [y, x0, x1] of rows) {
      for (let x = x0; x <= x1; x++) {
        const isCap = x === x0 && y >= 6 || x === x1 && y >= 6
        if (isCap) {
          c.set(x, y, shade(BRASS, 3 + (x === x0 ? 1.5 : 0)))
          continue
        }
        if (y === 9) {
          c.set(x, y, shade(BRASS, 6.4 * power + Math.max(0, 1 - Math.abs(x - 12) / 9) * 1.2))
          continue
        }
        const sheen = y === 5 && x > 6 && x < 15 ? 2 : y === 4 ? 1 : 0
        c.set(x, y, shade(SHADE, (2.6 + sheen - (y - 5) * 0.35 - Math.abs(x - 11) * 0.06) * (0.85 + power * 0.15)))
      }
    }
    for (let y = 10; y <= 13; y++) c.set(17, y, shade(BRASS, 3))
    c.set(17, 14, shade(BRASS, 5))
    const t = (f / LOOP) * TAU * 2
    const mx = Math.round(12 + 9 * Math.sin(t))
    const my = Math.round(12 + 3 * Math.sin(2 * t + 1))
    const isBehind = Math.cos(t) < 0 && my < 10
    if (!isBehind) {
      const moth = MOTH[f % MOTH.length] ?? []
      c.sprite(mx - 1, my - 1, moth, { x: 0xd8c8a8, o: 0x8a7a64 })
    }
    out.push(c.px)
  }
  return out
}
export const scene: Scene = { verb: 'Calculating', render, hero: 44 }