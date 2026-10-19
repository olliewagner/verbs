import { Canvas, beat, hex, lerp, mix, mod, shade, smoothstep, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 84

const BRICK = hex('2a1218 46201f 66302a 864236 a25640 ba6c4c cf8a60 e2aa7c f0c89a')
const PAVE = hex('2c2630 46404a 625a62 7e757a 9a9090 b6aca6 d2c8bc')
const CRATE = hex('2a160e 46281a 6a4024 8e5a30 b07a40 cc9a56 e2ba74 f4d898')
const CUP = hex('2a0a12 4e1018 7a1a1e a82a24 cc4430 e8683e f8966a fcc4a0')
const NAVY = hex('0c0e1e 161a34 22284c 30386a 444e88 6070a8')
const CREAM = hex('6a5e58 948678 bcae9a dcd0bc f2ead8')
const SKIN = hex('2e140e 4e2416 72381e 965028 b46a36 cc8a50 e0aa72')
const TWEED = hex('1e1610 32261a 4a3824 624a30 7c603e 98784e')
const HAIR = hex('0e0808 1e1210 30201a')
const PEA = hex('16300e 2c5a16 4a8a22 74b83a a8e070 e0ffc0')
const DUST = hex('5a4c40 7e6c5a a28e74 c4b094 e0d0b4 f4ead4')
const BIRD = hex('1c1c26 2e3040 484c60 666c84 8c92a8 b4b8c8')
const GOLD = hex('7a4c10 d1982a f4cc58')
const SUN = 0xfff2d0
const BEAK = 0xd08a3c
const FEET = 0xc06a4a
const NECK = 0x3c7a6a

const SLOTS = [20, 32, 44]
const RIM = 21
const CUP_H = 6

const SWAPS: [number, number, number][] = [[15, 0, 1], [24, 2, 1], [30, 1, 2], [38, 1, 0]]
const SWAP_LEN = 5
const DOWN = 43

const up = (f: number, t0: number, t1: number, t2: number, t3: number) => smoothstep(t0, t1, f) * (1 - smoothstep(t2, t3, f))
const show = (f: number) => smoothstep(62, 68, f) * (1 - smoothstep(70, 76, f))
const PEA_UP = 64
const DROP = 73

function held(f: number, slot: number): [number, number] {
  if (slot !== 1) return [SLOTS[slot] ?? 0, 5 * up(f, 47, 51, 52, 56)]
  const s = show(f)
  return [32 + 16 * s, 6 * up(f, 2, 6, 10, 14) + 5 * up(f, 60, 64, 75, 79) + 7 * s]
}

type CupAt = { x: number; lift: number; depth: number; smear: number }
function cupsAt(f: number): CupAt[] {
  let slots = [0, 1, 2]
  for (const [t0, a, b] of SWAPS) {
    if (f >= t0 + SWAP_LEN) {
      slots = slots.map(s => (s === a ? b : s === b ? a : s))
      continue
    }
    if (f < t0) break
    const p = (f - t0) / SWAP_LEN
    const e = smoothstep(0, 1, p)
    const smear = p > 0.15 && p < 0.85 ? 1 : 0
    return slots.map(s => {
      const x = SLOTS[s] ?? 0
      if (s === a) return { x: lerp(x, SLOTS[b] ?? 0, e), lift: Math.sin(Math.PI * e) * 4.5, depth: -1, smear }
      if (s === b) return { x: lerp(x, SLOTS[a] ?? 0, e), lift: -Math.sin(Math.PI * e) * 1.5, depth: 1, smear: -smear }
      return { x, lift: 0, depth: 0, smear: 0 }
    })
  }
  return slots.map(s => {
    const [x, lift] = held(f, s)
    const dx = x - (held(f - 1, s)[0] ?? x)
    return { x, lift, depth: 0, smear: Math.abs(dx) >= 2.5 ? Math.sign(dx) : 0 }
  })
}

const gripOn = (x: number, lift: number): [number, number] => [x, RIM - CUP_H - lift + 1]
const glide = (f: number, a: [number, number], b: [number, number], t0: number, t1: number): [number, number] => {
  const e = smoothstep(t0, t1, f)
  return [lerp(a[0], b[0], e), lerp(a[1], b[1], e)]
}

function rightHand(f: number, cups: CupAt[]): [number, number] {
  const front = cups.find(k => k.depth === 1)
  if (front) return gripOn(front.x, front.lift)
  if (f < 14) return gripOn(...held(f, 1))
  if (f < DOWN + 4) {
    const next = SWAPS.find(([t0]) => t0 > f)
    const prev = [...SWAPS].reverse().find(([t0]) => t0 + SWAP_LEN <= f)
    const from = gripOn(SLOTS[prev ? prev[1] : 1] ?? 0, 0)
    const to = gripOn(SLOTS[next ? next[2] : 2] ?? 0, 0)
    return glide(f, from, to, prev ? prev[0] + SWAP_LEN : 13, next ? next[0] : DOWN + 4)
  }
  if (f < 56) return gripOn(...held(f, 2))
  if (f < 60) return glide(f, gripOn(SLOTS[2] ?? 0, 0), gripOn(SLOTS[1] ?? 0, 0), 56, 60)
  return gripOn(...held(f, 1))
}

function leftHand(f: number, cups: CupAt[]): [number, number] {
  const rest: [number, number] = [13, 19]
  const back = cups.find(k => k.depth === -1)
  if (back) return gripOn(back.x, back.lift)
  if (f < 12 || f >= 62) return rest
  if (f < DOWN + 4) {
    const next = SWAPS.find(([t0]) => t0 > f)
    const prev = [...SWAPS].reverse().find(([t0]) => t0 + SWAP_LEN <= f)
    const from: [number, number] = prev ? gripOn(SLOTS[prev[2]] ?? 0, 0) : rest
    const to = gripOn(SLOTS[next ? next[1] : 0] ?? 0, 0)
    return glide(f, from, to, prev ? prev[0] + SWAP_LEN : 12, next ? next[0] : DOWN + 4)
  }
  if (f < 56) return gripOn(...held(f, 0))
  return glide(f, gripOn(SLOTS[0] ?? 0, 0), rest, 56, 62)
}

const QUESTION: [number, number][] = (() => {
  const pts: [number, number][] = []
  for (let a = Math.PI * 1.05; a >= -Math.PI * 0.45; a -= 0.42) pts.push([12 + Math.cos(a) * 2.6, 5 - Math.sin(a) * 2.6])
  pts.push([12, 9.2], [12, 10.6])
  return pts
})()

const INKS = [...BRICK, ...PAVE, ...CRATE, ...CUP, ...NAVY, ...CREAM, ...SKIN, ...TWEED, ...HAIR, ...PEA, ...DUST, ...BIRD, ...GOLD, SUN, BEAK, FEET, NECK]
const snapped = new Map<number, number>()
function snap(color: number): number {
  const known = snapped.get(color)
  if (known !== undefined) return known
  const [r, g, b] = [(color >> 16) & 255, (color >> 8) & 255, color & 255]
  let best = 0
  let bestD = Infinity
  for (const ink of INKS) {
    const d = 3 * (((ink >> 16) & 255) - r) ** 2 + 4 * (((ink >> 8) & 255) - g) ** 2 + 2 * ((ink & 255) - b) ** 2
    if (d < bestD) [best, bestD] = [ink, d]
  }
  snapped.set(color, best)
  return best
}

const BODY = (() => {
  const m = new Canvas()
  m.poly([[21, 21], [21, 13], [23, 11], [29, 10], [35, 10], [41, 11], [43, 13], [43, 21]], 1)
  m.rect(30, 9, 5, 2, 2)
  m.ellipse(32, 6.2, 4.3, 3.6, 2)
  m.ellipse(32, 2.4, 5, 2.2, 3)
  m.rect(26, 3, 12, 1, 3)
  return m
})()

function peaAt(f: number, hand: [number, number]): [number, number] | undefined {
  if (f >= PEA_UP && f < DROP) return [Math.round(hand[0]), Math.round(hand[1]) - 2]
  if (f >= DROP && f < DROP + 3) {
    const t = (f - DROP + 1) / 3
    const from: [number, number] = [Math.round(hand[0]), Math.round(hand[1]) - 2]
    return [Math.round(lerp(from[0], 32, t)), Math.round(lerp(from[1], 20, t * t))]
  }
  return undefined
}

const ink = (c: Canvas, x: number, y: number, color: number, ghost: number) => (ghost > 0 ? mix(c.get(x, y), color, ghost) : color)

function drawArm(c: Canvas, sx: number, [hx, hy]: readonly [number, number], side: number, ghost = 0): void {
  const sy = 12
  const ex = (sx + hx) / 2 + side * 3
  const ey = Math.max(sy, hy) + 2
  for (const dx of [0, 1]) {
    c.line(sx + dx, sy, ex + dx, ey, (x, y) => ink(c, x, y, shade(Math.floor(y / 2) % 2 ? NAVY : CREAM, dx ? 2 : 2.8, x, y), ghost))
    c.line(ex + dx, ey, hx + dx - 0.5, hy + 1, (x, y) => ink(c, x, y, shade(SKIN, dx ? 3.4 : 4.6, x, y), ghost))
  }
}

function drawHand(c: Canvas, [hx, hy]: readonly [number, number], ghost = 0): void {
  const paint = (color = 0) => (x: number, y: number) => ink(c, x, y, color, ghost)
  c.sprite(Math.round(hx) - 2, Math.round(hy) - 1, ['.abb.', 'abbbc', '.b.c.'], { a: paint(SKIN[6]), b: paint(SKIN[5]), c: paint(SKIN[3]) })
}

function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const cups = cupsAt(f)

    for (let y = 0; y < 25; y++) {
      for (let x = 0; x < W; x++) {
        const row = Math.floor(y / 3)
        const isMortar = y % 3 === 2 || (x + (row % 2) * 4) % 8 === 0
        const isShadow = BODY.get(x - 5, y - 2) !== 0 && y < 21
        const worn = (row * 7 + Math.floor((x + (row % 2) * 4) / 8) * 3) % 5 === 0 ? -0.6 : 0
        const base = 4.4 - (y > 20 ? (y - 20) * 0.3 : 0) + (isMortar ? 1.2 : worn)
        c.set(x, y, shade(BRICK, base - (isShadow ? 2.2 : 0), x, y))
      }
    }
    for (let y = 0; y < 25; y++) {
      c.set(3, y, shade(PAVE, y % 6 === 0 ? 2 : 4.2, 3, y))
      c.set(4, y, shade(PAVE, y % 6 === 0 ? 1.5 : 2.6, 4, y))
    }
    c.rect(52, 3, 9, 12, (x, y) => {
      const sun = Math.hypot(x - 56, y - 7.5) < 2.4
      const isBand = y === 12
      const isEdge = x === 60 || y === 14
      return sun ? GOLD[y < 7 ? 2 : 1] : isBand ? NAVY[3] : isEdge ? CREAM[1] : (x + y) % 9 === 0 ? CREAM[2] : CREAM[3]
    })
    for (let y = 25; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const isJoint = y === 25 || (x + (y > 28 ? 5 : 0)) % 13 === 0
        const isShadow = x > 52 && x < 58 + (y - 25) * 0.3
        c.set(x, y, shade(PAVE, 4.4 - (isJoint ? 1 : 0) - (isShadow ? 2 : 0) - (y - 25) * 0.1, x, y))
      }
    }

    for (let y = 0; y < 21; y++) {
      for (let x = 0; x < W; x++) {
        const m = BODY.get(x, y)
        if (m === 0) continue
        const side = x < 26 ? 0.6 : x > 38 ? -0.8 : 0
        const isTop = BODY.get(x, y - 1) !== m
        if (m === 1) {
          const isStripe = Math.floor((y - 11) / 2) % 2 === 0
          c.set(x, y, shade(isStripe ? NAVY : CREAM, (isStripe ? 2.4 : 2.8) + side + (isTop ? 1 : 0), x, y))
        } else if (m === 2) {
          c.set(x, y, shade(SKIN, 4.2 + side - (y >= 9 ? 1.6 : 0) - (y === 4 ? 0.6 : 0), x, y))
        } else {
          c.set(x, y, shade(TWEED, 3 + side - (y === 3 ? 1.4 : 0) + (y === 0 ? 0.8 : 0), x, y))
        }
      }
    }
    const look = f >= 14 && f < 44 ? mod(Math.floor(f / 3), 3) - 1 : f >= PEA_UP - 2 && f < DROP ? 1 : 0
    const isWink = f >= PEA_UP + 2 && f < DROP - 1
    for (const ex of [29, 34]) {
      const lift = f >= PEA_UP && f < DROP - 2 && ex === 29 ? -1 : 0
      c.set(ex, 4 + lift, HAIR[1] ?? 0)
      c.set(ex + 1, 4 + lift, HAIR[1] ?? 0)
      if (isWink && ex === 34) {
        c.set(ex, 5, SKIN[3] ?? 0)
        c.set(ex + 1, 5, SKIN[3] ?? 0)
        continue
      }
      c.set(ex, 5, CREAM[4] ?? 0)
      c.set(ex + 1, 5, CREAM[4] ?? 0)
      c.set(look < 0 ? ex : look > 0 ? ex + 1 : ex + (ex === 29 ? 1 : 0), 5, HAIR[0] ?? 0)
    }
    c.set(32, 6, SKIN[3] ?? 0)
    for (let x = 30; x <= 34; x++) c.set(x, 7, HAIR[2] ?? 0)
    if (f >= 48 && f < 77) {
      for (let x = 30; x <= 34; x++) c.set(x, 8, x === 30 || x === 34 ? SKIN[2] ?? 0 : CREAM[4] ?? 0)
    } else {
      c.set(32, 8, SKIN[2] ?? 0)
    }
    c.set(27, 6, SKIN[3] ?? 0)
    c.set(37, 6, SKIN[2] ?? 0)

    for (let y = 20; y < H; y++) {
      for (let x = 11; x <= 52; x++) {
        const isPost = x <= 12 || x >= 51
        if (y <= 22) {
          const seam = (x - 11) % 14 === 0 && y > 20 ? 1 : 0
          c.set(x, y, shade(CRATE, (y === 20 ? 6.6 : 5.4) - x * 0.012 - seam, x, y))
        } else {
          const isGap = !isPost && (y === 26 || y === 30)
          const grain = (x * 5 + y * 3) % 17 === 0 ? -0.6 : 0
          c.set(x, y, shade(CRATE, isGap ? 0.6 : isPost ? (x <= 12 ? 4.4 : 2.2) : 3.4 + grain - (y === 23 ? 0.8 : 0), x, y))
        }
      }
    }

    const lh = leftHand(f, cups)
    const rh = rightHand(f, cups)
    const pea = peaAt(f, rh)
    const drawPea = (px: number, py: number) => {
      c.set(px - 1, py, PEA[4] ?? 0)
      c.set(px, py, PEA[3] ?? 0)
      c.set(px - 1, py + 1, PEA[2] ?? 0)
      c.set(px, py + 1, PEA[1] ?? 0)
    }
    if (f < 16 || f >= DROP + 3) drawPea(32, 20)

    const was = cupsAt(mod(f - 1, LOOP))
    const hands = [[24, lh, leftHand(mod(f - 1, LOOP), was), -1], [40, rh, rightHand(mod(f - 1, LOOP), was), 1]] as const
    const isFast = (a: readonly [number, number], b: readonly [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]) >= 1.5
    for (const [sx, hand, before, side] of hands) if (isFast(hand, before)) drawArm(c, sx, before, side, 0.4)
    for (const [sx, hand, , side] of hands) drawArm(c, sx, hand, side)
    if (pea && f >= DROP) drawPea(pea[0], pea[1])

    const order = [...cups].sort((a, b) => a.depth - b.depth)
    for (const k of order) {
      if (k.lift > 8) continue
      const sx = Math.round(k.x + 2 + k.lift * 0.4)
      c.ellipse(sx, 21.6, Math.max(2, 4 - k.lift * 0.3), 0.7, (x, y) => shade(CRATE, 4.2, x, y))
    }
    for (const k of order) {
      const top = Math.round(RIM - CUP_H - k.lift + 1)
      const cx = Math.round(k.x)
      if (k.smear !== 0) {
        for (let r = 1; r < CUP_H; r++) {
          c.tint(cx - k.smear * 4, top + r, CUP[4] ?? 0, 0.55)
          c.tint(cx - k.smear * 5, top + r, CUP[4] ?? 0, 0.3)
        }
      }
      for (let r = 0; r < CUP_H; r++) {
        const half = r < 3 ? 2 : 3
        for (let x = cx - half; x <= cx + half; x++) {
          const u = x - cx
          const isLip = r >= CUP_H - 2
          const form = u <= -half + 1 ? 1.4 : u === half ? -1.6 : u === -half + 2 ? 0.6 : 0
          const level = 3.6 + form + (isLip ? 0.8 : 0) + (r === 0 ? 0.9 : 0) - (r === CUP_H - 1 ? 0.6 : 0)
          c.set(x, top + r, shade(CUP, level, x, top + r))
        }
      }
      c.set(cx - 1, top + 1, CUP[7] ?? 0)
      c.set(cx - 1, top + 2, CUP[6] ?? 0)
    }

    for (const [, hand, before] of hands) if (isFast(hand, before)) drawHand(c, before, 0.4)
    for (const [, hand] of hands) drawHand(c, hand)
    if (pea && f < DROP) {
      drawPea(pea[0], pea[1])
      c.set(pea[0] - 1, pea[1], f === PEA_UP ? SUN : PEA[5] ?? 0)
      if (f >= PEA_UP && f < PEA_UP + 3) {
        const r = f === PEA_UP + 1 ? 3 : 2
        for (let k = 2; k <= r; k++) {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.tint(pea[0] - 1 + dx * k, pea[1] + dy * k, SUN, k === r ? 0.5 : 0.85)
        }
      }
    }

    const dust = f - DOWN
    if (dust >= 0 && dust < 5) {
      for (const sx of SLOTS) {
        for (const side of [-1, 1]) {
          const x = sx + side * (4 + dust * 0.8)
          const y = 20.6 - dust * 0.35
          c.disc(x, y, 0.8 + dust * 0.15, (px, py) => shade(DUST, 3.6 - dust * 0.4 + (py < y ? 0.6 : 0), px, py))
        }
      }
    }

    if (f >= 64 && f < 82) {
      const shown = Math.min(QUESTION.length, Math.floor((f - 64) * 2.2) + 1)
      const fade = beat(f, 74, 82)
      const rise = Math.floor(fade * 4)
      QUESTION.slice(0, shown).forEach(([qx, qy]) => {
        const r = 1.15 * (1 - fade * 0.7)
        if (r < 0.5) return
        c.disc(qx, qy - rise, r, (px, py) => shade(DUST, 4.2 - fade * 2 + (py < qy - rise ? 0.8 : 0) - (px > qx ? 0.6 : 0), px, py))
      })
    }

    const peck = mod(f, 28) >= 20 && mod(f, 28) < 24 ? 2 : mod(f, 28) === 19 || mod(f, 28) === 24 ? 1 : 0
    const bx = 58
    const by = 26
    c.sprite(bx, by + 1, ['..bbbbt', '..wbwtt', '...l.l.'], { b: BIRD[4] ?? 0, w: BIRD[3] ?? 0, t: BIRD[1] ?? 0, l: FEET })
    c.sprite(bx, by + peck, ['.hh', 'khn'], { h: BIRD[3] ?? 0, n: NECK, k: BEAK })
    c.set(bx + 1, by + peck, BIRD[0] ?? 0)

    for (let x = 11; x <= 52; x++) c.tint(x, 20, SUN, 0.25)

    out.push(c.px.map(snap))
  }

  return out
}

export const scene: Scene = {
  verb: 'Befuddling',
  render,
  hero: 74,
  snaps: [
    { frames: 17, box: [21, 13, 34, 22], colors: [...CUP.slice(4, 7), CUP[2] ?? 0], why: 'the first two cups cross mid-swap, one over the other' },
    { frames: 22, box: [38, 15, 40, 17], colors: [SKIN[5] ?? 0, SKIN[3] ?? 0], why: 'the left hand hops to the far cup between swaps' },
    { frames: 64, box: [21, 14, 42, 16], colors: [...NAVY.slice(2, 4)], why: 'the cup sweeps up and out, uncovering the shirt behind it' },
  ],
}
