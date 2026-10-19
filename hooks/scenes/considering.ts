import { Canvas, beat, ease, hex, lerp, mod, noise, random, shade, smoothstep, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const SKY = hex('05060f 080b1b 0d1229 141b39 1d274b 28355e 364672 485a88')
const MOON = hex('646683 8c8ea6 b5b3bf d8d2c9 ede5d3 fcf7e8')
const OWL = hex('0a070c 140e16 1f161d 2d1f25 3f2b2c 563a33 72503d 93694c b88a62 dcb486')
const DISC = hex('200d09 381710 5a2614 7f3a1b a4532a c7743a')
const EYE = hex('a04a08 e08e14 fac42c ffe878')
const BARK = hex('040307 0a080e 130e15 1d151b 2a1e22 3c2b2b 594238 7a5c48')
const HORN = hex('1a1719 34302f 6b645c')
const PUPIL = 0x0b0709

const MX = 32
const MY = 14
const MR = 14.5
const inMoon = (x: number, y: number) => (x - MX) ** 2 + (y - MY) ** 2 <= MR * MR

function branchTop(x: number): number {
  const wobble = 0.7 * Math.sin(x * 0.23 + 1) * smoothstep(4, 12, Math.abs(x - 32))
  return Math.round(26 - (x - 32) * 0.06 + wobble)
}
const branchDepth = (x: number) => Math.round(4.7 - x * 0.048)
const BRANCH_END = 57
const isBranch = (x: number, y: number) => x <= BRANCH_END && y >= branchTop(x) && y < branchTop(x) + branchDepth(x)

const TWIGS: [number, number, number, number][] = [
  [47, 24, 52, 20], [52, 20, 54, 16], [52, 20, 57, 19], [55, 23, 61, 21], [61, 21, 63, 22],
  [10, 27, 7, 23], [7, 23, 5, 19], [7, 23, 3, 22],
]

const PINES: [number, number, number][] = [
  [1, 4, 2.5], [6, 6, 3], [11, 3, 2.5], [15, 5, 3], [20, 7, 3.5], [25, 4, 3], [29, 6, 3], [36, 4, 2.5],
  [40, 7, 3.5], [45, 5, 3], [49, 3, 2.5], [53, 6, 3], [58, 4, 3], [62, 7, 3.5],
]
function treeTop(x: number): number {
  let top = 30
  for (const [px, h, w] of PINES) {
    const d = Math.abs(x - px)
    if (d < w) top = Math.min(top, 30 - h * (1 - d / w))
  }
  return Math.round(top)
}

type Wisp = { y: number; period: number; bumps: [number, number, number][] }
const WISPS: Wisp[] = [
  { y: 20.5, period: 64, bumps: [[4, 8, 1.4], [20, 6, 0.9], [38, 10, 1.7], [54, 6, 1.0]] },
  { y: 6.5, period: 32, bumps: [[6, 7, 1.1], [22, 5, 0.8]] },
]
function wispAt(w: Wisp, x: number, y: number, off: number): number {
  const u = mod(x - off, w.period)
  let t = 0
  for (const [c, half, h] of w.bumps) {
    const d = mod(u - c + w.period / 2, w.period) - w.period / 2
    t = Math.max(t, h * (1 - (d / half) ** 2))
  }
  const cy = w.y + 0.7 * Math.sin((u / w.period) * Math.PI * 2 * 2)
  const dy = y - cy
  if (t <= 0.3 || dy < -t * 0.8 || dy > t * 0.5) return 0
  return dy < -t * 0.3 ? 2 : 1
}

type Pose = { angle: number; puff: number; dx: number; lid: number }

function pose(f: number): Pose {
  let deg = 0
  if (f >= 12 && f < 26) deg = -18 * ease.inOut(beat(f, 12, 26))
  else if (f >= 26 && f < 36) deg = -18
  else if (f >= 36 && f < 40) deg = -18 - 5 * ease.out(beat(f, 36, 40))
  else if (f >= 40 && f < 63) deg = lerp(-23, 40, ease.outBack(beat(f, 40, 50)))
  else if (f >= 63 && f < 74) deg = 40 * (1 + Math.cos(Math.PI * beat(f, 63, 74))) / 2
  deg += [0, 9, -9, 7, -5, 2][f - 77] ?? 0
  const puff = f < 73 ? 0 : f < 77 ? ease.outBack(beat(f, 73, 77)) : f < 82 ? 1 : 1 - ease.inOut(beat(f, 82, 90))
  const dx = [0, 1, -1, 1, -1, 0][f - 77] ?? 0
  const lid = f >= 28 && f < 40 ? 1 : f === 54 || f === 57 ? 1 : f === 55 || f === 56 ? 2 : f >= 78 && f <= 81 ? 2 : 0

  return { angle: (deg * Math.PI) / 180, puff, dx, lid }
}

function inTri(u: number, v: number, t: readonly (readonly [number, number])[]): boolean {
  let sign = 0
  for (let i = 0; i < 3; i++) {
    const [ax, ay] = t[i] ?? [0, 0]
    const [bx, by] = t[(i + 1) % 3] ?? [0, 0]
    const s = Math.sign((bx - ax) * (v - ay) - (by - ay) * (u - ax))
    if (s !== 0) {
      if (sign !== 0 && s !== sign) return false
      sign = s
    }
  }
  return true
}
const TUFT_L = [[-5.4, -7.2], [-2.2, -9.2], [-6.9, -13.6]] as const
const TUFT_R = TUFT_L.map(([u, v]) => [-u, v] as const)

const EYE_ART: Record<number, string[]> = {
  0: ['oyo', 'sps', 'oso'],
  1: ['lll', 'sps', 'oso'],
  2: ['LLL', 'ddd', 'LLL'],
}

function render(): Int32Array[] {
  const rng = random(0x0a1c0)
  const stars: [number, number, number, number][] = []
  while (stars.length < 20) {
    const x = Math.floor(rng() * W)
    const y = Math.floor(rng() * 24)
    if (Math.hypot(x - MX, y - MY) < MR + 6) continue
    stars.push([x, y, rng(), rng()])
  }

  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const offs = [Math.round((f * 64) / LOOP), Math.round((f * 32) / LOOP)]

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let cloud = 0
        WISPS.forEach((w, i) => {
          cloud = Math.max(cloud, wispAt(w, x, y, offs[i] ?? 0))
        })
        if (inMoon(x, y)) {
          const d = Math.hypot(x - MX, y - MY) / MR
          const maria = noise(x * 0.2 + 3, y * 0.24, 0, 7) > 0.56 ? 1 : 0
          let level = 4.4 - maria - (d > 0.9 ? 0.7 : 0) + (d < 0.5 && !maria ? 0.4 : 0)
          if (cloud) level = cloud === 2 ? 2.2 : 1.3
          c.set(x, y, shade(MOON, level))
          continue
        }
        const d = Math.hypot(x - MX, y - MY) - MR
        const halo = d < 2.5 ? 2.2 : d < 6 ? 1.3 : d < 10 ? 0.6 : 0
        const level = 1 + (y / 31) * 2.4 + halo + (cloud ? (cloud === 2 ? 1.6 : 1) * (0.6 + halo * 0.4) : 0)
        c.set(x, y, shade(SKY, level))
      }
    }
    for (const [x, y, b, t] of stars) {
      const tw = wave(f, LOOP, 2 + Math.floor(t * 3), t)
      c.set(x, y, shade(MOON, 0.6 + b * 2.4 + tw * 0.8))
    }

    for (let x = 0; x < W; x++) {
      const top = treeTop(x)
      for (let y = top; y < H; y++) c.set(x, y, SKY[y === top ? (inMoon(x, y - 1) ? 4 : 3) : 2] ?? 0)
    }

    for (const [x0, y0, x1, y1] of TWIGS) {
      c.line(x0, y0, x1, y1, (x, y) => shade(BARK, inMoon(x, y - 1) ? 5 : 2.5))
    }
    for (let x = 0; x <= BRANCH_END; x++) {
      const top = branchTop(x)
      const depth = branchDepth(x)
      for (let y = top; y < top + depth; y++) {
        const isTop = y === top
        const grain = (Math.floor(x / 5) + y) % 3 === 0 && x % 5 !== 0 ? 0.8 : 0
        const level = isTop ? (inMoon(x, y - 1) ? 6.4 : 4) : y === top + depth - 1 ? 0.4 : 1.5 + grain
        c.set(x, y, shade(BARK, level))
      }
    }

    const p = pose(f)
    const owl = new Map<number, number>()
    const cx = 32 + p.dx
    const rx = 6 + 1.4 * p.puff
    const ry = 6.6 + 0.6 * p.puff
    const cy = 19.6 - 0.6 * p.puff
    for (let y = 11; y <= 26; y++) {
      const dy = (y - cy) / ry
      if (Math.abs(dy) > 1) continue
      let half = rx * Math.sqrt(1 - dy * dy) * (0.9 + 0.12 * dy)
      if (p.puff > 0.2 && y % 2 === 0 && dy > -0.6) half += p.puff
      for (let x = Math.floor(cx - half - 1); x <= Math.ceil(cx + half + 1); x++) {
        const ax = Math.abs(x - cx)
        if (ax > half) continue
        const k = ax / Math.max(1, half)
        const lx = x - p.dx
        const isWing = k > 0.58 && dy > -0.55
        let level: number
        if (isWing) {
          level = 1.9 - (k > 0.9 ? 0.5 : 0) + (((lx >> 1) + y) % 3 === 0 && dy < 0.7 ? 1.2 : 0) - (dy >= 0.7 ? 0.6 : 0)
        } else {
          level = 4.6 - k * 1.6 - (y >= 17 && y % 2 === 1 && (lx + (y >> 1)) % 3 !== 0 ? 1.1 : 0)
          if (y <= 16 && ax <= 2.4 - (y - 15)) level = 8.4 - (y - 15) * 1.4
        }
        owl.set(y * W + x, shade(OWL, level))
      }
    }

    const cs = Math.cos(p.angle)
    const sn = Math.sin(p.angle)
    const px = 32 + p.dx
    const py = 14
    const toWorld = (u: number, v: number): [number, number] => [Math.round(px + u * cs - v * sn), Math.round(py + u * sn + v * cs)]
    for (let y = 0; y <= 17; y++) {
      for (let x = 16; x <= 48; x++) {
        const ddx = x - px
        const ddy = y - py
        const u = ddx * cs + ddy * sn
        const v = -ddx * sn + ddy * cs
        const isHead = (u / 6.1) ** 2 + ((v + 4.7) / (v < -4.7 ? 5.2 : 4.9)) ** 2 <= 1
        const isTuft = inTri(u, v, TUFT_L) || inTri(u, v, TUFT_R)
        if (!isHead && !isTuft) continue
        let color = shade(OWL, 2.6 - (v < -11 ? 0.9 : 0))
        if (isHead) {
          color = shade(OWL, 3 - (v < -8.4 ? 0.6 : 0))
          for (const s of [-1, 1]) {
            const d = Math.hypot(u - 3 * s, (v + 4.4) * 1.05) / 3.1
            if (d <= 1) color = d > 0.8 ? (OWL[0] ?? 0) : shade(DISC, 4.4 - d * 2.4)
          }
        }
        owl.set(y * W + x, color)
      }
    }

    const rimmed = new Map<number, number>()
    for (const key of owl.keys()) {
      const x = key % W
      const y = Math.floor(key / W)
      const open = (nx: number, ny: number) => !owl.has(ny * W + nx) && inMoon(nx, ny) && ny < branchTop(nx)
      if (open(x, y - 1)) rimmed.set(key, OWL[7] ?? 0)
      else if (open(x - 1, y) || open(x + 1, y)) rimmed.set(key, OWL[6] ?? 0)
    }
    for (const [key, color] of owl) c.set(key % W, Math.floor(key / W), rimmed.get(key) ?? color)

    const eyePaint: Record<string, number> = {
      y: EYE[3] ?? 0, s: EYE[2] ?? 0, o: EYE[0] ?? 0, p: PUPIL,
      l: DISC[2] ?? 0, L: DISC[3] ?? 0, d: DISC[0] ?? 0,
    }
    for (const s of [-1, 1]) {
      const [ex, ey] = toWorld(3 * s, -4.6)
      c.sprite(ex - 1, ey - 1, EYE_ART[p.lid] ?? [], eyePaint)
    }
    for (const s of [-1, 1]) {
      for (const [u, v] of [[1, -6.8], [2.2, -7.6]] as const) {
        const [bx, by] = toWorld(u * s, v)
        c.set(bx, by, OWL[8] ?? 0)
      }
    }
    const [b0x, b0y] = toWorld(0, -4)
    const [b1x, b1y] = toWorld(0, -3)
    c.set(b0x, b0y, HORN[1] ?? 0)
    c.set(b1x, b1y, HORN[0] ?? 0)

    for (const x of [29, 30, 34, 35]) c.set(x + p.dx, 26, HORN[2] ?? 0)

    const age = mod(f - 79, LOOP)
    if (age < 16) {
      const fx = 42 + Math.round(Math.sin(age * 0.45) * 1.6)
      const fy = 18 + age * 0.9
      const isTilted = Math.cos(age * 0.45) > 0
      c.set(fx, fy, OWL[8] ?? 0)
      c.set(fx + 1, fy + (isTilted ? 1 : 0), OWL[6] ?? 0)
    }

    out.push(c.px)
  }

  return out
}

export const scene: Scene = {
  verb: 'Considering',
  render,
  hero: 52,
  snaps: [
    { frames: [41, 43], box: [23, 0, 44, 16], why: 'the owl swings its head all the way over in three frames, its ear tufts sweeping faster than they can be followed' },
    { frames: [78, 82], box: [22, 0, 46, 26], why: 'the ruffle: eyes shut, the owl shakes side to side, the shake dying away, then its eyes open' },
  ],
}
