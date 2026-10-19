import { beat, clamp, ease, frames, hash, hex, mod, particles, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 60

const WALL = hex('050304 090506 0e0809 140c0d')
const BOKEH = hex('1a100c 24160f')
const HAZE = hex('1c120c 2c1c10 3e2814 563818')
const IRON = hex('040405 09090c 111116 1b1b22 2a2a34 403f4c 625f6e')
const OIL = hex('0c0704 1a0f07 2e1b0a 4a2c0e 6e4414 9c661e d09a36 fbe08a')
const CRUST = hex('1c0806 30100a 4a1a0e 662812 853a18 a2501e ba6a28 d08a3a e6ae5c f8d892')
const SIDE = hex('1a0606 30100e 4a1a16 66281e 7e3a28')
const FAT = hex('6a4424 9a6e3e c89c62 e8c88e f8e8c0 fffaea')
const WOOD = hex('0e0605 1a0c08 28140c 3a1e12 50291a 6a3822 864a2c a4603a c27e4c dca06a')
const BRASS = hex('2c1a08 4e300c 7a4c10 a8701a d1982a eec24a fae58a fffbd8')
const STEAM = hex('3a2a20 5a4434 806450 a88a70')
const SALT = hex('7a6a5e c8b8a4 f4e8d6 ffffff')

const beamX = (y: number) => 21 + y * 0.52
const BEAM_HALF = 5

function beamAt(x: number, y: number): number {
  const d = Math.abs(x - beamX(y))
  return d < BEAM_HALF - 1.8 ? 1 : d < BEAM_HALF ? 0.5 : 0
}

const PAN = { x: 31, y: 28.5, rx: 33, ry: 11 }
const STEAK = { x: 29, y: 25.5, rx: 18, ry: 5.6 }
const THICK = 2

function steakAt(x: number, y: number): number {
  const dx = x - STEAK.x
  const ry = STEAK.ry - (dx > 0 ? (dx / STEAK.rx) * 1.8 : 0)
  const lift = dx > 0 ? (dx / STEAK.rx) ** 2 * -1.2 : 0
  return (Math.abs(dx) / STEAK.rx) ** 2.4 + (Math.abs(y - STEAK.y - lift) / ry) ** 2.2
}
const isMark = (x: number, y: number) => mod(x - Math.round(y - STEAK.y) + 3, 8) < 2

const SEAM_Y = 3
const COLLAR_Y = 12
const FOOT_Y = 13
const MILL_HALF = [4, 4.2, 4.2, 4, 3.3, 2.8, 2.6, 2.8, 3.2, 3.7, 4.1, 4.3, 4.6, 3.6]
function millX(f: number): number {
  return Math.round(31 + 4 * ease.inOut(beat(f, 10, 36)) - 4 * ease.inOut(beat(f, 40, 58)))
}
function turn(f: number): number {
  const t = (s: number, e: number) => ease.inOut(beat(f, s, e))
  return -14 * t(6, 11) + 44 * t(12, 17) + 40 * t(21, 26) + 50 * t(30, 35)
}
function jolt(f: number): number {
  if (f >= 9 && f <= 11) return 1
  for (const s of [12, 21, 30]) if (f === s + 1 || f === s + 2) return -1
  return 0
}
type Flake = { born: number; x: number; vx: number; land: number; isSalt: boolean; phase: number }

const FLAKES: Flake[] = [12, 21, 30].flatMap((s, k) =>
  Array.from({ length: 16 }, (_, i) => {
    const r = (n: number) => hash(k * 31 + i, n, 0x5ea5)
    const born = s + 1 + Math.floor(r(1) * 6)
    return {
      born,
      x: millX(born) + (r(2) - 0.5) * 2.4,
      vx: (r(3) - 0.5) * 0.45,
      land: 21.5 + r(4) * 7,
      isSalt: r(5) < 0.5,
      phase: r(6) * 6.28,
    }
  }),
)
function flakeAt(k: Flake, t: number): { x: number; y: number; isDown: boolean; tDown: number } {
  const fall = (u: number) => FOOT_Y + 2 + 0.4 * u + 0.05 * u * u
  let tDown = 0
  while (fall(tDown) < k.land) tDown++
  const u = Math.min(t, tDown)
  const flutter = k.isSalt ? Math.round(Math.sin(u * 0.8 + k.phase) * 0.8) : 0
  return { x: k.x + k.vx * u + flutter, y: Math.min(k.land, fall(u)), isDown: t >= tDown, tDown }
}
function render(): Int32Array[] {
  return frames(LOOP, (c, f) => {

    const bokeh = [[7, 6, 4.5], [55, 5, 5], [61, 15, 3]] as const
    c.fill((x, y) => {
      const b = beamAt(x, y)
      if (b > 0) return shade(HAZE, b * 2.4 + 0.4 - y * 0.06)
      for (const [bx, by, br] of bokeh) if (Math.hypot(x - bx, y - by) < br) return shade(BOKEH, Math.hypot(x - bx, y - by) < br * 0.6 ? 1 : 0)
      return shade(WALL, 2.4 - Math.abs(x - 32) * 0.03 - y * 0.06)
    })
    for (let y = 16; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = ((x - PAN.x) / PAN.rx) ** 2 + ((y - PAN.y) / PAN.ry) ** 2
        if (d > 1) continue
        const di = ((x - PAN.x) / (PAN.rx - 2)) ** 2 + ((y - PAN.y - 0.6) / (PAN.ry - 1.6)) ** 2
        const b = beamAt(x, y)
        if (di > 1) {
          const isCrest = ((x - PAN.x) / PAN.rx) ** 2 + ((y - 1 - PAN.y) / PAN.ry) ** 2 > 1
          const lit = y < PAN.y ? (isCrest ? 3.4 : 2) : 1.2
          c.set(x, y, shade(IRON, lit + b * 1.2))
          continue
        }
        const toSteak = steakAt(x, y - 1)
        const glow = toSteak < 1.5 ? 2.6 : toSteak < 2.3 ? 1.4 : 0.4
        c.set(x, y, shade(OIL, glow + b * 1.6))
      }
    }
    for (let x = 61; x < W; x++) {
      const y0 = 22 - (x - 61)
      c.set(x, y0, shade(IRON, 4))
      c.set(x, y0 + 1, shade(IRON, 2.4))
      c.set(x, y0 + 2, shade(IRON, 1))
    }
    for (let y = 16; y < H; y++) {
      for (let x = 8; x < 50; x++) {
        const isTop = steakAt(x, y) < 1
        const isSide = !isTop && y > STEAK.y - 2 && steakAt(x, y - THICK) < 1
        if (!isTop && !isSide) continue
        const b = beamAt(x, y)
        if (isSide) {
          const isUpper = steakAt(x, y - 1) < 1
          c.set(x, y, shade(SIDE, (isUpper ? 3.2 : 1.6) + b))
          continue
        }
        const isBackEdge = steakAt(x, y - 1) >= 1
        const isCap = (isBackEdge || steakAt(x, y - 2) >= 1) && y < STEAK.y && x < STEAK.x + 12
        if (isCap) {
          c.set(x, y, shade(FAT, (isBackEdge ? 3 : 1.8) + b * 0.8))
          continue
        }
        const isRim = steakAt(x + 1, y) >= 1 || steakAt(x, y + 1) >= 1 || steakAt(x - 1, y) >= 1
        if (isMark(x, y)) {
          c.set(x, y, shade(CRUST, 1 + b * 0.8 - (isRim ? 0.5 : 0)))
          continue
        }
        const isRidge = isMark(x - 1, y) && !isMark(x, y - 1)
        const gloss = b === 1 && isRidge ? 2 : 0
        c.set(x, y, shade(CRUST, 4.6 + (isRidge ? 0.8 : 0) - (isRim ? 1.2 : 0) + b * 1.6 + gloss))
      }
    }
    for (const k of FLAKES) {
      const t = mod(f - k.born, LOOP)
      const p = flakeAt(k, t)
      if (!p.isDown) continue
      const since = t - p.tDown
      const x = Math.round(p.x)
      const y = Math.round(p.y)
      if (k.isSalt && since < 12) c.set(x, y, shade(SALT, since < 4 ? 3 : since < 8 ? 2 : 1))
      if (!k.isSalt && since < 14) c.set(x, y, CRUST[0] ?? 0)
      if (since < 2) c.set(x + (k.phase > 3 ? 1 : -1), y - 1 - since, shade(OIL, 7 - since))
      if (since >= 1 && since < 4) c.set(x, y - 1 - since, shade(STEAM, 3.4 - since * 0.8))
    }
    for (const p of particles(f, LOOP, 24, 4, 11)) {
      const a = p.r[1] * 6.28
      const x = Math.round(STEAK.x + Math.cos(a) * (STEAK.rx + 1.4))
      const y = Math.round(STEAK.y + 1 + Math.sin(a) * (STEAK.ry + 1.4))
      if (steakAt(x, y) < 1 || steakAt(x, y - THICK) < 1) continue
      c.set(x, y, shade(OIL, p.t === 2 ? 7 : 5.4))
      if (p.t === 3 && p.r[2] < 0.4) c.set(x + 1, y - 2, shade(OIL, 6))
    }
    const MILL_X = millX(f)
    for (const p of particles(f, LOOP, 16, 14, 23)) {
      const x = Math.round(STEAK.x - 8 + p.r[1] * 16 + Math.sin(p.t * 0.35 + p.r[2] * 6) * 1.2 + p.t * 0.15)
      const y = Math.round(STEAK.y - 4 - p.t * 0.75)
      const b = beamAt(x, y)
      if (b === 0 || (Math.abs(x - MILL_X) <= 5 && y <= FOOT_Y + 1)) continue
      if (Math.sin(p.age * Math.PI) > 0.4) c.set(x, y, shade(HAZE, 3.4))
    }
    const phi = (turn(f) * Math.PI) / 180
    const jy = jolt(f)
    for (let y = 0; y <= FOOT_Y + jy; y++) {
      const row = Math.max(0, y - jy)
      const hw = MILL_HALF[row] ?? 4
      for (let x = Math.floor(MILL_X - hw); x <= Math.ceil(MILL_X + hw); x++) {
        const u = (x - MILL_X) / hw
        if (Math.abs(u) > 1) continue
        const a = Math.asin(clamp(u, -1, 1))
        const lambert = -0.75 * Math.sin(a) + 0.5 * Math.cos(a)
        const isLeft = !(Math.abs((x - 1 - MILL_X) / hw) <= 1)
        const isRight = !(Math.abs((x + 1 - MILL_X) / hw) <= 1)
        if (row === COLLAR_Y) {
          const glint = Math.cos(a * 2 - 0.6) > 0.9 ? 1.6 : 0
          c.set(x, y, shade(BRASS, 3.2 + lambert * 2.4 + glint))
          continue
        }
        if (row === SEAM_Y) {
          c.set(x, y, shade(WOOD, 0.6 + lambert * 0.6))
          continue
        }
        const isHead = row < SEAM_Y
        const isGroove = isHead && Math.cos(5 * (a + phi)) < -0.45
        let level = 4.2 + lambert * 2.8 - (isGroove ? 1.6 : 0) - (row === FOOT_Y ? 1.4 : 0) - (row === SEAM_Y + 1 ? 0.8 : 0)
        if (isLeft) level = 8.4 - (isGroove ? 1 : 0)
        if (isRight) level = 2.6
        c.set(x, y, shade(WOOD, level))
      }
    }
    c.set(MILL_X, FOOT_Y + 1 + jy, shade(BRASS, 3.2))
    c.set(MILL_X - 1, FOOT_Y + 1 + jy, shade(BRASS, 5.4))
    for (const k of FLAKES) {
      const t = mod(f - k.born, LOOP)
      const p = flakeAt(k, t)
      if (p.isDown) continue
      const x = Math.round(p.x)
      const y = Math.round(p.y)
      const b = beamAt(x, y)
      if (k.isSalt) {
        const isGlint = b > 0 && (t + Math.round(k.phase)) % 4 === 0
        c.set(x, y, shade(SALT, isGlint ? 3 : b ? 2 : 0.6))
        if (isGlint && k.phase > 4.2) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) c.set(x + dx, y + dy, SALT[1] ?? 0)
      } else {
        c.set(x, y, b ? WALL[0] ?? 0 : shade(HAZE, 1))
      }
    }
  })
}
export const scene: Scene = { verb: 'Seasoning', render, hero: 28 }