import { Canvas, PALETTE, beat, clamp, ease, hash, hex, lerp, mod, shade, smoothstep, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 48
const CX = 31.5
const ARCH_Y = 15

const WALL = hex('0a060e 120a16 1c0f1e 281424 381a2a 4c2230 662c34 863a36 a84e3a')
const WOOD = PALETTE.wood
const METAL = PALETTE.metal
const DOME = hex('3a1606 6a2a0a a04a12 d07a22 f0aa48 ffd88a fff4d0')
const VINYL = hex('2a0610 4c0c18 761424 a0202c c83a36 e86448')
const TILE = hex('241e26 3a3038 564650 7a6268 9e8484 c2aaa0')
const CREAM = hex('7a6a52 e0d2b0 fff4dc')
const RECORD = hex('050408 0e0c14 1c1a26 3a3848 6a6a80 b0b0c8')
const LABEL = hex('5a0e14 a0201c e04a2a ffa060')
const SHAKE = hex('6a2a48 b0507a e88aac fcc4d6')
const NIGHT = hex('060812 0c1222 141c34 22305a')

const NEON: number[][] = [
  hex('661724 ff3a5a ff93a4 ffe1e6'),
  hex('66370c ff8a1e ffbf83 ffeddd'),
  hex('665516 ffd436 ffe790 fff9e1'),
  hex('1c6037 46f08a 99f7bf e3fded'),
  hex('135066 30c8ff 8de1ff e0f7ff'),
  hex('461e66 b04aff d49bff f3e4ff'),
]
const neon = (hue: number, level: number) => shade(NEON[mod(Math.floor(hue * NEON.length), NEON.length)] ?? [], level)

const HOLD_Y = 7.5
const REST_Y = 10.6
function recordY(f: number): number {
  if (f < 8) return HOLD_Y - (f === 6 || f === 7 ? 0.6 : 0)
  if (f < 12) return lerp(HOLD_Y, REST_Y, ease.in(beat(f, 8, 12)))
  if (f < 42) return REST_Y
  return lerp(REST_Y, HOLD_Y, smoothstep(42, 47, f))
}
const spinSpeed = (f: number) => smoothstep(13, 19, f) * (1 - smoothstep(36, 41, f))
const SPIN: number[] = (() => {
  const out: number[] = []
  let a = 0
  for (let f = 0; f < LOOP; f++) {
    out.push(a)
    a += spinSpeed(f) * 0.62
  }
  return out
})()
const armOn = (f: number) => ease.inOut(beat(f, 13, 17)) * (1 - ease.inOut(beat(f, 36, 40)))
function music(f: number): { surge: number; pulse: number } {
  const land = f >= 12 && f < 16 ? [1.6, 1.1, 0.6, 0.3][f - 12] ?? 0 : 0
  const playing = smoothstep(15, 18, f) * (1 - smoothstep(37, 41, f))
  const pulse = playing * (mod(f - 16, 6) === 0 ? 1 : mod(f - 16, 6) === 1 ? 0.5 : 0)
  return { surge: land, pulse }
}

const BEATS = [16, 22, 28, 34]
function grilleLevel(f: number): number {
  for (const b of BEATS) {
    if (f === b) return 2
    if (f === b - 1 || f === b + 1) return 1
  }
  return f >= 12 && f <= 15 ? 1 : 0
}
const HUE_STEPS = [6, 20, 26, 32, 38, 46]
function grilleColour(f: number, level: number, x: number, y: number): number {
  const k = HUE_STEPS.filter(s => s <= f).length
  const isNext = HUE_STEPS.includes(f + 1) && ((x + y) & 1) === 1
  return shade(NEON[mod((isNext ? 4 : 5) - k, NEON.length)] ?? [], level)
}
function inCabinet(x: number, y: number): boolean {
  const dx = x - CX
  if (y < 1 || y > 28) return false
  if (y >= 27) return Math.abs(dx) <= 15
  return (y < ARCH_Y ? Math.hypot(dx, y - ARCH_Y) : Math.abs(dx)) < 14.6
}
const NOTE = ['.#.', '.##', '.#.', '##.']
const NOTE_GOING = [['...', '...', '.#.', '##.'], ['...', '...', '...', '.#.']]
function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const { surge, pulse } = music(f)
    const glowPower = 1 + surge * 0.5 + pulse * 0.25
    const cycle = f / LOOP
    const room = (x: number, y: number) => glowPower * Math.max(0, 1 - Math.hypot((x - CX) / 34, (y - 13) / 26)) ** 1.6
    for (let y = 0; y < 27; y++) {
      for (let x = 0; x < W; x++) {
        const l = room(x, y)
        if (y < 17) c.set(x, y, shade(WALL, 0.6 + l * 6.2, x, y))
        else if (y === 17) c.set(x, y, shade(METAL, 2 + l * 5.5, x, y))
        else {
          const isGroove = mod(x - 2, 7) === 0
          c.set(x, y, shade(WALL, 0.4 + l * 5.2 - (isGroove ? 1 : 0) + (y === 18 ? -0.8 : 0), x, y))
        }
      }
    }
    for (let y = 3; y <= 12; y++) {
      for (let x = 2; x <= 12; x++) {
        const isFrame = x === 2 || x === 12 || y === 3 || y === 12 || x === 7
        if (isFrame) {
          c.set(x, y, shade(METAL, 1.4 + room(x, y) * 4 + (x === 12 ? 1 : 0), x, y))
          continue
        }
        const sign = Math.hypot(x - 9.5, (y - 6) * 1.3)
        let v = shade(NIGHT, 0.6 + (y - 3) * 0.2, x, y)
        if (sign < 2.6) v = sign < 1.3 ? (NEON[0]?.[1] ?? 0) : (NEON[0]?.[0] ?? 0)
        const isRain = mod(x * 3 + y - f * 2, 9) === 0 && hash(x, Math.floor((y - f * 2 / 3) / 3)) < 0.6
        if (isRain) v = NIGHT[3] ?? 0
        c.set(x, y, v)
      }
    }
    for (let y = 27; y < H; y++) {
      const depth = y - 24
      for (let x = 0; x < W; x++) {
        const u = Math.floor((x - CX) / (depth * 1.1))
        const v = Math.floor(depth * 0.75)
        const isLight = ((u + v) & 1) === 0
        const l = room(x, y) * 1.1
        c.set(x, y, isLight ? shade(TILE, 0.4 + l * 4.8, x, y) : shade(WALL, 0.2 + l * 3.4, x, y))
      }
    }
    for (let y = 16; y <= 27; y++) {
      for (let x = 0; x <= 5; x++) {
        if (y === 16 && (x === 0 || x === 5)) continue
        const l = room(x, y)
        const tuck = (x === 2 && y > 17 && y < 24) || (x === 4 && y > 17 && y < 24) ? -0.8 : 0
        c.set(x, y, shade(VINYL, 0.6 + l * 4.2 + (x === 5 ? 1 : 0) + tuck, x, y))
      }
    }
    for (let x = 6; x <= 11; x++) {
      c.set(x, 23, shade(VINYL, 1 + room(x, 23) * 4.4, x, 23))
      c.set(x, 24, shade(VINYL, 0.3 + room(x, 24) * 2.4, x, 24))
    }
    for (let x = 4; x <= 14; x++) {
      c.set(x, 19, shade(METAL, 3 + room(x, 19) * 4 + (x === 14 ? 1 : 0), x, 19))
      c.set(x, 20, shade(WALL, 1 + room(x, 20) * 4, x, 20))
    }
    for (let y = 21; y <= 26; y++) c.set(12, y, shade(METAL, 1.6 + room(12, y) * 3, 12, y))
    for (let x = 10; x <= 14; x++) c.set(x, 27, shade(METAL, 1.4 + room(x, 27) * 3, x, 27))
    for (let y = 15; y <= 18; y++) {
      for (let x = 8; x <= 10; x++) {
        c.set(x, y, shade(SHAKE, 1 + room(x, y) * 2 + (x === 10 ? 0.8 : 0) - (y - 15) * 0.3, x, y))
      }
    }
    c.set(9, 14, 0xd8203a)
    c.set(10, 14, CREAM[2] ?? 0)
    c.set(10, 13, CREAM[2] ?? 0)
    for (let y = 18; y <= 27; y++) {
      for (let x = 55; x < W; x++) {
        const l = room(x, y)
        if (y === 18) c.set(x, y, shade(METAL, 3 + l * 4 + (x === 55 ? 1 : 0), x, y))
        else c.set(x, y, shade(WALL, 1 + l * 4 + (x === 55 ? 1.2 : 0) - (mod(x, 4) === 1 ? 0.8 : 0), x, y))
      }
    }
    for (let x = 48; x <= 53; x++) {
      c.set(x, 21, shade(VINYL, 2 + room(x, 21) * 4 + (x === 48 ? 1.2 : 0), x, 21))
      c.set(x, 22, shade(METAL, 2 + room(x, 22) * 3, x, 22))
    }
    for (let y = 23; y <= 27; y++) c.set(50, y, shade(METAL, 2 + room(50, y) * 4, 50, y))
    for (let x = 48; x <= 53; x++) c.set(x, 28, shade(METAL, 1.4 + room(x, 28) * 3, x, 28))
    for (let y = 1; y <= 28; y++) {
      for (let x = 16; x <= 47; x++) {
        const dx = x - CX
        const rr = y < ARCH_Y ? Math.hypot(dx, y - ARCH_Y) : Math.abs(dx)
        if (y >= 27) {

          if (Math.abs(dx) <= 15) c.set(x, y, shade(METAL, (y === 27 ? 5 : 3) + glowPower * 0.6 - Math.abs(dx) * 0.08, x, y))
          continue
        }
        if (rr >= 14.6) continue
        if (rr >= 13) {
          const isEdge = rr >= 14
          c.set(x, y, shade(WOOD, (isEdge ? 2.2 : 3.6) + glowPower * 0.8 + (dx > 0 && isEdge ? -0.8 : 0) + (y < 6 ? 0.6 : 0), x, y))
          continue
        }
        if (rr >= 11) {
          const s = y < ARCH_Y
            ? 0.2 + (Math.atan2(y - ARCH_Y, dx) / -Math.PI) * 0.6
            : dx < 0 ? 0.2 * ((27 - y) / 12) : 1 - 0.2 * ((27 - y) / 12)
          const hue = s * 1.2 + cycle * 2
          const isCore = rr < 12
          c.set(x, y, neon(hue, (isCore ? 2 : 1.2) + surge * 0.8 + pulse * 0.6))
          continue
        }
        if (rr >= 10) {
          c.set(x, y, shade(METAL, 4.6 + glowPower * 0.8 + (dx < 0 ? 0.6 : -0.4), x, y))
          continue
        }
        if (y < ARCH_Y) {
          const ray = Math.floor((Math.atan2(y - 14, dx) / Math.PI) * 14)
          const isStreak = Math.abs(x + y * 0.8 - 30) < 0.9 && y < 10
          const glow = 4.6 - Math.hypot(dx * 0.5, y - 14) * 0.32 + (ray % 2 ? -0.9 : 0)
          c.set(x, y, shade(DOME, glow + surge * 0.6 + pulse * 0.4 + (isStreak ? 1.6 : 0), x, y))
          continue
        }
        if (y === ARCH_Y) {
          c.set(x, y, shade(METAL, 5.4, x, y))
          continue
        }
        if (y <= 18) {
          if (mod(x - 22, 5) === 0) c.set(x, y, shade(METAL, 2, x, y))
          else if (y === 17) c.set(x, y, shade(METAL, 4.4, x, y))
          else c.set(x, y, shade(CREAM, 1 + glowPower * 0.4, x, y))
          continue
        }
        const isBar = mod(x - 22, 3) === 0
        if (isBar) c.set(x, y, shade(METAL, 4 + (y === 19 ? 1 : 0) + glowPower * 0.4, x, y))
        else c.set(x, y, grilleColour(f, Math.max(0, grilleLevel(f) - (y > 23 || y === 19 ? 1 : 0)), x, y))
      }
    }
    for (const tx of [19, 20, 43, 44]) {
      for (let y = 29; y < H; y++) {
        const hue = (tx < CX ? 0 : 1) * 1.2 + cycle * 2 + (tx < CX ? 0.02 : -0.02)
        if ((y + tx) % 2 === 0 || y === 29) c.set(tx, y, neon(hue, y === 29 ? 1 : 0))
      }
    }
    for (const [tx, seed] of [[19, 1], [44, 2], [20, 3], [43, 4]] as const) {
      for (let k = 0; k < 3; k++) {
        const y = Math.round(27 - mod(f * 0.5 + k * 4 + seed * 3.3, 12))
        if (y > ARCH_Y && y < 27) c.set(tx, y, 0xfff8f0)
      }
    }
    for (let x = 24; x <= 39; x++) {
      const d = Math.abs(x - CX)
      if (d <= 7) c.set(x, 13, shade(METAL, 3.4 - d * 0.18 + glowPower * 0.4, x, 13))
      if (d <= 6) c.set(x, 14, shade(METAL, 1.6, x, 14))
    }
    const ry = recordY(f)
    const isLanding = f === 12
    const rx = isLanding ? 7.2 : 6.5
    const rry = isLanding ? 1.4 : 1.8
    const ryc = ry + 0.9
    for (let y = Math.floor(ryc - 2); y <= Math.ceil(ryc + 2); y++) {
      for (let x = 23; x <= 40; x++) {
        const ex = (x - CX) / rx
        const ey = (y - ryc) / rry
        const d = ex * ex + ey * ey
        if (d > 1) continue
        const isLabel = Math.abs(x - CX) < 2.2 && Math.abs(y - ryc) < 0.6
        if (isLabel) {
          c.set(x, y, shade(LABEL, 1.8 + glowPower * 0.4 + (x > CX ? -0.6 : 0), x, y))
          continue
        }
        const a = Math.atan2(ey, ex)
        const sheen = Math.cos(2 * (a - SPIN[f]!)) > 0.82 && d > 0.25 ? 2.2 : 0
        c.set(x, y, shade(RECORD, 1 + sheen + (d > 0.8 ? -0.5 : 0) + (y < ryc ? 0.4 : 0), x, y))
      }
    }
    for (let y = 6; y <= 12; y++) {
      if (y > Math.round(ryc) - 1 && y <= Math.round(ryc) + 1 && y !== Math.round(ryc)) continue
      if (y === Math.round(ryc)) c.set(31, y, shade(METAL, 6, 0, 0))
      else if (y < ryc) c.set(31, y, shade(METAL, 1.4, 0, 0))
    }
    const on = armOn(f)
    const ang = lerp(-1.55, -2.55, on)
    const px = 39
    const py = 12
    const ax = px + Math.cos(ang) * 6
    const ay = py + Math.sin(ang) * 6
    c.line(px, py, ax, ay, shade(METAL, 1.4, 0, 0))
    c.set(ax, ay, shade(METAL, 6, 0, 0))
    c.set(px, py, shade(METAL, 2.6, 0, 0))
    c.set(px + 1, py, shade(METAL, 4, 0, 0))
    for (let n = 0; n < 4; n++) {
      const born = 17 + n * 5
      const t = f - born
      if (t < -2 || t > 14) continue
      const side = n % 2 ? 1 : -1
      const out = t < 0 ? 17 + t * 1.2 : 17 + t * 0.6
      const nx = CX + side * out + Math.round(Math.sin(t * 0.7 + n) * 1)
      const ny = 20 - t * 1.1
      const hue = 0.1 + n * 0.29
      const colour = neon(hue, t > 10 ? 1 : 2)
      const art = t >= 13 ? NOTE_GOING[t - 13] ?? [] : NOTE
      const sx = Math.round(nx) - 1
      const sy = Math.round(ny)
      art.forEach((row, j) => [...row].forEach((ch, i) => {
        if (ch === '#' && !inCabinet(sx + i, sy + j)) c.set(sx + i, sy + j, colour)
      }))
    }
    out.push(c.px)
  }
  return out
}
export const scene: Scene = {
  verb: 'Razzmatazzing',
  render,
  hero: 22,
  snaps: [

    { frames: 6, box: [23, 19, 41, 26], colors: [0x461e66], why: 'the grille light changes hue' },
    { frames: 19, box: [23, 19, 41, 26], colors: [0x1c6037], why: 'the grille light changes hue' },
  ],
}