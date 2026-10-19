import { Canvas, clamp, ease, hash, hex, lerp, mod, shade, smoothstep, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const WALL = hex('080812 0e0f20 151831 1d2243 272e57 323b6b 404c82')
const CANDLELIT = hex('120c12 21151a 33201f 4a2e26 63402e 7e5536 9a6c40')
const FLOOR = hex('060406 0c080b 140f13 1d161c 282029 343552 4b5884')
const SKY = hex('0a1230 0f1a44 15255a 1d3272 284288 3756a0 4e70b8')
const MOON = hex('a8bcdc d8e4f6 f8fbff')
const FRAME = hex('07050a 100c12 1a141c 261e2a 3a3450 5a6894')
const LACQUER = hex('020204 060609 0b0b12 13131d 1d1f2e 2c3148 46507a 7a88bc c2d0f2')
const GLEAM = hex('1a0e0c 3a1c12 6a3416 a85a22 e09440 fcd080 fff4d8')
const PLATE = hex('140c05 26170a 3e260e 5e3c16 845a22 b08034 d8aa50')
const IVORY = hex('2c2620 4c4236 7c6e58 b2a284 dcd0b0 f8eed6 fffaf0')
const EBONY = hex('030304 0d0d12 1c1c26')
const BRASS = hex('2a1a08 5a3a10 9a6c20 d8a840 f8e08a')
const WAX = hex('6a5a48 a89878 e0d4b4 fbf4e2')
const FLAME = hex('7a1f0c c4471a f0862a fcc35a fff0b8 fffdf0')
const DRAPE = hex('12060e 1e0a18 2e1024 431834 5c2448 7a3a66')
const NOTE = hex('7a5028 c08a40 f0c060 fde4a0 fffaea')
const STARLIGHT = hex('34446e 6e86bc b8ccf4 eef4ff')

const OX = 10
const TOP_Y = 22
const DEPTH = 0.18
const at = (x: number, y: number, z: number): [number, number] => [OX + x - z * DEPTH, TOP_Y - y - z * DEPTH]

const OUTLINE: readonly (readonly [number, number])[] = [
  [0, 0], [31, 0], [33.4, 4.6], [33.4, 12.4], [31, 21.6], [25.4, 31], [17.6, 38.8], [9.3, 43.4], [0, 43.4],
]
const RIM = 3
const LEGS = 6
const LID = 0.55
const lid = (x: number, z: number): [number, number] => at(x * Math.cos(LID), x * Math.sin(LID), z)
const WALL_Z = 56
const FLOOR_Y = (z: number) => TOP_Y + RIM + LEGS - z * DEPTH

const KX = OX + 1
const KW = 3
const KEYS = 10
const KY = TOP_Y
const hasBlack = (k: number) => k < KEYS - 1 && [0, 1, 3, 4, 5].includes(k % 7)

const WX0 = 45
const WX1 = 61
const WMID = 53
const MOON_X = 57
const MOON_Y = 6
const CANDLE_X = 14
const CANDLE_Y = 11

type Press = { at: number; key: number; hold: number }
const PHRASE: Press[] = [
  { at: 0, key: 2, hold: 4 }, { at: 6, key: 4, hold: 4 }, { at: 12, key: 6, hold: 4 }, { at: 18, key: 5, hold: 3 },
  { at: 22, key: 7, hold: 3 }, { at: 26, key: 8, hold: 5 }, { at: 33, key: 6, hold: 4 },
  { at: 40, key: 1, hold: 12 }, { at: 40, key: 3, hold: 12 }, { at: 40, key: 5, hold: 12 },
]

function pressed(key: number, f: number): number {
  let d = 0
  for (const p of PHRASE) {
    if (p.key !== key) continue
    const t = mod(f - p.at, LOOP)
    if (t < p.hold) d = 1
    else if (t < p.hold + 2) d = Math.max(d, 0.5)
  }
  return d
}

const GLYPHS = [
  ['.#..', '.##.', '.#.#', '.#..', '##..', '##..'],
  ['.#', '.#', '.#', '.#', '##', '##'],
  ['.####', '.#..#', '.#..#', '.#..#', '##.##', '##.##'],
]

type Note = { born: number; glyph: number; x: number; y: number; sway: number; rise: number; drift: number }
const NOTES: Note[] = PHRASE.map((p, i) => {
  const chord = p.hold > 8 ? i - 8 : 0
  return {
    born: p.at + 2 + chord * 3,
    glyph: chord !== 0 ? (chord > 0 ? 2 : 1) : i % 3 === 1 ? 1 : i % 3 === 2 ? 2 : 0,
    x: 33 + p.key * 0.4 + hash(i, 1) * 2 + chord * 6.5,
    y: 15 + hash(i, 2) * 2 + chord * 2,
    sway: hash(i, 3) * 6.28,
    rise: 0.8 + hash(i, 4) * 0.4 - chord * 0.15,
    drift: 11 + hash(i, 5) * 4 + chord * 2,
  }
})
const NOTE_LIFE = 44

function render(): Int32Array[] {
  return Array.from({ length: LOOP }, (_, f) => {
    const c = new Canvas()
    const flicker = 0.92 + 0.05 * wave(f, LOOP, 19) + 0.03 * wave(f, LOOP, 61)
    const candle = (x: number, y: number) => flicker * Math.max(0, 1 - Math.hypot(x - CANDLE_X, (y - CANDLE_Y) * 1.15) / 30) ** 1.3
    const moon = (x: number, y: number) => clamp(1 - Math.hypot(x - 53, (y - 10) * 0.8) / 26)
    const wallBottom = FLOOR_Y(WALL_Z)

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (y >= wallBottom) {
          const t = (y - wallBottom) / (H - wallBottom)
          const isPool = x > lerp(WX0 + 1, WX0 - 7, t) && x < lerp(WX1 - 1, WX1 - 9, t) && Math.abs(x - lerp(WMID, WMID - 8, t)) > 0.9
          const board = [2, 5, 9].includes(y - Math.ceil(wallBottom)) ? -0.6 : 0
          c.set(x, y, shade(FLOOR, 1.6 + board + candle(x, y) * 2.4 + (isPool ? 3.8 : 0) - (Math.floor(y) === Math.floor(wallBottom) ? 0.8 : 0), x, y))
          continue
        }
        const warm = candle(x, y) * 6.2
        const cool = 1.4 + moon(x, y) * 3.6
        c.set(x, y, warm > cool ? shade(CANDLELIT, warm - 0.6, x, y) : shade(WALL, cool, x, y))
      }
    }
    const archY = (x: number) => 1.5 + 5 * (1 - Math.sqrt(Math.max(0, 1 - ((x - (WX0 + WX1) / 2) / ((WX1 - WX0) / 2)) ** 2)))
    for (let y = 0; y < wallBottom; y++) {
      for (let x = WX0 - 1; x <= WX1 + 1; x++) {
        const top = archY(x)
        if (y < top - 1) continue
        const isFrame = y < top || x <= WX0 || x >= WX1 || x === WMID || y >= wallBottom - 2 || (y === 12 && x > WMID)
        if (isFrame) {
          c.set(x, y, shade(FRAME, (x === WMID || x === WX1 ? 1.4 : 0.8) + (y >= wallBottom - 2 ? 1.4 : 0), x, y))
          continue
        }
        const d = Math.hypot(x - MOON_X, y - MOON_Y)
        let col = shade(SKY, 1 + (y / 20) * 2.2 + Math.max(0, 1 - d / 8) * 2.4, x, y)
        if (d < 2.7) col = shade(MOON, d < 1.7 ? 2 : 1, x, y)
        if (d < 1.4 && x < MOON_X && y > MOON_Y - 1) col = MOON[1] ?? 0
        if (hash(x, y, 7) < 0.035 && d > 5) col = shade(SKY, 4.6 + hash(x, y, 8) * 1.6 + wave(f, LOOP, 3, x * 0.37) * 0.6, x, y)
        c.set(x, y, col)
      }
    }
    for (let y = 9; y < wallBottom - 2; y++) {
      c.set(WX0 - 2, y, FRAME[2] ?? 0)
      c.set(WX0 - 3, y + 1, shade(FRAME, 3 + moon(WX0, y) * 2, 0, 0))
    }
    for (let y = 0; y < wallBottom; y++) {
      const stir = y > wallBottom - 6 ? Math.round(wave(f, LOOP, 2) * 0.6 * (y - wallBottom + 6) / 6) : 0
      ;[2.4, 1.4].forEach((level, i) => {
        const x = 62 + i + stir
        c.set(x, y, shade(DRAPE, level + moon(x, y) * 1.6 - (y < 1 ? 0.6 : 0), x, y))
      })
    }

    for (let x = 3; x <= 44; x++) {
      const y = Math.round(lerp(FLOOR_Y(36), FLOOR_Y(0), clamp((x - 3) / 12)))
      for (let j = y - 1; j < H; j++) if (j >= wallBottom) c.set(x, j, shade(FLOOR, 0.4, x, j))
    }
    {
      const [lx, ly] = at(4, -RIM, 38)
      for (let y = Math.round(ly); y < FLOOR_Y(38); y++) {
        c.set(lx, y, shade(LACQUER, 1.6, lx, y))
        c.set(lx + 1, y, shade(LACQUER, 1, lx + 1, y))
      }
    }
    c.poly([at(0, 0, 0), at(0, 0, 43.4), at(0, -RIM, 43.4), at(0, -RIM, 0)], (x, y) => shade(LACQUER, 1 + candle(x, y) * 1.2, x, y))
    c.poly(OUTLINE.map(([x, z]) => at(x, 0, z)), (x, y) => {
      const isString = x % 3 === 0
      return shade(PLATE, 2 + candle(x, y) * 1.4 + moon(x, y) * 2.2 + (isString ? 1.2 : 0), x, y)
    })
    c.poly([at(31, 0, 0), at(33.4, 0, 4.6), at(33.4, 0, 12.4), at(33.4, -RIM, 12.4), at(33.4, -RIM, 4.6), at(31, -RIM, 0)], (x, y) =>
      shade(LACQUER, 2 + moon(x, y) * 3, x, y))
    const lidPts = OUTLINE.map(([x, z]) => lid(x, z))
    c.poly(lidPts, (x, y) => {
      const height = clamp((TOP_Y - y) / 18)
      const streak = Math.abs((x - CANDLE_X) * 0.55 + (y - CANDLE_Y) * 0.85)
      if (streak < 0.75 && x > CANDLE_X + 1) return shade(GLEAM, 1 + candle(x, y) * 4.4, x, y)
      return shade(LACQUER, 1.4 + height * 1.4 + candle(x, y) * 0.8, x, y)
    })
    const rimLight = (x: number, y: number, boost = 0) => {
      const warm = candle(x, y) * 5 + boost
      const cool = moon(x, y) * 6
      return warm >= cool ? shade(GLEAM, 1.6 + warm, x, y) : shade(LACQUER, 4 + cool * 0.7, x, y)
    }
    lidPts.slice(0, -1).forEach((p, i) => {
      const q = lidPts[i + 1]
      if (q) c.line(p[0], p[1], q[0], q[1], (x, y) => rimLight(x, y, i === 0 ? 0.6 : 0))
    })
    {
      const [x0, y0] = at(0, 0, 0)
      const [x1, y1] = at(0, 0, 43.4)
      c.line(x0, y0, x1, y1, (x, y) => rimLight(x, y, -0.4))
    }
    {
      const [x0, y0] = at(30, 0, 9)
      const [x1, y1] = lid(30, 9)
      c.line(x0, y0, x1, y1, (x, y) => shade(LACQUER, 3 + moon(x, y) * 3, x, y))
    }
    c.poly([at(0, 0, 0), at(31, 0, 0), at(31, -RIM, 0), at(0, -RIM, 0)], (x, y) => shade(LACQUER, 1.2 + candle(x, y) * 2.6, x, y))
    c.poly([at(6.5, 1.5, 3), at(24.5, 1.5, 3), at(24.5, 8.4, 4.6), at(6.5, 8.4, 4.6)], (x, y) => shade(LACQUER, 1.6 + candle(x, y) * 2.4, x, y))
    c.poly([at(8, 2.2, 3.1), at(23, 2.2, 3.1), at(23, 7.6, 4.4), at(8, 7.6, 4.4)], (x, y) => {
      const staff = y % 2 === 0 && (x * 3 + y) % 7 > 1 ? -1.2 : 0
      return shade(IVORY, 2.2 + candle(x, y) * 2.6 + staff, x, y)
    })

    for (let x = KX - 1; x <= KX + KEYS * KW; x++) c.set(x, KY - 3, shade(LACQUER, 1.4 + candle(x, KY - 3) * 2, x, KY - 3))
    for (let k = 0; k < KEYS; k++) {
      const down = pressed(k, f)
      for (let dx = 0; dx < KW; dx++) {
        const x = KX + k * KW + dx
        const lit = candle(x, KY) * 1.4
        if (dx === KW - 1) {
          for (let y = KY - 2; y <= KY; y++) c.set(x, y, shade(IVORY, 2 + lit - (y === KY - 2 ? 0.6 : 0), x, y))
          c.set(x, KY + 1, shade(IVORY, 0.8 + lit * 0.5, x, KY + 1))
          continue
        }
        const sink = down > 0.7 ? 1 : 0
        c.set(x, KY - 2, sink ? shade(EBONY, 1, x, KY - 2) : shade(IVORY, 4.4 + lit - down * 1.5, x, KY - 2))
        c.set(x, KY - 1, shade(IVORY, 5 + lit - down * 2.4, x, KY - 1))
        c.set(x, KY, shade(IVORY, 5.4 + lit - down * 2.6, x, KY))
        c.set(x, KY + 1, sink ? shade(LACQUER, 1, x, KY + 1) : shade(IVORY, 2.6 + lit * 0.6 - down, x, KY + 1))
      }
      if (hasBlack(k)) {
        const x = KX + k * KW + KW - 1
        c.set(x, KY - 2, shade(EBONY, 0.6, 0, 0))
        c.set(x, KY - 1, shade(EBONY, 1.6 + candle(x, KY) * 1.2, 0, 0))
      }
    }
    for (const cx of [KX - 1, KX + KEYS * KW]) for (let y = KY - 2; y <= KY + 1; y++) c.set(cx, y, shade(LACQUER, 2 + candle(cx, y) * 2.6, cx, y))
    for (let x = KX - 1; x <= KX + KEYS * KW; x++) {
      for (let y = KY + 2; y <= KY + RIM; y++) c.set(x, y, shade(LACQUER, 1 + candle(x, y) * 2.2 + (y === KY + 2 ? 0.8 : 0), x, y))
    }
    for (const lx of [KX, KX + KEYS * KW - 2]) {
      for (let y = KY + RIM + 1; y < FLOOR_Y(1.5); y++) {
        c.set(lx, y, shade(LACQUER, 1.6 + candle(lx, y) * 2.2, lx, y))
        c.set(lx + 1, y, shade(LACQUER, 1 + moon(lx, y) * 1.4, lx + 1, y))
      }
    }
    const mid = KX + Math.floor((KEYS * KW) / 2) - 1
    for (let y = KY + RIM + 1; y < FLOOR_Y(1.5) - 1; y++) c.set(mid, y, shade(LACQUER, 1.4 + candle(mid, y) * 1.6, 0, 0))
    for (const dx of [-2, 0, 2]) c.set(mid + dx, FLOOR_Y(1.5) - 1, shade(BRASS, 2 + candle(mid, 28) * 2, 0, 0))

    for (let x = CANDLE_X - 1; x <= CANDLE_X + 3; x++) c.set(x, CANDLE_Y + 6, BRASS[x === CANDLE_X ? 3 : 2] ?? 0)
    c.set(CANDLE_X + 3, CANDLE_Y + 5, BRASS[1] ?? 0)
    for (const dx of [-1, 0, 1]) c.set(CANDLE_X + dx, CANDLE_Y + 5, BRASS[dx === 1 ? 2 : 4] ?? 0)
    for (let y = CANDLE_Y + 1; y <= CANDLE_Y + 4; y++) {
      c.set(CANDLE_X, y, WAX[3] ?? 0)
      c.set(CANDLE_X + 1, y, WAX[1] ?? 0)
    }
    const tall = f % 7 === 3 ? 1 : 0
    c.set(CANDLE_X, CANDLE_Y, FLAME[5] ?? 0)
    c.set(CANDLE_X + 1, CANDLE_Y, FLAME[3] ?? 0)
    c.set(CANDLE_X, CANDLE_Y - 1, FLAME[4] ?? 0)
    c.set(CANDLE_X + (f % 9 < 4 ? 0 : 1), CANDLE_Y - 2 - tall, FLAME[2] ?? 0)

    for (const n of NOTES) {
      const t = mod(f - n.born, LOOP)
      if (t >= NOTE_LIFE) continue
      const u = t / NOTE_LIFE
      const x = Math.round(n.x + ease.inOut(u) * n.drift + 0.5 * Math.sin(u * 7 + n.sway))
      const y = Math.round(n.y - ease.out(u) * 10 * n.rise + Math.sin(u * 5 + n.sway) * 0.5 * 0.8)
      if (t >= 27) {
        const s = clamp((t - 28) / (NOTE_LIFE - 28))
        c.set(x, y, shade(STARLIGHT, 3 - s * 1.8, 0, 0))
        if (t >= 28 && s < 0.4) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.set(x + dx, y + dy, STARLIGHT[1] ?? 0)
      }
      const gone = clamp((t - 24) / 5)
      if (gone >= 1) continue
      const art = GLYPHS[n.glyph] ?? GLYPHS[0] ?? []
      const color = shade(NOTE, 2 + Math.min(2, t / 2.5) - smoothstep(0.6, 0.76, u) * 1.6, 0, 0)
      art.slice(0, 2 * (t + 1)).forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
          if (row[i] === '#' && hash(n.born, i, j) >= gone) c.set(x - 1 + i, y - 5 + j, color)
        }
      })
    }
    return c.px
  })
}

export const scene: Scene = { verb: 'Composing', render, hero: 46 }
