import { Canvas, TAU, clamp, ease, frames, hash, hex, lerp, random, shade, smoothstep, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const SKY = hex('4f94d6 64a6e0 7cb8e8 98caee b6daf2 d2e8f6')
const CLOUD = hex('8fa8c8 b4c8de dae6f2 f6faff')
const HILLS = hex('5e8ea8 6c9cae 7eaab2')
const FIELD = hex('6e9e44 80b04e 94c05a aed06c')
const GRASS = hex('17401e 22561f 2e6c24 3e842a 549c30 6eb238 8cc644 b0d85e d4ea84')
const STONE = hex('2a2630 3e3844 554e5a 6e6672 8c8290 aca0a8 cdc2c2')
const WOOD = hex('2e1e14 4a321e 6a4a2c 8c6a42 b08e62 d0b488')
const WOOL = hex('5c5678 7e789a a29eb8 c6c2d4 e4e0e6 f8f6f0 fffef8')
const FACE = hex('141016 2a2226 403436')
const COAT = hex('0c0a10 1a1820 2a2832 3e3c4a')
const BIB = hex('9c98ac c8c6d4 eeeef4')
const FLOWERS = [0xfff6d8, 0xf6d84a, 0xf4a8c8]

const WALL_TOP = 11
const WALL_BOT = 15
const GATE: [number, number] = [38, 46]

type Key = readonly [number, number, number]

function along(keys: readonly Key[], t: number): [number, number] {
  const first = keys[0]!
  const last = keys[keys.length - 1]!
  if (t <= first[0]) return [first[1], first[2]]
  if (t >= last[0]) return [last[1], last[2]]
  let i = 0
  while (i < keys.length - 2 && t > keys[i + 1]![0]) i++
  const k0 = keys[Math.max(0, i - 1)]!
  const k1 = keys[i]!
  const k2 = keys[i + 1]!
  const k3 = keys[Math.min(keys.length - 1, i + 2)]!
  const p = (t - k1[0]) / (k2[0] - k1[0])
  const cr = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * p + (2 * a - 5 * b + 4 * c - d) * p * p + (-a + 3 * b - 3 * c + d) * p * p * p)
  return [cr(k0[1], k1[1], k2[1], k3[1]), cr(k0[2], k1[2], k2[2], k3[2])]
}

const SHEEP: (readonly Key[])[] = [
  [[0, -9, 23.5], [14, 12, 23.5], [24, 27, 21], [32, 36, 18.5], [38, 41, 15.5], [44, 43, 12.5], [58, 56, 10.5], [72, 72, 10]],
  [[5, -9, 26.5], [19, 12, 26.5], [30, 28, 23.5], [38, 37, 19.5], [45, 42, 15.5], [51, 44, 12.5], [65, 58, 10.5], [79, 72, 10]],
  [[10, -9, 24], [24, 11, 24], [34, 26, 21.5], [42, 36, 19], [50, 41, 15.5], [56, 44, 12.5], [70, 60, 10.5], [84, 72, 10]],
  [[12, -9, 28], [26, 14, 28], [34, 30, 28], [42, 45, 28], [44, 47, 27.8], [48, 47.5, 27.8], [55, 41, 22], [62, 41, 17], [66, 42, 15.5], [71, 44, 12.5], [80, 58, 10.5], [93, 72, 10]],
  [[16, -9, 26], [30, 12, 26], [39, 28, 23], [48, 37, 19.5], [55, 41.5, 15.5], [60, 44, 12.5], [74, 58, 10.5], [88, 72, 10]],
]
const STRAY = 3

type DogPose = 'crouch' | 'stalk' | 'stand' | 'run' | 'trot' | 'turn'
type DogKey = readonly [number, number, DogPose, number]
const DOG: DogKey[] = [
  [0, 8, 'crouch', 1], [9, 8, 'stalk', 1], [24, 21, 'stand', 1], [26, 20.5, 'crouch', 1],
  [28, 21, 'run', 1], [43, 53, 'turn', 1], [45, 53, 'crouch', -1], [54, 53, 'stand', -1], [57, 52.4, 'trot', -1],
  [87, 10, 'stand', -1], [88, 9, 'turn', 1], [90, 9, 'stand', 1], [92, 9, 'crouch', 1], [96, 8, 'crouch', 1],
]
const DOG_Y = 30

function sprint(p: number, rise: number, fall: number): number {
  const top = 1 / (1 - rise / 2 - fall / 2)
  if (p < rise) return (top * p * p) / (2 * rise)
  if (p > 1 - fall) return 1 - (top * (1 - p) ** 2) / (2 * fall)
  return top * (p - rise / 2)
}
function dogAt(f: number): { x: number; pose: DogPose; facing: number; speed: number } {
  let i = 0
  while (i < DOG.length - 2 && f >= DOG[i + 1]![0]) i++
  const a = DOG[i]!
  const b = DOG[i + 1]!
  const p = clamp((f - a[0]) / (b[0] - a[0]))
  const shape = (q: number) => (a[2] === 'run' ? sprint(q, 0.2, 0.2) : a[2] === 'trot' ? sprint(q, 0.1, 0) : smoothstep(0, 1, q))
  const x = lerp(a[1], b[1], shape(p))
  const next = lerp(a[1], b[1], shape(clamp(p + 0.1)))
  return { x, pose: a[2], facing: a[3], speed: Math.abs(next - x) * 10 / Math.max(1, b[0] - a[0]) }
}
function drawSheep(c: Canvas, x: number, y: number, facing: number, step: number, hop: number): void {
  const s = clamp(lerp(0.42, 1, (y - 10) / 17), 0.42, 1.05)
  const by = y - 3.1 * s - hop
  const rx = 3.9 * s
  const ry = 2.5 * s
  const cx = x - facing * 0.4 * s
  const legLen = Math.max(1, Math.round(2 * s))
  for (const [k, lu] of [[0, -2.3], [1, 2]] as const) {
    const lx = Math.round(cx + facing * lu * s + (step && s > 0.6 ? (k ? 1 : -1) * facing * 0.6 : 0))
    for (let j = 0; j < legLen; j++) c.set(lx, Math.round(y - hop) - j, FACE[k ? 0 : 1] ?? 0)
    if (s > 0.7) for (let j = 0; j < legLen; j++) c.set(lx + 1, Math.round(y - hop) - j, FACE[0] ?? 0)
  }
  for (let py = Math.floor(by - ry - 1); py <= by + ry + 1; py++) {
    for (let px = Math.floor(cx - rx - 1); px <= cx + rx + 1; px++) {
      const u = (px - cx) / rx
      const v = (py - by) / ry
      const bump = 1 + (hash(Math.floor((Math.atan2(v, u) + Math.PI) * 2.6), 7) - 0.5) * 0.24
      if (u * u + v * v > bump * bump) continue
      const lit = -0.55 * u - 0.75 * v
      c.set(px, py, shade(WOOL, 3.4 + lit * 2.4 + (v > 0.5 ? -0.8 : 0)))
    }
  }
  const hx = Math.round(cx + facing * (rx + 0.2))
  const hy = Math.round(by - ry * 0.35)
  const hw = s > 0.75 ? 2 : 1
  const hh = s > 0.75 ? 3 : s > 0.55 ? 2 : 1
  for (let j = 0; j < hh; j++) for (let i = 0; i < hw; i++) c.set(hx + facing * i, hy + j, FACE[j === 0 && i === 0 ? 2 : 1] ?? 0)
  if (s > 0.55) c.set(hx - facing, hy, FACE[0] ?? 0)
  if (s > 0.75) c.set(hx + facing, hy, 0x8a7a74)
}
const DOG_ART: Record<string, readonly string[]> = {
  stand: [
    '..........k..',
    '.........kek.',
    '.........kKwn',
    '.kKKKKKKvvk..',
    'k.kkkkkkvv...',
    'w.k.k...k.k..',
    '..k.k...v.v..',
  ],
  trotA: [
    '..........k..',
    '.........kek.',
    '.........kKwn',
    '.kKKKKKKvvk..',
    'k.kkkkkkvv...',
    'w.k..k..k..k.',
    '.k....k.v...v',
  ],
  trotB: [
    '..........k..',
    '.........kek.',
    '.........kKwn',
    '.kKKKKKKvvk..',
    'k.kkkkkkvv...',
    'w..kk...kk...',
    '...kk...vv...',
  ],
  runA: [
    '...........kk..',
    '..........kKek.',
    '...........kKwn',
    'wkkKKKKKKKvvk..',
    '...kkkkkkkvv...',
    '.kk.........kk.',
    'k.............v',
  ],
  runC: [
    '...........kk..',
    '..........kKek.',
    '...........kKwn',
    'wkkKKKKKKKvvk..',
    '...kkkkkkkvv...',
    '...kk.....kk...',
    '...k.......v...',
  ],
  runD: [
    '...........kk..',
    '..........kKek.',
    '...........kKwn',
    'wkkKKKKKKKvvk..',
    '...kkkkkkkvv...',
    '..kk.......kk..',
    '.k...........v.',
  ],
  runB: [
    '...........kk..',
    '..........kKek.',
    '...........kKwn',
    'wkkKKKKKKKvvk..',
    '...kkkkkkkvv...',
    '.....kk.kk.....',
    '.....kk.vv.....',
  ],
  turn: [
    '....k...k....',
    '....kKKKk....',
    '....kewek....',
    '...KKvnvKK...',
    '..kkkvvvkkk..',
    '...k.k.k.k...',
    '...k.v.v.k...',
  ],
  crouchA: [
    '..........k...',
    '..........kk..',
    '.kKKKKKKvkKewn',
    'k.kkkkkkvv....',
    'w.kk....vvvvv.',
  ],
  crouchB: [
    '..........k...',
    '..........kk..',
    '.kKKKKKKvkKewn',
    'k.kkkkkkvv....',
    'w..kk..vvvv...',
  ],
}
const DOG_INK = { k: COAT[1] ?? 0, K: COAT[3] ?? 0, n: COAT[0] ?? 0, e: 0xd0964a, w: BIB[2] ?? 0, v: BIB[1] ?? 0 }
function drawDog(c: Canvas, x: number, pose: DogPose, facing: number, f: number): void {
  const step = pose === 'run' ? Math.floor(f / 2) % 2 : Math.floor(f / 3) % 2
  const name = pose === 'stand' || pose === 'turn' ? pose
    : pose === 'run' ? (['runA', 'runC', 'runB', 'runD'][(f + 2) % 4] ?? 'runA')
    : pose === 'trot' ? (step ? 'trotA' : 'trotB')
    : pose === 'stalk' ? (step ? 'crouchA' : 'crouchB')
    : 'crouchA'
  const art = DOG_ART[name] ?? []
  const w = art[0]?.length ?? 0
  const ink = pose === 'crouch' && wave(f, LOOP, 8) > 0.75 ? { ...DOG_INK, w: COAT[2] ?? 0 } : DOG_INK
  c.sprite(Math.round(x - w / 2), DOG_Y - art.length + 1, art, ink, facing < 0)
}
type Tuft = { x: number; y: number; h: number; tone: number }
const TUFTS: Tuft[] = (() => {
  const r = random(17)
  return Array.from({ length: 34 }, () => ({ x: Math.floor(r() * W), y: 17 + Math.floor(r() * 15), h: 2 + Math.floor(r() * 1.6), tone: r() }))
})()
const BLOOMS: [number, number, number][] = (() => {
  const r = random(23)
  return Array.from({ length: 14 }, () => [Math.floor(r() * W), 18 + Math.floor(r() * 13), Math.floor(r() * 3)] as [number, number, number])
})()
const hillY = (x: number) => 5.5 + 1.6 * Math.sin(x * 0.09 + 0.6) + 0.8 * Math.sin(x * 0.23 + 2)
const ridgeY = (x: number) => 8 + 0.8 * Math.sin(x * 0.13 + 4)

const gust = (x: number, y: number, f: number) => Math.sin(x * 0.16 - y * 0.35 - (f / LOOP) * TAU * 3)

function drawLand(c: Canvas, f: number): void {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (y < hillY(x)) c.set(x, y, shade(SKY, 0.6 + y * 0.75))
      else if (y < ridgeY(x)) c.set(x, y, shade(HILLS, y < hillY(x) + 1 ? 2 : (x + y) % 9 === 0 ? 0 : 1))
      else if (y < WALL_BOT + 1) c.set(x, y, shade(FIELD, 1.4 + (y - 8) * 0.3 + (gust(x, y, f) > 0.75 ? 0.6 : 0)))
      else {
        const slope = 5.6 - (y - 16) * 0.2 - x * 0.02
        c.set(x, y, shade(GRASS, slope + (gust(x, y, f) > 0.72 ? 0.8 : 0)))
      }
    }
  }
  for (const [cx, cy, n] of [[13, 2, 3], [49, 1.5, 4]] as const) {
    for (let k = 0; k < n; k++) {
      const px = cx + (k - (n - 1) / 2) * 3.2
      const r = k === Math.floor(n / 2) ? 2.6 : 1.9
      c.disc(px, cy + (k === Math.floor(n / 2) ? -0.6 : 0.5), r, (x, y) => shade(CLOUD, y < cy ? 3 : y < cy + 1.5 ? 2 : 1))
    }
  }
  for (let x = 0; x < W; x++) {
    const y = Math.round(ridgeY(x))
    c.set(x, y, FIELD[0] ?? 0)
    if (hash(x, 61) > 0.55) c.set(x, y - 1, FIELD[0] ?? 0)
  }
  for (const t of TUFTS) {
    const lean = gust(t.x, t.y, f) > 0.72 ? 1 : 0
    const base = 5.6 - (t.y - 16) * 0.2 - t.x * 0.02
    for (let j = 0; j < t.h; j++) c.set(t.x + (j === t.h - 1 ? lean : 0), t.y - 1 - j, shade(GRASS, base + (t.tone > 0.5 ? 1.6 : -1.4)))
  }
  for (const [x, y, k] of BLOOMS) c.set(x + (gust(x, y, f) > 0.72 ? 1 : 0), y, FLOWERS[k] ?? 0)
}
function drawWall(c: Canvas): void {
  for (let y = WALL_TOP; y <= WALL_BOT; y++) {
    const course = Math.floor((y - WALL_TOP - 1) / 2)
    for (let x = 0; x < W; x++) {
      if (x >= GATE[0] && x <= GATE[1]) continue
      if (y === WALL_TOP) {
        c.set(x, y, shade(STONE, x % 2 ? 4.4 : 5.4))
        continue
      }
      const shift = course * 3 + (course > 0 ? 1 : 0)
      const stone = Math.floor((x + shift) / 5)
      const isGap = (x + shift) % 5 === 0 || y === WALL_BOT
      const isTop = (y - WALL_TOP - 1) % 2 === 0
      const tone = hash(stone, course, 2)
      const level = isGap ? 0.6 : 2.2 + tone * 1.4 + (isTop ? 0.9 : 0) + (x < 20 ? 0.3 : 0)
      c.set(x, y, shade(STONE, level))
    }
  }
  for (const px of [GATE[0] - 1, GATE[1] + 1]) {
    for (let y = WALL_TOP - 3; y <= WALL_BOT; y++) {
      c.set(px, y, shade(WOOD, y === WALL_TOP - 3 ? 4 : 2.6))
      c.set(px + 1, y, shade(WOOD, y === WALL_TOP - 3 ? 3 : 1.4))
    }
  }
  const hinge = GATE[1] + 2
  for (let k = 0; k < 3; k++) {
    const y0 = WALL_TOP - 2 + k * 2
    c.line(hinge, y0, hinge + 7, y0 - 3 + k * 0.6, WOOD[k === 0 ? 5 : 4] ?? 0)
  }
  c.line(hinge, WALL_TOP + 2, hinge + 7, WALL_TOP - 5, WOOD[3] ?? 0)
  c.line(hinge + 7, WALL_TOP - 5, hinge + 7, WALL_TOP + 0, WOOD[4] ?? 0)
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    drawLand(c, f)
    type Actor = { y: number; draw: () => void }
    const far: Actor[] = []
    const near: Actor[] = []
    SHEEP.forEach((keys, i) => {
      const [x, y] = along(keys, f)
      const [x2] = along(keys, f + 1)
      const [x0] = along(keys, f - 1)
      if (x < -6 || x > W + 5) return
      const moving = Math.abs(x2 - x0) > 0.15
      let facing = x2 - x0 >= -0.05 ? 1 : -1
      if (i === STRAY && f >= 44 && f < 49) facing = f < 47 ? 1 : -1
      const hop = i === STRAY ? ({ 44: 2, 45: 3, 46: 1 } as Record<number, number>)[f] ?? 0 : 0
      const step = moving ? Math.floor((f + i * 2) / 3) % 2 : 0
      const actor: Actor = {
        y,
        draw: () => {
          const s = clamp(lerp(0.42, 1, (y - 10) / 17), 0.42, 1.05)
          if (y > WALL_BOT) for (let k = -3; k <= 3; k++) c.set(Math.round(x + k * s + 1), Math.round(y) + 1, shade(GRASS, 2.2))
          drawSheep(c, x, y, facing, step, hop)
        },
      }
      ;(y < 13.5 ? far : near).push(actor)
    })
    const dog = dogAt(f)
    near.push({
      y: DOG_Y,
      draw: () => {
        for (let k = -4; k <= 3; k++) c.set(Math.round(dog.x + k * dog.facing), DOG_Y + 1, shade(GRASS, 2.2))
        drawDog(c, dog.x, dog.pose, dog.facing, f)
      },
    })
    for (const a of far.sort((p, q) => p.y - q.y)) a.draw()
    drawWall(c)
    for (const a of near.sort((p, q) => p.y - q.y)) a.draw()
    if (dog.pose === 'run') {
      for (let k = 0; k < 3; k++) {
        const age = (f + k) % 3
        c.set(dog.x - dog.facing * (8 + k * 2 + age), DOG_Y - 1 - age + (k === 1 ? 1 : 0), shade(GRASS, 6.5 - age))
      }
    }
    if (f >= 42 && f <= 47) {
      const t = f - 42
      for (let k = 0; k < 5; k++) {
        const x = 54 + k * 1.3 + t * 0.6
        const y = DOG_Y - 1 - (1.6 + (k % 3) * 0.6) * t + 0.35 * t * t
        if (y < DOG_Y + 1) c.set(x, y, shade(GRASS, 6 + (k % 2)))
      }
    }
    if (f >= 44 && f <= 46) {
      const [sx, sy] = along(SHEEP[STRAY]!, f)
      for (const [dx, dy] of [[-2, -10], [0, -11], [2, -10]] as const) c.set(sx + dx, sy + dy + (f - 44) * -0.5, 0xfffef0)
    }
  })
}
export const scene: Scene = {
  verb: 'Herding',
  render,
  hero: 45,
  snaps: [
    { frames: 28, box: [21, 25, 28, 28], colors: [...COAT.slice(0, 2), 0xd0964a, 0x3e3c4a, 0xeeeef4, 0x2a2226], why: 'the dog springs out of his crouch into the gallop' },
    { frames: 45, box: [52, 24, 55, 28], colors: [0x3e3c4a, 0x1a1820, 0xd0964a, 0xc8c6d4], why: 'he finishes turning and drops into a crouch, eye to eye with her' },
    { frames: 90, box: [7, 24, 10, 28], colors: [0x1a1820, 0xd0964a, 0xc8c6d4], why: 'he finishes turning back to face the next lot' },
  ],
}