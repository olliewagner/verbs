import { beat, clamp, ease, frames, hash, hex, lerp, shade, wave, type Canvas, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const WALL = hex('0a1638 0f2050 142b68 1b3880 24479a 3058b2 4470c6')
const WALNUT = hex('140a08 1f110c 2c1810 3b2116 4c2c1c 5f3923 744830 8a5a3c')
const CARROT = hex('5a1c06 8a300a b84a10 e06a18 f68d2c fdb04e ffd27e')
const CORE = hex('f6a03a fbc260 ffdd94')
const GREEN = hex('0f2a10 1c4a18 2e6e22 4a922e 74b43c a6d458')
const STEEL = hex('1a1d26 2c303c 444a58 646c7c 8c95a4 b6bfcc dde4ec ffffff')
const HANDLE = hex('0c0a0e 18141a 26202a 383040')
const IRON = hex('0c0e16 151926 202638 2e3650 404a68')

const COUNTER = 19
const FRONT = 28
const SPAN = 64

const CY = 23.2
const SHOULDER = 17
const TIP = 45
const halfAt = (x: number) => (x < SHOULDER || x > TIP ? 0 : lerp(2.7, 0.55, ((x - SHOULDER) / (TIP - SHOULDER)) ** 1.15))

function drawCarrot(c: Canvas, ox: number, cutTo: number, shiver: number): void {
  for (let x = SHOULDER - 1; x <= TIP; x++) {
    const h = x < SHOULDER ? 1.9 : halfAt(x)
    for (let y = Math.floor(CY - h); y <= Math.ceil(CY + h); y++) {
      const v = (y - CY) / Math.max(0.6, h)
      if (Math.abs(y - CY) > h + 0.25) continue
      const isRing = (x * 7) % 9 === 0 && Math.abs(v) > 0.55
      const isCut = x < cutTo && h > 1 && (y === Math.round(CY) - 1 || y === Math.round(CY) + 1)
      const lit = 3.6 - v * 1.6 + (x < SHOULDER + 3 && v < 0 ? 0.6 : 0) - (isRing ? 1 : 0) - (isCut ? 1 : 0)
      c.set(x + ox + shiver, y, shade(CARROT, lit))
    }
  }
}

function drawTop(c: Canvas, ox: number, sway: number): void {
  const fronds: [number, number, number][] = [[9, 17, 0], [7, 20, 1], [11, 15, 2], [12, 24, 3], [6, 18, 4]]
  for (const [tx, ty, i] of fronds) {
    const ex = tx + ox + Math.round(sway * (i % 2 ? 1 : 0.6))
    c.line(SHOULDER - 2 + ox, 22, ex, ty, shade(GREEN, 2.2 + (ty < 20 ? 0.6 : 0)))
    c.set(ex, ty, shade(GREEN, 4))
    c.set(ex - 1, ty, shade(GREEN, 3))
    c.set(ex, ty - 1, shade(GREEN, 4.6))
  }
  c.set(SHOULDER - 2 + ox, 22, shade(GREEN, 1.6))
  c.set(SHOULDER - 2 + ox, 23, shade(GREEN, 1.2))
}

type Stick = { x0: number; y0: number; x1: number; y1: number; a1: number; delay: number; isEnd: boolean; tone: number }
const STICKS: Stick[] = (() => {
  const slots: [number, number, boolean][] = []
  const rows: [number, boolean, number[]][] = [
    [25, false, [24, 31.5, 39]],
    [24, true, [23, 26.5, 30, 33.5, 37, 40.5]],
    [23, false, [27.5, 35.5]],
    [22, true, [26, 29.5, 33, 36.5]],
    [21, false, [31.5]],
    [20, true, [29.5, 33.5]],
  ]
  for (const [y, isEnd, xs] of rows) for (const x of xs) slots.push([x, y, isEnd])
  const sticks: Stick[] = []
  let s = 0
  ;[6, 5, 4, 3].forEach((n, seg) => {
    for (let j = 0; j < n; j++) {
      const slot = slots[s++] ?? [32, 21, false]
      sticks.push({
        x0: SHOULDER + 3.5 + seg * 7, y0: Math.round(CY) - Math.floor(n / 2) + j, x1: slot[0], y1: slot[1],
        a1: 0, delay: seg * 1.3 + j * 0.3, isEnd: slot[2], tone: (j + seg) % 2,
      })
    }
  })
  return sticks
})()

function drawStick(c: Canvas, x: number, y: number, a: number, len: number, tone: number): void {
  if (len < 2.5) {
    c.set(x - 0.5, y, shade(CARROT, 3.6 + tone * 0.6))
    c.set(x + 0.5, y, shade(CORE, 1 + tone))
    return
  }
  const dx = (Math.cos(a) * (len - 1)) / 2
  const dy = (Math.sin(a) * (len - 1)) / 2
  c.line(x - dx, y - dy, x + dx, y + dy, shade(CARROT, 4 + tone * 1.2))
  c.set(x - dx, y - dy, shade(CORE, 1 + tone))
  c.set(x + dx, y + dy, shade(CORE, 0.5 + tone))
}

const RAMP_OF = new Map<number, readonly number[]>()
for (const r of [WALL, WALNUT, CARROT, CORE, GREEN, STEEL, HANDLE, IRON]) for (const col of r) RAMP_OF.set(col, r)
const lighter = (col: number, steps: number) => {
  const r = RAMP_OF.get(col)
  return r ? (r[Math.min(r.length - 1, r.indexOf(col) + steps)] ?? col) : col
}

type Knife = { x: number; y: number; a: number }
const HOVER: Knife = { x: 34, y: 11, a: -0.08 }
const WIND_UP: Knife = { x: 13, y: 9, a: -0.3 }

const WIND = 0
const DIVE = 15
const FLURRY = 24
const RETURN = 39
const PERCH = 52
const SHIVER = 55
const APART = 57
const PAN = 63
const BOW = 66
const FLURRY_X0 = 12
const FLURRY_X1 = 26
const CUT_Y = 22.5
const SINK = 2

const RETURN_X = [1, 2, 3.5, 5, 7, 8]
const LIFT_OFF = [1, 1, 1, 1, 1, 1.5, 1.5, 1.5, 1.5, 1.5, 1]
const PAN_STEPS = [1, ...Array.from({ length: 31 }, () => 2), 1]
function panAt(f: number): number {
  let x = 0
  for (let i = 0; i < Math.min(Math.max(0, f - PAN), PAN_STEPS.length); i++) x += PAN_STEPS[i] ?? 0
  return x
}
function glide(f: number, start: number, end: number): number {
  const t = beat(f, start, end)
  const a = 0.25
  const v = 1 / (1 - a)
  if (t < a) return (v * t * t) / (2 * a)
  if (t > 1 - a) return 1 - (v * (1 - t) ** 2) / (2 * a)
  return v * (t - a / 2)
}
const mixKnife = (p: Knife, q: Knife, t: number): Knife => ({ x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t), a: lerp(p.a, q.a, t) })

const sinkAt = (f: number) => (f < FLURRY || f >= RETURN ? 0 : Math.min(1, (f - FLURRY) / 3))

const spreadAt = sinkAt
const blurAt = (f: number) => (f < FLURRY || f >= RETURN - 1 ? 0 : Math.min(1, (RETURN - 1 - f) / 6))
function knifeAt(f: number): Knife {
  const bob = wave(f, LOOP, 4) * 0.7
  const hover = { ...HOVER, y: HOVER.y + bob }
  if (f < WIND) return hover
  if (f < DIVE) {
    const t = glide(f, WIND, DIVE)
    const k = mixKnife(hover, WIND_UP, t)
    return { ...k, y: k.y - Math.sin(Math.PI * t) * 1.5 }
  }
  const start: Knife = { x: FLURRY_X0, y: CUT_Y, a: -0.08 }
  if (f < FLURRY) return mixKnife(WIND_UP, start, beat(f, DIVE, FLURRY))
  if (f < RETURN) {
    const sink = sinkAt(f)
    return { x: lerp(FLURRY_X0, FLURRY_X1, beat(f, FLURRY, RETURN - 1)), y: CUT_Y + SINK * sink, a: start.a + 0.12 * sink }
  }
  if (f < PERCH) {
    const from: Knife = { x: FLURRY_X1, y: CUT_Y + SINK, a: start.a + 0.12 }
    const x = from.x + (RETURN_X[f - RETURN] ?? hover.x - from.x)
    let lift = 0
    for (let i = 0; i < f - (RETURN + 1); i++) lift += LIFT_OFF[i] ?? 0
    const ty = lift / (from.y - HOVER.y)
    return { x, y: from.y - lift, a: lerp(from.a, hover.a, ty) }
  }
  if (f >= BOW && f < BOW + 10) {
    const t = Math.sin(Math.PI * beat(f, BOW, BOW + 10))
    return { x: hover.x, y: hover.y + t * 1.2, a: hover.a + t * 0.3 }
  }
  return hover
}
function drawKnife(c: Canvas, k: Knife, glint: number, ghost = 0): void {
  const cos = Math.cos(k.a)
  const sin = Math.sin(k.a)
  const toWorld = (lx: number, ly: number) => [k.x + lx * cos - ly * sin, k.y + lx * sin + ly * cos] as const
  const toLocal = (x: number, y: number) => {
    const dx = x - k.x
    const dy = y - k.y
    return [dx * cos + dy * sin, -dx * sin + dy * cos] as const
  }
  const blade: [number, number][] = [[0, 0.4], [11, 0.4], [14, -0.3], [16.5, -1.4], [18.6, -3.4], [17, -3.9], [9, -4.3], [0, -4.3]]
  const grip: [number, number][] = [[-1, -3.6], [-8.4, -3.8], [-9.4, -3], [-9.4, -1.2], [-8.4, -0.4], [-1, -0.6]]
  if (ghost > 0) {
    c.poly(blade.map(([x, y]) => toWorld(x, y)), (x, y) => lighter(c.get(x, y), 1))
    return
  }
  c.poly(grip.map(([x, y]) => toWorld(x, y)), (x, y) => {
    const [lx, ly] = toLocal(x, y)
    const isRivet = (Math.abs(lx + 3) < 0.6 || Math.abs(lx + 6.2) < 0.6) && Math.abs(ly + 2.1) < 0.6
    return isRivet ? STEEL[6] : shade(HANDLE, 1.6 + (ly < -2.8 ? 1.2 : ly > -1.2 ? -0.8 : 0))
  })
  c.poly([toWorld(-1.2, -4.3), toWorld(0.2, -4.3), toWorld(0.2, 0.4), toWorld(-1.2, 0.4)], (x, y) => shade(STEEL, 3 + (toLocal(x, y)[1] < -2 ? 1 : 0)))
  c.poly(blade.map(([x, y]) => toWorld(x, y)), (x, y) => {
    const [lx, ly] = toLocal(x, y)
    const edge = ly > -1.1
    const spine = ly < -3.4
    const shine = Math.abs(lx - glint) < 2 ? 2 : 0
    return shade(STEEL, (edge ? 5.6 : spine ? 3.2 : 4.3) + shine)
  })
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const cam = panAt(f)
    const k = knifeAt(f)
    const spread = spreadAt(f)

    const back = cam * 0.5
    for (let y = 0; y < COUNTER; y++) {
      for (let x = 0; x < W; x++) {
        const wx = Math.round(x + back)
        const groove = wx % 4 === 0
        const bevel = wx % 4 === 1
        const lit = 3.9 - x * 0.03 - (y > 14 ? (y - 14) * 0.15 : 0) - (groove ? 1.2 : bevel ? -0.6 : 0)
        c.set(x, y, shade(WALL, lit))
      }
    }
    for (let x = 0; x < W; x++) {
      c.set(x, 3, shade(STEEL, 3.2 - x * 0.02))
      c.set(x, 4, shade(WALL, 1.4))
    }
    for (let i = -1; i < 4; i++) {
      const px = Math.round(i * 32 + 8 - back)
      c.set(px + 3, 4, shade(STEEL, 4))
      c.line(px + 3, 5, px + 3, 7, shade(IRON, 2.6))
      c.ellipse(px + 3, 11.5, 4.4, 3.8, (x, y) => {
        const d = Math.hypot((x - px - 3) / 4.4, (y - 11.5) / 3.8)
        return shade(IRON, d > 0.72 ? 2.6 + (x < px + 2 ? 1.2 : 0) : 1.2 + (x < px + 2 && y < 11 ? 0.8 : 0))
      })
      c.line(px + 14, 5, px + 14, 12, shade(STEEL, 3.4))
      c.ellipse(px + 14, 14, 1.6, 1.4, (x) => shade(STEEL, x < px + 14 ? 4.4 : 3))
      c.set(px + 14, 4, shade(STEEL, 4))
    }
    for (let y = COUNTER; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const wx = x + cam
        if (y >= FRONT) {
          c.set(x, y, shade(WALNUT, y === FRONT ? 5.4 - x * 0.02 : 2.2 - (y - FRONT) * 0.4))
          continue
        }
        const strip = Math.floor((y - COUNTER) / 2)
        const seg = Math.floor((wx + strip * 5) / 16)
        const isJoint = (wx + strip * 5) % 16 === 0
        const tone = hash(((seg % 4) + 4) % 4, strip, 9) * 0.9
        c.set(x, y, shade(WALNUT, 3.4 + (y - COUNTER) * 0.12 + tone - x * 0.02 - (isJoint ? 0.8 : 0) - (y === COUNTER ? 1.2 : 0)))
      }
    }
    const height = clamp((26 - k.y) / 18)
    const sx = k.x + Math.cos(k.a) * 6 + 3 + height * 4
    for (let x = Math.round(sx - 8 - height * 2); x <= Math.round(sx + 8 + height * 2); x++) {
      if (height < 0.95) c.set(x, 27, shade(WALNUT, 2.4 + height))
    }

    const fallen = f >= APART
    for (const station of [0, 1]) {
      const ox = Math.round(station * SPAN - cam)
      if (ox > W || ox < -SPAN) continue
      const isDone = station === 0 && fallen

      for (let x = SHOULDER - 1; x <= TIP + 1; x++) {
        if (x + ox < 0 || x + ox >= W) continue
        c.set(x + ox + 1, 26, shade(WALNUT, 2))
      }
      if (!isDone) {
        const cutTo = station === 0 && f >= FLURRY ? Math.min(TIP, Math.round(knifeAt(Math.min(f, RETURN - 1)).x) + 18) : 0
        const shiver = station === 0 && (f === SHIVER || f === SHIVER + 1) ? 1 : 0
        drawCarrot(c, ox, cutTo, shiver)
        drawTop(c, ox, station === 0 ? wave(f, LOOP, 2) : 0)
        continue
      }
      drawTop(c, ox, wave(f, LOOP, 2))
      for (const s of STICKS) {
        const t = beat(f, APART + s.delay, APART + 6 + s.delay)
        const rise = 2.5
        const y = t < 0.35 ? s.y0 - rise * ease.out(t / 0.35) : lerp(s.y0 - rise, s.y1, ease.outBounce((t - 0.35) / 0.65))
        const x = lerp(s.x0, s.x1, ease.inOut(t))
        const a = s.a1 * t + Math.sin(Math.PI * t) * (s.tone ? 0.7 : -0.7)
        drawStick(c, x + ox, y, a, s.isEnd ? lerp(7, 2, ease.in(t)) : 7, s.tone)
      }
      if (f >= APART + 13 && f < APART + 25) {
        const gx = 22 + (f - APART - 13) * 2 + ox
        c.set(gx, 22, CORE[2] ?? 0)
        c.set(gx + 1, 21, CORE[2] ?? 0)
      }
    }
    if (f >= FLURRY && f < RETURN) {
      const reach = 4 * spread * Math.min(1, blurAt(f) * 2)
      const up: Knife = { x: k.x, y: k.y - reach, a: k.a }
      const mid: Knife = { x: k.x, y: k.y - reach / 2, a: k.a }
      for (let j = 0; j < 3; j++) {
        const age = (f - FLURRY + j * 2) % 6
        const jx = Math.round(k.x + 4 + j * 6 + age * (j - 1))
        const jy = Math.round(20 - age * 1.5 + age * age * 0.25)
        if (age < 5) c.set(jx, jy, shade(CARROT, 5))
      }
      const blur = blurAt(f)
      if (spread > 0 && blur > 0) {
        drawKnife(c, up, -9, blur)
        drawKnife(c, mid, -9, blur)
      }
      for (let i = 2; i < 18; i += 4) {
        const gx = Math.round(k.x + i)
        for (let y = Math.round(up.y - 6); y < Math.round(up.y - 3); y++) c.set(gx, y, shade(WALL, 6))
      }
      drawKnife(c, k, -9)
    } else {
      const glint = f >= BOW && f < BOW + 12 ? -2 + (f - BOW) * 2 : -9
      drawKnife(c, k, glint)
    }
    if (f >= BOW + 3 && f < BOW + 7) {
      const tip = [k.x + Math.cos(k.a) * 18.6 + Math.sin(k.a) * 3.4, k.y + Math.sin(k.a) * 18.6 - Math.cos(k.a) * 3.4] as const
      const r = f === BOW + 4 || f === BOW + 5 ? 2 : 1
      c.set(tip[0], tip[1] - r, STEEL[7] ?? 0)
      c.set(tip[0], tip[1] + r, STEEL[7] ?? 0)
      c.set(tip[0] - r, tip[1], STEEL[7] ?? 0)
      c.set(tip[0] + r, tip[1], STEEL[7] ?? 0)
    }
  })
}
export const scene: Scene = {
  verb: 'Julienning',
  render,
  hero: 66,
  snaps: [
    { frames: APART, box: [16, 19, 46, 26], why: 'the joke: the whole carrot falls apart into matchsticks at once' },

    { frames: PERCH - 5, box: [33, 16, 53, 19], why: 'the knife lifts clear of the counter, uncovering the wall behind its edge' },
  ],
}