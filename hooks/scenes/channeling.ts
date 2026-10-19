import { Canvas, PALETTE, TAU, beat, ease, frames, hash, hex, lerp, loopNoise, shade, smoothstep, type Scene } from '../engine'

const LOOP = 48
const CX = 31.5
const CY = 13
const R = 9.2
const TABLE_Y = 21
const EDGE_Y = 28

const CURTAIN = hex('0a0611 120a1c 1c0f29 281537 351b46 452357 582d68')
const CLOTH = hex('0f050b 1c0812 2c0d1a 401323 561a2c 70233a 8c2f44 aa4250')
const MIST = hex('0c0a26 141640 1e2160 2c3184 3d47a4 5463be 7286d2 9aaee4 c6d8f2 f4fbff')
const BRASS = PALETTE.gold
const SKIN = hex('221022 3a182c 582636 7c3c46 9e5652 bf7464 dc9a7e f0c4a2')
const SLEEVE = hex('04080c 081219 0e1d26 152b35 1e3c47 2a515b 3a6a70')

const vignette = (x: number, y: number) => (((x - 31.5) / 36) ** 2 + ((y - 13) / 26) ** 2) * 1.8

function glow(f: number): number {
  if (f < 12) return 0.75
  if (f < 23) return 0.75 + 0.45 * ease.in(beat(f, 12, 22))
  if (f === 23) return 1.4
  if (f === 24) return 2.3
  if (f === 25) return 1.7
  if (f < 36) return lerp(1.3, 0.5, ease.out(beat(f, 26, 36)))
  return lerp(0.5, 0.75, ease.inOut(beat(f, 36, 47)))
}

const flashOf = (f: number) => (f === 24 ? 0.55 : f === 25 ? 0.25 : f === 23 ? 0.1 : 0)

function mistOf(f: number): [number, number] {
  if (f < 12) return [1, 1]
  if (f < 23) {
    const t = ease.in(beat(f, 12, 22))
    return [lerp(1, 0.2, t), 1 + 0.8 * t]
  }
  if (f < 29) return [1, 0]
  return [1, ease.inOut(beat(f, 29, 46))]
}

const ballLight = (g: number, x: number, y: number) => g * Math.max(0, 1 - Math.hypot(x - CX, (y - CY) * 1.15) / 34) ** 1.5

function lean(f: number): number {
  if (f < 24) return Math.round(ease.inOut(beat(f, 13, 21)))
  if (f < 26) return -Math.round(2 * ease.out(beat(f, 24, 26)))
  return -Math.round(2 * (1 - ease.inOut(beat(f, 26, 40))))
}

function handPixels(hx: number, hy: number, f: number, side: number): Map<number, string> {
  const px = new Map<number, string>()
  const put = (x: number, y: number, k: string) => px.set(y * 64 + x, k)
  for (let y = hy; y <= hy + 2; y++) for (let x = hx; x <= hx + 6; x++) put(x, y, 'skin')
  for (let x = hx + 1; x <= hx + 5; x++) put(x, hy + 3, 'skin')
  for (let x = hx + 1; x <= hx + 4; x++) put(x, hy + 4, 'skin')
  for (let x = hx; x <= hx + 5; x++) put(x, hy + 5, 'cuff')
  const isCalm = f < 14 || f > 30
  ;[3, 4, 5, 4].forEach((len, i) => {
    const flutter = Math.sin(TAU * (f / LOOP) * 3 + i * 1.9 + side * 2.4)
    const curl = isCalm && flutter > 0.45 ? 1 : 0
    for (let h = 1; h <= len - curl; h++) put(hx + i * 2 + (h >= 3 ? 1 : 0), hy - h, 'skin')
  })
  put(hx + 7, hy + 1, 'skin')
  put(hx + 8, hy, 'skin')
  if (f < 14 || f > 30 || f % 2 === 0) put(hx + 9, hy - 1, 'skin')
  put(hx + 2, hy - 1, 'ring')

  return px
}

const CRESCENT = ['.##', '#..', '#..', '.##']
const TWINKLE = ['.#.', '###', '.#.']

function draw(c: Canvas, f: number): void {
  const g = glow(f)
  const flash = flashOf(f)
  const lit = (x: number, y: number) => ballLight(g, x, y) + flash

  for (let y = 0; y < TABLE_Y; y++) {
    for (let x = 0; x < 64; x++) {
      const fold = Math.sin(x * 0.72 + Math.sin(y * 0.18 + x * 0.09) * 0.9)
      c.set(x, y, shade(CURTAIN, 1.6 + fold * 0.75 + lit(x, y) * 4.6 - vignette(x, y), x, y))
    }
  }
  for (const [mx, my] of [[3, 6], [57, 7]] as const) {
    c.sprite(mx, my, CRESCENT, { '#': (x, y) => shade(BRASS, 0.6 + lit(x, y) * 3.2 - vignette(x, y) * 0.5, x, y) })
  }
  for (const [sx, sy] of [[8, 12], [52, 13], [1, 15]] as const) {
    c.sprite(sx, sy, TWINKLE, { '#': (x, y) => shade(BRASS, 0.4 + lit(x, y) * 3 - vignette(x, y) * 0.5, x, y) })
  }
  for (let x = 0; x < 64; x++) {
    const bottom = Math.round(3 - Math.abs(((x + 4) % 8) - 3.5) * 0.6)
    for (let y = 0; y <= bottom; y++) c.set(x, y, shade(CURTAIN, 2.6 - y * 0.4 + lit(x, y) * 4 - vignette(x, y) * 0.6, x, y))
    if (x % 3 !== 2) c.set(x, bottom + 1, shade(BRASS, 1.6 + lit(x, bottom + 1) * 4 - vignette(x, bottom + 1) * 0.5, x, bottom + 1))
  }

  for (let y = TABLE_Y; y < 32; y++) {
    for (let x = 0; x < 64; x++) {
      const l = lit(x, y)
      if (y < EDGE_Y) {
        const pool = Math.max(0, 1 - Math.hypot((x - CX) / 9, (y - 26.5) / 1.6))
        c.set(x, y, shade(CLOTH, 1.8 + (y - TABLE_Y) * 0.12 + l * 5.2 + pool * g * 2 - vignette(x, y), x, y))
      } else if (y === EDGE_Y) {
        c.set(x, y, shade(BRASS, 1.5 + l * 4.5 - vignette(x, y), x, y))
      } else {
        const fold = Math.sin(x * 0.9) * 0.8
        const fringe = y === 31 && x % 3 !== 0
        c.set(x, y, fringe ? shade(BRASS, 1 + l * 3 - vignette(x, y) * 0.5, x, y) : shade(CLOTH, 1.2 + fold + l * 3 - (y - EDGE_Y) * 0.25 - vignette(x, y), x, y))
      }
    }
  }
  for (let x = 0; x < 64; x++) c.set(x, TABLE_Y, shade(CLOTH, 0.8 + lit(x, TABLE_Y) * 3.2 - vignette(x, TABLE_Y), x, TABLE_Y))

  for (let x = 25; x <= 38; x++) c.set(x, 27, shade(CLOTH, 0.6 + lit(x, 27) * 2.4, x, 27))
  for (let x = 26; x <= 37; x++) {
    c.set(x, 25, shade(BRASS, 3 + lit(x, 25) * 2.6 - Math.abs(x - 31.5) * 0.12, x, 25))
    c.set(x, 26, shade(BRASS, 1.4 + lit(x, 26) * 1.5 - Math.abs(x - 31.5) * 0.1, x, 26))
  }
  for (let x = 29; x <= 34; x++) {
    c.set(x, 23, shade(BRASS, 2 + lit(x, 23) * 2.2, x, 23))
    c.set(x, 24, shade(BRASS, 1.4 + lit(x, 24) * 1.6, x, 24))
  }
  for (let y = 16; y <= 24; y++) {
    for (let x = 20; x <= 43; x++) {
      const d = Math.hypot(x - CX, y - CY)
      if (d < R || d > R + 1.4 || y - CY < 5.5) continue
      const inner = d < R + 0.7 ? 1.4 : 0
      c.set(x, y, shade(BRASS, 2.2 + inner * g + lit(x, y) * 2 - Math.abs(x - CX) * 0.06, x, y))
    }
  }

  const [reach, amount] = mistOf(f)
  const turn = TAU * (f / LOOP)
  for (let y = Math.floor(CY - R); y <= Math.ceil(CY + R); y++) {
    for (let x = Math.floor(CX - R); x <= Math.ceil(CX + R); x++) {
      const u = (x - CX) / R
      const v = (y - CY) / R
      const rr = Math.hypot(u, v)
      if (rr > 1) continue
      const a = turn + (1 - rr) * 2.6
      const xr = (u * Math.cos(a) - v * Math.sin(a)) / reach
      const yr = (u * Math.sin(a) + v * Math.cos(a)) / reach
      const n = loopNoise(xr * 1.7 + 9, yr * 1.7 + 9, f / LOOP, 1.4, 3)
      const n2 = loopNoise(xr * 3.1 + 2, yr * 3.1 + 2, f / LOOP, 2, 8)
      const density = amount * smoothstep(1, 0.55, rr / reach) * smoothstep(0.38, 0.72, n * 0.75 + n2 * 0.35)
      const core = (g - 0.75) * 3.6 * Math.max(0, 1 - rr * 1.6) ** 2
      const crescent = v > 0.45 && rr > 0.74 && rr < 0.92 ? 1.3 * g : 0
      const rim = rr > 0.93 ? -0.4 + g * 0.8 : 0
      c.set(x, y, shade(MIST, 0.6 + (1 - rr) * 1.1 + density * 6.2 + core + crescent + rim + flash * 3, x, y))
    }
  }
  for (const [dx, dy, l] of [[-5, -5, 8], [-4, -6, 8], [-6, -4, 7], [-3, -6, 6], [-6, -3, 6], [5, 5, 6]] as const) {
    c.set(CX + 0.5 + dx, CY + dy, shade(MIST, l + flash * 2, 0, 0))
  }

  const dx = lean(f)
  for (const side of [0, 1]) {
    const bob = Math.sin(TAU * (f / LOOP) * 2 + side * 1.3) > 0.55 ? -1 : 0
    const hx = 13 + dx
    const hy = 10 + bob
    const mirror = (x: number) => (side ? 63 - x : x)
    const towardBall = side ? -1 : 1
    const sleeve: [number, number][] = [[hx - 1, hy + 6], [hx + 7, hy + 6], [hx + 2, 32], [-1, 32], [-1, hy + 14]]
    const top = hy + 6
    c.poly(sleeve.map(([x, y]) => [side ? 63 - x : x, y] as [number, number]), (x, y) => {
      const lx = mirror(x)
      const edge = hx + 7 - ((y - top) / (32 - top)) * 5 - lx
      const rim = edge < 1 ? 2.2 : edge < 2 ? 1 : 0
      const fold = Math.abs(lx - (hx + 2) + (y - top) * 0.9) < 0.6 ? -0.9 : 0
      const trim = y <= top + 1 ? 'gold' : ''
      if (trim) return shade(BRASS, 1.6 + lit(x, y) * 2.8 + rim * 0.6 - (y - top) * 0.8, x, y)
      return shade(SLEEVE, 1 + rim + fold + lit(x, y) * 2.6 - vignette(x, y) * 0.5, x, y)
    })
    const hand = handPixels(hx, hy, f, side)
    for (const [key, kind] of hand) {
      const lx = key % 64
      const y = Math.floor(key / 64)
      const x = mirror(lx)
      const l = lit(x, y)
      const facing = !hand.has(key + 1) ? 1 : 0
      const away = !hand.has(key - 1) ? 1 : 0
      if (kind === 'cuff' || kind === 'ring') {
        c.set(x, y, shade(BRASS, 2.4 + l * 3 + facing * 1.5 * (towardBall ? 1 : 1), x, y))
        continue
      }
      c.set(x, y, shade(SKIN, 1.6 + l * 3.4 + facing * (0.8 + l * 1.4) - away * 0.7, x, y))
    }
  }

  const arms = f === 21 ? 1 : f === 22 ? 2 : f === 23 ? 4 : f === 24 ? 11 : f === 25 ? 6 : f === 26 ? 2 : 0
  if (arms > 0) {
    const sx = 32
    const sy = CY
    for (let k = -arms; k <= arms; k++) {
      const t = Math.abs(k) / arms
      const l = 9.4 - t * 3.4
      c.set(sx + k, sy, shade(MIST, l, 0, 0))
      c.set(sx, sy + k, shade(MIST, l, 0, 0))
    }
    const diag = Math.floor(arms / 3)
    for (let k = 1; k <= diag; k++) {
      for (const [ux, uy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) c.set(sx + ux * k, sy + uy * k, shade(MIST, 8.6 - k, 0, 0))
    }
    if (arms >= 4) {
      for (const [ux, uy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.set(sx + ux, sy + uy, MIST[9] ?? 0)
    }
  }

  if (f >= 25) {
    for (let i = 0; i < 18; i++) {
      const life = 9 + Math.floor(hash(i, 3) * 12)
      const age = f - 25
      if (age >= life) continue
      const t = age / life
      const angle = (i / 18) * TAU + hash(i, 1) * 0.5
      const dist = (4 + hash(i, 2) * 15) * ease.out(Math.min(1, age / (life * 0.7)))
      const x = Math.round(32 + Math.cos(angle) * dist * 1.25)
      const y = Math.round(CY + Math.sin(angle) * dist * 0.85 + t * t * 3)
      const level = 9.2 - t * 4
      c.set(x, y, shade(MIST, level, 0, 0))
      if (hash(i, 5) > 0.5 && (age + i) % 3 === 0 && t < 0.7) {
        for (const [ux, uy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.set(x + ux, y + uy, shade(MIST, level - 2.2, 0, 0))
      }
    }
  }
}

export const scene: Scene = {
  verb: 'Channeling',
  render: () => frames(LOOP, draw),
  hero: 24,
  snaps: [
    { frames: [23, 26], why: 'the vision flashes: the ball gathers, flares white over the whole picture, and the light decays as the sparks burst out' },
  ],
}
