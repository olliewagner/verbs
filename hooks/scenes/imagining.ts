import { Canvas, PALETTE, TAU, ease, frames, hash, hex, mix, mod, shade, threshold, wave, type Scene, type Snap } from '../engine'

const W = 64
const H = 32
const LOOP = 96

const SKIN = hex('4a2026 7a3c36 ae6650 d6946c efbf96')
const HAIR = hex('180c14 2e161c 4a241f 6a3a22')
const CARD = hex('2e1a16 4a2c1e 6c4426 905e30 b47c42 d09c5a e6bf7e')

const KX = 29
const KY = 13
const HEAD = ['.hhhh.', 'hhhhhh', 'hsshhh', 'ssssss', 'ssssss', '.ssss.']

type Hat = 'none' | 'helmet' | 'crown' | 'pirate'

function kid(c: Canvas, dx: number, dy: number, look: number, side: number, lit: number, hat: Hat, isGrinning: boolean): void {
  const x0 = KX + dx
  const y0 = KY + dy
  HEAD.forEach((row, j) => {
    for (let i = 0; i < 6; i++) {
      const ch = row[i]
      if (ch === '.' || ch === undefined) continue
      const edge = side < 0 ? (i === 0 || row[i - 1] === '.' ? 1 : i >= 4 ? -0.8 : 0) : (i === 5 || row[i + 1] === '.' ? 1 : i <= 1 ? -0.8 : 0)
      if (ch === 'h') c.set(x0 + i, y0 + j, shade(HAIR, 1.6 + lit + edge * 0.8 + (j === 0 ? 0.6 : 0)))
      else c.set(x0 + i, y0 + j, shade(SKIN, 2.4 + lit + edge * 0.7 - (j === 5 ? 0.8 : 0)))
    }
  })
  c.set(x0 + 1 + look, y0 + 3, 0x1a0c18)
  c.set(x0 + 4 + look, y0 + 3, 0x1a0c18)
  c.set(x0 + (look < 0 ? 0 : 5), y0 + 4, mix(shade(SKIN, 3 + lit), 0xe0606a, 0.45))
  if (isGrinning) {
    c.set(x0 + 2 + look, y0 + 4, shade(SKIN, 0.6))
    c.set(x0 + 3 + look, y0 + 4, shade(SKIN, 0.6))
  }
  if (hat === 'crown') {
    const g = PALETTE.gold
    for (let i = 0; i < 6; i++) c.set(x0 + i, y0 - 1, shade(g, 4 + lit - (side < 0 ? i : 5 - i) * 0.35))
    for (const i of [0, 2, 3, 5]) c.set(x0 + i, y0 - 2, shade(g, 5 + lit - (side < 0 ? i : 5 - i) * 0.3))
    c.set(x0 + 2, y0 - 1, 0xd8364a)
  }
  if (hat === 'pirate') {
    const k = hex('0c0a14 1a1624 2a2436 3e3650')
    for (let i = -1; i < 7; i++) c.set(x0 + i, y0, shade(k, 1.4 + (i === 6 ? lit * 2 : 0)))
    for (let i = 0; i < 6; i++) c.set(x0 + i, y0 - 1, shade(k, 1 + (i === 5 ? lit * 2 : 0)))
    for (let i = 1; i < 5; i++) c.set(x0 + i, y0 - 2, shade(k, 0.8 + (i === 4 ? lit * 2 : 0)))
    c.set(x0 - 2, y0 - 1, shade(k, 1.4))
    c.set(x0 + 7, y0 - 1, shade(k, 1.4 + lit * 2))
    c.set(x0 + 2, y0 - 1, 0xe8e0d0)
  }
  if (dy <= 1) {
    for (const hx of [x0 - 2, x0 - 1, x0 + 6, x0 + 7]) c.set(hx, y0 + 5, shade(SKIN, 2.6 + lit + (hx === x0 - 2 || hx === x0 + 7 ? 0.6 * -side * Math.sign(hx - x0 - 2.5) : 0)))
  }
}

const WALL = hex('241b30 33263f 45334f 5a4360 72566f 8c6b7c a78588 c3a194')
const FLOOR = hex('24141a 3a2020 52301f 6c4224 885630 a46c3c c08a50')
const RUG = hex('132634 1b3a4c 25506a 2f6884 4a86a0 76a8b8')
const CURTAIN = hex('3a1222 5e1c2c 862a36 ae3e3c cc5c40 e2844c')
const BLANKET = hex('1a2440 283a64 34528a 4a6eaa 6c90c4')
const SHEET = hex('6a6a8a 9a96b0 c8c2d4 ece6ee')

const roomLight = (x: number, y: number) => Math.max(0, 1.5 - Math.hypot(x - 9, (y - 8) * 1.2) / 30)
const inBeam = (x: number, y: number) => {
  const u = x - (y - 8) * 1.45
  return y > 12 && u > 3 && u < 13
}

function bedroom(c: Canvas, f: number): void {
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < W; x++) {
      const stripe = mod(x, 7) === 0 ? -0.6 : mod(x, 7) === 3 && mod(y, 4) === 1 ? 0.5 : 0
      c.set(x, y, shade(WALL, 1.8 + roomLight(x, y) * 3.2 + stripe + (inBeam(x, y) ? 0.6 : 0)))
    }
  }
  for (let x = 0; x < W; x++) {
    c.set(x, 22, shade(SHEET, 1.4 + roomLight(x, 22) * 1.6))
    c.set(x, 23, shade(WALL, 0.4))
  }
  for (let y = 24; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const seam = mod(x + (Math.floor((y - 24) / 2) % 2) * 9, 18) === 0 || (y - 24) % 2 === 1 && mod(x, 5) === 2 && false
      const lvl = 2.2 + roomLight(x, y) * 2.2 + (inBeam(x, y) ? 2.2 : 0) - (seam ? 0.9 : 0) - ((y - 24) % 2 === 0 ? 0 : 0.35)
      c.set(x, y, shade(FLOOR, lvl))
    }
  }
  c.ellipse(32, 29, 20, 3.4, (x, y) => {
    const d = ((x - 32) / 20) ** 2 + ((y - 29) / 3.4) ** 2
    return shade(RUG, 1.6 + roomLight(x, y) * 1.4 + (inBeam(x, y) ? 1.6 : 0) + (d > 0.7 ? 1 : d > 0.45 ? 0 : 0.5))
  })

  for (let y = 3; y <= 13; y++) {
    for (let x = 4; x <= 15; x++) {
      const isBar = x === 4 || x === 15 || y === 3 || y === 13 || x === 9 || x === 10 || y === 8
      const sky = hex('7fa6cc a3c2da c8dce2 f0ead2')
      c.set(x, y, isBar ? shade(SHEET, x === 4 || y === 13 ? 1 : 2.4) : shade(sky, (y - 3) / 3 + (x < 9 ? 0.3 : 0)))
    }
  }
  c.rect(5, 10, 4, 2, 0x8fae9e)
  c.rect(11, 11, 4, 1, 0x9cb8a4)
  c.set(6, 9, 0x8fae9e)
  c.set(12, 10, 0x9cb8a4)
  for (let y = 1; y <= 15; y++) {
    const sway = y > 9 ? Math.round(wave(f, LOOP, 2) * (y - 9) / 8) : 0
    for (const [x0, w] of [[1, 3], [16, 3]] as const) {
      for (let i = 0; i < w; i++) {
        const fold = (i + (x0 > 9 ? 1 : 0)) % 2 === 0 ? 0.8 : 0
        c.set(x0 + i + (x0 < 9 ? 0 : sway), y, shade(CURTAIN, 1.6 + roomLight(x0 + i, y) * 2 + fold))
      }
    }
  }
  for (let x = 0; x <= 19; x++) c.set(x, 1, shade(FLOOR, 1.4 + roomLight(x, 1) * 2))

  for (let y = 4; y <= 12; y++) {
    for (let x = 44; x <= 51; x++) c.set(x, y, shade(SHEET, 2.2 + roomLight(x, y) * 1.4 - (x === 51 || y === 12 ? 0.9 : 0)))
  }
  for (const [x, y, col] of [[47, 6, 0xc83c3c], [48, 6, 0xc83c3c], [47, 7, 0x4a6eaa], [48, 7, 0x4a6eaa], [47, 8, 0x4a6eaa], [48, 8, 0x4a6eaa], [46, 9, 0xc83c3c], [49, 9, 0xc83c3c], [47, 10, 0xe8a03c], [48, 10, 0xf0c050], [45, 5, 0xe8c050], [50, 11, 0xe8c050]] as const) {
    c.set(x, y, col)
  }
  for (const [x, y] of [[44, 4], [51, 4]] as const) c.set(x, y, 0xe8dcb0)

  for (let y = 12; y <= 27; y++) {
    for (let x = 53; x < W; x++) {
      const isFrame = x === 53 || y === 12 || y === 19 || y === 27
      c.set(x, y, shade(FLOOR, isFrame ? 3.6 + (y === 12 ? 1 : 0) - (x === 53 ? 0.4 : 0) : 0.6))
    }
  }
  const BOOKS = [0x8a2a34, 0x2f6884, 0xd09c3a, 0x4a7a3a, 0x6a3a7a, 0xc8603c, 0x3a8a8a]
  for (const [shelf, base] of [[0, 18], [1, 26]] as const) {
    let x = 54
    for (let i = 0; x < W; i++) {
      const w = hash(i, shelf, 1) > 0.6 ? 2 : 1
      const h = 4 + Math.floor(hash(i, shelf, 2) * 3)
      const col = BOOKS[Math.floor(hash(i, shelf, 3) * BOOKS.length)] ?? 0
      for (let k = 0; k < w && x + k < W; k++) {
        for (let y = base - h + 1; y <= base; y++) c.set(x + k, y, mix(col, y === base - h + 1 ? 0xf0d8b0 : 0x10081a, y === base - h + 1 ? 0.25 : k === w - 1 && w > 1 ? 0.35 : 0.1))
      }
      x += w
    }
  }
  c.rect(56, 9, 4, 3, (x, y) => shade(CURTAIN, 2.4 - (x - 56) * 0.4 + (y === 9 ? 1 : 0)))
  for (const [x, y, l] of [[57, 8, 4], [58, 8, 3], [56, 7, 4.6], [58, 6, 4], [59, 7, 3], [57, 5, 5], [60, 6, 3.4], [55, 6, 4]] as const) {
    c.set(x, y, shade(PALETTE.leaf, l - 0.8 + wave(f, LOOP, 2, x * 0.1) * 0.3))
  }

  c.ellipse(10, 29.5, 3, 0.8, shade(FLOOR, 0.6))
  c.disc(10, 27, 2.3, (x, y) => {
    const isStripe = Math.abs(x - 10 + (y - 27) * 0.6) < 0.7
    const l = 2.6 - (x - 9) * 0.5 - (y - 26) * 0.4
    return isStripe ? shade(SHEET, l) : shade(CURTAIN, 1.6 + l)
  })

  const g = mod(f - 87, LOOP)
  const DUCK = [0, 0, 0, -1, 1, 3, 5]
  const lift = g < 7 ? (DUCK[g] ?? 0) : g < 16 ? 6 : g < 20 ? Math.round(6 - ease.outBack((g - 15) / 4) * 6) : 0
  const shake = g === 10 || g === 13 ? 1 : g === 11 || g === 14 ? -1 : 0
  const squash = g === 7 || g === 15 ? 1 : 0
  const look = g >= 21 && g < 24 ? -1 : g >= 24 && g < 27 ? 1 : 0
  drawBox(c, shake, squash, lift, look, f)
  for (let i = 0; i < 9; i++) {
    const x = Math.round(5 + hash(i, 3) * 30 + wave(f, LOOP, 1, hash(i, 4)) * 2)
    const y = Math.round(13 + hash(i, 5) * 12 - mod(f * 0.12 + hash(i, 6) * 12, 12))
    if (inBeam(x, y) && wave(f, LOOP, 3, hash(i, 7)) > -0.2) c.set(x, y, 0xf6e2b8)
  }
}

function drawBox(c: Canvas, dx: number, squash: number, lift: number, look: number, f: number): void {
  const top = 19 + squash
  c.poly([[24 + dx, 28], [42 + dx, 28], [48 + dx, 30], [28 + dx, 30]], (x, y) => shade(FLOOR, 1 + (inBeam(x, y) ? 1 : 0) - (y === 28 ? 0.6 : 0)))
  for (let y = 11 + squash; y <= 16 + squash; y++) {
    for (let x = 26; x <= 41; x++) {
      const tilt = y - 11 - squash < 2 ? (x < 27 + (y - 11 - squash) ? 1 : 0) : 0
      if (tilt) continue
      c.set(x + dx, y, shade(CARD, 3 + roomLight(x, y) * 1.4 - (x - 26) * 0.08 + (y === 11 + squash ? 0.8 : 0)))
    }
  }
  for (let y = top - 3; y < top; y++) {
    for (let x = 24 + (top - 1 - y); x <= 41; x++) c.set(x + dx, y, shade(CARD, y === top - 3 ? 1 : 0.4))
  }
  if (lift < 6) kid(c, dx, lift + squash, look, -1, 0.9, 'none', lift === 0)
  c.poly([[23 + dx, top], [26 + dx, top - 3], [22 + dx, top - 6], [19 + dx, top - 3]], (x, y) => shade(CARD, 3.2 + roomLight(x, y) * 1.8 + (x <= 20 + dx ? 0.8 : 0)))
  c.poly([[40.5 + dx, top], [42.5 + dx, top - 3], [47 + dx, top - 4], [45 + dx, top - 1]], (x, y) => shade(CARD, 2.4 + roomLight(x, y) + (y === top - 4 ? 0.6 : 0)))
  c.poly([[40.5 + dx, top], [42.5 + dx, top - 3], [42.5 + dx, 25.5], [40.5 + dx, 28.5]], (x, y) => shade(CARD, 1.4 + (x === 42 + dx && y === top - 2 ? 0.8 : 0)))
  for (let y = top; y <= 28; y++) {
    for (let x = 23; x <= 40; x++) {
      const lit = roomLight(x, y) * 1.6 + (x <= 24 ? 0.8 : 0) + (inBeam(x, y) ? 0.9 : 0)
      const isRim = y === top
      const isFold = y === top + 4
      const isTape = (x === 31 || x === 32) && y <= top + 4
      const lvl = isRim ? 4.6 + lit : isFold ? 2.2 + lit : y < top + 4 ? 3.6 + lit : 2.9 + lit - (y > 26 ? 0.6 : 0)
      c.set(x + dx, y, shade(CARD, lvl + (isTape ? 0.8 : 0)))
    }
  }
  if (f % 1 === 0) {
    for (const [x, y] of [[26, 25], [27, 24], [28, 25], [29, 24], [35, 26], [36, 25], [37, 26]] as const) c.set(x + dx, y, 0x5a3a6a)
  }
  c.line(23 + dx, 29, 40 + dx, 29, shade(FLOOR, 0.3))
}

const SPACE = hex('07051a 0d0a28 160f38 22164a')
const NEBULA = hex('22164a 33205e 4a2a70 6a3480')
const HULL = hex('2a2840 46466a 6f7298 9ea4c4 cdd2e6 f4f6ff')
const RED = PALETTE.red
const FIRE = PALETTE.fire
const PLANET = hex('2a1030 4a1a46 7a2c58 b44c5c dc7c5c f2b07a')
const GLASS = hex('5ab0d0 a6e6ee e8fcff')

const STAR_LAYERS = [
  { speed: 1, len: 0, col: 0x6a6aa0 },
  { speed: 2, len: 1, col: 0xb8bce0 },
  { speed: 4, len: 3, col: 0xffffff },
] as const
const starColor = (col: number, k: number, len: number) => mix(col, SPACE[1] ?? 0, k / (len + 1))
const STAR_COLORS = STAR_LAYERS.flatMap(l => Array.from({ length: l.len + 1 }, (_, k) => starColor(l.col, k, l.len)))

function space(c: Canvas, f: number): void {
  const t = f - 18
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = Math.sin((x + t * 0.5) * 0.11 + y * 0.32) + Math.sin((x + t * 0.5) * 0.05 - y * 0.2) * 1.4
      c.set(x, y, n > 1.2 ? shade(NEBULA, (n - 1.2) * 2.5) : shade(SPACE, 1.2 + y / 18 + (n > 0.6 ? 1 : 0)))
    }
  }
  const px = 55 - Math.floor(t / 6)
  const py = 6
  const ring = (x: number, y: number, isFront: boolean) => {
    const e = ((x - px) / 12) ** 2 + ((y - py - (x - px) * 0.15) / 2.6) ** 2
    const isBand = e > 0.5 && e < 1
    const isFrontHalf = y - py - (x - px) * 0.15 > 0
    return isBand && isFrontHalf === isFront
  }
  for (let y = 0; y < 16; y++) {
    for (let x = 38; x < W; x++) {
      if (ring(x, y, false)) c.set(x, y, shade(PALETTE.sand, 2.5 + (x - px) * 0.12))
    }
  }
  c.disc(px, py, 7, (x, y) => {
    const l = 2.4 + ((x - px) * 0.6 - (y - py) * 0.5) / 7 * 2.6
    const band = Math.round((y - py) * 0.7 + Math.sin(x * 0.5) * 0.4) % 3 === 0 ? 0.6 : 0
    return shade(PLANET, l + band)
  })
  for (let y = 0; y < 16; y++) {
    for (let x = 38; x < W; x++) {
      if (ring(x, y, true)) c.set(x, y, shade(PALETTE.sand, 3.5 + (x - px) * 0.12))
    }
  }
  for (let i = 0; i < 26; i++) {
    const { speed, len, col } = STAR_LAYERS[i % 3] ?? { speed: 1, len: 0, col: 0xffffff }
    const x = Math.round(mod(hash(i, 11) * 90 - t * speed, 90)) - 13
    const y = Math.floor(hash(i, 12) * H)
    for (let k = 0; k <= len; k++) c.set(x + k, y, starColor(col, k, len))
  }

  const dy = Math.round(wave(t, 24, 1, -1 / 12) * 0.8)
  const flick = (f * 7) % 3
  for (let y = 20; y <= 27; y++) {
    for (let x = 4; x <= 21; x++) {
      const v = (21 - x) / (13 + flick + Math.sin(f * 1.7 + y) * 1.5)
      const half = 3.6 * (1 - v) ** 0.7
      const d = Math.abs(y + 0.5 - 24 - Math.sin(v * 5 + f) * v * 0.9) / Math.max(0.4, half)
      if (v < 0 || v > 1 || d > 1) continue
      c.set(x, y + dy, shade(FIRE, 2 + (1 - d) * 5 * (1 - v * 0.7) + (1 - v) * 1.6))
    }
  }
  const glow = (x: number) => Math.max(0, 1 - (x - 21) / 8) * 1.2
  const fin = (x: number, y: number) => shade(RED, 2.4 + (y < 24 + dy ? 1.4 : 0) + glow(x) * 0.6 - (x - 18) * 0.06)
  c.poly([[23, 19.5 + dy], [29, 19.5 + dy], [24, 14.5 + dy], [20, 14.5 + dy]], fin)
  c.poly([[23, 28.5 + dy], [29, 28.5 + dy], [24, 32.5 + dy], [20, 32.5 + dy]], (x, y) => shade(RED, 1.4 + glow(x) * 0.8 - (y - 29 - dy) * 0.2))
  for (let y = 21; y <= 26; y++) for (const x of [21, 22]) c.set(x, y + dy, shade(HULL, 1 + (x === 21 ? 1.6 : 0.4) + (y === 21 ? 1 : 0)))
  c.ellipse(31.5, 19 + dy, 6.6, 7.2, (x, y) => (y < 19 + dy ? shade(SPACE, 2.6) : undefined))
  kid(c, 0, dy, 0, 1, 1.2, 'helmet', true)
  c.ellipse(31.5, 19 + dy, 6.6, 7.2, (x, y) => {
    if (y >= 19 + dy) return undefined
    const d = ((x - 31.5) / 6.6) ** 2 + ((y - 19 - dy) / 7.2) ** 2
    const under = c.get(x, y)
    if (d > 0.78) return shade(GLASS, 0.6 + (x > 31 ? 1 : 0))
    return mix(under, GLASS[1] ?? 0, 0.18)
  })
  for (const [x, y] of [[34, 14], [35, 15], [36, 16]] as const) c.set(x, y + dy, 0xffffff)
  for (let y = 19; y <= 28; y++) {
    for (let x = 23; x <= 40; x++) {
      const isBand = y === 24 || y === 25
      const isSeam = x === 31 && !isBand
      const l = (y === 19 ? 4.6 : y < 22 ? 3.8 : y < 27 ? 3 : 1.8) + glow(x) * (isBand ? 0 : 0.6) - (isSeam ? 0.8 : 0)
      c.set(x, y + dy, isBand ? shade(RED, l + 1.2) : shade(HULL, l))
    }
  }
  c.poly([[40.5, 18.5 + dy], [44, 18.8 + dy], [50.5, 24 + dy], [44, 29.2 + dy], [40.5, 29.5 + dy]], (x, y) => shade(RED, 2.2 + (24 + dy - y) * 0.55 + (x > 47 ? 0.5 : 0)))
  for (let y = 19; y <= 28; y++) c.set(41, y + dy, shade(HULL, y < 22 ? 3.4 : 2))
  c.set(49, 23 + dy, shade(RED, 6))
}

const DAY = hex('3a6eb0 4c86c4 64a0d6 84bce4 aad6ee d4ecf4')
const HILLS = hex('5c8ca8 6e9eae 84aeb0')
const GRASS = PALETTE.grass
const STONE = hex('2a2634 3c3848 52506a 6c6c86 8c8ca0 b0b0bc d8d6d8')
const ROOF = hex('2a1640 3e2060 56308a 7044ac 9264c8')
const FLAG = hex('8a1a1e c43226 ee5a32 f8a048')

function castle(c: Canvas, f: number): void {
  const t = f - 39
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) c.set(x, y, shade(DAY, 5 - y / 4.2))
  for (const [cx0, cy, s] of [[6, 5, 1], [44, 3, 0.8], [62, 9, 0.6]] as const) {
    const cx = Math.round(cx0 + t * 0.25 * s)
    for (const [ox, oy, r] of [[0, 0, 2.4], [2.6, -1, 2.6], [5, 0, 2]] as const) {
      c.ellipse(cx + ox * s * 1.4, cy + oy, r * s * 1.4, r * s, (x, y) => (y > cy + 0.5 ? 0xc8dcec : 0xf6fbff))
    }
  }
  for (let x = 0; x < W; x++) {
    const far = 20 - Math.round(Math.sin(x * 0.12 + 1) * 2.2 + Math.sin(x * 0.31) * 0.8)
    for (let y = far; y < H; y++) c.set(x, y, shade(HILLS, y - far < 1 ? 2 : 1))
    const near = 25 - Math.round(Math.cos((x - 32) * 0.06) * 2.6)
    for (let y = near; y < H; y++) {
      const lvl = 4.8 - (y - near) * 0.35 + (x < 30 ? 0.5 : -0.3) + (y === near ? 1 : 0)
      c.set(x, y, shade(GRASS, lvl))
    }
  }
  for (let y = 27; y < H; y++) {
    const w = 3 + (y - 27) * 1.2
    const cx = 32 + Math.round(Math.sin(y * 0.6) * 1.5)
    for (let x = Math.round(cx - w); x <= Math.round(cx + w); x++) c.set(x, y, shade(PALETTE.sand, 4.2 - (y - 27) * 0.2 + (x < cx ? 0.6 : 0)))
  }
  for (const gx of [6, 13, 50, 57, 61]) {
    const lean = wave(f, LOOP, 4, gx * 0.1) > 0.3 ? 1 : 0
    c.set(gx, 30, shade(GRASS, 6.4))
    c.set(gx + lean, 29, shade(GRASS, 7))
  }

  const stone = (x: number, y: number, x0: number, x1: number, extra = 0) => {
    const row = Math.floor(y / 2)
    const isMortar = y % 2 === 0 || mod(x + (row % 2) * 2, 4) === 0
    const sun = x <= x0 ? 1.4 : x >= x1 ? -1.2 : 0
    return shade(STONE, 3.2 + sun + extra - (isMortar ? 0.7 : 0))
  }
  for (const [tx0, tx1] of [[16, 22], [41, 47]] as const) {
    for (let y = 9; y <= 28; y++) for (let x = tx0; x <= tx1; x++) c.set(x, y, stone(x, y, tx0, tx1, y === 9 ? 0.8 : 0))
    const mid = (tx0 + tx1) / 2
    c.poly([[tx0 - 1, 9.5], [tx1 + 1.99, 9.5], [mid + 0.5, 1.5]], (x, y) => shade(ROOF, 2.2 + (x < mid ? 1.6 : 0) + (y === 9 ? -1 : 0)))
    c.rect(mid, 5, 1, 1, shade(ROOF, 1))
    c.set(mid, 14, 0x1a1828)
    c.set(mid, 15, 0x1a1828)
    const px = Math.round(mid)
    c.set(px, 0, shade(STONE, 5))
    c.set(px, 1, shade(STONE, 4))
    for (let i = 1; i <= 5; i++) {
      const ripple = Math.round(Math.sin(f * 0.9 - i * 0.9) * (i / 5) * 0.9)
      const y = 0 + ripple + (i > 3 ? 1 : 0)
      c.set(px + i, y, shade(FLAG, 2.4 - i * 0.25 + (ripple < 0 ? 0.6 : 0)))
      if (i < 4) c.set(px + i, y + 1, shade(FLAG, 1.4 - i * 0.2 + (ripple < 0 ? 0.6 : 0)))
    }
  }
  for (let y = 19; y <= 28; y++) for (let x = 23; x <= 40; x++) c.set(x, y, stone(x, y, 23, 40, y === 19 ? 1.2 : 0))
  kid(c, 0, 0, 1, -1, 1.4, 'crown', true)
  for (const mx of [23, 26, 37, 40]) {
    for (let y = 16; y <= 18; y++) for (let x = mx; x < mx + 2 && x <= 40; x++) c.set(x, y, stone(x, y, mx, mx + 1, y === 16 ? 1.2 : 0.4))
  }
  c.poly([[28.5, 28.5], [28.5, 24.5], [30, 22.5], [33, 22.5], [34.5, 24.5], [34.5, 28.5]], (x, y) => (x === 29 || x === 32 || y === 25 || y === 27 ? 0x3a3048 : 0x161220))
  c.line(16, 29, 47, 29, shade(GRASS, 2.6))
  const bx = Math.round(-4 + t * 1.6)
  const flap = Math.floor(t / 2) % 2
  for (const [x, y] of flap ? ([[0, 0], [1, 1], [2, 0]] as const) : ([[0, 1], [1, 0], [2, 1]] as const)) c.set(bx + x, 7 + y - Math.round(t / 12), 0x2a2a4a)
}

const DUSK = hex('2a1640 4a1e54 7a2a5c aa3c5a d2604c ec8c4c f6bc6a fde4a0')
const SEA = hex('120c2a 1c1440 2a1c52 3e2664 5a3070')
const SHIP = hex('140a14 22101a 361a1e 4e2620 6a3624 8a4a2a')
const SAIL = hex('4a3048 7a5060 a8786e d2a684 f0d6a8')

function ship(c: Canvas, f: number): void {
  const t = f - 60
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < W; x++) {
      const l = 1 + y / 2.8 + Math.max(0, 2 - Math.hypot(x - 50, (y - 19) * 1.6) / 6)
      c.set(x, y, shade(DUSK, l))
    }
  }
  for (const [x0, y, w] of [[2, 6, 14], [36, 4, 10], [22, 11, 18], [46, 13, 12]] as const) {
    const sx = x0 - Math.floor(t / 8)
    for (let x = sx; x < sx + w; x++) {
      c.set(x, y, shade(DUSK, 2 + y / 4))
      if (x > sx + 2 && x < sx + w - 3) c.set(x, y + 1, shade(DUSK, 3.5 + y / 4))
    }
  }
  c.disc(50, 19.5, 4.6, (x, y) => (y < 20 ? shade(DUSK, 6.8 - (y - 15) * 0.25) : undefined))
  for (let y = 20; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const swell = Math.sin(x * 0.45 - t * 0.5 + y * 1.7) + Math.sin(x * 0.2 + t * 0.3 - y)
      let col = shade(SEA, 3.6 - (y - 20) * 0.28 + (swell > 1.1 ? 1 : 0))
      const glintW = 3 + (y - 20) * 0.55
      if (Math.abs(x - 50) < glintW && swell > 0.4 + (y - 20) * 0.06) col = shade(DUSK, 6 - (y - 20) * 0.22)
      c.set(x, y, col)
    }
  }
  c.line(0, 20, W - 1, 20, shade(DUSK, 4.8))

  const dy = Math.round(wave(t, 24, 1) * 0.9)
  const tip = wave(t, 24, 1, 0.25) > 0.3 ? 1 : 0
  const mx = 26
  for (let y = 0; y <= 18; y++) c.set(mx, y + dy, shade(SHIP, 2.4 + (y < 6 ? 0.8 : 0)))
  c.line(mx - 2, 2 + dy, mx + 13, 2 + dy, shade(SHIP, 3))
  const belly = 2 + Math.max(0, wave(t, 24, 1, 0.1)) * 1.4
  for (let y = 3; y <= 11; y++) {
    const v = (y - 3) / 8
    const bulge = Math.sin(v * Math.PI) * belly
    for (let x = mx + 1; x <= mx + 12 + Math.round(bulge); x++) {
      const u = (x - mx) / (12 + bulge)
      c.set(x, y + dy, shade(SAIL, 2 + u * 2.2 + (u > 0.85 ? 0.8 : 0) - (y === 11 ? 0.6 : 0)))
    }
  }
  for (let i = 1; i <= 4; i++) {
    const r = Math.round(Math.sin(f * 1.1 - i) * (i / 4))
    c.set(mx + i, dy - 1 + r + 1 - (i < 2 ? 1 : 0), i % 2 ? 0x1a1018 : 0x2a1a24)
  }
  c.set(mx, dy, shade(SHIP, 3))
  kid(c, 0, dy, 1, 1, 0.6, 'pirate', true)
  const hull: [number, number][] = [[19, 17], [23, 19], [40, 19], [47, 15], [44, 24], [40, 28], [25, 28], [21, 24]]
  c.poly(hull.map(([x, y]) => [x, y + dy + (x > 42 ? -tip : 0)] as [number, number]), (x, y) => {
    const isPlank = (y - dy) % 2 === 0
    const rim = x > 41 || y === 19 + dy ? 2 : 0
    return shade(SHIP, 2.4 + rim - (isPlank ? 0.7 : 0) - (y - 19 - dy) * 0.12)
  })
  c.line(23, 19 + dy, 40, 19 + dy, shade(SHIP, 5))
  for (const px of [28, 32, 36]) c.set(px, 21 + dy, shade(DUSK, 5))
  for (let x = 14; x < 52; x++) {
    const h = Math.round(Math.sin(x * 0.7 - t * 0.9) * 0.8)
    for (let y = 27 + h; y < H; y++) c.set(x, y, shade(SEA, 3.4 - (y - 27) * 0.3 + (y === 27 + h ? 1.6 : 0)))
  }
  const gx = Math.round(10 + wave(t, 24, 1) * 3)
  const gy = 8 + Math.round(wave(t, 24, 1, 0.25))
  const up = Math.floor(t / 3) % 2
  for (const [x, y] of up ? ([[-2, -1], [-1, 0], [0, 0], [1, 0], [2, -1]] as const) : ([[-2, 1], [-1, 0], [0, 0], [1, 0], [2, 1]] as const)) c.set(gx + x, gy + y, 0x2a1a30)
}

type World = 0 | 1 | 2 | 3
const IRIS = [{ start: 18, to: 1 }, { start: 39, to: 2 }, { start: 60, to: 3 }, { start: 81, to: 0 }] as const satisfies readonly { start: number; to: World }[]
const IRIS_LEN = 6
const CX = 31.5
const CY = 15.5
const IDEA = [3, 0] as const
const IDEA_AT = [38, 10] as const

const irisRadius = (k: number) => ease.inOut((k + 1) / IRIS_LEN) * 40

const IRIS_SNAPS: Snap[] = IRIS.flatMap(s =>
  Array.from({ length: IRIS_LEN }, (_, k): Snap => {
    const reach = irisRadius(k) + 3
    return {
      frames: s.start + k,
      box: [Math.max(0, Math.floor(CX - reach)), Math.max(0, Math.floor(CY - reach / 1.15)), Math.min(W - 1, Math.ceil(CX + reach)), Math.min(H - 1, Math.ceil(CY + reach / 1.15))],
      why: 'the iris of imagination: a bright ring opens from the middle onto the next world, ridden by sparkles',
    }
  }),
)

function drawWorld(c: Canvas, w: World, f: number): void {
  if (w === 0) bedroom(c, f)
  else if (w === 1) space(c, f)
  else if (w === 2) castle(c, f)
  else ship(c, f)
}

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    let shown: World = 0
    for (const s of IRIS) if (f >= s.start + IRIS_LEN) shown = s.to
    const iris = IRIS.find(s => f >= s.start && f < s.start + IRIS_LEN)
    drawWorld(c, shown, f)
    if (iris) {
      const next = new Canvas()
      drawWorld(next, iris.to, f)
      const p = (f - iris.start + 1) / IRIS_LEN
      const r = irisRadius(f - iris.start)
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const d = Math.hypot(x - CX, (y - CY) * 1.15)
          if (d < r - 1.2) c.set(x, y, next.get(x, y))
          else if (d < r) c.set(x, y, 0xfff2c4)
          else if (d < r + 1.4 && threshold(x, y) < 0.35) c.tint(x, y, 0xfff2c4, 0.6)
        }
      }
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + p * 2
        const sx = Math.round(CX + Math.cos(a) * (r + 1.5))
        const sy = Math.round(CY + Math.sin(a) * (r + 1.5) / 1.15)
        c.set(sx, sy, 0xffffff)
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.tint(sx + ox, sy + oy, 0xfff2c4, 0.7)
      }
    }
    const idea = IRIS.find(s => f >= s.start - IDEA[0] && f <= s.start + IDEA[1])
    if (idea) {
      const k = f - idea.start + IDEA[0]
      const [sx, sy] = IDEA_AT
      c.set(sx, sy, 0xffffff)
      if (k === 1 || k === 2) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.set(sx + ox, sy + oy, 0xfff2c4)
      if (k === 1) for (const [ox, oy] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as const) c.tint(sx + ox, sy + oy, 0xfff2c4, 0.6)
    }
  })
}

export const scene: Scene = {
  verb: 'Imagining',
  render,
  hero: 30,
  snaps: [
    ...IRIS_SNAPS,
    {
      frames: [IRIS[0].start, IRIS[1].start + IRIS_LEN - 1],
      box: [0, 0, W - 1, H - 1],
      colors: STAR_COLORS,
      why: 'the starfield streams past the rocket in three layers, the nearest four pixels a frame, all over the sky',
    },
    {
      frames: [IRIS[2].start, IRIS[3].start + IRIS_LEN - 1],
      box: [41, 21, 59, 31],
      colors: DUSK.slice(3),
      why: "the sun's path on the sea: glints flash on and off the swells as they roll",
    },
    ...IRIS.map((s): Snap => ({
      frames: [s.start - IDEA[0], s.start + IDEA[1] + 1],
      box: [IDEA_AT[0] - 2, IDEA_AT[1] - 2, IDEA_AT[0] + 2, IDEA_AT[1] + 2],
      why: "the idea: a twinkle pops by the kid's head as the iris opens, and dies away",
    })),
  ],
}
