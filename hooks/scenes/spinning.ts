import { TAU, ease, frames, hash, hex, lerp, mod, shade, wave, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 48

const WALL = hex('1c1724 28202f 362b3c 46384a 584658 6e5762 8c6c6c b08b7e d2ad92 ecd0a6 fbe9c4')
const OAK = hex('140d0c 22150f 341f14 4a2c1a 643d22 80512c a06a38 c08848')
const WHEEL = hex('1a0e0e 2c1514 431f19 5e2c1e 7c3d24 9c522c bd6e38 d89048 f0b86a')
const WOOL = hex('5e5250 8a7c72 b4a592 d8cbb4 f1e8d2 fffbf0')
const SHAWL = hex('2c0c18 4a1424 701f30 98303a c04c44 e07a5a')
const DRESS = hex('10142a 1a2140 283458 3a4a72')
const SKIN = hex('5a3028 8a5040 b47458 d89a78 f0c09c')
const HAIR = hex('3e3a48 625e6c 8e8a96 bcb8c0')
const YARNS = [hex('4a1420 7a2430 a83a3c'), hex('141c3c 243466 3a5490'), hex('5a4410 8e6e1c c09c34')]
const CAT = hex('1c1a22 2e2a36 46404e 625a68 857c88 aaa0a8')

const FLOOR = 27

const C = { x: 49, y: 12 }
const R = 10
const ORIFICE_X = 23
const AXLE_Y = 12
const WHORL_X = 37
const tableY = (x: number) => 21 - ((x - 20) * 3) / 42

function wheelAt(x: number, y: number, th: number): 'rim' | 'spoke' | 'blur' | 'haze' | 'hub' | undefined {
  const dx = x - C.x
  const dy = y - C.y
  const r = Math.hypot(dx, dy)
  if (r > R + 0.5) return undefined
  if (r >= R - 1.4) return 'rim'
  if (r <= 1.6) return 'hub'
  const k = mod(Math.atan2(dy, dx) - th, TAU / 6)
  const off = Math.min(k, TAU / 6 - k) * r
  if (off < 0.72) return 'spoke'
  const behind = TAU / 6 - k
  if (behind < TAU / 24) return 'blur'
  if (behind < TAU / 12) return 'haze'
  return undefined
}

const SUN_DX = 9
const SUN_DY = 3
function isSunPatch(x: number, y: number): boolean {
  if (y < FLOOR) {
    const u = x - 0.45 * y
    return y >= 3 && u >= 37 && Math.abs(u - 52) >= 0.6 && y !== 14
  }
  return x >= 44 - (y - FLOOR) * 2.2
}
function isMortar(x: number, y: number): boolean {
  const row = Math.floor((y + 1) / 4)
  const off = Math.floor(hash(row, 3) * 7)
  const width = 6 + Math.floor(hash(Math.floor((x + off) / 7), row, 1) * 2)
  const isBed = (y + 1) % 4 === 0
  const isJoint = !isBed && (x + off) % 7 === 0 && hash(x, row) > 0.25
  return (isBed && hash(Math.floor(x / 3), row, 9) > 0.3) || (isJoint && width > 0)
}
const SPINNER = [
  '......ccc...',
  '.....cccccC.',
  '....ccccCCF.',
  '...hhhhCFeF.',
  '..Hhhhh.FFFf',
  '....hHhFFF..',
  '.....RrRF...',
  '...rrRRRRR..',
  '..rrrRRRRRR.',
  '.rrrrRRRRRR.',
  '.rrrrRRRRR..',
  '.dddrRRRR...',
  '.ddddddDDD..',
  '.ddddddddDDd',
  '.dDDDDDDDDDd',
]
const SPINNER_X = 1
const SPINNER_Y = 5
const KNEE = { x: 12, y: 19 }
const SHOULDER = { x: 8, y: 13 }
const FIGURE: Record<string, number> = {
  c: WOOL[4] ?? 0, C: WOOL[2] ?? 0, h: HAIR[2] ?? 0, H: HAIR[1] ?? 0,
  F: SKIN[2] ?? 0, f: SKIN[3] ?? 0, e: SKIN[0] ?? 0,
  r: SHAWL[4] ?? 0, R: SHAWL[2] ?? 0, d: DRESS[3] ?? 0, D: DRESS[1] ?? 0,
  a: WOOL[3] ?? 0, A: WOOL[2] ?? 0,
}
const CAT_ART = [
  'E.E.......',
  'HHHH.oOOo.',
  'HeHHoOOOOo',
  'HHHooooOOo',
  '.ttttttooo',
]
const CAT_X = 51
const CAT_Y = 25
function hands(f: number): { front: number; back: number } {
  const draw = ease.inOut(Math.min(1, Math.max(0, (f - 5) / 15)))
  const slide = ease.inOut(Math.min(1, Math.max(0, (f - 14) / 10)))
  const feed = ease.inOut(Math.min(1, Math.max(0, (f - 30) / 14)))
  return { front: 19 - 4 * slide + 4 * feed, back: 15 - 4 * draw + 4 * feed }
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {
    const th = (TAU * 2 * f) / LOOP
    const pin = { x: C.x + 1.6 * Math.cos(th), y: C.y + 1.6 * Math.sin(th) }
    const pedalY = 25.4 + 1.3 * Math.sin(th)
    const barY = (x: number) => lerp(26, pedalY, (57 - x) / 43)
    const solid = new Uint8Array(W * H)
    const block = (x: number, y: number) => {
      const ix = Math.round(x)
      const iy = Math.round(y)
      if (ix >= 0 && ix < W && iy >= 0 && iy < H) solid[iy * W + ix] = 1
    }
    for (let y = 0; y < H; y++) {
      for (let x = 36; x < W; x++) {
        const part = wheelAt(x, y, th)
        if (part && part !== 'blur' && part !== 'haze') block(x, y)
      }
    }
    for (let x = 20; x <= 62; x++) for (let k = 0; k < 3; k++) block(x, tableY(x) + k)
    for (let y = 9; y < 21; y++) {
      block(25, y)
      block(35, y)
      block(C.x, y + 2)
    }
    for (let x = ORIFICE_X; x <= WHORL_X; x++) for (let y = 10; y <= 14; y++) block(x, y)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (y < 2) {
          c.set(x, y, shade(OAK, y === 1 ? 1 : 2.2 + (x % 13 === 0 ? -1 : 0)))
          continue
        }
        const isFloor = y >= FLOOR
        let cover = 0
        for (let j = -1; j <= 1; j++) {
          for (let i = -1; i <= 1; i++) {
            const sx = (isFloor ? x - 3 : x - SUN_DX) + i
            const sy = (isFloor ? y : y - SUN_DY) + j
            if (sx >= 0 && sx < W && sy >= 0 && sy < H && solid[sy * W + sx] === 1) cover += i === 0 && j === 0 ? 3 : 1
          }
        }
        const inPatch = isSunPatch(x, y)
        const sun = !inPatch ? 0 : cover >= 3 ? 0.4 : 1
        const isEdge = !inPatch && isSunPatch(x + 1, y) && cover < 2
        if (isFloor) {
          const plank = Math.floor((y - FLOOR + 1) / 2)
          const isSeam = y > FLOOR && (x + plank * 11) % 17 === 0
          const grain = y === FLOOR ? -0.8 : (y - FLOOR) % 2 === 1 ? 0.25 : 0
          const base = 3.2 + sun * 3 + (isEdge ? 1.2 : 0)
          c.set(x, y, shade(OAK, base + grain - (isSeam ? 1 : 0) + (y - FLOOR) * 0.15))
          continue
        }
        const mortar = isMortar(x, y) ? (inPatch ? -1.2 : -0.6) : 0
        const corner = y < 4 ? -0.6 : 0
        const base = inPatch ? 6.6 + sun * 2.4 : isEdge ? 6 : 4 - (x < 20 ? 0.4 : 0)
        c.set(x, y, shade(WALL, base + mortar + corner))
      }
    }
    for (let x = 0; x < W; x++) c.set(x, FLOOR - 1, shade(OAK, isSunPatch(x, FLOOR - 1) && !solid[(FLOOR - 1 - SUN_DY) * W + x - SUN_DX] ? 4.5 : 2))
    for (let i = 0; i < 6; i++) {
      const x = Math.round(42 + hash(i, 7) * 20 + 2 * wave(f, LOOP, 1, hash(i, 8)))
      const y = Math.round(4 + hash(i, 9) * 18 + 1.5 * wave(f, LOOP, 1, hash(i, 10) + 0.3))
      if (isSunPatch(x, y)) c.set(x, y, WALL[10] ?? 0)
    }
    c.line(53, tableY(53) + 2, 52, FLOOR, shade(WHEEL, 1.6))
    for (let x = 14; x <= 57; x++) c.set(x, barY(x), shade(WHEEL, 2.4))

    for (let y = 1; y < 24; y++) {
      for (let x = 38; x < 61; x++) {
        const part = wheelAt(x, y, th)
        if (!part) continue
        if (part === 'blur' || part === 'haze') {
          const i = WALL.indexOf(c.get(x, y))
          if (i >= 0) c.set(x, y, WALL[Math.max(1, i - (part === 'blur' ? 3 : 2))] ?? 0)
          continue
        }
        const dx = x - C.x
        const dy = y - C.y
        const r = Math.hypot(dx, dy)
        const facing = (-0.6 * dx - 0.8 * dy) / Math.max(1, r)
        let level = 3.4
        if (part === 'rim') level = 3.6 + facing * 2.2
        if (part === 'spoke') level = 3.6 + facing * 0.8
        if (part === 'hub') level = 4.6 + facing * 2
        c.set(x, y, shade(WHEEL, level))
      }
    }
    const band = WOOL[2] ?? 0
    c.line(WHORL_X + 1, AXLE_Y - 2, C.x - 2, C.y - R + 0.3, band)
    c.line(WHORL_X + 1, AXLE_Y + 2, C.x - 2, C.y + R - 0.3, band)
    const run = mod(f * 3, 12) / 12
    c.set(lerp(WHORL_X + 1, C.x - 2, run), lerp(AXLE_Y - 2, C.y - R + 0.3, run), WOOL[4] ?? 0)
    for (let x = 20; x <= 62; x++) {
      const y = Math.round(tableY(x))
      c.set(x, y, shade(WHEEL, 5.6 - (x - 20) * 0.03))
      c.set(x, y + 1, shade(WHEEL, 3.3))
      c.set(x, y + 2, shade(WHEEL, 2.2))
    }
    c.line(23, tableY(23) + 3, 21, FLOOR, shade(WHEEL, 3.2))
    c.line(24, tableY(24) + 3, 22, FLOOR, shade(WHEEL, 2.2))
    c.line(58, tableY(58) + 3, 60, FLOOR, shade(WHEEL, 3.2))
    c.line(59, tableY(59) + 3, 61, FLOOR, shade(WHEEL, 2.2))
    for (let y = C.y + 2; y < tableY(C.x); y++) {
      c.set(C.x, y, shade(WHEEL, 4.8))
      c.set(C.x + 1, y, shade(WHEEL, 3))
    }
    c.line(C.x, C.y, pin.x, pin.y, shade(WHEEL, 6))
    c.line(pin.x, pin.y, 47, barY(47), shade(WHEEL, 4.2))
    c.set(pin.x, pin.y, WHEEL[7] ?? 0)
    c.set(C.x, C.y, WHEEL[8] ?? 0)
    for (const mx of [25, 35]) {
      for (let y = 9; y < tableY(mx); y++) c.set(mx, y, shade(WHEEL, y === 9 ? 6.4 : 4.4))
      c.set(mx, 8, shade(WHEEL, 5.4))
    }
    for (let x = 27; x <= 33; x++) {
      for (let y = 11; y <= 13; y++) c.set(x, y, shade(WOOL, y === 11 ? 3.6 : y === 12 ? 2.8 : 1.6))
    }
    for (const bx of [27, 33]) for (let y = 10; y <= 14; y++) c.set(bx, y, shade(WHEEL, y === 10 ? 6 : 4))
    const phi = (TAU * f) / 3
    for (const side of [1, -1]) {
      const ay = AXLE_Y + side * 3 * Math.cos(phi)
      const isFront = side * Math.sin(phi) >= 0
      if (!isFront && Math.abs(ay - AXLE_Y) < 1) continue
      for (let x = 26; x <= 34; x++) c.set(x, ay, shade(WHEEL, isFront ? 5.4 : 3.4))
      c.line(26, ay, 26, AXLE_Y, shade(WHEEL, 4.6))
    }
    for (let x = ORIFICE_X; x <= 26; x++) c.set(x, AXLE_Y, shade(WHEEL, x === ORIFICE_X ? 6.6 : 5))
    c.disc(WHORL_X, AXLE_Y, 1.6, shade(WHEEL, 4))
    c.set(WHORL_X + Math.round(Math.cos(phi)), AXLE_Y + Math.round(Math.sin(phi)), WHEEL[7] ?? 0)
    for (const [i, [yx, yy]] of ([[29, 22], [32, 21.5], [35, 22]] as const).entries()) {
      const ramp = YARNS[i] ?? YARNS[0] ?? []
      c.disc(yx, yy, 1.6, (x, y) => shade(ramp, 1.2 + (x < yx ? 0.6 : 0) + (y < yy ? 0.8 : -0.4)))
    }
    for (let y = 23; y < FLOOR; y++) {
      for (let x = 27; x <= 37; x++) {
        if ((x === 27 || x === 37) && y === FLOOR - 1) continue
        const weave = (x + (y % 2) * 2) % 4 < 2 ? 0.5 : -0.3
        c.set(x, y, shade(OAK, (y === 23 ? 5.4 : 4.2 + weave) - (x === 37 ? 1 : 0)))
      }
    }
    c.rect(2, 20, 9, 1, shade(OAK, 5.4))
    c.rect(2, 21, 9, 1, shade(OAK, 3))
    c.line(3, 22, 2, FLOOR, shade(OAK, 3.6))
    c.line(9, 22, 10, FLOOR, shade(OAK, 3))
    c.sprite(SPINNER_X, SPINNER_Y, SPINNER, FIGURE)
    c.rect(10, pedalY + 0.5, 9, 1, shade(WHEEL, 4.6))
    const ankle = { x: 13, y: pedalY - 1 }
    c.line(KNEE.x, KNEE.y + 1, ankle.x, ankle.y - 1, DRESS[2] ?? 0)
    c.line(KNEE.x - 1, KNEE.y + 1, ankle.x - 1, ankle.y - 1, DRESS[1] ?? 0)
    c.rect(ankle.x - 1, ankle.y, 4, 1, 0x1a1214)
    c.set(ankle.x + 2, ankle.y - 1, 0x1a1214)
    const { front, back } = hands(f)
    const fx = Math.round(front)
    const bx = Math.round(back)
    const twist = Math.round(4 * ease.inOut(Math.min(1, Math.max(0, (f - 30) / 14))))
    for (let x = fx + 1; x < ORIFICE_X; x++) {
      const y = x > ORIFICE_X - 3 ? AXLE_Y : 13
      c.set(x, y, shade(WOOL, (x + twist) % 2 === 0 ? 4.2 : 2.8))
    }
    for (let x = bx + 1; x < fx; x++) {
      const t = (fx - x) / Math.max(1, fx - bx)
      const half = 0.2 + t * 1.3
      for (let y = Math.floor(13.5 - half); y <= Math.ceil(13.5 + half); y++) {
        if (Math.abs(y - (13 + t)) <= half) c.set(x, y, shade(WOOL, 3.6 + (y < 13 + t ? 0.8 : -0.4)))
      }
    }
    const arm = (hx: number, hy: number, ex: number, ey: number, tone: number) => {
      c.line(SHOULDER.x, SHOULDER.y, ex, ey, DRESS[tone] ?? 0)
      c.line(SHOULDER.x - 1, SHOULDER.y + 1, ex - 1, ey, DRESS[tone - 1] ?? 0)
      c.line(ex, ey, hx - 1, hy, DRESS[tone] ?? 0)
      c.line(ex, ey + 1, hx - 1, hy + 1, DRESS[tone - 1] ?? 0)
    }
    arm(bx, 15, 9, 17, 2)
    for (let y = 11; y <= 18; y++) {
      for (let x = bx - 4; x <= bx + 2; x++) {
        const d = Math.hypot((x - (bx - 1)) / 3.3, (y - 14.6) / 2.5)
        const lump = hash(x - bx, y, 4) * 0.22
        if (d + lump > 1.05) continue
        c.set(x, y, shade(WOOL, y <= 13 ? 4.6 : y <= 15 ? 3.6 : 2.6))
      }
    }
    c.set(bx + 1, 15, SKIN[2] ?? 0)
    arm(fx, 13, 11, 16, 3)
    c.set(fx, 13, SKIN[3] ?? 0)
    c.set(fx, 14, SKIN[2] ?? 0)
    const flick = f >= 30 && f < 35
    const breath = wave(f, LOOP, 2) > 0.2 ? 1 : 0
    const CAT_LEVEL: Record<string, number> = { E: 3.4, H: 4.8, e: 1.4, o: 3.6, O: 4.8, t: 2.6 }
    CAT_ART.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i] ?? '.'
        const level = CAT_LEVEL[ch]
        if (level === undefined) continue
        const rise = j === 1 && i >= 5 && i <= 8 ? 0 : 0
        const y = CAT_Y + j - (j === 1 && i >= 5 && i <= 8 && breath === 0 ? -1 : 0) + rise
        c.set(CAT_X + i, j === 1 && i >= 5 && i <= 8 ? y : CAT_Y + j, shade(CAT, level))
      }
    })
    if (breath) for (let i = 5; i <= 8; i++) c.set(CAT_X + i, CAT_Y, shade(CAT, i === 6 || i === 7 ? 4.8 : 3.8))
    if (flick) c.set(CAT_X + 1, CAT_Y + 3, shade(CAT, 3))
  })
}
export const scene: Scene = { verb: 'Spinning', render, hero: 20 }