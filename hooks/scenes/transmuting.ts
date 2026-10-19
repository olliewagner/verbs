import { PALETTE, beat, ease, frames, hash, hex, shade, threshold, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const STONE = hex('0a0c10 10151a 161d1f 1e2826 283329 37402f 4c5236 6a6a40 928748 bca85a')
const IRON = hex('07080c 101218 1a1d25 262a34 343946 474d5a 62666f 8a857c bfae86 eedca8')
const LEAD = hex('23262e 30343e 404552 535867 696e7c 838896 a3a7b0 c4c7cd')
const GOLD = PALETTE.gold
const FIRE = PALETTE.fire
const WOOD = PALETTE.wood
const SKY = hex('060a1c 0b1430 132048')
const MOON = hex('9fb0c8 dfe8f0')
const WAX = PALETTE.cream
const GLASS = { green: hex('16402a 2a6e3c 9ad07a'), red: hex('4a1018 7c1c24 e0705a'), blue: hex('182a5c 2a4a8e 8ab4e6') }

const INGOT: readonly (readonly [number, number])[] = [[3, 14], [2, 15], [1, 16], [1, 16], [0, 17], [0, 17]]
const CRACKS: readonly (readonly [number, number])[][] = [
  [[8, 3], [7, 3], [6, 2], [5, 2], [4, 3], [3, 3], [2, 4], [1, 4]],
  [[9, 3], [10, 3], [11, 4], [12, 4], [13, 3], [14, 3], [15, 4], [16, 4]],
  [[8, 2], [7, 1], [6, 1], [5, 0]],
  [[9, 2], [10, 1], [11, 1], [12, 0]],
  [[7, 4], [6, 5], [5, 5]],
  [[10, 4], [11, 5], [12, 5]],
]
const CRACK_AT: ReadonlyMap<number, number> = (() => {
  const at = new Map<number, number>()
  for (const path of CRACKS) {
    path.forEach(([x, y], k) => {
      const t = k / Math.max(1, path.length - 1)
      at.set(y * 32 + x, Math.min(at.get(y * 32 + x) ?? 1, t))
    })
  }
  return at
})()

const SEAT_X = 24
const SEAT_Y = 13
const CX = 32.5
const CY = 15.5

const carry = (t: number) => 18 * t ** 1.2
const reach = (t: number) => 22 * t ** 1.6

function tongsUp(f: number): number | undefined {
  if (f < 10) return carry(1 - f / 10)
  if (f < 13) return 0
  if (f < 21) return reach((f - 12) / 8)
  if (f < 52) return undefined
  if (f < 60) return reach(1 - (f - 52) / 8)
  if (f < 62) return 0
  return [1, 3, 5, 7, 9, 11, 13, 15, 17][f - 62]
}
const isOpen = (f: number) => f >= 11 && f < 61
const ingotUp = (f: number) => (f < 10 || f >= 62 ? tongsUp(f) : 0)
const HEAT_AT = 23
const FLASH = 41
const isGold = (f: number) => f >= FLASH
const heat = (f: number) => (f >= FLASH ? 0 : ease.in(beat(f, HEAT_AT, FLASH - 1)))

function glow(f: number): number {
  if (f === FLASH) return 2.6
  if (f === FLASH + 1) return 1.6
  if (isGold(f)) return f < 63 ? 0.75 - beat(f, 43, 63) * 0.15 : 0.6 * (1 - beat(f, 63, 71) ** 2)
  return heat(f) ** 1.5 * 0.9
}

const CANDLE = { x: 9, y: 7 }

const ANVIL = [
  '....TTTTTTTTTTTTTTTTTTTTTTTTTTT.',
  'TTTTFFFFFFFFFFFFFFFFFFFFFFFFFFFH',
  '..SSSFFFFFFFFFFFFFFFFFFFFFFFFFS.',
  '.......SSSSDDDDDDDDDDDDDDDSSS...',
  '...........LDDDDDDDDDDDDD.......',
  '...........LDDDDDDDDDDDDD.......',
  '.........LLDDDDDDDDDDDDDDDD.....',
  '........LMMMMMMMMMMMMMMMMMMM....',
]

function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const up = ingotUp(f)
    const iy = up === undefined ? -40 : CY - up
    const flicker = 0.5 + 0.06 * Math.sin(f * 1.9) + 0.04 * Math.sin(f * 4.7)
    const g = up === undefined ? 0 : glow(f)
    const flash = f === FLASH ? 1.2 : f === FLASH + 1 ? 0.5 : 0
    const light = (x: number, y: number) => {
      const dc = Math.hypot(x - CANDLE.x, (y - CANDLE.y) * 1.2)
      const di = Math.hypot(x - CX, (y - iy) * 1.2)
      return flicker * Math.max(0, 1 - dc / 30) ** 1.5 + g * Math.max(0, 1 - di / 40) ** 1.5 + flash * 0.6
    }

    for (let y = 0; y < 27; y++) {
      for (let x = 0; x < W; x++) {
        const row = Math.floor((y + 2) / 7)
        const joint = (k: number) => k * 13 + Math.floor(hash(row, k) * 6)
        let k = Math.floor((x + row * 7) / 13) + 1
        while (joint(k) - row * 7 > x) k--
        const isMortar = joint(k) - row * 7 === x || (y + 2) % 7 === 0
        const isTop = !isMortar && (y + 2) % 7 === 1
        const tone = (hash(row, k, 3) - 0.5) * 0.7
        const lit = isMortar ? light(x, y) : light(joint(k) - row * 7 + 6.5, row * 7 + 1.5)
        c.set(x, y, shade(STONE, 2.7 + tone + lit * 4.6 - (isMortar ? 1.4 : 0) + (isTop ? 0.5 + lit : 0)))
      }
    }

    for (let y = 2; y <= 14; y++) {
      for (let x = 49; x <= 59; x++) {
        const isArch = y < 7 && Math.hypot(x - 54, (y - 7) * 1.1) > 5.6
        if (isArch) continue
        const isFrame = x === 49 || x === 59 || Math.hypot(x - 54, (y - 7) * 1.1) > 4.7 && y < 7 || y === 14
        if (isFrame) {
          c.set(x, y, shade(STONE, 2.6 + light(x, y) * 4 + (x === 49 ? -0.6 : 0)))
          continue
        }
        if (x === 54) {
          c.set(x, y, shade(STONE, 1.4 + light(x, y) * 3))
          continue
        }
        c.set(x, y, shade(SKY, 2 - (y - 2) * 0.18))
      }
    }
    for (const [x, y] of [[56, 4], [57, 5], [57, 6], [57, 7], [56, 8]] as const) c.set(x, y, MOON[1] ?? 0)
    for (const [x, y] of [[55, 4], [56, 5], [56, 7], [55, 8]] as const) c.set(x, y, MOON[0] ?? 0)
    c.set(51, 5, 0x6a7aa8)
    c.set(52, 10, 0x4a5888)

    for (let x = 0; x <= 17; x++) {
      c.set(x, 11, shade(WOOD, 2.6 + light(x, 11) * 4))
      c.set(x, 12, shade(WOOD, 0.8 + light(x, 12) * 2))
    }
    c.set(3, 13, shade(WOOD, 1 + light(3, 13) * 2))
    c.set(15, 13, shade(WOOD, 1 + light(15, 13) * 2))
    const flask = (x0: number, art: readonly string[], ramp: readonly number[]) => {
      art.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
          const ch = row[i]
          if (ch === ' ' || ch === undefined) continue
          const x = x0 + i
          const y = 11 - art.length + j
          const lit = light(x, y)
          const level = (ch === 'g' ? 2 : ch === 'l' ? 1 : 0) + (lit > 0.9 ? 1 : 0)
          c.set(x, y, ch === 'c' ? shade(WOOD, 3 + lit * 3) : shade(ramp, level))
        }
      })
    }
    flask(1, [' c ', ' d ', 'dld', 'lgl', 'lll'], GLASS.green)
    flask(4, ['c', 'd', 'd', 'l', 'g', 'l', 'l'], GLASS.red)
    flask(13, [' cc ', 'dddd', 'dlld', 'dgld', 'dlld'], GLASS.blue)
    for (let y = 8; y <= 10; y++) for (let x = 8; x <= 10; x++) c.set(x, y, shade(WAX, 2.4 + light(x, y) * 2.4 + (x === 8 ? -1 : 0)))
    c.set(9, 7, 0x3a2a24)
    const lean = Math.sin(f * 0.7) > 0.4 ? 1 : 0
    c.set(9, 6, FIRE[7] ?? 0)
    c.set(9 + lean, 5, FIRE[6] ?? 0)
    if (Math.sin(f * 1.3) > -0.3) c.set(9 + lean, 4, FIRE[4] ?? 0)

    for (let y = 27; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const isJoint = (x + (y === 29 ? 6 : 0)) % 13 === 0 || y === 29
        const moon = y >= 28 && x - (y - 28) * 1.5 >= 48 && x - (y - 28) * 1.5 <= 56
        const shadow = x >= 43 && x <= 52 && y <= 29 ? -0.8 : 0
        c.set(x, y, shade(STONE, 1.2 + light(x, y) * 4 - (isJoint ? 0.7 : 0) + (moon ? 1.4 : 0) + shadow + (y === 27 ? -0.6 : 0)))
      }
    }

    for (let y = 27; y < H; y++) {
      for (let x = 22; x <= 43; x++) {
        if ((y === 27 || y === H - 1) && (x === 22 || x === 43)) continue
        const lit = light(x, y)
        const isTop = y === 27
        const bark = (x * 5 + Math.floor(y / 2)) % 4 === 0 ? -0.8 : 0
        const side = x <= 23 ? 0.7 : x >= 42 ? -0.9 : 0
        c.set(x, y, shade(WOOD, (isTop ? 3.8 : 1.9 + bark) + lit * 3 + side))
      }
    }

    const ANVIL_LEVEL: Record<string, number> = { T: 5, F: 3, H: 2.2, S: 0.8, D: 1.5, L: 2.8, M: 2.2 }
    ANVIL.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const base = ANVIL_LEVEL[row[i] ?? '.']
        if (base === undefined) continue
        const x = 15 + i
        const y = 19 + j
        c.set(x, y, shade(IRON, base + light(x, y) * (row[i] === 'T' ? 4.4 : 3)))
      }
    })

    if (up !== undefined) {
      const shiver = f >= 36 && f <= 40 ? [0, 1, 0, -1][f % 4] ?? 0 : 0
      const ox = SEAT_X + shiver
      const oy = Math.round(SEAT_Y - up)
      const h = heat(f)
      if (up === 0) for (let x = ox; x <= ox + 17; x++) c.set(x, 19, shade(IRON, (isGold(f) ? 6.5 : 2.8) + light(x, 19) * 2 + h * 3))
      INGOT.forEach(([lo, hi], r) => {
        for (let i = lo; i <= hi; i++) {
          const x = ox + i
          const y = oy + r
          const end = i === lo ? -1.1 : i === hi ? -0.5 : 0
          const face = [4.6, 4.8, 5.8, 3.8, 3.5, 3][r] ?? 3
          if (f === FLASH) {
            c.set(x, y, GOLD[7] ?? 0)
            continue
          }
          if (isGold(f)) {
            const sweep = -4 + beat(f, 44, 52) * 26
            const d = Math.abs(i + r - sweep)
            const glint = f >= 44 && f <= 52 ? (d < 1 ? 3 : d < 2.2 ? 1.4 : 0) : 0
            c.set(x, y, shade(GOLD, face + 0.4 + end + glint))
            continue
          }
          const lit = light(x, y) - g * 0.8
          const along = CRACK_AT.get(r * 32 + i)
          const spread = h * 1.4
          if (along !== undefined && along < spread) {
            const fresh = Math.min(1, (spread - along) / 0.05)
            c.set(x, y, shade(FIRE, 2.2 + (2.4 + h * 2.6 + (spread - along) * 1.2) * fresh))
            continue
          }
          const leak = h > 0.3 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
            const t = CRACK_AT.get((r + (dy ?? 0)) * 32 + i + (dx ?? 0))
            return t !== undefined && t < spread
          })
          if (h > 0.45 && threshold(x, y) < (h - 0.45) / 0.45) {
            c.set(x, y, shade(GOLD, face - 2 + (h - 0.45) * 4 + end + (leak ? 1.2 : 0)))
            continue
          }
          c.set(x, y, shade(LEAD, face - 0.4 + end + lit * 2 - h * 1.2 + (leak ? 1.4 : 0)))        }
      })
    }

    for (let i = 0; i < 12; i++) {
      const start = 25 + i * 1.2
      const t = (f - start) / 9
      if (t < 0 || t > 1) continue
      const at = (u: number) => {
        const r = (12 + (i % 3) * 4) * (1 - ease.in(u))
        const a = i * 2.4 + u * 2.2
        return [CX + Math.cos(a) * r, CY + Math.sin(a) * r * 0.55] as const
      }
      const [px, py] = at(Math.max(0, t - 0.12))
      const [x, y] = at(t)
      c.set(px, py, FIRE[5] ?? 0)
      c.set(x, y, FIRE[7] ?? 0)
    }

    const tu = tongsUp(f)
    if (tu !== undefined) {
      const jy = Math.round(SEAT_Y - tu)
      const open = isOpen(f) ? 1 : 0
      const tong = (x: number, y: number, base: number) => c.set(x, y, shade(IRON, base + light(x, y) * 3.2))
      for (const side of [-1, 1]) {
        const jx = side < 0 ? SEAT_X - 1 - open : SEAT_X + 18 + open
        for (let y = jy + 1; y <= jy + 5; y++) tong(jx, y, side < 0 ? 4.6 : 3.4)
        tong(jx - side, jy + 6, 3.2)
        c.line(jx, jy, CX - side * 0.5, jy - 6, (x, y) => shade(IRON, (side < 0 ? 4.8 : 3.6) + light(x, y) * 3.2))
        for (let y = jy - 7; y >= -1; y--) tong(Math.round(CX + side * 1.5), y, side < 0 ? 3.4 : 4.6)
      }
      c.set(Math.floor(CX), jy - 6, shade(IRON, 6 + light(CX, jy - 6) * 2))
      c.set(Math.ceil(CX), jy - 6, shade(IRON, 4.4 + light(CX, jy - 6) * 2))
    }

    if (f >= FLASH && f <= FLASH + 2) {
      const r = [6, 10, 14][f - FLASH] ?? 14
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const d = Math.hypot(x - CX, (y - CY) * 1.3)
          if (f === FLASH && d < r) c.set(x, y, shade(GOLD, 8 - d * 0.4))
          if (f > FLASH && d > r - 1.4 && d < r && threshold(x, y) < (f === FLASH + 1 ? 0.75 : 0.4)) c.set(x, y, GOLD[f === FLASH + 1 ? 6 : 5] ?? 0)
        }
      }
    }

    if (isGold(f) && up === 0) {
      const winks: [number, number, number][] = [[23, 12, 44], [41, 13, 47], [36, 10, 50], [27, 15, 53], [39, 17, 56], [30, 11, 58]]
      for (const [x, y, s] of winks) {
        const size = [1, 2, 3, 2, 1][f - s]
        if (size === undefined) continue
        c.set(x, y, GOLD[7] ?? 0)
        for (let k = 1; k < size; k++) {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.set(x + dx * k, y + dy * k, GOLD[k === 1 ? 6 : 5] ?? 0)
        }
      }
    }

    if (f >= 10 && f <= 13) {
      const t = f - 10
      for (const side of [-1, 1]) {
        const x = side < 0 ? SEAT_X - 1 - t : SEAT_X + 18 + t
        c.set(x, 18 - (t > 1 ? 1 : 0), shade(STONE, 5 - t))
        if (t < 3) c.set(x - side, 18, shade(STONE, 4 - t))
      }
    }
  })
}

export const scene: Scene = {
  verb: 'Transmuting',
  render,
  hero: 49,
  snaps: [
    { frames: HEAT_AT + 1, box: [31, 15, 34, 17], why: 'the first vein of fire sparks dark red in the heart of the lead' },
    { frames: [FLASH, FLASH + 2], why: 'the white flash that turns the lead to gold lights the whole room, then a ring runs out as it fades' },
  ],
}
