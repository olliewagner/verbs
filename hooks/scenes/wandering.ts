import { Canvas, TAU, beat, clamp, ease, hash, hex, mix, mod, shade, smoothstep, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96
const TRAVEL = 64
const STRIDE = TRAVEL / 5

const SKY = hex('070a16 0b1020 10172b 161f37 1d2843 253250 2f3d5c 3a4a68 485875')
const TRUNK = hex('06070d 0b0d16 121420 1c1b28 2c252c 44332f 634634 8b6239 b98747')
const GROUND = hex('07090e 0d1017 141720 1e1f27 2c2a2d 403732 5a4a38 7d653f b08b4c')
const CLOAK = hex('0b0910 160f17 24141d 361a22 4e2327 6c3029 924428 b9602f')
const HAT = hex('0a090e 141219 201b22 30272b 453630 61493a 86643f')
const SKIN = hex('2b1c20 4e2f2c 7a4a38 a96a45 d6955c f0bf7a')
const PACK = hex('0a0d0e 121815 1c2420 2a3328 3d452f 59593a')
const IRON = hex('121117 23212a 3a3640 5f5860 948a85')
const FLAME = hex('c4602a f3a23f ffd46e fff3c4')
const FLY = hex('2c4227 557a30 9cc944 e4ff9c')
const MOON = hex('7d8ea3 a3b2bd c6d0cf dde3dc')
const RIM = hex('2c3650 46546e 66768e')
const MIST = 0x5a6c80
const GLOW = 0xf0a24a
const EYE = hex('3a2a12 c88a1e ffd050')

function speed(t: number): number {
  if (t < 28) return 1
  if (t < 36) return 1 - smoothstep(28, 36, t)
  if (t < 60) return 0
  if (t < 68) return smoothstep(60, 68, t)
  return 1
}

const DIST: number[] = (() => {
  const d = [0]
  for (let f = 0; f < LOOP; f++) d.push((d[f] ?? 0) + speed(f + 0.5))
  const k = TRAVEL / (d[LOOP] ?? 1)
  return d.map(v => v * k)
})()

const raise = (f: number) => smoothstep(36, 44, f) - smoothstep(54, 62, f)
const isLookingBack = (f: number) => f >= 46 && f < 53
const gather = (f: number) => smoothstep(38, 50, f) - smoothstep(56, 70, f)

const MOON_X = 17
const MOON_Y = 5
function skyLevel(x: number, y: number): number {
  const d = Math.hypot(x - MOON_X, (y - MOON_Y) * 1.1)
  const halo = d < 6 ? 1.4 : d < 9.5 ? 0.8 : d < 14 ? 0.35 : 0

  return 0.4 + 7.2 * smoothstep(-2, 25, y) ** 1.25 + halo
}

const slide = (f: number, factor: number) => (DIST[f] ?? 0) * factor

type Pine = { x: number; top: number; half: number }
const FAR: Pine[] = [{ x: 3, top: 10, half: 3 }, { x: 10, top: 13, half: 2.5 }, { x: 18, top: 8, half: 3.4 }, { x: 26, top: 12, half: 2.8 }]
const MID: Pine[] = [{ x: 4, top: 5, half: 5 }, { x: 17, top: 9, half: 4 }, { x: 30, top: 3, half: 5.5 }, { x: 40, top: 10, half: 4.2 }]

function inPine(p: Pine, cx: number, x: number, y: number): boolean {
  const t = y - p.top
  if (t < 0) return false
  const half = Math.min(p.half, 0.28 * t + (t % 3) * 0.5)
  return Math.abs(x - cx) <= half
}

type Trunk = { x: number; w: number }
const TRUNKS: Trunk[] = [{ x: 12, w: 4 }, { x: 27, w: 2 }, { x: 43, w: 3 }]
const OWL = { x: 8, y: 6 }

type Fern = { x: number; h: number }
const FERNS: Fern[] = [{ x: 6, h: 4 }, { x: 29, h: 3 }, { x: 47, h: 5 }]

const BODY = [
  '....ttt...',
  '....ttt...',
  '..bbbbbbb.',
  '....hff...',
  '...pccc...',
  '..ppcccc..',
  '..ppcccc..',
  '..ppcccc..',
  '...ccccc..',
  '...cccccc.',
  '..ccccccc.',
]
const BACK_FACE = '....ffh...'
const CX = 25
const FEET_Y = 27

type Part = 't' | 'b' | 'h' | 'f' | 'c' | 'p' | 'leg' | 'boot' | 'arm' | 'hand'

function swing(f: number, phase: number, amp: number): number {
  let s = 0.8 * amp * Math.sin(TAU * (phase - 0.2))
  if (f >= 29 && f < 47) s += 1.5 * Math.sin((f - 29) * 0.6) * Math.exp(-(f - 29) / 6)
  if (f >= 60 && f < 78) s -= 1.3 * Math.sin((f - 60) * 0.6) * Math.exp(-(f - 60) / 6)
  return Math.round(clamp(s, -1, 1))
}

function render(): Int32Array[] {
  const out: Int32Array[] = []

  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const amp = speed(f)
    const phase = (DIST[f] ?? 0) / STRIDE
    const bob = amp > 0.5 && Math.abs(Math.sin(TAU * phase)) < 0.5 ? 1 : 0
    const r = raise(f)

    const handX = Math.round(CX + 4 + 2 * r)
    const handY = Math.round(20 - bob + (8 - 20) * r)
    const sx = swing(f, phase, amp)
    const capX = handX + sx
    const capY = handY + 2
    const lx = capX
    const ly = capY + 1.5
    const power = 1 + 0.35 * r
    const reach = 17 + 8 * r
    const lit = (x: number, y: number) => power * Math.max(0, 1 - Math.hypot(x - lx, (y - ly) * 1.1) / reach) ** 1.5

    c.fill((x, y) => shade(SKY, skyLevel(x, y), x, y))
    c.disc(MOON_X, MOON_Y, 2.6, (x, y) => shade(MOON, 2.2 - (x - MOON_X + y - MOON_Y) * 0.4, x, y))

    const far = slide(f, 0.5)
    const mid = slide(f, 0.75)
    for (let y = 0; y < 26; y++) {
      for (let x = 0; x < W; x++) {
        const fx = mod(x + far, 32)
        if (FAR.some(p => inPine(p, p.x, fx, y) || inPine(p, p.x + 32, fx, y) || inPine(p, p.x - 32, fx, y))) {
          c.set(x, y, shade(SKY, skyLevel(x, y) - 1.8 + 1.2 * smoothstep(15, 25, y), x, y))
        }
        const mx = mod(x + mid, 48)
        if (MID.some(p => inPine(p, p.x, mx, y) || inPine(p, p.x + 48, mx, y) || inPine(p, p.x - 48, mx, y))) {
          c.set(x, y, shade(SKY, skyLevel(x, y) - 3.8 + 2.4 * smoothstep(13, 25, y), x, y))
        }
      }
    }

    const near = slide(f, 1)
    for (let y = 24; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const wx = mod(x + near, 64)
        const top = 25.6 + 0.6 * Math.sin((TAU * wx) / 32) + 0.4 * Math.sin((TAU * wx * 3) / 64 + 1)
        const bottom = 29.6 + 0.5 * Math.sin((TAU * wx * 2) / 64 + 2)
        const isPath = y >= top && y <= bottom
        const pebble = isPath && hash(Math.floor(wx / 2), y, 7) < 0.04 ? 1.2 : 0
        const base = isPath ? 2.2 + pebble : y < top ? 1.2 : 1
        c.set(x, y, shade(GROUND, base + lit(x, y) * (isPath ? 6.5 : 3.5), x, y))
      }
    }

    for (const t of TRUNKS) {
      for (const k of [-64, 0, 64]) {
        const x0 = Math.round(t.x - near + k)
        if (x0 + t.w + 2 < 0 || x0 - 2 >= W) continue
        for (let y = 0; y < 27; y++) {
          const flare = y >= 24 ? 1 : 0
          const right = clamp((lx - (x0 + t.w / 2)) / 3 + 0.5)
          for (let x = x0 - flare; x < x0 + t.w + flare; x++) {
            const side = x === x0 + t.w - 1 + flare ? right : x === x0 - flare ? 1 - right : -1
            const l = lit(x, y)
            const edge = side < 0 ? 0 : side * (0.6 + l * 4) - (1 - side) * 0.6
            c.set(x, y, shade(TRUNK, 1.4 + l * 7 + edge, x, y))
          }
        }
        if (t.w === 4) {
          const bx = x0 - 4
          for (let x = bx; x < x0; x++) c.set(x, OWL.y + 4, shade(TRUNK, 1.6 + lit(x, OWL.y + 4) * 7 + (x === bx ? 0 : 0.4), x, OWL.y + 4))
          drawOwl(c, x0 - 4, OWL.y, f, lit)
        }
      }
    }

    for (let y = 17; y < 28; y++) {
      for (let x = 0; x < W; x++) {
        const wx = x + slide(f, 0.9)
        const band = smoothstep(17, 23, y) * (1 - smoothstep(25.5, 28, y))
        const d = band * (0.55 + 0.25 * Math.sin((TAU * wx) / 32 + (TAU * f) / LOOP) + 0.2 * Math.sin((TAU * wx * 3) / 64 - (TAU * 2 * f) / LOOP))
        const q = d > 0.62 ? 0.32 : d > 0.38 ? 0.2 : d > 0.18 ? 0.1 : 0
        if (q > 0) c.tint(x, y, MIST, q)
      }
    }

    const shadowLen = 5 - 3 * r
    for (let x = Math.floor(CX - 1 - shadowLen * 2); x <= CX + 1; x++) {
      for (const y of [27, 28]) {
        const along = (CX + 1 - x) / (shadowLen * 2 + 2)
        if (y === 28 && along > 0.6) continue
        if (along <= 1) c.set(x, y, mix(c.get(x, y), GROUND[1] ?? 0, 0.75 - along * 0.35))
      }
    }

    const parts = new Map<number, Part>()
    const put = (x: number, y: number, p: Part) => {
      if (x >= 0 && x < W && y >= 0 && y < H) parts.set(y * W + x, p)
    }
    const legs = [
      { hip: CX - 1, off: -3.2 * amp * Math.sin(TAU * phase), lift: Math.cos(TAU * phase) < -0.4 ? 1 : 0 },
      { hip: CX, off: 3.2 * amp * Math.sin(TAU * phase), lift: Math.cos(TAU * phase) > 0.4 ? 1 : 0 },
    ]
    for (const leg of legs) {
      const fx = Math.round(leg.hip + leg.off)
      const fy = FEET_Y - (amp > 0.3 ? leg.lift : 0)
      const steps = 4
      for (let k = 0; k < steps; k++) {
        const t = k / (steps - 1)
        put(Math.round(leg.hip + (fx - leg.hip) * t * t), 23 - bob + Math.round((fy - 1 - (23 - bob)) * t), 'leg')
      }
      put(fx, fy, 'boot')
      put(fx + 1, fy, 'boot')
    }
    const top = 12 - bob
    BODY.forEach((row, j) => {
      const art = j === 3 && isLookingBack(f) ? BACK_FACE : row
      for (let i = 0; i < art.length; i++) {
        const ch = art[i] ?? '.'
        if (ch !== '.') put(CX - 5 + i, top + j, ch as Part)
      }
    })
    if (amp > 0.5) put(CX - 4, top + 10, 'c')
    const shoulderX = CX + 2
    const shoulderY = 17 - bob
    const armLen = Math.max(Math.abs(handX - shoulderX), Math.abs(handY - shoulderY))
    for (let k = 0; k < armLen; k++) {
      const t = k / armLen
      put(Math.round(shoulderX + (handX - shoulderX) * t), Math.round(shoulderY + (handY - shoulderY) * t), 'arm')
    }
    put(handX, handY, 'hand')

    for (const [key, part] of parts) {
      const x = key % W
      const y = Math.floor(key / W)
      const l = lit(x, y)
      const facing = parts.has(key + (lx > x ? 1 : -1)) ? 0 : 1
      const under = part === 'b' && ly > y ? 1 : 0
      const [ramp, base] =
        part === 't' ? [HAT, 2] : part === 'b' ? [HAT, 2.2 + under * 0.8] : part === 'h' ? [HAT, 1.4]
          : part === 'f' ? [SKIN, 1.4] : part === 'hand' ? [SKIN, 1.8] : part === 'p' ? [PACK, 2]
            : part === 'leg' ? [HAT, 1.2] : part === 'boot' ? [HAT, 0.8] : [CLOAK, 2]
      const level = base + l * 5 + facing * l * 3.5
      const isTop = (part === 't' || (part === 'b' && x < CX)) && !parts.has(key - W)
      const isBack = (part === 't' || part === 'p' || part === 'c' || part === 'h') && !parts.has(key - 1)
      const isRim = l < 0.35 && (isTop || isBack)
      c.set(x, y, isRim ? (RIM[isTop ? 2 : 1] ?? 0) : shade(ramp, level, x, y))
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = Math.hypot(x - lx, (y - ly) * 1.1)
        const q = d < 3.5 ? 0.24 : d < 5.5 + r ? 0.1 : 0
        if (q > 0 && !parts.has(y * W + x)) c.tint(x, y, GLOW, q * power)
      }
    }

    c.line(handX, handY + 1, capX, capY - 1, IRON[2] ?? 0)
    c.set(capX, capY, IRON[3] ?? 0)
    c.set(capX, capY + 3, IRON[2] ?? 0)
    for (const dy of [1, 2]) {
      c.set(capX - 1, capY + dy, FLAME[1] ?? 0)
      c.set(capX + 1, capY + dy, FLAME[dy === 1 ? 2 : 1] ?? 0)
      c.set(capX, capY + dy, FLAME[dy === 1 ? 3 : 2] ?? 0)
    }

    for (let i = 0; i < 11; i++) {
      const g = i < 7 ? gather(f) : 0
      const wx = hash(i, 1) * 64
      const wy = 7 + hash(i, 2) * 17
      const a = 1 + (i % 2)
      const wanderX = mod(wx + 2.5 * Math.sin(TAU * ((f / LOOP) * a + hash(i, 3))) - near, 64)
      const wanderY = wy + 2 * Math.sin(TAU * ((f / LOOP) * (3 - a) + hash(i, 4)))
      const angle = TAU * (i / 7 + (f / LOOP) * 2)
      const rad = 5.5 + (i % 3) * 1.6
      const ox = lx + Math.cos(angle) * rad
      const oy = ly + Math.sin(angle) * rad * 0.6
      const fx = Math.round(wanderX + (ox - wanderX) * g)
      const fy = Math.round(wanderY + (oy - wanderY) * g)
      const blink = Math.sin(TAU * ((f / LOOP) * (3 + (i % 3)) + hash(i, 5)))
      const level = g > 0.5 ? (blink > -0.3 ? 3 : 2) : blink > 0.55 ? 3 : blink > 0.35 ? 2.3 : blink > 0.1 ? 1.6 : -1
      if (level < 0) continue
      if (level >= 3 && g < 0.5) {
        const arms = blink > 0.75 ? [[1, 0], [-1, 0], [0, 1], [0, -1]] as const : [[1, 0], [-1, 0]] as const
        for (const [dx, dy] of arms) c.tint(fx + dx, fy + dy, FLY[2] ?? 0, 0.3)
      }
      c.set(fx, fy, shade(FLY, level, fx, fy))
    }

    const fore = f === 31 ? 62 : f > 31 && f < 64 ? 63 : f === 64 ? 64 : Math.round(slide(f, 2) - 0.2)
    for (const fern of FERNS) {
      for (const k of [-64, 0, 64]) {
        const bx = Math.round(fern.x - fore + k)
        if (bx < -8 || bx > W + 8) continue
        for (const [b, dh, lean] of [[-2, -1, -2], [-1, 1, -0.6], [0, 0, 1], [1, -1, 2.4], [2, -2, 3]] as const) {
          const h = fern.h + dh
          for (let s = 0; s <= h; s++) {
            const x = bx + b + Math.round(lean * (s / h) ** 1.6)
            const y = H - 1 - s
            c.set(x, y, shade(TRUNK, 0.2 + (s >= h - 1 ? lit(x, y) * 4.5 : lit(x, y) * 1.2), x, y))
          }
        }
      }
    }

    quantize(c.px)
    out.push(c.px)
  }

  return out
}

const COLOURS = [...SKY, ...TRUNK, ...GROUND, ...CLOAK, ...HAT, ...SKIN, ...PACK, ...IRON, ...FLAME, ...FLY, ...MOON, ...RIM, ...EYE,
  ...SKY.slice(2, 8).map(k => mix(k, GLOW, 0.2))]
const NEAREST = new Map<number, number>()
function quantize(px: Int32Array): void {
  for (let i = 0; i < px.length; i++) {
    const c = px[i] ?? 0
    let best = NEAREST.get(c)
    if (best === undefined) {
      let bestD = Infinity
      for (const k of COLOURS) {
        const d = 2 * (((c >> 16) & 255) - ((k >> 16) & 255)) ** 2 + 4 * (((c >> 8) & 255) - ((k >> 8) & 255)) ** 2 + 3 * ((c & 255) - (k & 255)) ** 2
        if (d < bestD) {
          bestD = d
          best = k
        }
      }
      NEAREST.set(c, best ?? c)
    }
    px[i] = best ?? c
  }
}

function drawOwl(c: Canvas, x: number, y: number, f: number, lit: (x: number, y: number) => number): void {
  const isOpen = f >= 47 && f < 54 && f !== 50
  const art = ['o.o', 'eoe', 'ooo', 'ooo']
  art.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i]
      if (ch === '.') continue
      const px = x + i
      const py = y + j
      const l = lit(px, py)
      if (ch === 'e' && isOpen) c.set(px, py, EYE[l > 0.25 ? 2 : 1] ?? 0)
      else c.set(px, py, shade(TRUNK, 2 + l * 5 + (i === 2 ? l * 2 : 0) - (j === 3 ? 0.5 : 0), px, py))
    }
  })
}

export const scene: Scene = { verb: 'Wandering', render, hero: 49 }
