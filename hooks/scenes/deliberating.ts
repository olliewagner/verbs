import { PALETTE, beat, ease, frames, hex, mix, mod, particles, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const PANEL = hex('140a0d 1d0e10 291412 361a15 45221a 562c1f 6a3826 82482e 9c5c38')
const LIGHT = hex('4a2a1e 6e3e26 965a34 bc7c44 d8a05c eec584 fae2b0')
const BRASS = PALETTE.gold
const IRON = hex('121119 1d1b25 2b2834 3c3846 524c5e 6e677a 958ca0')
const ROBE = hex('0a080c 141018 1e1824 2a2232')
const SKIN = hex('6a3a2c 9a5a42 c88462 e6ad86')
const CUFF = hex('8c8494 c8c0c8 eee8ea')
const VELVET = hex('1e060c 340a14 4e1018 6c1a20 8a2a2a')

const PX = 32
const PY = 9
const ARM = 14.5
const DROP = 10
const BENCH = 25

const SET_A = 13
const SET_B = 44
const LIFT = 80
const GLINT = SET_B + 15
const TOP = -5
const TOP_EMPTY = -1

const TILT: number[] = (() => {
  const target = (f: number) => {
    const left = beat(f, SET_A - 2, SET_A + 1) * (1 - beat(f, LIFT, LIFT + 2))
    const right = beat(f, SET_B - 1, SET_B + 1) * (1 - beat(f, LIFT, LIFT + 2))
    return (right - left) * 0.19
  }
  const out: number[] = []
  let a = 0
  let v = 0
  const w = (2 * Math.PI) / 11
  const zeta = 0.17
  for (let f = 0; f < LOOP; f++) {
    out.push(a)
    for (let k = 0; k < 10; k++) {
      const acc = -w * w * (a - target(f + k / 10)) - 2 * zeta * w * v
      v += acc / 10
      a += v / 10
    }
  }
  return out
})()

const tiltOf = (f: number) => TILT[mod(f, LOOP)] ?? 0

function endsOf(f: number): [[number, number], [number, number]] {
  const t = tiltOf(f)
  const cx = Math.cos(t) * ARM
  const sy = Math.sin(t) * ARM
  return [[PX - cx, PY - sy], [PX + cx, PY + sy]]
}

type Hand = { x: number; y: number; isOpen: boolean; isHolding: boolean }

function handOf(f: number, side: 0 | 1): Hand | undefined {
  const pan = endsOf(f)[side]
  const rest = pan[1] + DROP - 4
  const away = (set: number) => {
    const [x, y] = endsOf(set)[side]
    return { x, y: lerp(y + DROP - 4, TOP_EMPTY, move(f, set + 2, set + 12, 4, 0)), isOpen: true, isHolding: false }
  }
  if (side === 0 && f < SET_A + 12) {
    if (f > SET_A) return away(SET_A)
    return { x: pan[0], y: lerp(TOP, rest, move(f, 0, SET_A, 0, 5)), isOpen: false, isHolding: true }
  }
  if (side === 1 && f >= SET_B - 22 && f < SET_B + 12) {
    if (f > SET_B) return away(SET_B)
    const over = endsOf(SET_B - 13)[side][1] + DROP - 9
    const down = move(f, SET_B - 22, SET_B - 13, 0, 5)
    const hover = f >= SET_B - 13 && f < SET_B - 4 ? (mod(f - SET_B + 13, 4) < 2 ? 0 : -1) : 0
    const commit = glide(f, SET_B - 4, SET_B)
    return { x: pan[0], y: lerp(lerp(TOP, over, down) + hover, rest, commit), isOpen: false, isHolding: true }
  }
  if (f >= LIFT - 11) {
    if (f < LIFT) return { x: pan[0], y: lerp(TOP_EMPTY, rest, move(f, LIFT - 11, LIFT, 0, 5)), isOpen: f < LIFT - 1, isHolding: false }
    return { x: pan[0], y: lerp(rest, TOP, move(f, LIFT + 1, LIFT + 14, 5, 0)), isOpen: false, isHolding: true }
  }
  return undefined
}
function move(f: number, a: number, b: number, rampIn: number, rampOut: number): number {
  const t = Math.min(Math.max(f - a, 0), b - a)
  const top = 1 / (b - a - (rampIn + rampOut) / 2)
  if (t < rampIn) return (top * t * t) / (2 * rampIn)
  if (t > b - a - rampOut) return 1 - (top * (b - a - t) ** 2) / (2 * rampOut)
  return top * (t - rampIn / 2)
}
function glide(f: number, a: number, b: number): number {
  const t = beat(f, a, b)
  return t * t * (3 - 2 * t)
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
function holds(f: number, side: 0 | 1): boolean {
  const set = side === 0 ? SET_A : SET_B
  return f >= set && f < LIFT
}

function windowAt(x: number, y: number): { a: number; b: number } | undefined {
  const dx = x - 4
  const dy = y - 2
  const det = 22 * 15 - 3 * -2
  const a = (dx * 15 - 3 * dy) / det
  const b = (22 * dy + 2 * dx) / det
  return a >= 0 && a <= 1 && b >= 0 && b <= 1 ? { a, b } : undefined
}
type Put = (x: number, y: number, color: number) => void
function weight(put: Put, x: number, bottom: number): void {
  const x0 = Math.round(x) - 2
  const y0 = Math.round(bottom) - 4
  put(x0 + 2, y0, shade(IRON, 5))
  for (let i = 1; i <= 3; i++) put(x0 + i, y0 + 1, shade(IRON, i === 1 ? 5.6 : i === 2 ? 4.4 : 2.6))
  for (let j = 2; j <= 4; j++) {
    for (let i = 0; i <= 4; i++) {
      const lit = (j === 2 ? 1.6 : 0) + (i === 0 ? 1.4 : i === 1 ? 0.6 : i === 4 ? -1.4 : 0)
      put(x0 + i, y0 + j, shade(IRON, 3 + lit - (j === 4 ? 0.8 : 0)))
    }
  }
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const scales = new Map<number, number>()
    const put: Put = (x, y, color) => {
      const ix = Math.round(x)
      const iy = Math.round(y)
      if (ix >= 0 && ix < W && iy >= 0 && iy < H) scales.set(iy * W + ix, color)
    }
    const t = tiltOf(f)
    const ends = endsOf(f)
    const glint = f >= GLINT && f < GLINT + 8 ? ((f - GLINT) / 7) * (ARM * 2 + 4) - 2 : -99
    for (let x = PX - 1; x <= PX + 1; x++) put(x, PY - 2, shade(BRASS, x === PX - 1 ? 5.4 : x === PX ? 4 : 2.6))
    for (const [x, y, l] of [[PX - 1, PY - 4, 5.6], [PX, PY - 4, 6.4], [PX + 1, PY - 4, 3.6], [PX - 1, PY - 3, 4.2], [PX, PY - 3, 3.8], [PX + 1, PY - 3, 2.4], [PX, PY - 5, 5]] as const) {
      put(x, y, shade(BRASS, l))
    }

    for (let y = PY + 1; y < BENCH; y++) {
      put(PX - 1, y, shade(BRASS, 5.4))
      put(PX, y, shade(BRASS, 4))
      put(PX + 1, y, shade(BRASS, 2.4))
    }
    for (const [y, half] of [[BENCH - 3, 2], [BENCH - 2, 3], [BENCH - 1, 5]] as const) {
      for (let x = PX - half; x <= PX + half; x++) {
        const lit = y === BENCH - 3 || x === PX - half ? 1.6 : x === PX + half ? -1.2 : 0
        put(x, y, shade(BRASS, 3.4 + lit - (y === BENCH - 1 ? 0.6 : 0)))
      }
    }
    const ux = Math.cos(t)
    const uy = Math.sin(t)
    for (let y = PY - 5; y <= PY + 5; y++) {
      for (let x = PX - ARM - 2; x <= PX + ARM + 2; x++) {
        const along = (x - PX) * ux + (y - PY) * uy
        const across = -(x - PX) * uy + (y - PY) * ux
        if (Math.abs(along) > ARM + 0.6 || across < -1.1 || across > 0.7) continue
        const shine = Math.abs(along + ARM + 2 - glint) < 1.6 && across < -0.2 ? 3 : 0
        put(x, y, shade(BRASS, (across < -0.2 ? 5.2 : 3) - Math.abs(along) * 0.03 + shine))
      }
    }
    for (const [ex, ey] of ends) {
      put(ex, ey - 1, shade(BRASS, 5.6))
      put(ex, ey + 1, shade(BRASS, 3))
    }
    for (let y = PY - 1; y <= PY + 1; y++) for (let x = PX - 1; x <= PX + 1; x++) put(x, y, shade(BRASS, x + y < PX + PY ? 6 : 3.8))
    put(PX, PY, shade(BRASS, 2))
    ends.forEach(([ex, ey], side) => {
      const by = Math.round(ey + DROP)
      const bx = Math.round(ex)
      for (const dx of [-4, 4]) {
        const steps = DROP + 1
        for (let k = 1; k < steps; k++) {
          const x = ex + (dx * k) / steps
          const y = ey + 1 + ((DROP - 1) * k) / steps
          put(x, y, shade(BRASS, k % 2 ? 4.6 : 2.6))
        }
      }
      for (const [dy, half] of [[0, 4], [1, 3], [2, 2]] as const) {
        for (let x = bx - half; x <= bx + half; x++) {
          const lit = dy === 0 ? 1.8 : 0
          put(x, by + dy, shade(BRASS, 3.4 + lit + (x < bx ? 0.8 : -0.8) - dy * 0.7))
        }
      }
      if (holds(f, side as 0 | 1)) weight(put, bx, by)
    })
    for (let y = 0; y < BENCH; y++) {
      for (let x = 0; x < W; x++) {
        const panel = mod(x - 2, 13)
        const isRail = y === 17 || y === 18
        const isGroove = panel === 0 || (!isRail && (panel === 2 || panel === 11) && y > 1 && y < 16) || ((y === 2 || y === 15) && panel >= 2 && panel <= 11)
        const isBevel = panel === 1 || (y === 3 && panel > 2 && panel < 11) || (y === 16 && panel > 2 && panel < 11)
        let level = 2.6 - y * 0.02 + (isGroove ? -1.2 : 0) + (isBevel ? 0.8 : 0)
        if (isRail) level = y === 17 ? 4 : 2
        if (y > 18) level = 1.8 + (panel === 0 ? -0.8 : 0) + (y === 19 ? 0.6 : 0)
        const win = windowAt(x, y)
        if (win && !scales.has((y - 1) * W + x - 4)) {
          const isBar = Math.abs(win.a - 0.5) < 0.035 || Math.abs(win.b - 0.48) < 0.04
          if (!isBar) {
            c.set(x, y, shade(LIGHT, 2.6 + (isGroove ? -1 : 0) + (isBevel ? 1 : 0) + (isRail && y === 17 ? 1 : 0) - y * 0.05))
            continue
          }
          level += 0.6
        }
        if (x >= 55) {
          const fold = Math.sin((x - 55) * 1.25 + y * 0.04)
          c.set(x, y, shade(VELVET, 2 + fold * 1.4 + (x === 55 ? 1.2 : 0)))
          continue
        }
        c.set(x, y, shade(PANEL, level))
      }
    }
    for (let y = BENCH; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (y <= BENCH + 2) {
          const isPool = x > 8 + (y - BENCH) * 2 && x < 26 + (y - BENCH) * 2 && !scales.has((BENCH - 1) * W + x - 3)
          const lip = y === BENCH + 2 ? 1.6 : 0
          let color = shade(PANEL, 4.6 + lip - (y - BENCH) * 0.4 + (isPool ? 2 : 0))
          const above = scales.get((2 * BENCH - 1 - y) * W + x)
          if (above !== undefined && y < BENCH + 2) color = mix(color, above, 0.32)
          c.set(x, y, color)
          continue
        }
        const panel = mod(x - 5, 18)
        const isGroove = panel === 0 || y === BENCH + 4
        c.set(x, y, shade(PANEL, 2.6 + (isGroove ? -1.2 : 0) + (panel === 1 ? 0.8 : 0) - (y - BENCH) * 0.1))
      }
    }
    for (const p of particles(f, LOOP, 19, 40, 9)) {
      const x = 6 + p.r[1] * 20 + p.t * 0.12 + Math.sin(p.t * 0.2 + p.r[2] * 6) * 1.2
      const y = 3 + p.r[2] * 14 + p.t * 0.08
      if (!windowAt(Math.round(x), Math.round(y)) || p.age < 0.1 || p.age > 0.9) continue
      c.set(x, y, shade(LIGHT, 5))
    }
    for (const [i, color] of scales) {
      const x = i % W
      const y = Math.floor(i / W)
      const win = windowAt(x + 4, y + 1)
      const isLit = win !== undefined && Math.abs(win.a - 0.5) > 0.035 && Math.abs(win.b - 0.48) > 0.04
      c.set(x, y, isLit ? mix(color, 0xfff0c0, 0.28) : color)
    }
    for (const side of [0, 1] as const) {
      const hand = handOf(f, side)
      if (!hand) continue
      const hx = Math.round(hand.x)
      const hy = Math.round(hand.y)
      if (hand.isHolding) weight((x, y, color) => c.set(x, y, color), hx, hy + 4)
      for (let y = 0; y <= hy - 3; y++) {
        for (let x = hx - 2; x <= hx + 2; x++) c.set(x, y, shade(ROBE, x === hx - 2 ? 3 : x === hx + 2 ? 0.6 : 1.6))
      }
      for (let x = hx - 2; x <= hx + 2; x++) c.set(x, hy - 2, shade(CUFF, x === hx - 2 ? 2.4 : x === hx + 2 ? 0.6 : 1.6))
      for (let x = hx - 1; x <= hx + 1; x++) c.set(x, hy - 1, shade(SKIN, x === hx - 1 ? 3 : x === hx + 1 ? 1 : 2))
      if (hand.isOpen) {
        c.set(hx - 2, hy, shade(SKIN, 2))
        c.set(hx + 2, hy, shade(SKIN, 1))
      } else {
        c.set(hx - 1, hy, shade(SKIN, 2.4))
        c.set(hx + 1, hy, shade(SKIN, 1.2))
      }
    }
  })
}
export const scene: Scene = { verb: 'Deliberating', render, hero: GLINT + 2 }