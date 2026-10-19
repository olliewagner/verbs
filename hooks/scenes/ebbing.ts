import { beat, Canvas, clamp, ease, hash, hex, lerp, mod, noise, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 64

const SKY = hex('1a1033 2a1440 42184c 62204f 862a4f a83a4a c8503f e06c3c f09048 f8b862 fcda8a')
const SEA = hex('140c2a 1e1236 2c1a44 3e2252 562c5e 76386a 9a4a70')
const SUN = hex('f8c070 fde29a fff4cc')
const SAND = hex('1c1222 2a1a2e 3a2236 4c2a3e 603446 74404c')
const ROCK = hex('0b0812 140e1c 1e1528 2a1d34 382640')
const RIM = hex('5a2a44 8e3c4c c45a4c ec8a58')
const FOAM = hex('8e6a94 c49ab4 ead0da fff6f0')
const STAR = hex('3a1020 6e1c24 a8302a dc5430 f6803e fdb066 ffe2b0')
const SHELL = hex('5a3a50 9a7488 dcbcc4 fff0e8')

const HORIZON = 10
const SUN_X = 45

function isRock(x: number, y: number): boolean {
  const rough = (noise(x * 0.45, y * 0.45, 0, 3) - 0.5) * 0.3
  const left = ((x + 1) / 11) ** 2 + ((y - 30) / 11) ** 2 < 1 + rough
  const right = ((x - 63) / 12) ** 2 + ((y - 31) / 9) ** 2 < 1 + rough
  const pebble = ((x - 51) / 2.4) ** 2 + ((y - 23.4) / 1.4) ** 2 < 1
  return left || right || pebble
}

const BASIN_X = 30
const BASIN_Y = 26
const BASIN_RX = 15
const BASIN_RY = 5.2

const inBasin = (x: number, y: number, k: number) => ((x - BASIN_X) / (BASIN_RX * k)) ** 2 + ((y - BASIN_Y) / (BASIN_RY * k)) ** 2 < 1

function drain(f: number): number {
  if (f < 18) return 1 - ease.inOut(beat(f, 5, 12))
  return ease.inOut(clamp((f - 18) / 24))
}

function water(f: number) {
  const d = drain(f)
  return { x: lerp(BASIN_X, 36, d), y: lerp(BASIN_Y, 26.8, d), rx: lerp(BASIN_RX * 0.9, 7, d), ry: lerp(BASIN_RY * 0.9, 3.2, d) }
}
type Water = ReturnType<typeof water>
const inWater = (p: Water, x: number, y: number, k = 1) => ((x - p.x) / (p.rx * k)) ** 2 + ((y - p.y) / (p.ry * k)) ** 2 < 1

const BACK = [13, 46] as const
const LOW = 15
const HIGH = 23
const RUN_START = 1
const RUN_FRONT = [15.9, 17.2, 18.7, 20.1, 21.2, 22, 22.5, 22.8, 22.95]
const RUN_END = mod(RUN_START + RUN_FRONT.length, LOOP)
const sinceRun = (f: number) => mod(f - RUN_START, LOOP)
function reach(f: number): number {
  const u = sinceRun(f)
  if (u < RUN_FRONT.length) return RUN_FRONT[u] ?? HIGH
  if (u < BACK[0] - RUN_START) return HIGH + 0.3 * Math.sin(((f - RUN_END) / (BACK[0] - RUN_END)) * Math.PI)
  return lerp(HIGH, LOW, ease.inOut(clamp(mod(f - BACK[0], LOOP) / (BACK[1] - BACK[0]))))
}
const curve = (x: number) => Math.sin(x * 0.31 + 0.6) * 1.1 + Math.sin(x * 0.11 + 2) * 0.9
const runFront = (x: number, f: number) => reach(f) + curve(x) * (0.35 + 0.65 * ease.inOut(clamp(sinceRun(f) / 4)))
const lipThick = (f: number) => 1 - clamp((sinceRun(f) - RUN_FRONT.length) / 3)
const trailAt = (x: number, f: number) => Math.min(runFront(x, f) - lerp(5, 3.5, clamp((reach(f) - RUN_FRONT[0]!) / (HIGH - RUN_FRONT[0]!))), STRANDS[1]!.line(x))
const edgeAt = (x: number, f: number) => (sinceRun(f) < 5 ? Math.max(LOW + curve(x), runFront(x, f)) : reach(f) + curve(x))
const SWELL = 40
const SWELL_FRAMES = mod(RUN_START - SWELL, LOOP)
function swell(f: number): { y: number; steep: number } {
  const g = mod(f - SWELL, LOOP)
  if (g >= SWELL_FRAMES) return { y: 0, steep: 0 }
  return { y: lerp(HORIZON + 1, LOW - 1, ease.in(clamp(g / (SWELL_FRAMES - 5)))), steep: g / (SWELL_FRAMES - 1) }
}
type Strand = { line: (x: number) => number; at: number; seed: number; gap: number }
const STRANDS: Strand[] = [
  { line: x => HIGH + curve(x), at: HIGH, seed: 1, gap: 0.12 },
  { line: x => HIGH - 3.5 + curve(x), at: HIGH - 3.5, seed: 2, gap: 0.2 },
  { line: x => 17.6 + Math.sin(x * 0.27 + 2.4) * 0.9 + Math.sin(x * 0.13 + 1) * 0.6, at: 17.6, seed: 3, gap: 0.4 },
]
const FADE = 24
const uncovered = (s: Strand) => {
  for (let f = BACK[0]; f < LOOP; f++) if (reach(f) < s.at - 0.2) return f
  return LOOP
}
const UNCOVERED = STRANDS.map(uncovered)
function band(x: number, d: number, seed: number, gap: number, bright: number, fringe = 0.36): number | undefined {
  const n = noise(x * 0.3, seed * 7.3, 0, seed)
  if (d > -1 && d <= 0 && n > gap) return shade(FOAM, bright)
  if (d > -2 && d <= -1 && n > gap + fringe) return shade(FOAM, bright - 1)
  return undefined
}
const STARFISH = ['....#....', '...###...', '#########', '.#######.', '..#####..', '.###.###.', '.##...##.']
const STAR_AT = [20, 22] as const
const isStar = (x: number, y: number) => STARFISH[y - STAR_AT[1]]?.[x - STAR_AT[0]] === '#'
const SHELLS: { x: number; y: number; art: string[] }[] = [
  { x: 8, y: 19, art: ['.###.', '#####', '.###.', '..#..'] },
  { x: 39, y: 17, art: ['.#.', '###', '##.'] },
  { x: 45, y: 20, art: ['##.', '###', '.##'] },
]
const skyLevel = (y: number) => ((y + 0.5) / HORIZON) * (SKY.length - 1)
const mirror = (y: number) => 7 - (y - LOW) * 0.36

const sheen = (y: number) => 4.4 - (y - LOW) * 0.2
const isSunPath = (x: number, y: number) => Math.abs(x - SUN_X) < 0.6 + (y - HORIZON) * 0.06
function render(): Int32Array[] {
  const frames: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const w = swell(f)
    const pool = water(f)
    const d = drain(f)
    const thick = lipThick(f)
    const isRunning = thick > 0
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {

        if (y < HORIZON) {
          const dist = Math.hypot(x - SUN_X, (y - HORIZON + 0.5) * 1.1)
          let color = shade(SKY, skyLevel(y) + clamp(1 - dist / 16) * 1.6, x, y)
          if (dist < 3.6) color = shade(SUN, dist < 2.2 ? 2 : 1)
          const isCloud = (y === 4 && x > 6 && x < 27) || (y === 6 && x > 31 && x < 57) || (y === 3 && x > 48 && x < 60) || (y === 5 && x > 10 && x < 19)
          if (isCloud) color = shade(SKY, skyLevel(y) - 1.6 + clamp(1 - Math.abs(x - SUN_X) / 18) * 3)
          c.set(x, y, color)
          continue
        }

        if (isRock(x, y)) {
          const isTop = !isRock(x, y - 1)
          const isTop2 = !isTop && !isRock(x, y - 2)
          const glow = clamp(1 - Math.abs(x - SUN_X) / 40)
          if (isTop) c.set(x, y, shade(RIM, 0.8 + glow * 2.4))
          else c.set(x, y, shade(ROCK, 2.2 + (isTop2 ? 1.2 : 0) - (y - 20) * 0.12))
          continue
        }
        const edge = edgeAt(x, f)
        if (y < LOW && y < edge) {
          let color = shade(SEA, 5.4 - (y - HORIZON) * 1.1)
          const half = 0.6 + (y - HORIZON) * 0.55
          const jog = Math.round((hash(y, f >> 2) - 0.5) * 2.4)
          if ((y + (f >> 2)) % 2 === 0 && Math.abs(x - SUN_X - jog) < half) color = shade(SUN, y < 12 ? 1 : 0)
          const steep = w.steep + Math.sin(x * 0.23 + 1) * 0.16
          if (Math.round(w.y) === y && w.steep > 0.05 && !isRunning) color = steep > 0.85 ? shade(FOAM, 1 + steep * 2) : shade(SEA, 6 - (1 - steep) * 2.4)
          if (Math.round(w.y) + 1 === y && w.steep > 0.3 && !isRunning) color = shade(SEA, 1.2)
          const lip = runFront(x, f) - y
          if (isRunning && lip > 0 && lip < 2) color = shade(FOAM, lip < 1 ? 3 : 2)
          c.set(x, y, color)
          continue
        }
        if (inBasin(x, y, 1)) {
          if (!inBasin(x, y, 0.9)) {
            const isBack = y < BASIN_Y
            c.set(x, y, isBack && !inBasin(x, y - 1, 1) ? shade(RIM, 1.4) : shade(ROCK, isBack ? 3.2 : 2.2))
            continue
          }
          const isWet = inWater(pool, x, y)
          if (isStar(x, y)) {
            const i = x - STAR_AT[0]
            const j = y - STAR_AT[1]
            const isTop = !isStar(x, y - 1)
            const isBottom = !isStar(x, y + 1)
            const lit = (isTop ? 1.3 : 0) - (isBottom ? 1.2 : 0) + (i === 4 && j === 3 ? 0.9 : 0)
            const foam = f >= 5 && f < 18 && isWet && !inWater(pool, x, y, 0.8)
            if (!foam) {
              c.set(x, y, shade(STAR, (isWet ? 1.9 : 3.6) + lit * (isWet ? 0.6 : 1)))
              continue
            }
          }
          if (!isWet) {
            const isShadow = !inBasin(x, y - 1, 0.9)
            c.set(x, y, shade(SAND, isShadow ? 1 : 2.3 - (y - BASIN_Y) * 0.15))
            continue
          }
          const t = (y - (pool.y - pool.ry)) / (2 * pool.ry)
          let color = shade(SKY, t < 0.24 ? 6 : t < 0.55 ? 3.6 : 2.4)
          const ripple = Math.hypot(x - pool.x, (y - pool.y) * 2.6)
          const settle = clamp((f - 13) / 20)
          if (settle > 0 && settle < 1 && Math.abs(ripple - settle * 16) < 0.6) color = shade(SKY, t < 0.24 ? 7.4 : 5)
          const pour = beat(f, 5, 8) * (1 - beat(f, 11, 20))
          if (pour > 0 && !inWater(pool, x, y, 0.8) && noise(x * 0.3, y * 0.6, 0, 9) < 0.25 + pour * 0.6) color = shade(FOAM, 1 + pour * 2)
          if (d > 0.05 && d < 0.95 && !inWater(pool, x, y, 0.92) && noise(x * 0.3, 0, 0, 11) > 0.45) color = shade(FOAM, 1)
          c.set(x, y, color)
          continue
        }
        if (y < edge) {
          const front = edge - y
          let color = shade(SKY, mirror(y) + (isSunPath(x, y) ? 0.8 : 0))
          if (isRunning) {
            const lip = runFront(x, f) - y
            if (lip > 0 && lip < 1) {
              if (noise(x * 0.3, 0, 0, 5) > 0.3 * (1 - thick)) color = shade(FOAM, 1 + 2 * thick)
            } else if (lip >= 1 && lip < 1 + thick) color = shade(FOAM, 1 + thick)
            else if (lip >= 1 && lip < 1 + 1.6 * thick && noise(x * 0.3, 0, 0, 4) > 0.5) color = shade(FOAM, 1)
            const gather = clamp((sinceRun(f) - 2) / 4)
            const trail = band(x, y - trailAt(x, f), 2, lerp(1, 0.24, gather), 1.4 + gather)
            if (trail !== undefined && y > LOW) color = trail
          } else {
            if (front < 1 && noise(x * 0.3, 0, 0, 5) > 0.3) color = shade(FOAM, 1)
            const trail = f < UNCOVERED[1]! ? band(x, y - (STRANDS[1]!.line(x)), 2, 0.24, 2.4) : undefined
            if (trail !== undefined) color = trail
          }
          c.set(x, y, color)
          continue
        }
        const isWetSand = y < HIGH + 1.5 + Math.sin(x * 0.31 + 0.6)
        let color = isWetSand ? shade(SKY, sheen(y) + (isSunPath(x, y) ? 1 : 0)) : shade(SAND, 3.6 - (y - 24) * 0.25)
        STRANDS.forEach((s, k) => {
          const age = mod(f - (UNCOVERED[k] ?? 0), LOOP)
          if (age >= FADE) return
          const fade = age / FADE
          const foam = band(x, y - s.line(x), s.seed, lerp(s.gap, 1.05, ease.in(fade)), 2.4 - fade * 1.2 - k * 0.3, k === 0 ? 0.36 : 1)
          if (foam !== undefined) color = foam
        })
        c.set(x, y, color)
      }
    }
    for (const s of SHELLS) {
      s.art.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
          if (row[i] !== '#') continue
          const x = s.x + i
          const y = s.y + j
          const isWet = y < edgeAt(x, f)
          if (isWet && j >= Math.round((1 - thick) * s.art.length)) continue
          const lit = (j === 0 || (s.art[j - 1]?.[i] ?? '.') !== '#' ? 0.8 : 0) - ((s.art[j + 1]?.[i] ?? '.') !== '#' ? 0.9 : 0)
          c.set(x, y, shade(SHELL, (isWet ? 1.2 : 2.3) + lit))
        }
      })
    }
    if (d > 0.98) {
      const g = mod(f - 44, LOOP)
      if (g < 3) c.set(STAR_AT[0] + 4, STAR_AT[1] + 1, STAR[6] ?? 0)
      if (g >= 1 && g < 2) {
        c.set(STAR_AT[0] + 4, STAR_AT[1], STAR[6] ?? 0)
        c.set(STAR_AT[0] + 3, STAR_AT[1] + 1, STAR[5] ?? 0)
        c.set(STAR_AT[0] + 5, STAR_AT[1] + 1, STAR[5] ?? 0)
      }
    }
    frames.push(c.px)
  }
  return frames
}
export const scene: Scene = {
  verb: 'Ebbing',
  render,
  hero: 46,
  snaps: [
    {
      frames: [2, 4],
      box: [0, 14, 63, 21],
      why: 'The wave runs up the beach: its lip of foam and the sheet of water behind it sweep the whole width of the sand at once, at the height of the run, eased in from the breaking crest and out as it slows. It is the action of the loop, so most of the beach changes each frame.',
    },
  ],
}