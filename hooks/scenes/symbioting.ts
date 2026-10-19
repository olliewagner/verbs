import { Canvas, TAU, clamp, ease, frames, hash, hex, lerp, loopNoise, particles, shade, smoothstep, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const WATER = hex('03162a 052036 082b44 0c3752 12445f 1a536d 25637b 337589 47898f')
const RAY = hex('2c7088 3c8494 5a9ea2')
const FAR = hex('0a2c46 0e3854 14445e')
const ROCK = hex('121828 1b2438 27324a 35425a 47566c 5e6e80 7c8c96')
const SAND = hex('1a3444 26475a 365c6a 4a727a 64898a a8c4b0')
const CORAL = hex('2a2440 432f55 61406a 84557c aa6f8c')
const FAN = hex('1c2e52 263a64 32487a')
const BRAIN = hex('2a2a2c 45402e 665a34 8a7840 ae9850')
const COLUMN = hex('2e1834 48223f 66304c 884260 a85a74')
const TENT = hex('163232 22483e 32654c 48835a 66a46a 8ec67e b4e09a')
const TIP = hex('6a2450 a23c78 d8649e f6a2cc')
const TIP_ALT = hex('5e2458 963c86 c864b0 eca6dc')
const FISH: Record<string, number> = { o: 0xf06a1c, O: 0xffa048, d: 0xb4420e, w: 0xf6f2ea, k: 0x16101c, e: 0x080812 }
const BUBBLE = hex('6ab6c4 bfe8ec')

const SWIM = [
  [
    '....kOwOk..',
    '...wOOwOO.k',
    '.OewOOwOOwO',
    'oOowoowoowo',
    '.dowddwddwo',
    '...wddwdd.k',
    '.....kwk...',
  ],
  [
    '....kOwOk.k',
    '...wOOwOOwo',
    '.OewOOwOOwo',
    'oOowoowoowo',
    '.dowddwddwk',
    '...wddwdd..',
    '.....kwk...',
  ],
] as const
const FACING = [
  '...k...',
  '..wOw..',
  '.weOew.',
  'kwoOowk',
  '.wdddw.',
  '..wdw..',
  '...k...',
]

const DISC_X = 32
const DISC_Y = 22

type Tentacle = { x: number; y: number; angle: number; length: number; phase: number; isFront: boolean }
const TENTACLES: Tentacle[] = (() => {
  const out: Tentacle[] = []
  for (let i = 0; i < 9; i++) {
    const t = (i + 0.5) / 9
    const x = DISC_X - 7.5 + t * 15
    out.push({ x, y: DISC_Y - 1, angle: -Math.PI / 2 + (t - 0.5) * 2.2, length: 9 + hash(i, 1) * 3, phase: hash(i, 2) * TAU, isFront: false })
  }
  for (let i = 0; i < 8; i++) {
    const t = (i + 0.5) / 8
    const x = DISC_X - 8 + t * 16
    out.push({ x, y: DISC_Y + 1, angle: -Math.PI / 2 + (t - 0.5) * 2.7, length: 4.5 + hash(i, 3) * 2.5, phase: hash(i, 4) * TAU, isFront: true })
  }
  return out
})()

type Fish = { x: number; y: number; dir: -1 | 1 | 0; tail: number }

function fish(f: number): Fish {
  const bob = Math.round(Math.sin((f / LOOP) * TAU * 3) * 0.7)
  const flick = Math.floor(f / 3) % 2
  if (f < 12) return { x: 47, y: 12 + bob, dir: -1, tail: flick }
  if (f < 16) return { x: 47 + ease.out(smoothstep(12, 16, f)), y: 12 + bob, dir: -1, tail: 0 }
  if (f < 26) {
    const t = 1 - (1 - (f - 16) / 10) ** 2.5
    return { x: lerp(48, 33, t), y: lerp(12, 14, t) - Math.sin(t * Math.PI) * 2, dir: -1, tail: Math.floor(f / 3) % 2 }
  }
  if (f < 46) {
    const wriggle = f < 45 ? Math.floor(f / 3) % 2 : 0
    const dir = f < 35 ? -1 : f < 37 ? 0 : 1
    return { x: 33 + wriggle - (f > 40 ? 1 : 0), y: f > 40 ? 13 : 14, dir, tail: wriggle }
  }
  if (f < 58) {
    const t = ease.inOut((f - 46) / 12)
    return { x: lerp(32, 50, t), y: lerp(13, 10, t) - Math.sin(t * Math.PI) * 1.5, dir: 1, tail: Math.floor(f / 2) % 2 }
  }
  if (f < 61) return { x: 50, y: 10, dir: 0, tail: 0 }
  const t = ease.inOut((f - 61) / (LOOP - 61))
  return { x: lerp(50, 47, t), y: lerp(10, 12, t) + bob * t, dir: -1, tail: flick }
}

function hug(f: number): number {
  const held = smoothstep(22, 30, f) * (1 - smoothstep(44, 50, f))
  const spring = f >= 46 ? -0.45 * Math.exp(-(f - 46) / 5) * Math.sin((f - 46) * 0.8) : 0
  return held + spring
}

function caustic(x: number, y: number, f: number): number {
  const t = f / LOOP
  const a = loopNoise(x * 0.16, y * 0.3, t, 2, 3)
  const b = loopNoise(x * 0.16 + 7, y * 0.3 + 3, t, 2, 9)
  return 1 - Math.abs(a - b) * 7
}

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const sway = Math.sin((f / LOOP) * TAU * 2)
    const raySway = Math.sin((f / LOOP) * TAU) * 1.5

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const depth = 7.6 - y * 0.24
        const ray = Math.sin((x - y * 0.5 + raySway) * 0.42) + Math.sin((x - y * 0.5) * 0.17 + 1)
        const isRay = ray > 1.25 && y < 26
        c.set(x, y, isRay ? shade(RAY, 2.4 - y * 0.1) : shade(WATER, depth))
      }
    }

    for (let x = 0; x < W; x++) {
      const top = 21 + 2.4 * Math.sin(x * 0.21 + 1) + 1.6 * Math.sin(x * 0.47)
      for (let y = Math.ceil(top); y < H; y++) c.set(x, y, shade(FAR, y - top < 1 ? 2 : 1))
    }

    const lean = sway * 1.2
    const fanBranches: readonly (readonly [number, number, number, number])[] = [
      [56, 30, 56, 22], [56, 22, 51, 12], [56, 22, 55, 9], [56, 22, 60, 10], [56, 23, 62, 14],
      [53, 16, 50, 15], [55, 14, 52, 10], [58, 16, 58, 11], [59, 18, 62, 18], [54, 19, 51, 18],
    ]
    for (const [x0, y0, x1, y1] of fanBranches) {
      const bend = (y: number) => lean * clamp((24 - y) / 14)
      c.line(x0 + bend(y0), y0, x1 + bend(y1), y1, (x, y) => shade(FAN, y < 15 ? 2 : 1))
    }

    const branches: readonly (readonly [number, number, number, number])[] = [
      [6, 31, 5, 20], [5, 24, 1, 17], [5, 26, 10, 18], [9, 21, 12, 14], [7, 22, 8, 12], [12, 31, 15, 22], [14, 25, 17, 19],
    ]
    for (const [x0, y0, x1, y1] of branches) {
      c.line(x0, y0, x1, y1, (x, y) => shade(CORAL, 1.4 + (y0 - y) * 0.12 + caustic(x, y, f) * 0.6))
      c.line(x0 + 1, y0, x1 + 1, y1, (x, y) => shade(CORAL, 0.8 + (y0 - y) * 0.1))
      c.set(x1, y1 - 1, shade(CORAL, 3.6))
      c.set(x1 + 1, y1 - 1, shade(CORAL, 2.8))
    }

    for (let y = 26; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const k = caustic(x, y, f)
        const rockTop = 25 + ((x - DISC_X) / 15) ** 2 * 5
        if (x > 15 && x < 49 && y >= rockTop) {
          const lit = y - rockTop < 1.2 ? 2 : 0
          c.set(x, y, shade(ROCK, 2 + lit - (y - 26) * 0.25 - (x - DISC_X) * 0.04 + (k > 0.55 ? 1.2 : 0)))
        } else if (y >= 29 - Math.sin(x * 0.3) * 0.6) {
          c.set(x, y, shade(SAND, 2.4 + (y - 29) * 0.2 + (k > 0.5 ? 1.4 : 0)))
        }
      }
    }
    c.ellipse(51, 28.5, 5.5, 3.2, (x, y) => {
      const groove = Math.sin(x * 1.3 + Math.sin(y * 1.1) * 2) > 0.5 ? -0.8 : 0
      return shade(BRAIN, 2.4 - (y - 26) * 0.4 - (x - 49) * 0.12 + groove + (caustic(x, y, f) > 0.55 ? 1 : 0))
    })

    for (let y = DISC_Y; y < 28; y++) {
      const half = 6.5 - (y - DISC_Y) * 0.35
      for (let x = Math.round(DISC_X - half); x <= Math.round(DISC_X + half); x++) {
        const across = (x - DISC_X) / half
        c.set(x, y, shade(COLUMN, 2.6 - across * 1.4 - (y - DISC_Y) * 0.25 + (y === DISC_Y ? 1.2 : 0)))
      }
    }
    c.ellipse(DISC_X, DISC_Y - 0.5, 8, 1.6, (x, y) => shade(COLUMN, y < DISC_Y - 0.5 ? 3.4 : 2.6 - (x - DISC_X) * 0.06))

    const fsh = fish(f)
    const near3 = [fish((f + LOOP - 1) % LOOP), fsh, fsh, fish((f + 1) % LOOP)]
    const fx = near3.reduce((sum, q) => sum + q.x, 0) / 4 + 5
    const fy = near3.reduce((sum, q) => sum + q.y, 0) / 4 + 3
    const fold = hug(f)

    for (const p of particles(f, LOOP, 3, 14, 4)) {
      const born = (f - p.t + LOOP) % LOOP
      if (born < 30 || born > 42) continue
      const x = 36 + p.r[0] * 3 + Math.sin(p.t * 0.8 + p.r[1] * 6) * 0.8
      const y = 13 - p.t * 0.9
      c.set(x, y, BUBBLE[p.age < 0.5 ? 1 : 0] ?? 0)
      if (p.r[2] > 0.5) c.set(x + 1, y, BUBBLE[0] ?? 0)
    }

    const drawTentacles = (isFront: boolean) => {
      TENTACLES.forEach((tn, i) => {
        if (tn.isFront !== isFront) return
        const toward = Math.atan2(fy - tn.y, fx - tn.x)
        const near = clamp(1 - Math.abs(fx - tn.x) / 10)
        let angle = tn.angle + (toward - tn.angle) * 0.35 * near * fold
        let x = tn.x
        let y = tn.y
        const steps = Math.round(tn.length)
        const pts: [number, number, number][] = []
        for (let k = 0; k < steps; k++) {
          const along = k / steps
          angle += 0.05 * sway * along + 0.08 * Math.sin(TAU * (f / LOOP) * 3 - k * 0.55 + tn.phase)
          x += Math.cos(angle)
          y += Math.sin(angle)
          pts.push([x, y, along])
        }
        const base = isFront ? 0.8 : 0
        const band = (along: number) => (along < 0.34 ? 0 : along < 0.67 ? 1.4 : 2.8)
        for (const [px, py, along] of pts) c.set(px + 1, py, shade(TENT, (along < 0.67 ? 1 : 2) + band(along) + base))
        for (const [px, py, along] of pts) c.set(px, py, shade(TENT, 2 + band(along) + base))
        const tip = i % 2 ? TIP_ALT : TIP
        c.set(x, y - 1, shade(tip, 2.6 + base * 0.5))
        c.set(x + 1, y - 1, shade(tip, 2.6 + base * 0.5))
        c.set(x, y, shade(tip, 1.4 + base * 0.5))
        c.set(x + 1, y, shade(tip, 1.4 + base * 0.5))
      })
    }

    drawTentacles(false)
    drawFish(c, fsh)
    drawTentacles(true)
  })
}

function drawFish(c: Canvas, fsh: Fish): void {
  if (fsh.dir === 0) {
    c.sprite(fsh.x + 2, fsh.y, FACING, FISH)
    return
  }
  c.sprite(fsh.x, fsh.y, SWIM[fsh.tail % 2] ?? SWIM[0], FISH, fsh.dir === 1)
}

export const scene: Scene = {
  verb: 'Symbioting',
  render,
  hero: 40,
  snaps: [
    { frames: 35, box: [42, 14, 44, 17], colors: [0xf06a1c, 0xffa048, 0x16101c, 0xf6f2ea], why: 'the fish turns round in the tentacles: from side-on to head-on, its tail swinging out of sight' },
    { frames: 35, box: [35, 16, 39, 19], colors: [0xf06a1c, 0xb4420e, 0xffa048], why: 'the head-on fish, its belly where the side-on one had its flank' },
    { frames: 37, box: [33, 14, 36, 19], colors: [0x16101c, 0xf06a1c, 0xffa048, 0xb4420e], why: 'and on round to side-on, facing out to peek' },
  ],
}
