import { Canvas, TAU, clamp, frames, hash, hex, mix, mod, type Scene, type Snap, shade, smoothstep } from '../engine'

const W = 64
const H = 32
const LOOP = 60
const PERIOD = 36
const SLIDE = 36
const MAIN_Y = 16

const PANEL = hex('080a14 0d1120 121830 18203e 202a4e')
const RIVER = hex('0f2034 143049 1c4362 3b6f8e')
const PARK = hex('0e1c1a 132721 19332a')
const WHITE = hex('6c7290 b8bdd4 f4f6ff')
const TEAL = hex('0c3138 145a60 1f8f8c 3cc4b4 9aefdd')
const ORANGE = hex('4a1e0c 8a3a12 d6681e f49c40 fdd38c')
const MAGENTA = hex('3e0f2a 7a1d50 c43c80 e86ea8 f9b4d2')

type Point = [number, number]

function pathOf(fork: number, merge: number, y: number): Point[] {
  const dy = y < MAIN_Y ? -1 : 1
  const rise = Math.abs(y - MAIN_Y)
  const pts: Point[] = [[fork, MAIN_Y]]
  let x = fork
  let yy = MAIN_Y
  for (let i = 0; i < rise; i++) pts.push([++x, (yy += dy)])
  while (x < merge - rise) pts.push([++x, yy])
  for (let i = 0; i < rise; i++) pts.push([++x, (yy -= dy)])

  return pts
}

type Branch = {
  ramp: readonly number[]
  path: Point[]
  start: number
  end: number
  commits: { at: number; lit: number }[]
  pulse: number
}

function branch(ramp: readonly number[], fork: number, merge: number, y: number, start: number, end: number, at: number[], pulse: number): Branch {
  const path = pathOf(fork, merge, y)
  const head = (f: number) => (path.length - 1) * smoothstep(start, end, f)
  const commits = at.map(i => {
    let f = start
    while (head(f) < i && f < end) f++
    return { at: i, lit: f }
  })

  return { ramp, path, start, end, commits, pulse }
}

const BRANCHES: Branch[] = [
  branch(MAGENTA, 18, 54, 23, 1, 24, [10, 17, 24], 0.6),
  branch(ORANGE, 6, 42, 9, 7, 32, [12, 18, 24], 1),
]

const headOf = (b: Branch, f: number) => (b.path.length - 1) * smoothstep(b.start, b.end, f)

const slideAt = (f: number) => PERIOD * smoothstep(SLIDE, LOOP, f)

function station(c: Canvas, x: number, y: number, ring: number, fill: number): void {
  c.sprite(x, y, ['.oo.', 'o..o', 'o..o', '.oo.'], { o: ring })
  c.rect(x + 1, y + 1, 2, 2, fill)
}

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const slide = Math.round(slideAt(f))
    const lines = new Map<number, readonly number[]>()
    const paint = (x: number, y: number, color: number, ramp: readonly number[]) => {
      c.set(x, y, color)
      if (x >= 0 && x < W && y >= 0 && y < H) lines.set(y * W + x, ramp)
    }

    const flashes = BRANCHES.map(b => ({ b, age: f - b.end, x: (b.path[b.path.length - 1]?.[0] ?? 0) - slide }))

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const m = mod(x + slide, PERIOD)
        const edge = Math.min(x, W - 1 - x, y * 2, (H - 1 - y) * 2)
        let color = shade(PANEL, edge < 2 ? 1 : 2)
        const riverY = 28.6 + 1.6 * Math.sin((TAU * m) / PERIOD)
        const inRiver = Math.abs(y - riverY) < 1.5
        const isBank = !inRiver && Math.abs(y - 1 - riverY) < 1.5
        const parkA = m >= 13 && m <= 21 && y >= 1 && y <= 4 && !((m === 13 || m === 21) && (y === 1 || y === 4))
        const parkB = m >= 27 && m <= 32 && y >= 3 && y <= 6 && !((m === 27 || m === 32) && (y === 3 || y === 6))
        if (parkA || parkB) color = shade(PARK, 1.4 + (y === (parkA ? 1 : 3) ? 0.8 : 0))
        if (inRiver) {
          const g = mod(m - (f * PERIOD) / LOOP - slide, PERIOD)
          const isGlint = y === Math.round(riverY) && (Math.abs(g - 8) < 1 || Math.abs(g - 23) < 1.5)
          color = shade(RIVER, 1 + (y < riverY ? 0.6 : 0) + (isGlint ? 1.5 : 0))
        }
        if (isBank) color = shade(RIVER, 0.4)
        for (const { b, age, x: fx } of flashes) {
          const life = Math.round(4 + 5 * b.pulse)
          if (age < 1 || age > life) continue
          const d = Math.hypot(x - fx - 0.5, (y - MAIN_Y - 0.5) * 1.15)
          const speed = 2 * b.pulse
          const r = 2.5 + age * speed
          const fade = age / life
          const glow = [PANEL[3] ?? 0, mix(b.ramp[0] ?? 0, PANEL[3] ?? 0, 0.5), ...b.ramp, WHITE[2] ?? 0]
          const level = (glow.length - 1) * (1.1 - fade) - 0.6
          if (Math.abs(d - r) < 0.7) color = shade(glow, level)
          else if (d < r && d > r - 0.7 - speed * 1.5) color = shade(glow, level - 2.5)
          else if (d < r && fade < 0.6) color = shade(PANEL, 3.4 - fade * 1.6)
        }
        c.set(x, y, color)
      }
    }

    const lift = (x: number) => {
      let l = 0
      for (const { b, age, x: fx } of flashes) {
        if (age < 0 || age > 12) continue
        const off = Math.abs(Math.abs(x - fx) - age * 3.2)
        if (off < 3) l = Math.max(l, (off < 1.5 ? 2 : 1) * b.pulse)
      }
      return l
    }
    for (let x = 0; x < W; x++) {
      const l = lift(x)
      paint(x, MAIN_Y, shade(TEAL, 2.4 + l), TEAL)
      paint(x, MAIN_Y + 1, shade(TEAL, 2 + l), TEAL)
    }

    for (const b of BRANCHES) {
      for (const cycle of [-1, 0]) {
        const head = cycle < 0 ? b.path.length - 1 : headOf(b, f)
        if (cycle === 0 && f < b.start) continue
        const dx = cycle * PERIOD - slide
        const merged = cycle < 0 || f >= b.end
        const trail = Math.max(1.5, head - headOf(b, f - 1))
        b.path.forEach(([px, py], i) => {
          if (i > head) return
          const level = merged ? 2.4 : Math.max(2.4, 5 - (head - i) / trail)
          const color = level > 4.6 ? WHITE[2] ?? 0 : shade(b.ramp, level)
          paint(px + dx, py, color, b.ramp)
          paint(px + dx, py + 1, color, b.ramp)
        })
      }
    }

    const lit = new Map(lines)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (lit.has(y * W + x)) continue
        const near = lit.get(y * W + x - 1) ?? lit.get(y * W + x + 1) ?? lit.get((y - 1) * W + x) ?? lit.get((y + 1) * W + x)
        if (near && x > 0 && x < W - 1 && c.get(x, y) === PANEL[2]) c.set(x, y, mix(near[1] ?? 0, PANEL[2] ?? 0, 0.6))
      }
    }

    for (let wx = Math.floor(slide / 12) * 12 - 6; wx < slide + W + 12; wx += 12) {
      const x = wx - slide
      const l = lift(x)
      station(c, x - 1, MAIN_Y - 1, WHITE[l > 0.5 ? 2 : 1] ?? 0, l > 0 ? shade(TEAL, 3 + l * 0.5) : PANEL[0] ?? 0)
    }

    for (const b of BRANCHES) {
      for (const cycle of [-1, 0]) {
        const dx = cycle * PERIOD - slide
        for (const { at, lit: born } of b.commits) {
          const age = cycle < 0 ? 99 : f - born
          if (age < 0) continue
          const [px, py] = b.path[at] ?? [0, 0]
          const x = px + dx
          if (age === 0) {
            c.rect(x, py, 2, 2, WHITE[2] ?? 0)
            continue
          }
          if (age === 1) {
            station(c, x - 1, py - 1, WHITE[2] ?? 0, WHITE[2] ?? 0)
            continue
          }
          const glow = clamp(1 - (age - 2) / 10)
          const fill = glow > 0.05 ? shade(b.ramp, 2 + glow * 2.6) : PANEL[0] ?? 0
          station(c, x - 1, py - 1, WHITE[glow > 0.5 ? 2 : 1] ?? 0, fill)
        }
      }
    }

    for (const b of BRANCHES) {
      const [px] = b.path[0] ?? [0, 0]
      const t = b.start - f
      if (t >= 0 && t <= 3 && t % 2 === 0) station(c, px - 1 - slide, MAIN_Y - 1, WHITE[2] ?? 0, b.ramp[3] ?? 0)
    }

    for (const { b, age, x } of flashes) {
      if (age < 0 || age > 12) continue
      if (age <= 1) c.disc(x + 0.5, MAIN_Y + 0.5, (age === 0 ? 3.6 : 2.8) * (0.7 + 0.3 * b.pulse), WHITE[2] ?? 0)
      else station(c, x - 1, MAIN_Y - 1, WHITE[2] ?? 0, shade(b.ramp, 4.6 - age * 0.25))
    }

    for (const [lx, ly, len] of [[8, 13, 4], [20, 20, 3]] as const) {
      for (const cycle of [-1, 0, 1, 2]) {
        const x = lx + cycle * PERIOD - slide
        for (let i = 0; i < len; i++) c.set(x + i, ly, hash(lx, i) < 0.25 ? PANEL[3] ?? 0 : WHITE[0] ?? 0)
      }
    }
  })
}

const bursts: Snap[] = BRANCHES.map(b => {
  const x = (b.path[b.path.length - 1]?.[0] ?? 0) - Math.round(slideAt(b.end))
  const r = Math.ceil(2.5 + 2 * b.pulse + 0.7)
  return { frames: [b.end, b.end + 1], box: [x - r, MAIN_Y - r, x + 1 + r, MAIN_Y + 1 + r], why: 'a merge goes off: a white burst at the station that throws out a ring' }
})

export const scene: Scene = { verb: 'Gitifying', render, hero: 35, snaps: bursts }
