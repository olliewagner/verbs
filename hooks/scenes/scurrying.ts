import { clamp, ease, frames, hash, hex, lerp, mod, particles, shade, smoothstep, type Canvas, type Scene } from '../engine'

const W = 64
const LOOP = 96

const WALL = hex('0a0914 120f1e 1b1529 261c30 352434 4a3236 644433 805a36 9e743e ba8e4c')
const WOOD = hex('0a0810 140e16 20151c 2f1f20 432b25 5b3a2b 774e31 966638 b48040 d09c50 e6b868')
const FLOOR = hex('07060c 0e0b16 18121f 251a26 382529 50332c 6c4630 8a5c36 a8743e c48e4a dcaa5c efc77a')
const JAR = hex('0a0d18 101828 182438 223448 2e4858 406470')
const SACK = hex('0b0912 15111c 201a26 2c2430 3c3238 54463e 74603e')
const FUR = hex('0c0b10 1a1820 2a2730 3c3842 504b56 66606a 7e7780 989090 b4aaa6 cfc4bc e6dcd2 f6eee4')
const PINK = hex('1e0c16 3a1424 5e2234 8a3444 b44c58 d86c72 ee9290 f8bab0 fde0d4')
const CHEESE = hex('2a1606 4a2a08 70420c 9c6614 c88e20 e8b632 f8d660 fff09a fffbd8')

const SKIRT_Y = 16
const FLOOR_Y = 20
const HOLE = { x: 55, y: 20, rx: 4, ry: 7.5 }
const HOLE_IN = 52
const inHole = (x: number, y: number) => y < FLOOR_Y && ((x - HOLE.x) / HOLE.rx) ** 2 + ((y - HOLE.y) / HOLE.ry) ** 2 <= 1
const onRim = (x: number, y: number) => y < FLOOR_Y && ((x - HOLE.x) / (HOLE.rx + 1)) ** 2 + ((y - HOLE.y) / (HOLE.ry + 1)) ** 2 <= 1

const LANE = 30
const STOP = 21
const CX = 22
const CY = 22

function lampAt(x: number, y: number): number {
  const isFloor = y >= FLOOR_Y
  const left = isFloor ? 2 + (31 - y) * 0.85 : 12 + (FLOOR_Y - 1 - y) * 0.9
  const right = isFloor ? 46 + (31 - y) * 2.4 : 99
  const inside = Math.min(x - left, right - x)
  if (inside < 0) return 0
  const fall = clamp(1.3 - Math.hypot(x + 8, (y - 36) * 1.3) / 95)
  const up = isFloor ? 1 : clamp((y + 1) / 15)
  return Math.round(fall * up * (inside < 1.5 ? 0.6 : 1) * 4) / 4
}
const ADULT = {
  gather: ['.........PP...', '....lllllPpl..', '..llbbbbbbbel.', '.lbbbbbbbbbbbn', '.dbbbbbbbbbd..', '..ddddddddd...', '....ff.ff.....'],
  stretch: ['.........PP...', '..lllllllPpl..', '.lbbbbbbbbbel.', 'lbbbbbbbbbbbbn', 'dddddddddddd..', 'ff.........ff.'],
  stand: ['.........PP...', '....lllllPpl..', '..llbbbbbbbel.', '.lbbbbbbbbbbbn', '.dbbbbbbbbbd..', '..ddddddddd...', '...ff...ff....'],
  nibble: ['.........PP...', '....lllllPpl..', '..llbbbbbbbbl.', '.lbbbbbbbbbbel', '.dbbbbbbbbbbbn', '..ddddddddd...', '...ff...ff....'],
  crouch: ['.........PP...', '...llllllPpl..', '.llbbbbbbbbel.', 'lbbbbbbbbbbbbn', 'dddddddddddd..', '.ff......ff...'],
}
const BABY = {
  gather: ['.....PP...', '..lllPpl..', '.lbbbbbel.', 'lbbbbbbbbn', '.dddddddd.', '...fff....'],
  stretch: ['.....PP...', '.llllPpl..', 'lbbbbbbel.', 'dbbbbbbbbn', 'f.dddddff.'],
  stand: ['.....PP...', '..lllPpl..', '.lbbbbbel.', 'lbbbbbbbbn', '.dddddddd.', '..ff..ff..'],
  lean: ['....PP....', '.lllPpl...', '.lbbbbbel.', 'lbbbbbbbbn', '.dddddddd.', '..ff..ff..'],
  tug: ['...PP.....', '.llPpll...', 'lbbbbbbel.', 'dbbbbbbbbn', '.ff..ff...'],
  back: ['.f.....f..', '.ddddddd..', 'lbbbbbbbe.', '.lbbbbbbbn', '......PP..'],
  side: ['.llllllll.', 'lbbbbbbbe.', 'dbbbbbbbbn', '.dfdddfd..'],
}
const NIP = ['tT', 'fF']
const PRIZE = ['...tt', '.tttf', 'tffff', 'ffhff']
const PRIZE_AT: readonly [number, number] = [CX, CY + 3]
const WEDGE = [
  '.........ttT',
  '.......tttfF',
  '.....tttfffF',
  '...tttffhffF',
  '.tttfhfffhfF',
  'tffffffffffF',
  'ffhfffffhhfF',
]
const isCheese = (x: number, y: number) => {
  const ch = WEDGE[y - CY]?.[x - CX]
  return ch !== undefined && ch !== '.'
}
const CHEESE_LIT: Readonly<Record<string, readonly [number, number]>> = { t: [4, 2.8], T: [3, 1.8], f: [3, 2.4], h: [1.6, 1.4], F: [1.6, 1.8] }
const FUR_LIT: Readonly<Record<string, readonly [number, number]>> = { l: [4.4, 5.6], b: [2.8, 3.2], d: [1.2, 1.6] }
const PINK_LIT: Readonly<Record<string, readonly [number, number]>> = { P: [2.8, 2.6], p: [4, 3], n: [4.6, 3], f: [2.6, 2.6] }
type Look = {
  sprite: readonly string[]
  x: number
  y: number
  crumb?: 0 | 1 | 2
  prize?: readonly [number, number]
  strain?: number
  tail: number
  sway: number
  hide: boolean
  lift?: number
}
const home = (x: number, lane: number) => lerp(lane, FLOOR_Y, smoothstep(30, 52, x))

const dash = (d: number, speed: number, build: number) => (d < build ? (speed * d * d) / (2 * build) : speed * (d - build / 2))
const runAdult = (t: number) => (Math.floor(t / 2) % 2 ? ADULT.stretch : ADULT.gather)
const DART = [-2, 4, 9, 13, 16, 18, 19, 20, 21, 21]
const runBaby = (t: number) => (Math.floor(t / 2) % 2 ? BABY.stretch : BABY.gather)
function adult(f: number, s: number, lane: number, wait: number): Look | undefined {
  const t = mod(f - s, LOOP)
  const arrive = wait > 0 ? 12 + wait : 10
  if (t < arrive) {
    let x = DART[t] ?? STOP
    if (wait > 0) x = t < 6 ? lerp(-2, 6, ease.out(t / 6)) : t < 6 + wait ? 6 : lerp(6, STOP, ease.inOut((t - 6 - wait) / 6))
    const isFrozen = wait > 0 && t >= 6 && t < 6 + wait
    const sprite = isFrozen ? ((t - 6) % 3 === 1 ? ADULT.nibble : ADULT.stand) : runAdult(t)
    return { sprite, x: Math.round(x), y: lane, tail: t * (isFrozen ? 0.3 : 1), sway: isFrozen ? 1 : 1.4, hide: false }
  }
  const u = t - arrive
  if (u < 5) return { sprite: u % 2 ? ADULT.nibble : ADULT.stand, x: STOP, y: lane, crumb: u >= 3 ? 1 : 0, tail: t * 0.3, sway: 1, hide: false }
  if (u < 7) return { sprite: ADULT.crouch, x: STOP - 1, y: lane, crumb: 1, tail: t * 0.3, sway: 0.6, hide: false }
  const x = STOP - 1 + dash(u - 7, 3.2, 3)
  if (x >= 75) return undefined
  return { sprite: runAdult(u - 7), x: Math.round(x), y: Math.round(home(x, lane)), crumb: 1, tail: t * 1.6, sway: 0.8, hide: true }
}
const TUMBLE: readonly (readonly [readonly string[], number, number, number, number])[] = [
  [BABY.stretch, 17, LANE - 2, 17, 23],
  [BABY.stretch, 17, LANE - 3, 15, 21],
  [BABY.stretch, 16, LANE - 3, 13, 20],
  [BABY.side, 16, LANE - 2, 11, 21],
  [BABY.back, 16, LANE, 9, 23],
  [BABY.back, 16, LANE, 9, 23],
  [BABY.back, 16, LANE, 9, 23],
  [BABY.side, 16, LANE, 11, 24],
  [BABY.stretch, 15, LANE, 14, 25],
]
function baby(f: number): Look | undefined {
  const t = mod(f - 20, LOOP)
  if (t < 22) {
    const isFrozen = t >= 8 && t < 14
    const x = t < 8 ? lerp(-2, 4, ease.out(t / 8)) : t < 14 ? 4 : lerp(4, STOP, ease.inOut((t - 14) / 8))
    const sprite = isFrozen ? ((t - 8) % 3 === 2 ? BABY.gather : BABY.stand) : runBaby(t)
    return { sprite, x: Math.round(x), y: LANE, tail: t * (isFrozen ? 0.3 : 1), sway: 1.2, hide: false }
  }
  const k = t - 22
  if (k < 12) {
    const pose = 'SSLTTLLTTTTT'[k] ?? 'S'
    const pull = [0, 0, 0, 1, 1, 0, 0, 1, 1, 2, 2, 3][k] ?? 0
    const prize = [PRIZE_AT[0] - pull, PRIZE_AT[1]] as const
    const sprite = pose === 'T' ? BABY.tug : pose === 'L' ? BABY.lean : BABY.stand
    return { sprite, x: STOP - pull, y: LANE, crumb: 2, prize, strain: pull, tail: k * 0.5, sway: 1, hide: false }
  }
  if (k < 21) {
    const [sprite = BABY.stand, x = 15, y = LANE, px = 14, py = 25] = TUMBLE[k - 12] ?? []
    return { sprite, x, y, crumb: 2, prize: [px, py], tail: k * 1.4, sway: k < 16 ? 2 : 1.4, hide: false }
  }
  const d = k - 21
  const x = 15 + dash(d + 1, 3, 4) - dash(1, 3, 4)
  if (x >= 68) return undefined
  const sprite = runBaby(d)
  return { sprite, x: Math.round(x), y: Math.round(home(x, LANE)), lift: sprite === BABY.stretch ? 1 : 0, crumb: 2, tail: 28 + (d + 1) * 1.2, sway: 0.9, hide: true }
}
function drawMouse(c: Canvas, m: Look, isBaby: boolean): void {
  const h = m.sprite.length
  const w = Math.max(...m.sprite.map(r => r.length))
  const x0 = m.x - w + 1
  const body = m.y - (m.lift ?? 0)
  const y0 = body - h + 1
  const visible = (x: number, y: number) => !(m.hide && x >= HOLE_IN && y <= FLOOR_Y)
  const floorShadow = (x: number, y: number) => {
    if (y >= FLOOR_Y && visible(x, y) && !isCheese(x, y)) c.set(x, y, shade(FLOOR, 1.4 + lampAt(x, y) * 4.2, x, y))
  }

  const isUpright = m.sprite !== BABY.back
  for (let x = x0 + 1; x <= m.x + 1; x++) floorShadow(x, m.y)
  const len = isBaby ? 7 : 10
  const tail: [number, number][] = []
  for (let i = 0; i <= len; i++) {
    const swing = Math.sin(m.tail * 0.8 - i * 0.6) * m.sway * (i / len)
    tail.push([x0 - i, Math.min(m.y, Math.round(body - 2 + Math.min(1.6, i * 0.35) + swing))])
  }
  for (const [x, y] of tail) if (isUpright && y < m.y) floorShadow(x, y + 1)
  tail.forEach(([x, y], i) => {
    const prev = tail[i - 1]
    const paint = (px: number, py: number) => {
      if (visible(px, py)) c.set(px, py, shade(PINK, 3.4 + lampAt(px, py) * 3 - i * 0.07, px, py))
    }
    paint(x, y)
    if (prev && Math.abs(prev[1] - y) > 1) paint(x, (prev[1] + y) / 2)
  })
  m.sprite.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i] ?? '.'
      const x = x0 + i
      const y = y0 + j
      if (ch === '.' || !visible(x, y)) continue
      const lit = lampAt(x, y)
      const fur = FUR_LIT[ch]
      const pink = PINK_LIT[ch]
      if (ch === 'e') c.set(x, y, 0x07060c)
      else if (fur) c.set(x, y, shade(FUR, fur[0] + lit * fur[1], x, y))
      else if (pink) c.set(x, y, shade(PINK, pink[0] + lit * pink[1], x, y))
    }
  })
  if (!m.crumb) return
  const art = m.crumb === 1 ? NIP : PRIZE
  const noseRow = m.sprite.findIndex(r => r.includes('n'))
  const [ax, ay] = m.prize ?? (!isUpright ? [x0 + 2, y0 - 3] : m.crumb === 1 ? [m.x + 1, y0 + noseRow] : [m.x + 1, y0 + noseRow - 2])
  art.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const lv = CHEESE_LIT[row[i] ?? '.']
      const x = ax + i
      const y = ay + j
      if (lv && visible(x, y)) c.set(x, y, shade(CHEESE, lv[0] + lampAt(x, y) * lv[1], x, y))
    }
  })
  if (m.strain) {
    const x = ax + 5
    for (let y = ay; y < ay + PRIZE.length; y++) if (isCheese(x, y)) c.set(x, y, shade(CHEESE, 0.6, x, y))
  }
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    c.fill((x, y) => {
      const lit = lampAt(x, y)
      if (y < SKIRT_Y) return shade(WALL, 1.6 + lit * 6.8 - (x % 12 === 5 ? 1 : 0), x, y)
      if (y < FLOOR_Y) {
        const k = y - SKIRT_Y
        return shade(WOOD, ([3.4, 2.4, 2.2, 1.2][k] ?? 2) + lit * ([6.4, 5.6, 5.4, 4.2][k] ?? 5), x, y)
      }
      const isSeam = y === 23 || y === 27
      const plank = y < 23 ? 0 : y < 27 ? 1 : 2
      const isJoint = mod(x + plank * 17, 26) === 0
      return shade(FLOOR, 2.2 + lit * 7.8 - (isSeam || isJoint ? 1.1 : 0), x, y)
    })
    for (let x = 0; x < W; x++) {
      c.set(x, 5, shade(WOOD, 2.4 + lampAt(x, 5) * 5, x, 5))
      c.set(x, 6, shade(WOOD, 0.8, x, 6))
    }
    const jars: [number, number, number][] = [[3, 0, 4], [14, 1, 3], [29, 0, 5], [36, 2, 3], [46, 0, 4], [56, 1, 5]]
    for (const [jx, jy, jw] of jars) {
      for (let y = jy; y < 5; y++) {
        for (let x = jx; x < jx + jw; x++) {
          const lit = lampAt(x, y)
          const isLid = y === jy
          const glint = x === jx && y === jy + 1 ? 1 : 0
          c.set(x, y, isLid ? shade(WOOD, 1.6 + lit * 4, x, y) : shade(JAR, 1.2 + lit * 4 + glint - (x === jx + jw - 1 ? 0.8 : 0), x, y))
        }
      }
    }
    c.poly([[0, 19.5], [1, 11], [4, 8.5], [8, 9], [10, 12], [11, 19.5]], (x, y) => shade(SACK, 2 + lampAt(x, y) * 4 + (x > 8 ? -0.7 : 0) + (y < 11 ? 0.8 : 0), x, y))
    for (let x = 3; x <= 6; x++) c.set(x, 10, shade(SACK, 1.2, x, 10))
    for (const p of particles(f, LOOP, 7, 56, 3)) {
      const x = Math.round(16 + p.r[1] * 34 + Math.sin(p.t * 0.12 + p.r[2] * 6) * 2)
      const y = Math.round(3 + p.r[3] * 12 + p.t * 0.06)
      if (lampAt(x, y) >= 0.5 && p.age > 0.1 && p.age < 0.9 && hash(p.i, 1) < 0.9) c.set(x, y, shade(WALL, 9, x, y))
    }
    for (let y = 10; y < FLOOR_Y; y++) {
      for (let x = 49; x <= 61; x++) {
        if (inHole(x, y)) c.set(x, y, 0x020105)
        else if (onRim(x, y)) c.set(x, y, shade(WOOD, (x < HOLE.x ? 3.4 : 4.6) + lampAt(x, y) * 5, x, y))
      }
    }
    const peek = mod(f - 86, LOOP)
    if (peek < 12 && peek !== 5 && peek !== 6) {
      const ex = peek < 9 ? 54 : 53
      c.set(ex, 16, 0xf4e2a0)
      c.set(ex + 2, 16, 0xf4e2a0)
    }
    c.poly([[34, 28.5], [34, 23.5], [40, 25.5], [43, 28.5]], (x, y) => shade(FLOOR, 1.6 + lampAt(x, y) * 4.6, x, y))
    for (let x = CX; x <= CX + 12; x++) c.set(x, 29, shade(FLOOR, 1.6 + lampAt(x, 29) * 4.6, x, 29))
    const mice: [Look, boolean][] = []
    for (const look of [adult(f, 0, LANE, 0), adult(f, 9, LANE - 1, 6)]) if (look) mice.push([look, false])
    const small = baby(f)
    if (small) mice.push([small, true])
    const isBehind = (m: Look) => m.y < 29 && !m.hide
    mice.sort((a, b) => a[0].y - b[0].y)
    for (const [m, isBaby] of mice) if (isBehind(m)) drawMouse(c, m, isBaby)
    WEDGE.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const lv = CHEESE_LIT[row[i] ?? '.']
        const x = CX + i
        const y = CY + j
        if (lv) c.set(x, y, shade(CHEESE, lv[0] + lampAt(x, y) * lv[1] - (j === 6 ? 0.6 : 0), x, y))
      }
    })
    const pop = mod(f - 54, LOOP)
    if (pop < 7) {
      for (const [vx, vy] of [[-1, -1.5], [0.6, -1.9], [1.3, -1.1], [-0.3, -2.2]] as const) {
        const x = Math.round(25 + vx * pop)
        const y = Math.round(26 + vy * pop + 0.36 * pop * pop)
        if (y <= 30) c.set(x, y, shade(CHEESE, 5 + lampAt(x, y) * 2, x, y))
      }
    }
    for (const [m, isBaby] of mice) if (!isBehind(m)) drawMouse(c, m, isBaby)
  })
}
export const scene: Scene = {
  verb: 'Scurrying',
  render,
  hero: 75,
  snaps: [{ frames: 76, box: [49, 18, 51, 20], colors: [...CHEESE.slice(5, 7), 0x9c6614], why: 'the prize goes into the hole ahead of the smallest mouse, its last sliver cut off at the edge' }],
}