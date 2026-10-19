import { Canvas, clamp, ease, hash, hex, lerp, mix, random, shade, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 48

const GLASS = hex('a3c4bf b8d4cb cde2d6 e0eddf eef6ea')
const OUTSIDE = hex('7b988c 8ba897 9db7a5 b0c5b3')
const BAR = hex('6f827a 9aaca4 c4d2ca e8efe6 f8fbf4')
const WOOD = hex('2e1c1c 4a2c24 6a402c 8a5836 a87240 c4904e dcae66')
const POT = hex('62261a 8a3824 ae5030 c86c3e de8c52 eeb070')
const SOIL = hex('1c120f 2e1e16')
const FERN = hex('0c2418 133820 1c4e26 27682c 388432 52a03a 74ba44 9ed256 c8e872')
const HEAD = hex('4e5866 7c8894 aab6be d2dade eef3f2 fbfdfc')
const BOTTLE = hex('1c4a52 2f7480 4c9aa0 78bcb8 a8dcd2')
const CAP = hex('1f4a32 2f6a44 4a8c58')
const GLOVE = hex('3e2a1e 5e4230 82603e a27c50 bc9866 d4b482')
const SLEEVE = hex('243452 344a72 4a6694 6a86b0')
const RAINBOW = hex('f2a49c f2ec9c a8dca0 9cc6ee')
const MIST = hex('d4e6e2 e8f4f0 f8fdfa')
const SUN = 0xfff4d2
const SUN_GLAZE = hex('f6f0d4 fff8e0')

const PALETTE_ALL = [GLASS, OUTSIDE, BAR, WOOD, POT, SOIL, FERN, HEAD, BOTTLE, CAP, GLOVE, SLEEVE, RAINBOW, MIST, SUN_GLAZE].flat()
const snapCache = new Map<number, number>()
function snap(c: number): number {
  const hit = snapCache.get(c)
  if (hit !== undefined) return hit
  const r = (c >> 16) & 255
  const g = (c >> 8) & 255
  const b = c & 255
  let best = c
  let bd = Infinity
  for (const p of PALETTE_ALL) {
    const dr = r - ((p >> 16) & 255)
    const dg = g - ((p >> 8) & 255)
    const db = b - (p & 255)
    const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db
    if (d < bd) {
      bd = d
      best = p
    }
  }
  snapCache.set(c, best)
  return best
}

const BEAM_X = 25
const BEAM_DIR = [0.55, 0.835] as const
const beamAt = (x: number, y: number) => {
  const d = Math.abs((x - BEAM_X) * BEAM_DIR[1] - y * BEAM_DIR[0])
  return d < 3 ? 2 : d < 6.5 ? 1 : 0
}

const PUMPS = [7, 13] as const
const squeeze = (f: number) => {
  for (const p of PUMPS) {
    if (f >= p - 2 && f < p) return f - p + 3
    if (f >= p && f < p + 2) return 2 - (f - p)
  }
  return 0
}

const NX = 41
const NY = 6

type Drop = { x: number; y: number; age: number; speed: number; vx: number; vy: number }

function mist(f: number): Drop[] {
  const out: Drop[] = []
  PUMPS.forEach((p, k) => {
    const next = random(77 + k * 31)
    for (let i = 0; i < 44; i++) {
      const angle = Math.PI - 0.14 + (next() - 0.5) * 0.7
      const v0 = 1.5 + next() * 1.5
      const life = 20 + next() * 16
      const drift = next() * 6.28
      const born = p - 0.6 + next() * 0.9
      const t = f - born
      if (t < 0 || t > life) continue
      const travel = (v0 * (1 - 0.87 ** t)) / (1 - 0.87)
      const x = NX + Math.cos(angle) * travel + Math.sin(t * 0.25 + drift) * 0.8
      const y = NY + Math.sin(angle) * travel + 0.006 * t * t + Math.cos(t * 0.2 + drift) * 0.6
      const speed = v0 * 0.87 ** t
      out.push({ x, y, age: t / life, speed, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed })
    }
  })
  return out
}

type Frond = { base: [number, number]; ctrl: [number, number]; tip: [number, number]; w: number; depth: number; phase: number }
const FRONDS: Frond[] = [
  { base: [23, 20], ctrl: [13, 4], tip: [5, 12], w: 2.5, depth: 0, phase: 0.1 },
  { base: [26, 20], ctrl: [35, 6], tip: [41, 14], w: 2.5, depth: 0, phase: 0.6 },
  { base: [24, 20], ctrl: [20, 3], tip: [13, 5], w: 2.2, depth: 1, phase: 0.3 },
  { base: [25, 20], ctrl: [27, 5], tip: [33, 9], w: 2.2, depth: 1, phase: 0.85 },
  { base: [23, 20], ctrl: [9, 10], tip: [2, 20], w: 2.4, depth: 2, phase: 0.45 },
  { base: [26, 20], ctrl: [38, 9], tip: [42, 20], w: 2.4, depth: 2, phase: 0.2 },
  { base: [23, 21], ctrl: [14, 14], tip: [9, 24], w: 2, depth: 3, phase: 0.7 },
  { base: [26, 21], ctrl: [34, 14], tip: [37, 23], w: 2, depth: 3, phase: 0.05 },
]

const bez = (a: number, b: number, c: number, t: number) => (1 - t) ** 2 * a + 2 * (1 - t) * t * b + t * t * c

function droop(f: number, fr: Frond): number {
  const sway = 0.45 * wave(f, LOOP, 1, fr.phase)
  const t = f - 18
  const hit = f < 15 ? 0 : f < 18 ? (f - 15) / 3 : Math.exp(-0.15 * t) * Math.cos(0.6 * t) * (1 - clamp(t / 16))
  const reach = fr.tip[0] > 24 ? 1.4 : 0.7
  return sway + Math.max(-0.4, hit) * reach
}

function drawFrond(c: Canvas, f: number, fr: Frond, wet: number): void {
  const dy = droop(f, fr)
  const tip: [number, number] = [fr.tip[0], fr.tip[1] + dy]
  const ctrl: [number, number] = [fr.ctrl[0], fr.ctrl[1] + dy * 0.5]
  const N = 48
  const pts = Array.from({ length: N + 1 }, (_, i) => {
    const t = i / N
    return [bez(fr.base[0], ctrl[0], tip[0], t), bez(fr.base[1], ctrl[1], tip[1], t)] as const
  })
  const xs = pts.map(p => p[0])
  const ys = pts.map(p => p[1])
  for (let y = Math.floor(Math.min(...ys) - 3); y <= Math.ceil(Math.max(...ys) + 3); y++) {
    for (let x = Math.floor(Math.min(...xs) - 3); x <= Math.ceil(Math.max(...xs) + 3); x++) {
      let best = Infinity
      let bi = 0
      pts.forEach(([px, py], i) => {
        const d = (x - px) ** 2 + (y - py) ** 2
        if (d < best) {
          best = d
          bi = i
        }
      })
      const t = bi / N
      const p = pts[bi] ?? [0, 0]
      const q = pts[Math.min(N, bi + 1)] ?? p
      const o = pts[Math.max(0, bi - 1)] ?? p
      const tx = q[0] - o[0]
      const ty = q[1] - o[1]
      const side = (x - p[0]) * -ty + (y - p[1]) * tx
      const teeth = 1 - Math.abs(((t * 10) % 1) * 2 - 1)
      const profile = t < 0.14 ? 0.25 : Math.sin(Math.PI * Math.min(1, (t - 0.08) / 0.96)) ** 0.7
      const w = fr.w * profile * (0.72 + 0.28 * teeth) + 0.4
      const d = Math.sqrt(best)
      if (d > w) continue
      const isUpper = side * Math.sign(tx || 1) < 0
      const lit = beamAt(x, y)
      let level = 1.6 + fr.depth * 0.7 + (isUpper ? 1.2 : -0.2) + lit * 0.9 - (!isUpper && d > w - 0.8 ? 0.6 : 0)
      if (fr.depth >= 2 && d < 0.5 && t > 0.14) level += 0.7
      if (t < 0.14) level = 1.4 + fr.depth * 0.4
      c.set(x, y, shade(FERN, level))
      if (wet > 0 && isUpper && d > w - 0.9 && t > 0.3 && hash(x, y, 5) < 0.06 * wet) {
        c.set(x, y, lit ? (MIST[2] ?? 0) : shade(FERN, 7.6))
      }
    }
  }
}

const GRIP = [
  '    uWWWWWu            ',
  '   uWWWWWWWWu       rrr',
  'ttWWWWWWWWWWWv    rrSSS',
  'ktuuuuuuuuuuux  hrSSSSR',
  '  xxvvvvvvvvx  hgsSSSRR',
  '       cCcCc  hGjsSSRRS',
  '       cCcCchLGGjsSSRRS',
  '       GGGGLLGGgjsSSRSs',
  '       jjjjGGGGgjsSSSs ',
  '       hGGGLLGggjsSs   ',
  '       hjjjGGggjjss    ',
  '       hGGGLLggjjh     ',
  '       hjjjGGgjjh      ',
  '        hGGLLgjh       ',
  '         hhhhhh        ',
]
const TRIGGER = [
  ['    tk ', '    tk ', '  hGGGG', '  hjjjj', '   tk  ', '   tk  ', '  ttk  '],
  ['    tk ', '    tk ', '   hGGG', '   hjjj', '    tk ', '    tk ', '   ttk '],
  ['    tk ', '    tk ', '   hGGG', '   hjjj', '     tk', '     tk', '    ttk'],
] as const
const GRIP_PAINT: Record<string, number> = {
  W: HEAD[5] ?? 0, w: HEAD[4] ?? 0, u: HEAD[3] ?? 0, v: HEAD[2] ?? 0, x: HEAD[1] ?? 0,
  c: CAP[0] ?? 0, C: CAP[1] ?? 0, D: CAP[2] ?? 0, t: HEAD[1] ?? 0, k: HEAD[0] ?? 0,
  L: GLOVE[5] ?? 0, G: GLOVE[4] ?? 0, g: GLOVE[3] ?? 0, j: GLOVE[2] ?? 0, h: GLOVE[1] ?? 0,
  R: SLEEVE[3] ?? 0, S: SLEEVE[2] ?? 0, s: SLEEVE[1] ?? 0, r: SLEEVE[0] ?? 0,
}

function render(): Int32Array[] {
  const out: Int32Array[] = []
  const motes = Array.from({ length: 8 }, (_, i) => ({ s: hash(i, 1), o: hash(i, 2), w: hash(i, 3) }))

  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()

    for (let y = 0; y < 26; y++) {
      for (let x = 0; x < W; x++) {
        const px = (x + 2) % 13
        const py = y % 11
        const sun = beamAt(x, y)
        if (px === 0 || py === 0) {
          c.set(x, y, shade(BAR, (px === 0 ? 2.4 : 2.8) + sun * 0.6))
          continue
        }
        const hedge = 13 - 2.2 * Math.sin(x * 0.21 + 0.8) - 1.4 * Math.sin(x * 0.53 + 2)
        if (y >= hedge) c.set(x, y, shade(OUTSIDE, 2.4 - (y - hedge) * 0.3 + (px === 1 ? -0.8 : 0) + sun * 0.6))
        else c.set(x, y, shade(GLASS, 3 - y * 0.16 + (px === 1 ? -1 : 0) + sun * 0.7))
      }
    }

    for (let x = 0; x < W; x++) {
      c.set(x, 26, shade(WOOD, 5 + beamAt(x, 26) * 0.6))
      c.set(x, 27, shade(WOOD, 3.8 + beamAt(x, 27) * 0.6))
      for (let y = 28; y < H; y++) c.set(x, y, shade(WOOD, (x + 3) % 16 === 0 ? 0.8 : (y === 28 ? 2.4 : 3 - (y - 29) * 0.3) + beamAt(x, y) * 0.7))
    }

    for (let x = 17; x <= 38; x++) c.set(x, 27, shade(WOOD, x < 33 ? 1.4 : 2.2))
    for (let y = 20; y <= 27; y++) {
      const half = y <= 21 ? 8.5 : 7.4 - (y - 22) * 0.45
      for (let x = Math.round(24.5 - half); x <= Math.round(24.5 + half); x++) {
        const u = (x - 24.5) / half
        let level = 4 - u * 1.8 + beamAt(x, y) * 0.8
        if (y === 20) level = 6.2 - u * 1.2
        if (y === 21) level = 4.4 - u * 1.6
        if (y === 22) level -= 1.6
        if (Math.abs(u) > 0.9) level -= 0.7
        c.set(x, y, shade(POT, level - 1))
      }
    }
    for (let x = 18; x <= 31; x++) c.set(x, 20, shade(SOIL, x % 3 === 0 ? 1 : 0))

    const wet = f >= 17 ? clamp((f - 17) / 3) * (1 - clamp((f - 38) / 8)) : 0
    for (const fr of [...FRONDS].sort((a, b) => a.depth - b.depth)) drawFrond(c, f, fr, wet)

    const water = 19 + (f >= 8 && f < 16 ? Math.round(Math.sin((f - 8) * 1.3) * 0.8) : 0)
    for (let y = NY + 3; y <= 24; y++) {
      const [x0, x1] = y < 16 ? [48, 52] : y === 16 ? [47, 53] : [46, 54]
      for (let x = x0; x <= x1; x++) {
        if (y === 24 && (x === x0 || x === x1)) continue
        const isWater = y >= water
        const behind = c.get(x, y)
        let level = isWater ? 1.6 : 3
        if (x === 47) level += 1.4
        if (x === x1 || y === 24) level -= 1.4
        if (x === 46) level -= 0.6
        if (isWater && y === water) level += 1.2
        c.set(x, y, mix(behind, shade(BOTTLE, level), isWater ? 0.8 : 0.55))
      }
    }
    c.sprite(NX, NY - 3, GRIP, GRIP_PAINT)
    c.sprite(NX, NY + 2, TRIGGER[squeeze(f)] ?? TRIGGER[0], GRIP_PAINT)

    const drops = mist(f)
    const density = new Float32Array(W * H)
    for (const d of drops) {
      const r = 2 + d.age * 2.6
      const a = (1 - d.age) * 0.3
      for (let y = Math.floor(d.y - r); y <= Math.ceil(d.y + r); y++) {
        for (let x = Math.floor(d.x - r); x <= Math.ceil(d.x + r); x++) {
          if (x < 0 || x >= W || y < 0 || y >= H) continue
          const k = 1 - ((x - d.x) ** 2 + (y - d.y) ** 2) / (r * r)
          if (k > 0) density[y * W + x] = (density[y * W + x] ?? 0) + k * a
        }
      }
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const m = density[y * W + x] ?? 0
        if (m < 0.45) continue
        const lit = beamAt(x, y)
        c.tint(x, y, lit ? SUN : (MIST[0] ?? 0), m > 1.1 ? 0.45 : 0.26)
      }
    }
    const bow = f < 16 ? 0 : f < 21 ? ease.out((f - 16) / 5) : f < 30 ? 1 : 1 - ease.inOut(clamp((f - 30) / 7))
    const glow = clamp((f - 16) / 2.5)
    if (bow > 0) {
      for (let y = 4; y < 20; y++) {
        for (let x = 16; x < 44; x++) {
          const dx = x - 31.5
          const dy = (y - 15.5) * 1.2
          const band = Math.floor(8.6 - Math.hypot(dx, dy))
          const color = RAINBOW[band]
          if (color === undefined || band < 0) continue
          const spread = Math.abs(Math.atan2(dx, -dy))
          if (spread > bow * 1.05) continue
          c.set(x, y, mix(c.get(x, y), color, (spread > bow * 0.8 ? 0.5 : 1) * glow))
        }
      }
    }
    for (const d of drops) {
      if (d.age > 0.3) continue
      const lit = beamAt(Math.round(d.x), Math.round(d.y))
      if (d.speed > 1.4) c.line(d.x, d.y, d.x - d.vx * 0.9, d.y - d.vy * 0.9, MIST[1] ?? 0)
      c.set(d.x, d.y, lit ? (MIST[2] ?? 0) : (MIST[1] ?? 0))
    }

    const low = FRONDS[4]
    if (low && f >= 28 && f < 44) {
      const tx = low.tip[0] + 1
      const ty = Math.round(low.tip[1] + droop(f, low)) + 1
      if (f < 36) {
        c.set(tx, ty, MIST[0] ?? 0)
        if (f >= 32) c.set(tx, ty + 1, MIST[2] ?? 0)
      } else if (f < 40) {
        const y = ty + 1 + Math.round(ease.in((f - 36) / 4) * (25 - ty - 1))
        c.set(tx, y, MIST[2] ?? 0)
        c.set(tx, y - 1, MIST[0] ?? 0)
      } else {
        const up = f - 40 < 2 ? 1 : 0
        c.set(tx - 1, 25 - up, MIST[1] ?? 0)
        c.set(tx + 1, 25 - up, MIST[1] ?? 0)
      }
    }

    for (const m of motes) {
      const t = (f / LOOP + m.o) % 1
      const along = lerp(-2, 30, (m.s + t * 0.35) % 1)
      const x = Math.round(BEAM_X + along * BEAM_DIR[0] + Math.sin(t * 6.28 * 2 + m.w * 6) * 2.2)
      const y = Math.round(along * BEAM_DIR[1])
      const glint = wave(f, LOOP, 2, m.w)
      const isAir = (c.get(x, y) >> 16 & 255) > 150 && (c.get(x, y) & 255) > 150
      if (beamAt(x, y) === 2 && glint > -0.3 && isAir) c.set(x, y, glint > 0.5 ? (SUN_GLAZE[1] ?? 0) : (SUN_GLAZE[0] ?? 0))
    }

    for (let i = 0; i < c.px.length; i++) c.px[i] = snap(c.px[i] ?? 0)
    out.push(c.px)
  }

  return out
}

export const scene: Scene = {
  verb: 'Misting',
  render,
  hero: 21,
  snaps: [
    {
      frames: PUMPS[1] + 1,
      box: [25, 6, 44, 14],
      why: "the second puff bursts from the nozzle into the first one's haze, its droplets glinting on and off over the fronds",
    },
    {
      frames: [15, 20],
      why: 'the mist lands: it drifts over the fern into the beam, the fronds dip and bead, and the rainbow opens, so more of the picture changes each frame than anywhere else in the loop',
    },
  ],
}
