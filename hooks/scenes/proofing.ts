import { beat, frames, hash, hex, mix, mod, shade, TAU, type Canvas, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const BED = hex('0e1116 141820 1b2029 232a35 2d3542 3a4352 4b5566 606b7e')
const STEEL = hex('17161d 25232c 37343f 4d4957 6a6574 8e8796 b8b0bc e2dad8')
const WOOD = hex('2e1a10 4a2c1a 6a4228 8c5c38 ac7a4c c99a64 e0ba82 f2d6a6')
const HANDLE = hex('2a170e 452815 66401f 8a5a2c b07a3e')
const GLASS = hex('121a1a 1a2626 233434 2e4442')
const RED = hex('3e0c10 6e1816 a2261c cc3f28 e86342 fb9a72 ffd0b4')
const TEAL = hex('08242a 0f3c42 175a5e 207a7a 359e98 64c4b8 b0eade')
const PAPER = hex('5e5648 8e8270 b8ab92 d8cdb2 ece2c8 f8f0dc fffaee')

const PRINT = [
  '................',
  '..........RRR...',
  '.........RRRR...',
  '........RRR.RR..',
  '........RRRRRRRR',
  '.......RRRRRRR..',
  '......RRRRRRRR..',
  '....RRRRR..RRRR.',
  '..RRRRR..RRRRRR.',
  'RRRRR..RRRRRRR..',
  'RR....RRRRRRR...',
  '.........T.T...T',
  'TTTTTTTTTTTTTTT.',
  '...TT.....TT..TT',
  '..TTT....TTT...T',
  '..T......TT.....',
]
const N = 16

const BX = 15
const BY = 8
const SX0 = 13
const SX1 = 32
const SY0 = 6
const SY1 = 25
const SPLIT = BY + 11
const SLAB_X = 5
const PARK_X0 = 56

function printInk(px: number, py: number): number {
  const ch = PRINT[py]?.[px]
  return ch === 'R' ? 1 : ch === 'T' ? 2 : 0
}
function blockInk(x: number, y: number): number {
  const bx = x - BX
  const by = y - BY
  if (bx < 0 || bx >= N || by < 0 || by >= N) return 0
  return printInk(N - 1 - bx, by)
}
const isBlock = (x: number, y: number) => x >= BX && x < BX + N && y >= BY && y < BY + N

const run = (n: number, step: number): number[] => Array.from({ length: n }, () => step)

function charted(k: number, steps: readonly number[]): number {
  let at = 0
  for (let i = 0; i < Math.min(k, steps.length); i++) at += steps[i] ?? 0
  return at
}

const ROLL = 81
const ROLLER = [1, 1, 0, 0, -1, -1, -1, -1, 0, 0, 1, 1, 1, 1, ...[...run(6, 1), ...run(6, 2), 1, 1, 1], 0, 0, ...[-1, -1, ...run(8, -2), ...run(5, -1)]]
const PASS_OUT = 0
const PASS_BACK = 15
const SHEET_IN = 29
const SHEET = [...run(10, 2), ...run(6, 1)]
const SHEET_DOWN = SHEET_IN + SHEET.length
const PRESS = 33
const PRESS_X = [-1, -1, ...run(21, -2), -1, -1, 0, 0, 1, 1, ...run(21, 2), 1, 1]
const PRESS_TURN = PRESS + 27
const PEEL = 63
const PEEL_LIFT = 2
const PEEL_DONE = PEEL + PEEL_LIFT + 20
const GLINT = 83
const LIFT = 92
const LIFT_Y = [1, 1, 1, 1, ...run(11, 2)]
const LIFT_X = [0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0]
const GONE = LIFT + LIFT_Y.length

const rollerX = (f: number) => SLAB_X + charted(mod(f - ROLL, LOOP), ROLLER)

const cylinderX0 = (f: number) => PARK_X0 + charted(mod(f - PRESS, LOOP), PRESS_X)

const sheetLift = (f: number) => 1 - charted(f - SHEET_IN, SHEET) / 26

const inkRamp = (ink: number) => (ink === 1 ? RED : TEAL)

const RAMP_OF = new Map<number, readonly number[]>()
for (const r of [BED, STEEL, WOOD, HANDLE, GLASS, RED, TEAL, PAPER]) for (const col of r) RAMP_OF.set(col, r)

const SHADED = new Map<number, readonly number[]>()
function showThrough(level: number, ink: number, x: number, y: number): number {
  const at = (k: number) => mix(shade(PAPER, level - k, x, y), shade(inkRamp(ink), 3 - k, x, y), 0.16)
  const col = at(0)
  if (!SHADED.has(col)) SHADED.set(col, [col, at(1), at(2)])
  return col
}

function darken(c: Canvas, x: number, y: number, steps: number) {
  const col = c.get(x, y)
  const r = RAMP_OF.get(col)
  const s = SHADED.get(col)
  if (r) c.set(x, y, r[Math.max(0, r.indexOf(col) - steps)] ?? col)
  else if (s) c.set(x, y, s[steps] ?? col)
  else c.tint(x, y, 0x05060a, 0.22 * steps)
}

const lamp = (x: number, y: number) => Math.max(0, 1 - Math.hypot(x - 22, (y - 10) * 1.4) / 46)

function drawBed(c: Canvas) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const isRail = y <= 1 || y >= H - 2
      const level = isRail ? 3.6 + lamp(x, y) * 2.4 - (y === 1 || y === H - 1 ? 1 : 0) : 1.6 + lamp(x, y) * 3
      c.set(x, y, shade(BED, level, x, y))
    }
  }
  for (let x = 2; x < W; x += 4) {
    c.set(x, H - 2, shade(BED, x % 16 === 2 ? 6.6 : 5.4, x, H - 2))
    if (x % 16 === 2) c.set(x, H - 1, shade(BED, 5.8, x, H - 1))
    c.set(x, 0, shade(BED, 5, x, 0))
  }
  for (let y = 4; y <= 27; y++) {
    for (let x = 0; x <= 10; x++) {
      const isEdge = x === 10 || y === 4 || y === 27
      if (isEdge) {
        c.set(x, y, shade(GLASS, y === 4 ? 3 : 1, x, y))
        continue
      }
      const isInk = y >= 6 && y <= 25 && x >= 1 && x <= 9
      if (!isInk) {
        c.set(x, y, shade(GLASS, 2, x, y))
        continue
      }
      const ink = y < SPLIT ? 1 : 2
      const sheen = hash(Math.floor(x / 2), Math.floor(y / 2), 5) > 0.72 ? 0.7 : 0
      c.set(x, y, shade(inkRamp(ink), 2.2 + sheen + lamp(x, y) * 1.2, x, y))
    }
  }
  for (let y = SY0; y <= SY1; y++) {
    for (let x = SX0; x <= SX1; x++) {
      if (isBlock(x, y)) continue
      const isQuoin = x >= BX + N && y >= 13 && y <= 18
      const lit = lamp(x, y) * 2
      if (isQuoin) c.set(x, y, shade(STEEL, 3 + lit + (y === 13 ? 1 : 0), x, y))
      else c.set(x, y, shade(WOOD, 1.6 + lit + (y === SY0 || x === SX0 ? 0.8 : 0) - ((x - SX0) % 6 === 5 && y > SY0 && y < SY1 ? 0.8 : 0), x, y))
    }
  }
}

function drawBlock(c: Canvas, isGlossy: (x: number) => boolean) {
  for (let y = BY; y < BY + N; y++) {
    for (let x = BX; x < BX + N; x++) {
      const ink = blockInk(x, y)
      const lit = lamp(x, y) * 1.6
      if (ink) {
        const ramp = inkRamp(ink)
        const isRim = !blockInk(x - 1, y) || !blockInk(x, y - 1)
        if (isGlossy(x)) c.set(x, y, shade(ramp, 2.5 + lit + (isRim ? 1.3 : 0), x, y))
        else c.set(x, y, mix(shade(ramp, 1.8 + lit * 0.5, x, y), shade(WOOD, 3, x, y), 0.25))
        continue
      }
      const isUnder = blockInk(x - 1, y) || blockInk(x, y - 1)
      const isFacing = blockInk(x + 1, y) || blockInk(x, y + 1)
      const edge = x === BX || y === BY ? 1 : 0
      c.set(x, y, shade(WOOD, 3.2 + lit + edge - (isUnder ? 1.6 : 0) + (isFacing && !isUnder ? 0.6 : 0), x, y))
    }
  }
}

function printColor(px: number, py: number, glint: number, sx: number, sy: number): number {
  const ink = printInk(px, py)
  if (!ink) {
    const bite = printInk(px - 1, py) || printInk(px, py - 1)
    return shade(PAPER, bite ? 4.2 : 5, sx, sy)
  }
  const ramp = inkRamp(ink)
  const edge = !printInk(px + 1, py) || !printInk(px, py + 1) ? -0.5 : 0
  const shine = Math.abs(sx + sy * 0.6 - glint) < 2.2 ? 1.6 : 0
  return shade(ramp, 3 + edge + shine, sx, sy)
}

function drawRoller(c: Canvas, f: number) {
  const x0 = Math.round(rollerX(f)) - 1
  for (let y = 6; y <= 27; y++) {
    darken(c, x0 + 4, y, 2)
    darken(c, x0 + 5, y, 1)
  }
  for (let y = 0; y < H; y++) {
    if (y < 5 || y > 26) {
      for (let i = 1; i <= 2; i++) c.set(x0 + i, y, shade(HANDLE, (i === 1 ? 3.4 : 2) + (y % 4 === 0 ? -0.8 : 0), x0, y))
      continue
    }
    if (y === 5 || y === 26) {
      for (let i = 0; i < 4; i++) c.set(x0 + i, y, shade(STEEL, i === 0 ? 5 : 3 - i * 0.4, x0, y))
      continue
    }
    const ramp = inkRamp(y < SPLIT ? 1 : 2)
    for (let i = 0; i < 4; i++) {
      const level = [3.8, 3, 2.1, 1.2][i] ?? 2
      c.set(x0 + i, y, shade(ramp, level + (i === 0 && y % 5 === 1 ? 1.4 : 0), x0, y))
    }
  }
}

function drawCylinder(c: Canvas, f: number) {
  const x0 = cylinderX0(f)
  const v = x0 - cylinderX0(mod(f - 1, LOOP))
  for (let y = 0; y < H; y++) {
    darken(c, x0 + 7, y, 2)
    darken(c, x0 + 8, y, 1)
  }
  const isRolling = Math.abs(v) >= 0.5
  for (let y = 0; y < H; y++) {
    const isBearer = y <= 1 || y >= H - 2
    for (let i = 0; i < 7; i++) {
      const level = [4.6, 5.4, 4.4, 3.6, 2.8, 2.1, 1.2][i] ?? 3
      const knurl = !isBearer ? 0 : isRolling ? -0.7 : i % 2 === 0 ? -1.4 : 0
      c.set(x0 + i, y, shade(STEEL, level - (isBearer ? 1 : 0) + knurl, x0 + i, y))
    }
  }
}

function drawSheetShadow(c: Canvas, f: number) {
  const lift = sheetLift(f)
  const oy = Math.round(-26 * lift)
  const sh = Math.round(1 + lift * 3)
  for (let y = SY0; y <= SY1; y++) for (let x = SX0; x <= SX1; x++) darken(c, x + sh, y + oy + sh, sh > 1 ? 2 : 1)
}

function drawSheet(c: Canvas, f: number) {
  const oy = Math.round(-26 * sheetLift(f))
  const pressedFrom = f < PRESS ? 99 : f < PRESS_TURN ? cylinderX0(f) + 3 : 0
  for (let y = SY0; y <= SY1; y++) {
    for (let x = SX0; x <= SX1; x++) {
      const level = 4.6 + lamp(x, y) * 1.2 - (y === SY1 || x === SX1 ? 0.8 : 0)
      const ink = blockInk(x, y)
      c.set(x, y + oy, ink && x >= pressedFrom ? showThrough(level, ink, x, y) : shade(PAPER, level, x, y + oy))
    }
  }
  if (f === SHEET_DOWN) {
    for (const [x, y] of [[SX0 - 1, SY1 + 1], [SX1 + 1, SY1 + 1], [SX0 - 2, SY0], [SX1 + 2, SY0 + 1]] as const) c.set(x, y, shade(PAPER, 3, x, y))
  }
}

function drawPrint(c: Canvas, since: number, glint: number) {
  const fold = SX0 + Math.min(SX1 + 1 - SX0, Math.max(0, since - PEEL_LIFT))
  const isLifting = since < PEEL_LIFT
  const isTurning = since < PEEL_DONE - PEEL
  const oy = charted(since - (LIFT - PEEL), LIFT_Y)
  const ox = charted(since - (LIFT - PEEL), LIFT_X)
  const leave = oy / 26
  const far = 2 * fold - SX0 - 1
  const shadow = Math.round(1 + leave * 4 + (isTurning ? 1 : 0))
  const isShaded = (x: number, y: number) => x - shadow - ox >= fold && x - shadow - ox <= far && y - shadow - oy >= SY0 && y - shadow - oy <= SY1
  for (let y = SY0; y <= SY1; y++) {
    for (let x = fold; x <= far; x++) darken(c, x + shadow + ox, y + shadow + oy, 2)
  }
  for (let y = SY0 + 1; y <= SY1 + 1; y++) for (let x = fold + 1; x <= SX1 + 1; x++) if (!isShaded(x, y)) darken(c, x, y, 1)
  for (let y = SY0; y <= SY1; y++) {
    for (let x = fold; x <= SX1; x++) {
      const ink = blockInk(x, y)
      const dark = isShaded(x, y) ? 1.6 : 0
      const level = 4.6 + lamp(x, y) * 1.2 - (y === SY1 || x === SX1 ? 0.8 : 0) - dark
      c.set(x, y, isLifting && x === SX0 ? shade(PAPER, 6, x, y) : ink ? showThrough(level, ink, x, y) : shade(PAPER, level, x, y))
    }
  }
  for (let y = SY0; y <= SY1; y++) {
    for (let x = fold; x <= far; x++) {
      const sx = 2 * fold - 1 - x
      const px = sx - BX
      const py = y - BY
      const isMargin = px < 0 || px >= N || py < 0 || py >= N
      let color = isMargin ? shade(PAPER, 5 - (y === SY1 ? 0.8 : 0), x, y) : printColor(N - 1 - px, py, glint, x, y)
      if (x === fold && isTurning) color = shade(PAPER, 6, x, y)
      else if (isTurning && x > far - 3) color = mix(color, 0xffffff, 0.12)
      if (x === far) color = mix(color, 0x5e5648, 0.25)
      c.set(x + ox, y + oy, color)
    }
  }
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    drawBed(c)

    const rx = rollerX(f)
    const isGlossy = (x: number) => (f >= PASS_OUT && f < PASS_BACK ? x <= rx + 2 : f >= PASS_BACK && f < PEEL)
    drawBlock(c, isGlossy)
    const isSheet = f >= SHEET_IN && f < PEEL
    const isAloft = isSheet && f < SHEET_DOWN
    if (isSheet && !isAloft) {
      drawSheetShadow(c, f)
      drawSheet(c, f)
    }
    const g = mod(f - GLINT, LOOP)
    const glint = g < 18 ? 34 + g * 2 : -99
    const since = mod(f - PEEL, LOOP)
    if (since < GONE - PEEL) drawPrint(c, since, glint)
    drawCylinder(c, f)
    if (isAloft) drawSheetShadow(c, f)
    drawRoller(c, f)
    if (isAloft) drawSheet(c, f)
  })
}
export const scene: Scene = {
  verb: 'Proofing',
  render,
  hero: 88,
  snaps: [
    { frames: 6, box: [13, 6, 13, 24], why: 'the roller uncovers the lit edge of the furniture' },
    { frames: 45, box: [13, 25, 32, 25], why: 'the sheet settles over the last row of furniture under the block' },
    { frames: 50, box: [31, 6, 32, 25], why: 'the cylinder uncovers the right margin of the sheet' },
    { frames: 56, box: [13, 6, 13, 25], why: 'the cylinder covers the left edge of the sheet' },
    { frames: 63, box: [13, 6, 13, 25], why: 'the cylinder uncovers the left edge of the sheet as it lifts' },
    { frames: 66, box: [13, 6, 14, 25], why: 'the peel uncovers the furniture beside the block' },
    { frames: 69, box: [31, 6, 32, 25], why: 'the cylinder covers the right margin of the sheet on its way home' },
  ],
}