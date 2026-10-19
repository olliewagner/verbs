import { Canvas, beat, clamp, ease, hash, hex, loopNoise, shade, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 80

const DOOR = hex('05060d 0a0c18 111424 1a1b2c 272431 39303a 4f3e3e 6a5040 87663f a8824e')
const STEEL = hex('07080e 10131c 1a1f2b 272e3d 384152 4c5568 636c7e 7e8696 9ea4ae c2c4c4 e6e4dc')
const CHROME = hex('10121a 22252f 3a3e4c 5a5f6e 838896 b0b4bc dcdee0 fbfaf4')
const BRASS = hex('1e1206 3a2408 5e3c0e 86581a ae7a28 d09e3c ecc664 fbe8a0')
const IRON = hex('0a090e 15131a 211d25 2e2830 403634 584838')
const GRIP = hex('0a0a10 17161e 26232c 3a3440')
const HOLE = 0x07060c

const CX = 31.5

const CHAMBERS = [24, 28, 32, 36, 40]
const KEY = [3, 2, 4, 3, 2]
const SHEAR = 21
const DRIVER = 4
const setLift = (i: number) => 6 - (KEY[i] ?? 3)

const PIN_START = 4
const PIN_STEP = 8
const OPEN = 46
const DARK = 63
const BACK = 67
const RESET = DARK + 3

function pick(f: number): { x: number; lift: number; pin: number } {
  if (f >= BACK || f < PIN_START) {
    const x = f >= BACK ? 21 + Math.round(ease.inOut(beat(f, 70, 79)) * 0) : 21
    return { x: f < PIN_START ? 21 + Math.round(ease.inOut(beat(f, 0, PIN_START)) * 2) : x, lift: 0, pin: -1 }
  }
  const i = Math.floor((f - PIN_START) / PIN_STEP)
  if (i > 4) return { x: CHAMBERS[4] ?? 40, lift: 0, pin: -1 }
  const s = f - PIN_START - i * PIN_STEP
  const from = i === 0 ? 23 : CHAMBERS[i - 1] ?? 23
  const to = CHAMBERS[i] ?? 24
  const x = s < 2 ? Math.round(from + (to - from) * ease.inOut((s + 1) / 2)) : to
  const L = setLift(i)
  const lift = [0, 0, L - 1, Math.max(0, L - 2), L - 1, L, Math.ceil(L / 2), 0][s] ?? 0

  return { x, lift, pin: i }
}

const HANDLE: readonly number[] = (() => {
  const out: number[] = []
  let h = 0
  for (let f = 0; f < LOOP; f++) {
    const target = Math.round(Math.max(pick(f).lift, pick(f - 1).lift) * 0.6)
    h += Math.max(-1, Math.min(1, target - h))
    out.push(h)
  }
  return out
})()
function setCount(f: number): number {
  if (f >= RESET) return 0
  let n = 0
  for (let i = 0; i < 5; i++) if (f >= PIN_START + i * PIN_STEP + 5) n++
  return n
}
function rise(f: number): number {
  if (f < OPEN || f >= RESET) return 0
  return Math.round(4 * ease.outBack(beat(f, OPEN, OPEN + 5)))
}
function power(f: number): number {
  return [1, 0.55, 0, 0.75, 0, 0, 0.5, 0.85][f - DARK + 1] ?? 1
}
function render(): Int32Array[] {
  const out: Int32Array[] = []

  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const t = f / LOOP
    const p = power(f)
    const lx = CX + (loopNoise(0.3, 0, t, 2, 4) - 0.5) * 4
    const ly = 19 + (loopNoise(0.8, 0, t, 2, 5) - 0.5) * 3
    const light = (x: number, y: number) => p * Math.max(0, 1 - Math.hypot((x - lx) / 34, (y - ly) / 24)) ** 0.9
    const jolt = f === BACK ? 1 : 0
    const r = rise(f)
    const n = setCount(f)
    const pk = pick(f)
    const tension = f >= OPEN - 2 && f < RESET ? 3 : Math.floor(n * 0.5)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const board = Math.floor((x + 3) / 10)
        const isSeam = (x + 3) % 10 === 0
        const grain = hash(board, Math.floor((y + hash(board, 2) * 9) / 3)) < 0.18 && (x + 3) % 10 > 2 ? -0.7 : 0
        const l = light(x, y)
        c.set(x, y, shade(DOOR, 1.6 + l * 5.4 + grain * Math.min(1, l * 3) - (isSeam ? 1.4 : 0) + hash(board, 9) * 0.5, x, y))
      }
    }
    for (let y = 5; y <= 8; y++) {
      for (let x = 0; x <= 35; x++) {
        const l = light(x, y)
        const edge = y === 5 ? 1 : y === 8 ? -0.8 : 0
        const end = x === 35 && (y === 5 || y === 8) ? -9 : 0
        if (end) continue
        c.set(x, y, shade(IRON, 1.6 + l * 3.4 + edge, x, y))
      }
    }
    for (const rx of [4, 14]) {
      c.set(rx, 6, shade(IRON, 2.6 + light(rx, 6) * 3.4, rx, 6))
      c.set(rx, 7, shade(IRON, 0.6 + light(rx, 6) * 2, rx, 7))
    }
    const cy = 10 - r + jolt
    const glintAt = f >= OPEN + 7 && f < OPEN + 14 ? beat(f, OPEN + 7, OPEN + 13) : -1
    for (let y = 0; y < 14; y++) {
      for (let x = 19; x <= 44; x++) {
        let across = -1
        let along = 0
        if (y < cy) {
          const eo = Math.hypot((x - CX) / 12, (y - cy) / 6.5)
          const ei = Math.hypot((x - CX) / 8, (y - cy) / 3)
          if (eo > 1 || ei <= 1) continue
          across = clamp((ei - 1) / (ei - 1 + (1 - eo)))
          along = 0.25 + (Math.atan2(y - cy, x - CX) + Math.PI) / Math.PI * 0.5
        } else if (x >= 20 && x <= 23 && y <= 15 - r + jolt) {
          across = (23 - x) / 3
          along = 0.25 * (1 - (y - cy) / 6)
        } else if (x >= 40 && x <= 43) {
          across = (x - 40) / 3
          along = 0.75 + 0.25 * ((y - cy) / 6)
        } else continue
        const isNotch = x === 23 && y === 13 - r + jolt
        const l = light(x, y)
        const behind = glintAt - along
        const glint = glintAt < 0 || behind < -0.05 || behind > 0.3 ? 0 : behind < 0.05 ? 2.4 : 1.8 * (1 - (behind - 0.05) / 0.25)
        const level = 1.4 + (1 - Math.abs(across - 0.3) * 2.2) * 2.6 + l * 3 + glint - (isNotch ? 2 : 0)
        c.set(x, y, shade(CHROME, level, x, y))
      }
    }
    if (r >= 3) {
      const by = 15 - r + jolt
      c.set(20, by, shade(DOOR, 1.6 + light(20, by) * 5.4, 20, by))
      c.set(23, by, shade(DOOR, 1.6 + light(23, by) * 5.4, 23, by))
    }
    const top = 13 + jolt
    for (let y = top; y < H; y++) {
      for (let x = 17; x <= 46; x++) {
        if ((x === 17 || x === 46) && y === top) continue
        const l = light(x, y)
        const plate = (y - top) % 3 === 2 ? -1.1 : 0
        const bevel = x === 17 ? 1.6 : x === 18 ? 0.7 : x === 46 ? -1.4 : x === 45 ? -0.6 : 0
        const lip = y === top ? 1.3 : 0
        c.set(x, y, shade(STEEL, 2.4 + l * 6.4 + plate + bevel + lip, x, y))
      }
    }
    for (const hx of [20, 21, 22, 23, 40, 41, 42, 43]) {
      if (hx <= 23 && r >= 3) c.set(hx, top, HOLE)
      else c.set(hx, top, shade(STEEL, 1.4 + light(hx, top) * 3, hx, top))
    }
    for (const [rx, ry] of [[19, top + 2], [44, top + 2], [19, 30 + jolt], [44, 30 + jolt]] as const) {
      c.set(rx, ry, shade(STEEL, 4 + light(rx, ry) * 6.4, rx, ry))
    }
    const cutTop = 15 + jolt
    for (let y = cutTop; y <= 29 + jolt; y++) {
      for (let x = 22; x <= 43; x++) {
        const l = light(x, y)
        const yy = y - jolt
        if (yy === 15 || x === 22) {
          c.set(x, y, shade(STEEL, 0.8 + l * 2.2, x, y))
          continue
        }
        if (yy === 29 || x === 43) {
          c.set(x, y, shade(STEEL, 3.6 + l * 6.4, x, y))
          continue
        }
        const isChamber = CHAMBERS.some(cx => x === cx || x === cx + 1)
        if (yy === SHEAR || yy >= 27) c.set(x, y, HOLE)
        else if (isChamber) c.set(x, y, HOLE)
        else if (yy < SHEAR) c.set(x, y, shade(STEEL, 1.6 + l * 3.4 + (yy === 16 ? -0.8 : 0), x, y))
        else c.set(x, y, shade(BRASS, 1.8 + l * 3 + (yy === 22 ? 1 : yy === 26 ? -0.8 : 0), x, y))
      }
    }
    for (let x = 17; x <= 22; x++) for (const y of [27, 28]) c.set(x, y + jolt, HOLE)
    CHAMBERS.forEach((x0, i) => {
      const isSet = i < n
      const lift = pk.pin === i ? pk.lift : 0
      const keyTop = 27 - (KEY[i] ?? 3) - lift
      const keyBottom = 26 - lift
      const driverBottom = isSet ? SHEAR - 1 : keyTop - 1
      const driverTop = driverBottom - DRIVER + 1
      const l = light(x0, 20)
      for (let y = keyTop; y <= keyBottom; y++) {
        c.set(x0, y + jolt, shade(BRASS, 5 + l * 2.2 + (y === keyBottom ? -1.2 : 0), x0, y))
        c.set(x0 + 1, y + jolt, shade(BRASS, 4 + l * 2 + (y === keyBottom ? -1.2 : 0), x0, y))
      }
      for (let y = driverTop; y <= driverBottom; y++) {
        c.set(x0, y + jolt, shade(STEEL, 5 + l * 4, x0, y))
        c.set(x0 + 1, y + jolt, shade(STEEL, 3.6 + l * 3.4, x0, y))
      }
      for (let y = 16; y < driverTop; y++) {
        if ((driverTop - y) % 2 === 0) continue
        c.set(x0, y + jolt, shade(STEEL, 3.4 + l * 3, x0, y))
        c.set(x0 + 1, y + jolt, shade(STEEL, 2.4 + l * 2.4, x0, y))
      }
      const since = f - (PIN_START + i * PIN_STEP + 5)
      if (since >= 0 && since < 3 && p > 0) {
        for (let x = x0 - 1; x <= x0 + 2; x++) c.set(x, SHEAR + jolt, BRASS[7 - since] ?? 0)
        if (since === 0) {
          c.set(x0 - 2, SHEAR + jolt, BRASS[5] ?? 0)
          c.set(x0 + 3, SHEAR + jolt, BRASS[5] ?? 0)
        }
      }
    })
    const wl = (x: number, y: number) => shade(STEEL, 4.4 + light(x, y) * 4.6, x, y)
    c.line(17, 28 + jolt, 21, 28 + jolt, wl)
    c.line(16, 28 + jolt, 4, 29 + tension, wl)
    c.line(4, 29 + tension, 0, 29 + tension, wl)
    c.line(16, 29 + jolt, 5, 30 + tension, (x, y) => shade(STEEL, 1.6 + light(x, y) * 3, x, y))
    const pl = (x: number, y: number) => shade(STEEL, 6 + light(x, y) * 4, x, y)
    c.line(17, 27 + jolt, pk.x - 1, 27 + jolt, pl)
    for (let y = 27 - pk.lift; y <= 27; y++) c.set(pk.x, y + jolt, pl(pk.x, y))
    const drop = HANDLE[f] ?? 0
    c.line(16, 27 + jolt, 9, 25 + drop, pl)
    for (let x = 0; x <= 9; x++) {
      const y = Math.round(25 + drop - (9 - x) * 0.25)
      c.set(x, y - 1, shade(GRIP, 2.2 + light(x, y) * 2, x, y))
      c.set(x, y, shade(GRIP, 0.8 + light(x, y), x, y))
    }
    if (p < 0.3) {
      for (let x = 18; x <= 45; x++) c.set(x, top, STEEL[4] ?? 0)
      for (let y = 0; y < 14; y++) {
        for (let x = 19; x <= 44; x++) {
          const v = c.get(x, y)
          if (CHROME.includes(v) && !CHROME.includes(c.get(x, y - 1))) c.set(x, y, CHROME[3] ?? 0)
        }
      }
    }
    out.push(c.px)
  }

  return out
}

export const scene: Scene = {
  verb: 'Finagling',
  render,
  hero: 53,
  snaps: [
    { frames: [DARK, DARK + 6], why: 'the flashlight stutters out and back, lighting and darkening the whole picture; the lock shuts in the dark' },
  ],
}