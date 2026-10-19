import { beat, clamp, frames, hex, mix, mod, particles, random, shade, smoothstep, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72
const SHELF_Y = 28
const CX = 32

const FRIDGE = hex('5a6a7e 7a8c9e 9aacbc b8c8d4 d2dee6 e6eff3 f6fbfd')
const SHELF = hex('3e5a62 6a9294 9cc8c4 d6f2ec')
const MARINADE = hex('1a0806 30100a 4a1a0e 662812 863a18 a8541e cc7a2c')
const CHICKEN = hex('6a3a24 9a5c34 c48450 e0aa72 f2cc98 fbe6c4')
const ROSEMARY = hex('0e1c14 1a3020 2c5232 467a44 7aa65e')
const PEPPER = hex('0a0606 120a0a 2a1c18 5a4436')
const GARLIC = hex('5a4a3a 9a8a70 cec0a2 f2ead6')
const BUBBLE = hex('a8541e d89a5a f8d8a8')
const LID = hex('3a2810 6a4a18 a07428 cca040 ecd078 fff2c0')
const GLASS = hex('6e8a96 a8c4cc d8eef0 ffffff')
const EGG = hex('b8a894 d6c8b4 eee4d4')
const BOTTLE = hex('8aa8b8 b4ccd6 dceaee')
const CAP = hex('3a6a9a 5a8cbc')

const HALF_W = 8
const BODY_TOP = -7.5
const BODY_BOTTOM = 11
const LID_TOP = -11
const INSIDE_U = 6.8
const INSIDE_TOP = -7
const INSIDE_BOTTOM = 9.8
const FILL = 0.7

type Part = 'lid' | 'neck' | 'glass' | 'inside' | undefined

function partAt(u: number, v: number): Part {
  const au = Math.abs(u)
  if (v >= LID_TOP && v < -8.6) return au <= 7 ? 'lid' : undefined
  if (v >= -8.6 && v < BODY_TOP) return au <= 6 ? 'neck' : undefined
  if (v < BODY_TOP || v > BODY_BOTTOM || au > HALF_W) return undefined
  const r = v > 0 ? 2.4 : 1.6
  const cv = v > 0 ? BODY_BOTTOM - r : BODY_TOP + r
  const isCorner = au > HALF_W - r && (v > 0 ? v > cv : v < cv)
  if (isCorner && Math.hypot(au - (HALF_W - r), v - cv) > r) return undefined
  if (au > INSIDE_U + 0.4 || v > INSIDE_BOTTOM + 0.4 || v < INSIDE_TOP - 0.2) return 'glass'
  if (isCorner && Math.hypot(au - (HALF_W - r), v - cv) > r - 1.1) return 'glass'
  return 'inside'
}

const turn = (u: number) => (1 - Math.cos(Math.PI * u)) / 2

function angle(f: number): number {
  const t = ((f % LOOP) + LOOP) % LOOP
  if (t < 7) return 0
  if (t < 26) return Math.PI * turn(beat(t, 7, 26))
  if (t < 39) return Math.PI
  if (t < 58) return Math.PI * (1 + turn(beat(t, 39, 58)))
  return 0
}

function centreY(a: number): number {
  const reach = 11 * Math.abs(Math.cos(a)) + HALF_W * Math.abs(Math.sin(a)) - 1.6 * Math.abs(Math.sin(2 * a)) * 0.6
  return SHELF_Y - 0.5 - reach
}

type Kind = 'chicken' | 'garlic' | 'pepper' | 'rosemary' | 'bubble'
type Piece = { kind: Kind; u: number; v: number; vu: number; vv: number; r: number; spin: number; shape: number }
type Snapshot = { u: number; v: number; spin: number; alive: boolean }

const SINK: Record<Kind, number> = { chicken: 0.5, garlic: 0.42, pepper: 0.75, rosemary: -0.35, bubble: -0.9 }

const CHUNKS = [
  ['.cc.', 'cccc', '.cc.'],
  ['cc.', 'ccc', '.cc'],
  ['.ccc', 'cccc', 'cc..'],
  ['ccc', 'ccc'],
]

const SLOTS: [number, number][] = [
  [-5, 8.2], [-1.7, 8.3], [1.7, 8.2], [5, 8.2], [-3.3, 5.2], [0, 5.3], [3.4, 5.1],
  [-5.6, 5.1], [5.6, 5],
  [-2.2, 99], [2.6, 99],
  [-3.4, 9.4], [0, 9.3], [3.4, 9.4], [-6, 9.2], [6.1, 9.3], [-1.6, 6.6], [1.8, 6.7], [-5, 3.4],
]

function settle(f: number): { k: number; isInverted: boolean } {
  const t = mod(f, LOOP)
  if (t >= 26 && t < 40) return { k: smoothstep(27, 35, t), isInverted: true }
  if (t >= 58) return { k: smoothstep(59, 67, t), isInverted: false }
  if (t < 8) return { k: 1, isInverted: false }
  return { k: 0, isInverted: false }
}

type Frame = { a: number; cy: number; level: number; tilt: number; pieces: Snapshot[] }

function simulate(): Frame[] {
  const rng = random(0x3a7c1)
  const pieces: Piece[] = []
  const add = (kind: Kind, n: number, r: number) => {
    for (let i = 0; i < n; i++) {
      pieces.push({ kind, u: (rng() - 0.5) * 12, v: 2 + rng() * 7, vu: 0, vv: 0, r, spin: rng() * Math.PI, shape: Math.floor(rng() * CHUNKS.length) })
    }
  }
  add('chicken', 7, 1.6)
  add('garlic', 2, 1)
  add('rosemary', 2, 1.3)
  add('pepper', 8, 0.6)
  const bubbles: Piece[] = Array.from({ length: 10 }, () => ({ kind: 'bubble' as Kind, u: 0, v: 0, vu: 0, vv: 0, r: 0.6, spin: 0, shape: 0 }))
  const bubbleLife = bubbles.map(() => 0)
  const all = [...pieces, ...bubbles]

  let spinFluid = 0
  let tilt = 0
  let tiltVel = 0
  const out: Frame[] = []

  for (let f = 0; f < LOOP * 2; f++) {
    const a = angle(f)
    const w = mod(angle(f + 1) - angle(f) + Math.PI, Math.PI * 2) - Math.PI
    spinFluid += (w - spinFluid) * 0.2
    tiltVel += (-(w - spinFluid) * 2.2 - tilt) * 0.35
    tiltVel *= 0.72
    tilt = clamp(tilt + tiltVel, -0.4, 0.4)
    const cy = centreY(a)
    const cos = Math.cos(a)
    const sin = Math.sin(a)

    const keys: number[] = []
    for (let y = 0; y < H; y++) {
      for (let x = 12; x < 52; x++) {
        const dx = x - CX
        const dy = y - cy
        if (partAt(dx * cos + dy * sin, -dx * sin + dy * cos) === 'inside') keys.push(y - tilt * dx)
      }
    }
    keys.sort((p, q) => q - p)
    const level = keys[Math.floor(keys.length * FILL)] ?? 0
    const isWet = (p: Piece) => {
      const x = p.u * cos - p.v * sin
      const y = p.u * sin + p.v * cos + cy
      return y - tilt * x >= level - 0.3
    }

    if (Math.abs(w) > 0.02) {
      for (const [i, b] of bubbles.entries()) {
        if ((bubbleLife[i] ?? 0) > 0 || rng() > 0.35) continue
        const side = a < Math.PI * 1.1 ? -1 : 1
        b.u = (rng() - 0.5) * 10
        b.v = side * (5 + rng() * 3)
        b.vu = 0
        b.vv = 0
        bubbleLife[i] = 14
        break
      }
    }

    const gu = sin
    const gv = cos
    const hold = settle(f)
    for (let step = 0; step < 4; step++) {
      for (const [i, p] of all.entries()) {
        if (p.kind === 'bubble' && (bubbleLife[i - pieces.length] ?? 0) <= 0) continue
        const slot = SLOTS[i]
        if (slot && hold.k > 0) {
          const [su, sv] = hold.isInverted ? [-slot[0], INSIDE_TOP + INSIDE_BOTTOM - slot[1]] : slot
          p.vu += (su - p.u) * 0.12 * hold.k
          p.vu *= 1 - 0.15 * hold.k
          if (sv < 50 && sv > -50) {
            p.vv += (sv - p.v) * 0.12 * hold.k
            p.vv *= 1 - 0.15 * hold.k
          }
        }
        const wet = isWet(p)
        const sink = wet ? SINK[p.kind] : p.kind === 'bubble' ? 0 : 1.2
        p.vu += gu * sink * 0.25
        p.vv += gv * sink * 0.25
        if (wet) {
          const fu = -(spinFluid - w) * p.v * 0.9
          const fv = (spinFluid - w) * p.u * 0.9
          p.vu += (fu - p.vu) * 0.22
          p.vv += (fv - p.vv) * 0.22
        }
        p.u += p.vu * 0.25
        p.v += p.vv * 0.25
        p.spin += (spinFluid - w) * 0.6 + p.vu * 0.05
        const lo = INSIDE_TOP + p.r
        const hi = INSIDE_BOTTOM - p.r
        const side = INSIDE_U - p.r
        if (p.u < -side || p.u > side) {
          p.u = clamp(p.u, -side, side)
          p.vu *= -0.2
          p.vv *= 0.8
        }
        if (p.v < lo || p.v > hi) {
          p.v = clamp(p.v, lo, hi)
          p.vv *= -0.2
          p.vu *= 0.8
        }
      }
      for (let i = 0; i < pieces.length; i++) {
        for (let j = i + 1; j < pieces.length; j++) {
          const p = pieces[i]
          const q = pieces[j]
          if (!p || !q) continue
          const du = q.u - p.u
          const dv = q.v - p.v
          const d = Math.hypot(du, dv) || 0.01
          const min = p.r + q.r
          if (d >= min) continue
          const push = (min - d) / 2
          p.u -= (du / d) * push
          p.v -= (dv / d) * push
          q.u += (du / d) * push
          q.v += (dv / d) * push
        }
      }
    }
    for (const [i, b] of bubbles.entries()) {
      if ((bubbleLife[i] ?? 0) <= 0) continue
      bubbleLife[i] = (bubbleLife[i] ?? 0) - 1
      if (!isWet(b)) bubbleLife[i] = 0
    }

    if (f >= LOOP) {
      out.push({
        a, cy, level, tilt,
        pieces: all.map((p, i) => ({ u: p.u, v: p.v, spin: p.spin, alive: i < pieces.length || (bubbleLife[i - pieces.length] ?? 0) > 0 })),
      })
    }
  }

  const first = out[0]
  const last = out[LOOP - 1]
  if (first && last) {
    const gap = first.pieces.map((p, i) => {
      const q = last.pieces[i]
      return q ? [p.u - q.u, p.v - q.v, p.spin - q.spin] : [0, 0, 0]
    })
    out.forEach((fr, f) => {
      const t = f / (LOOP - 1)
      fr.pieces.forEach((p, i) => {
        const g = gap[i] ?? [0, 0, 0]
        p.u += (g[0] ?? 0) * t
        p.v += (g[1] ?? 0) * t
        p.spin += (g[2] ?? 0) * t
      })
    })
  }

  return out
}

const hold = (f: number) => (f >= 26 && f < 32) || (f >= 58 && f < 64)

function render(): Int32Array[] {
  const sim = simulate()
  const kinds: Kind[] = [
    ...Array<Kind>(7).fill('chicken'), ...Array<Kind>(2).fill('garlic'), ...Array<Kind>(2).fill('rosemary'),
    ...Array<Kind>(8).fill('pepper'), ...Array<Kind>(10).fill('bubble'),
  ]
  const shapes = random(0x51)

  const chunkOf = kinds.map(() => Math.floor(shapes() * CHUNKS.length))

  return frames(LOOP, (c, f) => {
    const s = sim[f]
    if (!s) return
    const { a, cy, level, tilt } = s
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    const toLocal = (x: number, y: number): [number, number] => {
      const dx = x - CX
      const dy = y - cy
      return [dx * cos + dy * sin, -dx * sin + dy * cos]
    }
    const toWorld = (u: number, v: number): [number, number] => [CX + u * cos - v * sin, cy + u * sin + v * cos]
    const isLiquid = (x: number, y: number) => y - tilt * (x - CX) >= level

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const lamp = Math.hypot((x - 14) * 0.6, y + 4) / 26
        let level = 5.4 - lamp * 2.6
        if (y % 5 === 3) level -= 0.5
        if (x < 6 - y * 0.12 || x > 58 + y * 0.12) level -= 1.4
        c.set(x, y, shade(FRIDGE, level))
      }
    }
    for (const ex of [5, 9, 13]) {
      c.ellipse(ex, SHELF_Y - 4, 1.6, 2, (x: number, y: number) => shade(EGG, x < ex && y < SHELF_Y - 4 ? 2 : 1))
    }
    c.rect(2, SHELF_Y - 3, 15, 3, (x: number, y: number) => shade(FRIDGE, y === SHELF_Y - 3 ? 2.4 : 1.6 + (x % 4 === 0 ? -0.5 : 0)))
    c.rect(52, 9, 7, SHELF_Y - 9, (x: number) => shade(BOTTLE, x === 53 ? 2 : x === 58 ? 0 : 1))
    c.rect(53, 6, 5, 3, (x: number) => shade(BOTTLE, x === 54 ? 1.6 : 0.6))
    c.rect(53, 4, 5, 2, (x: number) => shade(CAP, x === 54 ? 1 : 0))
    c.rect(52, 15, 7, 4, (x: number) => shade(FRIDGE, x === 53 ? 3.6 : 2.6))

    for (let x = 0; x < W; x++) {
      c.set(x, SHELF_Y, shade(FRIDGE, 3.4))
      c.set(x, SHELF_Y + 1, shade(SHELF, 2.6 - (x > 40 ? 0.5 : 0)))
      c.set(x, SHELF_Y + 2, shade(SHELF, 1.4))
      c.set(x, SHELF_Y + 3, shade(FRIDGE, 1.2))
    }
    const foot = Math.abs(Math.cos(a)) * 7 + Math.abs(Math.sin(a)) * 10
    for (let x = Math.round(CX - foot); x <= Math.round(CX + foot + 4); x++) {
      c.set(x, SHELF_Y, mix(shade(FRIDGE, 3.4), MARINADE[2] ?? 0, 0.55))
    }
    for (let x = Math.round(CX + foot + 1); x <= Math.round(CX + foot + 5); x++) {
      c.set(x, SHELF_Y, mix(shade(FRIDGE, 3.4), MARINADE[6] ?? 0, 0.45))
    }

    const facing = 0.8 * cos + 0.6 * sin
    const side = clamp(facing * 1.5, -1, 1)
    const strip = -(INSIDE_U - 1) * side

    for (let y = 0; y < H; y++) {
      for (let x = 10; x < 54; x++) {
        const [u, v] = toLocal(x, y)
        const part = partAt(u, v)
        if (!part) continue
        if (part === 'lid') {
          const ridge = Math.round(u + 7) % 2 === 0 ? -0.5 : 0
          const lit = (-u / 7) * 1.2 * side
          c.set(x, y, shade(LID, 2.8 + lit + ridge + (v > -9.5 ? -0.8 : 0)))
        } else if (part === 'neck') {
          c.set(x, y, shade(GLASS, 1.4 + (Math.abs(u - strip * 0.8) < 1 ? 1.4 : 0)))
        } else if (part === 'glass') {
          const toLamp = -u * side
          if (isLiquid(x, y)) c.set(x, y, shade(MARINADE, 4 + Math.sign(toLamp) * Math.abs(side)))
          else c.set(x, y, shade(GLASS, 1.5 + 1.5 * Math.sign(toLamp) * Math.abs(side)))
        } else if (isLiquid(x, y)) {
          const edge = Math.abs(u) / INSIDE_U
          const surface = y - tilt * (x - CX) - level
          const lit = 2.2 - edge * 1.2 - Math.max(0, (y - 12) * 0.05) + (surface < 1 ? 1.4 : 0)
          c.set(x, y, shade(MARINADE, lit))
        } else {
          c.set(x, y, shade(FRIDGE, 3.4))
        }
      }
    }

    const paintIn = (x: number, y: number, ramp: readonly number[], level: number) => {
      const [u, v] = toLocal(x, y)
      if (partAt(u, v) !== 'inside') return
      c.set(x, y, shade(ramp, isLiquid(x, y) ? level - 1 : level))
    }
    s.pieces.forEach((p, i) => {
      if (!p.alive) return
      const kind = kinds[i]
      const [wx, wy] = toWorld(p.u, p.v)
      const x0 = Math.round(wx)
      const y0 = Math.round(wy)
      if (kind === 'chicken') {
        const art = CHUNKS[chunkOf[i] ?? 0] ?? []
        const ox = x0 - Math.floor((art[0]?.length ?? 0) / 2)
        const oy = y0 - 1
        art.forEach((row, j) => {
          for (let k = 0; k < row.length; k++) {
            if (row[k] !== 'c') continue
            const lit = 3 - (k / row.length) * 1.4 - j * 0.6 + (j === 0 && k <= 1 ? 1 : 0)
            paintIn(ox + k, oy + j, CHICKEN, lit + 1)
          }
        })
      } else if (kind === 'garlic') {
        paintIn(x0, y0, GARLIC, 2)
        paintIn(x0 + 1, y0, GARLIC, 1.4)
        paintIn(x0, y0 + 1, GARLIC, 1.4)
      } else if (kind === 'rosemary') {
        const da = Math.cos(p.spin)
        const db = Math.sin(p.spin)
        for (let k = -3; k <= 3; k++) {
          const sx = Math.round(wx + da * k)
          const sy = Math.round(wy + db * k)
          paintIn(sx, sy, ROSEMARY, 2)
          if (k % 2 === 0 && k !== 3) paintIn(sx - Math.round(db), sy + Math.round(da), ROSEMARY, 3.4)
          if (k % 2 !== 0) paintIn(sx + Math.round(db), sy - Math.round(da), ROSEMARY, 2.8)
        }
      } else if (kind === 'pepper') {
        paintIn(x0, y0, PEPPER, 1.6)
      } else if (kind === 'bubble') {
        paintIn(x0, y0, BUBBLE, 2)
      }
    })

    if (Math.abs(sin) < 0.01) {
      for (const b of particles(f, LOOP, 9, 9, 7)) {
        const down = cos > 0 ? 1 : -1
        const [x, y] = toWorld((b.r[1] - 0.5) * 10, down * (6 - b.age * 9))
        if (!isLiquid(x, y - 1) || hold(f)) continue
        paintIn(Math.round(x), Math.round(y), BUBBLE, 1.4 + b.age)
      }
    }

    for (let y = 0; y < H; y++) {
      for (let x = 10; x < 54; x++) {
        const [u, v] = toLocal(x, y)
        if (partAt(u, v) !== 'inside') continue
        const wet = isLiquid(x, y)
        if (Math.abs(u - strip) < 0.5 && v > -5 && v < 7) c.set(x, y, wet ? MARINADE[5] ?? 0 : GLASS[3] ?? 0)
        if (Math.abs(u - strip * 0.6) < 0.5 && v > -5 && v < -2) c.set(x, y, wet ? MARINADE[4] ?? 0 : GLASS[2] ?? 0)
      }
    }
  })
}

export const scene: Scene = {
  verb: 'Marinating',
  render,
  hero: 19,
  snaps: [
    { frames: 16, box: [27, 10, 32, 13], colors: [...ROSEMARY.slice(2, 4), GLASS[3] ?? 0], why: 'a rosemary sprig spins over as the jar tips' },
    { frames: 18, box: [21, 22, 26, 25], colors: [...MARINADE.slice(0, 2), MARINADE[3] ?? 0, ...CHICKEN.slice(2, 5), PEPPER[1] ?? 0], why: 'the chicken falls through the marinade as the jar goes over' },
    { frames: 18, box: [31, 14, 40, 16], colors: [GLASS[3] ?? 0, MARINADE[1] ?? 0], why: 'the marinade sloshes across the glass as the jar goes over' },
    { frames: 18, box: [24, 17, 28, 20], colors: [MARINADE[1] ?? 0, GARLIC[0] ?? 0], why: 'a clove of garlic falls through the marinade as the jar goes over' },
    { frames: 20, box: [29, 15, 34, 19], colors: [MARINADE[2] ?? 0], why: 'the marinade sloshes back as the jar settles on its lid' },
    { frames: 48, box: [38, 22, 43, 25], colors: [...MARINADE.slice(0, 2), MARINADE[3] ?? 0], why: 'the marinade sloshes as the jar rolls over its side' },
    { frames: 50, box: [25, 16, 27, 24], colors: [...ROSEMARY.slice(1, 3), CHICKEN[2] ?? 0, CHICKEN[4] ?? 0], why: 'a rosemary sprig drops past the chicken as the jar rolls upright' },
    { frames: 68, box: [27, 18, 29, 20], colors: [...CHICKEN.slice(1, 3), CHICKEN[4] ?? 0], why: 'two pieces of chicken settle past each other (each moves under 2 px a frame)' },
  ],
}
