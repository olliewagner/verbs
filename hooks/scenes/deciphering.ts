import { PALETTE, beat, clamp, frames, hash, hex, lightAt, mix, noise, particles, shade, smoothstep, threshold, type Light, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const STONE = hex('101318 171b22 20262d 2a3238 353f44 424d50 525e5d 646f69 7a8476 959c88')
const AMBER = hex('2a1206 552408 8a400c c0640f e88e1c f8b840 ffd978 fff3cc')
const FELT = hex('06060d 0b0b16 111120 17172b')
const BRASS = PALETTE.gold
const WOOD = PALETTE.wood

const isAmber = new Set(AMBER)
const luma = (c: number) => 0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255)
const AMBER_LUMA = AMBER.map(luma)
function glaze(c: number, over: number, t: number, x: number, y: number): number {
  const m = mix(c, over, t)
  if (!isAmber.has(c)) return m
  const l = luma(m)
  let k = 0
  while (k + 2 < AMBER.length && (AMBER_LUMA[k + 1] ?? 0) <= l) k++
  const lo = AMBER_LUMA[k] ?? 0
  const hi = AMBER_LUMA[k + 1] ?? 255
  return (AMBER[clamp((l - lo) / (hi - lo)) > threshold(x, y) ? k + 1 : k] ?? c)
}
const GLYPHS: readonly (readonly string[])[] = [
  ['x..', 'xx.', '.xx', '.x.'],
  ['x..', '.x.', 'x..', '.x.'],
  ['xxx', 'xx.', 'x..', '...'],
  ['.x.', 'x.x', '.x.', '...'],
  ['x.x', '...', 'x.x', '...'],
  ['x.x', 'x.x', 'x.x', '...'],
  ['xx.', 'x.x', '.xx', '...'],
  ['xxx', '...', 'xxx', '...'],
  ['..x', '.xx', 'xx.', 'x..'],
  ['x..', 'xx.', 'xxx', '...'],
  ['.x.', 'xx.', '.xx', '..x'],
]
const ROW_Y = [4, 10, 16, 22]
const SLOTS = 11
const X0 = 6
const PITCH = 5
const LINE = 2
const RULE_Y = 21
const SWAP_A = 5
const SWAP_B = 6
const FOCUS_X = X0 + SWAP_A * PITCH + 4
const FOCUS_Y = 17.5
function brokenAt(y: number): number {
  return 49 + (y - 1) * 2.3 + (hash(y, 3) - 0.5) * 2
}
function onTablet(x: number, y: number): boolean {
  if (x < 2 || x > 61 || y < 1 || y > 28) return false
  if ((x === 2 || x === 61) && (y === 1 || y === 28)) return false
  return !(y < 7 && x > brokenAt(y))
}
const CARVED: (number | undefined)[][] = ROW_Y.map((y, r) =>
  Array.from({ length: SLOTS }, (_, i) => {
    const x = X0 + i * PITCH
    if (r === LINE && (i === SWAP_A || i === SWAP_B)) return i === SWAP_A ? 0 : 6
    if (!onTablet(x + 3, y) || hash(i, r, 9) < 0.08) return undefined
    return Math.floor(hash(i, r, 5) * GLYPHS.length)
  }),
)
const ENTER = -5
const LAND = 16
const LIFT = 27
const PERCH = 49
const GO = 50
const GONE = 58
function glide(f: number, a: number, b: number, rampIn: number, rampOut: number): number {
  const n = b - a
  const t = clamp(f - a, 0, n)
  const v = 1 / (n - (rampIn + rampOut) / 2)
  if (t < rampIn) return (v * t * t) / (2 * rampIn)
  if (t > n - rampOut) return 1 - (v * (n - t) ** 2) / (2 * rampOut)
  return v * (t - rampIn / 2)
}
const swapOf = (f: number) => smoothstep(14, 25, f) * (1 - smoothstep(60, 69, f))
const kindle = (t: number) => (t < 0.78 ? (t / 0.78) * 1.1 : 1.1 - 0.1 * smoothstep(0.78, 1, t))
function glowOf(i: number, f: number): number {
  const d = i <= SWAP_A ? SWAP_A - i : i - SWAP_B
  const isPair = i === SWAP_A || i === SWAP_B
  const on = isPair ? 21 : LIFT + 1 + d * 1.7
  const off = GO + d * 1.1
  return kindle(beat(f, on, on + 10)) * (1 - smoothstep(off, off + 10, f))
}
const emberOf = (g: number) => -0.6 + g * 6.2
const reachOf = (f: number) => (f < LIFT + 1 ? -1 : (f - LIFT - 1) * 3.4)
const ruleFade = (x: number, f: number) => 1 - smoothstep(GO + Math.abs(x - FOCUS_X) * 0.22, GO + 10 + Math.abs(x - FOCUS_X) * 0.22, f)
type Stamp = { x: number; y: number; glyph: number; glow: number }
function stampsOf(f: number): Stamp[] {
  const out: Stamp[] = []
  const s = swapOf(f)
  ROW_Y.forEach((y, r) => {
    CARVED[r]?.forEach((glyph, i) => {
      if (glyph === undefined) return
      let x = X0 + i * PITCH
      let yy = y
      if (r === LINE && (i === SWAP_A || i === SWAP_B)) {
        const dir = i === SWAP_A ? 1 : -1
        x += dir * PITCH * s
        yy -= dir * Math.sin(s * Math.PI) * 2
      }
      out.push({ x: Math.round(x * 2) / 2, y: Math.round(yy * 2) / 2, glyph, glow: r === LINE ? glowOf(i, f) : 0 })
    })
  })
  return out
}
function grooveMap(stamps: Stamp[]): Float32Array {
  const map = new Float32Array(W * 2 * H * 2).fill(-1)
  for (const st of stamps) {
    const art = GLYPHS[st.glyph] ?? []
    art.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        if (row[i] !== 'x') continue
        for (let sy = 0; sy < 2; sy++) {
          for (let sx = 0; sx < 2; sx++) {
            const gx = Math.round((st.x + i) * 2) + sx
            const gy = Math.round((st.y + j) * 2) + sy
            if (gx >= 0 && gx < W * 2 && gy >= 0 && gy < H * 2) map[gy * W * 2 + gx] = st.glow
          }
        }
      }
    })
  }
  return map
}
const grain = Array.from({ length: W * H }, (_, i) => noise((i % W) * 0.22, Math.floor(i / W) * 0.3, 0, 4))
type Lens = { x: number; y: number }
function lensAt(g: number): Lens {
  if (g < LAND) {
    const t = glide(g, ENTER, LAND, 0, 10)
    return { x: -14 + (FOCUS_X + 14) * t, y: 24 - (24 - FOCUS_Y) * t }
  }
  if (g < LIFT) return { x: FOCUS_X, y: FOCUS_Y }
  if (g < PERCH) {
    const t = glide(g, LIFT, PERCH, 5, 5)
    return { x: FOCUS_X + (58 - FOCUS_X) * t, y: FOCUS_Y - 7 * t }
  }
  const t = glide(g, PERCH, GONE, 6, 0)
  return { x: 58 + 17 * t, y: FOCUS_Y - 7 - 4 * t }
}
const runOf = (f: number) => (f >= GONE ? f - LOOP : f)
const lensOf = (f: number) => lensAt(runOf(f))
function smearOf(f: number): Lens[] {
  const now = lensAt(runOf(f))
  const was = lensAt(runOf(f) - 1)
  const step = Math.hypot(now.x - was.x, now.y - was.y)
  if (step <= 1) return []
  const back = (step - 1) / step
  return [1 / 3, 2 / 3, 1].map(k => ({ x: now.x + (was.x - now.x) * back * k, y: now.y + (was.y - now.y) * back * k }))
}
const GLASS_R = 9.2
const RIM_R = 10.5
function isLensFrame(lx: number, ly: number, x: number, y: number): boolean {
  const d = Math.hypot(x - lx, y - ly)
  if (d > GLASS_R && d <= RIM_R) return true
  return handleAt(lx, ly, x, y) !== undefined
}

function handleAt(lx: number, ly: number, x: number, y: number): number | undefined {
  const u = ((x - lx) + (y - ly)) / Math.SQRT2
  const v = ((x - lx) - (y - ly)) / Math.SQRT2
  if (u < RIM_R - 0.5 || u > RIM_R + 16 || Math.abs(v) > (u < RIM_R + 2.5 ? 1.6 : 1.2)) return undefined
  return u - RIM_R
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const stamps = stampsOf(f)
    const grooves = grooveMap(stamps)
    const lens = lensOf(f)
    const smear = smearOf(f)
    const lights: Light[] = stamps
      .filter(s => s.glow > 0.05)
      .map(s => ({ x: s.x + 1.5, y: s.y + 1.5, power: s.glow * 0.6, radius: 3.6 }))
    const reach = reachOf(f)

    const groove = (u: number, v: number) => {
      const gx = Math.floor(u * 2)
      const gy = Math.floor(v * 2)
      if (gx < 0 || gx >= W * 2 || gy < 0 || gy >= H * 2) return -1
      return grooves[gy * W * 2 + gx] ?? -1
    }
    const tablet = (u: number, v: number, isLensView: boolean, dim = 0): number => {
      const x = Math.floor(u)
      const y = Math.floor(v)
      if (!onTablet(x, y)) {
        if (y >= 29 && y <= 30 && x >= 3 && x <= 61) return shade(STONE, y === 29 ? 1.6 : 0.8)
        const isShadow = onTablet(x - 1, y - 1) || (y >= 31 && x >= 4 && x <= 62)
        return shade(FELT, 1.4 + (u + v) * -0.012 - (isShadow ? 1.2 : 0) - dim * 0.6)
      }
      const key = 5.1 - (x * 0.4 + y * 0.9) / 16
      const wear = (grain[y * W + x] ?? 0.5) > 0.66 ? 0.6 : (grain[y * W + x] ?? 0.5) < 0.3 ? -0.5 : 0
      const edge = y === 1 || (y < 7 && x > brokenAt(y) - 1) ? 1.4 : y === 28 || x === 61 ? -0.8 : x === 2 ? 0.8 : 0
      const crack = Math.abs(x - (54 - (y - 6) * 0.7) - Math.sin(y) * 0.6) < 0.5 && y > 5 && y < 13 ? -1.8 : 0
      const warm = lightAt(lights, u, v)
      let level = key + wear + edge + crack + (isLensView ? 0.8 : 0) - dim
      if ((y === 9 || y === 15 || y === RULE_Y) && x >= 4 && x <= 59 && !(y === 9 && x > brokenAt(6) - 2)) {
        const lit = y === RULE_Y && Math.abs(x - FOCUS_X) < reach ? ruleFade(x, f) : 0
        if (lit > 0.05) return shade(AMBER, emberOf(lit))
        level -= 1.3
      }
      const g = groove(u, v)
      if (g >= 0) {
        if (g > 0.05) return shade(AMBER, emberOf(g) + (isLensView ? Math.min(g, 1) * 0.6 : 0))
        const isShaded = groove(u - 0.5, v - 0.5) < 0
        return shade(STONE, level - (isShaded ? 3.2 : 2.2))
      }
      if (groove(u - 0.5, v - 0.5) >= 0 && groove(u - 0.5, v - 0.5) < 0.05) level += 0.8
      const base = shade(STONE, level)
      return warm > 0.2 ? mix(base, AMBER[3] ?? 0, 0.26) : base
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const shadowed = [lens, ...smear].some(l => isLensFrame(l.x + 3, l.y + 2.5, x, y))
        c.set(x, y, tablet(x + 0.5, y + 0.5, false, shadowed ? 1.8 : 0))
      }
    }
    for (const p of particles(f, LOOP, 7, 36, 5)) {
      const x = 4 + p.r[1] * 56 + p.t * 0.25 + Math.sin(p.t * 0.15 + p.r[2] * 6) * 1.5
      const y = 2 + p.r[2] * 22 + p.t * 0.12
      if (p.age < 0.15 || p.age > 0.85) continue
      c.set(x, y, shade(STONE, 8))
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const at = smear.find(l => isLensFrame(l.x, l.y, x + 0.5, y + 0.5))
        if (!at) continue
        const isRim = Math.hypot(x + 0.5 - at.x, y + 0.5 - at.y) <= RIM_R
        c.set(x, y, isRim ? shade(BRASS, 2) : shade(WOOD, 1.6))
      }
    }

    for (let y = Math.floor(lens.y - RIM_R - 1); y <= Math.ceil(lens.y + RIM_R + 1); y++) {
      for (let x = Math.floor(lens.x - RIM_R - 1); x <= Math.ceil(lens.x + RIM_R + 1); x++) {
        const dx = x + 0.5 - lens.x
        const dy = y + 0.5 - lens.y
        const d = Math.hypot(dx, dy)
        if (d > RIM_R) continue
        if (d > GLASS_R) {
          const lit = (-dx - dy) / d
          const warm = lightAt(lights, x, y)
          c.set(x, y, shade(BRASS, 3.4 + lit * 1.8 + (d > RIM_R - 0.6 ? -0.8 : 0.4) + warm * 3))
          continue
        }
        let color = tablet(lens.x + dx / 2, lens.y + dy / 2, true)
        const a = Math.atan2(dy, dx)
        if (d > GLASS_R - 1.1) color = mix(color, 0x0a1020, 0.35)
        else if (d > 5.6 && d < 7.6 && a < -1.75 && a > -2.95) color = glaze(color, 0xe8f4ff, 0.42, x, y)
        else if (d < 2.2 && dx < -0.5 && dy < -0.5 && d > 1.2) color = glaze(color, 0xe8f4ff, 0.2, x, y)
        c.set(x, y, color)
      }
    }
    for (let y = Math.floor(lens.y); y < H; y++) {
      for (let x = Math.floor(lens.x); x < W; x++) {
        const u = handleAt(lens.x, lens.y, x + 0.5, y + 0.5)
        if (u === undefined) continue
        const v = ((x + 0.5 - lens.x) - (y + 0.5 - lens.y)) / Math.SQRT2
        const lit = v > 0.3 ? 1.4 : v < -0.5 ? -1 : 0
        c.set(x, y, u < 2.5 ? shade(BRASS, 3.6 + lit) : shade(WOOD, 3.2 + lit + (Math.round(u) === 6 ? -1 : 0)))
      }
    }
  })
}
export const scene: Scene = { verb: 'Deciphering', render, hero: 42 }