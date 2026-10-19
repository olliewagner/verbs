import { Canvas, TAU, beat, ease, frames, hash, hex, lerp, mix, mod, particles, random, shade, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 64

const BOARD = hex('110a10 1b1016 27161a 35201f 472a24 5c372a 744632 8f593c a8704a c48a58')
const STRAW = hex('22130c 3b220f 5c3814 815219 a5701f c58f2f dfb048 f1d06c fcecac')
const SHELL = hex('35283f 54415c 7a6280 a2879c c5abb0 e2cdc4 f4e6d8 fff8ee')
const CHICK = hex('5c2c14 8e4c16 c07c1a e3a823 f4c937 fde064 fff1a0 fffbdc')
const BEAK = hex('5a160e 9a3612 d0621e f0913a')
const IRON = hex('17141c 2c2833 4a4452 736a78 a49aa4')
const GLASS = hex('3a2a22 5e4630 8a6a44 d8b878')
const SUN = 0xffe6a6
const EYE = 0x24141c
const MOUTH = 0x6a1c1c
const BLUSH = 0xf08a6c

const PX = 32
const PY = 27.5
const LIFT = 8
const RY = 8
const rxAt = (ey: number) => 6.2 * (1 + (0.1 * ey) / RY)
const inEgg = (ex: number, ey: number) => (ex / rxAt(ey)) ** 2 + (ey / RY) ** 2 <= 1
const seamY = (ex: number) => -1.5 + 1.1 * (Math.abs(mod(ex + 1, 4) - 2) - 1)
const LID_MID = -4.75
const HEAD_SHUT = PY - LIFT

type Xf = { ox: number; oy: number; rot: number; ey0: number }
function toEgg(t: Xf, x: number, y: number): [number, number] {
  const dx = x - t.ox
  const dy = y - t.oy
  const c = Math.cos(t.rot)
  const s = Math.sin(t.rot)
  return [c * dx + s * dy, -s * dx + c * dy + t.ey0]
}
const eggXf = (tilt: number): Xf => ({ ox: PX, oy: PY, rot: tilt, ey0: LIFT })
const lidXf = (tx: number, ty: number, rot: number): Xf => ({ ox: PX + tx, oy: PY - LIFT + LID_MID + ty, rot, ey0: LID_MID })

function shellLevel(t: Xf, ex: number, ey: number): number {
  const nx = ex / (rxAt(ey) + 0.6)
  const ny = ey / (RY + 0.6)
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
  const c = Math.cos(t.rot)
  const s = Math.sin(t.rot)
  const wx = c * nx - s * ny
  const wy = s * nx + c * ny
  const lit = -0.62 * wx - 0.55 * wy + 0.56 * nz
  return 2 + Math.max(0, lit) * 5 + Math.max(0, wy - 0.45) * 1.2
}

type State = {
  tilt: number
  lid: 'egg' | 'head' | 'air'
  air: [number, number, number]
  helm: number
  hy: number
  squash: number
  eyes: 'open' | 'shut' | 'up'
  look: number
  beak: boolean
  wings: boolean
  crack: number
  dark: number
}

function rock(f: number, start: number, len: number, amp: number, cycles: number): number {
  const p = beat(f, start, start + len)
  return p <= 0 || p >= 1 ? 0 : amp * Math.sin(TAU * cycles * p) * (1 - p) ** 1.3
}

function stateAt(f: number): State {
  const s: State = {
    tilt: rock(f, 5, 7, 0.13, 1.5) + rock(f, 14, 9, 0.21, 2) + ([-0.06, 0.06, 0][f - 28] ?? 0) + rock(f, 59, 5, 0.1, 1),
    lid: 'egg',
    air: [0, 0, 0],
    helm: 0,
    hy: HEAD_SHUT,
    squash: 0,
    eyes: 'open',
    look: 0,
    beak: false,
    wings: false,
    crack: f < 7 ? 0 : f < 10 ? 2 : f < 15 ? 3.5 : f < 18 ? 5.5 : 9,
    dark: f < 59 ? 1 : 1 - beat(f, 59, 64),
  }
  if (f >= 22 && f <= 27) {
    const lift = [1, 2, 3, 3, 2, 1][f - 22] ?? 0
    s.lid = 'head'
    s.hy = HEAD_SHUT - lift
    s.helm = -0.07 * lift
    s.look = f === 24 ? -1 : f === 25 || f === 26 ? 1 : 0
  }
  if (f < 31 || f > 58) return s

  s.lid = f <= 37 ? 'air' : 'head'
  s.hy = 10.5
  if (f <= 34) s.hy = lerp(HEAD_SHUT, 10.5, ease.outBack(beat(f, 30, 34)))
  s.squash = ({ 31: -0.45, 32: -0.2, 33: 0.1, 38: 0.35, 39: 0.12, 43: -0.12, 44: -0.06, 45: 0.08, 47: -0.12, 48: -0.06, 49: 0.08, 53: -0.15, 54: -0.3, 55: -0.3, 56: -0.25, 57: -0.2, 58: -0.1 } as Record<number, number>)[f] ?? 0
  if (f === 38) s.hy = 12.2
  if (f === 39) s.hy = 11.5
  if (f === 43 || f === 47 || f === 44 || f === 48) s.hy = 10.4
  if (f >= 53) s.hy = [10.2, 12, 14, 16, 17.5, 18.5][f - 53] ?? HEAD_SHUT
  if (f <= 37) {
    const t = (f - 30) / 8
    s.air = [2.5 * Math.sin(Math.PI * t), (10.5 - HEAD_SHUT) * t - 36 * t * (1 - t), TAU * ease.inOut(t)]
  }
  const settle = beat(f, 38, 45)
  s.helm = f >= 38 && settle < 1 ? 0.32 * (1 - settle) ** 1.5 * Math.cos(TAU * 1.25 * settle) : 0
  s.eyes = f <= 37 ? 'up' : f <= 39 || f === 46 || f >= 53 ? 'shut' : 'open'
  s.look = f === 50 || f === 51 ? -1 : f === 52 || f === 53 ? 1 : 0
  s.beak = f === 32 || f === 43 || f === 44 || f === 47 || f === 48
  s.wings = f === 31 || f === 32 || f === 43 || f === 44 || f === 47 || f === 48
  return s
}

const lidOf = (s: State): Xf => (s.lid === 'air' ? lidXf(s.air[0], s.air[1], s.air[2]) : lidXf(0, s.hy - HEAD_SHUT, s.helm))

function drawShell(c: Canvas, egg: Xf, s: State, part: 'whole' | 'inner' | 'front' | 'gap'): void {
  for (let y = 8; y < 30; y++) {
    for (let x = 22; x < 43; x++) {
      const [ex, ey] = toEgg(egg, x, y)
      if (!inEgg(ex, ey)) continue
      const d = ey - seamY(ex)
      let level = shellLevel(egg, ex, ey)
      if (part === 'gap') {
        if (d >= 0 || d < -1) continue
        level = 0.4
      } else if (part === 'inner') {
        if (d >= 0 || d < -2.2) continue
        level = d < -1.5 ? 4.2 : 1.6
      } else if (part === 'front') {
        if (d < 0) continue
        if (d < 0.9) level = 6.2
      } else if (Math.abs(d) < 0.55) {
        const a = Math.abs(ex) < s.crack ? s.dark : 0
        level = lerp(level - 1.1, 0.4, a)
      }
      c.set(x, y, shade(SHELL, level))
    }
  }
}

function drawLid(c: Canvas, lid: Xf): void {
  for (let y = Math.floor(lid.oy - 9); y <= lid.oy + 9; y++) {
    for (let x = Math.floor(lid.ox - 9); x <= lid.ox + 9; x++) {
      const [ex, ey] = toEgg(lid, x, y)
      if (!inEgg(ex, ey)) continue
      const d = seamY(ex) - ey
      if (d <= 0) continue
      c.set(x, y, shade(SHELL, shellLevel(lid, ex, ey) - (d < 0.9 ? 1.4 : 0)))
    }
  }
}

function drawChick(c: Canvas, s: State, egg: Xf, lid: Xf): void {
  const hx = PX
  const hy = s.hy
  const sx = 1 + s.squash * 0.45
  const sy = 1 - s.squash * 0.5
  const parts = [
    { x: hx, y: hy + 5.4 * sy, rx: 5.4 * sx, ry: 4.4 * sy, seed: 2 },
    { x: hx, y: hy, rx: 4.3 * sx, ry: 4 * sy, seed: 1 },
  ]
  for (let y = Math.floor(hy - 6); y <= hy + 11; y++) {
    for (let x = hx - 9; x <= hx + 9; x++) {
      let hit: [number, number, number] | undefined
      parts.forEach((p, i) => {
        const u = (x - p.x) / p.rx
        const v = (y - p.y) / p.ry
        const sector = Math.floor(((Math.atan2(v, u) + Math.PI) / TAU) * 18)
        const edge = 1 + (hash(sector, p.seed) - 0.5) * 0.26
        if (u * u + v * v <= edge * edge) hit = [u, v, i]
      })
      if (!hit) continue
      const [u, v, i] = hit
      const nz = Math.sqrt(Math.max(0, 1 - u * u - v * v))
      let level = 1.8 + Math.max(0, -0.6 * u - 0.55 * v + 0.58 * nz) * 4.9
      if (i === 0 && y <= hy + 4.4 * sy) level -= 0.5
      const [ex, ey] = toEgg(egg, x, y)
      if (ey > seamY(ex) - 1.6) level -= 1.1
      const [lx, ly] = toEgg(lid, x, y)
      const under = ly - seamY(lx)
      if (under >= 0 && under < 1.5 && Math.abs(lx) < 6.5) level -= 1.3
      c.set(x, y, shade(CHICK, level))
    }
  }
  const fx = hx + s.look
  const fy = Math.round(hy) + (s.eyes === 'up' ? -1 : 0)
  for (const dx of [-2, 2]) {
    c.set(fx + dx, fy, s.eyes === 'shut' ? (CHICK[1] ?? 0) : EYE)
    c.set(fx + dx + Math.sign(dx), fy + 1, mix(c.get(fx + dx + Math.sign(dx), fy + 1), BLUSH, 0.55))
  }
  c.set(fx - 1, fy + 1, BEAK[3] ?? 0)
  c.set(fx, fy + 1, BEAK[3] ?? 0)
  c.set(fx + 1, fy + 1, BEAK[2] ?? 0)
  if (s.beak) {
    c.set(fx, fy + 2, MOUTH)
    c.set(fx, fy + 3, BEAK[2] ?? 0)
  } else c.set(fx, fy + 2, BEAK[1] ?? 0)
  const wy = Math.round(hy + 5 * sy)
  for (const side of [-1, 1]) {
    const wx = hx + side * 5
    if (s.wings) {
      c.set(wx, wy, CHICK[3] ?? 0)
      c.set(wx + side, wy, CHICK[3] ?? 0)
      c.set(wx + side, wy - 1, CHICK[4] ?? 0)
      c.set(wx + 2 * side, wy - 1, CHICK[4] ?? 0)
      c.set(wx + 2 * side, wy - 2, CHICK[5] ?? 0)
    } else {
      c.set(wx - side, wy, CHICK[2] ?? 0)
      c.set(wx - side, wy + 1, CHICK[2] ?? 0)
    }
  }
}

const FLOOR_Y = 24
function pane(x: number, y: number): number {
  const v = (y - 2) / 21
  const u = (x - 20 - (y - 2) * 0.45) / 24
  if (u < 0 || u > 1 || v < 0 || v > 1) return 0
  if (Math.abs(u - 0.5) < 0.05 || Math.abs(v - 0.45) < 0.03) return 0
  return 1
}
function inShaft(x: number, y: number): boolean {
  for (let t = 0; t < 44; t += 2) if (pane(x + 0.72 * t, y + 0.56 * t)) return true
  return false
}

const NEST = { x: 32, y: 25.5, rx: 16.5, ry: 6 }
const HOLLOW = { x: 32, y: 22.8, rx: 10.5, ry: 2.4 }
type Ell = typeof NEST
const inEll = (e: Ell, x: number, y: number) => ((x - e.x) / e.rx) ** 2 + ((y - e.y) / e.ry) ** 2 <= 1

type Strand = { x: number; y: number; a: number; len: number; lift: number }
const STRANDS: Strand[] = (() => {
  const r = random(31)
  const out: Strand[] = []
  while (out.length < 170) {
    const x = NEST.x + (r() * 2 - 1) * NEST.rx
    const y = NEST.y + (r() * 2 - 1) * NEST.ry
    if (!inEll(NEST, x, y) || inEll(HOLLOW, x, y)) continue
    const a = Math.atan2((x - NEST.x) / NEST.rx ** 2, -(y - NEST.y) / NEST.ry ** 2) + (r() - 0.5) * 0.9
    out.push({ x, y, a, len: 2 + r() * 3, lift: r() < 0.3 ? -0.9 : 0.4 + r() * 1.1 })
  }
  return out
})()
const LITTER: Strand[] = (() => {
  const r = random(57)
  return Array.from({ length: 34 }, () => ({ x: r() * W, y: FLOOR_Y + 1.5 + r() * 7, a: (r() - 0.5) * 0.8, len: 2 + r() * 3, lift: 0.6 + r() * 1.4 }))
})()

function nestLevel(x: number, y: number, isShaded: boolean): number {
  if (inEll(HOLLOW, x, y)) {
    const v = (y - HOLLOW.y) / HOLLOW.ry
    return 1.9 - v * 1.1 - (isShaded ? 1 : 0)
  }
  const u = (x - NEST.x) / NEST.rx
  const v = (y - NEST.y) / NEST.ry
  return 3 - v * 2.2 - u * 0.9
}

function drawNest(c: Canvas, part: 'back' | 'front', isSubject: (x: number, y: number) => boolean): void {
  for (let y = 19; y < H; y++) {
    for (let x = 14; x < 51; x++) {
      if (!inEll(NEST, x, y)) continue
      const isFront = !inEll(HOLLOW, x, y) && y >= HOLLOW.y
      if ((part === 'front') !== isFront) continue
      const rim = !isFront && !inEll(HOLLOW, x, y) && !inEll(NEST, x, y - 1) ? 1.3 - (x - NEST.x) / 30 : 0
      c.set(x, y, shade(STRAW, nestLevel(x, y, isSubject(x - 3, y - 2)) + rim))
    }
  }
  for (const s of STRANDS) {
    if ((part === 'front') !== (s.y >= HOLLOW.y)) continue
    const dx = (Math.cos(s.a) * s.len) / 2
    const dy = (Math.sin(s.a) * s.len) / 2
    c.line(s.x - dx, s.y - dy, s.x + dx, s.y + dy, shade(STRAW, nestLevel(s.x, s.y, false) + s.lift))
  }
}

function drawBarn(c: Canvas, f: number, isSubject: (x: number, y: number) => boolean): void {
  const sun = 0.92 + 0.08 * wave(f, LOOP, 1, 0.2)
  for (let y = 0; y < FLOOR_Y; y++) {
    for (let x = 0; x < W; x++) {
      const board = Math.floor((x + 3) / 7)
      const u = (x + 3) % 7
      const lit = pane(x, y) && !isSubject(x - 6, y - 3) && !inEll(NEST, x - 6, y - 3) ? sun : 0
      let level = 1.9 + (hash(board, 3) - 0.5) * 0.7 + lit * 4.6
      level -= Math.abs(x - 30) / 40 + (y < 4 ? 0.4 : 0)
      if (u === 0) level = lit ? 2.4 : 0
      else if (u === 1) level += 0.45
      else if (u === 6) level -= 0.35
      if (u > 1 && u < 6 && hash(board, Math.floor(y / 2), 9) > 0.9) level -= 0.6
      c.set(x, y, shade(BOARD, level))
    }
  }
  for (let x = 0; x < W; x++) {
    const lit = pane(x, 9) ? sun : 0
    c.set(x, 9, shade(BOARD, 3.4 + lit * 4.2 - Math.abs(x - 30) / 40))
    c.set(x, 10, shade(BOARD, 2.2 + lit * 3.4 - Math.abs(x - 30) / 40))
    c.set(x, 11, shade(BOARD, 0.6 + lit * 2))
  }
  c.sprite(7, 11, ['..n..', '.aab.', 'aaabb', '.gkh.', '.gkh.', '.gkh.', 'aaabb', '.ab..'], {
    n: IRON[2] ?? 0, a: IRON[3] ?? 0, b: IRON[1] ?? 0, g: GLASS[2] ?? 0, k: GLASS[1] ?? 0, h: GLASS[0] ?? 0,
  })
  c.set(8, 15, GLASS[3] ?? 0)
  for (let y = 19; y < 23; y++) c.set(10 + (y - 19) * 0.3, y, BOARD[0] ?? 0)
  for (let y = FLOOR_Y; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const near = y === FLOOR_Y ? -0.8 : 0
      c.set(x, y, shade(STRAW, 1.5 + (y - FLOOR_Y) * 0.12 + near - Math.abs(x - 32) / 44))
    }
  }
  for (const s of LITTER) {
    const dx = (Math.cos(s.a) * s.len) / 2
    const dy = (Math.sin(s.a) * s.len) / 2
    c.line(s.x - dx, s.y - dy, s.x + dx, s.y + dy, shade(STRAW, 1.6 + s.lift - Math.abs(s.x - 32) / 44))
  }
}

const CHIPS = Array.from({ length: 7 }, (_, i) => {
  const r = random(77 + i)
  return { x: 27 + i * 1.6 + r(), y: 17.5 + r(), vx: (i - 3) * 0.5 + (r() - 0.5) * 0.4, vy: -1.6 - r() * 1.8, isWide: r() > 0.5 }
})

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const s = stateAt(f)
    const egg = eggXf(s.tilt)

    const fg = new Canvas()
    fg.px.fill(-1)
    if (s.lid === 'egg') drawShell(fg, egg, s, 'whole')
    else {
      const lid = lidOf(s)
      drawShell(fg, egg, s, 'inner')
      drawChick(fg, s, egg, lid)
      if (s.hy > HEAD_SHUT - 3.5) drawShell(fg, egg, s, 'gap')
      drawShell(fg, egg, s, 'front')
      drawLid(fg, lid)
    }
    const isSubject = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H && fg.get(x, y) !== -1

    drawBarn(c, f, isSubject)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inShaft(x, y)) c.tint(x, y, SUN, 0.07)
    drawNest(c, 'back', isSubject)
    for (let i = 0; i < W * H; i++) if ((fg.px[i] ?? -1) !== -1) c.px[i] = fg.px[i] ?? 0

    if (f >= 31) {
      const t = f - 31
      for (const ch of CHIPS) {
        const x = ch.x + ch.vx * t
        const y = ch.y + ch.vy * t + 0.32 * t * t
        if (y > 30 || t > 10) continue
        c.set(x, y, SHELL[6] ?? 0)
        if (ch.isWide) c.set(x + 1, y, SHELL[4] ?? 0)
      }
    }
    drawNest(c, 'front', isSubject)

    if (f >= 31) {
      const t = f - 31
      for (let i = 0; i < 3; i++) {
        const x = 28 + i * 4 + Math.sin(t * 0.35 + i * 2) * 1.6 + (i - 1) * 0.2 * t
        const y = 14 - 3 * ease.out(Math.min(1, t / 5)) + Math.max(0, t - 5) * 0.45
        if (y > 21 || t > 26) continue
        c.set(x, y, CHICK[6] ?? 0)
        c.set(x + (i === 1 ? -1 : 1), y, CHICK[5] ?? 0)
      }
    }
    if (f === 31 || f === 32) {
      const r = f === 31 ? 9.5 : 12.5
      for (const a of [-2.7, -2.15, -1.57, -1, -0.45]) {
        for (const k of [0, 1]) {
          c.set(PX + Math.cos(a) * (r + k), 15 + Math.sin(a) * (r + k) * 0.8, f === 31 ? 0xfff8e0 : SUN)
        }
      }
    }
    for (const p of particles(f, LOOP, 18, 40, 9)) {
      const [r0, r1, r2, r3] = p.r
      const x = 4 + r0 * 48 + p.t * (0.08 + r2 * 0.08) + Math.sin(p.t * 0.16 + r3 * 6) * 1.2
      const y = 1 + r1 * 22 + p.t * 0.05
      const a = Math.sin(Math.PI * p.age)
      if (a < 0.35 || !inShaft(Math.round(x), Math.round(y)) || isSubject(Math.round(x), Math.round(y))) continue
      c.tint(x, y, SUN, a > 0.75 ? 0.75 : 0.45)
    }
  })
}

export const scene: Scene = {
  verb: 'Hatching',
  render,
  hero: 47,
  snaps: [
    { frames: [31, 32], box: [27, 2, 44, 16], why: 'The burst throws the lid up at 4 to 5 px a frame, its shadow on the boards with it.' },
    { frames: 38, box: [25, 0, 44, 13], why: 'The lid drops onto the chick\'s head at 4 px a frame, its shadow with it: the clonk.' },
  ],
}
