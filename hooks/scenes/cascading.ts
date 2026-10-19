import { Canvas, beat, clamp, ease, hash, hex, lerp, mix, mod, noise, particles, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72
const SCROLL = 2

const HAZE = hex('2c5a50 3b6e5e 4f846c 6a9c7c 8bb48e b4ceaa dbe8c8')
const CANOPY = hex('0b2219 12301f 1a4227 255a30 33723a 4a8c42 6aa64a')
const LEAF = hex('061410 0b2018 12301e 1c4426 2a5c2e 3f7a36 5e9a40 86b84c')
const ROCK = hex('0c1214 141c20 1d292b 293835 384940 4a5c4e 627262')
const MOSS = hex('1f3a1c 2f5424 46722c 66923a 8eb04a b6cc5c')
const WATER = hex('1d4a5a 2c6a7a 4a90a0 74b8c4 a6dce0 d8f4f2 ffffff')
const POOL = hex('061a1e 0b2a2e 123c40 1c5254 2a6a68 3e8480 5ea294')
const MIST = hex('a6d0c8 d0ece4')
const RAINBOW = hex('e8667a f0a462 eedc74 8ed48a 6eaee0 a088dc').map(c => mix(c, 0xd0ece4, 0.3))
const PETAL = hex('8a1f4e c83a72 f06a9a ffb0cc')
const POLLEN = 0xffe070

type Fall = { x0: number; x1: number; lip: number; foot: number }
const FALLS: Fall[] = [
  { x0: 29, x1: 34, lip: 4, foot: 10 },
  { x0: 25, x1: 37, lip: 12, foot: 17 },
  { x0: 22, x1: 40, lip: 19, foot: 25 },
]
const POOL_Y = 26

function isRock(x: number, y: number): boolean {
  const j = Math.round(hash(y, 3) * 1.6 - 0.3)
  const k = Math.round(hash(y, 4) * 1.6 - 0.3)
  const step = (l: number, r: number, top: number) => x >= l - j && x <= r + k && !((x === l - j || x === r + k) && y === top)
  if (y < 11) return step(17, 45, 3)
  if (y < 18) return step(13, 49, 11)
  if (y < POOL_Y) return step(7, 56, 18)
  return false
}
const fallAt = (x: number, y: number) => FALLS.find(s => x >= s.x0 && x <= s.x1 && y >= s.lip && y <= s.foot)

function boulder(x: number, y: number): { id: number; edge: number; dx: number; dy: number } {
  const gx = Math.floor(x / 10)
  const gy = Math.floor(y / 7)
  let d1 = 99
  let d2 = 99
  let id = 0
  let dx = 0
  let dy = 0
  for (let j = gy - 1; j <= gy + 1; j++) {
    for (let i = gx - 1; i <= gx + 1; i++) {
      const px = i * 10 + hash(i, j, 1) * 10
      const py = j * 7 + hash(i, j, 2) * 7
      const d = Math.hypot(x - px, (y - py) * 1.2)
      if (d < d1) {
        d2 = d1
        d1 = d
        id = i * 31 + j
        dx = x - px
        dy = y - py
      } else if (d < d2) {
        d2 = d
      }
    }
  }

  return { id, edge: d2 - d1, dx, dy }
}

const sun = (f: number) => 0.5 + 0.5 * Math.cos(((f - 40) / LOOP) * Math.PI * 2)

function streak(x: number, y: number, f: number): number {
  const g = Math.floor(x / 2) + (x % 7 === 0 ? 50 : 0)
  const k = mod(y - f * SCROLL, 24)
  const a = Math.floor(hash(g, 1) * 24)
  const b = mod(a + 9 + Math.floor(hash(g, 2) * 6), 24)
  const la = 3 + Math.floor(hash(g, 3) * 5)
  const lb = 2 + Math.floor(hash(g, 4) * 3)
  return mod(k - a, 24) < la ? 2.4 : mod(k - b, 24) < lb ? 1.3 : 0
}

function drift(x: number, y: number, f: number, rise: number, seed: number): number {
  const p = f / LOOP
  return lerp(noise(x, y + p * rise, p * 2, seed), noise(x, y + (p - 1) * rise, (p - 1) * 2, seed), p)
}

const churn = (x: number, y: number, f: number) => drift(x * 0.4, y * 0.7, f, -9, 1)
function mist(x: number, y: number, f: number): number {
  const shape = clamp(1 - Math.abs(y - 25) / 6) * clamp(1.3 - Math.abs(x - 31) / 22)
  return drift(x * 0.15, y * 0.28, f, 6, 5) * shape * 1.6
}

function crowns(x: number, base: number, size: number, seed: number): number {
  const i = Math.floor(x / size)
  let top = 99
  for (let k = i - 1; k <= i + 1; k++) {
    const cx = k * size + hash(k, seed) * size
    const r = size * (0.8 + hash(k, seed, 1) * 0.6)
    const dx = Math.abs(x - cx)
    if (dx <= r) top = Math.min(top, base - Math.sqrt(r * r - dx * dx) * 0.7 + hash(k, seed, 2) * 2)
  }

  return Math.round(Math.min(top, base + 1))
}

const BLOSSOM = ['.a.', 'aca', '.b.']
const TUMBLE = [BLOSSOM, ['.a.', 'bca', '.a.'], ['.b.', 'aca', '.a.'], ['.a.', 'acb', '.a.']]

function blossom(f: number): { x: number; y: number; isTumbling: boolean } | undefined {
  if (f < 3) return undefined
  if (f < 8) return { x: 31 + (f === 6 ? 1 : 0), y: Math.round(lerp(1, 3, ease.out(beat(f, 3, 6)))), isTumbling: false }
  if (f < 12) return { x: lerp(31, 30, beat(f, 8, 12)), y: lerp(4, 10, ease.in(beat(f, 8, 12))), isTumbling: true }
  if (f < 14) return undefined
  if (f < 17) return { x: lerp(30, 27, ease.inOut(beat(f, 14, 17))), y: 11, isTumbling: false }
  if (f < 21) return { x: 27, y: lerp(12, 17, ease.in(beat(f, 17, 21))), isTumbling: true }
  if (f < 23) return undefined
  if (f < 27) return { x: lerp(27, 33, ease.inOut(beat(f, 23, 27))), y: 18, isTumbling: false }
  if (f < 32) return { x: 33, y: lerp(19, 25, ease.in(beat(f, 27, 32))), isTumbling: true }
  if (f < 37) return undefined
  const away = ease.inOut(beat(f, 40, 71))
  const bob = Math.round(Math.sin((f - 37) * 0.5) * 0.6)
  return { x: lerp(34, 58, away), y: lerp(30, 27, ease.outBack(beat(f, 37, 40))) + bob, isTumbling: false }
}

function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const s = sun(f)
    const ray = (x: number, y: number) => (mod(x + y * 0.9, 17) < 3.5 ? s : 0)

    for (let x = 0; x < W; x++) {
      const far = crowns(x, 6, 3, 1)
      const mid = crowns(x, 12, 4, 2)
      const near = crowns(x, 17, 5, 3) + (x > 20 && x < 44 ? 9 : 0)
      for (let y = 0; y < POOL_Y; y++) {
        const r = ray(x, y)
        if (y >= near) c.set(x, y, shade(CANOPY, 2.4 - (y - near) * 0.1 + (y === near ? 1.4 : 0) + r * 1.2))
        else if (y >= mid) c.set(x, y, shade(HAZE, 2.6 + (y === mid ? 1 : 0) + r * 1.4))
        else if (y >= far) c.set(x, y, shade(HAZE, 4 + (y === far ? 0.8 : 0) + r * 1.4))
        else c.set(x, y, shade(HAZE, 5.6 + r))
      }
    }

    for (let y = 0; y < POOL_Y; y++) {
      for (let x = 0; x < W; x++) {
        if (!isRock(x, y) || fallAt(x, y)) continue
        const b = boulder(x, y)
        const isLedge = !isRock(x, y - 1) || y === 11 || y === 18
        const nearWater = FALLS.some(fl => y >= fl.lip && y <= fl.foot + 1 && (x === fl.x0 - 1 || x === fl.x1 + 1))
        if (isLedge && !nearWater) {
          c.set(x, y, shade(MOSS, 2.8 + (mod(x, 7) < 3 ? 0.8 : 0)))
          continue
        }
        const form = clamp(0.5 + (b.dx * 0.12 - b.dy * 0.16))
        const level = b.edge < 1.1 ? 0.8 : 2 + (Math.round(form * 2) / 2) * 3 + hash(b.id, 8) * 0.8 - (nearWater ? 1.2 : 0)
        c.set(x, y, shade(ROCK, level))
      }
    }
    for (const [x, y, len] of [[15, 12, 2], [20, 12, 3], [45, 12, 2], [10, 19, 3], [16, 19, 2], [48, 19, 3], [53, 19, 2]] as const) {
      for (let k = 0; k < len; k++) c.set(x, y + k, shade(MOSS, 2 - k * 0.5))
    }

    const top = FALLS[0]!
    for (let y = 0; y < top.lip; y++) {
      for (let x = top.x0; x <= top.x1; x++) {
        const glint = mod(x * 3 + y * 5 - f, 9) === 0 ? 1.4 : 0
        c.set(x, y, shade(WATER, 1.6 + y * 0.6 + glint))
      }
    }

    for (const fl of FALLS) {
      for (let y = fl.lip; y <= fl.foot; y++) {
        for (let x = fl.x0; x <= fl.x1; x++) {
          const u = (x - fl.x0) / (fl.x1 - fl.x0)
          const edge = u < 0.08 || u > 0.92 ? -1 : 0
          const curl = y === fl.lip ? 2.4 : y === fl.lip + 1 ? -0.6 : 0
          const light = u > 0.6 ? 0.5 : 0
          c.set(x, y, shade(WATER, 1.5 + streak(x, y, f) + edge + curl + light + s * 0.4))
        }
      }
    }
    for (const [y, x0, x1] of [[11, 25, 37], [18, 22, 40]] as const) {
      for (let x = x0; x <= x1; x++) {
        const dash = mod(Math.abs(x - 31) - f * 0.5, 4) < 1.5 ? 1.4 : 0
        c.set(x, y, shade(WATER, 3 + dash))
      }
    }
    for (const fl of FALLS) {
      const isPool = fl.foot === 25
      const wide = isPool ? 3 : 1
      for (let y = fl.foot - 1; y <= fl.foot + (isPool ? 2 : 1); y++) {
        for (let x = fl.x0 - wide; x <= fl.x1 + wide; x++) {
          const out = Math.max(0, fl.x0 - x, x - fl.x1)
          const n = churn(x, y, f) + (y === fl.foot ? 0.15 : 0) - out * 0.12 - (y > fl.foot + 1 ? 0.15 : 0)
          if (n > 0.52) c.set(x, y, shade(WATER, 6))
          else if (n > 0.36) c.set(x, y, shade(WATER, 4.4))
        }
      }
    }

    for (let y = POOL_Y; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (y < 28 && x >= 21 && x <= 41) continue
        const depth = (y - POOL_Y) * 0.35
        const mirror = x >= 22 && x <= 40 ? 1.6 - depth * 0.5 : 0
        const d = Math.abs(x - 31) / 5 + (y - POOL_Y) * 0.4
        const ring = mod(d - (f / LOOP) * 9, 3) < 0.6 && Math.abs(x - 31) < 30 ? 1.2 : 0
        const sky = y === POOL_Y ? 0.8 : 0
        c.set(x, y, shade(POOL, 2.6 - depth + mirror + ring + sky))
      }
    }

    const bottom = FALLS[2]!
    for (let y = 14; y < 30; y++) {
      for (let x = 2; x < 62; x++) {
        const m = mist(x, y, f)
        const spread = y >= bottom.foot - 1 ? 3 : 0
        const isSpray = m >= 0.6 || (x >= bottom.x0 - spread && x <= bottom.x1 + spread && y >= bottom.lip + 1 && y <= bottom.foot + 1)
        if (!isSpray) continue
        const r = Math.hypot(x - 31, (y - 29) * 1.3)
        const band = Math.floor(14.5 - r)
        const shimmer = s * (0.75 + 0.25 * Math.sin(Math.atan2(y - 29, x - 31) * 5 + (f / LOOP) * Math.PI * 6))
        const haze = m > 0.72 ? MIST[1]! : MIST[0]!
        if (band >= 0 && band < 6 && shimmer > 0.5) c.set(x, y, RAINBOW[band]!)
        else if (band >= 0 && band < 6 && shimmer > 0.4) c.set(x, y, (x + y) % 2 ? RAINBOW[band]! : haze)
        else if (m >= 0.6) c.set(x, y, haze)
      }
    }

    const b = blossom(f)
    if (b) {
      const art = b.isTumbling ? TUMBLE[f % 4] ?? BLOSSOM : BLOSSOM
      c.sprite(Math.round(b.x) - 1, Math.round(b.y) - 1, art, { a: PETAL[3]!, b: PETAL[1]!, c: POLLEN })
      if (!b.isTumbling) c.set(Math.round(b.x) + 1, Math.round(b.y), PETAL[2]!)
    }
    if (f >= 32 && f <= 35) {
      const t = f - 31
      for (const dx of [-3, -2, 2, 3]) c.set(33 + dx * (0.6 + t * 0.3), 25 - (3 - Math.abs(dx)) * 1.2 * (t < 3 ? t : 5 - t), WATER[6]!)
    }

    for (const p of particles(f, LOOP, 18, 7, 4)) {
      const fl = FALLS[p.i % 3]!
      const x = fl.x0 + p.r[1] * (fl.x1 - fl.x0) + (p.r[2] - 0.5) * p.t * 1.4
      const y = fl.foot - 1 - p.t * (1.2 + p.r[3]) + p.t * p.t * 0.18
      if (p.age < 0.85) c.set(x, y, shade(WATER, 5.6))
    }

    for (let x = 0; x < W; x++) {
      const isCleft = x >= top.x0 - 1 && x <= top.x1 + 1
      const hang = Math.round(1.5 + noise(x * 0.35, 0, 0, 11) * 3 - (isCleft ? 2.5 : 0) + (x < 12 || x > 52 ? 2 : 0))
      for (let y = 0; y < hang; y++) c.set(x, y, shade(CANOPY, 1.2 + (y === hang - 1 ? 1.4 : 0) + ray(x, y) * 0.8))
    }

    for (const [vx, len, phase] of [[7, 17, 0], [13, 9, 1.7], [50, 14, 3.1], [57, 20, 4.4]] as const) {
      for (let y = 0; y < len; y++) {
        const t = y / len
        const x = Math.round(vx + Math.sin((f / LOOP) * Math.PI * 4 + phase) * 1.6 * t * t)
        c.set(x, y, shade(LEAF, 2.2))
        c.set(x + 1, y, shade(LEAF, 2.2))
        if (y % 3 === 2) {
          const side = y % 6 === 2 ? 1 : -1
          const lx = side > 0 ? x + 2 : x - 1
          c.set(lx, y, shade(LEAF, 4.4))
          c.set(lx, y + 1, shade(LEAF, 4.4))
          c.set(lx + side, y + 1, shade(LEAF, 3.4))
        }
      }
    }
    leaf(c, 0, 31, 13, 22, 3.4, f, 0)
    leaf(c, 4, 32, 18, 27, 2.6, f, 1.3)
    leaf(c, 63, 31, 49, 24, 3, f, 2.2)
    leaf(c, 63, 0, 51, 6, 2.6, f, 3.4)
    leaf(c, 0, 0, 9, 7, 2.4, f, 4.1)

    out.push(c.copy())
  }

  return out
}

function leaf(c: Canvas, x0: number, y0: number, x1: number, y1: number, width: number, f: number, phase: number): void {
  const ty = y1 + Math.round(Math.sin((f / LOOP) * Math.PI * 2 + phase) * 0.8)
  const len = Math.hypot(x1 - x0, ty - y0)
  const ux = (x1 - x0) / len
  const uy = (ty - y0) / len
  for (let y = Math.floor(Math.min(y0, ty) - width - 1); y <= Math.max(y0, ty) + width + 1; y++) {
    for (let x = Math.floor(Math.min(x0, x1) - width - 1); x <= Math.max(x0, x1) + width + 1; x++) {
      const along = (x - x0) * ux + (y - y0) * uy
      const across = -(x - x0) * uy + (y - y0) * ux
      const t = along / len
      if (t < 0 || t > 1) continue
      const half = width * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 0.3
      if (Math.abs(across) > half) continue
      const isRib = Math.abs(across) < 0.5
      const isEdge = Math.abs(across) > half - 1
      const lit = across * uy < 0 ? 1 : 0
      c.set(x, y, shade(LEAF, isRib ? 4.6 : 2 + lit * 1.2 - (isEdge ? 0.6 : 0) + t * 0.6))
    }
  }
}

export const scene: Scene = { verb: 'Cascading', render, hero: 40 }
