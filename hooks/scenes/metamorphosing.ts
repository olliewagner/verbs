import { Canvas, clamp, ease, hash, hex, lerp, mix, shade, smoothstep, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96
const SET = 76

const SKY = hex('121a32 18223e 1f2b4a 283656 33405f 404a68 524f6c')
const DAWN = hex('6a4a6a 9a5a66 c87462 ec9a64 f8c47a fde6a6')
const BOKEH = hex('3a4a72 4e5e86 6a769c')
const BOKEH_WARM = hex('d8905e f4b870 fcdc96')
const FOLIAGE = hex('080f16 0d1820 13222a 1a2e34')
const TWIG = hex('140e10 241a18 3a2a22 52392c 6e4c36 8a6444')
const LEAF = hex('0c201c 143426 1e4a30 2a643a 3c8044 589c4e 7cb858')
const CHRYS = hex('123426 1c4c36 2a6a4a 3e8a5e 5aaa74 86ca92 c0e8bc')
const GOLD = hex('6a4a14 b08424 f0cc5a fff2b0')
const WING = hex('5a1c08 8a3008 b8480c dc6c18 f2962c fcc052 fff0a0')
const UNDER = hex('6a3c18 945a2a bc803c dca456 f0c87a')
const SHELL = hex('8aa0a4 b4c8c6 dce8e2')
const INK = 0x120e14
const GREY = 0x3a3440
const DOT = 0xf2eee2
const STRIPES = [0xf0cc3c, INK, 0xf2f0e6, INK] as const

const PALETTE_ALL = [SKY, DAWN, BOKEH, BOKEH_WARM, FOLIAGE, TWIG, LEAF, CHRYS, GOLD, WING, UNDER, SHELL, [INK, GREY, DOT], STRIPES].flat()
const snapCache = new Map<number, number>()
function snap(c: number): number {
  const hit = snapCache.get(c)
  if (hit !== undefined) return hit
  let best = c
  let bd = Infinity
  for (const p of PALETTE_ALL) {
    const dr = ((c >> 16) & 255) - ((p >> 16) & 255)
    const dg = ((c >> 8) & 255) - ((p >> 8) & 255)
    const db = (c & 255) - (p & 255)
    const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db
    if (d < bd) {
      bd = d
      best = p
    }
  }
  snapCache.set(c, best)
  return best
}

const ANCHOR_X = 30
const TWIG_Y = 2
const UNDERSIDE = TWIG_Y + 2
const twigY = (x: number) => TWIG_Y + Math.round(Math.sin(x * 0.08 + 0.4) * 0.6)

const days = (f: number) => (f >= 24 && f < 44 ? Math.sin(((f - 24) / 20) * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5 : 0)

function glide(f: number, a: number, b: number, e: number): number {
  const u = f - a
  const T = b - a
  const v = 1 / (T - e)
  if (u <= 0) return 0
  if (u >= T) return 1
  if (u < e) return (v * u * u) / (2 * e)
  if (u > T - e) return 1 - (v * (T - u) ** 2) / (2 * e)
  return v * (u - e / 2)
}

const sunrise = (f: number) => (f >= 52 ? glide(f, 52, 74, 4) - glide(f, SET, LOOP + 12, 5) : 1 - glide(f + LOOP, SET, LOOP + 12, 5))
const BODY_LEN = 15
const N = 31
type P = readonly [number, number]
function jPath(s: number, sway: number): P {
  const r = 2.8
  const drop = 9
  if (s < drop) return [ANCHOR_X + sway * (s / drop) ** 2, UNDERSIDE + 1 + s]
  const th = Math.PI - (s - drop) / r
  return [ANCHOR_X + r + Math.cos(th) * r + sway, UNDERSIDE + 1 + drop + Math.sin(th) * r]
}
function crawlPath(s: number, tailX: number, f: number, gait: number): P {
  const x = tailX + s
  const lift = Math.max(0, Math.sin(s * 0.8 - f * 1.3)) * 1.1 * gait
  return [x, UNDERSIDE + 1.6 + lift]
}
const CRAWL = 44
const PAUSE = 72
const PAUSE_X = 18
const ON = 81
const HANG = 91
const HUNG = 4
const OPEN = 56
const OPENED = 70
const FOLD = 74
const FLY = 77
const DROP = 79
function caterpillar(f: number): P[] | undefined {
  const at = (path: (s: number) => P) => Array.from({ length: N }, (_, i) => path((i / (N - 1)) * BODY_LEN))
  if (f >= HUNG && f < 8) return at(s => jPath(s, 0.7 * Math.sin(f * 0.8)))
  if (f >= CRAWL && f < HANG) {
    const tailX = f < ON ? lerp(-BODY_LEN - 1, PAUSE_X, glide(f, CRAWL, PAUSE, 3)) : lerp(PAUSE_X, ANCHOR_X, glide(f, ON, HANG, 3))
    const gait = smoothstep(CRAWL, CRAWL + 3, f) - smoothstep(PAUSE - 3, PAUSE, f) + smoothstep(ON, ON + 3, f) - smoothstep(HANG - 3, HANG, f)
    return at(s => crawlPath(s, tailX, f, gait))
  }
  if (f >= HANG || f < HUNG) {
    const g = f < HUNG ? f + LOOP : f
    const t = glide(g, HANG, LOOP + HUNG, 2)
    return at(s => {
      const a = crawlPath(s, ANCHOR_X, HANG, 0)
      const b = jPath(s, 0.7 * Math.sin(g * 0.8))
      return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]
    })
  }
  return undefined
}
function nearest(pts: readonly P[], x: number, y: number): [number, number] {
  let best = Infinity
  let at = 0
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i] ?? [0, 0]
    const b = pts[i + 1] ?? a
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const l2 = dx * dx + dy * dy || 1
    const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / l2)
    const d = Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t)
    if (d < best) {
      best = d
      at = ((i + t) / (pts.length - 1)) * BODY_LEN
    }
  }
  return [best, at]
}
const girth = (s: number) => (s < 1.2 ? 1 + s * 0.5 : s > BODY_LEN - 2 ? 1.4 : 1.75)
const stripe = (s: number) => STRIPES[Math.floor(s * 0.8) % 4] ?? INK
function drawCaterpillar(c: Canvas, pts: readonly P[]): void {
  const xs = pts.map(p => p[0])
  const ys = pts.map(p => p[1])
  for (let y = Math.floor(Math.min(...ys) - 2); y <= Math.ceil(Math.max(...ys) + 2); y++) {
    for (let x = Math.floor(Math.min(...xs) - 2); x <= Math.ceil(Math.max(...xs) + 2); x++) {
      const [d, s] = nearest(pts, x, y)
      const r = girth(s)
      if (d > r) continue
      if (s > BODY_LEN - 2) {
        c.set(x, y, d < 0.6 ? GREY : INK)
        continue
      }
      const band = stripe(s)
      c.set(x, y, d > r - 0.7 && band !== INK ? mix(band, SKY[1] ?? 0, 0.4) : band)
    }
  }
  const head = pts[pts.length - 1] ?? [0, 0]
  const neck = pts[pts.length - 5] ?? head
  const tail = pts[1] ?? [0, 0]
  const tail2 = pts[4] ?? tail
  const fx = head[0] + (head[0] - neck[0]) * 0.7
  const fy = head[1] + (head[1] - neck[1]) * 0.7
  c.set(fx + (neck[1] - head[1]) * 0.6, fy - (neck[0] - head[0]) * 0.6, INK)
  c.set(fx - (neck[1] - head[1]) * 0.6, fy + (neck[0] - head[0]) * 0.6, INK)
  c.set(tail[0] + (tail[0] - tail2[0]) * 0.8 + 1, tail[1] + (tail[1] - tail2[1]) * 0.8, INK)
}
const CX = ANCHOR_X + 0.5
const CTOP = UNDERSIDE + 1
const CBOT = CTOP + 13
function chrysalisD(x: number, y: number, wiggle: number): number {
  const t = (y - CTOP) / (CBOT - CTOP)
  if (t < 0 || t > 1) return 9
  const half = 4.3 * Math.sin(Math.PI * Math.min(1, 0.1 + t * 0.95)) ** 0.7
  return Math.abs(x - CX - wiggle * t * t) - half
}
const WING_ART = [
  '..........kkk.',
  '........kkwkwk',
  '......kkoookkk',
  '....kkoooOkwkk',
  '..kkooookOOokk',
  'kkoooookoooOkw',
  'koooookooooOkk',
  'kooookkkkkkkk.',
  'koooookoooOkk.',
  'kooookoooookw.',
  'kooookooooOk..',
  '.koookoooOkkw.',
  '..kkookookkk..',
  '....kkwkkwk...',
]
const HINGE_ROW = 7
function wingPaint(ch: string, isUnder: boolean, glow: number, crumple: number, turn: number): number | undefined {
  if (ch === 'k') return INK
  if (ch === 'w') return isUnder ? (UNDER[4] ?? 0) : DOT
  if (ch !== 'o' && ch !== 'O') return undefined
  const lift = (ch === 'O' ? 1 : 0) + glow * 0.9 - crumple * 1.4 - turn * 2
  return isUnder ? shade(UNDER, 2 + lift) : shade(WING, 3 + lift)
}
function drawWing(c: Canvas, hx: number, hy: number, spread: number, size: number, isUnder: boolean, glow: number): void {
  if (Math.abs(spread) * 14 < 1) {
    for (let y = Math.round(hy - 5 * size); y <= Math.round(hy + 4 * size); y++) c.set(hx + Math.sign(spread || 1), y, isUnder ? (UNDER[1] ?? 0) : (WING[1] ?? 0))
    return
  }
  const sx = spread * size
  const crumple = clamp((1 - size) * 2.5)
  const turn = 1 - clamp(Math.abs(spread) * 3.3)
  for (let y = Math.floor(hy - HINGE_ROW * size - 1); y <= Math.ceil(hy + 7 * size + 1); y++) {
    for (let x = Math.floor(hx - 15); x <= Math.ceil(hx + 15); x++) {
      const v = (y - hy) / size + HINGE_ROW
      const u = (x - hx) / sx + (crumple > 0 ? Math.sin(v * 2.3) * crumple * 1.2 : 0)
      if (u < 0 || u >= 14 || v < 0 || v >= 14) continue
      const ch = WING_ART[Math.floor(v)]?.[Math.floor(u)] ?? '.'
      const paint = wingPaint(ch, isUnder, glow, crumple, turn)
      if (paint !== undefined) c.set(x, y, paint)
    }
  }
}
function drawBody(c: Canvas, x: number, y: number, fat: number): void {
  c.set(x - 1, y - 2, INK)
  c.set(x - 2, y - 3, INK)
  c.set(x - 2, y - 4, GREY)
  c.set(x + 2, y - 2, INK)
  c.set(x + 3, y - 3, INK)
  c.set(x + 3, y - 4, GREY)
  c.rect(x, y - 1, 2, 2, INK)
  c.rect(x, y + 1, 2, 3, INK)
  c.set(x, y + 1, DOT)
  c.set(x + 1, y + 2, GREY)
  const len = 4 + Math.round(fat * 2)
  for (let k = 0; k < len; k++) {
    c.set(x, y + 4 + k, INK)
    if (k < len - 1) c.set(x + 1, y + 4 + k, k % 2 ? GREY : INK)
    if (fat > 0.4 && k > 0 && k < len - 2) c.set(x + 2, y + 4 + k, GREY)
  }
}
function render(): Int32Array[] {
  const out: Int32Array[] = []
  const bokeh = Array.from({ length: 8 }, (_, i) => ({
    x: 3 + hash(i, 1) * 58, y: 8 + hash(i, 2) * 18, r: 1.6 + hash(i, 3) * 2.4, k: hash(i, 4),
  }))
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const sun = sunrise(f)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const g = Math.max(0, 1 - Math.hypot(x - 58, (y - 3) * 1.4) / 34 - (1 - sun) * 0.85)
        const base = 1 + y * 0.17 + days(f) * 2.2
        c.set(x, y, g > 0.18 ? shade(DAWN, (g - 0.18) * 7.5) : shade(SKY, base + g * 4))
      }
    }
    for (const b of bokeh) {
      const warmth = b.x > 24 ? clamp((sun - 0.3 - b.k * 0.4) * 3) : 0
      for (let y = Math.floor(b.y - b.r); y <= Math.ceil(b.y + b.r); y++) {
        for (let x = Math.floor(b.x - b.r); x <= Math.ceil(b.x + b.r); x++) {
          const d = Math.hypot(x - b.x, y - b.y) / b.r
          if (d > 1) continue
          const isWarm = warmth * 1.2 > d
          c.set(x, y, mix(c.get(x, y), shade(isWarm ? BOKEH_WARM : BOKEH, d > 0.7 ? 2 : 1), isWarm ? 0.55 : 0.4))
        }
      }
    }
    const fallen = f - DROP
    const drop = fallen <= 0 ? 0 : fallen <= 5 ? 0.2 * fallen * fallen : 5 + 2 * (fallen - 5)
    if (f >= 44) {
      for (let y = CTOP; y <= CBOT; y++) {
        for (let x = Math.floor(CX - 5); x <= Math.ceil(CX + 5); x++) {
          const d = chrysalisD(x, y, 0)
          if (d > 0) continue
          if (y >= CBOT - 1 && Math.abs(x - CX) < 2.5) continue
          c.set(x, y + drop, mix(c.get(x, y + drop), shade(SHELL, d > -0.9 ? 2 : 0.6), d > -0.9 ? 0.75 : 0.35))
        }
      }
      c.set(ANCHOR_X, CTOP - 1 + drop, INK)
      c.set(Math.round(CX) - 2, CTOP + 4 + drop, GOLD[1] ?? 0)
      c.set(Math.round(CX) + 2, CTOP + 4 + drop, GOLD[1] ?? 0)
    }
    for (let x = 0; x < W; x++) {
      const top = 27 + 2 * Math.sin(x * 0.19 + 1) + 1.4 * Math.sin(x * 0.47)
      for (let y = Math.round(top); y < H; y++) c.set(x, y, shade(FOLIAGE, 3 - (y - top) * 0.6))
    }

    for (let x = 0; x < W; x++) {
      const y = twigY(x)
      c.set(x, y, shade(TWIG, 3.4 + sun * 1.6 + days(f) * 0.8))
      c.set(x, y + 1, shade(TWIG, 1.8 + (x % 7 === 3 ? -0.8 : 0)))
    }
    for (const [lx, len, dir] of [[8, 12, 1], [53, 11, -1]] as const) {
      for (let i = 0; i <= len; i++) {
        const t = i / len
        const w = Math.sin(Math.PI * t ** 0.8) * 2.8
        const cx = lx + i * 0.5 * dir
        const cy = twigY(lx) + 2 + i * 0.9
        for (let dx = -Math.ceil(w); dx <= Math.ceil(w); dx++) {
          if (Math.abs(dx) > w) continue
          const isLit = dx * dir > 0
          c.set(cx + dx, cy, shade(LEAF, (isLit ? 3.4 : 1.8) + (dx === 0 ? 0.9 : 0) + sun * 1.4))
        }
      }
    }
    c.set(ANCHOR_X, UNDERSIDE, 0xe8e4dc)
    const cat = caterpillar(f)
    if (cat) drawCaterpillar(c, cat)

    if (f >= 8 && f < 52) {
      const morph = f < 20 ? ease.inOut((f - 8) / 12) : 1
      const wipe = lerp(CBOT + 3, CTOP - 1, clamp((f - 10) / 10))
      const wiggle = f < 25 ? 1.3 * Math.sin(f * 1.5) * (1 - clamp((f - 19) / 6)) : f >= 40 ? 0.7 * Math.sin(f * 2.6) * (1 - clamp((f - 43) / 3)) : 0
      const j = Array.from({ length: N }, (_, i) => jPath((i / (N - 1)) * BODY_LEN * (1 - morph * 0.3), 0.7 * Math.sin(f * 0.8) * (1 - morph)))
      const empty = CTOP - 1 + Math.max(0, f - 44) * 2
      for (let y = Math.max(CTOP - 1, empty); y <= CBOT + 5; y++) {
        const dark = clamp((f - 28 - (y - CTOP) * 0.5) / 8)
        for (let x = Math.floor(CX - 7); x <= Math.ceil(CX + 8); x++) {
          const [dj, s] = nearest(j, x - wiggle * ((y - CTOP) / 13) ** 2, y)
          const d = lerp(dj - girth(s), chrysalisD(x, y, wiggle), morph)
          if (d > 0) continue
          if (y < wipe + (x - CX) * 0.4) {
            const band = stripe(s)
            c.set(x, y, s > BODY_LEN - 2 && morph < 0.5 ? (dj < 0.6 ? GREY : INK) : d > -0.7 && band !== INK ? mix(band, SKY[1] ?? 0, 0.4) : band)
            continue
          }
          const u = (x - CX - wiggle) / 4.3
          const v = (y - CTOP) / 13
          const lit = 0.7 - u * 0.9 - v * 0.7 + (d > -0.8 ? -0.8 : 0) + (u < -0.2 && u > -0.6 && v > 0.2 && v < 0.6 ? 0.7 : 0)
          let col = shade(CHRYS, 3 + lit * 2.2)
          if (dark > 0) {
            const ch = WING_ART[Math.floor(v * 14)]?.[Math.floor((x - CX + 4) * 1.6)] ?? '.'
            const inner = ch === 'k' ? INK : ch === '.' ? 0x1c2a2a : (WING[2] ?? 0)
            col = mix(col, inner, dark * 0.85)
          }
          if (f >= 42 && y > CBOT - 3 - (f - 42) && Math.abs(x - CX - wiggle) < 1) col = INK
          c.set(x, y, col)
        }
      }
      if (morph > 0.9) {
        const gy = CTOP + 4
        if (gy >= empty) {
          for (let x = Math.round(CX - 2); x <= Math.round(CX + 2); x++) c.set(x, gy, GOLD[2] ?? 0)
          c.set(Math.round(CX) - 3, gy + 1, GOLD[1] ?? 0)
          c.set(Math.round(CX) + 3, gy + 1, GOLD[1] ?? 0)
        }
        for (const [dx, dy] of [[-2, 10], [1, 11], [2, 9]] as const) if (CTOP + dy >= empty) c.set(Math.round(CX) + dx, CTOP + dy, GOLD[1] ?? 0)
        const glint = f - 26
        if (glint >= 0 && glint < 3) {
          c.set(Math.round(CX) + 1, gy, GOLD[3] ?? 0)
          if (glint === 1) {
            c.set(Math.round(CX) + 1, gy - 1, GOLD[3] ?? 0)
            c.set(Math.round(CX) + 1, gy + 1, GOLD[3] ?? 0)
            c.set(Math.round(CX), gy, GOLD[3] ?? 0)
            c.set(Math.round(CX) + 2, gy, GOLD[3] ?? 0)
          }
        }
      }
      c.set(ANCHOR_X, CTOP - 1, INK)
      if (f >= 19 && f < 40) {
        const t = Math.max(0, f - 22)
        const fall = t <= 5 ? 0.2 * t * t : 5 + 2 * (t - 5)
        const sx = ANCHOR_X + 1 + (f >= 22 ? (f - 22) * 0.3 : 0)
        const sy = CTOP + fall
        c.set(sx, sy, INK)
        c.set(sx + 1, sy, 0xb08a2a)
        c.set(sx, sy + 1, 0x8a7a50)
        c.set(sx + 1, sy + 1, INK)
        c.set(sx - 1, sy + 1, 0xb08a2a)
      }
    }
    if (f >= 44 && f < LOOP) {
      const hangY = CBOT + 1
      let bx = ANCHOR_X
      let by = hangY
      let size = 1
      let right = 0.5
      let left = 0.5
      let fat = 0
      if (f < OPEN) {
        const t = (f - 44) / 16
        const pump = Math.max(0, Math.sin(t * Math.PI * 5)) * 0.05 * (1 - t)
        size = lerp(0.4, 1, ease.inOut(clamp(t * 1.15))) + pump
        fat = 1 - ease.out(clamp(t))
        if (f < 47) by = hangY - (47 - f) * 2
      } else if (f < FOLD) {
        const t = glide(f, OPEN, OPENED, 3)
        right = lerp(0.5, 1, t)
        left = lerp(0.5, -1, t)
      } else {
        const t = glide(f, FLY, LOOP - 1, 3)
        bx = Math.round(ANCHOR_X + t * 8)
        by = Math.round(hangY - t * 29)
        const flutter = 0.08 * Math.sin(((f - FOLD - 7) / 8) * Math.PI * 2) * smoothstep(FOLD + 5, FOLD + 9, f)
        right = lerp(1, 0.35, smoothstep(FOLD, FOLD + 7, f)) + flutter
        left = -right
      }
      const across = clamp((0.4 - left) / 0.4)
      const glow = sun * lerp(0.3, 1, across)
      drawWing(c, bx + 2, by + 2, right * lerp(0.9, 1, across), size, false, glow * lerp(0.5, 1, across))
      drawWing(c, Math.round(lerp(bx + 2, bx - 1, across)), by + 2, left, size, left > 0, glow)
      drawBody(c, bx, by, fat)
    }
    for (let i = 0; i < c.px.length; i++) c.px[i] = snap(c.px[i] ?? 0)
    out.push(c.px)
  }
  return out
}

export const scene: Scene = { verb: 'Metamorphosing', render, hero: 74 }