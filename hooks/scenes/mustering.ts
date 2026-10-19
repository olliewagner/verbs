import { beat, clamp, ease, frames, hex, mix, mod, noise, type Canvas, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const SKY = hex('1d2416 2a321c 3a4222 4f5428 6a6a30 8a8238')
const BOKEH = hex('8a7e38 b09a42 d0b450 ecd47a')
const GROUND = hex('2c2630 3e3438 54463e 6e5c4a 887258 a28a66 bca276 d4b886 e8cc98')
const SHADOW = 0x3a3046
const ANT = hex('0a0608 160d0e 251614 4a2a1a 7a4424 c08040')
const COOKIE = hex('3a1e0e 5c3216 80481e a4642a c4843a dca452 eec474 f8e0a0')
const CHOC = hex('1a0c08 2e1610 4a2418 6a3420')
const GRASS = hex('142010 1f3416 2e4c1c 46682a 6e8c34 a8b448')

const HORIZON = 9
const GY = 24
const CRUMB_X = 33
const MOUTH = { x: 9, y: GY }

const CRUMB = [
  '.....xxxxxx.......',
  '...xxxxxxxxxxx....',
  '.xxxxxxxxxxxxxxx..',
  'xxxxxxxxxxxxxxxxx.',
  'xxxxxxxxxxxxxxxxxx',
  'xxxxxxxxxxxxxxxxxx',
  '.xxxxxxxxxxxxxxxx.',
  '...xxxxxxxxxxxx...',
]
const CHIPS = [[4, 2], [5, 2], [4, 3], [11, 1], [12, 1], [13, 4], [14, 4], [13, 5], [8, 5], [9, 5]] as const
const CRUMB_W = 18
const CRUMB_H = CRUMB.length

const ANT_BODY = ['.......a.', '.gg...hh.', 'gggg.tthh']
const LEGS = ['..l..l..l', '...l.l.l.']

type Ant = { x: number; y: number; facing: 1 | -1; walking: boolean; clip: boolean; twitch: boolean }

const RING: [number, number, 1 | -1][] = [[17, 0, -1], [9, 3, -1], [0, 4, 1], [-9, 3, 1], [-16, 0, 1]]
const CARRY: [number, number][] = [[17, 1], [5, -1], [-5, -1], [2, 1], [-8, 1]]
const SPEED = 1.5
const emerge = (i: number) => 4 + i * 6
const TUCK_AT = 42
const LIFT_AT = 48
const CARRY_AT = 56
const CARRY_END = 80
const DROP_AT = 68
const LAND_AT = 76
const PEEK_AT = 86
const FALL = [-24, -21, -18, -15, -12, -9, -6, -3]
const BOUNCE = [0, 0, -1, -2, -3, -3, -2, -1, 0]

function antAt(i: number, f: number): Ant | undefined {
  const [rx, ry, face] = RING[i] ?? [0, 0, 1]
  const ring = { x: CRUMB_X + rx, y: GY + ry }
  const [cx, cy] = CARRY[i] ?? [0, 0]
  if (i === 0 && (f >= PEEK_AT || f < emerge(0))) {
    const peek = f >= PEEK_AT ? Math.min(3, Math.floor((f - PEEK_AT) / 2)) : 3
    return { x: MOUTH.x - 4 + peek, y: MOUTH.y, facing: 1, walking: false, clip: true, twitch: mod(f, 6) < 3 }
  }
  if (f < emerge(i)) return undefined
  if (f < TUCK_AT) {
    const start = { x: MOUTH.x - (i === 0 ? 1 : 4), y: MOUTH.y }
    const dist = Math.hypot(ring.x - start.x, ring.y - start.y)
    const s = (f - emerge(i)) * SPEED
    if (s < dist) {
      const t = s / dist
      const y = start.y + (ring.y - start.y) * clamp(t * 1.8 - 0.3)
      return { x: start.x + (ring.x - start.x) * t, y, facing: ring.x >= start.x ? 1 : -1, walking: true, clip: s < 8, twitch: false }
    }
    return { x: ring.x, y: ring.y, facing: face, walking: false, clip: false, twitch: mod(f + i * 3, 7) < 3 }
  }
  const b = beat(f, TUCK_AT, LIFT_AT + 1)
  const tuck = b * b * (3 - 2 * b)
  const x = ring.x + (CRUMB_X + cx - ring.x) * tuck + carried(f) * (i === 0 ? 1.08 : 1)
  const y = ring.y + (GY + cy - ring.y) * tuck
  if (x > W + 6) return undefined
  const isTucking = tuck > 0 && tuck < 1 && Math.abs(CRUMB_X + cx - ring.x) > 2
  const isMoving = isTucking || f >= CARRY_AT
  return { x, y, facing: tuck > 0.4 ? 1 : face, walking: isMoving, clip: false, twitch: i === 0 && f >= LIFT_AT && f < CARRY_AT && mod(f, 4) < 2 }
}

const carried = (f: number) => (f < CARRY_AT ? 0 : 50 * ease.in(beat(f, CARRY_AT, CARRY_END)) ** 0.75)

function lift(f: number): number {
  if (f < LIFT_AT || f >= CARRY_END + 2) return 0
  const up = [1, 3, 5, 4][f - LIFT_AT] ?? 4
  return up - (f >= CARRY_AT && mod(f, 4) < 2 ? 1 : 0)
}

function drawAnt(c: Canvas, a: Ant, f: number) {
  const left = Math.round(a.x) - 4
  const top = Math.round(a.y) - 3
  const rows = [...ANT_BODY, LEGS[a.walking ? mod(Math.floor(f / 2), 2) : 0] ?? '']
  const width = 9
  rows.forEach((row, j) => {
    for (let k = 0; k < width; k++) {
      const i = a.facing === 1 ? k : width - 1 - k
      const ch = row[i]
      if (ch === '.' || ch === undefined) continue
      let x = left + k
      if (ch === 'a' && a.twitch) x += a.facing
      if (a.clip && x < MOUTH.x - 1) continue
      const isTop = (rows[j - 1]?.[i] ?? '.') === '.'
      const level = ch === 'l' || ch === 'a' ? 1.4 : isTop && ch !== 't' ? 3 : 1
      const isGlint = ch === 'g' && j === 1 && i === 2
      c.set(x, top + j, isGlint ? ANT[5] ?? 0 : ANT[Math.round(level)] ?? 0)
    }
  })
}

function drawCrumb(c: Canvas, x0: number, bottom: number, squash: number) {
  const w = CRUMB_W + squash * 2
  const h = CRUMB_H - squash
  for (let j = 0; j < h; j++) {
    const sj = Math.min(CRUMB_H - 1, Math.round((j / h) * CRUMB_H))
    const src = CRUMB[sj] ?? ''
    for (let i = 0; i < w; i++) {
      const si = Math.min(CRUMB_W - 1, Math.floor((i / w) * CRUMB_W))
      if (src[si] !== 'x') continue
      const isTop = (CRUMB[sj - 1]?.[si] ?? '.') !== 'x'
      const isLeft = src[si - 1] !== 'x'
      const isRight = src[si + 1] !== 'x'
      const isBottom = j === h - 1 || (CRUMB[sj + 1]?.[si] ?? '.') !== 'x'
      let level = 4.8 - (si / CRUMB_W) * 1.8 - (sj / CRUMB_H) * 1.6
      if (isTop) level += 1.6
      if (isLeft) level += 0.8
      if (isRight || isBottom) level -= 1.3
      const x = Math.round(x0 - squash) + i
      const y = Math.round(bottom) - h + 1 + j
      const chip = CHIPS.some(([cx, cy]) => cx === si && cy === sj)
      c.set(x, y, chip ? CHOC[isTop ? 3 : si > 9 ? 0 : 1] ?? 0 : COOKIE[Math.round(clamp(level, 0, 7))] ?? 0)
    }
  }
}

function castShadow(c: Canvas, x0: number, w: number, height: number, lifted: number, gy: number, rows = 1) {
  const start = Math.round(x0 + lifted * 1.5)
  const end = Math.round(x0 + w + (height + lifted) * 1.5)
  for (let x = start; x <= end; x++) {
    const taper = (x - start) / Math.max(1, end - start)
    for (let dy = -rows; dy <= rows; dy++) {
      if (Math.abs(dy) === rows && rows > 0 && (taper > 0.6 || taper < 0.05)) continue
      if (x < 0 || x >= W || gy + dy <= HORIZON || gy + dy >= H) continue
      c.set(x, gy + dy, mix(c.get(x, gy + dy), SHADOW, 0.5))
    }
  }
}

function garden(c: Canvas) {
  for (let y = 0; y < HORIZON; y++) {
    for (let x = 0; x < W; x++) {
      const n = noise(x * 0.09, y * 0.2, 0, 4)
      c.set(x, y, SKY[Math.round(clamp(1 + n * 2.4 + y * 0.18, 0, 5))] ?? 0)
    }
  }
  for (const [bx, by, r, l] of [[7, 3, 3.6, 0], [23, 2, 3, 1], [38, 4, 4.2, 0], [53, 2, 3.4, 1], [62, 6, 3, 0]] as const) {
    for (let y = Math.floor(by - r); y <= Math.ceil(by + r); y++) {
      for (let x = Math.floor(bx - r); x <= Math.ceil(bx + r); x++) {
        const d = Math.hypot(x - bx, y - by) / r
        if (d <= 1 && y < HORIZON && y >= 0) c.set(x, y, mix(c.get(x, y), BOKEH[d > 0.78 ? l + 1 : l] ?? 0, 0.45))
      }
    }
  }
}

function ground(c: Canvas) {
  for (let y = HORIZON; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const depth = (y - HORIZON) / (H - HORIZON)
      const n = noise(x * 0.1, y * 0.32, 0, 11)
      const level = 7.7 - depth * 3.4 + (n - 0.5) * 0.9 + (y === HORIZON ? 0.6 : 0)
      c.set(x, y, GROUND[Math.round(clamp(level, 0, 8))] ?? 0)
    }
  }
  for (const [px, py] of [[22, 14], [47, 12], [56, 28], [42, 30], [19, 29], [59, 17], [30, 11]] as const) {
    const near = (py - HORIZON) / (H - HORIZON)
    c.set(px, py, GROUND[Math.round(7.4 - near * 2.6)] ?? 0)
    c.set(px + 1, py, GROUND[Math.round(5 - near * 2.6)] ?? 0)
    c.set(px + 2, py, mix(c.get(px + 2, py), SHADOW, 0.4))
  }
  const path = [[4, HORIZON], [6, 12], [5, 15], [8, 18], [8, 21], [7, 25], [10, 27], [11, 29], [14, 31]] as const
  for (let k = 0; k + 1 < path.length; k++) {
    const [ax, ay] = path[k] ?? [0, 0]
    const [bx, by] = path[k + 1] ?? [0, 0]
    c.line(ax + 1, ay, bx + 1, by, GROUND[7] ?? 0)
    c.line(ax, ay, bx, by, GROUND[0] ?? 0)
  }
  for (let y = 22; y <= 24; y++) {
    for (let x = 5; x <= 11; x++) {
      const d = Math.hypot((x - 8) / 3.2, (y - 23.2) / 1.4)
      if (d <= 1) c.set(x, y, d > 0.7 && y < 23 ? GROUND[2] ?? 0 : GROUND[0] ?? 0)
    }
  }
  for (let x = 6; x <= 10; x++) c.set(x, 25, GROUND[7] ?? 0)
}

function tufts(c: Canvas, f: number) {
  const clumps = [[6, 13, [[-2, 3], [0, 5], [2, 4]]], [11, 30, [[-3, 4], [-1, 7], [1, 6], [3, 4]]]] as const
  for (const [bx, by, blades] of clumps) {
    for (const [lean, h] of blades) {
      const sway = Math.sin((f / LOOP) * Math.PI * 2 * 3 + bx + lean) * 0.7
      for (let k = 0; k < h; k++) {
        const t = k / h
        c.set(bx + lean * t * 0.7 + sway * t * t, by - k, GRASS[k === h - 1 ? 5 : Math.round(1 + t * 3)] ?? 0)
      }
    }
  }
}

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    garden(c)
    ground(c)

    const lifted = lift(f)
    const isCarried = f >= TUCK_AT && f < CARRY_END + 2
    const oldX = CRUMB_X - CRUMB_W / 2 + carried(f)
    const restX = CRUMB_X - CRUMB_W / 2
    const isDropping = f >= DROP_AT
    const fallY = f < LAND_AT ? FALL[f - DROP_AT] ?? 0 : 0
    const bounce = f >= LAND_AT ? BOUNCE[f - LAND_AT] ?? 0 : 0
    const squash = f === LAND_AT || f === LAND_AT + 8 ? 1 : 0

    const ants = RING.map((_, i) => antAt(i, f)).filter((a): a is Ant => a !== undefined)

    if (!isCarried && !isDropping) castShadow(c, restX, CRUMB_W, CRUMB_H, 0, GY)
    if (isCarried) castShadow(c, oldX, CRUMB_W, CRUMB_H, lifted, GY)
    if (isDropping && fallY + bounce > -26) castShadow(c, restX + 1, CRUMB_W - 2, CRUMB_H, -(fallY + bounce), GY)
    for (const a of ants) if (!a.clip) castShadow(c, a.x - 2, 5, 2, 0, Math.round(a.y), 0)

    tufts(c, f)

    const items: { depth: number; draw: () => void }[] = ants.map(a => ({ depth: a.y, draw: () => drawAnt(c, a, f) }))
    if (!isCarried && !isDropping) items.push({ depth: GY + 0.5, draw: () => drawCrumb(c, restX, GY, 0) })
    if (isCarried) items.push({ depth: GY + 0.5, draw: () => drawCrumb(c, oldX, GY - lifted, 0) })
    if (isDropping) items.push({ depth: GY + 0.6, draw: () => drawCrumb(c, restX, GY + fallY + bounce, squash) })
    items.sort((p, q) => p.depth - q.depth)
    for (const it of items) it.draw()

    for (const [at, span] of [[LIFT_AT, 11], [LAND_AT, 10]] as const) {
      const t = f - at
      if (t < 0 || t >= 6) continue
      for (const side of [-1, 1]) {
        for (let k = 0; k < 2; k++) {
          const x = CRUMB_X + side * (span + k * 2 + t * (0.9 + k * 0.4))
          const y = GY + 1 - k - t * 0.5
          if (t < 5 - k) c.tint(x, y, GROUND[8] ?? 0, t < 2 ? 0.8 : 0.5)
        }
      }
    }

    if (f >= LAND_AT && f < LAND_AT + 8) {
      const t = f - LAND_AT
      for (const [vx, vy, k] of [[-1.5, -1.8, 0], [1.7, -1.3, 1], [0.7, -2.2, 2]] as const) {
        const x = CRUMB_X + (k - 1) * 4 + vx * Math.min(t, 6) * 1.3
        const y = Math.min(GY + 1 - k, GY - 2 + vy * t + 0.5 * t * t)
        c.set(x, y, COOKIE[5 - k] ?? 0)
      }
    }
  })
}

export const scene: Scene = { verb: 'Mustering', render, hero: 53 }
