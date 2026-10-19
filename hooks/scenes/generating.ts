import { Canvas, PALETTE, TAU, beat, clamp, ease, hex, lerp, lightAt, mix, mod, shade, threshold, type Scene } from '../engine'

const W = 64
const H = 32
const LOOP = 72

const WALL = hex('07081a 0d0f24 151630 21203a 32293f 483643 65473f 875c3c ab7640 d09a50')
const DESK = hex('0b080e 160f15 24161a 37201e 4e2b22 683828 87492f a95f38 c97c48 e49e60')
const PLATE = hex('061418 0a2228 10323a 17464c 205c5e 2e7470 468e80 6aa892')
const METAL = PALETTE.metal
const BRASS = hex('1e1208 3a240c 5e3c14 8a5a20 b8822e dcac4a f4d684')
const FUR = hex('1e0e10 3a1c14 5e3018 8a4a22 b8702e d8964a ecbc78 f8deae')
const CREAM = hex('241c22 463c42 766a66 ac9e8e dacab0 f2e6d0 fff8ec')
const PINK = hex('3a1a24 6a2c3a a04a5a d87888 f4a8b0')
const GLOW = hex('5a1808 a03410 e06a1c f8a83a fcd884 fff2c8 ffffff')
const FILAMENT = [0x2a2028, ...GLOW]

const WX = 22
const WY = 14
const WR = 12
const BULB_X = 50
const BULB_Y = 13
const BULB_R = 5
const FLOOR = 28

const OMEGA = 0.3
function speed(f: number): number {
  if (f < 9) return 0
  if (f < 44) return OMEGA * Math.min(1, ease.inOut(beat(f, 9, 37)) * 1.05)
  return OMEGA * Math.exp(-(f - 44) / 6.5)
}
const ANGLE: number[] = (() => {
  const raw: number[] = []
  let a = 0
  for (let f = 0; f < LOOP; f++) {
    raw.push(a)
    a += speed(f)
  }
  const step = TAU / 6
  const scale = (Math.max(1, Math.round(a / step)) * step) / a
  return raw.map(v => v * scale)
})()

const GLOWS: number[] = (() => {
  let b = 0
  const out: number[] = []
  for (let n = 0; n < LOOP * 2; n++) {
    const f = n % LOOP
    const target = (speed(f) / OMEGA) ** 1.3
    b += (target - b) * (target > b ? 0.45 : 0.2)
    if (n >= LOOP) out.push(f >= 40 && f <= 44 ? 1.15 : b)
  }
  return out
})()

type Blob = { x: number; y: number; rx: number; ry: number }
type Hamster = { body: Blob; head: Blob; ear: [number, number]; eye: [number, number]; nose: [number, number]; feet: [number, number][]; belly: [number, number]; happy: boolean }

function hamster(stand: number, phase: number, run: number, crouch: number, puff: number, happy: boolean, sniff: number): Hamster {
  const s = Math.sin(phase)
  const k = Math.cos(phase)
  const stretch = run * s * 0.7
  const bob = -run * Math.max(0, k) * 0.8 + crouch
  const L = (a: number, b: number) => lerp(a, b, stand)
  return {
    body: { x: L(3, 2.8), y: L(-3, -4.4) + bob, rx: L(4.4 + stretch, 3.7) * puff, ry: L(3 - stretch * 0.4, 4.4) * lerp(1, puff, 0.5) },
    head: { x: L(6.9 + stretch + sniff, 3.8), y: L(-3.8, -9.7) + bob * 0.7, rx: 2.7, ry: 2.6 },
    ear: [L(5.7 + stretch + sniff, 2.3), L(-6.3, -11.9) + bob * 0.7],
    eye: [L(7.8 + stretch + sniff, 4.8), L(-4.5, -10.3) + bob * 0.7],
    nose: [L(9.5 + stretch + sniff, 6.4), L(-3.4, -9.5) + bob * 0.7],
    feet: [
      [L(0.4 - run * s * 1.6, 1.6), L(0 - run * Math.max(0, -k), 0)],
      [L(1.6 - run * s * 1.2, 3.8), L(0, 0)],
      [L(6.2 + run * s * 1.8, 6), L(0 - run * Math.max(0, k), -5.8)],
      [L(7.2 + run * s * 1.4, 5.6), L(0, -5)],
    ],
    belly: [L(0.35, 1), L(1, 0.15)],
    happy,
  }
}

const inBlob = (x: number, y: number, b: Blob) => ((x - b.x) / b.rx) ** 2 + ((y - b.y) / b.ry) ** 2 <= 1

function render(): Int32Array[] {
  const out: Int32Array[] = []
  for (let f = 0; f < LOOP; f++) {
    const c = new Canvas()
    const glow = GLOWS[f] ?? 0
    const blaze = f === 41 ? 1 : f === 42 ? 0.45 : 0
    const power = Math.min(1.15, glow)
    const warm = clamp((power - 0.03) / 0.2)
    const reach = BULB_R + 2 + power * 9
    const halo = (x: number, y: number) => {
      if (power < 0.15) return 0
      const t = 1 - (Math.hypot(x - BULB_X, y - BULB_Y) - BULB_R) / (reach - BULB_R)
      return t > 1 ? 0 : (t > 0.66 ? 0.3 : t > 0.33 ? 0.18 : t > 0 ? 0.08 : 0) * Math.min(1, power)
    }
    const light = (x: number, y: number) => power * lightAt([{ x: BULB_X, y: BULB_Y, power: 1, radius: 30 + 26 * power }], x, y) + blaze * 0.6 + halo(x, y)
    const angle = ANGLE[f] ?? 0
    const omega = speed(f)

    const stand = f < 44 ? 0 : f < 48 ? (1 - Math.cos(Math.PI * beat(f, 44, 48))) / 2 : f < 62 ? 1 : 1 - ease.inOut(beat(f, 62, 67))
    const run = f >= 9 && f < 46 ? clamp((omega / OMEGA) * 1.6 + 0.4) * (1 - stand) : 0
    let phase = 0
    for (let n = 9; n < Math.min(f, 46); n++) phase += Math.min(TAU / 4, 0.5 + (speed(n) / OMEGA) * 1.4)
    const crouch = f >= 5 && f < 9 ? (f % 2 ? 0.6 : 1) : 0
    const sniff = (f < 5 || f >= 68) && f % 2 === 1 ? 1 : 0
    const puff = f >= 48 && f < 62 ? 1.05 + 0.18 * Math.exp(-(f - 49) / 3) * Math.max(0, Math.cos((f - 49) * 0.9)) : 1
    const ham = hamster(stand, phase, run, crouch, puff, f >= 50 && f < 60, sniff)
    const HX = WX - 4
    const HY = WY + WR - 2
    const inHamster = (x: number, y: number) => inBlob(x - HX, y - HY, ham.body) || inBlob(x - HX, y - HY, ham.head)

    const spokeAt = (x: number, y: number) => {
      const d = Math.hypot(x - WX, y - WY)
      if (d > WR + 0.5) return false
      if (d > WR - 1.5) return true
      const a = Math.atan2(y - WY, x - WX) - angle
      return Math.abs(mod(a + TAU / 12, TAU / 6) - TAU / 12) * d < 0.6 && d > 2
    }
    const blocks = (x: number, y: number) => spokeAt(Math.round(x), Math.round(y)) || inHamster(Math.round(x), Math.round(y))
    const shadowed = (x: number, y: number) => {
      const t = 1 / 1.35
      return blocks(BULB_X + (x - BULB_X) * t, BULB_Y + (y - BULB_Y) * t)
    }

    for (let y = 0; y < FLOOR; y++) {
      for (let x = 0; x < W; x++) {
        const lit = light(x, y) * (shadowed(x, y) ? 0.25 : 1)
        const stripe = mod(x, 7) === 0 ? -0.7 : 0
        c.set(x, y, shade(WALL, 1.1 + lit * 6.5 + stripe * Math.min(1, lit * 2), x, y))
      }
    }
    for (let y = FLOOR; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const lit = light(x, y - 4)
        const edge = y === FLOOR ? 1 : 0
        const grain = mod(x * 3 + y * 7, 11) === 0 ? -0.6 : 0
        c.set(x, y, shade(DESK, 1.6 + lit * 5.5 + edge + grain - (y - FLOOR) * 0.3, x, y))
      }
    }
    for (const [sx, sw] of [[WX - 9, 18], [33, 5], [43, 12]] as const) {
      for (let x = sx; x < sx + sw; x++) c.set(x, FLOOR, mix(c.get(x, FLOOR), 0x07050a, 0.55))
    }

    for (const side of [-1, 1]) {
      for (let t = 0; t <= 1; t += 0.05) {
        const x = lerp(WX, WX + side * 8, t)
        const y = lerp(WY, FLOOR - 0.5, t)
        c.set(x, y, shade(METAL, 1.5 + light(x, y) * 3.5, x, y))
      }
    }
    for (let y = WY - WR - 1; y <= WY + WR + 1; y++) {
      for (let x = WX - WR - 1; x <= WX + WR + 1; x++) {
        const d = Math.hypot(x - WX, y - WY)
        if (d > WR + 0.5) continue
        const lit = light(x, y)
        const facing = (x - WX) / WR
        if (d > WR - 1.5) {
          const a = Math.atan2(y - WY, x - WX) - angle
          const rung = mod(a * (24 / TAU), 1) < 0.5
          c.set(x, y, shade(METAL, 2.6 + lit * (3 + facing * 1.5) + (rung ? 0.8 : 0) - (y > WY ? 0.4 : 0), x, y))
          continue
        }
        const a = Math.atan2(y - WY, x - WX) - angle
        const rib = Math.abs(mod(a + TAU / 12, TAU / 6) - TAU / 12) * d < 0.6 && d > 2
        const hole = Math.abs(d - 8) < 0.7 && mod(a * (12 / TAU) + 0.5, 1) < 0.34
        const level = 1.6 + lit * (2.4 + facing * 1.2) - d * 0.04 + (rib ? 1.4 : 0) - (hole ? 1.2 : 0)
        c.set(x, y, shade(PLATE, level, x, y))
      }
    }
    c.disc(WX, WY, 1.6, (x, y) => shade(METAL, 3 + light(x, y) * 3 + (x > WX ? 1 : 0), x, y))
    c.set(WX, WY, shade(METAL, 1.5, 0, 0))

    for (let y = HY - 14; y <= HY + 1; y++) {
      for (let x = HX - 4; x <= HX + 12; x++) {
        const lx = x - HX
        const ly = y - HY
        const inHead = inBlob(lx, ly, ham.head)
        const inBody = inBlob(lx, ly, ham.body)
        if (!inHead && !inBody) continue
        const b = inHead ? ham.head : ham.body
        const nx = (lx - b.x) / b.rx
        const ny = (ly - b.y) / b.ry
        const lit = light(x, y)
        const diffuse = clamp(nx * 0.8 - ny * 0.45)
        const rimShadow = nx * nx + ny * ny > 0.62 && nx < 0.2 ? -0.9 : 0
        const isBelly = inBody && !inHead && (lx - ham.body.x) * ham.belly[0] + (ly - ham.body.y) * ham.belly[1] > 1.2
        const isCheek = inHead && nx > 0.1 && ny > 0.15
        const level = 1.6 + 1.3 * Math.min(1, lit * 1.2) + diffuse * (0.6 + lit * 2.4) + rimShadow
        c.set(x, y, isBelly || isCheek ? shade(CREAM, level + 0.6, x, y) : shade(FUR, level, x, y))
      }
    }
    const [ex, ey] = ham.ear
    c.set(HX + ex, HY + ey, shade(PINK, 2 + light(HX + ex, HY + ey) * 2, 0, 0))
    c.set(HX + ex + 1, HY + ey, shade(FUR, 2.4 + light(HX + ex, HY + ey) * 2, 0, 0))
    const [eyeX, eyeY] = ham.eye
    if (ham.happy) {
      c.set(HX + eyeX - 0.5, HY + eyeY, shade(FUR, 0.4, 0, 0))
      c.set(HX + eyeX + 0.5, HY + eyeY, shade(FUR, 0.4, 0, 0))
    } else {
      c.set(HX + eyeX, HY + eyeY, 0x0a0608)
      if (power > 0.25) c.set(HX + eyeX, HY + eyeY - 1, mix(c.get(HX + eyeX, HY + eyeY - 1), 0xffffff, 0.5))
    }
    c.set(HX + ham.nose[0], HY + ham.nose[1], shade(PINK, 3 + light(HX + ham.nose[0], HY + ham.nose[1]), 0, 0))
    for (const [fx, fy] of ham.feet) c.set(HX + fx, HY + fy, shade(PINK, 2.2 + light(HX + fx, HY + fy) * 1.5, 0, 0))

    for (let y = 22; y < FLOOR; y++) {
      for (let x = 34; x <= 36; x++) {
        const band = y === 24
        const lvl = 2.2 + light(x, y) * 3.5 + (x === 36 ? 1 : x === 34 ? -0.6 : 0)
        c.set(x, y, band ? shade(hex('3a0c10 6a1418 a02424 d04030'), lvl * 0.7, x, y) : shade(METAL, lvl, x, y))
      }
    }
    c.set(33, 22, shade(METAL, 1 + (mod(angle * 6, 1) < 0.5 ? 2 : 0) + light(33, 22) * 2, 0, 0))
    c.set(35, 21, shade(METAL, 3 + light(35, 21) * 3, 0, 0))
    const wire: [number, number][] = [[37, 26], [38, 28], [39, 29], [41, 30], [43, 30], [45, 29], [46, 28]]
    for (let i = 0; i + 1 < wire.length; i++) {
      const [ax, ay] = wire[i] ?? [0, 0]
      const [bx, by] = wire[i + 1] ?? [0, 0]
      c.line(ax, ay, bx, by, (x, y) => shade(hex('1a080a 3a1014 6a2020 9a3428 c85a3a'), 1 + light(x, y) * 3, x, y))
    }
    if (omega > 0.02) {
      const travel = (f * (0.15 + omega)) % 1
      for (const off of [0, 0.5]) {
        const t = mod(travel + off, 1) * (wire.length - 1)
        const i = Math.floor(t)
        const [ax, ay] = wire[i] ?? [0, 0]
        const [bx, by] = wire[i + 1] ?? [ax, ay]
        c.set(lerp(ax, bx, t - i), lerp(ay, by, t - i), shade(GLOW, 2 + (omega / OMEGA) * 3, 0, 0))
      }
    }

    for (let y = 24; y < FLOOR + 1; y++) {
      for (let x = 44; x <= 55; x++) {
        const top = y === 24
        c.set(x, y, shade(DESK, (top ? 4.2 : 2.6) + light(x, y) * (top ? 4 : 2.5) - (x === 55 ? 0.8 : 0), x, y))
      }
    }
    for (let y = 19; y <= 23; y++) {
      for (let x = BULB_X - 2; x <= BULB_X + 2; x++) {
        const thread = y % 2 === 0 ? -0.8 : 0
        c.set(x, y, shade(BRASS, 2.6 + light(x, y) * 2.5 + thread + (x === BULB_X - 2 ? 1 : 0), x, y))
      }
    }
    for (let y = BULB_Y - BULB_R - 1; y <= 19; y++) {
      for (let x = BULB_X - BULB_R - 1; x <= BULB_X + BULB_R + 1; x++) {
        const d = Math.hypot(x - BULB_X, (y - BULB_Y) * (y > BULB_Y ? 0.8 : 1))
        const isNeck = y >= BULB_Y + 3 && Math.abs(x - BULB_X) <= 2
        if (d > BULB_R + 0.3 && !isNeck) continue
        const core = 1 - d / (BULB_R + 1)
        const front = warm * (BULB_R + 1)
        if (d <= front) {
          const fresh = (front - d) * 0.35 + Math.max(0, power - 0.25) * 20
          c.set(x, y, shade(GLOW, Math.min(fresh, power * 4.2 + core * (0.6 + power * 1.9) - 0.6), x, y))
        } else {
          const edge = d > BULB_R - 0.8
          const cold = (1 - warm) * (edge ? 2 : 1)
          const step = Math.floor(cold) + (cold - Math.floor(cold) > threshold(x, y) ? 1 : 0)
          if (step > 0) c.tint(x, y, 0xb8c0d8, step > 1 ? 0.28 : 0.1)
          if (x === BULB_X - 2 && y === BULB_Y - 3) c.set(x, y, 0x9aa0b8)
        }
      }
    }
    const hot = shade(FILAMENT, warm * (3 + power * 5), 0, 0)
    for (const [x, y] of [[BULB_X - 1, 18], [BULB_X - 1, 17], [BULB_X - 1, 16], [BULB_X + 1, 18], [BULB_X + 1, 17], [BULB_X + 1, 16]] as const) {
      c.set(x, y, shade(FILAMENT, warm * (3.4 + power * 3.6), 0, 0))
    }
    for (const [x, y] of [[BULB_X - 1, 15], [BULB_X, 14], [BULB_X + 1, 15]] as const) c.set(x, y, hot)
    out.push(c.px)
  }
  return out
}

export const scene: Scene = {
  verb: 'Generating',
  render,
  hero: 49,
  snaps: [
    { frames: [69, 4], box: [26, 18, 29, 22], why: 'the hamster sniffs before and after its run, its nose twitching every frame' },
    { frames: 32, box: [21, 6, 23, 12], colors: [...PLATE.slice(1, 5)], why: 'the wheel at full spin: a spoke sweeps past faster than it can be followed' },
    { frames: [41, 43], why: 'the bulb blazes: a flash lights the whole room and throws the wheel\'s shadow across the wall, then decays' },
  ],
}
