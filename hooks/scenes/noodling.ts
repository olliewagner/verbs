import { Canvas, beat, clamp, ease, hash, hex, lerp, mix, mod, particles, shade, smoothstep, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 60

const WALL = hex('09061a 0f0b24 161030 1f163e 2a1d4c 38265c')
const NOREN = hex('080a1e 10153a 1a2252 263266')
const COUNTER = hex('120810 1e0e16 2e161c 432024 5a2c2a 743c30 8e5038')
const CERAMIC = hex('1e1a34 3a3656 605c80 908eae c0bdd2 e6e0e4 fffaf0')
const INDIGO = hex('0e1442 1a2878 2c44a4')
const BROTH = hex('4a2412 6c3818 905224 b47236 d29650 e8ba74 f6d8a2')
const NOODLE = hex('5c3c18 8a6230 b68a44 d8b460 eed484 fdf0c0')
const YOLK = hex('6e2406 b04c0c e27c18 f6ac3c ffd676')
const NORI = hex('060a0c 0d1618 15241f 20362c 32503e')
const PORK = hex('4a2020 723434 98524a bc7666 d8a08a')
const ONION = hex('16381a 2c6424 529a32 94d058')
const PINK = hex('3a0a32 781654 c22a80 f45cb4 ff9cd8 ffe4f6')
const CYAN = hex('06283e 0a5474 1694b6 46d0ea a8f2ff')
const LANTERN = hex('2a060a 561014 8e1c1c c43220 ea5c28 fa9440 ffca7e fff0c8')
const STEAM = hex('2a2244 463a62 6a5e86 978bae c3bad6')
const STICK = hex('2a1810 523220 82542e b07c46 d6a86e f0d0a0')

const BX = 31
const RIM_Y = 20
const RIM_RX = 15
const RIM_RY = 3.5
const SOUP_Y = 20.8
const SOUP_RX = 13
const SOUP_RY = 2.7

const inSoup = (x: number, y: number) => ((x - BX) / SOUP_RX) ** 2 + ((y - SOUP_Y) / SOUP_RY) ** 2 <= 1
const rimE = (x: number, y: number) => ((x - BX) / RIM_RX) ** 2 + ((y - RIM_Y) / RIM_RY) ** 2
const bodyHalf = (y: number) => (y > 31 ? 0 : y > 30 ? 5 : RIM_RX * Math.sqrt(Math.max(0, 1 - ((y - RIM_Y) / 11) ** 2)))

const warm = (x: number, y: number) => Math.max(0, 1 - Math.hypot(x - 55, (y - 8) * 1.1) / 44) ** 1.3
const pink = (x: number, y: number) => Math.max(0, 1 - Math.hypot(x - 10, (y - 9) * 1.1) / 34) ** 1.5
const glaze = (color: number, x: number, y: number, k = 1) => mix(color, PINK[2] ?? 0, Math.min(2, Math.round(pink(x, y) * k * 2.6)) * 0.2)

const SHAKE = [0, -1, -2, -2, -1, 0, 1, 1, 0]

function tipAt(f: number): [number, number] {
  const p = mod(f, LOOP)
  if (p < 8) return [BX + Math.round(Math.sin((p / 8) * Math.PI * 2) * 1.2), 21.5]
  if (p < 11) return [BX, 21.5 + ease.out(beat(p, 8, 11))]
  if (p < 27) {
    const t = smoothstep(0, 1, beat(p, 11, 27))
    return [BX - Math.sin(t * Math.PI) * 4 - t, lerp(22.5, 4.5, t)]
  }
  if (p < 42) return [BX - 1, 4.5 + (SHAKE[p - 31] ?? 0)]
  if (p < 56) {
    const t = smoothstep(0, 1, beat(p, 42, 56))
    return [BX - 1 + t, lerp(4.5, 21.5, t)]
  }
  return [BX, 21.5]
}

type Strand = { n: number; ox: number; level: number; x: number[]; y: number[]; px: number[]; py: number[] }
type Drop = { x: number; y: number; vy: number; strand: number }
type Ring = { x: number; y: number; age: number }
type Frame = { strands: [number, number][][]; drops: Drop[]; rings: Ring[] }

function simulate(): Frame[] {
  const specs = [
    { n: 25, ox: -2, level: 2.4 },
    { n: 29, ox: -1, level: 3.4 },
    { n: 12, ox: -0.5, level: 2.9 },
    { n: 27, ox: 1, level: 3.8 },
    { n: 9, ox: 2, level: 3.2 },
    { n: 24, ox: 0, level: 4.3 },
    { n: 14, ox: 1.5, level: 4 },
  ]
  const [tx0, ty0] = tipAt(0)
  const strands: Strand[] = specs.map(s => {
    const x = Array.from({ length: s.n }, () => tx0 + s.ox)
    const y = Array.from({ length: s.n }, (_, i) => Math.min(23, ty0 + i))
    return { ...s, x, y, px: [...x], py: [...y] }
  })
  const drops: Drop[] = []
  const rings: Ring[] = []
  const out: Frame[] = []
  for (let f = -LOOP; f < LOOP; f++) {
    const [tx, ty] = tipAt(f)
    for (const [k, s] of strands.entries()) {
      const home = BX + (k - 3) * 2.6
      for (let i = 1; i < s.n; i++) {
        const isWet = (s.y[i] ?? 0) > 18.6
        const keep = isWet ? 0.35 : 0.9
        const x = s.x[i] ?? 0
        const y = s.y[i] ?? 0
        s.x[i] = x + (x - (s.px[i] ?? 0)) * keep + (isWet ? (home - x) * 0.06 : 0)
        s.y[i] = y + (y - (s.py[i] ?? 0)) * keep + (isWet ? 0.08 : 0.32)
        s.px[i] = x
        s.py[i] = y
      }
      for (let k = 0; k < 10; k++) {
        s.x[0] = tx + s.ox * (s.n > 20 ? 0.8 : 0.5)
        s.y[0] = ty + 0.5
        for (let i = 1; i < s.n; i++) {
          const dx = (s.x[i] ?? 0) - (s.x[i - 1] ?? 0)
          const dy = (s.y[i] ?? 0) - (s.y[i - 1] ?? 0)
          const d = Math.max(0.001, Math.hypot(dx, dy))
          const push = (d - 1) / d
          if (i > 1) {
            s.x[i - 1] = (s.x[i - 1] ?? 0) + dx * push * 0.5
            s.y[i - 1] = (s.y[i - 1] ?? 0) + dy * push * 0.5
            s.x[i] = (s.x[i] ?? 0) - dx * push * 0.5
            s.y[i] = (s.y[i] ?? 0) - dy * push * 0.5
          } else {
            s.x[i] = (s.x[i] ?? 0) - dx * push
            s.y[i] = (s.y[i] ?? 0) - dy * push
          }
          if ((s.y[i] ?? 0) > 23) s.y[i] = 23
          s.x[i] = clamp(s.x[i] ?? 0, BX - 11, BX + 11)
        }
      }
    }
    const p = mod(f, LOOP)
    strands.forEach((s, k) => {
      const ex = s.x[s.n - 1] ?? 0
      const ey = s.y[s.n - 1] ?? 0
      const isShaken = p >= 31 && p < 38
      if (ey < 18 && (p % (isShaken ? 2 : 6)) === k % 2 + (isShaken ? 0 : k)) drops.push({ x: Math.round(ex), y: ey + 1, vy: 0.4, strand: k })
    })
    for (const d of drops) {
      d.y += d.vy
      d.vy += 0.35
      if (inSoup(d.x, d.y) && d.vy > 0) {
        rings.push({ x: d.x, y: Math.max(d.y, 19), age: 0 })
        d.y = 99
      }
    }
    for (const r of rings) r.age++
    if (f >= 0) {
      out.push({
        strands: strands.map(s => s.x.map((x, i) => [x, s.y[i] ?? 0] as [number, number])),
        drops: drops.filter(d => d.y < 40).map(d => ({ ...d })),
        rings: rings.filter(r => r.age <= 5).map(r => ({ ...r })),
      })
    }
    for (let i = drops.length - 1; i >= 0; i--) if ((drops[i]?.y ?? 0) > 40) drops.splice(i, 1)
    for (let i = rings.length - 1; i >= 0; i--) if ((rings[i]?.age ?? 0) > 5) rings.splice(i, 1)
  }
  return out
}
const STRAND_LEVELS = [2.4, 3.4, 2.9, 3.8, 3.2, 4.3, 4]
function drawBackdrop(c: Canvas, f: number, isCyanOn: boolean): void {

  for (let y = 0; y < 18; y++) {
    for (let x = 0; x < W; x++) {
      const isSeam = x % 7 === 3
      const level = 1 + warm(x, y) * 3.2 + pink(x, y) * 1.4 - (isSeam ? 0.8 : 0) - (y === 17 ? 0.6 : 0)
      const isWarm = warm(x, y) > 0.32
      c.set(x, y, glaze(isWarm ? mix(shade(WALL, level), LANTERN[2] ?? 0, 0.4) : shade(WALL, level), x, y))
    }
  }
  for (let x = 0; x < W; x++) {
    const panel = Math.floor((x + 3) / 13)
    const isSlit = (x + 3) % 13 === 0
    const hem = 2 + Math.round(wave(f, LOOP, 1, panel * 0.23) * 0.6 + 0.2)
    for (let y = 0; y <= hem; y++) {
      if (isSlit && y > 0) continue
      const level = 1.6 + warm(x, y) * 2 + pink(x, y) * 0.6 - (y === hem ? 0.7 : 0) + (y === 0 ? 0.6 : 0)
      c.set(x, y, shade(NOREN, level))
    }
  }
  const tubes: [number, number, boolean][] = []
  for (let x = 4; x <= 16; x++) tubes.push([x, 9, false])
  for (let a = 0.15; a < Math.PI - 0.1; a += 0.08) tubes.push([Math.round(10 + Math.cos(a) * 6), Math.round(9 + Math.sin(a) * 4), false])
  for (const sx of [7, 10, 13]) {
    for (let y = 3; y <= 7; y++) tubes.push([sx + (y % 4 < 2 ? 0 : 1), y, true])
  }
  const near = new Map<number, [number, boolean]>()
  for (const [x, y, isCyan] of tubes) {
    if (isCyan && !isCyanOn) continue
    for (let j = -2; j <= 2; j++) {
      for (let i = -2; i <= 2; i++) {
        const d = Math.abs(i) + Math.abs(j)
        if (d > 2) continue
        const key = (y + j) * W + x + i
        if ((near.get(key)?.[0] ?? 9) > d) near.set(key, [d, isCyan])
      }
    }
  }
  for (const [key, [d, isCyan]] of near) {
    const x = key % W
    const y = Math.floor(key / W)
    const hue = (isCyan ? CYAN : PINK)[1] ?? 0
    c.set(x, y, d <= 1 ? hue : mix(WALL[3] ?? 0, hue, 0.55))
  }
  for (const [x, y, isCyan] of tubes) {
    const ramp = isCyan ? CYAN : PINK
    c.set(x, y, isCyan && !isCyanOn ? (CYAN[1] ?? 0) : (ramp[4] ?? 0))
  }
  const glow = 0.5 + 0.5 * wave(f, LOOP, 3)
  for (let y = 1; y <= 15; y++) {
    for (let x = 49; x <= 61; x++) {
      const nx = (x - 55) / 5.5
      const ny = (y - 8.5) / 6
      const e = nx * nx + ny * ny
      if (e > 1) continue
      if (y <= 2 || y >= 15) {
        if (Math.abs(x - 55) <= 3) c.set(x, y, shade(STICK, y === 2 || y === 15 ? 1.6 : 0.6))
        continue
      }
      const isRib = y % 3 === 0
      const core = 1 - e
      c.set(x, y, shade(LANTERN, 2 + Math.round(core * 3) * 1.5 + glow * 0.4 - (isRib ? 1.1 : 0)))
    }
  }
  c.line(55, 0, 55, 1, shade(STICK, 1))
  c.set(55, 16, LANTERN[3] ?? 0)
  c.set(55, 17, LANTERN[2] ?? 0)
  for (let y = 18; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const level = 2.4 + warm(x, y) * 2.6 + pink(x, y) * 1.2 - (y - 18) * 0.09 + (y === 18 ? 1 : 0)
      let color = glaze(shade(COUNTER, level), x, y, 0.8)
      const lr = ((x - 55) / 2.6) ** 2 + ((y - 22.5) / 4) ** 2
      if (lr <= 1) color = mix(color, LANTERN[4] ?? 0, lr < 0.35 && y % 2 === 1 ? 0.6 : 0.35)
      const pr = ((x - 10) / 6.5) ** 2 + ((y - 19.6) / 1.4) ** 2
      if (pr <= 1) color = mix(color, PINK[3] ?? 0, pr < 0.4 ? 0.5 : 0.28)
      c.set(x, y, color)
    }
  }
  c.ellipse(BX, 31, 9.5, 1.6, (x, y) => mix(c.get(x, y), 0x07040a, 0.5))
}
function drawBowlBack(c: Canvas, f: number, rings: Ring[]): void {
  for (let y = 15; y <= 24; y++) {
    for (let x = BX - RIM_RX - 1; x <= BX + RIM_RX + 1; x++) {
      const e = rimE(x, y)
      if (e > 1) continue
      if (e > 0.8) {
        if (y > RIM_Y) continue
        c.set(x, y, glaze(shade(CERAMIC, 4 + warm(x, y) * 2.4 + (x > BX ? 0.4 : 0)), x, y))
        continue
      }
      if (!inSoup(x, y)) {
        c.set(x, y, glaze(shade(CERAMIC, 2.2 + warm(x, y) * 1.6 + (x > BX + 6 ? 0.6 : 0)), x, y, 0.7))
        continue
      }
      const s = ((x - BX) / SOUP_RX) ** 2 + ((y - SOUP_Y) / SOUP_RY) ** 2
      const fat = hash(Math.floor(x / 3), y, 7) > 0.93 && x % 3 !== 2 ? 1.2 : 0
      c.set(x, y, shade(BROTH, 3 + warm(x, y) * 1.6 - (s > 0.75 ? 0.9 : 0) - (y < SOUP_Y - 1.4 ? 0.6 : 0) + fat))
    }
  }
  for (const x of [36, 37, 38]) c.set(x, 19, LANTERN[6] ?? 0)
  c.set(37, 20, LANTERN[5] ?? 0)
  for (const x of [22, 23]) c.set(x, 19, PINK[4] ?? 0)
  for (const r of rings) {
    const rr = 0.8 + r.age * 0.6
    for (let a = 0; a < Math.PI * 2; a += 0.3) {
      const x = Math.round(r.x + Math.cos(a) * rr)
      const y = Math.round(r.y + Math.sin(a) * rr * 0.4)
      if (inSoup(x, y)) c.set(x, y, shade(BROTH, 5.4 - r.age * 0.4))
    }
  }
  for (const [x0, y0, len, k] of [[26, 21, 6, 0], [29, 22, 7, 1], [33, 21, 4, 2], [27, 20, 3, 3]] as const) {
    for (let i = 0; i < len; i++) {
      const y = y0 + ((i + k) % 4 < 2 ? 0 : -1) * (i % 3 === 2 ? 0 : 1)
      c.set(x0 + i, y, shade(NOODLE, 3 + warm(x0 + i, y) * 1.4 - (i === 0 || i === len - 1 ? 0.8 : 0)))
    }
  }
  c.ellipse(24.5, 21.6, 3.1, 1.3, (x, y) => {
    const e = ((x - 24.5) / 3.1) ** 2 + ((y - 21.6) / 1.3) ** 2
    return shade(PORK, e > 0.6 ? 1 : x === 24 && y === 21 ? 4 : 2.6 + warm(x, y))
  })
  c.ellipse(39.5, 20.2, 3.6, 1.7, (x, y) => {
    const e = ((x - 39.5) / 3.6) ** 2 + ((y - 20.2) / 1.7) ** 2
    const ye = ((x - 39.4) / 1.8) ** 2 + ((y - 20.2) / 1.05) ** 2
    if (ye <= 1) return shade(YOLK, ye > 0.55 ? 2 : x === 39 && y === 20 ? 4 : 3)
    return shade(CERAMIC, 4.6 + warm(x, y) * 1.4 - (e > 0.7 && y > 20 ? 1 : 0))
  })
  for (const [x, y, l] of [[28, 20, 2], [29, 20, 3], [33, 22, 2], [34, 22, 3], [35, 19, 2], [21, 20, 3], [30, 23, 2]] as const) {
    if (inSoup(x, y)) c.set(x, y, shade(ONION, l))
  }
  const nori: [number, number][] = [[18.6, 11.5], [24.4, 10.8], [25.4, 19.6], [19.6, 20.2]]
  c.poly(nori, (x, y) => {
    const isEdge = x >= 24 + (y - 11) * 0.11
    const isTop = y <= 11 + (x < 22 ? 1 : 0)
    const sheen = x === 20 && y > 13 ? 0.6 : 0
    return glaze(shade(NORI, 1.6 + sheen + (isEdge ? 2.4 : 0) + (isTop ? 1.2 : 0)), x, y, 1.2)
  })
}
function drawBowlFront(c: Canvas): void {
  for (let y = RIM_Y; y < H; y++) {
    const hw = bodyHalf(y)
    for (let x = Math.floor(BX - hw); x <= Math.ceil(BX + hw); x++) {
      const nx = (x - BX) / Math.max(1, hw)
      if (Math.abs(nx) > 1) continue
      const e = rimE(x, y)
      if (e < 0.8) continue
      if (e <= 1) {
        c.set(x, y, glaze(shade(CERAMIC, 4.8 + warm(x, y) * 1.6 + (nx > 0.5 ? 0.6 : 0)), x, y))
        continue
      }
      const round = nx * 1.4 - (y - 24) * 0.28 + (nx > 0.8 ? 0.8 : 0)
      const isBand = y === 26 || y === 27
      const isMark = isBand && (y === 26 ? mod(x, 4) !== 3 : mod(x, 4) === 0)
      if (isMark) {
        c.set(x, y, shade(INDIGO, 1 + nx * 0.8))
        continue
      }
      c.set(x, y, glaze(shade(CERAMIC, 3.2 + round + warm(x, y) * 1.2 - (y >= 30 ? 1 : 0)), x, y, nx < -0.7 ? 2 : 1))
    }
  }
}
function drawSticks(c: Canvas, tx: number, ty: number): void {
  const rise = clamp((ty - 4.5) / 17)
  for (const [ox, oy, sy] of [[-0.4, -0.4, -11], [0.6, 0.6, -8]] as const) {
    const x0 = tx + ox
    const y0 = ty + oy
    const x1 = x0 + 36
    const y1 = y0 + sy * (0.25 + rise * 0.75)
    const steps = 40
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = Math.round(lerp(x0, x1, t))
      const y = Math.round(lerp(y0, y1, t))
      if (inSoup(x, y) || (y > RIM_Y && rimE(x, y) > 0.8 && y < H)) continue
      const isTip = t < 0.08
      c.set(x, y, shade(STICK, isTip ? 2.4 : 3.2 + warm(x, y) * 1.2 + (oy > 0 ? 0 : 0.8)))
    }
  }
}
const NEON_OFF = [[45, 46], [49, 51]] as const
const sputter = (frames: number) => ({ frames, box: [7, 3, 14, 7] as const, colors: [CYAN[1] ?? 0, CYAN[4] ?? 0], why: 'the neon steam sputters off or back on' })

function render(): Int32Array[] {
  const sim = simulate()
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const frame = sim[f]
    if (!frame) continue
    const c = new Canvas()
    const isCyanOn = !NEON_OFF.some(([a, b]) => f >= a && f <= b)
    drawBackdrop(c, f, isCyanOn)
    drawBowlBack(c, f, frame.rings)
    const [tx, ty] = tipAt(f)
    const lift = clamp((21.5 - ty) / 17)
    for (const p of particles(f, LOOP, 7, 24, 3)) {
      const isOffNoodles = p.i % 3 === 0 && lift > 0.6
      const x0 = isOffNoodles ? Math.round(tx - 1 + p.r[1] * 3) : Math.round(BX - 9 + p.r[1] * 18)
      const y = Math.round((isOffNoodles ? 14 : 17) - p.age * 12)
      const alpha = Math.sin(p.age * Math.PI)
      if (alpha < 0.3) continue
      const len = alpha > 0.7 ? 4 : 2
      for (let dy = 0; dy < len; dy++) {
        const x = x0 + Math.round(Math.sin(p.age * 4 + p.r[2] * 6 + dy * 0.7) * 1.2)
        if (alpha > 0.7 || dy === 0) c.tint(x, y + dy, STEAM[4] ?? 0, dy < 2 ? 0.42 : 0.26)
      }
    }
    frame.strands.forEach((pts, k) => {
      const level = STRAND_LEVELS[k] ?? 3
      for (let i = 0; i + 1 < pts.length; i++) {
        const [ax, ay] = pts[i] ?? [0, 0]
        const [bx, by] = pts[i + 1] ?? [0, 0]
        const kinkAt = (n: number) => ((n + (k % 2) * 3) % 6 < 3 ? 0 : 1)
        const x0 = Math.round(ax) + kinkAt(i)
        const x1 = Math.round(bx) + kinkAt(i + 1)
        c.line(x0, Math.round(ay), x1, Math.round(by), (x, y) => {
          if (inSoup(x, y) || (y >= SOUP_Y && rimE(x, y) <= 1.2)) return undefined
          return shade(NOODLE, level + warm(x, y) * 1.2 - (i < 2 ? 0.6 : 0))
        })
      }
    })
    drawBowlFront(c)
    drawSticks(c, tx, ty)
    for (const d of frame.drops) {
      c.set(d.x, d.y, shade(BROTH, 5.6))
      if (d.vy > 1.2) c.set(d.x, d.y - 1, shade(BROTH, 4))
    }
    out.push(c.px)
  }
  return out
}
export const scene: Scene = { verb: 'Noodling', render, hero: 30, snaps: NEON_OFF.flatMap(([a, b]) => [sputter(a), sputter(b + 1)]) }