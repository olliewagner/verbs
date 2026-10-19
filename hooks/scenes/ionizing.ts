import { TAU, beat, ease, frames, hash, hex, lerp, shade, smoothstep, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 60

const PLASMA = hex('0b0618 140a28 1f0f3c 2c1452 3d1a6a 541f86 6e27a4 8c34c0 ad4dd8 cb72ea e4a2f5 f6d4fb ffffff')
const ROOM = hex('040309 07050e 0b0816 110c20 18102c 211638 2b1c46 372454')
const SKY = hex('060a1c 0a1230 101c46 1a2a5e')
const WOOD = hex('07040a 0e0810 170d17 22131f 30192a 412236 552c45')
const PLASTIC = hex('050409 0b0911 13101b 1d1828 2a2238 3c2f4e 54406a')
const SKIN = hex('120a12 1e0f1a 2e1724 422030 5a2b3c 773a4a 98505c c06e74 e4999a')
const KNIT = hex('06060c 0c0c16 141422 1e1c30 2a2642 3a3258')
const BOOKS = [hex('140810 22101a 3a1624 581e2e'), hex('061214 0c1e22 142e34 1e4248'), hex('141008 221a0c 3a2c12 54401a')]

const GX = 30
const GY = 12.5
const R = 10.5
const DESK = 28

const TOUCH = 1.38

type Tendril = { u: number; amp: number; k: number; ph: number; cycles: number; fork: number }
const TENDRILS: Tendril[] = [
  { u: -2.3, amp: 1.6, k: 1.6, ph: 0.3, cycles: 1, fork: 0 },
  { u: -1.55, amp: 1.9, k: 2.1, ph: 2.2, cycles: 2, fork: 0.22 },
  { u: -0.85, amp: 1.4, k: 1.4, ph: 4.1, cycles: 1, fork: 0 },
  { u: -0.2, amp: 1.8, k: 2.4, ph: 1.1, cycles: 2, fork: -0.2 },
  { u: 0.5, amp: 1.5, k: 1.8, ph: 5.3, cycles: 1, fork: 0 },
  { u: 1.2, amp: 1.9, k: 2.2, ph: 3.4, cycles: 2, fork: 0.24 },
  { u: 1.9, amp: 1.5, k: 1.5, ph: 0.8, cycles: 1, fork: 0 },
  { u: 2.45, amp: 1.7, k: 2, ph: 2.9, cycles: 2, fork: -0.2 },
]

const HAND = [
  '...........######...kkkkk',
  '.......##########..kkkkkk',
  '.nn###############kkkkkkk',
  '##################kkkkkkk',
  '.##########cccc###kkkkkkk',
  '.....ttttttt######kkkkkkk',
  '......######c#####kkkkkkk',
  '.......#####c####.kkkkkkk',
  '........########..kkkkkkk',
  '..................kkkkkkk',
]
const HAND_TIP_ROW = 3

function trace(at: (s: number) => readonly [number, number], s0: number, s1: number): [number, number, number][] {
  const pts: [number, number, number][] = []
  for (let s = s0; s <= s1 + 1e-9; s += 0.015) {
    const [x, y] = at(s)
    const px = Math.round(x)
    const py = Math.round(y)
    const last = pts[pts.length - 1]
    if (last && last[0] === px && last[1] === py) continue
    pts.push([px, py, s])
    const a = pts[pts.length - 3]
    const b = pts[pts.length - 2]
    if (a && b && Math.abs(a[0] - px) === 1 && Math.abs(a[1] - py) === 1) pts.splice(pts.length - 2, 1)
  }
  return pts
}
function gather(f: number): number {
  if (f < 20) return 0.22 * ease.in(beat(f, 12, 20))
  if (f < 40) return 0.22 + 0.78 * ease.outBack(beat(f, 20, 24))
  return 1 - ease.outElastic(beat(f, 40, 56))
}
function handOff(f: number): number {
  if (f < 21) return 26 * (1 - ease.inOut(beat(f, 5, 20))) + (f >= 18 && f < 20 ? 0.5 : 0)

  const p = beat(f, 41, 54)
  return 26 * (p < 0.4 ? (1.25 * p * p) / 0.8 : 1.25 * (p - 0.2))
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const g = gather(f)
    const touching = f >= 20 && f < 40
    const flash = f === 20 ? 1 : f === 21 ? 0.5 : 0
    const roomG = Math.max(...[0, 1, 2, 3, 4, 5, 6].map(k => Math.max(0, gather((f - k + LOOP) % LOOP)) - 0.14 * k))
    const power = 1 + roomG * 0.35 + wave(f, LOOP, 5) * 0.04
    const glowAt = (x: number, y: number) => power * Math.max(0, 1 - Math.hypot(x - GX, (y - GY) * 1.1) / 34) ** 1.5
    for (let y = 0; y < DESK; y++) {
      for (let x = 0; x < W; x++) c.set(x, y, shade(ROOM, 0.6 + glowAt(x, y) * 7.4))
    }
    for (let y = 2; y <= 14; y++) {
      for (let x = 2; x <= 13; x++) {
        const isFrame = x === 2 || x === 13 || y === 2 || y === 14 || x === 7 || y === 8
        const lit = glowAt(x, y) * 4
        c.set(x, y, isFrame ? shade(WOOD, 1.4 + lit + (x === 13 || x === 7 ? 1 : 0)) : shade(SKY, 1.6 - (y - 2) * 0.12 + (y > 10 ? -0.6 : 0)))
      }
    }
    for (const [sx, sy, ph] of [[4, 4, 0.1], [10, 5, 0.6], [5, 11, 0.35], [11, 10, 0.8], [9, 3, 0.45]] as const) {
      const tw = wave(f, LOOP, 2, ph)
      if (tw > -0.5) c.set(sx, sy, tw > 0.4 ? 0xb8c4f0 : 0x5a6698)
    }
    c.set(4, 12, 0xcfd6f2)
    for (let y = DESK; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const isEdge = y === DESK
        const lit = glowAt(x, y - 4) * (isEdge ? 6 : 3.4) + (isEdge ? 1.4 : 0.5) - (y - DESK) * 0.15
        c.set(x, y, shade(WOOD, lit))
      }
    }
    const stack = [[3, 21, 13, 2], [4, 23, 12, 2], [2, 25, 14, 3]] as const
    stack.forEach(([bx, by, bw, bh], i) => {
      const ramp = BOOKS[i] ?? BOOKS[0] ?? []
      for (let y = by; y < by + bh; y++) {
        for (let x = bx; x < bx + bw; x++) {
          const isPages = x === bx + bw - 1
          const lit = glowAt(x, y) * 3.5 + (y === by ? 0.8 : 0) - (y === by + bh - 1 ? 0.5 : 0)
          c.set(x, y, isPages ? shade(PLASMA, 3 + glowAt(x, y) * 5 - (y === by + bh - 1 ? 1 : 0)) : shade(ramp, lit))
        }
      }
    })
    for (let y = 22; y < DESK; y++) {
      for (let x = 52; x <= 57; x++) {
        const lit = glowAt(x, y) * 4 + (x === 52 ? 2 : x === 53 ? 1 : 0) + (y === 22 ? 0.8 : 0)
        c.set(x, y, shade(PLASTIC, lit))
      }
    }
    for (const [x, y] of [[58, 23], [59, 24], [59, 25], [58, 26]] as const) c.set(x, y, shade(PLASTIC, 1.2))
    for (let x = GX - 11; x <= GX + 11; x++) {
      const d = Math.abs(x - GX) / 11
      c.set(x, DESK, shade(WOOD, 5.4 + power - d * 3))
    }
    for (let y = 22; y < DESK; y++) {
      const half = y < 24 ? 2.5 : 5.5 + (y - 24) * 0.5
      const x0 = Math.ceil(GX - half)
      const x1 = Math.floor(GX + half)
      for (let x = x0; x <= x1; x++) {
        const side = (x - GX) / half
        const isRim = x === x0 || x === x1
        const lit = y === 24 ? 4.6 + power - Math.abs(side) * 1.4 : y === 22 ? 4 + power * 0.8 : 1.5 - side * 0.7 - (y - 24) * 0.2
        c.set(x, y, isRim && y > 24 ? shade(PLASMA, 2.4 + power * 0.6 - (y - 24) * 0.3) : shade(PLASTIC, lit))
      }
    }
    c.set(GX + 4, 26, 0xff3a5c)
    c.set(GX + 4, 27, 0x6a1830)
    const light = new Float32Array(W * H)
    const putLight = (x: number, y: number, v: number) => {
      const ix = Math.round(x)
      const iy = Math.round(y)
      if (ix < 0 || ix >= W || iy < 0 || iy >= H) return
      const i = iy * W + ix
      light[i] = Math.max(light[i] ?? 0, v)
    }
    const glowLight = (x: number, y: number, v: number) => {
      putLight(x, y, v)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) putLight(x + dx, y + dy, v * 0.62)
    }
    const drawTendrils = (ff: number, glow: number) => {
    const f = (ff + LOOP) % LOOP
    const g = gather(f)
    const touching = f >= 21 && f < 40
    const tf = f / LOOP
    const put = (x: number, y: number, v: number) => putLight(x, y, v * glow)
    const glowSpot = (x: number, y: number, v: number) => glowLight(x, y, v * glow)
    TENDRILS.forEach((t, i) => {
      const free = t.u + 0.38 * wave(f, LOOP, t.cycles, t.ph / TAU)
      const end = lerp(free, TOUCH + (i - 3.5) * 0.02, g) - Math.PI / 2
      const start = lerp(free, TOUCH, g * 0.62) - Math.PI / 2
      const amp = t.amp * (1 - 0.4 * Math.min(1, Math.max(0, g)))
      const crackle = touching ? f * 1.7 + i : 0
      const at = (s: number, bend: number) => {
        const off = Math.sin(Math.PI * s) * amp * (Math.sin(s * t.k * Math.PI + t.ph + TAU * tf * t.cycles + crackle) + 0.45 * Math.sin(s * t.k * 2.3 * Math.PI - t.ph * 1.7 - TAU * tf * (t.cycles + 1)))
        const r = lerp(2.4, R - 0.7, s)
        const a = lerp(start, end, s) + bend * smoothstep(0.6, 1, s)
        return [GX + Math.cos(a) * r - Math.sin(a) * off, GY + Math.sin(a) * r + Math.cos(a) * off] as const
      }
      const v = touching ? 0.8 : 0.94
      for (const [x, y, s] of trace(s => at(s, 0), 0, 1)) if (glow === 1 || s > 0.2) put(x, y, v - s * 0.18)
      const [ex, ey] = at(1, 0)
      glowSpot(ex, ey, 0.98)
      if (t.fork !== 0 && g < 0.6) {
        for (const [x, y, s] of trace(s => at(s, t.fork * (1 - g)), 0.6, 1)) put(x, y, 0.84 - (s - 0.6) * 0.2)
        const [fx, fy] = at(1, t.fork * (1 - g))
        glowSpot(fx, fy, 0.9)
      }
    })
    }
    drawTendrils(f - 1, 0.6)
    drawTendrils(f, 1)
    const put = putLight
    if (touching && f > 20) {
      const a = TOUCH - Math.PI / 2
      const line = trace(s => {
        const off = Math.sin(Math.PI * s) * 0.9 * Math.sin(s * 9 + f * 2.3)
        const r = lerp(2.4, R - 0.7, s)
        return [GX + Math.cos(a) * r - Math.sin(a) * off, GY + Math.sin(a) * r + Math.cos(a) * off] as const
      }, 0, 1)
      for (const [x, y] of line) {
        put(x, y, 1.12)
        put(x, y - 1, 0.62)
        put(x, y + 1, 0.62)
      }
    }
    if (touching) {
      const a = TOUCH - Math.PI / 2
      const tx = GX + Math.cos(a) * (R - 1)
      const ty = GY + Math.sin(a) * (R - 1)
      for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
        const d = Math.hypot(x, y)
        if (d <= 2.2) put(tx + x, ty + y, 1.3 - d * 0.28)
      }
    }
    for (let y = 1; y < 25; y++) {
      for (let x = 18; x < 43; x++) {
        const r = Math.hypot(x - GX, y - GY)
        if (r > R + 0.5) continue
        if (r > R - 0.5) {
          c.set(x, y, shade(PLASMA, 3.6 + Math.max(0, Math.cos(Math.atan2(y - GY, x - GX) + 2.3)) * 2.2 + flash))
          continue
        }
        const gas = 1.8 + (1 - r / R) * 2.8 + Math.max(0, g) * 0.5 + flash * 0.8
        const core = r < 1.6 ? 1.2 : r < 2.7 ? 0.92 : 0
        const v = Math.max(light[y * W + x] ?? 0, core)
        c.set(x, y, shade(PLASMA, Math.max(gas, v * 11)))
      }
    }
    for (let y = 1; y < 25; y++) {
      for (let x = 18; x < 43; x++) {
        const r = Math.hypot(x - GX, y - GY)
        const a = Math.atan2(y - GY, x - GX)
        if (r > R - 2 && r < R - 1 && a > -2.65 && a < -1.95) c.set(x, y, PLASMA[10] ?? 0)
        if (r > R - 2 && r < R - 1 && a > 0.55 && a < 0.8) c.set(x, y, PLASMA[7] ?? 0)
      }
    }
    const off = Math.round(handOff(f))
    const hx = Math.round(GX + Math.cos(TOUCH - Math.PI / 2) * R) + off
    const hy = Math.round(GY + Math.sin(TOUCH - Math.PI / 2) * R) - HAND_TIP_ROW
    const cell = (i: number, j: number) => HAND[j]?.[i] ?? '.'
    const isHand = (i: number, j: number) => cell(i, j) !== '.'
    for (let j = 0; j < HAND.length; j++) {
      for (let i = 0; i < (HAND[j]?.length ?? 0); i++) {
        const ch = cell(i, j)
        if (ch === '.') continue
        const x = hx + i
        const y = hy + j
        const lit = glowAt(x, y) * 3 + (touching ? 1 : 0) * Math.max(0, 1 - i / 9) * 3.4 + flash * 1.5
        const rim = !isHand(i - 1, j) ? 2.6 : 0
        const top = !isHand(i, j - 1) ? 0.7 : 0
        const under = !isHand(i, j + 1) ? -0.9 : 0
        if (ch === 'k') {
          c.set(x, y, shade(KNIT, 1.2 + lit * 0.6 + (rim > 0 ? 1.6 : 0) + (i === 20 || i === 23 ? -0.7 : 0)))
          continue
        }
        const crease = ch === 'c' ? -1.3 : ch === 't' && isHand(i, j - 1) && cell(i, j - 1) !== 't' ? -1 : 0
        const nail = ch === 'n' ? 1.4 : 0
        c.set(x, y, shade(SKIN, 1.2 + lit + rim + top + under + crease + nail))
      }
    }
    for (let x = hx + 25; x < W; x++) {
      for (let y = hy; y < hy + HAND.length; y++) c.set(x, y, shade(KNIT, 1.2))
    }
    if (touching) {
      for (let k = 0; k < 3; k++) {
        const life = (f - 20 + k * 5) % 9
        const a = TOUCH - Math.PI / 2 + (hash(k, Math.floor((f - 20 + k * 5) / 9)) - 0.5) * 1.1
        const d = R + 1 + life * 0.7
        if (life < 5) c.set(GX + Math.cos(a) * d, GY + Math.sin(a) * d, PLASMA[life < 2 ? 11 : 9] ?? 0)
      }
    }
  })
}
export const scene: Scene = { verb: 'Ionizing', render, hero: 28 }