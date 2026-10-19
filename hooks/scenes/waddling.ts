import { Canvas, TAU, beat, ease, frames, hash, hex, lerp, mod, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96
const HORIZON = 15
const FEET = 25
const TRAVEL = 80
const SPACING = 12
const V = TRAVEL / LOOP
const DRIFT = SPACING / LOOP
const BASE = 13
const REST = 51

const SKY = hex('3a4686 525ca2 7472b8 9a86c2 c69ac0 e8b0ae f8cca6 fde4bc')
const SNOW = hex('3c3a66 55548c 7472ae 9692c8 b8b0dc d8cce6 f2e2ea fff4ec')
const RANGE = hex('6a6aa6 8478b4 a68ab8 d0a2b4 f0c0b4')
const ICE = hex('2a4a8a 3c6aa8 5a90c6 86b8de b8dcf0 eaf8fc')

const PAL: Record<string, number> = {
  K: 0x161a2e, k: 0x46496c, r: 0x7c6a8a, W: 0xfff2dc, w: 0xbab4d2, y: 0xf6b03a, o: 0xe8743a, e: 0xe4e2f0,
}

const STAND = [
  '..KKK...',
  '.KKKrr..',
  '.KKKeKoo',
  '.KKyWK..',
  'KKKyWW..',
  'KkKwWWW.',
  'KkKwWWW.',
  'KkKwWWW.',
  '.KKwwWW.',
  '..KwwW..',
]
const ARMS_OUT = [
  '...KKK...',
  '..KKKrr..',
  '..KKKeKoo',
  '..KKyWK..',
  '.KKKyWW..',
  'kKKKwWWW.',
  'k.KKwWWW.',
  '..KKwWWW.',
  '..KKwwWW.',
  '...KwwW..',
]
const FLAIL = [
  'k..KKK..k',
  '.k.KKrrk.',
  '..kKKeKoo',
  '...KyWK..',
  '..KKyWW..',
  '..KKwWWW.',
  '..KKwWWW.',
  '..KKwWWW.',
  '...KwwWW.',
  '...KwwW..',
]
const DIVE = [
  '.....KKK...',
  '...KKKKKr..',
  '.kKKKKKKeoo',
  'k.KKKKKyW..',
  '..KKKKwWW..',
  '.KKKwwWW...',
  'ooKwwW.....',
]
const BELLY = [
  '...........KK..',
  '...kk.....KKKr.',
  '..KKKKKKKKKKeoo',
  'ooKKKKKKKKKyW..',
  '..KwwwwWWWWWW..',
  '...wwwwWWWWW...',
]
const BELLY_LOOK = [
  '..........KKK..',
  '...kk.....KKeoo',
  '..KKKKKKKKKyr..',
  'ooKKKKKKKKKWW..',
  '..KwwwwWWWWWW..',
  '...wwwwWWWWW...',
]
const CROUCH = [
  '..KKK...',
  '.KKKrr..',
  '.KKKeKoo',
  'kKKyWW..',
  'KkKwWWW.',
  'KKKwWWW.',
  '.KKwwW..',
]
const TIP = [
  '....KKK...',
  '...KKKrr..',
  '...KKKeKoo',
  'k.KKyWK...',
  '.kKKyWW...',
  '..KKwWWW..',
  '..KKwWWW..',
  '..KKwwW...',
  '...KwW....',
]
const RISE = [
  '..KKK...',
  '.KKKrr..',
  '.KKKeKoo',
  '.KKyWK..',
  'KKKyWW..',
  'KkKwWWW.',
  '.KKwwWW.',
  '..KwwW..',
]

const leanRows = (n: number, amount: number) =>
  Array.from({ length: n }, (_, j) => Math.round((amount * (n - 1 - j)) / (n - 1)))

function drawArt(c: Canvas, left: number, top: number, art: readonly string[], shifts?: readonly number[]): void {
  art.forEach((row, j) => {
    const s = shifts?.[j] ?? 0
    for (let i = 0; i < row.length; i++) {
      const paint = PAL[row[i] ?? '.']
      if (paint !== undefined) c.set(left + s + i, top + j, paint)
    }
  })
}

const iceX = (f: number) => mod(BASE + 21 - V * f + 16, TRAVEL) - 16
const isOnIce = (x: number, f: number) => Math.abs(x - iceX(f)) < 8

function waddle(x: number, f: number) {
  const s = Math.sin(TAU * mod((8 * f) / LOOP + x / 23, 1))
  const isNervous = isOnIce(x, f)
  const art = isNervous ? ARMS_OUT : STAND
  const foot = Math.round(x)
  const head = Math.round(x + (isNervous ? 1.6 : 1.1) * s)
  return { s, art, isNervous, rows: leanRows(art.length, head - foot).map(r => foot + r) }
}
function drawWalker(c: Canvas, x: number, f: number): void {
  const { s, art, isNervous, rows } = waddle(x, f)
  const before = waddle(x + DRIFT, f - 1).rows
  const after = waddle(x - DRIFT, f + 1).rows
  const held = rows.map((r, j) => (before[j] === after[j] ? (before[j] ?? r) : r))
  drawArt(c, -(isNervous ? 5 : 4), FEET - art.length, art, held)
  const front = s > 0.35
  const back = s < -0.35
  const fx = Math.round(x)
  const o = PAL.o ?? 0
  if (back) c.set(fx - 2, FEET - 1, o)
  else c.rect(fx - 2, FEET, 2, 1, o)
  if (front) c.set(fx + 2, FEET - 1, o)
  else c.rect(fx + 1, FEET, 2, 1, o)
}
type Slider = { x: number; y: number; art: readonly string[] | 'walk'; lean?: number; feet?: 'skid' | 'stand' }
function slider(f: number): Slider {
  const slot0 = BASE - DRIFT * f
  const slot4 = BASE + 4 * SPACING - DRIFT * f
  if (f < 26) return { x: slot0, y: FEET, art: 'walk' }
  if (f < 30) return { x: slot0 + beat(f, 26, 30) * 2, y: FEET, art: FLAIL, lean: f < 28 ? -1 : -2, feet: 'skid' }
  if (f < 32) return { x: slot0 + 2.5, y: FEET, art: FLAIL, feet: 'skid' }
  if (f < 33) return { x: slot0 + 2.5, y: FEET, art: TIP, feet: 'skid' }
  if (f < 36) return { x: slot0 + 3 + beat(f, 33, 35) * 3, y: FEET + Math.round(beat(f, 33, 35) * 2), art: DIVE }
  const sx = lerp(BASE + 5 - DRIFT * 36, REST, 1 - (1 - beat(f, 36, 70)) ** 1.8)
  if (f < 70) return { x: sx, y: FEET + 3, art: BELLY }
  if (f < 78) return { x: REST, y: FEET + 3, art: f >= 74 ? BELLY_LOOK : BELLY }
  if (f < 79) return { x: REST, y: FEET + 2, art: DIVE }
  if (f < 82) return { x: REST + 1, y: FEET + (f < 81 ? 2 : 1), art: CROUCH, feet: 'stand' }
  if (f < 83) return { x: REST + 1, y: FEET, art: RISE, feet: 'stand' }
  if (f < 85) return { x: lerp(REST, slot4, beat(f, 82, 85)), y: FEET, art: STAND, feet: 'stand' }
  return { x: slot4, y: FEET, art: 'walk' }
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const off = V * f

    c.fill((x, y) => {
      if (y >= HORIZON) return undefined
      const glow = Math.max(0, 1 - Math.hypot(x - 52, (y - 13) * 1.6) / 30)
      return shade(SKY, 0.4 + (y / HORIZON) * 5.6 + glow * 1.6, x, y)
    })
    for (let y = 7; y < HORIZON; y++) {
      for (let x = 44; x < 61; x++) {
        const d = Math.hypot(x - 52, (y - 12.5) * 1.05)
        if (d < 3.6) c.set(x, y, 0xfff6d8)
        else if (d < 5) c.set(x, y, SKY[7] ?? 0)
      }
    }
    for (let x = 0; x < W; x++) {
      const h = 2.2 + Math.sin(x * 0.21 + 1) * 1.6 + Math.sin(x * 0.53) * 0.8 + (x < 20 ? 1.4 : 0)
      const top = Math.round(HORIZON - Math.max(0.6, h))
      const slope = Math.sin(x * 0.21 + 1) * 0.21 * 1.6 + Math.sin(x * 0.53) * 0.53 * 0.8
      for (let y = top; y < HORIZON; y++) {
        const isLit = slope < -0.05 && y < top + 2
        c.set(x, y, shade(RANGE, (isLit ? 3.4 : 1.4) + (x > 40 ? 0.6 : 0) + (y === top ? 0.5 : 0), x, y))
      }
    }
    for (let y = HORIZON; y < H; y++) {
      const d = (y - HORIZON) / (H - 1 - HORIZON)
      const fac = 0.12 + 0.88 * ((y - HORIZON) / (FEET - HORIZON)) ** 1.25
      const travel = TRAVEL * fac
      const k1 = Math.max(1, Math.round(travel / (9 + d * 18)))
      const k2 = Math.max(1, Math.round(travel / (5 + d * 11)))
      for (let x = 0; x < W; x++) {
        const u = (x + off * fac) / travel
        const ridge = Math.sin(TAU * u * k1 + y * 2.1) + 0.7 * Math.sin(TAU * u * k2 + y * 0.9)
        const sheen = Math.max(0, 1 - Math.abs(x - 52 + (y - HORIZON) * 0.5) / (6 + d * 10)) * (1 - d)
        let level = 5.6 - d * 2.6 + sheen * 1.4
        if (ridge > 1.25) level -= 1.2
        else if (ridge > 1.05) level += 0.8
        c.set(x, y, shade(SNOW, level, x, y))
      }
    }
    const ix = iceX(f)
    for (let y = FEET - 2; y <= FEET + 2; y++) {
      for (let x = Math.floor(ix - 10); x <= Math.ceil(ix + 10); x++) {
        const e = ((x - ix) / 9.5) ** 2 + ((y - FEET) / 2.2) ** 2
        if (e > 1) continue
        const streak = mod(x - y * 2 - Math.round(ix), 7) < 2 ? 1.4 : 0
        c.set(x, y, shade(ICE, 2.6 - (y - FEET) * 0.5 + streak + (e > 0.75 ? -0.8 : 0), x, y))
      }
    }
    const sl = slider(f)
    const walkers = [1, 2, 3].map(k => BASE + k * SPACING - DRIFT * f)
    const shadowOf = (x: number, y: number, len: number) => {
      for (let i = 1; i <= len; i++) {
        const sx = Math.round(x) - i
        const sy = y + (i > len * 0.5 ? 1 : 0)
        c.set(sx, sy, shade(SNOW, 2.4 + (i / len) * 1.2, sx, sy))
        if (i < len * 0.7) c.set(sx, sy + 1, shade(SNOW, 2.8 + (i / len) * 1.2, sx, sy + 1))
      }
    }
    for (const x of walkers) shadowOf(x + 1, FEET, 13)
    shadowOf(sl.x + 1, sl.y, sl.art === 'walk' ? 13 : sl.art.length > 6 ? 11 : 6)
    if (f >= 36) {
      const start = BASE + 5 - V * (f - 36)
      const end = Math.min(sl.x - 6, REST - 6 - V * Math.max(0, f - 70))
      const fade = 1 - beat(f, 72, 92)
      for (let x = Math.max(0, Math.round(start)); x <= Math.round(end); x++) {
        if (hash(x + Math.round(off), 3) < fade) c.set(x, FEET + 3, shade(SNOW, 3, x, FEET + 3))
      }
    }
    for (const x of walkers) drawWalker(c, x, f)
    if (sl.art === 'walk') drawWalker(c, sl.x, f)
    else {
      const art = sl.art
      const width = Math.max(...art.map(r => r.length))
      const left = Math.round(sl.x) - Math.floor(width / 2)
      if (sl.y > FEET + 1) for (let x = left + 2; x < left + width - 2; x++) c.set(x, sl.y, shade(SNOW, 2.6, x, sl.y))
      drawArt(c, left, sl.y - art.length, art, sl.lean ? leanRows(art.length, sl.lean) : undefined)
      if (sl.feet === 'skid') {
        c.set(sl.x + 1, FEET, PAL.o ?? 0)
        c.set(sl.x + 2, FEET, PAL.o ?? 0)
        c.set(sl.x + 3, FEET - (Math.floor(f / 2) % 2), PAL.o ?? 0)
      } else if (sl.feet === 'stand') {
        c.set(sl.x - 2, sl.y, PAL.o ?? 0)
        c.set(sl.x + 1, sl.y, PAL.o ?? 0)
        c.set(sl.x + 2, sl.y, PAL.o ?? 0)
      }
    }
    for (let b = Math.max(36, f - 6); b <= f && b < 66; b++) {
      for (let i = 0; i < 2; i++) {
        const t = f - b
        const bx = slider(b).x - 7
        const x = bx - V * t - hash(b, i) * t * 0.6
        const y = FEET + 2 - (0.8 + hash(b, i, 2) * 0.9) * t + 0.22 * t * t
        if (y > FEET + 3) continue
        c.set(x, y, shade(SNOW, 6.2 - t * 0.4, 0, 0))
      }
    }
    for (const [at, px] of [[36, BASE + 5], [80, REST]] as const) {
      const t = f - at
      if (t < 0 || t > 6) continue
      for (let i = 0; i < 6; i++) {
        const a = Math.PI + (i / 5) * Math.PI
        const r = 2 + ease.out(t / 6) * 4
        const x = px - V * t + Math.cos(a) * r * 1.4
        const y = FEET + 3 + Math.sin(a) * r * 0.6
        if ((i + t) % 2 === 0 || t < 3) c.set(x, y, shade(SNOW, 6.5 - t * 0.5, 0, 0))
      }
    }
    for (let i = 0; i < 4; i++) {
      const gx = mod(hash(i, 9) * TRAVEL - off * 1.2, TRAVEL) - 8
      const gy = FEET + 2 + Math.floor(hash(i, 10) * 4)
      if (mod(f + i * 5, 12) < 3) c.set(gx, gy, 0xfffaf0)
    }
  })
}
export const scene: Scene = { verb: 'Waddling', render, hero: 53 }