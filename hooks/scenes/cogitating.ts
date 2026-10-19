import { Canvas, TAU, beat, clamp, ease, hex, lerp, mod, particles, shade, smoothstep, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72
const DING = 50

const WALL = hex('080e10 0c1517 111d1f 172628 1f302f 2a3c36 3a4a3e 52593f')
const BRASS = hex('1a0f07 2e1b0a 4a2d0f 6b4414 8f5f1b b07d27 cc9c38 e3bd57 f3dc8a fff5cf')
const STEEL = hex('0f1013 1c1d23 2d2e36 44454f 62636c 8a8a90 b8b6b4 e8e4dc')
const COPPER = hex('1f0b08 3a150d 5a2214 7d3419 a24a20 c46a30 de9150 f2bd85')
const WOOD = hex('0e0807 1a0f0b 2a1810 3d2416 553222 6e4430')
const WAX = hex('5a4a3a 8e7a5e c2ad88 e6d6b2 fbf1da')
const FLAME = hex('7a1f0c c4471a f0862a fcc35a fff0b8 fffdf0')
const STEAM = hex('2a3537 3e4a4b 5a6664 7f8a86 a9b2ab')
const CLOTH = { red: hex('1c0a0a 32120f 4e1c16 6e2a1e 8c3a26'), green: hex('0b1610 13241a 1d3626 2a4a33 3a5e40'), blue: hex('0b0f1c 141b30 1f2a48 2d3c62 3f527c'), ochre: hex('1e1408 342410 523a18 74531f 94702c') }
const PAGE = hex('3a3428 6a604c 9a8e72 c4b896')
const GLOW = hex('0b0605 1a0c07 361409 5e240d 8f3c12 c6641c f0a040 ffd890 fff4d0')

const HEAD: readonly (readonly [number, number])[] = [
  [24.5, 29.5], [24.2, 27], [23.4, 26], [21, 25.6], [19.6, 25.3], [18.4, 24.5], [18.6, 23.5], [19.4, 22.9], [18.3, 22.1],
  [18.3, 20.2], [19.2, 19.3], [18.8, 18.7], [16.2, 18.3], [15.6, 17.4], [18.2, 15], [19.7, 13.8],
  [18.3, 12.6], [18.9, 10.4], [20.3, 7.5], [22.8, 5.2], [27, 3.9], [31, 3.6], [35, 4.6], [38.4, 7.2],
  [40.4, 10.8], [41, 14.5], [40.2, 18.2], [38.4, 21.4], [36.6, 23.6], [36.2, 26.5], [36.8, 29.5],
]

const PX = 31
const PY = 12.4
const GLASS_R = 5.4
const RIM_R = 6.6

const CANDLE_X = 7
const CANDLE_Y = 19
const EYE_X = 21
const EYE_Y = 14

type Gear = { T: number; x: number; y: number; metal: readonly number[]; spokes: number; mesh: number; back?: boolean }
const MODULE = 1
const pitch = (T: number) => (MODULE * T) / 2
const GEARS: Gear[] = (() => {
  const g: Gear[] = []
  const add = (T: number, from: number, dx: number, dy: number, metal: readonly number[], spokes: number) => {
    const a = g[from]
    if (!a) return
    const d = pitch(a.T) + pitch(T) + 0.15
    const k = Math.hypot(dx, dy)
    g.push({ T, x: a.x + (dx / k) * d, y: a.y + (dy / k) * d, metal, spokes, mesh: from })
  }
  g.push({ T: 8, x: 29.9, y: 12.6, metal: STEEL, spokes: 4, mesh: -1 })
  add(6, 0, 0.8, -0.6, COPPER, 3)
  add(6, 0, 0.72, 0.7, BRASS, 3)
  return g
})()

const TEETH_PER_LOOP = 48

function pace(f: number): number {
  const tick = f % 6 === 0 ? 0.5 : 0
  if (f < 10) return tick
  if (f <= DING) return 0.08 + 2.6 * ease.in(beat(f, 10, DING))
  return tick * smoothstep(DING + 10, DING + 16, f) + 2.7 * Math.exp(-(f - DING) / 3.2)
}
const PACE: number[] = Array.from({ length: LOOP }, (_, f) => pace(f))
const PACE_SCALE = TEETH_PER_LOOP / PACE.reduce((a, b) => a + b, 0)
const TRAVEL: number[] = PACE.reduce<number[]>((acc, p, i) => [...acc, (acc[i] ?? 0) + p * PACE_SCALE], [0])

const PHASE: number[] = (() => {
  const out: number[] = []
  GEARS.forEach((g, i) => {
    const a = GEARS[g.mesh]
    const pa = out[g.mesh]
    if (!a || pa === undefined) {
      out[i] = 0
      return
    }
    const alpha = Math.atan2(g.y - a.y, g.x - a.x)
    out[i] = mod(-(alpha * a.T) / TAU - pa - ((alpha + Math.PI) * g.T) / TAU, 1)
  })
  return out
})()

const SPIN: number[] = (() => {
  const out: number[] = []
  GEARS.forEach((g, i) => {
    out[i] = g.mesh >= 0 ? -(out[g.mesh] ?? 1) : g.mesh === -1 ? 1 : -1
  })
  return out
})()

type Part = 'rim' | 'face' | 'hub' | 'axle' | 'smear' | 'teeth'
type Hit = { gear: number; part: Part; light: number }

function gearAt(x: number, y: number, travel: number, speed: number): Hit | undefined {
  for (let i = 0; i < GEARS.length; i++) {
    const g = GEARS[i]
    if (!g) continue
    const dx = x - g.x
    const dy = y - g.y
    const r = Math.hypot(dx, dy)
    const R = pitch(g.T)
    if (r > R + 1) continue
    const light = r > 0.1 ? -(dx + dy) / (r * Math.SQRT2) : 0
    const ang = Math.atan2(dy, dx) / TAU - ((SPIN[i] ?? 1) * travel) / g.T
    const isFast = speed > 0.4
    if (r > R - 0.8) {
      if (isFast) return { gear: i, part: 'teeth', light }
      if (mod(ang * g.T + (PHASE[i] ?? 0), 1) < 0.5) return { gear: i, part: 'rim', light }
      continue
    }
    if (r > R - 1.8) return { gear: i, part: 'rim', light }
    if (r < 0.75) return { gear: i, part: 'axle', light }
    const hub = Math.min(1.6, R * 0.42)
    if (r <= hub) return { gear: i, part: 'hub', light }
    if (R > 3.5) {
      if ((speed / g.T) * g.spokes > 0.3) return { gear: i, part: 'smear', light }
      const s = mod(ang * g.spokes, 1)
      if (Math.min(s, 1 - s) * ((TAU * r) / g.spokes) < 0.75) continue
    }
    return { gear: i, part: 'face', light }
  }
  return undefined
}
function segment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax
  const vy = by - ay
  const t = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy))
  return Math.hypot(px - ax - vx * t, py - ay - vy * t)
}
const RATTLE_AT = PACE.findIndex(p => p * PACE_SCALE > 2.2)
const RATTLE = [1, 1, 0, 0, 1]

const SHIVER = [-1, -1, 0, 1, 1]
const BELL = [
  '  k  ',
  ' bBb ',
  'bbBbb',
  'ddddd',
]
function render(): Int32Array[] {
  const mask = new Canvas()
  mask.poly(HEAD, 1)
  const inside = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H && mask.px[y * W + x] === 1
  const depthOf = (x: number, y: number) => {
    let d = Infinity
    HEAD.forEach(([ax, ay], i) => {
      const [bx, by] = HEAD[(i + 1) % HEAD.length] ?? [ax, ay]
      d = Math.min(d, segment(x, y, ax, ay, bx, by))
    })
    return d
  }
  return Array.from({ length: LOOP }, (_, f) => {
    const c = new Canvas()
    const travel = TRAVEL[f] ?? 0
    const speed = (PACE[f] ?? 0) * PACE_SCALE
    const rush = smoothstep(0.4, 2.6, speed)
    const t = f - DING
    const flash = t >= 0 ? Math.exp(-Math.max(0, t - 1) / 2.2) : 0
    const echo = t >= 0 ? Math.min(1, (t + 1) / 2) : 0
    const eye = echo * (t >= 0 ? Math.exp(-t / 10) : 0)
    const flicker = 0.92 + 0.05 * wave(f, LOOP, 23) + 0.03 * wave(f, LOOP, 56)
    const lightAt = (x: number, y: number) => {
      const d = Math.hypot(x - CANDLE_X, (y - CANDLE_Y) * 1.1)
      return flicker * (Math.max(0, 1 - d / 46) ** 1.3 + Math.max(0, 1 - d / 7) * 0.5)
    }
    const bellLight = (x: number, y: number) => {
      if (t < 0 || t > 9) return 0
      const d = Math.hypot(x - 31, (y - 2) * 1.2)
      const wave = Math.exp(-(((d - 3 - t * 3.2) / 2.2) ** 2)) * (1 - t / 9)
      return flash * Math.max(0, 1 - d / 9) + wave * 0.7
    }
    for (let y = 0; y < 28; y++) {
      for (let x = 0; x < W; x++) {
        const stripe = x % 6 === 0 ? -0.6 : 0
        const sx = Math.round(x - (x - CANDLE_X) * 0.14 - 1)
        const sy = Math.round(y - (y - CANDLE_Y) * 0.1)
        const isShadow = x > 20 && inside(sx, sy)
        const lit = lightAt(x, y) * (isShadow ? 0.2 : 1)
        c.set(x, y, shade(WALL, 0.5 + lit * 2.8 + stripe * Math.min(1, lit * 2) + bellLight(x, y) * 3, x, y))
      }
    }
    for (let y = 28; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const lit = lightAt(x, y)
        c.set(x, y, shade(WOOD, (y === 28 ? 1.6 : 0.5) + lit * (y === 28 ? 4.4 : 2.8) - (y - 28) * 0.25, x, y))
      }
    }
    for (let y = 22; y < 29; y++) {
      for (let x = 5; x <= 9; x++) {
        const edge = x === 5 ? -1 : x === 9 ? -1.6 : x === 6 ? 0.7 : 0
        c.set(x, y, shade(WAX, 2.4 + edge + (y === 22 ? 1 : 0) - (y - 22) * 0.12, x, y))
      }
    }
    c.set(7, 21, WOOD[1] ?? 0)
    const sway = Math.round(wave(f, LOOP, 8) * 0.6)
    const tall = f % 5 === 0 ? 1 : 0
    c.set(7, 20, FLAME[4] ?? 0)
    c.set(6, 20, FLAME[2] ?? 0)
    c.set(8, 20, FLAME[1] ?? 0)
    c.set(7, 19, FLAME[5] ?? 0)
    c.set(6, 19, FLAME[3] ?? 0)
    c.set(8, 19, FLAME[2] ?? 0)
    c.set(7 + sway, 18, FLAME[4] ?? 0)
    c.set(7 + sway, 17 - tall, FLAME[2] ?? 0)
    const books: [number, number, number, number, readonly number[]][] = [
      [46, 26, 12, 2, CLOTH.red], [47, 24, 10, 2, CLOTH.green],
      [55, 16, 3, 8, CLOTH.blue], [58, 18, 2, 10, CLOTH.ochre], [60, 15, 3, 13, CLOTH.red], [53, 19, 2, 5, CLOTH.ochre],
    ]
    for (const [bx, by, bw, bh, cloth] of books) {
      for (let y = by; y < by + bh; y++) {
        for (let x = bx; x < bx + bw; x++) {
          const isLying = bw > bh
          const lit = lightAt(bx, by) * 4
          if (isLying && y === by + bh - 1 && x > bx && x < bx + bw - 1) {
            c.set(x, y, shade(PAGE, 0.6 + lit * 0.8, x, y))
            continue
          }
          const band = !isLying && bw > 2 && (y === by + 1 || y === by + bh - 2) ? 1 : 0
          const edge = x === bx ? 1 : 0
          c.set(x, y, shade(cloth, 1 + lit + edge + band + (isLying && y === by ? 0.8 : 0), x, y))
        }
      }
    }
    for (let y = 29; y < H; y++) {
      for (let x = 22; x <= 39; x++) {
        const edge = x === 22 ? 1 : x === 39 ? -1 : 0
        c.set(x, y, shade(WOOD, (y === 29 ? 3 : 1.5) + lightAt(x, y) * 2.6 + edge, x, y))
      }
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!inside(x, y)) continue
        const d = depthOf(x, y)
        const gx = depthOf(x + 0.5, y) - depthOf(x - 0.5, y)
        const gy = depthOf(x, y + 0.5) - depthOf(x, y - 0.5)
        const g = Math.hypot(gx, gy) || 1
        const tilt = 1 - smoothstep(0, 4, d)
        const bx = (x - 31) / 15
        const by = (y - 13) / 15
        const nx = (-gx / g) * tilt * 0.85 + bx * 0.45
        const ny = (-gy / g) * tilt * 0.85 + by * 0.45
        const nz = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny))
        const lx = CANDLE_X - x
        const ly = CANDLE_Y - y
        const lz = 9
        const ll = Math.hypot(lx, ly, lz)
        const n = Math.hypot(nx, ny, nz)
        const diffuse = Math.max(0, (nx * lx + ny * ly + nz * lz) / (ll * n))
        const hx = lx / ll
        const hy = ly / ll
        const hz = lz / ll + 1
        const spec = Math.max(0, (nx * hx + ny * hy + nz * hz) / (n * Math.hypot(hx, hy, hz))) ** 14
        const crown = bellLight(x, y) * Math.max(0, -ny / n) * 6
        const glow = eye * Math.max(0, 1 - Math.hypot(x - EYE_X, (y - EYE_Y) * 1.2) / 5) * 3
        const lit = lightAt(x, y)
        c.set(x, y, shade(BRASS, 0.9 + diffuse * lit * 6.4 + spec * lit * 4 + crown + glow, x, y))
      }
    }
    const cut = (x: number, y: number, k: number) => {
      const v = BRASS.indexOf(c.get(x, y))
      c.set(x, y, BRASS[Math.max(0, v - k)] ?? 0)
    }
    cut(20, 13, 2)
    cut(21, 13, 2)
    cut(22, 13, 1)
    cut(18, 18, 2)
    cut(18, 21, 2)
    cut(19, 21, 1)
    for (let x = 24; x <= 37; x++) {
      if (inside(x, 26)) cut(x, 26, 2)
      if (inside(x, 27)) cut(x, 27, -1)
    }
    c.set(EYE_X, EYE_Y, shade(GLOW, 1 + eye * 7.5, 0, 0))
    c.set(EYE_X + 1, EYE_Y, shade(GLOW, 1 + eye * 6, 0, 0))
    for (let y = Math.floor(PY - RIM_R); y <= Math.ceil(PY + RIM_R); y++) {
      for (let x = Math.floor(PX - RIM_R); x <= Math.ceil(PX + RIM_R); x++) {
        const dx = x - PX
        const dy = y - PY
        const r = Math.hypot(dx, dy)
        if (r > RIM_R) continue
        if (r > GLASS_R) {
          const facing = (-dx * 0.85 - dy * 0.5) / r
          const isRivet = mod((Math.atan2(dy, dx) / TAU) * 8 + 0.0625, 1) < 0.14
          const level = 3.4 + facing * (r > GLASS_R + 0.6 ? 2 : -1.4) + lightAt(x, y) * 2.4 + (isRivet ? 1.6 : 0) + bellLight(x, y) * 3
          c.set(x, y, shade(BRASS, level, x, y))
          continue
        }
        if (r > GLASS_R - 0.7) {
          c.set(x, y, shade(BRASS, 0.6 + lightAt(x, y), x, y))
          continue
        }
        const inner = 1 - r / GLASS_R
        const warm = rush * 0.85 + flash * echo * 0.5
        let color = shade(GLOW, 0.2 + warm * (2.6 + inner * 3), x, y)
        const hit = gearAt(x, y, travel, speed)
        if (hit) {
          const g = GEARS[hit.gear]
          if (g) {
            const base = { rim: 3.8, face: 3, hub: 4.8, axle: 0.8, smear: 2, teeth: 1.8 }[hit.part]
            const sheen = hit.part === 'rim' || hit.part === 'teeth' ? hit.light * 1.4 : hit.light * 0.5
            const spinAt = Math.atan2(y - g.y, x - g.x) / TAU
            const whirl = mod(spinAt * 2 - f * 0.37 * (SPIN[hit.gear] ?? 1), 1) < 0.18 ? 1.6 : 0
            const streak = hit.part === 'teeth' && hit.light > 0.6 ? 2.6 : hit.part === 'teeth' || hit.part === 'smear' ? whirl : 0
            const level = base + sheen + streak + warm * 1.6 * (0.4 + inner) + lightAt(x, y) * 1.2 + flash * echo * 2
            color = shade(g.metal, level, x, y)
          }
        }
        const a = Math.atan2(dy, dx)
        if (r > GLASS_R - 1.5 && r < GLASS_R - 0.5 && a > -2.7 && a < -2) color = STEEL[6] ?? 0
        if (Math.round(dx) === -3 && Math.round(dy) === -3) color = FLAME[4] ?? 0
        c.set(x, y, color)
      }
    }
    for (let y = 11; y <= 14; y++) c.set(41 - (y === 11 || y === 14 ? 1 : 0), y, BRASS[1] ?? 0)
    for (const p of particles(f, LOOP, 54, 12, 7)) {
      const born = mod(f - p.t, LOOP)
      const strength = smoothstep(30, 44, born) * (1 - smoothstep(DING + 2, DING + 8, born))
      if (strength < 0.3) continue
      const x = 42 + p.age * (5 + p.r[1] * 4) + Math.sin(p.age * 4 + p.r[2] * 6) * 0.8
      const y = 12.5 + (p.r[3] - 0.5) * 2 - p.age * (6 + p.r[0] * 4)
      const level = ((1 - p.age * 0.8) * 4.4 * strength + lightAt(x, y) * 1.2) * smoothstep(1, 0.6, p.age)
      const r = 0.5 + p.age * 1.4
      c.disc(x, y, r, (i, j) => {
        const v = level - Math.hypot(i - x, j - y) * 0.9 + (j < y ? 0.5 : 0)
        return v < 0.6 ? undefined : shade(STEAM, v, 0, 0)
      })
    }
    const cock = f < DING ? ease.inOut(beat(f, DING - 14, DING - 1)) : 0
    const recoil = f >= DING ? Math.max(0, Math.exp(-(f - DING) / 3) * Math.sin((f - DING) * 0.6)) * 0.5 : 0
    const swing = f < DING ? cock : recoil
    const angle = lerp(-2.5, -1.45, swing) + (f === DING ? -0.12 : 0)
    const hx = 38 + Math.cos(angle) * 5.6
    const hy = 6.5 + Math.sin(angle) * 5.6
    c.line(38, 6.5, hx, hy, (x, y) => shade(STEEL, 3 + lightAt(x, y) * 3, x, y))
    c.set(hx, hy, STEEL[6] ?? 0)
    c.set(hx, hy - 1, STEEL[7] ?? 0)
    c.set(hx + 1, hy, STEEL[4] ?? 0)
    c.set(hx + 1, hy - 1, STEEL[5] ?? 0)
    const shiver = t >= 0 ? (SHIVER[t] ?? 0) : f < DING ? (RATTLE[f - RATTLE_AT] ?? 0) : 0
    c.sprite(29 + shiver, 0, BELL, {
      k: (x, y) => shade(BRASS, 4.5 + flash * 4 + lightAt(x, y) * 2, x, y),
      b: (x, y) => shade(BRASS, 3.8 + flash * 4 + lightAt(x, y) * 3, x, y),
      B: (x, y) => shade(BRASS, 6.2 + flash * 3 + lightAt(x, y) * 2, x, y),
      d: (x, y) => shade(BRASS, 2.2 + flash * 5, x, y),
    })
    c.set(31, 4, BRASS[3] ?? 0)
    return c.px
  })
}

export const scene: Scene = {
  verb: 'Cogitating',
  render,
  hero: 51,
  snaps: [
    { frames: DING, box: [27, 2, 35, 5], colors: [...BRASS.slice(6, 10), ...STEEL.slice(4, 8), 0x2a3c36], why: 'the hammer strikes and the bell flashes' },
  ],
}