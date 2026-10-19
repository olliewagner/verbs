import { Canvas, beat, clamp, ease, hex, lerp, shade, smoothstep, wave, type Paint, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const CURTAIN = hex('14030a 24060e 3a0a14 58101c 7a1824 9e2630 c03a3c')
const GOLD = hex('3a2008 6a400e a06a18 d09a2a f0c84a fde88a fffbe0')
const GLOVE = hex('2a1426 4e2c46 7e5a78 ad90a8 d8c8d2 f2eae8 fffaf0')
const SLEEVE = hex('060508 0e0a12 1a1420 2a2232 40364a')
const CUFF = hex('4a4058 8a80a0 cec6dc f8f2fa')
const HAT = hex('050408 0c0a10 16121c 241e2c 3a3244 5e5068')
const BAND = hex('3a0810 6e1018 a01e24')
const FUR = hex('6a5e7e 9a8eb0 cac0dc ece6f4 fffcff')
const EAR = hex('c87890 f0a8bc')
const SMOKE = hex('5a4a64 8a7a9a b8aac8 dcd2e8 f6f0fa')
const TABLE = hex('07040a 120a12 1e1220 2e1c2c 42283c')

function spotX(f: number): number {
  if (f < 36) return 27
  if (f < 42) return lerp(27, 44, ease.inOut(beat(f, 36, 42)))
  if (f < 57) return 44
  return lerp(44, 27, ease.inOut(beat(f, 57, 71)))
}

const flash = (f: number) => (f === 42 ? 0.35 : f === 43 ? 0.18 : 0)

function spot(f: number, x: number, y: number): number {
  const d = Math.hypot((x - spotX(f)) / 27, (y - 14) / 17)
  return clamp(1.25 - d * 1.1) * 0.75 + (d < 0.72 ? 0.25 : 0) + flash(f)
}

type Finger = { x: number; y: number; art: readonly string[] }

const CURLED = [
  '.65555556...',
  '333333334566',
  '333333334555',
  '.22222222345',
  '.........345',
  '........2344',
  '........123.',
  '.........1..',
]
const LONG = [...CURLED.slice(0, 4), '.........345', ...CURLED.slice(4)]
const SHORT = ['.6555556...', '33333334566', '33333332455', '.2222222345', '........234', '........12.']

const behind = (art: readonly string[]) => art.map((row, j) => (j === 1 ? row.replace(/3/g, '4') : row))
const FINGERS: readonly Finger[] = [
  { x: 14, y: 13, art: CURLED },
  { x: 16, y: 11, art: behind(LONG) },
  { x: 18, y: 9, art: behind(CURLED) },
  { x: 20, y: 7, art: behind(SHORT) },
]
const BACK = [
  '..........555.',
  '....5555555555',
  '.5555555555555',
  '45555555555555',
  '45555555555555',
  '45555555555555',
  '33333355555555',
  '33333333......',
  '33333333......',
  '.2222222......',
]
const HOLLOW = ['.1111111', '11111111', '.1111111', '...11111']
const THUMB = ['4555', '444555', '22444556', '.2224444', '...1111']

const OPEN_HAND = {
  x: 8,
  y: 5,
  art: [
    '................56.......',
    '..............553........',
    '........55565533....5566.',
    '....5555555333..5555333..',
    '..555555555565555553.....',
    '4455555555555555222......',
    '4455555555552222.........',
    '4455555555556555555555564',
    '445555555555555555555333.',
    '445555555555222222222....',
    '445555555555655..........',
    '.444444444445555555......',
    '...3344444442225555556...',
    '...3455533.....22223334..',
    '....3455.................',
    '....2345.................',
    '.....246.................',
    '......13.................',
  ],
}
const HALF_HAND = {
  x: 8,
  y: 7,
  art: [
    '........55555.......',
    '....55555553355.....',
    '..55555555555536....',
    '44555555555555554...',
    '44444444555522555...',
    '445555555555552256..',
    '4444445555555555234.',
    '44555555555522555...',
    '4444444455555.2255..',
    '.3333332222255..256.',
    '...334111111255..234',
    '...3455111...256....',
    '...22355......234...',
    '....12364...........',
  ],
}
type Pose = { dy: number; lift: readonly number[]; open: number }

const FLAT = ['.565.', '24442']
const TILT = ['.456.', '34564', '.233.']
const FACE = ['.345.', '35665', '34564', '23443', '.233.']
const EDGE = ['34643']
const SPIN = [FLAT, TILT, FACE, EDGE] as const
const FLIPS = [3, 11, 19] as const
type Coin = { x: number; y: number; art: readonly string[]; front: number; hidden: boolean; restsOn: number }

function shelf(k: number, pose: Pose): { x: number; y: number } {
  const finger = FINGERS[k] ?? FINGERS[0]
  return { x: (finger?.x ?? 15) + 4, y: (finger?.y ?? 12) + pose.dy - (pose.lift[k] ?? 0) }
}

const rest = (k: number, pose: Pose): Coin => {
  const s = shelf(k, pose)
  return { x: s.x, y: s.y - 1, art: FLAT, front: k, hidden: false, restsOn: k }
}

const HAND_DY: Readonly<Record<number, number>> = { 25: 1, 26: 1, 27: 1, 29: -1, 30: -1, 31: -1, 65: -1, 66: -1, 67: -1 }
function handPose(f: number): Pose {
  const lift = [0, 0, 0, 0]
  let dy = 0
  for (const [k, s] of FLIPS.entries()) {
    const o = f - s
    if (o === 0 || o === 1) lift[k] = 1
    if (o >= 1 && o <= 3) lift[k + 1] = 1
  }

  const open = f === 34 || f === 46 ? 1 : f >= 35 && f < 46 ? 2 : 0
  return { dy: HAND_DY[f] ?? 0, lift, open }
}
const HAT_X = 48
const BRIM_Y = 18
const TABLE_Y = 25
function hatRock(f: number): number {
  return f === 38 ? -1 : f === 40 ? 1 : 0
}
const RABBIT: Readonly<Record<number, readonly [number, number]>> = {
  42: [11, 2], 43: [12, 1], 44: [12, -1],
  49: [13, -1], 50: [13, -1], 51: [13, -1],
  55: [13, 0], 56: [13, 0], 57: [13, 0],
  61: [13, 1], 62: [15, 2], 63: [17, 2], 64: [19, 2], 65: [21, 2], 66: [23, 2], 67: [25, 2], 68: [27, 2],
}
function rabbitHead(f: number): { x: number; y: number; ears: number } | undefined {
  if (f < 42 || f > 68) return undefined
  const [y, ears] = RABBIT[f] ?? [12, 0]
  return { x: HAT_X + hatRock(f), y, ears }
}
type Flight = readonly [x: number, y: number, pose: number]
const FLICK: Readonly<Record<number, Flight>> = { 28: [26, 5, 1], 29: [28, 6, 2], 30: [30, 6, 1] }
const DROP: Readonly<Record<number, Flight>> = { 46: [48, 3, 1], 47: [48, 4, 2], 48: [48, 7, 1] }
const THROW: Readonly<Record<number, Flight>> = {
  58: [45, 7, 1], 59: [42, 6, 3], 60: [39, 6, 0], 61: [36, 6, 3], 62: [33, 6, 0],
  63: [30, 7, 3], 64: [27, 7, 0], 65: [24, 8, 3], 66: [22, 9, 0], 67: [20, 10, 1],
}
function coinAt(f: number, pose: Pose): Coin {
  if (f < FLIPS[0]) return rest(0, pose)
  for (const [k, s] of FLIPS.entries()) {
    const o = f - s
    if (o < 0) return rest(k, pose)
    if (o < 4) {
      const near = shelf(k, pose)
      const far = shelf(k + 1, pose)
      if (o === 0) return { x: near.x, y: near.y - 1, art: TILT, front: k, hidden: false, restsOn: -1 }
      if (o < 3) return { x: near.x + 1, y: near.y - 1, art: FACE, front: k + 1, hidden: false, restsOn: -1 }
      return { x: far.x, y: far.y - 1, art: TILT, front: k + 1, hidden: false, restsOn: -1 }
    }
    if (o === 4 && k === 2) return rest(3, pose)
  }
  const flight = FLICK[f] ?? DROP[f] ?? THROW[f]
  if (flight) return air(...flight)
  if (f < 28) return rest(3, pose)
  if (f < 46) return { ...rest(0, pose), hidden: true }
  const head = rabbitHead(f)
  if (f < 58 && head) return { x: head.x, y: head.y - 4, art: FLAT, front: 0, hidden: false, restsOn: -1 }
  return rest(0, pose)
}
function air(x: number, y: number, turn: number): Coin {
  const art = SPIN[turn] ?? FLAT
  return { x, y: y + Math.floor(art.length / 2), art, front: 0, hidden: false, restsOn: -1 }
}
const valance = (x: number) => 2 + Math.round(Math.abs(Math.sin((x + 2) * (Math.PI / 8))) * 1.2)
function drawCoin(c: Canvas, f: number, coin: Coin): void {
  if (coin.hidden) return
  const glint = flash(f) * 4 + (f === 48 || f === 49 || f === 68 || f === 69 ? 1 : 0)
  const gold = (level: number) => (x: number, y: number) => (y > valance(x) ? shade(GOLD, level) : undefined)
  c.sprite(coin.x - 2, coin.y - coin.art.length + 1, coin.art, {
    '2': gold(2),
    '3': gold(3 + glint),
    '4': gold(4 + glint),
    '5': gold(5 + glint),
    '6': gold(6),
  })
}
type Glove = (level: number) => Paint
function drawHand(c: Canvas, f: number, pose: Pose, coin: Coin): void {
  const dy = pose.dy
  const lit = flash(f) * 3
  const away = clamp((f - 45) / 4) * 0.9
  const glove: Glove = level => (x, y) => shade(GLOVE, level + lit + (spot(f, x, y) - spot(0, x, y)) * away)
  const palette: Record<string, Paint> = {}
  for (let i = 0; i <= 6; i++) palette[String(i)] = glove(i)
  c.poly([[-1, 6 + dy], [7, 7.5 + dy], [7, 17 + dy], [-1, 16 + dy]], (x, y) => {
    const fromTop = y - (6 + dy + (x + 1) * (1.5 / 8))
    const fromBottom = 16 + dy + (x + 1) * (1 / 8) - y
    return shade(SLEEVE, fromTop < 1.5 ? 3 : fromTop < 3 ? 2 : fromBottom < 1.5 ? 0 : 1)
  })
  if (pose.open === 0) c.sprite(8, 7 + dy, BACK, palette)
  c.ellipse(7.5, 12 + dy, 1, 4.6, (x, y) => shade(CUFF, y - dy < 10 ? 3 : y - dy > 15 ? 1 : 2))
  c.set(7, 13 + dy, GOLD[4] ?? 0)
  if (pose.open > 0) {
    const hand = pose.open === 1 ? HALF_HAND : OPEN_HAND
    c.sprite(hand.x, hand.y + dy, hand.art, palette)
    return
  }
  c.sprite(15, 16 + dy, HOLLOW, palette)
  const owner = new Int8Array(W * H).fill(-1)
  for (let k = FINGERS.length - 1; k >= 0; k--) {
    if (k === coin.front - 1 || (k === FINGERS.length - 1 && coin.front >= FINGERS.length)) drawCoin(c, f, coin)
    const finger = FINGERS[k]
    if (!finger) continue
    const fy = finger.y + dy - (pose.lift[k] ?? 0)
    c.sprite(finger.x, fy, finger.art, palette)
    finger.art.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const x = finger.x + i
        const y = fy + j
        if (row[i] === '.' || x < 0 || x >= W || y < 0 || y >= H) continue
        owner[y * W + x] = k
        const right = row[i + 1]
        if ((right === undefined || right === '.') && x + 1 < W && (owner[y * W + x + 1] ?? -1) > k) c.set(x + 1, y, glove(3))
      }
    })
  }
  if (coin.front === 0) drawCoin(c, f, coin)
  c.sprite(9, 16 + dy, THUMB, palette)
  if (coin.restsOn >= 0 && !coin.hidden) {
    for (let x = coin.x - 1; x <= coin.x + 1; x++) c.set(x, coin.y + 1, glove(4))
  }
}
function drawHatBack(c: Canvas, f: number): void {
  const hx = HAT_X + hatRock(f)
  c.ellipse(hx, BRIM_Y, 8.5, 2.2, (x, y) => {
    if (y > BRIM_Y) return undefined
    const isRim = !(((x - hx) / 8.5) ** 2 + ((y - 1 - BRIM_Y) / 2.2) ** 2 <= 1)
    return shade(HAT, 3 + spot(f, x, y) * 1.2 + (isRim ? 1.4 : 0))
  })
  c.ellipse(hx, BRIM_Y, 5.6, 1.3, (x, y) => (y < BRIM_Y ? (HAT[1] ?? 0) : 0x020104))
}
function drawHatFront(c: Canvas, f: number): void {
  const hx = HAT_X + hatRock(f)
  const tilt = hatRock(f)
  for (let y = BRIM_Y + 1; y < TABLE_Y + 1; y++) {
    const lean = Math.round(tilt * (y - BRIM_Y) * -0.15)
    for (let x = hx - 6; x <= hx + 6; x++) {
      const u = (x - hx) / 6
      const sheen = Math.abs(u + 0.35) < 0.18 ? 2 : u > 0.7 ? -0.8 : 0
      const isBand = y === BRIM_Y + 1 || y === BRIM_Y + 2
      const lit = spot(f, x, y)
      c.set(x + lean, y, isBand ? shade(BAND, 1 + sheen * 0.5 + lit) : shade(HAT, 1.6 + sheen + lit * 1.4 - (y - BRIM_Y) * 0.05))
    }
  }
  c.ellipse(hx, BRIM_Y, 8.5, 2.2, (x, y) => {
    if (y <= BRIM_Y || ((x - hx) / 5.6) ** 2 + ((y - BRIM_Y) / 1.3) ** 2 <= 1) return undefined
    return shade(HAT, 3.2 + spot(f, x, y) * 1.2 + (y === BRIM_Y + 1 ? 0.8 : -0.4))
  })
  for (const x of [hx - 8, hx - 7]) c.set(x, BRIM_Y, HAT[3] ?? 0)
}
function drawRabbit(c: Canvas, f: number): void {
  const head = rabbitHead(f)
  if (!head) return
  const { x: cx, y: headY } = head
  const earLen = 5 + head.ears
  const blink = f >= 49 && f <= 51
  const look = f >= 52 && f < 58 ? -1 : 0
  const set = (x: number, y: number, color: number) => {
    if (y <= BRIM_Y) c.set(x, y, color)
  }
  for (const [side, x] of [[-1, cx - 2], [1, cx + 2]] as const) {
    for (let j = 1; j <= earLen; j++) {
      const y = headY - 2 - j
      set(x, y, shade(FUR, 3.2 - (side === 1 ? 0.8 : 0)))
      set(x - side, y, j < earLen && j > 1 ? (EAR[side === 1 ? 0 : 1] ?? 0) : shade(FUR, 2.6))
    }
  }
  for (let y = headY - 3; y <= headY + 3; y++) {
    for (let x = cx - 4; x <= cx + 4; x++) {
      const d = ((x - cx) / 4.2) ** 2 + ((y - headY) / 3.3) ** 2
      if (d > 1) continue
      set(x, y, shade(FUR, 3.6 - Math.max(0, (x - cx) * 0.25 + (y - headY) * 0.35) + spot(f, x, y) * 0.4))
    }
  }
  const eye = blink ? (FUR[1] ?? 0) : 0x8a1828
  set(cx - 2 + look, headY - 1, eye)
  set(cx + 2 + look, headY - 1, eye)
  if (!blink) {
    set(cx - 2 + look, headY - 2, 0x2a0810)
    set(cx + 2 + look, headY - 2, 0x2a0810)
  }
  set(cx + look, headY + 1, EAR[0] ?? 0)
  if (headY <= 13) {
    for (const px of [cx - 4, cx + 4]) {
      set(px, BRIM_Y - 1, FUR[4] ?? 0)
      set(px + (px < cx ? 1 : -1), BRIM_Y - 1, FUR[3] ?? 0)
    }
  }
}
type Blob = readonly [number, number, number]
const ROUND: readonly Blob[] = [[0, 0, 1], [-1.3, 0.5, 0.75], [1.3, 0.45, 0.75], [0.5, -1.1, 0.8], [-0.7, -0.9, 0.65]]
const BURST: readonly Blob[] = [[-1.6, -0.1, 0.7], [1.6, -0.1, 0.7], [-1.2, -1.1, 0.5], [1.2, -1.1, 0.5]]
function puff(c: Canvas, f: number, start: number, x: number, y: number, size: number, life: number, blobs: readonly Blob[], spread = 0.6, light = 3): void {
  const t = (f - start) / life
  if (t < 0 || t >= 1) return
  const swell = ease.out(Math.min(1, t * 3)) * (1 - smoothstep(0.35, 1, t))
  for (const [ox, oy, k] of blobs) {
    const bx = x + ox * size * (0.7 + t * spread)
    const by = y + oy * size * (0.7 + t * spread) - t * 2.5
    const r = size * k * swell
    if (r < 0.5) continue
    c.disc(bx, by, r, (px, py) => shade(SMOKE, light - Math.max(0, (py - by) / r) * 2.2 - Math.max(0, (px - bx) / r) * 0.6 - t * 1.2))
  }
}
function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    for (let y = 0; y < TABLE_Y; y++) {
      for (let x = 0; x < W; x++) {
        const fold = Math.sin(x * 0.85 + Math.sin(y * 0.15 + wave(f, LOOP, 1) * 0.5) * 0.6 + wave(f, LOOP, 1, 0.25) * 0.35 * (y / TABLE_Y))
        const level = 1.4 + fold * 0.9 + spot(f, x, y) * 3.6
        c.set(x, y, shade(CURTAIN, level))
      }
    }
    for (let x = 0; x < W; x++) {
      const drop = valance(x)
      for (let y = 0; y < drop; y++) c.set(x, y, shade(CURTAIN, 0.6 + (y === drop - 1 ? 0.8 : 0) + spot(f, x, y) * 1.2))
      c.set(x, drop, shade(GOLD, 1.6 + spot(f, x, drop) * 2))
    }
    for (let y = TABLE_Y; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (y <= TABLE_Y + 2) c.set(x, y, shade(TABLE, 2 + spot(f, x, y) * 2.2 - (y - TABLE_Y) * 0.4))
        else if (y === TABLE_Y + 3) c.set(x, y, shade(GOLD, 2 + spot(f, x, y) * 2 + (x % 2 ? 0.6 : 0)))
        else c.set(x, y, shade(TABLE, 0.8 + (x % 2 === 0 && y === TABLE_Y + 4 ? 1 : 0) + Math.sin(x * 0.7) * 0.6 + spot(f, x, y) * 1.2))
      }
    }
    for (let x = HAT_X - 8; x <= HAT_X + 9; x++) c.set(x, TABLE_Y + 1, TABLE[0] ?? 0)
    for (let x = 9; x <= 31; x++) c.set(x, TABLE_Y, TABLE[1] ?? 0)
    drawHatBack(c, f)
    drawRabbit(c, f)
    drawHatFront(c, f)
    const pose = handPose(f)
    const coin = coinAt(f, pose)
    const byHat = f >= 46 && f < 58
    drawHand(c, f, pose, byHat ? { ...coin, hidden: true } : coin)
    puff(c, f, 30, 31, 6, 2.2, 8, ROUND)
    if (f >= 31 && f < 35) {
      const o = f - 31
      for (const [mx, my] of [[-1, -0.5], [1, -0.5], [-1, 0.6], [1, 0.6], [0, 1]] as const) {
        c.set(31 + Math.round(mx * (3 + o * 1.5)), 6 + Math.round(my * (3 + o * 1.5)), GOLD[6 - o] ?? 0)
      }
    }
    puff(c, f, 41, HAT_X, BRIM_Y - 2, 3.2, 7, BURST, 1.1, 2.2)
    drawRabbit(c, f)
    if (byHat) drawCoin(c, f, coin)
    out.push(c.px)
  }
  return out
}
export const scene: Scene = {
  verb: 'Prestidigitating',
  render,
  hero: 44,
  snaps: [
    { frames: 31, box: [26, 1, 36, 10], why: 'the coin vanishes at the top of its flight in a puff of smoke' },
    { frames: 42, why: 'the rabbit pops out of the hat in a white flash that lights the whole stage' },
  ],
}