import { Canvas, PALETTE, TAU, frames, hex, lerp, mix, mod, shade, threshold, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const TILE = hex('1c2624 2a3836 3c4c48 52645c 6e8074 8e9e8c b2bca4 d4d8bc')
const MAROON = hex('240c14 3e1420 5e1e28 82302e')
const TEAL = hex('0c2428 14383e 1e5258 2c6c70')
const DADO = hex('0a1612 10221c 183226 22442f 2e583a')
const FLOOR = hex('121018 1c1a22 28252e 36323c 48434e 5e5864')
const STRIPE = hex('2e2008 5a400e 8e6614 c8961e e8c040')
const ORANGE = PALETTE.orange
const PAIL = hex('22242e 3a3e4c 5a6070 828a9a aab2c0 d4dae2')
const STEEL = PALETTE.metal
const COPPER = PALETTE.copper
const BRASS = PALETTE.gold
const CRATE = PALETTE.wood
const HOODIE = hex('1e1a2c 2e2842 44395e 5e4e7c 7c6a98')
const BEANIE = hex('3a0e10 6a1a16 a02a1e d04428 ec7038')
const SKIN = hex('3a1c1c 6a3428 9a5438 c47a4a e0a068 f4c890')
const BEARD = hex('140a0e 24141a 3a2220 50302a')
const COAT = hex('141420 20202e 2e3040 404458 565c70')
const GOLD = hex('6a4610 a8761c e0b034 fce87a ffffe0')

function lit(x: number, y: number, flash: number): number {
  return Math.max(0, 1 - Math.hypot((x - 30) * 0.8, y - 2) / 34) * 2.2 + flash
}

type Target = 'bucket' | 'pot' | 'pan' | 'lid'
type Hand = 'L' | 'R'
type Hit = { f: number; hand: Hand; target: Target }

const STRIKE: Record<Hand, Partial<Record<Target, { x: number; y: number; a: number }>>> = {
  L: { bucket: { x: 23, y: 19, a: 0.35 }, pot: { x: 9, y: 18, a: Math.PI - 0.45 } },
  R: { bucket: { x: 26, y: 19, a: Math.PI - 0.35 }, pan: { x: 35, y: 19, a: 0.45 }, lid: { x: 41, y: 15, a: 0.25 } },
}
const SHOULDER: Record<Hand, [number, number]> = { L: [19, 14], R: [28, 14] }
const STICK = 6

const CRASH = 45
const HITS: Hit[] = (() => {
  const out: Hit[] = []
  for (let k = 0; k < 24; k++) {
    const f = k * 3
    if (f > CRASH && f < 57) continue
    const hand: Hand = k % 2 === 0 ? 'L' : 'R'
    let target: Target = hand === 'L' ? (k % 4 === 0 ? 'bucket' : 'pot') : k % 8 === 3 ? 'lid' : 'pan'
    if (f >= 36 && f < CRASH) target = hand === 'L' ? (k % 4 === 0 ? 'pot' : 'bucket') : 'pan'
    if (f === CRASH) target = 'lid'
    out.push({ f, hand, target })
  }
  out.push({ f: 40, hand: 'L', target: 'bucket' }, { f: 43, hand: 'L', target: 'bucket' })
  out.push({ f: CRASH, hand: 'L', target: 'bucket' })
  return out.sort((a, b) => a.f - b.f)
})()

function around(hand: Hand, f: number): { prev: Hit; next: Hit; dp: number; dn: number } {
  const mine = HITS.filter(h => h.hand === hand)
  let prev = mine[mine.length - 1] as Hit
  let next = mine[0] as Hit
  let dp = Infinity
  let dn = Infinity
  for (const h of mine) {
    const a = mod(f - h.f, LOOP)
    const b = mod(h.f - f, LOOP)
    if (a < dp) {
      dp = a
      prev = h
    }
    if (b < dn) {
      dn = b
      next = h
    }
  }
  return { prev, next, dp, dn }
}

type Swing = { s: number; from: Target; target: Target; w: number }
function swing(hand: Hand, f: number): Swing {
  const { prev, next, dp, dn } = around(hand, f)
  if (dp === 0) return { s: 1, from: prev.target, target: prev.target, w: 1 }
  const isHeld = hand === 'R' && prev.f === CRASH && dp < 12
  if (isHeld) return { s: 0, from: 'lid', target: 'lid', w: 1 }
  const down = dn === 1 ? 0.6 : dn === 2 ? 0.25 : 0
  const up = dp === 1 ? 0.5 : dp === 2 ? 0.15 : 0
  if (dp === 1 && dn === 1) return { s: next.f === CRASH ? 0.3 : 0.8, from: prev.target, target: next.target, w: 1 }
  const w = dp + dn <= 2 ? 1 : Math.min(1, Math.max(0, (dp - 1) / (dp + dn - 2)))
  return { s: Math.max(down, up), from: prev.target, target: next.target, w }
}
type Pose = { hx: number; hy: number; tx: number; ty: number; a: number }
function pose(hand: Hand, s: number, target: Target, f: number): Pose {
  const k = STRIKE[hand][target] ?? { x: 24, y: 19, a: 0.6 }
  const raised = k.a - 1.5 * Math.sign(Math.cos(k.a))
  let a = lerp(raised, k.a, s)
  const shx = k.x - Math.cos(k.a) * STICK
  const shy = k.y - Math.sin(k.a) * STICK
  const hx = lerp(shx + (hand === 'L' ? 0.5 : -0.5), shx, s)
  const hy = lerp(shy - 2, shy, s)
  const g = f - CRASH
  if (hand === 'R' && g >= 3 && g < 9) a = raised - ((g - 2) / 6) * TAU
  return { hx, hy, a, tx: hx + Math.cos(a) * STICK, ty: hy + Math.sin(a) * STICK }
}

function poseOf(hand: Hand, sw: Swing, f: number): Pose {
  const b = pose(hand, sw.s, sw.target, f)
  if (sw.from === sw.target || sw.w >= 1) return b
  const p = pose(hand, sw.s, sw.from, f)
  const turn = mod(b.a - p.a + Math.PI, TAU) - Math.PI
  const hx = lerp(p.hx, b.hx, sw.w)
  const hy = lerp(p.hy, b.hy, sw.w)
  const a = p.a + turn * sw.w
  return { hx, hy, a, tx: hx + Math.cos(a) * STICK, ty: hy + Math.sin(a) * STICK }
}

function since(target: Target, f: number): number {
  let best = Infinity
  for (const h of HITS) if (h.target === target) best = Math.min(best, mod(f - h.f, LOOP))
  return best
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const crash = mod(f - CRASH, LOOP)
    const flash = [0.9, -0.5, 0.5, 0.22, 0.08][crash] ?? 0
    const L = (x: number, y: number) => lit(x, y, flash)

    for (let y = 0; y < 23; y++) {
      for (let x = 0; x < W; x++) {
        const l = L(x, y)
        if (y < 2) {
          c.set(x, y, shade(FLOOR, 0.6 + l * 0.5))
          continue
        }
        if (y >= 6 && y <= 8) {
          if (y !== 7) c.set(x, y, shade(MAROON, 1 + l * 1.2))
          else c.set(x, y, mod(x, 4) < 2 ? shade(TEAL, 1 + l * 1.1) : shade(TILE, 3 + l * 1.6))
          continue
        }
        if (y === 16) {
          c.set(x, y, shade(MAROON, 1.2 + l * 1.2))
          continue
        }
        const isLow = y > 16
        const row = isLow ? y - 17 : y < 6 ? y - 3 : y - 9
        const course = Math.floor(row / 3)
        const isGrout = row % 3 === 2 || mod(x + (course % 2) * 3, 6) === 0
        const isGloss = !isGrout && row % 3 === 0 && mod(x + (course % 2) * 3, 6) < 3 && l > 1.2
        if (isLow) c.set(x, y, shade(DADO, 1.2 + l * 1.4 - (isGrout ? 1 : 0) + (isGloss ? 1 : 0)))
        else c.set(x, y, shade(TILE, 1.6 + l * 2.6 - (isGrout ? 1.1 : 0) + (isGloss ? 0.8 : 0)))
      }
    }
    for (let y = 3; y <= 14; y++) {
      for (let x = 49; x <= 61; x++) {
        const isFrame = x === 49 || x === 61 || y === 3 || y === 14
        if (isFrame) c.set(x, y, shade(STEEL, 2 + L(x, y) * 1.2 + (y === 3 ? 1 : 0)))
        else if (y >= 11 - Math.round(Math.sin(x * 0.7) * 1.2)) c.set(x, y, shade(TEAL, 0.8 + L(x, y)))
        else if (Math.hypot(x - 55, y - 10) < 2.6) c.set(x, y, shade(BRASS, 4.2 + L(x, y)))
        else c.set(x, y, shade(BEANIE, 1.4 + (11 - y) * -0.25 + L(x, y) * 0.8))
      }
    }
    for (let x = 16; x <= 44; x++) {
      c.set(x, 2, shade(STEEL, 2.4))
      const isOut = crash === 1 && x > 30
      c.set(x, 3, isOut ? shade(TILE, 3) : x === 16 || x === 44 ? 0xc8e4d0 : flash > 0.2 ? 0xffffff : 0xeef8e8)
    }
    for (let x = 14; x <= 46; x++) c.tint(x, 4, 0xeef8e8, crash === 1 ? 0 : 0.25 + Math.max(0, flash) * 0.22)

    for (let y = 23; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const l = L(x, y)
        if (y >= 30) {
          const isStud = y === 30 && mod(x, 4) < 2
          c.set(x, y, shade(STRIPE, 2.2 + l * 0.8 + (isStud ? 1.2 : 0) - (y === 31 ? 0.6 : 0)))
        } else {
          const isSlab = mod(x + (y > 26 ? 7 : 0), 14) === 0
          c.set(x, y, shade(FLOOR, 2 + l * 1.4 - (isSlab ? 0.8 : 0) + (y === 23 ? -0.8 : 0)))
        }
      }
    }

    const walk = mod(f - 22, LOOP)
    const cx = Math.round(66.2 - walk * 1.2)
    if (cx > -8 && cx < 70) {
      const back = new Canvas()
      back.px.set(c.px)
      commuter(back, cx, walk, f, L)
      for (let i = 0; i < c.px.length; i++) if (back.px[i] !== c.px[i]) c.px[i] = mix(back.px[i] ?? 0, 0x6e8074, 0.28)
    }

    c.ellipse(49, 28.4, 4.6, 1.2, shade(FLOOR, 0.6))
    c.ellipse(49, 27, 4.4, 1.6, (x, y) => shade(COAT, 2 + L(x, y) - (y > 27 ? 0.8 : 0)))
    c.ellipse(49, 26.6, 2.8, 0.9, shade(COAT, 0.4))
    for (const [x, y] of [[48, 26], [50, 27]] as const) c.set(x, y, shade(GOLD, 2))

    busker(c, f, L)

    const t = f - 37
    if (t >= 0 && t <= CRASH - 37 + 2) {
      const p = Math.min(1, t / (CRASH - 37))
      const x = Math.round(lerp(47, 49, p))
      const y = Math.round(lerp(17, 26, p) - Math.sin(p * Math.PI) * 6 - (t === CRASH - 36 ? 1 : 0))
      if (t <= CRASH - 37 + 1) {
        const isFace = t % 2 === 0
        c.set(x, y, shade(GOLD, 3))
        if (isFace) c.set(x + 1, y, shade(GOLD, 2))
        c.set(x, y - 1, shade(GOLD, isFace ? 4 : 2))
        if (isFace) c.set(x + 1, y - 1, shade(GOLD, 3))
      }
    }
    if (crash >= 0 && crash <= 4) {
      const r = [1, 2, 2, 1, 0][crash] ?? 0
      c.set(50, 24, 0xffffe0)
      for (let k = 1; k <= r; k++) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.set(50 + ox * k, 24 + oy * k, k === r ? shade(GOLD, 3) : 0xffffe0)
    }
  })
}
function commuter(c: Canvas, x: number, walk: number, f: number, L: (x: number, y: number) => number): void {
  const step = Math.floor(walk / 2) % 4
  const bob = step % 2 === 1 ? -1 : 0
  const y0 = 11 + bob
  const spread = [2, 0, -2, 0][step] ?? 0
  for (let y = 20; y <= 24; y++) {
    const k = (y - 19) / 5
    c.set(x + 1 + Math.round(spread * k * 0.6), y, shade(COAT, 0.6))
    c.set(x + 2 - Math.round(spread * k * 0.6), y, shade(COAT, 1.2))
  }
  for (let y = y0 + 3; y <= 20 + (bob ? 0 : 0); y++) {
    for (let i = 0; i < 4; i++) c.set(x + i, y, shade(COAT, 1.8 + L(x + i, y) * 0.6 + (i === 0 ? 0.6 : i === 3 ? -0.6 : 0) - (y > 18 ? 0.4 : 0)))
  }
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) c.set(x + i, y0 + 1 + j, shade(SKIN, 3 - i * 0.5))
  for (let i = -1; i < 4; i++) c.set(x + i, y0, shade(COAT, 1.6 + L(x, y0)))
  for (let i = 0; i < 3; i++) c.set(x + i, y0 - 1, shade(COAT, 2.2 + L(x, y0)))
  const g = f - 35
  if (g >= 0 && g < 4) {
    const arms: [number, number][][] = [[[-1, 15], [-2, 16]], [[-1, 15], [-2, 14]], [[-1, 14], [-2, 13]], [[-1, 15], [-2, 16]]]
    const arm = arms[g] ?? []
    for (const [ax, ay] of arm) c.set(x + ax, ay + bob, shade(COAT, 2.6))
    const last = arm[arm.length - 1]
    if (last) c.set(x + (last[0] ?? 0) - 1, (last[1] ?? 0) + bob, shade(SKIN, 3.4))
  } else {
    const swingArm = [0, 1, 0, -1][step] ?? 0
    c.set(x + 1 + swingArm, 18, shade(COAT, 0.8))
    c.set(x + 1 + swingArm, 19, shade(SKIN, 2))
  }
  c.rect(x + 3, 18, 2, 2, shade(CRATE, 2.4))
}
function busker(c: Canvas, f: number, L: (x: number, y: number) => number): void {
  const crash = mod(f - CRASH, LOOP)
  const isHappy = crash < 13
  const bass = since('bucket', f)
  const nod = bass === 0 || bass === 1 ? 1 : 0

  const hx = 20
  const hy = 5 + nod
  const HEAD = ['.bbbbb.', 'bbbbbbb', 'ccccccc', 'sssssss', 'sssssss', '.dsssd.', '..ddd..']
  HEAD.forEach((row, j) => {
    for (let i = 0; i < 7; i++) {
      const ch = row[i]
      const x = hx + i
      const y = hy + j
      const side = i <= 1 ? 0.6 : i >= 5 ? -0.9 : 0
      if (ch === 'b') c.set(x, y, shade(BEANIE, 2.6 + L(x, y) * 0.6 + side + (j === 0 ? 0.6 : 0)))
      else if (ch === 'c') c.set(x, y, shade(BEANIE, 1.8 + L(x, y) * 0.5 + side + (i % 2 ? 0.5 : 0)))
      else if (ch === 's') c.set(x, y, shade(SKIN, 3.2 + L(x, y) * 0.4 + side + (j === 3 ? 0.3 : 0)))
      else if (ch === 'd') c.set(x, y, shade(BEARD, 1.6 + side))
    }
  })
  c.set(hx + 3, hy - 1, shade(BEANIE, 3.6))
  c.set(hx + 3, hy + 4, shade(SKIN, 4.4))
  if (isHappy) {
    c.set(hx + 2, hy + 3, 0x140a10)
    c.set(hx + 4, hy + 3, 0x140a10)
    c.set(hx + 1, hy + 4, mix(shade(SKIN, 3.4), 0xe05a5a, 0.4))
    c.set(hx + 5, hy + 4, mix(shade(SKIN, 3), 0xe05a5a, 0.4))
    for (let i = 2; i <= 4; i++) c.set(hx + i, hy + 5, i === 3 ? 0xf2e6d6 : 0x4a1420)
  } else {
    c.set(hx + 2, hy + 3, shade(SKIN, 1.2))
    c.set(hx + 4, hy + 3, shade(SKIN, 1.2))
    for (let i = 2; i <= 4; i++) c.set(hx + i, hy + 5, shade(BEARD, i === 3 ? 0.6 : 2.4))
  }
  for (let y = 12 + nod; y <= 21; y++) {
    const w = y === 12 + nod ? 3 : 5
    for (let x = 24 - w; x <= 23 + w; x++) {
      const side = x <= 24 - w + 1 ? 0.7 : x >= 23 + w - 1 ? -0.7 : 0
      c.set(x, y, shade(HOODIE, 2 + L(x, y) * 0.7 + side - (y > 17 ? 0.4 : 0) + (y === 12 + nod ? 0.8 : 0)))
    }
  }
  c.set(22, 13 + nod, shade(STEEL, 6))
  c.set(22, 14 + nod, shade(STEEL, 5))
  c.set(25, 13 + nod, shade(STEEL, 5))
  c.set(25, 14 + nod, shade(STEEL, 4))

  const isRolling = (t: Target) => since(t, f) === 1 && since(t, f + 1) === 0
  const dip = (t: Target) => (since(t, f) === 0 || isRolling(t) ? 1 : 0)
  const glow = (t: Target) => (isRolling(t) ? 1.6 : ([1.6, 0.8, 0.3][since(t, f)] ?? 0))
  pail(c, 8, 23, 3.5, 28, L)
  const pd = dip('pot')
  for (let y = 18 + pd; y <= 22; y++) {
    for (let x = 3; x <= 13; x++) {
      const isTop = y === 18 + pd
      const u = (x - 3) / 10
      c.set(x, y, shade(STEEL, 2 + L(x, y) * 0.8 + (isTop ? 2.6 + glow('pot') * 1.4 : 0) + (u < 0.25 ? 0.9 : u > 0.8 ? -0.9 : 0) + (y === 22 ? 1.6 : 0)))
    }
  }
  c.set(2, 20 + pd, shade(STEEL, 1.6))
  c.set(14, 20 + pd, shade(STEEL, 1.2))
  const bd = dip('bucket')
  for (let y = 19 + bd; y <= 28; y++) {
    const k = (y - 19) / 9
    const x0 = Math.round(19 - k * 2) - (y >= 27 ? 1 : 0)
    const x1 = Math.round(28 + k * 2) + (y >= 27 ? 1 : 0)
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / (x1 - x0)
      const isTop = y === 19 + bd
      const rib = y === 22 ? 0.8 : y === 23 ? -0.8 : y === 27 ? 0.6 : y === 28 ? -0.6 : 0
      const roundness = u < 0.15 ? -0.5 : u > 0.78 ? -1.1 : u > 0.25 && u < 0.45 ? 0.7 : 0
      c.set(x, y, shade(ORANGE, 2.8 + L(x, y) * 0.6 + roundness + rib + (isTop ? 1.6 + glow('bucket') * 1.2 : 0)))
    }
  }
  for (let x = 16; x <= 32; x++) c.set(x, 29, shade(FLOOR, 0.6))
  for (let y = 22; y <= 28; y++) {
    for (let x = 32; x <= 38; x++) {
      const isSlat = y === 22 || y === 25 || y === 28 || x === 32 || x === 38
      c.set(x, y, isSlat ? shade(CRATE, 3.6 + L(x, y) - (x === 38 ? 1 : 0)) : shade(CRATE, 1))
    }
  }
  const nd = dip('pan')
  for (let y = 19 + nd; y <= 21; y++) {
    for (let x = 32; x <= 38; x++) {
      const isTop = y === 19 + nd
      c.set(x, y, shade(COPPER, 3 + L(x, y) + (isTop ? 1.6 + glow('pan') * 1.4 : 0) + (x === 32 ? 0.8 : x === 38 ? -1 : 0)))
    }
  }
  for (let x = 39; x <= 41; x++) c.set(x, 21, shade(STEEL, 3 - (x - 39) * 0.4))
  for (let y = 16; y <= 28; y++) c.set(43, y, shade(STEEL, 2.4 + L(43, y) * 0.5))
  c.set(42, 28, shade(STEEL, 2))
  c.set(44, 28, shade(STEEL, 1.6))
  const ls = since('lid', f)
  const wob = ls < 10 ? Math.round(Math.cos(ls * 1.6) * (ls === 0 ? 1 : (10 - ls) / 8)) : 0
  for (let i = -4; i <= 4; i++) {
    const y = 15 + Math.round((i / 4) * wob)
    const x = 43 + i
    c.set(x, y, shade(BRASS, 3.6 + L(x, y) + glow('lid') * 2 + (i === -2 ? 1 : 0) - (Math.abs(i) === 4 ? 0.8 : 0)))
    if (Math.abs(i) < 3) c.set(x, y - 1, shade(BRASS, 4.6 + glow('lid') * 2 - (i > 0 ? 0.8 : 0)))
  }
  c.set(43, 13, shade(STEEL, 4))

  for (const h of HITS) {
    const t = h.target
    const s = mod(f - h.f, LOOP)
    const isCrash = t === 'lid' && h.f === CRASH
    const life = isCrash ? 6 : 3
    if (s < 1 || s > life) continue
    const centre = { bucket: [24, 19], pot: [8, 18], pan: [35, 19], lid: [43, 15] }[t]
    const r = (isCrash ? 2.2 : 1.6) * s + 2
    const strength = 1 - (s - 1) / life
    for (let a = -Math.PI; a <= 0; a += 0.18) {
      const x = Math.round((centre[0] ?? 0) + Math.cos(a) * r * 1.3)
      const y = Math.round((centre[1] ?? 0) + Math.sin(a) * r * 0.75)
      if (strength > threshold(x, y) * 1.4) c.tint(x, y, isCrash ? 0xfff0b0 : 0xe8f4e0, 0.55 * strength + 0.15)
    }
  }

  for (const hand of ['L', 'R'] as const) {
    const now = swing(hand, f)
    const was = swing(hand, mod(f - 1, LOOP))
    const p = poseOf(hand, now, f)
    if (now.s - was.s > 0.35) {
      for (const m of [0.35, 0.7]) {
        const q = poseOf(hand, { ...now, s: lerp(was.s, now.s, m) }, f)
        c.line(q.hx, q.hy, q.tx, q.ty, (x, y) => mix(c.get(x, y), 0xe0c890, 0.25 + m * 0.25))
      }
    }
    const [sx, sy] = SHOULDER[hand]
    const ex = (sx + p.hx) / 2 + (hand === 'L' ? -1.5 : 1.5)
    const ey = Math.max(sy, p.hy) + 1.5
    const arm = (x: number, y: number) => shade(HOODIE, 2.6 + L(x, y) * 0.6 + (hand === 'L' ? 0.4 : -0.2))
    c.line(sx, sy, ex, ey, arm)
    c.line(sx, sy + 1, ex, ey + 1, arm)
    c.line(ex, ey, p.hx, p.hy, (x, y) => shade(SKIN, 2.4 + L(x, y) * 0.4))
    c.line(p.hx, p.hy, p.tx, p.ty, (x, y) => (x === Math.round(p.tx) && y === Math.round(p.ty) ? 0xfff2cc : 0xe2c080))
    c.set(p.hx, p.hy, shade(SKIN, 4))
    c.set(p.hx, p.hy + 1, shade(SKIN, 2.8))
  }
}
function pail(c: Canvas, cx: number, top: number, half: number, bottom: number, L: (x: number, y: number) => number): void {
  for (let y = top; y <= bottom; y++) {
    const w = half + (y - top) * 0.2
    for (let x = Math.round(cx - w); x <= Math.round(cx + w); x++) {
      const u = (x - cx + w) / (2 * w)
      c.set(x, y, shade(PAIL, 2.4 + L(x, y) * 0.6 + (u < 0.3 ? 0.7 : u > 0.75 ? -0.9 : 0) + (y === top + 2 ? 0.6 : 0) - (y === bottom ? 1 : 0)))
    }
  }
  for (let x = Math.round(cx - half - 2); x <= Math.round(cx + half + 2); x++) c.set(x, bottom + 1, shade(FLOOR, 0.6))
}

const GROOVE_BUCKET = HITS.filter(h => h.target === 'bucket' && (h.f < 36 || h.f > CRASH)).map(h => h.f)
export const scene: Scene = {
  verb: 'Improvising',
  render,
  hero: 46,
  snaps: [
    ...GROOVE_BUCKET.flatMap(f => [
      { frames: f, box: [17, 16, 19, 18] as const, why: 'the left stick lands on the bucket: the hand drops a pixel for the one contact frame' },
      { frames: f + 1, box: [21, 14, 29, 19] as const, why: "the bucket's ring sounds the frame after the stroke, then spreads and fades" },
    ]),
    { frames: 41, box: [19, 16, 25, 19], why: 'the fill: the left stick rebounds off the bucket for one frame between two strokes' },
    { frames: [CRASH, CRASH + 2], why: 'the crash: the tube flares, cuts out, catches again, and the whole platform brightens and dims with it' },
  ],
}