import { Canvas, beat, clamp, ease, frames, hex, lerp, mod, particles, shade, smoothstep, type Scene } from '../engine'

const W = 64
const LOOP = 64

const SKY = hex('17173a 211e49 2d2657 433064 5f3c6e 85497a a85d84 c27a8c')
const HAZE = hex('4f4a74 5d5781 6c638c')
const MESA = hex('3c2d53 51375e 6c4366 8b556c ab6c72 c98a7c')
const SAND = hex('2c1c32 48283f 6c3a4a 925250 b86e5a d58f68 eab27c f6d39a')
const ROCK = hex('120c18 1f1424 32202e 4a2c38 653a40 84504a a8695a cb8a68')
const SCRUB = hex('1a1426 2c2236 3f3444 5a4c4e 7d6650')
const MOON = hex('8b8098 b8aebb e2d8d8 fbf3e6')
const RED = hex('3a0d16 7a1c20 b4352a e0623a')
const INK = hex('0b0910 1b1520 332836')
const CREAM = hex('8e7c6c d6c4a0 f6eccc')
const LIZARD = { h: 0xe2c25e, e: 0x15111a, c: 0x15111a, b: 0x3aa39a, t: 0x2a7d78, l: 0x1f6a66, s: 0x8fd8c4 }

const pathY = (x: number) => 25 + 2.5 * Math.sin((x / 32) * Math.PI * 2 - 2.36)
const LENGTH = 30
const headX = (f: number) => -2 + f * 1.5

const trackBorn = (x: number) => (x + LENGTH + 2) / 1.5

const ridgeY = (x: number) => 13.2 + 1.5 * Math.sin(x * 0.11 + 0.5) + 0.8 * Math.sin(x * 0.27 + 2)

function mesaTop(x: number): number {
  const butte = x >= 28 && x <= 30 ? 7 : 99
  const left = x <= 13 ? 9 + Math.max(0, x - 10) * 1.2 : 99
  const right = x >= 39 && x <= 57 ? 10 + Math.max(0, 42 - x) * 0.9 + Math.max(0, x - 54) * 1.1 : 99
  return Math.min(butte, left, right)
}

function drawSky(c: Canvas, f: number): void {
  const bands = [0, 0, 0, 1, 1, 2, 2, 3, 4, 5, 6, 7]
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < W; x++) {
      const color = y < bands.length ? SKY[bands[y] ?? 0] : HAZE[y === 12 ? 2 : y === 13 ? 1 : 0]
      c.set(x, y, color ?? 0)
    }
  }
  for (const [x, y, phase] of [[27, 1, 0], [41, 3, 0.4], [56, 1, 0.7], [62, 5, 0.2], [19, 5, 0.55], [35, 0, 0.85]] as const) {
    const isTwinkle = mod(f / LOOP + phase, 1) < 0.08
    c.set(x, y, isTwinkle ? MOON[3] ?? 0 : SKY[4] ?? 0)
  }
  const moon = ['..aba..', '.bcccb.', 'acccdcb', 'bcdccca', 'acccddb', '.bcccb.', '..aba..']
  c.sprite(8, 1, moon, { a: MOON[1] ?? 0, b: MOON[2] ?? 0, c: MOON[3] ?? 0, d: MOON[2] ?? 0 })

  for (let x = 0; x < W; x++) {
    const top = Math.round(mesaTop(x))
    for (let y = top; y < 15; y++) {
      const isRim = y === top
      const isLeftFace = mesaTop(x - 1) > top
      c.set(x, y, shade(MESA, isRim ? 4.4 : isLeftFace ? 3.4 : 2.2 + (y > 12 ? 0.6 : 0), x, y))
    }
  }
  const cactus = ['..a.....', '..ab....', 'a.ab....', 'abab.a..', 'aaab.ab.', '..abaab.', '..ab....', '..ab....']
  c.sprite(20, 5, cactus, { a: SCRUB[3] ?? 0, b: SCRUB[1] ?? 0 })
}

function drawSand(c: Canvas): void {
  for (let x = 0; x < W; x++) {
    const ridge = Math.round(ridgeY(x))
    const slope = ridgeY(x + 1) - ridgeY(x - 1)
    for (let y = ridge; y < 32; y++) {
      let level: number
      if (y < 17) {
        level = y === ridge ? 6 : (slope < -0.08 ? 5 : slope > 0.08 ? 3.6 : 4.3) - (y >= 16 ? 1 : 0)
      } else {
        level = 4.2 + ((y - 17) / 14) * 1.7
      }
      c.set(x, y, shade(SAND, level, x, y))
    }
    for (const [base, k] of [[19.5, 0.3], [29.6, 2.1]] as const) {
      const ry = Math.round(base + 0.8 * Math.sin(x * 0.23 + k) + 0.5 * Math.sin(x * 0.09 + k * 2))
      c.set(x, ry, shade(SAND, 4.2 + ((ry - 17) / 14) * 1.7 - 1, x, ry))
    }
  }
}

function drawTrack(c: Canvas, f: number): void {
  for (let x = 0; x < W; x++) {
    const age = mod(f - trackBorn(x), LOOP)
    const depth = 1 - clamp((age - 22) / 18)
    if (depth <= 0) continue
    const y = Math.round(pathY(x))
    const base = 4.2 + ((y - 17) / 14) * 1.7
    c.set(x, y, shade(SAND, base - 2.2 * depth, x, y))
    c.set(x, y - 1, shade(SAND, base + 0.8 * depth, x, y - 1))
  }
}

function drawRock(c: Canvas): void {
  for (let y = 15; y <= 21; y++) {
    for (let x = 45; x <= 59; x++) {
      const dx = (x - 52) / 6.3
      const dy = (y - 20) / 4.6
      if (dx * dx + dy * dy > 1 || y > 21) continue
      let level = 4.2 - dx * 1.6 - (y >= 21 ? 1.6 : 0)
      if (dx * dx + dy * dy > 0.6 && dy < -0.3 && dx < 0.5) level += 0.9
      if (y === 18 && x >= 48 && x <= 50) level -= 1.6
      c.set(x, y, shade(ROCK, level, x, y))
    }
  }
  for (const [x0, x1, y] of [[56, 60, 16], [58, 61, 15]] as const) {
    for (let x = x0; x <= x1; x++) if (!isRock(x, y)) c.set(x, y, shade(SAND, 3, x, y))
  }
  for (let x = 46; x <= 58; x++) c.set(x, 22, shade(SAND, 3.4, x, 22))
}

const isRock = (x: number, y: number) => ((x - 52) / 6.3) ** 2 + ((y - 20) / 4.6) ** 2 <= 1 && y <= 21

function drawScrub(c: Canvas, f: number): void {
  const sway = Math.round(Math.sin((f / LOOP) * Math.PI * 4) * 0.6)
  const bush = ['..a..b...', 'a.ab.b.a.', '.aabbba..', 'b.abcbab.', '.bbccbb..', '..bcccb..']
  c.sprite(1 + sway, 26, bush.slice(0, 3), { a: SCRUB[4] ?? 0, b: SCRUB[2] ?? 0, c: SCRUB[1] ?? 0 })
  c.sprite(1, 29, bush.slice(3), { a: SCRUB[4] ?? 0, b: SCRUB[2] ?? 0, c: SCRUB[1] ?? 0 })
  for (const [x, y] of [[12, 30], [13, 30], [38, 31], [61, 28]] as const) {
    c.set(x, y, ROCK[2] ?? 0)
    c.set(x, y - 1, ROCK[4] ?? 0)
  }
}

function band(s: number): 'red' | 'ink' | 'cream' {
  if (s < 3.5) return 'ink'
  const k = mod(s - 3.5, 7)
  return k < 3.5 ? 'red' : k < 4.5 || k >= 6 ? 'ink' : 'cream'
}

function drawSnake(c: Canvas, f: number): void {
  const hx = headX(f)
  const look = ease.inOut(beat(f, 17, 21)) * (1 - ease.inOut(beat(f, 27, 32)))
  const flick = (f >= 13 && f <= 15) || (f >= 22 && f <= 24) || (f >= 40 && f <= 41)
  const cols: { x: number; s: number; top: number; bottom: number }[] = []
  for (let x = Math.floor(hx - LENGTH); x <= Math.floor(hx); x++) {
    const s = hx - x
    if (s < 0 || s > LENGTH) continue
    const y = Math.round(pathY(x) - look * 2.2 * clamp(1 - s / 7))
    const isHead = s >= 0.8 && s < 3
    const isTail = s > LENGTH - 8
    cols.push({ x, s, top: isHead ? y - 2 : isTail ? y : y - 1, bottom: y })
  }
  for (const k of cols) {
    for (let y = k.top; y <= k.bottom; y++) {
      const sx = k.x + 1
      const sy = y - 1
      if (!cols.some(o => o.x === sx && sy >= o.top && sy <= o.bottom)) c.set(sx, sy, shade(SAND, 2.6, sx, sy))
    }
  }
  for (const k of cols) {
    for (let y = k.top; y <= k.bottom; y++) {
      const isTopRow = y === k.top
      const kind = band(k.s)
      let color: number
      if (k.s < 0.8) color = CREAM[isTopRow ? 2 : 1] ?? 0
      else if (kind === 'red') color = RED[isTopRow ? 3 : 2] ?? 0
      else if (kind === 'cream') color = CREAM[isTopRow ? 2 : 1] ?? 0
      else color = INK[isTopRow ? 2 : 1] ?? 0
      if (y === k.bottom && k.bottom - k.top >= 1) color = kind === 'red' ? RED[1] ?? 0 : kind === 'cream' ? CREAM[0] ?? 0 : INK[0] ?? 0
      c.set(k.x, y, color)
    }
  }
  const head = cols.find(k => k.s >= 0.8 && k.s < 2)
  if (head) c.set(head.x, head.top + 1, CREAM[2] ?? 0)
  const snout = cols[cols.length - 1]
  if (flick && snout) {
    const y = snout.bottom
    c.set(snout.x + 1, y, RED[3] ?? 0)
    c.set(snout.x + 2, y, RED[2] ?? 0)
    c.set(snout.x + 3, y - 1, RED[2] ?? 0)
    c.set(snout.x + 3, y + 1, RED[2] ?? 0)
  }
}

const SIT = ['.he......', 'hhcbbbbtt', '.l...l...']
const UP = ['.he......', 'hhcsbbbtt', '.l...l...', '.l...l...']
const RUN_A = ['.he......', 'hhcbbbbtt', 'l...l....']
const RUN_B = ['.he......', 'hhcbbbbtt', '..l...l..']

const run = (f: number) => [RUN_A, SIT, RUN_B, SIT][f % 4] ?? SIT

type Pose = { x: number; y: number; art: readonly string[]; isFlipped: boolean }

function lizard(f: number): Pose | undefined {
  const sitX = 48
  const sitY = 13
  if (f < 24) {
    const isUp = (f >= 4 && f < 6) || (f >= 8 && f < 10)
    const crouch = f >= 22 ? 1 : 0
    return { x: sitX, y: isUp ? sitY - 1 : sitY + crouch, art: isUp ? UP : SIT, isFlipped: f >= 20 }
  }
  if (f < 33) {
    const p = beat(f, 24, 29)
    if (f < 29) {
      return { x: lerp(sitX, 57, p), y: lerp(sitY, 18, p) - Math.sin(p * Math.PI) * 2, art: RUN_A, isFlipped: true }
    }
    return { x: 57 + (f - 29) * 3, y: 18, art: run(f), isFlipped: true }
  }
  if (f < 48) return undefined
  if (f < 55) return { x: 61, y: 18, art: f >= 51 && f < 53 ? UP.slice(0, 3) : SIT, isFlipped: false }
  {
    const p = beat(f, 55, 63)
    const x = lerp(61, sitX, p)
    if (f < 63) return { x, y: lerp(18, sitY, smoothstep(0.3, 0.75, p)), art: run(f), isFlipped: false }
  }

  return { x: sitX, y: sitY, art: SIT, isFlipped: false }
}

function drawLizard(c: Canvas, f: number): void {
  const pose = lizard(f)
  if (pose) {
    pose.art.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        if (row[i] === '.' || j === pose.art.length - 1) continue
        const x = Math.round(pose.x) + (pose.isFlipped ? row.length - 1 - i : i) + 1
        const y = Math.round(pose.y) + j - 1
        if (!isRock(x, y) && y >= 13) c.set(x, y, shade(SAND, 2.6, x, y))
      }
    })
    c.sprite(pose.x, pose.y, pose.art, LIZARD, pose.isFlipped)
  }
  for (const [at, x, y] of [[24, 50, 15], [29, 59, 21], [58, 58, 21]] as const) {
    const t = f - at
    if (t < 0 || t > 4) continue
    for (const [dx, dy] of [[-1, 0], [1, 0], [-2, -1], [2, -1], [0, -1]] as const) {
      const px = x + dx * (1 + t * 0.5)
      const py = y + dy * (1 + t * 0.4) - t * 0.3
      if ((dx + t) % 2 === 0 || t < 2) c.set(px, py, SAND[t < 2 ? 7 : 6] ?? 0)
    }
  }
}

function drawWind(c: Canvas, f: number): void {
  for (const p of particles(f, LOOP, 9, 18, 5)) {
    const x = Math.round(68 - p.age * 30 - p.r[1] * 50)
    const y = Math.round(18 + p.r[2] * 13 - Math.sin(p.age * Math.PI) * 1.5)
    if (p.age > 0.15 && p.age < 0.85) c.set(x, y, SAND[7] ?? 0)
  }
}

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    drawSky(c, f)
    drawSand(c)
    drawTrack(c, f)
    drawRock(c)
    drawScrub(c, f)
    drawSnake(c, f)
    drawLizard(c, f)
    drawWind(c, f)
  })
}

export const scene: Scene = { verb: 'Slithering', render, hero: 21 }
